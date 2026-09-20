// 大学校门造型库：招牌门模板 + 风格族门型 + 附属小道具
// buildUniGate(group, 校名, 校徽图) → { beamY, beamW, fz }（匾额挂点，供横梁贴校徽）
// 全程与 world.js 同款低模基本体 + Standard 材质（软渲染下小件无白块问题，地面才需 Basic）
import * as THREE from 'three';
import { PROPS } from './models.js';
import { familyFor, SIGNATURE } from './uni-gates.js';
import * as assets from './assets.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.rough ?? 0.9, metalness: 0,
  emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: !!o.alpha, opacity: o.alpha ?? 1,
});
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
const torus = (g, r, t, c, x = 0, y = 0, z = 0, arc = Math.PI, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 18, arc), M(c));
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
};
const glowC = c => M(c, { emissive: c, ei: 0.55 });

// ---------------- 附属小道具（摆在校门侧前方，占位 1~2 格） ----------------
const PROPS_MAP = {
  ding(g, x, z) {            // 青铜鼎（吉大·鼎新）
    cyl(g, 0.32, 0.26, 0.5, '#6B5B3A', x, 0.55, z, 0, 0, 0, 10);
    for (const [dx, dz] of [[-0.2, -0.14], [0.2, -0.14], [-0.2, 0.14], [0.2, 0.14]])
      cyl(g, 0.05, 0.04, 0.3, '#5A4C30', x + dx, 0.15, z + dz, 0, 0, 0, 6);
    box(g, 0.1, 0.18, 0.05, '#5A4C30', x - 0.2, 0.88, z);
    box(g, 0.1, 0.18, 0.05, '#5A4C30', x + 0.2, 0.88, z);
    cyl(g, 0.26, 0.26, 0.06, '#E8C86A', x, 0.82, z, 0, 0, 0, 10);
  },
  stele(g, x, z) {           // 饮水思源碑（西交）
    box(g, 0.7, 0.16, 0.5, '#B9B2A2', x, 0.08, z);
    box(g, 0.34, 1.1, 0.16, '#F5F1E8', x, 0.7, z);
    box(g, 0.5, 0.1, 0.24, '#9E2B25', x, 1.28, z);
  },
  bell(g, x, z) {            // 傅钟（台大）/ 纪念钟（浙大）
    for (const dx of [-0.32, 0.32]) cyl(g, 0.05, 0.06, 1.1, '#8A6844', x + dx, 0.55, z, 0, 0, 0, 6);
    box(g, 0.84, 0.09, 0.1, '#8A6844', x, 1.14, z);
    cyl(g, 0.2, 0.13, 0.42, '#B08D3A', x, 0.82, z, 0, 0, 0, 10);
    sph(g, 0.06, '#6B5B3A', x, 0.58, z);
  },
  beilou(g, x, z) {          // 北大楼微缩（南大）：灰砖塔楼+尖顶+爬山虎
    box(g, 0.95, 2.3, 0.7, '#8A8378', x, 1.15, z);
    box(g, 0.65, 1.1, 0.5, '#7A746A', x, 2.8, z);
    cone(g, 0.5, 0.8, '#4A5560', x, 3.7, z, 0, Math.PI / 4, 0, 4);
    box(g, 0.98, 0.5, 0.06, '#5FA05F', x, 1.9, z + 0.36);
    box(g, 0.98, 0.3, 0.06, '#6FBF73', x, 1.2, z + 0.36);
  },
  yurt(g, x, z) {            // 蒙古包一对（内蒙古大学）
    for (const dz of [-0.95, 0.95]) {
      cyl(g, 0.55, 0.66, 0.62, '#F5F1E8', x, 0.31, z + dz, 0, 0, 0, 10);
      cone(g, 0.7, 0.4, '#E4DECF', x, 0.82, z + dz, 0, 0, 0, 10);
      box(g, 0.22, 0.3, 0.04, '#8A6844', x, 0.15, z + dz + 0.6);
    }
  },
  twin(g, x, z) {            // 德式双塔红瓦楼（中国海洋大学）
    box(g, 1.7, 1.0, 0.6, '#E4DECF', x, 0.5, z);
    for (const dx of [-0.6, 0.6]) {
      box(g, 0.55, 1.9, 0.55, '#EFE8D8', x + dx, 1.45, z);
      cone(g, 0.48, 0.9, '#B0483A', x + dx, 2.85, z, 0, 0, 0, 8);
    }
  },
  jiuceng(g, x, z) {         // 莫高窟九层楼微缩（敦煌学院）
    let w = 1.7;
    for (let i = 0; i < 4; i++) {
      box(g, w, 0.5, 0.9, '#D9B87C', x, 0.25 + i * 0.55, z);
      box(g, w - 0.1, 0.07, 0.08, '#9E4A3A', x, 0.42 + i * 0.55, z + 0.46);
      w -= 0.34;
    }
    cone(g, 0.5, 0.6, '#8A4A2E', x, 2.55, z, 0, 0, 0, 4);
  },
  boat(g, x, z) {            // 乌篷船（绍兴文理/扬州大学）
    sph(g, 0.7, '#6B5B3A', x, 0.1, z, 1.3, 0.3, 0.45);
    sph(g, 0.42, '#4A4440', x, 0.24, z, 1.1, 0.45, 0.5);
  },
  rock(g, x, z) {            // 太湖石（江南大学）
    sph(g, 0.42, '#8A8A92', x, 0.35, z, 1, 1.15, 0.8);
    sph(g, 0.28, '#9A9AA2', x + 0.3, 0.75, z + 0.1);
    sph(g, 0.2, '#7A7A82', x - 0.28, 0.68, z - 0.08);
  },
  snow(g, x, z) {            // 远处雪山（新疆大学/南科大）
    cone(g, 1.3, 1.7, '#F5F3EE', x - 0.6, 0.85, z - 1.6, 0, 0, 0, 5);
    cone(g, 0.9, 1.2, '#E8E6E0', x + 0.9, 0.6, z - 1.9, 0, 0, 0, 5);
  },
  water(g, x, z) {           // 芙蓉湖水面（厦门大学）
    cyl(g, 1.35, 1.35, 0.05, M('#6FB8E8', { alpha: 0.75 }), x, 0.04, z, 0, 0, 0, 18);
    sph(g, 0.1, '#FFFDF4', x + 0.5, 0.09, z + 0.3, 1.6, 0.4, 1);
  },
  sakura(g, x, z) {          // 樱花两株（武汉大学）
    const t1 = PROPS.tree(true); t1.position.set(x - 0.55, 0, z); t1.scale.setScalar(0.85); g.add(t1);
    const t2 = PROPS.tree(true); t2.position.set(x + 0.55, 0, z - 0.3); t2.scale.setScalar(0.7); g.add(t2);
  },
  palm(g, x, z) {            // 椰树（海南系/珠海）
    const t1 = PROPS.palm(); t1.position.set(x - 0.5, 0, z); g.add(t1);
    const t2 = PROPS.palm(); t2.position.set(x + 0.55, 0, z - 0.35); t2.scale.setScalar(0.8); g.add(t2);
  },
  phoenix(g, x, z) {         // 凤凰木（成功大学）：火红树冠
    cyl(g, 0.09, 0.14, 1.3, '#8A6844', x, 0.65, z, 0, 0, 0, 8);
    sph(g, 0.75, '#E85A3A', x, 1.7, z, 1.15, 0.9, 1);
    sph(g, 0.5, '#FF7F50', x + 0.5, 1.45, z + 0.15);
    sph(g, 0.45, '#FF9A66', x - 0.45, 1.5, z - 0.12);
  },
  longbi(g, x, z) {          // 九龙壁（山西大同大学）
    box(g, 2.6, 1.0, 0.3, '#D9C79C', x, 0.5, z);
    const cols = ['#9E2B25', '#3E6B8C', '#E8C86A', '#5FA05F', '#8A5AA0', '#C27A3A', '#4A9E9E', '#B0483A', '#2E5C8C'];
    cols.forEach((c, i) => box(g, 0.2, 0.55, 0.04, c, x - 1.08 + i * 0.27, 0.52, z + 0.17));
    box(g, 2.8, 0.14, 0.44, '#8A5A38', x, 1.06, z);
  },
  lighthouse(g, x, z) {      // 灯塔（海南热带海洋学院）
    cyl(g, 0.16, 0.28, 1.7, '#FFFDF4', x, 0.85, z, 0, 0, 0, 10);
    cyl(g, 0.28, 0.28, 0.22, '#D95555', x, 1.15, z, 0, 0, 0, 10);
    cyl(g, 0.22, 0.22, 0.22, '#D95555', x, 1.55, z, 0, 0, 0, 10);
    sph(g, 0.16, glowC('#FFE24E'), x, 1.82, z);
    cone(g, 0.2, 0.24, '#D95555', x, 2.02, z, 0, 0, 0, 10);
  },
  brick(g, x, z) {           // 红砖教学楼（中科大）
    box(g, 1.5, 1.5, 0.6, '#9E4A3A', x, 0.75, z);
    box(g, 1.7, 0.12, 0.75, '#7A3B2E', x, 1.55, z);
    for (let i = -1; i <= 1; i++) box(g, 0.16, 0.34, 0.05, '#F5F1E8', x + i * 0.45, 0.8, z + 0.31);
  },
};

// ---------------- 招牌门模板 ----------------
// 返回 [beamY, beamW, fz]：匾额挂点高度/宽度/正面 z
const TPL = {
  // 清华二校门：白古典拱门（一大两小门洞 + 弧顶 + 顶球）
  erxiao(g, rnd, s) {
    const c1 = s.c1, stone = s.c2;
    for (const sx of [-1.55, 1.55]) {
      box(g, 0.6, 2.6, 0.6, c1, sx, 1.3, 0);
      box(g, 0.78, 0.22, 0.78, stone, sx, 2.7, 0);
    }
    torus(g, 1.55, 0.3, c1, 0, 2.62, 0);
    box(g, 2.6, 0.55, 0.55, c1, 0, 4.05, 0);          // 拱上方弧心墙
    box(g, 3.3, 0.2, 0.66, stone, 0, 4.42, 0);        // 顶檐
    for (const [dx, dy] of [[-1.4, 4.6], [0, 4.72], [1.4, 4.6]]) sph(g, 0.13, c1, dx, dy, 0);
    for (const sx of [-2.55, 2.55]) {                  // 两侧矮翼墙 + 小拱
      box(g, 0.9, 1.5, 0.5, c1, sx, 0.75, 0);
      torus(g, 0.42, 0.16, c1, sx, 1.45, 0.02);
      sph(g, 0.1, stone, sx, 1.58, 0);
    }
    box(g, 3.4, 0.08, 1.6, '#B9B2A2', 0, 0.04, 0.3);   // 门内石路
    return [3.62, 2.9, 0.29];
  },
  // 北大西门：朱红牌楼（四柱 + 绿斗拱 + 灰庑殿顶）
  pku(g, rnd, s) {
    for (const sx of [-2.1, -0.95, 0.95, 2.1]) {
      cyl(g, 0.24, 0.28, 3.1, s.c1, sx, 1.55, 0, 0, 0, 0, 8);
      box(g, 0.66, 0.18, 0.66, s.c2, sx, 3.2, 0);       // 斗拱托
      box(g, 0.5, 0.16, 0.6, s.c3, sx, 2.62, 0.02);     // 红枋金饰
    }
    box(g, 5.4, 0.2, 0.7, s.c2, 0, 3.42, 0);
    box(g, 5.8, 0.24, 1.1, '#5B7280', 0, 3.66, 0);      // 灰顶
    box(g, 4.6, 0.26, 0.9, '#6B8090', 0, 3.94, -0.04);  // 顶二层
    box(g, 2.2, 0.14, 0.5, '#5B7280', 0, 4.16, -0.06);  // 正脊
    box(g, 3.2, 0.08, 1.4, '#B9B2A2', 0, 0.04, 0.2);
    return [2.9, 3.2, 0.32];
  },
  // 石牌坊：四柱三层（武大/中山/曲阜）
  pailou(g, rnd, s) {
    const px = 2.05;
    for (const sx of [-px, -px * 0.5, px * 0.5, px]) {
      box(g, 0.44, 3.2, 0.44, s.c1, sx, 1.6, 0);
      cyl(g, 0.36, 0.42, 0.28, stone2(s.c1), sx, 0.14, 0, 0, 0, 0, 8);  // 柱础鼓
    }
    box(g, 5.2, 0.24, 0.5, s.c2, 0, 2.55, 0);           // 下枋
    box(g, 5.0, 0.24, 0.5, s.c1, 0, 3.05, 0);           // 中枋
    box(g, 5.4, 0.26, 0.6, s.c2, 0, 3.5, 0);            // 上枋
    box(g, 5.8, 0.2, 0.8, s.c3, 0, 3.74, -0.02);        // 顶檐
    box(g, 4.4, 0.16, 0.6, s.c3, 0, 3.98, -0.04);
    for (const sx of [-px, px]) sph(g, 0.1, s.c3, sx, 4.14, -0.04);
    return [3.05, 4.4, 0.26];
  },
  // 苏式主楼门（哈工大/大连理工）：中央塔楼 + 阶梯收顶 + 尖塔
  soviet(g, rnd, s) {
    for (const sx of [-2.2, 2.2]) {
      box(g, 0.9, 2.7, 0.8, s.c1, sx, 1.35, 0);
      box(g, 1.1, 0.24, 1.0, s.c2, sx, 2.78, 0);
      box(g, 0.2, 2.2, 0.06, s.c2, sx - 0.24, 1.3, 0.42);   // 壁柱条纹
      box(g, 0.2, 2.2, 0.06, s.c2, sx + 0.24, 1.3, 0.42);
    }
    box(g, 3.3, 2.9, 0.9, s.c1, 0, 1.45, -0.5);            // 中央主楼体
    box(g, 2.5, 1.1, 0.8, s.c1, 0, 3.4, -0.5);             // 二层收进
    box(g, 1.6, 0.9, 0.7, s.c2, 0, 4.35, -0.5);            // 三层
    cone(g, 0.34, 1.1, s.c2, 0, 5.3, -0.5, 0, 0, 0, 4);
    sph(g, 0.12, s.c3, 0, 5.95, -0.5);                     // 塔尖红星
    for (let i = -1; i <= 1; i++) box(g, 0.18, 0.6, 0.05, '#F5F1E8', i * 0.9, 0.9, 0.42);
    return [2.6, 3.0, 0.44];
  },
  // 民国砖拱门（南大/重大/东大/河大/台大/成大/西交/云大）：厚砖柱 + 半圆拱
  minguo(g, rnd, s) {
    const px = 1.85;
    for (const sx of [-px, px]) {
      box(g, 0.78, 3.1, 0.7, s.c1, sx, 1.55, 0);
      box(g, 0.94, 0.2, 0.84, s.c2, sx, 3.16, 0);
    }
    torus(g, px - 0.39, 0.28, s.c1, 0, 3.1, 0);
    box(g, px * 2 - 0.8, 0.62, 0.6, s.c1, 0, 4.15, 0);     // 拱上砖墙
    box(g, px * 2 - 0.4, 0.18, 0.72, s.c2, 0, 4.55, 0);    // 压顶
    box(g, 1.2, 0.3, 0.66, s.c3, 0, 4.3, 0.03);            // 匾额底衬
    for (const sx of [-px - 0.75, px + 0.75]) {            // 侧门柱灯
      box(g, 0.3, 0.9, 0.3, s.c1, sx, 0.45, 0.2);
      sph(g, 0.12, glowC('#FFE2A8'), sx, 0.98, 0.2);
    }
    box(g, 3.6, 0.08, 1.4, '#B9B2A2', 0, 0.04, 0.3);
    return [4.32, 2.9, 0.34];
  },
  // 嘉庚燕尾脊门（厦大/华侨大学）：石基 + 红砖柱 + 燕尾翘脊
  jiageng(g, rnd, s) {
    const px = 1.9;
    box(g, px * 2 + 1.6, 0.5, 0.9, s.c2, 0, 0.25, 0);      // 石砌基座
    for (const sx of [-px, px]) {
      box(g, 0.6, 2.5, 0.6, s.c1, sx, 1.75, 0);
      box(g, 0.66, 0.3, 0.66, '#F5F1E8', sx, 2.2, 0);      // 砖柱白石带
      box(g, 0.66, 0.3, 0.66, '#F5F1E8', sx, 1.4, 0);
    }
    box(g, px * 2 + 0.9, 0.5, 0.7, s.c2, 0, 3.2, 0);       // 白墙檐带
    const roof = (dx, dir) => {                             // 坡屋面 + 燕尾翘角
      box(g, 2.5, 0.16, 1.1, s.c2, dx, 3.72, -0.05, 0, 0, dir * 0.32);
      cone(g, 0.14, 0.55, s.c2, dx + dir * 1.35, 4.05, -0.05, 0, 0, dir * -0.5, 4);
    };
    roof(-1.55, -1); roof(1.55, 1);
    box(g, 1.6, 0.2, 0.9, s.c1, 0, 3.9, -0.05);            // 中脊
    box(g, 3.2, 0.08, 1.4, '#B9B2A2', 0, 0.04, 0.3);
    return [3.28, 3.4, 0.36];
  },
  // 中式屋顶门（复旦老校门）：白墙红柱 + 灰瓦双坡大屋顶
  roof(g, rnd, s) {
    const px = 1.95;
    box(g, px * 2 + 1.3, 0.4, 0.8, s.c1, 0, 0.2, 0);
    for (const sx of [-px, px]) cyl(g, 0.24, 0.28, 2.7, s.c3, sx, 1.75, 0, 0, 0, 0, 8);
    box(g, px * 2 - 0.4, 1.0, 0.3, s.c1, 0, 2.35, -0.1);   // 门楣墙
    box(g, px * 2 + 0.6, 0.2, 0.9, '#6B7280', 0, 3.2, 0);  // 檐口
    box(g, 3.6, 0.2, 1.2, s.c2, -1.9, 3.55, -0.1, 0, 0, 0.34);  // 左坡
    box(g, 3.6, 0.2, 1.2, s.c2, 1.9, 3.55, -0.1, 0, 0, -0.34);  // 右坡
    box(g, 1.0, 0.22, 0.7, '#5B6470', 0, 4.18, -0.1);      // 正脊
    for (const sx of [-3.35, 3.35]) box(g, 0.5, 0.14, 0.6, s.c2, sx, 3.36, -0.1, 0, 0, sx > 0 ? -0.5 : 0.5); // 戗角
    return [2.62, 3.2, 0.18];
  },
  // 园林月亮门（苏大/扬大）：白墙 + 圆洞门 + 花窗 + 黛瓦墙帽
  garden(g, rnd, s) {
    const R = 1.42;
    for (const sx of [-R - 1.15, R + 1.15]) {
      box(g, 2.3, 2.55, 0.26, s.c1, sx, 1.275, 0);
      box(g, 2.5, 0.16, 0.4, s.c2, sx, 2.62, 0);           // 黛瓦墙帽
    }
    torus(g, R, 0.24, s.c1, 0, R + 0.1, 0);                // 月洞门环
    box(g, R * 2 + 0.5, 0.8, 0.26, s.c1, 0, 3.3, 0);       // 环上墙
    box(g, R * 2 + 0.9, 0.16, 0.4, s.c2, 0, 3.78, 0);
    const wx = -R - 1.15;                                   // 花窗（左右墙各一）
    for (const dx of [wx - 0.55, wx + 0.55, R + 1.15 - 0.55]) {
      box(g, 0.5, 0.04, 0.06, s.c2, dx, 1.7, 0.14);
      box(g, 0.04, 0.5, 0.06, s.c2, dx, 1.7, 0.14);
      box(g, 0.66, 0.66, 0.05, s.c3, dx, 1.7, 0.11);
    }
    box(g, 4.4, 0.08, 1.2, '#C9C2B2', 0, 0.04, 0.1);
    return [3.55, 2.3, 0.15];
  },
  // 藏式门（西藏大学）：梯形白墙 + 红黑窗帏 + 金顶
  tibetan(g, rnd, s) {
    const px = 1.7;
    for (const sx of [-px, px]) {
      cyl(g, 0.5, 0.78, 2.9, s.c1, sx, 1.45, 0, 0, Math.PI / 4, 0, 4);   // 收分梯形墙
      box(g, 0.62, 0.8, 0.1, s.c2, sx, 2.2, 0.42);                       // 红窗帏
      box(g, 0.4, 0.55, 0.08, '#2A2A2A', sx, 2.2, 0.47);                 // 黑框窗
    }
    box(g, px * 2 + 0.6, 0.5, 0.5, s.c1, 0, 3.0, 0);
    box(g, px * 2 + 1.0, 0.22, 0.9, s.c2, 0, 3.32, 0);     // 红饰带
    box(g, px * 2 + 1.4, 0.16, 1.1, s.c3, 0, 3.55, -0.02); // 金顶
    box(g, px * 2, 0.18, 0.7, s.c3, 0, 3.78, -0.06);
    box(g, 3.0, 0.08, 1.2, '#B9A28A', 0, 0.04, 0.3);
    return [3.1, 2.8, 0.5];
  },
  // 敦煌门（敦煌学院）：沙色拱门 + 石宝瓶柱
  dunhuang(g, rnd, s) {
    const px = 1.8;
    for (const sx of [-px, px]) {
      cyl(g, 0.34, 0.44, 2.9, s.c1, sx, 1.45, 0, 0, 0, 0, 10);
      sph(g, 0.2, s.c2, sx, 3.02, 0);                      // 宝瓶柱头
    }
    torus(g, px - 0.36, 0.26, s.c2, 0, 2.95, 0);
    box(g, px * 2 - 0.4, 0.7, 0.5, s.c1, 0, 3.9, 0);
    box(g, px * 2, 0.18, 0.66, s.c3, 0, 4.32, 0);
    for (let i = -2; i <= 2; i++) sph(g, 0.09, s.c3, i * 0.75, 4.5, 0);   // 檐上金珠
    return [4.1, 3.0, 0.28];
  },
  // 现代门楼（多数 985 的通用款）：粗柱 + 宽梁，三种轮廓随机
  modern(g, rnd, s) {
    const px = 1.95, h = 3.3 + rnd() * 0.3;
    const v = Math.floor(rnd() * 3);
    for (const sx of [-px, px]) {
      box(g, 0.74, h, 0.64, s.c1, sx, h / 2, 0);
      box(g, 0.9, 0.22, 0.8, s.c3, sx, h + 0.08, 0);
      box(g, 0.78, 0.3, 0.68, s.c2, sx, h - 0.65, 0);
    }
    box(g, px * 2 + 1.2, 0.5, 0.6, s.c1, 0, h + 0.42, 0);
    box(g, px * 2 + 0.6, 0.3, 0.66, s.c2, 0, h + 0.1, 0.02);
    if (v === 1) {                                          // 中央门楼块
      box(g, 1.9, 1.0, 0.7, s.c1, 0, h + 1.2, 0);
      box(g, 2.2, 0.2, 0.8, s.c3, 0, h + 1.78, 0);
    } else if (v === 2) {                                   // 双梁
      box(g, px * 2 + 0.8, 0.3, 0.55, s.c2, 0, h + 0.85, 0);
      box(g, px * 2, 0.18, 0.5, s.c3, 0, h + 1.12, 0);
    } else {
      for (const dx of [-1.1, 1.1]) box(g, 0.5, 0.24, 0.6, s.c3, dx, h + 0.82, 0); // 梁上装饰块
    }
    return [h + 0.42, px * 2 + 1.1, 0.31];
  },
};
const stone2 = c => '#B9B2A2';

// ---------------- 风格族门型 ----------------
// 返回 [beamY, beamW, fz]
const FAMILY = {
  classic(g, rnd, h, px) {          // 综合：古典柱式（北大风）
    for (const sx of [-px, px]) {
      cyl(g, 0.3, 0.36, h, '#F2EEE6', sx, h / 2, 0, 0, 0, 0, 10);
      box(g, 0.85, 0.22, 0.85, '#E4DECF', sx, h + 0.05, 0);
    }
    for (const sx of [-px + 0.7, px - 0.7]) cyl(g, 0.16, 0.2, h - 0.4, '#F2EEE6', sx, (h - 0.4) / 2, 0, 0, 0, 0, 8);
    box(g, px * 2 + 1.1, 0.32, 0.6, '#F5F1E8', 0, h + 0.4, 0);
    box(g, px * 2 + 0.9, 0.14, 0.66, '#C9BFA9', 0, h + 0.2, 0);
    box(g, px * 2 + 1.1, 0.2, 0.5, '#E4DECF', 0, h + 0.72, 0);
    box(g, 1.9, 0.08, 1.5, '#B9B2A2', 0, 0.04, 0.2);
    for (const [sx, sz] of [[-px - 0.8, 0.7], [px + 0.8, 0.7]]) {
      sph(g, 0.3, M('#5FA05F'), sx, 0.5, sz);
      box(g, 0.14, 0.4, 0.14, '#8A6844', sx, 0.2, sz);
    }
    return [h + 0.4, px * 2 + 1.0, 0.31];
  },
  aero(g, rnd, h, px) {             // 航空航天：火箭移出正中 + 发射架喷焰
    const red = '#C24A50';
    for (const sx of [-px, px]) {
      box(g, 0.6, h, 0.6, '#F5F1E8', sx, h / 2, 0);
      box(g, 0.72, 0.3, 0.72, red, sx, h + 0.1, 0);
    }
    box(g, px * 2 + 1.1, 0.42, 0.55, red, 0, h + 0.45, 0);
    box(g, px * 2 + 0.5, 0.2, 0.6, '#FFFDF4', 0, h + 0.17, 0);
    box(g, 0.9, 0.26, 0.6, red, -px + 0.9, h + 0.81, 0);
    box(g, 0.9, 0.26, 0.6, red, px - 0.9, h + 0.81, 0);
    // 火箭：细长，立在门内侧，不挡匾额
    const rx = px - 1.1, rz = 0.75;
    box(g, 1.0, 0.14, 1.0, '#8A8378', rx, 0.07, rz);              // 发射台
    cyl(g, 0.2, 0.24, 2.0, '#F5F1E8', rx, 1.14, rz, 0, 0, 0, 10); // 箭体
    cone(g, 0.2, 0.55, red, rx, 2.42, rz, 0, 0, 0, 10);
    cyl(g, 0.26, 0.26, 0.1, red, rx, 0.28, rz, 0, 0, 0, 10);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * 2 * i / 3 + 0.5;
      box(g, 0.05, 0.5, 0.3, red, rx + Math.cos(a) * 0.22, 0.32, rz + Math.sin(a) * 0.22, 0, -a, 0);
    }
    cone(g, 0.14, 0.4, glowC('#FF9A3A'), rx, -0.08, rz, Math.PI, 0, 0, 8);  // 喷焰
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  chip(g, rnd, h, px) {             // 电子科技：芯片柱 + 电路梁 + 悬浮光球
    const blue = '#4E7CA8', glow = () => glowC('#7EC4F2');
    for (const sx of [-px, px]) {
      box(g, 0.62, h, 0.62, '#6E8CA8', sx, h / 2, 0);
      box(g, 0.3, 0.3, 0.06, glow(), sx, h * 0.6, 0.33);
      sph(g, 0.3, glow(), sx, h + 0.32, 0);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, blue, 0, h + 0.45, 0);
    for (let i = -2; i <= 2; i++) box(g, 0.3, 0.18, 0.6, '#BFE3FF', i * 0.85, h + 0.45, 0.02);
    box(g, px * 2 + 0.7, 0.16, 0.5, '#3D6288', 0, h + 0.73, 0);
    sph(g, 0.34, glow(), 0, h - 0.7, 0);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  rail(g, rnd, h, px) {             // 铁道交通：蒸汽机车 + 铁轨门槛
    for (const sx of [-px, px]) {
      box(g, 0.62, h, 0.62, '#7A5C48', sx, h / 2, 0);
      box(g, 0.78, 0.26, 0.78, '#4A4440', sx, h + 0.08, 0);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, '#4A4440', 0, h + 0.45, 0);
    for (let i = -2; i <= 2; i++) sph(g, 0.08, '#E8C86A', i * 0.85, h + 0.45, 0.29);
    // 铁轨穿门
    for (const rz of [0.62, 0.88]) box(g, px * 2 + 0.4, 0.05, 0.09, '#5A5A62', 0, 0.06, rz);
    for (let i = -3; i <= 3; i++) box(g, 0.5, 0.04, 0.5, '#6B5B3A', i * 0.62, 0.03, 0.75);
    // 蒸汽机车（门内侧）
    const lx = px - 1.25;
    cyl(g, 0.3, 0.3, 1.0, '#3E6B4F', lx, 0.72, 0.75, 0, 0, Math.PI / 2, 10);   // 锅炉
    box(g, 0.56, 0.62, 0.66, '#2E5C42', lx - 0.72, 0.92, 0.75);                 // 司机室
    cyl(g, 0.08, 0.1, 0.4, '#4A4440', lx + 0.32, 1.2, 0.75, 0, 0, 0, 8);        // 烟囱
    sph(g, 0.12, '#E8C86A', lx - 0.05, 1.02, 0.75);
    for (let i = 0; i < 3; i++) cyl(g, 0.16, 0.16, 0.08, '#2A2A2A', lx + 0.18 - i * 0.32, 0.16, 0.75, Math.PI / 2, 0, 0, 10);
    cone(g, 0.3, 0.3, '#D95555', lx - 1.05, 0.15, 0.75, 0, 0, -Math.PI / 2, 4); // 排障器
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  post(g, rnd, h, px) {             // 邮电：信号塔 + 电波环
    for (const sx of [-px, px]) {
      box(g, 0.6, h, 0.6, '#5B8C6B', sx, h / 2, 0);
      box(g, 0.74, 0.24, 0.74, '#3E6B4F', sx, h + 0.08, 0);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, '#3E6B4F', 0, h + 0.45, 0);
    for (let i = -2; i <= 2; i++) box(g, 0.26, 0.2, 0.62, '#BFE3D0', i * 0.85, h + 0.45, 0.02);
    const tx = px - 1.15;                                    // 信号塔
    cyl(g, 0.05, 0.1, 3.6, '#8A8378', tx, 1.8, 0.75, 0, 0, 0, 6);
    cyl(g, 0.16, 0.16, 0.1, glowC('#4ED0C8'), tx, 3.7, 0.75, 0, 0, 0, 8);
    for (let i = 0; i < 3; i++)
      torus(g, 0.3 + i * 0.28, 0.045, glowC('#4ED0C8'), tx, 3.7, 0.75, Math.PI, 0, 0, 0);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  ocean(g, rnd, h, px) {            // 海洋：右柱即灯塔 + 鲸尾拍浪
    cyl(g, 0.34, 0.42, h, '#FFFDF4', px, h / 2, 0, 0, 0, 0, 10);             // 灯塔柱
    cyl(g, 0.44, 0.44, 0.3, '#D95555', px, h * 0.42, 0, 0, 0, 0, 10);
    cyl(g, 0.4, 0.4, 0.3, '#D95555', px, h * 0.72, 0, 0, 0, 0, 10);
    sph(g, 0.3, glowC('#FFE24E'), px, h + 0.2, 0);
    cone(g, 0.36, 0.35, '#D95555', px, h + 0.55, 0, 0, 0, 0, 10);
    box(g, 0.6, h, 0.6, '#E4DECF', -px, h / 2, 0);
    box(g, 0.74, 0.26, 0.74, '#1E5F8C', -px, h + 0.08, 0);
    box(g, px * 2 + 1.1, 0.4, 0.55, '#1E5F8C', 0, h + 0.45, 0);
    box(g, px * 2 + 0.4, 0.18, 0.6, '#BFE3F0', 0, h + 0.16, 0);
    const wx = -px + 1.3;                                    // 鲸尾
    torus(g, 0.55, 0.14, M('#6FB8E8', { alpha: 0.8 }), wx, 0.12, 0.85, Math.PI, Math.PI / 2, 0, 0);
    box(g, 0.12, 0.75, 0.3, '#3E5C8C', wx, 0.5, 0.85, 0, 0, 0.25);
    box(g, 0.5, 0.1, 0.34, '#3E5C8C', wx - 0.24, 0.92, 0.85, 0, 0, -0.6);
    box(g, 0.5, 0.1, 0.34, '#3E5C8C', wx + 0.26, 0.92, 0.85, 0, 0, 0.6);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  agri(g, rnd, h, px) {             // 农业：麦穗梁 + 小风车
    const wood = '#8A6844', gold = '#E8C86A';
    for (const sx of [-px, px]) {
      cyl(g, 0.24, 0.3, h, wood, sx, h / 2, 0, 0, 0, 0, 8);
      sph(g, 0.5, M('#5FA05F'), sx, h + 0.3, 0, 1, 0.7, 1);
    }
    box(g, px * 2 + 1.1, 0.36, 0.5, wood, 0, h + 0.42, 0);
    for (let i = -2; i <= 2; i++) {                          // 麦穗
      cyl(g, 0.03, 0.03, 0.5, gold, i * 0.85, h + 0.82, 0, 0, 0, 0, 5);
      sph(g, 0.09, gold, i * 0.85, h + 1.05, 0, 1, 1.6, 1);
    }
    const wx = px - 1.15;                                    // 风车
    cyl(g, 0.06, 0.09, 1.5, wood, wx, 0.75, 0.75, 0, 0, 0, 6);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 * i;
      box(g, 0.5, 0.12, 0.02, '#F5F1E8', wx + Math.cos(a) * 0.28, 1.62 + Math.sin(a) * 0.28, 0.78, 0, 0, a);
    }
    sph(g, 0.08, '#8A6844', wx, 1.62, 0.78);
    return [h + 0.42, px * 2 + 1.0, 0.26];
  },
  forest(g, rnd, h, px) {           // 林业：双树冠柱拱
    const wood = '#8A6B4A';
    for (const sx of [-px, px]) {
      cyl(g, 0.2, 0.26, h, wood, sx, h / 2, 0, 0, 0, 0, 8);
      sph(g, 0.62, M('#5FA05F'), sx, h + 0.35, 0);
      sph(g, 0.42, M('#7CC96F'), sx + 0.3, h + 0.6, 0.15);
    }
    box(g, px * 2 + 1.1, 0.34, 0.5, wood, 0, h + 0.4, 0);
    box(g, px * 2 + 0.6, 0.14, 0.56, '#5FA05F', 0, h + 0.18, 0);
    for (const [sx, sz] of [[-px + 0.6, 0.7], [px - 0.6, 0.7]]) {   // 小蘑菇
      cyl(g, 0.05, 0.06, 0.16, '#F5F1E8', sx, 0.08, sz, 0, 0, 0, 6);
      sph(g, 0.1, '#D95555', sx, 0.19, sz, 1, 0.6, 1);
    }
    return [h + 0.4, px * 2 + 1.0, 0.26];
  },
  tcm(g, rnd, h, px) {              // 中医药：药葫芦 + 药圃畦
    const wood = '#7A4A38';
    for (const sx of [-px, px]) {
      cyl(g, 0.22, 0.28, h, wood, sx, h / 2, 0, 0, 0, 0, 8);
      sph(g, 0.34, M('#B08D3A'), sx, h + 0.28, 0, 1, 0.8, 1);
    }
    box(g, px * 2 + 1.1, 0.34, 0.5, wood, 0, h + 0.42, 0);
    box(g, px * 2 + 0.6, 0.12, 0.56, '#E8C86A', 0, h + 0.2, 0);
    sph(g, 0.3, M('#C98A3A'), 0, h - 0.35, 0);               // 悬挂药葫芦
    sph(g, 0.2, M('#C98A3A'), 0, h - 0.02, 0, 1, 0.8, 1);
    cyl(g, 0.04, 0.04, 0.3, '#8A6844', 0, h + 0.05, 0, 0, 0, 0, 5);
    for (const [dx, dz] of [[-px + 0.7, 0.8], [px - 0.7, 0.8]]) {   // 药圃
      box(g, 0.9, 0.16, 0.4, '#8A6844', dx, 0.08, dz);
      for (let i = -1; i <= 1; i++) sph(g, 0.1, M('#6FBF73'), dx + i * 0.28, 0.22, dz);
    }
    return [h + 0.42, px * 2 + 1.0, 0.26];
  },
  medic(g, rnd, h, px) {            // 医科：红十字白门
    for (const sx of [-px, px]) {
      box(g, 0.6, h, 0.6, '#FAF7F0', sx, h / 2, 0);
      box(g, 0.72, 0.2, 0.72, '#D95555', sx, h + 0.08, 0);
    }
    box(g, px * 2 + 1.1, 0.42, 0.55, '#FAF7F0', 0, h + 0.45, 0);
    box(g, 0.62, 0.18, 0.6, '#D95555', 0, h + 0.45, 0.03);
    box(g, 0.18, 0.62, 0.6, '#D95555', 0, h + 0.45, 0.03);
    box(g, px * 2 + 0.6, 0.14, 0.56, '#E8E2D4', 0, h + 0.2, 0);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  petro(g, rnd, h, px) {            // 石油矿业：井架 + 岩层底座
    const steel = '#5A6270';
    for (const sx of [-px, px]) {
      box(g, 0.5, h, 0.5, '#6B7280', sx, h / 2, 0);
      box(g, 0.4, 0.4, 0.05, '#E8C86A', sx, h * 0.55, 0.27);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, steel, 0, h + 0.45, 0);
    box(g, px * 2 + 0.5, 0.14, 0.58, '#E8C86A', 0, h + 0.18, 0);
    const dx = px - 1.2;                                     // 井架
    for (const dz of [-0.22, 0.22]) {
      cyl(g, 0.035, 0.055, 2.6, steel, dx - 0.3, 1.3, 0.75 + dz, 0, 0, 0.14, 5);
      cyl(g, 0.035, 0.055, 2.6, steel, dx + 0.3, 1.3, 0.75 + dz, 0, 0, -0.14, 5);
    }
    box(g, 0.5, 0.3, 0.4, '#4A5260', dx, 2.7, 0.75);
    sph(g, 0.14, '#2A2A2A', dx, 2.98, 0.75);
    box(g, 0.8, 0.2, 0.5, '#8A6844', dx, 0.1, 0.75);         // 岩层
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  hydro(g, rnd, h, px) {            // 水利：坝顶梁 + 水轮
    for (const sx of [-px, px]) {
      box(g, 0.66, h, 0.66, '#B9BEB4', sx, h / 2, 0);
      box(g, 0.8, 0.22, 0.8, '#8A9188', sx, h + 0.08, 0);
    }
    box(g, px * 2 + 1.1, 0.46, 0.6, '#9AA19A', 0, h + 0.45, 0);   // 坝顶
    box(g, px * 2 + 0.5, 0.16, 0.64, '#4E9EE8', 0, h + 0.16, 0.02);
    const wx = -px + 1.2;                                    // 水轮
    torus(g, 0.6, 0.11, '#8A6844', wx, 0.62, 0.85, Math.PI * 2, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 * i;
      box(g, 0.1, 1.1, 0.08, '#8A6844', wx, 0.62, 0.85, 0, 0, a);
    }
    box(g, 1.6, 0.24, 0.6, M('#6FB8E8', { alpha: 0.75 }), wx, 0.12, 0.85);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  power(g, rnd, h, px) {            // 电力：输电塔柱 + 闪电
    const steel = '#6B7280';
    for (const sx of [-px, px]) {
      box(g, 0.16, h, 0.16, steel, sx - 0.22, h / 2, 0, 0, 0, 0.07);
      box(g, 0.16, h, 0.16, steel, sx + 0.22, h / 2, 0, 0, 0, -0.07);
      box(g, 1.0, 0.12, 0.3, steel, sx, h - 0.25, 0);        // 横担
      for (const dx of [-0.4, 0.4]) sph(g, 0.07, '#BFE3FF', sx + dx, h - 0.4, 0);
    }
    box(g, px * 2 + 1.1, 0.36, 0.5, '#4E5A66', 0, h + 0.42, 0);
    box(g, 0.5, 0.16, 0.06, glowC('#FFE24E'), -0.5, h + 0.42, 0.28, 0, 0, 0.5);  // 闪电折线
    box(g, 0.5, 0.16, 0.06, glowC('#FFE24E'), 0.0, h + 0.42, 0.28, 0, 0, -0.5);
    box(g, 0.36, 0.14, 0.06, glowC('#FFE24E'), 0.38, h + 0.42, 0.28, 0, 0, 0.5);
    return [h + 0.42, px * 2 + 1.0, 0.29];
  },
  normal(g, rnd, h, px) {           // 师范：书卷柱 + 烛台
    for (const sx of [-px, px]) {
      cyl(g, 0.26, 0.3, h - 0.3, '#F2EEE6', sx, (h - 0.3) / 2, 0, 0, 0, 0, 10);
      sph(g, 0.3, M('#E4DECF'), sx, h - 0.26, 0, 1, 0.5, 1);   // 卷轴收口
      sph(g, 0.3, M('#E4DECF'), sx, 0.12, 0, 1, 0.4, 1);
    }
    box(g, px * 2 + 1.1, 0.32, 0.5, '#F5F1E8', 0, h + 0.4, 0); // 展开书卷
    for (const sx of [-px * 0.4, px * 0.4]) cyl(g, 0.14, 0.14, 0.36, '#E4DECF', sx, h + 0.4, 0, Math.PI / 2, 0, 0, 8);
    cyl(g, 0.07, 0.09, 0.5, '#F5F1E8', -px, h + 0.55, 0, 0, 0, 0, 6);  // 烛台
    cone(g, 0.08, 0.24, glowC('#FFC94E'), -px, h + 0.92, 0, 0, 0, 0, 6);
    box(g, 1.8, 0.06, 1.1, '#B9B2A2', 0, 0.03, 0.2);
    return [h + 0.4, px * 2 + 1.0, 0.26];
  },
  finance(g, rnd, h, px) {          // 财经：金桐柱 + 铜钱梁
    const green = '#2E5C46', gold = '#E8C86A';
    for (const sx of [-px, px]) {
      box(g, 0.58, h, 0.58, green, sx, h / 2, 0);
      box(g, 0.72, 0.16, 0.72, gold, sx, h + 0.06, 0);
      box(g, 0.72, 0.16, 0.72, gold, sx, 0.12, 0);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, green, 0, h + 0.45, 0);
    for (let i = -1; i <= 1; i++) {                          // 铜钱
      cyl(g, 0.2, 0.2, 0.06, gold, i * 0.85, h + 0.45, 0.3, Math.PI / 2, 0, 0, 12);
      box(g, 0.1, 0.1, 0.08, green, i * 0.85, h + 0.45, 0.3);
    }
    sph(g, 0.16, M(gold), 0, h + 0.78, 0, 1.4, 0.7, 1);      // 金元宝
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  law(g, rnd, h, px) {              // 政法：天平
    for (const sx of [-px, px]) {
      box(g, 0.56, h, 0.56, '#E4DECF', sx, h / 2, 0);
      box(g, 0.7, 0.2, 0.7, '#8A8378', sx, h + 0.07, 0);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, '#D8D2C4', 0, h + 0.45, 0);
    const gold = '#C9A43A';
    cyl(g, 0.05, 0.05, 0.9, gold, 0, h - 0.2, 0.1, 0, 0, 0, 6);
    box(g, 1.5, 0.07, 0.07, gold, 0, h + 0.22, 0.1);
    for (const sx of [-0.72, 0.72]) {
      box(g, 0.03, 0.34, 0.03, gold, sx, h + 0.05, 0.1);
      cyl(g, 0.2, 0.2, 0.04, gold, sx, h - 0.12, 0.1, 0, 0, 0, 12);
    }
    sph(g, 0.1, gold, 0, h + 0.34, 0.1);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  lang(g, rnd, h, px) {             // 外语：地球门
    for (const sx of [-px, px]) {
      cyl(g, 0.28, 0.34, h, '#F2EEE6', sx, h / 2, 0, 0, 0, 0, 10);
      box(g, 0.8, 0.2, 0.8, '#C9BFA9', sx, h + 0.06, 0);
    }
    box(g, px * 2 + 1.1, 0.34, 0.5, '#E4DECF', 0, h + 0.4, 0);
    sph(g, 0.5, M('#4E9EE8'), 0, h - 0.55, 0.15);            // 地球
    torus(g, 0.62, 0.045, '#E8C86A', 0, h - 0.55, 0.15, Math.PI * 2, 0.45, 0.2, 0);
    torus(g, 0.56, 0.045, '#C9C2B2', 0, h - 0.55, 0.15, Math.PI * 2, 0, 0, 1.57);
    sph(g, 0.16, M('#5FA05F'), 0.18, h - 0.4, 0.45, 1.3, 0.7, 1);
    sph(g, 0.13, M('#5FA05F'), -0.22, h - 0.72, 0.4, 1.2, 0.6, 1);
    return [h + 0.4, px * 2 + 1.0, 0.26];
  },
  folk(g, rnd, h, px) {             // 民族：鼓楼
    for (const sx of [-px, px]) {
      cyl(g, 0.26, 0.32, h, '#B0483A', sx, h / 2, 0, 0, 0, 0, 8);
      cyl(g, 0.3, 0.3, 0.24, '#F5F1E8', sx, h - 0.6, 0, 0, 0, 0, 8);
      sph(g, 0.3, M('#E8C86A'), sx, h + 0.28, 0, 1, 0.7, 1);
    }
    box(g, px * 2 + 1.1, 0.34, 0.5, '#8A4A38', 0, h + 0.4, 0);
    cyl(g, 0.5, 0.6, 0.7, '#B0483A', 0, 0.35, 0.85, 0, 0, 0, 8);   // 鼓
    cyl(g, 0.56, 0.56, 0.08, '#E8C86A', 0, 0.75, 0.85, Math.PI / 2, 0, 0, 8);
    cone(g, 0.62, 0.5, '#5B3A2E', 0, h + 0.75, 0.5, 0, 0, 0, 8);   // 鼓楼顶
    cone(g, 0.4, 0.4, '#5B3A2E', 0, h + 1.15, 0.5, 0, 0, 0, 8);
    sph(g, 0.09, '#E8C86A', 0, h + 1.42, 0.5);
    return [h + 0.4, px * 2 + 1.0, 0.26];
  },
  art(g, rnd, h, px) {              // 艺术：琴键梁 + 调色盘
    for (const sx of [-px, px]) {
      box(g, 0.56, h, 0.56, '#9A7FB8', sx, h / 2, 0);
      sph(g, 0.28, M('#E8C86A'), sx, h + 0.26, 0, 1, 0.7, 1);
    }
    box(g, px * 2 + 1.1, 0.42, 0.55, '#F5F1E8', 0, h + 0.45, 0);
    for (let i = -3; i <= 3; i++) box(g, 0.24, 0.02, 0.34, '#E4DECF', i * 0.26, h + 0.66, 0.1);   // 琴键
    for (const i of [-3, -2, 0, 2, 3]) box(g, 0.15, 0.03, 0.2, '#2A2A2A', i * 0.26, h + 0.67, 0.22);
    const pxp = -px - 0.75;                                  // 调色盘
    sph(g, 0.4, M('#F5F1E8'), pxp, 0.5, 0.6, 1, 1, 0.25);
    sph(g, 0.3, M('#F5F1E8'), pxp + 0.28, 0.5, 0.6, 1, 1, 0.25);
    for (const [dx, c] of [[-0.15, '#D95555'], [0.05, '#4E9EE8'], [0.25, '#5FA05F'], [0.45, '#E8C86A']])
      sph(g, 0.06, M(c), pxp + dx, 0.58, 0.68);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  media(g, rnd, h, px) {            // 传媒：摄像机 + 声波
    for (const sx of [-px, px]) {
      box(g, 0.58, h, 0.58, '#4A5560', sx, h / 2, 0);
      box(g, 0.72, 0.2, 0.72, '#2E3844', sx, h + 0.07, 0);
    }
    box(g, px * 2 + 1.1, 0.38, 0.55, '#2E3844', 0, h + 0.45, 0);
    for (let i = 0; i < 3; i++)
      torus(g, 0.18 + i * 0.16, 0.04, glowC('#4ED0C8'), -0.4 + i * 0.55, h + 0.45, 0.29, Math.PI, 0, 0, 0);
    const cx = px - 1.15;                                    // 摄像机
    for (const [dx, dz] of [[-0.25, 0.15], [0.25, 0.15], [0, -0.28]])
      cyl(g, 0.03, 0.03, 0.9, '#3A4450', cx + dx * 0.5, 0.45, 0.85 + dz * 0.5, 0.3, 0, 0, 6);
    box(g, 0.7, 0.44, 0.5, '#2E3844', cx, 1.12, 0.85);
    cyl(g, 0.1, 0.13, 0.35, '#1E2630', cx + 0.48, 1.1, 0.85, 0, 0, Math.PI / 2, 8);
    for (const dx of [-0.18, 0.18]) cyl(g, 0.14, 0.14, 0.05, '#8A9188', cx + dx, 1.42, 0.85, 0, 0, 0, 10);
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  sport(g, rnd, h, px) {            // 体育：五环 + 火炬
    for (const sx of [-px, px]) {
      box(g, 0.6, h, 0.6, '#C24A50', sx, h / 2, 0);
      box(g, 0.74, 0.22, 0.74, '#FFFDF4', sx, h + 0.08, 0);
    }
    box(g, px * 2 + 1.1, 0.4, 0.55, '#FFFDF4', 0, h + 0.45, 0);
    const rings = ['#4E9EE8', '#2A2A2A', '#D95555', '#E8C86A', '#5FA05F'];
    rings.forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 12), M(c));
      m.position.set((i - 2) * 0.42, h + 0.45, 0.3); g.add(m);
    });
    cyl(g, 0.06, 0.08, 1.3, '#E8C86A', 0, 0.65, 0.85, 0, 0, 0, 6);   // 火炬
    cone(g, 0.16, 0.4, glowC('#FF9A3A'), 0, 1.5, 0.85, 0, 0, 0, 8);
    sph(g, 0.1, glowC('#FFE24E'), 0, 1.72, 0.85);
    box(g, px * 2 + 0.6, 0.06, 0.5, '#C9584A', 0, 0.03, 0.5);        // 跑道
    return [h + 0.45, px * 2 + 1.0, 0.29];
  },
  human(g, rnd, h, px) {            // 人文：米白圆拱（兜底）
    const cream = '#F2EEE6';
    for (const sx of [-px, px]) {
      cyl(g, 0.3, 0.36, h - 0.6, cream, sx, (h - 0.6) / 2, 0, 0, 0, 0, 10);
      box(g, 0.9, 0.24, 0.9, '#E4DECF', sx, h - 0.5, 0);
    }
    torus(g, px, 0.26, cream, 0, h - 0.55, 0);
    box(g, px * 2 + 0.3, 0.2, 0.5, '#E4DECF', 0, h + 0.1, 0);
    box(g, 1.6, 0.06, 1.2, '#B9B2A2', 0, 0.03, 0.2);
    return [h + 0.1, px * 2 + 0.7, 0.26];
  },
};

// 校徽/校名匾：横梁正面贴白底校徽图（本地 img，contain 缩进）
// 图片必须带 crossOrigin 拉（维基图床等跨域源）：否则 canvas 被污染，three 每帧
// 抛 texSubImage2D SecurityError。拉不到（断网/无 CORS/404）就画校名文字兜底。
// 导出给 GLB 换装用（js/assets.js）：匾额是动态图，永远在运行时画，不进烘焙资产。
export function attachPlaque(g, img, beamY, beamW, fz, zh) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c2 = cv.getContext('2d');
  c2.fillStyle = '#FFFDF4'; c2.fillRect(0, 0, 512, 128);
  const drawFallback = () => {
    c2.fillStyle = '#5A4A38';
    c2.font = '900 44px "Microsoft YaHei", sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(String(zh || '').slice(0, 10), 256, 68);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (!img) { drawFallback(); }
  else {
    const im = new Image();
    im.crossOrigin = 'anonymous';   // 跨域校徽图：不带这个画进 canvas 会污染（WebGL 禁传）
    im.onload = () => {
      const k = Math.min(112 / im.height, 472 / im.width);
      c2.drawImage(im, (512 - im.width * k) / 2, (128 - im.height * k) / 2, im.width * k, im.height * k);
      tex.needsUpdate = true;
    };
    im.onerror = drawFallback;
    im.src = img;
  }
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(beamW - 0.3, 0.4),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  );
  board.position.set(0, beamY, fz + 0.01);   // 正面外贴 0.01 防 z-fighting
  g.add(board);
}

// 入口：按校名出招牌门或风格族门
export function buildUniGate(g, zh, img) {
  let s = 5381;
  for (const ch of String(zh || '')) s = (Math.imul(s, 33) ^ ch.charCodeAt(0)) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };

  const sig = SIGNATURE[String(zh || '')];
  let beamY, beamW, fz = 0.3;
  if (sig) {
    [beamY, beamW, fz] = TPL[sig.tpl](g, rnd, sig);
    if (sig.prop && PROPS_MAP[sig.prop]) {
      const side = rnd() < 0.5 ? -1 : 1;
      PROPS_MAP[sig.prop](g, side * 2.9, 0.85);
    }
  } else {
    const span = 3.6 + rnd() * 0.9, px = span / 2, h = 3.2 + rnd() * 0.5;
    [beamY, beamW, fz] = (FAMILY[familyFor(zh)] || FAMILY.classic)(g, rnd, h, px);
  }
  attachPlaque(g, img, beamY, beamW, fz, zh);
  box(g, 2.4, 0.1, 1.2, '#D8CCA8', 0, 0.05, 0.4);   // 门前空地
  return { beamY, beamW };
}

// GLB 换装：程序化门先立着（它同时是回退实现），烘焙资产到位后原地替换（js/assets.js）。
// 换装会清掉全部子件（含刚贴好的匾额），所以要用 manifest 里的 beamY/beamW/fz 重贴一遍；
// opts.onSwap 交给调用方补自己的挂件与打标（js/game.js 的 userData.sign）。
export function attachGateAsset(g, zh, img, opts = {}) {
  assets.apply(g, 'gate', zh, {
    onSwap: (grp, e) => {
      attachPlaque(grp, img, e.beamY, e.beamW, e.fz, zh);
      if (opts.onSwap) opts.onSwap(grp);
    },
  });
}
