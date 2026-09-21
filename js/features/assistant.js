/** 销售助手与会话审阅：迁入会话侧栏、空间上下文和消息编辑区，明确本地样例回复。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  F.views['sales-assistant'] = function (root) {
    let selected = F.load().conversations.find(c => c.sales === F.actor.id)?.id || '', context = F.visible()[0]?.id || '';
    function draw() {
      const conversations = F.load().conversations.filter(c => c.sales === F.actor.id), current = conversations.find(c => c.id === selected);
      root.innerHTML = `<div class="fp-rail-layout">${F.panel('历史会话', `<div class="fp-pad">${F.button('新建会话', 'new', '', true)}</div>${conversations.map(c => `<button class="fp-person ${c.id === selected ? 'is-active' : ''}" data-chat="${c.id}"><span>${e(c.title.slice(0, 18))}<small>${c.date}</small></span></button>`).join('')}`)}<section class="fp-panel fp-chat"><header class="fp-panel-head"><div><h2>销售助手</h2><p class="fp-hint">样例回复演示 · 不调用真实模型</p></div>${F.field('关联客户空间', 'context', context, 'select', F.visible().map(w => [w.id, w.customer]))}</header><div class="fp-chat-log" aria-live="polite">${current?.messages.length ? current.messages.map(m => `<div class="fp-bubble ${m.role === 'user' ? 'fp-bubble--user' : ''}">${e(m.text)}</div>`).join('') : `<div class="fp-stack"><h2>从今天要推进的客户开始</h2><p class="fp-hint">结合客户空间里的事实，梳理重点、准备沟通或整理跟进草稿。</p><div class="fp-actions">${F.button('梳理下一步行动', 'suggest', '帮我梳理这个客户的下一步行动')}${F.button('准备拜访提纲', 'suggest', '帮我准备客户拜访提纲')}</div></div>`}</div><form class="fp-composer"><textarea name="message" rows="3" aria-label="输入问题" placeholder="输入问题，或选择上方建议…" required></textarea><button class="btn btn--primary" type="submit">发送</button></form><div class="fp-pad"><p class="fp-hint">跟进草稿确认后才能写入客户空间。</p>${context && F.canWrite(F.space(context)) ? F.button('整理为跟进草稿', 'draft', context) : ''}</div></section></div>`;
      root.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => { selected = b.dataset.chat; draw(); });
      root.querySelector('[name=context]').onchange = event => { context = event.target.value; draw(); };
      root.querySelector('form').onsubmit = event => { event.preventDefault(); const text = new FormData(event.currentTarget).get('message').trim(); if (text) send(text); };
    }
    function send(text) {
      F.mutate('销售助手演示会话', s => {
        const w = F.space(context, s);
        if (!w) throw Error('请先选择有权访问的客户空间。');
        let c = s.conversations.find(c => c.id === selected && c.sales === F.actor.id);
        if (!c) { c = { id: F.uid('CHAT'), sales: F.actor.id, title: text.slice(0, 24), date: F.today, messages: [] }; s.conversations.unshift(c); selected = c.id; }
        c.messages.push({ role: 'user', text });
        // R16 轻量联动：演示回复尾部追加来源标识——当前销售实际生效的文档版本与引用 skill（未生效时如实说明）。
        const consumption = F.aiDocConsumption(s, F.actor.id);
        const skillText = consumption?.skills.length ? ' · 调用 skill：' + consumption.skills.map(item => item.name + (item.status === 'available' ? '' : '（不可用）')).join('、') : '';
        const basis = consumption ? `依据：${consumption.docName} ${consumption.version}（已生效）${skillText} · ${w.id} 客户空间` : `依据：${w.id} 客户空间 · 助手文档尚未生效`;
        c.messages.push({ role: 'assistant', text: `演示回复 · ${w.customer}\n\n已有事实：${w.brief}\n\n建议下一步：\n1. 确认客户的决策时间与参会人员。\n2. 对齐业务量、验收标准及预算范围。\n3. 将待确认事项整理为下次沟通议程。\n\n${basis}。此为预置样例，未调用真实模型。` });
      });
      draw();
    }
    F.bind(root, { new: () => { selected = ''; draw(); }, suggest: text => send(text), draft: id => F.followupForm(id, draw, '待确认草稿：' + F.space(id).brief) });
    draw();
  };
  F.views['conversation-review'] = function (root) {
    root.innerHTML = F.panel('会话记录', F.searchbar('搜索会话标题 / 销售') + '<div data-results></div>', F.badge('只读审阅'));
    function draw(q = {}) {
      const rows = F.load().conversations.filter(c => !q.q || (c.title + F.name(c.sales)).includes(q.q.trim()));
      root.querySelector('[data-results]').innerHTML = F.table(['会话主题', '销售', '日期', '消息数', '操作'], rows.map(c => `<tr><td>${e(c.title)}</td><td>${e(F.name(c.sales))}</td><td>${c.date}</td><td>${c.messages.length}</td><td>${F.button('查看对话', 'detail', c.id)}</td></tr>`), { caption: '销售助手会话审阅记录', emptyMessage: '没有符合条件的销售助手会话。', countLabel: '个会话', totalCount: F.load().conversations.length });
    }
    F.handleSearch(root, draw);
    F.bind(root, { detail: id => { const c = F.load().conversations.find(c => c.id === id); F.drawer(c.title, `<div class="fp-chat-log">${c.messages.map(m => `<div class="fp-bubble ${m.role === 'user' ? 'fp-bubble--user' : ''}"><small>${m.role === 'user' ? e(F.name(c.sales)) : '销售助手'}</small>\n${e(m.text)}</div>`).join('')}</div>`); } });
    draw();
  };
})(window.SC, window.SC.FEATURES);
