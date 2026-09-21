// 玩家（小花匠）：男孩/女孩双造型 + 许愿井换装（帽/气球/魔杖）
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor, face, quadBody } from './kit.js';

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
    sph(arm, 0.058, skin, 0, -0.195, 0.012, 1, 0.92, 1.06);   // 小手：加大到能看见，微微朝前
    // 拇指：一颗小球贴在手掌内侧。诚实说明：0.55 缩放下只有几个像素，别期待质变
    sph(arm, 0.024, skin, 0, -0.182, 0.052, 1, 0.9, 1.2);
  }
  body.add(armL, armR);
  // 头
  const head = G(); head.position.set(0, 0.46, 0); body.add(head);
  sph(head, 0.185, skin, 0, 0, 0, 1, 0.95, 0.97);
  sph(head, 0.196, '#8A5A3C', 0, 0.028, -0.022, 1.02, 0.98, 1.02);  // 头发
  sph(head, 0.07, '#8A5A3C', -0.075, 0.11, 0.13, 1.4, 0.7, 0.7);    // 刘海
  sph(head, 0.08, '#8A5A3C', 0, 0.125, 0.14, 1.4, 0.75, 0.75);
  sph(head, 0.07, '#8A5A3C', 0.075, 0.11, 0.13, 1.4, 0.7, 0.7);
  // 头发层次：后脑发量（把头包得更圆）+ 两侧鬓角（暗一档）+ 一缕受光发丝（亮一档）。
  // 原来只有一个头发球加三片刘海，侧后看是光的；这三件让轮廓有起伏。
  sph(head, 0.152, '#8A5A3C', 0, -0.012, -0.062, 1.06, 1.0, 0.92);
  for (const sx of [-1, 1]) sph(head, 0.05, '#7A4E34', 0.148 * sx, -0.02, 0.055, 1, 1.35, 0.85);
  sph(head, 0.055, '#A6704A', -0.055, 0.128, 0.108, 1.5, 0.5, 0.8);
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
  // 脸部小件一律标 userData.keep：换装时保留（js/assets.js 的 swap 会留下标了 keep 的子件）。
  // 眨眼靠 parts.eyes 这个引用（game.js 改 scale.y），而换装会清空 head 的 children ——
  // 不标 keep 的话引用会指向已被移除的网格，眨眼**静默失效**（实测踩过这个坑）。
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = sph(head, 0.03, '#4A4046', 0.068 * sx, 0.012, 0.158, 1, 1.35, 0.55);
    eye.userData.eyeH = eye.scale.y;
    eye.userData.keep = true;
    eyes.push(eye);
    sph(head, 0.01, '#FFFFFF', 0.079 * sx, 0.044, 0.172).userData.keep = true;
    sph(head, 0.036, '#FFB3C1', 0.118 * sx, -0.048, 0.138, 1, 0.7, 0.4).userData.keep = true;
  }
  // 嘴：微笑弧（与螃蟹词宠同款做法 —— 半圈细环）。同样标 keep 并放进 parts，
  // 给后续"表情系统"留接口（孵蛋成功/被表扬时缩放或旋转它）。
  const mouth = tor(head, 0.032, 0.009, '#C06A5A', 0, -0.012, 0.170, 0.4);
  mouth.userData.keep = true;
  return { group: g, parts: { legL, legR, armL, armR, body, head, eyes, mouth, balloon, wandTip } };
}
