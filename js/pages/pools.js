(function (SC, B) {
  let tab = SC.param("view") || "pools";
  B.mount(
    { pid: "P-ADM-07", title: "客户池管理", menu: "pools" },
    (body, actions) => {
      const s = B.load(),
        unset = s.opps.filter((o) => !o.pool),
        unassigned = s.people.filter((p) => p.role === "SOL" && !p.pool);
      actions.innerHTML =
        B.link("pool-assign", "存量商机指定", {}, "btn") +
        B.btn("创建客户池", "create", "", "plus", "btn--primary");
      body.innerHTML =
        B.strip([
          ["客户池", s.pools.length, "本地承接团队", "layers"],
          [
            "承接商机",
            s.opps.filter((o) => o.pool).length,
            "保留已结束与未激活记录",
            "box",
          ],
          ["待指定承接方", unset.length, "未建立客户池承接关系", "clock"],
          ["未分配人员", unassigned.length, "解决方案人员", "users"],
        ]) + '<div id="pool-tabs"></div><div id="pool-content"></div>';
      B.tabs(
        body.querySelector("#pool-tabs"),
        [
          ["pools", "客户池", s.pools.length],
          ["unset", "待指定承接方", unset.length],
          ["people", "未分配人员", unassigned.length],
        ],
        tab,
        (v) => {
          tab = v;
          history.replaceState(null, "", "?view=" + v);
          B.render();
        },
      );
      const root = body.querySelector("#pool-content");
      if (tab === "pools")
        B.table(
          root,
          s.pools,
          [
            [
              "客户池",
              (p) =>
                B.entity(
                  p.name,
                  p.id,
                  "layers",
                  B.href("pool-detail", { id: p.id }),
                ),
            ],
            [
              "承接客户",
              (p) => new Set(B.poolOpps(p.id, s).map((o) => o.customer)).size,
            ],
            ["商机", (p) => B.poolOpps(p.id, s).length],
            ["方案人员", (p) => s.people.filter((x) => x.pool === p.id).length],
            ["创建时间", (p) => B.e(p.created)],
            [
              "操作",
              (p) =>
                '<div class="b2-actions">' +
                B.iconBtn("维护名称", "edit", p.id, "edit") +
                B.iconBtn("删除客户池", "delete", p.id, "trash") +
                "</div>",
            ],
          ],
          { key: "pools", placeholder: "搜索客户池名称" },
        );
      else if (tab === "unset")
        B.table(
          root,
          unset,
          B.oppColumns(s).concat([
            [
              "处理",
              (o) => B.btn("指定客户池", "assign", o.id, "layers", "btn--sm"),
            ],
          ]),
          {
            key: "unset",
            select: true,
            batchLabel: "批量指定",
            onBatch: (ids) => B.choosePool(ids),
            searchText: (o) => o.id + o.name + B.name("people", o.sales, s),
          },
        );
      else
        B.table(
          root,
          unassigned,
          [
            ["人员", (p) => B.entity(p.name, p.id, "users")],
            ["账号状态", (p) => SC.state(p.status === "on")],
            ["分配状态", () => B.badge("未分配")],
            [
              "操作",
              (p) =>
                B.btn("选择客户池", "person-pool", p.id, "layers", "btn--sm"),
            ],
          ],
          { key: "people" },
        );
      B.actions(actions, { create: () => B.editPool() });
      B.actions(root, {
        edit: (id) => B.editPool(id),
        delete: (id) => B.deletePool(id),
        assign: (id) => B.choosePool([id]),
        "person-pool": () =>
          B.modal({
            title: "选择客户池",
            body:
              "<form>" +
              B.field("客户池", "pool", "", {
                options: [
                  ["", "请选择"],
                  ...s.pools.map((p) => [p.id, p.name]),
                ],
              }) +
              "</form>",
            confirm: "进入人员分配",
            onConfirm: (root) => {
              const id = B.values(root).pool;
              if (!id) throw Error("请选择客户池");
              location.href = B.href("pool-detail", { id, view: "people" });
            },
          }),
      });
    },
  );
})(window.SC, window.SC.B2);
