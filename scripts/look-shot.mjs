// 固定机位取景 + 帧时长中位数：每一轮画面改动的"前后对比图"和性能闸门。
//
//   node scripts/look-shot.mjs --city chengdu                出 4 张图 + 帧时长，存 baseline
//   node scripts/look-shot.mjs --city chengdu --tag s1       存到 .cache/look/s1/（阶段对比）
//   node scripts/look-shot.mjs --city chengdu --compare      与 baseline 比帧时长（>5% 报警）
//
// 为什么要固定机位：画面改动最容易"感觉变好了但说不清"，同一机位同一时间点（白天档）
// 出图才能逐张看；帧时长中位数是唯一能挡住"精致到卡"的闸门。
//
// 输出：.cache/look/<tag>/{street,gate,city,char}.png + .cache/look/<tag>.json
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOOK = path.join(ROOT, '.cache/look');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const tag = optOf('--tag', 'baseline');
const compare = process.argv.includes('--compare');
const FRAMES = Number(optOf('--frames', '600'));
const msaa = optOf('--msaa');   // 传 ?msaa=N 量 MSAA 的代价
const PORT = 6160 + Math.floor(Math.random() * 20);
const VIEW = { width: 1280, height: 760 };

fs.mkdirSync(path.join(LOOK, tag), { recursive: true });
const srv = await serve(PORT);
const ctx = await launch({ viewport: VIEW, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ save: null, token: 'test-token', ok: true, rank: 1, rows: [] }),
}));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '取景', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});

await page.goto(`${srv.base}?city=${city}&debug=1${msaa ? `&msaa=${msaa}` : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const s = window.__assets && window.__assets.stats();
  return s && s.pending === 0;
}, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

// 固定"白天"光照：画面改动要与光照解耦，否则白天/夜晚两张图没法比
await page.evaluate(() => {
  const g = window.__game;
  const dn = g.world.anim.dayNight;
  if (!dn) return;
  dn.sun.intensity = 1.4; dn.hemi.intensity = 1.15;
  dn.sun.color.set(0xFFF2DC);
  dn.fog.color.set(0xCBE6F2);
  if (dn.dome) dn.dome.material.color.set(0xFFFFFF);
  g._updateDayNight = () => {};   // 关掉昼夜刷新，避免跑图过程中光照自己变
});

const shot = async (name, cam) => {
  await page.evaluate((c) => {
    const g = window.__game;
    [...document.querySelectorAll('.overlay')].forEach((o) => o.classList.add('hidden'));
    [...document.querySelectorAll('#quest,#npc-bubble,#loading')].forEach((o) => o.classList.add('hidden'));
    g.lockInput = false; g.cinematic = false;
    const st = g._currentStage();
    const u = (v) => v;   // 便于读
    if (c.kind === 'default') {
      g.player.position.set(st.cx, 0, st.cz + st.r * 0.16);
      g.player.rotation.y = Math.PI;
    } else if (c.kind === 'street') {
      // 迎宾主街：站在城心南侧回看主地标（默认游玩机位，最能代表日常观感）
      g.player.position.set(st.cx, 0, st.cz + st.r * 0.16);
      g.player.rotation.y = Math.PI;
      g.camYaw = u(c.yaw); g.camPitch = u(c.pitch); g.camDist = g.camDistTarget = u(c.dist);
    } else if (c.kind === 'gate') {
      const sign = (g._signList || []).find((s) => s.type === 'uni');
      const ux = st.cx - sign.x, uz = st.cz - sign.z, n = Math.hypot(ux, uz) || 1;
      g.player.position.set(sign.x + (ux / n) * 2.6, 0, sign.z + (uz / n) * 2.6);
      g.player.rotation.y = Math.atan2(-ux / n, -uz / n);
      g.camYaw = Math.atan2(ux / n, uz / n);
      g.camPitch = u(c.pitch); g.camDist = g.camDistTarget = u(c.dist);
    } else if (c.kind === 'city') {
      g.player.position.set(st.cx, 0, st.cz);
      g.camYaw = u(c.yaw); g.camPitch = u(c.pitch); g.camDist = g.camDistTarget = u(c.dist);
    } else {   // char：角色特写（脸/装扮/气球都进画面）
      g.player.position.set(st.cx + st.r * 0.1, 0, st.cz + st.r * 0.1);
      g.player.rotation.y = Math.PI * 0.9;
      g.camYaw = u(c.yaw); g.camPitch = u(c.pitch); g.camDist = g.camDistTarget = u(c.dist);
    }
  }, cam);
  await page.waitForTimeout(1200);   // 等相机平滑趋近到位
  await page.screenshot({ path: path.join(LOOK, tag, `${name}.png`) });
  console.log(`  ${name}.png`);
};

// 机位表：yaw/pitch/dist 都是"参考图那种低角度、主体大"的取景
const CAMS = {
  // default：不动相机，量的是游戏自己的默认机位（俯角/距离/FOV 改动看这张）
  default: { kind: 'default' },
  street: { kind: 'street', yaw: 0, pitch: 0.30, dist: 6.6 },
  gate: { kind: 'gate', pitch: 0.26, dist: 7.0 },
  city: { kind: 'city', yaw: 0.6, pitch: 0.95, dist: 78 },
  char: { kind: 'char', yaw: 0.2, pitch: 0.22, dist: 3.4 },
};

console.log(`[look] ${city} @ ${tag}`);
const perfOnly = process.argv.includes('--perf-only');
if (!perfOnly) for (const [name, cam] of Object.entries(CAMS)) await shot(name, cam);

// 帧时长中位数：固定 street 机位，连续采 FRAMES 帧
await shot('perf', CAMS.street);
const perf = await page.evaluate(async (n) => {
  const ts = [];
  await new Promise((res) => {
    let last = performance.now();
    const tick = (t) => {
      ts.push(t - last); last = t;
      if (ts.length >= n) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const s = ts.slice(10).sort((a, b) => a - b);   // 去掉前 10 帧的预热
  return { median: s[Math.floor(s.length / 2)], p90: s[Math.floor(s.length * 0.9)], n: s.length };
}, FRAMES);
console.log(`[look] 帧时长中位数 ${perf.median.toFixed(2)}ms（p90 ${perf.p90.toFixed(2)}ms，${perf.n} 帧）`);

const out = { city, tag, at: new Date().toISOString(), view: VIEW, perf, errors: errors.slice(0, 5) };
fs.writeFileSync(path.join(LOOK, `${tag}.json`), JSON.stringify(out, null, 1));

if (compare) {
  const base = path.join(LOOK, 'baseline.json');
  if (fs.existsSync(base)) {
    const b = JSON.parse(fs.readFileSync(base, 'utf8'));
    const d = (perf.median - b.perf.median) / b.perf.median;
    console.log(`[look] 对比基线：${b.perf.median.toFixed(2)}ms → ${perf.median.toFixed(2)}ms（${(d * 100).toFixed(1)}%）`
      + (d > 0.05 ? '  ⚠ 超过 5%，需要降级或写清取舍' : '  ✓ 未劣化'));
    if (d > 0.05) process.exitCode = 1;
  } else console.log('[look] 还没有 baseline.json（先跑一次不带 --tag 的）');
}
if (errors.length) console.log(`[look] 控制台错误 ${errors.length} 条：` + errors.slice(0, 3).join(' | '));

await ctx.close();
srv.stop();
console.log(`[look] 图：.cache/look/${tag}/   数据：.cache/look/${tag}.json`);
