import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
// 强制清 SW 缓存拿最新代码（SW activate 只装新缓存，页面可能还用旧 JS）
await page.evaluate(async () => { const ks = await caches.keys(); for (const k of ks) await caches.delete(k); const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); });
await page.reload();
await page.waitForTimeout(9000);
const step = async (key, ms = 700) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
};
const DIRS = ['KeyA', 'KeyS', 'KeyD', 'KeyW'];
const fails = {};
let hatched = 0;
for (let round = 0; round < 10 && hatched < 6; round++) {
  const tgt = await page.evaluate(bl => {
    const g = window.__game, p = g.player.position;
    let best = 1e9, id = null, x = 0, z = 0;
    for (const c of g.eggs.scene.children || []) if (c.userData && c.userData.wordId && !bl.includes(c.userData.wordId)) {
      const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
      if (d < best) { best = d; id = c.userData.wordId; x = c.position.x; z = c.position.z; }
    }
    return { id, x, z };
  }, Object.keys(fails).filter(k => fails[k] >= 2));
  if (!tgt.id) { console.log('no eggs left'); break; }
  console.log('round', round, tgt.id);
  // 导航（已验证模式）
  for (let i = 0; i < 40; i++) {
    const d = await page.evaluate(t => +Math.hypot(t.x - window.__game.player.position.x, t.z - window.__game.player.position.z).toFixed(2), tgt);
    if (d <= 4) break;
    let bestKey = null, bestD = d;
    for (const key of DIRS) {
      await step(key, 600);
      const nd = await page.evaluate(t => +Math.hypot(t.x - window.__game.player.position.x, t.z - window.__game.player.position.z).toFixed(2), tgt);
      if (nd < bestD) { bestD = nd; bestKey = key; }
    }
    if (bestKey) { await step(bestKey, 700); await step(bestKey, 700); }
    else await step('KeyW', 1500);
  }
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(2200);
  const word = await page.evaluate(() => {
    const card = document.querySelector('#ch-card') || document.querySelector('.overlay:not(.hidden) > div');
    if (!card) return '';
    const big = [...card.querySelectorAll('div,span,b')].filter(e => e.children.length === 0 && /^[a-zA-Z][a-zA-Z\s'-]{1,15}$/.test((e.textContent || '').trim()) && parseFloat(getComputedStyle(e).fontSize) > 28);
    return big.length ? big[0].textContent.trim() : '';
  });
  if (!word) { console.log('no card'); fails[tgt.id] = (fails[tgt.id] || 0) + 1; continue; }
  await page.screenshot({ path: 'scripts/dbg-r' + round + '.png' });
  const dbg = await page.evaluate(() => [...document.querySelectorAll('.overlay')].filter(o => !o.classList.contains('hidden')).map(o => o.id + '>' + (o.firstElementChild ? o.firstElementChild.id || o.firstElementChild.className : '?')));
  console.log('overlays:', JSON.stringify(dbg));
  console.log('word=', word);
  const sw = await page.locator('text=拼字母块').first().isVisible().catch(() => false);
  if (sw) {
    let switched = false;
    for (let k = 0; k < 3 && !switched; k++) {
      await page.locator('text=拼字母块').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      switched = await page.evaluate(() => document.querySelectorAll('.tile').length > 0).catch(() => false);
    }
    if (!switched) { console.log('spell ui not open'); fails[tgt.id] = (fails[tgt.id] || 0) + 1; continue; }
  }
  for (const ch of word) {
    const hit = await page.evaluate(c => {
      const t = [...document.querySelectorAll('.tile')].find(x => (x.textContent || '').trim().toLowerCase() === c && !x.disabled && !x.dataset.used);
      if (t) { t.dataset.used = '1'; t.click(); return true; }
      return false;
    }, ch);
    if (!hit) console.log('tile miss:', ch);
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(2800);
  // 关挑战卡（成绩单盖住拼写UI，不关会假循环）
  await page.evaluate(() => { const b = document.querySelector('#modal-close'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  hatched++;
  await page.screenshot({ path: 'scripts/win-' + hatched + '.png' });
  console.log('hatched', word, '=>', hatched + '/6');
}
const hud = await page.evaluate(() => [...document.querySelectorAll('.pill')].map(x => x.textContent.trim()).join(' | '));
console.log('HUD:', hud);
await page.screenshot({ path: 'scripts/final.png' });
await ctx.close();
