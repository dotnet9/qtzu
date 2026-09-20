// 资产校对与验收：把烘焙出的 GLB 渲染成对照图（同游戏的光照/色调映射），
// 并收集加载错误与缺失清单。
//
//   node scripts/verify-assets.mjs --kind gate --city chengdu
//   node scripts/verify-assets.mjs --kind gate --city chengdu --view front --zoom 1.3
//   node scripts/verify-assets.mjs --kind gate --all --cols 8 --cell 320
//
// 输出：.cache/shots/<name>.png（对照图）+ 控制台清单
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const kind = optOf('--kind', 'gate');
const city = optOf('--city');
const cols = optOf('--cols', '5');
const cell = optOf('--cell', '460');
const zoom = optOf('--zoom', '1.12');
const views = (optOf('--view', 'iso') === 'both') ? ['iso', 'front'] : [optOf('--view', 'iso')];
const DIRS = { iso: '0.5,0.5,1', front: '0.06,0.06,1', side: '1,0.1,0.15' };
const ascii = has('--ascii') ? Number(optOf('--ascii', '4')) : 0;   // 打印前 N 个的文字剪影
const pair = has('--pair');   // 每格左右并排"烘焙 GLB / 程序化回退"（成都试点验收图）
const PORT = 6100 + Math.floor(Math.random() * 60);

fs.mkdirSync(path.join(ROOT, '.cache/shots'), { recursive: true });
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: Number(cell) * Number(cols), height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const shots = [];
for (const view of views) {
  const q = new URLSearchParams({ kind, cols, cell, zoom, dir: DIRS[view] || DIRS.iso,
    ...(ascii ? { qa: '1' } : {}), ...(pair ? { pair: '1' } : {}),
    ...(city ? { city } : {}), ...(has('--ids') ? { ids: optOf('--ids') } : {}) });
  await page.goto(`${srv.base}scripts/assets-view.html?${q}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  } catch (e) {
    const status = await page.evaluate(() => document.getElementById('status')?.textContent).catch(() => '?');
    console.log(`校对台未就绪（${status}）` + (errors.length ? '，页面错误：\n  ' + errors.slice(0, 10).join('\n  ') : ''));
    throw e;
  }
  const size = await page.evaluate(() => {
    const c = document.getElementById('sheet');
    return { w: c.width, h: c.height, count: document.querySelectorAll('#labels div').length };
  });
  await page.setViewportSize({ width: size.w, height: Math.min(size.h, 2200) });
  await page.waitForTimeout(350);
  const name = `${kind}${city ? '-' + city : '-all'}${pair ? '-pair' : ''}${view === 'iso' ? '' : '-' + view}.png`;
  const out = path.join(ROOT, '.cache/shots', name);
  await page.screenshot({ path: out });
  const missing = await page.evaluate(() => window.__missing || []);
  shots.push({ name, count: size.count, missing: missing.length });
  console.log(`${name}  资产 ${size.count} 个${missing.length ? `，缺失 ${missing.length}: ${missing.slice(0, 6).join(', ')}` : '，无缺失'}`);
  if (missing.length) console.log('  缺失清单', JSON.stringify(missing.slice(0, 40)));
  // 文字剪影 + 实测尺寸：没有眼睛时的自检手段（--ascii N 打印前 N 个）
  if (ascii) {
    const stats = await page.evaluate(() => window.__cells());
    const bad = stats.filter((s) => s.aspect < 0.55 || s.aspect > 3.2 || s.cover < 0.03);
    console.log(`\n尺寸体检（宽高比 / 覆盖占比）：异常 ${bad.length}/${stats.length}`);
    for (const s of bad) console.log(`  ⚠ ${s.zh} ${s.style} aspect=${s.aspect} cover=${s.cover}`);
    for (let i = 0; i < Math.min(ascii, stats.length); i++) {
      const s = stats[i];
      const art = await page.evaluate((k) => window.__ascii(k, 46, 22), i);
      console.log(`\n── [${i}] ${s.zh}${s.style ? ' · ' + s.style : ''}  aspect=${s.aspect} cover=${s.cover}\n${art}`);
    }
  }
}

await ctx.close();
srv.stop();
if (errors.length) {
  console.log(`\n页面错误 ${errors.length} 条：`);
  for (const e of errors.slice(0, 20)) console.log('  ' + e);
  process.exitCode = 1;
} else {
  console.log('\n无控制台错误 ✓');
}
console.log('对照图：' + shots.map((s) => '.cache/shots/' + s.name).join('  '));
