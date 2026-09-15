#!/usr/bin/env node
// 城市窄颈修复（离线后处理）：对 js/city-shape-data.js 的 CITY_SHAPES 逐城做
// 最小间距松弛（见 heal-neck-lib.mjs），把腐蚀后不连通的窄颈撑宽到可通行。
// 只处理「可玩区（按钳制边距腐蚀）确实断开」的城市；断块全是海上来岛（撑不合并）
// 的城市原样保留。改城市内容量（半径/边距随之变）后重跑即可。
// 用法：node scripts/heal-city-necks.mjs [--check]   --check 只报告不写回
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_SHAPES } from '../js/city-shape-data.js';
import { simplifyPoly, polyInside, polyNearest } from '../js/city-shape.js';
import { healNecks, healWidthForCity } from './heal-neck-lib.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'js', 'city-shape-data.js');
const checkOnly = process.argv.includes('--check');

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
const count = (d, k1, k2) => { if (!d) return 0; const a = d[k1] || (d[k2] || { items: [] }).items || []; return a.length; };

// 腐蚀区连通块统计（与 scripts/check-city-neck.mjs 同一套，1 世界单位网格 BFS）
function walkComponents(pts, margin, step = 1.0) {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const nx = Math.ceil((maxX - minX) / step) + 1, nz = Math.ceil((maxZ - minZ) / step) + 1;
  const open = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = minX + i * step, z = minZ + j * step;
      open[i * nz + j] = polyInside(pts, x, z) && polyNearest(pts, x, z).d >= margin ? 1 : 0;
    }
  }
  const lab = new Int32Array(nx * nz).fill(-1);
  const sizes = [];
  for (let s = 0; s < open.length; s++) {
    if (!open[s] || lab[s] >= 0) continue;
    const id = sizes.length, q = [s];
    lab[s] = id; let cells = 0;
    while (q.length) {
      const cur = q.pop(); cells++;
      const ci = Math.floor(cur / nz), cj = cur % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const nid = ni * nz + nj;
        if (open[nid] && lab[nid] < 0) { lab[nid] = id; q.push(nid); }
      }
    }
    sizes.push(cells);
  }
  sizes.sort((a, b) => b - a);
  return sizes;   // 各连通块的格子数（降序）；[0] 之外的都是走不到的死区
}

const healed = {}, changed = [], skipped = [], islets = [];
for (const [cid, pts] of Object.entries(CITY_SHAPES)) {
  const cj = loadJson(path.join(root, `data/cities/${cid}/city.json`));
  const lv = cj ? (cj.level || {}) : {};
  const contents =
    count(loadJson(path.join(root, `data/cities/${cid}/universities.json`)), 'unis') +
    count(loadJson(path.join(root, `data/cities/${cid}/foods.json`)), 'items') +
    count(loadJson(path.join(root, `data/cities/${cid}/scenes.json`)), 'items');
  const r = Math.round((lv.radius || 28) * (3 + Math.min(1.3, contents * 0.012)) * 0.84);
  const margin = Math.max(1.2, r * 0.035) + 0.5;
  const sim = simplifyPoly(pts.map(([x, z]) => [x * r, z * r]), 0.1);   // 运行时同一份钳制低模
  const before = walkComponents(sim, margin);
  if (before.length <= 1) { skipped.push(cid); continue; }              // 可玩区本来就连通
  const W = healWidthForCity({ radius: lv.radius || 28, contents });
  const outN = healNecks(pts, W);
  const simN = simplifyPoly(outN.map(([x, z]) => [x * r, z * r]), 0.1);
  const after = walkComponents(simN, margin);
  const beforeLost = before.slice(1).reduce((a, b) => a + b, 0);
  const afterLost = after.slice(1).reduce((a, b) => a + b, 0);
  if (afterLost < beforeLost) { healed[cid] = outN; changed.push(`${cid} 死区 ${beforeLost}→${afterLost}`); }
  else islets.push(`${cid}（死区 ${beforeLost} 格，均为离岛碎片，撑宽无法合并）`);
}

console.log(`连通正常 ${skipped.length} 城；修复 ${changed.length} 城：\n  ${changed.join('\n  ') || '无'}`);
if (islets.length) console.log(`离岛碎片（保留原样）${islets.length} 城：\n  ${islets.join('\n  ')}`);

if (checkOnly || !changed.length) {
  if (!checkOnly && !changed.length) console.log('无需写回。');
  process.exit(0);
}

// 写回：保持生成脚本的原文件结构（CITY_SHAPES + CITY_GEO 两段）
const src = fs.readFileSync(OUT, 'utf8');
const shapesRe = /export const CITY_SHAPES = \{[\s\S]*?\n\};/;
if (!shapesRe.test(src)) { console.error('city-shape-data.js 结构不符，写回中止'); process.exit(1); }
const merged = { ...CITY_SHAPES, ...healed };
const body = Object.entries(merged).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join(',\n');
fs.writeFileSync(OUT, src.replace(shapesRe, `export const CITY_SHAPES = {\n${body},\n};`));
console.log(`\n已写回 ${OUT}。提示：scripts/gen-city-shapes.mjs 已内置同一修复，重新拉取数据后无需再跑本脚本。`);
