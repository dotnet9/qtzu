// 城市轮廓：level.shape 优先（city.json 可配），其次真实边界（city-shape-data.js，
// 由 scripts/gen-city-shapes.mjs 从阿里 DataV 行政边界生成），
// 再退内置简笔轮廓，都没有则按城市 id 生成有机多边形（带海湾/半岛起伏，绝不再是正圆）。
// 坐标为归一化 [-1,1]，world/game 层乘以 level.radius 还原为世界坐标。
import { CITY_SHAPES } from './city-shape-data.js';

// 重点城市简笔轮廓（示意化真实边界，顺时针闭合）
const SHAPES = {
  beijing: [[0.05,1],[0.5,0.9],[0.85,0.6],[1,0.15],[0.8,-0.3],[0.9,-0.7],[0.5,-0.95],[0,-0.85],[-0.5,-1],[-0.85,-0.6],[-0.7,-0.15],[-1,0.2],[-0.8,0.6],[-0.4,0.8],[-0.1,1],[0.05,1]],
  shanghai: [[0.7,0.9],[1,0.4],[0.85,-0.1],[0.95,-0.6],[0.5,-0.9],[0.1,-0.7],[-0.1,-0.9],[-0.6,-0.7],[-0.8,-0.2],[-0.6,0.2],[-0.9,0.55],[-0.5,0.9],[-0.1,0.7],[0.3,0.85],[0.7,0.9]],
  chongqing: [[-0.9,0.5],[-0.5,0.85],[0,0.6],[0.4,0.9],[0.85,0.6],[1,0.1],[0.6,-0.2],[0.9,-0.6],[0.4,-0.9],[0,-0.6],[-0.4,-0.9],[-0.8,-0.55],[-0.6,-0.1],[-1,-0.3],[-0.95,0.15],[-0.9,0.5]],
  chengdu: [[0.55,0.85],[0.95,0.45],[0.8,0.05],[1,-0.35],[0.6,-0.8],[0.1,-0.7],[-0.35,-0.95],[-0.8,-0.6],[-0.65,-0.15],[-0.95,0.25],[-0.6,0.65],[-0.15,0.55],[0.2,0.9],[0.55,0.85]],
  guangzhou: [[-0.85,0.6],[-0.4,0.9],[0.05,0.65],[0.45,0.95],[0.85,0.6],[1,0.15],[0.6,-0.1],[0.8,-0.55],[0.35,-0.85],[-0.1,-0.6],[-0.5,-0.9],[-0.9,-0.5],[-0.7,0],[-0.95,0.3],[-0.85,0.6]],
  hangzhou: [[0.6,0.9],[1,0.5],[0.8,0.05],[0.95,-0.4],[0.55,-0.85],[0.05,-0.65],[-0.4,-0.9],[-0.8,-0.5],[-0.6,0],[-0.9,0.4],[-0.5,0.8],[-0.05,0.6],[0.3,0.9],[0.6,0.9]],
  wuhan: [[-1,0.35],[-0.6,0.7],[-0.2,0.5],[0.25,0.9],[0.7,0.65],[1,0.2],[0.7,-0.2],[0.9,-0.65],[0.45,-0.9],[0,-0.6],[-0.45,-0.85],[-0.85,-0.5],[-0.55,-0.05],[-0.85,0],[-1,0.35]],
  xian: [[0.15,0.95],[0.6,0.8],[0.9,0.4],[0.75,0],[1,-0.4],[0.55,-0.85],[0.1,-0.65],[-0.35,-0.9],[-0.8,-0.55],[-0.65,-0.1],[-0.95,0.3],[-0.55,0.7],[-0.1,0.55],[0.15,0.95]],
  lanzhou: [[-1,0.25],[-0.6,0.45],[-0.2,0.25],[0.25,0.5],[0.7,0.3],[1,0.45],[0.85,-0.05],[0.5,-0.3],[0.7,-0.7],[0.25,-0.5],[-0.2,-0.7],[-0.65,-0.45],[-0.45,-0.05],[-0.75,-0.25],[-1,0.25]],
  taipei: [[0.3,0.85],[0.75,0.6],[0.95,0.1],[0.65,-0.3],[0.85,-0.7],[0.35,-0.9],[-0.1,-0.6],[-0.5,-0.85],[-0.85,-0.4],[-0.6,0],[-0.9,0.45],[-0.45,0.8],[0,0.6],[0.3,0.85]],
};

// 台湾 4 城（DataV 无子级边界）：示意化县市轮廓，见 TW
const TW_SHAPES = {
  taipei: [[0.2,0.75],[0.6,0.8],[0.9,0.45],[0.8,0.05],[0.95,-0.35],[0.6,-0.7],[0.15,-0.8],[-0.3,-0.6],[-0.7,-0.75],[-0.9,-0.3],[-0.6,0.1],[-0.85,0.5],[-0.4,0.75],[-0.05,0.55],[0.2,0.75]],
  kaohsiung: [[-0.3,0.85],[0.2,0.75],[0.6,0.9],[0.9,0.5],[0.7,0.1],[0.85,-0.3],[0.5,-0.65],[0.05,-0.9],[-0.4,-0.75],[-0.75,-0.4],[-0.55,0.05],[-0.8,0.45],[-0.3,0.85]],
  taichung: [[-0.15,0.9],[0.35,0.85],[0.75,0.6],[0.9,0.15],[0.6,-0.1],[0.8,-0.5],[0.4,-0.85],[-0.05,-0.65],[-0.15,-0.9],[-0.55,-0.7],[-0.4,-0.3],[-0.75,0],[-0.5,0.4],[-0.6,0.7],[-0.15,0.9]],
  tainan: [[0.1,0.8],[0.55,0.75],[0.85,0.4],[0.95,-0.05],[0.7,-0.45],[0.3,-0.7],[-0.15,-0.8],[-0.55,-0.6],[-0.8,-0.2],[-0.65,0.2],[-0.85,0.55],[-0.45,0.8],[-0.05,0.6],[0.1,0.8]],
};

function blob(id) {
  // 有机多边形：同一城市形状固定（seed=id），带起伏绝非正圆
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const lobN = 3 + Math.floor(rand() * 2);
  const lobes = [];
  for (let i = 0; i < lobN; i++) lobes.push({ f: 1 + Math.floor(rand() * 3), amp: 0.12 + rand() * 0.2, ph: rand() * Math.PI * 2 });
  const pts = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = 0.85;
    for (const L of lobes) r += L.amp * Math.sin(a * L.f + L.ph);
    r = Math.max(0.6, Math.min(1.05, r));
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  pts.push([pts[0][0], pts[0][1]]);
  return pts;
}

export function getCityShape(cityId, levelShape) {
  if (Array.isArray(levelShape) && levelShape.length > 5) {
    const p = levelShape.map(pt => [+pt[0] || 0, +pt[1] || 0]);
    if (Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) > 1e-4) p.push([p[0][0], p[0][1]]);
    return p;
  }
  return CITY_SHAPES[cityId] || SHAPES[cityId] || TW_SHAPES[cityId] || blob(cityId);
}

// ===== 共享几何工具：world.js（摆放元素）与 game.js（玩家/NPC 碰撞）用同一套，
// 保证院墙、石台、蛋、小人钳的是同一条边界 =====

// 点是否在闭合多边形内（射线法；pts 末点=首点）
export function polyInside(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// 多边形边界上离点最近的位置：{ qx, qz, d, ax, az, bx, bz }（d 为欧氏距离，含所在线段）
export function polyNearest(pts, x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    const qx = ax + ex * t, qz = az + ez * t;
    const d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < bd) { bd = d; best = [qx, qz, ax, az, bx, bz]; }
  }
  if (!best) return { qx: x, qz: z, d: 0, ax: x, az: z, bx: x, bz: z };
  const [qx, qz, ax, az, bx, bz] = best;
  return { qx, qz, d: Math.sqrt(bd), ax, az, bx, bz };
}

// 线段的内法线（指向多边形内部那一侧）：在 q 点向法线方向探 0.5 判内外
function inwardNormal(pts, q) {
  let nx = -(q.bz - q.az), nz = q.bx - q.ax;
  const l = Math.hypot(nx, nz) || 1;
  nx /= l; nz /= l;
  if (!polyInside(pts, q.qx + nx * 0.5, q.qz + nz * 0.5)) { nx = -nx; nz = -nz; }
  return [nx, nz];
}

// 多边形的「内极点」：离边界最远的内部点（polylabel 的网格近似）。
// 凹形/破碎轮廓（无锡的原点在城外、深圳的原点贴着海湾边）不能拿原点当"城心"，
// 收缩/兜底都改朝这个点走。按 pts 数组引用缓存：同一城市只算一次。
const _poleCache = new WeakMap();
function polyPole(pts) {
  let pole = _poleCache.get(pts);
  if (pole) return pole;
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  let best = [0, 0, 0];
  const N = 32;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = minX + (maxX - minX) * i / N, z = minZ + (maxZ - minZ) * j / N;
      if (!polyInside(pts, x, z)) continue;
      const d = polyNearest(pts, x, z).d;
      if (d > best[2]) best = [x, z, d];
    }
  }
  _poleCache.set(pts, best);
  return best;
}

// 把点钳进多边形，并保证离边界至少 margin（0 = 只保证在多边形内）。
// 旧版「投影到边再 ×0.97」对凹多边形不可靠：0.97 是向原点收缩，窄处/凹湾处可能仍在墙外。
// 现在：外部点先朝内极点逐级收缩进城（避免被投影到湖面小岛之类的细碎飞地上），再从
// 内侧沿「最近边点 → 当前点」方向补足 margin；一侧推够另一侧可能变最近，多轮交替
// 收敛，推过头（凹角/窄缝）就折半步长；窄域里实在放不下 margin 时，沿当前点→内极点
// 方向找最近的可行位（内极点必在主城深处）。
export function clampPoly(pts, x, z, margin = 0) {
  const [poleX, poleZ] = polyPole(pts);
  if (!polyInside(pts, x, z)) {
    let f = 0.97, inside = false;
    for (let i = 0; i < 64; i++, f *= 0.97) {
      const tx = poleX + (x - poleX) * f, tz = poleZ + (z - poleZ) * f;
      if (polyInside(pts, tx, tz)) { x = tx; z = tz; inside = true; break; }
    }
    if (!inside) { x = poleX; z = poleZ; }   // 畸形轮廓的兜底：内极点必在城里
  }
  if (margin > 0) {
    let ok = false;
    for (let k = 0; k < 10; k++) {
      const q = polyNearest(pts, x, z);
      if (q.d >= margin) { ok = true; break; }
      let nx, nz;
      if (q.d > 1e-5) { nx = (x - q.qx) / q.d; nz = (z - q.qz) / q.d; }
      else { [nx, nz] = inwardNormal(pts, q); }
      let step = margin - q.d, moved = false;
      for (let s = 0; s < 4 && step > 1e-4; s++) {
        const tx = x + nx * step, tz = z + nz * step;
        if (polyInside(pts, tx, tz)) { x = tx; z = tz; moved = true; break; }
        step *= 0.5;   // 前方是凹角/窄缝：减半步长，能推多少推多少
      }
      if (!moved) break;
    }
    if (!ok) {
      // 窄域/离岛碎片里推不满边距：朝内极点方向找最近的可行位（离当前点越近越好）
      for (let t = 0.05; t <= 0.95; t += 0.05) {
        const fx = x + (poleX - x) * t, fz = z + (poleZ - z) * t;
        if (polyInside(pts, fx, fz) && polyNearest(pts, fx, fz).d >= margin) { x = fx; z = fz; break; }
      }
    }
  }
  return [x, z];
}
