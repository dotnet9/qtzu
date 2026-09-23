// 卡片缩略图 ↔ 游戏内近景 的对照：竖向分带的**主色分布** + 一致率。
//
// 为什么不逐像素比：两边机位不同（卡片是正面 3/4 影棚视角、游戏内是低俯角），
// 逐格比色相必然低（实测 5%），那个数字说明不了"模型是否一致"。
// 分带主色分布对机位差异稳健得多，能回答真正的问题：
// **同一个高度上，两边是不是同一种颜色的东西**（上衣/裤子/鞋/帽子各在哪一段）。
//
//   node scripts/player-look-check.mjs [--gender boy] [--rows 8] [--cols 12]
import fs from 'node:fs';
import path from 'node:path';
import { readPng } from './img.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GENDER = optOf('--gender', 'boy');
const ROWS = Number(optOf('--rows', '8'));
const COLS = Number(optOf('--cols', '12'));

const DIR = path.join(ROOT, '.cache/look/player');
const card = readPng(path.join(DIR, `card-${GENDER}.png`));
const game = readPng(path.join(DIR, `ingame-${GENDER}.png`));
// 掩膜（白=角色）：必须只统计角色像素 —— 游戏内那张的黄色地面会把每一带都算成"黄"
const mCard = readPng(path.join(DIR, `card-${GENDER}-mask.png`));
const mGame = readPng(path.join(DIR, `ingame-${GENDER}-mask.png`));
const isChar = (m, x, y) => m.data[(y * m.w + x) * 4] > 128;
const px = (img, x, y) => { const p = (y * img.w + x) * 4; return [img.data[p], img.data[p + 1], img.data[p + 2]]; };

const cls = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum > 0.94 && sat < 0.10) return 'W';             // 白/高光
  if (lum < 0.30 && sat < 0.45) return 'K';             // 暗（头发/轮廓/阴影）
  if (sat < 0.13) return '.';                           // 低饱和（皮肤阴影/灰底）
  let h;
  if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6);
  else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2);
  else h = 60 * ((r - g) / (mx - mn) + 4);
  if (h < 0) h += 360;
  if (h < 15 || h >= 345) return 'R';   // 红/粉
  if (h < 40) return 'O';               // 橙/棕（皮肤、木头）
  if (h < 70) return 'Y';               // 黄（上衣、草帽）
  if (h < 160) return 'G';              // 绿（裤子、草地）
  if (h < 200) return 'C';              // 青
  if (h < 255) return 'B';              // 蓝
  if (h < 300) return 'P';              // 紫
  return 'M';
};

// 分带主色：把图切成 ROWS×COLS，每格取出现最多的色相（**只统计角色像素**）
const bands = (img, mask) => {
  const out = [];
  for (let j = 0; j < ROWS; j++) {
    const row = [];
    for (let i = 0; i < COLS; i++) {
      const x0 = Math.floor(i * img.w / COLS), x1 = Math.floor((i + 1) * img.w / COLS);
      const y0 = Math.floor(j * img.h / ROWS), y1 = Math.floor((j + 1) * img.h / ROWS);
      const tally = {};
      let chars = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (!isChar(mask, x, y)) continue;
        chars++;
        const c = cls(...px(img, x, y));
        tally[c] = (tally[c] || 0) + 1;
      }
      let best = '.', bn = -1;
      for (const [k, v] of Object.entries(tally)) { if (k !== '.' && v > bn) { bn = v; best = k; } }
      row.push(chars < 4 ? '.' : best);      // 这一格几乎没有角色
    }
    out.push(row);
  }
  return out;
};

const A = bands(card, mCard), B = bands(game, mGame);
console.log(`卡片 ${card.w}×${card.h}   游戏内 ${game.w}×${game.h}   分带 ${ROWS} 行 × ${COLS} 列（自上而下 = 头顶→脚底）`);
console.log('字母：R红粉 O橙棕 Y黄 G绿 C青 B蓝 P紫 M品红 W白 K暗 .无角色\n');
console.log('  卡片（程序化 + 三点光）'.padEnd(20) + ' 游戏内（烘焙 GLB + 游戏光照）  逐带');
let same = 0, tot = 0;
for (let j = 0; j < ROWS; j++) {
  let mark = '';
  for (let i = 0; i < COLS; i++) {
    const a = A[j][i], b = B[j][i];
    if (a === '.' || b === '.') { mark += ' '; continue; }
    tot++;
    if (a === b) { same++; mark += '='; } else mark += 'x';
  }
  console.log(`  ${A[j].join('')}   ${B[j].join('')}  ${mark}`);
}
console.log(`\n同带同色率 ${(same / Math.max(1, tot) * 100).toFixed(1)}%（${same}/${tot} 个"两边都有角色"的带）`);

// 竖向轮廓：每一行"角色占多宽"（同样只统计角色像素），用来比体型/比例
const widths = (img, mask) => {
  const out = [];
  for (let j = 0; j < ROWS; j++) {
    let n = 0, t = 0;
    for (let y = Math.floor(j * img.h / ROWS); y < Math.floor((j + 1) * img.h / ROWS); y++) {
      for (let x = 0; x < img.w; x++) { t++; if (isChar(mask, x, y)) n++; }
    }
    out.push(+(n / Math.max(1, t) * 100).toFixed(0));
  }
  return out;
};
const wc = widths(card, mCard), wg = widths(game, mGame);
console.log(`\n竖向轮廓（每行角色宽度占比 %，头顶→脚底）`);
console.log(`  卡片   ${wc.join(' ')}`);
console.log(`  游戏内 ${wg.join(' ')}`);
const dif = wc.map((v, i) => Math.abs(v - wg[i]));
console.log(`  差值   ${dif.join(' ')}   平均 ${(dif.reduce((a, b) => a + b, 0) / ROWS).toFixed(1)} 个百分点`);
