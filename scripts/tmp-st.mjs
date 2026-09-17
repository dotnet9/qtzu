import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(25000);
const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { noGame: true, title: document.title };
  const cols = g.world.colliders.filter(c => !c.dead);
  const fixed = cols.filter(c => c.fixed).length;
  const autos = cols.filter(c => c.auto);
  let overlap = 0;
  const rr = c => c.t === 'c' ? Number(c.r) : Math.max(c.x2 - c.x1, c.z2 - c.z1) / 2;
  const cx0 = c => c.t === 'c' ? c.x : (c.x1 + c.x2) / 2;
  const cz0 = c => c.t === 'c' ? c.z : (c.z1 + c.z2) / 2;
  for (const a of autos) {
    for (const f of cols) {
      if (f === a || f.auto || f.dead) continue;
      if (Math.hypot(cx0(a) - cx0(f), cz0(a) - cz0(f)) < (rr(a) + rr(f)) * 0.5) overlap++;
    }
  }
  return { fixed, autoN: autos.length, overlap, cur: g._currentStage().name };
});
console.log('RESULT ' + JSON.stringify(out));
await ctx.close();