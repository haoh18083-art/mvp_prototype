/**
 * V0.2 原型登录入口。
 * 统一管理四类演示身份、本地凭据校验和角色首页路由；不代替生产鉴权。
 */
(function (SC) {
  'use strict';

  const SESSION_KEY = 'sc-v02-session';
  const EMAIL_DOMAIN = '@teddymobile.cn';
  const demoAccounts = [
    {
      id: 'U-1001', role: 'ADM', roleName: '超级管理员', short: '超', name: '陈可',
      prefix: 'chenke', password: 'Tm7k#Qa2Xw9p', landing: '运营配置',
      href: 'pages/operations-config.html?role=ADM&as=U-1001'
    },
    {
      id: 'U-1002', role: 'MGR', roleName: '销售运营', short: '营', name: '王云生',
      prefix: 'wangyunsheng', password: 'Rv3d#Kp8Ze1m', landing: '经营洞察',
      href: 'pages/employee-insights.html?role=MGR&as=U-1002'
    },
    {
      id: 'U-1004', role: 'SLS', roleName: '销售', short: '销', name: '付赞',
      prefix: 'fuzan', password: 'Ly6w#Nt4Bh7c', landing: '客户跟进空间',
      href: 'pages/customer-spaces.html?role=SLS&as=U-1004'
    },
    {
      id: 'U-1010', role: 'SOL', roleName: '解决方案人员', short: '案', name: '闫丽梅',
      prefix: 'yanlimei', password: 'Qs2m#Fj9Vd5r', landing: '方案人员工作台',
      href: 'pages/solution-workbench.html?role=SOL&as=U-1010'
    }
  ];

  function normalizePrefix(value) {
    const email = String(value || '').trim().toLowerCase();
    return email.endsWith(EMAIL_DOMAIN) ? email.slice(0, -EMAIL_DOMAIN.length) : email;
  }

  /**
   * 校验演示凭据及其对应的当前人员状态。
   * 返回统一失败类型，避免通过错误文案暴露账号是否存在。
   */
  const landingByRole = {
    ADM: { landing: '运营配置', page: 'operations-config' },
    MGR: { landing: '经营洞察', page: 'employee-insights' },
    SLS: { landing: '客户跟进空间', page: 'customer-spaces' },
    SOL: { landing: '方案人员工作台', page: 'solution-workbench' }
  };
  const demoIds = new Set(demoAccounts.map(item => item.id));

  /**
   * 将人员管理保存的人员记录转换为登录账号视图。
   * 新增账号、改邮箱或改角色后，登录页无需再维护第二份静态数据。
   */
  function accountsForLogin() {
    const people = typeof SC.DATA.peopleSnapshot === 'function' ? SC.DATA.peopleSnapshot() : SC.DATA.PEOPLE;
    return people.map(person => {
      const base = demoAccounts.find(item => item.id === person.id) || {};
      const landing = landingByRole[person.role];
      if (!landing) return null;
      const email = person.email || (base.prefix ? base.prefix + EMAIL_DOMAIN : '');
      return {
        id: person.id,
        role: person.role,
        roleName: SC.DATA.ROLES[person.role]?.name || base.roleName || '待分配角色',
        short: SC.DATA.ROLES[person.role]?.short?.slice(0, 1) || base.short || '人',
        name: person.name || base.name || '未命名人员',
        prefix: normalizePrefix(email),
        password: SC.DATA.getCredential(person.id, base.password),
        landing: landing.landing,
        href: 'pages/' + landing.page + '.html?role=' + person.role + '&as=' + encodeURIComponent(person.id),
        status: person.status === 'off' ? 'off' : 'on'
      };
    }).filter(Boolean);
  }

  function authenticate(email, password) {
    const prefix = normalizePrefix(email);
    const account = accountsForLogin().find(item => item.prefix === prefix && item.password === password);
    if (!account) return { error: 'invalid' };

    const people = typeof SC.DATA.peopleSnapshot === 'function' ? SC.DATA.peopleSnapshot() : SC.DATA.PEOPLE;
    const person = people.find(item => item.id === account.id);
    if (!person || !SC.DATA.ROLES[person.role] || person.role !== account.role) return { error: 'unavailable' };
    if (person.status !== 'on') return { error: 'disabled' };
    return { account };
  }

  const LOGIN = SC.LOGIN = {
    SESSION_KEY,
    getAccounts: accountsForLogin,
    authenticate,
    routeFor(account) {
      return new URL(account.href, window.location.href).href;
    },
    navigate(account) {
      window.location.assign(LOGIN.routeFor(account));
    }
  };
  /* 保留原型测试和调试入口的 accounts 数组，同时让每次读取都拿到最新状态。 */
  Object.defineProperty(LOGIN, 'accounts', {
    enumerable: true,
    get: () => accountsForLogin().filter(account => demoIds.has(account.id))
  });

  const form = document.getElementById('login-form');
  if (!form) return;

  const email = document.getElementById('login-email');
  const password = document.getElementById('login-password');
  const error = document.getElementById('login-error');
  const submit = document.getElementById('login-submit');
  const toggle = document.getElementById('password-toggle');
  const accountList = document.getElementById('login-accounts');
  let busy = false;

  function setError(message) {
    error.textContent = message || '';
    form.classList.toggle('has-error', Boolean(message));
  }

  function markSelected(role) {
    accountList.querySelectorAll('.login-account').forEach(button => {
      const selected = button.dataset.role === role;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function selectAccount(account) {
    email.value = account.prefix;
    password.value = account.password;
    setError('');
    markSelected(account.role);
    submit.focus();
  }

  accountsForLogin().filter(account => demoIds.has(account.id)).forEach(account => {
    const button = SC.el(
      '<button class="login-account" type="button" data-role="' + SC.esc(account.role) + '" aria-pressed="false">' +
        '<span class="login-account__avatar login-account__avatar--' + SC.esc(account.role.toLowerCase()) + '">' + SC.esc(account.short) + '</span>' +
        '<span class="login-account__copy">' +
          '<span class="login-account__role">' + SC.esc(account.roleName) + '</span>' +
          '<span class="login-account__meta">' + SC.esc(account.name) + ' · ' + SC.esc(account.landing) + '</span>' +
        '</span>' +
        '<span class="login-account__arrow" aria-hidden="true">→</span>' +
      '</button>'
    );
    button.addEventListener('click', () => selectAccount(account));
    accountList.appendChild(button);
  });

  [email, password].forEach(input => {
    input.addEventListener('input', () => {
      setError('');
      markSelected('');
    });
  });

  toggle.addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    toggle.textContent = visible ? '显示' : '隐藏';
    toggle.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
    toggle.setAttribute('title', visible ? '显示密码' : '隐藏密码');
    password.focus();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;

    if (!email.value.trim() || !password.value) {
      setError('请填写企业邮箱账号与密码');
      (!email.value.trim() ? email : password).focus();
      return;
    }

    const result = authenticate(email.value, password.value);
    if (result.error === 'disabled') {
      setError('账号已停用，请联系超级管理员');
      return;
    }
    if (result.error === 'unavailable') {
      setError('账号不可用，请联系超级管理员');
      return;
    }
    if (result.error) {
      setError('账号或密码错误');
      return;
    }

    busy = true;
    setError('');
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    submit.textContent = '正在进入' + result.account.landing + '…';
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        id: result.account.id,
        role: result.account.role,
        name: result.account.name,
        email: result.account.prefix + EMAIL_DOMAIN
      }));
    } catch (_) {
      // 浏览器禁用会话存储时仍允许继续本地原型演示。
    }
    LOGIN.navigate(result.account);
  });
})(window.SC);
