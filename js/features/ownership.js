/** 客户归属分布视图：R06 按客户只读展示当前归属、历史归属与异常入口，不审批、不改归属、不恢复权限。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  const entitlementText = type => type === 'customer_only' ? '客户级确权' : type === 'opportunity' ? '商机级确权' : type === 'none' ? '无当前确权' : '客户级 + 商机级';
  const changeText = { added: '进入', removed: '移除', restored: '恢复', pending: '待对应', frozen: '空间冻结' };
  const changeTone = { added: 'green', removed: 'neutral', restored: 'brand', pending: 'amber', frozen: 'neutral' };

  F.views['customer-ownership'] = function (root) {
    let query = {};
    let selected = SC.param('customer') || '';

    /** 当前归属：合并客户级与商机级确权，同一销售多商机合并为一个空间并可展开商机范围。 */
    function renderCurrent(item) {
      if (!item.current.length) {
        return `<section class="fp-panel fp-pad" data-ownership-current="empty"><h3>当前归属</h3><p class="u-t3">该客户当前没有有效归属销售。</p>${item.history.length ? '<p class="fp-hint">历史归属过程见右侧，只读且不恢复任何权限。</p>' : ''}</section>`;
      }
      return `<section class="fp-panel" data-ownership-current="filled"><header class="fp-panel-head"><h3>当前归属</h3><span class="u-t3">${item.current.length} 位销售</span></header><div class="fp-pad fp-stack">${item.current.map(entry => {
        const frozen = entry.lifecycle === 'frozen';
        const ready = entry.readiness === 'failed' ? ['更新失败', 'amber'] : ['preparing', 'updating'].includes(entry.readiness) ? ['更新中', 'brand'] : ['已就绪', 'green'];
        return `<article class="fp-ownership-entry" data-ownership-sales="${e(entry.sales)}">
          <div class="fp-actions"><strong>${e(entry.name)}</strong>${F.badge(entitlementText(entry.entitlementType), 'brand')}<span data-ownership-lifecycle="${frozen ? 'frozen' : 'active'}">${F.badge(frozen ? '已冻结' : '进行中', frozen ? 'neutral' : 'green')}</span><span data-ownership-readiness="${e(entry.readiness)}">${F.badge(ready[0], ready[1])}</span></div>
          <dl class="fp-kv u-mt2"><dt>客户池</dt><dd>${entry.pool ? e(entry.pool) : '待补客户池'}</dd><dt>确权商机</dt><dd>${entry.opportunities.length ? entry.opportunities.map(opportunity => `${e(opportunity.name)}（${e(opportunity.id)}）`).join('；') : '仅客户级确权，商机列表为空'}</dd><dt>最近变化</dt><dd>${e(entry.updatedAt || '—')}</dd></dl>
          ${entry.failure ? `<div class="fp-callout fp-callout--warn" data-ownership-failure><strong>内容失败：</strong>${e(entry.failure.reason)}（环节：${e(entry.failure.stage)}）。空间不显示为正常可用。</div>` : ''}
          <div class="fp-actions u-mt2"><a class="btn" href="${F.link('followup-workbench', { space: entry.spaceId })}">查看客户空间</a></div>
        </article>`;
      }).join('')}</div></section>`;
    }

    /** 历史归属：按时间展示进入、移除、恢复和事实类型，与当前归属分栏，且保持只读。 */
    function renderHistory(item) {
      return `<section class="fp-panel" data-ownership-history="${item.history.length ? 'filled' : 'empty'}"><header class="fp-panel-head"><h3>历史归属</h3><span class="u-t3">${item.history.length} 条过程记录</span></header><div class="fp-pad fp-stack">
        <div class="fp-callout" data-ownership-readonly>历史记录只读：不改写当前归属，也不恢复任何销售的访问权限。</div>
        ${item.history.length ? `<div class="fp-timeline">${item.history.map(record => `<article class="fp-event" data-history-change="${e(record.change)}"><div class="fp-actions"><strong>${e(record.name)}</strong>${F.badge(changeText[record.change] || record.change, changeTone[record.change] || 'neutral')}${F.badge(record.factType, 'neutral')}</div>${record.detail ? `<p>${e(record.detail)}</p>` : ''}<small>${e(record.at || '时间未知')}${record.batchId ? ` · 批次 ${e(record.batchId)}` : ''}${record.spaceId ? ` · 当时空间 ${e(record.spaceId)}` : ''}</small></article>`).join('')}</div>` : '<p class="u-t3">该客户暂无归属变化记录。</p>'}
      </div></section>`;
    }

    /** 异常单独标注：待对应人员不计为有效归属，未分配商机不建立销售空间。 */
    function renderIssues(item) {
      if (!item.pending.length && !item.unassigned.length && !item.errors.length) return '';
      return `<section class="fp-panel fp-pad" data-ownership-issues><h3>归属异常</h3>
        ${item.pending.map(issue => `<div class="fp-callout fp-callout--warn" data-issue="pending"><strong>待对应人员：</strong>${e(issue.crmName)}（${e(issue.crmId)}）涉及 ${e(issue.opportunity)}，尚未对应系统账号，不计为有效归属销售。<span class="fp-actions u-mt2"><a class="btn" href="${F.link('operations-config', { tab: 'crm', crmView: 'pending' })}">前往处理</a></span></div>`).join('')}
        ${item.unassigned.map(issue => `<div class="fp-callout fp-callout--warn" data-issue="unassigned"><strong>未分配商机：</strong>${e(issue.opportunity)}（${e(issue.opportunityId)}）${e(issue.reason)}，不建立销售空间。<span class="fp-actions u-mt2"><a class="btn" href="${F.link('operations-config', { tab: 'crm', crmView: 'unassigned' })}">查看清单</a></span></div>`).join('')}
        ${item.errors.map(issue => `<div class="fp-callout fp-callout--warn" data-issue="error"><strong>对齐异常：</strong>${e(issue.reason)}（环节：${e(issue.stage)}）。<span class="fp-actions u-mt2"><a class="btn" href="${F.link('operations-config', { tab: 'crm', crmView: 'errors' })}">查看详情</a></span></div>`).join('')}
      </section>`;
    }

    function draw() {
      const state = F.load();
      const all = F.ownership(state);
      const crm = state.crm || {};
      root.innerHTML = `<div class="fp-stack">
        <div class="fp-callout">本视图只读：按客户解释当前由谁承接、空间是否可用，以及归属如何变化。不审批、不修改归属、不恢复历史权限，也不参与经营统计。</div>
        ${F.metrics([['客户', all.length, '含仅有异常的客户'], ['当前归属关系', all.reduce((sum, item) => sum + item.current.length, 0), '销售 × 客户'], ['待对应人员', crm.pending || 0, '不计为有效归属'], ['未分配商机', crm.unassigned || 0, '需回 CRM 处理'], ['内容失败空间', all.reduce((sum, item) => sum + item.contentFailures.length, 0), '不显示为正常可用']])}
        ${F.panel('客户归属分布', F.searchbar('搜索客户名称或客户编号', F.field('归属状态', 'status', '', 'select', [['', '全部客户'], ['owned', '有当前归属'], ['none', '无当前归属'], ['issue', '存在异常']])) + '<div data-ownership-results></div>')}
        <div data-ownership-detail></div>
      </div>`;
      filter(query);
      F.handleSearch(root, filter);
    }

    function filter(values = {}) {
      query = values;
      F.restoreSearch(root, values);
      const state = F.load();
      const all = F.ownership(state);
      const keyword = String(values.q || '').trim().toLocaleLowerCase('zh-CN');
      const rows = all.filter(item => {
        const matched = !keyword || `${item.customer} ${item.customerId}`.toLocaleLowerCase('zh-CN').includes(keyword);
        const issues = item.pending.length + item.unassigned.length + item.errors.length + item.contentFailures.length;
        const status = !values.status || (values.status === 'owned' ? item.current.length > 0 : values.status === 'none' ? item.current.length === 0 : issues > 0);
        return matched && status;
      });
      const body = rows.map(item => {
        const issues = item.pending.length + item.unassigned.length + item.errors.length + item.contentFailures.length;
        const types = [...new Set(item.current.map(entry => entitlementText(entry.entitlementType)))];
        return `<tr data-ownership-row data-customer="${e(item.customerId)}"><td><strong>${e(item.customer)}</strong><small>${e(item.customerId)} · ${e(item.industry)}</small></td><td>${item.current.length ? item.current.map(entry => e(entry.name)).join('、') : '<span class="u-t3">无当前归属</span>'}</td><td>${types.length ? types.map(type => F.badge(type, 'brand')).join(' ') : '—'}</td><td>${item.current.filter(entry => entry.lifecycle === 'active').length} 进行中 / ${item.current.filter(entry => entry.lifecycle === 'frozen').length} 冻结</td><td>${issues ? F.badge(issues + ' 项异常', 'amber') : F.badge('正常', 'green')}</td><td>${item.history.length}</td><td>${F.button('查看归属', 'ownership-detail', item.customerId)}</td></tr>`;
      });
      root.querySelector('[data-ownership-results]').innerHTML = F.table(['客户', '当前归属销售', '确权类型', '空间状态', '异常', '历史记录', '操作'], body, { caption: '客户归属分布与空间状态', emptyMessage: '没有符合条件的客户，请调整搜索或筛选条件。', countLabel: '个客户', totalCount: all.length, compact: true });
      renderDetail(rows.some(item => item.customerId === selected) ? selected : rows[0]?.customerId || '');
    }

    function renderDetail(customerId) {
      selected = customerId;
      const target = root.querySelector('[data-ownership-detail]');
      if (!target) return;
      const item = F.ownership().find(entry => entry.customerId === customerId);
      if (!item) { target.innerHTML = ''; return; }
      target.innerHTML = `<section class="fp-panel fp-pad fp-title"><div><h2>${e(item.customer)}</h2><p>${e(item.customerId)} · ${e(item.industry)}</p></div></section>${renderIssues(item)}<div class="fp-split fp-ownership-split">${renderCurrent(item)}${renderHistory(item)}</div>`;
    }

    F.bind(root, { 'ownership-detail': id => { renderDetail(id); root.querySelector('[data-ownership-detail]')?.scrollIntoView({ block: 'start' }); } });
    draw();
  };
})(window.SC, window.SC.FEATURES);
