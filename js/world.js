// 农场岛屿世界搭建：地形彩绘、河流、果园、风车田、谷仓、菜园、天空岛、阳光海滩、神秘森林、环形群岛
import * as THREE from 'three';
import { PROPS, badge, letterTexture } from './models.js';
import { ISLANDS } from './words.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.rough ?? 0.9, metalness: 0,
  emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: !!o.alpha, opacity: o.alpha ?? 1, side: o.side ?? THREE.FrontSide,
});

// 城市岛地面贴图：草底 + 城市色分区 + 环形大道 + 十字街 + 中心广场（地图式画法：路缘+路面+中心虚线）
function cityIslandTexture(color, level) {
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
  // 画路工具：地图式三笔（路缘/路面/中心虚线）
  const road = pts => {
    const draw = () => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(158,120,86,.8)'; c.lineWidth = S * 0.052; draw(); c.stroke();
    c.strokeStyle = '#EBD3A9'; c.lineWidth = S * 0.042; draw(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = S * 0.006;
    c.setLineDash([S * 0.022, S * 0.018]); draw(); c.stroke();
    c.setLineDash([]);
  };
  // 环形大道（0.6 半径）+ 十字街 + 中心广场环
  const ring = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 24) ring.push([C + Math.cos(a) * S * 0.3, C + Math.sin(a) * S * 0.3]);
  road(ring);
  road([[C, S * 0.06], [C, S * 0.94]]);
  road([[S * 0.06, C], [S * 0.94, C]]);
  // 中心广场
  c.strokeStyle = 'rgba(158,120,86,.6)'; c.lineWidth = S * 0.02;
  c.beginPath(); c.arc(C, C, S * 0.1, 0, Math.PI * 2); c.stroke();
  c.fillStyle = color; c.globalAlpha = 0.28;
  c.beginPath(); c.arc(C, C, S * 0.088, 0, Math.PI * 2); c.fill();
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

export function buildWorld(scene, semIslands = ISLANDS, opts = {}) {
  const world = { colliders: [], anim: {}, gates: {}, platforms: [] };
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
    grad.addColorStop(0.82, '#FDF3D8');
    grad.addColorStop(1, '#FFE3EC');
    c.fillStyle = grad;
    c.fillRect(0, 0, 2, 256);
  }
  const skyTex = new THREE.CanvasTexture(skyCv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(dome);
  const cityOnly0 = !!semIslands.length && semIslands[0].level != null;
  scene.fog = cityOnly0 ? new THREE.Fog(0xDFF3EC, 90, 420) : new THREE.Fog(0xDFF3EC, 42, 150);

  // ---- 太阳（亮核 + 光晕） ----
  const sunDir = new THREE.Vector3(18, 30, 12).normalize();
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,252,238,1)', 'rgba(255,240,190,0)'), fog: false,
    depthWrite: false, transparent: true,
  }));
  sunCore.position.copy(sunDir).multiplyScalar(118);
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
  const hemi = new THREE.HemisphereLight(0xFFF6E8, 0x9CC98F, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFF2DC, 2.1);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = cityOnly0 ? 400 : 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;          // 阴影边缘更柔，画面更干净
  scene.add(sun);
  // 昼夜循环：game 层每帧按真实时间移动日月、调光照与雾色
  world.anim.dayNight = { sunCore, sunHalo, moon, sun, hemi, dome, fog: scene.fog };
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
  sea.position.y = -0.14;
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
    const grp = new THREE.Group();
    if (!forceFull && focus >= 0 && Math.abs(si - focus) > 1) {
      const lt = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 6, 20),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#9CCF8C'), 0.55), roughness: 0.95 }));
      lt.position.y = -3; grp.add(lt);
      const lr = new THREE.Mesh(new THREE.ConeGeometry(r * 0.92, r * 0.9, 20), M('#A8825B'));
      lr.rotation.x = Math.PI; lr.position.y = -6 - r * 0.45; grp.add(lr);
      const ln = new THREE.Sprite(letterTexture(isl.name || '', color, '#FFFDF4'));
      ln.scale.set(3.4, 0.95, 1); ln.position.set(0, 4.5, 0); grp.add(ln);
      grp.position.set(cx, 0, cz); scene.add(grp);
      world.islands.push({ ...isl, grp, light: true });
      return;
    }
    // 岛身：按城市轮廓多边形生成（顶面贴图 UV 按包围盒映射，岩裙沿边下垂）
    if (isl.shape) {
      const pts = isl.shape;                      // 已是世界坐标（含 cx/cz 偏移的局部点）
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
      const geo = new THREE.ShapeGeometry(shape, 24);
      // 顶面贴图：UV 按包围盒归一化，环道/街纹理才能对上
      // 注意：ShapeGeometry 顶点是 (x, y, 0)，多边形的"z"存在 y 分量里
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (pos.getX(i) - minX) / (maxX - minX), 1 - (pos.getY(i) - minZ) / (maxZ - minZ));
      }
      const top0 = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: cityIslandTexture(color, isl.level), roughness: 0.95 }));
      top0.rotation.x = -Math.PI / 2;
      top0.position.y = 0.02;
      top0.receiveShadow = true;
      grp.add(top0);
      // 岩裙：沿轮廓边垂直下垂到 -7，再收到中心形成倒锥岩底
      const skirtPos = [], skirtIdx = [];
      const sink = -3.2;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const k = skirtPos.length / 3;
        skirtPos.push(ax, 0, az, bx, 0, bz, ax * 0.8, sink, az * 0.8, bx * 0.8, sink, bz * 0.8);
        skirtIdx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
      sg.setIndex(skirtIdx);
      sg.computeVertexNormals();
      const skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xA8825B, roughness: 1, side: THREE.DoubleSide }));
      grp.add(skirt);
      world.cityBounds = world.cityBounds || {};
      world.cityBounds[key] = { pts, minX, maxX, minZ, maxZ, cx, cz };
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
    // 岛边浪花：圆环兜底；多边形轮廓暂不撒环（沿边浪花后续做）
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
        new THREE.MeshStandardMaterial({ map: cityIslandTexture(color, isl.level), roughness: 0.95 }));
      top0.position.y = 0.02;
      top0.receiveShadow = true;
      grp.add(top0);
      }
      // 多地标组合：主地标居中，其余按角度分布（level.landmarks 配置）
      const lms = (isl.level && isl.level.landmarks && isl.level.landmarks.length)
        ? isl.level.landmarks : [isl.landmark, 'pavilion'];
      lms.forEach((type, i) => {
        if (i > 0 && type === lms[0]) return;
        const a = (i / Math.max(1, lms.length)) * Math.PI * 2 + 1.1;
        const rr = i === 0 ? 0 : r * 0.56;
        const lm = cityLandmark(type, color);
        lm.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
        lm.scale.setScalar(i === 0 ? 1 : 0.78);
        lm.rotation.y = -a + Math.PI;
        lm.traverse(o => { if (o.isMesh) o.castShadow = true; });
        grp.add(lm);
        colC(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, i === 0 ? 1.4 : 1.0);
      });
      // 观景石台：天空词蛋放上面，跳上去够得着
      box(grp, 1.6, 3.2, 1.6, '#C8B898', r * 0.3, 1.6, -r * 0.3);
      box(grp, 2.1, 0.3, 2.1, '#D8CCA8', r * 0.3, 3.3, -r * 0.3);
      colTop(cx + r * 0.3, cz - r * 0.3, 1.15, 3.45);
      // 中英文城市名牌
      const sign = new THREE.Sprite(letterTexture(isl.name || '', color, '#FFFDF4'));
      sign.scale.set(3.4, 0.95, 1);
      sign.position.set(0, 3.1, r * 0.42);
      const signEn = new THREE.Sprite(letterTexture((isl.en || '').toUpperCase(), '#FFFDF4', '#6B5844'));
      signEn.scale.set(2.6, 0.55, 1);
      signEn.position.set(0, 2.35, r * 0.42);
      grp.add(sign, signEn);
      // 特产装饰 emoji 撒一圈（随到访版本的城市特色）
      (isl.decos || ['🏮']).forEach((em, i) => {
        const a = Math.PI * 2 * i / Math.max(1, isl.decos.length) + 0.4;
        const s = new THREE.Sprite(letterTexture(em, '#FFFDF4', '#6B5844'));
        s.scale.setScalar(0.9);
        s.position.set(Math.cos(a) * (r - 3), 0.6, Math.sin(a) * (r - 3));
        grp.add(s);
      });
      // 花丛点缀：环路四个象限
      if (PROPS.flowerpatch) for (const [dx, dz] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) {
        const fp = PROPS.flowerpatch();
        fp.position.set(dx * r, 0, dz * r);
        grp.add(fp);
      }
    }
    const decoSpots = [];
    const treeN = isCity ? 3 : 7;
    for (let i = 0; i < treeN; i++) {
      const a = Math.PI * 2 * i / treeN + (r % 3) + 0.8;
      decoSpots.push([cx + Math.cos(a) * (r - 3), cz + Math.sin(a) * (r - 3)]);
    }
    for (const [x, z] of decoSpots) {
      let obj = null;
      if (isl.style === 'pine') obj = PROPS.pine(0.9 + Math.random() * 0.4);
      else if (isl.style === 'house') obj = PROPS.bush(0.9 + Math.random() * 0.4);
      else obj = PROPS.tree(false);
      // 装饰树收进岛组（局部坐标）：整岛可一键显隐（远处雾里看不清就隐藏，省 draw call）
      obj.position.set(x - cx, 0, z - cz);
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
    grp.position.set(cx, 0, cz);
    scene.add(grp);
    world.islands.push({ ...isl, grp, pad: { x: cx, z: cz - 2.5 } });
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
export function cityLandmark(type, color) {
  const g = new THREE.Group();
  const glow = () => M(color, { emissive: color, ei: 0.35 });
    // uni-gate：大学校门（双柱+横梁+门楣校牌），牌子系统用于大学，真实感拉满
    if (type === 'uni-gate') {
      box(g, 0.55, 3.2, 0.55, '#F5F1E8', -1.5, 1.6, 0);
      box(g, 0.55, 3.2, 0.55, '#F5F1E8', 1.5, 1.6, 0);
      box(g, 0.62, 0.35, 0.62, '#3E7CB1', -1.5, 3.35, 0);
      box(g, 0.62, 0.35, 0.62, '#3E7CB1', 1.5, 3.35, 0);
      box(g, 4.2, 0.5, 0.5, '#3E7CB1', 0, 3.6, 0);
      box(g, 4.2, 0.16, 0.56, '#FFFDF4', 0, 3.15, 0);
      box(g, 0.16, 0.9, 0.4, '#8A8A8A', -0.5, 0.45, 0);
      box(g, 0.16, 0.9, 0.4, '#8A8A8A', 0.5, 0.45, 0);
      box(g, 2.4, 0.1, 1.2, '#D8CCA8', 0, 0.05, 0.4);
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
    cyl(g, 0.55, 1, 6.5, '#C8D8E8', 0, 3.25, 0, 10);
    sph(g, 1.6, glow(), 0, 4.6, 0);
    cyl(g, 0.35, 0.5, 3.4, '#C8D8E8', 0, 8, 0, 8);
    sph(g, 1.15, glow(), 0, 10.1, 0);
    cyl(g, 0.14, 0.14, 1.6, '#C8D8E8', 0, 11.4, 0, 6);
    sph(g, 0.5, glow(), 0, 12.4, 0);
  } else if (type === 'wall') {
    // 长城垛口（南京/西安/石家庄）
    box(g, 14, 1.9, 2.2, '#9A8A6B', 0, 0.95, 0);
    for (let i = -3; i <= 3; i++) box(g, 0.7, 0.55, 2.2, '#9A8A6B', i * 2, 2.15, 0);
    box(g, 6, 1.6, 2.2, '#9A8A6B', 4.5, 2.4, 0);
    box(g, 4.2, 0.5, 3, '#E8C86A', 0, 3.4, 0);
  } else if (type === 'panda') {
    // 大熊猫：白身黑耳黑眼圈，怀里抱根竹子（成都）
    sph(g, 1.5, M('#F5F1E8'), 0, 1.3, 0);
    sph(g, 0.95, M('#F5F1E8'), 0, 2.8, 0.25);
    sph(g, 0.26, M('#2A2A2A'), -0.55, 3.5, 0.1);
    sph(g, 0.26, M('#2A2A2A'), 0.55, 3.5, 0.1);
    sph(g, 0.14, M('#2A2A2A'), -0.32, 2.9, 0.62);
    sph(g, 0.14, M('#2A2A2A'), 0.32, 2.9, 0.62);
    sph(g, 0.12, M('#2A2A2A'), 0, 3.02, 0.75);
    sph(g, 0.5, M('#2A2A2A'), -1.35, 1.5, 0.3);
    sph(g, 0.5, M('#2A2A2A'), 1.35, 1.5, 0.3);
    cyl(g, 0.09, 0.09, 1.6, '#7CBB5E', 0.85, 1.6, 0.75, 8);
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
    cyl(g, 2.2, 2.4, 1.4, '#F5F1E8', 0, 0.7, 0, 14);
    sph(g, 2.2, glow(), 0, 1.4, 0, 1, 0.6, 1);
    cyl(g, 0.1, 0.1, 1, '#E8C86A', 0, 2.6, 0, 6);
    sph(g, 0.22, M('#E8C86A'), 0, 3.15, 0);
  } else if (type === 'mountain') {
    // 山形（重庆/桂林/拉萨/贵阳…）：三峰 + 雪顶/青山
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(3, 5.2, 7), M('#6FAF6B')); c1.position.set(-1.6, 2.6, -0.4); g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 7), M('#5E9E5E')); c2.position.set(1.2, 3.5, 0.3); g.add(c2);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.7, 7), M('#FFFFFF')); snow.position.set(1.2, 5.6, 0.3); g.add(snow);
    const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.6, 7), M('#7CBF74')); c3.position.set(2.9, 1.8, -0.6); g.add(c3);
  } else if (type === 'pavilion') {
    // 亭子（杭州/济南/丽江…）：四柱 + 攒尖顶 + 基座
    cyl(g, 2.4, 2.6, 0.35, '#C8B898', 0, 0.18, 0, 12);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, 0.09, 0.09, 1.7, '#B0483A', px, 1.2, pz, 6);
    cone(g, 2.1, 1.1, '#B0483A', 0, 2.55, 0, 0, 0, 0, 10);
    sph(g, 0.18, M('#E8C86A'), 0, 3.15, 0);
    box(g, 1.5, 0.08, 0.3, '#B0483A', 0, 1.9, 1.02);
  } else if (type === 'grotto') {
    // 大佛（洛阳/敦煌）：崖壁坐佛
    box(g, 4.6, 3.4, 1.2, '#B09A78', 0, 1.7, -0.6);
    sph(g, 0.75, M('#D8C8A8'), 0, 2.6, 0.35);
    cyl(g, 1.05, 1.25, 1.5, '#D8C8A8', 0, 1.15, 0.35, 12);
    sph(g, 0.3, M('#6B5844'), 0, 2.75, 0.95);
    sph(g, 0.3, M('#6B5844'), 0, 3.25, -0.2);
  } else {
    // harbor：灯塔 + 小船（天津/青岛/大连等沿海城市）
    cyl(g, 0.5, 0.65, 3.6, '#F5F1E8', 0, 1.8, 0, 10);
    cyl(g, 0.62, 0.62, 0.5, '#D95F4B', 0, 0.5, 0, 10);
    cyl(g, 0.62, 0.62, 0.5, '#D95F4B', 0, 2.8, 0, 10);
    sph(g, 0.34, glow(), 0, 3.75, 0);
    box(g, 1.6, 0.3, 0.7, '#B08858', 2.4, 0.15, 1.2);
    box(g, 0.9, 0.75, 0.5, '#F5F1E8', 2.4, 0.65, 1.2);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
