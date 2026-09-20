// 校门烘焙规格生成：复用 js/uni-gates.js 的权威规则（风格族 + 招牌门 + 配色），
// 输出给 Blender 用的纯数据 JSON。规则只有一份，不会出现"游戏里是 A 族、模型是 B 族"。
//
// 用法：node scripts/bake/specs.mjs --city chengdu   （不传 --city = 全 52 城）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { familyFor, SIGNATURE } from '../../js/uni-gates.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const argOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const city = argOf('--city');

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

if (import.meta.filename === process.argv[1]) {
  const specs = allGates(city);
  const outPath = path.join(ROOT, 'scripts/bake/specs', `gates.${city || 'all'}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ kind: 'gate', specs }, null, 1));
  const uniq = new Set(specs.map((s) => s.id));
  console.log(`校门规格 ${specs.length} 条（唯一 id ${uniq.size}）→ ${path.relative(ROOT, outPath)}`);
  const by = {};
  for (const s of specs) by[s.style.id] = (by[s.style.id] || 0) + 1;
  console.log('风格分布', JSON.stringify(by));
}
