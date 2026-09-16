import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: false, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(7000);
for (let i = 0; i < 8; i++) {
  if (await page.locator('#intro-next').isVisible().catch(() => false)) { await page.click('#intro-next'); await page.waitForTimeout(1500); } else break;
}
const state = () => page.evaluate(() => {
  const g = window.__game, p = g.player.position;
  let best = 1e9, tgt = null;
  for (const c of g.eggs.scene.children || []) {
    if (c.userData && c.userData.wordId) {
      const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
      if (d < best) { best = d; tgt = { x: +c.position.x.toFixed(0), z: +c.position.z.toFixed(0) }; }
    }
  }
  return { d: +best.toFixed(1), p: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, tgt };
});
const step = async (key, ms = 600) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(250); };
let st = await state();
console.log('start d=' + st.d);
let tries = 0;
while (st.d > 3.5 && tries++ < 60) {
  let moved = false;
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const before = (await state()).d;
    await step(key, 550);
    st = await state();
    if (st.d < before - 0.3) { moved = true; break; }
  }
  if (!moved) { await step('KeyW', 1200); st = await state(); }   // 四向都被挡：长步冲一下
  if (tries % 5 === 0) console.log('t' + tries, 'd=' + st.d);
}
console.log('final d=' + st.d);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'scripts/arrive.png' });
await ctx.close();
