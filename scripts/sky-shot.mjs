// 出一张"天空加云前后"的对比图（供肉眼验收 ⑩）。
// 同一机位、同一帧，只切云层可见性 —— 差异全部来自云本身。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const PORT = 6200 + Math.floor(Math.random() * 9);
const OUT = path.resolve(import.meta.dirname, '../.cache/look/sky10');
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 620 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rows: [] }) }));
const page = await ctx.newPage();
await page.addInitScript(() => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: '天空', registered: true, city: 'chengdu', gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3200);

const pose = () => page.evaluate(() => {
  const g = window.__game;
  g._lowFx = true;
  g.lockInput = false; g.cinematic = false;
  g.camDist = 40; g.camPitch = 0.55; g.camYaw = 0.4;   // 抬头看天
  if (g._updateCamera) g._updateCamera(0.016);
});
const setClouds = (v) => page.evaluate((on) => {
  const g = window.__game;
  for (const x of (g.world.anim.skyClouds || [])) x.mesh.visible = on;
}, v);

await pose();
await setClouds(true);
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'sky-with-clouds.png') });
await setClouds(false);
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'sky-no-clouds.png') });
console.log('→ .cache/look/sky10/sky-{with,no}-clouds.png');

await ctx.close();
srv.stop();
