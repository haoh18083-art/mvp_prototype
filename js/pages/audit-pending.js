/* ==========================================================================
   P-ADM-33 留痕待补页 · 来源 M03-1 §4.7 留痕未完成的识别与补记恢复
   区域：留痕待补区（对象、实际业务结果、原因、责任模块、核对或恢复入口，仅超管）
   关键口径：业务已生效但审计未完成时，超管可查待补，恢复原事件而不重新审批或执行业务
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;

  SC.page({
    role: 'ADM', menu: 'audit', pid: 'P-ADM-33',
    title: '留痕待补',
    crumb: [{ t: '操作审计', href: 'audit-query.html' }],
    desc: '业务已生效但留痕未完成的事项。<b>恢复只补记事件，不重新审批、不重做业务</b>；' +
          '责任业务页按实际业务结果反馈，不因留痕失败误导用户重复办理。'
  }, function (body, actions) {

    actions.innerHTML = '<button class="btn btn--primary" id="all" ' +
      (D.PENDING_AUDIT.length ? '' : 'disabled') + '>批量核对并恢复</button>';

    if (!D.PENDING_AUDIT.length) {
      body.innerHTML = '<div class="card"><div class="card__body">' + SC.empty({
        icon: 'ok', title: '没有待补记的留痕',
        reason: '全部业务动作的留痕均已完成。'
      }) + '</div></div>';
      return;
    }

    var rows = D.PENDING_AUDIT.map(function (p) {
      return '<tr>' +
        '<td class="col-check"><input type="checkbox" data-check-row value="' + p.id + '"></td>' +
        '<td><span class="mono u-f12">' + p.id + '</span>' +
          '<div class="table__sub">' + SC.esc(p.obj) + '</div></td>' +
        '<td class="u-f12"><span class="u-success">' + SC.icon('ok', 12) + '</span> ' + SC.esc(p.real) + '</td>' +
        '<td class="u-f12 u-danger">' + SC.esc(p.why) + '</td>' +
        '<td>' + SC.badge(p.mod, 'neutral', { sm: true }) + '</td>' +
        '<td class="u-t3 u-f12 mono u-nowrap">' + p.at + '</td>' +
        '<td class="col-act"><div class="rowacts">' +
          '<button class="btn--link" data-check="' + p.id + '">核对</button>' +
          '<button class="btn--link" data-fix="' + p.id + '">恢复留痕</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    body.innerHTML =
      SC.note('<b>业务与留痕分别判断</b>：下列事项的业务结果<b>已经生效</b>，' +
              '缺的只是审计事件本身。恢复留痕后事件补记完成，' +
              '原发生时间、补记时间与修复人分别记录，<b>不改原业务责任</b>。', 'warn') +

      '<div class="u-mt5 table-wrap">' +
        '<div class="toolbar"><div class="toolbar__left">' +
          '<span class="u-f12 u-t2">共 ' + D.PENDING_AUDIT.length + ' 项待补，仅超级管理员可见</span>' +
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
  });

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
            '<div class="identity3__v">' + SC.esc(p.mod) + '</div></div>' +
        '</div>' +
        '<div class="dl dl--wide">' +
          '<span class="dl__k">对象</span><span class="dl__v mono">' + SC.esc(p.obj) + '</span>' +
          '<span class="dl__k">实际结果</span><span class="dl__v">' + SC.esc(p.real) + '</span>' +
          '<span class="dl__k">原因</span><span class="dl__v u-danger">' + SC.esc(p.why) + '</span>' +
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
