/*
 * 图标注册表：移动端主 UI 所有图标的唯一来源。
 * 统一 24×24 viewBox、stroke="currentColor"、stroke-width 1.8、round cap/join；语义相同的图标只保留一个。
 * 尺寸由 css/components/icon.css 的 .ic / .ic-xs…xl 控制，不在 SVG 上写宽高。
 */
const ICONS = {
  /* 底栏四入口 */
  today: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"></rect><path d="M8 3v4M16 3v4M3.5 10h17"></path>',
  customers: '<circle cx="9" cy="8" r="3.2"></circle><path d="M3.5 19.5c.4-3.4 2.4-5.3 5.5-5.3s5.1 1.9 5.5 5.3M16 5.6a3.2 3.2 0 0 1 0 6.2M17 14.4c2.2.4 3.4 2.1 3.7 5.1"></path>',
  related: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"></rect><path d="M7.5 9h9M7.5 12.5h9M7.5 16h5.5"></path>',
  profile: '<circle cx="12" cy="8.5" r="3.5"></circle><path d="M5 20c.6-3.9 3-6 7-6s6.4 2.1 7 6"></path>',
  /* 本人助手悬浮入口使用气泡图标；首页欢迎区另用熊形象。 */
  assistant: '<path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8.5a2.5 2.5 0 0 1-2.5 2.5h-6.6L8.5 21.5v-4h-4A2.5 2.5 0 0 1 2 15V6.5A2.5 2.5 0 0 1 4.5 4Z"></path><circle class="ios-doll-eye" cx="8.6" cy="9.6" r="1.15" fill="currentColor" stroke="none"></circle><circle class="ios-doll-eye" cx="15.4" cy="9.6" r="1.15" fill="currentColor" stroke="none"></circle><path d="M9 13c1.6 1.5 4.4 1.5 6 0"></path>',
  /* 导航与方向 */
  'arrow-right': '<path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5"></path>',
  'chevron-right': '<path d="m9 5 7 7-7 7"></path>',
  'chevron-down': '<path d="m5 9 7 7 7-7"></path>',
  'chevron-left': '<path d="m15 5-7 7 7 7"></path>',
  /* 状态与操作 */
  check: '<path d="m5 12.5 4.5 4.5L19 7"></path>',
  close: '<path d="M6 6l12 12M18 6 6 18"></path>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z"></path>',
  search: '<circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.3-4.3"></path>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.2-5.5"></path><path d="M20 4.5v5h-5"></path>',
  /* 空间更新入口（顶栏右上角），有更新时由外层按钮加红点 */
  bell: '<path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"></path><path d="M10 19.5a2.2 2.2 0 0 0 4 0"></path>',
  /* 空间助手生成中：发送键切换为停止 */
  stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"></rect>'
};

/**
 * 输出一枚图标。name 取自 ICONS；className 追加到 .ic 上（如 ic-xs / ic-lg 控制尺寸）。
 * 图标一律装饰性，aria-hidden；需要可读名称时由外层按钮的 aria-label 承担。
 */
function icon(name, className) {
  const body = ICONS[name];
  if (!body) return '';
  const cls = ['ic', `ic-${name}`].concat(className ? [className] : []).join(' ');
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** 列表行尾 chevron：is-toggle 为展开/收起（向下、展开时旋转），否则为进入（向右）。 */
function rowChevron(toggle) {
  return `<span class="row-chevron${toggle ? ' is-toggle' : ''}" aria-hidden="true">${icon(toggle ? 'chevron-down' : 'chevron-right')}</span>`;
}
