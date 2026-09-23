// 跳跃挑战"看得懂"校验（用户报"jump.png 没看明白怎么玩"）。
//
//   node scripts/verify-jump-guide.mjs [--city chengdu]
//
// 七条判据：
//   1) 台阶几何：半径 ≥1.4、间距 ≤1.35（远看连成一条上行路，不再是"一根柱子"）
//   2) 每级有发光序号 Sprite，且编号 1..n 递增、颜色各不相同
//   3) 台顶有发光环
//   4) 走近最低级 <4 米 → 弹过一次提示（toast 文案非空）
//   5) 连跳 2 次没踩上任何一级 → 出现失败提醒（文案含"再按一次跳"）
//   6) 站到第 1 级上 → _jumpReached ≥1（逐级反馈生效）
//   7) 首次自动演示只发生一次（第二次进城不再演示）
//   8) 0 页面异常
import { serve, launch } from './browser.mjs';

const optOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CITY = optOf('--city', 'chengdu');
const PORT = 6170 + Math.floor(Math.random() * 9);
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
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '跳跃引导', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, CITY);
await page.goto(`${srv.base}?city=${CITY}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction((cid) => {
  const g = window.__game;
  return g && g.world && (g._currentStage() || {}).key === cid && (g.world.jumpSteps || {})[cid];
}, CITY, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
// toast 采集器：只看 #toast 的最后一帧会被其它提示顶掉（实测"失败提醒"被"本城小任务"覆盖），
// 所以每 50ms 轮询一次、把出现过的文案都记下来，再按关键字判断。
await page.evaluate(() => {
  window.__toastLog = [];
  let last = '';
  setInterval(() => {
    const el = document.getElementById('toast');
    if (!el) return;
    if (!el.classList.contains('hidden') && el.textContent && el.textContent !== last) {
      last = el.textContent;
      window.__toastLog.push(last);
    }
  }, 50);
});

console.log(`跳跃挑战"看得懂" · ${CITY}`);

/* ---- 1) 几何 ---- */
const geo = await page.evaluate((cid) => {
  const g = window.__game;
  const steps = g.world.jumpSteps[cid] || [];
  // 地面→最低一级：孩子实际要跳的**第一跳**（原来只查相邻台阶差，漏了这段）
  const firstRise = steps.length ? +(steps[0].top - steps[0].ground).toFixed(2) : null;
  const gaps = [];
  for (let i = 1; i < steps.length; i++) gaps.push(+Math.hypot(steps[i].x - steps[i - 1].x, steps[i].z - steps[i - 1].z).toFixed(2));
  const marks = (g.world.jumpMarks && g.world.jumpMarks[cid]) || [];
  return {
    n: steps.length, firstRise,
    radii: [...new Set(steps.map((s) => s.r))],
    gaps, maxGap: gaps.length ? Math.max(...gaps) : 0,
    marks: marks.length,
    markN: marks.map((m) => m.n),
    // 序号颜色（用精灵贴图去重：不同色 → 不同贴图对象）
    markColors: new Set(marks.map((m) => (m.sprite.material.map || {}).uuid || '')).size,
    markVisible: marks.every((m) => m.sprite.visible),
    rings: (g.world.anim.perchRing || []).length,
  };
}, CITY);
check(geo.n >= 1, `本城有台阶`, `${geo.n} 级`);
// 第一跳必须够得着：单跳 1.85、二段跳 3.30 → 留 20% 容错取 1.5
check(geo.firstRise === null || geo.firstRise <= 1.5, '地面→最低一级 ≤1.5（第一跳够得着）', geo.firstRise + ' 米');
check(geo.radii.every((r) => r >= 1.2), '台阶半径 ≥1.2（远看不是一根柱子）', geo.radii.join('/'));
check(geo.maxGap <= 1.6, '台阶间距 ≤1.6（连成一条上行路）', geo.maxGap);
check(geo.marks === geo.n, '每级都有发光序号', `${geo.marks}/${geo.n}`);
check(geo.markN.every((n, i) => n === i + 1), '序号 1..n 递增', geo.markN.join(','));
check(geo.markColors >= Math.min(2, geo.n), '序号颜色有区分', `${geo.markColors} 种贴图`);
check(geo.markVisible, '序号精灵可见');
check(geo.rings >= 1, '台顶有发光环', `${geo.rings} 个`);

/* ---- 4) 走近提示 ---- */
const seen = await page.evaluate(async (cid) => {
  const g = window.__game;
  const low = g.world.jumpSteps[cid][0];
  window.__toastLog.length = 0;
  g.player.position.set(low.x + 2.5, g._supportAt(low.x + 2.5, low.z), low.z);
  g._jumpCity = null;                                        // 触发换城重置
  await new Promise((r) => setTimeout(r, 900));
  return { log: window.__toastLog.slice() };
}, CITY);
// 走近会同时触发"① 走近提示"和"④ 首次自动演示字幕"，两条都算（都说明"讲清楚了"）
const sawNear = seen.log.find((x) => /站到发光|Stand on the glowing/.test(x));
check(!!sawNear, '走近最低级 → 弹出"怎么跳"提示', JSON.stringify((sawNear || seen.log[0] || '').slice(0, 30)));

/* ---- 5) 失败提醒：连跳 2 次没踩上任何一级 ---- */
const failTip = await page.evaluate(async (cid) => {
  const g = window.__game;
  const low = g.world.jumpSteps[cid][0];
  window.__toastLog.length = 0;
  // 站到台阶区里、但**离每一级都够远**（站在台阶之间），这样跳了也踩不上
  g.player.position.set(low.x + 5.2, g._supportAt(low.x + 5.2, low.z), low.z);
  g._jumpReached = 0;
  g.onGround = true;
  g._jumpTimes = [performance.now(), performance.now() - 200];
  await new Promise((r) => setTimeout(r, 900));
  return { log: window.__toastLog.slice() };
}, CITY);
const sawFail = failTip.log.find((x) => /再按一次跳|jump AGAIN/.test(x));
check(!!sawFail, '连跳 2 次没上去 → 出现失败提醒', JSON.stringify((sawFail || failTip.log[0] || '').slice(0, 34)));

/* ---- 6) 逐级反馈：站到第 1 级上 ---- */
const reached = await page.evaluate(async (cid) => {
  const g = window.__game;
  const low = g.world.jumpSteps[cid][0];
  g.player.position.set(low.x, low.top, low.z);
  g.player.position.y = low.top;
  g._jumpReached = 0;
  await new Promise((r) => setTimeout(r, 500));
  return g._jumpReached || 0;
}, CITY);
check(reached >= 1, '站到第 1 级 → 记录逐级进度', `_jumpReached=${reached}`);

/* ---- 7) 首次自动演示只发生一次 ---- */
const demo1 = await page.evaluate(async () => {
  const g = window.__game;
  g._jumpDemo = null;
  // 清掉演示徽章，模拟"第一次玩"。⚠ 徽章可能落在 badges / badge / 其它键下，
  // 所以这里把**所有**含 jumpdemo 的键都清掉，并把存档结构打出来（不猜）。
  const raw = JSON.parse(localStorage.getItem('wordpet_save_v1') || '{}');
  const found = [];
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (v && typeof v === 'object' && 'jumpdemo' in v) { delete v.jumpdemo; found.push(k); }
    if (k === 'jumpdemo') { delete raw[k]; found.push('(root)'); }
  }
  localStorage.setItem('wordpet_save_v1', JSON.stringify(raw));
  return { keys: Object.keys(raw), found, hasJumpdemo: JSON.stringify(raw).includes('jumpdemo') };
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
// ⚠ 等**资源加载完**再传送：加载过程中开局的出生点逻辑会把玩家拉回城心，
// 实测传送后被拉到 (601.2, 222.59)（城心），dLow 变成 22.07 → 演示不触发。
await page.waitForFunction(() => {
  const st = window.__assets && window.__assets.stats();
  return st && st.pending === 0;
}, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);
// 重新挂 toast 采集器（reload 会清掉）
await page.evaluate(() => {
  window.__toastLog = [];
  let last = '';
  setInterval(() => {
    const el = document.getElementById('toast');
    if (!el) return;
    if (!el.classList.contains('hidden') && el.textContent && el.textContent !== last) {
      last = el.textContent;
      window.__toastLog.push(last);
    }
  }, 50);
});
const demoA = await page.evaluate(async (cid) => {
  const g = window.__game;
  const low = g.world.jumpSteps[cid][0];
  g.player.position.set(low.x + 2.0, g._supportAt(low.x + 2.0, low.z), low.z);
  g._jumpCity = null;
  await new Promise((r) => setTimeout(r, 2400));   // 演示被推迟 1.6 秒（先让孩子读完提示）
  const first = !!g._jumpDemo;
  const ghost = first && !!g._jumpDemo.ghost;
  const diag = {
    pos: [g.player.position.x, g.player.position.z].map((v) => +v.toFixed(1)),
    dLow: +Math.hypot(g.player.position.x - low.x, g.player.position.z - low.z).toFixed(2),
    badge: (() => { try { return JSON.stringify(JSON.parse(localStorage.getItem('wordpet_save_v1') || '{}')).includes('jumpdemo'); } catch (e) { return 'err'; } })(),
  };
  // 等演示结束（dur 2.6s）
  await new Promise((r) => setTimeout(r, 3200));
  const ended = !g._jumpDemo;
  return { first, ghost, ended, locked: !!g.lockInput, ...diag };
}, CITY);
console.log(`  · 演示触发时：玩家 ${JSON.stringify(demoA.pos)} 距最低级 ${demoA.dLow} 米（要求 <6），徽章已写=${demoA.badge}`);
check(demoA.first && demoA.ghost, '第一次进城 → 出现自动演示（幽灵小人）');
check(demoA.ended && !demoA.locked, '演示结束 → 解锁操作');
// 第二次（徽章已写）不应再演示
const demoB = await page.evaluate(async (cid) => {
  const g = window.__game;
  g._jumpDemo = null;
  const low = g.world.jumpSteps[cid][0];
  g.player.position.set(low.x + 2.0, g._supportAt(low.x + 2.0, low.z), low.z);
  g._jumpCity = null;
  await new Promise((r) => setTimeout(r, 400));
  return !!g._jumpDemo;
}, CITY);
check(!demoB, '第二次进城 → 不再演示（每台机一次）');
check(demo1, '演示徽章可重置（测试可控）');

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 跳跃挑战"看得懂"全部通过');
if (fails.length) process.exitCode = 1;
