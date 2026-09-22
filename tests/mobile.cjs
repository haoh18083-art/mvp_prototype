/** R09 销售移动端回归：四主入口、客户搜索、五 Tab、写入、离线草稿、并发与方案接收。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const pageDir = path.join(root, 'mobile-ios-sales-assistant', 'pages');

/** 加载移动端外壳；storage 用于跨实例共享业务状态（两端同源验证）。 */
function load(hash = '', storage, deviceStorage) {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(pageDir, 'mobile-ios.html'), 'utf8'), {
    url: 'http://prototype.test/mobile-ios-sales-assistant/pages/mobile-ios.html' + hash,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {};
  // jsdom 不实现 matchMedia；按「未要求减少动效」补桩，欢迎区打字机照常走正常分支。
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (storage) w.localStorage.setItem('sc-v02-feature-pages-v1', storage);
  if (deviceStorage) w.localStorage.setItem('sc-v02-mobile-local-v1', deviceStorage);
  for (const script of doc.querySelectorAll('script[src]')) {
    w.eval(fs.readFileSync(path.resolve(pageDir, script.getAttribute('src').split('?')[0]), 'utf8'));
  }
  return {
    w, doc, errors, F: w.SC.FEATURES,
    view: () => doc.querySelector('[data-view-root]'),
    save: () => JSON.stringify(w.SC.FEATURES.load()),
    device: () => w.localStorage.getItem('sc-v02-mobile-local-v1'),
    /** hashchange 在 jsdom 里是异步派发的，这里直接同步重画一次。 */
    go: hashValue => { w.location.hash = hashValue; w.dispatchEvent(new w.HashChangeEvent('hashchange')); },
    close: () => dom.window.close()
  };
}
const click = (t, selector) => { const node = t.doc.querySelector(selector); assert.ok(node, selector); node.click(); };

test('R09 §4.1 四主入口常驻、本人助手悬浮入口与有权范围内的客户搜索', () => {
  const t = load();
  try {
    // 四个入口固定可用，不再是「下一版开放」
    const entries = [...t.doc.querySelectorAll('[data-nav-item]')].map(node => node.dataset.navItem);
    assert.deepEqual(entries, ['today', 'customers', 'related', 'profile']);
    assert.equal(t.doc.querySelector('#fp-content'), null);
    assert.equal(t.doc.body.textContent.includes('下一版开放'), false, '四入口不应再是占位提示');
    // 四个主入口都能调起本人助手，但入口分工不同：
    // 「今日」由欢迎区自带的「进入聊天助手」承接，其余三个入口用常驻悬浮入口。
    const fab = t.doc.querySelector('.mobile-fab[data-open-assistant]');
    assert.ok(fab, '悬浮入口节点存在');
    const topbar = t.doc.querySelector('[data-topbar]');
    for (const view of ['today', 'customers', 'related', 'profile']) {
      t.go('#/' + view);
      assert.ok(t.doc.querySelector('[data-open-assistant]'), `${view} 入口仍可调起本人助手`);
      assert.equal(fab.hidden, view === 'today', `${view} 悬浮入口显示状态`);
      assert.equal(t.doc.querySelector(`[data-nav-item="${view}"]`).classList.contains('is-active'), true, `${view} 底栏高亮`);
      // 顶栏只放一行标题：今日是日期，其余入口是入口名；身份信息只在「我的 → 账号信息」
      const expected = view === 'today' ? `${Number(t.F.today.slice(5, 7))}月${Number(t.F.today.slice(8, 10))}日` : { customers: '客户', related: '相关', profile: '我的' }[view];
      assert.equal(topbar.textContent.trim(), expected, `${view} 顶栏标题`);
      assert.equal(topbar.querySelectorAll('.t-eyebrow').length, 0, `${view} 顶栏不带身份副标题`);
    }
    // 「今日」的助手入口来自欢迎区，且欢迎区的动态图标与打字机文案保留
    t.go('#/today');
    assert.ok(t.view().querySelector('.ios-welcome .ios-chat-launch'), '欢迎区保留进入聊天助手入口');
    assert.equal(t.view().querySelectorAll('.ios-bear-eye').length, 2, '欢迎区保留动态图标');
    assert.equal(t.view().querySelectorAll('[data-typewriter-line]').length, 2, '欢迎区保留打字机文案');
    // 空间详情不叠加本人助手入口：该场景由概览的空间助手承接
    t.go('#/space/WS-201/overview');
    assert.equal(fab.hidden, true, '空间详情不显示本人助手悬浮入口');
    assert.ok(t.doc.querySelector('[data-open-space-assistant]'), '空间内由空间助手悬浮入口承接问答');
    // 客户入口只展示本人有权空间；搜索不暴露无权客户
    t.go('#/customers');
    const rows = [...t.view().querySelectorAll('[data-space-row]')].map(node => node.dataset.spaceRow);
    assert.deepEqual(rows.sort(), ['WS-201', 'WS-202', 'WS-203', 'WS-204', 'WS-205', 'WS-206'], '只展示本人空间');
    assert.equal(t.view().textContent.includes('WS-207'), false, '不出现其他销售的空间');
    t.go('#/customers?q=' + encodeURIComponent('远山'));
    assert.deepEqual([...t.view().querySelectorAll('[data-space-row]')].map(node => node.dataset.spaceRow), ['WS-202']);
    t.go('#/customers?q=' + encodeURIComponent('某个无权客户'));
    assert.equal(t.view().querySelectorAll('[data-space-row]').length, 0);
    assert.match(t.view().querySelector('.empty-state').textContent, /没有匹配的客户/);
    assert.equal(t.view().textContent.includes('无权'), false, '空结果不提示存在无权客户');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R09 §4.1 今日入口消费与网页端同一份当日快照，收件箱每条只有一个动作', () => {
  const t = load();
  try {
    const list = t.view().querySelector('[data-today-follow]');
    const snapshot = t.F.todaySnapshot(t.F.load(), 'U-1004');
    assert.equal(t.view().querySelectorAll('[data-follow-card]').length, snapshot.entries.length, '与网页端同一份名单');
    assert.equal(list.querySelector('.section-count').textContent, String(snapshot.entries.length));
    for (const label of ['停滞', '有进展', '待决策']) assert.match(list.textContent, new RegExp(label), `名单含${label}`);
    assert.match(list.textContent, /判断依据/, '给出可回溯依据');
    // 条目分工：行内只放识别信息与「一句话说明」，下一步 / 判断依据 / 标记收进展开区
    for (const entry of snapshot.entries) {
      const card = t.view().querySelector(`[data-follow-card][data-space="${entry.space}"]`);
      const head = card.querySelector('[data-follow-toggle]');
      const detail = card.querySelector('[data-follow-detail]');
      assert.ok(head, `${entry.space} 行头可展开`);
      assert.ok(head.textContent.includes(entry.customer) && head.textContent.includes(entry.status), '行内含客户与状态');
      assert.ok(head.textContent.includes(entry.summary), '行内含一句话说明');
      assert.equal(head.textContent.includes(entry.action), false, '下一步不占行内');
      assert.match(detail.textContent, /下一步/, '展开区标注下一步');
      assert.equal(detail.textContent.includes('转写'), false, '依据只给出处与时间，不标转写状态');
      assert.ok(detail.textContent.includes(entry.action), '展开区含动作建议');
      assert.equal(card.classList.contains('is-expanded'), false, '默认收起');
      // 点行头展开；在展开区点依据不会把卡片收回去
      head.click();
      assert.equal(card.classList.contains('is-expanded'), true, '点行头展开');
      assert.equal(head.getAttribute('aria-expanded'), 'true');
      detail.querySelector('.evidence-list li').click();
      assert.equal(card.classList.contains('is-expanded'), true, '点依据不收起');
      head.click();
      assert.equal(card.classList.contains('is-expanded'), false, '再点行头收起');
      assert.equal(head.getAttribute('aria-expanded'), 'false');
      // 标记入口：星标与暂不跟进各一个按钮，落在展开区右下角的分组里
      const marks = detail.querySelector('.follow-marks');
      assert.ok(marks, '展开区带标记入口');
      const starButton = marks.querySelector('button[data-mark-action="star"], button[data-mark-action="unstar"]');
      const pauseButton = marks.querySelector('button[data-mark-action="pause"]');
      assert.ok(starButton && pauseButton, '星标与暂不跟进分成两个按钮');
      assert.equal(pauseButton.textContent.trim(), '暂不跟进');
      assert.equal(starButton.textContent.trim(), starButton.dataset.markAction === 'unstar' ? '取消星标' : '星标', '星标按钮反映当前状态');
    }
    // 本周经营：与网页端销售目标看板同一份取数；DataHub 不可用时不给模拟达成
    const board = t.F.myGoalBoard('U-1004', t.F.load());
    assert.match(t.view().textContent, new RegExp(String(board.revenueAchieved.toLocaleString('zh-CN'))), '本周流水与网页端同一份取数');
    assert.match(t.view().textContent, /数据截至 2026-09-15 06:30/);
    const broken = load('#/today', JSON.stringify((() => {
      const state = t.F.load();
      state.datahub = { ...state.datahub, status: 'failed', failReason: '接口连续超时' };
      return state;
    })()));
    try {
      assert.match(broken.view().textContent, /DataHub 最近一次取数失败/);
      assert.match(broken.view().textContent, /不提供模拟达成/);
      assert.equal(broken.view().querySelector('.ios-performance-track').textContent.includes('%'), false, '取数失败时不给达成比例');
    } finally { broken.close(); }
    // 收件箱：未读优先、带计数、每条只有一个动作，不装全员广播
    const inbox = t.view().querySelector('[data-inbox]');
    const items = [...inbox.querySelectorAll('[data-inbox-item]')];
    assert.ok(items.length > 0);
    const firstRead = items.findIndex(item => item.dataset.status === 'done');
    const lastUnread = items.map(item => item.dataset.status).lastIndexOf('pending');
    assert.ok(firstRead === -1 || firstRead > lastUnread, '未读排在已读之前');
    items.forEach(item => assert.ok(item.querySelectorAll('.detail-actions a, .detail-actions button').length <= 1, '条目只提供一个动作'));
    assert.equal(inbox.textContent.includes('生成待办'), false, '不提供第二个动作');
    assert.equal(inbox.textContent.includes('全员适用'), false, '不装全员广播类内容');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R13 §4.2 今天该跟的标记入口：星标一键开或关，暂不跟进必填原因、可改可取消', () => {
  const t = load();
  const card = (space) => t.view().querySelector(`[data-follow-card][data-space="${space}"]`);
  const markButtons = (space) => [...card(space).querySelectorAll('.follow-marks button')];
  const chips = (space) => [...card(space).querySelectorAll('.list-title-line .follow-status')].map(node => node.textContent.trim());
  const liveMark = (space) => t.F.activeMarks(t.F.load(), 'U-1004').find(item => item.space === space);
  try {
    // 两个按钮固定在展开区右下角的分组里；星标按当前状态显示开或关（M07-1 §4.2-2）
    assert.deepEqual(markButtons('WS-201').map(btn => btn.textContent.trim()), ['星标', '暂不跟进']);
    assert.deepEqual(markButtons('WS-202').map(btn => btn.textContent.trim()), ['取消星标', '暂不跟进'], '已星标的空间显示取消星标');
    assert.deepEqual(chips('WS-202'), ['星标'], '行内角标反映生效中的标记');
    markButtons('WS-201')[0].click();
    assert.equal(liveMark('WS-201').starred, true, '星标记下');
    assert.equal(liveMark('WS-201').log[0].action, '星标');
    assert.deepEqual(chips('WS-201'), ['星标'], '行内出现星标角标');
    assert.deepEqual(markButtons('WS-201').map(btn => btn.textContent.trim()), ['取消星标', '暂不跟进']);
    markButtons('WS-201')[0].click();
    assert.equal(liveMark('WS-201'), undefined, '取消星标后不再是有效信号');
    assert.deepEqual(chips('WS-201'), []);

    // 暂不跟进：表单必填原因、结束日选填；已有标记时带出原值并可取消（§4.2-3/4）
    assert.deepEqual(chips('WS-203'), ['暂不跟进'], '生效中的暂不跟进在行内可见');
    markButtons('WS-203')[1].click();
    const form = t.doc.querySelector('[data-pause-form]');
    assert.ok(form, '暂不跟进表单打开');
    assert.ok(form.elements.reason && form.elements.until, '原因与结束日都在表单里');
    assert.equal(form.elements.reason.value, '客户采购流程暂停，预计月底恢复', '带出原原因');
    assert.equal(form.elements.until.value, '2026-09-30', '带出原结束日');
    assert.ok(t.doc.querySelector('[data-cancel-pause]'), '已有标记时提供取消');
    form.elements.reason.value = '';
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.match(t.doc.querySelector('[data-write-error]').textContent, /原因/, '不填原因被阻止');
    assert.equal(liveMark('WS-203').pause.reason, '客户采购流程暂停，预计月底恢复', '未写入，保留原值');
    form.elements.reason.value = '预算走年度框架，改到下季度再跟';
    form.elements.until.value = '2026-10-31';
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(liveMark('WS-203').pause.reason, '预算走年度框架，改到下季度再跟', '可改原因');
    assert.equal(liveMark('WS-203').pause.until, '2026-10-31', '可改结束日');

    // 取消暂不跟进：结束日已过的标记本就不再作为信号（§4.2-7）
    assert.equal(t.view().querySelectorAll('[data-follow-card]').length, t.F.todaySnapshot(t.F.load(), 'U-1004').entries.length, '标记不改当天名单');
    assert.equal(liveMark('WS-204'), undefined, '结束日已过不再作为信号');
    assert.deepEqual(chips('WS-204'), []);
    markButtons('WS-203')[1].click();
    t.doc.querySelector('[data-cancel-pause]').click();
    assert.equal(liveMark('WS-203'), undefined, '取消后不再是有效信号');
    assert.deepEqual(chips('WS-203'), []);
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R09 §4.2 五 Tab 常驻、默认落地概览、折叠区不记忆、深链高亮与冻结只读', () => {
  const t = load('#/space/WS-201/overview');
  try {
    assert.deepEqual([...t.view().querySelectorAll('[data-tab]')].map(node => node.dataset.tab), ['overview', 'customer', 'opps', 'followup', 'documents']);
    assert.ok(t.view().querySelector('[data-space-tab="overview"]'), '默认落地概览');
    const chrome = t.view().querySelector('.space-chrome');
    assert.ok(chrome && chrome.querySelector('[data-space-topbar]') && chrome.querySelector('[data-tab]'), '顶栏与五 Tab 收在吸顶区');
    assert.equal(chrome.contains(t.view().querySelector('[data-space-tab="overview"]')), false, '正文不进吸顶区');
    // 常显区（去卡片化分区）：指标条在最上方，随后一句话判断、客户画像、关键人、风险标记、当前卡点、最近动静
    const sections = [...t.view().querySelectorAll('.space-body > .ov-section')];
    assert.ok(sections.length >= 7, '常显区分区齐全');
    assert.ok(sections[0].hasAttribute('data-overview-metrics'), '指标条在概览最上方');
    assert.ok(t.view().querySelector('[data-overview-panel="verdict"]'));
    assert.ok(t.view().querySelector('[data-overview-panel="who"]'), '客户画像常显');
    const whoLead = t.view().querySelector('[data-overview-panel="who"] > .t-body');
    assert.equal(whoLead && whoLead.textContent.trim(), '星辰科技有限公司', '客户画像标题下只保留客户名');
    assert.equal(whoLead.textContent.includes('·'), false, '客户名后不跟行业或客户池');
    assert.ok(t.view().querySelector('[data-overview-panel="blocker"]'));
    assert.ok(t.view().querySelector('[data-overview-panel="people"]'));
    assert.ok(t.view().querySelector('[data-overview-panel="risk"]'), '风险标记常显');
    assert.ok(t.view().querySelector('[data-overview-panel="recent"]'));
    assert.equal(t.view().querySelector('[data-space-tab="overview"] [data-source]'), null, '概览不再展示溯源胶囊');
    assert.equal(t.view().querySelector('[data-space-tab="overview"] [data-source-broken]'), null, '概览不再展示失效来源标记');
    // 空间助手：可移动悬浮图标唤出自下而上 4/5 屏抽屉，抽屉内复刻本人助手的条目式对话
    t.w.FN_FAST = true;
    const qaFab = t.doc.querySelector('[data-open-space-assistant]');
    assert.ok(qaFab && !qaFab.hidden, '空间助手悬浮入口');
    qaFab.click();
    const qaSheet = t.doc.querySelector('.rec-sheet [data-space-qa]');
    assert.ok(qaSheet, '唤出空间助手抽屉');
    assert.ok(qaSheet.querySelectorAll('[data-ask]').length >= 3, '空会话给出预设问题引导');
    assert.ok(t.doc.querySelector('.rec-sheet [data-qa-field]'), '抽屉内可直接提问');
    qaSheet.querySelector('[data-ask]').click();
    const answered = t.doc.querySelector('.rec-sheet [data-qa-item]');
    assert.ok(answered, '预设问题在抽屉内得到回答');
    assert.equal(answered.querySelector('[data-source]'), null, '空间助手答案不再带溯源胶囊');
    assert.ok(answered.querySelector('[data-qa-cite]'), '答案依据以脚注形式呈现');
    const qaField = t.doc.querySelector('[data-qa-field]');
    qaField.value = '当前卡点是什么？';
    t.doc.querySelector('[data-qa-send]').click();
    assert.ok(t.doc.querySelectorAll('.rec-sheet [data-qa-item]').length >= 2, '自由提问走同一条作答链路');
    t.doc.querySelector('.rec-sheet [data-sheet-close]').click();
    // 更新入口：顶栏右上角图标，有更新时红点；点击唤出更新面板（最近一次变化 + 全量更新历史）
    const entry = t.view().querySelector('[data-open-updates]');
    assert.ok(entry, '顶栏右上角更新入口');
    assert.ok(entry.classList.contains('has-unread'), '有更新时红点提示');
    entry.click();
    const panel = t.doc.querySelector('[data-updates-panel]');
    assert.ok(panel, '点击图标唤出更新面板');
    const nodes = [...panel.querySelectorAll('[data-history-node]')];
    assert.ok(nodes.length >= 4, '更新历史节点全量保留');
    assert.ok(nodes.some((node) => node.dataset.nodeStatus === 'processing'), '处理中节点如实展示');
    assert.ok(panel.querySelector('[data-history-node] [data-open-change]'), '有变化节点可进本次变化详情');
    // 更新卡顶部：受影响计数与「查看本次变化」同一行，入口贴右侧，不再单独占一行
    const status = panel.querySelector('[data-updates-status="changed"]');
    const statusHead = status.querySelector('.updates-status-head');
    assert.match(statusHead.querySelector('.t-body').textContent, /^受影响：/, '受影响计数在左');
    assert.equal(statusHead.querySelector('[data-open-change]').className, 'source-chip', '查看本次变化是行内小入口');
    assert.equal(statusHead.lastElementChild.dataset.openChange, statusHead.querySelector('[data-open-change]').dataset.openChange, '入口是这一行的最后一个元素（贴右）');
    assert.equal(status.querySelector('.detail-actions'), null, '入口不再单独占一行');
    assert.equal(status.querySelectorAll('p').length, 2, '卡片仍是摘要 + 来源时间两行文本');
    assert.ok(!entry.classList.contains('has-unread'), '打开面板后红点消除');
    t.doc.querySelector('.rec-sheet-mask [data-sheet-close]').click();
    // 折叠区默认收起；展开后切走再切回仍是收起
    const folds = [...t.view().querySelectorAll('[data-fold]')];
    assert.deepEqual(folds.map((node) => node.dataset.fold), ['basics', 'opportunity', 'pending', 'co-followers'], '折叠区板块齐全');
    assert.ok(folds.every(node => !node.open), '折叠区默认收起');
    folds[0].open = true;
    t.go('#/space/WS-201/customer');
    t.go('#/space/WS-201/overview');
    assert.ok([...t.view().querySelectorAll('[data-fold]')].every(node => !node.open), '重新进入仍为收起，不记忆');
    assert.equal(t.view().querySelector('[data-overview-panel="people"] [data-deeplink]'), null, '概览关键人分区不再提供查看明细跳转');
    assert.equal(t.view().querySelector('[data-space-tab="overview"]').textContent.includes('查看明细'), false, '概览不出现查看明细');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  // 空间跟进 → 录音：查看原文走自底向上约 4/5 屏弹层，可切智能总结 / 原文转录
  const recs = load('#/space/WS-201/followup/recordings');
  try {
    const open = recs.view().querySelector('[data-placement-row] [data-open-space-recording]');
    assert.ok(open, '归位录音提供查看原文');
    // 移动端不跟转写线：录音区不出现转写状态或说明（转写与智能总结由远端同步，本系统不设转写阶段）
    assert.equal(recs.view().textContent.includes('转写'), false, '录音区不出现转写标记');
    assert.equal(recs.view().querySelector('[data-placement-row] [data-transcribe-note]'), null, '不再放等待转写的说明');
    assert.equal(recs.view().querySelector('[data-placement-row] [data-source^="meeting:"]'), null, '录音不再走通用原文弹层');
    open.click();
    const sheet = recs.doc.querySelector('.rec-sheet');
    assert.ok(sheet, '打开空间录音底部弹层');
    assert.equal(recs.doc.querySelector('.rec-drawer'), null, '不复用录音管理右侧抽屉');
    assert.equal(recs.doc.querySelector('.sheet, .sheet-mask, .sheet-head, .sheet-body'), null, '全站只有一套抽屉外壳，不再有短弹层');
    assert.ok(sheet.querySelector('[data-rec-sheet-tab="summary"].is-active'), '默认智能总结');
    assert.equal(sheet.querySelector('[data-rec-sheet-pane="summary"]').hidden, false);
    assert.equal(sheet.querySelector('[data-rec-sheet-pane="transcript"]').hidden, true);
    recs.doc.querySelector('[data-rec-sheet-tab="transcript"]').click();
    assert.ok(recs.doc.querySelector('[data-rec-sheet-tab="transcript"].is-active'), '可切到原文转录');
    assert.equal(recs.doc.querySelector('[data-rec-sheet-pane="transcript"]').hidden, false);
    recs.doc.querySelector('.rec-sheet [data-sheet-close]').click();
    assert.ok(recs.doc.querySelector('.rec-sheet-mask.is-closing'), '关闭后弹层开始滑出');
    assert.deepEqual(recs.errors, []);
  } finally { recs.close(); }

  // 归位后客户信息尚未落地：只显示「客户信息更新中」，不出现任何转写标记
  const waiting = load('#/space/WS-203/followup/recordings');
  try {
    const row = waiting.view().querySelector('[data-placement-row="PL-102"]');
    assert.ok(row, '启明的采购预算录音归位可见');
    assert.equal(row.dataset.placementStatus, 'updating', '归位后直接进入客户信息更新，没有等待转写的中间态');
    assert.equal(row.querySelector('.state-chip').textContent.trim(), '客户信息更新中', '销售侧只看到客户信息更新中');
    assert.equal(waiting.view().textContent.includes('转写'), false, '不出现任何转写标记与说明');
    assert.deepEqual(waiting.errors, []);
  } finally { waiting.close(); }

  // 冻结空间：可进入、五 Tab 可读、无写入入口、快捷问答禁用
  const frozen = load('#/space/WS-206/followup');
  try {
    assert.ok(frozen.view().querySelector('[data-frozen-note]'), '顶部标注冻结');
    assert.equal(frozen.view().querySelector('[data-write]'), null, '不提供任何写入入口');
    assert.equal(frozen.view().querySelector('[data-write-actions]'), null, '跟进 Tab 不再放写入按钮条');
    frozen.go('#/space/WS-206/overview');
    const frozenFab = frozen.doc.querySelector('[data-open-space-assistant]');
    assert.ok(frozenFab && !frozenFab.hidden, '冻结空间仍保留空间助手入口');
    frozenFab.click();
    assert.ok(frozen.doc.querySelector('.rec-sheet [data-qa-frozen]'), '冻结后不开放新问答');
    assert.equal(frozen.doc.querySelector('.rec-sheet [data-qa-field]'), null, '冻结后抽屉内无提问输入区');
    frozen.doc.querySelector('.rec-sheet [data-sheet-close]').click();
    assert.deepEqual(frozen.errors, []);
  } finally { frozen.close(); }
});

test('R09 §4.3 跟进 Tab 不再放写跟进/周复盘入口；仅客户级确权仍可读客户内容', () => {
  const t = load('#/space/WS-201/followup');
  try {
    assert.equal(t.view().querySelector('[data-write="followup"]'), null, '跟进 Tab 不再放写跟进记录');
    assert.equal(t.view().querySelector('[data-write="weekly"]'), null, '跟进 Tab 不再放写周复盘');
    assert.equal(t.view().querySelector('[data-write-actions]'), null, '写入按钮条已移除，列表顶到分类下');
    assert.ok(t.view().querySelector('[data-space-tab="followup"] .list'), '跟进内容直接跟在分类后');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  const solutions = load('#/space/WS-201/followup/solutions');
  try {
    assert.equal(solutions.view().querySelector('[data-write="followup"]'), null);
    assert.equal(solutions.view().querySelector('[data-write="weekly"]'), null);
    assert.ok(solutions.view().querySelector('[data-reply-solution]'), '方案往来仍可回复一次');
    const files = [...solutions.view().querySelectorAll('[data-solution="SL-101"] [data-open-solution-file]')].map((node) => node.textContent);
    assert.ok(files.some((text) => /\.docx/i.test(text)), '展示 Word');
    assert.ok(files.some((text) => /\.pdf/i.test(text)), '展示 PDF');
    assert.ok(files.some((text) => /\.pptx/i.test(text)), '展示 PPT');
    assert.ok(files.some((text) => /\.md/i.test(text)), '展示 Markdown');
    assert.ok(files.some((text) => /\.xlsx/i.test(text)), '展示 Excel');
    solutions.view().querySelector('[data-open-solution-file]').click();
    assert.ok(solutions.doc.querySelector('[data-file-preview]'), '点附件打开预览');
    assert.deepEqual(solutions.errors, []);
  } finally { solutions.close(); }

  // 仅客户级确权：客户内容可看，跟进 Tab 也没有写入按钮
  const ownerOnly = load('#/space/WS-205/followup');
  try {
    assert.equal(ownerOnly.view().querySelector('[data-write]'), null, '无商机空间也不再暴露写入入口');
    ownerOnly.go('#/space/WS-205/customer');
    assert.match(ownerOnly.view().textContent, /海川保险/, '客户级内容照常查看');
    assert.deepEqual(ownerOnly.errors, []);
  } finally { ownerOnly.close(); }
});

test('R09 §4.4 收件箱进空间、离线只读与草稿、并发先提交为准', () => {
  // 收件箱条目直达对应那次变化，而不是只打开空间首页
  const inbox = load();
  try {
    const item = inbox.view().querySelector('[data-inbox-item] [data-inbox-enter]');
    assert.ok(item, '条目提供进客户空间');
    const changeItem = [...inbox.view().querySelectorAll('[data-inbox-enter]')].find(node => node.getAttribute('href').includes('change='));
    assert.ok(changeItem, '客户更新提醒带本次变化落点');
    inbox.go(changeItem.getAttribute('href').replace('#', '#'));
    assert.ok(inbox.doc.querySelector('[data-change-detail]'), '直达本次变化详情');
    assert.ok(inbox.doc.querySelector('.rec-sheet-mask > .rec-sheet > .rec-sheet-body[data-change-detail]'), '本次变化走统一的 4/5 屏抽屉');
    assert.equal(inbox.doc.querySelector('.sheet, .sheet-mask, .sheet-head, .sheet-body'), null, '不再有旧的短弹层外壳');
    assert.deepEqual(inbox.errors, []);
  } finally { inbox.close(); }

  // 离线：最近打开过的空间只读可看，未缓存的如实提示需要联网
  const device = JSON.stringify({ offline: true, cached: ['WS-201'], drafts: [] });
  const offline = load('#/space/WS-201/overview', undefined, device);
  try {
    assert.ok(offline.view().querySelector('[data-offline-note]'), '标明离线内容与最后更新时间');
    offline.go('#/space/WS-203/overview');
    assert.match(offline.view().textContent, /离线状态下无法打开这个空间/, '未缓存空间提示需要联网');
    // 跟进 Tab 已去掉写入口；离线空间仍只读可看，不从该页新增草稿
    offline.go('#/space/WS-201/followup');
    assert.equal(offline.view().querySelector('[data-write]'), null, '离线跟进页也没有写跟进/周复盘按钮');
    assert.equal(offline.F.load().followups.some(item => item.text.startsWith('地库里')), false, '没有从该页写入业务数据');
    assert.deepEqual(offline.errors, []);
  } finally { offline.close(); }

  // 并发：另一端已先提交时给冲突提示，保留输入并转为冲突待处理
  const concurrent = load('#/space/WS-201/followup');
  try {
    const stale = concurrent.F.writeBaseline(concurrent.F.space('WS-201'));
    concurrent.F.addFollowup('WS-201', { opportunityId: 'OP-301', type: '电话沟通', text: '工位上先提交的一条跟进记录。', next: '' });
    assert.throws(() => concurrent.F.addFollowup('WS-201', { opportunityId: 'OP-301', type: '电话沟通', text: '手机上后提交的一条。', next: '', baseVersion: stale }), /先提交为准/);
    assert.equal(concurrent.F.load().followups.filter(item => item.text.startsWith('手机上后提交')).length, 0, '不静默覆盖');
    assert.deepEqual(concurrent.errors, []);
  } finally { concurrent.close(); }

  // 跟进 Tab 已去掉写入口，不再从该页重复提交
  const once = load('#/space/WS-202/followup');
  try {
    assert.equal(once.view().querySelector('[data-write]'), null, '跟进页没有提交按钮');
    assert.deepEqual(once.errors, []);
  } finally { once.close(); }
});

test('R09 相关与我的：录音管理二级页、推送渠道口径与草稿不自动提交', () => {
  const related = load('#/related');
  try {
    // 「相关」只承载入口：录音管理的列表与归位操作收进可回退的二级页
    const entry = related.view().querySelector('[data-related-entry="recordings"]');
    assert.ok(entry, '录音管理作为入口出现在「相关」');
    assert.match(entry.textContent, /录音管理/);
    assert.match(entry.textContent, /待归位/, '入口提示待归位数量');
    assert.equal(entry.getAttribute('href'), '#/related/recordings', '入口直达录音管理二级页');
    assert.equal(related.view().querySelector('[data-recording]'), null, '入口页不直接铺录音列表');
    assert.equal(related.view().querySelector('[data-place-recording]'), null, '归位操作不在入口页出现');
    assert.equal(related.view().querySelector('[data-upload-recording], [data-record-audio], input[type="file"]'), null, '不提供手动上传与应用内录制入口');

    // 进入录音管理二级页：页内顶栏带返回，底栏仍高亮「相关」（jsdom 的 hashchange 异步派发，用 go 同步重画）
    related.go('#/related/recordings');
    assert.ok(related.view().querySelector('[data-recordings]'), '进入录音管理二级页');
    assert.ok(related.view().querySelector('[data-back]'), '二级页提供返回');
    assert.equal(related.doc.querySelector('[data-nav-item="related"]').classList.contains('is-active'), true, '二级页保留「相关」底栏高亮');
    assert.ok(related.view().querySelector('[data-recording="MT-101"]'), '本人录音进入录音管理');
    assert.equal(related.view().querySelector('[data-recording="MT-107"]'), null, '其他销售的录音不可见');
    assert.equal(related.view().textContent.includes('转写'), false, '不出现本地转写标记');
    assert.ok(related.view().querySelector('[data-rec-tab="open"].is-active'), '默认落在未处理');
    assert.ok(related.view().querySelector('[data-pull-recordings]'), '未处理提供拉取');
    assert.ok(related.view().querySelector('.rec-card[data-recording="MT-101"]'), '录音以卡片呈现');
    const placeMark = related.view().querySelector('[data-place-recording="MT-101"]');
    assert.ok(placeMark, '未处理卡片提供归位标记');
    assert.match(placeMark.textContent.trim(), /^归位$/);
    assert.equal(placeMark.classList.contains('btn-primary'), false, '归位不用蓝白主按钮');
    // 点卡片打开智能总结抽屉，可切到原文转录
    click(related, '[data-open-recording="MT-101"]');
    const drawer = related.doc.querySelector('.rec-drawer');
    assert.ok(drawer, '从右侧打开录音内容抽屉');
    assert.equal(related.doc.querySelectorAll('.rec-drawer .back-button').length, 1, '抽屉只保留自己的返回');
    assert.ok(drawer.querySelector('[data-rec-pane-tab="summary"].is-active'), '默认智能总结');
    assert.equal(drawer.querySelector('[data-rec-pane="summary"]').hidden, false);
    assert.equal(drawer.querySelector('[data-rec-pane="transcript"]').hidden, true);
    click(related, '[data-rec-pane-tab="transcript"]');
    assert.ok(related.doc.querySelector('[data-rec-pane-tab="transcript"].is-active'), '可切到原文转录');
    assert.equal(related.doc.querySelector('[data-rec-pane="transcript"]').hidden, false);
    related.doc.querySelector('.rec-drawer [data-sheet-close]').click();
    assert.ok(related.doc.querySelector('.rec-drawer-mask.is-closing'), '返回后抽屉开始滑出');
    // 归位入口沿用 R10 校验：多商机不代选
    click(related, '[data-place-recording="MT-101"]');
    const form = related.doc.querySelector('[data-place-form]');
    assert.ok(form, '归位表单打开');
    assert.ok(form.elements.opportunityId, '必须选择商机');
    related.doc.querySelector('[data-sheet-close]').click();
    // 未处理拉取：第一次写入增量，第二次提示无新增
    click(related, '[data-pull-recordings]');
    assert.ok(related.view().querySelector('[data-recording="MT-201"]'), '增量录音进入未处理');
    assert.match(related.doc.querySelector('[data-toast-message]').textContent, /已新同步2条录音内容/);
    click(related, '[data-pull-recordings]');
    assert.match(related.doc.querySelector('[data-toast-message]').textContent, /未发现新增录音/);
    // 切到已处理：已归位录音在此，拉取入口收起
    click(related, '[data-rec-tab="done"]');
    assert.equal(related.view().querySelector('[data-recording="MT-102"]').hidden, false, '已处理可见已归位录音');
    assert.equal(related.view().querySelector('[data-recording="MT-101"]').hidden, true, '未处理卡片在已处理 Tab 隐藏');
    assert.equal(related.view().querySelector('[data-pull-recordings]').hidden, true, '已处理不展示拉取');

    // 二级页可回退到「相关」入口
    click(related, '[data-back]');
    assert.ok(related.view().querySelector('[data-related]'), '返回到「相关」入口页');
    assert.ok(related.view().querySelector('[data-related-entry="recordings"]'), '入口仍在');
    assert.deepEqual(related.errors, []);
  } finally { related.close(); }

  const profile = load('#/profile', undefined, JSON.stringify({ offline: false, cached: [], drafts: [{ id: 'DRAFT-1', space: 'WS-201', kind: 'followup', values: { text: '离线时写下的草稿。' }, savedAt: '2026-09-21 09:00', status: 'draft' }] }));
  try {
    // 推送只有一条渠道：页面只陈述渠道本身，不再解释「本版不提供渠道偏好设置」
    assert.match(profile.view().textContent, /推送渠道\s*移动端推送/);
    assert.equal(profile.view().querySelector('[data-push-channel-pref]'), null, '不提供渠道偏好设置入口');
    assert.match(profile.view().textContent, /企业内部安装包/);
    assert.ok(profile.view().querySelector('[data-draft="DRAFT-1"]'), '待确认草稿可见');
    assert.match(profile.view().querySelector('[data-draft="DRAFT-1"]').textContent, /待本人确认/, '草稿标注待本人确认');
    assert.ok(profile.view().querySelector('[data-draft="DRAFT-1"] a[href="#/space/WS-201/followup"]'), '草稿需由本人去核对并提交');
    assert.equal(profile.F.load().followups.some(item => item.text === '离线时写下的草稿。'), false, '草稿不自动提交');
    assert.deepEqual(profile.errors, []);
  } finally { profile.close(); }
});

test('R09 §4.1 客户入口与客户空间之间的左右滑动转场（推入 / 弹出与收尾）', () => {
  const t = load('#/customers');
  try {
    // 转场只在具备 CSS 动画能力的环境执行；jsdom 没有 CSS.supports，这里补桩以覆盖动画分支
    t.w.CSS = { supports: () => true };
    const frame = t.doc.querySelector('.mobile-frame');
    assert.equal(t.doc.querySelectorAll('.view-transition-layer').length, 0, '转场前没有垫层');

    // 客户入口 → 客户空间：新页从右侧推入，旧页快照向左让位
    t.go('#/space/WS-201/overview');
    assert.ok(t.view().querySelector('[data-space-view="WS-201"]'), '真实 DOM 立刻切到空间详情');
    assert.equal(frame.classList.contains('is-entering-forward'), true, '新页走推入动画');
    const forward = t.doc.querySelector('.view-transition-layer');
    assert.ok(forward, '推入时留有旧页垫层');
    assert.equal(forward.classList.contains('is-leaving-forward'), true, '旧页向左让位');
    assert.ok(forward.querySelector('[data-space-row="WS-201"]'), '垫层是客户入口的快照');
    assert.equal(forward.querySelector('[data-view-root], [data-topbar]'), null, '垫层不重复当前视图钩子');
    assert.equal(t.doc.querySelectorAll('[data-view-root]').length, 1, '页面上始终只有一个当前视图');

    // 收尾：垫层与动画类都要清掉，避免残影挡住新页
    forward.dispatchEvent(new t.w.Event('animationend'));
    assert.equal(t.doc.querySelector('.view-transition-layer'), null, '动画结束移除垫层');
    assert.equal(frame.className.includes('is-entering'), false, '动画结束清掉转场类');

    // 客户空间 → 返回客户入口：新页从左侧归位，旧页向右退出
    click(t, '[data-back]');
    assert.ok(t.view().querySelector('[data-customers]'), '真实 DOM 立刻回到客户入口');
    assert.equal(frame.classList.contains('is-entering-back'), true, '新页走弹出动画');
    const back = t.doc.querySelector('.view-transition-layer');
    assert.equal(back.classList.contains('is-leaving-back'), true, '旧页向右退出');
    assert.ok(back.querySelector('[data-space-view="WS-201"]'), '垫层是空间详情的快照');
    back.dispatchEvent(new t.w.Event('animationend'));
    assert.equal(t.doc.querySelector('.view-transition-layer'), null, '返回动画收尾后移除垫层');

    // 主入口之间换页（客户 → 今日）不做横向转场，与底栏换页一致
    click(t, '[data-nav-item="today"]');
    assert.equal(t.doc.querySelector('.view-transition-layer'), null, '主入口之间不产生垫层');
    assert.equal(frame.className.includes('is-entering'), false, '主入口之间不做转场');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R09 §4.1 无动画能力的环境直接同步切换，不留垫层', () => {
  const t = load('#/customers');
  try {
    // 无 CSS 动画能力（jsdom 默认）时必须一步切到终态，其余回归断言才能同步读到结果
    delete t.w.CSS;
    t.go('#/space/WS-201/overview');
    assert.ok(t.view().querySelector('[data-space-view="WS-201"]'), '空间详情立即可见');
    assert.equal(t.doc.querySelector('.view-transition-layer'), null, '不建垫层');
    assert.equal(t.doc.querySelector('.mobile-frame').className.includes('is-entering'), false, '不加转场类');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R09 底部抽屉统一：自底向上占 4/5 屏，阅读层与表单共用一套外壳', () => {
  const SHELL = '.sheet, .sheet-mask, .sheet-head, .sheet-body';
  // 阅读层：跟进记录「查看原文」
  const t = load('#/space/WS-201/followup/followups');
  try {
    t.view().querySelector('[data-source="followup:FU-0"]').click();
    assert.equal(t.doc.querySelectorAll('.rec-sheet-mask').length, 1, '原文抽屉打开');
    const drawer = t.doc.querySelector('.rec-sheet-mask .rec-sheet');
    assert.ok(drawer, '抽屉外壳是 .rec-sheet');
    assert.ok(drawer.querySelector(':scope > .rec-sheet-head') && drawer.querySelector(':scope > .rec-sheet-body'), '外壳结构：标题区 + 内容区');
    assert.ok(drawer.querySelector('.rec-sheet-body [data-source-body]'), '内容落在抽屉里');
    assert.equal(t.doc.querySelector(SHELL), null, '不再存在第二套短弹层外壳');
    t.doc.querySelector('.rec-sheet [data-sheet-close]').click();
    assert.ok(t.doc.querySelector('.rec-sheet-mask.is-closing'), '关闭时向下滑出');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  // 表单层：今日 → 今天该跟「暂不跟进」
  const forms = load();
  try {
    forms.view().querySelector('[data-follow-card][data-space="WS-203"] .follow-marks button[data-mark-action="pause"]').click();
    assert.ok(forms.doc.querySelector('.rec-sheet-mask .rec-sheet [data-pause-form]'), '表单也走同一个抽屉');
    assert.equal(forms.doc.querySelector(SHELL), null);
    forms.doc.querySelector('.rec-sheet [data-sheet-close]').click();
    assert.deepEqual(forms.errors, []);
  } finally { forms.close(); }

  // 叠层：抽屉里看原文时后开的叠在上面，关掉回到下面那层
  const nested = load('#/space/WS-201/overview');
  // 关闭动画期间节点仍在 DOM，这里只统计没有 is-closing 的层
  const live = () => [...nested.doc.querySelectorAll('.rec-sheet-mask')].filter((node) => !node.classList.contains('is-closing'));
  try {
    click(nested, '[data-open-updates]');
    const panel = nested.doc.querySelector('[data-updates-panel]');
    assert.ok(panel, '空间更新抽屉打开');
    assert.equal(live().length, 1);
    panel.querySelector('[data-source]').click();
    assert.equal(live().length, 2, '原文叠在空间更新之上');
    assert.ok(live()[1].querySelector('[data-source-body]'), '上层是原文抽屉');
    live()[1].querySelector('[data-sheet-close]').click();
    assert.equal(live().length, 1, '关掉上层后回到空间更新');
    assert.ok(nested.doc.querySelector('[data-updates-panel]'), '下层仍是空间更新面板');
    // 更新面板进本次变化：叠在空间更新之上，关闭回退而不是整栈关掉
    nested.doc.querySelector('[data-updates-panel] [data-open-change]').click();
    assert.equal(live().length, 2, '本次变化叠在空间更新之上');
    assert.ok(live()[1].querySelector('[data-change-detail]'), '上层是本次变化详情');
    assert.ok(nested.doc.querySelector('[data-updates-panel]'), '下层空间更新仍在');
    live()[1].querySelector('[data-sheet-close]').click();
    assert.equal(live().length, 1, '关掉本次变化后回到空间更新');
    assert.ok(live()[0].querySelector('[data-updates-panel]'), '关闭后仍是空间更新面板');
    assert.equal(live()[0].querySelector('[data-change-detail]'), null, '可见层不再是本次变化');
    // 换页收起所有抽屉，包括叠层与正在滑出的层
    nested.go('#/customers');
    assert.equal(nested.doc.querySelectorAll('.rec-sheet-mask').length, 0, '换页收起全部抽屉');
    assert.deepEqual(nested.errors, []);
  } finally { nested.close(); }
});

test('R10 §4.2 空间侧归位：行内查看详情与归位到本空间，商机不在挑录音抽屉里选', () => {
  // 入口：本页右上角一个小按钮（全量录音在挑录音抽屉里呈现）
  const t = load('#/space/WS-201/followup/recordings');
  const live = (inst) => [...inst.doc.querySelectorAll('.rec-sheet-mask')].filter((node) => !node.classList.contains('is-closing'));
  try {
    const entry = t.view().querySelector('.rec-actions');
    assert.ok(entry, '录音区带入口');
    assert.ok(entry.querySelector('[data-place-here].rec-place'), '归位入口是安静的小按钮');
    assert.equal(entry.textContent.trim(), '归位录音', '只保留一个入口');
    assert.equal(entry.querySelectorAll('a, button').length, 1, '不再并列第二个入口');
    // 挑录音：只列未处理（尚无有效归位）的本人录音，与录音管理「未处理」同一口径；抽屉里不再有商机选择
    click(t, '[data-place-here]');
    const picker = t.doc.querySelector('.rec-sheet-mask .rec-sheet');
    assert.ok(picker, '挑录音走统一 4/5 抽屉');
    assert.equal(picker.querySelector('select, [data-place-here-form]'), null, '抽屉里不再放商机选择');
    assert.equal(picker.textContent.includes('转写'), false, '挑录音抽屉的元信息也不带转写线');
    assert.match(picker.querySelector('.rec-sheet-copy').textContent, /条未处理/, '标题标明只列未处理');
    const rows = [...picker.querySelectorAll('[data-place-candidate]')];
    const ids = rows.map((row) => row.dataset.placeCandidate);
    assert.ok(ids.includes('MT-101'), '未归位的录音可选');
    assert.ok(ids.includes('MT-106'), '同步失败、尚未归位的如实列出');
    for (const placed of ['MT-102', 'MT-103', 'MT-104', 'MT-105']) {
      assert.equal(ids.includes(placed), false, `已归位的 ${placed} 不在本抽屉（去录音管理侧再挂）`);
    }
    assert.deepEqual(ids.sort(), ['MT-101', 'MT-106'], '抽屉里只有未处理的录音');
    // 行尾两个小按钮：查看详情 + 归位到本空间；不可归位的只有查看详情
    const rowActions = (id) => [...picker.querySelector(`[data-place-candidate="${id}"] .rec-row-actions`).querySelectorAll('button')].map((button) => button.textContent.trim());
    assert.deepEqual(rowActions('MT-101'), ['查看详情', '归位到本空间']);
    const blockedRow = picker.querySelector('[data-place-candidate="MT-106"]');
    assert.match(blockedRow.textContent, /不可归位/, '不可归位如实标注');
    assert.deepEqual(rowActions('MT-106'), ['查看详情'], '不可归位的不给归位按钮');
    // 查看详情：同一套 4/5 抽屉展示智能总结 / 原文转录，左上角返回回到挑录音抽屉
    picker.querySelector('[data-place-candidate="MT-101"] [data-rec-detail]').click();
    assert.equal(live(t).length, 2, '详情叠在挑录音之上');
    const detail = live(t)[1];
    assert.equal(detail.querySelector('.rec-sheet-head .sheet-close'), null, '详情头只留返回按钮');
    const head = detail.querySelector('.rec-sheet-head');
    assert.ok(head.classList.contains('has-back'), '带返回按钮的头部走 has-back 布局');
    assert.equal(head.querySelector('.back-button').nextElementSibling, head.querySelector('.rec-sheet-copy'), '录音名紧跟返回按钮，不被推到最右');
    const back = detail.querySelector('.rec-sheet-head .back-button[data-sheet-close]');
    assert.ok(back, '左上角是返回按钮');
    assert.ok(detail.querySelector('[data-rec-sheet-tab="summary"].is-active'), '默认智能总结');
    assert.equal(detail.querySelector('[data-rec-sheet-pane="transcript"]').hidden, true);
    detail.querySelector('[data-rec-sheet-tab="transcript"]').click();
    assert.equal(detail.querySelector('[data-rec-sheet-pane="transcript"]').hidden, false, '可切到原文转录');
    back.click();
    assert.equal(live(t).length, 1, '返回后回到挑录音抽屉');
    assert.ok(live(t)[0].querySelector('[data-place-candidate="MT-101"]'), '挑录音抽屉原样保留');
    // 仅一条商机：自动带出，点即归位
    live(t)[0].querySelector('[data-place-candidate="MT-101"] [data-place-one]').click();
    const placed = t.F.spacePlacements('WS-201').find((item) => item.recording === 'MT-101');
    assert.ok(placed, '归位记录已建立');
    assert.equal(placed.opportunityId, 'OP-301', '自动带出本空间唯一商机');
    assert.equal(placed.by, 'U-1004', '记录归位人');
    assert.ok(t.view().querySelector(`[data-placement-row="${placed.id}"]`), '列表出现新的归位条目');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  // 多条商机：点归位后先选一条，系统不代选
  const multi = load('#/space/WS-204/followup/recordings');
  try {
    click(multi, '[data-place-here]');
    const picker = multi.doc.querySelector('.rec-sheet-mask .rec-sheet');
    const before = multi.F.spacePlacements('WS-204').length;
    picker.querySelector('[data-place-candidate="MT-101"] [data-place-one]').click();
    assert.equal(live(multi).length, 2, '多商机先开选择商机');
    const chooser = live(multi)[1];
    assert.match(chooser.textContent, /选择商机/);
    const picks = [...chooser.querySelectorAll('[data-pick-opp]')];
    assert.deepEqual(picks.map((node) => node.dataset.pickOpp), ['OP-304', 'OP-310'], '列出本空间全部商机');
    assert.equal(multi.F.spacePlacements('WS-204').length, before, '未选择前不写入');
    picks[1].click();
    assert.equal(multi.F.spacePlacements('WS-204').length, before + 1, '选定后归位');
    assert.equal(multi.F.spacePlacements('WS-204')[0].opportunityId, 'OP-310', '锚定所选商机');
    assert.deepEqual(multi.errors, []);
  } finally { multi.close(); }

  // 冻结空间与仅客户级确权：不提供归位入口；后者说明原因
  const frozen = load('#/space/WS-206/followup/recordings');
  try {
    assert.equal(frozen.view().querySelector('[data-place-here]'), null, '冻结空间不提供归位入口');
    assert.equal(frozen.view().querySelector('.rec-actions'), null, '不留空入口条');
    assert.match(frozen.view().textContent, /空间已冻结/, '页面已说明只读');
    assert.deepEqual(frozen.errors, []);
  } finally { frozen.close(); }

  const ownerOnly = load('#/space/WS-205/followup/recordings');
  try {
    assert.equal(ownerOnly.view().querySelector('[data-place-here]'), null, '仅客户级确权不提供归位入口');
    assert.match(ownerOnly.view().querySelector('[data-place-blocked]').textContent, /没有商机/, '说明不可归位原因');
    assert.deepEqual(ownerOnly.errors, []);
  } finally { ownerOnly.close(); }
});
