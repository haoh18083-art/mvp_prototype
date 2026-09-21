/** 经营洞察、推送跟进与销售目标进度：复用生产前端的销售侧栏、三页签、时间线和客户级追踪结构。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  F.views['employee-insights'] = function (root) {
    const people = F.load().people.filter(p => p.role === 'SLS' && F.visible().some(w => w.sales === p.id));
    let selected = people[0]?.id, tab = 'profile', date = F.today;
    function draw() {
      const spaces = F.visible().filter(w => w.sales === selected);
      const records = F.records('followups').filter(r => spaces.some(w => w.id === r.space));
      const solutions = F.records('solutions').filter(r => !r.withdrawn && spaces.some(w => w.id === r.space));
      root.innerHTML = `<div class="fp-rail-layout">${F.panel('销售成员', people.map(p => `<button class="fp-person ${p.id === selected ? 'is-active' : ''}" data-person="${p.id}"><span class="fp-avatar">${e(p.name[0])}</span><span><strong>${e(p.name)}</strong><small>${F.visible().filter(w => w.sales === p.id).length} 个客户空间</small></span></button>`).join(''))}<div class="fp-stack">${F.metrics([['客户空间', spaces.length, '当前所选销售'], ['跟进记录', records.length, '空间经营内容'], ['方案已读', solutions.filter(r => r.read).length + '/' + solutions.length, '销售打开方案'], ['待回复方案', solutions.filter(r => !r.reply).length, '待推进事项']])}<section class="fp-panel">${F.tabs([['profile', '客户全局'], ['daily', '每日跟进'], ['activity', '活跃度与采纳']], tab)}<div class="fp-toolbar"><strong>${e(F.name(selected))}</strong><div class="u-grow"></div>${F.field('观察日期', 'date', date, 'date')}${F.button('导出当前数据', 'export')}</div><div class="fp-pad" data-insight></div></section></div></div>`;
      const target = root.querySelector('[data-insight]');
      if (tab === 'profile') {
        target.innerHTML = F.table(['客户', '客户池', '等级', '阶段', '操作'], spaces.map(w => `<tr><td>${e(w.customer)}</td><td>${e(w.pool)}</td><td>${F.badge(w.grade, 'brand')}</td><td>${e(w.stage)}</td><td><a href="${F.link('followup-workbench', { space: w.id })}">查看空间</a></td></tr>`), { caption: '所选销售的客户空间概览', emptyMessage: '所选销售当前没有可见客户空间。', countLabel: '个客户空间' }) + `<div class="fp-config-grid u-mt4"><div><h3>经营阶段分布</h3>${[...new Set(spaces.map(w => w.stage))].map(stage => { const count = spaces.filter(w => w.stage === stage).length; return `<div class="fp-bar-row"><span>${e(stage)}</span><div class="fp-bar"><i style="width:${count / Math.max(1, spaces.length) * 100}%"></i></div><span class="u-right">${count}</span></div>`; }).join('')}</div><div><h3>需要关注</h3><div class="fp-callout u-mt4">${spaces.filter(w => w.state === 'active').length} 个空间仍在推进。优先确认方案待回复的客户，再处理已有明确下一步的商机。</div><p class="fp-hint u-mt3">依据当前演示记录汇总；不推断客户归属。</p></div></div>`;
      } else if (tab === 'daily') {
        const daily = records.filter(r => r.date.startsWith(date));
        target.innerHTML = daily.length ? `<div class="fp-timeline">${daily.map(r => `<article class="fp-event"><h3>${e(F.space(r.space).customer)}</h3><p>${e(r.text)}</p><small>${e(r.date)} · ${e(r.type)}</small><div class="u-mt2"><a href="${F.link('followup-workbench', { space: r.space })}">查看跟进上下文 →</a></div></article>`).join('')}</div>` : F.empty('所选日期没有跟进记录，可切换到 2026-09-14 查看样例。');
      } else {
        const cells = Array.from({ length: 30 }, (_, i) => { const day = new Date(Date.UTC(2026, 8, 15 - 29 + i)).toISOString().slice(0, 10); const count = records.filter(r => r.date.startsWith(day)).length; return `<span class="level-${Math.min(3, count)}" title="${day} · ${count} 条跟进">${day.slice(-2)}</span>`; }).join('');
        target.innerHTML = `<h3 class="u-mb4">最近 30 天跟进活动</h3><div class="fp-heatmap">${cells}</div><p class="fp-hint u-mt3">浅 → 深代表记录数增加；空白表示当日未记录跟进。</p><div class="fp-callout u-mt4">方案采纳只展示已有反馈：${solutions.filter(r => r.reply).length} 条方案已有销售回复，${solutions.filter(r => !r.reply).length} 条待反馈。已读不等于已采纳。</div>`;
      }
      root.querySelectorAll('[data-person]').forEach(b => b.onclick = () => { selected = b.dataset.person; draw(); });
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
      root.querySelector('[name=date]').onchange = event => { date = event.target.value; draw(); };
    }
    F.bind(root, { export: () => F.download('经营洞察.csv', F.csv([['客户', '销售', '客户池', '经营阶段', '空间状态'], ...F.visible().filter(w => w.sales === selected).map(w => [w.customer, F.name(w.sales), w.pool, w.stage, w.state])])) });
    draw();
  };
  F.views['push-followup'] = function (root) {
    let query = {};
    const records = () => F.records('solutions').filter(r => !r.withdrawn);
    const after = r => F.records('followups').filter(f => f.space === r.space && f.date >= r.date);
    function draw() {
      const rows = records();
      root.innerHTML = F.metrics([['推送方案', rows.length, '实际演示推送记录'], ['已读', rows.filter(r => r.read).length, '由销售打开确认'], ['推送后跟进', rows.filter(r => after(r).length).length, '跟进时间不早于推送'], ['推送未跟进', rows.filter(r => !after(r).length).length, '优先关注']]) + F.panel('客户推送与跟进', F.searchbar('搜索客户 / 方案', F.field('关注范围', 'scope', '', 'select', [['', '全部客户'], ['missed', '推送未跟进'], ['no_reply', '方案未回复']]) + F.field('接收销售', 'sales', '', 'select', [['', '全部销售'], ...F.load().people.filter(p => p.role === 'SLS').map(p => [p.id, p.name])])) + '<div data-results></div>', F.button('导出明细', 'export'));
      filter(query); F.handleSearch(root, filter);
    }
    function filtered(q = {}) { return records().filter(r => { const w = F.space(r.space); return (!q.q || (w.customer + r.title).includes(q.q.trim())) && (!q.sales || w.sales === q.sales) && (!q.scope || (q.scope === 'missed' ? !after(r).length : !r.reply)); }); }
    function filter(q = {}) {
      query = q; F.restoreSearch(root, q);
      const rows = filtered(q);
      root.querySelector('[data-results]').innerHTML = F.table(['客户 / 方案', '销售', '推送时间', '送达反馈', '推送后跟进', '操作'], rows.map(r => `<tr><td><strong>${e(F.space(r.space).customer)}</strong><small>${e(r.title)}</small></td><td>${e(F.name(F.space(r.space).sales))}</td><td>${e(r.date)}</td><td>${F.badge(r.reply ? '已回复' : r.read ? '已读' : '未读', r.reply ? 'green' : 'brand')}</td><td>${after(r).length ? F.badge(after(r).length + ' 条记录', 'green') : F.badge('未跟进', 'amber')}</td><td>${F.button('查看时间线', 'timeline', r.id)}</td></tr>`), { caption: '客户方案推送后的销售跟进记录', emptyMessage: '没有符合条件的推送记录，请调整客户、方案、销售或关注范围筛选。', countLabel: '条推送记录', note: '跟进取自对应客户空间', totalCount: records().length });
    }
    F.bind(root, {
      timeline: id => {
        const r = records().find(r => r.id === id), w = F.space(r.space);
        const items = [{ date: r.date, title: '方案推送', text: r.body }, ...after(r).map(f => ({ date: f.date, title: '销售跟进 · ' + f.type, text: f.text })), ...(r.reply ? [{ date: r.replyDate || r.date, title: '销售回复', text: r.reply }] : [])].sort((a, b) => a.date.localeCompare(b.date));
        F.drawer(w.customer + ' · 推送跟进', `<div class="fp-timeline">${items.map(item => `<article class="fp-event"><h3>${e(item.title)}</h3><p>${e(item.text)}</p><small>${e(item.date)}</small></article>`).join('')}</div><a class="btn" href="${F.link('followup-workbench', { space: w.id })}">查看完整空间</a>`);
      },
      export: () => F.download('方案推送跟进.csv', F.csv([['客户', '销售', '方案', '推送时间', '已读', '回复', '推送后跟进数'], ...filtered(query).map(r => [F.space(r.space).customer, F.name(F.space(r.space).sales), r.title, r.date, r.read ? '是' : '否', r.reply, after(r).length])]))
    });
    draw();
  };
  F.views['platform-data'] = function (root) {
    let tab = 'data';
    function draw() {
      const s = F.load(), total = s.batches.reduce((v, b) => v + b.total, 0), pending = s.batches.reduce((v, b) => v + b.pending, 0);
      root.innerHTML = F.metrics([['入库客户', total, 'DataHub 演示批次'], ['已匹配', total - pending, '客户关联完成'], ['待治理', pending, '需要人工核对'], ['方案推送', F.records('solutions').length, '查看实际分发记录']]) + `<section class="fp-panel">${F.tabs([['data', '数据治理'], ['production', '方案生产'], ['delivery', '方案分发']], tab)}<div data-facet></div></section>`;
      const target = root.querySelector('[data-facet]');
      if (tab === 'data') target.innerHTML = F.table(['批次', '日期', '客户数', '匹配成功', '待治理', '状态', '操作'], s.batches.map(b => `<tr><td class="mono">${b.id}</td><td>${b.date}</td><td>${b.total}</td><td>${b.matched}</td><td>${b.pending}</td><td>${F.badge(b.status, b.pending ? 'amber' : 'green')}</td><td>${F.button('查看批次', 'batch', b.id)}</td></tr>`), { caption: '客户数据治理批次', emptyMessage: '当前没有客户数据治理批次。', countLabel: '个批次', compact: true });
      if (tab === 'production') target.innerHTML = `<div class="fp-pad fp-stack"><h3>今日方案生产</h3><div class="fp-callout">数据匹配 → 客户范围确认 → 方案生成 → 分发准备</div><p class="fp-hint">当前演示批次 ${pending ? '存在待治理客户，处理后可进入下一步。' : '已完成匹配。'}</p></div>` + F.table(['批次', '就绪客户', '生产状态'], s.batches.map(b => `<tr><td>${b.id}</td><td>${b.matched}</td><td>${F.badge(b.pending ? '等待数据治理' : '可生产', b.pending ? 'amber' : 'green')}</td></tr>`), { caption: '方案生产批次就绪状态', emptyMessage: '当前没有可用于方案生产的批次。', countLabel: '个批次', compact: true });
      if (tab === 'delivery') target.innerHTML = F.table(['方案', '接收客户', '销售', '状态', '追踪'], F.records('solutions').filter(r => !r.withdrawn).map(r => `<tr><td>${e(r.title)}</td><td>${e(F.space(r.space).customer)}</td><td>${e(F.name(F.space(r.space).sales))}</td><td>${F.badge(r.read ? '已读' : '已送达', 'green')}</td><td><a href="${F.link('push-followup')}">查看推送跟进</a></td></tr>`), { caption: '方案分发与接收状态', emptyMessage: '当前没有已分发的方案。', countLabel: '条方案' });
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    }
    F.bind(root, { batch: id => {
      const b = F.load().batches.find(b => b.id === id);
      F.drawer('批次 ' + id, `<div class="fp-stack"><dl class="fp-kv"><dt>日期</dt><dd>${b.date}</dd><dt>已匹配</dt><dd>${b.matched} / ${b.total}</dd><dt>待治理</dt><dd>${b.pending}</dd></dl>${b.pending ? `<div class="fp-callout fp-callout--warn">${b.pending} 条客户记录存在重名或缺少来源标识，需要逐项核对。</div><p class="fp-hint">样例关联核对：星辰科技 → 星辰科技有限公司；统一社会信用代码一致。</p>${F.button('确认本条匹配', 'resolve', id, true)}` : '<div class="fp-callout">本批次客户匹配已全部完成。</div>'}</div>`, (mask, close) => F.bind(mask, { resolve: () => { F.mutate('确认客户来源匹配', s => { const batch = s.batches.find(x => x.id === id); if (batch.pending > 0) { batch.pending--; batch.matched++; batch.status = batch.pending ? '待处理' : '已完成'; } }); close(); draw(); SC.toast('本条匹配已确认', 'ok'); } }));
    } });
    draw();
  };
  /* ---------- R13 今日该跟（销售）与经营洞察编排（运营） ---------- */

  /**
   * 今日该跟（销售）：只读当日快照，区分已生成 / 尚未生成 / 生成失败 / 空名单 / 无可判断空间五种呈现。
   * 页面只用业务语言：不出现焦点池、规则名、提示词名；策略版本对销售是不透明编号。
   * 标记（星标 / 暂不跟进）只写入次日判断输入，当天名单不变。
   */
  F.views['today-follow'] = function (root) {
    const salesId = F.actor.id;

    /** 依据抽屉：每条依据标注来自哪一步判断（状态判断 / 顺序建议 / 动作建议），原文直接可读；录音另给进入入口。 */
    function openEvidence(spaceId) {
      const state = F.load();
      const snapshot = F.todaySnapshot(state, salesId);
      const entry = snapshot?.entries.find(item => item.space === spaceId);
      if (!entry) { SC.toast('该条目不在今日名单内。', 'bad'); return; }
      const items = (entry.evidence || []).map(ev => {
        const record = F.sourceRecord({ type: ev.type, id: ev.id }, state);
        const body = record
          ? record.available
            ? `<div class="fp-callout u-mt2" data-source-body>${e(record.body || '原文暂无正文。')}</div>`
            : `<div class="fp-callout fp-callout--warn u-mt2" data-source-unavailable>来源不可用：${e(record.unavailableReason || '原文已不可读。')}</div>`
          : '<p class="u-t3 u-mt2">来源已不在当前可见范围。</p>';
        const transcribeNote = ev.type === 'meeting' && ev.transcribeReady === false ? '<p class="fp-hint u-mt2">录音已归位，转写未就绪；可先进入该条录音查看。</p>' : '';
        const meetingLink = ev.type === 'meeting' ? `<div class="u-mt2"><a class="btn" href="${F.link('meeting-center', { meeting: ev.id })}">进入该条录音</a></div>` : '';
        return `<section class="fp-panel fp-pad" data-evidence="${e(ev.type)}:${e(ev.id)}"><div class="fp-actions">${F.badge('来自' + (F.insightStepLabels[ev.step] || ev.step), 'brand')}<strong>${e(ev.label)}</strong><span class="u-t3">${e(ev.at || '')}</span></div>${body}${transcribeNote}${meetingLink}</section>`;
      }).join('');
      F.drawer(`依据 · ${entry.customer}`, `<div class="fp-stack" data-evidence-drawer><div class="fp-callout">每条依据都标注来自哪一步判断，并可回溯原文。</div>${items || '<p class="u-t3">该条目没有记录依据。</p>'}</div>`);
    }

    function draw() {
      const state = F.load();
      const snapshot = F.todaySnapshot(state, salesId);
      const universe = F.insightUniverse(state, salesId);
      const marks = (state.insightMarks || []).filter(item => item.sales === salesId);
      const markOf = spaceId => marks.find(item => item.space === spaceId);
      const markLive = mark => mark && !mark.canceledAt && (mark.starred || (mark.pause && (!mark.pause.until || mark.pause.until >= F.today)));

      /** 名单行内的标记徽章：星标与暂不跟进直接呈现；结束日已过标注已失效。 */
      const markBadges = spaceId => {
        const mark = markOf(spaceId);
        if (!mark || mark.canceledAt) return '<span class="u-t3">—</span>';
        const items = [];
        if (mark.starred) items.push(F.badge('★ 已星标', 'brand'));
        if (mark.pause) {
          const expired = mark.pause.until && mark.pause.until < F.today;
          items.push(F.badge(expired ? '暂不跟进 · 已失效' : '暂不跟进', expired ? 'neutral' : 'amber'));
        }
        return items.join('') || '<span class="u-t3">—</span>';
      };

      /** 产出状态条：产出日期、输入截止、状态、策略版本与空间范围。 */
      const statusBar = () => {
        if (!snapshot) {
          const time = state.insight.schedule.overrides?.[salesId] || state.insight.schedule.defaultTime;
          return `<section class="fp-panel fp-pad" data-insight-status="none"><div class="fp-actions"><strong>今日该跟</strong>${F.badge('尚未生成', 'brand')}</div><dl class="fp-kv u-mt2"><dt>产出日期</dt><dd>${e(F.today)}</dd><dt>产出时点</dt><dd>${e(F.today + ' ' + time)}</dd><dt>空间范围</dt><dd>本人 ${universe.length} 个可判断空间</dd></dl></section>`;
        }
        const [label, tone] = F.insightStatusMeta[snapshot.status] || ['尚未生成', 'brand'];
        return `<section class="fp-panel fp-pad" data-insight-status="${e(snapshot.status)}"><div class="fp-actions"><strong>今日该跟</strong>${F.badge(label, tone)}<span class="u-t3">当天重复打开只读这份名单，不重新计算</span></div><dl class="fp-kv u-mt2"><dt>产出日期</dt><dd>${e(snapshot.date)}</dd><dt>输入截止</dt><dd>${e(snapshot.inputCutoff || '—')}</dd><dt>策略版本</dt><dd class="mono">${e(snapshot.strategyVersion || '—')}</dd><dt>空间范围</dt><dd>本人 ${snapshot.universe.length} 个可判断空间 · 入选 ${snapshot.entries.length} 个</dd>${snapshot.status === 'failed' ? `<dt>失败原因</dt><dd>${e(snapshot.failReason || '整批未完成')}</dd>` : ''}</dl></section>`;
      };

      /** 空态三分支 + 无可判断空间；均保留客户列表入口，不展示过期名单。 */
      const emptyPanel = () => {
        let title, text;
        if (!universe.length && !snapshot) {
          title = '尚无可以判断的跟进空间';
          text = '你当前没有未冻结且有商机确权的空间；当天新确权的空间最早次日参与判断。';
        } else if (!snapshot || snapshot.status === 'pending') {
          title = '今日建议尚未生成';
          text = `产出时点（${snapshot?.scheduledAt || ''}）未到或产出未完成；不沿用昨日名单。`;
        } else if (snapshot.status === 'failed') {
          title = '生成失败';
          text = `${snapshot.failReason || '整批未完成'}；不沿用昨日名单，可联系销售运营处理。`;
        } else {
          title = '今天没有足够依据形成建议';
          text = '有可判断空间，但现有跟进与内容不足以形成结论，不凑人。';
        }
        return `<section class="fp-panel fp-pad" data-insight-empty>${F.empty(text, title)}<p class="fp-actions u-mt2"><a class="btn btn--primary" href="${F.link('customer-spaces')}">前往客户列表</a></p></section>`;
      };

      /** 名单：状态种类、一句话说明、下一步、标记与操作；失权条目隐藏入口并标注已失权。 */
      const listPanel = () => {
        const rows = snapshot.entries.map(entry => {
          const space = F.space(entry.space, state);
          const mark = markOf(entry.space);
          const canMark = !!space && space.sales === F.actor.id && space.state === 'active' && (space.opps || []).length > 0;
          const actions = space
            ? `${F.button('依据', 'evidence', entry.space)}<a class="btn" href="${F.link('followup-workbench', { space: entry.space })}">进入空间</a>${canMark ? F.button(markLive(mark) && mark.starred ? '取消星标' : '星标', 'star', entry.space) + F.button('暂不跟进', 'pause', entry.space) : ''}`
            : '<span class="fp-readonly">已失权，入口已隐藏</span>';
          return `<tr data-insight-row="${e(entry.space)}"><td><strong>${e(entry.customer)}</strong><small>${e(entry.space)}</small></td><td>${F.badge(entry.status, F.insightEntryStatusTone[entry.status] || 'neutral')}</td><td>${e(entry.summary)}</td><td>${e(entry.action)}</td><td>${markBadges(entry.space)}</td><td>${actions}</td></tr>`;
        });
        return `<section class="fp-panel"><header class="fp-panel-head"><div><h2>今日该跟名单</h2><p class="fp-hint">最多 5 个空间；星标与暂不跟进只影响次日判断，今天名单不变。</p></div><a class="btn" href="${F.link('customer-spaces')}">客户列表</a></header><div data-today-list>${F.table(['客户 / 空间', '状态', '一句话说明', '下一步', '标记', '操作'], rows, { caption: '今日该跟名单', emptyMessage: '今日名单为空。', countLabel: '个空间', note: snapshot.truncated ? `另有 ${snapshot.truncated} 个空间未入选，可从客户列表进入。` : '未入选空间不在本页出现，可从客户列表进入。' })}</div></section>`;
      };

      /** 标记记录：生效中 / 已失效（结束日已过）/ 已取消三态；生效中的可取消。 */
      const marksPanel = () => {
        const rows = marks.map(mark => {
          const space = state.spaces.find(w => w.id === mark.space);
          const expired = mark.pause && mark.pause.until && mark.pause.until < F.today;
          const status = mark.canceledAt ? ['已取消', 'neutral'] : expired ? ['已失效 · 结束日已过', 'neutral'] : ['生效中 · 已写入次日输入', 'green'];
          const type = [mark.starred ? '星标' : '', mark.pause ? '暂不跟进' : ''].filter(Boolean).join(' + ') || '—';
          const updatedAt = mark.log[0]?.at || mark.pause?.at || mark.starredAt || '';
          return `<tr data-mark-row="${e(mark.space)}"><td><strong>${e(space?.customer || mark.space)}</strong><small>${e(mark.space)}</small></td><td>${e(type)}</td><td>${e(mark.pause?.reason || '—')}</td><td>${e(mark.pause ? (mark.pause.until || '直到取消') : '—')}</td><td>${F.badge(status[0], status[1])}</td><td>${e(updatedAt)}</td><td>${markLive(mark) ? F.button('取消标记', 'mark-cancel', mark.space) : ''}</td></tr>`;
        });
        return `<section class="fp-panel"><header class="fp-panel-head"><div><h2>标记记录</h2><p class="fp-hint">标记立刻记下并写入次日判断输入；当天快照不变。</p></div></header><div data-mark-list>${F.table(['空间', '类型', '原因', '结束日', '状态', '更新时间', '操作'], rows, { caption: '我的标记记录', emptyMessage: '暂无标记：可在今日名单或客户空间内星标或暂不跟进。', countLabel: '条标记' })}</div></section>`;
      };

      root.innerHTML = statusBar() + (snapshot && snapshot.status === 'generated' ? listPanel() : emptyPanel()) + marksPanel();
    }

    F.bind(root, {
      evidence: id => openEvidence(id),
      star: id => {
        const mark = (F.load().insightMarks || []).find(item => item.space === id && item.sales === salesId && !item.canceledAt);
        F.markSpace(id, { starred: !(mark && mark.starred) });
        draw();
        SC.toast('已记录，次日判断时参考；今天名单不变。', 'ok');
      },
      pause: id => F.spaceMarkForm(id, draw),
      'mark-cancel': id => { F.markSpace(id, { cancel: true }); draw(); SC.toast('标记已取消，次日判断不再参考。', 'ok'); }
    });
    draw();
  };

  /**
   * 经营洞察编排（销售运营 / 超管）：三份提示词独立编排、按空间试跑对照、发布记录、产出时点与产出记录。
   * 保存不等于上线；试跑不写线上；上线与回退从下一自然日全员生效。
   */
  F.views['insight-ops'] = function (root) {
    const tabs = [['prompts', '提示词编排'], ['trial', '试跑对照'], ['publish', '发布记录'], ['schedule', '产出时点'], ['batches', '产出记录']];
    let tab = SC.param('tab') || 'prompts';
    if (!tabs.some(([key]) => key === tab)) tab = 'prompts';
    let lastTrial = null;
    let trialKind = 'status';
    const kindLabel = kind => F.insightKindLabels[kind] || kind;

    /** 提示词编排：三份独立面板（生效版 / 草稿 / 操作），下方修订记录留痕全部版本。 */
    function renderPrompts(target, state) {
      const prompts = state.insight.prompts;
      const cards = Object.entries(prompts).map(([kind, p]) => `<section class="fp-panel fp-pad" data-prompt="${e(kind)}">
        <header class="fp-section-head"><h3>${e(p.label)}</h3>${p.draft ? F.badge('有未上线草稿', 'amber') : F.badge('无草稿', 'neutral')}</header>
        <dl class="fp-kv"><dt>生效版</dt><dd>${p.active ? `${e(p.active.version)} · ${e(p.active.effectiveFrom)} 起生效` : '尚无生效版'}</dd><dt>生效版正文</dt><dd>${e(p.active?.body || '—')}</dd>${p.draft ? `<dt>草稿</dt><dd>${e(p.draft.version)} · ${e(F.name(p.draft.savedBy))} 保存于 ${e(p.draft.savedAt)}</dd><dt>草稿正文</dt><dd>${e(p.draft.body)}</dd>` : ''}</dl>
        <div class="fp-actions">${F.button(p.draft ? '编辑草稿' : '新建草稿', 'prompt-edit', kind)}${p.draft ? F.button('上线草稿', 'prompt-publish', kind, true) : ''}${p.history.length ? F.button('回退上一生效版', 'prompt-rollback', kind) : ''}</div>
        <p class="fp-hint">上线与回退均从下一自然日全员生效，当天已产出名单不变。</p>
      </section>`).join('');
      const rows = Object.entries(prompts).flatMap(([kind, p]) => [
        ...(p.active ? [{ kind, version: p.active.version, state: '生效中', by: p.active.publishedBy, at: p.active.publishedAt, effectiveFrom: p.active.effectiveFrom }] : []),
        ...(p.draft ? [{ kind, version: p.draft.version, state: '草稿', by: p.draft.savedBy, at: p.draft.savedAt, effectiveFrom: '—' }] : []),
        ...(p.history || []).map(item => ({ kind, version: item.version, state: '已回退', by: item.publishedBy, at: item.publishedAt, effectiveFrom: item.effectiveFrom })),
        ...(p.revisions || []).map(item => ({ kind, version: item.version, state: '被覆盖', by: item.savedBy, at: item.savedAt, effectiveFrom: '—' }))
      ]).sort((a, b) => String(b.at).localeCompare(String(a.at)));
      target.innerHTML = `<div class="fp-stack"><div class="fp-config-grid">${cards}</div><section class="fp-panel"><header class="fp-panel-head"><div><h2>修订记录</h2><p class="fp-hint">生效、草稿、历史与被覆盖的版本全部留痕；并发编辑以保存记录区分，不静默覆盖。</p></div></header><div data-prompt-revisions>${F.table(['种类', '版本', '状态', '保存人', '时间', '生效日期'], rows.map(row => `<tr><td><strong>${e(kindLabel(row.kind))}</strong></td><td class="mono">${e(row.version)}</td><td>${F.badge(row.state, row.state === '生效中' ? 'green' : row.state === '草稿' ? 'amber' : 'neutral')}</td><td>${e(F.name(row.by))}</td><td>${e(row.at)}</td><td>${e(row.effectiveFrom)}</td></tr>`), { caption: '提示词修订记录', emptyMessage: '暂无修订记录。', countLabel: '条版本记录' })}</div></section></div>`;
    }

    /** 试跑对照：按空间勾选样本（冻结空间标明），排序 / 动作需选上游来源；结果只出对照，不写线上。 */
    function renderTrial(target, state) {
      const insight = state.insight;
      const needUpstream = trialKind !== 'status';
      const formHtml = `<form class="fp-form" data-trial-form>
        <div class="fp-title"><div><h2>试跑</h2><p>勾选空间用历史真实数据试跑；只出对照，不写线上名单，不写跟进、方案、归属或标记。</p></div>${F.badge('本版不设勾选上限', 'neutral')}</div>
        ${F.field('提示词种类', 'kind', trialKind, 'select', [['status', '状态'], ['ranking', '排序'], ['action', '动作']])}
        <fieldset class="fp-checks"><legend>样本空间（按空间勾选）</legend>${state.spaces.map(w => `<label><input type="checkbox" name="spaces" value="${e(w.id)}"><span><strong>${e(w.customer)}</strong><small>${e(F.name(w.sales))} · ${e(w.id)}${w.state === 'frozen' ? ' · 已冻结，用历史内容试跑' : ''}</small></span></label>`).join('')}</fieldset>
        ${needUpstream ? F.field('上游输入来源', 'upstream', 'trial', 'select', [['trial', '同次试跑结果'], ['online', '线上最近一次']]) : '<p class="fp-hint">试状态不需要上游输入；试排序或动作时需选择上游来源。</p>'}
        <p class="fp-error" role="alert"></p>
        <div class="fp-actions"><button type="submit" class="btn btn--primary">开始试跑</button></div>
        <p class="fp-hint">未保存草稿不能试跑；试跑与线上互不影响。</p>
      </form>`;
      const resultHtml = `<section class="fp-panel"><header class="fp-panel-head"><div><h2>对照结果</h2><p class="fp-hint">${lastTrial ? `试跑 ${e(lastTrial.id)} · ${e(kindLabel(lastTrial.kind))} · 草稿 ${e(lastTrial.draftVersion)} · ${e(lastTrial.at)}` : '尚未在本次会话中试跑。'}</p></div></header><div data-trial-result>${F.table(['空间', '旧结果', '新结果', '差异'], (lastTrial?.spaces || []).map(row => `<tr data-trial-row="${e(row.space)}"><td><strong>${e(row.customer)}</strong><small>${e(row.space)}${row.frozen ? ' · 已冻结' : ''}</small></td><td>${e(row.oldResult)}</td><td>${e(row.newResult)}</td><td>${row.changed ? F.badge('有差异', 'amber') : F.badge('一致', 'green')}</td></tr>`), { caption: '试跑对照结果', emptyMessage: '尚未试跑：勾选样本空间后开始。', countLabel: '个样本空间' })}</div></section>`;
      const historyHtml = `<section class="fp-panel"><header class="fp-panel-head"><div><h2>试跑历史</h2><p class="fp-hint">记录试跑的历史时间点、空间范围与策略版本。</p></div></header><div data-trial-history>${F.table(['时间', '种类', '草稿版本', '上游来源', '空间范围', '操作人'], insight.trials.map(item => `<tr><td>${e(item.at)}</td><td><strong>${e(kindLabel(item.kind))}</strong></td><td class="mono">${e(item.draftVersion)}</td><td>${e(item.upstream === 'online' ? '线上最近一次' : item.upstream === 'trial' ? '同次试跑结果' : '—')}</td><td>${e(item.spaces.map(row => row.space).join('、'))}</td><td>${e(F.name(item.by))}</td></tr>`), { caption: '试跑历史记录', emptyMessage: '暂无试跑记录。', countLabel: '次试跑' })}</div></section>`;
      target.innerHTML = `<div class="fp-stack">${formHtml}${resultHtml}${historyHtml}</div>`;
      const form = target.querySelector('[data-trial-form]');
      form.elements.kind.onchange = event => { trialKind = event.target.value; draw(); };
      form.onsubmit = event => {
        event.preventDefault();
        try {
          const spaceIds = [...form.querySelectorAll('[name=spaces]:checked')].map(node => node.value);
          lastTrial = F.runPromptTrial(form.elements.kind.value, spaceIds, form.elements.upstream?.value || '');
          draw();
          SC.toast('试跑完成，只生成对照结果，未写线上名单。', 'ok');
        } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
      };
    }

    /** 发布记录：当前生效版本概览 + 上线 / 回退留痕（含生效日期）。 */
    function renderPublish(target, state) {
      const insight = state.insight;
      const metrics = F.metrics(Object.entries(insight.prompts).map(([, p]) => [p.label, p.active ? p.active.version : '无生效版', p.active ? `${p.active.effectiveFrom} 起生效` : '全员展示尚未生成']));
      const rows = insight.publishLog.map(log => `<tr><td>${e(log.at)}</td><td><strong>${e(kindLabel(log.kind))}</strong></td><td class="mono">${e(log.version)}</td><td>${F.badge(log.action === 'publish' ? '上线' : '回退', log.action === 'publish' ? 'green' : 'amber')}</td><td>${e(log.effectiveFrom)}</td><td>${e(F.name(log.by))}</td></tr>`);
      target.innerHTML = `<div class="fp-stack">${metrics}<div class="fp-callout">上线与回退全员同时切换，从下一自然日跑批生效；上线失败继续使用上一生效版。</div><section class="fp-panel"><header class="fp-panel-head"><div><h2>发布记录</h2><p class="fp-hint">每次上线与回退都留痕，含生效日期。</p></div></header><div data-publish-log>${F.table(['时间', '种类', '版本', '动作', '生效日期', '操作人'], rows, { caption: '提示词发布记录', emptyMessage: '暂无发布记录。', countLabel: '条发布记录' })}</div></section></div>`;
    }

    /** 产出时点：全员默认 + 按销售覆盖 + 勾选批量写入；覆盖值等于默认视为取消；次日生效。 */
    function renderSchedule(target, state) {
      const schedule = state.insight.schedule;
      const sales = state.people.filter(p => p.role === 'SLS');
      const rows = sales.map(p => {
        const override = schedule.overrides?.[p.id];
        return `<tr data-schedule-row="${e(p.id)}"><td><label class="fp-people-row"><input type="checkbox" name="sales" value="${e(p.id)}" aria-label="选择 ${e(p.name)}"><span><strong>${e(p.name)}</strong><small class="mono">${e(p.id)}</small></span></label></td><td>${override ? `${e(override)} ${F.badge('已覆盖', 'brand')}` : `${e(schedule.defaultTime)} ${F.badge('跟随默认', 'neutral')}`}</td><td>${e(schedule.updatedAt || '—')}</td><td>${override ? F.button('取消覆盖', 'schedule-clear', p.id) : ''}</td></tr>`;
      });
      target.innerHTML = `<div class="fp-stack">
        <div class="fp-callout">产出时点从下一自然日生效；当天已生成的名单不重算，新时点已过且尚未产出则当日保持尚未生成、不补跑。覆盖值等于默认时点视为取消覆盖。${schedule.updatedAt ? `最后写入 ${e(schedule.updatedAt)}（${e(F.name(schedule.updatedBy))}）。` : ''}</div>
        <form class="fp-form" data-schedule-default><div class="fp-title"><div><h2>全员默认产出时点</h2><p>未单独覆盖的销售都按此时点产出。</p></div></div>${F.field('默认时点', 'defaultTime', schedule.defaultTime, 'time')}<p class="fp-error" role="alert"></p><div class="fp-actions"><button type="submit" class="btn btn--primary">保存默认时点</button></div></form>
        <form class="fp-form" data-schedule-batch><div class="fp-title"><div><h2>按销售覆盖</h2><p>勾选多名销售，一次写入同一覆盖时点；覆盖与批量写入同一字段，后写覆盖先写。</p></div></div>${F.field('覆盖时点', 'time', schedule.defaultTime, 'time')}<p class="fp-error" role="alert"></p><div class="fp-actions"><button type="submit" class="btn btn--primary">写入选中销售</button></div></form>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>销售覆盖</h2><p class="fp-hint">勾选下表销售后批量写入。</p></div></header><div data-schedule-table>${F.table(['销售', '当前产出时点', '最后写入', '操作'], rows, { caption: '产出时点覆盖', emptyMessage: '当前没有销售账号。', countLabel: '名销售' })}</div></section>
      </div>`;
      target.querySelector('[data-schedule-default]').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        try { F.setInsightSchedule({ defaultTime: form.elements.defaultTime.value }); draw(); SC.toast('默认产出时点已保存，次日生效。', 'ok'); }
        catch (error) { form.querySelector('.fp-error').textContent = error.message; }
      };
      target.querySelector('[data-schedule-batch]').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
          const ids = [...target.querySelectorAll('[name=sales]:checked')].map(node => node.value);
          if (!ids.length) throw Error('请先勾选要覆盖的销售。');
          F.setInsightSchedule({ overrides: Object.fromEntries(ids.map(id => [id, form.elements.time.value])) });
          draw();
          SC.toast('已写入选中销售的覆盖时点，次日生效。', 'ok');
        } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
      };
    }

    /** 产出记录：按销售列出当日批次（状态 / 入选 / 截断 / 失败原因），支持查看快照与演示跑批。 */
    function renderBatches(target, state) {
      const insight = state.insight;
      const sales = state.people.filter(p => p.role === 'SLS');
      const rows = sales.map(p => {
        const snap = insight.snapshots.find(item => item.sales === p.id && item.date === F.today);
        if (!snap) return `<tr data-batch-row="${e(p.id)}"><td><strong>${e(p.name)}</strong><small class="mono">${e(p.id)}</small></td><td>${e(F.today)}</td><td>${F.badge('未产出', 'neutral')}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${F.button('演示跑批', 'batch-run', p.id)}${F.button('演示失败跑批', 'batch-run-fail', p.id)}</td></tr>`;
        const [label, tone] = F.insightStatusMeta[snap.status] || ['未知', 'neutral'];
        const actions = [snap.status === 'generated' ? F.button('查看快照', 'batch-view', p.id) : '', snap.status === 'pending' ? F.button('演示跑批', 'batch-run', p.id) + F.button('演示失败跑批', 'batch-run-fail', p.id) : ''].join('');
        return `<tr data-batch-row="${e(p.id)}" data-batch-status="${e(snap.status)}"><td><strong>${e(p.name)}</strong><small class="mono">${e(p.id)}</small></td><td>${e(snap.date)}</td><td>${F.badge(label, tone)}</td><td>${snap.entries.length}</td><td>${snap.truncated || 0}</td><td>${e(snap.inputCutoff || '—')}</td><td class="mono">${e(snap.strategyVersion || '—')}</td><td>${snap.failReason ? e(snap.failReason) : '—'}</td><td>${actions}</td></tr>`;
      });
      target.innerHTML = `<div class="fp-stack"><div class="fp-callout">每个销售每天至多一份名单；当天已产出不重算，失败不沿用昨日、不补跑。演示跑批仅对尚未产出或尚未生成的销售可用。</div><section class="fp-panel"><header class="fp-panel-head"><div><h2>产出记录</h2><p class="fp-hint">失败原因在此查看；快照只读，当天重复打开不重算。</p></div></header><div data-batch-table>${F.table(['销售', '日期', '状态', '入选', '截断', '输入截止', '策略版本', '失败原因', '操作'], rows, { caption: '今日该跟产出记录', emptyMessage: '当前没有销售账号。', countLabel: '名销售' })}</div></section></div>`;
    }

    /** 快照抽屉：运营可核对名单与三份提示词各自版本；快照只读。 */
    function openSnapshot(salesId) {
      const state = F.load();
      const snap = state.insight.snapshots.find(item => item.sales === salesId && item.date === F.today);
      if (!snap) { SC.toast('该销售当日没有快照。', 'bad'); return; }
      const versions = Object.entries(snap.promptVersions || {}).map(([kind, version]) => `${kindLabel(kind)} ${version}`).join(' · ');
      F.drawer(`当日快照 · ${F.name(salesId)}`, `<div class="fp-stack" data-snapshot-drawer>
        <dl class="fp-kv"><dt>产出日期</dt><dd>${e(snap.date)}</dd><dt>输入截止</dt><dd>${e(snap.inputCutoff || '—')}</dd><dt>策略版本</dt><dd class="mono">${e(snap.strategyVersion || '—')}${versions ? `（${e(versions)}）` : ''}</dd><dt>空间范围</dt><dd>${snap.universe.length} 个可判断空间 · 入选 ${snap.entries.length} · 截断 ${snap.truncated || 0}</dd></dl>
        ${snap.entries.length ? F.table(['空间', '状态', '一句话说明', '下一步'], snap.entries.map(entry => `<tr><td><strong>${e(entry.customer)}</strong><small>${e(entry.space)}</small></td><td>${F.badge(entry.status, F.insightEntryStatusTone[entry.status] || 'neutral')}</td><td>${e(entry.summary)}</td><td>${e(entry.action)}</td></tr>`), { caption: '当日快照名单', emptyMessage: '名单为空。', countLabel: '个空间', compact: true }) : `<div class="fp-callout">${snap.status === 'failed' ? '整批失败：' + e(snap.failReason) : '名单为空。'}</div>`}
      </div>`);
    }

    function draw() {
      const state = F.load();
      root.innerHTML = `<section class="fp-panel">${F.tabs(tabs, tab)}<div class="fp-pad" data-ops></div></section>`;
      const target = root.querySelector('[data-ops]');
      if (tab === 'prompts') renderPrompts(target, state);
      if (tab === 'trial') renderTrial(target, state);
      if (tab === 'publish') renderPublish(target, state);
      if (tab === 'schedule') renderSchedule(target, state);
      if (tab === 'batches') renderBatches(target, state);
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    }

    F.bind(root, {
      'prompt-edit': kind => {
        const prompt = F.load().insight.prompts[kind];
        if (!prompt) return;
        F.form((prompt.draft ? '编辑草稿' : '新建草稿') + ' · ' + prompt.label,
          `<div class="fp-callout">保存只是草稿，不影响线上；上线后从下一自然日全员生效。已有草稿被再次保存时，旧稿进入修订记录标「被覆盖」。</div>${F.field('提示词正文 *', 'body', prompt.draft?.body || prompt.active?.body || '', 'textarea')}`,
          values => F.savePromptDraft(kind, values.body), draw, '保存草稿');
      },
      'prompt-publish': kind => { F.publishPrompt(kind); draw(); SC.toast('已上线，下一自然日起全员生效；当天已产出名单不变。', 'ok'); },
      'prompt-rollback': kind => { F.rollbackPrompt(kind); draw(); SC.toast('已回退到上一生效版，下一自然日起全员生效。', 'ok'); },
      'schedule-clear': id => { F.setInsightSchedule({ overrides: { [id]: F.load().insight.schedule.defaultTime } }); draw(); SC.toast('已取消覆盖，改回跟随默认，次日生效。', 'ok'); },
      'batch-run': id => {
        const result = F.runInsightBatch(id);
        draw();
        SC.toast(result?.status === 'generated' ? '跑批完成，名单已生成并提醒销售。' : result?.status === 'empty' ? '跑批完成：没有足够依据，空名单。' : '跑批完成。', 'ok');
      },
      'batch-run-fail': id => { F.runInsightBatch(id, { demoFail: true }); draw(); SC.toast('演示失败跑批已记录，异常只通报运营。', 'ok'); },
      'batch-view': id => openSnapshot(id)
    });
    draw();
  };

  /* ---------- R14 晚间日报（销售 / 方案人员合集 / 运营只读） ---------- */

  /**
   * 晚间日报：按生成时快照回看当日客户变化与跨事件行为归纳。
   * 销售看今日总览 + 本人客户块；方案人员看承接客户块合集（按客户去重、无总览）；运营/超管看全量。
   * 每次打开按当前权限重新过滤客户块；全部失败日明确提示且未沿用昨日内容；无有效变化日不生成条目。
   */
  F.views['daily-report'] = function (root) {
    const date = SC.param('date') || F.today;
    // 客户块七栏固定结构；空栏目保留并显示「本时段无新增」。
    const sectionDefs = [
      ['current', '当前状态'], ['keyChanges', '今日关键变化'], ['impact', '变化影响'],
      ['pending', '待确认与待补信息'], ['behavior', '当日行为归纳'], ['collaboration', '方案协同事项'], ['sources', '依据与客户空间入口']
    ];

    /** 单栏渲染：current 为文本；sources 为依据 chips + 客户空间入口；其余为至多 3 条列表。 */
    function sectionHtml(block, key, label, state) {
      if (key === 'current') return `<section data-daily-section="current"><h3>${e(label)}</h3><p>${e(block.sections.current || '本时段无新增')}</p></section>`;
      if (key === 'sources') {
        const chips = (block.sections.sources || []).map(item => `<span class="fp-source-chip" title="${e(item.at || '')}">${e(item.label)}</span>`).join('');
        const entry = F.space(block.space, state) ? `<a class="btn" href="${F.link('followup-workbench', { space: block.space })}">进入客户空间</a>` : '<span class="fp-readonly">空间已不在当前可见范围</span>';
        return `<section data-daily-section="sources"><h3>${e(label)}</h3>${chips ? `<div class="fp-source-chips">${chips}</div>` : '<p class="u-t3">本时段无新增</p>'}<div class="u-mt2">${entry}</div></section>`;
      }
      const items = block.sections[key] || [];
      return `<section data-daily-section="${e(key)}"><h3>${e(label)}</h3>${items.length ? `<ul class="fp-compact-list">${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '<p class="u-t3">本时段无新增</p>'}</section>`;
    }

    /** 客户块卡片：头部含客户名、部分完整/已冻结 badge 与最后有效结果完成时间；七栏按固定顺序。 */
    function blockCard(block, state) {
      const badges = [
        block.status === 'partial' ? F.badge('部分完整', 'amber') : '',
        block.frozen ? F.badge(`已冻结 · ${e(block.frozenAt || '')}`, 'neutral') : ''
      ].filter(Boolean).join('');
      return `<article class="fp-panel fp-pad" data-daily-block="${e(block.space)}">
        <header class="fp-section-head"><h3>${e(block.customer)}</h3>${badges}<span class="u-t3">最后有效结果 ${e(block.lastResultAt || '—')}</span></header>
        ${block.missingNote ? `<div class="fp-callout fp-callout--warn">${e(block.missingNote)}</div>` : ''}
        ${sectionDefs.map(([key, label]) => sectionHtml(block, key, label, state)).join('')}
      </article>`;
    }

    /** 今日总览：仅 SLS/ADM/MGR 渲染；六类各 ≤3 条；不含优先级排名与下一步动作。 */
    function overviewPanel(view) {
      const cats = [['progress', '关键进展'], ['risks', '新增升级风险'], ['pending', '待确认'], ['solutionCustomers', '方案协同客户'], ['crossPatterns', '跨客户行为模式']];
      return `<section class="fp-panel" data-daily-overview><header class="fp-panel-head"><div><h2>今日总览</h2><p class="fp-hint">只汇总当天经营变化，不含优先级排名与下一步动作。</p></div>${F.badge(`有效客户 ${view.overview.effectiveCount ?? view.blocks.length}`, 'brand')}</header>
        <div class="fp-pad fp-config-grid">${cats.map(([key, label]) => `<div data-daily-overview-cat="${e(key)}"><h3>${e(label)}</h3>${(view.overview[key] || []).length ? `<ul class="fp-compact-list">${view.overview[key].slice(0, 3).map(item => `<li>${e(item)}</li>`).join('')}</ul>` : '<p class="u-t3">本时段无新增</p>'}</div>`).join('')}</div></section>`;
    }

    /** 快照口径条：报告日期、窗口、状态、输入截止、提示词版本等生成时固定信息。 */
    function statusBar(view) {
      const report = view.report;
      const [label, tone] = F.dailyReportStatusMeta[report.status] || ['未知', 'neutral'];
      return `<section class="fp-panel fp-pad" data-daily-status="${e(report.status)}"><div class="fp-actions"><strong>晚间日报 · ${e(report.reportDate)}</strong>${F.badge(label, tone)}<span class="u-t3">按生成时快照回看，不被后续重算覆盖</span></div>
        <dl class="fp-kv u-mt2"><dt>报告窗口</dt><dd>${e(report.windowStart)} → ${e(report.windowEnd)}</dd><dt>输入截止</dt><dd>${e(report.inputCutoff || '—')}</dd><dt>启动 / 完成</dt><dd>${e(report.startedAt || '—')} → ${e(report.completedAt || '—')}</dd><dt>提示词版本</dt><dd class="mono">${e(report.promptVersion || '—')}</dd></dl></section>`;
    }

    /** 未能生成的客户：部分成功或全部失败时列出；只列当前人权限内的失败客户。 */
    function failedPanel(view) {
      if (!view.failedCustomers.length) return '';
      return `<section class="fp-panel" data-daily-failed><header class="fp-panel-head"><div><h2>未能生成的客户</h2><p class="fp-hint">只列出你有权限查看的失败客户；失败不输出半成品，也不沿用昨日内容。</p></div></header>${F.table(['客户', '失败环节', '失败原因'], view.failedCustomers.map(item => `<tr><td><strong>${e(item.customer)}</strong><small>${e(item.space)}</small></td><td>${e(item.stage || '客户块生成')}</td><td>${e(item.reason || '')}</td></tr>`), { caption: '未能生成的客户', emptyMessage: '没有权限内的失败客户。', countLabel: '个客户', compact: true })}</section>`;
    }

    /** 30 天历史：固定快照回看；empty 日不出现；每次打开按当前权限重新过滤客户块数。 */
    function historyPanel(state) {
      const rows = F.dailyReportHistory(state).map(item => {
        const [label, tone] = F.dailyReportStatusMeta[item.status] || ['未知', 'neutral'];
        return `<tr data-daily-history-row="${e(item.reportDate)}"><td><strong>${e(item.reportDate)}</strong></td><td>${F.badge(label, tone)}</td><td>${item.blockCount} 个客户块${item.failedCount ? ` · ${item.failedCount} 个未生成` : ''}</td><td>${e(item.inputCutoff || '—')}</td><td class="mono">${e(item.promptVersion || '—')}</td><td><a href="${F.link('daily-report', { date: item.reportDate })}">查看</a></td></tr>`;
      });
      return `<section class="fp-panel" data-daily-history><header class="fp-panel-head"><div><h2>30 天历史</h2><p class="fp-hint">按生成时固定快照回看，每次打开按当前权限重新过滤；无有效变化的日子不生成条目。</p></div></header>${F.table(['报告日期', '状态', '客户数', '输入截止', '提示词版本', '操作'], rows, { caption: '晚间日报历史快照', emptyMessage: '暂无历史日报。', countLabel: '份日报', compact: true })}</section>`;
    }

    function draw() {
      const state = F.load();
      const view = F.dailyReportFor(date, state);
      const parts = [];
      if (!view) {
        parts.push(`<section class="fp-panel fp-pad" data-daily-empty>${F.empty('该日期没有日报快照：可能尚未生成、当日无有效变化，或已超出 30 天保留期。', '没有该日期的日报')}</section>`);
      } else {
        // 全部失败日：顶部明确提示未沿用昨日内容。
        if (view.report.status === 'failed') parts.push('<div class="fp-callout fp-callout--warn" data-daily-failed-callout>本日日报全部客户生成失败，未沿用昨日日报内容；下方列出权限内的失败客户与原因。</div>');
        parts.push(statusBar(view));
        if (view.report.status === 'empty') {
          parts.push(`<section class="fp-panel fp-pad" data-daily-empty>${F.empty('当日没有有效变化，未生成日报内容，也不发送提醒。', '无有效变化')}</section>`);
        } else {
          const effectiveCount = view.overview ? view.overview.effectiveCount : view.blocks.length;
          parts.push(F.metrics([['有效客户', effectiveCount, '当日进入日报'], ['客户块', view.blocks.length, '权限内可见'], ['未能生成', view.failedCustomers.length, '权限内失败客户'], ['接收人', (view.report.recipients || []).length, '截止时锁定并复核']]));
          if (view.overview) parts.push(overviewPanel(view));
          if (F.role === 'SOL') parts.push('<div class="fp-callout">合集只包含你承接客户的客户块（按客户去重），不含销售今日总览；部分成功时缺失范围在各块内标注。</div>');
          parts.push(view.blocks.length
            ? view.blocks.map(block => blockCard(block, state)).join('')
            : `<section class="fp-panel fp-pad" data-daily-empty>${F.empty(view.report.status === 'failed' ? '本日全部客户生成失败，没有可读客户块。' : '该日期在你当前权限内没有可查看的客户块。', '权限内无快照内容')}</section>`);
          parts.push(failedPanel(view));
        }
      }
      parts.push(historyPanel(state));
      root.innerHTML = parts.join('');
    }
    draw();
  };

  /* ---------- R17 销售目标与进度 ---------- */

  /**
   * 销售目标与进度：运营/超管三页签（进度看板 / 目标管理 / 数据状态），销售只见「我的目标」两卡。
   * 达成全部来自 DataHub 收入成本同步：取数失败保留最近成功结果并标注截止时间与原因；
   * 从未接入时看板整体替换为「暂无可用达成数据」，不显示零达成或模拟数字。
   * 目标录入与调整仅销售运营可写（超管只读），目标差异与未归属业绩只展示、不发提醒。
   */
  F.views['sales-goals'] = function (root) {
    const wan = value => (value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' 万';
    /** 金额展示：负毛利等负值红字如实展示，不按零处理。 */
    const money = value => value < 0 ? `<span style="color:var(--red-600)">${e(wan(value))}</span>` : e(wan(value));
    const pct = progress => progress === null ? '不计算进度' : (progress * 100).toFixed(1) + '%';
    const phaseBadge = phase => { const [label, tone] = F.goalPhaseMeta[phase] || [phase, 'neutral']; return F.badge(label, tone); };
    const canManage = F.canManageGoals();

    /** 数据状态提示条：failed 标注数据截止时间与失败原因；ok 给截止时间与流水口径说明。 */
    function dataNote(state) {
      const hub = state.datahub;
      if (hub.status === 'failed') return `<div class="fp-callout fp-callout--warn" data-datahub-note>数据截止 ${e(hub.lastSuccessAt || '—')} · 本次取数失败：${e(hub.failReason || '原因未知')}（已保留最近一次成功结果，不清零不伪装实时）。</div>`;
      return `<div class="fp-callout" data-datahub-note>数据截止 ${e(hub.lastSuccessAt || '—')} · 来自 DataHub 收入成本同步；流水按结算金额统计，不扣除核减金额（核减口径待确认）。</div>`;
    }

    /** 从未接入：看板整体替换，不显示零达成。 */
    function neverPanel() {
      return `<section class="fp-panel fp-pad" data-datahub-never>${F.empty('暂无可用达成数据，DataHub 接口尚未接入；达成数据到位前不显示模拟数字。', '暂无可用达成数据')}</section>`;
    }

    /** 单指标卡：目标 / 达成 / 进度条 / 缺口；零目标与未设置分别说明，未设置只输出达成。 */
    function goalCard(metricLabel, item, achievedWhenUnset) {
      if (!item) {
        return `<section class="fp-panel fp-pad" data-goal-card><header class="fp-section-head"><h3>${e(metricLabel)}目标</h3>${F.badge('未设置', 'neutral')}</header><p class="u-mt2">目标尚未设定，当前达成 <strong>${e(wan(achievedWhenUnset))}</strong>。</p><p class="fp-hint u-mt2">未录目标只展示达成；目标由销售运营录入，录入后系统自动计算。</p></section>`;
      }
      const { goal, target, achieved, progress, gap, phase, zeroTarget } = item;
      const body = zeroTarget
        ? `<p class="u-mt2">目标已设定为 0，不计算进度；当前达成 <strong>${money(achieved)}</strong>。</p>`
        : `<dl class="fp-kv u-mt2"><dt>目标</dt><dd>${e(wan(target))}</dd><dt>达成</dt><dd>${money(achieved)}</dd><dt>进度</dt><dd>${e(pct(progress))}</dd><dt>缺口</dt><dd>${e(wan(gap))}</dd></dl><div class="fp-bar u-mt2" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, progress * 100))}%"></i></div>`;
      return `<section class="fp-panel fp-pad" data-goal-card><header class="fp-section-head"><h3>${e(metricLabel)}目标</h3>${phaseBadge(phase)}</header><p class="fp-hint">目标区间 ${e(goal.start)} → ${e(goal.end)}</p>${body}</section>`;
    }

    /** 销售视图：只渲染「我的目标」区，不渲染页签；全空给空态。 */
    function renderSales() {
      const state = F.load();
      if (state.datahub.status === 'never') { root.innerHTML = neverPanel(); return; }
      const board = F.myGoalBoard(F.actor.id, state);
      if (!board.hasAny) {
        root.innerHTML = `<section class="fp-panel fp-pad" data-goal-empty>${F.empty('你名下暂无目标与达成数据；目标由销售运营录入，达成来自 DataHub 收入成本同步。', '暂无目标与达成')}</section>`;
        return;
      }
      root.innerHTML = `<div class="fp-title"><div><h2>我的目标</h2><p>${e(F.actor.name)} · 只看本人目标与进度，达成由系统按 DataHub 数据自动计算，无需手工填报。</p></div></div>`
        + dataNote(state)
        + `<div class="fp-config-grid" data-my-goals>${goalCard('流水', board.revenue, board.revenueAchieved)}${goalCard('毛利', board.profit, board.profitAchieved)}</div>`;
    }

    /** 进度看板（运营/超管）：全员两卡、目标差异提示、逐人进度表（可搜索可排序）与未归属业绩表。 */
    function renderBoard(target, state, query) {
      if (state.datahub.status === 'never') { target.innerHTML = neverPanel(); return; }
      const board = F.goalBoard(state);
      const hub = state.datahub;
      const range = F.goalBoardRange(state);
      const allAchieved = metric => board.all[metric] ? board.all[metric].achieved : (range ? board.perSales.reduce((sum, row) => sum + row[metric + 'Achieved'], 0) + board.unattributed[metric] : 0);
      const metricItems = [
        ['全员流水达成', board.all.revenue ? wan(board.all.revenue.achieved) : '未设置', board.all.revenue ? `目标 ${wan(board.all.revenue.target)} · 进度 ${pct(board.all.revenue.progress)}` : '全员流水目标未录入'],
        ['全员毛利达成', board.all.profit ? wan(board.all.profit.achieved) : '未设置', board.all.profit ? `目标 ${wan(board.all.profit.target)} · 进度 ${pct(board.all.profit.progress)}` : '全员毛利目标未录入'],
        ['未归属业绩', wan(board.unattributed.revenue), '全员达成 − 个人达成之和（流水口径）'],
        ['数据截止', hub.lastSuccessAt || '—', (F.datahubStatusMeta[hub.status] || [hub.status])[0] + ' · DataHub 收入成本同步']
      ];
      // 目标差异提示：个人目标之和与全员目标不一致时只提示差值，不自动调整。
      const diffs = ['revenue', 'profit'].filter(metric => board.targetDiff[metric] !== null && board.targetDiff[metric] !== 0)
        .map(metric => `个人${F.goalMetricLabels[metric]}目标之和与全员目标差 ${wan(board.targetDiff[metric])}`);
      const diffCallout = diffs.length ? `<div class="fp-callout fp-callout--warn" data-goal-diff>${e(diffs.join('；'))}，仅提示不自动调整。</div>` : '';

      const targetCell = item => !item ? '<span class="u-t3">未设置</span>' : item.zeroTarget ? `${e(wan(0))}（明确设零）` : e(wan(item.target));
      const achievedCell = (row, metric) => money(row[metric] ? row[metric].achieved : row[metric + 'Achieved']);
      const progressCell = item => !item ? '<span class="u-t3">—</span>' : item.zeroTarget ? '<span class="u-t3">不计算进度</span>' : e(pct(item.progress)) + (item.phase === 'active' ? '' : ' ' + phaseBadge(item.phase));
      const gapCell = item => !item || item.zeroTarget ? '<span class="u-t3">—</span>' : e(wan(item.gap));
      const perSalesTable = rows => F.table(['销售', '流水目标', '流水达成', '流水进度', '流水缺口', '毛利目标', '毛利达成', '毛利进度', '毛利缺口', '状态'], rows.map(row => `<tr data-goal-sales="${e(row.sales)}"><td><strong>${e(row.name)}</strong><small class="mono">${e(row.sales)}</small></td><td>${targetCell(row.revenue)}</td><td>${achievedCell(row, 'revenue')}</td><td>${progressCell(row.revenue)}</td><td>${gapCell(row.revenue)}</td><td>${targetCell(row.profit)}</td><td>${achievedCell(row, 'profit')}</td><td>${progressCell(row.profit)}</td><td>${gapCell(row.profit)}</td><td>${row.status === 'on' ? F.badge('启用中', 'green') : F.badge('已停用', 'neutral')}</td></tr>`), { caption: '全员逐人目标进度', emptyMessage: '没有符合条件的销售，请调整搜索或排序。', countLabel: '名销售', totalCount: board.perSales.length, note: '未设置指标只展示达成；多区间目标各自独立计算' });

      const drawRows = (q = {}) => {
        query = q; F.restoreSearch(target, q);
        const keyword = String(q.q || '').trim();
        let rows = board.perSales.filter(row => !keyword || row.name.includes(keyword) || row.sales.includes(keyword));
        if (q.sort) {
          const metric = q.sort === 'profit-desc' ? 'profit' : 'revenue';
          // 未设置与零目标没有进度，统一排在最后。
          rows = rows.slice().sort((a, b) => (b[metric]?.progress ?? -1) - (a[metric]?.progress ?? -1));
        }
        target.querySelector('[data-goal-board]').innerHTML = perSalesTable(rows);
      };

      target.innerHTML = `<div class="fp-stack">
        ${dataNote(state)}
        ${F.metrics(metricItems)}
        ${diffCallout}
        <div class="fp-config-grid">${goalCard('全员流水', board.all.revenue, allAchieved('revenue'))}${goalCard('全员毛利', board.all.profit, allAchieved('profit'))}</div>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>逐人进度</h2><p class="fp-hint">未设置指标只展示达成；零目标不计算进度；未开始 / 已结束区间单独标注。</p></div></header>
        ${F.searchbar('搜索销售姓名 / 账号', F.field('排序', 'sort', query.sort || '', 'select', [['', '默认排序'], ['revenue-desc', '流水进度从高到低'], ['profit-desc', '毛利进度从高到低']]))}
        <div data-goal-board></div></section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>未归属业绩</h2><p class="fp-hint">跟进人为空或对应不上本地账号的收入仍计入全员达成，差额在此单独列出。</p></div>${F.badge('合计 ' + wan(board.unattributed.revenue), 'amber')}</header>
        <div data-goal-unattributed>${F.table(['客户', '跟进人', '结算金额', '配对成本', '毛利', '收入结算时间', '未归属原因'], board.unattributed.rows.map(row => `<tr><td><strong>${e(row.customerName)}</strong><small class="mono">${e(row.id)}</small></td><td>${e(row.follower || '（空）')}</td><td>${e(wan(row.settledAmount))}</td><td>${e(wan(row.cost))}</td><td>${money(row.profit)}</td><td>${e(row.settledAt)}</td><td>${e(row.unattributedReason)}</td></tr>`), { caption: '未归属业绩清单', emptyMessage: '当前区间没有未归属业绩。', countLabel: '条未归属收入', note: '未归属业绩计入全员达成，不计入任何个人' })}</div></section>
      </div>`;
      drawRows(query);
      F.handleSearch(target, drawRows);
    }

    /** 目标管理（MGR 可写，ADM 只读无入口）：录入 / 调整表单、目标列表（含重叠 badge）与调整记录抽屉。 */
    function renderManage(target, state) {
      const rows = state.goals.map(goal => {
        const progress = F.goalProgress(goal, state);
        const overlaps = F.goalOverlaps(goal, state);
        const progressText = state.datahub.status === 'never' ? '<span class="u-t3">—</span>'
          : progress.zeroTarget ? '<span class="u-t3">不计算进度（目标为 0）</span>'
          : `${e(pct(progress.progress))} · 达成 ${money(progress.achieved)}`;
        return `<tr data-goal-row="${e(goal.id)}"><td><strong>${e(goal.level === 'all' ? '全员' : F.name(goal.sales))}</strong><small>${e(F.goalLevelLabels[goal.level])} · ${e(goal.id)}</small></td><td>${e(F.goalMetricLabels[goal.metric])}</td><td>${e(wan(goal.value))}</td><td>${e(goal.start)} → ${e(goal.end)}</td><td>${progressText}</td><td>${phaseBadge(progress.phase)}</td><td>${overlaps.length ? F.badge('区间重叠', 'amber') : '<span class="u-t3">—</span>'}</td><td>${canManage ? F.button('调整', 'goal-adjust', goal.id) : ''}${F.button('调整记录', 'goal-history', goal.id)}</td></tr>`;
      });
      target.innerHTML = `<div class="fp-stack">
        ${canManage ? '' : '<div class="fp-callout">目标录入与调整由销售运营负责；超管可查看全部目标与调整记录（固化口径）。</div>'}
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>目标列表</h2><p class="fp-hint">同一销售同一指标允许多个区间，各自独立计算；区间相交允许保存并标注重叠。</p></div><div class="fp-actions">${canManage ? F.button('录入目标', 'goal-new', '', true) : ''}</div></header>
        <div data-goal-list>${F.table(['归属', '指标', '目标值', '目标区间', '当前进度', '状态', '重叠', '操作'], rows, { caption: '销售目标列表', emptyMessage: '当前没有已录入的目标。', countLabel: '条目标' })}</div></section>
      </div>`;
    }

    /** 数据状态：DataHub 状态卡 + 演示按钮（ADM/MGR）、取数白名单只读表与数据异常清单。 */
    function renderDatahub(target, state) {
      const hub = state.datahub;
      const [label, tone] = F.datahubStatusMeta[hub.status] || [hub.status, 'neutral'];
      target.innerHTML = `<div class="fp-stack">
        <section class="fp-panel fp-pad" data-datahub-status="${e(hub.status)}">
          <div class="fp-actions"><strong>DataHub 收入成本同步</strong>${F.badge(label, tone)}</div>
          <dl class="fp-kv u-mt2"><dt>最近成功</dt><dd>${e(hub.lastSuccessAt || '—（从未成功取数）')}</dd><dt>最近尝试</dt><dd>${e(hub.lastAttemptAt || '—')}</dd>${hub.status === 'failed' ? `<dt>失败原因</dt><dd>${e(hub.failReason || '—')}</dd>` : ''}${hub.status === 'never' ? '<dt>说明</dt><dd>DataHub 接口尚未接入，属于上线前置未满足；不显示模拟达成。</dd>' : ''}</dl>
          <div class="fp-actions u-mt3">${F.button('手动取数（演示）', 'hub-sync', 'ok', true)}${F.button('模拟取数失败', 'hub-sync', 'fail')}${F.button('重置为未接入', 'hub-reset')}</div>
          <p class="fp-hint">取数失败保留最近一次成功结果并标注数据截止时间，同时向运营发送运营异常提醒（不推送、不打扰销售）。</p>
        </section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>取数白名单</h2><p class="fp-hint">只有白名单内字段会取回；「业绩核算」「数据阶段」取回留存、本版不参与计算。</p></div></header>
        <div data-datahub-whitelist>${F.table(['字段', '来源表', '用途', '本版计算'], hub.whitelist.map(item => `<tr><td><strong>${e(item.field)}</strong></td><td>${e(item.table)}</td><td>${e(item.purpose)}</td><td>${item.used ? F.badge('参与计算', 'green') : F.badge('取回不使用', 'neutral')}</td></tr>`), { caption: 'DataHub 取数白名单', emptyMessage: '尚未配置取数白名单。', countLabel: '个字段' })}</div></section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>数据异常</h2><p class="fp-hint">配对失败、时间缺失与重复数据单独列出，不静默显示为零；有效数据先算。</p></div></header>
        <div data-datahub-errors>${F.table(['类型', '来源行', '异常原因', '发生时间'], state.datahubErrors.map(item => `<tr><td><strong>${e(F.datahubErrorKindLabels[item.kind] || item.kind)}</strong><small class="mono">${e(item.id)}</small></td><td class="mono">${e(item.ref)}</td><td>${e(item.reason)}</td><td>${e(item.at)}</td></tr>`), { caption: 'DataHub 取数异常清单', emptyMessage: '当前没有取数异常。', countLabel: '条异常' })}</div></section>
      </div>`;
    }

    if (F.role === 'SLS') { renderSales(); return; }
    const tabs = [['board', '进度看板'], ['manage', '目标管理'], ['datahub', '数据状态']];
    let tab = SC.param('tab') || 'board';
    if (!tabs.some(([key]) => key === tab)) tab = 'board';
    let boardQuery = {};

    function draw() {
      const state = F.load();
      root.innerHTML = `<section class="fp-panel">${F.tabs(tabs, tab)}<div class="fp-pad" data-goals></div></section>`;
      const target = root.querySelector('[data-goals]');
      if (tab === 'board') renderBoard(target, state, boardQuery);
      if (tab === 'manage') renderManage(target, state);
      if (tab === 'datahub') renderDatahub(target, state);
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    }

    F.bind(root, {
      'goal-new': () => {
        const salesOptions = F.load().people.filter(person => person.role === 'SLS' && person.status === 'on').map(person => [person.id, person.name]);
        F.form('录入销售目标',
          `<div class="fp-callout">个人与全员目标独立存在；同一销售同一指标允许多个区间，重叠时只提示不拒绝。目标值单位：元。</div>`
          + F.field('目标层级', 'level', 'personal', 'select', [['personal', '个人目标'], ['all', '全员目标']])
          + F.field('指标', 'metric', 'revenue', 'select', [['revenue', '流水'], ['profit', '毛利']])
          + F.field('归属销售（个人目标必选；停用账号不再新增）', 'sales', salesOptions[0]?.[0] || '', 'select', salesOptions)
          + F.field('目标值（元）*', 'value', '', 'text')
          + F.field('开始日 *', 'start', '', 'date')
          + F.field('结束日 *', 'end', '', 'date'),
          values => F.saveGoal(values), draw, '保存目标');
      },
      'goal-adjust': id => {
        const goal = F.load().goals.find(item => item.id === id);
        if (!goal) return;
        F.form(`调整目标 · ${goal.level === 'all' ? '全员' : F.name(goal.sales)}${F.goalMetricLabels[goal.metric]}`,
          `<div class="fp-callout">调整即时生效并留痕：调整前后的值与原因都会保留，历史目标不被覆盖。</div>`
          + F.field('目标值（元）*', 'value', String(goal.value), 'text')
          + F.field('开始日 *', 'start', goal.start, 'date')
          + F.field('结束日 *', 'end', goal.end, 'date')
          + F.field('调整原因 *', 'reason', '', 'textarea'),
          values => F.adjustGoal(id, values), draw, '保存调整');
      },
      'goal-history': id => {
        const goal = F.load().goals.find(item => item.id === id);
        if (!goal) return;
        const items = (goal.adjustments || []).map(record => `<article class="fp-event"><h3>${e(wan(record.before?.value ?? 0))} → ${e(wan(record.after?.value ?? 0))}</h3><p>${e(record.reason || '未填写原因')}</p><small>${e(record.at)} · ${e(F.name(record.actor))} · 区间 ${e(record.before?.start || '')} → ${e(record.before?.end || '')} 调整为 ${e(record.after?.start || '')} → ${e(record.after?.end || '')}</small></article>`).join('');
        F.drawer(`调整记录 · ${goal.id}`, `<div class="fp-stack" data-goal-history><div class="fp-callout">当前目标值 ${e(wan(goal.value))}（${e(goal.start)} → ${e(goal.end)}）；每次调整留痕，历史不被覆盖，可回看任一时点的目标。</div>${items ? `<div class="fp-timeline">${items}</div>` : F.empty('该目标尚无调整记录。', '暂无调整记录')}</div>`);
      },
      'hub-sync': mode => { F.runDatahubSync(mode); draw(); SC.toast(mode === 'fail' ? '已模拟取数失败：保留最近成功结果并提醒运营。' : '手动取数完成，数据截止时间已更新。', 'ok'); },
      'hub-reset': () => { F.resetDatahub(); draw(); SC.toast('已重置为未接入状态，看板不再显示达成数字。', 'ok'); }
    });
    draw();
  };
})(window.SC, window.SC.FEATURES);
