import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
const page = await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(6000);
console.log(JSON.stringify(await page.evaluate(() => {
  const m = document.querySelector('.prof-mascot');
  if (!m) return { exists: false };
  const cs = getComputedStyle(m), r = m.getBoundingClientRect();
  return { pos: cs.position, display: cs.display, w: r.width, h: r.height, x: +r.x.toFixed(0), y: +r.y.toFixed(0), text: m.textContent, gridCol: cs.gridColumn, vis: cs.visibility };
})));
await ctx.close();
await browser.close();
