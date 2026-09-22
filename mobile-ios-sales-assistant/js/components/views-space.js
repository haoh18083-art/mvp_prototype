/*
 * R09 §4.2–§4.4 空间详情：五个常驻 Tab、默认落地概览、折叠区每次进入重新收起、
 * 深链直达客户 Tab 并高亮、冻结只读、离线只读缓存、跟进与周复盘写入、并发先提交为准。
 * 内容全部取自桌面同一套 F.overview / F.contentScope / F.spacePlacements 等函数。
 */

const SPACE_TABS = [['overview', '概览'], ['customer', '客户'], ['opps', '商机'], ['followup', '跟进'], ['documents', '资料']];
const SPACE_SUBS = [['followups', '跟进记录'], ['behaviors', '行为记录'], ['solutions', '方案往来'], ['recordings', '录音']];

/* 概览常显区（去卡片化分区）：指标条 → 一句话判断 → 客户画像 → 关键人与联系人 → 风险标记 → 当前卡点 → 最近动静；空间助手为可移动悬浮图标，唤出 4/5 屏抽屉问答（M05-1 §4.2、M05-3 §4.3，0921 版面）。 */
const OVERVIEW_FOLDED = ['basics', 'opportunity', 'pending'];

/** 状态 → 角标色：done/ready 绿、failed 红、其余蓝。 */
const chipTone = (status) => (status === 'done' || status === 'ready' || status === 'success' ? 'ready' : status === 'failed' ? 'failed' : 'updating');

/**
 * 归位状态在移动端的口径：转写与智能总结由远端同步，移动端不跟转写线，
 * 归位后只表达客户信息更新情况（已归位、更新中、已完成或更新未完成）。
 */
const placementStatusLabel = (status) => (F.placementStatusMeta[status] || ['处理中'])[0];

/** 从文件名取扩展名，无法识别时返回 FILE。 */
function fileExt(name) {
  const match = String(name || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : 'FILE';
}

/** 方案附件列表：文件名 + 类型/大小，便于扫读多种格式。 */
function solutionAssetList(item) {
  const files = (item.attachments || []).map((file, index) =>
    `<button type="button" class="file-row" data-open-solution-file="${esc(item.id)}" data-file-index="${index}">
      <span class="file-ext" aria-hidden="true">${esc(fileExt(file.name))}</span>
      <span class="file-main"><strong class="t-title t-ellipsis">${esc(file.name)}</strong><span class="t-meta">${esc(fileExt(file.name))} · ${esc(file.size || '演示文件')}</span></span>
      ${rowChevron()}
    </button>`).join('');
  const link = item.externalLink
    ? `<a class="file-row" href="${esc(item.externalLink)}" target="_blank" rel="noreferrer">
        <span class="file-ext" aria-hidden="true">LINK</span>
        <span class="file-main"><strong class="t-title">外部链接</strong><span class="t-meta">在浏览器打开</span></span>
        ${rowChevron()}
      </a>`
    : '';
  return files || link ? `<div class="file-list" data-solution-files>${files}${link}</div>` : '';
}

function sourceList(sources) {
  if (!sources || !sources.length) return '<p class="t-meta">暂无可回溯的原文。</p>';
  return `<div class="chip-row">${sources.map((item) => (item.available === false
    ? `<span class="source-chip is-broken" data-source-broken>${esc(item.label)} · 已失效</span>`
    : `<button type="button" class="source-chip" data-source="${esc(item.type + ':' + item.id)}">${esc(item.label)}</button>`)).join('')}</div>`;
}

/** 概览与变化里的依据都能点回原文；来源不可用时如实说明。 */
function openSource(ref) {
  const record = F.sourceRecord(ref);
  if (!record) { showToast('该来源已不在当前可见范围'); return; }
  openSheet(record.title, record.available
    ? `<pre class="sheet-pre" data-source-body>${esc(record.body || '原文暂无正文。')}</pre><p class="t-meta">${esc(record.at || '')} · ${esc(record.author || '')}</p>`
    : `<p class="notice t-warn" data-source-unavailable>来源不可用：${esc(record.unavailableReason || '原文已不可读。')}</p>`);
}

/** 方案附件预览：原型不真正下载，用类型说明 + 摘要展示该文件能打开。 */
function openSolutionFile(solutionId, index) {
  const record = F.load().solutions.find((item) => item.id === solutionId);
  const file = record?.attachments?.[Number(index)];
  if (!file) { showToast('该附件已不在当前可见范围'); return; }
  if (isOffline()) {
    openSheet(file.name, `<p class="notice t-meta">离线状态下可读方案正文；附件需要联网后打开。</p><p class="t-meta">${esc(fileExt(file.name))} · ${esc(file.size || '')}</p>`);
    return;
  }
  openSheet(file.name, `<p class="t-meta">${esc(fileExt(file.name))} · ${esc(file.size || '演示文件')} · 演示预览</p>
    <pre class="sheet-pre" data-file-preview>${esc(file.preview || '该附件已随方案留存在本空间，可打开或下载。')}</pre>
    <p class="notice t-meta">原型不真正下载文件；正式环境按系统能力打开或下载原件。</p>`);
}

function changeBlock(change) {
  if (change.status === 'processing') return '<p class="t-body">客户信息正在更新，当前展示上一版内容。</p>';
  if (change.status === 'failed') return `<p class="notice t-warn">更新未完成：${esc(change.reason || '原内容保留。')}</p>`;
  if (change.status === 'nochange') return '<p class="t-body">处理完成，本次未发现客户信息变化。</p>';
  const group = (hook, title, items) => (items.length ? `<div class="list-body" ${hook}><span class="t-eyebrow">${title}</span><ul class="evidence-list">${items.join('')}</ul></div>` : '');
  return `${group('data-change-added', '本次新增', change.added.map((item) => `<li><span class="t-body">${esc(item)}</span></li>`))}
    ${group('data-change-updated', '更新前后', change.updated.map((item) => `<li><span class="t-body">${esc(item.field)}：<del>${esc(item.before)}</del> → <ins>${esc(item.after)}</ins></span></li>`))}
    ${group('data-change-pending', '待确认', change.pendingConfirm.map((item) => `<li><span class="t-body">${esc(item)}</span></li>`))}
    ${!change.added.length && !change.updated.length && !change.pendingConfirm.length ? '<p class="t-body">本次更新没有可展示的差异。</p>' : ''}`;
}

/** 内容卡：标题行（可带角标）+ 正文 + 附加内容。 */
function card(title, body, attrs = '', chip = '') {
  return `<section class="card" ${attrs}><div class="card-head"><h3 class="t-title">${title}${chip}</h3></div>${body}</section>`;
}

/** 变化摘要：受影响字段 + 新增/更新/待确认计数；与本次变化详情一致，不用来源摘要代替。 */
function changeSummary(item) {
  const fields = [...new Set(item.updated.map((entry) => entry.field))];
  return `受影响：${fields.length ? `${fields.join('、')} · ` : ''}新增 ${item.added.length} · 更新 ${item.updated.length} · 待确认 ${item.pendingConfirm.length}`;
}

const hasVisibleChange = (item) => item && item.status === 'done' && (item.added.length || item.updated.length || item.pendingConfirm.length);

/** 更新历史时间线：与跟进 Tab 同源的事件流，倒序全量；节点可进本次变化详情或原文，无变化与失败也留节点。 */
function updateTimeline(space, state) {
  const history = F.updateHistory(space.id, state);
  const statusChip = (item) => (item.status === 'done' ? '<span class="state-chip is-ready">已完成</span>'
    : item.status === 'nochange' ? '<span class="state-chip">无变化</span>'
    : item.status === 'failed' ? '<span class="state-chip is-failed">更新失败</span>'
    : '<span class="state-chip is-updating">更新中</span>');
  const sourceType = { followup: '跟进记录', weekly_review: '周复盘', meeting: '客户录音', document: '外部资料', solution: '方案往来' };
  const nodeBody = (item) => {
    if (item.status === 'processing') return '<p class="t-meta">正在更新，完成后展示本次变化。</p>';
    if (item.status === 'failed') return `<p class="notice t-warn">${esc(item.reason || '本次更新未完成，原内容保留。')}</p>`;
    if (item.status === 'nochange') return '<p class="t-body">处理完成，本次未发现客户信息变化。</p>';
    return `<p class="t-body">${esc(changeSummary(item))}</p>`;
  };
  const nodeActions = (item) => {
    const sourceBtn = item.sourceRef && ['followup', 'meeting', 'document', 'solution'].includes(item.source)
      ? `<button type="button" class="source-chip" data-source="${esc(item.source + ':' + item.sourceRef)}">查看原文</button>` : '';
    const changeBtn = hasVisibleChange(item)
      ? `<button type="button" class="source-chip" data-open-change="${esc(item.id)}">查看本次变化</button>` : '';
    return sourceBtn || changeBtn ? `<div class="chip-row">${sourceBtn}${changeBtn}</div>` : '';
  };
  return `<ol class="timeline">${history.map((item) => `<li class="timeline-item" data-history-node="${esc(item.id)}" data-node-status="${esc(item.status)}">
    <div class="timeline-head"><strong class="t-title">${esc(item.sourceLabel)}</strong>${statusChip(item)}</div>
    <p class="t-meta">${esc(item.at)} · ${esc(sourceType[item.source] || '内容进入')}</p>
    ${nodeBody(item)}${nodeActions(item)}
  </li>`).join('')}</ol>`;
}

/**
 * 更新面板内容：顶部最近一次变化状态，下方全量更新历史时间线。
 * 由空间详情顶栏右上角的更新入口（图标 + 红点）唤出，不占概览常显区（M05-1 §4.2、M05-2 §4.4，0921 版面）。
 */
function updatesPanelHtml(space, state) {
  const history = F.updateHistory(space.id, state);
  const processing = history.filter((item) => item.status === 'processing');
  const latestChanged = history.find(hasVisibleChange);
  const latest = history[0];
  let statusHtml;
  if (latestChanged) {
    // 摘要与入口同一行：查看本次变化贴在这一行右侧，不再单独占一行
    statusHtml = `<div class="updates-status" data-updates-status="changed">
      <div class="updates-status-head">
        <p class="t-body">${esc(changeSummary(latestChanged))}</p>
        <button type="button" class="source-chip" data-open-change="${esc(latestChanged.id)}">查看本次变化</button>
      </div>
      <p class="t-meta">${esc(latestChanged.sourceLabel)} · ${esc(latestChanged.at)}</p>
    </div>`;
  } else if (latest && latest.status === 'failed') {
    statusHtml = `<div class="updates-status" data-updates-status="failed">
      <p class="notice t-warn">${esc(latest.reason || '本次更新未完成，原内容保留。')}</p>
      <p class="t-meta">${esc(latest.sourceLabel)} · ${esc(latest.at)} · 当前展示上一版（${esc(space.overviewUpdatedAt || '时间未记录')}）</p>
    </div>`;
  } else if (processing.length && !history.some((item) => item.status === 'done' || item.status === 'nochange')) {
    statusHtml = '<p class="t-meta" data-updates-status="processing">客户信息正在更新，当前展示上一版内容。</p>';
  } else if (latest) {
    statusHtml = `<p class="t-meta" data-updates-status="idle">最后更新 ${esc(latest.at)} · ${latest.status === 'nochange' ? '最近一次处理未发现变化 · ' : ''}共 ${history.length} 次更新</p>`;
  } else {
    statusHtml = '<p class="t-meta" data-updates-status="empty">暂无内容更新记录。</p>';
  }
  const extra = [
    latestChanged && processing.length ? `另有 ${processing.length} 项内容正在更新` : '',
    latestChanged && latest && latest.status === 'nochange' ? `最近处理 ${latest.at} · 未发现变化` : '',
    latestChanged && latest && latest.status === 'failed' ? `最近一次 ${latest.sourceLabel} 更新失败，原内容保留` : ''
  ].filter(Boolean);
  return `${statusHtml}
    ${extra.length ? `<p class="t-meta">${esc(extra.join('；'))}</p>` : ''}
    ${history.length ? `<div class="updates-history" data-update-history><span class="t-eyebrow">更新历史 · 共 ${history.length} 次</span>${updateTimeline(space, state)}</div>` : ''}`;
}

/** 指标条：从空间既有数据派生的可比数值，只展示当前值与口径脚注，不做新旧值对比；位于概览最上方（M02-3 §4.4，0921 口径）。 */
function metricStrip(space, state) {
  const followupCount = state.followups.filter((item) => item.space === space.id).length + F.weeklyReviewsOf(space.id, state).length;
  const placements = F.spacePlacements(space.id, state).length;
  const docs = state.documents.filter((item) => item.space === space.id && item.status === 'success').length;
  const pending = [...new Set([...(space.pendingConfirm || []), ...state.spaceChanges.filter((c) => c.space === space.id).flatMap((c) => c.pendingConfirm || [])])].length;
  const amount = (space.opps || []).reduce((sum, opp) => sum + (opp.amount || 0), 0);
  const metrics = [
    [amount || '—', '商机金额 · 万元', `已确权商机 ${(space.opps || []).length} 个`],
    [followupCount, '跟进 · 次', '含周复盘，按提交计'],
    [placements, '归位录音 · 份', '已归位到本空间'],
    [docs, '外部资料 · 份', '已成功挂载'],
    [pending, '待确认 · 项', '含历史遗留']
  ];
  return `<section class="ov-section ov-metrics" data-overview-metrics><div class="ov-head"><h3 class="t-title">指标</h3></div>
    <div class="metric-row">${metrics.map(([value, label, hint]) => `<div class="metric" data-metric><span class="t-figure">${esc(String(value))}</span><span class="t-meta">${esc(label)}</span><span class="t-meta metric-hint">${esc(hint)}</span></div>`).join('')}</div>
  </section>`;
}

/** 客户画像分区：客户名单独一行，行业与客户池只出现在下方键值，不跟在名字后面。 */
function profileSection(space, panel) {
  const name = space.customer || (panel && panel.text) || '';
  const body = `${name ? `<p class="t-body">${esc(name)}</p>` : '<p class="t-meta" data-panel-empty>暂无信息。</p>'}${kvList([['客户池', space.pool || '待补客户池'], ['所属行业', space.industry], ['客户等级', `${space.grade} 级`], ['经营阶段', space.stage]])}`;
  return section('客户画像', body, `data-overview-panel="who" data-panel-status="${esc(panel ? panel.status : 'empty')}"`);
}

/** 概览分区：去卡片化，板块间发丝线分隔、无外框（M05-1 §4.2，0921 版面）。 */
function section(title, body, attrs = '', chip = '') {
  return `<section class="ov-section" ${attrs}><div class="ov-head"><h3 class="t-title">${title}${chip}</h3></div>${body}</section>`;
}

function renderOverviewTab(space, state) {
  const panels = F.overview(space, state);
  const byKey = Object.fromEntries(panels.map((panel) => [panel.key, panel]));
  const panelBody = (panel) => (panel.text ? `<p class="t-body">${esc(panel.text)}</p>` : '<p class="t-meta" data-panel-empty>暂无信息。</p>');
  const panelSection = (key) => {
    const panel = byKey[key];
    if (!panel) return '';
    const chip = panel.status === 'pending' ? '<span class="state-chip is-updating">待确认</span>' : panel.status === 'conflict' ? '<span class="state-chip is-failed">存在冲突</span>' : '';
    return section(esc(panel.title), panelBody(panel), `data-overview-panel="${esc(panel.key)}" data-panel-status="${esc(panel.status)}"`, chip);
  };
  const peers = F.coFollowers(space, state);
  const peerList = peers.length
    ? `<ul class="evidence-list">${peers.map((peer) => `<li><span class="t-body">${esc(peer.name)}</span></li>`).join('')}</ul>`
    : '<p class="t-meta">当前客户没有其他在跟销售。</p>';
  return `<div class="space-body" data-space-tab="overview">
    ${metricStrip(space, state)}
    ${panelSection('verdict')}
    ${profileSection(space, byKey.who)}
    ${section('关键人与联系人', `<p class="t-body">${esc(byKey.people?.text || '暂无信息')}</p>`, 'data-overview-panel="people"')}
    ${panelSection('risk')}
    ${panelSection('blocker')}
    ${panelSection('recent')}
    <section class="fold-group">${OVERVIEW_FOLDED.map((key) => {
      const panel = byKey[key];
      if (!panel) return '';
      return `<details class="fold-item" data-fold="${esc(key)}"><summary><span class="t-title">${esc(panel.title)}</span>${icon('chevron-down')}</summary>${panelBody(panel)}</details>`;
    }).join('')}
      <details class="fold-item" data-fold="co-followers"><summary><span class="t-title">还有谁也在跟</span>${icon('chevron-down')}</summary>${peerList}</details>
    </section>
  </div>`;
}

/**
 * 空间助手抽屉内容：与本人助手同一套条目式对话——左侧等宽时间栏、用户右侧批注、
 * 助手答案带可点击的依据脚注；空会话展示预设问题引导区（M05-3 §4.3，复刻 fn-chat 交互）。
 */
function spaceAssistantBodyHtml(space, state) {
  const frozen = (space.lifecycle || space.state) === 'frozen';
  const qa = (state.spaceQA || []).filter((item) => item.space === space.id).slice().reverse();
  const timeOf = (at) => String(at || '').slice(11, 16);
  const qaEntry = (item) => {
    const cites = (item.sources || []).map((source, i) => {
      const ref = source.type + ':' + source.id;
      return source.available === false
        ? `<button type="button" class="qa-cite" data-qa-cite-broken="${esc(source.label)}" title="来源已失效">〔${i + 1}〕</button>`
        : `<button type="button" class="qa-cite" data-qa-cite="${esc(ref)}" title="${esc(source.label)}">〔${i + 1}〕</button>`;
    }).join('');
    return `<article class="fn-entry fn-user" data-qa-user="${esc(item.id)}"><span class="fn-time">${esc(timeOf(item.at))}</span>
        <div class="fn-main"><div class="fn-bubble">${esc(item.question)}</div></div></article>
      <article class="fn-entry" data-qa-item="${item.hasEvidence ? 'answered' : 'no-evidence'}"><span class="fn-time">${esc(timeOf(item.at))}</span>
        <div class="fn-main"><div class="fn-answer">${esc(item.answer)}${cites}</div></div></article>`;
  };
  const welcome = `<div class="fn-welcome" data-qa-welcome>
      <p class="fn-eyebrow">空间助手</p><h1>只围绕这个空间作答</h1>
      <p class="fn-sub">答案只来自当前客户空间你有权查看的内容与原文依据；没有依据时如实说明，不推测。</p>
      <div class="fn-chips" data-qa-presets>${F.quickQuestions.map(([, label]) => `<button type="button" class="fn-chip" data-ask="${esc(label)}">${esc(label)}</button>`).join('')}</div>
    </div>`;
  return `<div class="fn-chat" data-space-qa>
    ${frozen ? '<p class="notice t-meta" data-qa-frozen>空间已冻结，不开放新问答；以下为历史对话，只读。</p>' : ''}
    ${qa.length ? qa.map(qaEntry).join('') : (frozen ? '<p class="t-meta">暂无历史对话。</p>' : welcome)}
  </div>`;
}

function kvList(pairs) {
  return `<dl class="kv-list">${pairs.map(([k, v]) => `<dt class="t-meta">${esc(k)}</dt><dd class="t-body">${esc(v)}</dd>`).join('')}</dl>`;
}

function renderCustomerTab(space, state, highlight) {
  const peers = F.coFollowers(space, state);
  return `<div class="space-body" data-space-tab="customer">
    ${card('客户画像', kvList([['核心需求', space.brief], ['关注产品', (space.opps || []).map((o) => o.name).join('、') || '尚未确权'], ['决策链', '技术评估 → 采购确认 → 业务验收']]))}
    <section class="card${highlight === 'contacts' ? ' is-highlight' : ''}" data-block="contacts"><div class="card-head"><h3 class="t-title">客户信息与联系人</h3></div>
      ${kvList([['客户名称', space.customer], ['所属行业', space.industry], ['客户等级', space.grade], ['第一关键人', space.contact], ['联系人数量', '3 人'], ['客户池来源', space.customerPoolSource === 'pending' ? 'CRM 暂无客户池，待补充' : 'CRM 当前客户池']])}</section>
    ${card('同客户在跟名单', peers.length ? `<ul class="evidence-list">${peers.map((peer) => `<li><span class="t-body">${esc(peer.name)}</span></li>`).join('')}</ul>` : '<p class="t-meta">当前客户没有其他在跟销售。</p>', 'data-co-followers')}
  </div>`;
}

function renderOppsTab(space) {
  const opps = space.opps || [];
  return `<div class="space-body" data-space-tab="opps">
    ${opps.length ? opps.map((opp) => card(esc(opp.name), kvList([['商机编号', opp.id], ['金额', `${opp.amount} 万元`], ['经营阶段', opp.stage]]))).join('')
      : emptyState(space.ownerOnly ? '仅客户级确权' : '暂无已确权商机', space.ownerOnly ? '当前没有本人确权商机，跟进记录暂不可写。' : 'CRM 确权生效后会出现在这里。')}
  </div>`;
}

/** 记录行：列表规范下的一条记录（标题 + 角标 + meta + 正文 + 附加）。 */
function recordRow(attrs, title, chip, meta, body) {
  return `<article class="list-row record-card" ${attrs}>
    <div class="list-row-head"><div class="list-main">
      <div class="list-title-line"><strong class="t-title">${title}</strong>${chip}</div>
      ${meta ? `<p class="t-meta">${meta}</p>` : ''}
    </div></div>
    ${body ? `<div class="list-body">${body}</div>` : ''}
  </article>`;
}

function renderFollowupTab(space, state, sub) {
  const frozen = (space.lifecycle || space.state) === 'frozen';
  const reviews = F.weeklyReviewsOf(space.id, state);
  const followups = state.followups.filter((item) => item.space === space.id);
  const behaviors = F.behaviorsOf(space.id, state);
  const solutions = state.solutions.filter((item) => item.space === space.id && !item.withdrawn);
  const placements = F.spacePlacements(space.id, state);
  const counts = { followups: reviews.length + followups.length, behaviors: behaviors.length, solutions: solutions.length, recordings: placements.length };
  const nav = segTabs(SPACE_SUBS.map(([key, label]) => [key, label, counts[key]]), sub, 'data-subtab', '跟进内容分类');
  let body = '';
  if (sub === 'followups') {
    const rows = reviews.map((review) => recordRow(`data-weekly-review="${esc(review.id)}"`, '周复盘', '', esc(review.date),
      kvList([['进展', review.progress], ['下一步', review.next], ['阻塞', review.blockers || '无']]))).join('')
      + followups.map((item) => {
        const behavior = F.behaviorForEvent(state, 'followup', item.id);
        return recordRow(`data-followup="${esc(item.id)}"`, esc(item.type), '', esc(item.date),
          `<p class="t-body">${esc(item.text)}</p>${item.next ? `<p class="t-meta">下一步：${esc(item.next)}</p>` : ''}
          <div class="chip-row">${behavior ? `<span class="state-chip is-${chipTone(behavior.status)}">行为记录 · ${esc(F.behaviorStatusMeta[behavior.status][0])}</span>` : ''}<button type="button" class="source-chip" data-source="followup:${esc(item.id)}">查看原文</button></div>`);
      }).join('');
    body = rows ? `<div class="list">${rows}</div>` : emptyState('还没有跟进记录', '在这里写下的跟进，网页端刷新即可见。');
  } else if (sub === 'behaviors') {
    body = behaviors.length ? `<div class="list">${behaviors.map((record) => recordRow(`data-behavior="${esc(record.id)}" data-behavior-status="${esc(record.status)}"`,
      esc(F.behaviorEventLabels[record.eventType] || record.eventType),
      `<span class="state-chip is-${chipTone(record.status)}">${esc(F.behaviorStatusMeta[record.status][0])}</span>`,
      `${esc(record.eventAt)} · ${esc(record.eventId)}`,
      record.status === 'done' ? `<p class="t-body">${esc(record.summary)}</p>${kvList([['问题或风险', record.issues.join('；') || '无'], ['下次补问', record.nextQuestions.join('；') || '无']])}`
        : record.status === 'failed' ? `<p class="notice t-warn">${esc(record.failReason)}</p>`
        : record.status === 'empty' ? `<p class="t-meta">${esc(record.note)}</p>` : '<p class="t-meta">正在生成，稍后刷新查看。</p>')).join('')}</div>`
      : emptyState('暂无行为记录', '每次跟进、周复盘或录音归位后会自动生成一条。');
  } else if (sub === 'solutions') {
    body = solutions.length ? `<div class="list">${solutions.map((item) => recordRow(`data-solution="${esc(item.id)}"`, esc(item.title),
      `<span class="state-chip is-${item.reply ? 'ready' : item.read ? 'updating' : 'failed'}">${item.reply ? '已回复' : item.read ? '已读' : '未读'}</span>`,
      `${esc(F.name(item.author))} · ${esc(item.date)}`,
      `<p class="t-body">${esc(item.body)}</p>
      ${solutionAssetList(item)}
      ${item.reply ? `<p class="t-meta">我的回复：${esc(item.reply)}</p>` : ''}
      <div class="detail-actions">${item.reply ? ''
        : frozen ? '<span class="t-meta">空间已冻结，方案往来只读。</span>'
        : isOffline() ? '<span class="t-meta">离线状态下可读正文；附件与回复需要联网。</span>'
        : `<button class="btn btn-primary" type="button" data-reply-solution="${esc(item.id)}">回复一次</button>`}</div>`)).join('')}</div>`
      : emptyState('还没有收到方案', '方案人员推送后会出现在这里。');
  } else {
    // M05-2 §4.2 归位路径二：本页直接挑我的录音并锚定本空间的一条商机（全量录音在挑录音抽屉里呈现）。
    const placeable = !frozen && space.state === 'active' && space.sales === F.actor?.id && (space.opps || []).length > 0;
    const blockedReason = space.sales !== F.actor?.id ? '只能归位到本人的客户空间。'
      : (space.opps || []).length ? '' : '该空间仅有客户级确权、没有商机；归位必须锚定商机。';
    const entry = `${placeable ? '<div class="rec-actions"><button class="rec-place" type="button" data-place-here>归位录音</button></div>' : ''}${blockedReason ? `<p class="notice t-meta" data-place-blocked>${esc(blockedReason)}</p>` : ''}`;
    body = `${entry}${placements.length ? `<div class="list">${placements.map((placement) => {
      const recording = F.recording(placement.recording, state);
      const opp = (space.opps || []).find((item) => item.id === placement.opportunityId);
      const behavior = F.placementBehavior(placement.id, state);
      return recordRow(`data-placement-row="${esc(placement.id)}" data-placement-status="${esc(placement.status)}"`,
        esc(recording ? recording.title : placement.recording),
        `<span class="state-chip is-${chipTone(placement.status)}">${esc(placementStatusLabel(placement.status))}</span>`,
        `归位 ${esc(placement.at)} · 商机 ${esc(opp ? opp.name : placement.opportunityId)}`,
        `${placement.status === 'failed' ? `<p class="notice t-warn">${esc(placement.failReason)}</p>` : ''}
        <div class="chip-row" data-behavior-status="${esc(behavior ? behavior.status : 'none')}">${behavior ? `<span class="state-chip is-${chipTone(behavior.status)}">行为记录 · ${esc(F.behaviorStatusMeta[behavior.status][0])}</span>` : '<span class="state-chip is-updating">行为记录 · 未生成</span>'}
          <button type="button" class="source-chip" data-open-space-recording="${esc(placement.recording)}">查看原文</button>
          ${placement.changeId ? `<button type="button" class="source-chip" data-open-change="${esc(placement.changeId)}">查看本次变化</button>` : ''}</div>`);
    }).join('')}</div>` : emptyState('本空间尚无归位录音', placeable ? '点「归位录音」挑一条我的录音，挂到本空间和一条商机。' : '录音同步进来后可在此关联。')}`;
  }
  return `<div class="space-body" data-space-tab="followup">${nav}${body}</div>`;
}

function renderDocumentsTab(space, state) {
  const layers = F.contentScope(space, state);
  const docs = state.documents.filter((item) => item.space === space.id);
  return `<div class="space-body" data-space-tab="documents">
    ${card('内容范围', `<ul class="evidence-list">${layers.map((layer) => `<li data-scope-layer="${esc(layer.key)}" data-scope-status="${esc(layer.status)}"><span class="t-body">${esc(layer.label)} · ${esc(layer.count)}</span><span class="t-meta">${esc(layer.detail)}</span></li>`).join('')}</ul>`, 'data-content-scope')}
    ${docs.length ? `<div class="list">${docs.map((doc) => recordRow(`data-document="${esc(doc.id)}" data-status="${esc(doc.status)}"`, esc(doc.name),
      `<span class="state-chip is-${chipTone(doc.status)}">${esc(F.documentStatusLabels[doc.status] || doc.status)}</span>`,
      `${esc(F.name(doc.uploader))} · ${esc(doc.uploadedAt)} · ${esc(doc.size || '')}`,
      `${doc.reason ? `<p class="notice t-warn">${esc(doc.reason)}</p>` : ''}
      <div class="chip-row"><button type="button" class="source-chip" data-source="document:${esc(doc.id)}">查看原文</button>${doc.changeId ? `<button type="button" class="source-chip" data-open-change="${esc(doc.changeId)}">查看本次变化</button>` : ''}</div>`)).join('')}</div>`
      : emptyState('暂无外部资料', '方案人员挂载 .md 资料后会出现在这里。')}
  </div>`;
}

/** 空间详情外壳：顶部信息条跨 Tab 常驻；离线未缓存时如实提示需要联网。 */
function viewSpace(params) {
  const state = F.load();
  const space = F.space(params.space, state);
  if (!space) return emptyState('无法进入该客户空间', '这个空间不在你的可见范围，或确权已变化。');
  if (isOffline() && !isCached(space.id)) {
    return `<section class="mobile-section"><div class="space-topbar"><button class="back-button" type="button" data-back aria-label="返回">${icon('chevron-left')}</button><div class="space-topbar-main"><h2 class="t-heading t-ellipsis">${esc(space.customer)}</h2></div></div>
      ${emptyState('离线状态下无法打开这个空间', '这个空间没有离线缓存，请联网后再试。')}</section>`;
  }
  rememberSpace(space.id);
  const tab = SPACE_TABS.some(([key]) => key === params.tab) ? params.tab : 'overview';
  const sub = SPACE_SUBS.some(([key]) => key === params.sub) ? params.sub : 'followups';
  const frozen = (space.lifecycle || space.state) === 'frozen';
  const drafts = draftsOf(space.id);
  // 更新入口红点：最近一条带来变化的完成结果未读时点亮；打开更新面板即已读。
  const latestChanged = F.updateHistory(space.id, state).find(hasVisibleChange);
  const updatesUnread = !!latestChanged && !isChangeRead(latestChanged.id);
  const body = tab === 'overview' ? renderOverviewTab(space, state)
    : tab === 'customer' ? renderCustomerTab(space, state, params.highlight)
    : tab === 'opps' ? renderOppsTab(space)
    : tab === 'followup' ? renderFollowupTab(space, state, sub)
    : renderDocumentsTab(space, state);
  return `<section class="space-view" data-space-view="${esc(space.id)}">
    <div class="space-chrome">
      <div class="space-topbar" data-space-topbar>
        <button class="back-button" type="button" data-back aria-label="返回">${icon('chevron-left')}</button>
        <div class="space-topbar-main"><h2 class="t-heading t-ellipsis">${esc(space.customer)}</h2><p class="t-meta t-ellipsis">${esc(space.pool || '待补客户池')} · ${esc(space.id)}</p></div>
        <div class="chip-row" data-space-chips>${badgeRow(space)}</div>
        <button class="update-entry${updatesUnread ? ' has-unread' : ''}" type="button" data-open-updates aria-label="空间更新${updatesUnread ? '，有新更新' : ''}">${icon('bell')}</button>
      </div>
      ${frozen ? `<p class="notice t-warn" data-frozen-note>空间已冻结（${esc(frozenAt(space) || '时间未记录')}），只读。</p>` : ''}
      ${isOffline() ? `<p class="notice t-meta" data-offline-note>离线内容 · 最后更新 ${esc(space.updated || '—')}。当前为只读缓存，写入会先存成草稿。</p>` : ''}
      ${segTabs(SPACE_TABS, tab, 'data-tab', '客户空间内容')}
    </div>
    ${drafts.length ? `<div class="draft-bar" data-draft-bar>${drafts.map((draft) => `<article data-draft="${esc(draft.id)}" data-draft-status="${esc(draft.status || 'draft')}">
        <strong class="t-title t-accent">${draft.status === 'conflict' ? '冲突待处理' : '待本人确认'}</strong>
        <p class="t-body">${esc(draft.kind === 'weekly' ? draft.values.progress : draft.values.text)}</p>
        ${draft.conflictReason ? `<p class="notice t-warn">${esc(draft.conflictReason)}</p>` : ''}
        <div class="detail-actions"><button class="btn btn-primary" type="button" data-submit-draft="${esc(draft.id)}">核对后提交</button><button class="btn btn-secondary" type="button" data-edit-draft="${esc(draft.id)}">继续编辑</button><button class="btn btn-secondary" type="button" data-drop-draft="${esc(draft.id)}">删除</button></div>
      </article>`).join('')}</div>` : ''}
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
    openSheet('写跟进记录', '<p class="notice t-warn">该空间暂无商机，跟进记录暂不可写。</p>');
    return;
  }
  const values = prefill || {};
  const baseVersion = F.writeBaseline(space);
  const field = (label, control) => `<label class="sheet-field"><span class="t-meta">${label}</span>${control}</label>`;
  const fields = kind === 'followup'
    ? field('关联商机 *', `<select name="opportunityId">${opps.map((opp) => `<option value="${esc(opp.id)}" ${values.opportunityId === opp.id ? 'selected' : ''}>${esc(opp.name)}</option>`).join('')}</select>`)
      + field('跟进方式', `<select name="type">${['电话沟通', '客户拜访', '线上会议'].map((item) => `<option ${values.type === item ? 'selected' : ''}>${item}</option>`).join('')}</select>`)
      + field('跟进内容 *', `<textarea name="text" rows="4">${esc(values.text || '')}</textarea>`)
      + field('下一步计划', `<textarea name="next" rows="2">${esc(values.next || '')}</textarea>`)
    : field('本周进展 *', `<textarea name="progress" rows="3">${esc(values.progress || '')}</textarea>`)
      + field('下一步 *', `<textarea name="next" rows="3">${esc(values.next || '')}</textarea>`)
      + field('阻塞', `<textarea name="blockers" rows="2">${esc(values.blockers || '')}</textarea>`);
  openSheet(kind === 'followup' ? '写跟进记录' : '写周复盘', `<form class="sheet-form" data-write-form>
    ${fields}
    <p class="t-warn" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit" data-write-submit>${isOffline() ? '存为本机草稿' : '确认提交'}</button>
    ${isOffline() ? '<p class="notice t-meta">离线只保存为本机草稿，联网后由你确认提交。</p>' : ''}
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
