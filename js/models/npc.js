// NPC 造型（复用词宠/主角那套 kit）：圆润身体 + 小手臂 + 脸 + 角色道具 + 分件腿
//
// 为什么重建而不是烘焙：NPC 的几何本来就便宜（14 实例 × 约 1k 面），短板是**造型** ——
// 原来只有"胶囊 + 球"，与主角/词宠并排像上一代占位体。重建一次做完 6 个通用角色，
// 逐城特色角色（35 城各 1~2 个，见 js/npcs.js 的 CITY_ROLES）走"通用村民 + 草帽 + 篮子"，
// 身份仍由那两个 Sprite（表情招牌 + 名牌）表达，不必烘 35 个变体。
//
// 契约（js/npcs.js 依赖，勿改）：
//   · 返回 { group, legL, legR }
//   · legL/legR 是 **Group**（不是 Mesh）—— 动画只改它们的 position.z（前后摆），
//     内部放小腿 + 鞋，换装/加细节都不用动动画代码
//   · group 的原点在脚底、正面朝 +Z；总高约 1.19（头顶），Sprite 挂在 1.44 / 1.82
import * as THREE from 'three';
import { M, add, G, box, cone, face } from './kit.js';   // 其余图元走下面的低模版

// 低模版 kit：NPC 是背景配角（14 个实例、0.55 缩放），用球 12x9 / 胶囊 3x8 / 柱 10 边
// 把单个面数从 12.5k 降到约 5k —— iGPU 上 16.7ms 的预算很紧，这笔省得值。
const sphL = (g, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o) =>
  add(g, new THREE.SphereGeometry(r, 12, 9), M(c, o), x, y, z, 0, 0, 0, sx, sy, sz);
const capL = (g, r, len, c, x, y, z, rx = 0, ry = 0, rz = 0, o) =>
  add(g, new THREE.CapsuleGeometry(r, len, 3, 8), M(c, o), x, y, z, rx, ry, rz);
const cylL = (g, rt, rb, h, c, x, y, z, rx = 0, ry = 0, rz = 0, seg = 10, o) =>
  add(g, new THREE.CylinderGeometry(rt, rb, h, seg), M(c, o), x, y, z, rx, ry, rz);
const torL = (g, R, r, c, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, o) =>
  add(g, new THREE.TorusGeometry(R, r, 8, 12, arc), M(c, o), x, y, z, rx, ry, rz);
const boxL = box;   // 方盒本来就只有 12 面
const SKIN = '#FFE0C2';
const HAIR_DARK = '#4A3A2E';
const HAIR_GRAY = '#D8D4CE';
const PANTS = '#5B4632';
const SHOE = '#3E3226';

// 角色道具：一件就能读出身份（这是"NPC 像不像人"的关键）
function prop(g, id, shirt) {
  switch (id) {
    case 'tourist':            // 相机：机身 + 镜头 + 背带
      boxL(g, 0.14, 0.1, 0.08, '#3E3E46', 0, 0.72, 0.2);
      cylL(g, 0.045, 0.05, 0.06, '#2A2A30', 0, 0.72, 0.26, Math.PI / 2, 0, 0, 10);
      cylL(g, 0.052, 0.052, 0.015, '#7EC4F2', 0, 0.72, 0.29, Math.PI / 2, 0, 0, 10);
      boxL(g, 0.03, 0.16, 0.02, '#8A6844', 0.07, 0.82, 0.16);
      break;
    case 'vendor':             // 面碗：碗 + 面 + 筷子
      cylL(g, 0.13, 0.09, 0.11, '#F5F1E8', 0, 0.66, 0.19, 0, 0, 0, 14);
      torL(g, 0.125, 0.018, '#E8C86A', 0, 0.715, 0.19, Math.PI / 2);
      sphL(g, 0.09, '#F0D9A8', 0, 0.72, 0.19, 1, 0.4, 1);
      for (const sx of [-0.03, 0.03]) cylL(g, 0.006, 0.006, 0.24, '#B08860', sx, 0.8, 0.2, 0.5, 0, sx * 6, 6);
      break;
    case 'student':            // 书包：包体 + 背带 + 书角
      boxL(g, 0.24, 0.26, 0.12, '#C43B3B', 0, 0.62, -0.16);
      boxL(g, 0.16, 0.08, 0.06, '#F5F1E8', 0, 0.6, -0.23);
      for (const sx of [-1, 1]) boxL(g, 0.03, 0.3, 0.02, '#8A6844', 0.08 * sx, 0.78, -0.06, 0.2, 0, 0);
      break;
    case 'gardener':           // 洒水壶：壶身 + 壶嘴 + 提手
      cylL(g, 0.09, 0.11, 0.14, '#5AB88A', 0.17, 0.6, 0.12, 0, 0, 0, 12);
      cylL(g, 0.02, 0.03, 0.16, '#5AB88A', 0.26, 0.66, 0.12, 0, 0, -0.9, 8);
      torL(g, 0.05, 0.012, '#3E8A66', 0.17, 0.69, 0.12, 0, 0, 0, Math.PI, 8);
      break;
    case 'elder':              // 拐杖：杆 + 弯头
      cylL(g, 0.014, 0.018, 0.72, '#8A6844', 0.19, 0.36, 0.08, 0, 0, 0, 8);
      torL(g, 0.045, 0.016, '#8A6844', 0.19, 0.72, 0.08, 0, Math.PI / 2, 0, Math.PI, 8);
      break;
    case 'postman':            // 邮包：包体 + 斜带
      boxL(g, 0.2, 0.18, 0.1, '#4E7CB1', 0, 0.6, 0.16);
      boxL(g, 0.03, 0.34, 0.02, '#3E5A82', 0.02, 0.72, 0.12, 0, 0, 0.5);
      boxL(g, 0.08, 0.06, 0.02, '#F5F1E8', 0, 0.62, 0.22);
      break;
    default:                   // 逐城特色角色：草帽 + 篮子（身份靠 Sprite 表达）
      cylL(g, 0.19, 0.24, 0.035, '#E8C86A', 0, 1.16, 0, 0, 0, 0, 16);
      sphL(g, 0.17, '#E8C86A', 0, 1.2, 0, 1, 0.55, 1);
      cylL(g, 0.1, 0.08, 0.12, '#B08860', -0.17, 0.6, 0.14, 0, 0, 0, 12);
      torL(g, 0.095, 0.014, '#8A6844', -0.17, 0.66, 0.14, Math.PI / 2, 0, 0, 16);
      sphL(g, 0.05, '#FF8FB0', -0.19, 0.68, 0.14);
      sphL(g, 0.045, '#FFE24E', -0.14, 0.68, 0.15);
      break;
  }
}

// 头发/帽子：按角色区分（也是"一眼认人"的一部分）
function hair(g, id) {
  if (id === 'elder') {
    sphL(g, 0.2, HAIR_GRAY, 0, 1.02, -0.01, 1.02, 0.98, 1.02);
    sphL(g, 0.07, HAIR_GRAY, 0, 0.98, 0.17, 1.3, 0.7, 0.7);
    sphL(g, 0.06, HAIR_GRAY, 0, 0.9, 0.19, 1.2, 0.6, 0.6);          // 胡子
    sphL(g, 0.05, HAIR_GRAY, -0.1, 1.0, 0.15, 1, 1.2, 0.8);
    sphL(g, 0.05, HAIR_GRAY, 0.1, 1.0, 0.15, 1, 1.2, 0.8);
    return;
  }
  sphL(g, 0.2, HAIR_DARK, 0, 1.04, -0.01, 1.02, 0.96, 1.02);
  sphL(g, 0.075, HAIR_DARK, 0, 1.11, 0.15, 1.3, 0.75, 0.75);       // 刘海
  for (const sx of [-1, 1]) sphL(g, 0.055, HAIR_DARK, 0.15 * sx, 1.0, 0.05, 1, 1.3, 0.85);   // 鬓角
  if (id === 'postman') {                                          // 邮差帽：帽身 + 帽檐
    cylL(g, 0.17, 0.19, 0.1, '#4E7CB1', 0, 1.18, 0, 0, 0, 0, 14);
    cylL(g, 0.21, 0.21, 0.025, '#3E5A82', 0, 1.13, 0.03, 0, 0, 0, 16);
    boxL(g, 0.06, 0.04, 0.02, '#F5F1E8', 0, 1.19, 0.17);
  } else if (id === 'gardener') {                                  // 草帽
    cylL(g, 0.2, 0.26, 0.035, '#E8C86A', 0, 1.14, 0, 0, 0, 0, 16);
    sphL(g, 0.18, '#E8C86A', 0, 1.18, 0, 1, 0.55, 1);
    cylL(g, 0.185, 0.19, 0.03, '#5AB88A', 0, 1.16, 0, 0, 0, 0, 16);
  } else if (id === 'student') {                                   // 学生帽（贝雷）
    sphL(g, 0.16, '#4E9EE8', 0, 1.17, 0, 1.15, 0.5, 1.15);
    sphL(g, 0.03, '#FFE24E', 0, 1.25, 0, 1, 1, 1);
  }
}

export function buildNPC(role = {}, shirt = '#7EA8E8') {
  const id = role.id || 'local';
  const g = G();
  // 腿：Group（动画改 position.z）+ 小腿 + 鞋
  const legL = G(), legR = G();
  legL.position.set(-0.1, 0.3, 0); legR.position.set(0.1, 0.3, 0);
  for (const leg of [legL, legR]) {
    capL(leg, 0.072, 0.13, PANTS, 0, -0.11, 0);
    sphL(leg, 0.086, SHOE, 0, -0.245, 0.028, 1, 0.6, 1.3);
  }
  g.add(legL, legR);
  // 身体：略瘦的胶囊 + 领口 + 两条手臂（手是球）
  capL(g, 0.2, 0.4, shirt, 0, 0.52, 0);
  cylL(g, 0.13, 0.15, 0.06, '#F5F1E8', 0, 0.8, 0, 0, 0, 0, 14);
  for (const sx of [-1, 1]) {
    capL(g, 0.062, 0.14, shirt, 0.22 * sx, 0.6, 0, 0, 0, sx * 0.16);
    sphL(g, 0.07, SKIN, 0.245 * sx, 0.46, 0.01);
  }
  // 头 + 脸（与主角/词宠同款：黑豆眼 + 高光 + 腮红 + 微笑嘴）
  const head = G(); head.position.set(0, 1.0, 0); g.add(head);
  sphL(head, 0.19, SKIN, 0, 0, 0, 1, 0.96, 0.98);
  face(head, { dx: 0.072, y: 0.02, z: 0.166, s: 1.05, blush: 0.122, by: -0.05 });
  torL(head, 0.033, 0.009, '#C06A5A', 0, -0.012, 0.178, 0.4);
  hair(head, id);
  prop(g, id, shirt);
  // 影：NPC 也要投影（站在地上才"坐得住"）
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, legL, legR };
}
