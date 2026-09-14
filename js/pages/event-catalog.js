/* ==========================================================================
   P-ADM-36 事件清单查看页 · 来源 M03-2 §4.1 事件清单的编制与追加规范
   区域：事件清单查看区（只读查看六域事件清单及其九项声明）
   V1.0 不提供在线编辑
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;

  /* 九项声明（每类事件的编制规范） */
  var NINE = [
    '事件编号', '事件名称', '所属事件域', '记录分流（业务动态／仅审计／两者）',
    '必备字段', '关系快照要求', '依据引用要求', '去重键', '责任模块'
  ];

  SC.page({
    role: 'ADM', menu: 'config', pid: 'P-ADM-36',
    title: '事件清单',
    crumb: [{ t: '基础数据配置', href: 'dict-list.html' }],
    desc: '六域事件清单，供排查时对照。<b>只读，V1.0 不提供在线编辑</b>；' +
          '后续 PRD 从域 G 起新增，编号不插入 A～F。'
  }, function (body) {

    var total = D.DOMAINS.reduce(function (a, d) { return a + d.n; }, 0);

    /* -------------------------------------------------- 九项声明 */
    var nine =
      '<div class="card"><div class="card__head">' +
        '<div><div class="card__title">每类事件的九项声明</div>' +
        '<div class="card__sub">事件清单的编制规范。记录口径、标识体系、可见范围、快照与引用口径、' +
        '去重与更正与保留规则全部由 M03-1 定义，本清单不重复</div></div></div>' +
      '<div class="card__body">' +
        '<div class="u-row u-wrap u-g2">' +
          NINE.map(function (n, i) {
            return '<span class="badge badge--outline">' + (i + 1) + '. ' + n + '</span>';
          }).join('') +
        '</div>' +
      '</div></div>';

    /* -------------------------------------------------- 六域总览 */
    var overview =
      '<div class="card"><div class="card__head">' +
        '<div><div class="card__title">六域总览</div>' +
        '<div class="card__sub">共 ' + total + ' 类事件</div></div></div>' +
      '<div class="card__body card__body--flush">' +
        '<table class="table"><thead><tr>' +
          '<th style="width:180px">事件域</th><th style="width:170px">编号区间</th>' +
          '<th class="col-num" style="width:80px">类数</th>' +
          '<th style="width:150px">责任模块</th><th>范围说明</th>' +
        '</tr></thead><tbody>' +
        D.DOMAINS.map(function (d) {
          return '<tr>' +
            '<td><span class="domain-pill domain-pill--' + d.key.toLowerCase() + '">域 ' + d.key + '</span> ' +
              '<span class="u-medium">' + SC.esc(d.name) + '</span></td>' +
            '<td><span class="mono u-f12">' + d.span + '</span></td>' +
            '<td class="col-num">' + d.n + '</td>' +
            '<td class="u-f12 u-t2">' + SC.esc(d.own) + '</td>' +
            '<td class="u-f12 u-t2">' + SC.esc(d.desc) + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table>' +
      '</div></div>';

    /* -------------------------------------------------- 域 A 明细（示例展开） */
    var catA = D.EVENT_CATALOG.A;
    var domA = D.domain('A');
    var detailA =
      '<div class="catalog-domain">' +
        '<div class="catalog-domain__head">' +
          '<span class="domain-pill domain-pill--a">域 A</span>' +
          '<span class="u-semi">' + domA.name + '</span>' +
          '<span class="u-f12 u-t3">' + domA.span + ' · ' + domA.n + ' 类</span>' +
          '<span class="u-grow"></span>' +
          '<span class="u-f11 u-t3">责任模块 ' + domA.own + '</span>' +
        '</div>' +
        '<div class="catalog-domain__body">' +
          '<table class="table table--compact"><thead><tr>' +
            '<th style="width:110px">事件编号</th><th>事件名称</th>' +
            '<th style="width:110px">记录分流</th><th>去重键</th>' +
          '</tr></thead><tbody>' +
          catA.map(function (c) {
            return '<tr>' +
              '<td><span class="audit-ev__code">' + c.code + '</span></td>' +
              '<td class="u-medium">' + SC.esc(c.name) + '</td>' +
              '<td>' + SC.badge(c.flow, c.flow === '两者' ? 'brand' : 'neutral', { sm: true }) + '</td>' +
              '<td class="u-f12 u-t2 mono">' + SC.esc(c.dedup) + '</td>' +
              '</tr>';
          }).join('') + '</tbody></table>' +
        '</div>' +
      '</div>';

    var others = D.DOMAINS.filter(function (d) { return d.key !== 'A'; }).map(function (d) {
      return '<div class="catalog-domain">' +
        '<div class="catalog-domain__head">' +
          '<span class="domain-pill domain-pill--' + d.key.toLowerCase() + '">域 ' + d.key + '</span>' +
          '<span class="u-semi">' + SC.esc(d.name) + '</span>' +
          '<span class="u-f12 u-t3">' + d.span + ' · ' + d.n + ' 类</span>' +
          '<span class="u-grow"></span>' +
          '<span class="u-f11 u-t3">责任模块 ' + SC.esc(d.own) + '</span>' +
        '</div>' +
        '<div class="catalog-domain__body"><div class="card__body">' +
          SC.empty({
            sm: true, icon: 'file',
            title: '本原型未展开该域明细',
            reason: '批 1 原型只展开域 A（人员与权限）共 15 类事件，用于演示清单结构与九项声明。' +
                    '其余五域共 ' + (total - 15) + ' 类事件的逐条字段以 M03-2 需求文档为准。'
          }) +
        '</div></div>' +
      '</div>';
    }).join('');

    body.innerHTML = nine + '<div class="u-mt5">' + overview + '</div>' +
      '<div class="u-mt5"><div class="region__head">' +
        '<span class="region__title">分域明细</span>' +
        '<span class="region__tag">只读对照</span>' +
      '</div>' + detailA + others + '</div>';
  });

})(window.SC);
