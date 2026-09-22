// 确认"云梯"形态的城市里，云朵对象真的在场景中（不只是登记了 jumpKind）
import { serve, launch } from './browser.mjs';

const city = process.argv[2] || 'guiyang';
const PORT = 6170;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript((c) => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: '云梯校验', registered: true, city: c, gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) {}
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(4000);
console.log(JSON.stringify(await page.evaluate((c) => {
  const W = window.__game.world;
  const steps = (W.jumpSteps && W.jumpSteps[c]) || [];
  const kind = (W.jumpKind && W.jumpKind[c]) || null;
  // 云梯动画表里属于本城的条目（按 baseY 与台阶顶面匹配）
  const anim = (W.anim.cloudStair || []).filter((a) => steps.some((s) => Math.abs(s.top - (a.pf.top || a.pf.baseTop)) < 0.2));
  const perches = (W.platforms || []).filter((p) => (W.perchPos && W.perchPos[c]) && Math.abs(p.x - W.perchPos[c].x) < 0.2 && Math.abs(p.z - W.perchPos[c].z) < 0.2);
  return {
    city: c, kind, steps: steps.length,
    stepTops: steps.map((s) => s.top),
    cloudAnimEntries: anim.length,
    bobbed: anim.filter((a) => a.pf.bob).length,
    perchPlatform: perches.length,
    perchTop: perches[0] ? +perches[0].top.toFixed(2) : null,
    brickSpotsForCity: (W.brickSpots || []).filter((b) => b.city === c).length,
  };
}, city), null, 1));
await ctx.close();
srv.stop();
