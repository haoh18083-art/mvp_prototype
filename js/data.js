/**
 * V0.2 功能页共享的角色与演示人员。
 * 这里只提供页面外壳和功能模型实际依赖的身份数据；业务状态由 js/features/store.js 管理。
 */
window.SC = window.SC || {};

SC.DATA = (function () {
  'use strict';

  var ROLES = {
    ADM: { key: 'ADM', name: '超级管理员', short: '超管' },
    MGR: { key: 'MGR', name: '销售运营', short: '运营' },
    SLS: { key: 'SLS', name: '销售', short: '销售' },
    SOL: { key: 'SOL', name: '解决方案人员', short: '方案' }
  };

  var CURRENT = {
    ADM: { name: '陈可', email: 'chenke@teddymobile.cn' },
    MGR: { name: '王云生', email: 'wangyunsheng@teddymobile.cn' },
    SLS: { name: '付赞', email: 'fuzan@teddymobile.cn' },
    SOL: { name: '闫丽梅', email: 'yanlimei@teddymobile.cn' }
  };

  /*
   * 登录页与人员管理页共用的本地演示存储。人员状态保存在功能页状态中，
   * 密码单独存放，避免把明文凭据混入人员详情、导出或审计数据。
   */
  var PEOPLE_STATE_KEY = 'sc-v02-feature-pages-v1';
  var CREDENTIALS_KEY = 'sc-v02-demo-credentials-v1';
  var credentialMemory = {};
  var DEFAULT_CREDENTIALS = {
    'U-1001': 'Tm7k#Qa2Xw9p',
    'U-1002': 'Rv3d#Kp8Ze1m',
    'U-1004': 'Ly6w#Nt4Bh7c',
    'U-1010': 'Qs2m#Fj9Vd5r'
  };

  /*
   * 人员管理页与登录页共用这组演示身份。字段名称尽量贴近生产 UserRead
   * 接口，避免原型中的账号列表与业务页面各自维护一套不一致的数据。
   */
  var PEOPLE = [
    { id: 'U-1001', name: '陈可', email: 'chenke@teddymobile.cn', mobile: '138****1001', role: 'ADM', status: 'on', createdAt: '2026-08-18 09:20', lastLoginAt: '2026-09-15 09:12' },
    { id: 'U-1002', name: '王云生', email: 'wangyunsheng@teddymobile.cn', mobile: '138****1002', role: 'MGR', status: 'on', createdAt: '2026-08-19 10:05', lastLoginAt: '2026-09-15 08:56' },
    { id: 'U-1003', name: '李建民', email: 'lijianmin@teddymobile.cn', mobile: '138****1003', role: 'MGR', status: 'on', createdAt: '2026-08-20 11:42', lastLoginAt: '2026-09-14 17:38' },
    { id: 'U-1004', name: '付赞', email: 'fuzan@teddymobile.cn', mobile: '138****1004', role: 'SLS', status: 'on', createdAt: '2026-08-21 09:15', lastLoginAt: '2026-09-15 09:03' },
    { id: 'U-1005', name: '张云飞', email: 'zhangyunfei@teddymobile.cn', mobile: '138****1005', role: 'SLS', status: 'on', createdAt: '2026-08-22 14:18', lastLoginAt: '2026-09-15 08:41' },
    { id: 'U-1006', name: '张忠超', email: 'zhangzhongchao@teddymobile.cn', mobile: '138****1006', role: 'SLS', status: 'on', createdAt: '2026-08-23 16:10', lastLoginAt: '2026-09-14 18:02' },
    { id: 'U-1007', name: '韩增', email: 'hanzeng@teddymobile.cn', mobile: '138****1007', role: 'SLS', status: 'off', createdAt: '2026-08-24 10:34', lastLoginAt: '2026-09-06 13:27' },
    { id: 'U-1008', name: '杨锐', email: 'yangrui@teddymobile.cn', mobile: '138****1008', role: 'SLS', status: 'on', createdAt: '2026-08-25 09:48', lastLoginAt: '2026-09-15 08:35' },
    { id: 'U-1009', name: '赵伟航', email: 'zhaoweihang@teddymobile.cn', mobile: '138****1009', role: 'SLS', status: 'on', createdAt: '2026-08-26 15:22', lastLoginAt: '2026-09-14 16:49' },
    { id: 'U-1010', name: '闫丽梅', email: 'yanlimei@teddymobile.cn', mobile: '138****1010', role: 'SOL', status: 'on', createdAt: '2026-08-27 09:05', lastLoginAt: '2026-09-15 08:12' },
    { id: 'U-1011', name: '刘珍珍', email: 'liuzhenzhen@teddymobile.cn', mobile: '138****1011', role: 'SOL', status: 'on', createdAt: '2026-08-28 13:46', lastLoginAt: '2026-09-13 17:04' },
    { id: 'U-1012', name: '孙嘉禾', email: 'sunjiahe@teddymobile.cn', mobile: '138****1012', role: 'SOL', status: 'on', createdAt: '2026-08-29 11:18', lastLoginAt: '2026-09-14 09:26' },
    { id: 'U-1013', name: '周允', email: 'zhouyun@teddymobile.cn', mobile: '138****1013', role: 'SLS', status: 'on', createdAt: '2026-08-30 10:02', lastLoginAt: '2026-09-15 07:58' },
    { id: 'U-1014', name: '何明轩', email: 'hemingxuan@teddymobile.cn', mobile: '138****1014', role: 'SLS', status: 'on', createdAt: '2026-09-01 14:31', lastLoginAt: '2026-09-14 15:52' }
  ];

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /**
   * 读取人员管理保存后的快照，供登录页重新校验停用状态、邮箱和角色。
   * 未有功能页状态时回退到静态演示人员，保证首次打开登录页仍可用。
   */
  function peopleSnapshot() {
    var stored = readJSON(PEOPLE_STATE_KEY);
    var incoming = stored && Array.isArray(stored.people) ? stored.people : [];
    var byId = new Map(incoming.filter(function (person) { return person && person.id; }).map(function (person) { return [person.id, person]; }));
    var merged = PEOPLE.map(function (person) { return Object.assign({}, person, byId.get(person.id) || {}); });
    incoming.filter(function (person) { return person && person.id && !PEOPLE.some(function (item) { return item.id === person.id; }); }).forEach(function (person) {
      merged.push(Object.assign({}, person));
    });
    return merged;
  }

  /** 返回当前演示账号的密码；生产系统不会在前端保存明文密码。 */
  function getCredential(id, fallback) {
    var stored = readJSON(CREDENTIALS_KEY);
    var value = stored && typeof stored[id] === 'string' ? stored[id] : credentialMemory[id];
    return value || DEFAULT_CREDENTIALS[id] || fallback || '';
  }

  /** 保存演示账号凭据，供新增账号和重置密码后的登录闭环使用。 */
  function setCredential(id, password) {
    if (!id || !password) return;
    var value = String(password);
    credentialMemory[id] = value;
    var stored = readJSON(CREDENTIALS_KEY);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
    stored[id] = value;
    try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(stored)); } catch (_) {}
  }

  return {
    ROLES: ROLES,
    CURRENT: CURRENT,
    PEOPLE: PEOPLE,
    PEOPLE_STATE_KEY: PEOPLE_STATE_KEY,
    CREDENTIALS_KEY: CREDENTIALS_KEY,
    DEFAULT_CREDENTIALS: DEFAULT_CREDENTIALS,
    peopleSnapshot: peopleSnapshot,
    getCredential: getCredential,
    setCredential: setCredential
  };
})();
