/* ==========================================================================
   P-ADM-28 空间建立失败
   版式：失败清单为主页；「核对恢复条件」从右侧滑出抽屉，在清单内就地处理。
        抽屉承载空间身份与准入、恢复条件、本三元装载商机、建立记录；
        重试建立的二次确认与结算规则保持不变。
   ========================================================================== */

(function (SC, B) {
  "use strict";

  const E = SC.esc;
  const deepLink = SC.param("id");
  let autoOpened = false;

  function setUrl(id) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set("id", id);
      else u.searchParams.delete("id");
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  function openDrawer(id) {
    const s = B.load();
    const w = B.find("spaces", id, s);
    if (!w) {
      SC.toast("建立事项不存在", "bad");
      return;
    }
    const opps = s.opps.filter(
      (o) =>
        o.customer === w.customer && o.sales === w.sales && o.pool === w.pool,
    );
    const c = s.combos.find(
      (c) => c.customer === w.customer && c.sales === w.sales,
    );
    const person = B.find("people", w.sales, s);
    const problems = [];
    if (!opps.length) problems.push("当前三元范围没有商机");
    if (c?.admit !== "已通过") problems.push("缺少当前组合有效准入");
    if (!B.find("pools", w.pool, s)) problems.push("客户池不存在");
    if (person?.status !== "on") problems.push("销售账号不可用");
    if (!person?.group || person.group === "—") problems.push("销售未分组");
    if (!opps.some((o) => B.find("products", o.product, s)?.active))
      problems.push("暂无已激活产品对应商机");

    const st = SC.SPACE_STATES[w.status] || SC.SPACE_STATES.none;
    const body =
      B.sect(
        "空间身份与准入",
        B.facts([
          ["客户", B.name("customers", w.customer, s)],
          ["销售", B.name("people", w.sales, s)],
          ["客户池", B.name("pools", w.pool, s)],
          ["空间标识", w.id],
          ["空间状态", st.label],
          ["准入结果", c?.admit || "未提报"],
        ]),
      ) +
      B.sect(
        "恢复条件",
        (problems.length
          ? problems.map((x) => SC.note(E(x), "warn")).join("")
          : SC.note("当前组合、准入、客户池与产品条件满足，可重试建立。")) +
          '<div class="sf-links">' +
          B.link("pool-assign", "补齐客户池", {}, "btn btn--sm") +
          B.link("products", "核对产品", {}, "btn btn--sm") +
          B.link("agent-status", "查看 Agent 状态", {}, "btn btn--sm") +
          "</div>",
      ) +
      B.sect("本三元装载商机", '<div id="sf-opps"></div>') +
      B.sect("建立记录", '<div class="sf-history">' + B.history(id) + "</div>");

    const footer =
      '<div class="b2-foot__main">' +
      B.btn(
        w.status === "normal" ? "空间已可用" : "重试建立",
        "retry",
        id,
        "retry",
        "btn--primary",
      ) +
      "</div>";

    const dr = B.drawer({
      title: "空间建立结果",
      width: 720,
      sub:
        B.badge(st.label, st.tone || "neutral") +
        '<span class="b2-drawer__dot"></span><span class="mono">' +
        E(w.id) +
        '</span><span class="b2-drawer__dot"></span>发生 ' +
        E(w.created),
      body,
      footer,
      onClose: () => setUrl(""),
    });
    setUrl(id);

    B.table(dr.body.querySelector("#sf-opps"), opps, B.oppColumns(s), {
      search: false,
    });
    const retry = dr.root.querySelector("[data-action=retry]");
    retry.disabled = problems.length > 0 || w.status !== "failed";

    B.actions(dr.root, {
      retry: () =>
        B.modal({
          title: "重试空间建立",
          confirm: "确认重试",
          body: B.kv([
            ["空间", w.id],
            ["当前客户池", B.name("pools", w.pool, s)],
            ["准入", "已通过，保持原结果"],
          ]),
          onConfirm: () => {
            B.change((st2) => {
              const current = B.find("spaces", id, st2);
              if (current.version !== w.version || current.status !== "failed")
                throw Error("空间状态已变化");
              current.status = "creating";
              current.why = "正在核对并装载";
              current.version++;
              B.log(st2, id, "重试空间建立");
            });
            dr.close();
            B.render();
            setTimeout(() => {
              B.settleSpaces();
              B.render();
            }, 800);
          },
        }),
    });
  }

  /* ------------------------------------------------------------ 失败清单 */
  B.mount(
    {
      pid: "P-ADM-28",
      title: "空间建立失败",
      menu: "recon",
      crumb: [{ t: "CRM数据管理", href: "reconcile.html" }],
    },
    (body, actions) => {
      const s = B.load(),
        failures = s.spaces.filter(
          (w) => w.status === "failed" || w.status === "creating",
        );
      actions.innerHTML =
        B.link("reconcile", "返回CRM数据管理", {}, "btn") +
        B.iconBtn("刷新状态", "refresh", "", "sync");
      body.innerHTML =
        SC.note("建立失败不撤销已通过的准入。恢复按具体客户池空间处理。") +
        '<div id="spaces-table"></div>';
      B.table(
        body.querySelector("#spaces-table"),
        failures,
        [
          [
            "客户 / 空间",
            (w) => B.entity(B.name("customers", w.customer, s), w.id, "layers"),
          ],
          ["当前销售", (w) => B.e(B.name("people", w.sales, s))],
          ["客户池", (w) => B.e(B.name("pools", w.pool, s))],
          ["空间状态", (w) => SC.spaceState(w.status)],
          ["失败原因", (w) => B.e(w.why)],
          ["发生时间", (w) => B.e(w.created)],
          [
            "操作",
            (w) => B.btn("核对恢复条件", "review", w.id, "eye", "btn--sm"),
          ],
        ],
        {
          key: "space-failures",
          searchText: (w) =>
            w.id +
            B.name("customers", w.customer, s) +
            B.name("people", w.sales, s) +
            B.name("pools", w.pool, s),
          emptyTitle: "暂无空间建立失败",
        },
      );
      B.actions(body, { review: (rid) => openDrawer(rid) });
      B.actions(actions, { refresh: () => B.render() });
      if (deepLink && !autoOpened) {
        autoOpened = true;
        if (B.find("spaces", deepLink, s))
          requestAnimationFrame(() => openDrawer(deepLink));
      }
    },
  );
})(window.SC, window.SC.B2);
