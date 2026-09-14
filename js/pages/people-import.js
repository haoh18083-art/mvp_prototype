/* ==========================================================================
   P-ADM-04 批量导入页 · 来源 M01 §4.2 批量导入创建
   三步：上传文件（模板下载区 / 文件上传区）→ 检测结果（结果汇总 / 明细 / 操作）
        → 导入结果（结果汇总区）

   真实文件解析：上传的 .xlsx / .csv 由 SC.readWorkbook 实解析，
   合法性由 SC.validateImport 按 M01 §4.2 判定规则校验，不再使用预置检测数据。
   建议初值：单批 500 行、5MB；超容量提示拆批，不静默截断。
   文件级失败在上传区直接提示、不进入逐行检测；全部行不合法不产生任何账号。
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;
  var MAX_ROWS = 500;
  var MAX_BYTES = 5 * 1024 * 1024;

  var STEP = 1;
  var CUR = null;   /* SC.validateImport 的返回值 */

  /* 系统内已存在的邮箱（规范化）→ 展示名，用于「已存在无法重复创建」判定 */
  var EXISTING = (function () {
    var m = {};
    function add(list) {
      (list || []).forEach(function (p) {
        var full = (p.email + '@teddymobile.cn').toLowerCase();
        m[full] = p.name + ' ' + p.id;
      });
    }
    add(D.PEOPLE);
    add(D.ROLE_POOL);
    return m;
  })();

  /* 演示样例：均为仓库内的真实 .xlsx，点击后走与手动上传完全相同的解析与校验管线 */
  var SAMPLES = [
    { f: 'sample-mixed.xlsx',        t: '混合结果（3 合法 / 3 不合法）' },
    { f: 'sample-dup.xlsx',          t: '同一文件内邮箱重复' },
    { f: 'sample-allbad.xlsx',       t: '全部行不合法' },
    { f: 'sample-not-template.xlsx', t: '文件级：非模板格式' },
    { f: 'sample-missing-cols.xlsx', t: '文件级：模板列不完整' },
    { f: 'sample-empty.xlsx',        t: '文件级：无数据行' },
    { f: 'sample-oversize.xlsx',     t: '文件级：超出单批上限' }
  ];

  SC.page({
    role: 'ADM', menu: 'people', pid: 'P-ADM-04',
    title: '批量导入人员',
    crumb: [{ t: '人员与账号', href: 'people-list.html' }],
    desc: '导入仅用于<b>创建新账号</b>，不支持通过导入更新已有人员信息。'
  }, function (body) {
    render(body);
  });

  function steps() {
    var s = [{ n: 1, t: '上传文件' }, { n: 2, t: '检测结果' }, { n: 3, t: '导入结果' }];
    return '<div class="steps u-mb4">' + s.map(function (x, i) {
      var cls = x.n === STEP ? 'is-active' : (x.n < STEP ? 'is-done' : '');
      return (i ? '<span class="steps__line"></span>' : '') +
        '<span class="step ' + cls + '"><span class="step__n">' +
        (x.n < STEP ? SC.icon('check', 11) : x.n) + '</span>' + x.t + '</span>';
    }).join('') + '</div>';
  }

  function render(body) {
    if (STEP === 1) return renderUpload(body);
    if (STEP === 2) return renderCheck(body);
    return renderResult(body);
  }

  /* ---------------------------------------------- 第 1 步：模板下载区 + 文件上传区 */

  function renderUpload(body) {
    var samples = SAMPLES.map(function (s) {
      return '<button class="btn btn--sm" data-sample="' + s.f + '">' + SC.esc(s.t) + '</button>';
    }).join('');

    body.innerHTML = steps() +
      '<div class="sc-split">' +
        '<div>' +
          '<div class="card"><div class="card__head">' +
            '<div class="card__title">文件上传</div></div>' +
          '<div class="card__body">' +
            '<input type="file" id="file" accept=".xlsx,.csv" hidden>' +
            '<div class="dropzone" id="dz">' +
              '<div class="dropzone__ico">' + SC.icon('upload', 26) + '</div>' +
              '<div class="dropzone__t">点击选择文件，或将文件拖放到此处</div>' +
              '<div class="dropzone__d">支持 .xlsx / .csv ·  单批不超过 ' + MAX_ROWS + ' 行、5MB' +
                '<br><span class="u-t3">容量参数为建议初值，最终数值待联调确认</span></div>' +
            '</div>' +
            '<div id="fileerr" class="u-mt3"></div>' +
            '<div class="u-mt4 u-f12 u-t2">' +
              '<div class="u-semi u-t1 u-mb2">演示样例（真实文件，点击即上传解析）</div>' +
              '<div class="btn-group u-wrap">' + samples + '</div>' +
              '<div class="u-t3 u-mt2">样例通过 http 访问加载；若在本地直接双击打开 index.html，' +
                '请改用上方「下载导入模板 / 样例」后手动拖入。</div>' +
            '</div>' +
          '</div></div>' +
        '</div>' +
        '<div>' +
          '<div class="card"><div class="card__head">' +
            '<div class="card__title">模板下载</div></div>' +
          '<div class="card__body">' +
            '<a class="btn btn--block" href="../assets/people-import-template.xlsx" ' +
              'download="人员导入模板.xlsx">' + SC.icon('download', 14) + ' 下载导入模板</a>' +
            '<div class="u-mt2 u-f12 u-t3">.xlsx · 两页：<b>数据填写页</b>' +
              '（只有表头，不预置示例行）+ <b>填写说明页</b></div>' +
            '<div class="u-mt4 u-f12 u-t2" style="line-height:1.8">' +
              '<div class="u-semi u-t1 u-mb2">填写要点</div>' +
              '· 姓名、邮箱、<b>密码</b>、手机号<b>均为必填</b>，任一留空该行即不合法<br>' +
              '· 邮箱后缀必须为 <b>@teddymobile.cn</b>，需填写完整地址<br>' +
              '· 同一文件内邮箱重复的，<b>重复行全部不合法</b>，需人工确认保留哪一条<br>' +
              '· <b>角色留空</b>将进入待分配角色池，分配后仍需超管手动启用<br>' +
              '· 角色只能是销售、销售主管、解决方案人员、超级管理员<br>' +
              '· 模板不含钉钉身份列，需在人员详情逐个维护' +
            '</div>' +
            '<div class="u-mt4">' + SC.note('完整规则以<b>模板内填写说明页</b>为准。', 'info') + '</div>' +
          '</div></div>' +
        '</div>' +
      '</div>';

    var dz = SC.qs('#dz', body);
    var input = SC.qs('#file', body);
    var box = SC.qs('#fileerr', body);

    dz.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0], body, box);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('is-over'); });
    });
    dz.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f, body, box);
    });

    SC.qsa('[data-sample]', body).forEach(function (b) {
      b.addEventListener('click', function () { loadSample(b.dataset.sample, body, box); });
    });
  }

  /* 拉取仓库内真实样例文件，包装为 File 后走同一管线 */
  function loadSample(fname, body, box) {
    box.innerHTML = SC.note('正在加载样例 ' + SC.esc(fname) + ' …', 'info');
    fetch('../assets/samples/' + fname).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (blob) {
      handleFile(new File([blob], fname), body, box);
    }).catch(function () {
      box.innerHTML = SC.note(
        '样例需通过 http 访问加载（如 GitHub Pages 或本地服务器）。' +
        '本地直接双击打开时，请下载样例文件后拖入上传区。', 'warn');
    });
  }

  /* 上传：先做体积与解析的文件级检测，未通过留在本步；通过则交给 validateImport */
  function handleFile(file, body, box) {
    if (file.size > MAX_BYTES) {
      return showFileErr(box, {
        t: '文件超过 5MB 上限，请拆批上传',
        d: '本文件约 ' + (file.size / 1024 / 1024).toFixed(1) + 'MB，超过单批 5MB 上限。' +
           '请拆分为多批上传，系统不会静默截断，也不会开始导入。'
      }, file.name);
    }
    box.innerHTML = SC.note('正在解析 ' + SC.esc(file.name) + ' …', 'info');
    SC.readWorkbook(file).then(function (wb) {
      return SC.validateImport(wb, { name: file.name, existingEmails: EXISTING, maxRows: MAX_ROWS });
    }).then(function (res) {
      CUR = res;
      if (res.fileErr) { showFileErr(box, res.fileErr, res.name); return; }
      box.innerHTML = '';
      STEP = 2;
      render(body);
    }).catch(function (err) {
      showFileErr(box, mapReadErr(err), file.name);
    });
  }

  function mapReadErr(err) {
    var code = err && err.code;
    if (code === 'NOT_ZIP') return {
      t: '文件格式不正确，请使用系统提供的导入模板',
      d: '该文件不是有效的 .xlsx（或已损坏）。请使用系统提供的导入模板，或上传 UTF-8 编码的 .csv。'
    };
    if (code === 'NO_INFLATE') return {
      t: '当前浏览器无法解析 .xlsx',
      d: '请使用较新的 Chrome / Edge，或改上传 UTF-8 编码的 .csv 文件。'
    };
    if (code === 'BAD_ENCODING') return {
      t: 'CSV 编码不正确',
      d: '请将文件另存为 <b>UTF-8</b> 编码的 CSV 后重新上传。'
    };
    return { t: '文件无法解析', d: SC.esc((err && err.message) || '未知错误') };
  }

  /* 文件级失败：停在第 1 步，直接在上传区展示原因，不进入逐行检测 */
  function showFileErr(box, fe, name) {
    box.innerHTML =
      '<div class="note note--danger">' +
        '<span class="note__ico">' + SC.icon('x', 14) + '</span>' +
        '<div>' +
          (name ? '<div class="u-semi">' + SC.esc(name) + ' 检测未通过</div>' : '') +
          '<div class="u-semi u-mt2">' + SC.esc(fe.t) + '</div>' +
          '<div class="u-f12 u-mt2">' + fe.d + '</div>' +
          '<div class="u-f12 u-mt2">整份文件<b>不进入逐行检测</b>，不展示行级明细，本次不产生任何账号。</div>' +
        '</div>' +
      '</div>';
    SC.toast('文件级检测未通过，未进入逐行检测', 'bad');
  }

  /* ---------------------------------------------- 第 2 步：检测结果页 */

  function renderCheck(body) {
    var rows = CUR.rows;
    var okN = CUR.summary.ok;
    var badN = CUR.summary.bad;
    var onlyBad = okN === 0;   /* 全部不合法时直接停在不合法视图 */

    body.innerHTML = steps() +
      '<div class="card">' +
        '<div class="card__head">' +
          '<div><div class="card__title">检测结果</div>' +
          '<div class="card__sub">' + SC.esc(CUR.name) + '</div></div>' +
          '<div class="seg" id="seg">' +
            '<button class="seg__btn' + (onlyBad ? '' : ' is-active') + '" data-v="all">全部 ' + rows.length + '</button>' +
            '<button class="seg__btn' + (onlyBad ? ' is-active' : '') + '" data-v="bad">只看不合法 ' + badN + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="result__sum" style="border-radius:0">' +
          '<div class="result__num"><b>' + rows.length + '</b><span>总行数</span></div>' +
          '<div class="result__num result__num--ok"><b>' + okN + '</b><span>合法行数</span></div>' +
          '<div class="result__num result__num--bad"><b>' + badN + '</b><span>不合法行数</span></div>' +
        '</div>' +
        '<div class="table-wrap--scroll">' +
        '<table class="table"><thead><tr>' +
          '<th style="width:56px">行号</th>' +
          '<th>原始填写内容<div class="table__sub">姓名 ｜ 邮箱 ｜ 手机号 ｜ 密码 ｜ 角色</div></th>' +
          '<th style="width:88px">判定</th><th>失败原因</th>' +
        '</tr></thead><tbody id="cb"></tbody></table></div>' +
      '</div>' +
      (okN === 0
        ? '<div class="u-mt5">' + SC.note(
            '<b>本次没有可导入的数据。</b>全部 ' + rows.length + ' 行均不合法，' +
            '不产生任何账号，也不会创建半成品数据。请导出清单、按原因修正后重新上传。', 'danger') + '</div>'
        : '') +
      (CUR.note ? '<div class="u-mt4">' + SC.note(CUR.note, 'warn') + '</div>' : '') +
      '<div class="u-mt5 u-row u-between">' +
        '<button class="btn" id="back">上一步</button>' +
        '<div class="btn-group">' +
          '<button class="btn" id="exp">' + SC.icon('download', 14) + ' 导出不合法数据清单</button>' +
          '<button class="btn btn--primary" id="go"' + (okN === 0 ? ' disabled' : '') + '>' +
            '确认导入合法数据（' + okN + ' 行）</button>' +
        '</div>' +
      '</div>' +
      '<div class="u-mt4">' + SC.note(
        '导出的清单<b>附带每行失败原因</b>，修正后可重新上传。一行存在多个问题时全部展示，不只报第一个。' +
        '不合法行<b>不阻断</b>同一批次中合法行的导入。', 'info') + '</div>';

    function paint() {
      var list = onlyBad ? rows.filter(function (r) { return !r.ok; }) : rows;
      SC.qs('#cb', body).innerHTML = list.map(function (r) {
        return '<tr' + (r.ok ? '' : ' class="is-muted"') + '>' +
          '<td class="u-num u-t3">' + r.line + '</td>' +
          '<td class="u-f12">' + rawLine(r) +
            (r.note ? '<div class="table__sub">' + SC.esc(r.note) + '</div>' : '') + '</td>' +
          '<td>' + (r.ok ? SC.badge('合法', 'green', { sm: true }) : SC.badge('不合法', 'red', { sm: true })) + '</td>' +
          '<td class="u-f12">' + (r.errs.length
            ? r.errs.map(function (e) { return '<div class="u-danger">· ' + SC.esc(e) + '</div>'; }).join('')
            : '<span class="u-t3">—</span>') + '</td>' +
          '</tr>';
      }).join('');
    }
    paint();

    SC.qsa('.seg__btn', body).forEach(function (b) {
      b.addEventListener('click', function () {
        SC.qsa('.seg__btn', body).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        onlyBad = b.dataset.v === 'bad';
        paint();
      });
    });

    SC.qs('#back', body).addEventListener('click', function () { STEP = 1; render(body); });
    SC.qs('#go', body).addEventListener('click', function () {
      if (okN === 0) { SC.toast('本次没有可导入的数据', 'bad'); return; }
      STEP = 3; render(body);
    });
    SC.qs('#exp', body).addEventListener('click', function () {
      SC.toast('原型不提供真实文件导出', 'bad');
    });
  }

  /* 原始填写内容：留空显示「（留空）」，密码只显示是否填写、不回显内容 */
  function rawLine(r) {
    var v = function (x) { return x ? SC.esc(x) : '<span class="u-danger">（留空）</span>'; };
    return [
      v(r.name), v(r.mailRaw), v(r.phone),
      r.pwd ? '已填写' : '<span class="u-danger">（留空）</span>',
      r.role ? SC.esc(r.role) : '<span class="u-t3">（留空）</span>'
    ].join(' <span class="u-t3">｜</span> ');
  }

  /* ---------------------------------------------- 第 3 步：导入结果页 */

  function renderResult(body) {
    var okRows = CUR.rows.filter(function (r) { return r.ok; });
    var pool = CUR.summary.pool;

    body.innerHTML = steps() +
      SC.result({
        nums: [
          { k: '成功创建', v: okRows.length, tone: 'ok' },
          { k: '进入待分配角色池', v: pool },
          { k: '直接可登录', v: okRows.length - pool }
        ]
      }) +
      '<div class="u-mt5 card"><div class="card__head"><div class="card__title">本次创建的人员</div>' +
        '<div class="card__sub">' + SC.esc(CUR.name) + '</div></div>' +
      '<div class="card__body card__body--flush">' +
        '<table class="table table--compact"><thead><tr>' +
          '<th>姓名</th><th>邮箱</th><th>角色</th><th>后续动作</th>' +
        '</tr></thead><tbody>' +
        okRows.map(function (r) {
          return '<tr>' +
            '<td class="u-medium">' + SC.esc(r.name) + '</td>' +
            '<td class="mono u-f12 u-t2">' + SC.esc(r.mail) + '</td>' +
            '<td>' + (r.role ? SC.badge(r.role, 'neutral', { sm: true })
                             : '<span class="badge badge--amber badge--sm">未分配</span>') + '</td>' +
            '<td class="u-f12 u-t2">' + (r.role
              ? (r.role === '销售' ? '需归入销售分组' : (r.role === '解决方案人员' ? '需分配客户池' : '可直接登录'))
              : '需在待分配角色池分配角色') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table>' +
      '</div></div>' +
      '<div class="u-mt5 btn-group">' +
        '<a class="btn btn--primary" href="people-list.html">返回人员列表</a>' +
        (pool ? '<a class="btn" href="role-pool.html">前往待分配角色池（' + pool + '）</a>' : '') +
        '<button class="btn" id="again">再导入一批</button>' +
      '</div>';

    SC.qs('#again', body).addEventListener('click', function () { STEP = 1; CUR = null; render(body); });
  }

})(window.SC);
