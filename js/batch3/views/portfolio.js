(function (SC, B, T) {
  const E = B.e;
  T.views.home = function (body, actions, s, me) {
    const mgr = me.role === "MGR",
      combos = T.visibleCombos(s, me),
      opps = s.opps.filter((o) =>
        mgr ? T.isTeam(s, o.sales, me) : o.sales === me.id,
      ),
      spaces = s.spaces.filter((w) =>
        mgr ? T.isTeam(s, w.sales, me) : w.sales === me.id,
      );
    actions.innerHTML = T.link(
      mgr ? "manager-customers" : "my-customers",
      mgr ? "查看本组客户" : "我的客户",
      {},
      "btn btn--primary",
    );
    body.innerHTML = !mgr && !combos.length ? B.empty("暂无本人客户", "当前尚无本人经营组合，可从商机市场查看必要信息并按规则申请。") : B.strip(
      mgr
        ? [
            [
              "本组客户",
              new Set(combos.map((c) => c.customer)).size,
              "去重客户主档",
              "building",
            ],
            ["经营组合", combos.length, "按销售与客户", "layers"],
            [
              "已建空间",
              spaces.filter((w) => w.status === "normal")
                .length,
              "当前各池空间独立",
              "grid",
            ],
            [
              "可见商机",
              opps.filter((o) => T.active(s, o)).length,
              "含已结束商机",
              "box",
            ],
            ["归档历史", spaces.filter(w => ["archived", "frozen"].includes(w.status)).length, "与当前空间分别统计", "history"],
          ]
        : [
            [
              "客户工作空间",
              spaces.filter((w) => w.status === "normal").length,
              "当前正常空间",
              "grid",
            ],
            [
              "进行中商机",
              opps.filter((o) => o.result === "active" && T.active(s, o))
                .length,
              "本人当前可推进",
              "box",
            ],
            ["经营组合", combos.length, "销售与客户", "building"],
            [
              "待处理申请",
              s.b3.requests.filter(
                (r) =>
                  r.actor === me.id &&
                  ["pending", "partial"].includes(T.requestState(r)),
              ).length,
              "不包含准入提报",
              "file",
            ],
          ],
    );
    if (mgr) {
      const requests = s.b3.requests.filter(
          (r) =>
            T.canApprove(s, r) &&
            ["pending", "partial"].includes(T.requestState(r)),
        ),
        admissions = s.b3.admissions.filter(
          (a) => T.canAdmission(s, a) && a.status === "pending",
        ),
        unset = opps.filter((o) => !o.pool);
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "本组待办",
          '<div class="b3-nav-grid">' +
            [
              ["manager-approvals", "客保审批", requests.length, "gavel"],
              ["manager-admissions", "准入终审", admissions.length, "check"],
              ["manager-exceptions", "客户池配置", unset.length, "layers"],
            ]
              .map(
                ([page, label, n, icon]) =>
                  '<a class="b3-nav-item" href="' +
                  E(T.href(page)) +
                  '">' +
                  SC.icon(icon, 20) +
                  "<b>" +
                  label +
                  '</b><span class="b3-count">' +
                  n +
                  "</span></a>",
              )
              .join("") +
            "</div>",
        ) +
          B.section(
            "Agent 与空间恢复",
            '<div id="manager-failure-tabs"></div><div id="manager-failure-table"></div>',
          ),
      );
      const tab = SC.param("view") || "bind";
      B.tabs(
        body.querySelector("#manager-failure-tabs"),
        [
          ["bind", "绑定失败"],
          ["read", "读取失败"],
          ["spaces", "空间建立失败"],
        ],
        tab,
        (v) => {
          T.setQuery({ view: v });
          T.render();
        },
      );
      const root = body.querySelector("#manager-failure-table");
      if (tab === "spaces")
        T.failureTable(
          root,
          s,
          spaces.filter((w) => w.status === "failed"),
        );
      else {
        const rows = s.agents.filter(
          (a) =>
            a.current &&
            a.state === (tab === "bind" ? "bindfail" : "readfail") &&
            T.manages(s, B.find("spaces", a.space, s)?.sales),
        );
        B.table(
          root,
          rows,
          [
            [
              "实例 / 客户",
              (a) =>
                B.entity(
                  B.name(
                    "customers",
                    B.find("spaces", a.space, s)?.customer,
                    s,
                  ),
                  a.id,
                  "bot",
                ),
            ],
            ["空间", (a) => E(a.space)],
            ["原因", (a) => E(a.why || "读取暂不可用")],
            ["已自动重试", (a) => a.tries + " 次"],
            [
              "操作",
              (a) =>
                B.btn("核对并重试", "retry-agent", a.id, "retry", "btn--sm"),
            ],
          ],
          {
            key: "mgr-agent-" + tab,
            select: true,
            batchLabel: tab === "bind" ? "重试绑定" : "重试读取",
            onBatch: (ids) => retry(ids, tab),
            emptyTitle:
              tab === "bind" ? "暂无本组绑定失败" : "暂无本组读取失败",
          },
        );
        function retry(ids, kind) {
          const versions = Object.fromEntries(
            ids.map((id) => [id, B.find("agents", id, s).version]),
          );
          B.modal({
            title: kind === "bind" ? "重试本组绑定" : "重试本组读取",
            confirm: "确认重试",
            body: T.bodyNote(
              kind === "bind"
                ? "继续同次实例绑定，不创建重复实例。"
                : "只重试读取，已有绑定保留。",
            ),
            onConfirm: () => {
              const current = B.load();
              if (
                ids.some(
                  (id) =>
                    !T.manages(
                      current,
                      B.find(
                        "spaces",
                        B.find("agents", id, current)?.space,
                        current,
                      )?.sales,
                    ),
                )
              )
                throw Error("当前已无本组恢复权限");
              const result = B.retryAgent(ids, kind, versions);
              T.render();
              B.results(result, "本组恢复结果");
            },
          });
        }
        B.actions(root, { "retry-agent": (id) => retry([id], tab) });
      }
    } else {
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "客户池分布",
          '<div class="b2-section__body" id="pool-distribution"></div>',
        ) +
          B.section(
            "业务数据",
            '<div class="b2-section__body">' +
              B.empty("暂无回流业务数据", "成交金额与流水尚未接入。") +
              "</div>",
          ) +
          B.section(
            "跟进任务",
            '<div class="b2-section__body">' +
              B.empty(
                "暂无已接入的跟进任务",
                "当前任务来源尚未提供可执行任务。",
              ) +
              "</div>",
          ),
      );
      const followed = opps.filter((o) =>
          s.b3.records.some(
            (r) =>
              r.kind === "跟进记录" &&
              r.opps.includes(o.id) &&
              new Date(r.at.replace(" ", "T")) >=
                new Date(Date.now() - 30 * 86400000) &&
              new Date(r.at.replace(" ", "T")) <= new Date(Date.now()),
          ),
        ),
        assigned = followed.filter((o) => o.pool),
        pools = [...new Set(assigned.map((o) => o.pool))];
      body.querySelector("#pool-distribution").innerHTML = assigned.length
        ? pools
            .map((pool, i) => {
              const n = assigned.filter((o) => o.pool === pool).length,
                percent = Math.round((n / assigned.length) * 100);
              return (
                '<div class="b3-bar-row"><span>' +
                E(B.name("pools", pool, s)) +
                '</span><div class="b3-bar-track"><i style="width:' +
                percent +
                "%;background:" +
                ["#3d78ab", "#4f7d5a", "#9a681f"][i % 3] +
                '"></i></div><span>' +
                percent +
                "%</span></div>"
              );
            })
            .join("")
        : B.empty(followed.length ? "暂无已指定客户池的跟进商机" : "暂无近 30 天跟进样本",
            followed.length ? "已有跟进商机尚未指定客户池，占比暂无可用样本。" : "恢复审批与准入通过不计为实际跟进。");
      body.querySelector("#pool-distribution").insertAdjacentHTML("beforeend",
        '<p class="b2-sub">未指定客户池：' + followed.filter(o => !o.pool).length + ' 条，不计入占比分母</p>');
    }
  };
  T.views.sales = function (body, actions, s, me) {
    actions.innerHTML = T.link("manager-home", "返回工作台", {}, "btn");
    body.innerHTML = '<div id="team-sales"></div>';
    B.table(
      body.querySelector("#team-sales"),
      s.people.filter((p) => p.role === "SLS" && T.isTeam(s, p.id, me)),
      [
        ["销售", (p) => B.entity(p.name, p.id, "users")],
        ["账号状态", (p) => SC.state(p.status === "on")],
        [
          "客户 / 组合",
          (p) => {
            const c = s.combos.filter((c) => !c.ended && c.sales === p.id);
            return new Set(c.map((x) => x.customer)).size + " / " + c.length;
          },
        ],
        [
          "已建空间",
          (p) =>
            s.spaces.filter(
              (w) =>
                w.sales === p.id && w.status === "normal",
            ).length,
        ],
        ["归档历史", p => s.spaces.filter(w => w.sales === p.id && ["archived", "frozen"].includes(w.status)).length],
        [
          "归属商机（含已结束、未激活）",
          (p) =>
            s.opps.filter((o) => o.sales === p.id).length,
        ],
        [
          "操作",
          (p) =>
            T.link(
              "manager-customers",
              "查看客户",
              { sales: p.id },
              "btn btn--sm",
            ),
        ],
      ],
      { key: "team-sales-" + me.id },
    );
  };
  T.views.customers = function (body, actions, s, me, meta = {}) {
    let combos = T.visibleCombos(s, me);
    const salesScope = meta.salesId || SC.param("sales");
    if (salesScope) combos = combos.filter((c) => c.sales === salesScope);
    const mgr = me.role === "MGR";
    actions.innerHTML = mgr
      ? T.link("manager-admissions", "准入终审", {}, "btn")
      : T.link("market", "查看商机市场", {}, "btn");
    body.innerHTML =
      B.strip([
        ["经营组合", combos.length],
        ["已通过准入", combos.filter((c) => c.admit === "已通过").length],
        ["待终审", combos.filter((c) => T.pendingAdmission(s, c)).length],
        [
          "待指定承接方",
          combos.reduce(
            (n, c) =>
              n + T.owned(s, c.customer, c.sales).filter((o) => !o.pool).length,
            0,
          ),
        ],
      ]) +
      '<div id="portfolio-table"></div>' +
      B.section("有权历史空间", '<div id="portfolio-history"></div>');
    B.table(
      body.querySelector("#portfolio-table"),
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
        [
          "归属 / 可见商机",
          (c) =>
            T.owned(s, c.customer, c.sales).length +
            " / " +
            T.comboOpps(s, c).length,
        ],
        ["准入状态", (c) => T.admitBadge(c)],
        [
          "当前空间",
          (c) =>
            s.spaces.filter(
              (w) =>
                w.customer === c.customer &&
                w.sales === c.sales &&
                w.status === "normal",
            ).length,
        ],
        [
          "待指定",
          (c) => T.owned(s, c.customer, c.sales).filter((o) => !o.pool).length,
        ],
        [
          "操作",
          (c) =>
            T.link("combo-detail", "查看组合", { id: c.id }, "btn btn--sm") +
            (!mgr &&
            !T.admitError(s, c) &&
            c.admit !== "已通过" &&
            !T.pendingAdmission(s, c)
              ? " " + B.btn("提报", "submit", c.id, "check", "btn--sm")
              : ""),
        ],
      ],
      {
        key: "portfolio-" + me.id,
        select: !mgr,
        batchLabel: "批量提报准入",
        eligible: (c) =>
          !T.admitError(s, c) &&
          c.admit !== "已通过" &&
          !T.pendingAdmission(s, c),
        onBatch: (ids) => T.submitModal(ids),
        searchText: (c) => T.scopeTitle(s, c),
        filters: [
          {
            key: "admit",
            label: "准入状态",
            options: ["未提报", "审批中", "已通过", "已驳回"],
          },
        ],
        emptyTitle: "暂无当前经营组合",
      },
    );
    const history = s.spaces.filter(
      (w) => ["archived", "frozen"].includes(w.status) && T.spaceAccess(s, w) && (!salesScope || w.sales === salesScope),
    );
    B.table(
      body.querySelector("#portfolio-history"),
      history,
      [
        [
          "客户 / 原空间",
          (w) =>
            B.entity(
              B.name("customers", w.customer, s),
              B.name("pools", w.pool, s),
              "history",
            ),
        ],
        ["空间状态", (w) => SC.spaceState(w.status)],
        ["原销售", (w) => E(B.name("people", w.sales, s))],
        [
          "历史来源",
          (w) =>
            E(
              w.archiveSource === "empty"
                ? "空置手动归档"
                : w.archiveSource === "handover"
                  ? "交接只读归档"
                  : "组合解除归档",
            ),
        ],
        [
          "操作",
          (w) =>
            T.link("space-history", "只读查看", { id: w.id }, "btn btn--sm"),
        ],
      ],
      { search: false },
    );
    B.actions(body, { submit: (id) => T.submitModal([id]) });
  };
  T.views.opps = function (body, actions, s, me) {
    const rows = s.opps.filter((o) => T.isTeam(s, o.sales, me));
    body.innerHTML = '<div id="managed-opps"></div>';
    B.table(
      body.querySelector("#managed-opps"),
      rows,
      T.oppColumns(s).concat([
        [
          "承接配置",
          (o) => B.btn("调整客户池", "pool", o.id, "layers", "btn--sm"),
        ],
      ]),
      {
        key: "managed-opps-" + me.id,
        select: true,
        batchLabel: "批量调整客户池",
        onBatch: (ids) => T.movePoolModal(ids),
        searchText: (o) => o.name + B.name("people", o.sales, s),
        filters: [
          {
            key: "pool",
            label: "客户池",
            value: (o) => o.pool || "unset",
            options: [
              ["unset", "待指定"],
              ...s.pools.map((p) => [p.id, p.name]),
            ],
          },
        ],
      },
    );
    B.actions(body, { pool: (id) => T.movePoolModal([id]) });
  };
  T.failureTable = function (root, s, rows) {
    B.table(
      root,
      rows,
      [
        [
          "客户 / 空间",
          (w) => B.entity(B.name("customers", w.customer, s), w.id, "layers"),
        ],
        [
          "销售 / 客户池",
          (w) =>
            E(B.name("people", w.sales, s)) +
            '<p class="b2-sub">' +
            E(B.name("pools", w.pool, s)) +
            "</p>",
        ],
        ["失败原因", (w) => E(w.why || "空间建立未完成")],
        [
          "操作",
          (w) => B.btn("核对并重试", "space-retry", w.id, "retry", "btn--sm"),
        ],
      ],
      { key: "team-space-failures", emptyTitle: "暂无本组空间建立失败" },
    );
    B.actions(root, {
      "space-retry": (id) => {
        const w = B.find("spaces", id, s);
        B.modal({
          title: "恢复本组空间建立",
          confirm: "确认重试",
          body:
            B.kv([
              ["客户", B.name("customers", w.customer, s)],
              ["客户池", B.name("pools", w.pool, s)],
              ["原因", w.why],
            ]) + T.bodyNote("当前组合、准入、账号和装载条件将再次核对。"),
          onConfirm: () => {
            T.tx((s) => {
              const current = B.find("spaces", id, s),
                c = T.combo(s, current.customer, current.sales);
              if (
                !T.manages(s, current.sales) ||
                current.version !== w.version ||
                current.status !== "failed"
              )
                throw Error("当前无权或空间状态已变化");
              const error = T.admitError(s, c);
              if (
                error ||
                c.admit !== "已通过" ||
                !T.spaceOpps(s, current).length ||
                !B.find("pools", current.pool, s)
              )
                throw Error(error || "当前准入或池装载条件不满足");
              current.status = "normal";
              current.why = "";
              current.version++;
              T.bind(s, current);
              T.event(s, "空间恢复成功", {
                space: id,
                customer: current.customer,
                sales: current.sales,
              });
            });
            T.render();
            SC.toast("空间已恢复，准入结果保留", "ok");
          },
        });
      },
    });
  };
  T.views.exceptions = function (body, actions, s, me) {
    const tab = SC.param("view") || "pool",
      ops = s.opps.filter((o) => T.isTeam(s, o.sales, me));
    actions.innerHTML = T.link("manager-home", "Agent 失败处理", {}, "btn");
    body.innerHTML =
      '<div id="exception-tabs"></div><div id="exception-table"></div>';
    B.tabs(
      body.querySelector("#exception-tabs"),
      [
        ["pool", "客户池配置"],
        ["ownership", "归属使用异常"],
        ["spaces", "空间建立失败"],
      ],
      tab,
      (v) => {
        T.setQuery({ view: v });
        T.render();
      },
    );
    const root = body.querySelector("#exception-table");
    if (tab === "spaces") {
      T.failureTable(
        root,
        s,
        s.spaces.filter(
          (w) => w.status === "failed" && T.isTeam(s, w.sales, me),
        ),
      );
      return;
    }
    const rows =
      tab === "pool"
        ? ops.filter((o) => !o.pool)
        : ops.filter((o) => B.find("people", o.sales, s)?.status !== "on");
    B.table(
      root,
      rows,
      T.oppColumns(s).concat([
        [
          "处理方向",
          (o) =>
            tab === "pool"
              ? B.btn("指定客户池", "pool", o.id, "layers", "btn--sm")
              : "超级管理员办理交接，当前只读",
        ],
      ]),
      {
        key: "exceptions-" + tab,
        select: tab === "pool",
        batchLabel: "补齐客户池",
        onBatch: (ids) => T.movePoolModal(ids),
        emptyTitle:
          tab === "pool" ? "暂无本组待指定商机" : "暂无本组归属使用异常",
      },
    );
    B.actions(root, { pool: (id) => T.movePoolModal([id]) });
  };
  T.views.solutionPool = function (body, actions, s, me) {
    const combos = T.visibleCombos(s, me),
      rows = s.opps.filter(
        (o) => o.sales && me.pool && o.pool === me.pool && T.active(s, o),
      );
    actions.innerHTML = T.link(
      "solution-submit",
      "客户提报",
      {},
      "btn btn--primary",
    );
    body.innerHTML =
      '<div class="b3-scope"><span class="b2-entity__mark">' +
      SC.icon("layers", 22) +
      '</span><div class="u-grow"><h2>' +
      E(me.pool ? B.name("pools", me.pool, s) : "尚未分配客户池") +
      '</h2><div class="scope-meta"><span>当前承接人员：' +
      E(me.name) +
      "</span></div></div></div>" +
      B.strip([
        ["本池可见客户", new Set(rows.map((o) => o.customer)).size],
        ["本池商机", rows.length],
        ["涉及销售客户组合", combos.length],
        [
          "本池正常空间",
          s.spaces.filter(
            (w) =>
              w.pool === me.pool &&
              w.status === "normal" &&
              T.spaceAccess(s, w),
          ).length,
        ],
      ]) +
      '<div id="solution-opps"></div>';
    B.table(
      body.querySelector("#solution-opps"),
      rows,
      [
        [
          "客户 / 商机",
          (o) =>
            B.entity(B.name("customers", o.customer, s), o.name, "building"),
        ],
        ["销售", (o) => E(B.name("people", o.sales, s))],
        ["产品", (o) => E(B.name("products", o.product, s))],
        ["经营结果", (o) => B.badge(SC.OPP_RESULT[o.result])],
        ["准入", (o) => T.admitBadge(T.combo(s, o.customer, o.sales))],
        [
          "操作",
          (o) => {
            const w = B.spaceFor(o, s),
              c = T.combo(s, o.customer, o.sales);
            return w && T.spaceAccess(s, w) && w.status === "normal"
              ? T.link("workspace", "进入本池空间", { id: w.id }, "btn btn--sm")
              : c
                ? T.link(
                    "combo-detail",
                    "查看本池情况",
                    { id: c.id },
                    "btn btn--sm",
                  )
                : "未建立空间";
          },
        ],
      ],
      {
        key: "solution-pool-" + me.id,
        searchText: (o) => o.name,
        emptyTitle: me.pool ? "暂无本池可见商机" : "尚未分配客户池",
        emptyReason: me.pool
          ? "当前无符合产品与承接条件的商机。"
          : "需由超级管理员分配客户池。",
      },
    );
  };
})(window.SC, window.SC.B2, window.SC.B3);
