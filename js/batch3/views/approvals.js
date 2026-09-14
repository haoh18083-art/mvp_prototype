(function (SC, B, T) {
  const E = B.e;
  const reqName = (s, r) =>
    r.customer ? B.name("customers", r.customer, s) : r.name;
  let approvalDrawer = null;
  T.syncApprovalDrawer = function ({ state = B.load(), valid = true } = {}) {
    const id = SC.param("request"), me = T.me(state);
    if (!valid || !id || !me || me.role !== "ADM" || me.status !== "on") {
      approvalDrawer?.drawer.close(true);
      return;
    }
    let entry = approvalDrawer;
    if (!entry || entry.id !== id || entry.drawer.closed || !entry.drawer.root.isConnected) {
      approvalDrawer = null;
      entry?.drawer.close(true);
      entry = { id };
      entry.drawer = B.drawer({
        title: "客保审批详情",
        width: "min(760px, 100vw)",
        footer: '<div class="verdict-approval-actions"></div>',
        onClose: () => {
          if (approvalDrawer !== entry) return;
          approvalDrawer = null;
          if (SC.param("request") === id) T.setQuery({ request: "" });
          const row = [...document.querySelectorAll("#verdict-body tr[data-id], #all-approval-records tr[data-id]")]
            .find((node) => node.dataset.id === id);
          (row?.querySelector("a.btn") || document.querySelector("#verdict-body [data-search], #all-approval-records [data-search]"))?.focus();
        },
      });
      entry.drawer.root.classList.add("verdict-approval-drawer");
      approvalDrawer = entry;
    }
    // Keep the drawer mounted while decisions refresh the desk below it.
    document.body.classList.add("b2-drawer-lock");
    const content = document.createElement("div"),
      footer = entry.drawer.root.querySelector(".verdict-approval-actions");
    content.className = "verdict-approval-content";
    entry.drawer.body.replaceChildren(content);
    footer.replaceChildren();
    footer.parentElement.hidden = true;
    T.views.approvalDetail(content, document.createElement("div"), state, me, {
      view: "approvalDetail", requestId: id, footer,
    });
  };
  function wireApprovalDrawers(root) {
    root.querySelectorAll('a[href^="verdict.html?"], a[href^="approval-records.html?"]').forEach((link) => {
      const id = new URL(link.href).searchParams.get("request");
      if (!id) return;
      link.setAttribute("aria-haspopup", "dialog");
      link.onclick = (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        T.setQuery({ request: id });
        T.syncApprovalDrawer();
      };
    });
  }
  const reqCols = (s, page) => [
    [
      "客户 / 申请",
      (r) => B.entity(reqName(s, r), r.id, "file", T.href(page, { id: r.id })),
    ],
    [
      "当前申请类型",
      (r) =>
        E(T.types[r.type]) +
        (r.originalType !== r.type
          ? '<p class="b2-sub">原始：' + E(T.types[r.originalType]) + "</p>"
          : ""),
    ],
    ["申请销售", (r) => E(B.name("people", r.actor, s))],
    [
      "处理单位",
      (r) =>
        r.first
          ? "首批整单 · " + r.products.length + " 个产品"
          : "逐商机 · " + r.items.length + " 条",
    ],
    [
      "进度",
      (r) =>
        T.requestBadge(r) +
        (r.first
          ? ""
          : '<p class="b2-sub">剩余 ' +
            r.items.filter((i) => i.status === "pending").length +
            " 条</p>"),
    ],
    ["提交时间", (r) => E(r.submitted)],
    ["操作", (r) => T.link(page, "查看详情", { id: r.id }, "btn btn--sm")],
  ];
  T.views.verdict = function (body, actions, s) {
    const tab = SC.param("view") || "requests",
      pending = s.b3.requests.filter((r) =>
        ["pending", "partial"].includes(T.requestState(r)),
      );
    // 审批记录 / 办理交接 已移入左侧「客保裁决台」父子菜单，页面顶部不再放按钮。
    actions.innerHTML = "";
    body.innerHTML =
      B.strip([
        [
          "首批整单",
          pending.filter((r) => r.first).length,
          "全部产品一次生效",
          "file",
        ],
        [
          "后续客保",
          pending.filter((r) =>
            ["new", "claim", "join", "dispute", "sea"].includes(r.type),
          ).length,
          "按商机逐条确认",
          "box",
        ],
        [
          "释放与恢复",
          pending.filter((r) => ["release", "restore"].includes(r.type)).length,
          "经营结果与归属分开",
          "gavel",
        ],
        [
          "待交接销售",
          new Set(
            s.opps
              .filter((o) => B.find("people", o.sales, s)?.status === "off")
              .map((o) => o.sales),
          ).size,
          "账号停用不等于释放",
          "users",
        ],
      ]) + '<div id="verdict-tabs"></div><div id="verdict-body"></div>';
    B.tabs(
      body.querySelector("#verdict-tabs"),
      [
        ["requests", "申请审批"],
        ["manage", "管理处置"],
        ["handover", "交接"],
      ],
      tab,
      (v) => {
        T.setQuery({ view: v, request: "" });
        T.render();
      },
    );
    const root = body.querySelector("#verdict-body");
    if (tab === "requests")
      B.table(root, pending, reqCols(s, "approval-detail"), {
        key: "verdict",
        onDraw: wireApprovalDrawers,
        searchText: (r) => r.id + reqName(s, r) + B.name("people", r.actor, s),
        filters: [
          { key: "type", label: "申请类型", options: Object.entries(T.types) },
          {
            key: "cross",
            label: "受理范围",
            value: (r) => (T.cross(s, r.customer, r.actor) ? "cross" : "local"),
            options: [
              ["local", "未跨组 / 固定受理"],
              ["cross", "跨组"],
            ],
          },
        ],
      });
    else if (tab === "manage") {
      // 三个原三级子页（空余商机分配 / 公海与释放候选 / 来源冲突确认）就地切换为 tab 表格。
      const me = T.me(s),
        m = SC.param("m") || "direct";
      root.innerHTML = '<div id="manage-tabs"></div><div id="manage-body"></div>';
      B.tabs(
        root.querySelector("#manage-tabs"),
        [
          [
            "direct",
            "空余商机分配",
            s.opps.filter((o) => !o.sales && !o.sourceSales).length,
          ],
          [
            "seas",
            "公海与释放候选",
            s.customers.filter((c) => T.seaEligible(s, c)).length,
          ],
          [
            "source",
            "来源冲突确认",
            s.diffs.filter((d) => d.state === "待处理").length,
          ],
        ],
        m,
        (v) => {
          T.setQuery({ m: v, view: "manage", request: "", id: "", candidate: "" });
          T.render();
        },
      );
      const mbody = root.querySelector("#manage-body"),
        drop = document.createElement("div");
      if (m === "seas") T.views.seas(mbody, drop, s);
      else if (m === "source") T.views.source(mbody, drop, s);
      else T.views.direct(mbody, drop, s, me);
    } else {
      root.innerHTML = B.section("待分配与交接", '<div id="departures"></div>');
      B.table(
        root.querySelector("#departures"),
        s.people.filter(
          (p) =>
            (p.role === "SLS" && T.owned(s, undefined, p.id).length) ||
            (p.role === "SLS" && s.opps.some((o) => o.sales === p.id)),
        ),
        [
          ["销售", (p) => B.entity(p.name, p.id, "users")],
          ["账号", (p) => SC.state(p.status === "on")],
          ["归属商机", (p) => s.opps.filter((o) => o.sales === p.id).length],
          [
            "客户组",
            (p) =>
              new Set(
                s.opps.filter((o) => o.sales === p.id).map((o) => o.customer),
              ).size,
          ],
          [
            "操作",
            (p) =>
              T.link(
                "handover",
                p.status === "off" ? "处理待分配" : "办理交接",
                { sales: p.id },
                "btn btn--sm",
              ),
          ],
        ],
        {
          key: "departures",
          filters: [
            {
              key: "status",
              label: "账号状态",
              options: [
                ["off", "停用"],
                ["on", "启用"],
              ],
            },
          ],
        },
      );
    }
  };
  T.views.approvalList = function (body, actions, s) {
    const rows = s.b3.requests.filter(
      (r) =>
        T.canApprove(s, r) &&
        ["pending", "partial"].includes(T.requestState(r)),
    );
    actions.innerHTML = T.link("manager-assign", "直接分配空余商机", {}, "btn");
    body.innerHTML = '<div id="approval-list"></div>';
    B.table(
      body.querySelector("#approval-list"),
      rows,
      reqCols(s, "manager-approval"),
      {
        key: "manager-approvals",
        searchText: (r) => r.id + reqName(s, r),
        filters: [
          {
            key: "type",
            label: "申请类型",
            options: ["new", "claim", "join", "restore"].map((t) => [
              t,
              T.types[t],
            ]),
          },
        ],
        emptyTitle: "暂无本组可处理的客保申请",
      },
    );
  };
  T.views.requestList = function (body, actions, s, me, meta) {
    const admin = meta.view === "records",
      rows = s.b3.requests.filter((r) =>
        admin ? T.requestState(r) !== "pending" : r.actor === me.id,
      ),
      page = admin ? "approval-detail" : "my-request";
    actions.innerHTML = admin
      ? T.link("verdict", "返回裁决台", {}, "btn")
      : T.link("market", "查看商机市场", {}, "btn btn--primary");
    body.innerHTML = '<div id="request-list"></div>';
    B.table(body.querySelector("#request-list"), rows, reqCols(s, page), {
      key: admin ? "approval-records" : "my-requests-" + me.id,
      searchText: (r) => r.id + reqName(s, r),
      filters: [
        { key: "type", label: "申请类型", options: Object.entries(T.types) },
        {
          key: "status",
          label: "处理状态",
          value: (r) => T.requestState(r),
          options: Object.entries(T.reqLabels),
        },
      ],
    });
  };
  T.views.records = function (body, actions, s) {
    actions.innerHTML = "";
    const rows = s.b3.requests
      .filter((r) => T.requestState(r) !== "pending")
      .map((r) => ({
        id: r.id,
        customer: reqName(s, r),
        kind: "申请审批",
        type: T.types[r.type],
        by: r.by ? B.name("people", r.by, s) : "部分处理",
        at: r.at || r.submitted,
        result: T.reqLabels[T.requestState(r)],
        href: T.href("approval-records", { request: r.id }),
      }));
    s.b3.transfers.forEach((t) =>
      rows.push({
        id: t.id,
        customer: B.name("customers", t.customer, s),
        kind: "离职交接",
        type: "整组交接",
        by: B.name("people", t.by, s),
        at: t.at,
        result: "归属已生效，准入及空间另列",
        href: T.href("handover", { result: t.id }),
      }),
    );
    s.b3.events
      .filter((e) =>
        [
          "直接分配商机",
          "客户释放至公海",
          "来源冲突确认生效",
          "来源冲突驳回",
        ].includes(e.label),
      )
      .forEach((e) =>
        rows.push({
          id: e.id,
          customer: B.name("customers", e.customer, s),
          kind: "管理处置",
          type: e.label,
          by: e.by,
          at: e.at,
          result: "已记录实际结果",
          event: e,
        }),
      );
    rows.sort((a, b) => b.at.localeCompare(a.at));
    body.innerHTML = '<div id="all-approval-records"></div>';
    B.table(
      body.querySelector("#all-approval-records"),
      rows,
      [
        ["客户 / 记录", (r) => B.entity(r.customer, r.id, "file")],
        ["记录来源", (r) => E(r.kind)],
        ["业务动作", (r) => E(r.type)],
        ["实际决定人", (r) => E(r.by)],
        ["处理结果", (r) => E(r.result)],
        ["时间", (r) => E(r.at)],
        [
          "操作",
          (r) =>
            r.href
              ? '<a class="btn btn--sm" href="' + E(r.href) + '">查看详情</a>'
              : B.btn("查看记录", "event-record", r.id, "eye", "btn--sm"),
        ],
      ],
      {
        key: "all-approval-records",
        onDraw: wireApprovalDrawers,
        searchText: (r) => r.customer + r.type + r.by + r.id,
        filters: [
          {
            key: "kind",
            label: "记录来源",
            options: ["申请审批", "管理处置", "离职交接"],
          },
        ],
      },
    );
    B.actions(body, {
      "event-record": (id) => {
        const r = rows.find((r) => r.id === id);
        B.modal({
          title: r.type,
          wide: true,
          body: B.kv([
            ["客户", r.customer],
            ["记录类型", r.kind],
            ["决定人", r.by],
            ["时间", r.at],
            ["实际结果", r.event.text || r.type],
            ["关联商机", r.event.opp || "客户级事项"],
          ]),
        });
      },
    });
  };
  T.views.approvalDetail = function (body, actions, s, me, meta) {
    const own = meta.view === "myRequest",
      id =
        meta.requestId || SC.param("id") ||
        s.b3.requests.find((r) =>
          own
            ? r.actor === me.id
            : T.canApprove(s, r) && T.requestState(r) === "pending",
        )?.id,
      r = s.b3.requests.find((r) => r.id === id);
    if (!r || !T.canRequestView(s, r)) {
      body.innerHTML = B.empty("无可查看的申请", "当前身份不能查看该记录。");
      return;
    }
    const pending = ["pending", "partial"].includes(T.requestState(r)),
      can = !own && pending && T.canApprove(s, r),
      back = own
        ? "my-requests"
        : T.role === "MGR"
          ? "manager-approvals"
          : "verdict";
    actions.innerHTML = T.link(back, "返回申请清单", {}, "btn");
    body.innerHTML =
      '<div class="b3-scope"><span class="b2-entity__mark">' +
      SC.icon("file", 22) +
      '</span><div class="u-grow"><h2>' +
      E(reqName(s, r)) +
      '</h2><div class="scope-meta"><span>' +
      E(T.types[r.type]) +
      '</span><span class="mono">' +
      E(r.id) +
      "</span></div></div>" +
      T.requestBadge(r) +
      "</div>" +
      B.section(
        "申请信息",
        '<div class="b2-section__body">' +
          B.kv([
            ["申请人", B.name("people", r.actor, s)],
            ["归属销售", B.name("people", r.beneficiary, s)],
            ["提交时间", r.submitted],
            ["申请原因", r.reason || "首批产品合作"],
            ["原始类型", T.types[r.originalType]],
            ["实际处理人", r.by ? B.name("people", r.by, s) : "尚未处理"],
          ]) +
          "</div>",
      );
    if (r.originalType !== r.type)
      body.insertAdjacentHTML(
        "beforeend",
        T.bodyNote(
          "该客户已退出公海，当前按加入客户并认领受理；审批权限已按最新归属重新判断。",
          "warn",
        ),
      );
    if (r.first) {
      body.insertAdjacentHTML(
        "beforeend",
        B.section("首批整单产品", '<div id="first-products"></div>') +
          (can
            ? '<form class="b3-form" id="approval-form">' +
              (r.type === "first_new" &&
              T.matches(s, r.name).some((c) => c.match === "模糊")
                ? '<div class="b3-identity-check"><p>模糊命中：' +
                  E(
                    T.matches(s, r.name)
                      .map((c) => c.name)
                      .join("、"),
                  ) +
                  '</p><label class="b3-choice"><input type="checkbox" name="reviewDistinct"> 已核对并确认非同一客户</label></div>'
                : "") +
              B.field("整单确认客户池", "pool", r.suggested || "", {
                options: T.poolOptions(s),
              }) +
              B.field("整单驳回原因", "rejectReason", "", {
                options: T.options(T.reasons),
              }) +
              B.field("审批意见", "opinion", "", { area: true }) +
              '<p class="b2-error" role="alert"></p><div class="b3-decision-footer">' +
              B.btn("整单驳回", "first-reject", "", "x", "btn--danger") +
              B.btn("整单通过", "first-approve", "", "check", "btn--primary") +
              "</div></form>"
            : B.section(
                "整单结果",
                '<div class="b2-section__body">' +
                  B.kv([
                    ["结果", T.reqLabels[r.status]],
                    ["原因", r.reasonRejected || r.opinion || "无"],
                    ["生成商机", r.generated?.join("、") || "未生成"],
                    ["确认池", r.pool ? B.name("pools", r.pool, s) : "未生效"],
                  ]) +
                  "</div>",
              )),
      );
      B.table(
        body.querySelector("#first-products"),
        r.products.map((id) => B.find("products", id, s)).filter(Boolean),
        [
          ["产品", (p) => B.entity(p.name, p.id, "box")],
          [
            "激活状态",
            (p) =>
              B.badge(
                p.active ? "已激活" : "未激活",
                p.active ? "green" : "amber",
              ),
          ],
          ["计费类型", (p) => E(p.billing || "未维护")],
        ],
        { search: false },
      );
    } else {
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "商机条目",
          '<form id="approval-form">' +
            r.items
              .map((i) => {
                const o = i.opp && B.find("opps", i.opp, s),
                  done = i.status !== "pending",
                  poolRead = ["restore", "release"].includes(r.type);
                return (
                  '<div class="b3-approval-row' +
                  (done ? " is-done" : "") +
                  '"><div><b>' +
                  E(B.name("products", i.product, s)) +
                  '</b><p class="b2-sub">' +
                  E(i.opp || "待创建商机") +
                  '</p><p class="b2-sub">当前：' +
                  E(o ? SC.OPP_RESULT[o.result] : "尚未建立") +
                  "</p>" +
                  (i.opp
                    ? T.link(
                        "opportunity",
                        "查看商机",
                        { id: i.opp },
                        "btn--link",
                      )
                    : "") +
                  "</div>" +
                  (can && !done
                    ? B.field("审批结果", i.id + "-decision", "", {
                        options: [
                          ["", "暂不处理"],
                          ["approve", "通过"],
                          ["reject", "驳回"],
                        ],
                      }) +
                      (poolRead
                        ? '<div><span class="field__label">当前客户池</span><p>' +
                          E(o?.pool ? B.name("pools", o.pool, s) : "未指定") +
                          "</p></div>"
                        : B.field("确认客户池", i.id + "-pool", "", {
                            options: T.poolOptions(s),
                          })) +
                      B.field("驳回原因", i.id + "-reason", "", {
                        options: T.options(T.reasons),
                      })
                    : "<div>" +
                      B.badge(
                        T.reqLabels[i.status],
                        i.status === "approved"
                          ? "green"
                          : i.status === "rejected"
                            ? "red"
                            : "amber",
                      ) +
                      "</div><div>" +
                      E(
                        i.pool
                          ? B.name("pools", i.pool, s)
                          : o?.pool
                            ? B.name("pools", o.pool, s)
                            : "未指定",
                      ) +
                      "</div><div>" +
                      E(i.reason || i.opinion || "等待处理") +
                      "</div>") +
                  "</div>"
                );
              })
              .join("") +
            (can
              ? '<div class="b3-decision-footer">' +
                B.btn("确认本次处理", "process", "", "check", "btn--primary") +
                "</div>"
              : "") +
            '<p class="b2-error" role="alert"></p></form>',
        ),
      );
    }
    if (
      own &&
      (r.status === "rejected" || r.items.some((i) => i.status === "rejected"))
    )
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "再次申请",
          '<div class="b2-section__body">' +
            T.link(
              "request-form",
              "重新填写申请",
              {
                type: r.type,
                customer: r.customer,
                previous: r.id,
                opps: r.items
                  .filter((i) => i.status === "rejected")
                  .map((i) => i.opp)
                  .join(","),
                products: r.products?.join(",") || "",
              },
              "btn btn--primary",
            ) +
            "</div>",
        ),
      );
    if (r.customer) {
      const c = T.combo(s, r.customer, r.beneficiary);
      if (c && T.canCombo(s, c))
        body.insertAdjacentHTML(
          "beforeend",
          B.section(
            "当前经营状态",
            '<div class="b2-section__body">' +
              B.kv([
                ["准入", c.admit],
                [
                  "当前空间",
                  s.spaces.filter(
                    (w) =>
                      w.customer === c.customer &&
                      w.sales === c.sales &&
                      w.status === "normal",
                  ).length,
                ],
              ]) +
              T.link(
                "combo-detail",
                "查看经营组合",
                { id: c.id },
                "btn u-mt4",
              ) +
              "</div>",
          ),
        );
    }
    const snapshots = r.items.filter((i) => i.before && i.after);
    if (snapshots.length)
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "本次生效时关系快照",
          '<div class="b2-section__body">' +
            snapshots
              .map(
                (i) =>
                  '<div class="b3-record"><h3>' +
                  E(B.name("products", i.product, s)) +
                  "</h3>" +
                  SC.snapshot([
                    {
                      k: "归属销售",
                      before: i.before.sales
                        ? B.name("people", i.before.sales, s)
                        : "空余",
                      after: i.after.sales
                        ? B.name("people", i.after.sales, s)
                        : "空余",
                    },
                    {
                      k: "客户池",
                      before: B.name("pools", i.before.pool, s),
                      after: B.name("pools", i.after.pool, s),
                    },
                    {
                      k: "经营结果",
                      before: SC.OPP_RESULT[i.before.result],
                      after: SC.OPP_RESULT[i.after.result],
                    },
                  ]) +
                  "</div>",
              )
              .join("") +
            "</div>",
        ),
      );
    const execute = (decisions, title) =>
      B.modal({
        title,
        confirm: "确认提交",
        body: B.kv([
          ["客户", reqName(s, r)],
          ["处理单位", r.first ? "整单一次生效" : "商机逐条生效"],
          ["本次处理", decisions.length + " 项"],
        ]),
        onConfirm: () => {
          const rows = T.decideRequest(r.id, decisions, r.version);
          T.render();
          B.results(rows, "审批处理结果");
        },
      });
    const handlers = {
      "first-approve": () => {
        const v = Object.fromEntries(
          new FormData(body.querySelector("#approval-form")),
        );
        execute(
          [
            {
              decision: "approve",
              pool: v.pool,
              opinion: v.opinion,
              distinct: v.reviewDistinct === "on",
            },
          ],
          "确认整单通过",
        );
      },
      "first-reject": () => {
        const v = Object.fromEntries(
          new FormData(body.querySelector("#approval-form")),
        );
        execute(
          [{ decision: "reject", reason: v.rejectReason, opinion: v.opinion }],
          "确认整单驳回",
        );
      },
      process: () => {
        const v = Object.fromEntries(
            new FormData(body.querySelector("#approval-form")),
          ),
          rows = r.items
            .filter((i) => i.status === "pending" && v[i.id + "-decision"])
            .map((i) => ({
              id: i.id,
              decision: v[i.id + "-decision"],
              pool: v[i.id + "-pool"],
              reason: v[i.id + "-reason"],
            }));
        if (!rows.length) {
          T.error(
            body.querySelector("#approval-form"),
            "请选择至少一条处理结果",
          );
          return;
        }
        execute(rows, "确认商机处理");
      },
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
  T.views.myRequest = T.views.approvalDetail;
  T.views.direct = function (body, actions, s, me) {
    const rows = s.opps.filter((o) => !o.sales && !o.sourceSales);
    actions.innerHTML = T.link(
      me.role === "MGR" ? "manager-approvals" : "verdict",
      "返回客保",
      {},
      "btn",
    );
    body.innerHTML = '<div id="free-table"></div>';
    B.table(
      body.querySelector("#free-table"),
      rows,
      T.oppColumns(s, { market: true, action: false }),
      {
        key: "direct-" + me.id,
        select: true,
        batchLabel: "安排承接销售",
        onBatch: (ids) => {
          B.modal({
            title: "直接分配空余商机",
            wide: true,
            confirm: "确认分配",
            body:
              "<form>" +
              ids
                .map(
                  (id) =>
                    '<div class="b3-form-block"><h3>' +
                    E(B.find("opps", id, s).name) +
                    '</h3><div class="b3-form-grid">' +
                    B.field("承接销售", id + "-sales", "", {
                      options: T.peopleOptions(s, me.role === "MGR"),
                      required: true,
                    }) +
                    B.field("客户池", id + "-pool", "", {
                      options: T.poolOptions(s),
                      required: true,
                    }) +
                    "</div></div>",
                )
                .join("") +
              "</form>" +
              T.bodyNote(
                "分配即时生效，不生成销售申请；已结束商机保留原经营结果。",
              ),
            onConfirm: (root) => {
              const v = Object.fromEntries(
                new FormData(root.querySelector("form")),
              );
              const result = T.directAssign(
                ids.map((id) => ({
                  id,
                  sales: v[id + "-sales"],
                  pool: v[id + "-pool"],
                })),
              );
              T.render();
              B.results(result, "直接分配结果");
            },
          });
        },
        searchText: (o) => o.name + o.id,
      },
    );
  };
  T.views.seas = function (body, actions, s) {
    const tab = SC.param("sea") || "sea";
    actions.innerHTML = T.link("verdict", "返回裁决台", {}, "btn");
    body.innerHTML = '<div id="sea-tabs"></div><div id="sea-table"></div>';
    B.tabs(
      body.querySelector("#sea-tabs"),
      [
        [
          "sea",
          "公海客户",
          s.customers.filter((c) => c.sea && !c.merged).length,
        ],
        [
          "candidates",
          "可释放候选",
          s.customers.filter((c) => T.seaEligible(s, c)).length,
        ],
      ],
      tab,
      (v) => {
        T.setQuery({ sea: v });
        T.render();
      },
    );
    B.table(
      body.querySelector("#sea-table"),
      s.customers.filter((c) =>
        tab === "sea" ? c.sea && !c.merged : T.seaEligible(s, c),
      ),
      [
        [
          "客户",
          (c) =>
            B.entity(
              c.name,
              c.id,
              "building",
              T.href("customer-detail", { id: c.id }),
            ),
        ],
        ["当前归属商机", (c) => T.owned(s, c.id).length],
        [
          "可领取商机",
          (c) =>
            s.opps.filter(
              (o) =>
                o.customer === c.id &&
                !o.sales &&
                !o.sourceSales &&
                T.active(s, o),
            ).length,
        ],
        [
          "公海状态",
          (c) =>
            B.badge(c.sea ? "已在公海" : "仅为候选", c.sea ? "brand" : "amber"),
        ],
        ["进入时间", (c) => E(c.seaAt || "尚未进入")],
        ["原销售", (c) => E(T.formerSales(s, c.id) || "—")],
        [
          "操作",
          (c) =>
            c.sea
              ? T.link("verdict", "查看领取审批", {}, "btn btn--sm")
              : B.btn(
                  "释放至公海",
                  "release-customer",
                  c.id,
                  "inbox",
                  "btn--sm",
                ),
        ],
      ],
      { key: "seas-" + tab },
    );
    B.actions(body, {
      "release-customer": (id) =>
        B.modal({
          title: "确认客户进入公海",
          danger: true,
          confirm: "确认释放",
          body:
            B.kv([
              ["客户", B.name("customers", id, s)],
              ["当前归属商机", T.owned(s, id).length],
            ]) +
            '<form class="u-mt4">' +
            B.field("释放原因", "reason", "", { required: true, area: true }) +
            "</form>",
          onConfirm: (root) => {
            T.releaseCustomer(id, B.values(root).reason);
            T.render();
            SC.toast("客户已进入公海，历史保留", "ok");
          },
        }),
    });
  };
  T.views.source = function (body, actions, s) {
    const id = SC.param("id"),
      d =
        s.diffs.find((d) => d.id === id || d.opp === id) ||
        (!id ? s.diffs.find((d) => d.opp) : null);
    if (SC.param("candidate")) {
      const m = B.find("merges", SC.param("candidate"), s);
      actions.innerHTML = T.link(
        "customer-merge",
        "返回主体核对",
        { id: SC.param("candidate") },
        "btn",
      );
      body.innerHTML = m
        ? B.section(
            "来源商机待核对",
            '<div class="b2-section__body">' +
              B.kv([
                ["客户", m.name],
                ["主体结果", m.state],
                ["来源商机", m.sourceOpps + " 条"],
                ["当前结果", m.outcome || "来源尚未开放经营"],
              ]) +
              T.bodyNote(
                "须定位具体来源商机与原有业务关系后才能确认，不将候选审批成第二条并行经营商机。",
                "warn",
              ) +
              T.link("sync-detail", "查看来源接入记录", {}, "btn") +
              "</div>",
          )
        : B.empty("来源事项不存在");
      return;
    }
    actions.innerHTML = T.link("source-diffs", "返回来源差异", {}, "btn");
    body.innerHTML = B.section("来源事项", '<div id="source-list"></div>');
    B.table(
      body.querySelector("#source-list"),
      s.diffs,
      [
        ["客户", (d) => E(B.name("customers", d.customer, s))],
        ["差异字段", (d) => E(d.field)],
        ["当前处理", (d) => B.badge(d.state)],
        [
          "操作",
          (d) => B.btn("核对", "review-source", d.id, "eye", "btn--sm"),
        ],
      ],
      { search: false },
    );
    B.actions(body, {
      "review-source": (rid) => {
        T.setQuery({ id: rid, view: "manage", m: "source" });
        T.render();
      },
    });
    if (!d) return;
    const o = B.find("opps", d.opp, s);
    body.insertAdjacentHTML(
      "beforeend",
      B.section(
        "关系对比",
        '<div class="b2-section__body">' +
          B.kv([
            ["原来源", d.before],
            ["最新来源", d.source || "明确清空"],
            ["当前本地", o ? B.name("people", o.sales, s) : d.local],
            ["相关商机", o?.id || "尚未定位"],
            ["经营结果", o ? SC.OPP_RESULT[o.result] : "客户资料"],
            ["进行中事项", o ? SC.OPP_PENDING[o.pending] : "无"],
          ]) +
          "</div>",
      ),
    );
    if (!o || d.state === "已处理") {
      body.insertAdjacentHTML(
        "beforeend",
        T.bodyNote(
          o
            ? "该事项已处理，当前结果只读。"
            : "此项不是已明确的商机关联冲突，请在来源差异或主体核对中处理。",
        ),
      );
      return;
    }
    body.insertAdjacentHTML(
      "beforeend",
      '<form class="b3-form" id="source-form">' +
        B.field("确认类型", "kind", "sales", {
          options: [
            ["sales", "销售归属变更"],
            ["customer", "客户关联纠正"],
            ["product", "产品关联纠正"],
          ],
        }) +
        '<div class="b3-form-grid">' +
        B.field("目标销售", "sales", "", { options: T.peopleOptions(s) }) +
        B.field("确认客户池", "pool", "", { options: T.poolOptions(s) }) +
        B.field("目标客户", "targetCustomer", "", {
          options: T.options(
            s.customers.filter((c) => !c.merged).map((c) => [c.id, c.name]),
          ),
        }) +
        B.field("目标产品", "targetProduct", "", {
          options: T.options(s.products.map((p) => [p.id, p.name])),
        }) +
        "</div>" +
        B.field("确认原因", "reason", "", { required: true, area: true }) +
        '<p class="b2-error" role="alert"></p><div class="b3-decision-footer">' +
        B.btn("驳回来源变更", "reject-source", "", "x", "btn--danger") +
        B.btn("确认通过", "approve-source", "", "check", "btn--primary") +
        "</div></form>",
    );
    const sourceForm = body.querySelector("#source-form");
    const updateKind = () => {
      const kind = sourceForm.querySelector("[name=kind]").value;
      for (const name of ["sales", "pool", "targetCustomer", "targetProduct"]) {
        const field = sourceForm.querySelector('[name="' + name + '"]');
        field.closest(".field").hidden =
          name === "sales" || name === "pool"
            ? kind !== "sales"
            : name === "targetCustomer"
              ? kind !== "customer"
              : kind !== "product";
      }
    };
    sourceForm.querySelector("[name=kind]").onchange = updateKind;
    updateKind();
    function decide(decision) {
      const form = body.querySelector("#source-form");
      if (!form.reportValidity()) return;
      const v = Object.fromEntries(new FormData(form));
      v.decision = decision;
      v.target = v.kind === "customer" ? v.targetCustomer : v.targetProduct;
      B.modal({
        title: "确认来源冲突结果",
        confirm: "确认提交",
        body: B.kv([
          ["商机", o.id],
          ["决定", decision === "reject" ? "驳回" : "通过"],
          ["原因", v.reason],
        ]),
        onConfirm: () => {
          T.sourceDecision(d.id, v, o.version);
          T.render();
          SC.toast("来源事项已更新", "ok");
        },
      });
    }
    B.actions(body, {
      "reject-source": () => decide("reject"),
      "approve-source": () => decide("approve"),
    });
  };
})(window.SC, window.SC.B2, window.SC.B3);
