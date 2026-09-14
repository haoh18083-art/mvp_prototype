(function (SC, B, T) {
  "use strict";
  T.transfer = function (customer, source, choices, admitChoices, expected) {
    return T.tx((s) => {
      const me = T.guard(s, ["ADM"]),
        owned = T.owned(s, customer, source);
      if (!owned.length) throw Error("该客户组已无待交接商机");
      if (
        owned.length !== Object.keys(expected).length ||
        owned.some((o) => expected[o.id] !== o.version)
      )
        throw Error("交接范围或当前关系已变化，请重新核对整组");
      for (const o of owned) {
        const d = choices[o.id];
        if (!d || !d.sales) throw Error("每条商机必须明确承接销售或释放去向");
        if (T.pendingItem(s, o.id) || o.pending !== "none")
          throw Error(o.id + " 存在进行中的商机事项，整组暂不生效");
        if (d.sales === "release") {
          if (!d.reason?.trim()) throw Error("释放条目必须填写原因");
        } else if (d.sales === source || !T.validSales(s, d.sales))
          throw Error("请选择有效且不同于原销售的承接销售");
      }
      const targets = [
        ...new Set(
          owned
            .map((o) => choices[o.id].sales)
            .filter((id) => id !== "release"),
        ),
      ];
      for (const sales of targets) {
        const c = T.combo(s, customer, sales),
          d = admitChoices[sales] || {};
        if (T.pendingAdmission(s, c) && d.decision && d.decision !== "none")
          throw Error("目标已有普通准入待办，须继续原终审路径，交接页不能另批");
        if (d.decision === "reject" && !d.reason?.trim())
          throw Error("独立准入驳回需填写原因");
      }
      const originals = s.spaces.filter(
          (w) => w.customer === customer && w.sales === source,
        ),
        snap = owned.map((o) => ({ ...o })),
        at = B.now();
      const result = {
        id: B.uid("TR"),
        customer,
        source,
        at,
        by: me.id,
        rows: [],
        admissions: [],
        spaces: [],
      };
      owned.forEach((o) => {
        const d = choices[o.id];
        o.sales = d.sales === "release" ? "" : d.sales;
        o.version++;
        o.method = "离职交接";
        result.rows.push({
          id: o.id,
          sales: o.sales,
          pool: o.pool,
          result: o.result,
          reason: d.reason || "",
        });
      });
      for (const sales of targets) {
        let c = T.combo(s, customer, sales);
        if (!c) {
          c = {
            id: B.uid("K"),
            customer,
            sales,
            admit: "未提报",
            created: at,
            round:
              s.combos.filter(
                (k) => k.customer === customer && k.sales === sales,
              ).length + 1,
          };
          s.combos.push(c);
        }
        const pending = T.pendingAdmission(s, c),
          d = admitChoices[sales] || {};
        if (c.admit === "已通过") {
          result.admissions.push({
            sales,
            result: "引用已有有效准入",
            combo: c.id,
          });
          continue;
        }
        if (pending) {
          result.admissions.push({
            sales,
            result: "普通终审待处理，继续原待办",
            pending: pending.id,
            combo: c.id,
          });
          continue;
        }
        if (!d.decision || d.decision === "none") {
          result.admissions.push({ sales, result: "准入未确认", combo: c.id });
          continue;
        }
        if (d.decision === "approve") {
          const error = T.admitError(s, c);
          if (error) {
            result.admissions.push({
              sales,
              result: "未能通过：" + error,
              combo: c.id,
            });
            continue;
          }
          c.admit = "已通过";
          c.admitAt = at;
        } else c.admit = "已驳回";
        const a = {
          id: B.uid("AD"),
          combo: c.id,
          customer,
          sales,
          actor: me.id,
          actorRole: "ADM",
          by: me.id,
          source: "交接承接确认",
          transfer: result.id,
          status: d.decision === "approve" ? "approved" : "rejected",
          submitted: at,
          at,
          version: 1,
          reason: d.reason || "",
          note: d.note || "",
          snapshot: T.owned(s, customer, sales).map((o) => o.id),
        };
        s.b3.admissions.push(a);
        result.admissions.push({ sales, result: c.admit, combo: c.id });
      }
      originals.forEach((w) => {
        const items = snap.filter((o) => o.pool === w.pool),
          takers = [
            ...new Set(
              items
                .map((o) => choices[o.id].sales)
                .filter((id) => id !== "release"),
            ),
          ];
        if (w.status !== "normal") {
          result.spaces.push({
            id: w.id,
            pool: w.pool,
            result:
              "原空间" +
              SC.SPACE_STATES[w.status].label +
              "，本次不迁移、不新增历史授权",
            targets: takers,
          });
          return;
        }
        const taker = takers[0],
          c = T.combo(s, customer, taker),
          full =
            takers.length === 1 &&
            items.length > 0 &&
            items.every((o) => choices[o.id].sales === taker),
          exists = s.spaces.some(
            (x) =>
              x.id !== w.id &&
              x.customer === customer &&
              x.sales === taker &&
              x.pool === w.pool &&
              x.status !== "frozen",
          );
        if (full && c?.admit === "已通过" && !exists) {
          w.originalSales = w.originalSales || w.sales;
          w.sales = taker;
          w.version++;
          w.transferredAt = at;
          result.spaces.push({
            id: w.id,
            pool: w.pool,
            result: "已整体迁移，空间与实例绑定保持",
            targets: takers,
          });
          T.event(
            s,
            "空间整体迁移",
            { space: w.id, customer, sales: taker },
            B.name("people", source, s) + " → " + B.name("people", taker, s),
          );
        } else {
          w.status = "frozen";
          w.archiveSource = "handover";
          w.archivedAt = at;
          w.why = "离职交接只读归档";
          w.version++;
          T.stop(s, w, w.why);
          takers.forEach((person) => {
            if (
              !s.b3.grants.some((g) => g.space === w.id && g.person === person)
            )
              s.b3.grants.push({
                space: w.id,
                person,
                until: at,
                transfer: result.id,
              });
          });
          result.spaces.push({
            id: w.id,
            pool: w.pool,
            result: "只读归档；实际承接人取得本原空间截止交接时的历史只读权",
            targets: takers,
          });
        }
      });
      if (!originals.length)
        result.spaces.push({
          id: "",
          pool: "",
          result: "原空间不存在，仅按归属与准入处理目标",
          targets,
        });
      s.b3.transfers.unshift(result);
      T.event(
        s,
        "整组交接生效",
        { customer, sales: source },
        snap.length + " 条商机；账号状态不变",
      );
      return result.id;
    });
  };
})(window.SC, window.SC.B2, window.SC.B3);
