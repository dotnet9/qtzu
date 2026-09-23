// 脚下指示环（ground ring）：角色脚下一圈发光环，**颜色随"最近可交互目标"变化**。
//
// 为什么需要：参考图（俯视 ARPG）里角色脚下那圈光不只是装饰 —— 它是最省眼的"你现在能做什么"提示。
// 本作原来的引导只有"金色箭头 + 发光小径"（在世界里），孩子低头看自己时脚下什么都没有。
//
// 为什么用颜色区分而不是只做一圈白光：
//   蛋（暖金）/ 台阶（薄荷）/ 奖杯（紫）三类目标的**操作方式不同**（走过去捡 / 跳上去 / 踩上台面），
//   环的颜色先给出"这是哪一类"，孩子不用先跑过去试。
//
// 与接触阴影共存：环在 y+0.035+0.02、阴影在 y+0.035，两者都 depthWrite=false，
// 环 renderOrder 更大 → 绘制顺序确定，不会同深度互相闪烁（见 scripts/verify-player-ring.mjs）。
import * as THREE from 'three';

/** 语义色板：verify-player-ring 会 import 它来断言"颜色确实按目标类型变" */
export const RING_KINDS = {
  none:   { color: 0xFFFFFF, opacity: 0.32, label: '无目标（柔白，降到 32%）' },
  egg:    { color: 0xFFC94A, opacity: 0.88, label: '蛋（暖金）' },
  step:   { color: 0x5BC79A, opacity: 0.88, label: '台阶/云梯（薄荷）' },
  trophy: { color: 0xB28FF5, opacity: 0.92, label: '台顶奖杯（紫）' },
};

const RING_RADIUS = 0.5;
const RING_TUBE = 0.045;
// ⚠ 必须大于接触阴影自身的抬升（js/shadow.js 里是 groundY + 0.035），否则环会画在阴影**下面**
// （实测 Δy = -0.015 → verify-player-ring 的共面断言不过）。这里取 0.055 = 阴影之上 2cm。
const RING_LIFT = 0.055;

let geo = null;
let mat = null;

function ensure() {
  if (geo) return;
  geo = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 8, 30);
  geo.rotateX(-Math.PI / 2);   // 平铺在地面（XZ 平面）
  mat = new THREE.MeshBasicMaterial({
    color: RING_KINDS.none.color, transparent: true, opacity: RING_KINDS.none.opacity,
    depthWrite: false, fog: false, toneMapped: false,   // 不参与雾/色调映射：它是 UI 语言，不是场景物
  });
}

/** 造一个指示环（挂在 scene 上，贴地跟随；不参与点击拾取） */
export function groundRing() {
  ensure();
  const m = new THREE.Mesh(geo, mat.clone());   // 材质各自一份：颜色/透明度要能单独改
  m.renderOrder = 3;                            // 接触阴影是 2 → 环画在它之后，顺序确定
  m.userData.ringRadius = RING_RADIUS;
  m.userData.ringTube = RING_TUBE;
  m.userData.noPick = true;                     // 不参与点击拾取（与接触阴影同一约定）
  return m;
}

/**
 * 每帧更新：贴地 + 按目标类型上色 + 脉动。
 *   kind = 'none' | 'egg' | 'step' | 'trophy'
 *   t    = 累计时间（驱动脉动）
 */
export function updateGroundRing(mesh, x, z, groundY, kind = 'none', t = 0) {
  if (!mesh) return;
  const k = RING_KINDS[kind] || RING_KINDS.none;
  mesh.position.set(x, groundY + RING_LIFT, z);
  mesh.material.color.setHex(k.color);
  // 脉动：有目标时呼吸更明显（"来这儿"），无目标时几乎不动（只是"你在这儿"）
  const amp = kind === 'none' ? 0.03 : 0.07;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  mesh.scale.setScalar(1 + amp * pulse);
  mesh.material.opacity = k.opacity * (kind === 'none' ? 1 : 0.72 + 0.28 * pulse);
  mesh.visible = groundY > -900;
}
