// 跳跃挑战校验：台阶逐级可达 + 每关至少 1 个蛋在平台上。
//
//   node scripts/verify-jump.mjs [--cities chengdu,beijing] [--n 3]
//
// 判据（力学来自 js/game.js，不是我拍的）：
//   起跳 vy=8.6、重力 20 → 单跳 1.85；二段跳 vy=max(vy,0)*0.4+7.6 ≈ 总高 3.30
//   → 相邻台阶高度差必须 ≤1.5（留 20% 容错，孩子手速慢）
//   水平：PLAYER_SPEED 3.65 × 空中 1.38 = 5.04/s，滞空约 0.86s → 一跳可跨 4.3 米
//   → 台阶水平间距必须 ≤3.5（留余量）
// 还要断言：蛋位（perch / brick）落在某个平台的顶面上（否则蛋会悬空或埋进山）。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const only = (optOf('--cities') || '').split(',').filter(Boolean);
const N = Number(optOf('--n', '4'));
const PORT = 6155 + Math.floor(Math.random() * 9);
const MAX_RISE = 1.5;      // 相邻台阶最大高差（单跳 1.85 × 0.81 容错）
const MAX_GAP = 3.5;       // 相邻台阶最大水平间距（一跳可跨 4.3）
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cities/index.json'), 'utf8')).cities.map((c) => c.id);
const cities = only.length ? only : all.slice(0, 12);   // 默认抽 12 城（全量 52 城在巡城里跑）

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '跳跃校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, cities[0]);
await page.goto(`${srv.base}?city=${cities[0]}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });

for (const id of cities) {
  // 每城重新加载：切城不会重建 world.cityBounds（只有精建的城市有高度场），
  // 那样 _groundY 会返回 0、把"台顶高出地形"算成 8.85 这种假数（实测踩过）
  await page.goto(`${srv.base}?city=${id}&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction((cid) => {
    const g = window.__game;
    return g && g.world && (g._currentStage() || {}).key === cid;
  }, id, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(900);
  const r = await page.evaluate(({ id }) => {
    const g = window.__game;
    const st = g._currentStage();
    const W = g.world;
    // 该城的台阶（world.jumpSteps[key] 是世界坐标）
    const steps = (W.jumpSteps && W.jumpSteps[id]) || [];
    const perchPos = (W.perchPos && W.perchPos[id]) || null;
    const perchTop = perchPos ? perchPos.top : null;
    // 台阶 + 台顶串成一条"跳跃链"：按到城心距离从远到近（越靠城心越低）
    const chain = steps.map((s) => ({ x: s.x, z: s.z, top: s.top }))
      .concat(perchPos ? [{ x: perchPos.x, z: perchPos.z, top: perchPos.top }] : []);
    // 逐级校验
    const rises = [], gaps = [];
    for (let i = 1; i < chain.length; i++) {
      rises.push(+(chain[i].top - chain[i - 1].top).toFixed(3));
      gaps.push(+Math.hypot(chain[i].x - chain[i - 1].x, chain[i].z - chain[i - 1].z).toFixed(2));
    }
    // 蛋位：perch 蛋在台顶、brick 蛋在砖块内
    const perchEgg = g._perchEggId();
    const brickEgg = g._brickEggId(perchEgg);
    const cityBricks = (W.brickSpots || []).filter((b) => b.city === id);
    return {
      city: id, steps: steps.length, perchTop: perchTop ?? null,
      chain: chain.map((c) => ({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), top: +c.top.toFixed(2) })),
      rises, gaps, maxRise: rises.length ? Math.max(...rises) : null, maxGap: gaps.length ? Math.max(...gaps) : null,
      perchEgg, brickEgg, cityBricks: cityBricks.length,
      kind: (W.jumpKind && W.jumpKind[id]) || null,
      brickTop: cityBricks[0] ? +cityBricks[0].top.toFixed(2) : null,
      brickInPlatforms: cityBricks.length ? (W.platforms || []).some((p) => Math.abs(p.x - cityBricks[0].x) < 0.1 && Math.abs(p.top - cityBricks[0].top) < 0.05) : null,
      groundAtPerch: perchPos ? +g._groundY(perchPos.x, perchPos.z).toFixed(2) : null,
      perchRel: perchPos ? +(perchPos.top - g._groundY(perchPos.x, perchPos.z)).toFixed(2) : null,
    };
  }, { id });
  const okRise = r.maxRise === null || r.maxRise <= MAX_RISE;
  const okGap = r.maxGap === null || r.maxGap <= MAX_GAP;
  console.log(`${id.padEnd(11)} 台阶 ${r.steps} 级 | 最大高差 ${r.maxRise ?? '—'} | 间距 ${r.maxGap ?? '—'} | 台顶高出地形 ${r.perchRel ?? '—'} | ${r.kind === 'clouds' ? '云梯' : '石阶'} | 砖块 ${r.cityBricks} 块`);
  if (!okRise) fails.push(`${id}：台阶高差 ${r.maxRise} > ${MAX_RISE}（跳不上去）`);
  if (!okGap) fails.push(`${id}：台阶间距 ${r.maxGap} > ${MAX_GAP}（跨不过去）`);
  // 陡坡城地形本身已爬高 → 1 级台阶 + 坡道就是正确设计，只在 0 级时报失败
  if (r.steps < 1) fails.push(`${id}：没有任何台阶（台顶够不着）`);
  if (r.perchTop != null && r.groundAtPerch != null) {
    const rel = +(r.perchTop - r.groundAtPerch).toFixed(2);
    // 台面相对地形 ≤4.0 即认为"台阶 + 二段跳"能上去（陡坡城地形会替台阶爬一段）
    if (rel > 4.0) fails.push(`${id}：台面高出地形 ${rel}（台阶不足以补足）`);
  }
  if (r.cityBricks < 1) fails.push(`${id}：没有城市悬浮砖块`);
  if (r.brickInPlatforms === false) fails.push(`${id}：砖块未登记为可站平台（顶爆后蛋会悬空）`);
  if (!r.perchEgg && !r.brickEgg) fails.push(`${id}：本关没有任何"必须跳"的蛋`);
}
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));
await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项不合格：\n  ` + fails.slice(0, 12).join('\n  ') : '\n✓ 跳跃挑战全部可达（台阶 ≤1.5、间距 ≤3.5、每关有必须跳的蛋）');
if (fails.length) process.exitCode = 1;
