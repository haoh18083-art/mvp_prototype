/* M02: current organisation relations and atomic local prototype changes. */
(function (SC, B) {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const initialGroups = clone(SC.DATA.GROUPS);
  const initialRolePool = clone(SC.DATA.ROLE_POOL);
  const initialAudit = clone(SC.DATA.AUDIT);
  const initialDetails = clone(SC.DATA.AUDIT_DETAIL);
  const load = B.load;

  /* M04/M06/M07/M08/M09 批次三（s.b3.events）的事件标签 → 操作审计事件编码。
     只做列表可查询与详情页基础信息；未收录 AUDIT_DETAIL 的事件按设计展示「暂无扩展明细」，不臆造快照。 */
  const B3_EVENT_CODES = {
    "提交新建客户及首批商机": ["EV-D-06", "D", "客保审批"],
    "提交已有客户首批商机": ["EV-D-06", "D", "客保审批"],
    "提交自有客户新增商机": ["EV-D-06", "D", "客保审批"],
    "提交空余商机认领": ["EV-D-06", "D", "客保审批"],
    "提交加入客户并认领": ["EV-D-06", "D", "客保审批"],
    "提交已占用商机争议": ["EV-D-06", "D", "客保审批"],
    "提交商机释放": ["EV-D-14", "D", "客保审批"],
    "提交公海领取": ["EV-D-16", "D", "客保审批"],
    "提交未成交恢复经营": ["EV-D-11", "D", "客保审批"],
    "首批整单通过并生效": ["EV-D-20", "D", "客保审批"],
    "首批整单驳回": ["EV-D-20", "D", "客保审批"],
    "自有客户新增商机生效": ["EV-D-07", "D", "客保审批"],
    "自有客户新增商机驳回": ["EV-D-08", "D", "客保审批"],
    "空余商机认领生效": ["EV-D-07", "D", "客保审批"],
    "空余商机认领驳回": ["EV-D-08", "D", "客保审批"],
    "加入客户并认领生效": ["EV-D-07", "D", "客保审批"],
    "加入客户并认领驳回": ["EV-D-08", "D", "客保审批"],
    "已占用商机争议生效": ["EV-D-07", "D", "客保审批"],
    "已占用商机争议驳回": ["EV-D-08", "D", "客保审批"],
    "商机释放生效": ["EV-D-14", "D", "客保审批"],
    "商机释放驳回": ["EV-D-14", "D", "客保审批"],
    "公海领取生效": ["EV-D-16", "D", "客保审批"],
    "公海领取驳回": ["EV-D-16", "D", "客保审批"],
    "未成交恢复经营生效": ["EV-D-12", "D", "客保审批"],
    "未成交恢复经营驳回": ["EV-D-13", "D", "客保审批"],
    "直接分配商机": ["EV-D-10", "D", "客保审批"],
    "调整客户池": ["EV-C-11", "C", "客户池管理"],
    "客户释放至公海": ["EV-D-15", "D", "客保审批"],
    "公海领取转为加入认领": ["EV-D-16", "D", "系统自动"],
    "来源冲突驳回": ["EV-B-14", "B", "客保审批"],
    "来源冲突确认生效": ["EV-B-10", "B", "客保审批"],
    "提交跟进准入": ["EV-E-01", "E", "跟进准入终审"],
    "准入终审通过": ["EV-E-02", "E", "跟进准入终审"],
    "准入终审驳回": ["EV-E-03", "E", "跟进准入终审"],
    "空间建立": ["EV-E-06", "E", "系统自动"],
    "空间归档": ["EV-E-08", "E", "系统自动"],
    "空间解档": ["EV-E-11", "E", "系统自动"],
    "手动归档空置空间": ["EV-E-08", "E", "系统自动"],
    "空间恢复成功": ["EV-E-08", "E", "系统自动"],
    "空间整体迁移": ["EV-E-09", "E", "客保审批"],
    "整组交接生效": ["EV-D-17", "D", "客保审批"],
  };
  function b3AuditObj(s, e) {
    if (e.opp) { const o = B.find("opps", e.opp, s); return "商机 " + e.opp + (o ? " " + o.name : ""); }
    if (e.space) return "空间 " + e.space;
    if (e.combo) return "经营组合 " + e.combo;
    if (e.customer) { const c = B.find("customers", e.customer, s); return "客户 " + e.customer + (c ? " " + c.name : ""); }
    return e.id;
  }
  function b3ScopeRows(s, e) {
    const rows = [];
    if (e.sales) rows.push({ k: "销售", v: B.name("people", e.sales, s) || e.sales });
    if (e.customer) rows.push({ k: "客户", v: B.name("customers", e.customer, s) || e.customer });
    if (e.opp) rows.push({ k: "商机", v: e.opp });
    if (e.space) rows.push({ k: "空间", v: e.space });
    if (e.combo) rows.push({ k: "经营组合", v: e.combo });
    return rows;
  }
  function b3ToAudit(s, e) {
    const mapped = B3_EVENT_CODES[e.label];
    if (!mapped) return null;
    const [code, domain, entry] = mapped;
    const scopeRows = b3ScopeRows(s, e);
    const audit = { id: e.id, at: e.at, code, domain, name: e.label, by: e.by, entry, exec: "销售指挥官",
      obj: b3AuditObj(s, e), scope: scopeRows.map(r => r.k + "：" + r.v).join(" ｜ ") || "—",
      result: e.label.indexOf("驳回") >= 0 ? "fail" : "ok", batch: "",
      related: [e.customer, e.sales, e.opp, e.space, e.combo].filter(Boolean) };
    // 只提供真实掌握的身份、范围与备注；不臆造关系快照与依据引用，缺项由详情页 tab 自然展示为空。
    const detail = { identity: { by: e.by, entry, exec: "销售指挥官" }, scope: scopeRows,
      snapshot: [], evidence: [], corrections: [], note: e.text || "" };
    return { audit, detail };
  }
  B.defaults = { ADM: "U-1001", MGR: "U-1002", SLS: "U-1004", SOL: "U-1010" };
  B.sessionKey = "sc-prototype-identity";
  B.identity = function (fallback = "ADM") {
    const params = new URLSearchParams(location.search);
    let session;
    try { session = JSON.parse(sessionStorage.getItem(B.sessionKey)); } catch (_) {}
    const role = params.get("role") || session?.role || fallback;
    const id = params.get("as") || (session?.role === role ? session.id : B.defaults[role]);
    const person = B.load().people.find(p => p.id === id);
    return { role, id, person, valid: !!SC.DATA.ROLES[role] && person?.role === role && person.status === "on" };
  };
  B.groupOf = (s, id) => s.groups.find(g => g.id === s.people.find(p => p.id === id)?.groupId);
  B.managedGroups = (s, id) => s.groups.filter(g => g.mgrId === id);
  B.isTeam = (s, sales, manager) => {
    const current = s.people.find(p => p.id === manager?.id);
    const p = s.people.find(p => p.id === sales);
    return !!current && current.role === "MGR" && current.status === "on" &&
      p?.role === "SLS" && B.groupOf(s, sales)?.mgrId === current.id;
  };
  B.organisationNames = function (s) {
    s.people.forEach(p => {
      if (!Number.isInteger(p.roleVersion)) p.roleVersion = 0;
      if (p.groupId === undefined) p.groupId = "";
      p.group = p.role === "SLS" ? B.groupOf(s, p.id)?.name || "—" :
        p.role === "MGR" ? B.managedGroups(s, p.id).map(g => g.name).join("、") || "—" : "—";
    });
    return s;
  };
  B.load = function () {
    const s = load();
    if (!s.organisationVersion) {
      s.groups = initialGroups.map(g => ({ id: g.id, name: g.name, mgrId: g.mgrId,
        version: 0, created: "2026-08-12 09:20", createdBy: "陈可", updated: "2026-08-12 09:20" }));
      s.people.forEach(p => {
        p.groupId = p.role === "SLS" ? s.groups.find(g => g.name === p.group)?.id || "" : "";
        p.roleVersion = 0;
        if (p.role === "SLS" && !p.groupId) p.ungroupedAt = p.created;
      });
      initialRolePool.forEach(p => {
        if (!s.people.some(x => x.id === p.id)) s.people.push({ ...p, role: "", status: "off",
          created: p.enter, groupId: "", group: "—", pool: "", tasks: 0, roleVersion: 0 });
      });
      s.organisationVersion = 1;
      s.organisationEvents = [];
      B.organisationNames(s);
      B.save(s);
    }
    return B.organisationNames(s);
  };
  B.salesSummary = function (s, ids) {
    const selected = new Set(ids);
    const ops = s.opps.filter(o => selected.has(o.sales));
    const spaces = s.spaces.filter(w => selected.has(w.sales));
    return { cust: new Set(ops.map(o => o.customer)).size,
      combo: new Set(ops.map(o => o.sales + "|" + o.customer)).size,
      opp: ops.length, space: spaces.filter(w => w.status === "normal").length,
      history: spaces.filter(w => ["archived", "frozen"].includes(w.status)).length };
  };
  B.groupView = function (s, g) {
    const ids = s.people.filter(p => p.role === "SLS" && p.groupId === g.id).map(p => p.id);
    const manager = s.people.find(p => p.id === g.mgrId);
    return { ...g, ...B.salesSummary(s, ids), sales: ids.length,
      mgr: manager?.name || "—", managerAvailable: manager?.role === "MGR" && manager.status === "on" };
  };
  B.refreshOrganisation = function () {
    const s = B.load(), D = SC.DATA;
    const people = s.people.filter(p => D.ROLES[p.role]).map(p => {
      const old = D.PEOPLE.find(x => x.id === p.id) || {};
      return Object.assign(old, p, B.salesSummary(s, [p.id]));
    });
    D.PEOPLE.splice(0, D.PEOPLE.length, ...people);
    D.ROLE_POOL.splice(0, D.ROLE_POOL.length, ...s.people.filter(p => !D.ROLES[p.role]));
    D.GROUPS.splice(0, D.GROUPS.length, ...s.groups.map(g => B.groupView(s, g)));
    Object.keys(D.GROUP_MEMBERS).forEach(k => delete D.GROUP_MEMBERS[k]);
    s.groups.forEach(g => D.GROUP_MEMBERS[g.id] = people.filter(p => p.role === "SLS" && p.groupId === g.id));
    const events = s.organisationEvents || [];
    const b3Events = (s.b3?.events || []).map(e => b3ToAudit(s, e)).filter(Boolean);
    D.AUDIT.splice(0, D.AUDIT.length, ...events.map(e => e.audit), ...b3Events.map(e => e.audit), ...initialAudit);
    D.AUDIT.sort((a, b) => b.at.localeCompare(a.at));
    Object.assign(D.AUDIT_DETAIL, initialDetails);
    events.forEach(e => D.AUDIT_DETAIL[e.audit.id] = e.detail);
    b3Events.forEach(e => D.AUDIT_DETAIL[e.audit.id] = e.detail);
  };
  function record(s, actor, code, name, object, snapshot, related = []) {
    const at = B.now(), id = B.uid("E");
    const entry = code === "EV-A-07" ? "人员与账号" : "销售分组";
    const audit = { id, at, code, name, domain: "A", by: actor.name, actorId: actor.id, entry,
      exec: "销售指挥官", obj: object, scope: object, result: "ok", batch: "", related };
    const detail = { identity: { by: actor.name, entry, exec: "销售指挥官" },
      scope: [{ k: "业务对象", v: object }], snapshot, evidence: [], corrections: [],
      definition: { code, name: { "EV-A-07": "角色分配与变更", "EV-A-13": "销售分组建立",
        "EV-A-14": "销售分组关系调整", "EV-A-15": "主管指派与变更" }[code] || name,
        flow: "两者", dedup: "本次确认发生记录 + 业务对象" },
      note: "保存当时关系；后续任职及分组变化不改写本记录。" };
    s.organisationEvents.unshift({ audit, detail });
    s.logs.unshift({ id, at, object, action: name, by: actor.name,
      detail: snapshot.map(r => r.k + "：" + r.before + " → " + r.after).join("；") });
  }
  B.orgChange = function (fn) {
    const apply = () => {
      const s = clone(B.load()), identity = B.identity(B.role || "ADM");
      if (!identity.valid || identity.role !== "ADM") throw Error("当前身份无权维护销售分组或角色");
      const result = fn(s, identity.person);
      B.organisationNames(s);
      B.save(s);
      B.refreshOrganisation();
      return result;
    };
    // A browser-wide lock serializes two administrators' local prototype saves.
    return navigator.locks ? navigator.locks.request(B.key + "-organisation", apply) : Promise.resolve().then(apply);
  };
  function groupName(s, name, except) {
    name = String(name || "").trim();
    if (!name) throw Error("请填写分组名称");
    if (s.groups.some(g => g.id !== except && g.name === name)) throw Error("分组名称已存在");
    return name;
  }
  function manager(s, id, except) {
    const p = s.people.find(p => p.id === id);
    if (!p || p.role !== "MGR" || p.status !== "on") throw Error("请选择账号可用的销售主管");
    if (s.groups.some(g => g.id !== except && g.mgrId === id)) throw Error("该主管已管理其他分组，一名主管只能管理一个分组");
    return p;
  }
  function currentGroup(s, id, version) {
    const g = s.groups.find(g => g.id === id);
    if (!g) throw Error("分组不存在，请刷新列表");
    if (version !== undefined && g.version !== version) throw Error("分组关系已变化，请刷新后核对最新结果");
    return g;
  }
  B.createGroup = (name, managerId) => B.orgChange((s, actor) => {
    name = groupName(s, name);
    const p = manager(s, managerId);
    const g = { id: B.uid("G"), name, mgrId: p.id, version: 0,
      created: B.now(), updated: B.now(), createdBy: actor.name, updatedBy: actor.name };
    s.groups.push(g);
    record(s, actor, "EV-A-13", "销售分组建立", "分组 " + g.id + " " + name,
      [{ k: "分组名称", before: "无", after: name }, { k: "销售主管", before: "无", after: p.name }], [g.id, p.id]);
    record(s, actor, "EV-A-15", "主管指派与变更", "分组 " + g.id + " " + name,
      [{ k: "销售主管", before: "无", after: p.name }], [g.id, p.id]);
    return g;
  });
  B.renameGroup = (id, name, version) => B.orgChange((s, actor) => {
    const g = currentGroup(s, id, version), before = g.name;
    name = groupName(s, name, id);
    if (before === name) return g;
    g.name = name; g.version++; g.updated = B.now(); g.updatedBy = actor.name;
    record(s, actor, "EV-A-14", "修改销售分组名称", "分组 " + id + " " + name,
      [{ k: "分组名称", before, after: name }], [id]);
    return g;
  });
  B.assignSales = (groupId, ids) => B.orgChange((s, actor) => {
    const g = currentGroup(s, groupId);
    if (!ids.length) throw Error("请选择待分组销售");
    return [...new Set(ids)].map(id => {
      const p = s.people.find(p => p.id === id);
      const why = !p || p.role !== "SLS" ? "人员当前不是销售" : p.status !== "on" ? "账号已停用，请先启用" :
        p.groupId ? "已完成分组：" + (B.groupOf(s, id)?.name || "原分组") + "，不支持转组" : "";
      if (why) return { id: p?.name || id, status: "失败", reason: why };
      p.groupId = g.id; p.assignedAt = B.now(); p.assignedBy = actor.name; p.roleVersion++;
      record(s, actor, "EV-A-14", "销售分组关系调整", "人员 " + id + " " + p.name,
        [{ k: "销售分组", before: "待分组", after: g.name }], [id, g.id]);
      return { id: p.name, status: "成功", reason: "已分配到「" + g.name + "」" };
    });
  });
  B.succeedManager = (id, managerId, version) => B.orgChange((s, actor) => {
    const g = currentGroup(s, id, version), p = manager(s, managerId, id);
    if (g.mgrId === p.id) throw Error("请选择与当前主管不同的继任人");
    const previous = s.people.find(p => p.id === g.mgrId);
    g.mgrId = p.id; g.version++; g.updated = B.now(); g.updatedBy = actor.name;
    record(s, actor, "EV-A-15", "主管指派与变更", "分组 " + id + " " + g.name,
      [{ k: "销售主管", before: previous?.name || "无", after: p.name }], [id, previous?.id, p.id].filter(Boolean));
    return g;
  });
  B.roleChecks = function (s, id) {
    const p = s.people.find(p => p.id === id);
    if (!p) return [{ ok: false, t: "人员不存在", d: "请刷新人员列表" }];
    const opps = s.opps.filter(o => o.sales === id);
    const requests = (s.b3?.requests || []).filter(r => (r.actor === id || r.beneficiary === id) &&
      (r.first ? r.status === "pending" : r.items.some(i => i.status === "pending")));
    const admissions = (s.b3?.admissions || []).filter(a => a.status === "pending" && (a.sales === id || a.actor === id));
    const transfers = (s.b3?.transfers || []).filter(t => t.status === "pending" &&
      (t.source === id || t.targets?.some(x => x.sales === id)));
    const groups = B.managedGroups(s, id);
    return [
      { ok: p.status === "off", t: "账号状态", d: p.status === "off" ? "账号已停用，变更后仍需手动启用" : "请先停用账号，再办理角色变更", page: "people-list", params: {} },
      { ok: !opps.length, t: "归属关系", d: opps.length ? "仍有 " + opps.length + " 条归属商机（含已结束），请先办理交接" : "无归属商机", page: "handover", params: { sales: id } },
      { ok: !requests.length && !admissions.length && !transfers.length, t: "未完成事项",
        d: "客保申请 " + requests.length + " 项，准入提报 " + admissions.length + " 项，交接 " + transfers.length + " 项", page: requests.length ? "verdict" : admissions.length ? "admissions" : "handover", params: { sales: id } },
      { ok: !groups.length, t: "任职事项", d: groups.length ? "仍担任「" + groups.map(g => g.name).join("、") + "」主管，请先办理继任" : "无在任管理职务", page: "group-detail", params: { id: groups[0]?.id } },
      { ok: !p.pool, t: "客户池成员关系", d: p.pool ? "仍为「" + B.name("pools", p.pool, s) + "」成员，请先移出客户池" : "无客户池成员关系", page: "pool-detail", params: { id: p.pool } },
      { ok: !(p.tasks > 0), t: "协作事项", d: p.tasks > 0 ? "仍有 " + p.tasks + " 项未完成协作任务" : "无进行中的协作任务", page: "pool-detail", params: { id: p.pool } }
    ];
  };
  B.changeRole = (id, role, version) => B.orgChange((s, actor) => {
    const p = s.people.find(p => p.id === id);
    if (!p || !SC.DATA.ROLES[role]) throw Error("请选择有效的新角色");
    if (p.roleVersion !== version) throw Error("人员角色或分组关系已变化，请刷新后重新检查");
    if (p.role === role) throw Error("请选择不同的新角色");
    const failures = B.roleChecks(s, id).filter(x => !x.ok);
    if (failures.length) throw Error(failures.map(x => x.d).join("；"));
    const previous = p.role, oldGroup = B.groupOf(s, id);
    p.role = role; p.roleVersion++; p.groupId = ""; p.pool = "";
    if (role === "SLS") p.ungroupedAt = B.now();
    if (oldGroup) record(s, actor, "EV-A-14", "转岗解除销售分组关系", "人员 " + id + " " + p.name,
      [{ k: "销售分组", before: oldGroup.name, after: "无（已转岗）" }], [id, oldGroup.id]);
    record(s, actor, "EV-A-07", "角色分配与变更", "人员 " + id + " " + p.name,
      [{ k: "角色", before: SC.DATA.ROLES[previous]?.name || "未分配", after: SC.DATA.ROLES[role].name }], [id]);
    return p;
  });
  window.addEventListener("storage", e => {
    if (e.key === B.key && !B.meta && !SC.B3?.render && SC.rerender) SC.rerender();
  });
  B.refreshOrganisation();
})(window.SC, window.SC.B2);
