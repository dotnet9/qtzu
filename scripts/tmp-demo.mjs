import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const browser = await chromium.launch({ headless: false, executablePath: exe });
for (const [w, h, name] of [[390, 844, 'portrait'], [844, 390, 'landscape'], [375, 667, 'se']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:6100/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => { const ks = await caches.keys(); for (const k of ks) await caches.delete(k); });
  await page.reload();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'scripts/demo-' + name + '.png' });
  console.log(name, 'ok');
  await page.waitForTimeout(4000);
  await ctx.close();
}
await browser.close();
