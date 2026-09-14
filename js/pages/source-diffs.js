/* ==========================================================================
   P-ADM-26 来源差异
   版式：差异清单为主页；「核对差异」从右侧滑出抽屉，在清单内就地处理，
        不再整页切换。抽屉承载差异事项、来源三态对照、业务影响、处理说明，
        处理决定固定在抽屉底部；二次确认与结案业务规则保持不变。
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

  /* ------------------------------------------------------------ 核对抽屉 */
  function openDrawer(id) {
    const s = B.load();
    const d = B.find("diffs", id, s);
    if (!d) {
      SC.toast("差异事项不存在", "bad");
      return;
    }
    const pending = d.state === "待处理";
    const resolved = d.state === "已处理" || d.state === "差异已消失";
    const stTone = resolved ? "green" : "amber";
    const combos = s.combos.filter((c) => c.customer === d.customer).length;
    const spaces = s.spaces.filter((w) => w.customer === d.customer).length;
    const groups = B.groups(d.customer, s).join("、") || "无";

    const body =
      B.sect(
        "差异事项",
        B.facts([
          ["客户", B.name("customers", d.customer, s)],
          ["业务信息", d.field],
          ["来源变化", d.kind],
          ["相关商机", d.opp || "客户级资料"],
        ]),
      ) +
      SC.note(E(d.why), "warn") +
      B.sect(
        "来源对照",
        '<div class="sd-compare">' +
          '<div class="sd-cell"><span class="sd-cell__k">原来源</span><p>' +
          E(d.before || "明确为空") +
          "</p></div>" +
          '<div class="sd-cell"><span class="sd-cell__k">最新来源</span><p>' +
          E(d.source || "明确清空") +
          "</p></div>" +
          '<div class="sd-cell sd-cell--local"><span class="sd-cell__k">当前本地结果</span><p>' +
          E(d.local) +
          "</p>" +
          B.badge("本地结果保留", "brand") +
          "</div></div>",
      ) +
      B.sect(
        "业务影响",
        B.facts([
          ["已有经营组合", combos + " 个"],
          ["现有空间", spaces + " 个"],
          ["归属销售分组", groups],
          [
            "关联办理",
            d.state === "处理中" ? "已移交，尚未生效" : "无进行中办理",
          ],
        ]),
      ) +
      (pending
        ? B.sect(
            "处理说明",
            '<form id="diff-form">' +
              B.field("处理说明", "reason", "", { required: true, area: true }) +
              '<p class="b2-error" role="alert"></p></form>',
          )
        : B.sect(
            "处理结果",
            '<div class="sd-result"><div class="sd-result__badge">' +
              SC.icon("ok", 15) +
              E(d.state) +
              '</div><p class="sd-result__text">' +
              E(d.reason || d.why) +
              "</p></div>",
          )) +
      B.sect(
        "相关核对",
        '<div class="sd-links">' +
          B.link("customer-merge", "客户主体核对", {}, "btn btn--sm") +
          B.link("product-check", "产品身份核对", {}, "btn btn--sm") +
          "</div>",
      ) +
      B.sect(
        "变化与处理历史",
        '<div class="sd-history">' + B.history(id) + "</div>",
      );

    const footer =
      B.btn("重新检查", "recheck", id, "retry") +
      '<div class="b2-foot__main">' +
      (pending
        ? B.btn("进入责任模块", "handoff", id, "arrow") +
          B.btn("确认保持本地", "keep", id, "check", "btn--primary")
        : "") +
      "</div>";

    const dr = B.drawer({
      title: "来源差异详情",
      sub:
        B.badge(d.state, stTone) +
        '<span class="b2-drawer__dot"></span><span class="mono">' +
        E(d.id) +
        '</span><span class="b2-drawer__dot"></span>发现 ' +
        E(d.at),
      body,
      footer,
      onClose: () => setUrl(""),
    });
    setUrl(id);

    function commit(reason) {
      B.change((st) => {
        const x = B.find("diffs", id, st);
        if (x.state !== "待处理" || x.source !== d.source)
          throw Error("差异已被处理或来源已变化");
        x.state = "已处理";
        x.reason = reason;
        B.log(st, id, "确认保持本地", reason);
      });
      dr.close();
      B.render();
      SC.toast("差异已结案，本地结果保持", "ok");
    }

    B.actions(dr.root, {
      keep: () => {
        const form = dr.body.querySelector("form");
        if (!form.reportValidity()) return;
        const reason = (new FormData(form).get("reason") || "").trim();
        if (!reason) {
          form.querySelector(".b2-error").textContent = "请填写处理说明";
          return;
        }
        B.modal({
          title: "确认保持本地",
          confirm: "保持本地并结案",
          body: B.kv([
            ["业务信息", d.field],
            ["本地结果", d.local],
            ["处理说明", reason],
          ]),
          onConfirm: () => commit(reason),
        });
      },
      handoff: () => B.future("来源冲突确认", d.opp || d.customer),
      recheck: () => {
        B.change((st) => {
          B.log(st, id, "重新检查差异", "来源与本地结果未发生新的实质变化");
        });
        const h = dr.body.querySelector(".sd-history");
        if (h) h.innerHTML = B.history(id);
        SC.toast("已核对当前结果，未重复产生待办");
      },
    });
  }

  /* ------------------------------------------------------------ 差异清单 */
  B.mount(
    {
      pid: "P-ADM-26",
      title: "来源差异",
      menu: "recon",
      crumb: [{ t: "CRM数据管理", href: "reconcile.html" }],
    },
    (body, actions) => {
      const s = B.load();
      actions.innerHTML = B.link("reconcile", "返回CRM数据管理", {}, "btn");
      body.innerHTML =
        B.strip(
          ["待处理", "处理中", "已处理", "差异已消失"].map((state) => [
            state,
            s.diffs.filter((d) => d.state === state).length,
          ]),
        ) + '<div id="diff-table"></div>';
      B.table(
        body.querySelector("#diff-table"),
        s.diffs,
        [
          [
            "客户 / 差异",
            (d) => B.entity(B.name("customers", d.customer, s), d.id, "sliders"),
          ],
          ["业务信息", (d) => B.e(d.field)],
          ["来源变化", (d) => B.e(d.kind)],
          ["本地结果", (d) => B.e(d.local)],
          [
            "状态",
            (d) =>
              B.badge(
                d.state,
                d.state === "已处理" || d.state === "差异已消失"
                  ? "green"
                  : "amber",
              ),
          ],
          ["发现时间", (d) => B.e(d.at)],
          ["操作", (d) => B.btn("核对差异", "review", d.id, "eye", "btn--sm")],
        ],
        {
          key: "diffs",
          filters: [
            {
              key: "state",
              label: "处理状态",
              options: ["待处理", "处理中", "已处理", "差异已消失"],
            },
          ],
          searchText: (d) => d.id + d.field + B.name("customers", d.customer, s),
        },
      );
      B.actions(body, { review: (rid) => openDrawer(rid) });
      if (deepLink && !autoOpened) {
        autoOpened = true;
        if (B.find("diffs", deepLink, s))
          requestAnimationFrame(() => openDrawer(deepLink));
      }
    },
  );
})(window.SC, window.SC.B2);
