// 城市微缩地形「高度场 + 配色」纯模块（无 THREE、无 DOM，可在浏览器与 Node 里同样运行）。
//
// 为什么单独拆出来：高度场有三处消费者，必须算的是同一份数——
//   1) js/terrain.js  建地形网格/河流/湖/瀑布（渲染）
//   2) js/china-map.js 全国地图上的邻城浮雕（缩略）
//   3) scripts/audit-terrain.mjs 地形体检 + js/game.js 的涉水/滑行/寻高
// 各写一套必然漂移（历史上就出现过"配置写着 5.5 米的山、上岛是 0 米"）。
//
// 坐标约定（与 city-shape-data.js 一致）：
//   pts 为城市轮廓多边形（局部坐标，末点=首点），归一化原点 = 轮廓包围盒中心，
//   x/z 两轴各自映射到包围盒半跨 RX/RZ；x+ = 东，z+ = 南。
//   cfg 里"点坐标"是归一化值，"长度/半径"按 RX 换算，"高度"是米。

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// sRGB → 线性（渲染侧用）。本模块与 terrain.json 里的色值都是**按人眼挑的 sRGB 数值**
// （PALETTES 的 [0.49,0.78,0.47] = #7DC777 草绿），而 three r152+ 把 geometry.color 当**线性值**
// 直接乘进着色器：不转换就等于"亮一整个 gamma"——0.49 显示成 0.68，通道差被压平，
// 草地变淡薄荷、雪顶变纯白、纸面变白纸。这是"地图发白"的根因之一。
// 约定：zoneColor 输出 sRGB（体检/审计脚本按人眼看数），渲染一律用 zoneColorLinear。
const SRGB_TO_LIN = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const srgbToLinear = v => SRGB_TO_LIN(v);

// 与 THREE.CatmullRomCurve3(curveType='catmullrom', tension=0.5) 完全一致的 2D 求值：
// 河流网格与涉水判定必须踩在同一条曲线上，不能一边用 THREE 一边用别的插值
export function catmullRom2D(P, t) {
  const l = P.length, tension = 0.5;
  const p = (l - 1) * t;
  let i = Math.floor(p), w = p - i;
  if (w === 0 && i === l - 1) { i = l - 2; w = 1; }
  const p0 = i > 0 ? P[i - 1] : [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
  const p1 = P[i], p2 = P[i + 1];
  const p3 = i + 2 < l ? P[i + 2] : [2 * P[l - 1][0] - P[l - 2][0], 2 * P[l - 1][1] - P[l - 2][1]];
  const t2 = w * w, t3 = t2 * w;
  const v0x = (p2[0] - p0[0]) * tension, v0z = (p2[1] - p0[1]) * tension;
  const v1x = (p3[0] - p1[0]) * tension, v1z = (p3[1] - p1[1]) * tension;
  return [
    (2 * p1[0] - 2 * p2[0] + v0x + v1x) * t3 + (-3 * p1[0] + 3 * p2[0] - 2 * v0x - v1x) * t2 + v0x * w + p1[0],
    (2 * p1[1] - 2 * p2[1] + v0z + v1z) * t3 + (-3 * p1[1] + 3 * p2[1] - 2 * v0z - v1z) * t2 + v0z * w + p1[1],
  ];
}

const D_GREENS = [[0.49, 0.78, 0.47], [0.44, 0.72, 0.42], [0.38, 0.65, 0.37], [0.31, 0.56, 0.31], [0.26, 0.47, 0.27], [0.22, 0.40, 0.24]];

// Douglas–Peucker 简化闭合多边形（与 js/city-shape.js simplifyPoly 同一套做法；显式栈避免深递归）
function dpSimplify(pts, tol) {
  const n = pts.length;
  if (n <= 24) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const mid = n >> 1;
  keep[mid] = 1;
  const stack = [[0, mid], [mid, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j <= i + 1) continue;
    const [ax, az] = pts[i], [bx, bz] = pts[j];
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
    let maxi = -1, maxd = -1;
    for (let k = i + 1; k < j; k++) {
      const [px, pz] = pts[k];
      const t = clamp(((px - ax) * ex + (pz - az) * ez) / l2, 0, 1);
      const dx = px - (ax + ex * t), dz = pz - (az + ez * t);
      const d = dx * dx + dz * dz;
      if (d > maxd) { maxd = d; maxi = k; }
    }
    if (maxd > tol * tol) { keep[maxi] = 1; stack.push([i, maxi], [maxi, j]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  const last = out[out.length - 1], first = out[0];
  if (last[0] !== first[0] || last[1] !== first[1]) out.push([first[0], first[1]]);
  return out;
}

// 等距重采样闭合多边形到 M 个点（距离查询用：点数固定 = 查询开销固定）
function resample(pts, M) {
  const acc = [0]; let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]); acc.push(L);
  }
  if (L <= 0) return pts.slice();
  const out = [];
  for (let k = 0; k < M; k++) {
    const d = k / M * L;
    let i = 1;
    while (i < acc.length && acc[i] < d) i++;
    if (i >= acc.length) i = acc.length - 1;
    const t = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    const a = pts[i - 1], b = pts[i];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}


export function makeHeightField({ pts, cfg }) {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = maxX - minX, H = maxZ - minZ;
  const RX = W / 2, RZ = H / 2;                     // 两轴各自缩放（轮廓短轴常只有长轴的 0.3~0.7）
  const CX = (minX + maxX) / 2, CZ = (minZ + maxZ) / 2;
  const N = v => v * RX;                            // 归一化长度/半径 → 世界长度
  const P2 = p => [CX + p[0] * RX, CZ + p[1] * RZ]; // 归一化点 → 世界点

  /* ---- 轮廓工具 ---- */
  const inPoly = (x, z) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  };
  // 边缘沙化带的参考轮廓 = 「平滑后的粗轮廓」，不是逐点锯齿的行政边界。
  // 为什么必须这样：真实行政边界在 70m 半径的城里是 1m 级的锯齿/飞地，逐点量距离会让
  // 76%（西安）/83%（长沙）的城内面积落进 10m 带里被压平——这正是"其他城市一片平"的主因。
  // 规则：粗轮廓之外（凹湾、半岛尖、飞地）一律压平——那里紧贴城墙，装饰按 y=0 摆；
  //       粗轮廓之内才按到粗轮廓的距离做沙化衰减，让城心真正长出地形。
  const smRing = (() => {
    const tol = Math.max(2.0, Math.min(4.5, RX * 0.045));
    return resample(dpSimplify(pts, tol), 220);
  })();
  const inPolySm = (x, z) => {
    let c = false;
    for (let i = 0, j = smRing.length - 1; i < smRing.length; j = i++) {
      const xi = smRing[i][0], zi = smRing[i][1], xj = smRing[j][0], zj = smRing[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  };
  const dEdge = (x, z) => {
    if (!inPolySm(x, z)) return 0;                  // 粗轮廓之外：贴城墙，保持压平
    let m = Infinity;
    for (const p of smRing) { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < m) m = d; }
    return Math.sqrt(m);
  };

  /* ---- 地物（全部支持单个与数组两种写法，数组用于"多山多丘多湖"） ---- */
  const step = cfg.step ?? 0.9;
  const amp = cfg.amp ?? 7.5;
  const MNT = [...(cfg.mountain ? [cfg.mountain] : []), ...(cfg.mountains || [])].map(m => ({
    c: P2(m.center), near: N(m.near), far: N(m.far), pow: m.pow ?? 1.5, amp: m.amp ?? amp,
  }));
  const RDG = (cfg.ridges || []).map(r => ({        // 山脉：沿线段的带状隆起（秦岭/太行/天山/燕山…）
    a: P2(r.from), b: P2(r.to), w: N(r.w ?? 0.22), amp: r.amp ?? amp * 0.8, pow: r.pow ?? 1.4,
  }));
  const HIL = [...(cfg.hill ? [cfg.hill] : []), ...(cfg.hills || [])].map(e => ({
    c: P2(e.center), near: N(e.near), far: N(e.far), pow: e.pow ?? 1.5, amp: e.amp ?? 2.4,
  }));
  const PLZ = cfg.plaza ? { c: P2(cfg.plaza.center), inner: N(cfg.plaza.inner), outer: N(cfg.plaza.outer), flat: cfg.plaza.flat ?? 0.9 } : null;
  const TER = cfg.terrace ? { c: P2(cfg.terrace.center), rx: N(cfg.terrace.rx), rz: cfg.terrace.rz * RZ, cell: cfg.terrace.cell ?? 5 } : null;
  const FRM = cfg.farm ? { c: P2(cfg.farm.center), r0: N(cfg.farm.r0), r1: N(cfg.farm.r1) } : null;

  const eFlat = cfg.edgeFlat ?? [3, 10];
  const noiseAmp = cfg.noise ?? 0.15;
  const roll = cfg.roll ?? 0.9;                     // 全域起伏：平地城市也要有微丘/田埂，否则量化后是一片死平的绿板
  const nph = ((cfg.seed ?? 42) % 997) * 0.0137;    // 噪声相位按城市 seed 偏移：同模板城市不再长得一模一样

  const segDist = (x, z, a, b) => {
    const ex = b[0] - a[0], ez = b[1] - a[1];
    const t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1);
    return Math.hypot(x - (a[0] + ex * t), z - (a[1] + ez * t));
  };
  const n2 = (x, z) => Math.sin(x * 0.131 + 1.7 + nph) * Math.cos(z * 0.117 + 0.6 - nph)
    + 0.6 * Math.sin(x * 0.053 - z * 0.089 + 3.1 + nph * 1.7)
    + 0.4 * Math.cos(x * 0.071 + z * 0.047 - nph * 2.3);

  const hRaw = (x, z) => {
    // 全域低频起伏：必须是「非负」的（0 ~ roll），否则一半城市落在负半周被 max(0,·) 截成 0，
    // 量化后整座城就是一块死平的绿板——这正是平地城市"差很多"的直接原因
    let h = roll * (0.5 + 0.3 * Math.sin(x * 0.021 + z * 0.017 + nph * 3.1) + 0.2 * Math.sin(x * 0.037 - z * 0.028 + nph * 5.7));
    let mask = 0;
    for (const m of MNT) {
      const mM = 1 - smoothstep(m.near, m.far, Math.hypot(x - m.c[0], z - m.c[1]));
      h += m.amp * Math.pow(mM, m.pow);
      mask = Math.max(mask, mM);
    }
    for (const r of RDG) {
      const rM = 1 - smoothstep(0, r.w, segDist(x, z, r.a, r.b));
      h += r.amp * Math.pow(rM, r.pow);
      mask = Math.max(mask, rM);
    }
    for (const e of HIL) {
      const eM = 1 - smoothstep(e.near, e.far, Math.hypot(x - e.c[0], z - e.c[1]));
      h += e.amp * Math.pow(eM, e.pow);
    }
    h += n2(x, z) * (noiseAmp + 1.05 * mask);
    if (PLZ) h *= 1 - PLZ.flat * (1 - smoothstep(PLZ.inner, PLZ.outer, Math.hypot(x - PLZ.c[0], z - PLZ.c[1])));
    h *= smoothstep(eFlat[0], eFlat[1], dEdge(x, z));
    return Math.max(0, h);
  };
  const quant = h => Math.floor(h / step + 1e-4) * step;

  /* ---- 网格（渲染与寻高共用同一份量化高度） ---- */
  const gsz = cfg.grid ?? 1.5;
  const nx = Math.max(1, Math.ceil(W / gsz)), nz = Math.max(1, Math.ceil(H / gsz));
  const hs = [], hsSm = [], qy = [];
  for (let j = 0; j <= nz; j++) {
    hs[j] = []; hsSm[j] = []; qy[j] = [];
    for (let i = 0; i <= nx; i++) {
      const x = minX + i * gsz, z = minZ + j * gsz;
      hs[j][i] = hRaw(x, z);
      qy[j][i] = quant(hs[j][i]);
    }
  }
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    let sum = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const jj = j + dj, ii = i + di;
      if (jj < 0 || jj > nz || ii < 0 || ii > nx) continue;
      sum += hs[jj][ii]; n++;
    }
    hsSm[j][i] = sum / n;
  }
  const heightAtLocal = (lx, lz) => {
    if (lx < minX || lx > maxX || lz < minZ || lz > maxZ) return 0;
    const fi = Math.min(nx - 1, Math.max(0, Math.floor((lx - minX) / gsz)));
    const fj = Math.min(nz - 1, Math.max(0, Math.floor((lz - minZ) / gsz)));
    const tx = (lx - (minX + fi * gsz)) / gsz, tz = (lz - (minZ + fj * gsz)) / gsz;
    const y00 = qy[fj][fi], y10 = qy[fj][fi + 1], y01 = qy[fj + 1][fi], y11 = qy[fj + 1][fi + 1];
    return (tx + tz <= 1)
      ? y00 * (1 - tz) + y01 * (tz - tx) + y11 * tx
      : y00 * (1 - tx) + y10 * (tx - tz) + y11 * tz;
  };

  /* ---- 水面（河流带 + 湖椭圆）：涉水判定、打卡点选位、体检都问这里 ---- */
  const riverDefs = (cfg.rivers || []).map(def => {
    const wpts = (Array.isArray(def) ? def : (def.pts || [])).map(P2);
    const w = (Array.isArray(def) ? null : def.w) ?? (cfg.riverW ?? 1.2);
    return wpts.length >= 2 ? { wpts, w } : null;
  }).filter(Boolean);
  // 河流采样点（等弧长）：网格、描边、涉水共用同一条折线
  const riverSamples = riverDefs.map(({ wpts, w }) => {
    const raw = [];
    const SEG = 24;
    for (let i = 0; i < wpts.length - 1; i++) {
      for (let k = 0; k < SEG; k++) raw.push(catmullRom2D(wpts, (i + k / SEG) / (wpts.length - 1)));
    }
    raw.push(wpts[wpts.length - 1]);
    let L = 0;
    for (let i = 1; i < raw.length; i++) L += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
    const pts2 = [];
    const Nn = Math.max(40, Math.round(L / 1.2));
    for (let i = 0; i <= Nn; i++) {
      const t = i / Nn;
      pts2.push({ p: catmullRom2D(wpts, t), t, w: w * (0.75 + 0.5 * t) });
    }
    for (let i = 0; i < pts2.length; i++) {          // 单位切线：河面法线/瀑布朝向都靠它
      const a = pts2[Math.max(0, i - 1)].p, b = pts2[Math.min(pts2.length - 1, i + 1)].p;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      pts2[i].tan = [dx / l, dz / l];
    }
    return { pts: pts2, w, length: L };
  });
  const lakes = [...(cfg.lake ? [cfg.lake] : []), ...(cfg.lakes || [])].map(l => ({
    at: P2(l.at), rx: l.rx, rz: l.rz,
  }));
  // 水面覆盖度 0~1（1 = 水面中心）：河按带宽、湖按椭圆，边缘 0.85~1 平滑收口
  const waterAt = (x, z) => {
    let m = 0;
    for (const L of lakes) {
      const nx2 = (x - L.at[0]) / L.rx, nz2 = (z - L.at[1]) / L.rz;
      m = Math.max(m, 1 - smoothstep(0.82, 1.0, Math.hypot(nx2, nz2)));
    }
    for (const R of riverSamples) {
      for (const s of R.pts) {
        if (Math.abs(s.p[0] - x) > 12 || Math.abs(s.p[1] - z) > 12) continue;
        const d = Math.hypot(s.p[0] - x, s.p[1] - z);
        if (d > s.w + 1.2) continue;
        m = Math.max(m, 1 - smoothstep(s.w * 0.75, s.w + 1.1, d));
        if (m >= 1) break;
      }
    }
    return m;
  };

  /* ---- 配色（纯函数，渲染与体检共用） ---- */
  const CL = cfg.colors ?? {};
  const greens = CL.greens ?? D_GREENS;
  const snowRange = cfg.snow ?? [5.2, 6.6];
  const rockRange = cfg.rock ?? null;               // 裸岩带（米）：高山/喀斯特在雪线之下先露岩
  const colorCell = cfg.colorCell ?? 2.5;
  const jitter = CL.jitter ?? 0.05;
  const terraceMask = (x, z) => {
    if (!TER) return 0;
    const nx2 = (x - TER.c[0]) / TER.rx, nz2 = (z - TER.c[1]) / TER.rz;
    return 1 - smoothstep(0.7, 1.0, Math.max(Math.abs(nx2), Math.abs(nz2)));
  };
  const farmMask = (x, z) => FRM ? 1 - smoothstep(FRM.r0, FRM.r1, Math.hypot(x - FRM.c[0], z - FRM.c[1])) : 0;
  // 线性版配色（渲染专用）：只做一次 sRGB→线性，配色规则与 zoneColor 共用同一份，不会漂移
  function zoneColorLinear(x, z, hSm, band, out) {
    zoneColor(x, z, hSm, band, out);
    out[0] = SRGB_TO_LIN(out[0]); out[1] = SRGB_TO_LIN(out[1]); out[2] = SRGB_TO_LIN(out[2]);
  }
  function zoneColor(x, z, hSm, band, out) {
    const sx = Math.round(x / colorCell) * colorCell, sz = Math.round(z / colorCell) * colorCell;
    let r, g, b;
    const gi = Math.min(band, greens.length - 1);
    [r, g, b] = greens[Math.max(0, gi)];
    const tm = terraceMask(sx, sz);
    if (tm > 0.15 && band >= 1 && CL.terraceGold) {
      const gold = CL.terraceGold[(Math.floor((sx * 0.7 + sz * 0.7) / (TER ? TER.cell : 5)) % 2 + 2) % 2 ? 1 : 0];
      r += (gold[0] - r) * tm; g += (gold[1] - g) * tm; b += (gold[2] - b) * tm;
    }
    const fm = farmMask(sx, sz);
    if (fm > 0.1 && CL.farmStripe) {
      const s = (Math.sin((sx + sz) * 0.55) > 0) ? CL.farmStripe[0] : CL.farmStripe[1];
      r += (s[0] - r) * fm; g += (s[1] - g) * fm; b += (s[2] - b) * fm;
    }
    if (rockRange && CL.rock) {
      const rk = smoothstep(rockRange[0], rockRange[1], hSm);
      if (rk > 0) { r += (CL.rock[0] - r) * rk; g += (CL.rock[1] - g) * rk; b += (CL.rock[2] - b) * rk; }
    }
    const st = smoothstep(snowRange[0], snowRange[1], quant(hSm));
    if (st > 0 && CL.snow) { r += (CL.snow[0] - r) * st; g += (CL.snow[1] - g) * st; b += (CL.snow[2] - b) * st; }
    if (PLZ && CL.plaza) {
      const dp = Math.hypot(sx - PLZ.c[0], sz - PLZ.c[1]);
      if (dp < PLZ.inner + 1) {
        const m = 1 - smoothstep(PLZ.inner, PLZ.inner + 2.5, dp);
        r += (CL.plaza[0] - r) * m; g += (CL.plaza[1] - g) * m; b += (CL.plaza[2] - b) * m;
      }
    }
    const j = 1 - jitter / 2 + jitter * fract(Math.sin(sx * 127.1 + sz * 311.7) * 43758.5453);
    out[0] = r * j; out[1] = g * j; out[2] = b * j;
  }

  return {
    // 几何/尺度
    pts, minX, maxX, minZ, maxZ, W, H, RX, RZ, CX, CZ, N, P2, gsz, nx, nz, step,
    // 采样
    qy, hs, hsSm, inPoly, dEdge, hRaw, quant, heightAtLocal, waterAt, zoneColor, zoneColorLinear,
    // 地物（渲染与体检都要用）
    features: {
      mountains: MNT, ridges: RDG, hills: HIL, plaza: PLZ, terrace: TER, farm: FRM,
      lakes, rivers: riverSamples, peaks: cfg.peaks || [],
      snowRange, rockRange, colors: CL, greens, colorCell,
    },
  };
}
