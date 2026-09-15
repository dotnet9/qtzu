// 城市窄颈审计：城市边界内应是连通的可玩区域（除墙/建筑/河）。
// 玩家被钳在「离边界 ≥ margin（墙厚+身位）」的区域内，若该区域（形态学腐蚀）
// 被窄颈切成多个连通块，小人就过不去——另一侧的蛋/立牌成死区。
// 用法：node scripts/check-city-neck.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_SHAPES } from '../js/city-shape-data.js';
import { simplifyPoly, polyInside, polyNearest } from '../js/city-shape.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CITY_SCALE = 0.84;
const wallBw = r => Math.max(1.2, r * 0.035);
const PLAYER_EXTRA = 0.5;          // game._cityWallMargin(st) 的 extra 默认值

// 与 js/city-shape.js 相同的轮廓兜底
const SHAPES = {
  beijing: [[0.05,1],[0.5,0.9],[0.85,0.6],[1,0.15],[0.8,-0.3],[0.9,-0.7],[0.5,-0.95],[0,-0.85],[-0.5,-1],[-0.85,-0.6],[-0.7,-0.15],[-1,0.2],[-0.8,0.6],[-0.4,0.8],[-0.1,1],[0.05,1]],
  shanghai: [[0.7,0.9],[1,0.4],[0.85,-0.1],[0.95,-0.6],[0.5,-0.9],[0.1,-0.7],[-0.1,-0.9],[-0.6,-0.7],[-0.8,-0.2],[-0.6,0.2],[-0.9,0.55],[-0.5,0.9],[-0.1,0.7],[0.3,0.85],[0.7,0.9]],
  chongqing: [[-0.9,0.5],[-0.5,0.85],[0,0.6],[0.4,0.9],[0.85,0.6],[1,0.1],[0.6,-0.2],[0.9,-0.6],[0.4,-0.9],[0,-0.6],[-0.4,-0.9],[-0.8,-0.55],[-0.6,-0.1],[-1,-0.3],[-0.95,0.15],[-0.9,0.5]],
  chengdu: [[0.55,0.85],[0.95,0.45],[0.8,0.05],[1,-0.35],[0.6,-0.8],[0.1,-0.7],[-0.35,-0.95],[-0.8,-0.6],[-0.65,-0.15],[-0.95,0.25],[-0.6,0.65],[-0.15,0.55],[0.2,0.9],[0.55,0.85]],
  guangzhou: [[-0.85,0.6],[-0.4,0.9],[0.05,0.65],[0.45,0.95],[0.85,0.6],[1,0.15],[0.6,-0.1],[0.8,-0.55],[0.35,-0.85],[-0.1,-0.6],[-0.5,-0.9],[-0.9,-0.5],[-0.7,0],[-0.95,0.3],[-0.85,0.6]],
  hangzhou: [[0.6,0.9],[1,0.5],[0.8,0.05],[0.95,-0.4],[0.55,-0.85],[0.05,-0.65],[-0.4,-0.9],[-0.8,-0.5],[-0.6,0],[-0.9,0.4],[-0.5,0.8],[-0.05,0.6],[0.3,0.9],[0.6,0.9]],
  wuhan: [[-1,0.35],[-0.6,0.7],[-0.2,0.5],[0.25,0.9],[0.7,0.65],[1,0.2],[0.7,-0.2],[0.9,-0.65],[0.45,-0.9],[0,-0.6],[-0.45,-0.85],[-0.85,-0.5],[-0.55,-0.05],[-0.85,0],[-1,0.35]],
  xian: [[0.15,0.95],[0.6,0.8],[0.9,0.4],[0.75,0],[1,-0.4],[0.55,-0.85],[0.1,-0.65],[-0.35,-0.9],[-0.8,-0.55],[-0.65,-0.1],[-0.95,0.3],[-0.55,0.7],[-0.1,0.55],[0.15,0.95]],
  lanzhou: [[-1,0.25],[-0.6,0.45],[-0.2,0.25],[0.25,0.5],[0.7,0.3],[1,0.45],[0.85,-0.05],[0.5,-0.3],[0.7,-0.7],[0.25,-0.5],[-0.2,-0.7],[-0.65,-0.45],[-0.45,-0.05],[-0.75,-0.25],[-1,0.25]],
  taipei: [[0.3,0.85],[0.75,0.6],[0.95,0.1],[0.65,-0.3],[0.85,-0.7],[0.35,-0.9],[-0.1,-0.6],[-0.5,-0.85],[-0.85,-0.4],[-0.6,0],[-0.9,0.45],[-0.45,0.8],[0,0.6],[0.3,0.85]],
};
const TW_SHAPES = {
  taipei: [[0.2,0.75],[0.6,0.8],[0.9,0.45],[0.8,0.05],[0.95,-0.35],[0.6,-0.7],[0.15,-0.8],[-0.3,-0.6],[-0.7,-0.75],[-0.9,-0.3],[-0.6,0.1],[-0.85,0.5],[-0.4,0.75],[-0.05,0.55],[0.2,0.75]],
  kaohsiung: [[-0.3,0.85],[0.2,0.75],[0.6,0.9],[0.9,0.5],[0.7,0.1],[0.85,-0.3],[0.5,-0.65],[0.05,-0.9],[-0.4,-0.75],[-0.75,-0.4],[-0.55,0.05],[-0.8,0.45],[-0.3,0.85]],
  taichung: [[-0.15,0.9],[0.35,0.85],[0.75,0.6],[0.9,0.15],[0.6,-0.1],[0.8,-0.5],[0.4,-0.85],[-0.05,-0.65],[-0.15,-0.9],[-0.55,-0.7],[-0.4,-0.3],[-0.75,0],[-0.5,0.4],[-0.6,0.7],[-0.15,0.9]],
  tainan: [[0.1,0.8],[0.55,0.75],[0.85,0.4],[0.95,-0.05],[0.7,-0.45],[0.3,-0.7],[-0.15,-0.8],[-0.55,-0.6],[-0.8,-0.2],[-0.65,0.2],[-0.85,0.55],[-0.45,0.8],[-0.05,0.6],[0.1,0.8]],
};
function blob(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const lobN = 3 + Math.floor(rand() * 2);
  const lobes = [];
  for (let i = 0; i < lobN; i++) lobes.push({ f: 1 + Math.floor(rand() * 3), amp: 0.12 + rand() * 0.2, ph: rand() * Math.PI * 2 });
  const pts = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = 0.85;
    for (const L of lobes) r += L.amp * Math.sin(a * L.f + L.ph);
    r = Math.max(0.6, Math.min(1.05, r));
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  pts.push([pts[0][0], pts[0][1]]);
  return pts;
}
function getCityShape(cityId, levelShape) {
  if (Array.isArray(levelShape) && levelShape.length > 5) {
    const p = levelShape.map(pt => [+pt[0] || 0, +pt[1] || 0]);
    if (Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) > 1e-4) p.push([p[0][0], p[0][1]]);
    return p;
  }
  return CITY_SHAPES[cityId] || SHAPES[cityId] || TW_SHAPES[cityId] || blob(cityId);
}

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

// 网格 BFS 连通块：open(x,z) = 在轮廓内 且 离边界 ≥ margin
function components(pts, margin, step) {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const nx = Math.ceil((maxX - minX) / step) + 1, nz = Math.ceil((maxZ - minZ) / step) + 1;
  const lab = new Int32Array(nx * nz).fill(-1);
  let nComp = 0;
  const comps = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const id = i * nz + j;
      if (lab[id] >= 0) continue;
      const x = minX + i * step, z = minZ + j * step;
      if (!polyInside(pts, x, z) || polyNearest(pts, x, z).d < margin) { lab[id] = -2; continue; }
      // BFS
      const q = [id]; lab[id] = nComp;
      const cells = [];
      while (q.length) {
        const cur = q.pop(); cells.push(cur);
        const ci = Math.floor(cur / nz), cj = cur % nz;
        for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
          const nid = ni * nz + nj;
          if (lab[nid] >= 0) continue;
          const px = minX + ni * step, pz = minZ + nj * step;
          if (!polyInside(pts, px, pz) || polyNearest(pts, px, pz).d < margin) { lab[nid] = -2; continue; }
          lab[nid] = nComp; q.push(nid);
        }
      }
      comps.push({ cells, i0: Math.min(...cells.map(c => Math.floor(c / nz))), sample: cells[0] });
      nComp++;
    }
  }
  return { comps, nx, nz, lab, minX, minZ, step };
}

const index = loadJson(path.join(root, 'data/cities/index.json'));
const rows = [];
for (const c of index.cities) {
  const cid = c.id;
  const cj = loadJson(path.join(root, `data/cities/${cid}/city.json`));
  if (!cj) continue;
  const unis = (loadJson(path.join(root, `data/cities/${cid}/universities.json`)) || { unis: [] }).unis || [];
  const foods = (loadJson(path.join(root, `data/cities/${cid}/foods.json`)) || { items: [] }).items || [];
  const scenes = (loadJson(path.join(root, `data/cities/${cid}/scenes.json`)) || { items: [] }).items || [];
  const lv = cj.level || {};
  const rr = Math.round((lv.radius || 28) * (3 + Math.min(1.3, (unis.length + foods.length + scenes.length) * 0.012)) * CITY_SCALE);
  const pts = getCityShape(cid, lv.shape).map(([sx, sz]) => [sx * rr, sz * rr]);
  const sim = simplifyPoly(pts, 0.1);           // 运行时钳制用的同一份低模
  const bw = wallBw(rr);
  const margin = Math.max(1.2, rr * 0.035) + PLAYER_EXTRA;
  const step = 1.0;                              // 1 世界单位 ≈ 玩家直径的 1.2 倍，足够分辨窄颈
  const { comps } = components(sim, margin, step);
  comps.sort((a, b) => b.cells.length - a.cells.length);
  const main = comps[0];
  const lost = comps.slice(1).reduce((s, k) => s + k.cells.length, 0);
  const total = main.cells.length + lost;
  // 主连通块占可玩面积的比例；<100% 说明有到不了的区域
  const mainPct = total ? (main.cells.length / total * 100) : 100;
  // 全城最小通过宽度：形态学意义下的「最窄处」= 2×最大内切半径处不适用，
  // 这里直接报告腐蚀半径——把 margin 逐步加大直到主块面积明显缩水没意义，
  // 报告每城：可玩总面积、连通块数、碎块占比
  rows.push({
    id: cid, name: cj.name || cid, r: rr, bw: +bw.toFixed(2), margin: +margin.toFixed(2),
    comps: comps.length, mainPct: +mainPct.toFixed(1),
    lostArea: lost * step * step,
    mainSample: main ? main.sample : -1,
  });
}

rows.sort((a, b) => a.mainPct - b.mainPct);
console.log('城市            r     墙厚  margin  连通块  主块占比  死区面积(世界单位²)');
for (const w of rows) {
  const flag = w.comps > 1 ? ' ❌' : (w.mainPct < 100 ? ' ⚠️' : '');
  console.log(
    `${w.name.padEnd(6)} ${String(w.id).padEnd(13)} r=${String(w.r).padStart(3)}  bw=${String(w.bw).padStart(4)}  m=${String(w.margin).padStart(4)}  ${String(w.comps).padStart(3)}     ${String(w.mainPct).padStart(5)}%  ${String(Math.round(w.lostArea)).padStart(7)}${flag}`
  );
}
const bad = rows.filter(w => w.comps > 1);
console.log(`\n===== ${rows.length} 城，其中 ${bad.length} 城可玩区被窄颈切断：${bad.map(b => b.name).join('、') || '无'} =====`);
