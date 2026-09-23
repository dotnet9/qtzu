// 城市边界（卡通长城）的断面数据层。**规则只有一份**。
//
// 为什么单独成文件：墙体有**两套实现** ——
//   · 程序化：js/world.js 的 buildWallGeometry()（无轮廓 / 资产加载失败时兜底）
//   · 烘焙：  scripts/bake/ground.py 的 wall()（52 城实际渲染的那面）
// 两边的数字原来是各写一份、靠注释互相指认（specs.mjs 里写着 "// world.js:1137,1156"）。
// 一旦不一致，兜底路径与实际渲染就会是**两种墙**，而这种漂移不会报错、只有肉眼能发现。
// 现在断面参数集中在这里，js 与 py 两侧都照它生成（specs.mjs 把数据原样搬进 ground spec）。
//
// 单位：米。墙心线 = 城市轮廓线；off 向外为正、向内为负。
//
// ⚠ 内壁半宽（`innerHalf`）**不能改**：js/game.js 的 _cityWallMargin() 是硬编码 1.42
//   （= 内壁 1.0 + 玩家半径 0.42），内壁一变，可行走区与贴边判定全错。
//   所以"加厚"只做在**外侧**（outer 底 +1.24 / 基座 +1.40）。
export const WALL = {
  H: 3.0,               // 墙顶（结构高度）
  innerHalf: 1.0,       // 内壁半宽（⚠ 见上）
  outerTop: 1.0,        // 外侧顶半宽（= 顶面外沿）
  outerBase: 1.24,      // 外侧收分底（y = plinthH 处）
  plinthOuter: 1.40,    // 墙根条石基座外沿
  plinthH: 0.42,        // 条石基座高
  walkHalf: 0.62,       // 墙顶马道半宽
  walkLift: 0.02,       // 马道面比墙顶高
  copingHalf: 0.72,     // 压顶石外沿（马道两侧各一条）
  copingLift: 0.08,     // 压顶石比墙顶高
  parapetH: 0.55,       // 内侧女墙高出墙顶
  uvArc: 8,             // 砖纹 u = 弧长 / uvArc；v = 高度 / H
  // 垛口：站在墙顶**外侧露台**上（off 0.62…1.00），带一处下切的箭孔
  merlon: { w: 1.05, h: 1.0, d: 0.38, gap: 2.2, off: 0.81, slitW: 0.26, slitH: 0.4 },
  colors: {
    brick: '#8C9C9F',   // 砖墙（与 js/world.js 的 brickTexture() 底色同色 → 挂纹不变色调）
    merlon: '#A9B8B7',  // 垛口
    walk: '#B4BEB6',    // 马道
    coping: '#CBD3CE',  // 压顶石
    parapet: '#BDC7C1', // 女墙
    plinth: '#9A9A92',  // 条石基座
  },
};

// 断面：12 条带，自内向外绕一圈闭合。每条带 = 一个四边形环（扫掠时一条 draw 带）。
//   a / b：两个端点在断面里的位置 [off, y]
//   c：颜色键（WALL.colors）
//   va / vb：该带两端的贴图 V（水平带两端同值；竖直带按高度 0…0.95，
//            墙顶那条用 0.97 —— brickTexture() 顶端 4.5px 是"墙帽走色"带）
export const WALL_BANDS = [
  { name: 'inner',      a: [-1.00, 0.00], b: [-1.00, 3.55], c: 'brick',   va: 0.00, vb: 0.95 },
  { name: 'parapetTop', a: [-1.00, 3.55], b: [-0.62, 3.55], c: 'parapet', va: 0.20, vb: 0.20 },
  { name: 'parapetIn',  a: [-0.62, 3.55], b: [-0.62, 3.02], c: 'parapet', va: 0.90, vb: 0.90 },
  { name: 'walk',       a: [-0.62, 3.02], b: [0.62, 3.02],  c: 'walk',    va: 0.20, vb: 0.20 },
  { name: 'copingIn',   a: [0.62, 3.02],  b: [0.62, 3.08],  c: 'coping',  va: 0.90, vb: 0.90 },
  { name: 'copingTop',  a: [0.62, 3.08],  b: [0.72, 3.08],  c: 'coping',  va: 0.20, vb: 0.20 },
  { name: 'copingOut',  a: [0.72, 3.08],  b: [0.72, 3.00],  c: 'coping',  va: 0.90, vb: 0.90 },
  { name: 'topLedge',   a: [0.72, 3.00],  b: [1.00, 3.00],  c: 'brick',   va: 0.97, vb: 0.97 },
  { name: 'outer',      a: [1.00, 3.00],  b: [1.24, 0.42],  c: 'brick',   va: 0.95, vb: 0.14 },
  { name: 'plinthStep', a: [1.24, 0.42],  b: [1.40, 0.42],  c: 'plinth',  va: 0.20, vb: 0.20 },
  { name: 'plinthFace', a: [1.40, 0.42],  b: [1.40, 0.00],  c: 'plinth',  va: 0.14, vb: 0.00 },
  { name: 'bottom',     a: [1.40, 0.00],  b: [-1.00, 0.00], c: 'plinth',  va: 0.00, vb: 0.00 },
];

/* ---- 敌楼（烽火台）----
   参考图里最抢眼的是两座"两层楼 + 凹曲瓦顶 + 起翘檐角"的中式敌楼，而原来是平顶 + 火盆。
   低模做法：曲面屋檐不用真曲面 —— 每层檐用**逐级收窄的薄板**堆出凹曲轮廓，
   四角各加一个外旋的小楔块做"起翘"，正脊/垂脊用细长盒（金色，与地标 lm_gate 同一套色）。
   高度只在这里推导一次，world.js 与校验都读 beaconHeights()，不在两处各算一遍。 */
export const BEACON = {
  base: { w: 5.2, h: 2.6 },              // 底台
  shaft: { w: 4.2, h: 1.9 },             // 楼身（一层）
  balcony: { w: 4.9, h: 0.12 },          // 平座挑出
  eaveLow: { w: 4.6, h: 0.84, steps: 3, taper: 0.62, flare: 1.06 },   // 下层腰檐
  upper: { w: 3.2, h: 0.9 },             // 二层楼身
  eaveTop: { w: 3.6, h: 0.81, steps: 3, taper: 0.58, flare: 1.05 },   // 上层正顶
  ridge: { l: 2.6, w: 0.26, h: 0.15 },   // 正脊（金）
  hip: { l: 1.15, w: 0.16, h: 0.12 },    // 垂脊 ×4（金）
  corner: { w: 0.5, d: 0.5, h: 0.14, tilt: 0.38 },   // 起翘檐角 ×4
  bowl: { r: 0.7, rTop: 0.95, h: 0.4, lift: 0.1 },   // 宝顶火盆（骑在正脊上）
};

/** 敌楼各层顶面高度（自上而下推，world.js 与校验共用）。 */
export function beaconHeights() {
  const b = BEACON;
  const baseTop = b.base.h;
  const shaftTop = baseTop + b.shaft.h;
  const balconyTop = shaftTop + b.balcony.h;
  const eaveLowTop = balconyTop + b.eaveLow.h;
  const upperTop = eaveLowTop + b.upper.h;
  const eaveTopTop = upperTop + b.eaveTop.h;
  const ridgeTop = eaveTopTop + b.ridge.h;
  const bowlTop = ridgeTop + b.bowl.lift + b.bowl.h;   // 火盆口（火苗锚点）
  return { baseTop, shaftTop, balconyTop, eaveLowTop, upperTop, eaveTopTop, ridgeTop, bowlTop };
}

/** 外侧半宽随高度的变化（校验用：底部必须 > 顶部，差值 = outerBase - outerTop）。 */
export function outerHalfAt(y) {
  const { outerTop, outerBase, plinthH, plinthOuter } = WALL;
  if (y <= 0) return plinthOuter;
  if (y < plinthH) return plinthOuter;
  if (y >= WALL.H) return outerTop;
  const t = (y - plinthH) / (WALL.H - plinthH);
  return outerBase + (outerTop - outerBase) * t;
}

/** 垛口底面高度 = 墙顶；顶面 = 墙顶 + h（校验与 py 都读它，避免各写一份）。 */
export const merlonBaseY = () => WALL.H;
export const merlonTopY = () => WALL.H + WALL.merlon.h;
/** 女墙顶 / 压顶石顶 / 马道面（校验用） */
export const parapetTopY = () => WALL.H + WALL.parapetH;
export const copingTopY = () => WALL.H + WALL.copingLift;
export const walkY = () => WALL.H + WALL.walkLift;
