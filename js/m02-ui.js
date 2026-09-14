/* Shared M02 dialogs keep list and detail operations on the same rules. */
(function (SC, B) {
  "use strict";
  B.managerOptions = function (s, groupId = "") {
    return [["", "请选择销售主管"], ...s.people.filter(p => p.role === "MGR" && p.status === "on" &&
      !s.groups.some(g => g.mgrId === p.id && g.id !== groupId)).map(p => [p.id, p.name])];
  };
  B.assignGroupModal = function (ids, groupId) {
    const s = B.load(), selected = new Set(ids || []);
    const candidates = s.people.filter(p => p.role === "SLS");
    const m = B.modal({ title: groupId ? "加入成员" : "分配到分组", wide: true,
      confirm: groupId ? "确认加入" : "确认分配",
      body: '<form class="b2-form">' +
        (groupId ? '<p>目标分组：<b>' + B.e(B.find("groups", groupId, s).name) + '</b></p>' :
          B.field("目标分组", "group", "", { required: true,
            options: [["", "请选择目标分组"], ...s.groups.map(g => [g.id, g.name])] })) +
        '</form><div class="field"><input class="input" id="member-search" placeholder="搜索姓名"></div>' +
        '<div class="b2-table-scroll"><table class="b2-table"><thead><tr>' +
        '<th><input type="checkbox" id="member-all" aria-label="选择全部可用待分组销售"></th><th>销售</th><th>账号状态</th><th>当前分组</th><th>客户／组合／当前空间</th></tr></thead><tbody>' +
        candidates.map(p => {
          const disabled = p.status !== "on" || !!p.groupId;
          const count = B.salesSummary(s, [p.id]);
          return '<tr data-person-name="' + B.e(p.name) + '"><td><input type="checkbox" data-member="' + p.id + '"' +
            (disabled ? ' disabled' : '') + (selected.has(p.id) && !disabled ? ' checked' : '') + ' aria-label="选择' + B.e(p.name) + '"></td>' +
            '<td>' + B.e(p.name) + '</td><td>' + SC.state(p.status === "on") + '</td><td>' +
            B.e(p.groupId ? B.groupOf(s, p.id)?.name || "已分组" : "待分组") + '</td><td>' +
            count.cust + ' / ' + count.combo + ' / ' + count.space + '</td></tr>';
        }).join("") + '</tbody></table></div><p id="member-empty" class="u-hide">没有符合条件的销售</p>' +
        SC.note("仅账号可用的待分组销售可选；已分组销售只读，不支持自由转组。", "warn"),
      onConfirm: async root => {
        const picked = [...root.querySelectorAll('[data-member]:checked:not(:disabled)')].map(el => el.dataset.member);
        if (!picked.length) throw Error("请选择待分组销售");
        const result = await B.assignSales(groupId || B.values(root).group, picked);
        B.render(); B.results(result, "分配结果");
      }
    });
    const rows = [...m.body.querySelectorAll('[data-person-name]')];
    const boxes = [...m.body.querySelectorAll('[data-member]:not(:disabled)')];
    const all = m.body.querySelector('#member-all');
    const sync = () => {
      const visible = boxes.filter(el => !el.closest('tr').hidden), picked = visible.filter(el => el.checked).length;
      all.disabled = !visible.length; all.checked = !!visible.length && picked === visible.length;
      all.indeterminate = picked > 0 && picked < visible.length;
    };
    m.body.querySelector('#member-search').oninput = e => {
      rows.forEach(row => row.hidden = !row.dataset.personName.includes(e.target.value.trim()));
      m.body.querySelector('#member-empty').classList.toggle('u-hide', rows.some(row => !row.hidden)); sync();
    };
    all.onchange = () => { boxes.filter(el => !el.closest('tr').hidden).forEach(el => el.checked = all.checked); sync(); };
    boxes.forEach(el => el.onchange = sync); sync();
  };
  B.successionModal = function (g) {
    const s = B.load();
    // Evaluate the existing M07/M08 rules for this group's successor, without writing anything.
    const shadow = JSON.parse(JSON.stringify(s));
    const actor = { id: "M02-IMPACT", role: "MGR", status: "on" };
    shadow.people.push(actor); shadow.groups.find(x => x.id === g.id).mgrId = actor.id;
    const requests = shadow.b3.requests.filter(r => SC.B3.canApprove(shadow, r, actor) &&
      ["pending", "partial"].includes(SC.B3.requestState(r)));
    const admissions = shadow.b3.admissions.filter(a => a.status === "pending" && SC.B3.canAdmission(shadow, a, actor));
    const scale = B.groupView(s, g);
    B.modal({ title: g.mgrId ? "主管继任" : "指定销售主管", wide: true, confirm: "确认继任",
      body: '<form class="b2-form">' + B.kv([["分组", g.name], ["原主管", B.find("people", g.mgrId, s)?.name || "无"]]) +
        B.field("新主管", "manager", "", { required: true,
          options: B.managerOptions(s, g.id).filter(([id]) => id !== g.mgrId) }) + '</form>' +
        SC.impact({ title: "当前管理范围与待办影响", cells: [
          { k: "组内销售", v: scale.sales }, { k: "经营组合", v: scale.combo },
          { k: "当前空间", v: scale.space }, { k: "客保审批待办", v: requests.length },
          { k: "准入终审待办", v: admissions.length }],
          note: "继任沿用原待办；原审批人、历史分组与操作时间保持不变。继任不自动启停任何账号。" }),
      onConfirm: async root => {
        await B.succeedManager(g.id, B.values(root).manager, g.version);
        B.render(); SC.toast("已完成主管继任", "ok");
      }
    });
  };
})(window.SC, window.SC.B2);
