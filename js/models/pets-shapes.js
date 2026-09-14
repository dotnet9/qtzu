// 基础宠物形：PETS 表（海岛剧情词宠的手工低模），参数化词宠见 auto-templates.js
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor, face, quadBody } from './kit.js';

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


export const PETS = {};

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

