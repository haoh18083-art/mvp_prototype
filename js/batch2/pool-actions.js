(function (SC, B) {
  "use strict";
  const E = B.e;
  B.editPool = function (id, done = B.render) {
    const p = id ? B.find("pools", id) : null;
    B.modal({
      title: p ? "维护客户池名称" : "创建客户池",
      body:
        '<form class="b2-form">' +
        B.field("客户池名称", "name", p?.name || "", {
          required: true,
          max: 50,
        }) +
        "</form>",
      confirm: "保存",
      onConfirm: (root) => {
        const name = B.values(root).name.trim();
        if (!name) throw Error("请输入客户池名称");
        B.change((s) => {
          if (s.pools.some((x) => x.name === name && x.id !== id))
            throw Error("客户池名称已存在");
          if (id) {
            const current = B.find("pools", id, s);
            if (!current) throw Error("客户池已被删除");
            current.name = name;
            B.log(s, id, "维护客户池名称", name);
          } else {
            const item = {
              id: B.uid("POOL"),
              name,
              created: B.now(),
              by: "陈可",
            };
            s.pools.push(item);
            B.log(s, item.id, "创建客户池", name);
          }
        });
        done();
        SC.toast("客户池已保存", "ok");
      },
    });
  };
  B.deletePool = function (id, done = B.render) {
    const s = B.load(),
      p = B.find("pools", id, s);
    if (!p) return;
    const opps = B.poolOpps(id, s),
      people = s.people.filter((x) => x.pool === id);
    B.modal({
      title: "删除客户池",
      danger: true,
      confirm: "确认删除",
      wide: true,
      body:
        SC.impact({
          danger: true,
          title: p.name,
          cells: [
            { k: "承接客户", v: new Set(opps.map((o) => o.customer)).size },
            { k: "商机", v: opps.length },
            { k: "方案人员", v: people.length },
          ],
          note: "删除不可恢复。商机销售归属及历史保留，人员回到未分配状态。",
        }) +
        '<details class="b2-collapse"><summary>查看影响明细</summary><p class="u-mt3">方案人员：' +
        E(people.map((p) => p.name).join("、") || "无") +
        "</p><p>涉及商机：" +
        E(opps.map((o) => o.id).join("、") || "无") +
        "</p></details>" +
        SC.note(
          "进行中方案任务 " +
            opps.reduce((n, o) => n + o.tasks, 0) +
            " 项，任务记录保留。",
          "warn",
        ),
      onConfirm: () => {
        B.change((s) => {
          const current = B.find("pools", id, s);
          if (!current) throw Error("客户池已被删除");
          if (
            current.name !== p.name ||
            B.poolOpps(id, s)
              .map((o) => o.id)
              .join() !== opps.map((o) => o.id).join() ||
            s.people
              .filter((x) => x.pool === id)
              .map((p) => p.id)
              .join() !== people.map((p) => p.id).join()
          )
            throw Error("影响范围已变化，请关闭并重新核对");
          s.deletedPools.push(current);
          s.pools = s.pools.filter((p) => p.id !== id);
          s.opps
            .filter((o) => o.pool === id)
            .forEach((o) => {
              o.pool = "";
              o.version++;
            });
          s.people.filter((p) => p.pool === id).forEach((p) => (p.pool = ""));
          B.log(
            s,
            id,
            "删除客户池",
            "移出人员 " + people.length + "，待指定商机 " + opps.length,
          );
        });
        done();
        SC.toast("客户池已删除，历史引用保留", "ok");
      },
    });
  };
  B.choosePool = function (ids, done = B.render, fixed = "") {
    const s = B.load(),
      selected = ids.map((id) => B.find("opps", id, s)).filter(Boolean),
      versions = Object.fromEntries(selected.map((o) => [o.id, o.version]));
    const m = B.modal({
      title: "指定客户池",
      wide: true,
      confirm: "确认指定",
      body:
        '<form class="b2-form">' +
        B.field("目标本地客户池", "pool", fixed, {
          options: [
            ["", "请选择目标客户池"],
            ...s.pools.map((p) => [p.id, p.name]),
          ],
        }) +
        '<details class="b2-collapse"><summary>新建目标客户池</summary><div class="u-mt3">' +
        B.field("客户池名称", "newPool") +
        B.btn("创建", "create-inline", "", "plus", "btn--sm") +
        '</div></details></form><div id="pool-preview"></div>',
      onConfirm: (root) => {
        const target = B.values(root).pool;
        if (!target) throw Error("请选择目标客户池");
        const batch = B.assign(ids, target, versions);
        done();
        B.results(batch.rows, "客户池指定结果", true);
        setTimeout(() => {
          B.settleSpaces();
          B.render();
        }, 800);
      },
    });
    function preview() {
      const t = m.body.querySelector("[name=pool]").value;
      const name = B.name("pools", t);
      const valid = selected.filter(o => !B.assignmentError(o, s));
      const transfers = valid.filter(o => o.pool && o.pool !== t);
      const first = valid.filter(o => !o.pool);
      const unchanged = valid.filter(o => o.pool === t);
      const rows = list => list.map(o => ({obj: o.id, from: B.name("pools", o.pool), to: name}));
      m.body.querySelector("#pool-preview").innerHTML =
        (t
          ? (transfers.length ? SC.transfer(rows(transfers)) : '') +
            (first.length ? SC.transfer(rows(first), first.length + ' 条未指定商机，首次指定至目标客户池') : '') +
            (unchanged.length ? SC.note(unchanged.length + ' 条已在目标客户池，承接关系不变化。') : '')
          : "") +
        SC.note(
          "已选 " +
            selected.length +
            " 条商机；进行中方案任务 " +
            selected.reduce((n, o) => n + o.tasks, 0) +
            " 项。销售归属和历史记录保持不变。",
        ) +
        selected
          .filter((o) => B.assignmentError(o, s))
          .map((o) =>
            SC.note(E(o.id) + "：" + E(B.assignmentError(o, s)), "warn"),
          )
          .join("");
    }
    m.body.querySelector("[name=pool]").onchange = preview;
    preview();
    B.actions(m.body, {
      "create-inline": () => {
        try {
          const name = m.body.querySelector("[name=newPool]").value.trim();
          if (!name) throw Error("请输入客户池名称");
          let id;
          B.change((s) => {
            if (s.pools.some((p) => p.name === name))
              throw Error("客户池名称已存在");
            id = B.uid("POOL");
            s.pools.push({ id, name, created: B.now(), by: "陈可" });
            B.log(s, id, "创建客户池", name);
          });
          const select = m.body.querySelector("[name=pool]");
          select.add(new Option(name, id));
          select.value = id;
          preview();
          SC.toast("目标池已创建，商机尚未指定", "ok");
        } catch (e) {
          m.body.querySelector(".b2-error").textContent = e.message;
        }
      },
    });
  };
  B.assignPeople = function (pool, done = B.render) {
    const s = B.load(),
      candidates = s.people.filter((p) => p.role === "SOL" && p.pool !== pool),
      snapshot = Object.fromEntries(candidates.map((p) => [p.id, p.pool]));
    let ids = [];
    const m = B.modal({
      title: "分配解决方案人员",
      wide: true,
      confirm: "确认分配",
      body: '<div id="people-select"></div><div id="people-preview"></div>',
      onConfirm: () => {
        if (!ids.length) throw Error("请选择人员");
        const rows = B.change((s) => {
          if (!B.find("pools", pool, s)) throw Error("目标池不存在");
          return ids.map((id) => {
            const p = B.find("people", id, s);
            if (!p || p.role !== "SOL" || p.pool !== snapshot[id])
              return { id, status: "未处理", reason: "人员角色或客户池已变化" };
            const from = p.pool;
            p.pool = pool;
            B.log(
              s,
              id,
              "分配客户池",
              (from ? B.name("pools", from, s) : "未分配") +
                " → " +
                B.name("pools", pool, s),
            );
            return {
              id: p.name,
              status: "成功",
              reason: from ? "已转入，原池访问权解除" : "已分配",
            };
          });
        });
        done();
        B.results(rows, "人员分配结果");
      },
    });
    B.table(
      m.body.querySelector("#people-select"),
      candidates,
      [
        ["人员", (p) => B.entity(p.name, p.id, "users")],
        [
          "账号",
          (p) =>
            B.badge(
              p.status === "on" ? "启用" : "停用",
              p.status === "on" ? "green" : "neutral",
            ),
        ],
        [
          "当前客户池",
          (p) => E(p.pool ? B.name("pools", p.pool, s) : "未分配"),
        ],
      ],
      {
        select: true,
        onSelect: (chosen) => {
          ids = chosen;
          m.body.querySelector("#people-preview").innerHTML = chosen.length
            ? SC.transfer(
                chosen.map((id) => {
                  const p = B.find("people", id, s);
                  return {
                    obj: p.name,
                    from: p.pool ? B.name("pools", p.pool, s) : "未分配",
                    to: B.name("pools", pool, s),
                  };
                }),
              ) +
              chosen
                .map((id) => {
                  const p = B.find("people", id, s);
                  return p.pool
                    ? '<p class="b2-sub">' +
                        E(B.name("pools", p.pool, s)) +
                        "转出后剩余 " +
                        s.people.filter(
                          (x) => x.pool === p.pool && !chosen.includes(x.id),
                        ).length +
                        " 人；" +
                        E(p.name) +
                        "进行中任务 " +
                        p.tasks +
                        " 项，任务记录保留。</p>"
                    : "";
                })
                .join("")
            : "";
        },
      },
    );
  };
  B.removeFromPool = function (kind, id, pool) {
    B.modal({
      title: kind === "people" ? "移出方案人员" : "移出商机",
      confirm: "确认移出",
      body:
        SC.note(
          kind === "people"
            ? "移出后为未分配状态，原池访问权解除，进行中任务保留。"
            : "移出后商机进入待指定承接方；销售归属及原空间历史保留。",
          "warn",
        ) +
        B.kv([
          ["目标对象", id],
          ["当前客户池", B.name("pools", pool)],
        ]),
      onConfirm: () => {
        B.change((s) => {
          const x = B.find(kind, id, s);
          if (!x || x.pool !== pool) throw Error("当前承接关系已变化");
          x.pool = "";
          if (kind === "opps") x.version++;
          B.log(s, id, "移出客户池", B.name("pools", pool, s));
        });
        B.render();
        SC.toast("已移出", "ok");
      },
    });
  };
})(window.SC, window.SC.B2);
