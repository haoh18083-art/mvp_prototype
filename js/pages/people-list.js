/* ==========================================================================
   P-ADM-01 人员管理列表页 · 来源 M01 §4.1 / §4.5 / §4.8
   区域：人员列表、操作区、状态操作区、批量操作区、账号信息区、动态反馈区
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;

  SC.page({
    role: 'ADM', menu: 'people', pid: 'P-ADM-01',
    title: '人员与账号',
    crumb: [],
  }, function (body, actions) {

    /* -------------------------------------------------- 操作区 */
    actions.innerHTML =
      '<a class="btn" href="role-pool.html">待分配角色池' +
        '<span class="badge badge--amber badge--sm">' + D.ROLE_POOL.length + '</span></a>' +
      '<a class="btn" href="people-import.html">' + SC.icon('upload', 14) + ' 批量导入</a>' +
      '<button class="btn btn--primary" id="add">' + SC.icon('plus', 14) + ' 新增人员</button>';

    /* -------------------------------------------------- 筛选区 */
    var filter =
      '<div class="filterbar">' +
        '<div class="field"><label class="field__label">姓名或邮箱</label>' +
          '<input class="input" placeholder="搜索姓名、邮箱前缀"></div>' +
        '<div class="field"><label class="field__label">角色</label>' +
          '<select class="select"><option>全部角色</option><option>销售</option>' +
          '<option>销售主管</option><option>解决方案人员</option><option>超级管理员</option></select></div>' +
        '<div class="field"><label class="field__label">账号状态</label>' +
          '<select class="select"><option>全部</option><option>启用</option><option>停用</option></select></div>' +
        '<div class="field"><label class="field__label">销售分组</label>' +
          '<select class="select"><option>全部</option>' + D.GROUPS.map(function (g) { return '<option>' + SC.esc(g.name) + '</option>'; }).join('') + '<option>未分组</option></select></div>' +
        '<div class="filterbar__acts">' +
          '<button class="btn">重置</button>' +
          '<button class="btn btn--primary">查询</button>' +
        '</div>' +
      '</div>';

    /* -------------------------------------------------- 人员列表 */
    var rows = D.PEOPLE.map(function (p) {
      var isSales = p.role === 'SLS';
      return '<tr>' +
        '<td class="col-check"><input type="checkbox" data-check-row value="' + p.id + '"></td>' +
        '<td>' +
          '<div class="u-row u-g3">' +
            '<span class="member-row__av">' + SC.esc(p.name.charAt(0)) + '</span>' +
            '<span><a href="people-detail.html?id=' + p.id + '" class="u-medium">' + SC.esc(p.name) + '</a>' +
            '<div class="table__sub mono">' + p.id + '</div></span>' +
          '</div>' +
        '</td>' +
        '<td><span class="mono u-f12">' + SC.esc(p.email) + '</span>' +
            '<span class="u-t3 u-f12">@teddymobile.cn</span></td>' +
        '<td class="u-t2 u-f12 mono">' + SC.esc(p.phone) + '</td>' +
        '<td>' + SC.badge(D.ROLES[p.role].name, p.role === 'ADM' ? 'brand' : 'neutral') + '</td>' +
        '<td class="u-f12">' + (p.group === '—'
              ? (isSales ? '<span class="badge badge--amber badge--sm">未分组</span>' : '<span class="u-t3">—</span>')
              : SC.esc(p.group)) + '</td>' +
        '<td>' + SC.state(p.status === 'on') + '</td>' +
        '<td class="u-t3 u-f12 u-nowrap">' + p.created + '</td>' +
        '<td class="col-act"><div class="rowacts">' +
          '<button class="btn--link" data-toggle="' + p.id + '">' + (p.status === 'on' ? '停用' : '启用') + '</button>' +
          '<a class="btn--link" href="people-detail.html?id=' + p.id + '">详情</a>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    var table =
      '<div class="table-wrap">' +
        '<div class="toolbar">' +
          '<div class="toolbar__left"><span class="u-f12 u-t2">共 ' + D.PEOPLE.length +
            ' 名人员，其中未分组销售 <b class="u-warn">' + D.PEOPLE.filter(function (p) { return p.role === 'SLS' && !p.groupId; }).length + '</b> 名</span></div>' +
          '<div class="toolbar__right">' +
            '<button class="btn btn--sm" id="bulk-on" disabled>批量启用</button>' +
            '<button class="btn btn--sm btn--danger" id="bulk-off" disabled>批量停用</button>' +
          '</div>' +
        '</div>' +
        '<div class="bulkbar u-hide" id="bulkbar">' +
          '<span>已选中 <b id="bulk-n">0</b> 名人员</span>' +
          '<button class="btn--link" id="bulk-clear">取消选择</button>' +
        '</div>' +
        '<div class="table-wrap--scroll">' +
        '<table class="table"><thead><tr>' +
          '<th class="col-check"><input type="checkbox" data-check-all></th>' +
          '<th>姓名</th><th>邮箱</th><th>手机号</th><th>角色</th>' +
          '<th>销售分组</th><th>账号状态</th><th>创建时间</th><th class="col-act">操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
        SC.pager({ total: D.PEOPLE.length, size: 20, page: 1 }) +
      '</div>';

    body.innerHTML = filter + '<div class="u-mt5">' + table + '</div>' +
      '<div class="u-mt4">' + SC.protoNote(
        '本页为原型，筛选与分页不做真实过滤。「停用」与「批量停用」会打开 D-04 停用确认弹窗，' +
        '演示影响提示与交接入口（M01 §4.5）。'
      ) + '</div>';

    /* -------------------------------------------------- 批量选中联动 */
    var bulkbar = SC.qs('#bulkbar', body);
    var wired = SC.wireCheckAll(body, function (n) {
      bulkbar.classList.toggle('u-hide', n === 0);
      SC.qs('#bulk-n', body).textContent = n;
      SC.qs('#bulk-on', body).disabled = n === 0;
      SC.qs('#bulk-off', body).disabled = n === 0;
    });

    SC.qs('#bulk-clear', body).addEventListener('click', function () {
      wired.boxes.forEach(function (b) { b.checked = false; });
      var all = SC.qs('[data-check-all]', body);
      if (all) { all.checked = false; all.indeterminate = false; }
      wired.sync();
    });

    /* -------------------------------------------------- 新增人员弹窗 D-01 */
    SC.qs('#add', actions).addEventListener('click', openAddModal);

    /* -------------------------------------------------- 单个启停 */
    SC.qsa('[data-toggle]', body).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = D.person(btn.dataset.toggle);
        if (p.status === 'off') {
          SC.setAccountState([p.id], 'on');
          SC.toast('已启用 ' + p.name + ' 的账号', 'ok');
          setTimeout(function () { location.reload(); }, 250);
          return;
        }
        openDisableModal([p]);
      });
    });

    /* -------------------------------------------------- 批量停用 */
    SC.qs('#bulk-off', body).addEventListener('click', function () {
      var ids = wired.boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      var list = ids.map(D.person).filter(function (p) { return p && p.status === 'on'; });
      if (!list.length) { SC.toast('所选人员均已停用', 'bad'); return; }
      openDisableModal(list);
    });

    SC.qs('#bulk-on', body).addEventListener('click', function () {
      var ids = wired.boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      SC.setAccountState(ids, 'on');
      SC.toast('批量启用已提交', 'ok');
      setTimeout(function () { location.reload(); }, 250);
    });
  });

  /* ============================================================ D-01 新增人员弹窗 */

  function openAddModal() {
    var form =
      '<div class="field">' +
        '<label class="field__label">姓名<span class="req">*</span></label>' +
        '<input class="input" id="n-name" placeholder="请输入真实姓名">' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label">邮箱<span class="req">*</span></label>' +
        '<div class="input-affix">' +
          '<input class="input" id="n-mail" placeholder="邮箱前缀">' +
          '<span class="input-affix__suffix">@teddymobile.cn</span>' +
        '</div>' +
        '<span class="field__hint">填写姓名后自动带出前缀建议值并允许改写，<b>以实际企业邮箱为准</b></span>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label">密码<span class="req">*</span></label>' +
        '<div class="u-row u-g2">' +
          '<input class="input" id="n-pwd" value="Tk8m#Wp3Qz6v">' +
          '<button class="btn btn--sm u-nowrap" id="n-gen">重新生成</button>' +
        '</div>' +
        '<span class="field__hint">默认随机生成，可改为手动输入；<b>不强制首次修改密码</b></span>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label">手机号</label>' +
        '<input class="input" placeholder="选填">' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label">角色</label>' +
        '<select class="select" id="n-role">' +
          '<option value="">留空：进入待分配角色池</option>' +
          '<option>销售</option><option>销售主管</option>' +
          '<option>解决方案人员</option><option>超级管理员</option>' +
        '</select>' +
        '<span class="field__hint">一人只对应一种角色。角色留空的人员进入待分配角色池，分配角色后才能登录</span>' +
      '</div>';

    var m = SC.modal({
      title: '新增人员',
      sub: '同时创建人员档案与登录账号',
      body: form,
      buttons: [
        { label: '取消', cls: '' },
        { label: '提交', cls: 'btn--primary', onClick: function (close) {
            var name = SC.qs('#n-name', m.body).value.trim();
            if (!name) { SC.toast('请填写姓名', 'bad'); return; }
            close();
            SC.toast('已创建人员 ' + name + '，密码可在人员详情复制', 'ok');
          } }
      ]
    });

    /* 姓名 → 邮箱前缀建议值（可改写，不阻断创建） */
    var PY = { 陈: 'chen', 李: 'li', 王: 'wang', 张: 'zhang', 刘: 'liu', 周: 'zhou',
               许: 'xu', 苏: 'su', 何: 'he', 于: 'yu', 柯: 'ke', 邓: 'deng' };
    SC.qs('#n-name', m.body).addEventListener('input', function (e) {
      var v = e.target.value.trim();
      var mail = SC.qs('#n-mail', m.body);
      if (!v) { mail.value = ''; return; }
      if (mail.dataset.touched) return;
      mail.value = (PY[v.charAt(0)] || 'user') + (v.length > 1 ? v.slice(1).replace(/[^\w]/g, '') : '');
    });
    SC.qs('#n-mail', m.body).addEventListener('input', function (e) { e.target.dataset.touched = '1'; });

    SC.qs('#n-gen', m.body).addEventListener('click', function () {
      var cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@';
      var s = '';
      for (var i = 0; i < 12; i++) s += cs.charAt(Math.floor(Math.random() * cs.length));
      SC.qs('#n-pwd', m.body).value = s;
    });
  }

  /* ============================================================ D-04 停用确认弹窗
     C-10 影响提示弹窗范式：影响提示区 → 操作区 → 结果区
     查看明细不执行停用或交接 */

  function openDisableModal(list) {
    var multi = list.length > 1;
    var sum = list.reduce(function (a, p) {
      a.cust += p.cust; a.opp += p.opp; a.space += p.space; return a;
    }, { cust: 0, opp: 0, space: 0 });

    var head = multi
      ? SC.impact({
          danger: true,
          title: '将停用 ' + list.length + ' 名人员的账号',
          cells: [
            { k: '涉及客户', v: sum.cust },
            { k: '归属商机', v: sum.opp },
            { k: '已建空间', v: sum.space }
          ],
          note: '商机数含<b>已结束、产品未激活及未建空间</b>的仍归属记录，不因隐藏或已结束而遗漏。'
        })
      : SC.impact({
          danger: true,
          title: '将停用 ' + list[0].name + '（' + (list[0].group === '—' ? '未分组' : list[0].group) + '）的账号',
          cells: [
            { k: '归属客户', v: list[0].cust },
            { k: '归属商机', v: list[0].opp },
            { k: '已建空间', v: list[0].space }
          ],
          note: '商机数含<b>已结束、产品未激活及未建空间</b>的仍归属记录。<br>' +
                '<b>账号停用不改变商机归属</b>；正式交接须在离职交接页面明确办理。'
        });

    var detail = multi
      ? '<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
          '<th>销售</th><th>分组</th><th class="col-num">客户</th>' +
          '<th class="col-num">商机</th><th class="col-num">已建空间</th></tr></thead><tbody>' +
          list.map(function (p) {
            return '<tr><td class="u-medium">' + SC.esc(p.name) + '</td>' +
              '<td class="u-f12 u-t2">' + SC.esc(p.group) + '</td>' +
              '<td class="col-num">' + p.cust + '</td>' +
              '<td class="col-num">' + p.opp + '</td>' +
              '<td class="col-num">' + p.space + '</td></tr>';
          }).join('') + '</tbody></table></div>'
      : '';

    var m = SC.modal({
      title: multi ? '批量停用确认' : '停用账号确认',
      sub: '停用后该账号无法登录，无法访问任何客户工作空间',
      size: multi ? 'md' : '',
      body: head + detail,
      footSplit: true,
      buttons: [
        { label: '查看交接明细', cls: '', onClick: function () { openHandoverDetail(list); } },
        { spacer: true },
        { label: '取消', cls: '' },
        { label: '确认停用', cls: 'btn--danger-solid', onClick: function (close) {
            close();
            openDisableResult(list);
          } }
      ]
    });
    return m;
  }

  /* 查看交接明细：只读，不执行停用或交接 */
  function openHandoverDetail(list) {
    location.href = 'handover.html?role=ADM&sales=' + encodeURIComponent(list[0].id);
  }

  /* 停用结果 → 交接入口区：不强制跳转，未处理事项保留 */
  function openDisableResult(list) {
    var results = SC.setAccountState(list.map(function (p) { return p.id; }), 'off');
    var ok = list.filter(function (p) { return results.some(function (r) { return r.id === p.id && r.ok; }); });
    var bad = list.filter(function (p) { return !results.some(function (r) { return r.id === p.id && r.ok; }); });

    var res = SC.result({
      nums: [
        { k: '成功停用', v: ok.length, tone: 'ok' },
        { k: '停用失败', v: bad.length, tone: bad.length ? 'bad' : '' },
        { k: '进入待分配', v: ok.filter(function (p) { return p.opp > 0; }).length }
      ],
      rows: bad.map(function (p) {
        return { obj: p.name, why: results.filter(function (r) { return r.id === p.id; })[0].why, act: '' };
      })
    });

    SC.modal({
      title: '停用结果',
      sub: '成功停用且有归属商机的按销售分别进入待分配；失败项不按成功停用处理',
      size: 'md',
      body: res +
        SC.note('剩余交接事项<b>持续保留</b>，可从「客保裁决台 › 离职交接」继续处理。' +
                '不强制现在跳转，账号停用不改变商机归属。', 'info'),
      buttons: [
        { label: '暂不处理', cls: '', onClick: function (close) { close(); location.reload(); } },
        { label: '前往交接', cls: 'btn--primary', onClick: function (close) {
            close();
            location.href = 'handover.html?role=ADM&sales=' + encodeURIComponent(list[0].id);
          } }
      ]
    });
  }

})(window.SC);
