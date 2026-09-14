/* ==========================================================================
   P-ADM-31 审计事件详情 · 来源 M03-1 §4.1 / §4.2 / §4.4 / §4.5 / §4.6
   版式：概览卡 + 范围指标卡（通栏）→ 左右 7 / 3 主次布局。
   · 左 7：主内容卡，操作身份·范围 / 关系快照 / 依据引用 / 更正痕迹 做 tab 分页。
   · 右 3：上下文栏，记录规则 + 同批次相邻事件。
   · 操作身份三维度分别展示，不合并为一个「操作人」。
   · 缺明细的事件明确显示「暂无扩展明细」，不借用其他事件的数据。
   ========================================================================== */

(function (SC, B) {
  "use strict";

  var D = SC.DATA;
  var E = SC.esc;
  var id = SC.param("id") || "E-90210";
  var e = D.audit(id) || D.audit("E-90210");
  var det = D.AUDIT_DETAIL[e.id] || null;
  var activeTab = "scope";

  var OBJ_ICON = {
    人员: "users", 账号: "key", 分组: "sitemap", 商机: "box",
    经营组合: "layers", 空间: "grid", 客户: "building", 客户工作空间: "grid",
    实例: "bot", 批次: "inbox", 同步轮次: "sync", 产品: "box", 来源: "database",
  };
  function objType() { return (e.obj || "").split(/\s+/)[0] || "对象"; }
  function objIcon() { return OBJ_ICON[objType()] || "file"; }

  function resultBadge(r) {
    if (r === "ok") return SC.badge("成功", "green", { sm: true, dot: true });
    if (r === "fail") return SC.badge("失败", "red", { sm: true, dot: true });
    return SC.badge("部分成功", "amber", { sm: true, dot: true });
  }

  function evDef() {
    if (det?.definition) return det.definition;
    var list = D.EVENT_CATALOG[e.domain] || [];
    for (var i = 0; i < list.length; i++) if (list[i].code === e.code) return list[i];
    return null;
  }

  /* ---------------------------------------------- 基元 */

  function card(title, sub, inner, cls) {
    return '<div class="au-card ' + (cls || "") + '">' +
      (title ? '<div class="au-card__head"><h2>' + E(title) + "</h2>" +
        (sub ? '<p class="au-card__sub">' + sub + "</p>" : "") + "</div>" : "") +
      '<div class="au-card__body">' + inner + "</div></div>";
  }

  function block(title, sub, inner) {
    return '<div class="au-block"><div class="au-block__h"><h3>' + E(title) + "</h3>" +
      (sub ? "<span>" + sub + "</span>" : "") + "</div>" + inner + "</div>";
  }

  function isSame(r) { return r.before === r.after || /未变更|不变|保持/.test(r.after); }

  function compare(rows) {
    function pane(title, side, mod) {
      return '<div class="au-pane ' + mod + '"><h4>' + E(title) + "</h4>" +
        '<dl class="b2-kv">' + rows.map(function (r) {
          var same = isSame(r);
          var val = side === "before" ? r.before : r.after;
          return '<div class="' + (same ? "is-same" : "is-changed") + '"><dt>' + E(r.k) +
            "</dt><dd>" + E(val) +
            (!same && side === "after" ? ' <span class="au-chip">变更</span>' : "") +
            "</dd></div>";
        }).join("") + "</dl></div>";
    }
    return '<div class="b2-compare au-snap">' +
      pane("变更前", "before", "au-pane--before") +
      pane("变更后", "after", "au-pane--after") + "</div>";
  }

  function evidenceView(list) {
    var uses = {};
    (list || []).forEach(function (x) { (uses[x.use] = uses[x.use] || []).push(x); });
    return '<div class="au-ev">' + Object.keys(uses).map(function (u) {
      return '<div class="au-ev__group"><div class="au-ev__use">' + E(u) + "</div>" +
        uses[u].map(function (x) {
          return '<div class="au-ev__item"><span class="au-ev__type">' + E(x.type) + "</span>" +
            '<span class="au-ev__id mono">' + E(x.id) + "</span>" +
            (x.fixed ? '<span class="au-chip au-chip--warn">已更正</span>' : "") +
            '<button type="button" class="au-ev__link" data-action="locate">' +
            SC.icon("link", 13) + "定位</button></div>";
        }).join("") + "</div>";
    }).join("") + "</div>";
  }

  function corrections(list) {
    if (list && list.length) {
      return '<ul class="au-timeline">' + list.map(function (c) {
        return '<li><div class="au-timeline__t mono">' + E(c.at) + " · " + E(c.by) + "</div>" +
          '<div class="au-timeline__b">' + E(c.k) + "：" + E(c.before) + " → " + E(c.after) + "</div></li>";
      }).join("") + "</ul>";
    }
    return '<div class="au-quiet">' + SC.icon("ok", 15) +
      "<span>本事件无更正记录。事件按发生及阶段去重，同一动作重复送达不重复生成事件；" +
      "若发生更正，此处按时序展示前后值、更正人与时间。</span></div>";
  }

  function ruleRail(ev) {
    var rows = [
      ["分流", ev ? (ev.flow === "两者" ? "两者（业务动态 + 操作审计）" : ev.flow) : "—"],
      ["去重键", ev ? ev.dedup : "—"],
      ["保留期限", "V1.0 永久保留"],
      ["可见范围", "仅超级管理员"],
    ];
    return '<dl class="au-rail-kv">' + rows.map(function (r) {
      return "<div><dt>" + E(r[0]) + "</dt><dd>" + E(r[1]) + "</dd></div>";
    }).join("") + "</dl>";
  }

  function feed() {
    var list = D.AUDIT, idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === e.id) { idx = i; break; }
    var win = list.slice(Math.max(0, idx - 2), idx + 3);
    return '<ul class="au-feed">' + win.map(function (x) {
      var cur = x.id === e.id;
      return '<li class="' + (cur ? "is-current" : "") + '">' +
        '<span class="au-feed__dot au-feed__dot--' + x.result + '"></span>' +
        '<div class="au-feed__main">' +
          '<div class="au-feed__name">' + (cur
            ? "<b>" + E(x.name) + '</b> <span class="au-chip">当前</span>'
            : '<a href="' + B.href("audit-detail", { id: x.id }) + '">' + E(x.name) + "</a>") + "</div>" +
          '<div class="au-feed__meta mono">' + E(x.at) + " · " + E(x.code) + "</div>" +
        "</div></li>";
    }).join("") + "</ul>";
  }

  /* 主内容 tab 面板 */
  function panelContent(key) {
    if (key === "scope") {
      return block("操作身份", "三维度分别展示，<b>不合并为一个「操作人」</b>", B.kv([
        ["发起人", det.identity.by],
        ["操作入口", det.identity.entry],
        ["实际执行方", det.identity.exec],
      ])) +
      block("涉及范围", "全系统共用一套标识，标识终身不变",
        B.kv(det.scope.map(function (s) { return [s.k, s.v]; })));
    }
    if (key === "snapshot") {
      return compare(det.snapshot) + (det.note ? SC.note(det.note, "info") : "");
    }
    if (key === "evidence") {
      return evidenceView(det.evidence) +
        SC.note("所指记录被更正后，引用<b>仍指向该记录</b>并展示「已更正」标记，可查看更正历史；" +
          "Agent 输出不可更正，修正走新增输出、原输出作为历史保留。", "info");
    }
    return corrections(det.corrections);
  }

  var TABS = [
    ["scope", "身份与范围"],
    ["snapshot", "关系快照"],
    ["evidence", "依据引用"],
    ["corr", "更正痕迹"],
  ];

  function tabCard() {
    var bar = '<div class="au-tabbar" role="tablist">' + TABS.map(function (t) {
      var on = t[0] === activeTab;
      return '<button type="button" role="tab" class="au-tab' + (on ? " is-active" : "") +
        '" aria-selected="' + on + '" data-autab="' + t[0] + '">' + E(t[1]) + "</button>";
    }).join("") + "</div>";
    var panels = '<div class="au-tabpanels">' + TABS.map(function (t) {
      var on = t[0] === activeTab;
      return '<div class="au-tabpanel" role="tabpanel" data-panel="' + t[0] + '"' +
        (on ? "" : " hidden") + ">" + panelContent(t[0]) + "</div>";
    }).join("") + "</div>";
    return '<div class="au-card au-tabcard">' + bar + panels + "</div>";
  }

  function wireTabs(root) {
    var bar = root.querySelector(".au-tabbar");
    if (!bar) return;
    var panels = root.querySelectorAll(".au-tabpanel");
    bar.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-autab]");
      if (!b) return;
      activeTab = b.dataset.autab;
      bar.querySelectorAll("[data-autab]").forEach(function (t) {
        var on = t.dataset.autab === activeTab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on);
      });
      panels.forEach(function (p) { p.hidden = p.dataset.panel !== activeTab; });
    });
  }

  function wire(root) {
    B.actions(root, {
      locate: function () { SC.toast("跳转至对应记录的具体位置（原型不做真实跳转）", "bad"); },
      chain: function () { location.href = B.href("audit-query", { tab: "object", obj: e.obj }); },
    });
  }

  /* ---------------------------------------------- 装配 */

  B.mount(
    { pid: "P-ADM-31", title: e.name, menu: "audit", crumb: [{ t: "操作审计", href: "audit-query.html" }] },
    function (body, actions) {
      var ev = evDef();
      var sep = '<span class="au-head__sep">·</span>';

      var summary =
        '<div class="au-card au-summary">' +
          '<span class="b2-entity__mark">' + SC.icon(objIcon(), 22) + "</span>" +
          '<div class="au-head__body">' +
            '<div class="au-head__row">' +
              '<h2 class="au-obj-name">' + E(e.name) + "</h2>" +
              resultBadge(e.result) +
              SC.badge("域 " + e.domain + " · " + D.domain(e.domain).name, "neutral", { sm: true }) +
            "</div>" +
            '<div class="au-head__meta">' +
              '<span class="au-head__obj">' + E(e.obj) + "</span>" + sep +
              '<span class="mono">' + E(e.code) + "</span>" + sep + "事件标识 " +
              '<span class="mono">' + E(e.id) + "</span>" + sep + "发生时间 " +
              '<span class="mono">' + E(e.at) + "</span>" +
            "</div>" +
          "</div>" +
          '<div class="au-summary__act">' +
            B.btn("串联该对象全部事件", "chain", "", "link") +
          "</div>" +
        "</div>";

      var side =
        card("记录规则", "", ruleRail(ev)) +
        card("同批次相邻事件", "按发生时序排列，可跳转", feed());

      var main = det
        ? tabCard()
        : card("扩展明细", "", B.empty("该事件暂无扩展明细",
            "本示例数据仅覆盖部分事件的身份、范围、快照与依据；事件基本信息见上方概览。"));

      var kpi = det ? card("", "", B.strip(det.kpi || []), "au-kpi") : "";

      body.innerHTML =
        summary +
        '<div class="au-grid">' +
          '<div class="au-col-main">' + kpi + main + "</div>" +
          '<div class="au-col-side">' + side + "</div>" +
        "</div>";

      wireTabs(body);
      wire(body);
    }
  );

})(window.SC, window.SC.B2);
