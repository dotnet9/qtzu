// 天空群岛 环 C 校验：岛上的蛋 / 宝箱 / 单词机关（闭环：跳上去取蛋 → 孵化 → 跳下来找别的蛋）
//   1) 本关 2~3 颗蛋在岛上，高度 = 岛面、离岛心 ≤ r-0.6（不会站在边缘掉下去）
//   2) 这些蛋**能孵**：走上去 + 完成 challenge（_doHatch）→ save.isHatched 为真
//   3) 宝箱：念对单词才开（先弹 challenge）、奖励入库、再点不开（一次性，写进存档）
//   4) 风车/旗：念对后状态变化（气流点亮 / 旗升起），再念不开
//   5) 换城重载后状态保持（读档 → _syncSkyState 复原）
//   6) 0 页面异常
//
//   node scripts/verify-sky-reward.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6225 + Math.floor(Math.random() * 9);
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
const seed = (c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '岛蛋校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
};
await page.addInitScript(seed, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const save = await import('/js/save.js');
  const ui = await import('/js/ui.js');
  const { WORD_MAP } = await import('/js/words.js');
  const out = {};
  const sky = g._sky();
  const key = g._currentStage().key;
  const park = (x, y, z) => { g.player.position.set(x, y, z); g.vy = 0; g.onGround = true; g.climbing = false; g._clearMoveTarget(); };

  // ① 岛上的蛋
  const ids = g._skyEggIds();
  out.eggIds = ids;
  out.eggs = ids.map((id) => {
    const eg = g.eggs.get(id);
    if (!eg) return { id, missing: true };
    const p = eg.group.position;
    const isl = sky.isles.find((i) => Math.hypot(i.x - p.x, i.z - p.z) < i.r);
    return {
      id, y: +p.y.toFixed(2), isle: isl ? isl.idx : -1,
      top: isl ? isl.top : null,
      dIsle: isl ? +Math.hypot(p.x - isl.x, p.z - isl.z).toFixed(2) : null,
      r: isl ? isl.r : null,
      // 站到蛋边上再问支撑面（_supportAt 按"玩家当前高度"筛平台，站在城里地面问是问不出来的）
      reach: (() => { const y0 = g.player.position.y; g.player.position.set(p.x, p.y + 1.0, p.z); const s2 = +g._supportAt(p.x, p.z).toFixed(2); g.player.position.y = y0; return s2; })(),
    };
  });
  // ② 能不能孵：走上去（站到蛋旁）+ 完成 challenge
  out.hatch = ids.map((id) => {
    const eg = g.eggs.get(id);
    if (!eg) return { id, before: false, after: false };
    park(eg.group.position.x, eg.group.position.y, eg.group.position.z);
    const before = save.isHatched(id);
    g._doHatch(WORD_MAP[id], 92, 'voice');
    return { id, before, after: save.isHatched(id) };
  });
  // _doHatch 是异步演出：等几帧让 save.hatch 落下去
  await new Promise((res) => setTimeout(res, 1200));
  out.hatched = ids.map((id) => save.isHatched(id));

  // ③ 宝箱：念对才开
  const c = sky.chest;
  park(c.x, c.y, c.z + 1.2);
  g._updatePrompt();
  out.chestPrompt = typeof g.promptAction === 'function';
  const stars0 = save.getStars();
  const wear0 = JSON.stringify(save.getWear());
  const rare0 = Object.values(save.getSave().pets || {}).filter((p) => p.rare).length;
  g._skyOpenChest();
  out.chestChallengeOpen = ui.challengeOpen();
  out.chestOpenedBeforeWin = sky.chest.opened;
  ui.closeChallenge();
  g._skyChestWin();                    // = challenge 的 onSuccess（念对了）
  out.chestOpened = sky.chest.opened;
  out.chestSaved = save.skyDone('chest', key);
  out.chestReward = {
    stars: save.getStars() - stars0,
    wearChanged: JSON.stringify(save.getWear()) !== wear0,
    rare: Object.values(save.getSave().pets || {}).filter((p) => p.rare).length - rare0,
  };
  // 再点一次：不开（一次性）
  const reward2 = { stars: save.getStars(), wear: JSON.stringify(save.getWear()) };
  g._skyOpenChest();
  out.chestAgainChallenge = ui.challengeOpen();
  out.chestAgainSame = save.getStars() === reward2.stars && JSON.stringify(save.getWear()) === reward2.wear;

  // ④ 风车：念对后气流点亮
  const mill = sky.mill;
  park(mill.x, mill.y, mill.z + 1.2);
  const litBefore = !!(sky.lift && sky.lift.lit);
  g._skySolveMill();
  out.millChallengeOpen = ui.challengeOpen();
  ui.closeChallenge();
  g._skyMillWin();
  out.mill = { solved: sky.mill.solved, saved: save.skyDone('mill', key), litBefore, litAfter: !!(sky.lift && sky.lift.lit) };
  g._skySolveMill();
  out.millAgainChallenge = ui.challengeOpen();

  // ④′ 旗：念对后升起
  const flag = sky.flag;
  park(flag.x, flag.y, flag.z + 1.2);
  const flagY0 = +flag.cloth.scale.y.toFixed(2);
  g._skySolveFlag();
  ui.closeChallenge();
  g._skyFlagWin();
  for (let i = 0; i < 40; i++) g._updateFx(0.033);   // 升旗是 0.9 秒的补间：泵几帧再看
  out.flag = { solved: sky.flag.solved, saved: save.skyDone('flag', key), y0: flagY0, yAfter: +flag.cloth.scale.y.toFixed(2) };
  g._skySolveFlag();
  out.flagAgainChallenge = ui.challengeOpen();

  // ⑤ 存档往返：重新 _syncSkyState 后状态还在
  sky.chest.opened = false; sky.mill.solved = false; sky.flag.solved = false;
  if (sky.lift) sky.lift.lit = false;
  g._syncSkyState();
  out.resync = { chest: sky.chest.opened, mill: sky.mill.solved, flag: sky.flag.solved, lit: !!(sky.lift && sky.lift.lit) };
  out.skySave = JSON.parse(JSON.stringify(save.getSave().sky));
  return out;
});

console.log(`岛上奖励校验（${city}）`);
check(r.eggIds.length >= 2 && r.eggIds.length <= 3, '本关岛上有 2~3 颗蛋', r.eggIds.join(','));
check(r.eggs.every((e) => !e.missing), '这些蛋都在场上', JSON.stringify(r.eggs.map((e) => e.id)));
check(r.eggs.every((e) => e.top != null && Math.abs(e.y - e.top) < 0.5), '蛋落在岛面上（y = 岛面 ±0.5）',
  r.eggs.map((e) => `${e.id}:${e.y}/${e.top}`).join(' '));
check(r.eggs.every((e) => e.dIsle != null && e.dIsle <= e.r - 0.6), '没有蛋放在岛沿（距岛心 ≤ r-0.6）',
  r.eggs.map((e) => `${e.id}:${e.dIsle}/${e.r}`).join(' '));
check(r.eggs.every((e) => Math.abs(e.reach - e.top) < 0.35), '蛋位站得住（脚下支撑面 = 岛面）',
  r.eggs.map((e) => `${e.id}:${e.reach}`).join(' '));
check(r.hatched.every(Boolean), '岛上的蛋能孵（走上去 + 念对 → isHatched）', r.hatched.map((v, i) => `${r.eggIds[i]}:${v}`).join(' '));
check(r.chestPrompt, '走近宝箱有交互提示（念对单词开箱）');
check(r.chestChallengeOpen === true, '开箱要先过朗读 challenge', String(r.chestChallengeOpen));
check(r.chestOpenedBeforeWin === false, '没念对之前箱子不开', String(r.chestOpenedBeforeWin));
check(r.chestOpened === true && r.chestSaved === true, '念对后开箱并写进存档');
check(r.chestReward.stars > 0 || r.chestReward.wearChanged || r.chestReward.rare > 0, '奖励入库（星星/配饰/稀有词宠）', JSON.stringify(r.chestReward));
check(r.chestAgainChallenge === false && r.chestAgainSame, '宝箱一次性（再点不开、不再发奖）');
check(r.millChallengeOpen === true, '风车要先过朗读 challenge');
check(r.mill.solved && r.mill.saved && !r.mill.litBefore && r.mill.litAfter, '念对后风车转起来 + 上升气流点亮', JSON.stringify(r.mill));
check(r.millAgainChallenge === false, '风车一次性（再念不开）');
check(r.flag.solved && r.flag.saved && r.flag.yAfter > r.flag.y0 + 0.5, '念对后旗升起来', JSON.stringify(r.flag));
check(r.flagAgainChallenge === false, '旗一次性（再念不开）');
check(r.resync.chest && r.resync.mill && r.resync.flag && r.resync.lit, '状态能从存档复原（换城/重载不丢）', JSON.stringify(r.resync));
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 岛上的蛋 / 宝箱 / 机关全部通过');
if (fails.length) process.exitCode = 1;
