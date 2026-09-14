(function (SC, B, T) {
  "use strict";
  const E = B.e;
  T.route = {
    ADM: "verdict",
    MGR: "manager-home",
    SLS: "sales-home",
    SOL: "solution-pool",
  };
  T.href = (page, params = {}) => {
    if (["my-request", "request-form", "customer-search", "sea-customer"].includes(page)) {
      const { id, ...rest } = params;
      const host = page === "my-request" ? "my-requests" : page === "request-form" && ["new","release","restore","dispute"].includes(params.type) ? "my-customers" : "market";
      const panel = page === "my-request" ? (id ? {request:id} : {}) :
        {panel: page === "request-form" ? "form" : page === "customer-search" ? "search" : "sea", ...(id ? {detail:id} : {}), ...(page === "sea-customer" ? {view:"sea"} : {})};
      return B.href(host, {role:T.role,as:T.actorId,...rest,...panel});
    }
    const managerRoutes = {
      "manager-approval": ["manager-approvals", "request"],
      "manager-admission": ["manager-admissions", "admission"],
      "manager-assign": ["manager-approvals", "assign"],
      "manager-admission-records": ["manager-admissions", "records"],
    };
    if (managerRoutes[page]) {
      const [host, key] = managerRoutes[page], { id, ...rest } = params;
      return B.href(host, { role: T.role, as: T.actorId, ...rest,
        ...(key === "records" ? { view: "records" } : key === "assign" ? { assign: "1" } : id ? { [key]: id } : {}) });
    }
    if (page === "admission-detail") {
      const { id, ...rest } = params;
      return B.href("admissions", {
        role: T.role, as: T.actorId, ...rest,
        ...(id ? { admission: id } : {}),
      });
    }
    if (page === "approval-detail") {
      const { id, ...rest } = params;
      return B.href("verdict", {
        role: T.role, as: T.actorId, ...rest, view: "requests",
        ...(id ? { request: id } : {}),
      });
    }
    return B.href(page, { role: T.role, as: T.actorId, ...params });
  };
  T.link = (page, label, params = {}, cls = "") =>
    '<a class="' +
    cls +
    '" href="' +
    E(T.href(page, params)) +
    '">' +
    E(label) +
    "</a>";
  /* 经营组合详情已改为右侧抽屉：任意页面就地滑出，不再整页切换。
     combo 视图在 batch3/views/spaces.js，非该文件的页面按需懒加载后再打开。 */
  T.openCombo = function (comboId, options = {}) {
    if (!(T.views && T.views.combo)) {
      if (T._comboLoading) return;
      T._comboLoading = true;
      const sc = document.createElement("script");
      sc.src = "../js/batch3/views/spaces.js?v=20260909-combo";
      sc.onload = () => {
        T._comboLoading = false;
        T.openCombo(comboId, options);
      };
      sc.onerror = () => {
        T._comboLoading = false;
        location.href = T.href("combo-detail", { id: comboId });
      };
      document.head.appendChild(sc);
      return;
    }
    const s = B.load(),
      me = T.me(s),
      c = s.combos.find((x) => x.id === comboId);
    if (!me || me.status !== "on" || me.role !== T.role || !c || !T.canCombo(s, c)) {
      SC.toast("无法查看该经营组合", "bad");
      return;
    }
    if (B._drawer?.root.classList.contains("combo-detail-drawer"))
      B._drawer.close(true);
    const drawer = B.drawer({
      title: "经营组合",
      sub:
        E(B.name("customers", c.customer, s)) +
        " · 销售 " +
        E(B.name("people", c.sales, s)),
      width: "min(760px, 100vw)",
      footer: '<div class="b3-combo-foot b2-actions"></div>',
      onClose: options.onClose,
    });
    drawer.root.classList.add("combo-detail-drawer");
    const foot = drawer.root.querySelector(".b3-combo-foot");
    T.views.combo(drawer.body, foot, s, me, { comboId });
    if (!foot.children.length)
      drawer.root.querySelector(".b2-drawer__foot")?.remove();
    return drawer;
  };
  T.requestPage = () =>
    T.role === "SLS"
      ? "my-request"
      : T.role === "MGR"
        ? "manager-approval"
        : "approval-detail";
  T.admissionPage = () =>
    T.role === "MGR" ? "manager-admission" : "admission-detail";
  T.admissionList = () =>
    T.role === "MGR" ? "manager-admissions" : "admissions";
  T.setQuery = (params) => {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(params))
      v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
    history.replaceState(null, "", u.href);
  };
  T.requestBadge = (r) =>
    B.badge(
      T.reqLabels[T.requestState(r)],
      ["approved", "complete"].includes(T.requestState(r))
        ? "green"
        : T.requestState(r) === "rejected"
          ? "red"
          : "amber",
    );
  T.admitBadge = (c) =>
    B.badge(
      c?.admit || "未提报",
      c?.admit === "已通过"
        ? "green"
        : c?.admit === "已驳回"
          ? "red"
          : "neutral",
    );
  T.reasons = [
    "客户主体不一致",
    "同客同品已有商机",
    "申请资格不足",
    "客户池归属待核对",
    "产品未激活",
    "其他",
  ];
  T.admitReasons = [
    "客户信息不完整",
    "商机信息有误",
    "归属或客户池待确认",
    "暂不安排跟进",
    "重复提报",
    "其他",
  ];
  T.options = (items, empty = "请选择") => [["", empty], ...items];
  T.poolOptions = (s) =>
    T.options(
      s.pools.map((p) => [p.id, p.name]),
      "选择客户池",
    );
  T.peopleOptions = (s, team = false) =>
    T.options(
      s.people
        .filter(
          (p) =>
            p.role === "SLS" &&
            p.status === "on" &&
            (!team || T.isTeam(s, p.id)),
        )
        .map((p) => [p.id, p.name + " · " + p.group]),
      "选择销售",
    );
  T.bodyNote = (message, tone = "") => SC.note(E(message), tone);
  T.error = (root, e) => {
    let error = root.querySelector(".b2-error");
    if (!error) {
      error = SC.el('<p class="b2-error" role="alert"></p>');
      root.appendChild(error);
    }
    error.textContent = e.message || e;
  };
  T.scopeTitle = (s, c) =>
    B.name("customers", c.customer, s) + " · " + B.name("people", c.sales, s);
  T.readyState = (s, w) => {
    const a = s.agents.find((a) => a.space === w.id && a.current);
    return (
      '<div class="b3-state-columns"><span><small>空间状态</small>' +
      SC.spaceState(w.status, {
        empty: w.status === "normal" && !T.spaceOpps(s, w, false).length,
      }) +
      "</span><span><small>绑定情况</small>" +
      B.badge(
        a?.bound ? "已达成绑定" : ['archived','frozen'].includes(w.status) ? '无当前运行实例' : "尚未绑定",
        a?.bound ? "green" : "neutral",
      ) +
      "</span><span><small>当前实例状态</small>" +
      (a
        ? SC.agentState(a.state, { milestone: false, safe: false })
        : ['archived','frozen'].includes(w.status) ? SC.agentState('stopped',{milestone:false,safe:false}) : '<span class="u-t2">未创建实例</span>') +
      "</span></div>"
    );
  };
  T.future = (title, id = "") => B.future(title, id);
  T.start = function (meta) {
    const params = new URLSearchParams(location.search);
    const identity = B.identity(meta.role || "SLS");
    T.invalidRole = !SC.DATA.ROLES[identity.role];
    T.role = T.invalidRole
      ? meta.role || "SLS"
      : identity.role;
    T.actorId = identity.id;
    T.meta = meta;
    B.role = T.role;
    T.ensure();
    T.render = () => {
      // 任意重渲染（含提交后）关闭经营组合抽屉，避免残留旧状态。
      if (B._drawer?.root.classList.contains("combo-detail-drawer"))
        B._drawer.close(true);
      const s = B.load();
      T.reconcile(s);
      B.save(s);
      const me = T.me(s),
        valid = !T.invalidRole && me?.role === T.role && me.status === "on";
      if (me && SC.DATA.CURRENT[T.role])
        SC.DATA.CURRENT[T.role] = {
          ...SC.DATA.CURRENT[T.role],
          name: me.name,
          group: me.group,
          pool: me.pool ? B.name("pools", me.pool, s) : "",
        };
      document.body.className = "b2 b3";
      document.body.dataset.page = meta.pid;
      SC.page(
        {
          role: SC.DATA.ROLES[T.role] ? T.role : "SLS",
          menu:
            meta.view === "requestForm" &&
            ["release", "restore", "new"].includes(SC.param("type"))
              ? "mycust"
              : typeof meta.menu === "object"
                ? meta.menu[T.role]
                : meta.menu,
          pid: meta.pid,
          title: meta.title,
          crumb: [],
        },
        (body, actions) => {
          if (!valid || (meta.role && meta.role !== T.role)) {
            body.innerHTML = B.empty(
              "无权访问",
              "当前身份或任职不允许访问此页面。",
            );
            return;
          }
          body.innerHTML = '<div class="b3-loading" role="status"></div>';
          T.views[meta.view](body, actions, s, me, meta);
        },
      );
      const old = document.getElementById("sc-role");
      if (old) {
        const sel = old.cloneNode(true);
        old.replaceWith(sel);
        sel.setAttribute("aria-label", "原型角色");
        sel.onchange = () =>
          (location.href = B.href(T.route[sel.value], { role: sel.value }));
      }
      if (valid) {
        const roleSwitch = document.querySelector(".sc-roleswitch");
        const select = document.createElement("select");
        select.className = "select select--sm b3-persona";
        select.setAttribute("aria-label", "原型人员");
        select.title = "原型人员";
        s.people
          .filter((p) => p.role === T.role && p.status === "on")
          .forEach((p) =>
            select.add(new Option(p.name, p.id, false, p.id === me.id)),
          );
        select.onchange = () => {
          const u = new URL(location.href);
          u.searchParams.set("as", select.value);
          location.href = u.href;
        };
        roleSwitch?.after(select);
      }
      document.querySelectorAll(".sc-nav a").forEach((a) => {
        const u = new URL(a.href);
        u.searchParams.set("role", T.role);
        u.searchParams.set("as", T.actorId);
        a.href = u.href;
      });
      meta.afterRender?.({ state: s, valid });
      // 深链 ?combo=<id>：在当前清单页自动展开经营组合抽屉（仅一次）。
      if (!T._comboOpened && SC.param("combo")) {
        T._comboOpened = true;
        const cid = SC.param("combo");
        requestAnimationFrame(() => T.openCombo(cid));
      }
    };
    B.render = T.render;
    window.addEventListener("storage", (e) => {
      if (e.key === B.key) T.render();
    });
    // 拦截全站指向 combo-detail 的链接，改为就地滑出抽屉（普通左键、无修饰键）。
    if (!T._comboIntercept) {
      T._comboIntercept = true;
      document.addEventListener(
        "click",
        (e) => {
          const a =
            e.target.closest &&
            e.target.closest('a[href*="combo-detail.html"]');
          if (!a || e.defaultPrevented) return;
          if (
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
          )
            return;
          let id;
          try {
            id = new URL(a.href).searchParams.get("id");
          } catch (err) {
            return;
          }
          if (!id) return;
          e.preventDefault();
          T.openCombo(id);
        },
        true,
      );
    }
    T.render();
  };
  T.oppColumns = function (s, { market = false, action = true } = {}) {
    const me = T.me(s);
    return [
      [
        "商机 / 客户",
        (o) =>
          B.entity(o.name, o.id, "box", T.href("opportunity", { id: o.id })),
      ],
      [
        "产品",
        (o) =>
          E(B.name("products", o.product, s)) +
          (market
            ? ""
            : '<div class="b2-sub">' +
              (T.active(s, o) ? "已激活" : "未激活") +
              "</div>"),
      ],
      [
        "当前归属",
        (o) =>
          E(o.sales ? B.name("people", o.sales, s) : o.sourceSales || "空余") +
          '<div class="b2-sub">' +
          E(
            o.sales
              ? T.group(s, o.sales)
              : o.sourceSales
                ? "未对应本地用户"
                : "",
          ) +
          "</div>",
      ],
      [
        "经营结果",
        (o) =>
          B.badge(
            SC.OPP_RESULT[o.result],
            o.result === "active" ? "green" : "neutral",
          ),
      ],
      ...(!market ? [["客户池", (o) => E(B.name("pools", o.pool, s))]] : []),
      [
        "进行中事项",
        (o) => {
          const own =
            me.role === "ADM" ||
            (me.role === "MGR" && T.isTeam(s, o.sales, me)) ||
            me.id === o.sales;
          return E(
            own
              ? SC.OPP_PENDING[o.pending] || "无"
              : o.pending === "release"
                ? "无"
                : o.pending !== "none"
                  ? "有进行中申请"
                  : "无",
          );
        },
      ],
      ...(action
        ? [
            [
              "操作",
              (o) => T.link("opportunity", "查看", { id: o.id }, "btn btn--sm"),
            ],
          ]
        : []),
    ];
  };
  T.eventHTML = function (
    s,
    { space = "", combo = "", customer = "", sales = "" } = {},
  ) {
    const me = T.me(s);
    let events = s.b3.events.filter((e) =>
      space
        ? e.space === space
        : combo
          ? e.combo === combo || (e.customer === customer && e.sales === sales)
          : e.customer === customer && e.sales === sales,
    );
    if (me.role === "SOL")
      events = events.filter(
        (e) =>
          e.opp &&
          B.find("opps", e.opp, s)?.pool === me.pool &&
          T.active(s, B.find("opps", e.opp, s)),
      );
    return events.length
      ? '<ul class="b2-history">' +
          events
            .map(
              (e) =>
                "<li><time>" +
                E(e.at) +
                "</time><div><b>" +
                E(e.label) +
                "</b><p>" +
                E(e.by) +
                " · " +
                E(e.text) +
                "</p></div></li>",
            )
            .join("") +
          "</ul>"
      : B.empty("暂无业务动态", "当前授权范围内尚无业务变化记录。");
  };
  T.submitModal = function (ids) {
    const s = B.load(),
      me = T.me(s),
      combos = ids
        .map((id) => s.combos.find((c) => c.id === id))
        .filter((c) => T.canCombo(s, c));
    B.modal({
      title: "确认提报跟进准入",
      wide: true,
      confirm: "提交提报",
      body:
        '<form class="b3-form">' +
        combos
          .map(
            (c) =>
              '<section class="b3-form-block"><h3>' +
              E(T.scopeTitle(s, c)) +
              '</h3><p class="b2-sub">' +
              (me.role === "SOL" ? "本池可见" : "当前可见") +
              "商机 " +
              T.comboOpps(s, c, me).length +
              " 条</p>" +
              B.field(
                c.admit === "已驳回" ? "再次提报说明" : "提报说明",
                c.id,
                "",
                { area: true, required: c.admit === "已驳回" },
              ) +
              "</section>",
          )
          .join("") +
        "</form>" +
        T.bodyNote("提报单位：所列销售与客户的完整经营组合。"),
      onConfirm: (root) => {
        const notes = Object.fromEntries(
          new FormData(root.querySelector("form")),
        );
        const result = T.submitAdmissions(ids, notes);
        T.render();
        B.results(result, "准入提报结果");
      },
    });
  };
  T.movePoolModal = function (ids) {
    const s = B.load(),
      versions = Object.fromEntries(
        ids.map((id) => [id, B.find("opps", id, s)?.version]),
      );
    B.modal({
      title: "调整客户池",
      wide: true,
      confirm: "确认调整",
      body:
        "<form>" +
        B.field("目标已有客户池", "pool", "", {
          options: T.poolOptions(s),
          required: true,
        }) +
        "</form>" +
        T.bodyNote("销售归属不变，原空间历史不搬移；进行中方案任务保留。") +
        B.kv(
          ids.map((id) => [
            id,
            B.name("pools", B.find("opps", id, s)?.pool, s),
          ]),
        ),
      onConfirm: (root) => {
        const pool = B.values(root).pool,
          current = B.load();
        if (
          ids.some(
            (id) => B.find("opps", id, current)?.version !== versions[id],
          )
        )
          throw Error("商机关系已变化，请重新核对");
        const rows = T.poolMove(ids.map((id) => ({ id, pool })));
        T.render();
        B.results(rows, "客户池调整结果");
      },
    });
  };
  T.bindCommon = (root) =>
    B.actions(root, {
      future: (id) => T.future("后续业务", id),
      opportunity: (id) => (location.href = T.href("opportunity", { id })),
      archive: (id) => {
        const s = B.load(),
          w = B.find("spaces", id, s);
        B.modal({
          title: "归档空置空间",
          confirm: "确认归档",
          danger: true,
          body:
            B.kv([
              ["客户", B.name("customers", w.customer, s)],
              ["销售", B.name("people", w.sales, s)],
              ["客户池", B.name("pools", w.pool, s)],
              ["历史记录", s.b3.records.filter((r) => r.space === id).length],
            ]) +
            T.bodyNote(
              "实例将停止，历史只读保留。组合准入有效且商机回池时自动解档。",
              "warn",
            ),
          onConfirm: () => {
            T.archive(id, w.version);
            T.render();
            SC.toast("空间已归档，历史保留", "ok");
          },
        });
      },
    });
})(window.SC, window.SC.B2, window.SC.B3);
