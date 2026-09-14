/* ==========================================================================
   最小 .xlsx / .csv 读取器 · 供 P-ADM-04 批量导入做真实文件解析
   零依赖：ZIP 用浏览器内置 DecompressionStream('deflate-raw') 解压，
           XML 用 DOMParser 解析，不引入任何第三方库。
   只读取单元格文本，不处理公式、样式、日期序列号与加密文件。

   SC.readWorkbook(file) → Promise<{
     kind: 'xlsx' | 'csv',
     sheetNames: [String],
     sheet(name)  → { rows: [{ r, cells: [String] }] }   仅含非空行，r 为真实行号
   }>
   失败时 reject 带 code 的 Error：NOT_ZIP / NO_WORKBOOK / NO_INFLATE / BAD_ENCODING
   ========================================================================== */

(function (SC) {
  'use strict';

  function fail(code, msg) {
    var e = new Error(msg || code);
    e.code = code;
    return e;
  }

  /* ------------------------------------------------------------ 解压 */

  function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function' || typeof ReadableStream !== 'function') {
      return Promise.reject(fail('NO_INFLATE', '当前浏览器不支持内置解压'));
    }
    var src = new ReadableStream({
      start: function (c) { c.enqueue(bytes); c.close(); }
    });
    var reader = src.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    var chunks = [];
    var size = 0;
    function pump() {
      return reader.read().then(function (res) {
        if (res.done) {
          var out = new Uint8Array(size);
          var at = 0;
          chunks.forEach(function (c) { out.set(c, at); at += c.length; });
          return out;
        }
        chunks.push(res.value);
        size += res.value.length;
        return pump();
      });
    }
    return pump();
  }

  /* ------------------------------------------------------------ ZIP 目录 */

  function u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 16777216; }

  function readZip(bytes) {
    var eocd = -1;
    var from = Math.max(0, bytes.length - 66000);
    for (var i = bytes.length - 22; i >= from; i--) {
      if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
        eocd = i; break;
      }
    }
    if (eocd < 0) throw fail('NOT_ZIP', '不是有效的 .xlsx 文件');

    var count = u16(bytes, eocd + 10);
    var at = u32(bytes, eocd + 16);
    var entries = {};
    var dec = new TextDecoder('utf-8');
    for (var n = 0; n < count; n++) {
      if (u32(bytes, at) !== 0x02014b50) break;
      var nameLen = u16(bytes, at + 28);
      var extraLen = u16(bytes, at + 30);
      var cmtLen = u16(bytes, at + 32);
      entries[dec.decode(bytes.subarray(at + 46, at + 46 + nameLen))] = {
        method: u16(bytes, at + 10),
        size: u32(bytes, at + 20),
        offset: u32(bytes, at + 42)
      };
      at += 46 + nameLen + extraLen + cmtLen;
    }
    return entries;
  }

  function entryBytes(bytes, entry) {
    if (u32(bytes, entry.offset) !== 0x04034b50) throw fail('NOT_ZIP', 'ZIP 局部头损坏');
    var start = entry.offset + 30 + u16(bytes, entry.offset + 26) + u16(bytes, entry.offset + 28);
    var raw = bytes.subarray(start, start + entry.size);
    if (entry.method === 0) return Promise.resolve(raw);
    if (entry.method !== 8) return Promise.reject(fail('NOT_ZIP', '不支持的压缩方式'));
    return inflateRaw(raw);
  }

  /* ------------------------------------------------------------ XML */

  function parseXML(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw fail('NO_WORKBOOK', 'XML 解析失败');
    return doc;
  }

  function tags(node, name) {
    return Array.prototype.slice.call(node.getElementsByTagName(name));
  }

  /** 拼接 t 子节点：兼容 <si><t> 与 <si><r><t> 富文本 */
  function textOf(node) {
    return tags(node, 't').map(function (t) { return t.textContent; }).join('');
  }

  function colIndex(ref) {
    var n = 0;
    for (var i = 0; i < ref.length; i++) {
      var ch = ref.charCodeAt(i);
      if (ch < 65 || ch > 90) break;
      n = n * 26 + (ch - 64);
    }
    return n - 1;
  }

  function sheetRows(doc, shared) {
    var out = [];
    tags(doc, 'row').forEach(function (row) {
      var r = parseInt(row.getAttribute('r'), 10);
      var cells = [];
      var filled = false;
      tags(row, 'c').forEach(function (c) {
        var ref = c.getAttribute('r') || '';
        var at = ref ? colIndex(ref) : cells.length;
        var t = c.getAttribute('t');
        var v = '';
        if (t === 's') {
          var vs = tags(c, 'v')[0];
          v = vs ? (shared[parseInt(vs.textContent, 10)] || '') : '';
        } else if (t === 'inlineStr') {
          var is = tags(c, 'is')[0];
          v = is ? textOf(is) : '';
        } else {
          var vv = tags(c, 'v')[0];
          v = vv ? vv.textContent : '';
        }
        while (cells.length < at) cells.push('');
        cells[at] = v;
        if (String(v).trim()) filled = true;
      });
      if (filled) out.push({ r: isNaN(r) ? out.length + 1 : r, cells: cells });
    });
    return out;
  }

  /* ------------------------------------------------------------ xlsx */

  function readXlsx(buf) {
    var bytes = new Uint8Array(buf);
    var entries = readZip(bytes);
    var dec = new TextDecoder('utf-8');

    function text(name) {
      if (!entries[name]) return Promise.resolve(null);
      return entryBytes(bytes, entries[name]).then(function (b) { return dec.decode(b); });
    }

    return text('xl/workbook.xml').then(function (wbXml) {
      if (!wbXml) throw fail('NO_WORKBOOK', '缺少 xl/workbook.xml');
      return Promise.all([wbXml, text('xl/_rels/workbook.xml.rels'), text('xl/sharedStrings.xml')]);
    }).then(function (res) {
      var wb = parseXML(res[0]);
      var rels = {};
      if (res[1]) {
        tags(parseXML(res[1]), 'Relationship').forEach(function (rel) {
          rels[rel.getAttribute('Id')] = rel.getAttribute('Target');
        });
      }
      var shared = res[2]
        ? tags(parseXML(res[2]), 'si').map(textOf)
        : [];

      var order = [];
      var paths = {};
      tags(wb, 'sheet').forEach(function (s, i) {
        var name = s.getAttribute('name');
        var target = rels[s.getAttribute('r:id')] || ('worksheets/sheet' + (i + 1) + '.xml');
        var path = target.charAt(0) === '/'
          ? target.replace(/^\//, '')
          : ('xl/' + target.replace(/^\.?\//, ''));
        order.push(name);
        paths[name] = path;
      });
      if (!order.length) throw fail('NO_WORKBOOK', '工作簿内没有工作表');

      return {
        kind: 'xlsx',
        sheetNames: order,
        sheet: function (name) {
          var path = paths[name];
          if (!path || !entries[path]) return Promise.resolve(null);
          return entryBytes(bytes, entries[path]).then(function (b) {
            return { rows: sheetRows(parseXML(dec.decode(b)), shared) };
          });
        }
      };
    });
  }

  /* ------------------------------------------------------------ csv */

  function parseCSV(text) {
    var rows = [];
    var cells = [];
    var cur = '';
    var quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (quoted) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else quoted = false;
        } else cur += ch;
        continue;
      }
      if (ch === '"') { quoted = true; continue; }
      if (ch === ',') { cells.push(cur); cur = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { cells.push(cur); rows.push(cells); cells = []; cur = ''; continue; }
      cur += ch;
    }
    if (cur || cells.length) { cells.push(cur); rows.push(cells); }

    return rows.map(function (cs, i) { return { r: i + 1, cells: cs }; })
      .filter(function (row) {
        return row.cells.some(function (c) { return String(c).trim(); });
      });
  }

  function readCsv(buf) {
    var text = new TextDecoder('utf-8').decode(new Uint8Array(buf)).replace(/^﻿/, '');
    var bad = (text.match(/�/g) || []).length;
    if (bad > 3) throw fail('BAD_ENCODING', 'CSV 编码不是 UTF-8');
    return {
      kind: 'csv',
      sheetNames: ['CSV'],
      sheet: function () { return Promise.resolve({ rows: parseCSV(text) }); }
    };
  }

  /* ------------------------------------------------------------ 入口 */

  SC.readWorkbook = function (file) {
    var name = (file.name || '').toLowerCase();
    return Promise.resolve(file.arrayBuffer()).then(function (buf) {
      if (/\.csv$/.test(name)) return readCsv(buf);
      return readXlsx(buf);
    });
  };

})(window.SC);
