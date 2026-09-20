// 校门烘焙规格生成：复用 js/uni-gates.js 的权威规则（风格族 + 招牌门 + 配色），
// 输出给 Blender 用的纯数据 JSON。规则只有一份，不会出现"游戏里是 A 族、模型是 B 族"。
//
// 用法：node scripts/bake/specs.mjs --city chengdu   （不传 --city = 全 52 城）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { familyFor, SIGNATURE } from '../../js/uni-gates.js';
import { readCity, radiusOf, worldPtsOf, makeField } from '../terrain-lib.mjs';
import { simplifyPoly } from '../../js/city-shape.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const argOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const city = argOf('--city');

// 色卡混合：js/world.js 的亮部/暗部就是这么从城市色推出来的，这里保持一致（模型与程序化回退同色系）

// 19 个风格族的粘土色板 {c1 柱身 / c2 强调 / c3 点缀 / c4 屋顶·暗部}
// 与 js/uni-gate-models.js 的 FAMILY 配色同源，但整体提亮降饱和到"软塑"区间
const PALETTES = {
  classic: ['#F3EFE7', '#CFC5B0', '#6FA36F', '#B9B0A0'],
  aero:    ['#F6F2EA', '#C9555C', '#8FA8C0', '#4A4A52'],
  chip:    ['#7E9CBB', '#4E7CA8', '#AEE0FF', '#3D6288'],
  rail:    ['#8A6A52', '#4F4A46', '#E8C86A', '#3A3634'],
  post:    ['#5F9C77', '#3E6B4F', '#BFE3D0', '#2F5A41'],
  ocean:   ['#F4F0E6', '#D95555', '#8FC7EA', '#2E6E9E'],
  agri:    ['#9A7550', '#E8C86A', '#6FAF6F', '#7A5C3A'],
  forest:  ['#8C6E52', '#5FA05F', '#8ED07F', '#4E7A46'],
  tcm:     ['#8A5A44', '#C99A4A', '#D8B87C', '#6E4230'],
  medic:   ['#F1EEE6', '#D95555', '#CFE3F2', '#3F6E8C'],
  petro:   ['#7C8590', '#5A6270', '#E8C86A', '#4A5260'],
  hydro:   ['#B8C2BC', '#8FA69C', '#6FB8E8', '#6E8A82'],
  power:   ['#8A93A0', '#5A6472', '#FFE24E', '#3E4650'],
  normal:  ['#F4F0E8', '#D8D2C4', '#E0A85A', '#B4AC9C'],
  finance: ['#3E7A5E', '#E8C86A', '#F5E7B8', '#2A5A44'],
  law:     ['#E2DED2', '#A8A196', '#C9A43A', '#7E776C'],
  lang:    ['#E6E0F2', '#8A7CBF', '#C9BEE8', '#5F5590'],
  art:     ['#F2E4EE', '#C97BA8', '#F5DFA8', '#8A5A80'],
  media:   ['#E6EEF4', '#6E93B8', '#F0D89A', '#4C6E90'],
  sport:   ['#EAF0E6', '#5FA05F', '#E8C86A', '#3E6B4F'],
  folk:    ['#F2E6D2', '#C0503E', '#E8C86A', '#8A5A34'],
  human:   ['#F2EEE6', '#E4DECF', '#C9BFA9', '#B9B2A2'],
  modern:  ['#8A93A0', '#E8C86A', '#F2EEE6', '#5A6472'],
  garden:  ['#F5F1E8', '#4A5560', '#C24A50', '#8E8778'],
  pailou:  ['#E4DECF', '#3E6B4F', '#9E2B25', '#B9B2A2'],
  minguo:  ['#8A6A5A', '#D8D2C4', '#E8C86A', '#5F5148'],
  erxiao:  ['#F2EEE6', '#B9B2A2', '#8A8478', '#3E3A34'],
  pku:     ['#A23A31', '#4E7A5A', '#E8C86A', '#7E2A24'],
  soviet:  ['#DCD6C8', '#8A8378', '#C24A50', '#6E675C'],
  jiageng: ['#A65542', '#E4DECF', '#E8C86A', '#7E3A2C'],
  roof:    ['#F5F1E8', '#8E8778', '#9E2B25', '#6B7280'],
  tibetan: ['#F5F1E8', '#8A2B22', '#E8C86A', '#6E6A62'],
  dunhuang:['#E0C384', '#A85A44', '#E8C86A', '#8A5A3A'],
};

// 与 js/uni-gate-models.js:714 同族的 LCG（同一校名 → 同一套尺寸/配色微扰）
function rndFor(seedStr) {
  let s = 5381;
  for (const ch of String(seedStr)) s = (Math.imul(s, 33) ^ ch.charCodeAt(0)) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

const mix = (hex, other, k) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
  const [a, b] = [p(hex), p(other)];
  return '#' + a.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (b[i] - v) * k)))
    .toString(16).padStart(2, '0')).join('');
};

export function gateSpec(cityKey, uni) {
  const zh = uni.zh || uni.name || '';
  const rnd = rndFor(zh);
  const sig = SIGNATURE[zh];
  const style = sig ? { kind: 'tpl', id: sig.tpl } : { kind: 'fam', id: familyFor(zh) };
  const pal = PALETTES[style.id] || PALETTES.human;
  // 招牌门用 SIGNATURE 的实际配色；风格族走色板 + 由校名决定的轻微明度微扰
  const base = sig ? [sig.c1, sig.c2, sig.c3, PALETTES[style.id]?.[3] || '#B9B2A2'] : pal;
  const w = rnd() * 0.16 - 0.06;   // -6% ~ +10%
  const colors = base.map((c, i) => (i === 0 ? mix(c, '#FFFFFF', w) : c));
  // 尺寸：与 js 同区间（span 3.6~4.5 / h 3.2~3.7），保证 LM_HALF=3.4 的占地仍然成立
  return {
    id: crypto.createHash('sha1').update(zh).digest('hex').slice(0, 8),
    zh, en: uni.en || '', city: cityKey,
    style, colors,
    prop: sig?.prop || null,
    span: +(3.6 + rnd() * 0.9).toFixed(3),
    height: +(3.2 + rnd() * 0.5).toFixed(3),
    variant: Math.floor(rnd() * 1e6),
  };
}

export function allGates(only) {
  const cities = fs.readdirSync(path.join(ROOT, 'data/cities'))
    .filter((d) => fs.statSync(path.join(ROOT, 'data/cities', d)).isDirectory());
  const out = [];
  for (const c of cities) {
    if (only && c !== only) continue;
    const f = path.join(ROOT, 'data/cities', c, 'universities.json');
    if (!fs.existsSync(f)) continue;
    for (const u of JSON.parse(fs.readFileSync(f, 'utf8')).unis || []) out.push(gateSpec(c, u));
  }
  return out;
}

// ---- 城市地标：一城最多 3 个（主地标 + 两个副地标），造型与配色照 js/world.js:1397-1412 ----
// 主地标 = level.landmarks[0]（没有就 landmark），副地标按同表逐个出；
// 与 js/world.js:1401 一样跳过与主地标同类型的副地标（那种位置本来就不建）。
// 占地半径表与 js/world.js:1395 的 LM_HALF 同源（audit-assets.mjs 会用它卡上界）。
export const LM_HALF = { gate: 3.6, tower: 1.7, wall: 7.2, panda: 3.2, ice: 2.4, palm: 3.6,
  dome: 2.8, mountain: 4.5, pavilion: 2.8, bridge: 3.4, grotto: 2.5, harbor: 3.4, 'uni-gate': 3.4 };

// 三类色卡：与 js/world.js 的 landmark 配色习惯对齐（城市色 + 中性辅色）
function paletteFor(color) {
  return [mix(color, '#FFFFFF', 0.55), color, mix(color, '#3A2E28', 0.25)];
}

export function landmarkSpec(cityKey, type, i, color, zh) {
  return {
    id: crypto.createHash('sha1').update(`${cityKey}#${i}:${type}`).digest('hex').slice(0, 8),
    city: cityKey, i, type, zh, color, colors: paletteFor(color),
  };
}

export function allLandmarks(only) {
  const dir = path.join(ROOT, 'data/cities');
  const out = [];
  for (const c of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory())) {
    if (only && c !== only) continue;
    const f = path.join(dir, c, 'city.json');
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const lv = j.level || {};
    const lms = (lv.landmarks && lv.landmarks.length) ? lv.landmarks : [j.landmark, 'pavilion'];
    lms.forEach((type, i) => {
      if (i > 0 && type === lms[0]) return;                    // 同 js/world.js:1401
      out.push(landmarkSpec(c, type, i, j.color || '#B85A7A', j.name || c));
    });
  }
  return out;
}

// ---- 城市地面：地形高度场 + 城墙 + 岩裙 + 雪峰（美术升级方案 §五 B1） ----
// 关键原则：**规则只有一份**。高度场、逐顶点配色、峰值、城墙参数全部在 Node 侧用
// js/terrain-field.js（与游戏运行时同一份实现）算好整段倒出去，Blender 只做几何与风格化，
// 绝不重算地形——js/terrain-field.js 的注释就写着"各写一套必然漂移"。
//
// 城墙/岩裙/雪峰这几个参数直接照抄 js/world.js 的常量（那里是权威值）：
const WALL = { H: 3.0, thick: 1.0, merlonGap: 3.4, brick: '#8C9C9F', merlon: '#A9B8B7' };   // world.js:1137,1156
const SKIRT = { sink: -3.6, tuck: 0.94, color: '#87928F' };                                  // world.js:1294,1305
// 雪峰配色与 terrain.js:66-69 同一套（sRGB，Blender 侧转线性）
const PEAK_ROCK = [0.26, 0.22, 0.20], PEAK_SNOW = [0.95, 0.97, 1.0];

export function groundSpec(cityKey) {
  const city = readCity(cityKey);
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, `data/cities/${cityKey}/terrain.json`), 'utf8'));
  const pts = worldPtsOf(cityKey, city);                 // 局部世界坐标（与 isl.shape 同一份）
  const F = makeField(cityKey, city, cfg);               // 与运行时同源的高度场
  const { minX, minZ, gsz, nx, nz, qy, inPoly, zoneColor } = F;

  // 逐顶点配色：整段照抄 terrain.js 的 getV（band 由平滑高度取，色值走 zoneColor）
  const color = [];
  for (let j = 0; j <= nz; j++) {
    const row = [];
    for (let i = 0; i <= nx; i++) {
      const x = minX + i * gsz, z = minZ + j * gsz;
      const hSm = F.hsSm[j][i];
      const c = [0, 0, 0];
      zoneColor(x, z, hSm, Math.floor(hSm / F.step + 1e-4), c);
      row.push(c.map((v) => +v.toFixed(4)));
    }
    color.push(row);
  }
  // 每格是否出三角形：与 terrain.js:37-39 同一判据（格心在轮廓内）
  const cellIn = [];
  for (let j = 0; j < nz; j++) {
    const row = [];
    for (let i = 0; i < nx; i++) row.push(inPoly(minX + (i + 0.5) * gsz, minZ + (j + 0.5) * gsz) ? 1 : 0);
    cellIn.push(row);
  }
  // 城墙走**简化轮廓**：原始行政边界有几万个点（烘焙会直接爆面数），而墙是沿边的一条带子，
  // 容差 1.0 以内的形状差异看不出来；游戏侧碰撞用的是 simplifyPoly(pts, 0.1)，偏差仍在墙厚以内
  const wallOutline = simplifyPoly(pts, 1.0);
  const peaks = F.features.peaks.map((d) => {
    const [px, pz] = F.P2(d);
    // base = 峰脚下的地形高度（js/terrain.js:64 的 baseY），不带上就是"雪峰浮在半空/陷进地里"
    return { at: [+px.toFixed(2), +pz.toFixed(2)], h: d[2], r: d[3], base: +F.heightAtLocal(px, pz).toFixed(3) };
  });
  return {
    id: crypto.createHash('sha1').update(cityKey).digest('hex').slice(0, 8),
    city: cityKey, key: cityKey, zh: city.name || cityKey,
    radius: radiusOf(cityKey, city), seed: cfg.seed ?? 42,
    outline: pts.map(([x, z]) => [+x.toFixed(3), +z.toFixed(3)]),
    wall: { outline: wallOutline.map(([x, z]) => [+x.toFixed(3), +z.toFixed(3)]), ...WALL },
    skirt: SKIRT,
    peaks, peakColors: { rock: PEAK_ROCK, snow: PEAK_SNOW, snowRange: cfg.snow ?? [5.2, 6.6] },
    grid: { minX, minZ, gsz, nx, nz }, step: F.step,
    qy, cellIn, color,
  };
}

export function allGround(only) {
  return (only ? [only] : cityIds()).map((id) => groundSpec(id));
}

if (import.meta.filename === process.argv[1]) {
  const kind = argOf('--kind') || 'gate';
  const build = kind === 'landmark' ? allLandmarks : kind === 'ground' ? allGround : allGates;
  const prefix = kind === 'landmark' ? 'landmarks' : kind === 'ground' ? 'ground' : 'gates';
  const specs = build(city);
  const outPath = path.join(ROOT, 'scripts/bake/specs', `${prefix}.${city || 'all'}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ kind, specs }, null, 1));
  const uniq = new Set(specs.map((s) => s.id));
  console.log(`${kind} 规格 ${specs.length} 条（唯一 id ${uniq.size}）→ ${path.relative(ROOT, outPath)}`);
  if (kind === 'ground') {
    for (const s of specs) {
      const cells = s.cellIn.reduce((n, row) => n + row.reduce((m, v) => m + v, 0), 0);
      console.log(`  ${s.key}: 网格 ${s.grid.nx}×${s.grid.nz}（格距 ${s.grid.gsz}）出格 ${cells}，`
        + `轮廓 ${s.outline.length} 点 → 城墙 ${s.wall.outline.length} 点，雪峰 ${s.peaks.length} 座`);
    }
  } else if (kind === 'landmark') {
    const by = {};
    for (const s of specs) by[s.type] = (by[s.type] || 0) + 1;
    console.log('地标类型分布', JSON.stringify(by));
  } else {
    const by = {};
    for (const s of specs) by[s.style.id] = (by[s.style.id] || 0) + 1;
    console.log('风格分布', JSON.stringify(by));
  }
}
