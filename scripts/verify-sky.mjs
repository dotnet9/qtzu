// ⑩ 天空体积云 + 轻后处理的校验：
//   1) 云层：2 层球面片、BackSide、transparent、贴图平铺 repeat > 1
//   2) 云层在动：贴图 offset.x 随时间推进
//   3) 触屏关：_lowEnd 为真时整组隐藏
//   4) 画面里真的有云：隐藏云层前后，**天空区域**的像素标准差明显不同
//      （云 = 纹理 → 标准差变大；这是"肉眼能看到云"的数值代理）
//   5) 后处理：composer 链里有 ShaderPass（暗角+分级）且带 uVig/uGain 等 uniform
//   6) 暗角真的压暗了四角：同一帧对比中心区与角落的平均亮度
//   7) 暗角强度精确等于 0.42（原 scripts/verify-foreground.mjs 的断言搬来）
//   8) 场景里没有相机挂载的前景枝叶（那层 8 片剪影已整层删除，见 .plan/01M37BM34ZHFFXD2G5BJD66ZKC.md，防回归）
//   9) 0 页面异常
//
//   node scripts/verify-sky.mjs
import { serve, launch } from './browser.mjs';

const PORT = 6190 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rows: [] }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await page.addInitScript(() => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: '天空校验', registered: true, city: 'chengdu', gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

/* ---- 结构 + 漂移 ---- */
const r = await page.evaluate(async () => {
  const g = window.__game;
  g._lowFx = true;                       // 钉住帧率看门狗，保住后期链
  const out = {};
  const sc = (g.world.anim && g.world.anim.skyClouds) || [];
  out.layers = sc.length;
  out.info = sc.map((x) => ({
    back: x.mesh.material.side === 1,     // THREE.BackSide === 1
    transparent: x.mesh.material.transparent,
    repeatX: x.tex.repeat.x,
    wrap: x.tex.wrapS === 1000,           // THREE.RepeatWrapping
    op: x.mesh.material.opacity,
    visible: x.mesh.visible,
    r: Math.round(x.mesh.geometry.parameters.radius),
  }));
  // 漂移：等 0.5 秒看 offset.x 是否推进
  const before = sc.map((x) => x.tex.offset.x);
  await new Promise((res) => setTimeout(res, 500));
  out.drift = sc.map((x, i) => +(x.tex.offset.x - before[i]).toFixed(5));
  // 触屏关
  g._lowEnd = true; g._skyCloudOff = undefined;
  g._applySkyCloudLOD();
  out.hiddenOnTouch = sc.every((x) => x.mesh.visible === false);
  g._lowEnd = false; g._skyCloudOff = undefined;
  g._applySkyCloudLOD();
  out.shownOnDesktop = sc.every((x) => x.mesh.visible === true);
  // 后处理链
  out.passes = g.composer ? g.composer.passes.map((p) => p.constructor.name) : null;
  const vp = g.composer && g.composer.passes.find((p) => p.uniforms && p.uniforms.uVig);
  out.vig = vp ? { uVig: vp.uniforms.uVig.value, uGain: vp.uniforms.uGain.value, uSat: vp.uniforms.uSat.value } : null;
  // 前景枝叶（相机挂载的 8 片剪影）已整层删除：这里做防回归
  out.foliage = !!(g.scene.getObjectByName('frame-foliage') || g._fg);
  return out;
});

console.log('天空体积云 + 轻后处理');
check(r.layers === 2, '云层 2 层', `${r.layers} 层`);
check(r.info.every((x) => x.back && x.transparent), '云层是穹顶内侧半透明片（BackSide + transparent）');
check(r.info.every((x) => x.repeatX > 1 && x.wrap), '云贴图平铺且开启 RepeatWrapping', r.info.map((x) => `repeat×${x.repeatX}`).join(' '));
check(r.info[0].r !== r.info[1].r, '两层半径不同（视差）', r.info.map((x) => `r=${x.r}`).join(' '));
check(r.drift.every((d) => d > 0), '云层在漂移（offset.x 推进）', r.drift.join(' / '));
check(r.hiddenOnTouch, '触屏/低端：云层整组隐藏');
check(r.shownOnDesktop, '桌面：云层显示');
check(!!r.passes && r.passes.includes('ShaderPass'), '后期链含 ShaderPass（暗角+分级）', (r.passes || []).join(' → '));
check(!!r.vig && r.vig.uVig === 0.42, '暗角 uVig 精确 = 0.42（原 verify-foreground 的断言）', r.vig ? `uVig=${r.vig.uVig} uGain=${r.vig.uGain} uSat=${r.vig.uSat}` : 'null');
check(!r.foliage, '场景里没有相机挂载的前景枝叶（已整层删除，防回归）');

/* ---- 画面里真的有云 + 暗角真的压暗四角 ----
   ⚠ 渲染与 readPixels 必须在**同一个 evaluate** 里：renderer 没开 preserveDrawingBuffer，
   帧一旦提交，默认帧缓冲就被清了 —— 分两次调用读到的全是 0（曾据此得到"标准差 0 > 0"的假结论）。 */
const shotStats = (hide) => page.evaluate((h) => {
  const g = window.__game;
  g._lowFx = true;                                   // 钉住帧率看门狗，保住后期链
  for (const x of (g.world.anim.skyClouds || [])) x.mesh.visible = !h;
  g.lockInput = false; g.cinematic = false;
  // 抬头看天：镜头压低俯角、拉近，让天空占画面大半
  g.camDist = 34; g.camPitch = 0.62; g.camYaw = 0;
  if (g._updateCamera) g._updateCamera(0.016);
  g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);
  const cv = document.querySelector('canvas');
  const gl = g.renderer.getContext();
  const w = cv.width, ht = cv.height;
  const px = new Uint8Array(w * ht * 4);
  gl.readPixels(0, 0, w, ht, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const lum = (i) => (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
  // readPixels 原点在左下：天空 = 图上方 = y 大的部分
  const sky = [];
  for (let y = Math.floor(ht * 0.78); y < ht; y += 3) for (let x = 0; x < w; x += 3) sky.push(lum((y * w + x) * 4));
  const mean = sky.reduce((a, b) => a + b, 0) / Math.max(1, sky.length);
  const sd = Math.sqrt(sky.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, sky.length));
  const region = (x0, x1, y0, y1) => {
    let s = 0, n = 0;
    for (let y = Math.floor(ht * y0); y < ht * y1; y += 2) for (let x = Math.floor(w * x0); x < w * x1; x += 2) { s += lum((y * w + x) * 4); n++; }
    return s / Math.max(1, n);
  };
  return {
    skyMean: +mean.toFixed(4), skySd: +sd.toFixed(4),
    center: +region(0.4, 0.6, 0.4, 0.6).toFixed(4), corner: +region(0, 0.12, 0, 0.12).toFixed(4),
  };
}, hide);
const withClouds = await shotStats(false);
const noClouds = await shotStats(true);

check(withClouds.skySd > noClouds.skySd * 1.02, '天空区域纹理更丰富（云真的画进画面了）',
  `标准差 ${withClouds.skySd} > ${noClouds.skySd}`);
check(withClouds.corner < withClouds.center * 0.97, '暗角压暗了四角',
  `角落 ${withClouds.corner} < 中心 ${withClouds.center}`);
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 天空体积云 + 轻后处理全部通过');
if (fails.length) process.exitCode = 1;
