// 验证接触阴影：玩家脚下有一张贴地阴影，且随高度放大变淡
import { serve, launch } from './browser.mjs';

const PORT = 6169;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript(() => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: '阴影校验', registered: true, city: 'chengdu', gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) {}
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  for (let i = 0; i < 10; i++) await frame();
  const sh = g.player.userData.cshadow;
  if (!sh) return { has: false };
  const a = { scale: +sh.scale.x.toFixed(3), opacity: +sh.material.opacity.toFixed(3), y: +sh.position.y.toFixed(3), visible: sh.visible };
  // 抬高玩家 → 阴影应变大变淡
  const gy = g._groundY(g.player.position.x, g.player.position.z);
  g.player.position.y = gy + 2.0;
  for (let i = 0; i < 6; i++) await frame();
  const b = { scale: +sh.scale.x.toFixed(3), opacity: +sh.material.opacity.toFixed(3), y: +sh.position.y.toFixed(3) };
  g.player.position.y = gy;
  for (let i = 0; i < 6; i++) await frame();
  const c = { scale: +sh.scale.x.toFixed(3), opacity: +sh.material.opacity.toFixed(3) };
  return { has: true, ground: a, high: b, back: c, isTouch: g.isTouch, renderOrder: sh.renderOrder, noPick: !!sh.userData.noPick };
});
console.log(JSON.stringify(r, null, 1));
console.log('页面异常:', errs.length ? errs.slice(0, 3) : '无');
await ctx.close();
srv.stop();
