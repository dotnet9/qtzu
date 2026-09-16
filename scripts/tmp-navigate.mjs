import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: false, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(7000);
const info = await page.evaluate(() => {
  const g = window.__game;
  const p = g.player.position;
  const list = (g.eggs.scene.children || []).map(c => ({
    name: c.name || (c.userData && (c.userData.word || c.userData.id)) || '?',
    x: +c.position.x.toFixed(0), z: +c.position.z.toFixed(0),
    d: +Math.hypot(c.position.x - p.x, c.position.z - p.z).toFixed(0),
    ud: c.userData ? Object.keys(c.userData).join('|') : ''
  }));
  list.sort((a, b) => a.d - b.d);
  return { player: { x: +p.x.toFixed(0), z: +p.z.toFixed(0) }, near: list.slice(0, 6) };
});
console.log(JSON.stringify(info, null, 1));
await ctx.close();
