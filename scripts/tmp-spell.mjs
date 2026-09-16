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
const state = () => page.evaluate(() => {
  const g = window.__game, p = g.player.position;
  let best = 1e9;
  for (const c of g.eggs.scene.children || []) if (c.userData && c.userData.wordId) {
    const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
    if (d < best) best = d;
  }
  return +best.toFixed(1);
});
const step = async (key, ms = 600) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(250); };
let d = await state(), tries = 0;
while (d > 3.5 && tries++ < 60) {
  let moved = false;
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const before = await state();
    await step(key, 550);
    d = await state();
    if (d < before - 0.3) { moved = true; break; }
  }
  if (!moved) await step('KeyW', 1200);
}
console.log('d=' + d);
await page.keyboard.press('KeyE');
await page.waitForTimeout(2000);
const sw = await page.locator('text=拼字母块').first().isVisible().catch(() => false);
console.log('spell-switch visible:', sw);
if (sw) { await page.locator('text=拼字母块').first().click(); await page.waitForTimeout(1500); }
// dump 挑战卡结构
const dump = await page.evaluate(() => {
  const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div') || document.body;
  const btns = [...card.querySelectorAll('button, .tile, [class*=tile], [class*=slot]')].slice(0, 30).map(b => (b.id || b.className + '') + '::' + (b.textContent || '').trim().slice(0, 12));
  return btns;
});
console.log(JSON.stringify(dump, null, 1));
await page.screenshot({ path: 'scripts/spell-1.png' });
await ctx.close();
