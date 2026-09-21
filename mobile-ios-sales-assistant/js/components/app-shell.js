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
