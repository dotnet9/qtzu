// 农场岛屿世界搭建：地形彩绘、河流、果园、风车田、谷仓、菜园、天空岛、阳光海滩、神秘森林、环形群岛
import * as THREE from 'three';
import { PROPS, badge, letterTexture } from './models.js';
import { ISLANDS } from './words.js';
import { buildUniGate, attachGateAsset } from './uni-gate-models.js';
import { clampPoly, simplifyPoly, polyOffsetRing } from './city-shape.js';
import { createCityTerrain } from './terrain.js';
import { brickNormal } from './textures.js';
import * as assets from './assets.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.rough ?? 0.9, metalness: 0,
  emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: !!o.alpha, opacity: o.alpha ?? 1, side: o.side ?? THREE.FrontSide,
});

// 城市院墙半径：CITY_FRAME 围墙管径（墙心在轮廓线上，向内也凸出 bw），
// 元素摆放/玩家碰撞都要留出这份厚度，否则视觉上穿墙
export const CITY_WALL_BW = r => Math.max(1.2, r * 0.035);

// 城市布局个性：按城市 key 派生确定性参数（旋转角/副地标风格/观景石台位/装饰随机流）。
// 同 key 每次重建结果一致；不同城市即便半径相同，地标朝向/石台位/绿化排布也各不相同。
// game.js 的天空蛋位（_cityPos sky 分支）必须用同一份 perchA/perchD——石台与蛋才能重合。
export function cityLayout(key) {
  let h = 5381;
  for (const ch of String(key || '')) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  const rn = () => { h = (Math.imul(h, 48271) + 11) % 2147483647; return h / 2147483647; };
  const baseA = rn() * Math.PI * 2;                                  // 城内布置整体初始角
  const style = ['ring', 'twin', 'line', 'cross'][Math.floor(rn() * 4)];   // 副地标摆法
  const perchA = baseA + 1.9 + rn() * 1.4;                           // 观景石台方向
  const perchD = 0.22 + rn() * 0.14;                                 // 石台半径系数（×r）
  // 数据级手作覆写（data/cities/layouts.json）：人工逐城定制，优先于程序化参数
  const o = CITY_LAYOUT_OVERRIDES[key];
  const lay = { ...{ baseA, style, perchA, perchD, rn: null }, ...(o || {}) };
  // rn 流与覆写无关：始终基于 key 的确定性序列
  lay.rn = rn;
  return lay;
}
// 手作布局表：cities.js 启动时从 data/cities/layouts.json 注入
let CITY_LAYOUT_OVERRIDES = {};
export function setCityLayouts(data) { CITY_LAYOUT_OVERRIDES = data || {}; }

// ---------- 卡通长城：青灰砖直墙 + 垛口 + 烽火台 ----------
// 墙体沿边界曲线挤出（替换旧圆管）：更薄（半厚 1.0 vs 旧管径 2.66）、有结构节奏。
// 全部只做装饰、不加碰撞体——玩家边界仍由 game 层的钳制公式统一裁定。

// 青灰砖纹：一张 128px 画布（四排错缝砖 + 深色顶带当墙帽），全城共享
let _brickTex = null;
function brickTexture() {
  if (_brickTex) return _brickTex;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#8C9C9F'; c.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 32 : 0;
    for (let col = 0; col < 2; col++) {
      c.fillStyle = (row + col) % 2 ? '#98A8A9' : '#8C9C9F';
      c.fillRect((col * 64 + off) % 128, row * 32 + 2, 60, 27);
    }
  }
  c.strokeStyle = 'rgba(84,98,100,.95)'; c.lineWidth = 3;
  for (let row = 0; row <= 4; row++) { c.beginPath(); c.moveTo(0, row * 32); c.lineTo(128, row * 32); c.stroke(); }
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 32 : 0;
    for (let k = 0; k < 2; k++) { const x = (k * 64 + off) % 128; c.beginPath(); c.moveTo(x, row * 32); c.lineTo(x, row * 32 + 32); c.stroke(); }
  }
  c.fillStyle = 'rgba(110,124,126,.85)'; c.fillRect(0, 123.5, 128, 4.5);   // 顶带：墙帽走色
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _brickTex = tex;
  return tex;
}

// 确定性 PRNG（同种子同序列）：城墙垛口/岩裙这类"看起来随机"的细节用它，
// 避免 Math.random 导致每次进城都不一样（视觉上像在抖）。
const wrngOf = (seed) => {
  let a = (seed | 0) || 1;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
const seedOfPoints = (list) => {
  let h = 2166136261;
  for (const q of list) h = Math.imul(h ^ Math.round(q[0] * 97 + q[1] * 131), 16777619);
  return h | 0;
};

// 沿闭合曲线挤出的墙体几何：外壁/内壁/顶面三幅独立顶点（法线分面更硬朗）
function buildWallGeometry(curve, H, THICK) {
  const len = curve.getLength();
  const N = Math.max(160, Math.min(1600, Math.round(len / 1.3)));
  const P = curve.getSpacedPoints(N);            // N+1 个点，闭合曲线首尾同点
  const arcs = [0];                              // 每个采样点的累计弧长
  for (let i = 1; i <= N; i++) arcs.push(arcs[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  const normals = [];
  for (let i = 0; i <= N; i++) {
    const pa = P[Math.max(0, i - 1)], pb = P[Math.min(N, i + 1)];
    let tx = pb.x - pa.x, tz = pb.z - pa.z;
    const tl = Math.hypot(tx, tz) || 1;
    normals.push([-tz / tl, tx / tl]);           // 左法线
  }
  const pos = [], uv = [], idx = [];
  const push = (x, y, z, u, v) => { pos.push(x, y, z); uv.push(u, v); };
  for (let i = 0; i <= N; i++) {                 // 外壁（一行底 + 一行顶）
    const p = P[i], [nx, nz] = normals[i], u = arcs[i] / 8;
    push(p.x + nx * THICK, 0, p.z + nz * THICK, u, 0);
    push(p.x + nx * THICK, H, p.z + nz * THICK, u, 1);
  }
  for (let i = 0; i <= N; i++) {                 // 内壁
    const p = P[i], [nx, nz] = normals[i], u = arcs[i] / 8;
    push(p.x - nx * THICK, 0, p.z - nz * THICK, u, 0);
    push(p.x - nx * THICK, H, p.z - nz * THICK, u, 1);
  }
  for (let i = 0; i <= N; i++) {                 // 顶面（贴到砖纹的墙帽色带）
    const p = P[i], [nx, nz] = normals[i], u = arcs[i] / 8;
    push(p.x + nx * THICK, H, p.z + nz * THICK, u, 0.97);
    push(p.x - nx * THICK, H, p.z - nz * THICK, u, 0.97);
  }
  const rowI = (N + 1) * 2, rowT = (N + 1) * 4;
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = a + 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);      // 外壁
    const c = rowI + i * 2, d = c + 2;
    idx.push(c, d, c + 1, d, d + 1, c + 1);      // 内壁
    const e = rowT + i * 2, f = e + 2;
    idx.push(e, f, e + 1, f, f + 1, e + 1);      // 顶面
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geo: g, samples: P, normals, arcs, len };
}

// 烽火台低模：底台 + 楼身 + 顶帽 + 四角垛口 + 瞭望窗 + 城市色小旗 + 火盆（点火点）
function buildBeaconTower(color) {
  const g = new THREE.Group();
  const grey = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  box(5.2, 2.6, 5.2, grey('#879899'), 0, 1.3, 0);            // 底台
  box(4.2, 2.3, 4.2, grey('#94A4A6'), 0, 3.75, 0);           // 楼身
  box(4.9, 0.8, 4.9, grey('#7C8D8F'), 0, 5.3, 0);            // 顶帽
  const tooth = grey('#A9B8B7');
  for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
    box(1.15, 1.05, 1.15, tooth, dx, 6.2, dz);               // 顶上四角垛口
  }
  box(1.3, 1.5, 0.3, grey('#49565A'), 0, 3.9, 2.1);          // 瞭望窗（朝城内那面）
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.6, 0.55, 8), grey('#5A4A3C'));
  bowl.position.set(0, 6.0, 0); g.add(bowl);                 // 火盆
  // 城市色小旗：每座城的烽火台有自己的颜色识别度
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 5), grey('#6B5A48'));
  pole.position.set(1.6, 7.2, 0); g.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.95),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );
  flag.position.set(2.4, 7.9, 0); g.add(flag);
  g.userData.bowlY = 6.3;                                    // 火苗锚点（本地高度）
  return g;
}

// 成都专属地面：山地/平原/河流/花田/竹海分区微缩贴图
function chengduTexture(S) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const grd = c.createLinearGradient(0, 0, S * 0.4, S);
  grd.addColorStop(0, '#5E9E5E'); grd.addColorStop(0.45, '#7FCB72'); grd.addColorStop(1, '#8FD88A');
  c.fillStyle = grd; c.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = ['#8FD88A', '#74C06E', '#93D98B'][i % 3];
    c.globalAlpha = 0.45;
    c.beginPath();
    c.ellipse(Math.random() * S, Math.random() * S, 5 + Math.random() * 16, 4 + Math.random() * 11, Math.random() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  c.fillStyle = '#4E8A4E';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(S * 0.44, 0); c.lineTo(S * 0.2, S * 0.3); c.lineTo(0, S * 0.4); c.closePath(); c.fill();
  for (const pt of [[S * 0.08, S * 0.1, S * 0.1], [S * 0.2, S * 0.05, S * 0.08], [S * 0.3, S * 0.13, S * 0.06]]) {
    c.fillStyle = '#5E9E6E';
    c.beginPath(); c.moveTo(pt[0] - pt[2], pt[1]); c.lineTo(pt[0], pt[1] - pt[2] * 1.4); c.lineTo(pt[0] + pt[2], pt[1]); c.closePath(); c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.moveTo(pt[0] - pt[2] * 0.4, pt[1] - pt[2] * 0.55); c.lineTo(pt[0], pt[1] - pt[2] * 1.4); c.lineTo(pt[0] + pt[2] * 0.4, pt[1] - pt[2] * 0.55); c.closePath(); c.fill();
  }
  c.lineCap = 'round';
  const river = (x1, y1, cx1, cy1, w) => {
    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = w * 1.5;
    c.beginPath(); c.moveTo(x1, y1); c.bezierCurveTo(cx1, cy1, S * 0.55, S * 0.5, S * 0.86, S * 0.88); c.stroke();
    c.strokeStyle = '#7EC4F2'; c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1); c.bezierCurveTo(cx1, cy1, S * 0.55, S * 0.5, S * 0.86, S * 0.88); c.stroke();
  };
  river(S * 0.06, S * 0.14, S * 0.3, S * 0.4, S * 0.024);
  river(S * 0.14, S * 0.06, S * 0.42, S * 0.3, S * 0.018);
  c.fillStyle = '#F5D95A';
  c.save(); c.translate(S * 0.72, S * 0.26); c.rotate(0.3); c.fillRect(-S * 0.09, -S * 0.05, S * 0.18, S * 0.1); c.restore();
  c.save(); c.translate(S * 0.2, S * 0.72); c.rotate(-0.2); c.fillRect(-S * 0.07, -S * 0.045, S * 0.14, S * 0.09); c.restore();
  c.fillStyle = '#5FA85A';
  c.beginPath(); c.ellipse(S * 0.7, S * 0.72, S * 0.11, S * 0.08, 0.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,250,235,.5)';
  c.beginPath(); c.arc(S / 2, S / 2, S * 0.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#F5F1E8';
  c.globalAlpha = 0.16;
  for (const d of [[-0.52, -0.4], [0.5, -0.45], [-0.45, 0.5], [0.52, 0.45]]) {
    c.beginPath(); c.ellipse(S / 2 + d[0] * S / 2, S / 2 + d[1] * S / 2, S * 0.14, S * 0.11, 0, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}
// 悬浮岛外装：岩裙侧壁 + 底部垂石 + 环岛云海 + 云上暗影。
// 原先是成都专属试点，现在全城通用——有地形高度场的城市悬起来才成立（"微缩盆景"的整体读感）。
// 云海 sprite 与暗影挂进 world.anim.floating，由 game.js 按镜头距离显隐：
// 52 座岛同屏时只让近处几座出云海，远处的岛不留白雾。
export function buildFloatingIsland(grp, ptsF, cx, cz, anim) {
  const xsF = ptsF.map(p => p[0]), zsF = ptsF.map(p => p[1]);
  const mnXF = Math.min(...xsF), mxxXF = Math.max(...xsF), mnZF = Math.min(...zsF), mxxZF = Math.max(...zsF);
  const ring = polyOffsetRing(ptsF, 0.7);
  const n = ring.length - 1;
  if (n < 3) return;
  let sx = 0, sz = 0;
  for (let i = 0; i < n; i++) { sx += ring[i][0]; sz += ring[i][1]; }
  sx /= n; sz /= n;
  const DEPTH = 9, TAPER = 0.5;
  const posArr = [], colArr = [], idxArr = [];
  const cTop = new THREE.Color('#8A6B4A'), cMid = new THREE.Color('#6B5138'), cBot = new THREE.Color('#3A2C1E');
  const tmpC = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[i + 1];
    const ax = sx + (a[0] - sx) * TAPER, az = sz + (a[1] - sz) * TAPER;
    const bx = sx + (b[0] - sx) * TAPER, bz = sz + (b[1] - sz) * TAPER;
    const base = posArr.length / 3;
    posArr.push(a[0], 0, a[1], b[0], 0, b[1], bx, -DEPTH, bz, ax, -DEPTH, az);
    for (let k = 0; k < 4; k++) {
      const t = k < 2 ? 0 : 1;
      tmpC.copy(cTop).lerp(cMid, t * 0.45).lerp(cBot, t);
      colArr.push(tmpC.r, tmpC.g, tmpC.b);
    }
    idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  skirtGeo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  skirtGeo.setIndex(idxArr);
  skirtGeo.computeVertexNormals();
  grp.add(new THREE.Mesh(skirtGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })));
  // 底部垂石：数量随城市大小走，小城不糊
  const spanR = Math.max(mxxXF - mnXF, mxxZF - mnZF) / 2;
  const nCone = spanR > 40 ? 6 : 4;
  for (let k = 0; k < nCone; k++) {
    const a = (k / nCone) * Math.PI * 2 + 0.4;
    const rr = spanR * (0.3 + 0.1 * (k % 3));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8 + 0.5 * (k % 2), 3.8 + 0.8 * (k % 3), 7),
      new THREE.MeshStandardMaterial({ color: '#5A4632', roughness: 1 }));
    cone.rotation.x = Math.PI;
    // 注意：grp 自己已经摆在 (cx, cz) 上（world.js:1609），这里的坐标必须全用**局部**值。
    // 旧写法在局部坐标上又加了一次 cx/cz，垂石与云海被摆到 2×(cx,cz) 的海面上（被地图纸挡住才一直没人发现）
    cone.position.set(Math.cos(a) * rr, -DEPTH - 0.9, Math.sin(a) * rr);
    grp.add(cone);
  }
  // 环岛云海（共享一张画布贴图：52 座岛各画一张太浪费）
  const cloudTex = sharedCloudTexture();
  const cloudR = spanR + 10;
  const clouds = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 8) * Math.PI * 2;
    const cs = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.92, depthWrite: false }));
    cs.scale.set(16, 8, 1);
    cs.position.set(Math.cos(a) * cloudR, -3.5 + 1.2 * (k % 3), Math.sin(a) * cloudR);   // 局部坐标（见上）
    grp.add(cs);
    clouds.push(cs);
  }
  // 云海上的投影暗影：悬浮感的画龙点睛
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2A3040', transparent: true, opacity: 0.16, depthWrite: false }));
  sh.scale.set((mxxXF - mnXF) * 0.62, 1, (mxxZF - mnZF) * 0.62);
  sh.position.set(0, -8.5, 0);   // 局部坐标（见上）
  grp.add(sh);
  if (anim) {
    anim.floating = anim.floating || [];
    anim.floating.push({ key: null, cx, cz, clouds, shadow: sh });
  }
}

let _cloudTex = null;
function sharedCloudTexture() {
  if (_cloudTex) return _cloudTex;
  const cc = document.createElement('canvas');
  cc.width = 256; cc.height = 128;
  const ccx = cc.getContext('2d');
  ccx.fillStyle = 'rgba(255,255,255,.92)';
  for (const pt of [[70, 80, 46], [128, 64, 56], [190, 84, 44], [100, 96, 38], [160, 100, 34]]) {
    ccx.beginPath(); ccx.arc(pt[0], pt[1], pt[2], 0, Math.PI * 2); ccx.fill();
  }
  _cloudTex = new THREE.CanvasTexture(cc);
  _cloudTex.colorSpace = THREE.SRGBColorSpace;
  return _cloudTex;
}

// 城市岛地面贴图：草底 + 城市色分区（路网已按需求移除，绿化走 3D 树草）
function cityIslandTexture(color, level, shape, isl) {
  if (isl && isl.key === 'chengdu') return chengduTexture(1024);
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const C = S / 2;
  // 草地底 + 深浅斑块
  c.fillStyle = '#7FCB72';
  c.fillRect(0, 0, S, S);
  for (let i = 0; i < 420; i++) {
    c.fillStyle = ['#8FD88A', '#74C06E', '#93D98B', '#7ACB70'][i % 4];
    c.globalAlpha = 0.5;
    c.beginPath();
    c.ellipse(Math.random() * S, Math.random() * S, 6 + Math.random() * 18, 4 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  // 城市主题色地块（四个方位的浅色广场区）
  c.fillStyle = color;
  c.globalAlpha = 0.16;
  for (const [dx, dz] of [[-0.52, -0.4], [0.5, -0.45], [-0.45, 0.5], [0.52, 0.45]]) {
    c.beginPath();
    c.ellipse(C + dx * S / 2, C + dz * S / 2, S * 0.16, S * 0.13, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

// 简易几何辅助（火车站等小构筑物用）
const box = (g, w, h, d, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
};
const cyl = (g, rt, rb, h, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
};
const cone = (g, r, h, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.001, r, h, seg), M(c));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
};
const sph = (g, r, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), M(c));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m;
};

// 岛屿半径（可玩范围）， 海从 52 以外开始
const ISLE_R = 52;

function place(scene, obj, x, z, ry = 0, y = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(obj);
  return obj;
}

// ---------- 彩绘地形：一块大画布画出各区域的地面 ----------
function islandTexture() {
  const S = 2048;                                  // 2 倍分辨率：路面、地块边缘放大后依然清晰
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const P = S / (ISLE_R * 2);                      // 世界坐标 → 画布像素
  const px = x => (x + ISLE_R) * P, pz = z => (z + ISLE_R) * P;
  const blob = (x, z, r, colors, n = 6) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle = colors[i % colors.length];
      c.globalAlpha = 0.35;
      c.beginPath();
      c.ellipse(px(x) + (Math.random() - 0.5) * r * P, pz(z) + (Math.random() - 0.5) * r * P,
        (0.3 + Math.random() * 0.5) * r * P, (0.25 + Math.random() * 0.4) * r * P, Math.random() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  };
  // 地图式小路：深色路缘描边 + 浅暖路面 + 中心白色虚线，轮廓干净不发虚
  const path = (pts, w = 1.4) => {
    const draw = () => {
      c.beginPath();
      pts.forEach(([x, z], i) => i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z)));
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(158,120,86,.85)';        // 路缘
    c.lineWidth = (w + 0.32) * P;
    draw(); c.stroke();
    c.strokeStyle = '#EBD3A9';                     // 路面
    c.lineWidth = w * P;
    draw(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)';        // 中心虚线
    c.lineWidth = 0.1 * P;
    c.setLineDash([0.75 * P, 0.6 * P]);
    draw(); c.stroke();
    c.setLineDash([]);
  };

  // 草地底色
  c.fillStyle = '#7FCB72';
  c.fillRect(0, 0, S, S);
  for (let i = 0; i < 1000; i++) {
    c.fillStyle = ['#8FD88A', '#74C06E', '#93D98B', '#7ACB70'][i % 4];
    c.globalAlpha = 0.5;
    c.beginPath();
    c.ellipse(Math.random() * S, Math.random() * S, 8 + Math.random() * 26, 5 + Math.random() * 18,
      Math.random() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  // 阳光果园（西北）：深一点的绿
  blob(-20, -18, 9, ['#6FBB68', '#67B262']);
  // 风车田（东北）：金色麦浪条纹（低对比 + 加宽：高频细条纹在远处会采样混叠出摩尔条纹）
  blob(21, -19, 9, ['#C9C16B', '#D4C470']);
  c.strokeStyle = 'rgba(214,199,128,.3)';
  c.lineWidth = 3.6 * P;
  for (let x = 10; x <= 32; x += 3.2) {
    c.beginPath(); c.moveTo(px(x), pz(-29)); c.lineTo(px(x + 1), pz(-8)); c.stroke();
  }
  // 谷仓前院（东南）：踩出来的土色
  blob(24, 19, 7, ['#D9C9A0', '#CBB88F']);
  // 魔法菜园（西）：一垄一垄的菜地
  c.strokeStyle = 'rgba(138,104,68,.55)';
  c.lineWidth = 1.1 * P;
  for (let z = 11; z <= 33; z += 2.2) {
    c.beginPath(); c.moveTo(px(-33), pz(z)); c.lineTo(px(-14), pz(z)); c.stroke();
  }
  // 神秘森林（极西）：深苔藓绿 + 落叶斑点
  blob(-45, 2, 8, ['#5E9E58', '#549252'], 16);
  for (let i = 0; i < 60; i++) {
    c.fillStyle = ['#4E8E4E', '#6FAF6A', '#8A6844'][i % 3];
    c.globalAlpha = 0.5;
    const a = Math.random() * Math.PI * 2, r = Math.random() * 7;
    c.beginPath();
    c.ellipse(px(-45 + Math.cos(a) * r), pz(3 + Math.sin(a) * r) , 3 + Math.random() * 5, 2 + Math.random() * 3, Math.random() * 3, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
  // 阳光海滩（正南）：一大片沙子 + 浪打湿的深沙边
  c.fillStyle = '#EFDCA8';
  c.beginPath();
  c.moveTo(px(-40), pz(35.5));
  for (let x = -40; x <= 40; x += 4) c.quadraticCurveTo(px(x + 2), pz(34.6 + Math.sin(x) * 0.9), px(x + 4), pz(35.5));
  c.lineTo(px(50), pz(55)); c.lineTo(px(-50), pz(55));
  c.closePath(); c.fill();
  blob(0, 40, 8, ['#E8D49C', '#F4E2B4'], 10);
  // 湿沙：沿着岛边缘一圈深色
  c.strokeStyle = 'rgba(196,172,120,.8)';
  c.lineWidth = 1.6 * P;
  c.beginPath();
  c.arc(px(0), pz(0), 50.6 * P, Math.PI * 0.32, Math.PI * 0.68);
  c.stroke();
  // 河两岸的浅滩沙
  blob(-24, 5.2, 3, ['#E3D0A0'], 8);
  blob(24, -5.2, 3, ['#E3D0A0'], 8);
  blob(0, 5.2, 3, ['#E3D0A0'], 6);
  blob(0, -5.2, 3, ['#E3D0A0'], 6);

  // 小路：码头 → 出生点 → 各区域
  path([[0, 4.6], [0, 12], [0, 20]]);
  path([[0, 20], [13, 20], [22.5, 19.6]]);            // 去谷仓
  path([[0, 20], [-12, 19], [-22, 20.5]]);            // 去菜园
  path([[0, 20], [0, 30], [0, 36.8]]);                // 去海滩沙墙
  path([[0, 14], [-14, 12], [-26, 11], [-36.5, 11]]); // 去森林荆棘
  path([[0, -4.6], [-8, -6], [-16, -6]]);             // 过河往果园

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  // 远景摩尔条纹的解法：mipmap（缩小采样用低级 mip）+ 各向异性过滤。
  // anisotropy 的具体上限由 game.js 在拿到渲染器后按显卡能力收口（写 16 超上限会被驱动忽略，条纹就会回来）
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  return tex;
}

function groundTexture() { return islandTexture(); }

function petalTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#FFC9DD';
  c.beginPath();
  c.ellipse(32, 32, 20, 13, 0.6, 0, Math.PI * 2);
  c.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(inner = 'rgba(255,244,214,1)', outer = 'rgba(255,244,214,0)') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const grad = c.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  c.fillStyle = grad;
  c.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 低模高楼：楼层线 + 四角柱 + 檐口 + 楼顶机房 + 首层门洞。
// 关键是"凸出"——原先的窗带比塔身窄（w*0.86），塞在里面根本看不见，所以塔楼就是纯方盒。
// 材质按颜色缓存：world.js 的 box() 每次 new 一个材质，一栋楼十几个零件会白吃十几份材质。
const _towerMat = new Map();
const towerMat = (c) => { if (!_towerMat.has(c)) _towerMat.set(c, M(c)); return _towerMat.get(c); };
const towerBox = (g, w, h, d, c, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), towerMat(c));
  m.position.set(x, y, z); g.add(m); return m;
};
function cityTower(w, h, i) {
  const g = new THREE.Group();
  const body = ['#D8E3EC', '#E8DFD2', '#CFE0D8', '#E3D3C2'][i % 4];
  const trim = '#B9C8D4';
  towerBox(g, w, h, w, body, 0, h / 2, 0);
  // 楼层线：比塔身略宽 2%，凸出来才看得见（每 2.8 一层，太高太密会糊成条纹）
  for (let fy = 2.6; fy < h - 1.4; fy += 2.8) towerBox(g, w * 1.02, 0.22, w * 1.02, trim, 0, fy, 0);
  // 四角柱：给出清晰的竖向轮廓（参考图里楼的边是"立"着的）
  const cx = w / 2 - 0.22;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) towerBox(g, 0.5, h, 0.5, trim, sx * cx, h / 2, sz * cx);
  // 檐口 + 楼顶机房（剪影有起伏，不是一根光柱）
  towerBox(g, w * 1.1, 0.55, w * 1.1, trim, 0, h + 0.2, 0);
  towerBox(g, w * 0.46, 1.3, w * 0.46, body, 0, h + 1.05, 0);
  towerBox(g, w * 0.5, 0.28, w * 0.5, trim, 0, h + 1.8, 0);
  // 首层：压深一档的基座 + 门洞（正对 +z 的那面）
  towerBox(g, w * 1.03, 1.7, w * 1.03, '#A9B6C2', 0, 0.85, 0);
  towerBox(g, w * 0.34, 1.25, 0.24, '#6E7C88', 0, 0.63, w * 0.52);
  return g;
}

export function buildWorld(scene, semIslands = ISLANDS, opts = {}) {
  // decor/blockers：绿化与地标等"不参与碰撞、却会把蛋整个罩住"的装饰登记表，
  // 供 game 层摆放蛋与打卡点牌时避让（见 game._blockedAt）。
  const world = { colliders: [], anim: {}, gates: {}, platforms: [], decor: [] };
  const focus = opts.focus ?? -1;   // 只精建 focus±1 的城市，其余轻量占位（大地图性能保护）
  const C = world.colliders;
  // 可站立物件：给碰撞体一个"台面高度"，跳得够高就能落上去站着（站得高看得远）
  const colTop = (x, z, r, top, bottom = 0, bounce = false) => {
    C.push({ t: 'c', x, z, r, top, bottom });
    world.platforms.push({ x, z, r, top, bounce });
  };
  // 纯平台（不挡路）：云朵这类悬空软物件，跳穿它落在上面反而更好玩
  const addPlatform = (x, z, r, top) => world.platforms.push({ x, z, r, top });
  const colC = (x, z, r, top) => C.push(top ? { t: 'c', x, z, r, top } : { t: 'c', x, z, r });
  const colR = (x1, z1, x2, z2, top) => C.push(top ? { t: 'r', x1, z1, x2, z2, top } : { t: 'r', x1, z1, x2, z2 });

  // ---- 天空穹顶（渐变 + 更晴朗的蓝） ----
  const skyCv = document.createElement('canvas');
  skyCv.width = 2; skyCv.height = 256;
  {
    const c = skyCv.getContext('2d');
    const grad = c.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3E97E8');
    grad.addColorStop(0.42, '#7EC8F5');
    grad.addColorStop(0.62, '#BDE9FF');
    // 地平线附近压深一档：原来的 #FDF3D8 / #FFE3EC 亮度 0.95+，正好越过辉光门槛（0.92），
    // 整条地平线会泛光 → check-render 的 composerDiff（开/关后期亮度差）直接 0.20 超标。
    // 压到 0.90 以下既保住暖调，又让辉光只留给真正的发光物（蛋/词宠/灯）。
    grad.addColorStop(0.82, '#EFE0BE');
    grad.addColorStop(1, '#EDD9E0');
    c.fillStyle = grad;
    c.fillRect(0, 0, 2, 256);
  }
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  // 半径必须大于相机最远缩放（550），否则镜头飞出穹顶后 BackSide 球面从外面不可见 → 天空变成纯色背景
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(dome);
  const cityOnly0 = !!semIslands.length && semIslands[0].level != null;
  // 两种模式的雾色都调成"大气"而不是"白纸"：近白雾色（0xDFF3EC）在成都尺度上会把城对面整片洗白
  scene.fog = cityOnly0 ? new THREE.Fog(0xCBE6F2, 90, 420) : new THREE.Fog(0xDFF3EC, 42, 150);

  // ---- 太阳（亮核 + 光晕） ----
  const sunDir = new THREE.Vector3(18, 30, 12).normalize();
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,252,238,1)', 'rgba(255,240,190,0)'), fog: false,
    depthWrite: false, transparent: true,
  }));
  sunCore.position.copy(sunDir).multiplyScalar(118);
  // 尺寸与轨道只是初值：进游戏后由 js/game.js 的 _updateDayNight 按当前城半径重设
  // （成都是半径 86 的大图，写死 26/64 的 sprite 正好悬在地图上方 = 一团白光罩住半张图）
  sunCore.scale.setScalar(26);
  scene.add(sunCore);
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,236,170,.55)', 'rgba(255,236,170,0)'), fog: false,
    depthWrite: false, transparent: true,
  }));
  sunHalo.position.copy(sunDir).multiplyScalar(116);
  sunHalo.scale.setScalar(64);
  scene.add(sunHalo);
  // 月亮（夜晚替换太阳出场）
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: letterTexture('🌙', '#DCE8FF', '#FFFDF4'), fog: false,
    depthWrite: false, transparent: true,
  }));
  moon.scale.setScalar(18);
  moon.position.set(-90, 60, -40);
  moon.visible = false;
  scene.add(moon);

  // ---- 光照 ----
  // 基调（起点值，靠 scripts/check-render.mjs 的截图指标收敛）：主光压低 + 环境补亮 = 低对比柔光。
  // 原来的 hemi 1.05 + sun 2.1 会把浅色马卡龙表面（草地/奶油墙/纸面）推过曝，整体发白。
  const hemi = new THREE.HemisphereLight(0xFFF6E8, 0x9CC98F, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFF2DC, 1.35);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  // 阴影框跟着玩家走（js/game.js 的 _updateShadowFollow 每帧挪 sun.target 与 sun.position）：
  // 原来固定 ±60，而成都舞台半径 87，城的外圈**一点投影都没有**；框小了 texel 密度才够，
  // 接触影才"坐得住"（2048 铺满 120×120 时约 17 texel/单位，铺 52×52 是 79 texel/单位）。
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = cityOnly0 ? 460 : 160;   // 跟随后天光距离随玩家走，远平面要留够
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 3;          // 框小了：不必再靠 radius 糊（6 会把接触影糊没）
  scene.add(sun);
  scene.add(sun.target);          // 跟随要改 target.position；不进场景的话它的世界矩阵不更新
  // 昼夜循环：game 层每帧按真实时间移动日月、调光照与雾色
  // sunDir：太阳的"方向"（单位向量）。跟随逻辑按 dir 把光源放到玩家上方，保证光照方向不变
  world.anim.dayNight = { sunCore, sunHalo, moon, sun, hemi, dome, fog: scene.fog, sunDir: sunDir.clone() };
  // 夜晚全岛萤火虫（白天 opacity 0 隐藏）
  {
    const n = 50;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 44;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.6 + Math.random() * 2.4;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const fire = new THREE.Points(geo, new THREE.PointsMaterial({
      map: glowTexture('rgba(190,255,220,1)', 'rgba(140,255,190,0)'),
      color: 0xAFFFD0, size: 0.4, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(fire);
    world.anim.nightFire = fire;
  }

  // ---- 大海（全岛外圈 + 群岛） ----
  const seaMat = M('#4A9ED9', { rough: 0.32 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), seaMat);
  sea.position.y = -0.5;   // 压到全国地图底图之下：城市巡游时外围显示的是地图纸面，不是海
  scene.add(sea);
  world.anim.sea = sea;
  // 岛边的白色浪花圈
  const surf = new THREE.Mesh(new THREE.RingGeometry(49.4, ISLE_R + 0.8, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.45, depthWrite: false }));
  surf.position.y = 0.03;
  scene.add(surf);
  world.anim.surf = surf;

  // ---- 云影：几团大暗斑贴地缓慢漂移，世界有"云过"的呼吸感 ----
  const clouds = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(7 + i * 3.5, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x274D27, transparent: true, opacity: 0.08, depthWrite: false }));
    c.position.set(-60 + i * 45, 0.32, (i - 1) * 22);
    scene.add(c);
    clouds.push(c);
  }
  world.anim.clouds = clouds;

  // 纯城市链条模式：巡游岛屿带 level 配置（来自城市 JSON）——跳过农场几何，世界=大海+城市群岛
  const cityOnly = !!semIslands.length && semIslands[0].level != null;
  if (!cityOnly) {
  // ---- 岛屿地面（彩绘） ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(ISLE_R, 72).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
  // 远处海面上的青色小岛剪影
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8 + 0.4;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(14 + (i % 3) * 6, 16, 12),
      M(i % 2 ? '#6FAF8E' : '#7FBf98'));
    hill.position.set(Math.cos(a) * 84, -6, Math.sin(a) * 84);
    hill.scale.y = 0.62;
    scene.add(hill);
  }

  // ---- 河流 ----
  const waterGeo = new THREE.PlaneGeometry(104, 7, 60, 4).rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, M('#6FC7E8', { rough: 0.25, alpha: 0.9 }));
  water.position.y = 0.04;
  scene.add(water);
  world.anim.water = water;
  // 两岸白色浪线
  world.anim.foam = [];
  for (const bank of [1, -1]) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(104, 0.26).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.55, depthWrite: false }));
    foam.position.set(0, 0.105, bank * 3.72);
    scene.add(foam);
    world.anim.foam.push(foam);
  }
  // 河里的荷叶
  for (const [x, z] of [[-15, 0.6], [-7, -1.1], [18, 0.9], [27, -0.8]]) place(scene, PROPS.lilyPad(), x, z, Math.random() * 3, 0.06).traverse(o => { if (o.isMesh) o.castShadow = false; });

  // ---- 码头（boat 过河点） ----
  place(scene, PROPS.dock(), 0, 0);
  for (const z of [5.8, -5.8]) place(scene, PROPS.flowerpatch(), (Math.random() - 0.5) * 6, z * 0.9 + Math.sign(z) * 1.5);

  // ---- 栅栏（河岸两侧，留码头缺口）：矮栏杆跳得过去，掉进河堤小条带也能再跳回来 ----
  // 面板必须转 90° 顺着岸线排：不转的话一块块立着像缺口，看着能钻过去其实撞墙
  for (const bank of [1, -1]) {
    for (let x = -34; x <= 34; x += 2.1) {
      if (x > -4.5 && x < 4.5) continue;
      place(scene, PROPS.fence(), x, bank * 6.2, Math.PI / 2);
    }
    colR(-35, bank * 6.2 - 0.3, -4.5, bank * 6.2 + 0.3, 0.8);
    colR(4.5, bank * 6.2 - 0.3, 35, bank * 6.2 + 0.3, 0.8);
  }

  // ---- 树木点缀（草甸 & 果园） ----
  const treeSpots = [
    [-24, 8, 0], [22, 8, 1], [-28, 14, 0], [30, 26, 1], [-34, 2, 0], [34, 4, 0],
    [-20, -16, 0], [-26, -12, 1], [-12, -18, 0], [-30, -22, 0], [-16, -26, 1], [-24, -24, 0],
    [-34, -10, 0], [-8, -24, 0],
  ];
  for (const [x, z, bl] of treeSpots) {
    place(scene, PROPS.tree(!!bl), x, z, Math.random() * 3);
    colC(x, z, 0.6);
  }
  // 果园地标：大树下的鸟窝（两颗小小的蛋）
  place(scene, PROPS.nest(), -23.4, 9.0, Math.random() * 3);
  // 果园里散落的小苹果
  for (let i = 0; i < 6; i++) {
    const x = -30 + Math.random() * 22, z = -26 + Math.random() * 14;
    const ap = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), M('#FF6B6B'));
    s.position.y = 0.14; s.castShadow = true; ap.add(s);
    place(scene, ap, x, z);
  }

  // ---- 风车田（含干草垛大门 + 树篱围栏） ----
  for (let x = 8; x <= 34; x += 2.05) {
    if (x > 11.5 && x < 14.5) continue; // 大门缺口
    place(scene, PROPS.hedge(), x, -9);
    colR(x - 1, -9.65, x + 1, -8.35);
  }
  for (let z = -30; z <= -9; z += 2.05) {
    place(scene, PROPS.hedge(), 8, z);
    colR(7.35, z - 1, 8.65, z + 1);
  }
  const hay = place(scene, PROPS.haybale(), 13, -9);
  colC(13, -9, 1.7);
  world.gates.hay = { group: hay, colIndex: C.length - 1 };
  const windmill = place(scene, PROPS.windmill(), 27, -18, 0.4);
  world.anim.windmill = windmill.userData.blades;
  colC(27, -18, 2.0);
  // 风车下的乘凉凉影
  {
    const shade = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2E5230, transparent: true, opacity: 0.1, depthWrite: false }));
    shade.position.set(27, 0.34, -18);
    scene.add(shade);
  }
  // 风车田地标：小干草垛（跳上去站站看）
  place(scene, PROPS.haybale(0.6), 18, -20, Math.random() * 3);
  colTop(18, -20, 0.85, 0.95);
  // 谷仓前院地标：干草垛兄弟俩
  place(scene, PROPS.haybale(0.7), 29.5, 27.5, Math.random() * 3);
  colTop(29.5, 27.5, 0.95, 1.1);
  place(scene, PROPS.haybale(0.5), 30.9, 28.7, Math.random() * 3);
  colTop(30.9, 28.7, 0.7, 0.8);

  // ---- 谷仓（黑黑的里面） ----
  const barn = place(scene, PROPS.barn(), 24, 22, Math.PI); // 门朝北（面向草甸）
  world.gates.darkness = barn.getObjectByName('darkness');
  world.anim.barn = barn;
  world.anim.barnDoors = ['doorL', 'doorR'].map(n => barn.getObjectByName(n)).filter(Boolean);
  colR(20.9, 19.3, 22.9, 19.7); colR(25.1, 19.3, 27.1, 19.7);
  colR(20.9, 24.3, 27.1, 24.7);
  colR(20.9, 19.3, 21.3, 24.7); colR(26.7, 19.3, 27.1, 24.7);
  const barnLight = new THREE.PointLight(0xFFDFA8, 0, 12, 1.6);
  barnLight.position.set(24, 2.4, 22);
  scene.add(barnLight);
  world.gates.barnLight = barnLight;

  // ---- 南瓜地（light 蛋旁边） ----
  for (const [x, z, s] of [[7.5, 30.5, 1.2], [10.5, 32.5, 1], [6.5, 33, 0.8]]) {
    const p = PROPS.pumpkin();
    p.scale.setScalar(s);
    place(scene, p, x, z);
    colTop(x, z, 0.45 * s, 0.55 * s);
  }

  // ---- 魔法菜园（seed+rain 长豆藤） ----
  for (const [x, z] of [[-22, 20], [-22, 23.5]]) place(scene, PROPS.soil(), x, z);
  colR(-23, 19.3, -21, 21); colR(-23, 22.8, -21, 25.2);
  const beanstalk = PROPS.beanstalk();
  beanstalk.position.set(-22, 0, 27);
  beanstalk.scale.set(1, 0.001, 1);
  beanstalk.visible = false;
  scene.add(beanstalk);
  world.gates.beanstalk = beanstalk;

  // ---- 天空岛 ----
  const isle = new THREE.Group();
  const isleTop = new THREE.Mesh(new THREE.CylinderGeometry(6, 5.2, 0.8, 20), M('#7FCB72'));
  isleTop.position.y = -0.4;
  const isleBottom = new THREE.Mesh(new THREE.ConeGeometry(5.2, 5, 20), M('#A8825B'));
  isleBottom.rotation.x = Math.PI;
  isleBottom.position.y = -3.2;
  isle.add(isleTop, isleBottom);
  const isleTree = PROPS.tree(true);
  isleTree.position.set(3, 0, -3);
  isleTree.scale.setScalar(0.8);
  isle.add(isleTree);
  isle.position.set(-22, 14, 27);
  isle.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });   // 不投影子：否则菜园一整片被大黑斑盖住
  scene.add(isle);
  world.gates.skyIsle = isle;
  // ---- 悬浮砖块（超级马里奥式）：跳起来用头顶爆，藏在里面的词宠蛋会掉下来 ----
  world.brickSpots = [
    { x: 3, z: 18, top: 2.6 },
    { x: -12, z: -12, top: 2.9 },
    { x: 20, z: -16, top: 3.1 },
  ];
  for (const b of world.brickSpots) {
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 0.68), M('#E8B04B', { rough: 0.7 }));
    brick.position.set(b.x, b.top - 0.31, b.z);
    brick.castShadow = true;
    scene.add(brick);
    b.mesh = brick;
    b.bottom = b.top - 0.62;
    const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('？', '#7A4A12', '#FFF2D0'), transparent: true, depthWrite: false }));
    q.position.set(b.x, b.top + 0.08, b.z);
    q.scale.setScalar(0.4);
    scene.add(q);
    b.q = q;
    addPlatform(b.x, b.z, 0.55, b.top);   // 站到砖块顶上也行
  }
  // 天空岛顶面本身也是可站平台：沿云朵阶梯跳上来后就能直接落在岛上
  colTop(-22, 27, 6, 14, 13);   // bottom=13：岛底下走路自由通过
  // ---- 云朵阶梯：菜园南侧外圈 9 朵矮云，每跳 1.3 米单跳可达，一路跳到岛沿 ----
  // 云是纯平台不设碰撞：跳穿了就落上去，地面上从云底下走也不撞隐形墙；
  // 阶梯绕开岛的正下方（在岛底下起跳永远够不到岛面）
  {
    const stair = [
      [-16.4, 19.6, 1.3],
      [-14.9, 21.3, 2.6],
      [-14.0, 23.3, 3.9],
      [-13.7, 25.5, 5.2],
      [-14.0, 27.8, 6.5],
      [-14.8, 30.0, 7.8],
      [-16.2, 31.8, 9.1],
      [-18.0, 33.1, 10.4],
      [-21.3, 33.4, 12.4],
    ];
    world.anim.cloudStair = [];
    for (const [x, z, top] of stair) {
      const c = PROPS.cloud(1.15);
      c.position.set(x, top - 0.6, z);
      c.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.8; } });
      scene.add(c);
      addPlatform(x, z, 1.35, top);
      const pf = world.platforms[world.platforms.length - 1];
      pf.baseTop = top;
      pf.bob = { amp: 0.14, speed: 1.05, phase: Math.random() * Math.PI * 2 };
      world.anim.cloudStair.push({ mesh: c, pf, baseY: top - 0.6 });
    }
  }

  // ---- 村庄小广场：许愿井 + 任务板 + 向日葵 + 稻草人 + 风车花 ----
  const well = place(scene, PROPS.well(), 4.6, 19.5, -0.5);
  colTop(4.6, 19.5, 0.85, 1.0);
  world.gates.well = well;
  const board = place(scene, PROPS.signboard(), -4.6, 19.5, 0.5);
  colC(-4.6, 19.5, 0.7);
  world.gates.board = board;
  const scare = place(scene, PROPS.scarecrow(), 11, 27, -0.8);
  colC(11, 27, 0.5);
  world.anim.scarecrow = scare;
  world.anim.pinwheels = [];
  for (const [x, z, ry] of [[3, 24.5, 0.4], [-9, 9, 1.2], [14, 12, 2.2]]) {
    const pw = place(scene, PROPS.pinwheel(), x, z, ry);
    colC(x, z, 0.25);
    world.anim.pinwheels.push(pw.userData.blades);
  }
  for (const [x, z] of [[-11.5, 16.5], [-10.5, 23], [7, 29], [8.5, 7.5], [-2, 27]])
    place(scene, PROPS.sunflower(), x, z, Math.random() * 3);

  // ---- 跳跳石（草甸东南的空地）：三级石阶跳上高台，台顶的蛋要跳上去才够得着 ----
  {
    const perch = { x: 11.5, z: 27.2, r: 1.35, top: 2.75 };
    const steps = [
      { x: 11.5, z: 24.2, r: 1.0, top: 1.0 },
      { x: 11.5, z: 25.7, r: 1.0, top: 1.85 },
      perch,
    ];
    for (const s of steps) {
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(s.r, s.r + 0.18, s.top, 14),
        M(s === perch ? '#9FB894' : '#BCC8B4'));
      stone.position.set(s.x, s.top / 2, s.z);
      stone.castShadow = true;
      stone.receiveShadow = true;
      scene.add(stone);
      colTop(s.x, s.z, s.r, s.top);   // 侧面也挡人，但站到台顶高度后不再挡
    }
    world.perch = perch;   // 每关会有一颗蛋放到台顶（见 game.js _spawnProgress）
  }

  // ---- 阳光海滩（吹开沙墙后）：椰树、遮阳伞、沙堡、浮木 ----
  const palmSpots = [[-14, 41.5], [12, 44], [-22, 44], [20, 41], [2, 49.5], [-28, 40.5]];
  for (const [x, z] of palmSpots) {
    place(scene, PROPS.palm(), x, z, Math.random() * 3);
      // 这圈树同样登记冠幅：它们离城心 r-3，蛋/牌位若落进来会被树冠罩住
      {
        const bb = new THREE.Box3().setFromObject(obj);
        const rad = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
        world.decor.push({ x: x - cx, z: z - cz, r: rad + 0.35 });
      }
    colC(x, z, 0.55);
  }
  for (const [x, z, ry] of [[-6, 43.5, 0.7], [9, 47.5, 2.4]]) {
    place(scene, PROPS.umbrella(), x, z, ry);
    colC(x, z, 0.35);
  }
  place(scene, PROPS.sandcastle(1.15), 16, 46.5, 0.5);
  colTop(16, 46.5, 1.15, 1.5);
  place(scene, PROPS.sandcastle(0.8), -18, 47, 2.2);
  colTop(-18, 47, 0.8, 1.1);
  for (const [x, z, ry] of [[5, 42.5, 0.8], [-12, 49.5, 1.9]]) {
    place(scene, PROPS.log(0.9), x, z, ry);
    colTop(x, z, 0.5, 0.7);
  }

  // 海滩地标：贝壳堆与小海星
  place(scene, PROPS.shells(), 8.2, 45.4, Math.random() * 3);

  // ---- 神秘森林（拨开荆棘后）：松树、灌木、蘑菇、萤火虫 ----
  const pineSpots = [
    [-41, -14], [-47, -15], [-52, -10], [-51, -4], [-41, -6], [-52, 6], [-42, 2],
    [-50, 14], [-41, 9], [-43, 16], [-51, 19], [-42, 22], [-49, 22], [-40, -12],
  ];
  for (const [x, z] of pineSpots) {
    place(scene, PROPS.pine(0.9 + Math.random() * 0.5), x, z, Math.random() * 3);
    colC(x, z, 0.55);
  }
  for (const [x, z] of [[-44, -2], [-48, 4], [-40, 6], [-46, 10], [-44, 19], [-40, -10]]) {
    place(scene, PROPS.bush(0.8 + Math.random() * 0.5), x, z, Math.random() * 3);
    colTop(x, z, 0.5, 0.9);
  }
  for (const [x, z, s] of [[-45, -6, 1], [-49, 9, 1.2], [-41, 13, 0.9], [-47, 17, 1.1], [-43, -12, 0.8]]) {
    place(scene, bigMushroom(s), x, z, Math.random() * 3);
    colTop(x, z, 0.28 * s, 0.9 * s, 0, true);
  }
  place(scene, PROPS.log(1.1), -45.5, 4.5, 0.4);
  colTop(-45.5, 4.5, 0.55, 0.8);
  // 萤火虫（神秘森林专属小灯）
  {
    const n = 42;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -52 + Math.random() * 13;
      pos[i * 3 + 1] = 0.5 + Math.random() * 2;
      pos[i * 3 + 2] = -16 + Math.random() * 37;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const fire = new THREE.Points(geo, new THREE.PointsMaterial({
      map: glowTexture('rgba(255,250,180,1)', 'rgba(255,240,120,0)'),
      color: 0xFFF2A0, size: 0.42, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(fire);
    world.anim.fireflies = fire;
  }

  }   // end !cityOnly（农场地形到此为止）

  // ---- 云朵（抬到高处：飘太低会挡在镜头和小人之间，把地面糊成一片白） ----
  world.anim.clouds = [];
  for (let i = 0; i < 8; i++) {
    const c = PROPS.cloud(1.1 + Math.random() * 0.8);
    const a = Math.PI * 2 * i / 8;
    c.position.set(Math.cos(a) * (24 + Math.random() * 16), 22 + Math.random() * 8, Math.sin(a) * (24 + Math.random() * 16));
    c.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 0.45; o.castShadow = false; } });
    scene.add(c);
    world.anim.clouds.push(c);
  }

  // ---- 天气粒子（雨/雪，平时隐藏；由 game 层按天气轮换显示） ----
  const makeFall = (n, size, color, opacity) => {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = Math.random() * 24;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true }));
    pts.visible = false;
    scene.add(pts);
    return pts;
  };
  world.anim.rain = makeFall(650, 0.14, 0xa8d0f0, 0.55);
  world.anim.snow = makeFall(420, 0.22, 0xffffff, 0.85);
  world.anim.sunLight = sun;

  // ---- 蝴蝶（草甸花丛间） ----
  world.anim.butterflies = [];
  const bfCenters = [[0, 20], [-10, 25], [8, 12], [-16, 30], [12, 28], [-4, 8]];
  const bfColors = ['#FF8FB0', '#FFE24E', '#7EC4F2', '#B28FF5', '#FF9A5C', '#FF6B6B'];
  for (let i = 0; i < bfCenters.length; i++) {
    const bf = PROPS.butterfly(bfColors[i]);
    bf.position.set(bfCenters[i][0], 1, bfCenters[i][1]);
    bf.userData.center = bfCenters[i];
    bf.userData.home = [...bfCenters[i]];
    bf.userData.phase = Math.random() * 9;
    scene.add(bf);
    world.anim.butterflies.push(bf);
  }

  // ---- 海鸥（海滩上空盘旋） ----
  world.anim.gulls = [];
  for (let i = 0; i < 3; i++) {
    const gu = PROPS.gull();
    gu.userData.center = [i * 6 - 6, 46];
    gu.userData.radius = 5 + i * 2;
    gu.userData.height = 6.5 + i * 1.3;
    gu.userData.phase = i * 2.1;
    scene.add(gu);
    world.anim.gulls.push(gu);
  }

  // ---- 摇曳的小草 ----
  world.anim.grass = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 40;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(z) < 5.4) continue;
    if (x > 19 && x < 29 && z > 18 && z < 26) continue;
    const tuft = place(scene, PROPS.grassTuft(), x, z, Math.random() * 3);
    tuft.traverse(o => { if (o.isMesh) o.castShadow = false; });
    tuft.userData.phase = Math.random() * 9;
    world.anim.grass.push(tuft);
  }

  // ---- 花瓣飘落粒子 ----
  const petalCount = 220;
  const positions = new Float32Array(petalCount * 3);
  const speeds = new Float32Array(petalCount);
  for (let i = 0; i < petalCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = Math.random() * 12 + 1;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    speeds[i] = 0.35 + Math.random() * 0.5;
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({
    map: petalTexture(), size: 0.42, transparent: true, opacity: 0.85,
    depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(petals);
  world.anim.petals = { points: petals, speeds };

  if (!cityOnly) {
  // ---- 机关 1：金色沙墙（南边去海滩的路，用 wind 吹开） ----
  {
    const wall = new THREE.Group();
    const cols = [];
    for (let i = 0; i < 6; i++) {
      const d = PROPS.dune(3.1 + Math.random() * 0.5);
      d.scale.y *= 0.5;   // 压扁：沙墙仍挡路，但孩子能越过它看到海滩和远处，不再被大沙包糊一脸
      const dx = -27.5 + i * 11, dz = 38.2 + (i % 2) * 0.5;
      d.position.set(dx, 0, dz);
      d.rotation.y = Math.random();
      wall.add(d);
      // 沙丘是个半径 5 米多的大球，比细条矩形碰撞体外鼓很多，
      // 不补圆形碰撞的话小人会走进沙球身体里，镜头也被整个埋进去
      cols.push(C.length); colC(dx + 0.4, dz, 4.3);
    }
    const castle = PROPS.sandcastle(1.25);
    castle.position.set(0, 1.4, 38.4);
    wall.add(castle);
    wall.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(wall);
    cols.push(C.length); colR(-34.5, 37.3, 34.5, 39.3);
    world.gates.sandWall = { group: wall, cols };
    // 沙墙两端的大岩石封口
    for (const [x, z] of [[37.5, 39.5], [-37.5, 39.5]]) {
      place(scene, PROPS.rock(2.4), x, z);
      colC(x, z, 2.2);
    }
  }

  // ---- 机关 2：荆棘丛（西边去森林的路，用 banana 拨开） ----
  {
    const wall = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const tn = PROPS.thorn(2.1 + Math.random() * 0.5);
      tn.position.set(-38, 0, 7.5 + i * 6.4);
      tn.rotation.y = Math.random() * 3;
      wall.add(tn);
      const tn2 = PROPS.thorn(2.1 + Math.random() * 0.5);
      tn2.position.set(-38, 0, -7.5 - i * 6.4);
      tn2.rotation.y = Math.random() * 3;
      wall.add(tn2);
    }
    wall.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(wall);
    colR(-39.2, 4.3, -36.8, 33.5);
    colR(-39.2, -33.5, -36.8, -4.3);
    world.gates.vines = { group: wall, cols: [C.length - 2, C.length - 1] };
    // 荆棘两端的大石头封口
    for (const [x, z] of [[-38.5, 36], [-38.5, -36]]) {
      place(scene, PROPS.rock(2.4), x, z);
      colC(x, z, 2.2);
    }
  }

  }   // end !cityOnly（农场机关到此为止）

  // ---- 城市巡游舞台：每关一个城市（真实轮廓地形+地标+名牌+特产装饰） ----
  world.islands = [];
  const buildOne = (isl, si, forceFull) => {
    const { cx, cz, r, color, key } = isl;
    const bw = CITY_WALL_BW(r);   // 院墙管径：所有贴边元素按它留出墙厚
    let sim = null;               // 简化轮廓：钳制/碰撞专用低模（原精度留给渲染）
    const grp = new THREE.Group();
    // 微缩分层地形高度钩子：有 terrain 配置的城市 TY=寻高、Y=装饰落点贴地；
    // 无配置城市 TY=null、Y 恒等于 base（一切摆放逻辑与从前完全一致）
    let TY = null;
    const Y = (x, z, base = 0) => (TY ? TY(x, z) + base : base);
    if (!forceFull && focus >= 0 && si !== focus) {
      // 只精建当前城：相邻精建岛在部分渲染器（IDE 预览/软渲染）上贴图会丢失显白块，且白岛叠在当前城边造成"能走过去"的错觉
      const vr = r * 0.45;   // 占位岛缩小一圈，避免邻岛在海上挤成绿大陆
      const lt = new THREE.Mesh(new THREE.CylinderGeometry(vr, vr * 0.92, 6, 20),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#9CCF8C'), 0.55), roughness: 0.95 }));
      lt.position.y = -3; grp.add(lt);
      grp.position.set(cx, 0, cz); scene.add(grp);
      world.islands.push({ ...isl, grp, light: true });
      return;
    }
    // 岛身：按城市轮廓多边形生成（顶面贴图 UV 按包围盒映射，岩裙沿边下垂）
    if (isl.shape) {
      const pts = isl.shape;                      // 已是世界坐标（含 cx/cz 偏移的局部点）
      sim = simplifyPoly(pts, 0.1);               // 钳制用低模：与 game._clampCityPos 同一份
      const coarse = simplifyPoly(pts, 2.5);      // 更粗一级：快速通道测距（远离边界时免精确钳）
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      // 微缩分层地形（data/cities/<id>/terrain.json 有配置的城市）：真 3D 高度场替代平面贴图
      let terrain = null;
      // 程序化地面部件（地形网格 + 雪峰 + 院墙 + 垛口 + 岩裙）：烘焙 GLB 到位后隐藏它们，
      // 只切 visible、不 dispose —— 加载失败/超时/触屏回退时立刻可用（见本文件末尾的 ground-slot）
      const procGround = [];
      if (isl.terrain) {
        terrain = createCityTerrain({ pts, cfg: isl.terrain });
        grp.add(terrain.group);
        procGround.push(terrain.groundMesh, ...terrain.peakMeshes);   // 换装后由 ground-slot 隐藏
        TY = (x, z) => terrain.heightAtLocal(x, z);
      }
      if (!terrain) {
        const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
        const geo = new THREE.ShapeGeometry(shape, 24);
        // 顶面贴图：UV 按包围盒归一化，环道/街纹理才能对上
        // 注意：ShapeGeometry 顶点是 (x, y, 0)，多边形的"z"存在 y 分量里
        const uv = geo.attributes.uv, pos = geo.attributes.position;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, (pos.getX(i) - minX) / (maxX - minX), 1 - (pos.getY(i) - minZ) / (maxZ - minZ));
        }
        const top0 = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: cityIslandTexture(color, isl.level, pts, isl), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
        // 旋转 +90°：轮廓 y（=世界 z）原样落位。此前用 -90° 会把地面南北镜像——
        // 不对称城市（乌鲁木齐等）地面画到界外、城内露出台纸白块，树全站在"空白"上
        top0.rotation.x = Math.PI / 2;
        top0.position.y = 0.02;
        top0.receiveShadow = true;
        grp.add(top0);
      }
      // CITY_FRAME：卡通长城——青灰砖直墙 + 墙顶垛口 + 烽火台（可点火彩蛋，game 层驱动）。
      // 只做装饰、无碰撞体：玩家/物件边界仍走 game 的钳制公式；直墙半厚 1.0 比旧圆管瘦，
      // 视觉上更通透，窄颈处也显得更好走。保留墙根渐变过渡带（改为灰绿色调配砖墙）。
      {
        const H = 3.0, THICK = 1.0;
        const ptIn = (px, pz) => {
          let hit = false;
          for (let i = 0, j = pts.length - 2; i < pts.length - 1; j = i++) {
            const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
            if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) hit = !hit;
          } return hit;
        };
        const fpts = [];
        for (let i = 0; i < pts.length - 1; i++) fpts.push(new THREE.Vector3(pts[i][0], 0, pts[i][1]));
        // 张力 0：样条贴着轮廓顶点走，不再在拐角处过冲甩出"S"形波浪——
        // 旧版墙体自己扭来扭去，垛口跟着甩得东倒西歪，看着像乱摆的砖
        const curve = new THREE.CatmullRomCurve3(fpts, true, 'catmullrom', 0);
        const { geo: wallGeo, samples, normals, arcs, len } = buildWallGeometry(curve, H, THICK);
        // 外侧方向：取一个样本点测试内外，整条边界绕向一致
        const outerSign = ptIn(samples[0].x + normals[0][0] * 2, samples[0].z + normals[0][1] * 2) ? -1 : 1;
        // 法线与 albedo 同 UV 空间（见 textures.js 的 brickNormal）：砖块因此有了凹凸，
        // 原来只有平面贴图，远看就是一条平墙
        const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({
          map: brickTexture(), normalMap: brickNormal().normalMap,
          normalScale: new THREE.Vector2(0.75, 0.75), roughness: 0.95, side: THREE.DoubleSide,
        }));
        grp.add(wall);
        procGround.push(wall);
        // 垛口：沿墙顶外侧等距小块（InstancedMesh，节奏感的关键）
        const merlonGap = 3.4;
        const rng = wrngOf(seedOfPoints(pts));   // 垛口细节的确定性随机源
        const merlonN = Math.max(2, Math.floor(len / merlonGap));
        const merlons = new THREE.InstancedMesh(
          new THREE.BoxGeometry(1.5, 1.1, 1.0),
          new THREE.MeshStandardMaterial({ color: '#A9B8B7', roughness: 0.9 }),
          merlonN
        );
        {
          const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1);
          // 尺寸/位置抖动：等距等大的垛口是"灰色拉链"的来源。±13% 的尺寸 + ±0.35 的错位，
          // 再加约 8% 的缺失与轻微色差，读起来才是"人手砌的旧城墙"。
          const mCol = new THREE.Color();
          for (let k = 0; k < merlonN; k++) {
            // 少数垛口塌了/被拆过：规模缩到极小（InstancedMesh 不能真的删实例，缩到看不见最省）
            const broken = rng() < 0.08;
            const jw = 0.87 + rng() * 0.26, jh = 0.86 + rng() * 0.3, jd = 0.9 + rng() * 0.2;
            sc.set(broken ? 0.05 : jw, broken ? 0.05 : jh, broken ? 0.05 : jd);
            const target = (k + 0.5) * merlonGap + (rng() - 0.5) * 0.7;
            // 找弧长最近的采样点
            let i = Math.round(target / (len / (samples.length - 1)));
            i = Math.max(0, Math.min(samples.length - 1, i));
            const p = samples[i], [nx, nz] = normals[i];
            // 朝向取本段切线（相邻采样点连线）：与墙体走向严格一致，垛口不再各自乱歪
            // （+π/2 让 1.5 的长边贴着墙走向，1.0 的短边横跨墙顶）
            const pa = samples[Math.max(0, i - 1)], pb = samples[Math.min(samples.length - 1, i + 1)];
            const yaw = Math.atan2(pb.x - pa.x, pb.z - pa.z) + Math.PI / 2;
            q.setFromAxisAngle(up, yaw);
            m4.compose(
              new THREE.Vector3(p.x + nx * THICK * outerSign * 0.5, H + 0.5, p.z + nz * THICK * outerSign * 0.5),
              q, sc
            );
            merlons.setMatrixAt(k, m4);
            // 每块轻微色差（旧砖的深浅不匀）
            const tone = 0.88 + rng() * 0.24;
            merlons.setColorAt(k, mCol.setRGB(tone, tone * 1.01, tone * 1.005));
          }
          merlons.instanceMatrix.needsUpdate = true;
          if (merlons.instanceColor) merlons.instanceColor.needsUpdate = true;
        }
        grp.add(merlons);
        procGround.push(merlons);
        // 烽火台：弧长均分 3~4 座，落在窄域（塔内侧净空不足）就顺延错位或跳过
        const beacons = [];
        {
          const nT = r > 85 ? 4 : 3;
          for (let k = 0; k < nT; k++) {
            let placed = null;
            for (const nudge of [0, 0.04, -0.04, 0.08, -0.08]) {
              const frac = (k + 0.5) / nT + nudge;
              const target = frac * len;
              let i = Math.round(target / (len / (samples.length - 1)));
              i = Math.max(0, Math.min(samples.length - 1, i));
              const p = samples[i], [nx, nz] = normals[i];
              const ox = nx * outerSign, oz = nz * outerSign;
              // 塔身骑在边界线上；内侧若连 3.8 的地面都没有（窄颈），小人没处站 → 换位
              if (!ptIn(p.x - ox * 3.8, p.z - oz * 3.8)) continue;
              placed = { i, p };
              break;
            }
            if (!placed) continue;
            const { i, p } = placed;
            const tower = buildBeaconTower(color);
            // 朝向城心：瞭望窗/小旗都在朝里那面
            tower.rotation.y = Math.atan2(-p.x, -p.z);
            tower.position.set(p.x, 0, p.z);
            grp.add(tower);
            beacons.push({
              lx: p.x, lz: p.z,
              wx: cx + p.x, wz: cz + p.z,
              top: 6.3,               // 火盆口高度（本地）
              lit: false, flame: null, smokeT: 0,
            });
          }
        }
        grp.userData.beacons = beacons;            // game 层走近点火用
        // 墙根过渡带：向城内渐隐的灰绿色（配砖墙，替代旧的暖沙色）
        {
          const band = bw * 1.2 + 0.6;
          const inner = polyOffsetRing(pts, -band);
          const posArr = [], colArr = [], idxArr = [];
          const cBand = new THREE.Color('#B9C0B2');
          const push = (x, z, a) => {
            posArr.push(x, 0.06, z);
            colArr.push(cBand.r, cBand.g, cBand.b, a);
          };
          for (let i = 0; i < pts.length - 1; i++) {
            const k = posArr.length / 3;
            push(pts[i][0], pts[i][1], 0.42);
            push(inner[i][0], inner[i][1], 0);
            push(pts[i + 1][0], pts[i + 1][1], 0.42);
            push(inner[i + 1][0], inner[i + 1][1], 0);
            idxArr.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
          }
          const bg = new THREE.BufferGeometry();
          bg.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
          bg.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 4));   // 4 分量 = 顶点透明度
          bg.setIndex(idxArr);
          const bandMesh = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
            polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -9,
          }));
          bandMesh.renderOrder = 2;
          grp.add(bandMesh);
        }
        // 边内侧随机种树（两排）：树干+球冠，合并画法简单化——逐棵小 Group 太重，用 InstancedMesh 也不必要，直接撒低模树
        const trunkM = new THREE.MeshStandardMaterial({ color: 0x8A6B4A, roughness: 1 });
        const leafM = new THREE.MeshStandardMaterial({ color: 0x5FA05A, roughness: 1 });
        const trunkG = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 5);
        const leafG = new THREE.SphereGeometry(0.9, 7, 6);
        const N = Math.min(220, Math.round(pts.length * 0.8));
        const trunks = new THREE.InstancedMesh(trunkG, trunkM, N), leaves = new THREE.InstancedMesh(leafG, leafM, N);
        const m4 = new THREE.Matrix4();
        let ti = 0;
        const inPoly = (px, pz) => {
          let inside = false;
          for (let i = 0, j = pts.length - 2; i < pts.length - 1; j = i++) {
            const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
            if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) inside = !inside;
          } return inside; };
        let seedN = r;
        const rnd = () => (seedN = (seedN * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < pts.length - 1 && ti < N; i++) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
          const el = Math.hypot(bx - ax, bz - az) || 1;
          let nx = -(bz - az) / el, nz = (bx - ax) / el;
          if (ax * ax + az * az > (ax + nx) ** 2 + (az + nz) ** 2) { nx = -nx; nz = -nz; }
          const cnt = Math.max(1, Math.round(el / (r * 0.06)));
          for (let j2 = 0; j2 < cnt && ti < N; j2++) {
            const t2 = (j2 + 0.5) / cnt, d2 = bw * 2.5 + rnd() * r * 0.05;
            const px2 = ax + (bx - ax) * t2 - nx * d2, pz2 = az + (bz - az) * t2 - nz * d2;

            if (!inPoly(px2, pz2)) continue;
            const sc = 0.8 + rnd() * 0.9;
            m4.makeScale(sc, sc, sc);
            m4.setPosition(px2, Y(px2, pz2, 0) + 0.8 * sc, pz2);
            trunks.setMatrixAt(ti, m4);
            m4.makeScale(sc, sc, sc);
            m4.setPosition(px2, 1.6 * sc + 0.5 * sc, pz2);
            leaves.setMatrixAt(ti, m4);
            ti++;
          }
        }
        trunks.count = ti; leaves.count = ti;
        trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true;
        grp.add(trunks); grp.add(leaves);
      }
      // 岩裙（长城石基）：沿轮廓边垂直下垂、轻微向岛心收拢。收拢比例 0.8→0.94：
      // 旧版尾部越远收得越多，俯瞰时墙外露出大片黄土坡；现在几乎垂直，只露一条
      // 石 basis 细边，颜色对齐砖墙——读作"墙体延伸到地下"，不再像界外黄土
      const skirtPos = [], skirtIdx = [];
      const sink = -3.6, tuck = 0.94;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const k = skirtPos.length / 3;
        skirtPos.push(ax, 0, az, bx, 0, bz, ax * tuck, sink, az * tuck, bx * tuck, sink, bz * tuck);
        skirtIdx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
      sg.setIndex(skirtIdx);
      sg.computeVertexNormals();
      const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x87928F, roughness: 1, side: THREE.DoubleSide }));
      grp.add(skirt);
      procGround.push(skirt);
      // 沿边浪花：白色小圆点贴着轮廓边外侧撒一圈（合并成单 mesh，随 islandSurf 呼吸闪烁）
      {
        const unit = Math.max(0.55, r * 0.02);          // 尺度随城市大小走
        const step = unit * 1.5, off = unit * 1.3, dotR = unit * 0.85;
        const fPos = [], fIdx = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
          const el = Math.hypot(bx - ax, bz - az) || 1;
          const n = Math.max(1, Math.round(el / step));
          for (let j = 0; j < n; j++) {
            const t = (j + 0.5) / n;
            const mx = ax + (bx - ax) * t, mz = az + (bz - az) * t;
            let nx = -(bz - az) / el, nz = (bx - ax) / el;
            if (mx * mx + mz * mz > (mx + nx) ** 2 + (mz + nz) ** 2) { nx = -nx; nz = -nz; }  // 选朝外那侧
            // 两排浪花：近排大点 + 远排小点错位，更接近真实碎浪
            for (const [o, dr, jit] of [[off, dotR, 0], [off * 2.1, dotR * 0.7, step * 0.5]]) {
              const fx = mx + nx * o + jit, fz = mz + nz * o + jit;
              const k = fPos.length / 3;
              for (let s = 0; s < 7; s++) {
                const a1 = (s / 7) * Math.PI * 2, a2 = ((s + 1) / 7) * Math.PI * 2;
                fPos.push(fx, 0.035, fz,
                  fx + Math.cos(a1) * dr, 0.035, fz + Math.sin(a1) * dr,
                  fx + Math.cos(a2) * dr, 0.035, fz + Math.sin(a2) * dr);
                fIdx.push(k, k + 1, k + 2);
              }
            }
          }
        }
        if (fPos.length) {
          const fg = new THREE.BufferGeometry();
          fg.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
          fg.setIndex(fIdx);
          const foam = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({
            color: 0xFFFFFF, transparent: true, opacity: 0.38, depthWrite: false,
          }));
          foam.position.y = 0.03;
          grp.add(foam);
          world.anim.islandSurf = world.anim.islandSurf || [];
          world.anim.islandSurf.push(foam);
        }
      }
      // 烘焙地面挂点（成都试点，见美术升级方案 §五）：程序化地面先顶上，GLB 到位后原地换掉。
      // 只清 slot 自己的 children —— 地标/立牌/树/蛋都挂在 grp 上，换装绝不会误删（js/assets.js 的契约）；
      // 加载失败/超时/离线/触屏（assets.js 的 LOW_END）什么都不发生，程序化地面照旧可玩。
      const gslot = new THREE.Group();
      gslot.name = 'ground-slot';
      grp.add(gslot);
      assets.apply(gslot, 'ground', key, {
        onSwap: () => { for (const o of procGround) o.visible = false; },
      });
      world.cityBounds = world.cityBounds || {};
      world.cityBounds[key] = {
        pts, sim, coarse, minX, maxX, minZ, maxZ, cx, cz,
        // 微缩地形寻高（世界坐标）：game._supportAt/_groundY 用它让玩家/NPC/词宠走上台地山坡
        terrainHeight: terrain ? (wx, wz) => terrain.heightAtLocal(wx - cx, wz - cz) : null,
        // 高度场本体（局部坐标）：game 层用它做涉水/沙丘滑行/雪线脚印/梯田采集/地形打卡点
        terrainField: terrain ? terrain.field : null,
      };
    } else {
      // 兜底：无轮廓时保持圆形岛身
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 6, 26),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#9CCF8C'), 0.55), roughness: 0.95 }));
      top.position.y = -3;
      top.receiveShadow = true;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 0.9, 26), M('#A8825B'));
      rock.rotation.x = Math.PI;
      rock.position.y = -6 - r * 0.45;
      grp.add(top, rock);
    }
    // 岛边浪花：无轮廓时圆环兜底；多边形轮廓已在上方沿边撒白点
    let surf2 = null;
    if (!isl.shape) {
      surf2 = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r + 0.7, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.4, depthWrite: false }));
      surf2.position.y = 0.03;
      grp.add(surf2);
    }
    if (surf2) {
      world.anim.islandSurf = world.anim.islandSurf || [];
      world.anim.islandSurf.push(surf2);
    }
    // 岛上装饰：城市舞台先摆地标+名牌+特产，再补少量绿树
    const isCity = !!isl.landmark;
    if (isCity) {
      // 圆形兜底地面：有轮廓时顶面已由 ShapeGeometry 承担，不再叠加圆面
      if (!isl.shape) {
      const top0 = new THREE.Mesh(new THREE.CircleGeometry(r - 0.35, 40).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: cityIslandTexture(color, isl.level), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
      top0.position.y = 0.02;
      top0.receiveShadow = true;
      grp.add(top0);
      }
      // 多地标组合：主地标居中，其余按角度分布（level.landmarks 配置）
      // 真实轮廓下按半径摆可能伸进海里（细长/凹形城市）：统一钳回多边形内，
      // 且按地标自身占地留出墙厚边距，不再让亭子/塔楼骑到院墙上
      const poly = isl.shape || null;
      const polySim = sim;   // 钳制统一用简化轮廓（与 game._clampCityPos 完全同一条边界）
      // 各地标原型的占地半径（未缩放；cityLandmark 里的最大外扩尺寸）
      // wall 7.2→7.5、ice 2.4→2.6：烘焙时按实际顶点量出来比原表大（长城段半宽 7.5、
      // 冰塔右侧锥 2.5），原表偏小会让摆放边距不够、地标蹭墙——按实测回填
      const LM_HALF = { gate: 3.6, tower: 1.7, wall: 7.5, panda: 3.2, ice: 2.6, palm: 3.6, dome: 2.8, mountain: 4.5, pavilion: 2.8, bridge: 3.4, grotto: 2.5, harbor: 3.4, 'uni-gate': 3.4 };
      const lmSpots = [[0, 0]];
      const lms = (isl.level && isl.level.landmarks && isl.level.landmarks.length)
        ? isl.level.landmarks : [isl.landmark, 'pavilion'];
      const lay = cityLayout(key);   // 本城布局个性（方向/风格/石台位，确定性）
      lms.forEach((type, i) => {
        if (i > 0 && type === lms[0]) return;
        // 副地标按风格摆：ring=均匀环绕 / twin=两侧成对 / line=沿一条轴线纵深排开
        let a, rr;
        if (i === 0) { a = lay.baseA; rr = 0; }
        else if (lay.style === 'twin') { a = lay.baseA + (i % 2 ? 0.55 : -0.55); rr = r * 0.42; }
        else if (lay.style === 'line') { a = lay.baseA + ((i % 2) ? Math.PI : 0); rr = r * (0.38 + 0.14 * Math.floor(i / 2)); }
        else { a = lay.baseA + (i / Math.max(1, lms.length)) * Math.PI * 2; rr = r * 0.56; }
        const sc = i === 0 ? 1 : 0.78;
        let lx = Math.cos(a) * rr, lz = Math.sin(a) * rr;
        if (i > 0 && polySim) [lx, lz] = clampPoly(polySim, lx, lz, bw + (LM_HALF[type] || 2.8) * sc + 0.3);
        lmSpots.push([lx, lz]);
        const lm = cityLandmark(type, color, null, null, { key: `${key}#${i}` });   // key 对上 scripts/bake/landmarks.py 的槽位
        lm.position.set(lx, Y(lx, lz), lz);
        lm.scale.setScalar(sc);
        lm.rotation.y = -a + Math.PI;
        lm.traverse(o => { if (o.isMesh) o.castShadow = true; });
        grp.add(lm);
        colC(cx + lx, cz + lz, i === 0 ? Math.max(1.4, (LM_HALF[type] || 2.8) * 0.85 * sc) : 1.0);
        if (i === 0 && isl.city) {
          const cv = document.createElement('canvas');
          cv.width = 340; cv.height = 124;
          const nc = cv.getContext('2d');
          nc.fillStyle = 'rgba(255,253,248,.95)';
          nc.strokeStyle = '#FF9FBE'; nc.lineWidth = 6;
          if (nc.roundRect) { nc.beginPath(); nc.roundRect(6, 6, 328, 112, 26); nc.fill(); nc.stroke(); }
          else nc.fillRect(6, 6, 328, 112);
          nc.fillStyle = '#B4436F'; nc.textAlign = 'center'; nc.textBaseline = 'middle';
          nc.font = "900 46px 'Microsoft YaHei', sans-serif";
          nc.fillStyle = '#8E2252'; nc.fillText('欢迎来 ' + isl.city.name, 170, 46);
          nc.fillStyle = '#C4788F'; nc.font = "bold 32px 'Microsoft YaHei', sans-serif";
          nc.fillText(isl.city.en || '', 170, 94);
          const wtex = new THREE.CanvasTexture(cv);
          const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: wtex, transparent: true, depthWrite: false, fog: false }));
          spr.name = 'welcome-sign';
          spr.userData.keep = true;   // GLB 换装时保留（约定见 js/assets.js）
          spr.scale.set(4.2, 1.5, 1);
          spr.position.set(0, (LM_HALF[type] || 2.8) * 1.75 + 1.1, 0);
          lm.add(spr);
        }
      });
      // 悬浮岛：岩裙侧壁 + 底部垂石 + 环岛云海（原成都专属试点，现已全城通用）
      if (isl.shape) buildFloatingIsland(grp, isl.shape, cx, cz, world.anim);
      let px = Math.cos(lay.perchA) * r * lay.perchD, pz = Math.sin(lay.perchA) * r * lay.perchD;
      if (polySim) [px, pz] = clampPoly(polySim, px, pz, bw + 1.2);   // 顶面 2.1 宽：边距=墙厚+半宽
      box(grp, 1.6, 3.2, 1.6, '#C8B898', px, Y(px, pz, 1.6), pz);
      box(grp, 2.1, 0.3, 2.1, '#D8CCA8', px, Y(px, pz, 3.3), pz);
      colTop(cx + px, cz + pz, 1.15, Y(px, pz, 3.45));
      // 中英文城市名牌：已取消常驻 3D 名牌（城市名由顶栏胶囊与介绍卡表达，拉远后牌面过大不协调）
      // 特产装饰 emoji 撒一圈（随到访版本的城市特色；初始角按城市个性旋转）
      (isl.decos || ['🏮']).forEach((em, i) => {
        const a = lay.baseA + Math.PI * 2 * i / Math.max(1, isl.decos.length) + 0.4;
        let dx2 = Math.cos(a) * (r - 3), dz2 = Math.sin(a) * (r - 3);
        if (polySim) [dx2, dz2] = clampPoly(polySim, dx2, dz2, bw + 0.5);
        const s = new THREE.Sprite(letterTexture(em, '#FFFDF4', '#6B5844'));
        s.scale.setScalar(0.9);
        s.position.set(dx2, Y(dx2, dz2, 0.6), dz2);
        grp.add(s);
      });
      // 手作城市记忆点：layouts.json 逐城摆放的专属装饰（a=方向角 d=半径系数，坐标随城半径缩放）
      for (const p of (CITY_LAYOUT_OVERRIDES[key] && CITY_LAYOUT_OVERRIDES[key].props) || []) {
        let px2 = Math.cos(p.a || 0) * r * (p.d == null ? 0.5 : p.d);
        let pz2 = Math.sin(p.a || 0) * r * (p.d == null ? 0.5 : p.d);
        if (polySim) [px2, pz2] = clampPoly(polySim, px2, pz2, bw + 0.5);
        const s = new THREE.Sprite(letterTexture(p.emoji, '#FFFDF4', '#6B5844'));
        s.scale.setScalar(p.scale || 1.15);
        s.position.set(px2, Y(px2, pz2, p.y || 0.75), pz2);
        grp.add(s);
      }
      // 花丛点缀：环路四个象限（随城市个性旋转）
      if (PROPS.flowerpatch) for (const [dx, dz] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) {
        let fx = dx * r * Math.cos(lay.baseA) + dz * r * Math.sin(lay.baseA);
        let fz = -dx * r * Math.sin(lay.baseA) + dz * r * Math.cos(lay.baseA);
        if (polySim) [fx, fz] = clampPoly(polySim, fx, fz, bw + 0.7);
        const fp = PROPS.flowerpatch();
        fp.position.set(fx, Y(fx, fz, 0), fz);
        grp.add(fp);
      }
﻿      // 城市绿化+高楼：内部撒树丛/草丛（装饰不碰撞），中环带立低模高楼（带碰撞）
      {
        const rn = lay.rn;   // 城市个性随机流：同城重建一致，异城（哪怕半径相同）装饰排布不同
        const inPt = (px, pz) => {
          if (!poly) return Math.hypot(px, pz) < r - 4;
          let ins = false;
          for (let i = 0, j = poly.length - 2; i < poly.length - 1; j = i++) {
            const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
            if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) ins = !ins;
          }
          return ins;
        };
        const placed = [];
        const lmHalf = 3.5;   // 绿化块在 forEach 外拿不到单地标 type，用最大占地保守避让
        const lmFar = (px, pz) => lmSpots.every(q => Math.hypot(q[0] - px, q[1] - pz) > lmHalf * 0.9 + 2.2);
        // margin：采样点钳到离边界至少这么远（墙厚+自身半径），树丛/高楼不再嵌进院墙
        const spot = (dMin, dMax, gap, margin) => {
          for (let k = 0; k < 40; k++) {
            const a2 = rn() * Math.PI * 2, d2 = dMin + rn() * (dMax - dMin);
            let px = Math.cos(a2) * d2, pz = Math.sin(a2) * d2;
            if (!inPt(px, pz)) continue;
            if (polySim) [px, pz] = clampPoly(polySim, px, pz, margin);
            if (placed.some(q => Math.hypot(q[0] - px, q[1] - pz) < gap)) continue;
            if (!lmFar(px, pz)) continue;   // 树不贴地标/牌坊底座
            // 迎宾主街留空：返回台（本地 z=-2.5）到中心主地标之间不撒树/高楼，一眼看穿城
            if (Math.abs(px) < r * 0.05 && pz < 0.35 && pz > -r * 0.95) continue;
            placed.push([px, pz]);
            return [px, pz];
          }
          return null;
        };
        // 绿化：树/松/灌木混撒，装饰不挡路
        const gN = Math.round(Math.min(180, r * 2.4));
        for (let i = 0; i < gN; i++) {
          const sp = spot(r * 0.15, r * 0.9, r * 0.05, bw + 1.7);
          if (!sp) continue;
          let obj = null;
          const t2 = rn();
          if (isl.style === 'pine' || t2 < 0.3) obj = PROPS.pine(1 + rn() * 0.8);
          else if (t2 < 0.55) obj = PROPS.bush(1.1 + rn() * 0.7);
          else obj = PROPS.tree(false);
          obj.scale.setScalar(1.1 + rn() * 0.7);
          obj.position.set(sp[0], Y(sp[0], sp[1], 0), sp[1]);
          obj.rotation.y = rn() * 3;
          obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
          grp.add(obj);
          // 登记冠幅（局部坐标）：树冠会把蛋/牌整个罩住，上层要按这个半径避让
          {
            const bb = new THREE.Box3().setFromObject(obj);
            const rad = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
            world.decor.push({ x: sp[0], z: sp[1], r: rad + 0.35 });
          }
        }
        // 高楼：2-5 栋低模塔楼（城市感），带碰撞可绕行
        const bN = 8 + Math.floor(rn() * 9);
        for (let i = 0; i < bN; i++) {
          const sp = spot(r * 0.2, r * 0.75, r * 0.09, bw + 3.7);   // 塔身最宽 7：留出半宽不压墙
          if (!sp) continue;
          const w = 4 + rn() * 3, h = 14 + rn() * 12;
          const tower = cityTower(w, h, i);
          tower.position.set(sp[0], Y(sp[0], sp[1], 0), sp[1]);
          tower.rotation.y = rn() * 3;
          tower.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          grp.add(tower);
          colC(cx + sp[0], cz + sp[1], Math.max(w, 1.6) * 0.75, h);
        }
      }
    }
    const decoSpots = [];
    const treeN = isCity ? 3 : 7;
    for (let i = 0; i < treeN; i++) {
      const a = Math.PI * 2 * i / treeN + (r % 3) + 0.8;
      let tx = Math.cos(a) * (r - 3), tz = Math.sin(a) * (r - 3);
      // 装饰树钳进轮廓并留出墙厚+树冠：真实轮廓下 r-3 处多半已在院墙外甚至海里
      if (sim) [tx, tz] = clampPoly(sim, tx, tz, bw + 1.3);
      decoSpots.push([cx + tx, cz + tz]);
    }
    for (const [x, z] of decoSpots) {
      let obj = null;
      if (isl.style === 'pine') obj = PROPS.pine(0.9 + Math.random() * 0.4);
      else if (isl.style === 'house') obj = PROPS.bush(0.9 + Math.random() * 0.4);
      else obj = PROPS.tree(false);
      // 装饰树收进岛组（局部坐标）：整岛可一键显隐（远处雾里看不清就隐藏，省 draw call）
      obj.position.set(x - cx, Y(x - cx, z - cz, 0), z - cz);
      obj.rotation.y = Math.random() * 3;
      obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
      grp.add(obj);
      colC(x, z, 0.55);
    }
    // 返回台：发光圆环 + 小信标（也收进岛组）
    const pad = new THREE.Group();
    const ringP = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xFFC94E, transparent: true, opacity: 0.65, depthWrite: false }));
    ringP.position.y = 0.04;
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.28),
      M('#FFD34E', { emissive: '#FFC94E', ei: 0.7 }));
    beacon.position.y = 1.1;
    pad.add(ringP, beacon);
    pad.position.set(0, 0, -2.5);
    grp.add(pad);
    world.anim.islandPads = world.anim.islandPads || [];
    world.anim.islandPads.push({ ring: ringP, beacon });
    colC(cx, cz - 2.5, 0.8);
    // 城市广场：许愿井 + 任务板（主岛同款功能下沉到城，免跑回农场）
    let wellPos = null, boardPos = null;
    if (isCity) {
      const put = (dx, dz) => {
        let wx = cx + dx, wz = cz + dz;
        if (sim) [wx, wz] = clampPoly(sim, wx, wz, bw + 1.6);
        return [wx - cx, wz - cz, wx, wz];
      };
      const [wlx, wlz, wwx, wwz] = put(5, -6.5);
      const [blx, blz, bwx, bwz] = put(-5, -6.5);
      place(grp, PROPS.well(), wlx, wlz, -0.5, Y(wlx, wlz, 0));
      colC(wwx, wwz, 0.85);
      place(grp, PROPS.signboard(), blx, blz, 0.5, Y(blx, blz, 0));
      colC(bwx, bwz, 0.7);
      wellPos = { x: wwx, z: wwz };
      boardPos = { x: bwx, z: bwz };
    }
    grp.position.set(cx, 0, cz);
    scene.add(grp);
    // 大件装饰的"真实视觉占地"（局部坐标，按城键控）：碰撞体只覆盖一小圈，网格却大得多。
    // 蛋/立牌若只按碰撞体判"可站"，就会落进地标实心里——看着在塔里、判定却可站。
    // 只扫两层（顶层装饰 + 一级子组）：全层级 traverse 对 52 座岛太贵。
    const blockers = [];
    {
      const bb = new THREE.Box3(), ctr = new THREE.Vector3();
      const seen = new Set();
      const groups = [];
      for (const ch of grp.children) {
        groups.push(ch);
        if (ch.isGroup) for (const c2 of ch.children) if (c2.isGroup) groups.push(c2);
      }
      for (const ch of groups) {
        let n = 0; ch.traverse(o => { if (o.isMesh) n++; });
        if (n < 1) continue;
        bb.setFromObject(ch);
        const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
        const h = bb.max.y - bb.min.y;
        if (w < 0.8 || w > 30 || h < 1.0) continue;
        bb.getCenter(ctr);
        const key = ctr.x.toFixed(1) + ',' + ctr.z.toFixed(1) + ',' + w.toFixed(0);
        if (seen.has(key)) continue;
        seen.add(key);
        blockers.push({ x: +(ctr.x - cx).toFixed(2), z: +(ctr.z - cz).toFixed(2), r: +w.toFixed(2) });
      }
    }
    world.islands.push({ ...isl, grp, full: true, blockers, pad: { x: cx, z: cz - 2.5 }, wellPos, boardPos });
  };
  for (let si = 0; si < semIslands.length; si++) buildOne(semIslands[si], si);
  // 供奖励城市运行时补建精建岛（复用同一套碰撞/装饰闭包）；返回带 grp 的岛对象
  world.buildIsland = (isl) => {
    const before = world.islands.length;
    buildOne(isl, 0, true);
    return world.islands.length > before ? world.islands.pop() : { ...isl };
  };

  if (!cityOnly) {
  // ---- 小火车站（主岛，去群岛的入口） ----
  {
    const st = new THREE.Group();
    box(st, 2.6, 0.12, 1.4, '#C8A85C', 0, 0.3, 0);                 // 站台
    for (const sx of [-1, 1]) box(st, 0.1, 0.3, 1.4, '#A8863C', 1.3 * sx, 0.15, 0);
    for (const sx of [-1, 1]) cyl(st, 0.05, 0.06, 1.3, '#8A6844', 1.15 * sx, 0.85, -0.5);
    cone(st, 1.7, 0.6, '#D95F4B', 0, 1.75, -0.5, 0, Math.PI / 4, 0, 4); // 尖顶雨棚
    box(st, 1.4, 0.5, 0.08, '#FFFDF4', 0, 1.35, 0.55);             // 站牌
    badge(st, '🚂', 1.36, 0.16);
    st.traverse(o => { if (o.isMesh) o.castShadow = true; });
    st.position.set(-9, 0, 8);
    scene.add(st);
    colR(-10.2, 7.4, -7.8, 8.6, 0.8);
    world.gates.station = { group: st, pos: { x: -9, z: 9.6 } };
  }

  // ---- 🐾 词宠乐园（主岛西南角空地）：孵出的词宠的迷你分身住在这里，围栏一圈留北向门 ----
  {
    const RX = -12.5, RZ = 14.5, RR = 3.2;
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(RR, RR + 0.25, 0.14, 24), M('#BFE3A8'));
    lawn.position.set(RX, 0.07, RZ);
    lawn.receiveShadow = true;
    scene.add(lawn);
    // 木桩围栏：12 根桩 + 横杆，北向（z 减小方向）留 1.6 宽的门口
    const post = (x, z) => {
      const g = box(0.14, 0.8, 0.14, '#A9743F', x, 0.4, z);
      g.castShadow = true;
      scene.add(g);
      colC(x, z, 0.22);
      return g;
    };
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = RX + Math.cos(a) * RR, z = RZ + Math.sin(a) * RR;
      if (z < RZ - 2 && Math.abs(x - RX) < 1.4) continue;   // 北向门口不立桩
      post(x, z);
    }
    // 横杆（两圈，门口同样断开）：用细长盒沿弦近似
    for (const h of [0.28, 0.6]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(RR, 0.05, 6, 24, Math.PI * 2 * 0.86), M('#B9834C'));
      rail.position.set(RX, h, RZ);
      rail.rotation.x = Math.PI / 2;
      rail.rotation.z = Math.PI * 0.07;   // 缺口朝北
      scene.add(rail);
    }
    // 门牌：两柱一板，写"词宠乐园"
    const sign = new THREE.Group();
    sign.add(box(0.12, 1.1, 0.12, '#A9743F', -0.9, 0.55, 0));
    sign.add(box(0.12, 1.1, 0.12, '#A9743F', 0.9, 0.55, 0));
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.66, 0.1), M('#FFFDF8'));
    boardMesh.position.set(0, 1.15, 0);
    boardMesh.castShadow = true;
    const cnv = document.createElement('canvas');
    cnv.width = 256; cnv.height = 80;
    const c2 = cnv.getContext('2d');
    c2.fillStyle = '#FFFDF8'; c2.fillRect(0, 0, 256, 80);
    c2.font = '900 44px "Microsoft YaHei",sans-serif';
    c2.fillStyle = '#C4577E'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText('🐾 词宠乐园', 128, 42);
    boardMesh.material = [M('#E8D9C4'), M('#E8D9C4'), M('#E8D9C4'), M('#E8D9C4'), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cnv) }), M('#E8D9C4')];
    sign.add(boardMesh);
    sign.position.set(RX, 0, RZ - RR - 0.9);
    sign.rotation.y = 0;
    scene.add(sign);
    colC(RX - 0.9, RZ - RR - 0.9, 0.2);
    colC(RX + 0.9, RZ - RR - 0.9, 0.2);
    world.ranch = { x: RX, z: RZ, r: RR - 0.7 };
  }

  // ---- 装饰散布 ----
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 38;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(z) < 5.2) continue; // 别掉河里
    if (x > 19 && x < 29 && z > 18 && z < 26) continue; // 别进谷仓
    if (z > 36) continue;                              // 沙滩保持干净
    if (x < -37) continue;                             // 森林自己布置过了
    const roll = Math.random();
    if (roll < 0.45) place(scene, PROPS.flowerpatch(), x, z);
    else if (roll < 0.7) { place(scene, PROPS.rock(0.6 + Math.random() * 0.8), x, z); colC(x, z, 0.4); }
    else if (roll < 0.85) place(scene, PROPS.flowerpatch(), x, z);
  }

  }   // end !cityOnly（火车站与装饰散布到此为止）

  // ---- 关卡主题换装：新一关解锁时给目标区域整体布置装饰 + 氛围灯（真场景变化） ----
  // 装饰统一挂 dressing group：换关时清空重建，不与静态场景混在一起
  const dressing = new THREE.Group();
  scene.add(dressing);
  world.dressChapter = (x1, z1, x2, z2, theme) => {
    const accent = theme && theme.accent || '#FF8FB0';
    while (dressing.children.length) dressing.remove(dressing.children[0]);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const w = Math.min(x2 - x1, 24), d = Math.min(z2 - z1, 24);
    // 位置收进可玩半径，别把旗杆插进海里
    const clampR = (x, z) => {
      const r = Math.hypot(x, z);
      if (r <= 48) return [x, z];
      return [x * 48 / r, z * 48 / r];
    };
    // 彩旗串：两条横跨区域的弧形旗绳 + 三色小三角旗
    const flagColors = [accent, '#FFE08A', '#8FD08F', '#7EC4F2', '#FF9F68'];
    const bunting = (ax, az, bx, bz, n = 9) => {
      const g = new THREE.Group();
      const hA = 2.6, hB = 2.6;
      cyl(g, 0.045, 0.055, hA, '#C89A6B', ax, hA / 2, az, 0, 0, 0, 8);
      cyl(g, 0.045, 0.055, hB, '#C89A6B', bx, hB / 2, bz, 0, 0, 0, 8);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const sag = Math.sin(t * Math.PI) * 0.55;          // 旗绳下垂
        const y = hA + (hB - hA) * t - sag;
        const flag = cone(g, 0.13, 0.3, flagColors[i % flagColors.length], x, y, z, Math.PI, 0, 0, 4);
        flag.rotation.x = Math.PI;                          // 旗尖朝下
        flag.castShadow = false;
      }
      g.traverse(o => { if (o.isMesh) { o.castShadow = o.geometry.type !== 'ConeGeometry'; } });
      dressing.add(g);
    };
    const [ax, az] = clampR(x1 + w * 0.12, z1 + d * 0.12);
    const [bx, bz] = clampR(x2 - w * 0.12, z1 + d * 0.12);
    bunting(ax, az, bx, bz);
    const [cx1, cz1] = clampR(x1 + w * 0.12, z2 - d * 0.12);
    const [dx1, dz1] = clampR(x2 - w * 0.12, z2 - d * 0.12);
    bunting(cx1, cz1, dx1, dz1);
    // 四角主题色气球柱（球 + 细绳 + 短杆）
    for (const [gx, gz] of [[x1 + 1, z1 + 1], [x2 - 1, z1 + 1], [x1 + 1, z2 - 1], [x2 - 1, z2 - 1]]) {
      const [px, pz] = clampR(gx, gz);
      const g = new THREE.Group();
      cyl(g, 0.03, 0.03, 1.1, '#E8DCC8', 0, 0.55, 0, 0, 0, 0, 6);
      sph(g, 0.34, accent, 0, 1.35, 0, 1, 1.2, 1);
      dressing.add(g);
      g.position.set(px, 0, pz);
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    }
    // 主题花丛：sunflower/flowerpatch 沿边撒一圈
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const [px, pz] = clampR(x1 + (x2 - x1) * t, z1 + (i % 2 ? -0.4 : d + 0.4));
      place(dressing, i % 2 ? PROPS.flowerpatch() : PROPS.sunflower(), px, pz, Math.random() * 3);
    }
    dressing.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
    // 氛围灯：accent 色低强度点光（每关只有这一盏，手机也扛得住）
    const light = new THREE.PointLight(new THREE.Color(accent), 6, 18, 1.6);
    light.position.set(cx, 3.2, cz);
    dressing.add(light);
  };

  return world;
}

// 大蘑菇（森林装饰，无脸）
function bigMushroom(s = 1) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 10), M('#FFF0DC'));
  stem.position.y = 0.25; stem.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), M(['#E86A5A', '#B28FF5', '#FF9A3C'][Math.floor(Math.random() * 3)]));
  cap.position.y = 0.52; cap.scale.y = 0.62; cap.castShadow = true;
  g.add(stem, cap);
  for (let i = 0; i < 4; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M('#FFF6EC'));
    const a = Math.PI * 2 * i / 4 + Math.random();
    dot.position.set(Math.cos(a) * 0.18, 0.62, Math.sin(a) * 0.18);
    dot.scale.y = 0.5;
    g.add(dot);
  }
  g.scale.setScalar(s);
  return g;
}

// ============ 城市地标原型：9 种程序化低模拼装（cities.js 按 landmark 类型选用） ============
// opts（可选）：{ key, onSwap(group) }。key = "城市#槽位"，用于查烘焙资产（scripts/bake/landmarks.py）；
// 下面这些程序化拼装是占位 + 回退实现，GLB 到位后原地替换（见 js/assets.js）
export function cityLandmark(type, color, seedStr, img, opts) {
  const g = new THREE.Group();
  const glow = () => M(color, { emissive: color, ei: 0.35 });
  // 大学校门：一校一门（招牌门 + 风格族），造型库 js/uni-gate-models.js / 数据 js/uni-gates.js
  // 构建完直接返回：不落入下方地标 else 链的 harbor 兜底（否则每座校门会被塞进一座灯塔）
  if (type === 'uni-gate') {
    buildUniGate(g, seedStr, img);             // 程序化门身：GLB 未到位/载入失败时它就是最终形态
    attachGateAsset(g, seedStr, img, opts);    // 烘焙资产到位后原地替换（只换 children，Group 不动）
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  if (type === 'gate') {
    // 城楼：城墙台 + 门洞 + 两层飞檐（北京/西安）
    box(g, 6, 2.2, 2.4, '#B08858', 0, 1.1, 0);
    box(g, 1.8, 1.5, 0.25, '#4A3626', 0, 0.75, 1.2);
    box(g, 7, 0.35, 3, '#8A5A38', 0, 2.4, 0);
    box(g, 5, 1.5, 2.2, '#B0483A', 0, 3.3, 0);
    box(g, 5.8, 0.3, 2.8, '#E8C86A', 0, 4.25, 0);
    box(g, 3.6, 0.9, 1.6, '#B0483A', 0, 4.85, 0);
    box(g, 4.2, 0.28, 2, '#E8C86A', 0, 5.45, 0);
  } else if (type === 'tower') {
    // 球串塔（上海/广州/合肥）
    cyl(g, 0.55, 1, 6.5, '#C8D8E8', 0, 3.25, 0, 0, 0, 0, 10);
    sph(g, 1.6, glow(), 0, 4.6, 0);
    cyl(g, 0.35, 0.5, 3.4, '#C8D8E8', 0, 8, 0, 0, 0, 0, 8);
    sph(g, 1.15, glow(), 0, 10.1, 0);
    cyl(g, 0.14, 0.14, 1.6, '#C8D8E8', 0, 11.4, 0, 0, 0, 0, 6);
    sph(g, 0.5, glow(), 0, 12.4, 0);
  } else if (type === 'wall') {
    // 长城垛口（南京/西安/石家庄）
    box(g, 14, 1.9, 2.2, '#9A8A6B', 0, 0.95, 0);
    for (let i = -3; i <= 3; i++) box(g, 0.7, 0.55, 2.2, '#9A8A6B', i * 2, 2.15, 0);
    box(g, 6, 1.6, 2.2, '#9A8A6B', 4.5, 2.4, 0);
    box(g, 4.2, 0.5, 3, '#E8C86A', 0, 3.4, 0);
  } else if (type === 'panda') {
    // 大熊猫：白身黑耳黑眼圈，怀里抱根竹子（成都）
    sph(g, 1.5, '#F5F1E8', 0, 1.3, 0);
    sph(g, 0.95, '#F5F1E8', 0, 2.8, 0.25);
    sph(g, 0.28, '#2A2A2A', -0.52, 3.68, 0.25);
    sph(g, 0.28, '#2A2A2A', 0.52, 3.68, 0.25);
    sph(g, 0.17, '#2A2A2A', -0.38, 2.96, 1.1);
    sph(g, 0.17, '#2A2A2A', 0.38, 2.96, 1.1);
    sph(g, 0.11, '#2A2A2A', 0, 2.7, 1.18);
    sph(g, 0.44, '#2A2A2A', -1.6, 1.55, 0.25);
    sph(g, 0.44, '#2A2A2A', 1.6, 1.55, 0.25);
    cyl(g, 0.09, 0.09, 1.6, '#7CBB5E', 0.95, 1.55, 1.42, 0, 0, 0, 8);
  } else if (type === 'ice') {
    // 冰雕塔（哈尔滨）：半透明尖塔群
    const iceM = new THREE.MeshStandardMaterial({ color: 0xA8D8FF, roughness: 0.15, transparent: true, opacity: 0.8, emissive: 0x4E9EE8, emissiveIntensity: 0.45 });
    const t1 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 8), iceM); t1.position.y = 2.5; g.add(t1);
    const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 8), iceM); t2.position.set(1.6, 1.8, 0.5); g.add(t2);
    const t3 = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 8), iceM); t3.position.set(-1.5, 1.3, 0.4); g.add(t3);
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), iceM); b1.position.set(-0.8, 0.55, 1); g.add(b1);
  } else if (type === 'palm') {
    // 椰林海滩（三亚/海口）
    place(g, PROPS.palm(1.1), 0, 0);
    place(g, PROPS.palm(0.85), 2.2, 0.8);
    place(g, PROPS.palm(0.7), -2, 0.6);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20).rotateX(-Math.PI / 2), M('#EFDCA8'));
    sand.position.y = 0.02; g.add(sand);
  } else if (type === 'dome') {
    // 圆顶（呼和浩特/乌鲁木齐/银川：蒙古包+尖）
    cyl(g, 2.2, 2.4, 1.4, '#F5F1E8', 0, 0.7, 0, 0, 0, 0, 14);
    sph(g, 2.2, glow(), 0, 1.4, 0, 1, 0.6, 1);
    cyl(g, 0.1, 0.1, 1, '#E8C86A', 0, 2.6, 0, 0, 0, 0, 6);
    sph(g, 0.22, M('#E8C86A'), 0, 3.15, 0);
  } else if (type === 'mountain') {
    // 山形（重庆/桂林/拉萨/贵阳…）：三峰 + 雪顶/青山
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(3, 5.2, 7), M('#6FAF6B')); c1.position.set(-1.6, 2.6, -0.4); g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 7), M('#5E9E5E')); c2.position.set(1.2, 3.5, 0.3); g.add(c2);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.7, 7), M('#FFFFFF')); snow.position.set(1.2, 5.6, 0.3); g.add(snow);
    const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.6, 7), M('#7CBF74')); c3.position.set(2.9, 1.8, -0.6); g.add(c3);
  } else if (type === 'pavilion') {
    // 亭子（杭州/济南/丽江…）：四柱 + 攒尖顶 + 基座
    cyl(g, 2.4, 2.6, 0.35, '#C8B898', 0, 0.18, 0, 0, 0, 0, 12);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.09, 0.09, 1.7, '#B0483A', px, 1.2, pz, 0, 0, 0, 6);
    cone(g, 2.1, 1.1, '#B0483A', 0, 2.55, 0, 0, 0, 0, 10);
    sph(g, 0.18, M('#E8C86A'), 0, 3.15, 0);
    box(g, 1.5, 0.08, 0.3, '#B0483A', 0, 1.9, 1.02);
  } else if (type === 'grotto') {
    // 大佛（洛阳/敦煌）：崖壁坐佛
    box(g, 4.6, 3.4, 1.2, '#B09A78', 0, 1.7, -0.6);
    sph(g, 0.75, M('#D8C8A8'), 0, 2.6, 0.35);
    cyl(g, 1.05, 1.25, 1.5, '#D8C8A8', 0, 1.15, 0.35, 0, 0, 0, 12);
    sph(g, 0.3, M('#6B5844'), 0, 2.75, 0.95);
    sph(g, 0.3, M('#6B5844'), 0, 3.25, -0.2);
  } else {
    // harbor：灯塔 + 小船（天津/青岛/大连等沿海城市）
    cyl(g, 0.5, 0.65, 3.6, '#F5F1E8', 0, 1.8, 0, 0, 0, 0, 10);
    cyl(g, 0.62, 0.62, 0.5, '#D95F4B', 0, 0.5, 0, 0, 0, 0, 10);
    cyl(g, 0.62, 0.62, 0.5, '#D95F4B', 0, 2.8, 0, 0, 0, 0, 10);
    sph(g, 0.34, glow(), 0, 3.75, 0);
    box(g, 1.6, 0.3, 0.7, '#B08858', 2.4, 0.15, 1.2);
    box(g, 0.9, 0.75, 0.5, '#F5F1E8', 2.4, 0.65, 1.2);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // 烘焙资产到位后原地替换（只换 children；调用方挂在 lm 上的欢迎牌 sprite 标了 keep 不会被清）
  if (opts && opts.key) {
    g.userData.lm = { key: opts.key, type };   // 运行时标记：换装自检/调试能直接认出地标组
    assets.apply(g, 'landmark', opts.key, opts);
  }
  return g;
}
