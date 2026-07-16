(function () {
  'use strict';

  var PLAYER_ID = 'lf-butterfly-aplayer';
  var INSTANCE_KEY = '__lfButterflyAPlayer';
  var tracks = [
    {
      name: '不虚此行 On the Journey',
      artist: '魏晨, Nea, HOYO-MiX',
      url: encodeURI('/music/魏晨,Nea,HOYO-MiX - 不虚此行 On the Journey.mp3'),
      cover: '/img/music.png'
    },
    {
      name: '新页 New Page',
      artist: 'HOYO-MiX',
      url: encodeURI('/music/HOYO-MiX - 新页 New Page.mp3'),
      cover: '/img/music.png'
    },
    {
      name: '拂晓 Proi Proi',
      artist: 'HOYO-MiX, NIDA',
      url: encodeURI('/music/HOYO-MiX,NIDA - 拂晓 Proi Proi.mp3'),
      cover: '/img/music.png'
    }
  ];

  function initPlayer() {
    var container = document.getElementById(PLAYER_ID);
    if (!container || typeof window.APlayer !== 'function') return false;

    var existing = window[INSTANCE_KEY];
    if (existing && document.documentElement.contains(container)) return true;

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

  function boot() {
    if (initPlayer()) return;

    window.addEventListener('load', initPlayer, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  document.addEventListener('pjax:complete', initPlayer);
})();
