/* ==========================================================================
   P-ADM-29 Agent 实例
   版式：实例清单（含 全部 / 绑定失败 / 读取失败 分页与批量重试）为主页；
        「查看详情」从右侧滑出抽屉，在清单内就地处理。抽屉承载绑定空间、
        首次读取与恢复、读取范围、操作记录；重试 / 核对未完成处理的
        二次确认与结算规则保持不变。
   ========================================================================== */

(function (SC, B) {
  "use strict";

  const E = SC.esc;
  const deepLink = SC.param("id");
  let view = SC.param("view") || "all";
  let autoOpened = false;

  function setUrl(id) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set("id", id);
      else u.searchParams.delete("id");
      history.replaceState(null, "", u);
    } catch (e) {}
  }

  /* 重试（一览批量 + 抽屉单条共用）；onDone 用于抽屉关闭 */
  function retry(ids, kind, onDone) {
    const versions = Object.fromEntries(
      ids.map((id) => [id, B.find("agents", id)?.version]),
    );
    B.modal({
      title: kind === "bind" ? "重试实例绑定" : "重试上下文读取",
      confirm: "确认重试",
      body:
        SC.note(
          kind === "bind"
            ? "继续同次创建与绑定，不另建重复实例。"
            : "只重试读取，原实例和有效绑定保持不变。",
        ) +
        B.kv([
          ["选择实例", ids.join("、")],
          ["处理数量", ids.length],
        ]),
      onConfirm: () => {
        const rows = B.retryAgent(ids, kind, versions);
        if (onDone) onDone();
        B.render();
        B.results(rows, "Agent 重试结果");
      },
    });
  }

  /* ------------------------------------------------------------ 实例详情抽屉 */
  function openDrawer(id) {
    const s = B.load();
    const a = B.find("agents", id, s),
      w = a && B.find("spaces", a.space, s);
    if (!a || !w) {
      SC.toast("实例不存在", "bad");
      return;
    }
    const state = SC.AGENT_STATES[a.state];

    const body =
      (a.state === "stopped"
        ? SC.note(
            "该实例已停止，历史输出保留只读。解档后使用新实例，不重启原实例。",
          )
        : "") +
      B.sect(
        "绑定空间",
        B.facts([
          ["客户", B.name("customers", w.customer, s)],
          ["空间标识", w.id],
          ["当前销售", B.name("people", w.sales, s)],
          ["客户池", B.name("pools", w.pool, s)],
          ["空间状态", SC.SPACE_STATES[w.status].label],
          ["绑定情况", a.bound ? "已达成绑定" : "尚未绑定成功"],
        ]),
      ) +
      B.sect(
        "首次读取与恢复",
        B.facts([
          ["当前状态", state.label],
          ["状态时间", a.at],
          ["读取轮次", a.round],
          ["已自动重试", a.tries + " 次"],
          ["问题类型", a.problem === "context" ? "上下文本身问题" : "系统层面问题"],
          ["失败原因", a.why || "无"],
        ]),
      ) +
      B.sect(
        "读取范围",
        B.facts([
          ["允许范围", "本绑定空间合法上下文及共享客户主档"],
          ["历史内容", "合法转出历史、已装载但隐藏的记录"],
          ["不允许", "其他池空间、从未装载内容及未生效候选"],
        ]),
      ) +
      B.sect(
        "实例操作记录",
        '<div class="as-history">' + B.history(id) + "</div>",
      );

    let primary = "";
    if (a.current && w.status === "normal" && a.state === "bindfail")
      primary = B.btn("重试绑定", "bind", a.id, "retry", "btn--primary");
    else if (a.current && w.status === "normal" && a.state === "readfail")
      primary = B.btn("重试读取", "read", a.id, "retry", "btn--primary");
    else if (a.current && ["reading", "binding"].includes(a.state))
      primary = B.btn("核对未完成处理", "long", a.id, "clock", "btn--primary");
    const recordBtn = a.record
      ? B.btn("定位问题记录", "record", a.record, "file")
      : "";
    const footer =
      primary || recordBtn
        ? recordBtn + '<div class="b2-foot__main">' + primary + "</div>"
        : "";

    const dr = B.drawer({
      title: "Agent 实例详情",
      sub:
        B.badge(state.label, state.tone || "neutral") +
        '<span class="b2-drawer__dot"></span><span class="mono">' +
        E(a.id) +
        '</span><span class="b2-drawer__dot"></span>' +
        E(a.at),
      body,
      footer,
      onClose: () => setUrl(""),
    });
    setUrl(id);

    B.actions(dr.root, {
      bind: (aid) => retry([aid], "bind", () => dr.close()),
      read: (aid) => retry([aid], "read", () => dr.close()),
      record: (rid) =>
        B.modal({
          title: "问题记录定位",
          body:
            B.kv([
              ["记录标识", rid],
              ["记录类型", "录音"],
              ["问题", "缺少本类型要求的发生时间"],
              ["处理方向", "由有权维护者在录音管理中核对"],
            ]) + SC.note("当前核对不删除记录，不伪造关联，不扩大读取范围。"),
          confirm: "查看责任入口",
          onConfirm: () => {
            setTimeout(() => B.future("录音管理", rid), 0);
          },
        }),
      long: (aid) => {
        const ag = B.find("agents", aid),
          reading = ag.state === "reading";
        B.modal({
          title: "核对未完成处理",
          confirm: reading ? "结束旧轮次并重试" : "确认本次绑定失败",
          body:
            B.kv([
              ["实例", ag.id],
              ["开始时间", ag.start],
              ["当前状态", SC.AGENT_STATES[ag.state].label],
            ]) +
            SC.note(
              reading
                ? "结束旧读取轮次后再发起读取。原绑定保留，旧结果迟到不生效。"
                : "先确认本次绑定失败，再从绑定失败清单继续同次绑定。",
              "warn",
            ),
          onConfirm: () => {
            B.change((st) => {
              const x = B.find("agents", aid, st),
                sp = B.find("spaces", x.space, st);
              if (x.version !== ag.version || !x.current || sp.status !== "normal")
                throw Error("当前状态已变化");
              if (reading) {
                x.round++;
                x.state = x.problem === "context" ? "readfail" : "ready";
                x.why = x.problem === "context" ? "问题记录尚未修正" : "";
              } else {
                x.state = "bindfail";
                x.why = "人工核对：本次绑定未完成";
              }
              x.at = B.now();
              x.version++;
              B.log(
                st,
                aid,
                reading ? "结束旧轮次并重试读取" : "核对绑定结果",
                reading ? "原绑定保留" : "确认失败，可继续重试",
              );
            });
            dr.close();
            B.render();
            SC.toast("已返回当前处理结果");
          },
        });
      },
    });
  }

  /* ------------------------------------------------------------ 实例清单 */
  B.mount(
    {
      pid: "P-ADM-29",
      title: "Agent 实例",
      menu: "recon",
      crumb: [{ t: "CRM数据管理", href: "reconcile.html" }],
    },
    (body, actions) => {
      const s = B.load(),
        binding = s.agents.filter((a) => a.current && a.state === "bindfail"),
        reading = s.agents.filter((a) => a.current && a.state === "readfail");
      actions.innerHTML =
        B.link("reconcile", "返回CRM数据管理", {}, "btn") +
        B.iconBtn("刷新当前状态", "refresh", "", "sync");
      const titleFor = (a) => {
        const w = B.find("spaces", a.space, s);
        return w ? B.name("customers", w.customer, s) : "未知空间";
      };
      body.innerHTML =
        B.strip([
          [
            "当前实例",
            s.agents.filter((a) => a.current).length,
            "每空间一个当前实例",
            "bot",
          ],
          [
            "已达成绑定",
            s.agents.filter((a) => a.current && a.bound).length,
            "读取失败仍保留绑定",
            "link",
          ],
          ["绑定失败", binding.length, "独立重试绑定", "alert"],
          ["读取失败", reading.length, "独立重试读取", "file"],
        ]) + '<div id="agent-tabs"></div><div id="agents-table"></div>';
      B.tabs(
        body.querySelector("#agent-tabs"),
        [
          ["all", "实例状态", s.agents.length],
          ["bind", "绑定失败", binding.length],
          ["read", "读取失败", reading.length],
        ],
        view,
        (v) => {
          view = v;
          setUrl("");
          history.replaceState(null, "", "?view=" + v);
          B.render();
        },
      );
      const rows =
        view === "bind" ? binding : view === "read" ? reading : s.agents;
      const columns = [
        ["实例 / 客户", (a) => B.entity(titleFor(a), a.id, "bot")],
        [
          "空间 / 客户池",
          (a) => {
            const w = B.find("spaces", a.space, s);
            return (
              '<span class="mono">' +
              B.e(a.space) +
              '</span><p class="b2-sub">' +
              B.e(B.name("pools", w?.pool, s)) +
              "</p>"
            );
          },
        ],
        [
          "空间状态",
          (a) => SC.spaceState(B.find("spaces", a.space, s)?.status || "none"),
        ],
        [
          "绑定",
          (a) =>
            B.badge(a.bound ? "已达成" : "未达成", a.bound ? "green" : "neutral"),
        ],
        [
          "实例状态",
          (a) => SC.agentState(a.state, { milestone: false, safe: false }),
        ],
        ["当前 / 历史", (a) => (a.current ? "当前" : "历史")],
        ...(view !== "all"
          ? [
              ["失败原因", (a) => B.e(a.why)],
              ["自动重试", (a) => a.tries + " 次"],
            ]
          : [["状态时间", (a) => B.e(a.at)]]),
        ["操作", (a) => B.btn("查看详情", "review", a.id, "eye", "btn--sm")],
      ];
      B.table(body.querySelector("#agents-table"), rows, columns, {
        key: "agents-" + view,
        select: view !== "all",
        batchLabel: view === "bind" ? "重试绑定" : "重试读取",
        onBatch: (ids) => retry(ids, view),
        emptyTitle:
          view === "bind"
            ? "暂无待人工处理的绑定失败"
            : view === "read"
              ? "暂无待人工处理的读取失败"
              : "暂无实例",
        searchText: (a) => a.id + titleFor(a) + a.space,
        filters:
          view === "all"
            ? [
                {
                  key: "state",
                  label: "实例状态",
                  options: Object.entries(SC.AGENT_STATES).map(([v, x]) => [
                    v,
                    x.label,
                  ]),
                },
                {
                  key: "current",
                  label: "实例范围",
                  options: [
                    ["true", "当前实例"],
                    ["false", "历史实例"],
                  ],
                },
              ]
            : [],
      });
      B.actions(body, { review: (rid) => openDrawer(rid) });
      B.actions(actions, {
        refresh: () => {
          B.render();
          SC.toast("状态已刷新");
        },
      });
      if (deepLink && !autoOpened) {
        autoOpened = true;
        if (B.find("agents", deepLink, s))
          requestAnimationFrame(() => openDrawer(deepLink));
      }
    },
  );
})(window.SC, window.SC.B2);
