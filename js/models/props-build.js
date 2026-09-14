// 人造物：谷仓/风车/码头/栅栏/稻草人/许愿井/告示牌…（PROPS 人造物半边）
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor, face, quadBody } from './kit.js';

import { badge } from './tags.js';

export const merchantCart = () => {
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
export const fence = () => {
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

export const barn = () => {
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

export const windmill = () => {
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

export const dock = () => {
  const g = G();
  for (let i = 0; i < 5; i++) box(g, 2.2, 0.1, 1.1, '#C89A6B', 0, 0.16, -2.2 + i * 1.1);
  for (const z of [-2, 0, 2]) for (const x of [-0.9, 0.9]) cyl(g, 0.07, 0.07, 0.6, '#8A6844', x, -0.1, z, 0, 0, 0, 8);
  return g;
};

export const haybale = () => {
  const g = G();
  cyl(g, 1.1, 1.1, 1.5, '#E8C87E', 0, 1.1, 0, 0, 0, Math.PI / 2, 16);
  tor(g, 1.11, 0.03, '#C9A46B', 0, 1.1, 0, 0, 0, Math.PI / 2);
  tor(g, 0.6, 0.025, '#D9B68F', 0, 1.1, 0, 0, 0, Math.PI / 2);
  return g;
};

export const umbrella = () => {
  const g = G();
  cyl(g, 0.028, 0.028, 1.9, '#C9A46B', 0.12, 0.95, 0, 0, 0, 0.14);
  cone(g, 1.05, 0.5, '#FF8A7A', 0.25, 1.95, 0, 0, 0, 0.14, 9);      // 伞面
  cone(g, 1.02, 0.18, '#FFF6EC', 0.25, 1.9, 0, 0, 0, 0.14, 9, { alpha: 0.35 }); // 白边
  sph(g, 0.05, '#FFF6EC', 0.36, 2.24, 0);
  return g;
};

export const sandcastle = (s = 1) => {
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

export const scarecrow = () => {
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

export const pinwheel = () => {
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

export const well = () => {
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

export const signboard = () => {
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
