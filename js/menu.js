/* ==========================================================================
   四角色默认菜单（M02-1 §4.1 已定版）
   菜单按角色统一、不逐人配置；不在本角色职责范围内的菜单直接不展示。
   batch 字段是【原型脚手架】，标注该菜单页面属哪个原型批次，不是产品 UI。
   ========================================================================== */

window.SC = window.SC || {};

SC.MENU = {

  /* ---------------------------------------------- 超级管理员：10 个菜单 */
  ADM: [
    { key: 'people',  label: '人员与账号',     icon: 'users',    href: 'people-list.html',  batch: 1, src: 'M01' },
    { key: 'groups',  label: '销售分组',       icon: 'sitemap',  href: 'groups.html',       batch: 1, src: 'M02-2' },
    { key: 'pools',   label: '客户池管理',     icon: 'layers',   href: 'pools.html',        batch: 2, src: 'M05-2' },
    { key: 'products',label: '产品管理',       icon: 'box',      href: 'products.html',     batch: 2, src: 'M06' },
    { key: 'verdictgrp', label: '客保裁决台',   icon: 'gavel',    batch: 3, src: 'M07-1/2/3',
      children: [
        { key: 'verdict',       label: '客保审批', icon: 'gavel', href: 'verdict.html',         batch: 3, src: 'M07-1/2/3' },
        { key: 'appr-records',  label: '审批记录', icon: 'file',  href: 'approval-records.html', batch: 3, src: 'M07-2' },
        { key: 'appr-handover', label: '办理交接', icon: 'users', href: 'handover.html',         batch: 3, src: 'M07-3' }
      ] },
    { key: 'admit',   label: '跟进准入终审',   icon: 'check',    href: 'admissions.html',   batch: 3, src: 'M08' },
    { key: 'custmgmt', label: '客户管理',       icon: 'building',  batch: 2, src: 'M05-1',
      children: [
        { key: 'allcust',     label: '全量客户查看', icon: 'building', href: 'customers.html',           batch: 2, src: 'M05-1' },
        { key: 'allcust-sea', label: '公海客户',     icon: 'inbox',    href: 'customers.html?scope=sea', batch: 2, src: 'M05-1 §4.5、M07-3' }
      ] },
    { key: 'recon',   label: 'CRM数据管理',       icon: 'sync',     href: 'reconcile.html',   batch: 2, src: 'M04 等 7 模块' },
    { key: 'audit',   label: '操作审计',       icon: 'shield',   href: 'audit-query.html',  batch: 1, src: 'M03-1/2' },
    { key: 'config',  label: '基础数据配置',   icon: 'sliders',  href: 'dict-list.html',    batch: 1, src: 'M05-1、M03-2' }
  ],

  /* ---------------------------------------------- 销售主管：8 个菜单 */
  MGR: [
    { key: 'home',    label: '工作台',         icon: 'grid',     href: 'manager-home.html', batch: 3, src: 'M02-1 + 4 模块回填', home: true },
    { key: 'kbappr',  label: '客保审批',       icon: 'gavel',    href: 'manager-approvals.html', batch: 3, src: 'M07-2' },
    { key: 'mysales', label: '本组销售',       icon: 'users',    href: 'manager-sales.html', batch: 3, src: 'M02-2' },
    { key: 'mycust',  label: '本组客户',       icon: 'building', href: 'manager-customers.html', batch: 3, src: 'M07-1、M08' },
    { key: 'opps',    label: '商机管理',       icon: 'box',      href: 'manager-opportunities.html', batch: 3, src: 'M05-2、M07-1' },
    { key: 'admit',   label: '跟进准入终审',   icon: 'check',    href: 'manager-admissions.html', batch: 3, src: 'M08' },
    { key: 'supervise',label: '审批监督',      icon: 'eye',      href: 'placeholder.html?p=mgr-supervise', batch: 1, src: 'PRD-03、PRD-05', empty: true },
    { key: 'except',  label: '异常处理',       icon: 'alert',    href: 'manager-exceptions.html', batch: 3, src: 'M07-1、M05-2、M09' }
  ],

  /* ---------------------------------------------- 销售：9 个菜单 */
  SLS: [
    { key: 'home',    label: '工作台',         icon: 'grid',     href: 'sales-home.html',   batch: 3, src: 'M02-1', home: true },
    { key: 'mycust',  label: '我的客户',       icon: 'building', href: 'my-customers.html', batch: 3, src: 'M07-1 等 7 模块' },
    { key: 'market',  label: '商机市场',       icon: 'search',   href: 'market.html',       batch: 3, src: 'M05-1、M07-1/2/3' },
    { key: 'myappr',  label: '我的申请',       icon: 'file',     href: 'my-requests.html',  batch: 3, src: 'M07-2、M07-3' },
    { key: 'tasks',   label: '跟进任务',       icon: 'check',    href: 'placeholder.html?p=sls-tasks',   batch: 1, src: 'PRD-02、PRD-03', empty: true },
    { key: 'records', label: '录音管理',       icon: 'mic',      href: 'placeholder.html?p=sls-records', batch: 1, src: 'PRD-02、PRD-03', empty: true },
    { key: 'flows',   label: '审批进展',       icon: 'eye',      href: 'placeholder.html?p=sls-flows',   batch: 1, src: 'PRD-03、PRD-05', empty: true },
    { key: 'plans',   label: '方案需求',       icon: 'layers',   href: 'placeholder.html?p=sls-plans',   batch: 1, src: 'PRD-04', empty: true },
    { key: 'agent',   label: '个人 Agent 对话', icon: 'chat',    href: 'placeholder.html?p=sls-agent',   batch: 1, src: 'PRD-06', empty: true }
  ],

  /* ---------------------------------------------- 解决方案人员：3 个菜单
     本期临时默认首页 = 我的客户池（M02-1 已定版第 19 条本期例外） */
  SOL: [
    { key: 'mypool',  label: '我的客户池',     icon: 'layers',   href: 'solution-pool.html', batch: 3, src: 'M02-1、M09', home: true },
    { key: 'submit',  label: '客户提报',       icon: 'file',     href: 'solution-submit.html', batch: 3, src: 'M08' },
    { key: 'plantask',label: '方案任务',       icon: 'grid',     href: 'placeholder.html?p=sol-tasks', batch: 1, src: 'PRD-04', empty: true }
  ]
};

/* 空态占位页文案 */
SC.PLACEHOLDER = {
  'mgr-supervise': { role: 'MGR', menu: 'supervise', pid: 'P-MGR-12', title: '审批监督',
    desc: '提公出与合同审批的进展监督，以及未能关联到客户的审批记录处理。',
    prd: 'PRD-03 持续跟进、录音与公出审批 ／ PRD-05 商机结果、合同确认与数据回流',
    why: '钉钉是提公出与合同审批的唯一操作端，本系统只接收发起、进展与结果并展示。审批记录的接收口径与待关联处理流程由 PRD-03、PRD-05 定义，PRD-01 只保留菜单入口。' },
  'sls-tasks': { role: 'SLS', menu: 'tasks', pid: 'P-SLS-09', title: '跟进任务',
    desc: '待办跟进任务的查看与执行。',
    prd: 'PRD-02 销售启动跟进 ／ PRD-03 持续跟进、录音与公出审批',
    why: 'PRD-01 的边界是"客户已具备进入后续业务流程的基础，但销售尚未正式启动跟进"。首次跟进任务与持续跟进任务的生成、推送与执行归 PRD-02、PRD-03。' },
  'sls-records': { role: 'SLS', menu: 'records', pid: 'P-SLS-09', title: '录音管理',
    desc: '本人录音的集中查看与管理，承接跟进录音与公出录音。',
    prd: 'PRD-02 销售启动跟进 ／ PRD-03 持续跟进、录音与公出审批',
    why: '录音必须关联至少一条商机——这是解决方案人员按客户池裁剪内容的前提，也是客保规则"有效跟进"认定的基础。该硬性前置已由 PRD-01 提出，录音业务流程本身归 PRD-03。' },
  'sls-flows': { role: 'SLS', menu: 'flows', pid: 'P-SLS-09', title: '审批进展',
    desc: '提公出与合同审批的进展查看。',
    prd: 'PRD-03 持续跟进、录音与公出审批 ／ PRD-05 商机结果、合同确认与数据回流',
    why: '审批在钉钉发起和处理，本系统只接收状态并在客户工作空间内展示，不作为审批操作端。' },
  'sls-plans': { role: 'SLS', menu: 'plans', pid: 'P-SLS-09', title: '方案需求',
    desc: '方案需求发起与方案查看。',
    prd: 'PRD-04 解决方案协同与迭代',
    why: '方案需求的发起、任务分配、版本沉淀与反馈迭代归 PRD-04。PRD-01 只交付客户池与解决方案人员的承接关系。' },
  'sls-agent': { role: 'SLS', menu: 'agent', pid: 'P-SLS-09', title: '个人 Agent 对话',
    desc: '对话式操作入口：自然语言输入与 Agent 应答、关键操作的对话式执行、待办与预警主动推送。',
    prd: 'PRD-06 多 Agent 协作',
    why: 'PRD-01 只交付工作空间驻留 Agent 的实例创建与空间绑定（验收线为"已绑定"）。销售个人 Agent、六阶段识别、行动建议与多 Agent 协作归 PRD-06。' },
  'sol-tasks': { role: 'SOL', menu: 'plantask', pid: 'P-SOL-03', title: '方案任务',
    desc: '方案任务承接与提交。本版不另设解决方案人员统计工作台。',
    prd: 'PRD-04 解决方案协同与迭代',
    why: '本菜单是解决方案人员的产品默认首页，但内容归 PRD-04。因此 PRD-01 阶段默认首页临时调整为「我的客户池」，PRD-04 交付后改回（M02-1 已定版第 19 条本期例外）。' }
};
