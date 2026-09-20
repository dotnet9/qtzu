// 52 城逐城验收：每城进一次，断言 0 控制台错误、烘焙资产命中率、城市元素齐全。
//
//   node scripts/verify-cities.mjs               全部城市
//   node scripts/verify-cities.mjs --cities chengdu,beijing   只测指定城
//   node scripts/verify-cities.mjs --shots       每城截图到 .cache/shots/cities/
//
// 为什么必须逐城：资产是按"城"装配的（校门按校名查、地标按 城市#槽位 查），
// 一处 key 对不上只会影响那一座城——整城跑一遍比抽查靠谱；顺带把"资产换装后
// 有没有报错/有没有把牌子清掉"这类回归一起测了。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, '.cache/shots/cities');
const optOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const wantShots = process.argv.includes('--shots');
const only = (optOf('--cities') || '').split(',').filter(Boolean);
const PORT = 6180 + Math.floor(Math.random() * 15);
const VIEW = { width: 1280, height: 760 };
const SETTLE = 4500;      // 每城等资产落地（含 1.5s 超时上限）

const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cities/index.json'), 'utf8')).cities.map((c) => c.id);
const cities = only.length ? only : all;
fs.mkdirSync(SHOTS, { recursive: true });

const srv = await serve(PORT);
const ctx = await launch({ viewport: VIEW, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ save: null, token: 'test-token', ok: true, rank: 1, rows: [] }),
}));

const seed = () => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '巡城验收', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
};

const page = await ctx.newPage();
await page.addInitScript(seed);
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
// 404 只可能是资产缺失：单独收集，最后统一报（比"控制台错误"更可行动）
const missing = [];
page.on('response', (r) => { if (r.status() === 404 && /\.(glb|json)(\?|$)/.test(r.url())) missing.push(r.url().split('/').pop()); });

await page.goto(`${srv.base}?debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.evaluate(() => {
  const g = window.__game;
  g.lockInput = false; g.cinematic = false;
  [...document.querySelectorAll('.overlay')].forEach((o) => o.classList.add('hidden'));
});

const rows = [];
for (const id of cities) {
  const before = errors.length;
  await page.evaluate((cid) => window.__game._handleShareCity(cid, true), id);
  await page.waitForFunction((cid) => (window.__game._currentStage() || {}).key === cid, id, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(SETTLE);
  const unis = (() => {
    try {
      return (JSON.parse(fs.readFileSync(path.join(ROOT, `data/cities/${id}/universities.json`), 'utf8')).unis || [])
        .map((u) => u.zh || u.name);
    } catch { return []; }
  })();
  const r = await page.evaluate(({ cid, names }) => {
    const g = window.__game;
    const st = g._currentStage() || {};
    // 只看本城的组：换城后旧城的组还留在场景里（其他城市在雾外"等待解锁"），
    // 不按归属过滤的话统计会一路累加，看不出单城的命中率。
    const want = new Set(names);
    const gates = [], lms = [];
    g.scene.traverse((o) => {
      if (!o.isGroup) return;
      if (o.userData.lm) {
        if (String(o.userData.lm.key).startsWith(cid + '#')) {
          lms.push({ key: o.userData.lm.key, asset: o.userData.asset || null });
        }
      } else if (o.userData.sign && o.userData.sign.type === 'uni' && want.has(o.userData.sign.zh)) {
        // 只要最外层那座：onSwap 给整棵子树打了 userData.sign（点击判定要用），
        // GLB 内部的节点组也带，过滤掉父级同 sign 的，否则一校算成三个
        if (o.parent && o.parent.userData.sign === o.userData.sign) return;
        gates.push({ zh: o.userData.sign.zh, asset: o.userData.asset || null });
      }
    });
    return {
      stage: st.key, radius: st.r,
      gates: gates.length, gateHits: gates.filter((x) => x.asset).length,
      lms: lms.length, lmHits: lms.filter((x) => x.asset).length,
      signs: (g._signList || []).length,
      stats: window.__assets.stats(),
    };
  }, { cid: id, names: unis });
  const errs = errors.length - before;
  rows.push({ id, ...r, errs, msgs: errors.slice(before, before + 3) });
  if (errs) for (const m of errors.slice(before, before + 3)) console.log(`    ${id}: ${m}`);
  const tag = r.stage === id ? '' : `  ← 没进到该城（当前 ${r.stage}）`;
  console.log(`${id.padEnd(12)} 门 ${String(r.gateHits).padStart(2)}/${String(r.gates).padEnd(2)}`
    + ` 地标 ${r.lmHits}/${r.lms} 牌子 ${String(r.signs).padStart(2)} 失败资产 ${r.stats.failed.length}`
    + ` 错误 ${errs}${tag}`);
  if (wantShots) {
    await page.evaluate(() => {
      const g = window.__game;
      g.camDist = g.camDistTarget = 62; g.camPitch = 0.9;
      const st = g._currentStage();
      g.player.position.set(st.cx, 0, st.cz + st.r * 0.25);
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });
  }
}

await ctx.close();
srv.stop();

const bad = rows.filter((r) => r.errs > 0 || r.stage !== r.id);
const gatesTotal = rows.reduce((s, r) => s + r.gates, 0);
const gateHits = rows.reduce((s, r) => s + r.gateHits, 0);
const lmTotal = rows.reduce((s, r) => s + r.lms, 0);
const lmHits = rows.reduce((s, r) => s + r.lmHits, 0);
console.log(`\n${rows.length} 城：校门命中 ${gateHits}/${gatesTotal}，地标命中 ${lmHits}/${lmTotal}，`
  + `404 资源 ${[...new Set(missing)].slice(0, 6).join(',') || '无'}`);
if (bad.length) {
  console.log(`✗ ${bad.length} 城有问题：` + bad.map((r) => r.id).join(', '));
  process.exitCode = 1;
} else {
  console.log('✓ 52 城逐城 0 错误');
}
