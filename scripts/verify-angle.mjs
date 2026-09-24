// 多角度体检：同一套几何，按**玩家真能到的机位**（yaw N 档 × pitch 4 档，pitch 取游戏
// camPitch 的可达区间 0.08~1.05）逐角度隔离渲染，用像素统计判断"这个角度合不合理"。
//
//   node scripts/verify-angle.mjs [--city chengdu] [--only 名字片段] [--sheet] [--yaw 8]
//
// 机位口径与游戏一致：物体**坐在地面上**（y 从包围盒底面贴 0）、相机绕它转且不低于地面。
// 剪影靠 **alpha 通道**判（隔离场景不设 background + 透明清屏）—— 用"亮度与背景不同"判前景时，
// 亮度恰好接近背景的面（内壁/背光面）会被漏掉，测出来的覆盖比就不可信了。
//
// 三趟渲染 / 两条判据：
//   ① 作者材质            → 剪影 cover、透空 holes、亮度分层 lumLevels（诊断）
//   ② 强制 DoubleSide     → **dsGain**：剪影因此变大 = 有面只在"背面"可见（单面几何，机位一变就露）
//   ③ 中性白哑光材质      → **flatShare**：同一套光下仍读成"一整块平色"的角度占比
//                           （>50% 才是纸片；少数角度平是方形体的正常表现 —— 那是光照问题，见诊断列）
// 细长形体（包围盒 min/max < 0.25，如栏杆/指路牌/旗面）不判这两条 —— 它们本来就扁/透空。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const only = optOf('--only', null);
const wantAllSheets = process.argv.includes('--sheet');
const nYaw = Number(optOf('--yaw', 8));
const nPitch = Number(optOf('--pitch', 4));
const PORT = 6240 + Math.floor(Math.random() * 9);
const OUT = path.resolve(import.meta.dirname, '../.cache/look/angle');
fs.mkdirSync(OUT, { recursive: true });

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 620 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '多角度体检', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3500);

const res = await page.evaluate(async ({ N_YAW, N_PITCH, ONLY }) => {
  const THREE = await import('three');
  const g = window.__game;
  const { cityLandmark } = await import('/js/world.js');
  const { buildPlayer, buildPet, PROPS } = await import('/js/models.js');
  const st = g._currentStage();
  const sky = g._sky();

  // ---- 被测对象（在隔离场景里现建 / 克隆，不碰游戏场景里的原件）----
  const subs = [];
  const safe = (name, fn) => { try { const o = fn(); if (o) subs.push({ name, obj: o }); } catch (e) { /* 需要图片等特殊参数的跳过 */ } };
  for (const t of ['gate', 'tower', 'wall', 'panda', 'ice', 'palm', 'dome', 'mountain', 'pavilion', 'bridge', 'grotto', 'harbor']) {
    safe('地标:' + t, () => cityLandmark(t, st.color, t, null, { key: t }));
  }
  safe('地标:uni-gate', () => cityLandmark('uni-gate', st.color, '清华大学', null, { key: 'uni-gate' }));
  safe('玩家:boy', () => buildPlayer('boy', {}).group);
  safe('玩家:girl+帽', () => buildPlayer('girl', { hat: 'wizard', balloon: true }).group);
  for (const p of ['bird', 'cat', 'panda', 'whale']) safe('词宠:' + p, () => buildPet(p));
  safe('道具:tree', () => PROPS.tree(false));
  safe('道具:pine', () => PROPS.pine(1));
  safe('道具:streetLamp', () => PROPS.streetLamp());
  safe('道具:fence', () => PROPS.fence());
  safe('道具:signpost', () => PROPS.signpost());
  safe('道具:well', () => PROPS.well());
  if (sky) {
    safe('天空岛:主岛', () => sky.isles[0].mesh);
    safe('天空岛:宝箱', () => sky.chest.mesh);
    safe('天空岛:风车', () => sky.mill.group);
    safe('天空岛:旗', () => sky.flag.mesh);
  }

  // ---- 隔离场景：与游戏同口径的 hemi/主光（无 IBL = 最差情况）----
  const scene = new THREE.Scene();
  scene.background = null;
  scene.add(new THREE.HemisphereLight(0xFFF6E8, 0x9CC98F, 0.62));
  const key = new THREE.DirectionalLight(0xFFF2DC, 1.35);
  key.position.set(18, 30, 12);
  scene.add(key);

  const W = 96, H = 96, CELL = 48;
  const rt = new THREE.WebGLRenderTarget(W, H);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const buf = new Uint8Array(W * H * 4);
  const cellCv = document.createElement('canvas');
  cellCv.width = W; cellCv.height = H;
  const cellCtx = cellCv.getContext('2d');
  const cam = new THREE.PerspectiveCamera(38, 1, 0.05, 800);
  const prevRT = g.renderer.getRenderTarget();
  const prevClear = new THREE.Color(); g.renderer.getClearColor(prevClear);
  const prevAlpha = g.renderer.getClearAlpha();
  g.renderer.setClearColor(0x000000, 0);
  const PITCH = [0.08, 0.26, 0.52, 1.05];       // 游戏 camPitch 的可达范围（低→高俯角）
  const PLAIN = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9, metalness: 0 });   // 中性白：只看形体

  const shoot = () => {
    g.renderer.setRenderTarget(rt);
    g.renderer.clear();
    g.renderer.render(scene, cam);
    g.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    const hist = new Float32Array(16);
    let cover = 0, holes = 0;
    for (let y = 0; y < H; y++) {
      let first = -1, last = -1;
      for (let x = 0; x < W; x++) if (buf[(y * W + x) * 4 + 3] > 8) { if (first < 0) first = x; last = x; }
      if (first < 0) continue;
      for (let x = first; x <= last; x++) {
        const i = y * W + x;
        if (buf[i * 4 + 3] > 8) {
          cover++;
          const lum = (buf[i * 4] * 0.2126 + buf[i * 4 + 1] * 0.7152 + buf[i * 4 + 2] * 0.0722) / 255;
          hist[Math.min(15, Math.floor(lum * 16))]++;
        } else holes++;
      }
    }
    let levels = 0;
    for (let k = 0; k < 16; k++) if (hist[k] > Math.max(2, cover * 0.02)) levels++;
    return { cover: cover / (W * H), holes, levels };
  };
  const drawCell = (c2, col, row) => {
    cellCtx.putImageData(new ImageData(new Uint8ClampedArray(buf), W, H), 0, 0);
    c2.drawImage(cellCv, 0, 0, W, H, col * CELL, row * CELL, CELL, CELL);
  };

  const out = [];
  for (const subj of subs) {
    if (ONLY && !subj.name.includes(ONLY)) continue;
    const node = subj.obj.clone(true);
    const wrap = new THREE.Group();
    wrap.add(node);
    scene.add(wrap);
    const bb = new THREE.Box3().setFromObject(wrap);
    const c = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    if (size.length() < 0.05) { scene.remove(wrap); continue; }
    const thin = Math.min(size.x, size.y, size.z) / Math.max(size.x, size.y, size.z) < 0.25;
    const rad = size.length() / 2;
    wrap.position.set(-c.x, -bb.min.y, -c.z);                          // 坐在地面上
    const lookY = size.y * 0.45;
    const dist = rad / Math.tan((38 / 2) * Math.PI / 180) * 1.15;
    cam.near = Math.max(0.02, dist - rad * 2.4);
    cam.far = dist + rad * 4;
    cam.updateProjectionMatrix();

    // 三趟要切换的材质：克隆一份记住原 side（"作者本意"那趟要还原 —— 本来就双面的不该被当纸片）
    const mats = [];
    node.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const wasArr = Array.isArray(o.material);
      const list = wasArr ? o.material : [o.material];
      const cloned = list.map((m) => { const n = m.clone(); n.userData.side0 = m.side; return n; });
      mats.push({ o, wasArr, cloned, front: list.filter((m) => m.side === THREE.FrontSide).length });
    });
    const nFront = mats.reduce((a, r) => a + r.front, 0);
    const setPass = (which) => {
      for (const rec of mats) {
        if (which === 'plain') { rec.o.material = PLAIN; continue; }
        rec.o.material = rec.wasArr ? rec.cloned : rec.cloned[0];
        for (const m of rec.cloned) m.side = which === 'authored' ? m.userData.side0 : THREE.DoubleSide;
      }
    };

    const cv = document.createElement('canvas');
    cv.width = CELL * N_YAW; cv.height = CELL * N_PITCH;
    const c2 = cv.getContext('2d');
    let coverMax = 0, dsMax = 1, holeSum = 0, lvSum = 0, formSum = 0, formMin = 9, n = 0, nMain = 0, nFlat = 0;
    const rows = [];
    for (let pi = 0; pi < N_PITCH; pi++) {
      const pitch = PITCH[pi] ?? (0.08 + pi * 0.3);
      const row = [];
      for (let yi = 0; yi < N_YAW; yi++) {
        const yaw = (yi / N_YAW) * Math.PI * 2, cp = Math.cos(pitch);
        cam.position.set(Math.sin(yaw) * cp * dist, lookY + Math.sin(pitch) * dist, Math.cos(yaw) * cp * dist);
        cam.position.y = Math.max(0.3, cam.position.y);                // 相机不低于地面（玩家的真实可达域）
        cam.lookAt(0, lookY, 0);
        cam.updateMatrixWorld(true);
        setPass('authored');
        const a = shoot();
        drawCell(c2, yi, N_PITCH - 1 - pi);                            // 低俯角画在下面
        setPass('double');
        const d = shoot();
        setPass('plain');
        const p = shoot();
        setPass('authored');
        coverMax = Math.max(coverMax, a.cover);
        holeSum += a.holes; lvSum += a.levels; formSum += p.levels; n++;
        row.push({ yaw: +(yaw * 180 / Math.PI).toFixed(0), pitch: +pitch.toFixed(2), cover: +a.cover.toFixed(4), ds: +(d.cover / Math.max(1e-6, a.cover)).toFixed(2), form: p.levels, holes: a.holes, levels: a.levels });
      }
      rows.push(row);
    }
    // 只统计"这个角度看得见主体"的格子：细长形体侧看只剩几像素，那一格的比值没有意义
    for (const row of rows) for (const cell of row) {
      if (cell.cover < coverMax * 0.4 || cell.cover <= 0.004) continue;
      dsMax = Math.max(dsMax, cell.ds);
      formMin = Math.min(formMin, cell.form);
      nMain++;
      if (cell.form <= 1) nFlat++;
    }
    scene.remove(wrap);
    out.push({
      name: subj.name, thin, nFront, nMesh: mats.length,
      coverMin: +Math.min(...rows.flat().map((r) => r.cover)).toFixed(3), coverMax: +coverMax.toFixed(3),
      dsGain: +(dsMax === 1 ? 1 : dsMax).toFixed(2),
      holesPct: +((holeSum / Math.max(1, n)) / (W * H) * 100).toFixed(2),
      levels: +(lvSum / Math.max(1, n)).toFixed(1),
      form: +(formSum / Math.max(1, n)).toFixed(1),
      formMin: +(formMin === 9 ? 0 : formMin).toFixed(1),
      flatShare: +(nFlat / Math.max(1, nMain)).toFixed(2),
      sheet: cv.toDataURL('image/png'),
      rows,
    });
  }
  g.renderer.setRenderTarget(prevRT);
  g.renderer.setClearColor(prevClear, prevAlpha);
  return { stats: out };
}, { N_YAW: nYaw, N_PITCH: nPitch, ONLY: only });

// ---------- 判定 ----------
const P = { dsGain: 1.05, flatShare: 0.5, holesPct: 2 };
const fails = [], warns = [];
console.log(`多角度体检（${city}）：yaw ${nYaw} 档 × pitch ${nPitch} 档 × 三趟 = ${nYaw * nPitch * 3} 张\n`);
console.log('  对象'.padEnd(20) + '单面增益'.padEnd(10) + '平色角度%'.padEnd(11) + '形体avg/min'.padEnd(13) + '亮度层'.padEnd(9) + '剪影 min~max'.padEnd(20) + '透空%  判定');
for (const s of res.stats) {
  const bad = [];
  if (!s.thin && s.dsGain > P.dsGain) bad.push(`有面只在背面可见(剪影 ×${s.dsGain})`);
  if (!s.thin && s.flatShare > P.flatShare) bad.push(`${Math.round(s.flatShare * 100)}% 的角度读成一块平色`);
  // 透空只当诊断：拱门/栏杆/半透明冰雕本来就有正常空隙，"有洞"不等于缺陷
  if (s.holesPct > P.holesPct) warns.push(`${s.name}：剪影里透出背景 ${s.holesPct}%（拱门开口/半透明/真缺口，看一眼对照图确认）`);
  if (s.form >= 2 && s.levels < s.form - 1) warns.push(`${s.name}：白模能读出 ${s.form} 层（最差 ${s.formMin}），作者材质只剩 ${s.levels} 层 —— 材质/光照把体积藏住了（补光/AO 该跟上）`);
  if (s.nFront === 0 && s.nMesh > 0) { /* 全是双面：不额外报 */ }
  const ok = bad.length === 0;
  if (!ok) fails.push(`${s.name}：${bad.join('；')}`);
  console.log('  ' + s.name.padEnd(18) + String(s.dsGain).padEnd(10) + String(Math.round(s.flatShare * 100) + '%').padEnd(11)
    + `${s.form} / ${s.formMin}`.padEnd(13) + String(s.levels).padEnd(9)
    + `${s.coverMin.toFixed(3)}~${s.coverMax.toFixed(3)}`.padEnd(20) + (String(s.holesPct) + '   ').padEnd(7)
    + (ok ? '✓' : '✗ ' + bad.join('；')) + (s.thin ? '  (扁形体，不判)' : ''));
}
if (warns.length) { console.log('\n  ⚠ 诊断（不判失败，用来定位原因）：'); for (const w of warns) console.log('    · ' + w); }
fs.writeFileSync(path.resolve(OUT, '../angle.json'), JSON.stringify({
  city, at: new Date().toISOString(), limits: P, fails, warns,
  stats: res.stats.map(({ sheet, rows, ...r }) => ({ ...r, worst: rows.flat().slice().sort((a, b) => b.ds - a.ds).slice(0, 3) })),
}, null, 1));
console.log('\n明细：.cache/angle.json（含每个角度读数与最差 3 个角度）');

let nSheet = 0;
for (const s of res.stats) {
  const isFail = fails.some((f) => f.startsWith(s.name + '：'));
  if (!isFail && !wantAllSheets) continue;
  const file = path.join(OUT, s.name.replace(/[^\w\u4e00-\u9fa5:.-]/g, '_') + '.png');
  fs.writeFileSync(file, Buffer.from(String(s.sheet).split(',')[1], 'base64'));
  nSheet++;
}
if (nSheet) console.log(`对照图 ${nSheet} 张 → .cache/look/angle/（行=pitch 低→高，列=yaw 0°→315°；加 --sheet 可全出）`);

if (errs.length) { console.log('  ✗ 页面异常：' + errs.slice(0, 2).join(' | ')); fails.push('页面异常'); }
await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 多角度体检全部通过');
if (fails.length) process.exitCode = 1;
