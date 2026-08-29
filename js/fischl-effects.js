(function () {
  'use strict';

  var BOOT_KEY = '__lfFischlEffectsBooted';
  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  var MOBILE = window.matchMedia('(max-width: 768px)');
  var state = null;

  var PARTICLE_COLORS = [
    '184, 110, 255',
    '129, 58, 196',
    '199, 125, 255',
    '224, 176, 255'
  ];

  function pageMode() {
    if (REDUCED_MOTION.matches) return 'reduced';
    if (document.querySelector('.recent-posts')) return 'home';
    if (document.getElementById('post')) return 'article';
    return 'page';
  }

  function settingsFor(mode) {
    var mobile = MOBILE.matches;
    var settings = {
      particles: mode === 'home' ? 90 : mode === 'article' ? 28 : 45,
      feathers: mode === 'home' ? 10 : mode === 'article' ? 4 : 6,
      mouse: mode === 'home',
      arcs: mode === 'home',
      lightning: mode === 'home'
    };

    if (mobile) {
      settings.particles = Math.min(settings.particles, 20);
      settings.feathers = Math.min(settings.feathers, 3);
      settings.mouse = false;
      settings.arcs = false;
      settings.lightning = false;
    }

    return settings;
  }

  function createCanvas(id, parent) {
    var previous = document.getElementById(id);
    if (previous) previous.remove();

    var canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.setAttribute('aria-hidden', 'true');
    parent.appendChild(canvas);
    return canvas;
  }

  function resizeCanvas(canvas, width, height) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return context;
  }

  function createParticle(width, height) {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 10,
      vy: -3 - Math.random() * 9,
      alpha: 0.25 + Math.random() * 0.45,
      pulse: 0.6 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]
    };
  }

  function createFeather(width, height, initial) {
    var size = 15 + Math.random() * 13;
    return {
      originX: Math.random() * width,
      x: 0,
      y: initial ? Math.random() * height : -size * 2,
      size: size,
      speed: 14 + Math.random() * 18,
      drift: 18 + Math.random() * 34,
      driftSpeed: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.55,
      alpha: 0.34 + Math.random() * 0.32
    };
  }

  function resetFeather(feather, width) {
    var replacement = createFeather(width, 0, false);
    Object.keys(replacement).forEach(function (key) {
      feather[key] = replacement[key];
    });
  }

  function resize() {
    if (!state) return;
    var width = window.innerWidth;
    var height = window.innerHeight;

    state.particleContext = resizeCanvas(state.particleCanvas, width, height);
    state.featherContext = resizeCanvas(state.featherCanvas, width, height);

    if (state.lightningCanvas) {
      var header = document.getElementById('page-header');
      if (header) {
        state.lightningContext = resizeCanvas(
          state.lightningCanvas,
          header.clientWidth,
          header.clientHeight
        );
      }
    }

    state.width = width;
    state.height = height;
  }

  function drawParticles(now, delta) {
    var context = state.particleContext;
    var width = state.width;
    var height = state.height;
    var mouse = state.mouse;
    context.clearRect(0, 0, width, height);

    state.particles.forEach(function (particle) {
      if (state.settings.mouse && mouse.active) {
        var dx = particle.x - mouse.x;
        var dy = particle.y - mouse.y;
        var distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > 0 && distanceSquared < 6400) {
          var distance = Math.sqrt(distanceSquared);
          var force = (80 - distance) / 80;
          particle.x += (dx / distance) * force * 45 * delta;
          particle.y += (dy / distance) * force * 45 * delta;
        }
      }

      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      if (particle.y < -8) particle.y = height + 8;
      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;

      var alpha = particle.alpha * (0.72 + Math.sin(now * 0.001 * particle.pulse + particle.phase) * 0.28);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = 'rgba(' + particle.color + ', ' + Math.max(0.08, alpha) + ')';
      context.fill();
    });

    if (state.settings.arcs && now % 3000 < 220) {
      context.lineWidth = 0.7;
      for (var index = 0; index < state.particles.length - 1; index += 7) {
        var left = state.particles[index];
        var right = state.particles[index + 1];
        var dx = left.x - right.x;
        var dy = left.y - right.y;
        if (dx * dx + dy * dy > 12000) continue;
        context.beginPath();
        context.moveTo(left.x, left.y);
        context.lineTo(right.x, right.y);
        context.strokeStyle = 'rgba(184, 110, 255, 0.18)';
        context.stroke();
      }
    }
  }

  function drawFeatherShape(context, feather) {
    var length = feather.size;
    var width = length * 0.3;
    context.save();
    context.translate(feather.x, feather.y);
    context.rotate(feather.angle);
    context.globalAlpha = feather.alpha;
    context.fillStyle = 'rgba(32, 22, 42, 0.9)';
    context.strokeStyle = 'rgba(184, 110, 255, 0.45)';
    context.lineWidth = 0.7;
    context.beginPath();
    context.moveTo(0, -length / 2);
    context.bezierCurveTo(width, -length / 4, width, length / 4, 0, length / 2);
    context.bezierCurveTo(-width, length / 4, -width, -length / 4, 0, -length / 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(0, -length / 2);
    context.lineTo(0, length / 2 + 4);
    context.strokeStyle = 'rgba(214, 183, 240, 0.45)';
    context.stroke();
    context.restore();
  }

  function drawFeathers(now, delta) {
    var context = state.featherContext;
    context.clearRect(0, 0, state.width, state.height);

    state.feathers.forEach(function (feather) {
      feather.y += feather.speed * delta;
      feather.angle += feather.spin * delta;
      feather.x = feather.originX + Math.sin(now * 0.001 * feather.driftSpeed + feather.phase) * feather.drift;
      if (feather.y > state.height + feather.size * 2) resetFeather(feather, state.width);
      drawFeatherShape(context, feather);
    });
  }

  function buildBolt(width, height) {
    var points = [{ x: width * (0.2 + Math.random() * 0.6), y: -5 }];
    var segments = 9 + Math.floor(Math.random() * 5);
    for (var index = 1; index <= segments; index += 1) {
      points.push({
        x: points[0].x + (Math.random() - 0.5) * width * 0.22,
        y: (height / segments) * index
      });
    }
    return points;
  }

  function scheduleLightning() {
    if (!state || !state.settings.lightning || document.hidden) return;
    window.clearTimeout(state.lightningTimer);
    state.lightningTimer = window.setTimeout(function () {
      if (!state || !state.lightningCanvas) return;
      state.strike = {
        startedAt: performance.now(),
        points: buildBolt(state.lightningCanvas.clientWidth, state.lightningCanvas.clientHeight)
      };
      document.body.classList.add('fischl-lightning-glow');
      scheduleLightning();
    }, 4000 + Math.random() * 6000);
  }

  function drawLightning(now) {
    if (!state.lightningContext || !state.lightningCanvas) return;
    var context = state.lightningContext;
    var width = state.lightningCanvas.clientWidth;
    var height = state.lightningCanvas.clientHeight;
    context.clearRect(0, 0, width, height);

    if (!state.strike) return;
    var age = now - state.strike.startedAt;
    if (age > 520) {
      state.strike = null;
      document.body.classList.remove('fischl-lightning-glow');
      return;
    }

    var alpha = Math.max(0, 1 - age / 520) * (age < 100 ? 1 : 0.62);
    var points = state.strike.points;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.shadowBlur = 18;
    context.shadowColor = 'rgba(184, 110, 255, ' + alpha + ')';
    context.beginPath();
    points.forEach(function (point, index) {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = 'rgba(224, 176, 255, ' + alpha + ')';
    context.lineWidth = 2.2;
    context.stroke();
    context.restore();
  }

  function frame(now) {
    if (!state || state.paused) return;
    if (!state.lastFrame || now - state.lastFrame >= 33) {
      var delta = Math.min(0.08, Math.max(0.001, (now - (state.lastFrame || now)) / 1000));
      state.lastFrame = now;
      drawParticles(now, delta);
      drawFeathers(now, delta);
      drawLightning(now);
    }
    state.raf = window.requestAnimationFrame(frame);
  }

  function handleVisibility() {
    if (!state) return;
    if (document.hidden) {
      state.paused = true;
      window.cancelAnimationFrame(state.raf);
      window.clearTimeout(state.lightningTimer);
      return;
    }

    state.paused = false;
    state.lastFrame = 0;
    state.raf = window.requestAnimationFrame(frame);
    scheduleLightning();
  }

  function destroy() {
    if (!state) return;
    state.controller.abort();
    window.cancelAnimationFrame(state.raf);
    window.cancelAnimationFrame(state.resizeRaf);
    window.clearTimeout(state.lightningTimer);
    state.canvases.forEach(function (canvas) { canvas.remove(); });
    document.body.classList.remove('fischl-lightning-glow');
    state = null;
  }

  function init() {
    destroy();
    var mode = pageMode();
    if (mode === 'reduced') return;

    var controller = new AbortController();
    var settings = settingsFor(mode);
    var particleCanvas = createCanvas('fischl-particles-canvas', document.body);
    var featherCanvas = createCanvas('fischl-feathers-canvas', document.body);
    var lightningCanvas = null;
    var header = document.getElementById('page-header');
    if (settings.lightning && header) {
      lightningCanvas = createCanvas('fischl-lightning-canvas', header);
    }

    state = {
      mode: mode,
      settings: settings,
      controller: controller,
      canvases: [particleCanvas, featherCanvas].concat(lightningCanvas ? [lightningCanvas] : []),
      particleCanvas: particleCanvas,
      featherCanvas: featherCanvas,
      lightningCanvas: lightningCanvas,
      particles: [],
      feathers: [],
      mouse: { active: false, x: -999, y: -999 },
      raf: 0,
      resizeRaf: 0,
      lightningTimer: 0,
      strike: null,
      paused: document.hidden,
      lastFrame: 0,
      width: window.innerWidth,
      height: window.innerHeight
    };

    resize();
    for (var particleIndex = 0; particleIndex < settings.particles; particleIndex += 1) {
      state.particles.push(createParticle(state.width, state.height));
    }
    for (var featherIndex = 0; featherIndex < settings.feathers; featherIndex += 1) {
      state.feathers.push(createFeather(state.width, state.height, true));
    }

    window.addEventListener('resize', function () {
      window.cancelAnimationFrame(state && state.resizeRaf);
      if (!state) return;
      state.resizeRaf = window.requestAnimationFrame(resize);
    }, { signal: controller.signal });

    if (settings.mouse) {
      window.addEventListener('pointermove', function (event) {
        if (!state) return;
        state.mouse.active = true;
        state.mouse.x = event.clientX;
        state.mouse.y = event.clientY;
      }, { passive: true, signal: controller.signal });
      document.addEventListener('pointerleave', function () {
        if (state) state.mouse.active = false;
      }, { signal: controller.signal });
    }

    document.addEventListener('visibilitychange', handleVisibility, { signal: controller.signal });
    if (!state.paused) state.raf = window.requestAnimationFrame(frame);
    scheduleLightning();
  }

  window.__lfFischlEffectsDebug = {
    snapshot: function () {
      return state ? {
        mode: state.mode,
        particles: state.particles.length,
        feathers: state.feathers.length,
        running: !state.paused,
        canvases: state.canvases.filter(function (canvas) { return canvas.isConnected; }).length
      } : {
        mode: pageMode(),
        particles: 0,
        feathers: 0,
        running: false,
        canvases: 0
      };
    }
  };

  if (window[BOOT_KEY]) return;
  window[BOOT_KEY] = true;

  document.addEventListener('pjax:send', destroy);
  document.addEventListener('pjax:complete', init);
  REDUCED_MOTION.addEventListener('change', init);
  MOBILE.addEventListener('change', init);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
