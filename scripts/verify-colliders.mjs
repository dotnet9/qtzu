// 验证碰撞体坐标：街道家具的碰撞体必须"跟着家具走"（世界坐标），而不是堆在岛心
// 判据：把 colliders 与场景里家具网格的世界位置做最近邻匹配，平均距离应接近 0。
import { serve, launch } from './browser.mjs';

const PORT = 6161;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript(() => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: '碰撞校验', registered: true, city: 'chengdu', gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) {}
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(5000);

const r = await page.evaluate(() => {
  const g = window.__game;
  const st = g._currentStage();
  const cols = (g.world.colliders || []).filter((c) => c.t === 'c');
  // 距离城心的分布（世界坐标）
  const dists = cols.map((c) => Math.hypot(c.x - st.cx, c.z - st.cz));
  // 家具网格（街道家具没有名字，用"几何特征"粗筛：Group 且含路灯特征高度）
  const meshes = [];
  g.scene.traverse((o) => {
    if (o.isGroup && o.parent && o.parent.name === '' && o.children.length >= 4) {
      const wp = new window.THREE.Vector3();
      o.getWorldPosition(wp);
      if (Math.abs(wp.y) < 40) meshes.push([wp.x, wp.z]);
    }
  });
  // 每个碰撞体到最近网格的距离（若碰撞体与网格都正确，应普遍很小）
  let near = 0, far = 0;
  for (const c of cols) {
    let best = Infinity;
    for (const m of meshes) best = Math.min(best, Math.hypot(m[0] - c.x, m[1] - c.z));
    if (best < 1.5) near++; else far++;
  }
  const farFromCenter = dists.filter((d) => d > st.r * 0.5).length;
  return {
    city: st.key, r: st.r, center: [+st.cx.toFixed(1), +st.cz.toFixed(1)],
    colliders: cols.length,
    distMin: +Math.min(...dists).toFixed(2), distMax: +Math.max(...dists).toFixed(2),
    farFromCenter, nearMesh: near, farFromMesh: far,
    meshCount: meshes.length,
  };
});
console.log(JSON.stringify(r, null, 1));
await ctx.close();
srv.stop();
