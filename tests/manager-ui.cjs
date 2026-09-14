const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..');
function load(page='manager-home',query='',setup=()=>{}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'pages',page+'.html'),'utf8'),{url:'http://prototype.test/pages/'+page+'.html?role=MGR&as=U-1002'+query,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,doc=w.document;w.scrollTo=()=>{};w.Date.now=()=>1788854400000;
 let seed=1;w.Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);setup(w);
 for(const script of doc.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.resolve(root,'pages',script.getAttribute('src').split('?')[0]),'utf8'));
 return{dom,w,doc,errors,state:()=>w.SC.B2.load()};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const close=t=>t.dom.window.close();
test('every manager menu page renders with the same navigation and no runtime errors',()=>{
 for(const page of ['manager-home','manager-approvals','manager-sales','manager-customers','manager-opportunities','manager-admissions','manager-exceptions','placeholder']){
  const t=load(page,page==='placeholder'?'&p=mgr-supervise':'');
  try{assert.ok(t.doc.body.classList.contains('mgr-ui'),page);assert.equal(t.doc.querySelectorAll('.sc-nav a').length,8,page);assert.ok(t.doc.querySelector('#sc-page-body').textContent.trim(),page);assert.deepEqual(t.errors,[],page);if(page==='placeholder')assert.doesNotMatch(t.doc.querySelector('#sc-page-body').textContent,/PRD|M02|菜单不隐藏/);}finally{close(t);}
 }
});
test('approval opens in place with fixed actions; nested opportunity returns without losing a decision',()=>{
 const t=load('manager-approvals');try{
  const {w,doc}=t,link=doc.querySelector('#approval-list a.btn');assert.ok(link);const search=doc.querySelector('[data-search]');search.value='';link.focus();link.click();
  const parent=w.SC.B2._drawer;assert.ok(parent.root.classList.contains('mgr-request-drawer'));assert.equal(w.location.pathname,'/pages/manager-approvals.html');assert.ok(parent.root.querySelector('.b2-drawer__foot [data-action]'));
  const opportunity=parent.body.querySelector('a[href*="opportunity.html"]');
  if(opportunity){const field=parent.body.querySelector('select');field.value=[...field.options].find(o=>o.value)?.value;const value=field.value;opportunity.focus();opportunity.click();const child=w.SC.B2._drawer;assert.equal(child.parent,parent);assert.equal(parent.root.getAttribute('aria-hidden'),'true');assert.ok(child.root.querySelector('.b2-drawer__back'));child.close(true);assert.equal(w.SC.B2._drawer,parent);assert.equal(field.value,value);assert.equal(doc.activeElement,opportunity);}
  parent.close(true);assert.equal(w.SC.param('request'),'');assert.equal(doc.activeElement,link);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('admission deep link supports nested opportunity and space while retaining opinion',()=>{
 const t=load('manager-admissions','&admission=AD-3901');try{
  const {w,doc}=t,parent=w.SC.B2._drawer;assert.ok(parent.root.classList.contains('mgr-admission-drawer'));assert.ok(parent.root.querySelector('.b2-drawer__foot [data-action=approve]'));assert.equal(parent.body.querySelector('[data-action=approve]'),null);
  const opinion=parent.body.querySelector('[name=opinion]');opinion.value='保留的终审意见';
  parent.body.querySelector('#admission-opps a.btn').click();const child=w.SC.B2._drawer;assert.equal(child.parent,parent);assert.ok(child.root.classList.contains('mgr-opportunity-drawer'));child.close(true);assert.equal(opinion.value,'保留的终审意见');
  assert.equal(doc.querySelectorAll('.b2-drawer-mask').length,1);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('combo, workspace, opportunity and customer profile open as nested drawers on the same list',()=>{
 const t=load('manager-customers');try{
  const {w,doc}=t,link=doc.querySelector('#portfolio-table a.btn');link.click();const combo=w.SC.B2._drawer;
  assert.ok(combo.root.classList.contains('mgr-combo-drawer'));
  const customer=combo.body.querySelector('a[href*="customer-detail"]');assert.ok(customer);customer.click();assert.equal(w.SC.B2._drawer.parent,combo);assert.match(w.SC.B2._drawer.body.textContent,/基础信息/);w.SC.B2._drawer.close(true);
  const space=combo.body.querySelector('a[href*="workspace.html"]');assert.ok(space);space.click();const workspace=w.SC.B2._drawer;assert.equal(workspace.parent,combo);assert.match(workspace.body.textContent,/空间与 Agent/);
  workspace.body.querySelector('#workspace-opps a.btn').click();const opp=w.SC.B2._drawer;assert.equal(opp.parent,workspace);opp.close(true);workspace.close(true);assert.equal(w.SC.B2._drawer,combo);combo.close(true);assert.equal(w.SC.param('combo'),'');assert.equal(w.location.pathname,'/pages/manager-customers.html');assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('sales customers uses an overlay and all nested combos belong to the selected salesperson',()=>{
 const t=load('manager-sales');try{
  const link=t.doc.querySelector('#team-sales a.btn'),id=new URL(link.href).searchParams.get('sales');link.click();const drawer=t.w.SC.B2._drawer;
  assert.equal(t.w.SC.param('panel'),'sales');assert.ok(drawer.root.classList.contains('mgr-sales-drawer'));
  for(const a of drawer.body.querySelectorAll('a[href*="combo-detail"]')){const cid=new URL(a.href).searchParams.get('id');assert.equal(t.state().combos.find(c=>c.id===cid).sales,id);}
  assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('customer scope limits history and can be cleared; switching records stays on the list',()=>{
 const t=load('manager-customers','&sales=U-1005');try{
  const {w,doc}=t;assert.ok(doc.querySelector('[data-action=clear-sales]'));
  const table=doc.querySelector('#portfolio-table');for(const tr of table.querySelectorAll('tbody tr'))assert.equal(t.state().combos.find(c=>c.id===tr.dataset.id).sales,'U-1005');
  for(const tr of doc.querySelectorAll('#portfolio-history tbody tr'))assert.equal(t.state().spaces.find(s=>s.id===tr.dataset.id).sales,'U-1005');
  doc.querySelector('[data-action=clear-sales]').click();assert.equal(w.SC.param('sales'),'');assert.ok(doc.querySelector('#portfolio-table [data-filter=sales]'));assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('opportunity operations share one fixed column; batch bar follows selection and filter state is retained',()=>{
 const t=load('manager-opportunities');try{
  const {w,doc}=t;assert.equal([...doc.querySelectorAll('th')].filter(th=>th.textContent==='操作').length,1);assert.doesNotMatch(doc.querySelector('thead').textContent,/承接配置/);
  const box=doc.querySelector('[data-row]');box.click();assert.ok(doc.querySelector('.b2-batchbar').classList.contains('has-selection'));
  const link=doc.querySelector('tbody a.btn');link.click();w.SC.B2._drawer.close(true);assert.ok(box.checked);
  const filter=doc.querySelector('[data-filter=result]');filter.value='active';filter.dispatchEvent(new w.Event('change'));assert.ok(!doc.querySelector('.b2-batchbar').classList.contains('has-selection'));assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('assign is a drawer and only offers managed active sales as beneficiaries',()=>{
 const t=load('manager-approvals','&assign=1');try{
  const {w,doc}=t,drawer=w.SC.B2._drawer;assert.ok(drawer.root.classList.contains('mgr-assign-drawer'));
  const box=drawer.body.querySelector('[data-row]');assert.ok(box);box.click();drawer.body.querySelector('[data-action=batch]').click();
  const sales=doc.querySelector('.mask select[name$="-sales"]');assert.ok(sales);
  for(const option of sales.options)if(option.value)assert.ok(w.SC.B3.isTeam(t.state(),option.value));assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('approve admission refreshes list and panel result without duplicate overlays',async()=>{
 const t=load('manager-admissions','&admission=AD-3901');try{
  const {w,doc}=t;w.SC.B2._drawer.root.querySelector('[data-action=approve]').click();doc.querySelector('.mask .modal__foot .btn:last-child').click();await wait(40);
  assert.equal(t.state().b3.admissions.find(a=>a.id==='AD-3901').status,'approved');assert.equal(doc.querySelectorAll('.b2-drawer-mask').length,1);assert.match(w.SC.B2._drawer.body.textContent,/终审结果/);assert.equal(w.SC.B2._drawer.root.querySelector('[data-action=approve]'),null);
  w.SC.B2._drawer.close(true);assert.equal(doc.querySelector('#admission-table tr[data-id="AD-3901"]'),null);
  const records=[...doc.querySelectorAll('[role=tab]')].find(el=>el.textContent.includes('本人已处理'));records.click();assert.ok(doc.querySelector('#admission-table tr[data-id="AD-3901"]'));assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('invalid deep links and changed group permissions fail closed without disclosing records',()=>{
 const t=load('manager-admissions','&admission=AD-missing');try{assert.equal(t.w.SC.B2._drawer,undefined);assert.equal(t.w.SC.param('admission'),'');assert.match(t.doc.body.textContent,/不存在或已不在本组/);assert.deepEqual(t.errors,[]);}finally{close(t);}
 const u=load('manager-customers');try{
  u.doc.querySelector('#portfolio-table a.btn').click();const s=u.state();s.people.find(p=>p.id==='U-1002').status='off';u.w.SC.B2.save(s);u.w.SC.B3.render();assert.equal(u.doc.querySelector('.b2-drawer-mask'),null);assert.match(u.doc.querySelector('#sc-page-body').textContent,/无权访问/);assert.deepEqual(u.errors,[]);
 }finally{close(u);}
});
test('cross-team detail IDs cannot open; standalone shared pages are retained',()=>{
 const t=load('manager-home');try{
  const s=t.state(),foreign=s.combos.find(c=>!t.w.SC.B3.isTeam(s,c.sales));assert.ok(foreign);assert.equal(t.w.SC.B3.manager.open('combo',foreign.id),null);assert.equal(t.doc.querySelector('.b2-drawer-mask'),null);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
 for(const [page,id]of [['opportunity','O-3001'],['workspace','W-2001'],['space-history','W-2099']]){const t=load(page,'&id='+id);try{assert.equal(t.w.location.pathname,'/pages/'+page+'.html');assert.ok(t.doc.querySelector('.sc-top'));assert.deepEqual(t.errors,[]);}finally{close(t);}}
});
test('legacy manager detail URLs preserve identity and open their matching list panel',()=>{
 for(const [page,host,key,value]of [['manager-approval','manager-approvals','request','REQ-3901'],['manager-admission','manager-admissions','admission','AD-3901'],['manager-assign','manager-approvals','assign','1'],['manager-admission-records','manager-admissions','view','records']]){
  let target;vm.runInNewContext(fs.readFileSync(path.join(root,'js/pages/'+page+'.js'),'utf8'),{URLSearchParams,location:{search:'?role=MGR&as=U-1003'+(key==='request'||key==='admission'?'&id='+value:''),replace:url=>target=url}});
  const url=new URL(target,'http://test/pages/');assert.equal(url.pathname,'/pages/'+host+'.html');assert.equal(url.searchParams.get(key),value);assert.equal(url.searchParams.get('as'),'U-1003');
 }
});
test('Escape closes only the uppermost drawer and restores parent focus',async()=>{
 const t=load('manager-admissions','&admission=AD-3901');try{
  const parent=t.w.SC.B2._drawer,link=parent.body.querySelector('#admission-opps a.btn');link.focus();link.click();t.doc.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(360);
  assert.equal(t.w.SC.B2._drawer,parent);assert.equal(t.doc.querySelectorAll('.b2-drawer-mask').length,1);assert.equal(t.doc.activeElement,link);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});

test('shared customer archive opens its opportunity action in a drawer and uses the selected manager',()=>{
 const t=load('customer-detail','&id=C-1001&view=opps');try{
  assert.ok(t.doc.querySelector('.b3-persona'));assert.equal(t.doc.querySelector('.b3-persona').value,'U-1002');
  const button=t.doc.querySelector('[data-action=future]');assert.ok(button);button.click();assert.ok(t.doc.querySelector('.mgr-opportunity-drawer'));assert.equal(t.w.location.pathname,'/pages/customer-detail.html');assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('approval controls enable the fields for the selected decision and require a rejection reason',()=>{
 const t=load('manager-approvals','&request=REQ-3903');try{
  const drawer=t.w.SC.B2._drawer,decision=drawer.body.querySelector('select[name$="-decision"]');assert.ok(decision);
  const form=decision.form,key=decision.name.replace(/-decision$/,''),reason=form.elements.namedItem(key+'-reason');assert.ok(reason.disabled);
  decision.value='reject';decision.dispatchEvent(new t.w.Event('change'));assert.ok(!reason.disabled);assert.ok(reason.required);
  drawer.root.querySelector('[data-action=process]').click();assert.equal(t.doc.querySelector('.mask'),null);assert.equal(t.state().b3.requests.find(r=>r.id==='REQ-3903').items[0].status,'pending');assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
test('a stale admission with unmet prerequisites shows the cause and disables only approval',()=>{
 const t=load('manager-admissions','&admission=AD-3901');try{
  const s=t.state();s.products.find(p=>p.id===s.opps.find(o=>o.id==='O-3912').product).active=false;t.w.SC.B2.save(s);t.w.SC.B3.render();
  const drawer=t.w.SC.B2._drawer;assert.ok(drawer.root.querySelector('[data-action=approve]').disabled);assert.ok(!drawer.root.querySelector('[data-action=reject]').disabled);assert.match(drawer.body.textContent,/暂无已激活产品/);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});

test('rapid close and reopen does not erase the new drawer deep link',async()=>{
 const t=load('manager-admissions','&admission=AD-3901');try{
  t.w.SC.B2._drawer.close();t.w.SC.B3.manager.open('opportunity','O-3912');await wait(370);
  assert.equal(t.w.SC.param('panel'),'opportunity');assert.equal(t.w.SC.param('detail'),'O-3912');assert.equal(t.doc.querySelectorAll('.b2-drawer-mask').length,1);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});

test('refreshing a detail does not retain duplicate action handlers or stale snapshots',()=>{
 const t=load('manager-opportunities');try{
  t.w.SC.B3.manager.open('opportunity','O-3001');for(let i=0;i<3;i++)t.w.SC.B3.render();
  t.w.SC.B2._drawer.body.querySelector('[data-action=pool]').click();assert.equal(t.doc.querySelectorAll('.mask').length,1);assert.equal(t.doc.querySelectorAll('.b2-drawer-mask').length,1);assert.deepEqual(t.errors,[]);
 }finally{close(t);}
});
