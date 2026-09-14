/* ==========================================================================
   P-ADM-32 对象串联查询页 · 来源 M03-1 §4.1 / §4.6 对象串联区
   按业务对象标识查询该对象全部相关事件（全系统共用一套标识，不另建编号体系）
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;
  var q = SC.param('obj');

  /* 对象类型示例 */
  var TYPES = [
    { t: '人员',       eg: 'U-1004',  desc: '人员档案与登录账号' },
    { t: '销售分组',   eg: 'G-01',    desc: '分组及主管关系' },
    { t: '客户',       eg: 'CU-8801', desc: '客户主数据，全局唯一一条' },
    { t: '商机',       eg: 'O-3391',  desc: '独立商机，关联客户、产品与归属销售' },
    { t: '客户池',     eg: 'PL-04',   desc: '解决方案承接团队' },
    { t: '产品',       eg: 'P-118',   desc: '全局产品主数据' },
    { t: '经营组合',   eg: 'C-1182',  desc: '销售 + 客户' },
    { t: '客户工作空间', eg: 'W-2043', desc: '销售 + 客户 + 客户池；标识在迁移与解档时不变' },
    { t: 'Agent 实例', eg: 'A-5127',  desc: '每空间一个当前实例；解档时新建并取得新标识' }
  ];

  SC.page({
    role: 'ADM', menu: 'audit', pid: 'P-ADM-32',
    title: '按对象串联事件',
    crumb: [{ t: '操作审计', href: 'audit-query.html' }],
    desc: '输入业务对象标识，查询该对象的<b>全部相关事件</b>。' +
          '全系统共用一套标识体系，不另建编号体系；<b>标识终身不变</b>。'
  }, function (body) {

    var search =
      '<div class="filterbar">' +
        '<div class="field u-grow" style="min-width:280px">' +
          '<label class="field__label">业务对象标识</label>' +
          '<input class="input" id="q" placeholder="如 U-1004、O-3391、W-2043" value="' + SC.esc(q) + '">' +
        '</div>' +
        '<div class="filterbar__acts"><button class="btn btn--primary" id="go">查询</button></div>' +
      '</div>';

    var typeCard =
      '<div class="card"><div class="card__head">' +
        '<div><div class="card__title">对象类型与标识体系</div>' +
        '<div class="card__sub">这套标识决定 Agent 输出能否回溯至原始依据，' +
        '并承载客保审批的关系快照</div></div></div>' +
      '<div class="card__body card__body--flush">' +
        '<table class="table table--compact"><thead><tr>' +
          '<th style="width:130px">对象类型</th><th style="width:110px">标识示例</th><th>说明</th>' +
        '</tr></thead><tbody>' +
        TYPES.map(function (t) {
          return '<tr><td class="u-medium">' + SC.esc(t.t) + '</td>' +
            '<td><span class="mono u-f12">' + t.eg + '</span></td>' +
            '<td class="u-f12 u-t2">' + t.desc + '</td></tr>';
        }).join('') + '</tbody></table>' +
      '</div></div>';

    /* 串联结果：以人员 U-1007 为例 */
    var chain = D.AUDIT.filter(function (e) {
      return !q || (e.related || []).includes(q) || e.obj.split(/\s+/).includes(q);
    });

    var result = q
      ? '<div class="card"><div class="card__head">' +
          '<div><div class="card__title">串联结果</div>' +
          '<div class="card__sub">对象 <span class="mono">' + SC.esc(q) + '</span> · 共 ' +
          chain.length + ' 条相关事件，按发生时间倒序</div></div></div>' +
        '<div class="card__body card__body--flush">' +
          (chain.length
            ? '<table class="table"><thead><tr>' +
              '<th style="width:140px">发生时间</th><th style="width:78px">域</th>' +
              '<th>事件</th><th style="width:110px">发起人</th><th style="width:92px">结果</th>' +
              '</tr></thead><tbody>' +
              chain.map(function (e) {
                return '<tr>' +
                  '<td class="u-t3 u-f12 mono u-nowrap">' + e.at + '</td>' +
                  '<td><span class="domain-pill domain-pill--' + e.domain.toLowerCase() + '">' + e.domain + '</span></td>' +
                  '<td><div class="audit-ev"><span class="audit-ev__code">' + e.code + '</span>' +
                    '<a href="audit-detail.html?id=' + e.id + '">' + SC.esc(e.name) + '</a></div></td>' +
                  '<td class="u-f12">' + SC.esc(e.by) + '</td>' +
                  '<td>' + (e.result === 'ok' ? SC.badge('成功', 'green', { sm: true })
                          : e.result === 'fail' ? SC.badge('失败', 'red', { sm: true })
                          : SC.badge('部分成功', 'amber', { sm: true })) + '</td>' +
                  '</tr>';
              }).join('') + '</tbody></table>'
            : SC.empty({
                title: '未找到该标识的相关事件',
                reason: '请确认标识是否正确。标识终身不变——空间标识在<b>迁移与解档时不变</b>，' +
                        'Agent 实例在解档时新建并取得<b>新标识</b>。'
              })) +
        '</div></div>'
      : '<div class="card"><div class="card__body">' + SC.empty({
          icon: 'search',
          title: '输入业务对象标识开始串联',
          reason: '可从任一审计事件详情的「涉及对象区」点击进入，也可直接输入标识查询。'
        }) + '</div></div>';

    body.innerHTML = search + '<div class="u-mt5">' + result + '</div>' +
      '<div class="u-mt5">' + typeCard + '</div>';

    SC.qs('#go', body).addEventListener('click', function () {
      var v = SC.qs('#q', body).value.trim();
      location.href = 'audit-object.html?' + new URLSearchParams({ obj: v, role: 'ADM', as: SC.B2.identity('ADM').id });
    });
    SC.qs('#q', body).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') SC.qs('#go', body).click();
    });
  });

})(window.SC);
