(function (SC, B) {
  // This page presents shared state; sync and business actions remain in their modules.
  const toneFor = (state) =>
    ({ 成功: "success", 部分成功: "warning", 失败: "danger", 同步中: "info" })[state] || "neutral";
  const status = (label, tone) =>
    '<span class="recon-status recon-status--' + tone + '"><span aria-hidden="true" class="recon-status__dot"></span>' +
    B.e(label) + '</span>';
  const link = (page, label, params = {}, cls = "recon-text-link") =>
    '<a class="' + cls + '" href="' + B.e(B.href(page, params)) + '">' +
    B.e(label) + SC.icon("arrow", 15) + '</a>';

  B.mount(
    { pid: "P-ADM-23", title: "CRM数据管理", menu: "recon" },
    (body, actions) => {
      const s = B.load();
      const last = s.runs[0];
      const runState = s.syncBusy ? "同步中" : last?.state || "暂无记录";
      const count = (type, state) => s[type].filter((x) => x.state === state).length;
      const reviews = [
        { title: "数据异常", page: "data-issues", icon: "alert", count: count("issues", "待处理"),
          desc: "核对关联缺失，补齐来源人员对应。", action: "核对数据" },
        { title: "来源差异", page: "source-diffs", icon: "sliders", count: count("diffs", "待处理"),
          desc: "对比来源变化与本地已生效结果。", action: "查看差异" },
        { title: "待合并客户", page: "customer-merge", icon: "building", count: count("merges", "待处理"),
          desc: "确认疑似重复的客户主体与关联。", action: "核对客户" },
      ];
      const pending = reviews.reduce((n, item) => n + item.count, 0);
      const downstream = [
        { title: "空间建立失败", page: "space-failures", params: {}, icon: "layers",
          count: s.spaces.filter((w) => w.status === "failed").length, desc: "有效准入后的空间建立与恢复" },
        { title: "Agent 绑定失败", page: "agent-status", params: { view: "bind" }, icon: "bot",
          count: s.agents.filter((a) => a.current && a.state === "bindfail").length, desc: "空间实例的创建与绑定" },
        { title: "Agent 读取失败", page: "agent-status", params: { view: "read" }, icon: "file",
          count: s.agents.filter((a) => a.current && a.state === "readfail").length, desc: "已绑定实例的上下文读取" },
      ];

      actions.innerHTML =
        B.btn("刷新状态", "refresh", "", "sync", "recon-refresh") +
        B.btn(s.syncBusy ? "正在同步" : "手动同步", "sync", "", "sync",
          "btn--primary" + (s.syncBusy ? " recon-is-syncing" : ""));
      actions.querySelector('[data-action="sync"]').disabled = s.syncBusy;

      body.innerHTML = `
        <div class="recon-dashboard">
          <section class="recon-overview" aria-label="接入状态与数据概况">
            <div class="recon-source">
              <div class="recon-source__head">
                <div class="recon-source__identity">
                  <span class="recon-source__mark">${SC.icon("database", 24)}</span>
                  <div><span class="recon-source__eyebrow">数据来源</span><h2>CRM 数据接入</h2></div>
                </div>
                <span role="status">${status(s.syncBusy ? "同步中" : last ? "最近同步 · " + last.state : "暂无同步记录", toneFor(runState))}</span>
              </div>
              <div class="recon-source__footer">
                <div class="recon-source__time"><span>最近成功时间</span><strong>${B.e(s.lastSuccess || "暂无成功记录")}</strong></div>
                <div class="recon-source__links">
                  ${B.link("sync-detail", "接入详情", { view: "prepare" }, "recon-source__prepare")}
                  ${link("sync-detail", "接入与同步", {}, "recon-source__open")}
                </div>
              </div>
            </div>
            <div class="recon-metric recon-metric--customers">
              <div class="recon-metric__head"><h2>正式客户</h2><span class="recon-metric__icon">${SC.icon("building", 20)}</span></div>
              <div class="recon-metric__value">${s.customers.filter((c) => !c.merged).length}<span>家</span></div>
              ${link("customers", "查看全量客户")}
            </div>
            <div class="recon-metric recon-metric--opps">
              <div class="recon-metric__head"><h2>真实商机</h2><span class="recon-metric__icon">${SC.icon("box", 20)}</span></div>
              <div class="recon-metric__value">${s.opps.length}<span>条</span></div>
            </div>
          </section>

          <section class="recon-review" aria-labelledby="recon-review-title">
            <div class="recon-section-head">
              <div class="recon-section-heading"><span class="recon-section-mark recon-section-mark--amber">${SC.icon("sliders", 19)}</span>
                <h2 id="recon-review-title">来源数据核对</h2>
              </div>
              ${status(pending ? pending + " 项待处理" : "暂无待处理事项", pending ? "warning" : "success")}
            </div>
            <div class="recon-review-grid">
              ${reviews.map((item) => `
                <a class="recon-task ${item.count ? "recon-task--pending" : "recon-task--clear"}" href="${B.e(B.href(item.page))}">
                  <div class="recon-task__head"><h3>${item.title}</h3><span class="recon-task__icon">${SC.icon(item.icon, 21)}</span></div>
                  <p>${item.desc}</p>
                  <div class="recon-task__footer"><div class="recon-task__count"><strong>${item.count}</strong><span>${item.count ? "项待处理" : "暂无待办"}</span></div>
                    <span class="recon-task__action">${item.action}${SC.icon("arrow", 16)}</span></div>
                </a>`).join("")}
            </div>
          </section>

          <div class="recon-bottom">
            <section class="recon-runs" aria-labelledby="recon-runs-title">
              <div class="recon-section-head">
                <div class="recon-section-heading"><span class="recon-section-mark">${SC.icon("history", 19)}</span>
                  <h2 id="recon-runs-title">最近同步</h2>
                </div>
                ${link("sync-detail", "全部记录")}
              </div>
              <div id="recent-runs">
                ${s.runs.length ? `
                  <div class="recon-runs-scroll" tabindex="0" role="region" aria-label="最近同步记录表格">
                    <table class="recon-runs-table">
                      <thead><tr><th scope="col">同步记录 / 触发方式</th><th scope="col">开始时间</th><th scope="col">读取结果</th><th scope="col">保留本地</th></tr></thead>
                      <tbody>${s.runs.slice(0, 3).map((r) => `
                        <tr><td>${B.link("sync-detail", r.id, { id: r.id }, "recon-run-id")}<span class="recon-run-trigger">${B.e(r.trigger)}</span></td>
                        <td><time class="recon-run-time">${B.e(r.start || "—")}</time></td>
                        <td>${status(r.state, toneFor(r.state))}</td><td class="recon-run-kept">${r.kept == null ? "—" : B.e(r.kept) + '<span> 项</span>'}</td></tr>`).join("")}</tbody>
                    </table>
                  </div>
                  <div class="recon-runs-foot">显示最近 ${Math.min(s.runs.length, 3)} 次运行<span>${SC.icon("shield", 14)}本地生效结果受保护</span></div>` : `
                  <div class="recon-empty">${SC.icon("history", 26)}<strong>暂无同步记录</strong><p>发起同步后，可在这里查看运行结果。</p></div>`}
              </div>
            </section>

            <aside class="recon-downstream" aria-labelledby="recon-downstream-title">
              <div class="recon-section-head">
                <div class="recon-section-heading"><span class="recon-section-mark">${SC.icon("layers", 19)}</span>
                  <h2 id="recon-downstream-title">空间与 Agent</h2>
                </div>
              </div>
              <div class="recon-instance-summary"><span>当前实例 <strong>${s.agents.filter((a) => a.current).length}</strong></span>${link("agent-status", "查看全部实例")}</div>
              <div class="recon-service-list">
                ${downstream.map((item) => `
                  <a class="recon-service" href="${B.e(B.href(item.page, item.params))}">
                    <span class="recon-service__icon">${SC.icon(item.icon, 18)}</span>
                    <div class="recon-service__text"><h3>${item.title}</h3><p>${item.desc}</p></div>
                    <span class="recon-service__count ${item.count ? "is-failed" : "is-clear"}">${item.count ? item.count + ' 项' : '无待办'}</span>${SC.icon("chevron", 14)}
                  </a>`).join("")}
              </div>
              <p class="recon-downstream-note">${SC.icon("info", 14)}<span>空间与 Agent 状态独立于 CRM 同步结果。</span></p>
            </aside>
          </div>
        </div>`;

      B.actions(actions, {
        refresh: () => {
          B.render();
          SC.toast("状态已刷新");
        },
        sync: () => {
          try {
            B.startSync();
          } catch (e) {
            SC.toast(e.message, "bad");
          }
        },
      });
    },
  );
})(window.SC, window.SC.B2);
