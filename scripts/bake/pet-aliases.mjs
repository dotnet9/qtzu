// 把"petId → 外观 key"的别名写进合并 manifest（词宠去重 932 → 358 种外观）。
// 运行时按 petId 查同一份 GLB（assets.js 的别名表）。
//
// 数据来源：.cache/bake/prims.pet.json（提取器输出，每格带 wordId 与 petId）
//          + 去重规则与 .cache/dedupe-pets.mjs 完全一致（同一签名函数）。
import fs from 'node:fs';

// 词表：审计要用它做引用检查（words.js 的 pet id 是动态生成的，正则抓不到）
const { WORDS } = await import('../../js/words.js');
fs.writeFileSync('.cache/bake/pets-words.json', JSON.stringify({ petIds: WORDS.filter((w) => w.pet).map((w) => w.pet) }));
const prims = JSON.parse(fs.readFileSync('.cache/bake/prims.pet.json', 'utf8'));
const sigOf = (c) => JSON.stringify(c.prims.map((p) => [p.type, p.params, p.color, p.emissive]));
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
};
const aliasesOf = new Map();     // 外观 key → [petId...]
for (const c of prims.cells) {
  const key = 'p' + hash(sigOf(c));
  if (!aliasesOf.has(key)) aliasesOf.set(key, []);
  aliasesOf.get(key).push(c.pet);
}

const mfPath = 'assets/models/manifest.json';
const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
let n = 0, missing = 0;
for (const [id, e] of Object.entries(mf.assets)) {
  if (e.kind !== 'pet') continue;
  const al = aliasesOf.get(e.key) || aliasesOf.get(id);
  if (!al) { missing++; continue; }
  e.aliases = al;
  n++;
}
fs.writeFileSync(mfPath, JSON.stringify(mf, null, 1));
console.log(`已给 ${n} 个词宠条目写入别名（未匹配 ${missing} 个）`);
const sample = Object.values(mf.assets).find((e) => e.kind === 'pet' && e.aliases && e.aliases.length > 2);
console.log('示例:', sample.key, '代表', sample.aliases.length, '个 petId:', sample.aliases.slice(0, 5).join(', '));
