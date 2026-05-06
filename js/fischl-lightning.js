/**
 * ============================================================
 *  Fischl Dark Night Lightning — 暗夜雷闪特效
 * ============================================================
 *
 *  仅在博客首页（#body-wrap.home）生效。
 *  在 banner 区域（#page-header）叠加一层 Canvas，
 *  随机间隔（4-10 秒）生成紫色闪电，带分支和页面边缘光晕。
 *  支持 pjax 单页导航，离开首页自动销毁，返回首页自动恢复。
 *
 *  贴合《原神》菲谢尔（断罪皇女）的暗夜 / 雷元素主题。
 * ============================================================
 */
(function () {
  'use strict';

  // ==================== 全局状态 ====================

  /** @type {HTMLCanvasElement|null} 闪电画布元素 */
  var canvas = null;

  /** @type {CanvasRenderingContext2D|null} 画布 2D 绘图上下文 */
  var ctx = null;

  /** @type {number|null} setTimeout 返回的定时器 ID，用于随机间隔调度 */
  var timer = null;

  /** 闪电颜色调色盘 —— 紫色系，契合菲谢尔的雷元素配色 */
  var COLORS = [
    '#b86eff',  // 主紫色（博客主题色）
    '#9b59b6',  // 深紫色
    '#c77dff',  // 亮紫色
    '#e0b0ff'   // 淡紫色（高光）
  ];

  // ==================== 页面判断 ====================

  /**
   * 判断当前页面是否为博客首页。
   *
   * Butterfly 主题在首页渲染时，会给 #body-wrap 元素添加 'home' class。
   * 其他页面（文章页、分类页、标签页等）不会有这个 class。
   *
   * @returns {boolean} 是首页返回 true，否则 false
   */
  function isHome() {
    // Butterfly 主题在首页的 #body-wrap class 是 "page" 而非 "home"
    // 首页有 .recent-posts（文章列表），文章页没有，以此区分
    return !!document.querySelector('.recent-posts');
  }

  // ==================== 初始化与销毁 ====================

  /**
   * 初始化闪电特效。
   *
   * 流程：
   * 1. 检查是否为首页，非首页直接跳过（文章页不显示闪电）
   * 2. 获取 banner 容器 #page-header
   * 3. 创建（或复用）canvas 元素，插入 banner 容器末尾
   * 4. 获取绘图上下文，调整 canvas 尺寸匹配容器
   * 5. 启动随机间隔调度
   */
  function init() {
    // 非首页不初始化，避免与文章内的角色图片冲突
    if (!isHome()) return;

    // 获取 banner 区域容器
    var header = document.getElementById('page-header');
    if (!header) return;

    // 如果 canvas 已存在（pjax 返回首页时），直接复用
    canvas = document.getElementById('fischl-lightning-canvas');
    if (!canvas) {
      // 创建新的 canvas 元素
      canvas = document.createElement('canvas');
      canvas.id = 'fischl-lightning-canvas';
      // 插入 banner 容器末尾（CSS 中已设置 position: absolute 覆盖整个 banner）
      header.appendChild(canvas);
    }

    // 获取 2D 绑图上下文，所有绑制操作都通过 ctx 完成
    ctx = canvas.getContext('2d');

    // 将 canvas 尺寸调整为与 banner 容器一致
    resize();

    // 启动随机间隔调度，开始周期性生成闪电
    schedule();
  }

  /**
   * 销毁闪电特效，释放所有资源。
   *
   * 流程：
   * 1. 清除调度定时器，停止后续闪电生成
   * 2. 从 DOM 中移除 canvas 元素
   * 3. 清空引用，便于垃圾回收
   * 4. 移除页面边缘光晕 class
   *
   * 用于 pjax 导航离开首页时调用。
   */
  function destroy() {
    // 清除定时器，停止闪电调度
    clearTimeout(timer);

    // 从 DOM 中移除 canvas 元素
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    // 清空引用
    canvas = null;
    ctx = null;

    // 移除页面边缘光晕效果（防止残留）
    document.body.classList.remove('fischl-lightning-glow');
  }

  // ==================== Canvas 尺寸适配 ====================

  /**
   * 将 canvas 的像素尺寸调整为与父容器（banner 区域）一致。
   *
   * canvas 的 width/height 属性控制的是实际像素数，
   * 而 CSS 的 width/height 控制的是显示尺寸。
   * 两者必须匹配，否则会出现拉伸或模糊。
   *
   * 在窗口 resize 时自动调用。
   */
  function resize() {
    if (!canvas || !canvas.parentElement) return;
    // 将 canvas 像素尺寸设为父容器的 offset 宽高
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }

  // ==================== 闪电路径生成（递归分形算法） ====================

  /**
   * 生成一条从起点到终点的锯齿形闪电路径。
   *
   * 使用递归中点偏移算法（类似分形 / 地形生成）：
   * 1. 取起点和终点的中点
   * 2. 将中点沿垂直于连线方向随机偏移
   * 3. 对左右两半递归执行同样操作
   * 4. 递归深度越深，偏移量越小（乘以 0.55 衰减系数）
   *
   * 最终生成一条自然弯曲的锯齿形折线。
   *
   * @param {number} x1 - 起点 X 坐标
   * @param {number} y1 - 起点 Y 坐标（通常是 0，即 banner 顶部）
   * @param {number} x2 - 终点 X 坐标
   * @param {number} y2 - 终点 Y 坐标（通常是 banner 底部附近）
   * @param {number} displace - 初始偏移量（像素），控制闪电的弯曲幅度
   * @param {number} depth - 递归深度，控制锯齿的精细程度（越大越精细）
   * @returns {Array<{x: number, y: number}>} 闪电路径上的所有点坐标
   */
  function generateBolt(x1, y1, x2, y2, displace, depth) {
    // 初始化点数组，以起点开头
    var points = [{x: x1, y: y1}];

    // 递归生成中间节点
    buildBolt(x1, y1, x2, y2, displace, depth, points);

    // 添加终点
    points.push({x: x2, y: y2});

    return points;
  }

  /**
   * 递归构建闪电路径的中间节点。
   *
   * 每一层递归：
   * 1. 计算当前线段的中点
   * 2. 给中点加上随机偏移（X 方向偏移大，Y 方向偏移小，模拟闪电主要向下传播）
   * 3. 偏移量衰减为原来的 55%（displace *= 0.55）
   * 4. 对中点左右两段分别递归
   *
   * @param {number} x1 - 当前段起点 X
   * @param {number} y1 - 当前段起点 Y
   * @param {number} x2 - 当前段终点 X
   * @param {number} y2 - 当前段终点 Y
   * @param {number} displace - 当前偏移量
   * @param {number} depth - 剩余递归深度
   * @param {Array} points - 累积的路径点数组（直接修改）
   */
  function buildBolt(x1, y1, x2, y2, displace, depth, points) {
    // 递归终止：深度为 0 时不再细分
    if (depth <= 0) return;

    // 计算中点，加上随机偏移
    // X 方向偏移范围 = [-displace/2, +displace/2]
    // Y 方向偏移范围更小（乘以 0.3），因为闪电主要是垂直传播
    var mx = (x1 + x2) / 2 + (Math.random() - 0.5) * displace;
    var my = (y1 + y2) / 2 + (Math.random() - 0.5) * displace * 0.3;

    // 将中点插入路径
    points.push({x: mx, y: my});

    // 偏移量衰减 55%，下一层锯齿更细微
    displace *= 0.55;

    // 递归处理左半段和右半段
    buildBolt(x1, y1, mx, my, displace, depth - 1, points);
    buildBolt(mx, my, x2, y2, displace, depth - 1, points);
  }

  // ==================== 闪电绘制 ====================

  /**
   * 将一条闪电路径绘制到 canvas 上，带发光效果。
   *
   * 绘制两层：
   * 1. 外层：带 shadowBlur 发光的粗线（模拟闪电周围的光晕）
   * 2. 内层：无发光的细亮线（模拟闪电核心的高亮）
   *
   * 两层叠加产生"中心极亮 + 外围柔光"的真实闪电视觉效果。
   *
   * @param {Array<{x: number, y: number}>} points - 闪电路径点数组
   * @param {string} color - 外层发光颜色（取自 COLORS 调色盘）
   * @param {number} width - 外层线宽（像素）
   * @param {number} glow - shadowBlur 发光半径（像素）
   */
  function drawBolt(points, color, width, glow) {
    // 保存当前绑图状态（避免 shadow 等属性污染后续绘制）
    ctx.save();

    // ---- 第一层：外发光 ----
    // 设置 Canvas 的阴影属性，实现发光效果
    ctx.shadowColor = color;    // 阴影颜色 = 闪电颜色
    ctx.shadowBlur = glow;      // 阴影模糊半径
    ctx.strokeStyle = color;    // 线条颜色
    ctx.lineWidth = width;      // 线条宽度
    ctx.lineJoin = 'round';     // 线条连接处用圆角，避免尖锐折角

    // 绘制外层路径
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // ---- 第二层：内芯高亮 ----
    // 关闭阴影，绘制更细更亮的中心线
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#e0b0ff';        // 淡紫色高光
    ctx.lineWidth = width * 0.4;        // 宽度为外层的 40%

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var j = 1; j < points.length; j++) {
      ctx.lineTo(points[j].x, points[j].y);
    }
    ctx.stroke();

    // 恢复之前的绘图状态
    ctx.restore();
  }

  // ==================== 闪电分支生成 ====================

  /**
   * 从一条主闪电路径上随机选取一个节点，生成一条分支闪电。
   *
   * 分支特点：
   * - 起点：主闪电路径上的随机中间节点（避开首尾）
   * - 方向：大致向下（以 π/2 即正下方为中心，左右随机偏移约 ±34°）
   * - 长度：40-120 像素随机
   * - 形态：同样使用递归分形算法生成锯齿形路径，但递归深度更浅（3层）
   *
   * @param {Array<{x: number, y: number}>} parentPoints - 主闪电的路径点
   * @returns {Array<{x: number, y: number}>} 分支闪电的路径点
   */
  function generateBranch(parentPoints) {
    // 从主闪电路径的中间部分随机选一个节点作为分支起点
    // （避开 index=0 和最后一个点）
    var idx = Math.floor(Math.random() * (parentPoints.length - 2)) + 1;
    var p = parentPoints[idx];

    // 计算分支方向
    // 以正下方（π/2）为中心，随机偏移 ±0.6 弧度（约 ±34°）
    var angle = (Math.random() - 0.5) * 1.2 + Math.PI / 2;

    // 分支长度：40-120 像素随机
    var len = 40 + Math.random() * 80;

    // 根据角度和长度计算分支终点
    var ex = p.x + Math.cos(angle) * len;
    var ey = p.y + Math.sin(angle) * len;

    // 使用与主闪电相同的分形算法生成分支路径
    // displace=30（比主闪电小，分支更细），depth=3（比主闪电浅，锯齿更少）
    return generateBolt(p.x, p.y, ex, ey, 30, 3);
  }

  // ==================== 单次闪电触发 ====================

  /**
   * 触发一次完整的闪电效果（使用 requestAnimationFrame 实现平滑动画）。
   *
   * 动画时间线（约 800ms）：
   *
   *  [0ms]     主闪亮起 —— 全亮度绘制所有闪电 + 分支
   *            页面边缘光晕出现
   *            canvas 上叠加一层白色半透明矩形模拟环境泛光
   *
   *  [0-80ms]  主闪衰减 —— 通过 requestAnimationFrame 逐帧降低 alpha
   *            白色泛光同步衰减，闪电线条逐渐变暗
   *
   *  [120ms]   回闪亮起 —— 以约 40% 亮度重新绘制（模拟雷电的"二次放电"）
   *
   *  [120-400ms] 回闪衰减 —— 再次逐帧淡出，直到完全透明
   *
   *  [400ms]   光晕开始淡出（CSS transition 控制）
   *
   *  [700ms]   动画结束，清除 canvas 和光晕 class
   *
   * 使用 requestAnimationFrame 替代 setTimeout 硬切，
   * 每一帧都根据经过时间计算 alpha 值，实现自然的指数衰减。
   */
  function flash() {
    if (!canvas || !ctx) return;

    var w = canvas.width;
    var h = canvas.height;
    if (w === 0 || h === 0) return;

    // ---- 生成主闪电路径 ----
    var bolts = [];
    // 40% 概率生成 2 条，60% 概率生成 1 条
    var count = Math.random() < 0.4 ? 2 : 1;

    for (var b = 0; b < count; b++) {
      // 起点 X：banner 宽度的 20%-80%（避免太靠边）
      var sx = w * (0.2 + Math.random() * 0.6);
      // 终点 X：在起点附近偏移（±10%），模拟闪电略微倾斜
      var ex = sx + (Math.random() - 0.5) * w * 0.2;
      // 生成主闪电路径（6 层递归分形）
      bolts.push(
        generateBolt(sx, 0, ex, h * (0.6 + Math.random() * 0.4), h * 0.3, 6)
      );
    }

    // ---- 预生成分支（避免每帧重复生成导致闪烁路径不一致） ----
    var allBranches = [];
    for (var bi = 0; bi < bolts.length; bi++) {
      var branchCount = Math.floor(Math.random() * 3);
      for (var bj = 0; bj < branchCount; bj++) {
        allBranches.push({
          points: generateBranch(bolts[bi]),
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
      }
    }

    // ---- 绘制函数：按给定 alpha 绘制所有闪电 ----
    function drawFrame(alpha) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = alpha;

      // 白色环境泛光（模拟闪电照亮整个场景）
      // alpha 越高泛光越明显，快速衰减后消失
      if (alpha > 0.3) {
        ctx.fillStyle = 'rgba(200, 180, 255, ' + (alpha - 0.3) * 0.3 + ')';
        ctx.fillRect(0, 0, w, h);
      }

      // 绘制主闪电
      for (var i = 0; i < bolts.length; i++) {
        var color = COLORS[Math.floor(Math.random() * COLORS.length)];
        drawBolt(bolts[i], color, 2.5 * alpha + 0.5, 20 * alpha);
      }

      // 绘制预生成的分支
      for (var j = 0; j < allBranches.length; j++) {
        drawBolt(allBranches[j].points, allBranches[j].color, 1.5 * alpha + 0.3, 12 * alpha);
      }

      ctx.globalAlpha = 1;
    }

    // ---- 触发页面边缘光晕 ----
    document.body.classList.add('fischl-lightning-glow');

    // ---- 使用 requestAnimationFrame 实现平滑动画 ----
    var startTime = performance.now();

    // 动画阶段参数：
    //   0-80ms    主闪衰减（alpha 1.0 → 0.0，指数衰减）
    //   80-120ms  暗间隔（画布清空，等待回闪）
    //   120-400ms 回闪衰减（alpha 0.4 → 0.0）
    //   400ms+    结束
    var PHASE1_END = 80;     // 主闪衰减结束
    var PHASE2_START = 120;  // 回闪开始
    var PHASE2_END = 400;    // 回闪衰减结束
    var TOTAL = 700;         // 光晕淡出完成

    function tick(now) {
      var elapsed = now - startTime;

      if (elapsed < PHASE1_END) {
        // ---- 主闪阶段：指数衰减 ----
        // t 从 0→1，alpha 用指数衰减 (1-t)^3，开头极亮然后快速变暗
        var t = elapsed / PHASE1_END;
        var alpha = Math.pow(1 - t, 3);
        drawFrame(alpha);

      } else if (elapsed < PHASE2_START) {
        // ---- 暗间隔：清空画布，等待回闪 ----
        ctx.clearRect(0, 0, w, h);

      } else if (elapsed < PHASE2_END) {
        // ---- 回闪阶段：二次放电，更柔和的衰减 ----
        var t2 = (elapsed - PHASE2_START) / (PHASE2_END - PHASE2_START);
        var alpha2 = 0.4 * Math.pow(1 - t2, 2);
        drawFrame(alpha2);

      } else if (elapsed < TOTAL) {
        // ---- 尾声：清空画布，光晕通过 CSS transition 自然淡出 ----
        ctx.clearRect(0, 0, w, h);

      } else {
        // ---- 动画结束：清理 ----
        ctx.clearRect(0, 0, w, h);
        document.body.classList.remove('fischl-lightning-glow');
        return; // 停止 requestAnimationFrame 循环
      }

      // 继续下一帧
      requestAnimationFrame(tick);
    }

    // 启动动画循环
    requestAnimationFrame(tick);
  }

  // ==================== 随机间隔调度 ====================

  /**
   * 调度下一次闪电。
   *
   * 每次闪电结束后，等待 4-10 秒的随机间隔再触发下一次。
   * 使用 setTimeout 递归调用自身，实现"随机间隔 + 无限循环"的效果。
   *
   * 为什么用随机间隔而不是固定间隔？
   * - 固定间隔会显得机械、不自然
   * - 随机间隔模拟真实雷暴中闪电的不规则出现节奏
   */
  function schedule() {
    // 清除之前的定时器（防止重复调度）
    clearTimeout(timer);

    // 随机延迟：2000ms + 0-4000ms = 2-6 秒
    var delay = 2000 + Math.random() * 4000;

    timer = setTimeout(function () {
      // 触发一次闪电
      flash();
      // 递归调度下一次（闪电结束后立即计算下一次的延迟）
      schedule();
    }, delay);
  }

  // ==================== 生命周期管理 ====================

  // --- 页面加载 ---
  // 如果 DOM 还在解析中，等待 DOMContentLoaded 再初始化
  // 如果 DOM 已就绪，直接初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // --- 窗口大小变化 ---
  // 窗口 resize 时重新调整 canvas 尺寸，保持与 banner 容器一致
  window.addEventListener('resize', resize);

  // --- pjax 单页导航支持 ---
  // Butterfly 主题支持 pjax（点击链接不刷新整个页面，只替换局部内容）
  // pjax:complete 事件在页面内容替换完成后触发
  document.addEventListener('pjax:complete', function () {
    // 先销毁旧的闪电（清除 canvas 和定时器）
    destroy();
    // 如果新页面是首页，重新初始化闪电
    // （非首页时 isHome() 返回 false，init() 会自动跳过）
    if (isHome()) init();
  });
})();
