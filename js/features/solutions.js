/** 方案协同与消息：清单进入空间，打开标记已读，一次回复闭环；撤回和催办重用模型校验。 */
(function (SC, F) {
  'use strict';
  const e = F.e;

  const solutionNav = active => `<nav class="fp-subnav" aria-label="方案协同工作区">
    <a class="${active === 'workbench' ? 'is-active' : ''}" href="${F.link('solution-workbench')}">方案人员工作台</a>
    <a class="${active === 'push' ? 'is-active' : ''}" href="${F.link('solution-push')}">方案推送</a>
    <a class="${active === 'feedback' ? 'is-active' : ''}" href="${F.link('solution-feedback')}">反馈看板</a>
  </nav>`;

  const solutionAttachments = record => {
    const attachments = (record.attachments || []).map(file => `<span class="fp-file-chip">${e(file.name)} <small>${e(file.size || '')}</small></span>`).join('');
    const link = record.externalLink ? `<a class="fp-link-chip" href="${e(record.externalLink)}" target="_blank" rel="noreferrer">打开外部链接</a>` : '';
    return attachments || link ? `<div class="fp-solution-assets">${attachments}${link}</div>` : '<span class="u-t3">无附件或外部链接</span>';
  };

  const solutionStatus = record => {
    const status = F.solutionStatus(record);
    return F.badge(status.label, status.tone);
  };

  function renderSolutionEventSummary(record) {
    const events = Array.isArray(record.eventLog) ? record.eventLog : [];
    const labels = { sent: '已提交', read: '已读', reply: '已回复', remind: '已催办', withdraw: '已撤回' };
    return events.length ? `<div class="fp-event-summary">${events.slice(-4).map(event => `<span>${e(labels[event.type] || event.type)} · ${e(event.at || '')}</span>`).join('')}</div>` : '<span class="u-t3">暂无操作事件</span>';
  }

  function openSpacePreview(spaceId, done) {
    const state = F.load();
    const space = F.space(spaceId, state);
    if (!space) { SC.toast('该空间已不在当前承接范围内。', 'bad'); return; }
    const frozen = space.state === 'frozen';
    const changes = F.changesOf(space.id, state).slice(0, 3);
    const docs = state.documents.filter(doc => doc.space === space.id);
    F.drawer('空间全景 · ' + space.customer, `<div class="fp-stack" data-workbench-space="${e(space.id)}">
      <div class="fp-actions">${F.badge(frozen ? '已冻结 · 只读' : '正常空间', frozen ? 'neutral' : 'green')}${F.badge(space.pool, 'brand')}<span class="u-t3">${e(space.id)}</span></div>
      <dl class="fp-kv"><dt>归属销售</dt><dd>${e(F.name(space.sales))}</dd><dt>经营阶段</dt><dd>${e(space.stage)}</dd><dt>确权来源</dt><dd>${e(space.entitlementType === 'customer_only' ? '客户级确权' : '客户级 + 商机级')}</dd><dt>内容版本</dt><dd>${e(space.lastReadableVersion || '—')}</dd></dl>
      <section class="fp-panel fp-pad"><h3>当前客户全景</h3><p>${e(space.brief)}</p><p class="fp-hint u-mt2">当前工作台只展示全景摘要；完整五入口内容可进入客户空间查看。</p></section>
      <section class="fp-panel fp-pad"><h3>最近变化</h3>${changes.length ? `<ul class="fp-compact-list">${changes.map(change => `<li><strong>${e(change.sourceLabel)}</strong><span>${e(change.status === 'done' ? '已更新' : change.status === 'failed' ? '更新失败' : '处理中')} · ${e(change.at)}</span></li>`).join('')}</ul>` : '<p class="u-t3">暂无近期变化。</p>'}</section>
      <div class="fp-actions"><a class="btn btn--primary" href="${F.link('followup-workbench', { space: space.id, tab: 'overview' })}">进入完整客户空间</a>${!frozen && F.canUpload(space, state) ? F.button('补充外部资料', 'workbench-upload', space.id) : '<span class="fp-readonly">冻结空间不开放资料写入</span>'}</div>
      <p class="fp-hint">当前空间已有 ${docs.length} 份资料；资料会逐份校验并触发概览更新。</p>
    </div>`, (mask) => F.bind(mask, { 'workbench-upload': id => openWorkbenchUpload(id, done) }));
  }

  function openWorkbenchUpload(spaceId, done) {
    const state = F.load();
    const space = F.space(spaceId, state);
    if (!space || !F.canUpload(space, state)) { SC.toast('当前空间不可补充资料。', 'bad'); return; }
    const samples = F.documentSamples;
    F.drawer('补充外部资料 · ' + space.customer, `<form class="fp-form" data-workbench-upload>
      <div class="fp-callout">资料会写入 <strong>${e(space.customer)}</strong> 的当前空间，不与同客户其他销售空间共享。</div>
      <fieldset class="fp-checks"><legend>选择资料（可多选）</legend>${samples.map(sample => `<label><input type="checkbox" name="docs" value="${e(sample.key)}"><span>${e(sample.name)}<small>${e(sample.size)}</small></span></label>`).join('')}</fieldset>
      <p class="fp-error" role="alert"></p><footer class="fp-form-foot"><span class="u-t3">支持 .md；每份文件单独返回结果。</span><button type="submit" class="btn btn--primary">开始处理</button></footer>
    </form>`, (mask, close) => {
      mask.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        const keys = [...form.querySelectorAll('[name=docs]:checked')].map(node => node.value);
        try {
          if (!keys.length) throw Error('至少选择一份资料。');
          const results = F.uploadDocuments(spaceId, keys);
          close(); done?.();
          F.drawer('资料处理结果', `<div class="fp-stack"><p class="fp-hint">成功结果不会被单份失败覆盖；失败资料可在客户空间资料 Tab 单份重试。</p><ul class="fp-upload-results">${results.map((item, index) => `<li data-upload-result="${e(item.status)}"><span class="fp-upload-index">${index + 1}</span><div><strong>${e(item.name)}</strong>${F.badge(item.status === 'success' ? '已挂载' : item.status === 'duplicate' ? '重复资料' : '处理失败', item.status === 'success' ? 'green' : item.status === 'duplicate' ? 'neutral' : 'amber')}<small>${e(item.reason || item.note || '已进入资料处理队列。')}</small></div></li>`).join('')}</ul></div>`);
        } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
      };
    });
  }

  /** R07 方案人员工作台：客户去重聚合，展开客户后再进入销售空间。 */
  F.views['solution-workbench'] = function (root) {
    let period = SC.param('period') || 'today';
    let query = {};
    const expanded = new Set();
    const periodStart = value => value === 'month' ? '2026-09-01' : value === 'week' ? '2026-09-09' : F.today;
    const inPeriod = (date, value = period) => String(date || '').slice(0, 10) >= periodStart(value);
    const groups = () => {
      const state = F.load();
      const map = new Map();
      F.visible().forEach(space => {
        if (!map.has(space.customerId)) map.set(space.customerId, { customerId: space.customerId, customer: space.customer, industry: space.industry, spaces: [] });
        map.get(space.customerId).spaces.push(space);
      });
      return [...map.values()].map(group => {
        group.updated = group.spaces.some(space => F.changesOf(space.id, state).some(change => inPeriod(change.at) && change.status !== 'nochange'));
        group.latest = group.spaces.flatMap(space => F.changesOf(space.id, state)).sort((a, b) => String(b.at).localeCompare(String(a.at)))[0]?.at || '';
        return group;
      }).filter(group => !query.q || `${group.customer} ${group.industry} ${group.customerId}`.includes(query.q.trim())).sort((a, b) => query.sort === 'name' ? a.customer.localeCompare(b.customer, 'zh-CN') : String(b.latest).localeCompare(String(a.latest)));
    };
    function draw() {
      const state = F.load();
      const spaces = F.visible();
      const groupsAll = [...new Map(spaces.map(space => [space.customerId, space])).values()];
      const followups = F.records('followups', state).filter(record => inPeriod(record.date));
      const changes = spaces.filter(space => F.changesOf(space.id, state).some(change => inPeriod(change.at) && change.status !== 'nochange'));
      const authored = F.records('solutions', state).filter(record => record.author === F.actor.id && !record.withdrawn && inPeriod(record.date));
      const industries = [...new Set(spaces.map(space => space.industry))].map(industry => [industry, groupsAll.filter(space => space.industry === industry).length]);
      const totalIndustry = Math.max(1, groupsAll.length);
      root.innerHTML = solutionNav('workbench') + `<div class="fp-callout fp-workbench-hero"><div><strong>按客户组织方案工作</strong><p>先定位承接客户，再展开其下销售空间；工作台只提示变化，完整客户全景在空间内查看。</p></div><div class="fp-actions"><a class="btn btn--primary" href="${F.link('solution-push')}">发起方案推送</a><a class="btn" href="${F.link('solution-feedback')}">查看反馈看板</a></div></div>` + F.metrics([['承接客户', new Set(spaces.map(space => space.customerId)).size, '客户去重'], ['今日有更新', new Set(changes.map(space => space.customerId)).size, '同客户多个空间只计 1'], ['跟进记录', followups.length, period === 'today' ? '本日' : period === 'week' ? '本周' : '本月'], ['方案已读 / 未读', `${authored.filter(record => record.read).length} / ${authored.filter(record => !record.read).length}`, '本人推送且未撤回']]) + `<div class="fp-workbench-grid"><section class="fp-panel"><header class="fp-panel-head"><div><h2>承接客户</h2><p class="fp-hint">客户只出现一次，展开后查看销售空间。</p></div><div class="fp-actions">${F.field('统计周期', 'period', period, 'select', [['today', '本日'], ['week', '本周'], ['month', '本月']])}</div></header>${F.searchbar('搜索客户名称 / 行业', F.field('排序', 'sort', query.sort || 'updated', 'select', [['updated', '最近更新'], ['name', '客户名称']]))}<div data-workbench-results></div></section><aside class="fp-panel fp-pad"><h2>行业客户占比</h2><p class="fp-hint">按承接客户去重计算，缺失行业单独展示。</p><div class="fp-industry-list">${industries.map(([industry, count]) => `<div class="fp-bar-row"><span>${e(industry || '行业缺失')}</span><div class="fp-bar"><i style="width:${count / totalIndustry * 100}%"></i></div><strong>${Math.round(count / totalIndustry * 100)}%</strong></div>`).join('') || '<p class="u-t3">暂无承接客户。</p>'}</div><div class="fp-callout u-mt4">${changes.length ? `有 ${new Set(changes.map(space => space.customerId)).size} 个客户在${period === 'today' ? '今日' : period === 'week' ? '本周' : '本月'}发生有效更新。` : '当前周期没有有效更新，列表不会虚构提醒。'}</div></aside></div>`;
      const result = root.querySelector('[data-workbench-results]');
      const rows = groups().map(group => `<article class="fp-customer-row ${expanded.has(group.customerId) ? 'is-expanded' : ''}" data-customer-row="${e(group.customerId)}"><button type="button" class="fp-customer-toggle" data-action="customer-expand" data-value="${e(group.customerId)}" aria-expanded="${expanded.has(group.customerId)}"><span class="fp-customer-chevron" aria-hidden="true">${expanded.has(group.customerId) ? '⌄' : '›'}</span><span class="fp-avatar">${e(group.customer.slice(0, 1))}</span><span class="u-grow"><strong>${e(group.customer)}</strong><small>${e(group.industry)} · ${group.spaces.length} 个销售空间</small></span>${group.updated ? F.badge('今日有更新', 'brand') : '<span class="u-t3">暂无本期更新</span>'}</button>${expanded.has(group.customerId) ? `<div class="fp-customer-spaces">${group.spaces.map(space => `<div class="fp-space-row"><div class="u-grow"><div class="fp-actions"><strong>${e(F.name(space.sales))}</strong>${F.badge(space.state === 'frozen' ? '已冻结 · 只读' : '正常', space.state === 'frozen' ? 'neutral' : 'green')}${F.badge(space.readiness === 'failed' ? '内容失败' : space.readiness === 'updating' ? '更新中' : '已就绪', space.readiness === 'failed' ? 'amber' : space.readiness === 'updating' ? 'brand' : 'green')}</div><small>${e(space.pool)} · ${e(space.id)} · ${e(space.brief)}</small></div><div class="fp-actions"><button type="button" class="btn" data-action="space-preview" data-value="${e(space.id)}">查看全景</button><a class="btn" href="${F.link('followup-workbench', { space: space.id, tab: 'overview' })}">打开空间</a></div></div>`).join('')}</div>` : ''}</article>`).join('');
      result.innerHTML = rows || F.empty(query.q ? '未找到匹配的承接客户，请调整搜索条件。' : '当前没有承接客户，联系超管配置承接池。', query.q ? '未找到客户' : '暂无承接客户');
      F.handleSearch(root, values => { query = values; draw(); });
      root.querySelector('[name=period]').onchange = event => { period = event.target.value; draw(); };
      root.querySelectorAll('[data-action="customer-expand"]').forEach(button => button.setAttribute('aria-label', `${button.getAttribute('aria-expanded') === 'true' ? '收起' : '展开'}客户 ${button.closest('[data-customer-row]').querySelector('strong').textContent}`));
    }
    F.bind(root, {
      'customer-expand': id => { expanded.has(id) ? expanded.delete(id) : expanded.add(id); draw(); },
      'space-preview': id => openSpacePreview(id, draw)
    });
    draw();
  };

  /** R08 独立推送入口，保留最近提交结果，正式状态仍归属于客户空间。 */
  F.views['solution-push'] = function (root) {
    function draw() {
      const records = F.records('solutions').filter(record => record.author === F.actor.id);
      root.innerHTML = solutionNav('push') + F.metrics([['可推送空间', F.visible().filter(space => space.state === 'active').length, '承接池内正常空间'], ['本次提交', records.filter(record => record.date.startsWith(F.today)).length, '今日本人提交'], ['已生成记录', records.filter(record => !record.withdrawn).length, '按空间独立记录'], ['待反馈', records.filter(record => !record.withdrawn && !record.reply).length, '未回复方案']]) + `<section class="fp-panel"><header class="fp-panel-head"><div><h2>方案推送</h2><p class="fp-hint">正文是必填项；附件和外部链接会跟随每个空间独立留存。</p></div>${F.button('编辑并推送方案', 'compose', '', true)}</header><div class="fp-pad"><div class="fp-callout">冻结空间不会出现在接收空间列表；推送完成后每个空间都有独立的已读、回复、撤回和催办状态。</div></div>${F.table(['方案 / 空间', '接收销售', '推送时间', '内容资产', '当前状态', '操作'], records.filter(record => !record.withdrawn).map(record => { const space = F.space(record.space); return `<tr><td><strong>${e(record.title)}</strong><small>${e(space?.customer || record.space)} · ${e(record.space)}</small></td><td>${e(space ? F.name(space.sales) : '—')}</td><td>${e(record.date)}</td><td>${solutionAttachments(record)}</td><td>${solutionStatus(record)}</td><td>${F.button('查看详情', 'detail', record.id)}</td></tr>`; }), { caption: '方案推送记录', emptyMessage: '还没有方案推送记录。点击“编辑并推送方案”开始。', countLabel: '条方案', compact: true })}</section>`;
    }
    F.bind(root, { compose: () => F.solutionForm('', draw), detail: id => F.solutionDetail(id, draw) });
    draw();
  };

  /** R08 反馈看板：以本人推送为口径，保留撤回记录并显式展示催办条件。 */
  F.views['solution-feedback'] = function (root) {
    let tab = SC.param('tab') || 'all';
    let query = {};
    /**
     * 当前承接范围内的方案仍遵守可见性校验；已撤回方案作为发起方审计记录保留。
     * 这样承接池发生变化后不会继续暴露旧空间的可操作方案，但不会抹掉撤回事实。
     */
    function list() {
      const state = F.load();
      return state.solutions.filter(record => record.author === F.actor.id && (F.space(record.space, state) || record.withdrawn));
    }
    function filtered() {
      return list().filter(record => {
        const state = F.solutionStatus(record).key;
        return (!query.q || `${record.title} ${F.space(record.space)?.customer || ''}`.includes(query.q.trim())) && (tab === 'all' || state === tab) && (!query.period || query.period === 'all' || String(record.date).slice(0, 10) >= (query.period === 'today' ? F.today : query.period === 'week' ? '2026-09-09' : '2026-09-01'));
      });
    }
    function draw() {
      const records = list();
      root.innerHTML = solutionNav('feedback') + F.metrics([['全部推送', records.length, '含撤回记录'], ['未读', records.filter(record => F.solutionStatus(record).key === 'unread').length, '可催办'], ['已读待回复', records.filter(record => F.solutionStatus(record).key === 'pending').length, '仍可催办'], ['已回复', records.filter(record => F.solutionStatus(record).key === 'replied').length, '已完成反馈']]) + `<section class="fp-panel"><header class="fp-panel-head"><div><h2>反馈看板</h2><p class="fp-hint">按空间查看本人推送的阅读、回复和催办进度；撤回记录只保留在发起方看板。</p></div><a class="btn btn--primary" href="${F.link('solution-push')}">继续推送</a></header>${F.tabs([['all', '全部'], ['unread', '未读'], ['pending', '已读待回复'], ['replied', '已回复'], ['withdrawn', '已撤回']], tab)}${F.searchbar('搜索方案 / 客户名称', F.field('时间范围', 'period', query.period || 'all', 'select', [['all', '全部时间'], ['today', '本日'], ['week', '本周'], ['month', '本月']]))}<div data-feedback-results></div></section>`;
      const rows = filtered().map(record => {
        const state = F.load();
        const space = F.space(record.space, state) || (record.withdrawn ? state.spaces.find(item => item.id === record.space) : null);
        const status = F.solutionStatus(record);
        const canRemind = !record.withdrawn && !record.reply && space?.state === 'active';
        const remindText = record.remindedAt ? `已催办 ${record.remindCount || 0} 次 · ${e(record.remindedAt)}` : '尚未催办';
        const remindAction = canRemind ? F.button('催办', 'remind', record.id) : record.reply ? '<span class="u-t3">已回复，无需催办</span>' : record.withdrawn ? '<span class="u-t3">撤回记录</span>' : '<span class="u-t3">空间冻结</span>';
        return `<tr><td><strong>${e(record.title)}</strong><small>${e(space?.customer || record.space)} · ${e(record.space)}</small></td><td>${e(space ? F.name(space.sales) : '—')}</td><td>${e(record.date)}<small>${record.readAt ? '已读 ' + e(record.readAt) : record.withdrawn ? '—' : `未读 ${F.solutionUnreadDays(record)} 天`}</small></td><td>${solutionStatus(record)}${record.reply ? `<small>${e(record.reply)}</small>` : ''}</td><td>${e(remindText)}</td><td>${F.button('查看详情', 'detail', record.id)}${space && !record.withdrawn ? `<a href="${F.link('followup-workbench', { space: space.id, tab: 'solutions', solution: record.id })}">回到空间</a>` : ''}${remindAction}</td></tr>`;
      });
      root.querySelector('[data-feedback-results]').innerHTML = F.table(['方案 / 客户空间', '接收销售', '推送 / 阅读', '反馈状态', '催办记录', '操作'], rows, { caption: '方案反馈看板', emptyMessage: '当前筛选没有方案反馈记录。', countLabel: '条方案', compact: true });
      F.handleSearch(root, values => { query = values; draw(); });
      root.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { tab = button.dataset.tab; draw(); });
    }
    F.bind(root, {
      detail: id => F.solutionDetail(id, draw),
      remind: id => { F.solutionAction(id, 'remind'); draw(); SC.toast('已生成一条方案催办提醒', 'ok'); }
    });
    draw();
  };
  F.solutionDetail = function (id, done) {
    const state = F.load();
    let r = state.solutions.find(item => item.id === id && (F.space(item.space, state) || (item.withdrawn && F.role === 'SOL' && item.author === F.actor.id)));
    if (!r) { SC.toast('方案已撤回或不在当前可见范围。', 'bad'); return; }
    if (F.role === 'SLS' && !r.read) F.solutionAction(id, 'read');
    if (F.role === 'SOL' && r.author === F.actor.id && r.reply && !r.replyRead) F.solutionAction(id, 'replyRead');
    r = F.load().solutions.find(x => x.id === id);
    const w = F.space(r.space, state) || (withdrawn ? state.spaces.find(item => item.id === r.space) : null);
    if (!w) { SC.toast('关联空间已不在当前可见范围。', 'bad'); return; }
    const withdrawn = !!r.withdrawn;
    F.drawer(r.title, `<div class="fp-stack"><div class="fp-actions">${solutionStatus(r)}${F.badge(w.pool)}${withdrawn ? F.badge('仅发起方可见', 'neutral') : ''}</div><dl class="fp-kv"><dt>客户</dt><dd>${e(w.customer)}</dd><dt>接收销售</dt><dd>${e(F.name(w.sales))}</dd><dt>方案人员</dt><dd>${e(F.name(r.author))}</dd><dt>推送时间</dt><dd>${e(r.date)}</dd><dt>已读时间</dt><dd>${e(r.readAt || '尚未打开')}</dd><dt>催办记录</dt><dd>${e(r.remindCount || 0)} 次${r.remindedAt ? ' · 最近 ' + e(r.remindedAt) : ''}</dd></dl>${withdrawn ? '<div class="fp-callout fp-callout--warn">该方案已撤回，销售侧入口已移除；此处保留发起方审计记录。</div>' : ''}<div class="fp-callout">${e(r.body)}</div><section class="fp-panel fp-pad"><h3>方案附件与外链</h3>${solutionAttachments(r)}</section>${r.reply ? `<section class="fp-panel fp-pad"><h3>销售回复</h3><p>${e(r.reply)}</p><span class="u-t3">${r.replyRead ? '方案人员已读' : '方案人员未读'}</span></section>` : withdrawn ? '' : F.canWrite(w) ? `<form class="fp-form">${F.field('销售回复 *', 'reply', '', 'textarea')}<p class="fp-hint">提交一次即完成本条方案的回复。</p><p class="fp-error" role="alert"></p><button type="submit" class="btn btn--primary">确认回复</button></form>` : '<p class="fp-readonly">等待销售回复；冻结空间仅可查看历史往来。</p>'}<div class="fp-panel fp-pad"><h3>协同事件</h3>${renderSolutionEventSummary(r)}</div><div class="fp-actions">${F.role === 'SOL' && r.author === F.actor.id && !withdrawn ? (!r.read ? F.button('撤回未读方案', 'withdraw', r.id) : '') + (!r.reply && w.state === 'active' ? F.button('提醒销售', 'remind', r.id) : '') : ''}${!withdrawn ? `<a class="btn" href="${F.link('followup-workbench', { space: w.id, tab: 'solutions', solution: r.id })}">进入客户空间</a>` : ''}</div></div>`, (mask, close) => {
      mask.querySelector('form')?.addEventListener('submit', event => {
        event.preventDefault();
        try { F.solutionAction(id, 'reply', new FormData(event.currentTarget).get('reply')); close(); done?.(); SC.toast('回复已提交，方案人员可查看', 'ok'); }
        catch (error) { mask.querySelector('.fp-error').textContent = error.message; }
      });
      F.bind(mask, { withdraw: () => { F.solutionAction(id, 'withdraw'); close(); done?.(); SC.toast('方案及未读提醒已撤回', 'ok'); }, remind: () => { F.solutionAction(id, 'remind'); close(); done?.(); SC.toast('已生成一条方案催办提醒', 'ok'); } });
    });
    done?.();
  };
  F.views['solution-center'] = function (root) {
    let query = {}, tab = 'all';
    const list = () => F.records('solutions').filter(r => !r.withdrawn);
    function draw() {
      root.innerHTML = `<div class="fp-callout">${F.role === 'SOL' ? '承接范围：' + e((F.load().assignments[F.actor.id] || []).join('、') || '尚未配置承接池') + '。推送到空间即定向给该空间的销售。' : '方案与客户空间关联。查看正文、附件和回复时进入对应空间。'}</div>` + F.panel('方案往来', F.tabs([['all', '全部方案'], ['unread', '销售未读'], ['pending', '已读待回复'], ['replied', '已回复']], tab) + F.searchbar('搜索方案 / 客户名称', F.field('客户池', 'pool', '', 'select', [['', '全部可见客户池'], ...[...new Set(F.visible().map(w => w.pool))]])) + '<div data-results></div>', F.role === 'SOL' ? F.button('推送方案', 'send', '', true) : '');
      filter(query); F.handleSearch(root, filter);
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    }
    function filter(q = {}) {
      query = q; F.restoreSearch(root, q);
      const records = list().filter(r => (!q.q || (r.title + F.space(r.space).customer).includes(q.q.trim())) && (!q.pool || F.space(r.space).pool === q.pool) && (tab === 'all' || (tab === 'unread' ? !r.read : tab === 'pending' ? r.read && !r.reply : !!r.reply)));
      root.querySelector('[data-results]').innerHTML = F.table(['方案 / 客户', '客户池', '接收销售', '推送时间', '状态', '操作'], records.map(r => { const w = F.space(r.space); return `<tr><td><strong>${e(r.title)}</strong><small>${e(w.customer)}</small></td><td>${e(w.pool)}</td><td>${e(F.name(w.sales))}</td><td>${e(r.date)}</td><td>${F.badge(r.reply ? '已回复' : r.read ? '已读待回复' : '未读', r.reply ? 'green' : 'brand')}${!r.read ? '<small>自 ' + e(r.date.slice(5, 10)) + ' 起未读</small>' : ''}</td><td>${F.role === 'SLS' ? `<a href="${F.link('followup-workbench', { space: w.id, tab: 'solutions', solution: r.id })}">进入空间查看</a>` : F.button('查看反馈', 'detail', r.id)}</td></tr>`; }), { caption: '客户方案推送与反馈记录', emptyMessage: '没有符合条件的方案，请调整方案名称、客户池或状态筛选。', countLabel: '条方案', note: '各空间独立记录已读与回复', totalCount: list().length });
    }
    F.bind(root, { detail: id => F.solutionDetail(id, draw), send: () => F.solutionForm('', draw) });
    draw();
  };
  /**
   * R12 通用收件箱：只展示发给本人的提醒，未读优先、按时间排序。
   * 推送失败在站内标注未送达（站内必达兜底）；来源无权或已终止时保留历史提醒但不给内容入口。
   */
  F.views['message-center'] = function (root) {
    let tab = 'unread';
    const pushFailed = n => ['failed', 'not_installed', 'timeout'].includes(n.pushStatus);
    /** 计算直达目标；空间按当前权限判定，无权时不返回内容入口。 */
    function targetFor(n, state) {
      if (n.link && n.link.page) {
        if (n.link.page === 'followup-workbench' && !F.space(n.link.params?.space || n.space, state)) return null;
        return F.link(n.link.page, n.link.params || {});
      }
      if (n.space && F.space(n.space, state)) return F.link('followup-workbench', { space: n.space });
      return null;
    }
    function rows(state) {
      const mine = state.notifications.filter(n => n.recipient === F.actor.id && n.status !== 'waiting');
      // 兼容旧快照：方案推送/回复在提醒模型上线前由方案记录派生，避免历史往来在收件箱丢失。
      const solutions = F.records('solutions', state).filter(r => !r.withdrawn);
      const derivedPush = F.role === 'SLS' ? solutions
        .filter(r => !mine.some(n => n.solution === r.id && n.type === '方案推送'))
        .map(r => ({ id: 'derived-' + r.id, derivedAction: 'read', recipient: F.actor.id, space: r.space, solution: r.id, title: '你收到一份新方案', text: r.title, read: r.read, type: '方案推送', createdAt: r.date, pushStatus: 'not_required', link: { page: 'followup-workbench', params: { space: r.space, tab: 'solutions', solution: r.id } } }))
        : [];
      const derivedReply = F.role === 'SOL' ? solutions
        .filter(r => r.author === F.actor.id && r.reply && !mine.some(n => n.solution === r.id && n.type === '方案回复'))
        .map(r => ({ id: 'derived-' + r.id, derivedAction: 'replyRead', recipient: F.actor.id, space: r.space, solution: r.id, title: '销售回复了方案', text: r.title + '：' + r.reply, read: !!r.replyRead, type: '方案回复', createdAt: r.replyDate || r.date, pushStatus: 'not_required', link: { page: 'solution-feedback', params: { tab: 'replied' } } }))
        : [];
      // 方案撤回后其推送与催办提醒失效；撤回事实本身保留在发起方反馈看板。
      return [...mine, ...derivedPush, ...derivedReply]
        .filter(n => !(n.solution && ['方案推送', '方案提醒'].includes(n.type)) || state.solutions.some(r => r.id === n.solution && !r.withdrawn))
        .sort((a, b) => (a.read - b.read) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }
    function draw() {
      const s = F.load();
      const all = rows(s);
      const filtered = all.filter(n => tab === 'all' || (tab === 'unread' ? !n.read : n.read));
      root.innerHTML = F.panel('收件箱', F.tabs([['unread', '未读 · ' + all.filter(n => !n.read).length], ['read', '已读'], ['all', '全部消息']], tab) + `<p class="fp-hint u-mt2">站内消息必达；移动端推送只承担唤回，失败时本条仍保留并标注未送达。</p>` + (filtered.length ? filtered.map(n => {
        const space = n.space && s.spaces.find(item => item.id === n.space);
        const target = targetFor(n, s);
        return `<article class="fp-message ${n.read ? 'is-read' : ''}" data-message-row data-type="${e(n.type)}"><span class="fp-unread"></span><div class="u-grow"><div class="fp-actions"><strong>${e(n.title)}</strong>${F.badge(n.type)}${pushFailed(n) ? `<span title="${e(n.pushFailReason || '推送未送达')}">${F.badge('推送未送达', 'amber')}</span>` : ''}</div><p>${e(n.text)}</p><small class="u-t3">${e(n.createdAt || '')}${space ? ` · ${e(space.customer)} · ${e(space.pool || '待补客户池')}` : ''}${n.deduped ? ` · 已合并 ${n.deduped} 次重复触发` : ''}</small></div>${target ? `<a class="btn" data-message="${e(n.id)}" href="${target}">${n.type === '运营异常' ? '进入异常详情' : n.changeId ? '查看本次变化' : '进入来源'}</a>` : '<span class="fp-readonly">来源已不可访问，保留历史提醒。</span>'}</article>`;
      }).join('') : F.empty('当前分类没有消息。切换到全部消息查看历史。')));
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
      root.querySelectorAll('[data-message]').forEach(a => a.onclick = () => {
        // 打开即已读；兼容派生条目时同步方案的已读/回复已读状态。
        if (a.dataset.message.startsWith('derived-')) {
          const row = rows(F.load()).find(item => item.id === a.dataset.message);
          try { if (row?.derivedAction) F.solutionAction(row.solution, row.derivedAction); } catch (_) { /* 已读失败不阻断跳转 */ }
          return;
        }
        const n = s.notifications.find(x => x.id === a.dataset.message);
        if (n) { n.read = true; F.save(s); }
      });
    }
    draw();
  };
})(window.SC, window.SC.FEATURES);
