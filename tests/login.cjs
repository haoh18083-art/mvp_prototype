// V0.2 登录入口回归：校验表单、演示身份和四角色首页分流。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const base = 'http://prototype.test/project/';
const expectedRoutes = {
  ADM: ['/project/pages/operations-config.html', 'U-1001'],
  MGR: ['/project/pages/employee-insights.html', 'U-1002'],
  // 跟进工作台本版封存，销售登录后落到客户跟进空间。
  SLS: ['/project/pages/customer-spaces.html', 'U-1004'],
  SOL: ['/project/pages/solution-workbench.html', 'U-1010'],
};

function loadEntry(file = 'index.html', storage = {}) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    url: base + (file === 'index.html' ? '' : file),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', error => errors.push(error.message)),
  });
  const { window } = dom;
  Object.entries(storage).forEach(([key, value]) => window.localStorage.setItem(key, value));
  for (const script of window.document.querySelectorAll('script[src]')) {
    const cleanSrc = script.getAttribute('src').replace(/[?#].*$/, '');
    window.eval(fs.readFileSync(path.join(root, cleanSrc), 'utf8'));
  }
  return { dom, window, doc: window.document, errors };
}

function submit(window) {
  window.document.getElementById('login-form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true })
  );
}

test('根入口渲染登录表单和四个演示身份', () => {
  const { dom, doc, errors } = loadEntry();
  try {
    assert.deepEqual(errors, []);
    assert.equal(doc.querySelectorAll('.login-account').length, 4);
    assert.ok(doc.getElementById('login-email'));
    assert.ok(doc.getElementById('login-password'));
    assert.ok(doc.getElementById('login-submit'));
    assert.equal(doc.querySelector('.sc-app'), null);
    assert.equal(doc.querySelector('.login-panel__foot a').getAttribute('href'), 'prototype.html');

    for (const node of doc.querySelectorAll('link[href], script[src], a[href]')) {
      const raw = node.getAttribute('href') || node.getAttribute('src');
      const url = new URL(raw, base);
      if (url.origin !== 'http://prototype.test') continue;
      const target = path.join(root, url.pathname.replace('/project/', ''));
      assert.ok(fs.existsSync(target), `missing ${path.relative(root, target)}`);
    }
  } finally { dom.window.close(); }
});

test('登录表单拦截空值和错误凭据', () => {
  const { dom, window, doc } = loadEntry();
  try {
    let navigated = false;
    window.SC.LOGIN.navigate = () => { navigated = true; };
    submit(window);
    assert.equal(doc.getElementById('login-error').textContent, '请填写企业邮箱账号与密码');

    doc.getElementById('login-email').value = 'chenke';
    doc.getElementById('login-password').value = 'wrong-password';
    submit(window);
    assert.equal(doc.getElementById('login-error').textContent, '账号或密码错误');
    assert.equal(navigated, false);
    assert.equal(window.sessionStorage.getItem(window.SC.LOGIN.SESSION_KEY), null);
  } finally { dom.window.close(); }
});

test('四类角色登录后进入各自默认面板', () => {
  for (const [role, [pathname, actor]] of Object.entries(expectedRoutes)) {
    const { dom, window, doc, errors } = loadEntry();
    try {
      let target = '';
      window.SC.LOGIN.navigate = account => { target = window.SC.LOGIN.routeFor(account); };
      doc.querySelector(`.login-account[data-role="${role}"]`).click();
      submit(window);

      assert.deepEqual(errors, [], role);
      const url = new URL(target);
      assert.equal(url.pathname, pathname, role);
      assert.equal(url.searchParams.get('role'), role, role);
      assert.equal(url.searchParams.get('as'), actor, role);

      const session = JSON.parse(window.sessionStorage.getItem(window.SC.LOGIN.SESSION_KEY));
      assert.equal(session.role, role, role);
      assert.equal(session.id, actor, role);
      assert.equal('password' in session, false, role);
    } finally { dom.window.close(); }
  }
});

test('登录支持完整企业邮箱，并拦截停用身份', () => {
  const { dom, window, doc } = loadEntry();
  try {
    const account = window.SC.LOGIN.accounts.find(item => item.role === 'ADM');
    assert.equal(window.SC.LOGIN.authenticate('chenke@teddymobile.cn', account.password).account.role, 'ADM');

    window.SC.DATA.PEOPLE.find(person => person.id === account.id).status = 'off';
    doc.querySelector('.login-account[data-role="ADM"]').click();
    window.SC.LOGIN.navigate = () => assert.fail('停用账号不应跳转');
    submit(window);
    assert.equal(doc.getElementById('login-error').textContent, '账号已停用，请联系超级管理员');
  } finally { dom.window.close(); }
});

test('人员管理变更会同步登录状态、邮箱、角色和密码凭据', () => {
  const seed = loadEntry();
  let people;
  try {
    people = seed.window.SC.DATA.PEOPLE.map(person => ({ ...person }));
  } finally { seed.dom.window.close(); }

  const changed = people.map(person => {
    if (person.id === 'U-1004') return { ...person, status: 'off' };
    if (person.id === 'U-1002') return { ...person, email: 'renamed.manager@example.com', role: 'MGR' };
    return person;
  });
  changed.push({
    id: 'U-1200', name: '新建人员', email: 'new.person@example.com', mobile: '未填写', role: 'SLS', status: 'on',
    createdAt: '2026-09-20 10:00', lastLoginAt: '暂无登录记录', passwordResetAt: ''
  });
  const { dom, window } = loadEntry('index.html', {
    'sc-v02-feature-pages-v1': JSON.stringify({ version: 2, people: changed }),
    'sc-v02-demo-credentials-v1': JSON.stringify({ U: 'unused', 'U-1001': 'new-admin-pass', 'U-1200': 'new-user-pass' })
  });
  try {
    assert.equal(window.SC.LOGIN.authenticate('chenke@teddymobile.cn', 'Tm7k#Qa2Xw9p').error, 'invalid', '重置后旧密码不可用');
    assert.equal(window.SC.LOGIN.authenticate('chenke@teddymobile.cn', 'new-admin-pass').account.id, 'U-1001');
    assert.equal(window.SC.LOGIN.authenticate('fuzan', 'Ly6w#Nt4Bh7c').error, 'disabled', '停用状态应阻止登录');
    const renamed = window.SC.LOGIN.authenticate('renamed.manager@example.com', 'Rv3d#Kp8Ze1m');
    assert.equal(renamed.account.role, 'MGR', '编辑后的角色应用于登录路由');
    assert.equal(new URL(window.SC.LOGIN.routeFor(renamed.account)).pathname, '/project/pages/employee-insights.html');
    const created = window.SC.LOGIN.authenticate('new.person@example.com', 'new-user-pass');
    assert.equal(created.account.id, 'U-1200', '新增人员应可使用人员管理保存的凭据登录');
  } finally { dom.window.close(); }
});

test('原型导航列出 22 个 V0.2 功能页', () => {
  const { dom, doc } = loadEntry('prototype.html');
  try {
    const links = [...doc.querySelectorAll('#feature-index .hubcard[href]')];
    assert.equal(links.length, 22);
    for (const link of links) {
      const url = new URL(link.href);
      assert.match(url.pathname, /^\/project\/pages\/[a-z-]+\.html$/);
      assert.ok(fs.existsSync(path.join(root, url.pathname.replace('/project/', ''))));
      assert.ok(url.searchParams.get('role'));
      assert.ok(url.searchParams.get('as'));
    }
  } finally { dom.window.close(); }
});
