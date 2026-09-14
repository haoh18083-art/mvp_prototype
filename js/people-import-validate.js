/* ==========================================================================
   P-ADM-04 批量导入合法性校验 · 来源 M01 §4.2「合法性判定规则」与「检测失败提示规则」
   纯逻辑，无 DOM 依赖，可被页面与自动化测试共用。

   SC.validateImport(workbook, opts) → Promise<{
     name, fileErr:{code,t,d}|null, note,
     rows: [{ line, name, mailRaw, mail, phone, pwd, role, ok, errs, note }],
     summary: { total, ok, bad, pool }
   }>
   workbook 为 SC.readWorkbook 的返回值；opts.existingEmails 为 {规范化邮箱: 展示名}，
   opts.maxRows 为单批行数上限。文件级失败时 rows 为空，不进入逐行明细。
   ========================================================================== */

(function (SC) {
  'use strict';

  var SUFFIX = '@teddymobile.cn';
  var HEADERS = ['姓名', '邮箱', '密码', '手机号', '角色'];
  var REQUIRED = ['姓名', '邮箱', '密码', '手机号'];
  var ROLES = ['销售', '销售主管', '解决方案人员', '超级管理员'];
  var DATA_SHEET = '数据填写页';
  var PHONE_RE = /^1[3-9]\d{9}$/;
  var PREFIX_RE = /^[a-z0-9._-]+$/;

  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function val(cells, idx) { return idx == null ? '' : String(cells[idx] == null ? '' : cells[idx]); }

  var FILE_ERR = {
    NOT_TEMPLATE: {
      t: '文件格式不正确，请使用系统提供的导入模板',
      d: '未识别到模板表头（姓名 / 邮箱 / 密码 / 手机号 / 角色）。请从<b>模板下载区</b>获取模板后重新填写。'
    },
    NO_DATA: {
      t: '未检测到可导入数据，请填写后重新上传',
      d: '数据填写页只有表头、没有任何数据行。<b>填写说明页不参与检测</b>，说明页的示例不会被当作真实数据导入。'
    }
  };

  function missingCols(list) {
    return {
      code: 'MISSING_COLS',
      t: '模板列不完整，请重新下载模板后填写',
      d: '缺少 <b>' + list.join('、') + '</b> 列，或列名已被修改。请勿增删、改名模板列，直接在原模板上填写。'
    };
  }

  function oversize(n, max) {
    return {
      code: 'OVERSIZE',
      t: '单批数据超出上限，请拆批上传',
      d: '本次共 <b>' + n + '</b> 行，超过单批 <b>' + max + '</b> 行上限。请拆分为多批，' +
         '每批不超过 ' + max + ' 行、5MB。系统不会静默截断，也不会开始导入。'
    };
  }

  function pickSheet(wb) {
    for (var i = 0; i < wb.sheetNames.length; i++) {
      if (wb.sheetNames[i] === DATA_SHEET) return DATA_SHEET;
    }
    return wb.sheetNames[0];
  }

  /* ---------------------------------------------------------------- 行级校验 */

  function checkRows(dataRows, colMap, existing) {
    var parsed = dataRows.map(function (row) {
      var mailRaw = val(row.cells, colMap['邮箱']).trim();
      var mail = norm(mailRaw);
      var parts = mail.split('@');
      var structOk = parts.length === 2 && parts[0] !== '' && parts[1] !== '';
      return {
        line: row.r,
        name: val(row.cells, colMap['姓名']).trim(),
        mailRaw: mailRaw,
        mail: mail,
        prefix: structOk ? parts[0] : '',
        domain: structOk ? ('@' + parts[1]) : '',
        structOk: structOk,
        phone: val(row.cells, colMap['手机号']).trim(),
        pwdFilled: val(row.cells, colMap['密码']).trim() !== '',
        role: val(row.cells, colMap['角色']).trim()
      };
    });

    /* 同一文件内邮箱重复：仅对结构完整的邮箱分组，重复行均不合法 */
    var groups = {};
    parsed.forEach(function (p) {
      if (!p.structOk) return;
      (groups[p.mail] = groups[p.mail] || []).push(p.line);
    });

    return parsed.map(function (p) {
      var errs = [];

      var miss = REQUIRED.filter(function (h) {
        if (h === '姓名') return p.name === '';
        if (h === '邮箱') return p.mailRaw === '';
        if (h === '密码') return !p.pwdFilled;
        if (h === '手机号') return p.phone === '';
        return false;
      });
      if (miss.length) errs.push('缺少必填项：' + miss.join('、'));

      if (p.mailRaw !== '') {
        if (!p.structOk) {
          errs.push('邮箱格式不正确，请填写完整邮箱地址');
        } else {
          if (!PREFIX_RE.test(p.prefix)) errs.push('邮箱中包含空格、中文或其他不允许的字符');
          if (p.domain !== SUFFIX) errs.push('邮箱后缀不正确，须使用 @teddymobile.cn');
        }
      }

      if (p.phone !== '' && !PHONE_RE.test(p.phone)) errs.push('手机号格式不正确');

      if (p.structOk && existing[p.mail]) {
        errs.push('该邮箱已存在于系统中，无法重复创建（' + existing[p.mail] + '）');
      }

      var dup = p.structOk && groups[p.mail] && groups[p.mail].length > 1;
      if (dup) {
        errs.push('该邮箱在本次文件中重复出现（第 ' + groups[p.mail].join('、') +
                  ' 行），请确认保留哪一条');
      }

      if (p.role !== '' && ROLES.indexOf(p.role) < 0) {
        errs.push('角色填写有误，请使用模板中提供的选项');
      }

      var ok = errs.length === 0;
      var note = '';
      if (ok && p.role === '') note = '角色留空 → 进入待分配角色池';
      else if (dup && p.mailRaw !== p.mail) {
        note = '原文填写「' + p.mailRaw + '」，去除首尾空格并统一小写后参与判重';
      }

      return {
        line: p.line, name: p.name, mailRaw: p.mailRaw, mail: p.mail,
        phone: p.phone, pwd: p.pwdFilled, role: p.role, ok: ok, errs: errs, note: note
      };
    });
  }

  /* ---------------------------------------------------------------- 入口 */

  SC.validateImport = function (wb, opts) {
    opts = opts || {};
    var existing = opts.existingEmails || {};
    var maxRows = opts.maxRows || 500;
    var name = opts.name || '导入文件';

    function done(fileErr, rows, note) {
      var okRows = (rows || []).filter(function (r) { return r.ok; });
      return {
        name: name,
        fileErr: fileErr || null,
        note: note || '',
        rows: rows || [],
        summary: {
          total: (rows || []).length,
          ok: okRows.length,
          bad: (rows || []).length - okRows.length,
          pool: okRows.filter(function (r) { return r.role === ''; }).length
        }
      };
    }

    var sheetName = pickSheet(wb);
    if (!sheetName) return Promise.resolve(done(FILE_ERR.NOT_TEMPLATE));

    return Promise.resolve(wb.sheet(sheetName)).then(function (sheet) {
      var rows = (sheet && sheet.rows) || [];
      if (!rows.length) return done(FILE_ERR.NO_DATA);

      var header = rows[0].cells.map(function (c) { return String(c == null ? '' : c).trim(); });
      var colMap = {};
      HEADERS.forEach(function (h) {
        var idx = header.indexOf(h);
        if (idx >= 0) colMap[h] = idx;
      });
      var found = HEADERS.filter(function (h) { return colMap[h] != null; });
      if (!found.length) return done(FILE_ERR.NOT_TEMPLATE);
      if (found.length < HEADERS.length) {
        return done(missingCols(HEADERS.filter(function (h) { return colMap[h] == null; })));
      }

      var dataRows = rows.slice(1);
      if (!dataRows.length) return done(FILE_ERR.NO_DATA);
      if (dataRows.length > maxRows) return done(oversize(dataRows.length, maxRows));

      var checked = checkRows(dataRows, colMap, existing);
      var hasDup = checked.some(function (r) {
        return r.errs.some(function (e) { return e.indexOf('本次文件中重复出现') >= 0; });
      });
      var note = hasDup
        ? '同一文件内存在<b>重复邮箱</b>：重复行均判定为不合法，系统不自动保留其中任意一条；' +
          '需人工确认保留哪一条后修正重传。其余合法行不受影响，可照常导入。'
        : '';
      return done(null, checked, note);
    });
  };

})(window.SC);
