/** 运营配置及产品知识库：承载模型、R01 CRM 归属同步、触达、OpenClaw 页的工作区，使用本地演示状态。 */
(function (SC, F) {
  'use strict';
  const e = F.e;
  F.views['operations-config'] = function (root) {
    // 客户等级页已下线：等级说明不再由运营维护，客户等级只作为 CRM 同步来的只读字段在各客户视图展示。
    const options = [...(F.role === 'ADM' ? [['people', '人员管理']] : []), ['model', '模型配置'], ['crm', '销帮帮集成'], ['notify', '消息触达'], ['daily', '晚间日报'], ['openclaw', 'OpenClaw'], ...(F.role === 'ADM' ? [['pools', '承接池配置']] : [])];
    let tab = SC.param('tab') || 'model';
    if (!options.some(([key]) => key === tab)) tab = 'model';
    let crmView = SC.param('crmView') || 'overview';
    let mapQuery = {};
    let notifyView = SC.param('notifyView') || 'events';
    let dailyView = SC.param('dailyView') || 'runs';
    let notifyQuery = {};
    let peopleQuery = {};
    let peoplePage = 1;
    const peoplePageSize = 8;
    const selectedPeople = new Set();

    const roleLabel = role => F.roles[role] || '待分配角色';
    const roleTone = role => role === 'ADM' ? 'brand' : role === 'SLS' ? 'green' : 'neutral';
    const statusLabel = status => status === 'on' ? '启用中' : '已停用';
    const statusTone = status => status === 'on' ? 'green' : 'neutral';

    const crmViews = [['overview', '同步概览'], ['pending', '待对应人员'], ['unassigned', '未分配商机'], ['errors', '对齐异常'], ['history', '归属历史']];
    if (!crmViews.some(([key]) => key === crmView)) crmView = 'overview';
    const changeLabels = { added: '新增确权', removed: '移除确权', restored: '恢复确权', unchanged: '无变化', pending: '待对应' };
    const changeTones = { added: 'green', removed: 'neutral', restored: 'brand', unchanged: 'neutral', pending: 'amber' };
    const crmStatusLabel = status => ({ completed: '已完成', running: '对齐中', failed: '失败', resolved: '已恢复', retrying: '重试中' }[status] || status || '待处理');

    /**
     * CRM 分面导航：页签在左，页级动作在右。
     * 立即对齐 / 查看本轮批次 / 查看连接配置属于整页动作，不能单独占一行压在指标卡上方；
     * 归属历史已是分面页签，不再重复成按钮。存量切换是上线一次性作业，不提供运营分面。
     */
    function crmToolbar() {
      return `<div class="fp-actions fp-crm-toolbar" data-crm-toolbar>${F.role === 'ADM' ? F.button('立即对齐', 'crm-sync', '', true) : ''}${F.button('查看本轮批次', 'crm-batch')}${F.button('查看连接配置', 'xbb-open')}</div>`;
    }

    function crmSubnav() {
      return `<div class="fp-crm-nav"><nav class="fp-tabs fp-crm-tabs" aria-label="CRM 归属同步分面">${crmViews.map(([key, label]) => `<button type="button" data-action="crm-view" data-value="${key}" class="${crmView === key ? 'is-active' : ''}" aria-pressed="${crmView === key}">${label}</button>`).join('')}</nav>${crmToolbar()}</div>`;
    }

    function crmMetrics(crm) {
      const metric = (key, label, value, detail) => `<div class="fp-metric" data-crm-metric="${key}"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail || '')}</small></div>`;
      return `<div class="fp-metrics fp-crm-metrics">${metric('last-sync', '最近同步', crm.lastSyncAt || '暂无', `${crm.trigger || '定时'} · ${crm.currentBatchId || '未生成批次'}`)}${metric('processed', '处理对象', crm.processed || 0, '条 CRM 事实')}${metric('added', '新增 / 恢复', `${crm.added || 0} / ${crm.restored || 0}`, '确权变化')}${metric('removed', '移除确权', crm.removed || 0, '后续新增资格收回')}${metric('retry-next', '下一轮重试', crm.nextRetryAt || '暂无', `${crm.failed || 0} 条异常待处理`)}</div>`;
    }

    /* ---------- R01 CRM 归属同步 ---------- */
    /** 配置项来源标签：区分数据库配置、环境变量、默认值与 R01 固定口径。 */
    const xbbSourceLabels = { database: ['数据库配置', 'brand'], env: ['环境变量', 'neutral'], default: ['默认值', 'neutral'], fixed: ['R01 固定口径', 'neutral'] };
    /** 对应方式标签：自动匹配、人工指定、待对应。 */
    const mappingModeLabels = { auto: ['自动匹配', 'green'], manual: ['人工指定', 'brand'], none: ['待对应', 'amber'] };

    /** 必填项缺口：连接配置抽屉提示使用同一口径。 */
    function xbbMissing(xbb = {}) {
      return [['接口地址', xbb.baseUrl], ['企业 Corp ID', xbb.corpId], ['操作人 User ID', xbb.userId], ['接口 Token', xbb.tokenMasked]]
        .filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
    }

    /** 连通性检查结果块：抽屉内触发检查后就地刷新，不关闭抽屉。 */
    function xbbCheckBlock(xbb = {}) {
      const check = xbb.lastCheck || {};
      const ok = check.status === 'ok';
      return `<strong>${ok ? '连通性正常' : '连通性待确认'}</strong>
        <small>${e(check.at || '尚未检查')} · 耗时 ${e(check.latencyMs || 0)} ms · ${e(check.detail || '尚未发起检查')}</small>
        <small>最近修改 ${e(xbb.updatedAt || '—')}${xbb.updatedBy ? ' · ' + e(F.name(xbb.updatedBy)) : ''}</small>`;
    }

    /** 抽屉内的配置字段：标签右侧直接标注该值当前来自哪里。 */
    function xbbField(label, name, value, sourceKey, type = 'text', readonly = false) {
      const [text, tone] = xbbSourceLabels[sourceKey] || xbbSourceLabels.default;
      return `<label class="fp-field fp-xbb-field"><span>${e(label)}${F.badge(text, tone)}</span><input type="${e(type)}" name="${e(name)}" value="${e(value)}"${readonly ? ' readonly' : ''}></label>`;
    }

    /**
     * 销帮帮连接配置抽屉：看到＝当前值与每项取值来源；get 到＝缺哪几项必填、缺项会怎样；
     * 操作＝改值保存、检查连通性。销售运营只读，可查看并检查连通性。
     * 概览不再保留连接状态条，「查看连接配置」放在页签行「查看本轮批次」之后。
     */
    function openXbbDrawer() {
      const xbb = F.load().xbb || {};
      const missing = xbbMissing(xbb);
      const editable = F.role === 'ADM';
      const fields = [
        ['接口地址 *', 'baseUrl', xbb.baseUrl, xbb.sources?.baseUrl, 'text'],
        ['企业 Corp ID *', 'corpId', xbb.corpId, xbb.sources?.corpId, 'text'],
        ['操作人 User ID *', 'userId', xbb.userId, xbb.sources?.userId, 'text'],
        ['接口 Token', 'tokenMasked', xbb.tokenMasked, xbb.sources?.token, 'text'],
        ['SaaS Mark', 'saasMark', xbb.saasMark, xbb.sources?.saasMark, 'number'],
        ['请求超时（秒）', 'timeoutSeconds', xbb.timeoutSeconds, xbb.sources?.timeoutSeconds, 'number'],
        ['分页大小（条/页）', 'listPageSize', xbb.listPageSize, xbb.sources?.listPageSize, 'number'],
        ['重试次数', 'retryCount', xbb.retryCount, xbb.sources?.retryCount, 'number'],
        ['重试退避（秒）', 'retryBackoffSeconds', xbb.retryBackoffSeconds, xbb.sources?.retryBackoffSeconds, 'number'],
        ['同步周期（分钟）', 'intervalMinutes', xbb.intervalMinutes, xbb.sources?.intervalMinutes, 'text']
      ];
      F.drawer('销帮帮连接配置', `<form class="fp-form" data-xbb-config>
        ${missing.length
          ? `<div class="fp-callout fp-callout--warn" data-xbb-missing><strong>缺少必填配置：</strong>${e(missing.join('、'))}。补齐后下一轮同步才会启动，期间保留已有确权。</div>`
          : '<div class="fp-callout" data-xbb-ready><strong>必填项完整：</strong>接口地址、Corp ID、User ID 与 Token 均已配置，下一轮同步按当前配置读取事实。</div>'}
        ${editable ? '' : '<div class="fp-callout">当前身份只读：配置修改仅超级管理员可提交，销售运营可查看并检查连通性。</div>'}
        <div class="fp-config-grid">${fields.map(([label, name, value, source, type]) => xbbField(label, name, value, source, type, !editable || name === 'intervalMinutes')).join('')}</div>
        <div class="fp-xbb-check" data-xbb-check>${xbbCheckBlock(xbb)}</div>
        <p class="fp-hint">接口 Token 只保存脱敏值，明文由服务端管理；保存后从下一轮同步开始使用新配置，本轮已生成的确权不变。同步周期按 R01 固定 5 分钟，不提供调整。</p>
        <p class="fp-error" role="alert"></p>
        <footer class="fp-form-foot"><span class="u-t3">本地演示数据</span><div class="fp-actions">${['ADM', 'MGR'].includes(F.role) ? '<button type="button" class="btn" data-xbb-check-action>检查连通性</button>' : ''}${editable ? '<button type="submit" class="btn btn--primary">保存配置</button>' : ''}</div></footer>
      </form>`, (mask, close) => {
        mask.querySelector('[data-xbb-check-action]')?.addEventListener('click', () => runXbbCheck(mask));
        const form = mask.querySelector('form');
        form.onsubmit = event => {
          event.preventDefault();
          try {
            F.saveXbbConfig(Object.fromEntries(new FormData(form)));
            close(); draw();
            SC.toast('连接配置已保存，下一轮同步起生效。', 'ok');
          } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
        };
      });
    }

    /** 检查连通性：只在抽屉内触发，就地刷新检查结果，不关闭抽屉，也不发起真实外网请求。 */
    function runXbbCheck(mask) {
      const result = F.checkXbbConnection();
      if (mask?.isConnected) mask.querySelector('[data-xbb-check]').innerHTML = xbbCheckBlock(F.load().xbb);
      SC.toast(result.status === 'ok' ? `连通性正常，耗时 ${result.latencyMs} ms。` : result.detail, result.status === 'ok' ? 'ok' : 'bad');
    }

    /**
     * R01 人员与系统账号对应：按「看到 → get 到 → 操作」三层组织。
     * 看到＝对应总览与一行一人一状态；get 到＝未对应原因、推荐账号与涉及客户/商机；
     * 操作＝行内采用推荐 / 设置对应 / 更换对应，抽屉内先看影响再提交。
     * 对应关系是待对应人员的处理底账，因此整块只挂在「待对应人员」分面，同步概览只保留本轮同步结果。
     */
    function buildMappingRows(state, query = {}) {
      const crm = state.crm || {};
      const all = (crm.mappings || []).map(row => {
        const pending = (crm.pendingMappings || []).find(item => item.id === row.pendingId && item.status === 'pending');
        const ownerId = pending ? '' : row.ownerId;
        return { ...row, pending: pending || null, ownerId, status: ownerId ? 'matched' : 'pending' };
      });
      const matched = all.filter(row => row.status === 'matched').length;
      const pendingCount = all.length - matched;
      const autoCount = all.filter(row => row.status === 'matched' && row.mode === 'auto').length;
      const manualCount = all.filter(row => row.status === 'matched' && row.mode === 'manual').length;
      const keyword = String(query.q || '').trim().toLocaleLowerCase('zh-CN');
      const statusFilter = query.mapStatus || '';
      /** 操作列的深蓝文字动作：去按钮化后靠字重与颜色区分主次，动作分发仍走 data-action。 */
      // 主次修饰类用 is-main：is-primary 被表格首列占用（.fp-data-table .is-primary 带 min-width:150px），复用会把文字动作撑成 150px 宽。
      const linkAction = (label, action, value, primary = false) => `<a class="fp-link-action${primary ? ' is-main' : ''}" href="#" data-action="${e(action)}" data-value="${e(value)}">${e(label)}</a>`;
      /**
       * 「详情」是展开控件：静态 aria-label 自带行上下文，展开态用 aria-expanded 表达，
       * 避免与 F.table 写入的行上下文标签互相覆盖（data-static-label 让表格构建器跳过该控件）。
       */
      const detailAction = (crmId, name) => `<a class="fp-link-action" href="#" data-action="crm-map-detail" data-value="${e(crmId)}" data-static-label="true" data-crm-name="${e(name)}" aria-expanded="false" aria-label="详情：${e(name)}">详情</a>`;

      // 主行只保留推荐账号本身：推荐依据全文放 title 与详情行，避免半截截断的文案反而看不懂。
      const seed = all.map((row, index) => {
        const owner = row.ownerId ? F.person(row.ownerId) : null;
        const candidate = row.status === 'pending' && row.suggestOwnerId ? F.person(row.suggestOwnerId) : null;
        const pendingContext = row.pending || {};
        const basis = row.suggestBasis || '姓名一致';

        const accountCell = owner
          ? `<strong>${e(owner.name)}</strong><small>${e(owner.id)} · ${e(roleLabel(owner.role))} · ${e(statusLabel(owner.status))}</small>` // 账号列内容越短，浏览器越会把富余宽度分给「涉及客户 · 商机」列
          : `<span class="fp-map-empty">未对应</span><small class="fp-map-reason">${e(row.failReason || 'CRM 人员尚未与系统账号对应')}</small>` +
            (candidate ? `<small class="fp-map-candidate" data-crm-map-candidate="${e(candidate.id)}" title="推荐账号 ${e(candidate.name)}（${e(candidate.id)}）· ${e(basis)}">推荐账号 ${e(candidate.name)}（${e(candidate.id)}）</small>` : '');

        const contextCell = row.status === 'pending'
          ? (pendingContext.customer
            ? `<strong>${e(pendingContext.customer)}</strong><small>${e(pendingContext.opportunity || '待补商机')}${pendingContext.opportunityId ? ' · ' + e(pendingContext.opportunityId) : ''}</small>`
            : '<span class="fp-map-empty">未返回客户</span><small>等待下一轮同步补齐事实</small>')
          : `${Number(row.customerCount || 0)} 个客户 · ${Number(row.opportunityCount || 0)} 个商机`;

        const statusCell = row.status === 'pending'
          ? `${F.badge('待对应', 'amber')}<small>等待人工处理</small>`
          : F.badge('已对应', 'green');

        const actions = row.status === 'pending'
          ? `${candidate ? linkAction('采用推荐', 'crm-map-accept', row.pendingId, true) : ''}${linkAction('设置对应', 'crm-map', row.pendingId || '', !candidate)}${detailAction(row.crmId, row.crmName)}`
          : `${linkAction('更换对应', 'crm-map-change', row.crmId)}${detailAction(row.crmId, row.crmName)}`;

        const detailRows = [
          ['CRM 信息', `${row.crmName}（${row.crmId}）· ${row.crmDept || '部门待补'}${row.crmEmail ? ' · ' + row.crmEmail : ''}`],
          row.status === 'pending' ? ['未自动匹配原因', row.failReason || 'CRM 人员尚未与系统账号对应'] : ['对应方式', `${(mappingModeLabels[row.mode] || mappingModeLabels.none)[0]}${row.matchedAt ? ' · ' + row.matchedAt : ''}`],
          row.status === 'pending' && candidate ? ['推荐账号与依据', `${candidate.name}（${candidate.id}）· ${basis || '姓名一致'}`] : null,
          ['影响范围', row.status === 'pending'
            ? `补建 1 条商机级确权、1 个空间关系；该 CRM 人员另有 ${Number(row.customerCount || 0)} 个客户 · ${Number(row.opportunityCount || 0)} 个商机`
            : `名下 ${Number(row.customerCount || 0)} 个客户 · ${Number(row.opportunityCount || 0)} 个商机；更换对应只影响下一次同步的补建目标`],
          ['处理口径', '对应关系只决定确权补建到哪个账号，不改变 CRM 事实']
        ].filter(Boolean).map(([term, value]) => `<dt>${e(term)}</dt><dd>${e(value)}</dd>`).join('');

        const detail = `<tr class="fp-map-detail" data-crm-map-detail-row="${e(row.crmId)}" hidden><td colspan="5"><div class="fp-map-detail-box"><dl class="fp-kv">${detailRows}</dl><div class="fp-map-actions">${row.status === 'pending' ? linkAction('查看影响', 'crm-impact', row.pendingId || '') : linkAction('查看影响', 'crm-map-impact', row.crmId)}</div></div></td></tr>`;

        const current = `<tr data-crm-mapping-row data-crm-id="${e(row.crmId)}" data-status="${e(row.status)}"><td><strong>${e(row.crmName)}</strong><small>${e(row.crmId)} · ${e(row.crmDept || '部门待补')}</small></td><td>${accountCell}</td><td>${contextCell}</td><td>${statusCell}</td><td><div class="fp-map-actions">${actions}</div></td></tr>`;
        const ownerText = owner ? `${owner.name} ${owner.id}` : '';
        const contextText = pendingContext.customer ? `${pendingContext.customer} ${pendingContext.customerId} ${pendingContext.opportunity} ${pendingContext.opportunityId}` : '';
        const haystack = `${row.crmName} ${row.crmId} ${row.crmDept || ''} ${row.crmEmail || ''} ${ownerText} ${contextText}`.toLocaleLowerCase('zh-CN');
        return {
          html: current + detail,
          rank: row.status === 'pending' ? 0 : 1,
          index,
          keywordOk: !keyword || haystack.includes(keyword),
          statusOk: !statusFilter || (statusFilter === 'matched' ? row.status === 'matched' : row.status === 'pending')
        };
      });
      // 待对应行排在前面：运营进来先看到要处理的行，已对应行作为底账跟在其后。
      const body = seed.filter(item => item.keywordOk && item.statusOk).sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.html);
      return { all, matched, pendingCount, autoCount, manualCount, statusFilter, body };
    }

    /**
     * 对应关系面板：待对应人员分面的主体，同步概览不再重复这一块。
     * @param {object} extra 待对应分面的补充口径：待对应条数与「人员无法对应」的兜底说明。
     */
    function renderMappingPanel(state, query = {}, extra = {}) {
      const crm = state.crm || {};
      const { all, matched, pendingCount, autoCount, manualCount, statusFilter, body } = buildMappingRows(state, query);
      const countBadge = extra.pendingCount === undefined
        ? (pendingCount ? F.badge('待对应 ' + pendingCount, 'amber') : '')
        : F.badge(`${extra.pendingCount ? '待对应 ' : '已全部对应 '}${extra.pendingCount} 条`, extra.pendingCount ? 'amber' : 'green');
      const hintText = extra.hint || '对应关系只决定确权补建到哪个账号，不改变 CRM 事实。';
      const onlyPending = statusFilter === 'pending';
      return `<section class="fp-panel" data-crm-mappings>
        <header class="fp-panel-head"><div><h2>CRM 人员与系统账号</h2><p class="fp-hint">${hintText}</p></div><div class="fp-actions">${F.badge('已对应 ' + matched, 'green')}${countBadge}${F.button(onlyPending ? '显示全部' : '只看待对应', 'crm-map-only-pending')}${F.button('导出对应关系', 'crm-map-export')}</div></header>
        <div class="fp-pad fp-stack">
          <div class="fp-map-summary" data-crm-map-summary>
            <div><strong>${all.length}</strong><span>CRM 人员</span></div>
            <div><strong>${matched}</strong><span>已对应</span></div>
            <div><strong>${pendingCount}</strong><span>待对应</span></div>
            <div><strong>${autoCount} / ${manualCount}</strong><span>自动 / 人工</span></div>
            <div><strong>${e(crm.lastSyncAt || '—')}</strong><span>最近同步</span></div>
          </div>
          ${pendingCount ? `<div class="fp-callout fp-callout--warn" data-crm-map-hint><strong>${pendingCount} 位 CRM 人员未对应系统账号：</strong>对应完成前不建立个人确权，也不影响同客户其他已对应销售；可采用推荐账号，或手动指定启用中的销售账号。</div>` : ''}
          ${F.searchbar('搜索 CRM 姓名、系统账号或涉及客户', F.field('对应状态', 'mapStatus', statusFilter, 'select', [['', '全部状态'], ['pending', '待对应'], ['matched', '已对应']]))}
          <div data-crm-mapping-results>${F.table(['CRM 人员', '系统账号 / 对应结果', '涉及客户 · 商机', '状态', '操作'], body, { caption: 'CRM 人员与系统账号对应关系', emptyMessage: '没有符合条件的人员，请调整搜索或筛选条件。', countLabel: '条人员对应', totalCount: all.length, compact: true, tableClass: 'fp-map-table', wrapClass: 'fp-map-table-wrap' })}</div>
        </div>
      </section>`;
    }

    /** 同步概览只回答「本轮同步结果是什么」；人员对应与配置映射整体挂在待对应人员分面。 */
    function renderCrmOverview(state) {
      const crm = state.crm;
      const changes = crm.changes || [];
      const changeRows = changes.map(item => `<tr data-crm-row data-status="${e(item.status || 'applied')}" data-crm-change="${e(item.change)}"><td><strong>${e(item.customer)}</strong><small>${e(item.opportunityId || '')} · ${e(item.opportunity || '')}</small></td><td>${e(item.sales ? F.name(item.sales) : '待对应')}</td><td>${F.badge(changeLabels[item.change] || item.change, changeTones[item.change] || 'neutral')}</td><td>${e(item.occurredAt || '')}</td><td>${F.badge(crmStatusLabel(item.status), item.status === 'applied' ? 'green' : 'amber')}</td></tr>`);
      return `<div class="fp-stack" data-crm-result>
        ${crmMetrics(crm)}
        <section class="fp-panel" data-crm-round><header class="fp-panel-head"><h3>本轮同步结果</h3></header>${F.table(['客户 / 商机', '销售', '变化', '发生时间', '处理状态'], changeRows, { caption: 'CRM 归属同步与确权结果', emptyMessage: '当前批次没有归属变化。', countLabel: '条确权变化', compact: true })}</section>
      </div>`;
    }

    /**
     * 待对应人员分面：人员对应与配置映射的唯一处理入口。
     * 看到＝对应总览与全量对应关系；get 到＝未对应原因、推荐账号、涉及客户/商机；
     * 操作＝采用推荐、设置/更换对应、查看影响。
     */
    function renderPending(state, query = {}) {
      const { pendingCount } = buildMappingRows(state, query);
      // 未对应影响已在面板内的高亮提示里完整说明，表头只保留这句口径，避免同一段话出现两遍。
      const hint = pendingCount
        ? '对应关系只决定确权补建到哪个账号，不改变 CRM 事实。'
        : '当前所有 CRM 人员都已对应系统账号；对应关系只决定确权补建到哪个账号，不改变 CRM 事实。';
      const body = renderMappingPanel(state, query, { pendingCount, hint });
      return `<div class="fp-stack" data-crm-pending-list><span class="fp-sr-only" data-crm-pending-count>${pendingCount} 条待对应</span>${body}</div>`;
    }

    function renderUnassigned(state) {
      const rows = state.crm.unassignedOpportunities.map(item => `<tr data-crm-row data-status="${e(item.status)}"><td><strong>${e(item.customer)}</strong><small>${e(item.customerId)}</small></td><td><strong>${e(item.opportunity)}</strong><small>${e(item.opportunityId)}</small></td><td>${e(item.discoveredAt)}</td><td>${F.badge('待 CRM 补分配', 'amber')}</td><td>${e(item.reason)}</td><td><span class="fp-readonly">回 CRM 处理</span></td></tr>`);
      return `<section data-crm-unassigned-list class="fp-panel"><header class="fp-panel-head"><div><h2>未分配商机</h2><p class="fp-hint">CRM 未返回销售人员的商机单独列出；本地不提供认领入口，也不会生成销售空间。</p></div><span>${state.crm.unassigned || rows.length} 条</span></header>${F.table(['客户', '商机', '发现时间', '当前状态', '来源事实', '操作'], rows, { caption: 'CRM 未分配商机清单', emptyMessage: '当前没有未分配商机。', countLabel: '条商机', compact: true })}</section>`;
    }

    function renderErrors(state) {
      const rows = state.crm.alignmentErrors.map(item => `<tr data-crm-row data-id="${e(item.id)}" data-status="${e(item.status)}"><td><strong>${e(item.customer)}</strong><small>${e(item.opportunityId)} · ${e(item.opportunity)}</small></td><td>${e(item.crmName || '—')}</td><td>${e(item.stage || '归属解析')}</td><td>${e(item.reason)}</td><td>${e(item.occurredAt)}<small>已重试 ${item.retryCount || 0} 次</small></td><td>${F.badge(crmStatusLabel(item.status), item.status === 'resolved' ? 'green' : 'amber')}</td><td>${item.status === 'resolved' ? '—' : F.button('单条重试', 'crm-retry', item.id)}${F.button('查看详情', 'crm-error-detail', item.id)}</td></tr>`);
      return `<section class="fp-panel"><header class="fp-panel-head"><div><h2>对齐异常</h2><p class="fp-hint">单条失败不会阻塞整批；下一轮会自动重试，修复结果保留在审计记录中。</p></div><span>${state.crm.failed || 0} 条待处理</span></header>${F.table(['客户 / 商机', 'CRM 人员', '失败环节', '失败原因', '发生时间', '状态', '操作'], rows, { caption: 'CRM 归属对齐异常清单', emptyMessage: '本轮没有待处理异常。', countLabel: '条异常', compact: true })}</section>`;
    }

    function renderCrmHistory(state) {
      const rows = (state.crm.changes || []).map(item => `<tr data-crm-row data-crm-change="${e(item.change)}"><td><strong>${e(item.customer)}</strong><small>${e(item.opportunityId || '')}</small></td><td>${e(item.sales ? F.name(item.sales) : '待对应')}</td><td>${F.badge(changeLabels[item.change] || item.change, changeTones[item.change] || 'neutral')}</td><td>${e(item.batchId || '')}</td><td>${e(item.occurredAt || '')}</td><td>${F.button('查看链路', 'crm-history-detail', item.id)}</td></tr>`);
      return `<section class="fp-panel"><header class="fp-panel-head"><div><h2>归属变化历史</h2><p class="fp-hint">保留 CRM 原始事实、确权结果和空间分发结果，当前名单与历史过程分开查看。</p></div></header>${F.table(['客户 / 商机', '销售', '变化', '批次', '发生时间', '操作'], rows, { caption: 'CRM 归属变化历史记录', emptyMessage: '当前没有归属变化记录。', countLabel: '条历史记录', compact: true })}</section>`;
    }

    function renderCrm(state) {
      const body = crmView === 'pending' ? renderPending(state, mapQuery) : crmView === 'unassigned' ? renderUnassigned(state) : crmView === 'errors' ? renderErrors(state) : crmView === 'history' ? renderCrmHistory(state) : renderCrmOverview(state);
      return `<div class="fp-stack">${crmSubnav()}${body}</div>`;
    }

    /* ---------- R12 消息触达运营视图 ---------- */
    const notifyViews = [['events', '提醒中心'], ['delivery', '投递结果']];
    const pushStatusMeta = { delivered: ['已送达', 'green'], failed: ['失败', 'amber'], not_installed: ['未安装', 'amber'], timeout: ['超时', 'amber'], not_required: ['仅站内', 'neutral'] };

    function notifySubnav() {
      return `<nav class="fp-tabs fp-crm-tabs" aria-label="消息触达分面">${notifyViews.map(([key, label]) => `<button type="button" data-action="notify-view" data-value="${key}" class="${notifyView === key ? 'is-active' : ''}" aria-pressed="${notifyView === key}">${label}</button>`).join('')}</nav>`;
    }

    /** 提醒中心：每个业务事件的接收人、直达目标、去重结果和投递状态都可核对。 */
    function renderNotifyEvents(state) {
      const rows = state.notifications.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(n => {
        const space = n.space && state.spaces.find(item => item.id === n.space);
        const target = n.link?.page === 'operations-config' ? '运营配置 · CRM 异常' : n.link?.page === 'solution-feedback' ? '方案反馈看板' : n.link?.page === 'today-follow' ? '今日该跟' : n.link?.page === 'insight-ops' ? '经营洞察编排 · 产出记录' : n.link?.page === 'daily-report' ? '晚间日报' : space ? `客户空间 · ${space.customer}` : n.space || '—';
        const push = pushStatusMeta[n.pushStatus] || pushStatusMeta.not_required;
        return `<tr data-notify-row data-type="${e(n.type)}"><td><strong>${e(n.title)}</strong><small>${e(n.type)}</small></td><td>${e(F.name(n.recipient))}<small>${e(n.recipient)}</small></td><td>${e(target)}</td><td>${e(n.createdAt)}</td><td>${n.deduped ? F.badge(`已合并 ${n.deduped} 次`, 'neutral') : '<span class="u-t3">首次生成</span>'}</td><td>${n.status === 'waiting' ? F.badge('等待空间就绪', 'brand') : F.badge(n.read ? '已读' : '未读', n.read ? 'neutral' : 'amber')}</td><td>${F.badge(push[0], push[1])}${n.pushFailReason ? `<small>${e(n.pushFailReason)}</small>` : ''}</td></tr>`;
      });
      return `<section class="fp-panel"><header class="fp-panel-head"><div><h2>提醒中心</h2><p class="fp-hint">同一事项重复触发只合并计数，不重复打扰；归属与解冻提醒在空间内容就绪前保持等待。</p></div></header>${F.table(['事项', '接收人', '直达目标', '生成时间', '去重结果', '站内状态', '推送状态'], rows, { caption: '提醒事件与接收人清单', emptyMessage: '当前没有提醒事件。', countLabel: '条提醒', compact: true })}</section>`;
    }

    /** 投递结果仅超管可查（R12 权限边界）；销售运营看到权限说明而不是数据。 */
    function renderNotifyDelivery(state) {
      if (F.role !== 'ADM') return `<section class="fp-panel fp-pad"><h2>投递结果</h2><div class="fp-callout">投递结果仅超级管理员可查；销售运营请通过提醒中心核对异常事项。</div></section>`;
      const q = String(notifyQuery.q || '').trim();
      const rows = state.deliveries.filter(d => (!q || `${F.name(d.recipient)} ${d.recipient} ${d.title}`.includes(q))
        && (!notifyQuery.status || d.status === notifyQuery.status)
        && (!notifyQuery.period || notifyQuery.period === 'all' || String(d.at).slice(0, 10) >= (notifyQuery.period === 'today' ? F.today : '2026-09-09'))).map(d => {
        const status = pushStatusMeta[d.status] || ['未知', 'neutral'];
        return `<tr data-delivery-row data-status="${e(d.status)}"><td><strong>${e(F.name(d.recipient))}</strong><small>${e(d.recipient)}</small></td><td>${e(d.title)}<small>${e(d.type)}</small></td><td>${e(d.channel)}</td><td>${F.badge(status[0], status[1])}</td><td>${e(d.reason || '—')}</td><td>${e(d.at)}</td></tr>`;
      });
      return `<section class="fp-panel"><header class="fp-panel-head"><div><h2>投递结果</h2><p class="fp-hint">每次移动端推送只发送一次；失败原因保留用于排查，不自动补发、不改变业务状态。</p></div></header>${F.searchbar('按接收人 / 事项搜索', F.field('投递状态', 'status', notifyQuery.status || '', 'select', [['', '全部状态'], ['delivered', '已送达'], ['failed', '失败'], ['not_installed', '未安装'], ['timeout', '超时']]) + F.field('时间范围', 'period', notifyQuery.period || 'all', 'select', [['all', '全部时间'], ['today', '本日'], ['week', '本周']]))}<div data-delivery-results>${F.table(['接收人', '事项', '渠道', '投递结果', '失败原因', '处理时间'], rows, { caption: '移动端推送投递结果清单', emptyMessage: '没有符合条件的投递记录。', countLabel: '条投递记录', compact: true, totalCount: state.deliveries.length })}</div></section>`;
    }

    /* ---------- R14 晚间日报运营视图：运行记录 / 提示词编排 / 运行设置 ---------- */

    const dailyViews = [['runs', '运行记录'], ['prompts', '提示词编排'], ['settings', '运行设置']];

    function dailySubnav() {
      return `<nav class="fp-tabs fp-crm-tabs" aria-label="晚间日报分面">${dailyViews.map(([key, label]) => `<button type="button" data-action="daily-view" data-value="${key}" class="${dailyView === key ? 'is-active' : ''}" aria-pressed="${dailyView === key}">${label}</button>`).join('')}</nav>`;
    }

    /** 运行记录：含「无有效变化」日的全部运行；当日已有结果时演示生成按「只保留一份」拒绝。 */
    function renderDailyRuns(state) {
      const rows = (state.dailyReports || []).slice().sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate))).map(report => {
        const [label, tone] = F.dailyReportStatusMeta[report.status] || ['未知', 'neutral'];
        return `<tr data-daily-run-row="${e(report.id)}"><td><strong>${e(report.reportDate)}</strong><small class="mono">${e(report.id)}</small></td><td>${e(report.windowStart)} → ${e(report.windowEnd)}</td><td>${F.badge(label, tone)}</td><td>${report.stats?.candidates ?? 0}</td><td>${report.stats?.effective ?? 0}</td><td>${report.stats?.failed ?? 0}</td><td class="mono">${e(report.promptVersion || '—')}</td><td>${e(report.startedAt || '—')}<small>${e(report.completedAt || '—')}</small></td><td>${F.button('详情', 'daily-detail', report.id)}${(report.failedCustomers || []).length ? F.button('重试失败客户', 'daily-retry', report.id) : ''}</td></tr>`;
      });
      return `<div class="fp-stack">
        <div class="fp-callout"><strong>每日 ${e(state.dailyReportConfig?.globalTime || '18:30')} 生成，最晚 30 分钟收口。</strong>当日只保留一份结果；无有效变化不生成业务日报、不通知，仅在此保留运行记录。<span class="fp-sub">销售与方案人员的入口在「晚间日报」功能页。</span></div>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>运行记录</h2><p class="fp-hint">候选、有效、失败与排除原因都可核对；详情含进入下一窗口的内容与运行日志。</p></div><div class="fp-actions">${F.button('演示生成当日日报', 'daily-run', '', true)}</div></header><div data-daily-runs>${F.table(['报告日期', '报告窗口', '状态', '候选', '有效', '失败', '提示词版本', '开始 → 完成', '操作'], rows, { caption: '晚间日报运行记录', emptyMessage: '当前没有日报运行记录。', countLabel: '份运行记录', compact: true })}</div></section>
      </div>`;
    }

    /** 提示词编排：四份独立编辑与试跑，作为一个完整版本发布或回退；下一自然日生效。 */
    function renderDailyPrompts(state) {
      const config = state.dailyReportConfig;
      const active = (config.versions || []).find(item => item.status === 'active');
      const cards = F.dailyPromptKeys.map(key => {
        const prompt = config.prompts[key];
        return `<section class="fp-panel fp-pad" data-daily-prompt="${e(key)}">
          <header class="fp-section-head"><h3>${e(prompt.label)}</h3>${prompt.draft ? F.badge('有未发布草稿', 'amber') : F.badge('无草稿', 'neutral')}</header>
          <p class="fp-hint">${e(prompt.purpose)}</p>
          <dl class="fp-kv"><dt>当前生效版</dt><dd>${active ? `${e(active.id)} · ${e(active.effectiveFrom)} 起生效` : '尚无生效版'}</dd><dt>生效版正文</dt><dd>${e(active?.prompts?.[key] || '—')}</dd>${prompt.draft ? `<dt>草稿</dt><dd>${e(F.name(prompt.draft.savedBy))} 保存于 ${e(prompt.draft.savedAt)}</dd><dt>草稿正文</dt><dd>${e(prompt.draft.body)}</dd>` : ''}</dl>
          <div class="fp-actions">${F.button(prompt.draft ? '编辑草稿' : '新建草稿', 'daily-prompt-edit', key)}${F.button('试跑', 'daily-trial', key)}</div>
        </section>`;
      }).join('');
      const versionRows = (config.versions || []).map(item => `<tr><td class="mono"><strong>${e(item.id)}</strong></td><td>${F.badge(item.status === 'active' ? '生效中' : '已回退', item.status === 'active' ? 'green' : 'neutral')}${item.loaded === false ? F.badge('未加载', 'amber') : ''}</td><td>${e(item.effectiveFrom || '—')}</td><td>${e(F.name(item.publishedBy))}</td><td>${e(item.publishedAt || '—')}</td></tr>`);
      const logRows = (config.publishLog || []).map(log => `<tr><td>${e(log.at)}</td><td class="mono">${e(log.version)}</td><td>${F.badge(log.action === 'publish' ? '发布' : '回退', log.action === 'publish' ? 'green' : 'amber')}</td><td>${e(log.effectiveFrom)}</td><td>${e(F.name(log.by))}</td></tr>`);
      const trialRows = (config.trialRuns || []).map(item => `<tr><td>${e(item.at)}</td><td>${e(item.window)}</td><td>${e((item.spaces || []).join('、'))}</td><td>${e(F.name(item.by))}</td></tr>`);
      return `<div class="fp-stack">
        <div class="fp-callout">四份提示词独立编辑、独立保存草稿、独立试跑；<strong>发布与回退以完整版本为单位，不拆分</strong>。保存草稿不影响线上；发布与回退从下一自然日运行开始生效，当天已生成日报不变。</div>
        <div class="fp-config-grid">${cards}</div>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>完整版本</h2><p class="fp-hint">任一提示词缺失有效草稿时阻止发布；发布失败继续使用上一生效版。</p></div><div class="fp-actions">${F.button('发布完整版本', 'daily-publish', '', true)}${(config.versions || []).length > 1 ? F.button('回退上一版', 'daily-rollback') : ''}</div></header><div class="fp-pad"><div class="fp-callout">下一自然日生效：新版本从下一个自然日的运行开始使用；新时间已过但当日未运行时，当日仍按原口径。</div>${F.table(['版本', '状态', '生效日期', '发布人', '发布时间'], versionRows, { caption: '晚间日报提示词版本', emptyMessage: '暂无版本记录。', countLabel: '个版本', compact: true })}</div></section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>发布记录</h2><p class="fp-hint">每次发布与回退都留痕，含生效日期。</p></div></header>${F.table(['时间', '版本', '动作', '生效日期', '操作人'], logRows, { caption: '晚间日报发布记录', emptyMessage: '暂无发布记录。', countLabel: '条发布记录', compact: true })}</section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>试跑记录</h2><p class="fp-hint">试跑用历史窗口真实输入，只出四步新旧对照；不发消息、不写「当日汇总」、不影响线上日报。</p></div></header><div data-daily-trials>${F.table(['时间', '历史窗口', '样本空间', '操作人'], trialRows, { caption: '晚间日报试跑记录', emptyMessage: '暂无试跑记录。', countLabel: '次试跑', compact: true })}</div></section>
      </div>`;
    }

    /** 运行设置：全局产出时间（默认 18:30），最晚 30 分钟收口；调整下一自然日生效，窗口连续衔接。 */
    function renderDailySettings(state) {
      const config = state.dailyReportConfig;
      return `<div class="fp-stack">
        <div class="fp-callout">全局产出时间对全员统一，V1 不支持按销售单独覆盖；<strong>最晚 30 分钟收口</strong>，超时未完成的客户块转失败，不延长等待。调整后从下一自然日生效，报告窗口从上一次计划截止连续衔接，不产生重复或遗漏。</div>
        <form class="fp-form" data-daily-settings><div class="fp-title"><div><h2>全局产出时间</h2><p>新时间已过但当日未运行时，当日仍按原时间口径处理。</p></div></div>${F.field('产出时间', 'globalTime', config.globalTime || '18:30', 'time')}<p class="fp-error" role="alert"></p><div class="fp-actions"><button type="submit" class="btn btn--primary">保存时间</button></div></form>
        <section class="fp-panel fp-pad"><h3>当前口径</h3><dl class="fp-kv"><dt>全局时间</dt><dd>${e(config.globalTime || '18:30')}</dd><dt>最后修改</dt><dd>${config.timeUpdatedAt ? `${e(F.name(config.timeUpdatedBy))} · ${e(config.timeUpdatedAt)}` : '尚未调整'}</dd><dt>生效日期</dt><dd>${e(config.timeEffectiveFrom || '—')}</dd></dl></section>
      </div>`;
    }

    /** 运行详情抽屉：排除原因、失败客户、进入下一窗口与运行日志。 */
    function openDailyRunDetail(id) {
      const state = F.load();
      const report = (state.dailyReports || []).find(item => item.id === id);
      if (!report) { SC.toast('运行记录不存在，请刷新后重试。', 'bad'); return; }
      const [label, tone] = F.dailyReportStatusMeta[report.status] || ['未知', 'neutral'];
      const listRows = (items, mapper, emptyText) => items.length ? `<ul class="fp-compact-list">${items.map(mapper).join('')}</ul>` : `<p class="u-t3">${emptyText}</p>`;
      F.drawer(`运行详情 · ${report.id}`, `<div class="fp-stack" data-daily-run-detail>
        <div class="fp-actions">${F.badge(label, tone)}<span class="u-t3 mono">${e(report.promptVersion || '—')}</span></div>
        <dl class="fp-kv"><dt>报告窗口</dt><dd>${e(report.windowStart)} → ${e(report.windowEnd)}</dd><dt>输入截止</dt><dd>${e(report.inputCutoff || '—')}</dd><dt>启动 / 完成</dt><dd>${e(report.startedAt || '—')} → ${e(report.completedAt || '—')}</dd><dt>候选 / 有效 / 失败</dt><dd>${report.stats?.candidates ?? 0} / ${report.stats?.effective ?? 0} / ${report.stats?.failed ?? 0}</dd><dt>接收人</dt><dd>${(report.recipients || []).map(item => `${e(F.name(item.person))}（${item.kind === 'sales' ? '销售日报' : '方案人员合集'}）`).join('、') || '无（无有效变化不通知）'}</dd></dl>
        <section><h3>排除原因</h3>${listRows(report.excluded || [], item => `<li><strong>${e(item.customer)}</strong>（${e(item.space)}）：${e(item.reason)}</li>`, '没有排除项。')}</section>
        <section><h3>失败客户</h3>${listRows(report.failedCustomers || [], item => `<li><strong>${e(item.customer)}</strong>（${e(item.space)}）：${e(item.stage)} · ${e(item.reason)}</li>`, '没有失败客户。')}</section>
        ${(report.previousFailures || []).length ? `<section><h3>前次失败记录（保留）</h3>${listRows(report.previousFailures, item => `<li><strong>${e(item.customer)}</strong>：${e(item.reason)}<span class="u-t3"> · ${e(item.retriedAt || '')} ${e(item.outcome || '')}</span></li>`, '')}</section>` : ''}
        <section><h3>进入下一窗口</h3>${listRows(report.carriedOver || [], item => `<li><strong>${e(item.changeId)}</strong>（${e(item.customer)}）：${e(item.reason)}</li>`, '没有进入下一窗口的内容。')}</section>
        <section><h3>运行日志</h3>${listRows(report.runLog || [], item => `<li><strong>${e(item.step)}</strong> · ${e(item.result)} · ${e(item.at)}<br><span class="u-t3">${e(item.detail)}</span></li>`, '暂无运行日志。')}</section>
      </div>`);
    }

    /** 试跑抽屉：勾选样本空间（上限 3 个），提交后展示四步新旧对照；不写线上。 */
    function openDailyTrial(key) {
      const state = F.load();
      const config = state.dailyReportConfig;
      const prompt = config.prompts[key];
      if (!prompt) return;
      F.drawer(`试跑 · ${prompt.label}`, `<form class="fp-form" data-daily-trial-form>
        <div class="fp-callout fp-callout--warn">单次试跑最多 3 个空间（待与 R13 试跑上限对齐，暂固化为 3）。试跑使用历史窗口真实输入，只出四步新旧对照；不发消息、不写「当日汇总」、不影响线上日报。</div>
        <fieldset class="fp-checks"><legend>样本空间（最多 3 个）</legend>${state.spaces.map(w => `<label><input type="checkbox" name="spaces" value="${e(w.id)}"><span><strong>${e(w.customer)}</strong><small>${e(F.name(w.sales))} · ${e(w.id)}${w.state === 'frozen' ? ' · 已冻结，用历史内容试跑' : ''}</small></span></label>`).join('')}</fieldset>
        <p class="fp-hint">试跑窗口默认取最近一份有内容的日报窗口；四份提示词的新旧对照在结果中分步展示。</p>
        <p class="fp-error" role="alert"></p>
        <footer class="fp-form-foot"><span class="u-t3">本地演示数据</span><button type="submit" class="btn btn--primary">开始试跑</button></footer>
      </form>`, (mask, close) => {
        mask.querySelector('form').onsubmit = event => {
          event.preventDefault();
          const form = event.currentTarget;
          try {
            const ids = [...form.querySelectorAll('[name=spaces]:checked')].map(node => node.value);
            const trial = F.trialRunDailyReport(ids);
            close();
            draw();
            const stepLabels = Object.fromEntries(F.dailyPromptKeys.map(k => [k, config.prompts[k]?.label || k]));
            F.drawer(`试跑结果 · ${trial.id}`, `<div class="fp-stack" data-daily-trial-result>
              <div class="fp-callout">窗口 ${e(trial.window)}；样本空间 ${e(trial.spaces.join('、'))}。只读对照，不写线上。</div>
              ${F.dailyPromptKeys.map(k => `<section class="fp-panel fp-pad" data-daily-trial-step="${e(k)}"><h3>${e(stepLabels[k])}</h3><dl class="fp-kv"><dt>草稿版</dt><dd>${e(trial.steps[k].draft)}</dd><dt>当前生效版</dt><dd>${e(trial.steps[k].current)}</dd></dl></section>`).join('')}
            </div>`);
            SC.toast('试跑完成，只生成对照结果，未写线上日报。', 'ok');
          } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
        };
      });
    }

    /**
     * 人员对应表单：同时服务待对应人员的首次对应和已对应人员的更换。
     * 表单先给影响预览（推荐依据、将补建的确权与空间），再给账号选择，避免只看账号不看后果。
     */
    function openMappingForm(id, crmId = '') {
      const state = F.load();
      const crm = state.crm || {};
      const row = crmId ? (crm.mappings || []).find(item => item.crmId === crmId) : null;
      const mapping = crmId ? null : (crm.pendingMappings || []).find(item => item.id === id) || (crm.pendingMappings || []).find(item => item.status === 'pending');
      if (!row && !mapping) { SC.toast('当前没有待对应人员。', 'ok'); return; }
      const source = row || mapping;
      const people = state.people.filter(person => person.role === 'SLS' && person.status === 'on');
      const currentOwner = row?.ownerId || '';
      const defaultOwner = currentOwner || row?.suggestOwnerId || people[0]?.id || '';
      const context = row
        ? `<div class="fp-callout">${e(row.crmName)}（${e(row.crmId)}）当前对应 ${e(currentOwner ? F.name(currentOwner) : '未对应')}。更换后只影响下一次同步的确权补建，已生成的确权与空间不回溯变更。</div>`
        : `<div class="fp-callout">${e(mapping.crmName)}（${e(mapping.crmId)}）涉及 ${e(mapping.customer)} / ${e(mapping.opportunity)}。确认后将补建商机确权，并复用同一销售、客户、客户池的原空间。</div>`;
      const suggestion = row?.suggestOwnerId
        ? `<dt>推荐账号</dt><dd>${e(F.name(row.suggestOwnerId))}（${e(row.suggestOwnerId)}）· ${e(row.suggestBasis || '姓名一致')}</dd>`
        : '';
      F.form((row ? '更换 CRM 人员对应 · ' : '设置 CRM 人员对应 · ') + source.crmName,
        `${context}${F.field('系统销售账号 *', 'mappedOwner', defaultOwner, 'select', people.map(person => [person.id, `${person.name} · ${person.id}`]))}<dl class="fp-kv">${suggestion}<dt>将补建</dt><dd>1 条商机级确权 · 1 个空间关系</dd><dt>归属来源</dt><dd>CRM 人员对应修复</dd></dl>`,
        values => (row ? F.changeCrmMapping(row.crmId, values.mappedOwner) : F.resolveCrmMapping(mapping.id, values.mappedOwner)),
        () => draw(), row ? '确认更换' : '确认对应');
    }

    /** 采用推荐账号前先给影响预览：推荐依据、涉及客户与商机、补建结果，确认后才写入。 */
    function openSuggestionConfirm(pendingId) {
      const state = F.load();
      const row = (state.crm?.mappings || []).find(item => item.pendingId === pendingId);
      if (!row || !row.suggestOwnerId) { SC.toast('该条没有可采用的推荐账号，请手动设置对应。', 'bad'); return; }
      const person = F.person(row.suggestOwnerId);
      const mapping = (state.crm.pendingMappings || []).find(item => item.id === pendingId);
      F.drawer('采用推荐账号 · ' + row.crmName, `<div class="fp-stack" data-crm-suggestion>
        <div class="fp-callout">推荐 ${e(person?.name || row.suggestOwnerId)}（${e(row.suggestOwnerId)}）：${e(row.suggestBasis || '姓名一致')}。采用后与手动设置对应走同一条补建链路。</div>
        <dl class="fp-kv"><dt>CRM 人员</dt><dd>${e(row.crmName)}（${e(row.crmId)}）</dd><dt>涉及客户</dt><dd>${e(mapping?.customer || '—')}</dd><dt>涉及商机</dt><dd>${e(mapping?.opportunity || '—')}</dd><dt>将补建</dt><dd>1 条商机级确权 · 1 个空间关系</dd><dt>不影响</dt><dd>同客户其他已对应销售的权限不变</dd></dl>
        <div class="fp-actions">${F.button('确认采用', 'crm-map-accept-confirm', pendingId, true)}</div>
      </div>`, (mask, close) => {
        mask.querySelector('[data-action="crm-map-accept-confirm"]').onclick = () => {
          try {
            const name = F.acceptCrmSuggestion(pendingId);
            close(); draw();
            SC.toast(`已对应到 ${name}，确权将在下一次同步补建。`, 'ok');
          } catch (error) { SC.toast(error.message, 'bad'); }
        };
      });
    }

    /** 已对应人员的影响范围：只读展示该对应关系当前支撑的客户空间，便于判断能否更换。 */
    function openMappingImpact(crmId) {
      const state = F.load();
      const row = (state.crm?.mappings || []).find(item => item.crmId === crmId);
      if (!row) { SC.toast('对应记录不存在，请刷新后重试。', 'bad'); return; }
      const spaces = state.spaces.filter(space => space.sales === row.ownerId);
      const rows = spaces.map(space => `<tr><td><strong>${e(space.customer)}</strong><small>${e(space.id)}</small></td><td>${e(space.pool || '待补客户池')}</td><td>${F.badge(space.state === 'frozen' ? '已冻结' : '进行中', space.state === 'frozen' ? 'neutral' : 'green')}</td><td>${(space.opps || []).length}</td></tr>`);
      F.drawer('对应影响 · ' + row.crmName, `<div class="fp-stack">
        <div class="fp-callout">${e(row.crmName)} 对应 ${e(row.ownerId ? F.name(row.ownerId) : '未对应')}；该账号按此对应关系接收 CRM 确权，本地不改变 CRM 事实。</div>
        ${F.table(['客户空间', '客户池', '生命周期', '已确权商机'], rows, { caption: 'CRM 人员对应影响的客户空间', emptyMessage: '该账号当前没有已建立的空间。', countLabel: '个空间', compact: true })}
      </div>`);
    }

    function openCrmBatch() {
      const state = F.load(), crm = state.crm, batch = crm.batches.find(item => item.id === crm.currentBatchId) || crm.batches[0];
      if (!batch) return;
      F.drawer('CRM 同步批次 · ' + batch.id, `<div class="fp-stack"><div class="fp-callout">${e(batch.trigger || '定时')}同步于 ${e(batch.at)} 完成，事实版本 ${e(batch.factsVersion)}。${crm.lastResult ? `<br>本轮结论：${e(crm.lastResult)}` : ''}</div>${F.metrics([['处理对象', batch.processed, '条 CRM 事实'], ['新增', batch.added, '确权'], ['移除', batch.removed, '确权'], ['恢复', batch.restored, '确权']])}${F.table(['处理项', '数量', '说明'], [['无变化', batch.unchanged, '事实未变化'], ['待对应', batch.pending, '人员映射待处理'], ['未分配', batch.unassigned, '需回 CRM 补分配'], ['异常', batch.failed, '下一轮自动重试']].map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`), { caption: 'CRM 同步批次摘要', emptyMessage: '暂无批次明细。', countLabel: '项结果', compact: true })}<p class="fp-hint">同步策略：每 5 分钟读取客户、商机、人员关系和客户池；人员不可对应、未分配商机和单条失败分别处理，不提供本地认领或归属申请。</p></div>`);
    }

    function openHistoryDetail(id) {
      const item = F.load().crm.changes.find(change => change.id === id);
      if (!item) return;
      F.drawer('归属变化链路 · ' + item.id, `<div class="fp-stack"><div class="fp-callout"><strong>${e(item.customer)}</strong> · ${e(item.opportunity || item.opportunityId)}</div><div class="fp-steps"><span class="is-active">1. CRM 原始事实</span><span class="is-active">2. 确权结果</span><span class="is-active">3. 空间分发</span><span>4. 消息分发</span></div><dl class="fp-kv"><dt>变化类型</dt><dd>${F.badge(changeLabels[item.change] || item.change, changeTones[item.change] || 'neutral')}</dd><dt>销售</dt><dd>${e(item.sales ? F.name(item.sales) : '待对应')}</dd><dt>事实时间</dt><dd>${e(item.occurredAt)}</dd><dt>批次</dt><dd>${e(item.batchId)}</dd><dt>处理结果</dt><dd>${e(item.status === 'applied' ? '已下发空间能力' : '等待人员对应')}</dd></dl></div>`);
    }

    /** 计算账号停用前的业务影响，只读展示，不会改变客户或商机归属。 */
    function personImpact(person, state) {
      const spaces = state.spaces.filter(space => space.sales === person.id);
      return {
        customers: new Set(spaces.map(space => space.customerId)).size,
        opportunities: spaces.reduce((count, space) => count + (space.opps || []).length, 0),
        spaces: spaces.length
      };
    }

    function activeAdminCount(state) {
      return state.people.filter(person => person.role === 'ADM' && person.status === 'on').length;
    }

    function assertPersonStateChange(state, person, nextStatus) {
      if (!person) throw Error('人员不存在，请刷新列表后重试。');
      if (person.id === F.actor?.id && nextStatus === 'off') throw Error('不能停用当前登录账号。');
      if (person.role === 'ADM' && nextStatus === 'off' && activeAdminCount(state) <= 1) throw Error('至少保留一名启用中的超级管理员。');
    }

    function nextPersonId(state) {
      const used = new Set(state.people.map(person => Number(String(person.id).replace(/^U-/, ''))).filter(Number.isFinite));
      let candidate = 1001;
      while (used.has(candidate)) candidate += 1;
      return 'U-' + candidate;
    }

    function randomPassword() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@';
      return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    function validatePerson(values, state, id) {
      if (!values.name?.trim()) throw Error('请填写姓名。');
      if (!values.email?.trim()) throw Error('请填写企业邮箱。');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) throw Error('请填写有效的企业邮箱地址。');
      const duplicate = state.people.find(person => person.id !== id && person.email.toLowerCase() === values.email.trim().toLowerCase());
      if (duplicate) throw Error('该邮箱已被 ' + duplicate.name + ' 使用。');
      if (!F.roles[values.role]) throw Error('请选择人员角色。');
      if (id === F.actor?.id && values.status === 'off') throw Error('不能停用当前登录账号。');
      if (id === F.actor?.id && values.role !== F.role) throw Error('不能变更当前登录账号的角色。');
      if (id && state.people.find(person => person.id === id)?.role === 'ADM' && values.status === 'off' && activeAdminCount(state) <= 1) throw Error('至少保留一名启用中的超级管理员。');
      if (id && state.people.find(person => person.id === id)?.role === 'ADM' && values.role !== 'ADM' && activeAdminCount(state) <= 1) throw Error('至少保留一名超级管理员。');
      if (!id && (!values.password || values.password.length < 6)) throw Error('初始密码至少需要 6 位。');
    }

    function peopleForm(id) {
      const state = F.load();
      const person = id ? state.people.find(item => item.id === id) : null;
      if (id && !person) { SC.toast('人员不存在，请刷新后重试。', 'bad'); return; }
      const isNew = !person;
      const values = person || { name: '', email: '', mobile: '', role: 'SLS', status: 'on' };
      const fields = [
        F.field('姓名 *', 'name', values.name),
        F.field('企业邮箱 *', 'email', values.email, 'email'),
        F.field('手机号', 'mobile', values.mobile === '未填写' ? '' : values.mobile, 'tel'),
        F.field('角色 *', 'role', values.role, 'select', Object.entries(F.roles).map(([key, label]) => [key, label])),
        F.field('账号状态', 'status', values.status, 'select', [['on', '启用'], ['off', '停用']]),
        isNew ? F.field('初始密码 *', 'password', randomPassword(), 'password') : '<p class="fp-readonly">编辑不会显示或修改当前密码。如需变更，请使用“重置密码”。</p>'
      ].join('');
      F.form(isNew ? '新增人员' : '编辑人员 · ' + person.name, fields, formValues => {
        const current = F.load();
        validatePerson(formValues, current, id);
        let credentialId = id;
        F.mutate(isNew ? '新增人员账号' : '编辑人员账号', next => {
          if (isNew) {
            credentialId = nextPersonId(next);
            next.people.unshift({ id: credentialId, name: formValues.name.trim(), email: formValues.email.trim(), mobile: formValues.mobile.trim() || '未填写', role: formValues.role, status: formValues.status === 'off' ? 'off' : 'on', createdAt: F.now(), lastLoginAt: '暂无登录记录', passwordResetAt: F.now() });
          } else {
            const target = next.people.find(item => item.id === id);
            if (!target) throw Error('人员不存在，请刷新列表后重试。');
            Object.assign(target, { name: formValues.name.trim(), email: formValues.email.trim(), mobile: formValues.mobile.trim() || '未填写', role: formValues.role, status: formValues.status === 'off' ? 'off' : 'on' });
          }
        });
        if (isNew) SC.DATA.setCredential(credentialId, formValues.password);
      }, () => { selectedPeople.delete(id); draw(); }, '保存人员');
    }

    function resetPassword(id) {
      const person = F.load().people.find(item => item.id === id);
      if (!person) { SC.toast('人员不存在，请刷新列表后重试。', 'bad'); return; }
      const generated = randomPassword();
      F.form('重置密码 · ' + person.name, F.field('新密码 *', 'password', generated, 'password') + F.field('确认新密码 *', 'confirmPassword', generated, 'password') + '<p class="fp-callout fp-callout--warn">确认后旧密码立即失效；演示页面不会保存明文密码。</p>', values => {
        if (!values.password || values.password.length < 6) throw Error('新密码至少需要 6 位。');
        if (values.password !== values.confirmPassword) throw Error('两次输入的密码不一致。');
        F.mutate('重置人员密码', state => {
          const target = state.people.find(item => item.id === id);
          if (!target) throw Error('人员不存在，请刷新列表后重试。');
          target.passwordResetAt = F.now();
        });
        SC.DATA.setCredential(id, values.password);
      }, () => { draw(); SC.toast('密码已重置，旧会话已失效。', 'ok'); }, '确认重置');
    }

    function disablePeople(ids) {
      const state = F.load();
      const people = ids.map(id => state.people.find(person => person.id === id)).filter(Boolean).filter(person => person.status === 'on');
      if (!people.length) { SC.toast('所选人员均已停用。', 'bad'); return; }
      const invalid = people.find(person => {
        try { assertPersonStateChange(state, person, 'off'); return false; } catch (_) { return true; }
      });
      if (invalid) { SC.toast(invalid.id === F.actor?.id ? '不能停用当前登录账号。' : '至少保留一名启用中的超级管理员。', 'bad'); return; }
      const impact = people.reduce((sum, person) => {
        const item = personImpact(person, state);
        return { customers: sum.customers + item.customers, opportunities: sum.opportunities + item.opportunities, spaces: sum.spaces + item.spaces };
      }, { customers: 0, opportunities: 0, spaces: 0 });
      const title = people.length === 1 ? '停用账号 · ' + people[0].name : `批量停用 ${people.length} 个账号`;
      const detail = people.length === 1 ? `<p class="fp-hint">停用后该账号无法登录，客户、商机和空间归属不变。</p>` : `<p class="fp-hint">停用后所选账号无法登录，客户、商机和空间归属不变。</p><div class="fp-people-impact-list">${people.map(person => `<span>${e(person.name)} · ${e(roleLabel(person.role))}</span>`).join('')}</div>`;
      const html = `<div class="fp-stack">${detail}<div class="fp-people-impact"><div><strong>${impact.customers}</strong><span>涉及客户</span></div><div><strong>${impact.opportunities}</strong><span>归属商机</span></div><div><strong>${impact.spaces}</strong><span>客户空间</span></div></div><form class="fp-form"><p class="fp-error" role="alert"></p><footer class="fp-form-foot"><button type="button" class="btn" data-cancel-disable>取消</button><button type="submit" class="btn btn--danger">确认停用</button></footer></form></div>`;
      F.drawer(title, html, (mask, close) => {
        mask.querySelector('[data-cancel-disable]').onclick = close;
        mask.querySelector('form').onsubmit = event => {
          event.preventDefault();
          try {
            F.mutate(people.length > 1 ? '批量停用人员账号' : '停用人员账号', next => {
              ids.forEach(id => {
                const target = next.people.find(person => person.id === id);
                if (!target || target.status !== 'on') return;
                assertPersonStateChange(next, target, 'off');
                target.status = 'off';
              });
            });
            people.forEach(person => selectedPeople.delete(person.id));
            close(); draw(); SC.toast(people.length > 1 ? `已停用 ${people.length} 个账号。` : `已停用 ${people[0].name} 的账号。`, 'ok');
          } catch (error) { mask.querySelector('.fp-error').textContent = error.message; }
        };
      }, true);
    }

    function personDetail(id) {
      const state = F.load();
      const person = state.people.find(item => item.id === id);
      if (!person) { SC.toast('人员不存在，请刷新列表后重试。', 'bad'); return; }
      const impact = personImpact(person, state);
      const pools = person.role === 'SOL' ? (state.assignments[person.id] || []) : [];
      const logs = state.audit.filter(log => log.title.includes('人员') || log.title.includes('密码')).slice(0, 5);
      const html = `<div class="fp-stack fp-people-detail"><div class="fp-people-profile"><span class="fp-avatar fp-avatar--large">${e(person.name[0])}</span><div><h3>${e(person.name)}</h3><p class="mono">${e(person.id)}</p></div><div class="u-grow"></div>${F.badge(roleLabel(person.role), roleTone(person.role))}${F.badge(statusLabel(person.status), statusTone(person.status))}</div><dl class="fp-kv"><dt>企业邮箱</dt><dd>${e(person.email)}</dd><dt>手机号</dt><dd>${e(person.mobile || '未填写')}</dd><dt>创建时间</dt><dd>${e(person.createdAt)}</dd><dt>最近登录</dt><dd>${e(person.lastLoginAt)}</dd><dt>业务关系</dt><dd>${impact.customers} 个客户 · ${impact.opportunities} 个商机 · ${impact.spaces} 个空间</dd>${person.role === 'SOL' ? `<dt>承接客户池</dt><dd>${pools.length ? pools.map(pool => F.badge(pool, 'brand')).join(' ') : F.badge('未配置', 'amber')}</dd>` : ''}</dl><div class="fp-actions">${F.button('编辑人员', 'people-edit', person.id, true)}${F.button('重置密码', 'people-reset', person.id)}${F.button(person.status === 'on' ? '停用账号' : '启用账号', 'people-toggle', person.id)}</div><section class="fp-people-audit"><h3>最近操作</h3>${logs.length ? `<ul>${logs.map(log => `<li><strong>${e(log.title)}</strong><span>${e(log.actor)} · ${e(log.date)}</span></li>`).join('')}</ul>` : '<p class="fp-hint">暂无人员操作记录。</p>'}</section></div>`;
      F.drawer('人员详情 · ' + person.name, html, (mask, close) => F.bind(mask, {
        'people-edit': () => { close(); peopleForm(id); },
        'people-reset': () => { close(); resetPassword(id); },
        'people-toggle': () => { close(); person.status === 'on' ? disablePeople([id]) : (F.mutate('启用人员账号', next => { const target = next.people.find(item => item.id === id); if (!target) throw Error('人员不存在。'); target.status = 'on'; }), draw(), SC.toast('账号已启用。', 'ok')); }
      }));
    }

    function drawPeople(target) {
      const state = F.load();
      target.innerHTML = `<div class="fp-people-stack"><div class="fp-people-head"><div><h2>人员与账号</h2><p class="fp-hint">管理人员身份、账号状态与访问权限。</p></div><div class="fp-actions">${F.button('导出列表', 'people-export')}${F.button('新增人员', 'people-new', '', true)}</div></div>${F.metrics([['总人数', state.people.length, '当前账号'], ['启用中', state.people.filter(person => person.status === 'on').length, '可登录账号'], ['已停用', state.people.filter(person => person.status === 'off').length, '保留历史记录'], ['待配置承接池', state.people.filter(person => person.role === 'SOL' && !(state.assignments[person.id] || []).length).length, '解决方案人员']])}<div class="fp-callout">停用账号会阻止登录，但不会改变客户、商机和客户空间归属；涉及交接时请先核对业务影响。</div>${F.searchbar('搜索姓名、邮箱或人员 ID', F.field('角色', 'role', '', 'select', [['', '全部角色'], ...Object.entries(F.roles).map(([key, label]) => [key, label])]) + F.field('账号状态', 'status', '', 'select', [['', '全部状态'], ['on', '启用中'], ['off', '已停用']]))}<div data-people-results></div></div>`;
      F.restoreSearch(root, peopleQuery);
      renderPeopleResults();
      F.handleSearch(root, filterPeople);
    }

    function filterPeople(query = {}) {
      peopleQuery = query;
      peoplePage = 1;
      selectedPeople.clear();
      F.restoreSearch(root, query);
      renderPeopleResults();
    }

    function renderPeopleResults() {
      const state = F.load();
      const q = String(peopleQuery.q || '').toLowerCase();
      const filtered = state.people.filter(person => {
        const matchesText = !q || [person.id, person.name, person.email, person.mobile].some(value => String(value || '').toLowerCase().includes(q));
        return matchesText && (!peopleQuery.role || person.role === peopleQuery.role) && (!peopleQuery.status || person.status === peopleQuery.status);
      });
      const pageCount = Math.max(1, Math.ceil(filtered.length / peoplePageSize));
      peoplePage = Math.min(peoplePage, pageCount);
      const rows = filtered.slice((peoplePage - 1) * peoplePageSize, peoplePage * peoplePageSize).map(person => `<tr><td><label class="fp-people-row"><input type="checkbox" data-people-check="${e(person.id)}" ${selectedPeople.has(person.id) ? 'checked' : ''} aria-label="选择 ${e(person.name)}"><span class="fp-avatar">${e(person.name[0])}</span><span><strong>${e(person.name)}</strong><small class="mono">${e(person.id)}</small></span></label></td><td>${e(person.email)}</td><td>${e(person.mobile || '未填写')}</td><td>${F.badge(roleLabel(person.role), roleTone(person.role))}</td><td>${F.badge(statusLabel(person.status), statusTone(person.status))}</td><td class="mono">${e(person.lastLoginAt)}</td><td>${F.button('详情', 'people-detail', person.id)}${F.button('编辑', 'people-edit', person.id)}${F.button(person.status === 'on' ? '停用' : '启用', 'people-toggle', person.id)}${F.button('重置密码', 'people-reset', person.id)}</td></tr>`);
      const selectedCount = selectedPeople.size;
      const visibleIds = filtered.slice((peoplePage - 1) * peoplePageSize, peoplePage * peoplePageSize).map(person => person.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPeople.has(id));
      const result = root.querySelector('[data-people-results]');
      if (!result) return;
      result.innerHTML = `<div class="fp-people-toolbar"><div class="fp-people-selection"><label><input type="checkbox" data-people-check-all ${allVisibleSelected ? 'checked' : ''} ${visibleIds.length ? '' : 'disabled'}> 全选本页</label><span><strong>${filtered.length}</strong> 名匹配人员${selectedCount ? ` · 已选 ${selectedCount} 名` : ''}</span></div><div class="fp-actions"><button type="button" class="btn" data-action="people-enable-selected" ${selectedCount ? '' : 'disabled'}>批量启用</button><button type="button" class="btn btn--danger" data-action="people-disable-selected" ${selectedCount ? '' : 'disabled'}>批量停用</button><button type="button" class="btn" data-action="people-clear-selection" ${selectedCount ? '' : 'disabled'}>清除选择</button></div></div>${F.table([{ label: '人员' }, '邮箱', '手机号', '角色', '账号状态', '最近登录', '操作'], rows, { id: 'people-management-table', caption: '人员与账号列表', emptyMessage: '没有符合条件的人员，请调整搜索或筛选条件。', emptyTitle: filtered.length ? '未找到人员' : '暂无人员', countLabel: '名人员', totalCount: state.people.length })}<nav class="fp-people-pagination" aria-label="人员列表分页"><span>第 ${peoplePage} / ${pageCount} 页</span><div class="fp-actions"><button type="button" class="btn" data-action="people-page" data-value="prev" ${peoplePage <= 1 ? 'disabled' : ''}>上一页</button><button type="button" class="btn" data-action="people-page" data-value="next" ${peoplePage >= pageCount ? 'disabled' : ''}>下一页</button></div></nav>`;
      const selectAll = result.querySelector('[data-people-check-all]');
      if (selectAll) selectAll.checked = allVisibleSelected;
      result.querySelectorAll('[data-people-check]').forEach(input => input.addEventListener('change', event => {
        if (event.target.checked) selectedPeople.add(event.target.dataset.peopleCheck); else selectedPeople.delete(event.target.dataset.peopleCheck);
        renderPeopleResults();
      }));
      result.querySelector('[data-people-check-all]')?.addEventListener('change', event => {
        visibleIds.forEach(id => event.target.checked ? selectedPeople.add(id) : selectedPeople.delete(id));
        renderPeopleResults();
      });
    }
    /**
     * R16 改造后的 OpenClaw 页签：专属 Agent 表从 aiDocs.releases 派生逐销售「当前加载版本 / 生效状态」。
     * 场景指引编辑表单与假沙盒按钮已退役（保存即生效、无验证门禁，与 R16 口径冲突）；
     * 文档维护迁至「AI 能力运营」页，本页只读展示运行状态并保留健康状态抽屉。config.guidance 字段保留兼容但不再提供编辑入口。
     */
    function renderOpenclaw(state) {
      const aiDocs = state.aiDocs || { documents: [], releases: [] };
      const guide = aiDocs.documents.find(d => d.managed && d.scope === 'global');
      const salesIds = [...new Set(aiDocs.releases.flatMap(r => (r.targets || []).map(t => t.sales)))];
      const rows = salesIds.map(sales => {
        const person = state.people.find(p => p.id === sales);
        if (!person) return '';
        // 逐文档加载状态：已加载生效 / 已送达未加载（回退最近成功版本）/ 同步失败，分别标注，不把旧版伪装成新版。
        const docStates = aiDocs.documents.filter(d => d.managed).map(doc => {
          const latest = aiDocs.releases.filter(r => r.docId === doc.id).find(r => (r.targets || []).some(t => t.sales === sales));
          const target = latest?.targets.find(t => t.sales === sales);
          if (!target) return null;
          if (target.deliver === 'failed') return { label: `${doc.name} ${latest.version} 同步失败`, tone: 'red' };
          if (!target.loaded) return { label: `${doc.name} ${latest.version} 已送达 · 未加载新版 · 继续使用 ${target.loadedVersion || '上一成功版本'}`, tone: 'amber' };
          return { label: `${doc.name} ${latest.version} 已生效`, tone: 'green' };
        }).filter(Boolean);
        const effective = guide ? F.aiDocEffectiveFor(state, guide.id, sales) : null;
        const summary = docStates.some(d => d.tone === 'red') ? ['部分同步失败', 'red'] : docStates.some(d => d.tone === 'amber') ? ['部分未加载新版', 'amber'] : ['已生效', 'green'];
        return `<tr data-agent-row="${e(sales)}"><td class="mono">sales-${e(sales.toLowerCase())}</td><td>${e(person.name)}</td><td class="mono">${e(effective ? `${guide.name} ${effective.version}` : '—')}</td><td>${F.badge(summary[0], summary[1])}${docStates.filter(d => d.tone !== 'green').map(d => `<small>${e(d.label)}</small>`).join('')}</td><td>App / 飞书</td></tr>`;
      }).filter(Boolean);
      return `<div class="fp-stack"><div class="fp-title"><div><h2>OpenClaw 控制面</h2><p>专属 Agent、路由绑定、能力与运行状态。</p></div>${F.badge('运行正常 · 演示', 'green')}</div>${F.table(['专属 Agent', '归属销售', '当前加载版本', '生效状态', '会话路由'], rows, { caption: 'OpenClaw 专属 Agent 运行与路由状态', emptyMessage: '当前没有已配置的销售专属 Agent。', countLabel: '个 Agent', compact: true })}<div class="fp-callout">当前生效版本 ${e(guide?.versions[0]?.version || '—')} · 文档维护已迁至 AI 能力运营。场景指引的接管、分权填写、沙盒验证与逐销售发布统一在新页面完成，本页只读展示逐销售加载状态。</div><div class="fp-actions"><a class="btn btn--primary" href="${F.link('ai-capability')}">前往 AI 能力运营</a>${F.button('查看健康状态', 'health')}</div></div>`;
    }
    function draw() {
      const s = F.load(), c = s.config;
      const operationTitle = tab === 'people' ? '人员管理' : '运营配置';
      const operationCrumb = document.querySelector('.sc-crumb__cur');
      if (operationCrumb) operationCrumb.textContent = operationTitle;
      document.title = operationTitle + ' · 销售指挥官 V0.2';
      document.querySelector('.sc-content')?.setAttribute('aria-label', operationTitle);
      document.querySelectorAll('#sc-navigation [data-menu]').forEach(item => {
        const active = item.dataset.menu === (tab === 'people' ? 'people-management' : 'operations-config');
        item.classList.toggle('is-active', active);
        if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
      });
      root.innerHTML = `<section class="fp-panel">${F.tabs(options, tab)}<div class="fp-pad" data-settings></div></section>`;
      const target = root.querySelector('[data-settings]');
      if (tab === 'model') target.innerHTML = `<form class="fp-form"><div class="fp-title"><div><h2>业务模型</h2><p>模型名称、服务地址与生成参数。</p></div>${F.badge('演示配置', 'brand')}</div><div class="fp-config-grid">${F.field('配置名称 *', 'model', c.model)}${F.field('服务提供方', 'provider', c.provider, 'select', ['OpenAI compatible', 'Azure OpenAI', '本地推理服务'])}${F.field('API Base URL *', 'endpoint', c.endpoint, 'url')}${F.field('Temperature（0～2）', 'temperature', c.temperature, 'number')}</div><div class="fp-readonly">凭据由服务端管理。当前页面不包含真实 API Key。</div><p class="fp-error" role="alert"></p><div class="fp-actions"><button type="submit" class="btn btn--primary">保存配置</button>${F.button('检查配置格式', 'check-model')}</div></form>`;
      if (tab === 'crm') {
        target.innerHTML = renderCrm(s);
        // 对应关系表的搜索与筛选状态保存在页面闭包内，切换分面后回来仍保持。
        F.restoreSearch(target, mapQuery);
        F.handleSearch(target, values => { mapQuery = values; draw(); });
      }
      if (tab === 'notify') {
        target.innerHTML = `<div class="fp-stack">${notifySubnav()}${notifyView === 'delivery' ? renderNotifyDelivery(s) : renderNotifyEvents(s)}</div>`;
        F.restoreSearch(target, notifyQuery);
        F.handleSearch(target, values => { notifyQuery = values; draw(); });
      }
      if (tab === 'daily') {
        target.innerHTML = `<div class="fp-stack">${dailySubnav()}${dailyView === 'prompts' ? renderDailyPrompts(s) : dailyView === 'settings' ? renderDailySettings(s) : renderDailyRuns(s)}</div>`;
        target.querySelector('[data-daily-settings]')?.addEventListener('submit', event => {
          event.preventDefault();
          const form = event.currentTarget;
          try { F.setDailyReportTime(form.elements.globalTime.value); draw(); SC.toast('全局产出时间已保存，下一自然日生效。', 'ok'); }
          catch (error) { form.querySelector('.fp-error').textContent = error.message; }
        });
      }
      if (tab === 'openclaw') target.innerHTML = renderOpenclaw(s);
      if (tab === 'pools') {
        const meta = s.assignmentMeta || {};
        const poolRows = s.people.filter(p => p.role === 'SOL').map(p => {
          const scope = s.assignments[p.id] || [];
          const record = meta[p.id] || {};
          const delta = [...(record.added || []).map(pool => `新增 ${pool}`), ...(record.removed || []).map(pool => `移除 ${pool}`)];
          return `<tr data-pool-row data-person="${e(p.id)}"><td><strong>${e(p.name)}</strong><small>${e(p.id)}</small></td><td data-pool-scope>${scope.map(pool => F.badge(pool, 'brand')).join(' ') || F.badge('未配置，无空间可进', 'amber')}</td><td>${s.spaces.filter(w => scope.includes(w.pool)).length}</td><td data-pool-updated>${e(record.updatedAt || '尚未调整')}</td><td data-pool-delta>${delta.length ? `${e(delta.join('；'))}<small>下一次读取生效</small>` : '<span class="u-t3">无待生效变更</span>'}</td><td>${F.button('配置承接池', 'pools', p.id)}</td></tr>`;
        });
        target.innerHTML = `<div class="fp-stack"><h2>解决方案人员的承接客户池</h2><div class="fp-callout">客户池取自 CRM 已同步数据，可逐项多选，不提供“全部”选项；需要全量阅读请走销售运营角色。调整保存后按新范围判定，旧池不保留访问权，已打开页面在提交时会再次校验。</div>${F.table(['解决方案人员', '当前生效范围', '可见空间', '最后更新时间', '变更提示', '操作'], poolRows, { caption: '解决方案人员承接客户池配置', emptyMessage: '当前没有可配置承接客户池的解决方案人员。', countLabel: '位方案人员', compact: true })}<p class="fp-hint">客户池名称来自同步数据，本地不创建或指定客户归属池。</p></div>`;
      }
      if (tab === 'people') drawPeople(target);
      if (tab === 'model') target.querySelector('form')?.addEventListener('submit', event => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
        try {
          validateModel(values);
          F.mutate('保存模型配置', s => { Object.assign(s.config, values); });
          draw(); SC.toast('已保存本地配置', 'ok');
        } catch (error) { target.querySelector('.fp-error').textContent = error.message; }
      });
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        tab = b.dataset.tab;
        const url = new URL(location.href);
        url.searchParams.set('tab', tab);
        history.replaceState({}, '', url.href);
        draw();
      });
    }
    function validateModel(v) {
      if (!v.model.trim()) throw Error('请填写配置名称。');
      let url; try { url = new URL(v.endpoint); } catch (_) { throw Error('请填写有效的服务地址。'); }
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('服务地址需使用 HTTP 或 HTTPS。');
      if (v.temperature === '' || !Number.isFinite(Number(v.temperature)) || Number(v.temperature) < 0 || Number(v.temperature) > 2) throw Error('Temperature 必须为 0～2。');
    }
    F.bind(root, {
      'check-model': () => { validateModel(Object.fromEntries(new FormData(root.querySelector('form')))); SC.toast('配置格式有效；未发起网络连接。', 'ok'); },
      'people-new': () => peopleForm(),
      'people-edit': id => peopleForm(id),
      'people-detail': id => personDetail(id),
      'people-reset': id => resetPassword(id),
      'people-toggle': id => {
        const person = F.load().people.find(item => item.id === id);
        if (!person) throw Error('人员不存在，请刷新列表后重试。');
        if (person.status === 'on') disablePeople([id]);
        else {
          F.mutate('启用人员账号', state => {
            const target = state.people.find(item => item.id === id);
            if (!target) throw Error('人员不存在，请刷新列表后重试。');
            target.status = 'on';
          });
          draw(); SC.toast('账号已启用。', 'ok');
        }
      },
      'people-enable-selected': () => {
        const ids = [...selectedPeople];
        if (!ids.length) return;
        F.mutate('批量启用人员账号', state => ids.forEach(id => { const person = state.people.find(item => item.id === id); if (person) person.status = 'on'; }));
        selectedPeople.clear(); draw(); SC.toast(`已启用 ${ids.length} 个账号。`, 'ok');
      },
      'people-disable-selected': () => disablePeople([...selectedPeople]),
      'people-clear-selection': () => { selectedPeople.clear(); renderPeopleResults(); },
      'people-page': direction => { peoplePage += direction === 'next' ? 1 : -1; renderPeopleResults(); },
      'people-export': () => {
        const state = F.load();
        F.download('人员与账号.csv', F.csv([['人员 ID', '姓名', '邮箱', '手机号', '角色', '账号状态', '创建时间', '最近登录'], ...state.people.map(person => [person.id, person.name, person.email, person.mobile || '', roleLabel(person.role), statusLabel(person.status), person.createdAt, person.lastLoginAt])]));
        SC.toast('已导出当前人员列表。', 'ok');
      },
      'crm-view': view => { crmView = crmViews.some(([key]) => key === view) ? view : 'overview'; const url = new URL(location.href); url.searchParams.set('crmView', crmView); history.replaceState({}, '', url.href); draw(); },
      'crm-history': () => { crmView = 'history'; draw(); },
      'crm-sync': () => { F.startCrmSync(); draw(); SC.toast('CRM 即时对齐已完成，本轮未重复生成变化。', 'ok'); },
      'xbb-open': () => openXbbDrawer(),
      'crm-map-accept': id => openSuggestionConfirm(id),
      'crm-map-change': crmId => openMappingForm('', crmId),
      'crm-map-impact': crmId => openMappingImpact(crmId),
      'crm-map-only-pending': () => { mapQuery = { ...mapQuery, mapStatus: mapQuery.mapStatus === 'pending' ? '' : 'pending' }; draw(); },
      // 详情在行内第二层展开：默认行只放决策必需信息，依据 / 部门 / 影响拆解按下再展开。
      'crm-map-detail': crmId => {
        const row = document.querySelector(`[data-crm-map-detail-row="${crmId}"]`);
        const trigger = document.querySelector(`[data-action="crm-map-detail"][data-value="${crmId}"]`);
        if (!row) return;
        const open = row.hasAttribute('hidden');
        if (open) row.removeAttribute('hidden'); else row.setAttribute('hidden', '');
        trigger?.setAttribute('aria-expanded', String(open));
        // 行上下文取自控件自身：CRM 人员 ID 属外部事实，不能用本地人员字典反查。
        trigger?.setAttribute('aria-label', (open ? '收起详情：' : '详情：') + (trigger.dataset.crmName || crmId));
        (trigger?.closest('tr') || trigger)?.classList.toggle('is-expanded', open);
      },
      'crm-map-export': () => {
        const rows = (F.load().crm?.mappings || []).map(row => [row.crmId, row.crmName, row.crmDept || '', row.ownerId ? `${F.name(row.ownerId)}（${row.ownerId}）` : '未对应', (mappingModeLabels[row.mode] || mappingModeLabels.none)[0], row.matchedAt || '', row.customerCount || 0, row.opportunityCount || 0]);
        F.download('CRM人员与系统账号对应关系.csv', F.csv([['CRM ID', 'CRM 姓名', 'CRM 部门', '系统账号', '对应方式', '对应时间', '涉及客户', '涉及商机'], ...rows]));
        SC.toast('已导出当前对应关系。', 'ok');
      },
      'crm-batch': () => openCrmBatch(),
      'crm-map': id => openMappingForm(id),
      mapping: id => openMappingForm(id || 'MAP-203'),
      'crm-impact': id => {
        const mapping = F.load().crm.pendingMappings.find(item => item.id === id);
        if (mapping) F.drawer('待对应影响范围', `<div class="fp-stack"><div class="fp-callout">${e(mapping.crmName)} 尚未对应系统销售，不会生成个人确权，也不会影响其他已对应销售。</div><dl class="fp-kv"><dt>客户</dt><dd>${e(mapping.customer)}</dd><dt>商机</dt><dd>${e(mapping.opportunity)}</dd><dt>首次发现</dt><dd>${e(mapping.discoveredAt)}</dd><dt>处理建议</dt><dd>先在 CRM 或本页面完成人员对应，再由下一次同步补建确权。</dd></dl></div>`);
      },
      'crm-retry': id => { F.retryAlignmentError(id); draw(); SC.toast('该条对齐异常已恢复，其他条目未受影响。', 'ok'); },
      'crm-error-detail': id => {
        const item = F.load().crm.alignmentErrors.find(error => error.id === id);
        if (item) F.drawer('对齐异常 · ' + item.id, `<div class="fp-stack"><div class="fp-callout fp-callout--warn">${e(item.reason)}</div><dl class="fp-kv"><dt>客户 / 商机</dt><dd>${e(item.customer)} / ${e(item.opportunity)}</dd><dt>CRM 人员</dt><dd>${e(item.crmName)}</dd><dt>失败环节</dt><dd>${e(item.stage)}</dd><dt>发生时间</dt><dd>${e(item.occurredAt)}</dd><dt>重试次数</dt><dd>${e(item.retryCount || 0)} 次</dd><dt>当前状态</dt><dd>${F.badge(crmStatusLabel(item.status), item.status === 'resolved' ? 'green' : 'amber')}</dd></dl></div>`);
      },
      'crm-history-detail': id => openHistoryDetail(id),
      'notify-view': view => { notifyView = view; const url = new URL(location.href); url.searchParams.set('notifyView', view); history.replaceState({}, '', url.href); draw(); },
      'daily-view': view => { dailyView = view; const url = new URL(location.href); url.searchParams.set('dailyView', view); history.replaceState({}, '', url.href); draw(); },
      'daily-run': () => { const report = F.runDailyReport(); draw(); SC.toast(report?.status === 'empty' ? '当日无有效变化，仅保留运行记录。' : report?.status === 'failed' ? '当日日报全部客户生成失败，已发送一次失败提醒。' : '当日日报已生成并送达接收人。', 'ok'); },
      'daily-detail': id => openDailyRunDetail(id),
      'daily-retry': id => { const result = F.retryDailyReportFailures(id); draw(); SC.toast(result?.recovered ? `已恢复 ${result.recovered} 个失败客户，前次失败记录已保留。` : '同窗口仍无最新成功结果，前次失败记录已保留。', result?.recovered ? 'ok' : 'bad'); },
      'daily-prompt-edit': key => {
        const config = F.load().dailyReportConfig;
        const prompt = config.prompts?.[key];
        if (!prompt) return;
        const active = (config.versions || []).find(item => item.status === 'active');
        F.form((prompt.draft ? '编辑草稿' : '新建草稿') + ' · ' + prompt.label,
          `<div class="fp-callout">保存只是草稿，不影响线上；四份提示词作为一个完整版本发布，从下一自然日运行开始生效。</div>${F.field('提示词正文 *', 'body', prompt.draft?.body || active?.prompts?.[key] || '', 'textarea')}`,
          values => F.saveDailyPrompt(key, values.body), draw, '保存草稿');
      },
      'daily-trial': key => openDailyTrial(key),
      'daily-publish': () => { F.publishDailyPrompts(); draw(); SC.toast('已发布完整版本，下一自然日起生效；当天已生成日报不变。', 'ok'); },
      'daily-rollback': () => { F.rollbackDailyPrompts(); draw(); SC.toast('已回退到上一完整生效版，下一自然日起生效。', 'ok'); },
      health: () => F.drawer('运行健康状态', F.table(['检查项', '演示结果'], ['Gateway', 'MCP 服务', '空间权限读取', '文档加载'].map(x => `<tr><td>${x}</td><td>${F.badge('正常', 'green')}</td></tr>`), { caption: 'OpenClaw 运行健康检查结果', emptyMessage: '当前没有可用的健康检查结果。', countLabel: '项检查', compact: true }) + '<p class="fp-hint u-mt3">以上为本地演示快照，不代表实时服务状态。</p>'),
      pools: id => {
        const s = F.load();
        const before = s.assignments[id] || [];
        F.form('配置承接池 · ' + F.name(id), `<fieldset class="fp-checks"><legend>逐项选择承接客户池</legend>${s.pools.map(pool => `<label><input type="checkbox" name="pools" value="${e(pool)}" ${before.includes(pool) ? 'checked' : ''}>${e(pool)}</label>`).join('')}</fieldset><p class="fp-hint">未勾选任何池时，此人不再拥有客户池下的空间访问权。保存后按新范围判定，下一次读取生效；同一池重复勾选只保留一个有效授权。</p>`, (_v, mask) => F.mutate('调整解决方案人员承接池', s => {
          if (F.role !== 'ADM') throw Error('仅超级管理员可以配置承接池。');
          const next = [...new Set([...mask.querySelectorAll('[name=pools]:checked')].map(n => n.value))].filter(p => s.pools.includes(p));
          const previous = s.assignments[id] || [];
          s.assignments[id] = next;
          s.assignmentMeta = s.assignmentMeta || {};
          s.assignmentMeta[id] = { updatedAt: F.now(), added: next.filter(pool => !previous.includes(pool)), removed: previous.filter(pool => !next.includes(pool)) };
        }), draw);
      }
    });
    draw();
  };
  F.views['product-library'] = function (root) {
    let query = {};
    function draw() {
      root.innerHTML = F.panel('产品知识', F.searchbar('搜索产品名称', F.field('状态', 'status', '', 'select', [['', '全部状态'], '已发布', '草稿'])) + '<div data-products></div>', F.role === 'ADM' ? F.button('新建产品', 'new', '', true) : '');
      filter(query); F.handleSearch(root, filter);
    }
    function filter(q = {}) {
      query = q; F.restoreSearch(root, q);
      const products = F.load().products.filter(p => (!q.q || p.name.includes(q.q.trim())) && (!q.status || p.status === q.status));
      root.querySelector('[data-products]').innerHTML = F.table(['产品', '分类', '产品介绍', '状态', '操作'], products.map(p => `<tr><td><strong>${e(p.name)}</strong><small>${p.id}</small></td><td>${e(p.category)}</td><td>${e(p.description)}</td><td>${F.badge(p.status, p.status === '已发布' ? 'green' : 'neutral')}</td><td>${F.button('查看资料', 'detail', p.id)}</td></tr>`), { caption: '产品知识资料清单', emptyMessage: '没有符合条件的产品资料，请调整产品名称或状态筛选。', countLabel: '项产品', totalCount: F.load().products.length });
    }
    function edit(id) {
      const p = F.load().products.find(p => p.id === id) || { name: '', category: '通信服务', description: '', faq: '', status: '草稿' };
      F.form(id ? '编辑产品资料' : '新建产品', F.field('产品名称 *', 'name', p.name) + F.field('分类', 'category', p.category) + F.field('产品介绍 *', 'description', p.description, 'textarea') + F.field('常见问题', 'faq', p.faq, 'textarea') + F.field('状态', 'status', p.status, 'select', ['草稿', '已发布']), v => {
        if (!v.name.trim() || !v.description.trim()) throw Error('请填写名称和产品介绍。');
        F.mutate('保存产品知识', s => { if (F.role !== 'ADM') throw Error('仅超级管理员可以编辑产品。'); const product = s.products.find(p => p.id === id); if (product) Object.assign(product, v); else s.products.unshift({ id: F.uid('P'), ...v }); });
      }, draw);
    }
    F.bind(root, { new: () => edit(), detail: id => {
      const p = F.load().products.find(p => p.id === id);
      F.drawer(p.name, `<div class="fp-stack"><div class="fp-actions">${F.badge(p.category, 'brand')}${F.badge(p.status, 'green')}</div><h3>产品介绍</h3><p>${e(p.description)}</p><h3>常见问题</h3><div class="fp-callout">${e(p.faq || '尚未补充')}</div>${F.role === 'ADM' ? F.button('编辑资料', 'edit', id, true) : ''}</div>`, (mask, close) => F.bind(mask, { edit: () => { close(); edit(id); } }));
    } });
    draw();
  };

  /* ---------- R16 AI 文档与能力可运营化 ---------- */

  /**
   * AI 能力运营页：文档接管与正文维护（docs）、填写模块（modules）、SkillHub 清单（skills）、
   * 沙盒验证（sandbox）、发布与版本（publish）五个二级分面，URL 参数 tab 直达。
   * 超管维护正文与模块配置；销售运营只填写授权模块；发布必须经沙盒验证通过，逐销售展示送达 / 已加载 / 已生效。
   */
  F.views['ai-capability'] = function (root) {
    const tabs = [['docs', '文档与接管'], ['modules', '填写模块'], ['skills', 'SkillHub'], ['sandbox', '验证中心'], ['publish', '发布与版本']];
    let tab = SC.param('tab') || 'docs';
    if (!tabs.some(([key]) => key === tab)) tab = 'docs';

    const skillStatusMeta = { available: ['可用', 'green'], unavailable: ['不可用', 'amber'], unknown: ['暂无法核实', 'neutral'] };
    const verdictMeta = { pending: ['验证中', 'brand'], passed: ['已通过', 'green'], failed: ['未通过', 'red'], adjust: ['需要调整', 'amber'], stale: ['已作废', 'neutral'] };
    const kindMeta = { edit: '编辑', sync: '同步', restore: '恢复' };
    const judgeMeta = { pass: ['通过', 'green'], fail: ['不通过', 'red'], adjust: ['需要调整', 'amber'] };
    const docName = (state, id) => state.aiDocs.documents.find(d => d.id === id)?.name || id;
    const skillName = (state, id) => state.aiDocs.skills.find(s => s.id === id)?.name || id;
    // 模块与章节统一取「草稿优先」的内容源，保证配置页、填写页与预览看到的是同一份待发布内容。
    const docContent = doc => doc.draft || { sections: doc.sections, modules: doc.modules };

    /** docs 分面：回传清单 + 接管 + 差异对照 + 正文编辑；未接管文档只读且不进入同步，正文编辑仅超管可见。 */
    function renderDocs(target, state) {
      const docs = F.aiDocList(state);
      const managed = docs.filter(d => d.managed).length;
      const conflicts = docs.filter(d => d.conflict === 'remote_newer').length;
      const guide = docs.find(d => d.managed && d.scope === 'global');
      const rows = docs.map(doc => {
        const latest = doc.latestRelease;
        const syncCell = !doc.managed ? F.badge('不进入同步', 'neutral') : latest ? (() => {
          const ok = latest.targets.filter(t => t.effective).length;
          const notLoaded = latest.targets.filter(t => t.deliver === 'success' && !t.loaded).length;
          const failed = latest.targets.filter(t => t.deliver === 'failed').length;
          return `${F.badge(`${latest.version} · 已生效 ${ok}/${latest.targets.length}`, failed ? 'red' : notLoaded ? 'amber' : 'green')}${notLoaded ? `<small>未加载 ${notLoaded}</small>` : ''}${failed ? `<small>失败 ${failed}</small>` : ''}`;
        })() : F.badge('尚未发布', 'neutral');
        const actions = [
          F.button('查看', 'doc-view', doc.id),
          !doc.managed && F.role === 'ADM' ? F.button('接管', 'doc-takeover', doc.id, true) : '',
          F.button('核对差异', 'doc-diff', doc.id),
          doc.managed && F.role === 'ADM' ? F.button('编辑正文', 'doc-edit', doc.id) : ''
        ].join('');
        return `<tr data-doc-row="${e(doc.id)}"><td><strong>${e(doc.name)}</strong><small>${e(doc.file || '')} · ${doc.scope === 'global' ? '全部销售' : '所属销售 ' + e(F.name(doc.sales))} · 回传 ${e(doc.remote?.at || '—')}</small></td><td>${doc.managed ? F.badge('已接管', 'green') : F.badge('未接管 · 只读', 'neutral')}${doc.conflict === 'remote_newer' ? ' ' + F.badge('回传版本较新 · 待核对', 'amber') : ''}</td><td class="mono">${e(doc.localVersion || '—')}${doc.draft ? `<small>草稿 ${e(doc.draft.version)}</small>` : ''}</td><td class="mono">${e(doc.remote?.version || '—')}</td><td>${syncCell}</td><td>${actions}</td></tr>`;
      });
      target.innerHTML = `<div class="fp-stack">${F.metrics([['已接管', managed, '本系统为唯一编辑入口'], ['未接管', docs.length - managed, '只读查看 · 不进入同步'], ['待核对冲突', conflicts, '回传版本晚于本地'], ['当前生效版本', guide?.localVersion || '—', guide?.name || '全局文档']])}<div class="fp-callout">回传只用于首次接管与差异核对，不静默覆盖本地修改；保存草稿不等于发布，发布前必须完成沙盒验证。</div><section class="fp-panel"><header class="fp-panel-head"><div><h2>回传文档清单</h2><p class="fp-hint">文档名称、来源、回传时间、接管状态与同步状态；未接管文档只读。</p></div></header><div data-doc-list>${F.table(['文档', '接管状态', '本地版本', '回传版本', '同步状态', '操作'], rows, { caption: 'OpenClaw 回传文档清单', emptyMessage: '暂无回传文档。', countLabel: '份文档' })}</div></section></div>`;
    }

    /** 查看抽屉：回传全文与本地内容分开展示；未接管文档只读并提示不进入同步。 */
    function openDocView(docId) {
      const state = F.load();
      const doc = state.aiDocs.documents.find(d => d.id === docId);
      if (!doc) return;
      F.drawer('文档详情 · ' + doc.name, `<div class="fp-stack" data-doc-view>
        ${doc.managed ? '' : '<div class="fp-callout fp-callout--warn">该文档未接管：只读查看与差异提示，不进入生产同步，也不显示为已托管。</div>'}
        ${doc.conflict === 'remote_newer' ? '<div class="fp-callout fp-callout--warn">回传版本晚于本地版本：本地未发布版本已保留，请人工核对后再决定是否接收。</div>' : ''}
        <dl class="fp-kv"><dt>来源</dt><dd>OpenClaw 回传 · ${e(doc.remote?.at || '—')} · ${e(doc.remote?.version || '—')}</dd><dt>适用范围</dt><dd>${doc.scope === 'global' ? '全部销售' : '所属销售 ' + e(F.name(doc.sales))}</dd><dt>接管状态</dt><dd>${doc.managed ? `已接管（${e(doc.managedAt)} · ${e(F.name(doc.managedBy))}）` : '未接管'}</dd></dl>
        <h3>回传全文</h3><div class="fp-transcript">${e(doc.remote?.body || '（无回传内容）')}</div>
        ${doc.managed ? `<h3>本地当前内容（含未发布草稿）</h3><div class="fp-transcript">${e(F.previewDoc(docId, true, state))}</div>` : ''}
      </div>`);
    }

    /** 差异抽屉：回传 vs 本地行级对照；存在冲突时超管可选择保留本地或接收回传（接收回传生成新草稿，仍需验证）。 */
    function openDocDiff(docId) {
      const state = F.load();
      const doc = state.aiDocs.documents.find(d => d.id === docId);
      if (!doc) return;
      const diff = F.diffDoc(docId, state);
      const rows = diff.rows.map(row => `<tr><td>${F.badge(row.type === 'remote' ? '回传有 · 本地无' : '本地有 · 回传无', row.type === 'remote' ? 'amber' : 'brand')}</td><td>${e(row.text)}</td></tr>`);
      F.drawer('差异对照 · ' + doc.name, `<div class="fp-stack" data-doc-diff>
        <dl class="fp-kv"><dt>回传版本</dt><dd class="mono">${e(diff.remoteVersion || '—')} · ${e(diff.remoteAt || '—')}</dd><dt>本地版本</dt><dd class="mono">${e(diff.localVersion)}</dd></dl>
        ${doc.conflict === 'remote_newer' ? '<div class="fp-callout fp-callout--warn">回传版本晚于本地版本，本地未发布版本已保留；请核对差异后选择处理方式，系统不会自动用回传覆盖本地。</div>' : '<div class="fp-callout">回传不静默覆盖本地修改；差异仅供人工核对。</div>'}
        ${diff.rows.length ? F.table(['差异方向', '内容'], rows, { caption: '回传与本地差异对照', emptyMessage: '两侧内容一致。', countLabel: '行差异', compact: true }) : '<div class="fp-callout">两侧内容一致，无差异。</div>'}
        ${doc.conflict === 'remote_newer' && F.role === 'ADM' ? `<div class="fp-actions">${F.button('保留本地版本', 'doc-resolve', docId + '|local', true)}${F.button('接收回传版本', 'doc-resolve', docId + '|remote')}</div><p class="fp-hint">接收回传会生成新草稿，仍需沙盒验证后才能发布。</p>` : ''}
      </div>`, (mask, close) => F.bind(mask, { 'doc-resolve': value => { const [id, keep] = value.split('|'); F.resolveDocConflict(id, keep); close(); draw(); SC.toast(keep === 'local' ? '已保留本地版本，冲突标记已核对。' : '已按回传内容生成新草稿，需重新验证后发布。', 'ok'); } }));
    }

    /** 正文编辑抽屉（仅超管）：按章节编辑，保存为新版本草稿；所基于版本不一致时阻止保存，不静默覆盖他人改动。 */
    function openDocEdit(docId) {
      const state = F.load();
      const doc = state.aiDocs.documents.find(d => d.id === docId);
      if (!doc || !doc.managed) return;
      const source = doc.draft || { sections: doc.sections, baseVersion: doc.versions[0]?.version || '' };
      F.drawer('编辑正文 · ' + doc.name, `<form class="fp-form" data-doc-body-form>
        <div class="fp-callout">保存为新版本草稿，不触发生产；发布前必须完成沙盒验证。局部修改保留未改内容；他人已保存新草稿时会提示所基于内容已变化。</div>
        ${source.sections.map((s, i) => `<fieldset class="fp-checks"><legend>章节 ${i + 1}</legend>${F.field('章节标题', 'title-' + (s.id || i), s.title)}${F.field('章节正文', 'body-' + (s.id || i), s.body, 'textarea')}</fieldset>`).join('')}
        <p class="fp-error" role="alert"></p>
        <footer class="fp-form-foot"><span class="u-t3">基于版本 ${e(source.baseVersion || doc.versions[0]?.version || '—')}</span><button type="submit" class="btn btn--primary">保存草稿</button></footer>
      </form>`, (mask, close) => {
        mask.querySelector('form').onsubmit = event => {
          event.preventDefault();
          const form = event.currentTarget;
          try {
            const sections = source.sections.map((s, i) => ({ id: s.id, title: form.elements['title-' + (s.id || i)].value, body: form.elements['body-' + (s.id || i)].value }));
            F.saveDocBody(docId, sections, source.baseVersion || doc.versions[0]?.version || '');
            close(); draw(); SC.toast('正文草稿已保存，发布前需完成沙盒验证。', 'ok');
          } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
        };
      });
    }

    /** 实际文档预览抽屉：正文 + 填写内容 + skill 调用场景说明；模块名称与填写说明不进入。 */
    function openDocPreview(docId) {
      const state = F.load();
      const doc = state.aiDocs.documents.find(d => d.id === docId);
      if (!doc) return;
      F.drawer('实际文档预览 · ' + doc.name, `<div class="fp-stack" data-doc-preview>
        <div class="fp-callout">实际文档 = 正文 + 填写内容 + skill 调用场景说明；模块名称与填写说明不进入。预览基于当前已保存草稿。</div>
        <div class="fp-transcript">${e(F.previewDoc(docId, true, state))}</div>
      </div>`);
    }

    /** modules 分面：超管见章节与模块配置；运营只见授权模块的待填写列表，未授权模块不显示也不返回内容。 */
    function renderModules(target, state) {
      const docs = state.aiDocs.documents.filter(d => d.managed);
      if (F.role === 'ADM') {
        const rows = docs.flatMap(doc => docContent(doc).modules.map(m => {
          const section = docContent(doc).sections.find(s => s.id === m.sectionId);
          return `<tr data-module-row="${e(m.id)}"><td><strong>${e(doc.name)}</strong><small>${e(section?.title || '—')}</small></td><td>${e(m.name)}</td><td>${e(m.instruction || '—')}</td><td>${e((m.assignees || []).map(id => F.name(id)).join('、') || '全部销售运营')}</td><td>${m.disabled ? F.badge('已停用 · 内容保留', 'neutral') : m.content ? F.badge('已填写', 'green') : F.badge('未填写', 'amber')}</td><td>${F.button('配置', 'module-config', doc.id + '|' + m.id)}${m.disabled ? '' : F.button('停用', 'module-disable', doc.id + '|' + m.id)}</td></tr>`;
        }));
        target.innerHTML = `<div class="fp-stack"><div class="fp-callout">在章节下创建填写模块并授权销售运营；模块名称与填写说明只用于管理页，不进入助手实际文档。停用模块保留已填内容，不静默丢失。</div><section class="fp-panel"><header class="fp-panel-head"><div><h2>模块配置</h2><p class="fp-hint">章节位置、模块名称、填写说明与授权范围。</p></div>${F.button('新建填写模块', 'module-config', '', true)}</header><div data-module-list>${F.table(['文档 / 章节', '模块', '填写说明', '授权运营', '填写状态', '操作'], rows, { caption: '填写模块配置清单', emptyMessage: '尚未配置填写模块。', countLabel: '个模块' })}</div></section></div>`;
      } else {
        const rows = docs.flatMap(doc => docContent(doc).modules.filter(m => F.aiDocModuleAuthorized(m, F.actor.id)).map(m => {
          const section = docContent(doc).sections.find(s => s.id === m.sectionId);
          return `<tr data-module-row="${e(m.id)}"><td><strong>${e(doc.name)}</strong><small>${e(section?.title || '—')}</small></td><td>${e(m.name)}</td><td>${e(m.instruction || '—')}</td><td>${m.content ? `${e(F.name(m.updatedBy))} · ${e(m.updatedAt)}` : '尚未填写'}</td><td>${F.button('填写', 'module-fill', doc.id + '|' + m.id, true)}${F.button('预览实际文档', 'doc-preview', doc.id)}</td></tr>`;
        }));
        target.innerHTML = `<div class="fp-stack"><div class="fp-callout">你只能填写被授权的模块；填写说明只在管理页显示，保存后不进入助手实际文档。保存只更新草稿，发布前需完成沙盒验证。</div><section class="fp-panel"><header class="fp-panel-head"><div><h2>待填写模块</h2><p class="fp-hint">未授权模块不显示编辑入口，也不返回内容。</p></div></header><div data-module-list>${F.table(['所属文档 / 章节', '模块', '填写说明', '最近保存', '操作'], rows, { caption: '待填写模块清单', emptyMessage: '当前没有授权给你的填写模块。', countLabel: '个模块' })}</div></section></div>`;
      }
    }

    /** 模块配置抽屉（仅超管）：新建或更新名称 / 说明 / 授权名单；授权名单为空表示全体销售运营。 */
    function openModuleConfig(value) {
      const [docId, moduleId] = (value || '').split('|');
      const state = F.load();
      const docs = state.aiDocs.documents.filter(d => d.managed);
      const doc = docs.find(d => d.id === docId) || docs[0];
      if (!doc) return;
      const content = docContent(doc);
      const module = moduleId ? content.modules.find(m => m.id === moduleId) : null;
      const mgrs = state.people.filter(p => p.role === 'MGR' && p.status === 'on');
      F.form(module ? '配置模块 · ' + module.name : '新建填写模块 · ' + doc.name, `<div class="fp-callout">模块名称与填写说明只用于管理页，不进入助手实际文档；授权名单为空表示全体销售运营可填写。</div>
        ${module ? '' : F.field('所属章节', 'sectionId', content.sections[0]?.id || '', 'select', content.sections.map(s => [s.id, s.title || s.id]))}
        ${F.field('模块名称 *', 'name', module?.name || '')}
        ${F.field('填写说明', 'instruction', module?.instruction || '', 'textarea')}
        <fieldset class="fp-checks"><legend>授权运营（不勾选表示全体销售运营）</legend>${mgrs.map(p => `<label><input type="checkbox" name="assignees" value="${e(p.id)}" ${(module?.assignees || []).includes(p.id) ? 'checked' : ''}><span><strong>${e(p.name)}</strong><small class="mono">${e(p.id)}</small></span></label>`).join('')}</fieldset>`,
        (values, mask) => {
          const assignees = [...mask.querySelectorAll('[name=assignees]:checked')].map(n => n.value);
          F.configureModule(doc.id, module ? module.sectionId : values.sectionId, { id: module?.id, name: values.name, instruction: values.instruction, assignees });
        }, draw, module ? '保存配置' : '创建模块');
    }

    /** 运营填写抽屉：填写说明 callout + 内容编辑 + skill 多选（每个引用一行场景说明）+ 实际文档预览。 */
    function openModuleFill(docId, moduleId) {
      const state = F.load();
      const doc = state.aiDocs.documents.find(d => d.id === docId);
      const module = doc ? docContent(doc).modules.find(m => m.id === moduleId) : null;
      if (!doc || !module) return;
      const skills = state.aiDocs.skills;
      F.drawer('填写模块 · ' + module.name, `<form class="fp-form" data-module-fill>
        <div class="fp-callout">填写说明：${e(module.instruction || '无')}<br>模块名称与填写说明只用于管理页，不进入助手实际文档。</div>
        ${F.field('填写内容', 'content', module.content || '', 'textarea')}
        <fieldset class="fp-checks"><legend>引用 skill（勾选后必填适用场景；引用是引导不是强制调用）</legend>${skills.map(skill => { const ref = (module.skillRefs || []).find(r => r.skillId === skill.id); const [label, tone] = skillStatusMeta[skill.status] || ['未知', 'neutral']; return `<label><input type="checkbox" name="skill" value="${e(skill.id)}" ${ref ? 'checked' : ''}><span><strong>${e(skill.name)}</strong> ${F.badge(label, tone)}<small>${e(skill.purpose)} · ${e(skill.version)}</small></span></label><input type="text" name="scenario-${e(skill.id)}" value="${e(ref?.scenario || '')}" placeholder="适用场景说明（勾选后必填）" aria-label="${e(skill.name)} 适用场景">`; }).join('')}</fieldset>
        <p class="fp-error" role="alert"></p>
        <footer class="fp-form-foot"><span class="u-t3">保存只更新草稿，发布前需重新验证</span><button type="submit" class="btn btn--primary">保存填写内容</button></footer>
      </form>
      <div class="fp-actions u-mt3">${F.button('预览实际文档', 'preview-doc', doc.id)}</div>`, (mask, close) => {
        mask.querySelector('form').onsubmit = event => {
          event.preventDefault();
          const form = event.currentTarget;
          try {
            const skillRefs = [...form.querySelectorAll('[name=skill]:checked')].map(node => ({ skillId: node.value, scenario: form.elements['scenario-' + node.value]?.value || '' }));
            F.fillModule(docId, moduleId, { content: form.elements.content.value, skillRefs });
            close(); draw(); SC.toast('填写内容已保存到草稿，说明不进入实际文档。', 'ok');
          } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
        };
        F.bind(mask, { 'preview-doc': id => openDocPreview(id) });
      });
    }

    /** skills 分面：能力清单三态 + 外部管理入口 + 失效引用提示；本系统只展示入口与指引，不重建外部内容库。 */
    function renderSkills(target, state) {
      const skills = state.aiDocs.skills;
      // 失效引用提示：定位引用 不可用 / 暂无法核实 skill 的模块，引导运营调整后重新验证。
      const broken = state.aiDocs.documents.flatMap(doc => docContent(doc).modules.flatMap(m => (m.skillRefs || []).map(ref => ({ doc, module: m, skill: skills.find(s => s.id === ref.skillId) })).filter(item => item.skill && item.skill.status !== 'available')));
      const rows = skills.map(skill => {
        const [label, tone] = skillStatusMeta[skill.status] || ['未知', 'neutral'];
        return `<tr data-skill-row="${e(skill.id)}"><td><strong>${e(skill.name)}</strong><small class="mono">${e(skill.id)}</small></td><td>${e(skill.type)}</td><td class="mono">${e(skill.version)}</td><td>${e(skill.purpose)}</td><td>${F.badge(label, tone)}</td><td>${e(skill.updatedAt || '—')}</td><td><a href="${e(skill.manageUrl)}" target="_blank" rel="noreferrer">外部管理入口</a></td><td>${F.button('标记状态', 'skill-mark', skill.id)}${F.button('编辑', 'skill-edit', skill.id)}</td></tr>`;
      });
      target.innerHTML = `<div class="fp-stack">
        <div class="fp-callout">skill 与素材由外部 SkillHub 承载，本系统只展示清单、可用状态与管理入口，不重建内容库；销售侧无管理入口。访问失败不等于已删除（暂无法核实）。</div>
        ${broken.length ? `<div class="fp-callout fp-callout--warn" data-skill-broken>失效引用提示：${broken.map(item => `「${e(item.skill.name)}」被 ${e(item.doc.name)} / ${e(item.module.name)} 引用（${e(item.skill.status === 'unavailable' ? '不可用' : '暂无法核实')}）`).join('；')}。请调整引用后重新验证发布。</div>` : '<div class="fp-callout" data-skill-broken>当前没有失效或待核实的引用。</div>'}
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>能力清单</h2><p class="fp-hint">名称、类型、版本、用途、可用状态与管理入口；清单加载失败时保留已选引用并提示刷新。</p></div>${F.button('新增 skill / 素材', 'skill-edit', '', true)}</header><div data-skill-list>${F.table(['名称', '类型', '版本', '用途', '可用状态', '更新时间', '管理入口', '操作'], rows, { caption: '外部 SkillHub 能力清单', emptyMessage: '清单为空；没有 skill 时不创建虚假引用。', countLabel: '个能力' })}</div></section>
      </div>`;
    }

    /** 标记 skill 三态（不可用会按运营异常口径提醒超管与运营，不打扰销售）。 */
    function openSkillMark(skillId) {
      const skill = F.load().aiDocs.skills.find(s => s.id === skillId);
      if (!skill) return;
      F.form('标记可用状态 · ' + skill.name, `<div class="fp-callout">置为「不可用」时提醒销售运营与超管调整引用，不打扰销售；访问失败请用「暂无法核实」，不等于已删除。</div>${F.field('可用状态', 'status', skill.status, 'select', [['available', '可用'], ['unavailable', '不可用'], ['unknown', '暂无法核实']])}`,
        values => F.markSkill(skillId, values.status), draw, '保存状态');
    }

    /** 新增 / 编辑 skill 清单条目；可用状态经「标记状态」单独变更。 */
    function openSkillEdit(skillId) {
      const skill = skillId ? F.load().aiDocs.skills.find(s => s.id === skillId) : null;
      F.form(skill ? '编辑能力 · ' + skill.name : '新增 skill / 素材',
        `${F.field('名称 *', 'name', skill?.name || '')}${F.field('类型', 'type', skill?.type || 'skill', 'select', ['skill', '素材'])}${F.field('版本', 'version', skill?.version || 'v1.0')}${F.field('用途 *', 'purpose', skill?.purpose || '', 'textarea')}${F.field('外部管理入口 URL', 'manageUrl', skill?.manageUrl || '')}`,
        values => F.saveSkill({ id: skill?.id, ...values }), draw, '保存');
    }

    /** sandbox 分面：待验证草稿入口 + 验证轮次记录；顶部固化「新会话无历史 · 只读真实数据 · 不写入生产」。 */
    function renderSandbox(target, state) {
      const docs = state.aiDocs.documents.filter(d => d.managed && d.draft);
      const draftRows = docs.map(doc => {
        const pending = state.aiDocs.validations.find(v => v.docId === doc.id && v.verdict === 'pending');
        const passed = state.aiDocs.validations.find(v => v.docId === doc.id && v.verdict === 'passed' && v.version === doc.draft.version && v.fingerprint === doc.draft.fingerprint);
        return `<tr data-sandbox-draft="${e(doc.id)}"><td><strong>${e(doc.name)}</strong></td><td class="mono">${e(doc.draft.version)}</td><td>${e(F.name(doc.draft.updatedBy))} · ${e(doc.draft.updatedAt)}</td><td>${pending ? F.badge('验证进行中', 'brand') : passed ? F.badge('已通过 · 可发布', 'green') : F.badge('未验证', 'amber')}</td><td>${pending ? F.button('进入验证', 'validation-open', pending.id, true) : F.button('发起验证', 'validation-start', doc.id, true)}</td></tr>`;
      });
      const rows = state.aiDocs.validations.map(v => {
        const stats = ['pass', 'fail', 'adjust'].map(r => `${{ pass: '通过', fail: '不通过', adjust: '需调整' }[r]} ${v.questions.filter(q => q.result === r).length}`).join(' · ');
        const [label, tone] = verdictMeta[v.verdict] || ['未知', 'neutral'];
        return `<tr data-validation-row="${e(v.id)}"><td><strong>${e(docName(state, v.docId))}</strong><small class="mono">${e(v.id)}</small></td><td class="mono">${e(v.version)}</td><td>${e(F.name(v.session?.operator || v.startedBy))}</td><td class="mono">${e(v.session?.id || '—')}</td><td>${e(stats)} / 共 ${v.questions.length} 题</td><td>${F.badge(label, tone)}</td><td>${e(v.startedAt)}</td><td>${F.button('进入验证', 'validation-open', v.id)}</td></tr>`;
      });
      target.innerHTML = `<div class="fp-stack">
        <div class="fp-callout">沙盒验证在新会话中进行：<strong>新会话无历史 · 以操作者身份只读真实数据 · 不写入生产</strong>。验证只对「该文档版本 + 该 skill 版本 + 该操作者」组合有效；内容再改后旧验证作废，重新验证另开新会话。</div>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>待验证草稿</h2><p class="fp-hint">按草稿与已发布版本的差异自动生成评测题；无改动不出题。</p></div></header><div data-sandbox-drafts>${F.table(['文档', '草稿版本', '最近保存', '验证状态', '操作'], draftRows, { caption: '待验证草稿清单', emptyMessage: '当前没有待验证的草稿。', countLabel: '份草稿', compact: true })}</div></section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>验证轮次</h2><p class="fp-hint">逐题人工判断留痕，含文档版本、skill 版本、操作者与会话；系统不自动宣称通过。</p></div></header><div data-validation-list>${F.table(['文档', '版本', '操作者', '会话', '题目结果', '结论', '发起时间', '操作'], rows, { caption: '沙盒验证轮次记录', emptyMessage: '暂无验证记录。', countLabel: '轮验证' })}</div></section>
      </div>`;
    }

    /** 验证抽屉：改动对照 + 评测题逐题三态判断与说明 + 完成验证；已结束的轮次只读回看。 */
    function openValidation(validationId) {
      const state = F.load();
      const v = state.aiDocs.validations.find(x => x.id === validationId);
      if (!v) return;
      const readonly = v.verdict !== 'pending';
      const [verdictLabel] = verdictMeta[v.verdict] || ['未知'];
      F.drawer(`沙盒验证 · ${docName(state, v.docId)} ${v.version}`, `<div class="fp-stack" data-validation-drawer>
        <div class="fp-callout">新会话 ${e(v.session?.id || '—')} · 无历史记录 · 以 ${e(F.name(v.session?.operator || v.startedBy))} 身份只读真实数据 · 不写入生产。验证只对「${e(v.version)} + 当前 skill 版本 + 该操作者」组合有效。</div>
        <dl class="fp-kv"><dt>文档版本</dt><dd class="mono">${e(v.version)}</dd><dt>改动对照</dt><dd>${e(v.changeSummary)}</dd><dt>skill 版本</dt><dd>${e(Object.entries(v.skillVersions || {}).map(([id, ver]) => `${skillName(state, id)} ${ver}`).join('；') || '无引用')}</dd><dt>会话</dt><dd>${e(v.session?.id || '—')} · ${e(v.session?.at || '—')} · 只读</dd></dl>
        ${v.questions.map(q => `<section class="fp-panel fp-pad" data-question="${e(q.id)}">
          <header class="fp-section-head"><h3>${e(q.question)}</h3>${q.result ? F.badge(judgeMeta[q.result][0], judgeMeta[q.result][1]) : F.badge('待判断', 'neutral')}</header>
          <dl class="fp-kv"><dt>对应改动</dt><dd>${e(q.changeRef)}</dd><dt>观察点</dt><dd>${e(q.observe)}</dd></dl>
          ${q.answer ? `<div class="fp-callout">${e(q.answer)}</div><p class="fp-hint">来源：${e((q.sources || []).join('；') || '—')} · 调用：${e((q.calls || []).map(c => `${c.name} ${c.version}（${c.result === 'success' ? '调用成功' : '不可用'}）`).join('；') || '未调用')}</p>` : ''}
          ${readonly ? '' : `<div class="fp-actions">${F.button('生成演示回答', 'val-answer', `${v.id}|${q.id}`)}${F.button('通过', 'val-judge', `${v.id}|${q.id}|pass`)}${F.button('不通过', 'val-judge', `${v.id}|${q.id}|fail`)}${F.button('需要调整', 'val-judge', `${v.id}|${q.id}|adjust`)}</div>${F.field('问题说明', 'note-' + q.id, q.note)}`}
        </section>`).join('')}
        ${readonly ? `<div class="fp-callout">本轮验证已结束（${e(verdictLabel)}），留痕可回看；重新验证另开新会话。</div>` : `<div class="fp-actions">${F.button('完成验证 · 通过', 'val-finish', v.id + '|passed', true)}${F.button('完成验证 · 不通过', 'val-finish', v.id + '|failed')}${F.button('完成验证 · 需要调整', 'val-finish', v.id + '|adjust')}</div><p class="fp-hint">全部评测题判断后才能完成；存在不通过题时不能标记通过（例外发布规则待产品确认，默认阻止）。</p>`}
      </div>`, (mask, close) => F.bind(mask, {
        'val-answer': value => { const [vid, qid] = value.split('|'); F.answerValidation(vid, qid); close(); openValidation(vid); },
        'val-judge': (value, button) => { const [vid, qid, result] = value.split('|'); const note = mask.querySelector(`[name="note-${qid}"]`)?.value || ''; F.judgeValidation(vid, qid, result, note); close(); openValidation(vid); },
        'val-finish': value => { const [vid, verdict] = value.split('|'); F.finishValidation(vid, verdict); close(); draw(); SC.toast('验证结论已留痕。', 'ok'); }
      }));
    }

    /** publish 分面：待发布区（验证门禁）+ 逐销售发布记录（送达 / 已加载 / 已生效 + 失败重试）+ 版本时间线（恢复入口）。 */
    function renderPublish(target, state) {
      const docs = state.aiDocs.documents;
      const cards = docs.filter(d => d.managed && d.draft).map(doc => {
        const passed = state.aiDocs.validations.find(v => v.docId === doc.id && v.verdict === 'passed' && v.version === doc.draft.version && v.fingerprint === doc.draft.fingerprint);
        const pending = state.aiDocs.validations.find(v => v.docId === doc.id && v.verdict === 'pending');
        return `<section class="fp-panel fp-pad" data-publish-doc="${e(doc.id)}">
          <header class="fp-section-head"><h3>${e(doc.name)} · 草稿 ${e(doc.draft.version)}${doc.draft.kind === 'restore' ? `（恢复自 ${e(doc.draft.restoreFromVersion)}）` : ''}</h3>${passed ? F.badge('验证通过 · 可发布', 'green') : pending ? F.badge('验证进行中', 'brand') : F.badge('未完成验证', 'amber')}</header>
          <dl class="fp-kv"><dt>最近保存</dt><dd>${e(doc.draft.updatedAt)} · ${e(F.name(doc.draft.updatedBy))}</dd><dt>目标销售</dt><dd>${e((doc.targets || []).map(id => F.name(id)).join('、'))}</dd><dt>验证记录</dt><dd>${passed ? `${e(passed.id)} · ${e(passed.finishedAt)} 通过` : pending ? `${e(pending.id)} 进行中` : '无有效验证（内容变化后旧验证作废）'}</dd></dl>
          <div class="fp-actions">${passed ? F.button('发起生产同步', 'doc-publish', doc.id, true) : F.button('发起生产同步', 'doc-publish-blocked', doc.id)}${pending ? '' : F.button('发起沙盒验证', 'validation-start', doc.id)}</div>
          ${passed ? '' : '<p class="fp-hint">验证门禁：发布前须完成沙盒验证，且验证版本与当前草稿一致；内容再改后需重新验证。</p>'}
        </section>`;
      }).join('');
      const releaseRows = state.aiDocs.releases.flatMap(release => {
        const ok = release.targets.filter(t => t.effective).length;
        const notLoaded = release.targets.filter(t => t.deliver === 'success' && !t.loaded).length;
        const failed = release.targets.filter(t => t.deliver === 'failed').length;
        return release.targets.map(t => `<tr data-release-row="${e(release.id)}" data-release-sales="${e(t.sales)}"><td><strong>${e(docName(state, release.docId))}</strong><small class="mono">${e(release.id)} · ${e(release.version)} · 生效 ${ok} · 未加载 ${notLoaded} · 失败 ${failed}</small></td><td>${e(F.name(t.sales))}</td><td>${t.deliver === 'success' ? F.badge('已送达', 'green') : t.deliver === 'failed' ? F.badge('失败', 'red') : F.badge('同步中', 'brand')}</td><td>${t.loaded ? F.badge('已加载 ' + e(t.loadedVersion), 'green') : t.deliver === 'success' ? F.badge('未加载新版 · 继续使用 ' + e(t.loadedVersion || '上一成功版本'), 'amber') : F.badge('未加载', 'neutral')}</td><td>${t.effective ? F.badge('已生效', 'green') : F.badge('未生效', 'neutral')}</td><td>${e(t.reason || '—')}${t.retryCount ? `<small>已重试 ${t.retryCount} 次</small>` : ''}</td><td>${e(release.at)} · ${e(F.name(release.by))}</td><td>${t.deliver === 'failed' ? F.button('重试', 'release-retry', release.id + '|' + t.sales) : ''}</td></tr>`);
      });
      const versionRows = docs.filter(d => d.managed).flatMap(doc => doc.versions.map(v => {
        const validation = state.aiDocs.validations.find(x => x.id === v.validationId);
        return `<tr data-version-row="${e(v.id)}"><td><strong>${e(doc.name)}</strong></td><td class="mono">${e(v.version)}</td><td>${F.badge(kindMeta[v.kind] || v.kind, v.kind === 'restore' ? 'amber' : v.kind === 'sync' ? 'green' : 'brand')}</td><td>${e(F.name(v.by))}</td><td>${e(v.at)}</td><td>${e(v.note || '—')}</td><td>${e(validation ? validation.id + ' · ' + (verdictMeta[validation.verdict]?.[0] || validation.verdict) : '—')}</td><td>${F.button('恢复此版本', 'doc-restore', doc.id + '|' + v.id)}</td></tr>`;
      }));
      target.innerHTML = `<div class="fp-stack">
        <div class="fp-callout">保存 / 发布 / 送达 / 已加载 / 已生效是五个不同状态：部分失败只展示失败项并可重试，不显示全量成功；未加载目标继续使用最近一次成功版本并标注，不把旧版伪装成新版。</div>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>待发布</h2><p class="fp-hint">验证通过的草稿才能同步生产；恢复版本同样走验证 → 同步链路。</p></div></header><div class="fp-pad fp-stack" data-publish-pending>${cards || '<p class="fp-hint">当前没有待发布的草稿。</p>'}</div></section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>发布记录</h2><p class="fp-hint">逐销售展示送达、已加载与已生效；失败项可重试。</p></div></header><div data-release-list>${F.table(['文档 / 批次', '销售', '送达', '已加载', '已生效', '失败原因', '同步时间', '操作'], releaseRows, { caption: '文档发布逐销售结果', emptyMessage: '暂无发布记录。', countLabel: '条目标记录' })}</div></section>
        <section class="fp-panel"><header class="fp-panel-head"><div><h2>版本时间线</h2><p class="fp-hint">版本关联编辑、验证、同步与恢复记录；运营恢复不连带超管正文。</p></div></header><div data-version-list>${F.table(['文档', '版本', '类型', '操作人', '时间', '说明', '验证', '操作'], versionRows, { caption: '文档版本时间线', emptyMessage: '暂无版本记录。', countLabel: '个版本' })}</div></section>
      </div>`;
    }

    /** 恢复确认抽屉：超管全量恢复；运营仅恢复授权模块内容；恢复生成新草稿，必须重新验证后才能发布。 */
    function openRestore(value) {
      const [docId, versionId] = value.split('|');
      const state = F.load();
      const doc = state.aiDocs.documents.find(d => d.id === docId);
      const version = doc?.versions.find(v => v.id === versionId);
      if (!doc || !version) return;
      F.drawer(`恢复版本 · ${doc.name} ${version.version}`, `<div class="fp-stack" data-doc-restore>
        <div class="fp-callout">${F.role === 'ADM' ? '将以该版本快照恢复正文与全部模块内容。' : '仅恢复你授权模块的填写内容与 skill 引用，不连带超管正文。'}恢复会生成新草稿，必须重新完成沙盒验证后才能发布；不直接覆盖受保护正文，也不抹除历史。</div>
        <dl class="fp-kv"><dt>来源版本</dt><dd class="mono">${e(version.version)} · ${e(version.at)}</dd><dt>版本说明</dt><dd>${e(version.note || '—')}</dd></dl>
        <div class="fp-actions">${F.button('确认恢复', 'restore-confirm', value, true)}</div>
      </div>`, (mask, close) => F.bind(mask, { 'restore-confirm': v => { const [d, ver] = v.split('|'); F.restoreDocVersion(d, ver); close(); draw(); SC.toast('已生成恢复草稿，需重新验证后才能发布。', 'ok'); } }));
    }

    function draw() {
      const state = F.load();
      root.innerHTML = `<section class="fp-panel">${F.tabs(tabs, tab)}<div class="fp-pad" data-ai></div></section>`;
      const target = root.querySelector('[data-ai]');
      if (tab === 'docs') renderDocs(target, state);
      if (tab === 'modules') renderModules(target, state);
      if (tab === 'skills') renderSkills(target, state);
      if (tab === 'sandbox') renderSandbox(target, state);
      if (tab === 'publish') renderPublish(target, state);
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        tab = b.dataset.tab;
        const url = new URL(location.href);
        url.searchParams.set('tab', tab);
        history.replaceState({}, '', url.href);
        draw();
      });
    }

    F.bind(root, {
      'doc-view': id => openDocView(id),
      'doc-takeover': id => { F.takeoverDoc(id); draw(); SC.toast('已接管，本系统成为唯一编辑入口；后续回传只用于核对差异。', 'ok'); },
      'doc-diff': id => openDocDiff(id),
      'doc-edit': id => openDocEdit(id),
      'doc-preview': id => openDocPreview(id),
      'module-config': value => openModuleConfig(value),
      'module-disable': value => { const [docId, moduleId] = value.split('|'); F.configureModule(docId, '', { id: moduleId, disable: true }); draw(); SC.toast('模块已停用，已填内容保留。', 'ok'); },
      'module-fill': value => { const [docId, moduleId] = value.split('|'); openModuleFill(docId, moduleId); },
      'skill-mark': id => openSkillMark(id),
      'skill-edit': id => openSkillEdit(id),
      'validation-start': docId => { const v = F.startValidation(docId); draw(); SC.toast('已创建无历史新会话并生成评测题。', 'ok'); if (v) openValidation(v.id); },
      'validation-open': id => openValidation(id),
      'doc-publish': docId => { const release = F.publishDoc(docId); draw(); const failed = release.targets.filter(t => t.deliver === 'failed').length; SC.toast(failed ? `已发起生产同步，${failed} 名销售失败，可在发布记录重试。` : '已发起生产同步，逐销售结果见发布记录。', failed ? 'bad' : 'ok'); },
      'doc-publish-blocked': () => { throw Error('未完成沙盒验证（或验证后内容已变化），不能同步生产。'); },
      'release-retry': value => { const [releaseId, sales] = value.split('|'); F.retryPublishTarget(releaseId, sales); draw(); SC.toast('重试成功，该销售已送达并加载新版。', 'ok'); },
      'doc-restore': value => openRestore(value)
    });
    draw();
  };
})(window.SC, window.SC.FEATURES);
