import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.addInitScript(() => {
  window.__errs = []; const _ce = console.error.bind(console); console.error = function(){ try { window.__errs.push('CE: ' + Array.prototype.map.call(arguments, function(a){ return String(a && a.stack || a).slice(0, 300); }).join(' | '); } catch(e){} _ce.apply(null, arguments); };
  window.addEventListener('unhandledrejection', e => window.__errs.push('REJ: ' + String(e.reason && (e.reason.stack || e.reason)).slice(0, 500)));
  window.addEventListener('error', e => window.__errs.push('ERR: ' + String(e.error && e.error.stack || e.message).slice(0, 500)));
});
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(40000);
const out = await page.evaluate(() => ({ errs: (window.__errs || []).slice(0, 3), game: !!window.__game, hasWorld: !!(window.__game && window.__game.world), scene: !!(window.__game && window.__game.scene), cam: !!(window.__game && window.__game.camera), player: !!(window.__game && window.__game.player), sceneN: window.__game && window.__game.scene ? window.__game.scene.children.length : -1, ctorDone: window.__game.canvas !== undefined, keys: Object.keys(window.__game).filter(function(k){return /world|scene|player|canvas/.test(k)}).join(",) }));
console.log('RESULT ' + JSON.stringify(out, null, 1).replace(/\r/g, +));
await ctx.close();