const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict"),{test}=require("node:test");
const {JSDOM,VirtualConsole}=require("jsdom"),root=path.resolve(__dirname,"..");
function load(page="market",query="",setup=()=>{},actor="U-1004"){
 const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(root,"pages",page+".html"),"utf8"),{url:"http://prototype.test/pages/"+page+".html?role=SLS&as="+actor+query,runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,doc=w.document;w.scrollTo=()=>{};w.confirm=()=>true;w.Date.now=()=>1788854400000;
 let seed=1;w.Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);setup(w);
 for(const script of doc.querySelectorAll("script[src]"))w.eval(fs.readFileSync(path.resolve(root,"pages",script.getAttribute("src").split("?")[0]),"utf8"));
 return{dom,w,doc,errors,state:()=>w.SC.B2.load(),close:()=>dom.window.close()};
}
function fill(t,root,name,value){
 const field=root.querySelector('[name="'+name+'"]');assert.ok(field,name);
 if(field.type==="checkbox")field.checked=!!value;else field.value=value;
 field.dispatchEvent(new t.w.Event(field.tagName==="SELECT"||field.type==="checkbox"?"change":"input",{bubbles:true}));return field;
}
function completeNew(t,name="松涛协同有限公司"){
 const d=t.w.SC.B2._drawer;fill(t,d.body,"name",name);fill(t,d.body,"channel","销售自拓");fill(t,d.body,"pool","POOL-01");fill(t,d.body,"products",true);return d;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test("all nine sales menu surfaces render consistently for both sales personas",()=>{
 for(const actor of ["U-1004","U-1008"])for(const [page,q]of [["sales-home",""],["my-customers",""],["my-requests",""],["market",""],...["tasks","records","flows","plans","agent"].map(k=>["placeholder","&p=sls-"+k])]){
  const t=load(page,q,()=>{},actor);try{
   assert.ok(t.doc.body.classList.contains("sls-ui"),page+q);assert.equal(t.doc.querySelectorAll(".sc-nav a").length,9);assert.equal(t.doc.querySelector(".b3-persona").value,actor);
   assert.doesNotMatch(t.doc.querySelector("#sc-page-body").textContent,/PRD-|M02-|本功能由后续|为什么本期为空/);assert.deepEqual(t.errors,[],page+q);
  }finally{t.close();}
 }
});
test("own customer list uses separate history tab, accurate ready filter and narrow checkbox column",()=>{
 const t=load("my-customers","&admit=ready");try{
  assert.equal(t.doc.querySelector("[data-filter=admit]").value,"ready");
  for(const tr of t.doc.querySelectorAll("#portfolio-table tbody tr")){const c=t.state().combos.find(c=>c.id===tr.dataset.id);assert.equal(c.sales,"U-1004");assert.equal(t.w.SC.B3.admitError(t.state(),c),"");assert.notEqual(c.admit,"已通过");}
  assert.ok(t.doc.querySelector("#portfolio-history").closest("section").hidden);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("market retains filters and selected row when an opportunity drawer is opened and closed",()=>{
 const t=load();try{
  const f=t.doc.querySelector('[data-filter=product]');f.value="P-101";f.dispatchEvent(new t.w.Event("change"));
  const link=t.doc.querySelector("#market-table a.btn");assert.ok(link);link.focus();link.click();assert.ok(t.doc.querySelector(".sls-opportunity-drawer"));
  t.w.SC.B2._drawer.close(true);assert.equal(f.value,"P-101");assert.equal(t.doc.activeElement,link);assert.equal(t.w.location.pathname,"/pages/market.html");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("combination, customer archive, workspace and opportunity form an in-place drawer stack",()=>{
 const t=load("my-customers");try{
  t.doc.querySelector("#portfolio-table a.btn").click();const combo=t.w.SC.B2._drawer;assert.equal(combo.body.querySelectorAll(".cmb-metrics .b2-stat").length,3);
  combo.body.querySelector('a[href*="customer-detail"]').click();const profile=t.w.SC.B2._drawer;assert.equal(profile.parent,combo);assert.match(profile.body.textContent,/联系人/);profile.close(true);
  combo.body.querySelector('a[href*="workspace.html"]').click();const space=t.w.SC.B2._drawer;assert.equal(space.parent,combo);space.body.querySelector("#workspace-opps a.btn").click();assert.equal(t.w.SC.B2._drawer.parent,space);
  t.w.SC.B2._drawer.close(true);space.close(true);assert.equal(t.w.SC.B2._drawer,combo);combo.close(true);assert.equal(t.w.SC.param("combo"),"");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("new opportunity application opens over its combination with fixed footer and product choices",()=>{
 const t=load("my-customers");try{
  t.doc.querySelector("#portfolio-table a.btn").click();const combo=t.w.SC.B2._drawer;
  combo.root.querySelector('a[href*="panel=form"]').click();const form=t.w.SC.B2._drawer;assert.equal(form.parent,combo);
  assert.ok(form.root.querySelector('.b2-drawer__foot [data-action=submit]'));assert.ok(form.body.querySelector(".sls-product-choices"));assert.equal(form.body.querySelector('[name=type]').value,"new");
  form.close(true);assert.equal(t.w.SC.B2._drawer,combo);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("changing request type and customer updates candidates in the same drawer",()=>{
 const t=load("market","&panel=form&type=first_new");try{
  const d=t.w.SC.B2._drawer;fill(t,d.body,"name","切换前保留公司");fill(t,d.body,"type","release");
  assert.equal(t.w.SC.B2._drawer,d);assert.ok(d.body.querySelector('[name=customer]'));fill(t,d.body,"customer","C-1001");
  assert.equal(t.w.SC.B2._drawer,d);for(const box of d.body.querySelectorAll('[name=opps]'))assert.equal(t.state().opps.find(o=>o.id===box.value).customer,"C-1001");
  fill(t,d.body,"type","first_new");assert.equal(d.body.querySelector('[name=name]').value,"切换前保留公司");assert.equal(t.w.location.pathname,"/pages/market.html");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("form drafts survive close, reload and returning from child lookups without leaking across personas",()=>{
 const t=load("market","&panel=form&type=first_new");let saved;
 try{
  const d=completeNew(t);d.close(true);t.w.SC.B3.sales.open("form",{type:"first_new"});assert.equal(t.w.SC.B2._drawer.body.querySelector('[name=name]').value,"松涛协同有限公司");
  saved=Object.entries(t.w.sessionStorage);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
 const u=load("market","&panel=form&type=first_new",w=>saved.forEach(([k,v])=>w.sessionStorage.setItem(k,v)));
 try{assert.equal(u.w.SC.B2._drawer.body.querySelector('[name=name]').value,"松涛协同有限公司");assert.ok(u.w.SC.B2._drawer.body.querySelector('[name=products]').checked);assert.deepEqual(u.errors,[]);}finally{u.close();}
 const v=load("market","&panel=form&type=first_new",w=>saved.forEach(([k,x])=>w.sessionStorage.setItem(k,x)),"U-1008");
 try{assert.equal(v.w.SC.B2._drawer.body.querySelector('[name=name]').value,"");assert.deepEqual(v.errors,[]);}finally{v.close();}
});
test("dedup results support exact matches and new-customer applications without navigation",()=>{
 const t=load();try{
  fill(t,t.doc.querySelector("#customer-search"),"name","星辰科技有限公司");t.doc.querySelector('[data-action=dedup]').click();let d=t.w.SC.B2._drawer;
  assert.ok(d.root.classList.contains("sls-search-drawer"));assert.match(d.body.textContent,/精确/);assert.equal(d.body.querySelector('[data-action=new]'),null);
  fill(t,d.body,"name","全新星港协作有限公司");d.body.querySelector('[data-action=search]').click();d=t.w.SC.B2._drawer;assert.match(d.body.textContent,/未命中已有客户/);
  d.body.querySelector('[data-action=new]').click();assert.ok(t.doc.querySelector(".sls-form-drawer"));assert.equal(t.w.SC.B2._drawer.body.querySelector('[name=name]').value,"全新星港协作有限公司");assert.equal(t.w.location.pathname,"/pages/market.html");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("fuzzy dedup returns to the original draft and preserves products and customer fields",()=>{
 const t=load("market","&panel=form&type=first_new");try{
  const form=completeNew(t,"星辰科技");form.root.querySelector('[data-action=submit]').click();const check=t.w.SC.B2._drawer;assert.equal(check.parent,form);
  fill(t,check.body,"distinct",true);fill(t,check.body,"reason","经核对是不同主体");check.body.querySelector('[data-action=new]').click();
  assert.equal(t.w.SC.B2._drawer,form);assert.equal(form.body.querySelector('[name=channel]').value,"销售自拓");assert.ok(form.body.querySelector('[name=products]').checked);assert.ok(form.body.querySelector('[name=distinct]').checked);assert.equal(form.body.querySelector('[name=reason]').value,"经核对是不同主体");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("submit new customer application refreshes the same host and shows its request result",async()=>{
 const t=load("market","&panel=form&type=first_new");try{
  const d=completeNew(t),before=t.state();d.root.querySelector('[data-action=submit]').click();let modal=t.doc.querySelector(".mask");assert.ok(modal);
  modal.querySelector(".modal__foot .btn:first-child").click();assert.equal(t.state().b3.requests.length,before.b3.requests.length);
  d.root.querySelector('[data-action=submit]').click();t.doc.querySelector(".mask .modal__foot .btn:last-child").click();await wait(40);
  const s=t.state(),r=s.b3.requests.find(r=>r.name==="松涛协同有限公司");assert.ok(r);assert.equal(r.actor,"U-1004");assert.equal(r.status,"pending");assert.equal(s.opps.length,before.opps.length);assert.equal(s.customers.length,before.customers.length);
  assert.equal(t.w.SC.B2._drawer,d);assert.match(d.body.textContent,/待审批/);assert.equal(t.w.SC.param("request"),r.id);assert.equal(d.root.querySelector('[data-action=submit]'),null);assert.equal(t.w.location.pathname,"/pages/market.html");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("exact duplicate client names and empty product selections are blocked before confirmation",()=>{
 const t=load("market","&panel=form&type=first_new");try{
  const d=completeNew(t,"星辰科技有限公司");d.root.querySelector('[data-action=submit]').click();assert.equal(t.doc.querySelector(".mask"),null);assert.match(d.body.textContent,/客户全称已存在/);
  fill(t,d.body,"products",false);d.root.querySelector('[data-action=submit]').click();assert.match(d.body.textContent,/请选择至少一个可申请产品/);assert.equal(t.doc.querySelector(".mask"),null);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("sea customer batch selection carries the selected opportunities into a nested form",()=>{
 const t=load("market","&view=sea");try{
  const s=t.state(),o=s.opps.find(o=>o.customer==="C-1007"&&!o.sales&&t.w.SC.B3.active(s,o));assert.ok(o);o.pending="none";t.w.SC.B2.save(s);t.w.SC.B3.render();
  t.doc.querySelector("#market-table a.btn").click();const sea=t.w.SC.B2._drawer,box=sea.body.querySelector('[data-row="'+o.id+'"]');box.click();sea.body.querySelector('[data-action=batch]').click();
  const d=t.w.SC.B2._drawer;assert.equal(d.parent,sea);assert.equal(d.body.querySelector('[name=type]').value,"sea");assert.ok(d.body.querySelector('[name=opps][value="'+o.id+'"]').checked);d.close(true);assert.ok(box.checked);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("all nine request types render their dependent inputs in a drawer",()=>{
 for(const type of ["first_new","first_existing","new","claim","join","dispute","release","sea","restore"]){
  const t=load("market","&panel=form&type="+type+"&customer="+(type==="sea"?"C-1007":type==="first_existing"?"C-1012":"C-1001"));
  try{assert.equal(t.w.SC.B2._drawer.body.querySelector('[name=type]').value,type);assert.ok(t.w.SC.B2._drawer.root.querySelector('.b2-drawer__foot [data-action=submit]'));assert.deepEqual(t.errors,[],type);}finally{t.close();}
 }
});
test("request detail enforces actor ownership and list status tabs use request state",()=>{
 const t=load("my-requests");try{
  for(const row of t.doc.querySelectorAll("#request-list tbody tr"))assert.equal(t.state().b3.requests.find(r=>r.id===row.dataset.id).actor,"U-1004");
  t.doc.querySelector("#request-list a.btn").click();assert.ok(t.doc.querySelector(".sls-request-drawer"));t.w.SC.B2._drawer.close(true);
  assert.equal(t.w.SC.B3.sales.open("request",{id:"REQ-3907"}),null);assert.equal(t.doc.querySelector(".sls-request-drawer"),null);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("non-owned customer archive exposes only market facts and never editing or contacts",()=>{
 const t=load("market");try{
  const s=t.state(),c=s.customers.find(c=>!s.opps.some(o=>o.customer===c.id&&o.sales==="U-1004"));assert.ok(c);
  t.w.SC.B3.sales.open("customer",{id:c.id});const d=t.w.SC.B2._drawer;assert.equal(d.body.querySelector('[data-tab=contacts]'),null);assert.equal(d.body.querySelector('[data-action=edit]'),null);
  const other=s.combos.find(c=>c.sales!=="U-1004");assert.equal(t.w.SC.B3.sales.open("combo",{id:other.id}),null);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("owned local customer archive keeps editing and saves through the original business logic",()=>{
 const t=load("my-customers");try{
  const s=t.state(),c=s.customers.find(c=>c.source==="本地新建"&&!c.merged&&s.opps.some(o=>o.customer===c.id&&o.sales==="U-1004"));assert.ok(c);
  t.w.SC.B3.sales.open("customer",{id:c.id});const d=t.w.SC.B2._drawer;d.body.querySelector('[data-action=edit]').click();assert.ok(d.root.querySelector('.b2-drawer__foot [data-action=save]'));fill(t,d.body,"note","抽屉内维护的备注");d.root.querySelector('[data-action=save]').click();assert.equal(t.state().customers.find(x=>x.id===c.id).note,"抽屉内维护的备注");assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("role revocation closes the entire drawer stack and shows no editable private detail",()=>{
 const t=load("my-customers");try{
  t.doc.querySelector("#portfolio-table a.btn").click();t.w.SC.B2._drawer.body.querySelector('a[href*="customer-detail"]').click();
  const s=t.state();s.people.find(p=>p.id==="U-1004").status="off";t.w.SC.B2.save(s);t.w.SC.B3.render();assert.equal(t.doc.querySelector(".b2-drawer-mask"),null);assert.match(t.doc.querySelector("#sc-page-body").textContent,/无权访问/);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("legacy SLS child URLs preserve context and point to the matching parent list",()=>{
 for(const [page,query,host,key,value]of [["my-request","id=REQ-3901","my-requests","request","REQ-3901"],["request-form","type=release&customer=C-1001&opps=O-3001","my-customers","panel","form"],["customer-search","name=测试","market","panel","search"],["sea-customer","id=C-1007","market","detail","C-1007"]]){
  let target;vm.runInNewContext(fs.readFileSync(path.join(root,"js/pages",page+".js"),"utf8"),{URLSearchParams,location:{search:"?role=SLS&as=U-1008&"+query,replace:url=>target=url}});
  const u=new URL(target,"http://test/pages/");assert.equal(u.pathname,"/pages/"+host+".html");assert.equal(u.searchParams.get(key),value);assert.equal(u.searchParams.get("as"),"U-1008");
 }
});
test("Escape closes only the child and restores focus to its trigger",async()=>{
 const t=load("my-customers");try{
  t.doc.querySelector("#portfolio-table a.btn").click();const parent=t.w.SC.B2._drawer,link=parent.body.querySelector('a[href*="customer-detail"]');link.focus();link.click();
  t.doc.dispatchEvent(new t.w.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));await wait(360);assert.equal(t.w.SC.B2._drawer,parent);assert.equal(t.doc.activeElement,link);assert.equal(t.doc.querySelectorAll(".b2-drawer-mask").length,1);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});

test("returning from fuzzy dedup then submitting clears all keys for that draft",async()=>{
 const t=load("market","&panel=form&type=first_new");try{
  const d=completeNew(t,"星辰科技");d.root.querySelector('[data-action=submit]').click();const search=t.w.SC.B2._drawer;
  fill(t,search.body,"distinct",true);fill(t,search.body,"reason","已核对为不同主体");search.body.querySelector('[data-action=new]').click();
  d.root.querySelector('[data-action=submit]').click();t.doc.querySelector(".mask .modal__foot .btn:last-child").click();await wait(40);
  assert.ok(t.state().b3.requests.some(r=>r.name==="星辰科技"&&r.distinct));assert.equal(Object.keys(t.w.sessionStorage).filter(k=>k.startsWith("sls-draft-")).length,0);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("first-order reapplication pre-fills its previous customer fields",()=>{
 const t=load("my-requests");try{
  const s=t.state(),r=s.b3.requests.find(r=>r.id==="REQ-3901");r.status="rejected";t.w.SC.B2.save(s);
  t.w.SC.B3.sales.open("form",{type:"first_new",previous:r.id});
  const body=t.w.SC.B2._drawer.body;assert.equal(body.querySelector('[name=channel]').value,r.fields.channel);assert.equal(body.querySelector('[name=acquired]').value,r.fields.acquired);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
test("all-busy sea rows disable select-all and pressing Enter on dedup stays in the drawer",()=>{
 const t=load("market");try{
  t.w.SC.B3.sales.open("sea",{id:"C-1007"});assert.ok(t.w.SC.B2._drawer.body.querySelector('[data-action=select-matches]').disabled);t.w.SC.B2._drawer.close(true);
  t.w.SC.B3.sales.open("search",{name:"星辰科技有限公司"});const d=t.w.SC.B2._drawer;
  fill(t,d.body,"name","完全未命中的测试客户");d.body.querySelector("#dedup-form").dispatchEvent(new t.w.Event("submit",{bubbles:true,cancelable:true}));
  assert.equal(t.w.SC.B2._drawer,d);assert.match(d.body.textContent,/未命中已有客户/);assert.deepEqual(t.errors,[]);
 }finally{t.close();}
});
