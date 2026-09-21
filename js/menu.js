/* V0.2 原型导航：仅登记本版功能点页面。 */
window.SC = window.SC || {};

(function (SC) {
  'use strict';

  const feature = (key, label, icon, roles) => ({
    key,
    label,
    icon,
    href: key + '.html?role=' + roles[0],
    src: 'V0.2 功能点'
  });

  const common = {
    customer: feature('customer-spaces', '客户跟进空间', 'building', ['MGR']),
    ownership: feature('customer-ownership', '客户归属视图', 'users', ['MGR']),
    // 跟进工作台本版未实现：菜单位保留但封存，客户空间改由「客户跟进空间」进入。
    followup: { key: 'followup-workbench', label: '跟进工作台', icon: 'check', href: '', disabled: true, disabledReason: '本版未开放', src: 'V0.2 · 待实现工作台' },
    meeting: feature('meeting-center', '录音与会议', 'mic', ['SLS']),
    insights: feature('employee-insights', '经营洞察', 'grid', ['MGR']),
    data: feature('data-insights', '数据洞察', 'chat', ['MGR']),
    push: feature('push-followup', '方案推送跟进', 'clock', ['MGR']),
    platform: feature('platform-data', '平台数据', 'layers', ['MGR']),
    messages: feature('message-center', '消息中心', 'inbox', ['SLS']),
    assistant: feature('sales-assistant', '销售助手', 'chat', ['SLS']),
    solution: feature('solution-center', '方案协同台', 'layers', ['SOL']),
    operations: feature('operations-config', '运营配置', 'sliders', ['ADM']),
    products: feature('product-library', '产品知识库', 'box', ['ADM']),
    review: feature('conversation-review', '会话审阅', 'chat', ['ADM'])
  };

  const copy = keys => keys.map(key => ({ ...common[key] }));

  SC.MENU = {
    ADM: copy(['customer', 'ownership', 'meeting', 'insights', 'data', 'push', 'platform', 'products', 'review', 'operations']),
    MGR: copy(['customer', 'ownership', 'meeting', 'insights', 'data', 'push', 'platform', 'operations']),
    SLS: copy(['customer', 'followup', 'meeting', 'solution', 'messages', 'assistant']),
    SOL: copy(['solution', 'customer', 'meeting', 'messages'])
  };
})(window.SC);
