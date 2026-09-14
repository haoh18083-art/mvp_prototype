(function (SC, B) {
  let view = SC.param("view") || "runs",
    id = SC.param("id");
  B.mount(
    {
      pid: "P-ADM-24",
      title: "接入与同步",
      menu: "recon",
      crumb: [{ t: "CRM数据管理", href: "reconcile.html" }],
    },
    (body, actions) => {
      const s = B.load();
      actions.innerHTML = B.btn(
        s.syncBusy ? "正在同步" : "手动同步",
        "sync",
        "",
        "sync",
        "btn--primary",
      );
      actions.querySelector("button").disabled = s.syncBusy;
      body.innerHTML =
        '<div id="sync-tabs"></div><div id="sync-content"></div>';
      B.tabs(
        body.querySelector("#sync-tabs"),
        [
          ["prepare", "接入准备"],
          ["runs", "同步记录", s.runs.length],
        ],
        view,
        (v) => {
          view = v;
          id = "";
          history.replaceState(null, "", "?view=" + v);
          B.render();
        },
      );
      const root = body.querySelector("#sync-content");
      if (view === "prepare") {
        root.innerHTML =
          B.section(
            "接入准备",
            '<div class="b2-section__body">' +
              B.kv([
                ["来源系统", "CRM"],
                ["接入方向", "单向接收，不回写"],
                ["同步频率", "每 5 分钟触发"],
                ["客户与商机", "按独立来源对象关联"],
                ["最近成功", s.lastSuccess],
                ["当前读取", s.runs[0].state],
              ]) +
              "</div>",
          ) + '<div id="prepare-table"></div>';
        B.table(
          root.querySelector("#prepare-table"),
          [
            {
              id: "客户",
              dest: "基础档案；未映射字段进入全量信息",
              status: "可提供",
            },
            {
              id: "联系人",
              dest: "姓名、职位、电话、邮箱、主要联系人",
              status:
                s.runs[0].state === "部分成功" ? "最近读取失败" : "可提供",
            },
            {
              id: "真实商机",
              dest: "关联客户、产品、商机自身归属销售",
              status: "可提供",
            },
            { id: "产品", dest: "产品身份核对及激活管理", status: "可提供" },
            {
              id: "人员",
              dest: "本地销售对应；不修改账号或角色",
              status: "存在对应缺失",
            },
            {
              id: "CRM 客户池",
              dest: "仅供来源筛选，允许为空",
              status: "部分来源为空",
            },
          ],
          [
            ["来源类别", (r) => r.id],
            ["对应去向", (r) => r.dest],
            [
              "当前情况",
              (r) =>
                B.badge(r.status, r.status === "可提供" ? "green" : "amber"),
            ],
          ],
          { search: false },
        );
      } else if (id) {
        const run = B.find("runs", id, s);
        if (!run) {
          root.innerHTML = B.empty("同步记录不存在");
          return;
        }
        root.innerHTML =
          B.section(
            "运行结果",
            '<div class="b2-section__body">' +
              B.kv([
                ["同步标识", run.id],
                ["触发方式", run.trigger],
                ["开始时间", run.start],
                ["完成时间", run.end || "进行中"],
                ["读取结果", run.state],
                ["失败范围", run.why || "无"],
              ]) +
              "</div>",
            B.btn("返回记录", "back", "", "back", "btn--sm"),
          ) +
          B.strip([
            ["新接入", run.newCount],
            ["保持本地", run.kept],
            ["数据异常", s.issues.filter((x) => x.state === "待处理").length],
            ["待合并对", s.merges.filter((x) => x.state === "待处理").length],
          ]) +
          B.section("分类读取结果", '<div id="run-types"></div>') +
          B.section("正式来源商机", '<div id="run-opps"></div>');
        B.table(
          root.querySelector("#run-types"),
          ["客户", "联系人", "商机", "产品"].map((name) => ({
            id: name,
            status:
              name === "联系人" && run.state === "部分成功"
                ? "读取失败"
                : "成功",
            at:
              name === "联系人" && run.state === "部分成功"
                ? "2026-09-08 09:15:12"
                : run.end || "尚未完成",
          })),
          [
            ["数据类别", (r) => r.id],
            [
              "读取结果",
              (r) => B.badge(r.status, r.status === "成功" ? "green" : "red"),
            ],
            ["最近成功", (r) => B.e(r.at)],
          ],
          { search: false },
        );
        B.table(
          root.querySelector("#run-opps"),
          s.opps.filter((o) => o.origin === "CRM"),
          B.oppColumns(s, { source: true }).concat([
            ["接入结果", () => B.badge("已接入")],
            [
              "来源详情",
              (o) => B.btn("查看", "record", o.id, "eye", "btn--sm"),
            ],
          ]),
          { key: run.id },
        );
      } else
        B.table(
          root,
          s.runs,
          [
            ["同步标识", (r) => B.link("sync-detail", r.id, { id: r.id })],
            ["触发方式", (r) => B.e(r.trigger)],
            ["开始时间", (r) => B.e(r.start)],
            ["完成时间", (r) => B.e(r.end || "进行中")],
            [
              "读取结果",
              (r) =>
                B.badge(
                  r.state,
                  r.state === "成功"
                    ? "green"
                    : r.state === "部分成功"
                      ? "amber"
                      : "brand",
                ),
            ],
            ["新增 / 保留", (r) => r.newCount + " / " + r.kept],
          ],
          {
            key: "runs",
            filters: [
              {
                key: "state",
                label: "读取结果",
                options: ["成功", "部分成功", "同步中"],
              },
            ],
          },
        );
      B.actions(actions, {
        sync: () => {
          try {
            B.startSync();
          } catch (e) {
            SC.toast(e.message, "bad");
          }
        },
      });
      B.actions(root, {
        back: () => {
          id = "";
          history.replaceState(null, "", "?view=runs");
          B.render();
        },
        record: (oid) => {
          const o = B.find("opps", oid, s);
          B.modal({
            title: "来源商机详情",
            wide: true,
            body:
              B.kv([
                ["来源商机", o.id],
                ["客户", B.name("customers", o.customer, s)],
                ["来源客保", "CRM 接入继承，有效归属"],
                [
                  "归属销售",
                  o.sales
                    ? B.name("people", o.sales, s)
                    : o.sourceSales || "空余",
                ],
                [
                  "产品激活",
                  B.find("products", o.product, s)?.active
                    ? "已激活"
                    : "未激活",
                ],
                ["本地客户池", B.name("pools", o.pool, s)],
                ["准入", B.combo(o, s)?.admit || "未提报"],
                ["空间", B.spaceFor(o, s)?.id || "未建立"],
                ["本地审批单", "不伪造来源审批记录"],
              ]) +
              '<div class="b2-actions u-mt4">' +
              B.link("data-issues", "数据异常", {}, "btn") +
              B.link("source-diffs", "来源差异", {}, "btn") +
              B.link("customer-merge", "主体核对", {}, "btn") +
              "</div>",
          });
        },
      });
    },
  );
})(window.SC, window.SC.B2);
