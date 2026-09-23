// 天空群岛 环 D 校验：岛上的采集与动物
//   1) 每城 ≥3 个可采点；采集后计数 +1、该点当天不再出现（换天可再生）
//   2) 计数写进存档，刷新后还在
//   3) 可以喂给词宠（复用喂食入口：save.feed → 好感 +1，果子 -1）
//   4) 小鸟绕岛飞、蝴蝶绕花丛（两帧位置不同）；蒲公英走近会被吹散
//   5) 0 页面异常
//
//   node scripts/verify-sky-life.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6227 + Math.floor(Math.random() * 9);
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
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '采点校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
      pets: { bird: { hatchedAt: Date.now(), fedAt: Date.now(), feedStage: 2, feeds: 1 } },
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const probe = async () => page.evaluate(async () => {
  const g = window.__game;
  const save = await import('/js/save.js');
  const ui = await import('/js/ui.js');
  const out = {};
  const sky = g._sky();
  const park = (x, y, z) => { g.player.position.set(x, y, z); g.vy = 0; g.onGround = true; g.climbing = false; g._clearMoveTarget(); };
  out.forageN = sky.forage.length;
  out.kinds = sky.forage.map((f) => f.kind);
  // 先把岛上的蛋孵掉：蛋的交互提示优先级最高，不然站在采点旁按 E 会去开蛋
  const { WORD_MAP } = await import('/js/words.js');
  for (const id of g._skyEggIds()) { const w = WORD_MAP[id]; if (w) g._doHatch(w, 92, 'voice'); }
  await new Promise((res) => setTimeout(res, 1400));
  out.before = save.getForage();

  // ① 采第一个点：走近 → 提示 → 采
  const f0 = sky.forage[0];
  park(f0.x, f0.y, f0.z + 0.8);
  g._updatePrompt();
  out.prompt = typeof g.promptAction === 'function' && !ui.challengeOpen();
  if (out.prompt) g.promptAction();
  out.after = save.getForage();
  out.hidden = f0.mesh.visible === false;
  out.takenToday = save.forageTaken(g._currentStage().key, f0.idx);
  out.promptGone = (() => { g._updatePrompt(); return typeof g.promptAction !== 'function'; })();

  // ③ 喂给词宠：把鸟挪到脚边，再点喂
  const bird = g.pets.get('bird');
  const w = bird ? bird.word : null;
  if (bird) { bird.group.position.set(g.player.position.x + 0.8, g.player.position.y, g.player.position.z); }
  const feeds0 = (save.getSave().pets.bird || {}).feeds || 0;
  const n0 = save.getForage();
  park(g.player.position.x, f0.y, g.player.position.z);
  if (bird) g._skyFeedBerry('bird');
  out.feed = { feeds0, feeds1: (save.getSave().pets.bird || {}).feeds || 0, n0, n1: save.getForage(), id: w && w.id };

  // ④ 动物在动 / 蒲公英能吹散
  const gull = sky.anim.gulls[0], bf = sky.anim.butterflies[0], dand = sky.anim.dandelions[0];
  const p0 = gull.position.clone();
  const b0 = bf.position.clone();
  for (let i = 0; i < 3; i++) g._updateSky(0.033, 5 + i * 0.4);
  out.anim = {
    gullMoved: +p0.distanceTo(gull.position).toFixed(3),
    bfMoved: +b0.distanceTo(bf.position).toFixed(3),
  };
  // 蒲公英：站到它旁边 → 被吹散（blown 计时开始、绒球缩掉）
  park(dand.x, dand.y, dand.z);
  g._updateSky(0.033, 9);
  for (let i = 0; i < 5; i++) g._updateSky(0.033, 9 + i * 0.1);
  out.dandelion = { blown: dand.blown, scale: +dand.mesh.scale.x.toFixed(2) };
  out.skySave = JSON.parse(JSON.stringify(save.getSave().sky.forage));
  return out;
});

const r1 = await probe();
console.log(`岛上采集与动物校验（${city}）`);
check(r1.forageN >= 3, '每城 ≥3 个可采点', `${r1.forageN} 个（${r1.kinds.join('/')}）`);
check(r1.prompt, '走近可采点有交互提示');
check(r1.after === r1.before + 1, '采集后计数 +1', `${r1.before} → ${r1.after}`);
check(r1.hidden && r1.takenToday, '采过的点当天消失', `visible=${!r1.hidden} taken=${r1.takenToday}`);
check(r1.promptGone, '采过的点不再弹提示');
check(r1.feed.feeds1 === r1.feed.feeds0 + 1, '果子能喂词宠（好感 +1）', JSON.stringify(r1.feed));
check(r1.feed.n1 === r1.feed.n0 - 1, '喂完果子 -1', `${r1.feed.n0} → ${r1.feed.n1}`);
check(r1.anim.gullMoved > 0.01 && r1.anim.bfMoved > 0.01, '小鸟/蝴蝶在动', JSON.stringify(r1.anim));
check(r1.dandelion.blown > 0 && r1.dandelion.scale < 1, '蒲公英走近被吹散', JSON.stringify(r1.dandelion));

// ② 刷新后计数还在。用**新开一个页**而不是 reload：page.addInitScript 会在每次导航前重放，
// reload 会把存档又按初始种子写一遍（localStorage 是同一个 context 共享的，新页不重放初始化脚本）
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page2.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page2.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page2.waitForTimeout(2500);
const r2 = await page2.evaluate(async () => {
  const g = window.__game;
  const save = await import('/js/save.js');
  const sky = g._sky();
  const f0 = sky.forage[0];
  await new Promise((res) => setTimeout(res, 300));
  return { n: save.getForage(), f0Visible: f0.mesh.visible, stillTaken: save.forageTaken(g._currentStage().key, f0.idx), chest: sky.chest.opened };
});
check(r2.n === r1.feed.n1, '刷新后采集计数还在', `${r1.feed.n1} → ${r2.n}`);
check(r2.f0Visible === false && r2.stillTaken, '刷新后采过的点依然是空的（当天不重复）', `visible=${r2.f0Visible}`);
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 采集与动物全部通过');
if (fails.length) process.exitCode = 1;
