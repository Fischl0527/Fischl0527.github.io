(function () {
  const LOCK_MS = 3000;

  function triggerUnlock(mainElement) {
    const event = new Event('keydown', {
      bubbles: true,
      cancelable: true
    });

    Object.defineProperty(event, 'key', { value: 'Enter' });
    Object.defineProperty(event, 'code', { value: 'Enter' });
    Object.defineProperty(event, 'keyCode', { value: 13 });
    Object.defineProperty(event, 'which', { value: 13 });
    Object.defineProperty(event, 'isComposing', { value: false });

    mainElement.dispatchEvent(event);
  }

  function lockButton(button, messageEl) {
    if (!button || button.dataset.locked === '1') return;

    button.dataset.locked = '1';
    button.disabled = true;

    let left = Math.ceil(LOCK_MS / 1000);
    const originText = button.dataset.originText || '解锁文章';
    button.dataset.originText = originText;

    function updateText() {
      button.textContent = `密码错误（${left}s）`;
      if (messageEl) {
        messageEl.textContent = `密码错误，请 ${left} 秒后重试`;
        messageEl.style.display = 'inline-block';
      }
    }

    updateText();

    const timer = setInterval(function () {
      left -= 1;

      if (left > 0) {
        updateText();
        return;
      }

      clearInterval(timer);
      button.disabled = false;
      button.dataset.locked = '0';
      button.textContent = originText;

      if (messageEl) {
        messageEl.textContent = '';
        messageEl.style.display = 'none';
      }
    }, 1000);
  }

  function patchAlert(button, messageEl, wrongPassMessage) {
    if (window.__hbeAlertPatched) return;
    window.__hbeAlertPatched = true;

    const originalAlert = window.alert;
    window.alert = function (msg) {
      if (msg === wrongPassMessage) {
        lockButton(button, messageEl);
      }
      return originalAlert.apply(this, arguments);
    };
  }

  function initHbeEnhance() {
    const mainElement = document.getElementById('hexo-blog-encrypt');
    if (!mainElement) return;
    if (mainElement.dataset.hbeEnhanced === '1') return;

    const content = mainElement.querySelector('.hbe-content');
    if (!content) return;

    const wrongPassMessage = mainElement.dataset.wpm || '密码错误';

    const oldAction = content.querySelector('.hbe-action-wrap');
    if (oldAction) oldAction.remove();

    const actionWrap = document.createElement('div');
    actionWrap.className = 'hbe-action-wrap';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hbe-unlock-btn';
    button.textContent = '解锁文章';

    const messageEl = document.createElement('div');
    messageEl.className = 'hbe-unlock-message';
    messageEl.style.display = 'none';

    actionWrap.appendChild(button);
    actionWrap.appendChild(messageEl);
    content.appendChild(actionWrap);

    patchAlert(button, messageEl, wrongPassMessage);

    button.addEventListener('click', function () {
      if (button.disabled) return;

      if (!window.isSecureContext || !(window.crypto && window.crypto.subtle)) {
        alert('当前页面未启用安全加密环境，请使用 HTTPS 访问后再解锁。');
        return;
      }

      messageEl.textContent = '';
      messageEl.style.display = 'none';
      triggerUnlock(mainElement);
    });

    mainElement.dataset.hbeEnhanced = '1';
  }

  document.addEventListener('DOMContentLoaded', initHbeEnhance);
  window.addEventListener('load', initHbeEnhance);
  window.addEventListener('pjax:complete', initHbeEnhance);
})();
