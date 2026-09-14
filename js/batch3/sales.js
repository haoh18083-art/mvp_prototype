/* SLS list and drawer workflows reuse the business renderers and permission model. */
(function(SC,B,T){
  "use strict";
  const S=T.sales={},E=B.e,stack=[];
  const active=()=>T.role==="SLS";
  const titles={combo:"经营组合",opportunity:"商机详情",workspace:"客户工作空间",history:"空间历史",customer:"客户档案",request:"申请详情",form:"商机申请",search:"客户查重",sea:"公海客户"};
  const keys=["panel","detail","combo","request","type","customer","opps","products","name","distinct","reason","previous"];
  const formKeys=["type","customer","opps","products","name","distinct","reason","previous"];
  const ownOps=(s,me)=>s.opps.filter(o=>o.sales===me.id);
  S.metrics=items=>'<dl class="sls-metrics">'+items.map(([label,value,tone="",href=""])=>'<div class="sls-metric '+E(tone)+'"><dt>'+E(label)+'</dt><dd>'+(href?'<a href="'+E(href)+'" aria-label="'+E(label+" "+value)+'">':'')+E(value)+(href?'</a>':'')+'</dd></div>').join('')+'</dl>';
  const signature=(kind,p)=>kind+":"+JSON.stringify(Object.entries(p).sort(([a],[b])=>a.localeCompare(b)));
  const draftKey=p=>"sls-draft-"+T.actorId+"-"+signature("form",p);
  function readDraft(p){try{return JSON.parse(sessionStorage.getItem(draftKey(p))||"null");}catch{return null;}}
  function snapshot(form){
    const result={};if(!form)return null;
    for(const field of form.querySelectorAll('[name]')){
      if(field.type==="checkbox"){result[field.name]||=[];if(field.checked)result[field.name].push(field.value);}
      else if(field.multiple)result[field.name]=[...field.selectedOptions].map(o=>o.value);
      else result[field.name]=field.value;
    }
    return result;
  }
  function restore(form,data){
    if(!form||!data)return;
    for(const field of form.querySelectorAll('[name]')){
      if(!(field.name in data)||field.disabled)continue;
      const value=data[field.name];
      if(field.type==="checkbox")field.checked=Array.isArray(value)?value.includes(field.value):!!value;
      else if(field.multiple)[...field.options].forEach(o=>o.selected=(value||[]).includes(o.value));
      else if(field.tagName!=="SELECT"||[...field.options].some(o=>o.value===value))field.value=value;
    }
  }
  function persist(entry){
    if(entry.kind!=="form"||entry.submitted)return;
    const form=entry.drawer.body.querySelector('#request-form');
    if(form)entry.draft=snapshot(form);
    if(entry.draft)try{
      const key=draftKey(entry.params);sessionStorage.setItem(key,JSON.stringify(entry.draft));entry.draftKeys||=new Set();entry.draftKeys.add(key);
    }catch{entry.drawer.root.querySelector('.sls-draft-state')?.replaceChildren(document.createTextNode("暂存不可用，请完成后再关闭"));}
  }
  function query(entry){
    const q=Object.fromEntries(keys.map(k=>[k,""]));if(!entry)return q;
    const {kind,params:p}=entry;
    if(kind==="combo"||kind==="request")q[kind]=p.id;
    else {q.panel=kind;q.detail=p.id||"";for(const key of formKeys)if(p[key])q[key]=p[key];}
    return q;
  }
  function currentQuery(){
    if(SC.param("combo"))return{kind:"combo",params:{id:SC.param("combo")}};
    if(SC.param("request"))return{kind:"request",params:{id:SC.param("request")}};
    const kind=SC.param("panel");if(!kind)return null;
    const params={};if(SC.param("detail"))params.id=SC.param("detail");
    for(const key of formKeys)if(SC.param(key))params[key]=SC.param(key);
    return{kind,params};
  }
  function parse(url){
    const u=new URL(url,location.href),p=Object.fromEntries(u.searchParams);
    if(u.origin!==location.origin||p.role&&p.role!=="SLS"||p.as&&p.as!==T.actorId)return null;
    const page=u.pathname.split('/').pop().replace('.html','');
    const names={"combo-detail":"combo",opportunity:"opportunity",workspace:"workspace","space-history":"history","customer-detail":"customer","my-request":"request","request-form":"form","customer-search":"search","sea-customer":"sea"};
    if(names[page]){delete p.role;delete p.as;return{kind:names[page],params:p};}
    if(!["my-customers","my-requests","market","sales-home"].includes(page))return null;
    const kind=p.request?"request":p.combo?"combo":p.panel;if(!titles[kind])return null;
    const params={};if(p.request||p.combo||p.detail)params.id=p.request||p.combo||p.detail;
    for(const key of formKeys)if(p[key])params[key]=p[key];
    return{kind,params};
  }
  function allowed(kind,p,s,me){
    if(!me||me.role!=="SLS"||me.status!=="on")return false;
    if(kind==="request")return T.canRequestView(s,s.b3.requests.find(r=>r.id===p.id),me);
    if(kind==="combo")return T.canCombo(s,s.combos.find(c=>c.id===p.id),me);
    if(kind==="opportunity"){const o=B.find("opps",p.id,s);return !!o&&(o.sales===me.id||T.active(s,o));}
    if(kind==="workspace"||kind==="history")return !!T.spaceAccess(s,B.find("spaces",p.id,s),me);
    if(kind==="customer"||kind==="sea")return !!B.find("customers",p.id,s);
    if(kind==="form"){
      if(p.previous&&!s.b3.requests.some(r=>r.id===p.previous&&r.actor===me.id))return false;
      if(p.customer&&!s.customers.some(c=>c.id===p.customer&&!c.merged))return false;
      return !p.type||!!T.types[p.type];
    }
    return kind==="search";
  }
  function wire(root){
    root.querySelectorAll('a[href]').forEach(link=>{if(parse(link.href))link.setAttribute("aria-haspopup","dialog");});
  }
  function fieldIds(root,token){
    root.querySelectorAll('[id^="f-"]').forEach(field=>{
      const id=field.id;field.id=token+"-"+id;
      root.querySelectorAll('label[for]').forEach(label=>{if(label.htmlFor===id)label.htmlFor=field.id;});
    });
  }
  function enhanceForm(entry,content,footer,s){
    const form=content.querySelector('#request-form');if(!form)return;
    form.querySelectorAll('[name=create],[name=solution]').forEach(field=>field.closest('.field')?.remove());
    const optional=document.createElement('details');optional.className="sls-form-extra";optional.innerHTML='<summary>补充资料'+SC.icon("chevron",16)+'</summary><div class="b3-form-grid"></div>';
    for(const name of ["legal","capital","address"]){const field=form.querySelector('[name="'+name+'"]')?.closest('.field');if(field)optional.lastElementChild.append(field);}
    if(optional.lastElementChild.children.length)form.querySelector('[name=reason]')?.closest('.field').before(optional);
    const productSelect=form.querySelector('select[name=products]');
    if(productSelect){
      const group=document.createElement('fieldset');group.className="sls-product-choices";
      group.innerHTML='<legend>申请产品 <span class="u-danger" aria-hidden="true">*</span></legend><div class="sls-choice-grid">'+[...productSelect.options].map(o=>{
        const duplicate=entry.params.type==="new"&&T.sameProduct(s,entry.params.customer,o.value);
        return '<label class="sls-product-choice"><input type="checkbox" name="products" value="'+E(o.value)+'" '+(o.selected?'checked ':'')+(duplicate?'disabled ':'')+'><span>'+E(o.textContent)+(duplicate?'<small>已有商机</small>':'')+'</span></label>';
      }).join('')+'</div>';
      productSelect.closest('.field').replaceWith(group);
    }
    const previous=entry.params.previous&&s.b3.requests.find(r=>r.id===entry.params.previous&&r.actor===T.actorId);
    const acquired=form.querySelector('[name=acquired]');
    if(acquired&&!entry.draft&&!previous)acquired.value=B.now().slice(0,10);
    if(previous?.first&&!entry.draft)restore(form,{...previous.fields,beneficiary:previous.beneficiary,pool:previous.suggested,reason:previous.reason});
    restore(form,entry.draft);
    // The renderer owns dependent fields; drafts never override its type or customer scope.
    if(form.elements.namedItem("type"))form.elements.namedItem("type").value=entry.params.type||"first_new";
    if(form.elements.namedItem("customer"))form.elements.namedItem("customer").value=entry.params.customer||"";
    form.addEventListener("input",()=>persist(entry));
    form.addEventListener("change",()=>persist(entry));
    form.addEventListener("submit",e=>{e.preventDefault();footer.querySelector('[data-action=submit]')?.click();});
    const saveState=document.createElement('span');saveState.className="sls-draft-state";saveState.textContent="填写内容自动暂存";footer.prepend(saveState);
    footer.addEventListener('click',event=>{
      if(!event.target.closest('[data-action=submit]'))return;
      persist(entry);
      if(form.querySelector('.sls-product-choices')&&!form.querySelector('[name=products]:checked:not(:disabled)')){
        T.error(form,"请选择至少一个可申请产品");form.querySelector('[name=products]:not(:disabled)')?.focus();event.preventDefault();event.stopImmediatePropagation();
      }
    },true);
  }
  function render(entry){
    const s=B.load(),me=T.me(s),{kind,params:p,drawer}=entry;
    if(!allowed(kind,p,s,me))return;
    if(kind==="form"){if(!entry.skipCapture)persist(entry);entry.skipCapture=false;}
    const focused=drawer.root.contains(document.activeElement)?document.activeElement.getAttribute("name"):null;
    const customerDraft=kind==="customer"?snapshot(drawer.body.querySelector('form')):null;
    const content=document.createElement("div"),footer=document.createElement("div"),actions=document.createElement("div");
    content.className="sls-drawer-content";footer.className="sls-drawer-actions b2-actions";actions.className="sls-detail-actions b2-actions";
    drawer.body.replaceChildren(content);drawer.root.querySelector('.sls-drawer-actions').replaceWith(footer);footer.parentElement.hidden=true;
    drawer.root.querySelector('.b2-drawer__title').textContent=titles[kind];
    drawer.root.querySelector('.b2-drawer').setAttribute('aria-label',titles[kind]);
    drawer.root.querySelector('.b2-drawer__sub').textContent=p.id||"";
    if(kind==="combo"){T.views.combo(content,footer,s,me,{comboId:p.id,compact:true});footer.parentElement.hidden=!footer.children.length;}
    else if(kind==="opportunity")T.views.opportunity(content,actions,s,me,{opportunityId:p.id});
    else if(kind==="workspace"||kind==="history")T.views.workspace(content,actions,s,me,{spaceId:p.id,view:kind==="history"?"history":"workspace"});
    else if(kind==="request"){
      T.views.approvalDetail(content,actions,s,me,{view:"myRequest",requestId:p.id});
      const retry=content.querySelector('a[href*="previous="]');
      if(retry){const section=retry.closest('.b2-section');footer.append(retry);footer.parentElement.hidden=false;section?.remove();}
    }
    else if(kind==="sea")T.views.seaCustomer(content,actions,s,me,{customerId:p.id});
    else if(kind==="search")T.views.search(content,actions,s,me,{params:p});
    else if(kind==="form"){
      T.views.requestForm(content,actions,s,me,{params:p,footer,onChange:next=>{
        persist(entry);entry.params=next;entry.draft=readDraft(next);entry.draftKeys=new Set([draftKey(next)]);entry.skipCapture=true;
        if(!entry.drawer.parent)T.setQuery(query(entry));render(entry);
      },onSubmitted:id=>{
        entry.submitted=true;try{for(const key of entry.draftKeys||[draftKey(entry.params)])sessionStorage.removeItem(key);}catch{}
        entry.kind="request";entry.params={id};entry.draft=null;
        entry.drawer.root.classList.remove("sls-form-drawer");entry.drawer.root.classList.add("sls-request-drawer");
        if(!entry.drawer.parent)T.setQuery(query(entry));
        T.render();SC.toast("申请已提交","ok");
      }});
      enhanceForm(entry,content,footer,s);
    } else if(kind==="customer"){
      entry.customerOptions||={id:p.id,view:"profile",onTab:()=>{},refresh:()=>render(entry)};
      entry.customerOptions.footer=footer;
      entry.customerView||=B.customerView(entry.customerOptions);
      entry.customerView(content,actions);restore(content.querySelector('form'),customerDraft);
      if(actions.children.length)content.prepend(actions);
    }
    if(kind!=="customer")actions.replaceChildren();
    content.querySelectorAll('form').forEach(form=>{
      const action=kind==="search"?(form.id==="dedup-form"?"search":"new"):kind==="customer"?"save":null;
      if(action)form.onsubmit=event=>{event.preventDefault();(form.querySelector('[data-action="'+action+'"]')||footer.querySelector('[data-action="'+action+'"]'))?.click();};
    });
    fieldIds(content,entry.token);wire(drawer.root);
    if(focused&&B._drawer===drawer)content.querySelector('[name="'+focused+'"]')?.focus({preventScroll:true});
  }
  S.open=function(kind,params={},parent=null){
    params={...params};if(kind==="form"&&!params.type)params.type="first_new";
    const s=B.load(),me=T.me(s);
    if(!allowed(kind,params,s,me)){SC.toast("该记录不存在或当前无权查看","bad");return null;}
    let existing=stack.find(e=>!e.drawer.closed&&e.kind===kind&&signature(kind,e.params)===signature(kind,params));
    // A dedup check can complete the original new-customer draft without discarding entered fields.
    if(!existing&&kind==="form"&&params.distinct==="1")existing=stack.find(e=>e.kind==="form"&&e.params.type==="first_new"&&e.draft?.name===params.name);
    if(existing){
      existing.drawer.child?.close(true);
      if(params.distinct==="1"){existing.params={...existing.params,...params};existing.draft={...existing.draft,reason:params.reason,distinct:["on"]};existing.skipCapture=true;render(existing);}
      return existing.drawer;
    }
    if(kind==="search"&&parent&&stack.at(-1)?.kind==="search"){
      const entry=stack.at(-1);entry.params=params;render(entry);if(!entry.drawer.parent)T.setQuery(query(entry));return entry.drawer;
    }
    const entry={kind,params,token:"sls-"+(++S.sequence),draft:kind==="form"?readDraft(params):null};
    entry.drawer=B.drawer({parent,title:titles[kind],sub:'<span></span>',width:"min(880px, 100vw)",backLabel:"返回上一级",footer:'<div class="sls-drawer-actions"></div>',onClose:()=>{
      persist(entry);const index=stack.indexOf(entry);if(index>=0)stack.splice(index,1);
      if(!parent&&!stack.some(e=>!e.drawer.closed&&!e.drawer.parent))T.setQuery(query());
    }});
    entry.drawer.root.classList.add("sls-drawer","sls-"+kind+"-drawer");
    stack.push(entry);if(!parent)T.setQuery(query(entry));render(entry);return entry.drawer;
  };
  S.sequence=0;
  S.navigate=function(page,params={}){
    const target=parse(T.href(page,params));
    if(target)return S.open(target.kind,target.params,B._drawer||null);
    location.href=T.href(page,params);
  };
  document.addEventListener("click",event=>{
    if(!active()||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest?.('a[href]');if(!link||link.target==="_blank"||link.hasAttribute("download")||link.closest('.sc-nav,.sc-crumb'))return;
    const target=parse(link.href);if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();S.open(target.kind,target.params,B._drawer?.root.contains(link)?B._drawer:null);
  },true);
  window.addEventListener("pagehide",()=>stack.forEach(persist));
  function sync(meta,context){
    document.body.classList.add("sls-ui");
    if(!context.valid||meta.role&&meta.role!=="SLS"){stack[0]?.drawer.close(true);return;}
    const s=B.load(),me=T.me(s);
    if(!document.querySelector('.b3-persona')){
      const select=document.createElement("select");select.className="select select--sm b3-persona";select.setAttribute("aria-label","原型人员");
      s.people.filter(p=>p.role==="SLS"&&p.status==="on").forEach(p=>select.add(new Option(p.name,p.id,false,p.id===me.id)));
      select.onchange=()=>{stack.forEach(persist);const u=new URL(location.href);u.searchParams.set("as",select.value);location.href=u.href;};document.querySelector('.sc-roleswitch')?.after(select);
    }
    wire(document.getElementById("sc-page-body")||document.body);
    if(stack.length){
      for(const entry of [...stack]){
        if(entry.drawer.closed)continue;
        if(!allowed(entry.kind,entry.params,s,me)){entry.drawer.close(true);SC.toast("当前查看权限已变化","bad");break;}
        render(entry);
      }
      if(B._drawer)document.body.classList.add("b2-drawer-lock");
    }else{const requested=currentQuery();if(requested&&!S.open(requested.kind,requested.params))T.setQuery(query());}
  }
  const start=T.start;
  T.start=function(meta){
    if(B.identity(meta.role||"SLS").role!=="SLS")return start(meta);
    T._comboOpened=true;const after=meta.afterRender;
    return start({...meta,afterRender:context=>{after?.(context);sync(meta,context);}});
  };
  const mount=B.mount;
  B.mount=function(meta,view){
    const identity=B.identity(B.role);if(identity.role!=="SLS"||!meta.shared)return mount(meta,view);
    T.role="SLS";T.actorId=identity.id;T.ensure();const after=meta.afterRender;
    return mount({...meta,afterRender:context=>{T.render=B.render;after?.(context);sync(meta,context);}},view);
  };
  const future=B.future;
  B.future=function(label,id){if(active()&&label==="商机详情")return S.open("opportunity",{id},B._drawer||null);return future(label,id);};

  const table=B.table;
  B.table=function(root,rows,cols,opts={}){
    if(!active())return table(root,rows,cols,opts);
    const s=B.load(),draw=opts.onDraw,select=opts.onSelect,filter=opts.onFilter;
    opts={...opts,key:"sls-"+T.actorId+"-"+(opts.key||root.id||"table")};
    if(root.id==="portfolio-table"){
      cols=cols.map((col,index)=>index===0?["客户",c=>B.entity(B.name("customers",c.customer,s),c.customer,"building",T.href("combo-detail",{id:c.id}))]:col);
      opts.placeholder="客户名称或编号";opts.searchText=c=>B.name("customers",c.customer,s)+c.customer;
      opts.filters=[...(opts.filters||[]).map(f=>f.key==="admit"?{...f,options:[...f.options,["ready","待提报"]],value:c=>[c.admit,(!T.admitError(s,c)&&c.admit!=="已通过"&&!T.pendingAdmission(s,c))?"ready":""]}:f),{key:"pool",label:"客户池",value:c=>T.owned(s,c.customer,c.sales).map(o=>o.pool||"unset"),options:[["unset","待指定"],...s.pools.map(p=>[p.id,p.name])]}];
    }
    if(root.id==="market-table"||root.id==="sea-opps")opts.placeholder="商机、客户名称或编号";
    opts.onSelect=ids=>{
      const bar=root.querySelector('.b2-batchbar'),toolbar=root.querySelector('.b2-toolbar'),all=root.querySelector('[data-action=select-matches]');
      bar?.classList.toggle('has-selection',ids.length>0);if(toolbar&&all){(ids.length?bar.querySelector('.b2-actions'):toolbar).append(all);bar.hidden=!ids.length;}select?.(ids);
    };
    opts.onFilter=matches=>{
      const all=root.querySelector('[data-action=select-matches]');
      if(all){all.disabled=!matches.some(row=>!opts.eligible||opts.eligible(row));all.title=all.disabled?"当前没有可选项":"";}
      filter?.(matches);
    };
    opts.onDraw=(node,slice)=>{
      draw?.(node,slice);wire(node);
      node.querySelectorAll('thead th').forEach((th,i)=>{
        const label=th.textContent;if(/^(当前空间|待指定|归属 \/ 可见商机|可领取商机|已关联销售|可查询空余商机)$/.test(label)){th.classList.add("sls-number");node.querySelectorAll("tbody tr").forEach(tr=>tr.children[i]?.classList.add("sls-number"));}
        if(label==="操作"){th.classList.add("sls-operation");node.querySelectorAll("tbody tr").forEach(tr=>tr.children[i]?.classList.add("sls-operation"));}
      });
    };
    return table(root,rows,cols,opts);
  };

  const home=T.views.home;
  T.views.home=function(body,actions,s,me){
    if(me.role!=="SLS")return home(body,actions,s,me);
    actions.replaceChildren();const combos=T.visibleCombos(s,me),ops=ownOps(s,me),requests=s.b3.requests.filter(r=>r.actor===me.id),pending=requests.filter(r=>["pending","partial"].includes(T.requestState(r)));
    const ready=combos.filter(c=>!T.admitError(s,c)&&c.admit!=="已通过"&&!T.pendingAdmission(s,c));
    body.innerHTML=S.metrics([["我的客户",new Set(combos.map(c=>c.customer)).size,"",T.href("my-customers")],["已激活商机",ops.filter(o=>T.active(s,o)).length],["客户工作空间",s.spaces.filter(w=>w.sales===me.id&&w.status==="normal").length],["审批中申请",pending.length,"is-attention",T.href("my-requests",{view:"pending"})]])+
      B.section("待办",'<div class="sls-work-grid">'+[
        ["待提报准入",ready.length,T.href("my-customers",{admit:"ready"}),"check"],
        ["需重新申请",requests.filter(r=>r.items.some(i=>i.status==="rejected")||T.requestState(r)==="rejected").length,T.href("my-requests",{view:"rejected"}),"file"],
        ["商机市场",s.opps.filter(o=>!o.sales&&!o.sourceSales&&T.active(s,o)).length,T.href("market"),"search"]
      ].map(([label,n,href,icon])=>'<a href="'+E(href)+'">'+SC.icon(icon,18)+'<span>'+E(label)+'</span><b>'+n+'</b>'+SC.icon("arrow",16)+'</a>').join('')+'</div>')+
      B.section("近期申请",'<div id="sales-recent-requests"></div>',T.link("my-requests","查看全部",{},"btn--link"))+
      B.section("近 30 天跟进分布",'<div id="sls-pool-distribution" class="b2-section__body"></div>');
    renderRequests(body.querySelector("#sales-recent-requests"),[...requests].sort((a,b)=>b.submitted.localeCompare(a.submitted)).slice(0,5),s,false);
    const followed=ops.filter(o=>s.b3.records.some(r=>r.kind==="跟进记录"&&r.opps.includes(o.id)&&new Date(r.at.replace(" ","T")).getTime()>=Date.now()-30*86400000&&new Date(r.at.replace(" ","T")).getTime()<=Date.now()));
    const assigned=followed.filter(o=>o.pool),pools=[...new Set(assigned.map(o=>o.pool))],root=body.querySelector('#sls-pool-distribution');
    root.innerHTML=assigned.length?pools.map(pool=>{const count=assigned.filter(o=>o.pool===pool).length;return '<div class="sls-distribution-row"><span>'+E(B.name("pools",pool,s))+'</span><progress value="'+count+'" max="'+assigned.length+'" aria-label="'+E(B.name("pools",pool,s))+'"></progress><b>'+count+'</b><small>'+Math.round(count/assigned.length*100)+'%</small></div>';}).join(''):B.empty("暂无近 30 天跟进样本");
    if(followed.some(o=>!o.pool))root.insertAdjacentHTML("beforeend",'<p class="b2-sub">未指定客户池：'+followed.filter(o=>!o.pool).length+' 条，不计入分布。</p>');
  };
  const customers=T.views.customers;
  T.views.customers=function(body,actions,s,me,meta={}){
    if(me.role!=="SLS")return customers(body,actions,s,me,meta);
    customers(body,actions,s,me,meta);actions.replaceChildren();const combos=T.visibleCombos(s,me);
    body.querySelector('.b2-strip')?.replaceWith(SC.el(S.metrics([["我的客户",new Set(combos.map(c=>c.customer)).size],["已通过准入",combos.filter(c=>c.admit==="已通过").length],["待终审",combos.filter(c=>T.pendingAdmission(s,c)).length,"is-attention"],["待提报准入",combos.filter(c=>!T.admitError(s,c)&&c.admit!=="已通过"&&!T.pendingAdmission(s,c)).length,"is-attention"]])));
    const current=body.querySelector('#portfolio-table'),history=body.querySelector('#portfolio-history').closest('.b2-section'),tabs=document.createElement("div");
    current.before(tabs);const tab=SC.param("portfolioView")==="history"?"history":"current";
    B.tabs(tabs,[["current","经营组合",combos.length],["history","历史空间",s.spaces.filter(w=>["archived","frozen"].includes(w.status)&&T.spaceAccess(s,w)).length]],tab,v=>{T.setQuery({portfolioView:v});T.render();});
    current.hidden=tab!=="current";history.hidden=tab!=="history";history.querySelector('.b2-section__head').hidden=true;
    if(SC.param("admit")==="ready"){
      // Use the table's own filter model so pager and selection stay accurate.
      const f=current.querySelector('[data-filter=admit]');if(f){f.value="ready";f.dispatchEvent(new Event("change"));T.setQuery({admit:""});}
    }
  };
  function renderRequests(root,rows,s,search=true){
    B.table(root,rows,[
      ["客户 / 申请",r=>B.entity(r.customer?B.name("customers",r.customer,s):r.name,r.id,"file",T.href("my-request",{id:r.id}))],
      ["申请类型",r=>E(T.types[r.type])],["进度",r=>T.requestBadge(r)+(T.requestState(r)==="partial"?'<p class="b2-sub">待处理 '+r.items.filter(i=>i.status==="pending").length+' 条</p>':"")],
      ["提交时间",r=>E(r.submitted)],["操作",r=>T.link("my-request","查看详情",{id:r.id},"btn btn--sm")]
    ],{key:root.id+"-"+(SC.param("view")||"all"),search,placeholder:"客户名称或申请编号",searchText:r=>r.id+(r.customer?B.name("customers",r.customer,s):r.name),filters:search?[{key:"type",label:"申请类型",options:Object.entries(T.types)}]:[],emptyTitle:"暂无申请",emptyReason:"可从商机市场或客户组合发起申请。"});
  }
  const requestList=T.views.requestList;
  T.views.requestList=function(body,actions,s,me,meta){
    if(me.role!=="SLS")return requestList(body,actions,s,me,meta);
    actions.replaceChildren();const rows=s.b3.requests.filter(r=>r.actor===me.id);
    const groups={all:rows,pending:rows.filter(r=>["pending","partial"].includes(T.requestState(r))),rejected:rows.filter(r=>T.requestState(r)==="rejected"||r.items.some(i=>i.status==="rejected")),done:rows.filter(r=>!["pending","partial"].includes(T.requestState(r)))};
    const tab=groups[SC.param("view")]?SC.param("view"):"all";
    body.innerHTML='<div id="sls-request-tabs"></div><div id="request-list"></div>';
    B.tabs(body.querySelector('#sls-request-tabs'),[["all","全部",rows.length],["pending","审批中",groups.pending.length],["rejected","有驳回",groups.rejected.length],["done","已处理",groups.done.length]],tab,v=>{T.setQuery({view:v});T.render();});
    renderRequests(body.querySelector('#request-list'),groups[tab],s);
  };
  const market=T.views.market;
  T.views.market=function(body,actions,s,me){
    market(body,actions,s,me);if(me.role!=="SLS")return;actions.replaceChildren();
    const form=body.querySelector('#customer-search');form.classList.add("sls-customer-search");
    form.querySelector('[name=name]').addEventListener("input",event=>event.target.setCustomValidity(event.target.value.trim()?"":"请输入客户全称"));
    form.querySelector('label').textContent="客户查重";form.querySelector('[name=name]').setAttribute("aria-label","客户查重");form.querySelector('[name=name]').placeholder="输入客户全称，查重后发起申请";
    form.querySelector('[data-action=dedup]').lastChild.textContent="查重并申请";
    const counts=[s.opps.filter(o=>T.active(s,o)&&!o.sales&&!o.sourceSales).length,s.opps.filter(o=>T.active(s,o)&&o.sales).length,s.customers.filter(c=>c.sea&&!c.merged).length];
    body.querySelectorAll('#market-tabs [role=tab]').forEach((tab,i)=>tab.insertAdjacentHTML('beforeend','<span class="tab__count">'+counts[i]+'</span>'));
  };
  T.views.salesEmpty=function(body,actions,s,me,meta){
    const content={
      "sls-tasks":["check","暂无跟进任务","任务接入后可在此查看并处理。"],
      "sls-records":["mic","暂无录音","录音接入后可按客户和商机查询。"],
      "sls-flows":["eye","暂无审批进展","公出与合同审批在钉钉办理，进展尚未接入。"],
      "sls-plans":["layers","暂无方案需求","方案协同尚未接入。"],
      "sls-agent":["chat","个人 Agent 暂未接入","接入后可在此查看消息并发起对话。"]
    }[meta.placeholder];
    body.innerHTML='<div class="sls-empty-surface">'+B.empty(content[1],content[2])+'</div>';
  };
  S.placeholder=key=>{if(!SC.PLACEHOLDER[key])key="sls-tasks";const cfg=SC.PLACEHOLDER[key];T.start({pid:cfg.pid,title:cfg.title,role:"SLS",menu:cfg.menu,view:"salesEmpty",placeholder:key});};
})(window.SC,window.SC.B2,window.SC.B3);
