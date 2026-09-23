// 地面改动的"前后像素对照"（final8 = 上一轮提交的地面，dapple = 现在）。
// 只比画面下方（排除 HUD/排行榜等 DOM 叠加），回答"地面上真的看得见变化吗、变了多少"。
import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './img.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const A = readPng(path.join(ROOT, '.cache/look/final8/ground.png'));
const B = readPng(path.join(ROOT, '.cache/look/dapple/ground.png'));
const lum = (img, x, y) => {
  const p = (y * img.w + x) * 4;
  return (0.2126 * img.data[p] + 0.7152 * img.data[p + 1] + 0.0722 * img.data[p + 2]) / 255;
};
// 排除 HUD（顶部 100px）与排行榜（右下 x>1040）
const y0 = 100, x1 = 1040;
let n = 0, sum = 0, changed = 0, max = 0, darker = 0, brighter = 0;
for (let y = y0; y < Math.min(A.h, B.h); y++) {
  for (let x = 0; x < Math.min(A.w, B.w, x1); x++) {
    const d = lum(B, x, y) - lum(A, x, y);
    n++; sum += Math.abs(d); if (Math.abs(d) > 3 / 255) changed++;
    if (d > max) max = Math.abs(d);
    if (d < -0.004) darker++; else if (d > 0.004) brighter++;
  }
}
console.log(`地面像素对照：final8（上一轮提交）→ dapple（现在）  ${A.w}×${A.h}`);
console.log(`  变化像素占比 ${(changed / n * 100).toFixed(1)}%   平均 |Δ亮度| ${(sum / n).toFixed(4)}   最大 Δ ${max.toFixed(3)}`);
console.log(`  变暗 ${(darker / n * 100).toFixed(1)}%   变亮 ${(brighter / n * 100).toFixed(1)}%`);
