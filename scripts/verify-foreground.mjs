// 前景枝叶 + 边缘压暗校验。
//
// 三条硬约束（方案 §4.1）：① 中央 70% 画面必须干净 ② 四边遮挡总量 ≤8%
// ③ 触屏/低画质不建。都是"遮挡游戏内容"的风险，所以必须用**画面像素**验，不能只看几何。
//
//   node scripts/verify-foreground.mjs
import { serve, launch } from './browser.mjs';

const PORT = 6310 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 620 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rows: [] }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '前景校验', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

console.log('前景枝叶 + 边缘压暗');

/* ---------- 1) 结构与常量 ---------- */
const st = await page.evaluate(async () => {
  const F = await import(new URL('js/foreground.js', location.href).href);
  const g = window.__game;
  const fg = g._fg;
  if (!fg) return { missing: true };
  const cam = g.camera;
  const halfH = F.FOREGROUND_CONST.CAM_DIST * Math.tan((cam.fov * Math.PI / 180) / 2);
  const halfW = halfH * cam.aspect;
  const items = fg._sprites.map((m) => {
    const s = m.scale.x;
    // 面片旋转后在 x/y 上的轴向半跨度
    const st2 = s / 2 * (Math.abs(Math.cos(m.rotation.z)) + Math.abs(Math.sin(m.rotation.z)));
    return {
      sx: Math.abs(m.position.x), sy: Math.abs(m.position.y),
      size: +s.toFixed(3), span: +st2.toFixed(3),
      depthTest: m.material.depthTest, renderOrder: m.renderOrder, noPick: !!m.userData.noPick,
      // 屏幕矩形（NDC）与中央 70% 盒（±0.7）的关系：
      //   注意不能分别看 x/y 的"内伸"——「贴上边但水平居中」那片在 x 上本来就到画面中央，
      //   但在 y 上完全在画面外，分别看会误报 56%（第一版就是这么错的）。
      //   正确的判据是：矩形的 x 区间或 y 区间**至少有一个**完全落在外侧。
      mx: +((Math.abs(m.position.x) - st2) / halfW).toFixed(4),   // 内边缘的 NDC 坐标
      my: +((Math.abs(m.position.y) - st2) / halfH).toFixed(4),
      outside: (Math.abs(m.position.x) - st2) > 0.7 * halfW || (Math.abs(m.position.y) - st2) > 0.7 * halfH,
      slack: +Math.max((Math.abs(m.position.x) - st2) - 0.7 * halfW, (Math.abs(m.position.y) - st2) - 0.7 * halfH).toFixed(4),
    };
  });
  return {
    n: fg._sprites.length,
    groupVisible: fg.group.visible,
    inScene: !!g.scene.getObjectByName('frame-foliage'),
    items, halfH: +halfH.toFixed(3), halfW: +halfW.toFixed(3),
    consts: F.FOREGROUND_CONST,
  };
});
check(!st.missing, '前景枝叶已创建（桌面端）');
check(st.n === 8 && st.inScene, '8 片枝叶且已加入场景', `${st.n} 片`);
check(st.items.every((i) => i.depthTest === false && i.renderOrder >= 900), 'depthTest=false + renderOrder≥900（永远画在最上层，不穿模）');
check(st.items.every((i) => i.noPick), '不参与点击拾取（noPick）');
// 每片枝叶的屏幕矩形都必须完全在中央 70% 盒之外
const intruders = st.items.filter((i) => !i.outside);
const minSlack = Math.min(...st.items.map((i) => i.slack));
check(intruders.length === 0, '几何上不侵入中央 70%（屏幕矩形与中央盒无交集）',
  `最小余量 ${(minSlack * 100).toFixed(2)}% 画面`);

/* ---------- 2) 画面像素：中央 70% 干净 + 四边遮挡 ≤8% ---------- */
const pix = await page.evaluate(async () => {
  const g = window.__game;
  g._lowFx = true;
  const shoot = (on) => {
    for (const m of g._fg._sprites) m.visible = on;
    g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);
    const cv = document.querySelector('canvas');
    const gl = g.renderer.getContext();
    const w = cv.width, h = cv.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { w, h, px: Array.from(px) };
  };
  const on = shoot(true);
  const off = shoot(false);
  for (const m of g._fg._sprites) m.visible = true;
  const lum = (p, i) => (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
  const w = on.w, h = on.h;
  // readPixels 原点在左下；中央 70% = 两侧各留 15%
  let cIn = 0, cTot = 0, eHit = 0, eTot = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(lum(on.px, i) - lum(off.px, i));
      const cx = x / w, cy = y / h;
      const central = cx > 0.15 && cx < 0.85 && cy > 0.15 && cy < 0.85;
      if (central) { cTot++; if (d > 4 / 255) cIn++; }
      else { eTot++; if (d > 8 / 255) eHit++; }
    }
  }
  return {
    centralPct: +(cIn / cTot * 100).toFixed(3),
    edgePct: +(eHit / eTot * 100).toFixed(2),
    framePct: +(eHit / (w * h) * 100).toFixed(2),
    w, h,
  };
}, null);
check(pix.centralPct <= 0.5, '画面中央 70% 无前景遮挡（逐像素对照关闭前后）', `中央变化像素 ${pix.centralPct}%`);
check(pix.framePct <= 8, '四边遮挡总量 ≤8% 画面', `四边命中 ${pix.framePct}%（边缘带内 ${pix.edgePct}%）`);
check(pix.framePct > 0.5, '前景确实出现在画面里（不是全透明/没画出来）', `命中 ${pix.framePct}%`);

/* ---------- 3) 摆动幅度 ---------- */
const sway = await page.evaluate(async () => {
  const F = await import(new URL('js/foreground.js', location.href).href);
  const g = window.__game;
  const cam = g.camera;
  const halfH = F.FOREGROUND_CONST.CAM_DIST * Math.tan((cam.fov * Math.PI / 180) / 2);
  const pxPerUnit = (620 / 2) / halfH;                 // 视口半高像素 / 世界半高
  let maxY = 0, maxR = 0;
  let prevY = null, prevR = null;
  const baseY = g._fg.group.position.y, baseR = g._fg.group.rotation.z;
  for (let k = 0; k < 60; k++) {
    g._fg.update(cam, k * 0.35);
    maxY = Math.max(maxY, Math.abs(g._fg.group.position.y - (cam.position.y)));
    maxR = Math.max(maxR, Math.abs(g._fg.group.rotation.z));
    prevY = g._fg.group.position.y; prevR = g._fg.group.rotation.z;
  }
  g._fg.update(cam, 0);
  return { swayPx: +(maxY * pxPerUnit).toFixed(1), maxRot: +maxR.toFixed(4), halfH: +halfH.toFixed(3) };
});
check(sway.swayPx <= 6, '摆动幅度 ≤6px 等效（不干扰阅读）', `${sway.swayPx}px、旋转 ${sway.maxRot} rad`);

/* ---------- 4) 触屏/低画质不建 ---------- */
const touch = await page.evaluate(() => {
  const g = window.__game;
  const before = !!g._fg;
  g._fg = null;                    // 清掉已有的
  const grp = g.scene.getObjectByName('frame-foliage');
  if (grp) g.scene.remove(grp);
  g._lowEnd = true;
  g._updateForeground(1);
  const built = !!g._fg;
  g._lowEnd = false;
  return { before, built };
});
check(touch.before && !touch.built, '触屏/低画质：不建前景枝叶');

/* ---------- 5) 暗角确实加深了 ---------- */
const vig = await page.evaluate(() => {
  const g = window.__game;
  const p = g.composer && g.composer.passes.find((x) => x.uniforms && x.uniforms.uVig);
  return { uVig: p ? p.uniforms.uVig.value : null };
});
check(vig.uVig === 0.42, '暗角 uVig = 0.42（0.32 → 0.42）', String(vig.uVig));

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 前景枝叶 + 边缘压暗全部通过');
if (fails.length) process.exitCode = 1;
