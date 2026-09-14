/* Shared customer archive renderer; each instance owns its tab and edit state. */
(function(SC,B){
  B.customerView=function(options={}){
    const id=options.id||SC.param("id")||"C-1001";
    let tab=options.view||SC.param("view")||"profile",editing=false;
    const refresh=()=>options.refresh?options.refresh():B.render();
    return function(body,actions){
      const s = B.load(),
        c = B.find("customers", id, s);
      if (!c) {
        body.innerHTML = B.empty("客户档案不存在");
        return;
      }
      const me = B.identity(B.role).person;
      if (!adminRoleValid()) { body.innerHTML = B.empty("无权查看客户内容", "当前人员身份或账号不可用。"); return; }
      function adminRoleValid() { return B.role === "ADM" || me?.role === B.role && me.status === "on"; }
      const all = s.opps.filter((o) => o.customer === id),
        own = all.filter((o) => o.sales === me?.id),
        admin = B.role === "ADM";
      const visible = admin
        ? all
        : B.role === "SOL"
          ? all.filter(
              (o) =>
                o.pool &&
                o.pool === me?.pool &&
                B.find("products", o.product, s)?.active,
            )
          : B.role === "MGR"
            ? all.filter(
                (o) => B.isTeam(s, o.sales, me),
              )
            : all.filter(
                (o) =>
                  o.sales === me?.id ||
                  B.find("products", o.product, s)?.active,
              );
      const limited = B.role === "SLS" && !own.length;
      if (
        (B.role === "SOL" && !visible.length) ||
        (B.role === "MGR" && !visible.length)
      ) {
        body.innerHTML = B.empty(
          "无权查看客户内容",
          "当前承接或分组关系不包含该客户。",
        );
        return;
      }
      const editable =
        c.source === "本地新建" &&
        !c.merged &&
        (admin || (B.role === "SLS" && own.length));
      actions.innerHTML =
        editable && !editing
          ? B.btn("编辑基础信息", "edit", "", "edit", "btn--primary")
          : "";
      body.innerHTML =
        '<div class="b2-detail-head">' +
        B.entity(c.name, c.id, "building") +
        '<div class="u-grow"></div>' +
        B.badge(c.source) +
        (c.sea ? B.badge("公海", "amber") : "") +
        "</div>";
      if (c.merged)
        body.innerHTML += SC.note(
          "该档案已合并至 " +
            B.link("customer-detail", B.name("customers", c.merged, s), {
              id: c.merged,
              role: B.role,
            }) +
            "，原档案只读保留。",
        );
      const tabs = limited
        ? [["opps", "商机归属"]]
        : [
            ["profile", "基础档案"],
            ["contacts", "联系人", c.contacts.length],
            ["opps", "商机归属", visible.length],
            ...(c.source === "CRM" ? [["source", "全量信息"]] : []),
            ["history", "变更历史"],
          ];
      if (!tabs.some((t) => t[0] === tab)) tab = tabs[0][0];
      body.innerHTML +=
        '<div id="customer-tabs"></div><div id="customer-body"></div>';
      B.tabs(body.querySelector("#customer-tabs"), tabs, tab, (v) => {
        if (editing && !confirm("尚有未保存内容，确认离开编辑？")) return;
        editing = false;
        tab = v;
        if (options.onTab) options.onTab(v);
        else history.replaceState(null, "", "?" + new URLSearchParams({ id, role: B.role, as: me?.id || B.identity(B.role).id, view: v }));
        refresh();
      });
      const root = body.querySelector("#customer-body");
      if (editing && editable) {
        root.innerHTML =
          '<form class="b2-form customer-form">' +
          B.field("客户全称", "name", c.name, {
            required: true,
            readonly: !admin,
          }) +
          '<div class="b2-form-grid">' +
          B.field("客户归属人", "owner", c.owner, {
            options: [
              [c.owner, c.owner],
              ...s.people
                .filter(
                  (p) =>
                    p.role === "SLS" &&
                    p.name !== c.owner &&
                    (admin || B.isTeam(s, p.id, me)),
                )
                .map((p) => [p.name, p.name]),
            ],
          }) +
          B.field(
            "客户行业",
            "industry",
            B.industries.includes(c.industry) ? c.industry : "其他",
            {
              options: [...B.industries, "其他"],
            },
          ) +
          B.field("客户阶段", "stage", c.stage, { options: B.stages }) +
          B.field("客户等级", "grade", c.grade, {
            options: ["S", "A", "B", "C", "D"],
          }) +
          B.field("客户来源", "channel", c.channel, {
            options: [
              "自有资源转介绍",
              "线下展会",
              "官网留资",
              "销售自拓",
              "小红书",
              "抖音",
              "百度",
              "企微",
            ],
          }) +
          B.field("获客时间", "acquired", c.acquired, {
            type: "date",
            required: true,
          }) +
          B.field("法人代表", "legal", c.legal) +
          B.field("注册资金", "capital", c.capital) +
          B.field("是否线索转换", "lead", c.lead, { options: ["是", "否"] }) +
          B.field("是否创建商机", "create", "是", { disabled: true }) +
          '</div><div class="u-mt4">' +
          '<div id="industry-other">' +
          B.field(
            "其他行业",
            "industryOther",
            B.industries.includes(c.industry) ? "" : c.industry,
          ) +
          "</div>" +
          B.field("意向产品", "intents", c.intents, {
            multi: true,
            required: true,
            options: s.products
              .filter((p) => p.active || c.intents.includes(p.id))
              .map((p) => [
                p.id,
                p.name + (p.active ? "" : "（未激活，原记录）"),
              ]),
          }) +
          B.field("客户地址", "address", c.address) +
          B.field("备注", "note", c.note, { area: true }) +
          '</div><p class="b2-error" role="alert"></p><div class="b2-actions">' +
          B.btn("保存", "save", "", "save", "btn--primary") +
          B.btn("取消", "cancel", "", "close") +
          "</div></form>";
        const industry = root.querySelector("[name=industry]");
        const toggleIndustry = () => {
          const other = root.querySelector("#industry-other");
          const input = other.querySelector("input");
          other.hidden = industry.value !== "其他";
          input.disabled = other.hidden;
          input.required = !other.hidden;
        };
        industry.onchange = toggleIndustry;
        toggleIndustry();
      } else if (tab === "profile") {
        const rows = [
          ["客户归属人", c.owner],
          ["法人代表", c.legal || "未提供"],
          ["注册资金", c.capital || "未提供"],
          ["客户行业", c.industry],
          ["客户阶段", c.stage],
          ["客户等级", c.grade],
          ["客户来源", c.channel],
          ["获客时间", c.acquired],
          ["创建人", c.creator],
          ["客户地址", c.address],
          ["是否线索转换", c.lead],
          ["是否创建商机", c.source === "本地新建" ? "是" : "来源资料"],
          ["所属解决方案", "未启用"],
          [
            "意向产品",
            c.intents.map((id) => B.name("products", id, s)).join("、"),
          ],
          ["备注", c.note],
        ];
        root.innerHTML =
          B.section(
            "基础信息",
            '<div class="b2-section__body">' + B.kv(rows) + "</div>",
          ) +
          B.section(
            "派生信息",
            '<div class="b2-section__body"><dl class="b2-kv">' +
              (admin
                ? "<div data-customer-groups><dt>归属销售分组</dt><dd>" +
                  B.tags(B.groups(id, s)) +
                  "</dd></div>"
                : "") +
              "<div><dt>所属客户池</dt><dd>" +
              B.tags(
                [...new Set(visible.map((o) => o.pool))].map((p) =>
                  p ? B.name("pools", p, s) : "待指定",
                ),
              ) +
              "</dd></div><div><dt>已归属 / 空余商机</dt><dd>" +
              visible.filter((o) => o.sales).length +
              " / " +
              visible.filter((o) => !o.sales && !o.sourceSales).length +
              "</dd></div><div><dt>进入公海时间</dt><dd>" +
              B.e(c.seaAt || "未处于公海") +
              "</dd></div></dl></div>",
          );
      } else if (tab === "contacts")
        B.table(
          root,
          c.contacts.map((x, i) => ({ ...x, id: "contact-" + i })),
          [
            ["姓名", (p) => B.entity(p.name, "", "users")],
            ["职位", (p) => B.e(p.job)],
            ["电话", (p) => B.e(p.phone)],
            ["邮箱", (p) => B.e(p.email)],
            ["主要联系人", (p) => (p.main ? B.badge("是", "green") : "否")],
          ],
          {
            search: false,
            emptyTitle: "暂无联系人",
            emptyReason: "当前客户尚无联系人资料。",
          },
        );
      else if (tab === "source")
        root.innerHTML = B.section(
          "CRM 未映射信息",
          '<div class="b2-section__body">' +
            B.kv(Object.entries(c.extras)) +
            "</div>",
        );
      else if (tab === "history")
        root.innerHTML = B.section(
          "基础资料变更",
          '<div class="b2-section__body">' + B.history(id) + "</div>",
        );
      else
        B.table(
          root,
          visible,
          [
            ["商机", (o) => B.entity(o.name, o.id, "box")],
            ["产品", (o) => B.e(B.name("products", o.product, s))],
            [
              "当前归属",
              (o) =>
                B.e(
                  o.sales
                    ? B.name("people", o.sales, s)
                    : o.sourceSales || "空余",
                ),
            ],
            [
              "销售所属分组",
              (o) =>
                B.e(
                  o.sales
                    ? B.find("people", o.sales, s)?.group || "待分组"
                    : "无",
                ),
            ],
            [
              "经营结果",
              (o) =>
                B.badge(
                  SC.OPP_RESULT[o.result],
                  o.result === "active" ? "green" : "neutral",
                ),
            ],
            [
              "进行中事项",
              (o) =>
                B.e(
                  !admin && o.sales !== me?.id
                    ? o.pending === "release"
                      ? "无"
                      : o.pending !== "none"
                        ? "有进行中申请"
                        : "无"
                    : SC.OPP_PENDING[o.pending],
                ),
            ],
            ...(!limited
              ? [
                  [
                    "操作",
                    (o) => B.btn("查看商机", "future", o.id, "eye", "btn--sm"),
                  ],
                ]
              : []),
          ],
          { key: id + "-" + B.role, searchText: (o) => o.id + o.name },
        );
      B.actions(actions, {
        edit: () => {
          editing = true;
          tab = "profile";
          refresh();
        },
      });
      const handlers = {
        cancel: () => {
          editing = false;
          refresh();
        },
        future: (oid) => B.future("商机详情", oid),
        save: () => {
          const form = root.querySelector("form");
          if (!form.reportValidity()) return;
          try {
            const v = Object.fromEntries(new FormData(form));
            v.intents = new FormData(form).getAll("intents");
            if (v.industry === "其他") {
              if (!v.industryOther?.trim()) throw Error("请填写其他行业");
              v.industry = v.industryOther.trim();
            }
            delete v.industryOther;
            v.name = v.name.trim();
            B.change((s) => {
              const current = B.find("customers", id, s);
              if (
                current.source !== "本地新建" ||
                current.merged ||
                (!admin &&
                  !s.opps.some((o) => o.customer === id && o.sales === me.id))
              )
                throw Error("当前已无编辑权限");
              if (
                admin &&
                s.customers.some(
                  (x) => x.id !== id && x.name === v.name && !x.merged,
                )
              )
                throw Error("客户全称已存在");
              if (!admin) v.name = current.name;
              if (
                v.intents.some(
                  (id) =>
                    !current.intents.includes(id) &&
                    !B.find("products", id, s)?.active,
                )
              )
                throw Error("意向产品已取消激活，请重新选择");
              const changes = Object.entries(v)
                .filter(
                  ([k, val]) =>
                    JSON.stringify(current[k]) !== JSON.stringify(val),
                )
                .map(
                  ([k, val]) => k + ": " + (current[k] || "空") + " → " + val,
                );
              Object.assign(current, v);
              if (changes.length)
                B.log(s, id, "维护客户基础信息", changes.join("；"));
            });
            editing = false;
            refresh();
            SC.toast("客户基础信息已保存", "ok");
          } catch (e) {
            form.querySelector(".b2-error").textContent = e.message;
          }
        },
      };
      B.actions(body, handlers);
      if (options.footer) {
        const decisions = root.querySelector('form .b2-actions');
        if (decisions) { options.footer.append(decisions);options.footer.parentElement.hidden=false;B.actions(decisions,handlers); }
      }

    };
  };
})(window.SC,window.SC.B2);
