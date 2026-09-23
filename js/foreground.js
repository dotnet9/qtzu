// 前景枝叶（frame foliage）：贴着画面四边的一圈枝叶剪影，制造"透过枝叶看场景"的纵深。
//
// 为什么需要：参考图的纵深不只是"远处的山更小"，还有**近处的枝叶压在画面上**。
// 本作原来的画面只有中景与远景，缺这一层，所以看起来像"俯瞰一个模型"而不是"身处其中"。
//
// 三条硬约束（都写进了 scripts/verify-foreground.mjs）：
//   1) **中央 70% 画面必须干净** —— 枝叶只出现在画面边缘，绝不挡玩家/蛋/台阶
//   2) 四边遮挡总量 ≤ 画面 8%（它只是氛围，不是遮罩）
//   3) 触屏/低画质整组不建（与 SMAA/天空云同一判据）
//
// 实现要点：
//   - 挂在**相机坐标系**里（每帧同步相机的 position/quaternion），所以转视角时枝叶会跟着滑，
//     比"屏幕空间固定贴图"真实得多
//   - `depthTest: false` + `renderOrder = 900`：永远画在最上层，且**不会**因为离相机近而穿模
//   - 不参与点击拾取（本作的拾取是限定目标列表，不扫场景；这里仍显式标 noPick，保持一致）
//   - 随机分布用**固定种子**：截图与校验可复现
import * as THREE from 'three';

const CAM_DIST = 3.0;            // 距相机的距离（相机 near = 1，放这里安全）
const EDGE_K = 1.02;             // 贴到画面边缘的 1.02 倍处（刚好压边）
const SPRITE_N = 8;
// 每片枝叶的世界尺寸 = 0.40 × 画面半高。
// ⚠ 这个数直接决定"中央 70% 是否干净"：面片是方形且会旋转，轴向半跨度最大是
//   (s/2)·(|cosθ|+|sinθ|) ≈ (s/2)·1.41。取 s=0.40×半高 → 向内最多伸 0.137 个画面高度，
//   而中央干净带从 0.15 开始（两侧各 35%）→ 留 0.013 余量，再加摆动的 0.006 仍安全。
const SIZE_OF_HALF_H = 0.40;
const SWAY_Y = 0.012;            // 摆动幅度（约 4px 等效）
const SWAY_ROT = 0.004;

let _texCache = null;

/** 枝叶剪影贴图：沿一条弧排开的叶片，**大部分是透明的**（遮挡面积必须小）。 */
function branchTexture(variant) {
  if (_texCache && _texCache[variant]) return _texCache[variant];
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, S, S);
  // 固定种子：同一 variant 每次都是同一张图（截图可复现）
  let seed = 1337 + variant * 977;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const LEAF = variant === 1 ? '#2A4722' : variant === 2 ? '#33532A' : '#25401F';
  // 主枝：从一角伸向中心
  c.strokeStyle = 'rgba(46,66,38,.85)';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(10, 24 + rnd() * 20);
  c.quadraticCurveTo(S * 0.45, S * 0.42, S * 0.86, S * 0.78);
  c.stroke();
  // 叶片：沿弧分布，每片一个椭圆 + 柔边
  const n = 7 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const px = 10 + (S * 0.86 - 10) * t + (rnd() - 0.5) * 18;
    const py = 30 + (S * 0.78 - 30) * t + (rnd() - 0.5) * 26;
    const rx = 26 + rnd() * 22, ry = 13 + rnd() * 10;
    const rot = -0.5 + t * 1.5 + (rnd() - 0.5) * 0.6;
    c.save();
    c.translate(px, py);
    c.rotate(rot);
    // 柔边：先画一层低透明度的放大椭圆，再画本体
    const g = c.createRadialGradient(0, 0, 2, 0, 0, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(37,64,31,.92)');
    g.addColorStop(0.7, LEAF + 'cc');
    g.addColorStop(1, 'rgba(37,64,31,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, rx * 1.12, ry * 1.12, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = LEAF;
    c.globalAlpha = 0.85;
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    // 叶脉：一道亮一点的线，避免死黑一片
    c.globalAlpha = 0.35;
    c.strokeStyle = '#4E7040';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-rx * 0.85, 0);
    c.lineTo(rx * 0.85, 0);
    c.stroke();
    c.restore();
    c.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache = _texCache || {};
  _texCache[variant] = tex;
  return tex;
}

/**
 * 造前景枝叶组。调用方每帧 `update(camera, t)` 同步到相机坐标系。
 * 返回 { group, update, setVisible, dispose }
 */
export function makeForeground() {
  const group = new THREE.Group();
  group.name = 'frame-foliage';
  group.matrixAutoUpdate = true;
  const sprites = [];
  let seed = 20260923;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < SPRITE_N; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: branchTexture(i % 3),
        transparent: true, depthTest: false, depthWrite: false,
        fog: false, toneMapped: false, side: THREE.DoubleSide,
      }));
    m.renderOrder = 900;            // 永远最后画 → 永远在最上层
    m.userData.noPick = true;
    m.userData.ang = (i / SPRITE_N) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    m.userData.rot = (rnd() - 0.5) * 1.0;   // ≤ ±0.5 rad（见 SIZE_OF_HALF_H 的说明）
    m.userData.jit = 0.86 + rnd() * 0.3;
    m.userData.phase = rnd() * 6.28;
    group.add(m);
    sprites.push(m);
  }

  const layout = (camera) => {
    const aspect = (camera.aspect || 1.6);
    const halfH = CAM_DIST * Math.tan((camera.fov * Math.PI / 180) / 2);
    const halfW = halfH * aspect;
    const size = SIZE_OF_HALF_H * halfH;
    for (const m of sprites) {
      const a = m.userData.ang;
      const ca = Math.cos(a), sa = Math.sin(a);
      // 射线与"画面矩形（1.02 倍）"的交点：贴边但不进画面中央
      const k = EDGE_K / Math.max(Math.abs(ca) / halfW, Math.abs(sa) / halfH);
      m.position.set(ca * k, sa * k, -CAM_DIST);
      m.rotation.z = m.userData.rot;
      m.scale.setScalar(size * m.userData.jit);
    }
    return { halfH, halfW, size };
  };

  let lastAspect = 0;
  return {
    group,
    /** 每帧：同步到相机坐标系（位置 + 朝向），并按时间做极慢的摆动 */
    update(camera, t) {
      if (!camera) return;
      if (Math.abs((camera.aspect || 1.6) - lastAspect) > 1e-3) {
        lastAspect = camera.aspect || 1.6;
        layout(camera);
      }
      group.position.copy(camera.position);
      group.quaternion.copy(camera.quaternion);
      group.position.y += Math.sin(t * 0.5) * SWAY_Y;
      group.rotation.z = Math.sin(t * 0.37) * SWAY_ROT;
      for (const m of sprites) m.rotation.z = m.userData.rot + Math.sin(t * 0.45 + m.userData.phase) * SWAY_ROT * 1.5;
    },
    setVisible(v) { group.visible = !!v; },
    dispose() {
      for (const m of sprites) m.geometry.dispose();
    },
    _layout: layout,
    _sprites: sprites,
  };
}

export const FOREGROUND_CONST = { CAM_DIST, EDGE_K, SPRITE_N, SIZE_OF_HALF_H, SWAY_Y };
