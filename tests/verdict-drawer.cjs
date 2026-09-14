const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
function load(query = '', page = 'verdict') {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages', page + '.html'), 'utf8'), {
    url: 'http://prototype.test/pages/' + page + '.html?role=ADM&as=U-1001' + query,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {};
  w.Date.now = () => 1788854400000;
  for (const script of doc.querySelectorAll('script[src]'))
    w.eval(fs.readFileSync(path.resolve(root, 'pages', script.getAttribute('src').split('?')[0]), 'utf8'));
  return { dom, w, doc, errors, state: () => w.SC.B2.load() };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const dismiss = async doc => { doc.querySelector('.mask .modal__x').click(); await settle(); };
const act = (doc, action) => { const b = doc.querySelector('.verdict-approval-drawer [data-action="' + action + '"]'); assert.ok(b, action); b.click(); };
const confirm = async doc => { doc.querySelector('.mask .modal__foot .btn:last-child').click(); await settle(); };

test('list opens the chosen request without replacing filters or background; close restores focus', () => {
  const { dom, w, doc, errors } = load();
  try {
    const search = doc.querySelector('#verdict-body [data-search]');
    search.value = 'REQ-3901'; search.dispatchEvent(new w.Event('input', { bubbles: true }));
    const parent = doc.querySelector('#sc-page-body'), link = parent.querySelector('tbody a.btn');
    link.focus(); link.click();
    assert.equal(doc.querySelector('#sc-page-body'), parent);
    assert.equal(search.value, 'REQ-3901');
    assert.equal(w.location.pathname, '/pages/verdict.html');
    assert.equal(w.SC.param('request'), 'REQ-3901');
    assert.match(doc.querySelector('[role=dialog]').textContent, /景云工业科技有限公司/);
    assert.ok(doc.querySelector('.b2-drawer__foot [data-action="first-approve"]'));
    w.SC.B2._drawer.close(true);
    assert.equal(doc.querySelector('[role=dialog]'), null);
    assert.equal(doc.activeElement, link);
    assert.equal(w.SC.param('request'), '');
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('first-order cancellation has no effect; approval refreshes drawer and removes pending row', async () => {
  const { dom, w, doc, state, errors } = load('&request=REQ-3901');
  try {
    const before = state().opps.length, drawer = doc.querySelector('.b2-drawer');
    act(doc, 'first-approve'); await dismiss(doc);
    assert.equal(state().opps.length, before);
    assert.equal(state().b3.requests.find(r => r.id === 'REQ-3901').status, 'pending');
    assert.equal(doc.querySelector('.b2-drawer'), drawer);
    act(doc, 'first-approve'); await confirm(doc);
    const r = state().b3.requests.find(r => r.id === 'REQ-3901');
    assert.equal(r.status, 'approved'); assert.equal(r.generated.length, 2);
    assert.equal(state().opps.length, before + 2);
    assert.equal(doc.querySelector('.b2-drawer'), drawer);
    assert.match(drawer.textContent, /整单结果/);
    assert.equal(doc.querySelector('.b2-drawer__foot').hidden, true);
    assert.equal(doc.querySelector('#verdict-body tr[data-id="REQ-3901"]'), null);
    assert.ok(doc.body.classList.contains('b2-drawer-lock'));
    assert.equal(w.SC.param('request'), 'REQ-3901');
    await dismiss(doc);
    assert.equal(doc.querySelectorAll('[role=dialog]').length, 1);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('rejection is submitted from the drawer footer and inactive products still block approval', async () => {
  for (const reject of [true, false]) {
    const { dom, doc, state, errors } = load('&request=' + (reject ? 'REQ-3901' : 'REQ-3908'));
    try {
      if (reject) doc.querySelector('[name=rejectReason]').value = '其他';
      act(doc, reject ? 'first-reject' : 'first-approve'); await confirm(doc);
      if (reject) assert.equal(state().b3.requests.find(r => r.id === 'REQ-3901').status, 'rejected');
      else {
        assert.equal(state().b3.requests.find(r => r.id === 'REQ-3908').status, 'pending');
        assert.match(doc.querySelector('.mask').textContent, /未激活/);
      }
      assert.deepEqual(errors, []);
    } finally { dom.window.close(); }
  }
});

test('per-opportunity decisions retain pool rules and public-sea conversion', async () => {
  const { dom, w, doc, state, errors } = load('&request=REQ-3906');
  try {
    doc.querySelector('[name="O-3901-decision"]').value = 'approve';
    doc.querySelector('[name="O-3901-pool"]').value = 'POOL-01';
    act(doc, 'process'); await confirm(doc);
    assert.equal(state().opps.find(o => o.id === 'O-3901').sales, 'U-1004');
    assert.equal(state().opps.find(o => o.id === 'O-3901').result, 'closed');
    assert.equal(state().b3.requests.find(r => r.id === 'REQ-3907').type, 'join');
    assert.match(doc.querySelector('.b2-drawer').textContent, /本次生效时关系快照/);
    await dismiss(doc);
    w.SC.B2._drawer.close(true);
    assert.equal(w.SC.param('request'), '');
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('invalid IDs, role changes and repeated opening cannot keep stale private detail', () => {
  const { dom, w, doc, state, errors } = load('&request=REQ-3901');
  try {
    const first = w.SC.B2._drawer;
    first.close();
    w.SC.B3.syncApprovalDrawer();
    assert.notEqual(w.SC.B2._drawer, first);
    assert.equal(w.SC.param('request'), 'REQ-3901');
    w.SC.B3.setQuery({request:'missing'}); w.SC.B3.syncApprovalDrawer();
    assert.match(doc.querySelector('.verdict-approval-content').textContent, /无可查看的申请/);
    assert.equal(doc.querySelector('.b2-drawer__foot').hidden, true);
    w.SC.B3.setQuery({request:'REQ-3901'}); w.SC.B3.syncApprovalDrawer();
    const s = state(); s.people.find(p=>p.id==='U-1001').status='off'; w.SC.B2.save(s); w.SC.B3.render();
    assert.equal(w.SC.B2._drawer, null);
    assert.doesNotMatch(doc.querySelector('#sc-page-body').textContent, /景云工业/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('legacy URL and other-page links land on the requested drawer, preserving identity', () => {
  let target;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/pages/approval-detail.js'), 'utf8'), {
    URLSearchParams, location: {search:'?role=ADM&as=U-1001&id=REQ-3901',replace:u=>target=u},
  });
  const u = new URL(target,'http://prototype.test/pages/');
  assert.equal(u.pathname,'/pages/verdict.html'); assert.equal(u.searchParams.get('request'),'REQ-3901');
  assert.equal(u.searchParams.get('as'),'U-1001'); assert.equal(u.searchParams.has('id'),false);
  const {dom,w}=load();
  try {
    const link = new URL(w.SC.B3.href('approval-detail',{id:'REQ-3907'}),'http://prototype.test/pages/');
    assert.equal(link.pathname,'/pages/verdict.html'); assert.equal(link.searchParams.get('request'),'REQ-3907');
  } finally {dom.window.close();}
});
