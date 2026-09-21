/**
 * 本人助手对话页（mobile-ios-chat.html）专项回归。
 * 覆盖：骨架渲染、简单问答（引用脚注）、多步执行计划（折叠/展开/失败重试）、
 * 敏感操作确认的允许与取消两条路径、停止生成、消息操作（编辑重发/分支对话）。
 * 页面脚本用 window.FN_FAST 压缩演示延迟，测试用真实计时器轮询。
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const pageDir = path.join(__dirname, '..', 'mobile-ios-sales-assistant', 'pages');

function loadChat() {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  const dom = new JSDOM(fs.readFileSync(path.join(pageDir, 'mobile-ios-chat.html'), 'utf8'), {
    url: 'http://prototype.test/mobile-ios-sales-assistant/pages/mobile-ios-chat.html',
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.FN_FAST = true;
  for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
  return { w, doc: w.document, errors, close: () => w.close() };
}

/** 轮询直到断言成立；超时把断言原文抛出，便于定位是哪一步没走到。 */
async function until(fn, label, ms = 9000) {
  const t0 = Date.now();
  for (;;) {
    try { const v = fn(); if (v) return v; } catch (e) { /* 断言未就绪，继续等 */ }
    if (Date.now() - t0 > ms) { fn(); throw new Error('等待超时：' + label); }
    await new Promise((r) => setTimeout(r, 25));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 等一轮生成彻底收尾：回答存在、打字光标移除、发送键回到 send（finally 已执行）。 */
async function settled(t, label) {
  await until(() => t.doc.querySelector('.fn-answer') && !t.doc.querySelector('.fn-caret') && t.doc.querySelector('[data-chat-send]').dataset.state === 'send', label || '生成收尾');
}

test('聊天页骨架：顶栏定位、三个剧本入口、吸底输入区与口径文案', () => {
  const t = loadChat();
  try {
    assert.equal(t.doc.querySelector('.fn-title strong').textContent, '本人助手');
    assert.ok(t.doc.querySelector('.fn-title span').textContent.includes('销售作业 AGENT'), '副标题标明销售作业 Agent 定位');
    assert.equal(t.doc.querySelectorAll('[data-chat-suggestion]').length, 3, '三个剧本入口');
    assert.ok(t.doc.querySelector('[data-chat-field]'), '输入框存在');
    assert.ok(t.doc.querySelector('[data-chat-feedback]').textContent.includes('只读取你有权访问'), '口径文案保留');
    assert.ok(t.doc.querySelector('[data-chat-back]'), '返回按钮存在');
    assert.deepEqual(t.errors, [], '初始化无脚本错误');
  } finally { t.close(); }
});

test('简单问答：流式回答带来源脚注，点击脚注打开原文弹层', async () => {
  const t = loadChat();
  try {
    t.doc.querySelector('[data-chat-suggestion]').click();
    await until(() => t.doc.querySelector('.fn-answer') && t.doc.querySelector('.fn-answer').textContent.includes('试点下周三启动'), 'R1 回答');
    assert.ok(t.doc.querySelector('.fn-understand').textContent.includes('星辰科技'), '先给目标理解');
    const cite = await until(() => t.doc.querySelector('.fn-cite[data-cite="1"]'), '脚注〔1〕随回答出现');
    await settled(t, 'R1 收尾');
    cite.click();
    const sheet = t.doc.querySelector('.fn-sheet');
    assert.ok(sheet, '点击脚注打开来源弹层');
    assert.ok(sheet.textContent.includes('下午拜访确认试点下周三启动'), '弹层展示跟进原文');
    sheet.closest('.fn-sheet-mask').dispatchEvent(new t.w.MouseEvent('click', { bubbles: true }));
    await until(() => !t.doc.querySelector('.fn-sheet-mask'), '弹层关闭');
  } finally { t.close(); }
});

test('多步执行计划：默认折叠、点击展开、失败步骤重试、过程产物与总耗时', async () => {
  const t = loadChat();
  try {
    t.doc.querySelectorAll('[data-chat-suggestion]')[1].click();
    const plan = await until(() => t.doc.querySelector('.fn-plan'), '执行计划出现');
    assert.equal(plan.classList.contains('open'), false, '计划默认折叠');
    assert.equal(t.doc.querySelectorAll('.fn-step').length, 4, '四步');
    plan.querySelector('.fn-plan-head').click();
    assert.equal(plan.classList.contains('open'), true, '点击展开计划');
    const retryBtn = await until(() => t.doc.querySelector('.fn-step.is-fail [data-retry]'), 'DataHub 步骤失败并给出重试');
    assert.ok(t.doc.querySelector('.fn-step.is-fail').textContent.includes('DataHub 取数超时'), '失败原因可读');
    retryBtn.click();
    await until(() => plan.querySelector('.fn-dot-done'), '重试后计划完成');
    assert.equal(plan.querySelector('[data-elapsed]').textContent, '共 5.5s', '完成后定格总耗时');
    assert.equal(plan.querySelectorAll('.fn-sealcheck').length, 4, '四步全部打卡');
    const receipt = await until(() => [...t.doc.querySelectorAll('.fn-receipt')].find((n) => n.textContent.includes('风险清单')), '过程产物卡');
    assert.ok(receipt.textContent.includes('高峰发送量数据未补齐'), '产物内容真实');
    await until(() => t.doc.querySelector('.fn-answer') && t.doc.querySelector('.fn-answer').textContent.includes('三处'), '最终答案');
  } finally { t.close(); }
});

test('敏感操作确认双路径：先取消不发送，再确认执行拿到发送回执', async () => {
  const t = loadChat();
  try {
    const q = t.doc.querySelectorAll('[data-chat-suggestion]')[2].dataset.q;
    /* 路径一：取消 */
    t.doc.querySelectorAll('[data-chat-suggestion]')[2].click();
    const sign1 = await until(() => t.doc.querySelector('.fn-sign'), '确认卡出现');
    assert.ok(sign1.textContent.includes('不可撤回'), '确认卡说明影响');
    sign1.querySelector('[data-deny]').click();
    await until(() => [...t.doc.querySelectorAll('.fn-note')].some((n) => n.textContent.includes('已取消')), '取消注记');
    await until(() => t.doc.querySelector('.fn-answer') && t.doc.querySelector('.fn-answer').textContent.includes('没有发送'), '取消后的答复');
    assert.ok(t.doc.querySelector('.fn-stamp-big.deny'), '取消盖章');
    assert.equal(t.doc.querySelector('.fn-receipt'), null, '取消路径不产生发送回执');
    await settled(t, '取消路径收尾');
    /* 路径二：重新发起并确认 */
    t.doc.querySelector('[data-chat-field]').value = q;
    t.doc.querySelector('[data-chat-send]').click();
    const sign2 = await until(() => [...t.doc.querySelectorAll('.fn-sign')].find((n) => !n.classList.contains('stamped')), '第二次确认卡');
    sign2.querySelector('[data-allow]').click();
    await until(() => [...t.doc.querySelectorAll('.fn-receipt')].some((n) => n.textContent.includes('发送回执')), '发送回执');
    await until(() => [...t.doc.querySelectorAll('.fn-answer')].some((n) => n.textContent.includes('已确认并发出')), '确认后的答复');
    assert.ok([...t.doc.querySelectorAll('.fn-stamp-big')].some((n) => !n.classList.contains('deny')), '确认盖章');
  } finally { t.close(); }
});

test('停止生成：发送键切换为停止，停止后条目留下可重新生成的注记', async () => {
  const t = loadChat();
  try {
    t.doc.querySelectorAll('[data-chat-suggestion]')[1].click();
    const sendBtn = t.doc.querySelector('[data-chat-send]');
    assert.equal(sendBtn.dataset.state, 'stop', '生成中发送键变为停止');
    sendBtn.click();
    await until(() => [...t.doc.querySelectorAll('.fn-note')].some((n) => n.textContent.includes('已停止生成')), '停止注记');
    assert.equal(sendBtn.dataset.state, 'send', '停止后发送键复原');
  } finally { t.close(); }
});

test('编辑重发替换原消息并截断后续回复', async () => {
  const t = loadChat();
  try {
    /* 先跑完一轮问答，再对最早的用户消息做编辑重发 */
    t.doc.querySelector('[data-chat-suggestion]').click();
    await settled(t, '第一轮回答完成');
    const userEntry = t.doc.querySelector('.fn-entry.fn-user');
    const userId = userEntry.dataset.id;
    userEntry.querySelector('[data-menu]').click();
    const editBtn = await until(() => [...t.doc.querySelectorAll('.fn-action')].find((n) => n.textContent.includes('编辑重发')), '编辑重发入口');
    editBtn.click();
    assert.equal(t.doc.querySelector('[data-banner]').hidden, false, '编辑横幅出现');
    const field = t.doc.querySelector('[data-chat-field]');
    assert.equal(field.value, '星辰科技上次沟通到哪一步了？', '原文回填输入框');
    t.doc.querySelector('[data-chat-send]').click();
    await settled(t, '编辑后重新作答');
    assert.equal(t.doc.querySelectorAll('.fn-entry.fn-user').length, 1, '编辑重发不产生新的用户条目');
    assert.equal(t.doc.querySelector('.fn-entry.fn-user').dataset.id, userId, '原消息被替换而不是新增');
    assert.equal(t.doc.querySelector('[data-banner]').hidden, true, '发送后横幅收起');
  } finally { t.close(); }
});

test('分支对话：从任意条目分叉，顶栏 pill 在分支间切换', async () => {
  const t = loadChat();
  try {
    t.doc.querySelector('[data-chat-suggestion]').click();
    await settled(t, '第一轮回答完成');
    /* 再发一条自由问题走兜底剧本，让主线有两轮内容 */
    t.doc.querySelector('[data-chat-field]').value = '今天天气适合跑客户吗';
    t.doc.querySelector('[data-chat-send]').click();
    await until(() => [...t.doc.querySelectorAll('.fn-answer')].some((n) => n.textContent.includes('不便编造')), '兜底回答');
    await settled(t, '兜底收尾');
    assert.equal(t.doc.querySelector('[data-branch]').hidden, true, '单线时不显示分支 pill');
    /* 从第一条用户消息分叉 */
    const firstUser = t.doc.querySelector('.fn-entry.fn-user');
    firstUser.querySelector('[data-menu]').click();
    const branchBtn = await until(() => [...t.doc.querySelectorAll('.fn-action')].find((n) => n.textContent.includes('分支对话')), '分支入口');
    branchBtn.click();
    const pill = t.doc.querySelector('[data-branch]');
    assert.equal(pill.hidden, false, '分叉后出现分支 pill');
    assert.equal(pill.textContent, '分支 1 2/2', '新分支编号与总数');
    assert.equal(t.doc.querySelectorAll('.fn-entry.fn-user').length, 1, '分支只保留分叉点之前的内容');
    pill.click();
    assert.equal(pill.textContent, '主线 1/2', '切回主线');
    assert.equal(t.doc.querySelectorAll('.fn-entry.fn-user').length, 2, '主线两轮内容都在');
  } finally { t.close(); }
});
