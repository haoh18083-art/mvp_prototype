/* ==========================================================================
   P-CMN-01 登录页 · 来源 M01 §4.6 登录与访问控制
   区域：登录表单区（邮箱前缀 + 固定后缀 @teddymobile.cn、密码、登录、错误提示）
   已定版：V1.0 不做登录失败限速，不设失败次数限制与临时锁定，无解锁入口
   ========================================================================== */

(function (SC) {
  'use strict';

  var ACCOUNTS = [
    { role: '超级管理员', prefix: 'chenke',       pwd: 'Tm7k#Qa2Xw9p', href: 'people-list.html' },
    { role: '销售主管',   prefix: 'wangyunsheng', pwd: 'Rv3d#Kp8Ze1m', href: 'manager-home.html' },
    { role: '销售',       prefix: 'fuzan',        pwd: 'Ly6w#Nt4Bh7c', href: 'sales-home.html' },
    { role: '解决方案人员', prefix: 'yanlimei',   pwd: 'Qs2m#Fj9Vd5r', href: 'solution-pool.html' }
  ];

  SC.bare('登录', function (app) {
    app.className = 'sc-center';

    app.innerHTML =
      '<div class="login">' +
        '<div class="login__brand">' +
          '<span class="login__mark">销</span>' +
          '<span><div class="login__name">销售指挥官</div>' +
          '<div class="login__ver">V1.0 · 与 CRM 并行过渡期</div></span>' +
        '</div>' +

        '<div class="login__card">' +
          '<div class="login__title">登录</div>' +
          '<div class="login__desc">使用企业邮箱账号登录，账号由超级管理员创建</div>' +

          '<form class="login__form" id="f" novalidate>' +
            '<div class="field">' +
              '<label class="field__label" for="mail">邮箱</label>' +
              '<div class="input-affix">' +
                '<input class="input" id="mail" placeholder="邮箱前缀" autocomplete="username">' +
                '<span class="input-affix__suffix">@teddymobile.cn</span>' +
              '</div>' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__label" for="pwd">密码</label>' +
              '<input class="input" id="pwd" type="password" placeholder="请输入密码" autocomplete="current-password">' +
            '</div>' +
            '<div class="login__err" id="err"></div>' +
            '<button class="btn btn--primary btn--lg btn--block" type="submit">登录</button>' +
          '</form>' +

          '<div class="login__demo">' +
            '<div class="login__demo-t">原型演示账号（点击自动填入）</div>' +
            '<div class="login__demo-list" id="demo"></div>' +
          '</div>' +
        '</div>' +

        '<div class="login__foot">' +
          '账号异常请联系超级管理员<br>' +
          'V1.0 不强制首次修改密码，也不设登录失败次数限制' +
        '</div>' +
      '</div>';

    /* 演示账号 */
    var demo = SC.qs('#demo', app);
    ACCOUNTS.forEach(function (a) {
      var row = SC.el(
        '<button type="button" class="login__demo-row">' +
          '<span class="login__demo-role">' + a.role + '</span>' +
          '<span class="login__demo-mail">' + a.prefix + '@teddymobile.cn</span>' +
        '</button>');
      row.addEventListener('click', function () {
        SC.qs('#mail').value = a.prefix;
        SC.qs('#pwd').value = a.pwd;
        SC.qs('#err').innerHTML = '';
        SC.qs('#f').dataset.href = a.href;
      });
      demo.appendChild(row);
    });

    /* 提交校验：邮箱不存在与密码错误合并提示，避免暴露账号信息 */
    SC.qs('#f', app).addEventListener('submit', function (e) {
      e.preventDefault();
      var prefix = SC.qs('#mail').value.trim();
      var pwd = SC.qs('#pwd').value;
      var err = SC.qs('#err');

      if (!prefix || !pwd) {
        err.innerHTML = '<span class="field__err">请填写邮箱与密码</span>';
        return;
      }

      var hit = null;
      ACCOUNTS.forEach(function (a) { if (a.prefix === prefix && a.pwd === pwd) hit = a; });

      var person = SC.B2.load().people.find(function (p) { return p.email === prefix; });
      if (person && !SC.DATA.ROLES[person.role]) {
        err.innerHTML = '<span class="field__err">账号不可用，请联系超级管理员</span>'; return;
      }
      if (person && person.status !== 'on') {
        err.innerHTML = '<span class="field__err">账号已停用，请联系超级管理员</span>'; return;
      }
      if (!hit) {
        err.innerHTML = '<span class="field__err">邮箱或密码错误</span>';
        return;
      }

      err.innerHTML = '';
      SC.toast('登录成功，正在进入系统', 'ok');
      var menus = SC.MENU[person.role], target = (menus.find(function (m) { return m.home; }) || menus[0]).href;
      try { sessionStorage.setItem(SC.B2.sessionKey, JSON.stringify({ id: person.id, role: person.role })); } catch (_) {}
      var url = new URL(target, location.href);
      url.searchParams.set('role', person.role); url.searchParams.set('as', person.id);
      setTimeout(function () { location.href = url.href; }, 500);
    });
  });

})(window.SC);
