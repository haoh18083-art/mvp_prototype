(function (SC, B, T) {
  const E = B.e;
  T.views.opportunity = function (body, actions, s, me, { opportunityId } = {}) {
    const id =
        opportunityId || SC.param("id") ||
        s.opps.find(
          (o) =>
            o.sales === me.id ||
            me.role === "ADM" ||
            (me.role === "MGR" && T.isTeam(s, o.sales)),
        )?.id ||
        "O-3001",
      o = B.find("opps", id, s);
    if (
      !o ||
      (me.role === "SOL" &&
        (!me.pool || o.pool !== me.pool || !T.active(s, o))) ||
      (me.role === "SLS" && !o.sales && !T.active(s, o))
    ) {
      body.innerHTML = B.empty("无可查看的商机");
      return;
    }
    const full =
        me.role === "ADM" ||
        (me.role === "SLS" && o.sales === me.id) ||
        (me.role === "MGR" && T.isTeam(s, o.sales)),
      c = T.combo(s, o.customer, o.sales),
      pending = s.b3.requests.find((r) =>
        r.items.some((i) => i.opp === o.id && i.status === "pending"),
      );
    actions.innerHTML = T.link(
      me.role === "ADM"
        ? "customers"
        : me.role === "MGR"
          ? "manager-opportunities"
          : me.role === "SOL"
            ? "solution-pool"
            : "market",
      "返回业务清单",
      {},
      "btn",
    );
    body.innerHTML =
      '<div class="b3-scope"><span class="b2-entity__mark">' +
      SC.icon("box", 24) +
      '</span><div class="u-grow"><h2>' +
      E(o.name) +
      '</h2><div class="scope-meta"><span>' +
      E(B.name("customers", o.customer, s)) +
      "</span><span>" +
      E(B.name("products", o.product, s)) +
      "</span></div></div>" +
      B.badge(
        SC.OPP_RESULT[o.result],
        o.result === "active" ? "green" : "neutral",
      ) +
      "</div>" +
      B.section(
        "当前商机状态",
        '<div class="b2-section__body">' +
          B.kv([
            [
              "归属销售",
              o.sales ? B.name("people", o.sales, s) : o.sourceSales || "空余",
            ],
            ["销售所属分组", o.sales ? T.group(s, o.sales) : "无"],
            [
              "进行中事项",
              full
                ? SC.OPP_PENDING[o.pending] || "无"
                : o.pending === "release"
                  ? "无"
                  : o.pending !== "none"
                    ? "有进行中申请"
                    : "无",
            ],
            ["当前经营结果", SC.OPP_RESULT[o.result]],
            ...(full || me.role === "SOL"
              ? [
                  ["客户池", B.name("pools", o.pool, s)],
                  ["产品可用性", T.active(s, o) ? "已激活" : "未激活"],
                ]
              : []),
          ]) +
          "</div>",
      );
    const commands = [];
    if (me.role === "SLS" && o.pending === "none") {
      const base = { customer: o.customer, opps: o.id };
      if (!o.sales && !o.sourceSales && T.active(s, o))
        commands.push(
          T.link(
            "request-form",
            B.find("customers", o.customer, s)?.sea
              ? "申请公海领取"
              : T.owned(s, o.customer, me.id).length
                ? "申请认领"
                : "申请加入并认领",
            {
              ...base,
              type: B.find("customers", o.customer, s)?.sea
                ? "sea"
                : T.owned(s, o.customer, me.id).length
                  ? "claim"
                  : "join",
            },
            "btn btn--primary",
          ),
        );
      if (o.sales && o.sales !== me.id && T.owned(s, o.customer, me.id).length)
        commands.push(
          T.link(
            "request-form",
            "申请争议转交",
            { ...base, type: "dispute" },
            "btn",
          ),
        );
      if (o.sales === me.id) {
        commands.push(
          T.link(
            "request-form",
            "申请释放",
            { ...base, type: "release" },
            "btn btn--danger",
          ),
        );
        if (["closed", "lost"].includes(o.result)) {
          const error = T.itemError(
            s,
            {
              id: "",
              type: "restore",
              actor: me.id,
              beneficiary: me.id,
              customer: o.customer,
            },
            { opp: o.id, product: o.product },
          );
          commands.push(
            error
              ? '<p class="b2-sub">恢复前置：' + E(error) + "</p>"
              : T.link(
                  "request-form",
                  "申请恢复经营",
                  { ...base, type: "restore" },
                  "btn btn--primary",
                ),
          );
        }
      }
    }
    if (full && c && T.canCombo(s, c))
      commands.push(
        T.link("combo-detail", "查看经营组合", { id: c.id }, "btn"),
      );
    if (pending && T.canRequestView(s, pending))
      commands.push(
        T.link(T.requestPage(), "查看进行中申请", { id: pending.id }, "btn"),
      );
    if (me.role === "MGR" && T.isTeam(s, o.sales))
      commands.push(B.btn("调整客户池", "pool", o.id, "layers"));
    if (commands.length)
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "当前可办理事项",
          '<div class="b2-section__body b2-actions">' +
            commands.join("") +
            "</div>",
        ),
      );
    if (full) {
      if (o.endHistory?.length)
        body.insertAdjacentHTML(
          "beforeend",
          B.section(
            "原结束与恢复历史",
            '<div class="b2-section__body">' +
              o.endHistory
                .map(
                  (h) =>
                    '<div class="b3-record">' +
                    B.kv([
                      ["原结束结果", SC.OPP_RESULT[h.result]],
                      ["原结束原因", h.reason],
                      ["原结束时间", h.endedAt || "来源未提供"],
                      ["恢复时间", h.restoredAt],
                      ["恢复决定人", B.name("people", h.by, s)],
                    ]) +
                    "</div>",
                )
                .join("") +
              "</div>",
          ),
        );
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "业务动态",
          '<div class="b2-section__body">' +
            T.eventHTML(s, { customer: o.customer, sales: o.sales }) +
            "</div>",
        ),
      );
    }
    B.actions(body, { pool: () => T.movePoolModal([o.id]) });
  };
  T.views.combo = function (body, actions, s, me, { comboId, compact = false } = {}) {
    const wantId = comboId || SC.param("id");
    const c =
      s.combos.find((c) => c.id === wantId) ||
      (!wantId ? T.visibleCombos(s, me)[0] : null);
    if (!c || !T.canCombo(s, c)) {
      body.innerHTML = B.empty(
        "无当前可查看的经营组合",
        "已失去经营范围时，可从本人有权历史入口查询。",
      );
      return;
    }
    const ops = T.comboOpps(s, c, me),
      all = T.owned(s, c.customer, c.sales),
      spaces = s.spaces.filter(
        (w) =>
          w.customer === c.customer &&
          w.sales === c.sales &&
          (me.role !== "SOL" || (w.pool === me.pool && T.spaceAccess(s, w))),
      );
    const unset = me.role === "SOL" ? 0 : all.filter((o) => !o.pool).length;
    const metricTile = (label, value, detail, alert) =>
      '<div class="b2-stat' +
      (alert ? " cmb-stat--alert" : "") +
      '"><div class="b2-stat__label">' +
      E(label) +
      '</div><div class="b2-stat__value">' +
      E(value) +
      "</div>" +
      (detail ? '<div class="b2-stat__detail">' + E(detail) + "</div>" : "") +
      "</div>";
    const metrics =
      '<div class="cmb-metrics">' +
      (compact ? "" : metricTile("本轮准入序次", c.round || 1)) +
      metricTile(me.role === "SOL" ? "本池可见商机" : "当前可见商机", ops.length) +
      (me.role === "SOL"
        ? ""
        : metricTile("归属商机总数", all.length) +
          metricTile(compact ? "待指定客户池" : "待指定承接方", unset, !compact && unset ? "待补客户池" : "", unset > 0)) +
      "</div>";
    if (!comboId)
      actions.innerHTML = T.link(
        me.role === "ADM"
          ? "customers"
          : me.role === "MGR"
            ? "manager-customers"
            : me.role === "SOL"
              ? "solution-pool"
              : "my-customers",
        "返回客户清单",
        {},
        "btn",
      );
    if (me.role === "SLS")
      actions.insertAdjacentHTML(
        "beforeend",
        T.link(
          "request-form",
          "申请新增商机",
          { type: "new", customer: c.customer },
          "btn btn--primary",
        ),
      );
    body.innerHTML =
      '<div class="b3-scope"><span class="b2-entity__mark">' +
      SC.icon("box", 24) +
      '</span><div class="u-grow"><h2>' +
      E(B.name("customers", c.customer, s)) +
      '</h2><div class="scope-meta"><span>销售：' +
      E(B.name("people", c.sales, s)) +
      "</span>" +
      (compact ? '<span>第 ' + E(c.round || 1) + ' 轮准入</span>' : "") +
      "<span>" + (compact ? "" : "客户档案：") +
      T.link("customer-detail", "查看基础资料", { id: c.customer }) +
      "</span></div></div>" +
      T.admitBadge(c) +
      "</div>" +
      (compact
        ? '<section class="cmb-admission-summary" aria-label="经营概览">' + metrics +
          '<div class="b2-actions" id="combo-admit-actions"></div></section>'
        : B.section(
        "跟进准入",
        '<div class="b2-section__body">' +
          metrics +
          '<div class="b2-actions u-mt4" id="combo-admit-actions"></div></div>',
      )) +
      B.section("当前商机", '<div id="combo-opps"></div>') +
      B.section(
        me.role === "SOL" ? "本池空间" : "各池空间",
        '<div id="combo-spaces"></div>',
      );
    const ca = body.querySelector("#combo-admit-actions"),
      a = T.pendingAdmission(s, c),
      error = T.admitError(s, c);
    if (
      ["SLS", "SOL"].includes(me.role) &&
      !a &&
      c.admit !== "已通过" &&
      !error
    )
      ca.innerHTML = B.btn("提报准入", "submit", c.id, "check", "btn--primary");
    else if (a && T.manages(s, c.sales))
      ca.innerHTML = T.link(
        T.admissionPage(),
        "进入准入终审",
        { id: a.id },
        "btn btn--primary",
      );
    else if (compact && !a && !error)
      ca.hidden = true;
    else
      ca.innerHTML =
        '<span class="u-t2">' +
        E(a ? "已有进行中提报" : error || "准入结果已记录") +
        "</span>";
    B.table(body.querySelector("#combo-opps"), ops, T.oppColumns(s).filter(col => !compact || col[0] !== "当前归属"), {
      key: "combo-" + c.id + "-" + me.id,
      search: false,
      searchText: (o) => o.name + o.id,
      emptyTitle: "暂无当前可展示商机",
      emptyReason: "产品未激活或当前范围没有商机，经营关系不因此删除。",
    });
    const spaceRoot = body.querySelector("#combo-spaces");
    spaceRoot.innerHTML = spaces.length
      ? spaces
          .map((w) => {
            const allowed = T.spaceAccess(s, w),
              enter =
                ["normal", "archived", "frozen"].includes(w.status) && allowed;
            return (
              '<div class="b3-space-row"><div><b>' +
              E(B.name("pools", w.pool, s)) +
              '</b><p class="b2-sub">' +
              (w.status === "normal" && !T.spaceOpps(s, w, false).length
                ? "当前无装载商机"
                : "") +
              "</p></div>" +
              (me.role === "SOL"
                ? SC.spaceState(w.status)
                : T.readyState(s, w)) +
              '<div class="b2-actions">' +
              (enter
                ? T.link(
                    w.status === "normal" ? "workspace" : "space-history",
                    w.status === "normal" ? "进入空间" : "只读历史",
                    { id: w.id },
                    "btn btn--sm",
                  )
                : '<span class="u-t2">尚不可进入</span>') +
              (T.manages(s, w.sales) &&
              w.status === "normal" &&
              !T.spaceOpps(s, w, false).length
                ? B.btn("归档", "archive", w.id, "lock", "btn--sm")
                : "") +
              "</div></div>"
            );
          })
          .join("")
      : B.empty(
          "尚无可进入空间",
          "未分池部分不建立空间，其他建立条件按当前准入结果核对。",
        );
    if (me.role !== "SOL" && all.some((o) => !o.pool))
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "待指定承接方",
          '<div class="b2-section__body">' +
            B.kv(
              all
                .filter((o) => !o.pool)
                .map((o) => [
                  B.name("products", o.product, s),
                  "未指定，不装载到其他客户池空间",
                ]),
            ) +
            (me.role === "ADM"
              ? T.link("pools", "补齐客户池", { view: "unset" }, "btn u-mt4")
              : me.role === "MGR"
                ? T.link(
                    "manager-exceptions",
                    "补齐本组客户池",
                    {},
                    "btn u-mt4",
                  )
                : '<p class="b2-sub">需由本组主管或超级管理员补齐客户池。</p>') +
            "</div>",
        ),
      );
    const history = s.b3.admissions.filter(
      (x) => x.customer === c.customer && x.sales === c.sales,
    );
    if (me.role !== "SOL")
      body.insertAdjacentHTML(
        "beforeend",
        (compact
          ? (title, content) => '<details class="cmb-admission-history"><summary>' + E(title) +
            '<span class="tab__count">' + history.length + '</span>' + SC.icon("chevron", 16) +
            '</summary>' + content + '</details>'
          : B.section)(
          compact ? "准入记录" : "历次准入",
          '<div class="b2-section__body">' +
            (history.length
              ? history
                  .map(
                    (a) =>
                      '<div class="b3-record"><b>' +
                      E(a.source) +
                      "</b><p>" +
                      E(
                        {
                          pending: "审批中",
                          approved: "已通过",
                          rejected: "已驳回",
                          void: "已作废",
                        }[a.status],
                      ) +
                      " · " +
                      E(a.reason || a.note || "无补充说明") +
                      "</p><footer>" +
                      E(a.submitted) +
                      "</footer></div>",
                  )
                  .join("")
              : B.empty("暂无提报记录")) +
            "</div>",
        ),
      );
    B.actions(body, { submit: () => T.submitModal([c.id]) });
    T.bindCommon(body);
  };
  T.views.workspace = function (body, actions, s, me, meta) {
    // A refreshed workspace must not leave details from its previous scope open.
    if (B._drawer?.root.classList.contains("workspace-opportunity-drawer"))
      B._drawer.close(true);
    const historical = meta.view === "history",
      id = meta.spaceId || SC.param("id"),
      w =
        B.find("spaces", id, s) ||
        (!id
          ? s.spaces.find(
              (w) =>
                (historical
                  ? ["archived", "frozen"].includes(w.status)
                  : w.status === "normal") && T.spaceAccess(s, w),
            )
          : null),
      access = T.spaceAccess(s, w);
    if (!access) {
      body.innerHTML = B.empty(
        "无权访问该空间",
        "当前身份不具备此空间或其历史的访问权限。",
      );
      return;
    }
    if (!historical && !["normal", "archived", "frozen"].includes(w.status)) {
      body.innerHTML = B.empty("空间尚不可进入", w.why || "建立尚未完成");
      return;
    }
    const c = T.combo(s, w.customer, w.sales),
      records = T.records(s, w, access, me),
      ops = T.spaceOpps(s, w),
      readonly = historical || access.readonly || w.status !== "normal";
    actions.innerHTML =
      !historical
        ? ""
        : c && T.canCombo(s, c)
        ? T.link("combo-detail", "返回经营组合", { id: c.id }, "btn")
        : T.link(
            me.role === "ADM"
              ? "customers"
              : me.role === "MGR"
                ? "manager-customers"
                : me.role === "SOL"
                  ? "solution-pool"
                  : "my-customers",
            "返回客户清单",
            {},
            "btn",
          );
    const title = B.name("customers", w.customer, s);
    body.innerHTML =
      (readonly
        ? '<div class="b3-readonly">' +
          E(
            historical
              ? "空间历史只读"
              : w.status === "normal"
                ? "当前仅可查看，经营操作另受权限限制"
                : "该空间已归档，只读保留",
          ) +
          (access.until ? " · 截止 " + E(access.until) : "") +
          "</div>"
        : "") +
      '<div class="b3-scope"><span class="b2-entity__mark">' +
      SC.icon("layers", 24) +
      '</span><div class="u-grow"><h2>' +
      E(title) +
      '</h2><div class="scope-meta"><span>销售：' +
      E(B.name("people", w.sales, s)) +
      "</span><span>客户池：" +
      E(B.name("pools", w.pool, s)) +
      "</span></div></div>" +
      SC.spaceState(w.status) +
      "</div>";
    if (historical) {
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "归档与授权",
          '<div class="b2-section__body">' +
            B.kv([
              [
                "归档来源",
                w.archiveSource === "handover"
                  ? "交接只读归档"
                  : w.archiveSource === "empty"
                    ? "空置手动归档"
                    : "组合解除归档",
              ],
              ["归档时间", w.archivedAt || w.created],
              [
                "历史授权",
                access.grant ? "本原空间交接前全部历史" : "按当前合法空间权限",
              ],
              ["截止时间", access.until || "本人或当前有权历史"],
            ]) +
            "</div>",
        ),
      );
    } else {
      if (me.role !== "SOL")
        body.insertAdjacentHTML(
          "beforeend",
          B.section(
            "空间与 Agent",
            '<div class="b2-section__body">' + T.readyState(s, w) + "</div>",
          ),
        );
      body.insertAdjacentHTML(
        "beforeend",
        B.section("当前商机", '<div id="workspace-opps"></div>'),
      );
      B.table(body.querySelector("#workspace-opps"), ops, T.oppColumns(s), {
        key: "workspace-" + w.id,
        search: false,
        searchText: (o) => o.name,
        emptyTitle: "当前无可展示商机",
        emptyReason: T.spaceOpps(s, w, false).length
          ? "当前产品展示条件未满足，原历史仍保留。"
          : "本池当前无装载商机，历史内容保留。",
        onDraw: (root) => {
          root.querySelectorAll('a[href^="opportunity.html?"]').forEach((link) => {
            link.setAttribute("aria-haspopup", "dialog");
            link.onclick = (event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              openOpportunity(new URL(link.href).searchParams.get("id"));
            };
          });
        },
      });
    }
    function openOpportunity(opportunityId) {
      const current = B.load(),
        viewer = T.me(current),
        space = B.find("spaces", w.id, current);
      if (
        !viewer || viewer.role !== T.role ||
        !T.spaceAccess(current, space, viewer) ||
        !["normal", "archived", "frozen"].includes(space.status) ||
        !T.spaceOpps(current, space).some((o) => o.id === opportunityId)
      ) {
        SC.toast("该商机已不在当前空间可查看范围", "bad");
        T.render();
        return;
      }
      const drawer = B.drawer({
        title: "商机详情",
        sub: '<span class="mono">' + E(opportunityId) + '</span>',
        width: "min(680px, 100vw)",
      });
      drawer.root.classList.add("workspace-opportunity-drawer");
      T.views.opportunity(drawer.body, document.createElement("div"), current, viewer, { opportunityId });
    }
    body.insertAdjacentHTML(
      "beforeend",
      B.section("授权记录", '<div id="workspace-records"></div>'),
    );
    body.querySelector("#workspace-records").innerHTML = records.length
      ? records
          .map(
            (r) =>
              '<article class="b3-record"><h3>' +
              E(r.label) +
              "</h3><p>" +
              E(r.text) +
              "</p><footer><span>" +
              E(r.kind) +
              "</span><span>" +
              E(r.by) +
              "</span><time>" +
              E(r.at) +
              "</time>" +
              B.btn("查看原记录", "record", r.id, "file", "btn--link") +
              "</footer></article>",
          )
          .join("")
      : B.empty("暂无可见业务记录", "当前授权范围尚无可展示的记录。");
    if (!historical && access.member)
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "业务动态",
          '<div class="b2-section__body">' +
            T.eventHTML(s, { space: w.id }) +
            "</div>",
        ),
      );
    const grants = s.b3.grants.filter(
      (g) =>
        g.person === me.id &&
        B.find("spaces", g.space, s)?.customer === w.customer,
    );
    if (!historical && grants.length)
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "交接原历史",
          '<div class="b2-section__body b2-actions">' +
            grants
              .map((g) => {
                const old = B.find("spaces", g.space, s);
                return T.link(
                  "space-history",
                  B.name("pools", old.pool, s) + " · 原空间历史",
                  { id: old.id },
                  "btn",
                );
              })
              .join("") +
            "</div>",
        ),
      );
    if (me.role !== "SOL" && (w.status === "archived" || w.status === "frozen"))
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "历史实例",
          '<div class="b2-section__body">' +
            B.kv(
              s.agents
                .filter((a) => a.space === w.id && !a.current)
                .map((a) => [
                  "已停止实例",
                  a.at + " · " + (a.why || "历史输出保留"),
                ]),
            ) +
            "</div>",
        ),
      );
    B.actions(body, {
      record: (id) => {
        const current = B.load(),
          fresh = B.find("spaces", w.id, current),
          permission = T.spaceAccess(current, fresh),
          r =
            permission &&
            T.records(current, fresh, permission).find((r) => r.id === id);
        if (!r) {
          SC.toast("该记录已不在当前授权范围", "bad");
          T.render();
          return;
        }
        B.modal({
          title: r.label,
          wide: true,
          body:
            B.kv([
              ["记录类型", r.kind],
              ["发生时间", r.at],
              ["记录人", r.by],
            ]) +
            '<p class="u-mt4">' +
            E(r.text) +
            "</p>" +
            (r.customerLevel
              ? T.bodyNote("客户级记录只读引用，不补造商机关联。")
              : ""),
        });
      },
    });
  };
  T.views.history = T.views.workspace;
})(window.SC, window.SC.B2, window.SC.B3);
