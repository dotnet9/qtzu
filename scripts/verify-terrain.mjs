// 批量验证：逐城加载地形，查 terrain 钩子生效 + 零报错
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const CITIES = ['beijing','tianjin','shijiazhuang','zhengzhou','hefei','changchun','shenyang','kaifeng','qufu','xian','luoyang','datong','lanzhou','yinchuan','taiyuan','hohhot','lhasa','xining','urumqi','kunming','dunhuang','hangzhou','nanjing','nanchang','jinan','chengde','suzhou','shaoxing','yangzhou','wuxi','wuhan','chongqing','guiyang','dalian','qingdao','xiamen','shenzhen','zhuhai','kaohsiung','taichung','tainan','taipei','fuzhou','quanzhou','sanya','haikou','harbin','changsha','guangzhou','nanning','shanghai'];
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1100, height: 700 } });
const page = ctx.pages()[0] || await ctx.newPage();
const bad = [];
await page.addInitScript(() => {
  window.__errs = [];
  window.addEventListener('unhandledrejection', e => window.__errs.push('REJ: ' + String(e.reason).slice(0, 200)));
  const ce = console.error.bind(console);
  console.error = function () { try { window.__errs.push('CE: ' + Array.prototype.map.call(arguments, a => String(a).slice(0, 200)).join(' | ')); } catch (e) {} ce.apply(null, arguments); };
});
await page.goto('http://localhost:6100/?city=chengdu&debug=1', { waitUntil: 'load' });
await page.waitForTimeout(25000);
for (const id of CITIES) {
  const before = await page.evaluate(() => (window.__errs || []).length).catch(() => -1);
  await page.evaluate(cid => { const g = window.__game; if (g && g._handleShareCity) g._handleShareCity(cid, true); }, id).catch(() => {});
  await page.waitForTimeout(6500);
  const r = await page.evaluate(cid => {
    const g = window.__game;
    if (!g) return { ok: false, why: 'nogame' };
    const st = g._currentStage();
    const terr = !!(g.world.cityBounds && g.world.cityBounds[st.key] && g.world.cityBounds[st.key].terrainHeight);
    return { ok: true, city: st.key, terr };
  }, id).catch(e => ({ ok: false, why: String(e).slice(0, 80) }));
  const errN = await page.evaluate(() => (window.__errs || []).length).catch(() => -1);
  const newErrs = errN > 0 ? await page.evaluate(n => (window.__errs || []).slice(n), before < 0 ? 0 : before).catch(() => []) : [];
  const good = r.ok && r.terr && newErrs.length === 0;
  if (!good) bad.push({ id, r, errs: newErrs.slice(0, 1) });
  console.log((good ? 'OK ' : 'BAD ') + id + (good ? '' : ' ' + JSON.stringify({ r, e: newErrs.slice(0, 1) })).slice(0, 220));
}
console.log('DONE bad=' + bad.length + '/' + CITIES.length);
await ctx.close();
