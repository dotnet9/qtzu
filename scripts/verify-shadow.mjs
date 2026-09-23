// 接触阴影校验：贴地跟随 + 随高度放大变淡 + **自适应强度**（白天压淡 / 夜里与低画质给足）
//
// 为什么升级：角色/词宠本来就有真实投影（assets.js:128、models/kit.js:17 都开 castShadow），
// 白天太阳高时脚下再压一块暗斑会糊成一团；而夜里与低画质降级（_fpsWatch 关掉 shadowMap）
// 真影子不存在，那时接触阴影是唯一的落地感。这一版把两种情况都钉住。
//
//   node scripts/verify-shadow.mjs
import { serve, launch } from './browser.mjs';

const PORT = 6169;
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
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '阴影校验', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

console.log('接触阴影');

const r = await page.evaluate(async () => {
  const g = window.__game;
  // 停掉帧率看门狗：headless 软渲染必然 <25fps，它会把 _lowFx 置真并关掉阴影贴图，
  // 那样量到的 gain 恒为 0.9（低画质分支），测不出白天的自适应。
  g._fpsWatch = () => {};
  g._lowFx = false;
  if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.enabled = true;
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  for (let i = 0; i < 10; i++) await frame();
  const sh = g.player.userData.cshadow;
  if (!sh) return { has: false };
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  const gainNow = g._contactShadowGain();
  const a = { scale: +sh.scale.x.toFixed(3), opacity: +sh.material.opacity.toFixed(3), y: +sh.position.y.toFixed(3), visible: sh.visible };

  // 抬高玩家 → 阴影应变大变淡（原有行为，不能被这次改动破坏）
  const gy = g._groundY(g.player.position.x, g.player.position.z);
  g.player.position.y = gy + 2.0;
  for (let i = 0; i < 8; i++) await frame();
  const high = { scale: +sh.scale.x.toFixed(3), opacity: +sh.material.opacity.toFixed(3) };
  g.player.position.y = gy;
  for (let i = 0; i < 8; i++) await frame();
  const back = { opacity: +sh.material.opacity.toFixed(3) };

  // 低画质：shadowMap 被 _fpsWatch 关掉 → 强度必须回到 0.9
  const shadowWas = g.renderer.shadowMap.enabled;
  g._lowFx = true;
  const gainLow = g._contactShadowGain();
  g._lowFx = false;

  // 阴影贴图关掉（低画质降级的真实状态）→ 同样 0.9
  g.renderer.shadowMap.enabled = false;
  const gainNoMap = g._contactShadowGain();
  g.renderer.shadowMap.enabled = shadowWas;

  return {
    has: true, hour: +hr.toFixed(2), gainNow: +gainNow.toFixed(3), gainLow, gainNoMap,
    ground: a, high, back,
    renderOrder: sh.renderOrder, noPick: !!sh.userData.noPick,
    shadowMapOn: shadowWas,
    baseOpacity: +sh.material.opacity.toFixed(3),
  };
});

check(r.has, '玩家脚下有接触阴影');
if (r.has) {
  check(r.ground.visible, '接触阴影可见', `y=${r.ground.y}（贴地）`);
  check(r.high.scale > r.ground.scale * 1.2, '抬高后变大', `${r.ground.scale} → ${r.high.scale}`);
  check(r.high.opacity < r.ground.opacity, '抬高后变淡', `${r.ground.opacity} → ${r.high.opacity}`);
  check(Math.abs(r.back.opacity - r.ground.opacity) < 0.01, '落回地面后恢复', `${r.back.opacity}`);
  check(r.noPick, '不参与点击拾取（noPick）');
  // 自适应：白天（6~18 点）应明显压淡；夜里应给足
  const day = r.hour >= 6 && r.hour < 18;
  if (day) {
    check(r.gainNow <= 0.70, '白天（有真影子）强度压淡 ≤0.70', `现在 ${r.hour} 点 → gain=${r.gainNow}`);
  } else {
    check(r.gainNow >= 0.89, '夜里（无真影子）强度给足 0.9', `现在 ${r.hour} 点 → gain=${r.gainNow}`);
  }
  check(Math.abs(r.gainLow - 0.9) < 1e-6, '低画质降级（_lowFx）→ 强度回到 0.9', String(r.gainLow));
  check(Math.abs(r.gainNoMap - 0.9) < 1e-6, '阴影贴图被关掉时 → 强度回到 0.9', String(r.gainNoMap));
  check(Math.abs(r.ground.opacity - r.gainNow) < 0.03, '实际不透明度 == 自适应强度（接线正确）',
    `opacity ${r.ground.opacity} vs gain ${r.gainNow}`);
}

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 接触阴影（含自适应）全部通过');
if (fails.length) process.exitCode = 1;
