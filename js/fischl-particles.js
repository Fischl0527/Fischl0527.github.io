/**
 * ============================================================
 *  Fischl 暗夜粒子场 — Dark Night Particle Field
 * ============================================================
 *
 *  所有页面生效。canvas 挂载到 #body-wrap，覆盖整个页面内容区域。
 *
 *  功能：
 *  - 100 个深紫色粒子缓慢漂浮，带呼吸脉动效果
 *  - 每 3 秒在相邻粒子间（距离 < 150px）绘制紫色电弧
 *  - 鼠标悬停时粒子被推开（斥力半径 80px）
 *
 *  贴合菲谢尔的雷元素力场意象。
 * ============================================================
 */
(function () {
  'use strict';

  // ==================== 全局状态 ====================

  /** @type {HTMLCanvasElement|null} 粒子场 canvas 元素 */
  var canvas = null;

  /** @type {CanvasRenderingContext2D|null} canvas 2D 绘图上下文 */
  var ctx = null;

  /** @type {number|null} requestAnimationFrame 返回的句柄，用于取消动画 */
  var raf = null;

  /** @type {Array<Object>} 所有粒子对象的数组 */
  var particles = [];

  /** @type {number} 鼠标在 canvas 内的 X 坐标，初始 -999 表示无效 */
  var mouseX = -999;

  /** @type {number} 鼠标在 canvas 内的 Y 坐标，初始 -999 表示无效 */
  var mouseY = -999;

  /** @type {boolean} 鼠标当前是否在 #body-wrap 区域内 */
  var mouseInside = false;

  /**
   * 粒子颜色调色盘（紫色系）。
   * 每个颜色字符串末尾不带 ')'，透明度在绘制时动态拼接：
   * color + alpha + ')' → 'rgba(184, 110, 255, 0.5)'
   */
  var COLORS = [
    'rgba(184, 110, 255,',   // 主紫（博客主题色）
    'rgba(155, 89, 182,',    // 深紫
    'rgba(199, 125, 255,',   // 亮紫
    'rgba(224, 176, 255,'    // 淡紫
  ];

  // ==================== 粒子创建 ====================

  /**
   * 创建一个粒子对象。
   *
   * 每个粒子包含：
   * - 位置（x, y）：随机分布在 canvas 内
   * - 半径（r）：1-3px，控制粒子大小
   * - 速度（vx, vy）：缓慢漂移，vy 偏向上方（模拟上升的雷元素微粒）
   * - 颜色（color）：从紫色调色盘随机选取
   * - 透明度参数（baseAlpha, pulseSpeed, pulsePhase）：控制呼吸脉动
   *
   * @param {number} w - canvas 宽度（用于随机位置）
   * @param {number} h - canvas 高度（用于随机位置）
   * @returns {Object} 粒子对象
   */
  function createParticle(w, h) {
    return {
      // 随机初始位置
      x: Math.random() * w,
      y: Math.random() * h,
      // 粒子半径：1-3px
      r: 1 + Math.random() * 2,
      // 水平速度：-0.15 ~ +0.15（缓慢左右漂移）
      vx: (Math.random() - 0.5) * 0.3,
      // 垂直速度：-0.25 ~ +0.05，偏向上方（负值 = 向上）
      vy: (Math.random() - 0.5) * 0.3 - 0.1,
      // 颜色（从调色盘随机选取，末尾无 ')'）
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      // 基础透明度：0.2-0.7
      baseAlpha: 0.2 + Math.random() * 0.5,
      // 呼吸脉动速度（弧度/帧）：0.01-0.03
      pulseSpeed: 0.01 + Math.random() * 0.02,
      // 呼吸脉动初始相位（随机，避免所有粒子同步闪烁）
      pulsePhase: Math.random() * Math.PI * 2
    };
  }

  // ==================== 粒子更新与绘制 ====================

  /**
   * 更新单个粒子的状态（每帧调用）。
   *
   * 更新内容：
   * 1. 鼠标斥力：如果鼠标在区域内且距离粒子 < 80px，给粒子施加远离鼠标的力
   * 2. 速度衰减：乘以 0.98 阻尼系数，防止斥力后粒子持续高速飞行
   * 3. 位移：根据速度移动粒子
   * 4. 呼吸脉动：alpha 按正弦波在 baseAlpha 附近上下波动
   * 5. 边界循环：超出 canvas 边界后从对面出现
   *
   * @param {Object} p - 粒子对象
   * @param {number} w - canvas 宽度
   * @param {number} h - canvas 高度
   * @param {number} time - 当前时间戳（performance.now 的值，用于脉动计算）
   */
  function updateParticle(p, w, h, time) {
    // ---- 鼠标斥力 ----
    // 当鼠标在 #body-wrap 区域内时，对附近的粒子施加排斥力
    if (mouseInside) {
      var dx = p.x - mouseX;  // 粒子到鼠标的水平距离
      var dy = p.y - mouseY;  // 粒子到鼠标的垂直距离
      var dist = Math.sqrt(dx * dx + dy * dy);  // 欧氏距离
      var repulseRadius = 80;  // 斥力作用半径（px）

      if (dist < repulseRadius && dist > 0) {
        // 斥力强度：越近越强，线性衰减
        // force 范围：0（在边缘）→ 0.8（在鼠标位置）
        var force = (repulseRadius - dist) / repulseRadius * 0.8;
        // 将力分解到 x/y 方向，加到粒子速度上
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
    }

    // ---- 速度衰减（阻尼） ----
    // 每帧衰减 2%，防止斥力后粒子持续高速飞行
    p.vx *= 0.98;
    p.vy *= 0.98;

    // ---- 位移 ----
    p.x += p.vx;
    p.y += p.vy;

    // ---- 呼吸脉动 ----
    // alpha = baseAlpha + sin(时间 * 速度 + 相位) * 振幅
    // 振幅 = baseAlpha * 0.4，所以 alpha 在 baseAlpha 的 60%-140% 之间波动
    p.alpha = p.baseAlpha + Math.sin(time * p.pulseSpeed + p.pulsePhase) * p.baseAlpha * 0.4;
    // 限制在 [0.05, 0.8] 范围内，避免完全透明或完全不透明
    p.alpha = Math.max(0.05, Math.min(0.8, p.alpha));

    // ---- 边界循环 ----
    // 超出 canvas 边界后从对面出现（类似吃豆人的环绕效果）
    if (p.x < -10) p.x = w + 10;   // 飞出左边界 → 从右边界进入
    if (p.x > w + 10) p.x = -10;   // 飞出右边界 → 从左边界进入
    if (p.y < -10) p.y = h + 10;   // 飞出上边界 → 从下边界进入
    if (p.y > h + 10) p.y = -10;   // 飞出下边界 → 从上边界进入
  }

  /**
   * 绘制单个粒子到 canvas（每帧调用）。
   *
   * 绘制两层：
   * 1. 核心：半径为 p.r 的实心圆，颜色带当前脉动透明度
   * 2. 光晕：半径为 p.r*3 的大圆，透明度为核心 的 15%（仅粒子足够大时绘制）
   *
   * @param {Object} p - 粒子对象
   */
  function drawParticle(p) {
    // ---- 核心 ----
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    // 拼接颜色字符串：'rgba(184, 110, 255,' + '0.5' + ')' = 'rgba(184, 110, 255, 0.5)'
    ctx.fillStyle = p.color + p.alpha + ')';
    ctx.fill();

    // ---- 光晕（仅半径 > 1.5px 的粒子） ----
    if (p.r > 1.5) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      // 光晕透明度 = 核心的 15%
      ctx.fillStyle = p.color + (p.alpha * 0.15) + ')';
      ctx.fill();
    }
  }

  // ==================== 电弧效果 ====================

  /**
   * 在两个粒子之间绘制一条紫色电弧线。
   *
   * 使用 Canvas 的 shadowBlur 实现发光效果：
   * - 线条颜色：紫色
   * - 发光颜色：同色但透明度更低
   * - 线宽：0.5px（细线，模拟微弱放电）
   *
   * @param {Object} p1 - 起始粒子
   * @param {Object} p2 - 终止粒子
   * @param {number} alpha - 电弧透明度（与粒子间距离成反比）
   */
  function drawArc(p1, p2, alpha) {
    ctx.save();
    // 线条颜色
    ctx.strokeStyle = 'rgba(184, 110, 255, ' + alpha + ')';
    ctx.lineWidth = 0.5;
    // 发光效果
    ctx.shadowColor = 'rgba(184, 110, 255, ' + (alpha * 0.6) + ')';
    ctx.shadowBlur = 6;
    // 绘制直线
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  // ==================== 初始化与销毁 ====================

  /**
   * 初始化粒子场。
   *
   * 流程：
   * 1. 获取 #body-wrap 容器（所有页面都存在）
   * 2. 创建（或复用）canvas 元素，挂载到容器末尾
   * 3. 获取绘图上下文，调整 canvas 尺寸
   * 4. 创建 100 个粒子
   * 5. 启动 requestAnimationFrame 动画循环
   */
  function init() {
    var wrap = document.getElementById('body-wrap');
    if (!wrap) return;

    // 如果 canvas 已存在（pjax 返回时），直接复用
    canvas = document.getElementById('fischl-particles-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fischl-particles-canvas';
      wrap.appendChild(canvas);
    }

    ctx = canvas.getContext('2d');
    resize();

    // 创建 100 个粒子
    particles = [];
    for (var i = 0; i < 100; i++) {
      particles.push(createParticle(canvas.width, canvas.height));
    }

    // 启动动画循环
    raf = requestAnimationFrame(loop);
  }

  /**
   * 销毁粒子场，释放所有资源。
   *
   * 流程：
   * 1. 取消 requestAnimationFrame 动画
   * 2. 从 DOM 移除 canvas
   * 3. 清空所有引用
   * 4. 重置鼠标状态
   */
  function destroy() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
    particles = [];
    mouseX = -999;
    mouseY = -999;
    mouseInside = false;
  }

  /**
   * 调整 canvas 像素尺寸，与父容器 #body-wrap 的 offset 宽高一致。
   *
   * canvas 的 width/height 属性控制实际像素数，
   * CSS 的 width/height 控制显示尺寸（已在 CSS 中设为 100%），
   * 两者必须匹配才能正确渲染。
   */
  function resize() {
    if (!canvas || !canvas.parentElement) return;
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }

  // ==================== 动画主循环 ====================

  /** @type {number} 帧计数器，用于控制电弧触发频率 */
  var frameCount = 0;

  /**
   * requestAnimationFrame 动画主循环。
   *
   * 每帧执行：
   * 1. 清空整个 canvas
   * 2. 更新所有粒子位置（含鼠标斥力、脉动、边界循环）
   * 3. 绘制所有粒子（核心 + 光晕）
   * 4. 每 180 帧（约 3 秒 @ 60fps）检测相邻粒子对并绘制电弧
   * 5. 请求下一帧
   *
   * @param {number} time - requestAnimationFrame 提供的时间戳（ms）
   */
  function loop(time) {
    if (!canvas || !ctx) return;

    var w = canvas.width;
    var h = canvas.height;

    // 清空 canvas（清除上一帧的画面）
    ctx.clearRect(0, 0, w, h);

    // ---- 更新并绘制所有粒子 ----
    for (var i = 0; i < particles.length; i++) {
      updateParticle(particles[i], w, h, time);
      drawParticle(particles[i]);
    }

    // ---- 电弧效果 ----
    // 每 180 帧（约 3 秒）触发一次粒子间电弧检测
    frameCount++;
    if (frameCount % 180 === 0) {
      var arcDist = 150; // 电弧最大连接距离（px）
      // 双重循环检测所有粒子对
      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var dx = particles[a].x - particles[b].x;
          var dy = particles[a].y - particles[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < arcDist) {
            // 透明度与距离成反比：距离越近电弧越亮
            var arcAlpha = (1 - dist / arcDist) * 0.5;
            drawArc(particles[a], particles[b], arcAlpha);
          }
        }
      }
    }

    // 请求下一帧
    raf = requestAnimationFrame(loop);
  }

  // ==================== 事件监听 ====================

  /**
   * 鼠标移动事件处理。
   * 将鼠标坐标转换为 canvas 内部坐标（减去 canvas 的页面偏移）。
   *
   * @param {MouseEvent} e - 鼠标事件对象
   */
  function onMouseMove(e) {
    if (!canvas) return;
    // getBoundingClientRect() 返回 canvas 相对于视口的位置
    var rect = canvas.getBoundingClientRect();
    // clientX/Y 是鼠标相对于视口的坐标，减去 canvas 偏移得到 canvas 内坐标
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    mouseInside = true;
  }

  /**
   * 鼠标离开事件处理。
   * 重置鼠标状态，使斥力失效。
   */
  function onMouseLeave() {
    mouseInside = false;
    mouseX = -999;
    mouseY = -999;
  }

  // ---- 页面加载 ----
  // 如果 DOM 还在解析中，等待 DOMContentLoaded 再初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---- 窗口大小变化 ----
  // 窗口 resize 时重新调整 canvas 尺寸
  window.addEventListener('resize', function () {
    if (canvas) resize();
  });

  // ---- 鼠标事件（全局委托） ----
  // 在 document 上监听 mousemove，检查事件目标是否在 #body-wrap 内
  // 这样即使 canvas 有 pointer-events: none，也能正确获取鼠标位置
  document.addEventListener('mousemove', function (e) {
    var wrap = document.getElementById('body-wrap');
    if (wrap && wrap.contains(e.target)) {
      // 鼠标在 #body-wrap 内 → 更新位置
      onMouseMove(e);
    } else {
      // 鼠标在 #body-wrap 外 → 标记为离开
      onMouseLeave();
    }
  });

  // ---- pjax 支持 ----
  // Butterfly 主题的 pjax 在页面切换时不会刷新整个页面
  // 需要在 pjax:complete 事件中销毁旧实例并重新初始化
  document.addEventListener('pjax:complete', function () {
    destroy();
    init();
  });
})();
