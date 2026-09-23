// ③④ 地面校验：斑驳光影 + 铺装材质层（石板缝/裂缝/苔藓/车辙）
//
// 为什么这样验：这两层都是"烘进 1024² 区域色贴图"的一次性工作，肉眼看图（我读不了截图）
// 只能靠**信号**：光斑 → 采样亮度标准差变大；石板缝 → 沿街亮度出现周期约 2.2 米的暗纹；
// 而"不许把画面变亮"这条硬约束（check-render 草地亮度上界 0.70，当前 0.668）
// 用"关掉光斑前后平均亮度不得上升"来钉住。
//
// 测试钩子：window.__noDapple（zoneColor 里读，生产环境不设 → 恒为 1）。
//   node scripts/verify-dapple.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CITY = optOf('--city', 'chengdu');
const PORT = 6280 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '地面校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
}, CITY);
await page.goto(`${srv.base}?city=${CITY}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

console.log(`地面：斑驳光影 + 铺装材质层 · ${CITY}`);

/* ---------- 1) 区域色贴图在用（快速路径生效） ---------- */
const tex = await page.evaluate(() => {
  const g = window.__game;
  const key = (g._currentStage() || {}).key;
  // ⚠ terrainField 存在 world.cityBounds[key] 下（world.js:1605），不是 world.terrainField
  const F = key && g.world.cityBounds && g.world.cityBounds[key] ? g.world.cityBounds[key].terrainField : null;
  if (!F) return { noField: true, key };
  // 区域色贴图只活在 onBeforeCompile 的闭包里，扫不到 → 用它的**可观测不变量**判定：
  // 贴图生效时 terrain.js 会把 vertexColors 置 false（否则顶点色与区域色相乘 = 双重着色）
  // 并把 customProgramCacheKey 设成 'terrain-region-v1'。
  let ground = null;
  g.scene.traverse((o) => { if (!ground && o.isMesh && o.name === 'city-ground') ground = o; });
  const m = ground && ground.material;
  return {
    key,
    hasGround: !!ground,
    vertexColors: m ? m.vertexColors : null,
    cacheKey: m && m.customProgramCacheKey ? String(m.customProgramCacheKey()) : null,
    step: F.step,
    hasZoneColor: typeof F.zoneColor === 'function',
    hasZoneLinear: typeof F.zoneColorLinear === 'function',
    bounds: [F.minX, F.maxX, F.minZ, F.maxZ].map((v) => +v.toFixed(1)),
  };
});
check(!tex.noField, '当前城走真地形引擎（cityBounds[key].terrainField 存在）', String(tex.key));
check(tex.hasGround && tex.vertexColors === false && tex.cacheKey === 'terrain-region-v1',
  '区域色贴图路径生效（顶点色已关闭 + 着色器变体为 terrain-region-v1，避免双重着色）',
  `vertexColors=${tex.vertexColors} cacheKey=${tex.cacheKey}`);
check(tex.hasZoneColor && tex.hasZoneLinear, 'zoneColor 与 zoneColorLinear 都在');

/* ---------- 2) 同源契约：两条路径必须是同一个函数的结果 ---------- */
const same = await page.evaluate(() => {
  const g = window.__game;
  const key = (g._currentStage() || {}).key;
  const F = g.world.cityBounds[key].terrainField;
  const { minX, maxX, minZ, maxZ, nx, nz, hsSm, step } = F;
  const spanX = maxX - minX, spanZ = maxZ - minZ, gsz = spanX / nx;
  const hAt = (fx, fz) => {
    const gx = Math.max(0, Math.min(nx, (fx - minX) / gsz));
    const gz = Math.max(0, Math.min(nz, (fz - minZ) / gsz));
    const i0 = Math.min(nx - 1, Math.floor(gx)), j0 = Math.min(nz - 1, Math.floor(gz));
    const tx = gx - i0, tz = gz - j0;
    const a = hsSm[j0][i0], b = hsSm[j0][i0 + 1], c = hsSm[j0 + 1][i0], d = hsSm[j0 + 1][i0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  let worst = 0, n = 0;
  const o1 = [0, 0, 0], o2 = [0, 0, 0];
  for (let i = 0; i < 100; i++) {
    const x = minX + (i % 10 + 0.5) / 10 * spanX;
    const z = minZ + (Math.floor(i / 10) + 0.5) / 10 * spanZ;
    const h = hAt(x, z);
    F.zoneColor(x, z, h, Math.floor(h / step + 1e-4), o1);
    F.zoneColorLinear(x, z, h, Math.floor(h / step + 1e-4), o2);
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(lin(o1[c]) - o2[c]) * 255);
    n++;
  }
  return { worst: +worst.toFixed(3), n };
});
check(same.worst <= 2, '同源契约：zoneColorLinear ≡ sRGB→线性(zoneColor)', `最大差 ${same.worst}/255（${same.n} 个采样点）`);

/* ---------- 3+4) 光斑：开/关对照（标准差变大 = 光斑真的进图；平均值不上升 = 不顶破亮度门槛） ---------- */
const dap = await page.evaluate(() => {
  const g = window.__game;
  const key = (g._currentStage() || {}).key;
  const F = g.world.cityBounds[key].terrainField;
  const { minX, maxX, minZ, maxZ, nx, nz, hsSm, step } = F;
  const spanX = maxX - minX, spanZ = maxZ - minZ, gsz = spanX / nx;
  const hAt = (fx, fz) => {
    const gx = Math.max(0, Math.min(nx, (fx - minX) / gsz));
    const gz = Math.max(0, Math.min(nz, (fz - minZ) / gsz));
    const i0 = Math.min(nx - 1, Math.floor(gx)), j0 = Math.min(nz - 1, Math.floor(gz));
    const tx = gx - i0, tz = gz - j0;
    const a = hsSm[j0][i0], b = hsSm[j0][i0 + 1], c = hsSm[j0 + 1][i0], d = hsSm[j0 + 1][i0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
  const N = 300;
  // 局部对比度：每个像素与 5×5 邻域均值的差的 RMS。
  // ⚠ 不能用"整城亮度标准差"当判据（我最初就是这么写的，结果只有 +0.9%）：整城方差被
  //   大尺度色带（深绿→浅绿→雪线）主导，sd 0.0765 里几乎没有局部成分 ——
  //   任何合理幅度的光斑都推不动它。局部对比度才是"光斑看不看得见"对应的量。
  const localRMS = (lums, n, r = 2) => {
    let acc = 0, cnt = 0;
    for (let j = r; j < n - r; j++) {
      for (let i = r; i < n - r; i++) {
        let s = 0, k = 0;
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { s += lums[(j + dj) * n + i + di]; k++; }
        const d = lums[j * n + i] - s / k;
        acc += d * d; cnt++;
      }
    }
    return Math.sqrt(acc / cnt);
  };
  const sample = () => {
    const lums = [];
    const out = [0, 0, 0];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = minX + (i + 0.5) / N * spanX;
        const z = minZ + (j + 0.5) / N * spanZ;
        const h = hAt(x, z);
        F.zoneColor(x, z, h, Math.floor(h / step + 1e-4), out);
        lums.push(0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]);
      }
    }
    const mean = lums.reduce((a, b) => a + b, 0) / lums.length;
    const sd = Math.sqrt(lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length);
    return { mean: +mean.toFixed(4), sd: +sd.toFixed(4), lc: +localRMS(lums, N).toFixed(5), lums };
  };
  window.__noDapple = true;
  const off = sample();
  window.__noDapple = false;
  const on = sample();
  // 逐点差：光斑应该让一部分像素变亮、一部分变暗（斑驳），而不是整体压暗一层
  let sum = 0, brighter = 0, darker = 0;
  for (let k = 0; k < on.lums.length; k++) {
    const d = on.lums[k] - off.lums[k];
    sum += Math.abs(d);
    if (d > 0.002) brighter++;
    else if (d < -0.002) darker++;
  }
  const n = on.lums.length;
  return {
    off: { mean: off.mean, sd: off.sd, lc: off.lc },
    on: { mean: on.mean, sd: on.sd, lc: on.lc },
    lcGain: +((on.lc / off.lc - 1) * 100).toFixed(1),
    dMean: +(on.mean - off.mean).toFixed(4),
    dAvg: +(sum / n).toFixed(4),
    brighterPct: +(brighter / n * 100).toFixed(1),
    darkerPct: +(darker / n * 100).toFixed(1),
  };
});
check(dap.lcGain >= 15, '光斑真的进了贴图（局部对比度提升 ≥15%）', `lc ${dap.off.lc} → ${dap.on.lc}（+${dap.lcGain}%）`);
check(dap.dAvg / dap.on.mean > 0.02, '光斑对地面亮度有明显作用（平均逐点变化 >2%）', `平均 |Δ|=${dap.dAvg}（均值 ${dap.on.mean}）`);
check(dap.brighterPct > 15 && dap.darkerPct > 15, '是"斑驳"（既有变亮也有变暗的像素，不是整体压暗一层）', `变亮 ${dap.brighterPct}% / 变暗 ${dap.darkerPct}%`);
check(dap.dMean <= 0.002, '净亮度不上升（不顶破 check-render 的草地亮度上界）', `Δmean=${dap.dMean}`);

/* ---------- 5) 铺装缝：沿主街应出现周期约 2.2 米的暗纹 ---------- */
const seam = await page.evaluate(() => {
  const g = window.__game;
  const key = (g._currentStage() || {}).key;
  const F = g.world.cityBounds[key].terrainField;
  const { minX, maxX, minZ, maxZ, nx, nz, hsSm, step } = F;
  const spanX = maxX - minX, spanZ = maxZ - minZ, gsz = spanX / nx;
  const hAt = (fx, fz) => {
    const gx = Math.max(0, Math.min(nx, (fx - minX) / gsz));
    const gz = Math.max(0, Math.min(nz, (fz - minZ) / gsz));
    const i0 = Math.min(nx - 1, Math.floor(gx)), j0 = Math.min(nz - 1, Math.floor(gz));
    const tx = gx - i0, tz = gz - j0;
    const a = hsSm[j0][i0], b = hsSm[j0][i0 + 1], c = hsSm[j0 + 1][i0], d = hsSm[j0 + 1][i0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };
  const cx0 = (minX + maxX) / 2, cz0 = (minZ + maxZ) / 2;
  const HZ = (maxZ - minZ) / 2;
  const CELL = 2.2;
  const span = HZ * 0.9;                         // 沿街取 90% 的半跨
  const M = Math.round(span * 2 / 0.12);         // 采样步距 12cm（比缝宽 10cm 略细）
  const out = [0, 0, 0];
  const lum = [];
  for (let k = 0; k <= M; k++) {
    const x = cx0, z = cz0 - span + (k / M) * span * 2;
    const h = hAt(x, z);
    F.zoneColor(x, z, h, Math.floor(h / step + 1e-4), out);
    lum.push(0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]);
  }
  // 检暗纹：局部极小且比两侧 0.6 米内最高点暗 3% 以上
  const half = Math.max(2, Math.round(0.3 / (span * 2 / M)));
  let dips = 0, prevDip = -1e9;
  for (let k = half; k < lum.length - half; k++) {
    let isMin = true;
    for (let d = -half; d <= half; d++) if (d && lum[k + d] < lum[k]) { isMin = false; break; }
    if (!isMin) continue;
    let hi = -1e9;
    for (let d = -half * 2; d <= half * 2; d++) hi = Math.max(hi, lum[k + d] || 0);
    if (hi - lum[k] < hi * 0.03) continue;
    const pos = (k / M) * span * 2 - span;
    if (pos - prevDip < CELL * 0.5) continue;     // 太近的算同一个缝
    prevDip = pos;
    dips++;
  }
  return { dips, expect: +(span * 2 / CELL).toFixed(1), span: +(span * 2).toFixed(1) };
});
check(seam.dips >= seam.expect * 0.6, '沿主街检出周期约 2.2 米的石板缝暗纹', `检出 ${seam.dips} 条 / 期望约 ${seam.expect} 条（街长 ${seam.span} 米）`);

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 地面：斑驳光影 + 铺装材质层全部通过');
if (fails.length) process.exitCode = 1;
