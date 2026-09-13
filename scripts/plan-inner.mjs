import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const w = await import(pathToFileURL('E:/github/Apps/AIGame/game/js/words.js').href);
const all = w.ISLANDS;
const themed = all.slice(0, 16);
const phrase = all.slice(16, 24);
console.log('themed', themed.length, 'phrase', phrase.length, 'total', all.length);

const MIN = 5;
const placed = [];
const result = {};
function placeOne(isl, R0, R1) {
  let best = null;
  for (let R = R0; R <= R1; R += 2) {
    let cand = null;
    for (let deg = 0; deg < 360; deg += 1) {
      const a = deg * Math.PI / 180;
      const cx = +(R * Math.cos(a)).toFixed(1), cz = +(R * Math.sin(a)).toFixed(1);
      let clear = 1e9;
      for (const o of placed) clear = Math.min(clear, Math.hypot(cx - o.cx, cz - o.cz) - (isl.r + o.r));
      if (clear >= MIN && (!cand || clear > cand.clear)) cand = { cx, cz, clear };
    }
    if (cand) { best = cand; break; } // 最小可行半径
  }
  if (!best) { // 放宽
    for (let R = R0; R <= R1; R += 2) {
      for (let deg = 0; deg < 360; deg += 1) {
        const a = deg * Math.PI / 180;
        const cx = +(R * Math.cos(a)).toFixed(1), cz = +(R * Math.sin(a)).toFixed(1);
        let clear = 1e9;
        for (const o of placed) clear = Math.min(clear, Math.hypot(cx - o.cx, cz - o.cz) - (isl.r + o.r));
        if (!best || clear > best.clear) best = { cx, cz, clear };
      }
    }
  }
  placed.push({ ...isl, cx: best.cx, cz: best.cz });
  result[isl.key] = { cx: best.cx, cz: best.cz, clear: +best.clear.toFixed(1) };
  console.log(`  ${isl.key.padEnd(11)} r=${String(isl.r).padStart(4)} -> (${best.cx}, ${best.cz}) 净空=${best.clear.toFixed(1)}`);
}
console.log('-- 主题岛（内圈）--');
for (const isl of themed) placeOne(isl, 56, 108);
console.log('-- 短语岛（中圈）--');
for (const isl of phrase) placeOne(isl, 112, 150);

const maxExt = Math.max(...placed.map(p => Math.max(Math.abs(p.cx) + p.r, Math.abs(p.cz) + p.r)));
console.log('inner max extent', maxExt.toFixed(1));
fs.writeFileSync('tools/island-positions.json', JSON.stringify(result, null, 1));

// ---- 回写 words.js 内圈 24 岛坐标 ----
let src = fs.readFileSync('game/js/words.js', 'utf8');
let patched = 0;
for (const [key, pos] of Object.entries(result)) {
  // 匹配该 key 所在对象里的 cx/ cz
  const re = new RegExp(`(\\{ key: '${key}'[^\\n]*?cx: )-?[\\d.]+(, cz: )-?[\\d.]+`);
  const before = src;
  src = src.replace(re, `$1${pos.cx}$2${pos.cz}`);
  if (src !== before) patched++; else console.warn('  ! not patched', key);
}
fs.writeFileSync('game/js/words.js', src);
console.log('patched words.js islands:', patched);
