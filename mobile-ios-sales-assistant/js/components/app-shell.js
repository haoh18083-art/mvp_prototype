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
