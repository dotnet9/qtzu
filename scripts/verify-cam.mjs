// 镜头跟随校验（四条断言，全部用真实运行状态，不靠猜）：
//   1) 走路转身后 camYaw 会向 player.rotation.y 收敛（跟随生效）
//   2) 拖拽镜头后 1.2 秒内 camYaw 不被自动改动（尊重"孩子想自己看"）
//   3) 关掉开关后完全不跟
//   4) 远景（camDistTarget > 45）时不跟
//   5) 连续走路 3 秒 camYaw 不会持续自转（防"镜头与前进方向互相追着转"）
//
//   node scripts/verify-cam.mjs [--city chengdu]
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6152 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '镜头校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const diff = (a, b) => Math.abs(ang(a - b));
  const out = {};

  // 诊断脚本专用：清空碰撞体，保证小人能一直走（否则几帧后就被卡住 → moving=false → 跟随不触发）
  const savedColliders = g.world.colliders;
  g.world.colliders = [];

  const walk = (basis, camYaw, frames, hold = 0) => {
    g.camYaw = camYaw;
    g._camHold = hold;
    g._moveBasisYaw = basis;
    g.keys.add('KeyW');
    return (async () => {
      for (let i = 0; i < frames; i++) await frame();
      g.keys.delete('KeyW');
      return g.camYaw;
    })();
  };

  window.__save.setCamFollow(true);
  g.lockInput = false; g.cinematic = false;
  g.camDistTarget = 6.6; g.camDist = 6.6;

  // 先量映射：走一小段，读小人实际朝向 P（实测 P = basis + π）
  await walk(0, 0, 6);
  const P0 = ang(g.player.rotation.y);
  out.map = { basis0_playerYaw: +P0.toFixed(3) };

  // ① 收敛：让镜头偏离小人朝向 2.0 rad，走 80 帧（≈1.3s）→ 应追到 ≈P
  const B = P0;                        // 用一个固定 basis，小人朝向 ≈ B + π
  const heading = ang(B + Math.PI);
  g._camFollowing = false;
  out.follow = { from: +ang(heading - 2.0).toFixed(3), to: +(await walk(B, ang(heading - 2.0), 120)).toFixed(3), target: +heading.toFixed(3) };
  out.follow.gap = +diff(out.follow.to, heading).toFixed(3);

  // ② 拖拽后暂停：camYaw 应停在原处
  out.hold = { yaw: +(await walk(B, 0.3, 20, 1.2)).toFixed(3), holdLeft: +g._camHold.toFixed(2) };

  // ③ 关掉开关：不跟
  window.__save.setCamFollow(false);
  out.off = { yaw: +(await walk(B, -0.4, 30)).toFixed(3) };
  window.__save.setCamFollow(true);

  // ④ 远景：不跟
  g.camDistTarget = 80; g.camDist = 80;
  out.far = { yaw: +(await walk(B, -0.4, 30)).toFixed(3) };
  g.camDistTarget = 6.6; g.camDist = 6.6;

  // ⑤ 死区：镜头只偏离朝向 0.6 rad（< 1.05）→ 不该跟
  const dz = ang(heading + 0.6);
  g._camFollowing = false;   // 复位滞回：未开始跟时，0.6 rad 的偏差不该启动跟随
  out.deadzone = { yaw: +(await walk(B, dz, 30)).toFixed(3), expect: +dz.toFixed(3) };

  // ⑥ 不自转：镜头与朝向一致 → 3 秒内漂移应极小
  const y = await walk(B, heading, 90);
  out.spin = { yaw: +y.toFixed(4), drift: +diff(y, heading).toFixed(4) };

  g.keys.delete('KeyW');
  g.world.colliders = savedColliders;   // 还原
  return out;
});

console.log(`镜头跟随（${city}）  映射：basis0 → 小人朝向 ${r.map.basis0_playerYaw}`);
check(r.follow.gap < 0.15, '走路转身后镜头会收敛到背后', `从 ${r.follow.from} → ${r.follow.to}（目标 ${r.follow.target}，差 ${r.follow.gap}）`);
check(Math.abs(r.hold.yaw - 0.3) < 0.02, '拖拽后暂停跟随（1.2 秒内不动）', `yaw ${r.hold.yaw}（暂停剩 ${r.hold.holdLeft}s）`);
check(Math.abs(r.off.yaw + 0.4) < 0.02, '关掉开关后完全不跟', `yaw ${r.off.yaw}`);
check(Math.abs(r.far.yaw + 0.4) < 0.02, '远景（缩放 >45）不跟', `yaw ${r.far.yaw}`);
check(Math.abs(r.deadzone.yaw - r.deadzone.expect) < 0.02, '死区内（偏离 0.6 rad）不跟', `yaw ${r.deadzone.yaw}（应停在 ${r.deadzone.expect}）`);
check(r.spin.drift < 0.08, '朝向固定时不自转（防互相追着转）', `3 秒漂移 ${r.spin.drift} rad`);
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 镜头跟随全部通过');
if (fails.length) process.exitCode = 1;
