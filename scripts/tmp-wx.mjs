import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await page.goto('https://mp.weixin.qq.com/s/RzVj36dV-oWk86lThtBiwQ', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(350); }
const imgs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#js_content img').forEach(img => {
    const src = img.getAttribute('data-src') || img.src || '';
    if (!src.includes('mmbiz.qpic.cn')) return;
    out.push(src);
  });
  return out;
});
require('fs').writeFileSync('scripts/wx-srcs.json', JSON.stringify(imgs, null, 1));
console.log('imgs:', imgs.length);
await browser.close();
