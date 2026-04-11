(function () {
  const LOCK_MS = 3000;

  function dispatchUnlock(mainElement) {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    mainElement.dispatchEvent(event);
  }

  function lockButton(button, messageEl) {
    if (!button || button.dataset.locked === '1') return;

    button.dataset.locked = '1';
    button.disabled = true;

    let left = Math.ceil(LOCK_MS / 1000);
    const originText = button.dataset.originText || '解锁文章';
    button.dataset.originText = originText;

    function updateLockText() {
      button.textContent = `密码错误（${left}s）`;

      if (messageEl) {
        messageEl.textContent = `密码错误，请 ${left} 秒后重试`;
        messageEl.style.display = 'inline-block';
      }
    }

    updateLockText();

    const timer = setInterval(function () {
      left -= 1;

      if (left > 0) {
        updateLockText();
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
    if (window.__hbe_alert_patched__) return;
    window.__hbe_alert_patched__ = true;

    const rawAlert = window.alert;
    window.alert = function (msg) {
      if (msg === wrongPassMessage) {
        lockButton(button, messageEl);
      }
      return rawAlert.apply(this, arguments);
    };
  }

  function initHbeEnhance() {
    const mainElement = document.getElementById('hexo-blog-encrypt');
    if (!mainElement) return;
    if (mainElement.dataset.hbeEnhanced === '1') return;

    const input = document.getElementById('hbePass');
    const content = mainElement.querySelector('.hbe-content');
    if (!input || !content) return;

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
      messageEl.style.display = 'none';
      messageEl.textContent = '';
      dispatchUnlock(mainElement);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) return;
      messageEl.style.display = 'none';
      messageEl.textContent = '';
      dispatchUnlock(mainElement);
    });

    mainElement.dataset.hbeEnhanced = '1';
  }

  document.addEventListener('DOMContentLoaded', initHbeEnhance);
  window.addEventListener('load', initHbeEnhance);
  window.addEventListener('pjax:complete', initHbeEnhance);
})();
