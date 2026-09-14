/* ==========================================================================
   主框架挂载 · P-CMN-02 系统主框架
   每个页面 HTML 只声明自己的 <div id="sc-app">，框架由本文件统一注入，
   保证左侧菜单区、顶部信息区在所有页面完全一致。
   ========================================================================== */

window.SC = window.SC || {};

(function (SC) {
  'use strict';

  var D = SC.DATA;
  var unwireNavigation = function () {};
  var logoutDialog = null;
  var navigationMemory = {};

  function navigationSetting(key) {
    try { return localStorage.getItem(key); }
    catch (e) { return navigationMemory[key] || null; }
  }

  function saveNavigationSetting(key, value) {
    navigationMemory[key] = String(value);
    try { localStorage.setItem(key, String(value)); } catch (e) {}
  }

  function compactNavigation() {
    return window.matchMedia ? window.matchMedia('(max-width: 760px)').matches : window.innerWidth <= 760;
  }

  function navigationKey() {
    return compactNavigation() ? 'sc-nav-collapsed-mobile' : 'sc-nav-collapsed';
  }

  function navigationCollapsed() {
    var saved = navigationSetting(navigationKey());
    if (saved !== null) return saved === 'true';
    return compactNavigation();
  }

  function navGroupKey(key) { return 'sc-nav-group-' + key; }

  function navGroupExpanded(key) {
    var saved = navigationSetting(navGroupKey(key));
    // The same menu tree stays visible on every page; only an explicit toggle changes it.
    return saved === null || saved === 'true';
  }

  /* ---------------------------------------------- 左侧菜单区 */

  function navHTML(role, activeKey) {
    var items = SC.MENU[role] || [];
    var collapsed = navigationCollapsed();
    var toggleLabel = collapsed ? '展开导航' : '收起导航';

    function itemInner(m, noPendingBadge) {
      // 父目录没有 href 是设计如此（纯收起/展开，不是“尚未交付”），不当作待交付页面标注批次角标。
      var pending = !noPendingBadge && !m.href;
      var badge = pending ? '<span class="sc-nav__batch">批' + m.batch + '</span>'
                          : (m.empty ? '<span class="sc-nav__batch">空</span>' : '');
      return '<span class="sc-nav__ico">' + SC.icon(m.icon, 16) + '</span>' +
             '<span class="sc-nav__label">' + m.label + '</span>' + badge;
    }

    function itemHTML(m, extraCls) {
      var isActive = m.key === activeKey;
      var pending = !m.href;                      // 本原型批次尚未交付的页面
      var cls = 'sc-nav__item' + (extraCls ? ' ' + extraCls : '') + (isActive ? ' is-active' : '') + (pending ? ' is-pending' : '');
      var tag = pending ? 'div' : 'a';
      var href = pending ? '' : ' href="' + m.href + '"';
      var title = pending
        ? ' title="' + m.label + '（原型批' + m.batch + ' 交付 · 需求来源 ' + m.src + '）"'
        : ' title="' + m.label + '（需求来源 ' + m.src + '）"';
      return '<' + tag + ' class="' + cls + '"' + href + title + ' data-menu="' + m.key + '" data-od-id="nav-' + m.key + '"' + (isActive ? ' aria-current="page"' : '') + (pending ? ' aria-disabled="true"' : '') + '>' +
             itemInner(m) +
             '</' + tag + '>';
    }

    function groupHTML(m) {
      // 父目录本身不对应任何页面，只负责收起/展开——不渲染成链接，不参与 activeKey 匹配。
      var childActive = m.children.some(function (c) { return c.key === activeKey; });
      var expanded = navGroupExpanded(m.key);
      var groupId = navGroupKey(m.key);
      var toggleLabel = (expanded ? '收起' : '展开') + m.label + '子目录';
      return '<div class="sc-nav__group" data-nav-group="' + m.key + '">' +
        '<button type="button" class="sc-nav__item sc-nav__item--parent' + (childActive ? ' has-active-child' : '') + '" data-nav-toggle="' + m.key + '" aria-expanded="' + expanded + '" aria-controls="' + groupId + '" title="' + toggleLabel + '" data-od-id="nav-' + m.key + '">' +
          itemInner(m, true) +
          '<span class="sc-nav__caret" aria-hidden="true">' + SC.icon('chevron', 14) + '</span>' +
        '</button>' +
        '<div class="sc-nav__children" id="' + groupId + '"' + (expanded ? '' : ' inert') + '>' +
          '<div class="sc-nav__children-inner">' +
            m.children.map(function (c) { return itemHTML(c, 'sc-nav__item--child'); }).join('') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    var list = items.map(function (m) {
      return m.children ? groupHTML(m) : itemHTML(m);
    }).join('');

    return '<div class="sc-nav-shell" data-nav-role="' + role + '" data-collapsed="' + collapsed + '" data-od-id="sidebar">' +
      '<button class="sc-nav-backdrop" type="button" tabindex="-1" aria-label="收起导航" data-od-id="nav-backdrop"></button>' +
      '<aside class="sc-nav sc-nav--ant" id="sc-navigation" aria-label="主导航"' + (collapsed ? ' inert aria-hidden="true"' : '') + '>' +
      '<div class="sc-nav__brand" data-od-id="nav-brand">' +
        '<span class="sc-nav__name">销售指挥官</span>' +
      '</div>' +
      '<div class="sc-nav__scroll">' +
        list +
      '</div>' +
      userHTML(role) +
      '</aside>' +
      '<button class="sc-nav-toggle" type="button" aria-controls="sc-navigation" aria-expanded="' + !collapsed + '" aria-label="' + toggleLabel + '" title="' + toggleLabel + '" data-od-id="nav-toggle">' + SC.icon('chevron', 18) + '</button>' +
    '</div>';
  }

  function wireNavigation() {
    unwireNavigation();
    var shell = document.querySelector('.sc-nav-shell');
    var nav = shell.querySelector('.sc-nav');
    var toggle = shell.querySelector('.sc-nav-toggle');
    var backdrop = shell.querySelector('.sc-nav-backdrop');
    var main = document.querySelector('.sc-main');
    var media = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
    var scroller = nav.querySelector('.sc-nav__scroll');
    var scrollKey = 'sc-nav-scroll-' + shell.dataset.navRole;
    var unwired = false;

    function rememberScroll() {
      try { sessionStorage.setItem(scrollKey, String(scroller.scrollTop)); } catch (e) {}
    }

    function restoreScroll() {
      try { scroller.scrollTop = Math.max(0, Number(sessionStorage.getItem(scrollKey)) || 0); } catch (e) {}
    }

    function setCollapsed(collapsed, remember) {
      if ((collapsed && nav.contains(document.activeElement)) ||
          (!collapsed && compactNavigation() && main.contains(document.activeElement))) toggle.focus();
      shell.dataset.collapsed = String(collapsed);
      nav.toggleAttribute('inert', collapsed);
      nav.setAttribute('aria-hidden', String(collapsed));
      nav.setAttribute('role', 'navigation');
      if (compactNavigation() && !collapsed) {
        shell.setAttribute('role', 'dialog');
        shell.setAttribute('aria-modal', 'true');
        shell.setAttribute('aria-label', '主导航');
      } else {
        shell.removeAttribute('role');
        shell.removeAttribute('aria-modal');
        shell.removeAttribute('aria-label');
      }
      main.toggleAttribute('inert', compactNavigation() && !collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? '展开导航' : '收起导航');
      toggle.title = collapsed ? '展开导航' : '收起导航';
      if (remember) {
        saveNavigationSetting(navigationKey(), collapsed);
      }
    }

    function setGroupExpanded(btn, open) {
      var children = document.getElementById(navGroupKey(btn.dataset.navToggle));
      var label = btn.querySelector('.sc-nav__label').textContent;
      if (!open && children && children.contains(document.activeElement)) btn.focus();
      btn.setAttribute('aria-expanded', String(open));
      btn.title = (open ? '收起' : '展开') + label + '子目录';
      if (children) children.toggleAttribute('inert', !open);
    }

    function syncNavigation() {
      setCollapsed(navigationCollapsed(), false);
      nav.querySelectorAll('[data-nav-toggle]').forEach(function (btn) {
        setGroupExpanded(btn, navGroupExpanded(btn.dataset.navToggle));
      });
    }

    toggle.addEventListener('click', function () {
      setCollapsed(shell.dataset.collapsed !== 'true', true);
    });
    backdrop.addEventListener('click', function () {
      setCollapsed(true, true);
      toggle.focus();
    });
    nav.querySelector('.sc-logout').addEventListener('click', function (event) {
      confirmLogout(event.currentTarget);
    });
    nav.querySelectorAll('[data-nav-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.navToggle;
        var open = btn.getAttribute('aria-expanded') !== 'true';
        setGroupExpanded(btn, open);
        saveNavigationSetting(navGroupKey(key), open);
      });
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a[href]')) rememberScroll();
      if (compactNavigation() && event.target.closest('a[href]') && !event.ctrlKey && !event.metaKey) {
        setCollapsed(true, true);
      }
    });

    function onKey(event) {
      if (shell.dataset.collapsed === 'true') return;
      if (event.key === 'Escape') {
        setCollapsed(true, true);
        toggle.focus();
        event.preventDefault();
      } else if (event.key === 'Tab' && compactNavigation()) {
        var links = nav.querySelectorAll('a[href]');
        var first = links[0] || toggle;
        if (event.shiftKey && document.activeElement === first) {
          toggle.focus();
          event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === toggle) {
          first.focus();
          event.preventDefault();
        }
      }
    }
    function onViewport() { setCollapsed(navigationCollapsed(), false); }
    function onStorage(event) {
      if (!event.key || event.key === navigationKey() || event.key.indexOf('sc-nav-group-') === 0)
        syncNavigation();
    }
    function onPageShow() {
      syncNavigation();
      restoreScroll();
    }
    shell.addEventListener('keydown', onKey);
    scroller.addEventListener('scroll', rememberScroll, { passive: true });
    window.addEventListener('pagehide', rememberScroll);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    if (media) media.addEventListener('change', onViewport);
    setCollapsed(navigationCollapsed(), false);
    restoreScroll();
    unwireNavigation = function () {
      if (unwired) return;
      unwired = true;
      rememberScroll();
      scroller.removeEventListener('scroll', rememberScroll);
      window.removeEventListener('pagehide', rememberScroll);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
      if (media) media.removeEventListener('change', onViewport);
      main.removeAttribute('inert');
    };
  }

  function userHTML(role) {
    var me = D.CURRENT[role];
    var details = [D.ROLES[role].name];
    if (me.group && me.group !== '—') details.push(me.group);
    if (me.pool) details.push(me.pool);
    var identity = me.name + ' · ' + details.join(' / ');

    return '<div class="sc-user sc-user--nav" role="group" aria-label="' + SC.esc(identity) + '" title="' + SC.esc(identity) + '" data-od-id="sidebar-user">' +
      '<span class="sc-user__av" aria-hidden="true">' + SC.esc(me.name.charAt(0)) + '</span>' +
      '<span class="sc-user__meta">' +
        '<span class="sc-user__name" data-od-id="sidebar-user-name">' + SC.esc(me.name) + '</span>' +
        '<span class="sc-user__role" data-od-id="sidebar-user-role">' + SC.esc(details.join(' / ')) + '</span>' +
      '</span>' +
      '<button class="sc-logout" type="button" aria-label="退出登录" title="退出登录" data-od-id="sidebar-logout">' +
        SC.icon('logout', 18) +
      '</button>' +
    '</div>';
  }

  function confirmLogout(trigger) {
    if (logoutDialog) return;
    var app = document.getElementById('sc-app');
    var wasInert = app.hasAttribute('inert');
    var closing = false;

    function dismiss(close, confirmed) {
      if (closing) return;
      closing = true;
      modal.root.classList.add('is-closing');
      modal.root.querySelectorAll('button').forEach(function (button) { button.disabled = true; });
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        close();
        logoutDialog = null;
        app.toggleAttribute('inert', wasInert);
        if (confirmed) {
          try { sessionStorage.removeItem(SC.B2?.sessionKey || 'sc-prototype-identity'); } catch (_) {}
          location.replace(new URL('login.html', pageAddress()).href);
        } else {
          var target = trigger.isConnected ? trigger : app.querySelector('.sc-logout');
          if (target && !target.closest('[inert]')) target.focus();
          else app.querySelector('.sc-nav-toggle')?.focus();
        }
      }, reduced ? 0 : 220);
    }

    var modal = SC.modal({
      title: '退出登录',
      body: '<p id="sc-logout-message" data-od-id="logout-message">是否要退出系统？</p>',
      buttons: [
        { label: '取消', onClick: function (close) { dismiss(close, false); } },
        { label: '确定退出', cls: 'sc-logout-confirm-button', onClick: function (close) { dismiss(close, true); } }
      ]
    });
    logoutDialog = modal;
    modal.root.classList.add('sc-logout-confirm');
    modal.root.setAttribute('data-od-id', 'logout-confirmation');
    var dialog = modal.root.querySelector('[role="dialog"]');
    dialog.setAttribute('aria-label', '退出登录');
    dialog.setAttribute('aria-describedby', 'sc-logout-message');
    var buttons = modal.root.querySelectorAll('.modal__foot button');
    buttons[0].setAttribute('data-od-id', 'logout-cancel');
    buttons[1].setAttribute('data-od-id', 'logout-confirm');
    buttons[0].focus();
    app.setAttribute('inert', '');

    // Route every dismissal through the exit transition and focus restoration.
    modal.root.querySelector('.modal__x').addEventListener('click', function (event) {
      event.stopImmediatePropagation();
      dismiss(modal.close, false);
    }, true);
    modal.root.addEventListener('mousedown', function (event) {
      if (event.target === modal.root) {
        event.stopImmediatePropagation();
        dismiss(modal.close, false);
      }
    }, true);
    modal.root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismiss(modal.close, false);
      } else if (event.key === 'Tab') {
        var nodes = modal.root.querySelectorAll('button:not(:disabled)');
        var first = nodes[0], last = nodes[nodes.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });
  }

  /* ---------------------------------------------- 顶部信息区 */

  function pageAddress() {
    var base = new URL(document.baseURI);
    if (/\/pages\/[^/]+\.html$/.test(base.pathname)) return base;
    // Embedded previews may use about:blank with a directory-only base URL.
    var scripts = document.querySelectorAll('script[src]');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var url = new URL(scripts[i].src, document.baseURI);
      if (/\/js\/pages\/[^/]+\.js$/.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/js\/pages\//, '/pages/').replace(/\.js$/, '.html');
        return url;
      }
    }
    return base;
  }

  function projectPage(href) {
    if (!href) return null;
    try {
      var current = pageAddress();
      var url = new URL(href, current);
      var root = new URL('../', current);
      var pageDirectory = root.pathname + 'pages/';
      var isPage = url.pathname.indexOf(pageDirectory) === 0 &&
        /^[^/]+\.html$/.test(url.pathname.slice(pageDirectory.length));
      return url.origin === root.origin && url.protocol === root.protocol &&
        (isPage || url.pathname === root.pathname + 'index.html') ? url : null;
    } catch (e) { return null; }
  }

  function navigationHref(href, opts) {
    var url = projectPage(href);
    if (!url || url.pathname === new URL('../index.html', pageAddress()).pathname) return href;
    var params = new URLSearchParams(location.search);
    url.searchParams.set('role', opts.role);
    if (params.get('as') && (!params.get('role') || params.get('role') === opts.role)) {
      url.searchParams.set('as', params.get('as'));
    }
    return url.href;
  }

  function findMenuItem(role, key) {
    var items = SC.MENU[role] || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].key === key) return items[i];
      if (items[i].children) {
        for (var j = 0; j < items[i].children.length; j++) {
          if (items[i].children[j].key === key) return items[i].children[j];
        }
      }
    }
    return null;
  }

  function pageCrumbs(opts) {
    var parents = (opts.crumb || []).slice();
    var menu = findMenuItem(opts.role, opts.menu);
    var menuURL = menu && projectPage(menu.href);
    if (menuURL && menuURL.pathname !== pageAddress().pathname && !parents.some(function (item) {
      var url = item.href && projectPage(item.href);
      return url && url.pathname === menuURL.pathname;
    })) parents.unshift({ t: menu.label, href: menu.href });
    return parents.map(function (item) {
      return { t: item.t, href: item.href ? navigationHref(item.href, opts) : '' };
    });
  }

  function previousPage() {
    // Native history entries also cover programmatic links and restored pages.
    var navigation = window.navigation;
    var href = document.referrer;
    if (navigation && navigation.currentEntry && typeof navigation.entries === 'function') {
      var entries = navigation.entries();
      var previous = entries.find(function (entry) {
        return entry.index === navigation.currentEntry.index - 1;
      });
      if (previous) href = previous.url;
      else if (navigation.currentEntry.index === 0) return null;
    }
    var url = projectPage(href);
    return history.length > 1 && url && url.href !== pageAddress().href ? url : null;
  }

  function wirePageBack() {
    var back = document.getElementById('sc-page-back');
    if (!back) return;
    var previous = previousPage();
    if (previous) back.href = previous.href;
    back.addEventListener('click', function (event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (previousPage()) {
        event.preventDefault();
        history.back();
      }
    });
  }

  function topHTML(opts) {
    var role = opts.role;
    var parents = pageCrumbs(opts);
    var backHref = '../index.html';
    parents.forEach(function (item) { if (item.href) backHref = item.href; });

    var crumb = '<nav class="sc-crumb" aria-label="页面导航" data-od-id="page-breadcrumb">' +
      '<ol class="sc-crumb__list"><li><a href="../index.html" title="返回销售指挥官" data-od-id="breadcrumb-home">销售指挥官</a></li>';
    parents.forEach(function (c, index) {
      crumb += '<li><span class="sc-crumb__sep" aria-hidden="true">/</span>' + (c.href
        ? '<a href="' + SC.esc(c.href) + '" data-od-id="breadcrumb-parent-' + index + '">' + SC.esc(c.t) + '</a>'
        : '<span>' + SC.esc(c.t) + '</span>') + '</li>';
    });
    crumb += '<li><span class="sc-crumb__sep" aria-hidden="true">/</span>' +
             '<span class="sc-crumb__cur" aria-current="page" data-od-id="breadcrumb-current">' + SC.esc(opts.title) + '</span>' +
             (opts.pid ? '<span class="sc-pid">' + opts.pid + '</span>' : '') +
             '</li></ol></nav>';

    var roleOpts = Object.keys(SC.MENU).map(function (r) {
      return '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' + D.ROLES[r].name + '</option>';
    }).join('');

    return '<header class="sc-top" data-od-id="page-topbar">' +
      '<div class="sc-page-navigation">' +
        '<a class="sc-page-back" id="sc-page-back" href="' + SC.esc(backHref) + '" aria-label="返回上一页" title="返回上一页" data-od-id="page-back">' + SC.icon('chevron', 18) + '</a>' +
        crumb +
      '</div>' +
      '<div class="sc-roleswitch">' +
        '<span class="sc-roleswitch__hint">原型角色</span>' +
        '<select class="select select--sm" id="sc-role" style="width:auto">' + roleOpts + '</select>' +
      '</div>' +
    '</header>';
  }

  /* ---------------------------------------------- 角色切换（原型脚手架） */

  function firstHref(role) {
    var items = SC.MENU[role] || [];
    for (var i = 0; i < items.length; i++) if (items[i].href) return items[i].href;
    return '';
  }

  function wireRoleSwitch() {
    var sel = document.getElementById('sc-role');
    if (!sel) return;
    sel.addEventListener('change', function () {
      var target = firstHref(sel.value);
      if (target) {
        var url = new URL(target, pageAddress());
        url.searchParams.set('role', sel.value);
        if (SC.B2?.defaults[sel.value]) url.searchParams.set('as', SC.B2.defaults[sel.value]);
        location.href = url.href;
      } else {
        SC.toast(D.ROLES[sel.value].name + '的页面属原型批 3，尚未交付', 'bad');
        sel.value = sel.dataset.cur;
      }
    });
    sel.dataset.cur = sel.value;
  }

  /* ---------------------------------------------- 页面入口 */

  /**
   * @param {Object} opts  {role, menu, pid, title, desc, crumb, actions}
   * @param {Function} render  render(contentEl) —— 在内容区渲染页面主体
   */
  SC.page = function (opts, render) {
    var originalOpts = opts;
    var identity = SC.B2?.identity(opts.role);
    var denied = identity && (!identity.valid || identity.role !== opts.role);
    if (SC.B2) {
      SC.B2.refreshOrganisation();
      var currentRole = D.ROLES[identity.role] ? identity.role : opts.role;
      if (identity.person && D.CURRENT[currentRole]) {
        D.CURRENT[currentRole] = Object.assign({}, D.CURRENT[currentRole], {
          name: identity.person.name, group: identity.person.group,
          pool: identity.person.pool ? SC.B2.name('pools', identity.person.pool) : ''
        });
      }
      opts = Object.assign({}, opts, { role: currentRole });
      SC.B2.role = currentRole;
    }
    SC.rerender = function () { SC.page(originalOpts, render); };
    document.title = opts.title + ' · 销售指挥官 V1.0';

    var app = document.getElementById('sc-app');
    unwireNavigation();
    app.className = 'sc-app';
    app.innerHTML =
      navHTML(opts.role, opts.menu) +
      '<div class="sc-main">' + topHTML(opts) + '<main class="sc-content" aria-label="' + SC.esc(opts.title) + '"></main></div>';

    var content = app.querySelector('.sc-content');

    if (opts.title && opts.showHead !== false) {
      content.innerHTML =
        '<div class="sc-page-head">' +
          '<div class="u-grow">' +
            (opts.desc ? '<p class="sc-page-desc">' + opts.desc + '</p>' : '') +
          '</div>' +
          '<div class="sc-page-actions" id="sc-page-actions"></div>' +
        '</div>' +
        '<div id="sc-page-body"></div>';
    } else {
      content.innerHTML = '<div id="sc-page-body"></div>';
    }

    wireRoleSwitch();
    wireNavigation();
    wirePageBack();

    var body = document.getElementById('sc-page-body');
    var actions = document.getElementById('sc-page-actions');
    if (denied) body.innerHTML = SC.empty({ title: '无权访问', reason: '当前身份、账号或角色不允许访问此页面。' });
    else if (render) render(body, actions);
    if (identity) {
      document.querySelectorAll('.sc-nav a, #sc-page-body a, #sc-page-actions a').forEach(function (a) {
        var raw = a.getAttribute('href');
        if (!raw || raw[0] === '#' || a.hasAttribute('download')) return;
        var u = new URL(a.href);
        if (u.origin !== pageAddress().origin || !/\/pages\/[^/]+\.html$/.test(u.pathname) || u.pathname.endsWith('/login.html')) return;
        if (!u.searchParams.has('role')) u.searchParams.set('role', identity.role);
        if (!u.searchParams.has('as') && u.searchParams.get('role') === identity.role) u.searchParams.set('as', identity.id || '');
        a.href = u.href;
      });
    }
  };

  /** 无框架页面（登录页、导航页） */
  SC.bare = function (title, render) {
    unwireNavigation();
    document.title = title + ' · 销售指挥官 V1.0';
    var app = document.getElementById('sc-app');
    if (render) render(app);
  };

})(window.SC);
