// 两张同机位截图的像素对照（量化"真的变了多少"）：
//   node scripts/pix-diff.mjs <左图> <右图> [--top 100] [--right 1040]
// 默认排除顶部 100px（HUD）与右侧 240px（排行榜等 DOM 叠加）。
import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './img.mjs';

const args = process.argv.slice(2);
const optOf = (k, d) => { const i = args.indexOf(k); return i > 0 ? Number(args[i + 1]) : d; };
const A = readPng(path.resolve(args[0]));
const B = readPng(path.resolve(args[1]));
const y0 = optOf('--top', 100);
const x1 = optOf('--right', 1040);
const lum = (img, x, y) => {
  const p = (y * img.w + x) * 4;
  return (0.2126 * img.data[p] + 0.7152 * img.data[p + 1] + 0.0722 * img.data[p + 2]) / 255;
};
let n = 0, sum = 0, changed = 0, max = 0, darker = 0, brighter = 0;
for (let y = y0; y < Math.min(A.h, B.h); y++) {
  for (let x = 0; x < Math.min(A.w, B.w, x1); x++) {
    const d = lum(B, x, y) - lum(A, x, y);
    n++; sum += Math.abs(d);
    if (Math.abs(d) > 3 / 255) changed++;
    if (Math.abs(d) > max) max = Math.abs(d);
    if (d < -0.004) darker++; else if (d > 0.004) brighter++;
  }
}
console.log(`${path.basename(args[0])} → ${path.basename(args[1])}  ${A.w}×${A.h}`);
console.log(`  变化像素占比 ${(changed / n * 100).toFixed(1)}%   平均 |Δ亮度| ${(sum / n).toFixed(4)}   最大 Δ ${max.toFixed(3)}`);
console.log(`  变暗 ${(darker / n * 100).toFixed(1)}%   变亮 ${(brighter / n * 100).toFixed(1)}%`);
