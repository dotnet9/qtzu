// 自然景物：树/棕榈/灌木/花丛/岩石/睡莲/沙丘…（PROPS 自然物半边）
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor, face, quadBody } from './kit.js';

import { badge } from './tags.js';

export const owl = () => {
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
export const nest = () => {
  const g = G();
  tor(g, 0.3, 0.09, '#B98A5A', 0, 0.07, 0, Math.PI / 2);
  sph(g, 0.065, '#FFF6EC', -0.08, 0.11, 0.02, 1, 1.25, 1);
  sph(g, 0.065, '#BFE3F5', 0.09, 0.11, -0.03, 1, 1.25, 1);
  return g;
};
// 地标：海滩的贝壳堆与小海星
export const shells = () => {
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

export const tree = (blossom = false) => {
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

export const hedge = () => {
  const g = G();
  box(g, 2, 1.3, 1.2, '#5CA85C', 0, 0.65, 0);
  sph(g, 0.55, '#6FBF73', -0.7, 1.25, 0, 1, 0.7, 0.9);
  sph(g, 0.5, '#7CC96F', 0.6, 1.3, 0.1, 1, 0.7, 0.9);
  return g;
};

export const pumpkin = () => {
  const g = G();
  sph(g, 0.32, '#FF9A3C', 0, 0.26, 0, 1, 0.85, 1);
  sph(g, 0.28, '#FFAB54', 0, 0.26, 0, 0.55, 0.88, 1);
  cyl(g, 0.04, 0.05, 0.12, '#5C8F46', 0, 0.6, 0);
  sph(g, 0.06, '#5C8F46', 0.08, 0.62, 0, 1.4, 0.3, 0.8);
  return g;
};

export const rock = (s = 1) => {
  const g = G();
  sph(g, 0.22 * s, '#BDBDC8', 0, 0.14 * s, 0, 1.35, 0.7, 1);
  sph(g, 0.12 * s, '#CBCBD4', 0.18 * s, 0.1 * s, 0.1 * s);
  return g;
};

export const cloud = (s = 1) => {
  const g = G();
  sph(g, 0.5 * s, '#FFFFFF', 0, 0, 0, 1, 0.75, 1, 0, 0, 0, { alpha: 0.92 });
  sph(g, 0.36 * s, '#FFFFFF', 0.45 * s, -0.05 * s, 0.1 * s, 1, 0.8, 1, 0, 0, 0, { alpha: 0.92 });
  sph(g, 0.32 * s, '#FFFFFF', -0.4 * s, -0.02 * s, -0.08 * s, 1, 0.8, 1, 0, 0, 0, { alpha: 0.92 });
  return g;
};

export const flowerpatch = () => {
  const g = G();
  const cols = ['#FF8FB0', '#FFE24E', '#FFFFFF', '#B28FF5'];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 2 * i / 5 + Math.random();
    cyl(g, 0.012, 0.014, 0.18 + Math.random() * 0.1, '#66BB6A', Math.cos(a) * 0.25, 0.1, Math.sin(a) * 0.25);
    sph(g, 0.06, cols[i % 4], Math.cos(a) * 0.25, 0.24 + Math.random() * 0.06, Math.sin(a) * 0.25, 1, 0.7, 1);
  }
  return g;
};

export const soil = () => {
  const g = G();
  box(g, 1.6, 0.12, 3.4, '#8A6844', 0, 0.05, 0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 4; j++)
      sph(g, 0.07, '#A8825B', -0.55 + i * 0.55, 0.12, -1.2 + j * 0.8, 1, 0.6, 1);
  return g;
};

export const beanstalk = () => {
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
export const palm = () => {
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

export const pine = (s = 1) => {
  const g = G();
  cyl(g, 0.09, 0.14, 0.7, '#8A6844', 0, 0.35, 0, 0, 0, 0, 8);
  for (let i = 0; i < 3; i++)
    cone(g, 0.78 - i * 0.19, 0.95, i % 2 ? '#4E9152' : '#5CA85C', 0, 1.05 + i * 0.62, 0, 0, 0, 0, 9);
  g.scale.setScalar(s);
  return g;
};

export const bush = (s = 1) => {
  const g = G();
  sph(g, 0.4, '#4E9152', 0, 0.3, 0, 1.2, 0.85, 1);
  sph(g, 0.3, '#5CA85C', 0.3, 0.24, 0.1);
  sph(g, 0.26, '#57A24F', -0.28, 0.22, -0.06);
  g.scale.setScalar(s);
  return g;
};

export const log = (s = 1) => {
  const g = G();
  cyl(g, 0.16, 0.18, 1.3, '#A87551', 0, 0.18, 0, 0, 0, Math.PI / 2, 12);
  cyl(g, 0.14, 0.14, 0.03, '#E8CFA8', 0.65, 0.18, 0, 0, 0, Math.PI / 2, 12);
  tor(g, 0.08, 0.015, '#C9A46B', 0.66, 0.18, 0, 0, Math.PI / 2);
  sph(g, 0.07, '#8FD08F', -0.3, 0.32, 0.05, 1, 0.4, 1);
  g.scale.setScalar(s);
  return g;
};

export const lilyPad = () => {
  const g = G();
  cyl(g, 0.26, 0.3, 0.035, '#4E9152', 0, 0.02, 0, 0, 0, 0, 12);
  sph(g, 0.05, '#7CC96F', 0.1, 0.05, 0.06, 1, 0.5, 1);
  return g;
};

export const grassTuft = () => {
  const g = G();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * 2 * i / 5 + Math.random();
    cone(g, 0.028, 0.16 + Math.random() * 0.12, ['#7CC96F', '#8FD08F', '#6FBF73'][i % 3],
      Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05, 0.2 * Math.sin(a), 0, -0.2 * Math.cos(a), 5);
  }
  return g;
};

export const sunflower = () => {
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

export const gull = () => {
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

export const butterfly = (color = '#FF8FB0') => {
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
export const dune = (s = 1) => {
  const g = G();
  sph(g, 1, '#EDD49E', 0, 0, 0, 1.6, 0.72, 1);
  sph(g, 1, '#E5C88E', 0.7, -0.1, 0.3, 1.1, 0.5, 0.8);
  g.scale.setScalar(s);
  return g;
};

export const thorn = (s = 1) => {
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