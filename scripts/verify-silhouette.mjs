// 把玩家渲染成 ASCII 剪影（从背后，与用户截图相近）。
// 关键修正：玩家在世界坐标 (≈601, 0, 222)，必须**临时挪到原点**再渲染，否则相机看不到它。
import { serve, launch } from './browser.mjs';

const PORT = 6166;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '剪影', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const THREE = window.THREE;
  const g = window.__game;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.AmbientLight(0xffffff, 2.4));
  const dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(2, 5, -3);      // 从背后打光（与观察方向同侧）
  scene.add(dir);
  const origParent = g.player.parent;
  const p0 = g.player.position.clone(), r0 = g.player.rotation.clone();
  scene.add(g.player);
  g.player.position.set(0, 0, 0);
  g.player.rotation.set(0, 0, 0);
  g.player.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 30);
  cam.position.set(0, 0.95, -2.4);          // 背后（玩家朝 +z）
  cam.lookAt(0, 0.58, 0);
  const W = 56, H = 56;
  const rt = new THREE.WebGLRenderTarget(W, H);
  const buf = new Uint8Array(W * H * 4);
  const prevRT = g.renderer.getRenderTarget();
  g.renderer.setRenderTarget(rt);
  g.renderer.render(scene, cam);
  g.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  g.renderer.setRenderTarget(prevRT);
  // 还原
  g.player.position.copy(p0); g.player.rotation.copy(r0);
  if (origParent) origParent.add(g.player);
  const lines = [];
  const ramp = ' .:-=+*#%@';
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const k = ((H - 1 - y) * W + x) * 4;
      const lum = (buf[k] + buf[k + 1] + buf[k + 2]) / 3;
      line += lum > 245 ? ' ' : ramp[Math.min(9, Math.max(1, Math.round((255 - lum) / 26)))];
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  // 腿部区域（图像下 35%）的竖条
  const legStart = Math.floor(H * 0.66);
  const colHits = new Array(W).fill(0);
  for (let y = legStart; y < H; y++) for (let x = 0; x < W; x++) if (lines[y][x] && lines[y][x] !== ' ') colHits[x]++;
  const bars = [];
  let start = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && colHits[x] >= 2;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { bars.push([start, x - 1]); start = -1; }
  }
  return { art: lines.join('\n'), bars, covered: colHits.filter((n) => n > 0).length };
});

console.log('玩家剪影（背后视角，56×56；上=头 下=脚）:\n');
console.log(out.art);
console.log(`\n腿部区域竖条：${out.bars.length} 根 → ${out.bars.map(([a, b]) => `列${a}~${b}`).join('，')}`);
console.log(`腿部有内容的列数：${out.covered}`);
await ctx.close();
srv.stop();
