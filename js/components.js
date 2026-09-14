/* ==========================================================================
   公共组件渲染库 · 批 1 定型
   C-01 空间状态 · C-02 Agent 实例状态 · C-03 商机状态三分区 · C-04 客户池标签
   C-05 组合-空间两层卡 · C-06 待办台 · C-07 清单+详情 · C-08 批量结果
   C-09 转入确认 · C-10 影响提示弹窗 · C-11 空状态 · C-12 依据引用
   ========================================================================== */

window.SC = window.SC || {};

(function (SC) {
  'use strict';

  /* ======================================================== 基础工具 */

  SC.qs  = function (sel, root) { return (root || document).querySelector(sel); };
  SC.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  SC.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  SC.el = function (html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  };

  SC.param = function (name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  };

  /* ======================================================== 图标 */

  var P = {
    users:    '<path d="M11 14.5a4 4 0 00-8 0M7 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM11.2 8.6A2.2 2.2 0 1012 4.4M15 14.2a3.4 3.4 0 00-2.6-3.1"/>',
    sitemap:  '<path d="M6 2.5h4v3H6zM1.5 12h4v3h-4zM10.5 12h4v3h-4zM8 5.5v3M3.5 12V9.5h9V12"/>',
    layers:   '<path d="M8 1.8l6 3-6 3-6-3 6-3zM2 8.5l6 3 6-3M2 11.8l6 3 6-3"/>',
    box:      '<path d="M8 1.8l6 3v6.4l-6 3-6-3V4.8l6-3zM2 4.8l6 3 6-3M8 7.8v6.4"/>',
    gavel:    '<path d="M9.5 2.5l4 4M11.5 1.5l3 3M2 14h7M4.5 11.5l6-6M6.4 6.6l3 3"/>',
    check:    '<path d="M2.5 8.5l3.5 3.5 7.5-7.5"/>',
    building: '<path d="M2.5 14V3.5l6-2 5 2V14M2.5 14h11M5.5 6h2M5.5 9h2M10 6h1.5M10 9h1.5M6.5 14v-2.5h3V14"/>',
    sync:     '<path d="M14 8a6 6 0 01-10.6 3.8M2 8a6 6 0 0110.6-3.8M12.6 1.6v2.6h-2.6M3.4 14.4v-2.6h2.6"/>',
    shield:   '<path d="M8 1.5l5.5 2v4.3c0 3.3-2.3 5.9-5.5 6.7-3.2-.8-5.5-3.4-5.5-6.7V3.5l5.5-2zM5.8 8l1.7 1.7 3-3"/>',
    sliders:  '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11M6 2.8v3.4M10.5 6.3v3.4M5 9.8v3.4"/>',
    grid:     '<path d="M2.5 2.5h5v5h-5zM8.5 2.5h5v5h-5zM2.5 8.5h5v5h-5zM8.5 8.5h5v5h-5z"/>',
    eye:      '<path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.9"/>',
    alert:    '<path d="M8 2.2l6 11H2l6-11zM8 6.5v3M8 11.3v.7"/>',
    search:   '<circle cx="7.2" cy="7.2" r="4.4"/><path d="M10.6 10.6L14 14"/>',
    file:     '<path d="M9 1.8H4.5v12.4h7V4.3L9 1.8zM9 1.8v2.5h2.5M6 8h4M6 10.5h4"/>',
    mic:      '<path d="M8 2.2a2 2 0 012 2v3.4a2 2 0 01-4 0V4.2a2 2 0 012-2zM4.2 7.4a3.8 3.8 0 007.6 0M8 11.2v2.6M6 13.8h4"/>',
    chat:     '<path d="M14 8.8c0 2.6-2.7 4.7-6 4.7-.8 0-1.5-.1-2.2-.3L2.5 14.2l.9-2.6A4.5 4.5 0 012 8.8C2 6.2 4.7 4 8 4s6 2.1 6 4.8z"/>',
    chevron:  '<path d="M6 3.5L10.5 8 6 12.5"/>',
    close:    '<path d="M4 4l8 8M12 4l-8 8"/>',
    plus:     '<path d="M8 3v10M3 8h10"/>',
    upload:   '<path d="M8 11V2.5M4.5 6L8 2.5 11.5 6M2.5 11v2.5h11V11"/>',
    download: '<path d="M8 2.5V11M4.5 7.5L8 11l3.5-3.5M2.5 11v2.5h11V11"/>',
    copy:     '<path d="M5.5 5.5V2.8h7.7v7.7h-2.7M2.8 5.5h7.7v7.7H2.8z"/>',
    key:      '<circle cx="5.4" cy="10.6" r="2.6"/><path d="M7.3 8.7l5.4-5.4M10.6 3.2l2 2M9 4.9l2 2"/>',
    link:     '<path d="M6.6 9.4a2.6 2.6 0 010-3.7l2-2a2.6 2.6 0 013.7 3.7l-1 1M9.4 6.6a2.6 2.6 0 010 3.7l-2 2a2.6 2.6 0 01-3.7-3.7l1-1"/>',
    inbox:    '<path d="M2 8.5h3l1 2h4l1-2h3M2 8.5L4 3h8l2 5.5V13H2V8.5z"/>',
    empty:    '<path d="M2.5 9.5h11M4 9.5L5.5 4h5L12 9.5v3.5h-8V9.5z"/><path d="M6.5 12h3"/>',
    clock:    '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.6"/>',
    info:     '<circle cx="8" cy="8" r="6"/><path d="M8 7.3v4M8 5v.6"/>',
    warn:     '<path d="M8 2.6l5.6 10.2H2.4L8 2.6zM8 6.6v3M8 11.2v.6"/>',
    ok:       '<circle cx="8" cy="8" r="6"/><path d="M5.3 8.2l1.9 1.9 3.6-3.7"/>',
    x:        '<circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4"/>',
    retry:    '<path d="M13.4 8a5.4 5.4 0 11-1.6-3.8M13.6 2.4v2.8h-2.8"/>',
    arrow:    '<path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5"/>',
    // LogOut geometry from the bundled Lucide library, in its native 24px viewBox.
    logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
  };

  SC.icon = function (name, size) {
    var d = P[name] || P.info, s = size || 16;
    return '<svg class="ico"' + (name === 'logout' ? ' aria-hidden="true"' : '') + ' width="' + s + '" height="' + s + '" viewBox="' + (name === 'logout' ? '0 0 24 24' : '0 0 16 16') + '" fill="none" ' +
           'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  };

  /* ======================================================== 徽标 */

  SC.badge = function (text, tone, opts) {
    opts = opts || {};
    var cls = 'badge' + (tone ? ' badge--' + tone : '') + (opts.sm ? ' badge--sm' : '');
    var dot = opts.dot ? '<i class="badge__dot' + (opts.live ? ' badge__dot--live' : '') + '"></i>' : '';
    return '<span class="' + cls + '"' + (opts.title ? ' title="' + SC.esc(opts.title) + '"' : '') + '>' +
           dot + SC.esc(text) + '</span>';
  };

  SC.state = function (on, labels) {
    labels = labels || ['启用', '停用'];
    return '<span class="state state--' + (on ? 'on' : 'off') + '">' +
           '<i class="state__dot"></i>' + SC.esc(on ? labels[0] : labels[1]) + '</span>';
  };

  /* ======================================================== C-01 空间状态标签
     五值 + 「当前无装载商机」附加标注（不是第六个状态值） */

  SC.SPACE_STATES = {
    none:     { label: '未建立空间', tone: null,      enter: false },
    creating: { label: '建立中',     tone: 'neutral',  enter: false, live: true },
    failed:   { label: '建立失败',   tone: 'red',      enter: false },
    normal:   { label: '正常',       tone: 'green',    enter: true },
    archived: { label: '已归档（可解档）', tone: 'neutral', enter: true, readonly: true },
    frozen:   { label: '只读归档',   tone: 'dark',     enter: true, readonly: true }
  };

  SC.spaceState = function (key, opts) {
    opts = opts || {};
    var s = SC.SPACE_STATES[key] || SC.SPACE_STATES.none;
    var out = '<span class="spacestate">';

    if (key === 'none') {
      out += '<span class="spacestate__none">' + SC.esc(s.label) + '</span>';
    } else {
      out += SC.badge(s.label, s.tone, { dot: true, live: !!s.live });
      // 附加标注：正常态且当前无装载商机
      if (key === 'normal' && opts.empty) {
        out += '<span class="spacestate__note" title="合法长期状态，不催办、不进异常清单">当前无装载商机</span>';
      }
    }
    if (key === 'failed' && opts.why) {
      out += '<span class="spacestate__why">' + SC.esc(opts.why) + '</span>';
    }
    return out + '</span>';
  };

  /* ======================================================== C-02 Agent 实例状态
     八值；与空间状态分列，不互相代替 */

  SC.AGENT_STATES = {
    pending:  { label: '待绑定',       tone: 'neutral' },
    binding:  { label: '绑定中',       tone: 'neutral', live: true },
    bound:    { label: '已绑定',       tone: 'brand',   milestone: 'PRD-01 验收线' },
    bindfail: { label: '绑定失败',     tone: 'red',     safe: '不影响本空间业务使用' },
    reading:  { label: '上下文读取中', tone: 'amber',   live: true, safe: '不影响本空间业务使用' },
    ready:    { label: '已就绪',       tone: 'green' },
    readfail: { label: '读取失败',     tone: 'red',     safe: '不影响本空间业务使用' },
    stopped:  { label: '已停止',       tone: 'neutral', safe: '历史输出保留只读' }
  };

  SC.agentState = function (key, opts) {
    opts = opts || {};
    var s = SC.AGENT_STATES[key];
    if (!s) return '<span class="u-t3 u-f12">—</span>';
    var out = '<span class="agentstate">' + SC.badge(s.label, s.tone, { dot: true, live: !!s.live });
    if (s.milestone && opts.milestone !== false) {
      out += '<span class="agentstate__milestone">' + s.milestone + '</span>';
    }
    if (opts.why) out += '<span class="spacestate__why">' + SC.esc(opts.why) + '</span>';
    if (s.safe && opts.safe !== false) out += '<span class="agentstate__safe">' + s.safe + '</span>';
    return out + '</span>';
  };

  /** 空间状态 + 实例状态并列（分列展示，不合并） */
  SC.statePair = function (space, agent, opts) {
    opts = opts || {};
    var rows = [
      ['空间状态', SC.spaceState(space, opts.spaceOpts)],
      ['实例状态', SC.agentState(agent, opts.agentOpts)]
    ];
    if (opts.readyRow) rows.push(['就绪状态', SC.agentState(opts.readyRow)]);
    return '<div class="statepair">' + rows.map(function (r) {
      return '<span class="statepair__k">' + r[0] + '</span><span>' + r[1] + '</span>';
    }).join('') + '</div>';
  };

  /* ======================================================== C-03 商机状态三分区
     归属 / 进行中事项 / 经营结果 —— 不用一个标签覆盖全部含义 */

  SC.OPP_OWN     = { free: '空余', owned: '已归属' };
  SC.OPP_PENDING = { none: '无', apply: '申请中', dispute: '争议申请中', release: '释放审批中',
                     restore: '恢复申请中', source: '来源确认中', handover: '交接中' };
  SC.OPP_RESULT  = { active: '可推进', closed: '已关闭', lost: '已流失', won: '已成单' };

  SC.oppState = function (o, opts) {
    opts = opts || {};
    var ownTxt = o.own === 'free' ? SC.OPP_OWN.free : (SC.OPP_OWN.owned + (o.sales ? '（' + o.sales + '）' : ''));
    var pending = o.pending || 'none';
    var result = o.result || 'active';

    var pendTone = pending === 'none' ? null : (pending === 'dispute' || pending === 'release' ? 'red' : 'amber');
    var resTone  = result === 'active' ? 'green' : (result === 'won' ? 'brand' : 'neutral');

    if (opts.inline) {
      return '<span class="oppstate oppstate--inline">' +
        '<span class="oppstate__seg">' + SC.badge(ownTxt, o.own === 'free' ? 'amber' : 'neutral', { sm: true }) + '</span>' +
        (pending !== 'none' ? '<span class="oppstate__seg">' + SC.badge(SC.OPP_PENDING[pending], pendTone, { sm: true, dot: true, live: true }) + '</span>' : '') +
        '<span class="oppstate__seg">' + SC.badge(SC.OPP_RESULT[result], resTone, { sm: true }) + '</span>' +
        '</span>';
    }

    return '<span class="oppstate">' +
      '<span class="oppstate__seg"><span class="oppstate__k">当前归属</span>' +
        '<span class="oppstate__v">' + SC.esc(ownTxt) + '</span></span>' +
      '<span class="oppstate__seg"><span class="oppstate__k">进行中事项</span>' +
        '<span class="oppstate__v' + (pending !== 'none' ? ' u-warn' : ' u-t3') + '">' + SC.OPP_PENDING[pending] + '</span></span>' +
      '<span class="oppstate__seg"><span class="oppstate__k">经营结果</span>' +
        '<span class="oppstate__v' + (result === 'active' ? ' u-success' : (result === 'won' ? '' : ' u-t2')) + '">' +
        SC.OPP_RESULT[result] + '</span></span>' +
      '</span>';
  };

  /* ======================================================== C-04 客户池标签 */

  SC.poolTags = function (pools, opts) {
    opts = opts || {};
    var max = opts.max || 3;
    if (!pools || !pools.length) {
      return '<span class="pooltags"><span class="pooltag pooltag--unset">未指定</span></span>';
    }
    var shown = pools.slice(0, max);
    var rest = pools.length - shown.length;
    return '<span class="pooltags">' +
      shown.map(function (p) { return '<span class="pooltag">' + SC.esc(p) + '</span>'; }).join('') +
      (rest > 0 ? '<span class="pooltag pooltag--more">+' + rest + '</span>' : '') +
      '</span>';
  };

  /* ======================================================== C-05 组合-空间两层卡 */

  SC.combo = function (c) {
    var spaces = c.spaces || [];
    var head =
      '<div class="combo__head">' +
        '<span class="combo__caret">' + SC.icon('chevron', 14) + '</span>' +
        '<span class="u-grow"><span class="combo__name">' + SC.esc(c.cust) + '</span>' +
          '<div class="combo__meta u-mt2">' +
            '<span>销售 ' + SC.esc(c.sales) + '</span>' +
            '<span>归属商机 ' + c.oppTotal + ' 条' + (c.oppEnded ? '（含已结束 ' + c.oppEnded + ' 条）' : '') + '</span>' +
            '<span>当前空间 ' + spaces.length + ' 个</span>' +
          '</div>' +
        '</span>' +
        SC.badge(c.admit, c.admit === '已通过' ? 'green' : 'neutral', {}) +
      '</div>';

    var body = '<div class="combo__body">';
    if (!spaces.length) {
      body += '<div class="combo__pending">' + SC.icon('info', 13) +
              ' 该组合尚未建立客户工作空间。授权角色仍可查看基础信息、符合激活规则的商机与准入状态。</div>';
    } else {
      body += spaces.map(function (s) {
        return '<div class="combo__space">' +
          '<span class="pooltag">' + SC.esc(s.pool) + '</span>' +
          '<span class="u-grow u-f12 u-t2">装载商机 ' + s.opp + ' 条 · 空间 ' + s.id + '</span>' +
          SC.spaceState(s.state, { empty: !!s.empty }) +
          SC.agentState(s.agent, { safe: false, milestone: false }) +
          (s.state === 'normal' && s.empty
            ? '<button class="btn btn--sm" data-archive="' + s.id + '">归档</button>'
            : (SC.SPACE_STATES[s.state] && SC.SPACE_STATES[s.state].enter
                ? '<a class="btn btn--sm" href="#">进入</a>' : '')) +
          '</div>';
      }).join('');
    }
    if (c.pending) {
      body += '<div class="combo__pending">' + SC.icon('warn', 13) +
              ' <b>待指定承接方 ' + c.pending + ' 条</b>：该部分商机未指定客户池，不装载、不建立空间。' +
              '补齐客户池后按已有有效准入自动落入对应池空间。</div>';
    }
    body += '</div>';

    var node = SC.el('<div class="combo">' + head + body + '</div>');
    node.querySelector('.combo__head').addEventListener('click', function () {
      node.classList.toggle('is-open');
    });
    return node;
  };

  /* ======================================================== C-08 批量结果反馈范式 */

  SC.result = function (o) {
    var nums = '';
    (o.nums || []).forEach(function (n) {
      nums += '<div class="result__num' + (n.tone ? ' result__num--' + n.tone : '') + '">' +
              '<b>' + n.v + '</b><span>' + SC.esc(n.k) + '</span></div>';
    });
    var rows = (o.rows || []).map(function (r) {
      return '<div class="reason-row">' +
        '<span class="reason-row__obj">' + SC.esc(r.obj) + '</span>' +
        '<span class="reason-row__why">' + SC.esc(r.why) + '</span>' +
        (r.act ? '<span class="reason-row__act"><button class="btn btn--link">' + SC.esc(r.act) + '</button></span>' : '') +
        '</div>';
    }).join('');

    return '<div class="result">' +
      '<div class="result__sum">' + nums +
        (o.export ? '<div style="margin-left:auto"><button class="btn btn--sm">' +
          SC.icon('download', 13) + ' 导出明细</button></div>' : '') +
      '</div>' +
      (rows ? '<div class="result__reasons">' + rows + '</div>' : '') +
      '</div>';
  };

  /* ======================================================== C-09 转入确认范式
     统一文案「当前属于 X，将转入 Y」 */

  SC.transfer = function (rows, title) {
    return '<div class="transfer">' +
      '<div class="transfer__head">' + SC.icon('warn', 13) + ' ' +
        SC.esc(title || ('以下 ' + rows.length + ' 项需从原归属转入，逐条确认')) + '</div>' +
      '<div class="transfer__list">' + rows.map(function (r) {
        return '<div class="transfer__row">' +
          '<span class="transfer__obj">' + SC.esc(r.obj) + '</span>' +
          '<span class="transfer__from">当前属于 ' + SC.esc(r.from) + '</span>' +
          '<span class="transfer__arrow">' + SC.icon('arrow', 12) + '</span>' +
          '<span class="transfer__to">将转入 ' + SC.esc(r.to) + '</span>' +
          '</div>';
      }).join('') + '</div></div>';
  };

  /* ======================================================== C-10 影响提示区 */

  SC.impact = function (o) {
    var cells = (o.cells || []).map(function (c) {
      return '<div class="impact__cell"><div class="impact__n">' + c.v + '</div>' +
             '<div class="impact__l">' + SC.esc(c.k) + '</div></div>';
    }).join('');
    return '<div class="impact' + (o.danger ? ' impact--danger' : '') + '">' +
      '<div class="impact__head">' + SC.icon(o.danger ? 'warn' : 'info', 14) + ' ' + SC.esc(o.title) + '</div>' +
      (cells ? '<div class="impact__grid">' + cells + '</div>' : '') +
      (o.note ? '<div class="impact__note">' + o.note + '</div>' : '') +
      '</div>';
  };

  /* ======================================================== C-11 空状态范式 */

  SC.empty = function (o) {
    o = o || {};
    var acts = (o.actions || []).map(function (a) {
      return '<button class="btn ' + (a.primary ? 'btn--primary' : '') + ' btn--sm">' + SC.esc(a.label) + '</button>';
    }).join('');
    return '<div class="empty' + (o.sm ? ' empty--sm' : '') + '">' +
      '<div class="empty__ico">' + SC.icon(o.icon || 'empty', 22) + '</div>' +
      '<div class="empty__title">' + SC.esc(o.title || '暂无数据') + '</div>' +
      (o.reason ? '<div class="empty__reason">' + o.reason + '</div>' : '') +
      (acts ? '<div class="empty__acts">' + acts + '</div>' : '') +
      '</div>';
  };

  /* ======================================================== C-12 依据引用 */

  SC.evidence = function (e) {
    return '<span class="evidence" title="记录类型 + 记录标识 + 可定位位置 + 引用用途">' +
      '<span class="evidence__type">' + SC.esc(e.type) + '</span>' +
      '<span class="evidence__id">' + SC.esc(e.id) + '</span>' +
      (e.fixed ? '<span class="evidence__fixed">已更正</span>' : '') +
      SC.icon('link', 11) +
      '</span>';
  };

  /** 按引用用途分组展示 */
  SC.evidenceGroup = function (list) {
    var uses = {};
    (list || []).forEach(function (e) { (uses[e.use] = uses[e.use] || []).push(e); });
    return '<div class="evidence-group">' + Object.keys(uses).map(function (u) {
      return '<div><div class="evidence-group__k u-mb2">' + SC.esc(u) + '</div>' +
        '<div class="u-row u-wrap u-g2">' + uses[u].map(SC.evidence).join('') + '</div></div>';
    }).join('') + '</div>';
  };

  /* ======================================================== 关系快照前后对照 */

  SC.snapshot = function (rows) {
    return '<div class="snapshot">' + rows.map(function (r) {
      /* 未变更的行不加删除线——「保持不变」本身是有意义的快照内容 */
      var same = r.before === r.after || /未变更|不变|保持/.test(r.after);
      return '<span class="snapshot__k">' + SC.esc(r.k) + '</span>' +
        '<span class="' + (same ? 'snapshot__same' : 'snapshot__before') + '">' + SC.esc(r.before) + '</span>' +
        '<span class="snapshot__arrow">' + SC.icon(same ? 'ok' : 'arrow', 12) + '</span>' +
        '<span class="' + (same ? 'snapshot__same' : 'snapshot__after') + '">' + SC.esc(r.after) + '</span>';
    }).join('') + '</div>';
  };

  /* ======================================================== 提示条 */

  SC.note = function (text, tone, icon) {
    return '<div class="note' + (tone ? ' note--' + tone : '') + '">' +
      '<span class="note__ico">' + SC.icon(icon || (tone === 'warn' ? 'warn' : (tone === 'danger' ? 'x' : 'info')), 14) + '</span>' +
      '<div>' + text + '</div></div>';
  };

  /* ======================================================== 弹窗 */

  SC.modal = function (o) {
    var mask = SC.el(
      '<div class="mask">' +
        '<div class="modal' + (o.size ? ' modal--' + o.size : '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal__head">' +
            '<div><div class="modal__title">' + SC.esc(o.title) + '</div>' +
            (o.sub ? '<div class="modal__sub">' + o.sub + '</div>' : '') + '</div>' +
            '<button class="modal__x" aria-label="关闭">' + SC.icon('close', 14) + '</button>' +
          '</div>' +
          '<div class="modal__body"></div>' +
          '<div class="modal__foot' + (o.footSplit ? ' modal__foot--split' : '') + '"></div>' +
        '</div>' +
      '</div>');

    var body = mask.querySelector('.modal__body');
    if (typeof o.body === 'string') body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);

    var foot = mask.querySelector('.modal__foot');
    (o.buttons || [{ label: '关闭', close: true }]).forEach(function (b) {
      if (b.spacer) { foot.appendChild(SC.el('<div class="u-grow"></div>')); return; }
      var btn = SC.el('<button class="btn ' + (b.cls || '') + '">' + SC.esc(b.label) + '</button>');
      if (b.disabled) btn.disabled = true;
      btn.addEventListener('click', function () {
        if (b.onClick) b.onClick(close, body);
        if (b.close !== false && !b.onClick) close();
      });
      foot.appendChild(btn);
    });

    function close() {
      mask.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    mask.querySelector('.modal__x').addEventListener('click', close);
    mask.addEventListener('mousedown', function (e) { if (e.target === mask) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(mask);
    return { close: close, body: body, root: mask };
  };

  /* ======================================================== Toast */

  SC.toast = function (msg, tone) {
    var host = SC.qs('.toast-host');
    if (!host) { host = SC.el('<div class="toast-host"></div>'); document.body.appendChild(host); }
    var ico = tone === 'ok' ? 'ok' : (tone === 'bad' ? 'x' : 'info');
    var t = SC.el('<div class="toast' + (tone ? ' toast--' + tone : '') + '">' + SC.icon(ico, 14) + SC.esc(msg) + '</div>');
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .2s, transform .2s';
      t.style.opacity = '0'; t.style.transform = 'translateY(-6px)';
      setTimeout(function () { t.remove(); }, 220);
    }, tone === 'bad' ? 3200 : 1900);
  };

  /* ======================================================== 复制按钮 */

  SC.copyBtn = function (text, label) {
    var b = SC.el('<button class="copy" title="复制' + SC.esc(label || '') + '">' +
                  SC.icon('copy', 11) + '<span>复制</span></button>');
    b.addEventListener('click', function () {
      var done = function (ok) {
        if (!ok) { SC.toast('复制失败，请手动选择内容复制', 'bad'); return; }
        b.classList.add('is-done');
        b.querySelector('span').textContent = '已复制';
        SC.toast('已复制' + (label ? '：' + label : ''), 'ok');
        setTimeout(function () {
          b.classList.remove('is-done');
          b.querySelector('span').textContent = '复制';
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        try {
          var ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          done(document.execCommand('copy'));
          ta.remove();
        } catch (err) { done(false); }
      }
    });
    return b;
  };

  /* ======================================================== 分页 */

  SC.pager = function (o) {
    var total = o.total, size = o.size || 20, page = o.page || 1;
    var pages = Math.max(1, Math.ceil(total / size));
    var btns = '';
    for (var i = 1; i <= Math.min(pages, 5); i++) {
      btns += '<button class="pager__pg' + (i === page ? ' is-active' : '') + '">' + i + '</button>';
    }
    if (pages > 5) btns += '<span class="u-t3">…</span><button class="pager__pg">' + pages + '</button>';
    return '<div class="pager">' +
      '<span>共 <b class="u-num">' + total + '</b> 条 · 每页 ' + size + ' 条</span>' +
      '<div class="pager__pages">' +
        '<button class="pager__pg"' + (page === 1 ? ' disabled' : '') + '>上一页</button>' +
        btns +
        '<button class="pager__pg"' + (page === pages ? ' disabled' : '') + '>下一页</button>' +
      '</div></div>';
  };

  /* ======================================================== 表格全选联动 */

  SC.wireCheckAll = function (root, onChange) {
    var all = SC.qs('[data-check-all]', root);
    var boxes = SC.qsa('[data-check-row]', root);
    function sync() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      if (all) {
        all.checked = n > 0 && n === boxes.length;
        all.indeterminate = n > 0 && n < boxes.length;
      }
      boxes.forEach(function (b) {
        var tr = b.closest('tr');
        if (tr) tr.classList.toggle('is-selected', b.checked);
      });
      if (onChange) onChange(n, boxes.filter(function (b) { return b.checked; }));
    }
    if (all) all.addEventListener('change', function () {
      boxes.forEach(function (b) { if (!b.disabled) b.checked = all.checked; });
      sync();
    });
    boxes.forEach(function (b) { b.addEventListener('change', sync); });
    sync();
    return { sync: sync, boxes: boxes };
  };

  /* ======================================================== 页签 */

  SC.wireTabs = function (root, onSwitch) {
    var tabs = SC.qsa('.tab', root);
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('is-active'); });
        t.classList.add('is-active');
        if (onSwitch) onSwitch(t.dataset.tab, t);
      });
    });
  };

  /* ======================================================== 原型脚手架说明条 */

  SC.protoNote = function (text) {
    return '<div class="note" style="border-style:dashed">' +
      '<span class="note__ico">' + SC.icon('info', 14) + '</span>' +
      '<div><b>原型说明</b>　' + text + '</div></div>';
  };

})(window.SC);
