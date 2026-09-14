(function (SC, B, T) {
  "use strict";
  T.cross = (s, customer, sales) =>
    !T.owned(s, customer, sales).length &&
    T.owned(s, customer).some(
      (o) =>
        T.group(s, o.sales) !== "—" &&
        T.group(s, o.sales) !== T.group(s, sales),
    );
  T.canApprove = (s, r, me = T.me(s)) =>
    !!r &&
    me?.status === "on" &&
    (me.role === "ADM" ||
      (me.role === "MGR" &&
        ["new", "claim", "join", "restore"].includes(r.type) &&
        T.isTeam(s, r.beneficiary || r.actor, me) &&
        (r.type === "restore" || !T.cross(s, r.customer, r.actor))));
  T.canRequestView = (s, r, me = T.me(s)) =>
    !!r &&
    (T.canApprove(s, r, me) || (me?.role === "SLS" && r.actor === me.id));
  T.validSales = (s, id) => {
    const p = B.find("people", id, s);
    return p?.role === "SLS" && p.status === "on";
  };
  T.sameProduct = (s, customer, product, except = "") =>
    s.opps.some((o) => o.customer === customer && o.product === product) ||
    s.b3.requests.some(
      (r) =>
        r.id !== except &&
        r.customer === customer &&
        (r.first
          ? r.status === "pending" && r.products.includes(product)
          : r.type === "new" &&
            r.items.some(
              (i) => i.product === product && i.status === "pending",
            )),
    );
  T.itemError = function (s, r, i) {
    if (!T.validSales(s, r.beneficiary || r.actor))
      return "申请归属销售身份或账号不可用";
    const customer = B.find("customers", r.customer, s);
    if (!customer || customer.merged) return "客户主体已变化，请重新核对";
    const product = B.find("products", i.product, s);
    if (!product) return "产品身份尚未确认";
    if (
      ["new", "claim", "join", "sea", "restore"].includes(r.type) &&
      !product.active
    )
      return "产品未激活，不能提交或确认通过";
    const o = i.opp ? B.find("opps", i.opp, s) : null;
    if (r.type === "new") {
      if (!T.owned(s, r.customer, r.actor).length) return "当前尚未关联该客户";
      if (T.sameProduct(s, r.customer, i.product, r.id))
        return "同客户同产品已有商机或进行中申请，不重复新建";
    } else {
      if (!o || o.customer !== r.customer || o.product !== i.product)
        return "目标商机关系已变化";
      if (T.pendingItem(s, o.id, r.id)) return "同一商机存在其他进行中申请";
      if (
        ["claim", "join", "sea"].includes(r.type) &&
        (o.sales || o.sourceSales)
      )
        return "该商机已非空余，不可认领";
      if (r.type === "claim" && !T.owned(s, r.customer, r.actor).length)
        return "当前不再具有自有客户认领资格";
      if (["release", "restore"].includes(r.type) && o.sales !== r.actor)
        return "申请人已不再是当前归属销售";
      if (
        r.type === "dispute" &&
        (!T.owned(s, r.customer, r.actor).length ||
          !o.sales ||
          o.sales === r.actor)
      )
        return "争议仅限已关联客户的他人已占用商机";
      if (r.type === "restore") {
        if (
          !["closed", "lost"].includes(o.result) ||
          o.confirmedContract ||
          o.dealAmount
        )
          return "不属于明确未成交商机，须先核对成交结果";
        if (!B.find("pools", o.pool, s))
          return "当前客户池缺失，先完成客户池配置";
        if (T.group(s, o.sales) === "—") return "销售尚未分组";
        if (
          s.opps.some(
            (other) =>
              other.id !== o.id &&
              other.customer === o.customer &&
              other.product === o.product &&
              other.result === "active",
          )
        )
          return "同客户同产品已有可推进商机，不允许并行恢复";
      }
    }
    if (
      ["new", "claim", "join"].includes(r.type) &&
      T.group(s, r.actor) === "—" &&
      !T.cross(s, r.customer, r.actor)
    )
      return "销售未分组，当前普通申请缺少主管受理人";
    return "";
  };
  T.firstCheck = function (s, r) {
    const customer =
      r.type === "first_existing"
        ? B.find("customers", r.customer, s)
        : s.customers.find((c) => c.name === r.name && !c.merged);
    if (r.type === "first_existing" && (!customer || customer.merged))
      return { error: "正式客户不存在或已合并" };
    if (customer && s.opps.some((o) => o.customer === customer.id))
      return { error: "该客户已有真实商机，不能使用首批申请" };
    if (
      !customer &&
      s.merges.some((m) => m.state === "待处理" && m.name === r.name)
    )
      return { error: "客户主体尚在来源核对中，不能重复建立" };
    if (
      r.type === "first_new" &&
      !customer &&
      T.matches(s, r.name).some((c) => c.match === "模糊") &&
      !r.distinct
    )
      return { error: "存在模糊同名客户，需明确核对并确认非同一主体" };
    if (!r.products?.length) return { error: "请选择首批产品" };
    if (r.products.some((id) => !B.find("products", id, s)?.active))
      return { error: "首批产品存在未激活项，整单不能通过" };
    if (!T.validSales(s, r.beneficiary))
      return { error: "归属销售身份或账号不可用" };
    return { customer, error: "" };
  };
  T.submitRequest = function (input) {
    return T.tx((s) => {
      const me = T.guard(s, ["SLS"]),
        type = input.type;
      if (!T.types[type]) throw Error("请选择有效申请类型");
      const first = type.startsWith("first"),
        r = {
          id: B.uid("REQ"),
          type,
          originalType: type,
          actor: me.id,
          beneficiary: me.id,
          customer: input.customer || "",
          name: (input.name || "").trim(),
          reason: (input.reason || "").trim(),
          submitted: B.now(),
          first,
          version: 0,
          status: "pending",
          previous: input.previous || "",
          items: [],
          fields: input.fields || {},
        };
      if (first) {
        r.beneficiary = input.beneficiary || me.id;
        r.products = [...new Set(input.products || [])];
        r.suggested = input.pool;
        r.distinct = !!input.distinct;
        if (r.beneficiary !== me.id && !T.isTeam(s, r.beneficiary, me))
          throw Error("代申请归属销售仅限本组");
        if (
          type === "first_new" &&
          (!r.name ||
            !["channel", "stage", "grade", "acquired", "lead"].every(
              (k) => r.fields[k],
            ))
        )
          throw Error("请补齐客户必填信息");
        if (!B.find("pools", r.suggested, s)) throw Error("请选择客户池建议值");
        const check = T.firstCheck(s, r);
        if (check.error) throw Error(check.error);
        if (type === "first_new" && check.customer)
          throw Error("客户全称已存在，请使用已有客户首批入口");
        if (
          s.b3.requests.some(
            (x) =>
              x.first &&
              x.status === "pending" &&
              (r.customer ? x.customer === r.customer : x.name === r.name),
          )
        )
          throw Error("该客户已有首批在办申请");
      } else {
        if (!r.reason) throw Error("请填写本次申请原因");
        if (type === "sea" && !B.find("customers", r.customer, s)?.sea)
          throw Error("客户已退出公海，请按当前认领资格重新申请");
        const candidates =
          type === "new"
            ? (input.products || []).map((product) => ({
                id: B.uid("ITEM"),
                product,
                opp: "",
                status: "pending",
              }))
            : (input.opps || []).map((opp) => ({
                id: opp,
                opp,
                product: B.find("opps", opp, s)?.product,
                status: "pending",
              }));
        r.excluded = [];
        for (const i of candidates) {
          let error = T.itemError(s, r, i);
          const o = i.opp && B.find("opps", i.opp, s);
          if (o?.pending && o.pending !== "none")
            error = error || "该商机已有进行中事项";
          if (error)
            r.excluded.push({ id: i.id, status: "未处理", reason: error });
          else r.items.push(i);
        }
        if (!r.items.length)
          throw Error(
            r.excluded.map((x) => x.reason).join("；") || "请选择申请对象",
          );
        r.items.forEach((i) => {
          if (i.opp)
            B.find("opps", i.opp, s).pending =
              type === "release"
                ? "release"
                : type === "restore"
                  ? "restore"
                  : type === "dispute"
                    ? "dispute"
                    : "apply";
        });
      }
      s.b3.requests.unshift(r);
      T.event(
        s,
        "提交" + T.types[type],
        { customer: r.customer, sales: r.beneficiary },
        r.reason || r.name,
      );
      return r.id;
    });
  };
  T.decideRequest = function (id, decisions, version) {
    return T.tx((s) => {
      const r = s.b3.requests.find((r) => r.id === id);
      if (!r || !T.canApprove(s, r)) throw Error("没有当前审批权");
      if (r.version !== version)
        throw Error("申请状态已变化，请重新核对当前结果");
      const me = T.me(s),
        at = B.now();
      if (r.first) {
        if (r.status !== "pending") throw Error("该整单已经处理");
        const d = decisions[0];
        if (!d || !["approve", "reject"].includes(d.decision))
          throw Error("请选择整单结果");
        if (d.decision === "reject") {
          if (!d.reason) throw Error("请选择驳回原因");
          r.status = "rejected";
          r.reasonRejected = d.reason;
          r.opinion = d.opinion || "";
        } else {
          const check = T.firstCheck(s, {
            ...r,
            distinct: !!d.distinct || r.distinct,
          });
          if (check.error) throw Error(check.error);
          if (!B.find("pools", d.pool, s))
            throw Error("整单必须确认一个客户池");
          let customer = check.customer;
          if (!customer) {
            customer = {
              id: B.uid("C"),
              name: r.name,
              source: "本地新建",
              owner: B.name("people", r.beneficiary, s),
              creator: B.name("people", r.actor, s),
              contacts: [],
              extras: {},
              note: "",
              address: "",
              legal: "",
              capital: "",
              sea: false,
              merged: "",
              intents: r.products,
              ...r.fields,
            };
            s.customers.push(customer);
          }
          r.customer = customer.id;
          r.generated = [];
          for (const product of r.products) {
            const o = {
              id: B.uid("O"),
              customer: customer.id,
              product,
              sales: r.beneficiary,
              pool: d.pool,
              result: "active",
              pending: "none",
              sourceSales: "",
              origin: "本地",
              method: "首批整单审批",
              created: at,
              version: 0,
              tasks: 0,
              crmPool: "",
              name: customer.name + " · " + B.name("products", product, s),
            };
            s.opps.push(o);
            r.generated.push(o.id);
          }
          r.status = "approved";
          r.reviewDistinct = !!d.distinct;
          r.pool = d.pool;
        }
        r.by = me.id;
        r.at = at;
        r.version++;
        T.event(
          s,
          "首批整单" + (r.status === "approved" ? "通过并生效" : "驳回"),
          { customer: r.customer, sales: r.beneficiary },
          r.reasonRejected || "全部所选产品一次生效",
        );
        return [
          {
            id: r.id,
            status: "成功",
            reason:
              r.status === "approved"
                ? "整单生效，共 " + r.products.length + " 条商机"
                : "整单驳回，未创建业务对象",
          },
        ];
      }
      if (!decisions.some((d) => d.decision))
        throw Error("请选择至少一条处理结果");
      const results = [];
      for (const d of decisions.filter((d) => d.decision)) {
        const i = r.items.find((i) => i.id === d.id);
        if (!i || i.status !== "pending") {
          results.push({ id: d.id, status: "未处理", reason: "该条已经处理" });
          continue;
        }
        if (d.decision === "reject") {
          if (!d.reason) {
            results.push({
              id: i.id,
              status: "失败",
              reason: "请选择驳回原因",
            });
            continue;
          }
          i.status = "rejected";
          i.reason = d.reason;
          i.opinion = d.opinion || "";
        } else if (d.decision === "approve") {
          const error = T.itemError(s, r, i);
          if (error) {
            results.push({ id: i.id, status: "失败", reason: error });
            continue;
          }
          if (
            !["release", "restore"].includes(r.type) &&
            !B.find("pools", d.pool, s)
          ) {
            results.push({
              id: i.id,
              status: "失败",
              reason: "该条必须选择客户池",
            });
            continue;
          }
          let o = i.opp ? B.find("opps", i.opp, s) : null;
          i.before = o
            ? {
                sales: o.sales,
                pool: o.pool,
                result: o.result,
                customer: o.customer,
                product: o.product,
              }
            : null;
          if (r.type === "new") {
            o = {
              id: B.uid("O"),
              customer: r.customer,
              product: i.product,
              sales: r.actor,
              pool: d.pool,
              result: "active",
              pending: "none",
              sourceSales: "",
              origin: "本地",
              method: "客保审批",
              created: at,
              version: 0,
              tasks: 0,
              crmPool: "",
              name:
                B.name("customers", r.customer, s) +
                " · " +
                B.name("products", i.product, s),
            };
            s.opps.push(o);
            i.opp = o.id;
          } else if (r.type === "release") o.sales = "";
          else if (r.type === "restore") {
            o.endHistory = o.endHistory || [];
            o.endHistory.push({
              result: o.result,
              reason: o.endReason || "原未成交结束记录",
              endedAt: o.endedAt || "",
              restoredAt: at,
              by: me.id,
            });
            o.result = "active";
          } else {
            o.sales = r.actor;
            o.pool = d.pool;
            o.method = "客保审批";
          }
          o.version++;
          i.status = "approved";
          i.pool = o.pool;
          i.after = {
            sales: o.sales,
            pool: o.pool,
            result: o.result,
            customer: o.customer,
            product: o.product,
          };
          T.event(
            s,
            T.types[r.type] + "生效",
            { customer: r.customer, sales: r.actor, opp: o.id },
            r.type === "restore"
              ? "恢复前为" +
                  SC.OPP_RESULT[i.before.result] +
                  "；原结束记录已保留，商机身份不变"
              : "当前归属与承接关系已更新",
          );
        } else {
          results.push({ id: i.id, status: "失败", reason: "审批结果无效" });
          continue;
        }
        i.by = me.id;
        i.at = at;
        if (i.status === "rejected")
          T.event(
            s,
            T.types[r.type] + "驳回",
            { customer: r.customer, sales: r.actor, opp: i.opp || "" },
            i.reason,
          );
        const o = i.opp && B.find("opps", i.opp, s);
        if (o && !T.pendingItem(s, o.id, r.id)) o.pending = "none";
        results.push({
          id: i.id,
          status: "成功",
          reason: i.status === "approved" ? "已通过并生效" : "已驳回",
        });
      }
      r.version++;
      r.at = at;
      r.by = me.id;
      r.status = T.requestState(r);
      return results;
    });
  };
  T.submitAdmissions = function (ids, notes = {}) {
    return T.tx((s) => {
      const me = T.guard(s, ["SLS", "SOL"]);
      return ids.map((id) => {
        const c = s.combos.find((c) => c.id === id),
          error = T.admitError(s, c);
        if (!T.canCombo(s, c, me))
          return { id, status: "未处理", reason: "当前无该组合提报权" };
        if (error) return { id, status: "失败", reason: error };
        if (c.admit === "已通过" || T.pendingAdmission(s, c))
          return { id, status: "未处理", reason: "已有有效准入或在办提报" };
        if (c.admit === "已驳回" && !notes[id]?.trim())
          return { id, status: "失败", reason: "再次提报须填写说明" };
        const a = {
          id: B.uid("AD"),
          combo: c.id,
          customer: c.customer,
          sales: c.sales,
          actor: me.id,
          actorRole: me.role,
          status: "pending",
          source: "普通提报",
          note: notes[id] || "",
          submitted: B.now(),
          version: 0,
          snapshot: T.owned(s, c.customer, c.sales).map((o) => o.id),
        };
        s.b3.admissions.unshift(a);
        c.admit = "审批中";
        T.event(
          s,
          "提交跟进准入",
          { combo: c.id, customer: c.customer, sales: c.sales },
          me.name,
        );
        return { id: a.id, status: "成功", reason: "已生成独立组合终审待办" };
      });
    });
  };
  T.canAdmission = (s, a, me = T.me(s)) => !!a && T.manages(s, a.sales, me);
  T.decideAdmission = function (
    id,
    decision,
    reason = "",
    opinion = "",
    version,
  ) {
    return T.tx((s) => {
      const a = s.b3.admissions.find((a) => a.id === id);
      if (!a || !T.canAdmission(s, a)) throw Error("没有当前终审受理权");
      if (a.status !== "pending" || a.version !== version)
        throw Error("该待办已处理或状态发生变化");
      const c = s.combos.find((c) => c.id === a.combo);
      if (!c || c.ended || !T.owned(s, c.customer, c.sales).length) {
        a.status = "void";
        a.reason = "经营组合已解除";
        a.version++;
        return { id, status: "未处理", reason: a.reason };
      }
      if (decision === "reject") {
        if (!reason) throw Error("请选择驳回原因");
        if (reason === "其他" && !opinion.trim())
          throw Error("其他原因必须填写补充说明");
        a.status = "rejected";
        c.admit = "已驳回";
        a.reason = reason;
      } else if (decision === "approve") {
        const error = T.admitError(s, c);
        if (error) throw Error(error);
        a.status = "approved";
        c.admit = "已通过";
        c.admitAt = B.now();
        a.reason = "";
      } else throw Error("请选择终审结果");
      a.by = T.me(s).id;
      a.at = B.now();
      a.opinion = opinion;
      a.version++;
      T.event(
        s,
        "准入终审" + (decision === "approve" ? "通过" : "驳回"),
        { combo: c.id, customer: c.customer, sales: c.sales },
        reason || opinion,
      );
      return {
        id,
        status: "成功",
        reason:
          decision === "approve"
            ? "准入已通过，空间分别处理"
            : "已驳回，原归属与客户池保留",
      };
    });
  };
  T.directAssign = function (rows) {
    return T.tx((s) => {
      const me = T.guard(s, ["ADM", "MGR"]);
      return rows.map((d) => {
        const o = B.find("opps", d.id, s);
        let error =
          !o || o.sales || o.sourceSales
            ? "商机不再为空余"
            : T.pendingItem(s, d.id) || o.pending !== "none"
              ? "存在进行中事项"
              : !T.validSales(s, d.sales)
                ? "请选择有效承接销售"
                : me.role === "MGR" && !T.isTeam(s, d.sales, me)
                  ? "只能分配给本组销售"
                  : !B.find("pools", d.pool, s)
                    ? "请选择客户池"
                    : "";
        if (error) return { id: d.id, status: "失败", reason: error };
        const wasSea = !!B.find("customers", o.customer, s)?.sea;
        o.sales = d.sales;
        o.pool = d.pool;
        o.version++;
        o.method = "管理侧直接分配";
        T.event(
          s,
          "直接分配商机",
          { customer: o.customer, sales: o.sales, opp: o.id },
          B.name("pools", o.pool, s) +
            (wasSea ? "；分配对象原为公海客户商机，分配后自动退出公海" : ""),
        );
        return {
          id: o.id,
          status: "成功",
          reason: "归属已生效，原经营结果保持",
        };
      });
    });
  };
  T.poolMove = function (rows) {
    return T.tx((s) => {
      T.guard(s, ["ADM", "MGR"]);
      return rows.map((d) => {
        const o = B.find("opps", d.id, s);
        if (!o || !T.manages(s, o.sales) || !B.find("pools", d.pool, s))
          return {
            id: d.id,
            status: "失败",
            reason: "对象已不在本组或目标池不存在",
          };
        if (o.pool === d.pool)
          return { id: o.id, status: "未变化", reason: "已在目标客户池" };
        o.pool = d.pool;
        o.version++;
        o.method = "事后调整";
        T.event(
          s,
          "调整客户池",
          { customer: o.customer, sales: o.sales, opp: o.id },
          B.name("pools", d.pool, s),
        );
        return {
          id: o.id,
          status: "成功",
          reason: "客户池已调整，销售归属与原历史保持",
        };
      });
    });
  };
  T.seaEligible = (s, c) =>
    !c.merged &&
    !c.sea &&
    !T.owned(s, c.id).length &&
    !s.opps.some(
      (o) => o.customer === c.id && (o.sourceSales || o.result === "active"),
    );
  T.releaseCustomer = function (id, reason) {
    return T.tx((s) => {
      T.guard(s, ["ADM"]);
      const c = B.find("customers", id, s);
      if (!c || !T.seaEligible(s, c)) throw Error("当前已不满足公海释放条件");
      if (!reason.trim()) throw Error("请填写释放原因");
      const total = s.opps.filter((o) => o.customer === id).length;
      c.sea = true;
      c.seaAt = B.now();
      T.event(
        s,
        "客户释放至公海",
        { customer: id },
        reason +
          "；确认时核对：历史商机 " +
          total +
          " 条，均无有效归属或进行中来源，符合公海候选条件",
      );
    });
  };
  T.formerSales = (s, customerId) => {
    const released = s.b3.events
      .filter((e) => e.customer === customerId && e.label === "商机释放生效")
      .sort((a, b) => (a.at > b.at ? -1 : 1));
    return released[0] ? B.name("people", released[0].sales, s) : "";
  };
  T.sourceDecision = function (diffId, values, oppVersion) {
    return T.tx((s) => {
      T.guard(s, ["ADM"]);
      const d = B.find("diffs", diffId, s),
        o = d && B.find("opps", d.opp, s);
      if (!d || d.state === "已处理") throw Error("来源事项已处理或不存在");
      if (!o)
        throw Error(
          "先核对明确的真实商机，不能通过此页改客户资料或删除本地关系",
        );
      if (o.version !== oppVersion) throw Error("商机关联已变化，请重新核对");
      if (!values.reason?.trim()) throw Error("请填写确认原因");
      if (!["approve", "reject"].includes(values.decision))
        throw Error("请选择明确的确认结果");
      if (!["sales", "customer", "product"].includes(values.kind))
        throw Error("确认类型无效");
      if (T.pendingItem(s, o.id) || o.pending !== "none")
        throw Error("商机存在其他进行中事项，先完成原事项");
      if (values.decision === "reject") {
        d.state = "已处理";
        d.reason = values.reason;
        B.log(s, d.id, "来源冲突驳回", values.reason);
        T.event(
          s,
          "来源冲突驳回",
          { customer: o.customer, opp: o.id },
          values.reason,
        );
        return;
      }
      if (values.kind !== "sales") {
        if (
          o.pool ||
          T.combo(s, o.customer, o.sales)?.admit === "已通过" ||
          s.spaces.some(
            (w) => w.customer === o.customer && w.sales === o.sales,
          ) ||
          s.b3.records.some((r) => r.opps.includes(o.id))
        )
          throw Error("已有后续业务，不允许跨客户或产品迁移历史");
        const target = B.find(
          values.kind === "customer" ? "customers" : "products",
          values.target,
          s,
        );
        if (!target || target.merged) throw Error("目标主体未确认");
        const customer = values.kind === "customer" ? target.id : o.customer,
          product = values.kind === "product" ? target.id : o.product;
        if (
          s.opps.some(
            (x) =>
              x.id !== o.id && x.customer === customer && x.product === product,
          )
        )
          throw Error("同客同品冲突，不允许并行经营");
        o.customer = customer;
        o.product = product;
      } else {
        if (!T.validSales(s, values.sales) || !B.find("pools", values.pool, s))
          throw Error("请选择有效销售及客户池");
        o.sales = values.sales;
        o.pool = values.pool;
      }
      o.version++;
      d.state = "已处理";
      d.reason = values.reason;
      B.log(s, d.id, "来源冲突确认生效", values.reason);
      d.local =
        values.kind === "sales" ? B.name("people", o.sales, s) : values.target;
      T.event(
        s,
        "来源冲突确认生效",
        { customer: o.customer, sales: o.sales, opp: o.id },
        values.reason,
      );
    });
  };
})(window.SC, window.SC.B2, window.SC.B3);
