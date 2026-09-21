// 城市微缩分层地形引擎（通用模块，数据驱动）
// 用法：createCityTerrain({ pts, cfg }) → { group, heightAtLocal, peaks, field }
//   pts：城市轮廓多边形（世界局部坐标，相对岛心，与 isl.shape 同一份）
//   cfg：data/cities/<id>/terrain.json 配置。坐标为归一化值；归一化原点 = 轮廓包围盒中心，
//        x/z 两轴各自映射到包围盒半跨 RX/RZ——轮廓很少是正方形，用同一个 R 会让长条形
//        城市（西安 z 跨度≈0.49、长沙≈0.34）的山水跑到界外/海面上。高度/宽度类参数为米，
//        与玩家/城墙同一尺度。方向：x+ = 东，z+ = 南。
// 设计约定：
//   - 轮廓边缘 edgeFlat 带内压平为 y=0（城墙/立牌/蛋的既有摆放与碰撞逻辑不受影响）
//   - 高度按 step 台地量化（flatShading 刻面 = 微缩手办感），色带用平滑高度取等高线
//   - 不含城墙/岩裙/云海/地标——那些由 world.js 既有系统负责，本模块只做"地面+山+水"
//   - 所有数值（高度/配色/水面）都来自 js/terrain-field.js，渲染与寻高/涉水/体检同源
import * as THREE from 'three';
import { makeHeightField, srgbToLinear } from './terrain-field.js';
import { grassDetail, rockDetail } from './textures.js';

export function createCityTerrain({ pts, cfg }) {
  const F = makeHeightField({ pts, cfg });
  const { minX, maxX, minZ, maxZ, gsz, nx, nz, qy, hsSm, inPoly, dEdge, heightAtLocal, zoneColorLinear } = F;
  const group = new THREE.Group();
  const rng = mulberry32(cfg.seed ?? 42);

  /* ---- 地面网格（顶点色 + 台地刻面） ---- */
  const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const pos = [], col = [], uv = [], cc = [0, 0, 0];
  // 一个贴图周期 = 4.5 世界单位：256px 的细节图 ≈ 57 像素/单位，近景够细、远景靠 mipmap+各向异性
  const UV_TILE = 4.5;
  const getV = (i, j) => {
    const id = j * (nx + 1) + i;
    if (vid[id] !== -1) return vid[id];
    const x = minX + i * gsz, z = minZ + j * gsz;
    const hSm = hsSm[j][i], band = Math.floor(hSm / F.step + 1e-4);
    vid[id] = pos.length / 3;
    pos.push(x, qy[j][i], z);
    uv.push(x / UV_TILE, z / UV_TILE);
    zoneColorLinear(x, z, hSm, band, cc);   // 线性色：顶点色不走颜色管理，必须自己转
    col.push(cc[0], cc[1], cc[2]);
    return vid[id];
  };
  const idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = minX + (i + 0.5) * gsz, cz = minZ + (j + 0.5) * gsz;
    if (!inPoly(cx, cz)) continue;
    const a = getV(i, j), b = getV(i + 1, j), c = getV(i, j + 1), d = getV(i + 1, j + 1);
    idx.push(a, c, d, a, d, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // 地面材质：细节贴图（近中性灰度）× 顶点色（分区配色）= "写实纹理 + 游戏配色"。
  // 去掉 flatShading：台地的层次由高度与色带表达，表面靠法线细节，不再是"刻出来的一层层硬面片"。
  const gTex = grassDetail(256, 11);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, map: gTex.map, normalMap: gTex.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.name = 'city-ground';   // 名字供"换装时隐藏程序化地面"用（js/world.js 的 ground-slot）
  group.add(mesh);

  /* ---- 雪山峰：噪声位移的岩体 + 岩理贴图 + 雪线混合 ---- */
  const peaksOut = [];
  const peakMeshes = [];
  if (F.features.peaks.length) {
    const rk = rockDetail(256, 71);
    const pkMat = new THREE.MeshStandardMaterial({
      vertexColors: true, map: rk.map, normalMap: rk.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.97, metalness: 0,
    });
    for (const def of F.features.peaks) {
      const [px, pz] = F.P2(def), ph = def[2], pr = def[3];
      // 雪峰是独立几何、不吃地形沙化，但必须整座落在轮廓内，否则会挂在城外
      if (!inPoly(px, pz) || dEdge(px, pz) < 6) { console.warn('[terrain] 雪峰在轮廓外，已跳过:', def); continue; }
      // 12 边 8 段：够做出岩脊起伏，面数仍很低（一座 ≈ 200 面）
      const geo2 = new THREE.ConeGeometry(pr, ph, 12, 8);
      const pa = geo2.attributes.position, colA = [], uvA = [];
      const baseY = heightAtLocal(px, pz);
      const sd = def[0] * 1.7 + def[1] * 0.9;          // 每座峰的噪声相位（同一城每次一致）
      for (let i = 0; i < pa.count; i++) {
        const x0 = pa.getX(i), y0 = pa.getY(i), z0 = pa.getZ(i);
        const t = Math.min(1, Math.max(0, (y0 + ph / 2) / ph));   // 0 底 / 1 顶
        const w = Math.sin(Math.PI * t);                          // 底与顶位移 0，中段最大
        const ang = Math.atan2(z0, x0);
        // 多段正弦噪声：低频定山脊走向、中频定岩壁凹凸、高频定碎石细节
        const n = Math.sin(ang * 3.1 + sd) * 0.5
          + Math.sin(ang * 7.3 + y0 * 0.9 + sd * 1.3) * 0.3
          + Math.sin(ang * 13.7 - y0 * 2.1 + sd * 0.7) * 0.2;
        const k = 1 + n * 0.22 * w;
        pa.setX(i, x0 * k);
        pa.setZ(i, z0 * k);
        pa.setY(i, y0 + n * ph * 0.05 * w);
        // UV：绕峰 6 圈、竖向 4 圈（岩理贴图平铺；峰体是独立投影，接缝在背面）
        uvA.push((ang / (Math.PI * 2) + 0.5) * 6, t * 4);
        // 顶点色：雪线以下岩色（受噪声调制，像岩缝的明暗）→ 以上雪色，平滑过渡。
        // 必须 srgbToLinear：0.26/0.95 这些是按人眼挑的 sRGB 值，不转换会被当线性值乘进去 → 整座发白
        const sn = smoothstep(0.40, 0.66, t + n * 0.06);
        const shade = 0.86 + 0.28 * n;
        colA.push(
          srgbToLinear((0.30 * shade + (0.95 - 0.30 * shade) * sn)),
          srgbToLinear((0.26 * shade + (0.97 - 0.26 * shade) * sn)),
          srgbToLinear((0.24 * shade + (1.0 - 0.24 * shade) * sn)));
      }
      geo2.setAttribute('position', pa);
      geo2.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
      geo2.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
      geo2.computeVertexNormals();
      const m = new THREE.Mesh(geo2, pkMat);
      m.position.set(px, baseY + ph / 2 - 0.4, pz);
      m.rotation.y = rng() * Math.PI;
      m.castShadow = true;
      m.name = 'city-peak';   // 同上：换装后由 world.js 隐藏（雪峰已包含在烘焙地面里）
      group.add(m);
      peakMeshes.push(m);
      peaksOut.push({ x: px, z: pz, r: pr });
    }
  }

  /* ---- 河流（贴地 + 台级瀑布）与湖 ---- */
  const rivers = F.features.rivers;
  if (rivers.length) {
    const watMat = new THREE.MeshStandardMaterial({ color: 0x5fb6ef, transparent: true, opacity: 0.92, roughness: 0.18, metalness: 0.05 });
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.85, roughness: 0.4 });
    for (const R of rivers) {
      const strip = (extraW, yOff) => {           // 沿河采样生成三角带；出界段断开
        const p2 = [], i2 = [];
        let vi = 0, prev = null;
        for (const s of R.pts) {
          const p = s.p, w = s.w + extraW;
          // 河面只在轮廓内铺：长条形城市按统一 R 换算会整条飘到城外/海面上
          if (!inPoly(p[0], p[1])) { prev = null; continue; }
          const y = heightAtLocal(p[0], p[1]) + yOff;
          const nx2 = -s.tan[1], nz2 = s.tan[0];   // 河面法线（垂直于流向）
          const l = [p[0] + nx2 * w, y, p[1] + nz2 * w], r = [p[0] - nx2 * w, y, p[1] - nz2 * w];
          if (prev) {
            if (prev.y - y > F.step * 0.6) {       // 台地落差 → 瀑布立面
              p2.push(prev.l[0], prev.l[1], prev.l[2], prev.r[0], prev.r[1], prev.r[2], r[0], prev.y, r[2], l[0], prev.y, l[2]);
              i2.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
            }
            p2.push(prev.l[0], prev.l[1], prev.l[2], prev.r[0], prev.r[1], prev.r[2], r[0], r[1], r[2], l[0], l[1], l[2]);
            i2.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
          }
          prev = { l, r, y };
        }
        if (!i2.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
        g.setIndex(i2); g.computeVertexNormals();
        return g;
      };
      const gWater = strip(0, 0.10);
      if (gWater) group.add(new THREE.Mesh(gWater, watMat));
      const gFoam = strip(0.35, -0.06);            // 白色河岸描边
      if (gFoam) group.add(new THREE.Mesh(gFoam, foamMat));
    }
    // 山前主瀑布（沿主河找最大落差；只认轮廓内的河段，否则瀑布会挂在城外的岩裙上）
    const R0 = rivers[0];
    let best = null;
    for (let i = 1; i < R0.pts.length; i++) {
      const p0 = R0.pts[i - 1].p, p1 = R0.pts[i].p;
      if (!inPoly(p0[0], p0[1]) || !inPoly(p1[0], p1[1])) continue;
      const a = heightAtLocal(p0[0], p0[1]) + 0.1, b = heightAtLocal(p1[0], p1[1]) + 0.1;
      if (!best || a - b > best.drop) best = { p: p1, drop: a - b, y: a, w: R0.pts[i].w };
    }
    if (best && best.drop > 1.0) {
      const cv2 = document.createElement('canvas'); cv2.width = 64; cv2.height = 128;
      const c2 = cv2.getContext('2d');
      const grd = c2.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, 'rgba(220,242,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0.55)');
      c2.fillStyle = grd; c2.fillRect(0, 0, 64, 128);
      c2.fillStyle = 'rgba(255,255,255,0.85)';
      for (let x = 4; x < 64; x += 12) c2.fillRect(x, 0, 3, 128);
      const tex = new THREE.CanvasTexture(cv2); tex.colorSpace = THREE.SRGBColorSpace;
      const fh = best.drop + 0.8;
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(best.w * 2 + 1.6, fh),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      fall.position.set(best.p[0], best.y - fh / 2 + 0.3, best.p[1]);
      fall.rotation.y = 0;
      group.add(fall);
      const mistTex = (() => {
        const mcv = document.createElement('canvas'); mcv.width = mcv.height = 128;
        const mc = mcv.getContext('2d');
        const mg = mc.createRadialGradient(64, 64, 4, 64, 64, 62);
        mg.addColorStop(0, 'rgba(255,255,255,1)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
        mc.fillStyle = mg; mc.fillRect(0, 0, 128, 128);
        const mt = new THREE.CanvasTexture(mcv); mt.colorSpace = THREE.SRGBColorSpace; return mt;
      })();
      const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: 0.75, depthWrite: false }));
      mist.position.set(best.p[0], best.y - best.drop + 0.4, best.p[1]);
      mist.scale.set(4.5, 2.6, 1);
      group.add(mist);
    }
  }
  if (F.features.lakes.length) {
    const watMat = new THREE.MeshStandardMaterial({ color: 0x5fb6ef, transparent: true, opacity: 0.92, roughness: 0.18, metalness: 0.05 });
    for (const L of F.features.lakes) {
      const [lx, lz] = L.at;
      if (!inPoly(lx, lz) || dEdge(lx, lz) < 1.0) { console.warn('[terrain] 湖心在轮廓外，已跳过:', L.at); continue; }
      const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), watMat);
      lake.scale.set(L.rx, L.rz, 1); lake.rotation.x = -Math.PI / 2;
      lake.position.set(lx, heightAtLocal(lx, lz) + 0.06, lz);
      group.add(lake);
    }
  }

  return {
    group,
    peaks: peaksOut,
    peakMeshes,     // 换装烘焙地面时要隐藏的两类（见 js/world.js 的 ground-slot 与 js/assets.js）
    field: F,
    groundMesh: mesh,
    heightAtLocal,                                    // 局部坐标（相对岛心）
    heightAtWorld: (wx, wz) => heightAtLocal(wx, wz), // world.js 负责换成世界坐标包装
  };
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1))); return t * t * (3 - 2 * t); };
const mulberry32 = a => function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
