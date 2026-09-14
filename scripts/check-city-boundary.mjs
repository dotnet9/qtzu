// 城市边界审计：离线复算 world/game 的元素摆放逻辑，找出会压到/越出院墙的元素。
// 用法：node scripts/check-city-boundary.mjs
// 复算的公式与 js/world.js（buildOne）/ js/game.js（_buildSigns/_clampCityPos）保持一致，
// 改了摆放逻辑后跑一遍即可知道 52 城是否还有元素贴墙/出界。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_SHAPES } from '../js/city-shape-data.js';
import { clampPoly } from '../js/city-shape.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CITY_SCALE = 0.84;
const wallBw = r => Math.max(1.2, r * 0.035);   // 与 world.js CITY_WALL_BW 同公式

// ---- 与 js/city-shape.js 相同的轮廓兜底（审计自闭环，便于核对兜底形状） ----
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

// ---- 几何：内点判定 + 带符号的边界距离（内正外负） ----
function inPoly(pts, x, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function nearestEdge(pts, x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const ex = bx - ax, ez = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    const qx = ax + ex * t, qz = az + ez * t;
    const d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < bd) { bd = d; best = [qx, qz]; }
  }
  return { qx: best[0], qz: best[1], d: Math.sqrt(bd) };
}
function edgeDist(pts, x, z) {
  const { d } = nearestEdge(pts, x, z);
  return inPoly(pts, x, z) ? d : -d;
}

// ---- 元素占位半径（与渲染尺寸匹配的近似值，须与 world/game 的 margin 同步） ----
const LM_HALF = { gate: 3.6, tower: 1.7, wall: 7.2, panda: 3.2, ice: 2.4, palm: 3.6, dome: 2.8, mountain: 4.5, pavilion: 2.8, bridge: 3.4, grotto: 2.5, harbor: 3.4 };
const GATE_MARGIN = 2.6, SIGN_MARGIN = 0.6, TREE_MARGIN = 1.3, STONE_MARGIN = 1.2;
const GREEN_MARGIN = 1.7, TOWER_MARGIN = 3.7;
const EPS = 0.05;   // clampPoly 窄处收敛误差容限

function loadJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }

const index = loadJson(path.join(root, 'data/cities/index.json'));
const cityIds = index.cities.map(c => c.id);
let totalIssues = 0;
const report = [];

for (const cid of cityIds) {
  const c = loadJson(path.join(root, `data/cities/${cid}/city.json`));
  if (!c) continue;
  const unis = (loadJson(path.join(root, `data/cities/${cid}/universities.json`)) || { unis: [] }).unis || [];
  const foods = (loadJson(path.join(root, `data/cities/${cid}/foods.json`)) || { items: [] }).items || [];
  const scenes = (loadJson(path.join(root, `data/cities/${cid}/scenes.json`)) || { items: [] }).items || [];
  const lv = c.level || {};
  const rr = Math.round((lv.radius || 28) * (3 + Math.min(1.3, (unis.length + foods.length + scenes.length) * 0.012)) * CITY_SCALE);
  const pts = getCityShape(cid, lv.shape).map(([sx, sz]) => [sx * rr, sz * rr]);
  const bw = wallBw(rr);
  const issues = [];
  const chk = (label, x, z, need) => {
    const d = edgeDist(pts, x, z);
    if (d < need - EPS) issues.push(`${label} 离边界 ${d.toFixed(1)}（需≥${need.toFixed(1)}）${d < 0 ? '【出界】' : ''}`);
  };

  // 1) 装饰树（world.js decoSpots：r-3 采样后钳制）
  const treeN = 3;
  for (let i = 0; i < treeN; i++) {
    const a = Math.PI * 2 * i / treeN + (rr % 3) + 0.8;
    let [x, z] = [Math.cos(a) * (rr - 3), Math.sin(a) * (rr - 3)];
    [x, z] = clampPoly(pts, x, z, bw + TREE_MARGIN);
    chk(`装饰树#${i}`, x, z, bw + TREE_MARGIN);
  }

  // 2) 大学/美食/风景（game._buildSigns：方位扇形 + 带边距钳制）
  const DIRS = { N: [0, -1], NE: [0.7, -0.7], E: [1, 0], SE: [0.7, 0.7], S: [0, 1], SW: [-0.7, 0.7], W: [-1, 0], NW: [-0.7, -0.7] };
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const buckets = {};
  const push = (items, type) => { for (const it of items || []) { const b = DIRS[it.bearing] ? it.bearing : ['N','NE','E','SE','S','SW','W','NW'][hash(cid + (it.zh || it.name)) % 8]; (buckets[b] = buckets[b] || []).push({ ...it, type }); } };
  push(unis, 'uni'); push(foods, 'food'); push(scenes, 'scene');
  for (const [b, items] of Object.entries(buckets)) {
    const [dx, dz] = DIRS[b];
    const baseAng = Math.atan2(dx, dz);
    const n = items.length;
    items.forEach((it, i) => {
      const ang = it.type === 'uni'
        ? (n > 6 ? baseAng + i * (Math.PI * 2 / n) : baseAng + (n > 1 ? (i / (n - 1) - 0.5) * 0.5 : 0))
        : baseAng;
      const ux = Math.sin(ang), uz = Math.cos(ang);
      const rr2 = it.type === 'uni' ? rr * (0.42 + (i % 2) * 0.18) : rr * Math.min(0.92, 0.5 + i * (0.4 / Math.max(1, n - 1)));
      const need = bw + (it.type === 'uni' ? GATE_MARGIN : SIGN_MARGIN);
      const [x, z] = clampPoly(pts, ux * rr2, uz * rr2, need);
      const label = it.type === 'uni' ? `大学「${it.zh}」` : (it.type === 'food' ? `美食「${it.name}」` : `风景「${it.name}」`);
      chk(label, x, z, need);
    });
  }

  // 3) 观景石台（world.js 与 game._cityPos 同点位同边距）
  {
    const [x, z] = clampPoly(pts, rr * 0.3, -rr * 0.3, bw + STONE_MARGIN);
    chk('观景石台', x, z, bw + STONE_MARGIN);
  }

  // 4) 副地标（world.js：r*0.56 圆分布 + 占地边距钳制）
  const lms = (lv.landmarks && lv.landmarks.length) ? lv.landmarks : [c.landmark, 'pavilion'];
  lms.forEach((type, i) => {
    if (i === 0) return;
    const a = (i / Math.max(1, lms.length)) * Math.PI * 2 + 1.1;
    const need = bw + (LM_HALF[type] || 2.8) * 0.78 + 0.3;
    const [x, z] = clampPoly(pts, Math.cos(a) * rr * 0.56, Math.sin(a) * rr * 0.56, need);
    chk(`副地标${type}`, x, z, need);
  });

  // 5) 特产 emoji / 花丛（world.js）
  (c.variants || []).forEach((_, i) => {
    const a = Math.PI * 2 * i / Math.max(1, c.variants.length) + 0.4;
    const [x, z] = clampPoly(pts, Math.cos(a) * (rr - 3), Math.sin(a) * (rr - 3), bw + 0.5);
    chk(`特产emoji#${i}`, x, z, bw + 0.5);
  });
  for (const [dx, dz] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) {
    const [x, z] = clampPoly(pts, dx * rr, dz * rr, bw + 0.7);
    chk(`花丛(${dx},${dz})`, x, z, bw + 0.7);
  }

  // 6) 绿化树丛 / 高楼（world.js：种子随机撒点 + 钳制；与实现同一套 rn() 保证可复现）
  {
    let sd = (rr * 7919) | 0;
    const rn = () => (sd = (Math.imul(sd, 48271) + 11) % 2147483647) / 2147483647;
    const inPt = (px, pz) => inPoly(pts, px, pz);
    const placed = [];
    const spot = (dMin, dMax, gap, margin) => {
      for (let k = 0; k < 40; k++) {
        const a2 = rn() * Math.PI * 2, d2 = dMin + rn() * (dMax - dMin);
        let px = Math.cos(a2) * d2, pz = Math.sin(a2) * d2;
        if (!inPt(px, pz)) continue;
        [px, pz] = clampPoly(pts, px, pz, margin);
        if (placed.some(q => Math.hypot(q[0] - px, q[1] - pz) < gap)) continue;
        placed.push([px, pz]);
        return [px, pz];
      }
      return null;
    };
    const gN = Math.round(Math.min(180, rr * 2.4));
    for (let i = 0; i < gN; i++) {
      const sp = spot(rr * 0.15, rr * 0.9, rr * 0.05, bw + GREEN_MARGIN);
      if (sp) chk(`绿化树#${i}`, sp[0], sp[1], bw + GREEN_MARGIN);
    }
    const bN = 8 + Math.floor(rn() * 9);
    for (let i = 0; i < bN; i++) {
      const sp = spot(rr * 0.2, rr * 0.75, rr * 0.09, bw + TOWER_MARGIN);
      if (sp) chk(`高楼#${i}`, sp[0], sp[1], bw + TOWER_MARGIN);
    }
  }

  if (issues.length) {
    totalIssues += issues.length;
    report.push(`\n【${c.name || cid}】r=${rr} 墙厚=${bw.toFixed(2)}  ${issues.length} 处：\n  ` + issues.slice(0, 12).join('\n  ') + (issues.length > 12 ? `\n  …等 ${issues.length} 处` : ''));
  }
}

console.log(report.join(''));
console.log(`\n===== ${cityIds.length} 城，共 ${totalIssues} 处边界问题 =====`);
