// 验证 NPC 重建：腿是 Group（动画契约）、走路摆腿生效、两个 Sprite 仍在、道具/脸都在
import { serve, launch } from './browser.mjs';

const PORT = 6163;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await page.addInitScript(() => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: 'x', registered: true, city: 'chengdu', gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) {}
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(4000);

const out = await page.evaluate(async () => {
  const g = window.__game;
  const list = (g.npcs && g.npcs.npcs) || [];
  const n0 = list[0];
  if (!n0) return { count: 0 };
  const countKids = (o, pred) => { let n = 0; o.traverse((q) => { if (pred(q)) n++; }); return n; };
  const meshes = countKids(n0.group, (q) => q.isMesh);
  const sprites = countKids(n0.group, (q) => q.isSprite);
  const tris = (() => { let t = 0; n0.group.traverse((q) => { if (q.isMesh && q.geometry) { const idx = q.geometry.index; t += (idx ? idx.count : q.geometry.attributes.position.count) / 3; } }); return Math.round(t); })();
  // 走路摆腿：把 target 设远一点，跑几帧看 legL.position.z 是否变化
  const before = +n0.legL.position.z.toFixed(4);
  n0.target.set(n0.home.x + 3, n0.home.y + 3);
  const seen = new Set();
  for (let i = 0; i < 30; i++) { await new Promise((r) => requestAnimationFrame(r)); seen.add(n0.legL.position.z.toFixed(3)); }
  const after = +n0.legL.position.z.toFixed(4);
  return {
    count: list.length,
    legIsGroup: n0.legL.isGroup === true,
    legRIsGroup: n0.legR.isGroup === true,
    legZBefore: before, legZAfter: after, legZDistinct: seen.size,
    meshes, sprites, tris,
    hasFace: n0.group.children.some((c) => c.isGroup && c.children.some((k) => k.isMesh)),
    isGroup: n0.group.isGroup === true,
  };
});
console.log(JSON.stringify(out, null, 1));
console.log('页面异常:', errs.length ? errs.slice(0, 3) : '无');
await ctx.close();
srv.stop();
