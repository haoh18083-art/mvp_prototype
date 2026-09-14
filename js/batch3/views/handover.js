(function (SC, B, T) {
  const E = B.e;
  T.views.handover = function (body, actions, s) {
    const result = s.b3.transfers.find((t) => t.id === SC.param("result"));
    actions.innerHTML = "";
    if (result) {
      body.innerHTML =
        '<div class="b3-scope"><div class="u-grow"><h2>' +
        E(B.name("customers", result.customer, s)) +
        '</h2><div class="scope-meta"><span>原销售：' +
        E(B.name("people", result.source, s)) +
        "</span><span>" +
        E(result.at) +
        "</span></div></div>" +
        B.badge("整组客保已生效", "green") +
        "</div>" +
        B.section("一、商机归属结果", '<div id="transfer-opps"></div>') +
        B.section(
          "二、目标准入结果",
          '<div class="b2-section__body">' +
            result.admissions
              .map(
                (a) =>
                  '<div class="b3-result-level"><b>' +
                  E(B.name("people", a.sales, s)) +
                  '</b><p class="u-mt2">' +
                  E(a.result) +
                  '</p><div class="b2-actions u-mt3">' +
                  (a.pending
                    ? T.link(
                        "admission-detail",
                        "继续原普通终审",
                        { id: a.pending },
                        "btn btn--sm",
                      )
                    : "") +
                  T.link(
                    "combo-detail",
                    "查看目标组合",
                    { id: a.combo },
                    "btn btn--sm",
                  ) +
                  "</div></div>",
              )
              .join("") +
            "</div>",
        ) +
        B.section(
          "三、各原池空间与历史授权",
          '<div class="b2-section__body">' +
            result.spaces
              .map(
                (w) =>
                  '<div class="b3-result-level"><h3>' +
                  E(w.pool ? B.name("pools", w.pool, s) : "无原空间") +
                  "</h3><p>" +
                  E(w.result) +
                  '</p><p class="b2-sub">承接人：' +
                  E(
                    w.targets.map((p) => B.name("people", p, s)).join("、") ||
                      "无",
                  ) +
                  "</p>" +
                  (w.id
                    ? T.link(
                        B.find("spaces", w.id, s)?.status === "normal"
                          ? "workspace"
                          : "space-history",
                        "查看原空间结果",
                        { id: w.id },
                        "btn btn--sm u-mt3",
                      )
                    : "") +
                  "</div>",
              )
              .join("") +
            "</div>",
        ) +
        B.section(
          "四、账号状态",
          '<div class="b2-section__body">' +
            B.kv([
              [
                "原销售账号",
                B.find("people", result.source, s)?.status === "on"
                  ? "仍为启用"
                  : "仍为停用",
              ],
              ["交接结果", "不自动启停账号，不重复转移已完成归属"],
            ]) +
            T.link(
              "handover",
              "继续其他客户组",
              { sales: result.source },
              "btn u-mt4",
            ) +
            "</div>",
        );
      B.table(
        body.querySelector("#transfer-opps"),
        result.rows,
        [
          ["商机", (r) => E(B.find("opps", r.id, s)?.name || r.id)],
          [
            "承接销售",
            (r) => E(r.sales ? B.name("people", r.sales, s) : "已依法释放"),
          ],
          ["原池沿用", (r) => E(B.name("pools", r.pool, s))],
          ["经营结果保留", (r) => B.badge(SC.OPP_RESULT[r.result])],
          [
            "操作",
            (r) =>
              T.link("opportunity", "当前商机", { id: r.id }, "btn btn--sm"),
          ],
        ],
        { search: false },
      );
      return;
    }
    const source = SC.param("sales") || "U-1007",
      person = B.find("people", source, s),
      owned = s.opps.filter((o) => o.sales === source),
      groups = [...new Set(owned.map((o) => o.customer))],
      customer = SC.param("customer") || groups[0];
    body.innerHTML =
      '<div class="b3-form">' +
      B.field("原销售", "source", source, {
        options: T.options(
          s.people
            .filter((p) => p.role === "SLS")
            .map((p) => [
              p.id,
              p.name + " · " + (p.status === "on" ? "启用" : "停用"),
            ]),
        ),
      }) +
      "</div>" +
      B.strip([
        ["待交接客户组", groups.length],
        ["归属商机", owned.length, "包含已结束与未激活"],
        [
          "原账号",
          person?.status === "on" ? "启用" : "停用",
          "交接不改变账号状态",
        ],
        [
          "已完成客户组",
          s.b3.transfers.filter((t) => t.source === source).length,
        ],
      ]) +
      B.section("选择客户组", '<div id="handover-groups"></div>');
    body.querySelector("[name=source]").onchange = (e) =>
      (location.href = T.href("handover", { sales: e.target.value }));
    B.table(
      body.querySelector("#handover-groups"),
      groups.map((id) => ({ id, name: B.name("customers", id, s) })),
      [
        ["客户", (c) => E(c.name)],
        ["全部归属商机", (c) => T.owned(s, c.id, source).length],
        [
          "进行中商机事项",
          (c) =>
            T.owned(s, c.id, source).filter((o) => o.pending !== "none").length,
        ],
        [
          "操作",
          (c) =>
            T.link(
              "handover",
              "查看与安排",
              { sales: source, customer: c.id },
              "btn btn--sm",
            ),
        ],
      ],
      {
        key: "handover-groups-" + source,
        emptyTitle: "暂无待交接商机",
        emptyReason: "已完成归属转移的记录不会重复进入待办理组。",
      },
    );
    const rows = T.owned(s, customer, source),
      versions = Object.fromEntries(rows.map((o) => [o.id, o.version]));
    if (rows.length) {
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          B.name("customers", customer, s) + " · 整组安排",
          '<form id="handover-form">' +
            rows
              .map(
                (o) =>
                  '<div class="b3-approval-row"><div><b>' +
                  E(B.name("products", o.product, s)) +
                  '</b><p class="b2-sub">' +
                  E(o.id) +
                  " · " +
                  E(SC.OPP_RESULT[o.result]) +
                  '</p><p class="b2-sub">' +
                  E(o.pool ? B.name("pools", o.pool, s) : "未分池") +
                  "</p>" +
                  (o.pending !== "none" ? B.badge("存在互斥事项", "red") : "") +
                  "</div>" +
                  B.field("承接销售或释放", o.id + "-sales", "", {
                    options: [
                      ["", "待安排"],
                      ...s.people
                        .filter(
                          (p) =>
                            p.role === "SLS" &&
                            p.status === "on" &&
                            p.id !== source,
                        )
                        .map((p) => [p.id, p.name + " · " + p.group]),
                      ["release", "依法释放为空余"],
                    ],
                  }) +
                  '<div><span class="field__label">客户池</span><p>' +
                  E(B.name("pools", o.pool, s)) +
                  "</p></div>" +
                  B.field("释放时必填原因", o.id + "-reason", "") +
                  "</div>",
              )
              .join("") +
            "</form>",
        ) +
          B.section(
            "承接准入 · 独立决定",
            '<div id="handover-admit" class="b2-section__body"></div>',
          ) +
          B.section(
            "各原池空间",
            '<div class="b2-section__body">' +
              B.kv(
                s.spaces
                  .filter((w) => w.customer === customer && w.sales === source)
                  .map((w) => [
                    B.name("pools", w.pool, s),
                    SC.SPACE_STATES[w.status].label + " · " + w.id,
                  ]),
              ) +
              "</div>",
          ) +
          '<p class="b2-error" role="alert"></p><div class="b3-decision-footer">' +
          B.btn(
            "核对并确认整组交接",
            "confirm-transfer",
            "",
            "check",
            "btn--primary",
          ) +
          "</div>",
      );
      const form = body.querySelector("#handover-form"),
        admitRoot = body.querySelector("#handover-admit");
      let draft = {};
      function renderTargets() {
        if (admitRoot.querySelector("form"))
          draft = {
            ...draft,
            ...Object.fromEntries(
              new FormData(admitRoot.querySelector("form")),
            ),
          };
        const values = Object.fromEntries(new FormData(form)),
          targets = [
            ...new Set(
              rows
                .map((o) => values[o.id + "-sales"])
                .filter((v) => v && v !== "release"),
            ),
          ];
        admitRoot.innerHTML = targets.length
          ? "<form>" +
            targets
              .map((sales) => {
                const c = T.combo(s, customer, sales),
                  pending = T.pendingAdmission(s, c);
                return (
                  '<div class="b3-transfer-target"><div><h3>' +
                  E(B.name("people", sales, s)) +
                  '</h3><p class="b2-sub">' +
                  E(B.name("customers", customer, s)) +
                  "</p></div>" +
                  (c?.admit === "已通过"
                    ? "<div>" + B.badge("引用本轮有效准入", "green") + "</div>"
                    : pending
                      ? "<div>" +
                        B.badge("普通准入待办处理中", "amber") +
                        '<p class="b2-sub">继续原待办，交接页不另批准入。</p>' +
                        T.link(
                          "admission-detail",
                          "查看原普通终审",
                          { id: pending.id },
                          "btn btn--sm u-mt3",
                        ) +
                        "</div>"
                      : "<div>" +
                        B.field(
                          "本次独立准入",
                          sales + "-admit",
                          draft[sales + "-admit"] || "none",
                          {
                            options: [
                              ["none", "暂不确认"],
                              ["approve", "确认通过"],
                              ["reject", "确认驳回"],
                            ],
                          },
                        ) +
                        B.field(
                          "准入驳回原因",
                          sales + "-admit-reason",
                          draft[sales + "-admit-reason"] || "",
                        ) +
                        "</div>") +
                  "</div>"
                );
              })
              .join("") +
            "</form>"
          : B.empty("尚未明确承接销售", "先确定该组每条商机的去向。");
      }
      form
        .querySelectorAll("select")
        .forEach((el) => (el.onchange = renderTargets));
      renderTargets();
      B.actions(body, {
        "confirm-transfer": () => {
          const values = Object.fromEntries(new FormData(form)),
            admitValues = admitRoot.querySelector("form")
              ? Object.fromEntries(
                  new FormData(admitRoot.querySelector("form")),
                )
              : {},
            choices = {},
            admissions = {};
          rows.forEach((o) => {
            choices[o.id] = {
              sales: values[o.id + "-sales"],
              reason: values[o.id + "-reason"],
            };
            const target = values[o.id + "-sales"];
            if (target && target !== "release")
              admissions[target] = {
                decision: admitValues[target + "-admit"] || "none",
                reason: admitValues[target + "-admit-reason"] || "",
              };
          });
          if (rows.some((o) => !choices[o.id].sales)) {
            T.error(body, "每条商机必须明确承接销售或释放去向");
            return;
          }
          B.modal({
            title: "确认整组客保交接",
            wide: true,
            confirm: "确认整组生效",
            body:
              B.kv([
                ["原销售", person.name],
                ["客户", B.name("customers", customer, s)],
                ["商机范围", rows.length + " 条，整组一次生效"],
                ["账号状态", "保持不变"],
              ]) +
              SC.transfer(
                rows.map((o) => ({
                  obj: B.name("products", o.product, s),
                  from: person.name,
                  to:
                    choices[o.id].sales === "release"
                      ? "空余商机"
                      : B.name("people", choices[o.id].sales, s),
                })),
                "逐条安排，整组确认",
              ) +
              T.bodyNote(
                "客保与目标准入分别记录。已有普通在办提报继续原路径；原空间一旦只读归档，不因后来准入通过而倒推迁移。",
                "warn",
              ),
            onConfirm: () => {
              const id = T.transfer(
                customer,
                source,
                choices,
                admissions,
                versions,
              );
              location.href = T.href("handover", { result: id, sales: source });
            },
          });
        },
      });
    }
    body.insertAdjacentHTML(
      "beforeend",
      B.section("已完成交接", '<div id="completed-transfers"></div>'),
    );
    B.table(
      body.querySelector("#completed-transfers"),
      s.b3.transfers.filter((t) => t.source === source),
      [
        ["客户", (t) => E(B.name("customers", t.customer, s))],
        ["商机数", (t) => t.rows.length],
        ["生效时间", (t) => E(t.at)],
        [
          "操作",
          (t) =>
            T.link("handover", "查看分层结果", { result: t.id }, "btn btn--sm"),
        ],
      ],
      { search: false },
    );
  };
})(window.SC, window.SC.B2, window.SC.B3);
