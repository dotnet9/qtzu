// 程序化低模库：词宠 / 玩家 / 场景物
// 风格：Q 版大头、马卡龙配色、点睛小表情（黑豆眼 + 高光 + 腮红）
import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
  emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: !!o.alpha, opacity: o.alpha ?? 1,
  flatShading: !!o.flat, side: o.side ?? THREE.FrontSide,
});

function add(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}
const G = () => new THREE.Group();
const sph = (g, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o) => add(g, new THREE.SphereGeometry(r, 18, 14), M(c, o), x, y, z, 0, 0, 0, sx, sy, sz);
const box = (g, w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0, o) => add(g, new THREE.BoxGeometry(w, h, d), M(c, o), x, y, z, rx, ry, rz);
const cyl = (g, rt, rb, h, c, x, y, z, rx = 0, ry = 0, rz = 0, seg = 14, o) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), M(c, o), x, y, z, rx, ry, rz);
const cone = (g, r, h, c, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12, o) => cyl(g, 0.001, r, h, c, x, y, z, rx, ry, rz, seg, o);
const cap = (g, r, len, c, x, y, z, rx = 0, ry = 0, rz = 0, o) => add(g, new THREE.CapsuleGeometry(r, len, 6, 12), M(c, o), x, y, z, rx, ry, rz);
const tor = (g, R, r, c, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, o) => add(g, new THREE.TorusGeometry(R, r, 10, 24, arc), M(c, o), x, y, z, rx, ry, rz);

// 小表情：黑豆眼 + 高光 + 腮红（挂在 z 正面）
function face(g, { dx = 0.07, y = 0.02, z = 0.16, s = 1, blush = 0.12, by = -0.05 } = {}) {
  for (const sx of [-1, 1]) {
    sph(g, 0.030 * s, '#4A4046', dx * sx, y, z, 1, 1.35, 0.55);
    sph(g, 0.010 * s, '#FFFFFF', dx * sx + 0.011 * s, y + 0.032 * s, z + 0.014);
    sph(g, 0.036 * s, '#FFB3C1', blush * sx, by, z * 0.86, 1, 0.7, 0.4);
  }
}

export const PET_COLORS = {
  cat: '#F5A25D', dog: '#E8C48A', duck: '#FFD44E', rabbit: '#FFF6F0', mouse: '#B9B9C8',
  frog: '#7CC96F', flower: '#FF8FB0', grass: '#7CC96F', boat: '#C89A6B', light: '#FFD34E',
  seed: '#8FBF6F', apple: '#FF6B6B', banana: '#FFE24E', carrot: '#FF9A3C', tomato: '#FF5F5F',
  potato: '#C9A46B', corn: '#FFD34E', goat: '#CFC8BC', wind: '#A8D8F0', pig: '#FFB6C5',
  cow: '#FFF6EC', bird: '#7EC4F2', bee: '#FFD34E', horse: '#A9744F', sheep: '#FFF3E0',
  hen: '#FFF0DC', milk: '#FFFFFF', bread: '#D9A05B', egg: '#FFF8EE', cake: '#FFB7CB',
  tractor: '#6FA854', rain: '#BDE3F0', tree: '#6FBF73', sun: '#FFC94E', star: '#FFE24E',
  moon: '#F5E6A8',
  fish: '#FF8A5C', whale: '#7EB8E0', crab: '#F0604A', shell: '#FFC9D6', starfish: '#FF9A5C',
  ship: '#E86A4A', ball: '#FFF6EC', kite: '#FF8FB0', sand: '#F0D9A0', wave: '#8FD0E8',
  sea: '#4A9ED9', icecream: '#FFB7CB', bear: '#A9744F', fox: '#F0864A', owl: '#B08860',
  monkey: '#A8825B', squirrel: '#D98A4A', panda: '#FFF6EC', deer: '#C99A5F', mushroom: '#E86A5A',
  leaf: '#8FD08F', stone: '#B0B0BC', nest: '#C9A46B', wood: '#A87551',
};

// ================= 四足兽基础 =================
function quadBody(g, { bc, bodyR = 0.16, bodyLen = 1.3, legH = 0.12, legC, headR = 0.19, headY, headZ }) {
  cap(g, bodyR, 0.16 * bodyLen, bc, 0, legH + bodyR * 0.9, 0, Math.PI / 2, 0, 0).scale.y = bodyLen; // 身体（沿 z）
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
    cyl(g, 0.045, 0.05, legH, legC || bc, 0.1 * lx, legH / 2, 0.13 * bodyLen * lz * 0.8);
  const head = G();
  head.position.set(0, headY ?? (legH + bodyR + headR * 0.55), headZ ?? (0.22 * bodyLen));
  g.add(head);
  return head;
}

const PETS = {};

PETS.cat = () => {
  const g = G(), c = PET_COLORS.cat;
  const head = quadBody(g, { bc: c, headZ: 0.2 });
  sph(head, 0.19, c);
  for (const sx of [-1, 1]) cone(head, 0.06, 0.11, c, 0.11 * sx, 0.17, 0, 0, 0, 0.3 * sx);
  face(head, { y: 0.01, z: 0.165 });
  cone(head, 0.012, 0.04, '#E8875A', 0, -0.015, 0.19, Math.PI / 2); // 小鼻子
  cap(g, 0.03, 0.16, c, 0, 0.32, -0.2, -Math.PI / 3).scale.set(1, 1, 0.6); // 竖尾巴
  return g;
};

PETS.dog = () => {
  const g = G(), c = PET_COLORS.dog;
  const head = quadBody(g, { bc: c, bodyR: 0.17, headR: 0.2 });
  sph(head, 0.2, c);
  for (const sx of [-1, 1]) sph(head, 0.07, '#8A6844', 0.15 * sx, 0.03, 0.02, 1, 1.6, 0.5); // 垂耳
  sph(head, 0.06, '#FFF6EC', 0, -0.05, 0.18, 1, 0.8, 0.8); // 口鼻
  face(head, { y: 0.03, z: 0.175 });
  sph(g, 0.06, c, 0, 0.33, -0.24, 1, 1, 1.4); // 尾巴
  return g;
};

PETS.duck = () => {
  const g = G(), c = PET_COLORS.duck;
  sph(g, 0.17, c, 0, 0.2, -0.04, 1, 1, 1.2); // 身体
  cyl(g, 0.04, 0.045, 0.1, '#FF9A3C', 0.08, 0.05, -0.1); cyl(g, 0.04, 0.045, 0.1, '#FF9A3C', -0.08, 0.05, -0.1);
  const head = G(); head.position.set(0, 0.42, 0.08); g.add(head);
  sph(head, 0.14, c);
  cone(head, 0.05, 0.09, '#FF9A3C', 0, -0.01, 0.15, Math.PI / 2);
  face(head, { dx: 0.055, z: 0.12 });
  return g;
};

PETS.rabbit = () => {
  const g = G(), c = PET_COLORS.rabbit;
  sph(g, 0.16, c, 0, 0.18, -0.03, 1, 1.05, 1.25);
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cyl(g, 0.035, 0.04, 0.09, c, 0.08 * lx, 0.045, 0.1 * lz);
  const head = G(); head.position.set(0, 0.38, 0.09); g.add(head);
  sph(head, 0.15, c);
  for (const sx of [-1, 1]) {
    cap(head, 0.05, 0.14, c, 0.065 * sx, 0.2, -0.01, 0, 0, 0.12 * sx).scale.z = 0.5;
    sph(head, 0.03, '#FFC9D6', 0.068 * sx, 0.2, 0.022, 1, 1, 0.35, );
  }
  sph(head, 0.025, '#FF9FB6', 0, -0.01, 0.145);
  face(head, { y: 0.03, z: 0.135 });
  sph(g, 0.055, c, 0, 0.2, -0.2);
  return g;
};

PETS.mouse = () => {
  const g = G(), c = PET_COLORS.mouse;
  sph(g, 0.13, c, 0, 0.14, -0.02, 1, 1, 1.25);
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cyl(g, 0.025, 0.03, 0.07, c, 0.065 * lx, 0.035, 0.08 * lz);
  const head = G(); head.position.set(0, 0.3, 0.08); g.add(head);
  sph(head, 0.12, c);
  for (const sx of [-1, 1]) sph(head, 0.08, '#FFD9DF', 0.1 * sx, 0.06, -0.01, 1, 1, 0.35); // 大圆耳
  face(head, { dx: 0.05, y: 0, z: 0.11, s: 0.9 });
  cone(head, 0.014, 0.05, '#8E8EA0', 0, -0.01, 0.13, Math.PI / 2);
  tor(g, 0.09, 0.018, '#C9C9D6', 0, 0.17, -0.16, Math.PI / 2, 0, 0, Math.PI * 1.3); // 卷尾巴
  return g;
};

PETS.frog = () => {
  const g = G(), c = PET_COLORS.frog;
  sph(g, 0.19, c, 0, 0.13, 0, 1.05, 0.85, 1.1);
  sph(g, 0.13, '#EAF7DC', 0, 0.1, 0.08, 0.9, 0.7, 0.8);
  for (const sx of [-1, 1]) {
    sph(g, 0.065, c, 0.1 * sx, 0.25, 0.05);
    sph(g, 0.03, '#4A4046', 0.1 * sx, 0.27, 0.1, 1, 1.2, 0.5);
    sph(g, 0.01, '#FFFFFF', 0.107 * sx, 0.285, 0.115);
  }
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) sph(g, 0.045, c, 0.11 * lx, 0.04, 0.1 * lz, 1, 0.7, 1.4);
  return g;
};

PETS.flower = () => {
  const g = G(), c = PET_COLORS.flower;
  cyl(g, 0.022, 0.026, 0.34, '#66BB6A', 0, 0.17, 0);
  sph(g, 0.045, '#66BB6A', 0.06, 0.14, 0, 1.5, 0.4, 0.8); sph(g, 0.04, '#66BB6A', -0.05, 0.2, 0, 1.5, 0.4, 0.8);
  const head = G(); head.position.set(0, 0.44, 0); g.add(head);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 2 * i / 6;
    sph(head, 0.09, c, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0, 1, 1, 0.45);
  }
  sph(head, 0.1, '#FFD34E', 0, 0, 0.02, 1, 1, 0.6);
  face(head, { dx: 0.04, y: 0, z: 0.09, s: 0.9, blush: 0.085, by: -0.045 });
  return g;
};

PETS.grass = () => {
  const g = G();
  sph(g, 0.16, '#6FBF73', 0, 0.08, 0, 1.2, 0.5, 1.2); // 土丘
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 2 * i / 7 + 0.3;
    cone(g, 0.035, 0.22 + 0.08 * (i % 3), i % 2 ? '#7CC96F' : '#8FD08F',
      Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1, 0.3 * Math.sin(a), 0, -0.3 * Math.cos(a), 5);
  }
  face(g, { dx: 0.06, y: 0.1, z: 0.16, s: 0.9 });
  return g;
};

PETS.boat = () => {
  const g = G();
  box(g, 0.5, 0.16, 0.9, PET_COLORS.boat, 0, 0.14, 0);                       // 船身
  box(g, 0.42, 0.06, 0.82, '#A87551', 0, 0.24, 0);                            // 甲板
  cyl(g, 0.018, 0.018, 0.75, '#8A6844', 0, 0.6, 0.05);                        // 桅杆
  const sail = add(g, new THREE.ConeGeometry(0.22, 0.55, 3), M('#FFF6EC'), 0, 0.68, 0.03, 0, Math.PI, 0, 1, 1, 0.25);
  sail.rotation.z = Math.PI;                                                  // 三角帆
  face(g, { dx: 0.12, y: 0.2, z: 0.44, s: 0.95 });
  sph(g, 0.03, '#FF9FB6', 0.17, 0.1, 0.42); sph(g, 0.03, '#FF9FB6', -0.17, 0.1, 0.42);
  return g;
};

PETS.light = () => {
  const g = G();
  box(g, 0.26, 0.3, 0.26, '#FFE9B8', 0, 0.26, 0, 0, 0, 0, { emissive: '#FFC94E', ei: 0.85 }); // 灯芯发光
  for (const sx of [-1, 1]) box(g, 0.03, 0.36, 0.3, '#8A6844', 0.15 * sx, 0.26, 0);
  for (const sz of [-1, 1]) box(g, 0.3, 0.36, 0.03, '#8A6844', 0, 0.26, 0.15 * sz);
  box(g, 0.34, 0.05, 0.34, '#8A6844', 0, 0.06, 0); box(g, 0.3, 0.05, 0.3, '#8A6844', 0, 0.47, 0);
  cyl(g, 0.008, 0.008, 0.1, '#8A6844', 0, 0.54, 0);
  face(g, { dx: 0.05, y: 0.28, z: 0.135, s: 0.85 });
  for (const sx of [-1, 1]) sph(g, 0.06, '#FFF6EC', 0.2 * sx, 0.32, -0.02, 1, 0.55, 0.9); // 小翅膀
  return g;
};

PETS.seed = () => {
  const g = G();
  sph(g, 0.17, '#8A6844', 0, 0.08, 0, 1.15, 0.5, 1.15); // 土堆
  cap(g, 0.015, 0.12, '#66BB6A', 0, 0.25, 0);
  sph(g, 0.06, '#8FD08F', 0.05, 0.32, 0, 1.4, 0.35, 0.8, 0, 0, 0.5);
  sph(g, 0.06, '#8FD08F', -0.05, 0.34, 0, 1.4, 0.35, 0.8, 0, 0, -0.5);
  sph(g, 0.07, '#C9A46B', 0, 0.14, 0.1, 0.8, 1.1, 0.8); // 一颗种子宝宝
  face(g, { dx: 0.035, y: 0.15, z: 0.185, s: 0.7 });
  return g;
};

PETS.apple = () => {
  const g = G(), c = PET_COLORS.apple;
  sph(g, 0.2, c, 0, 0.2, 0, 1, 0.95, 0.95);
  sph(g, 0.16, c, 0, 0.18, 0.04);
  cyl(g, 0.018, 0.022, 0.1, '#8A6844', 0, 0.41, 0);
  sph(g, 0.06, '#66BB6A', 0.08, 0.44, 0, 1.5, 0.3, 0.8, 0, 0, 0.4);
  face(g, { dx: 0.07, y: 0.21, z: 0.19 });
  return g;
};

PETS.banana = () => {
  const g = G(), c = PET_COLORS.banana;
  tor(g, 0.18, 0.055, c, 0, 0.22, 0, 0, 0, 0, Math.PI * 1.25);
  sph(g, 0.045, '#8A6844', 0.18, 0.22, 0); sph(g, 0.03, '#8A6844', -0.105, 0.28, 0);
  face(g, { dx: 0.045, y: 0.2, z: 0.075, s: 0.75 });
  return g;
};

PETS.carrot = () => {
  const g = G(), c = PET_COLORS.carrot;
  cone(g, 0.13, 0.42, c, 0, 0.23, 0, Math.PI); // 尖朝下
  for (let i = 0; i < 3; i++)
    cap(g, 0.02, 0.1, '#66BB6A', (i - 1) * 0.05, 0.5, 0, 0, 0, (i - 1) * 0.5);
  face(g, { dx: 0.055, y: 0.3, z: 0.11, s: 0.8 });
  return g;
};

PETS.tomato = () => {
  const g = G(), c = PET_COLORS.tomato;
  sph(g, 0.2, c, 0, 0.19, 0, 1, 0.88, 1);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 2 * i / 5;
    sph(g, 0.05, '#66BB6A', Math.cos(a) * 0.1, 0.33, Math.sin(a) * 0.1, 1.4, 0.35, 0.7, 0, -a);
  }
  cyl(g, 0.014, 0.014, 0.07, '#66BB6A', 0, 0.38, 0);
  face(g, { dx: 0.07, y: 0.18, z: 0.18 });
  return g;
};

PETS.potato = () => {
  const g = G(), c = PET_COLORS.potato;
  sph(g, 0.19, c, 0, 0.17, 0, 1.15, 0.85, 1);
  sph(g, 0.1, c, -0.12, 0.2, 0.08, 1, 0.9, 1);
  sph(g, 0.08, '#B9945C', 0.1, 0.1, -0.1);
  face(g, { dx: 0.07, y: 0.18, z: 0.17 });
  return g;
};

PETS.corn = () => {
  const g = G(), c = PET_COLORS.corn;
  cap(g, 0.12, 0.24, c, 0, 0.3, 0).scale.set(1, 1, 0.9);
  for (const sx of [-1, 1]) {
    sph(g, 0.07, '#66BB6A', 0.11 * sx, 0.22, 0, 0.6, 1.5, 1, 0, 0, -0.4 * sx);
    sph(g, 0.06, '#66BB6A', 0.09 * sx, 0.36, 0, 0.6, 1.2, 1, 0, 0, -0.5 * sx);
  }
  face(g, { dx: 0.06, y: 0.33, z: 0.11, s: 0.85 });
  return g;
};

PETS.goat = () => {
  const g = G(), c = PET_COLORS.goat;
  const head = quadBody(g, { bc: c, bodyR: 0.17, headR: 0.18, legH: 0.14 });
  sph(head, 0.18, c);
  for (const sx of [-1, 1]) {
    cone(head, 0.035, 0.1, '#A89C8C', 0.09 * sx, 0.17, 0, 0, 0, -0.4 * sx); // 角
    sph(head, 0.05, c, 0.12 * sx, 0.02, 0.04, 1, 1.4, 0.5);                  // 耳
  }
  cone(head, 0.03, 0.09, '#EAE4D8', 0, -0.13, 0.1, Math.PI);                 // 胡子
  face(head, { y: 0.03, z: 0.16 });
  return g;
};

PETS.wind = () => {
  const g = G(), c = PET_COLORS.wind;
  sph(g, 0.15, '#FFFFFF', 0, 0.24, 0, 1.1, 0.8, 1);                          // 云宝
  for (const [ry, rz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]])
    tor(g, 0.16, 0.022, c, Math.sin(ry) * 0.12, 0.2, Math.sin(rz) * 0.1, Math.PI / 2, ry, rz, Math.PI * 1.2);
  sph(g, 0.04, '#8FD08F', 0.24, 0.3, 0.05); sph(g, 0.035, '#8FD08F', -0.2, 0.14, -0.06);
  face(g, { dx: 0.05, y: 0.25, z: 0.13, s: 0.85 });
  return g;
};

PETS.pig = () => {
  const g = G(), c = PET_COLORS.pig;
  const head = quadBody(g, { bc: c, bodyR: 0.17, headR: 0.19, headZ: 0.22 });
  sph(head, 0.19, c);
  for (const sx of [-1, 1]) cone(head, 0.055, 0.09, c, 0.12 * sx, 0.15, -0.02, 0, 0, -0.5 * sx);
  cyl(head, 0.05, 0.05, 0.05, '#FF8FA8', 0, -0.03, 0.185);
  sph(head, 0.012, '#C9607E', 0.02, -0.03, 0.212); sph(head, 0.012, '#C9607E', -0.02, -0.03, 0.212);
  face(head, { y: 0.045, z: 0.16 });
  tor(g, 0.05, 0.016, c, 0, 0.34, -0.22, Math.PI / 2.3); // 卷尾巴
  return g;
};

PETS.cow = () => {
  const g = G(), c = PET_COLORS.cow;
  const head = quadBody(g, { bc: c, bodyR: 0.19, bodyLen: 1.45, legH: 0.15, headR: 0.2 });
  sph(head, 0.2, c);
  sph(head, 0.09, '#FFC9D6', 0, -0.06, 0.17, 1.2, 0.8, 0.8); // 粉口鼻
  sph(head, 0.014, '#A0566F', 0.035, -0.05, 0.235); sph(head, 0.014, '#A0566F', -0.035, -0.05, 0.235);
  for (const sx of [-1, 1]) { cone(head, 0.03, 0.08, '#EAE4D8', 0.1 * sx, 0.19, 0, 0, 0, -0.5 * sx); sph(head, 0.05, c, 0.15 * sx, 0.05, 0.03, 1, 1.3, 0.5); }
  sph(g, 0.13, '#4A4046', 0.12, 0.42, -0.05, 1, 0.7, 1.2);   // 花斑
  sph(g, 0.1, '#4A4046', -0.14, 0.36, 0.12, 1, 0.65, 1);
  face(head, { y: 0.04, z: 0.175 });
  return g;
};

PETS.bird = () => {
  const g = G(), c = PET_COLORS.bird;
  sph(g, 0.16, c, 0, 0.22, 0, 1, 0.95, 1.05);
  sph(g, 0.12, '#FFF3DA', 0, 0.18, 0.06, 0.9, 0.8, 0.85);
  cone(g, 0.045, 0.09, '#FF9A3C', 0, 0.27, 0.16, Math.PI / 2);
  face(g, { dx: 0.06, y: 0.28, z: 0.12 });
  for (const sx of [-1, 1]) sph(g, 0.08, c, 0.15 * sx, 0.2, -0.02, 0.4, 0.8, 1.1); // 翅膀
  sph(g, 0.07, c, 0, 0.3, -0.15, 0.5, 0.6, 1);
  for (const sx of [-1, 1]) cyl(g, 0.012, 0.012, 0.08, '#FF9A3C', 0.05 * sx, 0.04, 0);
  return g;
};

PETS.bee = () => {
  const g = G(), c = PET_COLORS.bee;
  sph(g, 0.14, c, 0, 0.2, 0, 1, 0.95, 1.25);
  for (const z of [-0.04, 0.06]) tor(g, 0.138, 0.02, '#4A4046', 0, 0.2, z, Math.PI / 2).scale.set(1, 1, 1);
  sph(g, 0.1, '#4A4046', 0, 0.22, 0.14, 1, 0.9, 0.9); // 头
  for (const sx of [-1, 1]) {
    sph(g, 0.07, '#EAF7FC', 0.13 * sx, 0.28, -0.02, 1, 0.25, 1.5); // 翅膀
    cyl(g, 0.006, 0.006, 0.07, '#4A4046', 0.04 * sx, 0.32, 0.18, -0.5, 0, 0.4 * sx);
  }
  face(g, { dx: 0.045, y: 0.23, z: 0.22, s: 0.7 });
  cone(g, 0.008, 0.05, '#4A4046', 0, 0.2, -0.2, -Math.PI / 2);
  return g;
};

PETS.horse = () => {
  const g = G(), c = PET_COLORS.horse;
  const head = quadBody(g, { bc: c, bodyR: 0.19, bodyLen: 1.5, legH: 0.2, headR: 0.19, headZ: 0.34 });
  sph(head, 0.17, c, 0, 0, 0.05, 0.9, 0.95, 1.3); // 长脸
  sph(head, 0.05, '#8A6844', 0, -0.04, 0.2, 1, 0.8, 0.9);
  for (const sx of [-1, 1]) sph(head, 0.045, '#8A6844', 0.11 * sx, 0.12, -0.03, 1, 1.5, 0.5);
  for (let i = 0; i < 4; i++) sph(g, 0.045, '#6B4A30', 0, 0.44 + i * 0.04, 0.34 - i * 0.075, 1.6, 0.5, 0.5); // 鬃毛
  sph(g, 0.06, '#6B4A30', 0, 0.5, -0.32, 0.7, 1.3, 0.5); // 尾
  face(head, { dx: 0.075, y: 0.06, z: 0.13 });
  return g;
};

PETS.sheep = () => {
  const g = G(), c = PET_COLORS.sheep;
  const head = quadBody(g, { bc: c, bodyR: 0.2, legH: 0.13, legC: '#D9CBB8', headR: 0.15, headZ: 0.24 });
  for (const o of [[0, 0.06, 0.2], [0.12, 0.16, 0.15], [-0.12, 0.16, 0.15], [0, 0.2, -0.05], [0.13, 0.05, -0.1], [-0.13, 0.05, -0.1]])
    sph(g, 0.14, c, o[0], 0.28 + o[1], o[2] - 0.04, 1, 1, 1); // 卷卷毛
  sph(head, 0.13, '#4A4046', 0, 0, 0.04, 0.9, 0.95, 1.05); // 黑脸
  face(head, { dx: 0.045, y: 0.02, z: 0.13, s: 0.75 });
  for (const sx of [-1, 1]) sph(head, 0.05, c, 0.1 * sx, 0.08, -0.02, 1, 1.2, 0.4);
  return g;
};

PETS.hen = () => {
  const g = G(), c = PET_COLORS.hen;
  sph(g, 0.17, c, 0, 0.2, -0.03, 0.95, 1, 1.2);
  const head = G(); head.position.set(0, 0.42, 0.1); g.add(head);
  sph(head, 0.12, c);
  sph(head, 0.04, '#E84B4B', 0, 0.12, 0.02, 0.6, 1, 0.7); sph(head, 0.035, '#E84B4B', 0, 0.15, 0.01);
  cone(head, 0.035, 0.08, '#FF9A3C', 0, 0, 0.13, Math.PI / 2);
  sph(head, 0.03, '#E84B4B', 0, -0.09, 0.1, 0.5, 1, 0.5);
  face(head, { dx: 0.05, y: 0.03, z: 0.105 });
  for (const sx of [-1, 1]) cyl(g, 0.012, 0.012, 0.09, '#FF9A3C', 0.05 * sx, 0.05, 0);
  return g;
};

PETS.milk = () => {
  const g = G();
  box(g, 0.3, 0.42, 0.3, '#FFFFFF', 0, 0.21, 0);
  box(g, 0.3, 0.02, 0.3, '#7EC4F2', 0, 0.3, 0, 0, 0, 0);             // 蓝条
  add(g, new THREE.CylinderGeometry(0.15, 0.212, 0.16, 4), M('#E8F4FC'), 0, 0.48, 0, 0, Math.PI / 4); // 山形顶
  cyl(g, 0.035, 0.035, 0.06, '#D9E8F5', 0, 0.58, 0, 0, 0, 0, 8);
  face(g, { dx: 0.06, y: 0.2, z: 0.158 });
  return g;
};

PETS.bread = () => {
  const g = G(), c = PET_COLORS.bread;
  cap(g, 0.13, 0.22, c, 0, 0.15, 0, 0, 0, Math.PI / 2).scale.set(1, 1.05, 1.3);
  sph(g, 0.05, '#F5E0B8', -0.08, 0.27, 0.05); sph(g, 0.04, '#F5E0B8', 0.06, 0.28, -0.04);
  face(g, { dx: 0.06, y: 0.13, z: 0.165 });
  return g;
};

PETS.egg = () => {
  const g = G();
  sph(g, 0.18, PET_COLORS.egg, 0, 0.2, 0, 0.88, 1.12, 0.88);
  tor(g, 0.115, 0.016, '#A8D8F0', 0, 0.2, 0.06, 1.35, 0, 0, Math.PI).scale.set(0.92, 1.05, 1);
  face(g, { dx: 0.055, y: 0.22, z: 0.155 });
  return g;
};

PETS.cake = () => {
  const g = G();
  cyl(g, 0.2, 0.2, 0.16, '#FFB7CB', 0, 0.08, 0, 0, 0, 0, 18);
  cyl(g, 0.205, 0.205, 0.05, '#FFF6EC', 0, 0.18, 0, 0, 0, 0, 18);
  cyl(g, 0.16, 0.16, 0.12, '#FFE24E', 0, 0.25, 0, 0, 0, 0, 16);
  cyl(g, 0.012, 0.012, 0.12, '#8FD0E8', 0, 0.41, 0, 0, 0, 0, 6);
  sph(g, 0.028, '#FF8736', 0, 0.49, 0, 1, 1.5, 1, 0, 0, 0, { emissive: '#FF9A3C', ei: 1.2 }); // 烛火
  face(g, { dx: 0.07, y: 0.12, z: 0.185 });
  return g;
};

PETS.tractor = () => {
  const g = G(), c = PET_COLORS.tractor;
  box(g, 0.5, 0.22, 0.34, c, 0, 0.24, 0);
  box(g, 0.24, 0.24, 0.3, '#5C8F46', -0.08, 0.46, 0);
  sph(g, 0.1, '#EAF7FC', -0.08, 0.46, 0.02, 0.9, 0.9, 0.35); // 窗
  cyl(g, 0.015, 0.015, 0.16, '#4A4046', 0.16, 0.55, -0.08, 0, 0, 0, 8); // 烟囱
  const wheel = (x, z, r) => { cyl(g, r, r, 0.08, '#E8B23C', x, r, z, 0, 0, Math.PI / 2, 16); cyl(g, r * 0.45, r * 0.45, 0.09, '#4A4046', x, r, z, 0, 0, Math.PI / 2, 12); };
  wheel(0.18, 0, 0.1); wheel(-0.18, 0, 0.1);
  face(g, { dx: 0.1, y: 0.28, z: 0.19, s: 0.8 });
  return g;
};

PETS.rain = () => {
  const g = G(), c = PET_COLORS.rain;
  sph(g, 0.16, '#FFFFFF', 0, 0.32, 0, 1.2, 0.8, 1);
  sph(g, 0.12, '#FFFFFF', 0.15, 0.28, 0.02); sph(g, 0.11, '#FFFFFF', -0.15, 0.28, -0.02);
  face(g, { dx: 0.06, y: 0.31, z: 0.12, s: 0.85 });
  for (const [dx, dz, dy] of [[-0.14, 0.04, -0.1], [0.02, -0.06, -0.22], [0.15, 0.03, -0.13]])
    sph(g, 0.035, '#7EC4F2', dx, 0.2 + dy - 0.06, dz, 1, 1.4, 1, 0, 0, 0, { alpha: 0.9 });
  return g;
};

PETS.tree = () => {
  const g = G();
  cyl(g, 0.1, 0.14, 0.4, '#A87551', 0, 0.2, 0);
  sph(g, 0.24, '#6FBF73', 0, 0.55, 0);
  sph(g, 0.17, '#8FD08F', 0.13, 0.66, 0.08); sph(g, 0.15, '#5CA85C', -0.14, 0.62, -0.06);
  face(g, { dx: 0.055, y: 0.22, z: 0.13, s: 0.8 });
  return g;
};

PETS.sun = () => {
  const g = G(), c = PET_COLORS.sun;
  sph(g, 0.19, c, 0, 0.32, 0, 1, 1, 1, 0, 0, 0, { emissive: '#FFB93C', ei: 0.55 });
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8;
    cone(g, 0.045, 0.13, c, Math.cos(a) * 0.26, 0.32 + Math.sin(a) * 0.26, 0, 0, 0, a - Math.PI / 2, 8,
      { emissive: '#FFB93C', ei: 0.5 });
  }
  face(g, { dx: 0.06, y: 0.33, z: 0.17, s: 0.9 });
  return g;
};

PETS.star = () => {
  const g = G(), c = PET_COLORS.star;
  sph(g, 0.13, c, 0, 0.3, 0, 1, 1, 0.6, 0, 0, 0, { emissive: '#FFD34E', ei: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + Math.PI * 2 * i / 5;
    cone(g, 0.05, 0.16, c, Math.cos(a) * 0.17, 0.3 + Math.sin(a) * 0.17, 0, 0, 0, a + Math.PI / 2, 6,
      { emissive: '#FFD34E', ei: 0.9 });
  }
  face(g, { dx: 0.045, y: 0.31, z: 0.09, s: 0.75 });
  return g;
};

PETS.moon = () => {
  const g = G(), c = PET_COLORS.moon;
  tor(g, 0.17, 0.075, c, 0, 0.3, 0, 0, 0, Math.PI * 0.7, Math.PI * 1.6, { emissive: '#F5D98A', ei: 0.5 });
  sph(g, 0.03, '#EAD48E', 0.05, 0.42, 0.03); sph(g, 0.025, '#EAD48E', -0.1, 0.36, 0.05);
  face(g, { dx: 0.04, y: 0.31, z: 0.1, s: 0.7 });
  return g;
};

// ================= 海滩词宠 =================
PETS.fish = () => {
  const g = G(), c = PET_COLORS.fish;
  sph(g, 0.16, c, 0, 0.2, 0, 1, 0.95, 1.25);
  cone(g, 0.1, 0.18, '#FFA066', 0, 0.2, -0.22, -Math.PI / 2).scale.set(1.4, 1, 0.3); // 尾鳍
  cone(g, 0.06, 0.11, '#FFA066', 0, 0.37, 0.02, 0, 0, 0.2).scale.set(1, 1, 0.35);    // 背鳍
  for (const sx of [-1, 1]) sph(g, 0.06, '#FFA066', 0.13 * sx, 0.16, 0.02, 0.5, 1, 0.9); // 侧鳍
  sph(g, 0.05, '#FFF6EC', 0, 0.24, 0.12, 0.9, 0.7, 0.6); // 小肚皮
  face(g, { dx: 0.06, y: 0.24, z: 0.15 });
  return g;
};

PETS.whale = () => {
  const g = G(), c = PET_COLORS.whale;
  sph(g, 0.22, c, 0, 0.22, -0.02, 1, 0.85, 1.3);
  sph(g, 0.18, '#EAF7FC', 0, 0.13, 0.07, 0.9, 0.55, 1.1); // 白肚皮
  sph(g, 0.09, c, 0, 0.34, -0.26, 0.7, 1.1, 0.5);          // 尾巴根
  sph(g, 0.08, c, 0, 0.4, -0.34, 1.3, 0.4, 0.5);
  for (const sx of [-1, 1]) sph(g, 0.06, c, 0.14 * sx, 0.16, 0.08, 0.6, 0.35, 1.1); // 侧鳍
  for (let i = 0; i < 3; i++) sph(g, 0.035 - i * 0.008, '#BDE3F0', (i - 1) * 0.05, 0.5 + i * 0.06, -0.06, 1, 1.3, 1, 0, 0, 0, { alpha: 0.85 }); // 喷水
  face(g, { dx: 0.08, y: 0.27, z: 0.2 });
  return g;
};

PETS.crab = () => {
  const g = G(), c = PET_COLORS.crab;
  sph(g, 0.16, c, 0, 0.14, 0, 1.2, 0.8, 1);
  for (const sx of [-1, 1]) {
    // 眼睛立在杆子上
    cyl(g, 0.012, 0.012, 0.1, c, 0.06 * sx, 0.26, 0.06);
    sph(g, 0.045, '#FFFFFF', 0.06 * sx, 0.33, 0.06);
    sph(g, 0.02, '#4A4046', 0.06 * sx, 0.335, 0.098);
    // 大钳子
    sph(g, 0.07, c, 0.19 * sx, 0.12, 0.1);
    cone(g, 0.035, 0.08, c, 0.19 * sx, 0.16, 0.15, 0.9 * sx, 0, 0);
    // 小腿
    for (let i = 0; i < 3; i++) cyl(g, 0.012, 0.012, 0.09, '#D14B3A', 0.16 * sx, 0.05, -0.08 + i * 0.08, 0, 0, sx * 0.9);
  }
  tor(g, 0.03, 0.008, '#C24232', 0, 0.1, 0.155, 0.4); // 微笑嘴
  for (const sx of [-1, 1]) sph(g, 0.03, '#FFB3C1', 0.09 * sx, 0.09, 0.12, 1, 0.7, 0.4); // 腮红
  return g;
};

PETS.shell = () => {
  const g = G(), c = PET_COLORS.shell;
  cyl(g, 0.17, 0.19, 0.08, '#FFB1C8', 0, 0.05, 0, 0, 0, 0, 18); // 底座
  const fan = cone(g, 0.19, 0.26, c, 0, 0.2, 0);
  fan.scale.set(1, 1, 0.55);
  for (let i = -1; i <= 1; i++) box(g, 0.02, 0.24, 0.02, '#F09CB8', i * 0.09, 0.2, 0.028 * (1 - Math.abs(i)), 0, 0, -i * 0.35); // 扇棱
  sph(g, 0.045, '#FFF6EC', 0, 0.06, 0.1, 1, 0.7, 0.8);
  face(g, { dx: 0.055, y: 0.1, z: 0.12, s: 0.8 });
  // 里面探出一只小珍珠眼角？珍珠宝宝
  sph(g, 0.05, '#FFFDF4', 0.11, 0.1, 0.13, 1, 0.85, 1);
  return g;
};

PETS.starfish = () => {
  const g = G(), c = PET_COLORS.starfish;
  sph(g, 0.11, c, 0, 0.08, 0, 1, 0.55, 1);
  const arms = G();
  for (let i = 0; i < 5; i++) {
    const arm = G();
    const a = cone(arm, 0.05, 0.17, i % 2 ? '#FFA76B' : c, 0.11, 0, 0, 0, 0, -Math.PI / 2);
    a.scale.set(1, 1, 0.5);
    arm.position.y = 0.07;
    arm.rotation.y = Math.PI * 2 * i / 5;
    arms.add(arm);
  }
  g.add(arms);
  for (let i = 0; i < 6; i++) sph(g, 0.012, '#FFE0C4', Math.cos(i * 2.2) * 0.06, 0.13, Math.sin(i * 2.2) * 0.06);
  face(g, { dx: 0.04, y: 0.11, z: 0.1, s: 0.7 });
  return g;
};

PETS.ship = () => {
  const g = G(), c = PET_COLORS.ship;
  box(g, 0.46, 0.15, 0.9, c, 0, 0.15, 0);                       // 船身
  box(g, 0.5, 0.04, 0.94, '#FFF6EC', 0, 0.24, 0);               // 白色船舷
  box(g, 0.28, 0.18, 0.34, '#FFF6EC', 0, 0.35, -0.08);          // 客舱
  box(g, 0.3, 0.05, 0.36, '#FF8FB0', 0, 0.46, -0.08);           // 粉屋顶
  cyl(g, 0.045, 0.055, 0.22, '#4A4046', 0.05, 0.55, 0.08);      // 烟囱
  sph(g, 0.06, '#D9D9E0', 0.05, 0.72, 0.08, 1, 0.8, 1, 0, 0, 0, { alpha: 0.8 }); // 烟
  sph(g, 0.08, '#E4E4EA', 0.08, 0.82, 0.1, 1, 0.8, 1, 0, 0, 0, { alpha: 0.55 });
  cyl(g, 0.008, 0.008, 0.14, '#8A6844', -0.08, 0.55, -0.2);     // 旗杆
  box(g, 0.09, 0.05, 0.012, '#FFC94E', -0.045, 0.59, -0.2);     // 小黄旗
  face(g, { dx: 0.1, y: 0.2, z: 0.44 });
  return g;
};

PETS.ball = () => {
  const g = G();
  sph(g, 0.18, '#FFF6EC', 0, 0.2, 0);
  tor(g, 0.172, 0.05, '#FF6B6B', 0, 0.2, 0);                    // 赤道红环
  tor(g, 0.172, 0.05, '#4A90D9', 0, 0.2, 0, Math.PI / 2);       // 蓝环
  sph(g, 0.05, '#FFC94E', 0, 0.37, 0);                          // 顶点黄帽
  sph(g, 0.05, '#FFC94E', 0, 0.03, 0);
  face(g, { dx: 0.07, y: 0.22, z: 0.16 });
  return g;
};

PETS.kite = () => {
  const g = G(), c = PET_COLORS.kite;
  const k = G();
  cone(k, 0.17, 0.3, c, 0, 0.15, 0);                            // 上半菱形
  cone(k, 0.17, 0.36, '#FFA5C2', 0, -0.18, 0, Math.PI);         // 下半
  k.scale.set(1, 1, 0.32);
  g.add(k);
  box(g, 0.03, 0.66, 0.03, '#8A6844', 0, 0.32, 0.03);           // 骨架竖
  box(g, 0.34, 0.03, 0.03, '#8A6844', 0, 0.3, 0.03);            // 骨架横
  for (let i = 0; i < 3; i++) {                                  // 蝴蝶结尾巴
    const y = -0.16 - i * 0.16;
    sph(g, 0.032, ['#FFE24E', '#7EC4F2', '#FFC94E'][i], 0.02 * i, y, 0.04, 1.6, 0.7, 0.5);
  }
  face(g, { dx: 0.05, y: 0.34, z: 0.075, s: 0.8 });
  return g;
};

PETS.sand = () => {
  const g = G(), c = PET_COLORS.sand;
  sph(g, 0.19, c, 0, 0.1, 0, 1.2, 0.6, 1.2);                    // 沙堆
  sph(g, 0.1, '#EBCE93', 0.06, 0.2, -0.04, 1, 0.5, 1);
  cyl(g, 0.075, 0.055, 0.13, '#FF8FB0', -0.1, 0.2, 0.06);       // 小桶
  cyl(g, 0.078, 0.078, 0.02, '#E0678D', -0.1, 0.27, 0.06);
  tor(g, 0.05, 0.008, '#E0678D', -0.1, 0.3, 0.06, 0, 0, 0, Math.PI);
  sph(g, 0.035, '#FF9A5C', 0.13, 0.12, 0.1, 1, 0.5, 1);         // 小海星点缀
  face(g, { dx: 0.06, y: 0.12, z: 0.17, s: 0.85 });
  return g;
};

PETS.wave = () => {
  const g = G(), c = PET_COLORS.wave;
  tor(g, 0.15, 0.07, c, 0, 0.2, 0, 0, 0, Math.PI * 0.75, Math.PI * 1.5); // 卷起来的浪
  sph(g, 0.05, '#FFFFFF', 0.15, 0.34, 0);                       // 浪尖白沫
  sph(g, 0.035, '#FFFFFF', 0.06, 0.4, 0.02);
  for (const [dx, dz] of [[-0.12, 0.06], [0.05, 0.1], [-0.02, -0.08]])
    sph(g, 0.05, '#A8DCF0', dx, 0.06, dz, 1.2, 0.5, 1.2);       // 底部水花
  face(g, { dx: 0.045, y: 0.2, z: 0.16, s: 0.8 });
  return g;
};

PETS.sea = () => {
  const g = G(), c = PET_COLORS.sea;
  sph(g, 0.2, c, 0, 0.19, 0, 1.05, 0.9, 1.05);
  sph(g, 0.14, '#7EC4F2', 0, 0.28, -0.02, 0.9, 0.6, 0.9);       // 浪头高光
  tor(g, 0.19, 0.035, '#FFFFFF', 0, 0.07, 0, Math.PI / 2).scale.set(1.05, 1, 0.4); // 岸边白沫
  sph(g, 0.03, '#FFFFFF', 0.12, 0.34, 0.06);
  face(g, { dx: 0.07, y: 0.2, z: 0.18 });
  return g;
};

PETS.icecream = () => {
  const g = G();
  cone(g, 0.12, 0.24, '#E8B23C', 0, 0.12, 0, Math.PI);          // 蛋筒（尖朝下）
  for (let i = 0; i < 4; i++)                                   // 蛋筒格纹
    box(g, 0.016, 0.2, 0.016, '#C9952F', Math.cos(i * 1.57) * 0.05, 0.1, Math.sin(i * 1.57) * 0.05, 0, -i * 0.78, 0.5);
  sph(g, 0.125, PET_COLORS.icecream, 0, 0.32, 0, 1, 0.92, 1);   // 草莓球
  sph(g, 0.07, '#FFF6EC', 0.07, 0.4, -0.02, 1, 0.8, 1);         // 奶油尖
  sph(g, 0.03, '#E84B4B', -0.04, 0.44, 0.02);                   // 樱桃
  face(g, { dx: 0.05, y: 0.33, z: 0.11, s: 0.75 });
  return g;
};

// ================= 森林词宠 =================
PETS.bear = () => {
  const g = G(), c = PET_COLORS.bear;
  const head = quadBody(g, { bc: c, bodyR: 0.19, headR: 0.21 });
  sph(head, 0.21, c);
  for (const sx of [-1, 1]) {
    sph(head, 0.075, c, 0.14 * sx, 0.17, 0);                    // 圆耳朵
    sph(head, 0.04, '#C99A6B', 0.14 * sx, 0.17, 0.045);
  }
  sph(head, 0.08, '#E8CFA8', 0, -0.05, 0.17, 1, 0.85, 0.8);     // 浅色口鼻
  sph(head, 0.022, '#4A4046', 0, -0.02, 0.24);                  // 鼻子
  face(head, { y: 0.05, z: 0.175 });
  sph(g, 0.1, '#E8CFA8', 0, 0.32, 0.12, 1, 1.2, 0.6);           // 浅肚皮
  return g;
};

PETS.fox = () => {
  const g = G(), c = PET_COLORS.fox;
  const head = quadBody(g, { bc: c, bodyR: 0.16, legC: '#4A4046', headR: 0.19, headZ: 0.22 });
  sph(head, 0.19, c);
  sph(head, 0.07, '#FFF6EC', 0, -0.06, 0.16, 0.9, 0.75, 0.8);   // 白口鼻
  sph(head, 0.018, '#4A4046', 0, -0.03, 0.23);
  for (const sx of [-1, 1]) {
    cone(head, 0.06, 0.14, c, 0.1 * sx, 0.2, 0, 0, 0, -0.35 * sx); // 尖耳
    cone(head, 0.03, 0.06, '#4A4046', 0.1 * sx, 0.27, -0.005, 0, 0, -0.35 * sx); // 耳尖
  }
  face(head, { y: 0.03, z: 0.165 });
  cap(g, 0.06, 0.2, c, 0, 0.36, -0.24, -Math.PI / 2.6).scale.set(1, 1, 0.7); // 大尾巴
  sph(g, 0.075, '#FFF6EC', 0, 0.44, -0.36, 1, 1, 0.8);          // 尾巴尖
  sph(g, 0.09, '#FFF6EC', 0, 0.26, 0.14, 1, 1.3, 0.55);         // 白胸
  return g;
};

PETS.owl = () => {
  const g = G(), c = PET_COLORS.owl;
  sph(g, 0.18, c, 0, 0.24, 0, 0.95, 1.15, 0.95);                // 蛋形身子
  sph(g, 0.13, '#D9BC94', 0, 0.19, 0.09, 0.8, 0.9, 0.6);        // 浅肚
  for (const sx of [-1, 1]) {
    cone(g, 0.045, 0.09, c, 0.08 * sx, 0.42, -0.02, 0, 0, -0.3 * sx); // 耳羽
    sph(g, 0.075, '#FFF6EC', 0.072 * sx, 0.3, 0.115, 1, 1, 0.45);     // 大眼盘
    sph(g, 0.035, '#4A4046', 0.072 * sx, 0.3, 0.15);
    sph(g, 0.012, '#FFFFFF', 0.082 * sx, 0.315, 0.175);
    sph(g, 0.07, '#8A6844', 0.15 * sx, 0.24, -0.02, 0.45, 0.8, 1.1);  // 收拢的翅膀
  }
  cone(g, 0.032, 0.07, '#FF9A3C', 0, 0.24, 0.16, Math.PI / 2);  // 小喙
  for (const sx of [-1, 1]) cyl(g, 0.012, 0.012, 0.06, '#FF9A3C', 0.05 * sx, 0.03, 0.02);
  return g;
};

PETS.monkey = () => {
  const g = G(), c = PET_COLORS.monkey;
  const head = quadBody(g, { bc: c, bodyR: 0.16, headR: 0.19, headZ: 0.2 });
  sph(head, 0.19, c);
  sph(head, 0.11, '#EBD6B3', 0, -0.02, 0.1, 0.9, 0.8, 0.65);    // 浅色脸盘
  sph(head, 0.05, '#EBD6B3', 0, 0.02, 0.17, 0.8, 0.55, 0.5);    // 口鼻
  sph(head, 0.012, '#4A4046', 0, -0.005, 0.215);
  for (const sx of [-1, 1]) {
    sph(head, 0.06, c, 0.17 * sx, 0.04, 0, 1, 1, 0.5);          // 圆耳朵
    sph(head, 0.032, '#EBD6B3', 0.175 * sx, 0.04, 0.03, 1, 1, 0.35);
  }
  face(head, { dx: 0.05, y: 0.05, z: 0.16, s: 0.8, blush: 0.1 });
  tor(g, 0.11, 0.022, c, 0, 0.32, -0.18, 0.5, 0.6, 0.4, Math.PI * 1.5); // 卷尾巴
  sph(g, 0.07, '#EBD6B3', 0, 0.3, 0.1, 1, 1.2, 0.6);            // 浅肚皮
  return g;
};

PETS.squirrel = () => {
  const g = G(), c = PET_COLORS.squirrel;
  sph(g, 0.15, c, 0, 0.17, -0.03, 1, 1.1, 1.2);
  sph(g, 0.09, '#FFE8D0', 0, 0.14, 0.06, 0.9, 1, 0.7);          // 白肚
  const head = G(); head.position.set(0, 0.38, 0.08); g.add(head);
  sph(head, 0.13, c);
  sph(head, 0.06, '#FFE8D0', 0, -0.03, 0.1, 0.85, 0.7, 0.7);
  for (const sx of [-1, 1]) {
    cone(head, 0.045, 0.09, c, 0.08 * sx, 0.14, -0.01, 0, 0, -0.3 * sx); // 小尖耳
    sph(head, 0.012, '#4A4046', 0, -0.01, 0.125);
  }
  face(head, { dx: 0.05, y: 0.02, z: 0.115, s: 0.85 });
  for (let i = 0; i < 3; i++)                                   // 招牌大尾巴
    sph(g, 0.085 + i * 0.012, i % 2 ? '#C97A3A' : c, 0.02 + i * 0.02, 0.24 + i * 0.13, -0.2 - i * 0.03, 1, 1, 0.7);
  return g;
};

PETS.panda = () => {
  const g = G(), c = PET_COLORS.panda;
  const head = quadBody(g, { bc: c, bodyR: 0.19, legC: '#4A4046', headR: 0.21 });
  sph(head, 0.21, c);
  sph(g, 0.12, '#4A4046', 0, 0.42, -0.04, 1.2, 0.7, 1.1);       // 黑肩带
  for (const sx of [-1, 1]) {
    sph(head, 0.06, '#4A4046', 0.15 * sx, 0.18, -0.02);         // 黑耳
    sph(head, 0.055, '#4A4046', 0.075 * sx, 0.04, 0.155, 1, 1.15, 0.4); // 黑眼圈
  }
  sph(head, 0.045, '#FFFFFF', 0, -0.05, 0.19, 1, 0.8, 0.8);     // 白口鼻
  sph(head, 0.016, '#4A4046', 0, -0.03, 0.245);
  face(head, { dx: 0.038, y: 0.055, z: 0.185, s: 0.85 });
  cyl(g, 0.03, 0.03, 0.24, '#8FBF6F', 0.2, 0.35, 0.12, 0, 0, -0.7); // 抱着竹子
  sph(g, 0.05, '#7CC96F', 0.26, 0.48, 0.12, 1.4, 0.35, 0.8);
  return g;
};

PETS.deer = () => {
  const g = G(), c = PET_COLORS.deer;
  const head = quadBody(g, { bc: c, bodyR: 0.16, headR: 0.17, headZ: 0.22 });
  sph(head, 0.17, c);
  sph(head, 0.055, '#E8D4B0', 0, -0.05, 0.15, 0.9, 0.75, 0.8);  // 口鼻
  sph(head, 0.016, '#4A4046', 0, -0.02, 0.21);
  for (const sx of [-1, 1]) {
    cyl(head, 0.014, 0.014, 0.14, '#A8825B', 0.08 * sx, 0.22, -0.02, 0, 0, -0.4 * sx);   // 角主干
    cyl(head, 0.011, 0.011, 0.08, '#A8825B', 0.12 * sx, 0.26, -0.02, 0, 0, 0.9);          // 角分叉
    sph(head, 0.045, c, 0.12 * sx, 0.06, 0.04, 1, 1.3, 0.5);                              // 耳朵
  }
  face(head, { y: 0.03, z: 0.15 });
  for (let i = 0; i < 5; i++)                                   // 背上白斑点
    sph(g, 0.028, '#FFF6EC', (i % 2 ? 0.07 : -0.07), 0.36, 0.1 - Math.floor(i / 2) * 0.12, 1, 0.6, 1.2);
  sph(g, 0.045, '#FFF6EC', 0, 0.18, -0.26, 0.7, 1.2, 0.5);      // 小圆尾
  return g;
};

PETS.mushroom = () => {
  const g = G(), c = PET_COLORS.mushroom;
  cyl(g, 0.07, 0.09, 0.22, '#FFF0DC', 0, 0.11, 0);              // 菌柄
  sph(g, 0.17, c, 0, 0.26, 0, 1, 0.62, 1);                      // 红伞帽
  cyl(g, 0.13, 0.16, 0.03, '#FFF0DC', 0, 0.24, 0, 0, 0, 0, 18); // 帽沿
  for (const [dx, dz] of [[-0.08, 0.04], [0.07, -0.05], [0.02, 0.1], [-0.04, -0.09]])
    sph(g, 0.028, '#FFF6EC', dx, 0.33, dz, 1, 0.5, 1);          // 白点
  face(g, { dx: 0.04, y: 0.12, z: 0.09, s: 0.75 });
  for (const [dx, dz] of [[-0.12, 0.08], [0.13, -0.03]])
    cone(g, 0.025, 0.09, '#8FD08F', dx, 0.03, dz);              // 脚边小草
  return g;
};

PETS.leaf = () => {
  const g = G(), c = PET_COLORS.leaf;
  sph(g, 0.15, c, 0, 0.2, 0, 1.15, 0.35, 1.5);                  // 叶身
  sph(g, 0.1, '#A5DCA0', 0, 0.21, -0.03, 0.8, 0.3, 1.1);
  cap(g, 0.014, 0.1, '#66BB6A', 0, 0.13, 0.2, Math.PI / 2.2);   // 叶柄
  box(g, 0.012, 0.012, 0.42, '#66BB6A', 0, 0.235, -0.02);       // 主叶脉
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++)
    box(g, 0.008, 0.008, 0.1, '#7CC96F', 0.035 * sx, 0.225, 0.08 - i * 0.1, 0, sx * 0.5, 0);
  face(g, { dx: 0.05, y: 0.24, z: 0.1, s: 0.75 });
  return g;
};

PETS.stone = () => {
  const g = G(), c = PET_COLORS.stone;
  sph(g, 0.17, c, 0, 0.13, 0, 1.25, 0.85, 1);
  sph(g, 0.1, '#C4C4CE', 0.1, 0.1, 0.08);
  sph(g, 0.09, '#8FD08F', -0.06, 0.24, -0.02, 1.1, 0.35, 1);    // 头顶苔藓
  sph(g, 0.045, '#7CC96F', 0.02, 0.26, 0.07, 1, 0.4, 1);
  face(g, { dx: 0.06, y: 0.14, z: 0.15, s: 0.85 });
  return g;
};

PETS.nest = () => {
  const g = G(), c = PET_COLORS.nest;
  tor(g, 0.15, 0.055, c, 0, 0.12, 0, Math.PI / 2).scale.set(1, 1, 1.15);       // 窝沿
  cyl(g, 0.12, 0.09, 0.1, '#B08D58', 0, 0.07, 0, 0, 0, 0, 14);                 // 窝身
  for (let i = 0; i < 5; i++) {                                                 // 交叉树枝
    const a = Math.PI * 2 * i / 5;
    box(g, 0.16, 0.014, 0.014, '#8A6844', Math.cos(a) * 0.12, 0.15, Math.sin(a) * 0.12, 0, -a, 0.3);
  }
  for (const [dx, dz] of [[-0.04, 0.03], [0.06, -0.02]])
    sph(g, 0.045, '#FFF6F0', dx, 0.16, dz, 0.85, 1.1, 0.85);                    // 两颗小鸟蛋
  face(g, { dx: 0.05, y: 0.16, z: 0.15, s: 0.75 });
  return g;
};

PETS.wood = () => {
  const g = G(), c = PET_COLORS.wood;
  cyl(g, 0.12, 0.13, 0.5, c, 0, 0.14, 0, 0, 0, Math.PI / 2);                   // 横放的原木
  cyl(g, 0.105, 0.105, 0.02, '#E8CFA8', 0.25, 0.14, 0, 0, 0, Math.PI / 2);     // 年轮切面
  tor(g, 0.06, 0.008, '#C9A46B', 0.262, 0.14, 0, 0, Math.PI / 2);
  for (const [z, len] of [[-0.12, 0.2], [0.06, 0.26]])
    box(g, 0.015, 0.015, len, '#8A6844', 0, 0.24, z);                           // 树皮纹
  cyl(g, 0.03, 0.035, 0.12, c, -0.1, 0.28, -0.05, 0, 0, 0.4);                  // 小树杈
  face(g, { dx: 0.055, y: 0.16, z: 0.13, s: 0.85 });
  return g;
};

// ================= 参数化词宠工厂（海岛批量词宠） =================
// spec 形如 'tpl:kind:arg'，由 autoPet() 解析。目标：小体积、有脸、有辨识度。

const BADGE_COLORS = ['#FFD9E8', '#FFF3C8', '#D8F0D0', '#D0E8F5', '#E8DFF5', '#FFE4CC'];

// 圆滚滚的小精灵身体（徽章类通用）
function blobBase(g, color = '#FFE9B8') {
  sph(g, 0.19, color, 0, 0.2, 0, 1, 1.02, 1);
  sph(g, 0.13, '#FFFFFF', 0, 0.06, 0.1, 1, 0.5, 0.9); // 肚皮
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
    sph(g, 0.045, color, 0.1 * lx, 0.045, 0.1 * lz, 1, 0.7, 1.3); // 小脚
  return g;
}
// 肚皮上的大 emoji 徽章（导出给场景物复用）
export function badge(g, emoji, y = 0.24, size = 0.2) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(emoji, '#FFFFFF', '#333'), transparent: true }));
  s.scale.setScalar(size * 3.4);
  s.center.set(0.5, 0.5);
  s.position.set(0, y, 0.16);
  s.renderOrder = 2;
  g.add(s);
  return s;
}
// 头顶小旗/小星
function topper(g, color = '#FF8FB0') {
  cyl(g, 0.008, 0.008, 0.12, '#8A6844', 0, 0.44, -0.05);
  sph(g, 0.04, color, 0, 0.52, -0.05, 1, 1, 1, 0, 0, 0, { emissive: color, ei: 0.4 });
}

const AUTO_TEMPLATES = {};

// ---- 色彩小水滴 / 情绪果冻 ----
AUTO_TEMPLATES.drop = (arg) => {
  const g = G();
  sph(g, 0.19, arg, 0, 0.24, 0, 1, 1.15, 1);
  sph(g, 0.06, arg, 0, 0.46, 0, 1, 1.2, 1);           // 水滴尖
  sph(g, 0.12, '#FFFFFF', -0.06, 0.3, 0.12, 1, 0.6, 0.5, 0, 0, 0, { alpha: 0.55 });
  face(g, { dx: 0.06, y: 0.2, z: 0.16 });
  return g;
};
AUTO_TEMPLATES.feel = (kind) => {
  const g = G();
  const colors = { happy: '#FFD44E', sad: '#8FB8E0', angry: '#F0604A', afraid: '#B8A0E0', worried: '#A8D0A8' };
  blobBase(g, colors[kind] || '#FFD44E');
  face(g, { dx: 0.06, y: 0.22, z: 0.17 });
  const mouths = {
    happy: () => tor(g, 0.05, 0.012, '#C24232', 0, 0.12, 0.175, -0.5),
    sad: () => { tor(g, 0.05, 0.012, '#C24232', 0, 0.1, 0.175, 0.6); sph(g, 0.02, '#7EC4F2', 0.08, 0.12, 0.18, 1, 1.4, 1, 0, 0, 0, { alpha: 0.85 }); },
    angry: () => { for (const sx of [-1, 1]) box(g, 0.07, 0.015, 0.02, '#7A2E22', 0.065 * sx, 0.28, 0.165, 0, 0, sx * 0.5); tor(g, 0.04, 0.012, '#C24232', 0, 0.11, 0.175, 0.7); },
    afraid: () => { sph(g, 0.035, '#4A4046', 0, 0.12, 0.18, 1, 1.1, 0.6); for (const sx of [-1, 1]) sph(g, 0.03, '#FFFFFF', 0.12 * sx, 0.24, 0.16, 1, 0.5, 0.4, 0, 0, 0, { alpha: 0.8 }); },
    worried: () => { for (const sx of [-1, 1]) box(g, 0.06, 0.014, 0.02, '#7A5A22', 0.065 * sx, 0.28, 0.165, 0, 0, -sx * 0.35); tor(g, 0.04, 0.012, '#C24232', 0, 0.1, 0.175, 0.5); },
  };
  mouths[kind] && mouths[kind]();
  return g;
};

// ---- 水果 ----
AUTO_TEMPLATES.fruit2 = (kind) => {
  const g = G();
  if (kind === 'orange') {
    sph(g, 0.19, '#FF9A3C', 0, 0.2, 0);
    for (let i = 0; i < 5; i++) tor(g, 0.185, 0.008, '#F0862A', 0, 0.2, 0, 0, 0, Math.PI * 2 * i / 5, Math.PI).scale.setScalar(0.99);
    sph(g, 0.035, '#66BB6A', 0, 0.4, 0, 1.3, 0.4, 0.8);
    face(g, { dx: 0.07, y: 0.22, z: 0.17 });
  } else if (kind === 'pear') {
    sph(g, 0.13, '#C8D96F', 0, 0.3, 0);
    sph(g, 0.17, '#B8CE5C', 0, 0.15, 0, 1, 0.9, 1);
    cyl(g, 0.015, 0.015, 0.08, '#8A6844', 0, 0.44, 0);
    sph(g, 0.05, '#66BB6A', 0.06, 0.46, 0, 1.3, 0.4, 0.8);
    face(g, { dx: 0.06, y: 0.18, z: 0.15 });
  } else if (kind === 'watermelon') {
    sph(g, 0.21, '#4E9E4E', 0, 0.21, 0, 1, 0.92, 1);
    for (let i = 0; i < 4; i++) {
      const stripe = tor(g, 0.205, 0.02, '#3E7E3E', 0, 0.21, 0, 0, Math.PI * 2 * i / 8 + 0.4, 0);
      stripe.scale.setScalar(1.002);
    }
    face(g, { dx: 0.07, y: 0.22, z: 0.19 });
  } else if (kind === 'grape') {
    let gi = 0;
    for (const [dx, dy, dz] of [[-0.07, 0.3, 0], [0.07, 0.3, 0.02], [0, 0.3, -0.05], [-0.05, 0.16, 0.03], [0.06, 0.16, -0.03], [0, 0.16, 0.05], [0, 0.03, 0]])
      sph(g, 0.075, gi++ % 2 ? '#B07CE0' : '#9C6BD0', dx, dy, dz);
    cyl(g, 0.012, 0.012, 0.08, '#8A6844', 0, 0.42, 0);
    sph(g, 0.045, '#66BB6A', 0.07, 0.45, 0, 1.3, 0.4, 0.8);
    face(g, { dx: 0.05, y: 0.2, z: 0.1, s: 0.8 });
  }
  return g;
};

// ---- 食物 ----
AUTO_TEMPLATES.food = (kind) => {
  const g = G();
  if (kind === 'candy') {
    sph(g, 0.17, '#FF8FB0', 0, 0.26, 0, 1, 0.92, 0.55);
    sph(g, 0.05, '#E0678D', -0.19, 0.26, 0, 1.2, 1, 0.5); sph(g, 0.05, '#E0678D', 0.19, 0.26, 0, 1.2, 1, 0.5);
    cyl(g, 0.015, 0.017, 0.26, '#FFF6EC', 0, 0.09, 0);
    face(g, { dx: 0.055, y: 0.27, z: 0.1, s: 0.8 });
  } else if (kind === 'fruitbasket') {
    cyl(g, 0.16, 0.12, 0.16, '#C89A6B', 0, 0.1, 0, 0, 0, 0, 14);
    for (const [dx, dy, c] of [[-0.07, 0.22, '#FF6B6B'], [0.07, 0.22, '#FFD44E'], [0, 0.33, '#8FD08F']])
      sph(g, 0.07, c, dx, dy, 0);
    face(g, { dx: 0.055, y: 0.12, z: 0.13, s: 0.8 });
  } else if (kind === 'rice') {
    cyl(g, 0.15, 0.11, 0.14, '#E8F0F5', 0, 0.09, 0, 0, 0, 0, 16);
    sph(g, 0.12, '#FFFFFF', 0, 0.17, 0, 1, 0.55, 1);
    face(g, { dx: 0.055, y: 0.19, z: 0.14, s: 0.8 });
    for (let i = 0; i < 3; i++) sph(g, 0.012, '#E8E0D0', -0.06 + i * 0.06, 0.26, 0.1);
  } else if (kind === 'burger') {
    cyl(g, 0.17, 0.18, 0.05, '#E8A85C', 0, 0.04, 0, 0, 0, 0, 16);
    cyl(g, 0.165, 0.165, 0.05, '#7CC96F', 0, 0.1, 0, 0, 0, 0, 16);
    cyl(g, 0.16, 0.16, 0.06, '#8A5230', 0, 0.16, 0, 0, 0, 0, 16);
    sph(g, 0.17, '#E8B85C', 0, 0.26, 0, 1, 0.55, 1);
    face(g, { dx: 0.06, y: 0.2, z: 0.15 });
  } else if (kind === 'beef') {
    sph(g, 0.17, '#B05A3C', 0, 0.16, 0, 1.15, 0.6, 1);
    sph(g, 0.15, '#C96A48', 0, 0.18, 0.02, 1, 0.5, 0.9);
    face(g, { dx: 0.06, y: 0.18, z: 0.15, s: 0.85 });
  } else if (kind === 'chicken') {
    sph(g, 0.18, '#E8A85C', 0, 0.18, 0, 1, 0.9, 1.15);
    for (const sx of [-1, 1]) sph(g, 0.06, '#D9964A', 0.16 * sx, 0.12, 0.06, 1, 0.5, 1.3);
    cyl(g, 0.02, 0.025, 0.08, '#FFF6EC', 0, 0.12, -0.2, -0.5);
    face(g, { dx: 0.06, y: 0.22, z: 0.16 });
  } else if (kind === 'noodles') {
    cyl(g, 0.16, 0.12, 0.12, '#5CA8D9', 0, 0.08, 0, 0, 0, 0, 16);
    for (let i = 0; i < 5; i++) {
      const n = cap(g, 0.014, 0.14, '#FFE8B0', -0.08 + i * 0.04, 0.22, 0, -0.9 - (i % 2) * 0.3);
    }
    face(g, { dx: 0.055, y: 0.12, z: 0.14, s: 0.8 });
  } else if (kind === 'soup') {
    cyl(g, 0.16, 0.12, 0.12, '#F0C860', 0, 0.08, 0, 0, 0, 0, 16);
    cyl(g, 0.135, 0.135, 0.02, '#FF9A5C', 0, 0.15, 0, 0, 0, 0, 16);
    for (const [dx, dz] of [[-0.05, 0.03], [0.06, -0.02]])
      sph(g, 0.03, '#7CC96F', dx, 0.16, dz, 1, 0.5, 1);
    face(g, { dx: 0.055, y: 0.12, z: 0.14, s: 0.8 });
  } else if (kind === 'vegetable') {
    for (const [dx, dz, c] of [[-0.09, 0, '#7CC96F'], [0.09, 0.02, '#8FD08F'], [0, -0.08, '#6FBF73']]) {
      cap(g, 0.05, 0.14, c, dx, 0.15, dz, 0, 0, 0.3);
      sph(g, 0.055, c, dx, 0.28, dz);
    }
    face(g, { dx: 0.05, y: 0.18, z: 0.13, s: 0.8 });
  } else if (kind === 'breakfast' || kind === 'lunch' || kind === 'dinner') {
    const plateC = { breakfast: '#FFE0B8', lunch: '#D8F0D0', dinner: '#F5D9E0' }[kind];
    cyl(g, 0.2, 0.2, 0.03, '#FFFFFF', 0, 0.03, 0, 0, 0, 0, 18);
    cyl(g, 0.15, 0.15, 0.025, plateC, 0, 0.055, 0, 0, 0, 0, 18);
    sph(g, 0.06, '#FFD44E', -0.05, 0.09, 0, 1.2, 0.6, 1.2);
    sph(g, 0.05, '#E8836F', 0.07, 0.09, 0.02);
    face(g, { dx: 0.05, y: 0.08, z: 0.16, s: 0.7 });
  } else if (kind === 'sandwich') {
    box(g, 0.3, 0.04, 0.3, '#F0C878', 0, 0.05, 0);
    box(g, 0.29, 0.045, 0.28, '#7CC96F', 0, 0.1, 0);
    box(g, 0.28, 0.04, 0.27, '#E8735C', 0, 0.145, 0);
    box(g, 0.28, 0.04, 0.28, '#F5D098', 0, 0.19, 0);
    face(g, { dx: 0.055, y: 0.12, z: 0.16, s: 0.8 });
  } else if (kind === 'salad') {
    sph(g, 0.17, '#E8F4D9', 0, 0.14, 0, 1, 0.55, 1);
    for (const [dx, dz, c] of [[-0.07, 0.03, '#7CC96F'], [0.06, 0.05, '#FF6B6B'], [0.02, -0.06, '#FFD44E'], [0.09, -0.04, '#8FD08F']])
      sph(g, 0.045, c, dx, 0.19, dz, 1, 0.6, 1);
    face(g, { dx: 0.055, y: 0.14, z: 0.14, s: 0.8 });
  } else if (kind === 'sweet') {
    cyl(g, 0.12, 0.14, 0.08, '#FFD9E8', 0, 0.06, 0, 0, 0, 0, 16);
    sph(g, 0.11, '#FFF0F5', 0, 0.13, 0, 1, 0.6, 1);
    sph(g, 0.03, '#E84B4B', 0, 0.2, 0);
    face(g, { dx: 0.05, y: 0.13, z: 0.12, s: 0.75 });
  }
  return g;
};

// ---- 饮品 ----
AUTO_TEMPLATES.drink = (kind) => {
  const g = G();
  const colors = { juice: '#FFB347', water: '#A8D8F0', tea: '#B8865C' };
  const c = colors[kind] || '#A8D8F0';
  cyl(g, 0.1, 0.08, 0.22, '#FFFDF6', 0, 0.13, 0, 0, 0, 0, 14);
  cyl(g, 0.085, 0.085, 0.03, c, 0, 0.21, 0, 0, 0, 0, 14);
  cap(g, 0.008, 0.14, '#FF8FB0', 0.03, 0.3, 0, 0, 0, 0.25);
  face(g, { dx: 0.05, y: 0.12, z: 0.09, s: 0.75 });
  return g;
};

// ---- 身体部位 ----
AUTO_TEMPLATES.body = (kind) => {
  const g = G(), skin = '#FFE0CC';
  if (kind === 'face') {
    sph(g, 0.19, skin, 0, 0.2, 0, 1, 1.05, 0.95);
    face(g, { dx: 0.075, y: 0.19, z: 0.175, s: 1.2, blush: 0.13 });
    tor(g, 0.06, 0.012, '#C24232', 0, 0.08, 0.185, -0.4);
  } else if (kind === 'ear') {
    sph(g, 0.13, skin, 0, 0.2, 0, 1, 1.15, 0.6);
    sph(g, 0.09, '#F5C9B0', 0, 0.2, 0.06, 0.8, 0.9, 0.5);
    face(g, { dx: 0.045, y: 0.22, z: 0.13, s: 0.7 });
  } else if (kind === 'eye') {
    sph(g, 0.17, '#FFFFFF', 0, 0.2, 0, 1, 1.05, 0.9);
    sph(g, 0.09, '#4A90D9', 0, 0.2, 0.13);
    sph(g, 0.045, '#2E2E38', 0, 0.2, 0.2);
    sph(g, 0.025, '#FFFFFF', 0.03, 0.24, 0.22);
    for (const sx of [-1, 1]) sph(g, 0.04, '#FFB3C1', 0.13 * sx, 0.1, 0.1, 1, 0.55, 0.4);
    face(g, { dx: 0.045, y: 0.32, z: 0.14, s: 0.6 });
  } else if (kind === 'nose') {
    sph(g, 0.14, skin, 0, 0.16, 0, 1, 0.85, 1);
    sph(g, 0.05, '#F0B8A0', -0.04, 0.2, 0.11); sph(g, 0.05, '#F0B8A0', 0.04, 0.2, 0.11);
    face(g, { dx: 0.055, y: 0.14, z: 0.13, s: 0.8 });
  } else if (kind === 'mouth') {
    sph(g, 0.15, skin, 0, 0.2, 0, 1.05, 0.9, 0.85);
    sph(g, 0.09, '#E8736F', 0, 0.16, 0.11, 1.2, 0.7, 0.6);
    sph(g, 0.05, '#E8736F', 0, 0.1, 0.13, 1.3, 0.5, 0.6);
    face(g, { dx: 0.06, y: 0.26, z: 0.12, s: 0.7 });
  } else if (kind === 'arm' || kind === 'leg') {
    cap(g, 0.07, 0.22, skin, 0, 0.2, 0, 0, 0, kind === 'leg' ? 0 : 0.5);
    sph(g, 0.075, skin, kind === 'leg' ? 0 : 0.1, kind === 'leg' ? 0.04 : 0.3, 0);
    face(g, { dx: 0.05, y: 0.24, z: 0.08, s: 0.7 });
  } else if (kind === 'hand') {
    sph(g, 0.12, skin, 0, 0.16, 0, 1, 0.8, 0.6);
    for (let i = 0; i < 4; i++) cap(g, 0.024, 0.1, skin, -0.07 + i * 0.047, 0.32, 0);
    cap(g, 0.026, 0.08, skin, -0.11, 0.12, 0.02, 0, 0, 0.9);
    face(g, { dx: 0.045, y: 0.14, z: 0.1, s: 0.7 });
  } else if (kind === 'head') {
    sph(g, 0.19, skin, 0, 0.2, 0, 1, 1.02, 0.98);
    sph(g, 0.195, '#8A5A3C', 0, 0.24, -0.02, 1, 0.72, 1);
    face(g, { dx: 0.07, y: 0.16, z: 0.17 });
  } else if (kind === 'body') {
    cap(g, 0.14, 0.16, '#7EA8E8', 0, 0.22, 0).scale.set(1, 1.1, 0.8);
    sph(g, 0.13, skin, 0, 0.42, 0, 1, 0.9, 0.9);
    face(g, { dx: 0.05, y: 0.44, z: 0.11, s: 0.7 });
  } else if (kind === 'hair') {
    sph(g, 0.15, '#8A5A3C', 0, 0.22, 0, 1.05, 0.95, 0.9);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 * i / 5;
      cap(g, 0.035, 0.1, '#7A4A30', Math.cos(a) * 0.12, 0.12 + Math.sin(i * 2) * 0.03, Math.sin(a) * 0.1);
    }
    face(g, { dx: 0.055, y: 0.18, z: 0.13, s: 0.8 });
  }
  return g;
};

// ---- 野兽（老虎/大象/长颈鹿/骡子/动物精灵） ----
AUTO_TEMPLATES.quad = (kind) => {
  const g = G();
  const conf = {
    tiger: { c: '#F0A040', stripes: true },
    elephant: { c: '#A8B0C0', trunk: true, bigears: true },
    giraffe: { c: '#E8C46B', longneck: true, patches: true, horns: true },
    mule: { c: '#8A7460', mane: true },
    animal: { c: '#E8A8B8', mane: false },
  }[kind] || { c: '#E8A8B8' };
  const legH = conf.longneck ? 0.22 : 0.14;
  cap(g, 0.15, 0.18 * 1.2, conf.c, 0, legH + 0.14, -0.02, Math.PI / 2).scale.set(1, 1.2, 1);
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
    cyl(g, 0.042, 0.05, legH, conf.c, 0.1 * lx, legH / 2, 0.12 * lz);
  const head = G();
  head.position.set(0, conf.longneck ? legH + 0.62 : legH + 0.26, conf.longneck ? 0.08 : 0.2);
  g.add(head);
  if (conf.longneck) {
    cap(g, 0.07, 0.36, conf.c, 0, legH + 0.3, 0.06, 0.25);
    for (let i = 0; i < 4; i++) sph(g, 0.035, '#B8863C', (i % 2 ? 0.05 : -0.05), legH + 0.22 + i * 0.1, 0.1 + i * 0.02, 1, 0.7, 0.5);
  }
  sph(head, conf.longneck ? 0.13 : 0.17, conf.c);
  if (conf.stripes) for (let i = 0; i < 3; i++) tor(g, 0.148 - i * 0.008, 0.018, '#3E3A34', 0, legH + 0.16 + i * 0.09, -0.02 - i * 0.02, 0, 0, 0, Math.PI).scale.set(0.98, 1, 1);
  if (conf.trunk) {
    cap(head, 0.045, 0.2, conf.c, 0, -0.1, 0.14, 1.1);
    for (const sx of [-1, 1]) sph(head, 0.09, conf.c, 0.14 * sx, 0.1, -0.02, 1, 1.1, 0.4);
  } else if (conf.bigears) {
    for (const sx of [-1, 1]) sph(head, 0.06, conf.c, 0.14 * sx, 0.1, -0.02, 1, 1.2, 0.4);
  } else {
    for (const sx of [-1, 1]) sph(head, 0.055, conf.c, 0.13 * sx, 0.12, -0.02, 1, 1.1, 0.5);
  }
  if (conf.mane) for (let i = 0; i < 3; i++) sph(head, 0.05, '#5C4838', 0, 0.16 - i * 0.04, -0.1 + i * 0.03, 1, 0.8, 0.6);
  if (conf.horns) for (const sx of [-1, 1]) { cyl(head, 0.012, 0.012, 0.08, '#B8863C', 0.06 * sx, 0.17, -0.02, 0, 0, sx * 0.3); sph(head, 0.02, '#3E3A34', 0.075 * sx, 0.22, -0.02); }
  if (conf.patches) for (const [dx, dy] of [[0.08, 0.24], [-0.1, 0.3], [0.14, 0.34]])
    sph(head, 0.03, '#B8863C', dx, dy, 0.12, 1, 0.8, 0.4);
  face(head, { dx: conf.longneck ? 0.05 : 0.07, y: conf.longneck ? 0.02 : 0.03, z: conf.longneck ? 0.11 : 0.15, s: conf.longneck ? 0.8 : 0.95 });
  cap(g, 0.035, 0.14, conf.c, 0, legH + 0.24, -0.22, -Math.PI / 2.4).scale.set(1, 1, 0.55);
  return g;
};

// ---- 数字宝宝 ----
AUTO_TEMPLATES.num = (arg) => {
  const g = G();
  const c = BADGE_COLORS[parseInt(arg, 10) % BADGE_COLORS.length];
  blobBase(g, c);
  // 肚皮上的数字
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(arg, '#FFFFFF', '#5A4632'), transparent: true }));
  s.scale.setScalar(0.62);
  s.position.set(0, 0.24, 0.14);
  s.renderOrder = 2;
  g.add(s);
  face(g, { dx: 0.07, y: 0.33, z: 0.15, s: 0.85 });
  topper(g, '#FFC94E');
  return g;
};

// ---- 人物（chibi 小人 + 职业装扮 + 动作徽章） ----
const DOLL_ROLE = {
  man: { shirt: '#5C8FD9', hair: '#4A3626' }, woman: { shirt: '#E87FA8', hair: '#7A4A2C', skirt: true },
  father: { shirt: '#5C9E6F', hair: '#4A3626' }, mother: { shirt: '#F0A0C0', hair: '#7A4A2C', skirt: true },
  grandmother: { shirt: '#C8B0D9', hair: '#C8C8CE', gray: true, skirt: true }, grandfather: { shirt: '#8FA8C0', hair: '#C8C8CE', gray: true },
  sister: { shirt: '#FFB36B', hair: '#7A4A2C', skirt: true, kid: true }, brother: { shirt: '#7CC4E8', hair: '#4A3626', kid: true },
  parents: { shirt: '#5C9E6F', hair: '#4A3626', pair: true }, family: { shirt: '#F0A0C0', hair: '#4A3626', trio: true },
  uncle: { shirt: '#E8A85C', hair: '#3A2A1A' }, aunt: { shirt: '#C878B8', hair: '#5C3A1E', skirt: true },
  hello: { shirt: '#FFD44E', hair: '#4A3626', wave: true }, hi: { shirt: '#7CC96F', hair: '#7A4A2C', wave: true },
  goodbye: { shirt: '#B8A0E0', hair: '#4A3626', wave: true },
  student: { shirt: '#FFFFFF', hair: '#4A3626', extra: 'bag', kid: true },
  teacher: { shirt: '#E8E4D8', hair: '#4A3626', glasses: true, extra: 'book' },
  friend: { shirt: '#FF9FB6', hair: '#5C3A1E', heart: true, kid: true },
  boy: { shirt: '#7EA8E8', hair: '#4A3626', kid: true }, girl: { shirt: '#FF9FB6', hair: '#7A4A2C', skirt: true, kid: true },
  doctor: { shirt: '#FFFFFF', hair: '#3A2A1A', capC: '#FFFFFF', extra: 'medic' },
  driver: { shirt: '#4A6B9C', hair: '#3A2A1A', capC: '#4A6B9C' },
  farmer: { shirt: '#C8A85C', hair: '#3A2A1A', straw: true },
  nurse: { shirt: '#FFE0E8', hair: '#5C3A1E', capC: '#FFFFFF' },
  postman: { shirt: '#4A8FD9', hair: '#3A2A1A', capC: '#4A8FD9', extra: 'bag' },
  businessman: { shirt: '#3A4254', hair: '#2E2216', extra: 'case' },
  fisherman: { shirt: '#6B9C7A', hair: '#3A2A1A', straw: true, extra: 'rod' },
  scientist: { shirt: '#FFFFFF', hair: '#5C4838', glasses: true, extra: 'flask' },
  pilot: { shirt: '#4A5A78', hair: '#3A2A1A', capC: '#31405C', extra: 'wings' },
  coach: { shirt: '#D95F4B', hair: '#2E2216', capC: '#D95F4B', extra: 'whistle' },
  reporter: { shirt: '#E8C46B', hair: '#7A4A2C', extra: 'mic' },
  dance: { shirt: '#FF9FD0', hair: '#7A4A2C', skirt: true, badge: '💃' },
  cook: { shirt: '#FFFFFF', hair: '#3A2A1A', capC: '#FFFFFF', badge: '🍳' },
  swim: { shirt: '#7EC4F2', hair: '#4A3626', badge: '🏊' },
  singing: { shirt: '#FFB36B', hair: '#5C3A1E', badge: '🎤' },
  dancing: { shirt: '#E87FD0', hair: '#4A3626', skirt: true, badge: '💃' },
  cooking: { shirt: '#F5D098', hair: '#3A2A1A', badge: '🍳' },
  sleeping: { shirt: '#C8D8F5', hair: '#4A3626', badge: '😴' },
  running: { shirt: '#FF8A5C', hair: '#3A2A1A', badge: '🏃' },
  jumping: { shirt: '#8FD08F', hair: '#4A3626', badge: '🤸' },
  playing: { shirt: '#FFD44E', hair: '#5C3A1E', badge: '🎮' },
  eating: { shirt: '#F5C878', hair: '#7A4A2C', badge: '🍽️' },
  drinking: { shirt: '#A8D8F0', hair: '#3A2A1A', badge: '🥤' },
  climbing: { shirt: '#8FBF6F', hair: '#4A3626', badge: '🧗' },
  cycling: { shirt: '#7EC4F2', hair: '#3A2A1A', badge: '🚴' },
  iceskate: { shirt: '#B8E0F5', hair: '#7A4A2C', badge: '⛸️' },
};
AUTO_TEMPLATES.doll = (role) => {
  const conf = DOLL_ROLE[role] || { shirt: '#FFB36B', hair: '#4A3626' };
  const g = G();
  const skin = '#FFE0CC';
  const sc = conf.kid ? 0.85 : 1;
  const mkDoll = (shirt, hairC, x = 0, gray = false, sk = 1, skirt = false) => {
    const d = G();
    d.position.x = x;
    d.scale.setScalar(sk);
    // 身体
    cyl(d, 0.11, 0.16, 0.2, shirt, 0, 0.2, 0, 0, 0, 0, 14);
    if (skirt) cyl(d, 0.155, 0.21, 0.09, shirt, 0, 0.08, 0, 0, 0, 0, 16);
    // 腿脚
    for (const sx of [-1, 1]) cyl(d, 0.032, 0.036, 0.12, '#5C6B8A', 0.05 * sx, 0.02, 0);
    // 手臂
    for (const sx of [-1, 1]) {
      const arm = cap(d, 0.026, 0.1, skin, 0.14 * sx, 0.2, 0, 0, 0, conf.wave && sx === 1 ? -0.9 : sx * 0.15);
    }
    // 头
    const head = G(); head.position.set(0, 0.42, 0); d.add(head);
    sph(head, 0.15, skin);
    sph(head, 0.153, gray ? '#C8C8CE' : hairC, 0, 0.035, -0.015, 1.03, 0.85, 1.02);
    if (conf.skirt || role === 'woman' || role === 'mother') sph(head, 0.05, gray ? '#C8C8CE' : hairC, 0.13, 0.02, -0.02, 0.7, 1.3, 0.9);
    if (gray) sph(head, 0.05, '#E8E4DC', 0, -0.06, 0.12, 1.2, 0.8, 0.6); // 胡子
    // 眼睛（简易）
    for (const sx of [-1, 1]) {
      sph(head, 0.024, '#4A4046', 0.055 * sx, 0.015, 0.13, 1, 1.3, 0.5);
      sph(head, 0.008, '#FFFFFF', 0.063 * sx, 0.04, 0.142);
    }
    sph(head, 0.028, '#FFB3C1', 0.095 * 1, -0.03, 0.11, 1, 0.6, 0.4);
    sph(head, 0.028, '#FFB3C1', -0.095, -0.03, 0.11, 1, 0.6, 0.4);
    // 帽子/眼镜/徽章
    if (conf.capC) { cyl(head, 0.1, 0.12, 0.05, conf.capC, 0, 0.15, 0, 0, 0, 0, 14); cyl(head, 0.11, 0.11, 0.015, conf.capC, 0, 0.125, 0.05, 0.3); }
    if (conf.straw) { cyl(head, 0.12, 0.2, 0.03, '#F5D76E', 0, 0.13, 0, 0, 0, 0, 16); sph(head, 0.11, '#F5D76E', 0, 0.15, 0, 1, 0.55, 1); }
    if (conf.glasses) for (const sx of [-1, 1]) { tor(head, 0.035, 0.008, '#4A4046', 0.055 * sx, 0.015, 0.145); }
    if (conf.extra === 'bag') { box(d, 0.12, 0.14, 0.05, '#C89A5B', 0, 0.18, -0.13); }
    if (conf.extra === 'book') { box(d, 0.1, 0.03, 0.14, '#D95F4B', 0.15, 0.26, 0.05); }
    if (conf.extra === 'medic') { sph(head, 0.025, '#E84B4B', 0, 0.16, 0.12, 1, 1, 0.4); }
    if (conf.extra === 'case') { box(d, 0.14, 0.1, 0.04, '#6B4A2C', 0.16, 0.12, 0); }
    if (conf.extra === 'rod') { cyl(d, 0.008, 0.008, 0.4, '#8A6844', 0.15, 0.3, 0, 0, 0, 0.5); }
    if (conf.extra === 'flask') { cyl(d, 0.025, 0.03, 0.08, '#7EC4F2', 0.15, 0.24, 0.05); }
    if (conf.extra === 'wings') { sph(head, 0.03, '#FFD44E', 0, 0.05, 0.15, 1.4, 0.5, 0.3); }
    if (conf.extra === 'whistle') { sph(d, 0.025, '#FFC94E', 0.1, 0.3, 0.1); }
    if (conf.extra === 'mic') { cyl(d, 0.015, 0.015, 0.1, '#4A4046', 0.16, 0.26, 0.08, 0.4); sph(d, 0.028, '#8A8A96', 0.19, 0.32, 0.1); }
    if (conf.heart) { sph(d, 0.03, '#FF6B8A', 0.15, 0.3, 0.06, 1, 0.9, 0.5); sph(d, 0.03, '#FF6B8A', 0.11, 0.3, 0.06, 1, 0.9, 0.5); }
    if (conf.badge) badge(d, conf.badge, 0.24, 0.15);
    return d;
  };
  if (conf.trio) { g.add(mkDoll(conf.shirt, conf.hair, -0.14, false, 0.8), mkDoll('#5C9E6F', '#4A3626', 0, false, 1), mkDoll('#FFB36B', '#7A4A2C', 0.14, false, 0.8)); }
  else if (conf.pair) { g.add(mkDoll('#5C9E6F', '#4A3626', -0.12), mkDoll('#F0A0C0', '#7A4A2C', 0.12, false, 1, true)); }
  else g.add(mkDoll(conf.shirt, conf.hair, 0, conf.gray, sc, conf.skirt));
  return g;
};

// ---- 文具 & 餐具 ----
AUTO_TEMPLATES.tool = (kind) => {
  const g = G();
  if (kind === 'chopsticks') {
    for (const sx of [-1, 1]) cyl(g, 0.014, 0.011, 0.42, '#C8734A', 0.035 * sx, 0.22, 0, 0, 0, sx * 0.06);
    face(g, { dx: 0.04, y: 0.34, z: 0.03, s: 0.65 });
  } else if (kind === 'bowl') {
    cyl(g, 0.15, 0.1, 0.14, '#5CA8D9', 0, 0.1, 0, 0, 0, 0, 18);
    cyl(g, 0.15, 0.15, 0.02, '#7CC4F2', 0, 0.18, 0, 0, 0, 0, 18);
    face(g, { dx: 0.055, y: 0.12, z: 0.14, s: 0.85 });
  } else if (kind === 'fork' || kind === 'knife') {
    if (kind === 'fork') {
      cyl(g, 0.018, 0.014, 0.2, '#C0C4CE', 0, 0.13, 0);
      for (let i = 0; i < 4; i++) cyl(g, 0.008, 0.008, 0.09, '#C0C4CE', -0.045 + i * 0.03, 0.3, 0);
    } else {
      cyl(g, 0.018, 0.014, 0.2, '#C0C4CE', 0, 0.13, 0);
      box(g, 0.05, 0.14, 0.015, '#C0C4CE', 0.025, 0.31, 0, 0, 0, 0.3);
    }
    face(g, { dx: 0.035, y: 0.13, z: 0.03, s: 0.65 });
  } else if (kind === 'spoon') {
    cyl(g, 0.018, 0.014, 0.2, '#C0C4CE', 0, 0.12, 0);
    sph(g, 0.055, '#C0C4CE', 0, 0.3, 0, 0.8, 1.15, 0.45);
    face(g, { dx: 0.035, y: 0.12, z: 0.03, s: 0.65 });
  } else if (kind === 'book' || kind === 'notebook' || kind === 'dictionary') {
    const c = kind === 'book' ? '#D95F4B' : kind === 'notebook' ? '#5CA8D9' : '#8A6AC4';
    const h = kind === 'dictionary' ? 0.3 : 0.24;
    box(g, 0.28, h, 0.08, c, 0, 0.14, 0);
    box(g, 0.26, h - 0.03, 0.07, '#FFFDF4', 0.012, 0.14, 0.005);
    face(g, { dx: 0.05, y: 0.16, z: 0.11, s: 0.75 });
  } else if (kind === 'pencil' || kind === 'pen') {
    const c = kind === 'pencil' ? '#F0C05C' : '#3E5E9E';
    cap(g, 0.03, 0.34, c, 0, 0.22, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 1);
    cone(g, 0.03, 0.08, '#F5D7A8', -0.22, 0.22, 0, 0, 0, -Math.PI / 2);
    sph(g, 0.014, '#4A4046', -0.265, 0.22, 0);
    if (kind === 'pen') cyl(g, 0.032, 0.032, 0.06, '#C0C4CE', 0.1, 0.22, 0, 0, 0, Math.PI / 2);
    face(g, { dx: 0.04, y: 0.26, z: 0.04, s: 0.7 });
  } else if (kind === 'ruler') {
    box(g, 0.44, 0.12, 0.02, '#8FD0E8', 0, 0.14, 0);
    for (let i = 0; i < 5; i++) box(g, 0.008, 0.05, 0.005, '#4E8EA8', -0.16 + i * 0.08, 0.17, 0.012);
    face(g, { dx: 0.05, y: 0.1, z: 0.03, s: 0.7 });
  } else if (kind === 'eraser') {
    box(g, 0.18, 0.1, 0.1, '#FF8FB0', 0, 0.08, 0);
    box(g, 0.18, 0.035, 0.1, '#FFF6EC', 0, 0.145, 0);
    face(g, { dx: 0.045, y: 0.08, z: 0.06, s: 0.7 });
  }
  return g;
};

// ---- 家具 & 家电 ----
AUTO_TEMPLATES.furn = (kind) => {
  const g = G();
  if (kind === 'bed') {
    box(g, 0.44, 0.08, 0.6, '#C89A6B', 0, 0.08, 0);
    sph(g, 0.1, '#FFF6EC', 0, 0.16, -0.22, 1, 0.6, 1.2);
    box(g, 0.38, 0.06, 0.34, '#FF9FB6', 0, 0.13, 0.08);
    face(g, { dx: 0.05, y: 0.1, z: 0.2, s: 0.7 });
  } else if (kind === 'sofa') {
    box(g, 0.5, 0.16, 0.24, '#E8836F', 0, 0.1, 0);
    box(g, 0.5, 0.22, 0.1, '#E8836F', 0, 0.24, -0.1);
    for (const sx of [-1, 1]) box(g, 0.1, 0.2, 0.24, '#D96F5C', 0.22 * sx, 0.2, 0);
    face(g, { dx: 0.07, y: 0.16, z: 0.14, s: 0.8 });
  } else if (kind === 'table' || kind === 'desk') {
    const w = kind === 'desk' ? 0.42 : 0.5;
    box(g, w, 0.04, 0.3, '#C89A6B', 0, 0.24, 0);
    for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      cyl(g, 0.025, 0.025, 0.22, '#A87E51', w / 2 * 0.8 * lx, 0.11, 0.11 * lz);
    face(g, { dx: 0.06, y: 0.27, z: 0.13, s: 0.75 });
  } else if (kind === 'chair') {
    box(g, 0.24, 0.04, 0.24, '#C89A6B', 0, 0.18, 0);
    box(g, 0.24, 0.22, 0.04, '#C89A6B', 0, 0.3, -0.1);
    for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
      cyl(g, 0.02, 0.02, 0.16, '#A87E51', 0.09 * lx, 0.08, 0.09 * lz);
    face(g, { dx: 0.05, y: 0.32, z: -0.06, s: 0.7 });
  } else if (kind === 'door' || kind === 'window' || kind === 'blackboard' || kind === 'picture') {
    if (kind === 'door') {
      box(g, 0.36, 0.56, 0.05, '#A87551', 0, 0.3, 0);
      sph(g, 0.03, '#FFC94E', 0.12, 0.3, 0.04);
      face(g, { dx: -0.06, y: 0.38, z: 0.04, s: 0.7 });
    } else if (kind === 'window') {
      box(g, 0.44, 0.34, 0.04, '#F0F8FF', 0, 0.3, 0);
      box(g, 0.46, 0.36, 0.03, '#C89A6B', 0, 0.3, -0.005, 0, 0, 0).scale.set(1.02, 1.04, 0.8);
      box(g, 0.03, 0.34, 0.05, '#C89A6B', 0, 0.3, 0);
      face(g, { dx: 0.07, y: 0.12, z: 0.04, s: 0.7 });
    } else if (kind === 'blackboard') {
      box(g, 0.5, 0.34, 0.03, '#3E6B50', 0, 0.3, 0);
      box(g, 0.53, 0.37, 0.025, '#C89A6B', 0, 0.3, -0.005).scale.set(1.03, 1.05, 0.7);
      face(g, { dx: 0.08, y: 0.22, z: 0.04, s: 0.75 });
    } else {
      box(g, 0.3, 0.36, 0.03, '#FFF6EC', 0, 0.3, 0);
      box(g, 0.32, 0.38, 0.02, '#C89A6B', 0, 0.3, -0.005).scale.set(1.03, 1.03, 0.7);
      sph(g, 0.05, '#FFC94E', -0.05, 0.34, 0.02, 1, 0.7, 0.4);
      face(g, { dx: 0.07, y: 0.2, z: 0.035, s: 0.7 });
    }
  } else if (kind === 'wall' || kind === 'floor') {
    if (kind === 'wall') {
      box(g, 0.5, 0.44, 0.12, '#F0D9C0', 0, 0.24, 0);
      for (let i = 0; i < 3; i++) box(g, 0.5, 0.01, 0.125, '#E0C8B0', 0, 0.1 + i * 0.14, 0);
      face(g, { dx: 0.08, y: 0.3, z: 0.07, s: 0.75 });
    } else {
      box(g, 0.5, 0.05, 0.5, '#C89A6B', 0, 0.05, 0);
      for (let i = 0; i < 4; i++) box(g, 0.5, 0.052, 0.015, '#B8865B', 0, 0.05, -0.18 + i * 0.12);
      face(g, { dx: 0.07, y: 0.09, z: 0.2, s: 0.7 });
    }
  } else if (kind === 'clock') {
    cyl(g, 0.17, 0.17, 0.05, '#E8836F', 0, 0.28, 0, 0, 0, 0, 18);
    cyl(g, 0.14, 0.14, 0.055, '#FFFDF4', 0, 0.28, 0, 0, 0, 0, 18);
    cyl(g, 0.01, 0.01, 0.09, '#4A4046', 0, 0.3, 0.03, 0, 0, 0.6);
    cyl(g, 0.008, 0.008, 0.11, '#4A4046', 0.03, 0.3, 0.032, 0, 0, -0.4);
    face(g, { dx: 0.05, y: 0.1, z: 0.05, s: 0.7 });
  } else if (kind === 'plant') {
    cyl(g, 0.09, 0.07, 0.12, '#D97F5C', 0, 0.07, 0, 0, 0, 0, 12);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 * i / 5;
      sph(g, 0.05, '#5CA85C', Math.cos(a) * 0.06, 0.2 + (i % 2) * 0.05, Math.sin(a) * 0.06, 1, 1.3, 0.5);
    }
    face(g, { dx: 0.045, y: 0.12, z: 0.07, s: 0.7 });
  } else if (kind === 'bottle') {
    cyl(g, 0.06, 0.07, 0.2, '#A8DCF0', 0, 0.12, 0, 0, 0, 0, 12);
    cyl(g, 0.025, 0.04, 0.07, '#A8DCF0', 0, 0.26, 0, 0, 0, 0, 10);
    cyl(g, 0.027, 0.027, 0.02, '#5CA8D9', 0, 0.3, 0, 0, 0, 0, 10);
    face(g, { dx: 0.04, y: 0.14, z: 0.06, s: 0.7 });
  } else if (kind === 'photo') {
    box(g, 0.2, 0.26, 0.02, '#C89A6B', 0, 0.24, 0);
    box(g, 0.15, 0.18, 0.025, '#BDE3F0', 0, 0.27, 0.012);
    sph(g, 0.045, '#FFC94E', -0.04, 0.32, 0.03, 1, 1, 0.4);
    face(g, { dx: 0.05, y: 0.14, z: 0.03, s: 0.7 });
  } else if (kind === 'computer') {
    box(g, 0.3, 0.03, 0.2, '#C0C4CE', 0, 0.12, 0);
    box(g, 0.32, 0.22, 0.02, '#3E4450', 0, 0.3, -0.06, -0.15);
    box(g, 0.28, 0.17, 0.005, '#7EC4F2', 0, 0.3, -0.048, -0.15);
    face(g, { dx: 0.06, y: 0.14, z: 0.1, s: 0.7 });
  } else if (kind === 'phone') {
    box(g, 0.14, 0.26, 0.03, '#3E4450', 0, 0.2, 0);
    box(g, 0.12, 0.2, 0.035, '#7EC4F2', 0, 0.22, 0.002);
    face(g, { dx: 0.04, y: 0.08, z: 0.03, s: 0.6 });
  } else if (kind === 'fridge') {
    box(g, 0.3, 0.56, 0.26, '#E8ECF0', 0, 0.28, 0);
    box(g, 0.02, 0.16, 0.03, '#8A929C', 0.13, 0.38, 0.13);
    box(g, 0.02, 0.12, 0.03, '#8A929C', 0.13, 0.16, 0.13);
    face(g, { dx: -0.07, y: 0.42, z: 0.14, s: 0.8 });
  }
  return g;
};

// ================= 字母挂牌 =================
export function letterTexture(letter, bg = '#FF8FB0', fg = '#FFFFFF') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(8, 8, 112, 112, 34);
  c.fill();
  c.fillStyle = fg;
  c.font = '900 84px "Segoe UI", "Microsoft YaHei", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(letter.toUpperCase(), 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 短语对话气泡：圆角气泡 + 大图标 + 自动换行的短语全文（近处可读）
export function speechBubbleTexture(text, emoji = '💬', bg = '#FFFDF6', fg = '#4A3B2E') {
  const W = 320, H = 224;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  // 气泡主体
  c.fillStyle = bg;
  c.strokeStyle = '#E3D4C2';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(10, 10, W - 20, H - 62, 30);
  c.fill(); c.stroke();
  // 指向下方的小尾巴
  c.beginPath();
  c.moveTo(W / 2 - 26, H - 60);
  c.lineTo(W / 2, H - 14);
  c.lineTo(W / 2 + 26, H - 60);
  c.closePath();
  c.fillStyle = bg; c.fill();
  c.strokeStyle = '#E3D4C2';
  c.beginPath(); c.moveTo(W / 2 - 26, H - 58); c.lineTo(W / 2, H - 14); c.lineTo(W / 2 + 26, H - 58); c.stroke();
  // 图标
  c.font = '64px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(emoji, W / 2, 62);
  // 短语文本（按空格换行）
  c.fillStyle = fg;
  c.font = '700 30px "Segoe UI", "Microsoft YaHei", sans-serif';
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (c.measureText(test).width > W - 64 && line) { lines.push(line); line = wd; }
    else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);
  const lh = 34;
  const startY = 108 + (3 - shown.length) * lh / 2;
  shown.forEach((ln, i) => c.fillText(ln, W / 2, startY + i * lh));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function addLetterTag(group, letter) {
  const geo = new THREE.PlaneGeometry(0.17, 0.17);
  const m = new THREE.MeshBasicMaterial({ map: letterTexture(letter), transparent: true, side: THREE.DoubleSide });
  const tag = new THREE.Mesh(geo, m);
  const h = tagHeight(group);
  tag.position.set(0, h * 0.62, tagDepth(group, h));
  tag.name = 'letterTag';
  group.add(tag);
  return tag;
}
function tagHeight(g) {
  const box = new THREE.Box3().setFromObject(g);
  return Math.max(0.3, box.max.y);
}
function tagDepth(g, h) {
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  return Math.min(0.3, (c.z - box.min.z) + (box.max.z - box.min.z) * 0.3 + 0.05);
}

// ================= 玩家（小花匠：男孩 草帽+背带裤 / 女孩 双马尾+粉裙）
// wear: { hat: ''|'wizard'|'flower', balloon: bool, wand: bool } —— 许愿井换的装扮 */
export function buildPlayer(gender = 'boy', wear = {}) {
  const g = G();
  const girl = gender === 'girl';
  const skin = '#FFE0CC';
  const clothes = girl ? '#FF9FB6' : '#7EA8E8';
  // 腿
  const legL = G(), legR = G();
  legL.position.set(-0.075, 0.3, 0); legR.position.set(0.075, 0.3, 0);
  for (const [leg, sx] of [[legL, -1], [legR, 1]]) {
    cap(leg, 0.042, 0.16, girl ? skin : '#7EA8E8', 0, -0.15, 0);      // 女孩光腿小腿，男孩裤子
    sph(leg, 0.058, girl ? '#FF7B9C' : '#FFE08A', 0, -0.285, 0.02, 1, 0.62, 1.25); // 鞋
  }
  g.add(legL, legR);
  // 身体：男孩背带裤 / 女孩小裙子
  const body = G(); body.position.set(0, 0.3, 0); g.add(body);
  if (girl) {
    cyl(body, 0.125, 0.205, 0.2, clothes, 0, 0.3, 0, 0, 0, 0, 16);    // 上身
    cyl(body, 0.205, 0.27, 0.16, clothes, 0, 0.12, 0, 0, 0, 0, 18);   // 裙摆
    cyl(body, 0.1, 0.125, 0.06, '#FFFFFF', 0, 0.415, 0, 0, 0, 0, 16); // 白色小领子
  } else {
    cyl(body, 0.135, 0.24, 0.34, clothes, 0, 0.17, 0, 0, 0, 0, 16);
    sph(body, 0.125, '#FFF6C8', 0, 0.4, 0, 1, 0.55, 0.92);            // 上身
    box(body, 0.035, 0.2, 0.02, '#5C8F46', -0.06, 0.36, 0.115);       // 背带
    box(body, 0.035, 0.2, 0.02, '#5C8F46', 0.06, 0.36, 0.115);
  }
  // 手臂
  const armL = G(), armR = G();
  armL.position.set(-0.15, 0.2, 0); armR.position.set(0.15, 0.2, 0);
  for (const arm of [armL, armR]) {
    cap(arm, 0.036, 0.11, clothes, 0, -0.095, 0);
    cap(arm, 0.033, 0.06, skin, 0, -0.155, 0);
    sph(arm, 0.058, skin, 0, -0.195, 0.012);   // 小手：加大到能看见，微微朝前
  }
  body.add(armL, armR);
  // 头
  const head = G(); head.position.set(0, 0.46, 0); body.add(head);
  sph(head, 0.185, skin, 0, 0, 0, 1, 0.95, 0.97);
  sph(head, 0.196, '#8A5A3C', 0, 0.028, -0.022, 1.02, 0.98, 1.02);  // 头发
  sph(head, 0.07, '#8A5A3C', -0.075, 0.11, 0.13, 1.4, 0.7, 0.7);    // 刘海
  sph(head, 0.08, '#8A5A3C', 0, 0.125, 0.14, 1.4, 0.75, 0.75);
  sph(head, 0.07, '#8A5A3C', 0.075, 0.11, 0.13, 1.4, 0.7, 0.7);
  if (girl) {
    // 双马尾 + 粉色发圈 + 头顶蝴蝶结
    for (const sx of [-1, 1]) {
      sph(head, 0.075, '#8A5A3C', 0.185 * sx, 0.02, -0.02, 0.85, 1.15, 0.9);
      sph(head, 0.045, '#FF7B9C', 0.185 * sx, 0.115, -0.01, 1.1, 0.7, 1.1);
    }
    sph(head, 0.05, '#FF5E9C', 0.09, 0.155, 0.12, 1, 0.75, 1);
    sph(head, 0.035, '#FF5E9C', -0.095, 0.15, 0.13, 1, 0.75, 1);
  } else if (!wear.hat) {
    // 草帽（蓝色帽带）：戴了商店帽就摘下
    cyl(head, 0.13, 0.26, 0.04, '#F5D76E', 0, 0.155, 0, 0, 0, 0, 18);
    sph(head, 0.13, '#F5D76E', 0, 0.17, 0, 1, 0.7, 1);
    cyl(head, 0.145, 0.148, 0.035, '#7EC4F2', 0, 0.175, 0, 0, 0, 0, 18);
  }
  // ---- 商店装扮：帽子 ----
  if (wear.hat === 'wizard') {
    cyl(head, 0.24, 0.28, 0.035, '#8A6AC4', 0, 0.15, 0, 0, 0, 0, 18);   // 帽檐
    cyl(head, 0.02, 0.15, 0.3, '#8A6AC4', 0, 0.3, 0, 0, 0, 0, 14);      // 帽身
    cyl(head, 0.15, 0.16, 0.045, '#FFD34E', 0, 0.165, 0, 0, 0, 0, 18);  // 金帽带
    cone(head, 0.02, 0.14, '#8A6AC4', 0, 0.5, 0, 0, 0, -0.35);          // 帽尖
    sph(head, 0.028, '#FFE24E', 0, 0.56, 0.02, 1, 1, 1, 0, 0, 0, { emissive: '#FFD34E', ei: 0.7 });
    for (const [sx, y] of [[-1, 0.3], [1, 0.22]])
      sph(head, 0.014, '#FFE24E', 0.05 * sx, y, 0.13, 1, 1.3, 0.5, 0, 0, sx * 0.5, { emissive: '#FFD34E', ei: 0.6 });
  } else if (wear.hat === 'flower') {
    tor(head, 0.16, 0.022, '#66BB6A', 0, 0.15, 0, Math.PI / 2);         // 花环底
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 2 * i / 6 + 0.3;
      const fx = Math.cos(a) * 0.16, fz = Math.sin(a) * 0.16;
      const col = ['#FF8FB0', '#FFE24E', '#FFF6EC', '#B28FF5', '#FF8FB0', '#FFE24E'][i];
      for (let p = 0; p < 4; p++) {
        const pa = Math.PI * 2 * p / 4 + a;
        sph(head, 0.028, col, fx + Math.cos(pa) * 0.03, 0.15, fz + Math.sin(pa) * 0.03);
      }
      sph(head, 0.02, '#FFC94E', fx, 0.15, fz);
    }
  }
  // ---- 商店装扮：气球（拴在右手，走路一颠一颠） ----
  let balloon = null;
  if (wear.balloon) {
    balloon = G();
    cyl(balloon, 0.004, 0.004, 0.5, '#D9D9E0', 0, 0.25, 0);             // 线
    sph(balloon, 0.11, '#FF8FB0', 0, 0.6, 0, 1, 1.15, 1, 0, 0, 0, { rough: 0.4 });
    cone(balloon, 0.02, 0.04, '#E0678D', 0, 0.48, 0);
    balloon.position.set(0, -0.17, 0);
    armR.add(balloon);
  }
  // ---- 商店装扮：星星魔法棒（走路撒星星） ----
  let wandTip = null;
  if (wear.wand) {
    cyl(armR, 0.011, 0.013, 0.34, '#B08860', 0, -0.16, 0.1, 0.35, 0, 0); // 棒身
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.02, 0.16);
    armR.add(tip);
    const starM = o => new THREE.MeshStandardMaterial({ color: '#FFE24E', emissive: '#FFD34E', emissiveIntensity: o, roughness: 0.5 });
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + Math.PI * 2 * i / 5;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), starM(0.9));
      sp.position.set(Math.cos(a) * 0.032, tip.position.y + Math.sin(a) * 0.032, tip.position.z);
      sp.rotation.z = a + Math.PI / 2;
      armR.add(sp);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), starM(1.2));
    core.position.copy(tip.position);
    armR.add(core);
    wandTip = tip;
  }
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = sph(head, 0.03, '#4A4046', 0.068 * sx, 0.012, 0.158, 1, 1.35, 0.55);
    eye.userData.eyeH = eye.scale.y;
    eyes.push(eye);
    sph(head, 0.01, '#FFFFFF', 0.079 * sx, 0.044, 0.172);
    sph(head, 0.036, '#FFB3C1', 0.118 * sx, -0.048, 0.138, 1, 0.7, 0.4);
  }
  return { group: g, parts: { legL, legR, armL, armR, body, head, eyes, balloon, wandTip } };
}

// ================= 场景物 =================
export const PROPS = {};
// NPC：猫头鹰园丁（站在木桩上管每日任务链）
PROPS.owl = () => {
  const g = G();
  cyl(g, 0.09, 0.12, 1.0, '#8A6844', 0, 0.5, 0, 0, 0, 0, 8);          // 木桩
  const body = G(); body.position.set(0, 1.35, 0); g.add(body);
  sph(body, 0.34, '#9C7A4E', 0, 0, 0, 1, 1.15, 0.95);                  // 身体
  sph(body, 0.3, '#C9A875', 0, -0.06, 0.18, 1, 0.9, 0.6);              // 肚子
  sph(body, 0.12, '#7A5C3A', -0.26, 0.08, -0.05, 0.8, 1.3, 0.6);       // 翅膀
  sph(body, 0.12, '#7A5C3A', 0.26, 0.08, -0.05, 0.8, 1.3, 0.6);
  for (const sx of [-1, 1]) cone(body, 0.09, 0.2, '#7A5C3A', 0.14 * sx, 0.42, 0, 0, 0, 0, 6);  // 耳羽
  sph(body, 0.2, '#C9A875', 0, 0.26, 0.22, 1, 0.75, 0.5);              // 脸盘
  for (const sx of [-1, 1]) {
    sph(body, 0.065, '#FFFDF5', 0.085 * sx, 0.32, 0.24, 1, 1.1, 0.6);  // 大眼睛
    sph(body, 0.032, '#2A2420', 0.095 * sx, 0.32, 0.28);
    sph(body, 0.012, '#FFFFFF', 0.105 * sx, 0.345, 0.3);
  }
  cone(body, 0.05, 0.12, '#FF9A3C', 0, 0.26, 0.3, Math.PI / 2, 0, 0, 6); // 喙
  body.userData.blinkParts = [];
  return g;
};
// 地标：果园的鸟窝（两颗小小的蛋）
PROPS.merchantCart = () => {
  const g = G();
  box(g, 1.5, 0.85, 0.95, '#C89A6B', 0, 0.78, 0);
  box(g, 1.7, 0.08, 1.1, '#A87B4E', 0, 0.36, 0);
  for (const sx of [-0.55, 0.55]) {
    cyl(g, 0.28, 0.28, 0.1, '#6B4E33', sx, 0.3, 0.5, 0, 0, Math.PI / 2, 12);
    cyl(g, 0.28, 0.28, 0.1, '#6B4E33', sx, 0.3, -0.5, 0, 0, Math.PI / 2, 12);
  }
  for (const sx of [-0.6, 0.6]) cyl(g, 0.03, 0.03, 0.95, '#8A6844', sx, 1.25, -0.38);
  box(g, 1.7, 0.06, 1.05, '#D95F4B', 0, 1.76, -0.38);
  box(g, 1.7, 0.06, 1.05, '#FFF3E0', 0, 1.68, -0.38);
  cyl(g, 0.02, 0.02, 0.55, '#8A6844', 0.75, 1.45, 0.3);
  box(g, 0.26, 0.16, 0.02, '#D95F4B', 0.75, 1.7, 0.3, 0, 0, 0.15);
  return g;
};
// 地标：果园的鸟窝（两颗小小的蛋）
PROPS.nest = () => {
  const g = G();
  tor(g, 0.3, 0.09, '#B98A5A', 0, 0.07, 0, Math.PI / 2);
  sph(g, 0.065, '#FFF6EC', -0.08, 0.11, 0.02, 1, 1.25, 1);
  sph(g, 0.065, '#BFE3F5', 0.09, 0.11, -0.03, 1, 1.25, 1);
  return g;
};
// 地标：海滩的贝壳堆与小海星
PROPS.shells = () => {
  const g = G();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 2 * i / 4 + 0.4;
    cone(g, 0.09, 0.16, i % 2 ? '#FFE7D6' : '#FFD9E8', Math.cos(a) * 0.18, 0.07, Math.sin(a) * 0.18, -0.5, 0, a);
  }
  for (const [sx, sz, col] of [[0, 0, '#FF9A5C'], [0.32, 0.18, '#FFE24E']]) {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 * i / 5;
      box(g, 0.15, 0.028, 0.05, col, sx + Math.cos(a) * 0.085, 0.03, sz + Math.sin(a) * 0.085, 0, -a, 0);
    }
  }
  return g;
};

PROPS.tree = (blossom = false) => {
  const g = G();
  cyl(g, 0.14, 0.22, 1.6, '#B98A5E', 0, 0.8, 0, 0, 0, 0, 10);
  // 三层色阶的团状树冠：主色 + 侧影色 + 受光亮色，低多边形但层次分明
  const c1 = blossom ? '#FFC9DD' : '#8FD08F', c2 = blossom ? '#FFAFCB' : '#7CC96F', c3 = blossom ? '#FFDCE9' : '#A8E1A2';
  sph(g, 0.85, c1, 0, 2.0, 0, 1, 1, 1);
  sph(g, 0.6, c2, 0.5, 1.75, 0.2); sph(g, 0.56, c2, -0.48, 1.8, -0.18);
  sph(g, 0.52, c1, 0.05, 2.55, -0.12);
  sph(g, 0.34, c3, 0.24, 2.55, 0.3);              // 顶部受光面
  sph(g, 0.26, c3, -0.3, 2.15, 0.38);
  return g;
};

PROPS.fence = () => {
  const g = G();
  box(g, 0.09, 0.72, 0.09, '#FDF6EC', 0, 0.36, -0.95);
  box(g, 0.09, 0.72, 0.09, '#FDF6EC', 0, 0.36, 0.95);
  for (const z of [-0.55, -0.18, 0.18, 0.55]) {
    box(g, 0.07, 0.62, 0.22, '#FDF6EC', 0, 0.31, z);
    cone(g, 0.05, 0.1, '#FDF6EC', 0, 0.67, z, 0, Math.PI / 4, 0, 4);
  }
  box(g, 0.045, 0.08, 1.94, '#FDF6EC', 0, 0.42, 0);
  box(g, 0.045, 0.08, 1.94, '#FDF6EC', 0, 0.16, 0);
  return g;
};

PROPS.barn = () => {
  const g = G();
  box(g, 6, 3.2, 5, '#D95F4B', 0, 1.6, 0);                               // 主体
  // 大屋顶（两块斜板，内端在屋脊相接）
  box(g, 3.6, 0.18, 5.6, '#B44A38', -1.42, 3.85, 0, 0, 0, 0.72);
  box(g, 3.6, 0.18, 5.6, '#B44A38', 1.42, 3.85, 0, 0, 0, -0.72);
  box(g, 0.5, 0.22, 5.4, '#8A3A2C', 0, 4.95, 0);                          // 屋脊
  // 白色门框 + 大谷仓门
  box(g, 2.4, 2.6, 0.12, '#FFF3E0', 0, 1.3, 2.51);
  for (const [sx, name] of [[-1, 'doorL'], [1, 'doorR']]) {
    const door = G();
    door.position.set(0.95 * sx, 0, 2.54);
    box(door, 0.95, 2.2, 0.09, '#FFF6EC', 0.475 * -sx, 1.1, 0);
    box(door, 0.72, 0.08, 0.02, '#C9807A', 0.475 * -sx, 1.1, 0.05, 0, 0, 0.45);
    box(door, 0.72, 0.08, 0.02, '#C9807A', 0.475 * -sx, 1.1, 0.05, 0, 0, -0.45);
    door.name = name;
    g.add(door);
  }
  // 干草窗
  box(g, 1, 1, 0.12, '#FFF6EC', 0, 3.3, 2.51);
  // 烟囱（谷仓顶上冒烟的小烟囱）
  box(g, 0.34, 0.9, 0.34, '#8A3A2C', 0.9, 4.35, -0.8);
  // 内部（默认黑黑的，light 词宠点亮后移除 darkness）
  const dark = box(g, 5.6, 3, 4.6, '#1E1620', 0, 1.55, 0);
  dark.material = M('#181022', { alpha: 0.96 });
  dark.name = 'darkness';
  return g;
};

PROPS.windmill = () => {
  const g = G();
  cyl(g, 1.1, 1.7, 4.2, '#FFF3E0', 0, 2.1, 0, 0, 0, 0, 10);
  cone(g, 1.35, 1.2, '#D95F4B', 0, 4.8, 0, 0, 0, 0, 10);
  box(g, 0.7, 1.4, 0.1, '#8A6844', 0, 0.7, 1.62);
  const blades = G();
  blades.position.set(0, 4.1, 1.45);
  for (let i = 0; i < 4; i++) {
    const b = G();
    box(b, 0.32, 2.5, 0.06, '#F5E0B8', 0, 1.25, 0);
    for (let j = 1; j < 4; j++) box(b, 0.3, 0.05, 0.02, '#C9A46B', 0, j * 0.6, 0.05);
    b.rotation.z = Math.PI / 2 * i;
    blades.add(b);
  }
  g.add(blades);
  g.userData.blades = blades;
  return g;
};

PROPS.dock = () => {
  const g = G();
  for (let i = 0; i < 5; i++) box(g, 2.2, 0.1, 1.1, '#C89A6B', 0, 0.16, -2.2 + i * 1.1);
  for (const z of [-2, 0, 2]) for (const x of [-0.9, 0.9]) cyl(g, 0.07, 0.07, 0.6, '#8A6844', x, -0.1, z, 0, 0, 0, 8);
  return g;
};

PROPS.haybale = () => {
  const g = G();
  cyl(g, 1.1, 1.1, 1.5, '#E8C87E', 0, 1.1, 0, 0, 0, Math.PI / 2, 16);
  tor(g, 1.11, 0.03, '#C9A46B', 0, 1.1, 0, 0, 0, Math.PI / 2);
  tor(g, 0.6, 0.025, '#D9B68F', 0, 1.1, 0, 0, 0, Math.PI / 2);
  return g;
};

PROPS.hedge = () => {
  const g = G();
  box(g, 2, 1.3, 1.2, '#5CA85C', 0, 0.65, 0);
  sph(g, 0.55, '#6FBF73', -0.7, 1.25, 0, 1, 0.7, 0.9);
  sph(g, 0.5, '#7CC96F', 0.6, 1.3, 0.1, 1, 0.7, 0.9);
  return g;
};

PROPS.pumpkin = () => {
  const g = G();
  sph(g, 0.32, '#FF9A3C', 0, 0.26, 0, 1, 0.85, 1);
  sph(g, 0.28, '#FFAB54', 0, 0.26, 0, 0.55, 0.88, 1);
  cyl(g, 0.04, 0.05, 0.12, '#5C8F46', 0, 0.6, 0);
  sph(g, 0.06, '#5C8F46', 0.08, 0.62, 0, 1.4, 0.3, 0.8);
  return g;
};

PROPS.rock = (s = 1) => {
  const g = G();
  sph(g, 0.22 * s, '#BDBDC8', 0, 0.14 * s, 0, 1.35, 0.7, 1);
  sph(g, 0.12 * s, '#CBCBD4', 0.18 * s, 0.1 * s, 0.1 * s);
  return g;
};

PROPS.cloud = (s = 1) => {
  const g = G();
  sph(g, 0.5 * s, '#FFFFFF', 0, 0, 0, 1, 0.75, 1, 0, 0, 0, { alpha: 0.92 });
  sph(g, 0.36 * s, '#FFFFFF', 0.45 * s, -0.05 * s, 0.1 * s, 1, 0.8, 1, 0, 0, 0, { alpha: 0.92 });
  sph(g, 0.32 * s, '#FFFFFF', -0.4 * s, -0.02 * s, -0.08 * s, 1, 0.8, 1, 0, 0, 0, { alpha: 0.92 });
  return g;
};

PROPS.flowerpatch = () => {
  const g = G();
  const cols = ['#FF8FB0', '#FFE24E', '#FFFFFF', '#B28FF5'];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 2 * i / 5 + Math.random();
    cyl(g, 0.012, 0.014, 0.18 + Math.random() * 0.1, '#66BB6A', Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25);
    sph(g, 0.06, cols[i % 4], Math.cos(a) * 0.25, 0.24 + Math.random() * 0.06, Math.sin(a) * 0.25, 1, 0.7, 1);
  }
  return g;
};

PROPS.soil = () => {
  const g = G();
  box(g, 1.6, 0.12, 3.4, '#8A6844', 0, 0.05, 0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 4; j++)
      sph(g, 0.07, '#A8825B', -0.55 + i * 0.55, 0.12, -1.2 + j * 0.8, 1, 0.6, 1);
  return g;
};

PROPS.beanstalk = () => {
  const g = G();
  // 从地面爬向天空的豆藤（scale.y 动画用）
  const stalk = G();
  cyl(stalk, 0.12, 0.3, 14, '#5CA85C', 0, 7, 0, 0, 0, 0, 10);
  for (let i = 0; i < 8; i++) {
    const y = 1.5 + i * 1.6;
    const a = i * 1.3;
    sph(stalk, 0.3, '#6FBF73', Math.cos(a) * 0.5, y, Math.sin(a) * 0.5, 1.3, 0.4, 0.9);
    sph(stalk, 0.09, '#8FD08F', Math.cos(a + 1) * 0.55, y + 0.5, Math.sin(a + 1) * 0.55, 1.2, 0.35, 0.8);
  }
  g.add(stalk);
  g.userData.stalk = stalk;
  return g;
};

// ---- 海滩 & 森林 & 村庄新道具 ----
PROPS.palm = () => {
  const g = G();
  const segs = [[0, 0.31, 0, 0.1, 0.13], [0.1, 0.92, 0.02, 0.085, 0.1], [0.22, 1.5, 0.05, 0.07, 0.085]];
  for (const [x, y, z, rt, rb] of segs) {
    const m = cyl(g, rt, rb, 0.66, '#B08D58', x, y, z, 0, 0, -0.16);
    m.rotation.z = -0.16;
  }
  const top = G(); top.position.set(0.3, 1.9, 0.08); g.add(top);
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 2 * i / 6;
    const leaf = sph(top, 0.36, i % 2 ? '#5CA85C' : '#6FBF73', Math.cos(a) * 0.3, -0.06, Math.sin(a) * 0.3, 1.35, 0.1, 0.5);
    leaf.rotation.y = -a;
  }
  sph(top, 0.13, '#6FBF73', 0, 0.02, 0);
  for (const [dx, dz] of [[-0.1, 0.13], [0.13, -0.07]]) sph(top, 0.06, '#8A6844', dx, -0.12, dz); // 椰子
  return g;
};

PROPS.umbrella = () => {
  const g = G();
  cyl(g, 0.028, 0.028, 1.9, '#C9A46B', 0.12, 0.95, 0, 0, 0, 0.14);
  cone(g, 1.05, 0.5, '#FF8A7A', 0.25, 1.95, 0, 0, 0, 0.14, 9);      // 伞面
  cone(g, 1.02, 0.18, '#FFF6EC', 0.25, 1.9, 0, 0, 0, 0.14, 9, { alpha: 0.35 }); // 白边
  sph(g, 0.05, '#FFF6EC', 0.36, 2.24, 0);
  return g;
};

PROPS.sandcastle = (s = 1) => {
  const g = G();
  const S = '#EFD9A8', S2 = '#E2C88E';
  box(g, 1.5, 0.5, 1.2, S2, 0, 0.25, 0);                            // 基座
  for (const [dx, dz] of [[-0.62, -0.45], [0.62, -0.45], [-0.62, 0.45], [0.62, 0.45]]) {
    cyl(g, 0.2, 0.24, 0.7, S, dx, 0.85, dz);
    cone(g, 0.26, 0.32, S2, dx, 1.36, dz, 0, Math.PI / 4, 0, 4);
  }
  cyl(g, 0.3, 0.34, 0.9, S, 0, 0.95, 0);                            // 主塔
  cone(g, 0.36, 0.4, S2, 0, 1.6, 0);
  cyl(g, 0.008, 0.008, 0.34, '#8A6844', 0, 1.95, 0);
  box(g, 0.2, 0.11, 0.012, '#FF6B6B', 0.1, 2.06, 0);                // 小红旗
  g.scale.setScalar(s);
  return g;
};

PROPS.pine = (s = 1) => {
  const g = G();
  cyl(g, 0.09, 0.14, 0.7, '#8A6844', 0, 0.35, 0, 0, 0, 0, 8);
  for (let i = 0; i < 3; i++)
    cone(g, 0.78 - i * 0.19, 0.95, i % 2 ? '#4E9152' : '#5CA85C', 0, 1.05 + i * 0.62, 0, 0, 0, 0, 9);
  g.scale.setScalar(s);
  return g;
};

PROPS.bush = (s = 1) => {
  const g = G();
  sph(g, 0.4, '#4E9152', 0, 0.3, 0, 1.2, 0.85, 1);
  sph(g, 0.3, '#5CA85C', 0.3, 0.24, 0.1);
  sph(g, 0.26, '#57A24F', -0.28, 0.22, -0.06);
  g.scale.setScalar(s);
  return g;
};

PROPS.log = (s = 1) => {
  const g = G();
  cyl(g, 0.16, 0.18, 1.3, '#A87551', 0, 0.18, 0, 0, 0, Math.PI / 2, 12);
  cyl(g, 0.14, 0.14, 0.03, '#E8CFA8', 0.65, 0.18, 0, 0, 0, Math.PI / 2, 12);
  tor(g, 0.08, 0.015, '#C9A46B', 0.66, 0.18, 0, 0, Math.PI / 2);
  sph(g, 0.07, '#8FD08F', -0.3, 0.32, 0.05, 1, 0.4, 1);
  g.scale.setScalar(s);
  return g;
};

PROPS.lilyPad = () => {
  const g = G();
  cyl(g, 0.26, 0.3, 0.035, '#4E9152', 0, 0.02, 0, 0, 0, 0, 12);
  sph(g, 0.05, '#7CC96F', 0.1, 0.05, 0.06, 1, 0.5, 1);
  return g;
};

PROPS.grassTuft = () => {
  const g = G();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 2 * i / 5 + Math.random();
    cone(g, 0.028, 0.16 + Math.random() * 0.12, ['#7CC96F', '#8FD08F', '#6FBF73'][i % 3],
      Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05, 0.2 * Math.sin(a), 0, -0.2 * Math.cos(a), 5);
  }
  return g;
};

PROPS.sunflower = () => {
  const g = G();
  cyl(g, 0.02, 0.026, 0.75, '#5CA85C', 0, 0.37, 0);
  sph(g, 0.06, '#5CA85C', 0.08, 0.3, 0, 1.5, 0.35, 0.8);
  sph(g, 0.05, '#5CA85C', -0.07, 0.45, 0, 1.5, 0.35, 0.8);
  const head = G(); head.position.set(0, 0.82, 0); g.add(head);
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 2 * i / 10;
    sph(head, 0.06, '#FFC94E', Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0, 1, 1, 0.4);
  }
  sph(head, 0.1, '#8A5A2C', 0, 0, 0.015, 1, 1, 0.55);
  return g;
};

PROPS.scarecrow = () => {
  const g = G();
  cyl(g, 0.045, 0.05, 1.6, '#A87551', 0, 0.8, 0);
  box(g, 1, 0.07, 0.07, '#A87551', 0, 1.15, 0);                     // 横杆
  box(g, 0.42, 0.5, 0.24, '#E8836F', 0, 1, 0);                      // 衣服
  box(g, 0.16, 0.3, 0.05, '#5C8F46', 0.14, 0.42, 0);                // 补丁
  sph(g, 0.16, '#FFE0C4', 0, 1.45, 0);                              // 头
  cyl(g, 0.2, 0.34, 0.04, '#F5D76E', 0, 1.58, 0, 0, 0, 0, 14);      // 草帽
  sph(g, 0.17, '#F5D76E', 0, 1.6, 0, 1, 0.6, 1);
  for (const sx of [-1, 1]) sph(g, 0.022, '#4A4046', 0.055 * sx, 1.47, 0.14, 1, 1.3, 0.5);
  sph(g, 0.02, '#E0678D', 0, 1.42, 0.15);
  for (const sx of [-1, 1]) cap(g, 0.02, 0.3, '#E8C87E', 0.5 * sx, 1.12, 0).scale.set(1, 1, 0.5); // 手臂稻草
  return g;
};

PROPS.pinwheel = () => {
  const g = G();
  cyl(g, 0.02, 0.025, 0.9, '#B08D58', 0, 0.45, 0);
  const blades = G(); blades.position.set(0, 0.92, 0.05);
  const cols = ['#FF6B6B', '#FFC94E', '#7EC4F2', '#8FD08F'];
  for (let i = 0; i < 4; i++) {
    const b = sph(blades, 0.09, cols[i], 0.11, 0, 0, 1.6, 0.55, 0.25);
    const holder = G();
    holder.rotation.z = Math.PI / 2 * i;
    holder.add(b);
    b.position.set(0.12, 0, 0);
    blades.add(holder);
  }
  sph(blades, 0.035, '#FFF6EC', 0, 0, 0.02);
  g.add(blades);
  g.userData.blades = blades;
  return g;
};

PROPS.well = () => {
  const g = G();
  cyl(g, 0.52, 0.6, 0.72, '#B8B8C4', 0, 0.36, 0, 0, 0, 0, 14);      // 石井身
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 2 * i / 5 + 0.4;
    box(g, 0.22, 0.14, 0.08, '#A5A5B4', Math.cos(a) * 0.52, 0.2, Math.sin(a) * 0.52, 0, -a, 0);
  }
  tor(g, 0.53, 0.06, '#C9C9D6', 0, 0.74, 0, Math.PI / 2);           // 井沿
  cyl(g, 0.45, 0.5, 0.05, '#2E5E8E', 0, 0.66, 0, 0, 0, 0, 14);      // 井水
  for (const sx of [-1, 1]) box(g, 0.09, 1, 0.09, '#8A6844', 0.5 * sx, 1.2, 0);
  cone(g, 0.85, 0.45, '#D95F4B', 0, 1.95, 0, 0, 0, 0, 4);           // 小屋顶
  cyl(g, 0.03, 0.03, 1.06, '#8A6844', 0, 1.55, 0, 0, 0, Math.PI / 2);
  cyl(g, 0.008, 0.008, 0.5, '#D9D9E0', 0, 1.28, 0);
  cyl(g, 0.11, 0.09, 0.14, '#A87551', 0, 1, 0, 0, 0, 0, 10);        // 小木桶
  tor(g, 0.1, 0.012, '#8A6844', 0, 1.06, 0, Math.PI / 2);
  return g;
};

PROPS.signboard = () => {
  const g = G();
  for (const sx of [-1, 1]) cyl(g, 0.05, 0.06, 1.5, '#A87551', 0.55 * sx, 0.75, 0);
  box(g, 1.7, 0.9, 0.08, '#C89A6B', 0, 1.25, 0);                    // 木板
  box(g, 0.075, 0.9, 0.09, '#8A6844', 0, 1.25, 0);                  // 中缝
  box(g, 0.62, 0.5, 0.03, '#FFFDF4', -0.4, 1.3, 0.055);             // 任务纸
  for (let i = 0; i < 3; i++) {
    box(g, 0.08, 0.08, 0.035, ['#FF6B6B', '#FFC94E', '#7CC96F'][i], -0.62, 1.42 - i * 0.16, 0.06);
    box(g, 0.32, 0.03, 0.035, '#D9CBB8', -0.36, 1.42 - i * 0.16, 0.06);
  }
  box(g, 0.5, 0.4, 0.03, '#FFE9B8', 0.4, 1.32, 0.055);              // 公告纸
  sph(g, 0.06, '#FFC94E', 0, 1.78, 0, 1, 1, 1, 0, 0, 0, { emissive: '#FFD34E', ei: 0.5 }); // 顶上小星
  return g;
};

PROPS.gull = () => {
  const g = G();
  sph(g, 0.14, '#FFFFFF', 0, 0, 0, 1, 0.8, 1.4);
  sph(g, 0.09, '#FFFFFF', 0, 0.08, 0.14);
  cone(g, 0.03, 0.07, '#FF9A3C', 0, 0.07, 0.23, Math.PI / 2);
  sph(g, 0.014, '#4A4046', 0.04, 0.1, 0.18); sph(g, 0.014, '#4A4046', -0.04, 0.1, 0.18);
  const wingL = G(), wingR = G();
  sph(wingL, 0.16, '#F4F4F8', -0.18, 0.05, 0, 1.3, 0.15, 0.7);
  sph(wingR, 0.16, '#F4F4F8', 0.18, 0.05, 0, 1.3, 0.15, 0.7);
  g.add(wingL, wingR);
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  return g;
};

PROPS.butterfly = (color = '#FF8FB0') => {
  const g = G();
  cap(g, 0.018, 0.08, '#6B5844', 0, 0, 0, Math.PI / 2);
  const mkWing = side => {
    const w = G();
    sph(w, 0.07, color, 0.06 * side, 0.02, 0.02, 1.2, 0.9, 0.2);
    sph(w, 0.045, color, 0.05 * side, 0.02, -0.05, 1, 0.8, 0.2);
    sph(w, 0.012, '#FFF6EC', 0.075 * side, 0.025, 0.025);
    return w;
  };
  const wl = mkWing(-1), wr = mkWing(1);
  g.add(wl, wr);
  g.userData.wings = [wl, wr];
  return g;
};

// 机关：金色沙丘（wind 吹开）与荆棘丛（banana 拨开）
PROPS.dune = (s = 1) => {
  const g = G();
  sph(g, 1, '#EDD49E', 0, 0, 0, 1.6, 0.72, 1);
  sph(g, 1, '#E5C88E', 0.7, -0.1, 0.3, 1.1, 0.5, 0.8);
  g.scale.setScalar(s);
  return g;
};

PROPS.thorn = (s = 1) => {
  const g = G();
  for (const [x, y, z, r] of [[0, 0.5, 0, 0.42], [0.3, 0.9, 0.1, 0.3], [-0.28, 0.8, -0.08, 0.28], [0, 1.2, 0, 0.22]]) {
    sph(g, r, '#3E7A44', x, y, z, 1, 1.15, 1);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 * i / 5 + x;
      cone(g, 0.03, 0.16, '#8A6844', x + Math.cos(a) * r * 1.1, y + Math.sin(a * 1.3) * r * 0.9, z + Math.sin(a) * r * 1.1,
        Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    }
  }
  g.scale.setScalar(s);
  return g;
};

// ---- 衣帽 ----
AUTO_TEMPLATES.cloth = (kind) => {
  const g = G();
  if (kind === 'cap' || kind === 'hat') {
    if (kind === 'cap') {
      sph(g, 0.16, '#4A8FD9', 0, 0.2, 0, 1, 0.72, 1);
      cyl(g, 0.14, 0.14, 0.02, '#3E7EC4', 0, 0.17, 0.14, 0.35);
      sph(g, 0.03, '#FFC94E', 0, 0.32, 0);
    } else {
      cyl(g, 0.14, 0.2, 0.03, '#F5D76E', 0, 0.16, 0, 0, 0, 0, 16);
      sph(g, 0.12, '#F5D76E', 0, 0.2, 0, 1, 0.6, 1);
      sph(g, 0.035, '#FF8FB0', 0, 0.3, 0);
    }
    face(g, { dx: 0.055, y: 0.1, z: 0.13, s: 0.75 });
  } else if (kind === 'sunglasses' || kind === 'glasses') {
    const c = kind === 'sunglasses' ? '#3E4450' : '#4A4046';
    const lensC = kind === 'sunglasses' ? '#3E4450' : '#BDE3F0';
    for (const sx of [-1, 1]) {
      tor(g, 0.07, 0.015, c, 0.085 * sx, 0.24, 0);
      cyl(g, 0.062, 0.062, 0.015, lensC, 0.085 * sx, 0.24, 0, Math.PI / 2, 0, 0, 16);
    }
    box(g, 0.06, 0.012, 0.012, c, 0, 0.25, 0);
    face(g, { dx: 0.045, y: 0.1, z: 0.05, s: 0.65 });
  } else if (kind === 'scarf') {
    tor(g, 0.13, 0.045, '#E86A5C', 0, 0.26, 0, Math.PI / 2);
    box(g, 0.07, 0.24, 0.035, '#E86A5C', 0.06, 0.12, 0.1, 0, 0, 0.15);
    face(g, { dx: 0.05, y: 0.14, z: 0.13, s: 0.75 });
  } else if (kind === 'gloves') {
    for (const sx of [-1, 1]) {
      sph(g, 0.09, '#E8836F', 0.12 * sx, 0.2, 0, 0.8, 1.1, 0.55);
      for (let i = 0; i < 4; i++) cap(g, 0.018, 0.07, '#E8836F', 0.12 * sx + (-0.05 + i * 0.033) * sx, 0.36, 0);
    }
    face(g, { dx: 0.04, y: 0.12, z: 0.09, s: 0.7 });
  } else if (kind === 'umbrella') {
    cone(g, 0.18, 0.16, '#E86A5C', 0, 0.32, 0, 0, 0, 0, 10);
    cyl(g, 0.008, 0.008, 0.3, '#8A6844', 0, 0.14, 0);
    cyl(g, 0.008, 0.008, 0.05, '#8A6844', 0, 0.02, 0, 0, 0, 0.6);
    face(g, { dx: 0.05, y: 0.24, z: 0.12, s: 0.7 });
  } else if (kind === 'coat' || kind === 'jacket' || kind === 'sweater' || kind === 'shirt' || kind === 'schoolbag') {
    if (kind === 'schoolbag') {
      box(g, 0.26, 0.32, 0.14, '#5CA8D9', 0, 0.2, 0);
      box(g, 0.18, 0.12, 0.06, '#3E7EC4', 0, 0.12, 0.09);
      sph(g, 0.05, '#5C8FD9', 0, 0.38, 0, 1.2, 0.4, 0.6);
      face(g, { dx: 0.055, y: 0.24, z: 0.09, s: 0.75 });
    } else {
      const c = { coat: '#8FA8C0', jacket: '#D95F4B', sweater: '#F0C05C', shirt: '#FFF6EC' }[kind];
      cyl(g, 0.13, 0.17, 0.24, c, 0, 0.18, 0, 0, 0, 0, 14);
      for (const sx of [-1, 1]) cyl(g, 0.045, 0.05, 0.14, c, 0.16 * sx, 0.3, 0, 0.4 * sx);
      cyl(g, 0.05, 0.06, 0.04, '#FFF6EC', 0, 0.32, 0, 0, 0, 0, 12);
      if (kind === 'sweater') for (let i = 0; i < 2; i++) tor(g, 0.15 - i * 0.01, 0.008, '#D9964A', 0, 0.12 + i * 0.06, 0, Math.PI / 2);
      face(g, { dx: 0.055, y: 0.2, z: 0.14, s: 0.8 });
    }
  } else if (kind === 'shoe') {
    box(g, 0.3, 0.1, 0.16, '#E8735C', 0, 0.06, 0);
    sph(g, 0.08, '#FFF6EC', -0.09, 0.12, 0, 0.8, 0.6, 1.1);
    box(g, 0.3, 0.03, 0.17, '#FFF6EC', 0, 0.02, 0);
    face(g, { dx: 0.06, y: 0.14, z: 0.09, s: 0.7 });
  }
  return g;
};

// ---- 交通 ----
AUTO_TEMPLATES.veh = (kind) => {
  const g = G();
  if (kind === 'car') {
    box(g, 0.44, 0.14, 0.24, '#E8634B', 0, 0.14, 0);
    box(g, 0.24, 0.12, 0.2, '#E8634B', -0.02, 0.26, 0);
    sph(g, 0.05, '#BDE3F0', -0.02, 0.27, 0.02, 1.4, 0.7, 0.5);
    for (const [x, z] of [[-0.13, 0.12], [0.13, 0.12], [-0.13, -0.12], [0.13, -0.12]])
      cyl(g, 0.06, 0.06, 0.04, '#3E3A44', x, 0.06, z, 0, 0, Math.PI / 2, 14);
    face(g, { dx: 0.1, y: 0.16, z: 0.13, s: 0.8 });
  } else if (kind === 'bike') {
    for (const x of [-0.14, 0.14]) {
      tor(g, 0.09, 0.02, '#4A4046', x, 0.09, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.5);
      for (let i = 0; i < 4; i++) cyl(g, 0.005, 0.005, 0.16, '#C0C4CE', x, 0.09, 0, 0, Math.PI * i / 4, Math.PI / 2);
    }
    cyl(g, 0.015, 0.015, 0.24, '#E8836F', 0, 0.14, 0, 0, 0, 0.25);
    cyl(g, 0.012, 0.012, 0.2, '#E8836F', -0.05, 0.2, 0, 0, 0, -0.5);
    face(g, { dx: 0.04, y: 0.2, z: 0.04, s: 0.65 });
  }
  return g;
};

// ---- 建筑 & 场所 ----
function houseBox(g, w, h, d, c, roofC, x = 0, z = 0) {
  box(g, w, h, d, c, x, h / 2, z);
  cone(g, Math.max(w, d) * 0.72, h * 0.42, roofC, x, h + h * 0.2, z, 0, Math.PI / 4, 0, 4);
  box(g, w * 0.24, h * 0.42, 0.02, '#FFF6EC', x, h * 0.21, z + d / 2 + 0.01);
}
AUTO_TEMPLATES.place = (kind) => {
  const g = G();
  if (kind === 'house') { houseBox(g, 0.44, 0.3, 0.36, '#FFE9C8', '#D95F4B'); face(g, { dx: 0.07, y: 0.2, z: 0.19, s: 0.75 }); }
  else if (kind === 'village') {
    houseBox(g, 0.26, 0.2, 0.22, '#FFE9C8', '#E8A85C', -0.18, 0.06);
    houseBox(g, 0.22, 0.17, 0.2, '#FFF4DC', '#7CC96F', 0.16, -0.08);
    houseBox(g, 0.2, 0.15, 0.18, '#F5E4CC', '#B088C8', 0.1, 0.2);
    face(g, { dx: 0.04, y: 0.12, z: 0.17, s: 0.65 });
  } else if (kind === 'building') {
    box(g, 0.32, 0.6, 0.28, '#B8C4D0', 0, 0.3, 0);
    for (let r = 0; r < 4; r++) for (const sx of [-1, 1]) box(g, 0.07, 0.08, 0.02, '#7EC4F2', 0.08 * sx, 0.12 + r * 0.14, 0.145);
    face(g, { dx: 0.08, y: 0.66, z: 0.1, s: 0.7 });
  } else if (kind === 'bridge') {
    cyl(g, 0.3, 0.3, 0.06, '#C8A85C', 0, 0.14, 0, 0, 0, Math.PI / 2, 16, { alpha: 1 });
    for (const sx of [-1, 1]) cyl(g, 0.03, 0.035, 0.2, '#A8863C', 0.24 * sx, 0.2, 0.14);
    face(g, { dx: 0.06, y: 0.2, z: 0.16, s: 0.75 });
  } else if (kind === 'hospital') {
    houseBox(g, 0.44, 0.34, 0.34, '#FFFFFF', '#D9E0E8');
    for (const [dx, dy] of [[0, 0.4], [0, 0.24]]) box(g, 0.1, 0.03, 0.02, '#E84B4B', dx, dy, 0.18);
    box(g, 0.03, 0.1, 0.02, '#E84B4B', 0, 0.32, 0.18);
    face(g, { dx: -0.09, y: 0.2, z: 0.18, s: 0.65 });
  } else if (kind === 'supermarket' || kind === 'bookstore' || kind === 'cinema') {
    const c = { supermarket: '#7CC96F', bookstore: '#5CA8D9', cinema: '#B07CC9' }[kind];
    box(g, 0.46, 0.28, 0.34, '#FFE9C8', 0, 0.14, 0);
    for (let i = 0; i < 4; i++) box(g, 0.06, 0.06, 0.36, i % 2 ? c : '#FFFFFF', -0.17 + i * 0.115, 0.32, 0);
    if (kind === 'cinema') box(g, 0.2, 0.14, 0.02, '#3E4450', 0, 0.15, 0.18);
    face(g, { dx: 0.09, y: 0.16, z: 0.18, s: 0.7 });
  } else if (kind === 'library' || kind === 'gym') {
    if (kind === 'library') {
      box(g, 0.4, 0.26, 0.3, '#F0E4C8', 0, 0.13, 0);
      for (const sx of [-1, 0, 1]) cyl(g, 0.035, 0.04, 0.26, '#FFFDF4', 0.13 * sx, 0.13, 0.16, 0, 0, 0, 10);
      cone(g, 0.3, 0.12, '#B8863C', 0, 0.32, 0);
    } else {
      box(g, 0.44, 0.26, 0.32, '#E8ECF0', 0, 0.13, 0);
      sph(g, 0.09, '#FF9A5C', 0, 0.34, 0, 1, 0.6, 1);
      face(g, { dx: 0.08, y: 0.18, z: 0.17, s: 0.7 });
    }
  } else if (kind === 'playground') {
    cyl(g, 0.03, 0.035, 0.3, '#5CA8D9', -0.1, 0.15, 0);
    box(g, 0.24, 0.03, 0.1, '#FFC94E', 0.02, 0.3, 0, 0, 0, 0.35);
    box(g, 0.03, 0.02, 0.1, '#FF8FB0', 0.12, 0.16, 0, 0, 0, 0.35);
    sph(g, 0.05, '#FF8FB0', 0, 0.36, -0.1);
    face(g, { dx: 0.04, y: 0.08, z: 0.06, s: 0.65 });
  } else if (kind === 'garden') {
    for (let i = 0; i < 3; i++) cyl(g, 0.02, 0.024, 0.16, '#C89A6B', -0.12 + i * 0.12, 0.08, 0);
    box(g, 0.3, 0.025, 0.02, '#C89A6B', 0, 0.13, 0);
    for (const [dx, c] of [[-0.1, '#FF8FB0'], [0, '#FFE24E'], [0.1, '#B28FF5']]) sph(g, 0.04, c, dx, 0.2, 0.05, 1, 0.8, 1);
    face(g, { dx: 0.04, y: 0.06, z: 0.05, s: 0.65 });
  } else if (kind === 'farm') {
    houseBox(g, 0.4, 0.26, 0.32, '#D95F4B', '#B44A38');
    face(g, { dx: 0.07, y: 0.16, z: 0.17, s: 0.7 });
  } else if (kind === 'zoo') {
    for (const sx of [-1, 1]) houseBox(g, 0.12, 0.3, 0.12, '#E8B85C', '#B44A38', 0.16 * sx, 0);
    box(g, 0.22, 0.05, 0.1, '#E8B85C', 0, 0.34, 0);
    sph(g, 0.04, '#E84B4B', 0, 0.4, 0);
    face(g, { dx: 0, y: 0.15, z: 0.08, s: 0.7 });
  } else if (kind === 'bedroom' || kind === 'study' || kind === 'kitchen' || kind === 'bathroom' || kind === 'classroom') {
    houseBox(g, 0.42, 0.28, 0.34, { bedroom: '#FFD9E8', study: '#D8E4F0', kitchen: '#FFF0D0', bathroom: '#D0E8F5', classroom: '#E8F0DC' }[kind], '#C89A8B');
    badge(g, { bedroom: '🛏️', study: '📖', kitchen: '🍳', bathroom: '🛁', classroom: '🏫' }[kind], 0.17, 0.14);
    face(g, { dx: 0.07, y: 0.1, z: 0.18, s: 0.7 });
  } else if (kind === 'china' || kind === 'uk' || kind === 'usa' || kind === 'canada') {
    if (kind === 'china') {
      cyl(g, 0.24, 0.28, 0.1, '#E8B85C', 0, 0.05, 0, 0, 0, 0, 8);
      for (let i = 0; i < 3; i++) {
        cyl(g, 0.14 - i * 0.03, 0.17 - i * 0.03, 0.09, '#D95F4B', 0, 0.16 + i * 0.1, 0, 0, 0, 0, 8);
        cyl(g, 0.11 - i * 0.025, 0.11 - i * 0.025, 0.06, '#C9463C', 0, 0.24 + i * 0.1, 0, 0, 0, 0, 8);
      }
      face(g, { dx: 0.06, y: 0.12, z: 0.16, s: 0.75 });
    } else if (kind === 'uk') {
      box(g, 0.14, 0.5, 0.14, '#D9C9A8', 0, 0.25, 0);
      sph(g, 0.03, '#FFC94E', 0, 0.55, 0);
      box(g, 0.16, 0.03, 0.16, '#C4B088', 0, 0.48, 0);
      face(g, { dx: 0.045, y: 0.3, z: 0.08, s: 0.65 });
    } else if (kind === 'usa') {
      houseBox(g, 0.4, 0.22, 0.28, '#FFFFFF', '#8FA8C0');
      for (const sx of [-1, 1]) cyl(g, 0.03, 0.035, 0.22, '#FFFFFF', 0.12 * sx, 0.11, 0.17, 0, 0, 0, 10);
      face(g, { dx: 0.07, y: 0.14, z: 0.16, s: 0.7 });
    } else {
      cyl(g, 0.1, 0.12, 0.4, '#E8ECF0', 0, 0.2, 0, 0, 0, 0, 12);
      sph(g, 0.05, '#E84B4B', 0, 0.44, 0, 1, 0.8, 0.5);
      face(g, { dx: 0.05, y: 0.26, z: 0.11, s: 0.7 });
    }
  }
  return g;
};

// ---- 天气 ----
AUTO_TEMPLATES.weather = (kind) => {
  const g = G();
  if (kind === 'cloudy' || kind === 'snowy' || kind === 'rainy' || kind === 'weather') {
    sph(g, 0.16, '#FFFFFF', -0.08, 0.24, 0, 1.1, 0.8, 1);
    sph(g, 0.13, '#FFFFFF', 0.1, 0.26, 0.02, 1, 0.75, 1);
    sph(g, 0.11, '#F0F4FF', 0, 0.3, -0.04, 1, 0.8, 1);
    if (kind === 'rainy' || kind === 'weather') for (const [dx] of [[-0.1], [0.06], [0.16]])
      sph(g, 0.028, '#7EC4F2', dx, 0.06, 0.03, 1, 1.5, 1, 0, 0, 0, { alpha: 0.9 });
    if (kind === 'snowy') for (const [dx] of [[-0.1], [0.05], [0.15]])
      badge(g, '❄️', 0.08, 0.05).position.set(dx, 0.07, 0.04);
    if (kind === 'weather') sph(g, 0.06, '#FFD44E', 0.16, 0.38, 0, 1, 1, 1, { emissive: '#FFB93C', ei: 0.5 });
    face(g, { dx: 0.06, y: 0.26, z: 0.14, s: 0.85 });
  } else {
    const sunLike = kind === 'hot' || kind === 'sunny';
    const c = { cold: '#A8D8F0', cool: '#8FD0B8', warm: '#FFB36B', hot: '#E85C4B', sunny: '#FFC94E', windy: '#B8D8B0' }[kind] || '#FFC94E';
    blobBase(g, c);
    const em = { cold: '❄️', cool: '🍃', warm: '🌤️', hot: '🔥', sunny: '😎', windy: '🌬️' }[kind] || '🌤️';
    badge(g, em, 0.24, 0.13);
    face(g, { dx: 0.07, y: 0.36, z: 0.15, s: 0.8 });
  }
  return g;
};

// ---- 季节 ----
AUTO_TEMPLATES.season = (kind) => {
  const g = G();
  if (kind === 'winter') {
    sph(g, 0.15, '#FFFFFF', 0, 0.12, 0);
    sph(g, 0.11, '#FFFFFF', 0, 0.3, 0);
    cyl(g, 0.014, 0.014, 0.12, '#8A6844', 0, 0.3, 0, 0, 0, 0.9);
    face(g, { dx: 0.045, y: 0.31, z: 0.09, s: 0.7 });
    sph(g, 0.035, '#3E4450', 0, 0.4, 0);
  } else if (kind === 'picnic') {
    box(g, 0.3, 0.14, 0.2, '#D97F5C', 0, 0.09, 0);
    box(g, 0.31, 0.04, 0.21, '#FFF6EC', 0, 0.17, 0);
    cyl(g, 0.015, 0.015, 0.16, '#8A6844', -0.08, 0.26, 0);
    sph(g, 0.04, '#FFF6EC', -0.08, 0.35, 0);
    face(g, { dx: 0.055, y: 0.1, z: 0.11, s: 0.75 });
  } else {
    const c = { spring: '#FFB7CB', summer: '#8FD08F', autumn: '#F0A05C', season: '#B8A0E0' }[kind] || '#FFB7CB';
    blobBase(g, c);
    const em = { spring: '🌸', summer: '🌻', autumn: '🍁', season: '🎡' }[kind] || '🌸';
    badge(g, em, 0.24, 0.13);
    face(g, { dx: 0.07, y: 0.36, z: 0.15, s: 0.8 });
  }
  return g;
};

// ---- 时间 ----
const WEEK_COLORS = ['#E8736F', '#F0A05C', '#E8C46B', '#8FBF6F', '#5CA8D9', '#B8A0E0', '#F090B8'];
AUTO_TEMPLATES.time2 = (kind, arg) => {
  const g = G();
  if (kind === 'weekday' || kind === 'month') {
    const idx = parseInt(arg, 10) || 1;
    const c = kind === 'weekday' ? WEEK_COLORS[idx - 1] : (['#E8736F', '#F0A0C0', '#8FBF6F', '#8FD0B8', '#FFD44E', '#7EC4F2', '#F0A05C', '#FF9A5C', '#B8863C', '#D95F4B', '#A8B0C0', '#E8E4F5'][idx - 1] || '#FFD44E');
    box(g, 0.28, 0.32, 0.1, '#FFFDF4', 0, 0.18, 0);
    box(g, 0.28, 0.09, 0.11, c, 0, 0.3, 0);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(String(idx), '#FFFFFF', '#5A4632'), transparent: true }));
    s.scale.setScalar(0.42);
    s.position.set(0, 0.14, 0.07);
    s.renderOrder = 2;
    g.add(s);
    face(g, { dx: 0.055, y: 0.05, z: 0.06, s: 0.65 });
    topper(g, c);
  } else {
    const em = { weekend: '🎉', tomorrow: '🌅', tonight: '🌙', yesterday: '🌇', ago: '🏺', slept: '😴', easter: '🥚', christmas: '🎄', term: '📚' }[kind] || '⏰';
    blobBase(g, { weekend: '#FFD9E8', tomorrow: '#FFF3C8', tonight: '#D8E0F5', yesterday: '#F5D9C0', ago: '#E0D8C8', slept: '#D8E4F5', easter: '#E8F5D8', christmas: '#D8F0D8', term: '#E4DFF5' }[kind] || '#F5E0C8');
    badge(g, em, 0.24, 0.14);
    face(g, { dx: 0.07, y: 0.37, z: 0.15, s: 0.8 });
  }
  return g;
};

// ---- 抽象词 & 方位词 ----
const WORD_EMOJI = {
  question: '❓', his: '👦', her: '👧', these: '👉', clown: '🤡',
  fresh: '🥬', healthy: '🥗', delicious: '😋', homework: '📝', class: '🏫',
  internet: '🌐', toy: '🧸', expensive: '💰', cheap: '🪙', nice: '✨', pretty: '🌸',
  size: '📐', sale: '🏷️', crossing: '🚸', near: '📍', stop: '🛑', job: '💼',
  hobby: '⭐', badminton: '🏸', quietly: '🤫', loudly: '📢', special: '🌟', best: '🥇',
  old: '👴', young: '🧑', kind: '💗', strict: '🧐', polite: '🙏', hardworking: '📚',
  helpful: '🤝', clever: '💡', shy: '😳', quiet: '🤫', strong: '💪',
  taller: '🦒', shorter: '🐧', stronger: '💪', older: '⏫', younger: '👶',
  bigger: '🐘', heavier: '🏋️', longer: '🚂', thinner: '🦩', smaller: '🐜',
  funny: '🤣',
};
AUTO_TEMPLATES.word = (kind) => {
  const g = G();
  // 方位词：小方块 + 小果冻摆出方位关系
  const boxWords = { on: [0, 0.34, 0], in: [0, 0.16, 0], under: [0, -0.06, 0.28], front: [0, 0.12, 0.3], above: [0, 0.5, 0], beside: [0.34, 0.1, 0], behind: [0, 0.12, -0.3] };
  if (boxWords[kind]) {
    const [dx, dy, dz] = boxWords[kind];
    box(g, 0.3, 0.3, 0.3, '#E8B85C', 0, 0.15, 0);
    box(g, 0.32, 0.04, 0.32, '#C8944C', 0, 0.31, 0);
    if (kind === 'in') { box(g, 0.24, 0.02, 0.24, '#8A6030', 0, 0.31, 0); }
    const mini = G();
    sph(mini, 0.08, '#FF8FB0', 0, 0, 0, 1, 1.1, 1);
    face(mini, { dx: 0.035, y: 0.02, z: 0.07, s: 0.6 });
    mini.position.set(dx, dy + (kind === 'under' ? 0.08 : kind === 'in' ? 0.06 : 0), dz);
    g.add(mini);
    face(g, { dx: 0.07, y: 0.22, z: 0.17, s: 0.8 });
    return g;
  }
  if (kind === 'long') {
    cap(g, 0.1, 0.34, '#8FD0B8', 0, 0.14, 0, 0, 0, Math.PI / 2).scale.set(1, 1.2, 1);
    face(g, { dx: 0.05, y: 0.2, z: 0.1, s: 0.8 });
    return g;
  }
  if (kind === 'between') {
    sph(g, 0.09, '#FF8FB0', -0.18, 0.16, 0);
    sph(g, 0.09, '#7EC4F2', 0.18, 0.16, 0);
    sph(g, 0.08, '#FFD44E', 0, 0.18, 0);
    face(g, { dx: 0.04, y: 0.19, z: 0.07, s: 0.65 });
    return g;
  }
  if (kind === 'over' || kind === 'best' || kind === 'stop' || kind === 'crossing' || kind === 'sale') {
    if (kind === 'stop') {
      cyl(g, 0.18, 0.18, 0.04, '#E84B4B', 0, 0.28, 0, 0, 0, 0, 8);
      cyl(g, 0.015, 0.015, 0.24, '#C0C4CE', 0, 0.12, 0);
      face(g, { dx: 0.055, y: 0.3, z: 0.05, s: 0.7 });
      return g;
    }
    if (kind === 'crossing') {
      box(g, 0.34, 0.05, 0.34, '#B8B8C4', 0, 0.04, 0);
      for (let i = 0; i < 3; i++) box(g, 0.24, 0.055, 0.05, '#FFFFFF', 0, 0.042, -0.1 + i * 0.1);
      face(g, { dx: 0.05, y: 0.12, z: 0.16, s: 0.7 });
      return g;
    }
    // over / best / sale：头顶挂着的东西
    blobBase(g, '#FFE9B8');
    face(g, { dx: 0.07, y: 0.36, z: 0.15, s: 0.8 });
    cyl(g, 0.008, 0.008, 0.14, '#8A6844', 0, 0.52, 0);
    if (kind === 'best') { tor(g, 0.06, 0.02, '#FFC94E', 0, 0.52, 0, Math.PI / 2); sph(g, 0.02, '#E84B4B', 0, 0.58, 0); }
    else if (kind === 'sale') badge(g, '🏷️', 0.5, 0.1);
    else badge(g, '💫', 0.5, 0.1);
    return g;
  }
  const em = WORD_EMOJI[kind] || '🔤';
  const sizeVar = { big: 1.35, small: 0.68, tall: [1, 1.4, 1], fat: [1.4, 0.9, 1.1], thin: [0.62, 1.25, 0.8] }[kind];
  const c = BADGE_COLORS[(kind.length * 7) % BADGE_COLORS.length];
  if (Array.isArray(sizeVar)) blobBase(g, c).scale.set(...sizeVar);
  else blobBase(g, c).scale.setScalar(sizeVar || 1);
  badge(g, em, 0.26 / (sizeVar || 1), 0.12);
  face(g, { dx: 0.07, y: 0.4 / (sizeVar || 1), z: 0.15, s: 0.8 });
  return g;
};

// ---- 短语词宠：句子里的小精灵，头顶对话气泡 ----
AUTO_TEMPLATES.phrase = (emoji, text) => {
  const g = G();
  const colors = ['#FFE0B8', '#D8ECF5', '#E8DCF5', '#F5DCE4', '#DCF0DC', '#F5EED0'];
  const c = colors[(String(text).length * 5 + String(emoji).length) % colors.length];
  blobBase(g, c);
  face(g, { dx: 0.07, y: 0.22, z: 0.17 });
  // 头顶飘起的对话气泡（含图标 + 短语全文）
  badge(g, emoji, 0.3, 0.17);
  topper(g, '#FFC94E');
  return g;
};

// 短语词宠的悬浮气泡标牌（挂在头顶，比字母牌更醒目）
export function addPhraseTag(group, text, emoji) {
  const tex = speechBubbleTexture(text, emoji);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = tagHeight(group);
  s.scale.set(1.15, 0.8, 1);
  s.position.set(0, h + 0.5, 0.12);
  s.name = 'phraseTag';
  group.add(s);
  return s;
}

// ---- 通用图标词宠（课本补充词汇：果冻身体 + 专属图标） ----
AUTO_TEMPLATES.icon = (emoji) => {
  const g = G();
  const palette = ['#FFE0B8', '#D8ECF5', '#E8DCF5', '#F5DCE4', '#DCF0DC', '#F5EED0', '#F5E4DC', '#E0E4F5'];
  let h = 0; const s = String(emoji);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  blobBase(g, palette[h % palette.length]);
  badge(g, emoji, 0.3, 0.19);
  face(g, { dx: 0.07, y: 0.19, z: 0.17 });
  topper(g, palette[(h >> 3) % palette.length]);
  return g;
};

// ---- 自然风景 ----
AUTO_TEMPLATES.nature = (kind) => {
  const g = G();
  if (kind === 'forest') {
    for (const [dx, dz, s] of [[-0.1, 0, 0.8], [0.12, 0.05, 0.65], [0, -0.1, 0.5]]) {
      const t = G();
      cyl(t, 0.025, 0.03, 0.1, '#8A6844', 0, 0.05, 0);
      cone(t, 0.09 * s + 0.04, 0.16, '#5CA85C', 0, 0.16, 0, 0, 0, 0, 8);
      t.scale.setScalar(s + 0.4);
      t.position.set(dx * 2, 0, dz * 2);
      g.add(t);
    }
    face(g, { dx: 0.04, y: 0.06, z: 0.06, s: 0.65 });
  } else if (kind === 'river') {
    tor(g, 0.2, 0.05, '#6FC7E8', 0, 0.1, 0, 0, 0, 0.4, Math.PI * 1.4);
    tor(g, 0.24, 0.04, '#8FD8F0', 0, 0.12, 0.04, 0, 0, 0.9, Math.PI * 1.1);
    sph(g, 0.03, '#FFFFFF', 0.16, 0.16, 0.1, 1, 0.5, 0.6);
    face(g, { dx: 0.05, y: 0.14, z: 0.13, s: 0.7 });
  } else if (kind === 'lake') {
    cyl(g, 0.2, 0.22, 0.045, '#6FC7E8', 0, 0.04, 0, 0, 0, 0, 18);
    sph(g, 0.03, '#FFFFFF', 0.08, 0.07, 0.05, 1, 0.4, 0.7);
    face(g, { dx: 0.05, y: 0.08, z: 0.16, s: 0.7 });
  } else if (kind === 'mountain' || kind === 'hill') {
    const h = kind === 'mountain' ? 0.42 : 0.24;
    cone(g, 0.24, h, kind === 'mountain' ? '#8A9BA8' : '#8FBF73', 0, h / 2, 0, 0, 0, 0, 8);
    if (kind === 'mountain') cone(g, 0.09, 0.13, '#FFFFFF', 0, h - 0.05, 0, 0, 0, 0, 8);
    else sph(g, 0.08, '#7CB86F', 0.08, h * 0.7, 0.04, 1, 0.6, 1);
    face(g, { dx: 0.05, y: h * 0.3, z: 0.14, s: 0.7 });
  }
  return g;
};

// ---- 调度器 ----
let AUTO_SPECS_MAP = null;
export function setAutoSpecs(map) { AUTO_SPECS_MAP = map; }

// ================= 词宠工厂 & 缩略图 =================
export function buildPet(petId) {
  const b = PETS[petId];
  if (b) return b();
  const spec = AUTO_SPECS_MAP && AUTO_SPECS_MAP[petId];
  if (spec) {
    const [tpl, kind, arg] = String(spec).split(':');
    const fn = AUTO_TEMPLATES[tpl];
    if (fn) return fn(kind, arg);
  }
  const g = G();
  sph(g, 0.15, '#CCCCCC', 0, 0.15, 0);
  return g;
}

let thumbRenderer = null;
const thumbCache = {};
export function petThumbnail(petId) {
  if (thumbCache[petId]) return thumbCache[petId];
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(128, 128);
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  const pet = buildPet(petId);
  scene.add(pet);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffe4f0, 2.2));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const bb = new THREE.Box3().setFromObject(pet);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  cam.position.set(center.x + maxDim * 0.9, center.y + maxDim * 0.7, center.z + maxDim * 1.3);
  cam.lookAt(center);
  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbCache[petId] = url;
  return url;
}
