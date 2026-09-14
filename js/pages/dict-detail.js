/* ==========================================================================
   P-ADM-35 字典详情页 · 来源 M05-1 §4.6
   区域：选项区（选项、启停状态、排序、新增与停用操作）；固定字典无操作入口
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;
  var id = SC.param('id') || 'D-04';
  var d = D.dict(id) || D.dict('D-04');
  var opts = (D.DICT_OPTIONS[d.id] || []).slice();

  SC.page({
    role: 'ADM', menu: 'config', pid: 'P-ADM-35',
    title: d.name,
    crumb: [{ t: '基础数据配置', href: 'dict-list.html' }],
    desc: d.desc + (d.fixed ? '　<b class="u-danger">固定字典，不开放增删</b>' : '')
  }, function (body, actions) {

    if (!d.fixed) {
      actions.innerHTML = '<button class="btn btn--primary" id="add">' + SC.icon('plus', 14) + ' 新增选项</button>';
    }

    if (!opts.length) {
      body.innerHTML = '<div class="card"><div class="card__body">' + SC.empty({
        title: '本原型未实现该字典的选项数据',
        reason: '批 1 原型只实现「客保驳回原因」与「角色」两个字典的详情页。',
        actions: [{ label: '返回字典列表', primary: true }]
      }) + '</div></div>';
      SC.qsa('.empty__acts .btn', body).forEach(function (b) {
        b.addEventListener('click', function () { location.href = 'dict-list.html'; });
      });
      return;
    }

    function render() {
      var rows = opts.map(function (o, i) {
        return '<tr' + (o.on ? '' : ' class="is-muted"') + '>' +
          '<td class="u-num u-t3" style="width:56px">' + o.sort + '</td>' +
          '<td class="u-medium">' + SC.esc(o.v) + '</td>' +
          '<td>' + SC.state(o.on, ['启用', '已停用']) + '</td>' +
          '<td class="col-act"><div class="rowacts">' +
            (d.fixed
              ? '<span class="u-t3 u-f12">无操作入口</span>'
              : '<button class="btn--link" data-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>上移</button>' +
                '<button class="btn--link" data-down="' + i + '"' + (i === opts.length - 1 ? ' disabled' : '') + '>下移</button>' +
                '<button class="btn--link" data-toggle="' + i + '">' + (o.on ? '停用' : '启用') + '</button>') +
          '</div></td>' +
        '</tr>';
      }).join('');

      body.innerHTML =
        (d.fixed
          ? SC.note('本字典为<b>固定字典</b>，选项由需求定义。' +
              (d.id === 'D-08' ? '四类固定角色不支持自定义新增，一人只对应一种角色。' : '') +
              '页面不提供新增、停用与排序入口。', 'warn')
          : SC.note('停用选项<b>不影响已使用该选项的历史记录</b>，' +
              '只是新的表单中不再作为可选项出现。', 'info')) +

        '<div class="u-mt5 table-wrap">' +
          '<div class="toolbar"><div class="toolbar__left">' +
            '<span class="u-f12 u-t2">共 ' + opts.length + ' 个选项，启用 ' +
              opts.filter(function (o) { return o.on; }).length + ' 个</span>' +
          '</div></div>' +
          '<table class="table"><thead><tr>' +
            '<th>排序</th><th>选项</th><th style="width:120px">状态</th><th class="col-act">操作</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</div>';

      if (d.fixed) return;

      SC.qsa('[data-toggle]', body).forEach(function (b) {
        b.addEventListener('click', function () {
          var o = opts[+b.dataset.toggle];
          o.on = !o.on;
          SC.toast(o.on ? '已启用「' + o.v + '」' : '已停用「' + o.v + '」', 'ok');
          render();
        });
      });
      SC.qsa('[data-up]', body).forEach(function (b) {
        b.addEventListener('click', function () { move(+b.dataset.up, -1); });
      });
      SC.qsa('[data-down]', body).forEach(function (b) {
        b.addEventListener('click', function () { move(+b.dataset.down, 1); });
      });
    }

    function move(i, dir) {
      var j = i + dir;
      if (j < 0 || j >= opts.length) return;
      var t = opts[i]; opts[i] = opts[j]; opts[j] = t;
      opts.forEach(function (o, k) { o.sort = k + 1; });
      render();
    }

    render();

    var addBtn = SC.qs('#add');
    if (addBtn) addBtn.addEventListener('click', function () {
      var m = SC.modal({
        title: '新增选项',
        sub: SC.esc(d.name),
        body: '<div class="field"><label class="field__label">选项内容<span class="req">*</span></label>' +
              '<input class="input" id="ov" placeholder="请输入选项内容"></div>',
        buttons: [
          { label: '取消', cls: '' },
          { label: '确认新增', cls: 'btn--primary', onClick: function (close) {
              var v = SC.qs('#ov', m.body).value.trim();
              if (!v) { SC.toast('请输入选项内容', 'bad'); return; }
              opts.push({ v: v, on: true, sort: opts.length + 1 });
              close(); render();
              SC.toast('已新增选项', 'ok');
            } }
        ]
      });
    });
  });

})(window.SC);
