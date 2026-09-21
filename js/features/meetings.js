/**
 * R10 录音管理：三方录音服务是唯一来源，本版不提供手动上传，也不做应用内录制。
 * 页面契约（回归测试依赖）：data-recording-row 录音行、data-recording-state 归位情况、
 * data-sync-status 同步状态、data-placement-row 归位记录、data-placement-status 处理状态、
 * data-behavior-status 行为记录状态、data-unresolved 归属待处理清单。
 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  // 旧链接与旧快照仍可能带解析流水线状态，这里只保留一份可读标签兜底。
  F.meetingLabels = { synced: '已同步', failed: '同步失败', ready: '转写可用', waiting: '等待转写' };

  F.views['meeting-center'] = function (root) {
    let query = {};

    /** 一份录音的处理结果由它的每条归位各自决定，不合成一个总状态。 */
    function placementSummary(recording, state) {
      const placements = F.recordingPlacements(recording.id, state);
      if (!placements.length) return '<span class="u-t3">尚未归位</span>';
      return `<ul class="fp-compact-list" data-placement-summary>${placements.map(item => {
        const space = state.spaces.find(w => w.id === item.space);
        const opp = space?.opps?.find(o => o.id === item.opportunityId);
        const meta = F.placementStatusMeta[item.status] || ['处理中', 'brand'];
        return `<li data-placement-of="${e(item.id)}">${e(space ? space.customer : item.space)} · ${e(opp ? opp.name : item.opportunityId || '商机待补')} ${F.badge(meta[0], meta[1])}</li>`;
      }).join('')}</ul>`;
    }

    function draw() {
      const state = F.load();
      const records = F.recordings(state);
      const unplaced = records.filter(item => F.recordingState(item, state) === 'unplaced' && item.syncStatus === 'synced');
      const waiting = records.filter(item => F.recordingPlacements(item.id, state).some(p => p.status === 'waiting_transcript'));
      const failedSync = records.filter(item => item.syncStatus === 'failed');
      const failedUpdate = records.filter(item => F.recordingPlacements(item.id, state).some(p => p.status === 'failed'));
      const unresolved = F.unresolvedRecordings(state);
      const opsView = ['ADM', 'MGR'].includes(F.role);
      root.innerHTML = F.metrics([
        ['录音总数', records.length, F.role === 'SLS' ? '归属本人的全部录音' : '当前可见范围内'],
        ['未归位', unplaced.length, '待选择客户空间与商机'],
        ['等待转写', waiting.length, '已归位，客户信息尚未开始更新'],
        ['同步失败', failedSync.length, '可重新同步，不影响其余录音'],
        ['更新未完成', failedUpdate.length, '原内容保留，可按归位重试']
      ])
        + '<div class="fp-callout" data-recording-source>录音由三方录音服务按其节奏同步进来，是本版唯一来源：不提供手动上传，也不做应用内录制；删除只在三方服务侧进行。归位成功不等于客户信息已更新。</div>'
        + F.panel('录音列表', F.searchbar('搜索录音名称 / 客户',
          F.field('归位情况', 'state', '', 'select', [['', '全部归位情况'], ...Object.entries(F.recordingStateMeta).map(([key, meta]) => [key, meta[0]])])
          + F.field('同步状态', 'sync', '', 'select', [['', '全部同步状态'], ['synced', '已同步'], ['failed', '同步失败']]))
          + '<div data-results></div>', F.role === 'SLS' ? F.badge('同步来源：三方录音服务', 'neutral') : F.badge('全量只读', 'neutral'))
        + (opsView ? F.panel('归属待处理（运营排查）', `<div class="fp-pad"><p class="fp-hint">同步成功但缺少归属销售标识的录音不进入任何人的录音管理，保留在这里等待排查，不静默丢弃。</p></div>`
          + F.table(['录音', '录音时间', '时长', '同步情况', '待处理原因'], unresolved.map(item => `<tr data-unresolved="${e(item.id)}"><td><strong>${e(item.title)}</strong><small>${e(item.id)}</small></td><td>${e(item.date)}</td><td class="mono">${e(item.duration)}</td><td>${F.badge('已同步', 'green')}</td><td>${e(item.syncReason || '三方服务未返回可识别的归属销售标识。')}</td></tr>`),
            { caption: '归属待处理录音清单', emptyMessage: '当前没有归属待处理的录音。', countLabel: '条待处理录音', compact: true })) : '');
      filter(query);
      F.handleSearch(root, filter);
    }

    function filter(q = {}) {
      query = q;
      F.restoreSearch(root, q);
      const state = F.load();
      const keyword = String(q.q || '').trim();
      const rows = F.recordings(state).filter(item => {
        const placements = F.recordingPlacements(item.id, state);
        const customers = placements.map(p => state.spaces.find(w => w.id === p.space)?.customer || '').join(' ');
        if (keyword && !(item.title + ' ' + customers).includes(keyword)) return false;
        if (q.state && F.recordingState(item, state) !== q.state) return false;
        if (q.sync && item.syncStatus !== q.sync) return false;
        return true;
      });
      root.querySelector('[data-results]').innerHTML = F.table(
        ['录音', '归属销售', '时长', '录音时间', '同步状态', '转写', '已归位位置', '操作'],
        rows.map(item => {
          const stateKey = F.recordingState(item, state);
          const stateMeta = F.recordingStateMeta[stateKey];
          const syncMeta = F.recordingSyncMeta[item.syncStatus] || ['已同步', 'green'];
          const transMeta = F.transcriptMeta[item.transcriptStatus] || ['等待转写', 'brand'];
          const canRetrySync = item.syncStatus === 'failed' && (F.role === 'ADM' || (F.role === 'SLS' && item.owner === F.actor?.id));
          return `<tr data-recording-row="${e(item.id)}" data-recording-state="${e(stateKey)}" data-sync-status="${e(item.syncStatus)}">
            <td><a href="${F.link('meeting-center', { meeting: item.id })}" data-action="open" data-value="${e(item.id)}">${e(item.title)}</a><small>${e(item.id)} · ${e(item.source)}</small></td>
            <td>${e(F.name(item.owner))}</td><td class="mono">${e(item.duration)}</td><td>${e(item.date)}</td>
            <td>${F.badge(syncMeta[0], syncMeta[1])}${item.syncReason ? `<small>${e(item.syncReason)}</small>` : ''}</td>
            <td>${F.badge(transMeta[0], transMeta[1])}<small>最近检查 ${e(item.transcriptCheckedAt || '—')}</small></td>
            <td>${F.badge(stateMeta[0], stateMeta[1])}${placementSummary(item, state)}</td>
            <td>${F.button('查看详情', 'open', item.id)}${canRetrySync ? F.button('重新同步', 'resync', item.id) : ''}</td></tr>`;
        }),
        { caption: '录音同步与归位列表', emptyMessage: '没有符合条件的录音；录音由三方服务同步进来后会出现在这里。', countLabel: '条录音', note: '同步、转写与归位处理分开记录', totalCount: F.recordings(state).length }
      );
    }

    /** 归位表单：空间下多条商机必须销售指定，仅一条时自动带出并允许修改。 */
    function openPlaceForm(recordingId, done) {
      const state = F.load();
      const recording = F.recording(recordingId, state);
      const placed = F.recordingPlacements(recordingId, state).map(item => item.space);
      const targets = F.visible(state).filter(w => F.canWrite(w) && (w.opps || []).length && !placed.includes(w.id));
      if (!targets.length) {
        F.drawer('归位 · ' + (recording ? recording.title : recordingId), `<div class="fp-stack"><div class="fp-callout fp-callout--warn" data-place-blocked>当前没有可归位的客户空间。归位必须锚定商机：冻结空间、仅客户级确权（无商机）的空间和已归位过的空间都不在可选范围内。</div></div>`);
        return;
      }
      const oppOptions = space => (space.opps || []).map(o => [o.id, `${o.name}（${o.id}）`]);
      const first = targets[0];
      const form = F.form('归位录音 · ' + (recording ? recording.title : recordingId),
        `<div class="fp-callout">一条归位锚定一个客户空间和一条商机。同一份录音可以分别归位到多个空间，文件共用不切分，各条归位互不影响。</div>`
        + F.field('客户空间 *', 'space', first.id, 'select', targets.map(w => [w.id, `${w.customer} · ${w.pool || '待补客户池'}`]))
        + F.field('关联商机 *', 'opportunityId', first.opps.length === 1 ? first.opps[0].id : '', 'select', first.opps.length === 1 ? oppOptions(first) : [['', '请选择该空间下的一条商机'], ...oppOptions(first)])
        + `<p class="fp-hint" data-opp-hint>${first.opps.length > 1 ? '该空间下有多条商机，必须由你指定一条，系统不代选。' : '该空间下仅一条商机，已自动带出，可以修改。'}</p>`
        + (recording && recording.transcriptStatus !== 'ready' ? '<p class="fp-hint" data-transcript-hint>该录音转写尚未可用：可以先归位，客户信息更新会等转写可用后自动开始。</p>' : ''),
        values => { F.placeRecording(recordingId, values); },
        done, '确认归位',
      );
      // 切换空间后重新给出该空间的商机，并保持「多商机不代选」的口径。
      const mask = form.root;
      const spaceSelect = mask.querySelector('[name=space]');
      if (spaceSelect) spaceSelect.onchange = () => {
        const target = targets.find(w => w.id === spaceSelect.value);
        const oppSelect = mask.querySelector('[name=opportunityId]');
        const hint = mask.querySelector('[data-opp-hint]');
        const single = target.opps.length === 1;
        oppSelect.innerHTML = (single ? oppOptions(target) : [['', '请选择该空间下的一条商机'], ...oppOptions(target)])
          .map(([value, label]) => `<option value="${e(value)}">${e(label)}</option>`).join('');
        oppSelect.value = single ? target.opps[0].id : '';
        if (hint) hint.textContent = single ? '该空间下仅一条商机，已自动带出，可以修改。' : '该空间下有多条商机，必须由你指定一条，系统不代选。';
      };
    }

    /** 录音详情：归位关系、每条归位的独立结果与转写原文；行为记录与客户信息分开展示。 */
    function open(id) {
      const state = F.load();
      const recording = F.recording(id, state);
      if (!recording || (recording.ownerResolved === false && !['ADM', 'MGR'].includes(F.role))) { SC.toast('当前无权访问该录音', 'bad'); return; }
      let stage = 'placements';
      F.drawer(recording.title, '', (mask, close) => {
        const body = mask.querySelector('.fp-drawer-body');
        function content() {
          const current = F.load();
          const item = F.recording(id, current) || recording;
          const syncMeta = F.recordingSyncMeta[item.syncStatus] || ['已同步', 'green'];
          const transMeta = F.transcriptMeta[item.transcriptStatus] || ['等待转写', 'brand'];
          const placements = F.recordingPlacements(id, current, true);
          const canPlace = F.role === 'SLS' && item.owner === F.actor?.id && item.syncStatus === 'synced';
          body.innerHTML = `<div class="fp-actions u-mb4">${F.badge(syncMeta[0], syncMeta[1])}${F.badge(transMeta[0], transMeta[1])}<span class="u-t2">${e(item.duration)} · ${e(item.date)} · ${e(item.ownerResolved === false ? '归属待处理' : F.name(item.owner))}</span></div>`
            + (item.syncStatus === 'failed' ? `<div class="fp-callout fp-callout--warn" data-sync-failure><strong>同步失败：</strong>${e(item.syncReason)}${F.role === 'ADM' || item.owner === F.actor?.id ? `<span class="fp-actions u-mt2">${F.button('重新同步', 'resync', item.id, true)}</span>` : ''}</div>` : '')
            + F.tabs([['placements', '归位与处理结果'], ['transcript', '转写原文']], stage)
            + '<div class="fp-pad" data-stage></div>';
          const target = body.querySelector('[data-stage]');
          if (stage === 'transcript') {
            target.innerHTML = item.transcriptStatus === 'ready'
              ? `<p class="fp-hint u-mb4">转写可用 · 最近检查 ${e(item.transcriptCheckedAt || '—')}</p><pre class="fp-transcript" data-transcript-body>${e(item.transcript || item.summary || '转写正文为空。')}</pre>`
              : `<div class="fp-callout" data-transcript-waiting>转写尚未可用，最近检查时间 ${e(item.transcriptCheckedAt || '—')}。系统不承诺固定时长，也不会用摘要冒充原文（超时处置见 M05-2 §7.9）。${canPlace && item.transcriptStatus !== 'ready' ? `<span class="fp-actions u-mt2">${F.button('演示转写完成', 'transcribe', item.id, true)}</span>` : ''}</div>`;
          } else {
            target.innerHTML = `<div class="fp-stack">${canPlace ? `<div class="fp-actions">${F.button('归位到客户空间', 'place', item.id, true)}<span class="u-t3">同一份录音可分别归位到多个空间，各条互不影响。</span></div>` : '<p class="fp-readonly">归位、取消归位与重新归位均由归属销售本人操作。</p>'}
              ${placements.length ? placements.map(placement => {
                const space = current.spaces.find(w => w.id === placement.space);
                const opp = space?.opps?.find(o => o.id === placement.opportunityId);
                const meta = F.placementStatusMeta[placement.status] || ['处理中', 'brand'];
                const behavior = F.placementBehavior(placement.id, current);
                const behaviorMeta = behavior ? F.behaviorStatusMeta[behavior.status] : null;
                const visible = !!F.space(placement.space, current);
                const canCancel = placement.status !== 'canceled' && F.role === 'SLS' && placement.by === F.actor?.id && space?.state === 'active';
                const canRetry = placement.status === 'failed' && (['ADM', 'MGR'].includes(F.role) || placement.by === F.actor?.id) && space?.state === 'active';
                return `<article class="fp-event" data-placement-row="${e(placement.id)}" data-placement-status="${e(placement.status)}">
                  <div class="fp-actions"><strong>${e(space ? space.customer : placement.space)}</strong>${F.badge(meta[0], meta[1])}${placement.status === 'canceled' ? F.badge('留痕保留', 'neutral') : ''}</div>
                  <dl class="fp-kv"><dt>关联商机</dt><dd>${e(opp ? `${opp.name}（${opp.id}）` : placement.opportunityId || '—')}</dd><dt>归位人 / 时间</dt><dd>${e(F.name(placement.by))} · ${e(placement.at)}</dd>${placement.completedAt ? `<dt>完成时间</dt><dd>${e(placement.completedAt)}</dd>` : ''}${placement.canceledAt ? `<dt>取消时间</dt><dd>${e(placement.canceledAt)}</dd>` : ''}</dl>
                  ${placement.status === 'waiting_transcript' ? `<p>${e(placement.failReason || '已归位，等待转写可用后自动开始客户信息更新；归位成功不等于客户信息已更新。')}</p>` : ''}
                  ${placement.status === 'failed' ? `<div class="fp-callout fp-callout--warn">${e(placement.failReason)}原录音与已有客户信息仍可查看；该异常只提醒运营，不向销售推送技术故障。</div>` : ''}
                  ${placement.status === 'nochange' ? '<p>处理完成，本次未发现客户信息变化；未发送完成提醒。</p>' : ''}
                  ${placement.status === 'canceled' ? '<p>该条归位已取消，录音本身与其他归位不受影响；取消前已生成的结果按原归位保留，不回写到其他归位。</p>' : ''}
                  <div class="fp-actions u-mt2" data-behavior-status="${e(behavior ? behavior.status : 'none')}">${behavior ? F.badge('行为记录 · ' + behaviorMeta[0], behaviorMeta[1]) : F.badge('行为记录 · 未生成', 'neutral')}${behavior && behavior.status === 'failed' ? `<small>${e(behavior.failReason)}</small>` : ''}</div>
                  <div class="fp-actions u-mt2">${placement.changeId && visible ? `<a class="btn" href="${F.link('followup-workbench', { space: placement.space, tab: 'overview', change: placement.changeId })}">查看本次变化</a>` : ''}${visible ? `<a class="btn" href="${F.link('followup-workbench', { space: placement.space, tab: 'followup', sub: 'recordings' })}">进入客户空间</a>` : '<span class="u-t3">该空间不在当前可见范围。</span>'}${canRetry ? F.button('重试更新', 'retry-update', placement.id) : ''}${canCancel ? F.button('取消归位', 'cancel', placement.id) : ''}</div>
                </article>`;
              }).join('') : '<div class="fp-callout" data-placement-empty>该录音尚未归位。选择客户空间与商机后建立第一条归位；归位必须锚定商机。</div>'}
            </div>`;
          }
          body.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { stage = button.dataset.tab; content(); });
        }
        F.bind(body, {
          place: recordingId => openPlaceForm(recordingId, () => { content(); draw(); }),
          cancel: placementId => { try { F.cancelPlacement(placementId); content(); draw(); SC.toast('已取消该条归位，录音与其他归位不受影响。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } },
          'retry-update': placementId => { try { F.retryPlacementUpdate(placementId); content(); draw(); SC.toast('已重试该条归位的客户信息更新。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } },
          resync: recordingId => { try { F.retryRecordingSync(recordingId); content(); draw(); SC.toast('已重新同步；转写可用后可继续归位。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } },
          transcribe: recordingId => { try { F.markTranscriptReady(recordingId); content(); draw(); SC.toast('转写已可用，等待中的归位开始更新客户信息。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } }
        });
        content();
      });
    }

    // 链接仍提供可分享 URL，普通点击以抽屉承接，保留列表筛选上下文。
    root.addEventListener('click', event => { if (event.target.closest('a[data-action=open]')) event.preventDefault(); });
    F.bind(root, {
      open,
      resync: id => { try { F.retryRecordingSync(id); draw(); SC.toast('已重新同步；转写可用后可继续归位。', 'ok'); } catch (error) { SC.toast(error.message, 'bad'); } }
    });
    draw();
    if (SC.param('meeting')) open(SC.param('meeting'));
  };
})(window.SC, window.SC.FEATURES);
