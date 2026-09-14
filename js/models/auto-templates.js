// 参数化词宠模板：按 AUTO_SPECS 的 tpl:kind:arg 批量生成有辨识度的低模词宠
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor, face, quadBody } from './kit.js';

import { letterTexture } from './tags.js';

export const BADGE_COLORS = ['#FFD9E8', '#FFF3C8', '#D8F0D0', '#D0E8F5', '#E8DFF5', '#FFE4CC'];

// 圆滚滚的小精灵身体（徽章类通用）
export function blobBase(g, color = '#FFE9B8') {
  sph(g, 0.19, color, 0, 0.2, 0, 1, 1.02, 1);
  sph(g, 0.13, '#FFFFFF', 0, 0.06, 0.1, 1, 0.5, 0.9); // 肚皮
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
    sph(g, 0.045, color, 0.1 * lx, 0.045, 0.1 * lz, 1, 0.7, 1.3); // 小脚
  return g;
}

// 头顶小旗/小星
export function topper(g, color = '#FF8FB0') {
  cyl(g, 0.008, 0.008, 0.12, '#8A6844', 0, 0.44, -0.05);
  sph(g, 0.04, color, 0, 0.52, -0.05, 1, 1, 1, 0, 0, 0, { emissive: color, ei: 0.4 });
}

export const AUTO_TEMPLATES = {};

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

