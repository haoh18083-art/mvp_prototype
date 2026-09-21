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
