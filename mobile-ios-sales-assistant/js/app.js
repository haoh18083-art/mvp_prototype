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

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return { offline: !!parsed.offline, cached: Array.isArray(parsed.cached) ? parsed.cached : [], drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [], readChanges: Array.isArray(parsed.readChanges) ? parsed.readChanges : [], fabPos: parsed.fabPos && typeof parsed.fabPos === 'object' ? parsed.fabPos : null };
    }
  } catch (_) { /* 存储不可用时退回内存态，不阻断阅读 */ }
  return { offline: false, cached: [], drafts: [], readChanges: [], fabPos: null };
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

/* 更新入口红点：已读变化 id 记在本机；打开更新面板即视为已读，不写进业务数据。 */
const isChangeRead = (id) => local.readChanges.includes(id);

function markChangesRead(ids) {
  const readChanges = [...new Set([...local.readChanges, ...ids])].slice(-50);
  saveLocal({ ...local, readChanges });
}

/* 空间助手悬浮图标位置：拖动后记在本机（right/bottom 偏移），不进业务数据。 */
const getFabPos = () => local.fabPos;

function saveFabPos(pos) {
  saveLocal({ ...local, fabPos: pos && typeof pos.right === 'string' && typeof pos.bottom === 'string' ? pos : null });
}

/**
 * 远端增量样例：点「拉取」时写入本人录音管理。
 * 智能总结与录音原文随远端一并同步（三方已完成转写），移动端不做本地转写。
 */
const REMOTE_INCOMING = [
  {
    id: 'MT-201', title: '华东峰值复核沟通', date: '2026-09-16 10:18', duration: '24:06',
    syncedAt: '2026-09-16 10:26', summary: '客户确认华东峰值按工作日口径测算，节假日营销场景暂不纳入本期。',
    transcript: '00:10  客户：峰值先按工作日口径。\n04:22  销售：节假日营销先不进本期。\n11:08  客户：下周三给测算表。'
  },
  {
    id: 'MT-202', title: '试点验收口径对齐', date: '2026-09-16 14:42', duration: '19:50',
    syncedAt: '2026-09-16 14:50', summary: '双方对齐可用率与接通时长两项验收指标，负责人待客户侧确认。',
    transcript: '00:18  销售：验收先定两项指标。\n06:40  客户：可用率和接通时长可以。\n15:02  客户：负责人这周内确定。'
  }
];

/**
 * 从远端增量拉取尚未入库的录音。
 * @returns {{added: number}} 本次新写入的条数；0 表示远端没有增量。
 */
function pullRemoteRecordings() {
  const state = F.load();
  const incoming = REMOTE_INCOMING.filter((item) => !(state.meetings || []).some((row) => row.id === item.id));
  if (!incoming.length) return { added: 0 };
  F.mutate('拉取远端录音', (next) => {
    incoming.forEach((item) => {
      next.meetings.unshift({
        source: '三方录音服务', syncStatus: 'synced', syncReason: '', ownerResolved: true,
        owner: F.actor.id, ...item
      });
    });
  });
  return { added: incoming.length };
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
 * 欢迎区：打字机文案、会眨眼的熊形象和「进入聊天助手」入口。
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

/* js/components/icons.js */
/*
 * 图标注册表：移动端主 UI 所有图标的唯一来源。
 * 统一 24×24 viewBox、stroke="currentColor"、stroke-width 1.8、round cap/join；语义相同的图标只保留一个。
 * 尺寸由 css/components/icon.css 的 .ic / .ic-xs…xl 控制，不在 SVG 上写宽高。
 */
const ICONS = {
  /* 底栏四入口 */
  today: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"></rect><path d="M8 3v4M16 3v4M3.5 10h17"></path>',
  customers: '<circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 19.5c.4-3.4 2.4-5.3 5.5-5.3s5.1 1.9 5.5 5.3M16 5.6a3.2 3.2 0 0 1 0 6.2M17 14.4c2.2.4 3.4 2.1 3.7 5.1"></path>',
  related: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"></rect><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5"></path>',
  profile: '<circle cx="12" cy="8.5" r="3.5"></circle><path d="M5 20c.6-3.9 3-6 7-6s6.4 2.1 7 6"></path>',
  /* 本人助手悬浮入口使用气泡图标；首页欢迎区另用熊形象。 */
  assistant: '<path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8.5a2.5 2.5 0 0 1-2.5 2.5h-6.6L8.5 21.5v-4h-4A2.5 2.5 0 0 1 2 15V6.5A2.5 2.5 0 0 1 4.5 4Z"></path><circle class="ios-doll-eye" cx="8.6" cy="9.6" r="1.15" fill="currentColor" stroke="none"></circle><circle class="ios-doll-eye" cx="15.4" cy="9.6" r="1.15" fill="currentColor" stroke="none"></circle><path d="M9 13c1.6 1.5 4.4 1.5 6 0"></path>',
  /* 导航与方向 */
  'arrow-right': '<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"></path>',
  'chevron-right': '<path d="m9 5 7 7-7 7"></path>',
  'chevron-down': '<path d="m5 9 7 7 7-7"></path>',
  'chevron-left': '<path d="m15 5-7 7 7 7"></path>',
  /* 状态与操作 */
  check: '<path d="m5 12.5 4.5 4.5L19 7"></path>',
  close: '<path d="M6 6l12 12M18 6 6 18"></path>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z"></path>',
  search: '<circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.3-4.3"></path>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.2-5.5"></path><path d="M20 4.5v5h-5"></path>',
  /* 空间更新入口（顶栏右上角），有更新时由外层按钮加红点 */
  bell: '<path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"></path><path d="M10 19.5a2.2 2.2 0 0 0 4 0"></path>',
  /* 空间助手生成中：发送键切换为停止 */
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"></rect>'
};

/**
 * 输出一枚图标。name 取自 ICONS；className 追加到 .ic 上（如 ic-xs / ic-lg 控制尺寸）。
 * 图标一律装饰性，aria-hidden；需要可读名称时由外层按钮的 aria-label 承担。
 */
function icon(name, className) {
  const body = ICONS[name];
  if (!body) return '';
  const cls = ['ic', `ic-${name}`].concat(className ? [className] : []).join(' ');
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** 列表行尾 chevron：is-toggle 为展开/收起（向下、展开时旋转），否则为进入（向右）。 */
function rowChevron(toggle) {
  return `<span class="row-chevron${toggle ? ' is-toggle' : ''}" aria-hidden="true">${icon(toggle ? 'chevron-down' : 'chevron-right')}</span>`;
}

/* js/components/views-main.js */
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

/* js/components/views-space.js */
/*
 * R09 §4.2–§4.4 空间详情：六个常驻 Tab、默认落地概览、折叠区每次进入重新收起、
 * 深链直达客户 Tab 并高亮、冻结只读、离线只读缓存、跟进与周复盘写入、并发先提交为准。
 * 内容全部取自桌面同一套 F.overview / F.contentScope / F.spacePlacements 等函数。
 */

const SPACE_TABS = [['overview', '概览'], ['customer', '客户'], ['opps', '商机'], ['followup', '跟进'], ['documents', '资料'], ['profit', '历史毛利']];
const spaceFinanceMonths = {};
const SPACE_SUBS = [['followups', '跟进记录'], ['behaviors', '行为记录'], ['solutions', '方案往来'], ['recordings', '录音']];

/* 概览常显区（去卡片化分区）：当月毛利 → 指标条 → 一句话判断 → 客户画像 → 关键人与联系人 → 风险标记 → 当前卡点 → 最近动静；空间助手为可移动悬浮图标，唤出 4/5 屏抽屉问答（M05-1 §4.2、M05-3 §4.3，0921 版面）。 */
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
    ${F.spaceProfitCard(space.id, state)}
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
    : tab === 'profit' ? `<div class="space-body gp-history-container" data-space-tab="profit">${F.financeHistory(space.id, spaceFinanceMonths[space.id], state)}</div>`
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
 * 本人助手（四主入口悬浮入口）与空间助手（空间详情可移动悬浮图标 + 抽屉）是两个入口，不混用（M05-1 US-MB1-11、M05-3 §4.3）。
 */

const viewRoot = document.querySelector('[data-view-root]');
const topbar = document.querySelector('[data-topbar]');
const frame = document.querySelector('.mobile-frame');
const bottomNav = document.querySelector('[data-bottom-nav]');
const sheetLayer = document.querySelector('[data-sheet-layer]');
const toast = document.querySelector('[data-toast]');
const assistantFab = document.querySelector('[data-open-assistant]');
const spaceFab = document.querySelector('[data-open-space-assistant]');
let toastTimer;

const MAIN_VIEWS = { today: '今日', customers: '客户', related: '相关', profile: '我的' };

/* 外壳静态节点的图标统一从注册表注入：底栏四入口、悬浮入口、轻提示。 */
bottomNav.querySelectorAll('[data-nav-item]').forEach((item) => item.insertAdjacentHTML('afterbegin', icon(item.dataset.navItem)));
assistantFab?.insertAdjacentHTML('afterbegin', icon('assistant'));
spaceFab?.insertAdjacentHTML('afterbegin', icon('assistant'));
toast?.insertAdjacentHTML('afterbegin', icon('check'));

/* 空间助手悬浮入口：外壳级节点，只在空间详情显示；可拖动换位，拖拽松手不触发点击。 */
if (spaceFab) {
  bindSpaceFabDrag(spaceFab);
  spaceFab.addEventListener('click', () => {
    if (spaceFab.dataset.dragged === '1') return;
    const space = F.space(parseRoute().space);
    if (space) openSpaceAssistantSheet(space);
  });
}

/* 底部轻提示：新消息会重置计时，约 2.4 秒后自动收起。 */
function showToast(message) {
  if (!toast) return;
  toast.querySelector('[data-toast-message]').textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}
window.SC.toast = showToast;

/**
 * 通用底部抽屉：与空间录音、本次变化、空间更新同一套外壳——自底向上、占 4/5 屏。
 * 内容放在 .rec-sheet-body 内；onReady 仍然拿到弹层节点与关闭函数，调用方式不变。
 * subtitle 用于补一行上下文（例如「哪个空间的哪条录音」）。
 * 嵌套时不做替换：后开的叠在上面，关闭后回到下面那层。
 */
function openSheet(title, html, onReady, subtitle = '') {
  const host = frame || sheetLayer;
  const node = document.createElement('div');
  node.className = 'rec-sheet-mask';
  node.innerHTML = `<section class="rec-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="rec-sheet-head">
      <div class="rec-sheet-copy"><h3 class="t-heading t-ellipsis">${esc(title)}</h3>${subtitle ? `<p class="t-meta t-ellipsis">${esc(subtitle)}</p>` : ''}</div>
      <button type="button" class="sheet-close" data-sheet-close aria-label="关闭">${icon('close')}</button>
    </header>
    <div class="rec-sheet-body">${html}</div>
  </section>`;
  host.append(node);
  const close = bindTallSheet(node);
  onReady?.(node, close);
  return { node, close };
}

/* ---------------- 路由 ---------------- */

function parseRoute(hash = window.location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(queryPart || ''));
  if (segments[0] === 'space' && segments[1]) {
    return { view: 'space', space: segments[1], tab: segments[2] || 'overview', sub: segments[3] || params.sub || 'followups', ...params };
  }
  // 「相关」的二级页：录音管理列表与归位操作
  if (segments[0] === 'related' && segments[1] === 'recordings') {
    return { view: 'recordings', ...params };
  }
  return { view: MAIN_VIEWS[segments[0]] ? segments[0] : 'today', ...params };
}

let lastHash = null;
let lastRoute = null;

/* ---------------- 路由转场 ---------------- */

/*
 * 进入客户空间用「推入」、返回入口用「弹出」，与 iOS 一致：
 * 新页整体从右（推入）或从左（弹出）滑动，旧页由同尺寸快照垫层向反方向让位。
 * 真实 DOM 始终同步切换，垫层只承担视觉；引擎不支持动画（jsdom 回归、旧引擎）或用户要求减少动效时直接跳到终态。
 */
const TRANSITION_SETTLE_MS = 600;
let transitionTimer;

/** 引擎是否具备本页转场所需的 CSS 动画能力；动效偏好为减少时不做转场。 */
function routeMotionEnabled() {
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return typeof window.CSS !== 'undefined' && typeof window.CSS.supports === 'function' && window.CSS.supports('animation', 'view-enter-forward 1ms linear');
}

/** 方向判定：入口 → 空间详情/二级页为前进，反之为返回；主入口之间与同一空间内切换不动画。 */
function routeDirection(from, to) {
  if (!from || !to) return '';
  if (from.view === 'space' && to.view === 'space') return from.space === to.space ? '' : 'forward';
  if (from.view === 'recordings' && to.view === 'recordings') return '';
  const fromSub = from.view === 'space' || from.view === 'recordings';
  const toSub = to.view === 'space' || to.view === 'recordings';
  if (!fromSub && !toSub) return '';
  return toSub ? 'forward' : 'back';
}

/** 转场前留存旧页快照（顶栏 + 内容区）与滚动位置，作为让位垫层。 */
function snapshotPage() {
  const layer = document.createElement('div');
  layer.className = 'view-transition-layer';
  layer.setAttribute('aria-hidden', 'true');
  const bar = topbar.cloneNode(true);
  const body = viewRoot.cloneNode(true);
  // 去掉路由钩子：快照不是当前视图，避免出现第二个 [data-view-root] / [data-topbar]
  bar.removeAttribute('data-topbar');
  body.removeAttribute('data-view-root');
  layer.append(bar, body);
  return { layer, scrollTop: viewRoot.scrollTop };
}

/** 收尾：清掉两层动画类、移除垫层并复位计时器；重复调用安全。 */
function clearRouteTransition() {
  window.clearTimeout(transitionTimer);
  frame?.classList.remove('is-entering-forward', 'is-entering-back');
  frame?.querySelectorAll('.view-transition-layer').forEach((layer) => layer.remove());
}

/** 播放转场：新页已在 DOM 中，垫层按方向把旧页送出屏幕。 */
function playRouteTransition(direction, snapshot) {
  const forward = direction === 'forward';
  clearRouteTransition();
  snapshot.layer.classList.add(forward ? 'is-leaving-forward' : 'is-leaving-back');
  frame.classList.add(forward ? 'is-entering-forward' : 'is-entering-back');
  frame.append(snapshot.layer);
  // 插入后才有布局，此时才能把垫层对齐到旧页原来的滚动位置
  const body = snapshot.layer.querySelector('.mobile-content');
  if (body) body.scrollTop = snapshot.scrollTop;
  const settle = (event) => {
    if (event && event.target !== snapshot.layer) return;
    clearRouteTransition();
  };
  snapshot.layer.addEventListener('animationend', settle);
  // 兜底：动画事件缺失（后台标签页等）时也要收尾，避免垫层留在页面上
  transitionTimer = window.setTimeout(settle, TRANSITION_SETTLE_MS);
}

/** 同步导航：设置 hash 后立即重画，hashchange 只负责浏览器前进后退。 */
function go(hash) {
  const next = '#' + String(hash).replace(/^#/, '');
  if (window.location.hash === next) { render(); return; }
  // 方向要在改 hash 之前算：改完之后当前路由已经是目标路由
  const direction = routeDirection(lastRoute, parseRoute(next));
  window.location.hash = next;
  render(direction);
}

function render(direction = '') {
  lastHash = window.location.hash;
  const route = parseRoute();
  // 快照必须在重画前取：重画后 viewRoot 里已经是新页
  // 换页时收起所有抽屉（含叠层），避免旧页的弹层留在新页上
  frame?.querySelectorAll('.rec-drawer-mask, .rec-sheet-mask').forEach((node) => node.remove());
  sheetLayer?.querySelectorAll('.rec-sheet-mask').forEach((node) => node.remove());
  const snapshot = direction && routeMotionEnabled() && frame ? snapshotPage() : null;
  const main = route.view === 'space' || route.view === 'recordings' ? null : route.view;
  // 顶栏只放标题：「今日」沿用导入时的日期标题，其余入口用入口名（不再带身份副标题，身份在「我的 → 账号信息」）；
  // 空间详情与二级页由各自的页内顶栏承接。
  const todayLabel = `${Number(F.today.slice(5, 7))}月${Number(F.today.slice(8, 10))}日`;
  topbar.innerHTML = route.view === 'space' || route.view === 'recordings'
    ? ''
    : `<div class="mobile-greeting"><h1 class="t-display">${esc(route.view === 'today' ? todayLabel : MAIN_VIEWS[route.view])}</h1></div>`;
  topbar.hidden = route.view === 'space' || route.view === 'recordings';
  viewRoot.innerHTML = route.view === 'space' ? viewSpace(route)
    : route.view === 'recordings' ? viewRecordings()
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
  // 空间助手悬浮入口只在有权进入的客户空间详情内展示，与本人助手入口互斥不同时出现。
  if (spaceFab) spaceFab.hidden = route.view !== 'space' || !F.space(route.space);
  viewRoot.scrollTop = 0;
  bindView(route);
  centerActiveTabs();
  if (snapshot) playRouteTransition(direction, snapshot);
  lastRoute = route;
}

let lastMainView = 'today';

/** 下划线 Tab 可横向滚动：激活项自动滚到轨道居中。 */
function centerActiveTabs(scope) {
  (scope || viewRoot).querySelectorAll('.seg-tabs-track').forEach((track) => {
    const active = track.querySelector('.seg-tab.is-active');
    if (!active || !track.clientWidth) return;
    const left = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
    if (typeof track.scrollTo === 'function') track.scrollTo({ left, behavior: 'smooth' });
    else track.scrollLeft = left;
  });
}

/* ---------------- 交互绑定 ---------------- */

function bindView(route) {
  // 历史月份只重绘当前空间的财务区域，概览始终读取当月。
  viewRoot.querySelector('[data-profit-month]')?.addEventListener('change', event => {
    if (F.monthRange(event.target.value) && event.target.value < F.financeMonth()) {
      spaceFinanceMonths[route.space] = event.target.value;
      render();
    }
  });
  // 欢迎区动效随「今日」重画补挂；每个会话只播一次打字机。
  if (route.view === 'today') setupWelcome();
  else welcomeObserver?.disconnect();

  // 跟进行：点行头展开「下一步 + 判断依据」，行尾 chevron 进入空间；
  // 收起只认行头，因此在展开区点依据不会把卡片收回去（与收件箱的可展开行一致）。
  viewRoot.querySelectorAll('[data-follow-toggle]').forEach((head) => {
    const card = head.closest('[data-follow-card]');
    const toggle = () => {
      const expanded = card.classList.toggle('is-expanded');
      head.setAttribute('aria-expanded', String(expanded));
    };
    head.addEventListener('click', (event) => {
      if (event.target.closest('[data-space-link]') || event.target.closest('button')) return;
      toggle();
    });
    head.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
  });
  viewRoot.querySelectorAll('[data-mark-space]').forEach((button) => button.addEventListener('click', () => markSpace(button.dataset.markSpace, button.dataset.markAction)));

  // 收件箱：展开即已读（写回同一份业务数据），条目只有一个动作
  viewRoot.querySelectorAll('[data-inbox-item]').forEach((item) => {
    const toggle = item.querySelector('[data-inbox-toggle]');
    const expand = () => {
      const expanded = item.classList.toggle('is-expanded');
      if (!expanded || item.dataset.status === 'done') return;
      F.mutate('移动端阅读提醒', (state) => {
        const record = state.notifications.find((one) => one.id === item.dataset.notification);
        if (record) record.read = true;
      });
      item.querySelector('.unread-dot')?.remove();
    };
    toggle?.addEventListener('click', expand);
    toggle?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expand(); } });
  });
  viewRoot.querySelectorAll('[data-inbox-tab]').forEach((button) => button.addEventListener('click', () => {
    viewRoot.querySelectorAll('[data-inbox-tab]').forEach((one) => { one.classList.toggle('is-active', one === button); one.setAttribute('aria-selected', one === button); });
    centerActiveTabs(button.closest('.seg-tabs'));
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
  // 二级页固定回「相关」；空间详情回来源入口
  viewRoot.querySelector('[data-back]')?.addEventListener('click', () => go(route.view === 'recordings' ? '/related' : '/' + lastMainView));
  viewRoot.querySelectorAll('[data-deeplink]').forEach((button) => button.addEventListener('click', () => go(`/space/${route.space}/customer?highlight=${button.dataset.deeplink}`)));
  viewRoot.querySelectorAll('[data-source]').forEach((button) => button.addEventListener('click', () => openSource(button.dataset.source)));
  viewRoot.querySelectorAll('[data-open-change]').forEach((button) => button.addEventListener('click', () => {
    const change = F.changesOf(route.space).find((item) => item.id === button.dataset.openChange);
    if (!change) { showToast('该次变化不在当前可见范围'); return; }
    openChangeSheet(change);
  }));
  // 更新入口：顶栏右上角图标唤出更新面板（最近一次变化 + 全量更新历史）
  viewRoot.querySelectorAll('[data-open-updates]').forEach((button) => button.addEventListener('click', () => {
    const space = F.space(route.space);
    if (space) openUpdatesSheet(space);
  }));

  // 提醒直达：带 change 参数时直接打开对应那次变化，而不是只落到空间首页
  if (route.view === 'space' && route.change) {
    const change = F.changesOf(route.space).find((item) => item.id === route.change);
    if (change) openChangeSheet(change);
    else showToast('该次变化不在当前可见范围');
  }

  // 空间助手入口是外壳级悬浮节点，显隐与点击绑定见 render() 与启动处，不在视图内委托。

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
  viewRoot.querySelectorAll('[data-open-solution-file]').forEach((button) => button.addEventListener('click', () => {
    openSolutionFile(button.dataset.openSolutionFile, button.dataset.fileIndex);
  }));
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

  // 录音管理：未处理 / 已处理筛选；点卡片打开智能总结抽屉；归位仍锚定商机。
  viewRoot.querySelectorAll('[data-rec-tab]').forEach((button) => button.addEventListener('click', () => {
    const wanted = button.dataset.recTab;
    viewRoot.querySelectorAll('[data-rec-tab]').forEach((one) => {
      one.classList.toggle('is-active', one === button);
      one.setAttribute('aria-selected', one === button);
    });
    centerActiveTabs(button.closest('.seg-tabs'));
    viewRoot.querySelectorAll('[data-recording]').forEach((card) => { card.hidden = card.dataset.recBucket !== wanted; });
    viewRoot.querySelectorAll('[data-rec-empty]').forEach((empty) => {
      const bucket = empty.dataset.recEmpty;
      const has = viewRoot.querySelectorAll(`[data-rec-bucket="${bucket}"]`).length;
      empty.hidden = wanted !== bucket || has > 0;
    });
    const pull = viewRoot.querySelector('[data-pull-recordings]');
    if (pull) pull.hidden = wanted !== 'open';
  }));
  viewRoot.querySelector('[data-pull-recordings]')?.addEventListener('click', () => {
    const { added } = pullRemoteRecordings();
    showToast(added ? `已新同步${added}条录音内容` : '未发现新增录音');
    if (added) render();
  });
  viewRoot.querySelectorAll('[data-open-recording]').forEach((button) => button.addEventListener('click', () => openRecordingDrawer(button.dataset.openRecording)));
  viewRoot.querySelectorAll('[data-open-space-recording]').forEach((button) => button.addEventListener('click', () => openSpaceRecordingSheet(button.dataset.openSpaceRecording)));
  viewRoot.querySelectorAll('[data-place-here]').forEach((button) => button.addEventListener('click', () => openPlaceHereSheet(route.space)));
  viewRoot.querySelectorAll('[data-place-recording]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    openPlaceSheet(button.dataset.placeRecording);
  }));
  viewRoot.querySelectorAll('[data-resync-recording]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    try { F.retryRecordingSync(button.dataset.resyncRecording); showToast('已重新同步，同步完成后可继续归位'); render(); }
    catch (error) { showToast(error.message); }
  }));

  // 本月经营横滑：键盘左右键一次滚动一张卡片宽度
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
  return F.askSpace(spaceId, question);
}

/**
 * 空间助手悬浮图标拖动：位移超过阈值算拖动（松手不触发点击），位置记本机；
 * 无 Pointer 事件能力的环境（含 jsdom 回归）退化为固定右下角，不影响点击唤出。
 */
function bindSpaceFabDrag(fab) {
  /* 宽屏下 fixed 相对视口：拖动与位置恢复都约束在手机框内（顶栏之下、底栏之上），不让球跑出框。 */
  const clampPos = (rightPx, bottomPx) => {
    const size = fab.offsetWidth || 48;
    const frameRect = frame.getBoundingClientRect();
    const navTop = bottomNav ? bottomNav.getBoundingClientRect().top : window.innerHeight;
    const topbarBottom = topbar ? topbar.getBoundingClientRect().bottom : 0;
    const right = Math.min(Math.max(rightPx, window.innerWidth - frameRect.right + 4), window.innerWidth - frameRect.left - size - 4);
    const bottom = Math.min(Math.max(bottomPx, window.innerHeight - navTop + 4), window.innerHeight - topbarBottom - size - 4);
    return { right: `${Math.round(right)}px`, bottom: `${Math.round(bottom)}px` };
  };
  const saved = getFabPos();
  if (saved) {
    const pos = clampPos(Number.parseFloat(saved.right) || 0, Number.parseFloat(saved.bottom) || 0);
    fab.style.right = pos.right;
    fab.style.bottom = pos.bottom;
  }
  if (!window.PointerEvent) return;
  let startX = 0; let startY = 0; let startRight = 0; let startBottom = 0; let moved = false;
  fab.addEventListener('pointerdown', (event) => {
    startX = event.clientX; startY = event.clientY;
    startRight = Number.parseFloat(fab.style.right || window.getComputedStyle(fab).right) || 0;
    startBottom = Number.parseFloat(fab.style.bottom || window.getComputedStyle(fab).bottom) || 0;
    moved = false;
    fab.setPointerCapture?.(event.pointerId);
  });
  fab.addEventListener('pointermove', (event) => {
    if (!fab.hasPointerCapture?.(event.pointerId)) return;
    const dx = startX - event.clientX; const dy = startY - event.clientY;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    const pos = clampPos(startRight + dx, startBottom + dy);
    fab.style.right = pos.right;
    fab.style.bottom = pos.bottom;
  });
  fab.addEventListener('pointerup', (event) => {
    fab.releasePointerCapture?.(event.pointerId);
    if (!moved) return;
    fab.dataset.dragged = '1';
    saveFabPos({ right: fab.style.right, bottom: fab.style.bottom });
    window.setTimeout(() => { delete fab.dataset.dragged; }, 0);
  });
}

/**
 * 空间助手抽屉：空间详情悬浮图标唤出，与本次变化详情同规格（自底向上约 4/5 屏）。
 * 交互复刻本人助手对话页：条目式对话（时间栏 + 用户批注）、骨架屏、流式答案、依据脚注、
 * 发送/停止切换、长按或右键的消息操作（复制 / 重新生成）；依据只来自当前空间。
 * 冻结空间只读历史、不开放新问答。window.FN_FAST 时跳过动效直接出结果（回归用）。
 */
function openSpaceAssistantSheet(space) {
  const host = frame || sheetLayer;
  host.querySelector('.rec-sheet-mask')?.remove();
  const frozen = (space.lifecycle || space.state) === 'frozen';
  const node = document.createElement('div');
  node.className = 'rec-sheet-mask';
  node.innerHTML = `<section class="rec-sheet" role="dialog" aria-modal="true" aria-label="空间助手">
    <header class="rec-sheet-head">
      <div class="rec-sheet-copy"><h3 class="t-heading t-ellipsis">空间助手</h3><p class="t-meta t-ellipsis">${esc(space.customer)} · 只围绕这个空间作答</p></div>
      <button type="button" class="sheet-close" data-sheet-close aria-label="关闭">${icon('close')}</button>
    </header>
    <div class="rec-sheet-body fn-scroll" data-space-assistant-body>${spaceAssistantBodyHtml(space, F.load())}</div>
    ${frozen ? '' : `<div class="rec-sheet-foot fn-composer">
      <div class="fn-inputrow">
        <textarea class="fn-field" data-qa-field rows="1" placeholder="向空间助手提问" aria-label="向空间助手提问"></textarea>
        <button class="fn-send" type="button" data-qa-send data-state="send" aria-label="发送">${icon('arrow-right')}</button>
      </div>
      <p class="fn-composer-note" data-qa-note>助手只读取当前空间你有权查看的内容作答</p>
    </div>`}
  </section>`;
  host.append(node);
  bindTallSheet(node);

  const body = node.querySelector('[data-space-assistant-body]');
  const field = node.querySelector('[data-qa-field]');
  const sendBtn = node.querySelector('[data-qa-send]');
  const noteEl = node.querySelector('[data-qa-note]');
  const scrollEnd = () => { body.scrollTop = body.scrollHeight; };
  const timeNow = () => F.now().slice(11, 16);
  let streaming = null;

  const setComposer = (state) => {
    if (!sendBtn) return;
    sendBtn.dataset.state = state;
    sendBtn.innerHTML = icon(state === 'stop' ? 'stop' : 'arrow-right');
    sendBtn.setAttribute('aria-label', state === 'stop' ? '停止生成' : '发送');
    if (noteEl) noteEl.textContent = state === 'stop' ? '正在作答… 点击右侧按钮可停止' : '助手只读取当前空间你有权查看的内容作答';
  };

  const citesHtml = (sources) => (sources || []).map((source, i) => {
    const ref = source.type + ':' + source.id;
    return source.available === false
      ? `<button type="button" class="qa-cite" data-qa-cite-broken="${esc(source.label)}" title="来源已失效">〔${i + 1}〕</button>`
      : `<button type="button" class="qa-cite" data-qa-cite="${esc(ref)}" title="${esc(source.label)}">〔${i + 1}〕</button>`;
  }).join('');

  /** 依据脚注点击与预设问题统一走委托；失效来源如实说明。 */
  body.addEventListener('click', (event) => {
    const cite = event.target.closest('[data-qa-cite]');
    if (cite) { openSource(cite.dataset.qaCite); return; }
    const broken = event.target.closest('[data-qa-cite-broken]');
    if (broken) { showToast(`来源已失效：${broken.dataset.qaCiteBroken}`); return; }
    const preset = event.target.closest('[data-ask]');
    if (preset) send(preset.dataset.ask);
  });

  function send(question) {
    const text = String(question || '').trim();
    if (!text || streaming || frozen) return;
    body.querySelector('[data-qa-welcome]')?.remove();
    body.insertAdjacentHTML('beforeend', `<article class="fn-entry fn-user" data-qa-user><span class="fn-time">${esc(timeNow())}</span>
      <div class="fn-main"><div class="fn-bubble">${esc(text)}</div></div></article>
      <article class="fn-entry" data-qa-pending><span class="fn-time">${esc(timeNow())}</span>
      <div class="fn-main"><div class="fn-skel" data-qa-skel><i></i><i></i><i></i></div><div class="fn-answer" data-qa-answer hidden></div></div></article>`);
    scrollEnd();
    setComposer('stop');
    const pending = body.querySelector('[data-qa-pending]');
    const skel = pending.querySelector('[data-qa-skel]');
    const answerEl = pending.querySelector('[data-qa-answer]');

    const run = () => {
      let result;
      try {
        result = ask(space.id, text);
      } catch (error) {
        streaming = null;
        pending.remove();
        setComposer('send');
        showToast(error.message);
        return;
      }
      skel.remove();
      answerEl.hidden = false;
      pending.removeAttribute('data-qa-pending');
      pending.setAttribute('data-qa-item', result.hasEvidence ? 'answered' : 'no-evidence');
      const full = result.answer;
      const finish = () => {
        streaming = null;
        answerEl.innerHTML = esc(full) + citesHtml(result.sources);
        setComposer('send');
        showToast(result.hasEvidence ? '已按当前空间上下文作答' : '当前空间没有可用依据，未生成推测答案');
        scrollEnd();
      };
      if (window.FN_FAST) { finish(); return; }
      let pos = 0;
      const timer = window.setInterval(() => {
        pos = Math.min(pos + 5, full.length);
        answerEl.innerHTML = esc(full.slice(0, pos)) + (pos < full.length ? '<span class="qa-caret"></span>' : '');
        scrollEnd();
        if (pos >= full.length) { window.clearInterval(timer); finish(); }
      }, 30);
      streaming = {
        cancel() {
          window.clearInterval(timer);
          streaming = null;
          answerEl.innerHTML = esc(full.slice(0, pos));
          setComposer('send');
          if (noteEl) noteEl.textContent = '已停止生成';
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
        if (noteEl) noteEl.textContent = '已停止生成';
      }
    };
  }

  /** 消息操作：复制 / 重新生成（仅最后一条助手回答可重新生成）。 */
  const openItemActions = (entry) => {
    if (streaming) { showToast('生成中，可先停止再操作'); return; }
    const items = [...body.querySelectorAll('[data-qa-item]')];
    const isLast = items[items.length - 1] === entry;
    const question = entry.previousElementSibling?.querySelector('.fn-bubble')?.textContent || '';
    const answer = entry.querySelector('[data-qa-answer]')?.textContent || '';
    openSheet('消息操作', `<div class="qa-actions">
      <button type="button" class="qa-action" data-act="copy">复制</button>
      ${isLast && question ? '<button type="button" class="qa-action" data-act="regen">重新生成</button>' : ''}
    </div>`, (sheet, close) => {
      sheet.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
        const textToCopy = `${question}\n${answer}`.trim();
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(textToCopy);
        close();
        showToast('已复制');
      });
      sheet.querySelector('[data-act="regen"]')?.addEventListener('click', () => {
        close();
        entry.previousElementSibling?.remove();
        entry.remove();
        send(question);
      });
    });
  };
  let lpTimer = null;
  body.addEventListener('touchstart', (event) => {
    const entry = event.target.closest('[data-qa-item]');
    if (!entry) return;
    lpTimer = window.setTimeout(() => { openItemActions(entry); lpTimer = null; }, 550);
  }, { passive: true });
  ['touchmove', 'touchend', 'touchcancel'].forEach((type) => body.addEventListener(type, () => { window.clearTimeout(lpTimer); lpTimer = null; }, { passive: true }));
  body.addEventListener('contextmenu', (event) => {
    const entry = event.target.closest('[data-qa-item]');
    if (entry) { event.preventDefault(); openItemActions(entry); }
  });

  sendBtn?.addEventListener('click', () => {
    if (sendBtn.dataset.state === 'stop') { streaming?.cancel(); return; }
    const text = field.value.trim();
    if (!text) return;
    field.value = '';
    field.style.height = 'auto';
    send(text);
  });
  field?.addEventListener('input', () => {
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight, 120) + 'px';
  });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendBtn.click(); }
  });
  scrollEnd();
}

/**
 * 标记入口（M07-1 §4.2）：星标一键开或关，取消立即去掉信号；暂不跟进走表单，
 * 必须填原因、结束日选填，已有标记时可改原因与结束日或取消。标记立刻记下，但不改当天已经出来的今日该跟。
 */
function markSpace(spaceId, action) {
  if (action !== 'star' && action !== 'unstar') { openPauseSheet(spaceId); return; }
  try {
    F.markSpace(spaceId, { starred: action === 'star' });
    showToast(action === 'star' ? '已星标，次日参与判断' : '已取消星标');
    render();
  } catch (error) { showToast(error.message); }
}

/** 暂不跟进表单：原因必填、结束日选填；已有暂不跟进时带出原值，并可直接取消。 */
function openPauseSheet(spaceId) {
  const state = F.load();
  const current = F.activeMarks(state, F.actor.id).find((item) => item.space === spaceId)?.pause || null;
  openSheet('暂不跟进', `<form class="sheet-form" data-pause-form>
    <label class="sheet-field"><span class="t-meta">原因 *</span><textarea name="reason" rows="2">${esc(current?.reason || '')}</textarea></label>
    <label class="sheet-field"><span class="t-meta">结束日（选填）</span><input type="date" name="until" value="${esc(current?.until || '')}" min="${esc(F.today)}"></label>
    <p class="t-warn" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit">保存</button>
    ${current ? '<button class="btn btn-secondary" type="button" data-cancel-pause>取消暂不跟进</button>' : ''}
    <p class="notice t-meta">保存后次日生效，今天的名单不变。</p></form>`, (sheet, close) => {
    sheet.querySelector('[data-pause-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        F.markSpace(spaceId, { pause: { reason: values.reason, until: values.until } });
        close(); showToast('已记录，次日参与判断'); render();
      } catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
    sheet.querySelector('[data-cancel-pause]')?.addEventListener('click', () => {
      try {
        F.markSpace(spaceId, { pause: null });
        close(); showToast('已取消暂不跟进'); render();
      } catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
  });
}

/**
 * 空间侧归位（M05-2 §4.2 归位路径二）：在客户空间的录音区挑一条本人的录音，锚定本空间的一条商机。
 * 只列未处理的录音（与录音管理「未处理」同一口径 = 尚无有效归位），已归位的去录音管理侧再挂；
 * 同步失败的如实标注不可归位。商机规则与录音管理侧一致：多条必须指定、仅一条自动带出；最终由 F.assertPlaceable 兜底。
 */
function openPlaceHereSheet(spaceId) {
  const state = F.load();
  const space = F.space(spaceId, state);
  if (!space) { showToast('该空间不在当前可见范围'); return; }
  const opps = space.opps || [];
  const mine = F.recordings(state).filter((item) => F.recordingState(item, state) !== 'placed');
  const rows = mine.map((recording) => {
    const stateKey = F.recordingState(recording, state);
    const blocked = stateKey === 'blocked';
    return `<article class="list-row record-card" data-place-candidate="${esc(recording.id)}">
      <div class="list-row-head">
        <div class="list-main">
          <div class="list-title-line"><strong class="t-title">${esc(recording.title)}</strong><span class="state-chip is-${blocked ? 'failed' : 'updating'}">${esc(F.recordingStateMeta[stateKey][0])}</span></div>
          <p class="t-meta">${esc(recording.date)} · ${esc(recording.duration)} · 同步 ${esc(F.recordingSyncMeta[recording.syncStatus][0])}</p>
          ${blocked ? `<p class="notice t-warn" data-place-blocked-reason>${esc(recording.syncReason || '该录音同步失败，请先在录音管理里重新同步。')}</p>` : ''}
        </div>
        <div class="rec-row-actions">
          <button class="rec-place" type="button" data-rec-detail="${esc(recording.id)}">查看详情</button>
          ${blocked ? '' : `<button class="rec-place is-strong" type="button" data-place-one="${esc(recording.id)}">归位到本空间</button>`}
        </div>
      </div>
    </article>`;
  }).join('');
  openSheet('归位录音', mine.length ? `<div class="list">${rows}</div>`
    : '<div class="empty-state"><strong class="t-title">本人暂无未归位录音</strong><p class="t-meta">录音同步进来后可在此关联。</p></div>', (sheet, close) => {
    // 查看详情：同一套 4/5 抽屉展示智能总结 / 原文转录，左上角返回回到本层
    sheet.querySelectorAll('[data-rec-detail]').forEach((button) => button.addEventListener('click', () => openSpaceRecordingSheet(button.dataset.recDetail, { back: true })));
    // 归位：仅一条商机自动带出直接归位；多条先选商机，系统不代选（M05-2 §4.2-6）
    sheet.querySelectorAll('[data-place-one]').forEach((button) => button.addEventListener('click', () => {
      const recordingId = button.dataset.placeOne;
      if (opps.length > 1) { openOpportunitySheet(space, recordingId); return; }
      placeRecordingInto(space, recordingId, opps[0]?.id, close);
    }));
  }, `${space.customer} · ${mine.length} 条未处理`);
}

/** 空间侧归位提交：成功后关闭当前抽屉并重画列表；失败按模型给的不可归位原因提示。 */
function placeRecordingInto(space, recordingId, opportunityId, close) {
  try {
    F.placeRecording(recordingId, { space: space.id, opportunityId });
    close(); showToast('已归位；智能总结可用后会更新客户信息'); render();
  } catch (error) { showToast(error.message); }
}

/** 多商机空间：先选一条商机再归位（系统不代选），选完即归位。 */
function openOpportunitySheet(space, recordingId) {
  const item = F.recording(recordingId);
  openSheet('选择商机', `<div class="list">${(space.opps || []).map((opp) => `<article class="list-row">
      <div class="list-row-head is-tappable" role="button" tabindex="0" data-pick-opp="${esc(opp.id)}">
        <div class="list-main">
          <div class="list-title-line"><strong class="t-title">${esc(opp.name)}</strong></div>
          <p class="t-meta">${esc(opp.stage || '阶段待补')}${opp.amount ? ` · ${esc(String(opp.amount))} 万` : ''}</p>
        </div>
        ${rowChevron(false)}
      </div>
    </article>`).join('')}</div>`, (sheet, close) => {
    sheet.querySelectorAll('[data-pick-opp]').forEach((head) => {
      const pick = () => placeRecordingInto(space, recordingId, head.dataset.pickOpp, close);
      head.addEventListener('click', pick);
      head.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } });
    });
  }, `${item ? item.title : recordingId} · ${space.customer}`);
}

function openReplySheet(solutionId) {
  openSheet('回复方案', `<form class="sheet-form" data-reply-form>
    <label class="sheet-field"><span class="t-meta">回复内容 *</span><textarea name="text" rows="4"></textarea></label>
    <p class="t-warn" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit">提交回复</button>
    <p class="notice t-meta">只能回复一次。</p></form>`, (sheet, close) => {
    sheet.querySelector('[data-reply-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = new FormData(event.currentTarget).get('text');
      try { F.solutionAction(solutionId, 'reply', text); close(); showToast('已回复，方案人员会收到提醒'); render(); }
      catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
  });
}

/**
 * 本次变化：与空间录音同一套自底向上约 4/5 屏弹层，挂在手机框内。
 * 从空间更新点进来时叠在上面，关闭只收起本层、回到空间更新，不整栈关掉。
 * 写入表单仍走通用 sheet，避免把短表单拉成阅读高度。
 */
function openChangeSheet(change) {
  const host = frame || sheetLayer;
  const title = '本次变化 · ' + change.sourceLabel;
  const node = document.createElement('div');
  node.className = 'rec-sheet-mask';
  node.innerHTML = `<section class="rec-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="rec-sheet-head">
      <div class="rec-sheet-copy"><h3 class="t-heading t-ellipsis">本次变化</h3><p class="t-meta t-ellipsis">${esc(change.sourceLabel)} · ${esc(change.at)}</p></div>
      <button type="button" class="sheet-close" data-sheet-close aria-label="关闭">${icon('close')}</button>
    </header>
    <div class="rec-sheet-body" data-change-detail>${changeBlock(change)}</div>
  </section>`;
  host.append(node);
  bindTallSheet(node);
  node.querySelectorAll('[data-source]').forEach((chip) => chip.addEventListener('click', () => openSource(chip.dataset.source)));
}

/**
 * 更新面板：顶栏右上角更新入口唤出，与本次变化详情同规格（4/5 屏）。
 * 顶部最近一次变化状态，下方全量更新历史时间线；打开即视为已读，顶栏红点消除。
 */
function openUpdatesSheet(space) {
  const host = frame || sheetLayer;
  host.querySelector('.rec-sheet-mask')?.remove();
  const history = F.updateHistory(space.id);
  const node = document.createElement('div');
  node.className = 'rec-sheet-mask';
  node.innerHTML = `<section class="rec-sheet" role="dialog" aria-modal="true" aria-label="空间更新">
    <header class="rec-sheet-head">
      <div class="rec-sheet-copy"><h3 class="t-heading t-ellipsis">空间更新</h3><p class="t-meta t-ellipsis">${esc(space.customer)} · 共 ${history.length} 次更新</p></div>
      <button type="button" class="sheet-close" data-sheet-close aria-label="关闭">${icon('close')}</button>
    </header>
    <div class="rec-sheet-body" data-updates-panel>${updatesPanelHtml(space, F.load())}</div>
  </section>`;
  host.append(node);
  bindTallSheet(node);
  node.querySelectorAll('[data-open-change]').forEach((button) => button.addEventListener('click', () => {
    const change = F.changesOf(space.id).find((item) => item.id === button.dataset.openChange);
    if (change) openChangeSheet(change);
    else showToast('该次变化不在当前可见范围');
  }));
  node.querySelectorAll('[data-source]').forEach((chip) => chip.addEventListener('click', () => openSource(chip.dataset.source)));
  markChangesRead(history.map((item) => item.id));
  viewRoot.querySelector('[data-open-updates]')?.classList.remove('has-unread');
}

/** 4/5 屏弹层共用关闭与遮罩点击。 */
function bindTallSheet(node) {
  const panel = node.querySelector('.rec-sheet');
  const close = () => {
    if (node.classList.contains('is-closing')) return;
    node.classList.add('is-closing');
    const settle = () => node.remove();
    panel.addEventListener('animationend', settle, { once: true });
    window.setTimeout(settle, 360);
  };
  node.querySelector('[data-sheet-close]').addEventListener('click', close);
  node.addEventListener('click', (event) => { if (event.target === node) close(); });
  return close;
}

/**
 * 空间跟进 → 录音：自底向上约 4/5 屏的内容弹层，默认可切智能总结 / 原文转录。
 * 与录音管理的右侧抽屉分开，不复用那套全屏滑入。
 */
function openSpaceRecordingSheet(recordingId, { back = false } = {}) {
  const item = F.recording(recordingId);
  if (!item) { showToast('该录音不在当前可见范围'); return; }
  const host = frame || sheetLayer;
  // 从挑录音抽屉里进来时（back）保留下面那层，详情叠在上面，左上角返回回到它
  if (!back) host.querySelector('.rec-sheet-mask')?.remove();
  const summary = String(item.summary || '').trim();
  const transcript = String(item.transcript || '').trim();
  const heading = back
    ? `<button type="button" class="back-button" data-sheet-close aria-label="返回归位录音">${icon('chevron-left')}</button>`
    : '';
  const node = document.createElement('div');
  node.className = 'rec-sheet-mask';
  node.innerHTML = `<section class="rec-sheet" role="dialog" aria-modal="true" aria-label="${esc(item.title)}">
    <header class="rec-sheet-head${back ? ' has-back' : ''}">
      ${heading}
      <div class="rec-sheet-copy"><h3 class="t-heading t-ellipsis">${esc(item.title)}</h3><p class="t-meta t-ellipsis">${esc(item.date)} · ${esc(item.duration)}</p></div>
      ${back ? '' : `<button type="button" class="sheet-close" data-sheet-close aria-label="关闭">${icon('close')}</button>`}
    </header>
    ${segTabs([['summary', '智能总结'], ['transcript', '原文转录']], 'summary', 'data-rec-sheet-tab', '录音内容')}
    <div class="rec-sheet-body">
      <div data-rec-sheet-pane="summary">${summary ? `<p class="t-body">${esc(summary)}</p>` : '<div class="empty-state"><strong class="t-title">暂无智能总结</strong><p class="t-meta">远端同步完成后会出现在这里。</p></div>'}</div>
      <div data-rec-sheet-pane="transcript" hidden>${transcript ? `<pre class="sheet-pre" data-transcript-body>${esc(transcript)}</pre>` : '<div class="empty-state"><strong class="t-title">暂无原文转录</strong><p class="t-meta">远端同步完成后会出现在这里。</p></div>'}</div>
    </div>
  </section>`;
  host.append(node);
  bindTallSheet(node);
  node.querySelectorAll('[data-rec-sheet-tab]').forEach((button) => button.addEventListener('click', () => {
    node.querySelectorAll('[data-rec-sheet-tab]').forEach((one) => {
      one.classList.toggle('is-active', one === button);
      one.setAttribute('aria-selected', one === button);
    });
    node.querySelectorAll('[data-rec-sheet-pane]').forEach((pane) => { pane.hidden = pane.dataset.recSheetPane !== button.dataset.recSheetTab; });
  }));
}

/**
 * 录音内容抽屉：挂在手机框内、从右滑入，铺满底栏之上的内容区。
 * 盖住列表顶栏，只保留抽屉自己的返回；点返回滑出关闭。
 */
function openRecordingDrawer(recordingId) {
  const item = F.recording(recordingId);
  if (!item) { showToast('该录音不在当前可见范围'); return; }
  const host = frame || sheetLayer;
  host.querySelector('.rec-drawer-mask')?.remove();
  const summary = String(item.summary || '').trim();
  const transcript = String(item.transcript || '').trim();
  const node = document.createElement('div');
  node.className = 'rec-drawer-mask';
  node.innerHTML = `<section class="rec-drawer" role="dialog" aria-modal="true" aria-label="${esc(item.title)}">
    <header class="rec-drawer-head">
      <button type="button" class="back-button" data-sheet-close aria-label="返回">${icon('chevron-left')}</button>
      <div class="space-topbar-main"><h3 class="t-heading t-ellipsis">${esc(item.title)}</h3><p class="t-meta t-ellipsis">${esc(item.date)} · ${esc(item.duration)}</p></div>
    </header>
    ${segTabs([['summary', '智能总结'], ['transcript', '原文转录']], 'summary', 'data-rec-pane-tab', '录音内容')}
    <div class="rec-drawer-body">
      <div data-rec-pane="summary">${summary ? `<p class="t-body">${esc(summary)}</p>` : '<div class="empty-state"><strong class="t-title">暂无智能总结</strong><p class="t-meta">远端同步完成后会出现在这里。</p></div>'}</div>
      <div data-rec-pane="transcript" hidden>${transcript ? `<pre class="sheet-pre" data-transcript-body>${esc(transcript)}</pre>` : '<div class="empty-state"><strong class="t-title">暂无原文转录</strong><p class="t-meta">远端同步完成后会出现在这里。</p></div>'}</div>
    </div>
  </section>`;
  host.append(node);
  const panel = node.querySelector('.rec-drawer');
  const close = () => {
    if (node.classList.contains('is-closing')) return;
    node.classList.add('is-closing');
    const settle = () => node.remove();
    panel.addEventListener('animationend', settle, { once: true });
    window.setTimeout(settle, 360);
  };
  node.querySelector('[data-sheet-close]').addEventListener('click', close);
  node.querySelectorAll('[data-rec-pane-tab]').forEach((button) => button.addEventListener('click', () => {
    node.querySelectorAll('[data-rec-pane-tab]').forEach((one) => {
      one.classList.toggle('is-active', one === button);
      one.setAttribute('aria-selected', one === button);
    });
    node.querySelectorAll('[data-rec-pane]').forEach((pane) => { pane.hidden = pane.dataset.recPane !== button.dataset.recPaneTab; });
  }));
}

function openPlaceSheet(recordingId) {
  const state = F.load();
  const placed = F.recordingPlacements(recordingId, state).map((item) => item.space);
  const targets = F.visible(state).filter((space) => F.canWrite(space) && (space.opps || []).length && !placed.includes(space.id));
  if (!targets.length) {
    openSheet('归位录音', '<p class="notice t-warn">当前没有可归位的客户空间：需要一个可写且有商机的空间。</p>');
    return;
  }
  const oppOptions = (space) => space.opps.map((opp) => `<option value="${esc(opp.id)}">${esc(opp.name)}</option>`).join('');
  const oppHint = (space) => (space.opps.length > 1 ? '该空间有多条商机，请指定一条。' : '已带出该空间唯一的商机。');
  openSheet('归位录音', `<form class="sheet-form" data-place-form>
    <label class="sheet-field"><span class="t-meta">客户空间 *</span><select name="space">${targets.map((space) => `<option value="${esc(space.id)}">${esc(space.customer)}</option>`).join('')}</select></label>
    <label class="sheet-field"><span class="t-meta">关联商机 *</span><select name="opportunityId">${targets[0].opps.length > 1 ? '<option value="">请指定一条商机</option>' : ''}${oppOptions(targets[0])}</select></label>
    <p class="t-meta" data-opp-hint>${oppHint(targets[0])}</p>
    <p class="t-warn" role="alert" data-write-error></p>
    <button class="btn btn-primary" type="submit">确认归位</button></form>`, (sheet, close) => {
    const form = sheet.querySelector('[data-place-form]');
    form.elements.space.addEventListener('change', () => {
      const target = targets.find((space) => space.id === form.elements.space.value);
      const multi = target.opps.length > 1;
      form.elements.opportunityId.innerHTML = (multi ? '<option value="">请指定一条商机</option>' : '') + oppOptions(target);
      sheet.querySelector('[data-opp-hint]').textContent = oppHint(target);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      try { F.placeRecording(recordingId, values); close(); showToast('已归位；智能总结可用后会更新客户信息'); render(); }
      catch (error) { sheet.querySelector('[data-write-error]').textContent = error.message; }
    });
  });
}

/* ---------------- 底栏与助手入口 ---------------- */

bottomNav.querySelectorAll('[data-nav-item]').forEach((item) => item.addEventListener('click', () => go('/' + item.dataset.navItem)));
// 浏览器前进 / 后退同样按方向转场：回到入口是弹出，再进入空间是推入
window.addEventListener('hashchange', () => { if (window.location.hash !== lastHash) render(routeDirection(lastRoute, parseRoute())); });
render();
