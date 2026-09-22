/**
 * V0.2 功能页的本地演示模型。
 * 从现有前端提炼客户、录音、跟进、方案与配置状态，并使用独立存储键保存跨页演示数据。
 * 所有写入只发生在浏览器，权限和空间冻结约束在模型层统一检查。
 */
(function (SC) {
  'use strict';
  const F = SC.FEATURES = { views: {} };
  F.key = SC.DATA.PEOPLE_STATE_KEY || 'sc-v02-feature-pages-v1';
  F.today = '2026-09-15';
  F.defaults = { ADM: 'U-1001', MGR: 'U-1002', SLS: 'U-1004', SOL: 'U-1010' };
  F.roles = { ADM: '超级管理员', MGR: '销售运营', SLS: '销售', SOL: '解决方案人员' };
  F.uid = prefix => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  F.now = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const copy = value => JSON.parse(JSON.stringify(value));
  let memory;

  /** 构造 R01 的 CRM 同步演示快照；真实原型不调用外部 CRM，只演示完整处理闭环。 */
  function demoCrm() {
    return {
      lastSyncAt: '2026-09-15 10:25', trigger: '定时', status: 'completed', factsVersion: 'CRM-20260915-1025',
      currentBatchId: 'B-0915', nextRetryAt: '2026-09-15 10:30', manualRunAt: '',
      processed: 36, added: 2, removed: 1, restored: 1, unchanged: 32, pending: 1, unassigned: 1, failed: 1,
      lastResult: '本轮对齐完成，1 条异常将在下一轮重试。',
      batches: [{ id: 'B-0915', at: '2026-09-15 10:25', trigger: '定时', factsVersion: 'CRM-20260915-1025', processed: 36, added: 2, removed: 1, restored: 1, unchanged: 32, pending: 1, unassigned: 1, failed: 1, status: 'completed' }],
      pendingMappings: [{ id: 'MAP-203', crmId: 'CRM-U-203', crmName: '赵伟航', customerId: 'C-1004', customer: '云桥数字科技有限公司', opportunityId: 'OP-304', opportunity: '一键登录认证', discoveredAt: '2026-09-15 10:25', status: 'pending', reason: 'CRM 人员尚未与系统账号对应' }],
      // R01 人员与系统账号对应关系：一行一位 CRM 人员，未对应行带自动匹配失败原因与推荐账号。
      mappings: [
        { crmId: 'CRM-U-201', crmName: '付赞', crmDept: '华东大区 · 号码认证', crmEmail: 'fuzan@xbongbong.com', ownerId: 'U-1004', mode: 'auto', matchedAt: '2026-09-01 09:12', customerCount: 4, opportunityCount: 6, pendingId: '', failReason: '', suggestOwnerId: '', suggestBasis: '' },
        { crmId: 'CRM-U-202', crmName: '张云飞', crmDept: '华东大区 · 智能短信', crmEmail: 'zhangyunfei@xbongbong.com', ownerId: 'U-1005', mode: 'auto', matchedAt: '2026-09-01 09:12', customerCount: 3, opportunityCount: 5, pendingId: '', failReason: '', suggestOwnerId: '', suggestBasis: '' },
        { crmId: 'CRM-U-203', crmName: '赵伟航', crmDept: '客户成功部 · 云桥数字', crmEmail: 'zhaoweihang@xbongbong.com', ownerId: '', mode: 'none', matchedAt: '', customerCount: 1, opportunityCount: 1, pendingId: 'MAP-203', failReason: 'CRM 邮箱与本地账号邮箱不一致，未自动匹配', suggestOwnerId: 'U-1009', suggestBasis: '姓名一致、邮箱不同，需人工确认' }
      ],
      unassignedOpportunities: [{ id: 'UNASSIGNED-1', opportunityId: 'OP-399', customerId: 'C-1004', customer: '云桥数字科技有限公司', opportunity: '企业号码认证升级', discoveredAt: '2026-09-15 10:25', status: 'pending_crm_assignment', reason: 'CRM 未返回任何销售人员' }],
      alignmentErrors: [{ id: 'ERR-305', customerId: 'C-1005', customer: '海川保险服务有限公司', opportunityId: 'OP-305', opportunity: '保险通知通道升级', crmName: '赵伟航', stage: '人员映射', reason: '系统账号不存在或已停用', occurredAt: '2026-09-15 10:24', retryCount: 1, status: 'failed' }],
      changes: [
        { id: 'CHG-301', customerId: 'C-1001', customer: '星辰科技有限公司', opportunityId: 'OP-301', opportunity: '通信线路接入', sales: 'U-1004', entitlementType: 'opportunity', change: 'added', occurredAt: '2026-09-15 10:25', batchId: 'B-0915', status: 'applied' },
        { id: 'CHG-302', customerId: 'C-1002', customer: '远山物流有限公司', opportunityId: 'OP-302', opportunity: '通知短信升级', sales: 'U-1004', entitlementType: 'opportunity', change: 'removed', occurredAt: '2026-09-15 10:25', batchId: 'B-0915', status: 'applied' },
        { id: 'CHG-303', customerId: 'C-1003', customer: '启明教育科技有限公司', opportunityId: 'OP-303', opportunity: '一键登录认证', sales: 'U-1004', entitlementType: 'opportunity', change: 'restored', occurredAt: '2026-09-15 10:25', batchId: 'B-0915', status: 'applied' },
        { id: 'CHG-304', customerId: 'C-1004', customer: '云桥数字科技有限公司', opportunityId: 'OP-304', opportunity: '一键登录认证', sales: '', entitlementType: 'opportunity', change: 'pending', occurredAt: '2026-09-15 10:25', batchId: 'B-0915', status: 'waiting_mapping' }
      ]
    };
  }

  /**
   * 构造销帮帮（XBB）连接配置演示快照。
   * 字段与生产 xbb-config 契约对齐；sources 记录每一项当前取值来自数据库配置、环境变量还是默认值，
   * 供运营在同步异常时先判断"配置有没有生效"，再去看同步结果。
   */
  function demoXbb() {
    return {
      baseUrl: 'https://proapi.xbongbong.com',
      corpId: 'ww9f2c7a1e5b3d6a',
      userId: 'U-1001',
      tokenMasked: '••••••••••••3f9a',
      saasMark: 1,
      timeoutSeconds: 20,
      listPageSize: 100,
      retryCount: 3,
      retryBackoffSeconds: 2,
      intervalMinutes: 5,
      sources: {
        baseUrl: 'database', corpId: 'database', userId: 'database', token: 'database',
        saasMark: 'default', timeoutSeconds: 'env', listPageSize: 'default',
        retryCount: 'default', retryBackoffSeconds: 'default', intervalMinutes: 'fixed'
      },
      updatedAt: '2026-09-10 14:20',
      updatedBy: 'U-1001',
      lastCheck: { at: '2026-09-15 10:25', status: 'ok', latencyMs: 268, detail: '客户、商机、人员关系与客户池四类读取接口均返回正常。' }
    };
  }

  /** 外部资料按正文计算内容指纹，用于识别重复文件；不把整份大文件写入本地演示存储。 */
  function documentHash(text) {
    const value = String(text || '');
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return 'md-' + hash.toString(36);
  }
  function documentUtf8Length(text) {
    const value = String(text || '');
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(value).length : unescape(encodeURIComponent(value)).length;
  }

  /**
   * R03 外部资料样例：覆盖成功挂载、概览更新中、挂载失败和重复文件四种可复核状态。
   * 原文只属于当前空间，不跨同客户的其他销售空间共享。
   */
  function demoDocuments() {
    const docs = [
      { id: 'DOC-401', space: 'WS-201', name: '星辰科技-试点方案v2.md', uploader: 'U-1010', uploadedAt: '2026-09-14 15:20', size: '48 KB', order: 1, status: 'success', stage: 'overview_done', reason: '', overviewStatus: 'applied', retryCount: 0, excerpt: '试点范围建议限定在华东三个业务场景，先验证线路稳定性与并发容量，再评估全量接入。验收指标建议采用可用率与平均接通时长两项。' },
      { id: 'DOC-402', space: 'WS-201', name: '并发容量测算.md', uploader: 'U-1010', uploadedAt: '2026-09-15 09:40', size: '32 KB', order: 2, status: 'overview_updating', stage: 'mounted', reason: '', overviewStatus: 'updating', retryCount: 0, excerpt: '按客户提供的日峰值 12 万条测算，建议预留 1.8 倍冗余；当前测算未包含节假日营销场景。' },
      { id: 'DOC-403', space: 'WS-202', name: '验收标准草案.md', uploader: 'U-1010', uploadedAt: '2026-09-15 10:05', size: '28 KB', order: 1, status: 'failed', stage: 'mount', reason: '资料解析服务超时，原文已保留，可单份重试。', overviewStatus: 'skipped', retryCount: 1, excerpt: '验收标准草案（原文已保留，尚未挂载到客户空间）。' }
    ];
    return docs.map(doc => ({ ...doc, hash: documentHash(doc.excerpt) }));
  }

  /**
   * R04 本次变化样例：一条已完成、一条处理中、一条无变化，便于核验四种反馈口径。
   * status 取 done / processing / failed / nochange；processing 时页面仍返回上一版内容。
   * CHGX-505/506/507 落在 R14 日报窗口（2026-09-14 18:30 → 2026-09-15 18:30）内，是 DR-0915 的真实输入素材。
   */
  function demoSpaceChanges() {
    return [
      {
        id: 'CHGX-505', space: 'WS-201', at: '2026-09-15 11:20', source: 'followup', sourceRef: 'FU-D201', sourceLabel: '跟进记录（电话沟通）', status: 'done', baseVersion: 'content-WS-201-v3', resultVersion: 'content-WS-201-v4', notified: true,
        added: ['客户确认试点启动时间：下周三', '验收指标口径：可用率 ≥ 99.9%'],
        updated: [{ field: '当前卡点', before: '试点范围已明确，待确认验收指标口径', after: '验收指标口径已对齐，待客户确认验收负责人' }],
        pendingConfirm: ['客户侧验收负责人尚未明确'], conflicts: []
      },
      {
        id: 'CHGX-506', space: 'WS-202', at: '2026-09-15 09:20', source: 'meeting', sourceRef: 'MT-102', sourceLabel: '会议录音 · 配送通知需求沟通', status: 'done', baseVersion: 'content-WS-202-v3', resultVersion: 'content-WS-202-v4', notified: true,
        added: ['客户确认日均通知量约 5 万条'],
        updated: [], pendingConfirm: ['节假日营销场景是否纳入本期'],
        conflicts: [{ field: '短信日峰值发送量', values: ['日峰值 8 万条（客户口述）', '日峰值 12 万条（方案侧预估）'], reason: '未解决冲突，计入待确认与待补信息。' }]
      },
      {
        id: 'CHGX-507', space: 'WS-203', at: '2026-09-15 14:10', source: 'followup', sourceRef: '', sourceLabel: '跟进记录（客户拜访）', status: 'failed', baseVersion: 'content-WS-203-v3', resultVersion: '', notified: false,
        added: [], updated: [], pendingConfirm: [], conflicts: [], reason: '内容索引服务超时，概览未更新，原文仍保留。'
      },
      // R10 录音归位后的三类结果：更新失败（只提醒运营）、无变化（不提醒）、有变化（提醒并直达本次变化）。
      {
        id: 'CHGX-508', space: 'WS-204', at: '2026-09-14 10:26', source: 'meeting', sourceRef: 'MT-104', sourceLabel: '客户录音 · 首次产品介绍', status: 'failed', baseVersion: 'content-WS-204-v3', resultVersion: '', notified: false,
        added: [], updated: [], pendingConfirm: [], conflicts: [], reason: '录音内容更新服务超时，本次更新未完成，原内容保留。'
      },
      {
        id: 'CHGX-509', space: 'WS-201', at: '2026-09-15 15:34', source: 'meeting', sourceRef: 'MT-105', sourceLabel: '客户录音 · 跨客户联合沟通', status: 'nochange', baseVersion: 'content-WS-201-v4', resultVersion: 'content-WS-201-v4', notified: false,
        added: [], updated: [], pendingConfirm: [], conflicts: []
      },
      {
        id: 'CHGX-510', space: 'WS-202', at: '2026-09-15 15:36', source: 'meeting', sourceRef: 'MT-105', sourceLabel: '客户录音 · 跨客户联合沟通', status: 'done', baseVersion: 'content-WS-202-v4', resultVersion: 'content-WS-202-v5', notified: true,
        added: ['客户确认节假日营销场景单独评估'],
        updated: [{ field: '上次聊到哪', before: '客户确认日均通知量约 5 万条', after: '客户确认日均通知量约 5 万条，节假日场景单独评估' }],
        pendingConfirm: [], conflicts: []
      },
      {
        id: 'CHGX-501', space: 'WS-201', at: '2026-09-14 15:22', source: 'document', sourceRef: 'DOC-401', sourceLabel: '外部资料《星辰科技-试点方案v2.md》', status: 'done', baseVersion: 'content-WS-201-v2', resultVersion: 'content-WS-201-v3', notified: true,
        added: ['试点范围：华东三个业务场景', '建议验收指标：可用率、平均接通时长'],
        updated: [{ field: '当前卡点', before: '等待客户确认试点范围', after: '试点范围已明确，待确认验收指标口径' }],
        pendingConfirm: ['客户侧验收负责人尚未明确'], conflicts: []
      },
      {
        id: 'CHGX-502', space: 'WS-201', at: '2026-09-15 09:41', source: 'document', sourceRef: 'DOC-402', sourceLabel: '外部资料《并发容量测算.md》', status: 'processing', baseVersion: 'content-WS-201-v3', resultVersion: '', notified: false,
        added: [], updated: [], pendingConfirm: [], conflicts: []
      },
      {
        id: 'CHGX-503', space: 'WS-203', at: '2026-09-14 16:32', source: 'followup', sourceRef: 'FU-2', sourceLabel: '跟进记录（电话沟通）', status: 'nochange', baseVersion: 'content-WS-203-v3', resultVersion: 'content-WS-203-v3', notified: false,
        added: [], updated: [], pendingConfirm: [], conflicts: []
      },
      {
        id: 'CHGX-504', space: 'WS-202', at: '2026-09-15 10:06', source: 'document', sourceRef: 'DOC-403', sourceLabel: '外部资料《验收标准草案.md》', status: 'failed', baseVersion: 'content-WS-202-v3', resultVersion: '', notified: false,
        added: [], updated: [], pendingConfirm: [], conflicts: [], reason: '资料解析服务超时，概览未更新，原文仍在资料 Tab。'
      }
    ];
  }

  /**
   * R10 录音样例：得到笔记（三方录音服务）是唯一来源，本版不提供手动上传与应用内录制。
   * 三方已完成转写，同步成功即带智能总结与原文；本系统不设转写阶段，
   * 只区分同步成功 / 同步失败 / 归属待处理三类同步结果。
   */
  function demoRecordings() {
    const transcript = '00:12  客户：我们希望先用一个业务场景验证效果。\n02:36  销售：可以，建议先确认数据范围和验收指标。\n06:48  客户：请补充峰值容量、接入步骤和交付周期。\n12:20  销售：我会联系方案同事，下次一起确认试点计划。';
    const base = { source: '三方录音服务', syncStatus: 'synced', syncReason: '', ownerResolved: true, transcript };
    return [
      { ...base, id: 'MT-101', title: '线路试点技术交流', owner: 'U-1004', date: '2026-09-15 09:12', duration: '32:18', syncedAt: '2026-09-15 09:20', summary: '客户技术团队完成初步验证，关注并发指标与试点计划。' },
      { ...base, id: 'MT-102', title: '配送通知需求沟通', owner: 'U-1004', date: '2026-09-14 11:02', duration: '18:42', syncedAt: '2026-09-14 11:10', summary: '客户明确华东配送通知场景，关注高峰发送量。' },
      // 常规录音：同步即带三方已完成的总结与原文，归位后立即进入客户信息更新。
      { ...base, id: 'MT-103', title: '采购预算及交付确认', owner: 'U-1004', date: '2026-09-15 13:40', duration: '45:06', syncedAt: '2026-09-15 13:52', transcript: '00:08  客户：先按一个场景做验证，看效果再谈范围。\n03:41  销售：好的，我把验收口径和时间安排整理出来。\n09:12  客户：预算走年度框架，交付周期需要写进合同。\n16:30  销售：我下周把试点计划与合同条款一起发您确认。', summary: '客户确认先做单场景验证，预算走年度框架，交付周期需写进合同。' },
      { ...base, id: 'MT-104', title: '首次产品介绍', owner: 'U-1004', date: '2026-09-14 10:05', duration: '22:37', syncedAt: '2026-09-14 10:12', summary: '向客户介绍产品能力与接入方式。' },
      // 一次跨客户沟通：同一份文件分别归位到两个空间，不切分、不复制。
      { ...base, id: 'MT-105', title: '跨客户联合沟通', owner: 'U-1004', date: '2026-09-15 15:10', duration: '51:24', syncedAt: '2026-09-15 15:22', summary: '一次沟通同时覆盖两个客户的通道与通知场景。' },
      // 同步失败：可见、可重试，不静默丢失；未取得内容期间不可归位。
      { ...base, id: 'MT-106', title: '需求访谈录音', owner: 'U-1004', date: '2026-09-15 08:30', duration: '—', syncStatus: 'failed', syncReason: '三方录音服务返回文件读取超时，本条未同步完成。', syncedAt: '', transcript: '', summary: '' },
      { ...base, id: 'MT-107', title: '客户技术评审', owner: 'U-1005', date: '2026-09-14 14:20', duration: '32:18', syncedAt: '2026-09-14 14:31', summary: '客户技术团队评审接入方案。' },
      // 归属销售标识缺失：不进入任何人的录音管理，进运营待处理清单。
      { ...base, id: 'MT-108', title: '未识别归属的客户通话', owner: '', ownerResolved: false, date: '2026-09-15 11:48', duration: '12:05', syncedAt: '2026-09-15 11:55', summary: '通话内容已同步，归属销售标识缺失。', syncReason: '三方服务未返回可识别的归属销售标识。' }
    ];
  }

  /**
   * R10 归位样例：一条归位锚定一个空间与一条商机；同一录音的多条归位互不影响。
   * 客户信息更新与行为记录分别记录状态，部分成功不互相覆盖。
   */
  function demoPlacements() {
    return [
      { id: 'PL-101', recording: 'MT-102', space: 'WS-202', opportunityId: 'OP-302', by: 'U-1004', at: '2026-09-14 11:20', status: 'done', changeId: 'CHGX-506', behaviorId: 'BR-502', failReason: '', startedAt: '2026-09-14 11:20', completedAt: '2026-09-14 11:26', canceledAt: '' },
      // 归位后客户信息更新尚未落地：只显示「客户信息更新中」，不宣告完成、不承诺时长。
      { id: 'PL-102', recording: 'MT-103', space: 'WS-203', opportunityId: 'OP-303', by: 'U-1004', at: '2026-09-15 13:58', status: 'updating', changeId: '', behaviorId: '', failReason: '', startedAt: '2026-09-15 13:58', completedAt: '', canceledAt: '' },
      { id: 'PL-103', recording: 'MT-104', space: 'WS-204', opportunityId: 'OP-304', by: 'U-1004', at: '2026-09-14 10:20', status: 'failed', changeId: 'CHGX-508', behaviorId: '', failReason: '录音内容更新服务超时，本次更新未完成，原内容保留。', startedAt: '2026-09-14 10:20', completedAt: '', canceledAt: '' },
      { id: 'PL-104', recording: 'MT-105', space: 'WS-201', opportunityId: 'OP-301', by: 'U-1004', at: '2026-09-15 15:30', status: 'nochange', changeId: 'CHGX-509', behaviorId: 'BR-511', failReason: '', startedAt: '2026-09-15 15:30', completedAt: '2026-09-15 15:34', canceledAt: '' },
      // 客户信息写成、行为记录未写成：两条结果分开展示，成功的一条不被失败的一条覆盖。
      { id: 'PL-105', recording: 'MT-105', space: 'WS-202', opportunityId: 'OP-302', by: 'U-1004', at: '2026-09-15 15:31', status: 'done', changeId: 'CHGX-510', behaviorId: 'BR-510', failReason: '', startedAt: '2026-09-15 15:31', completedAt: '2026-09-15 15:36', canceledAt: '' },
      { id: 'PL-106', recording: 'MT-107', space: 'WS-207', opportunityId: 'OP-307', by: 'U-1005', at: '2026-09-14 14:45', status: 'done', changeId: '', behaviorId: '', failReason: '', startedAt: '2026-09-14 14:45', completedAt: '2026-09-14 14:52', canceledAt: '' },
      // 取消归位只影响这一条：录音回到未归位，仍可重新归位；取消留痕供排查（M05-2 §7.5 待确认是否长期保留）。
      { id: 'PL-107', recording: 'MT-101', space: 'WS-203', opportunityId: 'OP-303', by: 'U-1004', at: '2026-09-14 17:40', status: 'canceled', changeId: '', behaviorId: '', failReason: '', startedAt: '', completedAt: '', canceledAt: '2026-09-14 18:02', canceledBy: 'U-1004' }
    ];
  }

  /** 统一补齐录音字段，兼容 R10 上线前按「上传 → 解析 → 挂载」保存的旧演示快照。 */
  function normalizeRecording(item, index) {
    const record = item || {};
    return {
      id: record.id || `MT-${101 + index}`,
      title: String(record.title || '未命名录音'),
      owner: record.owner || '',
      ownerResolved: record.ownerResolved !== false && !!record.owner,
      date: record.date || '2026-09-15 09:00',
      duration: String(record.duration || '—'),
      source: record.source || '三方录音服务',
      syncStatus: ['synced', 'failed'].includes(record.syncStatus) ? record.syncStatus : 'synced',
      syncReason: String(record.syncReason || ''),
      syncedAt: record.syncedAt || record.date || '',
      // 转写与智能总结随同步一并取得；旧快照里多余的转写状态字段直接丢弃。
      transcript: String(record.transcript || ''),
      summary: String(record.summary || ''),
      retryCount: Number(record.retryCount || 0)
    };
  }

  /** 统一补齐归位字段；旧快照里录音的单值 space 字段会被折算成一条归位记录。 */
  function normalizePlacement(item, index) {
    const record = item || {};
    // 旧快照的 waiting_transcript 迁移为 updating：本系统不设等待转写的正常路径。
    const status = record.status === 'waiting_transcript' ? 'updating'
      : ['updating', 'done', 'nochange', 'failed', 'canceled'].includes(record.status) ? record.status : 'updating';
    return {
      id: record.id || `PL-${101 + index}`,
      recording: record.recording || '',
      space: record.space || '',
      opportunityId: record.opportunityId || '',
      by: record.by || '',
      at: record.at || '2026-09-15 09:00',
      status,
      changeId: record.changeId || '',
      behaviorId: record.behaviorId || '',
      failReason: String(record.failReason || ''),
      startedAt: record.startedAt || '',
      completedAt: record.completedAt || '',
      canceledAt: record.canceledAt || '',
      canceledBy: record.canceledBy || '',
      retryCount: Number(record.retryCount || 0)
    };
  }

  /** 旧快照（录音带单值 space、没有 placements）迁移成归位记录，保证历史演示数据不丢。 */
  function derivePlacements(recordings, legacy) {
    return legacy.filter(item => item && item.space).map((item, index) => normalizePlacement({
      id: `PL-LEGACY-${index + 1}`, recording: item.id, space: item.space, opportunityId: '', by: item.owner || '',
      at: item.date || '', status: item.status === 'mounted' ? 'done' : 'updating'
    }, index)).filter(item => recordings.some(record => record.id === item.recording));
  }

  /**
   * R15 行为记录样例：覆盖 已完成 / 处理中 / 失败 / 无可用内容 四态与三类事件源。
   * 行为记录与客户事实分开存放；冻结空间只保留历史记录，不生成新记录。
   * BR-507/508 落在 R14 日报窗口内（WS-201 同客户两次跟进），BR-509 演示日报写回的客户级「当日汇总」（M07-3 承接）。
   */
  function demoBehaviorRecords() {
    return [
      { id: 'BR-509', space: 'WS-201', opportunityId: 'OP-301', kind: '当日汇总', eventType: 'daily_summary', eventId: 'daily-summary:2026-09-15:WS-201', eventAt: '2026-09-15 18:47', author: 'U-1004', status: 'done', summary: '当日两次跟进均聚焦验收口径：上午电话对齐验收指标、下午拜访确认试点启动时间；客户侧验收负责人仍未明确，建议下次沟通前准备验收指标模板。', keyBehaviors: ['跨事件结论由晚间日报 DR-0915 写回'], issues: [], improvements: [], nextQuestions: ['客户侧验收负责人是谁？'], failReason: '', note: '由晚间日报 DR-0915 写回；只有形成跨事件新结论时才写入。', createdAt: '2026-09-15 18:47', completedAt: '2026-09-15 18:47' },
      { id: 'BR-507', space: 'WS-201', opportunityId: 'OP-301', kind: '单次跟进', eventType: 'followup', eventId: 'FU-D201', eventAt: '2026-09-15 10:40', author: 'U-1004', status: 'done', summary: '上午电话与客户对齐验收指标口径，客户确认可用率口径。', keyBehaviors: ['主动复述客户验收口径', '记录客户确认的可用率指标'], issues: ['验收负责人人选仍未覆盖'], improvements: ['下次沟通前准备验收指标模板'], nextQuestions: ['客户侧验收负责人是谁？'], failReason: '', note: '', createdAt: '2026-09-15 10:44', completedAt: '2026-09-15 10:45' },
      { id: 'BR-508', space: 'WS-201', opportunityId: 'OP-301', kind: '单次跟进', eventType: 'followup', eventId: 'FU-D202', eventAt: '2026-09-15 16:25', author: 'U-1004', status: 'done', summary: '下午拜访确认试点下周三启动，验收负责人待客户内部确认。', keyBehaviors: ['现场确认试点启动时间', '复听上午口径并补齐记录'], issues: ['验收负责人仍需客户内部确认'], improvements: ['把验收指标模板随会议纪要发出'], nextQuestions: ['试点启动的具体日期？', '验收负责人何时明确？'], failReason: '', note: '', createdAt: '2026-09-15 16:26', completedAt: '2026-09-15 16:27' },
      { id: 'BR-501', space: 'WS-201', opportunityId: 'OP-301', kind: '单次跟进', eventType: 'followup', eventId: 'FU-0', eventAt: '2026-09-14 16:30', author: 'U-1004', status: 'done', summary: '客户确认技术验证进展，沟通聚焦并发指标与试点计划。', keyBehaviors: ['主动复述客户验收口径', '现场给出试点时间建议'], issues: ['未覆盖客户侧验收负责人人选'], improvements: ['下次沟通前准备验收指标模板'], nextQuestions: ['客户侧验收负责人是谁？', '试点启动的具体日期？'], failReason: '', note: '', createdAt: '2026-09-14 16:35', completedAt: '2026-09-14 16:36' },
      { id: 'BR-502', space: 'WS-202', opportunityId: 'OP-302', kind: '单次跟进', eventType: 'meeting', eventId: 'PL-101', sourceRef: 'MT-102', eventAt: '2026-09-14 11:20', author: 'U-1004', status: 'done', summary: '客户明确华东配送通知场景，关注高峰发送量。', keyBehaviors: ['按场景拆分通知类型', '记录客户峰值口径'], issues: ['高峰发送量尚未量化'], improvements: ['用测算模板引导客户给出区间'], nextQuestions: ['日均与峰值发送量分别是多少？'], failReason: '', note: '', createdAt: '2026-09-14 11:25', completedAt: '2026-09-14 11:26' },
      // 客户信息已写成、行为记录未写成：两条结果分开展示，行为记录失败不阻塞客户信息结果。
      { id: 'BR-510', space: 'WS-202', opportunityId: 'OP-302', kind: '单次跟进', eventType: 'meeting', eventId: 'PL-105', sourceRef: 'MT-105', eventAt: '2026-09-15 15:31', author: 'U-1004', status: 'failed', summary: '', keyBehaviors: [], issues: [], improvements: [], nextQuestions: [], failReason: '行为分析服务超时，未写入占位记录。', note: '', createdAt: '2026-09-15 15:36', completedAt: '' },
      // 客户信息无变化、行为记录照常写成：不因为写了行为记录就发完成提醒。
      { id: 'BR-511', space: 'WS-201', opportunityId: 'OP-301', kind: '单次跟进', eventType: 'meeting', eventId: 'PL-104', sourceRef: 'MT-105', eventAt: '2026-09-15 15:30', author: 'U-1004', status: 'done', summary: '本次会议沟通：一次沟通同时覆盖两个客户的通道与通知场景。', keyBehaviors: ['按客户拆分议题，逐个确认口径'], issues: ['本空间部分内容与既有记录重复，未形成客户事实变化'], improvements: ['跨客户沟通后先分别整理再归位'], nextQuestions: ['本客户下一步的时间与责任人？'], failReason: '', note: '', createdAt: '2026-09-15 15:34', completedAt: '2026-09-15 15:34' },
      { id: 'BR-503', space: 'WS-201', opportunityId: '', kind: '单次跟进', eventType: 'weekly_review', eventId: 'WR-201', eventAt: '2026-09-15 08:30', author: 'U-1004', status: 'processing', summary: '', keyBehaviors: [], issues: [], improvements: [], nextQuestions: [], failReason: '', note: '', createdAt: '2026-09-15 08:31', completedAt: '' },
      { id: 'BR-504', space: 'WS-202', opportunityId: 'OP-302', kind: '单次跟进', eventType: 'followup', eventId: 'FU-1', eventAt: '2026-09-14 16:30', author: 'U-1004', status: 'failed', summary: '', keyBehaviors: [], issues: [], improvements: [], nextQuestions: [], failReason: '行为分析服务超时，未写入占位记录。', note: '', createdAt: '2026-09-14 16:35', completedAt: '' },
      { id: 'BR-505', space: 'WS-203', opportunityId: 'OP-303', kind: '单次跟进', eventType: 'followup', eventId: 'FU-2', eventAt: '2026-09-14 16:30', author: 'U-1004', status: 'empty', summary: '', keyBehaviors: [], issues: [], improvements: [], nextQuestions: [], failReason: '', note: '本次跟进内容过短，无可用内容，未做归纳。', createdAt: '2026-09-14 16:35', completedAt: '2026-09-14 16:36' },
      { id: 'BR-506', space: 'WS-206', opportunityId: '', kind: '单次跟进', eventType: 'followup', eventId: 'FU-4', eventAt: '2026-09-14 16:30', author: 'U-1004', status: 'done', summary: '冻结前的历史行为记录：客户复盘了上线后的使用反馈。', keyBehaviors: ['回听客户反馈并逐条记录'], issues: ['客户对账单口径有疑问'], improvements: ['复盘结论同步给运营'], nextQuestions: ['账单口径以哪个系统为准？'], failReason: '', note: '', createdAt: '2026-09-14 16:35', completedAt: '2026-09-14 16:36' }
    ];
  }

  /** 统一补齐行为记录字段，兼容 R15 上线前的旧演示快照。 */
  function normalizeBehaviorRecord(item, index) {
    const record = item || {};
    const list = value => Array.isArray(value) ? value : [];
    return {
      ...record,
      id: record.id || `BR-${index + 1}`,
      space: record.space || '',
      opportunityId: record.opportunityId || '',
      kind: record.kind || '单次跟进',
      // R14 写回的「当日汇总」使用 daily_summary 事件类型；其余事件源维持 R15 三类。
      eventType: ['followup', 'weekly_review', 'meeting', 'daily_summary'].includes(record.eventType) ? record.eventType : 'followup',
      eventId: record.eventId || '',
      // 录音事件的 eventId 是归位记录，原文依据另存录音标识，供依据入口回到录音原文。
      sourceRef: record.sourceRef || '',
      eventAt: record.eventAt || record.createdAt || '2026-09-15 09:00',
      author: record.author || '',
      status: ['processing', 'done', 'failed', 'empty'].includes(record.status) ? record.status : 'processing',
      summary: String(record.summary || ''),
      keyBehaviors: list(record.keyBehaviors),
      issues: list(record.issues),
      improvements: list(record.improvements),
      nextQuestions: list(record.nextQuestions),
      failReason: String(record.failReason || ''),
      note: String(record.note || ''),
      createdAt: record.createdAt || '2026-09-15 09:00',
      completedAt: record.completedAt || ''
    };
  }

  /** 方案往来演示附件：同一条推送可同时带 Word / PDF / PPT / Markdown / Excel。 */
  function demoSolutionAttachments() {
    return [
      { name: '通信线路试点建议.docx', size: '420 KB', preview: 'Word 正文：建议采用两阶段试点。第一阶段验证线路稳定性与并发容量，第二阶段覆盖正式业务场景。请客户技术负责人确认试点窗口。' },
      { name: '通信线路试点建议.pdf', size: '1.2 MB', preview: 'PDF 封面与目录：1. 试点范围  2. 容量测算  3. 验收指标  4. 风险与回退。本文件为对外可转发版本。' },
      { name: '试点汇报材料.pptx', size: '3.8 MB', preview: 'PPT 共 12 页：现状、试点范围、容量测算、验收口径、时间计划、需客户确认事项。适合当面讲解。' },
      { name: '试点要点说明.md', size: '18 KB', preview: '# 试点要点\n- 先验证线路稳定性与并发容量\n- 验收指标：可用率、平均接通时长\n- 待确认：技术负责人、预计试点时间' },
      { name: '并发容量测算.xlsx', size: '286 KB', preview: 'Excel 测算表：日峰值 12 万条，建议预留 1.8 倍冗余；未包含节假日营销场景。请周四补充峰值数据后复核。' }
    ];
  }
  F.demoSolutionAttachments = demoSolutionAttachments;

  /**
   * 统一补齐方案协同字段，兼容 R08 上线前已经保存的旧演示快照。
   * 一条方案记录始终属于一个客户空间，附件、外链、阅读和催办状态都跟随该空间独立保存。
   */
  function normalizeSolution(solution, index) {
    const item = solution || {};
    const attachments = Array.isArray(item.attachments)
      ? item.attachments.map(file => ({
        name: String(file.name || '未命名附件'),
        size: String(file.size || '演示文件'),
        preview: String(file.preview || '')
      }))
      : item.attachment ? [{ name: String(item.attachment), size: '演示文件', preview: '' }] : [];
    // 星辰科技种子方案补齐多格式附件，避免旧本地快照仍只剩一个 PDF。
    if (item.id === 'SL-101' && attachments.length < 5) {
      attachments.splice(0, attachments.length, ...demoSolutionAttachments());
    }
    const readAt = item.readAt || (item.read ? item.date : '');
    const eventLog = Array.isArray(item.eventLog) && item.eventLog.length
      ? item.eventLog
      : [{ type: 'sent', at: item.date || '2026-09-15 09:00', actor: item.author, result: 'success' }];
    return {
      ...item,
      id: item.id || `SL-${index + 1}`,
      space: item.space || '',
      author: item.author || 'U-1010',
      title: String(item.title || '未命名方案'),
      body: String(item.body || ''),
      date: item.date || '2026-09-15 09:00',
      attachments,
      externalLink: String(item.externalLink || ''),
      read: Boolean(item.read),
      readAt,
      reply: String(item.reply || ''),
      replyDate: item.replyDate || '',
      replyRead: Boolean(item.replyRead),
      withdrawn: Boolean(item.withdrawn),
      withdrawnAt: item.withdrawnAt || '',
      deliveryStatus: item.deliveryStatus || 'sent',
      deliveryReason: item.deliveryReason || '',
      remindCount: Number(item.remindCount || 0),
      remindedAt: item.remindedAt || '',
      eventLog
    };
  }

  /**
   * 统一补齐 R12 提醒字段，兼容旧演示快照。
   * 旧快照缺少接收人时按事项类型回填：方案回复发给方案作者，空间类提醒发给归属销售。
   */
  function normalizeNotification(item, index, state) {
    const n = item || {};
    const space = n.space && state ? state.spaces.find(space => space.id === n.space) : null;
    const solution = n.solution && state ? (state.solutions || []).find(record => record.id === n.solution) : null;
    let recipient = n.recipient || '';
    if (!recipient) {
      if (n.type === '方案回复') recipient = solution?.author || '';
      else if (space) recipient = space.sales;
    }
    return {
      ...n,
      id: n.id || `N-${index + 1}`,
      recipient,
      type: n.type || '系统提醒',
      title: String(n.title || '提醒'),
      text: String(n.text || ''),
      space: n.space || '',
      solution: n.solution || '',
      changeId: n.changeId || '',
      link: n.link && typeof n.link === 'object' ? n.link : null,
      read: Boolean(n.read),
      createdAt: n.createdAt || n.at || '2026-09-15 09:30',
      dedupKey: n.dedupKey || '',
      deduped: Number(n.deduped || 0),
      status: n.status === 'waiting' ? 'waiting' : 'active',
      waitingReason: n.waitingReason || '',
      pushStatus: n.pushStatus || 'not_required',
      pushFailReason: n.pushFailReason || ''
    };
  }

  /**
   * R13 今日该跟演示数据：三份提示词（状态/排序/动作）、产出时点、试跑与发布留痕、按销售 × 日期的快照。
   * 快照覆盖四个分支：U-1004 已生成（含停滞/有进展/待决策）、U-1005 空名单、U-1008 尚未生成（产出时点 10:30 未到）、U-1006 生成失败。
   * 销售侧只读当日快照，失败或未生成不沿用昨日名单；策略版本对销售是不透明编号，提示词分版本只在运营页展示。
   */
  function demoInsight() {
    const promptVersions = { status: 'v3', ranking: 'v2', action: 'v5' };
    return {
      prompts: {
        status: {
          label: '状态提示词',
          active: { version: 'v3', body: '逐空间读取客户上下文与跟进、录音、方案原文，给出停滞、有进展、待决策之一；没有足够原文时回答依据不足，不推测、不凑数。', publishedAt: '2026-09-11 17:20', publishedBy: 'U-1002', effectiveFrom: '2026-09-12' },
          draft: null,
          history: [
            { version: 'v2', body: '按最近跟进时间与方案反馈判断空间状态。', publishedAt: '2026-09-04 10:12', publishedBy: 'U-1002', effectiveFrom: '2026-09-05' },
            { version: 'v1', body: '首版状态判断口径。', publishedAt: '2026-08-28 09:40', publishedBy: 'U-1003', effectiveFrom: '2026-08-29' }
          ],
          revisions: []
        },
        ranking: {
          label: '排序提示词',
          active: { version: 'v2', body: '只从有结论的空间中排序，最多选 5 个；停滞优先于待决策，待决策优先于有进展。', publishedAt: '2026-09-08 10:05', publishedBy: 'U-1002', effectiveFrom: '2026-09-09' },
          // 未上线草稿：演示「保存不等于上线」；上一版草稿被覆盖后留在修订记录，不静默丢失。
          draft: { version: 'v4', body: '只从有结论的空间中排序，最多选 5 个；星标空间适当提前，暂不跟进空间靠后但不直接排除。', savedAt: '2026-09-15 09:40', savedBy: 'U-1002' },
          history: [{ version: 'v1', body: '首版排序口径。', publishedAt: '2026-08-28 09:42', publishedBy: 'U-1003', effectiveFrom: '2026-08-29' }],
          revisions: [{ version: 'v3', body: '排序草稿：按客户等级优先。', savedAt: '2026-09-14 16:20', savedBy: 'U-1003', state: '被覆盖', coveredBy: 'U-1002', coveredAt: '2026-09-15 09:40' }]
        },
        action: {
          label: '动作提示词',
          active: { version: 'v5', body: '只为入选空间写下一步：动作具体、当天可执行，并附上所依据的原文出处。', publishedAt: '2026-09-13 15:30', publishedBy: 'U-1003', effectiveFrom: '2026-09-14' },
          draft: null,
          history: [{ version: 'v4', body: '为入选空间给出下一步建议。', publishedAt: '2026-09-05 14:18', publishedBy: 'U-1002', effectiveFrom: '2026-09-06' }],
          revisions: []
        }
      },
      schedule: { defaultTime: '08:30', overrides: { 'U-1008': '10:30' }, updatedAt: '2026-09-12 14:00', updatedBy: 'U-1002' },
      trials: [
        {
          id: 'TR-1', kind: 'ranking', at: '2026-09-15 10:05', by: 'U-1002', draftVersion: 'v4', upstream: 'online',
          spaces: [
            { space: 'WS-201', customer: '星辰科技有限公司', sales: 'U-1004', frozen: false, oldResult: '入选 · 第 1 位', newResult: '入选 · 第 1 位', changed: false },
            { space: 'WS-203', customer: '启明教育科技有限公司', sales: 'U-1004', frozen: false, oldResult: '入选 · 第 3 位', newResult: '未入选', changed: true },
            { space: 'WS-206', customer: '和光医疗科技有限公司', sales: 'U-1004', frozen: true, oldResult: '未入选', newResult: '未入选', changed: false }
          ]
        }
      ],
      publishLog: [
        { at: '2026-09-13 15:30', by: 'U-1003', kind: 'action', version: 'v5', action: 'publish', effectiveFrom: '2026-09-14' },
        { at: '2026-09-11 17:20', by: 'U-1002', kind: 'status', version: 'v3', action: 'publish', effectiveFrom: '2026-09-12' },
        { at: '2026-09-08 10:05', by: 'U-1002', kind: 'ranking', version: 'v2', action: 'publish', effectiveFrom: '2026-09-09' },
        { at: '2026-09-06 11:00', by: 'U-1002', kind: 'ranking', version: 'v1', action: 'rollback', effectiveFrom: '2026-09-07' }
      ],
      snapshots: [
        {
          id: 'INS-U-1004-2026-09-15', sales: 'U-1004', date: '2026-09-15', status: 'generated',
          scheduledAt: '2026-09-15 08:30', generatedAt: '2026-09-15 08:30', inputCutoff: '2026-09-15 08:25',
          promptVersions, strategyVersion: '20260915-3',
          universe: ['WS-201', 'WS-202', 'WS-203', 'WS-204'], concluded: 4, truncated: 0, failReason: '',
          // 次日输入快照：WS-203 带暂不跟进仍入选，演示「标记不保证必进或必出」。
          inputMarks: [
            { space: 'WS-202', starred: true, pause: null },
            { space: 'WS-203', starred: false, pause: { reason: '客户采购流程暂停，预计月底恢复', until: '2026-09-30' } }
          ],
          entries: [
            {
              space: 'WS-201', customer: '星辰科技有限公司', status: '停滞',
              summary: '试点资料已挂载两天，验收指标仍未确认，沟通停滞。',
              action: '今天电话确认验收指标口径，锁定试点启动时间。',
              evidence: [
                { step: 'status', type: 'followup', id: 'FU-0', label: '跟进记录 · 客户拜访', at: '2026-09-14 16:30' },
                { step: 'status', type: 'document', id: 'DOC-401', label: '外部资料 · 星辰科技-试点方案v2.md', at: '2026-09-14 15:20' },
                { step: 'action', type: 'meeting', id: 'MT-101', label: '会议录音 · 线路试点技术交流', at: '2026-09-15' }
              ]
            },
            {
              space: 'WS-202', customer: '远山物流有限公司', status: '有进展',
              summary: '客户认可通知优化方向，约定周四补充峰值数据。',
              action: '周四前备好峰值测算模板，跟进客户补充数据。',
              evidence: [
                { step: 'status', type: 'solution', id: 'SL-102', label: '方案往来 · 华东配送通知优化方案', at: '2026-09-14 11:30' },
                { step: 'ranking', type: 'meeting', id: 'MT-102', label: '会议录音 · 配送通知需求沟通', at: '2026-09-15' },
                { step: 'action', type: 'followup', id: 'FU-1', label: '跟进记录 · 电话沟通', at: '2026-09-14 16:30' }
              ]
            },
            {
              space: 'WS-203', customer: '启明教育科技有限公司', status: '待决策',
              summary: '采购预算与交付周期等待客户内部决策。',
              action: '与客户确认预算决策时间与验收标准。',
              evidence: [
                { step: 'status', type: 'followup', id: 'FU-2', label: '跟进记录 · 客户拜访', at: '2026-09-14 16:30' },
                { step: 'action', type: 'meeting', id: 'MT-103', label: '会议录音 · 采购预算及交付确认', at: '2026-09-15' }
              ]
            },
            {
              space: 'WS-204', customer: '云桥数字科技有限公司', status: '停滞',
              summary: '首次产品介绍后一周无新进展。',
              action: '回访客户，确认是否进入需求评估。',
              evidence: [
                { step: 'status', type: 'followup', id: 'FU-3', label: '跟进记录 · 电话沟通', at: '2026-09-14 16:30' },
                { step: 'ranking', type: 'crm', id: 'C-1004', label: 'CRM 客户档案', at: '2026-09-15 10:25' }
              ]
            }
          ]
        },
        // 昨日旧快照：证明当天重复打开只读当日快照，不沿用昨日名单。
        {
          id: 'INS-U-1004-2026-09-14', sales: 'U-1004', date: '2026-09-14', status: 'generated',
          scheduledAt: '2026-09-14 08:30', generatedAt: '2026-09-14 08:30', inputCutoff: '2026-09-14 08:25',
          promptVersions: { status: 'v2', ranking: 'v2', action: 'v4' }, strategyVersion: '20260914-2',
          universe: ['WS-201', 'WS-202', 'WS-203'], concluded: 3, truncated: 0, failReason: '', inputMarks: [],
          entries: [
            { space: 'WS-201', customer: '星辰科技有限公司', status: '待决策', summary: '试点范围待客户确认。', action: '与客户确认试点范围。', evidence: [{ step: 'status', type: 'followup', id: 'FU-0', label: '跟进记录 · 客户拜访', at: '2026-09-14 16:30' }] },
            { space: 'WS-202', customer: '远山物流有限公司', status: '有进展', summary: '配送通知需求已明确。', action: '补充高峰发送量测算。', evidence: [{ step: 'status', type: 'meeting', id: 'MT-102', label: '会议录音 · 配送通知需求沟通', at: '2026-09-14' }] },
            { space: 'WS-203', customer: '启明教育科技有限公司', status: '停滞', summary: '预算沟通暂无回音。', action: '电话回访采购联系人。', evidence: [{ step: 'status', type: 'followup', id: 'FU-2', label: '跟进记录 · 客户拜访', at: '2026-09-14 16:30' }] }
          ]
        },
        {
          id: 'INS-U-1005-2026-09-15', sales: 'U-1005', date: '2026-09-15', status: 'empty',
          scheduledAt: '2026-09-15 08:30', generatedAt: '2026-09-15 08:30', inputCutoff: '2026-09-15 08:25',
          promptVersions, strategyVersion: '20260915-3', universe: ['WS-207'], concluded: 0, truncated: 0, failReason: '', inputMarks: [], entries: []
        },
        {
          id: 'INS-U-1008-2026-09-15', sales: 'U-1008', date: '2026-09-15', status: 'pending',
          scheduledAt: '2026-09-15 10:30', generatedAt: '', inputCutoff: '',
          promptVersions: {}, strategyVersion: '', universe: [], concluded: 0, truncated: 0, failReason: '', inputMarks: [], entries: []
        },
        {
          id: 'INS-U-1006-2026-09-15', sales: 'U-1006', date: '2026-09-15', status: 'failed',
          scheduledAt: '2026-09-15 08:30', generatedAt: '2026-09-15 08:30', inputCutoff: '2026-09-15 08:25',
          promptVersions, strategyVersion: '20260915-3', universe: ['WS-209'], concluded: 0, truncated: 0,
          failReason: '状态判断服务超时，整批未完成', inputMarks: [], entries: []
        }
      ]
    };
  }

  /**
   * R13 销售标记样例：WS-202 星标、WS-203 暂不跟进（生效中）、WS-204 暂不跟进结束日已过（已失效）。
   * 标记按空间记录，重复标记以最新一次为准并写变更日志。
   */
  function demoInsightMarks() {
    return [
      { id: 'MK-1', space: 'WS-202', sales: 'U-1004', starred: true, starredAt: '2026-09-14 18:02', pause: null, canceledAt: '', log: [{ at: '2026-09-14 18:02', action: '星标', detail: '' }] },
      { id: 'MK-2', space: 'WS-203', sales: 'U-1004', starred: false, starredAt: '', pause: { reason: '客户采购流程暂停，预计月底恢复', until: '2026-09-30', at: '2026-09-14 19:10' }, canceledAt: '', log: [{ at: '2026-09-14 19:10', action: '暂不跟进', detail: '原因：客户采购流程暂停，预计月底恢复；结束日 2026-09-30' }] },
      { id: 'MK-3', space: 'WS-204', sales: 'U-1004', starred: false, starredAt: '', pause: { reason: '客户内部组织调整，暂停跟进两周', until: '2026-09-14', at: '2026-09-08 11:30' }, canceledAt: '', log: [{ at: '2026-09-08 11:30', action: '暂不跟进', detail: '原因：客户内部组织调整，暂停跟进两周；结束日 2026-09-14' }] }
    ];
  }

  /** 统一补齐单份提示词字段，兼容旧演示快照；draft 缺失视为无草稿，history/revisions 缺失视为空。 */
  function normalizeInsightPrompt(item, label) {
    const prompt = item && typeof item === 'object' ? item : {};
    return {
      label: prompt.label || label,
      active: prompt.active && typeof prompt.active === 'object' ? prompt.active : null,
      draft: prompt.draft && typeof prompt.draft === 'object' ? prompt.draft : null,
      history: Array.isArray(prompt.history) ? prompt.history : [],
      revisions: Array.isArray(prompt.revisions) ? prompt.revisions : []
    };
  }

  /** 统一补齐快照字段；entries/evidence/inputMarks 缺省为空数组，保证旧快照可打开。 */
  function normalizeInsightSnapshot(item, index) {
    const snapshot = item || {};
    return {
      ...snapshot,
      id: snapshot.id || `INS-${index + 1}`,
      sales: snapshot.sales || '',
      date: snapshot.date || '',
      status: ['generated', 'empty', 'pending', 'failed'].includes(snapshot.status) ? snapshot.status : 'pending',
      scheduledAt: snapshot.scheduledAt || '',
      generatedAt: snapshot.generatedAt || '',
      inputCutoff: snapshot.inputCutoff || '',
      promptVersions: snapshot.promptVersions && typeof snapshot.promptVersions === 'object' ? snapshot.promptVersions : {},
      strategyVersion: String(snapshot.strategyVersion || ''),
      universe: Array.isArray(snapshot.universe) ? snapshot.universe : [],
      concluded: Number(snapshot.concluded || 0),
      truncated: Number(snapshot.truncated || 0),
      failReason: String(snapshot.failReason || ''),
      inputMarks: Array.isArray(snapshot.inputMarks) ? snapshot.inputMarks : [],
      entries: (Array.isArray(snapshot.entries) ? snapshot.entries : []).map(entry => ({ ...entry, evidence: Array.isArray(entry.evidence) ? entry.evidence : [] }))
    };
  }

  /** 旧快照没有 insight 子模型时补完整演示数据；有部分字段时只补缺口，不回填被测试清空的生效版。 */
  function normalizeInsight(raw) {
    const demo = demoInsight();
    const value = raw && typeof raw === 'object' ? raw : null;
    if (!value) return demo;
    return {
      prompts: {
        status: normalizeInsightPrompt(value.prompts?.status, '状态提示词'),
        ranking: normalizeInsightPrompt(value.prompts?.ranking, '排序提示词'),
        action: normalizeInsightPrompt(value.prompts?.action, '动作提示词')
      },
      schedule: { ...demo.schedule, ...(value.schedule && typeof value.schedule === 'object' ? value.schedule : {}), overrides: { ...(value.schedule?.overrides && typeof value.schedule.overrides === 'object' ? value.schedule.overrides : {}) } },
      trials: Array.isArray(value.trials) ? value.trials : [],
      publishLog: Array.isArray(value.publishLog) ? value.publishLog : [],
      snapshots: (Array.isArray(value.snapshots) ? value.snapshots : []).map(normalizeInsightSnapshot)
    };
  }

  /** 统一补齐标记字段；pause 为空对象时视为无暂不跟进。 */
  function normalizeInsightMark(item, index) {
    const mark = item || {};
    return {
      ...mark,
      id: mark.id || `MK-${index + 1}`,
      space: mark.space || '',
      sales: mark.sales || '',
      starred: Boolean(mark.starred),
      starredAt: mark.starredAt || '',
      pause: mark.pause && typeof mark.pause === 'object' && String(mark.pause.reason || '').trim() ? { reason: String(mark.pause.reason), until: mark.pause.until || '', at: mark.pause.at || '' } : null,
      canceledAt: mark.canceledAt || '',
      log: Array.isArray(mark.log) ? mark.log : []
    };
  }

  /* ---------- R14 晚间日报与当日变化分析（种子与补齐） ---------- */

  /**
   * R14 日报运行快照样例：覆盖 成功 / 部分成功 / 失败 / 无有效变化 四态。
   * 窗口连续衔接（上一计划截止 → 本次计划截止，左开右闭）；窗口内引用的变化与行为记录必须真实存在：
   * DR-0915 窗口 2026-09-14 18:30 → 2026-09-15 18:30，消费 CHGX-505/506/507 与 BR-507/508，
   * CHGX-502 仍在处理进入下一窗口，CHGX-501（09-14 15:22）属于 DR-0914 窗口。
   * 状态命名用 success/partial/failed/empty，与 spaceChanges 的 nochange 区分。
   */
  function demoDailyReports() {
    return [
      {
        id: 'DR-0915', reportDate: '2026-09-15',
        windowStart: '2026-09-14 18:30', windowEnd: '2026-09-15 18:30',
        startedAt: '2026-09-15 18:30', completedAt: '2026-09-15 18:47', inputCutoff: '2026-09-15 18:30',
        promptVersion: 'M072-v2', status: 'partial',
        stats: { candidates: 7, effective: 2, failed: 1, excluded: 6 },
        overview: {
          effectiveCount: 2,
          progress: ['星辰科技：客户确认试点下周三启动，验收指标口径已对齐', '远山物流：客户确认日均通知量约 5 万条'],
          risks: ['远山物流：短信日峰值发送量存在未解决冲突（8 万条 vs 12 万条）'],
          pending: ['星辰科技：客户侧验收负责人尚未明确', '远山物流：节假日营销场景是否纳入本期'],
          solutionCustomers: ['星辰科技（通信线路试点建议待回复）', '远山物流（高峰发送量测算协同中）'],
          crossPatterns: ['2 个客户空间当日均出现验收口径类待确认事项']
        },
        blocks: [
          {
            id: 'DRB-0915-1', space: 'WS-201', customerId: 'C-1001', customer: '星辰科技有限公司', sales: 'U-1004',
            status: 'success', frozen: false, frozenAt: '', lastResultAt: '2026-09-15 16:27', missingNote: '', failReason: '',
            sections: {
              current: '方案推进阶段：试点范围已明确，验收指标口径已对齐（2026-09-15 18:30 截止时状态）。',
              keyChanges: ['客户确认试点启动时间：下周三', '验收指标口径：可用率 ≥ 99.9%', '当前卡点：待确认验收指标口径 → 待客户确认验收负责人'],
              impact: ['试点进入启动准备，可能影响下周交付排期，建议准备启动材料。'],
              pending: ['客户侧验收负责人尚未明确'],
              behavior: ['当日两次跟进均聚焦验收口径：上午电话对齐指标、下午拜访确认启动时间；建议下次沟通前准备验收指标模板。', '参与记录 2 条（BR-507、BR-508）'],
              collaboration: ['方案《通信线路试点建议》销售已读未回复，建议准备试点启动 checklist。'],
              sources: [
                { type: 'change', id: 'CHGX-505', label: '客户变化 · 跟进记录（电话沟通）', at: '2026-09-15 11:20' },
                { type: 'behavior', id: 'BR-508', label: '行为记录 · BR-508（客户拜访）', at: '2026-09-15 16:25' },
                { type: 'behavior', id: 'BR-507', label: '行为记录 · BR-507（电话沟通）', at: '2026-09-15 10:40' }
              ]
            },
            behaviorSummaryWritten: true
          },
          {
            id: 'DRB-0915-2', space: 'WS-202', customerId: 'C-1002', customer: '远山物流有限公司', sales: 'U-1004',
            status: 'partial', frozen: false, frozenAt: '', lastResultAt: '2026-09-15 09:20',
            missingNote: '部分信息尚未更新：外部资料《验收标准草案.md》解析失败（CHGX-504），未参与本次汇总。', failReason: '',
            sections: {
              current: '需求探索阶段：华东配送通知场景已明确（2026-09-15 18:30 截止时状态）。',
              keyChanges: ['客户确认日均通知量约 5 万条', '新增未解决冲突：短信日峰值发送量（8 万条 vs 12 万条）'],
              impact: ['峰值口径未确定可能影响通道配置，建议准备两种峰值下的成本测算。'],
              pending: ['节假日营销场景是否纳入本期', '短信日峰值发送量以哪一口径为准'],
              behavior: [],
              collaboration: ['方案《华东配送通知优化方案》已回复：客户认可方向，周四补充峰值数据；建议准备高峰量测算模板。'],
              sources: [{ type: 'change', id: 'CHGX-506', label: '客户变化 · 会议录音 · 配送通知需求沟通', at: '2026-09-15 09:20' }]
            },
            behaviorSummaryWritten: false
          }
        ],
        failedCustomers: [{ customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-203', stage: '客户块生成', reason: '全部上游结果不可用：窗口内客户信息更新失败（CHGX-507），行为记录无可用内容（BR-505）；不使用旧日报填充。' }],
        previousFailures: [],
        excluded: [
          { customerId: 'C-1004', customer: '云桥数字科技有限公司', space: 'WS-204', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1001', customer: '星辰科技有限公司', space: 'WS-207', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1002', customer: '远山物流有限公司', space: 'WS-208', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-209', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1005', customer: '海川保险服务有限公司', space: 'WS-205', reason: '仅客户级确权，无商机确权空间' },
          { customerId: 'C-1006', customer: '和光医疗科技有限公司', space: 'WS-206', reason: '空间已于窗口内冻结（2026-09-15 10:20），冻结前窗口内无已完成结果' }
        ],
        carriedOver: [{ changeId: 'CHGX-502', space: 'WS-201', customer: '星辰科技有限公司', reason: '结果仍在处理，进入下一报告窗口' }],
        recipients: [
          { person: 'U-1004', kind: 'sales', spaces: ['WS-201', 'WS-202'], lockedAt: '2026-09-15 18:30', checkedAt: '2026-09-15 18:47', result: 'passed' },
          { person: 'U-1010', kind: 'solution', spaces: ['WS-201', 'WS-202'], lockedAt: '2026-09-15 18:30', checkedAt: '2026-09-15 18:47', result: 'passed' }
        ],
        runLog: [
          { at: '2026-09-15 18:30', step: '窗口确定', result: 'success', detail: '报告窗口 2026-09-14 18:30 → 2026-09-15 18:30' },
          { at: '2026-09-15 18:31', step: '输入读取', result: 'success', detail: '候选 7 个客户空间；窗口内已完成变化 2 条、失败 1 条、仍在处理 1 条；已完成行为记录 2 条' },
          { at: '2026-09-15 18:36', step: '有效变化判断', result: 'success', detail: '有效 3 个客户；排除 4 个（无净变化）；另排除仅客户级确权 1、窗口内冻结 1' },
          { at: '2026-09-15 18:42', step: '客户块生成', result: 'partial', detail: '成功 2 个（远山物流部分信息尚未更新）；启明教育全部上游结果不可用，生成失败' },
          { at: '2026-09-15 18:45', step: '今日总览生成', result: 'success', detail: '六类总览已生成；跨客户行为模式命中 2 个客户空间' },
          { at: '2026-09-15 18:46', step: '接收人锁定与复核', result: 'success', detail: '截止时锁定 2 人（销售 1、方案 1），发送前权限复核通过 2 人' },
          { at: '2026-09-15 18:47', step: '送达与写回', result: 'success', detail: '日报送达 2 人；写回「当日汇总」1 条（星辰科技）' }
        ]
      },
      {
        id: 'DR-0914', reportDate: '2026-09-14',
        windowStart: '2026-09-13 18:30', windowEnd: '2026-09-14 18:30',
        startedAt: '2026-09-14 18:30', completedAt: '2026-09-14 18:44', inputCutoff: '2026-09-14 18:30',
        promptVersion: 'M072-v1', status: 'success',
        stats: { candidates: 8, effective: 2, failed: 0, excluded: 7 },
        overview: {
          effectiveCount: 2,
          progress: ['星辰科技：试点资料挂载完成，试点范围与验收指标建议已明确', '远山物流：华东配送通知场景明确'],
          risks: ['星辰科技：客户侧验收负责人尚未明确'],
          pending: ['星辰科技：客户侧验收负责人尚未明确', '远山物流：节假日营销场景是否纳入本期'],
          solutionCustomers: ['星辰科技（通信线路试点建议已推送）'],
          crossPatterns: []
        },
        blocks: [
          {
            id: 'DRB-0914-1', space: 'WS-201', customerId: 'C-1001', customer: '星辰科技有限公司', sales: 'U-1004',
            status: 'success', frozen: false, frozenAt: '', lastResultAt: '2026-09-14 16:36', missingNote: '', failReason: '',
            sections: {
              current: '方案推进阶段：技术团队已完成初步验证（2026-09-14 18:30 截止时状态）。',
              keyChanges: ['试点范围：华东三个业务场景', '建议验收指标：可用率、平均接通时长', '当前卡点：等待客户确认试点范围 → 试点范围已明确，待确认验收指标口径'],
              impact: ['试点范围明确后，可进入验收指标对齐阶段。'],
              pending: ['客户侧验收负责人尚未明确'],
              behavior: [],
              collaboration: ['方案《通信线路试点建议》已推送，等待销售回复。'],
              sources: [
                { type: 'behavior', id: 'BR-501', label: '行为记录 · BR-501（客户拜访）', at: '2026-09-14 16:30' },
                { type: 'change', id: 'CHGX-501', label: '客户变化 · 外部资料《星辰科技-试点方案v2.md》', at: '2026-09-14 15:22' }
              ]
            },
            behaviorSummaryWritten: false
          },
          {
            id: 'DRB-0914-2', space: 'WS-202', customerId: 'C-1002', customer: '远山物流有限公司', sales: 'U-1004',
            status: 'partial', frozen: false, frozenAt: '', lastResultAt: '2026-09-14 11:26',
            missingNote: '部分信息尚未更新：一条跟进的行为记录生成失败（BR-504），未参与归纳。', failReason: '',
            sections: {
              current: '需求探索阶段：华东配送通知需求明确（2026-09-14 18:30 截止时状态）。',
              keyChanges: ['客户明确华东配送通知场景，关注高峰发送量'],
              impact: ['高峰发送量量化后可能影响通道配置与报价。'],
              pending: ['节假日营销场景是否纳入本期'],
              behavior: [],
              collaboration: ['方案《华东配送通知优化方案》已推送：按通知类型拆分短信模板，先完成高峰量测算。'],
              sources: [{ type: 'behavior', id: 'BR-502', label: '行为记录 · BR-502（录音归位）', at: '2026-09-14 11:20' }]
            },
            behaviorSummaryWritten: false
          }
        ],
        failedCustomers: [],
        previousFailures: [],
        excluded: [
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-203', reason: '窗口内变化无净差异（CHGX-503），行为记录无可用内容' },
          { customerId: 'C-1004', customer: '云桥数字科技有限公司', space: 'WS-204', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1001', customer: '星辰科技有限公司', space: 'WS-207', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1002', customer: '远山物流有限公司', space: 'WS-208', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-209', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1006', customer: '和光医疗科技有限公司', space: 'WS-206', reason: '仅 1 条行为记录且无净变化，不重复归纳' },
          { customerId: 'C-1005', customer: '海川保险服务有限公司', space: 'WS-205', reason: '仅客户级确权，无商机确权空间' }
        ],
        carriedOver: [],
        recipients: [
          { person: 'U-1004', kind: 'sales', spaces: ['WS-201', 'WS-202'], lockedAt: '2026-09-14 18:30', checkedAt: '2026-09-14 18:44', result: 'passed' },
          { person: 'U-1010', kind: 'solution', spaces: ['WS-201', 'WS-202'], lockedAt: '2026-09-14 18:30', checkedAt: '2026-09-14 18:44', result: 'passed' }
        ],
        runLog: [
          { at: '2026-09-14 18:30', step: '窗口确定', result: 'success', detail: '报告窗口 2026-09-13 18:30 → 2026-09-14 18:30' },
          { at: '2026-09-14 18:39', step: '客户块生成', result: 'success', detail: '成功 2 个（远山物流部分信息尚未更新）' },
          { at: '2026-09-14 18:44', step: '送达与写回', result: 'success', detail: '日报送达 2 人；无跨事件新结论，未写回「当日汇总」' }
        ]
      },
      {
        id: 'DR-0913', reportDate: '2026-09-13',
        windowStart: '2026-09-12 18:30', windowEnd: '2026-09-13 18:30',
        startedAt: '2026-09-13 18:30', completedAt: '2026-09-13 18:52', inputCutoff: '2026-09-13 18:30',
        promptVersion: 'M072-v1', status: 'failed',
        stats: { candidates: 8, effective: 0, failed: 2, excluded: 7 },
        overview: null,
        blocks: [],
        failedCustomers: [
          { customerId: 'C-1001', customer: '星辰科技有限公司', space: 'WS-201', stage: '客户块生成', reason: '上游结果全部不可用：客户信息更新与行为分析均超时；未沿用昨日内容。' },
          { customerId: 'C-1002', customer: '远山物流有限公司', space: 'WS-202', stage: '客户块生成', reason: '上游结果全部不可用：客户信息更新与行为分析均超时；未沿用昨日内容。' }
        ],
        previousFailures: [],
        excluded: [
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-203', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1004', customer: '云桥数字科技有限公司', space: 'WS-204', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1001', customer: '星辰科技有限公司', space: 'WS-207', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1002', customer: '远山物流有限公司', space: 'WS-208', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-209', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1006', customer: '和光医疗科技有限公司', space: 'WS-206', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1005', customer: '海川保险服务有限公司', space: 'WS-205', reason: '仅客户级确权，无商机确权空间' }
        ],
        carriedOver: [],
        recipients: [
          { person: 'U-1004', kind: 'sales', spaces: ['WS-201', 'WS-202'], lockedAt: '2026-09-13 18:30', checkedAt: '2026-09-13 18:52', result: 'passed' },
          { person: 'U-1010', kind: 'solution', spaces: ['WS-201', 'WS-202'], lockedAt: '2026-09-13 18:30', checkedAt: '2026-09-13 18:52', result: 'passed' }
        ],
        runLog: [
          { at: '2026-09-13 18:30', step: '窗口确定', result: 'success', detail: '报告窗口 2026-09-12 18:30 → 2026-09-13 18:30' },
          { at: '2026-09-13 18:41', step: '客户块生成', result: 'failed', detail: '星辰科技、远山物流全部生成失败：上游结果不可用' },
          { at: '2026-09-13 18:52', step: '送达', result: 'success', detail: '已达 30 分钟收口线；向截止时候选接收人发送一次失败提醒（2 人）' }
        ]
      },
      {
        id: 'DR-0912', reportDate: '2026-09-12',
        windowStart: '2026-09-11 18:30', windowEnd: '2026-09-12 18:30',
        startedAt: '2026-09-12 18:30', completedAt: '2026-09-12 18:35', inputCutoff: '2026-09-12 18:30',
        promptVersion: 'M072-v1', status: 'empty',
        stats: { candidates: 8, effective: 0, failed: 0, excluded: 9 },
        overview: null,
        blocks: [],
        failedCustomers: [],
        previousFailures: [],
        excluded: [
          { customerId: 'C-1001', customer: '星辰科技有限公司', space: 'WS-201', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1002', customer: '远山物流有限公司', space: 'WS-202', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-203', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1004', customer: '云桥数字科技有限公司', space: 'WS-204', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1001', customer: '星辰科技有限公司', space: 'WS-207', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1002', customer: '远山物流有限公司', space: 'WS-208', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1003', customer: '启明教育科技有限公司', space: 'WS-209', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1006', customer: '和光医疗科技有限公司', space: 'WS-206', reason: '窗口内无净变化且无可归纳行为' },
          { customerId: 'C-1005', customer: '海川保险服务有限公司', space: 'WS-205', reason: '仅客户级确权，无商机确权空间' }
        ],
        carriedOver: [],
        recipients: [],
        runLog: [
          { at: '2026-09-12 18:30', step: '窗口确定', result: 'success', detail: '报告窗口 2026-09-11 18:30 → 2026-09-12 18:30' },
          { at: '2026-09-12 18:35', step: '有效变化判断', result: 'success', detail: '无客户满足有效条件；不生成业务日报，不通知，仅保留本运行记录' }
        ]
      }
    ];
  }

  /**
   * R14 提示词与运行配置样例：四份提示词（有效变化判断/当日行为归纳/客户块生成/今日总览生成）、
   * 整体版本列表（发布与回退不拆分）、试跑记录与全局产出时间（默认 18:30，调整下一自然日生效）。
   * 与 R13 的 state.insight 相互独立，不共用 prompts 结构。
   */
  function demoDailyReportConfig() {
    return {
      globalTime: '18:30', timeUpdatedBy: 'U-1002', timeUpdatedAt: '2026-09-10 11:20', timeEffectiveFrom: '2026-09-11',
      prompts: {
        changeDetection: { label: '有效变化判断', purpose: '判断窗口内哪些客户进入日报：净变化、待确认、冲突、缺失与有意义的当日行为模式。', draft: null },
        behaviorSummary: {
          label: '当日行为归纳', purpose: '汇总同一客户窗口内的单次跟进记录，形成跨事件结论、改进方向与待补问。',
          draft: { body: '修订稿：补充「只有 1 条单次记录时不重复归纳」的判定示例；推测统一使用「可能」「建议准备」表述，不写成已确认事实。', savedAt: '2026-09-15 15:20', savedBy: 'U-1002' }
        },
        blockGeneration: { label: '客户块生成', purpose: '按七栏固定结构生成客户块；必需栏目不可信时记为失败，不输出半成品。', draft: null },
        overviewGeneration: { label: '今日总览生成', purpose: '汇总六类当日经营变化；不含客户优先级排名与下一步动作。', draft: null }
      },
      versions: [
        {
          id: 'M072-v2', status: 'active', loaded: true, publishedBy: 'U-1002', publishedAt: '2026-09-14 17:40', effectiveFrom: '2026-09-15',
          prompts: {
            changeDetection: '读取报告窗口内已完成的客户变化与单次行为记录：新增、更新、待确认、冲突、缺失任一即为有效；未解决冲突算有效变化；无净变化且无可归纳行为的客户不进入日报。',
            behaviorSummary: '汇总同一客户窗口内的单次跟进记录：只有形成跨事件新结论时才输出当日归纳；单条记录或与当日结论相同时不重复归纳；行为评价不写入客户事实。',
            blockGeneration: '按七栏固定结构生成客户块：当前状态、今日关键变化、变化影响、待确认与待补信息、当日行为归纳、方案协同事项、依据与客户空间入口；每栏最多 3 条；必需栏目不可信时记为失败，不输出半成品。',
            overviewGeneration: '汇总六类当日经营变化：有效客户数、关键进展、新增升级风险、待确认、方案协同客户、跨客户行为模式；每类最多 3 条；跨客户模式需至少出现在 2 个客户空间；不含优先级排名与下一步动作。'
          }
        },
        {
          id: 'M072-v1', status: 'superseded', loaded: true, publishedBy: 'U-1003', publishedAt: '2026-09-08 10:20', effectiveFrom: '2026-09-09',
          prompts: {
            changeDetection: '首版有效变化判断口径：窗口内有完成变化即进入日报。',
            behaviorSummary: '首版当日行为归纳口径：逐条摘要合并。',
            blockGeneration: '首版客户块口径：固定栏目输出。',
            overviewGeneration: '首版今日总览口径：按客户罗列当日变化。'
          }
        }
      ],
      publishLog: [
        { at: '2026-09-14 17:40', by: 'U-1002', action: 'publish', version: 'M072-v2', effectiveFrom: '2026-09-15' },
        { at: '2026-09-08 10:20', by: 'U-1003', action: 'publish', version: 'M072-v1', effectiveFrom: '2026-09-09' }
      ],
      trialRuns: [
        {
          id: 'DTR-1', at: '2026-09-14 16:10', by: 'U-1002', window: '2026-09-12 18:30 → 2026-09-13 18:30', spaces: ['WS-201', 'WS-202'],
          steps: {
            changeDetection: { draft: '无草稿，沿用生效版', current: 'M072-v1 生效版：有效 2 个客户（星辰科技、远山物流）' },
            behaviorSummary: { draft: '无草稿，沿用生效版', current: 'M072-v1 生效版：星辰科技 1 条单次记录，不重复归纳' },
            blockGeneration: { draft: '无草稿，沿用生效版', current: 'M072-v1 生效版：生成客户块 2 个，七栏齐全' },
            overviewGeneration: { draft: '无草稿，沿用生效版', current: 'M072-v1 生效版：六类总览各 ≤3 条' }
          }
        }
      ]
    };
  }

  /** 统一补齐客户块七栏结构，兼容旧演示快照；缺失栏目按空数组处理，页面显示「本时段无新增」。 */
  function normalizeDailyBlock(block, index) {
    const item = block || {};
    const sections = item.sections && typeof item.sections === 'object' ? item.sections : {};
    const list = value => Array.isArray(value) ? value : [];
    return {
      ...item,
      id: item.id || `DRB-${index + 1}`,
      space: item.space || '', customerId: item.customerId || '', customer: item.customer || '', sales: item.sales || '',
      status: ['success', 'partial', 'failed'].includes(item.status) ? item.status : 'success',
      frozen: Boolean(item.frozen), frozenAt: item.frozenAt || '',
      lastResultAt: item.lastResultAt || '', missingNote: String(item.missingNote || ''), failReason: String(item.failReason || ''),
      sections: {
        current: String(sections.current || ''),
        keyChanges: list(sections.keyChanges), impact: list(sections.impact), pending: list(sections.pending),
        behavior: list(sections.behavior), collaboration: list(sections.collaboration), sources: list(sections.sources)
      },
      behaviorSummaryWritten: Boolean(item.behaviorSummaryWritten)
    };
  }

  /** 统一补齐日报快照字段；status 非法时按 empty 处理，避免旧快照读出未知状态。 */
  function normalizeDailyReport(report, index) {
    const item = report || {};
    const list = value => Array.isArray(value) ? value : [];
    return {
      ...item,
      id: item.id || `DR-${index + 1}`,
      reportDate: item.reportDate || '',
      windowStart: item.windowStart || '', windowEnd: item.windowEnd || '',
      startedAt: item.startedAt || '', completedAt: item.completedAt || '', inputCutoff: item.inputCutoff || '',
      promptVersion: String(item.promptVersion || ''),
      status: ['success', 'partial', 'failed', 'empty'].includes(item.status) ? item.status : 'empty',
      stats: item.stats && typeof item.stats === 'object' ? { candidates: Number(item.stats.candidates || 0), effective: Number(item.stats.effective || 0), failed: Number(item.stats.failed || 0), excluded: Number(item.stats.excluded || 0) } : { candidates: 0, effective: 0, failed: 0, excluded: 0 },
      overview: item.overview && typeof item.overview === 'object' ? item.overview : null,
      blocks: list(item.blocks).map(normalizeDailyBlock),
      failedCustomers: list(item.failedCustomers),
      previousFailures: list(item.previousFailures),
      excluded: list(item.excluded),
      carriedOver: list(item.carriedOver),
      recipients: list(item.recipients),
      runLog: list(item.runLog)
    };
  }

  /** 旧快照没有日报配置时补完整演示数据；有部分字段时只补缺口，四份提示词 key 固定。 */
  function normalizeDailyReportConfig(raw) {
    const demo = demoDailyReportConfig();
    const value = raw && typeof raw === 'object' ? raw : null;
    if (!value) return demo;
    const prompts = {};
    ['changeDetection', 'behaviorSummary', 'blockGeneration', 'overviewGeneration'].forEach(key => {
      const prompt = value.prompts && typeof value.prompts === 'object' ? value.prompts[key] : null;
      prompts[key] = {
        label: prompt?.label || demo.prompts[key].label,
        purpose: prompt?.purpose || demo.prompts[key].purpose,
        draft: prompt?.draft && typeof prompt.draft === 'object' ? prompt.draft : null
      };
    });
    return {
      globalTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value.globalTime || '')) ? value.globalTime : '18:30',
      timeUpdatedBy: value.timeUpdatedBy || '', timeUpdatedAt: value.timeUpdatedAt || '', timeEffectiveFrom: value.timeEffectiveFrom || '',
      prompts,
      versions: Array.isArray(value.versions) ? value.versions : demo.versions,
      publishLog: Array.isArray(value.publishLog) ? value.publishLog : [],
      trialRuns: Array.isArray(value.trialRuns) ? value.trialRuns : []
    };
  }

  /* ---------- R16 AI 文档与能力可运营化（种子与补齐） ---------- */

  /**
   * 实际文档内容指纹：只覆盖进入助手文档的内容（章节标题与正文、模块填写内容、skill 引用与停用标记）。
   * 模块名称与填写说明不参与指纹——它们是管理用信息，不进入实际文档，改动也不需要重新验证。
   */
  function aiDocFingerprint(sections, modules) {
    const text = JSON.stringify({
      sections: (sections || []).map(s => [s.title, s.body]),
      modules: (modules || []).map(m => [m.id, m.content, (m.skillRefs || []).map(r => [r.skillId, r.version, r.scenario]), !!m.disabled])
    });
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return 'fp-' + hash.toString(36);
  }

  /**
   * R16 演示数据，覆盖需求要求的全部可复核分支：
   * DOC-A 销售场景指引：已接管、含授权模块（价格沟通，运营已填写并引用可用 skill）、v3 已发布且 3 名目标销售全部已加载已生效、一轮 passed 验证留痕；
   * DOC-B 方案推荐指引：已接管、v3 历史发布含 U-1008 失败（可重试）与 U-1005 已送达未加载（继续使用 v2）、草稿 v4 已验证待发布；
   * DOC-C 话术库索引：未接管回传文档，只读 + 差异提示，不进入同步；
   * DOC-D 身份文档：回传版本晚于本地（remote_newer），本地未发布草稿保留待人工核对；
   * skills 三条覆盖 可用 / 不可用 / 暂无法核实 三态；另有一轮 verdict=adjust 的历史验证。
   */
  function demoAiDocs() {
    // DOC-A 各版本快照：v1 接管基线（无模块），v2 场景指引初版，v3 补充价格沟通模块与同行案例引用。
    const docASections = [
      { id: 'SEC-A1', title: '沟通原则', body: '优先引用客户空间内已确认的事实；不确定时说明缺少的信息，不推测、不承诺。' },
      { id: 'SEC-A2', title: '场景指引', body: '客户询问同行案例时，先确认行业与业务规模，再给出可核实的案例来源。' }
    ];
    const docAModules = [
      { id: 'MOD-A1', sectionId: 'SEC-A2', name: '价格沟通', instruction: '填写说明原文：补充客户觉得价格偏高时的处理场景与可用话术方向。', assigneeRole: 'MGR', assignees: ['U-1002', 'U-1003'], content: '客户认为价格偏高时，先对齐业务量与验收口径，再给同行案例与分阶段报价建议。', updatedBy: 'U-1002', updatedAt: '2026-09-13 16:40', skillRefs: [{ skillId: 'SK-1', version: 'v1.4.0', scenario: '客户要求参考同行案例或横向对比时调用' }], disabled: false },
      { id: 'MOD-A2', sectionId: 'SEC-A2', name: '合规话术兜底', instruction: '填写说明：合规敏感场景的兜底口径，仅指定运营维护。', assigneeRole: 'MGR', assignees: ['U-1003'], content: '', updatedBy: '', updatedAt: '', skillRefs: [], disabled: false }
    ];
    const docAV2Modules = [
      { id: 'MOD-A1', sectionId: 'SEC-A2', name: '价格沟通', instruction: '填写说明原文：补充客户觉得价格偏高时的处理场景与可用话术方向。', assigneeRole: 'MGR', assignees: ['U-1002', 'U-1003'], content: '客户认为价格偏高时，先对齐业务量，再给报价建议。', updatedBy: 'U-1002', updatedAt: '2026-09-07 15:10', skillRefs: [], disabled: false },
      { id: 'MOD-A2', sectionId: 'SEC-A2', name: '合规话术兜底', instruction: '填写说明：合规敏感场景的兜底口径，仅指定运营维护。', assigneeRole: 'MGR', assignees: ['U-1003'], content: '', updatedBy: '', updatedAt: '', skillRefs: [], disabled: false }
    ];
    const docAV1Sections = [{ id: 'SEC-A1', title: '沟通原则', body: '优先引用客户空间内已确认的事实；不确定时说明缺少的信息。' }];
    // DOC-B：v2 为全员最近成功加载版本；v3 发布时 U-1008 失败、U-1005 未加载；草稿 v4 已通过验证待发布。
    const docBSections = [
      { id: 'SEC-B1', title: '推荐原则', body: '方案推荐以已确权商机与客户空间事实为依据，不推荐无权产品。' },
      { id: 'SEC-B2', title: '方案场景', body: '客户询问方案与交付时，先明确业务场景，再给素材或链接。' }
    ];
    const docBModules = [
      { id: 'MOD-B1', sectionId: 'SEC-B2', name: '交付范围说明', instruction: '填写说明：补充客户询问交付范围与报价区间时的口径。', assigneeRole: 'MGR', assignees: ['U-1002', 'U-1003'], content: '客户询问交付范围时，按已确权商机的产品清单说明，并提示以合同为准。', updatedBy: 'U-1002', updatedAt: '2026-09-11 17:20', skillRefs: [{ skillId: 'SK-2', version: 'v0.9.2', scenario: '客户询问报价区间或交付周期测算时调用' }], disabled: false }
    ];
    const docBV2Modules = [
      { id: 'MOD-B1', sectionId: 'SEC-B2', name: '交付范围说明', instruction: '填写说明：补充客户询问交付范围与报价区间时的口径。', assigneeRole: 'MGR', assignees: ['U-1002', 'U-1003'], content: '客户询问交付范围时，以合同清单为准。', updatedBy: 'U-1003', updatedAt: '2026-09-04 16:00', skillRefs: [], disabled: false }
    ];
    const docBDraftSections = [
      { id: 'SEC-B1', title: '推荐原则', body: '方案推荐以已确权商机与客户空间事实为依据，不推荐无权产品。' },
      { id: 'SEC-B2', title: '方案场景', body: '客户询问方案与交付时，先明确业务场景，再给素材或链接。' }
    ];
    const docBDraftModules = [
      { id: 'MOD-B1', sectionId: 'SEC-B2', name: '交付范围说明', instruction: '填写说明：补充客户询问交付范围与报价区间时的口径。', assigneeRole: 'MGR', assignees: ['U-1002', 'U-1003'], content: '客户询问交付范围时，先按已确权商机的产品清单说明，再给出分阶段交付建议，并以合同为准。', updatedBy: 'U-1002', updatedAt: '2026-09-15 09:20', skillRefs: [{ skillId: 'SK-2', version: 'v0.9.2', scenario: '客户询问报价区间或交付周期测算时调用' }], disabled: false }
    ];
    const docBDraftFingerprint = aiDocFingerprint(docBDraftSections, docBDraftModules);
    // DOC-D：本地 v3 + 未发布草稿；回传 v4 更晚，形成 remote_newer 冲突待人工核对。
    const docDSections = [{ id: 'SEC-D1', title: '身份与边界', body: '你是销售的跟进助手，只读客户空间事实，不代发消息、不代回方案。' }];
    const docDDraftSections = [{ id: 'SEC-D1', title: '身份与边界', body: '你是销售的跟进助手，只读客户空间事实，不代发消息、不代回方案；App 与飞书共用同一边界。' }];
    return {
      documents: [
        {
          id: 'DOC-A', name: '销售场景指引', file: 'SOUL.md', scope: 'global', sales: '',
          managed: true, managedAt: '2026-09-02 10:00', managedBy: 'U-1001',
          remote: { version: 'v3', at: '2026-09-14 09:30', body: '## 沟通原则\n优先引用客户空间内已确认的事实；不确定时说明缺少的信息，不推测、不承诺。\n\n## 场景指引\n客户询问同行案例时，先确认行业与业务规模，再给出可核实的案例来源。' },
          sections: docASections, modules: docAModules, draft: null,
          versions: [
            { id: 'VER-A3', version: 'v3', at: '2026-09-14 10:05', by: 'U-1001', byRole: 'ADM', kind: 'sync', note: '价格沟通模块补充同行案例引用与场景说明', validationId: 'VAL-A3', syncId: 'REL-A3', snapshot: { sections: copy(docASections), modules: copy(docAModules) } },
            { id: 'VER-A2', version: 'v2', at: '2026-09-08 11:20', by: 'U-1001', byRole: 'ADM', kind: 'sync', note: '场景指引章节初版，价格沟通模块由运营填写', validationId: 'VAL-A2', syncId: 'REL-A2', snapshot: { sections: copy(docASections), modules: copy(docAV2Modules) } },
            { id: 'VER-A1', version: 'v1', at: '2026-09-02 10:00', by: 'U-1001', byRole: 'ADM', kind: 'sync', note: '接管 OpenClaw 回传，以回传内容为本地基线', validationId: '', syncId: '', snapshot: { sections: copy(docAV1Sections), modules: [] } }
          ],
          targets: ['U-1004', 'U-1005', 'U-1008'], conflict: ''
        },
        {
          id: 'DOC-B', name: '方案推荐指引', file: 'PLAYS.md', scope: 'global', sales: '',
          managed: true, managedAt: '2026-09-01 15:00', managedBy: 'U-1001',
          remote: { version: 'v3', at: '2026-09-12 09:00', body: '## 推荐原则\n方案推荐以已确权商机与客户空间事实为依据，不推荐无权产品。\n\n## 方案场景\n客户询问方案与交付时，先明确业务场景，再给素材或链接。' },
          sections: docBSections, modules: docBModules,
          draft: { baseVersion: 'v3', version: 'v4', kind: 'edit', restoreFrom: '', restoreFromVersion: '', sections: docBDraftSections, modules: docBDraftModules, updatedBy: 'U-1002', updatedAt: '2026-09-15 09:20', fingerprint: docBDraftFingerprint },
          versions: [
            { id: 'VER-B3', version: 'v3', at: '2026-09-12 11:30', by: 'U-1002', byRole: 'MGR', kind: 'sync', note: '交付范围说明引用报价测算器', validationId: 'VAL-B3', syncId: 'REL-B3', snapshot: { sections: copy(docBSections), modules: copy(docBModules) } },
            { id: 'VER-B2', version: 'v2', at: '2026-09-05 10:40', by: 'U-1002', byRole: 'MGR', kind: 'sync', note: '交付范围说明初版', validationId: 'VAL-B2', syncId: 'REL-B2', snapshot: { sections: copy(docBSections), modules: copy(docBV2Modules) } },
            { id: 'VER-B1', version: 'v1', at: '2026-09-01 15:00', by: 'U-1001', byRole: 'ADM', kind: 'sync', note: '接管 OpenClaw 回传，以回传内容为本地基线', validationId: '', syncId: '', snapshot: { sections: [{ id: 'SEC-B1', title: '推荐原则', body: '方案推荐以已确权商机为依据。' }], modules: [] } }
          ],
          targets: ['U-1004', 'U-1005', 'U-1008'], conflict: ''
        },
        {
          id: 'DOC-C', name: '话术库索引', file: 'TALKTRACK.md', scope: 'sales', sales: 'U-1005',
          managed: false, managedAt: '', managedBy: '',
          remote: { version: 'v5', at: '2026-09-15 07:40', body: '## 话术索引\n价格异议：先确认业务量与验收口径，再给同行案例。\n交付异议：以合同清单为准，不口头承诺。' },
          sections: [], modules: [], draft: null, versions: [], targets: [], conflict: ''
        },
        {
          id: 'DOC-D', name: '身份文档', file: 'IDENTITY.md', scope: 'global', sales: '',
          managed: true, managedAt: '2026-09-03 11:00', managedBy: 'U-1001',
          remote: { version: 'v4', at: '2026-09-15 08:10', body: '## 身份与边界\n你是销售的跟进助手，只读客户空间事实，不代发消息、不代回方案；飞书侧会话沿用同一边界，并补充飞书消息格式说明。' },
          sections: docDSections,
          modules: [],
          draft: { baseVersion: 'v3', version: 'v4', kind: 'edit', restoreFrom: '', restoreFromVersion: '', sections: docDDraftSections, modules: [], updatedBy: 'U-1001', updatedAt: '2026-09-14 18:30', fingerprint: aiDocFingerprint(docDDraftSections, []) },
          versions: [
            { id: 'VER-D3', version: 'v3', at: '2026-09-11 10:00', by: 'U-1001', byRole: 'ADM', kind: 'sync', note: '明确不代回方案的边界', validationId: 'VAL-D3', syncId: '', snapshot: { sections: copy(docDSections), modules: [] } },
            { id: 'VER-D1', version: 'v1', at: '2026-09-03 11:00', by: 'U-1001', byRole: 'ADM', kind: 'sync', note: '接管 OpenClaw 回传，以回传内容为本地基线', validationId: '', syncId: '', snapshot: { sections: [{ id: 'SEC-D1', title: '身份与边界', body: '你是销售的跟进助手。' }], modules: [] } }
          ],
          targets: ['U-1004', 'U-1005', 'U-1008'], conflict: 'remote_newer'
        }
      ],
      skills: [
        { id: 'SK-1', name: '同行案例库', type: 'skill', version: 'v1.4.0', status: 'available', purpose: '按行业与场景检索可复用的同行案例。', manageUrl: 'https://skillhub.example.com/skills/peer-cases', updatedAt: '2026-09-10 14:00' },
        { id: 'SK-2', name: '报价测算器', type: 'skill', version: 'v0.9.2', status: 'unavailable', purpose: '按业务量与峰值测算报价区间。', manageUrl: 'https://skillhub.example.com/skills/quote-calc', updatedAt: '2026-09-14 18:20' },
        { id: 'SK-3', name: '异议处理话术素材', type: '素材', version: 'v2.1', status: 'unknown', purpose: '常见价格与交付异议的话术素材包。', manageUrl: 'https://skillhub.example.com/assets/objection-pack', updatedAt: '2026-09-15 08:00' }
      ],
      validations: [
        {
          id: 'VAL-B4', docId: 'DOC-B', version: 'v4', fingerprint: docBDraftFingerprint, skillVersions: { 'SK-2': 'v0.9.2' },
          changeSummary: '填写模块「交付范围说明」内容更新',
          questions: [
            { id: 'Q-1', question: '客户问「这个阶段交付范围是什么」时，助手应如何回应？', changeRef: '填写模块「交付范围说明」内容更新', observe: '是否先按已确权商机的产品清单说明，再提示以合同为准', skillId: '', answer: '演示回答（沙盒 SES-B4 · 只读）：先按已确权商机的产品清单说明交付范围，再给分阶段交付建议，并提示以合同为准。', sources: ['客户空间 WS-201 跟进记录（只读）'], calls: [], result: 'pass', note: '符合预期。', answeredAt: '2026-09-15 09:32', judgedBy: 'U-1002', judgedAt: '2026-09-15 09:35' },
            { id: 'Q-2', question: '客户追问报价区间时，助手是否调用报价测算器并说明来源？', changeRef: '模块「交付范围说明」引用 skill「报价测算器」', observe: '调用情况与来源说明；skill 不可用时应如实说明', skillId: 'SK-2', answer: '演示回答（沙盒 SES-B4 · 只读）：报价测算器当前不可用，助手如实说明并给出人工测算入口。', sources: ['外部 SkillHub 状态（只读）'], calls: [{ skillId: 'SK-2', name: '报价测算器', version: 'v0.9.2', result: 'unavailable' }], result: 'pass', note: '不可用说明符合预期。', answeredAt: '2026-09-15 09:33', judgedBy: 'U-1002', judgedAt: '2026-09-15 09:36' }
          ],
          session: { id: 'SES-B4', at: '2026-09-15 09:30', operator: 'U-1002', readonly: true },
          verdict: 'passed', startedBy: 'U-1002', startedAt: '2026-09-15 09:30', finishedAt: '2026-09-15 09:36', finishedBy: 'U-1002'
        },
        {
          id: 'VAL-A3', docId: 'DOC-A', version: 'v3', fingerprint: aiDocFingerprint(docASections, docAModules), skillVersions: { 'SK-1': 'v1.4.0' },
          changeSummary: '填写模块「价格沟通」内容更新；新增 skill 引用「同行案例库」',
          questions: [
            { id: 'Q-1', question: '客户说「你们比别家贵」时，助手应如何回应？', changeRef: '填写模块「价格沟通」内容更新', observe: '是否先对齐业务量与验收口径，再给案例与分阶段报价建议', skillId: '', answer: '演示回答（沙盒 SES-A3 · 只读）：先确认客户业务量与验收口径，再引用同行案例库给出可比案例。', sources: ['客户空间 WS-201 跟进记录（只读）'], calls: [{ skillId: 'SK-1', name: '同行案例库', version: 'v1.4.0', result: 'success' }], result: 'pass', note: '符合预期。', answeredAt: '2026-09-14 09:52', judgedBy: 'U-1001', judgedAt: '2026-09-14 09:55' },
            { id: 'Q-2', question: '客户要求参考同行案例时，助手是否调用同行案例库并给出来源？', changeRef: '模块「价格沟通」新增 skill 引用「同行案例库」', observe: '调用情况与来源说明', skillId: 'SK-1', answer: '演示回答（沙盒 SES-A3 · 只读）：调用同行案例库返回 2 条同行业案例并标注来源。', sources: ['同行案例库 v1.4.0'], calls: [{ skillId: 'SK-1', name: '同行案例库', version: 'v1.4.0', result: 'success' }], result: 'pass', note: '', answeredAt: '2026-09-14 09:53', judgedBy: 'U-1001', judgedAt: '2026-09-14 09:56' }
          ],
          session: { id: 'SES-A3', at: '2026-09-14 09:50', operator: 'U-1001', readonly: true },
          verdict: 'passed', startedBy: 'U-1001', startedAt: '2026-09-14 09:50', finishedAt: '2026-09-14 09:56', finishedBy: 'U-1001'
        },
        {
          id: 'VAL-A2', docId: 'DOC-A', version: 'v2', fingerprint: aiDocFingerprint(docASections, docAV2Modules), skillVersions: {},
          changeSummary: '填写模块「价格沟通」内容更新',
          questions: [
            { id: 'Q-1', question: '客户觉得价格偏高时，助手应如何回应？', changeRef: '填写模块「价格沟通」内容更新', observe: '是否先对齐业务量再给报价建议', skillId: '', answer: '演示回答（沙盒 SES-A2 · 只读）：直接给出报价建议，未先对齐业务量。', sources: ['客户空间 WS-202 跟进记录（只读）'], calls: [], result: 'adjust', note: '场景说明不够具体，退回调整后重新验证。', answeredAt: '2026-09-08 10:50', judgedBy: 'U-1001', judgedAt: '2026-09-08 10:58' }
          ],
          session: { id: 'SES-A2', at: '2026-09-08 10:45', operator: 'U-1001', readonly: true },
          verdict: 'adjust', startedBy: 'U-1001', startedAt: '2026-09-08 10:45', finishedAt: '2026-09-08 10:58', finishedBy: 'U-1001'
        }
      ],
      releases: [
        {
          id: 'REL-B3', docId: 'DOC-B', version: 'v3', by: 'U-1002', at: '2026-09-12 11:30',
          targets: [
            { sales: 'U-1004', deliver: 'success', loaded: true, loadedVersion: 'v3', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1005', deliver: 'success', loaded: false, loadedVersion: 'v2', effective: false, reason: '已送达，销售尚未开启新会话；继续使用 v2。', retryCount: 0 },
            { sales: 'U-1008', deliver: 'failed', loaded: false, loadedVersion: 'v2', effective: false, reason: 'OpenClaw 网关连接超时，未送达。', retryCount: 1 }
          ]
        },
        {
          id: 'REL-A3', docId: 'DOC-A', version: 'v3', by: 'U-1001', at: '2026-09-14 10:05',
          targets: [
            { sales: 'U-1004', deliver: 'success', loaded: true, loadedVersion: 'v3', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1005', deliver: 'success', loaded: true, loadedVersion: 'v3', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1008', deliver: 'success', loaded: true, loadedVersion: 'v3', effective: true, reason: '', retryCount: 0 }
          ]
        },
        {
          id: 'REL-A2', docId: 'DOC-A', version: 'v2', by: 'U-1001', at: '2026-09-08 11:20',
          targets: [
            { sales: 'U-1004', deliver: 'success', loaded: true, loadedVersion: 'v2', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1005', deliver: 'success', loaded: true, loadedVersion: 'v2', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1008', deliver: 'success', loaded: true, loadedVersion: 'v2', effective: true, reason: '', retryCount: 0 }
          ]
        },
        {
          id: 'REL-B2', docId: 'DOC-B', version: 'v2', by: 'U-1002', at: '2026-09-05 10:40',
          targets: [
            { sales: 'U-1004', deliver: 'success', loaded: true, loadedVersion: 'v2', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1005', deliver: 'success', loaded: true, loadedVersion: 'v2', effective: true, reason: '', retryCount: 0 },
            { sales: 'U-1008', deliver: 'success', loaded: true, loadedVersion: 'v2', effective: true, reason: '', retryCount: 0 }
          ]
        }
      ]
    };
  }

  /** 统一补齐填写模块字段，兼容旧演示快照；skillRefs 缺省为空数组。 */
  function normalizeAiDocModule(item, index) {
    const m = item || {};
    return {
      ...m,
      id: m.id || `MOD-${index + 1}`,
      sectionId: m.sectionId || '',
      name: String(m.name || '未命名模块'),
      instruction: String(m.instruction || ''),
      assigneeRole: m.assigneeRole || 'MGR',
      assignees: Array.isArray(m.assignees) ? m.assignees : [],
      content: String(m.content || ''),
      updatedBy: m.updatedBy || '',
      updatedAt: m.updatedAt || '',
      skillRefs: (Array.isArray(m.skillRefs) ? m.skillRefs : []).map(ref => ({ skillId: ref?.skillId || '', version: ref?.version || '', scenario: String(ref?.scenario || '') })),
      disabled: Boolean(m.disabled)
    };
  }

  /** 统一补齐文档字段；draft 缺失视为无草稿，conflict 只认 remote_newer。 */
  function normalizeAiDocDocument(item, index) {
    const d = item || {};
    const list = value => Array.isArray(value) ? value : [];
    const sections = list(d.sections).map((s, i) => ({ id: s?.id || `SEC-${index + 1}-${i + 1}`, title: String(s?.title || ''), body: String(s?.body || '') }));
    const draft = d.draft && typeof d.draft === 'object' ? {
      baseVersion: d.draft.baseVersion || '',
      version: d.draft.version || '',
      kind: d.draft.kind === 'restore' ? 'restore' : 'edit',
      restoreFrom: d.draft.restoreFrom || '',
      restoreFromVersion: d.draft.restoreFromVersion || '',
      sections: list(d.draft.sections).map((s, i) => ({ id: s?.id || `SEC-D${index + 1}-${i + 1}`, title: String(s?.title || ''), body: String(s?.body || '') })),
      modules: list(d.draft.modules).map(normalizeAiDocModule),
      updatedBy: d.draft.updatedBy || '',
      updatedAt: d.draft.updatedAt || '',
      fingerprint: String(d.draft.fingerprint || '')
    } : null;
    return {
      ...d,
      id: d.id || `DOC-X${index + 1}`,
      name: String(d.name || '未命名文档'),
      file: String(d.file || ''),
      scope: d.scope === 'sales' ? 'sales' : 'global',
      sales: d.sales || '',
      managed: Boolean(d.managed),
      managedAt: d.managedAt || '',
      managedBy: d.managedBy || '',
      remote: d.remote && typeof d.remote === 'object' ? { version: d.remote.version || '', at: d.remote.at || '', body: String(d.remote.body || '') } : { version: '', at: '', body: '' },
      sections,
      modules: list(d.modules).map(normalizeAiDocModule),
      draft,
      versions: list(d.versions).map((v, i) => ({
        ...v,
        id: v?.id || `VER-${index + 1}-${i + 1}`,
        version: v?.version || '',
        at: v?.at || '',
        by: v?.by || '',
        byRole: v?.byRole || '',
        kind: ['edit', 'restore', 'sync'].includes(v?.kind) ? v.kind : 'sync',
        note: String(v?.note || ''),
        validationId: v?.validationId || '',
        syncId: v?.syncId || '',
        snapshot: v?.snapshot && typeof v.snapshot === 'object' ? v.snapshot : null
      })),
      targets: list(d.targets),
      conflict: d.conflict === 'remote_newer' ? 'remote_newer' : ''
    };
  }

  /** 旧快照没有 aiDocs 子模型时补完整演示数据；有部分字段时只补缺口，不回填被测试清空的数组。 */
  function normalizeAiDocs(raw) {
    const demo = demoAiDocs();
    const value = raw && typeof raw === 'object' ? raw : null;
    if (!value) return demo;
    return {
      documents: Array.isArray(value.documents) ? value.documents.map(normalizeAiDocDocument) : demo.documents,
      skills: (Array.isArray(value.skills) ? value.skills : demo.skills).map((s, i) => ({
        id: s?.id || `SK-${i + 1}`,
        name: String(s?.name || '未命名能力'),
        type: s?.type === '素材' ? '素材' : 'skill',
        version: String(s?.version || 'v1.0'),
        status: ['available', 'unavailable', 'unknown'].includes(s?.status) ? s.status : 'unknown',
        purpose: String(s?.purpose || ''),
        manageUrl: String(s?.manageUrl || ''),
        updatedAt: s?.updatedAt || ''
      })),
      validations: (Array.isArray(value.validations) ? value.validations : []).map((v, i) => ({
        ...v,
        id: v?.id || `VAL-${i + 1}`,
        docId: v?.docId || '',
        version: v?.version || '',
        fingerprint: String(v?.fingerprint || ''),
        skillVersions: v?.skillVersions && typeof v.skillVersions === 'object' ? v.skillVersions : {},
        changeSummary: String(v?.changeSummary || ''),
        questions: (Array.isArray(v?.questions) ? v.questions : []).map((q, qi) => ({ ...q, id: q?.id || `Q-${qi + 1}`, question: String(q?.question || ''), changeRef: String(q?.changeRef || ''), observe: String(q?.observe || ''), answer: String(q?.answer || ''), sources: Array.isArray(q?.sources) ? q.sources : [], calls: Array.isArray(q?.calls) ? q.calls : [], result: ['pass', 'fail', 'adjust'].includes(q?.result) ? q.result : '', note: String(q?.note || '') })),
        session: v?.session && typeof v.session === 'object' ? { readonly: true, ...v.session } : { id: '', at: '', operator: '', readonly: true },
        verdict: ['pending', 'passed', 'failed', 'adjust', 'stale'].includes(v?.verdict) ? v.verdict : 'pending'
      })),
      releases: (Array.isArray(value.releases) ? value.releases : []).map((r, i) => ({
        ...r,
        id: r?.id || `REL-${i + 1}`,
        docId: r?.docId || '',
        version: r?.version || '',
        by: r?.by || '',
        at: r?.at || '',
        targets: (Array.isArray(r?.targets) ? r.targets : []).map(t => ({
          sales: t?.sales || '',
          deliver: ['syncing', 'success', 'failed'].includes(t?.deliver) ? t.deliver : 'syncing',
          loaded: Boolean(t?.loaded),
          loadedVersion: t?.loadedVersion || '',
          effective: Boolean(t?.effective),
          reason: String(t?.reason || ''),
          retryCount: Number(t?.retryCount || 0)
        }))
      }))
    };
  }

  /* ---------- R17 销售目标与进度：目标、DataHub 收入成本与取数异常 ---------- */

  /**
   * R17 目标样例：覆盖全员/个人 × 流水/毛利、调整留痕、重叠区间、零目标、
   * 未开始区间、已结束区间、无目标有达成（U-1006）与个人之和 ≠ 全员（差异提示）全部分支。
   * 当前值原地更新，历史只追加进 adjustments，满足「不覆盖、可回看」。
   */
  function demoGoals() {
    return [
      { id: 'GT-1', level: 'all', metric: 'revenue', sales: '', value: 6000000, start: '2026-09-01', end: '2026-10-15', createdBy: 'U-1002', createdAt: '2026-09-01 09:00', adjustments: [] },
      { id: 'GT-2', level: 'all', metric: 'profit', sales: '', value: 1800000, start: '2026-09-01', end: '2026-10-15', createdBy: 'U-1002', createdAt: '2026-09-01 09:00', adjustments: [] },
      { id: 'GT-3', level: 'personal', metric: 'revenue', sales: 'U-1004', value: 2000000, start: '2026-09-01', end: '2026-10-15', createdBy: 'U-1002', createdAt: '2026-09-01 09:20', adjustments: [] },
      // 毛利目标带一次调整留痕：50 万 → 60 万，历史快照保留在 adjustments。
      { id: 'GT-4', level: 'personal', metric: 'profit', sales: 'U-1004', value: 600000, start: '2026-09-01', end: '2026-10-15', createdBy: 'U-1002', createdAt: '2026-09-01 09:20', adjustments: [
        { at: '2026-09-08 10:20', actor: 'U-1002', before: { value: 500000, start: '2026-09-01', end: '2026-10-15' }, after: { value: 600000, start: '2026-09-01', end: '2026-10-15' }, reason: '9 月新签 pipeline 高于预期，毛利目标上调 10 万。' }
      ] },
      // 与 GT-3 同销售同指标且区间相交：允许保存，列表提示重叠。
      { id: 'GT-5', level: 'personal', metric: 'revenue', sales: 'U-1004', value: 500000, start: '2026-09-10', end: '2026-09-30', createdBy: 'U-1002', createdAt: '2026-09-10 11:00', adjustments: [] },
      // U-1005 只有流水目标，毛利指标保持「未设置」。
      { id: 'GT-6', level: 'personal', metric: 'revenue', sales: 'U-1005', value: 1200000, start: '2026-09-01', end: '2026-10-15', createdBy: 'U-1002', createdAt: '2026-09-01 09:25', adjustments: [] },
      // 零目标：明确设零，与「未设置」区分，不计算进度。
      { id: 'GT-7', level: 'personal', metric: 'profit', sales: 'U-1008', value: 0, start: '2026-09-01', end: '2026-10-15', createdBy: 'U-1002', createdAt: '2026-09-01 09:30', adjustments: [] },
      // 尚未开始区间：保存成功，进度为零并标注。
      { id: 'GT-8', level: 'personal', metric: 'revenue', sales: 'U-1013', value: 300000, start: '2026-10-01', end: '2026-10-31', createdBy: 'U-1002', createdAt: '2026-09-12 15:00', adjustments: [] },
      // 已结束区间：保留可回看，进度定格。
      { id: 'GT-9', level: 'personal', metric: 'revenue', sales: 'U-1014', value: 400000, start: '2026-08-01', end: '2026-08-31', createdBy: 'U-1002', createdAt: '2026-08-01 09:00', adjustments: [] }
    ];
  }

  /**
   * R17 DataHub 标准收入表样例：salesId 是「跟进人 → 本地销售」的对应结果，空表示未归属。
   * 覆盖：区间内已归属多条、区间外一条（RV-6）、跟进人为空（RV-8）、跟进人无法对应（RV-9）、
   * 缺收入结算时间（RV-10）、同指纹重复行（RV-11）、成本高于收入的负毛利行（RV-5）；
   * RV-2 带核减金额——本版流水不扣核减，口径待确认（待明确事项 7.4）。
   */
  function demoRevenueRows() {
    return [
      { id: 'RV-1', settledAmount: 800000, deductAmount: 0, settledAt: '2026-09-03 10:00', bookDate: '2026-09-03', follower: '付赞', salesId: 'U-1004', unattributedReason: '', customerName: '星辰科技有限公司', dimsKey: 'DIM-1', fingerprint: 'FP-RV-1', bizUpdatedAt: '2026-09-14 22:10' },
      { id: 'RV-2', settledAmount: 950000, deductAmount: 50000, settledAt: '2026-09-10 15:00', bookDate: '2026-09-10', follower: '付赞', salesId: 'U-1004', unattributedReason: '', customerName: '远山物流有限公司', dimsKey: 'DIM-2', fingerprint: 'FP-RV-2', bizUpdatedAt: '2026-09-14 22:10' },
      { id: 'RV-3', settledAmount: 600000, deductAmount: 0, settledAt: '2026-09-05 11:00', bookDate: '2026-09-05', follower: '张云飞', salesId: 'U-1005', unattributedReason: '', customerName: '启明教育科技有限公司', dimsKey: 'DIM-3', fingerprint: 'FP-RV-3', bizUpdatedAt: '2026-09-14 22:10' },
      { id: 'RV-4', settledAmount: 300000, deductAmount: 0, settledAt: '2026-09-08 14:00', bookDate: '2026-09-08', follower: '张忠超', salesId: 'U-1006', unattributedReason: '', customerName: '和光医疗科技有限公司', dimsKey: 'DIM-4', fingerprint: 'FP-RV-4', bizUpdatedAt: '2026-09-14 22:10' },
      // 成本高于收入的负毛利行：如实计入，不按零处理。
      { id: 'RV-5', settledAmount: 200000, deductAmount: 0, settledAt: '2026-09-06 09:30', bookDate: '2026-09-06', follower: '杨锐', salesId: 'U-1008', unattributedReason: '', customerName: '海川保险服务有限公司', dimsKey: 'DIM-5', fingerprint: 'FP-RV-5', bizUpdatedAt: '2026-09-14 22:10' },
      // 区间外收入：不计入 2026-09-01 ~ 2026-10-15 的任何目标。
      { id: 'RV-6', settledAmount: 120000, deductAmount: 0, settledAt: '2026-08-20 10:00', bookDate: '2026-08-20', follower: '付赞', salesId: 'U-1004', unattributedReason: '', customerName: '星辰科技有限公司', dimsKey: 'DIM-6', fingerprint: 'FP-RV-6', bizUpdatedAt: '2026-09-14 22:10' },
      // U-1014 已结束区间（8 月）的达成：进度定格用。
      { id: 'RV-7', settledAmount: 500000, deductAmount: 0, settledAt: '2026-08-15 10:00', bookDate: '2026-08-15', follower: '何明轩', salesId: 'U-1014', unattributedReason: '', customerName: '云桥数字科技有限公司', dimsKey: 'DIM-7', fingerprint: 'FP-RV-7', bizUpdatedAt: '2026-09-14 22:10' },
      // 未归属：跟进人为空，仍计入全员。
      { id: 'RV-8', settledAmount: 150000, deductAmount: 0, settledAt: '2026-09-07 10:00', bookDate: '2026-09-07', follower: '', salesId: '', unattributedReason: '跟进人为空', customerName: '澄海零售有限公司', dimsKey: 'DIM-8', fingerprint: 'FP-RV-8', bizUpdatedAt: '2026-09-14 22:10' },
      // 未归属：跟进人无法对应本地销售账号（与 R01 待对应人员同源样例）。
      { id: 'RV-9', settledAmount: 90000, deductAmount: 0, settledAt: '2026-09-09 16:00', bookDate: '2026-09-09', follower: '赵伟航', salesId: '', unattributedReason: '跟进人无法对应本地账号', customerName: '云桥数字科技有限公司', dimsKey: 'DIM-9', fingerprint: 'FP-RV-9', bizUpdatedAt: '2026-09-14 22:10' },
      // 缺收入结算时间：进入异常清单，不参与有效归集。
      { id: 'RV-10', settledAmount: 70000, deductAmount: 0, settledAt: '', bookDate: '2026-09-11', follower: '张云飞', salesId: 'U-1005', unattributedReason: '', customerName: '启明教育科技有限公司', dimsKey: 'DIM-10', fingerprint: 'FP-RV-10', bizUpdatedAt: '2026-09-14 22:10' },
      // 与 RV-2 同指纹的重复同步行：按数据指纹去重，只计第一次。
      { id: 'RV-11', settledAmount: 950000, deductAmount: 50000, settledAt: '2026-09-10 15:00', bookDate: '2026-09-10', follower: '付赞', salesId: 'U-1004', unattributedReason: '', customerName: '远山物流有限公司', dimsKey: 'DIM-2', fingerprint: 'FP-RV-2', bizUpdatedAt: '2026-09-15 05:40' }
    ];
  }

  /**
   * R17 DataHub 标准成本表样例：成本按配对维度匹配收入行并随收入归集（不按成本自己的记账日期）；
   * CS-9 配不上任何收入行，不计入毛利并进入异常清单。
   */
  function demoCostRows() {
    return [
      { id: 'CS-1', costAmount: 500000, costSettled: true, bookDate: '2026-09-03', follower: '付赞', customerName: '星辰科技有限公司', dimsKey: 'DIM-1', matchedRevenue: 'RV-1', fingerprint: 'FP-CS-1' },
      { id: 'CS-2', costAmount: 550000, costSettled: true, bookDate: '2026-09-10', follower: '付赞', customerName: '远山物流有限公司', dimsKey: 'DIM-2', matchedRevenue: 'RV-2', fingerprint: 'FP-CS-2' },
      { id: 'CS-3', costAmount: 400000, costSettled: true, bookDate: '2026-09-05', follower: '张云飞', customerName: '启明教育科技有限公司', dimsKey: 'DIM-3', matchedRevenue: 'RV-3', fingerprint: 'FP-CS-3' },
      { id: 'CS-4', costAmount: 180000, costSettled: true, bookDate: '2026-09-08', follower: '张忠超', customerName: '和光医疗科技有限公司', dimsKey: 'DIM-4', matchedRevenue: 'RV-4', fingerprint: 'FP-CS-4' },
      // 26 万成本高于 RV-5 的 20 万收入：单行毛利 -6 万，如实展示。
      { id: 'CS-5', costAmount: 260000, costSettled: true, bookDate: '2026-09-06', follower: '杨锐', customerName: '海川保险服务有限公司', dimsKey: 'DIM-5', matchedRevenue: 'RV-5', fingerprint: 'FP-CS-5' },
      { id: 'CS-6', costAmount: 80000, costSettled: true, bookDate: '2026-08-20', follower: '付赞', customerName: '星辰科技有限公司', dimsKey: 'DIM-6', matchedRevenue: 'RV-6', fingerprint: 'FP-CS-6' },
      { id: 'CS-7', costAmount: 250000, costSettled: true, bookDate: '2026-08-15', follower: '何明轩', customerName: '云桥数字科技有限公司', dimsKey: 'DIM-7', matchedRevenue: 'RV-7', fingerprint: 'FP-CS-7' },
      { id: 'CS-8', costAmount: 30000, costSettled: true, bookDate: '2026-09-07', follower: '', customerName: '澄海零售有限公司', dimsKey: 'DIM-8', matchedRevenue: 'RV-8', fingerprint: 'FP-CS-8' },
      // 配对维度找不到收入行：不计入毛利，单独标注待核对。
      { id: 'CS-9', costAmount: 45000, costSettled: true, bookDate: '2026-09-12', follower: '付赞', customerName: '星辰科技有限公司', dimsKey: 'DIM-X', matchedRevenue: '', fingerprint: 'FP-CS-9' }
    ];
  }

  /** R17 取数异常清单样例：成本未配对、时间缺失、重复去重各一条，不静默为零。 */
  function demoDatahubErrors() {
    return [
      { id: 'DHE-1', kind: 'cost_unmatched', ref: 'CS-9', reason: '成本行按配对维度找不到对应收入行，不计入毛利，待 DataHub 侧核对。', at: '2026-09-15 06:30' },
      { id: 'DHE-2', kind: 'missing_time', ref: 'RV-10', reason: '收入行缺少收入结算时间，不参与有效归集。', at: '2026-09-15 06:30' },
      { id: 'DHE-3', kind: 'duplicate', ref: 'RV-11', reason: '数据指纹与 RV-2 相同，视为同一条，不重复累加。', at: '2026-09-15 06:30' }
    ];
  }

  /**
   * R17 DataHub 收入成本同步状态与取数白名单。
   * 与 platform-data 页的「DataHub 演示批次」（客户数据治理）同名不同物，本域统一叫「DataHub 收入成本同步」。
   */
  function demoDatahub() {
    return {
      status: 'ok', lastSuccessAt: '2026-09-15 06:30', lastAttemptAt: '2026-09-15 06:30', failReason: '',
      whitelist: [
        { table: '标准收入表', field: '结算金额', purpose: '流水达成与毛利计算的收入项', used: true },
        { table: '标准收入表', field: '核减金额', purpose: '与结算金额的关系待确认（待明确事项 7.4），本版不从流水中扣除', used: false },
        { table: '标准收入表', field: '收入结算时间', purpose: '归集到目标区间的依据', used: true },
        { table: '标准收入表', field: '记账日期', purpose: '辅助核对与配对', used: true },
        { table: '标准收入表', field: '跟进人', purpose: '归属到本地销售的依据', used: true },
        { table: '标准收入表', field: '客户名称、客户池', purpose: '与本系统客户对应、按池查看', used: true },
        { table: '标准收入表', field: '配对维度组（我方主体 / 产品类型 / 数据科目 / 通信类型 / 账期 / 基座）', purpose: '与成本表配对', used: true },
        { table: '标准收入表', field: '业绩核算、数据阶段', purpose: '含义待确认（待明确事项 7.2），取回留存、不参与计算', used: false },
        { table: '标准收入表', field: '最近业务更新时间、数据指纹', purpose: '判断数据变化与重复去重', used: true },
        { table: '标准成本表', field: '结算成本金额', purpose: '毛利计算的成本项', used: true },
        { table: '标准成本表', field: '成本是否已结算', purpose: '未结算成本是否计入待确认（待明确事项 7.5），本版暂计入', used: true },
        { table: '标准成本表', field: '记账日期、跟进人、客户名称、客户池', purpose: '配对与归属校验', used: true },
        { table: '标准成本表', field: '配对维度组（同标准收入表）', purpose: '与收入表配对', used: true },
        { table: '标准成本表', field: '业绩核算、数据阶段', purpose: '含义待确认（待明确事项 7.2），取回留存、不参与计算', used: false },
        { table: '标准成本表', field: '最近业务更新时间、数据指纹', purpose: '判断数据变化与重复去重', used: true }
      ]
    };
  }

  /** 统一补齐目标字段，兼容 R17 上线前的旧演示快照；adjustments 只追加不覆盖。 */
  function normalizeGoal(item, index) {
    const goal = item || {};
    return {
      ...goal,
      id: goal.id || `GT-${index + 1}`,
      level: goal.level === 'personal' ? 'personal' : 'all',
      metric: goal.metric === 'profit' ? 'profit' : 'revenue',
      sales: goal.level === 'personal' ? String(goal.sales || '') : '',
      value: Number.isFinite(Number(goal.value)) ? Number(goal.value) : 0,
      start: String(goal.start || ''), end: String(goal.end || ''),
      createdBy: String(goal.createdBy || ''), createdAt: String(goal.createdAt || ''),
      adjustments: (Array.isArray(goal.adjustments) ? goal.adjustments : []).map(record => ({
        at: String(record?.at || ''), actor: String(record?.actor || ''),
        before: record?.before && typeof record.before === 'object' ? record.before : {},
        after: record?.after && typeof record.after === 'object' ? record.after : {},
        reason: String(record?.reason || '')
      }))
    };
  }

  /** 统一补齐收入行字段；salesId 为跟进人对应结果，空表示未归属（跟进人为空或对应不上）。 */
  function normalizeRevenueRow(item, index) {
    const row = item || {};
    return {
      ...row,
      id: row.id || `RV-${index + 1}`,
      settledAmount: Number.isFinite(Number(row.settledAmount)) ? Number(row.settledAmount) : 0,
      deductAmount: Number.isFinite(Number(row.deductAmount)) ? Number(row.deductAmount) : 0,
      settledAt: String(row.settledAt || ''), bookDate: String(row.bookDate || ''),
      follower: String(row.follower || ''), salesId: String(row.salesId || ''),
      unattributedReason: String(row.unattributedReason || ''),
      customerName: String(row.customerName || ''), dimsKey: String(row.dimsKey || ''),
      fingerprint: String(row.fingerprint || ''), bizUpdatedAt: String(row.bizUpdatedAt || '')
    };
  }

  /** 统一补齐成本行字段；matchedRevenue 为空表示配不上收入行，不进毛利。 */
  function normalizeCostRow(item, index) {
    const row = item || {};
    return {
      ...row,
      id: row.id || `CS-${index + 1}`,
      costAmount: Number.isFinite(Number(row.costAmount)) ? Number(row.costAmount) : 0,
      costSettled: row.costSettled !== false,
      bookDate: String(row.bookDate || ''), follower: String(row.follower || ''),
      customerName: String(row.customerName || ''), dimsKey: String(row.dimsKey || ''),
      matchedRevenue: String(row.matchedRevenue || ''), fingerprint: String(row.fingerprint || '')
    };
  }

  /** 统一补齐取数异常字段；kind 限定 cost_unmatched / missing_time / duplicate。 */
  function normalizeDatahubError(item, index) {
    const row = item || {};
    return {
      ...row,
      id: row.id || `DHE-${index + 1}`,
      kind: ['cost_unmatched', 'missing_time', 'duplicate'].includes(row.kind) ? row.kind : 'cost_unmatched',
      ref: String(row.ref || ''), reason: String(row.reason || ''), at: String(row.at || '')
    };
  }

  /** 统一补齐 DataHub 同步状态；旧快照缺省时按演示种子补齐，白名单只读展示。 */
  function normalizeDatahub(raw) {
    const demo = demoDatahub();
    const value = raw && typeof raw === 'object' ? raw : {};
    return {
      status: ['ok', 'failed', 'never'].includes(value.status) ? value.status : demo.status,
      lastSuccessAt: typeof value.lastSuccessAt === 'string' ? value.lastSuccessAt : demo.lastSuccessAt,
      lastAttemptAt: typeof value.lastAttemptAt === 'string' ? value.lastAttemptAt : demo.lastAttemptAt,
      failReason: String(value.failReason || ''),
      whitelist: Array.isArray(value.whitelist) && value.whitelist.length ? value.whitelist : demo.whitelist
    };
  }

  /** 对外保留闭环文档中的扁平字段别名，页面内部以 state.crm 为唯一写入来源。 */
  function syncCrmAliases(state) {
    const crm = state.crm || (state.crm = demoCrm());
    state.sync = { ...(state.sync || {}), lastRunAt: crm.lastSyncAt, nextRunAt: crm.nextRetryAt, status: crm.status, batchId: crm.currentBatchId, processed: crm.processed, added: crm.added, removed: crm.removed, restored: crm.restored, unchanged: crm.unchanged, failed: crm.failed, retryAt: crm.nextRetryAt };
    state.crmFacts = crm.changes || [];
    state.assignmentIssues = crm.pendingMappings || [];
    state.pendingMappings = crm.pendingMappings || [];
    state.unassignedOpportunities = crm.unassignedOpportunities || [];
    state.syncErrors = crm.alignmentErrors || [];
    state.crmErrors = crm.alignmentErrors || [];
    state.crmChanges = crm.changes || [];
    state.crmMappings = crm.mappings || [];
    state.crmBatches = crm.batches || [];
    return state;
  }

  /** 给旧版本地快照补齐 R01/R02 字段，保证原型升级后历史演示数据仍可打开。 */
  function normalizeSpace(space, index) {
    const item = space || {};
    const state = item.state === 'frozen' ? 'frozen' : 'active';
    const readiness = ['ready', 'preparing', 'updating', 'failed'].includes(item.readiness) ? item.readiness : 'ready';
    const opportunities = Array.isArray(item.opps) ? item.opps : [];
    const ownerOnly = Object.prototype.hasOwnProperty.call(item, 'ownerOnly') ? Boolean(item.ownerOnly) : item.entitlementType === 'customer_only';
    const entitlementType = (state === 'frozen' && !ownerOnly && !opportunities.length) ? 'none' : (item.entitlementType || (ownerOnly ? 'customer_only' : opportunities.length ? 'customer_and_opportunity' : 'customer_only'));
    const entitlements = item.entitlements && typeof item.entitlements === 'object' ? item.entitlements : { customer: true, opportunities: opportunities.map(opportunity => opportunity.id) };
    const events = Array.isArray(item.lifecycleEvents) && item.lifecycleEvents.length ? item.lifecycleEvents : [{ type: 'created', at: item.createdAt || '2026-09-15 09:00', reason: '确权生效后建立空间', result: 'success' }];
    return {
      ...item, state, lifecycle: state, readiness, ownerOnly, opps: opportunities,
      entitlementType, entitlements: { customer: entitlements.customer !== false, opportunities: Array.isArray(entitlements.opportunities) ? entitlements.opportunities : opportunities.map(opportunity => opportunity.id) },
      customerPoolSource: item.customerPoolSource || (item.pool ? 'crm' : 'pending'),
      lifecycleEvents: events, createdAt: item.createdAt || '2026-09-15 09:00', lifecycleChangedAt: item.lifecycleChangedAt || item.updated || '2026-09-15 10:20',
      frozenAt: item.frozenAt || (state === 'frozen' ? item.updated || '2026-09-15 10:20' : ''), unfrozenAt: item.unfrozenAt || '',
      readinessUpdatedAt: item.readinessUpdatedAt || item.updated || '2026-09-15 10:20', lastReadableVersion: item.lastReadableVersion || `content-${item.id || index + 1}-v3`, lastReadableAt: item.lastReadableAt || item.updated || '2026-09-15 10:20',
      readinessReason: item.readinessReason || (readiness === 'failed' ? '内容索引服务超时，上一版内容仍可查看。' : readiness === 'preparing' || readiness === 'updating' ? '空间内容正在装载。' : ''),
      failure: item.failure || (readiness === 'failed' ? { stage: 'content_prepare', layer: 'customer', reason: item.readinessReason || '内容索引服务超时', occurredAt: item.updated || '2026-09-15 10:24', retryCount: 1, lastRetryAt: '', status: 'failed' } : null),
      overviewStatus: ['ready', 'updating', 'failed'].includes(item.overviewStatus) ? item.overviewStatus : readiness === 'failed' ? 'failed' : readiness === 'updating' || readiness === 'preparing' ? 'updating' : 'ready',
      overviewUpdatedAt: item.overviewUpdatedAt || item.updated || '2026-09-15 10:20',
      conflicts: Array.isArray(item.conflicts) ? item.conflicts : [],
      pendingConfirm: Array.isArray(item.pendingConfirm) ? item.pendingConfirm : []
    };
  }

  function deriveEntitlements(spaces) {
    return spaces.flatMap(space => [
      ...(space.entitlements?.customer ? [{ id: `ENT-C-${space.id}`, space: space.id, customerId: space.customerId, sales: space.sales, type: 'customer', status: space.state === 'frozen' ? 'ended' : 'active' }] : []),
      ...space.opps.map(opportunity => ({ id: `ENT-O-${opportunity.id}-${space.sales}`, space: space.id, customerId: space.customerId, opportunityId: opportunity.id, sales: space.sales, type: 'opportunity', status: space.state === 'frozen' ? 'ended' : 'active' }))
    ]);
  }

  /**
   * 把旧版仅保存姓名/角色的人员记录升级为账号管理页所需的完整形态。
   * 业务页继续使用 id、name、role 三个核心字段，新增字段缺失时用演示数据补齐。
   */
  function normalizePeople(source) {
    const incoming = Array.isArray(source) ? source : [];
    const byId = new Map(incoming.filter(person => person && person.id).map(person => [person.id, person]));
    const base = SC.DATA.PEOPLE.map(person => ({ ...person }));
    const merged = base.map(person => ({ ...person, ...(byId.get(person.id) || {}) }));
    incoming.filter(person => person && person.id && !base.some(item => item.id === person.id)).forEach(person => merged.push({ ...person }));
    return merged.map((person, index) => ({
      id: person.id || `U-${1100 + index}`,
      name: String(person.name || '未命名人员'),
      email: String(person.email || `${String(person.name || 'user').replace(/\s/g, '').toLowerCase()}@teddymobile.cn`),
      mobile: String(person.mobile || '未填写'),
      role: F.roles[person.role] ? person.role : 'SLS',
      status: person.status === 'off' ? 'off' : 'on',
      createdAt: person.createdAt || person.created || '2026-09-15 09:00',
      lastLoginAt: person.lastLoginAt || person.lastLogin || '暂无登录记录',
      passwordResetAt: person.passwordResetAt || ''
    }));
  }

  /**
   * 旧快照补齐销帮帮连接配置：缺字段用演示值兜底，并保证来源标注与最近检查结果结构完整。
   * 同步周期固定沿用 R01 口径，不随历史快照变化。
   */
  function normalizeXbb(value) {
    const demo = demoXbb();
    const source = value && typeof value === 'object' ? value : {};
    const sources = source.sources && typeof source.sources === 'object' ? source.sources : {};
    const positive = (input, fallback) => (Number.isFinite(Number(input)) && Number(input) > 0 ? Number(input) : fallback);
    return {
      ...demo,
      ...source,
      baseUrl: String(source.baseUrl || demo.baseUrl),
      corpId: String(source.corpId || demo.corpId),
      userId: String(source.userId || demo.userId),
      tokenMasked: String(source.tokenMasked || demo.tokenMasked),
      saasMark: positive(source.saasMark, demo.saasMark),
      timeoutSeconds: positive(source.timeoutSeconds, demo.timeoutSeconds),
      listPageSize: positive(source.listPageSize, demo.listPageSize),
      retryCount: Number.isFinite(Number(source.retryCount)) && Number(source.retryCount) >= 0 ? Number(source.retryCount) : demo.retryCount,
      retryBackoffSeconds: positive(source.retryBackoffSeconds, demo.retryBackoffSeconds),
      intervalMinutes: demo.intervalMinutes,
      sources: { ...demo.sources, ...sources },
      lastCheck: source.lastCheck && typeof source.lastCheck === 'object' ? { ...demo.lastCheck, ...source.lastCheck } : demo.lastCheck
    };
  }

  function normalizeState(value) {
    if (!value || !Array.isArray(value.spaces)) return null;
    const state = copy(value);
    state.version = 2;
    state.people = normalizePeople(state.people);
    state.assignments = state.assignments && typeof state.assignments === 'object' ? state.assignments : {};
    state.audit = Array.isArray(state.audit) ? state.audit : [];
    state.spaces = state.spaces.map(normalizeSpace);
    const crm = demoCrm();
    state.crm = { ...crm, ...(state.crm && typeof state.crm === 'object' ? state.crm : {}) };
    state.crm.batches = Array.isArray(state.crm.batches) ? state.crm.batches : crm.batches;
    state.crm.pendingMappings = Array.isArray(state.crm.pendingMappings) ? state.crm.pendingMappings : crm.pendingMappings;
    state.crm.unassignedOpportunities = Array.isArray(state.crm.unassignedOpportunities) ? state.crm.unassignedOpportunities : crm.unassignedOpportunities;
    state.crm.alignmentErrors = Array.isArray(state.crm.alignmentErrors) ? state.crm.alignmentErrors : crm.alignmentErrors;
    state.crm.changes = Array.isArray(state.crm.changes) ? state.crm.changes : crm.changes;
    state.crm.mappings = Array.isArray(state.crm.mappings) && state.crm.mappings.length ? state.crm.mappings : crm.mappings;
    // R01：销帮帮连接配置在同步概览展示，旧快照没有时补演示值。
    state.xbb = normalizeXbb(state.xbb);
    state.entitlements = Array.isArray(state.entitlements) && state.entitlements.length ? state.entitlements : deriveEntitlements(state.spaces);
    state.documents = Array.isArray(state.documents) ? state.documents : demoDocuments();
    state.spaceChanges = Array.isArray(state.spaceChanges) ? state.spaceChanges : demoSpaceChanges();
    // R10：录音与归位向后兼容；旧快照里录音的单值 space 字段折算成归位记录后再丢弃。
    const legacyRecordings = Array.isArray(state.meetings) ? state.meetings : demoRecordings();
    state.meetings = legacyRecordings.map(normalizeRecording);
    state.placements = (Array.isArray(state.placements) ? state.placements : derivePlacements(state.meetings, legacyRecordings)).map(normalizePlacement);
    state.behaviorRecords = (Array.isArray(state.behaviorRecords) ? state.behaviorRecords : demoBehaviorRecords()).map(normalizeBehaviorRecord);
    state.spaceQA = Array.isArray(state.spaceQA) ? state.spaceQA : [];
    state.weeklyReviews = Array.isArray(state.weeklyReviews) ? state.weeklyReviews : [];
    state.solutions = Array.isArray(state.solutions) ? state.solutions.map(normalizeSolution) : [];
    state.notifications = (Array.isArray(state.notifications) ? state.notifications : []).map((item, index) => normalizeNotification(item, index, state));
    // 旧快照没有投递结果集合时，从提醒的推送状态派生，保证超管投递查询页有完整回看。
    state.deliveries = Array.isArray(state.deliveries) ? state.deliveries : state.notifications
      .filter(item => item.pushStatus && item.pushStatus !== 'not_required')
      .map(item => ({ id: 'DL-' + item.id, notification: item.id, recipient: item.recipient, type: item.type, title: item.title, channel: '移动端推送', status: item.pushStatus, reason: item.pushFailReason || '', at: item.createdAt }));
    state.assignmentMeta = state.assignmentMeta && typeof state.assignmentMeta === 'object' ? state.assignmentMeta : {};
    // 存量切换不再提供运营分面；旧快照里的演示状态丢弃，避免误当成可操作入口。
    delete state.migration;
    // R13：旧快照没有今日该跟子模型时补演示数据；有部分字段时只补缺口。
    state.insight = normalizeInsight(state.insight);
    state.insightMarks = (Array.isArray(state.insightMarks) ? state.insightMarks : demoInsightMarks()).map(normalizeInsightMark);
    // R14：日报快照与提示词配置同样向后兼容；空快照回退到演示种子。
    state.dailyReports = (Array.isArray(state.dailyReports) ? state.dailyReports : demoDailyReports()).map(normalizeDailyReport);
    state.dailyReportConfig = normalizeDailyReportConfig(state.dailyReportConfig);
    // R16：AI 文档与能力子模型向后兼容；旧快照没有 aiDocs 时补演示数据。
    state.aiDocs = normalizeAiDocs(state.aiDocs);
    // R17：销售目标与 DataHub 收入成本子模型向后兼容；旧快照缺失时补演示数据。
    state.goals = (Array.isArray(state.goals) ? state.goals : demoGoals()).map(normalizeGoal);
    state.datahub = normalizeDatahub(state.datahub);
    state.revenueRows = (Array.isArray(state.revenueRows) ? state.revenueRows : demoRevenueRows()).map(normalizeRevenueRow);
    state.costRows = (Array.isArray(state.costRows) ? state.costRows : demoCostRows()).map(normalizeCostRow);
    state.datahubErrors = (Array.isArray(state.datahubErrors) ? state.datahubErrors : demoDatahubErrors()).map(normalizeDatahubError);
    return syncCrmAliases(state);
  }

  /** 构造相互关联的样例；同一客户分属不同销售的空间具有独立内容。 */
  function seed() {
    const names = ['星辰科技有限公司', '远山物流有限公司', '启明教育科技有限公司', '云桥数字科技有限公司', '海川保险服务有限公司', '和光医疗科技有限公司'];
    const pools = ['通信线路池', '智能短信池', '号码认证池'];
    const spaces = Array.from({ length: 9 }, (_, i) => ({
      id: 'WS-' + (201 + i), customerId: 'C-' + (1001 + i % 6), customer: names[i % 6],
      industry: ['通讯', '物流', '教育', '电商', '保险', '医疗'][i % 6],
      sales: i < 6 ? 'U-1004' : ['U-1005', 'U-1008', 'U-1006'][i - 6],
      pool: pools[i % 3], state: i === 5 ? 'frozen' : 'active', readiness: i === 4 ? 'failed' : i === 3 ? 'updating' : 'ready',
      stage: ['方案推进', '需求探索', '商务推进', '初步接触', '待触达', '结果确认'][i % 6],
      grade: ['S', 'A', 'A', 'B', 'B', 'C'][i % 6], contact: ['李女士', '周先生', '林女士'][i % 3],
      updated: '2026-09-' + (15 - i % 5) + ' 10:20', ownerOnly: i === 4,
      // WS-204 保留两条确权商机：R10 归位时必须由销售指定一条，系统不代选。
      opps: i === 4 ? [] : [{ id: 'OP-' + (301 + i), name: ['通信线路接入', '通知短信升级', '一键登录认证'][i % 3], amount: [28, 16, 42][i % 3], stage: ['方案验证', '需求确认', '商务沟通'][i % 3] }, ...(i === 3 ? [{ id: 'OP-310', name: '短信通道扩容', amount: 19, stage: '需求确认' }] : [])],
      brief: ['技术团队已完成初步验证，需确认并发指标及试点计划。', '华东配送通知需求明确，待补充高峰发送量。', '采购侧关注预算与交付周期，建议共同确认验收标准。'][i % 3],
      entitlementType: i === 4 ? 'customer_only' : 'customer_and_opportunity',
      entitlements: { customer: true, opportunities: i === 4 ? [] : ['OP-' + (301 + i), ...(i === 3 ? ['OP-310'] : [])] },
      customerPoolSource: i === 8 ? 'pending' : 'crm', createdAt: '2026-09-' + (12 - i % 3) + ' 09:00', lifecycleChangedAt: '2026-09-' + (15 - i % 5) + ' 10:20',
      overviewStatus: i === 0 ? 'updating' : i === 4 ? 'failed' : 'ready', overviewUpdatedAt: '2026-09-' + (15 - i % 5) + ' 10:22',
      lastReadableVersion: 'content-WS-' + (201 + i) + '-v3', lastReadableAt: '2026-09-' + (15 - i % 5) + ' 10:20',
      readinessReason: i === 4 ? '内容索引服务超时，上一版客户内容仍可读。' : i === 3 ? '客户画像正在增量更新。' : '',
      failure: i === 4 ? { stage: 'content_prepare', layer: 'customer', reason: '内容索引服务超时', occurredAt: '2026-09-15 10:24', retryCount: 1, lastRetryAt: '', status: 'failed' } : null,
      conflicts: i === 1 ? [{ field: '短信日峰值发送量', resolved: '日峰值 8 万条', reason: '取更近一次客户口述；方案往来中的 12 万条为方案侧预估值。', values: [{ text: '日峰值 8 万条', source: 'followup:FU-1', at: '2026-09-14 16:30' }, { text: '日峰值 12 万条', source: 'solution:SL-102', at: '2026-09-14 11:30' }] }] : [],
      pendingConfirm: i === 0 ? ['客户侧验收负责人尚未明确'] : i === 1 ? ['节假日营销场景是否纳入本期'] : [],
      lifecycleEvents: i === 5 ? [{ type: 'created', at: '2026-09-12 11:20', reason: '确权生效后建立空间', result: 'success' }, { type: 'frozen', at: '2026-09-15 10:20', reason: '客户级与商机级确权均已结束', result: 'success' }] : i === 4 ? [{ type: 'created', at: '2026-09-14 09:10', reason: '仅客户级确权，建立空间', result: 'success' }, { type: 'opportunity_removed', at: '2026-09-15 10:25', reason: '商机确权移除，但客户级确权仍在', result: 'kept_active' }] : [{ type: 'created', at: '2026-09-14 09:10', reason: '确权生效后建立空间', result: 'success' }]
    }));
    // 样例同样走一次补齐，保证首次加载与重载后的空间字段完全一致。
    const normalized = spaces.map(normalizeSpace);
    const state = {
      version: 2, people: normalizePeople(SC.DATA.PEOPLE), pools, spaces: normalized,
      assignments: { 'U-1010': [pools[0], pools[1]], 'U-1011': [pools[2]], 'U-1012': [] },
      assignmentMeta: { 'U-1010': { updatedAt: '2026-09-12 09:30', added: [pools[0], pools[1]], removed: [] }, 'U-1011': { updatedAt: '2026-09-12 09:30', added: [pools[2]], removed: [] } },
      followups: [
        ...normalized.filter(w => !w.ownerOnly).map((w, i) => ({ id: 'FU-' + i, space: w.id, author: w.sales, date: '2026-09-14 16:30', type: i % 2 ? '电话沟通' : '客户拜访', text: w.brief, next: '与客户确认下次沟通时间及参会人员。' })),
        // R14 日报窗口内的两次真实跟进（WS-201 同客户多事件），供 DR-0915 行为归纳与「当日汇总」写回引用。
        { id: 'FU-D201', space: 'WS-201', author: 'U-1004', date: '2026-09-15 10:35', type: '电话沟通', text: '上午与客户电话对齐验收指标口径，客户确认可用率口径。', next: '下午拜访确认试点启动时间。' },
        { id: 'FU-D202', space: 'WS-201', author: 'U-1004', date: '2026-09-15 16:20', type: '客户拜访', text: '下午拜访确认试点下周三启动，验收负责人待客户内部确认。', next: '等待客户明确验收负责人。' }
      ],
      tasks: normalized.slice(0, 4).map((w, i) => ({ id: 'TK-' + i, space: w.id, title: ['确认试点验收指标', '补充短信峰值发送量', '跟进采购预算确认', '预约首次需求访谈'][i], due: i === 1 ? '2026-09-14' : F.today, done: false })),
      // R10：录音来自三方同步，归位关系单列 placements；一份录音可有多条互不影响的归位。
      meetings: demoRecordings().map(normalizeRecording),
      placements: demoPlacements().map(normalizePlacement),
      solutions: [
        { id: 'SL-101', space: 'WS-201', author: 'U-1010', title: '通信线路试点建议', body: '建议采用两阶段试点：先验证线路稳定性与并发容量，再覆盖正式业务场景。请确认客户技术负责人及预计试点时间。', date: '2026-09-14 10:02', attachments: demoSolutionAttachments(), externalLink: 'https://example.com/solution/SL-101', read: false, reply: '', withdrawn: false, deliveryStatus: 'sent', remindCount: 1, remindedAt: '2026-09-15 09:12' },
        { id: 'SL-102', space: 'WS-202', author: 'U-1010', title: '华东配送通知优化方案', body: '按通知类型拆分短信模板，先完成高峰量测算，再确定通道配置。', date: '2026-09-14 11:30', attachments: [{ name: '通知模板清单.xlsx', size: '286 KB' }], read: true, readAt: '2026-09-14 15:06', reply: '客户认可方向，周四补充峰值数据。', replyDate: '2026-09-15 09:15', replyRead: false, withdrawn: false, deliveryStatus: 'sent' },
        { id: 'SL-103', space: 'WS-207', author: 'U-1010', title: '线路接入评估说明', body: '建议完成现有线路容量评估后，再决定扩容计划。', date: '2026-09-13 15:20', read: true, readAt: '2026-09-13 16:02', reply: '', withdrawn: false, deliveryStatus: 'sent' },
        { id: 'SL-104', space: 'WS-203', author: 'U-1010', title: '已撤回的旧版容量说明', body: '这是一条用于演示撤回状态的历史方案。', date: '2026-09-12 09:20', read: false, withdrawn: true, withdrawnAt: '2026-09-12 10:05', deliveryStatus: 'withdrawn' }
      ].map(normalizeSolution),
      // R12 种子提醒：每条都有明确接收人、产生时间、去重键和投递结果；运营异常只发给超管与销售运营。
      notifications: [
        { id: 'N-1', recipient: 'U-1004', space: 'WS-205', type: '归属变化', title: '客户归属已同步', text: '你已成为海川保险的客户归属销售，商机内容等待确权。', read: false, createdAt: '2026-09-15 10:25', dedupKey: 'ownership:seed-WS-205', link: { page: 'followup-workbench', params: { space: 'WS-205' } }, pushStatus: 'delivered' },
        { id: 'N-2', recipient: 'U-1004', space: 'WS-206', type: '空间状态', title: '客户跟进空间已冻结', text: '和光医疗的确权已结束，历史内容保留只读。', read: false, createdAt: '2026-09-15 10:20', dedupKey: 'freeze:WS-206', link: { page: 'followup-workbench', params: { space: 'WS-206' } }, pushStatus: 'delivered' },
        { id: 'N-3', recipient: 'U-1004', space: 'WS-201', changeId: 'CHGX-501', type: '客户更新', title: '客户信息已更新', text: '外部资料《星辰科技-试点方案v2.md》带来 3 处变化。', read: true, createdAt: '2026-09-14 15:22', dedupKey: 'customer-update:CHGX-501', link: { page: 'followup-workbench', params: { space: 'WS-201', tab: 'overview', change: 'CHGX-501' } }, pushStatus: 'delivered' },
        { id: 'N-4', recipient: 'U-1004', space: 'WS-201', solution: 'SL-101', type: '方案推送', title: '你收到一份新方案', text: '通信线路试点建议', read: false, createdAt: '2026-09-14 10:02', dedupKey: 'solution-push:SL-101', link: { page: 'followup-workbench', params: { space: 'WS-201', tab: 'solutions', solution: 'SL-101' } }, pushStatus: 'delivered' },
        { id: 'N-5', recipient: 'U-1004', space: 'WS-201', solution: 'SL-101', type: '方案提醒', title: '方案人员提醒你查看方案', text: '通信线路试点建议', read: false, createdAt: '2026-09-15 09:12', dedupKey: 'solution-remind:SL-101:1', link: { page: 'followup-workbench', params: { space: 'WS-201', tab: 'solutions', solution: 'SL-101' } }, pushStatus: 'failed', pushFailReason: '推送服务超时，未自动补发' },
        { id: 'N-6', recipient: 'U-1010', space: 'WS-202', solution: 'SL-102', type: '方案回复', title: '销售已回复方案', text: '华东配送通知优化方案：客户认可方向，周四补充峰值数据。', read: false, createdAt: '2026-09-15 09:15', dedupKey: 'solution-reply:SL-102', link: { page: 'solution-feedback', params: { tab: 'replied' } }, pushStatus: 'delivered' },
        { id: 'N-7', recipient: 'U-1001', type: '运营异常', title: 'CRM 对齐异常待处理', text: '海川保险 / 保险通知通道升级：系统账号不存在或已停用。', read: false, createdAt: '2026-09-15 10:24', dedupKey: 'ops:crm-error:ERR-305', deduped: 1, link: { page: 'operations-config', params: { tab: 'crm', crmView: 'errors' } }, pushStatus: 'not_required' },
        { id: 'N-8', recipient: 'U-1002', type: '运营异常', title: 'CRM 对齐异常待处理', text: '海川保险 / 保险通知通道升级：系统账号不存在或已停用。', read: false, createdAt: '2026-09-15 10:24', dedupKey: 'ops:crm-error:ERR-305', deduped: 1, link: { page: 'operations-config', params: { tab: 'crm', crmView: 'errors' } }, pushStatus: 'not_required' },
        { id: 'N-9', recipient: 'U-1001', type: '运营异常', title: 'CRM 人员待对应', text: '赵伟航（云桥数字 / 一键登录认证）尚未对应系统销售账号。', read: false, createdAt: '2026-09-15 10:25', dedupKey: 'ops:pending:MAP-203', link: { page: 'operations-config', params: { tab: 'crm', crmView: 'pending' } }, pushStatus: 'not_required' },
        { id: 'N-10', recipient: 'U-1002', type: '运营异常', title: 'CRM 人员待对应', text: '赵伟航（云桥数字 / 一键登录认证）尚未对应系统销售账号。', read: true, createdAt: '2026-09-15 10:25', dedupKey: 'ops:pending:MAP-203', link: { page: 'operations-config', params: { tab: 'crm', crmView: 'pending' } }, pushStatus: 'not_required' },
        { id: 'N-11', recipient: 'U-1001', space: 'WS-202', changeId: 'CHGX-504', type: '运营异常', title: '客户信息更新失败', text: '远山物流：资料解析服务超时，概览未更新，原文仍在资料 Tab。', read: false, createdAt: '2026-09-15 10:06', dedupKey: 'ops:space-failed:CHGX-504', link: { page: 'followup-workbench', params: { space: 'WS-202', tab: 'overview', change: 'CHGX-504' } }, pushStatus: 'not_required' },
        { id: 'N-12', recipient: 'U-1002', space: 'WS-202', changeId: 'CHGX-504', type: '运营异常', title: '客户信息更新失败', text: '远山物流：资料解析服务超时，概览未更新，原文仍在资料 Tab。', read: false, createdAt: '2026-09-15 10:06', dedupKey: 'ops:space-failed:CHGX-504', link: { page: 'followup-workbench', params: { space: 'WS-202', tab: 'overview', change: 'CHGX-504' } }, pushStatus: 'not_required' },
        { id: 'N-13', recipient: 'U-1005', space: 'WS-207', solution: 'SL-103', type: '方案推送', title: '你收到一份新方案', text: '线路接入评估说明', read: true, createdAt: '2026-09-13 15:20', dedupKey: 'solution-push:SL-103', link: { page: 'followup-workbench', params: { space: 'WS-207', tab: 'solutions', solution: 'SL-103' } }, pushStatus: 'not_installed', pushFailReason: '接收人尚未安装移动端 App' },
        // R13 产出提醒：每日名单生成后发给归属销售，直达今日该跟页；同一销售同一天按去重键合并。
        { id: 'N-14', recipient: 'U-1004', type: '今日该跟', title: '今日该跟已生成', text: '今天为你选出 4 个该跟空间，每条建议都带原文依据。', read: false, createdAt: '2026-09-15 08:30', dedupKey: 'insight:U-1004:2026-09-15', link: { page: 'today-follow' }, pushStatus: 'delivered' },
        // R14 窗口内变化的完成提醒（与 CHGX-505/506 的 notified 标记一致）。
        { id: 'N-15', recipient: 'U-1004', space: 'WS-201', changeId: 'CHGX-505', type: '客户更新', title: '客户信息已更新', text: '跟进记录（电话沟通）带来 3 处变化。', read: true, createdAt: '2026-09-15 11:20', dedupKey: 'customer-update:CHGX-505', link: { page: 'followup-workbench', params: { space: 'WS-201', tab: 'overview', change: 'CHGX-505' } }, pushStatus: 'delivered' },
        { id: 'N-16', recipient: 'U-1004', space: 'WS-202', changeId: 'CHGX-506', type: '客户更新', title: '客户信息已更新', text: '会议录音 · 配送通知需求沟通 带来 1 处变化。', read: true, createdAt: '2026-09-15 09:20', dedupKey: 'customer-update:CHGX-506', link: { page: 'followup-workbench', params: { space: 'WS-202', tab: 'overview', change: 'CHGX-506' } }, pushStatus: 'delivered' },
        // CHGX-507 更新失败只提醒运营，不打扰销售。
        { id: 'N-17', recipient: 'U-1001', space: 'WS-203', changeId: 'CHGX-507', type: '运营异常', title: '客户信息更新失败', text: '启明教育：内容索引服务超时，概览未更新，原文仍保留。', read: false, createdAt: '2026-09-15 14:10', dedupKey: 'ops:space-failed:CHGX-507', link: { page: 'followup-workbench', params: { space: 'WS-203', tab: 'overview', change: 'CHGX-507' } }, pushStatus: 'not_required' },
        { id: 'N-18', recipient: 'U-1002', space: 'WS-203', changeId: 'CHGX-507', type: '运营异常', title: '客户信息更新失败', text: '启明教育：内容索引服务超时，概览未更新，原文仍保留。', read: false, createdAt: '2026-09-15 14:10', dedupKey: 'ops:space-failed:CHGX-507', link: { page: 'followup-workbench', params: { space: 'WS-203', tab: 'overview', change: 'CHGX-507' } }, pushStatus: 'not_required' },
        // R14 日报提醒：成功或部分成功发「日报送达」（每人每天至多一次，强档推送）；全部失败发一次「日报失败」；无有效变化不发。
        { id: 'N-19', recipient: 'U-1004', type: '日报送达', title: '晚间日报已生成', text: '2026-09-15 晚间日报已生成：2 个客户有有效变化（远山物流部分信息尚未更新，启明教育未能生成）。', read: false, createdAt: '2026-09-15 18:47', dedupKey: 'daily-report:DR-0915', link: { page: 'daily-report', params: { date: '2026-09-15' } }, pushStatus: 'delivered' },
        { id: 'N-20', recipient: 'U-1010', type: '日报送达', title: '晚间日报已生成', text: '2026-09-15 晚间日报已生成：你承接的 2 个客户空间有有效变化（远山物流部分信息尚未更新）。', read: false, createdAt: '2026-09-15 18:47', dedupKey: 'daily-report:DR-0915', link: { page: 'daily-report', params: { date: '2026-09-15' } }, pushStatus: 'delivered' },
        { id: 'N-21', recipient: 'U-1004', type: '日报失败', title: '晚间日报生成失败', text: '2026-09-13 晚间日报全部客户生成失败，未沿用昨日内容；请等待下一份日报或联系销售运营。', read: true, createdAt: '2026-09-13 18:52', dedupKey: 'daily-report-failed:DR-0913', link: { page: 'daily-report', params: { date: '2026-09-13' } }, pushStatus: 'delivered' },
        { id: 'N-22', recipient: 'U-1010', type: '日报失败', title: '晚间日报生成失败', text: '2026-09-13 晚间日报全部客户生成失败，未沿用昨日内容；请等待下一份日报或联系销售运营。', read: true, createdAt: '2026-09-13 18:52', dedupKey: 'daily-report-failed:DR-0913', link: { page: 'daily-report', params: { date: '2026-09-13' } }, pushStatus: 'delivered' },
        // R10 录音归位后的完成提醒：有变化才提醒本空间销售，点击直达本次变化详情。
        { id: 'N-23', recipient: 'U-1004', space: 'WS-202', changeId: 'CHGX-510', type: '客户更新', title: '客户信息已更新', text: '客户录音 · 跨客户联合沟通 带来 2 处变化。', read: false, createdAt: '2026-09-15 15:36', dedupKey: 'customer-update:CHGX-510', link: { page: 'followup-workbench', params: { space: 'WS-202', tab: 'overview', change: 'CHGX-510' } }, pushStatus: 'delivered' },
        // 录音更新失败只提醒运营与超管，不向销售推送技术异常。
        { id: 'N-24', recipient: 'U-1001', space: 'WS-204', changeId: 'CHGX-508', type: '运营异常', title: '客户信息更新失败', text: '云桥数字科技：录音内容更新服务超时，本次更新未完成，原内容保留。', read: false, createdAt: '2026-09-14 10:26', dedupKey: 'ops:space-failed:CHGX-508', link: { page: 'followup-workbench', params: { space: 'WS-204', tab: 'overview', change: 'CHGX-508' } }, pushStatus: 'not_required' },
        { id: 'N-25', recipient: 'U-1002', space: 'WS-204', changeId: 'CHGX-508', type: '运营异常', title: '客户信息更新失败', text: '云桥数字科技：录音内容更新服务超时，本次更新未完成，原内容保留。', read: false, createdAt: '2026-09-14 10:26', dedupKey: 'ops:space-failed:CHGX-508', link: { page: 'followup-workbench', params: { space: 'WS-204', tab: 'overview', change: 'CHGX-508' } }, pushStatus: 'not_required' },
        // 归属销售标识缺失：只进运营待处理清单，不分配给任何销售。
        { id: 'N-26', recipient: 'U-1001', type: '运营异常', title: '录音归属待处理', text: '「未识别归属的客户通话」同步成功但缺少归属销售标识，未进入任何人的录音管理。', read: false, createdAt: '2026-09-15 11:55', dedupKey: 'ops:recording-unassigned:MT-108', link: { page: 'meeting-center', params: { view: 'unresolved' } }, pushStatus: 'not_required' },
        { id: 'N-27', recipient: 'U-1002', type: '运营异常', title: '录音归属待处理', text: '「未识别归属的客户通话」同步成功但缺少归属销售标识，未进入任何人的录音管理。', read: false, createdAt: '2026-09-15 11:55', dedupKey: 'ops:recording-unassigned:MT-108', link: { page: 'meeting-center', params: { view: 'unresolved' } }, pushStatus: 'not_required' }
      ],
      // 投递结果只用于排查，不改变业务状态；失败不自动补发。
      deliveries: [
        { id: 'DL-N-1', notification: 'N-1', recipient: 'U-1004', type: '归属变化', title: '客户归属已同步', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 10:25' },
        { id: 'DL-N-2', notification: 'N-2', recipient: 'U-1004', type: '空间状态', title: '客户跟进空间已冻结', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 10:20' },
        { id: 'DL-N-3', notification: 'N-3', recipient: 'U-1004', type: '客户更新', title: '客户信息已更新', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-14 15:22' },
        { id: 'DL-N-4', notification: 'N-4', recipient: 'U-1004', type: '方案推送', title: '你收到一份新方案', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-14 10:02' },
        { id: 'DL-N-5', notification: 'N-5', recipient: 'U-1004', type: '方案提醒', title: '方案人员提醒你查看方案', channel: '移动端推送', status: 'failed', reason: '推送服务超时，未自动补发', at: '2026-09-15 09:12' },
        { id: 'DL-N-6', notification: 'N-6', recipient: 'U-1010', type: '方案回复', title: '销售已回复方案', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 09:15' },
        { id: 'DL-N-13', notification: 'N-13', recipient: 'U-1005', type: '方案推送', title: '你收到一份新方案', channel: '移动端推送', status: 'not_installed', reason: '接收人尚未安装移动端 App', at: '2026-09-13 15:20' },
        { id: 'DL-N-14', notification: 'N-14', recipient: 'U-1004', type: '今日该跟', title: '今日该跟已生成', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 08:30' },
        { id: 'DL-N-15', notification: 'N-15', recipient: 'U-1004', type: '客户更新', title: '客户信息已更新', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 11:20' },
        { id: 'DL-N-16', notification: 'N-16', recipient: 'U-1004', type: '客户更新', title: '客户信息已更新', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 09:20' },
        { id: 'DL-N-19', notification: 'N-19', recipient: 'U-1004', type: '日报送达', title: '晚间日报已生成', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 18:47' },
        { id: 'DL-N-20', notification: 'N-20', recipient: 'U-1010', type: '日报送达', title: '晚间日报已生成', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 18:47' },
        { id: 'DL-N-21', notification: 'N-21', recipient: 'U-1004', type: '日报失败', title: '晚间日报生成失败', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-13 18:52' },
        { id: 'DL-N-22', notification: 'N-22', recipient: 'U-1010', type: '日报失败', title: '晚间日报生成失败', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-13 18:52' },
        { id: 'DL-N-23', notification: 'N-23', recipient: 'U-1004', type: '客户更新', title: '客户信息已更新', channel: '移动端推送', status: 'delivered', reason: '', at: '2026-09-15 15:36' }
      ],
      batches: [{ id: 'B-0915', date: F.today, total: 36, matched: 32, pending: 4, status: '待处理' }, { id: 'B-0914', date: '2026-09-14', total: 28, matched: 28, pending: 0, status: '已完成' }],
      products: [{ id: 'P-101', name: '智能短信', category: '通信服务', status: '已发布', description: '验证码、业务通知及营销短信服务。', faq: '支持哪些接入方式？支持 HTTP API 接入。' }, { id: 'P-102', name: '号码认证', category: '身份认证', status: '已发布', description: '为移动应用提供号码校验与一键登录能力。', faq: '是否支持多运营商？支持主流运营商。' }, { id: 'P-103', name: '企业通信线路', category: '通信服务', status: '草稿', description: '企业语音线路接入及容量管理。', faq: '如何评估容量？按峰值并发和呼叫量评估。' }],
      conversations: [{ id: 'CHAT-1', sales: 'U-1004', title: '星辰科技下一步怎么推进？', date: F.today, messages: [{ role: 'user', text: '星辰科技下一步怎么推进？' }, { role: 'assistant', text: '演示回复：已有试点意向，建议先确认验收指标及时间，并阅读空间内的通信线路试点建议。' }] }],
      config: { model: '业务默认模型', provider: 'OpenAI compatible', endpoint: 'https://api.example.com/v1', temperature: '0.3', crmInterval: '5', guidance: '优先引用客户事实；不确定时说明缺少的信息；跟进写入必须由销售确认。', sandbox: false },
      crm: demoCrm(),
      // R01：销帮帮连接配置与 CRM 事实同步同源，首次加载也要带上，避免同步概览出现空配置。
      xbb: demoXbb(),
      documents: demoDocuments(),
      spaceChanges: demoSpaceChanges(),
      behaviorRecords: demoBehaviorRecords(),
      spaceQA: [],
      // R09：周复盘与跟进记录同属空间内容，两端读写同一份。
      weeklyReviews: [{ id: 'WR-201', space: 'WS-201', author: 'U-1004', date: '2026-09-15 08:30', progress: '完成试点范围确认，验收指标口径已与客户对齐。', next: '本周内确认验收负责人并排期启动会。', blockers: '客户侧验收负责人尚未明确。' }],
      insight: demoInsight(),
      insightMarks: demoInsightMarks(),
      dailyReports: demoDailyReports(),
      dailyReportConfig: demoDailyReportConfig(),
      aiDocs: demoAiDocs(),
      goals: demoGoals(),
      datahub: demoDatahub(),
      revenueRows: demoRevenueRows(),
      costRows: demoCostRows(),
      datahubErrors: demoDatahubErrors(),
      entitlements: deriveEntitlements(normalized),
      audit: []
    };
    // 提醒样例同样走一次补齐，保证首次加载与重载后的字段完全一致。
    state.notifications = state.notifications.map((item, index) => normalizeNotification(item, index, state));
    return syncCrmAliases(state);
  }
  F.load = function () {
    try {
      const raw = localStorage.getItem(F.key);
      if (raw) {
        const value = normalizeState(JSON.parse(raw));
        if (value) { memory = value; return copy(value); }
      }
    } catch (_) { F.storageWarning = true; }
    if (!memory) memory = seed();
    return copy(memory);
  };
  F.save = function (state) {
    if (Array.isArray(state.spaces)) state.spaces = state.spaces.map(normalizeSpace);
    syncCrmAliases(state);
    memory = copy(state);
    try { localStorage.setItem(F.key, JSON.stringify(state)); }
    catch (_) { F.storageWarning = true; SC.toast('浏览器存储不可用，修改仅保留在当前页面。', 'bad'); }
  };
  F.person = (id, s = F.load()) => s.people.find(p => p.id === id);
  F.name = id => F.person(id)?.name || '未知人员';
  F.spaceKey = space => space ? [space.sales, space.customerId, space.pool || '待补客户池'].join('|') : '';
  F.findSpaceByTuple = (state, sales, customerId, pool) => state.spaces.find(space => space.sales === sales && space.customerId === customerId && (space.pool || '待补客户池') === (pool || '待补客户池'));
  F.ensureSpace = function (state, input) {
    const existing = F.findSpaceByTuple(state, input.sales, input.customerId, input.pool);
    if (existing) {
      existing.state = 'active'; existing.lifecycle = 'active'; existing.unfrozenAt = F.now(); existing.lifecycleChangedAt = F.now();
      existing.lifecycleEvents = Array.isArray(existing.lifecycleEvents) ? existing.lifecycleEvents : [];
      existing.lifecycleEvents.unshift({ type: 'unfrozen', at: F.now(), reason: '确权恢复，沿用原空间', result: 'success' });
      // 解冻提醒等空间内容就绪后再发给归属销售，避免点进来只看到空壳。
      F.notify(state, {
        type: '空间状态', title: '客户跟进空间已解冻', text: `${existing.customer} 的确权已恢复，沿用原空间继续经营。`,
        space: existing.id, recipients: [existing.sales], dedupKey: `unfreeze:${existing.id}:${F.now().slice(0, 10)}`, waitForSpace: existing.id,
        link: { page: 'followup-workbench', params: { space: existing.id } }
      });
      return existing;
    }
    const space = {
      id: F.uid('WS'), customerId: input.customerId, customer: input.customer || '待同步客户', industry: input.industry || '待补充', sales: input.sales, pool: input.pool || '', customerPoolSource: input.pool ? 'crm' : 'pending',
      state: 'active', lifecycle: 'active', readiness: 'updating', stage: '初步接触', grade: 'B', contact: '待补充', ownerOnly: !input.opportunity, entitlementType: input.opportunity ? 'customer_and_opportunity' : 'customer_only',
      entitlements: { customer: true, opportunities: input.opportunity ? [input.opportunity.id] : [] }, opps: input.opportunity ? [input.opportunity] : [], brief: '由 CRM 确权自动建立，等待内容装载。', updated: F.now(), createdAt: F.now(), lifecycleChangedAt: F.now(), readinessUpdatedAt: F.now(), lastReadableVersion: '', lastReadableAt: '', readinessReason: '空间已建立，内容正在装载。', failure: null,
      lifecycleEvents: [{ type: 'created', at: F.now(), reason: '确权生效后自动建立空间', result: 'success' }]
    };
    state.spaces.unshift(space);
    return space;
  };
  F.visible = function (state = F.load()) {
    const actor = F.actor && state.people.find(person => person.id === F.actor.id);
    if (!actor || actor.role !== F.role || actor.status !== 'on') return [];
    return state.spaces.filter(w => ['ADM', 'MGR'].includes(F.role) || (F.role === 'SLS' ? w.sales === F.actor.id : (state.assignments[F.actor.id] || []).includes(w.pool)));
  };
  F.space = (id, state = F.load()) => F.visible(state).find(w => w.id === id);
  F.canWrite = w => !!w && F.role === 'SLS' && w.sales === F.actor?.id && w.state === 'active';
  F.canSend = w => !!w && F.role === 'SOL' && w.state === 'active' && F.visible().some(x => x.id === w.id);
  F.records = (key, s = F.load()) => s[key].filter(r => F.space(r.space, s));

  /* ---------- R03 空间内容装载 ---------- */

  /** 内容范围按层展示装载状态，避免用一个总就绪度掩盖单层失败或空态。 */
  F.contentLayers = [
    { key: 'customer', label: '客户级信息', hint: '画像、风险标记、联系人' },
    { key: 'opportunity', label: '已确权商机', hint: '按本人确权范围装载' },
    { key: 'followup', label: '跟进与活动', hint: '仅确权范围内的经营记录' },
    { key: 'meeting', label: '录音关联', hint: '归位到本空间的会议录音' },
    { key: 'solution', label: '方案往来', hint: '本空间收到的方案与回复' },
    { key: 'document', label: '外部资料', hint: '方案人员上传的 .md 原文' }
  ];
  F.contentScope = function (space, state = F.load()) {
    const counts = {
      customer: 1,
      opportunity: (space.opps || []).length,
      followup: state.followups.filter(r => r.space === space.id).length,
      meeting: F.spacePlacements(space.id, state).length,
      solution: state.solutions.filter(r => r.space === space.id && !r.withdrawn).length,
      document: state.documents.filter(r => r.space === space.id && r.status !== 'rejected').length
    };
    const loading = ['preparing', 'updating'].includes(space.readiness);
    return F.contentLayers.map(layer => {
      const count = counts[layer.key] || 0;
      let status = 'ready', detail = layer.hint;
      if (space.readiness === 'failed' && space.failure?.layer === layer.key) { status = 'failed'; detail = space.failure.reason || '该层内容装载失败'; }
      else if (loading) { status = 'updating'; detail = '装载处理中，上一版内容继续可读'; }
      else if (!count) {
        status = 'empty';
        detail = layer.key === 'opportunity' && space.ownerOnly ? '仅客户级确权，商机列表为空' : layer.key === 'opportunity' && space.entitlementType === 'none' ? '当前无有效确权' : '暂无内容';
      }
      if (space.state === 'frozen' && status !== 'failed') detail = status === 'empty' ? detail : '空间已冻结，停止装载新增内容';
      return { ...layer, count, status, detail };
    });
  };

  F.documentMaxBytes = 20 * 1024 * 1024;
  F.documentRejectReasons = { format: '仅支持 .md 格式，未提交。', empty: '正文为空，未提交。', size: '超出单文件大小限制（20 MB），未提交。' };
  F.documentStatusLabels = { success: '已挂载', overview_updating: '概览更新中', failed: '挂载失败', duplicate: '重复资料', rejected: '校验不通过' };
  F.documentFileSize = function (bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1048576) return `${Math.round(n / 104857.6) / 10} MB`;
    if (n <= 0) return '0 KB';
    return `${Math.max(1, Math.round(n / 1024))} KB`;
  };
  F.documentFileName = function (file) {
    return String(file && (file.name || file.fileName) || '').trim();
  };
  F.isMarkdownDocument = function (file) {
    const name = F.documentFileName(file);
    const type = String(file && file.type || '').toLowerCase();
    return /\.md$/i.test(name) || type === 'text/markdown' || type === 'text/x-markdown';
  };
  /** 把本机选择的文件整理成挂载输入；不读二进制，只取文件名、大小和正文。 */
  F.normalizeUploadFile = function (file) {
    if (!file || typeof file !== 'object') return null;
    const name = F.documentFileName(file);
    if (!name) return null;
    const bytes = Number(file.size);
    const body = typeof file.body === 'string' ? file.body : typeof file.text === 'string' ? file.text : '';
    return {
      name,
      size: Number.isFinite(bytes) ? bytes : documentUtf8Length(body),
      displaySize: Number.isFinite(bytes) && bytes >= 0 ? F.documentFileSize(bytes) : F.documentFileSize(documentUtf8Length(body)),
      body,
      type: String(file.type || '')
    };
  };

  /**
   * 外部资料窄写入：方案人员需承接池内且空间正常；销售运营不看承接池，只要求账号可用且空间正常。
   * 超级管理员与销售不开放上传。
   */
  F.canUpload = function (space, state = F.load()) {
    if (!space || space.state !== 'active') return false;
    const actor = F.actor && state.people.find(person => person.id === F.actor.id);
    if (!actor || actor.status !== 'on') return false;
    if (F.role === 'MGR') return true;
    if (F.role !== 'SOL') return false;
    return (state.assignments[F.actor.id] || []).includes(space.pool);
  };
  F.assertUploadable = function (space, state) {
    if (!['SOL', 'MGR'].includes(F.role)) throw Error('仅解决方案人员或销售运营可以上传外部资料。');
    if (!space) throw Error('空间不在当前可见范围，或访问权限已变化。');
    if (space.state !== 'active') throw Error('空间已冻结，不开放资料上传与重试。');
    if (F.role === 'SOL' && !(state.assignments[F.actor.id] || []).includes(space.pool)) throw Error('该空间已不在你的承接客户池范围内，本批资料未写入。');
  };
  /** 销售运营在正常空间资料页可随时重装六层内容；冻结空间与其他角色不开放。 */
  F.canRefreshContent = function (space, state = F.load()) {
    if (!space || F.role !== 'MGR' || space.state !== 'active') return false;
    const actor = F.actor && state.people.find(person => person.id === F.actor.id);
    return !!actor && actor.status === 'on';
  };
  function applyContentRefresh(state, spaceId, trigger) {
    const space = F.space(spaceId, state);
    if (F.role !== 'MGR') throw Error('仅销售运营可以刷新全部内容。');
    if (!space) throw Error('空间不在当前可见范围。');
    if (space.state !== 'active') throw Error('空间已冻结，不开放全部内容更新。');
    const uploaded = trigger === 'upload';
    space.readiness = 'ready';
    space.readinessReason = '';
    space.readinessUpdatedAt = F.now();
    if (space.failure) { space.failure.status = 'resolved'; space.failure.resolvedAt = F.now(); }
    space.lifecycleEvents = Array.isArray(space.lifecycleEvents) ? space.lifecycleEvents : [];
    space.lifecycleEvents.unshift({ type: 'content_refresh', at: F.now(), reason: uploaded ? '上传外部资料后自动全量更新' : '销售运营手动刷新全部内容', result: 'success' });
    pushSpaceChange(state, space, {
      source: 'content_refresh', sourceRef: uploaded ? 'upload' : 'manual',
      sourceLabel: uploaded ? '外部资料上传后全量更新' : '刷新全部内容',
      status: 'done', added: ['已按当前确权范围重装客户级信息、商机、跟进、录音、方案往来和外部资料']
    });
    return space;
  }
  F.refreshSpaceContent = function (spaceId) {
    F.mutate('刷新空间全部内容', state => { applyContentRefresh(state, spaceId, 'manual'); });
  };

  /** 追加一条 R04 本次变化，并推进空间的概览版本与更新状态。 */
  function pushSpaceChange(state, space, input) {
    const base = space.lastReadableVersion || `content-${space.id}-v1`;
    const record = {
      id: F.uid('CHGX'), space: space.id, at: F.now(), source: input.source, sourceRef: input.sourceRef || '', sourceLabel: input.sourceLabel,
      status: input.status, baseVersion: base, resultVersion: '', notified: false,
      added: input.added || [], updated: input.updated || [], pendingConfirm: input.pendingConfirm || [], conflicts: input.conflicts || [], reason: input.reason || ''
    };
    if (input.status === 'done') {
      const next = base.replace(/v(\d+)$/, (_m, n) => 'v' + (Number(n) + 1));
      record.resultVersion = next === base ? base + '-v2' : next;
      space.lastReadableVersion = record.resultVersion; space.lastReadableAt = record.at;
      space.overviewStatus = 'ready'; space.overviewUpdatedAt = record.at; space.updated = record.at;
      // 有变化或待确认且结果可看时才提醒销售；无变化只更新页面状态。
      if (record.added.length || record.updated.length || record.pendingConfirm.length) {
        record.notified = true;
        F.notify(state, {
          type: '客户更新', title: '客户信息已更新', text: `${input.sourceLabel} 带来 ${record.added.length + record.updated.length} 处变化。`,
          space: space.id, changeId: record.id, recipients: [space.sales], dedupKey: `customer-update:${record.id}`,
          link: { page: 'followup-workbench', params: { space: space.id, tab: 'overview', change: record.id } }
        });
      }
    }
    if (input.status === 'nochange') { space.overviewStatus = 'ready'; space.overviewUpdatedAt = record.at; }
    // 更新失败只提醒销售运营与超管，不打扰销售；原内容保留可读。
    if (input.status === 'failed') {
      space.overviewStatus = 'failed';
      F.notify(state, {
        type: '运营异常', title: '客户信息更新失败', text: `${space.customer}：${input.reason || '概览更新失败，原文仍保留。'}`,
        space: space.id, changeId: record.id, recipients: F.opsRecipients(state), dedupKey: `ops:space-failed:${record.id}`, push: false,
        link: { page: 'followup-workbench', params: { space: space.id, tab: 'overview', change: record.id } }
      });
    }
    (space.pendingConfirm = space.pendingConfirm || []).push(...record.pendingConfirm.filter(item => !space.pendingConfirm.includes(item)));
    state.spaceChanges.unshift(record);
    return record;
  }

  /** 逐份校验与挂载本机文件；不合格文件不提交，其余文件继续，已成功的结果不回滚。 */
  F.uploadDocuments = function (spaceId, files) {
    const picked = (files || []).map(file => F.normalizeUploadFile(file)).filter(Boolean);
    if (!picked.length) throw Error('请至少选择一份待上传资料。');
    const results = [];
    F.mutate('上传外部资料', state => {
      const space = F.space(spaceId, state);
      F.assertUploadable(space, state);
      let order = state.documents.filter(doc => doc.space === spaceId).length;
      picked.forEach(file => {
        if (!F.isMarkdownDocument(file)) { results.push({ name: file.name, status: 'rejected', reason: F.documentRejectReasons.format }); return; }
        if (file.size > F.documentMaxBytes) { results.push({ name: file.name, status: 'rejected', reason: F.documentRejectReasons.size }); return; }
        if (!String(file.body || '').trim()) { results.push({ name: file.name, status: 'rejected', reason: F.documentRejectReasons.empty }); return; }
        // 每份挂载前再次校验权限与空间状态；处理中失权或冻结时停止尚未挂载的文件。
        const current = F.space(spaceId, state);
        if (!current || current.state !== 'active') { results.push({ name: file.name, status: 'blocked', reason: '空间状态或访问权限已变化，该文件未挂载。' }); return; }
        const hash = documentHash(file.body);
        const same = state.documents.find(doc => doc.space === spaceId && doc.name === file.name && doc.hash === hash);
        if (same) { results.push({ name: file.name, status: 'duplicate', reason: '内容完全相同，未重复挂载。', ref: same.id }); return; }
        const sameName = state.documents.some(doc => doc.space === spaceId && doc.name === file.name);
        order += 1;
        // 本地演示只保留正文前 4000 字供查看原文；重复判定仍按完整正文指纹。
        const excerpt = String(file.body).slice(0, 4000);
        const doc = {
          id: F.uid('DOC'), space: spaceId, name: file.name, uploader: F.actor.id, uploadedAt: F.now(), size: file.displaySize, order,
          hash, excerpt, retryCount: 0,
          note: sameName ? '同名但内容不同，作为新增资料处理，未覆盖旧资料。' : '',
          status: 'success', stage: 'overview_done',
          reason: '',
          overviewStatus: 'applied'
        };
        state.documents.unshift(doc);
        const change = pushSpaceChange(state, space, {
          source: 'document', sourceRef: doc.id, sourceLabel: `外部资料《${doc.name}》`, status: 'done',
          added: [`资料要点：${excerpt.slice(0, 24)}…`],
          pendingConfirm: sameName ? ['同名资料存在两个版本，需确认以哪一版为准'] : []
        });
        doc.changeId = change.id;
        results.push({ name: file.name, status: doc.status, reason: doc.reason, id: doc.id, note: doc.note });
      });
      if (F.role === 'MGR' && results.some(item => item.status === 'success')) applyContentRefresh(state, spaceId, 'upload');
    });
    return results;
  };

  /** 单份重试：只影响该份资料，同批其他成功结果不回滚。 */
  F.retryDocument = function (docId) {
    F.mutate('重试外部资料挂载', state => {
      const doc = state.documents.find(item => item.id === docId);
      if (!doc) throw Error('资料不存在，请刷新后重试。');
      if (doc.status !== 'failed') throw Error('该资料无需重试。');
      const space = F.space(doc.space, state);
      if (!space) throw Error('空间不在当前可见范围。');
      if (space.state !== 'active') throw Error('空间已冻结，不开放资料重试。');
      const canRetry = F.role === 'MGR' || (F.role === 'SOL' && doc.uploader === F.actor.id);
      if (!canRetry) throw Error('仅上传者本人或销售运营可以重试。');
      doc.status = 'success'; doc.stage = 'overview_done'; doc.reason = ''; doc.overviewStatus = 'applied';
      doc.retryCount = Number(doc.retryCount || 0) + 1; doc.lastRetryAt = F.now();
      pushSpaceChange(state, space, { source: 'document', sourceRef: doc.id, sourceLabel: `外部资料《${doc.name}》`, status: 'done', added: [`资料要点：${(doc.excerpt || '').slice(0, 24)}…`] });
      if (F.role === 'MGR') applyContentRefresh(state, space.id, 'upload');
    });
  };

  /* ---------- R04 客户空间全景与溯源 ---------- */

  F.overviewPanels = [
    ['who', '客户是谁'], ['basics', '基本情况'], ['risk', '风险标记'], ['last', '上次聊到哪'], ['blocker', '当前卡点'],
    ['recent', '最近动静'], ['people', '关键人与决策链'], ['opportunity', '商机与金额'], ['pending', '待确认信息'], ['verdict', '一句话判断']
  ];

  /** 概览结论全部由空间内已装载原文推导；没有依据的板块给空态，不推测补齐。 */
  F.overview = function (space, state = F.load()) {
    const followups = state.followups.filter(r => r.space === space.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // R10：录音进入概览的依据是「归位到本空间」，而不是录音自身带一个空间字段。
    const meetings = F.spacePlacements(space.id, state).map(item => F.recording(item.recording, state)).filter(Boolean);
    const solutions = state.solutions.filter(r => r.space === space.id && !r.withdrawn);
    const docs = state.documents.filter(r => r.space === space.id && r.status === 'success');
    const withdrawn = state.solutions.filter(r => r.space === space.id && r.withdrawn);
    const crmSource = { type: 'crm', id: space.customerId, label: 'CRM 客户档案', at: state.crm?.lastSyncAt || '', available: true };
    const fuSource = record => ({ type: 'followup', id: record.id, label: `跟进记录 · ${record.type}`, at: record.date, available: true });
    const panel = (key, title, text, sources, status) => ({ key, title, text, sources: sources || [], status: status || (text ? 'ready' : 'empty') });
    const latest = followups[0];
    const recent = [
      ...followups.slice(0, 2).map(fuSource),
      ...meetings.slice(0, 1).map(m => ({ type: 'meeting', id: m.id, label: `客户录音 · ${m.title}`, at: m.date, available: true })),
      ...solutions.slice(0, 1).map(s => ({ type: 'solution', id: s.id, label: `方案往来 · ${s.title}`, at: s.date, available: true })),
      ...docs.slice(0, 1).map(d => ({ type: 'document', id: d.id, label: `外部资料 · ${d.name}`, at: d.uploadedAt, available: true })),
      // 来源失效仍保留标识和不可用说明，不伪装成已验证事实。
      ...withdrawn.slice(0, 1).map(s => ({ type: 'solution', id: s.id, label: `方案往来 · ${s.title}`, at: s.date, available: false, unavailableReason: '该方案已被方案人员撤回，原文不再可读。' }))
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const recentShown = [...recent.filter(item => item.available !== false).slice(0, 3), ...recent.filter(item => item.available === false)];
    const conflict = (space.conflicts || [])[0];
    const pending = [...new Set([...(space.pendingConfirm || []), ...state.spaceChanges.filter(c => c.space === space.id).flatMap(c => c.pendingConfirm || [])])];
    const oppText = space.opps.length ? space.opps.map(o => `${o.name}（${o.amount} 万元 · ${o.stage}）`).join('；') : '';
    return [
      panel('who', '客户是谁', `${space.customer} · ${space.industry}行业 · ${space.pool || '客户池待补'}`, [crmSource]),
      panel('basics', '基本情况', `客户等级 ${space.grade}，当前经营阶段：${space.stage}。客户池来源：${space.customerPoolSource === 'pending' ? 'CRM 暂无客户池' : 'CRM 当前客户池'}。`, [crmSource]),
      panel('risk', '风险标记', space.readiness === 'failed' ? '内容更新失败，当前结论基于上一版原文。' : space.state === 'frozen' ? '确权已结束，空间冻结，无新增经营内容。' : space.ownerOnly ? '仅客户级确权，暂无本人确权商机。' : conflict ? `存在信息冲突：${conflict.field}。` : '暂无风险标记。', space.readiness === 'failed' || space.state === 'frozen' ? [] : [crmSource], conflict ? 'conflict' : 'ready'),
      panel('last', '上次聊到哪', latest ? latest.text : '', latest ? [fuSource(latest)] : []),
      panel('blocker', '当前卡点', space.brief, [crmSource, ...(latest ? [fuSource(latest)] : [])]),
      // 失效来源不参与裁剪，始终保留标识和不可用说明。
      panel('recent', '最近动静', recent.length ? recentShown.map(item => item.label).join('；') : '', recentShown),
      panel('people', '关键人与决策链', `第一关键人：${space.contact}。决策链：技术评估 → 采购确认 → 业务验收。完整联系人见客户 Tab。`, [crmSource]),
      panel('opportunity', '商机与金额', oppText, space.opps.length ? [crmSource] : []),
      panel('pending', '待确认信息', pending.length ? pending.join('；') : '', [], pending.length ? 'pending' : 'empty'),
      panel('verdict', '一句话判断', latest || docs.length ? `${space.customer}处于${space.stage}阶段，下一步聚焦：${space.brief}` : '', [crmSource, ...(latest ? [fuSource(latest)] : [])])
    ];
  };

  /** 结论与变化都可以点回原文；来源失效时保留标识和不可用说明。 */
  F.sourceRecord = function (source, state = F.load()) {
    const { type, id } = typeof source === 'string' ? { type: source.split(':')[0], id: source.split(':')[1] } : source;
    if (type === 'followup') {
      const record = state.followups.find(item => item.id === id);
      return record ? { title: `跟进记录 · ${record.type}`, body: record.text + (record.next ? `\n\n下一步：${record.next}` : ''), at: record.date, author: F.name(record.author), available: true } : null;
    }
    if (type === 'meeting') {
      const record = (state.meetings || []).find(item => item.id === id);
      if (!record) return null;
      // 来源内容异常时如实说明，不用摘要冒充原文；文本随同步一并取得。
      const issue = F.recordingSourceIssue(record);
      return {
        title: `客户录音 · ${record.title}`, body: issue ? '' : (record.transcript || record.summary || ''),
        at: record.date, author: record.ownerResolved === false ? '归属待处理' : F.name(record.owner), available: !issue,
        unavailableReason: issue
      };
    }
    if (type === 'solution') {
      const record = state.solutions.find(item => item.id === id);
      if (!record) return null;
      return { title: `方案往来 · ${record.title}`, body: record.withdrawn ? '' : record.body, at: record.date, author: F.name(record.author), available: !record.withdrawn, unavailableReason: record.withdrawn ? '该方案已被方案人员撤回，原文不再可读。' : '' };
    }
    if (type === 'document') {
      const record = state.documents.find(item => item.id === id);
      return record ? { title: `外部资料 · ${record.name}`, body: record.excerpt || '', at: record.uploadedAt, author: F.name(record.uploader), available: record.status !== 'failed', unavailableReason: record.status === 'failed' ? '该资料挂载失败，原文已保留但尚未参与概览更新。' : '' } : null;
    }
    if (type === 'crm') return { title: 'CRM 客户档案', body: '客户主数据来自 CRM 同步，本地不可编辑。', at: state.crm?.lastSyncAt || '', author: 'CRM', available: true };
    return null;
  };

  F.changesOf = (spaceId, state = F.load()) => state.spaceChanges.filter(item => item.space === spaceId);

  /** 更新历史：与跟进 Tab 同源的空间事件流，按时间倒序全量返回、不裁剪（M02-3 §4.3，0921 口径）。 */
  F.updateHistory = (spaceId, state = F.load()) => F.changesOf(spaceId, state).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));

  /* ---------- R10 录音归位与客户信息更新 ---------- */

  /** 同步、归位处理、行为记录几条状态线分开展示，不用一个「完成」覆盖全部阶段；转写由三方完成，本系统不设转写状态。 */
  F.recordingSyncMeta = { synced: ['已同步', 'green'], failed: ['同步失败', 'amber'] };
  F.placementStatusMeta = {
    updating: ['客户信息更新中', 'brand'],
    done: ['更新完成 · 有变化', 'green'], nochange: ['更新完成 · 无变化', 'neutral'],
    failed: ['更新未完成', 'amber'], canceled: ['已取消归位', 'neutral']
  };
  F.recordingStateMeta = { unplaced: ['未归位', 'amber'], placed: ['已归位', 'green'], blocked: ['不可归位', 'neutral'] };

  F.recording = (id, state = F.load()) => (state.meetings || []).find(item => item.id === id) || null;

  /** 一份录音的归位列表；已取消的默认不计入业务结果，只在录音详情里作为留痕展示。 */
  F.recordingPlacements = (recordingId, state = F.load(), includeCanceled = false) =>
    (state.placements || []).filter(item => item.recording === recordingId && (includeCanceled || item.status !== 'canceled'));

  /** 本空间的有效归位：从任一空间只看到与本空间相关的那条，看不到这份录音还挂在别处。 */
  F.spacePlacements = (spaceId, state = F.load()) =>
    (state.placements || []).filter(item => item.space === spaceId && item.status !== 'canceled')
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));

  /** 录音管理可见范围：销售只看归属本人的；运营与超管全量只读；方案人员只看归位进承接空间的。 */
  F.recordings = function (state = F.load()) {
    const list = (state.meetings || []).filter(item => item.ownerResolved !== false);
    if (F.role === 'SLS') return list.filter(item => item.owner === F.actor?.id);
    if (['ADM', 'MGR'].includes(F.role)) return list;
    return list.filter(item => F.recordingPlacements(item.id, state).some(placement => F.space(placement.space, state)));
  };

  /** 归属销售标识缺失的录音不进任何人的录音管理，只进运营待处理清单，不静默丢弃。 */
  F.unresolvedRecordings = (state = F.load()) => (state.meetings || []).filter(item => item.ownerResolved === false);

  /**
   * 来源内容异常：三方已完成的转写文本是后续处理的唯一输入（M05-2 §4.1、0921 口径）。
   * 同步失败，或同步成功却没带回文本，都按来源异常处理——不归位、不进入客户信息更新，
   * 也不伪装成「等待转写」；重新同步取得文本后按归位、空间状态与去重规则继续。
   * @returns {string} 空串表示来源正常；否则返回可直接展示的异常说明
   */
  F.recordingSourceIssue = function (recording) {
    if (!recording) return '录音不存在或不在当前可见范围。';
    if (recording.syncStatus === 'failed') return recording.syncReason || '三方录音服务同步失败，尚未取得录音内容。';
    if (!String(recording.transcript || '').trim()) return '三方录音服务未返回转写文本，本条来源内容异常。';
    return '';
  };

  /** 录音层状态：来源异常不可归位；其余按是否已有有效归位判断。处理结果按每条归位独立展示。 */
  F.recordingState = function (recording, state = F.load()) {
    if (!recording) return 'unplaced';
    if (F.recordingSourceIssue(recording)) return 'blocked';
    return F.recordingPlacements(recording.id, state).length ? 'placed' : 'unplaced';
  };

  /** 录音对应的行为记录按归位记录挂：一份录音挂多处时，每条归位各有一条独立行为记录。 */
  F.placementBehavior = (placementId, state = F.load()) => F.behaviorForEvent(state, 'meeting', placementId);

  /**
   * 归位前置校验，顺序固定、先命中先返回：
   * 同步失败 → 冻结 → 非本人空间 → 无商机确权 → 多商机未指定 → 同空间已存在。
   */
  F.assertPlaceable = function (state, recording, space, opportunityId) {
    if (!recording) throw Error('录音不存在或不在当前可见范围。');
    if (recording.syncStatus === 'failed') throw Error('该录音同步失败，请先重新同步后再归位。');
    // 同步成功但没带回转写文本：同样不可归位，避免用空输入触发客户信息更新。
    if (!String(recording.transcript || '').trim()) throw Error('该录音来源内容异常（未取得三方转写文本），请先重新同步后再归位。');
    if (F.role !== 'SLS' || recording.owner !== F.actor?.id) throw Error('录音归位由归属销售本人操作。');
    if (!space) throw Error('目标空间不在当前可见范围。');
    if (space.state === 'frozen') throw Error('空间已冻结，不可新增或取消归位。');
    if (space.sales !== F.actor?.id) throw Error('只能归位到本人的客户空间。');
    const opps = space.opps || [];
    if (!opps.length) throw Error('该空间仅有客户级确权、没有商机；归位必须锚定商机。');
    if (!opportunityId) throw Error(opps.length > 1 ? '该空间下有多条商机，请先指定一条，系统不代选。' : '请选择要锚定的商机。');
    if (!opps.some(item => item.id === opportunityId)) throw Error('所选商机不在该空间的确权范围内。');
    if (F.recordingPlacements(recording.id, state).some(item => item.space === space.id)) throw Error('该录音已归位到这个客户空间，不重复建立。');
  };

  /**
   * 归位后使用三方已同步的转写文本开始客户信息更新；一次处理同时产出客户信息变化与一条行为记录。
   * 失败保留原内容并只提醒运营；无变化只更新状态、不提醒。
   * 调用前已由 assertPlaceable 保证来源内容可用、空间未冻结，因此这里不再设闸门。
   */
  function runPlacementUpdate(state, placement) {
    const recording = F.recording(placement.recording, state);
    const space = state.spaces.find(item => item.id === placement.space);
    if (!recording || !space) return;
    const text = String(recording.transcript || recording.summary || '').trim();
    const label = `客户录音 · ${recording.title}`;
    placement.startedAt = F.now();
    // 演示口径：转写正文含「演示失败」走更新失败；正文过短视为本次未发现客户信息变化。
    const outcome = text.includes('演示失败') ? 'failed' : text.length < 12 ? 'nochange' : 'done';
    const excerpt = text.replace(/\s+/g, ' ').slice(0, 24);
    const change = pushSpaceChange(state, space, outcome === 'failed'
      ? { source: 'meeting', sourceRef: recording.id, sourceLabel: label, status: 'failed', reason: '录音内容更新服务超时，本次更新未完成，原内容保留。' }
      : outcome === 'nochange'
        ? { source: 'meeting', sourceRef: recording.id, sourceLabel: label, status: 'nochange' }
        : { source: 'meeting', sourceRef: recording.id, sourceLabel: label, status: 'done', added: [`录音要点：${excerpt}…`] });
    placement.changeId = change.id;
    placement.status = outcome;
    placement.failReason = outcome === 'failed' ? '录音内容更新服务超时，本次更新未完成，原内容保留。' : '';
    placement.completedAt = outcome === 'failed' ? '' : F.now();
    // 同批触发行为记录；行为记录失败不阻塞已完成的客户信息结果，也不单独发提醒。
    const behavior = F.generateBehavior(state, space, {
      eventType: 'meeting', eventId: placement.id, sourceRef: recording.id, eventAt: placement.at,
      author: placement.by, opportunityId: placement.opportunityId, text
    });
    if (behavior) placement.behaviorId = behavior.id;
  }

  /** 建立一条归位：锚定一个空间与一条商机；来源内容可用时立即进入客户信息更新。 */
  F.placeRecording = function (recordingId, input) {
    let created = null;
    F.mutate('录音归位', state => {
      const recording = F.recording(recordingId, state);
      const space = F.space(input.space, state);
      F.assertPlaceable(state, recording, space, input.opportunityId);
      const placement = normalizePlacement({
        id: F.uid('PL'), recording: recording.id, space: space.id, opportunityId: input.opportunityId,
        by: F.actor.id, at: F.now(), status: 'updating'
      });
      state.placements.unshift(placement);
      runPlacementUpdate(state, placement);
      created = placement;
    });
    return created;
  };

  /** 逐条取消：录音文件与其他归位不受影响；已生成的变化与行为记录保留并标注原归位已取消。 */
  F.cancelPlacement = function (placementId) {
    F.mutate('取消录音归位', state => {
      const placement = (state.placements || []).find(item => item.id === placementId);
      if (!placement || placement.status === 'canceled') throw Error('该归位不存在或已取消。');
      const space = F.space(placement.space, state);
      if (!space) throw Error('目标空间不在当前可见范围。');
      if (space.state === 'frozen') throw Error('空间已冻结，不可新增或取消归位。');
      if (F.role !== 'SLS' || placement.by !== F.actor?.id) throw Error('取消归位由归位人本人操作。');
      placement.status = 'canceled';
      placement.canceledAt = F.now();
      placement.canceledBy = F.actor.id;
    });
  };

  /**
   * 同步失败后重新同步：单条失败不影响其余录音。
   * 成功后取回三方已有的智能总结与原文，回到可归位状态；未取得文本时保持来源异常，不伪装成等待转写。
   */
  F.retryRecordingSync = function (recordingId) {
    F.mutate('重新同步录音', state => {
      const recording = F.recording(recordingId, state);
      if (!recording) throw Error('录音不存在，请刷新后重试。');
      if (recording.syncStatus !== 'failed') throw Error('该录音无需重新同步。');
      if (!(F.role === 'ADM' || (F.role === 'SLS' && recording.owner === F.actor?.id))) throw Error('仅归属销售本人或超级管理员可以重新同步。');
      recording.syncStatus = 'synced';
      recording.syncReason = '';
      recording.syncedAt = F.now();
      recording.retryCount = Number(recording.retryCount || 0) + 1;
      recording.transcript = recording.transcript || '00:14  客户：这次先对齐需求边界，方案下周给到。\n05:20  销售：我按今天确认的范围整理一版。';
      recording.summary = recording.summary || '客户确认需求边界，方案下周给到。';
    });
  };

  /**
   * 演示口径：把一条「客户信息更新中」的归位推进到实际结果。
   * 原型不做真实异步处理，用这个入口演示更新完成后产出本次变化与行为记录；
   * 真实环境由服务端在处理完成时回填，页面不承诺固定时长。
   */
  F.completePlacementUpdate = function (placementId) {
    F.mutate('录音客户信息更新完成演示', state => {
      const placement = (state.placements || []).find(item => item.id === placementId);
      if (!placement) throw Error('该归位不存在，请刷新后重试。');
      if (placement.status !== 'updating') throw Error('该归位不在客户信息更新中。');
      const space = F.space(placement.space, state);
      if (!space) throw Error('目标空间不在当前可见范围。');
      if (space.state === 'frozen') throw Error('空间已冻结，客户信息停更。');
      if (!(['ADM', 'MGR'].includes(F.role) || (F.role === 'SLS' && placement.by === F.actor?.id))) throw Error('仅归位人本人、销售运营或超级管理员可以推进。');
      runPlacementUpdate(state, placement);
    });
  };

  /** 更新失败后重试：只重跑这一条归位，其他空间的结果不受影响。 */
  F.retryPlacementUpdate = function (placementId) {
    F.mutate('重试录音客户信息更新', state => {
      const placement = (state.placements || []).find(item => item.id === placementId);
      if (!placement) throw Error('该归位不存在，请刷新后重试。');
      if (placement.status !== 'failed') throw Error('该归位无需重试。');
      const space = F.space(placement.space, state);
      if (!space) throw Error('目标空间不在当前可见范围。');
      if (space.state === 'frozen') throw Error('空间已冻结，不开放内容重试。');
      if (!(['ADM', 'MGR'].includes(F.role) || (F.role === 'SLS' && placement.by === F.actor?.id))) throw Error('仅归位人本人、销售运营或超级管理员可以重试。');
      placement.retryCount = Number(placement.retryCount || 0) + 1;
      const recording = F.recording(placement.recording, state);
      if (recording) recording.transcript = String(recording.transcript || '').replace('演示失败', '');
      runPlacementUpdate(state, placement);
    });
  };

  /* ---------- R15 跟进事件行为记录 ---------- */

  F.behaviorStatusMeta = { processing: ['处理中', 'brand'], done: ['已完成', 'green'], failed: ['生成失败', 'amber'], empty: ['无可用内容', 'neutral'] };
  F.behaviorEventLabels = { followup: '手写跟进', weekly_review: '周复盘', meeting: '录音归位', daily_summary: '当日汇总' };

  /** 行为记录挂空间维度并按事件时间倒序；无权空间返回空，冻结空间照常返回只读历史。 */
  F.behaviorsOf = function (spaceId, state = F.load()) {
    if (!F.space(spaceId, state)) return [];
    return (state.behaviorRecords || []).filter(record => record.space === spaceId)
      .sort((a, b) => String(b.eventAt).localeCompare(String(a.eventAt)));
  };

  /** 一事件最多一条：按事件类型与事件 id 去重，事件卡片关联与生成校验共用。 */
  F.behaviorForEvent = (state, eventType, eventId) => (state.behaviorRecords || []).find(record => record.eventType === eventType && record.eventId === eventId);

  /**
   * 由跟进事件生成一条行为记录（内部方法，由手写跟进、周复盘、录音归位等触发点调用）。
   * 规则：冻结空间不生成；同一事件不重复生成；内容过短记「无可用内容」不编造；
   * 失败只落状态不写占位内容；全程不发提醒，也不阻塞同批的客户信息更新。
   */
  F.generateBehavior = function (state, space, event) {
    if (!space || space.state === 'frozen') return null;
    state.behaviorRecords = Array.isArray(state.behaviorRecords) ? state.behaviorRecords : [];
    if (F.behaviorForEvent(state, event.eventType, event.eventId)) return null;
    const text = String(event.text || '').trim();
    if (!text) return null;
    const base = {
      id: F.uid('BR'), space: space.id, opportunityId: event.opportunityId || '', kind: '单次跟进',
      eventType: event.eventType, eventId: event.eventId, sourceRef: event.sourceRef || '', eventAt: event.eventAt || F.now(),
      author: event.author || space.sales, createdAt: F.now(),
      summary: '', keyBehaviors: [], issues: [], improvements: [], nextQuestions: [], failReason: '', note: '', completedAt: ''
    };
    // 演示阈值：正文不足 10 字视为无可用内容（待产品确认阈值）；正文含「演示失败」走失败分支。
    if (text.length < 10) {
      state.behaviorRecords.unshift({ ...base, status: 'empty', note: '本次事件内容过短，无可用内容，未做归纳。', completedAt: F.now() });
    } else if (text.includes('演示失败')) {
      state.behaviorRecords.unshift({ ...base, status: 'failed', failReason: '行为分析服务超时，未写入占位记录。' });
    } else {
      const excerpt = text.length > 26 ? text.slice(0, 26) + '…' : text;
      const scene = event.eventType === 'meeting' ? '会议沟通' : event.eventType === 'weekly_review' ? '周复盘' : '跟进沟通';
      state.behaviorRecords.unshift({
        ...base, status: 'done', completedAt: F.now(),
        summary: `本次${scene}：${excerpt}`,
        keyBehaviors: ['围绕客户当前问题逐项确认', '现场记录客户反馈与口径'],
        issues: ['部分关键信息仍待客户确认'],
        improvements: ['下次沟通前先发出确认清单'],
        nextQuestions: [event.next || '客户侧下一步的时间与责任人？']
      });
    }
    return state.behaviorRecords[0];
  };

  /** R14 晚间日报的唯一读取入口：只返回窗口内已完成记录；处理中 / 失败 / 无可用内容不进入汇总。 */
  F.completedBehaviors = function (state, window = {}) {
    const { start = '', end = '9999-12-31 23:59' } = window;
    return (state.behaviorRecords || []).filter(record => record.status === 'done' && String(record.eventAt) >= start && String(record.eventAt) <= end);
  };

  /* ---------- R14 晚间日报与当日变化分析 ---------- */

  // 日报四态与 spaceChanges 的 nochange 区分命名，避免联合展示时撞车。
  F.dailyReportStatusMeta = { success: ['成功', 'green'], partial: ['部分成功', 'amber'], failed: ['失败', 'red'], empty: ['无有效变化', 'neutral'] };
  F.dailyPromptKeys = ['changeDetection', 'behaviorSummary', 'blockGeneration', 'overviewGeneration'];

  /** 下一自然日：日报提示词发布/回退与全局时间调整的统一生效口径（与 R13 同一算法）。 */
  function dailyNextDay() {
    const time = Date.parse(F.today + 'T00:00:00Z');
    return Number.isFinite(time) ? new Date(time + 86400000).toISOString().slice(0, 10) : F.today;
  }
  function dailyPrevDay() {
    const time = Date.parse(F.today + 'T00:00:00Z');
    return Number.isFinite(time) ? new Date(time - 86400000).toISOString().slice(0, 10) : F.today;
  }

  /** 窗口内变化：左开右闭（上一计划截止 → 本次计划截止），跨日事件只归入一个窗口。 */
  function dailyWindowChanges(state, spaceId, start, end) {
    return (state.spaceChanges || []).filter(item => item.space === spaceId && String(item.at) > start && String(item.at) <= end);
  }

  /** 有效输入判定：存在带净变化（新增/更新/待确认/冲突）的已完成变化，或 ≥2 条窗口内已完成行为记录（跨事件模式）。 */
  function dailyHasEffectiveInput(changes, behaviors) {
    const contentChange = changes.some(item => item.status === 'done'
      && ((item.added || []).length || (item.updated || []).length || (item.pendingConfirm || []).length || (item.conflicts || []).length));
    return contentChange || behaviors.length >= 2;
  }

  /**
   * 由窗口内真实输入确定性组装客户块（演示口径，不调用真实模型）：
   * 净变化取窗口开始态到截止最终态；每栏最多 3 条、依据最多 3 条；
   * 部分上游失败时只消费成功结果并标记「部分信息尚未更新」；单条行为记录不重复归纳。
   */
  function buildDailyBlock(state, space, changes, behaviors) {
    const done = changes.filter(item => item.status === 'done');
    const failedUpstream = changes.filter(item => item.status === 'failed');
    const keyChanges = [
      ...done.flatMap(item => item.added || []),
      ...done.flatMap(item => (item.updated || []).map(u => `${u.field}：${u.before} → ${u.after}`)),
      ...done.flatMap(item => (item.conflicts || []).map(c => `新增未解决冲突：${c.field}`))
    ].slice(0, 3);
    const pending = [
      ...done.flatMap(item => item.pendingConfirm || []),
      ...done.flatMap(item => (item.conflicts || []).map(c => `${c.field} 以哪一口径为准`))
    ].slice(0, 3);
    // 跨事件归纳：≥2 条已完成记录才形成当日结论；推测用「建议准备」表述，不写成客户事实。
    const behavior = behaviors.length >= 2
      ? [`当日 ${behaviors.length} 次跟进形成跨事件结论：${behaviors.map(record => record.summary).join('；').slice(0, 60)}。`, `参与记录 ${behaviors.length} 条（${behaviors.map(record => record.id).join('、')}）`]
      : [];
    const collaboration = state.solutions.filter(item => item.space === space.id && !item.withdrawn).slice(0, 3)
      .map(item => item.reply ? `方案《${item.title}》销售已回复：${item.reply}` : `方案《${item.title}》待销售回复，建议准备协同材料。`);
    const sources = [
      ...done.map(item => ({ type: 'change', id: item.id, label: `客户变化 · ${item.sourceLabel}`, at: item.at })),
      ...behaviors.map(item => ({ type: 'behavior', id: item.id, label: `行为记录 · ${item.id}（${F.behaviorEventLabels[item.eventType] || item.eventType}）`, at: item.eventAt }))
    ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 3);
    return {
      id: F.uid('DRB'), space: space.id, customerId: space.customerId, customer: space.customer, sales: space.sales,
      status: failedUpstream.length ? 'partial' : 'success',
      frozen: space.state === 'frozen', frozenAt: space.state === 'frozen' ? space.frozenAt || '' : '',
      lastResultAt: sources[0]?.at || '',
      missingNote: failedUpstream.length ? `部分信息尚未更新：${failedUpstream.map(item => item.sourceLabel).join('、')} 未完成，未参与本次汇总。` : '',
      failReason: '',
      sections: {
        current: `${space.stage}阶段：${space.brief}（截止时状态）。`,
        keyChanges,
        impact: keyChanges.length ? ['上述变化可能影响近期验收与排期，建议准备对应材料。'] : [],
        pending, behavior, collaboration, sources
      },
      behaviorSummaryWritten: false
    };
  }

  /** 截止时锁定 + 发送前复核：按销售归属与方案承接关系组装接收人，再按当前权限剔除失权者。 */
  function dailyRecipients(state, spaces, lockedAt, checkedAt) {
    const map = new Map();
    const solPeople = state.people.filter(person => person.role === 'SOL' && person.status === 'on');
    spaces.forEach(space => {
      if (!map.has(space.sales)) map.set(space.sales, { person: space.sales, kind: 'sales', spaces: [] });
      if (!map.get(space.sales).spaces.includes(space.id)) map.get(space.sales).spaces.push(space.id);
      solPeople.filter(person => (state.assignments[person.id] || []).includes(space.pool)).forEach(person => {
        if (!map.has(person.id)) map.set(person.id, { person: person.id, kind: 'solution', spaces: [] });
        if (!map.get(person.id).spaces.includes(space.id)) map.get(person.id).spaces.push(space.id);
      });
    });
    // 交 R12 前按 R05 当前权限复核：账号停用、角色不符或归属/承接关系已移除的接收人剔除。
    return [...map.values()]
      .map(item => ({ ...item, lockedAt, checkedAt, result: 'passed' }))
      .filter(item => {
        const person = state.people.find(p => p.id === item.person);
        if (!person || person.status !== 'on') return false;
        if (item.kind === 'sales') return person.role === 'SLS' && item.spaces.some(id => state.spaces.find(w => w.id === id)?.sales === item.person);
        return person.role === 'SOL' && item.spaces.some(id => (state.assignments[item.person] || []).includes(state.spaces.find(w => w.id === id)?.pool));
      });
  }

  /** 成功或部分成功后写回「当日汇总」：仅实际进入日报且有跨事件结论的客户，按 日期+空间 至多一条。 */
  function writeDailySummaries(state, report) {
    report.blocks.forEach(block => {
      const behaviors = F.completedBehaviors(state, { start: report.windowStart, end: report.windowEnd }).filter(record => record.space === block.space);
      if (behaviors.length < 2) return;
      const eventId = `daily-summary:${report.reportDate}:${block.space}`;
      if (state.behaviorRecords.some(record => record.eventType === 'daily_summary' && record.eventId === eventId)) return;
      block.behaviorSummaryWritten = true;
      state.behaviorRecords.unshift(normalizeBehaviorRecord({
        id: F.uid('BR'), space: block.space, opportunityId: '', kind: '当日汇总', eventType: 'daily_summary', eventId,
        eventAt: report.completedAt, author: block.sales, status: 'done',
        summary: block.sections.behavior[0] || '当日多次跟进形成跨事件结论。',
        note: `由晚间日报 ${report.id} 写回；只有形成跨事件新结论时才写入。`,
        createdAt: report.completedAt, completedAt: report.completedAt
      }, state.behaviorRecords.length));
    });
  }

  /**
   * 按当前角色权限返回某日日报快照：销售看本人客户块 + 今日总览；方案人员看承接客户块合集（按客户去重、无总览）；
   * 运营/超管看全量。每次调用都经 F.visible 重新过滤，失权客户块与失败客户条目不返回。
   */
  F.dailyReportFor = function (date, state = F.load()) {
    const report = (state.dailyReports || []).find(item => item.reportDate === date);
    if (!report) return null;
    const isOps = ['ADM', 'MGR'].includes(F.role);
    const visibleIds = new Set(F.visible(state).map(w => w.id));
    let blocks = (report.blocks || []).filter(block => isOps || visibleIds.has(block.space));
    // 方案人员合集按客户去重：同客户多个空间只保留最后有效结果最新的一块。
    if (F.role === 'SOL') {
      const byCustomer = new Map();
      blocks.forEach(block => {
        const prev = byCustomer.get(block.customerId);
        if (!prev || String(block.lastResultAt) > String(prev.lastResultAt)) byCustomer.set(block.customerId, block);
      });
      blocks = [...byCustomer.values()];
    }
    // 客户块按最后有效结果完成时间倒序，同时间按客户名称；顺序固定不代表优先级。
    blocks = blocks.slice().sort((a, b) => String(b.lastResultAt).localeCompare(String(a.lastResultAt)) || String(a.customer).localeCompare(String(b.customer)));
    const failedCustomers = (report.failedCustomers || []).filter(item => isOps || visibleIds.has(item.space));
    return { report, blocks, overview: F.role === 'SOL' ? null : report.overview || null, failedCustomers, isOps };
  };

  /** 30 天历史：用户视角排除「无有效变化」日（只在运营运行记录保留）；每条带权限过滤后的客户块数。 */
  F.dailyReportHistory = function (state = F.load()) {
    const sinceTime = Date.parse(F.today + 'T00:00:00Z') - 29 * 86400000;
    const since = Number.isFinite(sinceTime) ? new Date(sinceTime).toISOString().slice(0, 10) : F.today;
    return (state.dailyReports || [])
      .filter(item => item.reportDate && item.reportDate >= since && item.status !== 'empty')
      .map(item => {
        const view = F.dailyReportFor(item.reportDate, state);
        return { id: item.id, reportDate: item.reportDate, status: item.status, blockCount: view ? view.blocks.length : 0, failedCount: view ? view.failedCustomers.length : 0, inputCutoff: item.inputCutoff, promptVersion: item.promptVersion, completedAt: item.completedAt };
      })
      .sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)));
  };

  /**
   * 手动演示一次日报生成（完整状态机）：窗口确定 → 输入读取 → 有效变化判断 → 客户块/总览 → 接收人锁定与复核 → 送达与写回。
   * 当日已有结果按「重复生成只保留一份」拒绝；成功/部分成功经 F.notify 发「日报送达」，全部失败发一次「日报失败」，无有效变化不发。
   */
  F.runDailyReport = function () {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以生成晚间日报。');
    let result = null;
    F.mutate('生成晚间日报', state => {
      state.dailyReports = Array.isArray(state.dailyReports) ? state.dailyReports : [];
      if (state.dailyReports.some(item => item.reportDate === F.today)) throw Error('当日已生成日报，重复生成只保留一份；可在运行记录中重试失败客户。');
      const config = state.dailyReportConfig || demoDailyReportConfig();
      const time = config.globalTime || '18:30';
      const activeVersion = (config.versions || []).find(item => item.status === 'active');
      const windowEnd = `${F.today} ${time}`;
      const windowStart = `${dailyPrevDay()} ${time}`;
      const startedAt = F.now();
      const runLog = [{ at: startedAt, step: '窗口确定', result: 'success', detail: `报告窗口 ${windowStart} → ${windowEnd}` }];
      // 候选：未冻结且至少一条商机确权的空间；仅客户级确权与冻结空间排除并留痕。
      const isCandidate = w => w.state === 'active' && (w.opps || []).length > 0;
      const candidates = state.spaces.filter(isCandidate);
      const excluded = state.spaces.filter(w => !isCandidate(w)).map(w => ({
        customerId: w.customerId, customer: w.customer, space: w.id,
        reason: w.state === 'frozen' ? `空间已冻结（${w.frozenAt || '时间未知'}），只消费冻结前已完成结果` : '仅客户级确权，无商机确权空间'
      }));
      const blocks = [], failedCustomers = [], carriedOver = [];
      candidates.forEach(space => {
        const changes = dailyWindowChanges(state, space.id, windowStart, windowEnd);
        const behaviors = F.completedBehaviors(state, { start: windowStart, end: windowEnd }).filter(record => record.space === space.id);
        changes.filter(item => item.status === 'processing').forEach(item => carriedOver.push({ changeId: item.id, space: space.id, customer: space.customer, reason: '结果仍在处理，进入下一报告窗口' }));
        if (dailyHasEffectiveInput(changes, behaviors)) { blocks.push(buildDailyBlock(state, space, changes, behaviors)); return; }
        // 全部上游结果缺失记为生成失败；仍在处理的不等待，进入下一窗口；其余按无净变化排除。
        if (changes.some(item => item.status === 'failed') && !changes.some(item => item.status === 'processing') && !behaviors.length) {
          failedCustomers.push({ customerId: space.customerId, customer: space.customer, space: space.id, stage: '客户块生成', reason: '全部上游结果不可用：窗口内客户信息更新失败，不使用旧日报填充。' });
        } else if (!changes.some(item => item.status === 'processing')) {
          excluded.push({ customerId: space.customerId, customer: space.customer, space: space.id, reason: behaviors.length === 1 ? '仅 1 条行为记录且无净变化，不重复归纳' : '窗口内无净变化且无可归纳行为' });
        }
      });
      runLog.push({ at: F.now(), step: '有效变化判断', result: 'success', detail: `候选 ${candidates.length} 个客户空间；有效 ${blocks.length} 个；失败 ${failedCustomers.length} 个；排除 ${excluded.length} 个` });
      const status = blocks.length === 0 ? (failedCustomers.length ? 'failed' : 'empty') : (failedCustomers.length ? 'partial' : 'success');
      const completedAt = F.now();
      // 今日总览：六类各 ≤3 条；跨客户行为模式需 ≥2 个客户空间；不含优先级排名与下一步动作。
      const overview = blocks.length ? {
        effectiveCount: blocks.length,
        progress: blocks.map(block => `${block.customer}：${block.sections.keyChanges[0] || '有有效变化'}`).slice(0, 3),
        risks: blocks.flatMap(block => block.sections.keyChanges.filter(text => text.includes('冲突')).map(text => `${block.customer}：${text}`)).slice(0, 3),
        pending: blocks.flatMap(block => block.sections.pending.map(text => `${block.customer}：${text}`)).slice(0, 3),
        solutionCustomers: blocks.filter(block => block.sections.collaboration.length).map(block => block.customer).slice(0, 3),
        crossPatterns: blocks.filter(block => block.sections.behavior.length).length >= 2 ? [`${blocks.filter(block => block.sections.behavior.length).length} 个客户空间当日形成跨事件行为结论`] : []
      } : null;
      const id = 'DR-' + F.today.slice(5).replace('-', '');
      const recipientSpaces = blocks.length ? blocks.map(block => state.spaces.find(w => w.id === block.space)).filter(Boolean) : candidates;
      const recipients = dailyRecipients(state, recipientSpaces, windowEnd, completedAt);
      const report = {
        id, reportDate: F.today, windowStart, windowEnd, startedAt, completedAt, inputCutoff: windowEnd,
        promptVersion: activeVersion?.id || '未加载', status,
        stats: { candidates: candidates.length, effective: blocks.length, failed: failedCustomers.length, excluded: excluded.length },
        overview, blocks, failedCustomers, previousFailures: [], excluded, carriedOver, recipients, runLog
      };
      state.dailyReports.unshift(report);
      if (status === 'success' || status === 'partial') {
        // 有可读内容才提交 R12；去重键按报告 + 接收人天然保证每人每天至多一次。
        recipients.forEach(item => {
          F.notify(state, {
            type: '日报送达', title: '晚间日报已生成',
            text: item.kind === 'sales'
              ? `${F.today} 晚间日报已生成：${blocks.length} 个客户有有效变化${failedCustomers.length ? `，${failedCustomers.length} 个客户未能生成` : ''}。`
              : `${F.today} 晚间日报已生成：你承接的 ${item.spaces.length} 个客户空间有有效变化${blocks.some(block => block.status === 'partial') ? '（含部分信息尚未更新）' : ''}。`,
            recipients: [item.person], dedupKey: `daily-report:${id}`,
            link: { page: 'daily-report', params: { date: F.today } }
          });
        });
        writeDailySummaries(state, report);
        runLog.push({ at: completedAt, step: '送达与写回', result: 'success', detail: `日报送达 ${recipients.length} 人；写回「当日汇总」${report.blocks.filter(block => block.behaviorSummaryWritten).length} 条` });
      } else if (status === 'failed') {
        // 全部失败：向截止时候选接收人发一次失败提醒，不沿用昨日内容。
        F.notify(state, {
          type: '日报失败', title: '晚间日报生成失败',
          text: `${F.today} 晚间日报全部客户生成失败，未沿用昨日内容；请等待下一份日报或联系销售运营。`,
          recipients: recipients.map(item => item.person), dedupKey: `daily-report-failed:${id}`,
          link: { page: 'daily-report', params: { date: F.today } }
        });
        runLog.push({ at: completedAt, step: '送达', result: 'success', detail: `向截止时候选接收人发送一次失败提醒（${recipients.length} 人）` });
      } else {
        runLog.push({ at: completedAt, step: '有效变化判断', result: 'success', detail: '无客户满足有效条件；不生成业务日报，不通知，仅保留本运行记录' });
      }
      result = report;
    });
    return result;
  };

  /**
   * 重试失败客户（C9）：以同窗口最新成功结果更新失败项，前次失败记录保留在 previousFailures；
   * 仍无可用结果的保持失败并写运行日志。恢复出可读内容时按原去重键补一次送达（已送达的只合并计数）。
   */
  F.retryDailyReportFailures = function (reportId) {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以重试失败客户。');
    let result = null;
    F.mutate('重试日报失败客户', state => {
      const report = (state.dailyReports || []).find(item => item.id === reportId);
      if (!report) throw Error('日报不存在，请刷新后重试。');
      if (!['partial', 'failed'].includes(report.status) || !(report.failedCustomers || []).length) throw Error('当前日报没有可重试的失败客户。');
      report.previousFailures = Array.isArray(report.previousFailures) ? report.previousFailures : [];
      report.runLog = Array.isArray(report.runLog) ? report.runLog : [];
      const remaining = [];
      let recovered = 0;
      report.failedCustomers.forEach(item => {
        const space = state.spaces.find(w => w.id === item.space);
        const changes = space ? dailyWindowChanges(state, space.id, report.windowStart, report.windowEnd) : [];
        const behaviors = space ? F.completedBehaviors(state, { start: report.windowStart, end: report.windowEnd }).filter(record => record.space === space.id) : [];
        if (!space || !dailyHasEffectiveInput(changes, behaviors)) {
          report.runLog.unshift({ at: F.now(), step: '失败客户重试', result: 'failed', detail: `${item.customer}：同窗口仍无最新成功结果，保留前次失败记录。` });
          remaining.push(item);
          return;
        }
        const block = buildDailyBlock(state, space, changes, behaviors);
        report.blocks = [...(report.blocks || []), block];
        report.previousFailures.unshift({ ...item, retriedAt: F.now(), outcome: '已恢复' });
        report.runLog.unshift({ at: F.now(), step: '失败客户重试', result: 'success', detail: `${item.customer}：以同窗口最新成功结果更新失败项，前次失败记录已保留。` });
        recovered += 1;
      });
      report.failedCustomers = remaining;
      if (recovered) {
        report.status = remaining.length ? 'partial' : 'success';
        report.stats = { ...(report.stats || {}), effective: report.blocks.length, failed: remaining.length };
        // 失败日报恢复出可读内容后补建总览；部分成功只更新缺失范围。
        if (!report.overview) {
          report.overview = {
            effectiveCount: report.blocks.length,
            progress: report.blocks.map(block => `${block.customer}：${block.sections.keyChanges[0] || '有有效变化'}`).slice(0, 3),
            risks: [], pending: report.blocks.flatMap(block => block.sections.pending.map(text => `${block.customer}：${text}`)).slice(0, 3),
            solutionCustomers: report.blocks.filter(block => block.sections.collaboration.length).map(block => block.customer).slice(0, 3),
            crossPatterns: []
          };
        }
        writeDailySummaries(state, report);
        report.recipients.forEach(item => {
          F.notify(state, {
            type: '日报送达', title: '晚间日报已生成',
            text: `${report.reportDate} 晚间日报${report.status === 'success' ? '已生成' : '部分客户已恢复'}：${report.blocks.length} 个客户有有效变化${remaining.length ? `，${remaining.length} 个客户未能生成` : ''}。`,
            recipients: [item.person], dedupKey: `daily-report:${report.id}`,
            link: { page: 'daily-report', params: { date: report.reportDate } }
          });
        });
      }
      result = { recovered, remaining: remaining.length };
    });
    return result;
  };

  /** 日报运营操作统一入口：MGR 主操作 + ADM 兜底（待明确事项 3 的固化口径）。 */
  function assertDailyOps() {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以维护晚间日报。');
  }

  /** 保存草稿不等于发布；四份提示词独立保存，互不影响线上生效版。 */
  F.saveDailyPrompt = function (key, body) {
    assertDailyOps();
    const text = String(body || '').trim();
    if (!text) throw Error('提示词正文为空，不能保存。');
    F.mutate('保存日报提示词草稿', state => {
      const prompt = state.dailyReportConfig?.prompts?.[key];
      if (!prompt) throw Error('未知的日报提示词。');
      prompt.draft = { body: text, savedAt: F.now(), savedBy: F.actor.id };
    });
  };

  /**
   * 试跑：选历史窗口与样本空间，用当时真实输入出四步新旧对照。
   * 不发消息、不写「当日汇总」、不影响线上日报；单次最多 3 个空间（待明确事项 4 固化，与 R13 对齐中）。
   */
  F.trialRunDailyReport = function (spaceIds) {
    assertDailyOps();
    let trial = null;
    F.mutate('日报提示词试跑', state => {
      const config = state.dailyReportConfig;
      const ids = [...new Set((spaceIds || []).filter(Boolean))];
      if (!ids.length) throw Error('请勾选至少一个样本空间。');
      if (ids.length > 3) throw Error('单次试跑最多选择 3 个空间。');
      const spaces = ids.map(id => state.spaces.find(w => w.id === id)).filter(Boolean);
      if (spaces.length !== ids.length) throw Error('所选空间不存在，请刷新后重试。');
      const active = (config.versions || []).find(item => item.status === 'active');
      const lastReport = (state.dailyReports || []).filter(item => item.status !== 'empty').sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)))[0];
      const names = spaces.map(w => w.customer).join('、');
      const steps = {};
      F.dailyPromptKeys.forEach(key => {
        const prompt = config.prompts[key];
        steps[key] = {
          draft: prompt.draft ? `草稿版（${prompt.draft.savedAt} 保存）：${names} 试跑「${prompt.label}」完成` : '无草稿，沿用生效版',
          current: `${active?.id || '未加载'} 生效版：${names} 试跑「${prompt.label}」完成`
        };
      });
      trial = { id: F.uid('DTR'), at: F.now(), by: F.actor.id, window: lastReport ? `${lastReport.windowStart} → ${lastReport.windowEnd}` : '最近一个完整报告窗口', spaces: ids, steps };
      config.trialRuns = Array.isArray(config.trialRuns) ? config.trialRuns : [];
      config.trialRuns.unshift(trial);
    });
    return trial;
  };

  /** 四份提示词作为一个完整版本发布：任一草稿缺失或无效则阻止；下一自然日生效，当天已生成日报不变。 */
  F.publishDailyPrompts = function () {
    assertDailyOps();
    F.mutate('发布日报提示词版本', state => {
      const config = state.dailyReportConfig;
      const missing = F.dailyPromptKeys.filter(key => !config.prompts[key]?.draft?.body?.trim());
      if (missing.length) throw Error(`四份提示词需均有有效草稿才能发布完整版本；缺少：${missing.map(key => config.prompts[key]?.label || key).join('、')}。`);
      const nums = (config.versions || []).map(item => Number(String(item.id).replace(/^M072-v/, ''))).filter(Number.isFinite);
      const id = 'M072-v' + ((nums.length ? Math.max(...nums) : 0) + 1);
      const effectiveFrom = dailyNextDay();
      (config.versions || []).forEach(item => { if (item.status === 'active') item.status = 'superseded'; });
      config.versions = Array.isArray(config.versions) ? config.versions : [];
      config.versions.unshift({ id, prompts: Object.fromEntries(F.dailyPromptKeys.map(key => [key, config.prompts[key].draft.body])), publishedBy: F.actor.id, publishedAt: F.now(), effectiveFrom, status: 'active', loaded: true });
      config.publishLog = Array.isArray(config.publishLog) ? config.publishLog : [];
      config.publishLog.unshift({ at: F.now(), by: F.actor.id, action: 'publish', version: id, effectiveFrom });
      F.dailyPromptKeys.forEach(key => { config.prompts[key].draft = null; });
    });
  };

  /** 回退到上一完整生效版：当前版本退回历史，上一版重新生效；同样从下一自然日起生效。 */
  F.rollbackDailyPrompts = function () {
    assertDailyOps();
    F.mutate('回退日报提示词版本', state => {
      const config = state.dailyReportConfig;
      const versions = config.versions || [];
      const activeIndex = versions.findIndex(item => item.status === 'active');
      const previous = versions[activeIndex + 1];
      if (activeIndex < 0 || !previous) throw Error('没有可回退的上一完整生效版。');
      versions[activeIndex].status = 'superseded';
      const effectiveFrom = dailyNextDay();
      previous.status = 'active';
      previous.publishedAt = F.now();
      previous.publishedBy = F.actor.id;
      previous.effectiveFrom = effectiveFrom;
      config.publishLog = Array.isArray(config.publishLog) ? config.publishLog : [];
      config.publishLog.unshift({ at: F.now(), by: F.actor.id, action: 'rollback', version: previous.id, effectiveFrom });
    });
  };

  /** 全局产出时间：HH:MM 校验；下一自然日生效，窗口从上一次计划截止连续衔接；当天已生成日报不变。 */
  F.setDailyReportTime = function (time) {
    assertDailyOps();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) throw Error('日报时间格式应为 HH:MM。');
    F.mutate('配置晚间日报全局时间', state => {
      const config = state.dailyReportConfig;
      config.globalTime = time;
      config.timeUpdatedBy = F.actor.id;
      config.timeUpdatedAt = F.now();
      config.timeEffectiveFrom = dailyNextDay();
    });
  };

  /* ---------- R04 空间内快捷问答 ---------- */

  F.quickQuestions = [['blocker', '当前卡点是什么？'], ['last', '上次沟通聊到哪？'], ['people', '关键人是谁？'], ['pending', '还有哪些待确认？']];
  F.askSpace = function (spaceId, question) {
    let answer;
    F.mutate('空间内快捷问答', state => {
      const space = F.space(spaceId, state);
      if (!space) throw Error('空间不在当前可见范围。');
      if (space.state === 'frozen') throw Error('空间已冻结，不开放新的问答；历史对话仍可查看。');
      const text = String(question || '').trim();
      if (!text) throw Error('请输入或选择一个问题。');
      const panels = F.overview(space, state);
      const matched = F.quickQuestions.find(([, label]) => label === text);
      // 自由提问只在问题明确指向某个概览板块时作答；否则按无依据处理，不推测。
      const panel = matched ? panels.find(item => item.key === matched[0]) : panels.find(item => item.text && text.includes(item.title));
      // 依据是否充分看板块有没有内容：板块正文本身就是本空间可查看的依据，
      // 原文出处是「有则附上」，不是作答前提（与概览渲染同一口径，M05-3 §4.3 第 4 条）。
      const hasEvidence = !!(panel && panel.text);
      answer = {
        id: F.uid('QA'), space: spaceId, question: text, at: F.now(), hasEvidence,
        answer: hasEvidence ? panel.text : '当前空间内没有可用依据，无法回答这个问题。',
        sources: hasEvidence ? panel.sources.filter(source => source.available !== false) : []
      };
      state.spaceQA = Array.isArray(state.spaceQA) ? state.spaceQA : [];
      state.spaceQA.unshift(answer);
    });
    return answer;
  };

  /**
   * 丢弃一条空间问答：供「重新生成」使用，避免旧答案留在历史里形成重复。
   * 只允许丢弃本空间确实存在的那一条。
   */
  F.discardSpaceQA = function (spaceId, qaId) {
    F.mutate('丢弃一条空间问答', state => {
      const list = Array.isArray(state.spaceQA) ? state.spaceQA : [];
      const index = list.findIndex(item => item.id === qaId && item.space === spaceId);
      if (index < 0) throw Error('这条问答已不在当前空间的历史里。');
      list.splice(index, 1);
    });
  };

  /* ---------- R05 角色可见边界 ---------- */

  /** 同跟名单只给销售姓名和确权类型；同客户其他销售的商机内容不返回。 */
  F.coFollowers = function (space, state = F.load()) {
    return state.spaces
      .filter(item => item.customerId === space.customerId && item.sales !== space.sales && item.state === 'active')
      .map(item => ({ sales: item.sales, name: F.name(item.sales), entitlementType: item.entitlementType, pool: item.pool }));
  };

  /** 统一入口的权限结果：说明当前身份能读什么、能写什么，无权时不暴露空间。 */
  F.permissionContext = function (state = F.load()) {
    const actor = F.actor && state.people.find(person => person.id === F.actor.id);
    const valid = !!actor && actor.role === F.role && actor.status === 'on';
    const spaces = valid ? F.visible(state) : [];
    const pools = F.role === 'SOL' ? (state.assignments[F.actor?.id] || []) : [];
    const read = { ADM: '全部空间完整只读', MGR: '全部空间完整只读', SLS: '客户级信息全量 + 本人确权商机', SOL: '承接客户池内空间完整内容' }[F.role] || '无';
    const write = { ADM: '系统配置与异常处置，不写入客户经营内容', MGR: '销售目标录入与调整；正常空间资料页可上传外部 .md 并刷新全部内容', SLS: '本人正常空间的跟进与方案回复', SOL: '承接池内正常空间的外部 .md 上传' }[F.role] || '无';
    return {
      valid, actor, role: F.role, roleLabel: F.roles[F.role] || '未知角色',
      reason: !actor ? '演示身份不存在' : actor.status !== 'on' ? '账号已停用，读取与写入均被拒绝' : actor.role !== F.role ? '当前入口角色与账号角色不一致' : '',
      spaceCount: spaces.length, pools, read, write,
      frozenCount: spaces.filter(item => item.state === 'frozen').length
    };
  };

  /* ---------- R06 客户归属分布 ---------- */

  /** 按客户聚合当前归属、历史归属和异常；只读展示，不改写任何归属事实。 */
  F.ownership = function (state = F.load()) {
    const crm = state.crm || {};
    const ids = [...new Set([
      ...state.spaces.map(space => space.customerId),
      ...(crm.pendingMappings || []).map(item => item.customerId),
      ...(crm.unassignedOpportunities || []).map(item => item.customerId),
      ...(crm.changes || []).map(item => item.customerId)
    ])].filter(Boolean);
    return ids.map(customerId => {
      const spaces = state.spaces.filter(space => space.customerId === customerId);
      const named = spaces[0] || (crm.changes || []).find(item => item.customerId === customerId) || (crm.pendingMappings || []).find(item => item.customerId === customerId);
      const current = spaces.filter(space => space.state === 'active').map(space => ({
        spaceId: space.id, sales: space.sales, name: F.name(space.sales), entitlementType: space.entitlementType,
        pool: space.pool, lifecycle: space.lifecycle || space.state, readiness: space.readiness,
        opportunities: (space.opps || []).map(opportunity => ({ id: opportunity.id, name: opportunity.name })),
        updatedAt: space.lifecycleChangedAt || space.updated, failure: space.failure && space.failure.status !== 'resolved' ? space.failure : null
      }));
      const history = [
        ...(crm.changes || []).filter(item => item.customerId === customerId && item.change !== 'unchanged').map(item => ({
          at: item.occurredAt, sales: item.sales, name: item.sales ? F.name(item.sales) : item.change === 'pending' ? '待对应人员' : '未知人员',
          change: item.change, factType: item.entitlementType === 'opportunity' ? '商机级确权' : '客户级确权',
          detail: item.opportunity || item.opportunityId || '', batchId: item.batchId
        })),
        ...spaces.filter(space => space.state === 'frozen').map(space => ({
          at: space.frozenAt || space.lifecycleChangedAt, sales: space.sales, name: F.name(space.sales),
          change: 'frozen', factType: '空间冻结', detail: '客户级与商机级确权均已结束', spaceId: space.id
        }))
      ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      return {
        customerId, customer: named?.customer || '待同步客户', industry: spaces[0]?.industry || '待补充',
        current, history,
        pending: (crm.pendingMappings || []).filter(item => item.customerId === customerId && item.status === 'pending'),
        unassigned: (crm.unassignedOpportunities || []).filter(item => item.customerId === customerId),
        errors: (crm.alignmentErrors || []).filter(item => item.customerId === customerId && item.status !== 'resolved'),
        contentFailures: spaces.filter(space => space.readiness === 'failed')
      };
    }).sort((a, b) => a.customerId.localeCompare(b.customerId));
  };

  /** 所有业务提交在执行时重新校验可见范围，避免旧页面继续使用被撤销的承接池。 */
  F.mutate = function (label, change) {
    const s = F.load();
    const actor = F.actor && F.person(F.actor.id, s);
    if (!actor || actor.role !== F.role || actor.status !== 'on') throw Error('当前演示身份不可用。');
    change(s);
    s.audit.unshift({ id: F.uid('LOG'), title: label, actor: F.actor.name, date: F.now() });
    F.save(s);
  };

  /** 手动触发一次 CRM 对齐，沿用同一套批次模型并留下操作审计。 */
  F.startCrmSync = function () {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以发起即时对齐。');
    F.mutate('CRM 归属事实手动对齐', state => {
      const crm = state.crm || (state.crm = demoCrm());
      if (crm.status === 'running') throw Error('当前批次仍在对齐中，请稍后查看结果。');
      const at = F.now();
      const id = 'B-M' + Date.now().toString(36).slice(-5).toUpperCase();
      const batch = { id, at, trigger: '手动', factsVersion: `CRM-${at.replace(/[- :]/g, '').slice(0, 12)}`, processed: crm.processed, added: crm.added, removed: crm.removed, restored: crm.restored, unchanged: crm.unchanged, pending: crm.pending, unassigned: crm.unassigned, failed: crm.failed, status: 'completed' };
      crm.status = 'completed'; crm.trigger = '手动'; crm.lastSyncAt = at; crm.manualRunAt = at; crm.currentBatchId = id; crm.factsVersion = batch.factsVersion; crm.nextRetryAt = at.slice(0, 10) + ' 10:30'; crm.lastResult = '手动对齐完成，未重复生成确权变化。';
      crm.batches = [batch, ...(crm.batches || [])];
    });
  };

  /** 修复单条人员对应事项，成功后补建确权并复用同三元空间。 */
  F.resolveCrmMapping = function (mappingId, salesId) {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以处理待对应人员。');
    F.mutate('修复 CRM 人员对应并补建确权', state => {
      const crm = state.crm || (state.crm = demoCrm());
      const mapping = (crm.pendingMappings || []).find(item => item.id === mappingId);
      const person = state.people.find(item => item.id === salesId && item.role === 'SLS' && item.status === 'on');
      if (!mapping || mapping.status === 'resolved') throw Error('该待对应事项已处理或不存在。');
      if (!person) throw Error('请选择启用中的销售账号。');
      mapping.status = 'resolved'; mapping.resolvedTo = person.id; mapping.resolvedName = person.name; mapping.resolvedAt = F.now();
      // 对应关系表与待对应清单同源：处理完成后同步回写对应方式与时间，避免两处状态不一致。
      const mappingRow = (crm.mappings || []).find(item => item.crmId === mapping.crmId);
      if (mappingRow) { mappingRow.ownerId = person.id; mappingRow.mode = 'manual'; mappingRow.matchedAt = F.now(); mappingRow.failReason = ''; }
      crm.pending = Math.max(0, (crm.pending || 1) - 1);
      crm.changes = crm.changes || [];
      const change = crm.changes.find(item => item.id === 'CHG-304' && item.change === 'pending');
      if (change) { change.sales = person.id; change.change = 'added'; change.status = 'applied'; }
      const opportunity = { id: mapping.opportunityId, name: mapping.opportunity, amount: 24, stage: '需求确认' };
      const space = F.ensureSpace(state, { sales: person.id, customerId: mapping.customerId, customer: mapping.customer, pool: '号码认证池', opportunity });
      space.ownerOnly = false; space.entitlementType = 'customer_and_opportunity'; space.entitlements = { customer: true, opportunities: [...new Set([...(space.entitlements?.opportunities || []), opportunity.id])] };
      space.opps = space.opps.some(item => item.id === opportunity.id) ? space.opps : [opportunity, ...space.opps];
      state.entitlements = Array.isArray(state.entitlements) ? state.entitlements : [];
      if (!state.entitlements.some(item => item.opportunityId === opportunity.id && item.sales === person.id && item.status === 'active')) state.entitlements.unshift({ id: F.uid('ENT'), space: space.id, customerId: mapping.customerId, opportunityId: opportunity.id, sales: person.id, type: 'opportunity', status: 'active', source: 'crm' });
      space.lifecycleEvents.unshift({ type: 'entitlement_added', at: F.now(), reason: '待对应人员已完成系统账号对应', batchId: crm.currentBatchId, result: 'success' });
      // 归属新增提醒：新建空间内容仍在装载，等就绪后再提醒销售（R12 等待规则）。
      F.notify(state, {
        type: '归属变化', title: '客户归属已同步', text: `你已成为${mapping.customer}的归属销售（${mapping.opportunity}）。`,
        space: space.id, recipients: [person.id], dedupKey: `ownership:${change?.id || mapping.id}`, waitForSpace: space.id,
        link: { page: 'followup-workbench', params: { space: space.id } }
      });
    });
  };

  /** 单条对齐异常重试；演示采用成功路径，其他条目不受影响。 */
  F.retryAlignmentError = function (errorId) {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅超级管理员或销售运营可以重试对齐异常。');
    F.mutate('重试 CRM 对齐异常', state => {
      const crm = state.crm || (state.crm = demoCrm());
      const error = (crm.alignmentErrors || []).find(item => item.id === errorId);
      if (!error) throw Error('对齐异常不存在，请刷新后重试。');
      if (error.status === 'resolved') throw Error('该异常已恢复，无需重复重试。');
      error.status = 'retrying'; error.retryCount = Number(error.retryCount || 0) + 1; error.lastRetryAt = F.now();
      error.status = 'resolved'; error.resolvedAt = F.now(); error.resolution = '下一次处理已通过人员状态校验';
      crm.failed = Math.max(0, (crm.failed || 1) - 1); crm.lastResult = `异常 ${errorId} 已恢复，未影响其他同步条目。`;
    });
  };

  /**
   * 采用推荐账号完成人员对应：与手动设置对应走同一条补建链路，
   * 只在演示层多一步"推荐依据"确认，避免运营在只看账号不看后果的情况下提交。
   */
  F.acceptCrmSuggestion = function (pendingId) {
    const state = F.load();
    const row = (state.crm?.mappings || []).find(item => item.pendingId === pendingId);
    if (!row) throw Error('该待对应事项不存在，请刷新后重试。');
    if (!row.suggestOwnerId) throw Error('该条没有可采用的推荐账号，请手动设置对应。');
    F.resolveCrmMapping(pendingId, row.suggestOwnerId);
    return F.name(row.suggestOwnerId);
  };

  /** 更换已有对应关系：只改下一次同步的补建目标，不回溯已生成的确权与空间。 */
  F.changeCrmMapping = function (crmId, salesId) {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以修改 CRM 人员对应关系。');
    F.mutate('更换 CRM 人员对应账号', state => {
      const crm = state.crm || (state.crm = demoCrm());
      const row = (crm.mappings || []).find(item => item.crmId === crmId);
      const person = state.people.find(item => item.id === salesId && item.role === 'SLS' && item.status === 'on');
      if (!row) throw Error('对应记录不存在，请刷新后重试。');
      if (!person) throw Error('请选择启用中的销售账号。');
      if (row.ownerId === person.id) throw Error('该账号已是当前对应账号，无需更换。');
      row.ownerId = person.id; row.mode = 'manual'; row.matchedAt = F.now(); row.failReason = '';
    });
  };

  /** 保存销帮帮连接配置：仅超管可写；接口凭据只保存脱敏值，明文由服务端管理。 */
  F.saveXbbConfig = function (values) {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以修改销帮帮连接配置。');
    const baseUrl = String(values.baseUrl || '').trim();
    if (!/^https?:\/\//.test(baseUrl)) throw Error('接口地址需以 http:// 或 https:// 开头。');
    const corpId = String(values.corpId || '').trim();
    const userId = String(values.userId || '').trim();
    if (!corpId) throw Error('企业 Corp ID 为必填项。');
    if (!userId) throw Error('操作人 User ID 为必填项。');
    const positive = (input, label, max) => {
      const value = Number(input);
      if (!Number.isInteger(value) || value <= 0 || value > max) throw Error(`${label} 需为 1～${max} 的整数。`);
      return value;
    };
    const payload = {
      baseUrl, corpId, userId,
      saasMark: positive(values.saasMark, 'SaaS Mark', 99),
      timeoutSeconds: positive(values.timeoutSeconds, '请求超时', 120),
      listPageSize: positive(values.listPageSize, '分页大小', 500),
      retryCount: positive(values.retryCount, '重试次数', 10),
      retryBackoffSeconds: positive(values.retryBackoffSeconds, '重试退避', 60)
    };
    F.mutate('更新销帮帮连接配置', state => {
      const xbb = state.xbb || (state.xbb = demoXbb());
      xbb.sources = xbb.sources || {};
      Object.assign(xbb, payload);
      // 本次手工维护过的字段来源标记为数据库配置，未改动项保留原来源。
      Object.keys(payload).forEach(key => { xbb.sources[key] = 'database'; });
      xbb.updatedAt = F.now();
      xbb.updatedBy = F.actor?.id || '';
    });
  };

  /** 连通性检查：原型只做配置完整性校验，不发起真实外网请求；缺项时明确列出缺哪几项。 */
  F.checkXbbConnection = function () {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅超级管理员或销售运营可以发起连通性检查。');
    let result;
    F.mutate('检查销帮帮连通性', state => {
      const xbb = state.xbb || (state.xbb = demoXbb());
      const missing = [['接口地址', xbb.baseUrl], ['企业 Corp ID', xbb.corpId], ['操作人 User ID', xbb.userId], ['接口 Token', xbb.tokenMasked]]
        .filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
      result = missing.length
        ? { at: F.now(), status: 'failed', latencyMs: 0, detail: `缺少必填配置：${missing.join('、')}；同步会停在待配置状态，不会清空已有确权。` }
        : { at: F.now(), status: 'ok', latencyMs: 264, detail: '客户、商机、人员关系与客户池四类读取接口均返回正常。' };
      xbb.lastCheck = result;
    });
    return result;
  };

  /** 重试空间内容装载；成功后只恢复内容就绪度，不越过冻结边界。 */
  F.retrySpace = function (spaceId) {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅超级管理员或销售运营可以重试空间内容。');
    F.mutate('重试客户空间内容处理', state => {
      const space = state.spaces.find(item => item.id === spaceId);
      if (!space) throw Error('空间不存在，请刷新后重试。');
      const wasFrozen = space.state === 'frozen';
      space.readiness = 'updating'; space.readinessUpdatedAt = F.now(); space.failure = space.failure || {};
      space.failure.lastRetryAt = F.now(); space.failure.retryCount = Number(space.failure.retryCount || 0) + 1;
      space.readiness = 'ready'; space.readinessReason = ''; space.failure.status = 'resolved'; space.failure.resolvedAt = F.now(); space.lastReadableAt = F.now();
      space.lifecycle = wasFrozen ? 'frozen' : 'active'; space.state = wasFrozen ? 'frozen' : 'active';
      space.lifecycleEvents = Array.isArray(space.lifecycleEvents) ? space.lifecycleEvents : [];
      space.lifecycleEvents.unshift({ type: 'content_retry', at: F.now(), reason: '手动重试内容处理', result: 'success' });
      // 内容就绪后释放被持有的归属/解冻提醒，释放时才发起移动端推送。
      F.releaseWaitingNotifications(state, space.id);
    });
  };
  F.addFollowup = function (id, input) {
    F.mutate('新增跟进记录', s => {
      const space = F.space(id, s);
      if (!F.canWrite(space)) throw Error('当前空间只读，无法记录跟进。');
      // R09：跟进记录必须关联具体商机；仅客户级确权的空间可读不可写。
      const opps = space.opps || [];
      if (!opps.length) throw Error('该空间仅有客户级确权、暂无商机，跟进记录暂不可写。');
      const opportunityId = input.opportunityId || '';
      if (!opportunityId) throw Error('请先选定这次跟进对应的商机。');
      if (!opps.some(item => item.id === opportunityId)) throw Error('所选商机不在该空间的确权范围内。');
      if (!input.text.trim()) throw Error('请填写跟进内容。');
      // R09 并发：带基线版本提交时先比对，已有更新则按先提交为准提示，不静默覆盖。
      F.assertNoConflict(space, input.baseVersion);
      const record = { id: F.uid('FU'), space: id, author: F.actor.id, date: F.now(), type: input.type || '电话沟通', text: input.text.trim(), next: input.next?.trim() || '', opportunityId };
      s.followups.unshift(record);
      // 跟进提交后异步更新客户信息；本次变化与销售行为记录分开呈现。
      pushSpaceChange(s, space, {
        source: 'followup', sourceRef: record.id, sourceLabel: `跟进记录（${record.type}）`, status: 'done',
        added: [`最新沟通：${record.text.slice(0, 24)}${record.text.length > 24 ? '…' : ''}`],
        updated: [{ field: '上次聊到哪', before: s.followups[1]?.space === id ? s.followups[1].text.slice(0, 20) + '…' : '暂无记录', after: record.text.slice(0, 20) + (record.text.length > 20 ? '…' : '') }],
        pendingConfirm: record.next ? [] : ['本次跟进未填写下一步计划']
      });
      // R15：同批生成一条单次跟进行为记录；失败不阻塞客户信息更新，也不发提醒。
      F.generateBehavior(s, space, { eventType: 'followup', eventId: record.id, eventAt: record.date, author: record.author, text: record.text, opportunityId });
    });
  };

  /* ---------- R09 周复盘与并发基线（两端同一份，不做分端存储） ---------- */

  /** 提交基线：以空间当前可读版本为准，网页端与移动端比对同一个值。 */
  F.writeBaseline = (space) => space ? String(space.lastReadableVersion || '') + '|' + String(space.updated || '') : '';

  /** 先提交为准：后提交方收到冲突提示，输入内容由调用方保留，不静默覆盖。 */
  F.assertNoConflict = function (space, baseVersion) {
    if (!baseVersion) return;
    if (F.writeBaseline(space) !== baseVersion) throw Error('这条内容在另一端已有更新，按先提交为准；请核对后再决定是否提交。');
  };

  F.weeklyReviewsOf = (spaceId, state = F.load()) => (state.weeklyReviews || [])
    .filter(item => item.space === spaceId).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  /** 周复盘写入：进展、下一步、阻塞三项；与跟进记录同样进入 R04 更新并同批产出行为记录。 */
  F.addWeeklyReview = function (id, input) {
    F.mutate('新增周复盘', s => {
      const space = F.space(id, s);
      if (!F.canWrite(space)) throw Error('当前空间只读，无法记录周复盘。');
      if (!String(input.progress || '').trim()) throw Error('请填写本周进展。');
      if (!String(input.next || '').trim()) throw Error('请填写下一步。');
      F.assertNoConflict(space, input.baseVersion);
      s.weeklyReviews = Array.isArray(s.weeklyReviews) ? s.weeklyReviews : [];
      const record = {
        id: F.uid('WR'), space: id, author: F.actor.id, date: F.now(),
        progress: String(input.progress).trim(), next: String(input.next).trim(), blockers: String(input.blockers || '').trim()
      };
      s.weeklyReviews.unshift(record);
      pushSpaceChange(s, space, {
        source: 'weekly_review', sourceRef: record.id, sourceLabel: '周复盘', status: 'done',
        added: [`本周进展：${record.progress.slice(0, 24)}${record.progress.length > 24 ? '…' : ''}`],
        pendingConfirm: record.blockers ? [`周复盘阻塞项：${record.blockers.slice(0, 24)}`] : []
      });
      F.generateBehavior(s, space, { eventType: 'weekly_review', eventId: record.id, eventAt: record.date, author: record.author, text: `${record.progress}。下一步：${record.next}${record.blockers ? '。阻塞：' + record.blockers : ''}` });
    });
  };
  /** 返回 R08 看板统一使用的状态文案和未读天数。 */
  F.solutionStatus = function (record) {
    if (record.withdrawn) return { label: '已撤回', tone: 'neutral', key: 'withdrawn' };
    if (record.deliveryStatus === 'failed') return { label: '推送失败', tone: 'amber', key: 'failed' };
    if (record.reply) return { label: '已回复', tone: 'green', key: 'replied' };
    if (record.read) return { label: '已读待回复', tone: 'brand', key: 'pending' };
    return { label: '未读', tone: 'amber', key: 'unread' };
  };
  F.solutionUnreadDays = function (record) {
    if (record.read || record.withdrawn) return 0;
    const from = Date.parse(String(record.date || '').replace(' ', 'T'));
    const to = Date.parse(`${F.today}T23:59:59`);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    return Math.max(1, Math.floor((to - from) / 86400000) + 1);
  };

  /**
   * 向多个空间推送方案。每个空间独立校验和落记录，局部失败不会回滚已经成功的空间。
   * @returns {{space:string, status:string, reason?:string, solutionId?:string}[]} 逐空间提交结果。
   */
  F.sendSolution = function (ids, input) {
    if (F.role !== 'SOL') throw Error('仅解决方案人员可以推送。');
    if (!ids.length || !input.title?.trim() || !input.body?.trim()) throw Error('请选择空间并填写标题与正文。');
    const results = [];
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];
    const externalLink = String(input.externalLink || '').trim();
    if (externalLink && !/^https?:\/\//i.test(externalLink)) throw Error('外部链接需以 http:// 或 https:// 开头。');
    F.mutate('推送方案', s => {
      [...new Set(ids)].forEach(id => {
        const w = F.space(id, s);
        if (!w || w.state !== 'active') {
          results.push({ space: id, status: 'failed', reason: !w ? '无权访问该空间，未生成方案记录' : '空间已冻结，不接收新方案' });
          return;
        }
        const record = normalizeSolution({
          id: F.uid('SL'), space: id, author: F.actor.id, title: input.title.trim(), body: input.body.trim(), date: F.now(),
          attachments, externalLink, read: false, reply: '', replyRead: false, withdrawn: false, deliveryStatus: 'sent',
          eventLog: [{ type: 'sent', at: F.now(), actor: F.actor.id, result: 'success' }]
        });
        s.solutions.unshift(record);
        F.notify(s, {
          type: '方案推送', title: '你收到一份新方案', text: record.title,
          space: w.id, solution: record.id, recipients: [w.sales], dedupKey: `solution-push:${record.id}`,
          link: { page: 'followup-workbench', params: { space: w.id, tab: 'solutions', solution: record.id } }
        });
        results.push({ space: id, status: 'success', solutionId: record.id });
      });
      if (!results.some(item => item.status === 'success')) throw Error(results[0]?.reason || '没有可推送的正常空间。');
    });
    return results;
  };
  F.solutionAction = function (id, action, text) {
    F.mutate('方案' + ({ read: '已读', reply: '回复', withdraw: '撤回', remind: '催办', replyRead: '回复已读' }[action] || ''), s => {
      const r = s.solutions.find(x => x.id === id), w = r && F.space(r.space, s);
      if (!r || !w || r.withdrawn) throw Error('该方案已撤回或不在当前可见范围。');
      if (['read', 'reply'].includes(action)) {
        if (F.role !== 'SLS' || w.sales !== F.actor.id) throw Error('仅接收销售可以处理方案。');
        if (action === 'read') {
          if (r.read) return;
          r.read = true; r.readAt = F.now();
          r.eventLog = Array.isArray(r.eventLog) ? r.eventLog : [];
          r.eventLog.push({ type: 'read', at: r.readAt, actor: F.actor.id, result: 'success' });
        }
        else {
          if (!F.canWrite(w) || r.reply) throw Error('空间只读或方案已回复，无法再次提交。');
          if (!text?.trim()) throw Error('请填写回复内容。');
          r.read = true; r.readAt = r.readAt || F.now(); r.reply = text.trim(); r.replyDate = F.now();
          r.eventLog = Array.isArray(r.eventLog) ? r.eventLog : [];
          r.eventLog.push({ type: 'reply', at: r.replyDate, actor: F.actor.id, result: 'success' });
          // 回复提醒只发给方案作者本人，不再按空间可见性外溢给销售。
          F.notify(s, {
            type: '方案回复', title: '销售已回复方案', text: r.title + '：' + r.reply,
            space: w.id, solution: r.id, recipients: [r.author], dedupKey: `solution-reply:${r.id}`,
            link: { page: 'solution-feedback', params: { tab: 'replied' } }
          });
        }
      } else {
        if (F.role !== 'SOL' || r.author !== F.actor.id) throw Error('仅原推送人可以处理。');
        if (action === 'withdraw') {
          if (r.read) throw Error('已读方案不能撤回。');
          r.withdrawn = true; r.withdrawnAt = F.now(); r.deliveryStatus = 'withdrawn';
          r.eventLog = Array.isArray(r.eventLog) ? r.eventLog : [];
          r.eventLog.push({ type: 'withdraw', at: r.withdrawnAt, actor: F.actor.id, result: 'success' });
        }
        if (action === 'replyRead') { r.replyRead = true; r.replyReadAt = F.now(); }
        if (action === 'remind') {
          if (w.state !== 'active' || r.reply) throw Error('已冻结空间或已回复方案无需催办。');
          const remindedAt = Date.parse(String(r.remindedAt || '').replace(' ', 'T'));
          if (Number.isFinite(remindedAt) && Date.now() - remindedAt < 86400000) throw Error('演示规则：同一方案 24 小时内只能催办一次。');
          r.remindedAt = F.now(); r.remindCount = Number(r.remindCount || 0) + 1;
          r.eventLog = Array.isArray(r.eventLog) ? r.eventLog : [];
          r.eventLog.push({ type: 'remind', at: r.remindedAt, actor: F.actor.id, result: 'success' });
          F.notify(s, {
            type: '方案提醒', title: '方案人员提醒你查看方案', text: r.title,
            space: w.id, solution: r.id, recipients: [w.sales], dedupKey: `solution-remind:${r.id}:${r.remindCount}`,
            link: { page: 'followup-workbench', params: { space: w.id, tab: 'solutions', solution: r.id } }
          });
        }
      }
    });
  };
  /* ---------- R13 今日该跟与优先级排序 ---------- */

  F.insightStatusMeta = { generated: ['已生成', 'green'], pending: ['尚未生成', 'brand'], failed: ['生成失败', 'amber'], empty: ['空名单', 'neutral'] };
  F.insightEntryStatusTone = { '停滞': 'amber', '有进展': 'green', '待决策': 'brand' };
  /** 依据步骤的业务措辞：销售侧只出现状态/顺序/动作判断，不出现提示词名。 */
  F.insightStepLabels = { status: '状态判断', ranking: '顺序建议', action: '动作建议' };
  F.insightKindLabels = { status: '状态', ranking: '排序', action: '动作' };

  /** 输入全集：该销售未冻结、至少一条商机确权、且非当天新确权的空间；仅客户级确权与冻结空间不进全集。 */
  F.insightUniverse = function (state, salesId) {
    return state.spaces.filter(w => w.sales === salesId && w.state === 'active' && (w.opps || []).length > 0 && String(w.createdAt || '').slice(0, 10) < F.today);
  };

  /** 只返回当日快照；没有快照时返回 null，由页面区分「尚未生成」与「无可判断空间」。 */
  F.todaySnapshot = function (state, salesId) {
    return (state.insight?.snapshots || []).find(item => item.sales === salesId && item.date === F.today) || null;
  };

  /** 下一自然日：提示词上线/回退与产出时点变更的统一生效口径。 */
  function insightNextDay() {
    const time = Date.parse(F.today + 'T00:00:00Z');
    return Number.isFinite(time) ? new Date(time + 86400000).toISOString().slice(0, 10) : F.today;
  }

  /**
   * 逐空间独立判断（演示用确定性口径，不调用真实模型）：
   * 没有任何跟进/录音/方案/资料原文 → 依据不足（返回 null，不进名单、不给动作）；
   * 最近两天有跟进且有待确认事项 → 待决策；最近两天有跟进 → 有进展；其余 → 停滞。
   */
  function judgeSpaceForInsight(state, space) {
    const followups = state.followups.filter(r => r.space === space.id).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const meetings = F.spacePlacements(space.id, state).map(item => F.recording(item.recording, state)).filter(Boolean);
    const solutions = state.solutions.filter(r => r.space === space.id && !r.withdrawn);
    const docs = state.documents.filter(r => r.space === space.id && r.status === 'success');
    if (!followups.length && !meetings.length && !solutions.length && !docs.length) return null;
    const latest = followups[0];
    const pendingCount = (space.pendingConfirm || []).length;
    const recent = latest && String(latest.date).slice(0, 10) >= '2026-09-14';
    const status = recent ? (pendingCount ? '待决策' : '有进展') : '停滞';
    const summary = status === '待决策'
      ? `存在 ${pendingCount} 项待确认事项，等待客户或内部决策。`
      : status === '有进展'
        ? `最近沟通带来新进展：${String(latest.text || space.brief).slice(0, 24)}。`
        : `最近沟通停留在 ${latest ? String(latest.date).slice(0, 10) : '更早'}，暂无新进展。`;
    const evidence = [];
    if (latest) evidence.push({ step: 'status', type: 'followup', id: latest.id, label: `跟进记录 · ${latest.type}`, at: latest.date });
    if (meetings[0]) evidence.push({ step: 'ranking', type: 'meeting', id: meetings[0].id, label: `客户录音 · ${meetings[0].title}`, at: meetings[0].date });
    if (solutions[0]) evidence.push({ step: 'action', type: 'solution', id: solutions[0].id, label: `方案往来 · ${solutions[0].title}`, at: solutions[0].date });
    else if (docs[0]) evidence.push({ step: 'action', type: 'document', id: docs[0].id, label: `外部资料 · ${docs[0].name}`, at: docs[0].uploadedAt });
    return { space: space.id, customer: space.customer, status, summary, action: latest?.next || '与客户确认下一步安排。', evidence };
  }

  /** 线上最近一次结果：取该空间归属销售最近一份已生成快照中的对应条目。 */
  function insightOnlineResult(insight, space, kind) {
    const snapshot = insight.snapshots
      .filter(item => item.status === 'generated' && item.sales === space.sales)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!snapshot) return '无线上结果';
    const entry = snapshot.entries.find(item => item.space === space.id);
    if (kind === 'status') return entry ? entry.status : '依据不足';
    if (kind === 'ranking') return entry ? `入选 · 第 ${snapshot.entries.indexOf(entry) + 1} 位` : '未入选';
    return entry ? entry.action : '—';
  }

  /**
   * 每日跑批：到达配置时点后为该销售产出当日名单。
   * 当天已有终态快照（已生成/空名单/生成失败）不重复跑批；「尚未生成」的占位快照可被正式产出替换。
   * 提醒口径：已生成且 ≥1 条 → 发「今日该跟」给归属销售；整批失败 → 只发运营异常（不推送、不打扰销售）；空名单不发。
   */
  F.runInsightBatch = function (salesId, options = {}) {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以执行跑批。');
    let result = null;
    F.mutate('今日该跟跑批', state => {
      const person = state.people.find(item => item.id === salesId && item.role === 'SLS');
      if (!person) throw Error('销售不存在，请刷新后重试。');
      const insight = state.insight;
      const existing = F.todaySnapshot(state, salesId);
      if (existing && existing.status !== 'pending') throw Error('当天已产出名单，不重复跑批。');
      const time = insight.schedule.overrides?.[salesId] || insight.schedule.defaultTime;
      const base = {
        id: existing?.id || F.uid('INS'), sales: salesId, date: F.today,
        scheduledAt: F.today + ' ' + time, generatedAt: F.now(), inputCutoff: F.now(),
        promptVersions: {}, strategyVersion: '', universe: [], concluded: 0, truncated: 0, failReason: '', inputMarks: [], entries: []
      };
      const write = snapshot => {
        if (existing) Object.assign(existing, snapshot);
        else insight.snapshots.unshift(snapshot);
        result = snapshot;
      };
      // 三份提示词尚无生效版：全员展示尚未生成，不产出名单也不提醒。
      if (['status', 'ranking', 'action'].some(kind => !insight.prompts[kind]?.active)) {
        write({ ...base, status: 'pending', generatedAt: '', inputCutoff: '' });
        return;
      }
      base.promptVersions = { status: insight.prompts.status.active.version, ranking: insight.prompts.ranking.active.version, action: insight.prompts.action.active.version };
      base.strategyVersion = F.today.replace(/-/g, '') + '-' + String(insight.prompts.status.active.version).replace(/^v/, '');
      const universe = F.insightUniverse(state, salesId);
      base.universe = universe.map(w => w.id);
      base.inputMarks = F.activeMarks(state, salesId).map(mark => ({ space: mark.space, starred: mark.starred, pause: mark.pause ? { reason: mark.pause.reason, until: mark.pause.until } : null }));
      // 演示失败分支：整批失败不沿用昨日、不补跑，只向运营通报异常。
      if (options.demoFail) {
        write({ ...base, status: 'failed', failReason: '状态判断服务超时，整批未完成' });
        F.notify(state, {
          type: '运营异常', title: '今日该跟产出失败', text: `${person.name} 的今日该跟整批失败：状态判断服务超时，整批未完成。`,
          recipients: F.opsRecipients(state), dedupKey: `ops:insight-failed:${salesId}:${F.today}`, push: false,
          link: { page: 'insight-ops', params: { tab: 'batches' } }
        });
        return;
      }
      const concluded = universe.map(w => judgeSpaceForInsight(state, w)).filter(Boolean);
      base.concluded = concluded.length;
      if (!concluded.length) { write({ ...base, status: 'empty' }); return; }
      // 只从有结论的空间排序：停滞优先于待决策，待决策优先于有进展；最多保留 5 条，截断项不丢失。
      const order = { '停滞': 0, '待决策': 1, '有进展': 2 };
      const ranked = concluded.sort((a, b) => (order[a.status] - order[b.status]) || a.space.localeCompare(b.space)).slice(0, 5);
      base.truncated = concluded.length - ranked.length;
      write({ ...base, status: 'generated', entries: ranked });
      if (ranked.length) {
        F.notify(state, {
          type: '今日该跟', title: '今日该跟已生成', text: `今天为你选出 ${ranked.length} 个该跟空间，每条建议都带原文依据。`,
          recipients: [salesId], dedupKey: `insight:${salesId}:${F.today}`, link: { page: 'today-follow' }
        });
      }
    });
    return result;
  };

  /**
   * 销售标记回流：星标开/关、暂不跟进（原因必填、结束日选填且不早于今天）、取消。
   * 标记只写入次日判断输入，不触碰当日快照；同一空间重复标记以最新一次为准并写变更日志。
   */
  F.markSpace = function (spaceId, input = {}) {
    let record = null;
    F.mutate('更新空间标记', state => {
      const space = F.space(spaceId, state);
      if (F.role !== 'SLS' || !space || space.sales !== F.actor.id) throw Error('仅归属销售本人可以标记该空间。');
      if (space.state !== 'active') throw Error('冻结空间不提供标记入口。');
      if (!(space.opps || []).length) throw Error('仅客户级确权的空间不提供标记入口。');
      if (input.pause) {
        if (!String(input.pause.reason || '').trim()) throw Error('暂不跟进必须填写原因。');
        if (input.pause.until && input.pause.until < F.today) throw Error('结束日不能早于今天。');
      }
      state.insightMarks = Array.isArray(state.insightMarks) ? state.insightMarks : [];
      record = state.insightMarks.find(item => item.space === spaceId && item.sales === F.actor.id);
      if (!record) {
        record = { id: F.uid('MK'), space: spaceId, sales: F.actor.id, starred: false, starredAt: '', pause: null, canceledAt: '', log: [] };
        state.insightMarks.unshift(record);
      }
      record.log = Array.isArray(record.log) ? record.log : [];
      if (input.cancel) {
        record.starred = false; record.starredAt = ''; record.pause = null; record.canceledAt = F.now();
        record.log.unshift({ at: F.now(), action: '取消标记', detail: '星标与暂不跟进一并取消' });
        return;
      }
      // 重复标记以最新一次为准；再次标记时自动复活已取消的记录。
      record.canceledAt = '';
      if (Object.prototype.hasOwnProperty.call(input, 'starred')) {
        record.starred = Boolean(input.starred);
        record.starredAt = record.starred ? F.now() : '';
        record.log.unshift({ at: F.now(), action: record.starred ? '星标' : '取消星标', detail: '' });
      }
      if (Object.prototype.hasOwnProperty.call(input, 'pause')) {
        record.pause = input.pause ? { reason: String(input.pause.reason).trim(), until: input.pause.until || '', at: F.now() } : null;
        record.log.unshift({ at: F.now(), action: input.pause ? '暂不跟进' : '取消暂不跟进', detail: input.pause ? `原因：${record.pause.reason}${record.pause.until ? `；结束日 ${record.pause.until}` : '；直到取消'}` : '' });
      }
      if (!record.starred && !record.pause) record.canceledAt = F.now();
    });
    return record;
  };

  /** 次日判断输入：未取消且仍有效的星标，或未取消、未过期的暂不跟进；结束日已过次日不再作为信号。 */
  F.activeMarks = function (state, salesId, date = F.today) {
    return (state.insightMarks || []).filter(mark => mark.sales === salesId && !mark.canceledAt && (mark.starred || (mark.pause && (!mark.pause.until || mark.pause.until >= date))));
  };

  /** 版本号取该提示词全部已知版本的最大值 +1，草稿、历史与被覆盖稿都计入，避免号段复用。 */
  function nextPromptVersion(prompt) {
    const nums = [prompt.active, ...(prompt.history || []), prompt.draft, ...(prompt.revisions || [])]
      .filter(Boolean).map(item => Number(String(item.version || '').replace(/^v/, ''))).filter(Number.isFinite);
    return 'v' + ((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function assertInsightOps() {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以编排提示词。');
  }

  /** 保存草稿不等于上线；已有草稿被再次保存时进入修订记录标「被覆盖」，不静默丢失。 */
  F.savePromptDraft = function (kind, body) {
    assertInsightOps();
    const text = String(body || '').trim();
    if (!text) throw Error('提示词正文为空，不能保存。');
    F.mutate('保存提示词草稿', state => {
      const prompt = state.insight.prompts[kind];
      if (!prompt) throw Error('未知的提示词种类。');
      if (prompt.draft) {
        prompt.revisions = Array.isArray(prompt.revisions) ? prompt.revisions : [];
        prompt.revisions.unshift({ ...prompt.draft, state: '被覆盖', coveredBy: F.actor.id, coveredAt: F.now() });
      }
      prompt.draft = { version: nextPromptVersion(prompt), body: text, savedAt: F.now(), savedBy: F.actor.id };
    });
  };

  /**
   * 按空间勾选试跑：只出新旧对照，不写线上名单，不写跟进、方案、归属或标记。
   * 试排序/动作必须指定上游来源（同次试跑或线上最近一次）；样本空间已冻结仍可用历史内容试跑并标明。
   */
  F.runPromptTrial = function (kind, spaceIds, upstream) {
    assertInsightOps();
    let trial = null;
    F.mutate('提示词试跑', state => {
      const insight = state.insight;
      const prompt = insight.prompts[kind];
      if (!prompt) throw Error('未知的提示词种类。');
      if (!prompt.draft) throw Error('未保存草稿不能试跑，请先保存草稿。');
      const ids = [...new Set((spaceIds || []).filter(Boolean))];
      if (!ids.length) throw Error('请勾选至少一个样本空间。');
      if (kind !== 'status') {
        if (!['trial', 'online'].includes(upstream)) throw Error('试跑排序或动作前，请补选上游输入来源。');
        if (upstream === 'online' && !insight.snapshots.some(item => item.status === 'generated')) throw Error('线上最近一次还没有可用结果，请改用同次试跑。');
        if (upstream === 'trial' && !insight.prompts.status.active) throw Error('状态提示词无生效版，无法在同次试跑中提供上游结果。');
      }
      const rows = ids.map(id => {
        const space = state.spaces.find(w => w.id === id);
        if (!space) return null;
        const frozen = space.state === 'frozen';
        const judged = judgeSpaceForInsight(state, space);
        const oldResult = insightOnlineResult(insight, space, kind);
        const newResult = kind === 'status'
          ? (judged ? judged.status : '依据不足')
          : kind === 'ranking'
            ? (judged ? '入选（试跑）' : '未入选')
            : (judged ? judged.action : '—');
        return { space: id, customer: space.customer, sales: space.sales, frozen, oldResult, newResult, changed: oldResult !== newResult };
      }).filter(Boolean);
      if (!rows.length) throw Error('所选空间不存在，请刷新后重试。');
      trial = { id: F.uid('TR'), kind, at: F.now(), by: F.actor.id, draftVersion: prompt.draft.version, upstream: kind === 'status' ? '' : upstream, spaces: rows };
      insight.trials.unshift(trial);
    });
    return trial;
  };

  /** 上线：当前生效版进入历史，草稿成为生效版，下一自然日全员跑批启用；当日已产出名单不变。 */
  F.publishPrompt = function (kind) {
    assertInsightOps();
    F.mutate('上线提示词', state => {
      const prompt = state.insight.prompts[kind];
      if (!prompt) throw Error('未知的提示词种类。');
      if (!prompt.draft) throw Error('没有可上线的草稿，请先保存。');
      prompt.history = Array.isArray(prompt.history) ? prompt.history : [];
      if (prompt.active) prompt.history.unshift(prompt.active);
      const effectiveFrom = insightNextDay();
      prompt.active = { version: prompt.draft.version, body: prompt.draft.body, publishedAt: F.now(), publishedBy: F.actor.id, effectiveFrom };
      state.insight.publishLog.unshift({ at: F.now(), by: F.actor.id, kind, version: prompt.active.version, action: 'publish', effectiveFrom });
      prompt.draft = null;
    });
  };

  /** 回退：恢复上一生效版，当前版本退回历史；同样从下一自然日全员生效。 */
  F.rollbackPrompt = function (kind) {
    assertInsightOps();
    F.mutate('回退提示词', state => {
      const prompt = state.insight.prompts[kind];
      if (!prompt) throw Error('未知的提示词种类。');
      if (!prompt.history?.length) throw Error('没有可回退的上一生效版。');
      const previous = prompt.history.shift();
      if (prompt.active) prompt.history.unshift(prompt.active);
      const effectiveFrom = insightNextDay();
      prompt.active = { ...previous, publishedAt: F.now(), publishedBy: F.actor.id, effectiveFrom };
      state.insight.publishLog.unshift({ at: F.now(), by: F.actor.id, kind, version: previous.version, action: 'rollback', effectiveFrom });
    });
  };

  /** 产出时点：全员默认 + 按销售覆盖；覆盖值等于默认视为取消覆盖；次日生效，当天已生成不重算。 */
  F.setInsightSchedule = function (input = {}) {
    assertInsightOps();
    const valid = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    F.mutate('配置今日该跟产出时点', state => {
      const schedule = state.insight.schedule;
      if (input.defaultTime !== undefined) {
        if (!valid(input.defaultTime)) throw Error('产出时点格式应为 HH:MM。');
        schedule.defaultTime = input.defaultTime;
      }
      if (input.overrides && typeof input.overrides === 'object') {
        Object.entries(input.overrides).forEach(([salesId, time]) => {
          const person = state.people.find(item => item.id === salesId && item.role === 'SLS');
          if (!person) throw Error('覆盖对象不是有效销售账号。');
          if (!valid(time)) throw Error('产出时点格式应为 HH:MM。');
          if (time === schedule.defaultTime) delete schedule.overrides[salesId];
          else schedule.overrides[salesId] = time;
        });
      }
      schedule.updatedAt = F.now();
      schedule.updatedBy = F.actor.id;
    });
  };

  /* ---------- R12 消息触达 ---------- */

  /** 演示用推送结果：默认送达；个别接收人模拟未安装，同一事项只推一次、失败不补发。 */
  F.pushDemoProfile = { 'U-1008': { status: 'not_installed', reason: '接收人尚未安装移动端 App' } };
  /** 运营异常提醒的接收人：启用中的销售运营与超管；不打扰销售。 */
  F.opsRecipients = state => state.people.filter(person => ['ADM', 'MGR'].includes(person.role) && person.status === 'on').map(person => person.id);

  /**
   * 统一提醒入口：校验接收人、按事项去重、写站内消息并发起一次移动端推送。
   * 站内必达、推送尽力；推送失败只在站内标注未送达，不改变业务状态。
   * 归属与解冻类提醒传 waitForSpace：空间内容未就绪时先持有，就绪后由 releaseWaitingNotifications 释放。
   */
  F.notify = function (state, event) {
    state.notifications = Array.isArray(state.notifications) ? state.notifications : [];
    state.deliveries = Array.isArray(state.deliveries) ? state.deliveries : [];
    const recipients = [...new Set((event.recipients || []).filter(Boolean))];
    // 无有效接收人属于运营异常，记入审计由运营排查，不静默丢弃。
    if (!recipients.length) {
      state.audit.unshift({ id: F.uid('LOG'), title: `提醒无有效接收人：${event.type} · ${event.title}`, actor: '系统', date: F.now() });
      return [];
    }
    return recipients.map(recipient => {
      const dedupKey = event.dedupKey || '';
      if (dedupKey) {
        const existing = state.notifications.find(item => item.dedupKey === dedupKey && item.recipient === recipient);
        // 同一事项重复触发时合并到已有提醒，不重复打扰。
        if (existing) { existing.deduped = Number(existing.deduped || 0) + 1; return { recipient, skipped: true, id: existing.id }; }
      }
      const waitingSpace = event.waitForSpace ? state.spaces.find(item => item.id === event.waitForSpace) : null;
      const waiting = !!(waitingSpace && waitingSpace.readiness !== 'ready');
      const notification = {
        id: F.uid('N'), recipient, type: event.type, title: event.title, text: event.text || '',
        space: event.space || '', solution: event.solution || '', changeId: event.changeId || '',
        link: event.link || null, read: false, createdAt: F.now(), dedupKey, deduped: 0,
        status: waiting ? 'waiting' : 'active', waitingReason: waiting ? '空间内容就绪后再提醒' : '',
        pushStatus: 'not_required', pushFailReason: ''
      };
      state.notifications.unshift(notification);
      if (!waiting && event.push !== false) {
        const profile = F.pushDemoProfile[recipient] || { status: 'delivered', reason: '' };
        state.deliveries.unshift({ id: F.uid('DL'), notification: notification.id, recipient, type: event.type, title: event.title, channel: '移动端推送', status: profile.status, reason: profile.reason, at: notification.createdAt });
        notification.pushStatus = profile.status;
        notification.pushFailReason = profile.reason;
      }
      return { recipient, skipped: false, id: notification.id, waiting };
    });
  };

  /** 空间内容就绪后释放被持有的提醒；释放时才发起移动端推送。 */
  F.releaseWaitingNotifications = function (state, spaceId) {
    state.notifications.filter(item => item.status === 'waiting' && item.space === spaceId).forEach(item => {
      item.status = 'active';
      item.waitingReason = '';
      const profile = F.pushDemoProfile[item.recipient] || { status: 'delivered', reason: '' };
      state.deliveries.unshift({ id: F.uid('DL'), notification: item.id, recipient: item.recipient, type: item.type, title: item.title, channel: '移动端推送', status: profile.status, reason: profile.reason, at: F.now() });
      item.pushStatus = profile.status;
      item.pushFailReason = profile.reason;
    });
  };

  /* ---------- R16 AI 文档与能力可运营化 ---------- */

  /** 文档查找统一入口；不存在时抛错，避免页面静默操作空对象。 */
  function aiDoc(state, docId) {
    const doc = (state.aiDocs?.documents || []).find(item => item.id === docId);
    if (!doc) throw Error('文档不存在，请刷新后重试。');
    return doc;
  }

  /** 正文与模块配置仅超管可维护；运营只能填写授权模块。 */
  function assertAiDocAdmin() {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以维护文档正文与模块配置。');
  }

  /** 验证、发布、skill 管理与模块填写对超管和运营开放（模块填写另按授权过滤）。 */
  function assertAiDocOps() {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以维护 AI 能力。');
  }

  /** 模块授权判定：assignees 为空表示全体销售运营可填写；否则仅名单内运营。 */
  function aiDocModuleAuthorized(module, actorId) {
    if (!module || module.disabled) return false;
    if ((module.assigneeRole || 'MGR') !== 'MGR') return false;
    return !Array.isArray(module.assignees) || !module.assignees.length || module.assignees.includes(actorId);
  }
  // 视图（modules 分面）与 fillModule 共用同一条授权判定，避免两处口径漂移。
  F.aiDocModuleAuthorized = aiDocModuleAuthorized;

  /** 下一版本号：取版本线（含当前草稿）中最大号 +1，避免与待发布草稿撞号。 */
  function nextAiDocVersion(doc) {
    const nums = [...(doc.versions || []).map(v => v.version), doc.draft?.version]
      .filter(Boolean).map(version => Number(String(version).replace(/^v/, ''))).filter(Number.isFinite);
    return 'v' + ((nums.length ? Math.max(...nums) : 0) + 1);
  }

  /** 内容变化后作废同文档进行中的验证；已结束的验证保留留痕，由发布门禁按版本与指纹判定失效。 */
  function invalidatePendingAiValidations(state, docId, note) {
    (state.aiDocs?.validations || []).filter(v => v.docId === docId && v.verdict === 'pending').forEach(v => {
      v.verdict = 'stale';
      v.staleNote = note;
      v.finishedAt = F.now();
      v.finishedBy = F.actor.id;
    });
  }

  /** 确保文档存在可写草稿：没有草稿时以当前已发布内容为基线新建。 */
  function ensureAiDocDraft(doc, kind = 'edit') {
    if (!doc.draft) {
      doc.draft = {
        baseVersion: doc.versions[0]?.version || '', version: nextAiDocVersion(doc), kind,
        restoreFrom: '', restoreFromVersion: '',
        sections: copy(doc.sections), modules: copy(doc.modules),
        updatedBy: F.actor.id, updatedAt: F.now(), fingerprint: ''
      };
    }
    return doc.draft;
  }

  /** 销售当前实际加载版本：按发布时间倒序找该销售第一条已加载目标；未加载不伪装成新版。 */
  function lastLoadedAiDocVersion(state, docId, sales) {
    const releases = (state.aiDocs?.releases || []).filter(r => r.docId === docId);
    for (const release of releases) {
      const target = (release.targets || []).find(t => t.sales === sales);
      if (target?.loaded) return release.version;
    }
    return '';
  }

  /** 只读组装文档清单：派生本地版本、最新发布、进行中验证与可发布验证，供文档分面与测试使用。 */
  F.aiDocList = function (state = F.load()) {
    const aiDocs = state.aiDocs || demoAiDocs();
    return (aiDocs.documents || []).map(doc => {
      const releases = (aiDocs.releases || []).filter(r => r.docId === doc.id);
      return {
        ...doc,
        localVersion: doc.versions[0]?.version || '',
        latestRelease: releases[0] || null,
        pendingValidation: (aiDocs.validations || []).find(v => v.docId === doc.id && v.verdict === 'pending') || null,
        passedValidation: (aiDocs.validations || []).find(v => v.docId === doc.id && v.verdict === 'passed' && doc.draft && v.version === doc.draft.version && v.fingerprint === doc.draft.fingerprint) || null
      };
    });
  };

  /** 接管回传文档：以回传内容为本地基线版本；已接管不重复操作，失败保留原状态。 */
  F.takeoverDoc = function (docId) {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以接管文档。');
    F.mutate('接管 OpenClaw 回传文档', state => {
      const doc = aiDoc(state, docId);
      if (doc.managed) throw Error('该文档已接管，无需重复操作。');
      doc.managed = true;
      doc.managedAt = F.now();
      doc.managedBy = F.actor.id;
      doc.sections = [{ id: F.uid('SEC'), title: '正文', body: String(doc.remote?.body || '') }];
      doc.versions = [{
        id: F.uid('VER'), version: doc.remote?.version || 'v1', at: F.now(), by: F.actor.id, byRole: 'ADM', kind: 'sync',
        note: '接管 OpenClaw 回传，以回传内容为本地基线', validationId: '', syncId: '',
        snapshot: { sections: copy(doc.sections), modules: [] }
      }];
    });
  };

  /**
   * 超管保存正文草稿：局部修改保留未改内容；保存不等于发布。
   * 多人协作按版本校验：所基于版本与现存草稿不一致时提示「所基于内容已变化」，不静默覆盖他人改动。
   * 内容变化后作废同文档进行中的验证。
   */
  F.saveDocBody = function (docId, sections, baseVersion) {
    assertAiDocAdmin();
    F.mutate('保存文档正文草稿', state => {
      const doc = aiDoc(state, docId);
      if (!doc.managed) throw Error('文档未接管，只读不可编辑。');
      const list = (Array.isArray(sections) ? sections : [])
        .map(s => ({ id: s.id || F.uid('SEC'), title: String(s.title || '').trim(), body: String(s.body || '').trim() }))
        .filter(s => s.title || s.body);
      if (!list.length) throw Error('正文为空，不能保存。');
      if (doc.draft && baseVersion && doc.draft.baseVersion !== baseVersion) throw Error('所基于内容已变化：他人已保存新草稿，请核对差异后再保存。');
      const draft = ensureAiDocDraft(doc);
      draft.sections = list;
      draft.updatedBy = F.actor.id;
      draft.updatedAt = F.now();
      draft.fingerprint = aiDocFingerprint(draft.sections, draft.modules);
      invalidatePendingAiValidations(state, doc.id, '内容已变化，本次验证作废');
    });
  };

  /** 回传与本地的行级差异：回传有而本地无、本地有而回传无分别标注，供人工核对；不静默覆盖。 */
  F.diffDoc = function (docId, state = F.load()) {
    const doc = aiDoc(state, docId);
    const source = doc.draft || { sections: doc.sections };
    const localText = (source.sections || []).map(s => `## ${s.title}\n${s.body}`).join('\n\n');
    const remoteLines = String(doc.remote?.body || '').split('\n').map(line => line.trim()).filter(Boolean);
    const localLines = localText.split('\n').map(line => line.trim()).filter(Boolean);
    return {
      docId: doc.id,
      remoteVersion: doc.remote?.version || '',
      remoteAt: doc.remote?.at || '',
      localVersion: doc.draft ? `${doc.versions[0]?.version || '—'} + 草稿 ${doc.draft.version}` : (doc.versions[0]?.version || '—'),
      rows: [
        ...remoteLines.filter(line => !localLines.includes(line)).map(text => ({ type: 'remote', text })),
        ...localLines.filter(line => !remoteLines.includes(line)).map(text => ({ type: 'local', text }))
      ]
    };
  };

  /**
   * 回传冲突核对：保留本地 = 本地未发布草稿原样保留，仅标记已核对；
   * 接收回传 = 以回传内容生成新草稿，仍需验证后发布，不直接覆盖生产。
   */
  F.resolveDocConflict = function (docId, keep) {
    if (F.role !== 'ADM') throw Error('仅超级管理员可以处理回传冲突。');
    if (!['local', 'remote'].includes(keep)) throw Error('核对结论应为 保留本地 或 接收回传。');
    F.mutate('核对回传版本冲突', state => {
      const doc = aiDoc(state, docId);
      if (doc.conflict !== 'remote_newer') throw Error('该文档没有待核对的回传冲突。');
      if (keep === 'remote') {
        const draft = ensureAiDocDraft(doc);
        draft.sections = [{ id: F.uid('SEC'), title: '正文', body: String(doc.remote?.body || '') }];
        draft.updatedBy = F.actor.id;
        draft.updatedAt = F.now();
        draft.fingerprint = aiDocFingerprint(draft.sections, draft.modules);
        invalidatePendingAiValidations(state, doc.id, '内容已变化（接收回传），本次验证作废');
      }
      doc.conflict = '';
      doc.conflictResolvedAt = F.now();
      doc.conflictResolvedBy = F.actor.id;
      doc.conflictResolution = keep === 'local' ? '保留本地' : '接收回传';
    });
  };

  /**
   * 超管配置填写模块：在章节下新建（名称 + 填写说明 + 授权运营），或更新 / 停用已有模块。
   * 停用保留已填内容并标注，不静默丢失；模块名称与说明不进入实际文档。
   */
  F.configureModule = function (docId, sectionId, input = {}) {
    assertAiDocAdmin();
    F.mutate('配置填写模块', state => {
      const doc = aiDoc(state, docId);
      if (!doc.managed) throw Error('文档未接管，不能配置模块。');
      const draft = ensureAiDocDraft(doc);
      if (input.id) {
        const module = draft.modules.find(m => m.id === input.id);
        if (!module) throw Error('填写模块不存在，请刷新后重试。');
        if (input.disable) {
          module.disabled = true;
          module.disabledAt = F.now();
          module.note = '模块已停用，已填内容保留，不再进入实际文档。';
        } else {
          if (input.name !== undefined && String(input.name).trim()) module.name = String(input.name).trim();
          if (input.instruction !== undefined) module.instruction = String(input.instruction).trim();
          if (Array.isArray(input.assignees)) module.assignees = [...new Set(input.assignees.filter(Boolean))];
        }
      } else {
        if (!String(input.name || '').trim()) throw Error('请填写模块名称。');
        if (!draft.sections.some(s => s.id === sectionId)) throw Error('所属章节不存在，请刷新后重试。');
        draft.modules.push({
          id: F.uid('MOD'), sectionId, name: String(input.name).trim(), instruction: String(input.instruction || '').trim(),
          assigneeRole: 'MGR', assignees: Array.isArray(input.assignees) ? [...new Set(input.assignees.filter(Boolean))] : [],
          content: '', updatedBy: '', updatedAt: '', skillRefs: [], disabled: false
        });
      }
      draft.updatedBy = F.actor.id;
      draft.updatedAt = F.now();
      draft.fingerprint = aiDocFingerprint(draft.sections, draft.modules);
      // 停用模块会改变实际文档内容，需重新验证；名称与说明改动不影响指纹。
      invalidatePendingAiValidations(state, doc.id, '模块配置已变化，本次验证作废');
    });
  };

  /**
   * 运营填写授权模块：仅授权销售运营可写；skillRefs 必须存在、去重并写明适用场景（固定版本引用）。
   * 保存只更新草稿；模块名称与填写说明不写入实际文档；内容变化作废旧验证。
   */
  F.fillModule = function (docId, moduleId, input = {}) {
    if (F.role !== 'MGR') throw Error('仅被授权的销售运营可以填写模块。');
    F.mutate('保存填写模块内容', state => {
      const doc = aiDoc(state, docId);
      if (!doc.managed) throw Error('文档未接管，不开放填写。');
      const draft = ensureAiDocDraft(doc);
      const module = draft.modules.find(m => m.id === moduleId);
      if (!module || module.disabled) throw Error('填写模块不存在或已停用。');
      if (!aiDocModuleAuthorized(module, F.actor.id)) throw Error('该模块未授权给你，越权修改已被阻止。');
      const skills = state.aiDocs?.skills || [];
      const refs = [];
      (Array.isArray(input.skillRefs) ? input.skillRefs : []).forEach(ref => {
        const skill = skills.find(s => s.id === ref?.skillId);
        if (!skill) throw Error(`引用的 skill ${ref?.skillId || '(空)'} 不存在，未保存。`);
        if (refs.some(r => r.skillId === skill.id)) return;
        if (!String(ref.scenario || '').trim()) throw Error(`请为引用的 skill「${skill.name}」写明适用场景。`);
        refs.push({ skillId: skill.id, version: skill.version, scenario: String(ref.scenario).trim() });
      });
      module.content = String(input.content || '').trim();
      module.skillRefs = refs;
      module.updatedBy = F.actor.id;
      module.updatedAt = F.now();
      draft.updatedBy = F.actor.id;
      draft.updatedAt = F.now();
      draft.fingerprint = aiDocFingerprint(draft.sections, draft.modules);
      invalidatePendingAiValidations(state, doc.id, '内容已变化，本次验证作废');
    });
  };

  /** 合成实际文档预览：正文 + 模块填写内容 + skill 调用场景说明；不含模块名称与填写说明。 */
  F.previewDoc = function (docId, useDraft = true, state = F.load()) {
    const doc = aiDoc(state, docId);
    const source = useDraft && doc.draft ? doc.draft : { sections: doc.sections, modules: doc.modules };
    const skills = state.aiDocs?.skills || [];
    const parts = (source.sections || []).map(s => `## ${s.title}\n${s.body}`);
    (source.modules || []).filter(m => !m.disabled && String(m.content || '').trim()).forEach(m => {
      const lines = [m.content.trim()];
      (m.skillRefs || []).forEach(ref => {
        const skill = skills.find(s => s.id === ref.skillId);
        lines.push(`调用 skill「${skill?.name || ref.skillId}」${ref.version}：${ref.scenario}`);
      });
      parts.push(lines.join('\n'));
    });
    return parts.join('\n\n');
  };

  /** 保存 skill 清单条目（新增或编辑）；可用状态经 markSkill 单独变更并留提醒。 */
  F.saveSkill = function (input = {}) {
    assertAiDocOps();
    if (!String(input.name || '').trim() || !String(input.purpose || '').trim()) throw Error('请填写 skill 名称与用途。');
    F.mutate('保存 skill 清单条目', state => {
      state.aiDocs.skills = Array.isArray(state.aiDocs.skills) ? state.aiDocs.skills : [];
      const existing = state.aiDocs.skills.find(s => s.id === input.id);
      if (existing) {
        Object.assign(existing, {
          name: String(input.name).trim(), purpose: String(input.purpose).trim(),
          type: input.type === '素材' ? '素材' : 'skill',
          version: String(input.version || existing.version || 'v1.0').trim(),
          manageUrl: String(input.manageUrl || '').trim(), updatedAt: F.now()
        });
      } else {
        state.aiDocs.skills.unshift({
          id: F.uid('SK'), name: String(input.name).trim(), type: input.type === '素材' ? '素材' : 'skill',
          version: String(input.version || 'v1.0').trim(), status: 'unknown',
          purpose: String(input.purpose).trim(), manageUrl: String(input.manageUrl || '').trim(), updatedAt: F.now()
        });
      }
    });
  };

  /** 标记 skill 三态；置不可用时按运营异常口径提醒（只发启用中超管与运营，不推送、不打扰销售）。 */
  F.markSkill = function (skillId, status) {
    assertAiDocOps();
    if (!['available', 'unavailable', 'unknown'].includes(status)) throw Error('可用状态应为 可用 / 不可用 / 暂无法核实。');
    F.mutate('标记 skill 可用状态', state => {
      const skill = (state.aiDocs?.skills || []).find(s => s.id === skillId);
      if (!skill) throw Error('skill 不存在，请刷新后重试。');
      skill.status = status;
      skill.updatedAt = F.now();
      if (status === 'unavailable') {
        const refs = (state.aiDocs.documents || []).flatMap(doc => [...(doc.modules || []), ...(doc.draft?.modules || [])]
          .filter(m => (m.skillRefs || []).some(r => r.skillId === skillId))
          .map(m => `${doc.name} / ${m.name}`));
        F.notify(state, {
          type: '能力发布', title: `skill「${skill.name}」不可用`,
          text: `外部 SkillHub 返回不可用。${refs.length ? `引用位置：${[...new Set(refs)].join('；')}。` : ''}请调整引用后重新验证发布；不可用不等于已删除。`,
          recipients: F.opsRecipients(state), dedupKey: `ops:skill-down:${skill.id}`, push: false,
          link: { page: 'ai-capability', params: { tab: 'skills' } }
        });
      }
    });
  };

  /**
   * 发起沙盒验证：须有待验证草稿且无进行中验证；按草稿与已发布版本的差异生成评测题（无改动不出题）。
   * 新会话无历史、以操作者身份只读真实数据；验证绑定「文档版本 + skill 版本 + 操作者」组合。
   */
  F.startValidation = function (docId) {
    assertAiDocOps();
    let validation = null;
    F.mutate('发起沙盒验证', state => {
      const doc = aiDoc(state, docId);
      if (!doc.managed) throw Error('未接管的文档不进入验证。');
      if (!doc.draft) throw Error('没有待验证的草稿，请先保存修改。');
      state.aiDocs.validations = Array.isArray(state.aiDocs.validations) ? state.aiDocs.validations : [];
      if (state.aiDocs.validations.some(v => v.docId === doc.id && v.verdict === 'pending')) throw Error('该文档已有进行中的验证，请先完成或等待。');
      const base = { sections: doc.sections, modules: doc.modules };
      const draft = doc.draft;
      const skills = state.aiDocs.skills || [];
      const changes = [];
      draft.sections.forEach(section => {
        const before = base.sections.find(s => s.id === section.id);
        if (!before) changes.push({ ref: `新增章节「${section.title}」`, observe: '回答是否体现新增章节口径', question: `围绕新增章节「${section.title}」提问，观察回答是否符合新正文？`, skillId: '' });
        else if (before.body !== section.body || before.title !== section.title) changes.push({ ref: `章节「${section.title}」正文修改`, observe: '回答是否体现新口径，且不夹带旧版表述', question: `围绕章节「${section.title}」提问，观察回答是否符合修改后的正文？`, skillId: '' });
      });
      draft.modules.forEach(module => {
        const before = base.modules.find(m => m.id === module.id);
        const beforeRefs = JSON.stringify((before?.skillRefs || []).map(r => [r.skillId, r.version, r.scenario]));
        const nextRefs = JSON.stringify((module.skillRefs || []).map(r => [r.skillId, r.version, r.scenario]));
        if (!before || before.content !== module.content) {
          changes.push({ ref: `填写模块「${module.name}」内容更新`, observe: '是否按新填写内容回应，且不泄露填写说明', question: `客户场景触发「${module.name}」时，助手是否按新填写内容回应？`, skillId: '' });
        }
        if (beforeRefs !== nextRefs) {
          (module.skillRefs || []).forEach(ref => {
            const skill = skills.find(s => s.id === ref.skillId);
            changes.push({ ref: `模块「${module.name}」引用 skill「${skill?.name || ref.skillId}」`, observe: '调用情况与来源说明；不可用时应如实说明', question: `在「${ref.scenario}」场景下，助手是否调用 ${skill?.name || ref.skillId} 并给出来源？`, skillId: ref.skillId });
          });
        }
      });
      if (!changes.length) throw Error('本次草稿与已发布版本没有内容变化，无需验证。');
      validation = {
        id: F.uid('VAL'), docId: doc.id, version: draft.version, fingerprint: draft.fingerprint,
        skillVersions: Object.fromEntries([...new Set(draft.modules.flatMap(m => (m.skillRefs || []).map(r => r.skillId)))].map(id => [id, skills.find(s => s.id === id)?.version || ''])),
        changeSummary: changes.map(c => c.ref).join('；'),
        questions: changes.map((c, i) => ({ id: `Q-${i + 1}`, question: c.question, changeRef: c.ref, observe: c.observe, skillId: c.skillId, answer: '', sources: [], calls: [], result: '', note: '' })),
        session: { id: F.uid('SES'), at: F.now(), operator: F.actor.id, readonly: true },
        verdict: 'pending', startedBy: F.actor.id, startedAt: F.now(), finishedAt: '', finishedBy: ''
      };
      state.aiDocs.validations.unshift(validation);
    });
    return validation;
  };

  /** 生成演示回答：沙盒只读、不写生产；关联 skill 不可用时应如实说明，不把引用配置当实际调用。 */
  F.answerValidation = function (validationId, questionId, answer) {
    assertAiDocOps();
    F.mutate('沙盒演示回答', state => {
      const validation = (state.aiDocs?.validations || []).find(v => v.id === validationId);
      if (!validation || validation.verdict !== 'pending') throw Error('验证不存在或已结束。');
      const question = validation.questions.find(q => q.id === questionId);
      if (!question) throw Error('评测题不存在，请刷新后重试。');
      const skill = question.skillId && (state.aiDocs.skills || []).find(s => s.id === question.skillId);
      question.answer = String(answer || '').trim() || (skill && skill.status !== 'available'
        ? `演示回答（沙盒 ${validation.session.id} · 只读）：skill「${skill.name}」当前不可用，助手如实说明并给出人工处理入口；未写入生产。`
        : `演示回答（沙盒 ${validation.session.id} · 只读）：针对「${question.question}」，结合操作者有权的真实数据给出回答样例；未写入生产。`);
      question.sources = ['客户空间 WS-201 跟进记录（只读）'];
      question.calls = skill ? [{ skillId: skill.id, name: skill.name, version: skill.version, result: skill.status === 'available' ? 'success' : 'unavailable' }] : [];
      question.answeredAt = F.now();
    });
  };

  /** 逐题人工判断：通过 / 不通过 / 需要调整 + 问题说明；系统不自动宣称通过。 */
  F.judgeValidation = function (validationId, questionId, result, note) {
    assertAiDocOps();
    if (!['pass', 'fail', 'adjust'].includes(result)) throw Error('判断结果应为 通过 / 不通过 / 需要调整。');
    F.mutate('记录评测判断', state => {
      const validation = (state.aiDocs?.validations || []).find(v => v.id === validationId);
      if (!validation || validation.verdict !== 'pending') throw Error('验证不存在或已结束。');
      const question = validation.questions.find(q => q.id === questionId);
      if (!question) throw Error('评测题不存在，请刷新后重试。');
      question.result = result;
      question.note = String(note || '').trim();
      question.judgedBy = F.actor.id;
      question.judgedAt = F.now();
    });
  };

  /** 完成验证：全部题目判断后才能结束；存在不通过题时不得标记通过（例外发布规则待产品确认，默认阻止）。 */
  F.finishValidation = function (validationId, verdict) {
    assertAiDocOps();
    if (!['passed', 'failed', 'adjust'].includes(verdict)) throw Error('验证结论应为 通过 / 不通过 / 需要调整。');
    F.mutate('完成沙盒验证', state => {
      const validation = (state.aiDocs?.validations || []).find(v => v.id === validationId);
      if (!validation || validation.verdict !== 'pending') throw Error('验证不存在或已结束。');
      if (validation.questions.some(q => !q.result)) throw Error('仍有评测题未判断，不能完成验证。');
      if (verdict === 'passed' && validation.questions.some(q => q.result === 'fail')) throw Error('存在不通过的评测题，不能标记为验证通过（例外发布规则待产品确认）。');
      validation.verdict = verdict;
      validation.finishedAt = F.now();
      validation.finishedBy = F.actor.id;
    });
  };

  /**
   * 发布到生产：须有待发布草稿、无未核对冲突，且存在与当前草稿同版本同指纹的 passed 验证。
   * 逐销售生成目标（演示剧本：U-1008 送达失败可重试、U-1005 已送达未加载继续使用最近成功版本、其余成功并生效）；
   * 部分失败只发运营提醒，不显示全量成功。
   */
  F.publishDoc = function (docId) {
    assertAiDocOps();
    let release = null;
    F.mutate('发布文档到生产', state => {
      const doc = aiDoc(state, docId);
      if (!doc.managed) throw Error('未接管的文档不进入生产同步。');
      if (doc.conflict) throw Error('回传版本与本地存在冲突，请先人工核对。');
      if (!doc.draft) throw Error('没有待发布的草稿。');
      const passed = (state.aiDocs.validations || []).find(v => v.docId === doc.id && v.verdict === 'passed' && v.version === doc.draft.version && v.fingerprint === doc.draft.fingerprint);
      if (!passed) throw Error('草稿未完成沙盒验证（或验证后内容已变化），不能同步生产。');
      const targets = (doc.targets || []).map(sales => {
        if (sales === 'U-1008') return { sales, deliver: 'failed', loaded: false, loadedVersion: lastLoadedAiDocVersion(state, doc.id, sales), effective: false, reason: 'OpenClaw 网关连接超时，未送达。', retryCount: 0 };
        if (sales === 'U-1005') {
          const fallback = lastLoadedAiDocVersion(state, doc.id, sales) || '上一成功版本';
          return { sales, deliver: 'success', loaded: false, loadedVersion: fallback, effective: false, reason: `已送达，等待销售下次会话加载；继续使用 ${fallback}。`, retryCount: 0 };
        }
        return { sales, deliver: 'success', loaded: true, loadedVersion: doc.draft.version, effective: true, reason: '', retryCount: 0 };
      });
      release = { id: F.uid('REL'), docId: doc.id, version: doc.draft.version, by: F.actor.id, at: F.now(), targets };
      state.aiDocs.releases = Array.isArray(state.aiDocs.releases) ? state.aiDocs.releases : [];
      state.aiDocs.releases.unshift(release);
      doc.versions.unshift({
        id: F.uid('VER'), version: doc.draft.version, at: release.at, by: F.actor.id, byRole: F.role,
        kind: doc.draft.kind === 'restore' ? 'restore' : 'sync',
        note: doc.draft.kind === 'restore' ? `恢复自 ${doc.draft.restoreFromVersion} 并重新验证发布` : '编辑后验证发布',
        validationId: passed.id, syncId: release.id,
        snapshot: { sections: copy(doc.draft.sections), modules: copy(doc.draft.modules) }
      });
      doc.sections = copy(doc.draft.sections);
      doc.modules = copy(doc.draft.modules);
      doc.draft = null;
      const failed = targets.filter(t => t.deliver === 'failed');
      if (failed.length) {
        F.notify(state, {
          type: '能力发布', title: '文档发布部分失败',
          text: `${doc.name} ${release.version}：${failed.map(t => F.name(t.sales)).join('、')} 同步失败，可在发布记录中重试；其余目标不显示为全量成功。`,
          recipients: F.opsRecipients(state), dedupKey: `ops:publish-fail:${release.id}`, push: false,
          link: { page: 'ai-capability', params: { tab: 'publish', doc: doc.id } }
        });
      }
    });
    return release;
  };

  /** 重试失败目标：仅失败项可重试；演示成功路径，重试后送达并加载生效，其他目标不受影响。 */
  F.retryPublishTarget = function (releaseId, salesId) {
    assertAiDocOps();
    F.mutate('重试发布失败目标', state => {
      const release = (state.aiDocs?.releases || []).find(r => r.id === releaseId);
      if (!release) throw Error('发布记录不存在，请刷新后重试。');
      const target = (release.targets || []).find(t => t.sales === salesId);
      if (!target) throw Error('该销售不在本次发布目标内。');
      if (target.deliver !== 'failed') throw Error('仅同步失败的目标可以重试。');
      target.deliver = 'success';
      target.loaded = true;
      target.loadedVersion = release.version;
      target.effective = true;
      target.reason = '';
      target.retryCount = Number(target.retryCount || 0) + 1;
      target.retriedAt = F.now();
    });
  };

  /**
   * 恢复历史版本：超管恢复正文与全部模块；运营仅恢复本人授权模块的填写内容与 skill 引用，不连带超管正文。
   * 恢复生成 kind=restore 的新草稿，必须重新完成沙盒验证后才能发布，不直接覆盖受保护正文。
   */
  F.restoreDocVersion = function (docId, versionId) {
    assertAiDocOps();
    F.mutate('恢复文档历史版本', state => {
      const doc = aiDoc(state, docId);
      if (!doc.managed) throw Error('未接管的文档不提供恢复。');
      const version = (doc.versions || []).find(v => v.id === versionId);
      if (!version || !version.snapshot) throw Error('该版本没有可恢复的内容快照。');
      const current = doc.draft || { sections: copy(doc.sections), modules: copy(doc.modules) };
      let sections, modules;
      if (F.role === 'ADM') {
        sections = copy(version.snapshot.sections || []);
        modules = copy(version.snapshot.modules || []);
      } else {
        sections = current.sections;
        modules = current.modules.map(module => {
          const snap = (version.snapshot.modules || []).find(m => m.id === module.id);
          if (!snap || !aiDocModuleAuthorized(module, F.actor.id)) return module;
          return { ...module, content: snap.content, skillRefs: copy(snap.skillRefs || []) };
        });
      }
      doc.draft = {
        baseVersion: doc.versions[0]?.version || '', version: nextAiDocVersion(doc), kind: 'restore',
        restoreFrom: version.id, restoreFromVersion: version.version,
        sections, modules, updatedBy: F.actor.id, updatedAt: F.now(), fingerprint: ''
      };
      doc.draft.fingerprint = aiDocFingerprint(doc.draft.sections, doc.draft.modules);
      invalidatePendingAiValidations(state, doc.id, '内容已变化（恢复历史版本），本次验证作废');
    });
  };

  /** 销售当前生效版本：按发布时间倒序找该销售第一条已加载目标；未加载新版时回退到最近成功加载版本。 */
  F.aiDocEffectiveFor = function (state, docId, sales) {
    const releases = (state.aiDocs?.releases || []).filter(r => r.docId === docId);
    for (const release of releases) {
      const target = (release.targets || []).find(t => t.sales === sales);
      if (target?.loaded) return { version: release.version, effective: !!target.effective, releaseId: release.id, at: release.at };
    }
    return null;
  };

  /** 消费端联动：返回当前销售对全局已接管文档的已生效版本与引用 skill，供销售助手标注来源。 */
  F.aiDocConsumption = function (state = F.load(), salesId = F.actor?.id) {
    const doc = (state.aiDocs?.documents || []).find(d => d.managed && d.scope === 'global');
    if (!doc) return null;
    const effective = F.aiDocEffectiveFor(state, doc.id, salesId);
    if (!effective) return null;
    const version = (doc.versions || []).find(v => v.version === effective.version);
    const skillIds = [...new Set((version?.snapshot?.modules || []).flatMap(m => (m.skillRefs || []).map(r => r.skillId)))];
    const skills = skillIds.map(id => (state.aiDocs.skills || []).find(s => s.id === id)).filter(Boolean)
      .map(s => ({ name: s.name, status: s.status }));
    return { docId: doc.id, docName: doc.name, version: effective.version, skills };
  };

  /* ---------- R17 销售目标与进度 ---------- */

  F.goalMetricLabels = { revenue: '流水', profit: '毛利' };
  F.goalLevelLabels = { personal: '个人目标', all: '全员目标' };
  F.goalPhaseMeta = { not_started: ['尚未开始', 'brand'], active: ['进行中', 'green'], ended: ['已结束', 'neutral'] };
  F.datahubStatusMeta = { ok: ['取数正常', 'green'], failed: ['取数失败', 'red'], never: ['尚未接入', 'neutral'] };
  F.datahubErrorKindLabels = { cost_unmatched: '成本未配对', missing_time: '时间缺失', duplicate: '重复数据' };

  /**
   * 目标录入与调整仅销售运营（MGR）可写；超管只读。
   * 固化口径：超管做配置与异常处置、运营做目标维护，界面同步标注。
   */
  F.canManageGoals = function () {
    const actor = F.actor && F.person(F.actor.id);
    return F.role === 'MGR' && !!actor && actor.role === 'MGR' && actor.status === 'on';
  };

  /** 有效收入行：缺收入结算时间的进异常清单不参与归集；同数据指纹的重复同步行只计第一次。 */
  function effectiveRevenueRows(state) {
    const seen = new Set();
    return (state.revenueRows || []).filter(row => {
      if (!row.settledAt) return false;
      if (row.fingerprint && seen.has(row.fingerprint)) return false;
      if (row.fingerprint) seen.add(row.fingerprint);
      return true;
    });
  }

  /** 有效成本行：配不上收入行的不进毛利（单独标注待核对）；同数据指纹去重。 */
  function effectiveCostRows(state) {
    const seen = new Set();
    return (state.costRows || []).filter(row => {
      if (!row.matchedRevenue) return false;
      if (row.fingerprint && seen.has(row.fingerprint)) return false;
      if (row.fingerprint) seen.add(row.fingerprint);
      return true;
    });
  }

  /**
   * 区间内达成：流水 = Σ 结算金额（不扣核减，核减口径待确认）；毛利 = Σ（结算金额 − 配对成本）。
   * 成本随收入归集，不按成本自己的记账日期；salesId 为空串时按全员口径汇总。
   */
  function achievedInRange(state, salesId, start, end) {
    const costs = effectiveCostRows(state);
    const rows = effectiveRevenueRows(state).filter(row => {
      const day = String(row.settledAt).slice(0, 10);
      return day >= start && day <= end && (!salesId || row.salesId === salesId);
    });
    const revenue = rows.reduce((sum, row) => sum + row.settledAmount, 0);
    const profit = rows.reduce((sum, row) => sum + row.settledAmount - costs.filter(cost => cost.matchedRevenue === row.id).reduce((part, cost) => part + cost.costAmount, 0), 0);
    return { revenue, profit, rows };
  }

  /** 目标区间相位：尚未开始 / 进行中 / 已结束（按演示当天 F.today 判定）。 */
  function goalPhase(goal) {
    return F.today < goal.start ? 'not_started' : F.today > goal.end ? 'ended' : 'active';
  }

  /** 同层级同销售同指标且区间相交的其他目标：允许保存，由列表提示重叠。 */
  F.goalOverlaps = function (goal, state = F.load()) {
    return (state.goals || []).filter(item => item.id !== goal.id && item.level === goal.level && item.metric === goal.metric
      && (goal.level === 'all' || item.sales === goal.sales)
      && item.start <= goal.end && goal.start <= item.end);
  };

  /**
   * 单目标进度：达成按目标区间归集；目标为 0 时不做除法（progress/gap 为 null，由界面说明）；
   * 超额时缺口取零、进度可超 100%；负毛利如实计入。
   */
  F.goalProgress = function (goal, state = F.load()) {
    const totals = achievedInRange(state, goal.level === 'personal' ? goal.sales : '', goal.start, goal.end);
    const achieved = totals[goal.metric];
    const target = Number(goal.value);
    const zeroTarget = target === 0;
    return {
      target, achieved,
      progress: zeroTarget ? null : achieved / target,
      gap: zeroTarget ? null : Math.max(0, target - achieved),
      phase: goalPhase(goal), zeroTarget,
      dataAsOf: state.datahub?.lastSuccessAt || ''
    };
  };

  /** 每个（层级, 指标, 销售）的当前目标：进行中优先，其次尚未开始，最后已结束；同相位取开始日最早的主区间。 */
  F.currentGoal = function (state, level, metric, sales = '') {
    const goals = (state.goals || []).filter(item => item.level === level && item.metric === metric && (level === 'all' || item.sales === sales));
    if (!goals.length) return null;
    const rank = goal => goalPhase(goal) === 'active' ? 0 : goalPhase(goal) === 'not_started' ? 1 : 2;
    return goals.slice().sort((a, b) => rank(a) - rank(b) || a.start.localeCompare(b.start) || b.end.localeCompare(a.end))[0];
  };

  /** 看板基准区间：当前全员流水目标的区间（缺失时回退全员毛利目标）；逐人「未设置」行的达成按该区间统计。 */
  F.goalBoardRange = function (state = F.load()) {
    const goal = F.currentGoal(state, 'all', 'revenue') || F.currentGoal(state, 'all', 'profit');
    return goal ? [goal.start, goal.end] : null;
  };

  /**
   * 运营看板：全员两指标、逐人进度、目标差异（全员 − 同区间个人之和，仅提示）与未归属业绩（全员 − Σ个人）。
   * 两级独立计算、互不推导；逐人行同时带看板基准区间达成（revenueAchieved/profitAchieved），
   * 供未设置指标时只输出达成、并保证「未归属 = 全员 − Σ个人」在同一区间口径下成立。
   */
  F.goalBoard = function (state = F.load()) {
    const range = F.goalBoardRange(state);
    const all = {};
    const targetDiff = {};
    for (const metric of ['revenue', 'profit']) {
      const goal = F.currentGoal(state, 'all', metric);
      all[metric] = goal ? { goal, ...F.goalProgress(goal, state) } : null;
      // 目标差异只在同一区间口径下对比，避免重叠或其他区间的目标被重复累加。
      targetDiff[metric] = goal ? goal.value - (state.goals || []).filter(item => item.level === 'personal' && item.metric === metric && item.start === goal.start && item.end === goal.end).reduce((sum, item) => sum + item.value, 0) : null;
    }
    const perSales = state.people.filter(person => person.role === 'SLS').map(person => {
      const row = { sales: person.id, name: person.name, status: person.status };
      for (const metric of ['revenue', 'profit']) {
        const goal = F.currentGoal(state, 'personal', metric, person.id);
        row[metric] = goal ? { goal, ...F.goalProgress(goal, state) } : null;
        row[metric + 'Achieved'] = range ? achievedInRange(state, person.id, range[0], range[1])[metric] : 0;
      }
      return row;
    });
    const costs = effectiveCostRows(state);
    const profitOf = row => row.settledAmount - costs.filter(cost => cost.matchedRevenue === row.id).reduce((sum, cost) => sum + cost.costAmount, 0);
    const unattributedRows = range ? achievedInRange(state, '', range[0], range[1]).rows.filter(row => !row.salesId) : [];
    return {
      all, perSales, targetDiff,
      unattributed: {
        revenue: unattributedRows.reduce((sum, row) => sum + row.settledAmount, 0),
        profit: unattributedRows.reduce((sum, row) => sum + profitOf(row), 0),
        rows: unattributedRows.map(row => ({ ...row, cost: row.settledAmount - profitOf(row), profit: profitOf(row) }))
      },
      dataAsOf: state.datahub?.lastSuccessAt || '', datahub: state.datahub
    };
  };

  /** 销售本人看板：未设指标为 null 只输出达成；两指标皆无目标且无达成时 hasAny 为 false，由界面给空态。 */
  F.myGoalBoard = function (salesId, state = F.load()) {
    const range = F.goalBoardRange(state);
    const board = { datahub: state.datahub, dataAsOf: state.datahub?.lastSuccessAt || '', hasAny: false };
    for (const metric of ['revenue', 'profit']) {
      const goal = F.currentGoal(state, 'personal', metric, salesId);
      board[metric] = goal ? { goal, ...F.goalProgress(goal, state) } : null;
      board[metric + 'Achieved'] = goal ? board[metric].achieved : (range ? achievedInRange(state, salesId, range[0], range[1])[metric] : 0);
      if (goal || board[metric + 'Achieved']) board.hasAny = true;
    }
    return board;
  };

  /** 目标录入/调整共用校验：目标值必填、有限数字且 ≥ 0；区间必填且结束不早于开始；个人目标归属启用中销售。 */
  function assertGoalInput(state, input) {
    const raw = String(input.value ?? '').trim();
    if (!raw) throw Error('请填写目标值。');
    const value = Number(raw);
    if (!Number.isFinite(value)) throw Error('目标值必须是有限数字。');
    if (value < 0) throw Error('目标值不能为负数。');
    const start = String(input.start || '').trim();
    const end = String(input.end || '').trim();
    if (!start || !end) throw Error('请选择目标区间的开始日与结束日。');
    if (end < start) throw Error('结束日不得早于开始日。');
    if (!['personal', 'all'].includes(input.level)) throw Error('请选择目标层级。');
    if (!['revenue', 'profit'].includes(input.metric)) throw Error('请选择流水或毛利指标。');
    if (input.level === 'personal') {
      const target = state.people.find(person => person.id === input.sales);
      if (!target || target.role !== 'SLS') throw Error('个人目标必须指定归属销售。');
      if (target.status !== 'on') throw Error('停用销售账号不再新增目标，已录目标保留可回看。');
    }
    return value;
  }

  /** 录入目标：经 F.mutate 二次校验；重叠不拒绝（由展示层提示）；按文档不发提醒。 */
  F.saveGoal = function (input = {}) {
    if (!F.canManageGoals()) throw Error('仅销售运营可以录入与调整销售目标。');
    let created;
    F.mutate('录入销售目标', state => {
      const value = assertGoalInput(state, input);
      created = {
        id: F.uid('GT'), level: input.level, metric: input.metric,
        sales: input.level === 'personal' ? input.sales : '', value,
        start: String(input.start).trim(), end: String(input.end).trim(),
        createdBy: F.actor.id, createdAt: F.now(), adjustments: []
      };
      state.goals.unshift(created);
    });
    return created;
  };

  /** 调整目标：当前值快照先入 adjustments（含原因），再写新值；历史不被覆盖，可回看任一时点目标。 */
  F.adjustGoal = function (goalId, input = {}) {
    if (!F.canManageGoals()) throw Error('仅销售运营可以录入与调整销售目标。');
    let adjusted;
    F.mutate('调整销售目标', state => {
      const goal = (state.goals || []).find(item => item.id === goalId);
      if (!goal) throw Error('目标不存在，请刷新后重试。');
      const reason = String(input.reason || '').trim();
      if (!reason) throw Error('请填写调整原因。');
      const value = assertGoalInput(state, { ...input, level: goal.level, metric: goal.metric, sales: goal.sales });
      goal.adjustments.unshift({
        at: F.now(), actor: F.actor.id,
        before: { value: goal.value, start: goal.start, end: goal.end },
        after: { value, start: String(input.start).trim(), end: String(input.end).trim() },
        reason
      });
      goal.value = value;
      goal.start = String(input.start).trim();
      goal.end = String(input.end).trim();
      adjusted = goal;
    });
    return adjusted;
  };

  /**
   * DataHub 收入成本手动取数（演示）：ok 恢复正常并刷新截止时间；fail 保留最近一次成功结果、
   * 记录失败原因，并经 F.notify 发一次运营异常（仅超管与销售运营、不推送、按日去重）。
   * 目标差异与未归属业绩按文档只在看板展示，不发提醒。
   */
  F.runDatahubSync = function (mode = 'ok') {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以操作 DataHub 取数。');
    F.mutate(mode === 'fail' ? '模拟 DataHub 取数失败' : 'DataHub 收入成本手动取数', state => {
      const hub = state.datahub;
      hub.lastAttemptAt = F.now();
      if (mode === 'fail') {
        hub.status = 'failed';
        hub.failReason = 'DataHub 收入成本接口连接超时（演示模拟）；已保留最近一次成功结果。';
        F.notify(state, {
          type: '运营异常', title: 'DataHub 取数失败',
          text: `本次收入成本取数失败：${hub.failReason} 看板数据截止 ${hub.lastSuccessAt || '无可用数据'}。`,
          recipients: F.opsRecipients(state), push: false,
          dedupKey: `ops:datahub:failed:${F.today}`,
          link: { page: 'sales-goals', params: { tab: 'datahub' } }
        });
      } else {
        hub.status = 'ok';
        hub.lastSuccessAt = hub.lastAttemptAt;
        hub.failReason = '';
      }
    });
  };

  /** 演示「从未接入」：重置后看板整体显示「暂无可用达成数据」，不显示零达成。 */
  F.resetDatahub = function () {
    if (!['ADM', 'MGR'].includes(F.role)) throw Error('仅销售运营或超级管理员可以操作 DataHub 取数。');
    F.mutate('重置 DataHub 为未接入', state => {
      state.datahub.status = 'never';
      state.datahub.lastSuccessAt = '';
      state.datahub.lastAttemptAt = '';
      state.datahub.failReason = '';
    });
  };
})(window.SC);
