const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
function load(query='',setup=()=>{},page='customers') {
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'pages',page+'.html'),'utf8'),{url:'http://prototype.test/pages/'+page+'.html?role=ADM&as=U-1001'+query,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window,doc=w.document;w.scrollTo=()=>{};w.Date.now=()=>1788854400000;
  let seed=1;w.Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  setup(w);
  for(const script of doc.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.resolve(root,'pages',script.getAttribute('src').split('?')[0]),'utf8'));
  return {dom,w,doc,errors,state:()=>w.SC.B2.load()};
}
function expand(doc,customer='C-1003') {doc.querySelector('[data-action=combos][data-id="'+customer+'"]').click();return doc.querySelector('#customer-combos-'+customer);}
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));

test('view combo opens in place with the clicked identity and preserves expanded row and filters',()=>{
  const {dom,w,doc,errors,state}=load();
  try {
    const input=doc.querySelector('#customers-table [data-search]');input.value='C-1003';input.dispatchEvent(new w.Event('input',{bubbles:true}));
    const row=expand(doc),button=row.querySelector('[data-action=future-combo]'),id=button.dataset.id;
    const combo=state().combos.find(c=>c.id===id);button.focus();button.click();
    assert.ok(doc.querySelector('.combo-detail-drawer'));assert.equal(w.SC.param('combo'),id);assert.equal(w.location.pathname,'/pages/customers.html');
    assert.equal(doc.querySelector('#customer-combos-C-1003'),row);assert.equal(input.value,'C-1003');
    const drawer=w.SC.B2._drawer;assert.match(drawer.body.textContent,/启明教育/);assert.match(drawer.root.textContent,new RegExp(w.SC.B2.name('people',combo.sales)));
    assert.match(drawer.body.textContent,/当前商机/);assert.match(drawer.body.textContent,/各池空间/);
    drawer.close(true);assert.equal(w.SC.param('combo'),'');assert.equal(doc.activeElement,button);assert.equal(doc.querySelector('#customer-combos-C-1003'),row);assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('combo deep link and retired route open the same combination on the customer list',()=>{
  const first=load();const state=first.state(),combo=state.combos.find(c=>c.customer==='C-1003');const key=first.w.SC.B2.key;first.dom.window.close();
  const second=load('&combo='+combo.id,w=>w.localStorage.setItem(key,JSON.stringify(state)));
  try {assert.ok(second.doc.querySelector('.combo-detail-drawer'));assert.match(second.doc.querySelector('.combo-detail-drawer').textContent,/启明教育/);assert.equal(second.w.SC.param('combo'),combo.id);assert.deepEqual(second.errors,[]);}finally{second.dom.window.close();}
  let target;vm.runInNewContext(fs.readFileSync(path.join(root,'js/pages/combo-detail.js'),'utf8'),{window:{SC:{DATA:{ROLES:{ADM:{}}},B2:{role:'ADM',identity:()=>({role:'ADM'}),href:(page,p)=>page+'.html?'+new URLSearchParams(p)}}},URLSearchParams,location:{search:'?role=ADM&as=U-1001&id='+combo.id,replace:url=>target=url}});
  assert.equal(new URL(target,'http://test/pages/').searchParams.get('combo'),combo.id);
});

test('all combinations in an expanded customer open the selected record; refresh does not duplicate drawers',()=>{
  const {dom,w,doc,state,errors}=load();
  try {
    const row=expand(doc);
    for(const button of row.querySelectorAll('[data-action=future-combo]')) {
      button.click();const c=state().combos.find(c=>c.id===button.dataset.id);
      assert.equal(doc.querySelectorAll('.combo-detail-drawer').length,1);assert.match(doc.querySelector('.combo-detail-drawer').textContent,new RegExp(w.SC.B2.name('people',c.sales)));
    }
    const id=w.SC.param('combo');w.SC.B2.render();assert.equal(doc.querySelectorAll('.combo-detail-drawer').length,1);assert.equal(w.SC.param('combo'),id);w.SC.B2._drawer.close(true);assert.equal(w.SC.param('combo'),'');assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});

test('invalid combo and revoked identity provide feedback without navigating in a loop',()=>{
  const invalid=load('&combo=K-no-longer-exists');
  try {assert.equal(invalid.doc.querySelector('.combo-detail-drawer'),null);assert.match(invalid.doc.body.textContent,/无法查看该经营组合/);assert.equal(invalid.w.SC.param('combo'),'');assert.equal(invalid.w.location.pathname,'/pages/customers.html');assert.deepEqual(invalid.errors,[]);}finally{invalid.dom.window.close();}
  const {dom,w,doc,state,errors}=load();
  try {expand(doc).querySelector('[data-action=future-combo]').click();const current=state();current.people.find(p=>p.id==='U-1001').status='off';w.SC.B2.save(current);w.SC.B2.render();assert.equal(doc.querySelector('.combo-detail-drawer'),null);assert.equal(w.SC.param('combo'),'');assert.deepEqual(errors,[]);}finally{dom.window.close();}
});

test('empty-space archive action refreshes through the customer page host',async()=>{
  const {dom,w,doc,state,errors}=load();
  try {
    const current=state(),combo=current.combos.find(c=>c.customer==='C-1003'&&c.sales==='U-1004');assert.ok(combo);
    current.spaces.push({id:'W-TEST-EMPTY',customer:combo.customer,sales:combo.sales,pool:'POOL-TEST-EMPTY',status:'normal',version:0,created:'2026-09-01'});w.SC.B2.save(current);
    expand(doc).querySelector('[data-action=future-combo][data-id="'+combo.id+'"]').click();
    const archive=doc.querySelector('.combo-detail-drawer [data-action=archive][data-id="W-TEST-EMPTY"]');assert.ok(archive);archive.click();
    doc.querySelector('.mask .modal__foot .btn:last-child').click();await wait();
    assert.equal(state().spaces.find(s=>s.id==='W-TEST-EMPTY').status,'archived');assert.equal(doc.querySelectorAll('.combo-detail-drawer').length,1);assert.deepEqual(errors,[]);
  } finally {dom.window.close();}
});
