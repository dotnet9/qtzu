// 天空群岛出图（肉眼验收）：鸟瞰全景 / 栈桥 / 气流 / 宝箱。
//   node scripts/skyisles-shot.mjs [--city chengdu]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6230 + Math.floor(Math.random() * 9);
const OUT = path.resolve(import.meta.dirname, '../.cache/look/skyisles');
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1100, height: 660 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rows: [] }) }));
const page = await ctx.newPage();
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: '天空群岛', registered: true, city: c, gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3500);

// 出图 + 可见性回打：从相机往每个目标打一条射线，报"画面上第一个可见的东西"，
// 免得出现"图出了但镜头对着空海"这种看不见的假通过。
const shot = async (name, fn) => {
  await page.evaluate(fn);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const vis = await page.evaluate(async () => {
    const THREE = await import('three');
    const g = window.__game;
    const sky = g._sky();
    const rc = new THREE.Raycaster();
    rc.camera = g.camera;   // Sprite 的 raycast 需要它，不然打射线会抛错
    const targets = [
      { n: '主岛', p: sky.isles[0] }, { n: '末岛', p: sky.isles[sky.isles.length - 1] },
      { n: '宝箱', p: sky.chest }, { n: '风车', p: sky.mill }, { n: '旗', p: sky.flag },
      { n: '墙根平台', p: { x: sky.wall.x, y: sky.wall.top, z: sky.wall.z } },
    ];
    const visChain = (o) => { let c = o; while (c) { if (c.visible === false) return false; c = c.parent; } return true; };
    return targets.filter((t) => t.p).map((t) => {
      const v = new THREE.Vector3(t.p.x, (t.p.y || t.p.top) + 1.0, t.p.z);
      const dir = v.clone().sub(g.camera.position).normalize();
      rc.set(g.camera.position, dir);
      rc.far = 900;
      const hits = rc.intersectObjects(g.scene.children, true).filter((h) => visChain(h.object));
      return `${t.n}: ${hits.length ? hits[0].object.type + '@' + hits[0].distance.toFixed(0) : '（被挡住/不在画面）'}`;
    });
  });
  console.log('→', `.cache/look/skyisles/${name}.png`, '|', vis.join(' | '));
};

const at = (dx, dz, y, dist, pitch, yaw) => ({ dx, dz, y, dist, pitch, yaw });

// 全景：站远一点、抬高机位，把整条岛链看全
await shot('overview', () => {
  const g = window.__game;
  g._lowFx = true;
  const sky = g._sky();
  const i0 = sky.isles[0], i4 = sky.isles[sky.isles.length - 1];
  const mx = (i0.x + i4.x) / 2, mz = (i0.z + i4.z) / 2;
  g.player.position.set(mx, 15, mz);
  g.camYaw = 0.6; g.camPitch = 0.42; g.camDist = g.camDistTarget = 46;
  g._updateCamera(1);
});

// 栈桥：站在长城马道那一端
await shot('bridge', () => {
  const g = window.__game;
  const sky = g._sky();
  g.player.position.set(sky.wall.x, sky.wall.top, sky.wall.z);
  g.camYaw = Math.atan2(sky.isles[0].x - sky.wall.x, sky.isles[0].z - sky.wall.z);
  g.camPitch = 0.3; g.camDist = g.camDistTarget = 16;
  g._updateCamera(1);
});

// 气流：站在地面光圈里
await shot('lift', () => {
  const g = window.__game;
  const sky = g._sky();
  g.player.position.set(sky.lift.x, 0, sky.lift.z);
  g.camPitch = 0.16; g.camDist = g.camDistTarget = 18;
  g._updateCamera(1);
});

// 宝箱：站到小岛上
await shot('chest', () => {
  const g = window.__game;
  const sky = g._sky();
  g.player.position.set(sky.chest.x, sky.chest.y, sky.chest.z + 3);
  g.camPitch = 0.3; g.camDist = g.camDistTarget = 9;
  g._updateCamera(1);
});

await ctx.close();
srv.stop();
