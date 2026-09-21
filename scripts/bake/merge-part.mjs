// 把某一类的分册（.cache/<kind>.manifest.json）合并进 assets/models/manifest.json。
// 与 scripts/bake/run.mjs 的合并口径一致：每个资产补 v = 文件内容哈希（运行时用 file?v=hash 取，
// 换资产即换 URL、不破长缓存）。
//
//   node scripts/bake/merge-part.mjs pet [player] [npc] ...
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MF = path.join(ROOT, 'assets/models/manifest.json');
const kinds = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!kinds.length) {
  console.log('用法：node scripts/bake/merge-part.mjs <kind> [...]');
  process.exit(1);
}

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
const mf = JSON.parse(fs.readFileSync(MF, 'utf8'));
mf.kinds = mf.kinds || {};

for (const kind of kinds) {
  const part = path.join(ROOT, `.cache/${kind}.manifest.json`);
  if (!fs.existsSync(part)) { console.log(`跳过 ${kind}：没有分册 ${path.relative(ROOT, part)}`); continue; }
  const j = JSON.parse(fs.readFileSync(part, 'utf8'));
  let n = 0, missing = 0;
  for (const [id, e] of Object.entries(j.assets)) {
    const f = path.join(ROOT, 'assets/models', e.file);
    if (!fs.existsSync(f)) { missing++; continue; }
    mf.assets[id] = { kind, ...e, v: sha(f) };
    n++;
  }
  mf.kinds[kind] = { blender: j.blender, generated: j.generated, count: n };
  console.log(`${kind}：合并 ${n} 个${missing ? `（${missing} 个文件缺失，跳过）` : ''}`);
}

fs.writeFileSync(MF, JSON.stringify(mf, null, 1));
console.log(`manifest 现在共 ${Object.keys(mf.assets).length} 个资产，类别：${Object.keys(mf.kinds).join(', ')}`);
