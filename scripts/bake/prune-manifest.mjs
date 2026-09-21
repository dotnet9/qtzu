// 清理 manifest 里"文件已不存在"的条目（重烘后形状变了、旧键失效时会残留）。
//   node scripts/bake/prune-manifest.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MF = path.join(ROOT, 'assets/models/manifest.json');
const dry = process.argv.includes('--dry');
const mf = JSON.parse(fs.readFileSync(MF, 'utf8'));

const gone = [];
for (const [id, e] of Object.entries(mf.assets)) {
  if (!fs.existsSync(path.join(ROOT, 'assets/models', e.file))) gone.push([id, e.file, e.kind]);
}
if (!gone.length) { console.log('没有失效条目'); process.exit(0); }

const byKind = {};
for (const [, , k] of gone) byKind[k] = (byKind[k] || 0) + 1;
console.log(`失效条目 ${gone.length} 个（${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')}）：`);
for (const [id, f] of gone.slice(0, 6)) console.log(`  ${id} → ${f}`);
if (gone.length > 6) console.log(`  …其余 ${gone.length - 6} 个`);

if (!dry) {
  for (const [id] of gone) delete mf.assets[id];
  for (const k of Object.keys(mf.kinds)) {
    const n = Object.values(mf.assets).filter((e) => e.kind === k).length;
    if (mf.kinds[k]) mf.kinds[k].count = n;
    if (!n) delete mf.kinds[k];
  }
  fs.writeFileSync(MF, JSON.stringify(mf, null, 1));
  console.log(`已清理；manifest 现在 ${Object.keys(mf.assets).length} 个资产`);
}
