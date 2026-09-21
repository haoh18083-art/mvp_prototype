/* 页面实际加载的合并脚本。请改 js/components/ 后再按同样顺序拼回这里。 */
/* js/components/store-bridge.js */
/*
 * R09 数据桥：移动端直接复用桌面 js/features/store.js 的同一份演示状态与同一套权限判定，
 * 不做分端存储——两端读写同一个 localStorage 键，手机上写的跟进在网页端刷新即可见。
 * 只有「设备本地」的东西（离线开关、离线缓存过的空间、未提交草稿）单独存放，不写进业务数据。
 */
const F = window.SC.FEATURES;
const LOCAL_KEY = 'sc-v02-mobile-local-v1';

/* 移动端只服务销售角色（R09 §1）；演示身份可用 ?as= 切换，默认付赞。 */
F.role = 'SLS';
const requestedActor = new URLSearchParams(window.location.search).get('as');
F.actor = F.person(requestedActor && F.person(requestedActor)?.role === 'SLS' ? requestedActor : 'U-1004');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const initial = (name) => String(name || '客').slice(0, 1);

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return { offline: !!parsed.offline, cached: Array.isArray(parsed.cached) ? parsed.cached : [], drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [] };
    }
  } catch (_) { /* 存储不可用时退回内存态，不阻断阅读 */ }
  return { offline: false, cached: [], drafts: [] };
}

let local = readLocal();

function saveLocal(next) {
  local = next;
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(local)); } catch (_) { /* 忽略：草稿仅本机保存 */ }
}

const isOffline = () => local.offline;
/** 最近打开过的空间才有离线只读缓存；未缓存的空间离线时如实提示需要联网。 */
const isCached = (spaceId) => local.cached.includes(spaceId);

function rememberSpace(spaceId) {
  if (!spaceId || local.offline) return;
  const cached = [spaceId, ...local.cached.filter((id) => id !== spaceId)].slice(0, 5);
  saveLocal({ ...local, cached });
}

function setOffline(value) {
  saveLocal({ ...local, offline: !!value });
}

const draftsOf = (spaceId) => local.drafts.filter((item) => !spaceId || item.space === spaceId);

/** 草稿一律不自动提交：保存在本机，等销售本人核对后确认（R09 §4.4）。 */
function saveDraft(draft) {
  const drafts = [{ ...draft, id: draft.id || 'DRAFT-' + Date.now().toString(36), savedAt: new Date().toLocaleString('sv-SE') }, ...local.drafts.filter((item) => item.id !== draft.id)];
  saveLocal({ ...local, drafts });
}

function dropDraft(id) {
  saveLocal({ ...local, drafts: local.drafts.filter((item) => item.id !== id) });
}

/** 空间状态角标：冻结 / 内容更新中 / 离线三种，跨五个 Tab 常驻。 */
function spaceBadges(space) {
  const chips = [];
  if ((space.lifecycle || space.state) === 'frozen') chips.push(['冻结', 'frozen']);
  if (space.overviewStatus === 'updating' || ['preparing', 'updating'].includes(space.readiness)) chips.push(['更新中', 'updating']);
  if (space.overviewStatus === 'failed' || space.readiness === 'failed') chips.push(['更新失败', 'failed']);
  if (isOffline()) chips.push(['离线', 'offline']);
  return chips;
}

const frozenAt = (space) => space.frozenAt || (space.lifecycleEvents || []).find((event) => event.type === 'frozen')?.at || '';
/* js/components/welcome.js */
/*
 * 欢迎区：打字机文案、会眨眼的助手图标和「进入聊天助手」入口。
 * 原来在静态首页上一次性执行；现在「今日」入口由路由重画，改为每次重画后调用一次，
 * 仍然靠 sessionStorage 保证每个会话只播一次动效。
 */

let welcomeObserver;

/* 欢迎区打字机：每个会话只播一次，系统要求减少动效时直接跳过。 */
function runWelcomeIntro() {
  const welcome = document.querySelector('[data-typewriter="true"]');
  const platform = document.body.classList.contains('platform-android') ? 'android' : 'ios';
  const seenClass = `platform-${platform}-welcome-seen`;
  const seenKey = `sales-${platform}-welcome-seen`;
  if (!welcome || document.body.classList.contains(seenClass) || window.sessionStorage.getItem(seenKey) === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lines = [...welcome.querySelectorAll('[data-typewriter-line]')];
  const originals = lines.map((line) => line.textContent);
  document.body.classList.add('is-playing-welcome');
  lines.forEach((line) => { line.textContent = ''; line.classList.add('is-typing'); });
  let lineIndex = 0;
  let charIndex = 0;
  const typeNext = () => {
    /* 播放途中切走「今日」时节点已被移除，直接收尾，不再往下写。 */
    if (!welcome.isConnected) { document.body.classList.remove('is-playing-welcome'); return; }
    if (lineIndex >= lines.length) {
      /* 播完后写入 sessionStorage，刷新本会话不再重播。 */
      lines.forEach((line) => line.classList.remove('is-typing'));
      document.body.classList.remove('is-playing-welcome');
      document.body.classList.add(seenClass);
      window.sessionStorage.setItem(seenKey, '1');
      return;
    }
    const line = lines[lineIndex];
    line.textContent = originals[lineIndex].slice(0, charIndex + 1);
    charIndex += 1;
    if (charIndex >= originals[lineIndex].length) {
      line.classList.remove('is-typing');
      lineIndex += 1;
      charIndex = 0;
      window.setTimeout(typeNext, 180);
      return;
    }
    window.setTimeout(typeNext, 72);
  };
  typeNext();
}

/* 欢迎区滚出可视区域后暂停眨眼/扫光，避免后台空转动画。 */
function watchWelcomeModule() {
  welcomeObserver?.disconnect();
  document.body.classList.remove('is-welcome-offscreen');
  const welcomeModule = document.querySelector('.ios-welcome, .android-welcome');
  if (!welcomeModule || !('IntersectionObserver' in window)) return;
  welcomeObserver = new IntersectionObserver(([entry]) => {
    document.body.classList.toggle('is-welcome-offscreen', !entry.isIntersecting);
  }, { root: document.querySelector('.mobile-content'), threshold: 0 });
  welcomeObserver.observe(welcomeModule);
}

/** 「今日」重画后调用：补播动效并重新挂上可视区域观察。 */
function setupWelcome() {
  runWelcomeIntro();
  watchWelcomeModule();
}
/* js/components/views-main.js */
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
/* js/components/views-space.js */
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
/* js/components/assistant.js */
/* 助手 overlay：idle → opening → open → closing → idle，动画中忽略重复点击。 */
const assistantPages = [...document.querySelectorAll('[data-assistant-page]')];
const homePage = document.querySelector('[data-home-page]');
let assistantTransition = 'idle';

function settleAssistantOpen() {
  if (assistantTransition !== 'opening') return;
  assistantPages.forEach((page) => page.classList.add('is-open'));
  assistantTransition = 'open';
}

function openAssistant(event, opener) {
  event?.preventDefault();
  if (assistantTransition !== 'idle') return;
  assistantTransition = 'opening';
  const source = opener || event?.currentTarget;
  const rect = source?.getBoundingClientRect();
  const root = document.documentElement;
  /* 圆形揭示的圆心：相对手机框，而不是整个视口。 */
  const isAndroid = document.body.classList.contains('platform-android');
  const surfaceWidth = isAndroid ? 412 : 430;
  const statusHeight = isAndroid ? 31 : 44;
  const surfaceLeft = Math.max(0, (window.innerWidth - Math.min(window.innerWidth, surfaceWidth)) / 2);
  root.style.setProperty('--origin-x', `${rect ? rect.left - surfaceLeft + rect.width / 2 : Math.min(window.innerWidth, surfaceWidth) * .88}px`);
  root.style.setProperty('--origin-y', `${rect ? rect.top - statusHeight + rect.height / 2 : 50}px`);
  homePage?.setAttribute('aria-hidden', 'true');
  homePage?.classList.add('is-assistant-hidden');
  assistantPages.forEach((page) => {
    page.classList.remove('is-closing', 'is-open');
    page.classList.add('is-visible');
    page.setAttribute('aria-hidden', 'false');
    page.addEventListener('animationend', settleAssistantOpen, { once: true });
  });
  window.setTimeout(settleAssistantOpen, 380);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeAssistant(event) {
  event?.preventDefault();
  if (assistantTransition === 'idle' || assistantTransition === 'closing') return;
  assistantTransition = 'closing';
  assistantPages.forEach((page) => {
    page.classList.remove('is-visible', 'is-open');
    page.classList.add('is-closing');
    page.setAttribute('aria-hidden', 'true');
    page.addEventListener('animationend', () => {
      page.classList.remove('is-closing');
      assistantTransition = 'idle';
    }, { once: true });
  });
  window.requestAnimationFrame(() => homePage?.classList.remove('is-assistant-hidden'));
  window.setTimeout(() => homePage?.removeAttribute('aria-hidden'), 280);
}

/* 欢迎区的「进入聊天助手」按钮随「今日」重画重建，因此用事件委托而不是一次性绑定。 */
document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-assistant]');
  if (opener) { openAssistant(event, opener); return; }
  if (event.target.closest('[data-close-assistant]')) closeAssistant(event);
});
/* iframe 聊天页点返回时发 sales-chat-close，由首页收起 overlay。 */
window.addEventListener('message', (event) => {
  const chatFrame = document.querySelector('.ios-chat-frame, .android-chat-frame');
  if (event.source !== chatFrame?.contentWindow || event.data?.type !== 'sales-chat-close') return;
  closeAssistant();
});
/* js/components/app-shell.js */
/*
 * 应用外壳：四主入口路由、底栏、本人助手悬浮入口、底部弹层与轻提示。
 * 本人助手（悬浮入口）与空间助手（概览内快捷问答）是两个入口，不混用（M05-1 US-MB1-11）。
 */

const viewRoot = document.querySelector('[data-view-root]');
const topbar = document.querySelector('[data-topbar]');
const bottomNav = document.querySelector('[data-bottom-nav]');
const sheetLayer = document.querySelector('[data-sheet-layer]');
const toast = document.querySelector('[data-toast]');
const assistantFab = document.querySelector('[data-open-assistant]');
let toastTimer;

const MAIN_VIEWS = { today: '今日', customers: '客户', related: '相关', profile: '我的' };

/* 底部轻提示：新消息会重置计时，约 2.4 秒后自动收起。 */
function showToast(message) {
  if (!toast) return;
  toast.querySelector('[data-toast-message]').textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}
window.SC.toast = showToast;

/** 底部弹层承载原文、变化详情与写入表单，避免移动端跳出当前上下文。 */
function openSheet(title, html, onReady) {
  const node = document.createElement('div');
  node.className = 'sheet-mask';
  node.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="sheet-head"><h3>${esc(title)}</h3><button type="button" class="sheet-close" data-sheet-close aria-label="关闭">×</button></header>
    <div class="sheet-body">${html}</div></section>`;
  sheetLayer.append(node);
  const close = () => node.remove();
  node.querySelector('[data-sheet-close]').addEventListener('click', close);
  node.addEventListener('click', (event) => { if (event.target === node) close(); });
  onReady?.(node, close);
  return { node, close };
}

/* ---------------- 路由 ---------------- */

function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(queryPart || ''));
  if (segments[0] === 'space' && segments[1]) {
    return { view: 'space', space: segments[1], tab: segments[2] || 'overview', sub: segments[3] || params.sub || 'followups', ...params };
  }
  return { view: MAIN_VIEWS[segments[0]] ? segments[0] : 'today', ...params };
}

let lastHash = null;

/** 同步导航：设置 hash 后立即重画，hashchange 只负责浏览器前进后退。 */
function go(hash) {
  const next = '#' + String(hash).replace(/^#/, '');
  if (window.location.hash === next) { render(); return; }
  window.location.hash = next;
  render();
}

function render() {
  lastHash = window.location.hash;
  const route = parseRoute();
  const main = route.view === 'space' ? null : route.view;
  // 「今日」沿用导入时的日期标题，其余入口用入口名，空间详情由自己的顶栏承接。
  const todayLabel = `${Number(F.today.slice(5, 7))}月${Number(F.today.slice(8, 10))}日`;
  topbar.innerHTML = route.view === 'space'
    ? ''
    : route.view === 'today'
      ? `<div class="mobile-greeting"><h1>${esc(todayLabel)}</h1></div>`
      : `<div class="mobile-greeting"><p class="eyebrow">${esc(F.actor.name)} · 销售</p><h1>${esc(MAIN_VIEWS[route.view])}</h1></div>`;
  topbar.hidden = route.view === 'space';
  viewRoot.innerHTML = route.view === 'space' ? viewSpace(route)
    : route.view === 'customers' ? viewCustomers(route)
    : route.view === 'related' ? viewRelated()
    : route.view === 'profile' ? viewProfile()
    : viewToday();
  bottomNav.querySelectorAll('[data-nav-item]').forEach((item) => {
    // 进入空间详情时保留来源入口的高亮，不让底栏失去当前位置。
    item.classList.toggle('is-active', item.dataset.navItem === (main || lastMainView));
  });
  if (main) lastMainView = main;
  // 本人助手悬浮入口只在客户 / 相关 / 我的常驻：「今日」由欢迎区自带的「进入聊天助手」承接，
  // 客户空间内由概览的空间助手承接，避免两类助手入口叠在同一屏。
  if (assistantFab) assistantFab.hidden = !['customers', 'related', 'profile'].includes(route.view);
  viewRoot.scrollTop = 0;
  bindView(route);
}

let lastMainView = 'today';

/* ---------------- 交互绑定 ---------------- */

function bindView(route) {
  // 欢迎区动效随「今日」重画补挂；每个会话只播一次打字机。
  if (route.view === 'today') setupWelcome();
  else welcomeObserver?.disconnect();

  // 跟进卡展开与进入空间
  viewRoot.querySelectorAll('[data-follow-card]').forEach((card) => {
    card.querySelector('[data-follow-toggle]')?.addEventListener('click', (event) => { event.stopPropagation(); card.classList.toggle('is-expanded'); });
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-space-link]') || event.target.closest('[data-follow-toggle]') || event.target.closest('button')) return;
      card.classList.toggle('is-expanded');
    });
  });
  viewRoot.querySelectorAll('[data-mark-space]').forEach((button) => button.addEventListener('click', () => openMarkSheet(button.dataset.markSpace)));

  // 收件箱：展开即已读（写回同一份业务数据），条目只有一个动作
  viewRoot.querySelectorAll('[data-inbox-item]').forEach((item) => {
    item.querySelector('[data-inbox-toggle]')?.addEventListener('click', () => {
      const expanded = item.classList.toggle('is-expanded');
      if (!expanded || item.dataset.status === 'done') return;
      F.mutate('移动端阅读提醒', (state) => {
        const record = state.notifications.find((one) => one.id === item.dataset.notification);
        if (record) record.read = true;
      });
      item.querySelector('.unread-dot')?.remove();
    });
  });
  viewRoot.querySelectorAll('[data-inbox-tab]').forEach((button) => button.addEventListener('click', () => {
    viewRoot.querySelectorAll('[data-inbox-tab]').forEach((one) => one.classList.toggle('is-active', one === button));
    const wanted = button.dataset.inboxTab;
    const items = [...viewRoot.querySelectorAll('[data-inbox-item]')];
    items.forEach((item) => { item.hidden = item.dataset.status !== wanted; if (item.hidden) item.classList.remove('is-expanded'); });
    const empty = viewRoot.querySelector('[data-inbox-empty]');
    if (empty) empty.hidden = items.some((item) => !item.hidden);
  }));
  const firstTab = viewRoot.querySelector('[data-inbox-tab].is-active');
  if (firstTab) firstTab.click();

  // 客户搜索：只在有权范围内过滤，不暴露无权客户
  const search = viewRoot.querySelector('[data-customer-search]');
  if (search) {
    let timer;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const value = search.value.trim();
        go(value ? `/customers?q=${encodeURIComponent(value)}` : '/customers');
        window.requestAnimationFrame(() => viewRoot.querySelector('[data-customer-search]')?.focus());
      }, 260);
    });
  }

  // 空间详情
  viewRoot.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => go(`/space/${route.space}/${button.dataset.tab}`)));
  viewRoot.querySelectorAll('[data-subtab]').forEach((button) => button.addEventListener('click', () => go(`/space/${route.space}/followup/${button.dataset.subtab}`)));
  viewRoot.querySelector('[data-back]')?.addEventListener('click', () => go('/' + lastMainView));
  viewRoot.querySelectorAll('[data-deeplink]').forEach((button) => button.addEventListener('click', () => go(`/space/${route.space}/customer?highlight=${button.dataset.deeplink}`)));
  viewRoot.querySelectorAll('[data-source]').forEach((button) => button.addEventListener('click', () => openSource(button.dataset.source)));
  viewRoot.querySelectorAll('[data-open-change]').forEach((button) => button.addEventListener('click', () => {
    const change = F.changesOf(route.space).find((item) => item.id === button.dataset.openChange);
    if (!change) { showToast('该次变化不在当前可见范围'); return; }
    openSheet('本次变化 · ' + change.sourceLabel, `<div data-change-detail><p class="record-meta">${esc(change.at)}</p>${changeBlock(change)}</div>`, (sheet) => {
      sheet.querySelectorAll('[data-source]').forEach((chip) => chip.addEventListener('click', () => openSource(chip.dataset.source)));
    });
  }));

  // 提醒直达：带 change 参数时直接打开对应那次变化，而不是只落到空间首页
  if (route.view === 'space' && route.change) {
    const change = F.changesOf(route.space).find((item) => item.id === route.change);
    if (change) openSheet('本次变化 · ' + change.sourceLabel, `<div data-change-detail><p class="record-meta">${esc(change.at)}</p>${changeBlock(change)}</div>`);
    else showToast('该次变化不在当前可见范围');
  }

  // 空间助手问答（与网页端同一条判定链路）
  viewRoot.querySelectorAll('[data-ask]').forEach((button) => button.addEventListener('click', () => ask(route.space, button.dataset.ask)));
  const qaForm = viewRoot.querySelector('[data-qa-form]');
  qaForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = qaForm.elements.question.value.trim();
    if (question) ask(route.space, question);
  });

  // 写入、草稿与方案回复
  viewRoot.querySelectorAll('[data-write]').forEach((button) => button.addEventListener('click', () => {
    const space = F.space(route.space);
    if (space) openWriteSheet(space, button.dataset.write);
  }));
  viewRoot.querySelectorAll('[data-edit-draft]').forEach((button) => button.addEventListener('click', () => {
    const draft = draftsOf().find((item) => item.id === button.dataset.editDraft);
    const space = F.space(draft?.space);
    if (draft && space) openWriteSheet(space, draft.kind, draft.values, draft.id);
  }));
  viewRoot.querySelectorAll('[data-submit-draft]').forEach((button) => button.addEventListener('click', () => {
    const draft = draftsOf().find((item) => item.id === button.dataset.submitDraft);
    const space = F.space(draft?.space);
    if (!draft || !space) return;
    if (isOffline()) { showToast('当前处于离线，联网后再确认提交'); return; }
    // 草稿一律经由本人确认提交；基线变了就按先提交为准提示，不静默覆盖。
    openWriteSheet(space, draft.kind, draft.values, draft.id);
  }));
  viewRoot.querySelectorAll('[data-drop-draft]').forEach((button) => button.addEventListener('click', () => {
    dropDraft(button.dataset.dropDraft);
    showToast('草稿已删除，不会自动恢复');
    render();
  }));
  viewRoot.querySelectorAll('[data-reply-solution]').forEach((button) => button.addEventListener('click', () => openReplySheet(button.dataset.replySolution)));
  // 方案往来：首次在空间内打开即标记已读并回传给方案人员（M05-1 §4.4）。
  if (route.view === 'space' && route.tab === 'followup' && route.sub === 'solutions' && !isOffline()) {
    const unread = viewRoot.querySelectorAll('[data-solution]');
    let touched = false;
    unread.forEach((node) => {
      const record = F.load().solutions.find((item) => item.id === node.dataset.solution);
      if (!record || record.read) return;
      try { F.solutionAction(record.id, 'read'); touched = true; } catch (_) { /* 冻结或失权时保持未读 */ }
    });
    if (touched) { render(); return; }
  }

  // 录音归位（R10：必须锚定商机，多商机不代选）
  viewRoot.querySelectorAll('[data-place-recording]').forEach((button) => button.addEventListener('click', () => openPlaceSheet(button.dataset.placeRecording)));
  viewRoot.querySelectorAll('[data-resync-recording]').forEach((button) => button.addEventListener('click', () => {
    try { F.retryRecordingSync(button.dataset.resyncRecording); showToast('已重新同步，转写可用后可继续归位'); render(); }
    catch (error) { showToast(error.message); }
  }));

  // 本周经营横滑：键盘左右键一次滚动一张卡片宽度
  const track = viewRoot.querySelector('.ios-performance-track');
  track?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    track.scrollBy({ left: event.key === 'ArrowRight' ? 218 : -218, behavior: 'smooth' });
  });

  // 我的：离线演示开关
  viewRoot.querySelector('[data-offline-toggle]')?.addEventListener('change', (event) => {
    setOffline(event.target.checked);
    showToast(event.target.checked ? '已切到离线：只读最近打开过的空间' : '已恢复联网');
    render();
  });
}

function ask(spaceId, question) {
  try {
    const result = F.askSpace(spaceId, question);
    showToast(result.hasEvidence ? '已按当前空间上下文作答' : '当前空间没有可用依据，未生成推测答案');
    render();
  } catch (error) { showToast(error.message); }
}

function openMarkSheet(spaceId) {
  openSheet('星标 / 暂不跟进', `<form class="sheet-form" data-mark-form>
    <label class="sheet-field"><span>操作</span><select name="action"><option value="star">星标</option><option value="pause">暂不跟进</option></select></label>
    <label class="sheet-field"><span>原因（暂不跟进必填）</span><textarea name="reason" rows="2"></textarea></label>
    <p class="sheet-error" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit">保存</button>
    <p class="record-meta">标记只写入次日判断输入，今天的名单不变。</p></form>`, (sheet, close) => {
    sheet.querySelector('[data-mark-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        F.markSpace(spaceId, values.action === 'star' ? { starred: true } : { pause: { reason: values.reason } });
        close(); showToast('已保存，次日生效'); render();
      } catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
  });
}

function openReplySheet(solutionId) {
  openSheet('回复方案', `<form class="sheet-form" data-reply-form>
    <label class="sheet-field"><span>回复内容 *</span><textarea name="text" rows="4"></textarea></label>
    <p class="sheet-error" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit">提交回复</button>
    <p class="record-meta">单轮回复，提交后本轮结束。</p></form>`, (sheet, close) => {
    sheet.querySelector('[data-reply-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = new FormData(event.currentTarget).get('text');
      try { F.solutionAction(solutionId, 'reply', text); close(); showToast('已回复，方案人员会收到提醒'); render(); }
      catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
  });
}

function openPlaceSheet(recordingId) {
  const state = F.load();
  const placed = F.recordingPlacements(recordingId, state).map((item) => item.space);
  const targets = F.visible(state).filter((space) => F.canWrite(space) && (space.opps || []).length && !placed.includes(space.id));
  if (!targets.length) {
    openSheet('归位录音', '<p class="record-warn">当前没有可归位的客户空间：归位必须锚定商机，冻结空间、仅客户级确权的空间和已归位过的空间都不在可选范围内。</p>');
    return;
  }
  const oppOptions = (space) => space.opps.map((opp) => `<option value="${esc(opp.id)}">${esc(opp.name)}</option>`).join('');
  openSheet('归位录音', `<form class="sheet-form" data-place-form>
    <label class="sheet-field"><span>客户空间 *</span><select name="space">${targets.map((space) => `<option value="${esc(space.id)}">${esc(space.customer)}</option>`).join('')}</select></label>
    <label class="sheet-field"><span>关联商机 *</span><select name="opportunityId">${targets[0].opps.length > 1 ? '<option value="">请指定一条商机</option>' : ''}${oppOptions(targets[0])}</select></label>
    <p class="record-meta" data-opp-hint>${targets[0].opps.length > 1 ? '该空间有多条商机，必须由你指定一条，系统不代选。' : '该空间仅一条商机，已自动带出，可以修改。'}</p>
    <p class="sheet-error" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit">确认归位</button>
    <p class="record-meta">归位成功不等于客户信息已更新；转写可用后才开始更新。</p></form>`, (sheet, close) => {
    const form = sheet.querySelector('[data-place-form]');
    form.elements.space.addEventListener('change', () => {
      const target = targets.find((space) => space.id === form.elements.space.value);
      const multi = target.opps.length > 1;
      form.elements.opportunityId.innerHTML = (multi ? '<option value="">请指定一条商机</option>' : '') + oppOptions(target);
      sheet.querySelector('[data-opp-hint]').textContent = multi ? '该空间有多条商机，必须由你指定一条，系统不代选。' : '该空间仅一条商机，已自动带出，可以修改。';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      try { F.placeRecording(recordingId, values); close(); showToast('已归位；转写可用后自动更新客户信息'); render(); }
      catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
  });
}

/* ---------------- 底栏与助手入口 ---------------- */

bottomNav.querySelectorAll('[data-nav-item]').forEach((item) => item.addEventListener('click', () => go('/' + item.dataset.navItem)));
window.addEventListener('hashchange', () => { if (window.location.hash !== lastHash) render(); });
render();
