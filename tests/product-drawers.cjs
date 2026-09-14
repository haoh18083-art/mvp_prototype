const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
function load(query = '', setup = () => {}, role = 'ADM', as = 'U-1001') {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'pages/products.html'), 'utf8'), {
    url: 'http://prototype.test/pages/products.html?role=' + role + '&as=' + as + query,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {};
  w.Date.now = () => 1788854400000;
  setup(w);
  for (const script of doc.querySelectorAll('script[src]'))
    w.eval(fs.readFileSync(path.resolve(root, 'pages', script.getAttribute('src').split('?')[0]), 'utf8'));
  return { dom, w, doc, errors, state: () => w.SC.B2.load() };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
const act = (doc, action) => { const b = doc.querySelector('.products-drawer [data-action="' + action + '"]'); assert.ok(b, action); b.click(); };
const confirm = async doc => { doc.querySelector('.mask .modal__foot .btn:last-child').click(); await settle(); };
const set = (doc, name, value) => { doc.querySelector('[name="'+name+'"]').value = value; };

test('product opens in place, tabs preserve identity, close retains filters and restores focus', () => {
  const {dom,w,doc,errors}=load();
  try {
    const search=doc.querySelector('#products-table [data-search]');search.value='P-101';search.dispatchEvent(new w.Event('input',{bubbles:true}));
    const bg=doc.querySelector('#sc-page-body'),link=bg.querySelector('tbody a.btn');link.focus();link.click();
    assert.equal(doc.querySelector('#sc-page-body'),bg);assert.equal(w.location.pathname,'/pages/products.html');
    assert.equal(doc.querySelectorAll('.products-drawer').length,1);assert.match(doc.querySelector('.products-drawer').textContent,/智能短信/);
    doc.querySelector('#product-detail-tabs [data-tab="opps"]').click();
    assert.equal(w.SC.param('productTab'),'opps');assert.equal(w.SC.param('as'),'U-1001');
    assert.equal(doc.querySelector('#product-tabs [aria-selected=true]').dataset.tab,'products');
    assert.ok(doc.querySelector('#product-detail-body tbody tr'));assert.equal(search.value,'P-101');
    doc.querySelector('#product-detail-tabs [data-tab="history"]').click();assert.match(doc.querySelector('#product-detail-body').textContent,/产品变更记录/);
    w.SC.B2._drawer.close(true);assert.equal(w.SC.param('product'),'');assert.equal(w.SC.param('productTab'),'');assert.equal(doc.activeElement,link);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('save, activate, cancel deactivation and confirm deactivation refresh the same drawer', async () => {
  const {dom,w,doc,state,errors}=load('&product=P-103');
  try{
    const drawer=doc.querySelector('.b2-drawer');set(doc,'billing','定费');set(doc,'desc','产品说明更新');act(doc,'save');
    assert.equal(state().products.find(p=>p.id==='P-103').active,false);assert.equal(state().products.find(p=>p.id==='P-103').desc,'产品说明更新');
    act(doc,'activate');await confirm(doc);assert.equal(state().products.find(p=>p.id==='P-103').active,true);assert.equal(doc.querySelector('.b2-drawer'),drawer);
    act(doc,'deactivate');doc.querySelector('.mask .modal__x').click();await settle();assert.equal(state().products.find(p=>p.id==='P-103').active,true);
    const relations=state().opps;act(doc,'deactivate');await confirm(doc);
    assert.equal(state().products.find(p=>p.id==='P-103').active,false);assert.deepEqual(state().opps,relations);assert.equal(doc.querySelector('[name=billing]').disabled,true);
    assert.match(doc.querySelector('#products-table tr[data-id="P-103"]').textContent,/未激活/);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('activation validation, version conflicts and duplicate click binding remain enforced', async () => {
  const {dom,w,doc,state,errors}=load('&product=P-103');
  try{
    act(doc,'activate');await confirm(doc);assert.match(doc.querySelector('.mask .b2-error').textContent,/齐全/);assert.equal(state().products.find(p=>p.id==='P-103').active,false);
    doc.querySelector('.mask .modal__x').click();await settle();
    const current=state();current.products.find(p=>p.id==='P-103').version++;w.SC.B2.save(current);act(doc,'save');assert.match(doc.querySelector('#product-form .b2-error').textContent,/变化/);
    w.SC.B2.render();w.SC.B2.render();const version=state().products.find(p=>p.id==='P-103').version;act(doc,'save');assert.equal(state().products.find(p=>p.id==='P-103').version,version+1);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('identity confirmation updates both list and result; business product opens in the same page', () => {
  const {dom,w,doc,state,errors}=load('&view=checks&check=PC-01');
  try{
    assert.equal(doc.querySelector('[role=dialog]').getAttribute('aria-label'),'产品身份核对');
    set(doc,'decision','same');set(doc,'reason','确认为同一业务产品');act(doc,'confirm');
    assert.equal(state().productChecks.find(c=>c.id==='PC-01').state,'已确认同一');assert.equal(state().products.find(p=>p.id==='P-104').crm,'CRM-P-NEW01');
    assert.match(doc.querySelector('.products-drawer').textContent,/核对结果/);assert.equal(doc.querySelector('.b2-drawer__foot').hidden,true);
    assert.match(doc.querySelector('#products-table tr[data-id="PC-01"]').textContent,/已确认同一/);
    doc.querySelector('.products-drawer a[href*="product=P-104"]').click();
    assert.equal(w.SC.param('product'),'P-104');assert.equal(w.SC.param('check'),'');assert.equal(w.SC.param('view'),'products');assert.equal(doc.querySelectorAll('.products-drawer').length,1);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('multiple CRM sources remain blocked, different products create an inactive master record', () => {
  const {dom,doc,state,errors}=load('&view=checks&check=PC-02');
  try{
    set(doc,'decision','same');set(doc,'reason','核对来源');act(doc,'confirm');assert.match(doc.querySelector('#identity-form .b2-error').textContent,/不支持多来源归并/);
    const count=state().products.length;set(doc,'decision','different');set(doc,'reason','两个独立产品');act(doc,'confirm');
    const check=state().productChecks.find(c=>c.id==='PC-02');assert.equal(check.state,'已确认不同');assert.equal(state().products.length,count+1);
    const product=state().products.find(p=>p.id===check.resolved);assert.equal(product.active,false);assert.equal(product.crm,'CRM-P-NEW02');assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('new-product draft matches open the existing product without creating duplicates', () => {
  const {dom,w,doc,state,errors}=load('&view=checks&check=draft&draft=1&target=P-101', w=>w.sessionStorage.setItem('b2-product-draft',JSON.stringify({name:'智能短信企业版',billing:'定费',desc:'草稿'})));
  try{
    const count=state().products.length;assert.match(doc.querySelector('.products-drawer').textContent,/本地新建草稿/);
    set(doc,'decision','same');set(doc,'reason','沿用既有产品');act(doc,'confirm');assert.equal(w.SC.param('product'),'P-101');assert.equal(w.SC.param('draft'),'');assert.equal(state().products.length,count);assert.equal(w.sessionStorage.getItem('b2-product-draft'),null);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('close methods remove panel query only; invalid targets and stale roles show no editable detail', async () => {
  const {dom,w,doc,state,errors}=load('&view=checks&check=PC-01');
  try{
    doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,380));assert.equal(w.SC.param('view'),'checks');assert.equal(w.SC.param('as'),'U-1001');assert.equal(doc.querySelector('.products-drawer'),null);
    doc.querySelector('#products-table tr[data-id="PC-01"] a').click();w.SC.B2._drawer.close();w.SC.B2.render();assert.equal(doc.querySelectorAll('.products-drawer').length,1);
    w.SC.B2.openProductPanel(w.SC.B2.href('product-detail',{id:'missing'}));assert.match(doc.querySelector('.products-drawer').textContent,/产品不存在/);
    w.SC.B2.openProductPanel(w.SC.B2.href('product-check',{draft:'1',target:'P-101'}));assert.match(doc.querySelector('.products-drawer').textContent,/核对对象不存在/);
    w.SC.B2.openProductPanel(w.SC.B2.href('product-detail',{id:'P-101'}));const current=state();current.people.find(p=>p.id==='U-1001').status='off';w.SC.B2.save(current);w.SC.B2.render();assert.equal(doc.querySelector('.products-drawer'),null);assert.deepEqual(errors,[]);
  }finally{dom.window.close();}
});

test('non-admin roles cannot open product editing drawers', () => {
  const {dom,doc,errors}=load('&product=P-101',()=>{},'SLS','U-1004');
  try{assert.equal(doc.querySelector('.products-drawer'),null);assert.match(doc.querySelector('#sc-page-body').textContent,/无权访问/);assert.deepEqual(errors,[]);}finally{dom.window.close();}
});

test('legacy routes preserve product tabs and draft identity parameters', () => {
  for(const [page,query,expected] of [
    ['product-detail','?role=ADM&as=U-1001&id=P-101&view=history',{product:'P-101',productTab:'history',view:'products',as:'U-1001'}],
    ['product-check','?role=ADM&as=U-1001&id=PC-01',{check:'PC-01',view:'checks',as:'U-1001'}],
    ['product-check','?role=ADM&as=U-1001&draft=1&target=P-101',{check:'draft',draft:'1',target:'P-101'}],
  ]){
    let target;vm.runInNewContext(fs.readFileSync(path.join(root,'js/pages/'+page+'.js'),'utf8'),{URLSearchParams,location:{search:query,replace:url=>target=url}});
    const url=new URL(target,'http://prototype.test/pages/');assert.equal(url.pathname,'/pages/products.html');for(const [key,value] of Object.entries(expected))assert.equal(url.searchParams.get(key),value);assert.equal(url.searchParams.has('id'),false);
  }
});
