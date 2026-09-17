import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(30000);
const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { noGame: true };
  const keys = Object.keys(g).filter(k => k.indexOf('world') >= 0 || k === 'scene' || k === 'player' || k === 'canvas' || k === 'renderer');
  return { ctorCanvas: g.canvas !== undefined, keys: keys.join(','), worldType: typeof g.world, sceneN: g.scene ? g.scene.children.length : -1 };
});
console.log('RESULT ' + JSON.stringify(out));
await ctx.close();