// 卡片缩略图 ↔ 游戏内近景 的对照（用户报"地图上的小人和选择的角色不一致"）
//
// 为什么需要它：内嵌浏览器面板在本机不可用，我读不了截图。这个脚本把**两条渲染路径**
// 的同一件东西归一化到同一尺寸后并排输出：
//   左 = 角色选择卡的缩略图（程序化模型 + 三点光）
//   右 = 游戏内近景（烘焙 GLB + 游戏光照 + 雾）
//
// 两个关键做法（否则结论无效）：
//   1) 主角掩膜用**射线在 3D 里算**，不用"隐藏主角前后差分"——差分会被背景里会动的东西
//      （云、水、词宠、接触阴影）污染，实测把"主体宽度"算成整幅 348px。
//   2) 两边都裁到主体包围盒再缩到同一尺寸 —— 卡片是 384×384 满幅、游戏内是斜俯视，
//      不归一化就没法逐格比。
//
//   node scripts/player-look.mjs [--gender boy] [--city chengdu]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';
import { readPng } from './img.mjs';
import { writePng, transform } from './png.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GENDER = optOf('--gender', 'boy');
const CITY = optOf('--city', 'chengdu');
const OUT = path.join(ROOT, '.cache/look/player');
fs.mkdirSync(OUT, { recursive: true });

const PORT = 6230 + Math.floor(Math.random() * 9);
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1280, height: 760 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript(([gender, city]) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '对照', registered: true, city, gender, wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, [GENDER, CITY]);
await page.goto(`${srv.base}?city=${CITY}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2000);

// ---- 1) 卡片缩略图（程序化模型 + 三点光） ----
const card = await page.evaluate(async (gender) => {
  const mod = await import(new URL('js/models.js', location.href).href);
  return mod.playerThumbnail(gender, {});
}, GENDER);
fs.writeFileSync(path.join(OUT, `card-${GENDER}.png`), Buffer.from(String(card).split(',')[1], 'base64'));

// ---- 2) 游戏内近景：摆好机位 + 射线算主角掩膜 ----
const shot = await page.evaluate(() => {
  const g = window.__game;
  const dn = g.world.anim.dayNight;
  if (dn) {   // 固定"白天"，与缩略图的光照环境可比
    dn.sun.intensity = 1.4; dn.hemi.intensity = 1.15;
    dn.sun.color.set(0xFFF2DC);
    dn.fog.color.set(0xCBE6F2);
    if (dn.dome) dn.dome.material.color.set(0xFFFFFF);
    g._updateDayNight = () => {};
  }
  [...document.querySelectorAll('.overlay')].forEach((o) => o.classList.add('hidden'));
  [...document.querySelectorAll('#quest,#npc-bubble,#loading')].forEach((o) => o.classList.add('hidden'));
  g.lockInput = false; g.cinematic = false;
  const st = g._currentStage();
  g.player.position.set(st.cx, 0, st.cz + st.r * 0.16);
  g.player.rotation.y = Math.PI;             // 背对镜头
  g.camYaw = 0; g.camPitch = 0.22; g.camDist = g.camDistTarget = 3.4;
  if (g._updateCamera) g._updateCamera(0.016);
  g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);

  // 裁框：以主角胸口投影为中心的正方形
  const THREE = window.THREE;
  const w = innerWidth, h = innerHeight;
  const proj = (y) => {
    const v = g.player.position.clone().add(new THREE.Vector3(0, y, 0)).project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  };
  const feet = proj(0), head = proj(0.95);
  const mid = proj(0.48);
  const ph = Math.abs(feet.y - head.y);                 // 主角在屏幕上的高度（像素）
  const side = Math.max(60, ph * 1.35);
  const cl = (v, hi) => Math.max(0, Math.min(hi, v));
  const box = {
    x0: cl(mid.x - side / 2, w) / w, y0: cl(mid.y - side / 2, h) / h,
    x1: cl(mid.x + side / 2, w) / w, y1: cl(mid.y + side / 2, h) / h,
  };
  const sidePx = Math.round(side);
  const ox = Math.round(mid.x - side / 2), oy = Math.round(mid.y - side / 2);

  // 射线掩膜：对裁框内每个像素（步进 2）投一条射线，打中主角=1
  const ray = new THREE.Raycaster();
  ray.far = 60;
  const S = Math.floor(sidePx / 2);
  const bits = new Uint8Array(S * S);
  const ndc = new THREE.Vector2();
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const px = ox + i * 2 + 1, py = oy + j * 2 + 1;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
      ray.setFromCamera(ndc, g.camera);
      bits[j * S + i] = ray.intersectObject(g.player, true).length ? 1 : 0;
    }
  }
  // 打包成 base64（省得传大数组）
  let bin = '';
  for (let k = 0; k < bits.length; k += 8192) bin += String.fromCharCode(...bits.subarray(k, k + 8192));
  return { box, ox, oy, sidePx, S, bits: btoa(bin), screenH: Math.round(ph) };
});
await page.waitForTimeout(700);
const raw = path.join(OUT, `ingame-${GENDER}-raw.png`);
await page.screenshot({ path: raw });

// ---- 3) 两边都归一化到 256×256（按主体包围盒取正方形 + 最近邻重采样）----
const MASK_PX = 256;
const bits = Buffer.from(shot.bits, 'base64');
// 掩膜坐标 ↔ 原图坐标：掩膜是裁框内 2px 步进的 S×S 网格，原点在 (ox, oy)
const maskAt = (ox, oy, x, y) => {
  const i = Math.floor((x - ox) / 2), j = Math.floor((y - oy) / 2);
  if (i < 0 || j < 0 || i >= shot.S || j >= shot.S) return false;
  return !!bits[j * shot.S + i];
};

// 归一化：maskFn 给出主体像素 → 求包围盒 → 取正方形（边长 = 长边 ×1.12 留边）→ 重采样
// 同时输出一张**掩膜 PNG**（白=角色）：后续分析（分带主色/轮廓宽度）必须只统计角色像素，
// 否则游戏内那张的黄色地面会把每一带都算成"黄"。
const normalize = (img, maskFn, dst, maskDst) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!maskFn(x, y)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error('掩膜是空的：' + dst);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const side = Math.max(bw, bh) * 1.12;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sx0 = cx - side / 2, sy0 = cy - side / 2;
  // 非主体像素填中灰（90,90,90）：透明背景不能被填成白色，否则会有一圈"白边框"，
  // 分类器把它当高光 W，逐格比时全是噪声。中灰 = 低饱和 → 归为 '.'（非主体）
  const buf = Buffer.alloc(MASK_PX * MASK_PX * 3, 90);
  const mbuf = Buffer.alloc(MASK_PX * MASK_PX * 3, 0);
  for (let y = 0; y < MASK_PX; y++) {
    for (let x = 0; x < MASK_PX; x++) {
      const sx = Math.round(sx0 + (x + 0.5) * side / MASK_PX);
      const sy = Math.round(sy0 + (y + 0.5) * side / MASK_PX);
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
      const s = (sy * img.w + sx) * 4, d = (y * MASK_PX + x) * 3;
      buf[d] = img.data[s]; buf[d + 1] = img.data[s + 1]; buf[d + 2] = img.data[s + 2];
      if (maskFn(sx, sy)) { mbuf[d] = 255; mbuf[d + 1] = 255; mbuf[d + 2] = 255; }
    }
  }
  writePng(dst, MASK_PX, MASK_PX, buf);
  writePng(maskDst, MASK_PX, MASK_PX, mbuf);
  return { bw, bh, side: Math.round(side) };
};

const gameImg = readPng(raw);
const cardImg = readPng(path.join(OUT, `card-${GENDER}.png`));
const a = normalize(gameImg, (x, y) => maskAt(shot.ox, shot.oy, x, y),
  path.join(OUT, `ingame-${GENDER}.png`), path.join(OUT, `ingame-${GENDER}-mask.png`));
// 卡片掩膜：alpha + 排除**接触阴影**（阴影是低饱和的暗灰，半透明；不排除的话它会被当成主体，
// 把包围盒往下拉长、比例全错 —— 实测卡片主体高 384px 占满整幅就是因为这个）
const b = normalize(cardImg, (x, y) => {
  const p = (y * cardImg.w + x) * 4;
  if (cardImg.data[p + 3] <= 40) return false;
  const r = cardImg.data[p], g = cardImg.data[p + 1], bl = cardImg.data[p + 2];
  const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * bl) / 255;
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  return !(lum < 0.45 && sat < 0.25);      // 低饱和的暗灰 = 阴影
}, path.join(OUT, `card-${GENDER}.png`), path.join(OUT, `card-${GENDER}-mask.png`));
fs.unlinkSync(raw);

console.log(`主角屏幕上高 ${shot.screenH}px；裁框 ${shot.sidePx}px（掩膜 ${shot.S}×${shot.S}）`);
console.log(`游戏内主体 ${a.bw}×${a.bh}（取方 ${a.side}px）→ 归一化 ${MASK_PX}×${MASK_PX}`);
console.log(`卡片主体   ${b.bw}×${b.bh}（取方 ${b.side}px）→ 归一化 ${MASK_PX}×${MASK_PX}`);
console.log(`→ .cache/look/player/{card,ingame}-${GENDER}.png（同为 ${MASK_PX}×${MASK_PX}，可直接比）`);
await ctx.close();
srv.stop();
