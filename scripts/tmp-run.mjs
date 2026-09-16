import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
const safeGoto = async () => { await page.goto('http://localhost:6100/', { waitUntil: 'load' }); await page.waitForTimeout(8000); };
const step = async (keys, ms = 500) => {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(200);
};
const lock = bl => page.evaluate(bl => {
  const g = window.__game, p = g.player.position;
  let best = 1e9, id = null, x = 0, z = 0, y = 0;
  for (const c of g.eggs.scene.children || []) if (c.userData && c.userData.wordId && !bl.includes(c.userData.wordId)) {
    const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
    if (d < best) { best = d; id = c.userData.wordId; x = c.position.x; z = c.position.z; y = c.position.y; }
  }
  return { id, x, z, y: +y.toFixed(1), d: +best.toFixed(1) };
}, bl);
const dist = t => page.evaluate(t => { const p = window.__game.player.position; return { d: +Math.hypot(t.x - p.x, t.z - p.z).toFixed(1), y: +p.y.toFixed(1) }; }, t);
const DIRS = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];
const bl = [];
let hatched = 0;
await safeGoto();
for (let round = 0; round < 8 && hatched < 6; round++) {
  const tgt = await lock(bl).catch(() => null);
  if (!tgt || !tgt.id) break;
  console.log('round', round, tgt.id, 'd=' + tgt.d, 'eggY=' + tgt.y);
  const high = tgt.y > 1.5;
  let reach = false;
  for (let t = 0; t < 24; t++) {
    const s = await dist(tgt).catch(() => null);
    if (!s) break;
    if (s.d <= (high ? 5.5 : 4.0)) { reach = true; break; }
    let improved = false, stuck = 0;
    for (const keys of DIRS) {
      const before = await dist(tgt).catch(() => null);
      if (!before) break;
      await step(keys, 700);
      const after = await dist(tgt).catch(() => null);
      if (!after) break;
      if (after.d < before.d) { improved = true; break; }
    }
    if (!improved) { stuck++; if (stuck >= 3) break; } else stuck = 0;
  }
  if (high && reach) {
    for (let t = 0; t < 14; t++) {
      const s = await dist(tgt).catch(() => null);
      if (!s) break;
      if (s.d <= 4 && s.y > 1.6) break;
      await page.keyboard.down('KeyW');
      await page.keyboard.press('Space');
      await page.waitForTimeout(650);
      await page.keyboard.up('KeyW');
      await page.waitForTimeout(250);
    }
  }
  const s = await dist(tgt).catch(() => null);
  reach = !!s && s.d <= 4.2 && (!high || s.y > 1.5);
  console.log('approach d=' + (s ? s.d : '?'), 'reach=' + reach);
  if (!reach) { bl.push(tgt.id); continue; }
  // 确认 prompt 是孵蛋（防止误触火车站/井等其他交互）
  const promptOk = await page.evaluate(() => {
    const el = document.querySelector('#prompt, .prompt, [id*=prompt]');
    return el ? /蛋|egg|word/i.test(el.textContent) : false;
  }).catch(() => false);
  if (!promptOk) { console.log('prompt not egg, skip'); bl.push(tgt.id); continue; }
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2200);
  const word = await page.evaluate(() => {
    const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div');
    if (!card) return '';
    const big = [...card.querySelectorAll('div,span,b')].filter(e => e.children.length === 0 && /^[a-zA-Z][a-zA-Z\s'-]{1,15}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) > 28);
    return big.length ? big[0].textContent.trim() : '';
  }).catch(() => { console.log('nav destroyed, re-goto'); return null; });
  if (word === null) { await safeGoto(); continue; }
  if (!word) { console.log('no card'); bl.push(tgt.id); continue; }
  console.log('word=', word);
  const sw = await page.locator('text=拼字母块').first().isVisible().catch(() => false);
  if (sw) { await page.locator('text=拼字母块').first().click(); await page.waitForTimeout(1400); }
  for (const ch of word) {
    await page.evaluate(c => { const t = [...document.querySelectorAll('.tile')].find(x => (x.textContent || '').trim().toLowerCase() === c && !x.disabled); if (t) t.click(); }, ch).catch(() => {});
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(2800);
  hatched++;
  await page.screenshot({ path: 'scripts/win-' + hatched + '.png' });
  console.log('hatched', word, '=>', hatched + '/6');
}
console.log('TOTAL:', hatched + '/6');
await page.screenshot({ path: 'scripts/final.png' });
await ctx.close();
