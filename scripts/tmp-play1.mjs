import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const browser = await chromium.launch({ headless: false, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(6000);
// 注册
await page.fill('#profile-name', '豆豆2');
await page.click('#gender-girl');
await page.selectOption('#profile-grade', '4');
await page.selectOption('#profile-term', 'up');
await page.click('#profile-start');
await page.waitForTimeout(4000);
// 过引导卡（最多 4 页）
for (let i = 0; i < 4; i++) {
  if (await page.locator('#intro-next').isVisible().catch(() => false)) {
    await page.click('#intro-next'); await page.waitForTimeout(1500);
  } else break;
}
// 课本选择卡关掉（先确认关卡目标再看）
if (await page.locator('#book-close').isVisible().catch(() => false)) await page.click('#book-close');
await page.waitForTimeout(3000);
// 前进（真实键盘事件）+ 左右转向
for (let i = 0; i < 6; i++) {
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'scripts/walk-' + i + '.png' });
}
console.log('walked, saved walk-0..5');
await browser.close();
