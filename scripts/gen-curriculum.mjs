import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const cur = await import(pathToFileURL('E:/github/Apps/AIGame/game/js/curriculum.js').href);
const merged = JSON.parse(fs.readFileSync('tools/pep-merged.json', 'utf8'));
const raw = fs.readFileSync('tools/pep-raw-1.txt', 'utf8') + '\n' + fs.readFileSync('tools/pep-raw-2.txt', 'utf8');

// 每个条目 -> 所属册（取第一个非 cur 的 vols）
const volOf = x => (x.vols || []).find(v => v !== 'cur') || null;
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
const isSingle = s => /^[A-Za-z][A-Za-z'’.-]*$/.test(s);

// 现有 curriculum 里已出现的英文
const present = new Set();
for (const gk of Object.keys(cur.CURRICULUM))
  for (const u of cur.CURRICULUM[gk].units)
    for (const it of u.words) present.add(norm(it.split('|')[0]));

// 收集每册新增
const add = {}; // gk -> {words:[], phrases:[]}
for (const x of [...merged.single, ...merged.phrase]) {
  const k = norm(x.en);
  if (present.has(k)) continue;
  const vol = volOf(x);
  if (!vol) continue;
  (add[vol] ||= { words: [], phrases: [] });
  (isSingle(x.en) ? add[vol].words : add[vol].phrases).push(`${x.en}|${x.zh}`);
}

const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const unitFor = (vol, kind, arr) => {
  const label = kind === 'words' ? '拓展词汇·单词' : '拓展词汇·短语';
  return `    U('${label}', [${arr.map(e => `'${esc(e)}'`).join(', ')}]),`;
};

let out = `// 词宠岛 · 课程库（参考人教版 PEP 3-6 年级核心词汇与常用表达，可在本文件直接增删）
// 格式：'单词或短语|中文'，单词/短语都会生成语音并支持跟读评分

const U = (name, words) => ({ name, words });
const S = (name, units) => ({ name, units });

export const CURRICULUM = {\n`;

const VOL_META = {
  '3a': ['3a', '三年级上册'], '3b': ['3b', '三年级下册'],
  '4a': ['4a', '四年级上册'], '4b': ['4b', '四年级下册'],
  '5a': ['5a', '五年级上册'], '5b': ['5b', '五年级下册'],
  '6a': ['6a', '六年级上册'], '6b': ['6b', '六年级下册'],
};
for (const gk of Object.keys(cur.CURRICULUM)) {
  const G = cur.CURRICULUM[gk];
  const [key, name] = VOL_META[gk];
  out += `  '${key}': S('${name}', [\n`;
  for (const u of G.units) {
    out += `    U('${esc(u.name)}', [${u.words.map(e => `'${esc(e)}'`).join(', ')}]),\n`;
  }
  const a = add[gk];
  if (a) {
    if (a.words.length) out += unitFor(gk, 'words', a.words) + '\n';
    if (a.phrases.length) out += unitFor(gk, 'phrases', a.phrases) + '\n';
  }
  out += `  ]),\n`;
}
out += `};\n\nexport function gradeKey(grade, term) { return grade + (term === 'up' ? 'a' : 'b'); }\n`;
fs.writeFileSync('game/js/curriculum.js', out);

// 统计
let nw = 0, np = 0;
for (const gk of Object.keys(add)) { nw += add[gk].words.length; np += add[gk].phrases.length; }
console.log('appended: words', nw, 'phrases', np);
console.log('by vol:', Object.entries(add).map(([k, v]) => `${k}(W${v.words.length}/P${v.phrases.length})`).join(' '));
