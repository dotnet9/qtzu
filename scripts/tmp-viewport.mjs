import { createRequire } from 'module';
import { readdirSync } from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const chromeRoot = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47';
const exe = chromeRoot + '/chrome.exe';
const browser = await chromium.launch({ headless: false, executablePath: exe });
for (const [w, h, name] of [[390, 844, 'mp'], [844, 390, 'ml'], [1280, 800, 'dt']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:6100/', { waitUntil: 'load' });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'scripts/audit-' + name + '.png' });
  await page.close();
  console.log('shot', name);
}
await browser.close();
