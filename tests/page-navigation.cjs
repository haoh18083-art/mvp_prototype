// V0.2 保留页面的导航回归：检查公共框架、当前操作条和静态资源引用。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const base = 'http://prototype.test/project/pages/';
const featurePages = [
  'customer-spaces', 'customer-ownership', 'followup-workbench', 'meeting-center', 'employee-insights',
  'data-insights', 'push-followup', 'platform-data', 'message-center',
  'sales-assistant', 'solution-center', 'solution-workbench', 'solution-push', 'solution-feedback', 'operations-config', 'product-library',
  'conversation-review', 'today-follow', 'insight-ops', 'daily-report', 'ai-capability', 'sales-goals'
];
const retainedPages = [...featurePages];
// 跟进工作台路径当前承载客户空间，是「客户跟进空间」的次级页面，不进入一级菜单。
const secondaryPages = ['followup-workbench', 'solution-push', 'solution-feedback'];
const retiredRuntimePattern = /(?:batch2\/|batch3\/|m02-|identity-bridge|organisation|people-import|xlsx-read|js\/pages\/)/;

function load(file, query = '', options = {}) {
  const html = fs.readFileSync(path.join(root, 'pages', file), 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    url: base + file + query,
    referrer: options.referrer || undefined,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole().on('jsdomError', error => errors.push(error.message)),
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.Date.now = () => 1788854400000;
  let seed = 1;
  w.Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  options.beforeScripts?.(w);
  for (const script of w.document.querySelectorAll('script[src]')) {
    const cleanSrc = script.getAttribute('src').replace(/[?#].*$/, '');
    const source = path.resolve(root, 'pages', cleanSrc);
    try { w.eval(fs.readFileSync(source, 'utf8')); }
    catch (error) { errors.push(`${path.relative(root, source)}: ${error.message}`); }
  }
  return { dom, doc: w.document, errors };
}

function assertLocalLinks(doc, page) {
  for (const anchor of doc.querySelectorAll('a[href]')) {
    const url = new URL(anchor.href);
    if (url.origin !== 'http://prototype.test') continue;
    const relative = url.pathname.replace('/project/', '');
    const target = path.join(root, relative);
    assert.ok(fs.existsSync(target), `${page}: missing ${relative}`);
    if (target.endsWith('.html') && target.includes(`${path.sep}pages${path.sep}`)) {
      assert.ok(retainedPages.some(name => target.endsWith(`${path.sep}${name}.html`)), `${page}: retired ${relative}`);
    }
  }
}

function assertLocalAssets(doc, page) {
  for (const node of doc.querySelectorAll('link[href], script[src]')) {
    const raw = node.getAttribute('href') || node.getAttribute('src');
    const source = path.resolve(root, 'pages', raw.replace(/[?#].*$/, ''));
    assert.ok(fs.existsSync(source), `${page}: missing asset ${path.relative(root, source)}`);
  }
}

test('保留页面都能加载，并且没有旧批次页面引用', () => {
  const files = fs.readdirSync(path.join(root, 'pages')).filter(file => file.endsWith('.html'));
  assert.deepEqual(files.sort(), retainedPages.map(page => `${page}.html`).sort());
  for (const page of retainedPages) {
    const { dom, doc, errors } = load(`${page}.html`);
    try {
      assert.deepEqual(errors, [], page);
      assert.match(doc.title, /V0\.2$/, `${page}: current version title`);
      assert.doesNotMatch(doc.documentElement.textContent, /V1\.0/, `${page}: retired version copy`);
      assert.deepEqual(Object.keys(dom.window.SC.DATA).sort(), [
        'CREDENTIALS_KEY', 'CURRENT', 'DEFAULT_CREDENTIALS', 'PEOPLE', 'PEOPLE_STATE_KEY',
        'ROLES', 'getCredential', 'peopleSnapshot', 'setCredential'
      ], `${page}: current identity data only`);
      assertLocalLinks(doc, page);
      assertLocalAssets(doc, page);
      const retiredRuntime = [...doc.querySelectorAll('script[src]')].find(script =>
        retiredRuntimePattern.test(script.getAttribute('src'))
      );
      assert.equal(retiredRuntime, undefined, `${page}: retired runtime dependency`);
      assert.ok(doc.querySelector('.sc-crumb'), `${page}: breadcrumb`);
      // 次级页面保留返回父级功能页的入口；一级页面的操作条不出现返回项。
      if (secondaryPages.includes(page)) assert.ok(doc.querySelector('#sc-page-back'), `${page}: secondary page keeps parent back entry`);
      else assert.equal(doc.querySelector('#sc-page-back'), null, `${page}: no login/back entry in operation bar`);
      assert.equal(doc.querySelector('[data-od-id="breadcrumb-home"]'), null, `${page}: no login breadcrumb`);
      assert.equal(doc.querySelector('.sc-pid'), null, `${page}: no prototype id in operation bar`);
      assert.equal(doc.querySelector('.sc-crumb__cur')?.textContent.trim(),
        doc.title.replace(/ · 销售指挥官 V0\.2$/, ''), `${page}: operation item title`);
      assert.equal(doc.querySelectorAll('[data-od-id="sidebar-logout"]').length, 1, `${page}: logout entry`);
      assert.equal(doc.querySelector('#sc-page-body.fp > .fp-title'), null, `${page}: no duplicate page title`);
      assert.equal(doc.querySelector('#sc-page-body.fp .fp-eyebrow'), null, `${page}: no workspace eyebrow`);
      assert.equal(doc.querySelector('#sc-page-body.fp > .fp-actions'), null, `${page}: no page-level demo actions`);
      assert.doesNotMatch(doc.body.textContent, /本地演示 · 09\.15|原型导航/, `${page}: no prototype-only controls`);
    } finally { dom.window.close(); }
  }
});

test('次级详情页显示安全返回按钮并指向父级功能页', () => {
  const cases = [
    {
      file: 'followup-workbench.html',
      query: '?role=MGR&as=U-1002&space=WS-201',
      parent: 'customer-spaces.html',
      label: '返回客户空间列表',
      forbidden: ['solution']
    },
    {
      // 不带 space 参数时同样是次级页面，不回退成一级工作台。
      file: 'followup-workbench.html',
      query: '?role=SLS&as=U-1004',
      parent: 'customer-spaces.html',
      label: '返回客户空间列表',
      forbidden: ['solution']
    },
    {
      file: 'followup-workbench.html',
      query: '?role=SLS&as=U-1004&space=WS-201&tab=solutions&solution=SL-101',
      parent: 'followup-workbench.html',
      label: '返回客户空间',
      required: { space: 'WS-201', tab: 'solutions' },
      forbidden: ['solution']
    },
    {
      file: 'meeting-center.html',
      query: '?role=MGR&as=U-1002&meeting=MT-101',
      parent: 'meeting-center.html',
      label: '返回录音列表',
      forbidden: ['meeting']
    }
  ];

  for (const item of cases) {
    const { dom, doc, errors } = load(item.file, item.query);
    try {
      assert.deepEqual(errors, [], `${item.file}: ${item.query}`);
      const back = doc.querySelector('#sc-page-back');
      assert.ok(back, `${item.file}: secondary page has back button`);
      assert.equal(back.getAttribute('aria-label'), '返回上一页');
      assert.equal(back.title, item.label);
      assert.equal(back.dataset.backFallback, back.href);
      const target = new URL(back.href);
      const source = new URL(base + item.file + item.query);
      assert.equal(target.pathname, `${base.replace('http://prototype.test', '')}${item.parent}`);
      assert.equal(target.searchParams.get('role'), source.searchParams.get('role'));
      assert.equal(target.searchParams.get('as'), source.searchParams.get('as'));
      for (const name of item.forbidden || []) assert.equal(target.searchParams.has(name), false, `${item.file}: fallback removes ${name}`);
      for (const [name, value] of Object.entries(item.required || {})) assert.equal(target.searchParams.get(name), value);
      assert.notEqual(target.pathname, '/project/index.html', `${item.file}: fallback never targets login`);
    } finally { dom.window.close(); }
  }
});

test('一级页面和页签状态不会被误判为次级页面', () => {
  const cases = [
    ['customer-spaces.html', '?role=SLS&as=U-1004'],
    ['operations-config.html', '?role=ADM&as=U-1001&tab=people'],
    ['operations-config.html', '?role=ADM&as=U-1001&tab=crm&crmView=errors']
  ];
  for (const [file, query] of cases) {
    const { dom, doc, errors } = load(file, query);
    try {
      assert.deepEqual(errors, [], `${file}: ${query}`);
      assert.equal(doc.querySelector('#sc-page-back'), null, `${file}: tab state has no page back button`);
    } finally { dom.window.close(); }
  }
});

test('返回按钮优先使用同源功能页历史，并保留修饰键原生链接行为', async () => {
  const parent = `${base}customer-spaces.html?role=MGR&as=U-1002`;
  const detail = `${base}followup-workbench.html?role=MGR&as=U-1002&space=WS-201`;
  const loaded = load('followup-workbench.html', '?role=MGR&as=U-1002&space=WS-201', {
    referrer: parent,
    beforeScripts: window => {
      window.history.replaceState({ page: 'parent' }, '', parent);
      window.history.pushState({ page: 'detail' }, '', detail);
    }
  });
  try {
    assert.deepEqual(loaded.errors, []);
    const back = loaded.doc.querySelector('#sc-page-back');
    assert.equal(back.href, parent);
    assert.equal(back.title, '返回上一页');

    const modified = new loaded.dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    back.dispatchEvent(modified);
    assert.equal(modified.defaultPrevented, false, 'modified click keeps native link behavior');

    const plain = new loaded.dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    back.dispatchEvent(plain);
    await new Promise(resolve => loaded.dom.window.setTimeout(resolve, 20));
    assert.equal(plain.defaultPrevented, true, 'plain click uses history when an in-project entry exists');
    assert.equal(loaded.dom.window.location.href, parent);
  } finally { loaded.dom.window.close(); }
});

test('外部来源不会成为次级页面的返回目标', () => {
  const loaded = load('followup-workbench.html', '?role=MGR&as=U-1002&space=WS-201', {
    referrer: 'https://outside.example/customer/42'
  });
  try {
    assert.deepEqual(loaded.errors, []);
    const back = loaded.doc.querySelector('#sc-page-back');
    assert.equal(new URL(back.href).pathname, '/project/pages/customer-spaces.html');
    assert.equal(new URL(back.href).origin, 'http://prototype.test');
  } finally { loaded.dom.window.close(); }
});

test('已退役页面历史不会覆盖次级页面的安全父级链接', () => {
  const retired = `${base}retired-detail.html?role=MGR&as=U-1002`;
  const detail = `${base}followup-workbench.html?role=MGR&as=U-1002&space=WS-201`;
  const loaded = load('followup-workbench.html', '?role=MGR&as=U-1002&space=WS-201', {
    referrer: retired,
    beforeScripts: window => {
      window.history.replaceState({ page: 'retired' }, '', retired);
      window.history.pushState({ page: 'detail' }, '', detail);
    }
  });
  try {
    assert.deepEqual(loaded.errors, []);
    const target = new URL(loaded.doc.querySelector('#sc-page-back').href);
    assert.equal(target.pathname, '/project/pages/customer-spaces.html');
    assert.equal(target.searchParams.get('role'), 'MGR');
    assert.equal(target.searchParams.get('as'), 'U-1002');
  } finally { loaded.dom.window.close(); }
});

test('其他角色或演示身份的历史不会接管当前详情返回', () => {
  const cases = [
    `${base}customer-spaces.html?role=ADM&as=U-1001`,
    `${base}customer-spaces.html?role=MGR&as=U-1003`
  ];
  const detail = `${base}followup-workbench.html?role=MGR&as=U-1002&space=WS-201`;
  for (const previous of cases) {
    const loaded = load('followup-workbench.html', '?role=MGR&as=U-1002&space=WS-201', {
      referrer: previous,
      beforeScripts: window => {
        window.history.replaceState({ page: 'previous' }, '', previous);
        window.history.pushState({ page: 'detail' }, '', detail);
      }
    });
    try {
      assert.deepEqual(loaded.errors, []);
      const back = loaded.doc.querySelector('#sc-page-back');
      const target = new URL(back.href);
      assert.equal(target.pathname, '/project/pages/customer-spaces.html');
      assert.equal(target.searchParams.get('role'), 'MGR');
      assert.equal(target.searchParams.get('as'), 'U-1002');
      assert.equal(back.title, '返回客户空间列表');
    } finally { loaded.dom.window.close(); }
  }
});

test('V0.2 功能页的角色菜单只指向保留页面', () => {
  for (const page of featurePages) {
    const { dom, doc, errors } = load(`${page}.html`);
    try {
      assert.deepEqual(errors, [], page);
      for (const anchor of doc.querySelectorAll('#sc-navigation a[href]')) {
        const pathname = new URL(anchor.href).pathname;
        assert.ok(pathname.endsWith('.html'), `${page}: menu target`);
        assert.ok(retainedPages.some(name => pathname.endsWith(`/pages/${name}.html`)), `${page}: ${pathname}`);
      }
    } finally { dom.window.close(); }
  }
});

test('各角色菜单不暴露当前身份无权访问的页面', () => {
  const actors = { ADM: 'U-1001', MGR: 'U-1002', SLS: 'U-1004', SOL: 'U-1010' };
  for (const [role, actor] of Object.entries(actors)) {
    const source = load('customer-spaces.html', `?role=${role}&as=${actor}`);
    try {
      assert.deepEqual(source.errors, [], role);
      const targets = [...source.doc.querySelectorAll('#sc-navigation a[href]')].map(anchor => new URL(anchor.href));
      for (const target of targets) {
        const page = path.basename(target.pathname);
        const opened = load(page, target.search);
        try {
          assert.deepEqual(opened.errors, [], `${role}: ${page}`);
          assert.doesNotMatch(opened.doc.body.textContent, /当前演示身份无权访问/, `${role}: ${page}`);
        } finally { opened.dom.window.close(); }
      }
    } finally { source.dom.window.close(); }
  }
});

test('退出登录会清理 V0.2 会话并回到根登录页', () => {
  const source = fs.readFileSync(path.join(root, 'js/layout.js'), 'utf8');
  assert.match(source, /sessionStorage\.removeItem\(['"]sc-v02-session['"]\)/);
  assert.match(source, /location\.replace\(new URL\(['"]\.\.\/index\.html['"]/);
});

test('跟进工作台菜单位被封存：不可点击，但路径仍可访问并作为次级页面', () => {
  const { dom, doc, errors } = load('customer-spaces.html', '?role=SLS&as=U-1004');
  try {
    assert.deepEqual(errors, [], 'customer-spaces');
    const sealed = doc.querySelector('#sc-navigation [data-menu="followup-workbench"]');
    assert.ok(sealed, '跟进工作台菜单位仍然保留');
    assert.equal(sealed.tagName, 'SPAN', '封存条目不渲染为链接');
    assert.equal(sealed.getAttribute('href'), null, '封存条目没有可点击目标');
    assert.equal(sealed.getAttribute('aria-disabled'), 'true', '封存条目对辅助技术声明不可用');
    assert.match(sealed.textContent, /本版未开放/, '封存条目说明未开放');
    // 销售菜单第一项是客户跟进空间，角色切换不会落到封存页
    const first = doc.querySelector('#sc-navigation a[href][data-menu]');
    assert.equal(first.dataset.menu, 'customer-spaces', '销售菜单首个可用入口是客户跟进空间');
  } finally { dom.window.close(); }

  // 路径访问不受限制，并按次级页面渲染：父级菜单高亮 + 返回入口
  const direct = load('followup-workbench.html', '?role=SLS&as=U-1004&space=WS-201');
  try {
    assert.deepEqual(direct.errors, [], 'followup-workbench direct');
    assert.ok(direct.doc.querySelector('#fp-content').textContent.trim(), '直接输入路径仍能渲染客户空间');
    assert.ok(direct.doc.querySelector('#sc-page-back'), '次级页面保留返回入口');
    const active = direct.doc.querySelector('#sc-navigation .sc-nav__item.is-active');
    assert.equal(active?.dataset.menu, 'customer-spaces', '高亮父级功能页而不是自身');
    assert.equal(direct.doc.querySelector('[data-menu="followup-workbench"].is-active'), null, '封存条目不会被标为当前页');
  } finally { direct.dom.window.close(); }
});
