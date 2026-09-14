// Run with node --test tests/page-navigation.cjs; requires jsdom.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const base = 'http://prototype.test/project/pages/';

function load(file, query = '', setup = () => {}, referrer = '', embedded = false) {
  let html = fs.readFileSync(path.join(root, 'pages', file), 'utf8');
  if (embedded) html = html.replace('<head>', '<head><base href="' + base + '">');
  const dom = new JSDOM(html, {
    url: embedded ? 'about:blank' : base + file + query,
    ...(referrer ? { referrer } : {}),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  if (embedded) {
    for (const name of ['localStorage', 'sessionStorage']) {
      const data = new Map();
      Object.defineProperty(w, name, { value: {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: key => data.delete(key),
      } });
    }
  }
  w.scrollTo = () => {};
  w.Date.now = () => 1788854400000;
  let seed = 1;
  w.Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const overrides = setup(w) || {};
  const errors = [];
  for (const script of w.document.querySelectorAll('script[src]')) {
    // Resolve like a real HTTP server: the cache-busting query (?v=...) is not part of the file path.
    const cleanSrc = script.getAttribute('src').replace(/[?#].*$/, '');
    const src = path.resolve(root, 'pages', cleanSrc);
    try {
      const source = fs.readFileSync(src, 'utf8');
      if (overrides.location && cleanSrc === '../js/layout.js') {
        new w.Function('location', source)(overrides.location);
      } else w.eval(source);
    }
    catch (error) { errors.push({ script: path.relative(root, src), message: error.message }); }
  }
  return { dom, w, doc: w.document, errors };
}

function labels(doc) {
  return [...doc.querySelectorAll('.sc-crumb a, .sc-crumb__cur')].map(el => el.textContent);
}

test('all framed pages expose a current location, working parent links and a back entry', () => {
  let count = 0;
  // Legacy sub-pages merged into audit-query's tabs; kept as forwarding stubs for old links/bookmarks.
  const REDIRECTS = { 'audit-object.html': 'object', 'audit-pending.html': 'pending' };
  for (const file of fs.readdirSync(path.join(root, 'pages')).filter(f => f.endsWith('.html'))) {
    const { dom, doc, errors } = load(file);
    try {
      if (file === 'login.html') {
        assert.equal(doc.querySelector('.sc-top'), null);
        continue;
      }
      if (['my-request.html', 'request-form.html', 'customer-search.html', 'sea-customer.html', 'manager-approval.html', 'manager-admission.html', 'manager-assign.html', 'manager-admission-records.html', 'approval-detail.html', 'admission-detail.html', 'combo-detail.html', 'product-detail.html', 'product-check.html', 'product-new.html', 'direct-assign.html', 'high-seas.html', 'source-review.html'].includes(file)) {
        // 已退役为抽屉/重定向的详情页，不再渲染整页外壳。
        assert.equal(doc.querySelector('.sc-crumb'), null, 'retired detail has no page shell');
        assert.deepEqual(errors, []);
        continue;
      }
      if (REDIRECTS[file]) {
        assert.equal(doc.querySelector('.sc-crumb'), null, file + ': stub has no framed chrome');
        const stub = fs.readFileSync(path.join(root, 'pages', file), 'utf8');
        assert.match(stub, /audit-query\.html/, file + ': targets audit-query');
        assert.match(stub, new RegExp("set\\('tab', '" + REDIRECTS[file] + "'\\)"), file + ': forwards tab');
        assert.deepEqual(errors, [], file);
        continue;
      }
      count++;
      const trail = labels(doc);
      assert.equal(trail[0], '销售指挥官', file);
      assert.ok(trail.at(-1).trim(), file);
      assert.equal(doc.querySelectorAll('.sc-crumb [aria-current="page"]').length, 1, file);
      assert.equal(doc.querySelectorAll('#sc-page-back').length, 1, file);
      assert.equal(doc.querySelector('#sc-page-back').getAttribute('aria-label'), '返回上一页');
      const logout = doc.querySelector('[data-od-id="sidebar-user"] button.sc-logout');
      assert.ok(logout, file + ': logout button');
      assert.equal(doc.querySelectorAll('[data-od-id="sidebar-logout"]').length, 1, file);
      assert.equal(logout.getAttribute('aria-label'), '退出登录');
      assert.equal(logout.hasAttribute('href'), false);
      assert.ok(logout.querySelector('svg polyline'), file + ': LogOut icon');
      for (const link of doc.querySelectorAll('.sc-crumb a, #sc-page-back')) {
        const url = new URL(link.href);
        const relative = url.pathname.replace('/project/', '');
        assert.ok(fs.existsSync(path.join(root, relative)), file + ': ' + relative);
        assert.notEqual(url.pathname, '/project/pages/' + file, file + ': self-link');
      }
      assert.deepEqual(errors, [], file);
    } finally { dom.window.close(); }
  }
  assert.equal(count, 46);
});

test('approval drawer stays on the decision desk and preserves the selected persona', () => {
  const { dom, doc, w } = load('verdict.html', '?role=ADM&as=U-1001&request=REQ-3901');
  try {
    assert.deepEqual(labels(doc), ['销售指挥官', '客保裁决台']);
    assert.match(doc.querySelector('[role="dialog"]').textContent, /REQ-3901/);
    assert.equal(w.location.pathname, '/project/pages/verdict.html');
    assert.equal(new URL(w.location.href).searchParams.get('as'), 'U-1001');
    assert.equal(doc.querySelectorAll('#sc-page-back').length, 1);
  } finally { dom.window.close(); }
});

test('embedded previews resolve detail and primary page hierarchy from their base URL', () => {
  for (const [file, expected] of [
    ['customer-detail.html', ['销售指挥官', '全量客户查看', '客户档案']],
    ['verdict.html', ['销售指挥官', '客保裁决台']],
  ]) {
    const { dom, doc, errors } = load(file, '', () => {}, '', true);
    try {
      assert.deepEqual(errors, []);
      assert.deepEqual(labels(doc), expected);
      const target = new URL(doc.querySelector('#sc-page-back').href);
      assert.equal(target.pathname, file === 'customer-detail.html' ? '/project/pages/customers.html' : '/project/index.html');
    } finally { dom.window.close(); }
  }
});

test('shared customer pages use the corresponding role menu', () => {
  for (const [role, parent, href] of [
    ['ADM', '全量客户查看', 'customers.html'],
    ['MGR', '本组客户', 'manager-customers.html'],
    ['SLS', '我的客户', 'my-customers.html'],
    ['SOL', '我的客户池', 'solution-pool.html'],
  ]) {
    const { dom, doc } = load('customer-detail.html', '?role=' + role);
    try {
      assert.deepEqual(labels(doc), ['销售指挥官', parent, '客户档案']);
      assert.equal(new URL(doc.querySelector('#sc-page-back').href).pathname, '/project/pages/' + href);
    } finally { dom.window.close(); }
  }
});

test('product identity drawer retains its parent tab and selected identity', () => {
  const { dom, doc, w } = load('products.html', '?role=ADM&as=U-1001&view=checks&check=PC-01');
  try {
    assert.deepEqual(labels(doc), ['销售指挥官', '产品管理']);
    assert.equal(doc.querySelector('#product-tabs [aria-selected="true"]').dataset.tab, 'checks');
    assert.equal(doc.querySelector('[role="dialog"]').getAttribute('aria-label'), '产品身份核对');
    assert.equal(new URL(w.location.href).searchParams.get('as'), 'U-1001');
  } finally { dom.window.close(); }
});

test('top-level pages retain two breadcrumb levels and fall back to the overview', () => {
  const { dom, doc } = load('verdict.html');
  try {
    assert.deepEqual(labels(doc), ['销售指挥官', '客保裁决台']);
    assert.equal(doc.querySelector('#sc-page-back').href, 'http://prototype.test/project/index.html');
  } finally { dom.window.close(); }
});

test('internal back uses history, keeping the previous URL including filters', () => {
  const referrer = base + 'verdict.html?role=ADM&as=U-1001&view=records';
  let backCount = 0;
  const { dom, w, doc } = load('verdict.html', '', w => {
    Object.defineProperty(w.history, 'length', { value: 2 });
    w.history.back = () => backCount++;
  }, referrer);
  try {
    const back = doc.querySelector('#sc-page-back');
    assert.equal(back.href, referrer);
    const click = new w.MouseEvent('click', { bubbles: true, cancelable: true });
    back.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true);
    assert.equal(backCount, 1);
    const modified = new w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    back.addEventListener('click', e => e.preventDefault(), { once: true });
    back.dispatchEvent(modified);
    assert.equal(backCount, 1);
  } finally { dom.window.close(); }
});

test('direct opens, new tabs and unrelated referrers use the parent fallback', () => {
  for (const [referrer, length] of [
    ['', 1],
    [base + 'verdict.html?view=records', 1],
    ['https://external.test/pages/verdict.html', 2],
    ['http://prototype.test/other-project/pages/verdict.html', 2],
    ['http://prototype.test/project/preview', 2],
  ]) {
    let called = false;
    const { dom, w, doc } = load('verdict.html', '', w => {
      Object.defineProperty(w.history, 'length', { value: length });
      w.history.back = () => { called = true; };
    }, referrer);
    try {
      const back = doc.querySelector('#sc-page-back');
      assert.equal(new URL(back.href).pathname, '/project/index.html');
      back.addEventListener('click', e => e.preventDefault(), { once: true });
      back.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
      assert.equal(called, false);
    } finally { dom.window.close(); }
  }
});

test('native history entries take precedence over the original document referrer', () => {
  const previous = base + 'approval-records.html?role=ADM';
  const { dom, doc } = load('verdict.html', '', w => {
    Object.defineProperty(w.history, 'length', { value: 3 });
    w.navigation = {
      currentEntry: { index: 2 },
      entries: () => [{ index: 1, url: previous }, { index: 2, url: w.location.href }],
    };
  }, base + 'verdict.html');
  try { assert.equal(doc.querySelector('#sc-page-back').href, previous); }
  finally { dom.window.close(); }
});

test('rerendering and collapsing navigation do not change the route or duplicate back controls', () => {
  const { dom, w, doc } = load('verdict.html', '?role=ADM&as=U-1001');
  try {
    const initial = labels(doc);
    w.SC.B3.render();
    assert.deepEqual(labels(doc), initial);
    assert.equal(doc.querySelectorAll('#sc-page-back').length, 1);
    const body = doc.querySelector('#sc-page-body');
    const nav = doc.querySelector('#sc-navigation');
    doc.querySelector('.sc-nav-toggle').click();
    doc.querySelector('.sc-nav-toggle').click();
    assert.equal(doc.querySelector('#sc-page-body'), body);
    assert.equal(doc.querySelector('#sc-navigation'), nav);
  } finally { dom.window.close(); }
});

const waitForDismissal = w => new Promise(resolve => w.setTimeout(resolve, 250));

test('all four roles and legacy pages require explicit confirmation to log out', async () => {
  for (const file of ['verdict.html', 'manager-home.html', 'sales-home.html', 'solution-pool.html', 'groups.html']) {
    const destinations = [];
    const { dom, w, doc, errors } = load(file, '', w => ({
      location: { href: w.location.href, search: w.location.search, replace: url => destinations.push(url) },
    }));
    try {
      assert.deepEqual(errors, [], file);
      const logout = doc.querySelector('.sc-logout');
      const app = doc.querySelector('#sc-app');
      const body = doc.querySelector('#sc-page-body');
      const stored = Object.assign({}, w.localStorage);
      logout.click();
      logout.click();
      assert.equal(doc.querySelectorAll('.sc-logout-confirm').length, 1);
      const mask = doc.querySelector('.sc-logout-confirm');
      assert.equal(mask.querySelector('#sc-logout-message').textContent, '是否要退出系统？');
      assert.equal(mask.querySelector('[role="dialog"]').getAttribute('aria-describedby'), 'sc-logout-message');
      assert.equal(app.hasAttribute('inert'), true);
      assert.equal(doc.activeElement, mask.querySelector('[data-od-id="logout-cancel"]'));
      assert.deepEqual(destinations, []);
      mask.querySelector('[data-od-id="logout-cancel"]').click();
      assert.equal(mask.isConnected, true, 'dismissal animates before removing the dialog');
      await waitForDismissal(w);
      assert.equal(doc.querySelector('.sc-logout-confirm'), null);
      assert.equal(app.hasAttribute('inert'), false);
      assert.equal(doc.activeElement, logout);
      assert.equal(doc.querySelector('#sc-page-body'), body);
      assert.deepEqual(destinations, []);
      logout.click();
      const confirm = doc.querySelector('[data-od-id="logout-confirm"]');
      confirm.click();
      confirm.click();
      await waitForDismissal(w);
      assert.deepEqual(destinations, [base + 'login.html']);
      assert.deepEqual(Object.assign({}, w.localStorage), stored);
    } finally { dom.window.close(); }
  }
});

test('mobile logout supports focus trapping, Escape, backdrop and close without exiting', async () => {
  const destinations = [];
  const { dom, w, doc } = load('sales-home.html', '', w => {
    w.innerWidth = 390;
    return { location: { href: w.location.href, search: '', replace: url => destinations.push(url) } };
  });
  try {
    const toggle = doc.querySelector('.sc-nav-toggle');
    toggle.click();
    const logout = doc.querySelector('.sc-logout');
    for (const dismiss of ['Escape', 'backdrop', 'close']) {
      logout.click();
      const mask = doc.querySelector('.sc-logout-confirm');
      const close = mask.querySelector('.modal__x');
      const confirm = mask.querySelector('[data-od-id="logout-confirm"]');
      confirm.focus();
      confirm.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      assert.equal(doc.activeElement, close);
      close.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      assert.equal(doc.activeElement, confirm);
      if (dismiss === 'Escape') confirm.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      else if (dismiss === 'backdrop') mask.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
      else close.click();
      await waitForDismissal(w);
      assert.equal(doc.querySelector('.sc-logout-confirm'), null);
      assert.equal(doc.querySelector('#sc-app').hasAttribute('inert'), false);
      assert.equal(doc.activeElement, logout);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.deepEqual(destinations, []);
    }
    logout.click();
    w.SC.B3.render();
    doc.querySelector('[data-od-id="logout-cancel"]').click();
    await waitForDismissal(w);
    assert.equal(doc.querySelectorAll('.sc-logout').length, 1);
    assert.equal(doc.activeElement, doc.querySelector('.sc-logout'));
  } finally { dom.window.close(); }
});

function menuTree(nav) {
  return [...nav.querySelectorAll('[data-menu], [data-nav-toggle]')].map(node => ({
    key: node.dataset.menu || node.dataset.navToggle,
    parent: node.closest('[data-nav-group]')?.dataset.navGroup || null,
    label: node.querySelector('.sc-nav__label').textContent,
    href: node.getAttribute('href') ? new URL(node.href).pathname : null,
  }));
}

function sharedNavigationStore(w) {
  const local = Object.assign({}, w.localStorage), session = Object.assign({}, w.sessionStorage);
  return next => {
    for (const [key, value] of Object.entries(local)) next.localStorage.setItem(key, value);
    for (const [key, value] of Object.entries(session)) next.sessionStorage.setItem(key, value);
  };
}

test('all pages use the same complete menu tree for each of the four roles', () => {
  const expected = {}, counts = { ADM: 0, MGR: 0, SLS: 0, SOL: 0 };
  for (const [role, actor] of [['ADM','U-1001'], ['MGR','U-1002'], ['SLS','U-1004'], ['SOL','U-1010']]) {
    for (const file of fs.readdirSync(path.join(root,'pages')).filter(file => file.endsWith('.html'))) {
      const {dom,doc,errors} = load(file,'?role='+role+'&as='+actor);
      try {
        assert.deepEqual(errors,[],role+' '+file);
        const nav=doc.querySelector('#sc-navigation');if(!nav)continue;
        const tree=menuTree(nav);
        if(!expected[role]) expected[role]=tree;
        assert.deepEqual(tree,expected[role],role+' '+file);
        assert.equal(nav.querySelectorAll('[data-nav-toggle]').length,role==='ADM'?2:0,role+' '+file);
        for(const button of nav.querySelectorAll('[data-nav-toggle]')) {
          assert.equal(button.getAttribute('aria-expanded'),'true',file+' grouped menu visible on entry');
          assert.equal(doc.getElementById(button.getAttribute('aria-controls')).hasAttribute('inert'),false);
        }
        for(const link of nav.querySelectorAll('a')) {
          assert.equal(new URL(link.href).searchParams.get('role'),role,file+' menu role');
          assert.equal(new URL(link.href).searchParams.get('as'),actor,file+' menu actor');
        }
        counts[role]++;
      } finally {dom.window.close();}
    }
  }
  assert.deepEqual(counts,{ADM:46,MGR:46,SLS:46,SOL:46});
});

test('parent menus stay expanded across primary pages, child pages and rerenders', () => {
  let setup=()=>{};
  for(const file of ['verdict.html','approval-records.html','handover.html','opportunity.html','workspace.html','admissions.html','products.html','people-detail.html']) {
    const {dom,w,doc}=load(file,'?role=ADM&as=U-1001',setup);
    try {
      for(const key of ['verdictgrp','custmgmt'])
        assert.equal(doc.querySelector('[data-nav-toggle="'+key+'"]').getAttribute('aria-expanded'),'true',file+' '+key);
      (w.SC.B3?.render || w.SC.B2?.render || w.SC.rerender)();
      for(const key of ['verdictgrp','custmgmt'])
        assert.equal(doc.querySelector('[data-nav-toggle="'+key+'"]').getAttribute('aria-expanded'),'true',file+' rerender '+key);
      setup=sharedNavigationStore(w);
    } finally {dom.window.close();}
  }
});

test('manual group collapse is respected even on active descendants and across pages', () => {
  const first=load('verdict.html','?role=ADM&as=U-1001');
  let setup;
  try {
    first.doc.querySelector('[data-nav-toggle=verdictgrp]').click();
    first.w.SC.B3.render();
    assert.equal(first.doc.querySelector('[data-nav-toggle=verdictgrp]').getAttribute('aria-expanded'),'false');
    assert.equal(first.doc.getElementById('sc-nav-group-verdictgrp').hasAttribute('inert'),true);
    setup=sharedNavigationStore(first.w);
  } finally {first.dom.window.close();}
  for(const file of ['approval-records.html','handover.html','customers.html','workspace.html']) {
    const {dom,doc,w}=load(file,'?role=ADM&as=U-1001',setup);
    try {
      assert.equal(doc.querySelector('[data-nav-toggle=verdictgrp]').getAttribute('aria-expanded'),'false',file);
      assert.equal(doc.querySelector('[data-nav-toggle=custmgmt]').getAttribute('aria-expanded'),'true',file);
      setup=sharedNavigationStore(w);
    } finally {dom.window.close();}
  }
});

test('sidebar scroll and desktop/mobile collapse preferences survive navigation independently', () => {
  const first=load('verdict.html','?role=ADM&as=U-1001');let setup;
  try {
    const scroller=first.doc.querySelector('.sc-nav__scroll');
    scroller.scrollTop=144;scroller.dispatchEvent(new first.w.Event('scroll'));
    first.w.SC.B3.render();assert.equal(first.doc.querySelector('.sc-nav__scroll').scrollTop,144);
    first.doc.querySelector('.sc-nav-toggle').click();setup=sharedNavigationStore(first.w);
  } finally {first.dom.window.close();}
  const second=load('people-detail.html','?role=ADM&as=U-1001',setup);
  try {
    assert.equal(second.doc.querySelector('.sc-nav-shell').dataset.collapsed,'true');
    assert.equal(second.doc.querySelector('.sc-nav__scroll').scrollTop,144);
    second.doc.querySelector('.sc-nav-toggle').click();setup=sharedNavigationStore(second.w);
  } finally {second.dom.window.close();}
  const mobile=load('products.html','?role=ADM&as=U-1001',w=>{setup(w);w.innerWidth=390;});
  try {
    assert.equal(mobile.doc.querySelector('.sc-nav-shell').dataset.collapsed,'true');
    mobile.doc.querySelector('.sc-nav-toggle').click();
    assert.equal(mobile.w.localStorage.getItem('sc-nav-collapsed'),'false');
    assert.equal(mobile.w.localStorage.getItem('sc-nav-collapsed-mobile'),'false');
  } finally {mobile.dom.window.close();}
});

test('restored pages and other tabs synchronize navigation state without reloading content', () => {
  const {dom,w,doc}=load('customers.html','?role=ADM&as=U-1001');
  try {
    const content=doc.querySelector('#sc-page-body');
    w.localStorage.setItem('sc-nav-group-verdictgrp','false');
    w.dispatchEvent(new w.StorageEvent('storage',{key:'sc-nav-group-verdictgrp',newValue:'false'}));
    assert.equal(doc.querySelector('[data-nav-toggle=verdictgrp]').getAttribute('aria-expanded'),'false');
    assert.equal(doc.getElementById('sc-nav-group-verdictgrp').hasAttribute('inert'),true);
    w.localStorage.setItem('sc-nav-group-verdictgrp','true');
    w.dispatchEvent(new w.Event('pageshow'));
    assert.equal(doc.querySelector('[data-nav-toggle=verdictgrp]').getAttribute('aria-expanded'),'true');
    assert.equal(doc.querySelector('#sc-page-body'),content);
  } finally {dom.window.close();}
});

test('navigation resources have one shared version across every HTML entry', () => {
  const assets = new Map([['js/menu.js',new Set()],['js/layout.js',new Set()],['css/layout.css',new Set()]]);
  for(const file of [path.join(root,'index.html'), ...fs.readdirSync(path.join(root,'pages')).map(file=>path.join(root,'pages',file))]) {
    if(!file.endsWith('.html'))continue;
    const html=fs.readFileSync(file,'utf8');
    for(const [asset, versions] of assets) {
      for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        if(match[1].split('?')[0].endsWith(asset))versions.add(new URL(match[1],'http://test/').searchParams.get('v'));
      }
    }
  }
  for(const [asset,versions] of assets) {assert.equal(versions.size,1,asset);assert.equal(versions.has(null),false,asset);}
  const css=fs.readFileSync(path.join(root,'css/layout.css'),'utf8');
  const imported=/navigation-ant\.css\?v=([^"')]+)/.exec(css);
  assert.ok(imported,'navigation stylesheet is versioned');
  assert.equal(imported[1],[...assets.get('css/layout.css')][0]);
});
