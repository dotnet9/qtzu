import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.addInitScript(() => {
  window.__errs = [];
  const ce = console.error.bind(console);
  console.error = function () {
    try { window.__errs.push('CE: ' + Array.prototype.map.call(arguments, a => String(a && a.stack || a).slice(0, 400)).join(' | ')); } catch (e) {}
    ce.apply(null, arguments);
  };
  window.addEventListener('unhandledrejection', e => window.__errs.push('REJ: ' + String(e.reason && (e.reason.stack || e.reason)).slice(0, 500)));
});
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(30000);
const out = await page.evaluate(() => ({ errs: (window.__errs || []).slice(0, 2), game: !!window.__game, hasWorld: !!(window.__game && window.__game.world) }));
console.log('RESULT ' + JSON.stringify(out, null, 1));
await page.waitForTimeout(3000);
await page.evaluate(() => { const g = window.__game; [...document.querySelectorAll('.overlay')].forEach(o => { if (o.id !== 'modal') o.classList.add('hidden'); }); g.lockInput = false; g.camDist = 60; g.camDistTarget = 60; g.camPitch = 1.05; const st = g._currentStage(); g.player.position.set(st.cx, 0, st.cz); });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/chengdu-v3.png' });
await ctx.close();