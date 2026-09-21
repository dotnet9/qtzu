// 给 img.mjs 加：PNG 编码 + 拼图 + 裁剪放大
//
//   node scripts/img.mjs --side A.png B.png --out C.png [--label 改造前,改造后] [--gap 12]
//   node scripts/img.mjs --zoom A.png --out B.png --box 0.25,0.45,0.9,1 --scale 2
//
// 用途：浏览器面板不可用时，把"同机位前后对比"合成**一张**图，你打开一个文件就能比；
// zoom 用于把地面纹理区域放大 2 倍，看清颗粒/法线细节。
// 编码是零依赖的最小实现（zlib deflate + CRC32，8bit RGB），Chrome/浏览器/看图软件都能开。
import fs from 'node:fs';
import zlib from 'node:zlib';

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function writePng(file, w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                                        // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

// 在 8 位字模表上画字（拼图要标注"哪边是改造前/后"；不引字体文件，够用）
const FONT = {
  a: ['01110', '10001', '11111', '10001', '10001'], b: ['11110', '10001', '11110', '10001', '11110'],
  c: ['01111', '10000', '10000', '10000', '01111'], d: ['11110', '10001', '10001', '10001', '11110'],
  e: ['11111', '10000', '11110', '10000', '11111'], f: ['11111', '10000', '11110', '10000', '10000'],
  g: ['01111', '10000', '10011', '10001', '01111'], h: ['10001', '10001', '11111', '10001', '10001'],
  i: ['11111', '00100', '00100', '00100', '11111'], j: ['00111', '00010', '00010', '10010', '01100'],
  k: ['10001', '10010', '11100', '10010', '10001'], l: ['10000', '10000', '10000', '10000', '11111'],
  m: ['10001', '11011', '10101', '10001', '10001'], n: ['10001', '11001', '10101', '10011', '10001'],
  o: ['01110', '10001', '10001', '10001', '01110'], p: ['11110', '10001', '11110', '10000', '10000'],
  q: ['01110', '10001', '10101', '10010', '01101'], r: ['11110', '10001', '11110', '10010', '10001'],
  s: ['01111', '10000', '01110', '00001', '11110'], t: ['11111', '00100', '00100', '00100', '00100'],
  u: ['10001', '10001', '10001', '10001', '01110'], v: ['10001', '10001', '10001', '01010', '00100'],
  w: ['10001', '10001', '10101', '11011', '10001'], x: ['10001', '01010', '00100', '01010', '10001'],
  y: ['10001', '01010', '00100', '00100', '00100'], z: ['11111', '00010', '00100', '01000', '11111'],
  0: ['01110', '10011', '10101', '11001', '01110'], 1: ['00100', '01100', '00100', '00100', '01110'],
  2: ['11110', '00001', '01110', '10000', '11111'], 3: ['11110', '00001', '01110', '00001', '11110'],
  4: ['10010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '11110'],
  6: ['01110', '10000', '11110', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000'],
  8: ['01110', '10001', '01110', '10001', '01110'], 9: ['01110', '10001', '01111', '00001', '01110'],
  '-': ['00000', '00000', '11111', '00000', '00000'], '.': ['00000', '00000', '00000', '00000', '00100'],
  ':': ['00100', '00000', '00000', '00100', '00000'], ' ': ['00000', '00000', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00100', '01000', '10000'], '+': ['00100', '00100', '11111', '00100', '00100'],
  '(': ['00010', '00100', '00100', '00100', '00010'], ')': ['01000', '00100', '00100', '00100', '01000'],
  '=': ['00000', '11111', '00000', '11111', '00000'],
};

function drawText(rgb, W, x0, y0, text, scale, color) {
  let x = x0;
  for (const chRaw of text.toLowerCase()) {
    const g = FONT[chRaw] || FONT[' '];
    for (let ry = 0; ry < 5; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        if (g[ry][rx] !== '1') continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = x + rx * scale + dx, py = y0 + ry * scale + dy;
            if (px < 0 || py < 0 || px >= W) continue;
            const k = (py * W + px) * 3;
            if (k + 2 < rgb.length) { rgb[k] = color[0]; rgb[k + 1] = color[1]; rgb[k + 2] = color[2]; }
          }
        }
      }
    }
    x += 6 * scale;
  }
}

// 左上角画一条底色 + 文字（写进 rgb 缓冲；供对比图标注"哪边是改造前/后"）
export function banner(rgb, W, H, text, scale = 3, ox = 0) {
  const sh = 6 * scale;
  for (let y = 0; y < sh && y < H; y++) {
    for (let x = ox; x < W; x++) { const k = (y * W + x) * 3; rgb[k] = 18; rgb[k + 1] = 18; rgb[k + 2] = 22; }
  }
  drawText(rgb, W, ox + 3, 3, text, scale, [245, 245, 245]);
  return sh;
}

// 把读到的图放大/裁剪
export function transform(img, box, scale) {
  const x0 = Math.floor((box ? box[0] : 0) * img.w), y0 = Math.floor((box ? box[1] : 0) * img.h);
  const x1 = Math.floor((box ? box[2] : 1) * img.w), y1 = Math.floor((box ? box[3] : 1) * img.h);
  const cw = x1 - x0, ch = y1 - y0;
  const W = Math.round(cw * scale), H = Math.round(ch * scale);
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = Math.min(img.w - 1, x0 + Math.floor(x / scale));
      const sy = Math.min(img.h - 1, y0 + Math.floor(y / scale));
      const s = (sy * img.w + sx) * 4, d = (y * W + x) * 3;
      out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2];
    }
  }
  return { w: W, h: H, rgb: out };
}
