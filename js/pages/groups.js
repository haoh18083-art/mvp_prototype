/* ==========================================================================
   P-ADM-05 销售分组页 · 来源 M02-2 §4.1 分组创建与命名 / §4.3 待分组销售清单与提醒
   区域：概览指标条、分组列表区、待分组销售区、影响说明区、创建/分配弹窗
   采用 batch2 表格框架（与 P-ADM-07 客户池管理同一套观感）。
   分组、成员、主管及统计均读取共享数据；提交后跨页生效。
   ========================================================================== */

(function (SC, B) {
  "use strict";

  var D = SC.DATA;
  var tab = SC.param("view") || "groups";

  /* 未分组销售：角色为销售且未归入分组 */
  function ungrouped() {
    return D.PEOPLE.filter(function (p) { return p.role === "SLS" && p.group === "—"; });
  }
  function groupedCount() {
    return D.PEOPLE.filter(function (p) { return p.role === "SLS" && p.group !== "—"; }).length;
  }

  /* 经营规模：三项迷你指标合并为一格（替代旧版铺开的三列稀疏数字） */
  function scale(items) {
    return '<div class="grp-metrics">' +
      items.map(function (it) {
        return '<div><div class="grp-metrics__v">' + it[0] +
          '</div><div class="grp-metrics__k">' + SC.esc(it[1]) + "</div></div>";
      }).join("") +
      "</div>";
  }

  /* 销售主管单元格：有主管→头像+姓名；无主管→醒目待指派徽标 */
  function mgrCell(g) {
    if (g.mgr === "—") {
      return '<span class="badge badge--amber badge--sm">' + SC.icon("warn", 11) + " 无主管 · 待指派</span>";
    }
    return '<div class="grp-mgr"><span class="grp-mgr__av">' + SC.esc(g.mgr.charAt(0)) + "</span>" +
      '<div><div class="grp-mgr__name">' + SC.esc(g.mgr) + "</div>" +
      '<div class="grp-mgr__role">' + (g.managerAvailable ? '销售主管' : '账号停用 · 超管兜底') + '</div></div></div>';
  }

  B.mount(
    { pid: "P-ADM-05", title: "销售分组", menu: "groups" },
    function (body, actions) {
      var groups = D.GROUPS;
      var pend = ungrouped();
      var noMgr = groups.filter(function (g) { return !g.managerAvailable; }).length;

      actions.innerHTML = B.btn("创建分组", "create", "", "plus", "btn--primary");
      B.actions(actions, { create: openCreate });

      body.innerHTML =
        B.strip([
          ["分组数", groups.length, "本地销售团队", "sitemap"],
          ["已分组销售", groupedCount(), "已归入分组", "users"],
          ["待分组销售", pend.length, "尚未归入分组", "clock"],
          ["无可用主管分组", noMgr, "超管兜底，可办理主管继任", "alert"],
        ]) +
        '<div id="grp-tabs"></div><div id="grp-content"></div>';

      B.tabs(
        body.querySelector("#grp-tabs"),
        [
          ["groups", "分组", groups.length],
          ["ungrouped", "待分组销售", pend.length],
        ],
        tab,
        function (v) {
          tab = v;
          var u = new URL(location.href); u.searchParams.set("view", v); history.replaceState(null, "", u.href);
          B.render();
        }
      );

      var root = body.querySelector("#grp-content");

      if (tab === "groups") {
        B.table(
          root,
          groups,
          [
            ["分组", function (g) {
              return B.entity(g.name, g.id, "sitemap", B.href("group-detail", { id: g.id }));
            }],
            ["销售主管", mgrCell],
            ["销售数", function (g) {
              return '<span class="grp-count"><b>' + g.sales + "</b><span>名</span></span>";
            }],
            ["经营规模", function (g) {
              return scale([[g.cust, "去重客户"], [g.combo, "经营组合"], [g.space, "当前空间"], [g.history, "归档历史"]]);
            }],
            ["操作", function (g) {
              return B.iconBtn("查看详情", "open", g.id, "eye");
            }],
          ],
          { key: "groups", placeholder: "搜索分组名称或编号", searchText: function (g) { return g.id + g.name + g.mgr; } }
        );
        B.actions(root, {
          open: function (id) { location.href = B.href("group-detail", { id: id }); },
        });
      } else {
        root.innerHTML =
          SC.note(
            "<b>影响说明</b>　未分组销售<b>本人仍可查看</b>自己的经营组合与有权空间，但没有主管能查看其范围或受理其新提报。" +
            "需主管受理的新客保申请与普通准入提报会提示先分组；固定由超管受理的首批、争议、释放等仍按原规则办理。",
            "warn"
          ) + '<div id="grp-pending"></div>';

        B.table(
          root.querySelector("#grp-pending"),
          pend,
          [
            ["销售", function (p) {
              return B.entity(p.name, p.id, "users", B.href("people-detail", { id: p.id }));
            }],
            ["账号状态", function (p) { return SC.state(p.status === "on"); }],
            ["进入时间", function (p) { return '<span class="grp-time">' + SC.esc(p.ungroupedAt || p.created) + "</span>"; }],
            ["经营规模", function (p) {
              return scale([[p.cust, "去重客户"], [p.combo, "经营组合"], [p.space, "当前空间"]]);
            }],
            ["操作", function (p) {
              return p.status === "on" ? B.iconBtn("分配到分组", "assign-one", p.id, "sitemap") : '<span class="u-t3">请先启用账号</span>';
            }],
          ],
          {
            key: "ungrouped",
            placeholder: "搜索姓名或编号",
            searchText: function (p) { return p.id + p.name; },
            select: true,
            eligible: function (p) { return p.status === "on" && !p.groupId; },
            batchLabel: "批量分配到分组",
            onBatch: function (ids) { openAssign(ids.map(function (id) { return D.person(id); })); },
            emptyTitle: "全部销售已完成分组",
            emptyReason: "所有销售均已归入分组。",
          }
        );
        B.actions(root, {
          "assign-one": function (id) { openAssign([D.person(id)]); },
        });
      }
    }
  );

  /* ============================================================ D-06 创建分组 */

  function openCreate() {
    B.modal({
      title: "创建分组",
      body:
        '<form class="b2-form">' +
        B.field("分组名称", "name", "", { required: true, max: 20, hint: "如：华南组" }) +
        B.field("销售主管", "mgr", "", {
          required: true, options: B.managerOptions(B.load()),
          hint: "请选择账号可用且尚未管理其他分组的销售主管。创建后允许暂时没有销售成员。",
        }) +
        "</form>",
      confirm: "确认创建",
      onConfirm: async function (root) {
        var v = B.values(root);
        await B.createGroup(v.name, v.mgr);
        B.render();
        SC.toast("已创建分组「" + v.name.trim() + "」", "ok");
      },
    });
  }

  /* ============================================================ 分配到分组（单个 / 批量） */

  function openAssign(list) {
    B.assignGroupModal(list.filter(Boolean).map(function (p) { return p.id; }));
  }

})(window.SC, window.SC.B2);
