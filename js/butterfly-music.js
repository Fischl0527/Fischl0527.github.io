(function () {
  'use strict';

  var PLAYER_ID = 'lf-butterfly-aplayer';
  var INSTANCE_KEY = '__lfButterflyAPlayer';
  var MANIFEST_KEY = '__lfButterflyMusicManifest';
  var BOOT_KEY = '__lfButterflyMusicBooted';

  function getContainer() {
    return document.getElementById(PLAYER_ID);
  }

  function markUnavailable(message) {
    var container = getContainer();
    if (!container) return;

    container.classList.add('lf-music-unavailable');
    container.setAttribute('aria-hidden', 'true');
    container.title = message;
  }

  function loadManifest() {
    if (!window[MANIFEST_KEY]) {
      window[MANIFEST_KEY] = fetch('/music/playlist.json', { cache: 'no-cache' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (manifest) {
          if (!manifest || !Array.isArray(manifest.tracks)) {
            throw new Error('invalid playlist format');
          }
          return manifest.tracks;
        })
        .catch(function (error) {
          window[MANIFEST_KEY] = null;
          throw error;
        });
    }

    return window[MANIFEST_KEY];
  }

  function createPlayer(tracks) {
    var container = getContainer();
    if (!container || typeof window.APlayer !== 'function') return false;
    if (window[INSTANCE_KEY]) return true;

    if (!tracks.length) {
      markUnavailable('本地音乐列表为空');
      return false;
    }

    container.classList.remove('lf-music-unavailable');
    container.removeAttribute('aria-hidden');

    window[INSTANCE_KEY] = new window.APlayer({
      container: container,
      fixed: true,
      mini: true,
      autoplay: false,
      theme: '#b86eff',
      loop: 'all',
      order: 'list',
      preload: 'metadata',
      volume: 0.6,
      mutex: true,
      listFolded: true,
      lrcType: 0,
      audio: tracks
    });

    return true;
  }

  function ensurePlayer() {
    if (window[INSTANCE_KEY]) return Promise.resolve(true);

    return loadManifest()
      .then(createPlayer)
      .catch(function (error) {
        markUnavailable('音乐播放器暂时不可用');
        console.warn('[LFischl music] ' + error.message);
        return false;
      });
  }

  function boot() {
    ensurePlayer();

    if (window[BOOT_KEY]) return;
    window[BOOT_KEY] = true;
    document.addEventListener('pjax:complete', ensurePlayer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
