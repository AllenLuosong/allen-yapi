import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import {findMeInTree} from '../../../../common.js';
//import constants from '../../../../constants/variable.js'
import {Tooltip, Icon, Input, Button, Row, Col, Spin, Modal, message, Select, Switch, Checkbox} from 'antd';
import {
  fetchInterfaceColList,
  fetchCaseList,
  setColData,
  fetchCaseEnvList
} from '../../../../reducer/modules/interfaceCol';
import HTML5Backend from 'react-dnd-html5-backend';
import { getToken, getEnv } from '../../../../reducer/modules/project';
import { DragDropContext } from 'react-dnd';
import AceEditor from 'client/components/AceEditor/AceEditor';
import * as Table from 'reactabular-table';
import * as dnd from 'reactabular-dnd';
import * as resolve from 'table-resolver';
import axios from 'axios';
import CaseReport from './CaseReport.js';
import _ from 'underscore';
import produce from 'immer';
import {InsertCodeMap} from 'client/components/Postman/Postman.js'


const {
  handleParams,
  handleCurrDomain,
  crossRequest,
  checkNameIsExistInArray
} = require('common/postmanLib.js');
const { handleParamsValue, json_parse, ArrayToObject } = require('common/utils.js');
import CaseEnv from 'client/components/CaseEnv';
import Label from '../../../../components/Label/Label.js';
const Option = Select.Option;
const createContext = require('common/createContext')

import copy from 'copy-to-clipboard';
import {findStorageKeysFromScript} from "../../../../../common/utils";

const defaultModalStyle = {
  top: 10
}

@connect(
  state => {
    return {
      interfaceColList: state.interfaceCol.interfaceColList,
      currColId: state.interfaceCol.currColId,
      currCaseId: state.interfaceCol.currCaseId,
      isShowCol: state.interfaceCol.isShowCol,
      isRander: state.interfaceCol.isRander,
      currCaseList: state.interfaceCol.currCaseList,
      currProject: state.project.currProject,
      token: state.project.token,
      envList: state.interfaceCol.envList,
      curProjectRole: state.project.currProject.role,
      projectEnv: state.project.projectEnv,
      curUid: state.user.uid
    };
  },
  {
    fetchInterfaceColList,
    fetchCaseList,
    setColData,
    getToken,
    getEnv,
    fetchCaseEnvList
  }
)
@withRouter
@DragDropContext(HTML5Backend)
class InterfaceColContent extends Component {
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    fetchCaseList: PropTypes.func,
    setColData: PropTypes.func,
    history: PropTypes.object,
    currCaseList: PropTypes.array,
    currColId: PropTypes.number,
    currCaseId: PropTypes.number,
    isShowCol: PropTypes.bool,
    isRander: PropTypes.bool,
    currProject: PropTypes.object,
    getToken: PropTypes.func,
    token: PropTypes.string,
    curProjectRole: PropTypes.string,
    getEnv: PropTypes.func,
    projectEnv: PropTypes.object,
    fetchCaseEnvList: PropTypes.func,
    envList: PropTypes.array,
    curUid: PropTypes.number
  };

  constructor(props) {
    super(props);
    this.reports = {};
    this.records = {};
    this.state = {
      isLoading: false,
      rows: [],
      reports: {},
      visible: false,
      curCaseid: null,
      advVisible: false,
      curScript: '',
      enableScript: false,
      autoVisible: false,
      mode: 'html',
      email: false,
      download: false,
      descendants:false,
      currColEnvObj: {},
      collapseKey: '1',
      commonSettingModalVisible: false,
      commonSetting: {
        checkHttpCodeIs200: false,
        checkResponseField: {
          name: 'code',
          value: '0',
          enable: false
        },
        checkResponseSchema: false,
        checkScript:{
          enable: false,
          content: ''
        }
      }
    };
    this.onRow = this.onRow.bind(this);
    this.onMoveRow = this.onMoveRow.bind(this);
    this.cancelSourceSet = new Set();
  }

  /**
   * ????????????????????????
   */
  cancelRequestBefore = () => {
    this.cancelSourceSet.forEach(v => {
      v.cancel();
    });
    this.cancelSourceSet.clear();
  }

  async handleColIdChange(newColId){
    this.props.setColData({
      currColId: +newColId,
      isShowCol: true,
      isRander: false
    });

    this.setState({
      isLoading: true
    });

    this.cancelRequestBefore();
    let cancelSource = axios.CancelToken.source();
    this.cancelSourceSet.add(cancelSource);
    let resArr = await Promise.all([
      this.props.fetchCaseList(newColId, {
        cancelToken: cancelSource.token
      }),
      this.props.fetchCaseEnvList(newColId, {
        cancelToken: cancelSource.token
      })
    ]);
    this.cancelSourceSet.delete(cancelSource);
    if (resArr.some(res => axios.isCancel(res.payload))) return;

    const [result] = resArr;
    if (result.payload && result.payload.data.errcode === 0) {
      this.reports = result.payload.data.test_report;
    //  console.log({"reports":JSON.parse(JSON.stringify(this.reports))});
      this.setState({
        commonSetting:{
          ...this.state.commonSetting,
          ...result.payload.data.colData
        }
      })
    }
    this.setState({
      isLoading: false
    });
    this.changeCollapseClose();
    this.handleColdata(this.props.currCaseList);
  }

  async componentWillMount() {
    let cancelSource = axios.CancelToken.source();
    this.cancelSourceSet.add(cancelSource);
    const resArr = await Promise.all([
      this.props.fetchInterfaceColList(this.props.match.params.id, {
        cancelToken: cancelSource.token
      }),
      this.props.getToken(this.props.match.params.id, {
        cancelToken: cancelSource.token
      })
    ]);
    this.cancelSourceSet.delete(cancelSource);
    if (resArr.some(res => axios.isCancel(res.payload))) return;

    const [result] = resArr;

    let { currColId } = this.props;
    const params = this.props.match.params;
    const { actionId } = params;
    this.currColId = currColId = +actionId || result.payload.data.data[0]._id;
    this.props.history.push('/project/' + params.id + '/interface/col/' + currColId);
    if (currColId && currColId != 0) {
      await this.handleColIdChange(currColId)
    }
  }

  componentWillUnmount() {
    this.cancelRequestBefore();
    console.log('col unmount');
    clearInterval(this._crossRequestInterval);
  }

  // ??????????????????
  handleChangeInterfaceCol = (desc, name) => {
    let params = {
      col_id: this.props.currColId,
      name: name,
      desc: desc
    };

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      let project_id = this.props.match.params.id;
      await this.props.fetchInterfaceColList(project_id);
      message.success('??????????????????????????????');
    });
  };

  // ??????header??????
  handleReqHeader = (project_id, req_header, case_env) => {
    let envItem = _.find(this.props.envList, item => {
      return item._id === project_id;
    });

    let currDomain = handleCurrDomain(envItem && envItem.env, case_env);
    let header = currDomain.header;
    header.forEach(item => {
      if (!checkNameIsExistInArray(item.name, req_header)) {
        // item.abled = true;
        item = {
          ...item,
          abled: true
        };
        req_header.push(item);
      }
    });
    return req_header;
  };

  handleColdata = (rows, currColEnvObj = {}) => {
  //  console.log({'rows':JSON.parse(JSON.stringify(rows))});
    let that = this;
    let newRows = produce(rows, draftRows => {
      draftRows.map(item => {
        item.id = item._id;
        item._test_status = item.test_status;
        if(currColEnvObj[item.project_id]){
          item.case_env =currColEnvObj[item.project_id];
        }
        item.req_headers = that.handleReqHeader(item.project_id, item.req_headers, item.case_env);
        return item;
      });
    });
    this.setState({ rows: newRows });
  };



  executeTestsinserver = async () => {
    for (let i = 0, l = this.state.rows.length, newRows, curitem; i < l; i++) {
      let { rows } = this.state;

      let envItem = _.find(this.props.envList, item => {
        return item._id === rows[i].project_id;
      });

      curitem = Object.assign(
        {},
        {caseitme:rows[i]},
        {
          env: envItem.env,
          pre_script: this.props.currProject.pre_script,
          after_script: this.props.currProject.after_script
        },
        {token:this.props.token}
      );
      curitem.caseitme.test_status='loading'
      newRows = [].concat([], rows);
      newRows[i] = curitem.caseitme;
      this.setState({ rows: newRows });
      let status = 'error',
        result;
      try {
       // console.log({curitem});
        result = await axios.post('/api/open/run_case', {params:curitem});
        result=result.data.data;
        if (result.code === 400) {
          status = 'error';
        } else if (result.code === 0) {
          status = 'ok';
        } else if (result.code === 1) {
          status = 'invalid';
        }
      } catch (e) {
        console.error(e);
        status = 'error';
        result = e;
      }
      console.log({['?????????'+curitem.caseitme.casename+'????????????']:result})

      //result.body = result.data;
      this.reports[curitem.caseitme._id] = result;
      this.records[curitem.caseitme._id] = {
        status: result.status,
        params: result.params,
        body: result.res_body
      };

      curitem = Object.assign({}, rows[i], { test_status: status });
      newRows = [].concat([], rows);
      newRows[i] = curitem;
      //console.log({newRows});
      this.setState({ rows: newRows });
    }
    await axios.post('/api/col/up_col', {
      col_id: this.props.currColId,
      test_report: JSON.stringify(this.reports)
    });
  };


  executeTests = async () => {
    for (let i = 0, l = this.state.rows.length, newRows, curitem; i < l; i++) {
      let { rows } = this.state;

      let envItem = _.find(this.props.envList, item => {
        return item._id === rows[i].project_id;
      });

      curitem = Object.assign(
        {},
        rows[i],
        {
          env: envItem.env,
          pre_script: this.props.currProject.pre_script,
          after_script: this.props.currProject.after_script
        },
        { test_status: 'loading' }
      );
      newRows = [].concat([], rows);
      newRows[i] = curitem;
      this.setState({ rows: newRows });
      let status = 'error',
        result;
      try {
        result = await this.handleTest(curitem);

        if (result.code === 400) {
          status = 'error';
        } else if (result.code === 0) {
          status = 'ok';
        } else if (result.code === 1) {
          status = 'invalid';
        }
      } catch (e) {
        console.error(e);
        status = 'error';
        result = e;
      }

      //result.body = result.data;
      this.reports[curitem._id] = result;
      this.records[curitem._id] = {
        status: result.status,
        params: result.params,
        body: result.res_body
      };

      curitem = Object.assign({}, rows[i], { test_status: status });
      newRows = [].concat([], rows);
      newRows[i] = curitem;
      this.setState({ rows: newRows });
    }
    await axios.post('/api/col/up_col', {
      col_id: this.props.currColId,
      test_report: JSON.stringify(this.reports)
    });
  };

  handleTest = async interfaceData => {
    let requestParams = {};
    let options = handleParams(interfaceData, this.handleValue, requestParams);

    let result = {
      code: 400,
      msg: '????????????',
      validRes: []
    };

    try {
      let data = await crossRequest(options, interfaceData.pre_script, interfaceData.after_script,interfaceData.case_pre_script,interfaceData.case_post_script, createContext(
        this.props.curUid,
        this.props.match.params.id,
        interfaceData.interface_id
      ));
      options.taskId = this.props.curUid;
      let res = (data.res.body = json_parse(data.res.body));
      result = {
        ...options,
        ...result,
        res_header: data.res.header,
        res_body: res,
        status: data.res.status,
        statusText: data.res.statusText
      };

      if (options.data && typeof options.data === 'object') {
        requestParams = {
          ...requestParams,
          ...options.data
        };
      }

      let validRes = [];

      let responseData = Object.assign(
        {},
        {
          status: data.res.status,
          body: res,
          header: data.res.header,
          statusText: data.res.statusText
        }
      );

      // ????????????
      await this.handleScriptTest(interfaceData, responseData, validRes, requestParams);

      if (validRes.length === 0) {
        result.code = 0;
        result.validRes = [
          {
            message: '????????????'
          }
        ];
      } else if (validRes.length > 0) {
        result.code = 1;
        result.validRes = validRes;
      }
    } catch (data) {
      result = {
        ...options,
        ...result,
        res_header: data.header,
        res_body: data.body || data.message,
        status: 0,
        statusText: data.message,
        code: 400,
        validRes: [
          {
            message: data.message
          }
        ]
      };
    }

    result.params = requestParams;
    return result;
  };

  //response, validRes
  // ????????????
  handleScriptTest = async (interfaceData, response, validRes, requestParams) => {
    // ??????????????????
    try {
      const {
        preScript = '', afterScript = '',case_pre_script = '',case_post_script = ''
      } = interfaceData;
      const allScriptStr = preScript + afterScript + case_pre_script + case_post_script;
      const storageKeys = findStorageKeysFromScript(allScriptStr);
      const storageDict = {};
      storageKeys.forEach(key => {
        storageDict[key] = localStorage.getItem(key);
      });

      let test = await axios.post('/api/col/run_script', {
        response: response,
        records: this.records,
        script: interfaceData.test_script,
        params: requestParams,
        col_id: this.props.currColId,
        interface_id: interfaceData.interface_id,
        storageDict,
        taskId: this.props.curUid
      });
      if (test.data.errcode !== 0) {
        test.data.data.logs.forEach(item => {
          validRes.push({ message: item });
        });
      }
    } catch (err) {
      validRes.push({
        message: 'Error: ' + err.message
      });
    }
  };

  handleValue = (val, global) => {
    let globalValue = ArrayToObject(global);
    let context = Object.assign({}, { global: globalValue }, this.records);
    return handleParamsValue(val, context);
  };

  arrToObj = (arr, requestParams) => {
    arr = arr || [];
    const obj = {};
    arr.forEach(item => {
      if (item.name && item.enable && item.type !== 'file') {
        obj[item.name] = this.handleValue(item.value);
        if (requestParams) {
          requestParams[item.name] = obj[item.name];
        }
      }
    });
    return obj;
  };


  onRow(row) {
    return { rowId: row.id, onMove: this.onMoveRow, onDrop: this.onDrop };
  }

  onDrop = () => {
    let changes = [];
    this.state.rows.forEach((item, index) => {
      changes.push({ id: item._id, index: index });
    });
    axios.post('/api/col/up_case_index', changes).then(() => {
      this.props.fetchInterfaceColList(this.props.match.params.id);
    });
  };
  onMoveRow({ sourceRowId, targetRowId }) {
    let rows = dnd.moveRows({ sourceRowId, targetRowId })(this.state.rows);

    if (rows) {
      this.setState({ rows });
    }
  }

  onChangeTest = d => {

    this.setState({
      commonSetting: {
        ...this.state.commonSetting,
        checkScript: {
          ...this.state.commonSetting.checkScript,
          content: d.text
        }
      }
    });
  };

  handleInsertCode = code => {
    this.aceEditor.editor.insertCode(code);
  };

  async componentWillReceiveProps(nextProps) {
    let newColId = !isNaN(nextProps.match.params.actionId) ? +nextProps.match.params.actionId : 0;

    if ((newColId && this.currColId && newColId !== this.currColId) || nextProps.isRander) {
      this.currColId = newColId;
        this.setState(
          {
            descendants:false
          }
        );
      this.handleColIdChange(newColId)
    }
  }

  // ??????????????????????????????
  changeCollapseClose = key => {
    if (key) {
      this.setState({
        collapseKey: key
      });
    } else {
      this.setState({
        collapseKey: '1',
        currColEnvObj: {}
      });
    }
  };

  openReport = id => {
    if (!this.reports[id]) {
      return message.warn('?????????????????????');
    }
    this.setState({ visible: true, curCaseid: id });
  };

  // openAdv = id => {
  //   let findCase = _.find(this.props.currCaseList, item => item.id === id);
  //
  //   this.setState({
  //     enableScript: findCase.enable_script,
  //     curScript: findCase.test_script,
  //     advVisible: true,
  //     curCaseid: id
  //   });
  // };

  handleScriptChange = d => {
    this.setState({ curScript: d.text });
  };

  handleAdvCancel = () => {
    this.setState({ advVisible: false });
  };

  handleAdvOk = async () => {
    const { curCaseid, enableScript, curScript } = this.state;
    const res = await axios.post('/api/col/up_case', {
      id: curCaseid,
      test_script: curScript,
      enable_script: enableScript
    });
    if (res.data.errcode === 0) {
      message.success('????????????');
    }
    this.setState({ advVisible: false });
    let currColId = this.currColId;
    this.props.setColData({
      currColId: +currColId,
      isShowCol: true,
      isRander: false
    });
    await this.props.fetchCaseList(currColId);

    this.handleColdata(this.props.currCaseList);
  };

  handleCancel = () => {
    this.setState({ visible: false });
  };

  currProjectEnvChange = (envName, project_id) => {
    let currColEnvObj = {
      ...this.state.currColEnvObj,
      [project_id]: envName
    };
    this.setState({ currColEnvObj });
   // this.handleColdata(this.props.currCaseList, envName, project_id);
   this.handleColdata(this.props.currCaseList,currColEnvObj);
  };

  autoTests = () => {
    this.setState({ autoVisible: true, currColEnvObj: {}, collapseKey: '' });
  };

  handleAuto = () => {
    this.setState({
      autoVisible: false,
      email: false,
      download: false,
      descendants:false,
      mode: 'html',
      currColEnvObj: {},
      collapseKey: ''
    });
  };

  copyUrl = url => {
    copy(url);
    message.success('??????????????????????????????');
  };

  modeChange = mode => {
    this.setState({ mode });
  };

  emailChange = email => {
    this.setState({ email });
  };

  downloadChange = download => {
    this.setState({ download });
  };


  handleColEnvObj = envObj => {
    let str = '';
    for (let key in envObj) {
      str += envObj[key] ? `&env_${key}=${envObj[key]}` : '';
    }
    return str;
  };

  handleCommonSetting = ()=>{
    let setting = this.state.commonSetting;

    let params = {
      col_id: this.props.currColId,
      ...setting

    };
  //  console.log(params)

    axios.post('/api/col/up_col', params).then(async res => {
      if (res.data.errcode) {
        return message.error(res.data.errmsg);
      }
      message.success('?????????????????????');
    });

    this.setState({
      commonSettingModalVisible: false
    })
  }

  cancelCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: false
    })
  }

  openCommonSetting = ()=>{
    this.setState({
      commonSettingModalVisible: true
    })
  }

  changeCommonFieldSetting = (key)=>{
    return (e)=>{
      let value = e;
      if(typeof e === 'object' && e){
        value = e.target.value;
      }
      let {checkResponseField} = this.state.commonSetting;
      this.setState({
        commonSetting: {
          ...this.state.commonSetting,
          checkResponseField: {
            ...checkResponseField,
            [key]: value
          }
        }
      })
    }
  }

  onChangeCheckbox = async e => {
    await this.flushdescendants(e.target.checked,  e.target.allChilds)
  };

  //descendants
  descendants = async (descendants,e) => {
    console.log({descendants,'e.target.dataset':e.target.dataset})
    await this.flushdescendants(descendants, e.target.dataset.allchilds+'');
  };

  flushdescendants = async (descendants,allChilds) => {
    let childscol = this.props.currColId;
    this.setState({
      descendants
    });
    //   console.log({"state":this.state,e,"props":this.props});
    if (descendants) {
      childscol = allChilds;
    }
    await this.props.fetchCaseList(childscol);
    await this.props.fetchCaseEnvList(childscol);
    this.changeCollapseClose();
    this.handleColdata(this.props.currCaseList);
  };

  getSummaryText = () => {
    const { rows } = this.state;
    let totalCount = rows.length || 0;
    let passCount = 0; // ????????????
    let errorCount = 0; // ????????????
    let failCount = 0; // ????????????
    let loadingCount = 0; // ?????????
    rows.forEach(rowData => {
      let id = rowData._id;
      let code = this.reports[id] ? this.reports[id].code : 0;
      if (rowData.test_status === 'loading') {
        loadingCount += 1;
        return;
      }
      switch (code) {
        case 0:
          passCount += 1;
          break;
        case 400:
          errorCount += 1;
          break;
        case 1:
          failCount += 1;
          break;
        default:
          passCount += 1;
          break;
    }});
    return `????????? (${totalCount}) ???,?????????["Pass: ${passCount} ??? ", "Loading: ${loadingCount} ??? ", "????????????: ${errorCount} ???", "????????????: ${failCount} ???"]`
  };


  render() {
    const currProjectId = this.props.currProject._id;
    const columns = [
      {
        property: 'casename',
        header: {
          label: '????????????'
        },
        props: {
          style: {
            width: '250px'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
           // console.log({rowData});
              let record = rowData;
              return (
                <Link to={'/project/' + currProjectId + '/interface/case/' + record._id}>
                  {record.casename.length > 23
                    ? record.casename.substr(0, 20) + '...'
                    : record.casename}
                </Link>
              );
            }
          ]
        }
      },
      {
        header: {
          label: 'key',
          formatters: [
            () => {
              return (
                <Tooltip
                  title={
                    <span>
                      {' '}
                      ???????????????????????????key????????????????????????????????????????????????????????????{' '}
                      <a
                        href="doc/documents/case.html#%E7%AC%AC%E4%BA%8C%E6%AD%A5%EF%BC%8C%E7%BC%96%E8%BE%91%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B"
                        className="link-tooltip"
                        target="blank"
                      >
                        {' '}
                        ????????????{' '}
                      </a>{' '}
                      ??????{' '}
                    </span>
                  }
                >
                  Key
                </Tooltip>
              );
            }
          ]
        },
        props: {
          style: {
            width: '100px'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              return <span>{rowData._id}</span>;
            }
          ]
        }
      },
      {
        property: 'test_status',
        header: {
          label: '??????'
        },
        props: {
          style: {
            width: '100px'
          }
        },
        cell: {
          formatters: [
            (value, { rowData }) => {
              let id = rowData._id;
              let code = this.reports[id] ? this.reports[id].code : 0;
              if (rowData.test_status === 'loading') {
                return (
                  <div>
                    <Spin />
                  </div>
                );
              }

              switch (code) {
                case 0:
                  return (
                    <div>
                      <Tooltip title="Pass">
                        <Icon
                          style={{
                            color: '#00a854'
                          }}
                          type="check-circle"
                        />
                      </Tooltip>
                    </div>
                  );
                case 400:
                  return (
                    <div>
                      <Tooltip title="????????????">
                        <Icon
                          type="info-circle"
                          style={{
                            color: '#f04134'
                          }}
                        />
                      </Tooltip>
                    </div>
                  );
                case 1:
                  return (
                    <div>
                      <Tooltip title="????????????">
                        <Icon
                          type="exclamation-circle"
                          style={{
                            color: '#ffbf00'
                          }}
                        />
                      </Tooltip>
                    </div>
                  );
                default:
                  return (
                    <div>
                      <Icon
                        style={{
                          color: '#00a854'
                        }}
                        type="check-circle"
                      />
                    </div>
                  );
              }
            }
          ]
        }
      },
      {
        property: 'path',
        header: {
          label: '????????????'
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let record = rowData;
              return (
                <Tooltip title="?????????????????????">
                  <Link to={`/project/${record.project_id}/interface/api/${record.interface_id}`}>
                    {record.path.length > 23 ? record.path + '...' : record.path}
                  </Link>
                </Tooltip>
              );
            }
          ]
        }
      },
      {
        header: {
          label: '????????????'
        },
        props: {
          style: {
            width: '200px'
          }
        },
        cell: {
          formatters: [
            (text, { rowData }) => {
              let reportFun = () => {
                if (!this.reports[rowData.id]) {
                  return null;
                }
                return <Button onClick={() => this.openReport(rowData.id)}>????????????</Button>;
              };
              return <div className="interface-col-table-action">{reportFun()}</div>;
            }
          ]
        }
      }
    ];
    const { rows } = this.state;
    const components = {
      header: {
        cell: dnd.Header
      },
      body: {
        row: dnd.Row
      }
    };
    const resolvedColumns = resolve.columnChildren({ columns });
    const resolvedRows = resolve.resolve({ columns: resolvedColumns, method: resolve.nested })(
      rows
    );

    const localUrl =
      location.protocol +
      '//' +
      location.hostname +
      (location.port !== '' ? ':' + location.port : '');
    let currColEnvObj = this.handleColEnvObj(this.state.currColEnvObj);
    const autoTestsUrl = `/api/open/run_auto_test?id=${this.props.currColId}&token=${
      this.props.token
    }${currColEnvObj ? currColEnvObj : ''}&mode=${this.state.mode}&email=${
      this.state.email
    }&download=${this.state.download}&descendants=${this.state.descendants}`;

    let col_name = '';
    let col_desc = '';
      let allChilds=[];

    if (this.props.interfaceColList) {
      let me = findMeInTree(this.props.interfaceColList, this.props.currColId);
      col_name = me?me.name:'';
      col_desc = me?me.desc:'';
      allChilds = me ? me.childs : '';
    }

    return (
      <div className="interface-col">
        <Modal
            title="??????????????????"
            visible={this.state.commonSettingModalVisible}
            onOk={this.handleCommonSetting}
            onCancel={this.cancelCommonSetting}
            width={'1000px'}
            style={defaultModalStyle}
          >
          <div className="common-setting-modal">
            <Row className="setting-item">
              <Col className="col-item" span={4}>
                <label>??????HttpCode:&nbsp;<Tooltip title={'?????? http code ????????? 200'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span={18}>
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkHttpCodeIs200: e
                    }
                  })
                }} checked={this.state.commonSetting.checkHttpCodeIs200}  checkedChildren="???" unCheckedChildren="???" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item"  span={4}>
                <label>????????????json:&nbsp;<Tooltip title={'???????????????????????????????????????????????? code ??????????????? 0'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col  className="col-item" span={6}>
                <Input value={this.state.commonSetting.checkResponseField.name} onChange={this.changeCommonFieldSetting('name')} placeholder="?????????"  />
              </Col>
              <Col  className="col-item" span={6}>
                <Input  onChange={this.changeCommonFieldSetting('value')}  value={this.state.commonSetting.checkResponseField.value}   placeholder="???"  />
              </Col>
              <Col  className="col-item" span={6}>
                <Switch  onChange={this.changeCommonFieldSetting('enable')}  checked={this.state.commonSetting.checkResponseField.enable}  checkedChildren="???" unCheckedChildren="???"  />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item" span={4}>
                <label>????????????????????????:&nbsp;<Tooltip title={'?????? response ?????? json-schema ????????????????????????????????????'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span={18}>
                <Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkResponseSchema: e
                    }
                  })
                }} checked={this.state.commonSetting.checkResponseSchema}  checkedChildren="???" unCheckedChildren="???" />
              </Col>
            </Row>

            <Row className="setting-item">
              <Col className="col-item  " span={4}>
                <label>??????????????????:&nbsp;<Tooltip title={'??????????????????????????????????????????????????????????????????????????????????????????????????????case????????????????????????'}>
                  <Icon type="question-circle-o" style={{ width: '10px' }} />
                </Tooltip></label>
              </Col>
              <Col className="col-item"  span={14}>
                <div><Switch onChange={e=>{
                  let {commonSetting} = this.state;
                  this.setState({
                    commonSetting :{
                      ...commonSetting,
                      checkScript: {
                        ...this.state.checkScript,
                        enable: e
                      }
                    }
                  })
                }} checked={this.state.commonSetting.checkScript.enable}  checkedChildren="???" unCheckedChildren="???"  /></div>
                <AceEditor
                  onChange={this.onChangeTest}
                  className="case-script"
                  data={this.state.commonSetting.checkScript.content}
                  ref={aceEditor => {
                    this.aceEditor = aceEditor;
                  }}
                />
              </Col>
              <Col span={6}>
                <div className="insert-code">
                  {InsertCodeMap.map(item => {
                    return (
                      <div
                        style={{ cursor: 'pointer' }}
                        className="code-item"
                        key={item.title}
                        onClick={() => {
                          this.handleInsertCode('\n' + item.code);
                        }}
                      >
                        {item.title}
                      </div>
                    );
                  })}
                </div>
              </Col>
            </Row>


          </div>
        </Modal>
        <Row type="flex" justify="center" align="top">
          <Col span={5}>
            <h2
              className="interface-title"
              style={{
                display: 'inline-block',
                margin: '8px 20px 16px 0px'
              }}
            >
              ????????????&nbsp;<a
                target="_blank"
                rel="noopener noreferrer"
                href="/doc/documents/case.html"
              >
                <Tooltip title="??????????????????">
                  <Icon type="question-circle-o" />
                </Tooltip>
              </a>
            </h2>
            <div>
              {(
                <Checkbox
                  allChilds={allChilds}
                  checked={this.state.descendants}
                  onChange={this.onChangeCheckbox}
                >?????????????????????</Checkbox>)}
            </div>
          </Col>
          <Col span={10}>
            <CaseEnv
              envList={this.props.envList}
              currProjectEnvChange={this.currProjectEnvChange}
              envValue={this.state.currColEnvObj}
              collapseKey={this.state.collapseKey}
              changeClose={this.changeCollapseClose}
            />
          </Col>
          <Col span={9}>
            {(
              <div
                style={{
                  float: 'right',
                  paddingTop: '8px'
                }}
              >
                {this.props.curProjectRole !== 'guest' && (
                  <Tooltip title="??? YApi ??????????????????????????????????????????????????????????????????????????? YApi ?????????????????????????????????????????????domain">
                    <Button
                      style={{
                        marginRight: '8px'
                      }}
                      onClick={this.autoTests}
                    >
                      ???????????????
                    </Button>
                  </Tooltip>
                )}
                <Button onClick={this.openCommonSetting} style={{
                        marginRight: '8px'
                      }} >??????????????????</Button>
                &nbsp;
                <Button type="primary" onClick={this.executeTests}>
                  ????????????
                </Button>
              </div>
            )}
          </Col>
        </Row>

        <div className="component-label-wrapper">
          <Label onChange={val => this.handleChangeInterfaceCol(val, col_name)} desc={col_desc} />
        </div>
        <Spin spinning={this.state.isLoading}>
          <h3 className="interface-title">
            {this.getSummaryText()}
          </h3>
          <Table.Provider
            components={components}
            columns={resolvedColumns}
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
            <Table.Header
              className="interface-col-table-header"
              headerRows={resolve.headerRows({ columns })}
            />

            <Table.Body
              className="interface-col-table-body"
              rows={resolvedRows}
              rowKey="id"
              onRow={this.onRow}
            />
          </Table.Provider>
        </Spin>
        <Modal
          title="????????????"
          width="900px"
          style={{
            minHeight: '500px'
          }}
          visible={this.state.visible}
          onCancel={this.handleCancel}
          footer={null}
        >
          <CaseReport {...this.reports[this.state.curCaseid]} />
        </Modal>

        {this.state.autoVisible && (
          <Modal
            title="????????????????????????"
            width="780px"
            style={{
              minHeight: '500px'
            }}
            visible={this.state.autoVisible}
            onCancel={this.handleAuto}
            className="autoTestsModal"
            footer={null}
          >
            <Row type="flex" justify="space-around" className="row" align="top">
              <Col span={3} className="label" style={{ paddingTop: '16px' }}>
                ????????????
                <Tooltip title="???????????????????????????????????????">
                  <Icon type="question-circle-o" />
                </Tooltip>
                &nbsp;???
              </Col>
              <Col span={21}>
                <CaseEnv
                  envList={this.props.envList}
                  currProjectEnvChange={this.currProjectEnvChange}
                  envValue={this.state.currColEnvObj}
                  collapseKey={this.state.collapseKey}
                  changeClose={this.changeCollapseClose}
                />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={3} >
                ???????????????
              </Col>
              <Col span={3}>
                <Select value={this.state.mode} onChange={this.modeChange}>
                  <Option key="html" value="html">
                    html
                  </Option>
                  <Option key="json" value="json">
                    json
                  </Option>
                </Select>
              </Col>

              <Col span={3} >
                ????????????
                <Tooltip title={'??????????????????????????????????????????????????????'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;???
              </Col>
              <Col span={3}>
                <Switch
                  checked={this.state.email}
                  checkedChildren="???"
                  unCheckedChildren="???"
                  onChange={this.emailChange}
                />
              </Col>

              <Col span={3} >
                ????????????
                <Tooltip title={'?????????????????????????????????????????????'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;???
              </Col>
              <Col span={3}>
                <Switch
                  checked={this.state.download}
                  checkedChildren="???"
                  unCheckedChildren="???"
                  onChange={this.downloadChange}
                />
              </Col>
              <Col span={3} >
                ????????????
                <Tooltip title={'????????????????????????????????????????????????'}>
                  <Icon
                    type="question-circle-o"
                    style={{
                      width: '10px'
                    }}
                  />
                </Tooltip>
                &nbsp;???
              </Col>
              <Col span={3}>
                <Switch
                  checked={this.state.descendants}
                  data-allChilds={allChilds}
                  checkedChildren="???"
                  unCheckedChildren="???"
                  onChange={this.descendants}
                />
              </Col>
            </Row>
            <Row type="flex" justify="space-around" className="row" align="middle">
              <Col span={21} className="autoTestUrl">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={localUrl + autoTestsUrl} >
                  {autoTestsUrl}
                </a>
              </Col>
              <Col span={3}>
                <Button className="copy-btn" onClick={() => this.copyUrl(localUrl + autoTestsUrl)}>
                  ??????
                </Button>
              </Col>
            </Row>
            <div className="autoTestMsg">
              ???????????????URL???????????????????????????????????????YApi??????????????????????????????????????? domain
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default InterfaceColContent;
