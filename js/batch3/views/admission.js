(function (SC, B, T) {
  const E = B.e;
  const labels = {
    pending: "审批中",
    approved: "已通过",
    rejected: "已驳回",
    void: "已作废",
  };
  let admissionDrawer = null;
  T.syncAdmissionDrawer = function ({ state = B.load(), valid = true } = {}) {
    const id = SC.param("admission"), me = T.me(state);
    if (!valid || !id || !me || me.role !== "ADM" || me.status !== "on") {
      admissionDrawer?.drawer.close(true);
      return;
    }
    let entry = admissionDrawer;
    if (!entry || entry.id !== id || entry.drawer.closed || !entry.drawer.root.isConnected) {
      admissionDrawer = null;
      entry?.drawer.close(true);
      entry = { id };
      entry.drawer = B.drawer({
        title: "准入终审详情",
        sub: '<span class="mono">' + E(id) + '</span>',
        width: "min(800px, 100vw)",
        footer: '<div class="admission-drawer-actions"></div>',
        onClose: () => {
          if (admissionDrawer !== entry) return;
          admissionDrawer = null;
          if (SC.param("admission") === id) T.setQuery({ admission: "" });
          const row = [...document.querySelectorAll("#admission-table tr[data-id]")]
            .find((node) => node.dataset.id === id);
          (row?.querySelector("a.btn") || document.querySelector("#admission-table [data-search]"))?.focus();
        },
      });
      entry.drawer.root.classList.add("admission-drawer");
      admissionDrawer = entry;
    }
    entry.drawer.child?.close(true);
    // Keep the panel mounted while a decision refreshes the pending list.
    document.body.classList.add("b2-drawer-lock");
    const content = document.createElement("div"),
      footer = entry.drawer.root.querySelector(".admission-drawer-actions");
    entry.drawer.body.replaceChildren(content);
    footer.replaceChildren();
    footer.parentElement.hidden = true;
    T.views.admissionDetail(content, document.createElement("div"), state, me, {
      admissionId: id, footer,
    });
  };
  function wireAdmissionDrawers(root) {
    root.querySelectorAll('a[href^="admissions.html?"]').forEach((link) => {
      const id = new URL(link.href).searchParams.get("admission");
      if (!id) return;
      link.setAttribute("aria-haspopup", "dialog");
      link.onclick = (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        T.setQuery({ admission: id });
        T.syncAdmissionDrawer();
      };
    });
  }
  function wireAdmissionOpportunities(root) {
    if (!admissionDrawer || !admissionDrawer.drawer.root.contains(root)) return;
    root.querySelectorAll('a[href^="opportunity.html?"]').forEach((link) => {
      link.setAttribute("aria-haspopup", "dialog");
      link.onclick = (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const id = new URL(link.href).searchParams.get("id"),
          entry = admissionDrawer, s = B.load(), me = T.me(s),
          admission = s.b3.admissions.find((a) => a.id === entry?.id);
        if (!entry || entry.drawer.closed || me?.role !== "ADM" ||
          !T.canAdmission(s, admission) ||
          !T.owned(s, admission.customer, admission.sales).some((o) => o.id === id)) {
          SC.toast("该商机已不在当前终审的可查看范围", "bad");
          T.render();
          return;
        }
        const drawer = B.drawer({
          parent: entry.drawer,
          title: "商机详情",
          sub: '<span class="mono">' + E(id) + '</span>',
          width: "min(800px, 100vw)",
          backLabel: "返回终审",
        });
        drawer.root.classList.add("admission-drawer", "admission-opportunity-drawer");
        T.views.opportunity(drawer.body, document.createElement("div"), s, me, { opportunityId: id });
      };
    });
  }
  T.views.admissions = function (body, actions, s, me, meta) {
    const historyView = meta.view === "admissionRecords",
      rows = s.b3.admissions.filter(
        (a) =>
          T.canAdmission(s, a) &&
          (historyView
            ? a.by === me.id && a.status !== "pending"
            : a.status === "pending"),
      );
    actions.innerHTML =
      me.role === "MGR"
        ? T.link(
            historyView ? "manager-admissions" : "manager-admission-records",
            historyView ? "返回待办" : "已处理记录",
            {},
            "btn",
          )
        : T.link("verdict", "客保裁决台", {}, "btn");
    body.innerHTML = '<div id="admission-table"></div>';
    B.table(
      body.querySelector("#admission-table"),
      rows,
      [
        [
          "客户 / 组合销售",
          (a) =>
            B.entity(
              B.name("customers", a.customer, s),
              B.name("people", a.sales, s),
              "building",
              T.href(T.admissionPage(), { id: a.id }),
            ),
        ],
        [
          "提报人",
          (a) =>
            E(B.name("people", a.actor, s)) +
            '<p class="b2-sub">' +
            E(a.source) +
            "</p>",
        ],
        ["销售分组", (a) => E(T.group(s, a.sales))],
        [
          "已激活 / 待指定",
          (a) => {
            const ops = T.owned(s, a.customer, a.sales);
            return (
              ops.filter((o) => T.active(s, o)).length +
              " / " +
              ops.filter((o) => !o.pool).length
            );
          },
        ],
        [
          "当前状态",
          (a) =>
            B.badge(
              labels[a.status],
              a.status === "approved"
                ? "green"
                : a.status === "rejected"
                  ? "red"
                  : "amber",
            ),
        ],
        ["提交时间", (a) => E(a.submitted)],
        [
          "操作",
          (a) =>
            T.link(T.admissionPage(), "查看终审", { id: a.id }, "btn btn--sm"),
        ],
      ],
      {
        key: meta.pid,
        onDraw: me.role === "ADM" ? wireAdmissionDrawers : undefined,
        select: !historyView,
        batchLabel: "批量通过",
        onBatch: (ids) =>
          B.modal({
            title: "批量确认准入通过",
            wide: true,
            confirm: "确认通过",
            body:
              B.kv(
                ids.map((id) => {
                  const a = rows.find((a) => a.id === id);
                  return [
                    B.name("customers", a.customer, s),
                    B.name("people", a.sales, s),
                  ];
                }),
              ) +
              T.bodyNote(
                "每个经营组合独立生效；不支持部分商机准入或批量驳回。",
              ),
            onConfirm: () => {
              const result = ids.map((id) => {
                try {
                  return T.decideAdmission(
                    id,
                    "approve",
                    "",
                    "",
                    rows.find((a) => a.id === id).version,
                  );
                } catch (e) {
                  return { id, status: "失败", reason: e.message };
                }
              });
              T.render();
              B.results(result, "批量终审结果");
            },
          }),
        searchText: (a) =>
          a.id +
          B.name("customers", a.customer, s) +
          B.name("people", a.sales, s),
        filters: [
          {
            key: "sales",
            label: "组合销售",
            options: T.peopleOptions(s, me.role === "MGR").slice(1),
          },
        ],
        emptyTitle: historyView ? "暂无本人已处理记录" : "暂无准入终审待办",
      },
    );
  };
  T.views.admissionRecords = T.views.admissions;
  T.views.admissionDetail = function (body, actions, s, me, meta = {}) {
    const id =
        meta.admissionId || SC.param("id") || s.b3.admissions.find((a) => T.canAdmission(s, a))?.id,
      a = s.b3.admissions.find((a) => a.id === id);
    if (!a || !T.canAdmission(s, a)) {
      body.innerHTML = B.empty("没有当前可查看的终审记录");
      return;
    }
    const c = s.combos.find((c) => c.id === a.combo),
      ops = T.owned(s, a.customer, a.sales),
      error = T.admitError(s, c);
    actions.innerHTML = T.link(T.admissionList(), "返回准入待办", {}, "btn");
    body.innerHTML =
      '<div class="b3-scope"><div class="u-grow"><h2>' +
      E(B.name("customers", a.customer, s)) +
      '</h2><div class="scope-meta"><span>' +
      E(B.name("people", a.sales, s)) +
      "</span><span>" +
      E(a.source) +
      "</span></div></div>" +
      B.badge(
        labels[a.status],
        a.status === "approved"
          ? "green"
          : a.status === "rejected"
            ? "red"
            : "amber",
      ) +
      "</div>" +
      B.section(
        "提报与受理",
        '<div class="b2-section__body">' +
          B.kv([
            ["提报人", B.name("people", a.actor, s)],
            ["提交时间", a.submitted],
            ["提报说明", a.note || "无"],
            ["组合销售分组", T.group(s, a.sales)],
            ["本轮准入序次", c?.round || 1],
            [
              "本次处理身份",
              T.role === "ADM" ? "超级管理员兜底" : "本组销售主管",
            ],
          ]) +
          "</div>",
      ) +
      (a.status === "pending" && error
        ? T.bodyNote(error + "；暂不能通过，但有权人仍可选择原因驳回。", "warn")
        : "") +
      B.section("当前完整组合商机", '<div id="admission-opps"></div>');
    B.table(body.querySelector("#admission-opps"), ops, T.oppColumns(s), {
      search: false,
      onDraw: meta.admissionId ? wireAdmissionOpportunities : undefined,
    });
    if (a.status === "pending")
      body.insertAdjacentHTML(
        "beforeend",
        '<form class="b3-form" id="admit-form">' +
          B.field("终审意见", "opinion", "", { area: true }) +
          B.field("驳回原因", "reason", "", {
            options: T.options(T.admitReasons),
          }) +
          '<p class="b2-error" role="alert"></p><div class="b3-decision-footer">' +
          B.btn("驳回", "reject", "", "x", "btn--danger") +
          B.btn("通过准入", "approve", "", "check", "btn--primary") +
          "</div></form>",
      );
    else
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "终审结果",
          '<div class="b2-section__body">' +
            B.kv([
              ["结果", labels[a.status]],
              ["处理人", a.by ? B.name("people", a.by, s) : "系统"],
              ["处理时间", a.at],
              ["原因", a.reason || "无"],
              ["终审意见", a.opinion || "无"],
            ]) +
            "</div>",
        ),
      );
    body.insertAdjacentHTML(
      "beforeend",
      B.section("各池空间结果", '<div id="admit-spaces"></div>') +
        B.section("历次准入", '<div id="admit-history"></div>'),
    );
    const spaces = s.spaces.filter(
      (w) => w.customer === a.customer && w.sales === a.sales,
    );
    body.querySelector("#admit-spaces").innerHTML = spaces.length
      ? spaces
          .map(
            (w) =>
              '<div class="b3-space-row"><div><b>' +
              E(B.name("pools", w.pool, s)) +
              '</b><p class="b2-sub mono">' +
              E(w.id) +
              "</p></div>" +
              T.readyState(s, w) +
              T.link(
                w.status === "normal" ? "workspace" : "space-history",
                "查看",
                { id: w.id },
                "btn btn--sm",
              ) +
              "</div>",
          )
          .join("")
      : B.empty("尚未建立空间", "空间只在具备有效准入及装载条件后建立。");
    B.table(
      body.querySelector("#admit-history"),
      s.b3.admissions.filter(
        (x) => x.customer === a.customer && x.sales === a.sales,
      ),
      [
        ["提报时间", (x) => E(x.submitted)],
        ["来源", (x) => E(x.source)],
        ["结果", (x) => B.badge(labels[x.status])],
        ["原因 / 意见", (x) => E(x.reason || x.opinion || x.note || "无")],
      ],
      { search: false },
    );
    function decide(decision) {
      const v = Object.fromEntries(
        new FormData(body.querySelector("#admit-form")),
      );
      B.modal({
        title: decision === "approve" ? "确认准入通过" : "确认驳回准入",
        confirm: "确认提交",
        body: B.kv([
          ["客户", B.name("customers", a.customer, s)],
          ["组合销售", B.name("people", a.sales, s)],
          ["决定", decision === "approve" ? "通过" : "驳回"],
        ]),
        onConfirm: () => {
          T.decideAdmission(id, decision, v.reason, v.opinion, a.version);
          T.render();
          SC.toast("终审结果已记录，空间结果独立", "ok");
        },
      });
    }
    const handlers = {
      approve: () => decide("approve"),
      reject: () => decide("reject"),
    };
    B.actions(body, handlers);
    if (meta.footer) {
      const decisions = body.querySelector(".b3-decision-footer");
      if (decisions) {
        meta.footer.append(decisions);
        meta.footer.parentElement.hidden = false;
        B.actions(decisions, handlers);
      }
    }
  };
  T.views.solutionSubmit = function (body, actions, s, me) {
    const tab = SC.param("view") || "current",
      combos = T.visibleCombos(s, me);
    actions.innerHTML = T.link("solution-pool", "返回我的客户池", {}, "btn");
    body.innerHTML =
      '<div id="sol-submit-tabs"></div><div id="sol-submit-body"></div>';
    B.tabs(
      body.querySelector("#sol-submit-tabs"),
      [
        ["current", "当前可见组合", combos.length],
        [
          "mine",
          "本人提报记录",
          s.b3.admissions.filter((a) => a.actor === me.id).length,
        ],
      ],
      tab,
      (v) => {
        T.setQuery({ view: v });
        T.render();
      },
    );
    const root = body.querySelector("#sol-submit-body");
    if (tab === "mine") {
      const mine = s.b3.admissions
        .filter((a) => a.actor === me.id)
        .map((a) => {
          const c = s.combos.find((c) => c.id === a.combo),
            allowed = T.canCombo(s, c, me);
          return {
            id: a.id,
            submitted: a.submitted,
            status: a.status,
            title: allowed ? T.scopeTitle(s, c) : "本人历史提报",
            combo: allowed ? c.id : "",
            note: allowed ? a.note : "",
            allowed,
          };
        });
      B.table(
        root,
        mine,
        [
          ["提报记录", (a) => E(a.title)],
          ["提交时间", (a) => E(a.submitted)],
          ["结果", (a) => B.badge(labels[a.status])],
          [
            "当前范围",
            (a) => (a.allowed ? "本池有权查看" : "仅保留本人提报状态"),
          ],
          [
            "操作",
            (a) =>
              a.combo
                ? T.link(
                    "combo-detail",
                    "查看组合",
                    { id: a.combo },
                    "btn btn--sm",
                  )
                : "只读结果",
          ],
        ],
        {
          key: "sol-mine-" + me.id,
          searchText: (a) => a.title + a.submitted + labels[a.status],
        },
      );
      return;
    }
    root.innerHTML =
      T.bodyNote("提报单位：所列销售在该客户下的完整经营组合。") +
      '<div id="sol-submit-table"></div>';
    B.table(
      root.querySelector("#sol-submit-table"),
      combos,
      [
        [
          "客户 / 销售",
          (c) =>
            B.entity(
              B.name("customers", c.customer, s),
              B.name("people", c.sales, s),
              "building",
              T.href("combo-detail", { id: c.id }),
            ),
        ],
        ["本池可见商机", (c) => T.comboOpps(s, c, me).length],
        ["准入状态", (c) => T.admitBadge(c)],
        [
          "当前可提交情况",
          (c) =>
            E(
              c.admit === "已通过"
                ? "已通过准入"
                : T.pendingAdmission(s, c)
                  ? "已有进行中提报"
                  : T.admitError(s, c) || "可提报",
            ),
        ],
        ["操作", (c) => !T.admitError(s,c) && c.admit !== '已通过' && !T.pendingAdmission(s,c) ? B.btn("提报", "submit", c.id, "check", "btn--sm") : '<span class="u-t2">'+E(c.admit === '已通过' ? '已准入' : T.pendingAdmission(s,c) ? '已有提报' : '当前不可提报')+'</span>'],
      ],
      {
        key: "sol-current-" + me.id,
        select: true,
        batchLabel: "批量提报",
        eligible: (c) =>
          !T.admitError(s, c) &&
          c.admit !== "已通过" &&
          !T.pendingAdmission(s, c),
        onBatch: (ids) => T.submitModal(ids),
        searchText: (c) => T.scopeTitle(s, c),
        emptyTitle: me.pool ? "暂无本池可见组合" : "尚未分配客户池",
        emptyReason: me.pool
          ? "本池暂无符合激活与承接条件的商机。"
          : "需由超级管理员分配客户池。",
      },
    );
    B.actions(root, { submit: (id) => T.submitModal([id]) });
  };
})(window.SC, window.SC.B2, window.SC.B3);
