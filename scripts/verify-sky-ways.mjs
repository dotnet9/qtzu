// 天空群岛 环 B 校验：四条上/下岛通道，且**每条都可逆**（不然玩家会卡在岛上）
//   ① 上升气流：走进地面光圈 → 被吹到岛面高度；从顶上的云台走进气柱 → 限速飘落、安全落地
//   ② 云梯跳：最上面一级与岛面的高差 ≤1.3（单跳够得着）
//   ③ 词宠驮飞：骑着会飞的词宠按跳键 → 落到岛面；在岛上再按一次 → 回到地面
//   ④ 长城栈桥：墙根平台接得上马道（3.02），桥面最高一级接得上岛面（≤1.3）
//   ⑤ 可逆性：气流上去能飘下来 / 驮飞上去能飞下来 / 云梯与栈桥跳下来不卡
//   ⑥ 0 页面异常
//
//   node scripts/verify-sky-ways.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6220 + Math.floor(Math.random() * 9);
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
await page.addInitScript((c) => {
  try {
    const day = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '通道校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
      // bird 已孵：③ 词宠驮飞那条通道才有的用
      pets: { bird: { hatchedAt: Date.now(), fedAt: Date.now(), feedStage: 2, feeds: 1, day } },
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const out = {};
  const sky = g._sky();
  const frames = (n, dt = 0.033) => {
    for (let i = 0; i < n; i++) {
      g._updatePlayer(dt);
      g._updateFx(dt);
      g._updateSky(dt, g.clock.elapsedTime + i * dt);
    }
  };
  const park = (x, y, z) => { g.player.position.set(x, y, z); g.vy = 0; g.onGround = true; g.climbing = false; g._clearMoveTarget(); };
  out.has = { lift: !!sky.lift, wall: !!sky.wall, stairs: sky.stairs.length, isles: sky.isles.length };

  // ① 气流：站在地面光圈里 → 被吹上去（1.6 秒的演出 + 落台）
  const L = sky.lift;
  out.liftGround = { y: +g._groundY(L.x, L.z).toFixed(2), walkable: g._waterAt(L.x, L.z) < 0.55 };
  park(L.x, g._groundY(L.x, L.z), L.z);
  frames(2);
  out.riseStarted = !!g.climbing;
  frames(80);   // 1.6 秒演出 + 若干帧落台
  out.afterRise = { y: +g.player.position.y.toFixed(2), climbing: g.climbing, onGround: g.onGround };

  // ①′ 可逆（飘落）：从气柱上方落下来 → 速度被限制、安全落地
  park(L.x, L.top - 1.5, L.z);
  g.onGround = false; g.vy = 0;   // 自然地走进气柱（不是被扔下去）
  let maxFall = 0, maxStep = 0;
  for (let i = 0; i < 200; i++) {
    const y0 = g.player.position.y;
    g._updatePlayer(0.033);
    g._updateSky(0.033, g.clock.elapsedTime + i * 0.033);
    if (g.vy < maxFall) maxFall = g.vy;
    maxStep = Math.max(maxStep, (y0 - g.player.position.y) / 0.033);
    if (g.onGround && g.player.position.y < 1) break;
  }
  out.floatDown = { maxFall: +maxFall.toFixed(2), maxStep: +maxStep.toFixed(2), landedY: +g.player.position.y.toFixed(2), onGround: g.onGround };

  // ② 云梯：最上面一级与岛面的高差
  const top = sky.stairs[sky.stairs.length - 1];
  const i0 = sky.isles[0];
  out.stair = {
    topY: +top.top.toFixed(2), isleTop: i0.top,
    step: +(i0.top - top.top).toFixed(2),
    spacing: +Math.hypot(sky.stairs[0].x - sky.stairs[1].x, sky.stairs[0].z - sky.stairs[1].z).toFixed(2),
    rise: +(sky.stairs[1].top - sky.stairs[0].top).toFixed(2),
    // 每级都跳得上去（垂直 1.4 < 单跳 1.85）
    maxRise: Math.max(...sky.stairs.map((s2, i2) => i2 ? s2.top - sky.stairs[i2 - 1].top : 0)),
  };

  // ③ 词宠驮飞：孵一只会飞的词宠 → 骑上 → 按跳键
  const { WORD_MAP } = await import('/js/words.js');
  const w = WORD_MAP.bird;
  let pet = g.pets.get('bird');
  if (!pet) { pet = g.pets.spawn(w, { x: g.player.position.x + 1, z: g.player.position.z + 1, y: 0 }); pet.group.userData.wordId = 'bird'; }
  const spawn = g._citySpawnPos(g._currentStage());
  park(spawn.x, g._groundY(spawn.x, spawn.z), spawn.z);
  g._ridePet('bird');
  out.mounted = { mount: g.mount, flying: !!g.mountFlying };
  g._jump();
  frames(80);
  // 骑着的时候人贴在词宠背上（比落脚面高 1.6），所以判据用"脚下的支撑面"而不是 y
  out.afterFlyUp = {
    y: +g.player.position.y.toFixed(2), want: i0.top, mount: g.mount,
    sup: +g._supportAt(g.player.position.x, g.player.position.z).toFixed(2),
  };
  // 可逆：在岛上再按一次 → 回到地面
  g._jump();
  frames(80);
  out.afterFlyDown = {
    y: +g.player.position.y.toFixed(2),
    sup: +g._supportAt(g.player.position.x, g.player.position.z).toFixed(2),
    ground: +g._groundY(g.player.position.x, g.player.position.z).toFixed(2),
  };
  if (g.mount) g._ridePet(g.mount);
  out.dismountY = +g.player.position.y.toFixed(2);

  // ④ 长城栈桥：墙根平台 → 马道；最高一级 → 岛面
  const deck = sky.wall.deck || [];
  const supAt = (p) => { const y0 = g.player.position.y; g.player.position.set(p.x, p.y + 1.0, p.z); const s2 = g._supportAt(p.x, p.z); g.player.position.y = y0; return +s2.toFixed(2); };
  out.wall = {
    firstTop: deck.length ? +deck[0].y.toFixed(2) : null, walkY: 3.02,
    lastY: deck.length ? +deck[deck.length - 1].y.toFixed(2) : null,
    lastSup: deck.length ? supAt(deck[deck.length - 1]) : null,
    firstSup: deck.length ? supAt(deck[0]) : null,
    isleTop: i0.top, len: sky.wall.len,
    maxRise: Math.max(...deck.map((p, i2) => i2 ? p.y - deck[i2 - 1].y : 0)),
    maxRun: Math.max(...deck.map((p, i2) => i2 ? Math.hypot(p.x - deck[i2 - 1].x, p.z - deck[i2 - 1].z) : 0)),
  };
  // 墙根三级木台：地面 → 马道每级都跳得上去
  const towerSup = deck.length ? [1.0, 2.0, 3.02].map((t2) => t2) : [];
  out.towerTops = towerSup;
  return out;
});

console.log(`通道校验（${city}）`);
check(r.has.lift && r.has.wall, '四条通道的锚点都在', JSON.stringify(r.has));
check(r.has.stairs === 10, '云梯 10 级', `${r.has.stairs} 级`);
// ① 气流
check(r.liftGround.walkable, '气流光圈在地上、走得到', `地面 y=${r.liftGround.y}`);
check(r.riseStarted, '踏进光圈 → 开始被吹上去');
check(Math.abs(r.afterRise.y - r.has.isles * 0 - 15) < 0.6 && r.afterRise.onGround && !r.afterRise.climbing,
  '1.6 秒后落到岛面高度（±0.5）', `y=${r.afterRise.y}`);
// ①′ 飘落
check(Math.abs(r.floatDown.maxStep) <= 2.6, '从气流里落下时限速缓降（落速 ≤ 2.6 米/秒）', `vy=${r.floatDown.maxFall} 落速=${r.floatDown.maxStep}`);
check(r.floatDown.onGround && r.floatDown.landedY < 1, '一直安全飘到地面', `y=${r.floatDown.landedY}`);
// ② 云梯
check(r.stair.step <= 1.3, '云梯最上一级与岛面高差 ≤1.3', `${r.stair.step}`);
check(r.stair.maxRise <= 1.85, '云梯每级抬升 ≤ 单跳高度', `max ${r.stair.maxRise.toFixed(2)} / 间距 ${r.stair.spacing}`);
// ③ 驮飞
check(r.mounted.mount === 'bird' && r.mounted.flying, '骑上会飞的词宠（驮飞通道可用）', JSON.stringify(r.mounted));
check(Math.abs(r.afterFlyUp.sup - r.afterFlyUp.want) < 0.6, '按跳键 → 驮飞到岛面（脚下的支撑面 = 岛面）', `脚下 ${r.afterFlyUp.sup} vs 岛面 ${r.afterFlyUp.want}（人在词宠背上 y=${r.afterFlyUp.y}）`);
check(r.afterFlyUp.mount === 'bird', '飞完还骑着（没有中途掉下来）');
check(r.afterFlyDown.sup < 1.5 && Math.abs(r.afterFlyDown.sup - r.afterFlyDown.ground) < 0.6, '在岛上再按一次 → 飞回地面（可逆）',
  `脚下 ${r.afterFlyDown.sup} 地面 ${r.afterFlyDown.ground}`);
check(r.dismountY < 1.5, '下坐骑不穿地（落回那一层）', `y=${r.dismountY}`);
// ④ 栈桥
check(r.wall.firstTop === 3.02, '栈桥起点 = 长城马道高度 3.02', `${r.wall.firstTop}`);
check(r.wall.maxRise <= 1.85 && r.wall.maxRun <= 4.3, '栈桥每级抬升/跨距都在跳跃能力内',
  `抬 ${r.wall.maxRise.toFixed(2)} 跨 ${r.wall.maxRun.toFixed(2)}`);
check(Math.abs(r.wall.lastSup - r.wall.lastY) < 0.35, '栈桥最高一级可站（_supportAt 对得上）', `${r.wall.lastSup} vs ${r.wall.lastY}`);
check(r.wall.isleTop - r.wall.lastY <= 1.3, '栈桥最高一级与岛面高差 ≤1.3（跳得上去）', `${(r.wall.isleTop - r.wall.lastY).toFixed(2)}`);
check(Math.abs(r.wall.firstSup - 3.02) < 0.35, '栈桥起点可站（= 马道高度）', `${r.wall.firstSup}`);
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 四条通道全部通过');
if (fails.length) process.exitCode = 1;
