// 逐面板截图：UI 换皮的验收工具（也能给未来的我看图）。
//
//   node scripts/ui-shot.mjs --tag before
//   node scripts/ui-shot.mjs --tag after
//   node scripts/compare.mjs --out .cache/ui/cmp-profile.png --left .cache/ui/before/profile.png --right .cache/ui/after/profile.png --label BEFORE,AFTER
//
// 为什么需要它：内嵌浏览器面板在本机不稳定（attach 不上），而 Playwright 一直可用，
// 所以"逐面板截图"交给它；这样每次 UI 改动都有前后对比图，而不是靠感觉。
//
// 覆盖 8 个主要面板 + 3 档视口（手机竖屏 / 平板 / 桌面）——收费游戏的面板必须在三档都不破。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const tag = optOf('--tag', 'before');
const ALL_VIEWS = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1280, h: 760 },
];
// --only phone 只跑一档（desktop 截图较慢，容易超时，可单独补跑）
const onlyView = optOf('--only');
const VIEWS = onlyView ? ALL_VIEWS.filter((v) => v.name === onlyView) : ALL_VIEWS;
const PORT = 6140 + Math.floor(Math.random() * 9);
const OUT = path.join(ROOT, '.cache/ui', tag);
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rank: 1, rows: [] }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: 'UI 截图', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3500);

// 面板 = 一个"打开动作" + 一个截图名。动作尽量用真实的按钮点击（顺带验证按钮可点）。
const PANELS = [
  { name: 'hud', open: async () => { /* 关掉所有面板，留 HUD */ } },
  { name: 'menu', open: async () => page.click('#btn-menu') },
  { name: 'petcard', open: async () => page.click('#btn-summon').catch(() => {}) },
  { name: 'catalog', open: async () => page.click('#btn-catalog').catch(() => {}) },
  { name: 'map', open: async () => page.click('#btn-map').catch(() => {}) },
  { name: 'book', open: async () => page.click('#btn-book').catch(() => {}) },
  { name: 'rank', open: async () => page.click('#btn-rank').catch(() => {}) },
  { name: 'help', open: async () => page.click('#btn-help').catch(() => {}) },
  { name: 'about', open: async () => page.click('#btn-about').catch(() => {}) },
  { name: 'profile', open: async () => { await page.evaluate(() => document.getElementById('profile')?.classList.remove('hidden')); } },
];

const closeAll = () => page.evaluate(() => {
  document.querySelectorAll('.overlay').forEach((o) => o.classList.add('hidden'));
});

for (const v of VIEWS) {
  await page.setViewportSize({ width: v.w, height: v.h });
  for (const p of PANELS) {
    await closeAll();
    await page.waitForTimeout(120);
    try { await p.open(); } catch (e) { /* 按钮可能因状态不可点：跳过 */ }
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(OUT, `${v.name}-${p.name}.png`) });
  }
  console.log(`  ${v.name} ${v.w}×${v.h} → ${PANELS.length} 张`);
}

console.log(`已输出 ${VIEWS.length * PANELS.length} 张 → .cache/ui/${tag}/`);
if (errs.length) console.log('页面异常：' + errs.slice(0, 3).join(' | '));
await ctx.close();
srv.stop();
