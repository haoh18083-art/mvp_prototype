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
