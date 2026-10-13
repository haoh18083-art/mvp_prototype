/**
 * R17 财务呈现组件：桌面与移动端共享当月卡片、历史月份和原始产品类型明细。
 * 金额只读取 store.js 的同一套计算结果；组件不变更业务归属、不自行补零。
 */
(function (F) {
  'use strict';
  const e = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  F.financeMoney = value => value === null || value === undefined ? '—' : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = value => `<span class="gp-money${value < 0 ? ' is-negative' : ''}">${e(F.financeMoney(value))}</span>`;
  const statusNames = { ready: '数据可用', empty: '当月无业务', partial: '部分待核对', pending: '待核对', unavailable: '暂无数据', forbidden: '明细受限' };
  const status = result => `<span class="gp-status is-${e(result.status)}">${e(statusNames[result.status] || '待核对')}</span>`;

  /** 当前值卡片：预计合计包含已结算，三个金额不可再次相加。 */
  F.financeSummary = function (result, options = {}) {
    const title = options.title || '当月毛利';
    if (result.status === 'forbidden') return `<section class="gp-summary" data-finance-summary data-finance-state="forbidden"><header><h3>${e(title)}</h3>${status(result)}</header><p class="gp-empty">历史财务明细的查看权限待核对。</p><p class="gp-note">可读冻结客户资料不代表恢复财务明细权限。</p></section>`;
    const explanation = !result.available ? '所选月份暂无可用数据，金额不按零展示。'
      : result.pendingCount ? `${result.pendingCount} 条业务待核对，当前毛利仅包含可计算部分。`
        : result.status === 'empty' ? '数据已覆盖该月份，当前范围无业务。' : '预计合计 = 已结算毛利 + 待结算预计毛利';
    return `<section class="gp-summary" data-finance-summary data-finance-state="${e(result.status)}" data-finance-month="${e(result.month || '')}">
      <header class="gp-summary-head"><div><p class="gp-eyebrow">${e(result.month || `${result.start} — ${result.end}`)} · ${e(options.binding || '月度经营')}</p><h3>${e(title)}</h3></div>${status(result)}</header>
      <div class="gp-summary-body"><div class="gp-primary"><span>预计毛利合计</span><strong data-profit-total>${money(result.profit)}</strong><small>元 · 按记账月份</small></div>
        <dl class="gp-support"><div><dt><i class="gp-dot"></i>已结算毛利</dt><dd data-profit-settled>${money(result.settledProfit)}</dd></div><div><dt><i class="gp-dot is-estimated"></i>待结算预计毛利</dt><dd data-profit-estimated>${money(result.estimatedProfit)}</dd></div><div><dt>流水总数 <small>按收入结算时间</small></dt><dd data-turnover>${money(result.revenue)}</dd></div></dl></div>
      <p class="gp-note${result.pendingCount ? ' is-warning' : ''}">${e(explanation)}${result.turnoverMissing ? ` 流水另有 ${result.turnoverMissing} 条结算金额待补。` : ''}</p>
      <footer class="gp-source">${result.stale ? '<strong>同步失败 · 展示上次成功结果</strong> · ' : ''}数据截止 ${e(result.dataAsOf || '暂无成功记录')}<span>演示数据 · 单位：元</span></footer>
    </section>`;
  };

  /** 每项明细保留结算状态和取值来源；待核对行不展示虚构毛利。 */
  function entryHtml(row) {
    const state = { settled: '已结算', estimated: '待结算预计', pending: '待核对' }[row.status];
    return `<article class="gp-entry" data-profit-entry="${e(row.id)}"><header><strong>${e(row.productType || '产品类型待核对')}</strong><span class="gp-status is-${row.status === 'pending' ? 'pending' : 'ready'}">${state}</span></header>
      <dl class="gp-entry-fields"><div><dt>应收金额</dt><dd>${money(row.receivableAmount)}</dd></div><div><dt>对应成本</dt><dd>${money(row.cost)}</dd></div><div><dt>毛利</dt><dd>${money(row.profit)}</dd></div><div><dt>记账日期</dt><dd>${e(row.bookDate || '待核对')}</dd></div><div><dt>收入结算时间</dt><dd>${e(row.settledAt || '未结算')}</dd></div><div><dt>成本取值</dt><dd>${row.costs.length ? row.costs.map(cost => cost.costSettled === true ? '结算成本' : '预估成本').filter((value, i, list) => list.indexOf(value) === i).join('、') : '未配对'}</dd></div></dl>
      ${row.reasons.length ? `<p class="gp-note is-warning">${e(row.reasons.join('；'))}</p>` : ''}<small class="gp-note">来源记录 ${e(row.id)} · ${e(row.company)} · 销售 ${e(row.salesName || '未归属')}</small></article>`;
  }

  /** 按原始产品类型展开应收、成本与毛利；不映射为新的业务线或层级。 */
  F.financeProducts = function (products = []) {
    if (!products.length) return '<p class="gp-empty">该月份暂无可展示的产品明细。</p>';
    return `<div class="gp-products" data-profit-products>${products.map(group => `<details class="gp-product" data-profit-product="${e(group.label)}"><summary><div><strong>${e(group.label)}</strong><span>${group.pendingCount ? `${group.pendingCount} 条待核对` : `${group.validCount} 条可计算业务`}</span></div><div class="gp-product-value"><small>预计毛利</small>${money(group.profit)}<b aria-hidden="true">⌄</b></div></summary>
      <div class="gp-product-body"><dl class="gp-product-totals"><div><dt>可计算应收</dt><dd>${money(group.receivable)}</dd></div><div><dt>对应成本</dt><dd>${money(group.cost)}</dd></div><div><dt>已结算毛利</dt><dd>${money(group.settledProfit)}</dd></div><div><dt>待结算预计</dt><dd>${money(group.estimatedProfit)}</dd></div></dl>
      ${group.rows.map(entryHtml).join('')}
      ${group.turnoverRows.some(row => !group.rows.some(item => item.id === row.id)) ? '<p class="gp-note">本月流水含其他记账月份在本月结算的业务，不并入本月毛利。</p>' : ''}</div></details>`).join('')}</div>`;
  };

  /** 历史月份独立于概览当月，切换后只重绘当前绑定的历史结果。 */
  F.financeHistory = function (spaceId, selectedMonth, state = F.load()) {
    const month = /^\d{4}-\d{2}$/.test(selectedMonth || '') && selectedMonth < F.financeMonth() ? selectedMonth : F.financeMonth(-1);
    const result = F.spaceFinance(spaceId, month, state);
    return `<section class="gp-history" data-profit-history data-profit-space="${e(spaceId)}"><header class="gp-toolbar"><div><h3>历史毛利</h3><p>先看月度总额，再按原始产品类型展开。</p></div><label class="gp-month-label">历史月份<input type="month" data-profit-month value="${e(month)}" max="${e(F.financeMonth(-1))}" aria-label="历史月份"></label></header>
      ${F.financeSummary(result, { title: '月度毛利', binding: result.space ? result.space.customer + ' — ' + F.name(result.space.sales) : '' })}
      ${result.available ? `<div class="gp-section-head"><h4>产品类型构成</h4><span>应收 − 对应成本 = 毛利</span></div>${F.financeProducts(result.products)}` : ''}</section>`;
  };

  /** 卡片只读当月，供桌面概览和移动端概览直接复用。 */
  F.spaceProfitCard = (spaceId, state = F.load()) => {
    const result = F.spaceFinance(spaceId, F.financeMonth(), state);
    return F.financeSummary(result, { binding: result.space ? result.space.customer + ' — ' + F.name(result.space.sales) : '' });
  };
})(window.SC.FEATURES);
