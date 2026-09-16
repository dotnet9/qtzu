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
const step = async (keys, ms = 500) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(200);
};
const lock = blacklist => page.evaluate(bl => {
  const g = window.__game, p = g.player.position;
  let best = 1e9, id = null, x = 0, z = 0, y = 0;
  for (const c of g.eggs.scene.children || []) if (c.userData && c.userData.wordId && !bl.includes(c.userData.wordId)) {
    const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
    if (d < best) { best = d; id = c.userData.wordId; x = c.position.x; z = c.position.z; y = c.position.y; }
  }
  return { id, x, z, y: +y.toFixed(1), d: +best.toFixed(1) };
}, blacklist);
const dist = t => page.evaluate(t => { const p = window.__game.player.position; return { d: +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1), y: +p.y.toFixed(1) }; }, t);
const DIRS = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];

for (let round = 0; round < 6; round++) {
  const tgt = await lock([]);
  if (!tgt.id) { console.log('no more eggs'); break; }
  console.log('round', round, tgt.id, 'd=' + tgt.d, 'eggY=' + tgt.y);
  const high = tgt.y > 1.5;
  let reach = false;
  // 平面段
  for (let t = 0; t < 22; t++) {
    const s = await dist(tgt);
    if (s.d <= (high ? 5.5 : 3.2)) { reach = true; break; }
    let improved = false;
    for (const keys of DIRS) {
      const before = await dist(tgt);
      await step(keys, 480);
      const after = await dist(tgt);
      if (after.d < before.d - 0.25) { improved = true; break; }
    }
    if (!improved) break;
  }
  // 高台段：面向蛋连跳
  if (high && reach) {
    for (let t = 0; t < 14; t++) {
      const s = await dist(tgt);
      if (s.d <= 3 && s.y > 2.2) { reach = true; break; }
      await page.keyboard.down('KeyW');
      await page.keyboard.press('Space');
      await page.waitForTimeout(650);
      await page.keyboard.up('KeyW');
      await page.waitForTimeout(250);
    }
  }
  const s = await dist(tgt);
  reach = reach && s.d <= (high ? 3.4 : 3.2) && (!high || s.y > 1.8);
  console.log('approach d=' + s.d, 'y=' + s.y, 'reach=' + reach);
  if (!reach) { console.log('fail, next egg'); continue; }
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2200);
  const word = await page.evaluate(() => {
    const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div');
    if (!card) return '';
    const big = [...card.querySelectorAll('div,span,b')].filter(e => e.children.length === 0 && /^[a-zA-Z][a-zA-Z\s'-]{1,15}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) > 28);
    return big.length ? big[0].textContent.trim() : '';
  });
  if (!word) { console.log('no card'); continue; }
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
await page.screenshot({ path: 'scripts/final-state.png' });
await ctx.close();
