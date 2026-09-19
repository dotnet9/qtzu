// 城市轮廓窄颈修复：把「可玩区被窄颈切断」的轮廓加宽到可通行。
// 背景：玩家被钳在离边界 ≥ margin（墙厚+身位）的区域内；若轮廓某处颈部窄于
// 2×margin，该区域的腐蚀结果会断成两块，小人过不去（另一侧的蛋/立牌成死区）。
// 算法：边界顶点间的「最小间距松弛」——对环上弧距足够远、欧氏距离 < W 的顶点对
// 沿连线互相推开，迭代收敛；细颈被撑宽到 W，细海湾同时被填窄（陆 地 更 连 贯）。
// 坐标为归一化 [-1,1]（与 city-shape-data.js 一致），W 为同尺度下的目标通行宽。

// 逐城目标通行宽（归一化）：与 world/game 的钳制边距同源
// margin = max(1.2, r*0.035) + 0.5，r = radius × 内容系数 × 0.84；W = 1.15 × 2×margin / r
export function healWidthForCity({ radius = 28, contents = 0, cityScale = 0.84 }) {
  const r = Math.round(radius * (3 + Math.min(1.3, contents * 0.012)) * cityScale);
  const margin = Math.max(1.2, r * 0.035) + 0.5;
  return (1.15 * 2 * margin) / r;
}

// 窄颈修复主函数：pts 为闭合环（首=尾），返回新数组（不改动入参）
export function healNecks(pts, W) {
  const n = pts.length - 1;                    // 去掉重复的闭合点
  if (n < 8 || !(W > 0)) return pts;
  // 弧长前缀和：判断两点是否属于「同一小段边界」（细颈两岸的弧距必然绕远）
  const arc = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) arc[i + 1] = arc[i] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const total = arc[n];
  const arcSep = (i, j) => {
    const d = Math.abs(arc[i] - arc[j]);
    return Math.min(d, total - d);
  };
  const ARC_WIN = 2.5 * W;                     // 弧距小于此视为同一段边界（邻点/发卡弯），不推

  // 射线法内点判定（闭多边形，允许不闭合的临时数组）
  const inside = (poly, x, z) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
    }
    return hit;
  };
  // 两顶点的连线是否主要穿过多边形内部：是 → 细「颈」（陆地太窄）才需要撑宽；
  // 否则是细「海湾」（中间是海），不挡路，推了只会白白改海岸线
  const acrossLand = (a, b) => {
    let inN = 0;
    for (const t of [0.3, 0.5, 0.7]) if (inside(p, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) inN++;
    return inN >= 2;
  };

  const p = pts.slice(0, n).map(q => [q[0], q[1]]);
  const PUSH = 0.4;                            // 每轮单侧推开比例（×2 侧），大了一会抖
  for (let round = 0; round < 60; round++) {
    // 空间网格：只查欧氏距离 W 内的顶点对
    const cell = W;
    const grid = new Map();
    const key = (i, j) => i * 100000 + j;
    for (let i = 0; i < n; i++) {
      const gx = Math.floor(p[i][0] / cell), gz = Math.floor(p[i][1] / cell);
      const k = key(gx, gz);
      (grid.get(k) || grid.set(k, []).get(k)).push(i);
    }
    let moved = 0;
    const delta = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const gx = Math.floor(p[i][0] / cell), gz = Math.floor(p[i][1] / cell);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const bucket = grid.get(key(gx + ox, gz + oz));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const dx = p[i][0] - p[j][0], dz = p[i][1] - p[j][1];
          const d = Math.hypot(dx, dz);
          if (d >= W || d < 1e-9) continue;
          if (arcSep(i, j) < ARC_WIN) continue;   // 同一段边界（邻点/发卡弯）不推
          if (!acrossLand(p[i], p[j])) continue;  // 中间是海（细海湾）不推
          const push = ((W - d) / 2) * PUSH;
          const ux = dx / d, uz = dz / d;
          delta[i * 2] += ux * push; delta[i * 2 + 1] += uz * push;
          delta[j * 2] -= ux * push; delta[j * 2 + 1] -= uz * push;
          moved = Math.max(moved, push);
        }
      }
    }
    if (moved < 1e-4) break;
    for (let i = 0; i < n; i++) { p[i][0] += delta[i * 2]; p[i][1] += delta[i * 2 + 1]; }
    // 轻度 Laplacian 平滑（只混一点点，保持高保真轮廓），防止逐点推挤出锯齿
    for (let i = 0; i < n; i++) {
      const a = p[(i + n - 1) % n], b = p[(i + 1) % n];
      p[i][0] += 0.18 * (a[0] + b[0] - 2 * p[i][0]) * 0.5;
      p[i][1] += 0.18 * (a[1] + b[1] - 2 * p[i][1]) * 0.5;
    }
  }
  p.push([p[0][0], p[0][1]]);
  // 精度与生成脚本一致（3 位小数）
  return p.map(([x, z]) => [Math.round(x * 1000) / 1000, Math.round(z * 1000) / 1000]);
}

/* ================= 可玩区连通性判定（生成器与审计脚本共用同一份实现） =================
   为什么必须共用：修复是在**高模**上做的，而运行时钳制与判连通用的是 simplifyPoly 的**低模**；
   简化会重新掐细已被撑开的颈部——这就是"修了 N 城还是断开"的原因。
   所以判定必须按运行时口径来。

   ★ 判定阈值取 floor 而不是 margin：js/game.js:_clampCityPos 把玩家钳到离边 ≥ margin(1.42)，
   但挤不出 margin 时只要离边 ≥ floor(默认 0.5) 就**就地放行**（细颈里贴着墙缝也能过），
   只有连 floor 都不够才朝内极点找位置。所以"走得过去"的条件是 d ≥ floor，
   用 margin 判会把大量可通行的细颈误判成切断（这正是旧审计报 7 城的原因）。 */
import { simplifyPoly, polyInside, polyNearest } from '../js/city-shape.js';

export const CITY_SCALE = 0.84;
export const PLAYER_EXTRA = 0.5;                       // game._cityWallMargin(st) 的 extra 默认值
export const WALL_MARGIN = 1.42;                       // game._cityWallMargin 的固定返回值
export const WALK_FLOOR = 0.5;                         // _clampCityPos 的 floor 默认值：能站住的下限
// 判定为"真死区"的最小面积（世界单位²）：约 2.5×2.5，才塞得下一个蛋(r≈1.2)+可达空间。
// 更小的碎块（1~3 单位² 的 1×1 栅格）是栅格化噪声，既放不下东西也不值得为此改动轮廓。
export const MIN_POCKET = 6;

// 网格 BFS：open(x,z) = 在（低模）轮廓内 且 离边界 ≥ floor（= 能站住）
export function playableComponents(ptsNorm, radius, contents, step = 1.0, floor = WALK_FLOOR) {
  const r = Math.round(radius * (3 + Math.min(1.3, contents * 0.012)) * CITY_SCALE);
  const pts = simplifyPoly(ptsNorm.map(([x, z]) => [x * r, z * r]), 0.1);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const nx = Math.ceil((maxX - minX) / step) + 1, nz = Math.ceil((maxZ - minZ) / step) + 1;
  const lab = new Int32Array(nx * nz).fill(-1);
  const comps = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const id = i * nz + j;
    if (lab[id] >= 0) continue;
    const x = minX + i * step, z = minZ + j * step;
    if (!polyInside(pts, x, z) || polyNearest(pts, x, z).d < floor) { lab[id] = -2; continue; }
    const q = [id]; lab[id] = comps.length;
    const cells = [];
    while (q.length) {
      const cur = q.pop(); cells.push(cur);
      const ci = Math.floor(cur / nz), cj = cur % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const nid = ni * nz + nj;
        if (lab[nid] >= 0) continue;
        const px = minX + ni * step, pz = minZ + nj * step;
        if (!polyInside(pts, px, pz) || polyNearest(pts, px, pz).d < floor) { lab[nid] = -2; continue; }
        lab[nid] = comps.length; q.push(nid);
      }
    }
    comps.push({ cells });
  }
  comps.sort((a, b) => b.cells.length - a.cells.length);
  const main = comps[0] ? comps[0].cells.length : 0;
  const total = comps.reduce((s, c) => s + c.cells.length, 0);
  // 真死区：丢掉 1×1 栅格碎屑后仍有内容的碎块
  const pockets = comps.slice(1).filter(c => c.cells.length * step * step >= MIN_POCKET);
  const lost = pockets.reduce((s, c) => s + c.cells.length, 0) * step * step;
  return {
    r, margin: WALL_MARGIN, floor, step,
    comps: comps.length, pockets: pockets.length,          // comps=全部碎块（含噪声），pockets=真死区
    mainPct: total ? main / total * 100 : 100,
    lostArea: (total - main) * step * step,                // 含噪声的原始死区面积
    pocketArea: lost,                                      // 只算真死区
    main, total,
  };
}

// 闭环修复：先看原始轮廓有没有真死区，没有就**原样返回**（不推点）；
// 有才按 W0 修一次 → 按运行时口径验连通 → 不通过就逐级加大 W 重来。
// 为什么先判再修：healNecks 对"本来就没问题"的城也会轻微推点，会让 27 城的轮廓无谓变动
// （还会碰坏既有摆位，例如西安某大学与牌子的间距）。
export function healUntilConnected(ptsNorm, radius, contents, { maxTries = 6, log = null, id = '' } = {}) {
  const before = playableComponents(ptsNorm, radius, contents);
  if (before.pockets === 0) return { pts: ptsNorm, W: 0, tries: 0, info: before, changed: false };
  const W0 = healWidthForCity({ radius, contents });
  let best = null;
  for (let t = 1; t <= maxTries; t++) {
    const W = W0 * (1 + 0.3 * (t - 1));                 // 1.0 / 1.3 / 1.6 / 1.9 / 2.2 / 2.5 倍
    const healed = healNecks(ptsNorm, W);
    const info = playableComponents(healed, radius, contents);
    if (!best || info.pockets < best.info.pockets || (info.pockets === best.info.pockets && info.pocketArea < best.info.pocketArea)) {
      best = { pts: healed, W, tries: t, info, changed: true };
    }
    if (info.pockets === 0) {
      if (log) log.push(`${id} 窄颈: W×${(1 + 0.3 * (t - 1)).toFixed(1)} 修好(原 W=${W0.toFixed(3)}, 原死区 ${before.pocketArea.toFixed(1)}u²)`);
      return best;
    }
  }
  if (log) log.push(`${id} 窄颈: ${maxTries} 次后仍有 ${best.info.pockets} 处死区(${best.info.pocketArea.toFixed(1)}u²，原 ${before.pocketArea.toFixed(1)}u²)`);
  return best;
}
