// 可平铺的程序化纹理库（runtime canvas 生成，零下载、可种子化）
//
// 为什么走 canvas 而不是 PNG 文件：项目现在一处 TextureLoader 都没有，贴图全在运行时画
// （地面/天空/牌匾/瀑布都是 CanvasTexture）。这样离线优先、无缓存风险、无构建步骤，
// 也便于"每城一张"按城市 seed 变化。
//
// 两条约定（上次"地图发白"就吃过色域的亏，这里写死在返回结构上）：
//   1) albedo（map / roughnessMap 之外的彩色图）→ SRGBColorSpace
//   2) normalMap / roughnessMap → NoColorSpace
//   3) albedo 一律做**接近中性**的细节图（多为 0.72~1.0 的灰度 + 轻微色相抖动）：
//      材质是 map × vertexColors，色相交给顶点色（"写实纹理 + 游戏配色"），
//      albedo 一旦自己带饱和色，与顶点色相乘会过度饱和
import * as THREE from 'three';

const cache = new Map();

/* ---------------- 基础工具 ---------------- */

// 与 js/terrain.ts 同族的确定性 PRNG（同一 seed 每次生成同一张图）
function prng(seed) {
  let a = (seed | 0) || 1;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function canvasOf(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  return cv;
}

// 平铺安全的绘制：任何图元都在 (x±size, y±size) 的 9 个位置各画一遍，
// 保证跨接缝的笔触在另一侧接得上（不然地面平铺会出现明显的网格接缝）
function wrapDraw(c, size, draw) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy);
}

// 高度图 → 法线图（Sobel 差分，采样按 size 取模 = 平铺安全）
function normalFromHeight(hcv, strength = 1.0, size = hcv.width) {
  const hc = hcv.getContext('2d').getImageData(0, 0, size, size).data;
  const out = canvasOf(size);
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  const at = (x, y) => hc[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // 切线空间法线：(-dx, -dy, 1) 归一化后映射到 [0,1]
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function mkTex(cv, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;               // 实际上限由 js/game.js 的 _initScene 统一收口
  t.needsUpdate = true;
  return t;
}

const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

/* ---------------- 各类地面纹理 ---------------- */

// 草地：短笔触 + 斑驳 + 少量草籽点。高度图与 albedo 用同一批笔触，法线才对得上
function grassCanvases(size, seed) {
  const alb = canvasOf(size), hgt = canvasOf(size);
  const a = alb.getContext('2d'), h = hgt.getContext('2d');
  const r = prng(seed);
  a.fillStyle = '#E8EEE4'; a.fillRect(0, 0, size, size);
  h.fillStyle = '#808080'; h.fillRect(0, 0, size, size);
  const strokes = Math.round(size * size / 90);
  for (let i = 0; i < strokes; i++) {
    const x = r() * size, y = r() * size, len = 2 + r() * 6, ang = r() * Math.PI * 2;
    const lum = 0.74 + r() * 0.26;
    const g = Math.round(lum * 255);
    wrapDraw(a, size, (dx, dy) => {
      a.strokeStyle = `rgb(${Math.round(g * 0.94)},${g},${Math.round(g * 0.88)})`;
      a.lineWidth = 0.8 + r() * 0.9;
      a.beginPath(); a.moveTo(x + dx, y + dy);
      a.lineTo(x + dx + Math.cos(ang) * len, y + dy + Math.sin(ang) * len); a.stroke();
    });
    wrapDraw(h, size, (dx, dy) => {          // 高度：亮 = 高
      h.strokeStyle = `rgb(${Math.round(120 + lum * 90)},${Math.round(120 + lum * 90)},${Math.round(120 + lum * 90)})`;
      h.lineWidth = 1.1; h.beginPath(); h.moveTo(x + dx, y + dy);
      h.lineTo(x + dx + Math.cos(ang) * len, y + dy + Math.sin(ang) * len); h.stroke();
    });
  }
  // 斑驳（大块明暗）：让远处不是均匀一片
  for (let i = 0; i < size / 6; i++) {
    const x = r() * size, y = r() * size, rad = 6 + r() * 22, up = r() > 0.5;
    const col = up ? 'rgba(255,255,255,0.10)' : 'rgba(90,110,80,0.12)';
    wrapDraw(a, size, (dx, dy) => { a.fillStyle = col; a.beginPath(); a.arc(x + dx, y + dy, rad, 0, Math.PI * 2); a.fill(); });
  }
  return { alb, hgt };
}

export function grassDetail(size = 256, seed = 11) {
  return cached(`grass:${size}:${seed}`, () => {
    const { alb, hgt } = grassCanvases(size, seed);
    return { map: mkTex(alb, true), normalMap: mkTex(normalFromHeight(hgt, 2.2, size), false), repeat: 1 };
  });
}

// 泥土/砂砾：细颗粒 + 小石子
export function soilDetail(size = 256, seed = 23) {
  return cached(`soil:${size}:${seed}`, () => {
    const alb = canvasOf(size), hgt = canvasOf(size);
    const a = alb.getContext('2d'), h = hgt.getContext('2d');
    const r = prng(seed);
    a.fillStyle = '#E6DCCB'; a.fillRect(0, 0, size, size);
    h.fillStyle = '#8C8C8C'; h.fillRect(0, 0, size, size);
    const n = Math.round(size * size / 26);
    for (let i = 0; i < n; i++) {
      const x = r() * size, y = r() * size, rad = 0.6 + r() * 2.4, lum = 0.7 + r() * 0.3;
      const g = Math.round(lum * 255);
      wrapDraw(a, size, (dx, dy) => { a.fillStyle = `rgba(${g},${Math.round(g * 0.96)},${Math.round(g * 0.88)},0.9)`; a.beginPath(); a.arc(x + dx, y + dy, rad, 0, Math.PI * 2); a.fill(); });
      wrapDraw(h, size, (dx, dy) => { h.fillStyle = `rgba(${Math.round(lum * 255)},${Math.round(lum * 255)},${Math.round(lum * 255)},1)`; h.beginPath(); h.arc(x + dx, y + dy, rad, 0, Math.PI * 2); h.fill(); });
    }
    return { map: mkTex(alb, true), normalMap: mkTex(normalFromHeight(hgt, 1.6, size), false), repeat: 1 };
  });
}

// 石材铺装：不规则石板 + 深缝（广场/主街用）
export function pavingDetail(size = 256, seed = 37) {
  return cached(`paving:${size}:${seed}`, () => {
    const alb = canvasOf(size), hgt = canvasOf(size);
    const a = alb.getContext('2d'), h = hgt.getContext('2d');
    const r = prng(seed);
    a.fillStyle = '#C9C4BB'; a.fillRect(0, 0, size, size);   // 缝的颜色
    h.fillStyle = '#4A4A4A'; h.fillRect(0, 0, size, size);
    const cell = size / 5;
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        const x = gx * cell + 1.5 + r() * 2, y = gy * cell + 1.5 + r() * 2;
        const w = cell - 3 - r() * 2.5, hh = cell - 3 - r() * 2.5;
        const lum = 0.82 + r() * 0.18, g = Math.round(lum * 255);
        wrapDraw(a, size, (dx, dy) => {
          a.fillStyle = `rgb(${g},${Math.round(g * 0.99)},${Math.round(g * 0.95)})`;
          a.fillRect(x + dx, y + dy, w, hh);
        });
        wrapDraw(h, size, (dx, dy) => {
          h.fillStyle = `rgb(${Math.round(lum * 210)},${Math.round(lum * 210)},${Math.round(lum * 210)})`;
          h.fillRect(x + dx, y + dy, w, hh);
        });
      }
    }
    return { map: mkTex(alb, true), normalMap: mkTex(normalFromHeight(hgt, 2.6, size), false), repeat: 1 };
  });
}

// 砖墙：层砖 + 勾缝 + 每块轻微色差（城墙/烽火台用）
export function brickDetail(size = 256, seed = 53) {
  return cached(`brick:${size}:${seed}`, () => {
    const alb = canvasOf(size), hgt = canvasOf(size);
    const a = alb.getContext('2d'), h = hgt.getContext('2d');
    const r = prng(seed);
    a.fillStyle = '#B9B3AA'; a.fillRect(0, 0, size, size);   // 勾缝
    h.fillStyle = '#3C3C3C'; h.fillRect(0, 0, size, size);
    const rows = 8, bh = size / rows, bw = size / 4;
    for (let row = 0; row < rows; row++) {
      const off = (row % 2) * bw * 0.5;
      for (let col = -1; col < 5; col++) {
        const x = col * bw + off + 1.5, y = row * bh + 1.5;
        const w = bw - 3, hh = bh - 3;
        const lum = 0.78 + r() * 0.22, g = Math.round(lum * 255);
        wrapDraw(a, size, (dx, dy) => {
          a.fillStyle = `rgb(${g},${Math.round(g * 0.97)},${Math.round(g * 0.92)})`;
          a.fillRect(x + dx, y + dy, w, hh);
        });
        wrapDraw(h, size, (dx, dy) => {
          h.fillStyle = `rgb(${Math.round(lum * 200)},${Math.round(lum * 200)},${Math.round(lum * 200)})`;
          h.fillRect(x + dx, y + dy, w, hh);
        });
      }
    }
    return { map: mkTex(alb, true), normalMap: mkTex(normalFromHeight(hgt, 2.4, size), false), repeat: 1 };
  });
}

// 岩体：横向层理 + 裂隙（雪峰下半段、悬浮岛岩裙用）
export function rockDetail(size = 256, seed = 71) {
  return cached(`rock:${size}:${seed}`, () => {
    const alb = canvasOf(size), hgt = canvasOf(size);
    const a = alb.getContext('2d'), h = hgt.getContext('2d');
    const r = prng(seed);
    a.fillStyle = '#D8D2C8'; a.fillRect(0, 0, size, size);
    h.fillStyle = '#909090'; h.fillRect(0, 0, size, size);
    // 层理：水平方向的明暗带（高度上略有起伏，像沉积岩）
    for (let i = 0; i < 26; i++) {
      const y0 = r() * size, th = 2 + r() * 7, lum = 0.72 + r() * 0.28;
      const g = Math.round(lum * 255);
      wrapDraw(a, size, (dx, dy) => {
        a.fillStyle = `rgba(${g},${Math.round(g * 0.97)},${Math.round(g * 0.9)},0.55)`;
        a.beginPath();
        for (let x = 0; x <= size; x += 16) {
          const yy = y0 + Math.sin((x / size) * Math.PI * 2) * 3 + dy;
          if (x === 0) a.moveTo(x + dx, yy); else a.lineTo(x + dx, yy);
        }
        a.lineWidth = th; a.strokeStyle = a.fillStyle; a.stroke();
      });
      wrapDraw(h, size, (dx, dy) => {
        h.strokeStyle = `rgba(${g},${g},${g},0.8)`; h.lineWidth = th;
        h.beginPath();
        for (let x = 0; x <= size; x += 16) {
          const yy = y0 + Math.sin((x / size) * Math.PI * 2) * 3 + dy;
          if (x === 0) h.moveTo(x + dx, yy); else h.lineTo(x + dx, yy);
        }
        h.stroke();
      });
    }
    // 裂隙：几道近似竖直的深线
    for (let i = 0; i < 5; i++) {
      const x0 = r() * size;
      wrapDraw(a, size, (dx, dy) => {
        a.strokeStyle = 'rgba(96,90,82,0.55)'; a.lineWidth = 1 + r() * 1.4;
        a.beginPath();
        for (let y = 0; y <= size; y += 12) {
          const xx = x0 + Math.sin((y / size) * Math.PI * 2 + i) * 5;
          if (y === 0) a.moveTo(xx + dx, y + dy); else a.lineTo(xx + dx, y + dy);
        }
        a.stroke();
      });
    }
    return { map: mkTex(alb, true), normalMap: mkTex(normalFromHeight(hgt, 2.8, size), false), repeat: 1 };
  });
}

// 雪/冰面：细颗粒 + 微起伏（雪线以上）
export function snowDetail(size = 256, seed = 97) {
  return cached(`snow:${size}:${seed}`, () => {
    const alb = canvasOf(size), hgt = canvasOf(size);
    const a = alb.getContext('2d'), h = hgt.getContext('2d');
    const r = prng(seed);
    a.fillStyle = '#F6FAFF'; a.fillRect(0, 0, size, size);
    h.fillStyle = '#9A9A9A'; h.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size / 40; i++) {
      const x = r() * size, y = r() * size, rad = 0.8 + r() * 2.6, lum = 0.9 + r() * 0.1;
      const g = Math.round(lum * 255);
      wrapDraw(a, size, (dx, dy) => { a.fillStyle = `rgba(${g},${g},${Math.min(255, g + 4)},0.75)`; a.beginPath(); a.arc(x + dx, y + dy, rad, 0, Math.PI * 2); a.fill(); });
      wrapDraw(h, size, (dx, dy) => { h.fillStyle = `rgba(${Math.round(lum * 235)},${Math.round(lum * 235)},${Math.round(lum * 235)},0.8)`; h.beginPath(); h.arc(x + dx, y + dy, rad, 0, Math.PI * 2); h.fill(); });
    }
    return { map: mkTex(alb, true), normalMap: mkTex(normalFromHeight(hgt, 1.4, size), false), repeat: 1 };
  });
}

// 通用细节法线（没有明确分区的地方给地面补微起伏：只有法线，不占 albedo 槽）
export function grainNormal(size = 256, seed = 131) {
  return cached(`grain:${size}:${seed}`, () => {
    const hgt = canvasOf(size);
    const h = hgt.getContext('2d');
    const r = prng(seed);
    h.fillStyle = '#8C8C8C'; h.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size / 220; i++) {
      const x = r() * size, y = r() * size, rad = 1.5 + r() * 5, lum = r() * 0.5 + 0.6;
      wrapDraw(h, size, (dx, dy) => {
        const g = Math.round(lum * 255);
        h.fillStyle = `rgba(${g},${g},${g},0.5)`;
        h.beginPath(); h.arc(x + dx, y + dy, rad, 0, Math.PI * 2); h.fill();
      });
    }
    return { normalMap: mkTex(normalFromHeight(hgt, 1.1, size), false) };
  });
}

// 水面法线：两套不同频率的正弦叠加（运行时平移 UV 得到流动感）
export function waterNormal(size = 256, seed = 211) {
  return cached(`water:${size}:${seed}`, () => {
    const hgt = canvasOf(size);
    const h = hgt.getContext('2d');
    const img = h.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
        const wv = Math.sin(u * 3 + v * 1.7) * 0.5 + Math.sin(u * 5.3 - v * 2.9) * 0.3 + Math.sin(u * 11 + v * 7) * 0.12;
        const g = Math.round((wv * 0.5 + 0.5) * 255);
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
      }
    }
    h.putImageData(img, 0, 0);
    return { normalMap: mkTex(normalFromHeight(hgt, 1.5, size), false) };
  });
}

// 清缓存（换城重画/调试用）
export function clearTextureCache() { cache.clear(); }
