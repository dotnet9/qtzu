import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(12000);
await page.evaluate(() => {
  const g = window.__game;
  [...document.querySelectorAll('.overlay')].forEach(o => { if (o.id !== 'modal') o.classList.add('hidden'); });
  g.lockInput = false;
  const st = g._currentStage();
  const w = (g.world.islands || []).find(w => w.uid === st.uid);
  let west = null;
  if (w && w.shape) { for (const p of w.shape) { if (!west || p[0] < west[0]) west = p; } }
  if (west) g.player.position.set(west[0] + 2.5, 0, west[1]);
  g.camPitch = 0.22; g.camDist = 10;
  g.camYaw = -Math.PI / 2;
});
await page.waitForTimeout(2000);
await page.screenshot({ path: 'scripts/edge-view.png' });
await ctx.close();
