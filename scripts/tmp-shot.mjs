import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
for (const [w, h, name] of [[844, 390, 'land'], [375, 667, 'se'], [390, 844, 'norm']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:6100/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'scripts/reg-' + name + '.png' });
  if (name === 'land') {   // 横屏滚到底看 CTA 是否完整
    await page.evaluate(() => { const c = document.getElementById('profile-card'); if (c) c.scrollTop = c.scrollHeight; });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'scripts/reg-land-bottom.png' });
  }
  await ctx.close();
  console.log('shot', name);
}
await browser.close();
