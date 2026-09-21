// 地形生成/体检的共享工具（Node 侧，仅脚本使用；游戏运行时只依赖 js/terrain-field.js）
//
// 三件事必须共用同一份实现，否则"生成时以为对、上岛才发现错"：
//   1) 城市尺度 radiusOf —— 与 js/game.js:111 的 rr 公式同源
//   2) 轮廓贴合 fitToShape —— 把"山在西、河贯城"的意图落到真实轮廓内的安全区
//   3) 体检 auditCity —— 起伏率/实高/出界/广场冲突，与 scripts/audit-terrain.mjs 同一口径
import { readFileSync, readdirSync, existsSync } from 'fs';
import { getCityShape, polyInside } from '../js/city-shape.js';
import { makeHeightField } from '../js/terrain-field.js';

/* ================= 调色板（按气候带分化，6 级色带从低到高） ================= */
export const PALETTES = {
  RICH: [[0.49, 0.78, 0.47], [0.44, 0.72, 0.42], [0.38, 0.65, 0.37], [0.31, 0.56, 0.31], [0.26, 0.47, 0.27], [0.22, 0.40, 0.24]],
  GRASS: [[0.62, 0.74, 0.42], [0.58, 0.70, 0.39], [0.54, 0.66, 0.36], [0.50, 0.61, 0.33], [0.46, 0.56, 0.30], [0.42, 0.51, 0.27]],
  LOESS: [[0.78, 0.68, 0.42], [0.74, 0.63, 0.38], [0.70, 0.58, 0.34], [0.65, 0.53, 0.31], [0.60, 0.48, 0.28], [0.55, 0.44, 0.26]],
  PLATEAU: [[0.55, 0.62, 0.38], [0.50, 0.57, 0.35], [0.46, 0.52, 0.32], [0.42, 0.47, 0.29], [0.38, 0.42, 0.26], [0.34, 0.38, 0.24]],
  SAND: [[0.90, 0.80, 0.52], [0.88, 0.77, 0.48], [0.85, 0.73, 0.44], [0.82, 0.70, 0.41], [0.79, 0.66, 0.38], [0.76, 0.63, 0.35]],
  COLD: [[0.72, 0.80, 0.76], [0.67, 0.75, 0.72], [0.62, 0.70, 0.68], [0.57, 0.65, 0.63], [0.52, 0.60, 0.59], [0.47, 0.55, 0.55]],
  KARST: [[0.36, 0.66, 0.35], [0.32, 0.60, 0.32], [0.29, 0.54, 0.29], [0.26, 0.48, 0.27], [0.23, 0.42, 0.25], [0.20, 0.37, 0.23]],
  TROPIC: [[0.40, 0.74, 0.38], [0.36, 0.69, 0.36], [0.32, 0.63, 0.34], [0.28, 0.57, 0.31], [0.25, 0.51, 0.28], [0.22, 0.45, 0.26]],
};
export const TG = [[0.85, 0.70, 0.24], [0.72, 0.55, 0.19]];   // 梯田金
export const FW = [[0.94, 0.85, 0.35], [0.87, 0.74, 0.30]];   // 麦田黄
export const FS = [[0.93, 0.85, 0.60], [0.88, 0.78, 0.52]];   // 稻田/沙地浅色
export const ROCK = {
  WARM: [0.60, 0.55, 0.44], COOL: [0.52, 0.53, 0.50],
  LOESS: [0.68, 0.57, 0.36], KARST: [0.48, 0.52, 0.44],
};

/* ================= 构造小工具（GEO 表里用，读起来像地理描述） ================= */
export const mtn = (cx, cz, amp = 6, near = 0.18, far = 0.46, pow = 1.5) => ({ center: [cx, cz], near, far, pow, amp });
export const hill = (cx, cz, amp = 2.2, near = 0.13, far = 0.42) => ({ center: [cx, cz], near, far, pow: 1.5, amp });
export const ridge = (from, to, amp = 6, w = 0.26, pow = 1.4) => ({ from, to, amp, w, pow });  // 山脉：沿线段隆起
export const riv = (pts, w = null) => (w ? { pts, w } : pts);                                   // 单条河可单独定宽
export const lake = (x, z, rx = 7, rz = 5.5) => ({ at: [x, z], rx, rz });
export const terrace = (cx, cz, rx = 0.30, rz = 0.22) => ({ center: [cx, cz], rx, rz, cell: 5 });
export const farm = (cx, cz, r0 = 0.12, r1 = 0.26) => ({ center: [cx, cz], r0, r1 });

/* ================= 城市尺度与轮廓（与 game.js 同源） ================= */
export function cityIds() {
  return readdirSync('data/cities').filter(d => existsSync(`data/cities/${d}/city.json`));
}
export function readCity(id) { return JSON.parse(readFileSync(`data/cities/${id}/city.json`, 'utf8')); }

const CITY_SCALE = 0.84;                      // js/game.js:27
// 三个数组在 game 里来自独立文件（js/data.js:64-79 的 loadCityData 合并），
// 只读 city.json 的话它们恒为空 → 半径偏小（成都 76 vs 实际 87）、烘焙地面比城小一圈。
const jsonOf = (f) => { try { return JSON.parse(readFileSync(`data/cities/${f}`, 'utf8')); } catch { return null; } };
export function countsOf(id, city) {
  const pick = (field, file) => {
    const inline = city && city[field];
    if (Array.isArray(inline) && inline.length) return inline.length;
    const j = jsonOf(`${id}/${file}.json`);
    return ((j && (j.unis || j.items)) || []).length;
  };
  return pick('unis', 'universities') + pick('foods', 'foods') + pick('scenes', 'scenes');
}
export function radiusOf(id, city) {          // js/game.js:118 的同一公式
  const lv = city.level || {};
  const n = countsOf(id, city);
  return Math.round((lv.radius || 28) * (3 + Math.min(1.3, n * 0.012)) * CITY_SCALE);
}
export function normShapeOf(id, city) { return getCityShape(id, city.level && city.level.shape); }
export function worldPtsOf(id, city) {
  const rr = radiusOf(id, city);
  return normShapeOf(id, city).map(([x, z]) => [x * rr, z * rr]);
}
export function makeField(id, city, cfg) {
  return makeHeightField({ pts: worldPtsOf(id, city), cfg });
}

/* ================= 轮廓内极点（凹形城市不能拿原点当城心） ================= */
export function interiorPole(F, filter) {
  let best = [F.CX, F.CZ, -1];
  const N = 32;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = F.minX + (F.maxX - F.minX) * i / N, z = F.minZ + (F.maxZ - F.minZ) * j / N;
    if (!F.inPoly(x, z)) continue;
    if (filter && !filter(x, z)) continue;
    const d = F.dEdge(x, z);
    if (d > best[2]) best = [x, z, d];
  }
  if (best[2] >= 0) return best;
  if (filter) return interiorPole(F);                 // 过滤后无解：退回不过滤
  return [F.CX, F.CZ, 0];
}

// 安全锚点：城内最深处，但必须避开出生广场（广场压平 90%，地标放那儿等于没有）。
// 阈值逐级放宽：小城可能整个都在广场半径内，直接退回无过滤会让地标又落回广场上，
// 所以从"尽量避开"一路退到"能避多少避多少"。
export function safePole(F, cfg) {
  if (!cfg.plaza) return interiorPole(F);
  const pc = F.P2(cfg.plaza.center), outer = F.N(cfg.plaza.outer);
  for (const k of [1.35, 1.15, 1.0, 0.8, 0.5]) {
    const R = outer * k + (k > 1 ? 2.5 : 0);
    const p = interiorPole(F, (x, z) => Math.hypot(x - pc[0], z - pc[1]) >= R);
    if (p[2] > 0) return p;
  }
  return interiorPole(F);
}

/* ================= 广场（出生平台）尺寸自适应 =================
   广场会把半径内的高度压掉 90%，它比城市还大时整座城就平了（重庆城内最深处离中心只有 7.3m，
   而广场半径 11.4m）。所以广场半径要跟"城市厚度"走：不超过城内最深处距离的 30%。 */
export function fitPlaza(F, cfg) {
  if (!cfg.plaza) return cfg;
  const pole = interiorPole(F);
  const pc = F.P2(cfg.plaza.center);
  const dCenter = Math.hypot(pole[0] - pc[0], pole[1] - pc[1]);   // 城内最深处离广场中心多远
  const outer = Math.max(0.05, Math.min(cfg.plaza.outer, dCenter * 0.35 / F.RX));
  if (outer < cfg.plaza.outer) {
    cfg.plaza.outer = +outer.toFixed(4);
    cfg.plaza.inner = +Math.min(cfg.plaza.inner, outer * 0.45).toFixed(4);
  }
  return cfg;
}

/* ================= 自动贴合：把意图落到真实轮廓内的安全区 =================
   手写的是"山在西、河贯城"的意图，具体落点由轮廓决定。
   为什么必须做：真实行政轮廓填充率只有 0.43~0.54（很不规则），而且 terrain-field 的
   edgeFlat 会把靠边 3~10 米的高度乘到 0——落在沙化带里的山"配置写着 6 米、上岛是 0 米"。 */
export const MARGIN = { mtn: 8, hill: 8, ridge: 8, river: 1.5, lake: 6, peak: 8, farm: 1.5, terrace: 1.5 };

export function fitToShape(F, cfg, log = []) {
  const pole = interiorPole(F);
  const toW = q => F.P2(q);
  const toN = w => [+((w[0] - F.CX) / F.RX).toFixed(4), +((w[1] - F.CZ) / F.RZ).toFixed(4)];
  const ok = (w, m) => F.inPoly(w[0], w[1]) && F.dEdge(w[0], w[1]) >= m;
  const pull = (w, m) => {                                  // 朝内极点逐步收，直到满足 margin
    let p = w.slice(), best = w.slice(), bestD = F.inPoly(w[0], w[1]) ? F.dEdge(w[0], w[1]) : -1;
    for (let i = 0; i < 80; i++) {
      if (ok(p, m)) return p;
      const nx = p[0] + (pole[0] - p[0]) * 0.05, nz = p[1] + (pole[1] - p[1]) * 0.05;
      p = [nx, nz];
      if (F.inPoly(nx, nz)) { const d = F.dEdge(nx, nz); if (d > bestD) { bestD = d; best = [nx, nz]; } }
    }
    return bestD >= 0 ? best : [pole[0], pole[1]];
  };
  const fixPt = (q, m) => toN(pull(toW(q), m));

  // 点状地物
  for (const arr of [cfg.mountain ? [cfg.mountain] : [], cfg.mountains || [], cfg.hill ? [cfg.hill] : [], cfg.hills || []]) {
    for (const f of arr) f.center = fixPt(f.center, MARGIN[f.amp && f.amp > 4 ? 'mtn' : 'hill']);
  }
  for (const l of [...(cfg.lake ? [cfg.lake] : []), ...(cfg.lakes || [])]) l.at = fixPt(l.at, MARGIN.lake);
  if (cfg.farm) cfg.farm.center = fixPt(cfg.farm.center, MARGIN.farm);
  if (cfg.terrace) cfg.terrace.center = fixPt(cfg.terrace.center, MARGIN.terrace);
  for (const p of (cfg.peaks || [])) { const q = fixPt([p[0], p[1]], MARGIN.peak); p[0] = q[0]; p[1] = q[1]; }

  // 山脉（线状）：先沿线裁到安全区；整条都不安全就整体朝内极点挪；仍不行则删掉
  const kept = [];
  for (const r of (cfg.ridges || [])) {
    const A = r.from, B = r.to;
    const at = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
    const safeT = [];
    for (let i = 0; i <= 40; i++) { const w = toW(at(i / 40)); if (ok(w, MARGIN.ridge)) safeT.push(i / 40); }
    if (safeT.length >= 2) {
      const t0 = Math.min(...safeT), t1 = Math.max(...safeT);
      r.from = toN(toW(at(t0))); r.to = toN(toW(at(t1)));
      kept.push(r); continue;
    }
    let A2 = A, B2 = B, moved = false;
    for (let s = 0; s < 60; s++) {
      const wa = toW(A2), wb = toW(B2);
      if (ok(wa, MARGIN.ridge) && ok(wb, MARGIN.ridge)) { moved = true; break; }
      const na = pull(wa, MARGIN.ridge), nb = pull(wb, MARGIN.ridge);
      A2 = toN(na); B2 = toN(nb);
      if (Math.hypot(na[0] - wa[0], na[1] - wa[1]) < 0.01 && Math.hypot(nb[0] - wb[0], nb[1] - wb[1]) < 0.01) break;
    }
    if (moved) { r.from = A2; r.to = B2; kept.push(r); }
    else log.push(`删山脉(${JSON.stringify(r.from)}→${JSON.stringify(r.to)} 整条贴边立不起来)`);
  }
  if (cfg.ridges) { if (kept.length) cfg.ridges = kept; else delete cfg.ridges; }

  // 河流（线状）：逐控制点收进轮廓内（河可以靠边，但不许出界）
  if (cfg.rivers) {
    cfg.rivers = cfg.rivers.map(def => {
      const pts = (Array.isArray(def) ? def : def.pts).map(p => fixPt(p, MARGIN.river));
      return Array.isArray(def) ? pts : { ...def, pts };
    });
  }

  // 广场（出生平台，压平 90%）：地标别落在里面，否则"配置写着 2 米、上岛 0 米"
  if (cfg.plaza) {
    const pc = toW(cfg.plaza.center), R = F.N(cfg.plaza.outer) * 1.25 + 2;
    const pushOut = q => {
      let w = toW(q);
      for (let i = 0; i < 40 && Math.hypot(w[0] - pc[0], w[1] - pc[1]) < R; i++) {
        const dx = w[0] - pc[0], dz = w[1] - pc[1], L = Math.hypot(dx, dz) || 1;
        const nx = w[0] + dx / L * R * 0.08, nz = w[1] + dz / L * R * 0.08;
        if (!ok([nx, nz], 2)) break;
        w = [nx, nz];
      }
      return toN(w);
    };
    for (const arr of [cfg.mountain ? [cfg.mountain] : [], cfg.mountains || [], cfg.hill ? [cfg.hill] : [], cfg.hills || []]) {
      for (const f of arr) f.center = pushOut(f.center);
    }
    for (const p of (cfg.peaks || [])) { const q = pushOut([p[0], p[1]]); p[0] = q[0]; p[1] = q[1]; }
  }
  return cfg;
}

/* ================= 实高校核：把"配置里写了但上岛看不见"的地物修好 =================
   闭环做法：贴合后重建高度场，量地物中心的真实高度；不够就先抬 amp（有上限，避免微缩比例失真），
   抬不动就换到城内最深处（内极点，必有空间），还立不起来才删——宁可不要，也不留一个
   写在配置里、上岛看不见的山。 */
const MAX_AMP = { mountain: 8.0, ridge: 7.0, hill: 3.2 };   // 微缩比例上限（米）
export function tuneHeights(id, city, cfg, log = []) {
  const TARGET = { mountain: 4.5, ridge: 4.5, hill: 1.5 };
  const F0 = makeField(id, city, cfg);
  const pole = interiorPole(F0);
  const poleN = [+((pole[0] - F0.CX) / F0.RX).toFixed(4), +((pole[1] - F0.CZ) / F0.RZ).toFixed(4)];
  const real = f => {
    const F = makeField(id, city, cfg);
    const w = F.P2(f.center || f.from);
    return F.heightAtLocal(w[0], w[1]);
  };
  const groups = () => ([
    ['mountain', cfg.mountain ? [cfg.mountain] : [], 'mountain'],
    ['mountains', cfg.mountains || [], 'mountain'],
    ['ridges', cfg.ridges || [], 'ridge'],
    ['hill', cfg.hill ? [cfg.hill] : [], 'hill'],
    ['hills', cfg.hills || [], 'hill'],
  ]);
  for (let round = 0; round < 4; round++) {
    let changed = false;
    for (const [key, arr, kind] of groups()) {
      const kept = [];
      for (const f of arr) {
        let h = real(f);
        // ① 抬 amp 到目标高度（不超过上限）
        if (h < TARGET[kind] && f.amp < MAX_AMP[kind]) {
          const need = Math.min(MAX_AMP[kind], f.amp * (TARGET[kind] / Math.max(h, 0.3)));
          if (need > f.amp + 0.05) { f.amp = +need.toFixed(2); changed = true; h = real(f); }
        }
        // ② 还是立不起来（贴着沙化带/广场）→ 换到城内最深处
        if (h < TARGET[kind] * 0.5 && f.center) {
          const back = f.center.slice();
          f.center = poleN.slice();
          const h2 = real(f);
          if (h2 > h + 0.3) { log.push(`${key} 挪到城内最深处(实高 ${h.toFixed(1)}→${h2.toFixed(1)}m)`); changed = true; h = h2; }
          else f.center = back;
        }
        if (h < TARGET[kind] * 0.6) log.push(`⚠${key} 实高仅 ${h.toFixed(1)}m（已到 amp 上限/无可用空间）`);
        kept.push(f);
      }
      if (key === 'mountain') { if (kept.length) cfg.mountain = kept[0]; else delete cfg.mountain; }
      else if (key === 'hill') { if (kept.length) cfg.hill = kept[0]; else delete cfg.hill; }
      else if (arr.length) cfg[key] = kept;
    }
    if (!changed) break;
  }
  return cfg;
}

/* ================= 地形打卡点：每城一个，由地物自动推导 =================
   kind 决定名字与图标，at 必须落在"走得到"的位置：界内、离边够远、不在水里。
   选位规则：有山→山顶；有湖/海→岸边（从湖心朝城内退到水边）；沙色→沙丘脊；
   有梯田→梯田中心；否则→河边码头。 */
const SPOT_NAME = {
  summit: ['山顶瞭望台', 'Summit Lookout', '⛰️'],
  lakeside: ['湖畔栈道', 'Lakeside Walk', '🌊'],
  dune: ['沙丘观景', 'Dune View', '🏜️'],
  terrace: ['梯田边', 'Terrace Edge', '🌾'],
  coast: ['海角眺望', 'Sea Point', '🏖️'],
  river: ['河边码头', 'Riverside Pier', '🛶'],
};
export function fitSpot(id, city, cfg, log = []) {
  const F = makeField(id, city, cfg);
  const pole = interiorPole(F);
  const dry = (x, z) => F.waterAt(x, z) < 0.08;
  const walkable = (x, z) => F.inPoly(x, z) && F.dEdge(x, z) >= 2.5 && dry(x, z);

  // 全城扫描：最高点 + 备用可行走点
  let hi = -1, hiAt = null, bestAny = null, bestD = -1;
  const N = 56;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = F.minX + (F.maxX - F.minX) * i / N, z = F.minZ + (F.maxZ - F.minZ) * j / N;
    if (!F.inPoly(x, z)) continue;
    const d = F.dEdge(x, z);
    if (d > bestD && dry(x, z)) { bestD = d; bestAny = [x, z]; }
    const y = F.heightAtLocal(x, z);
    if (y > hi && d >= 2.5 && dry(x, z)) { hi = y; hiAt = [x, z]; }
  }
  const hasMtn = !!(cfg.mountain || (cfg.mountains || []).length || (cfg.ridges || []).length || (cfg.peaks || []).length);
  const sea = F.features.lakes.filter(L => L.rx >= 7);      // 大水面=海（太湖/滇池/海湾）；小的算湖（净月潭/瘦西湖）
  const ponds = F.features.lakes.filter(L => L.rx < 7);
  const dune = (() => { const g0 = (cfg.colors?.greens || [])[0]; return !!g0 && g0[0] > 0.82 && g0[2] < 0.62; })();

  // 打卡点类型：cfg.spotKind 显式指定优先（湖/海靠尺寸区分不可靠——太湖 rx=8、黄渤海 8.5），
  // 其余按地物自动推导
  const forced = cfg.spotKind && SPOT_NAME[cfg.spotKind] ? cfg.spotKind : null;
  let kind = forced || 'viewpoint', at = null;
  const toNorm = w => [+((w[0] - F.CX) / F.RX).toFixed(4), +((w[1] - F.CZ) / F.RZ).toFixed(4)];
  // 从一处水心朝城内退，退到岸上（走得到）
  const shoreFrom = L => {
    const c = L.at;
    for (let t = 0; t <= 1; t += 0.04) {
      const x = c[0] + (pole[0] - c[0]) * t, z = c[1] + (pole[1] - c[1]) * t;
      if (walkable(x, z)) return [x, z];
    }
    return null;
  };
  const shoreAny = () => {
    for (const L of [...sea, ...ponds]) { const s = shoreFrom(L); if (s) return s; }
    return null;
  };
  const riverBank = () => {
    for (const R of F.features.rivers) {
      for (let i = Math.floor(R.pts.length * 0.3); i < R.pts.length * 0.7; i += 3) {
        const mid = R.pts[i].p;
        for (let t = 0; t <= 1; t += 0.05) {
          const x = mid[0] + (pole[0] - mid[0]) * t, z = mid[1] + (pole[1] - mid[1]) * t;
          if (walkable(x, z)) return [x, z];
        }
      }
    }
    return null;
  };
  if (forced) {
    if (kind === 'summit') at = hiAt;
    else if (kind === 'dune') at = hiAt || bestAny;
    else if (kind === 'terrace') { const T = F.features.terrace; at = T && walkable(T.c[0], T.c[1]) ? [T.c[0], T.c[1]] : bestAny; }
    else if (kind === 'coast' || kind === 'lakeside') at = shoreAny();
    else if (kind === 'river') at = riverBank();
  }
  if (!at) {
    // 自动推导：沙丘优先于山顶（敦煌既有鸣沙山脊线又是沙色，"沙丘观景"更贴）
    if (dune && hiAt) { kind = 'dune'; at = hiAt; }
    else if (hasMtn && hiAt && hi >= 2.5) { kind = 'summit'; at = hiAt; }
    else if (cfg.terrace && F.features.terrace) { kind = 'terrace'; const T = F.features.terrace; at = walkable(T.c[0], T.c[1]) ? [T.c[0], T.c[1]] : bestAny; }
    else if (sea.length) { kind = 'coast'; at = shoreAny(); }
    else if (ponds.length) { kind = 'lakeside'; at = shoreAny(); }
    else if (F.features.rivers.length) { kind = 'river'; at = riverBank(); }
  }
  if (!at) at = bestAny || [pole[0], pole[1]];
  if (!walkable(at[0], at[1])) {                 // 兜底：朝内极点退到可站处
    for (let t = 0; t <= 1; t += 0.05) {
      const x = at[0] + (pole[0] - at[0]) * t, z = at[1] + (pole[1] - at[1]) * t;
      if (walkable(x, z)) { at = [x, z]; break; }
    }
  }
  const [nm, en, emoji] = SPOT_NAME[kind];
  cfg.spot = { kind, name: nm, en, emoji, at: toNorm(at), r: 6, stars: 3 };
  if (!F.inPoly(at[0], at[1])) log.push('⚠打卡点落在轮廓外');
  return cfg;
}

/* ================= 体检（与 scripts/audit-terrain.mjs 同一口径） ================= */
export function auditCity(id, city, cfg, opts = {}) {
  const F = makeField(id, city, cfg);
  const fail = [], warn = [];
  const ef = cfg.edgeFlat ?? [3, 10];

  // 1) 地物在不在轮廓内
  const outside = [];
  const chk = (label, q) => { const [x, z] = F.P2(q); if (!F.inPoly(x, z)) outside.push(`${label}${JSON.stringify(q)}`); };
  for (const m of [...(cfg.mountain ? [cfg.mountain] : []), ...(cfg.mountains || [])]) chk('山', m.center);
  for (const h of [...(cfg.hill ? [cfg.hill] : []), ...(cfg.hills || [])]) chk('丘', h.center);
  for (const r of (cfg.ridges || [])) { chk('脉起', r.from); chk('脉终', r.to); }
  for (const l of [...(cfg.lake ? [cfg.lake] : []), ...(cfg.lakes || [])]) chk('湖', l.at);
  for (const p of (cfg.peaks || [])) chk('峰', [p[0], p[1]]);
  for (const def of (cfg.rivers || [])) (Array.isArray(def) ? def : (def.pts || [])).forEach((p, i) => chk(`河${i}`, p));
  if (outside.length) fail.push(`出界 ${outside.length} 处: ${outside.slice(0, 3).join(' ')}${outside.length > 3 ? ' …' : ''}`);

  // 2) 起伏率 + 主峰实高
  //    起伏率只量「沙化带之外」的可用区：edgeFlat 带内本来就该平（城墙/立牌/树贴地在 y=0），
  //    把它算进起伏率等于用错尺子——薄月牙形的行政轮廓（西安/无锡）会被误判成"死平"。
  const efHi = ef[1];
  let hi = 0, hiAt = null, up = 0, tot = 0, upU = 0, totU = 0;
  const N = 64;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = F.minX + (F.maxX - F.minX) * i / N, z = F.minZ + (F.maxZ - F.minZ) * j / N;
    if (!F.inPoly(x, z)) continue;
    tot++;
    const y = F.heightAtLocal(x, z);
    const on = y >= Math.max(0.5, F.step * 0.6);
    if (on) up++;
    if (y > hi) { hi = y; hiAt = [x, z]; }
    if (F.dEdge(x, z) >= efHi) { totU++; if (on) upU++; }
  }
  const usable = tot ? totU / tot : 0;
  const thin = totU < 120;                                 // 几乎没有"带外可用区"：薄月牙形轮廓
  const relief = totU ? upU / totU : (tot ? up / tot : 0);
  const hasMountain = !!(cfg.mountain || (cfg.mountains || []).length || (cfg.ridges || []).length);
  const minRelief = opts.minRelief ?? 0.25, minPeak = opts.minPeak ?? 4.0;
  if (!thin && relief < minRelief) fail.push(`可用区起伏率 ${(relief * 100).toFixed(0)}% < ${(minRelief * 100).toFixed(0)}%`);
  if (thin) warn.push(`带外可用区仅 ${totU} 点(${(usable * 100).toFixed(0)}%)：轮廓太薄，地形只能贴着边`);
  if (hasMountain && hi < minPeak) fail.push(`主峰实高 ${hi.toFixed(1)}m < ${minPeak}m`);

  // 3) 广场压不压地标
  if (cfg.plaza) {
    const [px, pz] = F.P2(cfg.plaza.center), outer = F.N(cfg.plaza.outer);
    for (const m of [...(cfg.mountain ? [cfg.mountain] : []), ...(cfg.mountains || []), ...(cfg.hill ? [cfg.hill] : []), ...(cfg.hills || [])]) {
      const [x, z] = F.P2(m.center), d = Math.hypot(x - px, z - pz);
      if (d < outer) fail.push(`广场压住地标(距中心 ${d.toFixed(1)}m < ${outer.toFixed(1)}m)`);
    }
  }

  // 4) 广场 → 主峰 的直线可走性（单步高差）
  let maxStep = 0;
  if (cfg.plaza && hiAt) {
    const [px, pz] = F.P2(cfg.plaza.center);
    let prev = null;
    for (let i = 0; i <= 120; i++) {
      const x = px + (hiAt[0] - px) * i / 120, z = pz + (hiAt[1] - pz) * i / 120;
      const y = F.heightAtLocal(x, z);
      if (prev !== null) maxStep = Math.max(maxStep, Math.abs(y - prev));
      prev = y;
    }
    if (maxStep >= 2.0) fail.push(`上坡单步高差 ${maxStep.toFixed(2)}m ≥ 2m`);
  }

  // 5) 水面
  for (const L of F.features.lakes) {
    if (!F.inPoly(L.at[0], L.at[1])) fail.push('湖心出界');
    else if (F.dEdge(L.at[0], L.at[1]) < 1.0) warn.push('湖心贴边(<1m)');
  }
  for (const R of F.features.rivers) {
    const outN = R.pts.filter(s => !F.inPoly(s.p[0], s.p[1])).length;
    if (outN > R.pts.length * 0.25) warn.push(`河道 ${outN}/${R.pts.length} 采样点在界外（会断流）`);
  }

  return { F, fail, warn, stats: { hi, relief, maxStep, hasMountain, tot, totU, usable, thin } };
}

/* ================= 底板配置 =================
   默认值经过体检校准：
   - roll/noise 给足：平地城市也要有台地/田埂，否则量化后是一片死平的绿板（起伏率 < 40% 不达标）
   - snow 默认关闭：只有真正的高山城市（拉萨/西宁/乌鲁木齐/西安/哈尔滨…）才开雪线，
     否则 6 米的小丘也会顶个雪帽，看着假 */
export function baseCfg(id, { palette = 'RICH', roll = 1.0, noise = 0.45, riverW = 1.2, plazaOuter = 0.16, snow = [99, 100], seed } = {}) {
  return {
    _说明: '城市微缩分层地形配置（js/terrain.js 消费）。坐标：原点 = 轮廓包围盒中心，x/z 两轴各自映射到包围盒半跨；x+ = 东，z+ = 南；高度/宽度类参数为米。由 scripts/gen-terrain.mjs 生成，可手工微调（改完跑 scripts/audit-terrain.mjs 复核）。',
    step: 0.9, riverW, seed: seed ?? hash(id), roll, noise,
    edgeFlat: [3, 10], colorCell: 2.5,
    plaza: { center: [0, 0], inner: 0.06, outer: plazaOuter, flat: 0.9 },
    colors: {
      greens: PALETTES[palette] || PALETTES.RICH,
      terraceGold: TG, farmStripe: FW, snow: [0.96, 0.98, 1.0], plaza: [0.78, 0.88, 0.62], jitter: 0.05,
    },
    snow,
  };
}
export const hash = s => { let h = 5381; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 100000; };
