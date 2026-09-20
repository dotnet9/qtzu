// 烘焙总调度：生成规格 → 调 Blender 出 GLB → 合并 manifest（并可选做"二次烘焙哈希一致"自检）。
//
//   node scripts/bake/run.mjs --city chengdu           只烘成都（试点）
//   node scripts/bake/run.mjs --all                    全 52 城（386 校门 + 后续各类）
//   node scripts/bake/run.mjs --all --kinds gate,pet   指定类别
//   node scripts/bake/run.mjs --city chengdu --verify  再烘一遍比对文件哈希（可复现性自检）
//   node scripts/bake/run.mjs --city chengdu --limit 3 只烘前 3 个（调参用）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MODEL_DIR = path.join(ROOT, 'assets/models');
const CACHE = path.join(ROOT, '.cache');
const args = new Set(process.argv.slice(2));
const optOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const city = optOf('--city');
const all = args.has('--all') || !city;
const limit = optOf('--limit');
const nobudget = args.has('--nobudget');
const verify = args.has('--verify');
const kinds = (optOf('--kinds') || 'gate').split(',');

// Blender 装在仓库之外（便携版 zip，不提交 git）：BLENDER_PATH 优先，其次常见位置
function resolveBlender() {
  const cands = [process.env.BLENDER_PATH, process.env.BLENDER,
    'E:/tools/blender-4.5.14-windows-x64/blender.exe'];
  for (const root of ['C:/Program Files/Blender Foundation', 'D:/Program Files/Blender Foundation',
    os.homedir() + '/scoop/apps/blender/current', 'E:/tools']) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      cands.push(path.join(root, d, 'blender.exe'));
      for (const d2 of safeList(path.join(root, d))) cands.push(path.join(root, d, d2, 'blender.exe'));
    }
  }
  const hit = cands.filter(Boolean).find((p) => fs.existsSync(p));
  if (!hit) throw new Error('找不到 blender.exe：装便携版到 E:/tools/ 或设置 BLENDER_PATH');
  return hit;
}
const safeList = (d) => { try { return fs.readdirSync(d); } catch { return []; } };

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} 失败（exit ${r.status}）`);
  return r;
};

const BAKERS = {
  gate: { script: 'gates.py', prefix: 'gates' },
  landmark: { script: 'landmarks.py', prefix: 'landmarks' },
  ground: { script: 'ground.py', prefix: 'ground' },   // 城市地面/院墙/岩裙/雪峰（一城一个 GLB）
};

// 递归收集 .glb：产物在 assets/models/<kind>/ 子目录里，只列顶层会让"二次烘焙比对"空转通过
function walkGlb(dir, base = dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walkGlb(p, base, acc);
    else if (n.endsWith('.glb')) acc.push(path.relative(base, p));
  }
  return acc;
}

const t0 = Date.now();
const blender = resolveBlender();
console.log(`Blender: ${blender}`);
fs.mkdirSync(CACHE, { recursive: true });

for (const kind of kinds) {
  const baker = BAKERS[kind];
  if (!baker) throw new Error(`未知类别 ${kind}`);
  // 1) 规格：规则只有一份，specs.mjs 只做搬运（校门=一校一门，地标=一城最多三个）
  run(process.execPath, ['scripts/bake/specs.mjs', '--kind', kind, ...(all ? [] : ['--city', city])]);
  const specFile = path.join(ROOT, 'scripts/bake/specs', `${baker.prefix}.${city || 'all'}.json`);
  if (!fs.existsSync(specFile)) throw new Error(`缺少规格文件 ${specFile}`);

  // 2) 烘焙（--verify 时烘到临时目录再比哈希）
  const bakeTo = (outDir) => {
    const mf = path.join(CACHE, `${kind}.manifest.json`);
    run(blender, ['-b', '-P', path.join('scripts/bake', baker.script), '--',
      '--specs', specFile, '--out', outDir, '--manifest', mf,
      ...(limit ? ['--limit', limit] : []), ...(nobudget ? ['--nobudget', '1'] : [])]);
    return { mf, outDir };
  };
  const first = bakeTo(MODEL_DIR);
  if (verify) {
    const tmp = path.join(CACHE, `${kind}-rebake`);
    fs.rmSync(tmp, { recursive: true, force: true });
    bakeTo(tmp);
    // 要比对的文件清单来自本次烘焙的 <kind>.manifest.json，不靠猜目录名（gate→gates/ 是复数）
    const part = JSON.parse(fs.readFileSync(path.join(CACHE, `${kind}.manifest.json`), 'utf8'));
    const files = Object.values(part.assets).map((e) => e.file);
    if (!files.length) throw new Error(`可复现性自检没找到任何产物（规格为空 = 没校验）`);
    const mismatch = [];
    for (const rel of files) {
      const a = path.join(first.outDir, rel), b = path.join(tmp, rel);
      if (!fs.existsSync(b)) { mismatch.push(rel + '（重烘缺失）'); continue; }
      if (sha(a) !== sha(b)) mismatch.push(rel);
    }
    if (mismatch.length) throw new Error(`可复现性自检失败：${mismatch.length}/${files.length} 个文件两次烘焙不一致\n  ${mismatch.slice(0, 5).join('\n  ')}`);
    console.log(`[verify] ${kind} 二次烘焙 ${files.length} 个全部一致 ✓`);
  }
}

// 3) 合并 manifest：assets/<id> = {kind, ...}，供 js/assets.js 与校对台共用。
// 合并的是 .cache/ 里**各类别最近一次**的分册（不是本次跑了哪几类）——否则"只重烘地标"
// 会把校门从 manifest 里挤掉，产物变成孤儿文件，运行时也换不回来。
// 每个资产带 v = 文件内容哈希：serve.js:294 给 /models/ 的响应是一年 immutable 缓存，
// 运行时用 file?v=hash 取，换资产即换 URL，既不破缓存也不会拿到旧模型。
const kindsInCache = fs.existsSync(CACHE)
  ? fs.readdirSync(CACHE).filter((f) => f.endsWith('.manifest.json')).map((f) => f.replace('.manifest.json', ''))
  : [];
const merged = { blender: path.basename(path.dirname(blender)), generated: new Date().toISOString(), kinds: {}, assets: {} };
for (const kind of [...new Set([...kinds, ...kindsInCache])]) {
  const mf = path.join(CACHE, `${kind}.manifest.json`);
  if (!fs.existsSync(mf)) continue;
  const part = JSON.parse(fs.readFileSync(mf, 'utf8'));
  merged.kinds[kind] = { blender: part.blender, generated: part.generated, count: Object.keys(part.assets).length };
  merged.blender = part.blender;
  for (const [id, e] of Object.entries(part.assets)) {
    const f = path.join(MODEL_DIR, e.file);
    merged.assets[id] = { kind, ...e, v: fs.existsSync(f) ? sha(f).slice(0, 10) : 'missing' };
  }
}
merged.assets = Object.fromEntries(Object.entries(merged.assets).sort());
fs.mkdirSync(MODEL_DIR, { recursive: true });
fs.writeFileSync(path.join(MODEL_DIR, 'manifest.json'), JSON.stringify(merged, null, 1));
const bytes = Object.values(merged.assets).reduce((s, e) => s + (e.bytes || 0), 0);
console.log(`manifest: ${Object.keys(merged.assets).length} 个资产，合计 ${(bytes / 1048576).toFixed(1)}MB，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
