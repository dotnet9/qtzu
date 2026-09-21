// 零依赖 PNG 解码 + 图像度量（截图"看"不了浏览器时的量化眼睛）
//
//   node scripts/look-diff.mjs --a <旧图> --b <新图> [--bands 3]
//
// 为什么需要它：改动画面的工作必须有"能不能看出来"的判据。浏览器面板不可用时，
// 就用像素统计代替肉眼：分带给出 亮度 / 饱和 / **细节能量（拉普拉斯高频能量）**，
// 细节能量上升 = 表面真的多了材质（贴图/法线在起作用），而不是只改了参数。
//
// 解码只认 Chrome 截图产出的 8bit、非隔行、RGB/RGBA（与 scripts/check-render.mjs 同口径）。
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG：' + file);
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9];
      if (data[12] !== 0) throw new Error('不支持隔行 PNG');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6)) throw new Error(`只支持 8bit RGB/RGBA（本图 depth=${depth} type=${ctype}）`);
  const bpp = ctype === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      if (ft === 1) line[i] = (line[i] + a) & 255;
      else if (ft === 2) line[i] = (line[i] + b) & 255;
      else if (ft === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < w; x++) {
      const s0 = x * bpp, d0 = (y * w + x) * 4;
      out[d0] = line[s0]; out[d0 + 1] = line[s0 + 1]; out[d0 + 2] = line[s0 + 2];
      out[d0 + 3] = bpp === 4 ? line[s0 + 3] : 255;
    }
    prev = line;
  }
  return { w, h, data: out };
}

const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

// 细节能量：拉普拉斯的平均绝对值（只看绿色通道足够代表结构）
export function detailEnergy(img, y0, y1) {
  const { w, data } = img;
  let sum = 0, n = 0;
  for (let y = Math.max(1, y0); y < Math.min(img.h - 1, y1); y++) {
    for (let x = 1; x < w - 1; x++) {
      const g = (xx, yy) => data[(yy * w + xx) * 4 + 1];
      const l = 4 * g(x, y) - g(x - 1, y) - g(x + 1, y) - g(x, y - 1) - g(x, y + 1);
      sum += Math.abs(l); n++;
    }
  }
  return n ? sum / n : 0;
}

export function meanSat(img, y0, y1) {
  const { w, data } = img;
  let sum = 0, n = 0;
  for (let y = y0; y < Math.min(img.h, y1); y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const mx = Math.max(data[i], data[i + 1], data[i + 2]);
      sum += mx ? (mx - Math.min(data[i], data[i + 1], data[i + 2])) / mx : 0; n++;
    }
  }
  return n ? sum / n : 0;
}

export function meanLum(img, y0, y1) {
  const { w, data } = img;
  let sum = 0, n = 0;
  for (let y = y0; y < Math.min(img.h, y1); y++) {
    for (let x = 0; x < w; x++) { sum += lum(data, (y * w + x) * 4); n++; }
  }
  return n ? sum / n / 255 : 0;
}

// 硬边计数：相邻像素色差 > 阈值的像素占比。色带硬边界（直角色块）会显著抬高这个数，
// 它是"边界柔化有没有生效"最直接的量化判据（比拉普拉斯更针对"色带台阶"）。
export function hardEdgeRatio(img, y0, y1, thr = 22) {
  const { w, data } = img;
  let n = 0, hit = 0;
  for (let y = y0; y < Math.min(img.h, y1); y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4, j = (y * w + x - 1) * 4;
      const d = Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
      n++; if (d > thr) hit++;
    }
  }
  return n ? hit / n : 0;
}

// 粗略字符画（只看亮度轮廓：判断"地面/主体/天空"的分层是否正确）
export function ascii(img, cols = 76, rows = 22) {
  const lines = [];
  const ramp = ' .:-=+*#%@';
  for (let ry = 0; ry < rows; ry++) {
    let line = '';
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor(rx * img.w / cols), x1 = Math.max(x0 + 1, Math.floor((rx + 1) * img.w / cols));
      const y0 = Math.floor(ry * img.h / rows), y1 = Math.max(y0 + 1, Math.floor((ry + 1) * img.h / rows));
      let s = 0, n = 0;
      for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { s += lum(img.data, (y * img.w + x) * 4); n++; }
      line += ramp[Math.min(9, Math.floor((s / n) / 255 * 10))];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

if (import.meta.filename === process.argv[1]) {
  const optOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const a = readPng(optOf('--a')), b = readPng(optOf('--b'));
  const bands = Number(optOf('--bands') || 3);
  console.log(`A=${optOf('--a')}  B=${optOf('--b')}  ${a.w}x${a.h}`);
  const names = ['上（远/天）', '中', '下（近/地面）'];
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor(a.h * i / bands), y1 = Math.floor(a.h * (i + 1) / bands);
    const da = detailEnergy(a, y0, y1), db = detailEnergy(b, y0, y1);
    const la = meanLum(a, y0, y1), lb = meanLum(b, y0, y1);
    const sa = meanSat(a, y0, y1), sb = meanSat(b, y0, y1);
    const ea = hardEdgeRatio(a, y0, y1), eb = hardEdgeRatio(b, y0, y1);
    const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
    console.log(`带${i + 1} ${(names[i] || '').padEnd(10)} 细节 ${da.toFixed(1)} → ${db.toFixed(1)} (${pct((db - da) / (da || 1))})`
      + `  亮度 ${la.toFixed(3)} → ${lb.toFixed(3)} (${pct((lb - la) / (la || 1))})`
      + `  饱和 ${sa.toFixed(3)} → ${sb.toFixed(3)} (${pct((sb - sa) / (sa || 1))})`
      + `  硬边 ${(ea * 100).toFixed(2)}% → ${(eb * 100).toFixed(2)}% (${pct((eb - ea) / (ea || 1))})`);
  }
  if (process.argv.includes('--ascii')) {
    console.log('\nA 的明暗轮廓：\n' + ascii(a));
    console.log('\nB 的明暗轮廓：\n' + ascii(b));
  }
}
