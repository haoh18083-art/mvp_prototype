/*
 * R09 §4.2–§4.4 空间详情：五个常驻 Tab、默认落地概览、折叠区每次进入重新收起、
 * 深链直达客户 Tab 并高亮、冻结只读、离线只读缓存、跟进与周复盘写入、并发先提交为准。
 * 内容全部取自桌面同一套 F.overview / F.contentScope / F.spacePlacements 等函数。
 */

const SPACE_TABS = [['overview', '概览'], ['customer', '客户'], ['opps', '商机'], ['followup', '跟进'], ['documents', '资料']];
const SPACE_SUBS = [['followups', '跟进记录'], ['behaviors', '行为记录'], ['solutions', '方案往来'], ['recordings', '录音']];

/* 概览常显区固定五项，其余板块收进折叠区（M05-1 §4.2）。 */
const OVERVIEW_PINNED = ['verdict', 'blocker', 'people', 'recent'];
const OVERVIEW_FOLDED = ['who', 'basics', 'risk', 'opportunity', 'pending'];

function sourceList(sources) {
  if (!sources || !sources.length) return '<p class="record-meta">无原文依据，不输出结论。</p>';
  return `<div class="chip-row">${sources.map((item) => (item.available === false
    ? `<span class="source-chip is-broken" data-source-broken>${esc(item.label)} · 已失效</span>`
    : `<button type="button" class="source-chip" data-source="${esc(item.type + ':' + item.id)}">${esc(item.label)}</button>`)).join('')}</div>`;
}

/** 概览与变化里的依据都能点回原文；来源不可用时如实说明，不编造内容。 */
function openSource(ref) {
  const record = F.sourceRecord(ref);
  if (!record) { showToast('该来源已不在当前可见范围'); return; }
  openSheet(record.title, record.available
    ? `<pre class="sheet-pre" data-source-body>${esc(record.body || '原文暂无正文。')}</pre><p class="record-meta">${esc(record.at || '')} · ${esc(record.author || '')}</p>`
    : `<p class="record-warn" data-source-unavailable>来源不可用：${esc(record.unavailableReason || '原文已不可读。')}</p>`);
}

function changeBlock(change) {
  if (change.status === 'processing') return '<p class="detail-copy">客户信息正在更新，当前展示上一版内容。</p>';
  if (change.status === 'failed') return `<p class="record-warn">更新未完成：${esc(change.reason || '原内容保留。')}</p>`;
  if (change.status === 'nochange') return '<p class="detail-copy">处理完成，本次未发现客户信息变化。</p>';
  return `${change.added.length ? `<div data-change-added><strong>本次新增</strong><ul class="evidence-list">${change.added.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
    ${change.updated.length ? `<div data-change-updated><strong>更新前后</strong><ul class="evidence-list">${change.updated.map((item) => `<li>${esc(item.field)}：<del>${esc(item.before)}</del> → <ins>${esc(item.after)}</ins></li>`).join('')}</ul></div>` : ''}
    ${change.pendingConfirm.length ? `<div data-change-pending><strong>待确认</strong><ul class="evidence-list">${change.pendingConfirm.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
    ${!change.added.length && !change.updated.length && !change.pendingConfirm.length ? '<p class="detail-copy">本次更新没有可展示的差异。</p>' : ''}`;
}

function renderOverviewTab(space, state) {
  const panels = F.overview(space, state);
  const byKey = Object.fromEntries(panels.map((panel) => [panel.key, panel]));
  const changes = F.changesOf(space.id, state);
  const latest = changes[0];
  const qa = (state.spaceQA || []).filter((item) => item.space === space.id);
  const frozen = (space.lifecycle || space.state) === 'frozen';
  const contacts = 3;
  const card = (key) => {
    const panel = byKey[key];
    if (!panel) return '';
    return `<section class="overview-card" data-overview-panel="${esc(panel.key)}" data-panel-status="${esc(panel.status)}">
      <h3>${esc(panel.title)}${panel.status === 'pending' ? '<span class="state-chip is-updating">待确认</span>' : panel.status === 'conflict' ? '<span class="state-chip is-failed">存在冲突</span>' : ''}</h3>
      ${panel.text ? `<p>${esc(panel.text)}</p>${sourceList(panel.sources)}` : '<p class="record-meta" data-panel-empty>暂无信息，不编造内容。</p>'}
    </section>`;
  };
  return `<div class="space-body" data-space-tab="overview">
    ${latest ? `<section class="overview-card" data-change-latest><h3>最近一次变化</h3><p class="record-meta">${esc(latest.sourceLabel)} · ${esc(latest.at)}</p>${changeBlock(latest)}<div class="detail-actions"><button class="btn btn-secondary" type="button" data-open-change="${esc(latest.id)}">查看本次变化</button></div></section>` : '<section class="overview-card" data-change-latest><p class="record-meta">暂无内容更新记录。</p></section>'}
    ${card('verdict')}
    <section class="overview-card" data-space-qa><h3>快捷问答</h3>
      ${frozen
        ? '<p class="record-warn" data-qa-frozen>空间已冻结，不开放新的问答；历史对话仍可只读查看。</p>'
        : `<div class="chip-row">${F.quickQuestions.map(([key, label]) => `<button type="button" class="source-chip" data-ask="${esc(label)}">${esc(label)}</button>`).join('')}</div>
           <form class="qa-form" data-qa-form><input name="question" type="text" placeholder="向空间助手提问" aria-label="向空间助手提问" autocomplete="off"><button class="btn btn-primary" type="submit">提问</button></form>`}
      ${qa.length ? `<div class="qa-log">${qa.map((item) => `<article data-qa-item="${item.hasEvidence ? 'answered' : 'no-evidence'}"><strong>${esc(item.question)}</strong><p>${esc(item.answer)}</p>${sourceList(item.sources)}</article>`).join('')}</div>` : '<p class="record-meta">暂无问答记录。</p>'}
    </section>
    ${card('blocker')}
    <section class="overview-card" data-overview-panel="people"><h3>关键人与联系人</h3>
      <p>${esc(byKey.people?.text || '暂无信息')}</p>
      <div class="detail-actions"><button class="btn btn-secondary" type="button" data-deeplink="contacts">联系人 ${contacts} 人 · 查看明细</button></div></section>
    ${card('recent')}
    <section class="fold-group">${OVERVIEW_FOLDED.map((key) => {
      const panel = byKey[key];
      if (!panel) return '';
      return `<details class="fold-item" data-fold="${esc(key)}"><summary>${esc(panel.title)}</summary>
        ${panel.text ? `<p>${esc(panel.text)}</p>${sourceList(panel.sources)}` : '<p class="record-meta" data-panel-empty>暂无信息，不编造内容。</p>'}</details>`;
    }).join('')}
      <details class="fold-item" data-fold="co-followers"><summary>还有谁也在跟</summary>
        ${(() => {
          const peers = F.coFollowers(space, state);
          return peers.length
            ? `<ul class="evidence-list">${peers.map((peer) => `<li>${esc(peer.name)}<small>经营内容不可见</small></li>`).join('')}</ul>`
            : '<p class="record-meta">当前客户没有其他在跟销售。</p>';
        })()}</details>
    </section>
  </div>`;
}

function renderCustomerTab(space, state, highlight) {
  const peers = F.coFollowers(space, state);
  return `<div class="space-body" data-space-tab="customer">
    <section class="overview-card"><h3>客户画像</h3>
      <dl class="kv-list"><dt>核心需求</dt><dd>${esc(space.brief)}</dd><dt>关注产品</dt><dd>${esc((space.opps || []).map((o) => o.name).join('、') || '尚未确权')}</dd><dt>决策链</dt><dd>技术评估 → 采购确认 → 业务验收</dd></dl></section>
    <section class="overview-card${highlight === 'contacts' ? ' is-highlight' : ''}" data-block="contacts"><h3>客户信息与联系人</h3>
      <dl class="kv-list"><dt>客户名称</dt><dd>${esc(space.customer)}</dd><dt>所属行业</dt><dd>${esc(space.industry)}</dd><dt>客户等级</dt><dd>${esc(space.grade)}</dd><dt>第一关键人</dt><dd>${esc(space.contact)}</dd><dt>联系人数量</dt><dd>3 人</dd><dt>客户池来源</dt><dd>${space.customerPoolSource === 'pending' ? 'CRM 暂无客户池，待补充' : 'CRM 当前客户池'}</dd></dl></section>
    <section class="overview-card" data-co-followers><h3>同客户在跟名单</h3>
      ${peers.length ? `<ul class="evidence-list">${peers.map((peer) => `<li>${esc(peer.name)}<small>经营内容不可见</small></li>`).join('')}</ul>` : '<p class="record-meta">当前客户没有其他在跟销售。</p>'}</section>
  </div>`;
}

function renderOppsTab(space) {
  const opps = space.opps || [];
  return `<div class="space-body" data-space-tab="opps">
    ${opps.length ? opps.map((opp) => `<section class="overview-card"><h3>${esc(opp.name)}</h3><dl class="kv-list"><dt>商机编号</dt><dd>${esc(opp.id)}</dd><dt>金额</dt><dd>${esc(opp.amount)} 万元</dd><dt>经营阶段</dt><dd>${esc(opp.stage)}</dd></dl></section>`).join('')
      : emptyState(space.ownerOnly ? '仅客户级确权' : '暂无已确权商机', space.ownerOnly ? '当前没有本人确权商机，跟进记录暂不可写。' : 'CRM 确权生效后会出现在这里。')}
  </div>`;
}

function renderFollowupTab(space, state, sub) {
  const writable = F.canWrite(space) && !isOffline();
  const offlineWritable = F.canWrite(space) && isOffline();
  const nav = `<nav class="sub-tabs" aria-label="跟进内容分类">${SPACE_SUBS.map(([key, label]) => `<button type="button" data-subtab="${key}" class="${key === sub ? 'is-active' : ''}" aria-pressed="${key === sub}">${label}</button>`).join('')}</nav>`;
  const actions = F.canWrite(space)
    ? `<div class="detail-actions" data-write-actions>
        <button class="btn btn-primary" type="button" data-write="followup">写跟进记录</button>
        <button class="btn btn-secondary" type="button" data-write="weekly">写周复盘</button>
      </div>${offlineWritable ? '<p class="record-meta">当前处于离线：内容会先存成本机草稿，联网后由你确认提交。</p>' : ''}`
    : (space.lifecycle || space.state) === 'frozen'
      ? `<p class="record-warn" data-write-blocked>空间已冻结（${esc(frozenAt(space) || '时间未记录')}），不再提供任何写入入口；历史内容照常查看。</p>`
      : '';
  let body = '';
  if (sub === 'followups') {
    const reviews = F.weeklyReviewsOf(space.id, state);
    const followups = state.followups.filter((item) => item.space === space.id);
    body = reviews.map((review) => `<article class="record-card" data-weekly-review="${esc(review.id)}"><div class="record-head"><strong>周复盘</strong><span class="record-meta">${esc(review.date)}</span></div>
        <dl class="kv-list"><dt>进展</dt><dd>${esc(review.progress)}</dd><dt>下一步</dt><dd>${esc(review.next)}</dd><dt>阻塞</dt><dd>${esc(review.blockers || '无')}</dd></dl></article>`).join('')
      + (followups.length ? followups.map((item) => {
        const behavior = F.behaviorForEvent(state, 'followup', item.id);
        return `<article class="record-card" data-followup="${esc(item.id)}"><div class="record-head"><strong>${esc(item.type)}</strong><span class="record-meta">${esc(item.date)}</span></div>
          <p class="detail-copy">${esc(item.text)}</p>${item.next ? `<p class="record-meta">下一步：${esc(item.next)}</p>` : ''}
          <div class="chip-row">${behavior ? `<span class="state-chip is-${behavior.status === 'done' ? 'ready' : behavior.status === 'failed' ? 'failed' : 'updating'}">行为记录 · ${esc(F.behaviorStatusMeta[behavior.status][0])}</span>` : ''}<button type="button" class="source-chip" data-source="followup:${esc(item.id)}">查看原文</button></div></article>`;
      }).join('') : (reviews.length ? '' : emptyState('还没有跟进记录', '在这里写下的跟进，网页端刷新即可见。')));
  } else if (sub === 'behaviors') {
    const records = F.behaviorsOf(space.id, state);
    body = `<p class="section-note">行为记录写的是这次沟通做得怎么样、下次该补问什么，与客户事实分开存放。</p>`
      + (records.length ? records.map((record) => `<article class="record-card" data-behavior="${esc(record.id)}" data-behavior-status="${esc(record.status)}">
          <div class="record-head"><strong>${esc(F.behaviorEventLabels[record.eventType] || record.eventType)}</strong><span class="state-chip is-${record.status === 'done' ? 'ready' : record.status === 'failed' ? 'failed' : 'updating'}">${esc(F.behaviorStatusMeta[record.status][0])}</span></div>
          <p class="record-meta">${esc(record.eventAt)} · ${esc(record.eventId)}</p>
          ${record.status === 'done' ? `<p class="detail-copy">${esc(record.summary)}</p><dl class="kv-list"><dt>问题或风险</dt><dd>${esc(record.issues.join('；') || '无')}</dd><dt>下次补问</dt><dd>${esc(record.nextQuestions.join('；') || '无')}</dd></dl>`
            : record.status === 'failed' ? `<p class="record-warn">${esc(record.failReason)}不写入占位记录。</p>`
            : record.status === 'empty' ? `<p class="record-meta">${esc(record.note)}</p>` : '<p class="record-meta">正在结合本次事件归纳，稍后可刷新查看。</p>'}
        </article>`).join('') : emptyState('暂无行为记录', '每次跟进、周复盘或录音归位后会自动生成一条。'));
  } else if (sub === 'solutions') {
    const rows = state.solutions.filter((item) => item.space === space.id && !item.withdrawn);
    body = rows.length ? rows.map((item) => `<article class="record-card" data-solution="${esc(item.id)}">
        <div class="record-head"><strong>${esc(item.title)}</strong><span class="state-chip is-${item.reply ? 'ready' : item.read ? 'updating' : 'failed'}">${item.reply ? '已回复' : item.read ? '已读' : '未读'}</span></div>
        <p class="record-meta">${esc(F.name(item.author))} · ${esc(item.date)}</p>
        <p class="detail-copy">${esc(item.body)}</p>
        <div class="chip-row">${(item.attachments || []).map((file) => `<span class="source-chip">${esc(file.name)} · ${esc(file.size || '')}</span>`).join('')}${item.externalLink ? `<a class="source-chip" href="${esc(item.externalLink)}" target="_blank" rel="noreferrer">外部链接</a>` : ''}</div>
        ${item.reply ? `<p class="record-meta">我的回复：${esc(item.reply)}</p>` : ''}
        <div class="detail-actions">${item.reply
          ? '<span class="record-meta">单轮回复已完成，本轮结束。</span>'
          : (space.lifecycle || space.state) === 'frozen'
            ? '<span class="record-meta">空间已冻结，方案往来只读。</span>'
            : isOffline()
              ? '<span class="record-meta">离线状态下可读正文；附件与回复需要联网。</span>'
              : `<button class="btn btn-primary" type="button" data-reply-solution="${esc(item.id)}">回复一次</button>`}</div>
      </article>`).join('') : emptyState('还没有收到方案', '方案人员推送后会出现在这里，并进入收件箱。');
  } else {
    const placements = F.spacePlacements(space.id, state);
    body = placements.length ? placements.map((placement) => {
      const recording = F.recording(placement.recording, state);
      const opp = (space.opps || []).find((item) => item.id === placement.opportunityId);
      const behavior = F.placementBehavior(placement.id, state);
      return `<article class="record-card" data-placement-row="${esc(placement.id)}" data-placement-status="${esc(placement.status)}">
        <div class="record-head"><strong>${esc(recording ? recording.title : placement.recording)}</strong><span class="state-chip is-${placement.status === 'done' ? 'ready' : placement.status === 'failed' ? 'failed' : 'updating'}">${esc(F.placementStatusMeta[placement.status][0])}</span></div>
        <p class="record-meta">归位 ${esc(placement.at)} · 商机 ${esc(opp ? opp.name : placement.opportunityId)}</p>
        ${placement.status === 'failed' ? `<p class="record-warn">${esc(placement.failReason)}</p>` : placement.status === 'waiting_transcript' ? '<p class="record-meta">已归位，等待转写可用后自动开始客户信息更新。</p>' : ''}
        <div class="chip-row" data-behavior-status="${esc(behavior ? behavior.status : 'none')}">${behavior ? `<span class="state-chip is-${behavior.status === 'done' ? 'ready' : behavior.status === 'failed' ? 'failed' : 'updating'}">行为记录 · ${esc(F.behaviorStatusMeta[behavior.status][0])}</span>` : '<span class="state-chip is-updating">行为记录 · 未生成</span>'}
          <button type="button" class="source-chip" data-source="meeting:${esc(placement.recording)}">查看原文</button>
          ${placement.changeId ? `<button type="button" class="source-chip" data-open-change="${esc(placement.changeId)}">查看本次变化</button>` : ''}</div>
      </article>`;
    }).join('') : emptyState('本空间尚无归位录音', '在「相关 → 录音管理」里把录音归位到本空间和一条商机。');
  }
  return `<div class="space-body" data-space-tab="followup">${nav}${actions}${body}</div>`;
}

function renderDocumentsTab(space, state) {
  const layers = F.contentScope(space, state);
  const docs = state.documents.filter((item) => item.space === space.id);
  return `<div class="space-body" data-space-tab="documents">
    <section class="overview-card" data-content-scope><h3>内容范围</h3>
      <ul class="evidence-list">${layers.map((layer) => `<li data-scope-layer="${esc(layer.key)}" data-scope-status="${esc(layer.status)}">${esc(layer.label)} · ${esc(layer.count)}<small>${esc(layer.detail)}</small></li>`).join('')}</ul></section>
    <p class="section-note">移动端只读方案人员已挂载的资料与概览更新状态，不提供上传或重试入口。</p>
    ${docs.length ? docs.map((doc) => `<article class="record-card" data-document="${esc(doc.id)}" data-status="${esc(doc.status)}">
        <div class="record-head"><strong>${esc(doc.name)}</strong><span class="state-chip is-${doc.status === 'success' ? 'ready' : doc.status === 'failed' ? 'failed' : 'updating'}">${esc(F.documentStatusLabels[doc.status] || doc.status)}</span></div>
        <p class="record-meta">${esc(F.name(doc.uploader))} · ${esc(doc.uploadedAt)} · ${esc(doc.size || '')}</p>
        ${doc.reason ? `<p class="record-warn">${esc(doc.reason)}</p>` : ''}
        <div class="chip-row"><button type="button" class="source-chip" data-source="document:${esc(doc.id)}">查看原文</button>${doc.changeId ? `<button type="button" class="source-chip" data-open-change="${esc(doc.changeId)}">查看本次变化</button>` : ''}</div>
      </article>`).join('') : emptyState('暂无外部资料', '方案人员挂载 .md 资料后会出现在这里。')}
  </div>`;
}

/** 空间详情外壳：顶部信息条跨 Tab 常驻；离线未缓存时如实提示需要联网。 */
function viewSpace(params) {
  const state = F.load();
  const space = F.space(params.space, state);
  if (!space) return emptyState('无法进入该客户空间', '这个空间不在你的可见范围，或确权已变化。');
  if (isOffline() && !isCached(space.id)) {
    return `<section class="mobile-section"><div class="space-topbar"><h2>${esc(space.customer)}</h2></div>
      ${emptyState('离线状态下无法打开这个空间', '只有最近打开过的空间才有离线只读缓存，请联网后再试。')}</section>`;
  }
  rememberSpace(space.id);
  const tab = SPACE_TABS.some(([key]) => key === params.tab) ? params.tab : 'overview';
  const sub = SPACE_SUBS.some(([key]) => key === params.sub) ? params.sub : 'followups';
  const frozen = (space.lifecycle || space.state) === 'frozen';
  const drafts = draftsOf(space.id);
  const body = tab === 'overview' ? renderOverviewTab(space, state)
    : tab === 'customer' ? renderCustomerTab(space, state, params.highlight)
    : tab === 'opps' ? renderOppsTab(space)
    : tab === 'followup' ? renderFollowupTab(space, state, sub)
    : renderDocumentsTab(space, state);
  return `<section class="space-view" data-space-view="${esc(space.id)}">
    <div class="space-topbar" data-space-topbar>
      <button class="back-button" type="button" data-back aria-label="返回">‹</button>
      <div><h2>${esc(space.customer)}</h2><p class="record-meta">${esc(space.pool || '待补客户池')} · ${esc(space.id)}</p></div>
      <div class="chip-row" data-space-chips>${badgeRow(space)}</div>
    </div>
    ${frozen ? `<p class="record-warn" data-frozen-note>空间已冻结（${esc(frozenAt(space) || '时间未记录')}）：五个 Tab 均可查看，不再提供写入与新问答。</p>` : ''}
    ${isOffline() ? `<p class="record-warn" data-offline-note>离线内容 · 最后更新 ${esc(space.updated || '—')}。当前为只读缓存，写入会先存成草稿。</p>` : ''}
    ${drafts.length ? `<div class="draft-bar" data-draft-bar>${drafts.map((draft) => `<article data-draft="${esc(draft.id)}" data-draft-status="${esc(draft.status || 'draft')}">
        <strong>${draft.status === 'conflict' ? '冲突待处理' : '待本人确认'}</strong>
        <p class="detail-copy">${esc(draft.kind === 'weekly' ? draft.values.progress : draft.values.text)}</p>
        ${draft.conflictReason ? `<p class="record-warn">${esc(draft.conflictReason)}</p>` : ''}
        <div class="detail-actions"><button class="btn btn-primary" type="button" data-submit-draft="${esc(draft.id)}">核对后提交</button><button class="btn btn-secondary" type="button" data-edit-draft="${esc(draft.id)}">继续编辑</button><button class="btn btn-secondary" type="button" data-drop-draft="${esc(draft.id)}">删除</button></div>
      </article>`).join('')}</div>` : ''}
    <nav class="space-tabs" aria-label="客户空间内容">${SPACE_TABS.map(([key, label]) => `<button type="button" data-tab="${key}" class="${key === tab ? 'is-active' : ''}" aria-pressed="${key === tab}">${label}</button>`).join('')}</nav>
    ${body}
  </section>`;
}

/* ---------------- 写入：跟进记录与周复盘 ---------------- */

/**
 * 写入表单。三条规则同时成立：
 * 跟进记录必须选商机；离线只存草稿不自动提交；提交带基线版本，另一端已提交则给冲突提示且不清空输入。
 */
function openWriteSheet(space, kind, prefill, draftId) {
  const opps = space.opps || [];
  if (kind === 'followup' && !opps.length) {
    openSheet('写跟进记录', '<p class="record-warn">该空间仅有客户级确权、暂无商机，跟进记录暂不可写；客户级内容照常查看。</p>');
    return;
  }
  const values = prefill || {};
  const baseVersion = F.writeBaseline(space);
  const fields = kind === 'followup'
    ? `<label class="sheet-field"><span>关联商机 *</span><select name="opportunityId">${opps.map((opp) => `<option value="${esc(opp.id)}" ${values.opportunityId === opp.id ? 'selected' : ''}>${esc(opp.name)}</option>`).join('')}</select></label>
       <label class="sheet-field"><span>跟进方式</span><select name="type">${['电话沟通', '客户拜访', '线上会议'].map((item) => `<option ${values.type === item ? 'selected' : ''}>${item}</option>`).join('')}</select></label>
       <label class="sheet-field"><span>跟进内容 *</span><textarea name="text" rows="4">${esc(values.text || '')}</textarea></label>
       <label class="sheet-field"><span>下一步计划</span><textarea name="next" rows="2">${esc(values.next || '')}</textarea></label>`
    : `<label class="sheet-field"><span>本周进展 *</span><textarea name="progress" rows="3">${esc(values.progress || '')}</textarea></label>
       <label class="sheet-field"><span>下一步 *</span><textarea name="next" rows="3">${esc(values.next || '')}</textarea></label>
       <label class="sheet-field"><span>阻塞</span><textarea name="blockers" rows="2">${esc(values.blockers || '')}</textarea></label>`;
  openSheet(kind === 'followup' ? '写跟进记录' : '写周复盘', `<form class="sheet-form" data-write-form>
    ${fields}
    <p class="sheet-error" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit" data-write-submit>${isOffline() ? '存为本机草稿' : '确认提交'}</button>
    ${isOffline() ? '<p class="record-meta">离线只保存草稿，不会自动提交；联网后由你确认。</p>' : `<p class="record-meta">提交后网页端同步可见；若另一端已先提交，会提示冲突并保留你的输入。</p>`}
  </form>`, (sheet, close) => {
    const form = sheet.querySelector('[data-write-form]');
    let submitting = false;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      // 重复点击只产生一条有效记录。
      if (submitting) return;
      const payload = Object.fromEntries(new FormData(form));
      const error = form.querySelector('[data-write-error]');
      if (isOffline()) {
        saveDraft({ id: draftId, space: space.id, kind, values: payload, baseVersion, status: 'draft' });
        close();
        showToast('已存为本机草稿，联网后由你确认提交');
        render();
        return;
      }
      submitting = true;
      try {
        if (kind === 'followup') F.addFollowup(space.id, { ...payload, baseVersion });
        else F.addWeeklyReview(space.id, { ...payload, baseVersion });
        if (draftId) dropDraft(draftId);
        close();
        showToast('已提交，客户信息随后自动更新');
        render();
      } catch (err) {
        submitting = false;
        // 冲突与校验失败都保留已填内容，由销售自行取舍。
        error.textContent = err.message;
        if (/先提交为准/.test(err.message)) {
          saveDraft({ id: draftId, space: space.id, kind, values: payload, baseVersion, status: 'conflict', conflictReason: err.message });
        }
      }
    });
  });
}
