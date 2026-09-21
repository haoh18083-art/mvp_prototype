/** 客户跟进空间列表与客户空间次级页：承载 R02 生命周期、内容就绪度、R03 内容装载、R04 五入口全景与溯源、R05 角色边界及方案页签。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  F.views['customer-spaces'] = function (root) {
    const snapshot = F.load();
    const spaces = F.visible();
    const pools = snapshot.pools;
    // R05 统一入口：先说明当前身份能读什么、能写什么；失权时给出拒绝结果与重新进入入口。
    const permission = F.permissionContext(snapshot);
    const permissionPanel = permission.valid
      ? `<section class="fp-panel fp-pad fp-permission" data-permission="granted">
          <div class="fp-actions"><strong>当前权限结果</strong>${F.badge(permission.roleLabel, 'brand')}${F.badge('账号启用中', 'green')}<span class="u-t3">${e(permission.actor.name)} · ${e(permission.actor.id)}</span></div>
          <dl class="fp-kv u-mt2"><dt>可读范围</dt><dd data-permission-read>${e(permission.read)}</dd><dt>可写范围</dt><dd data-permission-write>${e(permission.write)}</dd>${F.role === 'SOL' ? `<dt>承接客户池</dt><dd>${permission.pools.length ? permission.pools.map(pool => F.badge(pool, 'brand')).join(' ') : F.badge('未配置，无空间可进', 'amber')}</dd>` : ''}<dt>本次判定结果</dt><dd>可见 ${permission.spaceCount} 个空间，其中 ${permission.frozenCount} 个已冻结只读</dd></dl>
          <p class="fp-hint">无权空间不会出现在列表中，也不会提示其是否存在；写入在提交时再次校验。</p>
        </section>`
      : `<section class="fp-panel fp-pad fp-permission fp-callout--warn" data-permission="denied">
          <div class="fp-actions"><strong>访问被拒绝</strong>${F.badge('二次校验未通过', 'amber')}</div>
          <p class="u-mt2">${e(permission.reason || '当前会话权限已失效')}。本次读取不返回任何空间内容，也不提示空间是否存在。</p>
          <p class="fp-actions u-mt2"><a class="btn btn--primary" href="${F.link('customer-spaces')}">重新进入</a></p>
        </section>`;
    root.innerHTML = permissionPanel + F.metrics([['客户', new Set(spaces.map(w => w.customerId)).size, '按当前角色可见范围'], ['跟进空间', spaces.length, '销售 × 客户 × 客户池'], ['进行中', spaces.filter(w => w.state === 'active').length, '确权有效'], ['已冻结', spaces.filter(w => w.state === 'frozen').length, '历史内容保留只读'], ['内容更新中', spaces.filter(w => ['preparing', 'updating'].includes(w.readiness)).length, '上一版内容继续可读'], ['内容失败', spaces.filter(w => w.readiness === 'failed').length, '可查看原因并重试']]) + `
      <section class="fp-panel fp-directory fp-directory-panel">
        <header class="fp-panel-head fp-directory-head">
          <div class="fp-directory-heading">
            <h2 id="customer-space-list-title">客户空间</h2>
            <span class="fp-directory-count" data-result-count aria-live="polite" aria-atomic="true"></span>
          </div>
          <span class="fp-directory-sync"><span aria-hidden="true"></span>CRM 已同步 · ${e(snapshot.crm?.lastSyncAt || '暂无')}</span>
        </header>
        <form class="fp-directory-filter" data-search aria-label="客户空间筛选">
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
    let activeFilters = { q: '', pool: '', status: '' };
    let searchTimer;
    let composing = false;

    const normalize = value => String(value || '').trim().toLocaleLowerCase('zh-CN');
    const readFilters = () => {
      const values = Object.fromEntries(new FormData(form));
      return { q: String(values.q || '').trim(), pool: String(values.pool || ''), status: String(values.status || '') };
    };
    const hasFilters = filters => !!(filters.q || filters.pool || filters.status);

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
      const items = [
        activeFilters.q && ['q', `关键词：${activeFilters.q}`],
        activeFilters.pool && ['pool', `客户池：${activeFilters.pool}`],
        statusLabel && ['status', `状态：${statusLabel}`]
      ].filter(Boolean);
      chips.innerHTML = items.map(([name, label]) => `<button type="button" class="fp-filter-chip" data-remove-filter="${name}" aria-label="移除筛选条件：${e(label)}" title="${e(label)}"><span>${e(label)}</span>${SC.icon('close', 12)}</button>`).join('');
      feedback.hidden = items.length === 0;
      summary.textContent = items.length ? `已筛选 ${rows.length} / ${spaces.length}` : '';
      resultCount.textContent = `${rows.length} 个空间`;
      reset.disabled = items.length === 0;
      clearSearch.hidden = !search.value.trim();
    }

    function draw(nextFilters = activeFilters) {
      activeFilters = { q: String(nextFilters.q || '').trim(), pool: String(nextFilters.pool || ''), status: String(nextFilters.status || '') };
      const keyword = normalize(activeFilters.q);
      const rows = spaces.filter(space => {
        const searchable = normalize(`${space.customer} ${space.id}`);
        return (!keyword || searchable.includes(keyword)) && (!activeFilters.pool || space.pool === activeFilters.pool) && (!activeFilters.status || space.state === activeFilters.status);
      });
      root.querySelector('[data-results]').innerHTML = renderTable(rows);
      syncFilterState(rows);
    }

    const applyFilters = () => {
      clearTimeout(searchTimer);
      const filters = readFilters();
      search.value = filters.q;
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
    chips.addEventListener('click', event => {
      const chip = event.target.closest('[data-remove-filter]');
      if (!chip) return;
      form.elements[chip.dataset.removeFilter].value = '';
      applyFilters();
      if (chip.dataset.removeFilter === 'q') search.focus();
    });

    draw();
  };

  /**
   * 客户空间次级页（五入口）：概览为默认入口，客户、商机、跟进、资料为明细入口。
   * 页面契约（回归测试依赖）：data-tab 五入口、data-subtab 跟进子页签（跟进记录/行为记录/方案往来/录音）、data-overview-panel 十板块、
   * data-change-latest / data-update-hint 本次变化、data-space-lifecycle / data-space-readiness 双状态轴、
   * data-scope-layer 六层装载状态、data-co-followers 同跟名单、data-qa-* 空间助手问答、data-behavior-* 行为记录。
   */
  F.views['followup-workbench'] = function (root) {
    let spaceId = SC.param('space') || F.visible()[0]?.id;
    // 五个空间入口固定为概览、客户、商机、跟进、资料；跟进内再分跟进记录、行为记录、方案往来、录音。
    const entries = [['overview', '概览'], ['customer', '客户'], ['opps', '商机'], ['followup', '跟进'], ['documents', '资料']];
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
    /** 结论或变化点回原文；来源失效时保留标识并说明不可用原因，不伪装成已验证事实。 */
    function openSource(ref) {
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

    /** 概览为默认入口：AI 一句话判断摘要 + 本次变化 + 经营焦点 + 客户事实 + 空间助手。 */
    function renderOverview(w, state) {
      const panels = F.overview(w, state);
      const byKey = Object.fromEntries(panels.map(panel => [panel.key, panel]));
      const changes = F.changesOf(w.id, state);
      const latest = changes[0];
      const qa = (state.spaceQA || []).filter(item => item.space === w.id);
      const status = w.overviewStatus || 'ready';
      const statusMeta = status === 'failed' ? ['更新失败', 'amber'] : status === 'updating' ? ['更新中', 'brand'] : ['已更新', 'green'];
      const frozen = (w.lifecycle || w.state) === 'frozen';
      const panelBadge = panel => panel.status === 'pending' ? F.badge('待确认', 'amber') : panel.status === 'conflict' ? F.badge('存在冲突', 'amber') : '';
      const panelCard = (panel, focus) => `<section class="fp-overview-panel${focus ? ' fp-overview-panel--focus' : ''}" data-overview-panel="${e(panel.key)}" data-panel-status="${e(panel.status)}"><header><h3>${e(panel.title)}</h3>${panelBadge(panel)}</header>${panel.text ? `<p>${e(panel.text)}</p>` : `<p class="u-t3" data-panel-empty>暂无可用依据，不输出结论。</p>`}${panel.text && panel.sources.length ? sourceChips(panel.sources) : ''}</section>`;
      const verdict = byKey.verdict || { key: 'verdict', title: '一句话判断', text: '', sources: [], status: 'empty' };
      // 高价值结论板块前置为大卡，事实类板块收进三列网格；十个板块全部保留且均可溯源。
      const focusKeys = ['last', 'blocker', 'pending', 'recent'];
      const factKeys = ['who', 'basics', 'risk', 'people', 'opportunity'];
      return `<div class="fp-stack" data-overview>
        <section class="fp-verdict" data-overview-panel="verdict" data-panel-status="${e(verdict.status)}">
          <div class="fp-verdict-head"><span class="fp-ai-tag">${SC.icon('sparkles', 13)}AI 全景 · ${e(verdict.title)}</span><span data-overview-status="${e(status)}">${F.badge(statusMeta[0], statusMeta[1])}</span></div>
          ${verdict.text ? `<p class="fp-verdict-text">${e(verdict.text)}</p>${verdict.sources.length ? sourceChips(verdict.sources) : ''}` : '<p class="u-t3" data-panel-empty>暂无可用依据，不输出结论。</p>'}
          <footer class="fp-verdict-foot">结论由空间内原文收成，点击依据可回溯原文 · 更新时间 ${e(w.overviewUpdatedAt || '—')} · 当前版本 ${e(w.lastReadableVersion || '—')}</footer>
        </section>
        ${latest ? `<section class="fp-panel fp-pad fp-change-panel" data-change-latest><header class="fp-section-head"><h3>本次变化</h3>${changes.length > 1 ? F.button('查看全部变化 (' + changes.length + ')', 'changes-all') : ''}</header>${changeCard(latest, w)}</section>` : '<div class="fp-callout" data-change-latest>暂无内容更新记录。</div>'}
        <div class="fp-section-head"><h3>经营焦点</h3><span class="u-t3">上次进展、当前卡点、待确认事项与最近动静</span></div>
        <div class="fp-overview-grid fp-overview-grid--focus">${focusKeys.map(key => panelCard(byKey[key], true)).join('')}</div>
        <div class="fp-section-head"><h3>客户事实</h3><span class="u-t3">客户级信息与商机事实，结论均可回溯原文</span></div>
        <div class="fp-overview-grid fp-overview-grid--facts">${factKeys.map(key => panelCard(byKey[key])).join('')}</div>
        <section class="fp-panel fp-pad fp-qa" data-space-qa>
          <header class="fp-section-head"><h3>空间助手 · 快捷问答</h3><span class="u-t3">只读取当前空间内你有权的上下文；没有依据时不生成推测答案</span></header>
          ${frozen
            ? '<div class="fp-callout" data-qa-frozen>空间已冻结，不开放新的问答；历史对话仍可只读查看。</div>'
            : `<form class="fp-qa-form" data-qa-form><input name="question" type="text" placeholder="向空间助手提问，例如：当前卡点是什么？" autocomplete="off" aria-label="向空间助手提问"><button type="submit" class="btn btn--primary">提问</button></form><div class="fp-actions">${F.quickQuestions.map(([key, label]) => `<button type="button" class="btn fp-qa-chip" data-action="ask" data-value="${e(label)}">${e(label)}</button>`).join('')}</div>`}
          ${qa.length ? `<div class="fp-timeline u-mt3">${qa.map(item => `<article class="fp-event" data-qa-item="${item.hasEvidence ? 'answered' : 'no-evidence'}"><div class="fp-actions"><strong>${e(item.question)}</strong>${F.badge(item.hasEvidence ? '有依据' : '无可用依据', item.hasEvidence ? 'green' : 'neutral')}</div><p>${e(item.answer)}</p>${item.sources.length ? sourceChips(item.sources) : ''}<small>${e(item.at)}</small></article>`).join('')}</div>` : '<p class="u-t3 u-mt3">暂无问答记录。</p>'}
        </section>
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

    /** 资料 Tab：内容范围按层展示装载状态，外部资料逐份展示挂载与概览结果。 */
    function renderDocuments(w, state) {
      const layers = F.contentScope(w, state);
      const docs = state.documents.filter(doc => doc.space === w.id);
      const layerMeta = { ready: ['已装载', 'green'], updating: ['装载中', 'brand'], failed: ['装载失败', 'amber'], empty: ['空态', 'neutral'] };
      const docMeta = { success: ['已挂载', 'green'], overview_updating: ['概览更新中', 'brand'], failed: ['挂载失败', 'amber'], duplicate: ['重复资料', 'neutral'] };
      const rows = docs.map(doc => {
        const meta = docMeta[doc.status] || ['处理中', 'brand'];
        const canRetry = doc.status === 'failed' && w.state === 'active' && (F.role === 'ADM' || (F.role === 'SOL' && doc.uploader === F.actor?.id));
        return `<tr data-document-row data-status="${e(doc.status)}"><td><strong>${e(doc.name)}</strong><small>${e(doc.id)}${doc.note ? ' · ' + e(doc.note) : ''}</small></td><td>${e(F.name(doc.uploader))}</td><td>${e(doc.uploadedAt)}</td><td>${e(doc.size || '—')}</td><td>${F.badge(meta[0], meta[1])}${doc.reason ? `<small>${e(doc.reason)}</small>` : ''}</td><td>${e(doc.overviewStatus === 'applied' ? '已参与概览' : doc.overviewStatus === 'updating' ? '概览更新中' : '未参与概览')}</td><td>${F.button('查看原文', 'source', 'document:' + doc.id)}${canRetry ? F.button('单份重试', 'doc-retry', doc.id) : ''}</td></tr>`;
      });
      return `<div class="fp-stack">
        <section class="fp-panel fp-pad" data-content-scope>
          <header class="fp-section-head"><h3>内容范围</h3><span class="u-t3">按确权范围装载；每层独立记录状态，单层失败不影响其余层可读</span></header>
          <ul class="fp-scope-list">${layers.map(layer => { const meta = layerMeta[layer.status]; return `<li data-scope-layer="${e(layer.key)}" data-scope-status="${e(layer.status)}"><span class="fp-scope-dot" aria-hidden="true"></span><strong>${e(layer.label)}</strong>${F.badge(meta[0], meta[1])}<span class="fp-scope-count">${layer.count}</span><small>${e(layer.detail)}</small></li>`; }).join('')}</ul>
          <p class="fp-hint u-mt2" data-scope-result>当前版本 ${e(w.lastReadableVersion || '—')} · 更新时间 ${e(w.readinessUpdatedAt || '—')}${w.readiness === 'failed' ? ' · 失败环节：' + e(w.failure?.stage || '内容处理') : ''}</p>
        </section>
        <section class="fp-panel">
          <header class="fp-panel-head"><div><h3>外部资料</h3><p class="fp-hint">只展示本空间资料，不与同客户其他销售空间共享。</p></div>${F.canUpload(w, state) ? F.button('上传 .md 资料', 'doc-upload', w.id, true) : F.role === 'SOL' ? '<span class="fp-readonly">冻结空间或承接范围外不开放上传。</span>' : ''}</header>
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
        + F.field('选择录音 *', 'recording', options[0].id, 'select', options.map(item => [item.id, `${item.title} · ${item.date}${item.transcriptStatus === 'ready' ? '' : '（等待转写）'}`]))
        + F.field('关联商机 *', 'opportunityId', opps.length === 1 ? opps[0].id : '', 'select', opps.length === 1 ? opps.map(o => [o.id, `${o.name}（${o.id}）`]) : [['', '请选择本空间下的一条商机'], ...opps.map(o => [o.id, `${o.name}（${o.id}）`])])
        + `<p class="fp-hint">${opps.length > 1 ? '本空间有多条商机，必须由你指定一条，系统不代选。' : '本空间仅一条商机，已自动带出，可以修改。'}归位成功不等于客户信息已更新。</p>`,
        values => { F.placeRecording(values.recording, { space: w.id, opportunityId: values.opportunityId }); },
        () => draw(), '确认关联');
    }

    /** 选择与校验、挂载结果逐份反馈；不合格文件不提交，成功文件立即进入资料 Tab。 */
    function openUpload(w) {
      const samples = F.documentSamples;
      F.form('上传外部资料 · ' + w.customer, `<div class="fp-callout">目标空间固定为 <strong>${e(w.customer)}</strong>（${e(w.id)}），同批文件不在上传过程中切换目标。仅支持 <code>.md</code>。</div><fieldset class="fp-checks" data-upload-queue><legend>选择资料（可多选，逐份校验）</legend>${samples.map(sample => `<label><input type="checkbox" name="docs" value="${e(sample.key)}"><span>${e(sample.name)}<small>${e(sample.size)}${sample.invalid ? ' · 预期校验不通过' : sample.mountFail ? ' · 预期挂载失败，可重试' : sample.key === 'duplicate' ? ' · 预期识别为重复资料' : sample.key === 'samename' ? ' · 同名不同内容，作为新增' : ''}</small></span></label>`).join('')}</fieldset><p class="fp-hint">不合格文件不提交，其余文件继续；每份文件挂载前会再次校验权限与空间状态。</p>`, (_values, mask) => {
        const keys = [...mask.querySelectorAll('[name=docs]:checked')].map(node => node.value);
        const results = F.uploadDocuments(w.id, keys);
        setTimeout(() => {
          const meta = { success: ['已挂载并触发概览更新', 'green'], failed: ['挂载失败，可单份重试', 'amber'], rejected: ['校验不通过，未提交', 'neutral'], duplicate: ['内容重复，指向已有资料', 'neutral'], blocked: ['已停止挂载', 'amber'] };
          F.drawer('本批挂载结果', `<div class="fp-stack"><p class="fp-hint">逐份反馈，成功结果不会被单份失败覆盖。</p><ul class="fp-upload-results">${results.map((item, index) => { const m = meta[item.status] || ['处理中', 'brand']; return `<li data-upload-result="${e(item.status)}"><span class="fp-upload-index">${index + 1}</span><div><strong>${e(item.name)}</strong>${F.badge(m[0], m[1])}${item.reason ? `<small>${e(item.reason)}</small>` : ''}${item.note ? `<small>${e(item.note)}</small>` : ''}</div></li>`; }).join('')}</ul></div>`);
        }, 0);
      }, () => draw(), '提交并逐份校验');
    }

    function draw() {
      const w = F.space(spaceId);
      if (!w) { root.innerHTML = F.empty('该空间不在当前可见范围，或尚未同步有效确权。'); return; }
      const state = F.load(), tasks = F.records('tasks', state).filter(t => t.space === w.id), followups = F.records('followups', state).filter(r => r.space === w.id), ready = readinessMeta(w);
      const frozen = (w.lifecycle || w.state) === 'frozen';
      const pool = w.pool ? F.badge(w.pool, 'brand') : F.badge('待补客户池', 'amber');
      // R05：运营与超管进入全量只读视图，页面不提供写入口径之外的入口。
      const readonly = ['ADM', 'MGR'].includes(F.role);
      const retryButton = readonly && (ready.status === 'failed' || ready.status === 'updating') ? F.button(ready.status === 'failed' ? '重试内容处理' : '查看处理状态', 'space-retry', w.id) : '';
      const lifeCallout = frozen ? '<div class="fp-callout fp-callout--warn">空间已冻结：商机确权与客户级确权均已结束。历史记录可查看，跟进与方案回复已关闭；内容重试不会解冻空间。</div>' : w.ownerOnly ? '<div class="fp-callout">当前仅有客户级确权，可查看客户资料；尚无本人确权商机。商机列表为空不会导致空间冻结。</div>' : '';
      // 有变化或待确认时给直达入口；处理中只说明保留上一版，不清空页面。
      const changes = F.changesOf(w.id, state);
      const latestChange = changes[0];
      const updateCallout = !latestChange ? '' : latestChange.status === 'processing'
        ? `<div class="fp-callout" data-update-hint="processing">客户信息正在更新（来源：${e(latestChange.sourceLabel)}）；当前展示上一版内容。</div>`
        : latestChange.status === 'done' && (latestChange.added.length || latestChange.updated.length || latestChange.pendingConfirm.length)
          ? `<div class="fp-callout" data-update-hint="done"><strong>客户信息已更新：</strong>${e(latestChange.sourceLabel)} 带来 ${latestChange.added.length + latestChange.updated.length} 处变化${latestChange.pendingConfirm.length ? `，${latestChange.pendingConfirm.length} 项待确认` : ''}。<span class="fp-actions u-mt2">${F.button('查看本次变化', 'goto-overview', '', true)}</span></div>`
          : latestChange.status === 'nochange' ? `<div class="fp-callout" data-update-hint="nochange">最近一次输入未带来客户信息变化，仅更新了页面状态。</div>` : '';
      const readinessCallout = ready.status === 'failed' ? `<div class="fp-callout fp-callout--warn" data-space-failure><strong>内容更新失败：</strong>${e(w.failure?.reason || w.readinessReason || '内容处理失败')}。${w.lastReadableVersion ? `上一版 ${e(w.lastReadableVersion)} 仍可读。` : ''}${retryButton ? `<span class="fp-actions u-mt2">${retryButton}</span>` : ''}</div>` : ready.status === 'updating' ? `<div class="fp-callout" data-space-failure>内容正在更新中；${w.lastReadableVersion ? `上一版 ${e(w.lastReadableVersion)} 继续可读。` : '首次建立完成前暂不开放新增内容。'}</div>` : '';
      const activity = changes.slice(0, 3);
      // R13：销售本人的正常且有商机确权的空间展示标记状态与入口，与今日该跟页共用同一份标记数据。
      const insightMark = (state.insightMarks || []).find(item => item.space === w.id && item.sales === w.sales && !item.canceledAt);
      const markChip = insightMark && (insightMark.starred || insightMark.pause) ? `${insightMark.starred ? F.badge('★ 已星标', 'brand') : ''}${insightMark.pause ? F.badge(insightMark.pause.until && insightMark.pause.until < F.today ? '暂不跟进 · 已失效' : '暂不跟进', insightMark.pause.until && insightMark.pause.until < F.today ? 'neutral' : 'amber') : ''}` : '';
      const canMark = F.role === 'SLS' && w.sales === F.actor.id && w.state === 'active' && w.opps.length > 0;
      root.innerHTML = `<section class="fp-hero" data-space-id="${e(w.id)}">
        <div class="fp-hero-main">
          <div class="fp-hero-chips"><span data-space-lifecycle="${frozen ? 'frozen' : 'active'}">${F.badge(frozen ? '已冻结 · 只读' : '进行中', frozen ? 'neutral' : 'green')}</span>${pool}${markChip}<span data-space-readiness="${ready.status}">${F.badge('内容' + ready.label, ready.tone)}</span>${readonly ? F.badge('全量只读视图', 'neutral') : ''}<span class="u-t3">${e(w.id)}</span></div>
          <h1>${e(w.customer)}</h1>
          <p class="fp-hero-sub">${e(w.industry)} · ${e(F.name(w.sales))} · ${e(w.stage)}</p>
          <div class="fp-hero-brief"><span class="fp-ai-tag">${SC.icon('sparkles', 12)}AI 经营重点</span><p>${e(w.brief)}</p><small>最近更新 ${e(w.updated)} · 最近可读版本 ${e(w.lastReadableAt || '—')} · 依据：客户沟通记录</small></div>
        </div>
        <div class="fp-hero-side">
          ${F.field('切换客户空间', 'space', w.id, 'select', F.visible().map(x => [x.id, x.customer + ' · ' + F.name(x.sales)]))}
          <div class="fp-actions">${F.button('生命周期', 'space-history', w.id)}${canMark ? F.button('星标 / 暂不跟进', 'space-mark', w.id) : ''}${F.canWrite(w) ? F.button('记录跟进', 'followup', w.id, true) + F.button('记录周复盘', 'weekly', w.id) : F.canSend(w) ? F.button('推送方案', 'send', w.id, true) : ''}</div>
          <dl class="fp-hero-meta">
            <div><dt>确权来源</dt><dd data-space-owner-type="${e(w.entitlementType || 'customer_only')}">${e(entitlementText(w))}</dd></div>
            <div><dt>当前商机</dt><dd>${w.entitlements?.opportunities?.length ? `${w.entitlements.opportunities.length} 条` : '无本人确权商机'}</dd></div>
            <div><dt>内容就绪</dt><dd>${e(ready.label)}</dd></div>
          </dl>
        </div>
      </section>${lifeCallout}${readinessCallout}${updateCallout}<div class="fp-split"><div class="fp-stack"><section class="fp-panel">${F.tabs(entries, tab)}${tab === 'followup' ? `<nav class="fp-tabs fp-subtabs" aria-label="跟进内容分类">${subEntries.map(([key, label]) => `<button type="button" data-subtab="${key}" class="${key === sub ? 'is-active' : ''}" aria-pressed="${key === sub}">${label}</button>`).join('')}</nav>` : ''}<div class="fp-pad" data-tab-body></div></section></div><aside class="fp-stack">${F.panel('客户档案', `<div class="fp-pad"><dl class="fp-kv"><dt>客户等级</dt><dd>${F.badge(w.grade, 'brand')}</dd><dt>联系人</dt><dd>${e(w.contact)}</dd><dt>联系职位</dt><dd>信息技术负责人</dd><dt>归属销售</dt><dd>${e(F.name(w.sales))}</dd><dt>客户池</dt><dd>${pool}</dd><dt>确权来源</dt><dd>${e(entitlementText(w))}</dd><dt>内容就绪</dt><dd>${F.badge(ready.label, ready.tone)}</dd><dt>冻结原因</dt><dd>${frozen ? e(w.lifecycleEvents?.find(event => event.type === 'frozen')?.reason || '确权已结束') : '—'}</dd></dl></div>`)}${F.panel('下一步任务', `<div class="fp-pad fp-stack">${tasks.length ? tasks.map(t => `<div><div class="fp-actions">${F.badge(t.done ? '已完成' : t.due < F.today ? '已逾期' : '待跟进', t.done ? 'green' : 'amber')}<small class="u-t3">${t.due}</small></div><p class="u-mt2">${e(t.title)}</p>${!t.done && F.canWrite(w) ? `<div class="u-mt2">${F.button('标记完成', 'task', t.id)}</div>` : ''}</div>`).join('') : '<p class="u-t3">暂无待办任务</p>'}</div>`)}${F.panel('空间动态', `<div class="fp-pad fp-stack">${activity.length ? activity.map(change => { const meta = changeStatusMeta[change.status] || ['处理中', 'brand']; return `<div class="fp-activity"><span class="fp-activity-dot is-${e(change.status)}" aria-hidden="true"></span><div class="u-grow"><p>${e(change.sourceLabel)}</p><small class="u-t3">${e(change.at)} · ${e(meta[0])}</small></div></div>`; }).join('') + F.button('查看全部变化 (' + changes.length + ')', 'changes-all') : '<p class="u-t3">暂无内容更新记录。</p>'}</div>`)}</aside></div>`;
      const target = root.querySelector('[data-tab-body]');
      if (tab === 'overview') target.innerHTML = renderOverview(w, state);
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
            <td>${F.badge(meta[0], meta[1])}${placement.status === 'failed' ? `<small>${e(placement.failReason)}</small>` : placement.status === 'waiting_transcript' ? '<small>转写可用后自动开始更新</small>' : ''}</td>
            <td data-behavior-status="${e(behavior ? behavior.status : 'none')}">${behavior ? F.badge(behaviorMeta[0], behaviorMeta[1]) : '<span class="u-t3">未生成</span>'}</td>
            <td>${changeLink}${behavior ? F.button('查看行为记录', 'behavior-open', behavior.id) : ''}${F.button('查看原文', 'source', 'meeting:' + placement.recording)}<a href="${F.link('meeting-center', { meeting: placement.recording })}">录音管理</a>${cancel}</td></tr>`;
        });
        target.innerHTML = `<div class="fp-callout">录音由三方录音服务同步，本空间只展示归位到这里的那一条；同一份录音归位到别的空间时，各空间结果独立，互相看不到。</div>
          ${F.canWrite(w) ? `<div class="fp-actions u-mt3">${F.button('关联我的录音', 'placement-add', w.id, true)}<span class="u-t3">从已同步的录音里挑一份关联进来，并指定本空间的一条商机。</span></div>` : w.state === 'frozen' ? '<p class="fp-readonly u-mt3">空间已冻结，不可新增或取消归位；已有归位仍可回听。</p>' : ''}
          ${F.table(['录音', '关联商机', '客户信息处理状态', '行为记录', '操作'], rows, { caption: `${w.customer} 的客户录音归位`, emptyMessage: '当前客户空间尚无归位录音；录音同步进来后可在此关联。', countLabel: '条归位录音', compact: true })}`;
      }
      if (tab === 'followup' && sub === 'solutions') {
        const rows = F.records('solutions').filter(r => r.space === w.id && (!r.withdrawn || (F.role === 'SOL' && r.author === F.actor.id)));
        target.innerHTML = rows.length ? rows.map(r => `<article class="fp-event"><div class="fp-actions"><strong>${e(r.title)}</strong>${F.solutionStatus(r).key === 'withdrawn' ? F.badge('已撤回', 'neutral') : F.badge(r.reply ? '已回复' : r.read ? '已读' : '未读', r.reply ? 'green' : 'brand')}</div><p>${e(r.body)}</p><div class="fp-solution-assets">${(r.attachments || []).map(file => `<span class="fp-file-chip">${e(file.name)} <small>${e(file.size || '')}</small></span>`).join('')}${r.externalLink ? `<a class="fp-link-chip" href="${e(r.externalLink)}" target="_blank" rel="noreferrer">外部链接</a>` : ''}</div><small>${e(F.name(r.author))} · ${e(r.date)}${r.readAt ? ' · 已读 ' + e(r.readAt) : ''}</small>${r.reply ? `<div class="fp-callout u-mt3">销售回复：${e(r.reply)}<small class="fp-sub">${r.replyRead ? '方案人员已读' : '方案人员未读'}</small></div>` : ''}<div class="fp-actions u-mt3">${F.role === 'SLS' ? F.button('查看并回复', 'solution', r.id) : F.button('查看详情', 'solution', r.id)}</div></article>`).join('') : F.empty('当前空间尚未收到方案。');
      }
      const syncUrl = () => history.replaceState(null, '', F.link('followup-workbench', { space: spaceId, tab, ...(tab === 'followup' ? { sub } : {}) }));
      root.querySelector('[name=space]').onchange = event => { spaceId = event.target.value; syncUrl(); draw(); };
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; syncUrl(); draw(); });
      root.querySelectorAll('[data-subtab]').forEach(b => b.onclick = () => { sub = b.dataset.subtab; syncUrl(); draw(); });
      // 空间助手自由提问：与快捷问题同一判定链路，无依据时不编造答案。
      const qaForm = target.querySelector('[data-qa-form]');
      if (qaForm) qaForm.addEventListener('submit', event => {
        event.preventDefault();
        const question = String(qaForm.elements.question.value || '').trim();
        if (!question) return;
        try {
          const result = F.askSpace(spaceId, question);
          draw();
          SC.toast(result.hasEvidence ? '已按当前空间上下文作答。' : '当前空间没有可用依据，未生成推测答案。', result.hasEvidence ? 'ok' : 'bad');
        } catch (error) { SC.toast(error.message, 'bad'); }
      });
    }
    F.bind(root, {
      followup: id => F.followupForm(id, draw), weekly: id => F.weeklyReviewForm(id, draw),
      send: id => F.solutionForm(id, draw), solution: id => F.solutionDetail(id, draw),
      'space-history': id => { const space = F.space(id); if (space) openLifecycle(space); },
      'space-mark': id => F.spaceMarkForm(id, draw),
      'behavior-open': id => openBehavior(id),
      'space-retry': id => { F.retrySpace(id); draw(); SC.toast('空间内容已恢复为就绪；生命周期状态保持不变。', 'ok'); },
      source: ref => openSource(ref),
      'goto-overview': () => { tab = 'overview'; draw(); },
      'changes-all': () => {
        const space = F.space(spaceId);
        const changes = F.changesOf(spaceId);
        F.drawer('客户信息变化历史 · ' + space.customer, `<div class="fp-stack" data-change-history>${changes.map(change => changeCard(change, space)).join('') || '<p class="u-t3">暂无变化记录。</p>'}</div>`, mask => F.bind(mask, { source: ref => openSource(ref) }));
      },
      ask: question => { const result = F.askSpace(spaceId, question); draw(); SC.toast(result.hasEvidence ? '已按当前空间上下文作答。' : '当前空间没有可用依据，未生成推测答案。', result.hasEvidence ? 'ok' : 'bad'); },
      // R10 从空间侧反向关联录音：与录音管理侧归位等价，同样必须指定本空间的一条商机。
      'placement-add': id => { const space = F.space(id); if (space) openPlacement(space); },
      'placement-cancel': id => { try { F.cancelPlacement(id); draw(); SC.toast('已取消该条归位，录音与其他归位不受影响。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } },
      'placement-change': id => {
        const space = F.space(spaceId);
        const change = space && F.changesOf(spaceId).find(item => item.id === id);
        if (!change) { SC.toast('该次变化不在当前可见范围。', 'bad'); return; }
        F.drawer('本次变化详情 · ' + change.id, `<div class="fp-stack" data-change-detail>${changeCard(change, space)}</div>`, mask => F.bind(mask, { source: ref => openSource(ref) }));
      },
      'doc-upload': id => { const space = F.space(id); if (space) openUpload(space); },
      'doc-retry': id => { F.retryDocument(id); draw(); SC.toast('该份资料已重新挂载，同批其他结果未受影响。', 'ok'); },
      task: id => { F.mutate('完成跟进任务', s => { const t = s.tasks.find(t => t.id === id); if (!t || !F.canWrite(F.space(t.space, s))) throw Error('当前任务不可操作。'); t.done = true; }); draw(); SC.toast('任务已完成', 'ok'); }
    });
    draw();
    if (SC.param('solution')) F.solutionDetail(SC.param('solution'), draw);
    // R12：客户更新类提醒直达对应那次变化详情，而不是只落到最新概览。
    const changeParam = SC.param('change');
    if (changeParam) {
      const space = F.space(spaceId);
      const change = space && F.changesOf(spaceId).find(item => item.id === changeParam);
      if (change) F.drawer('本次变化详情 · ' + change.id, `<div class="fp-stack" data-change-detail>${changeCard(change, space)}</div>`, mask => F.bind(mask, { source: ref => openSource(ref) }));
    }
    // R15：行为记录直达，打开对应记录详情抽屉。
    const behaviorParam = SC.param('behavior');
    if (behaviorParam) openBehavior(behaviorParam);
  };
})(window.SC, window.SC.FEATURES);
