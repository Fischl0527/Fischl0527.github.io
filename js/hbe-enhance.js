(function () {
  const LOCK_MS = 3000;

  function hexToArray(s) {
    return new Uint8Array(s.match(/[\da-f]{2}/gi).map(function (h) {
      return parseInt(h, 16);
    }));
  }

  function arrayBufferToHex(arrayBuffer) {
    if (typeof arrayBuffer !== 'object' || arrayBuffer === null || typeof arrayBuffer.byteLength !== 'number') {
      throw new TypeError('Expected input to be an ArrayBuffer');
    }

    var view = new Uint8Array(arrayBuffer);
    var result = '';
    var value;

    for (var i = 0; i < view.length; i++) {
      value = view[i].toString(16);
      result += (value.length === 1 ? '0' + value : value);
    }

    return result;
  }

  function textToArray(s) {
    var i = s.length;
    var n = 0;
    var ba = [];

    for (var j = 0; j < i;) {
      var c = s.codePointAt(j);
      if (c < 128) {
        ba[n++] = c;
        j++;
      } else if (c < 2048) {
        ba[n++] = (c >> 6) | 192;
        ba[n++] = (c & 63) | 128;
        j++;
      } else if (c < 65536) {
        ba[n++] = (c >> 12) | 224;
        ba[n++] = ((c >> 6) & 63) | 128;
        ba[n++] = (c & 63) | 128;
        j++;
      } else {
        ba[n++] = (c >> 18) | 240;
        ba[n++] = ((c >> 12) & 63) | 128;
        ba[n++] = ((c >> 6) & 63) | 128;
        ba[n++] = (c & 63) | 128;
        j += 2;
      }
    }

    return new Uint8Array(ba);
  }

  async function getExecutableScript(oldElem) {
    var out = document.createElement('script');
    var attList = ['type', 'text', 'src', 'crossorigin', 'defer', 'referrerpolicy'];

    attList.forEach(function (att) {
      if (oldElem[att]) out[att] = oldElem[att];
    });

    return out;
  }

  async function convertHTMLToElement(content) {
    var out = document.createElement('div');
    out.innerHTML = content;

    var scripts = out.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      scripts[i].replaceWith(await getExecutableScript(scripts[i]));
    }

    return out;
  }

  function lockButton(button, messageEl) {
    if (!button || button.dataset.locked === '1') return;

    button.dataset.locked = '1';
    button.disabled = true;

    var left = Math.ceil(LOCK_MS / 1000);
    var originText = button.dataset.originText || '解锁文章';
    button.dataset.originText = originText;

    function updateLockText() {
      button.textContent = '密码错误（' + left + 's）';
      if (messageEl) {
        messageEl.textContent = '密码错误，请 ' + left + ' 秒后重试';
        messageEl.style.display = 'inline-block';
      }
    }

    updateLockText();

    var timer = setInterval(function () {
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

    var rawAlert = window.alert;
    window.alert = function (msg) {
      if (msg === wrongPassMessage) {
        lockButton(button, messageEl);
      }
      return rawAlert.apply(this, arguments);
    };
  }

  async function unlockPost(mainElement) {
    var cryptoObj = window.crypto || window.msCrypto;
    var storage = window.localStorage;
    var input = document.getElementById('hbePass');
    var dataElement = document.getElementById('hbeData');

    if (!cryptoObj || !cryptoObj.subtle || !input || !dataElement) return false;

    var password = input.value;
    var encryptedData = dataElement.innerText;
    var hmacDigest = dataElement.dataset.hmacdigest;
    var wrongPassMessage = mainElement.dataset.wpm || '密码错误';
    var wrongHashMessage = mainElement.dataset.whm || '校验失败';
    var storageName = 'hexo-blog-encrypt:#' + window.location.pathname;
    var keySalt = textToArray('hexo-blog-encrypt的作者们都是大帅比!');
    var ivSalt = textToArray('hexo-blog-encrypt是地表最强Hexo加密插件!');
    var knownPrefix = '<hbe-prefix></hbe-prefix>';

    function getKeyMaterial(pass) {
      var encoder = new TextEncoder();
      return cryptoObj.subtle.importKey(
        'raw',
        encoder.encode(pass),
        { name: 'PBKDF2' },
        false,
        ['deriveKey', 'deriveBits']
      );
    }

    function getHmacKey(keyMaterial) {
      return cryptoObj.subtle.deriveKey({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: keySalt.buffer,
        iterations: 1024
      }, keyMaterial, {
        name: 'HMAC',
        hash: 'SHA-256',
        length: 256
      }, true, ['verify']);
    }

    function getDecryptKey(keyMaterial) {
      return cryptoObj.subtle.deriveKey({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: keySalt.buffer,
        iterations: 1024
      }, keyMaterial, {
        name: 'AES-CBC',
        length: 256
      }, true, ['decrypt']);
    }

    function getIv(keyMaterial) {
      return cryptoObj.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: ivSalt.buffer,
        iterations: 512
      }, keyMaterial, 16 * 8);
    }

    async function verifyContent(key, content) {
      var encoder = new TextEncoder();
      var encoded = encoder.encode(content);
      var signature = hexToArray(hmacDigest);

      var result = await cryptoObj.subtle.verify({
        name: 'HMAC',
        hash: 'SHA-256'
      }, key, signature, encoded);

      if (!result) {
        alert(wrongHashMessage);
      }

      return result;
    }

    try {
      var keyMaterial = await getKeyMaterial(password);
      var hmacKey = await getHmacKey(keyMaterial);
      var decryptKey = await getDecryptKey(keyMaterial);
      var iv = await getIv(keyMaterial);
      var typedArray = hexToArray(encryptedData);

      var decrypted = await cryptoObj.subtle.decrypt({
        name: 'AES-CBC',
        iv: iv
      }, decryptKey, typedArray.buffer);

      var decoder = new TextDecoder();
      var decoded = decoder.decode(decrypted);

      if (!decoded.startsWith(knownPrefix)) {
        throw new Error('Wrong password');
      }

      var ok = await verifyContent(hmacKey, decoded);
      if (!ok) return false;

      var hideButton = document.createElement('button');
      hideButton.textContent = 'Encrypt again';
      hideButton.type = 'button';
      hideButton.classList.add('hbe-button');
      hideButton.style.textIndent = '15px';

      hideButton.addEventListener('click', function () {
        window.localStorage.removeItem(storageName);
        window.location.reload();
      });

      mainElement.style.display = 'inline';
      mainElement.innerHTML = '';
      mainElement.appendChild(await convertHTMLToElement(decoded));
      mainElement.appendChild(hideButton);

      document.querySelectorAll('img').forEach(function (elem) {
        if (elem.getAttribute('data-src') && !elem.src) {
          elem.src = elem.getAttribute('data-src');
        }
      });

      window.NexT && NexT.boot && typeof NexT.boot.refresh === 'function' && NexT.boot.refresh();

      var tocDiv = document.getElementById('toc-div');
      if (tocDiv) tocDiv.style.display = 'inline';

      var tocDivs = document.getElementsByClassName('toc-div-class');
      if (tocDivs && tocDivs.length > 0) {
        for (var idx = 0; idx < tocDivs.length; idx++) {
          tocDivs[idx].style.display = 'inline';
        }
      }

      var event = new Event('hexo-blog-decrypt');
      window.dispatchEvent(event);

      var dk = await cryptoObj.subtle.exportKey('jwk', decryptKey);
      var hmk = await cryptoObj.subtle.exportKey('jwk', hmacKey);

      storage.setItem(storageName, JSON.stringify({
        dk: dk,
        iv: arrayBufferToHex(iv),
        hmk: hmk
      }));

      return true;
    } catch (e) {
      alert(wrongPassMessage);
      return false;
    }
  }

  function initHbeEnhance() {
    var mainElement = document.getElementById('hexo-blog-encrypt');
    if (!mainElement) return;
    if (mainElement.dataset.hbeEnhanced === '1') return;

    var input = document.getElementById('hbePass');
    var content = mainElement.querySelector('.hbe-content');
    if (!input || !content) return;

    var wrongPassMessage = mainElement.dataset.wpm || '密码错误';

    var oldAction = content.querySelector('.hbe-action-wrap');
    if (oldAction) oldAction.remove();

    var actionWrap = document.createElement('div');
    actionWrap.className = 'hbe-action-wrap';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'hbe-unlock-btn';
    button.textContent = '解锁文章';

    var messageEl = document.createElement('div');
    messageEl.className = 'hbe-unlock-message';
    messageEl.style.display = 'none';

    actionWrap.appendChild(button);
    actionWrap.appendChild(messageEl);
    content.appendChild(actionWrap);

    patchAlert(button, messageEl, wrongPassMessage);

    button.addEventListener('click', async function () {
      if (button.disabled) return;
      messageEl.textContent = '';
      messageEl.style.display = 'none';
      await unlockPost(mainElement);
    });

    input.addEventListener('keydown', async function (event) {
      if (event.key !== 'Enter') return;

      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) return;
      messageEl.textContent = '';
      messageEl.style.display = 'none';
      await unlockPost(mainElement);
    });

    mainElement.dataset.hbeEnhanced = '1';
  }

  document.addEventListener('DOMContentLoaded', initHbeEnhance);
  window.addEventListener('load', initHbeEnhance);
  window.addEventListener('pjax:complete', initHbeEnhance);
})();
