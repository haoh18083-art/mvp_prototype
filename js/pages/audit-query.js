/* ==========================================================================
   P-ADM-30 操作审计 · 来源 M03-1 §4.1/§4.6/§4.7 / M03-2 §4.1
   三合一页签：事件查询（筛选 + 事件列表）、按对象串联（P-ADM-32）、
   留痕待补（P-ADM-33）。三者同页切换，不再整页跳转到子页面。
   仅超级管理员可见；V1.0 只做在线查询，不做导出。
   深链：?tab=object|pending 直达对应页签；?obj=<标识> 预填并定位到串联页签。
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;
  var E = SC.esc;
  var KNOWN = { query: 1, object: 1, pending: 1 };

  /* 对象类型示例（串联页签用） */
  var TYPES = [
    { t: '人员',       eg: 'U-1004',  desc: '人员档案与登录账号' },
    { t: '销售分组',   eg: 'G-01',    desc: '分组及主管关系' },
    { t: '客户',       eg: 'CU-8801', desc: '客户主数据，全局唯一一条' },
    { t: '商机',       eg: 'O-3391',  desc: '独立商机，关联客户、产品与归属销售' },
    { t: '客户池',     eg: 'PL-04',   desc: '解决方案承接团队' },
    { t: '产品',       eg: 'P-118',   desc: '全局产品主数据' },
    { t: '经营组合',   eg: 'C-1182',  desc: '销售 + 客户' },
    { t: '客户工作空间', eg: 'W-2043', desc: '销售 + 客户 + 客户池；标识在迁移与解档时不变' },
    { t: 'Agent 实例', eg: 'A-5127',  desc: '每空间一个当前实例；解档时新建并取得新标识' }
  ];

  function setUrl(params) {
    try {
      var u = new URL(location.href);
      Object.keys(params).forEach(function (k) {
        if (params[k] === '' || params[k] == null) u.searchParams.delete(k);
        else u.searchParams.set(k, params[k]);
      });
      history.replaceState(null, '', u);
    } catch (e) {}
  }

  SC.page({
    role: 'ADM', menu: 'audit', pid: 'P-ADM-30',
    title: '操作审计',
    crumb: []
  }, function (body, actions) {

    actions.innerHTML = ''; /* 原「按对象串联 / 留痕待补」两个按钮改为下方页签 */

    var active = SC.param('tab');
    if (!KNOWN[active]) active = SC.param('obj') ? 'object' : 'query';
    var cPending = D.PENDING_AUDIT.length;

    /* -------------------------------------------------- 页签栏 */
    var tabbar =
      '<div class="tabs" role="tablist">' +
        tabBtn('query', '事件查询', active) +
        tabBtn('object', '按对象串联', active) +
        tabBtn('pending', '留痕待补' +
          (cPending ? ' <span class="badge badge--red badge--sm">' + cPending + '</span>' : ''), active) +
      '</div>';

    body.innerHTML = tabbar +
      pane('query', active, queryHTML()) +
      pane('object', active, objectHTML(SC.param('obj'))) +
      pane('pending', active, pendingHTML());

    /* -------------------------------------------------- 页签切换 */
    SC.wireTabs(body, function (key) {
      SC.qsa('.tabpane', body).forEach(function (p) {
        p.classList.toggle('u-hide', p.dataset.pane !== key);
      });
      setUrl({ tab: key === 'query' ? '' : key });
    });

    wireQuery(body);
    wireObject(body);
    wirePending(body);
  });

  function tabBtn(key, label, active) {
    return '<button class="tab' + (active === key ? ' is-active' : '') +
      '" role="tab" data-tab="' + key + '">' + label + '</button>';
  }
  function pane(key, active, html) {
    return '<div class="tabpane' + (active === key ? '' : ' u-hide') +
      '" data-pane="' + key + '">' + html + '</div>';
  }

  /* ============================================================ 事件查询 */

  function queryRows(list) {
    if (!list.length) {
      return '<tr><td colspan="7">' + SC.empty({
        sm: true,
        title: '没有符合条件的事件',
        reason: '请调整事件域、事件类型或时间范围后重新查询。'
      }) + '</td></tr>';
    }
    return list.map(function (e) {
      return '<tr>' +
        '<td class="u-t3 u-f12 u-nowrap mono">' + e.at + '</td>' +
        '<td><span class="domain-pill domain-pill--' + e.domain.toLowerCase() + '">域 ' + e.domain + '</span></td>' +
        '<td><div class="audit-ev">' +
          '<span class="audit-ev__code">' + e.code + '</span>' +
          '<a href="audit-detail.html?id=' + e.id + '" class="u-medium">' + E(e.name) + '</a>' +
        '</div>' +
        (e.batch ? '<div class="table__sub">批次 ' + e.batch + '</div>' : '') + '</td>' +
        '<td class="u-f12">' + E(e.by) + '</td>' +
        '<td class="u-f12 u-t2">' + E(e.entry) + '</td>' +
        '<td class="u-f12 u-t2 u-truncate" style="max-width:260px" title="' + E(e.obj) + '">' +
          E(e.obj) + '</td>' +
        '<td>' + (e.result === 'ok' ? SC.badge('成功', 'green', { sm: true })
                : e.result === 'fail' ? SC.badge('失败', 'red', { sm: true })
                : SC.badge('部分成功', 'amber', { sm: true })) + '</td>' +
      '</tr>';
    }).join('');
  }

  function queryHTML() {
    var domainOpts = D.DOMAINS.map(function (d) {
      return '<option value="' + d.key + '">域 ' + d.key + '　' + d.name + '（' + d.n + ' 类）</option>';
    }).join('');

    var filter =
      '<div class="filterbar">' +
        '<div class="field" style="min-width:230px">' +
          '<label class="field__label">事件域<span class="field__hint" style="display:inline"> · 第一层</span></label>' +
          '<select class="select" id="dom"><option value="">全部六域</option>' + domainOpts + '</select>' +
        '</div>' +
        '<div class="field" style="min-width:230px">' +
          '<label class="field__label">事件类型<span class="field__hint" style="display:inline"> · 第二层</span></label>' +
          '<select class="select" id="typ" disabled><option value="">请先选择事件域</option></select>' +
        '</div>' +
        '<div class="field"><label class="field__label">发起人</label>' +
          '<input class="input" id="audit-author" placeholder="姓名或账号"></div>' +
        '<div class="field"><label class="field__label">操作入口</label>' +
          '<select class="select" id="audit-entry"><option>全部</option><option>人员与账号</option>' +
          '<option>销售分组</option><option>客保审批</option><option>客户池管理</option>' +
          '<option>产品管理</option><option>系统自动</option><option>个人 Agent 对话</option></select></div>' +
        '<div class="field"><label class="field__label">发生时间</label>' +
          '<select class="select"><option>近 7 天</option><option>近 30 天</option>' +
          '<option>近 90 天</option><option>自定义</option></select></div>' +
        '<div class="filterbar__acts">' +
          '<button class="btn" id="audit-reset">重置</button>' +
          '<button class="btn btn--primary" id="audit-search">查询</button>' +
        '</div>' +
      '</div>';

    var table =
      '<div class="table-wrap">' +
        '<div class="toolbar">' +
          '<div class="toolbar__left"><span class="u-f12 u-t2" id="cnt">共 ' + D.AUDIT.length +
            ' 条事件 · 按发生时间倒序</span></div>' +
          '<div class="toolbar__right"><span class="u-f11 u-t3">V1.0 只做在线查询，不提供导出</span></div>' +
        '</div>' +
        '<div class="table-wrap--scroll">' +
        '<table class="table"><thead><tr>' +
          '<th style="width:140px">发生时间</th><th style="width:78px">事件域</th>' +
          '<th>事件</th><th style="width:120px">发起人</th>' +
          '<th style="width:120px">操作入口</th><th>业务对象</th><th style="width:92px">结果</th>' +
        '</tr></thead><tbody id="tb">' + queryRows(D.AUDIT) + '</tbody></table></div>' +
        SC.pager({ total: D.AUDIT.length, size: D.AUDIT.length || 1, page: 1 }) +
      '</div>';

    return filter + '<div class="u-mt4">' + table + '</div>' +
      '<div class="u-mt4">' + SC.note(
        '<b>业务动态与操作审计分流</b>：面向业务角色的业务动态只展示发生时间、事件名称、发起人、' +
        '变更摘要与依据引用入口，<b>不展示业务对象标识</b>；操作审计仅超级管理员可见，' +
        '且<b>不记录也不展示密码明文</b>。', 'info') + '</div>';
  }

  function wireQuery(body) {
    var domSel = SC.qs('#dom', body);
    var typSel = SC.qs('#typ', body);
    if (!domSel) return;

    domSel.addEventListener('change', function () {
      var k = domSel.value;
      if (!k) {
        typSel.disabled = true;
        typSel.innerHTML = '<option value="">请先选择事件域</option>';
        applyFilters();
        return;
      }
      typSel.disabled = false;
      var catalog = new Map((D.EVENT_CATALOG[k] || []).map(function (c) { return [c.code, c]; }));
      (SC.B2.load().organisationEvents || []).forEach(function (e) {
        if (e.audit.domain === k) catalog.set(e.audit.code, { code: e.audit.code, name: e.detail.definition?.name || e.audit.name });
      });
      var cat = Array.from(catalog.values()).sort(function (a, b) { return a.code.localeCompare(b.code); });
      typSel.innerHTML = '<option value="">该域全部事件类型</option>' +
        (cat
          ? cat.map(function (c) { return '<option>' + c.code + '　' + c.name + '</option>'; }).join('')
          : '<option disabled>清单见「基础数据配置 › 事件清单」</option>');
      applyFilters();
    });

    function applyFilters() {
      var domain = domSel.value, code = typSel.value.split('　')[0];
      var author = SC.qs('#audit-author', body).value.trim(), entry = SC.qs('#audit-entry', body).value;
      repaint(D.AUDIT.filter(function (e) {
        return (!domain || e.domain === domain) && (!code || code.indexOf('EV-') !== 0 || e.code === code) &&
          (!author || e.by.includes(author)) && (entry === '全部' || e.entry === entry);
      }));
    }
    typSel.addEventListener('change', applyFilters);
    SC.qs('#audit-search', body).addEventListener('click', applyFilters);
    SC.qs('#audit-reset', body).addEventListener('click', function () {
      domSel.value = ''; typSel.value = ''; typSel.disabled = true;
      SC.qs('#audit-author', body).value = ''; SC.qs('#audit-entry', body).value = '全部'; applyFilters();
    });
    function repaint(list) {
      SC.qs('#tb', body).innerHTML = queryRows(list);
      SC.qs('#cnt', body).textContent = '共 ' + list.length + ' 条事件 · 按发生时间倒序';
    }
  }

  /* ============================================================ 按对象串联 */

  function objResultHTML(q) {
    var chain = D.AUDIT.filter(function (e) {
      return !q || (e.related || []).includes(q) || e.obj.split(/\s+/).includes(q);
    });
    if (!q) {
      return '<div class="card"><div class="card__body">' + SC.empty({
        icon: 'search',
        title: '输入业务对象标识开始串联',
        reason: '可从任一审计事件详情的「涉及对象区」点击进入，也可直接输入标识查询。'
      }) + '</div></div>';
    }
    return '<div class="card"><div class="card__head">' +
        '<div><div class="card__title">串联结果</div>' +
        '<div class="card__sub">对象 <span class="mono">' + E(q) + '</span> · 共 ' +
        chain.length + ' 条相关事件，按发生时间倒序</div></div></div>' +
      '<div class="card__body card__body--flush">' +
        (chain.length
          ? '<table class="table"><thead><tr>' +
            '<th style="width:140px">发生时间</th><th style="width:78px">域</th>' +
            '<th>事件</th><th style="width:110px">发起人</th><th style="width:92px">结果</th>' +
            '</tr></thead><tbody>' +
            chain.map(function (e) {
              return '<tr>' +
                '<td class="u-t3 u-f12 mono u-nowrap">' + e.at + '</td>' +
                '<td><span class="domain-pill domain-pill--' + e.domain.toLowerCase() + '">' + e.domain + '</span></td>' +
                '<td><div class="audit-ev"><span class="audit-ev__code">' + e.code + '</span>' +
                  '<a href="audit-detail.html?id=' + e.id + '">' + E(e.name) + '</a></div></td>' +
                '<td class="u-f12">' + E(e.by) + '</td>' +
                '<td>' + (e.result === 'ok' ? SC.badge('成功', 'green', { sm: true })
                        : e.result === 'fail' ? SC.badge('失败', 'red', { sm: true })
                        : SC.badge('部分成功', 'amber', { sm: true })) + '</td>' +
                '</tr>';
            }).join('') + '</tbody></table>'
          : SC.empty({
              title: '未找到该标识的相关事件',
              reason: '请确认标识是否正确。标识终身不变——空间标识在<b>迁移与解档时不变</b>，' +
                      'Agent 实例在解档时新建并取得<b>新标识</b>。'
            })) +
      '</div></div>';
  }

  function objectHTML(q) {
    var search =
      '<div class="filterbar">' +
        '<div class="field u-grow" style="min-width:280px">' +
          '<label class="field__label">业务对象标识</label>' +
          '<input class="input" id="q" placeholder="如 U-1004、O-3391、W-2043" value="' + E(q) + '">' +
        '</div>' +
        '<div class="filterbar__acts"><button class="btn btn--primary" id="go">查询</button></div>' +
      '</div>';

    var typeCard =
      '<div class="card"><div class="card__head">' +
        '<div><div class="card__title">对象类型与标识体系</div>' +
        '<div class="card__sub">这套标识决定 Agent 输出能否回溯至原始依据，' +
        '并承载客保审批的关系快照</div></div></div>' +
      '<div class="card__body card__body--flush">' +
        '<table class="table table--compact"><thead><tr>' +
          '<th style="width:130px">对象类型</th><th style="width:110px">标识示例</th><th>说明</th>' +
        '</tr></thead><tbody>' +
        TYPES.map(function (t) {
          return '<tr><td class="u-medium">' + E(t.t) + '</td>' +
            '<td><span class="mono u-f12">' + t.eg + '</span></td>' +
            '<td class="u-f12 u-t2">' + t.desc + '</td></tr>';
        }).join('') + '</tbody></table>' +
      '</div></div>';

    return search +
      '<div class="u-mt4" id="obj-result">' + objResultHTML(q) + '</div>' +
      '<div class="u-mt4">' + typeCard + '</div>';
  }

  function wireObject(body) {
    var input = SC.qs('#q', body);
    if (!input) return;
    function run() {
      var v = input.value.trim();
      SC.qs('#obj-result', body).innerHTML = objResultHTML(v);
      setUrl({ obj: v });
    }
    SC.qs('#go', body).addEventListener('click', run);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') run();
    });
  }

  /* ============================================================ 留痕待补 */

  function pendingHTML() {
    if (!D.PENDING_AUDIT.length) {
      return '<div class="card"><div class="card__body">' + SC.empty({
        icon: 'ok', title: '没有待补记的留痕',
        reason: '全部业务动作的留痕均已完成。'
      }) + '</div></div>';
    }

    var rows = D.PENDING_AUDIT.map(function (p) {
      return '<tr>' +
        '<td class="col-check"><input type="checkbox" data-check-row value="' + p.id + '"></td>' +
        '<td><span class="mono u-f12">' + p.id + '</span>' +
          '<div class="table__sub">' + E(p.obj) + '</div></td>' +
        '<td class="u-f12"><span class="u-success">' + SC.icon('ok', 12) + '</span> ' + E(p.real) + '</td>' +
        '<td class="u-f12 u-danger">' + E(p.why) + '</td>' +
        '<td>' + SC.badge(p.mod, 'neutral', { sm: true }) + '</td>' +
        '<td class="u-t3 u-f12 mono u-nowrap">' + p.at + '</td>' +
        '<td class="col-act"><div class="rowacts">' +
          '<button class="btn--link" data-check="' + p.id + '">核对</button>' +
          '<button class="btn--link" data-fix="' + p.id + '">恢复留痕</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    return SC.note('<b>业务与留痕分别判断</b>：下列事项的业务结果<b>已经生效</b>，' +
            '缺的只是审计事件本身。恢复留痕后事件补记完成，' +
            '原发生时间、补记时间与修复人分别记录，<b>不改原业务责任</b>。', 'warn') +

      '<div class="u-mt4 table-wrap">' +
        '<div class="toolbar"><div class="toolbar__left">' +
          '<span class="u-f12 u-t2">共 ' + D.PENDING_AUDIT.length + ' 项待补，仅超级管理员可见</span>' +
        '</div><div class="toolbar__right">' +
          '<button class="btn btn--primary" id="all">批量核对并恢复</button>' +
        '</div></div>' +
        '<div class="bulkbar u-hide" id="bb"><span>已选中 <b id="bn">0</b> 项</span>' +
          '<button class="btn--link" id="bc">取消选择</button></div>' +
        '<div class="table-wrap--scroll">' +
        '<table class="table"><thead><tr>' +
          '<th class="col-check"><input type="checkbox" data-check-all></th>' +
          '<th style="width:180px">待补项</th><th>实际业务结果</th>' +
          '<th style="width:180px">留痕未完成原因</th><th style="width:96px">责任模块</th>' +
          '<th style="width:140px">发生时间</th><th class="col-act">操作</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div>' +

      '<div class="u-mt4">' + SC.note(
        '<b>容量参数</b>　单次核对容量建议初值 <b>200 条</b>，超出时提示分批核对，' +
        '不静默截断、不无限等待。最终数值待联调确认。', 'info') + '</div>';
  }

  function wirePending(body) {
    if (!D.PENDING_AUDIT.length) return;

    var bb = SC.qs('#bb', body);
    var wired = SC.wireCheckAll(body, function (n) {
      bb.classList.toggle('u-hide', n === 0);
      SC.qs('#bn', body).textContent = n;
    });
    SC.qs('#bc', body).addEventListener('click', function () {
      wired.boxes.forEach(function (b) { b.checked = false; });
      var all = SC.qs('[data-check-all]', body);
      if (all) { all.checked = false; all.indeterminate = false; }
      wired.sync();
    });

    SC.qsa('[data-check]', body).forEach(function (b) {
      b.addEventListener('click', function () { openCompare(pick(b.dataset.check)); });
    });
    SC.qsa('[data-fix]', body).forEach(function (b) {
      b.addEventListener('click', function () { openFix([pick(b.dataset.fix)]); });
    });
    SC.qs('#all', body).addEventListener('click', function () {
      var ids = wired.boxes.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      openFix((ids.length ? ids : D.PENDING_AUDIT.map(function (p) { return p.id; })).map(pick));
    });

    function pick(id) {
      return D.PENDING_AUDIT.filter(function (p) { return p.id === id; })[0];
    }
  }

  /* ---------------------------------------------- 核对（只读） */

  function openCompare(p) {
    SC.modal({
      title: '核对：' + p.obj,
      sub: '只读核对，不执行任何业务动作',
      size: 'md',
      body:
        '<div class="identity3">' +
          '<div class="identity3__cell"><div class="identity3__k">业务结果</div>' +
            '<div class="identity3__v u-success">已生效</div></div>' +
          '<div class="identity3__cell"><div class="identity3__k">留痕状态</div>' +
            '<div class="identity3__v u-danger">未完成</div></div>' +
          '<div class="identity3__cell"><div class="identity3__k">责任模块</div>' +
            '<div class="identity3__v">' + E(p.mod) + '</div></div>' +
        '</div>' +
        '<div class="dl dl--wide">' +
          '<span class="dl__k">对象</span><span class="dl__v mono">' + E(p.obj) + '</span>' +
          '<span class="dl__k">实际结果</span><span class="dl__v">' + E(p.real) + '</span>' +
          '<span class="dl__k">原因</span><span class="dl__v u-danger">' + E(p.why) + '</span>' +
          '<span class="dl__k">发生时间</span><span class="dl__v mono">' + p.at + '</span>' +
        '</div>' +
        SC.note('恢复留痕<b>只补记事件</b>：不重新审批、不重复执行业务、不改变已生效的业务结果。' +
                '重复处理不重复生成事件。', 'info'),
      buttons: [
        { label: '关闭', cls: '' },
        { label: '恢复留痕', cls: 'btn--primary', onClick: function (close) { close(); openFix([p]); } }
      ]
    });
  }

  /* ---------------------------------------------- 恢复留痕结果 */

  function openFix(list) {
    var ok = list.filter(function (p) { return p.id !== 'P-3302'; });
    var bad = list.filter(function (p) { return p.id === 'P-3302'; });

    SC.modal({
      title: '恢复留痕结果',
      size: 'md',
      body: SC.result({
        nums: [
          { k: '补记成功', v: ok.length, tone: 'ok' },
          { k: '仍未完成', v: bad.length, tone: bad.length ? 'bad' : '' }
        ],
        rows: bad.map(function (p) {
          return { obj: p.obj, why: '事件发生次序尚需与空间状态变更对齐，需 M09 确认后再补记', act: '查看空间状态' };
        })
      }) +
      SC.note('补记完成的事件在审计详情中展示<b>补记说明区</b>：原发生时间、补记时间与修复人，' +
              '<b>不改原业务责任</b>。', 'green'),
      buttons: [{ label: '完成', cls: 'btn--primary' }]
    });
  }

})(window.SC);
