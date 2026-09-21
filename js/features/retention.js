/** 数据洞察：迁入飞书对话留存三栏结构，销售范围、会话窗口、日流与消息分布联动。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  F.views['data-insights'] = function (root) {
    let sales = '', tab = 'windows', date = '';
    const records = () => F.load().conversations.filter(c => (!sales || c.sales === sales) && (!date || c.date === date));
    function draw() {
      const s = F.load(), rows = records(), users = s.people.filter(p => p.role === 'SLS');
      const userMessages = rows.reduce((n, c) => n + c.messages.filter(m => m.role === 'user').length, 0);
      const replies = rows.reduce((n, c) => n + c.messages.filter(m => m.role === 'assistant').length, 0);
      root.innerHTML = `<div class="fp-rail-layout">${F.panel('销售范围', `<button class="fp-person ${sales ? '' : 'is-active'}" data-sales=""><span class="fp-avatar">全</span><strong>全部销售</strong></button>` + users.map(p => `<button class="fp-person ${sales === p.id ? 'is-active' : ''}" data-sales="${p.id}"><span class="fp-avatar">${e(p.name[0])}</span><span>${e(p.name)}<small>${s.conversations.filter(c => c.sales === p.id).length} 个会话窗口</small></span></button>`).join(''))}<div class="fp-stack">${F.metrics([['会话窗口', rows.length, '当前销售与日期范围'], ['销售消息', userMessages, '用户提问与沟通'], ['助手回复', replies, '样例回复记录'], ['活跃销售', new Set(rows.map(c => c.sales)).size, '产生会话的销售']])}<div class="fp-split"><section class="fp-panel">${F.tabs([['windows', '消息窗口'], ['daily', '每日对话流']], tab)}<div class="fp-toolbar">${F.field('日期', 'date', date, 'date')}${F.button('全部日期', 'all-dates')}</div><div data-retention></div></section>${F.panel('消息分布', `<div class="fp-pad"><div class="fp-bar-row"><span>销售消息</span><div class="fp-bar"><i style="width:${userMessages / Math.max(1, userMessages + replies) * 100}%"></i></div><span>${userMessages}</span></div><div class="fp-bar-row"><span>助手回复</span><div class="fp-bar"><i style="width:${replies / Math.max(1, userMessages + replies) * 100}%"></i></div><span>${replies}</span></div><div class="fp-readonly">对话留存用于回看沟通过程；是否形成有效跟进，以客户空间内的确认记录为准。</div></div>`)}</div></div></div>`;
      const target = root.querySelector('[data-retention]');
      if (tab === 'windows') target.innerHTML = F.table(['会话窗口', '销售', '消息数', '操作'], rows.map(c => `<tr><td>${e(c.title)}<small>${c.date}</small></td><td>${e(F.name(c.sales))}</td><td>${c.messages.length}</td><td>${F.button('查看时间线', 'timeline', c.id)}</td></tr>`), { caption: '销售助手对话留存窗口', emptyMessage: '当前销售与日期范围内没有对话记录。', countLabel: '个会话窗口' });
      else {
        const days = [...new Set(rows.map(c => c.date))].sort().reverse();
        target.innerHTML = days.length ? days.map(day => `<div class="fp-panel-head"><div><h3>${e(day)}</h3><p class="fp-hint">${rows.filter(c => c.date === day).length} 个窗口 · ${rows.filter(c => c.date === day).reduce((n, c) => n + c.messages.length, 0)} 条消息</p></div>${F.button('查看日流', 'day', day)}</div>`).join('') : F.empty('所选日期没有对话记录。');
      }
      root.querySelectorAll('[data-sales]').forEach(b => b.onclick = () => { sales = b.dataset.sales; draw(); });
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
      root.querySelector('[name=date]').onchange = event => { date = event.target.value; draw(); };
    }
    const timeline = rows => F.drawer('对话时间线', rows.map(c => `<h3>${e(c.title)}</h3><p class="fp-hint">${e(F.name(c.sales))} · ${c.date}</p><div class="fp-chat-log">${c.messages.map(m => `<div class="fp-bubble ${m.role === 'user' ? 'fp-bubble--user' : ''}"><small>${m.role === 'user' ? '销售' : '助手'}</small>\n${e(m.text)}</div>`).join('')}</div>`).join(''));
    F.bind(root, { 'all-dates': () => { date = ''; draw(); }, timeline: id => timeline(records().filter(c => c.id === id)), day: day => timeline(records().filter(c => c.date === day)) });
    draw();
  };
})(window.SC, window.SC.FEATURES);
