(function (SC, B) {
  let merged = SC.param("merged") === "1";
  const scope = SC.param("scope") === "sea"; // 导航子目录“公海客户”：M05-1 §4.5 只读筛选，不新增业务操作
  let moreFiltersOpen = false;
  let filterEvents;
  let comboDrawer = null;
  function setComboQuery(id) {
    const url = new URL(location.href);
    if (id) url.searchParams.set("combo", id);
    else url.searchParams.delete("combo");
    history.replaceState(null, "", url);
  }
  function syncComboDrawer({ valid = true } = {}) {
    const id = SC.param("combo"), previous = comboDrawer;
    comboDrawer = null;
    previous?.close(true);
    if (!id) return;
    const identity = B.identity("ADM"), T = SC.B3;
    if (!valid || !identity.valid || identity.role !== "ADM") {
      setComboQuery("");
      return;
    }
    T.role = identity.role;
    T.actorId = identity.id;
    T.render = B.render;
    T.ensure();
    const drawer = T.openCombo(id, {
      onClose: () => {
        if (comboDrawer !== drawer) return;
        comboDrawer = null;
        if (SC.param("combo") === id) setComboQuery("");
      },
    });
    comboDrawer = drawer || null;
    if (!drawer) setComboQuery("");
  }
  const values = (items) => items.length
    ? '<div class="customer-values">' + items.map((item) => '<span>' + B.e(item) + '</span>').join("") + '</div>'
    : '<span class="customer-muted">—</span>';

  function renderStats(items) {
    return '<dl class="customers-stats" aria-label="客户统计">' + items.map(([label, value, detail], index) => {
      const global = detail === "全局";
      const tone = index === 0 ? " customers-stat--primary" : global && value > 0 ? " customers-stat--pending" : "";
      return '<div class="customers-stat' + tone + '"><dt class="customers-stat__label">' + B.e(label) +
        (global ? '<span class="customers-stat__scope" title="不受列表筛选影响">全局</span>' : "") +
        '</dt><dd class="customers-stat__data"><span class="customers-stat__value">' + B.e(value) + '</span>' +
        (global ? '<a class="customers-stat__link" href="' + B.e(B.href("customer-merge")) +
          '" aria-label="查看全局待合并客户清单">查看' + SC.icon("arrow", 14) + '</a>' : "") +
        '</dd></div>';
    }).join("") + '</dl>';
  }

  // Keep the shared table's filtering and saved state; adapt only its controls here.
  function arrangeFilters(root) {
    filterEvents?.abort();
    filterEvents = new AbortController();
    const toolbar = root.querySelector(".b2-toolbar");
    const fields = [...toolbar.querySelectorAll(".field")];
    const primary = document.createElement("div");
    primary.className = "customers-filter-main";
    const advanced = document.createElement("div");
    advanced.className = "customers-filter-more";
    advanced.id = "customers-more-filters";
    const advancedKeys = ["industry", "grade", "stage", "sea"];
    fields.forEach((field) => {
      const control = field.querySelector("[data-filter]");
      (advancedKeys.includes(control?.dataset.filter) ? advanced : primary).append(field);
    });
    const more = document.createElement("button");
    more.type = "button";
    more.className = "btn customers-more-toggle";
    more.setAttribute("aria-controls", advanced.id);
    const clear = toolbar.querySelector('[data-action="clear"]');
    clear.className = "btn btn--link customers-filter-reset";
    clear.innerHTML = "重置";
    primary.append(more, clear);
    toolbar.replaceChildren(primary, advanced);
    const advancedControls = [...advanced.querySelectorAll("[data-filter]")];
    const activeAdvanced = () => advancedControls.filter((control) => control.value).length;
    moreFiltersOpen = moreFiltersOpen || activeAdvanced() > 0;

    const menus = [];
    root.querySelectorAll('select[multiple]').forEach((select) => {
      const field = select.closest(".field");
      const oldLabel = field.querySelector("label");
      const label = document.createElement("span");
      label.className = "field__label";
      label.id = "customers-filter-" + select.dataset.filter + "-label";
      label.textContent = oldLabel.firstChild.textContent.trim();
      const menu = document.createElement("details");
      menu.className = "customers-multi";
      menu.innerHTML = '<summary aria-labelledby="' + label.id + ' customers-filter-' + select.dataset.filter + '-value">' +
        '<span id="customers-filter-' + select.dataset.filter + '-value" data-multi-value></span>' + SC.icon("chevron", 14) + '</summary>' +
        '<div class="customers-multi-panel"><button type="button" class="customers-multi-clear">清除本项</button>' +
        '<div class="customers-multi-options" role="group" aria-labelledby="' + label.id + '">' +
        [...select.options].filter((option) => option.value).map((option) =>
          '<label><input type="checkbox" value="' + B.e(option.value) + '"><span>' + B.e(option.textContent) + '</span></label>',
        ).join("") + '</div></div>';
      select.hidden = true;
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      field.replaceChildren(label, menu, select);
      const sync = () => {
        const chosen = [...select.selectedOptions].filter((option) => option.value);
        menu.querySelector("[data-multi-value]").textContent = !chosen.length ? "全部" : chosen.length === 1 ? chosen[0].textContent : "已选 " + chosen.length + " 项";
        menu.querySelector("summary").title = chosen.map((option) => option.textContent).join("、") || "全部";
        menu.classList.toggle("has-selection", chosen.length > 0);
        menu.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.checked = chosen.some((option) => option.value === input.value);
        });
      };
      menu.addEventListener("change", () => {
        const checked = [...menu.querySelectorAll('input:checked')].map((input) => input.value);
        [...select.options].forEach((option) => { option.selected = checked.includes(option.value); });
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      menu.querySelector(".customers-multi-clear").onclick = () => {
        [...select.options].forEach((option) => { option.selected = false; });
        select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      menu.addEventListener("toggle", () => {
        if (menu.open) menus.forEach((entry) => { if (entry.menu !== menu) entry.menu.open = false; });
      });
      menus.push({ menu, sync });
    });
    const sync = () => {
      menus.forEach((entry) => entry.sync());
      advanced.hidden = !moreFiltersOpen;
      const n = activeAdvanced();
      more.innerHTML = SC.icon("filter", 15) + (moreFiltersOpen ? "收起筛选" : "更多筛选") + (n ? '<span class="customers-filter-count">' + n + '</span>' : "");
      more.setAttribute("aria-expanded", String(moreFiltersOpen));
    };
    more.onclick = () => { moreFiltersOpen = !moreFiltersOpen; sync(); };
    document.addEventListener("pointerdown", (event) => {
      menus.forEach(({ menu }) => { if (!menu.contains(event.target)) menu.open = false; });
    }, { signal: filterEvents.signal });
    root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const entry = menus.find(({ menu }) => menu.open);
      if (entry) { entry.menu.open = false; entry.menu.querySelector("summary").focus(); }
    });
    return sync;
  }

  B.mount(
    {
      pid: "P-ADM-22",
      title: scope ? "全量客户查看 · 公海客户" : "全量客户查看",
      menu: scope ? "allcust-sea" : "allcust",
      crumb: scope ? [{ t: "全量客户查看", href: "customers.html" }] : [],
      afterRender: syncComboDrawer,
    },
    (body, actions) => {
      const s = B.load(),
        formal = s.customers.filter((c) => !c.merged),
        rows = s.customers.filter((c) => (merged || !c.merged) && (!scope || c.sea));
      actions.innerHTML = "";
      const stats = scope
        ? [
            ["公海客户", formal.filter((c) => c.sea).length],
            [
              "待合并对",
              s.merges.filter((m) => m.state === "待处理").length,
              "全局",
            ],
          ]
        : [
            ["正式客户", formal.length],
            [
              "公海客户",
              formal.filter((c) => c.sea).length,
            ],
            [
              "无已归属商机",
              formal.filter((c) => !B.owned(c.id, s).length).length,
            ],
            [
              "待合并对",
              s.merges.filter((m) => m.state === "待处理").length,
              "全局",
            ],
          ];
      body.innerHTML =
        '<section class="customers-panel" aria-label="客户档案列表">' +
        renderStats(stats) + '<div class="customers-list-head"><h2>' + (scope ? "公海客户列表" : "客户列表") + '<span id="customers-result-count" aria-live="polite"></span></h2>' +
        '<label class="customers-include-merged"><input id="include-merged" type="checkbox" ' + (merged ? "checked" : "") +
        '>含已合并档案</label></div><div id="customers-table"></div></section>';
      body.querySelector("#include-merged").onchange = (e) => {
        merged = e.target.checked;
        const url = new URL(location.href);
        url.searchParams.set("merged", merged ? "1" : "0");
        history.replaceState(null, "", url);
        B.render();
      };
      const columns = [
        [
          "客户",
          (c) =>
            '<div class="customer-identity">' + B.link("customer-detail", c.name, { id: c.id }, "customer-name") +
            '<div class="customer-identity__meta"><span class="customer-id">' + B.e(c.id) + '</span>' +
            (c.merged ? B.badge("已合并", "neutral") : "") + '</div></div>',
        ],
        [
          "来源 / 归属人",
          (c) =>
            '<span class="customer-source">' + B.e(c.source) + '</span>' +
            '<div class="b2-sub customer-owner">' +
            B.e(c.owner) +
            "</div>",
        ],
        ["归属销售分组", (c) => values(B.groups(c.id, s))],
        [
          "所属客户池",
          (c) =>
            values(
              B.poolsFor(c.id, s).map((id) =>
                id ? B.name("pools", id, s) : "待指定",
              ),
            ),
        ],
        [
          "已归属 / 空余",
          (c) =>
            '<span class="customer-opp-count"><strong>' + B.owned(c.id, s).length +
            '</strong><span class="customer-count-divider">/</span><span>' +
            s.opps.filter(
              (o) => o.customer === c.id && !o.sales && !o.sourceSales,
            ).length + '</span></span>',
        ],
        [
          "阶段 / 等级",
          (c) =>
            B.e(c.stage) + '<div class="b2-sub">' + B.e(c.grade) + " 级</div>",
        ],
        scope
          ? ["进入公海时间", (c) => '<span class="b2-sub mono">' + B.e(c.seaAt || "—") + "</span>"]
          : ["公海", (c) => (c.sea ? '<span class="customer-sea">公海</span>' : '<span class="customer-muted">否</span>')],
        [
          "经营组合",
          (c) => B.btn("展开", "combos", c.id, "chevron", "btn--link customer-expand"),
        ],
      ];
      const tableRoot = body.querySelector("#customers-table");
      let syncFilters = () => {};
      B.table(tableRoot, rows, columns, {
        key: scope ? "customers-sea" : "customers",
        searchText: (c) => c.id + c.name,
        placeholder: "搜索客户名称或编号",
        onDraw: (root) => {
          root.querySelectorAll('[data-action="combos"]').forEach((button) => {
            button.setAttribute("aria-expanded", "false");
            button.setAttribute("aria-controls", "customer-combos-" + button.dataset.id);
          });
          syncFilters();
        },
        onFilter: (matches) => {
          body.querySelector("#customers-result-count").textContent = "共 " + matches.length + " 条";
          const current = matches.filter((c) => !c.merged);
          const statValues = scope
            ? [current.filter((c) => c.sea).length]
            : [
                current.length,
                current.filter((c) => c.sea).length,
                current.filter((c) => !B.owned(c.id, s).length).length,
              ];
          body.querySelectorAll(".customers-stat__value").forEach((el, i) => {
            if (i < statValues.length) el.textContent = statValues[i];
          });
        },
        filters: [
          {
            key: "groups",
            label: "归属销售分组",
            multi: true,
            value: (c) =>
              B.groups(c.id, s).length ? B.groups(c.id, s) : ["无"],
            options: [...new Set([...s.customers.flatMap((c) => B.groups(c.id, s)), "待分组", "无"])],
          },
          {
            key: "pools",
            label: "所属客户池",
            multi: true,
            value: (c) => B.poolsFor(c.id, s).map((v) => v || "unset"),
            options: [
              ...s.pools.map((p) => [p.id, p.name]),
              ["unset", "待指定"],
            ],
          },
          { key: "source", label: "来源", options: ["CRM", "本地新建"] },
          {
            key: "industry",
            label: "客户行业",
            options: [...new Set(s.customers.map((c) => c.industry))],
          },
          {
            key: "grade",
            label: "客户等级",
            options: ["S", "A", "B", "C", "D"],
          },
          { key: "stage", label: "客户阶段", options: B.stages },
          ...(scope
            ? []
            : [
                {
                  key: "sea",
                  label: "是否公海",
                  options: [
                    ["true", "是"],
                    ["false", "否"],
                  ],
                },
              ]),
        ],
        ...(scope
          ? { emptyTitle: "暂无公海客户", emptyReason: "当前没有客户处于公海状态。" }
          : {}),
      });
      syncFilters = arrangeFilters(tableRoot);
      syncFilters();
      const scroll = tableRoot.querySelector(".b2-table-scroll");
      scroll.tabIndex = 0;
      scroll.setAttribute("role", "region");
      scroll.setAttribute("aria-label", "客户列表，可横向滚动查看全部列");
      B.actions(body, {
        combos: (id, button) => {
          const row = button.closest("tr"),
            existing = row.nextElementSibling;
          if (existing?.classList.contains("customer-combos")) {
            existing.remove();
            button.setAttribute("aria-expanded", "false");
            button.innerHTML = SC.icon("chevron") + "展开";
            return;
          }
          const combos = s.combos.filter(
            (c) =>
              c.customer === id && !c.ended &&
              B.owned(id, s).some((o) => o.sales === c.sales),
          );
          const detail = document.createElement("tr");
          detail.className = "customer-combos";
          detail.id = "customer-combos-" + id;
          detail.innerHTML =
            '<td colspan="' +
            columns.length +
            '">' +
            (combos.length
              ? combos
                  .map((c) => {
                    const spaces = s.spaces.filter(
                        (w) => w.customer === id && w.sales === c.sales,
                      ),
                      opps = B.owned(id, s).filter((o) => o.sales === c.sales);
                    return (
                      '<div class="customer-combo"><div class="customer-combo__head"><b>' +
                      B.e(B.name("people", c.sales, s)) +
                      "</b>" +
                      B.badge(
                        c.admit,
                        c.admit === "已通过" ? "green" : "neutral",
                      ) +
                      '<span class="b2-sub">' +
                      opps.length +
                      " 条归属商机</span>" +
                      B.btn(
                        "查看组合",
                        "future-combo",
                        c.id,
                        "arrow",
                        "btn--link",
                      ) +
                      "</div>" +
                      spaces
                        .map(
                          (w) =>
                            '<div class="customer-space"><span>' +
                            B.e(B.name("pools", w.pool, s)) +
                            '</span><span class="mono">' +
                            B.e(w.id) +
                            "</span>" +
                            SC.spaceState(w.status, {
                              empty: !s.opps.some(
                                (o) =>
                                  o.sales === w.sales &&
                                  o.customer === w.customer &&
                                  o.pool === w.pool &&
                                  B.find("products", o.product, s)?.active,
                              ),
                            }) +
                            (["normal", "archived", "frozen"].includes(w.status)
                              ? B.btn(
                                  "只读查看",
                                  "future-space",
                                  w.id,
                                  "eye",
                                  "btn--link",
                                )
                              : "") +
                            "</div>",
                        )
                        .join("") +
                      (!spaces.length
                        ? '<p class="b2-sub">未建立空间</p>'
                        : "") +
                      "</div>"
                    );
                  })
                  .join("")
              : B.empty("尚无经营组合", "客户主档保留，当前没有已归属商机。")) +
            "</td>";
          row.after(detail);
          detail.querySelectorAll('[data-action="future-combo"]').forEach((entry) => {
            entry.setAttribute("aria-haspopup", "dialog");
          });
          button.setAttribute("aria-expanded", "true");
          button.innerHTML = SC.icon("chevron") + "收起";
        },
        "future-combo": (id) => {
          setComboQuery(id);
          syncComboDrawer();
        },
        "future-space": (id) => B.future("客户工作空间", id),
      });
    },
  );
})(window.SC, window.SC.B2);
