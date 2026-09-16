import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: false, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(7000);
for (let i = 0; i < 8; i++) {
  if (await page.locator('#intro-next').isVisible().catch(() => false)) { await page.click('#intro-next'); await page.waitForTimeout(1500); } else break;
}
const step = async (key, ms = 550) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(220); };
// 锁定一只蛋（不做全场景重选）
const lock = () => page.evaluate(() => {
  const g = window.__game, p = g.player.position;
  let best = 1e9, id = null, x = 0, z = 0;
  for (const c of g.eggs.scene.children || []) if (c.userData && c.userData.wordId) {
    const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
    if (d < best) { best = d; id = c.userData.wordId; x = c.position.x; z = c.position.z; }
  }
  return { id, x, z, d: +best.toFixed(1) };
});
const dist = t => page.evaluate(t => { const p = window.__game.player.position; return +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1); }, t);

for (let round = 0; round < 8; round++) {
  let tgt = await lock();
  if (!tgt.id || tgt.d > 1e8) { console.log('no eggs'); break; }
  console.log('round', round, 'target', tgt.id, 'd=' + tgt.d);
  let stuck = 0;
  while (tgt) {
    let d = await dist(tgt);
    if (d <= 5) break;                          // 进入触发半径
    let improved = false;
    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      const before = await dist(tgt);
      await step(key);
      const after = await dist(tgt);
      if (after < before - 0.25) { improved = true; break; }
    }
    stuck = improved ? 0 : stuck + 1;
    if (stuck >= 3) break;                      // 卡死换蛋
  }
  const d = await dist(tgt);
  console.log('approach d=' + d);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2200);
  const word = await page.evaluate(() => {
    const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div');
    if (!card) return '';
    const big = [...card.querySelectorAll('div,span,b')].filter(e => e.children.length === 0 && /^[a-zA-Z][a-zA-Z\s'-]{1,15}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) > 28);
    return big.length ? big[0].textContent.trim() : '';
  });
  if (!word) { console.log('no card, next egg'); continue; }
  console.log('word=', word);
  await page.locator('text=拼字母块').first().click();
  await page.waitForTimeout(1400);
  for (const ch of word) {
    await page.evaluate(c => { const t = [...document.querySelectorAll('.tile')].find(x => (x.textContent || '').trim().toLowerCase() === c && !x.disabled); if (t) t.click(); }, ch);
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'scripts/hatch-' + round + '.png' });
  console.log('hatched', word);
}
const hud = await page.evaluate(() => [...document.querySelectorAll('.pill')].map(x => x.textContent.trim()).join(' | '));
console.log('HUD:', hud);
await ctx.close();
