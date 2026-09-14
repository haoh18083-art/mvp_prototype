/* Batch 3 extends the same fictional, local store used by batch 2. */
(function (SC, B) {
  "use strict";
  const T = (SC.B3 = { views: {} });
  T.defaults = { ADM: "U-1001", MGR: "U-1002", SLS: "U-1004", SOL: "U-1010" };
  T.types = {
    first_new: "新建客户及首批商机",
    first_existing: "已有客户首批商机",
    new: "自有客户新增商机",
    claim: "空余商机认领",
    join: "加入客户并认领",
    dispute: "已占用商机争议",
    release: "商机释放",
    sea: "公海领取",
    restore: "未成交恢复经营",
  };
  T.reqLabels = {
    pending: "待审批",
    approved: "已通过",
    rejected: "已驳回",
    partial: "部分处理",
    complete: "已处理",
  };
  T.matches = function (s, name) {
    const normalize = (value) =>
      value.replace(/股份有限公司|有限责任公司|有限公司|集团/g, "").trim();
    const normalized = normalize(name);
    if (!normalized) return [];
    return s.customers
      .filter(
        (c) =>
          !c.merged &&
          (c.name === name ||
            normalize(c.name).includes(normalized) ||
            normalized.includes(normalize(c.name))),
      )
      .map((c) => ({ ...c, match: c.name === name ? "精确" : "模糊" }))
      .sort(
        (a, b) => (a.match === "精确" ? 0 : 1) - (b.match === "精确" ? 0 : 1),
      );
  };
  T.me = (s = B.load()) =>
    s.people.find((p) => p.id === (T.actorId || T.defaults[T.role || "ADM"]));
  T.guard = (s, roles) => {
    const p = T.me(s);
    if (!p || p.status !== "on" || p.role !== T.role || !roles.includes(p.role))
      throw Error("当前身份无权办理");
    return p;
  };
  T.owned = (s, customer, sales) =>
    s.opps.filter(
      (o) =>
        o.customer === customer &&
        o.sales &&
        (sales === undefined || o.sales === sales),
    );
  T.combo = (s, customer, sales) =>
    s.combos.find(
      (c) => c.customer === customer && c.sales === sales && !c.ended,
    );
  T.group = (s, sales) => B.groupOf(s, sales)?.name || "—";
  T.isTeam = (s, sales, me = T.me(s)) => B.isTeam(s, sales, me);
  T.manages = (s, sales, me = T.me(s)) =>
    me?.status === "on" &&
    (me.role === "ADM" || (me.role === "MGR" && T.isTeam(s, sales, me)));
  T.active = (s, o) => !!B.find("products", o.product, s)?.active;
  T.spaceOpps = (s, w, visible = true) =>
    s.opps.filter(
      (o) =>
        o.sales === w.sales &&
        o.customer === w.customer &&
        o.pool === w.pool &&
        (!visible || T.active(s, o)),
    );
  T.pendingAdmission = (s, c) =>
    s.b3.admissions.find((a) => a.combo === c?.id && a.status === "pending");
  T.pendingItem = (s, id, except = "") =>
    s.b3.requests.some(
      (r) =>
        r.id !== except &&
        r.items.some((i) => i.opp === id && i.status === "pending"),
    );
  T.requestState = (r) =>
    r.first
      ? r.status
      : r.items.every((i) => i.status === "pending")
        ? "pending"
        : r.items.some((i) => i.status === "pending")
          ? "partial"
          : r.items.every((i) => i.status === "approved")
            ? "approved"
            : r.items.every((i) => i.status === "rejected")
              ? "rejected"
              : "complete";
  T.event = (s, label, scope = {}, text = "") => {
    const by = T.me(s)?.name || "系统自动",
      entry = { id: B.uid("BE"), label, text, at: B.now(), by, ...scope };
    s.b3.events.unshift(entry);
    B.log(
      s,
      scope.opp || scope.space || scope.combo || scope.customer || entry.id,
      label,
      text,
    );
    return entry;
  };
  T.tx = (fn) => {
    const s = JSON.parse(JSON.stringify(B.load()));
    T.guard(s, ["ADM", "MGR", "SLS", "SOL"]);
    const result = fn(s);
    T.reconcile(s);
    B.save(s);
    return result;
  };
  T.stop = (s, w, reason) =>
    s.agents
      .filter((a) => a.space === w.id && a.current)
      .forEach((a) => {
        a.state = "stopped";
        a.current = false;
        a.why = reason;
        a.at = B.now();
        a.version++;
      });
  T.bind = (s, w) => {
    if (!s.agents.some((a) => a.space === w.id && a.current))
      s.agents.push({
        id: B.uid("A"),
        space: w.id,
        state: "bound",
        bound: true,
        current: true,
        at: B.now(),
        start: B.now(),
        tries: 0,
        round: 1,
        version: 0,
      });
  };
  T.reconcile = function (s) {
    if (!s.b3) return;
    s.spaces.forEach((w) => {
      if (w.status === "archived" && !w.archiveSource)
        w.archiveSource = (w.why || "").includes("空置")
          ? "empty"
          : "combination";
    });
    s.opps
      .filter((o) => o.sales)
      .forEach((o) => {
        if (!T.combo(s, o.customer, o.sales))
          s.combos.push({
            id: B.uid("K"),
            customer: o.customer,
            sales: o.sales,
            admit: "未提报",
            created: B.now(),
            round:
              s.combos.filter(
                (c) => c.customer === o.customer && c.sales === o.sales,
              ).length + 1,
          });
      });
    s.combos
      .filter((c) => !c.ended)
      .forEach((c) => {
        if (T.owned(s, c.customer, c.sales).length) return;
        c.ended = true;
        c.endedAt = B.now();
        s.b3.admissions
          .filter((a) => a.combo === c.id && a.status === "pending")
          .forEach((a) => {
            a.status = "void";
            a.reason = "经营组合已解除";
            a.at = B.now();
            a.version++;
          });
        s.spaces
          .filter((w) => w.customer === c.customer && w.sales === c.sales)
          .forEach((w) => {
            if (w.status === "normal") {
              w.status = "archived";
              w.archiveSource = "combination";
              w.archivedAt = B.now();
              w.why = "经营组合解除";
              w.version++;
              T.stop(s, w, w.why);
              T.event(
                s,
                "空间归档",
                { space: w.id, customer: c.customer, sales: c.sales },
                w.why,
              );
            } else if (w.status === "creating") {
              w.status = "failed";
              w.why = "原经营组合已解除，旧建立事项不能继续";
              w.version++;
            }
          });
      });
    s.combos
      .filter((c) => !c.ended && c.admit === "已通过")
      .forEach((c) => {
        const sales = B.find("people", c.sales, s);
        if (
          sales?.status !== "on" ||
          sales.role !== "SLS" ||
          !sales.group ||
          sales.group === "—"
        )
          return;
        const pools = [
          ...new Set(
            T.owned(s, c.customer, c.sales)
              .filter(
                (o) => o.pool && T.active(s, o) && B.find("pools", o.pool, s),
              )
              .map((o) => o.pool),
          ),
        ];
        pools.forEach((pool) => {
          let w = s.spaces.find(
            (w) =>
              w.customer === c.customer &&
              w.sales === c.sales &&
              w.pool === pool &&
              w.status !== "frozen",
          );
          if (!w) {
            w = {
              id: B.uid("W"),
              customer: c.customer,
              sales: c.sales,
              pool,
              status: "normal",
              created: B.now(),
              history: 0,
              version: 0,
            };
            s.spaces.push(w);
            T.bind(s, w);
            T.event(
              s,
              "空间建立",
              { space: w.id, customer: c.customer, sales: c.sales },
              B.name("pools", pool, s),
            );
          } else if (
            w.status === "archived" &&
            (w.archiveSource === "empty" || c.admit === "已通过")
          ) {
            w.status = "normal";
            w.version++;
            w.unarchivedAt = B.now();
            w.why = "";
            T.stop(s, w, "原归档实例保留");
            T.bind(s, w);
            T.event(
              s,
              "空间解档",
              { space: w.id, customer: c.customer, sales: c.sales },
              "沿用空间，新建当前实例",
            );
          }
        });
      });
    s.customers.forEach((c) => {
      if (c.sea && T.owned(s, c.id).length) {
        c.sea = false;
        c.seaExit = B.now();
      }
    });
    s.b3.requests
      .filter(
        (r) =>
          r.type === "sea" &&
          !B.find("customers", r.customer, s)?.sea &&
          r.items.some((i) => i.status === "pending"),
      )
      .forEach((r) => {
        r.type = "join";
        r.convertedAt = B.now();
        r.version++;
        T.event(
          s,
          "公海领取转为加入认领",
          { customer: r.customer, sales: r.actor },
          "客户已退出公海，按当前资格重新受理",
        );
      });
  };
  T.visibleCombos = (s, me = T.me(s)) =>
    s.combos.filter(
      (c) =>
        !c.ended &&
        T.owned(s, c.customer, c.sales).length &&
        (me.role === "ADM" ||
          (me.role === "SLS" && c.sales === me.id) ||
          (me.role === "MGR" && T.isTeam(s, c.sales, me)) ||
          (me.role === "SOL" &&
            me.pool &&
            T.owned(s, c.customer, c.sales).some(
              (o) => o.pool === me.pool && T.active(s, o),
            ))),
    );
  T.comboOpps = (s, c, me = T.me(s)) =>
    T.owned(s, c.customer, c.sales).filter(
      (o) => T.active(s, o) && (me.role !== "SOL" || o.pool === me.pool),
    );
  T.canCombo = (s, c, me = T.me(s)) =>
    !!c && T.visibleCombos(s, me).some((x) => x.id === c.id);
  T.admitError = function (s, c) {
    if (!c || c.ended || !T.owned(s, c.customer, c.sales).length)
      return "经营组合已解除";
    const p = B.find("people", c.sales, s);
    if (!p || p.role !== "SLS" || p.status !== "on")
      return "归属销售身份或账号不可用";
    if (!p.group || p.group === "—") return "销售尚未分组";
    if (!T.owned(s, c.customer, c.sales).some((o) => T.active(s, o)))
      return "暂无已激活产品对应的正式商机";
    return "";
  };
  T.spaceAccess = function (s, w, me = T.me(s)) {
    if (!w || !me || me.status !== "on") return null;
    let grant = me.role === "SLS" ? s.b3.grants.find((g) => g.space === w.id && g.person === me.id) : null;
    const member =
      me.role === "ADM" ||
      (me.role === "SLS" && w.sales === me.id) ||
      (me.role === "MGR" && T.isTeam(s, w.sales, me)) ||
      (me.role === "SOL" && me.pool === w.pool && T.spaceOpps(s, w).length > 0);
    if (!member && !grant) return null;
    const c = T.combo(s, w.customer, w.sales);
    return {
      readonly:
        w.status !== "normal" ||
        c?.admit !== "已通过" ||
        me.role === "ADM" ||
        (!!grant && !member),
      until: grant && !member ? grant.until : "",
      grant: grant || null,
      member,
    };
  };
  T.records = (s, w, access, me = T.me(s)) =>
    s.b3.records.filter(
      (r) =>
        r.space === w.id &&
        (!access.until || r.at <= access.until) &&
        (me.role !== "SOL" ||
          (!r.mixed &&
            !r.customerLevel &&
            r.opps.length &&
            r.opps.every((id) => {
              const o = B.find("opps", id, s);
              return o?.pool === me.pool && T.active(s, o);
            }))),
    );
  T.archive = function (id, version) {
    return T.tx((s) => {
      const w = B.find("spaces", id, s);
      if (!w || !T.manages(s, w.sales)) throw Error("没有当前归档权限");
      if (
        w.version !== version ||
        w.status !== "normal" ||
        T.spaceOpps(s, w, false).length
      )
        throw Error("空间已变化或仍有当前商机，不能归档");
      w.status = "archived";
      w.archiveSource = "empty";
      w.archivedAt = B.now();
      w.why = "局部空置手动归档";
      w.version++;
      T.stop(s, w, w.why);
      T.event(
        s,
        "手动归档空置空间",
        { space: w.id, customer: w.customer, sales: w.sales },
        "组合准入保留，回池后按条件自动解档",
      );
    });
  };
  T.ensure = function () {
    const s = B.load();
    if (s.b3) return;
    s.b3 = {
      version: 1,
      requests: [],
      admissions: [],
      events: [],
      records: [],
      grants: [],
      transfers: [],
      sourceResults: [],
    };
    const template = s.customers.find((c) => !c.merged) || s.customers[0];
    const addCustomer = (id, name) => {
      if (!B.find("customers", id, s))
        s.customers.push({
          ...JSON.parse(JSON.stringify(template)),
          id,
          name,
          source: "本地新建",
          merged: "",
          owner: "付赞",
          sea: false,
          contacts: [],
          note: "",
          created: "2026-09-01",
          extras: {},
        });
    };
    addCustomer("C-3901", "远航智联有限公司");
    addCustomer("C-3902", "恒川云服务有限公司");
    addCustomer("C-3903", "北辰数智有限公司");
    const addOpp = (id, customer, product, sales, pool, result = "active") => {
      if (!B.find("opps", id, s))
        s.opps.push({
          id,
          customer,
          product,
          sales,
          pool,
          result,
          sourceSales: "",
          name:
            B.name("customers", customer, s).replace("有限公司", "") +
            " · " +
            B.name("products", product, s),
          pending: "none",
          tasks: 0,
          origin: "CRM",
          crmPool: "",
          method: "CRM 接入",
          version: 0,
          created: "2026-08-20 09:00",
        });
    };
    addOpp("O-3901", "C-1007", "P-101", "", "", "closed");
    addOpp("O-3902", "C-1007", "P-102", "", "", "closed");
    addOpp("O-3903", "C-1011", "P-101", "", "");
    addOpp("O-3904", "C-1004", "P-102", "U-1004", "POOL-01", "closed");
    addOpp("O-3910", "C-3901", "P-101", "U-1007", "POOL-01");
    addOpp("O-3911", "C-3901", "P-102", "U-1007", "POOL-02");
    addOpp("O-3912", "C-3901", "P-104", "U-1004", "POOL-03");
    addOpp("O-3920", "C-3902", "P-101", "U-1005", "POOL-01");
    addOpp("O-3921", "C-3902", "P-102", "U-1005", "POOL-01");
    addOpp("O-3930", "C-3903", "P-101", "U-1004", "POOL-01");
    addOpp("O-3931", "C-3903", "P-102", "U-1008", "POOL-02");
    const addCombo = (customer, sales, admit) => {
      let c = T.combo(s, customer, sales);
      if (!c) {
        c = {
          id: B.uid("K"),
          customer,
          sales,
          admit,
          round: 1,
          created: "2026-09-01 10:00",
        };
        s.combos.push(c);
      }
      return c;
    };
    const q = addCombo("C-3901", "U-1004", "审批中");
    addCombo("C-3901", "U-1007", "已通过");
    addCombo("C-3902", "U-1005", "已通过");
    addCombo("C-3903", "U-1004", "未提报");
    addCombo("C-3903", "U-1008", "未提报");
    addCombo("C-1004", "U-1004", "未提报");
    const addSpace = (id, customer, sales, pool) => {
      s.spaces.push({
        id,
        customer,
        sales,
        pool,
        status: "normal",
        created: "2026-09-01 11:00",
        history: 3,
        version: 0,
      });
      T.bind(s, B.find("spaces", id, s));
    };
    addSpace("W-3910", "C-3901", "U-1007", "POOL-01");
    addSpace("W-3911", "C-3901", "U-1007", "POOL-02");
    addSpace("W-3920", "C-3902", "U-1005", "POOL-01");
    s.b3.admissions.push({
      id: "AD-3901",
      combo: q.id,
      customer: q.customer,
      sales: q.sales,
      actor: "U-1004",
      actorRole: "SLS",
      status: "pending",
      source: "普通提报",
      note: "新增承接团队前完成客户准入核对。",
      submitted: "2026-09-08 09:10",
      version: 0,
      snapshot: ["O-3912"],
    });
    const request = (id, type, actor, customer, oppIds, extra = {}) => {
      const r = {
        id,
        type,
        originalType: type,
        actor,
        customer,
        beneficiary: actor,
        first: type.startsWith("first"),
        submitted: "2026-09-08 09:20",
        reason: "申请推进本次客户合作，请核对承接安排。",
        status: "pending",
        version: 0,
        items: oppIds.map((opp) => ({
          id: opp,
          opp,
          product: B.find("opps", opp, s)?.product,
          status: "pending",
        })),
        ...extra,
      };
      s.b3.requests.push(r);
      r.items
        .filter((i) => i.opp)
        .forEach((i) => {
          const o = B.find("opps", i.opp, s);
          if (o.pending === "none")
            o.pending =
              type === "release"
                ? "release"
                : type === "restore"
                  ? "restore"
                  : type === "dispute"
                    ? "dispute"
                    : "apply";
        });
    };
    request("REQ-3901", "first_new", "U-1004", "", [], {
      name: "景云工业科技有限公司",
      suggested: "POOL-01",
      products: ["P-101", "P-102"],
      fields: {
        channel: "销售自拓",
        stage: "待触达",
        grade: "A",
        acquired: "2026-09-08",
        lead: "否",
      },
    });
    request("REQ-3902", "dispute", "U-1004", "C-3903", ["O-3931"]);
    request("REQ-3903", "restore", "U-1004", "C-1004", ["O-3904"]);
    request("REQ-3904", "join", "U-1004", "C-1011", ["O-3903"]);
    request("REQ-3905", "release", "U-1004", "C-3903", ["O-3930"]);
    request("REQ-3906", "sea", "U-1004", "C-1007", ["O-3901"]);
    request("REQ-3907", "sea", "U-1008", "C-1007", ["O-3902"]);
    request("REQ-3908", "first_existing", "U-1004", "C-1012", [], {
      products: ["P-103"],
      suggested: "POOL-02",
    });
    const legacy = s.opps.find(
      (o) =>
        o.pending === "release" &&
        !s.b3.requests.some((r) => r.items.some((i) => i.opp === o.id)),
    );
    if (legacy?.sales)
      request("REQ-3899", "release", legacy.sales, legacy.customer, [
        legacy.id,
      ]);
    s.b3.requests.push({
      id: "REQ-3898",
      type: "new",
      originalType: "new",
      actor: "U-1004",
      beneficiary: "U-1004",
      customer: "C-3903",
      submitted: "2026-09-07 14:20",
      at: "2026-09-07 15:00",
      reason: "扩展合作产品",
      status: "rejected",
      version: 1,
      first: false,
      by: "U-1001",
      items: [
        {
          id: "ITEM-3898",
          opp: "",
          product: "P-104",
          status: "rejected",
          reason: "申请资格不足",
          by: "U-1001",
          at: "2026-09-07 15:00",
        },
      ],
    });
    const historicalCombo = T.combo(s, "C-3902", "U-1005");
    s.b3.admissions.push({
      id: "AD-3899",
      combo: historicalCombo.id,
      customer: historicalCombo.customer,
      sales: historicalCombo.sales,
      actor: "U-1005",
      actorRole: "SLS",
      source: "普通提报",
      status: "approved",
      by: "U-1002",
      submitted: "2026-09-01 10:00",
      at: "2026-09-01 11:00",
      version: 1,
      note: "客户条件已核对",
      reason: "",
      snapshot: ["O-3920", "O-3921"],
    });
    s.spaces.forEach((w, i) => {
      const opps = T.spaceOpps(s, w, false).map((o) => o.id);
      if (!opps.length) {
        if (w.status === "archived")
          s.b3.records.push({
            id: "BR-HISTORY-" + w.id,
            space: w.id,
            customer: w.customer,
            sales: w.sales,
            opps: [],
            kind: "客户级审批",
            label: "客户现场沟通申请",
            text: "公出申请已完成，目的地为客户办公场所。",
            at: "2026-08-20 10:00",
            by: B.name("people", w.sales, s),
            mixed: false,
            customerLevel: true,
          });
        return;
      }
      s.b3.records.push({
        id: "BR-" + w.id,
        space: w.id,
        customer: w.customer,
        sales: w.sales,
        opps: [opps[0]],
        kind: "跟进记录",
        label: "需求沟通记录",
        text: "客户确认了业务场景，当前合作范围和交付安排待下一次沟通核对。",
        at: "2026-09-03 10:20",
        by: B.name("people", w.sales, s),
        mixed: false,
        customerLevel: false,
      });
      if (i === 0)
        s.b3.records.push({
          id: "BR-MIXED",
          space: w.id,
          customer: w.customer,
          sales: w.sales,
          opps,
          mixed: true,
          kind: "会议纪要",
          label: "联合沟通纪要",
          text: "涉及其他承接范围的预算资料，只对具有原空间完整权限的人员开放。",
          at: "2026-09-04 11:00",
          by: B.name("people", w.sales, s),
          customerLevel: false,
        });
      if (w.id === "W-3910")
        s.b3.records.push({
          id: "BR-CUSTOMER",
          space: w.id,
          customer: w.customer,
          sales: w.sales,
          opps: [],
          customerLevel: true,
          kind: "客户级审批",
          label: "公出审批记录",
          text: "客户级审批仅只读引用，不伪造商机关联。",
          at: "2026-09-02 14:00",
          by: "韩增",
          mixed: false,
        });
    });
    T.reconcile(s);
    B.save(s);
  };
})(window.SC, window.SC.B2);
