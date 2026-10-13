/** 客户跟进空间列表与客户空间次级页：承载 R02 生命周期、内容就绪度、R03 内容装载、R04 六入口全景与溯源、R05 角色边界及方案页签。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  F.views['customer-spaces'] = function (root) {
    const snapshot = F.load();
    const spaces = F.visible();
    const pools = snapshot.pools;
    // R05 统一入口：先说明当前身份能读什么、能写什么；失权时给出拒绝结果与重新进入入口。
    const permission = F.permissionContext(snapshot);
    // R05 统一入口：面板头给身份与判定结果，一行给可读 / 可写范围；失权时给出拒绝结果与重新进入入口。
    const permissionPanel = permission.valid
      ? `<section class="fp-panel fp-permission" data-permission="granted">
          <header class="fp-panel-head fp-permission-head">
            <div><h2>当前权限结果</h2><p class="fp-hint">可见 ${permission.spaceCount} 个空间，其中 ${permission.frozenCount} 个已冻结只读；无权空间不会出现，也不提示是否存在。</p></div>
            <div class="fp-actions">${F.badge(permission.roleLabel, 'brand')}${F.badge('账号启用中', 'green')}<span class="u-t3">${e(permission.actor.name)} · ${e(permission.actor.id)}</span></div>
          </header>
          <div class="fp-permission-scope">
            <span class="fp-permission-term">可读</span><span data-permission-read>${e(permission.read)}</span>
            <span class="fp-permission-term">可写</span><span data-permission-write>${e(permission.write)}</span>
            ${F.role === 'SOL' ? `<span class="fp-permission-term">承接客户池</span><span>${permission.pools.length ? permission.pools.map(pool => F.badge(pool, 'brand')).join(' ') : F.badge('未配置，无空间可进', 'amber')}</span>` : ''}
          </div>
        </section>`
      : `<section class="fp-panel fp-pad fp-permission fp-callout--warn" data-permission="denied">
          <div class="fp-actions"><strong>访问被拒绝</strong>${F.badge('二次校验未通过', 'amber')}</div>
          <p class="u-mt2">${e(permission.reason || '当前会话权限已失效')}。本次读取不返回任何空间内容，也不提示空间是否存在。</p>
          <p class="fp-actions u-mt2"><a class="btn btn--primary" href="${F.link('customer-spaces')}">重新进入</a></p>
        </section>`;
    /**
     * 顶部指标：客户与空间数是规模口径，其余四张是可筛选口径，点击即把列表收敛到该状态，再次点击还原。
     * 指标与筛选器共用同一份过滤条件，避免出现「卡片数字和列表对不上」。
     */
    const readable = spaces.filter(w => w.readiness !== 'failed' && !['preparing', 'updating'].includes(w.readiness)).length;
    const metricCard = (label, value, detail, filter) => filter
      ? `<button type="button" class="fp-metric fp-metric--action" data-metric-filter="${e(filter[0])}" data-metric-value="${e(filter[1])}" aria-pressed="false"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></button>`
      : `<div class="fp-metric"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></div>`;
    const metricsBlock = `<div class="fp-metrics fp-space-metrics" data-space-metrics>
      ${metricCard('客户', new Set(spaces.map(w => w.customerId)).size, '按当前角色可见范围')}
      ${metricCard('跟进空间', spaces.length, '销售 × 客户 × 客户池')}
      ${metricCard('进行中', spaces.filter(w => w.state === 'active').length, `确权有效 · ${readable} 个内容可读`, ['status', 'active'])}
      ${metricCard('已冻结', spaces.filter(w => w.state === 'frozen').length, '历史内容保留只读', ['status', 'frozen'])}
      ${metricCard('内容更新中', spaces.filter(w => ['preparing', 'updating'].includes(w.readiness)).length, '上一版内容继续可读', ['readiness', 'updating'])}
      ${metricCard('内容失败', spaces.filter(w => w.readiness === 'failed').length, '可查看原因并重试', ['readiness', 'failed'])}
    </div>`;
    root.innerHTML = permissionPanel + metricsBlock + `
      <section class="fp-panel fp-directory fp-directory-panel">
        <header class="fp-panel-head fp-directory-head">
          <div class="fp-directory-heading">
            <h2 id="customer-space-list-title">客户空间</h2>
            <span class="fp-directory-count" data-result-count aria-live="polite" aria-atomic="true"></span>
          </div>
          <div class="fp-directory-head-actions">
            <button type="button" class="fp-directory-filter-toggle" data-filter-toggle aria-expanded="true" aria-controls="customer-space-filter">筛选条件</button>
            <span class="fp-directory-sync"><span aria-hidden="true"></span>CRM 已同步 · ${e(snapshot.crm?.lastSyncAt || '暂无')}</span>
          </div>
        </header>
        <form class="fp-directory-filter" id="customer-space-filter" data-search aria-label="客户空间筛选">
          <div class="fp-directory-search">
            <label class="fp-sr-only" for="customer-space-search">搜索客户名称或空间编号</label>
            ${SC.icon('search', 16)}
            <input id="customer-space-search" type="search" name="q" placeholder="搜索客户名称 / 空间编号" autocomplete="off">
            <button type="button" class="fp-directory-clear" data-clear-search aria-label="清空搜索" title="清空搜索" hidden>${SC.icon('close', 14)}</button>
          </div>
          <label class="fp-directory-select">
            <span class="fp-sr-only">客户池</span>
            <select name="pool" aria-label="客户池">
              <option value="">全部客户池</option>
              ${pools.map(pool => `<option value="${e(pool)}">${e(pool)}</option>`).join('')}
            </select>
          </label>
          <label class="fp-directory-select">
            <span class="fp-sr-only">空间状态</span>
            <select name="status" aria-label="空间状态">
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="frozen">已冻结</option>
            </select>
          </label>
          <label class="fp-directory-select">
            <span class="fp-sr-only">内容就绪度</span>
            <select name="readiness" aria-label="内容就绪度">
              <option value="">全部内容状态</option>
              <option value="ready">内容已就绪</option>
              <option value="updating">内容更新中</option>
              <option value="failed">内容更新失败</option>
            </select>
          </label>
          <div class="fp-directory-actions">
            <button class="btn fp-directory-reset" type="reset" disabled>${SC.icon('close', 14)}清除筛选</button>
          </div>
        </form>
        <div class="fp-directory-feedback" data-filter-feedback hidden>
          <div class="fp-directory-chips" data-filter-chips></div>
          <span data-filter-summary></span>
        </div>
        <div data-results></div>
      </section>`;

    const form = root.querySelector('[data-search]');
    const search = form.elements.q;
    const clearSearch = form.querySelector('[data-clear-search]');
    const reset = form.querySelector('[type=reset]');
    const feedback = root.querySelector('[data-filter-feedback]');
    const chips = root.querySelector('[data-filter-chips]');
    const summary = root.querySelector('[data-filter-summary]');
    const resultCount = root.querySelector('[data-result-count]');
    let activeFilters = { q: '', pool: '', status: '', readiness: '' };
    // 演示数据 9 个空间，按 5 条一页正好两页：分页行为在原型里可验收，而不是永远只有一页。
    const PAGE_SIZE = 5;
    let currentPage = 1;
    let searchTimer;
    let composing = false;
    const toggle = root.querySelector('[data-filter-toggle]');
    // jsdom 无 matchMedia：取不到就按桌面处理（筛选常驻），窄屏才默认收起。
    const isNarrow = () => !!window.matchMedia?.('(max-width: 760px)').matches;
    let filtersOpen = !isNarrow();

    const normalize = value => String(value || '').trim().toLocaleLowerCase('zh-CN');
    const readFilters = () => {
      const values = Object.fromEntries(new FormData(form));
      return { q: String(values.q || '').trim(), pool: String(values.pool || ''), status: String(values.status || ''), readiness: String(values.readiness || '') };
    };
    const hasFilters = filters => !!(filters.q || filters.pool || filters.status || filters.readiness);
    /** 内容就绪度的三态归并：与列表徽章口径一致（失败 / 更新中 / 其余视为就绪）。 */
    const readinessOf = space => space.readiness === 'failed' ? 'failed' : ['preparing', 'updating'].includes(space.readiness) ? 'updating' : 'ready';

    /** 分页条：与人员管理列表同一套交互语言（第 x / y 页 + 上一页 / 下一页）。 */
    function pagination(total, pageCount) {
      return `<nav class="fp-pagination" aria-label="客户空间列表分页">
        <span>第 ${currentPage} / ${pageCount} 页 · 共 ${total} 个空间</span>
        <div class="fp-actions">
          <button type="button" class="btn" data-action="space-page" data-value="prev" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <button type="button" class="btn" data-action="space-page" data-value="next" ${currentPage >= pageCount ? 'disabled' : ''}>下一页</button>
        </div>
      </nav>`;
    }

    /** 统一状态点和文案，避免仅依赖颜色表达空间状态。 */
    function spaceStatus(space) {
      const frozen = space.state === 'frozen';
      return `<span class="fp-space-status ${frozen ? 'is-frozen' : 'is-active'}"><span aria-hidden="true"></span>${frozen ? '已冻结 · 只读' : '进行中'}</span>`;
    }

    /** 生命周期和内容就绪度分别呈现，避免“冻结”掩盖内容处理中或失败。 */
    function lifecycleStatus(space) {
      const frozen = (space.lifecycle || space.state) === 'frozen';
      return `<span data-space-lifecycle="${frozen ? 'frozen' : 'active'}">${F.badge(frozen ? '已冻结 · 只读' : '进行中', frozen ? 'neutral' : 'green')}</span>`;
    }
    function readinessStatus(space) {
      const status = space.readiness === 'failed' ? 'failed' : ['preparing', 'updating'].includes(space.readiness) ? 'updating' : 'ready';
      const label = status === 'failed' ? '更新失败' : status === 'updating' ? '更新中' : '已就绪';
      const tone = status === 'failed' ? 'amber' : status === 'updating' ? 'brand' : 'green';
      return `<span data-space-readiness="${status}">${F.badge(label, tone)}${status === 'failed' ? '<small>可查看上一版</small>' : ''}</span>`;
    }
    function entitlementLabel(space) {
      const type = space.entitlementType || (space.ownerOnly ? 'customer_only' : space.opps?.length ? 'customer_and_opportunity' : 'customer_only');
      return type === 'customer_only' ? '客户级确权' : type === 'opportunity' ? '商机级确权' : type === 'none' ? '无当前确权' : '客户级 + 商机级';
    }
    function poolLabel(space) {
      return space.pool ? e(space.pool) : '<span class="u-t3">待补客户池</span>';
    }

    /** 客户目录使用独立列约束，避免公共表格样式影响其他功能页。 */
    function renderTable(rows) {
      const body = rows.length ? rows.map(space => {
        const href = F.link('followup-workbench', { space: space.id });
        return `<tr>
          <td class="fp-directory-customer" data-space-id="${e(space.id)}" headers="customer-space-col-customer"><span class="fp-directory-mobile-label" aria-hidden="true">客户 / 空间</span><a href="${href}">${e(space.customer)}</a><small>${e(space.id)} · ${e(space.industry)}</small></td>
          <td headers="customer-space-col-sales"><span class="fp-directory-mobile-label" aria-hidden="true">归属销售</span>${e(F.name(space.sales))}</td>
          <td headers="customer-space-col-pool"><span class="fp-directory-mobile-label" aria-hidden="true">客户池</span>${space.pool ? F.badge(space.pool, 'brand') : poolLabel(space)}</td>
          <td headers="customer-space-col-entitlement"><span class="fp-directory-mobile-label" aria-hidden="true">确权类型</span><span data-space-owner-type="${e(space.entitlementType || 'customer_only')}">${e(entitlementLabel(space))}</span></td>
          <td headers="customer-space-col-stage"><span class="fp-directory-mobile-label" aria-hidden="true">经营阶段</span>${e(space.stage)}</td>
          <td class="fp-directory-number" headers="customer-space-col-opportunity"><span class="fp-directory-mobile-label" aria-hidden="true">商机数</span><strong>${space.opps.length}</strong>${space.ownerOnly ? '<small>仅客户级确权</small>' : ''}</td>
          <td class="fp-directory-state" data-space-lifecycle="${e(space.state)}" headers="customer-space-col-state"><span class="fp-directory-mobile-label" aria-hidden="true">生命周期</span>${lifecycleStatus(space)}</td>
          <td class="fp-directory-state" data-space-readiness="${e(space.readiness === 'failed' ? 'failed' : ['preparing', 'updating'].includes(space.readiness) ? 'updating' : 'ready')}" headers="customer-space-col-readiness"><span class="fp-directory-mobile-label" aria-hidden="true">内容就绪度</span>${readinessStatus(space)}</td>
          <td class="fp-directory-operation" headers="customer-space-col-action"><span class="fp-directory-mobile-label" aria-hidden="true">操作</span><a class="fp-row-action" href="${href}" aria-label="查看 ${e(space.customer)} 的客户空间">查看${SC.icon('chevron', 14)}</a></td>
        </tr>`;
      }).join('') : `<tr class="is-empty"><td colspan="9">${F.empty(hasFilters(activeFilters) ? '未找到匹配的客户空间，请清除或调整筛选条件。' : '当前身份暂无可见客户空间。', hasFilters(activeFilters) ? '未找到客户空间' : '暂无客户空间')}</td></tr>`;
      return `<div class="fp-table-wrap fp-directory-table-wrap" tabindex="0" role="region" aria-labelledby="customer-space-list-title">
        <table class="fp-table fp-directory-table">
          <caption class="fp-sr-only">客户空间筛选结果</caption>
          <colgroup><col class="is-customer"><col class="is-sales"><col class="is-pool"><col class="is-entitlement"><col class="is-stage"><col class="is-opportunity"><col class="is-state"><col class="is-readiness"><col class="is-action"></colgroup>
          <thead><tr><th id="customer-space-col-customer" scope="col">客户 / 空间</th><th id="customer-space-col-sales" scope="col">归属销售</th><th id="customer-space-col-pool" scope="col">客户池</th><th id="customer-space-col-entitlement" scope="col">确权类型</th><th id="customer-space-col-stage" scope="col">经营阶段</th><th id="customer-space-col-opportunity" scope="col" class="fp-directory-number">商机数</th><th id="customer-space-col-state" scope="col" class="fp-directory-state">生命周期</th><th id="customer-space-col-readiness" scope="col" class="fp-directory-state">内容就绪度</th><th id="customer-space-col-action" scope="col" class="fp-directory-operation">操作</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    }

    /** 同步结果数、筛选标签和清除按钮状态，使筛选结果始终可感知。 */
    function syncFilterState(rows) {
      const statusLabel = activeFilters.status === 'active' ? '进行中' : activeFilters.status === 'frozen' ? '已冻结' : '';
      const readinessLabel = { ready: '内容已就绪', updating: '内容更新中', failed: '内容更新失败' }[activeFilters.readiness] || '';
      const items = [
        activeFilters.q && ['q', `关键词：${activeFilters.q}`],
        activeFilters.pool && ['pool', `客户池：${activeFilters.pool}`],
        statusLabel && ['status', `状态：${statusLabel}`],
        readinessLabel && ['readiness', `内容：${readinessLabel}`]
      ].filter(Boolean);
      syncMetricState();
      syncFilterToggle();
      chips.innerHTML = items.map(([name, label]) => `<button type="button" class="fp-filter-chip" data-remove-filter="${name}" aria-label="移除筛选条件：${e(label)}" title="${e(label)}"><span>${e(label)}</span>${SC.icon('close', 12)}</button>`).join('');
      feedback.hidden = items.length === 0;
      summary.textContent = items.length ? `已筛选 ${rows.length} / ${spaces.length}` : '';
      const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      resultCount.textContent = pageCount > 1 ? `${rows.length} 个空间 · 第 ${Math.min(currentPage, pageCount)} / ${pageCount} 页` : `${rows.length} 个空间`;
      reset.disabled = items.length === 0;
      clearSearch.hidden = !search.value.trim();
    }

    function draw(nextFilters = activeFilters) {
      activeFilters = { q: String(nextFilters.q || '').trim(), pool: String(nextFilters.pool || ''), status: String(nextFilters.status || ''), readiness: String(nextFilters.readiness || '') };
      const keyword = normalize(activeFilters.q);
      const rows = spaces.filter(space => {
        const searchable = normalize(`${space.customer} ${space.id}`);
        return (!keyword || searchable.includes(keyword))
          && (!activeFilters.pool || space.pool === activeFilters.pool)
          && (!activeFilters.status || space.state === activeFilters.status)
          && (!activeFilters.readiness || readinessOf(space) === activeFilters.readiness);
      });
      const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, currentPage), pageCount);
      const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
      root.querySelector('[data-results]').innerHTML = renderTable(pageRows) + (rows.length ? pagination(rows.length, pageCount) : '');
      syncFilterState(rows);
    }

    /** 筛选区开合：窄屏默认收起，一旦有生效条件就自动展开，保证条件下可见可撤。 */
    function syncFilterToggle() {
      const open = filtersOpen || hasFilters(activeFilters);
      form.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '收起筛选' : '筛选条件';
      const count = [activeFilters.q, activeFilters.pool, activeFilters.status, activeFilters.readiness].filter(Boolean).length;
      toggle.classList.toggle('is-active', count > 0);
      toggle.dataset.filterCount = count ? String(count) : '';
    }

    /** 指标卡与筛选器双向同步：卡片按下态只反映当前生效的筛选条件。 */
    function syncMetricState() {
      root.querySelectorAll('[data-metric-filter]').forEach(card => {
        const active = activeFilters[card.dataset.metricFilter] === card.dataset.metricValue;
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-pressed', String(active));
      });
    }

    const applyFilters = () => {
      clearTimeout(searchTimer);
      const filters = readFilters();
      search.value = filters.q;
      currentPage = 1;
      draw(filters);
    };
    const scheduleSearch = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 300);
    };

    form.addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
    form.addEventListener('change', event => { if (event.target.matches('select')) applyFilters(); });
    form.addEventListener('reset', event => {
      event.preventDefault();
      clearTimeout(searchTimer);
      composing = false;
      form.querySelectorAll('input').forEach(field => { field.value = ''; });
      form.querySelectorAll('select').forEach(field => { field.selectedIndex = 0; });
      draw({});
      SC.toast('已清除全部筛选条件。', 'ok');
      search.focus();
    });
    search.addEventListener('input', event => {
      clearSearch.hidden = !search.value.trim();
      if (!composing && !event.isComposing) scheduleSearch();
    });
    search.addEventListener('compositionstart', () => { composing = true; clearTimeout(searchTimer); });
    search.addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
    search.addEventListener('keydown', event => {
      if (composing || event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); applyFilters(); }
      if (event.key === 'Escape' && search.value) { event.preventDefault(); search.value = ''; applyFilters(); }
    });
    clearSearch.addEventListener('click', () => { composing = false; search.value = ''; applyFilters(); search.focus(); });
    toggle.addEventListener('click', () => { filtersOpen = !filtersOpen; syncFilterToggle(); if (!form.hidden) search.focus(); });
    // 翻页只改页码并重画列表：筛选条件与指标卡选中态保持不动。
    root.addEventListener('click', event => {
      const trigger = event.target.closest('[data-action="space-page"]');
      if (!trigger || trigger.disabled) return;
      currentPage += trigger.dataset.value === 'next' ? 1 : -1;
      draw(activeFilters);
      root.querySelector('[data-results]')?.scrollIntoView?.({ block: 'nearest' });
    });
    chips.addEventListener('click', event => {
      const chip = event.target.closest('[data-remove-filter]');
      if (!chip) return;
      form.elements[chip.dataset.removeFilter].value = '';
      applyFilters();
      if (chip.dataset.removeFilter === 'q') search.focus();
    });

    // 指标卡点击即筛选：同一张卡再次点击取消该条件，表单与筛选标签同步刷新。
    root.querySelector('[data-space-metrics]')?.addEventListener('click', event => {
      const card = event.target.closest('[data-metric-filter]');
      if (!card) return;
      const name = card.dataset.metricFilter;
      const value = card.dataset.metricValue;
      const next = { ...readFilters(), [name]: activeFilters[name] === value ? '' : value };
      if (form.elements[name]) form.elements[name].value = next[name];
      draw(next);
      // 窄屏筛选区展开后会占满一屏，筛选结果必须滚进视野，否则点了卡片看不到变化。
      root.querySelector('[data-results]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      if (next[name]) SC.toast(`已筛选：${card.querySelector('span').textContent.trim()} ${card.querySelector('strong').textContent.trim()} 个空间。`, 'ok');
    });

    draw();
  };

  /**
   * 客户空间次级页（六入口）：概览为默认入口，客户、商机、跟进、资料、历史毛利为明细入口。
   * 0921 版面（与移动端口径对齐）：吸顶 chrome 承载状态角标、写入口与更新铃铛（红点=有新结果可看，打开更新抽屉即已读）；
   * 概览为 当月毛利 → 指标条 → 一句话判断 → 经营焦点 → 客户事实 → 低频板块折叠 的固定次序，常显区不放更新内容；
   * 更新历史收进更新抽屉（与跟进 Tab 同源、倒序全量、不另建独立历史）；空间助手为悬浮入口 + 抽屉，六个 Tab 均可唤出；
   * 右侧栏只留「下一步任务 / 客户档案」两个未在别处承载的内容，不再重复展示空间动态。
   * 页面契约（回归测试依赖）：data-tab 六入口、data-subtab 跟进子页签（跟进记录/行为记录/方案往来/录音）、data-overview-panel 十板块、
   * data-overview-metrics 指标条、data-open-updates / data-updates-status / data-update-history / data-history-node 更新流、
   * data-change-latest 更新抽屉内最近一次变化、data-space-lifecycle / data-space-readiness 双状态轴、
   * data-scope-layer 六层装载状态、data-co-followers 同跟名单、data-behavior-* 行为记录、
    * data-open-assistant 悬浮入口、data-space-qa / data-qa-welcome / data-qa-item / data-qa-user / data-qa-field / data-qa-send / data-qa-note / data-qa-cite / data-qa-frozen 空间助手对话。
   */
  F.views['followup-workbench'] = function (root) {
    let spaceId = SC.param('space') || F.visible()[0]?.id;
    // 六个空间入口固定为概览、客户、商机、跟进、资料、历史毛利；跟进内再分跟进记录、行为记录、方案往来、录音。
    const entries = [['overview', '概览'], ['customer', '客户'], ['opps', '商机'], ['followup', '跟进'], ['documents', '资料'], ['profit', '历史毛利']];
    let profitMonth = SC.param('month') || F.financeMonth(-1);
    const subEntries = [['followups', '跟进记录'], ['behaviors', '行为记录'], ['solutions', '方案往来'], ['recordings', '录音']];
    // 旧链接（tab=followups / behaviors / solutions / recordings）仍然可用，落到跟进下对应的子页签；客户画像已并入客户入口。
    const aliases = { followups: ['followup', 'followups'], behaviors: ['followup', 'behaviors'], solutions: ['followup', 'solutions'], recordings: ['followup', 'recordings'], profile: ['customer'] };
    const requested = SC.param('tab') || 'overview';
    let [tab, sub] = aliases[requested] || [requested, SC.param('sub') || 'followups'];
    if (!entries.some(([key]) => key === tab)) tab = 'overview';
    if (!subEntries.some(([key]) => key === sub)) sub = 'followups';
    let behaviorQuery = {};
    const readinessMeta = space => {
      const status = space.readiness === 'failed' ? 'failed' : ['preparing', 'updating'].includes(space.readiness) ? 'updating' : 'ready';
      return { status, label: status === 'failed' ? '更新失败' : status === 'updating' ? '更新中' : '已就绪', tone: status === 'failed' ? 'amber' : status === 'updating' ? 'brand' : 'green' };
    };
    const entitlementText = space => {
      const type = space.entitlementType || (space.ownerOnly ? 'customer_only' : space.opps?.length ? 'customer_and_opportunity' : 'customer_only');
      return type === 'customer_only' ? '客户级确权' : type === 'opportunity' ? '商机级确权' : type === 'none' ? '无当前确权' : '客户级 + 商机级';
    };
    function openLifecycle(space) {
      const events = Array.isArray(space.lifecycleEvents) ? space.lifecycleEvents : [];
      F.drawer('空间生命周期 · ' + space.id, `<div class="fp-stack"><div class="fp-callout">生命周期回答“空间是否还能新增工作”；内容就绪度回答“当前内容是否已准备好”。两条状态独立记录。</div><div class="fp-timeline" data-space-history>${events.map(event => `<article class="fp-event" data-space-event="${e(event.type)}"><div class="fp-actions"><strong>${e({ created: '空间建立', frozen: '空间冻结', unfrozen: '空间解冻', opportunity_removed: '商机确权移除', entitlement_added: '确权补建', content_retry: '内容重试' }[event.type] || event.type)}</strong>${F.badge(event.result === 'success' || event.result === 'kept_active' ? '已完成' : '处理中', event.result === 'success' || event.result === 'kept_active' ? 'green' : 'amber')}</div><p>${e(event.reason || '状态发生变化')}</p><small>${e(event.at || '')}${event.batchId ? ` · ${e(event.batchId)}` : ''}</small></article>`).join('') || '<p class="u-t3">暂无生命周期事件。</p>'}</div></div>`);
    }

    /**
     * 录音内容抽屉：空间侧所有指向录音的入口（录音区、变化依据、行为记录依据、更新历史节点）
     * 统一落到这里，展示与移动端相同的「智能总结 / 录音原文」两栏，不再只给一段原文。
     */
    function openRecording(recordingId) {
      const recording = F.recording(recordingId);
      if (!recording) { SC.toast('该录音已不在当前可见范围。', 'bad'); return; }
      const syncMeta = F.recordingSyncMeta[recording.syncStatus] || ['已同步', 'green'];
      const placements = F.spacePlacements(spaceId).filter(item => item.recording === recording.id);
      const head = `<div class="fp-actions">${F.badge(syncMeta[0], syncMeta[1])}${F.badge(recording.source || '三方录音服务', 'neutral')}<span class="u-t3">${e(recording.duration)} · ${e(recording.date)} · ${e(recording.ownerResolved === false ? '归属待处理' : F.name(recording.owner))}</span></div>`;
      const foot = `<dl class="fp-kv"><dt>录音编号</dt><dd>${e(recording.id)}</dd><dt>同步来源</dt><dd>${e(recording.source || '三方录音服务')}</dd><dt>本空间归位</dt><dd>${placements.length ? e(placements.map(item => F.placementStatusMeta[item.status]?.[0] || '处理中').join(' · ')) : '尚未归位'}</dd></dl><p class="fp-hint">智能总结与录音原文都由得到笔记（三方录音服务）同步提供，三方已完成转写；客户事实更新另见本次变化与行为记录。</p>`;
      F.drawer(recording.title, `<div class="fp-stack" data-recording-drawer="${e(recording.id)}">${head}${F.recordingContent(recording)}${foot}</div>`, mask => F.bindRecordingContent(mask));
    }

    /** 结论或变化点回原文；录音来源走录音内容两栏，其余来源保留原文抽屉。 */
    function openSource(ref) {
      const type = String(ref).split(':')[0];
      if (type === 'meeting') { openRecording(String(ref).split(':')[1]); return; }
      const record = F.sourceRecord(ref);
      if (!record) { SC.toast('该来源已不在当前可见范围。', 'bad'); return; }
      const body = record.available
        ? `<div class="fp-callout" data-source-body>${e(record.body || '原文暂无正文。')}</div>`
        : `<div class="fp-callout fp-callout--warn" data-source-unavailable><strong>来源不可用：</strong>${e(record.unavailableReason || '原文已不可读。')}</div>`;
      F.drawer('来源原文 · ' + record.title, `<div class="fp-stack"><div class="fp-actions">${F.badge(record.available ? '来源可用' : '来源失效', record.available ? 'green' : 'amber')}<span class="u-t3">${e(record.at || '')}</span></div>${body}<dl class="fp-kv"><dt>来源类型</dt><dd>${e(record.title.split(' · ')[0])}</dd><dt>记录人</dt><dd>${e(record.author || '—')}</dd><dt>时间</dt><dd>${e(record.at || '—')}</dd></dl></div>`);
    }

    /** 来源标签统一渲染为可点击依据入口；失效来源不可点击但保留标识。 */
    function sourceChips(sources) {
      if (!sources.length) return '<span class="u-t3">无原文依据，不输出结论。</span>';
      return `<div class="fp-source-chips">${sources.map(item => item.available === false
        ? `<span class="fp-source-chip is-broken" data-source-broken title="${e(item.unavailableReason || '来源不可用')}">${e(item.label)} · 已失效</span>`
        : `<button type="button" class="fp-source-chip" data-action="source" data-value="${e(item.type + ':' + item.id)}">${e(item.label)}</button>`).join('')}</div>`;
    }

    /**
     * R15 行为记录详情：五段内容与事件依据；失败 / 无可用内容 / 处理中各有明确口径。
     * 不展示客户事实改写，也不呈现分数；行为评价不写入客户事实。
     */
    function openBehavior(id) {
      const record = F.behaviorsOf(spaceId).find(item => item.id === id);
      if (!record) { SC.toast('该行为记录不在当前可见范围。', 'bad'); return; }
      const [label, tone] = F.behaviorStatusMeta[record.status] || ['处理中', 'brand'];
      const section = (title, items) => `<section class="fp-panel fp-pad"><h3>${e(title)}</h3>${items.length ? `<ul class="fp-compact-list">${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '<p class="u-t3">暂无</p>'}</section>`;
      const statusBody = record.status === 'failed'
        ? `<div class="fp-callout fp-callout--warn">生成失败：${e(record.failReason || '未知原因')}。不写入占位记录，可稍后刷新查看最新状态。</div>`
        : record.status === 'empty'
          ? `<div class="fp-callout">${e(record.note || '无可用内容，未做归纳。')}</div>`
          : record.status === 'processing'
            ? '<div class="fp-callout">正在结合本次事件归纳，稍后可刷新查看；处理中记录不进入晚间日报。</div>'
            : '';
      // 录音事件的依据是转写原文（sourceRef 指向录音），eventId 指向的是归位记录。
      const sourceId = record.eventType === 'meeting' ? record.sourceRef : record.eventId;
      const sources = ['followup', 'meeting'].includes(record.eventType) && sourceId
        ? [{ type: record.eventType, id: sourceId, label: `${F.behaviorEventLabels[record.eventType]} · ${sourceId}`, at: record.eventAt, available: true }] : [];
      F.drawer('行为记录 · ' + record.id, `<div class="fp-stack" data-behavior-detail><div class="fp-actions">${F.badge(label, tone)}${F.badge(record.kind, 'neutral')}${F.badge(F.behaviorEventLabels[record.eventType] || record.eventType, 'brand')}</div><dl class="fp-kv"><dt>关联事件</dt><dd>${e(record.eventId)}</dd><dt>事件时间</dt><dd>${e(record.eventAt)}</dd><dt>生成时间</dt><dd>${e(record.createdAt)}</dd>${record.completedAt ? `<dt>完成时间</dt><dd>${e(record.completedAt)}</dd>` : ''}</dl>${statusBody}${record.status === 'done' ? section('沟通摘要', record.summary ? [record.summary] : []) + section('关键行为', record.keyBehaviors) + section('问题或风险', record.issues) + section('改进方向', record.improvements) + section('下次补问', record.nextQuestions) : ''}${sources.length ? `<section class="fp-panel fp-pad"><h3>依据</h3>${sourceChips(sources)}</section>` : ''}<p class="fp-hint">行为记录与客户事实分开存放；晚间日报只读取已完成记录。</p></div>`, mask => F.bind(mask, { source: ref => openSource(ref) }));
    }

    const changeStatusMeta = { done: ['已完成', 'green'], processing: ['处理中', 'brand'], failed: ['更新失败', 'amber'], nochange: ['无变化', 'neutral'] };

    /** 本次变化：新增、前后对比、待确认、冲突、无变化和处理中都各自成立，不用整体成功覆盖。 */
    function changeCard(change, space) {
      const [label, tone] = changeStatusMeta[change.status] || ['处理中', 'brand'];
      const conflicts = (space.conflicts || []).filter(() => change.status === 'done');
      const body = change.status === 'processing'
        ? `<p>正在结合空间已有上下文更新，${space.lastReadableVersion ? `上一版 ${e(space.lastReadableVersion)} 继续可读。` : '完成前保留上一版内容。'}</p>`
        : change.status === 'failed'
          ? `<p>${e(change.reason || '概览更新失败，原文仍保留在资料 Tab。')}</p><p class="fp-hint">失败只提醒运营，不打扰销售；原内容未被覆盖。</p>`
          : change.status === 'nochange'
            ? '<p>本次输入未带来客户信息变化，只更新了页面状态，未发送完成提醒。</p>'
            : `${change.added.length ? `<div data-change-added><strong>新增</strong><ul>${change.added.map(item => `<li>${e(item)}</li>`).join('')}</ul></div>` : ''}
               ${change.updated.length ? `<div data-change-updated><strong>更新前后对比</strong><ul>${change.updated.map(item => `<li>${e(item.field)}：<del>${e(item.before)}</del> → <ins>${e(item.after)}</ins></li>`).join('')}</ul></div>` : ''}
               ${change.pendingConfirm.length ? `<div data-change-pending><strong>待确认</strong><ul>${change.pendingConfirm.map(item => `<li>${e(item)}</li>`).join('')}</ul></div>` : ''}
               ${conflicts.length ? conflicts.map(item => `<div data-change-conflict><strong>信息冲突：${e(item.field)}</strong><p>采用「${e(item.resolved)}」。${e(item.reason)}</p>${sourceChips(item.values.map(v => ({ type: v.source.split(':')[0], id: v.source.split(':')[1], label: v.text, at: v.at, available: true })))}</div>`).join('') : ''}
               ${!change.added.length && !change.updated.length && !change.pendingConfirm.length ? '<p>本次更新没有可展示的差异。</p>' : ''}`;
      return `<article class="fp-change" data-space-change="${e(change.status)}"><div class="fp-actions"><strong>${e(change.sourceLabel)}</strong>${F.badge(label, tone)}<span class="u-t3">${e(change.at)}</span></div>${body}<small class="fp-sub">起始版本 ${e(change.baseVersion || '—')}${change.resultVersion ? ` → ${e(change.resultVersion)}` : ''}</small></article>`;
    }

    /** 指标条：从空间既有数据派生的可比数值，只展示当前值与口径脚注，不做新旧对比；位于概览最上方（M02-3 §4.4，与移动端同口径同源）。 */
    function metricStrip(w, state) {
      const followupCount = state.followups.filter(item => item.space === w.id).length + F.weeklyReviewsOf(w.id, state).length;
      const placements = F.spacePlacements(w.id, state).length;
      const docs = state.documents.filter(item => item.space === w.id && item.status === 'success').length;
      const pending = [...new Set([...(w.pendingConfirm || []), ...state.spaceChanges.filter(c => c.space === w.id).flatMap(c => c.pendingConfirm || [])])].length;
      const amount = (w.opps || []).reduce((sum, opp) => sum + (Number(opp.amount) || 0), 0);
      const metrics = [
        [amount || '—', '商机金额 · 万元', `已确权商机 ${(w.opps || []).length} 个`],
        [followupCount, '跟进 · 次', '含周复盘，按提交计'],
        [placements, '归位录音 · 份', '已归位到本空间'],
        [docs, '外部资料 · 份', '已成功挂载'],
        [pending, '待确认 · 项', '含历史遗留']
      ];
      return `<section class="fp-metricstrip" data-overview-metrics>${metrics.map(([value, label, hint]) => `<div class="fp-metricstrip-item" data-metric><strong>${e(String(value))}</strong><span>${e(label)}</span><small>${e(hint)}</small></div>`).join('')}</section>`;
    }

    /** 带来可见变化的一次完成结果：新增、前后对比或待确认任一非空。 */
    const hasVisibleChange = item => !!(item && item.status === 'done' && (item.added.length || item.updated.length || item.pendingConfirm.length));

    /** 变化摘要：受影响字段 + 新增/更新/待确认计数；时间线节点不用来源摘要代替。 */
    function changeSummaryText(item) {
      const fields = [...new Set((item.updated || []).map(entry => entry.field))];
      return `受影响：${fields.length ? `${fields.join('、')} · ` : ''}新增 ${item.added.length} · 更新 ${item.updated.length} · 待确认 ${item.pendingConfirm.length}`;
    }

    /** 单次变化详情抽屉：更新面板节点、录音归位与消息中心深链共用同一入口。 */
    function openChangeDetail(id) {
      const space = F.space(spaceId);
      const change = space && F.changesOf(spaceId).find(item => item.id === id);
      if (!change) { SC.toast('该次变化不在当前可见范围。', 'bad'); return; }
      F.drawer('本次变化详情 · ' + change.id, `<div class="fp-stack" data-change-detail>${changeCard(change, space)}</div>`, mask => F.bind(mask, { source: ref => openSource(ref) }));
    }

    /**
     * 更新抽屉内容：顶部最近一次变化（完整卡片），下方与跟进 Tab 同源的全量倒序事件流。
     * 由 chrome 右上角更新入口（图标 + 红点）唤出；概览常显区与右侧栏不再放更新内容（M02-3 §4.2-4.3，0921 口径）。
     */
    function updatesBodyHtml(w, state) {
      const history = F.updateHistory(w.id, state);
      const processing = history.filter(item => item.status === 'processing');
      const latestChanged = history.find(hasVisibleChange);
      const latest = history[0];
      let statusHtml;
      if (latestChanged) {
        statusHtml = `<div class="fp-updates-latest" data-updates-status="changed" data-change-latest>${changeCard(latestChanged, w)}</div>`;
      } else if (latest && latest.status === 'failed') {
        statusHtml = `<div class="fp-callout fp-callout--warn" data-updates-status="failed"><strong>更新未完成：</strong>${e(latest.reason || '本次更新未完成，原内容保留。')}<small class="fp-sub">${e(latest.sourceLabel)} · ${e(latest.at)} · 当前展示上一版（${e(w.overviewUpdatedAt || '时间未记录')}）</small></div>`;
      } else if (processing.length && !history.some(item => item.status === 'done' || item.status === 'nochange')) {
        statusHtml = '<div class="fp-callout" data-updates-status="processing">客户信息正在更新，当前展示上一版内容。</div>';
      } else if (latest) {
        statusHtml = `<p class="fp-hint" data-updates-status="idle">最后更新 ${e(latest.at)} · ${latest.status === 'nochange' ? '最近一次处理未发现变化 · ' : ''}共 ${history.length} 次更新</p>`;
      } else {
        statusHtml = `<div class="fp-empty fp-empty--slim" data-updates-status="empty"><h3>暂无内容更新记录</h3><p>跟进、周复盘、录音归位与外部资料带来的变化，会按时间倒序留痕在这里。</p></div>`;
      }
      // 最近一次有变化之外的补充状况一句话带过，不另起模块。
      const extra = [
        latestChanged && processing.length ? `另有 ${processing.length} 项内容正在更新` : '',
        latestChanged && latest && latest.status === 'nochange' ? `最近处理 ${latest.at} · 未发现变化` : '',
        latestChanged && latest && latest.status === 'failed' ? `最近一次 ${latest.sourceLabel} 更新失败，原内容保留` : ''
      ].filter(Boolean);
      const sourceType = { followup: '跟进记录', weekly_review: '周复盘', meeting: '客户录音', document: '外部资料', solution: '方案往来' };
      const node = item => {
        const [label, tone] = changeStatusMeta[item.status] || ['处理中', 'brand'];
        const body = item.status === 'processing'
          ? '<p class="u-t3">正在更新，完成后展示本次变化。</p>'
          : item.status === 'failed'
            ? `<p>${e(item.reason || '本次更新未完成，原内容保留。')}</p>`
            : item.status === 'nochange'
              ? '<p>处理完成，本次未发现客户信息变化。</p>'
              : `<p>${e(changeSummaryText(item))}</p>`;
        const actions = [
          item.sourceRef && ['followup', 'meeting', 'document', 'solution'].includes(item.source) ? F.button('查看原文', 'source', `${item.source}:${item.sourceRef}`) : '',
          hasVisibleChange(item) ? F.button('查看本次变化', 'change-open', item.id) : ''
        ].filter(Boolean).join('');
        return `<article class="fp-event fp-upnode" data-history-node="${e(item.id)}" data-node-status="${e(item.status)}">
          <div class="fp-actions"><strong>${e(item.sourceLabel)}</strong>${F.badge(label, tone)}</div>
          <small class="fp-upnode-meta">${e(item.at)} · ${e(sourceType[item.source] || '内容进入')}</small>
          ${body}
          ${actions ? `<div class="fp-actions">${actions}</div>` : ''}
        </article>`;
      };
      return `${statusHtml}
        ${extra.length ? `<p class="fp-hint">${e(extra.join('；'))}</p>` : ''}
        ${history.length ? `<div class="fp-updates-history" data-update-history><div class="fp-section-head"><h3>更新历史 · 共 ${history.length} 次</h3><span class="u-t3">与跟进记录同源，倒序全量保留</span></div><div class="fp-timeline">${history.map(node).join('')}</div></div>` : ''}`;
    }

    /* 已读变化集合：红点只表达「有新结果可看」，打开更新抽屉即视为已读（M05-1 §4.2）。 */
    const READ_KEY = 'sc-v02-space-read-changes';
    const readChanges = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (error) { return new Set(); } };
    const markChangeRead = id => { const set = readChanges(); set.add(id); try { localStorage.setItem(READ_KEY, JSON.stringify([...set])); } catch (error) { /* 本地存储不可用时红点保持常亮，不影响阅读 */ } };

    function openUpdates() {
      const w = F.space(spaceId);
      if (!w) return;
      const latestChanged = F.updateHistory(w.id).find(hasVisibleChange);
      F.drawer('空间更新 · ' + w.customer, `<div class="fp-stack" data-updates-panel>${updatesBodyHtml(w, F.load())}</div>`, mask => F.bind(mask, { source: ref => openSource(ref), 'change-open': id => openChangeDetail(id) }));
      if (latestChanged) markChangeRead(latestChanged.id);
      const bell = root.querySelector('[data-open-updates]');
      if (bell) { bell.classList.remove('has-unread'); bell.setAttribute('aria-label', '空间更新'); }
    }
    /* ---------- 空间助手：与移动端空间助手同一套对话逻辑 ---------- */

    /** 依据脚注：与移动端一致，答案不再挂溯源胶囊，改为可点的 〔n〕。 */
    const citeHtml = (sources) => (sources || []).map((source, i) => {
      const ref = source.type + ':' + source.id;
      return source.available === false
        ? `<button type="button" class="fp-cite" data-qa-cite-broken="${e(source.label)}" title="来源已失效">〔${i + 1}〕</button>`
        : `<button type="button" class="fp-cite" data-qa-cite="${e(ref)}" title="${e(source.label)}">〔${i + 1}〕</button>`;
    }).join('');

    /** 消息操作：复制始终可用，重新生成只给最后一条答案（与移动端同规则）。 */
    const chatActsHtml = (qaId, isLast) => `<div class="fp-chat-acts"><button type="button" class="fp-chat-act" data-action="qa-copy" data-value="${e(qaId)}">复制</button>${isLast ? `<button type="button" class="fp-chat-act" data-action="qa-regen" data-value="${e(qaId)}">重新生成</button>` : ''}</div>`;

    /** 一条问答＝两条条目：用户批注 + 助手答案；时间栏取提问时刻。 */
    function chatEntryHtml(item, isLast) {
      const time = String(item.at || '').slice(11, 16);
      return `<article class="fp-chat-entry fp-chat-entry--user" data-qa-user="${e(item.id)}" data-qa-id="${e(item.id)}"><span class="fp-chat-time">${e(time)}</span><div class="fp-chat-main"><div class="fp-chat-bubble">${e(item.question)}</div></div></article>
        <article class="fp-chat-entry" data-qa-item="${item.hasEvidence ? 'answered' : 'no-evidence'}" data-qa-id="${e(item.id)}"><span class="fp-chat-time">${e(time)}</span><div class="fp-chat-main"><div class="fp-chat-answer" data-qa-answer>${e(item.answer)}${citeHtml(item.sources)}</div>${chatActsHtml(item.id, isLast)}</div></article>`;
    }

    /** 空会话引导区：只在没有历史且空间未冻结时出现，文案与移动端一致。 */
    const chatWelcomeHtml = () => `<div class="fp-chat-welcome" data-qa-welcome>
      <p class="fp-chat-eyebrow">空间助手</p><h3>只围绕这个空间作答</h3>
      <p class="fp-chat-sub">答案只来自当前客户空间你有权查看的内容与原文依据；没有依据时如实说明，不推测。</p>
      <div class="fp-chat-chips" data-qa-presets>${F.quickQuestions.map(([, label]) => `<button type="button" class="fp-chat-chip" data-action="ask" data-value="${e(label)}">${e(label)}</button>`).join('')}</div>
    </div>`;

    /** 对话区：历史按时间正序（最早的在上、最新的在下），冻结空间只读且不出现任何提问入口。 */
    function chatBodyHtml(w, state) {
      const frozen = (w.lifecycle || w.state) === 'frozen';
      const qa = (state.spaceQA || []).filter(item => item.space === w.id).slice().reverse();
      const entries = qa.map((item, index) => chatEntryHtml(item, index === qa.length - 1)).join('');
      return `${frozen ? '<p class="fp-chat-notice" data-qa-frozen>空间已冻结，不开放新问答；以下为历史对话，只读。</p>' : ''}
        ${qa.length ? entries : frozen ? '<p class="u-t3">暂无历史对话。</p>' : chatWelcomeHtml()}`;
    }

    /** 输入区：与移动端同规格——自增高输入框 + 发送/停止切换 + 口径说明。 */
    const composerHtml = () => `<footer class="fp-composer">
      <div class="fp-composer-row"><textarea class="fp-composer-field" data-qa-field rows="1" placeholder="向空间助手提问" aria-label="向空间助手提问"></textarea><button type="button" class="fp-composer-send" data-qa-send data-state="send" aria-label="发送">${SC.icon('arrow-right', 16)}</button></div>
      <p class="fp-composer-note" data-qa-note>助手只读取当前空间你有权查看的内容作答</p>
    </footer>`;

    /**
     * 助手抽屉：五个 Tab 都可从悬浮入口唤出，对话在抽屉内原地推进（不重画、不关抽屉）。
     * 发送 → 骨架屏 → 流式答案 → 依据脚注；发送键在作答中切换为停止。
     * window.FN_FAST 时跳过等待与流式，直接出结果（回归用）。
     */
    function openAssistant() {
      const w = F.space(spaceId);
      if (!w) return;
      const frozen = (w.lifecycle || w.state) === 'frozen';
      F.drawer('空间助手 · ' + w.customer, '<div class="fp-chat-shell" data-assistant-root></div>', (mask, close) => {
        mask.querySelector('.fp-drawer').classList.add('fp-drawer--chat');
        const root = mask.querySelector('[data-assistant-root]');
        const box = () => root.querySelector('[data-space-qa]');
        const field = () => root.querySelector('[data-qa-field]');
        const sendBtn = () => root.querySelector('[data-qa-send]');
        const noteEl = () => root.querySelector('[data-qa-note]');
        const scrollEnd = () => { const node = box(); if (node) node.scrollTop = node.scrollHeight; };
        const autoGrow = () => { const node = field(); if (!node) return; node.style.height = 'auto'; node.style.height = Math.min(node.scrollHeight, 132) + 'px'; };
        const setComposer = state => {
          const button = sendBtn();
          if (!button) return;
          button.dataset.state = state;
          button.innerHTML = SC.icon(state === 'stop' ? 'stop' : 'arrow-right', 16);
          button.setAttribute('aria-label', state === 'stop' ? '停止生成' : '发送');
          const note = noteEl();
          if (note) note.textContent = state === 'stop' ? '正在作答… 点击右侧按钮可停止' : '助手只读取当前空间你有权查看的内容作答';
        };
        let streaming = null;

        function send(question) {
          const text = String(question || '').trim();
          const target = box();
          if (!text || streaming || !target || frozen) return;
          target.querySelector('[data-qa-welcome]')?.remove();
          target.insertAdjacentHTML('beforeend', `<article class="fp-chat-entry fp-chat-entry--user" data-qa-user><span class="fp-chat-time">${e(F.now().slice(11, 16))}</span><div class="fp-chat-main"><div class="fp-chat-bubble">${e(text)}</div></div></article>
            <article class="fp-chat-entry" data-qa-pending><span class="fp-chat-time">${e(F.now().slice(11, 16))}</span><div class="fp-chat-main"><div class="fp-chat-skel" data-qa-skel><i></i><i></i><i></i></div><div class="fp-chat-answer" data-qa-answer hidden></div></div></article>`);
          scrollEnd();
          setComposer('stop');
          const pending = target.querySelector('[data-qa-pending]');
          const skel = pending.querySelector('[data-qa-skel]');
          const answerEl = pending.querySelector('[data-qa-answer]');

          const run = () => {
            let result;
            try { result = F.askSpace(spaceId, text); }
            catch (error) { streaming = null; pending.remove(); setComposer('send'); SC.toast(error.message, 'bad'); return; }
            skel.remove();
            answerEl.hidden = false;
            pending.removeAttribute('data-qa-pending');
            pending.setAttribute('data-qa-item', result.hasEvidence ? 'answered' : 'no-evidence');
            pending.setAttribute('data-qa-id', result.id);
            const full = result.answer;
            const finish = () => {
              streaming = null;
              answerEl.innerHTML = e(full) + citeHtml(result.sources);
              // 只有最后一条答案能重新生成，历史答案上的入口同步撤掉。
              target.querySelectorAll('[data-action="qa-regen"]').forEach(button => button.remove());
              answerEl.insertAdjacentHTML('afterend', chatActsHtml(result.id, true));
              setComposer('send');
              SC.toast(result.hasEvidence ? '已按当前空间上下文作答' : '当前空间没有可用依据，未生成推测答案', result.hasEvidence ? 'ok' : 'bad');
              scrollEnd();
            };
            if (window.FN_FAST) { finish(); return; }
            let pos = 0;
            const timer = window.setInterval(() => {
              pos = Math.min(pos + 5, full.length);
              answerEl.innerHTML = e(full.slice(0, pos)) + (pos < full.length ? '<span class="fp-caret"></span>' : '');
              scrollEnd();
              if (pos >= full.length) { window.clearInterval(timer); finish(); }
            }, 30);
            streaming = {
              cancel() {
                window.clearInterval(timer);
                streaming = null;
                answerEl.innerHTML = e(full.slice(0, pos));
                setComposer('send');
                if (noteEl()) noteEl().textContent = '已停止生成';
              }
            };
          };

          if (window.FN_FAST) { run(); return; }
          const timer = window.setTimeout(run, 480);
          streaming = {
            cancel() {
              window.clearTimeout(timer);
              streaming = null;
              pending.remove();
              setComposer('send');
              if (noteEl()) noteEl().textContent = '已停止生成';
            }
          };
        }

        // 依据脚注与预设问题统一走委托；失效来源如实说明，不伪装成可读。
        root.addEventListener('click', event => {
          const cite = event.target.closest('[data-qa-cite]');
          if (cite) { openSource(cite.dataset.qaCite); return; }
          const broken = event.target.closest('[data-qa-cite-broken]');
          if (broken) SC.toast('来源已失效：' + broken.dataset.qaCiteBroken, 'bad');
        });
        root.addEventListener('contextmenu', event => {
          const entry = event.target.closest('[data-qa-item]');
          if (!entry) return;
          event.preventDefault();
          entry.classList.toggle('is-acts-open');
        });

        root.innerHTML = `<div class="fp-chat" data-space-qa>${chatBodyHtml(w, F.load())}</div>${frozen ? '' : composerHtml()}`;
        const fieldNode = field();
        if (fieldNode) {
          fieldNode.oninput = autoGrow;
          fieldNode.onkeydown = event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendBtn().click(); }
          };
          const button = sendBtn();
          button.onclick = () => {
            if (button.dataset.state === 'stop') { streaming?.cancel(); return; }
            const text = fieldNode.value.trim();
            if (!text) return;
            fieldNode.value = '';
            autoGrow();
            send(text);
          };
          if (!frozen) fieldNode.focus();
        }
        scrollEnd();

        F.bind(mask, {
          ask: question => send(question),
          'qa-copy': id => {
            const item = (F.load().spaceQA || []).find(entry => entry.id === id);
            if (!item) { SC.toast('这条问答已不在当前空间的历史里。', 'bad'); return; }
            const text = `${item.question}\n${item.answer}`;
            if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
            SC.toast('已复制', 'ok');
          },
          'qa-regen': id => {
            if (streaming) { SC.toast('生成中，可先停止再操作。', 'bad'); return; }
            const item = (F.load().spaceQA || []).find(entry => entry.id === id);
            if (!item) { SC.toast('这条问答已不在当前空间的历史里。', 'bad'); return; }
            try { F.discardSpaceQA(spaceId, id); } catch (error) { SC.toast(error.message, 'bad'); return; }
            root.querySelectorAll(`[data-qa-id="${id}"]`).forEach(node => node.remove());
            send(item.question);
          }
        });
      });
    }
    /** 概览为默认入口（0921 版面）：指标条 → AI 一句话判断 → 经营焦点四卡 → 客户事实双卡 → 低频板块折叠；问答迁入空间助手抽屉。 */
    function renderOverview(w, state) {
      const panels = F.overview(w, state);
      const byKey = Object.fromEntries(panels.map(panel => [panel.key, panel]));
      const status = w.overviewStatus || 'ready';
      const statusMeta = status === 'failed' ? ['更新失败', 'amber'] : status === 'updating' ? ['更新中', 'brand'] : ['已更新', 'green'];
      const panelBadge = panel => panel.status === 'pending' ? F.badge('待确认', 'amber') : panel.status === 'conflict' ? F.badge('存在冲突', 'amber') : '';
      const panelCard = (panel, focus) => `<section class="fp-ov${focus ? ' fp-ov--focus' : ''}" data-overview-panel="${e(panel.key)}" data-panel-status="${e(panel.status)}"><header><h3>${e(panel.title)}</h3>${panelBadge(panel)}</header>${panel.text ? `<p>${e(panel.text)}</p>` : `<p class="u-t3" data-panel-empty>暂无可用依据，不输出结论。</p>`}${panel.text && panel.sources.length ? sourceChips(panel.sources) : ''}</section>`;
      // 低频板块折叠：与移动端同一折叠清单（基本情况 / 商机与金额 / 待确认信息），展开后同样可溯源；待确认徽标在折叠态也可见。
      const panelFold = panel => `<details class="fp-fold" data-overview-panel="${e(panel.key)}" data-panel-status="${e(panel.status)}"><summary><span class="fp-fold-title">${e(panel.title)}</span>${panelBadge(panel)}${SC.icon('chevron', 13)}</summary><div class="fp-fold-body">${panel.text ? `<p>${e(panel.text)}</p>` : `<p class="u-t3" data-panel-empty>暂无可用依据，不输出结论。</p>`}${panel.text && panel.sources.length ? sourceChips(panel.sources) : ''}</div></details>`;
      const verdict = byKey.verdict || { key: 'verdict', title: '一句话判断', text: '', sources: [], status: 'empty' };
      // 焦点四卡放时间敏感信号；事实双卡放客户级底座信息；十个板块全部保留且均可溯源。
      const focusKeys = ['last', 'blocker', 'risk', 'recent'];
      const factKeys = ['who', 'people'];
      const foldKeys = ['basics', 'opportunity', 'pending'];
      return `<div class="fp-stack fp-overview" data-overview>
        ${F.spaceProfitCard(w.id, state)}
        ${metricStrip(w, state)}
        <section class="fp-verdict" data-overview-panel="verdict" data-panel-status="${e(verdict.status)}">
          <div class="fp-verdict-head"><span class="fp-ai-tag">${SC.icon('sparkles', 13)}AI 全景 · ${e(verdict.title)}</span><span data-overview-status="${e(status)}">${F.badge(statusMeta[0], statusMeta[1])}</span></div>
          ${verdict.text ? `<p class="fp-verdict-text">${e(verdict.text)}</p>${verdict.sources.length ? sourceChips(verdict.sources) : ''}` : '<p class="u-t3" data-panel-empty>暂无可用依据，不输出结论。</p>'}
          <footer class="fp-verdict-foot">结论由空间内原文收成，点击依据可回溯原文 · 更新时间 ${e(w.overviewUpdatedAt || '—')} · 当前版本 ${e(w.lastReadableVersion || '—')}</footer>
        </section>
        <div class="fp-ovgroup">
          <div class="fp-section-head"><h3>经营焦点</h3><span class="u-t3">上次进展、当前卡点、风险与最近动静</span></div>
          <div class="fp-ov-grid fp-ov-grid--focus">${focusKeys.map(key => panelCard(byKey[key], true)).join('')}</div>
        </div>
        <div class="fp-ovgroup">
          <div class="fp-section-head"><h3>客户事实</h3><span class="u-t3">客户级信息，结论均可回溯原文；低频板块默认折叠</span></div>
          <div class="fp-ov-grid">${factKeys.map(key => panelCard(byKey[key])).join('')}</div>
          <div class="fp-fold-group">${foldKeys.map(key => panelFold(byKey[key])).join('')}</div>
        </div>
      </div>`;
    }

    /** 客户 Tab 承载客户事实与画像；同跟名单只给销售与确权类型，不返回其商机内容。 */
    function renderCustomer(w, state) {
      const peers = F.coFollowers(w, state);
      const typeText = type => type === 'customer_only' ? '客户级确权' : type === 'opportunity' ? '商机级确权' : type === 'none' ? '无当前确权' : '客户级 + 商机级';
      return `<div class="fp-stack">
        <div class="fp-customer-grid">
          <section class="fp-panel fp-pad">
            <header class="fp-section-head"><h3>客户画像</h3><span class="u-t3">从跟进沉淀的经营理解</span></header>
            <dl class="fp-kv u-mt3"><dt>核心需求</dt><dd>${e(w.brief)}</dd><dt>关注产品</dt><dd>${w.opps.map(o => e(o.name)).join('、') || '尚未确权'}</dd><dt>决策链</dt><dd>技术评估 → 采购确认 → 业务验收</dd><dt>沟通建议</dt><dd>围绕业务量、验收标准与决策时间逐项确认。</dd></dl>
          </section>
          <section class="fp-panel fp-pad">
            <header class="fp-section-head"><h3>客户信息</h3><span class="u-t3">客户级原文与主数据</span></header>
            <dl class="fp-kv u-mt3"><dt>客户名称</dt><dd>${e(w.customer)}</dd><dt>所属行业</dt><dd>${e(w.industry)}</dd><dt>客户等级</dt><dd>${F.badge(w.grade, 'brand')}</dd><dt>第一关键人</dt><dd>${e(w.contact)}</dd><dt>联系职位</dt><dd>信息技术负责人</dd><dt>联系人数量</dt><dd>3 人（联系人不展示创建人）</dd><dt>客户来源</dt><dd>CRM 同步 · ${e(state.crm?.lastSyncAt || '—')}</dd><dt>客户池来源</dt><dd>${w.customerPoolSource === 'pending' ? 'CRM 暂无客户池，待补充' : 'CRM 当前客户池'}</dd></dl>
          </section>
        </div>
        <section class="fp-panel fp-pad" data-co-followers>
          <header class="fp-section-head"><h3>同客户在跟名单</h3><span class="u-t3">可以知道同客户还有谁在跟，但看不到其商机、跟进和方案内容</span></header>
          ${peers.length ? `<ul class="fp-peer-list">${peers.map(peer => `<li data-peer="${e(peer.sales)}"><span class="fp-avatar" aria-hidden="true">${e(peer.name.slice(0, 1))}</span><strong>${e(peer.name)}</strong>${F.badge(typeText(peer.entitlementType), 'neutral')}<span class="u-t3">经营内容不可见</span></li>`).join('')}</ul>` : '<p class="u-t3">当前客户没有其他在跟销售。</p>'}
        </section>
      </div>`;
    }

    /**
     * 资料 Tab：内容范围是只读装载读数，收成顶部一张指标卡（六格横排），不再占六行列表；
     * 外部资料逐份展示挂载与概览结果，Tab 里真正可操作的只有下面这张表。
     */
    function renderDocuments(w, state) {
      const layers = F.contentScope(w, state);
      const docs = state.documents.filter(doc => doc.space === w.id);
      const layerMeta = { ready: ['已装载', 'green'], updating: ['装载中', 'brand'], failed: ['装载失败', 'amber'], empty: ['空态', 'neutral'] };
      const docMeta = { success: ['已挂载', 'green'], overview_updating: ['概览更新中', 'brand'], failed: ['挂载失败', 'amber'], duplicate: ['重复资料', 'neutral'] };
      const rows = docs.map(doc => {
        const meta = docMeta[doc.status] || ['处理中', 'brand'];
        const canRetry = doc.status === 'failed' && w.state === 'active' && (F.role === 'MGR' || (F.role === 'SOL' && doc.uploader === F.actor?.id));
        return `<tr data-document-row data-status="${e(doc.status)}"><td><strong>${e(doc.name)}</strong><small>${e(doc.id)}${doc.note ? ' · ' + e(doc.note) : ''}</small></td><td>${e(F.name(doc.uploader))}</td><td>${e(doc.uploadedAt)}</td><td>${e(doc.size || '—')}</td><td>${F.badge(meta[0], meta[1])}${doc.reason ? `<small>${e(doc.reason)}</small>` : ''}</td><td>${e(doc.overviewStatus === 'applied' ? '已参与概览' : doc.overviewStatus === 'updating' ? '概览更新中' : '未参与概览')}</td><td>${F.button('查看原文', 'source', 'document:' + doc.id)}${canRetry ? F.button('单份重试', 'doc-retry', doc.id) : ''}</td></tr>`;
      });
      return `<div class="fp-stack">
        <section class="fp-scope-strip" data-content-scope aria-label="内容范围装载状态">
          <header class="fp-section-head"><h3>内容范围</h3><span class="u-t3">按确权范围装载；每层独立记录状态，单层失败不影响其余层可读</span>${F.canRefreshContent(w, state) ? F.button('刷新全部内容', 'content-refresh', w.id) : ''}</header>
          <div class="fp-metricstrip fp-scope-metrics">${layers.map(layer => { const meta = layerMeta[layer.status]; return `<div class="fp-metricstrip-item fp-scope-cell" data-scope-layer="${e(layer.key)}" data-scope-status="${e(layer.status)}"><span class="fp-scope-name"><span class="fp-scope-dot" aria-hidden="true"></span>${e(layer.label)}</span><strong>${layer.count}</strong><small>${F.badge(meta[0], meta[1])}<span class="fp-scope-detail">${e(layer.detail)}</span></small></div>`; }).join('')}</div>
          <p class="fp-hint" data-scope-result>当前版本 ${e(w.lastReadableVersion || '—')} · 更新时间 ${e(w.readinessUpdatedAt || '—')}${w.readiness === 'failed' ? ' · 失败环节：' + e(w.failure?.stage || '内容处理') : ''}</p>
        </section>
        <section class="fp-panel">
          <header class="fp-panel-head"><div><h3>外部资料</h3><p class="fp-hint">只展示本空间资料，不与同客户其他销售空间共享。</p></div>${F.canUpload(w, state) ? F.button('上传 .md 资料', 'doc-upload', w.id, true) : F.role === 'SOL' ? '<span class="fp-readonly">冻结空间或承接范围外不开放上传。</span>' : F.role === 'MGR' ? '<span class="fp-readonly">冻结空间不开放上传。</span>' : ''}</header>
          ${F.table(['资料', '上传人', '上传时间', '大小', '挂载状态', '概览参与', '操作'], rows, { caption: `${w.customer} 的外部资料与挂载状态`, emptyMessage: '当前空间尚未挂载外部资料。', countLabel: '份资料', compact: true })}
        </section>
      </div>`;
    }

    /**
     * R10 空间侧反向关联：从本人已同步录音里挑一份归位进来。
     * 与录音管理侧产生的是同一种归位；同样要指定商机，多商机不代选。
     */
    function openPlacement(w) {
      const state = F.load();
      const placed = F.spacePlacements(w.id, state).map(item => item.recording);
      const options = (state.meetings || []).filter(item => item.owner === F.actor?.id && item.ownerResolved !== false && item.syncStatus === 'synced' && !placed.includes(item.id));
      if (!options.length) {
        F.drawer('关联录音 · ' + w.customer, '<div class="fp-callout" data-placement-blocked>当前没有可关联的录音：同步失败的录音需先重新同步，已归位到本空间的录音不重复建立。录音由三方服务同步进来后会出现在这里。</div>');
        return;
      }
      const opps = w.opps || [];
      F.form('关联我的录音 · ' + w.customer,
        `<div class="fp-callout">目标空间固定为 <strong>${e(w.customer)}</strong>（${e(w.id)}）。本版不提供上传录音，只能从三方服务已同步的录音里挑选。</div>`
        + F.field('选择录音 *', 'recording', options[0].id, 'select', options.map(item => [item.id, `${item.title} · ${item.date}${F.recordingSourceIssue(item) ? '（来源内容异常）' : ''}`]))
        + F.field('关联商机 *', 'opportunityId', opps.length === 1 ? opps[0].id : '', 'select', opps.length === 1 ? opps.map(o => [o.id, `${o.name}（${o.id}）`]) : [['', '请选择本空间下的一条商机'], ...opps.map(o => [o.id, `${o.name}（${o.id}）`])])
        + `<p class="fp-hint">${opps.length > 1 ? '本空间有多条商机，必须由你指定一条，系统不代选。' : '本空间仅一条商机，已自动带出，可以修改。'}归位成功不等于客户信息已更新。</p>`,
        values => { F.placeRecording(values.recording, { space: w.id, opportunityId: values.opportunityId }); },
        () => draw(), '确认关联');
    }

    /** 本机选择 .md，逐份校验后挂载；不合格文件不提交，成功文件立即进入资料 Tab。 */
    function openUpload(w) {
      F.documentUploadForm(w, draw);
    }

    function draw() {
      const w = F.space(spaceId);
      if (!w) { root.innerHTML = F.empty('该空间不在当前可见范围，或尚未同步有效确权。'); return; }
      const state = F.load(), tasks = F.records('tasks', state).filter(t => t.space === w.id), followups = F.records('followups', state).filter(r => r.space === w.id), ready = readinessMeta(w);
      const frozen = (w.lifecycle || w.state) === 'frozen';
      const pool = w.pool ? F.badge(w.pool, 'brand') : F.badge('待补客户池', 'amber');
      // R05：超管进入全量只读；销售运营可在资料页补外部资料并刷新全部内容，其他页签仍只读。
      const readonly = F.role === 'ADM';
      const retryButton = readonly && (ready.status === 'failed' || ready.status === 'updating') ? F.button(ready.status === 'failed' ? '重试内容处理' : '查看处理状态', 'space-retry', w.id) : '';
      const lifeCallout = frozen ? '<div class="fp-callout fp-callout--warn">空间已冻结：商机确权与客户级确权均已结束。历史记录可查看，跟进与方案回复已关闭；内容重试不会解冻空间。</div>' : w.ownerOnly ? '<div class="fp-callout">当前仅有客户级确权，可查看客户资料；尚无本人确权商机。商机列表为空不会导致空间冻结。</div>' : '';
      // 更新信号只有一个出口：chrome 右上角铃铛红点表达「有新结果可看」，打开更新抽屉即视为已读（M05-1 §4.2，0921 口径）。
      const latestChanged = F.updateHistory(w.id, state).find(hasVisibleChange);
      const updatesUnread = !!latestChanged && !readChanges().has(latestChanged.id);
      const readinessCallout = ready.status === 'failed' ? `<div class="fp-callout fp-callout--warn" data-space-failure><strong>内容更新失败：</strong>${e(w.failure?.reason || w.readinessReason || '内容处理失败')}。${w.lastReadableVersion ? `上一版 ${e(w.lastReadableVersion)} 仍可读。` : ''}${retryButton ? `<span class="fp-actions u-mt2">${retryButton}</span>` : ''}</div>` : ready.status === 'updating' ? `<div class="fp-callout" data-space-failure>内容正在更新中；${w.lastReadableVersion ? `上一版 ${e(w.lastReadableVersion)} 继续可读。` : '首次建立完成前暂不开放新增内容。'}</div>` : '';
      // R13：销售本人的正常且有商机确权的空间展示标记状态与入口，与今日该跟页共用同一份标记数据。
      const insightMark = (state.insightMarks || []).find(item => item.space === w.id && item.sales === w.sales && !item.canceledAt);
      const markChip = insightMark && (insightMark.starred || insightMark.pause) ? `${insightMark.starred ? F.badge('★ 已星标', 'brand') : ''}${insightMark.pause ? F.badge(insightMark.pause.until && insightMark.pause.until < F.today ? '暂不跟进 · 已失效' : '暂不跟进', insightMark.pause.until && insightMark.pause.until < F.today ? 'neutral' : 'amber') : ''}` : '';
      const canMark = F.role === 'SLS' && w.sales === F.actor.id && w.state === 'active' && w.opps.length > 0;
      root.innerHTML = `<section class="fp-chrome" data-space-id="${e(w.id)}">
        <div class="fp-chrome-main">
          <div class="fp-chrome-chips" data-space-chips><span data-space-lifecycle="${frozen ? 'frozen' : 'active'}">${F.badge(frozen ? '已冻结 · 只读' : '进行中', frozen ? 'neutral' : 'green')}</span><span data-space-readiness="${ready.status}">${F.badge('内容' + ready.label, ready.tone)}</span>${pool}${markChip}<span data-space-owner-type="${e(w.entitlementType || 'customer_only')}">${F.badge(entitlementText(w), 'neutral')}</span>${readonly ? F.badge('全量只读视图', 'neutral') : F.role === 'MGR' ? F.badge(frozen ? '全量查看 · 冻结只读' : '全量查看 · 资料可写', 'neutral') : ''}</div>
          <h1 class="fp-chrome-title">${e(w.customer)}</h1>
          <p class="fp-chrome-sub">${e(w.industry)} · ${e(F.name(w.sales))} · ${e(w.stage)}<span class="fp-chrome-id">${e(w.id)}</span></p>
        </div>
        <div class="fp-chrome-side">
          <label class="fp-chrome-switch"><span class="fp-sr-only">切换客户空间</span><select name="space" aria-label="切换客户空间">${F.visible().map(x => `<option value="${e(x.id)}" ${x.id === w.id ? 'selected' : ''}>${e(x.customer)} · ${e(F.name(x.sales))}</option>`).join('')}</select></label>
          <button type="button" class="fp-bell${updatesUnread ? ' has-unread' : ''}" data-open-updates aria-label="空间更新${updatesUnread ? '，有新更新' : ''}" title="空间更新">${SC.icon('bell', 16)}</button>
          <div class="fp-chrome-actions">${F.canWrite(w) ? F.button('记录跟进', 'followup', w.id, true) + F.button('记录周复盘', 'weekly', w.id) : F.canSend(w) ? F.button('推送方案', 'send', w.id, true) : ''}${F.button('生命周期', 'space-history', w.id)}${canMark ? F.button('星标 / 暂不跟进', 'space-mark', w.id) : ''}</div>
        </div>
      </section>${lifeCallout}${readinessCallout}<div class="fp-split"><div class="fp-stack"><section class="fp-panel fp-ws-panel">${F.tabs(entries, tab)}${tab === 'followup' ? `<nav class="fp-tabs fp-subtabs" aria-label="跟进内容分类">${subEntries.map(([key, label]) => `<button type="button" data-subtab="${key}" class="${key === sub ? 'is-active' : ''}" aria-pressed="${key === sub}">${label}</button>`).join('')}</nav>` : ''}<div class="fp-pad" data-tab-body></div></section></div><aside class="fp-stack fp-rail">${F.panel('下一步任务', `<div class="fp-pad fp-stack">${tasks.length ? tasks.map(t => `<div class="fp-task${t.done ? ' is-done' : ''}"><div class="fp-actions">${F.badge(t.done ? '已完成' : t.due < F.today ? '已逾期' : '待跟进', t.done ? 'green' : 'amber')}<small class="u-t3">${t.due}</small></div><p class="u-mt2">${e(t.title)}</p>${!t.done && F.canWrite(w) ? `<div class="u-mt2">${F.button('标记完成', 'task', t.id)}</div>` : ''}</div>`).join('') : `<div class="fp-empty fp-empty--slim"><h3>暂无待办任务</h3><p>跟进中产生的下一步会汇聚到这里。</p></div>`}</div>`)}${F.panel('客户档案', `<div class="fp-pad"><dl class="fp-kv"><dt>客户等级</dt><dd>${F.badge(w.grade, 'brand')}</dd><dt>联系人</dt><dd>${e(w.contact)}</dd><dt>联系职位</dt><dd>信息技术负责人</dd><dt>归属销售</dt><dd>${e(F.name(w.sales))}</dd><dt>客户池</dt><dd>${pool}</dd><dt>确权来源</dt><dd>${e(entitlementText(w))}</dd><dt>当前商机</dt><dd>${w.entitlements?.opportunities?.length ? `${w.entitlements.opportunities.length} 条` : '无本人确权商机'}</dd><dt>冻结原因</dt><dd>${frozen ? e(w.lifecycleEvents?.find(event => event.type === 'frozen')?.reason || '确权已结束') : '—'}</dd></dl></div>`)}</aside></div><button type="button" class="fp-assistant-fab" data-open-assistant aria-label="空间助手：围绕本空间问答" title="空间助手">${SC.icon('sparkles', 15)}<span>空间助手</span></button>`;
      const target = root.querySelector('[data-tab-body]');
      if (tab === 'overview') target.innerHTML = renderOverview(w, state);
      if (tab === 'profit') {
        target.innerHTML = F.financeHistory(w.id, profitMonth, state);
        target.querySelector('[data-profit-month]').onchange = event => {
          if (F.monthRange(event.target.value) && event.target.value < F.financeMonth()) { profitMonth = event.target.value; history.replaceState(null, '', F.link('followup-workbench', { space: spaceId, tab, month: profitMonth })); draw(); }
        };
      }
      if (tab === 'customer') target.innerHTML = renderCustomer(w, state);
      if (tab === 'opps') {
        const totalAmount = w.opps.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
        const summary = w.opps.length ? `<div class="fp-opp-summary"><div><span>确权商机</span><strong>${w.opps.length} 个</strong></div><div><span>合计金额</span><strong>${totalAmount} 万元</strong></div><div><span>推进阶段</span><strong>${e([...new Set(w.opps.map(o => o.stage))].join(' / '))}</strong></div></div>` : '';
        target.innerHTML = summary + F.table(['商机', '金额（万元）', '经营阶段'], w.opps.map(o => `<tr><td>${e(o.name)}<small>${o.id}</small></td><td>${o.amount}</td><td>${e(o.stage)}</td></tr>`), { caption: `${w.customer} 的已确权商机`, emptyMessage: w.ownerOnly ? '仅客户级确权，当前没有本人确权商机。' : '当前客户空间尚无已确权商机。', countLabel: '个商机' });
      }
      if (tab === 'documents') target.innerHTML = renderDocuments(w, state);
      if (tab === 'followup' && sub === 'followups') {
        // R09 周复盘与跟进记录同属本空间内容，按时间线合并展示；两端读写同一份。
        const reviews = F.weeklyReviewsOf(w.id, state);
        const reviewCards = reviews.map(review => {
          const br = F.behaviorForEvent(state, 'weekly_review', review.id);
          const brMeta = br && F.behaviorStatusMeta[br.status];
          return `<article class="fp-event" data-weekly-review="${e(review.id)}"><div class="fp-actions"><strong>周复盘</strong>${F.badge(F.name(review.author))}${F.badge('客户事实', 'brand')}${br ? F.badge('行为记录 · ' + brMeta[0], brMeta[1]) : ''}</div><dl class="fp-kv"><dt>本周进展</dt><dd>${e(review.progress)}</dd><dt>下一步</dt><dd>${e(review.next)}</dd><dt>阻塞</dt><dd>${e(review.blockers || '无')}</dd></dl>${br ? `<div class="fp-actions u-mt2">${F.button('查看行为记录', 'behavior-open', br.id)}</div>` : ''}<small>${e(review.date)}</small></article>`;
        }).join('');
        target.innerHTML = `<div class="fp-callout">客户事实变化进入概览与相关 Tab；沟通问题和改进方向属于销售行为记录，不混入客户事实。</div>` + reviewCards + (followups.length ? `<div class="fp-timeline u-mt3">${followups.map(r => { const br = F.behaviorForEvent(state, 'followup', r.id); const brMeta = br && F.behaviorStatusMeta[br.status]; return `<article class="fp-event"><div class="fp-actions"><strong>${e(r.type)}</strong>${F.badge(F.name(r.author))}${F.badge('客户事实', 'brand')}${br ? F.badge('行为记录 · ' + brMeta[0], brMeta[1]) : ''}</div><p>${e(r.text)}</p>${r.next ? `<div class="fp-callout">下一步：${e(r.next)}</div>` : ''}<div class="fp-actions u-mt2">${F.button('查看原文', 'source', 'followup:' + r.id)}${br ? F.button('查看行为记录', 'behavior-open', br.id) : ''}</div><small>${e(r.date)}</small></article>`; }).join('')}</div>` : reviewCards ? '' : F.empty('还没有跟进记录。'));
      }
      // R15 行为记录子页签：与客户事实分区展示，按事件时间倒序；四态各自成立。
      if (tab === 'followup' && sub === 'behaviors') {
        const records = F.behaviorsOf(w.id, state);
        const q = String(behaviorQuery.q || '').trim();
        const statusFilter = String(behaviorQuery.status || '');
        const filtered = records.filter(record => (!statusFilter || record.status === statusFilter) && (!q || `${record.eventId} ${record.summary} ${record.note} ${record.failReason}`.includes(q)));
        target.innerHTML = `<div class="fp-callout">行为记录由系统在每次跟进事件后生成，与客户事实分开存放；晚间日报只读取已完成记录。生成与失败均不单独发提醒（待 M05-2 §7.13 确认）。</div>${F.searchbar('搜索事件或摘要', F.field('生成状态', 'status', statusFilter, 'select', [['', '全部状态'], ...Object.entries(F.behaviorStatusMeta).map(([key, meta]) => [key, meta[0]])]))}${F.table(['事件', '事件时间', '生成状态', '沟通摘要 / 说明', '生成时间', '操作'], filtered.map(record => { const meta = F.behaviorStatusMeta[record.status]; const note = record.status === 'done' ? record.summary : record.status === 'failed' ? record.failReason : record.status === 'empty' ? record.note : '正在结合本次事件归纳，稍后可刷新查看。'; return `<tr data-behavior-row data-status="${e(record.status)}"><td><strong>${e(F.behaviorEventLabels[record.eventType] || record.eventType)}</strong><small>${e(record.eventId)}</small></td><td>${e(record.eventAt)}</td><td>${F.badge(meta[0], meta[1])}</td><td>${e(note)}</td><td>${e(record.createdAt)}</td><td>${F.button('查看详情', 'behavior-open', record.id)}</td></tr>`; }), { caption: `${w.customer} 的销售行为记录`, emptyMessage: '暂无行为记录：每次手写跟进、周复盘或录音归位后自动生成一条。', countLabel: '条行为记录', compact: true })}`;
        F.restoreSearch(target, behaviorQuery);
        F.handleSearch(target, values => { behaviorQuery = values; draw(); });
      }
      // R10 录音区：本空间已归位录音逐条展示处理状态与本次变化入口，不汇总折叠；行为记录与客户信息分开。
      if (tab === 'followup' && sub === 'recordings') {
        const placements = F.spacePlacements(w.id, state);
        const rows = placements.map(placement => {
          const recording = F.recording(placement.recording, state);
          const opp = (w.opps || []).find(item => item.id === placement.opportunityId);
          const meta = F.placementStatusMeta[placement.status] || ['处理中', 'brand'];
          const behavior = F.placementBehavior(placement.id, state);
          const behaviorMeta = behavior && F.behaviorStatusMeta[behavior.status];
          const changeLink = placement.changeId ? F.button('查看本次变化', 'placement-change', placement.changeId) : '';
          const cancel = F.canWrite(w) && placement.by === F.actor?.id ? F.button('取消归位', 'placement-cancel', placement.id) : '';
          return `<tr data-placement-row="${e(placement.id)}" data-placement-status="${e(placement.status)}">
            <td><strong>${e(recording ? recording.title : placement.recording)}</strong><small>${e(placement.recording)} · 归位 ${e(placement.at)}</small></td>
            <td>${e(opp ? opp.name : placement.opportunityId || '—')}</td>
            <td>${F.badge(meta[0], meta[1])}${placement.status === 'failed' ? `<small>${e(placement.failReason)}</small>` : placement.status === 'updating' ? '<small>正在使用三方已同步的原文更新，可稍后查看</small>' : ''}</td>
            <td data-behavior-status="${e(behavior ? behavior.status : 'none')}">${behavior ? F.badge(behaviorMeta[0], behaviorMeta[1]) : '<span class="u-t3">未生成</span>'}</td>
            <td>${changeLink}${behavior ? F.button('查看行为记录', 'behavior-open', behavior.id) : ''}${F.button('查看原文', 'source', 'meeting:' + placement.recording)}<a href="${F.link('meeting-center', { meeting: placement.recording })}">录音管理</a>${cancel}</td></tr>`;
        });
        target.innerHTML = `<div class="fp-callout">录音由三方录音服务同步，本空间只展示归位到这里的那一条；同一份录音归位到别的空间时，各空间结果独立，互相看不到。</div>
          ${F.canWrite(w) ? `<div class="fp-actions u-mt3">${F.button('关联我的录音', 'placement-add', w.id, true)}<span class="u-t3">从已同步的录音里挑一份关联进来，并指定本空间的一条商机。</span></div>` : w.state === 'frozen' ? '<p class="fp-readonly u-mt3">空间已冻结，不可新增或取消归位；已有归位仍可回听。</p>' : ''}
          ${F.table(['录音', '关联商机', '客户信息处理状态', '行为记录', '操作'], rows, { caption: `${w.customer} 的客户录音归位`, emptyMessage: '当前客户空间尚无归位录音；录音同步进来后可在此关联。', countLabel: '条归位录音', compact: true })}`;
      }
      if (tab === 'followup' && sub === 'solutions') {
        const rows = F.records('solutions').filter(r => r.space === w.id && (!r.withdrawn || (F.role === 'SOL' && r.author === F.actor.id)));
        target.innerHTML = rows.length ? rows.map(r => `<article class="fp-event"><div class="fp-actions"><strong>${e(r.title)}</strong>${F.solutionStatus(r).key === 'withdrawn' ? F.badge('已撤回', 'neutral') : F.badge(r.reply ? '已回复' : r.read ? '已读' : '未读', r.reply ? 'green' : 'brand')}</div><p>${e(r.body)}</p><div class="fp-solution-assets">${(r.attachments || []).length ? `<ul class="fp-file-list fp-file-list--compact">${(r.attachments || []).map(file => { const ext = F.solutionFileExt(file.name) || 'file'; return `<li class="fp-file-row" data-attachment-row="${e(ext)}"><span class="fp-file-ext">${e(ext)}</span><span class="fp-file-name">${e(file.name)}</span><small class="fp-file-size">${e(file.size || '')}</small></li>`; }).join('')}</ul>` : ''}${r.externalLink ? `<a class="fp-link-chip" href="${e(r.externalLink)}" target="_blank" rel="noreferrer">外部链接</a>` : ''}</div><small>${e(F.name(r.author))} · ${e(r.date)}${r.readAt ? ' · 已读 ' + e(r.readAt) : ''}</small>${r.reply ? `<div class="fp-callout u-mt3">销售回复：${e(r.reply)}<small class="fp-sub">${r.replyRead ? '方案人员已读' : '方案人员未读'}</small></div>` : ''}<div class="fp-actions u-mt3">${F.role === 'SLS' ? F.button('查看并回复', 'solution', r.id) : F.button('查看详情', 'solution', r.id)}</div></article>`).join('') : F.empty('当前空间尚未收到方案。');
      }
      const syncUrl = () => history.replaceState(null, '', F.link('followup-workbench', { space: spaceId, tab, ...(tab === 'followup' ? { sub } : {}), ...(tab === 'profit' ? { month: profitMonth } : {}) }));
      root.querySelector('[name=space]').onchange = event => { spaceId = event.target.value; profitMonth = F.financeMonth(-1); syncUrl(); draw(); };
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; syncUrl(); draw(); });
      root.querySelectorAll('[data-subtab]').forEach(b => b.onclick = () => { sub = b.dataset.subtab; syncUrl(); draw(); });
      // 更新入口与空间助手：两个悬浮/顶栏入口在每次重画后重新挂接；抽屉内部各自绑定事件。
      root.querySelector('[data-open-updates]')?.addEventListener('click', openUpdates);
      root.querySelector('[data-open-assistant]')?.addEventListener('click', openAssistant);
    }
    F.bind(root, {
      followup: id => F.followupForm(id, draw), weekly: id => F.weeklyReviewForm(id, draw),
      send: id => F.solutionForm(id, draw), solution: id => F.solutionDetail(id, draw),
      'space-history': id => { const space = F.space(id); if (space) openLifecycle(space); },
      'space-mark': id => F.spaceMarkForm(id, draw),
      'behavior-open': id => openBehavior(id),
      'space-retry': id => { F.retrySpace(id); draw(); SC.toast('空间内容已恢复为就绪；生命周期状态保持不变。', 'ok'); },
      source: ref => openSource(ref),
      'change-open': id => openChangeDetail(id),
      // R10 从空间侧反向关联录音：与录音管理侧归位等价，同样必须指定本空间的一条商机。
      'placement-add': id => { const space = F.space(id); if (space) openPlacement(space); },
      'placement-cancel': id => { try { F.cancelPlacement(id); draw(); SC.toast('已取消该条归位，录音与其他归位不受影响。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } },
      'placement-change': id => openChangeDetail(id),
      'doc-upload': id => { const space = F.space(id); if (space) openUpload(space); },
      'doc-retry': id => { F.retryDocument(id); draw(); SC.toast(F.role === 'MGR' ? '该份资料已重新挂载，并已触发全部内容更新。' : '该份资料已重新挂载，同批其他结果未受影响。', 'ok'); },
      'content-refresh': id => { F.refreshSpaceContent(id); draw(); SC.toast('已按当前确权范围重装全部内容层。', 'ok'); },
      task: id => { F.mutate('完成跟进任务', s => { const t = s.tasks.find(t => t.id === id); if (!t || !F.canWrite(F.space(t.space, s))) throw Error('当前任务不可操作。'); t.done = true; }); draw(); SC.toast('任务已完成', 'ok'); }
    });
    draw();
    if (SC.param('solution')) F.solutionDetail(SC.param('solution'), draw);
    // R12：客户更新类提醒直达对应那次变化详情，而不是只落到最新概览。
    const changeParam = SC.param('change');
    if (changeParam) openChangeDetail(changeParam);
    // R15：行为记录直达，打开对应记录详情抽屉。
    const behaviorParam = SC.param('behavior');
    if (behaviorParam) openBehavior(behaviorParam);
  };
})(window.SC, window.SC.FEATURES);
