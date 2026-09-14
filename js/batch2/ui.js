(function (SC, B) {
  "use strict";
  const E = SC.esc;
  const aliases = {
    sitemap: "Network",
    layers: "Layers",
    box: "Package",
    gavel: "Gavel",
    building: "Building2",
    sync: "RefreshCw",
    shield: "ShieldCheck",
    sliders: "SlidersHorizontal",
    grid: "LayoutDashboard",
    alert: "TriangleAlert",
    search: "Search",
    file: "FileText",
    mic: "Mic",
    chat: "MessagesSquare",
    chevron: "ChevronRight",
    close: "X",
    plus: "Plus",
    upload: "Upload",
    download: "Download",
    copy: "Copy",
    key: "KeyRound",
    link: "ExternalLink",
    inbox: "Inbox",
    empty: "Inbox",
    clock: "Clock3",
    info: "Info",
    warn: "TriangleAlert",
    ok: "CircleCheck",
    x: "CircleX",
    retry: "RotateCw",
    arrow: "ArrowRight",
    users: "Users",
    check: "Check",
    eye: "Eye",
    edit: "Pencil",
    trash: "Trash2",
    back: "ArrowLeft",
    filter: "ListFilter",
    save: "Save",
    lock: "LockKeyhole",
    bot: "Bot",
    database: "Database",
    history: "History",
    logout: "LogOut",
  };
  if (window.lucide)
    SC.icon = (name, size = 16) => {
      const node = lucide.createElement(
        lucide[aliases[name] || name] || lucide.Info,
      );
      Object.entries({
        width: size,
        height: size,
        "stroke-width": 1.6,
        "aria-hidden": "true",
        class: "ico",
      }).forEach(([key, value]) => node.setAttribute(key, value));
      return node.outerHTML;
    };
  B.e = E;
  B.role = B.identity("ADM").role;
  if (!SC.DATA.ROLES[B.role]) B.role = "ADM";
  B.href = (page, params = {}) => {
    const identity = B.identity(params.role || B.role);
    if (page === "product-new") {
      page = "products";
      params = { ...params, create: "1" };
    }
    if (page === "product-detail" || page === "product-check") {
      const { id, view, ...rest } = params;
      const detail = page === "product-detail";
      params = {
        ...rest,
        view: detail ? "products" : "checks",
        [detail ? "product" : "check"]: id || (detail ? "P-103" : rest.draft === "1" ? "draft" : "PC-01"),
        ...(detail && view ? { productTab: view } : {}),
      };
      page = "products";
    }
    return page + ".html?" + new URLSearchParams({ role: identity.role, as: identity.id || "", ...params });
  };
  B.link = (page, label, params = {}, cls = "") =>
    '<a class="' +
    cls +
    '" href="' +
    E(B.href(page, params)) +
    '">' +
    E(label) +
    "</a>";
  B.btn = (label, action, id = "", icon = "", cls = "") =>
    '<button type="button" class="btn ' +
    cls +
    '" data-action="' +
    E(action) +
    '" data-id="' +
    E(id) +
    '">' +
    (icon ? SC.icon(icon) : "") +
    E(label) +
    "</button>";
  B.iconBtn = (label, action, id, icon) =>
    '<button type="button" class="btn btn--icon btn--sm" title="' +
    E(label) +
    '" aria-label="' +
    E(label) +
    '" data-action="' +
    E(action) +
    '" data-id="' +
    E(id) +
    '">' +
    SC.icon(icon) +
    "</button>";
  B.badge = (v, tone = "neutral") => SC.badge(v, tone, { dot: true });
  B.tags = (values) =>
    '<div class="b2-tags">' +
    (values.length ? values : ["无"])
      .map((v) => SC.badge(v, "neutral", { sm: true }))
      .join("") +
    "</div>";
  B.entity = (label, id, icon = "building", link = "") =>
    '<div class="b2-entity"><span class="b2-entity__mark">' +
    SC.icon(icon, 18) +
    '</span><div class="b2-entity__text">' +
    (link
      ? '<a class="b2-name" href="' + E(link) + '">' + E(label) + "</a>"
      : '<span class="b2-name">' + E(label) + "</span>") +
    '<div class="b2-sub mono">' +
    E(id) +
    "</div></div></div>";
  B.stat = (label, value, detail = "", icon = "") =>
    '<div class="b2-stat"><div class="b2-stat__label">' +
    (icon ? SC.icon(icon) : "") +
    E(label) +
    '</div><div class="b2-stat__value">' +
    E(value) +
    '</div><div class="b2-stat__detail">' +
    E(detail) +
    "</div></div>";
  B.strip = (items) =>
    '<div class="b2-strip">' +
    items.map((i) => B.stat(...i)).join("") +
    "</div>";
  B.section = (title, content, actions = "") =>
    '<section class="b2-section"><div class="b2-section__head"><h2>' +
    E(title) +
    '</h2><div class="b2-actions">' +
    actions +
    "</div></div>" +
    content +
    "</section>";
  B.kv = (rows) =>
    '<dl class="b2-kv">' +
    rows
      .map(
        (r) =>
          "<div><dt>" +
          E(r[0]) +
          "</dt><dd>" +
          E(r[1] ?? "未提供") +
          "</dd></div>",
      )
      .join("") +
    "</dl>";
  B.empty = (title = "无符合条件的记录", reason = "") =>
    '<div class="b2-empty">' +
    SC.icon("empty", 28) +
    "<h3>" +
    E(title) +
    "</h3><p>" +
    E(reason) +
    "</p></div>";
  B.field = (label, name, value = "", opts = {}) =>
    '<div class="field"><label class="field__label" for="f-' +
    E(name) +
    '">' +
    E(label) +
    (opts.required
      ? ' <span class="u-danger" aria-hidden="true">*</span>'
      : "") +
    "</label>" +
    (opts.options
      ? '<select class="select" id="f-' +
        E(name) +
        '" aria-label="' +
        E(label) +
        '" name="' +
        E(name) +
        '" ' +
        (opts.disabled ? "disabled" : "") +
        (opts.required ? " required" : "") +
        (opts.multi ? ' multiple size="3"' : "") +
        ">" +
        opts.options
          .map((x) => {
            const [v, t] = Array.isArray(x) ? x : [x, x];
            return (
              '<option value="' +
              E(v) +
              '" ' +
              ((opts.multi ? (value || []).includes(v) : v === value)
                ? "selected"
                : "") +
              ">" +
              E(t) +
              "</option>"
            );
          })
          .join("") +
        "</select>"
      : opts.area
        ? '<textarea class="textarea" id="f-' +
          E(name) +
          '" aria-label="' +
          E(label) +
          '" name="' +
          E(name) +
          '" ' +
          (opts.required ? "required" : "") +
          ">" +
          E(value) +
          "</textarea>"
        : '<input class="input" type="' +
          (opts.type || "text") +
          '" id="f-' +
          E(name) +
          '" aria-label="' +
          E(label) +
          '" name="' +
          E(name) +
          '" value="' +
          E(value) +
          '" ' +
          (opts.required ? "required " : "") +
          (opts.disabled ? "disabled " : "") +
          (opts.readonly ? "readonly " : "") +
          (opts.max ? 'maxlength="' + opts.max + '"' : "") +
          ">") +
    (opts.hint ? '<p class="field__hint">' + E(opts.hint) + "</p>" : "") +
    "</div>";
  B.actions = (root, handlers) =>
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b || !root.contains(b) || b.disabled) return;
      const fn = handlers[b.dataset.action];
      if (fn) fn(b.dataset.id, b, e);
    });
  B.tabs = (root, items, active, change) => {
    root.innerHTML =
      '<div class="tabs" role="tablist">' +
      items
        .map(
          ([key, label, n]) =>
            '<button type="button" class="tab' +
            (key === active ? " is-active" : "") +
            '" role="tab" aria-selected="' +
            (key === active) +
            '" data-tab="' +
            E(key) +
            '">' +
            E(label) +
            (n !== undefined
              ? '<span class="tab__count">' + n + "</span>"
              : "") +
            "</button>",
        )
        .join("") +
      "</div>";
    root.querySelectorAll("[data-tab]").forEach((t, index) => {
      t.tabIndex = t.dataset.tab === active ? 0 : -1;
      t.onclick = () => change(t.dataset.tab);
      t.onkeydown = (e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : (index + (e.key === "ArrowRight" ? 1 : -1) + items.length) %
                items.length;
        const key = items[next][0];
        change(key);
        document
          .getElementById(root.id)
          ?.querySelector('[data-tab="' + key + '"]')
          ?.focus();
      };
    });
  };
  B.mount = function (meta, render) {
    document.body.classList.add("b2");
    B.meta = meta;
    B.render = () => {
      const scroll = window.scrollY;
      const identity = B.identity(B.role);
      const persona = identity.person;
      if (persona && persona.role === B.role) SC.DATA.CURRENT[B.role] = {...SC.DATA.CURRENT[B.role], name:persona.name, group:persona.group, pool:persona.pool ? B.name("pools", persona.pool) : ''};
      SC.page(
        {
          role: B.role,
          menu: meta.menu,
          pid: meta.pid,
          title: typeof meta.title === "function" ? meta.title() : meta.title,
          showHead: meta.showHead,
          crumb: meta.crumb || [],
        },
        (body, actions) => {
          if (!identity.valid || B.role !== "ADM" && !meta.shared) {
            body.innerHTML = B.empty(
              "无权访问",
              "当前角色不能访问全局管理信息。",
            );
            return;
          }
          render(body, actions);
          if (B.storageWarning)
            body.insertAdjacentHTML(
              "afterbegin",
              SC.note("浏览器未允许本地保存，当前操作仅在本页面保留。", "warn"),
            );
        },
      );
      if (meta.shared) {
        const old = document.getElementById("sc-role"),
          sel = old.cloneNode(true);
        old.replaceWith(sel);
        sel.onchange = () => {
          const u = new URL(location.href);
          u.searchParams.set("role", sel.value);
          u.searchParams.delete("as");
          location.href = u.href;
        };
      }
      document
        .getElementById("sc-role")
        ?.setAttribute("aria-label", "原型角色");
      window.scrollTo(0, scroll);
      meta.afterRender?.({ valid: identity.valid && (B.role === "ADM" || meta.shared) });
    };
    window.addEventListener("storage", (e) => {
      if (e.key === B.key) B.render();
    });
    B.render();
    if (B.load().spaces.some((w) => w.status === "creating"))
      setTimeout(() => {
        B.settleSpaces();
        B.render();
      }, 800);
    if (B.load().syncBusy && B.finishSync)
      setTimeout(
        () => {
          B.finishSync();
          B.render();
        },
        Math.max(0, 1200 - (Date.now() - B.load().syncStarted)),
      );
  };
  B.modal = function ({
    title,
    body,
    confirm = "确认",
    onConfirm,
    wide = false,
    danger = false,
  }) {
    const previous = document.activeElement;
    let busy = false;
    const m = SC.modal({
      title,
      size: wide ? "lg" : "md",
      body: body + '<p class="b2-error" role="alert"></p>',
      buttons: [
        { label: "取消", close: true },
        ...(onConfirm
          ? [
              {
                label: confirm,
                cls: danger ? "btn--danger-solid" : "btn--primary",
                onClick: async (close, root) => {
                  if (busy) return;
                  const form = root.querySelector("form");
                  if (form && !form.reportValidity()) return;
                  const button = m.root.querySelector(
                    ".modal__foot .btn:last-child",
                  );
                  busy = true;
                  button.disabled = true;
                  try {
                    await onConfirm(root);
                    close();
                    if (previous?.isConnected) previous.focus();
                  } catch (err) {
                    root.querySelector(".b2-error").textContent = err.message;
                  } finally {
                    busy = false;
                    button.disabled = false;
                  }
                },
              },
            ]
          : []),
      ],
    });
    m.root.querySelector("[role=dialog]").setAttribute("aria-label", title);
    const observer = new MutationObserver(() => {
      if (!m.root.isConnected) {
        observer.disconnect();
        if (previous?.isConnected) previous.focus();
      }
    });
    observer.observe(document.body, { childList: true });
    m.root.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const nodes = [
        ...m.root.querySelectorAll(
          "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
        ),
      ].filter((el) => el.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    requestAnimationFrame(() =>
      m.root
        .querySelector(
          "input:not(:disabled),select:not(:disabled),textarea:not(:disabled),.modal__foot button",
        )
        ?.focus(),
    );
    return m;
  };
  /* 右侧滑出抽屉：在三级清单内就地处理四级详情，替代整页切换。
     压在模态框之下（同 z-index、后插入者在上），上层有 .mask 时让出键盘。 */
  B.drawer = function (o) {
    const parent = o.parent || null;
    if (parent && (parent.closed || !parent.root.isConnected))
      throw Error("父抽屉已关闭");
    while (B._drawer && B._drawer !== parent) B._drawer.close(true);
    const prev = document.activeElement;
    const parentPanel = parent?.root.querySelector(".b2-drawer");
    const parentState = parent && {
      inert: parent.root.inert,
      hidden: parent.root.getAttribute("aria-hidden"),
      modal: parentPanel.getAttribute("aria-modal"),
    };
    const mask = SC.el(
      '<div class="b2-drawer-mask">' +
        '<aside class="b2-drawer" role="dialog" aria-modal="true" tabindex="-1" aria-label="' +
        E(o.title || "") +
        '"><header class="b2-drawer__head"><div class="b2-drawer__titles">' +
        '<div class="b2-drawer__title">' +
        E(o.title || "") +
        "</div>" +
        (o.sub ? '<div class="b2-drawer__sub">' + o.sub + "</div>" : "") +
        '</div><button type="button" class="b2-drawer__x btn btn--icon" aria-label="关闭">' +
        SC.icon("close", 16) +
        "</button></header><div class=\"b2-drawer__body\"></div>" +
        '<footer class="b2-drawer__foot"></footer></aside></div>',
    );
    if (o.width)
      mask.querySelector(".b2-drawer").style.width =
        typeof o.width === "number" ? o.width + "px" : o.width;
    const bodyEl = mask.querySelector(".b2-drawer__body");
    if (typeof o.body === "string") bodyEl.innerHTML = o.body;
    else if (o.body) bodyEl.appendChild(o.body);
    const footEl = mask.querySelector(".b2-drawer__foot");
    if (o.footer) footEl.innerHTML = o.footer;
    else footEl.remove();
    if (parent) {
      const back = SC.el('<button type="button" class="b2-drawer__back btn" aria-label="' +
        E(o.backLabel || "返回上一级") + '">' + SC.icon("back", 16) +
        '<span>' + E(o.backLabel || "返回上一级") + '</span></button>');
      mask.querySelector(".b2-drawer__head").prepend(back);
    }

    let closed = false, finishClose;
    function close(instant) {
      if (closed) {
        if (instant) finishClose?.();
        return;
      }
      closed = true;
      api.child?.close(true);
      if (B._drawer === api && !parent) B._drawer = null;
      document.removeEventListener("keydown", onKey);
      const finish = () => {
        mask.remove();
        if (parent && !parent.closed && parent.root.isConnected) {
          parent.root.inert = parentState.inert;
          if (parentState.hidden === null) parent.root.removeAttribute("aria-hidden");
          else parent.root.setAttribute("aria-hidden", parentState.hidden);
          parentPanel.setAttribute("aria-modal", parentState.modal);
        }
        if (parent?.child === api) parent.child = null;
        if (B._drawer === api)
          B._drawer = parent && !parent.closed && parent.root.isConnected ? parent : null;
        if (!document.querySelector(".b2-drawer-mask"))
          document.body.classList.remove("b2-drawer-lock");
        if (o.onClose) o.onClose();
        if (prev && prev.isConnected && (!parent || !parent.closed)) prev.focus();
      };
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        finish();
      };
      finishClose = end;
      if (instant) return end();
      mask.classList.remove("is-open");
      const panel = mask.querySelector(".b2-drawer");
      panel.addEventListener("transitionend", (e) => {
        if (e.target === panel && e.propertyName === "transform") end();
      });
      setTimeout(end, 340);
    }
    function onKey(e) {
      if (closed || B._drawer !== api || e.defaultPrevented) return;
      if (document.querySelector(".mask")) return; // 上层模态框优先
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        return close();
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...mask.querySelectorAll(
          "a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
        ),
      ].filter((el) => el.getClientRects().length);
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1],
        initialFocus = !nodes.includes(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || initialFocus)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || initialFocus)) {
        e.preventDefault();
        first.focus();
      }
    }
    mask
      .querySelector(".b2-drawer__x")
      .addEventListener("click", () => close());
    mask.querySelector(".b2-drawer__back")?.addEventListener("click", () => close());
    mask.addEventListener("mousedown", (e) => {
      if (e.target === mask) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(mask);
    document.body.classList.add("b2-drawer-lock");
    if (parent) {
      // Move focus before hiding the parent's accessibility subtree.
      mask.querySelector(".b2-drawer").focus();
      parent.root.inert = true;
      parent.root.setAttribute("aria-hidden", "true");
      parentPanel.setAttribute("aria-modal", "false");
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (closed) return;
        mask.classList.add("is-open");
        if (B._drawer === api && !document.querySelector(".mask")) mask.querySelector(".b2-drawer").focus();
      }),
    );
    const api = { close, root: mask, body: bodyEl, parent, child: null, get closed() { return closed; } };
    if (parent) parent.child = api;
    B._drawer = api;
    return api;
  };
  /* 抽屉内轻量分块与两列字段（差异行高亮 + 次要提示） */
  B.sect = (title, inner, opts) =>
    '<section class="b2-sect' +
    (opts && opts.danger ? " b2-sect--danger" : "") +
    '"><h3 class="b2-sect__h">' +
    E(title) +
    (opts && opts.sub ? '<span class="b2-sect__sub">' + E(opts.sub) + "</span>" : "") +
    "</h3>" +
    inner +
    "</section>";
  B.facts = (rows) =>
    '<dl class="b2-facts">' +
    rows
      .map(
        (r) =>
          '<div class="' +
          (r[2] ? "is-diff" : "") +
          '"><dt>' +
          E(r[0]) +
          "</dt><dd>" +
          (r[1] === "" || r[1] == null ? "—" : E(r[1])) +
          (r[3] ? '<span class="b2-facts__hint">' + E(r[3]) + "</span>" : "") +
          "</dd></div>",
      )
      .join("") +
    "</dl>";
  B.values = (root) =>
    Object.fromEntries(new FormData(root.querySelector("form")));
  B.future = (title, id = "") => {
    const routes = {"商机详情":"opportunity", "经营组合":"combo-detail", "客户工作空间":"workspace", "来源冲突确认":"source-review", "来源商机冲突审批":"source-review"};
    if (routes[title]) {
      let page = routes[title];
      if (title === "客户工作空间" && ["archived", "frozen"].includes(B.find("spaces", id)?.status)) page = "space-history";
      const params = {role:B.role, as:SC.param("as") || ""};
      if (title === "来源商机冲突审批") params.candidate = id; else params.id = id;
      location.href = B.href(page, params);
      return;
    }
    return B.modal({
      title,
      body:
        SC.note("该办理入口尚未接入，当前业务关系保持不变。") +
        B.kv([
          ["关联对象", id || "当前对象"],
          ["办理状态", "未执行"],
        ]),
    });
  };
  B.history = function (object) {
    const rows = B.load().logs.filter((x) => !object || x.object === object);
    return rows.length
      ? '<ul class="b2-history">' +
          rows
            .map(
              (x) =>
                "<li><time>" +
                E(x.at) +
                "</time><div><b>" +
                E(x.action) +
                "</b><p>" +
                E(x.by) +
                " · " +
                E(x.detail || x.object) +
                "</p></div></li>",
            )
            .join("") +
          "</ul>"
      : B.empty("暂无本地变更记录", "当前记录尚未产生本地维护操作。");
  };
  B.showHistory = (id) =>
    B.modal({ title: "操作记录", body: B.history(id), wide: true });
  B.download = (filename, rows) => {
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                '"' +
                String(v ?? "")
                  .replace(/^[=+@-]/, "'$&")
                  .replace(/"/g, '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  B.results = function (rows, title = "处理结果", exportable = false) {
    const count = (s) => rows.filter((r) => r.status === s).length;
    const html =
      B.strip([
        ["成功", count("成功")],
        ["失败", count("失败")],
        ["未处理", count("未处理")],
        ["未变化", count("未变化")],
      ]) + '<div id="result-table"></div>';
    const m = B.modal({ title, body: html, wide: true });
    B.table(
      m.body.querySelector("#result-table"),
      rows,
      [
        ["对象", (r) => E(r.id)],
        [
          "结果",
          (r) =>
            B.badge(
              r.status,
              r.status === "成功"
                ? "green"
                : r.status === "失败"
                  ? "red"
                  : "neutral",
            ),
        ],
        ["说明", (r) => E(r.reason)],
      ],
      { search: false, size: 8 },
    );
    if (exportable) {
      const b = SC.el(B.btn("导出明细", "export", "", "download"));
      m.root.querySelector(".modal__foot").prepend(b);
      b.onclick = () =>
        B.download("处理结果.csv", [
          ["对象", "结果", "说明"],
          ...rows.map((r) => [r.id, r.status, r.reason]),
        ]);
    }
  };
  B.table = function (root, rows, cols, opts = {}) {
    const savedKey =
      "b2-view-" + location.pathname + "-" + (opts.key || root.id || "table");
    let saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(savedKey) || "{}");
    } catch {}
    let q = saved.q || "",
      filters = saved.filters || {},
      page = saved.page || 1,
      size = opts.size || 8,
      selected = new Set(),
      matches = [];
    const defs = opts.filters || [],
      canSelect = opts.select;
    const store = () => {
      try {
        sessionStorage.setItem(savedKey, JSON.stringify({ q, filters, page }));
      } catch {}
    };
    root.innerHTML =
      (opts.search === false
        ? ""
        : '<div class="b2-toolbar"><div class="field"><label class="field__label">' +
          E(opts.searchLabel || "搜索") +
          '<input class="input" data-search placeholder="' +
          E(opts.placeholder || "名称或编号") +
          '" value="' +
          E(q) +
          '"></label></div>' +
          defs
            .map(
              (f) =>
                '<div class="field"><label class="field__label">' +
                E(f.label) +
                '<select class="select" data-filter="' +
                E(f.key) +
                '" ' +
                (f.multi ? 'multiple size="2"' : "") +
                '><option value="">全部</option>' +
                f.options
                  .map((o) => {
                    const [v, t] = Array.isArray(o) ? o : [o, o];
                    const chosen = f.multi
                      ? (filters[f.key] || []).includes(v)
                      : filters[f.key] === v;
                    return (
                      '<option value="' +
                      E(v) +
                      '" ' +
                      (chosen ? "selected" : "") +
                      ">" +
                      E(t) +
                      "</option>"
                    );
                  })
                  .join("") +
                "</select></label></div>",
            )
            .join("") +
          B.iconBtn("清空筛选", "clear", "", "close") +
          "</div>") +
      (canSelect
        ? '<div class="b2-batchbar"><span data-selection aria-live="polite">已选择 0 条</span><div class="b2-actions">' +
          B.btn("选择全部匹配项", "select-matches", "", "check", "btn--sm") +
          B.btn("清除选择", "unselect", "", "close", "btn--sm") +
          (opts.batchLabel
            ? B.btn(
                opts.batchLabel,
                "batch",
                "",
                "check",
                "btn--primary btn--sm",
              )
            : "") +
          "</div></div>"
        : "") +
      '<div class="b2-table-scroll"><table class="b2-table"><thead><tr>' +
      (canSelect
        ? '<th class="b2-check"><input type="checkbox" data-all aria-label="选择当前页"></th>'
        : "") +
      cols.map((c) => '<th scope="col">' + E(c[0]) + "</th>").join("") +
      '</tr></thead><tbody></tbody></table></div><div class="b2-table-empty"></div><div class="pager"></div>';
    const eligible = (r) => !opts.eligible || opts.eligible(r);
    const updateSelection = () => {
      if (!canSelect) return;
      root.querySelector("[data-selection]").textContent =
        "已选择 " + selected.size + " 条 / 当前匹配 " + matches.length + " 条";
      const batch = root.querySelector("[data-action=batch]");
      if (batch) batch.disabled = !selected.size;
      const boxes = [...root.querySelectorAll("[data-row]")];
      boxes.forEach((b) => {
        b.checked = selected.has(b.dataset.row);
        b.closest("tr").classList.toggle("is-selected", b.checked);
      });
      const enabled = boxes.filter((b) => !b.disabled),
        n = enabled.filter((b) => b.checked).length,
        all = root.querySelector("[data-all]");
      all.checked = n > 0 && n === enabled.length;
      all.indeterminate = n > 0 && n < enabled.length;
      opts.onSelect?.([...selected]);
    };
    function draw() {
      matches = rows.filter((r) => {
        const text = opts.searchText ? opts.searchText(r) : JSON.stringify(r);
        return (
          (!q || text.toLocaleLowerCase().includes(q.toLocaleLowerCase())) &&
          defs.every((f) => {
            const chosen = filters[f.key];
            if (!chosen || (Array.isArray(chosen) && !chosen.length))
              return true;
            const actual = f.value ? f.value(r) : r[f.key];
            const values = Array.isArray(chosen) ? chosen : [chosen];
            return values.some((v) =>
              Array.isArray(actual) ? actual.includes(v) : String(actual) === v,
            );
          })
        );
      });
      const pages = Math.max(1, Math.ceil(matches.length / size));
      page = Math.min(page, pages);
      const slice = matches.slice((page - 1) * size, page * size);
      root.querySelector("tbody").innerHTML = slice
        .map(
          (r) =>
            '<tr data-id="' +
            E(r.id) +
            '">' +
            (canSelect
              ? '<td class="b2-check"><input type="checkbox" data-row="' +
                E(r.id) +
                '" aria-label="选择 ' +
                E(r.name || r.id) +
                '" ' +
                (!eligible(r) ? "disabled" : "") +
                "></td>"
              : "") +
            cols.map((c) => "<td>" + c[1](r) + "</td>").join("") +
            "</tr>",
        )
        .join("");
      root.querySelector(".b2-table-empty").innerHTML = matches.length
        ? ""
        : B.empty(
            rows.length ? "无符合条件的记录" : opts.emptyTitle || "暂无记录",
            rows.length
              ? "当前筛选条件未匹配记录。"
              : opts.emptyReason || "当前范围内没有待处理记录。",
          );
      root.querySelector(".pager").innerHTML =
        "<span>共 <b>" +
        matches.length +
        "</b> 条 · 每页 " +
        size +
        ' 条</span><div class="b2-actions"><button class="btn btn--icon btn--sm" data-prev aria-label="上一页" ' +
        (page === 1 ? "disabled" : "") +
        ">" +
        SC.icon("back") +
        "</button><span>" +
        page +
        " / " +
        pages +
        '</span><button class="btn btn--icon btn--sm" data-next aria-label="下一页" ' +
        (page === pages ? "disabled" : "") +
        ">" +
        SC.icon("arrow") +
        "</button></div>";
      root.querySelector("[data-prev]").onclick = () => {
        page--;
        draw();
      };
      root.querySelector("[data-next]").onclick = () => {
        page++;
        draw();
      };
      root.querySelectorAll("[data-row]").forEach(
        (b) =>
          (b.onchange = () => {
            b.checked
              ? selected.add(b.dataset.row)
              : selected.delete(b.dataset.row);
            updateSelection();
          }),
      );
      updateSelection();
      store();
      opts.onDraw?.(root, slice);
      opts.onFilter?.(matches);
    }
    root.querySelector("[data-search]")?.addEventListener("input", (e) => {
      q = e.target.value;
      page = 1;
      selected.clear();
      draw();
    });
    root.querySelectorAll("[data-filter]").forEach(
      (el) =>
        (el.onchange = () => {
          filters[el.dataset.filter] = el.multiple
            ? [...el.selectedOptions].map((o) => o.value).filter(Boolean)
            : el.value;
          page = 1;
          selected.clear();
          draw();
        }),
    );
    root.querySelector("[data-all]")?.addEventListener("change", (e) => {
      matches
        .slice((page - 1) * size, page * size)
        .filter(eligible)
        .forEach((r) =>
          e.target.checked ? selected.add(r.id) : selected.delete(r.id),
        );
      updateSelection();
    });
    B.actions(root, {
      clear: () => {
        q = "";
        filters = {};
        page = 1;
        selected.clear();
        root.querySelector("[data-search]").value = "";
        root.querySelectorAll("[data-filter]").forEach((el) => {
          el.value = "";
        });
        draw();
      },
      "select-matches": () => {
        matches.filter(eligible).forEach((r) => selected.add(r.id));
        updateSelection();
      },
      unselect: () => {
        selected.clear();
        updateSelection();
      },
      batch: () => opts.onBatch?.([...selected]),
    });
    draw();
    return {
      selected: () => [...selected],
      matches: () => matches,
      refresh: draw,
    };
  };
  B.oppColumns = function (s, options = {}) {
    return [
      [
        "商机 / 客户",
        (o) =>
          B.entity(
            o.name,
            o.id,
            "box",
            B.href("customer-detail", { id: o.customer, role: B.role }),
          ),
      ],
      [
        "产品",
        (o) =>
          B.link("product-detail", B.name("products", o.product, s), {
            id: o.product,
          }) +
          '<div class="b2-sub">' +
          (B.find("products", o.product, s)?.active ? "已激活" : "未激活") +
          "</div>",
      ],
      [
        "归属销售",
        (o) =>
          E(o.sales ? B.name("people", o.sales, s) : o.sourceSales || "空余") +
          '<div class="b2-sub">' +
          E(
            o.sales
              ? B.find("people", o.sales, s)?.group || "待分组"
              : o.sourceSales
                ? "未对应本地人员"
                : "无归属销售",
          ) +
          "</div>",
      ],
      [
        "本地客户池",
        (o) =>
          o.pool
            ? B.link("pool-detail", B.name("pools", o.pool, s), { id: o.pool })
            : B.badge("待指定", "amber"),
      ],
      [
        "经营结果",
        (o) =>
          B.badge(
            SC.OPP_RESULT[o.result],
            o.result === "active" ? "green" : "neutral",
          ),
      ],
      ...(options.source
        ? [["CRM 客户池", (o) => E(o.crmPool || "未提供")]]
        : []),
      ...(options.space
        ? [
            [
              "准入 / 空间",
              (o) =>
                "<div>" +
                E(B.combo(o, s)?.admit || "未提报") +
                "</div>" +
                SC.spaceState(B.spaceFor(o, s)?.status || "none"),
            ],
          ]
        : []),
    ];
  };
})(window.SC, window.SC.B2);
