import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const w = await import(pathToFileURL('E:/github/Apps/AIGame/game/js/words.js').href);
const all = w.ISLANDS;
const themed = all.filter(i => !/^x/.test(i.key) && !['greet', 'campus', 'houseph', 'schoolph', 'weekph', 'actph', 'travelph', 'pastph'].includes(i.key));
const phrase = all.filter(i => ['greet', 'campus', 'houseph', 'schoolph', 'weekph', 'actph', 'travelph', 'pastph'].includes(i.key));
const extra = all.filter(i => /^x/.test(i.key));
console.log('themed', themed.length, 'phrase', phrase.length, 'extra', extra.length);

const placed = [];
function planOne(isl, R0, R1, minClear) {
  let best = null;
  for (let R = R0; R <= R1 && !best; R += 2) {
    let cand = null;
    for (let deg = 0; deg < 360; deg += 1) {
      const a = deg * Math.PI / 180;
      const cx = +(R * Math.cos(a)).toFixed(1), cz = +(R * Math.sin(a)).toFixed(1);
      let clear = 1e9;
      for (const o of placed) clear = Math.min(clear, Math.hypot(cx - o.cx, cz - o.cz) - (isl.r + o.r));
      if (clear >= minClear && (!cand || clear > cand.clear)) cand = { cx, cz, clear };
    }
    if (cand) best = cand;
  }
  if (!best) throw new Error('cannot place ' + isl.key);
  placed.push({ key: isl.key, r: isl.r, cx: best.cx, cz: best.cz });
  return best;
}

// 内圈主题岛：按半径从大到小，先占大位
for (const isl of [...themed].sort((a, b) => b.r - a.r)) {
  const b = planOne(isl, 58, 118, 7);
  console.log(`  T ${isl.key.padEnd(10)} r=${String(isl.r).padStart(4)} (${b.cx}, ${b.cz}) clr=${b.clear.toFixed(1)}`);
}
for (const isl of [...phrase].sort((a, b) => b.r - a.r)) {
  const b = planOne(isl, 118, 158, 7);
  console.log(`  P ${isl.key.padEnd(10)} r=${String(isl.r).padStart(4)} (${b.cx}, ${b.cz}) clr=${b.clear.toFixed(1)}`);
}
for (const isl of [...extra].sort((a, b) => b.r - a.r)) {
  const b = planOne(isl, 150, 205, 6);
  console.log(`  X ${isl.key.padEnd(10)} r=${String(isl.r).padStart(4)} (${b.cx}, ${b.cz}) clr=${b.clear.toFixed(1)}`);
}

const map = Object.fromEntries(placed.map(p => [p.key, { cx: p.cx, cz: p.cz }]));
const maxExt = Math.max(...placed.map(p => Math.max(Math.abs(p.cx) + p.r, Math.abs(p.cz) + p.r)));
console.log('max extent', maxExt.toFixed(1));
fs.writeFileSync('tools/island-positions.json', JSON.stringify(map, null, 1));

// 更新 words.js（内圈 24 座，兼容单/双引号 key）
let src = fs.readFileSync('game/js/words.js', 'utf8');
let n = 0;
for (const [key, pos] of Object.entries(map)) {
  if (/^x/.test(key)) continue;
  const re = new RegExp(`([\\{,]\\s*key: ["']${key}["'][^\\n]*?cx: )-?[\\d.]+(, cz: )-?[\\d.]+`);
  const before = src;
  src = src.replace(re, `$1${pos.cx}$2${pos.cz}`);
  if (src !== before) n++; else console.warn('  ! words.js not patched', key);
}
fs.writeFileSync('game/js/words.js', src);
console.log('words.js patched', n);

// 更新 pep-extra.js 的 cx/cz（28 座）
let ex = fs.readFileSync('game/js/pep-extra.js', 'utf8');
let m = 0;
for (const [key, pos] of Object.entries(map)) {
  if (!/^x/.test(key)) continue;
  const re = new RegExp(`(key: "${key}"[^\\n]*?cx: )-?[\\d.]+(, cz: )-?[\\d.]+`);
  const before = ex;
  ex = ex.replace(re, `$1${pos.cx}$2${pos.cz}`);
  if (ex !== before) m++; else console.warn('  ! pep-extra not patched', key);
}
fs.writeFileSync('game/js/pep-extra.js', ex);
console.log('pep-extra patched', m);
