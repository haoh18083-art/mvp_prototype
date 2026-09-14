/* ==========================================================================
   P-ADM-02 人员详情页 · 来源 M01 §4.4 钉钉身份 / §4.7 密码重置 / §4.8 账号信息复制
   区域：钉钉身份区（仅销售与销售主管可见）、密码管理区、账号信息区、动态反馈区、
         办理交接入口（不要求账号已停用）
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;
  var id = SC.param('id') || 'U-1004';
  var p = D.person(id) || D.person('U-1004');

  /* 演示用当前有效密码（真实系统中密码不进审计） */
  var PWD = { 'U-1004': 'Ly6w#Nt4Bh7c', 'U-1002': 'Rv3d#Kp8Ze1m' };
  var pwd = PWD[p.id] || 'Tk8m#Wp3Qz6v';

  SC.page({
    role: 'ADM', menu: 'people', pid: 'P-ADM-02',
    title: p.name,
    crumb: [{ t: '人员与账号', href: 'people-list.html' }],
    desc: null,
    showHead: false
  }, function (body) {

    var isSalesSide = p.role === 'SLS' || p.role === 'MGR';

    /* -------------------------------------------------- 人员概要 */
    var hero =
      '<div class="card"><div class="person-hero">' +
        '<span class="person-hero__av">' + SC.esc(p.name.charAt(0)) + '</span>' +
        '<div class="u-grow">' +
          '<div class="person-hero__name">' + SC.esc(p.name) + '</div>' +
          '<div class="person-hero__meta">' +
            '<span class="mono">' + p.id + '</span>' +
            SC.badge(D.ROLES[p.role].name, p.role === 'ADM' ? 'brand' : 'neutral') +
            SC.state(p.status === 'on') +
            (p.group !== '—' ? '<span>' + SC.esc(p.group) + '</span>'
              : (p.role === 'SLS' ? '<span class="badge badge--amber badge--sm">未分组</span>' : '')) +
            '<span class="u-t3">创建于 ' + p.created + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="btn-group">' +
          (isSalesSide ? '<button class="btn" id="handover">办理交接</button>' : '') +
          '<button class="btn" id="role-change">变更角色</button>' +
          '<button class="btn' + (p.status === 'on' ? ' btn--danger' : '') + '" id="toggle">' +
            (p.status === 'on' ? '停用账号' : '启用账号') + '</button>' +
        '</div>' +
      '</div></div>';

    /* -------------------------------------------------- 账号信息区（C-08 之外的复制反馈） */
    var acct =
      '<div class="card"><div class="card__head">' +
        '<div><div class="card__title">账号信息</div></div>' +
      '</div><div class="card__body">' +
        '<div class="acct-row">' +
          '<span class="acct-row__k">邮箱</span>' +
          '<span class="acct-row__v mono">' + SC.esc(p.email) + '@teddymobile.cn</span>' +
          '<span id="copy-mail"></span>' +
        '</div>' +
        '<div class="acct-row">' +
          '<span class="acct-row__k">密码</span>' +
          '<span class="acct-row__v"><span class="masked" id="pwd-txt">••••••••••••</span></span>' +
          '<button class="copy" id="reveal">' + SC.icon('eye', 11) + '<span>显示</span></button>' +
          '<span id="copy-pwd"></span>' +
        '</div>' +
        '<div class="acct-row">' +
          '<span class="acct-row__k">手机号</span>' +
          '<span class="acct-row__v mono">' + SC.esc(p.phone) + '</span>' +
        '</div>' +
      '</div></div>';

    /* -------------------------------------------------- 密码管理区 */
    var pwdCard =
      '<div class="card"><div class="card__head">' +
        '<div class="card__title">密码管理</div>' +
      '</div><div class="card__body">' +
        SC.note('V1.0 <b>不强制首次修改密码</b>，也不设登录失败次数限制与临时锁定。' +
                '重置后「账号信息」区展示的即为最新有效密码。', 'info') +
        '<div class="u-mt4"><button class="btn" id="reset">' + SC.icon('key', 14) + ' 重置密码</button></div>' +
      '</div></div>';

    /* -------------------------------------------------- 钉钉身份区：仅销售与销售主管可见 */
    var ding = isSalesSide
      ? '<div class="card"><div class="card__head">' +
          '<div><div class="card__title">钉钉身份关联</div>' +
          '<div class="card__sub">用于接收钉钉发起的提公出与合同审批，并识别发起人</div></div>' +
        '</div><div class="card__body">' +
          '<div class="field">' +
            '<label class="field__label">钉钉身份标识</label>' +
            '<div class="u-row u-g2">' +
              '<input class="input" id="ding" value="' + SC.esc(p.ding) + '" placeholder="未关联">' +
              '<button class="btn u-nowrap" id="ding-save">保存</button>' +
            '</div>' +
            (p.ding ? '' : '<span class="field__err">未关联钉钉身份，该人员在钉钉发起的审批将无法自动识别发起人</span>') +
          '</div>' +
        '</div></div>'
      : '<div class="card"><div class="card__body">' +
          SC.empty({
            sm: true, icon: 'info',
            title: '本角色不展示钉钉身份区',
            reason: '钉钉身份关联仅对<b>销售</b>与<b>销售主管</b>开放，' +
                    '因为提公出与合同审批只由这两类角色在钉钉发起。'
          }) +
        '</div></div>';

    /* -------------------------------------------------- 右栏：业务关系 */
    var side =
      '<div class="card"><div class="card__head"><div class="card__title">业务关系</div></div>' +
      '<div class="card__body">' +
        '<div class="dl dl--wide">' +
          '<span class="dl__k">角色</span><span class="dl__v">' + D.ROLES[p.role].name + '</span>' +
          '<span class="dl__k">销售分组</span><span class="dl__v">' +
            (p.group === '—' ? '<span class="u-t3">—</span>' : SC.esc(p.group)) + '</span>' +
          '<span class="dl__k">归属客户</span><span class="dl__v u-num">' + p.cust + '</span>' +
          '<span class="dl__k">归属商机</span><span class="dl__v u-num">' + p.opp +
            (p.opp ? ' <span class="u-t3 u-f11">（含已结束）</span>' : '') + '</span>' +
          '<span class="dl__k">已建空间</span><span class="dl__v u-num">' + p.space + '</span>' +
        '</div>' +
        (p.role === 'SLS' && p.opp > 0
          ? '<div class="u-mt4">' + SC.note(
              '该销售名下仍有归属商机。<b>停用账号不改变商机归属</b>，' +
              '交接须在「客保裁决台 › 离职交接」按原销售与客户整组办理。', 'warn') + '</div>'
          : '') +
      '</div></div>' +
      '<div class="card"><div class="card__head"><div class="card__title">近期操作</div>' +
        '<a class="btn--link u-f12" href="audit-query.html?tab=object&obj=' + p.id + '">全部审计</a></div>' +
      '<div class="card__body">' +
        '<div class="timeline">' +
          '<div class="tl-item"><div class="tl-item__t">2026-09-06 16:55</div>' +
            '<div class="tl-item__b">复制账号信息 · 陈可</div></div>' +
          '<div class="tl-item tl-item--muted"><div class="tl-item__t">2026-08-13 10:02</div>' +
            '<div class="tl-item__b">创建人员档案与登录账号 · 陈可</div></div>' +
        '</div>' +
      '</div></div>';

    body.innerHTML =
      hero +
      '<div class="u-mt5 sc-split">' +
        '<div>' + acct + pwdCard + ding + '</div>' +
        '<div>' + side + '</div>' +
      '</div>';

    /* -------------------------------------------------- 复制按钮（动态反馈区） */
    SC.qs('#copy-mail', body).appendChild(SC.copyBtn(p.email + '@teddymobile.cn', '邮箱'));
    SC.qs('#copy-pwd', body).appendChild(SC.copyBtn(pwd, '密码'));

    var shown = false;
    SC.qs('#reveal', body).addEventListener('click', function () {
      shown = !shown;
      SC.qs('#pwd-txt', body).textContent = shown ? pwd : '••••••••••••';
      this.querySelector('span').textContent = shown ? '隐藏' : '显示';
    });

    /* -------------------------------------------------- 重置密码 D-05 */
    SC.qs('#reset', body).addEventListener('click', openReset);

    /* -------------------------------------------------- 角色变更 D-03 */
    SC.qs('#role-change', body).addEventListener('click', function () { openRoleChange(p); });

    /* -------------------------------------------------- 交接入口：不要求先停用 */
    var hb = SC.qs('#handover', body);
    if (hb) hb.addEventListener('click', function () {
      location.href = 'handover.html?role=ADM&sales=' + encodeURIComponent(p.id);
    });

    SC.qs('#toggle', body).addEventListener('click', function () {
      if (p.status === 'on') { location.href = 'people-list.html'; return; }
      SC.setAccountState([p.id], 'on');
      SC.toast('已启用账号，已完成交接的归属不回退', 'ok');
      setTimeout(function () { location.reload(); }, 250);
    });

    var ds = SC.qs('#ding-save', body);
    if (ds) ds.addEventListener('click', function () {
      SC.toast('钉钉身份已保存', 'ok');
    });
  });

  /* ============================================================ D-05 重置密码弹窗 */

  function openReset() {
    function rnd() {
      var cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@';
      var s = ''; for (var i = 0; i < 12; i++) s += cs.charAt(Math.floor(Math.random() * cs.length));
      return s;
    }

    var gen = rnd();
    var m = SC.modal({
      title: '重置密码',
      sub: '重置后原密码立即失效；不强制本人首次登录修改',
      body:
        '<div class="u-col u-g2">' +
          '<label class="radio-card is-checked" data-mode="auto">' +
            '<input type="radio" name="pm" checked>' +
            '<span><span class="radio-card__t">系统生成</span>' +
            '<span class="radio-card__d">按规则生成 12 位随机密码，默认选中</span></span>' +
          '</label>' +
          '<label class="radio-card" data-mode="manual">' +
            '<input type="radio" name="pm">' +
            '<span><span class="radio-card__t">人工输入</span>' +
            '<span class="radio-card__d">由超级管理员指定密码</span></span>' +
          '</label>' +
        '</div>' +
        '<div class="field" id="pwd-field">' +
          '<label class="field__label">新密码</label>' +
          '<div class="u-row u-g2">' +
            '<input class="input" id="np" value="' + gen + '" readonly>' +
            '<button class="btn btn--sm u-nowrap" id="regen">重新生成</button>' +
          '</div>' +
        '</div>',
      buttons: [
        { label: '取消', cls: '' },
        { label: '确认重置', cls: 'btn--primary', onClick: function (close) {
            var v = SC.qs('#np', m.body).value.trim();
            if (!v) { SC.toast('请输入新密码', 'bad'); return; }
            close();
            openResetResult(v);
          } }
      ]
    });

    SC.qsa('.radio-card', m.body).forEach(function (card) {
      card.addEventListener('click', function () {
        SC.qsa('.radio-card', m.body).forEach(function (c) { c.classList.remove('is-checked'); });
        card.classList.add('is-checked');
        var input = SC.qs('#np', m.body);
        var btn = SC.qs('#regen', m.body);
        if (card.dataset.mode === 'manual') {
          input.readOnly = false; input.value = ''; input.placeholder = '请输入新密码'; input.focus();
          btn.classList.add('u-hide');
        } else {
          input.readOnly = true; input.value = rnd(); btn.classList.remove('u-hide');
        }
      });
    });

    SC.qs('#regen', m.body).addEventListener('click', function () {
      SC.qs('#np', m.body).value = rnd();
    });
  }

  /* 重置结果：展示最终生效的新密码，便于告知本人 */
  function openResetResult(v) {
    var m = SC.modal({
      title: '密码已重置',
      body:
        SC.note('以下为<b>最终生效</b>的新密码，请告知本人。后续进入人员详情仍可复制当前有效密码。', 'green') +
        '<div class="acct-row" style="border-top:none">' +
          '<span class="acct-row__k">新密码</span>' +
          '<span class="acct-row__v mono u-f14">' + SC.esc(v) + '</span>' +
          '<span id="rr-copy"></span>' +
        '</div>',
      buttons: [{ label: '完成', cls: 'btn--primary' }]
    });
    SC.qs('#rr-copy', m.body).appendChild(SC.copyBtn(v, '新密码'));
  }

  /* ============================================================ D-03 角色变更弹窗
     业务检查区：条件不满足不能确认变更 */

  function openRoleChange(p) {
    var B = SC.B2, state = B.load(), current = B.find("people", p.id, state);
    var version = current.roleVersion;
    var checks = B.roleChecks(state, p.id);
    var rows = checks.map(function (c) {
      return '<div class="reason-row"><span class="reason-row__obj">' +
        (c.ok ? '<span class="u-success">' + SC.icon('ok', 13) : '<span class="u-danger">' + SC.icon('x', 13)) +
        '</span> ' + SC.esc(c.t) + '</span><span class="reason-row__why">' + SC.esc(c.d) + '</span>' +
        (!c.ok && c.page ? '<span class="reason-row__act"><a class="btn btn--link" href="' +
          SC.esc(B.href(c.page, { role: "ADM", as: B.identity("ADM").id, ...c.params })) + '">前往处理</a></span>' : '') + '</div>';
    }).join('');
    B.modal({ title: "变更角色", wide: true, confirm: "确认变更",
      body: B.kv([["原角色", D.ROLES[current.role]?.name || "未分配"], ["账号状态", current.status === "on" ? "启用" : "停用"]]) +
        '<form class="b2-form">' + B.field("新角色", "role", "", { required: true,
          options: [["", "请选择新角色"], ...Object.values(D.ROLES).filter(r => r.key !== current.role).map(r => [r.key, r.name])] }) + '</form>' +
        '<div class="region"><div class="region__head"><span class="region__title">业务检查</span></div>' + rows + '</div>' +
        SC.note("先停用账号并处理原归属、任职、客户池及未完成事项。变更角色后仍须手动启用；历史操作人与审批人保持不变。", "warn"),
      onConfirm: async function (root) {
        await B.changeRole(p.id, B.values(root).role, version);
        SC.rerender(); SC.toast("角色已变更，账号仍为停用状态", "ok");
      }
    });
  }

})(window.SC);
