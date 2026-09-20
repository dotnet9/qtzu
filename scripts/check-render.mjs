// 渲染体检（数值闸门）：固定机位 + 强制出帧 + 像素统计，用来判断"地图是不是发白"。
//
//   node scripts/check-render.mjs                       默认成都，两个机位都测，超标退 1
//   node scripts/check-render.mjs --tag before           把结果存成基线（.cache/render-before.json）
//   node scripts/check-render.mjs --no-gate              只看数字不判失败（测基线时用）
//   node scripts/check-render.mjs --view over --probe    逐采样点回打射线 + 消融 + 隔离（查"白的是谁"）
//
// 两个坑都踩过，所以这里不靠"等一会儿再看"：
//   1) 页面是 rAF 驱动的，headless 下帧率/时机都不保证 —— 机位与出帧都由脚本显式调用
//      （game._updateCamera + composer.render），量的是同一帧，基线才有可比性；
//   2) _updateDayNight 按 new Date() 取小时（傍晚是金色低角光），不钉住时钟两个时间的数字没法比。
//
// 机位：俯瞰距离由城市半径 + 视口宽高比算出来（写死 camDist 62 框不下半宽 86 的成都），
// 近景用游戏默认玩法机位。草地采样点要求"城内平地（色带 0）+ 轮廓内 + 离城心够远（避开广场铺装）"，
// 取中位数判定（个别点落在蛋/立牌/树上不带偏结论）。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, '.cache/shots/render');
const optOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const CITY = optOf('--city') || 'chengdu';
const TAG = optOf('--tag') || 'now';
const ONLY = optOf('--view');
const GATE = !process.argv.includes('--no-gate');
const PROBE = process.argv.includes('--probe');
const PORT = 6160 + Math.floor(Math.random() * 20);
const VIEW = { width: 1600, height: 800 };
const VFOV = 46;                                   // js/game.js:196 的相机 FOV

// 门槛（方案 §二.1）：先测基线再压，超标即失败
const LIMIT = {
  over: [0, 0.04],            // 画面 luminance > 0.95 的像素占比（过曝面积）
  top: [0.55, 0.88],          // 画面上缘 1/5 平均亮度（纸面/天空不该是白纸）
  grassSat: [0.30, 1],        // 城内草地饱和度
  grassLum: [0.30, 0.70],     // 城内草地亮度
  composerDiff: [0, 0.02],    // 开/关后期合成的平均亮度差
};

/* ================= PNG 解码（零依赖：只认 Chrome 截图产出的 8bit / 非隔行 / RGB(A)） ================= */
function decodePng(buf) {
  if (buf.length < 16 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  for (let p = 8; p + 8 <= buf.length;) {
    const len = buf.readUInt32BE(p);
    const name = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (name === 'IDAT') idat.push(data);
    else if (name === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (type !== 6 && type !== 2)) {
    throw new Error(`不支持的 PNG（depth ${depth} type ${type} interlace ${interlace}）`);
  }
  const ch = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, px: out };
}

const lumOf = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const satOf = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx <= 0 ? 0 : (mx - mn) / mx; };
const med = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };

function stats(img, samples) {
  const { w, h, ch, px } = img;
  const at = (x, y) => { const i = (y * w + x) * ch; return [px[i], px[i + 1], px[i + 2]]; };
  let over = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = at(x, y);
    if (lumOf(r, g, b) > 0.95) over++;
    n++;
  }
  const bandH = Math.max(1, Math.round(h / 5));
  let topSum = 0, topN = 0;
  for (let y = 0; y < bandH; y++) for (let x = 0; x < w; x++) { const [r, g, b] = at(x, y); topSum += lumOf(r, g, b); topN++; }
  const hits = [];
  for (const s of samples || []) {
    if (s.ndcZ >= 1 || Math.abs(s.ndcX) > 0.95 || Math.abs(s.ndcY) > 0.95) continue;
    const x = Math.min(w - 1, Math.max(0, Math.round(s.px)));
    const y = Math.min(h - 1, Math.max(0, Math.round(s.py)));
    const [r, g, b] = at(x, y);
    hits.push({ rgb: [r, g, b], lum: lumOf(r, g, b), sat: satOf(r, g, b) });
  }
  return {
    px: [w, h], over: over / Math.max(1, n), top: topSum / Math.max(1, topN), n: hits.length, samples: hits,
    grassLum: med(hits.map((p) => p.lum)), grassSat: med(hits.map((p) => p.sat)),
    grassLum25: pct(hits.map((p) => p.lum), 0.25), grassLum75: pct(hits.map((p) => p.lum), 0.75),
  };
}

function meanDiff(a, b) {
  if (a.w !== b.w || a.h !== b.h) return null;
  let sum = 0, n = 0;
  for (let y = 0; y < a.h; y += 2) for (let x = 0; x < a.w; x += 2) {
    const i = (y * a.w + x) * a.ch;
    sum += Math.abs(lumOf(a.px[i], a.px[i + 1], a.px[i + 2]) - lumOf(b.px[i], b.px[i + 1], b.px[i + 2]));
    n++;
  }
  return sum / Math.max(1, n);
}

/* ================= 主流程 ================= */
const seed = () => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '渲染体检', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '4a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
};
const pinClock = () => { Date.prototype.getHours = () => 12; Date.prototype.getMinutes = () => 0; };

// 显式摆机位 + 强制出帧：不依赖 rAF 的时机，两次跑的构图一定一致
const drive = (page, cam) => page.evaluate(({ dist, pitch, at }) => {
  const g = window.__game;
  g.lockInput = false; g.cinematic = false;
  // 钉住天气：_updateWeather 每 90~180 秒会随机切雨/雪（主光 ×0.62/×0.78 = 整幅画面变暗），
  // 不钉住的话同一套参数两次跑出来的数字能差 0.13（比要修的问题还大）
  const w = g._weatherState || (g._weatherState = { cur: 'clear', next: 1e9 });
  w.cur = 'clear'; w.next = 1e9;
  if (g.world.anim.rain) g.world.anim.rain.visible = false;
  if (g.world.anim.snow) g.world.anim.snow.visible = false;
  if (g.world.anim.dayNight && g.world.anim.dayNight.baseSun) g.world.anim.dayNight.sun.intensity = g.world.anim.dayNight.baseSun;
  // 日月与光晕是天空装饰 sprite：视角一歪就有一大团亮斑进画面（实测过曝面积在 0.002~0.187 之间跳），
  // 把它排除掉，量的才是"场景本身"的过曝
  if (g.world.anim.dayNight) {
    const d = g.world.anim.dayNight;
    if (d.sunCore) d.sunCore.visible = false;
    if (d.sunHalo) d.sunHalo.visible = false;
    if (d.moon) d.moon.visible = false;
  }
  g.camYaw = 0; g.camPitch = pitch; g.camDist = g.camDistTarget = dist;
  g.player.position.set(at.x, g._groundY(at.x, at.z), at.z);
  g._occK = 1; g._occSmooth = 1; g._occLowN = 0;
  // DOM 叠层每张图都收一次：城市卡（#city-card）是进城的异步弹窗，脚本开头收一次收不住，
  // 它会带着一张白卡进画，把"过曝面积"从 0.002 顶到 0.187（近景指标就是这么假超标的）
  for (const sel of ['#hud', '#leaderboard-widget', '#brand-badge', '#vignette', '#quest', '#daily',
    '#city-pill', '#prompt', '#toast', '#cheer', '#pet-fact', '#npc-bubble', '#intro', '#update-bar',
    '#word-game', '#travel-card', '#help-card', '#city-card', '#shop-card', '#daily-card', '#about-card']) {
    document.querySelectorAll(sel).forEach((el) => el.classList.add('hidden'));
  }
  document.querySelectorAll('.overlay').forEach((el) => el.classList.add('hidden'));
  g._updateDayNight();
  g._updateCamera(1);                       // dt=1 → 插值系数 1，直接到目标机位
  const t = g.player.position, d = g.camDist + (g._viewBoost || 0);
  const cp = Math.cos(g.camPitch);
  g.camera.position.set(t.x + Math.sin(g.camYaw) * cp * d, t.y + Math.sin(g.camPitch) * d + 1.6, t.z + Math.cos(g.camYaw) * cp * d);
  g.camera.lookAt(t.x, t.y + 1.0, t.z);
  g.camera.updateMatrixWorld(true);
  if (g.composer) g.composer.render(); else g.renderer.render(g.scene, g.camera);
}, { dist: cam.dist, pitch: cam.pitch, at: cam.at });

fs.mkdirSync(SHOTS, { recursive: true });
const srv = await serve(PORT);
const ctx = await launch({ viewport: VIEW, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rows: [] }) }));

const page = await ctx.newPage();
await page.addInitScript(seed);
await page.addInitScript(pinClock);
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(`${srv.base}?city=${CITY}&grade=4&term=s1&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.evaluate((cid) => window.__game._handleShareCity(cid, true), CITY);
await page.waitForFunction((cid) => (window.__game._currentStage() || {}).key === cid, CITY, { timeout: 30000 }).catch(() => {});
await page.waitForFunction(() => window.__assets && window.__assets.stats().pending === 0, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(600);
// 冻结主循环：测量期间只由脚本出帧。否则 rAF 每帧都在动相机（遮挡回拉 / 视角补偿），
// 采样点是按某一帧的相机算的屏幕坐标，相机一飘就量到别的像素上（前面几轮数字对不上就是这原因）
await page.evaluate(() => { window.__game._loop = () => {}; });
await page.evaluate(() => {
  // HUD/排行榜/暗角都是 DOM 叠层，会污染"过曝面积"和"上缘亮度"这两个指标
  for (const sel of ['#hud', '#leaderboard-widget', '#brand-badge', '#vignette', '#quest', '#daily',
    '#city-pill', '#prompt', '#toast', '#cheer', '#pet-fact', '#npc-bubble', '#intro', '#update-bar']) {
    document.querySelectorAll(sel).forEach((el) => el.classList.add('hidden'));
  }
  document.querySelectorAll('.overlay').forEach((el) => el.classList.add('hidden'));
});

const geo = await page.evaluate(() => {
  const st = window.__game._currentStage();
  return { r: st.r, cx: st.cx, cz: st.cz };
});
const hHalf = Math.tan((VFOV / 2) * Math.PI / 180) * (VIEW.width / VIEW.height);
const distOver = Math.round((geo.r * 1.18) / hHalf);
const views = [
  { id: 'over', dist: distOver, pitch: 0.9, at: { x: geo.cx, z: geo.cz + geo.r * 0.25 } },
  { id: 'near', dist: 12, pitch: 0.42, at: { x: geo.cx, z: geo.cz + geo.r * 0.1 } },
].filter((v) => !ONLY || v.id === ONLY);

const shot01 = async (cam, name) => {
  await drive(page, cam);
  const f = path.join(SHOTS, `${TAG}-${CITY}-${name}.png`);
  await page.screenshot({ path: f });
  return { file: f, img: decodePng(fs.readFileSync(f)) };
};

const out = { city: CITY, tag: TAG, view: VIEW, distOver, views: {} };
for (const v of views) {
  await drive(page, v);
  // 草地采样点：城内平地（色带 0）+ 轮廓内；数量要够（中位数才有意义）。
  // 近景看不到整城，就撒在镜头正前方的脚下（yaw=0 时相机在 +Z 看向 -Z）。
  const samples = await page.evaluate((viewId) => {
    const g = window.__game, st = g._currentStage();
    const b = g.world.cityBounds[st.key], F = b.terrainField;
    const vv = g._v3, out2 = [];
    const push = (x, z) => {
      if (out2.length >= 60) return;
      if (Math.hypot(x - st.cx, z - st.cz) < st.r * 0.28) return;      // 避开城心广场铺装
      if (F && !F.inPoly(x - st.cx, z - st.cz)) return;
      if (F && F.heightAtLocal(x - st.cx, z - st.cz) > 0.45) return;   // 只要平地（色带 0）
      const y = g._groundY(x, z);
      vv.set(x, y, z).project(g.camera);
      if (vv.z >= 1) return;
      out2.push({ x, z, ndcX: vv.x, ndcY: vv.y, ndcZ: vv.z, px: (vv.x * 0.5 + 0.5) * innerWidth, py: (-vv.y * 0.5 + 0.5) * innerHeight });
    };
    if (viewId === 'over') {
      for (let ri = 0; ri < 6; ri++) for (let k = 0; k < 24; k++) {
        const ring = 0.32 + ri * 0.11, a = (k / 24) * Math.PI * 2 + ri * 0.13;
        push(st.cx + Math.cos(a) * st.r * ring, st.cz + Math.sin(a) * st.r * ring);
      }
    } else {
      const pp = g.player.position;
      for (let dz = 3; dz <= 9; dz += 1.5) for (const dx of [0, -2.5, 2.5, -5, 5]) push(pp.x + dx, pp.z - dz);
      for (let dz = -3; dz >= -9; dz -= 2) for (const dx of [-3, 0, 3]) push(pp.x + dx, pp.z - dz);
    }
    return out2;
  }, v.id);

  const main = await shot01(v, v.id);
  const st = stats(main.img, samples);
  const passes = await page.evaluate(() => (window.__game.composer ? window.__game.composer.passes.map((p) => p.constructor.name) : null));
  // 开/关 composer 的同镜头对照：缺 OutputPass 时这两张图的颜色会不一样（低端机降级会突变）
  const off = await page.evaluate(() => { const g = window.__game; g._composerRef = g.composer; g.composer = null; });
  const noPost = await shot01(v, `${v.id}-nopost`);
  const npSt = stats(noPost.img, samples);
  await page.evaluate(() => { const g = window.__game; g.composer = g._composerRef; });

  let probe = null;
  if (PROBE) {
    probe = await page.evaluate(async ({ samples: ss, sw, sh }) => {
      const THREE = await import('three');                 // 页面里没有全局 THREE，借 importmap 动态取
      const g = window.__game, cam = g.camera, st2 = g._currentStage();
      const desc = (o) => {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        return {
          obj: o.name || o.type, sprite: !!o.isSprite, transparent: !!(m && m.transparent),
          color: m && m.color ? '#' + m.color.getHexString() : null,
          vcol: !!(m && m.vertexColors), map: !!(m && m.map), opacity: m ? +m.opacity.toFixed(2) : null,
        };
      };
      const rc = new THREE.Raycaster();
      // Raycaster 不看 visible：隐藏了的东西照样会被命中，之前就是被它误导的。
      // 这里自己沿父链判可见性，分两组报（全部命中 / 真正画在屏幕上的那个）。
      const visChain = (o) => { let c = o; while (c) { if (c.visible === false) return false; c = c.parent; } return true; };
      const pts = [];
      for (const s of ss.slice(0, 10)) {
        const x = Math.min(sw - 1, Math.max(0, Math.round(s.px)));
        const y = Math.min(sh - 1, Math.max(0, Math.round(s.py)));
        rc.setFromCamera(new THREE.Vector2((x + 0.5) / sw * 2 - 1, -((y + 0.5) / sh * 2 - 1)), cam);
        rc.far = 4000;
        const all = rc.intersectObjects(g.scene.children, true);
        const hits = all.slice(0, 4).map((h) => ({ d: +h.distance.toFixed(1), ...desc(h.object) }));
        const shown = all.filter((h) => visChain(h.object))[0];
        pts.push({ world: [+s.x.toFixed(1), +s.z.toFixed(1)], px: [x, y], hits, shown: shown ? { d: +shown.distance.toFixed(1), ...desc(shown.object) } : null });
      }
      // 地面顶点色实测：采样点换算成局部坐标后找最近网格顶点，直接读颜色分量。
      // 这一步把"顶点色本身太白"和"光照把它打爆"分开——两者都表现为白，修法完全不同。
      let ground = null;
      g.scene.traverse((o) => {
        if (ground || !o.isMesh || !o.material || !o.material.vertexColors || !o.geometry.attributes.color) return;
        if (o.geometry.attributes.position.count > 2000) ground = o;      // 地形网格是最大的一块顶点色几何
      });
      const vcol = [];
      if (ground) {
        const pos = ground.geometry.attributes.position, col = ground.geometry.attributes.color, n = pos.count;
        for (const s of ss.slice(0, 6)) {
          const lx = s.x - st2.cx, lz = s.z - st2.cz;
          let best = -1, bd = Infinity;
          for (let i = 0; i < n; i++) {
            const dx = pos.getX(i) - lx, dz = pos.getZ(i) - lz; const d = dx * dx + dz * dz;
            if (d < bd) { bd = d; best = i; }
          }
          vcol.push({ at: [+s.x.toFixed(1), +s.z.toFixed(1)], nearest: +Math.sqrt(bd).toFixed(2), y: +pos.getY(best).toFixed(2), color: [+col.getX(best).toFixed(3), +col.getY(best).toFixed(3), +col.getZ(best).toFixed(3)] });
        }
      }
      const dn = g.world.anim.dayNight;
      return {
        pts,
        groundProbe: ground ? { verts: ground.geometry.attributes.position.count, matColor: ground.material.color ? '#' + ground.material.color.getHexString() : null, flat: !!ground.material.flatShading, samples: vcol } : null,
        state: {
          hemi: +dn.hemi.intensity.toFixed(2), sun: +dn.sun.intensity.toFixed(2), sunPos: dn.sun.position.toArray().map((x) => +x.toFixed(1)),
          sunCoreVisible: dn.sunCore.visible, sunCoreOpacity: dn.sunCore.material.opacity, sunCoreScale: dn.sunCore.scale.x, sunHaloScale: dn.sunHalo.scale.x,
          fog: g.scene.fog ? { near: Math.round(g.scene.fog.near), far: Math.round(g.scene.fog.far), color: '#' + g.scene.fog.color.getHexString() } : null,
          env: !!g.scene.environment, envIntensity: g.scene.environmentIntensity,
          toneMapping: g.renderer.toneMapping, exposure: g.renderer.toneMappingExposure,
          bloom: g.bloom ? { strength: g.bloom.strength, radius: g.bloom.radius, threshold: g.bloom.threshold } : null,
          camDist: Math.round(g.camDist), cameraY: +cam.position.y.toFixed(1),
          sceneBackground: g.scene.background ? String(g.scene.background.constructor.name) : null,
          clearColor: '#' + g.renderer.getClearColor(new THREE.Color()).getHexString(),
          clearAlpha: g.renderer.getClearAlpha(),
          canvasBg: getComputedStyle(document.body).backgroundColor,
        },
      };
    }, { samples, sw: main.img.w, sh: main.img.h });

    // 消融一：把主光/环境光同时压低 4 倍再量同一批点。
    // 光照打爆 → 立刻恢复成有绿有饱和；顶点色本身太白 → 仍是灰白。
    // 必须临时停掉 _updateWeather（它每帧把 sun.intensity 拉回 2.1，不停掉消融会被它抵消）。
    const before = { sun: probe.state.sun, hemi: probe.state.hemi };
    await page.evaluate(() => {
      const g = window.__game, d = g.world.anim.dayNight;
      g._weatherRef = g._updateWeather; g._updateWeather = () => {};
      d.sun.intensity = 0.5; d.hemi.intensity = 0.3;
    });
    const dim = await shot01(v, `${v.id}-dim`);
    const dimSt = stats(dim.img, samples);
    probe.ablate = { sun: 0.5, hemi: 0.3, over: +dimSt.over.toFixed(4), grassLum: dimSt.grassLum == null ? null : +dimSt.grassLum.toFixed(3), grassSat: dimSt.grassSat == null ? null : +dimSt.grassSat.toFixed(3), samples: dimSt.samples.slice(0, 6).map((s) => ({ rgb: s.rgb, lum: +s.lum.toFixed(3), sat: +s.sat.toFixed(3) })) };
    await page.evaluate((b) => {
      const g = window.__game, d = g.world.anim.dayNight;
      d.sun.intensity = b.sun; d.hemi.intensity = b.hemi;
      if (g._weatherRef) { g._updateWeather = g._weatherRef; g._weatherRef = null; }
    }, before);

    // 消融二：隔离。只留地面 / 只留除地面以外的一切——白在前者变绿说明白是"画在地面之上的东西"。
    const iso = {};
    for (const mode of ['only', 'noground']) {
      const info = await page.evaluate((m) => {
        const g = window.__game;
        let ground = null;
        g.scene.traverse((o) => {
          if (ground || !o.isMesh || !o.material || !o.material.vertexColors || !o.geometry.attributes.color) return;
          if (o.geometry.attributes.position.count > 2000) ground = o;
        });
        g._visRef = [];
        g.scene.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints || o.isLine) g._visRef.push([o, o.visible]); });
        const hidden = [];
        if (ground) for (const [o] of g._visRef) {
          const want = m === 'only' ? (o === ground) : (o !== ground);
          if (o.visible !== want) hidden.push(o.name || o.type);
          o.visible = want;
        }
        return { found: !!ground, tracked: g._visRef.length, hidden: hidden.length, names: hidden.slice(0, 6) };
      }, mode);
      const s2 = await shot01(v, `${v.id}-${mode}`);
      const st2 = stats(s2.img, samples);
      iso[mode] = { ...info, over: +st2.over.toFixed(4), grassLum: st2.grassLum == null ? null : +st2.grassLum.toFixed(3), grassSat: st2.grassSat == null ? null : +st2.grassSat.toFixed(3), samples: st2.samples.slice(0, 6).map((s) => ({ rgb: s.rgb, lum: +s.lum.toFixed(3), sat: +s.sat.toFixed(3) })) };
      await page.evaluate(() => {
        const g = window.__game;
        for (const [o, vis] of g._visRef || []) o.visible = vis;
        g._visRef = null;
      });
    }
    probe.iso = iso;

    // 光照预算：只在"地面单显"状态下逐个关灯，看地面亮度到底是谁给的。
    // （消融调暗时地面几乎不变 → 说明主光/环境光不是它的主要光源，先把这条查清楚再调数值）
    await page.evaluate(() => {
      const g = window.__game;
      let ground = null;
      g.scene.traverse((o) => {
        if (ground || !o.isMesh || !o.material || !o.material.vertexColors || !o.geometry.attributes.color) return;
        if (o.geometry.attributes.position.count > 2000) ground = o;
      });
      g._visRef = [];
      g.scene.traverse((o) => { if (o.isMesh || o.isSprite || o.isPoints || o.isLine) g._visRef.push([o, o.visible]); });
      for (const [o] of g._visRef) o.visible = (o === ground);
    });
    const budget = {};
    // 真正的环境反射旋钮是**每个材质的 envMapIntensity**：three r160 还没有 scene.environmentIntensity
    // （那是 r163 才加的），旧代码里那行等于没写——RoomEnvironment 是"影棚灯阵"，全强度打下来
    // 足以把地面抬白、把绿压成灰绿，这就是"淡＋白"的第二个来源。
    const setLights = async (cfg) => {
      await page.evaluate((c) => {
        const g = window.__game, d = g.world.anim.dayNight;
        g._lightRef = g._lightRef || { sun: d.sun.intensity, hemi: d.hemi.intensity, env: g.scene.environment, envI: {} };
        d.sun.intensity = c.sun == null ? g._lightRef.sun : c.sun;
        d.hemi.intensity = c.hemi == null ? g._lightRef.hemi : c.hemi;
        g.scene.environment = c.env === false ? null : g._lightRef.env;
        if (c.mEnv != null) {
          g.scene.traverse((o) => {
            for (const m of (Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []))) {
              if (m.envMapIntensity === undefined) continue;
              if (g._lightRef.envI[m.uuid] === undefined) g._lightRef.envI[m.uuid] = m.envMapIntensity;
              m.envMapIntensity = c.mEnv;
            }
          });
        } else if (g._lightRef.envI) {
          g.scene.traverse((o) => {
            for (const m of (Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []))) {
              if (g._lightRef.envI[m.uuid] !== undefined) m.envMapIntensity = g._lightRef.envI[m.uuid];
            }
          });
        }
      }, cfg);
      const s = await shot01(v, `${v.id}-budget-${cfg.name}`);
      const st3 = stats(s.img, samples);
      budget[cfg.name] = { over: +st3.over.toFixed(4), lum: st3.grassLum == null ? null : +st3.grassLum.toFixed(3), sat: st3.grassSat == null ? null : +st3.grassSat.toFixed(3), rgb: st3.samples.slice(0, 3).map((x) => x.rgb) };
    };
    await setLights({ name: 'asis' });
    await setLights({ name: 'noSunHemi', sun: 0, hemi: 0 });
    await setLights({ name: 'noSunHemiNoEnv', sun: 0, hemi: 0, env: false });
    await setLights({ name: 'lightsNoEnv', env: false });
    await setLights({ name: 'mEnv0.05', mEnv: 0.05 });
    await setLights({ name: 'mEnv0.12', mEnv: 0.12 });
    await setLights({ name: 'mEnv0.25', mEnv: 0.25 });
    await setLights({ name: 'mEnv0.12sun1.6', mEnv: 0.12, sun: 1.6, hemi: 0.9 });
    probe.lightBudget = budget;
    await page.evaluate(() => {
      const g = window.__game, d = g.world.anim.dayNight, r = g._lightRef || {};
      d.sun.intensity = r.sun; d.hemi.intensity = r.hemi;
      g.scene.environment = r.env;
      for (const [uuid, val] of Object.entries(r.envI || {})) {
        g.scene.traverse((o) => {
          for (const m of (Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []))) {
            if (m.uuid === uuid) m.envMapIntensity = val;
          }
        });
      }
      g._lightRef = null;
      for (const [o, vis] of g._visRef || []) o.visible = vis;
      g._visRef = null;
    });
  }

  out.views[v.id] = {
    dist: v.dist, shot: path.relative(ROOT, main.file).split(path.sep).join('/'),
    passes, ndc: [st.px[0], st.px[1]],
    over: +st.over.toFixed(4), top: +st.top.toFixed(4),
    grassLum: st.grassLum == null ? null : +st.grassLum.toFixed(4),
    grassSat: st.grassSat == null ? null : +st.grassSat.toFixed(4),
    grassLumRange: st.grassLum25 == null ? null : [+st.grassLum25.toFixed(3), +st.grassLum75.toFixed(3)],
    sampleN: st.n,
    samples: st.samples.map((s) => ({ rgb: s.rgb, lum: +s.lum.toFixed(3), sat: +s.sat.toFixed(3) })),
    composerDiff: +(meanDiff(main.img, noPost.img) ?? NaN).toFixed(4),
    noPost: { over: +npSt.over.toFixed(4), top: +npSt.top.toFixed(4), grassLum: npSt.grassLum == null ? null : +npSt.grassLum.toFixed(3), grassSat: npSt.grassSat == null ? null : +npSt.grassSat.toFixed(3) },
    probe,
  };
}

const jsonPath = path.join(ROOT, `.cache/render-${TAG}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 1));

const basePath = path.join(ROOT, `.cache/render-before.json`);
const base = fs.existsSync(basePath) && TAG !== 'before' ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : null;
const f3 = (v) => (v == null ? '  n/a' : v.toFixed(3));
const fails = [];
console.log(`\n${CITY} 渲染体检（tag=${TAG}，视口 ${VIEW.width}x${VIEW.height}，俯瞰机位 ${distOver}）`);
for (const [id, v] of Object.entries(out.views)) {
  const b = base && base.views[id];
  console.log(`\n[${id}] 机位 ${v.dist}  过曝 ${f3(v.over)}  上缘亮度 ${f3(v.top)}  草地 亮度 ${f3(v.grassLum)} / 饱和 ${f3(v.grassSat)}  开闭后期差 ${f3(v.composerDiff)}`);
  if (b) console.log(`        基线      过曝 ${f3(b.over)}  上缘亮度 ${f3(b.top)}  草地 亮度 ${f3(b.grassLum)} / 饱和 ${f3(b.grassSat)}  开闭后期差 ${f3(b.composerDiff)}`);
  console.log(`        passes: ${v.passes ? v.passes.join(' → ') : '（跳过后期：触屏/低端机）'}`);
  if (v.noPost) console.log(`       关后期对照 过曝 ${f3(v.noPost.over)} 上缘亮度 ${f3(v.noPost.top)} 草地 亮度 ${f3(v.noPost.grassLum)} / 饱和 ${f3(v.noPost.grassSat)}`);
  if (v.samples.length) console.log(`        采样点 ${v.sampleN} 个（中位数判定），亮度四分位 ${v.grassLumRange ? v.grassLumRange.join('~') : 'n/a'}；样例 ` + v.samples.slice(0, 4).map((s) => `rgb(${s.rgb.join(',')}) L${s.lum} S${s.sat}`).join(' | '));
  if (v.probe) {
    console.log('        渲染状态: ' + JSON.stringify(v.probe.state));
    if (v.probe.groundProbe) {
      const gp = v.probe.groundProbe;
      console.log(`        地面网格 ${gp.verts} 顶点，材质底色 ${gp.matColor}，flatShading ${gp.flat}`);
      for (const s of gp.samples) console.log(`        顶点色@(${s.at.join(',')}) y=${s.y} 最近顶点 ${s.nearest} → rgb(${s.color.join(',')})`);
    }
    const a = v.probe.ablate;
    if (a) {
      console.log(`        消融调暗（sun ${a.sun}/hemi ${a.hemi}）: 草地亮度 ${a.grassLum} 饱和 ${a.grassSat} 过曝 ${a.over}`);
      console.log('          ' + a.samples.map((s) => `rgb(${s.rgb.join(',')}) L${s.lum} S${s.sat}`).join(' | '));
    }
    for (const [k, iso] of Object.entries(v.probe.iso || {})) {
      console.log(`        隔离[${k}] 找到地面 ${iso.found} / 跟踪 ${iso.tracked} / 改动 ${iso.hidden} 个（${iso.names.join(',')}）: 亮度 ${iso.grassLum} 饱和 ${iso.grassSat} 过曝 ${iso.over}`);
      console.log('          ' + iso.samples.map((s) => `rgb(${s.rgb.join(',')}) L${s.lum} S${s.sat}`).join(' | '));
    }
    for (const [k, b2] of Object.entries(v.probe.lightBudget || {})) {
      console.log(`        光照预算[${k}] 亮度 ${b2.lum} 饱和 ${b2.sat} 过曝 ${b2.over}  rgb ${b2.rgb.map((c) => '[' + c.join(',') + ']').join(' ')}`);
    }
    for (const p of v.probe.pts) {
      const fmt = (h) => `${h.obj}${h.sprite ? '(sprite)' : ''}@${h.d}${h.color ? ' ' + h.color : ''}${h.vcol ? ' vcol' : ''}${h.map ? ' map' : ''}${h.transparent ? ' α' + h.opacity : ''}`;
      console.log(`        点(${p.world.join(',')}) 实际画面=${p.shown ? fmt(p.shown) : '（没有可见几何 → 看到的是画布清屏/页面底色）'}  || 全部命中: ` + (p.hits.length ? p.hits.map(fmt).join(' > ') : '无'));
    }
  }
  if (!GATE) continue;
  const chk = (name, val, [lo, hi]) => { if (val != null && (val < lo || val > hi)) fails.push(`${id}.${name} = ${val} 不在 [${lo}, ${hi}]`); };
  chk('over', v.over, LIMIT.over);
  if (id === 'over') chk('top', v.top, LIMIT.top);
  chk('grassSat', v.grassSat, LIMIT.grassSat);
  chk('grassLum', v.grassLum, LIMIT.grassLum);
  if (v.composerDiff != null) chk('composerDiff', v.composerDiff, LIMIT.composerDiff);
  if (v.passes && !v.passes.includes('OutputPass')) fails.push(`${id}.passes 缺 OutputPass（后期链的色调映射/色域转换没做）`);
}
if (errors.length) fails.push(...errors.slice(0, 3).map((e) => '控制台错误: ' + e));

await ctx.close();
srv.stop();

console.log(`\n明细：${path.relative(ROOT, jsonPath).split(path.sep).join('/')}，截图目录 .cache/shots/render/`);
if (fails.length) {
  console.log(`✗ ${fails.length} 项不达标：\n  ` + fails.join('\n  '));
  process.exitCode = 1;
} else {
  console.log(GATE ? '✓ 渲染指标全部达标' : '（--no-gate：只看数字）');
}
