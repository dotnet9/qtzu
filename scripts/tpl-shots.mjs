import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const PICK = ['lhasa', 'harbin', 'suzhou', 'dunhuang'];
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1100, height: 700 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(25000);
for (const id of PICK) {
  await page.evaluate(cid => { window.__game._handleShareCity(cid, true); }, id);
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    const g = window.__game;
    [...document.querySelectorAll('.overlay')].forEach(o => { if (o.id !== 'modal') o.classList.add('hidden'); });
    g.lockInput = false; g.camDist = 70; g.camDistTarget = 70; g.camPitch = 1.0;
    const st = g._currentStage();
    g.player.position.set(st.cx, 0, st.cz);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `scripts/tpl-${id}.png` });
}
console.log('shots done');
await ctx.close();
