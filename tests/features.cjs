/** V0.2 功能页行为回归：验证 CRM 对齐、空间生命周期、权限、方案往来、会议挂载及本地持久化。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const pages = ['customer-spaces', 'customer-ownership', 'followup-workbench', 'meeting-center', 'employee-insights', 'data-insights', 'push-followup', 'platform-data', 'message-center', 'sales-assistant', 'solution-center', 'solution-workbench', 'solution-push', 'solution-feedback', 'operations-config', 'product-library', 'conversation-review', 'today-follow', 'insight-ops', 'daily-report', 'ai-capability', 'sales-goals'];

function load(page, query = '', storage) {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages', page + '.html'), 'utf8'), { url: 'http://prototype.test/pages/' + page + '.html' + query, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {};
  if (storage) w.localStorage.setItem('sc-v02-feature-pages-v1', storage);
  for (const script of doc.querySelectorAll('script[src]')) w.eval(fs.readFileSync(path.resolve(root, 'pages', script.getAttribute('src').split('?')[0]), 'utf8'));
  return { w, doc, errors, F: w.SC.FEATURES, save: () => JSON.stringify(w.SC.FEATURES.load()), close: () => dom.window.close() };
}
function click(t, selector) { const n = t.doc.querySelector(selector); assert.ok(n, selector); n.click(); }
function fill(t, name, value) { const n = t.doc.querySelector('[name="' + name + '"]'); assert.ok(n, name); n.value = value; }
function change(t, name, value) { const n = t.doc.querySelector('[name="' + name + '"]'); assert.ok(n, name); n.value = value; n.dispatchEvent(new t.w.Event('change', { bubbles: true })); }
function submit(t, selector = '.fp-overlay form') { const form = t.doc.querySelector(selector); assert.ok(form, selector); form.dispatchEvent(new t.w.Event('submit', { bubbles: true, cancelable: true })); }

/** 验证 F.table 输出的可访问表格契约，并返回数据行数量。 */
function assertFeatureTable(scope, expectedCaption, context) {
  const shell = scope.querySelector('.fp-table-shell');
  assert.ok(shell, `${context}: 缺少表格外壳`);
  const region = shell.querySelector(':scope > .fp-data-table-wrap');
  const table = region?.querySelector(':scope > table');
  assert.ok(region && table, `${context}: 缺少滚动区域或表格`);
  assert.equal(region.getAttribute('role'), 'region', `${context}: 滚动区域角色`);
  assert.equal(region.getAttribute('tabindex'), '0', `${context}: 滚动区域应可聚焦`);
  assert.equal(region.getAttribute('aria-label'), expectedCaption, `${context}: 区域名称`);
  assert.equal(table.querySelector('caption')?.textContent.trim(), expectedCaption, `${context}: caption`);
  assert.notEqual(expectedCaption, '数据列表', `${context}: caption 不应退化为通用名称`);

  const headers = [...table.querySelectorAll('thead th')];
  assert.ok(headers.length > 0, `${context}: 缺少列头`);
  assert.equal(new Set(headers.map(header => header.id)).size, headers.length, `${context}: 列头 id 应唯一`);
  assert.ok(headers.every(header => header.id && header.scope === 'col'), `${context}: 列头语义`);

  const rows = [...table.querySelectorAll('tbody tr:not(.is-empty)')];
  assert.equal(Number(shell.dataset.rowCount), rows.length, `${context}: data-row-count`);
  assert.ok(Number.isInteger(Number(shell.dataset.totalCount)), `${context}: data-total-count 应为整数`);
  assert.ok(Number(shell.dataset.totalCount) >= rows.length, `${context}: 总数不应小于当前行数`);
  rows.forEach((row, rowIndex) => {
    const cells = [...row.cells];
    assert.equal(cells.length, headers.length, `${context}: 第 ${rowIndex + 1} 行列数`);
    cells.forEach((cell, columnIndex) => {
      assert.equal(cell.getAttribute('headers'), headers[columnIndex].id, `${context}: 单元格 headers`);
      const mobileLabel = cell.querySelector(':scope > .fp-table-cell-label');
      assert.ok(mobileLabel, `${context}: 缺少窄屏字段标签`);
      assert.equal(mobileLabel.getAttribute('aria-hidden'), 'true', `${context}: 窄屏字段标签不应重复播报`);
      assert.equal(mobileLabel.textContent.trim(), headers[columnIndex].textContent.trim(), `${context}: 窄屏字段标签`);
    });

    const firstCell = cells[0];
    const namedTarget = firstCell.querySelector('strong, a');
    const firstCellCopy = firstCell.cloneNode(true);
    firstCellCopy.querySelector('.fp-table-cell-label')?.remove();
    const rowName = (namedTarget?.textContent || firstCellCopy.textContent).trim().replace(/\s+/g, ' ');
    headers.forEach((header, columnIndex) => {
      if (!/操作|追踪/.test(header.textContent)) return;
      cells[columnIndex].querySelectorAll('button, a').forEach(control => {
        const action = control.textContent.trim().replace(/\s+/g, ' ');
        const label = control.getAttribute('aria-label') || '';
        assert.ok(label.includes(action), `${context}: 操作控件标签应包含动作`);
        assert.ok(label.includes(rowName), `${context}: 操作控件标签应包含行上下文 ${rowName}`);
      });
    });
  });
  return rows.length;
}

test('feature pages load the responsive table styles and current feature script bundle', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, 'pages', page + '.html'), 'utf8');
    const doc = new JSDOM(html).window.document;
    const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(node => node.getAttribute('href'));
    const featureScripts = [...doc.querySelectorAll('script[src^="../js/features/"]')].map(node => node.getAttribute('src'));

    assert.ok(styles.includes('../css/features.css?v=20260921-r0910'), `${page}: 缺少功能页基础样式`);
    assert.ok(styles.includes('../css/features-container.css?v=20260920-people-r2'), `${page}: 缺少表格容器响应样式`);
    assert.equal(featureScripts.length, 11, `${page}: 功能脚本数量`);
    assert.ok(featureScripts.every(src => src.endsWith('?v=20260921-r0910')), `${page}: 功能脚本缓存版本未同步`);
  }
});

test('V0.2 feature pages render their contents, tabs and valid local navigation', () => {
  for (const page of pages) {
    const t = load(page);
    try {
      assert.ok(t.doc.querySelector('#fp-content').textContent.trim(), page);
      assert.match(t.doc.title, /V0.2/);
      for (const key of [...t.doc.querySelectorAll('[data-tab]')].map(n => n.dataset.tab)) {
        click(t, '[data-tab="' + key + '"]');
        assert.ok(t.doc.querySelector('#fp-content').textContent.trim());
      }
      for (const a of t.doc.querySelectorAll('a[href]')) {
        const url = new URL(a.href);
        if (url.origin === 'http://prototype.test') assert.ok(fs.existsSync(path.join(root, url.pathname)), page + ': ' + url.pathname);
      }
      assert.deepEqual(t.errors, [], page);
    } finally { t.close(); }
  }
});
test('sales, solution and operations see their proper spaces, and frozen spaces reject writes', () => {
  const sales = load('customer-spaces', '?role=SLS&as=U-1004');
  const sol = load('customer-spaces', '?role=SOL&as=U-1010');
  const ops = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    assert.equal(sales.F.visible().length, 6);
    assert.ok(sales.F.visible().every(w => w.sales === 'U-1004'));
    assert.equal(sales.F.space('WS-207'), undefined);
    assert.throws(() => sales.F.addFollowup('WS-206', { text: '冻结后写入' }), /只读/);
    assert.throws(() => sales.F.addFollowup('WS-207', { text: '其他销售内容' }), /只读/);
    assert.equal(sol.F.visible().length, 6);
    assert.ok(sol.F.visible().every(w => ['通信线路池', '智能短信池'].includes(w.pool)));
    assert.equal(ops.F.visible().length, 9);
    assert.throws(() => ops.F.addFollowup('WS-201', { text: '运营写入' }), /只读/);
    const ownerOnly = sales.F.space('WS-205');
    assert.equal(ownerOnly.opps.length, 0);
    assert.equal(ownerOnly.state, 'active');
  } finally { sales.close(); sol.close(); ops.close(); }
});
test('followup form validates, persists and restores content without interpreting markup', () => {
  const t = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201');
  let saved;
  try {
    click(t, '[data-action=followup]'); submit(t);
    assert.match(t.doc.querySelector('.fp-error').textContent, /填写跟进/);
    fill(t, 'text', '<img src=x onerror=alert(1)> 已确认试点'); fill(t, 'next', '周五确认验收'); submit(t);
    assert.equal(t.F.load().followups[0].next, '周五确认验收');
    assert.equal(t.doc.querySelector('#fp-content img'), null);
    assert.match(t.doc.querySelector('#fp-content').textContent, /已确认试点/);
    saved = t.save(); assert.deepEqual(t.errors, []);
  } finally { t.close(); }
  // 旧链接 tab=followups 现在落到「跟进 → 跟进记录」子页签，下一步计划仍在该处可读。
  const reload = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=followups', saved);
  try {
    assert.equal(reload.doc.querySelector('[data-tab="followup"]')?.classList.contains('is-active'), true, '旧 tab=followups 应落到跟进入口');
    assert.equal(reload.doc.querySelector('[data-subtab="followups"]')?.classList.contains('is-active'), true, '应选中跟进记录子页签');
    assert.match(reload.doc.querySelector('#fp-content').textContent, /周五确认验收/);
  } finally { reload.close(); }
});
test('multi-space solution pushes keep separate read/reply state and one reply closes the loop', () => {
  const sol = load('solution-center', '?role=SOL&as=U-1010');
  let saved, first, second;
  try {
    sol.F.sendSolution(['WS-201', 'WS-202'], { title: '联合试点建议', body: '请确认各自验收范围。' });
    const rows = sol.F.load().solutions.filter(r => r.title === '联合试点建议');
    first = rows.find(r => r.space === 'WS-201').id; second = rows.find(r => r.space === 'WS-202').id;
    assert.equal(rows.length, 2);
    assert.throws(() => sol.F.sendSolution(['WS-203'], { title: '跨池', body: '不可见' }), /无权/);
    saved = sol.save();
  } finally { sol.close(); }
  const sales = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=solutions&solution=' + first, saved);
  try {
    assert.equal(sales.F.load().solutions.find(r => r.id === first).read, true);
    assert.equal(sales.F.load().solutions.find(r => r.id === second).read, false);
    fill(sales, 'reply', '客户同意下周启动。'); submit(sales);
    assert.throws(() => sales.F.solutionAction(first, 'reply', '重复'), /再次提交/);
    saved = sales.save(); assert.deepEqual(sales.errors, []);
  } finally { sales.close(); }
  const returnSol = load('solution-center', '?role=SOL&as=U-1010', saved);
  try {
    returnSol.F.solutionDetail(first);
    assert.equal(returnSol.F.load().solutions.find(r => r.id === first).replyRead, true);
    assert.throws(() => returnSol.F.solutionAction(first, 'withdraw'), /已读/);
    returnSol.F.solutionAction(second, 'withdraw');
    assert.equal(returnSol.F.load().solutions.find(r => r.id === second).withdrawn, true);
  } finally { returnSol.close(); }
});
test('assignment edits revoke old-pool access and stale solution writes immediately', () => {
  const t = load('operations-config', '?role=ADM&as=U-1001&tab=pools');
  let saved;
  try {
    click(t, '[data-action=pools][data-value=U-1010]');
    t.doc.querySelectorAll('[name=pools]').forEach(n => n.checked = n.value === '号码认证池'); submit(t);
    assert.deepEqual(Array.from(t.F.load().assignments['U-1010']), ['号码认证池']); saved = t.save();
  } finally { t.close(); }
  const sol = load('solution-center', '?role=SOL&as=U-1010', saved);
  try {
    assert.ok(sol.F.visible().every(w => w.pool === '号码认证池'));
    assert.throws(() => sol.F.solutionAction('SL-101', 'withdraw'), /可见范围/);
    assert.throws(() => sol.F.sendSolution(['WS-206'], { title: '冻结', body: '不能发送' }), /冻结/);
  } finally { sol.close(); }
});
test('recording placement writes one change per space, survives reload, and refuses duplicates', () => {
  const t = load('meeting-center', '?role=SLS&as=U-1004&meeting=MT-101');
  let saved;
  try {
    // 从录音详情发起归位：WS-201 只有一条商机，自动带出后直接确认
    click(t, '.fp-overlay [data-action="place"]');
    submit(t, '.fp-overlay:last-of-type form');
    const state = t.F.load();
    const placement = state.placements.find(item => item.recording === 'MT-101' && item.status !== 'canceled');
    assert.ok(placement, '建立一条归位');
    assert.equal(placement.space, 'WS-201');
    assert.equal(placement.opportunityId, 'OP-301', '单商机自动带出');
    assert.equal(placement.status, 'done', '转写可用时立即进入客户信息更新');
    assert.equal(state.spaceChanges.filter(c => c.sourceRef === 'MT-101' && c.space === 'WS-201').length, 1, '一次归位一条变化');
    assert.equal(state.behaviorRecords.filter(r => r.eventType === 'meeting' && r.eventId === placement.id).length, 1, '同批一条行为记录');
    saved = t.save(); assert.deepEqual(t.errors, []);
  } finally { t.close(); }
  // 同一录音同一空间重复归位：提示已存在，不重复建立
  const again = load('meeting-center', '?role=SLS&as=U-1004&meeting=MT-101', saved);
  try {
    const before = again.F.load().placements.length;
    assert.throws(() => again.F.placeRecording('MT-101', { space: 'WS-201', opportunityId: 'OP-301' }), /已归位到这个客户空间/);
    assert.equal(again.F.load().placements.length, before, '重复归位不新增记录');
  } finally { again.close(); }
  const space = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=followup&sub=recordings', saved);
  try { assert.match(space.doc.querySelector('[data-tab-body]').textContent, /线路试点技术交流/, '归位后进入本空间录音区'); } finally { space.close(); }
});
test('search, model validation and drawer keyboard dismissal work without runtime errors', () => {
  const t = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    fill(t, 'q', '星辰'); submit(t, '[data-search]');
    assert.equal(t.doc.querySelectorAll('.fp-table tbody tr').length, 2);
    click(t, '[type=reset]'); assert.equal(t.doc.querySelectorAll('.fp-table tbody tr').length, 9);
  } finally { t.close(); }
  const cfg = load('operations-config', '?role=ADM&as=U-1001');
  try {
    fill(cfg, 'temperature', '3'); submit(cfg, '#fp-content form');
    assert.match(cfg.doc.querySelector('.fp-error').textContent, /0～2/);
    fill(cfg, 'temperature', '0.6'); submit(cfg, '#fp-content form');
    assert.equal(cfg.F.load().config.temperature, '0.6');
    click(cfg, '[data-tab=openclaw]'); click(cfg, '[data-action=health]');
    assert.equal(cfg.doc.getElementById('sc-app').inert, true);
    cfg.doc.querySelector('.fp-overlay').dispatchEvent(new cfg.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(cfg.doc.querySelector('.fp-overlay'), null);
    assert.equal(cfg.doc.getElementById('sc-app').inert, false);
    assert.deepEqual(cfg.errors, []);
  } finally { cfg.close(); }
});

test('customer directory gives immediate, removable and accessible filter feedback', () => {
  const t = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    assert.equal(t.doc.querySelector('[data-result-count]').textContent, '9 个空间');
    assert.equal(t.doc.querySelector('[type=reset]').disabled, true);
    assert.equal(t.doc.querySelector('.fp-directory-table-wrap').getAttribute('role'), 'region');
    assert.equal(t.doc.querySelector('.fp-directory-table-wrap').getAttribute('aria-labelledby'), 'customer-space-list-title');
    assert.equal(t.doc.querySelector('.fp-directory-table caption').textContent, '客户空间筛选结果');
    assert.match(t.doc.querySelector('.fp-directory-table thead').textContent, /商机数/);
    assert.equal(t.doc.querySelector('.fp-directory-table tbody td').getAttribute('headers'), 'customer-space-col-customer');
    assert.equal(t.doc.querySelector('.fp-directory-mobile-label').getAttribute('aria-hidden'), 'true');

    fill(t, 'q', 'ws-201'); submit(t, '[data-search]');
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 1);
    assert.match(t.doc.querySelector('[data-filter-chips]').textContent, /关键词：ws-201/);
    assert.equal(t.doc.querySelector('[type=reset]').disabled, false);

    click(t, '[data-remove-filter="q"]');
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 9);
    assert.equal(t.doc.querySelector('[data-filter-feedback]').hidden, true);

    change(t, 'pool', '号码认证池');
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 3);
    change(t, 'status', 'frozen');
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 1);
    assert.match(t.doc.querySelector('[data-filter-summary]').textContent, /1 \/ 9/);
    assert.equal(t.doc.querySelectorAll('[data-remove-filter]').length, 2);

    click(t, '[type=reset]');
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 9);
    assert.equal(t.doc.querySelector('[name=pool]').value, '');
    assert.equal(t.doc.querySelector('[name=status]').value, '');
    assert.equal(t.doc.querySelector('[type=reset]').disabled, true);

    const longKeyword = '这是一个用于验证移动端超长关键词不会撑破筛选区域的测试内容';
    fill(t, 'q', longKeyword); submit(t, '[data-search]');
    assert.match(t.doc.querySelector('.fp-empty').textContent, /未找到匹配的客户空间/);
    const keywordChip = t.doc.querySelector('[data-remove-filter="q"]');
    assert.equal(keywordChip.title, `关键词：${longKeyword}`);
    assert.equal(keywordChip.querySelector('span').textContent, `关键词：${longKeyword}`);
    assert.ok(keywordChip.querySelector('.ico'));
    t.doc.querySelector('[name=q]').dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 9);
    assert.equal(t.doc.querySelector('[name=q]').value, '');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('customer search debounce respects IME composition and reset cancellation', async () => {
  const t = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    const search = t.doc.querySelector('[name=q]');
    search.value = 'ws-201';
    search.dispatchEvent(new t.w.CompositionEvent('compositionstart', { bubbles: true }));
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true, isComposing: true }));
    search.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true }));
    search.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true }));
    assert.equal(search.value, 'ws-201');
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 9);

    search.dispatchEvent(new t.w.CompositionEvent('compositionend', { bubbles: true }));
    await new Promise(resolve => t.w.setTimeout(resolve, 330));
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 1);

    search.value = '星辰';
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true }));
    click(t, '[type=reset]');
    await new Promise(resolve => t.w.setTimeout(resolve, 330));
    assert.equal(t.doc.querySelectorAll('.fp-directory-table tbody tr').length, 9);
    assert.equal(search.value, '');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('shared tables keep accessible structure, counts and row-aware action names across feature views', () => {
  const cases = [
    ['meeting-center', '?role=MGR&as=U-1002', '录音同步与归位列表', '会议中心'],
    ['solution-center', '?role=SOL&as=U-1010', '客户方案推送与反馈记录', '方案协同台'],
    ['push-followup', '?role=MGR&as=U-1002', '客户方案推送后的销售跟进记录', '方案推送跟进'],
    ['product-library', '?role=ADM&as=U-1001', '产品知识资料清单', '产品知识库'],
    ['conversation-review', '?role=ADM&as=U-1001', '销售助手会话审阅记录', '会话审阅'],
    ['data-insights', '?role=MGR&as=U-1002', '销售助手对话留存窗口', '数据洞察'],
    ['employee-insights', '?role=MGR&as=U-1002', '所选销售的客户空间概览', '经营洞察'],
    ['followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=opps', '星辰科技有限公司 的已确权商机', '跟进工作台商机'],
    ['followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=recordings', '星辰科技有限公司 的客户录音归位', '跟进工作台录音']
  ];
  for (const [page, query, caption, context] of cases) {
    const t = load(page, query);
    try {
      assert.ok(assertFeatureTable(t.doc.querySelector('#fp-content'), caption, context) > 0, `${context}: 应有样例数据`);
      assert.deepEqual(t.errors, [], context);
    } finally { t.close(); }
  }
});

test('shared tables distinguish natural empty states from filtered no-match states', () => {
  const t = load('meeting-center', '?role=MGR&as=U-1002');
  try {
    const host = t.doc.createElement('div');
    host.innerHTML = t.F.table(['名称'], [], { caption: '自然空数据', emptyMessage: '当前没有数据。' });
    assert.equal(host.querySelector('.fp-empty h3').textContent, '暂无记录');

    host.innerHTML = t.F.table(['名称'], [], { caption: '筛选无结果', emptyMessage: '请调整筛选条件。', totalCount: 3 });
    assert.equal(host.querySelector('.fp-empty h3').textContent, '未找到记录');
  } finally { t.close(); }
});

test('platform data tables keep the shared contract in all three tabs', () => {
  const t = load('platform-data', '?role=MGR&as=U-1002');
  const tabs = [
    ['data', '客户数据治理批次'],
    ['production', '方案生产批次就绪状态'],
    ['delivery', '方案分发与接收状态']
  ];
  try {
    for (const [tab, caption] of tabs) {
      click(t, `[data-tab="${tab}"]`);
      assert.ok(assertFeatureTable(t.doc.querySelector('[data-facet]'), caption, `平台数据/${tab}`) > 0);
    }
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('operations tables keep the shared contract in every table-bearing view', () => {
  const t = load('operations-config', '?role=ADM&as=U-1001');
  const tabs = [
    ['crm', 'CRM 人员与系统账号对应关系'],
    ['notify', '提醒事件与接收人清单'],
    ['openclaw', 'OpenClaw 专属 Agent 运行与路由状态'],
    ['levels', '客户等级及经营优先级规则'],
    ['pools', '解决方案人员承接客户池配置']
  ];
  try {
    for (const [tab, caption] of tabs) {
      click(t, `[data-tab="${tab}"]`);
      assert.ok(assertFeatureTable(t.doc.querySelector('[data-settings]'), caption, `运营配置/${tab}`) > 0);
    }
    click(t, '[data-tab="openclaw"]');
    click(t, '[data-action="health"]');
    assert.equal(assertFeatureTable(t.doc.querySelector('.fp-overlay'), 'OpenClaw 运行健康检查结果', '运营配置/健康检查'), 4);
    assert.ok(t.doc.querySelector('.fp-overlay .fp-data-table--single'), '两列表格应使用单列窄屏布局');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('超管人员管理提供筛选、抽屉表单、启停用和密码重置交互', () => {
  const admin = load('operations-config', '?role=ADM&as=U-1001&tab=people');
  try {
    assert.ok(admin.doc.querySelector('[data-tab="people"]'), 'ADM 应看到人员管理页签');
    assert.equal(admin.doc.querySelectorAll('[data-people-check]').length, 8, '首屏按分页展示 8 名人员');
    assert.equal(admin.F.load().people.length, 14, '初始列表包含完整人员');
    assert.equal(admin.F.load().people.filter(person => person.status === 'off').length, 1, '初始列表保留停用人员');
    assert.ok(assertFeatureTable(admin.doc.querySelector('[data-people-results]'), '人员与账号列表', '人员管理列表') > 0);

    change(admin, 'status', 'off');
    assert.equal(admin.doc.querySelectorAll('[data-people-check]').length, 1, '状态筛选');
    assert.match(admin.doc.querySelector('[data-people-check]').getAttribute('aria-label'), /韩增/);
    change(admin, 'status', '');
    change(admin, 'role', 'SOL');
    assert.equal(admin.doc.querySelectorAll('[data-people-check]').length, 3, '角色筛选');

    // 新增账号：邮箱校验、角色选择和本地持久化。
    click(admin, '[data-action="people-new"]');
    fill(admin, 'name', '测试人员');
    fill(admin, 'email', 'test-person@example.com');
    fill(admin, 'password', 'abc123');
    change(admin, 'role', 'SLS');
    submit(admin);
    const created = admin.F.load().people.find(person => person.email === 'test-person@example.com');
    assert.ok(created && created.status === 'on' && created.role === 'SLS');

    // 详情、编辑和重置密码都从同一行进入抽屉。
    fill(admin, 'q', created.id); submit(admin, '[data-search]');
    click(admin, `[data-action="people-detail"][data-value="${created.id}"]`);
    assert.match(admin.doc.querySelector('.fp-overlay').textContent, /人员详情/);
    admin.doc.querySelector('.fp-overlay [data-action="people-edit"]').click();
    fill(admin, 'name', '测试人员·已编辑');
    submit(admin);
    assert.equal(admin.F.load().people.find(person => person.id === created.id).name, '测试人员·已编辑');

    // 重置密码默认带出生成值，确认后只保存重置时间，不保存明文密码。
    click(admin, `[data-action="people-reset"][data-value="${created.id}"]`);
    submit(admin);
    const reset = admin.F.load().people.find(person => person.id === created.id);
    assert.ok(reset.passwordResetAt);
    assert.equal('password' in reset, false);

    // 启停用确认抽屉与当前登录账号保护。
    click(admin, '[type="reset"]');
    click(admin, '[data-action="people-toggle"][data-value="U-1007"]');
    assert.equal(admin.F.load().people.find(person => person.id === 'U-1007').status, 'on', '停用前先验证启用动作');
    click(admin, '[data-action="people-toggle"][data-value="U-1007"]');
    assert.ok(admin.doc.querySelector('.fp-overlay form'), '停用应先打开确认抽屉');
    submit(admin);
    assert.equal(admin.F.load().people.find(person => person.id === 'U-1007').status, 'off');
    click(admin, '[data-action="people-toggle"][data-value="U-1001"]');
    assert.equal(admin.doc.querySelector('.fp-overlay'), null, '不能停用当前登录账号');
    assert.equal(admin.F.load().people.find(person => person.id === 'U-1001').status, 'on', '当前登录账号状态应保持启用');

    const saved = admin.save();
    const reloaded = load('operations-config', '?role=ADM&as=U-1001&tab=people', saved);
    try { assert.equal(reloaded.F.load().people.find(person => person.id === created.id).name, '测试人员·已编辑'); } finally { reloaded.close(); }
    assert.deepEqual(admin.errors, []);
  } finally { admin.close(); }

  const manager = load('operations-config', '?role=MGR&as=U-1002&tab=people');
  try {
    assert.equal(manager.doc.querySelector('[data-tab="people"]'), null, 'MGR 不应看到人员管理页签');
    assert.equal(manager.doc.querySelector('[data-people-results]'), null, 'MGR 不应渲染人员管理内容');
    assert.deepEqual(manager.errors, []);
  } finally { manager.close(); }
});

test('shared searchbar filters immediately without a query button and protects composition state', async () => {
  const t = load('meeting-center', '?role=MGR&as=U-1002');
  const delay = () => new Promise(resolve => t.w.setTimeout(resolve, 340));
  try {
    const form = t.doc.querySelector('[data-search]');
    const search = form.elements.q;
    const resultScope = t.doc.querySelector('[data-results]');
    const total = assertFeatureTable(resultScope, '录音同步与归位列表', '会议筛选初始结果');
    assert.equal(total, 7);
    assert.equal(form.querySelector('button[type="submit"]'), null);
    assert.equal([...form.querySelectorAll('button')].some(button => button.textContent.includes('查询')), false);

    search.value = '线路试点';
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true }));
    assert.equal(resultScope.querySelector('.fp-table-shell').dataset.rowCount, String(total), '输入后不应在 300ms 前执行');
    await delay();
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', '会议关键词筛选'), 1);
    assert.equal(form.querySelector('[data-search-summary]').textContent, '显示 1 / 7 条录音');
    assert.match(form.querySelector('[data-remove-filter="q"]').getAttribute('aria-label'), /移除筛选条件：关键词：线路试点/);

    click(t, '[data-remove-filter="q"]');
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', '移除关键词筛选'), total);
    assert.equal(form.querySelector('[data-search-feedback]').hidden, true);

    change(t, 'sync', 'failed');
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', '会议状态即时筛选'), 1);
    assert.match(form.querySelector('[data-search-summary]').textContent, /显示 1 \/ 7 条录音/);
    assert.match(form.querySelector('[data-remove-filter="sync"]').textContent, /同步状态：同步失败/);
    click(t, '[data-remove-filter="sync"]');
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', '移除状态筛选'), total);

    search.value = '线路试点';
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true }));
    await delay();
    assert.equal(resultScope.querySelector('.fp-table-shell').dataset.rowCount, '1');
    search.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(search.value, '');
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', 'Escape 清空搜索'), total);

    search.value = '采购预算';
    search.dispatchEvent(new t.w.CompositionEvent('compositionstart', { bubbles: true }));
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true, isComposing: true }));
    search.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true }));
    search.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true }));
    await delay();
    assert.equal(search.value, '采购预算');
    assert.equal(resultScope.querySelector('.fp-table-shell').dataset.rowCount, String(total), '组合输入期间不应筛选');
    search.dispatchEvent(new t.w.CompositionEvent('compositionend', { bubbles: true }));
    await delay();
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', '组合输入结束后筛选'), 1);

    search.value = '线路试点';
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true }));
    click(t, '[type="reset"]');
    await delay();
    assert.equal(search.value, '');
    assert.equal(assertFeatureTable(resultScope, '录音同步与归位列表', 'reset 取消待执行筛选'), total);
    assert.equal(form.querySelector('[type="reset"]').disabled, true);

    search.value = '不存在的会议';
    search.dispatchEvent(new t.w.InputEvent('input', { bubbles: true }));
    await delay();
    assert.equal(resultScope.querySelector('.fp-table-shell').dataset.rowCount, '0');
    assert.equal(resultScope.querySelector('.fp-table-shell').dataset.totalCount, String(total));
    assert.equal(form.querySelector('[data-search-summary]').textContent, '显示 0 / 7 条录音');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('shared search cancels a stale debounce when tabs replace the filter form', async () => {
  const t = load('solution-center', '?role=SOL&as=U-1010');
  try {
    const oldForm = t.doc.querySelector('[data-search]');
    const oldSearch = oldForm.elements.q;
    oldSearch.value = '星辰';
    oldSearch.dispatchEvent(new t.w.InputEvent('input', { bubbles: true }));
    click(t, '[data-tab="unread"]');

    const nextForm = t.doc.querySelector('[data-search]');
    assert.notEqual(nextForm, oldForm);
    await new Promise(resolve => t.w.setTimeout(resolve, 340));
    assert.equal(nextForm.elements.q.value, '');
    assert.equal(nextForm.querySelector('[data-search-feedback]').hidden, true);
    assert.equal(nextForm.querySelector('[type="reset"]').disabled, true);
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R01 CRM 归属同步拆分待对应、未分配和异常，并支持切换校验', () => {
  const t = load('operations-config', '?role=ADM&as=U-1001&tab=crm');
  try {
    const settings = t.doc.querySelector('[data-settings]');
    assert.ok(settings.querySelector('[data-crm-metric="last-sync"]'));
    assert.ok(settings.querySelector('[data-crm-metric="processed"]'));
    assert.ok(settings.querySelector('[data-crm-metric="added"]'));
    assert.ok(settings.querySelector('[data-crm-metric="removed"]'));
    assert.ok(settings.querySelector('[data-crm-metric="retry-next"]'));
    assert.ok(assertFeatureTable(settings, 'CRM 人员与系统账号对应关系', 'R01 人员对应表') > 0);
    assert.ok(settings.querySelector('[data-crm-result]'));

    const beforeBatches = t.F.load().crm.batches.length;
    click(t, '[data-action="crm-sync"]');
    assert.equal(t.F.load().crm.batches.length, beforeBatches + 1);
    assert.equal(t.F.load().crm.trigger, '手动');

    click(t, '[data-action="crm-view"][data-value="pending"]');
    assert.equal(t.doc.querySelectorAll('[data-crm-pending-list] [data-crm-row]').length, 1);
    click(t, '[data-action="crm-map"][data-value="MAP-203"]');
    change(t, 'mappedOwner', 'U-1004');
    submit(t);
    assert.equal(t.F.load().crm.pendingMappings.find(item => item.id === 'MAP-203').status, 'resolved');
    assert.ok(t.F.load().entitlements.some(item => item.opportunityId === 'OP-304' && item.sales === 'U-1004'));

    click(t, '[data-action="crm-view"][data-value="errors"]');
    const errorRow = t.doc.querySelector('[data-crm-row][data-status="failed"]');
    assert.ok(errorRow);
    click(t, `[data-action="crm-retry"][data-value="${errorRow.dataset.id}"]`);
    assert.equal(t.F.load().crm.alignmentErrors.find(item => item.id === errorRow.dataset.id).status, 'resolved');
    assert.equal(t.F.load().crm.failed, 0);

    click(t, '[data-action="crm-view"][data-value="cutover"]');
    click(t, '[data-action="cutover-start"]');
    assert.equal(t.F.load().migration.status, 'blocked');
    assert.equal(t.F.load().migration.canOpen, false);
    click(t, '[data-action="cutover-fix"]');
    click(t, '[data-action="cutover-start"]');
    assert.equal(t.F.load().migration.status, 'validated');
    click(t, '[data-action="cutover-open"]');
    assert.equal(t.F.load().migration.status, 'open');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R02 空间详情分别展示生命周期与内容就绪度，失败重试不越过冻结边界', () => {
  const failed = load('followup-workbench', '?role=ADM&as=U-1001&space=WS-205&tab=opps');
  try {
    assert.equal(failed.F.space('WS-205').state, 'active');
    assert.equal(failed.F.space('WS-205').readiness, 'failed');
    assert.ok(failed.doc.querySelector('[data-space-lifecycle="active"]'));
    assert.ok(failed.doc.querySelector('[data-space-readiness="failed"]'));
    assert.ok(failed.doc.querySelector('[data-space-failure]'));
    click(failed, '[data-action="space-retry"]');
    assert.equal(failed.F.load().spaces.find(space => space.id === 'WS-205').readiness, 'ready');
    assert.equal(failed.F.load().spaces.find(space => space.id === 'WS-205').state, 'active');
  } finally { failed.close(); }

  const frozen = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-206');
  try {
    assert.ok(frozen.doc.querySelector('[data-space-lifecycle="frozen"]'));
    assert.ok(frozen.doc.querySelector('[data-space-readiness="ready"]'));
    assert.match(frozen.doc.body.textContent, /历史记录可查看/);
    assert.equal(frozen.doc.querySelector('[data-action="followup"]'), null);
    assert.throws(() => frozen.F.addFollowup('WS-206', { text: '冻结后写入' }), /只读/);
    click(frozen, '[data-action="space-history"]');
    assert.ok(frozen.doc.querySelector('[data-space-history]'));
    assert.ok(frozen.doc.querySelector('[data-space-event="frozen"]'));
  } finally { frozen.close(); }

  const admin = load('followup-workbench', '?role=ADM&as=U-1001&space=WS-206');
  try {
    admin.F.retrySpace('WS-206');
    const restoredContent = admin.F.load().spaces.find(space => space.id === 'WS-206');
    assert.equal(restoredContent.readiness, 'ready');
    assert.equal(restoredContent.state, 'frozen');
    assert.equal(admin.F.canWrite(restoredContent), false);
    assert.deepEqual(admin.errors, []);
  } finally { admin.close(); }
});

test('R03 内容范围按层展示，外部资料逐份校验与单份重试互不影响', () => {
  const sol = load('followup-workbench', '?role=SOL&as=U-1010&space=WS-201&tab=documents');
  let saved;
  try {
    // 4.1 内容范围：六层独立状态，不用一个总就绪度覆盖
    const layers = [...sol.doc.querySelectorAll('[data-scope-layer]')];
    assert.equal(layers.length, 6, '内容范围应按六层展示');
    assert.deepEqual(layers.map(node => node.dataset.scopeLayer), ['customer', 'opportunity', 'followup', 'meeting', 'solution', 'document']);

    // 4.2 逐份校验：不合格不提交、重复不重复挂载、同名不同内容作为新增、挂载失败可重试
    const results = sol.F.uploadDocuments('WS-201', ['plan', 'format', 'empty', 'oversize', 'duplicate', 'samename', 'mountfail']);
    const byName = key => results.filter(item => item.status === key);
    assert.equal(byName('rejected').length, 3, '格式、空正文和超限文件均不提交');
    assert.equal(byName('duplicate').length, 1, '内容完全相同的文件不重复挂载');
    assert.equal(byName('success').length, 2, '正常文件与同名不同内容文件均挂载成功');
    assert.equal(byName('failed').length, 1, '挂载失败的文件独立反馈');
    const samename = results.find(item => item.status === 'success' && item.note);
    assert.match(samename.note, /未覆盖旧资料/, '同名不同内容作为新增资料处理');
    assert.equal(sol.F.load().documents.filter(doc => doc.space === 'WS-201' && doc.name === '星辰科技-试点方案v2.md').length, 2, '旧资料仍保留');

    // 单份重试只影响该份资料，同批成功结果不回滚
    const failed = sol.F.load().documents.find(doc => doc.space === 'WS-201' && doc.status === 'failed');
    const successBefore = sol.F.load().documents.filter(doc => doc.space === 'WS-201' && doc.status === 'success').length;
    sol.F.retryDocument(failed.id);
    const after = sol.F.load().documents;
    assert.equal(after.find(doc => doc.id === failed.id).status, 'success');
    assert.equal(after.find(doc => doc.id === failed.id).retryCount, 1);
    assert.equal(after.filter(doc => doc.space === 'WS-201' && doc.status === 'success').length, successBefore + 1);
    saved = sol.save(); assert.deepEqual(sol.errors, []);
  } finally { sol.close(); }

  // 冻结空间不开放上传与重试；承接范围外不提供入口
  const frozen = load('followup-workbench', '?role=SOL&as=U-1011&space=WS-206&tab=documents', saved);
  try {
    assert.equal(frozen.F.canUpload(frozen.F.space('WS-206')), false, '冻结空间不可上传');
    assert.throws(() => frozen.F.uploadDocuments('WS-206', ['plan']), /冻结/);
    assert.equal(frozen.doc.querySelector('[data-action=doc-upload]'), null, '冻结空间不展示上传入口');
  } finally { frozen.close(); }
  const outside = load('followup-workbench', '?role=SOL&as=U-1011&space=WS-201&tab=documents', saved);
  try {
    assert.equal(outside.F.space('WS-201'), undefined, '承接范围外不返回空间');
    assert.throws(() => outside.F.uploadDocuments('WS-201', ['plan']), /承接范围|访问权限/);
  } finally { outside.close(); }
});

test('R04 概览为默认入口，本次变化、依据溯源与冻结问答约束成立', () => {
  const t = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201');
  let saved;
  try {
    // 4.1 五入口固定，概览默认；十个板块齐全
    assert.deepEqual([...t.doc.querySelectorAll('[data-tab]')].map(node => node.dataset.tab), ['overview', 'customer', 'opps', 'followup', 'documents']);
    assert.equal(t.doc.querySelector('[data-tab="overview"]').classList.contains('is-active'), true, '概览是默认入口');
    assert.equal(t.doc.querySelectorAll('[data-overview-panel]').length, 10, '概览应有十个板块');
    assert.ok(t.doc.querySelector('[data-overview-panel="who"] .fp-source-chip'), '结论应带依据入口');

    // 4.2 提交跟进后异步更新，输出新增与前后对比，并给直达入口
    click(t, '[data-action=followup]');
    fill(t, 'text', '客户确认试点在下周启动'); fill(t, 'next', '周三对齐验收指标'); submit(t);
    const latest = t.doc.querySelector('[data-change-latest]');
    assert.equal(latest.querySelector('[data-space-change]').dataset.spaceChange, 'done');
    assert.ok(latest.querySelector('[data-change-added]'), '应展示新增');
    assert.ok(latest.querySelector('[data-change-updated]'), '应展示更新前后对比');
    assert.equal(t.doc.querySelector('[data-update-hint]').dataset.updateHint, 'done');
    assert.ok(t.doc.querySelector('[data-action=goto-overview]'), '有变化时提供直达入口');

    // 快捷问答只读取本空间上下文；无依据时不编造
    click(t, '[data-action=ask][data-value="当前卡点是什么？"]');
    assert.equal(t.doc.querySelector('[data-qa-item]').dataset.qaItem, 'answered');
    const blind = t.F.askSpace('WS-201', '客户的年度采购预算总额是多少？');
    assert.equal(blind.hasEvidence, false);
    assert.match(blind.answer, /没有可用依据/);
    saved = t.save(); assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  // 来源失效保留标识和不可用说明，不伪装成已验证事实
  const sol = load('solution-center', '?role=SOL&as=U-1010', saved);
  let withdrawn;
  try { sol.F.solutionAction('SL-101', 'withdraw'); withdrawn = sol.save(); } finally { sol.close(); }
  const broken = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=overview', withdrawn);
  try {
    const chip = broken.doc.querySelector('.fp-source-chip.is-broken');
    assert.ok(chip, '失效来源仍保留标识');
    assert.match(chip.textContent, /已失效/);
    assert.equal(chip.tagName, 'SPAN', '失效来源不可点击');
  } finally { broken.close(); }

  // 4.3 仅客户级确权时不编造结论；冻结空间只读回看且不开放新问答
  const ownerOnly = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-205&tab=overview', saved);
  try { assert.ok(ownerOnly.doc.querySelector('[data-overview-panel="last"] [data-panel-empty]'), '无依据板块不输出结论'); } finally { ownerOnly.close(); }
  const frozen = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-206&tab=overview', saved);
  try {
    assert.ok(frozen.doc.querySelector('[data-qa-frozen]'), '冻结空间说明不开放新问答');
    assert.equal(frozen.doc.querySelector('[data-action=ask]'), null, '冻结空间隐藏提问入口');
    assert.throws(() => frozen.F.askSpace('WS-206', '当前卡点是什么？'), /冻结/);
    assert.ok(frozen.doc.querySelector('[data-overview-panel]'), '冻结空间历史内容仍可回看');
  } finally { frozen.close(); }
});

test('R05 统一入口展示权限结果，同跟名单不泄露商机内容，承接池变更给出生效提示', () => {
  const sales = load('customer-spaces', '?role=SLS&as=U-1004');
  try {
    const panel = sales.doc.querySelector('[data-permission="granted"]');
    assert.ok(panel, '应展示当前权限结果');
    assert.match(panel.querySelector('[data-permission-read]').textContent, /本人确权商机/);
    assert.match(panel.querySelector('[data-permission-write]').textContent, /本人正常空间/);
  } finally { sales.close(); }

  // 同客户其他销售可见，但其经营内容不返回
  const peer = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=customer');
  try {
    const list = peer.doc.querySelector('[data-co-followers]');
    assert.match(list.textContent, /张云飞/, '同跟名单应包含同客户其他销售');
    assert.match(list.textContent, /经营内容不可见/);
    assert.equal(peer.doc.querySelector('#fp-content').textContent.includes('OP-307'), false, '不泄露其他销售的商机');
  } finally { peer.close(); }

  // 账号停用优先于其他角色规则：不返回内容，也不提示空间存在
  const admin = load('operations-config', '?role=ADM&as=U-1001&tab=people');
  let disabled;
  try {
    admin.F.mutate('停用演示销售', state => { state.people.find(person => person.id === 'U-1004').status = 'off'; });
    disabled = admin.save();
  } finally { admin.close(); }
  const blocked = load('customer-spaces', '?role=SLS&as=U-1004', disabled);
  try {
    assert.equal(blocked.F.visible().length, 0, '停用账号不返回任何空间');
    assert.equal(blocked.F.permissionContext().valid, false);
    assert.match(blocked.F.permissionContext().reason, /停用/);
    assert.equal(blocked.doc.body.textContent.includes('星辰科技'), false, '不暴露空间是否存在');
  } finally { blocked.close(); }

  // 承接池调整后展示当前生效范围、最后更新时间和下次读取生效提示
  const pools = load('operations-config', '?role=ADM&as=U-1001&tab=pools');
  try {
    click(pools, '[data-action=pools][data-value="U-1010"]');
    pools.doc.querySelectorAll('.fp-overlay [name=pools]').forEach(node => { node.checked = false; });
    submit(pools);
    const row = pools.doc.querySelector('[data-pool-row][data-person="U-1010"]');
    assert.match(row.querySelector('[data-pool-scope]').textContent, /未配置/);
    assert.match(row.querySelector('[data-pool-delta]').textContent, /移除 通信线路池/);
    assert.match(row.querySelector('[data-pool-delta]').textContent, /下一次读取生效/);
    assert.notEqual(row.querySelector('[data-pool-updated]').textContent.trim(), '尚未调整');
    assert.equal(pools.F.load().assignments['U-1010'].length, 0);
  } finally { pools.close(); }
});

test('R06 客户归属视图分栏展示当前与历史，异常单独标注且历史只读', () => {
  const t = load('customer-ownership', '?role=MGR&as=U-1002');
  try {
    // 4.1 当前归属：同客户多销售合并展示，确权类型与空间状态可判断
    click(t, '[data-action=ownership-detail][data-value="C-1001"]');
    const current = t.doc.querySelector('[data-ownership-current]');
    assert.equal(current.dataset.ownershipCurrent, 'filled');
    assert.equal(current.querySelectorAll('[data-ownership-sales]').length, 2, '同客户两位当前归属销售');
    assert.ok(current.querySelector('[data-ownership-lifecycle]'), '展示空间生命周期');
    assert.ok(current.querySelector('[data-ownership-readiness]'), '展示内容就绪度');

    // 4.2 历史归属与当前分栏，并明确只读不恢复权限
    const history = t.doc.querySelector('[data-ownership-history]');
    assert.ok(history, '历史归属与当前归属分栏呈现');
    assert.match(history.querySelector('[data-ownership-readonly]').textContent, /不恢复任何销售的访问权限/);
    assert.ok(history.querySelector('[data-history-change="added"]'), '按时间展示进入');
    assert.equal(history.querySelector('[data-action]'), null, '历史区域不提供写入或恢复操作');

    // 待对应人员不计为有效归属；未分配商机不建立销售空间
    click(t, '[data-action=ownership-detail][data-value="C-1004"]');
    const issues = t.doc.querySelector('[data-ownership-issues]');
    assert.match(issues.querySelector('[data-issue="pending"]').textContent, /不计为有效归属销售/);
    assert.match(issues.querySelector('[data-issue="unassigned"]').textContent, /不建立销售空间/);

    // 内容失败的空间不显示为正常可用
    click(t, '[data-action=ownership-detail][data-value="C-1005"]');
    assert.ok(t.doc.querySelector('[data-ownership-failure]'), '内容失败应单独标注');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }

  // 销售不应进入运营归属视图
  const sales = load('customer-ownership', '?role=SLS&as=U-1004');
  try {
    assert.match(sales.doc.body.textContent, /无权访问/);
    assert.equal(sales.doc.querySelector('[data-ownership-row]'), null, '无权角色不返回归属数据');
  } finally { sales.close(); }
});

test('R07 方案人员工作台按客户去重，展开销售空间并从全景抽屉补充资料', () => {
  const t = load('solution-workbench', '?role=SOL&as=U-1010');
  try {
    assert.ok(t.doc.querySelector('.fp-workbench-hero'));
    assert.ok(t.doc.querySelector('.fp-metrics'));
    const customers = [...t.doc.querySelectorAll('[data-customer-row]')];
    assert.ok(customers.length > 0, '应展示承接客户');
    assert.equal(new Set(customers.map(row => row.dataset.customerRow)).size, customers.length, '同一客户只出现一次');

    click(t, '[data-action="customer-expand"]');
    assert.ok(t.doc.querySelector('.fp-customer-spaces'), '展开客户后展示销售空间');
    click(t, '[data-action="space-preview"]');
    assert.ok(t.doc.querySelector('[data-workbench-space]'), '打开空间全景抽屉');
    assert.ok(t.doc.querySelector('[data-action="workbench-upload"]'), '正常空间展示资料补充入口');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
});

test('R08 方案推送支持资产、逐空间结果，反馈看板保留撤回和催办状态', () => {
  const push = load('solution-push', '?role=SOL&as=U-1010');
  let saved;
  try {
    const results = push.F.sendSolution(['WS-201', 'WS-206'], {
      title: '逐空间交付建议', body: '请分别确认试点范围。',
      attachments: [{ name: '交付清单.pdf', size: '80 KB' }], externalLink: 'https://example.com/delivery'
    });
    assert.deepEqual(Array.from(results, item => item.status), ['success', 'failed']);
    const created = push.F.load().solutions.find(item => item.title === '逐空间交付建议' && item.space === 'WS-201');
    assert.equal(created.attachments.length, 1);
    assert.equal(created.attachments[0].name, '交付清单.pdf');
    assert.equal(created.attachments[0].size, '80 KB');
    assert.equal(created.externalLink, 'https://example.com/delivery');
    assert.equal(push.F.load().notifications.some(item => item.solution === created.id && item.type === '方案推送'), true);

    push.F.solutionAction(created.id, 'remind');
    assert.equal(push.F.load().solutions.find(item => item.id === created.id).remindCount, 1);
    saved = push.save();
  } finally { push.close(); }

  const feedback = load('solution-feedback', '?role=SOL&as=U-1010', saved);
  try {
    assert.ok(feedback.doc.querySelector('[data-tab="withdrawn"]'), '反馈看板提供撤回筛选');
    assert.match(feedback.doc.querySelector('[data-feedback-results]').textContent, /已撤回/);
    assert.match(feedback.doc.querySelector('[data-feedback-results]').textContent, /未读/);
    assert.match(feedback.doc.querySelector('[data-feedback-results]').textContent, /催办/);
    click(feedback, '[data-tab="withdrawn"]');
    assert.equal(feedback.doc.querySelector('.fp-table-shell').dataset.rowCount, '1');
    assert.deepEqual(feedback.errors, []);
  } finally { feedback.close(); }
});

test('R12 提醒统一入口：接收人、去重、未送达标注、等待释放与运营隔离', () => {
  // 4.1 方案推送经统一提醒入口生成：接收人、产生时间、去重键与投递结果齐全
  const push = load('solution-push', '?role=SOL&as=U-1010');
  let saved;
  try {
    const results = push.F.sendSolution(['WS-201'], { title: 'R12 触达验证', body: '请确认试点时间。' });
    assert.equal(results[0].status, 'success');
    const notice = push.F.load().notifications.find(item => item.solution === results[0].solutionId && item.type === '方案推送');
    assert.equal(notice.recipient, 'U-1004', '方案推送提醒发给空间归属销售');
    assert.ok(notice.createdAt, '提醒有产生时间');
    assert.equal(notice.dedupKey, `solution-push:${results[0].solutionId}`);
    assert.equal(notice.pushStatus, 'delivered');
    assert.ok(push.F.load().deliveries.some(item => item.notification === notice.id), '每次推送生成一条投递结果');
    saved = push.save();
  } finally { push.close(); }

  // 同一事项重复触发只合并计数，不重复生成
  const dedup = load('message-center', '?role=SLS&as=U-1004', saved);
  let deduped;
  try {
    const before = dedup.F.load().notifications.length;
    dedup.F.mutate('重复触发演示', state => {
      dedup.F.notify(state, { type: '客户更新', title: '客户信息已更新', text: '重复触发', recipients: ['U-1004'], dedupKey: 'customer-update:CHGX-501' });
    });
    const after = dedup.F.load();
    assert.equal(after.notifications.length, before, '同去重键不重复生成提醒');
    assert.equal(after.notifications.find(item => item.dedupKey === 'customer-update:CHGX-501' && item.recipient === 'U-1004').deduped, 1, '重复触发合并计数');
    deduped = dedup.save();
  } finally { dedup.close(); }

  // 4.2/4.3 收件箱：未读优先、产生时间、推送失败站内标注未送达、客户更新直达本次变化、运营异常不触达销售
  const inbox = load('message-center', '?role=SLS&as=U-1004', deduped);
  try {
    const remindRow = inbox.doc.querySelector('[data-message-row][data-type="方案提醒"]');
    assert.match(remindRow.textContent, /推送未送达/, '推送失败站内标注未送达');
    assert.match(remindRow.textContent, /2026-09-15 09:12/, '条目展示产生时间');
    click(inbox, '[data-tab="all"]');
    const changeLink = [...inbox.doc.querySelectorAll('[data-message]')].map(a => a.href).find(href => href.includes('change=CHGX-501'));
    assert.ok(changeLink, '客户更新提醒带 change 直达参数');
    assert.equal(inbox.doc.querySelector('[data-message-row][data-type="运营异常"]'), null, '运营异常不触达销售');
    assert.deepEqual(inbox.errors, []);
  } finally { inbox.close(); }

  // 方案回复提醒只发给方案作者本人，销售收件箱不可见
  const reply = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=solutions', deduped);
  let replied;
  try {
    reply.F.solutionAction('SL-101', 'reply', '客户确认下周三启动试点。');
    const notice = reply.F.load().notifications.find(item => item.type === '方案回复' && item.solution === 'SL-101');
    assert.equal(notice.recipient, 'U-1010', '回复提醒发给方案作者');
    replied = reply.save();
  } finally { reply.close(); }
  const salesInbox = load('message-center', '?role=SLS&as=U-1004', replied);
  try {
    click(salesInbox, '[data-tab="all"]');
    assert.equal([...salesInbox.doc.querySelectorAll('[data-message-row]')].some(row => row.dataset.type === '方案回复'), false, '销售收件箱看不到方案回复提醒');
  } finally { salesInbox.close(); }
  const solInbox = load('message-center', '?role=SOL&as=U-1010', replied);
  try {
    const row = [...solInbox.doc.querySelectorAll('[data-message-row]')].find(item => item.dataset.type === '方案回复' && item.textContent.includes('客户确认下周三启动试点'));
    assert.ok(row, '方案人员收件箱可见回复提醒');
    assert.ok(row.querySelector('[data-message]').href.includes('solution-feedback'), '回复提醒直达反馈看板');
  } finally { solInbox.close(); }

  // 4.4 运营异常只进超管与销售运营收件箱，并直达运营视图
  const admInbox = load('message-center', '?role=ADM&as=U-1001');
  try {
    const ops = [...admInbox.doc.querySelectorAll('[data-message-row][data-type="运营异常"]')];
    assert.ok(ops.length >= 2, '超管收件箱包含运营异常提醒');
    assert.ok(ops.some(row => row.querySelector('[data-message]')?.href.includes('crmView=errors')), '异常提醒直达运营视图');
    assert.deepEqual(admInbox.errors, []);
  } finally { admInbox.close(); }

  // 4.1 边界：归属变化等待空间内容就绪后再提醒；就绪后释放并补一次推送
  const crm = load('operations-config', '?role=ADM&as=U-1001&tab=crm&crmView=pending');
  let mapped;
  try {
    crm.F.resolveCrmMapping('MAP-203', 'U-1005');
    const notice = crm.F.load().notifications.find(item => item.type === '归属变化' && item.recipient === 'U-1005');
    assert.equal(notice.status, 'waiting', '空间未就绪时提醒保持等待');
    assert.equal(notice.pushStatus, 'not_required', '等待中不发起推送');
    mapped = crm.save();
  } finally { crm.close(); }
  const salesWaiting = load('message-center', '?role=SLS&as=U-1005', mapped);
  try {
    click(salesWaiting, '[data-tab="all"]');
    assert.equal([...salesWaiting.doc.querySelectorAll('[data-message-row]')].some(row => row.textContent.includes('云桥数字')), false, '等待中的提醒不进入收件箱');
  } finally { salesWaiting.close(); }
  const retry = load('customer-spaces', '?role=ADM&as=U-1001', mapped);
  try {
    const space = retry.F.load().spaces.find(item => item.customerId === 'C-1004' && item.sales === 'U-1005');
    retry.F.retrySpace(space.id);
    const notice = retry.F.load().notifications.find(item => item.type === '归属变化' && item.recipient === 'U-1005');
    assert.equal(notice.status, 'active', '空间就绪后提醒释放');
    assert.equal(notice.pushStatus, 'delivered', '释放时发起一次推送');
    assert.ok(retry.F.load().deliveries.some(item => item.notification === notice.id), '释放时生成投递结果');
  } finally { retry.close(); }

  // 4.3 超管投递结果查询：按状态筛选；飞书触达页签已移除
  const ops = load('operations-config', '?role=ADM&as=U-1001&tab=notify');
  try {
    assert.equal(ops.doc.querySelector('[data-tab="feishu"]'), null, '飞书触达页签已移除');
    assert.ok(ops.doc.querySelector('[data-tab="notify"]'), '消息触达页签存在');
    assertFeatureTable(ops.doc.querySelector('[data-settings]'), '提醒事件与接收人清单', 'R12/提醒中心');
    click(ops, '[data-action="notify-view"][data-value="delivery"]');
    assertFeatureTable(ops.doc.querySelector('[data-settings]'), '移动端推送投递结果清单', 'R12/投递结果');
    change(ops, 'status', 'failed');
    const rows = [...ops.doc.querySelectorAll('[data-delivery-row]')];
    assert.ok(rows.length > 0 && rows.every(row => row.dataset.status === 'failed'), '投递结果按状态筛选');
    assert.deepEqual(ops.errors, []);
  } finally { ops.close(); }

  // 投递结果非超管不可见
  const mgr = load('operations-config', '?role=MGR&as=U-1002&tab=notify&notifyView=delivery');
  try {
    assert.match(mgr.doc.querySelector('[data-settings]').textContent, /仅超级管理员可查/);
    assert.equal(mgr.doc.querySelector('[data-delivery-row]'), null, '销售运营看不到投递数据');
  } finally { mgr.close(); }
});

test('R15 行为记录：四态分区展示、一事件一记录、与客户事实分离、不阻塞不提醒', () => {
  // 跟进 Tab 新增行为记录子页签；旧别名 tab=behaviors 落到该子页签
  const t = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=followup&sub=behaviors');
  try {
    assert.deepEqual([...t.doc.querySelectorAll('[data-subtab]')].map(n => n.dataset.subtab), ['followups', 'behaviors', 'solutions', 'recordings']);
    assert.ok(t.doc.querySelector('[data-subtab="behaviors"]').classList.contains('is-active'));
    assertFeatureTable(t.doc.querySelector('[data-tab-body]'), '星辰科技有限公司 的销售行为记录', 'R15/行为记录');
    const statuses = [...t.doc.querySelectorAll('[data-behavior-row]')].map(row => row.dataset.status);
    assert.ok(statuses.includes('done') && statuses.includes('processing'), 'WS-201 含已完成与处理中');
    assert.equal(t.doc.querySelector('[data-tab-body]').textContent.includes('技术团队已完成初步验证'), false, '行为记录区不混入跟进记录正文');
    assert.deepEqual(t.errors, []);
  } finally { t.close(); }
  const alias = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=behaviors');
  try {
    assert.ok(alias.doc.querySelector('[data-subtab="behaviors"]').classList.contains('is-active'), 'tab=behaviors 别名落到行为记录子页签');
  } finally { alias.close(); }

  // 失败与无可用内容各自成立，不补造内容
  const failed = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-202&tab=followup&sub=behaviors');
  try {
    const row = failed.doc.querySelector('[data-behavior-row][data-status="failed"]');
    assert.ok(row, 'WS-202 含生成失败记录');
    assert.match(row.textContent, /行为分析服务超时/);
  } finally { failed.close(); }
  const empty = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-203&tab=followup&sub=behaviors');
  try {
    assert.match(empty.doc.querySelector('[data-behavior-row][data-status="empty"]').textContent, /无可用内容/);
  } finally { empty.close(); }

  // 详情抽屉：五段内容 + 依据点回事件原文；behavior 参数直达
  const detail = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=followup&sub=behaviors&behavior=BR-501');
  try {
    const drawer = detail.doc.querySelector('[data-behavior-detail]');
    assert.ok(drawer, 'behavior 参数直达详情抽屉');
    for (const label of ['沟通摘要', '关键行为', '问题或风险', '改进方向', '下次补问']) assert.match(drawer.textContent, new RegExp(label));
    click(detail, '.fp-overlay [data-action="source"]');
    assert.ok(detail.doc.querySelectorAll('.fp-overlay').length >= 2, '依据可点回事件原文');
  } finally { detail.close(); }

  // 跟进事件卡片关联行为记录状态
  const followups = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=followup&sub=followups');
  try {
    assert.match(followups.doc.querySelector('[data-tab-body]').textContent, /行为记录 · 已完成/, '跟进事件卡片关联行为记录状态');
  } finally { followups.close(); }

  // 生成规则：手写跟进同批一条；同事件不重复；过短记无可用内容；失败不阻塞客户信息且不发提醒
  const gen = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201');
  let saved;
  try {
    const before = gen.F.load().behaviorRecords.length;
    gen.F.addFollowup('WS-201', { opportunityId: 'OP-301', type: '电话沟通', text: '客户确认试点启动，下周验收', next: '周三对齐验收指标' });
    const after = gen.F.load();
    assert.equal(after.behaviorRecords.length, before + 1, '手写跟进同批生成一条行为记录');
    assert.equal(after.behaviorRecords[0].status, 'done');
    const fu = after.followups[0];
    gen.F.mutate('重复触发演示', state => {
      const result = gen.F.generateBehavior(state, state.spaces.find(item => item.id === 'WS-201'), { eventType: 'followup', eventId: fu.id, text: fu.text });
      assert.equal(result, null, '同一事件不重复生成');
    });
    assert.equal(gen.F.load().behaviorRecords.length, before + 1);

    gen.F.addFollowup('WS-201', { opportunityId: 'OP-301', type: '电话沟通', text: '短跟进', next: '' });
    assert.equal(gen.F.load().behaviorRecords[0].status, 'empty', '内容过短记无可用内容');

    const notesBefore = gen.F.load().notifications.length;
    gen.F.addFollowup('WS-201', { opportunityId: 'OP-301', type: '电话沟通', text: '客户要求演示失败分支验证，本次沟通内容足够长', next: '' });
    const afterFail = gen.F.load();
    assert.equal(afterFail.behaviorRecords[0].status, 'failed', '演示失败分支落失败状态');
    assert.equal(afterFail.spaceChanges[0].status, 'done', '行为记录失败不阻塞客户信息更新');
    const newNotes = afterFail.notifications.slice(0, afterFail.notifications.length - notesBefore);
    assert.ok(newNotes.length >= 1 && newNotes.every(n => n.type === '客户更新'), '行为记录本身不产生提醒');
    saved = gen.save();
  } finally { gen.close(); }

  // 冻结空间：历史只读可见，不生成新记录
  const frozen = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-206&tab=followup&sub=behaviors', saved);
  try {
    assert.ok(frozen.doc.querySelector('[data-behavior-row][data-status="done"]'), '冻结空间历史行为记录只读可见');
    const state = frozen.F.load();
    const space = state.spaces.find(item => item.id === 'WS-206');
    assert.equal(frozen.F.generateBehavior(state, space, { eventType: 'followup', eventId: 'FU-X', text: '冻结后不应生成新记录' }), null, '冻结空间不生成新记录');
  } finally { frozen.close(); }

  // 权限：承接方案人员可读；销售看不到他人空间的行为记录
  const sol = load('followup-workbench', '?role=SOL&as=U-1010&space=WS-201&tab=followup&sub=behaviors', saved);
  try {
    assert.ok(sol.doc.querySelector('[data-behavior-row]'), '承接方案人员可读行为记录');
  } finally { sol.close(); }
  const sales = load('customer-spaces', '?role=SLS&as=U-1004', saved);
  try {
    assert.equal(sales.F.behaviorsOf('WS-207').length, 0, '无权空间不返回行为记录');
  } finally { sales.close(); }

  // R14 只读接口：只返回窗口内已完成记录
  const r14 = load('customer-spaces', '?role=MGR&as=U-1002', saved);
  try {
    const done = r14.F.completedBehaviors(r14.F.load(), { start: '2026-09-14 00:00', end: '2026-09-15 23:59' });
    assert.ok(done.length > 0 && done.every(record => record.status === 'done'), '日报只读取已完成记录');
    assert.equal(done.some(record => record.id === 'BR-503'), false, '处理中不进入汇总');
  } finally { r14.close(); }

  // 录音子页签展示行为记录状态；录音归位同批生成行为记录
  const rec = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-202&tab=followup&sub=recordings', saved);
  try {
    assertFeatureTable(rec.doc.querySelector('[data-tab-body]'), '远山物流有限公司 的客户录音归位', 'R15/录音行为记录列');
    assert.match(rec.doc.querySelector('[data-tab-body]').textContent, /已完成/, '录音关联行为记录状态');
  } finally { rec.close(); }
  const meet = load('meeting-center', '?role=SLS&as=U-1004', saved);
  try {
    const placement = meet.F.placeRecording('MT-101', { space: 'WS-201', opportunityId: 'OP-301' });
    assert.ok(meet.F.load().behaviorRecords.some(record => record.eventType === 'meeting' && record.eventId === placement.id), '录音归位同批生成行为记录');
    assert.deepEqual(meet.errors, []);
  } finally { meet.close(); }
});

test('R13 今日该跟：快照消费、标记次日生效、跑批提醒与提示词编排闭环', () => {
  // 页面注册与表格契约：销售页两张表，运营页四个分面各一张表
  const sales = load('today-follow', '?role=SLS&as=U-1004');
  try {
    assert.equal(assertFeatureTable(sales.doc.querySelector('[data-today-list]'), '今日该跟名单', 'R13/今日名单'), 4, 'U-1004 当日入选 4 条');
    assert.ok(assertFeatureTable(sales.doc.querySelector('[data-mark-list]'), '我的标记记录', 'R13/标记记录') > 0, '标记记录含种子');
    // 4.3 消费呈现：三种状态种类齐全；界面不出现提示词名；快照口径完整
    const listText = sales.doc.querySelector('[data-today-list]').textContent;
    for (const label of ['停滞', '有进展', '待决策']) assert.match(listText, new RegExp(label), `名单含${label}`);
    assert.equal(sales.doc.querySelector('#fp-content').textContent.includes('提示词'), false, '销售侧不出现提示词名');
    const statusBar = sales.doc.querySelector('[data-insight-status="generated"]');
    assert.ok(statusBar, '产出状态条存在');
    assert.match(statusBar.textContent, /产出日期/);
    assert.match(statusBar.textContent, /输入截止/);
    assert.match(statusBar.textContent, /2026-09-15 08:25/);
    assert.match(statusBar.textContent, /策略版本/);
    // 进入空间链接指向客户空间
    assert.ok(sales.doc.querySelector('[data-insight-row="WS-201"] a[href*="followup-workbench"][href*="space=WS-201"]'), '进入空间链接');
    // 依据抽屉：原文 + 步骤业务措辞 + 录音入口
    click(sales, '[data-insight-row="WS-202"] [data-action="evidence"]');
    const evidenceDrawer = sales.doc.querySelector('[data-evidence-drawer]');
    assert.ok(evidenceDrawer, '依据抽屉打开');
    for (const label of ['状态判断', '顺序建议', '动作建议']) assert.match(evidenceDrawer.textContent, new RegExp(label), `依据标注${label}`);
    assert.match(evidenceDrawer.textContent, /按通知类型拆分短信模板/, '依据含方案原文');
    const meetingLink = evidenceDrawer.querySelector('a[href*="meeting-center"][href*="meeting=MT-102"]');
    assert.ok(meetingLink, '录音依据给进入该条录音入口');
    sales.doc.querySelector('.fp-overlay [data-close]').click();
    // 转写未就绪的录音依据有标明
    click(sales, '[data-insight-row="WS-203"] [data-action="evidence"]');
    assert.match(sales.doc.querySelector('[data-evidence-drawer]').textContent, /转写未就绪/);
    sales.doc.querySelector('.fp-overlay [data-close]').click();
    // 截断说明 footer
    assert.match(sales.doc.querySelector('[data-today-list]').textContent, /未入选/);
    assert.deepEqual(sales.errors, []);
  } finally { sales.close(); }

  // 三种空态 + 失败分支 + 无可判断空间，均保留客户列表入口且不展示名单条目
  const emptyCases = [
    ['U-1005', /没有足够依据/, '空名单'],
    ['U-1008', /尚未生成/, '产出时点未到'],
    ['U-1009', /尚无可以判断的跟进空间/, '无可判断空间']
  ];
  for (const [actor, pattern, context] of emptyCases) {
    const t = load('today-follow', `?role=SLS&as=${actor}`);
    try {
      assert.match(t.doc.querySelector('[data-insight-empty]').textContent, pattern, `R13/${context}`);
      assert.ok(t.doc.querySelector('[data-insight-empty] a[href*="customer-spaces"]'), `${context}保留客户列表入口`);
      assert.equal(t.doc.querySelector('[data-insight-row]'), null, `${context}不渲染名单条目`);
      assert.deepEqual(t.errors, []);
    } finally { t.close(); }
  }
  const failed = load('today-follow', '?role=SLS&as=U-1006');
  try {
    assert.match(failed.doc.querySelector('[data-insight-empty]').textContent, /生成失败/, '失败分支空态');
    assert.match(failed.doc.querySelector('[data-insight-status="failed"]').textContent, /状态判断服务超时/, '失败原因可见');
    assert.equal(failed.doc.querySelector('[data-insight-row]'), null, '失败不渲染任何名单条目');
    assert.ok(failed.doc.querySelector('a[href*="customer-spaces"]'), '失败分支保留客户列表入口');
  } finally { failed.close(); }

  // 4.2 标记规则：快照不变、原因必填、结束日校验、重复以最新为准、取消生效、冻结与仅客户级拒绝、运营无权
  const mark = load('today-follow', '?role=SLS&as=U-1004');
  try {
    const entriesBefore = JSON.stringify(mark.F.todaySnapshot(mark.F.load(), 'U-1004').entries);
    mark.F.markSpace('WS-201', { starred: true });
    assert.equal(JSON.stringify(mark.F.todaySnapshot(mark.F.load(), 'U-1004').entries), entriesBefore, '标记不改变当天快照');
    assert.throws(() => mark.F.markSpace('WS-201', { pause: { reason: '  ', until: '' } }), /原因/, '暂不跟进原因必填');
    assert.throws(() => mark.F.markSpace('WS-201', { pause: { reason: '客户暂停', until: '2026-09-14' } }), /结束日/, '结束日不早于今天');
    mark.F.markSpace('WS-201', { pause: { reason: '客户内部评审', until: '2026-09-20' } });
    const logLength = mark.F.load().insightMarks.find(item => item.space === 'WS-201').log.length;
    mark.F.markSpace('WS-201', { pause: { reason: '客户改期', until: '2026-09-22' } });
    const latest = mark.F.load().insightMarks.find(item => item.space === 'WS-201');
    assert.equal(latest.pause.reason, '客户改期', '重复标记以最新一次为准');
    assert.equal(latest.log.length, logLength + 1, '重复标记写变更日志');
    assert.ok(mark.F.activeMarks(mark.F.load(), 'U-1004').some(item => item.space === 'WS-201'), '生效标记进入次日输入');
    mark.F.markSpace('WS-201', { cancel: true });
    assert.equal(mark.F.activeMarks(mark.F.load(), 'U-1004').some(item => item.space === 'WS-201'), false, '取消后不再作为次日输入');
    assert.throws(() => mark.F.markSpace('WS-206', { starred: true }), /冻结/, '冻结空间拒绝标记');
    assert.throws(() => mark.F.markSpace('WS-205', { starred: true }), /仅客户级/, '仅客户级确权拒绝标记');
    // 结束日已过的暂不跟进不再作为信号
    assert.equal(mark.F.activeMarks(mark.F.load(), 'U-1004').some(item => item.space === 'WS-204'), false, '结束日已过自动失效');
    assert.deepEqual(mark.errors, []);
  } finally { mark.close(); }
  const mgrMark = load('insight-ops', '?role=MGR&as=U-1002');
  try {
    assert.throws(() => mgrMark.F.markSpace('WS-201', { starred: true }), /归属销售/, '运营无权标记');
  } finally { mgrMark.close(); }

  // 页面级标记交互：星标一键开关、暂不跟进空原因阻止、记录表三态与取消
  const ui = load('today-follow', '?role=SLS&as=U-1004');
  let uiSaved;
  try {
    click(ui, '[data-insight-row="WS-201"] [data-action="star"]');
    assert.equal(ui.F.load().insightMarks.find(item => item.space === 'WS-201')?.starred, true, '星标一键写入');
    click(ui, '[data-insight-row="WS-201"] [data-action="pause"]');
    fill(ui, 'until', '2026-09-30');
    submit(ui);
    assert.match(ui.doc.querySelector('.fp-overlay .fp-error').textContent, /原因/, '填结束日但不填原因时阻止保存');
    fill(ui, 'reason', '客户采购流程暂停');
    submit(ui);
    assert.equal(ui.F.load().insightMarks.find(item => item.space === 'WS-201').pause.reason, '客户采购流程暂停');
    assert.match(ui.doc.querySelector('[data-mark-row="WS-204"]').textContent, /已失效/, '结束日已过展示已失效');
    assert.match(ui.doc.querySelector('[data-mark-row="WS-203"]').textContent, /生效中/, '生效中标记展示');
    click(ui, '[data-mark-row="WS-203"] [data-action="mark-cancel"]');
    assert.match(ui.doc.querySelector('[data-mark-row="WS-203"]').textContent, /已取消/, '取消后展示已取消');
    uiSaved = ui.save();
    assert.deepEqual(ui.errors, []);
  } finally { ui.close(); }

  // 客户空间 hero 标记入口：本人正常有商机空间提供，冻结与仅客户级不提供；两边展示同一状态
  const ws201 = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201', uiSaved);
  try {
    assert.ok(ws201.doc.querySelector('[data-action="space-mark"]'), '客户空间 hero 提供标记入口');
    assert.match(ws201.doc.querySelector('.fp-hero-chips').textContent, /已星标/, '空间内展示与今日页一致的标记状态');
  } finally { ws201.close(); }
  const ws206 = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-206');
  try { assert.equal(ws206.doc.querySelector('[data-action="space-mark"]'), null, '冻结空间无标记入口'); } finally { ws206.close(); }
  const ws205 = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-205');
  try { assert.equal(ws205.doc.querySelector('[data-action="space-mark"]'), null, '仅客户级确权无标记入口'); } finally { ws205.close(); }

  // 4.1 跑批与 R12 提醒：pending→generated、去重键、投递记录、收件箱直达、当日不重算
  const ops = load('insight-ops', '?role=MGR&as=U-1002');
  let opsSaved;
  try {
    const result = ops.F.runInsightBatch('U-1008');
    assert.equal(result.status, 'generated', '尚未生成的快照被正式产出替换');
    assert.equal(ops.F.todaySnapshot(ops.F.load(), 'U-1008').status, 'generated');
    const notice = ops.F.load().notifications.find(item => item.type === '今日该跟' && item.recipient === 'U-1008');
    assert.ok(notice, '已生成提醒发给归属销售');
    assert.equal(notice.dedupKey, 'insight:U-1008:2026-09-15');
    assert.equal(notice.link.page, 'today-follow', '提醒直达今日该跟');
    assert.ok(ops.F.load().deliveries.some(item => item.notification === notice.id), '每次推送生成一条投递结果');
    assert.throws(() => ops.F.runInsightBatch('U-1008'), /不重复跑批|已产出/, '当天已有终态快照不重算');
    // 整批失败：只发运营异常（不推送），不打扰销售
    const failedResult = ops.F.runInsightBatch('U-1009', { demoFail: true });
    assert.equal(failedResult.status, 'failed');
    const opsNotice = ops.F.load().notifications.find(item => item.type === '运营异常' && item.title === '今日该跟产出失败');
    assert.ok(opsNotice, '失败产生运营异常提醒');
    const opsRecipients = ops.F.load().notifications.filter(item => item.dedupKey === 'ops:insight-failed:U-1009:2026-09-15').map(item => item.recipient);
    assert.deepEqual([...opsRecipients].sort(), ['U-1001', 'U-1002', 'U-1003'], '运营异常只发超管与销售运营');
    assert.equal(opsNotice.pushStatus, 'not_required', '运营异常不发起移动端推送');
    assert.equal(ops.F.load().notifications.some(item => item.recipient === 'U-1009' && item.type === '运营异常'), false, '失败不打扰销售');
    opsSaved = ops.save();
    assert.deepEqual(ops.errors, []);
  } finally { ops.close(); }
  const inbox = load('message-center', '?role=SLS&as=U-1008', opsSaved);
  try {
    const row = inbox.doc.querySelector('[data-message-row][data-type="今日该跟"]');
    assert.ok(row, '销售收件箱可见今日该跟提醒');
    assert.ok(row.querySelector('[data-message]').href.includes('today-follow'), '收件箱直达今日该跟');
  } finally { inbox.close(); }
  // 三份提示词尚无生效版：保持尚未生成，不产出名单也不提醒
  const noActive = JSON.parse(opsSaved);
  noActive.insight.prompts.action.active = null;
  const noActivePage = load('insight-ops', '?role=MGR&as=U-1002', JSON.stringify(noActive));
  try {
    const result = noActivePage.F.runInsightBatch('U-1013');
    assert.equal(result.status, 'pending', '提示词无生效版时保持尚未生成');
    assert.equal(noActivePage.F.load().notifications.some(item => item.type === '今日该跟' && item.recipient === 'U-1013'), false, '未生成不提醒销售');
  } finally { noActivePage.close(); }

  // 4.4 编排：空正文阻止、无草稿不能试跑、不勾空间不能试跑、试下游缺上游不能试、试跑不写线上、上线次日生效、回退、覆盖=默认删除
  const arrange = load('insight-ops', '?role=MGR&as=U-1002');
  try {
    assert.throws(() => arrange.F.savePromptDraft('status', '  '), /为空/, '提示词为空阻止保存');
    assert.throws(() => arrange.F.runPromptTrial('status', ['WS-201']), /草稿/, '未保存草稿不能试跑');
    assert.throws(() => arrange.F.runPromptTrial('ranking', [], 'trial'), /勾选/, '试跑空间未勾选不执行');
    assert.throws(() => arrange.F.runPromptTrial('ranking', ['WS-201'], ''), /上游/, '试排序缺上游来源不能试');
    const snapshotsBefore = JSON.stringify(arrange.F.load().insight.snapshots);
    const marksBefore = arrange.F.load().insightMarks.length;
    const trial = arrange.F.runPromptTrial('ranking', ['WS-201', 'WS-206'], 'online');
    assert.equal(trial.spaces.find(item => item.space === 'WS-206').frozen, true, '冻结样本仍可试跑并标明');
    assert.equal(JSON.stringify(arrange.F.load().insight.snapshots), snapshotsBefore, '试跑不写线上名单');
    assert.equal(arrange.F.load().insightMarks.length, marksBefore, '试跑不写标记');
    // 上线：次日生效、草稿清空、发布留痕、当日快照不变
    arrange.F.savePromptDraft('status', '新状态口径：补充待决策的判定示例。');
    const logBefore = arrange.F.load().insight.publishLog.length;
    const todayBefore = JSON.stringify(arrange.F.todaySnapshot(arrange.F.load(), 'U-1004'));
    arrange.F.publishPrompt('status');
    const published = arrange.F.load().insight.prompts.status;
    assert.equal(published.active.version, 'v4');
    assert.equal(published.active.effectiveFrom, '2026-09-16', '上线从下一自然日生效');
    assert.equal(published.draft, null, '上线后草稿清空');
    assert.equal(arrange.F.load().insight.publishLog.length, logBefore + 1, '上线写发布记录');
    assert.equal(JSON.stringify(arrange.F.todaySnapshot(arrange.F.load(), 'U-1004')), todayBefore, '上线不改变当日已产出快照');
    arrange.F.rollbackPrompt('status');
    assert.equal(arrange.F.load().insight.prompts.status.active.version, 'v3', '回退恢复上一生效版');
    // 产出时点：覆盖值等于默认视为取消
    arrange.F.setInsightSchedule({ overrides: { 'U-1005': '09:00' } });
    assert.equal(arrange.F.load().insight.schedule.overrides['U-1005'], '09:00');
    arrange.F.setInsightSchedule({ overrides: { 'U-1005': '08:30' } });
    assert.equal('U-1005' in arrange.F.load().insight.schedule.overrides, false, '覆盖值等于默认视为取消覆盖');
    assert.throws(() => arrange.F.setInsightSchedule({ defaultTime: '25:00' }), /HH:MM/, '时点格式校验');
    assert.deepEqual(arrange.errors, []);
  } finally { arrange.close(); }
  const salesArrange = load('today-follow', '?role=SLS&as=U-1004');
  try {
    assert.throws(() => salesArrange.F.savePromptDraft('status', '销售越权'), /销售运营|超级管理员/, '销售无权编排提示词');
    assert.throws(() => salesArrange.F.runInsightBatch('U-1004'), /销售运营|超级管理员/, '销售无权跑批');
  } finally { salesArrange.close(); }

  // 运营页表格契约与分面交互：修订记录、试跑对照、发布记录、产出时点、产出记录
  const opsPage = load('insight-ops', '?role=MGR&as=U-1002');
  try {
    assert.ok(assertFeatureTable(opsPage.doc.querySelector('[data-prompt-revisions]'), '提示词修订记录', 'R13/修订记录') > 0);
    assert.match(opsPage.doc.querySelector('[data-prompt="ranking"]').textContent, /有未上线草稿/, '保存不等于上线');
    click(opsPage, '[data-tab="trial"]');
    assertFeatureTable(opsPage.doc.querySelector('[data-trial-result]'), '试跑对照结果', 'R13/试跑对照');
    assert.ok(assertFeatureTable(opsPage.doc.querySelector('[data-trial-history]'), '试跑历史记录', 'R13/试跑历史') > 0);
    // 页面级试跑：切到排序、勾选空间、提交后出对照
    change(opsPage, 'kind', 'ranking');
    const trialForm = opsPage.doc.querySelector('[data-trial-form]');
    assert.ok(trialForm.querySelector('[name="upstream"]'), '试排序需选上游来源');
    trialForm.querySelector('[name="spaces"][value="WS-201"]').checked = true;
    trialForm.querySelector('[name="spaces"][value="WS-206"]').checked = true;
    submit(opsPage, '[data-trial-form]');
    assert.equal(opsPage.doc.querySelectorAll('[data-trial-row]').length, 2, '试跑出对照结果');
    assert.match(opsPage.doc.querySelector('[data-trial-row="WS-206"]').textContent, /已冻结/, '冻结样本在对照中标明');
    click(opsPage, '[data-tab="publish"]');
    assert.ok(assertFeatureTable(opsPage.doc.querySelector('[data-publish-log]'), '提示词发布记录', 'R13/发布记录') > 0);
    click(opsPage, '[data-tab="schedule"]');
    assert.ok(assertFeatureTable(opsPage.doc.querySelector('[data-schedule-table]'), '产出时点覆盖', 'R13/产出时点') > 0);
    assert.match(opsPage.doc.querySelector('[data-schedule-row="U-1008"]').textContent, /10:30/, '按销售覆盖时点展示');
    click(opsPage, '[data-tab="batches"]');
    assert.ok(assertFeatureTable(opsPage.doc.querySelector('[data-batch-table]'), '今日该跟产出记录', 'R13/产出记录') > 0);
    assert.match(opsPage.doc.querySelector('[data-batch-row="U-1006"]').textContent, /状态判断服务超时/, '运营可查看失败原因');
    click(opsPage, '[data-batch-row="U-1004"] [data-action="batch-view"]');
    assert.ok(opsPage.doc.querySelector('[data-snapshot-drawer]'), '查看快照抽屉');
    assert.match(opsPage.doc.querySelector('[data-snapshot-drawer]').textContent, /状态 v3 · 排序 v2 · 动作 v5/, '快照记录三份提示词各自版本');
    assert.deepEqual(opsPage.errors, []);
  } finally { opsPage.close(); }

  // 截断：注入 6 个可判断空间跑批，名单只保留 5 条且截断数留痕，页面说明未入选入口
  const seedPage = load('customer-spaces', '?role=MGR&as=U-1002');
  let injected;
  try { injected = JSON.parse(seedPage.save()); } finally { seedPage.close(); }
  for (let i = 0; i < 6; i++) {
    injected.spaces.push({ id: 'WS-9' + (10 + i), customerId: 'C-1001', customer: '星辰科技有限公司', industry: '通讯', sales: 'U-1009', pool: '通信线路池', state: 'active', stage: '方案推进', grade: 'A', contact: '李女士', updated: '2026-09-14 10:20', opps: [{ id: 'OP-9' + (10 + i), name: '通信线路接入', amount: 20, stage: '方案验证' }], brief: '注入空间 ' + i, entitlementType: 'customer_and_opportunity', entitlements: { customer: true, opportunities: ['OP-9' + (10 + i)] }, createdAt: '2026-09-10 09:00' });
    injected.followups.push({ id: 'FU-9' + (10 + i), space: 'WS-9' + (10 + i), author: 'U-1009', date: '2026-09-14 16:30', type: '电话沟通', text: '注入跟进内容，足够形成判断依据 ' + i, next: '确认下次沟通时间。' });
  }
  const trunc = load('insight-ops', '?role=MGR&as=U-1002', JSON.stringify(injected));
  let truncSaved;
  try {
    const result = trunc.F.runInsightBatch('U-1009');
    assert.equal(result.entries.length, 5, '名单最多 5 条');
    assert.equal(result.truncated, 1, '截断数留痕');
    truncSaved = trunc.save();
  } finally { trunc.close(); }
  const truncView = load('today-follow', '?role=SLS&as=U-1009', truncSaved);
  try {
    assert.match(truncView.doc.querySelector('[data-today-list]').textContent, /另有 1 个空间未入选/, '截断说明保留客户列表入口');
    assert.deepEqual(truncView.errors, []);
  } finally { truncView.close(); }

  // 运营提醒中心直达目标文案：今日该跟事件直达「今日该跟」
  const notify = load('operations-config', '?role=ADM&as=U-1001&tab=notify');
  try {
    const row = [...notify.doc.querySelectorAll('[data-notify-row]')].find(item => item.dataset.type === '今日该跟');
    assert.ok(row, '提醒中心包含今日该跟事件');
    const targetCell = row.cells[2].cloneNode(true);
    targetCell.querySelector('.fp-table-cell-label')?.remove();
    assert.equal(targetCell.textContent.trim(), '今日该跟', '直达目标文案映射');
    assert.deepEqual(notify.errors, []);
  } finally { notify.close(); }

  // 菜单：客户跟进空间仍是销售首项，今日该跟紧随其后；运营菜单在经营洞察后依次挂销售目标与进度、经营洞察编排
  const slsMenu = load('customer-spaces', '?role=SLS&as=U-1004');
  try {
    const keys = [...slsMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.deepEqual(keys.slice(0, 2), ['customer-spaces', 'today-follow'], '销售菜单顺序');
  } finally { slsMenu.close(); }
  const mgrMenu = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    const keys = [...mgrMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    // R17 起经营洞察后先挂销售目标与进度，再挂经营洞察编排。
    assert.equal(keys.indexOf('sales-goals'), keys.indexOf('employee-insights') + 1, '运营菜单顺序（销售目标与进度紧随经营洞察）');
    assert.equal(keys.indexOf('insight-ops'), keys.indexOf('sales-goals') + 1, '运营菜单顺序（经营洞察编排除目标页之后）');
  } finally { mgrMenu.close(); }
});

test('R14 晚间日报：状态分支、权限快照、提醒接口与运营发布', () => {
  // 页面注册与销售视角（US-R14-01/02/03/06）：总览、七栏客户块、只含本人、部分成功列出失败客户
  const sales = load('daily-report', '?role=SLS&as=U-1004');
  try {
    const statusBar = sales.doc.querySelector('[data-daily-status="partial"]');
    assert.ok(statusBar, 'DR-0915 部分成功状态条');
    assert.match(statusBar.textContent, /2026-09-14 18:30 → 2026-09-15 18:30/, '报告窗口');
    assert.match(statusBar.textContent, /2026-09-15 18:30/, '输入截止');
    assert.match(statusBar.textContent, /M072-v2/, '提示词版本');
    // 今日总览：六类齐全，注明不含优先级排名与下一步动作
    const overview = sales.doc.querySelector('[data-daily-overview]');
    assert.ok(overview, '销售可见今日总览');
    for (const key of ['progress', 'risks', 'pending', 'solutionCustomers', 'crossPatterns']) assert.ok(overview.querySelector(`[data-daily-overview-cat="${key}"]`), `总览含 ${key}`);
    assert.match(overview.textContent, /不含优先级排名与下一步动作/);
    assert.match(overview.textContent, /有效客户 2/);
    // 客户块七栏固定结构；WS-201 含行为归纳与待确认
    const block = sales.doc.querySelector('[data-daily-block="WS-201"]');
    assert.ok(block, '本人客户块存在');
    for (const key of ['current', 'keyChanges', 'impact', 'pending', 'behavior', 'collaboration', 'sources']) assert.ok(block.querySelector(`[data-daily-section="${key}"]`), `七栏之 ${key}`);
    assert.match(block.querySelector('[data-daily-section="pending"]').textContent, /验收负责人/);
    assert.match(block.querySelector('[data-daily-section="behavior"]').textContent, /参与记录 2 条/, '跨事件行为归纳');
    assert.ok(block.querySelector('a[href*="followup-workbench"][href*="space=WS-201"]'), '客户空间入口');
    // WS-202 部分完整标记 + 空栏目显示「本时段无新增」
    const block202 = sales.doc.querySelector('[data-daily-block="WS-202"]');
    assert.match(block202.textContent, /部分完整/);
    assert.match(block202.textContent, /部分信息尚未更新/);
    assert.match(block202.querySelector('[data-daily-section="behavior"]').textContent, /本时段无新增/);
    // 只含本人客户块（WS-207 属于 U-1005）
    assert.equal(sales.doc.querySelector('[data-daily-block="WS-207"]'), null, '不含他人客户块');
    // 部分成功：权限内失败客户列表
    const failed = sales.doc.querySelector('[data-daily-failed]');
    assert.ok(failed, '部分成功展示未能生成的客户');
    assert.match(failed.textContent, /启明教育/);
    // 30 天历史：表格契约 + 三态齐全 + empty 日不出现
    assert.ok(assertFeatureTable(sales.doc.querySelector('[data-daily-history]'), '晚间日报历史快照', 'R14/历史快照') > 0);
    const historyText = sales.doc.querySelector('[data-daily-history]').textContent;
    for (const label of ['成功', '部分成功', '失败']) assert.match(historyText, new RegExp(label), `历史含${label}`);
    assert.equal(historyText.includes('2026-09-12'), false, '无有效变化日不进用户历史');
    assert.deepEqual(sales.errors, []);
  } finally { sales.close(); }

  // 全部失败日（US-R14-07）：顶部提示未沿用昨日，无客户块
  const failedDay = load('daily-report', '?role=SLS&as=U-1004&date=2026-09-13');
  try {
    assert.ok(failedDay.doc.querySelector('[data-daily-status="failed"]'), '失败状态条');
    assert.match(failedDay.doc.querySelector('[data-daily-failed-callout]').textContent, /未沿用昨日/);
    assert.equal(failedDay.doc.querySelector('[data-daily-block]'), null, '失败日无客户块');
    assert.match(failedDay.doc.querySelector('[data-daily-failed]').textContent, /星辰科技/, '失败客户列出');
    assert.deepEqual(failedDay.errors, []);
  } finally { failedDay.close(); }

  // 无快照日期与无有效变化日：页面自身给空态说明
  const noReport = load('daily-report', '?role=SLS&as=U-1004&date=2026-09-10');
  try {
    assert.match(noReport.doc.querySelector('[data-daily-empty]').textContent, /没有该日期的日报/);
  } finally { noReport.close(); }
  const emptyDay = load('daily-report', '?role=SLS&as=U-1004&date=2026-09-12');
  try {
    assert.ok(emptyDay.doc.querySelector('[data-daily-status="empty"]'), 'empty 日状态条');
    assert.match(emptyDay.doc.querySelector('[data-daily-empty]').textContent, /无有效变化/);
  } finally { emptyDay.close(); }

  // 方案人员视角（US-R14-04）：无总览、承接块合集、部分完整标记
  const sol = load('daily-report', '?role=SOL&as=U-1010');
  try {
    assert.equal(sol.doc.querySelector('[data-daily-overview]'), null, '方案人员无今日总览');
    const blocks = [...sol.doc.querySelectorAll('[data-daily-block]')];
    assert.deepEqual(blocks.map(b => b.dataset.dailyBlock).sort(), ['WS-201', 'WS-202'], '承接块合集');
    assert.equal(new Set(blocks.map(b => b.dataset.dailyBlock)).size, blocks.length, '客户块去重');
    assert.match(sol.doc.querySelector('[data-daily-block="WS-202"]').textContent, /部分完整/);
    assert.equal(sol.doc.querySelector('[data-daily-block="WS-203"]'), null, '失败客户不生成客户块');
    assert.deepEqual(sol.errors, []);
  } finally { sol.close(); }

  // 历史权限重过滤（US-DR-08 关键点二）：承接池收回后失权客户块不可见
  const mgr = load('operations-config', '?role=ADM&as=U-1001&tab=pools');
  let revoked;
  try {
    mgr.F.mutate('收回承接池演示', state => { state.assignments['U-1010'] = ['智能短信池']; });
    revoked = mgr.save();
  } finally { mgr.close(); }
  const solRevoked = load('daily-report', '?role=SOL&as=U-1010', revoked);
  try {
    assert.equal(solRevoked.doc.querySelector('[data-daily-block="WS-201"]'), null, '失权客户块不可见');
    assert.ok(solRevoked.doc.querySelector('[data-daily-block="WS-202"]'), '仍承接的客户块可见');
    assert.equal(solRevoked.doc.querySelector('[data-daily-block="WS-201"] a[href*="followup-workbench"]'), null, '失权入口不出现');
  } finally { solRevoked.close(); }

  // R12 接口：种子提醒字段齐全、收件箱直达日报页、失败提醒一次
  const inbox = load('message-center', '?role=SLS&as=U-1004');
  try {
    const state = inbox.F.load();
    const notice = state.notifications.find(n => n.type === '日报送达' && n.recipient === 'U-1004');
    assert.ok(notice, 'DR-0915 日报送达提醒存在');
    assert.equal(notice.dedupKey, 'daily-report:DR-0915');
    assert.equal(notice.link.page, 'daily-report');
    assert.equal(notice.link.params.date, '2026-09-15');
    assert.equal(notice.pushStatus, 'delivered', '强档推送已送达');
    assert.ok(state.deliveries.some(d => d.notification === notice.id), '投递结果存在');
    assert.ok(state.notifications.some(n => n.type === '日报送达' && n.recipient === 'U-1010' && n.dedupKey === 'daily-report:DR-0915'), '方案人员同报告各收一份');
    const row = inbox.doc.querySelector('[data-message-row][data-type="日报送达"]');
    assert.ok(row, '收件箱可见日报送达');
    assert.ok(row.querySelector('[data-message]').href.includes('daily-report'), '直达日报页');
    assert.ok(row.querySelector('[data-message]').href.includes('date=2026-09-15'), '带日期参数');
    const failNotices = state.notifications.filter(n => n.type === '日报失败' && n.recipient === 'U-1004');
    assert.equal(failNotices.length, 1, '全部失败只发一次失败提醒');
    assert.equal(failNotices[0].dedupKey, 'daily-report-failed:DR-0913');
    assert.equal(state.notifications.filter(n => n.dedupKey === 'daily-report:DR-0913').length, 0, '失败日不产生日报内容条目');
    assert.equal(state.notifications.some(n => n.type === '日报送达' && n.dedupKey === 'daily-report:DR-0912'), false, '无有效变化不发提醒');
    assert.deepEqual(inbox.errors, []);
  } finally { inbox.close(); }

  // 当日重跑拒绝（C9：重复生成只保留一份）；销售无权运营操作
  const opsRun = load('operations-config', '?role=MGR&as=U-1002&tab=daily');
  try {
    assert.throws(() => opsRun.F.runDailyReport(), /只保留一份|已生成/, '当日已有结果拒绝重跑');
  } finally { opsRun.close(); }
  const salesOps = load('daily-report', '?role=SLS&as=U-1004');
  try {
    assert.throws(() => salesOps.F.runDailyReport(), /销售运营|超级管理员/, '销售无权生成日报');
    assert.throws(() => salesOps.F.saveDailyPrompt('changeDetection', '销售越权'), /销售运营|超级管理员/, '销售无权编排日报提示词');
    assert.throws(() => salesOps.F.setDailyReportTime('19:00'), /销售运营|超级管理员/, '销售无权改时间');
  } finally { salesOps.close(); }

  // 运营 runs 表与详情抽屉：排除原因、失败客户、进入下一窗口、runLog；empty 日可见
  const ops = load('operations-config', '?role=MGR&as=U-1002&tab=daily');
  try {
    assert.ok(assertFeatureTable(ops.doc.querySelector('[data-daily-runs]'), '晚间日报运行记录', 'R14/运行记录') >= 4, '运行记录含 empty 日');
    assert.match(ops.doc.querySelector('[data-daily-runs]').textContent, /2026-09-12/, 'empty 日在运营记录可见');
    click(ops, '[data-daily-run-row="DR-0915"] [data-action="daily-detail"]');
    const drawer = ops.doc.querySelector('[data-daily-run-detail]');
    assert.ok(drawer, '详情抽屉打开');
    assert.match(drawer.textContent, /仅客户级确权/, '排除原因');
    assert.match(drawer.textContent, /空间已于窗口内冻结/, '冻结排除原因');
    assert.match(drawer.textContent, /启明教育/, '失败客户');
    assert.match(drawer.textContent, /CHGX-502/, '进入下一窗口');
    assert.match(drawer.textContent, /窗口确定/, '运行日志');
    ops.doc.querySelector('.fp-overlay [data-close]').click();
    // 种子 DR-0915 重试：WS-203 同窗口仍无成功结果，保持失败并保留前次记录
    const before = ops.F.load().dailyReports.find(r => r.id === 'DR-0915');
    const logBefore = before.runLog.length;
    const retry = ops.F.retryDailyReportFailures('DR-0915');
    assert.equal(retry.recovered, 0, '同窗口无新结果时重试无恢复');
    assert.equal(retry.remaining, 1, '同窗口无新结果时重试仍失败');
    const after = ops.F.load().dailyReports.find(r => r.id === 'DR-0915');
    assert.equal(after.runLog.length, logBefore + 1, '重试写运行日志');
    assert.equal(after.failedCustomers.length, 1, '失败客户保留');
    assert.equal(after.status, 'partial', '状态不被重试改写');
    assert.deepEqual(ops.errors, []);
  } finally { ops.close(); }

  // 提示词编排：草稿/发布/回退/次日生效；时间设置校验；试跑上限与不写线上
  const arrange = load('operations-config', '?role=MGR&as=U-1002&tab=daily&dailyView=prompts');
  try {
    assert.equal(arrange.doc.querySelectorAll('[data-daily-prompt]').length, 4, '四份提示词卡片');
    assert.match(arrange.doc.querySelector('[data-daily-prompt="behaviorSummary"]').textContent, /有未发布草稿/, '保存不等于发布');
    assert.throws(() => arrange.F.saveDailyPrompt('blockGeneration', '  '), /为空/, '空内容阻止保存');
    arrange.F.saveDailyPrompt('blockGeneration', '客户块生成修订：七栏顺序固定，必需栏目不可信即失败。');
    let config = arrange.F.load().dailyReportConfig;
    assert.equal(config.prompts.blockGeneration.draft.savedBy, 'U-1002', '草稿留保存人');
    assert.equal(config.versions.find(v => v.status === 'active').id, 'M072-v2', '保存草稿不改生效版');
    assert.throws(() => arrange.F.publishDailyPrompts(), /有效草稿/, '草稿不齐阻止发布');
    arrange.F.saveDailyPrompt('changeDetection', '有效变化判断修订：补充冲突口径示例。');
    arrange.F.saveDailyPrompt('overviewGeneration', '今日总览生成修订：补充跨客户模式口径。');
    const logBefore = arrange.F.load().dailyReportConfig.publishLog.length;
    arrange.F.publishDailyPrompts();
    config = arrange.F.load().dailyReportConfig;
    assert.equal(config.versions[0].id, 'M072-v3', '四份整体一个新版本');
    assert.equal(config.versions[0].status, 'active');
    assert.equal(config.versions[0].effectiveFrom, '2026-09-16', '下一自然日生效');
    assert.equal(config.versions[1].status, 'superseded', '上一版退回历史');
    assert.equal(config.prompts.blockGeneration.draft, null, '发布后草稿清空');
    assert.equal(config.publishLog.length, logBefore + 1, '发布留痕');
    arrange.F.rollbackDailyPrompts();
    config = arrange.F.load().dailyReportConfig;
    assert.equal(config.versions.find(v => v.status === 'active').id, 'M072-v2', '回退到上一完整生效版');
    assert.equal(config.versions.find(v => v.status === 'active').effectiveFrom, '2026-09-16', '回退同样次日生效');
    // 时间设置：HH:MM 校验 + 次日生效
    arrange.F.setDailyReportTime('19:00');
    config = arrange.F.load().dailyReportConfig;
    assert.equal(config.globalTime, '19:00');
    assert.equal(config.timeEffectiveFrom, '2026-09-16', '时间调整次日生效');
    assert.throws(() => arrange.F.setDailyReportTime('25:00'), /HH:MM/, '非法格式抛错');
    // 试跑：上限 3 个空间；不写线上、不发消息、不写当日汇总
    assert.throws(() => arrange.F.trialRunDailyReport(['WS-201', 'WS-202', 'WS-203', 'WS-204']), /最多选择 3 个/, '试跑空间上限');
    const reportsBefore = arrange.F.load().dailyReports.length;
    const notesBefore = arrange.F.load().notifications.length;
    const behaviorsBefore = arrange.F.load().behaviorRecords.length;
    const trialsBefore = arrange.F.load().dailyReportConfig.trialRuns.length;
    const trial = arrange.F.trialRunDailyReport(['WS-201', 'WS-202']);
    assert.deepEqual(Object.keys(trial.steps).sort(), ['behaviorSummary', 'blockGeneration', 'changeDetection', 'overviewGeneration'].sort(), '四步过程结果');
    assert.equal(arrange.F.load().dailyReports.length, reportsBefore, '试跑不写日报');
    assert.equal(arrange.F.load().notifications.length, notesBefore, '试跑不发消息');
    assert.equal(arrange.F.load().behaviorRecords.length, behaviorsBefore, '试跑不写当日汇总');
    assert.equal(arrange.F.load().dailyReportConfig.trialRuns.length, trialsBefore + 1, '试跑留记录');
    assert.deepEqual(arrange.errors, []);
  } finally { arrange.close(); }

  // 完整状态机：移除当日种子后重跑——消费窗口内真实输入、送达提醒、写回当日汇总、重试两分支
  const seedPage = load('daily-report', '?role=MGR&as=U-1002');
  let injected;
  try { injected = JSON.parse(seedPage.save()); } finally { seedPage.close(); }
  injected.dailyReports = injected.dailyReports.filter(r => r.reportDate !== '2026-09-15');
  injected.behaviorRecords = injected.behaviorRecords.filter(r => r.eventType !== 'daily_summary');
  injected.notifications = injected.notifications.filter(n => !String(n.dedupKey || '').startsWith('daily-report'));
  const rerun = load('operations-config', '?role=MGR&as=U-1002&tab=daily', JSON.stringify(injected));
  let rerunSaved;
  try {
    const report = rerun.F.runDailyReport();
    assert.equal(report.reportDate, '2026-09-15');
    assert.equal(report.status, 'partial', 'WS-203 全部上游不可用 → 部分成功');
    assert.equal(report.windowStart, '2026-09-14 18:30', '窗口从上一计划截止连续衔接');
    assert.equal(report.windowEnd, '2026-09-15 18:30');
    assert.equal(report.promptVersion, 'M072-v2', '使用当前生效版');
    assert.deepEqual([...report.blocks].map(b => b.space).sort(), ['WS-201', 'WS-202'], '有效客户块');
    assert.equal(report.blocks.find(b => b.space === 'WS-202').status, 'partial', '上游部分失败标记部分完整');
    assert.match(report.blocks.find(b => b.space === 'WS-202').missingNote, /部分信息尚未更新/);
    assert.equal(report.failedCustomers.length, 1, '失败客户记录');
    assert.equal(report.failedCustomers[0].customer, '启明教育科技有限公司');
    assert.ok(report.carriedOver.some(item => item.changeId === 'CHGX-502'), '仍在处理进入下一窗口');
    assert.ok(report.excluded.some(item => item.space === 'WS-205' && /仅客户级确权/.test(item.reason)), '仅客户级确权排除');
    assert.ok(report.excluded.some(item => item.space === 'WS-206' && /冻结/.test(item.reason)), '冻结空间排除');
    assert.equal(report.overview.effectiveCount, 2, '总览有效客户数');
    // 接收人：销售 U-1004 + 方案 U-1010；号码认证池的 U-1011 无可读内容不接收
    assert.deepEqual([...report.recipients].map(r => r.person).sort(), ['U-1004', 'U-1010'], '截止时锁定并复核');
    const state = rerun.F.load();
    const delivered = state.notifications.filter(n => n.type === '日报送达' && n.dedupKey === 'daily-report:DR-0915');
    assert.deepEqual([...delivered].map(n => n.recipient).sort(), ['U-1004', 'U-1010'], '日报送达按人一份');
    assert.ok(delivered.every(n => n.link.page === 'daily-report' && n.pushStatus === 'delivered'), '强档推送');
    assert.equal(state.notifications.some(n => n.recipient === 'U-1011' && n.type === '日报送达'), false, '无承接内容不打扰');
    // 当日汇总：仅 WS-201 有跨事件结论（2 条窗口内已完成记录），至多一条
    const summaries = state.behaviorRecords.filter(r => r.eventType === 'daily_summary');
    assert.equal(summaries.length, 1, '只写回一条当日汇总');
    assert.equal(summaries[0].kind, '当日汇总');
    assert.equal(summaries[0].eventId, 'daily-summary:2026-09-15:WS-201');
    assert.equal(summaries[0].status, 'done');
    // 重试仍失败分支：同窗口无新结果
    const retryFail = rerun.F.retryDailyReportFailures('DR-0915');
    assert.equal(retryFail.recovered, 0);
    assert.equal(retryFail.remaining, 1);
    rerunSaved = rerun.save();
    assert.deepEqual(rerun.errors, []);
  } finally { rerun.close(); }

  // 重试恢复分支：同窗口补到最新成功结果后更新失败项，前次失败记录保留
  const recoveredState = JSON.parse(rerunSaved);
  recoveredState.spaceChanges.unshift({ id: 'CHGX-590', space: 'WS-203', at: '2026-09-15 16:00', source: 'followup', sourceRef: '', sourceLabel: '跟进记录（客户拜访）', status: 'done', baseVersion: 'content-WS-203-v3', resultVersion: 'content-WS-203-v4', notified: false, added: ['客户内部已确认预算决策时间：本周五前'], updated: [], pendingConfirm: ['采购预算金额待确认'], conflicts: [] });
  const retryPage = load('operations-config', '?role=MGR&as=U-1002&tab=daily', JSON.stringify(recoveredState));
  try {
    const notesBefore = retryPage.F.load().notifications.length;
    const result = retryPage.F.retryDailyReportFailures('DR-0915');
    assert.equal(result.recovered, 1, '失败项以同窗口最新成功结果恢复');
    assert.equal(result.remaining, 0);
    const report = retryPage.F.load().dailyReports.find(r => r.id === 'DR-0915');
    assert.equal(report.status, 'success', '失败项恢复后整份转成功');
    assert.equal(report.previousFailures.length, 1, '前次失败记录保留');
    assert.equal(report.previousFailures[0].customer, '启明教育科技有限公司');
    assert.ok(report.blocks.some(b => b.space === 'WS-203'), '恢复的客户块进入日报');
    assert.equal(retryPage.F.load().notifications.length, notesBefore, '补发送达按去重键合并，不重复打扰');
    assert.equal(retryPage.F.load().notifications.find(n => n.dedupKey === 'daily-report:DR-0915' && n.recipient === 'U-1004').deduped, 1, '重复触发合并计数');
    assert.deepEqual(retryPage.errors, []);
  } finally { retryPage.close(); }

  // 菜单：SLS 首项仍是 customer-spaces，今日该跟、销售目标与进度（R17）、晚报依次随后；SOL 插在工作台后；ADM/MGR 不进菜单
  const slsMenu = load('customer-spaces', '?role=SLS&as=U-1004');
  try {
    const keys = [...slsMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.deepEqual(keys.slice(0, 4), ['customer-spaces', 'today-follow', 'sales-goals', 'daily-report'], '销售菜单顺序');
  } finally { slsMenu.close(); }
  const solMenu = load('solution-workbench', '?role=SOL&as=U-1010');
  try {
    const keys = [...solMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.deepEqual(keys.slice(0, 2), ['solution-workbench', 'daily-report'], '方案菜单顺序');
  } finally { solMenu.close(); }
  const mgrMenu = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    const keys = [...mgrMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.equal(keys.includes('daily-report'), false, '运营菜单不含晚间日报（从运营配置 daily 页签进运行记录）');
  } finally { mgrMenu.close(); }
});

test('R16 AI 文档与能力可运营化：接管、分权填写、skill 三态、沙盒验证门禁与逐销售发布', () => {
  // 页面注册与表格契约：五个二级分面 + 回传文档清单；种子分支（未接管只读 / 冲突待核对 / 历史发布失败与未加载 / adjust 验证）齐全
  const adm = load('ai-capability', '?role=ADM&as=U-1001');
  try {
    assert.deepEqual([...adm.doc.querySelectorAll('[data-tab]')].map(n => n.dataset.tab), ['docs', 'modules', 'skills', 'sandbox', 'publish'], '五个二级分面');
    assert.ok(assertFeatureTable(adm.doc.querySelector('[data-doc-list]'), 'OpenClaw 回传文档清单', 'R16/文档') > 0);
    const docC = adm.doc.querySelector('[data-doc-row="DOC-C"]');
    assert.ok(docC.querySelector('[data-action="doc-takeover"]'), '未接管文档提供接管入口');
    assert.equal(docC.querySelector('[data-action="doc-edit"]'), null, '未接管文档不提供编辑入口');
    assert.match(docC.textContent, /未接管 · 只读/);
    assert.match(docC.textContent, /不进入同步/);
    assert.match(adm.doc.querySelector('[data-doc-row="DOC-D"]').textContent, /回传版本较新 · 待核对/, '冲突标注');
    click(adm, '[data-tab="sandbox"]');
    assert.match(adm.doc.querySelector('[data-ai]').textContent, /新会话无历史/);
    assert.match(adm.doc.querySelector('[data-ai]').textContent, /只读真实数据/);
    assert.match(adm.doc.querySelector('[data-ai]').textContent, /不写入生产/);
    assert.ok(assertFeatureTable(adm.doc.querySelector('[data-validation-list]'), '沙盒验证轮次记录', 'R16/验证轮次') > 0);
    assert.match(adm.doc.querySelector('[data-validation-list]').textContent, /需要调整/, '种子含 adjust 结论分支');
    click(adm, '[data-tab="publish"]');
    assert.ok(assertFeatureTable(adm.doc.querySelector('[data-release-list]'), '文档发布逐销售结果', 'R16/发布记录') > 0);
    assert.match(adm.doc.querySelector('[data-release-row="REL-B3"][data-release-sales="U-1005"]').textContent, /未加载新版 · 继续使用 v2/, '未加载目标标注回退版本');
    const failedSeed = adm.doc.querySelector('[data-release-row="REL-B3"][data-release-sales="U-1008"]');
    assert.match(failedSeed.textContent, /失败/);
    assert.ok(failedSeed.querySelector('[data-action="release-retry"]'), '失败项可重试');
    assert.ok(assertFeatureTable(adm.doc.querySelector('[data-version-list]'), '文档版本时间线', 'R16/版本时间线') > 0);
    // 已结束的验证只读回看
    click(adm, '[data-tab="sandbox"]');
    click(adm, '[data-validation-row="VAL-A3"] [data-action="validation-open"]');
    const valDrawer = adm.doc.querySelector('[data-validation-drawer]');
    assert.ok(valDrawer, '验证抽屉打开');
    assert.match(valDrawer.textContent, /SES-A3/);
    assert.match(valDrawer.textContent, /只读/);
    assert.equal(valDrawer.querySelector('[data-action="val-judge"]'), null, '已结束验证只读回看');
    adm.doc.querySelector('.fp-overlay [data-close]').click();
    assert.deepEqual(adm.errors, []);
  } finally { adm.close(); }

  // 接管：ADM 接管后 managed 并生成本地基线；重复接管报错；MGR 改正文 / 接管均抛错
  const take = load('ai-capability', '?role=ADM&as=U-1001');
  try {
    take.F.takeoverDoc('DOC-C');
    const doc = take.F.load().aiDocs.documents.find(d => d.id === 'DOC-C');
    assert.equal(doc.managed, true);
    assert.ok(doc.versions.length > 0, '接管生成本地基线版本');
    assert.throws(() => take.F.takeoverDoc('DOC-C'), /已接管/);
  } finally { take.close(); }
  const mgrBody = load('ai-capability', '?role=MGR&as=U-1002');
  try {
    assert.throws(() => mgrBody.F.saveDocBody('DOC-A', [{ title: '沟通原则', body: '越权修改' }]), /仅超级管理员/);
    assert.throws(() => mgrBody.F.takeoverDoc('DOC-C'), /仅超级管理员/);
    assert.equal(mgrBody.doc.querySelector('[data-action="doc-edit"]'), null, 'MGR 不显示正文编辑入口');
    assert.equal(mgrBody.doc.querySelector('[data-action="doc-takeover"]'), null, 'MGR 不显示接管入口');
  } finally { mgrBody.close(); }

  // 差异与冲突：diffDoc 非空；保留本地后本地未发布草稿保留、冲突标记清除
  const conflict = load('ai-capability', '?role=ADM&as=U-1001');
  try {
    click(conflict, '[data-doc-row="DOC-D"] [data-action="doc-diff"]');
    const drawer = conflict.doc.querySelector('[data-doc-diff]');
    assert.ok(drawer, '差异抽屉打开');
    assert.match(drawer.textContent, /回传版本晚于本地/);
    assert.ok(drawer.querySelector('[data-action="doc-resolve"]'), '冲突待核对时提供处理入口');
    conflict.doc.querySelector('.fp-overlay [data-close]').click();
    const diff = conflict.F.diffDoc('DOC-D');
    assert.ok(diff.rows.length > 0, '回传与本地存在差异行');
    const draftBefore = JSON.stringify(conflict.F.load().aiDocs.documents.find(d => d.id === 'DOC-D').draft);
    conflict.F.resolveDocConflict('DOC-D', 'local');
    const doc = conflict.F.load().aiDocs.documents.find(d => d.id === 'DOC-D');
    assert.equal(doc.conflict, '', '冲突标记已核对');
    assert.equal(JSON.stringify(doc.draft), draftBefore, '保留本地未发布版本');
    assert.deepEqual(conflict.errors, []);
  } finally { conflict.close(); }

  // 分权填写：MGR 只见授权模块；越权 / 引用不存在 / 场景缺失均抛错；重复引用去重；预览不含说明与模块名
  const mgr = load('ai-capability', '?role=MGR&as=U-1002&tab=modules');
  try {
    assert.ok(assertFeatureTable(mgr.doc.querySelector('[data-module-list]'), '待填写模块清单', 'R16/运营填写') > 0);
    assert.ok(mgr.doc.querySelector('[data-module-row="MOD-A1"]'), '授权模块展示');
    assert.equal(mgr.doc.querySelector('[data-module-row="MOD-A2"]'), null, '未授权模块不展示');
    click(mgr, '[data-module-row="MOD-A1"] [data-action="module-fill"]');
    const fillForm = mgr.doc.querySelector('[data-module-fill]');
    assert.ok(fillForm, '填写抽屉打开');
    assert.match(fillForm.textContent, /填写说明/);
    assert.ok(fillForm.querySelector('[name=skill]'), '填写抽屉含 skill 多选');
    click(mgr, '.fp-overlay [data-action="preview-doc"]');
    const overlays = [...mgr.doc.querySelectorAll('.fp-overlay')];
    const previewDrawer = overlays[overlays.length - 1];
    assert.match(previewDrawer.textContent, /实际文档/);
    assert.equal(previewDrawer.textContent.includes('填写说明原文'), false, '预览不含填写说明');
    previewDrawer.querySelector('[data-close]').click();
    mgr.doc.querySelector('.fp-overlay [data-close]').click();
    assert.throws(() => mgr.F.fillModule('DOC-A', 'MOD-A2', { content: '越权填写' }), /未授权|越权/);
    mgr.F.fillModule('DOC-A', 'MOD-A1', { content: '客户觉得贵时先对齐业务量与验收口径，再给同行案例。', skillRefs: [{ skillId: 'SK-1', scenario: '客户要求同行案例时调用' }, { skillId: 'SK-1', scenario: '重复引用' }] });
    const mod = mgr.F.load().aiDocs.documents.find(d => d.id === 'DOC-A').draft.modules.find(m => m.id === 'MOD-A1');
    assert.equal(mod.skillRefs.length, 1, '重复引用以同一能力为准');
    assert.equal(mod.skillRefs[0].version, 'v1.4.0', '固定版本引用');
    assert.throws(() => mgr.F.fillModule('DOC-A', 'MOD-A1', { content: 'x', skillRefs: [{ skillId: 'SK-X', scenario: '不存在' }] }), /不存在/);
    assert.throws(() => mgr.F.fillModule('DOC-A', 'MOD-A1', { content: 'x', skillRefs: [{ skillId: 'SK-1', scenario: ' ' }] }), /适用场景/);
    const preview = mgr.F.previewDoc('DOC-A');
    assert.match(preview, /客户觉得贵时先对齐业务量/);
    assert.match(preview, /同行案例库/);
    assert.equal(preview.includes('填写说明原文'), false, '填写说明不进入实际文档');
    assert.equal(preview.includes('价格沟通'), false, '模块名称不进入实际文档');
    assert.deepEqual(mgr.errors, []);
  } finally { mgr.close(); }
  const admMod = load('ai-capability', '?role=ADM&as=U-1001&tab=modules');
  try {
    assert.ok(admMod.doc.querySelector('[data-module-row="MOD-A2"]'), '超管可见全部模块');
    assertFeatureTable(admMod.doc.querySelector('[data-module-list]'), '填写模块配置清单', 'R16/模块配置');
  } finally { admMod.close(); }

  // skill 三态与失效提醒：三 badge 齐全；失效引用定位模块；置不可用只提醒运营（不推送、不打扰销售）
  const sk = load('ai-capability', '?role=MGR&as=U-1002&tab=skills');
  let skSaved;
  try {
    assertFeatureTable(sk.doc.querySelector('[data-skill-list]'), '外部 SkillHub 能力清单', 'R16/skill 清单');
    const text = sk.doc.querySelector('[data-skill-list]').textContent;
    for (const label of ['可用', '不可用', '暂无法核实']) assert.match(text, new RegExp(label));
    assert.match(sk.doc.querySelector('[data-skill-broken]').textContent, /报价测算器/, '失效引用提示列出不可用 skill');
    assert.match(sk.doc.querySelector('[data-skill-broken]').textContent, /交付范围说明/, '失效引用定位到模块');
    sk.F.markSkill('SK-1', 'unavailable');
    const notices = sk.F.load().notifications.filter(n => n.dedupKey === 'ops:skill-down:SK-1');
    assert.deepEqual([...notices.map(n => n.recipient)].sort(), ['U-1001', 'U-1002', 'U-1003'], 'skill 失效只提醒启用中超管与运营');
    assert.ok(notices.every(n => n.type === '能力发布' && n.pushStatus === 'not_required'), '运营异常不发起推送');
    assert.equal(sk.F.load().notifications.some(n => n.dedupKey === 'ops:skill-down:SK-1' && n.recipient === 'U-1004'), false, '销售无此提醒');
    skSaved = sk.save();
    assert.deepEqual(sk.errors, []);
  } finally { sk.close(); }
  const salesInbox = load('message-center', '?role=SLS&as=U-1004', skSaved);
  try {
    click(salesInbox, '[data-tab="all"]');
    assert.equal([...salesInbox.doc.querySelectorAll('[data-message-row]')].some(row => row.textContent.includes('同行案例库」不可用')), false, '销售收件箱看不到 skill 失效提醒');
  } finally { salesInbox.close(); }

  // 验证门禁：无草稿不能验证；未验证不能发布；出题绑定只读会话；fail 题不得 passed；内容再改旧验证作废
  const gate = load('ai-capability', '?role=ADM&as=U-1001');
  try {
    assert.throws(() => gate.F.publishDoc('DOC-A'), /没有待发布的草稿/, '无草稿不能发布');
    assert.throws(() => gate.F.startValidation('DOC-A'), /没有待验证的草稿/, '无草稿不能验证');
    gate.F.saveDocBody('DOC-A', [
      { id: 'SEC-A1', title: '沟通原则', body: '优先引用客户空间内已确认的事实；不确定时说明缺少的信息，不推测、不承诺。' },
      { id: 'SEC-A2', title: '场景指引', body: '客户询问同行案例时，先确认行业与业务规模，再给出可核实的案例来源；补充大客户场景。' }
    ]);
    assert.throws(() => gate.F.publishDoc('DOC-A'), /未.*验证/, '未验证不能发布');
    const v = gate.F.startValidation('DOC-A');
    assert.ok(v.questions.length > 0, '按改动生成评测题');
    assert.match(v.questions[0].changeRef, /场景指引/, '评测题标明对应改动');
    assert.equal(v.session.readonly, true, '沙盒会话只读');
    assert.throws(() => gate.F.startValidation('DOC-A'), /进行中/, '已有进行中验证不重复发起');
    gate.F.answerValidation(v.id, v.questions[0].id);
    assert.match(gate.F.load().aiDocs.validations.find(x => x.id === v.id).questions[0].answer, /只读/, '演示回答标注只读');
    v.questions.forEach((q, i) => gate.F.judgeValidation(v.id, q.id, i === 0 ? 'fail' : 'pass', i === 0 ? '回答未覆盖新口径' : '符合预期'));
    assert.throws(() => gate.F.finishValidation(v.id, 'passed'), /不通过/, '存在不通过题时不得通过');
    gate.F.finishValidation(v.id, 'failed');
    const v2 = gate.F.startValidation('DOC-A');
    v2.questions.forEach(q => gate.F.judgeValidation(v2.id, q.id, 'pass', '符合预期'));
    gate.F.finishValidation(v2.id, 'passed');
    gate.F.saveDocBody('DOC-A', [
      { id: 'SEC-A1', title: '沟通原则', body: '优先引用客户空间内已确认的事实；不确定时说明缺少的信息，不推测、不承诺。' },
      { id: 'SEC-A2', title: '场景指引', body: '客户询问同行案例时，先确认行业与业务规模，再给出来源；补充大客户与集团客户场景。' }
    ]);
    assert.throws(() => gate.F.publishDoc('DOC-A'), /未.*验证|内容已变化/, '内容再改后旧验证作废');
    assert.deepEqual(gate.errors, []);
  } finally { gate.close(); }

  // 逐销售发布：部分失败不显示全量成功、发运营提醒；失败可重试；未加载标注继续使用 v2
  const pub = load('ai-capability', '?role=MGR&as=U-1002&tab=publish');
  try {
    const card = pub.doc.querySelector('[data-publish-doc="DOC-B"]');
    assert.ok(card, '待发布区展示草稿');
    assert.match(card.textContent, /验证通过 · 可发布/, '种子草稿已验证待发布');
    assert.match(pub.doc.querySelector('[data-publish-doc="DOC-D"]').textContent, /未完成验证/, '未验证草稿发布门禁说明');
    pub.F.fillModule('DOC-B', 'MOD-B1', { content: '客户询问交付范围时，先按已确权商机的产品清单说明，再给分阶段交付建议，以合同为准；补充验收口径。', skillRefs: [{ skillId: 'SK-2', scenario: '客户询问报价区间或交付周期测算时调用' }] });
    assert.throws(() => pub.F.publishDoc('DOC-B'), /未.*验证|内容已变化/, '内容再改后旧验证作废');
    const v = pub.F.startValidation('DOC-B');
    assert.equal(v.session.readonly, true);
    v.questions.forEach(q => pub.F.judgeValidation(v.id, q.id, 'pass', '符合预期'));
    pub.F.finishValidation(v.id, 'passed');
    const release = pub.F.publishDoc('DOC-B');
    const bySales = Object.fromEntries(release.targets.map(t => [t.sales, t]));
    assert.equal(bySales['U-1008'].deliver, 'failed', '演示部分失败');
    assert.equal(bySales['U-1005'].deliver, 'success');
    assert.equal(bySales['U-1005'].loaded, false);
    assert.equal(bySales['U-1005'].loadedVersion, 'v2', '未加载新版继续使用最近成功版本');
    assert.equal(bySales['U-1004'].effective, true);
    const notices = pub.F.load().notifications.filter(n => n.dedupKey === `ops:publish-fail:${release.id}`);
    assert.deepEqual([...notices.map(n => n.recipient)].sort(), ['U-1001', 'U-1002', 'U-1003'], '部分失败只提醒运营');
    assert.ok(notices.every(n => n.type === '能力发布' && n.pushStatus === 'not_required' && n.link.page === 'ai-capability'), '失败提醒直达发布分面且不推送');
    click(pub, '[data-tab="publish"]');
    const listText = pub.doc.querySelector('[data-release-list]').textContent;
    assert.equal(listText.includes('全部成功'), false, '部分失败不显示全量成功');
    const row1005 = pub.doc.querySelector(`[data-release-row="${release.id}"][data-release-sales="U-1005"]`);
    assert.match(row1005.textContent, /已送达/);
    assert.match(row1005.textContent, /未加载新版 · 继续使用 v2/);
    pub.F.retryPublishTarget(release.id, 'U-1008');
    const retried = pub.F.load().aiDocs.releases.find(r => r.id === release.id).targets.find(t => t.sales === 'U-1008');
    assert.equal(retried.deliver, 'success');
    assert.equal(retried.loaded, true);
    assert.equal(retried.effective, true);
    assert.equal(retried.retryCount, 1);
    assert.throws(() => pub.F.retryPublishTarget(release.id, 'U-1004'), /失败/, '仅失败目标可重试');
    assert.deepEqual(pub.errors, []);
  } finally { pub.close(); }

  // 版本恢复：运营恢复不连带超管正文、只恢复授权模块内容；恢复版需重新验证才能发布；超管全量恢复
  const admEdit = load('ai-capability', '?role=ADM&as=U-1001');
  let editSaved;
  try {
    const doc = admEdit.F.load().aiDocs.documents.find(d => d.id === 'DOC-B');
    const sections = (doc.draft || doc).sections.map(s => ({ id: s.id, title: s.title, body: s.body }));
    sections[0].body = '推荐原则（超管修订）：只推荐已确权商机内的产品。';
    admEdit.F.saveDocBody('DOC-B', sections);
    editSaved = admEdit.save();
  } finally { admEdit.close(); }
  const res = load('ai-capability', '?role=MGR&as=U-1002', editSaved);
  try {
    res.F.restoreDocVersion('DOC-B', 'VER-B2');
    const after = res.F.load().aiDocs.documents.find(d => d.id === 'DOC-B');
    assert.equal(after.draft.kind, 'restore');
    assert.equal(after.draft.restoreFromVersion, 'v2');
    assert.match(after.draft.sections[0].body, /超管修订/, '运营恢复不连带超管正文：保留当前正文');
    assert.equal(after.draft.modules.find(m => m.id === 'MOD-B1').content, '客户询问交付范围时，以合同清单为准。', '授权模块内容恢复到 v2 快照');
    assert.throws(() => res.F.publishDoc('DOC-B'), /未.*验证|内容已变化/, '恢复版本需重新验证才能发布');
  } finally { res.close(); }
  const admRes = load('ai-capability', '?role=ADM&as=U-1001');
  try {
    admRes.F.restoreDocVersion('DOC-A', 'VER-A1');
    const doc = admRes.F.load().aiDocs.documents.find(d => d.id === 'DOC-A');
    assert.equal(doc.draft.kind, 'restore');
    assert.equal(doc.draft.sections.length, 1, '超管全量恢复 v1 快照正文');
    assert.equal(doc.draft.modules.length, 0, 'v1 快照无模块');
  } finally { admRes.close(); }

  // OpenClaw 页签回归：指引表单与假沙盒下线、AI 能力运营入口、逐销售加载状态、健康检查抽屉仍可用
  const ops = load('operations-config', '?role=ADM&as=U-1001&tab=openclaw');
  try {
    assert.equal(ops.doc.querySelector('[name=guidance]'), null, '场景指引表单已下线');
    assert.equal(ops.doc.querySelector('[data-action="sandbox"]'), null, '假沙盒按钮已移除');
    assert.ok(ops.doc.querySelector('a[href*="ai-capability.html"]'), '提供 AI 能力运营入口');
    assert.match(ops.doc.querySelector('[data-settings]').textContent, /文档维护已迁至 AI 能力运营/);
    assertFeatureTable(ops.doc.querySelector('[data-settings]'), 'OpenClaw 专属 Agent 运行与路由状态', 'R16/专属 Agent 表');
    assert.match(ops.doc.querySelector('[data-agent-row="U-1005"]').textContent, /未加载新版 · 继续使用 v2/, '逐销售加载状态来自发布域');
    assert.match(ops.doc.querySelector('[data-agent-row="U-1008"]').textContent, /同步失败/);
    click(ops, '[data-action="health"]');
    assert.equal(assertFeatureTable(ops.doc.querySelector('.fp-overlay'), 'OpenClaw 运行健康检查结果', 'R16/健康检查'), 4);
    assert.deepEqual(ops.errors, []);
  } finally { ops.close(); }

  // 消费端联动：演示回复标注当前销售已生效文档版本与 skill 来源
  const assistant = load('sales-assistant', '?role=SLS&as=U-1004');
  try {
    fill(assistant, 'message', '客户觉得贵，下一步怎么谈？');
    submit(assistant, '.fp-composer');
    assert.match(assistant.doc.querySelector('.fp-chat-log').textContent, /依据：销售场景指引 v3（已生效）/);
    assert.match(assistant.doc.querySelector('.fp-chat-log').textContent, /调用 skill：同行案例库/);
    assert.deepEqual(assistant.errors, []);
  } finally { assistant.close(); }

  // 菜单：ADM 与 MGR 菜单中 AI 能力运营位于运营配置之前
  const menu = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    const keys = [...menu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.equal(keys.indexOf('ai-capability'), keys.indexOf('operations-config') - 1, '运营菜单在运营配置前挂 AI 能力运营');
  } finally { menu.close(); }
});

test('R17 销售目标与进度：角色可见、录入校验、调整留痕、达成口径与 DataHub 状态闭环', () => {
  /** 读取单元格正文（去掉窄屏字段标签），避免表头文字干扰内容断言。 */
  const cellText = (row, index) => {
    const cell = row.cells[index].cloneNode(true);
    cell.querySelector('.fp-table-cell-label')?.remove();
    return cell.textContent.trim();
  };

  // 三角色可见性：SLS 只见本人两卡不渲染页签；SOL 无权访问；MGR 全量三页签
  const sls = load('sales-goals', '?role=SLS&as=U-1004');
  try {
    const text = sls.doc.querySelector('#fp-content').textContent;
    assert.match(text, /我的目标/);
    assert.match(text, /付赞/);
    assert.equal(text.includes('张云飞'), false, '销售只见本人目标与达成');
    assert.equal(sls.doc.querySelector('#fp-content [data-tab]'), null, '销售视图不渲染页签');
    assert.match(text, /数据截止 2026-09-15 06:30/);
    // 本人流水卡：目标 200 万、达成 175 万、进度 87.5%、缺口 25 万；毛利卡超额缺口取零
    assert.match(text, /200 万/);
    assert.match(text, /175 万/);
    assert.match(text, /87\.5%/);
    assert.match(text, /25 万/);
    assert.match(text, /116\.7%/);
    assert.equal(sls.F.canManageGoals(), false, '销售无目标写权限');
    assert.throws(() => sls.F.saveGoal({ level: 'personal', metric: 'revenue', sales: 'U-1004', value: '100', start: '2026-09-01', end: '2026-09-30' }), /仅销售运营/);
    assert.throws(() => sls.F.runDatahubSync('fail'), /仅销售运营或超级管理员/);
    assert.deepEqual(sls.errors, []);
  } finally { sls.close(); }
  const sol = load('sales-goals', '?role=SOL&as=U-1010');
  try {
    assert.match(sol.doc.body.textContent, /无权访问/);
    assert.equal(sol.doc.querySelector('[data-goal-card]'), null, '无权角色不返回目标数据');
  } finally { sol.close(); }

  // 运营进度看板：全员数字、目标差异提示、逐人表（可搜索可排序）、未归属业绩表
  const mgr = load('sales-goals', '?role=MGR&as=U-1002');
  try {
    assert.equal(mgr.F.canManageGoals(), true, '销售运营可写目标');
    assert.deepEqual([...mgr.doc.querySelectorAll('[data-tab]')].map(n => n.dataset.tab), ['board', 'manage', 'datahub'], '运营三页签');
    const boardText = mgr.doc.querySelector('#fp-content').textContent;
    assert.match(boardText, /309 万/, '全员流水达成含未归属与负毛利行');
    assert.match(boardText, /117 万/, '全员毛利达成');
    assert.match(boardText, /24 万/, '未归属业绩');
    const diff = mgr.doc.querySelector('[data-goal-diff]');
    assert.ok(diff, '目标差异提示存在');
    assert.match(diff.textContent, /280 万/, '流水差异 = 600 − (200+120)');
    assert.match(diff.textContent, /120 万/, '毛利差异 = 180 − (60+0)');
    assert.match(diff.textContent, /仅提示/);
    assert.ok(assertFeatureTable(mgr.doc.querySelector('[data-goal-board]'), '全员逐人目标进度', 'R17/逐人进度') > 0);
    // 无目标销售（U-1006）：未设置 + 只输出达成，不输出进度与缺口
    const row1006 = mgr.doc.querySelector('[data-goal-sales="U-1006"]');
    assert.equal(cellText(row1006, 1), '未设置');
    assert.equal(cellText(row1006, 2), '30 万', '无目标销售仍输出达成');
    assert.equal(cellText(row1006, 3), '—', '未设置不输出进度');
    assert.equal(cellText(row1006, 4), '—', '未设置不输出缺口');
    // 零目标（U-1008）：明确设零、不计算进度、负毛利红字如实展示
    const row1008 = mgr.doc.querySelector('[data-goal-sales="U-1008"]');
    assert.match(cellText(row1008, 5), /明确设零/);
    assert.equal(cellText(row1008, 6), '-6 万', '负毛利原样展示');
    assert.equal(cellText(row1008, 7), '不计算进度');
    assert.ok(row1008.querySelector('span[style*="red"]'), '负毛利红字标注');
    // 未开始（U-1013）与已结束（U-1014）区间标注
    assert.match(mgr.doc.querySelector('[data-goal-sales="U-1013"]').textContent, /尚未开始/);
    const row1014 = mgr.doc.querySelector('[data-goal-sales="U-1014"]');
    assert.match(row1014.textContent, /已结束/);
    assert.match(row1014.textContent, /125\.0%/, '已结束区间进度定格');
    // 搜索与排序
    fill(mgr, 'q', '张云飞'); submit(mgr, '[data-search]');
    assert.equal(mgr.doc.querySelectorAll('[data-goal-sales]').length, 1, '逐人表可搜索');
    click(mgr, '[type=reset]');
    assert.equal(mgr.doc.querySelectorAll('[data-goal-sales]').length, 8, '清除后恢复全量销售');
    change(mgr, 'sort', 'profit-desc');
    assert.equal(mgr.doc.querySelector('[data-goal-sales]').dataset.goalSales, 'U-1004', '按毛利进度从高到低排序');
    // 未归属业绩表：金额 + 原因
    assert.ok(assertFeatureTable(mgr.doc.querySelector('[data-goal-unattributed]'), '未归属业绩清单', 'R17/未归属') > 0);
    const unText = mgr.doc.querySelector('[data-goal-unattributed]').textContent;
    assert.match(unText, /跟进人为空/);
    assert.match(unText, /跟进人无法对应本地账号/);
    assert.match(unText, /赵伟航/);

    // 目标管理：列表含重叠 badge，调整记录抽屉留痕可读
    click(mgr, '[data-tab="manage"]');
    assert.ok(assertFeatureTable(mgr.doc.querySelector('[data-goal-list]'), '销售目标列表', 'R17/目标列表') > 0);
    assert.match(mgr.doc.querySelector('[data-goal-row="GT-3"]').textContent, /区间重叠/, '主区间与 GT-5 重叠标注');
    assert.match(mgr.doc.querySelector('[data-goal-row="GT-5"]').textContent, /区间重叠/);
    click(mgr, '[data-goal-row="GT-4"] [data-action="goal-history"]');
    const history = mgr.doc.querySelector('[data-goal-history]');
    assert.ok(history, '调整记录抽屉打开');
    assert.match(history.textContent, /50 万 → 60 万/, '调整前后值留痕');
    assert.match(history.textContent, /王云生/);
    assert.match(history.textContent, /2026-09-08 10:20/);
    assert.match(history.textContent, /上调/, '调整原因留痕');
    mgr.doc.querySelector('.fp-overlay [data-close]').click();

    // 录入校验：空值 / 负数 / 区间倒置阻止保存；停用销售不在归属选项
    click(mgr, '[data-action="goal-new"]');
    assert.equal(mgr.doc.querySelector('.fp-overlay [name=sales] option[value="U-1007"]'), null, '停用销售不出现在归属销售选项');
    submit(mgr);
    assert.match(mgr.doc.querySelector('.fp-overlay .fp-error').textContent, /目标值/);
    fill(mgr, 'value', '-100'); submit(mgr);
    assert.match(mgr.doc.querySelector('.fp-overlay .fp-error').textContent, /负数/);
    fill(mgr, 'value', '660000'); fill(mgr, 'start', '2026-09-10'); fill(mgr, 'end', '2026-09-01'); submit(mgr);
    assert.match(mgr.doc.querySelector('.fp-overlay .fp-error').textContent, /结束日不得早于开始日/);
    const before = mgr.F.load().goals.length;
    fill(mgr, 'end', '2026-09-30'); submit(mgr);
    const goals = mgr.F.load().goals;
    assert.equal(goals.length, before + 1, '校验通过后写库');
    const created = goals.find(g => g.value === 660000);
    assert.ok(created && created.sales === 'U-1004' && created.createdBy === 'U-1002' && created.adjustments.length === 0, '新目标带录入人且无调整记录');

    // 调整留痕：before/after/reason/actor 齐全，历史不被覆盖，进度按新值算
    mgr.F.adjustGoal(created.id, { value: '700000', start: '2026-09-10', end: '2026-09-30', reason: '客户预算确认后上调' });
    const adjusted = mgr.F.load().goals.find(g => g.id === created.id);
    assert.equal(adjusted.value, 700000);
    assert.equal(adjusted.adjustments.length, 1);
    assert.equal(adjusted.adjustments[0].before.value, 660000);
    assert.equal(adjusted.adjustments[0].after.value, 700000);
    assert.equal(adjusted.adjustments[0].reason, '客户预算确认后上调');
    assert.equal(adjusted.adjustments[0].actor, 'U-1002');
    mgr.F.adjustGoal(created.id, { value: '580000', start: '2026-09-10', end: '2026-09-30', reason: '二次校准' });
    assert.equal(mgr.F.load().goals.find(g => g.id === created.id).adjustments.length, 2, '每次调整都留痕，历史不被覆盖');
    const adjustedProgress = mgr.F.goalProgress(mgr.F.load().goals.find(g => g.id === created.id), mgr.F.load());
    assert.equal(adjustedProgress.target, 580000, '进度按新值算');
    assert.equal(adjustedProgress.achieved, 950000, '区间 09-10 ~ 09-30 内该销售流水 95 万（重复指纹只计一次）');
    assert.equal(adjustedProgress.gap, 0, '超额缺口取零');
    assert.ok(adjustedProgress.progress > 1, '超额进度可超 100%');
    assert.throws(() => mgr.F.adjustGoal(created.id, { value: '1', start: '2026-09-10', end: '2026-09-30', reason: ' ' }), /调整原因/);
    assert.deepEqual(mgr.errors, []);
  } finally { mgr.close(); }

  // 超管只读：无录入/调整入口，模型层同样拒绝
  const adm = load('sales-goals', '?role=ADM&as=U-1001');
  try {
    click(adm, '[data-tab="manage"]');
    assert.equal(adm.doc.querySelector('[data-action="goal-new"]'), null, '超管无录入入口');
    assert.equal(adm.doc.querySelector('[data-action="goal-adjust"]'), null, '超管无调整入口');
    assert.ok(adm.doc.querySelector('[data-action="goal-history"]'), '超管可查看调整记录');
    assert.match(adm.doc.querySelector('#fp-content').textContent, /销售运营负责/, '界面标注固化口径');
    assert.equal(adm.F.canManageGoals(), false);
    assert.throws(() => adm.F.saveGoal({ level: 'all', metric: 'revenue', value: '100', start: '2026-09-01', end: '2026-09-30' }), /仅销售运营/);
    assert.throws(() => adm.F.adjustGoal('GT-3', { value: '1', start: '2026-09-01', end: '2026-10-15', reason: 'x' }), /仅销售运营/);
    assert.deepEqual(adm.errors, []);
  } finally { adm.close(); }

  // 计算口径：用种子断言具体数字
  const calc = load('sales-goals', '?role=MGR&as=U-1002');
  try {
    const state = calc.F.load();
    const goal = id => state.goals.find(g => g.id === id);
    // 个人流水达成 = 区间内该销售 Σ（RV-1 80 万 + RV-2 95 万；区间外 RV-6 与重复行 RV-11 不计）
    const p3 = calc.F.goalProgress(goal('GT-3'), state);
    assert.equal(p3.achieved, 1750000);
    assert.equal(p3.gap, 250000);
    assert.ok(Math.abs(p3.progress - 0.875) < 1e-9);
    assert.equal(p3.phase, 'active');
    // 全员流水含未归属与负毛利行：309 万；全员毛利 117 万（未配对成本 CS-9 不进毛利）
    assert.equal(calc.F.goalProgress(goal('GT-1'), state).achieved, 3090000);
    assert.equal(calc.F.goalProgress(goal('GT-2'), state).achieved, 1170000);
    // 未归属 = 全员 − Σ个人（同一区间口径）
    const board = calc.F.goalBoard(state);
    assert.equal(board.unattributed.revenue, 240000);
    assert.equal(board.unattributed.profit, 210000);
    const personalSum = board.perSales.reduce((sum, row) => sum + row.revenueAchieved, 0);
    assert.equal(board.all.revenue.achieved - personalSum, board.unattributed.revenue, '未归属业绩 = 全员达成 − 个人达成之和');
    // 目标差异：全员 − 同区间个人之和
    assert.equal(board.targetDiff.revenue, 2800000);
    assert.equal(board.targetDiff.profit, 1200000);
    // 超额：U-1004 毛利 70 万 vs 目标 60 万
    const p4 = calc.F.goalProgress(goal('GT-4'), state);
    assert.equal(p4.achieved, 700000);
    assert.equal(p4.gap, 0);
    assert.ok(p4.progress > 1);
    // 重叠区间各自独立计算：GT-5 区间 09-10 ~ 09-30 达成 95 万
    const p5 = calc.F.goalProgress(goal('GT-5'), state);
    assert.equal(p5.achieved, 950000);
    assert.ok(calc.F.goalOverlaps(goal('GT-5'), state).some(g => g.id === 'GT-3'), '重叠检测命中');
    // 零目标：不计算进度与缺口；负毛利如实计入
    const p7 = calc.F.goalProgress(goal('GT-7'), state);
    assert.equal(p7.achieved, -60000, '负毛利如实计入');
    assert.equal(p7.progress, null);
    assert.equal(p7.gap, null);
    // 未开始 / 已结束相位
    assert.equal(calc.F.goalProgress(goal('GT-8'), state).phase, 'not_started');
    const p9 = calc.F.goalProgress(goal('GT-9'), state);
    assert.equal(p9.phase, 'ended');
    assert.equal(p9.achieved, 500000, '已结束区间进度定格');
    // 异常清单三分支：成本未配对 / 时间缺失 / 重复去重（跨 realm 数组先展开再断言）
    assert.deepEqual([...state.datahubErrors.map(item => item.kind)].sort(), ['cost_unmatched', 'duplicate', 'missing_time']);
    // 无目标销售只输出达成
    const my6 = calc.F.myGoalBoard('U-1006', state);
    assert.equal(my6.revenue, null);
    assert.equal(my6.revenueAchieved, 300000);
    assert.equal(my6.profitAchieved, 120000);
    assert.deepEqual(calc.errors, []);
  } finally { calc.close(); }

  // 销售视角分支：零目标说明、未设置只输出达成、全空空态
  const sls8 = load('sales-goals', '?role=SLS&as=U-1008');
  try {
    const text = sls8.doc.querySelector('#fp-content').textContent;
    assert.match(text, /目标已设定为 0，不计算进度/);
    assert.match(text, /目标尚未设定，当前达成 20 万/, '未设流水目标只输出达成');
    assert.equal(text.includes('Infinity'), false);
    assert.equal(text.includes('NaN'), false);
    assert.ok(sls8.doc.querySelector('[data-goal-card] span[style*="red"]'), '销售侧负毛利同样红字');
  } finally { sls8.close(); }
  const sls6 = load('sales-goals', '?role=SLS&as=U-1006');
  try {
    const text = sls6.doc.querySelector('#fp-content').textContent;
    assert.match(text, /目标尚未设定，当前达成 30 万/);
    assert.equal(sls6.doc.querySelector('[data-goal-card] .fp-bar'), null, '未设置不渲染进度条');
    assert.equal(text.includes('缺口 0'), false, '未录目标不显示零缺口');
  } finally { sls6.close(); }
  const sls9 = load('sales-goals', '?role=SLS&as=U-1009');
  try {
    assert.match(sls9.doc.querySelector('#fp-content').textContent, /暂无目标与达成/, '无目标无达成给空态');
  } finally { sls9.close(); }

  // DataHub 失败：保留旧数字与截止时间、记录原因、只提醒运营（不推送、按日去重）
  const hubT = load('sales-goals', '?role=MGR&as=U-1002');
  let hubSaved;
  try {
    hubT.F.runDatahubSync('fail');
    const hub = hubT.F.load().datahub;
    assert.equal(hub.status, 'failed');
    assert.equal(hub.lastSuccessAt, '2026-09-15 06:30', '失败保留最近成功时间');
    assert.match(hub.failReason, /超时/);
    const notices = hubT.F.load().notifications.filter(n => String(n.dedupKey).startsWith('ops:datahub:failed:'));
    assert.deepEqual([...notices.map(n => n.recipient)].sort(), ['U-1001', 'U-1002', 'U-1003'], '运营异常只发超管与销售运营');
    assert.ok(notices.every(n => n.type === '运营异常' && n.pushStatus === 'not_required'), '不发起移动端推送');
    assert.ok(notices.every(n => n.link?.page === 'sales-goals' && n.link?.params?.tab === 'datahub'), '提醒直达数据状态页签');
    assert.equal(hubT.F.load().notifications.some(n => String(n.dedupKey).startsWith('ops:datahub:failed:') && n.recipient === 'U-1004'), false, '销售无此提醒');
    assert.equal(hubT.F.load().deliveries.some(d => d.title === 'DataHub 取数失败'), false, '无投递记录');
    hubT.F.runDatahubSync('fail');
    const again = hubT.F.load().notifications.filter(n => String(n.dedupKey).startsWith('ops:datahub:failed:'));
    assert.equal(again.length, 3, '同日重复失败不重复生成');
    assert.ok(again.every(n => n.deduped === 1), '重复触发合并计数');
    hubSaved = hubT.save();
    assert.deepEqual(hubT.errors, []);
  } finally { hubT.close(); }
  const failedView = load('sales-goals', '?role=MGR&as=U-1002', hubSaved);
  try {
    const text = failedView.doc.querySelector('#fp-content').textContent;
    assert.match(text, /309 万/, '失败保留最近一次成功数字');
    const note = failedView.doc.querySelector('[data-datahub-note]');
    assert.match(note.textContent, /数据截止 2026-09-15 06:30/);
    assert.match(note.textContent, /取数失败/);
    click(failedView, '[data-tab="datahub"]');
    assert.equal(failedView.doc.querySelector('[data-datahub-status]').dataset.datahubStatus, 'failed');
    assert.match(failedView.doc.querySelector('[data-datahub-status]').textContent, /失败原因/);
    assert.ok(assertFeatureTable(failedView.doc.querySelector('[data-datahub-whitelist]'), 'DataHub 取数白名单', 'R17/白名单') > 0);
    assert.ok(assertFeatureTable(failedView.doc.querySelector('[data-datahub-errors]'), 'DataHub 取数异常清单', 'R17/异常清单') > 0);
    click(failedView, '[data-action="hub-sync"][data-value="ok"]');
    assert.equal(failedView.F.load().datahub.status, 'ok', '手动取数恢复正常');
    assert.deepEqual(failedView.errors, []);
  } finally { failedView.close(); }
  const slsInbox = load('message-center', '?role=SLS&as=U-1004', hubSaved);
  try {
    click(slsInbox, '[data-tab="all"]');
    assert.equal([...slsInbox.doc.querySelectorAll('[data-message-row]')].some(row => row.textContent.includes('DataHub 取数失败')), false, '销售收件箱看不到取数失败提醒');
  } finally { slsInbox.close(); }
  const mgrInbox = load('message-center', '?role=MGR&as=U-1002', hubSaved);
  try {
    const row = [...mgrInbox.doc.querySelectorAll('[data-message-row]')].find(item => item.textContent.includes('DataHub 取数失败'));
    assert.ok(row, '运营收件箱可见取数失败提醒');
    assert.ok(row.querySelector('[data-message]')?.href.includes('sales-goals'), '提醒直达销售目标与进度页');
  } finally { mgrInbox.close(); }

  // 重置为未接入：看板整体「暂无可用达成数据」，不显示零达成
  const reset = load('sales-goals', '?role=MGR&as=U-1002');
  let resetSaved;
  try {
    reset.F.resetDatahub();
    assert.equal(reset.F.load().datahub.status, 'never');
    resetSaved = reset.save();
  } finally { reset.close(); }
  const neverMgr = load('sales-goals', '?role=MGR&as=U-1002', resetSaved);
  try {
    const text = neverMgr.doc.querySelector('#fp-content').textContent;
    assert.match(text, /暂无可用达成数据，DataHub 接口尚未接入/);
    assert.equal(neverMgr.doc.querySelector('[data-goal-board]'), null, '未接入不渲染逐人表');
    assert.equal(neverMgr.doc.querySelector('[data-goal-card]'), null, '未接入不渲染达成卡');
    assert.equal(text.includes('0 万'), false, '不显示零达成');
    click(neverMgr, '[data-tab="datahub"]');
    assert.equal(neverMgr.doc.querySelector('[data-datahub-status]').dataset.datahubStatus, 'never');
    assert.match(neverMgr.doc.querySelector('[data-datahub-status]').textContent, /从未成功取数|尚未接入/);
    assert.deepEqual(neverMgr.errors, []);
  } finally { neverMgr.close(); }
  const neverSls = load('sales-goals', '?role=SLS&as=U-1004', resetSaved);
  try {
    assert.match(neverSls.doc.querySelector('#fp-content').textContent, /暂无可用达成数据/);
    assert.equal(neverSls.doc.querySelector('[data-goal-card]'), null, '销售侧未接入同样不显示达成卡');
  } finally { neverSls.close(); }

  // 菜单：ADM/MGR 菜单中销售目标与进度位于经营洞察之后；SLS 位于今日该跟之后且首项仍是客户跟进空间
  const mgrMenu = load('customer-spaces', '?role=MGR&as=U-1002');
  try {
    const keys = [...mgrMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.equal(keys.indexOf('sales-goals'), keys.indexOf('employee-insights') + 1, '运营菜单在经营洞察后挂销售目标与进度');
  } finally { mgrMenu.close(); }
  const slsMenu = load('customer-spaces', '?role=SLS&as=U-1004');
  try {
    const keys = [...slsMenu.doc.querySelectorAll('#sc-navigation [data-menu]')].map(node => node.dataset.menu);
    assert.equal(keys[0], 'customer-spaces', '销售菜单首项仍是客户跟进空间');
    assert.equal(keys.indexOf('sales-goals'), keys.indexOf('today-follow') + 1, '销售菜单在今日该跟后挂销售目标与进度');
  } finally { slsMenu.close(); }
});

test('R10 录音归位：三方同步唯一来源、商机锚定校验、多空间独立与部分成功分展', () => {
  // 4.1 同步：三种同步结果都可见，销售侧不提供任何上传入口
  const sales = load('meeting-center', '?role=SLS&as=U-1004');
  try {
    const shell = sales.doc.querySelector('[data-results] .fp-table-shell');
    assert.equal(Number(shell.dataset.rowCount), 6, '归属本人的录音进本人录音管理');
    assert.equal(sales.doc.querySelector('[data-recording-row="MT-107"]'), null, '其他销售的录音不进本人列表');
    assert.equal(sales.doc.querySelector('[data-recording-row="MT-108"]'), null, '归属待处理录音不分配给销售');
    assert.match(sales.doc.querySelector('[data-recording-source]').textContent, /不提供手动上传/);
    const pageText = sales.doc.querySelector('#fp-content').textContent;
    for (const banned of ['上传录音', '上传客户录音', '实体对齐']) assert.equal(pageText.includes(banned), false, `不应保留旧口径：${banned}`);
    // 同步失败 / 等待转写 / 未归位三种状态各自可见，不静默丢失
    assert.equal(sales.doc.querySelector('[data-recording-row="MT-106"]').dataset.syncStatus, 'failed');
    assert.equal(sales.doc.querySelector('[data-recording-row="MT-101"]').dataset.recordingState, 'unplaced');
    assert.match(sales.doc.querySelector('[data-recording-row="MT-103"]').textContent, /等待转写/);
    assert.deepEqual(sales.errors, []);
  } finally { sales.close(); }

  // 4.2 归位校验：冻结、仅客户级确权、多商机未指定、同步失败四类阻断
  const guard = load('meeting-center', '?role=SLS&as=U-1004');
  try {
    assert.throws(() => guard.F.placeRecording('MT-101', { space: 'WS-206', opportunityId: 'OP-306' }), /空间已冻结/);
    assert.throws(() => guard.F.placeRecording('MT-101', { space: 'WS-205', opportunityId: '' }), /归位必须锚定商机/);
    assert.throws(() => guard.F.placeRecording('MT-101', { space: 'WS-204', opportunityId: '' }), /多条商机，请先指定一条/);
    assert.throws(() => guard.F.placeRecording('MT-106', { space: 'WS-201', opportunityId: 'OP-301' }), /同步失败/);
    assert.equal(guard.F.load().placements.filter(item => item.recording === 'MT-101' && item.status !== 'canceled').length, 0, '阻断后不落归位');
    // 多商机指定后可以归位
    const placement = guard.F.placeRecording('MT-101', { space: 'WS-204', opportunityId: 'OP-310' });
    assert.equal(placement.opportunityId, 'OP-310', '销售指定的商机被锚定');
    assert.deepEqual(guard.errors, []);
  } finally { guard.close(); }

  // 4.2 一录多归位 + 逐条取消：录音文件共用，各条归位互不影响
  const multi = load('meeting-center', '?role=SLS&as=U-1004&meeting=MT-105');
  let multiSaved;
  try {
    const before = multi.F.recordingPlacements('MT-105', multi.F.load());
    assert.deepEqual([...before].map(item => item.space).sort(), ['WS-201', 'WS-202'], '同一录音分别归位到两个空间');
    assert.equal(new Set(before.map(item => item.status)).size, 2, '两条归位状态各自独立');
    multi.F.cancelPlacement('PL-104');
    const after = multi.F.load().placements;
    assert.equal(after.find(item => item.id === 'PL-104').status, 'canceled', '取消只影响这一条');
    assert.equal(after.find(item => item.id === 'PL-105').status, 'done', '其他归位不受影响');
    assert.ok(multi.F.load().spaceChanges.some(item => item.id === 'CHGX-509'), '取消后已生成的变化结果保留');
    multiSaved = multi.save();
    assert.deepEqual(multi.errors, []);
  } finally { multi.close(); }
  // 各空间只见与本空间相关的那条归位
  const spaceView = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-202&tab=followup&sub=recordings', multiSaved);
  try {
    const body = spaceView.doc.querySelector('[data-tab-body]');
    assert.ok(body.querySelector('[data-placement-row="PL-105"]'), '本空间的归位可见');
    assert.equal(body.querySelector('[data-placement-row="PL-104"]'), null, '看不到这份录音挂在别处');
    // 4.3 客户信息与行为记录分开展示：客户信息写成、行为记录失败，成功的一条不被覆盖
    assert.equal(body.querySelector('[data-placement-row="PL-105"]').dataset.placementStatus, 'done');
    assert.equal(body.querySelector('[data-placement-row="PL-105"] [data-behavior-status]').dataset.behaviorStatus, 'failed');
    assert.deepEqual(spaceView.errors, []);
  } finally { spaceView.close(); }

  // 4.3 等待转写 → 转写可用后自动进入更新；冻结空间停止更新
  const transcribe = load('meeting-center', '?role=SLS&as=U-1004&meeting=MT-103');
  try {
    assert.equal(transcribe.F.load().placements.find(item => item.id === 'PL-102').status, 'waiting_transcript');
    transcribe.F.markTranscriptReady('MT-103');
    const placement = transcribe.F.load().placements.find(item => item.id === 'PL-102');
    assert.equal(placement.status, 'done', '转写可用后自动完成客户信息更新');
    assert.ok(placement.changeId, '产出对应的本次变化');
    assert.ok(placement.behaviorId, '同批产出行为记录');
    const change = transcribe.F.load().spaceChanges.find(item => item.id === placement.changeId);
    assert.equal(change.source, 'meeting');
    assert.equal(change.space, 'WS-203');
    assert.deepEqual(transcribe.errors, []);
  } finally { transcribe.close(); }

  // 4.3 更新失败：原内容保留、只提醒运营、可按归位重试
  const failed = load('meeting-center', '?role=SLS&as=U-1004');
  try {
    const state = failed.F.load();
    assert.equal(state.placements.find(item => item.id === 'PL-103').status, 'failed');
    const opsOnly = state.notifications.filter(item => item.dedupKey === 'ops:space-failed:CHGX-508');
    assert.deepEqual([...opsOnly].map(item => item.recipient).sort(), ['U-1001', 'U-1002'], '更新失败只提醒运营与超管');
    assert.equal(state.notifications.some(item => item.recipient === 'U-1004' && item.changeId === 'CHGX-508'), false, '不向销售推送技术故障');
    failed.F.retryPlacementUpdate('PL-103');
    assert.equal(failed.F.load().placements.find(item => item.id === 'PL-103').status, 'done', '重试后本条恢复');
    assert.deepEqual(failed.errors, []);
  } finally { failed.close(); }

  // 4.3 无变化不提醒；有变化的完成提醒直达本次变化详情
  const notify = load('message-center', '?role=SLS&as=U-1004');
  try {
    const state = notify.F.load();
    assert.equal(state.notifications.some(item => item.changeId === 'CHGX-509'), false, '本次无变化不产生完成提醒');
    const done = state.notifications.find(item => item.changeId === 'CHGX-510');
    assert.equal(done.recipient, 'U-1004');
    assert.equal(done.link.params.change, 'CHGX-510', '提醒直达对应那次变化');
    assert.equal(done.link.params.space, 'WS-202');
    assert.deepEqual(notify.errors, []);
  } finally { notify.close(); }

  // 4.4 变化详情展示新增、前后对比与依据；依据回到录音原文
  const detail = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-202&tab=overview&change=CHGX-510');
  try {
    const drawer = detail.doc.querySelector('[data-change-detail]');
    assert.ok(drawer, '提醒落点打开本次变化详情');
    assert.ok(drawer.querySelector('[data-change-added]'), '展示本次新增');
    assert.ok(drawer.querySelector('[data-change-updated]'), '展示更新前后对比');
    assert.match(drawer.textContent, /客户录音 · 跨客户联合沟通/, '标明来源录音');
    assert.deepEqual(detail.errors, []);
  } finally { detail.close(); }
  // 转写未就绪的录音依据如实说明，不用摘要冒充原文
  const evidence = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-203&tab=followup&sub=recordings');
  try {
    click(evidence, '[data-placement-row="PL-102"] [data-action="source"]');
    assert.ok(evidence.doc.querySelector('[data-source-unavailable]'), '转写未就绪时不展示原文');
    assert.match(evidence.doc.querySelector('[data-source-unavailable]').textContent, /转写尚未可用/);
    assert.deepEqual(evidence.errors, []);
  } finally { evidence.close(); }

  // 4.2 空间侧反向关联与正向归位等价；冻结空间不给归位入口
  const reverse = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-201&tab=followup&sub=recordings');
  try {
    click(reverse, '[data-action="placement-add"]');
    const form = reverse.doc.querySelector('.fp-overlay form');
    assert.ok(form, '空间侧提供关联入口');
    assert.equal(form.elements.opportunityId.value, 'OP-301', '单商机自动带出');
    form.elements.recording.value = 'MT-101';
    submit(reverse, '.fp-overlay form');
    const created = reverse.F.load().placements.find(item => item.recording === 'MT-101' && item.space === 'WS-201' && item.status !== 'canceled');
    assert.ok(created, '空间侧建立的是同一种归位');
    assert.deepEqual(reverse.errors, []);
  } finally { reverse.close(); }
  const frozen = load('followup-workbench', '?role=SLS&as=U-1004&space=WS-206&tab=followup&sub=recordings');
  try {
    assert.equal(frozen.doc.querySelector('[data-action="placement-add"]'), null, '冻结空间不给归位入口');
    assert.match(frozen.doc.querySelector('[data-tab-body]').textContent, /空间已冻结/);
    assert.deepEqual(frozen.errors, []);
  } finally { frozen.close(); }

  // 4.1 归属缺失进运营待处理清单，不静默丢弃
  const ops = load('meeting-center', '?role=MGR&as=U-1002');
  try {
    assert.ok(ops.doc.querySelector('[data-unresolved="MT-108"]'), '归属待处理录音进运营清单');
    assertFeatureTable(ops.doc.querySelector('[data-unresolved="MT-108"]').closest('.fp-table-shell').parentElement, '归属待处理录音清单', 'R10/归属待处理');
    assert.equal(ops.doc.querySelector('[data-recording-row="MT-108"]'), null, '待处理录音不进可归位列表');
    assert.deepEqual(ops.errors, []);
  } finally { ops.close(); }
});
