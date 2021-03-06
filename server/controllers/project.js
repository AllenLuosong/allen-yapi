const projectModel = require('../models/project.js');
const yapi = require('../yapi.js');
const _ = require('underscore');
const baseController = require('./base.js');
const interfaceModel = require('../models/interface.js');
const interfaceColModel = require('../models/interfaceCol.js');
const interfaceCaseModel = require('../models/interfaceCase.js');
const interfaceCatModel = require('../models/interfaceCat.js');
const groupModel = require('../models/group');
const commons = require('../utils/commons.js');
const userModel = require('../models/user.js');
const logModel = require('../models/log.js');
const followModel = require('../models/follow.js');
const tokenModel = require('../models/token.js');
const url = require('url');
const {getToken} = require('../utils/token')
const sha = require('sha.js');

class projectController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.Model = yapi.getInst(projectModel);
    this.groupModel = yapi.getInst(groupModel);
    this.logModel = yapi.getInst(logModel);
    this.followModel = yapi.getInst(followModel);
    this.tokenModel = yapi.getInst(tokenModel);
    this.interfaceModel = yapi.getInst(interfaceModel);

    const id = 'number';
    const member_uid = ['number'];
    const name = {
      type: 'string',
      minLength: 1
    };
    const role = {
      type: 'string',
      enum: ['owner', 'dev', 'guest']
    };
    const basepath = {
      type: 'string',
      default: ''
    };
    const group_id = 'number';
    const group_name = 'string';
    const project_type = {
      type: 'string',
      enum: ['private', 'public'],
      default: 'private'
    };
    const desc = 'string';
    const icon = 'string';
    const color = 'string';
    const env = 'array';

    const cat = 'array';
    this.schemaMap = {
      add: {
        '*name': name,
        basepath: basepath,
        '*group_id': group_id,
        group_name,
        desc: desc,
        color,
        icon,
        project_type
      },
      copy: {
        '*name': name,
        preName: name,
        basepath: basepath,
        '*group_id': group_id,
        _id: id,
        cat,
        pre_script: desc,
        after_script: desc,
        env,
        group_name,
        desc,
        color,
        icon,
        project_type
      },
      addMember: {
        '*id': id,
        '*member_uids': member_uid,
        role: role
      },
      delMember: {
        '*id': id,
        '*member_uid': id
      },
      getMemberList: {
        '*id': id
      },
      get: {
        'id': id,
        'project_id': id
      },
      list: {
        '*group_id': group_id
      },
      del: {
        '*id': id
      },
      changeMemberRole: {
        '*id': id,
        '*member_uid': id,
        role
      },
      token: {
        '*project_id': id
      },
      updateToken: {
        '*project_id': id
      }
    };
  }

  handleBasepath(basepath) {
    if (!basepath) {
      return '';
    }
    if (basepath === '/') {
      return '';
    }
    if (basepath[0] !== '/') {
      basepath = '/' + basepath;
    }
    if (basepath[basepath.length - 1] === '/') {
      basepath = basepath.substr(0, basepath.length - 1);
    }
    if (!/^\/[a-zA-Z0-9\-\/\._]+$/.test(basepath)) {
      return false;
    }
    return basepath;
  }

  verifyDomain(domain) {
    if (!domain) {
      return false;
    }
    if (/^[a-zA-Z0-9\-_\.]+?\.[a-zA-Z0-9\-_\.]*?[a-zA-Z]{2,6}$/.test(domain)) {
      return true;
    }
    return false;
  }

  /**
   * ??????????????????????????????
   * @interface /project/check_project_name
   * @method get
   */

  async checkProjectName(ctx) {
    try {
      let name = ctx.request.query.name;
      let group_id = ctx.request.query.group_id;

      if (!name) {
        return (ctx.body = yapi.commons.resReturn(null, 401, '?????????????????????'));
      }
      let checkRepeat = await this.Model.checkNameRepeat(name, group_id);

      if (checkRepeat > 0) {
        return (ctx.body = yapi.commons.resReturn(null, 401, '?????????????????????'));
      }

      ctx.body = yapi.commons.resReturn({});
    } catch (err) {
      ctx.body = yapi.commons.resReturn(null, 402, err.message);
    }
  }

  /**
   * ??????????????????
   * @interface /project/add
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {String} name ???????????????????????????
   * @param {String} basepath ?????????????????????????????????
   * @param {Number} group_id ????????????id???????????????
   * @param {Number} group_name ?????????????????????????????????
   * @param {String} project_type private public
   * @param  {String} [desc] ????????????
   * @returns {Object}
   * @example ./api/project/add.json
   */
  async add(ctx) {
    let params = ctx.params;

    if ((await this.checkAuth(params.group_id, 'group', 'edit')) !== true) {
      return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
    }

    let checkRepeat = await this.Model.checkNameRepeat(params.name, params.group_id);

    if (checkRepeat > 0) {
      return (ctx.body = yapi.commons.resReturn(null, 401, '?????????????????????'));
    }

    params.basepath = params.basepath || '';

    if ((params.basepath = this.handleBasepath(params.basepath)) === false) {
      return (ctx.body = yapi.commons.resReturn(null, 401, 'basepath????????????'));
    }

    let data = {
      name: params.name,
      desc: params.desc,
      basepath: params.basepath,
      members: [],
      project_type: params.project_type || 'private',
      uid: this.getUid(),
      group_id: params.group_id,
      group_name: params.group_name,
      icon: params.icon,
      color: params.color,
      add_time: yapi.commons.time(),
      up_time: yapi.commons.time(),
      is_json5: false,
      env: [{ name: 'local', domain: 'http://127.0.0.1' }]
    };

    let result = await this.Model.save(data);
    let colInst = yapi.getInst(interfaceColModel);
    let catInst = yapi.getInst(interfaceCatModel);
    if (result._id) {
      await colInst.save({
        name: '???????????????',
        project_id: result._id,
        parent_id: -1,
        desc: '???????????????',
        uid: this.getUid(),
        add_time: yapi.commons.time(),
        up_time: yapi.commons.time()
      });
      await catInst.save({
        name: '????????????',
        project_id: result._id,
        parent_id: -1,
        desc: '????????????',
        uid: this.getUid(),
        add_time: yapi.commons.time(),
        up_time: yapi.commons.time()
      });
    }
    let uid = this.getUid();
    // ????????????????????????????????????,???admin??????
    if (this.getRole() !== 'admin') {
      let userdata = await yapi.commons.getUserdata(uid, 'owner');
      await this.Model.addMember(result._id, [userdata]);
    }
    let username = this.getUsername();
    yapi.commons.saveLog({
      content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????? <a href="/project/${
        result._id
      }">${params.name}</a>`,
      type: 'project',
      uid,
      username: username,
      typeid: result._id
    });
    yapi.emitHook('project_add', result).then();
    ctx.body = yapi.commons.resReturn(result);
  }

  /**
   * ??????????????????
   * @interface /project/copy
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {String} name ???????????????????????????
   * @param {String} basepath ?????????????????????????????????
   * @param {Number} group_id ????????????id???????????????
   * @param {Number} group_name ?????????????????????????????????
   * @param {String} project_type private public
   * @param  {String} [desc] ????????????
   * @returns {Object}
   * @example ./api/project/add.json
   */
  async copy(ctx) {
    try {
      let params = ctx.params;

      // ???????????????ID
      let copyId = params._id;
      if ((await this.checkAuth(params.group_id, 'group', 'edit')) !== true) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
      }

      params.basepath = params.basepath || '';

      let data = Object.assign(params, {
        project_type: params.project_type || 'private',
        uid: this.getUid(),
        add_time: yapi.commons.time(),
        up_time: yapi.commons.time(),
        env: params.env || [{ name: 'local', domain: 'http://127.0.0.1' }]
      });

      delete data._id;
      let result = await this.Model.save(data);
      let colInst = yapi.getInst(interfaceColModel);
      let catInst = yapi.getInst(interfaceCatModel);

      // ????????????
      if (result._id) {
        await colInst.save({
          name: '???????????????',
          project_id: result._id,
          desc: '???????????????',
          uid: this.getUid(),
          add_time: yapi.commons.time(),
          up_time: yapi.commons.time()
        });

        // ??????????????????
        let cat = params.cat;
        let oldcatVSnewCats=[];
        let oldidVSnewid={};
        let catlist=[];
        let treetolist=(cats,catlist)=>{
          cats.forEach(cat=>{
            catlist.push(cat);
          if(cat.children&&cat.children.length>0){
            treetolist(cat.children,catlist);
          }
          })
        }

        treetolist(cat,catlist);

        for (let i = 0; i < catlist.length; i++) {
          let item = catlist[i];
          let catDate = {
            name: item.name,
            project_id: result._id,
            parent_id:-1,
            desc: item.desc,
            uid: this.getUid(),
            add_time: yapi.commons.time(),
            up_time: yapi.commons.time()
          };
          let catResult = await catInst.save(catDate);
          oldcatVSnewCats.push({item,catResult});
          oldidVSnewid[item._id]=catResult._id;
          // ????????????????????????interface
          let interfaceData = await this.interfaceModel.listByInterStatus(item._id);

          // ???interfaceData????????????catID???
          for (let key = 0; key < interfaceData.length; key++) {
            let interfaceItem = interfaceData[key].toObject();
            let data = Object.assign(interfaceItem, {
              uid: this.getUid(),
              catid: catResult._id,
              project_id: result._id,
              add_time: yapi.commons.time(),
              up_time: yapi.commons.time()
            });
            delete data._id;
            await this.interfaceModel.save(data);
          }
        }

        for (let i = 0; i < oldcatVSnewCats.length; i++) {
          let catwe=oldcatVSnewCats[i];
          let id=catwe.catResult._id;
          let parent_id=oldidVSnewid[catwe.item.parent_id];
          await catInst.up(id,{parent_id});
        }


      }

      // ??????member
      let copyProject = await this.Model.get(copyId);
      let copyProjectMembers = copyProject.members;

      let uid = this.getUid();
      // ????????????????????????????????????,???admin??????
      if (this.getRole() !== 'admin') {
        let userdata = await yapi.commons.getUserdata(uid, 'owner');
        let check = await this.Model.checkMemberRepeat(copyId, uid);
        if (check === 0) {
          copyProjectMembers.push(userdata);
        }
      }
      await this.Model.addMember(result._id, copyProjectMembers);

      // ??????????????????????????????interface

      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????? ${
          params.preName
        } ??? <a href="/project/${result._id}">${params.name}</a>`,
        type: 'project',
        uid,
        username: username,
        typeid: result._id
      });
      ctx.body = yapi.commons.resReturn(result);
    } catch (err) {
      ctx.body = yapi.commons.resReturn(null, 402, err.message);
    }
  }

  /**
   * ??????????????????
   * @interface /project/add_member
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {Array} member_uid ????????????uid,????????????
   * @returns {Object}
   * @example ./api/project/add_member.json
   */
  async addMember(ctx) {
    let params = ctx.params;
    if ((await this.checkAuth(params.id, 'project', 'edit')) !== true) {
      return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
    }

    params.role = ['owner', 'dev', 'guest'].find(v => v === params.role) || 'dev';
    let add_members = [];
    let exist_members = [];
    let no_members = [];
    for (let i = 0, len = params.member_uids.length; i < len; i++) {
      let id = params.member_uids[i];
      let check = await this.Model.checkMemberRepeat(params.id, id);
      let userdata = await yapi.commons.getUserdata(id, params.role);
      if (check > 0) {
        exist_members.push(userdata);
      } else if (!userdata) {
        no_members.push(id);
      } else {
        add_members.push(userdata);
      }
    }

    let result = await this.Model.addMember(params.id, add_members);
    if (add_members.length) {
      let members = add_members.map(item => {
        return `<a href = "/user/profile/${item.uid}">${item.username}</a>`;
      });
      members = members.join('???');
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> ????????????????????? ${members}`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: params.id
      });
    }
    ctx.body = yapi.commons.resReturn({
      result,
      add_members,
      exist_members,
      no_members
    });
  }
  /**
   * ??????????????????
   * @interface /project/del_member
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {member_uid} uid ????????????uid,????????????
   * @returns {Object}
   * @example ./api/project/del_member.json
   */

  async delMember(ctx) {
    try {
      let params = ctx.params;

      var check = await this.Model.checkMemberRepeat(params.id, params.member_uid);
      if (check === 0) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '?????????????????????'));
      }

      if ((await this.checkAuth(params.id, 'project', 'danger')) !== true) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
      }

      let result = await this.Model.delMember(params.id, params.member_uid);
      let username = this.getUsername();
      yapi
        .getInst(userModel)
        .findById(params.member_uid)
        .then(member => {
          yapi.commons.saveLog({
            content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????????????????? <a href="/user/profile/${
              params.member_uid
            }">${member ? member.username : ''}</a>`,
            type: 'project',
            uid: this.getUid(),
            username: username,
            typeid: params.id
          });
        });
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * ????????????????????????
   * @interface /project/get_member_list
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @return {Object}
   * @example ./api/project/get_member_list.json
   */

  async getMemberList(ctx) {
    let params = ctx.params;
    if (!params.id) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '??????id????????????'));
    }
    let project = await this.Model.get(params.id);
    ctx.body = yapi.commons.resReturn(project.members);
  }

  /**
   * ??????????????????
   * @interface /project/get
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @returns {Object}
   * @example ./api/project/get.json
   */

  async get(ctx) {

    let params = ctx.params;
    let projectId= params.id || params.project_id; // ?????? token ??????
    let result = await this.Model.getBaseInfo(projectId);

    if (!result) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '??????????????????'));
    }
    if (result.project_type === 'private') {
      if ((await this.checkAuth(result._id, 'project', 'view')) !== true) {
        return (ctx.body = yapi.commons.resReturn(null, 406, '????????????'));
      }
    }
    result = result.toObject();
    let catInst = yapi.getInst(interfaceCatModel);
    let cat = await catInst.list(params.id);
    let catit=JSON.parse(JSON.stringify(cat));

    result.cat = yapi.commons.translateDataToTree(catit);
    //console.log(result.cat);
    if (result.env.length === 0) {
      result.env.push({ name: 'local', domain: 'http://127.0.0.1' });
    }
    result.role = await this.getProjectRole(projectId, 'project');

    yapi.emitHook('project_get', result).then();
    ctx.body = yapi.commons.resReturn(result);
  }

  /**
   * ??????????????????
   * @interface /project/list
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {Number} group_id ??????group_id???????????????
   * @returns {Object}
   * @example ./api/project/list.json
   */

  async list(ctx) {
    let group_id = ctx.params.group_id,
      project_list = [];

    let groupData = await this.groupModel.get(group_id);
    let isPrivateGroup = false;
    if (groupData.type === 'private' && this.getUid() === groupData.uid) {
      isPrivateGroup = true;
    }
    let auth = await this.checkAuth(group_id, 'group', 'view');
    let result = await this.Model.list(group_id);
    let follow = await this.followModel.list(this.getUid());
    if (isPrivateGroup === false) {
      for (let index = 0, item, r = 1; index < result.length; index++) {
        item = result[index].toObject();
        if (item.project_type === 'private' && auth === false) {
          r = await this.Model.checkMemberRepeat(item._id, this.getUid());
          if (r === 0) {
            continue;
          }
        }

        let f = _.find(follow, fol => {
          return fol.projectid === item._id;
        });
        // ?????????????????????????????????
        if (f) {
          item.follow = true;
          project_list.unshift(item);
        } else {
          item.follow = false;
          project_list.push(item);
        }
      }
    } else {
      follow = follow.map(item => {
        item = item.toObject();
        item.follow = true;
        return item;
      });
      project_list = _.uniq(follow.concat(result), item => item._id);
    }

    ctx.body = yapi.commons.resReturn({
      list: project_list
    });
  }

  /**
   * ????????????
   * @interface /project/del
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @returns {Object}
   * @example ./api/project/del.json
   */

  async del(ctx) {
    let id = ctx.params.id;

    if ((await this.checkAuth(id, 'project', 'danger')) !== true) {
      return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
    }

    let interfaceInst = yapi.getInst(interfaceModel);
    let interfaceColInst = yapi.getInst(interfaceColModel);
    let interfaceCaseInst = yapi.getInst(interfaceCaseModel);
    await interfaceInst.delByProjectId(id);
    await interfaceCaseInst.delByProjectId(id);
    await interfaceColInst.delByProjectId(id);
    yapi.emitHook('project_del', id).then();
    let result = await this.Model.del(id);
    ctx.body = yapi.commons.resReturn(result);
  }

  /**
   * ????????????????????????
   * @interface /project/change_member_role
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {String} id ??????id
   * @param {String} member_uid ????????????uid
   * @param {String} role ?????? ['owner'|'dev']
   * @returns {Object}
   * @example
   */
  async changeMemberRole(ctx) {
    let params = ctx.request.body;
    let projectInst = yapi.getInst(projectModel);

    var check = await projectInst.checkMemberRepeat(params.id, params.member_uid);
    if (check === 0) {
      return (ctx.body = yapi.commons.resReturn(null, 400, '?????????????????????'));
    }
    if ((await this.checkAuth(params.id, 'project', 'danger')) !== true) {
      return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
    }

    params.role = ['owner', 'dev', 'guest'].find(v => v === params.role) || 'dev';
    let rolename = {
      owner: '??????',
      dev: '?????????',
      guest: '??????'
    };

    let result = await projectInst.changeMemberRole(params.id, params.member_uid, params.role);

    let username = this.getUsername();
    yapi
      .getInst(userModel)
      .findById(params.member_uid)
      .then(member => {
        yapi.commons.saveLog({
          content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????????????????? <a href="/user/profile/${
            params.member_uid
          }">${member.username}</a> ???????????? "${rolename[params.role]}"`,
          type: 'project',
          uid: this.getUid(),
          username: username,
          typeid: params.id
        });
      });
    ctx.body = yapi.commons.resReturn(result);
  }

  /**
   * ??????????????????????????????????????????
   * @interface /project/change_member_email_notice
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {String} id ??????id
   * @param {String} member_uid ????????????uid
   * @param {String} role ?????? ['owner'|'dev']
   * @returns {Object}
   * @example
   */
  async changeMemberEmailNotice(ctx) {
    try {
      let params = ctx.request.body;
      let projectInst = yapi.getInst(projectModel);
      var check = await projectInst.checkMemberRepeat(params.id, params.member_uid);
      if (check === 0) {
        return (ctx.body = yapi.commons.resReturn(null, 400, '?????????????????????'));
      }

      let result = await projectInst.changeMemberEmailNotice(
        params.id,
        params.member_uid,
        params.notice
      );
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * ??????????????????
   * @interface /project/upset
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {String} icon ??????icon
   * @param {Array} color ??????color
   * @returns {Object}
   * @example ./api/project/upset
   */
  async upSet(ctx) {
    let id = ctx.request.body.id;
    let data = {};
    if ((await this.checkAuth(id, 'project', 'danger')) !== true) {
      return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
    }
    data.color = ctx.request.body.color;
    data.icon = ctx.request.body.icon;
    if (!id) {
      return (ctx.body = yapi.commons.resReturn(null, 405, '??????id????????????'));
    }
    try {
      let result = await this.Model.up(id, data);
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
    try {
      this.followModel.updateById(this.getUid(), id, data).then(() => {
        let username = this.getUsername();
        yapi.commons.saveLog({
          content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????????????????????`,
          type: 'project',
          uid: this.getUid(),
          username: username,
          typeid: id
        });
      });
    } catch (e) {
      yapi.commons.log(e, 'error'); // eslint-disable-line
    }
  }

  /**
   * ????????????
   * @interface /project/up
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {String} name ???????????????????????????
   * @param {String} basepath ?????????????????????????????????
   * @param {String} [desc] ????????????
   * @returns {Object}
   * @example ./api/project/up.json
   */
  async up(ctx) {
    try {
      let id = ctx.request.body.id;
      let params = ctx.request.body;

      params = yapi.commons.handleParams(params, {
        name: 'string',
        basepath: 'string',
        group_id: 'number',
        desc: 'string',
        pre_script: 'string',
        after_script: 'string',
        project_mock_script: 'string'
      });

      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '??????id????????????'));
      }

      if ((await this.checkAuth(id, 'project', 'danger')) !== true) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
      }

      let projectData = await this.Model.get(id);

      if (params.basepath) {
        if ((params.basepath = this.handleBasepath(params.basepath)) === false) {
          return (ctx.body = yapi.commons.resReturn(null, 401, 'basepath????????????'));
        }
      }

      if (projectData.name === params.name) {
        delete params.name;
      }

      if (params.name) {
        let checkRepeat = await this.Model.checkNameRepeat(params.name, params.group_id);
        if (checkRepeat > 0) {
          return (ctx.body = yapi.commons.resReturn(null, 401, '?????????????????????'));
        }
      }

      let data = {
        up_time: yapi.commons.time()
      };

      data = Object.assign({}, data, params);

      let result = await this.Model.up(id, data);
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????? <a href="/project/${id}/interface/api">${
          projectData.name
        }</a>`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: id
      });
      yapi.emitHook('project_up', result).then();
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * ????????????
   * @interface /project/up_env
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {Array} [env] ??????????????????
   * @param {String} [env[].name] ????????????
   * @param {String} [env[].domain] ????????????
   * @param {Array}  [env[].header] header
   * @returns {Object}
   * @example
   */
  async upEnv(ctx) {
    try {
      let id = ctx.request.body.id;
      let params = ctx.request.body;
      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '??????id????????????'));
      }

      if ((await this.checkAuth(id, 'project', 'edit')) !== true) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
      }

      if (!params.env || !Array.isArray(params.env)) {
        return (ctx.body = yapi.commons.resReturn(null, 405, 'env??????????????????'));
      }

      let projectData = await this.Model.get(id);
      let data = {
        up_time: yapi.commons.time()
      };

      data.env = params.env;
      let isRepeat = this.arrRepeat(data.env, 'name');
      if (isRepeat) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '?????????????????????'));
      }
      let result = await this.Model.up(id, data);
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????? <a href="/project/${id}/interface/api">${
          projectData.name
        }</a> ?????????`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: id
      });
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * ????????????
   * @interface /project/up_tag
   * @method POST
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {Array} [tag] ??????tag??????
   * @param {String} [tag[].name] tag??????
   * @param {String} [tag[].desc] tag??????
   * @returns {Object}
   * @example
   */
  async upTag(ctx) {
    try {
      let id = ctx.request.body.id;
      let params = ctx.request.body;
      if (!id) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '??????id????????????'));
      }

      if ((await this.checkAuth(id, 'project', 'edit')) !== true) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
      }

      if (!params.tag || !Array.isArray(params.tag)) {
        return (ctx.body = yapi.commons.resReturn(null, 405, 'tag??????????????????'));
      }

      let projectData = await this.Model.get(id);
      let data = {
        up_time: yapi.commons.time()
      };
      data.tag = params.tag;

      let result = await this.Model.up(id, data);
      let username = this.getUsername();
      yapi.commons.saveLog({
        content: `<a href="/user/profile/${this.getUid()}">${username}</a> ??????????????? <a href="/project/${id}/interface/api">${
          projectData.name
        }</a> ???tag`,
        type: 'project',
        uid: this.getUid(),
        username: username,
        typeid: id
      });
      ctx.body = yapi.commons.resReturn(result);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  /**
   * ??????????????????????????????
   * @interface /project/get_env
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????

   * @returns {Object}
   * @example
   */
  async getEnv(ctx) {
    try {
      // console.log(ctx.request.query.project_id)
      let project_id = ctx.request.query.project_id;
      // let params = ctx.request.body;
      if (!project_id) {
        return (ctx.body = yapi.commons.resReturn(null, 405, '??????id????????????'));
      }

      // ??????????????????
      // if ((await this.checkAuth(project_id, 'project', 'edit')) !== true) {
      //   return (ctx.body = yapi.commons.resReturn(null, 405, '????????????'));
      // }

      let env = await this.Model.getByEnv(project_id);

      ctx.body = yapi.commons.resReturn(env);
    } catch (e) {
      ctx.body = yapi.commons.resReturn(null, 402, e.message);
    }
  }

  arrRepeat(arr, key) {
    const s = new Set();
    arr.forEach(item => s.add(item[key]));
    return s.size !== arr.length;
  }

  /**
   * ??????token??????
   * @interface /project/token
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {String} q
   * @return {Object}
   */
  async token(ctx) {
    try {
      let project_id = ctx.params.project_id;
      let data = await this.tokenModel.get(project_id);
      let token;
      if (!data) {
        let passsalt = yapi.commons.randStr();
        token = sha('sha1')
          .update(passsalt)
          .digest('hex')
          .substr(0, 20);

        await this.tokenModel.save({ project_id, token });
      } else {
        token = data.token;
      }

      token = getToken(token, this.getUid())

      ctx.body = yapi.commons.resReturn(token);
    } catch (err) {
      ctx.body = yapi.commons.resReturn(null, 402, err.message);
    }
  }

  /**
   * ??????token??????
   * @interface /project/update_token
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {Number} id ??????id???????????????
   * @param {String} q
   * @return {Object}
   */
  async updateToken(ctx) {
    try {
      let project_id = ctx.params.project_id;
      let data = await this.tokenModel.get(project_id);
      let token, result;
      if (data && data.token) {
        let passsalt = yapi.commons.randStr();
        token = sha('sha1')
          .update(passsalt)
          .digest('hex')
          .substr(0, 20);
        result = await this.tokenModel.up(project_id, token);
        token = getToken(token);
        result.token = token;
      } else {
        ctx.body = yapi.commons.resReturn(null, 402, '????????????token??????');
      }

      ctx.body = yapi.commons.resReturn(result);
    } catch (err) {
      ctx.body = yapi.commons.resReturn(null, 402, err.message);
    }
  }

  /**
   * ?????????????????????????????????????????????????????????
   * @interface /project/search
   * @method GET
   * @category project
   * @foldnumber 10
   * @param {String} q
   * @return {Object}
   * @example ./api/project/search.json
   */
  async search(ctx) {
    const { q } = ctx.request.query;

    if (!q) {
      return (ctx.body = yapi.commons.resReturn(void 0, 400, 'No keyword.'));
    }

    if (!yapi.commons.validateSearchKeyword(q)) {
      return (ctx.body = yapi.commons.resReturn(void 0, 400, 'Bad query.'));
    }

    let projectList = await this.Model.search(q);
    let groupList = await this.groupModel.search(q);
    let interfaceList = await this.interfaceModel.search(q);
    let interfaceList2 = await this.interfaceModel.searchp(q);

    let projectRules = [
      '_id',
      'name',
      'basepath',
      'uid',
      'env',
      'members',
      { key: 'group_id', alias: 'groupId' },
      { key: 'up_time', alias: 'upTime' },
      { key: 'add_time', alias: 'addTime' }
    ];
    let groupRules = [
      '_id',
      'uid',
      { key: 'group_name', alias: 'groupName' },
      { key: 'group_desc', alias: 'groupDesc' },
      { key: 'add_time', alias: 'addTime' },
      { key: 'up_time', alias: 'upTime' }
    ];
    let interfaceRules = [
      '_id',
      'uid',
      'path',
      { key: 'title', alias: 'title' },
      { key: 'project_id', alias: 'projectId' },
      { key: 'add_time', alias: 'addTime' },
      { key: 'up_time', alias: 'upTime' }
    ];

    projectList = commons.filterRes(projectList, projectRules);
    groupList = commons.filterRes(groupList, groupRules);
    interfaceList = commons.filterRes(interfaceList, interfaceRules);
    interfaceList2 = commons.filterRes(interfaceList2, interfaceRules);

    let queryList = {
      project: projectList,
      group: groupList,
      interface: interfaceList,
      interface2: interfaceList2
    };

    return (ctx.body = yapi.commons.resReturn(queryList, 0, 'ok'));t
  }

  // ?????? swagger url  ?????????node???????????????
  async swaggerUrl(ctx) {
    try {
      let ops = url.parse(ctx.request.query.url);
      let result = await yapi.commons.createWebAPIRequest(ops);

      ctx.body = yapi.commons.resReturn(result);
    } catch (err) {
      ctx.body = yapi.commons.resReturn(null, 402, err.message);
    }
  }
}

module.exports = projectController;
