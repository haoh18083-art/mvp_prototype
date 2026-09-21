/**
 * V0.2 功能页公共组件。
 * 提供页面外壳和功能模块实际使用的转义、图标、徽标、弹窗与消息提示能力。
 */
window.SC = window.SC || {};

(function (SC) {
  'use strict';

  SC.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  SC.el = function (html) {
    var template = document.createElement('template');
    template.innerHTML = String(html).trim();
    return template.content.firstElementChild;
  };

  SC.param = function (name) {
    var match = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return match ? decodeURIComponent(match[1]) : '';
  };

  var ICONS = {
    building: '<path d="M2.5 14V3.5l6-2 5 2V14M2.5 14h11M5.5 6h2M5.5 9h2M10 6h1.5M10 9h1.5M6.5 14v-2.5h3V14"/>',
    check: '<path d="M2.5 8.5l3.5 3.5 7.5-7.5"/>',
    mic: '<path d="M8 2.2a2 2 0 012 2v3.4a2 2 0 01-4 0V4.2a2 2 0 012-2zM4.2 7.4a3.8 3.8 0 007.6 0M8 11.2v2.6M6 13.8h4"/>',
    grid: '<path d="M2.5 2.5h5v5h-5zM8.5 2.5h5v5h-5zM2.5 8.5h5v5h-5zM8.5 8.5h5v5h-5z"/>',
    chat: '<path d="M14 8.8c0 2.6-2.7 4.7-6 4.7-.8 0-1.5-.1-2.2-.3L2.5 14.2l.9-2.6A4.5 4.5 0 012 8.8C2 6.2 4.7 4 8 4s6 2.1 6 4.8z"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.6"/>',
    layers: '<path d="M8 1.8l6 3-6 3-6-3 6-3zM2 8.5l6 3 6-3M2 11.8l6 3 6-3"/>',
    inbox: '<path d="M2 8.5h3l1 2h4l1-2h3M2 8.5L4 3h8l2 5.5V13H2V8.5z"/>',
    sliders: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11M6 2.8v3.4M10.5 6.3v3.4M5 9.8v3.4"/>',
    users: '<circle cx="6" cy="5.3" r="2.2"/><path d="M2.5 13.5c.2-2.2 1.5-3.5 3.5-3.5s3.3 1.3 3.5 3.5M10.5 3.5a2 2 0 010 3.8M11 10c1.4.2 2.3 1.3 2.5 3.5"/>',
    box: '<path d="M8 1.8l6 3v6.4l-6 3-6-3V4.8l6-3zM2 4.8l6 3 6-3M8 7.8v6.4"/>',
    search: '<circle cx="7.2" cy="7.2" r="4.4"/><path d="M10.6 10.6L14 14"/>',
    chevron: '<path d="M6 3.5L10.5 8 6 12.5"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.3v4M8 5v.6"/>',
    ok: '<circle cx="8" cy="8" r="6"/><path d="M5.3 8.2l1.9 1.9 3.6-3.7"/>',
    x: '<circle cx="8" cy="8" r="6"/><path d="M6 6l4 4M10 6l-4 4"/>',
    sparkles: '<path d="M8 1.6l1.9 4.7 4.7 1.9-4.7 1.9L8 14.8l-1.9-4.7-4.7-1.9 4.7-1.9z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
  };

  SC.icon = function (name, size) {
    var isLogout = name === 'logout';
    var dimension = size || 16;
    return '<svg class="ico" aria-hidden="true" width="' + dimension + '" height="' + dimension +
      '" viewBox="' + (isLogout ? '0 0 24 24' : '0 0 16 16') +
      '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
      (ICONS[name] || ICONS.info) + '</svg>';
  };

  SC.badge = function (text, tone, options) {
    var opts = options || {};
    var classes = 'badge' + (tone ? ' badge--' + tone : '') + (opts.sm ? ' badge--sm' : '');
    return '<span class="' + classes + '">' + SC.esc(text) + '</span>';
  };

  SC.modal = function (options) {
    var opts = options || {};
    var mask = SC.el(
      '<div class="mask">' +
        '<div class="modal' + (opts.size ? ' modal--' + opts.size : '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal__head">' +
            '<div><div class="modal__title">' + SC.esc(opts.title) + '</div>' +
            (opts.sub ? '<div class="modal__sub">' + opts.sub + '</div>' : '') + '</div>' +
            '<button class="modal__x" type="button" aria-label="关闭">' + SC.icon('close', 14) + '</button>' +
          '</div>' +
          '<div class="modal__body"></div>' +
          '<div class="modal__foot' + (opts.footSplit ? ' modal__foot--split' : '') + '"></div>' +
        '</div>' +
      '</div>'
    );
    var body = mask.querySelector('.modal__body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    function close() {
      mask.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(event) {
      if (event.key === 'Escape') close();
    }

    var foot = mask.querySelector('.modal__foot');
    (opts.buttons || [{ label: '关闭', close: true }]).forEach(function (item) {
      if (item.spacer) {
        foot.appendChild(SC.el('<div class="u-grow"></div>'));
        return;
      }
      var button = SC.el('<button type="button" class="btn ' + (item.cls || '') + '">' + SC.esc(item.label) + '</button>');
      button.disabled = !!item.disabled;
      button.addEventListener('click', function () {
        if (item.onClick) item.onClick(close, body);
        else if (item.close !== false) close();
      });
      foot.appendChild(button);
    });

    mask.querySelector('.modal__x').addEventListener('click', close);
    mask.addEventListener('mousedown', function (event) {
      if (event.target === mask) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(mask);
    return { close: close, body: body, root: mask };
  };

  SC.toast = function (message, tone) {
    var host = document.querySelector('.toast-host');
    if (!host) {
      host = SC.el('<div class="toast-host"></div>');
      document.body.appendChild(host);
    }
    var icon = tone === 'ok' ? 'ok' : (tone === 'bad' ? 'x' : 'info');
    var toast = SC.el('<div class="toast' + (tone ? ' toast--' + tone : '') + '">' +
      SC.icon(icon, 14) + SC.esc(message) + '</div>');
    host.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = 'opacity .2s, transform .2s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(function () { toast.remove(); }, 220);
    }, tone === 'bad' ? 3200 : 1900);
  };
})(window.SC);
