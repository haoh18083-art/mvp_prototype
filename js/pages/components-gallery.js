/* ==========================================================================
   组件总览 · 批 1 的核心交付物
   12 个公共组件的全部取值与呈现，供评审一次定型；批 2、批 3 直接复用。
   ========================================================================== */

(function (SC) {
  'use strict';

  var D = SC.DATA;

  function gal(id, title, rule, rows) {
    return '<div class="gal">' +
      '<div class="gal__head">' +
        '<span class="gal__id">' + id + '</span>' +
        '<span class="gal__t">' + title + '</span>' +
        '<span class="gal__rule">' + rule + '</span>' +
      '</div>' +
      '<div class="gal__body">' + rows.map(function (r) {
        return '<div class="gal__row"><span class="gal__label">' + r[0] + '</span>' +
               '<span class="gal__demo">' + r[1] + '</span></div>';
      }).join('') + '</div>' +
    '</div>';
  }

  SC.page({
    role: 'ADM', menu: 'people', pid: '组件总览',
    title: '公共组件规范',
    crumb: [],
    desc: '批 1 定型的 12 个公共组件。<b>后续页面不得各自另做一套</b>——' +
          '批 3 的 33 个页面几乎全部依赖这里的状态呈现。'
  }, function (body) {

    var out = '<div class="gallery">';

    /* ---------------------------------------------- C-01 */
    out += gal('C-01', '空间状态标签',
      '五值 + 「当前无装载商机」附加标注。<b>标注不是第六个状态值</b>——空间状态五值是 M09 已定版第 6 条。',
      [
        ['未建立空间', SC.spaceState('none') + '<span class="u-f11 u-t3">无入口</span>'],
        ['建立中', SC.spaceState('creating') + '<span class="u-f11 u-t3">不提供进入入口</span>'],
        ['建立失败', SC.spaceState('failed', { why: '装载条件失效：产品已取消激活' }) +
          '<button class="btn btn--sm">重试</button><span class="u-f11 u-t3">主管（本组）与超管可重试</span>'],
        ['正常', SC.spaceState('normal') + '<a class="btn btn--sm" href="#">进入</a>'],
        ['<b>正常 + 当前无装载商机</b>', SC.spaceState('normal', { empty: true }) +
          '<button class="btn btn--sm">归档</button>' +
          '<span class="u-f11 u-t3">合法长期状态，不催办；归档仅主管与超管</span>'],
        ['已归档（可解档）', SC.spaceState('archived') + '<span class="u-f11 u-t3">只读进入</span>'],
        ['只读归档（终态）', SC.spaceState('frozen') + '<span class="u-f11 u-t3">只读进入，不可解档</span>']
      ]);

    /* ---------------------------------------------- C-02 */
    var agentRows = Object.keys(SC.AGENT_STATES).map(function (k) {
      return [SC.AGENT_STATES[k].label, SC.agentState(k, k === 'bindfail' || k === 'readfail'
        ? { why: k === 'bindfail' ? '实例创建超时' : '客户档案读取未完成' } : {})];
    });
    agentRows.push(['<b>与空间状态并列</b>',
      SC.statePair('normal', 'ready') + '<span class="u-f11 u-t3">两者分列，不互相代替</span>']);
    agentRows.push(['三者分列（组合详情）',
      SC.statePair('normal', 'reading', { readyRow: 'ready' })]);
    agentRows.push(['解决方案人员视角', '<span class="u-f12 u-t3">不展示该区域</span>']);

    out += gal('C-02', 'Agent 实例状态标签',
      '八值。与空间状态<b>分列展示</b>；「已绑定」是 PRD-01 验收线；绑定失败与读取失败进<b>两个独立清单</b>。',
      agentRows);

    /* ---------------------------------------------- C-03 */
    out += gal('C-03', '商机状态三分区',
      '归属 / 进行中事项 / 经营结果<b>三项并列</b>——M07-1 §4.1 明确「不用一个标签覆盖全部含义」。',
      [
        ['空余 · 无事项 · 可推进', SC.oppState({ own: 'free', pending: 'none', result: 'active' })],
        ['已归属 · 争议申请中 · 可推进',
          SC.oppState({ own: 'owned', sales: '付赞', pending: 'dispute', result: 'active' })],
        ['已归属 · 恢复申请中 · 已流失',
          SC.oppState({ own: 'owned', sales: '张云飞', pending: 'restore', result: 'lost' })],
        ['已归属 · 无事项 · 已成单',
          SC.oppState({ own: 'owned', sales: '杨锐', pending: 'none', result: 'won' })],
        ['紧凑形态（列表内）',
          SC.oppState({ own: 'owned', sales: '付赞', pending: 'release', result: 'active' }, { inline: true })],
        ['非归属销售视角',
          SC.oppState({ own: 'owned', sales: '付赞', pending: 'none', result: 'active' }, { inline: true }) +
          '<span class="u-f11 u-t3">释放审批中对非归属销售<b>显示为已归属</b>，不暴露释放动向</span>']
      ]);

    /* ---------------------------------------------- C-04 */
    out += gal('C-04', '客户池标签',
      '客户级为多值（同一客户不同商机可分属不同池），商机级为单值。含「未指定」态。',
      [
        ['单值（商机级）', SC.poolTags(['通信线路池'])],
        ['多值（客户级）', SC.poolTags(['通信线路池', '号码认证池'])],
        ['超出折叠', SC.poolTags(['通信线路池', '号码认证池', '智能外呼池', '金融通道池'])],
        ['未指定', SC.poolTags([]) + '<span class="u-f11 u-t3">该商机不装载、不建立空间</span>']
      ]);

    /* ---------------------------------------------- C-05 */
    var comboHost = '<div id="combos" style="width:100%"></div>';
    out += gal('C-05', '组合-空间两层卡',
      '组合行 → 按客户池展开当前空间行。<b>不合并不同池的经营内容</b>；未分池商机单列为待指定承接方。',
      [['点击展开', comboHost]]);

    /* ---------------------------------------------- C-06 */
    out += gal('C-06', '待办台范式',
      '批次列表（基本信息 / 商机数 / 处理进度 / 剩余待处理数）→ 逐条处理 → 结果。',
      [['批次卡片', '<div class="batchlist" style="width:100%">' +
        '<div class="batchcard">' +
          '<div class="u-grow"><div class="u-medium">首批整单申请 · 北京泰迪未来科技</div>' +
            '<div class="u-f12 u-t2 u-mt2">申请人 付赞 · 4 条商机 · 提交于 2026-09-07 10:22</div></div>' +
          '<div style="min-width:130px"><div class="u-f11 u-t3 u-mb2">处理进度 1/4</div>' +
            '<div class="progress"><div class="progress__fill" style="width:25%"></div></div></div>' +
          SC.badge('剩余 3 条', 'amber', { sm: true }) +
          '<button class="btn btn--sm btn--primary">处理</button>' +
        '</div>' +
        '<div class="batchcard">' +
          '<div class="u-grow"><div class="u-medium">空余商机认领 · 中华保险</div>' +
            '<div class="u-f12 u-t2 u-mt2">申请人 张云飞 · 2 条商机 · 提交于 2026-09-07 09:41</div></div>' +
          '<div style="min-width:130px"><div class="u-f11 u-t3 u-mb2">处理进度 2/2</div>' +
            '<div class="progress"><div class="progress__fill progress__fill--green" style="width:100%"></div></div></div>' +
          SC.badge('已完成', 'green', { sm: true }) +
          '<button class="btn btn--sm">查看</button>' +
        '</div>' +
      '</div>']]);

    /* ---------------------------------------------- C-07 */
    out += gal('C-07', '清单 + 详情范式',
      '五段固定：筛选区 → 汇总区 → 列表区 → 详情区 → 结果区。适用于 15 个以上列表页。',
      [['结构', '<div class="u-row u-wrap u-g2">' +
        ['筛选区', '汇总区', '列表区', '详情区', '结果区'].map(function (s, i) {
          return SC.badge((i + 1) + '. ' + s, 'outline');
        }).join('') + '</div>'],
       ['实例', '<span class="u-f12 u-t2">见 <a href="people-list.html">P-ADM-01 人员管理列表页</a>、' +
         '<a href="audit-query.html">P-ADM-30 操作审计查询页</a></span>']]);

    /* ---------------------------------------------- C-08 */
    out += gal('C-08', '批量结果反馈范式',
      '成功数 + 失败数 + <b>逐条失败原因</b> + 按原因提供对应处理入口 + 可导出。',
      [['结果块', '<div style="width:100%">' + SC.result({
        nums: [
          { k: '成功指定', v: 34, tone: 'ok' },
          { k: '转入', v: 6 },
          { k: '未能指定', v: 4, tone: 'bad' }
        ],
        rows: [
          { obj: 'O-3301 天枢无忧盾 Pro', why: '产品未激活，对应商机不进入业务商机栏', act: '前往产品管理' },
          { obj: 'O-3312 号码认证服务', why: '空余商机，需先经客保审批确定归属才能指定客户池', act: '前往客保裁决台' }
        ],
        export: true
      }) + '</div>']]);

    /* ---------------------------------------------- C-09 */
    out += gal('C-09', '转入确认范式',
      '统一文案「<b>当前属于 X，将转入 Y</b>」，逐条展示。出现在 M05-2 §4.1／§4.2／§4.3 三处，文案与交互必须一致。',
      [['转入清单', '<div style="width:100%">' + SC.transfer([
        { obj: 'O-3391 智能外呼', from: '通信线路池', to: '号码认证池' },
        { obj: 'O-3402 号码认证', from: '未指定', to: '号码认证池' },
        { obj: '闫丽梅（解决方案人员）', from: '通信线路池', to: '金融通道池' }
      ]) + '</div>']]);

    /* ---------------------------------------------- C-10 */
    out += gal('C-10', '影响提示弹窗范式',
      '固定三段：影响提示区 → 操作区 → 结果区。<b>查看明细不执行操作</b>（M01 §4.5、M06 §4.6）。',
      [
        ['一般影响', '<div style="width:100%">' + SC.impact({
          title: '将归档「付赞 · 中华保险 · 号码认证池」空间',
          cells: [{ k: '历史记录', v: 42 }, { k: '关联商机', v: 0 }, { k: '实例', v: 1 }],
          note: '该空间当前无装载商机。归档后<b>实例将停止</b>，历史输出保留只读；' +
                '商机回到该池时<b>自动解档</b>，不需重新准入。'
        }) + '</div>'],
        ['危险影响', '<div style="width:100%">' + SC.impact({
          danger: true,
          title: '将停用 韩增（华北二组）的账号',
          cells: [{ k: '归属客户', v: 6 }, { k: '归属商机', v: 8 }, { k: '已建空间', v: 5 }],
          note: '商机数含<b>已结束、产品未激活及未建空间</b>的仍归属记录。<br>' +
                '<b>账号停用不改变商机归属</b>；正式交接须在离职交接页面明确办理。'
        }) + '</div>'],
        ['适用场景', '<div class="u-row u-wrap u-g2">' +
          ['账号停用', '客户池删除', '客户合并', '取消激活', '空间归档', '离职交接'].map(function (s) {
            return SC.badge(s, 'outline');
          }).join('') + '</div>'],
        ['演示', '<button class="btn btn--sm" id="demo-modal">打开停用确认弹窗</button>']
      ]);

    /* ---------------------------------------------- C-11 */
    out += gal('C-11', '空状态范式',
      '空状态 + <b>原因</b> + 处理入口。<b>禁止只显示「暂无数据」</b>——M02-1 §4.1 明确要求给出原因。',
      [
        ['需分配客户池', '<div style="width:100%;border:1px solid var(--border);border-radius:8px">' +
          SC.empty({ sm: true, title: '暂无可见客户内容',
            reason: '您尚未被分配客户池。解决方案人员按<b>本池承接的商机</b>确定可见范围，' +
                    '需由超级管理员在「客户池管理」分配。',
            actions: [{ label: '联系超级管理员' }] }) + '</div>'],
        ['无可提报组合', '<div style="width:100%;border:1px solid var(--border);border-radius:8px">' +
          SC.empty({ sm: true, title: '暂无可提报的经营组合',
            reason: '本人名下商机对应产品<b>均未激活</b>，因此不满足「至少一条已激活正式商机」的提报条件。' +
                    '这不代表没有客户——组合与归属关系仍然存在。' }) + '</div>'],
        ['错误示范', '<div style="width:100%;border:1px dashed var(--red-200);border-radius:8px;' +
          'background:var(--red-50)">' +
          '<div class="empty empty--sm"><div class="empty__title u-danger">暂无数据</div>' +
          '<div class="empty__reason">缺少原因与处理入口，不符合 C-11 规范</div></div></div>']
      ]);

    /* ---------------------------------------------- C-12 */
    out += gal('C-12', '依据引用跳转',
      '「记录类型 + 记录标识 + 可定位位置 + 引用用途」。所指记录被更正后引用<b>仍指向该记录</b>并展示「已更正」。',
      [
        ['单条引用', SC.evidence({ type: '跟进记录', id: 'F-8821' }) +
          SC.evidence({ type: '录音', id: 'R-3390' }) +
          SC.evidence({ type: '审批记录', id: 'AP-1120', fixed: true })],
        ['按用途分组', '<div style="width:100%">' + SC.evidenceGroup([
          { use: '触发源', type: '页面动作', id: 'D-04 停用确认弹窗' },
          { use: '判断依据', type: '归属清单', id: 'O-3180 等 8 条' },
          { use: '判断依据', type: '分组关系', id: 'G-02 华北二组', fixed: true }
        ]) + '</div>'],
        ['关系快照前后对照', '<div style="width:100%">' + SC.snapshot([
          { k: '账号状态', before: '启用', after: '停用' },
          { k: '当前客户池', before: '通信线路池', after: '号码认证池' }
        ]) + '</div>']
      ]);

    /* ---------------------------------------------- 附：通用控件 */
    out += gal('附', '通用控件',
      '按钮、输入、徽标、页签、提示条。不在 12 个规范组件内，但同样在批 1 定型。',
      [
        ['按钮', '<button class="btn btn--primary">主操作</button>' +
          '<button class="btn">次操作</button>' +
          '<button class="btn btn--danger">危险操作</button>' +
          '<button class="btn btn--danger-solid">确认停用</button>' +
          '<button class="btn btn--ghost">' + SC.icon('close', 14) + '</button>' +
          '<button class="btn" disabled>禁用</button>' +
          '<button class="btn--link">文字链接</button>'],
        ['尺寸', '<button class="btn btn--lg btn--primary">大</button>' +
          '<button class="btn btn--primary">中</button>' +
          '<button class="btn btn--sm btn--primary">小</button>'],
        ['输入', '<div style="width:200px"><input class="input" placeholder="普通输入"></div>' +
          '<div style="width:230px"><div class="input-affix">' +
            '<input class="input" placeholder="前缀"><span class="input-affix__suffix">@teddymobile.cn</span>' +
          '</div></div>' +
          '<div style="width:140px"><select class="select"><option>下拉选择</option></select></div>'],
        ['选择', '<label class="check"><input type="checkbox" checked>复选</label>' +
          '<label class="radio"><input type="radio" checked>单选</label>' +
          '<span class="switch"><input type="checkbox" checked><span class="switch__track"></span></span>'],
        ['徽标', SC.badge('默认') + SC.badge('品牌', 'brand') + SC.badge('成功', 'green') +
          SC.badge('警示', 'amber') + SC.badge('失败', 'red') + SC.badge('终态', 'dark') +
          SC.badge('描边', 'outline') + SC.state(true) + SC.state(false)],
        ['提示条', '<div style="width:100%" class="u-col u-g2">' +
          SC.note('中性说明。', '') +
          SC.note('信息提示：说明规则或口径。', 'info') +
          SC.note('警示：条件不满足或需人工处理。', 'warn') +
          SC.note('危险：操作不可撤销。', 'danger') +
          SC.note('成功：结果已生效。', 'green') + '</div>'],
        ['Toast', '<button class="btn btn--sm" id="t1">成功</button>' +
          '<button class="btn btn--sm" id="t2">失败</button>' +
          '<button class="btn btn--sm" id="t3">中性</button>']
      ]);

    out += '</div>';
    body.innerHTML = out;

    /* ---------------------------------------------- 挂载交互组件 */
    var host = SC.qs('#combos', body);
    D.DEMO_COMBOS.forEach(function (c, i) {
      var node = SC.combo(c);
      if (i === 0) node.classList.add('is-open');
      host.appendChild(node);
    });

    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-archive]');
      if (!b) return;
      e.stopPropagation();
      SC.modal({
        title: '归档空间确认',
        sub: '仅本组销售主管与超级管理员可发起',
        body: SC.impact({
          title: '将归档空间 ' + b.dataset.archive,
          cells: [{ k: '历史记录', v: 42 }, { k: '当前装载商机', v: 0 }, { k: '实例', v: 1 }],
          note: '该空间当前无装载商机。归档后<b>实例将停止</b>，历史输出保留只读；' +
                '商机回到该池时<b>自动解档且不需重新准入</b>。'
        }),
        buttons: [
          { label: '取消', cls: '' },
          { label: '确认归档', cls: 'btn--primary',
            onClick: function (close) { close(); SC.toast('空间已归档', 'ok'); } }
        ]
      });
    });

    SC.qs('#demo-modal', body).addEventListener('click', function () {
      SC.modal({
        title: '停用账号确认',
        sub: '停用后该账号无法登录，无法访问任何客户工作空间',
        body: SC.impact({
          danger: true,
          title: '将停用 韩增（华北二组）的账号',
          cells: [{ k: '归属客户', v: 6 }, { k: '归属商机', v: 8 }, { k: '已建空间', v: 5 }],
          note: '<b>账号停用不改变商机归属</b>；正式交接须在离职交接页面明确办理。'
        }),
        footSplit: true,
        buttons: [
          { label: '查看交接明细', cls: '', onClick: function () { SC.toast('查看明细不执行停用或交接', 'bad'); } },
          { spacer: true },
          { label: '取消', cls: '' },
          { label: '确认停用', cls: 'btn--danger-solid',
            onClick: function (close) { close(); SC.toast('已停用', 'ok'); } }
        ]
      });
    });

    SC.qs('#t1', body).addEventListener('click', function () { SC.toast('操作成功', 'ok'); });
    SC.qs('#t2', body).addEventListener('click', function () { SC.toast('操作失败，请稍后重试', 'bad'); });
    SC.qs('#t3', body).addEventListener('click', function () { SC.toast('已复制：邮箱'); });
  });

})(window.SC);
