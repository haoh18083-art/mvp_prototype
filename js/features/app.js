/** V0.2 功能页入口：注册角色菜单、演示身份与页面路由。 */
(function (SC, F) {
  'use strict';
  const meta = {
    'customer-spaces': ['客户跟进空间', 'CRM 归属事实、客户画像与销售经营内容，在同一空间查看。', 'building', 'MGR'],
    'today-follow': ['今日该跟', '每日按空间生成的跟进名单，依据可回溯，标记次日生效。', 'check', 'SLS'],
    'daily-report': ['晚间日报', '当日客户变化与行为归纳的晚间汇总，按生成时快照回看。', 'clock', 'SLS'],
    'customer-ownership': ['客户归属视图', '按客户只读查看当前归属、历史归属、空间状态与归属异常。', 'users', 'MGR'],
    'followup-workbench': ['客户空间', '概览、客户、商机、跟进、资料与历史毛利六个入口，围绕客户与销售绑定查看经营内容。', 'building', 'SLS'],
    'meeting-center': ['录音管理', '三方同步的客户录音、归位到客户空间与商机，以及每条归位的处理结果。', 'mic', 'MGR'],
    'employee-insights': ['经营洞察', '客户全局、每日跟进、活跃度与采纳，连接经营现状与下一步行动。', 'grid', 'MGR'],
    'sales-goals': ['销售目标与进度', '按月查看预计及已结算毛利，维护个人与全员毛利目标，核对收入成本来源。', 'grid', 'MGR'],
    'insight-ops': ['经营洞察编排', '状态、排序、动作提示词分开编排，按空间试跑对照，上线与回退次日生效。', 'sparkles', 'MGR'],
    'data-insights': ['数据洞察', '按销售与时间范围回看对话窗口、每日消息流和消息分布。', 'chat', 'MGR'],
    'push-followup': ['方案推送跟进', '以客户为线索，回看方案送达与销售后续跟进。', 'clock', 'MGR'],
    'platform-data': ['平台数据', '查看客户匹配批次、方案生产与分发情况。', 'layers', 'MGR'],
    'message-center': ['消息中心', '归属、空间、方案与运营异常提醒统一入箱，按当前权限直达来源。', 'inbox', 'SLS'],
    'sales-assistant': ['销售助手', '结合本人客户与跟进上下文，整理沟通重点和下一步行动。', 'chat', 'SLS'],
    'solution-workbench': ['方案人员工作台', '按承接客户组织方案工作，进入空间查看全景并补充资料。', 'layers', 'SOL'],
    'solution-push': ['方案推送', '向授权且正常的客户空间定向推送正文、附件和外部链接。', 'send', 'SOL'],
    'solution-feedback': ['反馈看板', '追踪本人方案的已读、回复、撤回和手动催办状态。', 'clock', 'SOL'],
    'solution-center': ['方案协同台', '在承接客户池内定向推送方案，跟踪销售已读与回复。', 'layers', 'SOL'],
    'operations-config': ['运营配置', '模型、CRM、消息触达、OpenClaw 与承接池配置。', 'sliders', 'ADM'],
    'ai-capability': ['AI 能力运营', '助手文档接管、分权填写、skill 引用、沙盒验证与逐销售发布。', 'sparkles', 'ADM'],
    'product-library': ['产品知识库', '维护产品资料、常见问题及发布状态。', 'box', 'ADM'],
    'conversation-review': ['会话审阅', '按销售定位对话记录，查看提问与助手答复。', 'chat', 'ADM']
  };
  const key = document.body.dataset.feature;
  const cfg = meta[key];
  if (!cfg) return;
  F.pageKey = key;
  const requested = SC.param('role') || cfg[3];
  F.role = F.roles[requested] ? requested : cfg[3];
  const initialTitle = key === 'operations-config' && F.role === 'ADM' && SC.param('tab') === 'people' ? '人员管理' : cfg[0];
  F.actor = F.person(SC.param('as') || F.defaults[F.role]);
  const allowed = {
    'customer-spaces': ['ADM', 'MGR', 'SLS', 'SOL'], 'followup-workbench': ['ADM', 'MGR', 'SLS', 'SOL'],
    'today-follow': ['SLS'], 'insight-ops': ['ADM', 'MGR'], 'daily-report': ['ADM', 'MGR', 'SLS', 'SOL'],
    'customer-ownership': ['ADM', 'MGR'],
    'meeting-center': ['ADM', 'MGR', 'SLS', 'SOL'], 'employee-insights': ['ADM', 'MGR', 'SLS'],
    'sales-goals': ['ADM', 'MGR', 'SLS', 'SOL'],
    'push-followup': ['ADM', 'MGR'], 'platform-data': ['ADM', 'MGR'], 'data-insights': ['ADM', 'MGR'],
    'message-center': ['ADM', 'MGR', 'SLS', 'SOL'], 'sales-assistant': ['SLS'],
    'solution-workbench': ['SOL'], 'solution-push': ['SOL'], 'solution-feedback': ['SOL'], 'solution-center': ['ADM', 'MGR', 'SLS', 'SOL'],
    'operations-config': ['ADM', 'MGR'], 'product-library': ['ADM', 'MGR'], 'conversation-review': ['ADM', 'MGR'],
    'ai-capability': ['ADM', 'MGR']
  };
  // 次级页面不进入菜单，由父级功能页承载导航高亮和返回入口。
  const secondaryOf = { 'followup-workbench': 'customer-spaces', 'solution-push': 'solution-workbench', 'solution-feedback': 'solution-workbench' };
  // 跟进工作台是独立的信息处理工作台，本版尚未实现；菜单位保留但封存，不影响直接路径访问。
  const sealed = { 'followup-workbench': { label: '跟进工作台', icon: 'check', reason: '本版未开放' } };
  const menus = {
    ADM: ['people-management', 'customer-spaces', 'customer-ownership', 'meeting-center', 'employee-insights', 'sales-goals', 'insight-ops', 'data-insights', 'push-followup', 'platform-data', 'message-center', 'product-library', 'conversation-review', 'ai-capability', 'operations-config'],
    MGR: ['customer-spaces', 'customer-ownership', 'meeting-center', 'employee-insights', 'sales-goals', 'insight-ops', 'data-insights', 'push-followup', 'platform-data', 'message-center', 'conversation-review', 'ai-capability', 'operations-config'],
    SLS: ['customer-spaces', 'today-follow', 'sales-goals', 'daily-report', 'followup-workbench', 'meeting-center', 'solution-center', 'message-center', 'sales-assistant'],
    SOL: ['solution-workbench', 'daily-report', 'customer-spaces', 'meeting-center', 'message-center']
  };
  // 所有角色菜单只指向 V0.2 功能页。
  Object.keys(menus).forEach(role => {
    SC.MENU[role] = menus[role].map(k => {
      if (sealed[k]) return { key: k, label: sealed[k].label, icon: sealed[k].icon, href: '', disabled: true, disabledReason: sealed[k].reason, src: 'V0.2 · 待实现工作台' };
      if (k === 'people-management') return { key: k, label: '人员管理', icon: 'users', href: 'operations-config.html?tab=people&role=' + role + '&as=' + (role === F.role && F.actor?.role === role ? F.actor.id : F.defaults[role]), src: 'V0.2 · 超管账号管理' };
      return { key: k, label: meta[k][0], icon: meta[k][2], href: k + '.html?role=' + role + '&as=' + (role === F.role && F.actor?.role === role ? F.actor.id : F.defaults[role]), src: 'V0.2 · 现有前端功能迁入' };
    });
  });
  if (F.actor?.role === F.role) SC.DATA.CURRENT[F.role] = { name: F.actor.name, email: '', pool: '', group: '' };

  /**
   * 识别带详情上下文的功能页，并给出不依赖浏览器历史的安全父级链接。
   * 浏览器历史仍由公共布局优先处理，以便从经营洞察、消息中心等来源返回时保留筛选状态。
   */
  function secondaryBack() {
    const space = SC.param('space');
    const solution = SC.param('solution');
    const meeting = SC.param('meeting');
    if (key === 'followup-workbench' && solution && space) {
      return { label: '返回客户空间', href: F.link('followup-workbench', { space, tab: 'solutions' }) };
    }
    // 客户空间始终是「客户跟进空间」的次级页面，未带 space 参数时也回到列表。
    if (key === 'followup-workbench') {
      return { label: '返回客户空间列表', href: F.link('customer-spaces') };
    }
    if (['solution-push', 'solution-feedback'].includes(key)) {
      return { label: '返回方案人员工作台', href: F.link('solution-workbench') };
    }
    if (key === 'meeting-center' && meeting) {
      return { label: '返回录音列表', href: F.link('meeting-center') };
    }
    return null;
  }

  F.refresh = function () {
    const activeMenu = initialTitle === '人员管理' ? 'people-management' : secondaryOf[key] || key;
    SC.page({ role: F.role, menu: activeMenu, title: initialTitle, pid: 'V02-' + key, showHead: false, back: secondaryBack() }, body => {
      document.title = initialTitle + ' · 销售指挥官 V0.2';
      if (!F.actor || F.actor.role !== F.role || F.actor.status === 'off' || !allowed[key].includes(F.role)) {
        body.innerHTML = F.empty('当前演示身份无权访问此页面，请通过顶部角色菜单切换。'); return;
      }
      body.className = 'fp' + (key === 'customer-ownership' ? ' fp-ownership' : '');
      // 页面名称统一由顶部操作条承载，主体直接进入业务内容，避免重复标题和演示入口占位。
      body.innerHTML = '<div id="fp-content" class="fp-stack"></div>';
      F.views[key](body.querySelector('#fp-content'));
    });
  };
  F.refresh();
  // 同一浏览器不同角色页共享数据；权限配置改变后立即重读范围。
  window.addEventListener('storage', event => {
    if (event.key === F.key) {
      document.querySelectorAll('.fp-overlay').forEach(n => n.remove());
      document.getElementById('sc-app').inert = false;
      F.refresh();
    }
  });
})(window.SC, window.SC.FEATURES);
