// 城墙/敌楼特写出图（供肉眼验收）：
//   1) tower.png —— 敌楼近景（双层檐 + 正脊 + 起翘 + 宝顶火盆）
//   2) wall.png  —— 城墙中段近景（马道 + 女墙 + 垛口 + 箭孔 + 收分 + 条石基座）
//   3) edge.png  —— 从城内看墙（另存一份带 HUD 的全景感）
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const PORT = 6420 + Math.floor(Math.random() * 9);
const OUT = path.resolve(import.meta.dirname, '../.cache/look/wall-close');
fs.mkdirSync(OUT, { recursive: true });
// --hour：把页面时钟钉在指定小时，让光照/天色可复现（前后对照必须同一时刻）
const HOUR_RAW = (() => { const i = process.argv.indexOf('--hour'); return i > 0 ? process.argv[i + 1] : null; })();
const HOUR = HOUR_RAW == null ? null : Number(HOUR_RAW);

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1280, height: 760 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '长城', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
});
if (HOUR != null) {
  await page.addInitScript((h) => {
    Date.prototype.getHours = function () { return h; };
    Date.prototype.getMinutes = function () { return 0; };
  }, HOUR);
}
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const g = window.__game;
  let slot = null;
  g.scene.traverse((o) => { if (!slot && o.name === 'ground-slot') slot = o; });
  return !!(slot && slot.children.length);
}, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

const shot = async (name, setup) => {
  await page.evaluate(setup);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('→ ' + path.relative(path.resolve(import.meta.dirname, '..'), path.join(OUT, name + '.png')));
};

// 敌楼近景：找一座烽火台，把镜头压低、贴近
await shot('tower', () => {
  const g = window.__game;
  g._lowFx = true;
  g.lockInput = true;
  [...document.querySelectorAll('.overlay')].forEach((o) => o.classList.add('hidden'));
  [...document.querySelectorAll('#quest,#npc-bubble,#loading,#hud')].forEach((o) => o.classList.add('hidden'));
  let b = null;
  g.scene.traverse((o) => { if (!b && o.userData && o.userData.beacons) b = o.userData.beacons[0]; });
  const st = g._currentStage();
  // 相机绕到烽火台外侧、低角度（看屋顶的起翘与正脊）
  g.camYaw = Math.atan2(b.wx - st.cx, b.wz - st.cz) + Math.PI;   // 从城外看
  g.camPitch = 0.16;
  g.camDist = g.camDistTarget = 13;
  g.player.position.set(b.wx - 2, 0, b.wz - 2);
  if (g._updateCamera) g._updateCamera(0.016);
});

// 城墙中段近景：贴着墙看马道/垛口/基座
await shot('wall', () => {
  const g = window.__game;
  const st = g._currentStage();
  // 沿轮廓找一个采样点：用城墙几何的包围盒推一个位置（城墙上取正东方向）
  const R = st.r * 0.98;
  g.player.position.set(st.cx + R, 0, st.cz);
  g.camYaw = Math.PI * 0.5;
  g.camPitch = 0.30;
  g.camDist = g.camDistTarget = 11;
  if (g._updateCamera) g._updateCamera(0.016);
});

// 从城内看墙：把 HUD 放回来，像玩家实际看到的画面
await shot('edge', () => {
  const g = window.__game;
  const st = g._currentStage();
  [...document.querySelectorAll('#hud')].forEach((o) => o.classList.remove('hidden'));
  const R = st.r * 0.62;
  g.player.position.set(st.cx + R, 0, st.cz + R * 0.5);
  g.camYaw = Math.PI * 0.25;
  g.camPitch = 0.34;
  g.camDist = g.camDistTarget = 16;
  if (g._updateCamera) g._updateCamera(0.016);
});

await ctx.close();
srv.stop();
