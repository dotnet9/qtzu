// 天空群岛 环 A 校验：岛链骨架（岛 / 桥 / 浮云踏板 / 弹簧跳板 / 岛面可站可掉）
//   1) 每城 4~5 座岛：高度 14~19、半径 ≥2.8、主岛最大
//   2) 跳得到：相邻两岛"缺口 ≤3.3（跳得过去）"或其间有桥/浮云/弹簧（三者其一）
//   3) 岛面可站：岛心正上方 → _supportAt == 岛面高度（±0.05）
//   4) 走出边缘会下落：把玩家放到岛沿外 → 若干帧后 y 明显下降
//   5) 桥可走：沿桥中点采样 → _supportAt == 桥面高度
//   6) 浮云会动：两个时刻的 pf.top 不同
//   7) 不挡地面：城里地面（y≈0）的 _supportAt 不受岛影响
//   8) 0 页面异常
//
//   node scripts/verify-sky-isles.mjs [--cities chengdu,beijing,guangzhou]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cityList = (optOf('--cities') || '').split(',').filter(Boolean);
const PORT = 6210 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 620 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '天空群', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate((want) => {
  const g = window.__game;
  const out = { cities: [], errors: [] };
  const keys = (want && want.length) ? want : [g._currentStage().key];
  // 当前城已经建好；其它城用 world.buildIsland 补建（与 _switchCity 的同一条路径）
  for (const key of keys) {
    const isl = g.islands.find((i) => i.key === key);
    if (!isl) { out.errors.push('找不到城市 ' + key); continue; }
    if (!g.world.skyIsles || !g.world.skyIsles[key]) g.world.buildIsland(isl);
    const sky = g.world.skyIsles && g.world.skyIsles[key];
    if (!sky) { out.errors.push(key + ' 没有天空群岛'); continue; }
    const c = { key, scale: +sky.scale.toFixed(2), dc: +sky.dc.toFixed(1), isles: [], links: [], pads: 0, bounces: sky.bounces.length };
    c.isles = sky.isles.map((i) => ({ idx: i.idx, x: +i.x.toFixed(2), z: +i.z.toFixed(2), r: i.r, top: i.top, mini: !!i.mini }));
    c.links = sky.links.map((l) => ({ a: l.a, b: l.b, type: l.type, gap: l.gap, hasMesh: !!l.mesh, pads: l.pads ? l.pads.length : 0 }));
    c.pads = sky.pads.length;
    c.stairs = sky.stairs.length;
    c.has = { lift: !!sky.lift, wall: !!sky.wall, chest: !!sky.chest, mill: !!sky.mill, flag: !!sky.flag, forage: sky.forage.length, eggSpots: sky.eggSpots.length };
    c.forage = sky.forage.map((f) => ({ idx: f.idx, x: +f.x.toFixed(1), z: +f.z.toFixed(1), y: f.y, kind: f.kind }));
    // ③ 岛面可站（站在岛心正上方往下看支撑面）
    c.support = sky.isles.map((i) => {
      const y0 = g.player.position.y, x0 = g.player.position.x, z0 = g.player.position.z;
      g.player.position.set(i.x, i.top + 2, i.z);
      const sup = g._supportAt(i.x, i.z);
      g.player.position.set(x0, y0, z0);
      return { idx: i.idx, top: i.top, sup: +sup.toFixed(3) };
    });
    // ④ 走出边缘会下落（只测当前城：要动玩家）。
    // 取链中间那座岛、往**径向**外侧走 —— 径向是空的（桥/云梯/气流都在主岛那一侧），
    // 从岛沿走出去就该一路掉回城里地面。
    if (key === g._currentStage().key) {
      const i0 = sky.isles[2];
      const rx = Math.cos(sky.ca), rz = Math.sin(sky.ca);
      g.onIsle = false; g.climbing = false;
      g.player.position.set(i0.x + rx * (i0.r + 0.9), i0.top + 0.2, i0.z + rz * (i0.r + 0.9));
      g.onGround = true; g.vy = 0;
      const yBefore = g.player.position.y;
      for (let n = 0; n < 60; n++) g._updatePlayer(0.033);
      c.fall = { before: +yBefore.toFixed(2), after: +g.player.position.y.toFixed(2) };
      // ⑦ 不挡地面：把玩家放回地面，岛正下方的支撑面必须是地面高度
      g.player.position.set(i0.x, g._groundY(i0.x, i0.z), i0.z);
      g.onGround = true; g.vy = 0;
      const g0 = g._groundY(i0.x, i0.z);
      c.groundSupport = { want: +g0.toFixed(2), got: +g._supportAt(i0.x, i0.z).toFixed(2) };
      // ⑤ 桥可走：沿桥两端的 3/5 处采样桥面
      const br = sky.links.find((l) => l.type === 'bridge');
      if (br && br.mesh) {
        const A = sky.isles[br.a], B = sky.isles[br.b];
        const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
        g.player.position.set(mid.x, Math.max(A.top, B.top) + 1.0, mid.z);
        c.bridge = { x: +mid.x.toFixed(1), z: +mid.z.toFixed(1), want: +((A.top + B.top) / 2).toFixed(2), got: +g._supportAt(mid.x, mid.z).toFixed(2) };
      }
      // ⑧ 远景群山：城组里两圈实例化山影（16 / 22 座），位置在城外的远处
      const wIsl = (g.world.islands || []).find((w) => w.uid === g._currentStage().uid);
      const inst = [];
      if (wIsl && wIsl.grp) wIsl.grp.traverse((o) => { if (o.isInstancedMesh && o.count >= 15 && o.count <= 60) inst.push(o.count); });
      c.mountains = inst;
      // ⑨ 高处的雾更浓（站在岛上 far 变小；回到地面完全还原）
      const fog = g.scene.fog;
      g.player.position.set(0, 0, 0);
      g._updateSkyFog();
      const far0 = +fog.far.toFixed(1), near0 = +fog.near.toFixed(1);
      g.player.position.set(sky.isles[0].x, sky.isles[0].top, sky.isles[0].z);
      g._updateSkyFog();
      const far1 = +fog.far.toFixed(1), near1 = +fog.near.toFixed(1);
      g.player.position.set(0, 0, 0);
      g._updateSkyFog();
      c.fog = { far0, near0, far1, near1, back: +fog.far.toFixed(1) };
      // ⑥ 浮云会动：同一批 pf 在两个时刻的 top 不同
      const pfList = (g.world.anim.cloudStair || []).filter((cs) => sky.pads.some((p) => Math.abs(p.x - cs.pf.x) < 0.01 && Math.abs(p.z - cs.pf.z) < 0.01));
      const t0 = pfList.map((cs) => cs.pf.baseTop + cs.pf.bob.amp * Math.sin(1.0 * cs.pf.bob.speed + cs.pf.bob.phase));
      g._updateWorldAnim(0.016, 2.6);
      const t1 = pfList.map((cs) => cs.pf.top);
      c.bob = { n: pfList.length, moved: t0.filter((v, i) => Math.abs(t1[i] - v) > 0.01).length };
      // 弹簧：bounce 平台确实注册了
      c.bounceOk = sky.bounces.every((b) => {
        const pf = (g.world.platforms || []).find((p) => Math.abs(p.x - b.x) < 0.01 && Math.abs(p.z - b.z) < 0.01);
        return pf && pf.bounce === true;
      });
    }
    out.cities.push(c);
  }
  return out;
}, cityList);

for (const [i, c] of r.cities.entries()) {
  console.log(`\n【${c.key}】岛链 scale=${c.scale} dc=${c.dc}`);
  const isles = c.isles;
  check(isles.length >= 4 && isles.length <= 5, '岛数 4~5 座', `${isles.length} 座`);
  check(isles.every((i2) => i2.top >= 14 && i2.top <= 19), '岛面高度 14~19 米', isles.map((i2) => i2.top).join('/'));
  check(isles.every((i2) => i2.r >= 2.8), '岛半径 ≥2.8', isles.map((i2) => i2.r).join('/'));
  check(isles[0].r === Math.max(...isles.map((i2) => i2.r)), '主岛最大', `${isles[0].r}`);
  // ② 相邻两岛：跳得过去 或 有连接件（且真的建了网格）
  const bad = c.links.filter((l) => {
    if (l.gap <= 3.3) return false;                                  // 二段跳水平射程内
    if (l.type === 'bridge') return !l.hasMesh;
    if (l.type === 'pads') return !(l.pads >= 2);
    return !l.hasMesh;                                               // spring
  });
  check(bad.length === 0, '相邻岛：跳得过去 或 有桥/浮云/弹簧',
    c.links.map((l) => `${l.a}→${l.b}:${l.type}(缺口${l.gap})`).join(' '));
  check(c.links.map((l) => l.type).join(',') === 'jump,bridge,pads,spring', '四种连接各一（跳/桥/浮云/弹簧）',
    c.links.map((l) => l.type).join(','));
  check(c.bounces >= 1 && c.bounceOk !== false, '弹簧跳板注册成 bounce 平台', `${c.bounces} 个`);
  check(c.pads >= 12, '云踏板（云梯 10 + 岛间/气流落脚）', `${c.pads} 块`);
  check(c.stairs === 10, '云梯 10 级', `${c.stairs} 级`);
  check(c.has.lift && c.has.wall, '四条通道的锚点都在（气流/长城栈桥）', JSON.stringify(c.has));
  check(c.has.eggSpots >= 4, '蛋位 ≥4 处（不含小岛）', `${c.has.eggSpots} 处`);
  check(c.has.forage >= 3, '采点 ≥3 处', `${c.has.forage} 处`);
  // ③ 岛面可站
  const badSup = c.support.filter((s) => Math.abs(s.sup - s.top) > 0.05);
  check(badSup.length === 0, '岛面可站（_supportAt == 岛面高度）',
    badSup.length ? JSON.stringify(badSup) : c.support.map((s) => s.sup).join('/'));
  if (c.fall) {
    check(c.fall.before - c.fall.after > 8, '走出岛沿会下落', `${c.fall.before} → ${c.fall.after}`);
    check(Math.abs(c.groundSupport.got - c.groundSupport.want) < 0.05, '城里地面不被岛遮挡（站岛下 = 站地面）',
      `${c.groundSupport.got} vs ${c.groundSupport.want}`);
  }
  if (c.bridge) check(Math.abs(c.bridge.got - c.bridge.want) < 0.35, '桥面可走（_supportAt == 桥面）',
    `${c.bridge.got} vs ${c.bridge.want}`);
  if (c.bob) check(c.bob.moved === c.bob.n && c.bob.n > 0, '浮云踏板真的在动', `${c.bob.moved}/${c.bob.n}`);
  if (c.mountains) check(c.mountains.length >= 3, '远景群山三层（实例化 26/20/15 座）', c.mountains.join('/'));
  if (c.fog) check(c.fog.far1 < c.fog.far0 && Math.abs(c.fog.back - c.fog.far0) < 0.5,
    '高处雾更浓、回地面完全还原', `地面 ${c.fog.near0}/${c.fog.far0} → 岛上 ${c.fog.near1}/${c.fog.far1} → 回地面 ${c.fog.back}`);
}
if (r.errors.length) check(false, '补建城市没有报错', r.errors.join(' | '));
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 天空群岛骨架全部通过');
if (fails.length) process.exitCode = 1;
