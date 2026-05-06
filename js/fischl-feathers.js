/**
 * ============================================================
 *  Fischl Oz 鸦羽飘落 — Raven Feathers Falling
 * ============================================================
 *
 *  所有页面生效。canvas 挂载到 #body-wrap，覆盖整个页面内容区域。
 *  同屏 12 片黑色羽毛从顶部缓缓飘落，
 *  带水平正弦漂移和缓慢旋转，模拟 Oz 的夜鸦之羽。
 *
 *  羽毛用 Canvas 绘制：贝塞尔曲线杏仁形羽体 + 中轴线 + 两侧羽丝纹理，
 *  颜色为深灰黑色带微弱紫色高光边缘。
 * ============================================================
 */
(function () {
  'use strict';

  // ==================== 全局状态 ====================

  /** @type {HTMLCanvasElement|null} 羽毛飘落 canvas 元素 */
  var canvas = null;

  /** @type {CanvasRenderingContext2D|null} canvas 2D 绘图上下文 */
  var ctx = null;

  /** @type {number|null} requestAnimationFrame 返回的句柄 */
  var raf = null;

  /** @type {Array<Object>} 所有羽毛对象的数组 */
  var feathers = [];

  /** 同屏最大羽毛数量 */
  var MAX_FEATHERS = 12;

  // ==================== 羽毛创建 ====================

  /**
   * 创建一片羽毛对象。
   *
   * 每片羽毛包含：
   * - 位置（x, y）：随机水平位置，Y 根据 randomY 参数决定
   * - 尺寸（length, widthRatio）：长度 15-28px，宽度 = 长度 * 宽度比
   * - 下落速度（fallSpeed）：0.3-0.7 px/帧，缓慢飘落
   * - 水平漂移参数（driftAmp, driftSpeed, driftPhase）：正弦曲线左右飘荡
   * - 旋转参数（rotation, rotateSpeed）：缓慢自转
   * - 透明度（alpha）：0.4-0.7，半透明效果
   * - originX：记录正弦漂移的中心 X 坐标
   *
   * @param {number} w - canvas 宽度
   * @param {number} h - canvas 高度
   * @param {boolean} randomY - true: Y 随机（初始化时分散在各处）; false: Y=-30（从顶部开始）
   * @returns {Object} 羽毛对象
   */
  function createFeather(w, h, randomY) {
    var startX = Math.random() * w;
    return {
      // 位置
      x: startX,
      y: randomY ? Math.random() * h : -30,

      // ---- 尺寸 ----
      // 羽毛长度：15-28px
      length: 15 + Math.random() * 13,
      // 宽度比例：0.25-0.35（宽度 = length * widthRatio）
      widthRatio: 0.25 + Math.random() * 0.1,

      // ---- 下落 ----
      // 下落速度：0.3-0.7 px/帧（非常缓慢，模拟真实羽毛的空气阻力）
      fallSpeed: 0.3 + Math.random() * 0.4,

      // ---- 水平正弦漂移 ----
      // 羽毛不是直线下落，而是像真实羽毛一样左右飘荡
      // 漂移公式：x = originX + sin(frame * driftSpeed + driftPhase) * driftAmp
      driftAmp: 20 + Math.random() * 40,       // 漂移幅度：20-60px
      driftSpeed: 0.005 + Math.random() * 0.01, // 漂移速度：0.005-0.015 弧度/帧
      driftPhase: Math.random() * Math.PI * 2,   // 初始相位（随机，避免同步飘动）

      // ---- 旋转 ----
      // 羽毛在飘落过程中缓慢自转
      rotation: Math.random() * Math.PI * 2,          // 初始角度（随机）
      rotateSpeed: (Math.random() - 0.5) * 0.02,      // 旋转速度：±0.01 弧度/帧

      // ---- 透明度 ----
      alpha: 0.4 + Math.random() * 0.3,

      // ---- 漂移中心 X ----
      // originX 是正弦漂移的基准 X 坐标
      // 羽毛的实际 X = originX + sin(...) * driftAmp
      // 当羽毛飘出边界时，通过修改 originX 来实现循环
      originX: startX
    };
  }

  // ==================== 羽毛绘制 ====================

  /**
   * 绘制一片羽毛到 canvas。
   *
   * 羽毛结构（以 (0,0) 为中心，通过 translate/rotate 定位到实际位置）：
   *
   *         *  ← 尖端（moveTo 0, -halfLen）
   *        / \
   *       /   \  ← 贝塞尔曲线羽体两侧
   *      |     |
   *      |  |  |  ← 中轴线 + 两侧羽丝
   *       \   /
   *        \ /
   *         *  ← 底端（lineTo 0, halfLen）
   *
   * 绘制层次：
   * 1. 羽体轮廓：贝塞尔曲线绘制杏仁形，填充深灰黑色
   * 2. 中轴线：从尖端到底端的直线，稍亮的紫色
   * 3. 羽丝纹理：5 对从轴线向两侧伸出的细线
   * 4. 紫色高光：右侧边缘的微弱紫色描边
   *
   * @param {Object} f - 羽毛对象
   */
  function drawFeather(f) {
    ctx.save();

    // 将坐标系移动到羽毛中心位置，并旋转
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);

    // 计算羽毛的半尺寸
    var len = f.length;
    var wid = len * f.widthRatio;
    var halfLen = len / 2;
    var halfWid = wid / 2;

    // ---- 第一层：羽体轮廓（贝塞尔曲线杏仁形） ----
    ctx.beginPath();
    // 从尖端开始
    ctx.moveTo(0, -halfLen);
    // 右侧曲线：尖端 → 右上控制点 → 右中控制点 → 右下
    ctx.bezierCurveTo(
      halfWid * 0.6, -halfLen * 0.6,    // 控制点 1：右上方
      halfWid, -halfLen * 0.1,           // 控制点 2：右侧中部
      halfWid * 0.3, halfLen * 0.4       // 终点：右下
    );
    // 底端直线
    ctx.lineTo(0, halfLen);
    // 左侧曲线：左下 → 左中控制点 → 左上控制点 → 尖端
    ctx.lineTo(-halfWid * 0.3, halfLen * 0.4);
    ctx.bezierCurveTo(
      -halfWid, -halfLen * 0.1,          // 控制点 1：左侧中部
      -halfWid * 0.6, -halfLen * 0.6,    // 控制点 2：左上方
      0, -halfLen                        // 终点：回到尖端
    );
    ctx.closePath();
    // 填充深灰黑色（带透明度）
    ctx.fillStyle = 'rgba(25, 18, 35, ' + f.alpha + ')';
    ctx.fill();

    // ---- 第二层：中轴线 ----
    // 羽毛的中央脊线，用稍亮的紫色绘制
    ctx.beginPath();
    ctx.moveTo(0, -halfLen);
    ctx.lineTo(0, halfLen);
    ctx.strokeStyle = 'rgba(100, 70, 140, ' + (f.alpha * 0.6) + ')';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // ---- 第三层：两侧羽丝纹理 ----
    // 从轴线向两侧伸出 5 对细线，模拟羽毛的分支结构
    var strandCount = 5;
    ctx.strokeStyle = 'rgba(60, 40, 80, ' + (f.alpha * 0.3) + ')';
    ctx.lineWidth = 0.3;

    for (var i = 1; i <= strandCount; i++) {
      // t 从 0→1 均匀分布（跳过首尾，t = i/(strandCount+1)）
      var t = i / (strandCount + 1);
      // 羽丝在轴线上的 Y 坐标
      var yPos = -halfLen + t * len;
      // 羽丝长度：用 sin(t*π) 控制，中间最长、两端最短
      var strandLen = halfWid * 0.8 * Math.sin(t * Math.PI);

      // 右侧羽丝（略微向上倾斜）
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(strandLen, yPos - 2);
      ctx.stroke();

      // 左侧羽丝
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(-strandLen, yPos - 2);
      ctx.stroke();
    }

    // ---- 第四层：紫色高光边缘 ----
    // 羽毛右侧轮廓的微弱紫色反光，增加质感
    ctx.beginPath();
    ctx.moveTo(0, -halfLen);
    ctx.bezierCurveTo(
      halfWid * 0.6, -halfLen * 0.6,
      halfWid, -halfLen * 0.1,
      halfWid * 0.3, halfLen * 0.4
    );
    ctx.strokeStyle = 'rgba(160, 100, 220, ' + (f.alpha * 0.2) + ')';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // 恢复坐标系
    ctx.restore();
  }

  // ==================== 羽毛更新 ====================

  /**
   * 更新羽毛位置（每帧调用）。
   *
   * 更新内容：
   * 1. 垂直下落：y += fallSpeed
   * 2. 水平正弦漂移：x = originX + sin(帧数 * 速度 + 相位) * 幅度
   * 3. 缓慢旋转：rotation += rotateSpeed
   * 4. 边界循环：飘出底部后从顶部重新出现，飘出左右后修正 originX
   *
   * @param {Object} f - 羽毛对象
   * @param {number} w - canvas 宽度
   * @param {number} h - canvas 高度
   * @param {number} frame - 当前帧数（用于正弦漂移计算）
   */
  function updateFeather(f, w, h, frame) {
    // ---- 垂直下落 ----
    f.y += f.fallSpeed;

    // ---- 水平正弦漂移 ----
    // 羽毛的实际 X = originX + sin(帧数 * 速度 + 相位) * 幅度
    // originX 是漂移中心，sin 项让它左右飘荡
    f.x = f.originX + Math.sin(frame * f.driftSpeed + f.driftPhase) * f.driftAmp;

    // ---- 缓慢旋转 ----
    f.rotation += f.rotateSpeed;

    // ---- 边界循环：飘出底部 → 从顶部重生 ----
    if (f.y > h + 30) {
      f.y = -30;                            // Y 重置到顶部上方
      f.x = Math.random() * w;              // X 随机
      f.originX = f.x;                      // 重置漂移中心
    }

    // ---- 边界循环：飘出左右两侧 → 修正 originX ----
    // 如果羽毛的实际 X 飞出了 canvas 左右边界（加一些余量），
    // 通过增减 originX 让它回到可视区域内
    // 不直接修改 f.x，因为下一帧 sin() 会重新计算
    if (f.x < -40) f.originX += w + 80;     // 飞出左侧 → originX 右移
    if (f.x > w + 40) f.originX -= w + 80;  // 飞出右侧 → originX 左移
  }

  // ==================== 初始化与销毁 ====================

  /**
   * 初始化鸦羽飘落特效。
   *
   * 流程：
   * 1. 获取 #body-wrap 容器（所有页面都存在）
   * 2. 创建（或复用）canvas 元素，挂载到容器末尾
   * 3. 获取绘图上下文，调整 canvas 尺寸
   * 4. 创建 MAX_FEATHERS 片初始羽毛（randomY=true 分散在各处）
   * 5. 启动 requestAnimationFrame 动画循环
   */
  function init() {
    var main = document.getElementById('body-wrap');
    if (!main) return;

    // 如果 canvas 已存在（pjax 返回时），直接复用
    canvas = document.getElementById('fischl-feathers-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fischl-feathers-canvas';
      main.appendChild(canvas);
    }

    ctx = canvas.getContext('2d');
    resize();

    // 创建初始羽毛（randomY=true 让它们分散在整个页面各处，而非全部从顶部开始）
    feathers = [];
    for (var i = 0; i < MAX_FEATHERS; i++) {
      var f = createFeather(canvas.width, canvas.height, true);
      f.originX = f.x; // 记录初始 X 作为漂移中心
      feathers.push(f);
    }

    // 启动动画循环
    raf = requestAnimationFrame(loop);
  }

  /**
   * 销毁特效，释放所有资源。
   *
   * 流程：
   * 1. 取消 requestAnimationFrame 动画
   * 2. 从 DOM 移除 canvas
   * 3. 清空所有引用
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
    feathers = [];
  }

  /**
   * 调整 canvas 像素尺寸，与父容器 #body-wrap 的 offset 宽高一致。
   */
  function resize() {
    if (!canvas || !canvas.parentElement) return;
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }

  // ==================== 动画主循环 ====================

  /** @type {number} 帧计数器，用于正弦漂移计算和定期补充羽毛 */
  var frame = 0;

  /**
   * requestAnimationFrame 动画主循环。
   *
   * 每帧执行：
   * 1. 清空整个 canvas
   * 2. 每 120 帧（约 2 秒）检查羽毛数量，不足则补充
   * 3. 更新所有羽毛位置（下落 + 漂移 + 旋转 + 边界循环）
   * 4. 绘制所有羽毛
   * 5. 请求下一帧
   */
  function loop() {
    if (!canvas || !ctx) return;

    var w = canvas.width;
    var h = canvas.height;

    // 清空 canvas（清除上一帧的画面）
    ctx.clearRect(0, 0, w, h);

    frame++;

    // ---- 定期补充羽毛 ----
    // 理论上羽毛会自动循环（飘到底部重生到顶部），
    // 但为了防止极端情况下羽毛丢失，每 120 帧检查一次数量
    if (frame % 120 === 0 && feathers.length < MAX_FEATHERS) {
      var f = createFeather(w, h, false); // false = 从顶部开始
      f.originX = f.x;
      feathers.push(f);
    }

    // ---- 更新并绘制所有羽毛 ----
    for (var i = 0; i < feathers.length; i++) {
      updateFeather(feathers[i], w, h, frame);
      drawFeather(feathers[i]);
    }

    // 请求下一帧
    raf = requestAnimationFrame(loop);
  }

  // ==================== 生命周期 ====================

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

  // ---- pjax 支持 ----
  // Butterfly 主题的 pjax 在页面切换时不会刷新整个页面
  // 需要在 pjax:complete 事件中销毁旧实例并重新初始化
  document.addEventListener('pjax:complete', function () {
    destroy();
    init();
  });
})();
