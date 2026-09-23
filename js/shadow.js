// 接触阴影（contact shadow）：角色/词宠/NPC 脚下的一张软阴影贴片。
//
// 为什么需要：现在只有方向光的投影贴图（有方向、有偏移、随阴影框分辨率变糊），
// 缺的是"紧贴脚下的一小圈暗" —— 收费 3D 游戏里让物体"落在地面上"的第一观感就是它。
// 尤其词宠是**悬浮**的（group.position.y = 0.14 + 0.1|sin|），没有接触阴影就像漂着。
//
// 做法：一张径向渐变的 CanvasTexture 贴在地面上（共享几何 + 共享材质，几乎零成本），
//   高度越高 → 影子越大越淡（用 scale 与 opacity 表达"离地高度"）。
//   材质 depthWrite=false 避免与地面 z-fighting；不加 castShadow/receiveShadow。
import * as THREE from 'three';

let mat = null;
let geo = null;

function ensure() {
  if (geo) return;
  // 径向渐变：中心深、边缘透明（软边，不做硬圆盘）
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(40,32,28,.55)');
  g.addColorStop(0.55, 'rgba(40,32,28,.30)');
  g.addColorStop(1, 'rgba(40,32,28,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, opacity: 1.0,   // 实际强度逐帧由 updateContactShadow 给
    // 不参与光照（阴影不该被自己的光照亮/照亮别人）
    toneMapped: false,
  });
  geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);   // 平铺在地面（XZ 平面）
}

/** 造一个接触阴影（挂在 scene 上，不是实体的子节点——实体是悬浮的，阴影要贴地）。 */
export function contactShadow(radius = 0.42) {
  ensure();
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;          // 地面之后画（避免被地形盖住）
  m.userData.shadowRadius = radius;
  m.userData.noPick = true;   // 不参与点击拾取（js/game.js 的点击判定靠 intersectObjects）
  m.scale.setScalar(radius * 2);
  return m;
}

/**
 * 每帧更新：把阴影放到实体正下方的地面上，并按"离地高度"放大变淡。
 *   lift = 实体脚底到地面的距离（0 = 贴地）
 *   gain = 整体强度系数（默认 0.9）。
 *
 * 为什么要 gain：角色/词宠**本来就有真实投影**（js/assets.js:128 与 models/kit.js:17 都开了
 * castShadow，阴影贴图 2048）。白天太阳高、真影子清楚时，脚下再压一块暗斑会糊成一团；
 * 而**夜里**（太阳落山）与**低画质降级**（js/game.js 的 _fpsWatch 会把 shadowMap 整个关掉）
 * 真影子不存在，这块接触阴影就是唯一的"落地感"。所以强度由调用方按这两种情况给。
 */
export function updateContactShadow(mesh, x, z, groundY, lift = 0, gain = 0.9) {
  if (!mesh) return;
  const r = mesh.userData.shadowRadius || 0.42;
  const k = Math.min(1, Math.max(0, lift) / 2.2);         // 0（贴地）→ 1（离地 2.2 以上）
  const s = r * 2 * (1 + k * 0.85);                       // 越高越大
  mesh.scale.set(s, 1, s);
  mesh.position.set(x, groundY + 0.035, z);               // 略高于地面，避免 z-fighting
  mesh.visible = groundY > -900;
  mesh.material.opacity = gain * (1 - k * 0.62);          // 越高越淡
}
