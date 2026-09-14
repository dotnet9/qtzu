// 全国地图背景：当前城市以外的城市按真实经纬度平铺在地面上（边界+淡色填充+城市名），
// 像一张立体中国地图。当前城市由可玩城市场景覆盖，不在背景里重复绘制。
// 比例：1° 经纬 ≈ UPD 世界单位（非真实比例的温和压缩，保证拉远镜头能看到邻城）。
import { CITY_SHAPES, CITY_GEO } from './city-shape-data.js';

const UPD = 420;                                  // 世界单位/度
const LAT_K = Math.cos(35 * Math.PI / 180);       // 经度方向随纬度收缩（中国中纬度）
const BASE_Y = -0.3;                              // 底图高度：海面(-0.5)之上、城市地面(0)之下（层间距拉开防 z-fighting）

﻿// 城市状态浮牌：状态不同颜色不同（待闯关蓝/已攻克绿/奖励金/打造灰）
function statusSprite(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 72;
  const c = cv.getContext('2d');
  const pal = {
    '待闯关': ['#E8F4FF', '#3E7CB1'], '已攻克': ['#E8F8E4', '#4E8E4E'],
    '通关后再来哦': ['#FFF6DC', '#C08A2D'], '我们正在打造，敬请期待': ['#F0EEEA', '#8A8478'],
  };
  const [bg, fg] = pal[text] || ['#FFFFFF', '#666666'];
  c.fillStyle = bg; c.strokeStyle = fg; c.lineWidth = 6;
  c.beginPath();
  if (c.roundRect) c.roundRect(6, 6, 244, 60, 18); else c.rect(6, 6, 244, 60);
  c.fill(); c.stroke();
  c.fillStyle = fg;
  c.font = '900 34px "Microsoft YaHei", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 128, 38);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(54, 15.2, 1);
  return sp;
}

function nameSprite(name) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 88;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(255,253,246,.92)';
  c.strokeStyle = '#C9BFA9'; c.lineWidth = 5;
  c.beginPath();
  if (c.roundRect) c.roundRect(6, 6, 244, 76, 20); else c.rect(6, 6, 244, 76);
  c.fill(); c.stroke();
  c.fillStyle = '#4A3B2E';
  c.font = '900 40px "Microsoft YaHei", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(name, 128, 46);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(72, 24.75, 1);
  return sp;
}

// 建一次全国地图（含所有城市边界与名称），返回 { group, anchor }
export function buildChinaMap(scene, currentKey, cityNames = {}, statuses = {}, route = []) {
  const group = new THREE.Group();
  group.visible = false;   // anchor 定位后才显示
  // 底图：地图纸色，铺满整个可见范围（拉远到 550 也看不完）
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(30000, 22000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#EFEAE0', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  base.position.y = BASE_Y;   // -0.30：远低于城市地面(0)、高于海面(-0.5)，深度偏置防远处 z-fighting
  group.add(base);

  for (const [cid, geo] of Object.entries(CITY_GEO)) {
    if (cid === currentKey) continue;                     // 当前城由可玩地面覆盖，背景里不重复画
    const pts = CITY_SHAPES[cid];
    if (!pts || pts.length < 3) continue;                 // 台湾4城走回退，没有 pts 就跳过
    const s = geo.halfDeg * UPD;
    // 城市边界填充：polygonOffset 强制压在底图之上，避免大平面间 z-fighting（远处白条纹）
    const shape = new THREE.Shape(pts.map(([nx, nz]) => new THREE.Vector2(nx * s, nz * s)));
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({
        color: '#E5E1D3', side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      })
    );
    mesh.rotation.x = Math.PI / 2;                        // shape(x,y) → 世界(x,z)
    const [lon, lat] = geo.ctr;
    const wx = lon * UPD * LAT_K, wz = -lat * UPD;
    mesh.position.set(wx, BASE_Y + 0.02, wz);
    group.add(mesh);
    // 边界线
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts.map(([nx, nz]) => new THREE.Vector3(nx * s, 0, nz * s))),
      new THREE.LineBasicMaterial({ color: '#A89F8D', fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
    );
    line.position.set(wx, BASE_Y + 0.05, wz);
    group.add(line);
    // 城市名 + 状态浮牌（当前城由可玩场景命名，不重复放牌）
    if (cityNames[cid]) {
      const sp = nameSprite(cityNames[cid]);
      sp.position.set(wx, BASE_Y + 14, wz);
      group.add(sp);
      if (statuses[cid]) {
        const st = statusSprite(statuses[cid]);
        st.position.set(wx, BASE_Y + 5.5, wz);
        group.add(st);
      }
    }
  }

﻿  // 巡游路线：按顺序串起路线城中心点（金色虚线）
  {
    const rp = [];
    for (const cid of route) {
      const g = CITY_GEO[cid];
      if (!g) continue;
      const [lo, la] = g.ctr;
      rp.push(new THREE.Vector3(lo * UPD * LAT_K, BASE_Y + 0.12, -la * UPD));
    }
    if (rp.length > 1) {
      const lg = new THREE.BufferGeometry().setFromPoints(rp);
      const line = new THREE.Line(lg, new THREE.LineDashedMaterial({
        color: '#C08A2D', dashSize: 70, gapSize: 45, fog: false, depthTest: false,
        polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7,
      }));
      line.computeLineDistances();
      line.renderOrder = 5;
      group.add(line);
    }
  }

  // 锚定：把当前城市的地图位置对齐到它的可玩舞台中心（cx, cz）
  function anchor(stageKey, cx, cz) {
    const geo = CITY_GEO[stageKey];
    if (!geo) { group.visible = false; return; }
    const [lon, lat] = geo.ctr;
    // 底图跟着当前城走：原点在地图经纬原点，离当前城几万单位远，铺不满视野
    base.position.set(lon * UPD * LAT_K, BASE_Y, -lat * UPD);
    group.position.set(cx - lon * UPD * LAT_K, 0, cz + lat * UPD);
    group.visible = true;
  }

  scene.add(group);
  return { group, anchor };
}
