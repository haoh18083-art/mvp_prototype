(function (SC, B) {
  "use strict";
  B.productWrite = function (id, values, version, activate = false) {
    return B.change((s) => {
      const p = B.find("products", id, s);
      if (!p) throw Error("产品不存在");
      if (p.version !== version)
        throw Error("产品信息已变化，请重新读取后核对");
      const billing = p.ever ? p.billing : (values.billing ?? p.billing),
        desc = values.desc ?? p.desc;
      if (billing && !["定费", "流水型"].includes(billing))
        throw Error("请选择有效计费类型");
      if (activate && (!p.name || !billing))
        throw Error("产品名称和计费类型齐全后才能激活");
      if (p.billing !== billing || p.desc !== desc) {
        p.billing = billing;
        p.desc = desc;
        B.log(s, id, "保存产品信息", "计费：" + (billing || "未维护"));
      }
      if (activate && !p.active) {
        p.active = true;
        p.ever = true;
        B.log(s, id, "激活产品", "关联关系保持不变");
      }
      p.version++;
      return p;
    });
  };
  B.activateProduct = function (id, values = {}, done = B.render) {
    const s = B.load(),
      p = B.find("products", id, s),
      opps = s.opps.filter((o) => o.product === id);
    if (!p) return;
    B.modal({
      title: p.ever ? "重新激活产品" : "激活产品",
      confirm: "确认激活",
      body:
        B.kv([
          ["产品", p.name],
          [
            "计费类型",
            p.ever ? p.billing : values.billing || p.billing || "未维护",
          ],
          ["真实关联商机", opps.length],
        ]) +
        SC.note(
          "仅更新产品可用性。商机归属、客户池、准入及空间状态保持各自结果。",
        ),
      onConfirm: () => {
        B.productWrite(id, values, p.version, true);
        done();
        SC.toast("产品已激活", "ok");
      },
    });
  };
  B.deactivateProduct = function (id) {
    const s = B.load(),
      p = B.find("products", id, s),
      opps = s.opps.filter((o) => o.product === id);
    if (!p) return;
    B.modal({
      title: "取消产品激活",
      confirm: "确认取消激活",
      danger: true,
      wide: true,
      body:
        SC.impact({
          danger: true,
          title: p.name,
          cells: [
            { k: "关联商机", v: opps.length },
            { k: "涉及客户", v: new Set(opps.map((o) => o.customer)).size },
            {
              k: "进行中申请",
              v: opps.filter((o) => o.pending !== "none").length,
            },
          ],
          note: "产品将退出业务选择与商机展示范围。销售归属、客户池、空间、历史和既有申请保留。",
        }) +
        '<details class="b2-collapse"><summary>查看关联明细</summary>' +
        opps
          .map(
            (o) =>
              '<p class="u-mt2">' + B.e(o.id) + " · " + B.e(o.name) + "</p>",
          )
          .join("") +
        "</details>" +
        SC.note(
          "进行中方案任务 " +
            opps.reduce((n, o) => n + o.tasks, 0) +
            " 项；不自动取消或重新开启任务、合同。",
          "warn",
        ),
      onConfirm: () => {
        B.change((s) => {
          const x = B.find("products", id, s);
          if (!x || x.version !== p.version)
            throw Error("产品状态已变化，请重新核对");
          if (x.active) {
            x.active = false;
            x.version++;
            B.log(s, id, "取消激活", "保留关系与历史");
          }
        });
        B.render();
        SC.toast("产品已取消激活", "ok");
      },
    });
  };
  B.productForm = (p, create = false) =>
    '<form class="b2-form" id="product-form">' +
    B.field("产品名称", "name", p.name, {
      required: true,
      readonly: !create,
      max: 100,
    }) +
    B.field("计费类型", "billing", p.billing || "", {
      options: [
        ["", "暂未维护"],
        ["定费", "定费"],
        ["流水型", "流水型"],
      ],
      disabled: !create && p.ever,
      hint: p.ever
        ? "已确认的计费类型，仅展示当前结果。"
        : "激活前需明确确认计费类型。",
    }) +
    B.field("产品说明", "desc", p.desc || "", { area: true }) +
    '<p class="b2-error" role="alert"></p><div class="b2-actions">' +
    B.btn(
      create ? "保存产品" : "仅保存信息",
      "save",
      "",
      "save",
      "btn--primary",
    ) +
    (create
      ? B.link("products", "取消", {}, "btn")
      : !p.active
        ? B.btn(p.ever ? "重新激活" : "激活产品", "activate", "", "check")
        : "") +
    "</div></form>";
})(window.SC, window.SC.B2);
