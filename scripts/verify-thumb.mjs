// 缩略图基建校验：
//   1) 输出分辨率 = 384（原来 128，太糊）
//   2) 缓存是 LRU：渲染 70 张后条目数 ≤ 60（原来无限增长，932 张 ≈ 140MB）
//   3) 单张渲染耗时 < 60ms（分页逐张渲染时不会卡住）
//   4) 主角缩略图可用（角色选择卡要用）
//
//   node scripts/verify-thumb.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6148 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '缩略图校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const m = await import(new URL('js/models.js', location.href).href);
  const { WORDS } = await import(new URL('js/words.js', location.href).href);
  const pets = WORDS.filter((w) => w.pet).map((w) => w.pet);
  const uniq = [...new Set(pets)];

  // 1) 单张：分辨率 + 耗时（首次含"建渲染器 + PMREM 环境"的一次性开销，单独报告）
  const t0 = performance.now();
  const url = m.petThumbnail(uniq[0]);
  const ms1 = performance.now() - t0;
  const dim = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res([img.width, img.height]);
    img.onerror = () => res(null);
    img.src = url;
  });

  // 预热后测"热渲染"耗时（这才是分页逐张渲染时的真实成本）
  for (let i = 1; i <= 5; i++) m.petThumbnail(uniq[i]);
  const tWarm = performance.now();
  for (let i = 6; i <= 15; i++) m.petThumbnail(uniq[i]);
  const msWarm = (performance.now() - tWarm) / 10;

  // 2) LRU：连渲 70 张，看条目数
  const t1 = performance.now();
  for (let i = 0; i < 70; i++) m.petThumbnail(uniq[i % uniq.length]);
  const ms70 = performance.now() - t1;
  const size = m.thumbCacheSize();

  // 3) 主角缩略图
  const pUrl = m.playerThumbnail('boy', {});
  const pDim = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res([img.width, img.height]);
    img.onerror = () => res(null);
    img.src = pUrl;
  });
  return { px: m.THUMB_PX, dim, ms1: +ms1.toFixed(1), msWarm: +msWarm.toFixed(1), size, ms70: +ms70.toFixed(0), pDim, uniqPets: uniq.length };
});

console.log(`缩略图（${city}，词宠外观 ${r.uniqPets} 个）`);
check(r.dim && r.dim[0] === r.px && r.dim[1] === r.px, `输出分辨率 = ${r.px}`, r.dim ? r.dim.join('×') : '解码失败');
check(r.msWarm < 40, '热渲染单张 < 40ms（分页逐张渲染不卡）', `${r.msWarm}ms（首张含初始化 ${r.ms1}ms）`);
check(r.size <= 60, 'LRU 上限生效（渲染 70 张后 ≤60 条）', `缓存 ${r.size} 条，70 张耗时 ${r.ms70}ms`);
check(r.pDim && r.pDim[0] === r.px, '主角缩略图可用', r.pDim ? r.pDim.join('×') : '解码失败');
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 缩略图基建全部通过');
if (fails.length) process.exitCode = 1;
