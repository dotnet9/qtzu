import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(12000);
await page.evaluate(() => {
  const g = window.__game, T = window.THREE;
  [...document.querySelectorAll('.overlay')].forEach(o => { if (o.id !== 'modal') o.classList.add('hidden'); });
  g.lockInput = false;
  const w = (g.world.islands || []).find(w => w.uid === g._currentStage().uid);
  const sign = w && w.grp ? w.grp.getObjectByName('welcome-sign') : null;
  if (sign) {
    const b = new T.Box3().setFromObject(sign);
    g.camera.position.set(b.min.x - 1, b.max.y + 0.3, b.max.z + 2);
    g.camera.lookAt(b.getCenter(new T.Vector3()));
  }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'scripts/sign-final.png' });
await ctx.close();
