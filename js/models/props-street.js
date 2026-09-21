// 街道家具：路灯 / 长椅 / 花箱 / 指路牌 / 邮筒 / 遮阳伞 / 路桩
//
// 为什么单独一个模块：城市"像不像城市"很大程度取决于这些贴地的小物件（参考图里最抓眼的
// 就是它们），但它们的摆放规则（沿迎宾主街、成对、避让）属于 world.js 的活。
// 这里只管"长什么样"：契约与 props-nature/props-build 一致 —— 返回 Group、原点在底部中心。
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor } from './kit.js';

// 路灯：铸铁杆 + 弯臂 + 发光灯头（夜里是唯一的暖光源，白天靠白灯罩读形）
export const streetLamp = () => {
  const g = G();
  cyl(g, 0.1, 0.17, 0.34, '#4A4A52', 0, 0.17, 0, 0, 0, 0, 10);          // 底座
  cyl(g, 0.07, 0.1, 3.1, '#5A5A64', 0, 1.72, 0, 0, 0, 0, 10);           // 杆（略带收分）
  tor(g, 0.19, 0.035, '#5A5A64', 0, 3.28, 0, Math.PI / 2, 0, 0);        // 杆顶环饰
  cap(g, 0.075, 0.34, '#5A5A64', 0, 3.5, 0);                            // 顶帽
  // 弯臂：两段斜圆柱 + 灯头（灯头正对街道方向 +z）
  cyl(g, 0.045, 0.05, 0.6, '#5A5A64', 0, 3.68, 0.22, 0.5, 0, 0, 8);
  cyl(g, 0.04, 0.045, 0.42, '#5A5A64', 0, 3.86, 0.56, 1.2, 0, 0, 8);
  const head = G(); head.position.set(0, 3.78, 0.78); g.add(head);
  cyl(head, 0.14, 0.2, 0.16, '#3E3E46', 0, 0.08, 0, 0, 0, 0, 12);        // 灯罩顶盖
  // 灯泡自发光 0.55 → 0.28：0.55 时灯头越过辉光门槛，check-render 的 composerDiff 被顶到 0.037（门槛 0.02）——
  // 辉光预算该留给蛋/词宠这些真正的发光物（与校门石灯同样的处理）
  sph(head, 0.16, '#FFF6DC', 0, -0.06, 0, 1, 0.72, 1, { emissive: '#FFE9B0', ei: 0.28 });
  cyl(head, 0.1, 0.16, 0.06, '#3E3E46', 0, -0.19, 0, 0, 0, 0, 12);       // 灯罩下沿
  return g;
};

// 长椅：木条座面 + 靠背 + 铸铁腿（面向 +z，也就是朝街道）
export const bench = () => {
  const g = G();
  const wood = '#B07A4E', wood2 = '#9A6A44', iron = '#4A4A52';
  for (const sx of [-0.72, 0.72]) {
    box(g, 0.1, 0.42, 0.1, iron, sx, 0.21, -0.18);
    box(g, 0.1, 0.42, 0.1, iron, sx, 0.21, 0.18);
    box(g, 0.08, 0.5, 0.08, iron, sx, 0.72, -0.2);                       // 靠背立柱
  }
  for (let i = 0; i < 3; i++) box(g, 1.7, 0.07, 0.15, i % 2 ? wood2 : wood, 0, 0.45, -0.18 + i * 0.18);
  for (let i = 0; i < 2; i++) box(g, 1.7, 0.15, 0.06, i % 2 ? wood2 : wood, 0, 0.72 + i * 0.22, -0.24);
  box(g, 1.86, 0.08, 0.08, iron, 0, 0.4, 0);                              // 横撑
  return g;
};

// 花箱：木箱 + 土 + 三团花（城市气质色）
export const planter = (color = '#FF9FBE') => {
  const g = G();
  box(g, 1.1, 0.5, 0.62, '#A8754E', 0, 0.25, 0);
  box(g, 1.18, 0.1, 0.7, '#8A6242', 0, 0.52, 0);                          // 上沿
  box(g, 1.0, 0.06, 0.52, '#5A4230', 0, 0.56, 0);                         // 土面
  const flowers = [color, '#FFE24E', '#C9A7EB'];
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 0.32;
    sph(g, 0.24, '#6FBF73', dx, 0.72, 0.02, 1, 0.8, 1);                   // 叶丛
    sph(g, 0.11, flowers[i % flowers.length], dx + 0.06, 0.84, 0.06);     // 花头
    sph(g, 0.08, flowers[(i + 1) % flowers.length], dx - 0.1, 0.78, -0.08);
  }
  return g;
};

// 指路牌：柱 + 两块箭头牌（朝向 +x / -x，读起来像真路牌）
export const signpost = () => {
  const g = G();
  cyl(g, 0.07, 0.09, 2.3, '#8A6844', 0, 1.15, 0, 0, 0, 0, 8);
  cap(g, 0.08, 0.1, '#6B5236', 0, 2.34, 0);
  const plate = (y, dir, color) => {
    const w = 0.9, h = 0.24;
    box(g, w, h, 0.05, color, dir * (0.08 + w / 2), y, 0);
    // 箭头尖：一个小三角（用锥体压扁）
    cone(g, 0.12, 0.24, color, dir * (0.08 + w + 0.1), y, 0, 0, 0, dir * Math.PI / 2, 4);
  };
  plate(1.95, 1, '#F5F1E8');
  plate(1.6, -1, '#BFE3F0');
  box(g, 0.5, 0.1, 0.05, '#4A5560', 0.32, 1.78, 0);                      // 中间横条
  return g;
};

// 邮筒：圆筒 + 顶盖 + 投信口（城市家具里辨识度最高的一个）
export const mailbox = () => {
  const g = G();
  cyl(g, 0.26, 0.3, 0.22, '#3E3E46', 0, 0.11, 0, 0, 0, 0, 12);            // 底座
  cyl(g, 0.3, 0.3, 0.9, '#D95555', 0, 0.67, 0, 0, 0, 0, 14);              // 筒身
  sph(g, 0.3, '#C24A50', 0, 1.12, 0, 1, 0.6, 1);                          // 圆顶
  box(g, 0.42, 0.1, 0.1, '#3E3E46', 0, 1.0, 0.26);                        // 投信口
  box(g, 0.36, 0.16, 0.04, '#F5F1E8', 0, 0.78, 0.29);                     // 白标牌
  return g;
};

// 遮阳伞：柱 + 伞面（八瓣）+ 底座（集市/广场用）
export const parasol = (color = '#FF8F6B') => {
  const g = G();
  cyl(g, 0.4, 0.46, 0.16, '#B0A79A', 0, 0.08, 0, 0, 0, 0, 12);            // 石座
  cyl(g, 0.05, 0.06, 2.3, '#A8754E', 0, 1.2, 0, 0, 0, 0, 8);              // 柱
  const canopy = G(); canopy.position.set(0, 2.32, 0); g.add(canopy);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 3, 1), M(i % 2 ? color : '#F5F1E8'));
    petal.scale.set(1, 1, 0.42);
    petal.position.set(Math.cos(a) * 0.62, 0.34, Math.sin(a) * 0.62);
    petal.rotation.set(Math.PI / 2, 0, 0);
    petal.rotation.z = -a;
    canopy.add(petal);
  }
  sph(g, 0.09, '#E8C86A', 0, 2.66, 0);                                    // 伞尖
  return g;
};

// 路桩：短柱 + 顶球（广场/步行街边界，成排出现最像城市）
export const bollard = () => {
  const g = G();
  cyl(g, 0.11, 0.15, 0.62, '#5A5A64', 0, 0.31, 0, 0, 0, 0, 10);
  tor(g, 0.13, 0.03, '#E8C86A', 0, 0.5, 0, Math.PI / 2, 0, 0);           // 金环
  sph(g, 0.14, '#4A4A52', 0, 0.68, 0, 1, 0.9, 1);
  return g;
};

// 垃圾桶：方桶 + 盖 + 侧提手
export const trashbin = () => {
  const g = G();
  cyl(g, 0.24, 0.26, 0.66, '#6B7A6B', 0, 0.33, 0, 0, 0, 0, 12);
  cyl(g, 0.28, 0.26, 0.08, '#4A5560', 0, 0.7, 0, 0, 0, 0, 12);            // 盖
  cyl(g, 0.05, 0.05, 0.1, '#4A5560', 0, 0.79, 0, 0, 0, 0, 8);             // 提钮
  for (const sx of [-0.27, 0.27]) box(g, 0.05, 0.22, 0.06, '#4A5560', sx, 0.46, 0);
  return g;
};
