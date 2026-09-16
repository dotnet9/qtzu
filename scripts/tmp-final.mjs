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
  let best = 1e9, id = null, x = 0, z = 0;
  for (const c of g.eggs.scene.children || []) if (c.userData && c.userData.wordId && !bl.includes(c.userData.wordId)) {
    const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
    if (d < best) { best = d; id = c.userData.wordId; x = c.position.x; z = c.position.z; }
  }
  return { id, x, z, d: +best.toFixed(1) };
}, blacklist);
const dist = t => page.evaluate(t => { const p = window.__game.player.position; return +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1); }, t);
const DIRS = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];
const hatchCount = () => page.evaluate(() => { const m = (document.querySelector('.pill:nth-child(2)') || {}).textContent || ''; const m2 = m.match(/(\d)\/6/); return m2 ? +m2[1] : null; });

const blacklist = [];
for (let round = 0; round < 6; round++) {
  const tgt = await lock(blacklist);
  if (!tgt.id) { console.log('no more eggs'); break; }
  console.log('round', round, tgt.id, 'd=' + tgt.d);
  let stuck = 0, reach = false;
  for (let t = 0; t < 22; t++) {
    const d = await dist(tgt);
    if (d <= 3.2) { reach = true; break; }
    let improved = false;
    for (const keys of DIRS) {
      const before = await dist(tgt);
      await step(keys, 480);
      const after = await dist(tgt);
      if (after < before - 0.25) { improved = true; break; }
    }
    stuck = improved ? 0 : stuck + 1;
    if (stuck >= 2) break;
  }
  if (!reach) { console.log('unreachable, blacklist', tgt.id); blacklist.push(tgt.id); continue; }
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2200);
  const word = await page.evaluate(() => {
    const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div');
    if (!card) return '';
    const big = [...card.querySelectorAll('div,span,b')].filter(e => e.children.length === 0 && /^[a-zA-Z][a-zA-Z\s'-]{1,15}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) > 28);
    return big.length ? big[0].textContent.trim() : '';
  });
  if (!word) { console.log('no card'); blacklist.push(tgt.id); continue; }
  console.log('word=', word);
  await page.locator('text=拼字母块').first().click();
  await page.waitForTimeout(1400);
  for (const ch of word) {
    await page.evaluate(c => { const t = [...document.querySelectorAll('.tile')].find(x => (x.textContent || '').trim().toLowerCase() === c && !x.disabled); if (t) t.click(); }, ch);
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'scripts/hatch-' + round + '.png' });
  console.log('hatched', word, '| count', await hatchCount());
}
const hud = await page.evaluate(() => [...document.querySelectorAll('.pill')].map(x => x.textContent.trim()).join(' | '));
console.log('HUD:', hud);
await page.screenshot({ path: 'scripts/final-state.png' });
await ctx.close();
