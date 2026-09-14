/* ==========================================================================
   P-ADM-25 数据异常
   版式：异常清单为主页；「查看并处理」从右侧滑出抽屉，在清单内就地处理。
        抽屉承载异常对象、人员对应补齐表单、修复与验证；
        补齐与重新检查的业务规则保持不变（原 B.issueDetail 逻辑内联至此）。
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

  function bodyHtml(x, s) {
    const fixed = x.state === "已恢复";
    const mapping =
      x.type === "人员对应缺失" && !fixed
        ? B.sect(
            "人员对应",
            '<form id="mapping-form">' +
              B.field("来源人员", "source", x.source, { readonly: true }) +
              B.field("对应本地销售", "person", "", {
                options: [
                  ["", "请选择本地销售"],
                  ...s.people
                    .filter((p) => p.role === "SLS")
                    .map((p) => [
                      p.id,
                      p.name +
                        " · " +
                        p.group +
                        (p.status === "off" ? " · 已停用" : ""),
                    ]),
                ],
              }) +
              SC.note("仅补齐首次人员对应。账号、分组、产品与准入状态分别保持。") +
              '<p class="b2-error" role="alert"></p></form>',
          )
        : "";
    return (
      B.sect(
        "异常对象",
        B.facts([
          ["异常编号", x.id],
          ["问题类型", x.type],
          ["来源对象", x.source],
          ["相关客户", x.customer ? B.name("customers", x.customer, s) : "尚未对应"],
          ["发现时间", x.at],
          ["当前状态", x.state],
        ]),
      ) +
      SC.note(E(x.why), fixed ? "info" : "warn") +
      mapping +
      B.sect(
        "修复与验证",
        B.facts([
          ["最近检查", x.checked || "尚未人工检查"],
          ["验证结果", x.validation || "问题尚未解除"],
        ]) +
          '<div class="di-links">' +
          B.link("sync-detail", "查看来源同步", {}, "btn btn--sm") +
          (x.type === "人员对应缺失"
            ? B.link("people-list", "人员与账号", {}, "btn btn--sm")
            : "") +
          "</div>",
      ) +
      B.sect("处理记录", '<div class="di-history">' + B.history(x.id) + "</div>")
    );
  }

  function footerHtml(x) {
    const canMap = x.type === "人员对应缺失" && x.state !== "已恢复";
    return (
      B.btn("重新检查", "recheck", x.id, "retry") +
      '<div class="b2-foot__main">' +
      (canMap ? B.btn("确认对应并验证", "map", x.id, "check", "btn--primary") : "") +
      "</div>"
    );
  }

  function openDrawer(id) {
    const s = B.load();
    const x0 = B.find("issues", id, s);
    if (!x0) {
      SC.toast("异常记录不存在", "bad");
      return;
    }
    const stTone = x0.state === "已恢复" ? "green" : "amber";
    const dr = B.drawer({
      title: "数据异常详情",
      sub:
        B.badge(x0.state, stTone) +
        '<span class="b2-drawer__dot"></span><span class="mono">' +
        E(x0.id) +
        '</span><span class="b2-drawer__dot"></span>发现 ' +
        E(x0.at),
      body: bodyHtml(x0, s),
      footer: footerHtml(x0),
      onClose: () => setUrl(""),
    });
    setUrl(id);

    B.actions(dr.root, {
      map: () => {
        const form = dr.body.querySelector("form");
        try {
          const person = new FormData(form).get("person");
          if (!person) throw Error("请选择本地销售");
          B.change((st) => {
            const issue = B.find("issues", x0.id, st),
              p = B.find("people", person, st),
              o = B.find("opps", issue.opp, st);
            if (!p || p.role !== "SLS") throw Error("目标人员已不是销售角色");
            if (issue.state === "已恢复") throw Error("该问题已处理，请重新查看");
            if (o?.sales && o.sales !== person)
              throw Error("已有有效归属，须通过来源冲突确认办理");
            if (o) {
              o.sales = person;
              o.version++;
              if (!B.combo(o, st))
                st.combos.push({
                  id: B.uid("K"),
                  customer: o.customer,
                  sales: person,
                  admit: "未提报",
                });
            }
            issue.state = "已恢复";
            issue.checked = B.now();
            issue.validation =
              p.status === "off"
                ? "对应已补齐；账号停用，商机仍待分配"
                : p.group === "—"
                  ? "对应已补齐；销售尚未分组"
                  : "对应已补齐；产品、客户池与准入按各自条件检查";
            B.log(st, x0.id, "首次人员对应补齐", p.name + "；" + issue.validation);
          });
          dr.close();
          B.render();
          SC.toast("人员对应已验证", "ok");
        } catch (e) {
          form.querySelector(".b2-error").textContent = e.message;
        }
      },
      recheck: () => {
        B.change((st) => {
          const issue = B.find("issues", x0.id, st);
          issue.checked = B.now();
          issue.validation =
            issue.state === "已恢复"
              ? "该项异常已解除，其他业务条件独立检查"
              : "问题仍存在：" + issue.why;
          B.log(st, x0.id, "重新检查", issue.validation);
        });
        const fresh = B.find("issues", id);
        dr.body.innerHTML = bodyHtml(fresh, B.load());
        SC.toast("已返回当前检查结果");
      },
    });
  }

  /* ------------------------------------------------------------ 异常清单 */
  B.mount(
    {
      pid: "P-ADM-25",
      title: "数据异常",
      menu: "recon",
      crumb: [{ t: "CRM数据管理", href: "reconcile.html" }],
    },
    (body, actions) => {
      const s = B.load();
      actions.innerHTML = B.link("reconcile", "返回CRM数据管理", {}, "btn");
      body.innerHTML =
        B.strip([
          ["待处理异常", s.issues.filter((x) => x.state === "待处理").length],
          [
            "人员对应缺失",
            s.issues.filter(
              (x) => x.type === "人员对应缺失" && x.state !== "已恢复",
            ).length,
          ],
          ["已恢复", s.issues.filter((x) => x.state === "已恢复").length],
          [
            "正常空余商机",
            s.opps.filter((o) => !o.sales && !o.sourceSales).length,
            "不属于归属异常",
          ],
        ]) + '<div id="issues-table"></div>';
      B.table(
        body.querySelector("#issues-table"),
        s.issues,
        [
          ["来源对象", (x) => B.entity(x.source, x.id, "alert")],
          ["异常类型", (x) => B.e(x.type)],
          [
            "相关客户",
            (x) =>
              x.customer
                ? B.link("customer-detail", B.name("customers", x.customer, s), {
                    id: x.customer,
                  })
                : "尚未对应",
          ],
          ["原因", (x) => B.e(x.why)],
          [
            "状态",
            (x) => B.badge(x.state, x.state === "已恢复" ? "green" : "amber"),
          ],
          ["发现时间", (x) => B.e(x.at)],
          ["操作", (x) => B.btn("查看并处理", "review", x.id, "eye", "btn--sm")],
        ],
        {
          key: "issues",
          filters: [
            {
              key: "type",
              label: "异常类型",
              options: ["人员对应缺失", "关联产品缺失", "关联客户缺失"],
            },
            { key: "state", label: "处理状态", options: ["待处理", "已恢复"] },
          ],
          searchText: (x) =>
            x.source +
            x.id +
            x.why +
            (x.customer ? B.name("customers", x.customer, s) : ""),
        },
      );
      B.actions(body, { review: (rid) => openDrawer(rid) });
      if (deepLink && !autoOpened) {
        autoOpened = true;
        if (B.find("issues", deepLink, s))
          requestAnimationFrame(() => openDrawer(deepLink));
      }
    },
  );
})(window.SC, window.SC.B2);
