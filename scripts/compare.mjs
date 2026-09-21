// scripts/compare.mjs：把两张同机位截图合成一张左右对比图（可选裁切放大与标注）
//
//   node scripts/compare.mjs --out .cache/look/compare-street.png \
//        --left .cache/look/baseline/street.png --right .cache/look/ground/street.png \
//        --label "before,now"
//
//   node scripts/compare.mjs --out .cache/look/ground-zoom.png \
//        --left .cache/look/ground/ground.png --box 0.15,0.42,0.95,1 --scale 2 --label "ground 2x"
//
// 为什么需要它：浏览器面板不可用时，把"同机位前后对比"合成**一个文件**，你打开就能比，
// 不用在几个目录里对文件名。标注走 png.mjs 的内置 5x7 字模（不引字体文件，只支持 ASCII）。
import { readPng } from './img.mjs';
import { writePng, transform, banner } from './png.mjs';

const optOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const out = optOf('--out');
const left = optOf('--left');
const right = optOf('--right');
const labels = (optOf('--label') || 'A,B').split(',');
const scale = Number(optOf('--scale') || 1);
const gap = Number(optOf('--gap') || 14);
const box = optOf('--box') ? optOf('--box').split(',').map(Number) : null;
const stack = process.argv.includes('--stack');          // 竖着拼（宽高比更接近屏幕时更好看）
if (!out || !left) {
  console.log('用法见文件头注释');
  process.exit(1);
}

const L = transform(readPng(left), box, scale);
const R = right ? transform(readPng(right), box, scale) : null;
const W = stack ? Math.max(L.w, R ? R.w : 0) : L.w + (R ? gap + R.w : 0);
const H = stack ? L.h + (R ? gap + R.h : 0) : Math.max(L.h, R ? R.h : 0);
const rgb = Buffer.alloc(W * H * 3, 26);                 // 背景深灰：便于分辨两图边界

const blit = (img, ox, oy) => {
  for (let y = 0; y < img.h; y++) {
    if (oy + y >= H) break;
    const src = y * img.w * 3;
    const copyW = Math.min(img.w, W - ox);
    img.rgb.copy(rgb, ((oy + y) * W + ox) * 3, src, src + copyW * 3);
  }
};
blit(L, 0, 0);
const rx = stack ? 0 : L.w + gap;
const ry = stack ? L.h + gap : 0;
if (R) blit(R, rx, ry);

const ts = Math.max(2, Math.round(W / 560));
banner(rgb, W, H, labels[0] || 'A', ts, 0);
if (R) banner(rgb, W, H, labels[1] || 'B', ts, rx);

writePng(out, W, H, rgb);
console.log(`已生成 ${out}  ${W}x${H}（左/上：${labels[0] || 'A'}${R ? `  \u53f3/\u4e0b\uff1a${labels[1] || 'B'}` : ''}）`);
