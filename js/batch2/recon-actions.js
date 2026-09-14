(function (SC, B) {
  "use strict";
  B.startSync = function () {
    B.change((s) => {
      if (s.syncBusy) throw Error("同一范围正在同步，请查看当前进度");
      s.syncBusy = true;
      s.syncStarted = Date.now();
      s.runs.unshift({
        id: B.uid("SY"),
        trigger: "手动同步",
        start: B.now(),
        end: "",
        state: "同步中",
        why: "",
        newCount: 0,
        kept: 0,
      });
      B.log(s, s.runs[0].id, "开始手动同步");
    });
    B.render();
    setTimeout(() => {
      B.finishSync();
      B.render();
    }, 1200);
  };
  B.finishSync = function () {
    B.change((s) => {
      if (!s.syncBusy) return;
      const run = s.runs.find((r) => r.state === "同步中");
      if (run) {
        run.state = "成功";
        run.end = B.now();
        run.kept = s.diffs.filter(
          (d) => d.state === "待处理" || d.state === "处理中",
        ).length;
        s.lastSuccess = run.end;
        B.log(s, run.id, "同步完成", "来源读取完成；本地保护结果保留");
      }
      s.syncBusy = false;
    });
  };
  B.issueDetail = function (root, x, s) {
    const fixed = x.state === "已恢复";
    root.innerHTML =
      B.section(
        "异常对象",
        '<div class="b2-section__body">' +
          B.kv([
            ["异常编号", x.id],
            ["问题类型", x.type],
            ["来源对象", x.source],
            [
              "客户",
              x.customer ? B.name("customers", x.customer, s) : "尚未对应",
            ],
            ["发现时间", x.at],
            ["当前状态", x.state],
          ]) +
          "</div>",
      ) +
      SC.note(B.e(x.why), fixed ? "" : "warn") +
      (x.type === "人员对应缺失" && !fixed
        ? '<form class="b2-form" id="mapping-form">' +
          B.field("来源人员", "source", x.source, { readonly: true }) +
          B.field("对应本地销售", "person", "", {
            options: [
              ["", "请选择本地销售"],
              ...s.people
                .filter((p) => p.role === "SLS")
                .map((p) => [
                  p.id,
                  p.name +
                    " · " +
                    p.group +
                    (p.status === "off" ? " · 已停用" : ""),
                ]),
            ],
          }) +
          SC.note("仅补齐首次人员对应。账号、分组、产品与准入状态分别保持。") +
          '<p class="b2-error" role="alert"></p><div class="b2-actions">' +
          B.btn("确认对应并验证", "map", x.id, "check", "btn--primary") +
          "</div></form>"
        : "") +
      B.section(
        "修复与验证",
        '<div class="b2-section__body">' +
          B.kv([
            ["最近检查", x.checked || "尚未人工检查"],
            ["验证结果", x.validation || "问题尚未解除"],
          ]) +
          '<div class="b2-actions u-mt4">' +
          B.btn("重新检查", "check", x.id, "retry") +
          B.link("sync-detail", "查看来源同步", {}, "btn") +
          (x.type === "人员对应缺失"
            ? B.link("people-list", "人员与账号", {}, "btn")
            : "") +
          "</div></div>",
      ) +
      B.section(
        "处理记录",
        '<div class="b2-section__body">' + B.history(x.id) + "</div>",
      );
    B.actions(root, {
      map: () => {
        const form = root.querySelector("form");
        try {
          const person = new FormData(form).get("person");
          if (!person) throw Error("请选择本地销售");
          B.change((s) => {
            const issue = B.find("issues", x.id, s),
              p = B.find("people", person, s),
              o = B.find("opps", issue.opp, s);
            if (!p || p.role !== "SLS") throw Error("目标人员已不是销售角色");
            if (issue.state === "已恢复")
              throw Error("该问题已处理，请重新查看");
            if (o?.sales && o.sales !== person)
              throw Error("已有有效归属，须通过来源冲突确认办理");
            if (o) {
              o.sales = person;
              o.version++;
              if (!B.combo(o, s))
                s.combos.push({
                  id: B.uid("K"),
                  customer: o.customer,
                  sales: person,
                  admit: "未提报",
                });
            }
            issue.state = "已恢复";
            issue.checked = B.now();
            issue.validation =
              p.status === "off"
                ? "对应已补齐；账号停用，商机仍待分配"
                : p.group === "—"
                  ? "对应已补齐；销售尚未分组"
                  : "对应已补齐；产品、客户池与准入按各自条件检查";
            B.log(
              s,
              x.id,
              "首次人员对应补齐",
              p.name + "；" + issue.validation,
            );
          });
          B.render();
          SC.toast("人员对应已验证", "ok");
        } catch (e) {
          form.querySelector(".b2-error").textContent = e.message;
        }
      },
      check: () => {
        B.change((s) => {
          const issue = B.find("issues", x.id, s);
          issue.checked = B.now();
          issue.validation =
            issue.state === "已恢复"
              ? "该项异常已解除，其他业务条件独立检查"
              : "问题仍存在：" + issue.why;
          B.log(s, x.id, "重新检查", issue.validation);
        });
        B.render();
        SC.toast("已返回当前检查结果");
      },
    });
  };
})(window.SC, window.SC.B2);
