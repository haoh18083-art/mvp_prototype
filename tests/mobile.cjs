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
    for (const view of ['today', 'customers', 'related', 'profile']) {
      t.go('#/' + view);
      assert.ok(t.doc.querySelector('[data-open-assistant]'), `${view} 入口仍可调起本人助手`);
      assert.equal(fab.hidden, view === 'today', `${view} 悬浮入口显示状态`);
      assert.equal(t.doc.querySelector(`[data-nav-item="${view}"]`).classList.contains('is-active'), true, `${view} 底栏高亮`);
    }
    // 「今日」的助手入口来自欢迎区，且欢迎区的动态图标与打字机文案保留
    t.go('#/today');
    assert.ok(t.view().querySelector('.ios-welcome .ios-chat-launch'), '欢迎区保留进入聊天助手入口');
    assert.equal(t.view().querySelectorAll('.ios-doll-eye').length, 2, '欢迎区保留动态图标');
    assert.equal(t.view().querySelectorAll('[data-typewriter-line]').length, 2, '欢迎区保留打字机文案');
    // 空间详情不叠加本人助手入口：该场景由概览的空间助手承接
    t.go('#/space/WS-201/overview');
    assert.equal(fab.hidden, true, '空间详情不显示本人助手悬浮入口');
    assert.ok(t.view().querySelector('[data-space-qa]'), '空间内由空间助手承接问答');
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

test('R09 §4.2 五 Tab 常驻、默认落地概览、折叠区不记忆、深链高亮与冻结只读', () => {
  const t = load('#/space/WS-201/overview');
  try {
    assert.deepEqual([...t.view().querySelectorAll('[data-tab]')].map(node => node.dataset.tab), ['overview', 'customer', 'opps', 'followup', 'documents']);
    assert.ok(t.view().querySelector('[data-space-tab="overview"]'), '默认落地概览');
    // 常显区：一句话判断、快捷问答、当前卡点、关键人、最近动静
    assert.ok(t.view().querySelector('[data-overview-panel="verdict"]'));
    assert.ok(t.view().querySelector('[data-space-qa]'));
    assert.ok(t.view().querySelector('[data-overview-panel="blocker"]'));
    assert.ok(t.view().querySelector('[data-overview-panel="people"]'));
    assert.ok(t.view().querySelector('[data-overview-panel="recent"]'));
    // 折叠区默认收起；展开后切走再切回仍是收起
    const folds = [...t.view().querySelectorAll('[data-fold]')];
    assert.ok(folds.length >= 5, '折叠区板块齐全');
    assert.ok(folds.every(node => !node.open), '折叠区默认收起');
    folds[0].open = true;
    t.go('#/space/WS-201/customer');
    t.go('#/space/WS-201/overview');
    assert.ok([...t.view().querySelectorAll('[data-fold]')].every(node => !node.open), '重新进入仍为收起，不记忆');
    // 深链：点击联系人入口跳客户 Tab 并高亮对应区块
    click(t, '[data-deeplink="contacts"]');
    assert.ok(t.view().querySelector('[data-space-tab="customer"]'), '切到客户 Tab');
    assert.equal(t.view().querySelector('[data-block="contacts"]').classList.contains('is-highlight'), true, '目标区块高亮');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  // 冻结空间：可进入、五 Tab 可读、无写入入口、快捷问答禁用
  const frozen = load('#/space/WS-206/followup');
  try {
    assert.ok(frozen.view().querySelector('[data-frozen-note]'), '顶部标注冻结');
    assert.equal(frozen.view().querySelector('[data-write]'), null, '不提供任何写入入口');
    assert.ok(frozen.view().querySelector('[data-write-blocked]'));
    frozen.go('#/space/WS-206/overview');
    assert.ok(frozen.view().querySelector('[data-qa-frozen]'), '冻结后不开放新问答');
    assert.equal(frozen.view().querySelector('[data-qa-form]'), null);
    assert.deepEqual(frozen.errors, []);
  } finally { frozen.close(); }
});

test('R09 §4.3 跟进与周复盘写入两端同一份；未选商机与仅客户级确权都不可提交', () => {
  const t = load('#/space/WS-201/followup');
  let saved;
  try {
    click(t, '[data-write="followup"]');
    const form = t.doc.querySelector('[data-write-form]');
    assert.ok(form, '写入表单打开');
    assert.ok(form.elements.opportunityId, '跟进记录必须关联商机');
    // 内容为空阻止提交
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.match(t.doc.querySelector('[data-write-error]').textContent, /填写跟进内容/);
    form.elements.text.value = '移动端记录：客户确认下周三启动试点验收。';
    form.elements.next.value = '周一发出验收指标清单。';
    form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true }));
    const record = t.F.load().followups.find(item => item.text.startsWith('移动端记录'));
    assert.ok(record, '提交成功');
    assert.equal(record.opportunityId, 'OP-301', '跟进记录锚定商机');
    assert.ok(t.F.load().behaviorRecords.some(item => item.eventType === 'followup' && item.eventId === record.id), '同批产出行为记录');
    saved = t.save();
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
  // 两端同一份：网页端客户空间读到的就是手机上刚写的这条
  const desktop = (() => {
    const errors = [], vc = new VirtualConsole();
    vc.on('jsdomError', error => errors.push(error.message));
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages', 'followup-workbench.html'), 'utf8'), {
      url: 'http://prototype.test/pages/followup-workbench.html?role=SLS&as=U-1004&space=WS-201&tab=followup&sub=followups',
      runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
    });
    dom.window.scrollTo = () => {};
    dom.window.localStorage.setItem('sc-v02-feature-pages-v1', saved);
    for (const script of dom.window.document.querySelectorAll('script[src]')) {
      dom.window.eval(fs.readFileSync(path.resolve(root, 'pages', script.getAttribute('src').split('?')[0]), 'utf8'));
    }
    return { doc: dom.window.document, errors, close: () => dom.window.close() };
  })();
  try {
    assert.match(desktop.doc.querySelector('[data-tab-body]').textContent, /移动端记录：客户确认下周三启动试点验收。/, '网页端读到同一条');
    assert.deepEqual(desktop.errors, []);
  } finally { desktop.close(); }

  // 周复盘三项：进展、下一步、阻塞
  const weekly = load('#/space/WS-201/followup', saved);
  try {
    click(weekly, '[data-write="weekly"]');
    const form = weekly.doc.querySelector('[data-write-form]');
    assert.ok(form.elements.progress && form.elements.next && form.elements.blockers, '周复盘三项齐全');
    form.elements.progress.value = '完成试点范围与验收口径确认。';
    form.elements.next.value = '下周安排启动会。';
    form.dispatchEvent(new weekly.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.ok(weekly.F.load().weeklyReviews.some(item => item.progress.startsWith('完成试点范围')), '周复盘写入');
    assert.deepEqual(weekly.errors, []);
  } finally { weekly.close(); }

  // 仅客户级确权：客户内容可看，跟进记录不可写
  const ownerOnly = load('#/space/WS-205/followup');
  try {
    click(ownerOnly, '[data-write="followup"]');
    assert.match(ownerOnly.doc.querySelector('.sheet-body').textContent, /暂无商机，跟进记录暂不可写/);
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
    assert.deepEqual(inbox.errors, []);
  } finally { inbox.close(); }

  // 离线：最近打开过的空间只读可看，未缓存的如实提示需要联网
  const device = JSON.stringify({ offline: true, cached: ['WS-201'], drafts: [] });
  const offline = load('#/space/WS-201/overview', undefined, device);
  try {
    assert.ok(offline.view().querySelector('[data-offline-note]'), '标明离线内容与最后更新时间');
    offline.go('#/space/WS-203/overview');
    assert.match(offline.view().textContent, /离线状态下无法打开这个空间/, '未缓存空间提示需要联网');
    // 离线写跟进只存草稿，不自动提交
    offline.go('#/space/WS-201/followup');
    click(offline, '[data-write="followup"]');
    const form = offline.doc.querySelector('[data-write-form]');
    assert.match(offline.doc.querySelector('[data-write-submit]').textContent, /存为本机草稿/);
    form.elements.text.value = '地库里先记一笔：客户要补充峰值数据。';
    form.dispatchEvent(new offline.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(offline.F.load().followups.some(item => item.text.startsWith('地库里')), false, '草稿不写入业务数据');
    const local = JSON.parse(offline.device());
    assert.equal(local.drafts.length, 1, '草稿保存在本机');
    assert.equal(local.drafts[0].status, 'draft');
    assert.ok(offline.view().querySelector('[data-draft-bar]'), '空间内提示有待确认草稿');
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

  // 重复点击同一提交只产生一条记录
  const once = load('#/space/WS-202/followup');
  try {
    click(once, '[data-write="followup"]');
    const form = once.doc.querySelector('[data-write-form]');
    form.elements.text.value = '只应写入一条的跟进内容。';
    form.dispatchEvent(new once.w.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new once.w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(once.F.load().followups.filter(item => item.text === '只应写入一条的跟进内容。').length, 1, '重复点击只生成一条');
    assert.deepEqual(once.errors, []);
  } finally { once.close(); }
});

test('R09 相关与我的：录音管理入口、推送渠道口径与草稿不自动提交', () => {
  const related = load('#/related');
  try {
    assert.match(related.view().textContent, /录音管理/);
    assert.match(related.view().textContent, /不提供手动上传与应用内录制/);
    assert.ok(related.view().querySelector('[data-recording="MT-101"]'), '本人录音进入工作台');
    assert.equal(related.view().querySelector('[data-recording="MT-107"]'), null, '其他销售的录音不可见');
    // 归位入口沿用 R10 校验：多商机不代选
    click(related, '[data-place-recording="MT-101"]');
    const form = related.doc.querySelector('[data-place-form]');
    assert.ok(form, '归位表单打开');
    assert.ok(form.elements.opportunityId, '必须选择商机');
    assert.deepEqual(related.errors, []);
  } finally { related.close(); }

  const profile = load('#/profile', undefined, JSON.stringify({ offline: false, cached: [], drafts: [{ id: 'DRAFT-1', space: 'WS-201', kind: 'followup', values: { text: '离线时写下的草稿。' }, savedAt: '2026-09-21 09:00', status: 'draft' }] }));
  try {
    assert.match(profile.view().textContent, /本版只有一条渠道，不提供渠道偏好设置/);
    assert.match(profile.view().textContent, /企业内部安装包/);
    assert.match(profile.view().textContent, /与网页端同一份演示状态，不做分端存储/);
    assert.ok(profile.view().querySelector('[data-draft="DRAFT-1"]'), '待确认草稿可见');
    assert.match(profile.view().textContent, /恢复网络后也不会自动提交/);
    assert.equal(profile.F.load().followups.some(item => item.text === '离线时写下的草稿。'), false, '草稿不自动提交');
    assert.deepEqual(profile.errors, []);
  } finally { profile.close(); }
});
