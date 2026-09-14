// 程序化低模库：词宠 / 玩家 / 场景物
// 风格：Q 版大头、马卡龙配色、点睛小表情（黑豆眼 + 高光 + 腮红）
import * as THREE from 'three';

export const M = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
  emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: !!o.alpha, opacity: o.alpha ?? 1,
  flatShading: !!o.flat, side: o.side ?? THREE.FrontSide,
});

export function add(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}
export const G = () => new THREE.Group();
export const sph = (g, r, c, x, y, z, sx = 1, sy = 1, sz = 1, o) => add(g, new THREE.SphereGeometry(r, 18, 14), M(c, o), x, y, z, 0, 0, 0, sx, sy, sz);
export const box = (g, w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0, o) => add(g, new THREE.BoxGeometry(w, h, d), M(c, o), x, y, z, rx, ry, rz);
export const cyl = (g, rt, rb, h, c, x, y, z, rx = 0, ry = 0, rz = 0, seg = 14, o) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), M(c, o), x, y, z, rx, ry, rz);
export const cone = (g, r, h, c, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12, o) => cyl(g, 0.001, r, h, c, x, y, z, rx, ry, rz, seg, o);
export const cap = (g, r, len, c, x, y, z, rx = 0, ry = 0, rz = 0, o) => add(g, new THREE.CapsuleGeometry(r, len, 6, 12), M(c, o), x, y, z, rx, ry, rz);
export const tor = (g, R, r, c, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, o) => add(g, new THREE.TorusGeometry(R, r, 10, 24, arc), M(c, o), x, y, z, rx, ry, rz);

// 小表情：黑豆眼 + 高光 + 腮红（挂在 z 正面）
export function face(g, { dx = 0.07, y = 0.02, z = 0.16, s = 1, blush = 0.12, by = -0.05 } = {}) {
  for (const sx of [-1, 1]) {
    sph(g, 0.030 * s, '#4A4046', dx * sx, y, z, 1, 1.35, 0.55);
    sph(g, 0.010 * s, '#FFFFFF', dx * sx + 0.011 * s, y + 0.032 * s, z + 0.014);
    sph(g, 0.036 * s, '#FFB3C1', blush * sx, by, z * 0.86, 1, 0.7, 0.4);
  }
}


// ================= 四足兽基础 =================
export function quadBody(g, { bc, bodyR = 0.16, bodyLen = 1.3, legH = 0.12, legC, headR = 0.19, headY, headZ }) {
  cap(g, bodyR, 0.16 * bodyLen, bc, 0, legH + bodyR * 0.9, 0, Math.PI / 2, 0, 0).scale.y = bodyLen; // 身体（沿 z）
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]])
    cyl(g, 0.045, 0.05, legH, legC || bc, 0.1 * lx, legH / 2, 0.13 * bodyLen * lz * 0.8);
  const head = G();
  head.position.set(0, headY ?? (legH + bodyR + headR * 0.55), headZ ?? (0.22 * bodyLen));
  g.add(head);
  return head;
}

