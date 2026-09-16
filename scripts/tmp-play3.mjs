import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: false, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(7000);
// 无存档则注册（持久化后只发生一次）
if (await page.locator('#profile-start').isVisible().catch(() => false)) {
  await page.fill('#profile-name', '豆豆2');
  await page.click('#gender-girl');
  await page.selectOption('#profile-grade', '4');
  await page.selectOption('#profile-term', 'up');
  await page.click('#profile-start');
  await page.waitForTimeout(4000);
}
for (let i = 0; i < 4; i++) {
  if (await page.locator('#intro-next').isVisible().catch(() => false)) { await page.click('#intro-next'); await page.waitForTimeout(1400); } else break;
}
for (let i = 0; i < 10; i++) {
  await page.keyboard.down('KeyS'); await page.waitForTimeout(700); await page.keyboard.up('KeyS');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'scripts/city-' + i + '.png' });
}
console.log('done');
await ctx.close();
