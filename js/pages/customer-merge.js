/* ==========================================================================
   P-ADM-27 客户主体核对
   版式：待合并清单为主页；「核对主体」从右侧滑出抽屉，在清单内逐条处理，
        不再整页切换到子页面。抽屉承载本地 / 来源对照、空间冲突、核对结果，
        主体决定固定在抽屉底部；二次确认与合并业务规则保持不变。
   ========================================================================== */

(function (SC, B) {
  "use strict";

  const E = SC.esc;
  const deepLink = SC.param("id");
  let autoOpened = false; // 深链只自动展开一次

  /* ------------------------------------------------------------ 视图基元 */
  function facts(rows) {
    return (
      '<dl class="cm-facts">' +
      rows
        .map(
          (r) =>
            '<div class="' +
            (r[2] ? "is-diff" : "") +
            '"><dt>' +
            E(r[0]) +
            "</dt><dd>" +
            (r[1] === "" || r[1] == null ? "—" : E(r[1])) +
            (r[3] ? '<span class="cm-facts__hint">' + E(r[3]) + "</span>" : "") +
            "</dd></div>",
        )
        .join("") +
      "</dl>"
    );
  }
  function sect(title, inner, danger) {
    return (
      '<section class="cm-sect' +
      (danger ? " cm-sect--danger" : "") +
      '"><h3 class="cm-sect__h">' +
      E(title) +
      "</h3>" +
      inner +
      "</section>"
    );
  }

  function setUrl(id) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set("id", id);
      else u.searchParams.delete("id");
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  /* ------------------------------------------------------------ 核对抽屉 */
  function openDrawer(id) {
    const s = B.load();
    const m = B.find("merges", id, s);
    const c = m && B.find("customers", m.customer, s);
    if (!m || !c) {
      SC.toast("主体核对记录不存在", "bad");
      return;
    }
    const opps = s.opps.filter((o) => o.customer === c.id);
    const spaces = s.spaces.filter((w) => w.customer === c.id);
    const groups = B.groups(c.id, s).join("、") || "无";
    const pending = m.state === "待处理";
    const namesDiffer = c.name !== m.name;
    const stTone = m.state === "已合并" ? "green" : pending ? "amber" : "neutral";

    const cmp =
      '<div class="cm-cmp' +
      (namesDiffer ? " is-diff" : "") +
      '"><div class="cm-cmp__col"><span class="cm-cmp__tag">本地正式客户</span>' +
      '<span class="cm-cmp__name">' +
      E(c.name) +
      '</span><span class="cm-cmp__id mono">' +
      E(c.id) +
      "</span></div>" +
      '<div class="cm-cmp__vs"><span class="cm-cmp__vsico">' +
      SC.icon(namesDiffer ? "alert" : "ok", 18) +
      "</span>" +
      B.badge(m.match + "命中", m.match === "精确" ? "brand" : "amber") +
      '<span class="cm-cmp__vsnote">' +
      (namesDiffer ? "名称不一致" : "名称一致") +
      "</span></div>" +
      '<div class="cm-cmp__col cm-cmp__col--src"><span class="cm-cmp__tag">CRM 来源候选</span>' +
      '<span class="cm-cmp__name">' +
      E(m.name) +
      '</span><span class="cm-cmp__id mono">CRM-' +
      E(m.id) +
      "</span></div></div>";

    const localFacts = sect(
      "本地经营现状 · 合并后随主体保留",
      facts([
        ["正式商机", opps.length + " 条"],
        ["归属销售分组", groups],
        ["当前空间", spaces.length + " 个"],
        ["本地补充", (c.note || "").replace(/^本地补充[:：]\s*/, "")],
      ]),
    );

    const srcFacts = sect(
      "来源与处理",
      facts([
        [
          "来源真实商机",
          m.sourceOpps + " 条",
          false,
          m.sourceOpps ? "须与既有产品商机独立冲突核对" : "无来源商机，不补造",
        ],
        ["命中类型", m.match, m.match === "模糊"],
        ["处理状态", m.state],
        ["经营开放", "主体与商机分别核对"],
      ]),
    );

    let conflictBlock = "";
    if (m.conflict) {
      const w0 = spaces[0];
      conflictBlock = sect(
        "空间冲突",
        SC.note(
          "同一销售、同一客户池存在两份当前或可恢复空间，本次合并暂缓。原经营继续。",
          "danger",
        ) +
          facts([
            ["销售", B.name("people", (w0 && w0.sales) || "U-1004", s)],
            ["客户池", B.name("pools", (w0 && w0.pool) || "POOL-01", s)],
            ["冲突空间", ((w0 && w0.id) || "W-2011") + " / W-CANDIDATE-01"],
            ["处置", "暂缓，不选择主空间、不搬移历史"],
          ]),
        true,
      );
    }

    let resolvedBlock = "";
    if (!pending) {
      resolvedBlock =
        sect(
          "核对结果",
          '<div class="cm-result"><div class="cm-result__badge">' +
            SC.icon("ok", 15) +
            E(m.state) +
            '</div><p class="cm-result__text">' +
            E(m.outcome) +
            "</p></div>",
        ) +
        sect("核对记录", '<div class="cm-history">' + B.history(id) + "</div>");
    }

    const body =
      cmp +
      localFacts +
      srcFacts +
      conflictBlock +
      resolvedBlock +
      (pending
        ? SC.note(
            "确认合并不可撤销：以来源客户为主体，本地主档只读保留；不改客保、客户池、公海与准入结果，各池历史分开保留。",
            "info",
          )
        : "");

    let footer;
    if (pending) {
      footer =
        '<a class="btn cm-foot__ghost" href="' +
        E(B.href("customer-detail", { id: c.id })) +
        '">查看本地档案</a><div class="b2-foot__main">' +
        (m.conflict
          ? '<span class="b2-foot__warn">' +
            SC.icon("warn", 13) +
            "存在同池空间冲突</span>"
          : "") +
        B.btn("标记为不同客户", "different", id, "check") +
        B.btn("确认为同一客户", "same", id, "", "btn--primary") +
        "</div>";
    } else {
      footer =
        '<a class="btn cm-foot__ghost" href="' +
        E(B.href("customer-detail", { id: m.resolved })) +
        '">查看正式客户</a><div class="b2-foot__main">' +
        (m.sourceOpps ? B.btn("查看商机待办", "future", id, "arrow") : "") +
        "</div>";
    }

    const dr = B.drawer({
      title: "客户主体核对",
      sub:
        B.badge(m.state, stTone) +
        '<span class="b2-drawer__dot"></span><span class="mono">' +
        E(m.id) +
        '</span><span class="b2-drawer__dot"></span>发现 ' +
        E(m.at),
      body,
      footer,
      onClose: () => setUrl(""),
    });
    setUrl(id);

    if (m.conflict) {
      const same = dr.root.querySelector("[data-action=same]");
      if (same) {
        same.disabled = true;
        same.title = "存在同三元空间冲突，本次合并暂缓";
      }
    }

    function commit(same) {
      B.change((st) => {
        const x = B.find("merges", id, st),
          local = B.find("customers", c.id, st);
        if (x.state !== "待处理" || local.merged)
          throw Error("主体已处理，请重新核对");
        if (same && x.conflict) throw Error("空间冲突未解除，本次合并暂缓");
        if (!same && st.customers.some((y) => !y.merged && y.name === x.name))
          throw Error("客户全称完全相同，请先按来源权限纠正全称");
        const newId = B.uid("C"),
          fresh = {
            ...JSON.parse(JSON.stringify(local)),
            id: newId,
            name: x.name,
            source: "CRM",
            merged: "",
            mergedFrom: same ? local.id : "",
            extras: { "CRM 客户编号": "CRM-" + x.id },
            contacts: same ? local.contacts : [],
            note: same ? local.note : "",
            owner: same ? local.owner : "来源登记人",
          };
        st.customers.push(fresh);
        if (same) {
          local.merged = newId;
          st.opps
            .filter((o) => o.customer === local.id)
            .forEach((o) => (o.customer = newId));
          st.combos
            .filter((k) => k.customer === local.id)
            .forEach((k) => (k.customer = newId));
          st.spaces
            .filter((w) => w.customer === local.id)
            .forEach((w) => (w.customer = newId));
        }
        x.state = same ? "已合并" : "已标记不同";
        x.resolved = newId;
        x.outcome = x.sourceOpps
          ? "主体已确认；" +
            x.sourceOpps +
            " 条来源商机与既有产品商机存在冲突，仍待审批，尚未开放经营。"
          : "客户主体已正式确认；无来源真实商机，不补造商机。";
        x.at = B.now();
        B.log(st, id, x.state, x.outcome);
        B.log(
          st,
          newId,
          "客户主体确认",
          same ? "保留本地补充与原空间身份" : "确认独立主体",
        );
      });
      dr.close();
      B.render();
      SC.toast("主体核对已完成", "ok");
    }

    B.actions(dr.root, {
      future: () => B.future("来源商机冲突审批", id),
      same: () =>
        B.modal({
          title: "确认客户合并",
          wide: true,
          danger: true,
          confirm: "确认合并",
          body:
            SC.impact({
              danger: true,
              title: "以 CRM 来源客户为主体",
              cells: [
                { k: "正式商机", v: opps.length },
                { k: "现有空间", v: spaces.length },
                { k: "历史记录", v: spaces.reduce((n, w) => n + w.history, 0) },
              ],
              note: "合并不可撤销。本地主档只读保留；不改客保、客户池、公海和准入结果，各池历史分开保留。",
            }) +
            B.kv([
              ["主体客户", m.name],
              ["原本地客户", c.name],
              ["来源商机", m.sourceOpps + " 条，仍须独立冲突核对"],
            ]),
          onConfirm: () => commit(true),
        }),
      different: () =>
        B.modal({
          title: "确认不同客户",
          confirm: "确认不同",
          body:
            SC.note("确认不同仍须满足客户全称唯一性，来源商机不会自动获批。") +
            B.kv([
              ["来源候选", m.name],
              ["本地客户", c.name],
            ]),
          onConfirm: () => commit(false),
        }),
    });
  }

  /* ------------------------------------------------------------ 待合并清单 */
  B.mount(
    {
      pid: "P-ADM-27",
      title: "待合并客户",
      menu: "recon",
      crumb: [{ t: "CRM数据管理", href: "reconcile.html" }],
    },
    (body, actions) => {
      const s = B.load();
      actions.innerHTML = B.link("reconcile", "返回CRM数据管理", {}, "btn");
      const cPending = s.merges.filter((m) => m.state === "待处理").length;
      const cConflict = s.merges.filter(
        (m) => m.conflict && m.state === "待处理",
      ).length;
      const sumCell = (n, label, tone) =>
        '<div class="cm-sum__cell"><span class="cm-sum__n' +
        (tone ? " cm-sum__n--" + tone : "") +
        '">' +
        n +
        '</span><span class="cm-sum__l">' +
        label +
        "</span></div>";
      body.innerHTML =
        '<div class="cm-head"><div class="cm-head__note">' +
        SC.note("来源候选尚未开放经营，原本地客户继续使用。") +
        '</div><div class="cm-sum">' +
        sumCell(cPending, "待处理", cPending ? "warn" : "") +
        sumCell(cConflict, "空间冲突", cConflict ? "danger" : "") +
        sumCell(s.merges.length - cPending, "已处理", "") +
        "</div></div>" +
        '<div id="merges-table"></div>';
      B.table(
        body.querySelector("#merges-table"),
        s.merges,
        [
          [
            "本地客户",
            (m) =>
              B.entity(B.name("customers", m.customer, s), m.customer, "building"),
          ],
          ["CRM 候选", (m) => B.e(m.name)],
          [
            "命中类型",
            (m) => B.badge(m.match, m.match === "精确" ? "neutral" : "amber"),
          ],
          [
            "来源商机",
            (m) =>
              m.sourceOpps
                ? '<span class="cm-num">' + m.sourceOpps + " 条</span>"
                : '<span class="cm-num cm-num--zero">0 条</span>',
          ],
          [
            "处理状态",
            (m) =>
              '<div class="cm-status">' +
              B.badge(m.state, m.state === "待处理" ? "amber" : "green") +
              (m.conflict && m.state === "待处理"
                ? SC.badge("空间冲突", "red", { sm: true, dot: true })
                : "") +
              "</div>",
          ],
          ["发现时间", (m) => B.e(m.at)],
          ["操作", (m) => B.btn("核对主体", "review", m.id, "eye", "btn--sm")],
        ],
        {
          key: "merges",
          filters: [
            {
              key: "state",
              label: "处理状态",
              options: ["待处理", "已合并", "已标记不同"],
            },
            { key: "match", label: "命中类型", options: ["精确", "模糊"] },
          ],
        },
      );
      B.actions(body, { review: (rid) => openDrawer(rid) });
      if (deepLink && !autoOpened) {
        autoOpened = true;
        if (B.find("merges", deepLink, s))
          requestAnimationFrame(() => openDrawer(deepLink));
      }
    },
  );
})(window.SC, window.SC.B2);
