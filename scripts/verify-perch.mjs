// ⑧ 跳跃挑战引导与正反馈校验：
//   1) 只剩高台蛋时，引导 target 指向**最低一级台阶**（不是 null —— 原来箭头会消失）
//   2) 台顶奖杯存在且未领取
//   3) 把玩家瞬移到台顶 → 奖杯消失、+3 ⭐、徽章记录、只给一次（第二次不再加星）
//   4) 0 页面异常
//
//   node scripts/verify-perch.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6140 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '高台校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const st = g._currentStage();
  const out = { city: st.key };
  out.steps = ((g.world.jumpSteps || {})[st.key] || []).length;
  out.perchPos = (g.world.perchPos || {})[st.key] || null;
  out.trophyBefore = !!(g.world.perchTrophy && g.world.perchTrophy[st.key]);
  out.perchEgg = g._perchEggId();

  // ① 引导：临时把其它蛋都当成已孵（只留高台蛋），看 target 是否指向最低台阶
  const guide = g._perchGuideTarget();
  out.guide = guide ? { text: guide.text.slice(0, 30), x: +guide.target.x.toFixed(1), z: +guide.target.z.toFixed(1) } : null;
  const low = ((g.world.jumpSteps || {})[st.key] || [])[0];
  out.lowStep = low ? { x: +low.x.toFixed(1), z: +low.z.toFixed(1) } : null;
  out.guideHitsLowStep = !!(guide && low && Math.abs(guide.target.x - low.x) < 0.01 && Math.abs(guide.target.z - low.z) < 0.01);

  // ② 登顶奖励：瞬移到台顶
  const T = (g.world.perchTrophy || {})[st.key];
  const starsBefore = window.__save.getStars();
  if (T) {
    g.player.position.set(T.x, T.y, T.z);
    // 等几帧让 _updatePerchTrophy 触发
    for (let i = 0; i < 8; i++) await new Promise((r2) => requestAnimationFrame(r2));
  }
  out.starsGain = window.__save.getStars() - starsBefore;
  out.takenAfter = !!(T && T.taken);
  out.trophyVisible = T ? (T.mesh || []).some((m) => m.visible) : null;
  out.badge = !!window.__save.hasBadge('perch_' + st.key);

  // ③ 只给一次：再等几帧，星数不该继续涨
  const stars2 = window.__save.getStars();
  for (let i = 0; i < 8; i++) await new Promise((r2) => requestAnimationFrame(r2));
  out.starsGain2 = window.__save.getStars() - stars2;
  return out;
});

console.log(`高台引导与奖杯（${r.city}）`);
check(r.steps >= 1, '该城有台阶挑战', `${r.steps} 级`);
check(!!r.perchEgg, '本关有高台蛋', String(r.perchEgg));
check(!!r.guide, '只剩高台蛋时引导不为空（原来会消失）', r.guide ? r.guide.text : 'null');
check(r.guideHitsLowStep, '引导指向最低一级台阶', r.lowStep ? `台阶 (${r.lowStep.x}, ${r.lowStep.z})` : '无台阶');
check(r.trophyBefore, '台顶奖杯已创建');
check(r.starsGain === 3, '登顶 +3 ⭐', `+${r.starsGain}`);
check(r.takenAfter === true, '奖杯标记为已领取');
check(r.trophyVisible === false, '奖杯已隐藏');
check(r.badge, '徽章已记录', `perch_${r.city}`);
check(r.starsGain2 === 0, '奖励只给一次（再站上去不再加星）', `+${r.starsGain2}`);
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 高台引导与奖杯全部通过');
if (fails.length) process.exitCode = 1;
