const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
function load(query = '', role = 'ADM', actor = 'U-1001', page = 'admissions') {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages', page + '.html'), 'utf8'), {
    url: 'http://prototype.test/pages/' + page + '.html?role=' + role + '&as=' + actor + query,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {};
  w.Date.now = () => 1788854400000;
  for (const script of doc.querySelectorAll('script[src]'))
    w.eval(fs.readFileSync(path.resolve(root, 'pages', script.getAttribute('src').split('?')[0]), 'utf8'));
  return { dom, w, doc, errors, state: () => w.SC.B2.load() };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
const click = (doc, action) => { const el = doc.querySelector('.admission-drawer [data-action="' + action + '"]'); assert.ok(el, action); el.click(); };
const confirm = async doc => { doc.querySelector('.mask .modal__foot .btn:last-child').click(); await settle(); };
const cancel = async doc => { doc.querySelector('.mask .modal__x').click(); await settle(); };
const choose = (doc, name, value) => { doc.querySelector('[name="' + name + '"]').value = value; };

test('opening and closing preserves list filters, selected rows, route and focus', () => {
  const {dom,w,doc,errors}=load();
  try {
    const root=doc.querySelector('#admission-table'), search=root.querySelector('[data-search]');
    search.value='AD-3901';search.dispatchEvent(new w.Event('input',{bubbles:true}));
    const checkbox=root.querySelector('[data-row]');checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));
    const link=root.querySelector('tbody a.btn');link.focus();link.click();
    assert.equal(doc.querySelector('#admission-table'),root);assert.equal(search.value,'AD-3901');assert.equal(checkbox.checked,true);
    assert.equal(w.location.pathname,'/pages/admissions.html');assert.equal(w.SC.param('admission'),'AD-3901');
    assert.equal(doc.querySelectorAll('.admission-drawer').length,1);
    assert.ok(doc.querySelector('.b2-drawer__foot [data-action=approve]'));
    assert.match(doc.querySelector('.admission-drawer').textContent,/当前完整组合商机/);
    w.SC.B2._drawer.close(true);assert.equal(doc.activeElement,link);assert.equal(w.SC.param('admission'),'');assert.equal(w.SC.param('as'),'U-1001');assert.equal(checkbox.checked,true);
    assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('cancellation preserves state; approval refreshes the drawer, pending list and spaces', async () => {
  const {dom,w,doc,state,errors}=load('&admission=AD-3901');
  try {
    const drawer=doc.querySelector('.b2-drawer'), before=state();
    choose(doc,'opinion','同意本次准入');click(doc,'approve');await cancel(doc);
    assert.equal(state().b3.admissions.find(a=>a.id==='AD-3901').status,'pending');assert.equal(state().spaces.length,before.spaces.length);assert.equal(doc.querySelector('[name=opinion]').value,'同意本次准入');
    click(doc,'approve');await confirm(doc);
    const current=state(),admission=current.b3.admissions.find(a=>a.id==='AD-3901');
    assert.equal(admission.status,'approved');assert.equal(admission.opinion,'同意本次准入');assert.equal(admission.by,'U-1001');
    assert.equal(current.combos.find(c=>c.id===admission.combo).admit,'已通过');
    assert.ok(current.spaces.some(space=>space.sales===admission.sales&&space.customer===admission.customer));
    assert.equal(doc.querySelector('.b2-drawer'),drawer);assert.match(drawer.textContent,/终审结果/);assert.match(drawer.textContent,/各池空间结果/);
    assert.equal(doc.querySelector('.b2-drawer__foot').hidden,true);assert.equal(doc.querySelector('#admission-table tr[data-id="AD-3901"]'),null);assert.equal(doc.querySelector('.mask'),null);
    assert.ok(doc.body.classList.contains('b2-drawer-lock'));assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('rejection requires a reason and other-reason explanation, retaining ownership and pools', async () => {
  const {dom,doc,state,errors}=load('&admission=AD-3901');
  try {
    click(doc,'reject');await confirm(doc);assert.match(doc.querySelector('.mask .b2-error').textContent,/请选择驳回原因/);await cancel(doc);
    choose(doc,'reason','其他');click(doc,'reject');await confirm(doc);assert.match(doc.querySelector('.mask .b2-error').textContent,/补充说明/);await cancel(doc);
    const before=state().opps;choose(doc,'opinion','信息尚待核实');click(doc,'reject');await confirm(doc);
    assert.equal(state().b3.admissions.find(a=>a.id==='AD-3901').status,'rejected');assert.deepEqual(state().opps,before);assert.match(doc.querySelector('.admission-drawer').textContent,/已驳回/);assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('changed versions and admission prerequisites still block approval', async () => {
  const {dom,w,doc,state,errors}=load('&admission=AD-3901');
  try {
    let current=state();current.b3.admissions.find(a=>a.id==='AD-3901').version++;w.SC.B2.save(current);
    click(doc,'approve');await confirm(doc);assert.match(doc.querySelector('.mask .b2-error').textContent,/状态发生变化/);await cancel(doc);
    current=state();const a=current.b3.admissions.find(a=>a.id==='AD-3901');
    for(const o of current.opps.filter(o=>o.sales===a.sales&&o.customer===a.customer))current.products.find(p=>p.id===o.product).active=false;
    w.SC.B2.save(current);w.SC.B3.render();click(doc,'approve');await confirm(doc);assert.match(doc.querySelector('.mask .b2-error').textContent,/已激活/);
    assert.equal(state().b3.admissions.find(a=>a.id==='AD-3901').status,'pending');assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('batch approval remains available after opening and closing detail', async () => {
  const {dom,w,doc,state,errors}=load();
  try {
    const checkbox=doc.querySelector('#admission-table [data-row]');checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));
    doc.querySelector('#admission-table tbody a.btn').click();w.SC.B2._drawer.close(true);
    doc.querySelector('#admission-table [data-action=batch]').click();await confirm(doc);
    assert.equal(state().b3.admissions.find(a=>a.id==='AD-3901').status,'approved');assert.match(doc.querySelector('.mask').textContent,/批量终审结果/);assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('invalid records, quick reopen and revoked identity do not leave stale detail', () => {
  const {dom,w,doc,state,errors}=load('&admission=AD-3901');
  try {
    const old=w.SC.B2._drawer;old.close();w.SC.B3.syncAdmissionDrawer();assert.notEqual(w.SC.B2._drawer,old);assert.equal(doc.querySelectorAll('.admission-drawer').length,1);
    w.SC.B3.setQuery({admission:'unknown'});w.SC.B3.syncAdmissionDrawer();assert.match(doc.querySelector('.admission-drawer').textContent,/没有当前可查看/);assert.equal(doc.querySelector('.b2-drawer__foot').hidden,true);
    w.SC.B3.setQuery({admission:'AD-3901'});w.SC.B3.syncAdmissionDrawer();const current=state();current.people.find(p=>p.id==='U-1001').status='off';w.SC.B2.save(current);w.SC.B3.render();assert.equal(doc.querySelector('.admission-drawer'),null);assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('other roles cannot open the admin drawer and manager uses its own drawer', () => {
  const denied=load('&admission=AD-3901','SLS','U-1004');
  try{assert.equal(denied.doc.querySelector('.admission-drawer'),null);assert.match(denied.doc.querySelector('#sc-page-body').textContent,/无权访问/);assert.deepEqual(denied.errors,[]);}finally{denied.dom.window.close();}
  const manager=load('&admission=AD-3901','MGR','U-1002','manager-admissions');
  try{assert.ok(manager.doc.querySelector('#admit-form'));assert.equal(manager.doc.querySelector('.admission-drawer'),null);assert.deepEqual(manager.errors,[]);}finally{manager.dom.window.close();}
});

test('old detail links and generated links preserve record and identity in the list URL', () => {
  let target;vm.runInNewContext(fs.readFileSync(path.join(root,'js/pages/admission-detail.js'),'utf8'),{URLSearchParams,location:{search:'?role=ADM&as=U-1001&id=AD-3901',replace:url=>target=url}});
  const u=new URL(target,'http://prototype.test/pages/');assert.equal(u.pathname,'/pages/admissions.html');assert.equal(u.searchParams.get('admission'),'AD-3901');assert.equal(u.searchParams.get('as'),'U-1001');assert.equal(u.searchParams.has('id'),false);
  const {dom,w}=load();try{const href=new URL(w.SC.B3.href('admission-detail',{id:'AD-3901'}),'http://prototype.test/pages/');assert.equal(href.pathname,u.pathname);assert.equal(href.searchParams.get('admission'),'AD-3901');}finally{dom.window.close();}
});

test('opportunity overlays the admission drawer; back preserves form, scroll and URL', async () => {
  const {dom,w,doc,errors}=load('&admission=AD-3901');
  try {
    const parent=w.SC.B2._drawer, url=w.location.href, content=parent.body.firstElementChild;
    choose(doc,'opinion','先核对商机，再决定准入');choose(doc,'reason','客户信息不完整');
    parent.body.scrollTop=180;
    const table=parent.body.querySelector('#admission-opps .b2-table-scroll');table.scrollLeft=160;
    const link=parent.body.querySelector('#admission-opps tbody a.btn');
    assert.match(link.href,/opportunity\.html.*O-3912/);
    link.focus();link.click();await settle();
    const child=w.SC.B2._drawer;
    assert.notEqual(child,parent);assert.equal(child.parent,parent);assert.equal(parent.child,child);
    assert.equal(doc.querySelectorAll('.b2-drawer-mask').length,2);assert.equal(parent.closed,false);
    assert.equal(parent.root.inert,true);assert.equal(parent.root.getAttribute('aria-hidden'),'true');
    assert.equal(child.root.querySelector('[role=dialog]').getAttribute('aria-modal'),'true');
    assert.match(child.body.textContent,/远航智联 · 智能风控/);assert.match(child.body.textContent,/当前商机状态/);
    assert.equal(w.location.href,url);assert.equal(parent.body.firstElementChild,content);
    const back=child.root.querySelector('.b2-drawer__back');assert.equal(back.textContent,'返回终审');back.click();
    await new Promise(resolve=>setTimeout(resolve,380));
    assert.equal(w.SC.B2._drawer,parent);assert.equal(parent.root.hasAttribute('aria-hidden'),false);assert.ok(!parent.root.inert);
    assert.equal(parent.root.querySelector('[role=dialog]').getAttribute('aria-modal'),'true');
    assert.equal(parent.body.querySelector('[name=opinion]').value,'先核对商机，再决定准入');
    assert.equal(parent.body.querySelector('[name=reason]').value,'客户信息不完整');
    assert.equal(parent.body.scrollTop,180);assert.equal(table.scrollLeft,160);assert.equal(doc.activeElement,link);
    assert.equal(w.location.href,url);assert.ok(doc.body.classList.contains('b2-drawer-lock'));assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('Escape, close button and backdrop dismiss only the second drawer', async () => {
  const {dom,w,doc,errors}=load('&admission=AD-3901');
  try {
    const parent=w.SC.B2._drawer, link=parent.body.querySelector('#admission-opps tbody a.btn');
    for(const method of ['escape','close','backdrop']) {
      link.focus();link.click();await settle();const child=w.SC.B2._drawer;
      if(method==='escape')doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      else if(method==='close')child.root.querySelector('.b2-drawer__x').click();
      else child.root.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
      // During the exit animation, the parent remains unavailable to the keyboard.
      assert.equal(parent.closed,false);
      await new Promise(resolve=>setTimeout(resolve,380));
      assert.equal(w.SC.B2._drawer,parent);assert.equal(doc.querySelectorAll('.b2-drawer-mask').length,1);
      assert.equal(w.SC.param('admission'),'AD-3901');assert.equal(doc.activeElement,link);
    }
    doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,380));assert.equal(doc.querySelectorAll('.b2-drawer-mask').length,0);assert.equal(w.SC.param('admission'),'');assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('keyboard focus and modal Escape belong to the top drawer only', async () => {
  const {dom,w,doc,errors}=load('&admission=AD-3901');
  try {
    const parent=w.SC.B2._drawer;parent.body.querySelector('#admission-opps tbody a.btn').click();
    await new Promise(resolve=>setTimeout(resolve,80));
    const child=w.SC.B2._drawer,panel=child.root.querySelector('[role=dialog]');
    assert.ok(child.root.contains(doc.activeElement));
    for(const el of child.root.querySelectorAll('a[href],button'))el.getClientRects=()=>[{width:1,height:1}];
    for(const shiftKey of [false,true]){
      panel.focus();const key=new w.KeyboardEvent('keydown',{key:'Tab',shiftKey,bubbles:true,cancelable:true});doc.dispatchEvent(key);
      assert.equal(key.defaultPrevented,true);assert.ok(child.root.contains(doc.activeElement));assert.notEqual(doc.activeElement,panel);
    }
    w.SC.B2.modal({title:'测试上层确认',body:'内容'});
    doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    await settle();assert.equal(doc.querySelector('.mask'),null);assert.equal(parent.closed,false);assert.equal(child.closed,false);assert.equal(w.SC.B2._drawer,child);
    assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('closing or refreshing the parent clears child state; stale opportunity is blocked', () => {
  const {dom,w,doc,state,errors}=load('&admission=AD-3901');
  try {
    let parent=w.SC.B2._drawer;parent.body.querySelector('#admission-opps tbody a.btn').click();
    parent.close(true);assert.equal(doc.querySelectorAll('.b2-drawer-mask').length,0);assert.equal(w.SC.B2._drawer,null);assert.ok(!doc.body.classList.contains('b2-drawer-lock'));
    w.SC.B3.setQuery({admission:'AD-3901'});w.SC.B3.syncAdmissionDrawer();parent=w.SC.B2._drawer;
    parent.body.querySelector('#admission-opps tbody a.btn').click();w.SC.B3.render();
    assert.equal(doc.querySelector('.admission-opportunity-drawer'),null);assert.equal(w.SC.B2._drawer,parent);
    const link=parent.body.querySelector('#admission-opps tbody a.btn'), current=state();
    current.opps.find(o=>o.id==='O-3912').sales='U-1008';w.SC.B2.save(current);link.click();
    assert.equal(doc.querySelector('.admission-opportunity-drawer'),null);assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('standalone opportunity remains available and manager admission now opens nested details', () => {
  const opportunity=load('&id=O-3912','ADM','U-1001','opportunity');
  try {
    assert.equal(opportunity.w.location.pathname,'/pages/opportunity.html');
    assert.match(opportunity.doc.querySelector('#sc-page-body').textContent,/远航智联 · 智能风控/);
    assert.equal(opportunity.doc.querySelector('.b2-drawer-mask'),null);assert.deepEqual(opportunity.errors,[]);
  } finally {opportunity.dom.window.close();}
  const manager=load('&admission=AD-3901','MGR','U-1002','manager-admissions');
  try {
    const link=manager.doc.querySelector('#admission-opps tbody a.btn');
    assert.match(link.href,/opportunity\.html/);assert.equal(link.onclick,null);assert.equal(link.getAttribute('aria-haspopup'),'dialog');link.click();assert.ok(manager.doc.querySelector('.mgr-opportunity-drawer'));assert.deepEqual(manager.errors,[]);
  } finally {manager.dom.window.close();}
});
