// 城市微缩分层地形引擎（通用模块，数据驱动）
// 用法：createCityTerrain({ pts, cfg }) → { group, heightAtLocal, peaks }
//   pts：城市轮廓多边形（世界局部坐标，相对岛心，与 isl.shape 同一份）
//   cfg：data/cities/<id>/terrain.json 配置（坐标为归一化值 ×R 生效，R=轮廓半宽；
//        高度/宽度类参数为米——与玩家/城墙同一尺度）
// 设计约定：
//   - 轮廓边缘 edgeFlat 带内压平为 y=0（城墙/立牌/蛋的既有摆放与碰撞逻辑不受影响）
//   - 高度按 step 台地量化（flatShading 刻面 = 微缩手办感），色带用平滑高度取等高线
//   - 不含城墙/岩裙/云海/地标——那些由 world.js 既有系统负责，本模块只做"地面+山+水"
import * as THREE from 'three';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const mulberry32 = a => function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export function createCityTerrain({ pts, cfg }) {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const W = maxX - minX, H = maxZ - minZ;
  const R = W / 2;                                  // 归一化坐标缩放系数
  const N = (v) => v * R;                           // 归一化长度 → 世界长度
  const P2 = (p) => [N(p[0]), N(p[1])];             // 归一化点 → 世界点

  const group = new THREE.Group();
  const rng = mulberry32(cfg.seed ?? 42);

  /* ---- 轮廓工具 ---- */
  const inPoly = (x, z) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  };
  const ring = (() => {                              // 等距重采样（边缘距离/岩裙用）
    const acc = [0]; let L = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]); acc.push(L);
    }
    const M = 340, out = [];
    for (let k = 0; k < M; k++) {
      const d = k / M * L; let i = acc.findIndex(v => v >= d); if (i <= 0) i = 1;
      const t = (d - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
      const a = pts[i - 1], b = pts[i % pts.length];
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return out;
  })();
  const dEdge = (x, z) => {
    let m = Infinity;
    for (const p of ring) { const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < m) m = d; }
    return Math.sqrt(m);
  };

  /* ---- 高度场 ---- */
  const step = cfg.step ?? 0.9;
  const amp = cfg.amp ?? 7.5;
  const MNT = cfg.mountain ? { c: P2(cfg.mountain.center), near: N(cfg.mountain.near), far: N(cfg.mountain.far), pow: cfg.mountain.pow ?? 1.5 } : null;
  const HIL = cfg.hill ? { c: P2(cfg.hill.center), near: N(cfg.hill.near), far: N(cfg.hill.far), pow: cfg.hill.pow ?? 1.5, amp: cfg.hill.amp ?? 2.4 } : null;
  const PLZ = cfg.plaza ? { c: P2(cfg.plaza.center), inner: N(cfg.plaza.inner), outer: N(cfg.plaza.outer), flat: cfg.plaza.flat ?? 0.9 } : null;
  const eFlat = cfg.edgeFlat ?? [3, 10];
  const noiseAmp = cfg.noise ?? 0.15;

  const n2 = (x, z) => Math.sin(x * 0.131 + 1.7) * Math.cos(z * 0.117 + 0.6)
    + 0.6 * Math.sin(x * 0.053 - z * 0.089 + 3.1)
    + 0.4 * Math.cos(x * 0.071 + z * 0.047);
  const hRaw = (x, z) => {
    let h = 0;
    if (MNT) {
      const mM = 1 - smoothstep(MNT.near, MNT.far, Math.hypot(x - MNT.c[0], z - MNT.c[1]));
      h += amp * Math.pow(mM, MNT.pow);
      h += n2(x, z) * (noiseAmp + 1.05 * mM);
    }
    if (HIL) {
      const eM = 1 - smoothstep(HIL.near, HIL.far, Math.hypot(x - HIL.c[0], z - HIL.c[1]));
      h += HIL.amp * Math.pow(eM, HIL.pow);
    }
    if (PLZ) h *= 1 - PLZ.flat * (1 - smoothstep(PLZ.inner, PLZ.outer, Math.hypot(x - PLZ.c[0], z - PLZ.c[1])));
    h *= smoothstep(eFlat[0], eFlat[1], dEdge(x, z));
    return Math.max(0, h);
  };
  const quant = h => Math.floor(h / step + 1e-4) * step;
  const terrainY = (x, z) => quant(hRaw(x, z));

  /* ---- 分区 ---- */
  const TER = cfg.terrace ? { c: P2(cfg.terrace.center), rx: N(cfg.terrace.rx), rz: N(cfg.terrace.rz), cell: cfg.terrace.cell ?? 5 } : null;
  const FRM = cfg.farm ? { c: P2(cfg.farm.center), r0: N(cfg.farm.r0), r1: N(cfg.farm.r1) } : null;
  const CL = cfg.colors ?? {};
  const greens = CL.greens ?? [[0.49, 0.78, 0.47], [0.44, 0.72, 0.42], [0.38, 0.65, 0.37], [0.31, 0.56, 0.31], [0.26, 0.47, 0.27], [0.22, 0.40, 0.24]];
  const terraceMask = (x, z) => {
    if (!TER) return 0;
    const nx = (x - TER.c[0]) / TER.rx, nz = (z - TER.c[1]) / TER.rz;
    return 1 - smoothstep(0.7, 1.0, Math.max(Math.abs(nx), Math.abs(nz)));
  };
  const farmMask = (x, z) => FRM ? 1 - smoothstep(FRM.r0, FRM.r1, Math.hypot(x - FRM.c[0], z - FRM.c[1])) : 0;
  const snowRange = cfg.snow ?? [5.2, 6.6];
  const colorCell = cfg.colorCell ?? 2.5;
  const jitter = CL.jitter ?? 0.05;

  function zoneColor(x, z, hSm, band, out) {
    const sx = Math.round(x / colorCell) * colorCell, sz = Math.round(z / colorCell) * colorCell;
    let r, g, b;
    const gi = Math.min(band, greens.length - 1);
    [r, g, b] = greens[gi];
    const tm = terraceMask(sx, sz);
    if (tm > 0.15 && band >= 1 && CL.terraceGold) {
      const gold = CL.terraceGold[(Math.floor((sx * 0.7 + sz * 0.7) / (TER ? TER.cell : 5)) % 2 + 2) % 2 ? 1 : 0];
      r += (gold[0] - r) * tm; g += (gold[1] - g) * tm; b += (gold[2] - b) * tm;
    }
    const fm = farmMask(sx, sz);
    if (fm > 0.1 && CL.farmStripe) {
      const s = (Math.sin((sx + sz) * 0.55) > 0) ? CL.farmStripe[0] : CL.farmStripe[1];
      r += (s[0] - r) * fm; g += (s[1] - g) * fm; b += (s[2] - b) * fm;
    }
    const st = smoothstep(snowRange[0], snowRange[1], quant(hSm));
    if (st > 0 && CL.snow) { r += (CL.snow[0] - r) * st; g += (CL.snow[1] - g) * st; b += (CL.snow[2] - b) * st; }
    if (PLZ) {
      const dp = Math.hypot(sx - PLZ.c[0], sz - PLZ.c[1]);
      if (dp < PLZ.inner + 1 && CL.plaza) {
        const m = 1 - smoothstep(PLZ.inner, PLZ.inner + 2.5, dp);
        r += (CL.plaza[0] - r) * m; g += (CL.plaza[1] - g) * m; b += (CL.plaza[2] - b) * m;
      }
    }
    const j = 1 - jitter / 2 + jitter * fract(Math.sin(sx * 127.1 + sz * 311.7) * 43758.5453);
    out[0] = r * j; out[1] = g * j; out[2] = b * j;
  }

  /* ---- 网格：索引化几何（共享顶点 + 统一绕序，杜绝缺面） ---- */
  const gsz = 1.5, nx = Math.ceil(W / gsz), nz = Math.ceil(H / gsz);
  const hs = [];
  for (let j = 0; j <= nz; j++) {
    hs[j] = [];
    for (let i = 0; i <= nx; i++) {
      const x = minX + i * gsz, z = minZ + j * gsz;
      hs[j][i] = hRaw(x, z);
    }
  }
  const hsSm = [];                                   // 颜色等高线用平滑高度
  for (let j = 0; j <= nz; j++) {
    hsSm[j] = [];
    for (let i = 0; i <= nx; i++) {
      let sum = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const jj = j + dj, ii = i + di;
        if (jj < 0 || jj > nz || ii < 0 || ii > nx) continue;
        sum += hs[jj][ii]; n++;
      }
      hsSm[j][i] = sum / n;
    }
  }
  const qy = [];                                     // 渲染/寻高共用的量化高度
  for (let j = 0; j <= nz; j++) { qy[j] = []; for (let i = 0; i <= nx; i++) qy[j][i] = quant(hs[j][i]); }

  const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const pos = [], col = [], cc = [0, 0, 0];
  const getV = (i, j) => {
    const id = j * (nx + 1) + i;
    if (vid[id] !== -1) return vid[id];
    const x = minX + i * gsz, z = minZ + j * gsz;
    const hSm = hsSm[j][i], band = Math.floor(hSm / step + 1e-4);
    vid[id] = pos.length / 3;
    pos.push(x, qy[j][i], z);
    zoneColor(x, z, hSm, band, cc);
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
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.94, metalness: 0, side: THREE.DoubleSide,
  }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  group.add(mesh);

  /* ---- 寻高：与渲染网格一致的精确高度（格内三角形重心插值） ---- */
  const heightAtLocal = (lx, lz) => {
    if (lx < minX || lx > maxX || lz < minZ || lz > maxZ) return 0;
    const fi = Math.min(nx - 1, Math.max(0, Math.floor((lx - minX) / gsz)));
    const fj = Math.min(nz - 1, Math.max(0, Math.floor((lz - minZ) / gsz)));
    const tx = (lx - (minX + fi * gsz)) / gsz, tz = (lz - (minZ + fj * gsz)) / gsz;
    const y00 = qy[fj][fi], y10 = qy[fj][fi + 1], y01 = qy[fj + 1][fi], y11 = qy[fj + 1][fi + 1];
    return (tx + tz <= 1)
      ? y00 * (1 - tz) + y01 * (tz - tx) + y11 * tx
      : y00 * (1 - tx) + y10 * (tx - tz) + y11 * tz;
  };

  /* ---- 雪山峰 ---- */
  const peaksOut = [];
  if (Array.isArray(cfg.peaks)) {
    const pkMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    for (const def of cfg.peaks) {
      const px = N(def[0]), pz = N(def[1]), ph = def[2], pr = def[3];
      if (!inPoly(px, pz) || dEdge(px, pz) < 6) { console.warn('[terrain] 雪峰在轮廓外，已跳过:', def); continue; }
      const geo2 = new THREE.ConeGeometry(pr, ph, 6);
      const pa = geo2.attributes.position, colA = [];
      const baseY = terrainY(px, pz);
      for (let i = 0; i < pa.count; i++) {
        const vy = pa.getY(i) + ph / 2;
        const sn = smoothstep(ph * 0.42, ph * 0.62, vy);
        const j = 0.95 + 0.1 * rng();
        colA.push((0.26 + (0.95 - 0.26) * sn) * j, (0.22 + (0.97 - 0.22) * sn) * j, (0.20 + (1.0 - 0.20) * sn) * j);
      }
      geo2.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
      const m = new THREE.Mesh(geo2, pkMat);
      m.position.set(px, baseY + ph / 2 - 0.4, pz);
      m.rotation.y = rng() * Math.PI;
      m.castShadow = true;
      group.add(m);
      peaksOut.push({ x: px, z: pz, r: pr });
    }
  }

  /* ---- 河流（贴地 + 台级瀑布）与湖 ---- */
  const riverCurves = [];
  if (Array.isArray(cfg.rivers)) {
    const watMat = new THREE.MeshStandardMaterial({ color: 0x5fb6ef, transparent: true, opacity: 0.92, roughness: 0.18, metalness: 0.05 });
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.85, roughness: 0.4 });
    const riverW = cfg.riverW ?? 1.2;
    for (const wp of cfg.rivers) {
      const wpts = wp.map(p => P2(p));
      const curve = new THREE.CatmullRomCurve3(wpts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
      riverCurves.push(curve);
      const L = curve.getLength(), Nn = Math.max(40, Math.round(L / 1.2));
      const rPos = [], rIdx = [];
      let vi = 0, prev = null;
      for (let i = 0; i <= Nn; i++) {
        const t = i / Nn, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
        const nx2 = -tg.z, nz2 = tg.x, w = riverW * (0.75 + 0.5 * t);
        const y = heightAtLocal(p.x, p.z) + 0.10;
        const l = [p.x + nx2 * w, y, p.z + nz2 * w], r = [p.x - nx2 * w, y, p.z - nz2 * w];
        if (prev) {
          if (prev.y - y > step * 0.6) {            // 台地落差 → 瀑布立面
            rPos.push(prev.l[0], prev.l[1], prev.l[2], prev.r[0], prev.r[1], prev.r[2], r[0], prev.y, r[2], l[0], prev.y, l[2]);
            rIdx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
          }
          rPos.push(prev.l[0], prev.l[1], prev.l[2], prev.r[0], prev.r[1], prev.r[2], r[0], r[1], r[2], l[0], l[1], l[2]);
          rIdx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
        }
        prev = { l, r, y };
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
      rg.setIndex(rIdx); rg.computeVertexNormals();
      group.add(new THREE.Mesh(rg, watMat));
      // 白色河岸描边
      const fPos = [], fIdx = []; vi = 0; prev = null;
      for (let i = 0; i <= Nn; i++) {
        const t = i / Nn, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
        const nx2 = -tg.z, nz2 = tg.x, w = riverW * (0.75 + 0.5 * t) + 0.35;
        const y = heightAtLocal(p.x, p.z) - 0.06;
        const l = [p.x + nx2 * w, y, p.z + nz2 * w], r = [p.x - nx2 * w, y, p.z - nz2 * w];
        if (prev) {
          fPos.push(prev.l[0], prev.l[1], prev.l[2], prev.r[0], prev.r[1], prev.r[2], r[0], r[1], r[2], l[0], l[1], l[2]);
          fIdx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
        }
        prev = { l, r, y };
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
      fg.setIndex(fIdx); fg.computeVertexNormals();
      group.add(new THREE.Mesh(fg, foamMat));
    }
    // 山前主瀑布（沿主河找最大落差）
    if (cfg.rivers.length) {
      const curve = riverCurves[0], L = curve.getLength();
      let best = null;
      for (let i = 1; i <= 60; i++) {
        const p0 = curve.getPointAt((i - 1) / 60), p1 = curve.getPointAt(i / 60);
        const a = heightAtLocal(p0.x, p0.z) + 0.1, b = heightAtLocal(p1.x, p1.z) + 0.1;
        if (!best || a - b > best.drop) best = { t: i / 60, drop: a - b, y: a };
      }
      if (best && best.drop > 1.0) {
        const p = curve.getPointAt(best.t), tg = curve.getTangentAt(best.t);
        const cv2 = document.createElement('canvas'); cv2.width = 64; cv2.height = 128;
        const c2 = cv2.getContext('2d');
        const grd = c2.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0, 'rgba(220,242,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0.55)');
        c2.fillStyle = grd; c2.fillRect(0, 0, 64, 128);
        c2.fillStyle = 'rgba(255,255,255,0.85)';
        for (let x = 4; x < 64; x += 12) c2.fillRect(x, 0, 3, 128);
        const tex = new THREE.CanvasTexture(cv2); tex.colorSpace = THREE.SRGBColorSpace;
        const fh = best.drop + 0.8;
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(riverW * 2 + 1.6, fh),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        fall.position.set(p.x - tg.x * 0.4, best.y - fh / 2 + 0.3, p.z - tg.z * 0.4);
        fall.rotation.y = Math.atan2(tg.x, tg.z);
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
        mist.position.set(p.x, best.y - best.drop + 0.4, p.z);
        mist.scale.set(4.5, 2.6, 1);
        group.add(mist);
      }
    }
  }
  if (cfg.lake) {
    const at = P2(cfg.lake.at);
    const watMat = new THREE.MeshStandardMaterial({ color: 0x5fb6ef, transparent: true, opacity: 0.92, roughness: 0.18, metalness: 0.05 });
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), watMat);
    lake.scale.set(cfg.lake.rx, cfg.lake.rz, 1); lake.rotation.x = -Math.PI / 2;
    lake.position.set(at[0], heightAtLocal(at[0], at[1]) + 0.06, at[1]);
    group.add(lake);
  }

  return {
    group,
    peaks: peaksOut,
    heightAtLocal,                                    // 局部坐标（相对岛心）
    heightAtWorld: (wx, wz) => heightAtLocal(wx, wz), // world.js 负责换成世界坐标包装
  };
}
