(function (SC, B) {
  "use strict";
  B.productViews = {};
  B.productViews.create = function (body, actions) {
    let draft = { name: "", billing: "", desc: "" };
    try {
      draft = JSON.parse(sessionStorage.getItem("b2-product-draft") || "null") || draft;
    } catch {}
      body.innerHTML = B.productForm(draft, true);
      const form = body.querySelector("form");
      form.addEventListener("input", () => {
        draft = Object.fromEntries(new FormData(form));
        try {
          sessionStorage.setItem("b2-product-draft", JSON.stringify(draft));
        } catch {}
      });
      const handlers = {
        save: () => {
          if (!form.reportValidity()) return;
          try {
            const v = Object.fromEntries(new FormData(form));
            v.name = v.name.trim();
            if (!v.name) throw Error("请输入产品名称");
            const s = B.load(),
              same = s.products.find(
                (p) => v.name.includes(p.name) || p.name.includes(v.name),
              );
            const accepted =
              sessionStorage.getItem("b2-product-distinct") === v.name;
            if (same && !accepted) {
              sessionStorage.setItem("b2-product-draft", JSON.stringify(v));
              B.openProductPanel(B.href("product-check", {
                draft: "1",
                target: same.id,
              }));
              return;
            }
            let id;
            B.change((s) => {
              if (s.products.some((p) => p.name === v.name))
                throw Error("产品名称相同，请先核对产品身份");
              id = B.uid("P");
              s.products.push({
                ...v,
                id,
                source: "本地新建",
                active: false,
                ever: false,
                crm: "",
                version: 0,
                created: B.now(),
              });
              B.log(s, id, "新建产品", v.name + " · 未激活");
            });
            sessionStorage.removeItem("b2-product-draft");
            sessionStorage.removeItem("b2-product-distinct");
            B.openProductPanel(B.href("product-detail", { id }));
            B.render();
            SC.toast("产品已创建，当前未激活", "ok");
          } catch (e) {
            form.querySelector(".b2-error").textContent = e.message;
          }
        },
      };
      actions.innerHTML = B.btn("取消", "cancel-create", "", "", "") + B.btn("保存产品", "save", "", "save", "btn--primary");
      form.querySelector(".b2-actions").remove();
      handlers["cancel-create"] = () => B._drawer?.close();
      B.actions(body, handlers);
      B.actions(actions, handlers);
  };
  B.productViews.detail = function (body, actions, s, id, tab, onTab) {
    const p = B.find("products", id, s);
    if (!p) {
      body.innerHTML = B.empty("产品不存在");
      actions.innerHTML = B.link("products", "返回产品管理", {}, "btn");
      return;
    }
    actions.innerHTML = p.active
      ? B.btn("取消激活", "deactivate", id, "x", "btn--danger")
      : B.btn(
          p.ever ? "重新激活" : "激活产品",
          "activate",
          id,
          "check",
          "btn--primary",
        );
    const opps = s.opps.filter((o) => o.product === id);
    body.innerHTML =
      '<div class="b2-detail-head">' +
      B.entity(p.name, p.id, "box") +
      '<div class="u-grow"></div>' +
      B.badge(
        p.active ? "已激活" : "未激活",
        p.active ? "green" : "neutral",
      ) +
      "</div>" +
      B.section(
        "产品概况",
        '<div class="b2-section__body">' +
          B.kv([
            ["来源", p.source],
            ["计费类型", p.billing || "待补齐"],
            ["关联商机", opps.length],
            ["来源产品", p.crm || "无 CRM 对应"],
            ["创建时间", p.created],
            ["最近来源同步", p.source === "CRM" ? s.lastSuccess : "不涉及"],
          ]) +
          "</div>",
      ) +
      '<div id="product-detail-tabs"></div><div id="product-detail-body"></div>';
    B.tabs(
      body.querySelector("#product-detail-tabs"),
      [
        ["info", "基础信息"],
        ["opps", "关联商机", opps.length],
        ["history", "变更记录"],
      ],
      tab,
      (v) => {
        tab = v;
        onTab(v);
      },
    );
    const content = body.querySelector("#product-detail-body");
    if (tab === "info") content.innerHTML = B.productForm(p);
    else if (tab === "opps")
      B.table(content, opps, B.oppColumns(s, { space: true }), {
        key: id + "-opps",
        searchText: (o) => o.id + o.name,
      });
    else
      content.innerHTML = B.section(
        "产品变更记录",
        '<div class="b2-section__body">' + B.history(id) + "</div>",
      );
    const form = () => content.querySelector("form"),
      vals = () => (form() ? Object.fromEntries(new FormData(form())) : {});
    const handlers = {
      save: () => {
        try {
          B.productWrite(id, vals(), p.version);
          B.render();
          SC.toast("信息已保存，激活状态未改变", "ok");
        } catch (e) {
          form().querySelector(".b2-error").textContent = e.message;
        }
      },
      activate: () => B.activateProduct(id, vals()),
      deactivate: () => B.deactivateProduct(id),
    };
    const formActions = content.querySelector("#product-form > .b2-actions");
    if (formActions) {
      const save = formActions.querySelector('[data-action="save"]');
      save.classList.remove("btn--primary");
      actions.prepend(save);
      formActions.remove();
    }
    B.actions(body, handlers);
    B.actions(actions, handlers);
  };
  B.productViews.check = function (body, actions, s, id, { isDraft, target }) {
    let draft;
    try {
      draft = JSON.parse(sessionStorage.getItem("b2-product-draft"));
    } catch {}
    const check =
        isDraft
          ? draft && {
              ...draft,
              id: "新建草稿",
              target: target,
              state: "待核对",
              crm: "",
            }
          : B.find("productChecks", id, s),
      p = check && B.find("products", check.target, s);
    if (!check || !p) {
      body.innerHTML = B.empty("核对对象不存在");
      return;
    }
    body.innerHTML =
      SC.note("新项尚未作为独立业务产品开放；既有产品继续使用。", "warn") +
      '<div class="b2-compare"><div><h3>待核对新项</h3>' +
      B.kv([
        ["产品名称", check.name],
        ["来源", isDraft ? "本地新建草稿" : "CRM"],
        ["来源标识", check.crm || "未建立正式产品"],
        ["核对状态", check.state],
      ]) +
      "</div><div><h3>既有业务产品</h3>" +
      B.kv([
        ["产品名称", p.name],
        ["业务标识", p.id],
        ["计费类型", p.billing || "未维护"],
        ["激活状态", p.active ? "已激活" : "未激活"],
        ["已有 CRM 对应", p.crm || "无"],
        ["正式商机", s.opps.filter((o) => o.product === p.id).length],
      ]) +
      "</div></div>";
    if (check.state !== "待核对") {
      body.innerHTML += B.section(
        "核对结果",
        '<div class="b2-section__body">' +
          B.kv([
            ["结果", check.state],
            ["判断说明", check.reason],
            ["确认时间", check.at],
          ]) +
          B.link(
            "product-detail",
            "查看业务产品",
            { id: check.resolved || p.id },
            "btn u-mt4",
          ) +
          "</div>",
      );
      return;
    }
    body.innerHTML +=
      '<form class="b2-form" id="identity-form">' +
      B.field("身份判断", "decision", "", {
        options: [
          ["", "请选择判断结果"],
          ["same", "同一产品"],
          ["different", "不同产品"],
        ],
      }) +
      B.field("判断说明", "reason", "", { required: true, area: true }) +
      '<p class="b2-error" role="alert"></p><div class="b2-actions">' +
      B.btn("确认结果", "confirm", "", "check", "btn--primary") +
      "</div></form>";
    const handlers = {
      confirm: () => {
        const form = body.querySelector("form");
        if (!form.reportValidity()) return;
        try {
          const v = Object.fromEntries(new FormData(form));
          if (!v.decision) throw Error("请选择身份判断");
          if (!v.reason.trim()) throw Error("请填写判断说明");
          if (
            v.decision === "same" &&
            !isDraft &&
            p.crm &&
            p.crm !== check.crm
          )
            throw Error("该产品已有 CRM 对应，不支持多来源归并");
          if (v.decision === "different" && check.name === p.name)
            throw Error("请先使产品名称可区分，再确认不同产品");
          if (isDraft) {
            if (v.decision === "same") {
              sessionStorage.removeItem("b2-product-draft");
              B.openProductPanel(B.href("product-detail", { id: p.id }));
            } else {
              sessionStorage.setItem("b2-product-distinct", check.name);
              B.openProductPanel(B.href("product-new"));
            }
            return;
          }
          B.change((s) => {
            const x = B.find("productChecks", id, s),
              product = B.find("products", p.id, s);
            if (x.state !== "待核对" || product.version !== p.version)
              throw Error("核对信息已变化，请重新打开");
            if (v.decision === "same") {
              product.crm = check.crm;
              product.version++;
              x.resolved = p.id;
            } else {
              const newId = B.uid("P");
              s.products.push({
                id: newId,
                name: check.name,
                source: "CRM",
                crm: check.crm,
                billing: "",
                desc: "",
                active: false,
                ever: false,
                version: 0,
                created: B.now(),
              });
              x.resolved = newId;
            }
            x.state = v.decision === "same" ? "已确认同一" : "已确认不同";
            x.reason = v.reason;
            x.at = B.now();
            B.log(s, id, "确认产品身份", x.state + "：" + v.reason);
          });
          B.render();
          SC.toast("身份核对已完成", "ok");
        } catch (e) {
          form.querySelector(".b2-error").textContent = e.message;
        }
      },
    };
    actions.append(body.querySelector('[data-action="confirm"]'));
    body.querySelector("#identity-form > .b2-actions").remove();
    B.actions(body, handlers);
    B.actions(actions, handlers);
  };
})(window.SC, window.SC.B2);
