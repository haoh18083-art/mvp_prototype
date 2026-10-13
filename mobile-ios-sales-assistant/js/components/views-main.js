/*
 * R09 §4.1 四个主入口：今日 / 客户 / 相关 / 我的。
 * 全部内容走 F.visible() 等桌面同一套判定，不在移动端另做一份权限或数据。
 */

const TONE = { '停滞': 'stalled', '有进展': 'moving', '待决策': 'pending' };

/** 空间状态角标在四个入口和空间详情里用同一套文案。 */
function badgeRow(space) {
  return spaceBadges(space).map(([label, key]) => `<span class="state-chip is-${key}">${esc(label)}</span>`).join('');
}

/** 区块标题行：标题 + mono 计数。 */
function sectionHead(title, count) {
  return `<div class="section-head"><div class="section-head-left"><h2 class="t-heading">${esc(title)}</h2></div>${count === undefined ? '' : `<span class="section-count t-count">${esc(count)}</span>`}</div>`;
}

/** 下划线 segmented Tab：items = [key, label, count?]；attr 是每个按钮挂的 data-* 钩子名。 */
function segTabs(items, active, attr, ariaLabel) {
  return `<nav class="seg-tabs" aria-label="${esc(ariaLabel)}"><div class="seg-tabs-track" role="tablist">${items.map(([key, label, count]) => {
    const on = key === active;
    return `<button type="button" class="seg-tab${on ? ' is-active' : ''}" role="tab" aria-selected="${on}" ${attr}="${esc(key)}"><span class="seg-tab-label" data-label="${esc(label)}"><span>${esc(label)}</span></span>${count === undefined ? '' : `<span class="seg-count t-count">${esc(count)}</span>`}</button>`;
  }).join('')}</div></nav>`;
}

/* ---------------- 今日 ---------------- */

/** 欢迎区：使用用户提供的熊图，双眼作为独立图层眨动。 */
function renderWelcome() {
  return `<section class="ios-welcome" data-od-id="ios-welcome-module">
    <div class="ios-welcome-mark" aria-hidden="true"><img src="../assets/bear-without-eyes.png" width="284" height="280" alt=""><svg class="ios-bear-eyes" viewBox="0 0 284 280" aria-hidden="true" focusable="false"><circle class="ios-bear-eye" cx="78" cy="137" r="10"></circle><circle class="ios-bear-eye" cx="168" cy="137" r="10"></circle></svg></div>
    <div class="ios-welcome-copy" data-typewriter="true"><p class="t-body" data-typewriter-line="1">欢迎来到销售助手</p><h2 class="t-title" data-typewriter-line="2">现在，开始你的跟进之旅吧</h2></div>
    <button class="ios-chat-launch" type="button" aria-label="进入聊天助手" data-open-assistant="" data-od-id="ios-chat-launch">${icon('arrow-right')}</button>
  </section>`;
}

/** 本月经营与毛利目标分开标注期间，共用 R17 的预计与已结算结果。 */
function renderPerformance(state) {
  const board = F.myGoalBoard(F.actor.id, state);
  const value = amount => amount === null ? '—' : F.financeMoney(amount) + ' 元';
  const goal = board.profit;
  const cards = [
    ['本月预计毛利', value(board.profitAchieved), `${F.financeMonth()} · 按记账月份${board.pendingCount ? ' · 部分待核对' : ''}`],
    ['本月已结算毛利', value(board.settledProfit), '已包含在预计毛利合计中'],
    ['本月流水总数', value(board.revenueAchieved), '按收入结算时间统计'],
    ['毛利目标预计达成', goal?.progress == null ? '—' : (goal.progress * 100).toFixed(1) + '%', goal ? `${goal.goal.start} — ${goal.goal.end} · 目标 ${F.financeMoney(goal.target)} 元` : '毛利目标尚未设定']
  ];
  return `<section class="ios-performance" data-od-id="ios-performance-overview">
    <div class="ios-performance-head"><h2 class="t-heading">本月经营</h2></div>
    <div class="ios-performance-track" role="region" aria-label="本月经营概览" tabindex="0">
      ${cards.map(([title, amount, note]) => `<article class="ios-performance-card"><p class="t-meta">${esc(title)}</p><strong class="t-figure is-text">${esc(amount)}</strong><span class="t-meta">${esc(note)}</span></article>`).join('')}
    </div><p class="t-meta">演示数据 · 截止 ${esc(board.dataAsOf || '暂无可用数据')}${board.stale ? ' · 同步失败，保留上次结果' : ''}</p></section>`;
}

/**
 * 今天该跟：与网页端读同一份当日快照（F.todaySnapshot），不在移动端另算一次。
 * 行内只放识别信息与「一句话说明」（状态判断的结论）；「下一步」「判断依据」「标记」收进行展开区，
 * 避免状态结论与动作建议两段话并排，看起来像重复说明。
 * 空态区分「尚未生成」「没有足够依据」「无可判断空间」。
 */
function renderTodayList(state) {
  const snapshot = F.todaySnapshot(state, F.actor.id);
  const universe = F.insightUniverse(state, F.actor.id);
  let body = '';
  let count = 0;
  if (!snapshot || snapshot.status === 'pending') {
    body = emptyState('今天的名单尚未生成', snapshot ? '到达产出时点后会出现在这里。' : '今日名单尚未产出。');
  } else if (snapshot.status === 'failed') {
    body = emptyState('今天的名单生成失败', '已通知销售运营排查。');
  } else if (!snapshot.entries.length) {
    body = emptyState(universe.length ? '今天没有需要优先跟的客户' : '当前没有可判断的客户空间', universe.length ? '所有空间都没有足够依据形成建议。' : '还没有带确权商机的进行中空间。');
  } else {
    count = snapshot.entries.length;
    body = `<div class="list mobile-follow-list">${snapshot.entries.map((entry) => {
      const space = state.spaces.find((item) => item.id === entry.space);
      const marks = F.activeMarks(state, F.actor.id).find((item) => item.space === entry.space);
      // 标记入口只给未冻结、有商机确权且仍归属本人的空间（M07-1 §4.2-1）。
      // 星标一键开或关（§4.2-2）；暂不跟进走表单，必填原因、结束日选填、已有标记时可改可取消（§4.2-3/4）。
      const canMark = Boolean(space) && space.sales === F.actor.id && space.state === 'active' && (space.opps || []).length > 0;
      const markChips = `${marks?.starred ? `<span class="state-chip follow-status">${icon('star')}星标</span>` : ''}${marks?.pause ? '<span class="state-chip follow-status">暂不跟进</span>' : ''}`;
      const marksHtml = canMark ? `<div class="follow-marks">
            <button class="btn btn-secondary" type="button" data-mark-space="${esc(entry.space)}" data-mark-action="${marks?.starred ? 'unstar' : 'star'}">${marks?.starred ? '取消星标' : '星标'}</button>
            <button class="btn btn-secondary" type="button" data-mark-space="${esc(entry.space)}" data-mark-action="pause">暂不跟进</button>
          </div>` : '';
      return `<article class="list-row follow-card" data-follow-card data-space="${esc(entry.space)}" data-status="${esc(entry.status)}">
        <div class="list-row-head is-tappable" role="button" tabindex="0" data-follow-toggle>
          <div class="list-main">
            <div class="list-title-line"><strong class="t-title">${esc(entry.customer)}</strong><span class="state-chip is-${TONE[entry.status] || 'pending'}">${esc(entry.status)}</span>${markChips}</div>
            <p class="t-meta t-ellipsis">${esc(space ? space.pool || '待补客户池' : '')}</p>
            <p class="t-body">${esc(entry.summary)}</p>
          </div>
          <a class="row-chevron" href="#/space/${esc(entry.space)}/overview" aria-label="进入${esc(entry.customer)}客户空间" data-space-link>${icon('chevron-right')}</a>
        </div>
        <div class="list-row-detail" data-follow-detail><div><div class="list-row-detail-inner">
          <span class="t-eyebrow">下一步</span>
          <div class="follow-action">${icon('check')}<span class="t-body">${esc(entry.action)}</span></div>
          <span class="t-eyebrow">判断依据</span>
          <ul class="evidence-list">${(entry.evidence || []).map((ev) => `<li data-evidence="${esc(ev.type)}:${esc(ev.id)}"><span class="t-body">${esc(ev.label)}</span><span class="t-meta">${esc(ev.at || '')}</span></li>`).join('') || '<li><span class="t-meta">暂无可回溯依据</span></li>'}</ul>
          ${marksHtml}
        </div></div></div>
      </article>`;
    }).join('')}</div>`;
  }
  return `<section class="mobile-section" data-od-id="ios-follow-section" data-today-follow>
    ${sectionHead('今天该跟', count)}
    ${body}</section>`;
}

/**
 * 收件箱：承载方案、归属变化、空间状态与客户信息更新完成提醒（M06）。
 * 每条只有一个动作——进客户空间；没有空间落点的提醒只给对应页面入口。
 * 动作走文字 + 箭头（.inbox-enter），不用蓝白主按钮，下拉区留白同步收紧，避免一条提醒撑出半屏。
 */
function renderInbox(state) {
  const mine = state.notifications.filter((item) => item.recipient === F.actor.id && item.status !== 'waiting');
  const unread = mine.filter((item) => !item.read);
  const read = mine.filter((item) => item.read);
  const row = (item) => {
    const space = item.space ? state.spaces.find((w) => w.id === item.space) : null;
    // 每条只有一个动作：有空间落点就进客户空间，方案类直达跟进 Tab，客户更新带上本次变化。
    const visible = space && F.space(space.id, state);
    const tab = item.link?.params?.tab === 'solutions' ? 'followup/solutions' : 'overview';
    const target = visible ? `#/space/${item.space}/${tab}${item.changeId ? '?change=' + item.changeId : ''}` : '';
    const label = visible ? '进客户空间' : item.link?.page === 'today-follow' ? '查看今日该跟' : '';
    const fallback = visible ? '' : item.link?.page === 'today-follow' ? '#/today' : '';
    return `<article class="list-row inbox-item" data-inbox-item data-status="${item.read ? 'done' : 'pending'}" data-notification="${esc(item.id)}">
      <div class="list-row-head is-tappable" role="button" tabindex="0" data-inbox-toggle>
        <div class="list-main">
          <div class="list-title-line"><strong class="t-title">${esc(item.title)}</strong>${item.read ? '' : '<span class="unread-dot" aria-label="未读"></span>'}</div>
          <div class="inbox-meta"><span class="t-meta t-strong">${esc(item.type)}</span><span class="t-meta">${esc(space ? space.customer : '本人提醒')}</span>${item.pushStatus === 'failed' || item.pushStatus === 'not_installed' ? '<span class="t-warn push-failed">推送未送达</span>' : ''}</div>
        </div>
        <span class="list-aside t-count">${esc(String(item.createdAt || '').slice(5, 16))}</span>
        ${rowChevron(true)}
      </div>
      <div class="list-row-detail"><div><div class="list-row-detail-inner">
        <p class="t-body">${esc(item.text)}</p>
        <div class="detail-actions">${target || fallback
          ? `<a class="inbox-enter" href="${target || fallback}" data-inbox-enter="${esc(item.id)}">${esc(label)}${icon('arrow-right', 'ic-xs')}</a>`
          : '<span class="t-meta">这条提醒的落点不在移动端，请在网页端查看。</span>'}</div>
      </div></div></div></article>`;
  };
  return `<section class="mobile-section mobile-inbox" data-od-id="ios-inbox" data-inbox>
    <div class="section-head"><div class="section-head-left"><h2 class="t-heading">收件箱</h2><span class="unread-total">${unread.length}</span></div></div>
    ${segTabs([['pending', '未读', unread.length], ['done', '已读', read.length]], 'pending', 'data-inbox-tab', '收件箱分类')}
    <div class="list inbox-list">${[...unread, ...read].map(row).join('')}
      <div class="empty-state" data-inbox-empty hidden><strong class="t-title">这里还没有内容</strong><p class="t-meta">新的方案、归属变化和客户信息更新提醒会出现在这里。</p></div>
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
    ? rows.map((space) => `<a class="list-row space-row" href="#/space/${esc(space.id)}/overview" data-space-row="${esc(space.id)}">
        <div class="list-row-head">
          <div class="list-main">
            <strong class="t-title t-ellipsis">${esc(space.customer)}</strong>
            <span class="t-meta t-ellipsis">${esc(space.pool || '待补客户池')} · 最近动态 ${esc(space.updated || '—')}</span>
            <span class="chip-row">${badgeRow(space)}</span>
          </div>
          ${rowChevron(false)}
        </div></a>`).join('')
    : emptyState(keyword ? '没有匹配的客户' : '还没有承接客户', keyword ? '换个客户名称再试。' : 'CRM 确权生效后，客户空间会出现在这里。');
  return `<section class="mobile-section" data-customers>
    <div class="search-bar"><label class="mobile-sr-only" for="customer-search">搜索客户</label>${icon('search')}
      <input id="customer-search" type="search" name="q" value="${esc(keyword)}" placeholder="搜索客户名称 / 空间编号" autocomplete="off" data-customer-search></div>
    ${sectionHead('我的客户空间', rows.length)}
    <div class="list space-list">${list}</div></section>`;
}

/* ---------------- 相关（工作台） ---------------- */

/** 工作台只承载入口：录音管理的列表与归位操作收进可回退的二级页（M05-1 §5）。 */
function viewRelated() {
  const state = F.load();
  const records = F.recordings(state);
  const pending = records.filter((item) => F.recordingState(item, state) === 'unplaced').length;
  return `<section class="mobile-section" data-related>
    ${sectionHead('工作台')}
    <div class="list">
      <a class="list-row" href="#/related/recordings" data-related-entry="recordings">
        <div class="list-row-head">
          <div class="list-main">
            <strong class="t-title">录音管理</strong>
            <span class="t-meta">共 ${esc(records.length)} 条${pending ? ` · ${esc(pending)} 条待归位` : ''}</span>
          </div>
          ${rowChevron(false)}
        </div>
      </a>
    </div></section>`;
}

/**
 * 录音卡片：点主体打开智能总结 / 原文转录抽屉；未处理侧用安静标记承接归位或重新同步。
 * 不展示转写状态——总结与原文由远端同步，移动端不做本地转写。
 */
function recordingCard(item, state, bucket, hidden) {
  const placements = F.recordingPlacements(item.id, state);
  const stateKey = F.recordingState(item, state);
  const canPlace = stateKey !== 'blocked';
  const placedLine = placements.length
    ? `<p class="t-meta t-ellipsis">${esc(placements.map((placement) => {
      const space = state.spaces.find((w) => w.id === placement.space);
      const opp = space?.opps?.find((o) => o.id === placement.opportunityId);
      return `${space ? space.customer : placement.space} · ${opp ? opp.name : placement.opportunityId}`;
    }).join('；'))}</p>`
    : '';
  const action = bucket === 'open'
    ? (canPlace
      ? `<button class="rec-mark is-action" type="button" data-place-recording="${esc(item.id)}"><span>归位</span></button>`
      : `<button class="rec-mark is-action" type="button" data-resync-recording="${esc(item.id)}"><span>重新同步</span></button>`)
    : `<button class="row-chevron" type="button" data-open-recording="${esc(item.id)}" aria-label="查看${esc(item.title)}">${icon('chevron-right')}</button>`;
  return `<article class="rec-card" data-recording="${esc(item.id)}" data-recording-state="${esc(stateKey)}" data-rec-bucket="${esc(bucket)}"${hidden ? ' hidden' : ''}>
    <button class="rec-card-main" type="button" data-open-recording="${esc(item.id)}">
      <strong class="t-title t-ellipsis">${esc(item.title)}</strong>
      <p class="t-meta">${esc(item.date)} · ${esc(item.duration)}</p>
      ${placedLine}
      ${item.syncReason ? `<p class="notice t-warn">${esc(item.syncReason)}</p>` : ''}
    </button>
    <div class="rec-card-side">${action}</div>
  </article>`;
}

/** 录音管理二级页：未处理 / 已处理；未处理右上角可增量拉取远端。 */
function viewRecordings(tab = 'open') {
  const state = F.load();
  const records = F.recordings(state);
  const active = tab === 'done' ? 'done' : 'open';
  const open = records.filter((item) => F.recordingState(item, state) !== 'placed');
  const done = records.filter((item) => F.recordingState(item, state) === 'placed');
  const cards = [
    ...open.map((item) => recordingCard(item, state, 'open', active !== 'open')),
    ...done.map((item) => recordingCard(item, state, 'done', active !== 'done'))
  ].join('');
  return `<section class="mobile-section recordings-view" data-recordings>
    <div class="space-topbar">
      <button class="back-button" type="button" data-back aria-label="返回">${icon('chevron-left')}</button>
      <div class="space-topbar-main"><h2 class="t-heading t-ellipsis">录音管理</h2><p class="t-meta t-ellipsis">共 ${esc(records.length)} 条</p></div>
      <button class="rec-pull" type="button" data-pull-recordings${active === 'open' ? '' : ' hidden'}><span class="t-meta">拉取</span></button>
    </div>
    ${segTabs([['open', '未处理', open.length], ['done', '已处理', done.length]], active, 'data-rec-tab', '录音处理状态')}
    <div class="rec-list">
      ${cards}
      <div class="empty-state" data-rec-empty="open"${active === 'open' && !open.length ? '' : ' hidden'}><strong class="t-title">没有待处理的录音</strong><p class="t-meta">点右上角拉取，远端有新增时会出现在这里。</p></div>
      <div class="empty-state" data-rec-empty="done"${active === 'done' && !done.length ? '' : ' hidden'}><strong class="t-title">还没有已处理的录音</strong><p class="t-meta">归位后的录音会到这里。</p></div>
    </div>
  </section>`;
}

/* ---------------- 我的 ---------------- */

function viewProfile() {
  const state = F.load();
  const drafts = draftsOf();
  const kv = (pairs) => `<dl class="kv-list">${pairs.map(([k, v]) => `<dt class="t-meta">${esc(k)}</dt><dd class="t-body">${esc(v)}</dd>`).join('')}</dl>`;
  return `<section class="mobile-section" data-profile>
    ${sectionHead('账号信息')}
    ${kv([['姓名', F.actor.name], ['角色', '销售'], ['账号', F.actor.id], ['邮箱', F.actor.email]])}
  </section>
  <section class="mobile-section">
    ${sectionHead('通知与推送')}
    ${kv([['推送授权', '已授权'], ['推送渠道', '移动端推送'], ['站内兜底', '推送未送达时，收件箱仍可查看']])}
  </section>
  <section class="mobile-section">
    ${sectionHead('待确认草稿', drafts.length)}
    ${drafts.length ? `<div class="list" data-draft-list>${drafts.map((draft) => {
      const space = state.spaces.find((w) => w.id === draft.space);
      return `<article class="list-row record-card" data-draft="${esc(draft.id)}" data-draft-status="${esc(draft.status || 'draft')}">
        <div class="list-row-head">
          <div class="list-main">
            <div class="list-title-line"><strong class="t-title">${esc(space ? space.customer : draft.space)}</strong><span class="state-chip is-${draft.status === 'conflict' ? 'failed' : 'updating'}">${draft.status === 'conflict' ? '冲突待处理' : '待本人确认'}</span></div>
            <p class="t-meta">${esc(draft.kind === 'weekly' ? '周复盘' : '跟进记录')} · 保存于 ${esc(draft.savedAt)}</p>
          </div>
        </div>
        <div class="list-body">
          <p class="t-body">${esc(draft.kind === 'weekly' ? draft.values.progress : draft.values.text)}</p>
          ${draft.conflictReason ? `<p class="notice t-warn">${esc(draft.conflictReason)}</p>` : ''}
          <div class="detail-actions"><a class="btn btn-primary" href="#/space/${esc(draft.space)}/followup">去核对并提交</a><button class="btn btn-secondary" type="button" data-drop-draft="${esc(draft.id)}">删除草稿</button></div>
        </div>
      </article>`;
    }).join('')}</div>` : emptyState('没有待确认草稿', '离线写下的跟进会先存成草稿，联网后在这里确认提交。')}
  </section>
  <section class="mobile-section">
    ${sectionHead('演示与版本')}
    <label class="switch-row"><span><span class="t-title">模拟离线</span><span class="t-meta">只读最近打开过的空间，写入先存为本机草稿</span></span><input type="checkbox" data-offline-toggle ${isOffline() ? 'checked' : ''}></label>
    ${kv([['分发方式', '企业内部安装包（安卓 / 苹果）'], ['当前版本', 'V0.2 原型 · 20260921']])}
  </section>`;
}

function emptyState(title, text) {
  return `<div class="empty-state"><strong class="t-title">${esc(title)}</strong><p class="t-meta">${esc(text)}</p></div>`;
}
