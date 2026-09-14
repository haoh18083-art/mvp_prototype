(function (SC, B) {
  B.mount(
    {
      pid: "P-ADM-09",
      title: "存量商机指定",
      menu: "pools",
      crumb: [{ t: "客户池管理", href: "pools.html" }],
    },
    (body, actions) => {
      const s = B.load(),
        rows = s.opps.filter(
          (o) => o.origin === "CRM" && (o.sales || o.sourceSales),
        );
      actions.innerHTML = B.link("pools", "返回客户池", {}, "btn");
      body.innerHTML =
        SC.note("CRM 客户池仅为来源分类；本地承接关系以本次人工指定为准。") +
        '<div class="assign-steps"><span class="is-current">1 选择商机</span><span>2 核对目标池</span><span>3 查看指定结果</span></div><div id="assign-table"></div>' +
        B.section("最近指定批次", '<div id="batch-history"></div>');
      B.table(
        body.querySelector("#assign-table"),
        rows,
        B.oppColumns(s, { source: true, space: true }),
        {
          key: "assign",
          select: true,
          batchLabel: "指定目标客户池",
          onBatch: (ids) => B.choosePool(ids),
          searchText: (o) => o.name + o.id + B.name("people", o.sales, s),
          placeholder: "客户名称、商机或销售",
          filters: [
            {
              key: "crmPool",
              label: "CRM 客户池",
              multi: true,
              value: (o) => o.crmPool || "未提供",
              options: ["北区业务", "认证服务", "重点客户", "未提供"],
            },
            {
              key: "pool",
              label: "本地客户池",
              value: (o) => o.pool || "unset",
              options: [
                ["unset", "待指定"],
                ...s.pools.map((p) => [p.id, p.name]),
              ],
            },
          ],
        },
      );
      B.table(
        body.querySelector("#batch-history"),
        s.batches,
        [
          ["批次", (b) => '<span class="mono">' + B.e(b.id) + "</span>"],
          ["目标池", (b) => B.e(B.name("pools", b.target, s))],
          ["时间", (b) => B.e(b.at)],
          [
            "成功 / 总数",
            (b) =>
              b.rows.filter((r) => r.status === "成功").length +
              " / " +
              b.rows.length,
          ],
          [
            "操作",
            (b) => B.btn("查看结果", "batch-result", b.id, "eye", "btn--sm"),
          ],
        ],
        { search: false },
      );
      B.actions(body, {
        "batch-result": (id) =>
          B.results(B.find("batches", id).rows, "指定结果", true),
      });
    },
  );
})(window.SC, window.SC.B2);
