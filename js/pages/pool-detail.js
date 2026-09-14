(function (SC, B) {
  const id = SC.param("id") || "POOL-01";
  let tab = SC.param("view") || "opps";
  B.mount(
    {
      pid: "P-ADM-08",
      title: "客户池详情",
      menu: "pools",
      crumb: [{ t: "客户池管理", href: "pools.html" }],
    },
    (body, actions) => {
      const s = B.load(),
        p = B.find("pools", id, s);
      if (!p) {
        body.innerHTML = B.empty(
          "客户池不存在",
          "该客户池可能已删除，历史引用仍保留。",
        );
        actions.innerHTML = B.link("pools", "返回客户池", {}, "btn");
        return;
      }
      const opps = B.poolOpps(id, s),
        people = s.people.filter((x) => x.pool === id);
      actions.innerHTML =
        B.iconBtn("维护客户池名称", "edit", id, "edit") +
        B.iconBtn("删除客户池", "delete", id, "trash");
      body.innerHTML =
        '<div class="b2-detail-head">' +
        B.entity(p.name, p.id, "layers") +
        '<div class="u-grow"></div>' +
        B.badge("本地客户池") +
        "</div>" +
        B.strip([
          ["承接客户", new Set(opps.map((o) => o.customer)).size],
          ["商机", opps.length],
          ["解决方案人员", people.length],
          ["进行中方案任务", opps.reduce((n, o) => n + o.tasks, 0)],
        ]) +
        '<div id="detail-tabs"></div><div class="pool-detail-tools b2-actions"></div><div id="detail-table"></div>' +
        B.section(
          "基本信息",
          '<div class="b2-section__body">' +
            B.kv([
              ["创建人", p.by],
              ["创建时间", p.created],
              ["当前客户池", p.name],
            ]) +
            "</div>",
          B.btn("操作记录", "history", id, "history", "btn--sm"),
        );
      B.tabs(
        body.querySelector("#detail-tabs"),
        [
          ["opps", "承接商机", opps.length],
          ["people", "方案人员", people.length],
        ],
        tab,
        (v) => {
          tab = v;
          history.replaceState(null, "", "?id=" + id + "&view=" + v);
          B.render();
        },
      );
      const root = body.querySelector("#detail-table"),
        tools = body.querySelector(".pool-detail-tools");
      if (tab === "opps") {
        tools.innerHTML = B.btn("加入商机", "add", "", "plus", "btn--primary");
        B.table(
          root,
          opps,
          B.oppColumns(s).concat([
            ["确定方式", (o) => B.e(o.method)],
            [
              "操作",
              (o) => B.iconBtn("移出商机", "remove-opp", o.id, "logout"),
            ],
          ]),
          {
            key: id + "-opps",
            searchText: (o) => o.id + o.name + B.name("people", o.sales, s),
          },
        );
      } else {
        tools.innerHTML = B.btn(
          "分配人员",
          "people",
          "",
          "plus",
          "btn--primary",
        );
        B.table(
          root,
          people,
          [
            ["人员", (p) => B.entity(p.name, p.id, "users")],
            ["账号", (p) => SC.state(p.status === "on")],
            ["进行中任务", (p) => p.tasks],
            [
              "操作",
              (p) => B.iconBtn("移出人员", "remove-person", p.id, "logout"),
            ],
          ],
          { key: id + "-people", emptyTitle: "暂无方案承接人员" },
        );
      }
      B.actions(actions, {
        edit: () => B.editPool(id),
        delete: () => B.deletePool(id, () => (location.href = "pools.html")),
      });
      B.actions(body, {
        people: () => B.assignPeople(id),
        history: () => B.showHistory(id),
        "remove-opp": (oid) => B.removeFromPool("opps", oid, id),
        "remove-person": (pid) => B.removeFromPool("people", pid, id),
        add: () => {
          let selected = [];
          const m = B.modal({
            title: "选择加入的商机",
            wide: true,
            confirm: "核对目标客户池",
            body: '<div id="add-opps"></div>',
            onConfirm: () => {
              if (!selected.length) throw Error("请选择商机");
              setTimeout(() => B.choosePool(selected, B.render, id), 0);
            },
          });
          B.table(
            m.body.querySelector("#add-opps"),
            s.opps.filter((o) => o.pool !== id),
            B.oppColumns(s),
            {
              key: "add-" + id,
              select: true,
              onSelect: (ids) => (selected = ids),
              searchText: (o) => o.name + o.id + B.name("people", o.sales, s),
            },
          );
        },
      });
    },
  );
})(window.SC, window.SC.B2);
