(function (SC, B, T) {
  const E = B.e;
  const navigate = (page, params) => {
    if (T.role === "SLS" && T.sales) return T.sales.navigate(page, params);
    location.href = T.href(page, params);
  };
  T.views.market = function (body, actions, s, me) {
    const tab = SC.param("view") || "free";
    actions.innerHTML = T.link("my-requests", "我的申请", {}, "btn");
    body.innerHTML =
      '<form class="b3-form b3-search-form" id="customer-search"><div class="b3-form-grid">' +
      B.field("客户全称", "name", "", { required: true }) +
      '<div class="b2-actions">' +
      B.btn("全局查重", "dedup", "", "search", "btn--primary") +
      '</div></div></form><div id="market-tabs"></div><div id="market-table"></div>';
    B.tabs(
      body.querySelector("#market-tabs"),
      [
        ["free", "空余商机"],
        ["owned", "已归属商机"],
        ["sea", "公海客户"],
      ],
      tab,
      (v) => {
        T.setQuery({ view: v });
        T.render();
      },
    );
    const root = body.querySelector("#market-table");
    if (tab === "sea")
      B.table(
        root,
        s.customers.filter((c) => c.sea && !c.merged),
        [
          [
            "客户",
            (c) =>
              B.entity(
                c.name,
                c.id,
                "building",
                T.href("sea-customer", { id: c.id }),
              ),
          ],
          ["公海状态", () => B.badge("公海", "brand")],
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
            "操作",
            (c) => T.link("sea-customer", "查看", { id: c.id }, "btn btn--sm"),
          ],
        ],
        { key: "market-sea", searchText: (c) => c.name },
      );
    else {
      const rows = s.opps.filter(
        (o) =>
          T.active(s, o) &&
          (tab === "free" ? !o.sales && !o.sourceSales : !!o.sales),
      );
      B.table(root, rows, T.oppColumns(s, { market: true }), {
        key: "market-" + tab,
        searchText: (o) => o.name + B.name("people", o.sales, s),
        filters: [
          {
            key: "product",
            label: "产品",
            options: s.products
              .filter((p) => p.active)
              .map((p) => [p.id, p.name]),
          },
        ],
      });
    }
    const form = body.querySelector("#customer-search");
    form.onsubmit = (e) => {
      e.preventDefault();
      search();
    };
    function search() {
      if (!form.reportValidity()) return;
      const name = new FormData(form).get("name").trim();
      if (name) navigate("customer-search", { name });
    }
    B.actions(body, { dedup: search });
  };
  T.views.search = function (body, actions, s, me, meta = {}) {
    const param = key => meta.params ? meta.params[key] || "" : SC.param(key);
    const name = param("name") || "星辰科技有限公司",
      rows = T.matches(s, name),
      exact = rows.some((c) => c.match === "精确");
    actions.innerHTML = T.link("market", "返回商机市场", {}, "btn");
    body.innerHTML =
      '<form class="b3-form" id="dedup-form">' +
      B.field("查重客户全称", "name", name, { required: true }) +
      B.btn("重新查重", "search", "", "search") +
      '</form><div id="dedup-results"></div>';
    B.table(
      body.querySelector("#dedup-results"),
      rows,
      [
        ["客户", (c) => B.entity(c.name, c.id, "building")],
        [
          "命中类型",
          (c) => B.badge(c.match, c.match === "精确" ? "amber" : "neutral"),
        ],
        ["来源", (c) => E(c.source)],
        [
          "已关联销售",
          (c) => new Set(T.owned(s, c.id).map((o) => o.sales)).size,
        ],
        [
          "可查询空余商机",
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
          "操作",
          (c) =>
            !s.opps.some((o) => o.customer === c.id)
              ? T.link(
                  "request-form",
                  "申请首批商机",
                  { type: "first_existing", customer: c.id },
                  "btn btn--sm",
                )
              : c.sea
                ? T.link(
                    "sea-customer",
                    "查看公海客户",
                    { id: c.id },
                    "btn btn--sm",
                  )
                : T.link(
                    "request-form",
                    "查看可申请商机",
                    {
                      type: T.owned(s, c.id, T.actorId).length
                        ? "claim"
                        : "join",
                      customer: c.id,
                    },
                    "btn btn--sm",
                  ),
        ],
      ],
      {
        search: false,
        emptyTitle: "未命中已有客户",
        emptyReason: "提交与审批时仍将再次核对客户主体。",
      },
    );
    if (!exact)
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          rows.length ? "确认非同一主体" : "新建申请",
          '<form class="b3-form" id="distinct-form">' +
            (rows.length
              ? '<label><input type="checkbox" name="distinct" required> 已确认非同一客户</label>' +
                B.field("非同一主体说明", "reason", "", {
                  required: true,
                  area: true,
                })
              : "") +
            B.btn("新建客户及首批商机", "new", "", "plus", "btn--primary") +
            "</form>",
        ),
      );
    B.actions(body, {
      search: () => {
        const form = body.querySelector("#dedup-form");
        if (form.reportValidity())
          navigate("customer-search", {
            name: new FormData(form).get("name").trim(),
          });
      },
      new: () => {
        const form = body.querySelector("#distinct-form");
        if (!form.reportValidity()) return;
        const v = new FormData(form);
        navigate("request-form", {
          type: "first_new",
          name,
          distinct: rows.length ? "1" : "",
          reason: v.get("reason") || "",
        });
      },
    });
  };
  T.views.seaCustomer = function (body, actions, s, me, meta = {}) {
    const c = B.find("customers", meta.customerId || SC.param("id") || "C-1007", s);
    if (!c || c.merged) {
      body.innerHTML = B.empty("客户不存在");
      return;
    }
    actions.innerHTML = T.link(
      "market",
      "返回公海查询",
      { view: "sea" },
      "btn",
    );
    body.innerHTML =
      '<div class="b3-scope"><div class="u-grow"><h2>' +
      E(c.name) +
      "</h2></div>" +
      B.badge(
        c.sea ? "当前处于公海" : "已退出公海",
        c.sea ? "brand" : "neutral",
      ) +
      '</div><div id="sea-opps"></div>';
    const all = s.opps.filter((o) => o.customer === c.id),
      rows = all.filter((o) => !o.sales && !o.sourceSales && T.active(s, o));
    B.table(
      body.querySelector("#sea-opps"),
      rows,
      T.oppColumns(s, { market: true }),
      {
        key: "sea-" + c.id,
        select: c.sea,
        eligible: (o) => o.pending === "none",
        batchLabel: "申请领取",
        onBatch: (ids) =>
          (navigate("request-form", {
            type: "sea",
            customer: c.id,
            opps: ids.join(","),
          })),
        emptyTitle: "暂无可领取商机",
        emptyReason: all.length
          ? "当前没有符合产品与申请条件的空余商机。"
          : "该正式客户尚无真实商机。",
      },
    );
    if (!all.length)
      body.insertAdjacentHTML(
        "beforeend",
        B.section(
          "首批商机",
          '<div class="b2-section__body">' +
            T.link(
              "request-form",
              "申请已有客户首批商机",
              { type: "first_existing", customer: c.id },
              "btn btn--primary",
            ) +
            "</div>",
        ),
      );
  };
  T.views.requestForm = function (body, actions, s, me, meta = {}) {
    const param = key => meta.params ? meta.params[key] || "" : SC.param(key);
    const type = T.types[param("type")] ? param("type") : "first_new",
      first = type.startsWith("first"),
      customer = param("customer") || "",
      c = B.find("customers", customer, s),
      previous = s.b3.requests.find(
        (r) => r.id === param("previous") && r.actor === me.id,
      );
    const sourceOpp = (param("opps") || "").split(",")[0];
    const sourceCombo = c && T.combo(s, c.id, me.id);
    actions.innerHTML = previous
      ? T.link("my-request", "返回原申请", { id: previous.id }, "btn")
      : ["release", "restore"].includes(type) && sourceOpp
        ? T.link("opportunity", "返回商机", { id: sourceOpp }, "btn")
        : type === "new" && sourceCombo
          ? T.link(
              "combo-detail",
              "返回经营组合",
              { id: sourceCombo.id },
              "btn",
            )
          : type === "sea" && c
            ? T.link("sea-customer", "返回公海客户", { id: c.id }, "btn")
            : T.link("market", "返回商机市场", {}, "btn");
    const allowedCustomers = s.customers.filter(
      (c) =>
        !c.merged &&
        (type === "first_existing"
          ? !s.opps.some((o) => o.customer === c.id)
          : ["new", "release", "restore", "dispute", "claim"].includes(type)
            ? T.owned(s, c.id, me.id).length
            : type === "sea"
              ? c.sea
              : true),
    );
    let fields = B.field("申请类型", "type", type, {
      options: Object.entries(T.types),
    });
    if (type === "first_new")
      fields +=
        B.field("客户全称", "name", param("name") || previous?.name || "", {
          required: true,
        }) +
        '<div class="b3-form-grid">' +
        B.field("客户来源", "channel", "", {
          options: T.options([
            "自有资源转介绍",
            "线下展会",
            "官网留资",
            "销售自拓",
            "小红书",
            "抖音",
            "百度",
            "企微",
          ]),
          required: true,
        }) +
        B.field("客户阶段", "stage", "待触达", { options: B.stages }) +
        B.field("客户等级", "grade", "A", {
          options: ["S", "A", "B", "C", "D"],
        }) +
        B.field("获客时间", "acquired", "2026-09-08", {
          type: "date",
          required: true,
        }) +
        B.field("是否线索转换", "lead", "否", { options: ["是", "否"] }) +
        B.field("是否创建商机", "create", "是", { disabled: true }) +
        B.field("法人代表", "legal", "") +
        B.field("注册资金", "capital", "") +
        B.field("客户行业", "industry", "", {
          options: T.options(B.industries),
        }) +
        B.field("所属解决方案", "solution", "未启用", { disabled: true }) +
        "</div>" +
        B.field("客户地址", "address", "");
    else
      fields += B.field("客户", "customer", customer, {
        options: T.options(
          allowedCustomers.map((c) => [c.id, c.name]),
          "选择客户",
        ),
        required: true,
      });
    if (first)
      fields +=
        '<div class="b3-form-grid">' +
        B.field("首批商机归属销售", "beneficiary", me.id, {
          options: [
            ...s.people
              .filter(
                (p) =>
                  p.role === "SLS" &&
                  p.status === "on" &&
                  (p.id === me.id || T.isTeam(s, p.id, me)),
              )
              .map((p) => [p.id, p.name]),
          ],
        }) +
        B.field("客户池建议值", "pool", previous?.suggested || "", {
          options: T.poolOptions(s),
          required: true,
        }) +
        "</div>";
    if (first || type === "new")
      fields += B.field(
        "申请产品",
        "products",
        (param("products") || previous?.products?.join(",") || "")
          .split(",")
          .filter(Boolean),
        {
          options: s.products
            .filter((p) => p.active)
            .map((p) => [p.id, p.name]),
          multi: true,
          required: true,
        },
      );
    else {
      const selected = (
        param("opps") ||
        previous?.items
          .filter((i) => i.status === "rejected")
          .map((i) => i.opp)
          .join(",") ||
        ""
      ).split(",");
      const candidates = s.opps
        .filter(
          (o) =>
            o.customer === customer &&
            (["release", "restore"].includes(type)
              ? o.sales === me.id
              : type === "dispute"
                ? o.sales && o.sales !== me.id
                : !o.sales && !o.sourceSales),
        )
        .filter(
          (o) => type !== "restore" || ["closed", "lost"].includes(o.result),
        )
        .filter((o) => ["release", "dispute"].includes(type) || T.active(s, o));
      fields += B.section(
        "申请商机",
        '<div class="b2-section__body">' +
          (candidates.length
            ? candidates
                .map(
                  (o) =>
                    '<label class="b3-choice"><input type="checkbox" name="opps" value="' +
                    E(o.id) +
                    '" ' +
                    (selected.includes(o.id) ? "checked" : "") +
                    (o.pending !== "none" ? " disabled" : "") +
                    "> <span><b>" +
                    E(B.name("products", o.product, s)) +
                    '</b><span class="b2-sub">' +
                    E(o.id) +
                    " · " +
                    E(SC.OPP_RESULT[o.result]) +
                    " · " +
                    E(o.pool ? B.name("pools", o.pool, s) : "未指定") +
                    (o.pending !== "none" ? " · 有进行中事项" : "") +
                    "</span></span></label>",
                )
                .join("")
            : B.empty(c ? "无符合条件的申请对象" : "未选择客户")) +
          "</div>",
      );
    }
    fields += B.field(
      type === "restore"
        ? "恢复原因"
        : type === "release"
          ? "释放原因"
          : "申请原因",
      "reason",
      param("reason") || "",
      { required: !first, area: true },
    );
    if (type === "first_new" && param("distinct") === "1")
      fields +=
        '<label class="b3-choice"><input type="checkbox" name="distinct" checked> 已确认模糊命中客户并非同一主体</label>';
    body.innerHTML =
      '<div class="b3-process"><b>' +
      E(T.types[type]) +
      "</b>" +
      SC.icon("arrow", 14) +
      "<span>" +
      (first
        ? "首批整单审批"
        : type === "restore"
          ? "只恢复原商机，不改归属与客户池"
          : "按商机逐条审批") +
      '</span></div><form class="b3-form b3-request-form" id="request-form">' +
      fields +
      '<p class="b2-error" role="alert"></p><div class="b3-decision-footer">' +
      B.btn("核对并提交", "submit", "", "check", "btn--primary") +
      "</div></form>";
    const form = body.querySelector("#request-form");
    form.querySelector("[name=type]").onchange = (e) =>
      meta.onChange ? meta.onChange({ type: e.target.value }) : navigate("request-form", { type: e.target.value });
    form.querySelector("[name=customer]")?.addEventListener(
      "change",
      (e) =>
        (meta.onChange ? meta.onChange({ type, customer: e.target.value }) : navigate("request-form", {
          type,
          customer: e.target.value,
        })),
    );
    const handlers = {
      submit: () => {
        if (!form.reportValidity()) return;
        const data = new FormData(form),
          v = Object.fromEntries(data),
          name = (v.name || "").trim();
        if (type === "first_new") {
          const matches = T.matches(s, name);
          if (matches.some((c) => c.match === "精确")) {
            T.error(form, "客户全称已存在，请先查重并使用原客户");
            return;
          }
          if (matches.length && !v.distinct) {
            navigate("customer-search", { name });
            return;
          }
        }
        const input = {
          type,
          customer: v.customer || customer,
          name,
          beneficiary: v.beneficiary,
          pool: v.pool,
          products: data.getAll("products"),
          opps: data.getAll("opps"),
          reason: v.reason,
          distinct: !!v.distinct,
          previous: previous?.id,
          fields: {
            channel: v.channel,
            stage: v.stage,
            grade: v.grade,
            acquired: v.acquired,
            lead: v.lead,
            legal: v.legal || "",
            capital: v.capital || "",
            address: v.address || "",
            industry: v.industry || "",
            note: v.reason || "",
          },
        };
        if (!first && type !== "new" && !input.opps.length) {
          T.error(form, "请选择至少一条商机");
          return;
        }
        B.modal({
          title: "确认提交申请",
          confirm: "提交申请",
          body:
            B.kv([
              ["客户", name || B.name("customers", customer, s)],
              ["申请类型", T.types[type]],
              [
                "处理范围",
                first || type === "new"
                  ? input.products.length + " 个产品"
                  : input.opps.length + " 条商机",
              ],
              [
                "归属销售",
                first ? B.name("people", input.beneficiary, s) : me.name,
              ],
            ]) + T.bodyNote("提交仅生成申请待办，不授予归属、准入或空间权限。"),
          onConfirm: () => {
            const id = T.submitRequest(input);
            if (meta.onSubmitted) meta.onSubmitted(id);
            else navigate("my-request", { id });
          },
        });
      },
    };
    B.actions(body, handlers);
    if (meta.footer) {
      const decisions = form.querySelector('.b3-decision-footer');
      meta.footer.append(decisions);meta.footer.parentElement.hidden = false;
      B.actions(decisions, handlers);
    }
  };
})(window.SC, window.SC.B2, window.SC.B3);
