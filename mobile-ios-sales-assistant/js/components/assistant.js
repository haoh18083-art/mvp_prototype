/* 助手 overlay：idle → opening → open → closing → idle，动画中忽略重复点击。 */
const assistantPages = [...document.querySelectorAll('[data-assistant-page]')];
const homePage = document.querySelector('[data-home-page]');
let assistantTransition = 'idle';

function settleAssistantOpen() {
  if (assistantTransition !== 'opening') return;
  assistantPages.forEach((page) => page.classList.add('is-open'));
  assistantTransition = 'open';
}

function openAssistant(event, opener) {
  event?.preventDefault();
  if (assistantTransition !== 'idle') return;
  assistantTransition = 'opening';
  const source = opener || event?.currentTarget;
  const rect = source?.getBoundingClientRect();
  const root = document.documentElement;
  /* 圆形揭示的圆心：相对手机框，而不是整个视口。 */
  const isAndroid = document.body.classList.contains('platform-android');
  const surfaceWidth = isAndroid ? 412 : 430;
  const statusHeight = isAndroid ? 31 : 44;
  const surfaceLeft = Math.max(0, (window.innerWidth - Math.min(window.innerWidth, surfaceWidth)) / 2);
  root.style.setProperty('--origin-x', `${rect ? rect.left - surfaceLeft + rect.width / 2 : Math.min(window.innerWidth, surfaceWidth) * .88}px`);
  root.style.setProperty('--origin-y', `${rect ? rect.top - statusHeight + rect.height / 2 : 50}px`);
  homePage?.setAttribute('aria-hidden', 'true');
  homePage?.classList.add('is-assistant-hidden');
  assistantPages.forEach((page) => {
    page.classList.remove('is-closing', 'is-open');
    page.classList.add('is-visible');
    page.setAttribute('aria-hidden', 'false');
    page.addEventListener('animationend', settleAssistantOpen, { once: true });
  });
  window.setTimeout(settleAssistantOpen, 380);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeAssistant(event) {
  event?.preventDefault();
  if (assistantTransition === 'idle' || assistantTransition === 'closing') return;
  assistantTransition = 'closing';
  assistantPages.forEach((page) => {
    page.classList.remove('is-visible', 'is-open');
    page.classList.add('is-closing');
    page.setAttribute('aria-hidden', 'true');
    page.addEventListener('animationend', () => {
      page.classList.remove('is-closing');
      assistantTransition = 'idle';
    }, { once: true });
  });
  window.requestAnimationFrame(() => homePage?.classList.remove('is-assistant-hidden'));
  window.setTimeout(() => homePage?.removeAttribute('aria-hidden'), 280);
}

/* 欢迎区的「进入聊天助手」按钮随「今日」重画重建，因此用事件委托而不是一次性绑定。 */
document.addEventListener('click', (event) => {
  const opener = event.target.closest('[data-open-assistant]');
  if (opener) { openAssistant(event, opener); return; }
  if (event.target.closest('[data-close-assistant]')) closeAssistant(event);
});
/* iframe 聊天页点返回时发 sales-chat-close，由首页收起 overlay。 */
window.addEventListener('message', (event) => {
  const chatFrame = document.querySelector('.ios-chat-frame, .android-chat-frame');
  if (event.source !== chatFrame?.contentWindow || event.data?.type !== 'sales-chat-close') return;
  closeAssistant();
});
