import fs from 'node:fs';

// ---- 解析调研原始数据 ----
const raw = fs.readFileSync('tools/pep-raw-1.txt', 'utf8') + '\n' + fs.readFileSync('tools/pep-raw-2.txt', 'utf8');
const pep = {}; // gk -> {words:[], phrases:[]}
let gk = null, mode = null;
for (let line of raw.split(/\r?\n/)) {
  line = line.trim();
  if (!line || line.startsWith('#')) continue;
  const h = line.match(/^\[(\w+)\]$/);
  if (h) { gk = h[1]; pep[gk] = { words: [], phrases: [] }; mode = null; continue; }
  const m = line.match(/^([WP])\s+(.+)$/);
  if (!m || !gk) continue;
  mode = m[1] === 'W' ? 'words' : 'phrases';
  pep[gk][mode].push(m[2]);
}
console.log('raw by volume:');
for (const k of Object.keys(pep)) console.log(' ', k, 'W=' + pep[k].words.length, 'P=' + pep[k].phrases.length);

// ---- 解析现有 curriculum.js（模块化导入，避免正则误匹配注释） ----
const curSrc = fs.readFileSync('game/js/curriculum.js', 'utf8');
const curMod = await import('data:text/javascript;base64,' + Buffer.from(curSrc).toString('base64'));
const existing = [];
for (const gk of Object.keys(curMod.CURRICULUM))
  for (const u of curMod.CURRICULUM[gk].units)
    for (const it of u.words) existing.push(it);

// ---- 合并 + 去重（大小写不敏感） ----
const isSingle = s => /^[A-Za-z][A-Za-z'’.-]*$/.test(s);
const norm = en => en.toLowerCase().replace(/\s+/g, ' ').trim();
const map = new Map(); // normEn -> {en, zh, kinds:Set, vols:Set}
const add = (entry, vol) => {
  const i = entry.indexOf('|');
  if (i < 0) return;
  const en = entry.slice(0, i).trim(), zh = entry.slice(i + 1).trim();
  if (!en) return;
  const k = norm(en);
  if (!map.has(k)) map.set(k, { en, zh, vols: [] });
  const o = map.get(k);
  if (zh && (!o.zh || zh.length < o.zh.length)) o.zh = zh; // 取更短的释义
  if (vol && !o.vols.includes(vol)) o.vols.push(vol);
};
for (const e of existing) add(e, 'cur');
for (const [k, v] of Object.entries(pep)) { for (const e of v.words) add(e, k); for (const e of v.phrases) add(e, k); }

const all = [...map.values()];
const single = all.filter(x => isSingle(x.en));
const phrase = all.filter(x => !isSingle(x.en));
console.log('\n=== 合并后 ===');
console.log('unique total:', all.length, '| single:', single.length, '| phrase:', phrase.length);
console.log('\n各册去重后新增（相对现有课程库）:');
const exNorm = new Set(existing.map(e => norm(e.split('|')[0])));
for (const k of Object.keys(pep)) {
  const s = pep[k].words.concat(pep[k].phrases).map(e => norm(e.split('|')[0]));
  const uniq = [...new Set(s)];
  const nw = uniq.filter(x => !exNorm.has(x));
  console.log(' ', k, 'unique=' + uniq.length, 'new=' + nw.length);
}
fs.writeFileSync('tools/pep-merged.json', JSON.stringify({ single, phrase }, null, 1));
console.log('\nwritten tools/pep-merged.json');
