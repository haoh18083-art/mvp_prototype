/* M02 PRD acceptance against the actual HTML, in an isolated Chrome profile.
   NODE_PATH=<playwright module directory> node tests/m02-flows.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.M02_QA_DIR || '/tmp/sales-m02-qa';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  let context, page;
  const url = (file, params = {}) => pathToFileURL(path.join(root, 'pages', file + '.html')).href + '?' + new URLSearchParams(params);
  const go = (file, params = {}) => page.goto(url(file, params));
  const state = () => page.evaluate(() => SC.B2.load());
  const text = () => page.locator('#sc-page-body').innerText();
  const button = name => page.getByRole('button', { name, exact: true });
  const confirm = name => page.getByRole('dialog').last().getByRole('button', { name, exact: true }).click();
  const cancel = () => confirm('取消');
  const ready = () => page.waitForFunction(() => !document.querySelector('.modal__foot .btn--primary:disabled'));
  const managers = () => page.evaluate(() => SC.B2.change(s => {
    ['A', 'B'].forEach(suffix => s.people.push({ id: 'QA-MGR-' + suffix, name: '验收主管' + suffix,
      role: 'MGR', status: 'on', groupId: '', group: '—', roleVersion: 0, pool: '', tasks: 0 }));
    s.people.push({ id: 'QA-MGR-OFF', name: '停用主管', role: 'MGR', status: 'off', groupId: '', roleVersion: 0 });
  }));
  const saveShot = name => page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  async function test(name, fn) {
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await context.newPage(); page.setDefaultTimeout(6000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      await go('groups');
      await fn();
      assert.deepEqual(errors, [], 'page errors');
      results.push({ name, pass: true }); console.log('PASS', name);
    } catch (e) {
      results.push({ name, pass: false, error: e.message, errors });
      console.log('FAIL', name, e.message); await saveShot('failure-' + results.length).catch(() => {});
    } finally { await context.close(); }
  }
  await test('M02-MIG：旧演示数据升级保留商机、准入、空间与历史', async () => {
    const preserved = await page.evaluate(() => {
      const s = SC.B2.load(); const before = JSON.stringify([s.opps, s.combos, s.spaces, s.b3]);
      delete s.organisationVersion; delete s.groups; delete s.organisationEvents;
      SC.B2.save(s); const next = SC.B2.load();
      return { same: before === JSON.stringify([next.opps, next.combos, next.spaces, next.b3]), group: next.people.find(p => p.id === 'U-1004').groupId };
    });
    assert.equal(preserved.same, true); assert.equal(preserved.group, 'G-01');
  });
  await test('M02-2-01：创建校验、取消、保存、刷新及空组', async () => {
    await managers(); const before = await state();
    await button('创建分组').click(); await page.locator('[name=name]').fill('验收新组'); await cancel();
    assert.equal((await state()).groups.length, before.groups.length);
    await button('创建分组').click(); await confirm('确认创建');
    assert.equal(await page.locator('[name=name]').evaluate(e => e.validity.valueMissing), true);
    await page.locator('[name=name]').fill('验收新组'); await confirm('确认创建');
    assert.equal(await page.locator('[name=mgr]').evaluate(e => e.validity.valueMissing), true);
    assert.equal(await page.locator('[name=mgr] option[value="QA-MGR-OFF"]').count(), 0);
    await page.locator('[name=mgr]').selectOption('QA-MGR-A'); await confirm('确认创建');
    await page.waitForFunction(() => SC.B2.load().groups.length === 4);
    await page.reload(); assert.match(await text(), /验收新组/);
    const s = await state(); assert.equal(s.organisationEvents.filter(e => e.audit.code === 'EV-A-13').length, 1);
    await go('manager-home', { role: 'MGR', as: 'QA-MGR-A' });
    assert.equal(await page.evaluate(() => SC.B3.visibleCombos(SC.B2.load()).length), 0);
    await saveShot('new-empty-group');
  });
  await test('M02-2-01B：组名唯一、有效主管以及一主管一组校验', async () => {
    await managers();
    const messages = await page.evaluate(async () => {
      const cases = [['', 'QA-MGR-A'], ['华北一组', 'QA-MGR-A'], ['有效组', 'U-1004'], ['有效组', 'QA-MGR-OFF'], ['有效组', 'U-1002']];
      return Promise.all(cases.map(async a => { try { await SC.B2.createGroup(...a); return ''; } catch (e) { return e.message; } }));
    });
    assert(messages.every(Boolean)); assert.equal((await state()).groups.length, 3);
  });
  await test('M02-2-01C：改名实际生效且不改业务归属或历史', async () => {
    const before = await state(); await go('group-detail', { id: 'G-01' }); await button('修改名称').click();
    await page.locator('[name=name]').fill('华东组'); await confirm('保存');
    await page.waitForFunction(() => document.querySelector('.b2-error')?.textContent.includes('已存在'));
    await page.locator('[name=name]').fill('华北验收组'); await confirm('保存');
    await page.waitForFunction(() => SC.B2.load().groups[0].name === '华北验收组');
    await page.reload(); assert.match(await text(), /华北验收组/);
    await go('manager-home'); assert.match(await page.locator('[data-od-id=sidebar-user]').innerText(), /华北验收组/);
    const s = await state(); assert.deepEqual(s.opps, before.opps); assert.deepEqual(s.b3.requests, before.b3.requests);
    const event = s.organisationEvents[0]; assert.equal(event.detail.snapshot[0].before, '华北一组');
    assert.equal(s.people.find(p => p.id === 'U-1004').groupId, 'G-01');
  });
  await test('M02-2-02：加入成员搜索、停用与已分组禁选、批量保存', async () => {
    await page.evaluate(() => SC.B2.change(s => s.people.find(p => p.id === 'U-1014').status = 'off'));
    await go('group-detail', { id: 'G-01' }); await button('加入成员').click();
    assert.equal(await page.locator('[data-member="U-1004"]').isDisabled(), true);
    assert.equal(await page.locator('[data-member="U-1014"]').isDisabled(), true);
    await page.getByPlaceholder('搜索姓名').fill('不存在');
    assert.equal(await page.locator('tr[data-person-name]:visible').count(), 0);
    await page.getByPlaceholder('搜索姓名').fill('周允');
    assert.equal(await page.locator('tr[data-person-name]:visible').count(), 1);
    await page.locator('[data-member="U-1013"]').check(); await confirm('确认加入');
    await page.waitForFunction(() => SC.B2.load().people.find(p => p.id === 'U-1013').groupId === 'G-01');
    await cancel(); await page.reload(); assert.match(await text(), /周允/);
    await go('groups', { view: 'ungrouped' }); assert.doesNotMatch(await page.locator('#grp-pending').innerText(), /周允/);
    await go('manager-sales'); assert.match(await text(), /周允/);
    await saveShot('member-linked');
  });
  await test('M02-2-02B：两个页面首次分配并发仅一方成功，其他成员正常加入', async () => {
    const second = await context.newPage(); await second.goto(url('groups'));
    const firstResult = await page.evaluate(() => SC.B2.assignSales('G-01', ['U-1013']));
    const laterResult = await second.evaluate(() => SC.B2.assignSales('G-03', ['U-1013', 'U-1014']));
    assert.equal(firstResult[0].status, '成功');
    assert.deepEqual(laterResult.map(r => r.status), ['失败', '成功']);
    const s = await state(); assert.equal(s.people.find(p => p.id === 'U-1013').groupId, 'G-01');
    assert.equal(s.people.find(p => p.id === 'U-1014').groupId, 'G-03');
    const race = await Promise.all([page.evaluate(() => SC.B2.assignSales('G-01', ['U-1013'])), second.evaluate(() => SC.B2.assignSales('G-03', ['U-1013']))]);
    assert(race.flat().every(r => r.status === '失败'));
  });
  await test('M02-CONCURRENT：两个超管同时首次分配及继任，仅先成功者生效', async () => {
    await managers();
    const second = await context.newPage(); await second.goto(url('groups'));
    const assignment = await Promise.all([
      page.evaluate(() => SC.B2.assignSales('G-01', ['U-1013'])),
      second.evaluate(() => SC.B2.assignSales('G-03', ['U-1013']))
    ]);
    assert.deepEqual(assignment.flat().map(r => r.status).sort(), ['失败', '成功'].sort());
    const succession = await Promise.all([
      page.evaluate(async () => { try { await SC.B2.succeedManager('G-01', 'QA-MGR-A', 0); return '成功'; } catch (e) { return '失败'; } }),
      second.evaluate(async () => { try { await SC.B2.succeedManager('G-01', 'QA-MGR-B', 0); return '成功'; } catch (e) { return '失败'; } })
    ]);
    assert.deepEqual(succession.sort(), ['失败', '成功'].sort());
    const s = await state(); assert.equal(s.organisationEvents.filter(e => e.audit.code === 'EV-A-15').length, 1);
    assert.equal(s.groups[0].version, 1);
  });
  await test('M02-2-03：待分组可查看本人组合，首次分配后准入及主管范围立即联动', async () => {
    await go('sales-home', { role: 'SLS', as: 'U-1013' });
    const own = await page.evaluate(() => { const s = SC.B2.load(), cs = SC.B3.visibleCombos(s); return { count: cs.length, reasons: cs.map(c => SC.B3.admitError(s, c)) }; });
    assert(own.count > 0); assert(own.reasons.every(x => x === '销售尚未分组'));
    await go('groups', { role: 'ADM' }); const before = await state();
    await page.evaluate(() => SC.B2.assignSales('G-01', ['U-1013', 'U-1014']));
    await go('groups', { view: 'ungrouped' }); assert.match(await text(), /全部销售已完成分组/);
    await go('manager-customers');
    const granted = await page.evaluate(() => { const s = SC.B2.load(); return SC.B3.visibleCombos(s).filter(c => c.sales === 'U-1013').map(c => SC.B3.admitError(s, c)); });
    assert.equal(granted.length, own.count); assert(granted.every(x => x !== '销售尚未分组'));
    assert.deepEqual((await state()).opps.map(o => o.sales), before.opps.map(o => o.sales));
  });
  await test('M02-2-04：主管继任沿用待办，旧主管旧页失权，历史与账号不变', async () => {
    await managers(); const before = await state();
    const id = await page.evaluate(() => { const s = SC.B2.load(), me = s.people.find(p => p.id === 'U-1002'); return s.b3.requests.find(r => SC.B3.canApprove(s, r, me) && ['pending', 'partial'].includes(SC.B3.requestState(r))).id; });
    const oldPage = await context.newPage(); await oldPage.goto(url('manager-approval', { role: 'MGR', as: 'U-1002', id }));
    await go('group-detail', { id: 'G-01' }); await button('主管继任').click();
    assert.match(await page.getByRole('dialog').innerText(), /历史|原审批人/);
    await page.locator('[name=manager]').selectOption('QA-MGR-A'); await confirm('确认继任');
    await page.waitForFunction(() => SC.B2.load().groups[0].mgrId === 'QA-MGR-A');
    await oldPage.reload(); assert.match(await oldPage.locator('#sc-page-body').innerText(), /当前身份不能查看该记录/);
    const rights = await page.evaluate(id => { const s = SC.B2.load(), r = s.b3.requests.find(r => r.id === id); return {
      old: SC.B3.canApprove(s, r, s.people.find(p => p.id === 'U-1002')),
      next: SC.B3.canApprove(s, r, s.people.find(p => p.id === 'QA-MGR-A')),
      inactive: s.people.find(p => p.id === 'U-1002').status
    }; }, id);
    assert.deepEqual(rights, { old: false, next: true, inactive: 'on' });
    const s = await state(); assert.deepEqual(s.b3.requests, before.b3.requests); assert.deepEqual(s.b3.admissions, before.b3.admissions);
    await go('manager-home', { role: 'MGR', as: 'QA-MGR-A' }); assert.match(await text(), /客保审批/);
    await saveShot('successor-workbench');
  });
  await test('M02-2-04B：旧继任版本、重复确认及停用继任人均不能覆盖', async () => {
    await managers();
    await page.evaluate(() => SC.B2.succeedManager('G-01', 'QA-MGR-A', 0));
    const messages = await page.evaluate(async () => {
      let out = []; for (const a of [['G-01', 'QA-MGR-B', 0], ['G-01', 'QA-MGR-A', 1], ['G-01', 'QA-MGR-OFF', 1]]) {
        try { await SC.B2.succeedManager(...a); out.push(''); } catch (e) { out.push(e.message); }
      } return out;
    });
    assert(messages.every(Boolean)); assert.equal((await state()).groups[0].mgrId, 'QA-MGR-A');
    assert.equal((await state()).organisationEvents.filter(e => e.audit.code === 'EV-A-15').length, 1);
  });
  await test('M02-2-04C：主管可先停用，超管兜底，继任不自动启用旧账号', async () => {
    await managers(); await go('people-list');
    await page.locator('[data-toggle="U-1002"]').click(); await confirm('确认停用');
    await page.waitForFunction(() => SC.B2.load().people.find(p => p.id === 'U-1002').status === 'off');
    await go('manager-home'); assert.match(await text(), /无权访问/);
    await go('groups'); await page.evaluate(() => SC.B2.succeedManager('G-01', 'QA-MGR-A', 0));
    assert.equal((await state()).people.find(p => p.id === 'U-1002').status, 'off');
    const admin = await page.evaluate(() => { const s = SC.B2.load(); return s.b3.admissions.filter(a => a.status === 'pending').every(a => SC.B3.canAdmission(s, a, s.people.find(p => p.id === 'U-1001'))); });
    assert.equal(admin, true);
  });
  await test('M02-ROLE：首次角色分配、手动启用、可用于新组主管', async () => {
    await go('role-pool'); await page.locator('[data-one="U-1020"]').click();
    await page.locator('#ar').selectOption({ label: '销售主管' }); await confirm('提交');
    await page.waitForFunction(() => SC.B2.load().people.find(p => p.id === 'U-1020').role === 'MGR');
    assert.equal((await state()).people.find(p => p.id === 'U-1020').status, 'off');
    await go('people-list'); await page.locator('[data-toggle="U-1020"]').click();
    await page.waitForFunction(() => SC.B2.load().people.find(p => p.id === 'U-1020').status === 'on');
    await go('groups'); await button('创建分组').click();
    assert.equal(await page.locator('[name=mgr] option[value="U-1020"]').count(), 1);
  });
  await test('M02-ROLE-B：业务前置、转岗成员解除、账号保持停用、历史不改写', async () => {
    await page.evaluate(() => SC.B2.assignSales('G-01', ['U-1014']));
    let error = await page.evaluate(async () => { try { await SC.B2.changeRole('U-1014', 'SOL', SC.B2.find('people', 'U-1014').roleVersion); return ''; } catch (e) { return e.message; } });
    assert.match(error, /停用/);
    await go('people-list'); await page.locator('[data-toggle="U-1014"]').click(); await confirm('确认停用');
    await go('people-detail', { id: 'U-1014' }); await button('变更角色').click();
    await page.locator('[name=role]').selectOption('SOL'); await confirm('确认变更');
    await page.waitForFunction(() => SC.B2.load().people.find(p => p.id === 'U-1014').role === 'SOL');
    const s = await state(), p = s.people.find(p => p.id === 'U-1014');
    assert.equal(p.groupId, ''); assert.equal(p.status, 'off');
    const membership = s.organisationEvents.filter(e => e.audit.code === 'EV-A-14');
    assert.equal(membership.length, 2); assert.equal(membership[1].detail.snapshot[0].after, '华北一组');
    await go('group-detail', { id: 'G-01' }); assert.doesNotMatch(await text(), /何明轩/);
  });
  await test('M02-ROLE-C：已结束或隐藏商机、在任主管、池关系和任务阻止转岗', async () => {
    const data = await page.evaluate(async () => {
      SC.B2.change(s => { ['U-1004', 'U-1002', 'U-1010'].forEach(id => s.people.find(p => p.id === id).status = 'off'); });
      const s = SC.B2.load(); return ['U-1004', 'U-1002', 'U-1010'].map(id => SC.B2.roleChecks(s, id).filter(c => !c.ok).map(c => c.t));
    });
    assert(data[0].includes('归属关系')); assert(data[1].includes('任职事项'));
    assert(data[2].includes('客户池成员关系')); assert(data[2].includes('协作事项'));
  });
  await test('M02-1-A：四角色菜单与非管理身份直链访问拦截', async () => {
    for (const [role, file, count] of [['ADM', 'groups', 13], ['MGR', 'manager-home', 8], ['SLS', 'sales-home', 9], ['SOL', 'solution-pool', 3]]) {
      await go(file, { role });
      const leaves = await page.evaluate(role => SC.MENU[role].flatMap(item => item.children || [item]).filter(item => item.href).length, role);
      assert.equal(await page.locator('.sc-nav a').count(), leaves);
      assert.equal(leaves, count);
    }
    for (const file of ['groups', 'group-detail', 'people-list', 'people-detail', 'role-pool', 'audit-query', 'audit-detail', 'audit-object']) {
      await go(file, { role: 'SLS', as: 'U-1004' }); assert.match(await text(), /无权访问/, file);
    }
    const error = await page.evaluate(async () => { try { await SC.B2.assignSales('G-01', ['U-1013']); return ''; } catch (e) { return e.message; } });
    assert.match(error, /无权/);
    await go('sales-home');
    const directError = await page.evaluate(async () => { try { await SC.B2.assignSales('G-01', ['U-1013']); return ''; } catch (e) { return e.message; } });
    assert.match(directError, /无权/);
  });
  await test('M02-1-B：客户页签、空态页、返回菜单始终保持当前人员', async () => {
    await go('customer-detail', { role: 'SLS', as: 'U-1008', id: 'C-1005' });
    const before = await page.getByRole('tab').allTextContents();
    await page.getByRole('tab', { name: /商机归属/ }).click();
    assert.equal(new URL(page.url()).searchParams.get('as'), 'U-1008');
    assert.deepEqual(await page.getByRole('tab').allTextContents(), before);
    await page.locator('.sc-nav a').filter({ hasText: '跟进任务' }).click();
    assert.match(await page.locator('[data-od-id=sidebar-user]').innerText(), /杨锐/);
    await page.locator('.sc-nav a').filter({ hasText: '我的客户' }).click();
    assert.equal(new URL(page.url()).searchParams.get('as'), 'U-1008');
    assert.match(await page.locator('[data-od-id=sidebar-user]').innerText(), /杨锐/);
  });
  await test('M02-1-C：四角色登录默认首页及已停用账号拒绝', async () => {
    for (const [i, target] of [[0, 'people-list'], [1, 'manager-home'], [2, 'sales-home'], [3, 'solution-pool']]) {
      await go('login'); await page.locator('.login__demo-row').nth(i).click(); await page.locator('button[type=submit]').click();
      await page.waitForURL(u => u.pathname.endsWith('/' + target + '.html'));
    }
    await page.evaluate(() => SC.B2.change(s => s.people.find(p => p.id === 'U-1004').status = 'off'));
    await go('login'); await page.locator('.login__demo-row').nth(2).click(); await page.locator('button[type=submit]').click();
    assert.match(await page.locator('#err').innerText(), /账号已停用/);
  });
  await test('M02-1-D：主管权限依据当前负责人关系，组名字段不能授予权限', async () => {
    await managers();
    const rights = await page.evaluate(() => {
      const s = SC.B2.load(); const fake = s.people.find(p => p.id === 'QA-MGR-A'); fake.group = '华北一组';
      return { team: SC.B3.isTeam(s, 'U-1004', fake), combos: SC.B3.visibleCombos(s, fake).length };
    });
    assert.deepEqual(rights, { team: false, combos: 0 });
  });
  await test('M02-1-E：分组与主管客户、组合、当前空间、归档历史统计一致', async () => {
    const expected = await page.evaluate(() => SC.B2.groupView(SC.B2.load(), SC.B2.find('groups', 'G-01')));
    await go('manager-home');
    const actual = await page.evaluate(() => {
      const s = SC.B2.load(), t = SC.B3, me = t.me(s), cs = t.visibleCombos(s), ws = s.spaces.filter(w => t.isTeam(s, w.sales, me));
      return { cust: new Set(cs.map(c => c.customer)).size, combo: cs.length, space: ws.filter(w => w.status === 'normal').length,
        history: ws.filter(w => ['archived', 'frozen'].includes(w.status)).length };
    });
    for (const k of Object.keys(actual)) assert.equal(actual[k], expected[k], k);
    assert.match(await text(), /归档历史/);
    await saveShot('manager-counts');
  });
  await test('M02-1-F：30天分布按商机去重，全未分池单列数量，未来记录不计入', async () => {
    await go('sales-home');
    await page.evaluate(() => {
      SC.B2.change(s => {
        const ops = s.opps.filter(o => o.sales === 'U-1004').slice(0, 3);
        ops.forEach((o, i) => o.pool = i === 2 ? 'POOL-02' : 'POOL-01');
        s.b3.records = [0, 1, 2, 0].map((i, k) => ({ id: 'QA-R-' + k, space: 'QA', kind: '跟进记录', opps: [ops[i].id], at: SC.B2.now() }));
      }); SC.B3.render();
    });
    let distribution = await page.locator('#pool-distribution').innerText(); assert.match(distribution, /67%/); assert.match(distribution, /33%/);
    await page.evaluate(() => { SC.B2.change(s => s.opps.filter(o => o.sales === 'U-1004').forEach(o => o.pool = '')); SC.B3.render(); });
    distribution = await page.locator('#pool-distribution').innerText(); assert.match(distribution, /未指定客户池：3 条/); assert.doesNotMatch(distribution, /暂无近 30 天跟进样本/);
    await saveShot('sales-unassigned');
    await page.evaluate(() => { SC.B2.change(s => s.b3.records.forEach(r => r.at = '2099-01-01 10:00')); SC.B3.render(); });
    assert.match(await page.locator('#pool-distribution').innerText(), /暂无近 30 天跟进样本/);
    await go('sales-home', { role: 'SLS', as: 'U-1014' }); assert.match(await text(), /暂无本人客户/);
  });
  await test('M02-AUDIT：创建与继任记录可查询、前后快照及对象串联可追溯', async () => {
    await managers(); await page.evaluate(() => SC.B2.succeedManager('G-01', 'QA-MGR-A', 0));
    const s = await state(), e = s.organisationEvents[0];
    await go('audit-query'); assert.match(await text(), /主管指派与变更/);
    await page.locator('#dom').selectOption('A');
    await page.locator('#typ').selectOption({ label: 'EV-A-15　主管指派与变更' });
    await page.locator('a[href*="' + e.audit.id + '"]').click();
    await page.getByRole('tab', { name: /关系快照/ }).click(); assert.match(await text(), /王云生/); assert.match(await text(), /验收主管A/);
    await saveShot('audit-succession');
    await go('audit-object', { obj: 'G-01' }); assert.match(await text(), /主管指派与变更/);
    await go('audit-object', { obj: 'U-1014' }); assert.doesNotMatch(await text(), /主管指派与变更/);
  });
  await test('M02-RESET：重置恢复初始角色与分组，不沿用已变更投影', async () => {
    await managers(); await page.evaluate(() => SC.B2.succeedManager('G-01', 'QA-MGR-A', 0));
    await page.evaluate(() => { SC.B2.reset(); SC.B3.ensure(); SC.B2.refreshOrganisation(); });
    const s = await state(); assert.equal(s.groups[0].mgrId, 'U-1002'); assert.equal(s.people.find(p => p.id === 'U-1004').groupId, 'G-01');
    assert.equal(s.people.some(p => p.id === 'QA-MGR-A'), false); assert.equal(s.organisationEvents.length, 0);
  });
  await browser.close();
  const report = { passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, out }));
  if (report.failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
