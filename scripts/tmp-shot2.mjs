import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
for (const [w, h, name] of [[390, 844, 'p'], [844, 390, 'l'], [375, 667, 'se']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:6100/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'scripts/reg2-' + name + '.png' });
  const chk = await page.evaluate(() => {
    const chip = document.querySelector('#profile-city.city-chip');
    const lang = document.querySelector('.lang-cycle');
    const fold = document.querySelector('.pwd-fold');
    const bubble = document.querySelector('.prof-bubble');
    const r = el => el ? { x: +el.getBoundingClientRect().x.toFixed(0), y: +el.getBoundingClientRect().y.toFixed(0), vis: el.offsetParent !== null } : null;
    return { chip: r(chip), lang: r(lang), fold: r(fold), bubble: r(bubble), bubbleText: bubble && bubble.textContent };
  });
  console.log(name, JSON.stringify(chk).slice(0, 300));
  await ctx.close();
}
await browser.close();
