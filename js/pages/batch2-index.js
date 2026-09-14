(function () {
  const groups = [
    [
      "客户池管理",
      [
        ["pools", "P-ADM-07", "客户池管理"],
        ["pool-detail", "P-ADM-08", "客户池详情"],
        ["pool-assign", "P-ADM-09", "存量商机指定"],
      ],
    ],
    [
      "产品管理",
      [
        ["products", "P-ADM-10", "产品清单"],
        ["product-new", "P-ADM-12", "新建产品"],
      ],
    ],
    [
      "客户信息",
      [
        ["customers", "P-ADM-22", "全量客户查看"],
        ["customer-detail", "P-CMN-03", "客户档案"],
      ],
    ],
    [
      "CRM数据管理",
      [
        ["reconcile", "P-ADM-23", "CRM数据管理总览"],
        ["sync-detail", "P-ADM-24", "接入与同步"],
        ["data-issues", "P-ADM-25", "数据异常"],
        ["source-diffs", "P-ADM-26", "来源差异"],
        ["customer-merge", "P-ADM-27", "待合并客户"],
        ["space-failures", "P-ADM-28", "空间建立失败"],
        ["agent-status", "P-ADM-29", "Agent 实例与失败清单"],
      ],
    ],
  ];
  const host = document.getElementById("batch2-index");
  host.innerHTML =
    '<div class="hub__group-head"><span class="hub__group-t">批 2 · 数据与主数据</span><div class="btn-group"><a class="btn btn--primary" href="pages/reconcile.html">进入CRM数据管理</a><button class="btn btn--sm" id="reset-batch2">重置共享演示数据</button></div></div>' +
    groups
      .map(
        ([name, pages]) =>
          '<h3 style="margin:20px 0 12px">' +
          name +
          '</h3><div class="hub__grid">' +
          pages
            .map(
              ([file, pid, title]) =>
                '<a class="hubcard" href="pages/' +
                file +
                '.html"><div class="hubcard__top"><span class="badge badge--green badge--sm">批 2</span><span class="hubcard__id">' +
                pid +
                '</span></div><div class="hubcard__t">' +
                title +
                "</div></a>",
            )
            .join("") +
          "</div>",
      )
      .join("");
  document.getElementById("reset-batch2").onclick = () => {
    if (
      confirm(
        "重置批 2、批 3 的共享演示数据和已联动的账号启停状态？将清除本地原型操作，不影响真实业务。",
      )
    ) {
      SC.B2.reset();
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("b2-view-") || k.startsWith("b2-product-"))
        .forEach((k) => sessionStorage.removeItem(k));
      alert("共享演示数据已重置，批 3 样例将在下次进入时建立。");
    }
  };
})();
