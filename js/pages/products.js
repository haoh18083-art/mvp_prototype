(function (SC, B) {
  let drawerEntry = null;
  const panelParams = ["product", "check", "productTab", "draft", "target", "create"];
  function setQuery(params) {
    const url = new URL(location.href);
    Object.entries(params).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    history.replaceState(null, "", url);
  }
  B.openProductPanel = function (href) {
    const url = new URL(href, location.href), params = {};
    panelParams.forEach((key) => { params[key] = url.searchParams.get(key); });
    const view = url.searchParams.get("view") || "products";
    const changeTab = view !== (SC.param("view") || "products");
    setQuery({ ...params, view });
    if (changeTab) B.render();
    else syncDrawer();
  };
  function wireDrawers(root) {
    root.querySelectorAll('a[href^="products.html?"]').forEach((link) => {
      const url = new URL(link.href);
      if (!url.searchParams.has("product") && !url.searchParams.has("check") && !url.searchParams.has("create")) return;
      link.setAttribute("aria-haspopup", "dialog");
      link.onclick = (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        B.openProductPanel(link.href);
      };
    });
  }
  function syncDrawer({ valid = true } = {}) {
    const identity = B.identity("ADM");
    const kind = SC.param("create") === "1" ? "create" : SC.param("check") ? "check" : "detail";
    const id = kind === "create" ? "new" : SC.param(kind === "check" ? "check" : "product");
    if (!valid || !identity.valid || identity.role !== "ADM" || !id) {
      drawerEntry?.drawer.close(true);
      return;
    }
    let entry = drawerEntry;
    if (!entry || entry.id !== id || entry.kind !== kind || entry.drawer.closed || !entry.drawer.root.isConnected) {
      drawerEntry = null;
      entry?.drawer.close(true);
      entry = { id, kind };
      entry.drawer = B.drawer({
        title: kind === "create" ? "新建产品" : kind === "check" ? "产品身份核对" : "产品详情",
        width: "min(760px, 100vw)",
        footer: '<div class="products-drawer-actions b2-actions"></div>',
        onClose: () => {
          if (drawerEntry !== entry) return;
          drawerEntry = null;
          setQuery(Object.fromEntries(panelParams.map((key) => [key, ""])));
          const row = [...document.querySelectorAll("#products-table tr[data-id]")].find((node) => node.dataset.id === id);
          (kind === "create" ? document.querySelector('#sc-page-actions a[aria-haspopup="dialog"]') : row?.querySelector("a.btn") || document.querySelector("#products-table [data-search]"))?.focus();
        },
      });
      entry.drawer.root.classList.add("products-drawer", "products-drawer--" + kind);
      drawerEntry = entry;
    }
    const content = document.createElement("div"), actions = document.createElement("div");
    const footer = entry.drawer.root.querySelector(".products-drawer-actions");
    actions.className = "products-drawer-actions-inner b2-actions";
    entry.drawer.body.replaceChildren(content);
    footer.replaceChildren(actions);
    const s = B.load();
    if (kind === "create") {
      B.productViews.create(content, actions);
    } else if (kind === "detail") {
      const tab = ["info", "opps", "history"].includes(SC.param("productTab")) ? SC.param("productTab") : "info";
      B.productViews.detail(content, actions, s, id, tab, (value) => {
        setQuery({ productTab: value });
        syncDrawer();
        entry.drawer.body.querySelector('[data-tab="' + value + '"]')?.focus();
      });
    } else B.productViews.check(content, actions, s, id, {
      isDraft: SC.param("draft") === "1", target: SC.param("target"),
    });
    footer.parentElement.hidden = !actions.childElementCount;
    wireDrawers(content);
    document.body.classList.add("b2-drawer-lock");
  }
  B.mount(
    { pid: "P-ADM-10", title: "产品管理", menu: "products", afterRender: syncDrawer },
    (body, actions) => {
      const tab = SC.param("view") === "checks" ? "checks" : "products",
        s = B.load(),
        checks = s.productChecks.filter((p) => p.state === "待核对");
      actions.innerHTML = B.link(
        "product-new",
        "新建产品",
        {},
        "btn btn--primary",
      );
      wireDrawers(actions);
      body.innerHTML =
        B.strip([
          ["全部产品", s.products.length, "全局产品主数据", "box"],
          [
            "已激活",
            s.products.filter((p) => p.active).length,
            "可用于业务申请",
            "ok",
          ],
          [
            "未激活",
            s.products.filter((p) => !p.active).length,
            "关系与历史保留",
            "clock",
          ],
          ["身份待核对", checks.length, "新来源与既有产品", "link"],
        ]) + '<div id="product-tabs"></div><div id="products-table"></div>';
      B.tabs(
        body.querySelector("#product-tabs"),
        [
          ["products", "产品清单", s.products.length],
          ["checks", "身份核对", checks.length],
        ],
        tab,
        (v) => {
          setQuery({ view: v, ...Object.fromEntries(panelParams.map((key) => [key, ""])) });
          B.render();
        },
      );
      if (tab === "products")
        B.table(
          body.querySelector("#products-table"),
          s.products,
          [
            [
              "产品",
              (p) =>
                B.entity(
                  p.name,
                  p.id,
                  "box",
                  B.href("product-detail", { id: p.id }),
                ),
            ],
            ["来源", (p) => B.badge(p.source)],
            [
              "计费类型",
              (p) =>
                p.billing
                  ? B.e(p.billing)
                  : '<span class="u-warn">待补齐</span>',
            ],
            [
              "激活状态",
              (p) =>
                B.badge(
                  p.active ? "已激活" : "未激活",
                  p.active ? "green" : "neutral",
                ),
            ],
            [
              "真实商机",
              (p) => s.opps.filter((o) => o.product === p.id).length,
            ],
            [
              "操作",
              (p) =>
                B.link(
                  "product-detail",
                  "查看详情",
                  { id: p.id },
                  "btn btn--sm",
                ),
            ],
          ],
          {
            key: "products",
            onDraw: wireDrawers,
            searchText: (p) => p.name + p.id,
            placeholder: "搜索产品名称、编号",
            filters: [
              { key: "source", label: "来源", options: ["CRM", "本地新建"] },
              {
                key: "active",
                label: "激活状态",
                options: [
                  ["true", "已激活"],
                  ["false", "未激活"],
                ],
              },
            ],
          },
        );
      else
        B.table(
          body.querySelector("#products-table"),
          s.productChecks,
          [
            ["新来源产品", (p) => B.entity(p.name, p.crm, "box")],
            ["既有业务产品", (p) => B.e(B.name("products", p.target, s))],
            [
              "核对状态",
              (p) => B.badge(p.state, p.state === "待核对" ? "amber" : "green"),
            ],
            [
              "操作",
              (p) =>
                B.link(
                  "product-check",
                  "核对身份",
                  { id: p.id },
                  "btn btn--sm",
                ),
            ],
          ],
          { key: "checks", onDraw: wireDrawers },
        );
    },
  );
})(window.SC, window.SC.B2);
