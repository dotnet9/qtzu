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
await page.keyboard.press('KeyE');
await page.waitForTimeout(2000);
// 朗读卡大字 = 目标词
const word = await page.evaluate(() => {
  const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div');
  if (!card) return '';
  const big = [...card.querySelectorAll('div,span,b')].filter(e => e.children.length === 0 && /^[a-zA-Z][a-zA-Z\s'-]{1,15}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) > 28);
  return big.length ? big[0].textContent.trim() : '';
});
console.log('word=', word);
await page.locator('text=拼字母块').first().click();
await page.waitForTimeout(1500);
// 按顺序点字母块
for (const ch of word) {
  const ok = await page.evaluate(c => {
    const t = [...document.querySelectorAll('.tile')].find(x => (x.textContent || '').trim().toLowerCase() === c && !x.disabled && getComputedStyle(x).display !== 'none');
    if (t) { t.click(); return true; } return false;
  }, ch);
  if (!ok) console.log('tile miss:', ch);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/hatch-result.png' });
console.log('spelled', word);
await ctx.close();
