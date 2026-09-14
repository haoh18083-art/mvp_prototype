/* ==========================================================================
   原型演示数据（全部为虚构样例，不含真实客户或人员信息）
   ========================================================================== */

window.SC = window.SC || {};

SC.DATA = (function () {

  /* ---------------------------------------------- 角色 */

  var ROLES = {
    ADM: { key: 'ADM', name: '超级管理员', short: '超管' },
    MGR: { key: 'MGR', name: '销售主管',   short: '主管' },
    SLS: { key: 'SLS', name: '销售',       short: '销售' },
    SOL: { key: 'SOL', name: '解决方案人员', short: '方案' }
  };

  /* ---------------------------------------------- 当前登录人（按角色切换） */

  var CURRENT = {
    ADM: { name: '陈可', email: 'chenke@teddymobile.cn' },
    MGR: { name: '王云生', email: 'wangyunsheng@teddymobile.cn', group: '华北一组' },
    SLS: { name: '付赞', email: 'fuzan@teddymobile.cn', group: '华北一组' },
    SOL: { name: '闫丽梅', email: 'yanlimei@teddymobile.cn', pool: '通信线路池' }
  };

  /* ---------------------------------------------- 人员档案 */

  var PEOPLE = [
    { id: 'U-1001', name: '陈可',   email: 'chenke',         phone: '138****4021', role: 'ADM', status: 'on',  created: '2026-08-12 09:14', ding: 'ding_chenke',  group: '—',      cust: 0,  opp: 0,  space: 0 },
    { id: 'U-1002', name: '王云生', email: 'wangyunsheng',   phone: '139****7733', role: 'MGR', status: 'on',  created: '2026-08-12 09:16', ding: 'ding_wys',     group: '华北一组', cust: 0,  opp: 0,  space: 0 },
    { id: 'U-1003', name: '李建民', email: 'lijianmin',      phone: '137****2288', role: 'MGR', status: 'on',  created: '2026-08-12 09:17', ding: 'ding_ljm',     group: '华东组',  cust: 0,  opp: 0,  space: 0 },
    { id: 'U-1004', name: '付赞',   email: 'fuzan',          phone: '135****5610', role: 'SLS', status: 'on',  created: '2026-08-13 10:02', ding: 'ding_fuzan',   group: '华北一组', cust: 14, opp: 23, space: 16 },
    { id: 'U-1005', name: '张云飞', email: 'zhangyunfei',    phone: '136****9902', role: 'SLS', status: 'on',  created: '2026-08-13 10:04', ding: 'ding_zyf',     group: '华北一组', cust: 9,  opp: 12, space: 9 },
    { id: 'U-1006', name: '张忠超', email: 'zhangzhongchao', phone: '188****3341', role: 'SLS', status: 'on',  created: '2026-08-13 10:05', ding: 'ding_zzc',     group: '华北二组', cust: 11, opp: 18, space: 12 },
    { id: 'U-1007', name: '韩增',   email: 'hanzeng',        phone: '186****8877', role: 'SLS', status: 'off', created: '2026-08-14 14:31', ding: '',             group: '华北二组', cust: 6,  opp: 8,  space: 5 },
    { id: 'U-1008', name: '杨锐',   email: 'yangrui',        phone: '159****4416', role: 'SLS', status: 'on',  created: '2026-08-15 09:20', ding: 'ding_yr',      group: '华东组',  cust: 7,  opp: 9,  space: 6 },
    { id: 'U-1009', name: '赵伟航', email: 'zhaoweihang',    phone: '133****6650', role: 'SLS', status: 'on',  created: '2026-08-15 09:22', ding: 'ding_zwh',     group: '华东组',  cust: 5,  opp: 6,  space: 4 },
    { id: 'U-1010', name: '闫丽梅', email: 'yanlimei',       phone: '150****1194', role: 'SOL', status: 'on',  created: '2026-08-16 11:40', ding: '',             group: '—',      cust: 0,  opp: 0,  space: 0 },
    { id: 'U-1011', name: '刘珍珍', email: 'liuzhenzhen',    phone: '187****2205', role: 'SOL', status: 'on',  created: '2026-08-16 11:42', ding: '',             group: '—',      cust: 0,  opp: 0,  space: 0 },
    { id: 'U-1012', name: '孙嘉禾', email: 'sunjiahe',       phone: '131****8830', role: 'SOL', status: 'on',  created: '2026-08-18 15:07', ding: '',             group: '—',      cust: 0,  opp: 0,  space: 0 },
    { id: 'U-1013', name: '周允',   email: 'zhouyun',        phone: '132****4472', role: 'SLS', status: 'on',  created: '2026-08-20 09:55', ding: 'ding_zy',      group: '—',      cust: 3,  opp: 4,  space: 0 },
    { id: 'U-1014', name: '何明轩', email: 'hemingxuan',     phone: '176****6018', role: 'SLS', status: 'on',  created: '2026-08-22 16:23', ding: 'ding_hmx',     group: '—',      cust: 0,  opp: 0,  space: 0 }
  ];

  /* ---------------------------------------------- 待分配角色池 */

  var ROLE_POOL = [
    { id: 'U-1020', name: '许砚', email: 'xuyan',      phone: '138****0092', enter: '2026-09-05 17:20', from: '批量导入' },
    { id: 'U-1021', name: '邓思远', email: 'dengsiyuan', phone: '139****3318', enter: '2026-09-05 17:20', from: '批量导入' },
    { id: 'U-1022', name: '苏婉',  email: 'suwan',     phone: '135****7741', enter: '2026-09-05 17:20', from: '批量导入' },
    { id: 'U-1023', name: '于泽',  email: 'yuze',      phone: '186****5523', enter: '2026-09-06 10:08', from: '单个新增' },
    { id: 'U-1024', name: '柯宁',  email: 'kening',    phone: '158****9964', enter: '2026-09-07 09:31', from: '批量导入' }
  ];

  /* ---------------------------------------------- 销售分组 */

  var GROUPS = [
    { id: 'G-01', name: '华北一组', mgr: '王云生', mgrId: 'U-1002', sales: 2, cust: 21, combo: 26, space: 25 },
    { id: 'G-02', name: '华北二组', mgr: '—',      mgrId: '',       sales: 2, cust: 15, combo: 19, space: 17 },
    { id: 'G-03', name: '华东组',   mgr: '李建民', mgrId: 'U-1003', sales: 2, cust: 12, combo: 14, space: 10 }
  ];

  var GROUP_MEMBERS = {
    'G-01': [
      { id: 'U-1004', name: '付赞',   status: 'on', cust: 14, combo: 17, space: 16 },
      { id: 'U-1005', name: '张云飞', status: 'on', cust: 9,  combo: 9,  space: 9 }
    ],
    'G-02': [
      { id: 'U-1006', name: '张忠超', status: 'on',  cust: 11, combo: 13, space: 12 },
      { id: 'U-1007', name: '韩增',   status: 'off', cust: 6,  combo: 6,  space: 5 }
    ],
    'G-03': [
      { id: 'U-1008', name: '杨锐',   status: 'on', cust: 7, combo: 8, space: 6 },
      { id: 'U-1009', name: '赵伟航', status: 'on', cust: 5, combo: 6, space: 4 }
    ]
  };

  /* ---------------------------------------------- 基础数据字典 */

  var DICTS = [
    { id: 'D-01', name: '客户行业',     opts: 12, fixed: false, desc: '客户档案的行业分类' },
    { id: 'D-02', name: '客户等级',     opts: 4,  fixed: false, desc: '客户档案的等级分类' },
    { id: 'D-03', name: '客户阶段',     opts: 6,  fixed: false, desc: '来源客户阶段，按原含义呈现' },
    { id: 'D-04', name: '客保驳回原因', opts: 7,  fixed: false, desc: '客保审批驳回时的原因选项' },
    { id: 'D-05', name: '准入驳回原因', opts: 5,  fixed: false, desc: '跟进准入终审驳回时的原因选项' },
    { id: 'D-06', name: '商机释放原因', opts: 6,  fixed: false, desc: '销售发起商机释放时的原因选项' },
    { id: 'D-07', name: '商机结束原因', opts: 8,  fixed: false, desc: '关闭与流失的原因选项' },
    { id: 'D-08', name: '角色',         opts: 4,  fixed: true,  desc: '四类固定角色，不支持自定义新增' },
    { id: 'D-09', name: '产品计费类型', opts: 2,  fixed: true,  desc: '定费型、流水型两类固定值' },
    { id: 'D-10', name: '空间状态',     opts: 5,  fixed: true,  desc: '建立中、建立失败、正常、已归档、只读归档' },
    { id: 'D-11', name: 'Agent 实例状态', opts: 8, fixed: true, desc: '待绑定至已停止共八值' }
  ];

  var DICT_OPTIONS = {
    'D-04': [
      { v: '客户主体不一致',     on: true,  sort: 1 },
      { v: '同客同品已有商机',   on: true,  sort: 2 },
      { v: '申请资格不足',       on: true,  sort: 3 },
      { v: '客户池归属待核对',   on: true,  sort: 4 },
      { v: '产品未激活',         on: true,  sort: 5 },
      { v: '重复申请',           on: true,  sort: 6 },
      { v: '其他（需填写说明）', on: true,  sort: 7 },
      { v: '资料不全',           on: false, sort: 8 }
    ],
    'D-08': [
      { v: '销售',           on: true, sort: 1 },
      { v: '销售主管',       on: true, sort: 2 },
      { v: '解决方案人员',   on: true, sort: 3 },
      { v: '超级管理员',     on: true, sort: 4 }
    ]
  };

  /* ---------------------------------------------- 六域事件清单（M03-2） */

  var DOMAINS = [
    { key: 'A', name: '人员与权限', span: 'EV-A-01 ～ EV-A-15', n: 15, own: 'M01、M02-2', desc: '人员档案、登录账号、角色分配、钉钉身份关联、登录动作、销售分组与主管指派' },
    { key: 'B', name: '数据接入',   span: 'EV-B-01 ～ EV-B-14', n: 14, own: 'M04-1、M04-2', desc: '同步运行、来源记录接入、数据异常、来源差异、待合并候选；首次来源继承不记本地审批人' },
    { key: 'C', name: '主数据与客户池', span: 'EV-C-01 ～ EV-C-16', n: 16, own: 'M05-1、M05-2、M06', desc: '客户主档、联系人、字典、客户池、存量批量指定、产品映射与激活' },
    { key: 'D', name: '客保裁决',   span: 'EV-D-01 ～ EV-D-22', n: 22, own: 'M07-1、M07-2、M07-3', desc: '申请、审批、分配、释放、公海、交接、恢复；申请单与逐条结果分别成事件并互相定位' },
    { key: 'E', name: '准入与空间', span: 'EV-E-01 ～ EV-E-17', n: 17, own: 'M08、M09', desc: '提报、终审、作废、重新准入、空间建立、装载、归档、解档、迁移；解档不生成建立事件' },
    { key: 'F', name: 'Agent 实例', span: 'EV-F-01 ～ EV-F-14', n: 14, own: 'M10-1、M10-2', desc: '实例创建、绑定、停止、迁移、新建、首次读取、越界读取、输出承载校验' }
  ];

  var EVENT_CATALOG = {
    A: [
      { code: 'EV-A-01', name: '创建人员档案与登录账号', flow: '两者', dedup: '人员标识 + 创建动作' },
      { code: 'EV-A-02', name: '批量导入人员',           flow: '两者', dedup: '导入批次标识' },
      { code: 'EV-A-03', name: '分配角色',               flow: '两者', dedup: '人员标识 + 目标角色 + 动作时间' },
      { code: 'EV-A-04', name: '变更角色',               flow: '两者', dedup: '人员标识 + 前后角色' },
      { code: 'EV-A-05', name: '启用账号',               flow: '两者', dedup: '人员标识 + 目标状态' },
      { code: 'EV-A-06', name: '停用账号',               flow: '两者', dedup: '人员标识 + 目标状态' },
      { code: 'EV-A-07', name: '重置密码',               flow: '仅审计', dedup: '人员标识 + 动作时间' },
      { code: 'EV-A-08', name: '复制账号信息',           flow: '仅审计', dedup: '人员标识 + 字段 + 动作时间' },
      { code: 'EV-A-09', name: '维护钉钉身份关联',       flow: '仅审计', dedup: '人员标识 + 前后标识' },
      { code: 'EV-A-10', name: '登录成功',               flow: '仅审计', dedup: '账号 + 会话' },
      { code: 'EV-A-11', name: '登录失败',               flow: '仅审计', dedup: '每次真实尝试独立记录' },
      { code: 'EV-A-12', name: '访问被拒绝',             flow: '仅审计', dedup: '账号 + 目标 + 动作时间' },
      { code: 'EV-A-13', name: '建立销售分组',           flow: '两者', dedup: '分组标识 + 创建动作' },
      { code: 'EV-A-14', name: '调整分组关系',           flow: '两者', dedup: '人员标识 + 前后分组' },
      { code: 'EV-A-15', name: '指派或继任销售主管',     flow: '两者', dedup: '分组标识 + 前后主管' }
    ]
  };

  /* ---------------------------------------------- 操作审计事件 */

  var AUDIT = [
    { id: 'E-90211', code: 'EV-A-06', domain: 'A', name: '停用账号',           at: '2026-09-07 16:42:08', by: '陈可', entry: '人员与账号', exec: '销售指挥官', obj: '人员 U-1007 韩增', scope: '销售：韩增', result: 'ok',   batch: '' },
    { id: 'E-90210', code: 'EV-A-15', domain: 'A', name: '指派销售主管',       at: '2026-09-07 15:20:51', by: '陈可', entry: '销售分组',   exec: '销售指挥官', obj: '分组 G-01 华北一组', scope: '分组：华北一组', result: 'ok', batch: '' },
    { id: 'E-90209', code: 'EV-D-07', domain: 'D', name: '客保审批通过并选池', at: '2026-09-07 14:58:33', by: '王云生', entry: '客保审批', exec: '销售指挥官', obj: '商机 O-3391', scope: '销售：付赞 ｜ 客户：北京泰迪未来科技 ｜ 商机：O-3391', result: 'ok', batch: 'B-2210' },
    { id: 'E-90208', code: 'EV-E-04', domain: 'E', name: '跟进准入终审通过',   at: '2026-09-07 14:31:02', by: '王云生', entry: '跟进准入终审', exec: '销售指挥官', obj: '经营组合 C-1182', scope: '销售：付赞 ｜ 客户：北京泰迪未来科技', result: 'ok', batch: '' },
    { id: 'E-90207', code: 'EV-E-09', domain: 'E', name: '客户工作空间建立',   at: '2026-09-07 14:31:06', by: '—',     entry: '系统自动', exec: '销售指挥官', obj: '空间 W-2043', scope: '销售：付赞 ｜ 客户：北京泰迪未来科技 ｜ 客户池：通信线路池', result: 'ok', batch: '' },
    { id: 'E-90206', code: 'EV-F-02', domain: 'F', name: '实例绑定成功',       at: '2026-09-07 14:31:09', by: '—',     entry: '系统自动', exec: '驻留 Agent', obj: '实例 A-5127', scope: '空间：W-2043', result: 'ok', batch: '' },
    { id: 'E-90205', code: 'EV-F-03', domain: 'F', name: '实例绑定失败',       at: '2026-09-07 13:07:44', by: '—',     entry: '系统自动', exec: '驻留 Agent', obj: '实例 A-5126', scope: '空间：W-2041', result: 'fail', batch: '' },
    { id: 'E-90204', code: 'EV-C-10', domain: 'C', name: '存量商机批量指定客户池', at: '2026-09-07 11:22:19', by: '陈可', entry: '客户池管理', exec: '销售指挥官', obj: '批次 B-2209（38 条）', scope: '客户池：号码认证池', result: 'partial', batch: 'B-2209' },
    { id: 'E-90203', code: 'EV-C-14', domain: 'C', name: '产品激活',           at: '2026-09-07 10:41:55', by: '陈可', entry: '产品管理', exec: '销售指挥官', obj: '产品 P-118 天枢无忧盾 Pro', scope: '产品：天枢无忧盾 Pro', result: 'ok', batch: '' },
    { id: 'E-90202', code: 'EV-B-03', domain: 'B', name: '周期同步完成',       at: '2026-09-07 10:35:00', by: '—',     entry: '系统自动', exec: '销售指挥官', obj: '同步轮次 S-8841', scope: '来源：CRM', result: 'ok', batch: '' },
    { id: 'E-90201', code: 'EV-B-08', domain: 'B', name: '标记来源差异',       at: '2026-09-07 10:35:04', by: '—',     entry: '系统自动', exec: '销售指挥官', obj: '商机 O-3204', scope: '客户：中华保险 ｜ 商机：O-3204', result: 'ok', batch: '' },
    { id: 'E-90200', code: 'EV-A-03', domain: 'A', name: '批量分配角色',       at: '2026-09-06 17:12:30', by: '陈可', entry: '人员与账号', exec: '销售指挥官', obj: '批次 B-2208（3 人）', scope: '人员：许砚、邓思远、苏婉', result: 'ok', batch: 'B-2208' },
    { id: 'E-90199', code: 'EV-A-08', domain: 'A', name: '复制账号信息',       at: '2026-09-06 16:55:11', by: '陈可', entry: '人员与账号', exec: '销售指挥官', obj: '人员 U-1004 付赞', scope: '人员：付赞', result: 'ok', batch: '' },
    { id: 'E-90198', code: 'EV-A-11', domain: 'A', name: '登录失败',           at: '2026-09-06 09:02:47', by: 'zhouyun@teddymobile.cn', entry: '登录页', exec: '销售指挥官', obj: '账号 zhouyun@teddymobile.cn', scope: '—', result: 'fail', batch: '' },
    { id: 'E-90197', code: 'EV-A-02', domain: 'A', name: '批量导入人员',       at: '2026-09-05 17:20:02', by: '陈可', entry: '人员与账号', exec: '销售指挥官', obj: '批次 B-2207（5 行）', scope: '人员：4 人创建成功', result: 'partial', batch: 'B-2207' }
  ];

  /* ---------------------------------------------- 审计详情（示例一条） */

  var AUDIT_DETAIL = {
    'E-90210': {
      identity: { by: '陈可（超级管理员）', entry: '销售分组 › 分组详情页', exec: '销售指挥官' },
      kpi: [
        ['分组销售', 2,  '华北一组在岗', 'users'],
        ['去重客户', 21, '本组经营范围', 'building'],
        ['经营组合', 26, '客户 × 产品',  'layers'],
        ['已建空间', 25, '正常运行',     'grid']
      ],
      scope: [
        { k: '所属团队',     v: '本地销售团队' },
        { k: '主管席位',     v: '一组一主管' },
        { k: '受理范围',     v: '本组客保申请 · 准入提报' },
        { k: '历史商机归属', v: '不随主管变更' }
      ],
      snapshot: [
        { k: '销售主管',     before: '空缺（超管兜底）', after: '王云生（U-1002）' },
        { k: '本组提报受理', before: '超级管理员兜底',   after: '王云生受理' },
        { k: '历史商机归属', before: '各归属销售',       after: '保持不变' }
      ],
      evidence: [
        { use: '触发源',   type: '页面动作', id: 'D-06 指派主管弹窗',       fixed: false },
        { use: '判断依据', type: '人员角色', id: 'U-1002 王云生 · 销售主管', fixed: false },
        { use: '判断依据', type: '分组关系', id: 'G-01 华北一组',           fixed: false }
      ],
      corrections: [],
      note: '一名销售主管只管理一个分组；指派后本组新的客保申请与准入提报由该主管受理，历史商机归属不变。'
    },
    'E-90211': {
      identity: { by: '陈可（超级管理员）', entry: '人员与账号 › 人员管理列表页', exec: '销售指挥官' },
      kpi: [
        ['涉及商机', 8, '含已结束 2 · 未激活 1', 'box'],
        ['涉及客户', 6, '去重',                 'building'],
        ['已建空间', 5, '正常',                 'grid'],
        ['待交接',   6, '客户组待交接',         'alert']
      ],
      scope: [
        { k: '销售',     v: '韩增（U-1007）' },
        { k: '所属分组', v: '华北二组' },
        { k: '待交接',   v: '6 个客户组（M07-3 办理）' }
      ],
      snapshot: [
        { k: '账号状态', before: '启用', after: '停用' },
        { k: '商机归属', before: '韩增（8 条）', after: '韩增（8 条，未变更）' },
        { k: '待分配事项', before: '无', after: '存在（6 个客户组待交接）' }
      ],
      evidence: [
        { use: '触发源', type: '页面动作', id: 'D-04 停用确认弹窗', fixed: false },
        { use: '判断依据', type: '归属清单', id: 'O-3180 等 8 条', fixed: false },
        { use: '判断依据', type: '分组关系', id: 'G-02 华北二组', fixed: true }
      ],
      corrections: [],
      note: '账号停用不改变商机归属；交接须在 M07-3 明确办理，本次未办理交接。'
    }
  };

  /* ---------------------------------------------- 留痕待补（M03-1 §4.7） */

  var PENDING_AUDIT = [
    { id: 'P-3301', obj: '商机 O-3288', real: '客保审批已通过，归属已变更为张云飞', why: '留痕写入超时', mod: 'M07-2', at: '2026-09-07 12:14' },
    { id: 'P-3302', obj: '空间 W-2039', real: '空间已归档，实例已停止', why: '事件顺序核对未完成', mod: 'M09', at: '2026-09-06 18:52' },
    { id: 'P-3303', obj: '人员 U-1013', real: '角色已分配为销售', why: '留痕写入失败', mod: 'M01', at: '2026-09-06 10:07' }
  ];

  /* ---------------------------------------------- 组件演示样例 */

  var DEMO_COMBOS = [
    {
      cust: '北京泰迪未来科技', sales: '付赞', oppTotal: 5, oppEnded: 1, admit: '已通过', pending: 0,
      spaces: [
        { pool: '通信线路池', state: 'normal', opp: 2, agent: 'ready',   id: 'W-2043' },
        { pool: '号码认证池', state: 'normal', opp: 2, agent: 'bound',   id: 'W-2044', empty: false }
      ]
    },
    {
      cust: '中华保险', sales: '付赞', oppTotal: 3, oppEnded: 0, admit: '已通过', pending: 1,
      spaces: [
        { pool: '号码认证池', state: 'normal', opp: 0, agent: 'ready', id: 'W-2031', empty: true }
      ]
    },
    {
      cust: '天书智能呼叫', sales: '付赞', oppTotal: 2, oppEnded: 0, admit: '未提报', pending: 2,
      spaces: []
    }
  ];

  /* ---------------------------------------------- 查询 API */

  function person(id) {
    for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].id === id) return PEOPLE[i];
    return null;
  }

  function group(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return null;
  }

  function dict(id) {
    for (var i = 0; i < DICTS.length; i++) if (DICTS[i].id === id) return DICTS[i];
    return null;
  }

  function audit(id) {
    for (var i = 0; i < AUDIT.length; i++) if (AUDIT[i].id === id) return AUDIT[i];
    return null;
  }

  function domain(key) {
    for (var i = 0; i < DOMAINS.length; i++) if (DOMAINS[i].key === key) return DOMAINS[i];
    return null;
  }

  return {
    ROLES: ROLES, CURRENT: CURRENT,
    PEOPLE: PEOPLE, ROLE_POOL: ROLE_POOL,
    GROUPS: GROUPS, GROUP_MEMBERS: GROUP_MEMBERS,
    DICTS: DICTS, DICT_OPTIONS: DICT_OPTIONS,
    DOMAINS: DOMAINS, EVENT_CATALOG: EVENT_CATALOG,
    AUDIT: AUDIT, AUDIT_DETAIL: AUDIT_DETAIL, PENDING_AUDIT: PENDING_AUDIT,
    DEMO_COMBOS: DEMO_COMBOS,
    person: person, group: group, dict: dict, audit: audit, domain: domain
  };
})();
