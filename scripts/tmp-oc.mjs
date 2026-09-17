import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(12000);
const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { noGame: true };
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
      const d = Math.hypot(cx0(a) - cx0(f), cz0(a) - cz0(f));
      if (d < (rr(a) + rr(f)) * 0.5) overlap++;
    }
  }
  return { fixed, autoN: autos.length, overlap, cur: g._currentStage().name };
});
console.log(JSON.stringify(out), '| errs:', JSON.stringify(errs.slice(0, 2)));
await page.evaluate(() => {
  const g = window.__game;
  [...document.querySelectorAll('.overlay')].forEach(o => { if (o.id !== 'modal') o.classList.add('hidden'); });
  g.lockInput = false;
  g.camDist = 60; g.camDistTarget = 60; g.camPitch = 1.05;
  const st = g._currentStage();
  g.player.position.set(st.cx, 0, st.cz);
});
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/overlap-check.png' });
await ctx.close();