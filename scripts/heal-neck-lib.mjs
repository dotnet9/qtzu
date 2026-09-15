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
