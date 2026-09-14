/* ==========================================================================
   P-ADM-34 字典列表页 · 来源 M05-1 §4.6 基础字典维护
   区域：字典列表区（全部字典及选项数）；固定字典无操作入口
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;

  SC.page({
    role: 'ADM', menu: 'config', pid: 'P-ADM-34',
    title: '基础数据配置',
    crumb: [],
    desc: '维护业务字典选项。<b>固定字典不提供操作入口</b>——四类角色、产品计费类型、' +
          '空间状态与 Agent 实例状态由需求定义，不开放增删。'
  }, function (body, actions) {

    actions.innerHTML = '<a class="btn" href="event-catalog.html">事件清单查看</a>';

    var rows = D.DICTS.map(function (d) {
      return '<tr' + (d.fixed ? ' class="is-muted"' : '') + '>' +
        '<td>' + (d.fixed
          ? '<span class="u-medium">' + SC.esc(d.name) + '</span>'
          : '<a href="dict-detail.html?id=' + d.id + '" class="u-medium">' + SC.esc(d.name) + '</a>') +
          '<div class="table__sub mono">' + d.id + '</div></td>' +
        '<td class="u-f12 u-t2">' + SC.esc(d.desc) + '</td>' +
        '<td class="col-num">' + d.opts + '</td>' +
        '<td>' + (d.fixed
          ? SC.badge('固定字典', 'neutral', { sm: true })
          : SC.badge('可维护', 'green', { sm: true })) + '</td>' +
        '<td class="col-act"><div class="rowacts">' +
          (d.fixed
            ? '<span class="u-t3 u-f12">无操作入口</span>'
            : '<a class="btn--link" href="dict-detail.html?id=' + d.id + '">维护选项</a>') +
        '</div></td>' +
      '</tr>';
    }).join('');

    body.innerHTML =
      '<div class="table-wrap">' +
        '<div class="toolbar"><div class="toolbar__left">' +
          '<span class="u-f12 u-t2">共 ' + D.DICTS.length + ' 个字典，其中固定字典 ' +
            D.DICTS.filter(function (d) { return d.fixed; }).length + ' 个</span>' +
        '</div></div>' +
        '<table class="table"><thead><tr>' +
          '<th style="width:190px">字典名称</th><th>说明</th>' +
          '<th class="col-num" style="width:88px">选项数</th>' +
          '<th style="width:110px">类型</th><th class="col-act">操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>' +
      '<div class="u-mt4">' + SC.protoNote(
        '本原型只实现「客保驳回原因」（D-04）与「角色」（D-08）两个字典的详情页，' +
        '用于演示可维护字典与固定字典的差异。'
      ) + '</div>';
  });

})(window.SC);
