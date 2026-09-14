/* Manager pages share the admin shell and detail renderers. Only MGR uses this layer. */
(function (SC, B, T) {
  "use strict";
  const E = B.e, M = T.manager = {}, stack = [];
  const titles = { request: "客保审批详情", admission: "准入终审详情", assign: "分配空余商机", combo: "经营组合", opportunity: "商机详情", workspace: "客户工作空间", history: "空间历史", customer: "客户档案", sales: "销售客户" };
  const primaryKeys = ["request", "admission", "assign", "combo"];
  const activeManager = () => T.role === "MGR";
  const teamSales = (s, me) => s.people.filter(p => p.role === "SLS" && T.isTeam(s, p.id, me));
  const salesFilter = (s, me) => ({key: "sales", label: "销售", options: teamSales(s, me).map(p => [p.id, p.name])});
  const poolFilter = s => ({key: "pool", label: "客户池", value: o => o.pool || "unset", options: [["unset", "待指定"], ...s.pools.map(p => [p.id, p.name])]});
  M.metrics = items => '<dl class="mgr-metrics">' + items.map(([label, value, tone = "", href = ""]) =>
    '<div class="mgr-metric ' + E(tone) + '"><dt>' + E(label) + '</dt><dd>' + (href ? '<a href="' + E(href) + '" aria-label="' + E(label + ' ' + value) + '">' : '') + E(value) + (href ? '</a>' : '') + '</dd></div>').join('') + '</dl>';
  function queryFor(type, id) {
    const q = { request: "", admission: "", assign: "", combo: "", panel: "", detail: "" };
    if (type) primaryKeys.includes(type) ? q[type] = id || "1" : Object.assign(q, {panel: type, detail: id});
    return q;
  }
  function fromQuery() {
    for (const type of primaryKeys) if (SC.param(type)) return {type, id: SC.param(type)};
    return SC.param("panel") ? {type: SC.param("panel"), id: SC.param("detail")} : null;
  }
  function fromLink(link) {
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return null;
    const u = new URL(link.href, location.href);
    if (u.origin !== location.origin || (u.searchParams.get("role") && u.searchParams.get("role") !== "MGR") ||
      (u.searchParams.get("as") && u.searchParams.get("as") !== T.actorId)) return null;
    const page = u.pathname.split('/').pop().replace('.html', ''), id = u.searchParams.get("id");
    const pages = { "manager-approval": "request", "manager-admission": "admission", "manager-assign": "assign", "combo-detail": "combo", opportunity: "opportunity", workspace: "workspace", "space-history": "history", "customer-detail": "customer" };
    if (pages[page]) return {type: pages[page], id: id || "1"};
    if (page === "manager-customers" && u.searchParams.has("sales")) return {type: "sales", id: u.searchParams.get("sales")};
    if (["manager-approvals", "manager-admissions"].includes(page)) {
      for (const type of ["request", "admission", "assign"]) if (u.searchParams.has(type)) return {type, id: u.searchParams.get(type)};
    }
    return null;
  }
  function allowed(type, id, s, me) {
    if (!me || me.role !== "MGR" || me.status !== "on") return false;
    if (type === "request") return T.canRequestView(s, s.b3.requests.find(r => r.id === id), me);
    if (type === "admission") return T.canAdmission(s, s.b3.admissions.find(a => a.id === id), me);
    if (type === "combo") return T.canCombo(s, s.combos.find(c => c.id === id), me);
    if (["workspace", "history"].includes(type)) return !!T.spaceAccess(s, B.find("spaces", id, s), me);
    if (type === "opportunity") {
      const o = B.find("opps", id, s);
      return !!o && (T.isTeam(s, o.sales, me) || (!o.sales && !o.sourceSales));
    }
    if (type === "customer") return s.opps.some(o => o.customer === id && T.isTeam(s, o.sales, me));
    if (type === "sales") return teamSales(s, me).some(p => p.id === id);
    return type === "assign";
  }
  function wire(root) {
    root.querySelectorAll('a[href]').forEach(a => { if (fromLink(a)) a.setAttribute("aria-haspopup", "dialog"); });
  }
  function renderPanel(entry, s, me) {
    const { type, id, drawer } = entry;
    // Render into fresh nodes: shared views delegate actions on their root.
    // Reusing a root across refreshes would keep handlers with stale record versions.
    const foot = document.createElement('div'), content = document.createElement('div');
    foot.className='mgr-drawer-actions b2-actions';content.className='mgr-drawer-content';
    drawer.root.querySelector('.mgr-drawer-actions').replaceWith(foot);
    drawer.body.replaceChildren(content);foot.parentElement.hidden = true;
    const drop = document.createElement("div");
    if (type === "request") T.views.approvalDetail(content, drop, s, me, {view: "approvalDetail", requestId: id, footer: foot});
    else if (type === "admission") T.views.admissionDetail(content, drop, s, me, {admissionId: id, footer: foot});
    else if (type === "assign") T.views.direct(content, drop, s, me);
    else if (type === "combo") { T.views.combo(content, foot, s, me, {comboId: id, compact: true}); foot.parentElement.hidden = !foot.children.length; }
    else if (type === "opportunity") T.views.opportunity(content, drop, s, me, {opportunityId: id});
    else if (type === "workspace" || type === "history") T.views.workspace(content, drop, s, me, {view: type === "history" ? "history" : "workspace", spaceId: id});
    else if (type === "sales") renderSales(content, s, me, id);
    else if (type === "customer") renderCustomer(content, s, me, id);
    if (type === "request") {
      const form=drawer.body.querySelector('#approval-form');
      form?.querySelectorAll('select[name$="-decision"]').forEach(decision=>{
        const key=decision.name.replace(/-decision$/, ''),pool=form.elements.namedItem(key+'-pool'),reason=form.elements.namedItem(key+'-reason');
        const update=()=>{if(pool){pool.disabled=decision.value!=="approve";pool.required=decision.value==="approve";}if(reason){reason.disabled=decision.value!=="reject";reason.required=decision.value==="reject";}};
        decision.addEventListener('change',update);update();
      });
    }
    if (type === "admission") {
      const a=s.b3.admissions.find(a=>a.id===id),c=s.combos.find(c=>c.id===a?.combo),error=T.admitError(s,c),approve=foot.querySelector('[data-action=approve]');
      if(approve&&error){approve.disabled=true;approve.title=error;}
    }
    wire(drawer.body);
  }
  M.open = function (type, id, parent = null) {
    const s = B.load(), me = T.me(s);
    if (!allowed(type, id, s, me)) { SC.toast("该记录不存在或已不在本组可查看范围", "bad"); return null; }
    // A circular detail link returns to the existing level instead of stacking duplicates.
    const existing = stack.find(e => e.type === type && e.id === id && !e.drawer.closed);
    if (existing) { existing.drawer.child?.close(true); return existing.drawer; }
    const entry = {type, id};
    entry.drawer = B.drawer({title: titles[type], sub: id && id !== "1" ? '<span class="mono">' + E(id) + '</span>' : '',
      width: "min(880px, 100vw)", parent, backLabel: "返回上一级",
      footer: '<div class="mgr-drawer-actions b2-actions"></div>',
      onClose: () => {
        const index = stack.indexOf(entry); if (index >= 0) stack.splice(index, 1);
        const current=fromQuery();
        if (!parent && !stack.some(e=>!e.drawer.parent&&!e.drawer.closed) && current?.type===type && current.id===id) T.setQuery(queryFor());
      },
    });
    entry.drawer.root.classList.add("mgr-drawer", "mgr-" + type + "-drawer");
    entry.drawer.root.addEventListener('click',event=>{
      const action=event.target.closest('[data-action]')?.dataset.action,form=entry.drawer.body.querySelector('#approval-form, #admit-form');
      if(!form||!['process','approve','reject','first-approve','first-reject'].includes(action))return;
      const reason=form.elements.namedItem(type==='admission'?'reason':'rejectReason'),pool=form.elements.namedItem('pool');
      if(reason)reason.required=['reject','first-reject'].includes(action);
      if(pool)pool.required=action==='first-approve';
      if(!form.reportValidity()){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    stack.push(entry);
    if (!parent) T.setQuery(queryFor(type, id));
    renderPanel(entry, s, me);
    return entry.drawer;
  };
  document.addEventListener("click", event => {
    if (!activeManager() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.closest('.sc-nav,.sc-crumb')) return;
    const target = fromLink(link); if (!target) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const parent = B._drawer?.root.contains(link) ? B._drawer : null;
    M.open(target.type, target.id, parent);
  }, true);

  function renderSales(body, s, me, id) {
    const p = B.find("people", id, s), combos = T.visibleCombos(s, me).filter(c => c.sales === id), ops = s.opps.filter(o => o.sales === id);
    body.innerHTML = '<div class="b3-scope">' + B.entity(p.name, p.group, "users") + SC.state(p.status === "on") + '</div>' + M.metrics([
      ["客户", new Set(combos.map(c => c.customer)).size], ["经营组合", combos.length], ["归属商机", ops.length], ["待指定客户池", ops.filter(o => !o.pool).length, "is-attention"]
    ]) + '<div id="sales-customers"></div>';
    B.table(body.querySelector('#sales-customers'), combos, [
      ["客户", c => B.entity(B.name("customers", c.customer, s), c.customer, "building", T.href("combo-detail", {id:c.id}))],
      ["准入状态", c => T.admitBadge(c)], ["归属商机", c => T.owned(s,c.customer,c.sales).length],
      ["操作", c => T.link("combo-detail", "查看组合", {id:c.id}, "btn btn--sm")]
    ], {key: "sales-customers-" + id, searchText:c => T.scopeTitle(s,c), emptyTitle: "暂无该销售的经营组合"});
  }
  function renderCustomer(body, s, me, id) {
    const c = B.find("customers", id, s), ops = s.opps.filter(o => o.customer === id && T.isTeam(s,o.sales,me));
    body.innerHTML = '<div class="b3-scope">' + B.entity(c.name, c.id, "building") + B.badge(c.source) + '</div><div id="mgr-customer-tabs"></div><div id="mgr-customer-content"></div>';
    const root = body.querySelector('#mgr-customer-content');
    const draw = tab => {
      B.tabs(body.querySelector('#mgr-customer-tabs'), [["profile","基础信息"],["contacts","联系人",c.contacts.length],["opps","本组商机",ops.length],["source","来源信息"],["history","变更历史"]], tab, draw);
      if (tab === "profile") root.innerHTML = B.section("基础信息", '<div class="b2-section__body">' + B.kv([
        ["客户归属人",c.owner],["客户行业",c.industry],["客户阶段",c.stage],["客户等级",c.grade],["获客来源",c.channel],["获客时间",c.acquired],["法人代表",c.legal],["注册资金",c.capital],["创建人",c.creator],["是否线索转换",c.lead],["意向产品",(c.intents||[]).map(p=>B.name("products",p,s)).join("、")],["客户地址",c.address],["备注",c.note]
      ]) + '</div>');
      else if (tab === "contacts") B.table(root,c.contacts.map((p,i)=>({...p,id:String(i)})),[["姓名",p=>E(p.name)],["职位",p=>E(p.job)],["电话",p=>E(p.phone)],["邮箱",p=>E(p.email)],["主要联系人",p=>p.main?"是":"否"]],{search:false,emptyTitle:"暂无联系人"});
      else if (tab === "opps") B.table(root, ops, T.oppColumns(s), {key:"mgr-customer-opps-"+id,search:false});
      else if (tab === "source") root.innerHTML = B.kv(Object.entries(c.extras || {})) || B.empty("暂无来源信息");
      else root.innerHTML = B.history(id);
      wire(root);
    }; draw("profile");
  }

  // Scope table state to the manager identity; retain filters and pagination on drawer close.
  const baseTable = B.table;
  B.table = function(root, rows, cols, opts = {}) {
    if (!activeManager()) return baseTable(root, rows, cols, opts);
    const s = B.load(), me = T.me(s), draw = opts.onDraw, select = opts.onSelect;
    opts = {...opts, key: "mgr-" + me.id + "-" + (opts.key || root.id || "table")};
    if (root.id === "portfolio-table") {
      opts.filters = [salesFilter(s,me), ...(opts.filters || []), {...poolFilter(s), value:c=>T.owned(s,c.customer,c.sales).map(o=>o.pool||"unset")}];
      opts.placeholder = "客户名称、编号或销售";
      opts.searchText = c=>T.scopeTitle(s,c)+c.customer;
    }
    if (root.id === "team-sales") {
      opts.filters = [{key:"status",label:"账号状态",options:[["on","正常"],["off","已停用"]]}];
      opts.placeholder = "销售姓名或编号";
      cols = cols.map(([label, render])=>[label === "归属商机（含已结束、未激活）" ? "归属商机" : label,render]);
    }
    if (root.id === "managed-opps") {
      cols = T.oppColumns(s, {action:false}).concat([["操作",o=>T.link("opportunity","查看",{id:o.id},"btn btn--sm")+' '+B.btn("调整客户池","pool",o.id,"layers","btn--sm")]]);
      opts.filters = [salesFilter(s,me), poolFilter(s), {key:"result",label:"经营结果",options:Object.entries(SC.OPP_RESULT)}];
      opts.placeholder = "商机名称、编号或销售";
      opts.searchText=o=>o.name+o.id+B.name("people",o.sales,s);
    }
    if (root.id === "exception-table" && cols.some(c=>c[0] === "处理方向")) {
      const direction=cols.at(-1)[1];
      cols = cols.filter(c=>!["操作","处理方向"].includes(c[0])).concat([["操作",o=>T.link("opportunity","查看",{id:o.id},"btn btn--sm")+' '+direction(o)]]);
    }
    opts.onSelect = ids => {
      const bar=root.querySelector('.b2-batchbar'),toolbar=root.querySelector('.b2-toolbar'),all=root.querySelector('[data-action=select-matches]');
      bar?.classList.toggle('has-selection',ids.length>0);
      if(toolbar&&all){(ids.length?bar.querySelector('.b2-actions'):toolbar).append(all);bar.hidden=!ids.length;}
      select?.(ids);
    };
    opts.onDraw = (node, slice) => {
      draw?.(node,slice); wire(node);
      node.querySelectorAll('thead th').forEach((th,i)=>{
        const label=th.textContent;
        if (/^(客户 \/ 组合|归属 \/ 可见商机|已建空间|归档历史|归属商机|当前空间|待指定|已激活 \/ 待指定)$/.test(label)) {
          th.classList.add('mgr-number');node.querySelectorAll('tbody tr').forEach(tr=>tr.children[i]?.classList.add('mgr-number'));
        }
        if (label === "操作") {
          th.classList.add('mgr-operation');node.querySelectorAll('tbody tr').forEach(tr=>tr.children[i]?.classList.add('mgr-operation'));
        }
      });
    };
    return baseTable(root,rows,cols,opts);
  };

  T.views.managerSupervision=function(body){
    body.innerHTML='<div class="mgr-supervision-empty">'+SC.empty({icon:'eye',title:'暂无审批进展',reason:'公出与合同审批尚未接入。审批操作在钉钉完成。'})+'</div>';
  };
  M.supervision=()=>T.start({pid:'P-MGR-12',title:'审批监督',role:'MGR',menu:'supervise',view:'managerSupervision'});
  const baseHome = T.views.home;
  T.views.home = function(body,actions,s,me) {
    baseHome(body,actions,s,me); if(me.role !== "MGR") return;
    actions.replaceChildren();
    const combos=T.visibleCombos(s,me),ops=s.opps.filter(o=>T.isTeam(s,o.sales,me));
    body.querySelector('.b2-strip')?.replaceWith(SC.el(M.metrics([
      ["本组客户",new Set(combos.map(c=>c.customer)).size,"",T.href("manager-customers")],
      ["本组销售",teamSales(s,me).length,"",T.href("manager-sales")],
      ["已激活商机",ops.filter(o=>T.active(s,o)).length,"",T.href("manager-opportunities")],
      ["待指定客户池",ops.filter(o=>!o.pool).length,"is-attention",T.href("manager-exceptions")]
    ])));
    const failures=[s.agents.filter(a=>a.current&&a.state==='bindfail'&&T.manages(s,B.find('spaces',a.space,s)?.sales)).length,
      s.agents.filter(a=>a.current&&a.state==='readfail'&&T.manages(s,B.find('spaces',a.space,s)?.sales)).length,
      s.spaces.filter(w=>w.status==='failed'&&T.isTeam(s,w.sales,me)).length];
    body.querySelectorAll('#manager-failure-tabs [role=tab]').forEach((tab,i)=>tab.insertAdjacentHTML('beforeend','<span class="mgr-tab-count">'+failures[i]+'</span>'));
    body.querySelectorAll('.b3-nav-item').forEach(a=>a.insertAdjacentHTML('beforeend',SC.icon('arrow',16)));
  };
  const baseSales=T.views.sales;
  T.views.sales=function(body,actions,s,me){
    baseSales(body,actions,s,me);if(me.role!=="MGR")return;actions.replaceChildren();
    const people=teamSales(s,me);
    body.insertAdjacentHTML('afterbegin',M.metrics([["本组销售",people.length],["正常账号",people.filter(p=>p.status==="on").length],["已停用",people.filter(p=>p.status!=="on").length,"is-attention"]]));
  };
  const baseCustomers=T.views.customers;
  T.views.customers=function(body,actions,s,me,meta={}){
    baseCustomers(body,actions,s,me,meta);if(me.role!=="MGR")return;actions.replaceChildren();
    const scope=meta.salesId||SC.param("sales"),combos=T.visibleCombos(s,me).filter(c=>!scope||c.sales===scope);
    body.querySelector('.b2-strip')?.replaceWith(SC.el(M.metrics([["本组客户",new Set(combos.map(c=>c.customer)).size],["经营组合",combos.length],["待终审",combos.filter(c=>T.pendingAdmission(s,c)).length,"is-attention"],["待指定客户池",combos.reduce((n,c)=>n+T.owned(s,c.customer,c.sales).filter(o=>!o.pool).length,0),"is-attention"]])));
    const table=body.querySelector('#portfolio-table'), history=body.querySelector('#portfolio-history').closest('.b2-section');
    const tabs=document.createElement('div');table.before(tabs);
    const tab=SC.param("portfolioView")==="history"?"history":"current";
    B.tabs(tabs,[["current","经营组合",combos.length],["history","历史空间",s.spaces.filter(w=>["archived","frozen"].includes(w.status)&&T.spaceAccess(s,w)&&(!scope||w.sales===scope)).length]],tab,v=>{T.setQuery({portfolioView:v});T.render();});
    table.hidden=tab!=="current";history.hidden=tab!=="history";history.querySelector('.b2-section__head').hidden=true;
    if(scope){
      const notice=SC.el('<div class="mgr-filter-scope">销售：'+E(B.name("people",scope,s))+' '+B.btn("查看全组","clear-sales","","close","btn--link")+'</div>');tabs.before(notice);
      B.actions(notice,{"clear-sales":()=>{T.setQuery({sales:""});T.render();}});
    }
  };
  const baseOpps=T.views.opps;
  T.views.opps=function(body,actions,s,me){
    baseOpps(body,actions,s,me);if(me.role!=="MGR")return;
    const ops=s.opps.filter(o=>T.isTeam(s,o.sales,me));
    body.insertAdjacentHTML('afterbegin',M.metrics([["归属商机",ops.length],["进行中",ops.filter(o=>o.result==="active").length],["已结束",ops.filter(o=>o.result!=="active").length],["待指定客户池",ops.filter(o=>!o.pool).length,"is-attention"]]));
  };
  const baseApprovalList=T.views.approvalList;
  T.views.approvalList=function(body,actions,s,me){
    if(me.role!=="MGR")return baseApprovalList(body,actions,s,me);
    const all=s.b3.requests.filter(r=>T.canRequestView(s,r,me)),pending=all.filter(r=>["pending","partial"].includes(T.requestState(r))),done=all.filter(r=>!["pending","partial"].includes(T.requestState(r)));
    const tab=SC.param("view")==="records"?"records":"pending",rows=tab==="pending"?pending:done;
    actions.innerHTML=T.link("manager-assign","分配空余商机",{},"btn btn--primary");
    body.innerHTML='<div class="mgr-tabs-row"><div id="manager-approval-tabs"></div><div class="mgr-list-actions b2-actions"></div></div><div id="approval-list"></div>';
    body.querySelector('.mgr-list-actions').append(...actions.childNodes);
    B.tabs(body.querySelector('#manager-approval-tabs'),[["pending","待审批",pending.length],["records","已处理",done.length]],tab,v=>{T.setQuery({view:v});T.render();});
    B.table(body.querySelector('#approval-list'),rows,[
      ["客户 / 申请",r=>B.entity(r.customer?B.name("customers",r.customer,s):r.name,r.id,"file",T.href("manager-approval",{id:r.id}))],
      ["申请类型",r=>E(T.types[r.type])],["申请销售",r=>E(B.name("people",r.actor,s))],
      ["处理范围",r=>r.first?r.products.length+' 个产品 · 整单':r.items.length+' 条商机'],["进度",r=>T.requestBadge(r)],
      ["提交时间",r=>E(r.submitted)],["操作",r=>T.link("manager-approval",tab==="pending"?"查看审批":"查看记录",{id:r.id},"btn btn--sm")]
    ],{key:"manager-approvals-"+tab,searchText:r=>r.id+(r.customer?B.name("customers",r.customer,s):r.name)+B.name("people",r.actor,s),placeholder:"客户、申请编号或销售",filters:[{key:"type",label:"申请类型",options:["new","claim","join","restore"].map(t=>[t,T.types[t]])}],emptyTitle:tab==="pending"?"暂无待审批申请":"暂无已处理申请"});
  };
  const baseAdmissions=T.views.admissions;
  T.views.admissions=function(body,actions,s,me,meta){
    if(me.role!=="MGR")return baseAdmissions(body,actions,s,me,meta);
    const records=SC.param("view")==="records", all=s.b3.admissions.filter(a=>T.canAdmission(s,a,me));
    baseAdmissions(body,actions,s,me,{...meta,view:records?"admissionRecords":"admissions",pid:meta.pid+(records?"-records":"-pending")});actions.replaceChildren();
    const tabs=document.createElement('div');body.prepend(tabs);
    B.tabs(tabs,[["pending","待终审",all.filter(a=>a.status==="pending").length],["records","本人已处理",all.filter(a=>a.status!=="pending"&&a.by===me.id).length]],records?"records":"pending",v=>{T.setQuery({view:v});T.render();});
  };
  T.views.admissionRecords=function(...args){return activeManager()?T.views.admissions(...args):baseAdmissions(...args);};
  const baseExceptions=T.views.exceptions;
  T.views.exceptions=function(body,actions,s,me){
    baseExceptions(body,actions,s,me);if(me.role!=="MGR")return;
    const ops=s.opps.filter(o=>T.isTeam(s,o.sales,me));
    const counts=[ops.filter(o=>!o.pool).length,ops.filter(o=>B.find("people",o.sales,s)?.status!=="on").length,s.spaces.filter(w=>w.status==="failed"&&T.isTeam(s,w.sales,me)).length];
    body.querySelectorAll('#exception-tabs [role=tab]').forEach((tab,i)=>tab.insertAdjacentHTML('beforeend','<span class="mgr-tab-count">'+counts[i]+'</span>'));
    const tabs=body.querySelector('#exception-tabs'),row=document.createElement('div');row.className='mgr-tabs-row';tabs.before(row);row.append(tabs);
    row.insertAdjacentHTML('beforeend',T.link("manager-home","Agent 恢复",{},"btn"));actions.replaceChildren();
  };

  function afterManagerRender(meta,context) {
    document.body.classList.add('mgr-ui');
    wire(document.getElementById('sc-page-body')||document.body);
    wire(document.querySelector('.sc-page-head')||document.body);
    const root=stack.find(e=>!e.drawer.closed),s=B.load(),me=T.me(s),requested=fromQuery();
    if(context.valid&&!document.querySelector('.b3-persona')) {
      const select=document.createElement('select');select.className='select select--sm b3-persona';select.setAttribute('aria-label','原型人员');
      s.people.filter(p=>p.role==='MGR'&&p.status==='on').forEach(p=>select.add(new Option(p.name,p.id,false,p.id===me.id)));
      select.onchange=()=>{const u=new URL(location.href);u.searchParams.set('as',select.value);location.href=u.href;};
      document.querySelector('.sc-roleswitch')?.after(select);
    }
    if(!context.valid||meta.role&&meta.role!=="MGR") {root?.drawer.close(true);return;}
    if(root){
      root.drawer.child?.close(true);
      if(!allowed(root.type,root.id,s,me)){root.drawer.close(true);SC.toast("该记录已不在本组可查看范围","bad");return;}
      document.body.classList.add('b2-drawer-lock');renderPanel(root,s,me);
    } else if(requested){
      if(!M.open(requested.type,requested.id))T.setQuery(queryFor());
    }
  }
  const baseStart=T.start;
  T.start=function(meta){
    if(B.identity(meta.role||"SLS").role!=="MGR")return baseStart(meta);
    T._comboOpened=true; // This router owns deep links and nested combo drawers for MGR.
    const after=meta.afterRender;
    return baseStart({...meta,afterRender:context=>{after?.(context);afterManagerRender(meta,context);}});
  };
  // Shared customer archives use the older mount function; keep their links in the same drawer system.
  const baseMount=B.mount;
  B.mount=function(meta,render){
    const identity=B.identity(B.role);
    if(identity.role!=="MGR"||!meta.shared)return baseMount(meta,render);
    T.role=identity.role;T.actorId=identity.id;T.ensure();
    const after=meta.afterRender;
    return baseMount({...meta,afterRender:context=>{T.render=B.render;after?.(context);afterManagerRender(meta,context);}},render);
  };
  const baseFuture=B.future;
  B.future=function(label,id){
    if(activeManager()&&label==="商机详情")return M.open('opportunity',id,B._drawer||null);
    return baseFuture(label,id);
  };
})(window.SC,window.SC.B2,window.SC.B3);
