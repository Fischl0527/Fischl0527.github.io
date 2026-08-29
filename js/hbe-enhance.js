(function () {
  'use strict';

  var LOCK_MS = 3000;
  var controller = null;

  function currentElements() {
    var main = document.getElementById('hexo-blog-encrypt');
    return {
      main: main,
      button: main ? main.querySelector('.hbe-unlock-btn') : null,
      message: main ? main.querySelector('.hbe-unlock-message') : null
    };
  }

  function triggerUnlock(main) {
    var event = new Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      key: { value: 'Enter' },
      code: { value: 'Enter' },
      keyCode: { value: 13 },
      which: { value: 13 },
      isComposing: { value: false }
    });
    main.dispatchEvent(event);
  }

  function lockCurrentButton(button, message, signal) {
    if (!button || button.dataset.locked === '1') return;

    button.dataset.locked = '1';
    button.disabled = true;
    button.dataset.originText = button.dataset.originText || button.textContent || '解锁文章';
    var secondsLeft = Math.ceil(LOCK_MS / 1000);

    function update() {
      if (!button.isConnected) return;
      button.textContent = '密码错误（' + secondsLeft + 's）';
      if (message && message.isConnected) {
        message.textContent = '密码错误，请 ' + secondsLeft + ' 秒后重试';
        message.style.display = 'inline-block';
      }
    }

    var timer;
    function unlock() {
      window.clearInterval(timer);
      if (!button.isConnected) return;
      button.disabled = false;
      button.dataset.locked = '0';
      button.textContent = button.dataset.originText;
      if (message && message.isConnected) {
        message.textContent = '';
        message.style.display = 'none';
      }
    }

    update();
    timer = window.setInterval(function () {
      secondsLeft -= 1;
      if (secondsLeft > 0) update();
      else unlock();
    }, 1000);
    signal.addEventListener('abort', function () { window.clearInterval(timer); }, { once: true });
  }

  function patchAlert() {
    if (window.__lfHbeAlertPatched) return;
    window.__lfHbeAlertPatched = true;
    window.__lfHbeOriginalAlert = window.alert.bind(window);

    window.alert = function (value) {
      var elements = currentElements();
      var wrongPasswordMessage = elements.main && elements.main.dataset.wpm;
      if (
        controller &&
        wrongPasswordMessage &&
        String(value) === String(wrongPasswordMessage)
      ) {
        lockCurrentButton(elements.button, elements.message, controller.signal);
        return;
      }
      window.__lfHbeOriginalAlert(value);
    };
  }

  function isLocked(button) {
    return !button || button.disabled || button.dataset.locked === '1';
  }

  function hasCryptoSupport() {
    return window.isSecureContext && window.crypto && window.crypto.subtle;
  }

  function submit(main, button, message) {
    if (isLocked(button)) return;
    if (!hasCryptoSupport()) {
      window.alert('当前页面未启用安全加密环境，请使用 HTTPS 访问后再解锁。');
      return;
    }
    message.textContent = '';
    message.style.display = 'none';
    triggerUnlock(main);
  }

  function destroy() {
    if (controller) controller.abort();
    controller = null;
  }

  function init() {
    destroy();
    patchAlert();

    var main = document.getElementById('hexo-blog-encrypt');
    if (!main) return;
    var content = main.querySelector('.hbe-content');
    var input = main.querySelector('#hbePass') || document.getElementById('hbePass');
    if (!content || !input) return;

    controller = new AbortController();
    var signal = controller.signal;
    var previousAction = content.querySelector('.hbe-action-wrap');
    if (previousAction) previousAction.remove();

    var action = document.createElement('div');
    action.className = 'hbe-action-wrap';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'hbe-unlock-btn';
    button.textContent = '解锁文章';
    var message = document.createElement('div');
    message.className = 'hbe-unlock-message';
    message.style.display = 'none';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    action.appendChild(button);
    action.appendChild(message);
    content.appendChild(action);

    button.addEventListener('click', function () {
      submit(main, button, message);
    }, { signal: signal });

    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      submit(main, button, message);
    }, { capture: true, signal: signal });
  }

  document.addEventListener('pjax:send', destroy);
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
