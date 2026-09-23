// 脚下指示环校验（js/ring.js）。
//
// 为什么需要：环的价值是"用颜色告诉孩子现在能做什么"（蛋=走过去 / 台阶=跳上去 / 奖杯=踩上台面），
// 颜色错了比没有环更糟 —— 孩子会按错的颜色去试。所以这里逐档把玩家挪到目标旁边，断言环的颜色。
//
//   node scripts/verify-player-ring.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CITY = optOf('--city', 'chengdu');
const PORT = 6270 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '环校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
}, CITY);
await page.goto(`${srv.base}?city=${CITY}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

console.log(`脚下指示环 · ${CITY}`);

/* ---------- 1) 几何与材质 ---------- */
const geo = await page.evaluate(async () => {
  const R = await import(new URL('js/ring.js', location.href).href);
  const g = window.__game;
  for (let i = 0; i < 40 && !g._ring; i++) await new Promise((r) => setTimeout(r, 100));
  const m = g._ring;
  if (!m) return { missing: true };
  return {
    radius: m.userData.ringRadius, tube: m.userData.ringTube,
    depthWrite: m.material.depthWrite, transparent: m.material.transparent,
    renderOrder: m.renderOrder, noPick: !!m.userData.noPick,
    visible: m.visible,
    kinds: Object.fromEntries(Object.entries(R.RING_KINDS).map(([k, v]) => [k, { color: v.color, opacity: v.opacity }])),
  };
});
check(!geo.missing, '指示环已创建（每帧跟随）');
check(Math.abs(geo.radius - 0.5) < 1e-6 && Math.abs(geo.tube - 0.045) < 1e-6, '半径 0.5 / 管径 0.045', `${geo.radius} / ${geo.tube}`);
check(geo.depthWrite === false && geo.transparent === true, 'depthWrite=false + transparent（不与地面 z-fighting）');
check(geo.noPick === true, '不参与点击拾取（noPick）');

/* ---------- 2) 颜色随最近目标变化（三档 + 无目标） ---------- */
const hue = await page.evaluate(async () => {
  const R = await import(new URL('js/ring.js', location.href).href);
  const g = window.__game;
  const K = R.RING_KINDS;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ringHex = () => g._ring.material.color.getHex();
  const ringOp = () => g._ring.material.opacity;
  const put = (x, z, y) => { g.player.position.set(x, y != null ? y : g._supportAt(x, z), z); };

  const out = {};
  const st = g._currentStage();

  // ① 蛋：必须挑一个**远离台阶与奖杯**的蛋 —— 环的规则是"最近者优先"，
  //     随手取 eggs[0] 可能正好在跳跃台阶旁边（实测 d(蛋)=2.46 但 d(台阶) 更小 → 显示薄荷色）
  const allSteps = (g.world.jumpSteps && g.world.jumpSteps[st.key]) || [];
  const allT = g.world.perchTrophy && g.world.perchTrophy[st.key];
  const clearOf = (e) => {
    let m = 1e9;
    for (const s2 of allSteps) m = Math.min(m, Math.hypot(e.group.position.x - s2.x, e.group.position.z - s2.z));
    if (allT) m = Math.min(m, Math.hypot(e.group.position.x - allT.x, e.group.position.z - allT.z));
    return m;
  };
  const eggs = [...g.eggs.eggs.values()]
    .filter((e) => e.group && e.group.visible)
    .sort((a, b) => clearOf(b) - clearOf(a));      // 离台阶/奖杯最远的排前面
  if (eggs.length && clearOf(eggs[0]) > 3) {
    const e0 = eggs[0];
    put(e0.group.position.x + 1.5, e0.group.position.z);
    g._jumpReached = 0;
    await wait(400);
    out.egg = { hex: ringHex(), want: K.egg.color, clear: +clearOf(e0).toFixed(2), d: +Math.hypot(g.player.position.x - e0.group.position.x, g.player.position.z - e0.group.position.z).toFixed(2) };
  } else out.egg = null;   // 没有"离台阶 3 米以上"的蛋 → 这一档无法验证

  // ② 台阶：把蛋全部藏起来（nearest 只看 visible 的），站到最低一级旁
  const savedVis = eggs.map((e) => e.group.visible);
  eggs.forEach((e) => { e.group.visible = false; });
  const steps = (g.world.jumpSteps && g.world.jumpSteps[st.key]) || [];
  if (steps.length) {
    const low = steps[0];
    put(low.x + 1.5, low.z);
    g._jumpReached = 0;
    await wait(400);
    out.step = { hex: ringHex(), want: K.step.color, n: steps.length };
  } else out.step = null;

  // ③ 奖杯：站到台面上离奖杯 2.5 米（>1.8 不会被吃掉奖励），_jumpReached≥1 才会提示奖杯
  const T = g.world.perchTrophy && g.world.perchTrophy[st.key];
  if (T && !T.taken) {
    g._jumpReached = 2;
    put(T.x + 2.5, T.z, T.y);
    await wait(400);
    out.trophy = { hex: ringHex(), want: K.trophy.color, taken: !!T.taken };
  } else out.trophy = null;

  // ④ 无目标：离开所有目标 20 米以上
  g._jumpReached = 99;                       // 跳过台阶分支
  put(st.cx + 24, st.cz + 24);
  await wait(400);
  out.none = { hex: ringHex(), want: K.none.color, op: +ringOp().toFixed(3), wantOp: K.none.opacity };

  // 复原
  eggs.forEach((e, i) => { e.group.visible = savedVis[i]; });
  return out;
});

if (hue.egg) {
  check(hue.egg.hex === hue.egg.want, '蛋旁边 → 暖金', `0x${hue.egg.hex.toString(16)} vs 0x${hue.egg.want.toString(16)}（d=${hue.egg.d}，离台阶 ${hue.egg.clear} 米）`);
} else check(false, '蛋旁边 → 暖金', '本城没有可见的蛋，无法验证');
if (hue.step) {
  check(hue.step.hex === hue.step.want, '台阶旁 → 薄荷', `0x${hue.step.hex.toString(16)} vs 0x${hue.step.want.toString(16)}（${hue.step.n} 级）`);
} else check(false, '台阶旁 → 薄荷', '本城没有跳跃台阶，无法验证');
if (hue.trophy) {
  check(hue.trophy.hex === hue.trophy.want && !hue.trophy.taken, '台面奖杯旁 → 紫（且没被误吃）', `0x${hue.trophy.hex.toString(16)} vs 0x${hue.trophy.want.toString(16)}`);
} else check(false, '台面奖杯旁 → 紫', '本城奖杯已拿或不存在，无法验证');
check(hue.none.hex === hue.none.want, '空地上 → 柔白', `0x${hue.none.hex.toString(16)} vs 0x${hue.none.want.toString(16)}`);
check(hue.none.op <= 0.35, '无目标时不透明度 ≤0.35（不抢注意力）', hue.none.op);

/* ---------- 3) 与接触阴影共存（不 z-fighting） ---------- */
const lay = await page.evaluate(async () => {
  const g = window.__game;
  const sh = g.player.userData.cshadow;
  const ring = g._ring;
  if (!sh || !ring) return { missing: true };
  return {
    shOrder: sh.renderOrder, ringOrder: ring.renderOrder,
    shY: +sh.position.y.toFixed(4), ringY: +ring.position.y.toFixed(4),
    dy: +(ring.position.y - sh.position.y).toFixed(4),
  };
});
check(!lay.missing, '接触阴影与指示环同时存在');
check(lay.ringOrder > lay.shOrder, '环的 renderOrder 大于阴影（绘制顺序确定，不会同深度闪烁）', `${lay.ringOrder} > ${lay.shOrder}`);
check(lay.dy > 0.005, '环略高于阴影（避免共面）', `Δy=${lay.dy}`);

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 脚下指示环全部通过');
if (fails.length) process.exitCode = 1;
