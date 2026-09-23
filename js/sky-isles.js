// 天空群岛（城市巡游）：每座城市上空一条浮岛链 —— 云梯跳上去 → 取岛上的蛋孵化 → 跳下来找别的蛋。
//
// 为什么整条岛链都在**城市轮廓之内**：城市巡游下玩家位置每帧被 game._clampCityPos 钳回轮廓内
// （任何高度都钳，没有高度豁免），"墙外海面上的浮岛"在物理上够不到 —— 人一落地就被拽回轮廓线，
// 栈桥也会被夹断。岛链因此架在城内上空约 0.55r 处：掉下来一定落回城里（不掉海、不卡死），
// 也和"每座城市上空都有一片天空群岛"一致；城墙那一侧只放**通道**（栈桥从马道起步，人要站在城里）。
//
// 本文件只产出几何与数据，一个物理量都不判：
//   · 岛面 / 桥面 / 木台 → platforms（world.js 用 addPlatform 注册成可站平台）
//   · 会浮的云踏板      → pads（world.js 注册 pf.bob 并塞进 world.anim.cloudStair：
//                          直接复用农场云梯那套"上下浮 + 远景淡出"，不新增第二套动画）
//   · 弹簧蘑菇跳板      → bounces（world.js 用 colTop(..., bounce=true)，复用现有 vy=12.5 弹跳）
//   · 蛋位 / 宝箱 / 风车 / 旗 / 采点 → 位置与网格，规则在 game.js
import * as THREE from 'three';
import { PROPS } from './models.js';
import { M, G, box, cyl, sph, tor } from './models/kit.js';
import { polyInside, clampPoly } from './city-shape.js';

export const SKY = {
  TOP: 15.0,             // 主岛岛面高度（四条通道的落点都对齐这一层）
  PAD_H: 1.4,            // 云梯每级抬升（单跳 1.85 / 二段 3.30，留出浮动的余量）
  PAD_R: 1.4,            // 云踏板半径（与农场云梯同款 1.35~1.5）
  PAD_AMP: 0.12,         // 上下浮动振幅（沿用农场云梯 0.12~0.14；间距按最坏相位留量）
  LIFT_R: 1.58,          // 上升气流柱半径
  FLOAT_VY: 2.4,         // 飘落速度上限（"蒲公英式"缓降）
  ISLE_R: [4.2, 3.4, 3.4, 3.4, 2.8],        // 主岛最大，其余 3.4，末位是小岛（宝箱）
  ISLE_TOP: [15.0, 15.6, 15.0, 15.7, 18.4], // 相邻高差 ≤1.3（二段跳够用）；小岛靠弹簧跳板上去
  CHAIN: [0, 8.6, 18.6, 27.8, 36.4],        // 沿**切线**方向的岛位（岛沿之间留 1~4 米的缺口）
};

// 能驮人飞的词宠（"词宠驮着飞"这条通道的前置）。外形上真的会飞的这几种。
export const SKY_FLYERS = new Set(['bird', 'bee', 'kite', 'wind']);

/* ================= 确定性随机 ================= */
function makeRng(seedStr) {
  let h = 2166136261;
  for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* ================= 造型小工具 ================= */
// 顶点抖动：按**顶点位置**取哈希（不是按下标）—— 圆柱/圆锥的端盖与侧面共用坐标的顶点必须抖到
// 同一处，否则盖上会裂开一条缝。±amt/2 的位移正好把"等距规整的圆锥"打散成块状岩。
function jitter(geo, amt, salt = 0) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const h1 = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + salt) * 43758.5453;
    const h2 = Math.sin(x * 39.346 + y * 11.135 + z * 83.155 + salt * 1.7) * 24634.6345;
    pos.setX(i, x + (h1 - Math.floor(h1) - 0.5) * amt);
    pos.setZ(i, z + (h2 - Math.floor(h2) - 0.5) * amt);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// 按高度分层着色（岩层色带）：顶点色 = 逐高度的深浅交替，一次 draw call 出 3 条岩层
function bandColor(geo, cols) {
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const span = Math.max(0.001, maxY - minY);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    c.set(cols[Math.min(cols.length - 1, Math.floor(t * cols.length))]);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// 一批静态零件实例化成 1 个 draw call（栈桥木板 / 栏杆柱 / 桥墩 / 远山）
function instanced(geo, mat, items) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  items.forEach((it, i) => {
    p.set(it.x, it.y, it.z);
    q.setFromAxisAngle(up, it.ry || 0);
    s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    im.setMatrixAt(i, m4.compose(p, q, s));
  });
  im.instanceMatrix.needsUpdate = true;
  return im;
}

// 岛上一律不投影：15 米高的岛会在城里盖出一片大黑斑，把 check-render 的草地亮度指标压穿
// （农场那座天空岛当初正是为这个关掉投影的）
function noShadow(g) {
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

/* ================= 岛体：草顶外挑 + 土壤线 + 块状岩底 ================= */
function makeIsle(r, color, rng) {
  const g = new THREE.Group();
  const grass = new THREE.Color('#7FCB72').lerp(new THREE.Color(color || '#7FCB72'), 0.16);
  const rockH = Math.max(4.2, r * 1.75);
  // 岩底：9 段倒锥 + 4 层高度分段 + 顶点抖动 → 读起来是"一块块石头垒起来的"，不是光滑陀螺
  const rock = new THREE.Mesh(
    bandColor(jitter(new THREE.ConeGeometry(r * 0.86, rockH, 9, 4), r * 0.12, 1.3 + rng()),
      ['#8A6E4C', '#9C7C56', '#A8825B']),
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  rock.rotation.x = Math.PI;                 // 倒过来：宽面朝上接草皮，尖头垂下去
  rock.position.y = -1.2 - rockH / 2;
  // 土壤线：比草皮略窄、比岩底略宽的一圈深土色 —— 读起来像"草皮盖在土上"
  const soil = new THREE.Mesh(
    jitter(new THREE.CylinderGeometry(r + 0.04, r * 0.82, 0.62, 20, 1), r * 0.05, 3.7),
    M('#6E5236', { rough: 1, flat: true }));
  soil.position.y = -0.98;
  // 草顶：比岩体**外扩 0.18**（参考图里浮岛的草皮都是挑出去的）
  const top = new THREE.Mesh(
    jitter(new THREE.CylinderGeometry(r + 0.18, r + 0.02, 0.78, 22, 1), r * 0.045, 5.1),
    M(grass, { rough: 0.95, flat: true }));
  top.position.y = -0.39;
  g.add(rock, soil, top);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

/* ================= 零件 ================= */
// 弹簧蘑菇跳板：踩上去弹 12.5（见 game.js 的 pf.bounce），顶面即平台面（相对岛面 0.8）
function makeMushroom() {
  const g = G();
  cyl(g, 0.15, 0.24, 0.5, '#F2E4D0', 0, 0.25, 0, 0, 0, 0, 10);
  sph(g, 0.6, '#E8607A', 0, 0.5, 0, 1, 0.5, 1);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.4;
    sph(g, 0.075, '#FFF6EC', Math.cos(a) * 0.32, 0.7, Math.sin(a) * 0.32, 1, 0.6, 1);
  }
  tor(g, 0.42, 0.035, '#FFF6EC', 0, 0.8, 0, Math.PI / 2);
  return g;
}

function makeChest() {
  const g = G();
  box(g, 0.92, 0.56, 0.62, '#B07A4E', 0, 0.28, 0);
  box(g, 0.96, 0.1, 0.66, '#8A6844', 0, 0.56, 0);
  for (const sx of [-0.3, 0.3]) box(g, 0.07, 0.58, 0.66, '#E8C86A', sx, 0.29, 0, 0, 0, 0, { rough: 0.5, metal: 0.2 });
  const lid = G();
  lid.position.set(0, 0.6, -0.31);
  box(lid, 0.96, 0.2, 0.66, '#A87551', 0, 0.1, 0.31);
  box(lid, 0.99, 0.07, 0.68, '#E8C86A', 0, 0.2, 0.31, 0, 0, 0, { rough: 0.5, metal: 0.2 });
  g.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.08),
    M('#E8C86A', { rough: 0.4, metal: 0.3, emissive: '#C9A43A', ei: 0.22 }));
  lock.position.set(0, 0.5, 0.34);
  g.add(lock);
  g.userData.lid = lid;
  return g;
}

function makeFlag() {
  const g = G();
  cyl(g, 0.05, 0.075, 3.6, '#B08D58', 0, 1.8, 0, 0, 0, 0, 8);
  sph(g, 0.09, '#E8C86A', 0, 3.66, 0, 1, 1, 1, { rough: 0.4, metal: 0.3 });
  const cloth = G();
  cloth.position.set(0, 3.3, 0);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.72, 0.05), M('#FFB46B', { rough: 0.9 }));
  flag.position.set(0.66, -0.36, 0);
  cloth.add(flag);
  cloth.scale.set(1, 0.02, 1);   // 升旗：念对单词后由 game 层把 scale.y 补到 1
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

// 蒲公英：走过就吹散（绒球缩小 + 粒子在 game.js 里发）
function makeDandelion() {
  const g = G();
  cyl(g, 0.015, 0.022, 0.42, '#8FA86A', 0, 0.21, 0, 0, 0, 0, 6);
  for (const [x, y, z, s] of [[0, 0.52, 0, 1], [0.12, 0.46, 0.06, 0.7], [-0.1, 0.44, -0.08, 0.6]]) {
    sph(g, 0.075 * s, '#FFFDF4', x, y, z, 1, 1, 1, { alpha: 0.9, emissive: '#FFFDF4', ei: 0.12 });
  }
  return g;
}

// 采点：果子（小灌木挂 3 颗红果）
function makeBerry() {
  const g = G();
  sph(g, 0.26, '#4E9152', 0, 0.22, 0, 1, 1.05, 1);
  for (const [x, y, z] of [[0.14, 0.4, 0.06], [-0.13, 0.36, -0.08], [0.02, 0.46, -0.12]]) {
    sph(g, 0.085, '#E2564E', x, y, z, 1, 1, 1, { emissive: '#B0322C', ei: 0.18 });
  }
  return g;
}

/* ================= 栈桥 ================= */
// 一段木栈桥：木板实例化（1 个 draw call），两侧绳栏各一条长条，栏杆柱每 3 档一根
function makeWalkway(pts) {
  const g = G();
  const half = 0.95;
  const planks = [], posts = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const pr = pts[Math.max(0, i - 1)];
    const yaw = Math.atan2(q.x - pr.x, q.z - pr.z);
    planks.push({ x: p.x, y: p.y - 0.085, z: p.z, ry: yaw });
    if (i % 3 === 0) {
      const nx = Math.cos(yaw), nz = -Math.sin(yaw);
      for (const sgn of [-1, 1]) posts.push({ x: p.x + nx * sgn * half, y: p.y + 0.32, z: p.z + nz * sgn * half, ry: yaw });
    }
  });
  g.add(instanced(new THREE.BoxGeometry(2.05, 0.17, half * 2), M('#B07A4E', { rough: 0.95 }), planks));
  if (posts.length) g.add(instanced(new THREE.CylinderGeometry(0.055, 0.065, 0.68, 6), M('#8A6844', { rough: 1 }), posts));
  const a = pts[0], b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const ry = Math.atan2(b.x - a.x, b.z - a.z);
  for (const sgn of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, Math.max(0.4, len)), M('#C9A46B', { rough: 1 }));
    rope.position.set((a.x + b.x) / 2 + Math.cos(ry) * sgn * half, (a.y + b.y) / 2 + 0.62,
      (a.z + b.z) / 2 - Math.sin(ry) * sgn * half);
    rope.rotation.y = ry;
    g.add(rope);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

/* ================= 远山剪影（给"高处"一个纵深） ================= */
// 两圈锥形山影：越远越淡（颜色直接按雾色混，材质 fog:false 保住淡青的轮廓），
// 每圈 1 个 InstancedMesh。城与城之间相距 640+，不会串到别的城上。
function makeMountains(r, rng, fogColor) {
  const g = G();
  const rings = [
    { R: r * 2.6, n: 22, h: [26, 48], w: 0.10, mix: 0.55, c: '#5E7BA6' },
    { R: r * 3.5, n: 16, h: [46, 78], w: 0.15, mix: 0.74, c: '#6E86A8' },
  ];
  const geo = new THREE.ConeGeometry(1, 1, 5, 1);
  geo.translate(0, 0.5, 0);                 // 底面落在 y=0，缩放 sy 即山高
  for (const ring of rings) {
    const items = [];
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + rng() * 0.18;
      const d = ring.R * (0.92 + rng() * 0.16);
      const h = ring.h[0] + rng() * (ring.h[1] - ring.h[0]);
      const w = ring.R * ring.w * (0.7 + rng() * 0.6);
      items.push({ x: Math.cos(a) * d, y: -6, z: Math.sin(a) * d, sx: w, sy: h, sz: w, ry: rng() * 3 });
    }
    const col = new THREE.Color(ring.c).lerp(new THREE.Color(fogColor || '#CBE6F2'), ring.mix);
    g.add(instanced(geo, new THREE.MeshBasicMaterial({ color: col, fog: false }), items));
  }
  return g;
}

/* ================= 主入口 ================= */
/**
 * 在城里上空建一片天空群岛。mesh 用**局部坐标**（岛组本身就摆在 (cx,cz)），平台/碰撞用世界坐标。
 * @returns 岛链数据包；world.js 存进 world.skyIsles[key] 供 game 层用
 */
export function buildSkyIsles(o) {
  const { key, cx, cz, r, color = '#7FCB72', poly, terrain = null, fogColor, cityGrp } = o;
  const rng = makeRng('sky|' + key);
  // 整片岛链收进**自己的一个组**再挂到城组上，两个理由：
  //   ① game._autoColliders 会扫"城组顶层 + 一层子组"给大件补碰撞体（防穿模），
  //      不套这层壳的话整片岛链会被当成一栋 36×36 的大建筑，凭空塞一个巨型碰撞体到城里；
  //   ② 整组显隐 / 以后要整组释放都有个抓手。
  const grp = new THREE.Group();
  grp.name = 'sky-isles';
  cityGrp.add(grp);
  const out = {
    key, ca: 0, isles: [], links: [], platforms: [], bounces: [], pads: [], eggSpots: [], forage: [], decor: [],
    stairs: [], lift: null, wall: null, chest: null, mill: null, flag: null,
    anim: { gulls: [], butterflies: [], dandelions: [] },
  };
  const addP = (x, z, rr, top) => out.platforms.push({ x: cx + x, z: cz + z, r: rr, top });
  const addB = (x, z, rr, top, bottom) => out.bounces.push({ x: cx + x, z: cz + z, r: rr, top, bottom });

  /* ---- 1. 选址：一条沿**切线**排开的岛链 -------------------------------------------
     切线排（不径向排）：各岛到城心的距离基本一致，"装不装得下"好判，也不压在城心主轴线上。
     主岛到城墙的距离被**栈桥**钉死 —— 8 级台阶每级抬 1.4 米、水平跑 1.59 米（共 12.7 米），
     再加墙根平台 2.6 米与岛沿 1.2 米余量 → 主岛中心离墙根 20.7 米（WALL_GAP）。
     还要避开两样东西：① 城内高楼（14~26 米，会从 15 米的岛面中间长出来）
     ② 栈桥路径上的建筑（桥面 3~15 米，横穿一栋楼就把人挡在半路）。 */
  const WALL_GAP = 20.7;
  // 云梯螺旋的角度范围（绕主岛）：起点在"岛链/栈桥/气柱"三者的缝里，占半圈多一点
  const SPIRAL_FROM = Math.PI + 0.55, SPIRAL_SPAN = 2.2;
  const base = rng() * Math.PI * 2;
  const chainLen = SKY.CHAIN[SKY.CHAIN.length - 1];
  const water = terrain && terrain.waterAt ? terrain.waterAt : null;   // 有高度场的城：地面那几个点别落在湖里
  const wallD = (dx, dz) => {
    const d = poly ? wallDist(poly, dx, dz) : r;
    return (d === 1e9 || !isFinite(d)) ? r * 0.96 : d;
  };
  // 城内"有台面的高层碰撞体"（高楼/地标）：判定岛下有没有楼、栈桥会不会撞上去
  const nearC = (o.colliders || []).filter((c) => !c.dead && c.top !== undefined && c.top >= 6
    && Math.hypot(c.x - cx, c.z - cz) < r * 1.6);
  const blocked = (lx, lz, rr, minTop) => nearC.some((c) => c.top >= minTop
    && Math.hypot(c.x - (cx + lx), c.z - (cz + lz)) < (c.r || 1) + rr);
  const segBlocked = (ax, az, bx, bz, rr) => nearC.some((c) => {
    const ex = bx - ax, ez = bz - az;
    const len2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((c.x - cx - ax) * ex + (c.z - cz - az) * ez) / len2));
    return Math.hypot(c.x - cx - (ax + ex * t), c.z - cz - (az + ez * t)) < (c.r || 1) + rr;
  });
  const fitOf = (ca, s) => {
    const rx = Math.cos(ca), rz = Math.sin(ca), ux = -rz, uz = rx;
    const wd = wallD(rx, rz);
    const dc = wd - WALL_GAP;                     // 主岛中心的径向距离
    if (dc < r * 0.22) return null;               // 城太小：链会翻到城心另一侧，换一档
    const at2 = (t, dOff = 0) => [rx * (dc + dOff) + ux * t * s, rz * (dc + dOff) + uz * t * s];
    const pts = SKY.CHAIN.map((t, i) => { const [lx, lz] = at2(t); return [lx, lz, SKY.ISLE_R[i] + 1.0]; });
    pts.push([...at2(0, SKY.ISLE_R[0] + 2.2 + 1.6), 1.0]);              // 云梯螺旋的最外圈
    pts.push([...at2(0, -(SKY.ISLE_R[0] + 4.0)), 2.0]);                 // 气柱地面光圈（切线另一侧）
    pts.push([rx * (wd - 2.6), rz * (wd - 2.6), 2.0]);                  // 栈桥起点（墙根内侧）
    if (poly) {
      for (const [lx, lz, m] of pts) {
        if (!polyInside(poly, lx, lz)) return false;
        const q = clampPoly(poly, lx, lz, m);
        if (Math.hypot(q[0] - lx, q[1] - lz) > 0.01) return false;
      }
    }
    // 地面上的两个落点别选在水面（掉水里会卡住，见 game._updateSkyWays 的保底）
    const [lx2, lz2] = at2(0, -(SKY.ISLE_R[0] + 4.0));
    if (water) {
      if (water(lx2, lz2) > 0.3) return false;
      if (water(rx * (wd - 2.6), rz * (wd - 2.6)) > 0.3) return false;
    }
    // 高楼穿岛 / 高楼挡桥 / 云梯最下面几级被楼挡住（得先走到云梯底下才跳得上去）
    for (let i = 0; i < SKY.CHAIN.length; i++) { const [lx, lz] = at2(SKY.CHAIN[i]); if (blocked(lx, lz, 1.4, 12)) return false; }
    if (blocked(lx2, lz2, 1.6, 12)) return false;
    for (let k = 0; k < 3; k++) {
      const a = ca + SPIRAL_FROM + (k / 9) * SPIRAL_SPAN;
      const R = SKY.ISLE_R[0] + 2.2;
      if (blocked(rx * dc + Math.cos(a) * R, rz * dc + Math.sin(a) * R, 1.8, 12)) return false;
    }
    const [ex, ez] = at2(0, SKY.ISLE_R[0] + 1.2);
    if (segBlocked(rx * (wd - 2.6), rz * (wd - 2.6), ex, ez, 1.3)) return false;
    return { ca, dc, s };
  };
  // 搜索顺序：**先要岛链摊得开**（s 最大），再挑方位 —— 反过来会为了塞进去把 s 压到 0.6，五座岛挤成一摞。
  let pick = null;
  outer:
  for (const s of [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58]) {
    for (const dca of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4, Math.PI, 2.9, -2.9]) {
      const p = fitOf(base + dca, s);
      if (p) { pick = p; break outer; }
    }
  }
  // 极窄/极小的城：实在放不下就压到 0.28r 并把链缩到 0.58（岛会互相压上，但四条通道与玩法完整）
  const fbCa = base, fbDc = Math.max(r * 0.28, wallD(Math.cos(base), Math.sin(base)) - WALL_GAP);
  const { ca, dc, s } = pick || { ca: fbCa, dc: fbDc, s: 0.58 };
  out.ca = ca; out.dc = dc; out.scale = s; out.root = grp;
  const rx = Math.cos(ca), rz = Math.sin(ca), ux = -rz, uz = rx;
  const at = (t) => [rx * dc + ux * t * s, rz * dc + uz * t * s];

  /* ---- 2. 岛体 + 岛面平台 ---------------------------------------------------------- */
  SKY.CHAIN.forEach((t, i) => {
    const [lx, lz] = at(t);
    const ir = SKY.ISLE_R[i], top = SKY.ISLE_TOP[i];
    const mesh = makeIsle(ir, color, rng);
    mesh.position.set(lx, top, lz);
    grp.add(mesh);
    addP(lx, lz, ir - 0.3, top);        // 留 0.3 余量：别让人"站在空气上"
    out.isles.push({ idx: i, x: cx + lx, z: cz + lz, lx, lz, r: ir, top, mesh, mini: i === SKY.ISLE_R.length - 1 });
    // 蛋位靠岛心（距岛心 ≤ r-0.6：孵出来的词宠不会站在边缘掉下去）
    const ea = rng() * Math.PI * 2, ed = Math.min(ir - 0.9, rng() * ir * 0.5);
    out.eggSpots.push({ x: cx + lx + Math.cos(ea) * ed, z: cz + lz + Math.sin(ea) * ed, y: top, isle: i });
  });
  const isleAt = (i) => out.isles[i];
  const mini = isleAt(SKY.CHAIN.length - 1);

  /* ---- 3. 岛与岛之间的四种连法：跳过去 / 木桥相连 / 浮云踏板 / 弹簧跳板 ---------- */
  const linkGeom = (a, b, type) => {
    const dx = b.lx - a.lx, dz = b.lz - a.lz;
    const d = Math.hypot(dx, dz);
    const gap = +(d - a.r - b.r).toFixed(2);
    if (type === 'jump') return { gap };
    if (type === 'bridge') {
      const n = Math.max(2, Math.round(d / 1.9));
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        const py = a.top + (b.top - a.top) * f;
        pts.push({ x: a.lx + dx * f, y: py, z: a.lz + dz * f });
        addP(a.lx + dx * f, a.lz + dz * f, 1.05, py);
      }
      const mesh = makeWalkway(pts);
      grp.add(mesh);
      return { gap, mesh, planks: n + 1 };
    }
    if (type === 'pads') {   // 两块会浮的云踏板：跳穿了也能落上去，不挡路
      const pads = [];
      for (let k = 1; k <= 2; k++) {
        const f = k / 3;
        const px = a.lx + dx * f, pz = a.lz + dz * f, py = a.top + (b.top - a.top) * f;
        const mesh = PROPS.cloud(1.2);
        mesh.position.set(px, py - 0.55, pz);
        mesh.traverse((q) => { if (q.isMesh) { q.material.transparent = true; q.material.opacity = 0.82; q.castShadow = false; } });
        grp.add(mesh);
        const pf = { x: cx + px, z: cz + pz, r: 1.5, top: py, amp: SKY.PAD_AMP, phase: k * 2.1, mesh, baseY: py - 0.55, isle: -1 };
        out.pads.push(pf);
        pads.push(pf);
      }
      return { gap, pads };
    }
    // spring：岛沿一只弹簧蘑菇 —— 弹 3.9 米 + 二段跳还有余量，正好够到高一层的小岛
    const f = (a.r + 0.95) / d;
    const mx = a.lx + dx * f, mz = a.lz + dz * f;
    const mesh = makeMushroom();
    mesh.position.set(mx, a.top, mz);
    noShadow(mesh);
    grp.add(mesh);
    addB(mx, mz, 0.62, a.top + 0.8, a.top);
    return { gap, mesh, x: cx + mx, z: cz + mz, top: a.top + 0.8 };
  };
  const TYPES = ['jump', 'bridge', 'pads', 'spring'];
  for (let i = 0; i < out.isles.length - 1; i++) {
    out.links.push({ a: i, b: i + 1, type: TYPES[i % TYPES.length], ...linkGeom(isleAt(i), isleAt(i + 1), TYPES[i % TYPES.length]) });
  }

  /* ---- 4. 通道①：云梯跳（地面 → 主岛）--------------------------------------------
     绕主岛外侧一圈螺旋上行的矮云：每级抬 1.4 米、水平挪 ~1.5 米（农场云梯是 1.3/2.2，都跳得上去）。
     螺旋只占"既没有栈桥、也没有气流柱、也没有下一座岛"的那段角度 → 三样东西互不打架。 */
  {
    const main = isleAt(0);
    const R = main.r + 2.2, n = 10;
    for (let k = 0; k < n; k++) {
      const a = ca + SPIRAL_FROM + (k / (n - 1)) * SPIRAL_SPAN;
      const px = main.lx + Math.cos(a) * R, pz = main.lz + Math.sin(a) * R;
      const top = SKY.PAD_H * (k + 1) + 0.4;
      const mesh = PROPS.cloud(1.3);
      mesh.position.set(px, top - 0.6, pz);
      mesh.traverse((q) => { if (q.isMesh) { q.material.transparent = true; q.material.opacity = 0.84; q.castShadow = false; } });
      grp.add(mesh);
      out.pads.push({ x: cx + px, z: cz + pz, r: SKY.PAD_R, top, amp: SKY.PAD_AMP, phase: k * 1.7, mesh, baseY: top - 0.6, isle: -1 });
      out.stairs.push({ x: cx + px, z: cz + pz, top, k: k + 1 });
    }
  }

  /* ---- 5. 通道②：上升气流（地面光圈 → 顶上云台；从云台走进气流就飘下来）------------ */
  {
    const main = isleAt(0);
    const liftD = main.r + 4.0;
    // 气柱放在**切线另一侧**（-t 方向）：径向那侧是城墙栈桥、+t 那侧是岛链，只有这里空着
    const colX = main.lx - ux * liftD, colZ = main.lz - uz * liftD;
    const top = main.top;
    // 顶部落脚云台**偏一格**放在气柱边上：站上去往柱心走一步就掉进气柱，开始缓降
    const padX = colX + ux * 2.0, padZ = colZ + uz * 2.0;
    const cloud = PROPS.cloud(1.5);
    cloud.position.set(padX, top - 0.6, padZ);
    cloud.traverse((q) => { if (q.isMesh) { q.material.transparent = true; q.material.opacity = 0.85; q.castShadow = false; } });
    grp.add(cloud);
    out.pads.push({ x: cx + padX, z: cz + padZ, r: 1.5, top, amp: SKY.PAD_AMP * 0.8, phase: 1.1, mesh: cloud, baseY: top - 0.6, isle: -1 });
    // 地面光圈 + 一圈花：地上看得见、走得到的入口
    const ring = new THREE.Mesh(new THREE.TorusGeometry(SKY.LIFT_R * 0.72, 0.07, 8, 26),
      new THREE.MeshBasicMaterial({ color: '#BEE8FF', transparent: true, opacity: 0.85, fog: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(colX, 0.08, colZ);
    grp.add(ring);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const fp = PROPS.flowerpatch();
      fp.position.set(colX + Math.cos(a) * SKY.LIFT_R * 0.95, 0, colZ + Math.sin(a) * SKY.LIFT_R * 0.95);
      fp.scale.setScalar(0.7);
      noShadow(fp);
      grp.add(fp);
      out.decor.push(fp);
    }
    // 气流柱本体：几片半透明的风环（念对风车单词后由 game 层点亮 0.10 → 0.5）
    const winds = [];
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(SKY.LIFT_R * 0.9, SKY.LIFT_R * 1.05, 0.5, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      w.position.set(colX, 2.2 + i * (top - 2.2) / 5, colZ);
      grp.add(w);
      winds.push(w);
    }
    out.lift = { x: cx + colX, z: cz + colZ, r: SKY.LIFT_R, top, padX: cx + padX, padZ: cz + padZ, padTop: top, ring, winds, lit: false };
  }

  /* ---- 6. 通道④：从长城马道架栈桥（地面 → 马道 → 阶梯栈桥 → 平桥 → 主岛）--------- */
  {
    const main = isleAt(0);
    const wd = wallD(rx, rz) - 2.6;
    const wx = rx * wd, wz = rz * wd;                     // 墙根内侧：三级木台登上马道
    const steps = [1.0, 2.0, 3.02];
    const tow = steps.map((top, k) => {
      const f = 0.55 - k * 0.55;
      const px = wx + rx * f, pz = wz + rz * f;
      addP(px, pz, 1.1, top);
      return { x: px, y: top / 2, z: pz, sx: 2.2, sy: top, sz: 2.2 };
    });
    grp.add(instanced(new THREE.BoxGeometry(1, 1, 1), M('#A87551', { rough: 1 }), tow));
    // 栈桥：从马道往城里走，8 级台阶（每级抬 1.4 米、水平跑 ~1.59 米）一路接到主岛岛沿。
    // 主岛离墙根 20.7 米（WALL_GAP）正是按这 8 级台阶的"水平跑"倒推出来的：
    // 距离恒定 → 每级的水平间距恒定，不随城大小变化。
    const [sx0, sz0] = [wx - rx * 0.55, wz - rz * 0.55];
    const ex = main.lx + rx * (main.r + 1.2), ez = main.lz + rz * (main.r + 1.2);
    const dx = ex - sx0, dz = ez - sz0;
    const dist = Math.hypot(dx, dz);
    const vx = dx / dist, vz = dz / dist;
    const riseN = 8;
    const runStep = dist / riseN;
    const pts = [{ x: sx0, y: 3.02, z: sz0 }];
    const deck = [{ x: cx + sx0, y: 3.02, z: cz + sz0 }];
    let xx = sx0, zz = sz0, yy = 3.02;
    for (let k = 0; k < riseN; k++) {
      xx += vx * runStep; zz += vz * runStep; yy += SKY.PAD_H;
      pts.push({ x: xx, y: yy, z: zz });
      addP(xx, zz, 1.05, yy);
      deck.push({ x: cx + xx, y: yy, z: cz + zz });
    }
    grp.add(makeWalkway(pts));
    // 桥墩：每 3 档一根落地木柱（十几米高的栈桥悬在空中才不像贴纸）
    const posts = [];
    for (let k = 2; k < pts.length; k += 3) {
      const p = pts[k];
      if (p.y < 4.4) continue;
      posts.push({ x: p.x, y: p.y / 2, z: p.z, sx: 0.34, sy: p.y, sz: 0.34 });
    }
    if (posts.length) grp.add(instanced(new THREE.BoxGeometry(1, 1, 1), M('#8A6844', { rough: 1 }), posts));
    out.wall = { x: cx + wx, z: cz + wz, top: 3.02, topY: yy, planks: pts.length, len: +dist.toFixed(1), riseN, deck };
  }

  /* ---- 7. 岛上的内容：装饰 / 风车 / 旗 / 采点 / 动物 --------------------------------- */
  // prop 挂到岛体组里：岛组已抬到 (lx, top, lz)，所以 prop 用"相对岛面"的局部坐标
  // 岛上的小装饰（树/路灯/栅栏/花丛/动物）：全收进 out.decor —— 人离岛链远时整组隐藏。
  // 这不是省那几十个 draw call，而是省**六个字的帧率预算**：见 game._updateSky 的 _skyDecorNear。
  const propOn = (isle, prop, ang, dR, ry = 0, sc = 1) => {
    prop.position.set(Math.cos(ang) * dR, 0, Math.sin(ang) * dR);
    prop.rotation.y = ry;
    prop.scale.setScalar(sc);
    noShadow(prop);
    isle.mesh.add(prop);
    out.decor.push(prop);
    return prop;
  };
  {
    const main = isleAt(0);
    propOn(main, PROPS.tree(true), 0.9, main.r * 0.5, 0.4);                       // 主岛一棵树
    // 两盏路灯：岛上唯一的暖光（灯头自发光，夜里也看得见；不投影见 noShadow 的注释）
    for (const a of [2.5, 5.0]) propOn(main, PROPS.streetLamp(), a, main.r * 0.72, a + Math.PI);
    for (let i = 0; i < 3; i++) {                                                 // 一圈矮栅栏（3 段就够读成"围起来的院子"）
      const a = i / 3 * Math.PI * 2 + 0.3;
      propOn(main, PROPS.fence(), a, main.r * 0.86, a + Math.PI / 2, 0.9);
    }
    const mill = PROPS.windmill();                                                // 风车：念对单词后转起来
    const ma = 5.7;
    mill.position.set(main.lx + Math.cos(ma) * main.r * 0.46, main.top, main.lz + Math.sin(ma) * main.r * 0.46);
    noShadow(mill);
    grp.add(mill);
    out.mill = {
      x: cx + mill.position.x, z: cz + mill.position.z, y: main.top, isle: 0,
      blades: mill.userData.blades, group: mill, spun: 0, solved: false,
    };
  }
  [1, 2, 3].forEach((i, k) => {
    const it = isleAt(i);
    const dec = k === 0 ? PROPS.pine(1.1) : k === 1 ? PROPS.rock(1.0) : PROPS.bush(1.2);
    propOn(it, dec, 1.2 + k * 1.1, it.r * 0.5, k * 1.4);
    propOn(it, PROPS.flowerpatch(), 3.6 + k * 0.9, it.r * 0.6, 0, 0.9);
    if (i === 3) {   // 末位主岛：旗杆（念对单词后升起城市色的旗）
      const fl = makeFlag();
      const fa = 5.2;
      fl.position.set(it.lx + Math.cos(fa) * it.r * 0.42, it.top, it.lz + Math.sin(fa) * it.r * 0.42);
      noShadow(fl);
      grp.add(fl);
      out.flag = { x: cx + fl.position.x, z: cz + fl.position.z, y: it.top, isle: i, mesh: fl, cloth: fl.userData.cloth, color, solved: false };
    }
  });
  {   // 小岛（链末端）：宝箱 —— 只有踩末位主岛的弹簧蘑菇才够得着
    const ch = makeChest();
    ch.position.set(mini.lx, mini.top, mini.lz);
    noShadow(ch);
    grp.add(ch);
    out.chest = { x: cx + mini.lx, z: cz + mini.lz, y: mini.top, isle: mini.idx, mesh: ch, lid: ch.userData.lid, opened: false };
  }
  [1, 2, 3].forEach((i, k) => {   // 采点：果子 / 花，每城 3 处、落在不同的岛上
    const it = isleAt(i);
    const a = 2.1 + k * 2.0;
    const berry = k !== 1;
    const mesh = berry ? makeBerry() : PROPS.flowerpatch();
    const px = it.lx + Math.cos(a) * it.r * 0.55, pz = it.lz + Math.sin(a) * it.r * 0.55;
    mesh.position.set(px, it.top, pz);
    if (!berry) mesh.scale.setScalar(1.15);
    noShadow(mesh);
    grp.add(mesh);
    out.forage.push({ idx: k, x: cx + px, z: cz + pz, y: it.top, kind: berry ? 'berry' : 'flower', mesh, isle: i });
  });
  {   // 动物：海鸥绕主岛飞、蝴蝶绕花丛、蒲公英（走过就吹散）
    const main = isleAt(0);
    for (let i = 0; i < 1; i++) {
      const gu = PROPS.gull();
      gu.userData.center = [main.lx, main.lz];
      gu.userData.radius = main.r * (0.8 + i * 0.45);
      gu.userData.height = main.top + 2.6 + i * 1.2;
      gu.userData.phase = i * 2.4;
      gu.scale.setScalar(0.7);
      noShadow(gu);
      grp.add(gu);
      out.anim.gulls.push(gu);
      out.decor.push(gu);
    }
    for (let i = 0; i < 2; i++) {
      const it = isleAt(1 + i);
      const bf = PROPS.butterfly(['#FF8FB0', '#FFD166'][i % 2]);
      bf.userData.center = [it.lx + it.r * 0.4, it.lz + it.r * 0.2];
      bf.userData.home = [it.lx + it.r * 0.4, it.lz + it.r * 0.2];
      bf.userData.phase = i * 1.7;
      bf.userData.y = it.top;
      noShadow(bf);
      grp.add(bf);
      out.anim.butterflies.push(bf);
      out.decor.push(bf);
    }
    for (let i = 0; i < 3; i++) {
      const it = isleAt(i + 1);
      const d = makeDandelion();
      const a = 4.1 + i * 0.6;
      const px = it.lx + Math.cos(a) * it.r * 0.4, pz = it.lz + Math.sin(a) * it.r * 0.4;
      d.position.set(px, it.top, pz);
      noShadow(d);
      grp.add(d);
      out.decor.push(d);
      out.anim.dandelions.push({ mesh: d, vx: 1, vz: 1, x: cx + px, z: cz + pz, y: it.top, blown: 0 });
    }
  }

  /* ---- 8. 远景群山：给"高处"一个纵深 ---------------------------------------------- */
  grp.add(makeMountains(r, rng, fogColor));

  return out;
}

// 从城心沿 (dx,dz) 走到轮廓边界的距离（局部坐标）。没有轮廓时返回 1e9，由调用方退回 r。
function wallDist(poly, dx, dz) {
  if (!poly || poly.length < 3) return 1e9;
  let best = 1e9;
  for (let i = 0, j = poly.length - 2; i < poly.length - 1; j = i++) {
    const x1 = poly[i][0], z1 = poly[i][1], x2 = poly[j][0], z2 = poly[j][1];
    const ex = x2 - x1, ez = z2 - z1;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (x1 * ez - z1 * ex) / den;          // 射线参数（从原点出发）
    const u = (x1 * dz - z1 * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}
