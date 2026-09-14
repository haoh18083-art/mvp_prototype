/* ==========================================================================
   P-ADM-06 分组详情页 · 来源 M02-2 §4.1 / §4.2 未分组销售的首次分配 / §4.4 主管继任
   区域：基础信息区、组内销售区、加入成员弹窗（销售选择 / 已分组提示 / 结果）、主管继任区
   ========================================================================== */

(function (SC, B) {
  'use strict';

  var D = SC.DATA;
  var id = SC.param('id') || 'G-01';
  var g = D.group(id);
  var members = [];

  B.mount({
    role: 'ADM', menu: 'groups', pid: 'P-ADM-06',
    title: function () { return B.find("groups", id)?.name || "分组详情"; },
    crumb: [{ t: '销售分组', href: 'groups.html' }],
    showHead: false
  }, function (body) {
    g = D.group(id);
    if (!g) { body.innerHTML = B.empty("分组不存在", "请返回销售分组列表查看最新结果。"); return; }
    members = D.GROUP_MEMBERS[g.id] || [];

    /* -------------------------------------------------- 基础信息区 */
    var hero =
      '<div class="card"><div class="person-hero">' +
        '<span class="person-hero__av">' + SC.icon('sitemap', 22) + '</span>' +
        '<div class="u-grow">' +
          '<div class="person-hero__name">' + SC.esc(g.name) + '</div>' +
          '<div class="person-hero__meta">' +
            '<span class="mono">' + g.id + '</span>' +
            (g.mgr === '—'
              ? '<span class="badge badge--red badge--sm">' + SC.icon('warn', 11) + ' 无主管</span>'
              : '<span>主管 ' + SC.esc(g.mgr) + '</span>') +
            '<span class="u-t3">' + members.length + ' 名销售</span>' +
          '</div>' +
        '</div>' +
        '<div class="btn-group">' +
          '<button class="btn" id="rename">修改名称</button>' +
          '<button class="btn" id="succeed">' +
            (g.mgr === '—' ? '指定主管' : '主管继任') + '</button>' +
        '</div>' +
      '</div></div>';

    /* -------------------------------------------------- 组内销售区 */
    var memRows = members.map(function (m) {
      return '<tr>' +
        '<td><div class="member-row">' +
          '<span class="member-row__av">' + SC.esc(m.name.charAt(0)) + '</span>' +
          '<a href="people-detail.html?id=' + m.id + '" class="u-medium">' + SC.esc(m.name) + '</a>' +
        '</div></td>' +
        '<td>' + SC.state(m.status === 'on') + '</td>' +
        '<td class="col-num">' + m.cust + '</td>' +
        '<td class="col-num">' + m.combo + '</td>' +
        '<td class="col-num">' + m.space + '</td>' +
        '<td class="col-num">' + m.history + '</td>' +
        '<td class="col-act"><div class="rowacts">' +
          '<a class="btn--link" href="people-detail.html?id=' + m.id + '">详情</a>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    var memberCard =
      '<div class="card">' +
        '<div class="card__head">' +
          '<div><div class="card__title">组内销售</div>' +
          '<div class="card__sub">经营组合按「销售 + 客户」，当前空间按「销售 + 客户 + 客户池」，两者数量不必相等</div></div>' +
          '<button class="btn btn--sm btn--primary" id="add-mem">' + SC.icon('plus', 13) + ' 加入成员</button>' +
        '</div>' +
        '<div class="card__body card__body--flush">' +
          (members.length
            ? '<table class="table"><thead><tr><th>销售</th><th>账号状态</th>' +
              '<th class="col-num">去重客户数</th><th class="col-num">经营组合数</th>' +
              '<th class="col-num">当前空间数</th><th class="col-num">归档历史数</th><th class="col-act">操作</th>' +
              '</tr></thead><tbody>' + memRows + '</tbody></table>'
            : SC.empty({
                title: '本组暂无销售',
                reason: '可从待分组销售中加入成员。已分组销售<b>不支持转组</b>（V1.0 边界）。',
                actions: []
              })) +
        '</div>' +
      '</div>';

    /* -------------------------------------------------- 右栏 */
    var side =
      '<div class="card"><div class="card__head"><div class="card__title">本组概览</div></div>' +
      '<div class="card__body">' +
        '<div class="stats" style="grid-template-columns:1fr 1fr">' +
          '<div class="stat"><div class="stat__k">去重客户数</div><div class="stat__v">' + g.cust + '</div></div>' +
          '<div class="stat"><div class="stat__k">经营组合数</div><div class="stat__v">' + g.combo + '</div></div>' +
          '<div class="stat stat--accent"><div class="stat__k">当前空间数</div><div class="stat__v">' + g.space + '</div></div>' +
          '<div class="stat"><div class="stat__k">归档历史数</div><div class="stat__v">' + g.history + '</div></div>' +
          '<div class="stat"><div class="stat__k">销售数</div><div class="stat__v">' + g.sales + '</div></div>' +
        '</div>' +
      '</div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">主管职责范围</div></div>' +
      '<div class="card__body u-f12 u-t2" style="line-height:1.9">' +
        '· 审批本组销售<b>除两类首批申请外</b>的未跨组客保申请并人工选池<br>' +
        '· 向本组销售直接分配空余商机<br>' +
        '· 调整本组商机的客户池归属<br>' +
        '· 受理本组经营组合的跟进准入终审<br>' +
        '· 对本组标注「当前无装载商机」的空置池空间发起<b>手动归档</b><br>' +
        '· <span class="u-danger">不审批两类首批申请，不发起也不审批商机释放</span>' +
      '</div></div>';

    body.innerHTML = hero +
      '<div class="u-mt5 sc-split"><div>' + memberCard + '</div><div>' + side + '</div></div>';

    /* -------------------------------------------------- 交互 */
    SC.qs('#add-mem', body).addEventListener('click', openAddMember);
    SC.qs('#succeed', body).addEventListener('click', function () { openSuccession(g); });
    SC.qs('#rename', body).addEventListener('click', function () {
      var version = g.version;
      B.modal({ title: "修改分组名称", confirm: "保存",
        body: '<form class="b2-form">' + B.field("分组名称", "name", g.name, { required: true }) + '</form>',
        onConfirm: async function (root) {
          await B.renameGroup(id, B.values(root).name, version);
          B.render(); SC.toast("已保存分组名称", "ok");
        }
      });
    });
  });

  function openAddMember() { B.assignGroupModal([], id); }
  function openSuccession(group) { B.successionModal(group); }
})(window.SC, window.SC.B2);
