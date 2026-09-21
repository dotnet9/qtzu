// 重写 verify-ground-fit.mjs 的采样与判定：
//  1) 采样点取**地形网格的格点**（spec 的 cellIn=1 的 (i,j) → 局部 (minX+i*gsz, minZ+j*gsz) → 世界 = 局部 + (cx,cz)）。
//     只有格点上，"程序化高度场"与"烘焙网格顶点"理论上必须逐个相等 → Δ≈0 才是真同源；
//     格点之间必然有线性插值差（1.5 单位网格，坡度上可到 ~0.3），拿它当判据会误报。
//  2) 上一版还踩了两个坑：把世界坐标当局部传给 _groundY（差一个城心偏移），
//     以及射线打到**院墙**（y=3）当成"地面高度不对"。现在只在城内远离轮廓处取样，并取"最接近期望值"的命中。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const tol = Number(optOf('--tol', '0.12'));
const N = Number(optOf('--n', '48'));
const PORT = 6190 + Math.floor(Math.random() * 9);

// 从规格里挑格点：cellIn=1（在轮廓内）+ 跳过靠近轮廓的（避墙）
const specOf = (c) => {
  const one = path.join(ROOT, `scripts/bake/specs/ground.${c}.json`);
  if (fs.existsSync(one)) return JSON.parse(fs.readFileSync(one, 'utf8')).specs[0];
  const all = path.join(ROOT, 'scripts/bake/specs/ground.all.json');
  if (fs.existsSync(all)) {
    const hit = JSON.parse(fs.readFileSync(all, 'utf8')).specs.find((x) => x.city === c || x.id === c);
    if (hit) return hit;
  }
  throw new Error(`找不到 ${c} 的地面规格（逐城与合并文件都没有）—— 先跑 run.mjs --kinds ground`);
};
const spec = specOf(city);
const g0 = spec.grid;
const cells = [];
for (let j = 0; j < g0.nz; j++) {
  for (let i = 0; i < g0.nx; i++) if (spec.cellIn[j][i]) cells.push([i, j]);
}
// 等距抽样（保证覆盖全城而不是挤在一角）
const step = Math.max(1, Math.floor(cells.length / N));
const picked = [];
for (let k = 0; k < cells.length && picked.length < N; k += step) {
  const [i, j] = cells[k];
  // 离轮廓太近的格点会被院墙/垛口挡住射线：用"四邻是否都在城内"做一次粗筛
  const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]
    .every(([di, dj]) => i + di >= 0 && j + dj >= 0 && i + di < g0.nx && j + dj < g0.nz && spec.cellIn[j + dj][i + di]);
  if (!near) continue;
  picked.push({ lx: g0.minX + i * g0.gsz, lz: g0.minZ + j * g0.gsz, expect: spec.qy[j][i] });
}
console.log(`[fit] ${city} 选用 ${picked.length} 个城内格点（网格 ${g0.nx}x${g0.nz}，gsz ${g0.gsz}）`);

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '贴地校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  let slot = null;
  if (window.__game && window.__game.scene) {
    window.__game.scene.traverse((o) => { if (o.name === 'ground-slot') slot = o; });
  }
  const st = window.__assets && window.__assets.stats();
  return (slot && slot.children.length > 0) || (st && st.failed.some((f) => /^ground\//.test(f)));
}, null, { timeout: 40000 }).catch(() => {});

const out = await page.evaluate(({ picked }) => {
  const g = window.__game;
  const st = g._currentStage();
  let slot = null;
  g.scene.traverse((o) => { if (o.name === 'ground-slot') slot = o; });
  if (!slot || !slot.children.length) return { swapped: false };
  const meshes = [];
  slot.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const ray = new window.THREE.Raycaster();
  const down = new window.THREE.Vector3(0, -1, 0);
  const res = [];
  for (const p of picked) {
    const wx = p.lx + st.cx, wz = p.lz + st.cz;      // 城组在 (cx,cz)，规格坐标是局部的
    const expect = g._groundY(wx, wz);
    ray.set(new window.THREE.Vector3(wx, expect + 60, wz), down);
    const hits = ray.intersectObjects(meshes, true);
    if (!hits.length) { res.push({ lx: p.lx, lz: p.lz, expect: +expect.toFixed(3), got: null, d: null }); continue; }
    // 取"最接近期望高度"的命中：避免把院墙顶(y=3)/雪峰面当成地面
    let best = hits[0];
    for (const h2 of hits) if (Math.abs(h2.point.y - expect) < Math.abs(best.point.y - expect)) best = h2;
    res.push({ lx: p.lx, lz: p.lz, expect: +expect.toFixed(3), got: +best.point.y.toFixed(3), d: +(best.point.y - expect).toFixed(3) });
  }
  const hits = res.filter((r) => r.d !== null);
  const devs = hits.map((r) => Math.abs(r.d));
  return {
    swapped: true, meshes: meshes.length, samples: res.length, hits: hits.length,
    maxDev: devs.length ? Math.max(...devs) : null,
    meanDev: devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : null,
    worst: hits.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 6),
    missed: res.filter((r) => r.d === null).slice(0, 6),
  };
}, { picked });

if (!out.swapped) {
  console.log(`✗ ${city}：没有等到地面换装（ground-slot 为空）`);
  process.exitCode = 1;
} else {
  console.log(`${city}：网格 ${out.meshes} 个，格点采样 ${out.samples}、命中 ${out.hits}`);
  console.log(`  偏差 最大 ${out.maxDev?.toFixed(3)} / 均值 ${out.meanDev?.toFixed(3)}（门槛 ≤${tol}）`);
  if (out.worst?.length) console.log('  最差的几个：' + out.worst.map((w) => `(${w.lx.toFixed(0)},${w.lz.toFixed(0)}) 期望 ${w.expect} 实得 ${w.got} Δ${w.d}`).join('；'));
  if (out.missed?.length) console.log('  未命中：' + out.missed.map((m) => `(${m.lx.toFixed(0)},${m.lz.toFixed(0)})`).join(' '));
  const ok = out.maxDev !== null && out.maxDev <= tol && out.hits >= Math.min(40, out.samples);
  if (!ok) {
    console.log(`✗ 贴地一致性不达标（命中 ${out.hits}/${out.samples}，最大偏差 ${out.maxDev?.toFixed(3)} > ${tol}）`);
    process.exitCode = 1;
  } else console.log('✓ 贴地一致（程序化高度场与烘焙网格逐个格点相符，脚不会陷地/浮空）');
}
if (errs.length) console.log('页面异常：' + errs.slice(0, 3).join(' | '));
await ctx.close();
srv.stop();
