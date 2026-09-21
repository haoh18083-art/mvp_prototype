/** 功能页公共交互：复用 SC 外壳和设计变量，统一筛选、列表、抽屉及表单的键盘行为。 */
(function (SC, F) {
  'use strict';
  const e = SC.esc;
  F.e = e;
  F.link = (page, query = {}) => page + '.html?' + new URLSearchParams({ role: F.role, as: F.actor?.id || '', ...query });
  F.button = (label, action, value = '', primary = false) => `<button type="button" class="btn ${primary ? 'btn--primary' : ''}" data-action="${e(action)}" data-value="${e(value)}">${e(label)}</button>`;
  F.badge = (label, tone = 'neutral') => SC.badge(label, tone, { sm: true });
  F.status = w => F.badge(w.state === 'frozen' ? '已冻结 · 只读' : '进行中', w.state === 'frozen' ? 'neutral' : 'green');
  F.panel = (title, content, extra = '') => `<section class="fp-panel"><header class="fp-panel-head"><h2>${e(title)}</h2>${extra}</header>${content}</section>`;
  F.empty = (message = '当前暂无记录。', title = '暂无记录') => `<div class="fp-empty">${SC.icon('search', 24)}<h3>${e(title)}</h3><p>${e(message)}</p></div>`;
  let tableSequence = 0, searchSequence = 0;
  const searchBindings = new WeakMap();

  /**
   * 将已有的行 HTML 补齐表格语义与窄容器标签，保持各业务页的渲染方式不变。
   * @param {Array<string|{label:string,className?:string}>} headers 列定义或兼容的列标题。
   * @param {string[]} rows 已转义业务字段后的表格行 HTML。
   * @param {object} options 表格名称、空态、计数与布局选项。
   * @returns {string} 可直接写入页面的完整表格区域。
   */
  F.table = (headers, rows, options = {}) => {
    const tableId = String(options.id || `fp-data-table-${++tableSequence}`).replace(/[^a-zA-Z0-9_-]/g, '-');
    const caption = String(options.caption || '数据列表');
    const columns = headers.map((header, index) => {
      const config = typeof header === 'object' ? header : { label: header };
      const label = String(config.label || '');
      const classes = [config.className, options.columnClasses?.[index]];
      if (index === 0) classes.push('is-primary');
      if (/操作|追踪/.test(label)) classes.push('is-action');
      if (/状态|反馈|阶段|等级|客户池/.test(label)) classes.push('is-status');
      if (/日期|时间|最近发送/.test(label)) classes.push('is-date');
      if (/金额|数量|消息数|客户数|匹配成功|待治理|就绪客户|可见空间/.test(label)) classes.push('is-number');
      if (/介绍|说明|正文|会话路由/.test(label)) classes.push('is-long');
      return { label, id: `${tableId}-column-${index + 1}`, className: classes.filter(Boolean).join(' ') };
    });

    const parser = document.createElement('table');
    parser.innerHTML = `<tbody>${rows.join('')}</tbody>`;
    const body = parser.tBodies[0];
    [...body.rows].forEach(row => {
      const firstCell = row.cells[0];
      const rowTarget = firstCell?.querySelector('strong, a') || firstCell;
      const rowName = rowTarget?.textContent.trim().replace(/\s+/g, ' ') || '';
      [...row.cells].forEach((cell, index) => {
        const column = columns[index];
        if (!column) return;
        cell.setAttribute('headers', column.id);
        column.className.split(' ').filter(Boolean).forEach(name => cell.classList.add(name));
        const mobileLabel = document.createElement('span');
        mobileLabel.className = 'fp-table-cell-label';
        mobileLabel.setAttribute('aria-hidden', 'true');
        mobileLabel.textContent = column.label;
        cell.prepend(mobileLabel);
      });
      row.querySelectorAll('td.is-action button:not([aria-label]), td.is-action a:not([aria-label])').forEach(control => {
        const action = control.textContent.trim().replace(/\s+/g, ' ');
        if (action && rowName) control.setAttribute('aria-label', `${action}：${rowName}`);
      });
    });

    const rowCount = rows.length;
    const totalCount = Number.isFinite(Number(options.totalCount)) ? Number(options.totalCount) : rowCount;
    const countLabel = String(options.countLabel || '条记录');
    const summary = totalCount !== rowCount ? `显示 ${rowCount} / ${totalCount} ${countLabel}` : `共 ${rowCount} ${countLabel}`;
    const minWidth = Number(options.minWidth) || (headers.length >= 7 ? 840 : headers.length >= 6 ? 760 : headers.length === 5 ? 640 : 0);
    const tableClasses = ['fp-table', 'fp-data-table', headers.length >= 6 ? 'fp-data-table--wide' : '', headers.length <= 2 ? 'fp-data-table--single' : '', options.compact ? 'fp-data-table--compact' : '', options.tableClass || ''].filter(Boolean).join(' ');
    const wrapClasses = ['fp-table-wrap', 'fp-data-table-wrap', options.wrapClass || ''].filter(Boolean).join(' ');
    const emptyTitle = options.emptyTitle || (totalCount > 0 ? '未找到记录' : '暂无记录');
    const bodyHtml = rowCount ? body.innerHTML : `<tr class="is-empty"><td colspan="${headers.length}">${F.empty(options.emptyMessage, emptyTitle)}</td></tr>`;
    const headerHtml = columns.map(column => `<th id="${e(column.id)}" scope="col" class="${e(column.className)}">${e(column.label)}</th>`).join('');
    const note = options.note ? `<span>${e(options.note)}</span>` : '';
    return `<div class="fp-table-shell" data-row-count="${rowCount}" data-total-count="${totalCount}" data-count-label="${e(countLabel)}">
      <div class="${e(wrapClasses)}" role="region" aria-label="${e(caption)}" tabindex="0">
        <table id="${e(tableId)}" class="${e(tableClasses)}"${minWidth ? ` style="--fp-table-min:${minWidth}px"` : ''}>
          <caption class="fp-sr-only">${e(caption)}</caption>
          <thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody>
        </table>
      </div>
      ${options.showCount === false ? '' : `<footer class="fp-table-footer"><span>${e(summary)}</span>${note}</footer>`}
    </div>`;
  };
  F.metrics = items => `<div class="fp-metrics">${items.map(([label, value, detail]) => `<div class="fp-metric"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail || '')}</small></div>`).join('')}</div>`;
  F.tabs = (items, selected) => `<nav class="fp-tabs" aria-label="内容分类">${items.map(([key, label]) => `<button type="button" data-tab="${e(key)}" class="${key === selected ? 'is-active' : ''}" aria-pressed="${key === selected}">${e(label)}</button>`).join('')}</nav>`;
  F.field = (label, name, value = '', type = 'text', options = []) => `<label class="fp-field"><span>${e(label)}</span>${type === 'select' ? `<select name="${e(name)}">${options.map(x => { const [v, text] = Array.isArray(x) ? x : [x, x]; return `<option value="${e(v)}" ${value === v ? 'selected' : ''}>${e(text)}</option>`; }).join('')}</select>` : type === 'textarea' ? `<textarea name="${e(name)}" rows="5">${e(value)}</textarea>` : `<input type="${e(type)}" name="${e(name)}" value="${e(value)}">`}</label>`;
  F.searchbar = (placeholder, extra = '') => {
    const searchId = `fp-search-${++searchSequence}`;
    return `<form class="fp-toolbar" data-search>
      <div class="fp-toolbar-controls">
        <div class="fp-search">${SC.icon('search', 16)}<label class="fp-sr-only" for="${searchId}">${e(placeholder)}</label><input id="${searchId}" type="search" name="q" autocomplete="off" placeholder="${e(placeholder)}"><button class="fp-search-clear" type="button" data-clear-search aria-label="清空搜索" title="清空搜索" hidden>${SC.icon('close', 14)}</button></div>
        ${extra}
        <button class="btn fp-toolbar-reset" type="reset" disabled>${SC.icon('close', 14)}清除筛选</button>
      </div>
      <div class="fp-toolbar-feedback" data-search-feedback hidden><div class="fp-directory-chips" data-search-chips></div><span data-search-summary role="status" aria-live="polite"></span></div>
    </form>`;
  };

  /** 统一即时筛选、中文输入法保护、条件标签与结果播报。 */
  F.handleSearch = (root, cb) => {
    searchBindings.get(root)?.dispose();
    const form = root.querySelector('[data-search]');
    if (!form) return;
    const search = form.elements.q;
    const clearSearch = form.querySelector('[data-clear-search]');
    const reset = form.querySelector('[type=reset]');
    const feedback = form.querySelector('[data-search-feedback]');
    const chips = form.querySelector('[data-search-chips]');
    const summary = form.querySelector('[data-search-summary]');
    let searchTimer, composing = false, disposed = false;
    const binding = { dispose: () => { disposed = true; clearTimeout(searchTimer); } };
    searchBindings.set(root, binding);

    const readValues = () => Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value]));
    const activeItems = values => Object.entries(values).filter(([, value]) => String(value || '').trim());
    const fieldLabel = (name, value) => {
      if (name === 'q') return `关键词：${value}`;
      const field = form.elements[name];
      const title = field?.closest('.fp-field')?.querySelector(':scope > span')?.textContent.trim() || name;
      const selected = field?.tagName === 'SELECT' ? field.selectedOptions[0]?.textContent.trim() : value;
      return `${title}：${selected || value}`;
    };
    const syncState = values => {
      const items = activeItems(values);
      const scope = form.closest('.fp-panel') || root;
      const table = scope.querySelector('.fp-table-shell');
      const count = Number(table?.dataset.rowCount || 0), total = Number(table?.dataset.totalCount || count);
      const countLabel = table?.dataset.countLabel || '条记录';
      chips.innerHTML = items.map(([name, value]) => {
        const label = fieldLabel(name, value);
        return `<button type="button" class="fp-filter-chip" data-remove-filter="${e(name)}" aria-label="移除筛选条件：${e(label)}" title="${e(label)}"><span>${e(label)}</span>${SC.icon('close', 12)}</button>`;
      }).join('');
      feedback.hidden = items.length === 0;
      summary.textContent = items.length ? `显示 ${count} / ${total} ${countLabel}` : '';
      reset.disabled = items.length === 0;
      clearSearch.hidden = !search.value.trim();
    };
    const apply = (values = readValues()) => {
      clearTimeout(searchTimer);
      if (disposed || !form.isConnected || root.querySelector('[data-search]') !== form) return;
      if (Object.prototype.hasOwnProperty.call(values, 'q')) search.value = String(values.q || '');
      cb(values);
      syncState(values);
    };
    const schedule = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { if (!disposed) apply(); }, 300);
    };

    form.addEventListener('submit', event => { event.preventDefault(); if (!composing) apply(); });
    form.addEventListener('change', event => { if (event.target.matches('select')) apply(); });
    form.addEventListener('reset', event => {
      event.preventDefault(); clearTimeout(searchTimer); composing = false;
      form.querySelectorAll('input').forEach(field => { field.value = ''; });
      form.querySelectorAll('select').forEach(field => { field.selectedIndex = 0; });
      apply({}); search.focus();
    });
    search.addEventListener('input', event => { clearSearch.hidden = !search.value.trim(); if (!composing && !event.isComposing) schedule(); });
    search.addEventListener('compositionstart', () => { composing = true; clearTimeout(searchTimer); });
    search.addEventListener('compositionend', () => { composing = false; schedule(); });
    search.addEventListener('keydown', event => {
      if (composing || event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); apply(); }
      if (event.key === 'Escape' && search.value) { event.preventDefault(); search.value = ''; apply(); }
    });
    clearSearch.addEventListener('click', () => { composing = false; search.value = ''; apply(); search.focus(); });
    chips.addEventListener('click', event => {
      const chip = event.target.closest('[data-remove-filter]');
      if (!chip) return;
      const field = form.elements[chip.dataset.removeFilter];
      if (field) field.value = '';
      apply();
      if (chip.dataset.removeFilter === 'q') search.focus();
    });
    syncState(readValues());
  };
  F.restoreSearch = (root, values) => {
    root.querySelectorAll('[data-search] [name]').forEach(field => { field.value = values[field.name] || ''; });
  };
  F.bind = (root, actions) => {
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (button && root.contains(button) && actions[button.dataset.action]) {
        try { actions[button.dataset.action](button.dataset.value, button); }
        catch (error) { SC.toast(error.message, 'bad'); }
      }
    });
  };
  F.download = (name, content, type = 'text/csv;charset=utf-8') => {
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  F.csv = rows => rows.map(row => row.map(v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"').join(',')).join('\n');

  /** 抽屉禁用背景焦点，支持 Escape、焦点循环和关闭后返回触发控件。 */
  F.drawer = function (title, html, onReady, modal = false) {
    const opener = document.activeElement, app = document.getElementById('sc-app');
    const mask = SC.el(`<div class="fp-overlay ${modal ? 'fp-overlay--modal' : ''}"><section class="fp-drawer" role="dialog" aria-modal="true" aria-label="${e(title)}"><header class="fp-drawer-head"><div><h2>${e(title)}</h2></div><button type="button" class="btn btn--icon" data-close aria-label="关闭">${SC.icon('close', 18)}</button></header><div class="fp-drawer-body">${html}</div></section></div>`);
    app.inert = true; document.body.append(mask);
    const close = () => {
      mask.remove();
      app.inert = false;
      if (opener?.isConnected) opener.focus();
      else app.querySelector('#sc-role, .sc-nav-toggle')?.focus();
    };
    mask.querySelector('[data-close]').onclick = close;
    mask.addEventListener('click', event => { if (event.target === mask) close(); });
    mask.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const nodes = [...mask.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')];
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    mask.querySelector('[data-close]').focus();
    onReady?.(mask, close);
    return { root: mask, close };
  };
  F.form = (title, fields, submit, done, label = '保存') => F.drawer(title, `<form class="fp-form">${fields}<p class="fp-error" role="alert"></p><footer class="fp-form-foot"><span class="u-t3">本地演示数据</span><button type="submit" class="btn btn--primary">${e(label)}</button></footer></form>`, (root, close) => {
    root.querySelector('form').onsubmit = event => {
      event.preventDefault();
      try { submit(Object.fromEntries(new FormData(event.currentTarget)), root); close(); SC.toast('已保存到本地演示', 'ok'); done?.(); }
      catch (error) { root.querySelector('.fp-error').textContent = error.message; }
    };
  });
  /** 跟进记录必须关联具体商机（R09）；仅客户级确权的空间只提示不可写，不给空表单。 */
  F.followupForm = function (id, done, draft = '') {
    const space = F.space(id);
    const opps = space?.opps || [];
    if (!opps.length) return F.drawer('记录客户跟进', '<div class="fp-callout fp-callout--warn" data-followup-blocked>该空间仅有客户级确权、暂无商机，跟进记录暂不可写；客户级内容照常查看。</div>');
    return F.form('记录客户跟进',
      F.field('关联商机 *', 'opportunityId', opps[0].id, 'select', opps.map(item => [item.id, `${item.name}（${item.id}）`]))
      + F.field('跟进方式', 'type', '电话沟通', 'select', ['电话沟通', '客户拜访', '线上会议'])
      + F.field('跟进内容 *', 'text', draft, 'textarea')
      + F.field('下一步计划', 'next', '', 'textarea')
      + `<input type="hidden" name="baseVersion" value="${e(F.writeBaseline(space))}">`,
      values => F.addFollowup(id, values), done, '确认记录');
  };
  /** 周复盘：进展、下一步、阻塞三项，与网页端同一份内容（R09 §4.3）。 */
  F.weeklyReviewForm = function (id, done) {
    const space = F.space(id);
    return F.form('记录周复盘',
      F.field('本周进展 *', 'progress', '', 'textarea')
      + F.field('下一步 *', 'next', '', 'textarea')
      + F.field('阻塞', 'blockers', '', 'textarea')
      + `<input type="hidden" name="baseVersion" value="${e(F.writeBaseline(space))}">`,
      values => F.addWeeklyReview(id, values), done, '确认记录');
  };
  /**
   * R13 星标 / 暂不跟进表单：今日该跟页与客户空间 hero 共用同一个抽屉与同一条 F.markSpace 校验。
   * 暂不跟进原因必填、结束日选填且不早于今天；保存只写入次日判断输入，当天名单不变。
   */
  F.spaceMarkForm = function (spaceId, done) {
    const state = F.load();
    const space = state.spaces.find(w => w.id === spaceId);
    const mark = (state.insightMarks || []).find(item => item.space === spaceId && item.sales === F.actor?.id && !item.canceledAt);
    F.drawer('标记 · ' + (space?.customer || spaceId), `<form class="fp-form">
      <div class="fp-callout">星标与暂不跟进只作为次日判断的输入，不改变今天已生成的名单，也不保证必进或必出。</div>
      ${F.field('星标', 'starred', mark?.starred ? 'on' : 'off', 'select', [['off', '不星标'], ['on', '星标（次日优先参考）']])}
      ${F.field('暂不跟进原因（填写即视为暂不跟进）', 'reason', mark?.pause?.reason || '', 'textarea')}
      ${F.field('结束日（选填，不填直到取消）', 'until', mark?.pause?.until || '', 'date')}
      <p class="fp-error" role="alert"></p>
      <footer class="fp-form-foot"><span class="u-t3">结束日已过的暂不跟进，次日自动失效</span><button type="submit" class="btn btn--primary">保存标记</button></footer>
    </form>`, (mask, close) => {
      mask.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
          const values = Object.fromEntries(new FormData(form));
          const input = { starred: values.starred === 'on' };
          const reason = String(values.reason || '').trim();
          if (reason || values.until) input.pause = { reason, until: values.until || '' };
          else if (mark?.pause) input.pause = null;
          F.markSpace(spaceId, input);
          close();
          done?.();
          SC.toast('已记录，次日判断时参考；今天名单不变。', 'ok');
        } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
      };
    });
  };
  /** R08 方案推送编辑器：正文、附件和外部链接统一提交，结果按空间逐条反馈。 */
  F.solutionForm = (id, done) => {
    const options = F.visible().filter(w => w.state === 'active');
    F.drawer('推送方案', `<form class="fp-form" data-solution-form>
      <div class="fp-callout">方案会按空间独立留存。冻结空间不会出现在可选范围内；单个空间失败不会影响其他空间。</div>
      <fieldset class="fp-checks"><legend>接收空间 *</legend>${options.map(w => `<label><input type="checkbox" name="spaces" value="${e(w.id)}" ${w.id === id ? 'checked' : ''}><span><strong>${e(w.customer)}</strong><small>${e(F.name(w.sales))} · ${e(w.pool)} · ${e(w.id)}</small></span></label>`).join('')}</fieldset>
      ${F.field('方案标题 *', 'title')}
      ${F.field('方案正文 *', 'body', '', 'textarea')}
      <label class="fp-field"><span>附件（可选，单个演示文件）</span><input name="attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md"></label>
      ${F.field('外部链接（可选）', 'externalLink')}
      <p class="fp-error" role="alert"></p>
      <footer class="fp-form-foot"><span class="u-t3">附件仅保存文件名与大小，不上传真实文件。</span><button type="submit" class="btn btn--primary">确认推送</button></footer>
    </form>`, (mask, close) => {
      mask.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const form = event.currentTarget;
        try {
          const values = Object.fromEntries(new FormData(form));
          const file = form.elements.attachment.files[0];
          const results = F.sendSolution([...form.querySelectorAll('[name=spaces]:checked')].map(node => node.value), {
            ...values,
            attachments: file ? [{ name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` }] : []
          });
          close();
          done?.();
          const state = F.load();
          F.drawer('逐空间推送结果', `<div class="fp-stack"><p class="fp-hint">每个空间独立生成方案记录；失败项可以回到推送页重新提交。</p><ul class="fp-upload-results">${results.map((item, index) => { const space = state.spaces.find(candidate => candidate.id === item.space); return `<li data-solution-result="${e(item.status)}"><span class="fp-upload-index">${index + 1}</span><div><strong>${e(space?.customer || item.space)}</strong>${F.badge(item.status === 'success' ? '已提交' : '提交失败', item.status === 'success' ? 'green' : 'amber')}<small>${e(item.status === 'success' ? '已进入该空间方案往来，并生成销售提醒。' : item.reason || '该空间未生成方案记录。')}</small></div></li>`; }).join('')}</ul></div>`);
          SC.toast(results.every(item => item.status === 'success') ? '方案已按空间提交' : '方案已提交，部分空间需要处理', results.every(item => item.status === 'success') ? 'ok' : 'bad');
        } catch (error) { form.querySelector('.fp-error').textContent = error.message; }
      };
    });
  };
})(window.SC, window.SC.FEATURES);
