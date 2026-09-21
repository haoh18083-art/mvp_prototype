/*
 * R09 §4.1 四个主入口：今日 / 客户 / 相关 / 我的。
 * 全部内容走 F.visible() 等桌面同一套判定，不在移动端另做一份权限或数据。
 */

const ICON = {
  chevron: '<svg viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 2 6 8-6 8"></path></svg>',
  arrow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h15M13 6l6 6-6 6"></path></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"></circle><path d="m9 12 2 2 4-4"></path></svg>'
};

const TONE = { '停滞': 'stalled', '有进展': 'moving', '待决策': 'pending' };

/** 空间状态角标在四个入口和空间详情里用同一套文案。 */
function badgeRow(space) {
  return spaceBadges(space).map(([label, key]) => `<span class="state-chip is-${key}">${esc(label)}</span>`).join('');
}

/* ---------------- 今日 ---------------- */

/** 欢迎区：动态图标 + 打字机文案 + 进入聊天助手入口，保持导入时的原样。 */
function renderWelcome() {
  return `<section class="ios-welcome" data-od-id="ios-welcome-module">
    <div class="ios-welcome-mark" aria-hidden="true"><svg viewBox="0 0 42 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5h28a3 3 0 0 1 3 3v25a3 3 0 0 1-3 3H22l-8 8v-8H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"></path><circle class="ios-doll-eye" fill="currentColor" stroke="none" cx="14" cy="17" r="1.25"></circle><circle class="ios-doll-eye" fill="currentColor" stroke="none" cx="26" cy="17" r="1.25"></circle><path d="M15 27c2.5 2 5.5 2 8 0"></path></svg></div>
    <div class="ios-welcome-copy" data-typewriter="true"><p data-typewriter-line="1">欢迎来到销售助手</p><h2 data-typewriter-line="2">现在，开始你的跟进之旅吧</h2></div>
    <button class="ios-chat-launch" aria-label="进入聊天助手" data-open-assistant="" data-od-id="ios-chat-launch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H13l-4.5 4v-4h-1A2.5 2.5 0 0 1 5 12.5v-6Z"></path><path d="M9 9.5h6M9 12h3"></path></svg></button>
  </section>`;
}

/**
 * 本周经营：与网页端销售目标看板同一份取数（F.myGoalBoard）。
 * R17 口径——DataHub 不可用时只说明来源状态，不提供模拟达成数据。
 */
function renderPerformance(state) {
  const hub = state.datahub || {};
  const board = F.myGoalBoard(F.actor.id, state);
  const ok = hub.status === 'ok';
  const unavailable = hub.status === 'never' ? 'DataHub 尚未接入，不提供模拟达成' : `DataHub 最近一次取数失败（最近成功 ${hub.lastSuccessAt || '无'}），本周数据暂不可用`;
  const money = (value) => (Number(value) || 0).toLocaleString('zh-CN');
  const cards = ok
    ? [
      ['本周流水', money(board.revenueAchieved) + ' 元', `按结算时间归集 · 数据截至 ${hub.lastSuccessAt}`],
      ['本周毛利', money(board.profitAchieved) + ' 元', '结算金额 − 配对成本'],
      ['流水达成', board.revenue ? Math.round(board.revenue.rate * 100) + '%' : '—', board.revenue ? `目标 ${money(board.revenue.goal.amount)} 元` : '本期尚未设定个人流水目标'],
      ['毛利达成', board.profit ? Math.round(board.profit.rate * 100) + '%' : '—', board.profit ? `目标 ${money(board.profit.goal.amount)} 元` : '本期尚未设定个人毛利目标']
    ]
    : [
      ['本周流水', '—', unavailable],
      ['本周毛利', '—', unavailable],
      ['流水达成', '—', 'DataHub 上线前不提供模拟达成'],
      ['毛利达成', '—', 'DataHub 上线前不提供模拟达成']
    ];
  return `<section class="ios-performance" data-od-id="ios-performance-overview">
    <div class="ios-performance-head"><h2>本周经营</h2><span>左右滑动</span></div>
    <div class="ios-performance-track" role="region" aria-label="本周经营概览" tabindex="0">
      ${cards.map(([title, value, note]) => `<article class="ios-performance-card"><p>${esc(title)}</p><strong class="is-text">${esc(value)}</strong><span>${esc(note)}</span></article>`).join('')}
    </div></section>`;
}

/**
 * 今天该跟：与网页端读同一份当日快照（F.todaySnapshot），不在移动端另算一次。
 * 空态区分「尚未生成」「没有足够依据」「无可判断空间」，不用旧名单顶替。
 */
function renderTodayList(state) {
  const snapshot = F.todaySnapshot(state, F.actor.id);
  const universe = F.insightUniverse(state, F.actor.id);
  let body = '';
  let count = 0;
  if (!snapshot || snapshot.status === 'pending') {
    body = emptyState('今天的名单尚未生成', snapshot ? '到达产出时点后会出现在这里，不会沿用昨天的结果。' : '今日名单尚未产出，不以昨天的名单顶替。');
  } else if (snapshot.status === 'failed') {
    body = emptyState('今天的名单生成失败', '已通知销售运营排查；本次不沿用昨天的结果。');
  } else if (!snapshot.entries.length) {
    body = emptyState(universe.length ? '今天没有需要优先跟的客户' : '当前没有可判断的客户空间', universe.length ? '所有空间都没有足够依据形成建议，不编造名单。' : '还没有带确权商机的进行中空间。');
  } else {
    count = snapshot.entries.length;
    body = `<div class="mobile-follow-list">${snapshot.entries.map((entry) => {
      const space = state.spaces.find((item) => item.id === entry.space);
      const marks = F.activeMarks(state, F.actor.id).find((item) => item.space === entry.space);
      return `<article class="follow-card" data-follow-card data-space="${esc(entry.space)}" data-status="${esc(entry.status)}">
        <button class="expand-caret" aria-label="展开${esc(entry.customer)}" data-follow-toggle><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"></path></svg></button>
        <div class="card-person"><div class="person-avatar ${TONE[entry.status] || ''}">${esc(initial(entry.customer))}</div>
          <div><div class="person-name">${esc(entry.customer)} <span class="detail-tag">${esc(entry.status)}</span>${marks?.starred ? '<span class="detail-tag">★ 星标</span>' : ''}</div>
          <div class="person-company">${esc(space ? space.pool || '待补客户池' : '')}</div></div></div>
        <p class="reason">${esc(entry.summary)}</p>
        <div class="next-step">${ICON.check}<span>${esc(entry.action)}</span></div>
        <div class="follow-detail"><div><div class="follow-detail-inner">
          <strong>判断依据</strong>
          <ul class="evidence-list">${(entry.evidence || []).map((ev) => `<li data-evidence="${esc(ev.type)}:${esc(ev.id)}">${esc(ev.label)}<small>${esc(ev.at || '')}${ev.transcribeReady === false ? ' · 转写未就绪' : ''}</small></li>`).join('') || '<li>暂无可回溯依据</li>'}</ul>
          <div class="detail-actions"><button class="btn btn-secondary" type="button" data-mark-space="${esc(entry.space)}">星标 / 暂不跟进</button></div>
        </div></div></div>
        <a class="card-link" href="#/space/${esc(entry.space)}/overview" data-space-link>客户空间 <span class="ios-chevron" aria-hidden="true">${ICON.chevron}</span></a>
      </article>`;
    }).join('')}</div>`;
  }
  const note = snapshot && snapshot.status === 'generated' ? `<p class="section-note">与网页端同一份当日快照 · 产出 ${esc(snapshot.generatedAt || snapshot.date)}${snapshot.truncated ? ` · 另有 ${snapshot.truncated} 个空间未入选` : ''}</p>` : '';
  return `<section class="mobile-section" data-od-id="ios-follow-section" data-today-follow>
    <div class="section-head"><div class="section-head-left"><h2>今天该跟</h2></div><span class="section-count">${count}</span></div>
    ${note}${body}</section>`;
}

/**
 * 收件箱：承载方案、归属变化、空间状态与客户信息更新完成提醒（M06），不装全员广播类内容。
 * 每条只有一个动作——进客户空间；没有空间落点的提醒只给对应页面入口，不额外派生待办。
 */
function renderInbox(state) {
  const mine = state.notifications.filter((item) => item.recipient === F.actor.id && item.status !== 'waiting');
  const unread = mine.filter((item) => !item.read);
  const read = mine.filter((item) => item.read);
  const card = (item) => {
    const space = item.space ? state.spaces.find((w) => w.id === item.space) : null;
    // 每条只有一个动作：有空间落点就进客户空间，方案类直达跟进 Tab，客户更新带上本次变化。
    const visible = space && F.space(space.id, state);
    const tab = item.link?.params?.tab === 'solutions' ? 'followup/solutions' : 'overview';
    const target = visible ? `#/space/${item.space}/${tab}${item.changeId ? '?change=' + item.changeId : ''}` : '';
    const label = visible ? '进客户空间' : item.link?.page === 'today-follow' ? '查看今日该跟' : '';
    const fallback = visible ? '' : item.link?.page === 'today-follow' ? '#/today' : '';
    return `<article class="inbox-item" data-inbox-item data-status="${item.read ? 'done' : 'pending'}" data-notification="${esc(item.id)}">
      <div class="inbox-row" data-inbox-toggle>
        <div class="inbox-type"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l3 3v15H6z"></path><path d="M14 3v4h4M9 12h6M9 16h4"></path></svg></div>
        <div class="inbox-main"><div class="inbox-title-line"><strong>${esc(item.title)}</strong>${item.read ? '' : '<span class="unread-dot"></span>'}</div>
          <div class="inbox-meta"><span class="type-label">${esc(item.type)}</span><span>${esc(space ? space.customer : '本人提醒')}</span>${item.pushStatus === 'failed' || item.pushStatus === 'not_installed' ? '<span class="push-failed">推送未送达</span>' : ''}</div></div>
        <span class="inbox-time">${esc(String(item.createdAt || '').slice(5, 16))}</span>
        <svg class="inbox-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"></path></svg>
      </div>
      <div class="inbox-detail"><div><div class="inbox-detail-content">
        <p class="detail-copy">${esc(item.text)}</p>
        <div class="detail-actions">${target || fallback
          ? `<a class="btn btn-primary" href="${target || fallback}" data-inbox-enter="${esc(item.id)}">${esc(label)}</a>`
          : '<span class="detail-copy">这条提醒的落点不在移动端，请在网页端查看。</span>'}</div>
      </div></div></div></article>`;
  };
  return `<section class="inbox-section mobile-inbox" data-od-id="ios-inbox" data-inbox>
    <div class="inbox-header"><div class="inbox-title"><h2>收件箱</h2><span class="unread-total">${unread.length}</span></div>
      <div class="segmented" role="tablist">
        <button class="is-active" type="button" data-inbox-tab="pending" role="tab">未读 <span>${unread.length}</span></button>
        <button type="button" data-inbox-tab="done" role="tab">已读 <span>${read.length}</span></button>
      </div></div>
    <p class="section-note">未读优先；条目上只有「进客户空间」一个动作，不装全员广播类内容。</p>
    <div class="inbox-list">${[...unread, ...read].map(card).join('')}
      <div class="empty-state" data-inbox-empty hidden><strong>这里还没有内容</strong><p>新的方案、归属变化和客户信息更新提醒会出现在这里。</p></div>
    </div></section>`;
}

function viewToday() {
  const state = F.load();
  return renderWelcome() + renderPerformance(state) + renderTodayList(state) + renderInbox(state);
}

/* ---------------- 客户 ---------------- */

/** 只展示本人有权客户和空间；搜索无结果不提示存在无权客户。 */
function viewCustomers(params) {
  const state = F.load();
  const keyword = String(params.q || '').trim();
  const spaces = F.visible(state);
  const rows = spaces.filter((space) => !keyword || (space.customer + space.id + (space.pool || '')).includes(keyword));
  const list = rows.length
    ? rows.map((space) => `<a class="space-row" href="#/space/${esc(space.id)}/overview" data-space-row="${esc(space.id)}">
        <span class="person-avatar">${esc(initial(space.customer))}</span>
        <span class="space-row-main"><strong>${esc(space.customer)}</strong>
          <small>${esc(space.pool || '待补客户池')} · 最近动态 ${esc(space.updated || '—')}</small>
          <span class="chip-row">${badgeRow(space)}</span></span>
        <span class="ios-chevron" aria-hidden="true">${ICON.chevron}</span></a>`).join('')
    : emptyState(keyword ? '没有匹配的客户' : '还没有承接客户', keyword ? '换个客户名称再试；搜索只覆盖你有权进入的空间。' : 'CRM 确权生效后，客户空间会出现在这里。');
  return `<section class="mobile-section" data-customers>
    <div class="search-bar"><label class="mobile-sr-only" for="customer-search">搜索客户</label>
      <input id="customer-search" type="search" name="q" value="${esc(keyword)}" placeholder="搜索客户名称 / 空间编号" autocomplete="off" data-customer-search></div>
    <div class="section-head"><div class="section-head-left"><h2>我的客户空间</h2></div><span class="section-count">${rows.length}</span></div>
    <div class="space-list">${list}</div></section>`;
}

/* ---------------- 相关（工作台） ---------------- */

/** 本版工作台先承载录音管理入口（M05-1 §5），其余留白。 */
function viewRelated() {
  const state = F.load();
  const records = F.recordings(state);
  const rows = records.map((item) => {
    const placements = F.recordingPlacements(item.id, state);
    const stateKey = F.recordingState(item, state);
    const stateLabel = F.recordingStateMeta[stateKey][0];
    const canPlace = stateKey !== 'blocked';
    return `<article class="record-card" data-recording="${esc(item.id)}" data-recording-state="${esc(stateKey)}">
      <div class="record-head"><strong>${esc(item.title)}</strong><span class="state-chip is-${stateKey === 'placed' ? 'ready' : stateKey === 'blocked' ? 'failed' : 'updating'}">${esc(stateLabel)}</span></div>
      <p class="record-meta">${esc(item.date)} · ${esc(item.duration)} · ${esc(item.source)}</p>
      <p class="record-meta">同步 ${esc(F.recordingSyncMeta[item.syncStatus][0])} · 转写 ${esc(F.transcriptMeta[item.transcriptStatus][0])}</p>
      ${item.syncReason ? `<p class="record-warn">${esc(item.syncReason)}</p>` : ''}
      ${placements.length ? `<ul class="evidence-list">${placements.map((placement) => {
        const space = state.spaces.find((w) => w.id === placement.space);
        const opp = space?.opps?.find((o) => o.id === placement.opportunityId);
        return `<li data-placement="${esc(placement.id)}">${esc(space ? space.customer : placement.space)} · ${esc(opp ? opp.name : placement.opportunityId)}<small>${esc(F.placementStatusMeta[placement.status][0])}</small></li>`;
      }).join('')}</ul>` : '<p class="record-meta">尚未归位。归位必须锚定一个客户空间和一条商机。</p>'}
      <div class="detail-actions">${canPlace ? `<button class="btn btn-primary" type="button" data-place-recording="${esc(item.id)}">归位到客户空间</button>` : `<button class="btn btn-secondary" type="button" data-resync-recording="${esc(item.id)}">重新同步</button>`}</div>
    </article>`;
  }).join('');
  return `<section class="mobile-section" data-related>
    <div class="section-head"><div class="section-head-left"><h2>录音管理</h2></div><span class="section-count">${records.length}</span></div>
    <p class="section-note">录音由三方录音服务同步，本版不提供手动上传与应用内录制；删除只在三方服务侧进行。</p>
    ${rows || emptyState('还没有录音', '录音同步进来后会出现在这里。')}
    <div class="section-head u-mt"><div class="section-head-left"><h2>其他工作台能力</h2></div></div>
    <p class="section-note">本版「相关」只承载录音管理入口，其余能力后续补充。</p></section>`;
}

/* ---------------- 我的 ---------------- */

function viewProfile() {
  const state = F.load();
  const drafts = draftsOf();
  return `<section class="mobile-section" data-profile>
    <div class="section-head"><div class="section-head-left"><h2>账号信息</h2></div></div>
    <dl class="kv-list"><dt>姓名</dt><dd>${esc(F.actor.name)}</dd><dt>角色</dt><dd>销售</dd><dt>账号</dt><dd>${esc(F.actor.id)}</dd><dt>邮箱</dt><dd>${esc(F.actor.email)}</dd></dl>

    <div class="section-head"><div class="section-head-left"><h2>通知与推送</h2></div></div>
    <dl class="kv-list"><dt>推送授权</dt><dd>已授权</dd><dt>推送渠道</dt><dd>移动端推送（本版只有一条渠道，不提供渠道偏好设置）</dd><dt>站内兜底</dt><dd>推送未送达时，收件箱仍可查看</dd></dl>

    <div class="section-head"><div class="section-head-left"><h2>待确认草稿</h2></div><span class="section-count">${drafts.length}</span></div>
    <p class="section-note">草稿只保存在本机，恢复网络后也不会自动提交，需由你核对后确认。</p>
    ${drafts.length ? `<div class="space-list" data-draft-list>${drafts.map((draft) => {
      const space = state.spaces.find((w) => w.id === draft.space);
      return `<article class="record-card" data-draft="${esc(draft.id)}" data-draft-status="${esc(draft.status || 'draft')}">
        <div class="record-head"><strong>${esc(space ? space.customer : draft.space)}</strong><span class="state-chip is-${draft.status === 'conflict' ? 'failed' : 'updating'}">${draft.status === 'conflict' ? '冲突待处理' : '待本人确认'}</span></div>
        <p class="record-meta">${esc(draft.kind === 'weekly' ? '周复盘' : '跟进记录')} · 保存于 ${esc(draft.savedAt)}</p>
        <p class="detail-copy">${esc(draft.kind === 'weekly' ? draft.values.progress : draft.values.text)}</p>
        ${draft.conflictReason ? `<p class="record-warn">${esc(draft.conflictReason)}</p>` : ''}
        <div class="detail-actions"><a class="btn btn-primary" href="#/space/${esc(draft.space)}/followup">去核对并提交</a><button class="btn btn-secondary" type="button" data-drop-draft="${esc(draft.id)}">删除草稿</button></div>
      </article>`;
    }).join('')}</div>` : emptyState('没有待确认草稿', '离线写下的跟进会先存成草稿，联网后在这里确认提交。')}

    <div class="section-head"><div class="section-head-left"><h2>演示与版本</h2></div></div>
    <label class="switch-row"><span>模拟离线<small>用于演示离线只读与草稿；不改变业务数据</small></span><input type="checkbox" data-offline-toggle ${isOffline() ? 'checked' : ''}></label>
    <dl class="kv-list"><dt>分发方式</dt><dd>企业内部安装包（安卓 / 苹果），不以应用商店上架为前提</dd><dt>当前版本</dt><dd>V0.2 原型 · 20260921</dd><dt>数据来源</dt><dd>与网页端同一份演示状态，不做分端存储</dd></dl>
  </section>`;
}

function emptyState(title, text) {
  return `<div class="empty-state"><strong>${esc(title)}</strong><p>${esc(text)}</p></div>`;
}
