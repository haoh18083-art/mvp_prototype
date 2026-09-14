/* ==========================================================================
   空态占位页 · P-MGR-12 审批监督 / P-SLS-09 销售 5 个空菜单 / P-SOL-03 方案任务
   来源：M02-1 已定版第 2、3 条 —— 菜单按角色统一，本期内容为空的菜单仍正常展示，
         页面内用统一空态模板标注由哪个 PRD 交付。
   ========================================================================== */

(function (SC) {
  'use strict';

  var key = SC.param('p') || 'sls-tasks';
  var cfg = SC.PLACEHOLDER[key] || SC.PLACEHOLDER['sls-tasks'];

  if (cfg.role === 'SLS') { SC.B3.sales.placeholder(key); return; }

  if (key === 'mgr-supervise') { SC.B3.manager.supervision(); return; }

  SC.page({
    role: cfg.role, menu: cfg.menu, pid: cfg.pid,
    title: cfg.title,
    crumb: [],
    desc: cfg.desc
  }, function (body) {

    body.innerHTML =
      '<div class="placeholder-wrap">' +
        '<div class="card"><div class="card__body">' +
          SC.empty({
            icon: 'clock',
            title: '本功能由后续 PRD 交付',
            reason: '<b>' + SC.esc(cfg.prd) + '</b>'
          }) +
        '</div>' +
        '<div class="card__foot">' +
          '<div class="u-f12 u-t2" style="line-height:1.85">' +
            '<div class="u-semi u-t1 u-mb2">为什么本期为空</div>' +
            cfg.why +
          '</div>' +
        '</div></div>' +

        '<div class="u-mt5">' + SC.note(
          '<b>菜单不隐藏</b>　按 M02-1 已定版第 2、3 条，菜单按角色统一、不逐人配置；' +
          '内容为空的菜单仍正常展示并标注交付归属，' +
          '而不是隐藏入口或展示后点击提示无权限。', 'info') + '</div>' +
      '</div>';
  });

})(window.SC);
