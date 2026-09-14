/* ==========================================================================
   P-ADM-03 待分配角色池页 · 来源 M01 §4.3 角色分配与变更前业务检查
   区域：人员列表区（勾选、全选）、操作区（单个分配、批量分配、批量启用）
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;

  SC.page({
    role: 'ADM', menu: 'people', pid: 'P-ADM-03',
    title: '待分配角色池',
    crumb: [{ t: '人员与账号', href: 'people-list.html' }],
    desc: '角色留空的人员进入本池。<b>未分配角色的人员无法登录</b>，分配角色后仍须手动启用账号。'
  }, function (body, actions) {

    actions.innerHTML =
      '<button class="btn" id="bulk-on" disabled>批量启用</button>' +
      '<button class="btn btn--primary" id="bulk-role" disabled>批量分配角色</button>';

    if (!D.ROLE_POOL.length) {
      body.innerHTML = '<div class="card"><div class="card__body">' +
        SC.empty({
          title: '待分配角色池为空',
          reason: '当前没有等待分配角色的人员。批量导入时角色列留空，或新增人员时未选择角色，都会进入本池。',
          actions: [{ label: '前往批量导入', primary: true }]
        }) + '</div></div>';
      return;
    }

    var rows = D.ROLE_POOL.map(function (p) {
      return '<tr>' +
        '<td class="col-check"><input type="checkbox" data-check-row value="' + p.id + '"></td>' +
        '<td><div class="u-row u-g3">' +
          '<span class="member-row__av">' + SC.esc(p.name.charAt(0)) + '</span>' +
          '<span><span class="u-medium">' + SC.esc(p.name) + '</span>' +
          '<div class="table__sub mono">' + p.id + '</div></span>' +
        '</div></td>' +
        '<td><span class="mono u-f12">' + SC.esc(p.email) + '</span>' +
            '<span class="u-t3 u-f12">@teddymobile.cn</span></td>' +
        '<td class="u-t2 u-f12 mono">' + SC.esc(p.phone) + '</td>' +
        '<td class="u-t3 u-f12 u-nowrap">' + p.enter + '</td>' +
        '<td>' + SC.badge(p.from, 'neutral', { sm: true }) + '</td>' +
        '<td class="col-act"><div class="rowacts">' +
          '<button class="btn--link" data-one="' + p.id + '">分配角色</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    body.innerHTML =
      SC.note('本池人员<b>已创建登录账号但尚未分配角色</b>，登录时提示「账号不可用，请联系超级管理员」。' +
              '分配角色后仍为停用状态，手动启用后方可登录。', 'warn') +
      '<div class="u-mt5 table-wrap">' +
        '<div class="toolbar">' +
          '<div class="toolbar__left"><span class="u-f12 u-t2">共 ' + D.ROLE_POOL.length + ' 人等待分配</span></div>' +
        '</div>' +
        '<div class="bulkbar u-hide" id="bulkbar">' +
          '<span>已选中 <b id="bulk-n">0</b> 人</span>' +
          '<button class="btn--link" id="bulk-clear">取消选择</button>' +
        '</div>' +
        '<table class="table"><thead><tr>' +
          '<th class="col-check"><input type="checkbox" data-check-all></th>' +
          '<th>姓名</th><th>邮箱</th><th>手机号</th><th>进入时间</th><th>来源方式</th>' +
          '<th class="col-act">操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>';

    var bulkbar = SC.qs('#bulkbar', body);
    var wired = SC.wireCheckAll(body, function (n) {
      bulkbar.classList.toggle('u-hide', n === 0);
      SC.qs('#bulk-n', body).textContent = n;
      SC.qs('#bulk-role').disabled = n === 0;
      SC.qs('#bulk-on').disabled = n === 0;
    });

    SC.qs('#bulk-clear', body).addEventListener('click', function () {
      wired.boxes.forEach(function (b) { b.checked = false; });
      var all = SC.qs('[data-check-all]', body);
      if (all) { all.checked = false; all.indeterminate = false; }
      wired.sync();
    });

    SC.qsa('[data-one]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = D.ROLE_POOL.filter(function (x) { return x.id === b.dataset.one; })[0];
        openAssign([p]);
      });
    });

    SC.qs('#bulk-role').addEventListener('click', function () {
      var ids = wired.boxes.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      openAssign(D.ROLE_POOL.filter(function (p) { return ids.indexOf(p.id) >= 0; }));
    });

    SC.qs('#bulk-on').addEventListener('click', function () {
      SC.toast('未分配角色的人员不可启用，请先分配角色', 'bad');
    });
  });

  /* ============================================================ D-02 分配角色弹窗 */

  function openAssign(list) {
    var multi = list.length > 1;
    var m = SC.modal({
      title: multi ? '批量分配角色' : '分配角色',
      sub: multi ? '本次将对选中的 ' + list.length + ' 人<b>统一分配同一角色</b>' : SC.esc(list[0].name),
      body:
        (multi
          ? '<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
            '<th>姓名</th><th>邮箱</th></tr></thead><tbody>' +
            list.map(function (p) {
              return '<tr><td class="u-medium">' + SC.esc(p.name) + '</td>' +
                '<td class="mono u-f12 u-t2">' + SC.esc(p.email) + '@teddymobile.cn</td></tr>';
            }).join('') + '</tbody></table></div>'
          : '') +
        '<div class="field">' +
          '<label class="field__label">角色<span class="req">*</span></label>' +
          '<select class="select" id="ar">' +
            '<option value="">请选择角色</option>' +
            '<option>销售</option><option>销售主管</option>' +
            '<option>解决方案人员</option><option>超级管理员</option>' +
          '</select>' +
          '<span class="field__hint">四类固定角色，不支持自定义新增；一人只对应一种角色</span>' +
        '</div>' +
        '<div id="hint"></div>',
      buttons: [
        { label: '取消', cls: '' },
        { label: '提交', cls: 'btn--primary', onClick: async function (close) {
            var v = SC.qs('#ar', m.body).value;
            if (!v) { SC.toast('请选择角色', 'bad'); return; }
            var role = Object.values(D.ROLES).find(function (r) { return r.name === v; }).key;
            var results = [];
            for (var p of list) {
              try {
                await SC.B2.changeRole(p.id, role, p.roleVersion);
                results.push({ id: p.name, status: "成功", reason: "角色已分配，仍需手动启用账号" });
              } catch (e) { results.push({ id: p.name, status: "失败", reason: e.message }); }
            }
            close(); SC.rerender(); SC.B2.results(results, "角色分配结果");
          } }
      ]
    });

    /* 分配为销售时提示后续需分组 */
    SC.qs('#ar', m.body).addEventListener('change', function (e) {
      var h = SC.qs('#hint', m.body);
      if (e.target.value === '销售') {
        h.innerHTML = SC.note(
          '分配为销售后仍<b>需归入销售分组</b>。未分组销售可查看本人组合与有权空间，' +
          '但需主管受理的新申请与普通准入提报会提示先分组。', 'warn');
      } else if (e.target.value === '解决方案人员') {
        h.innerHTML = SC.note(
          '分配为解决方案人员后仍<b>需分配客户池</b>。未分配客户池的人员菜单正常展示，' +
          '客户内容为空状态并提示需由超级管理员分配。', 'warn');
      } else {
        h.innerHTML = '';
      }
    });
  }

})(window.SC);
