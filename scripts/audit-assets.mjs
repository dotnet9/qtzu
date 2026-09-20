// 资产审计：manifest ↔ 磁盘 ↔ 代码引用 三方一致 + 契约/预算校验
// （美术升级方案 §二.1 的验收：0 缺失、0 孤儿、0 超预算）
//
//   node scripts/audit-assets.mjs               全部类别
//   node scripts/audit-assets.mjs --kind gate   只看校门
//
// 为什么要有这个脚本：
//   1) 烘焙是"人在 Blender 里生成的二进制"，最容易出的错不是崩，而是"烘了 400 个、
//      游戏永远不去取"（key 对不上）与"改了造型忘了重烘"（manifest 与文件不一致）；
//   2) 多数资产错误在截图里看得见，但"穿地 / 占地超半径 / 匾额挂空"这三类在缩略图里
//      几乎看不出来，却会让校门浮空、和牌子重叠、校徽飘在梁外面；
//   3) 这三类恰好都能用数值判死，所以放在这里当回归闸门。
//
// 任何一项不过 → 退出码 1（可直接挂到 CI / 发版前手工跑）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS = path.join(ROOT, 'assets/models');
const MANIFEST = path.join(MODELS, 'manifest.json');
const optOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const only = optOf('--kind');

// 预算（与方案 §4.2 的表一致）：超了就等于"资产把仓库和首屏吃穿"
const BUDGET = {
  // gate 体积 120KB → 160KB：阶段三加了"按角度拆边"（硬棱 = 每个面一套法线），实测单资产
  // +25~35%、三角面不变；单城首屏实测 2.79MB（北京）仍低于 3MB 上限。方案 §4.2 的表已同步。
  gate: { tri: 6000, bytes: 160 * 1024 },
  pet: { tri: 2500, bytes: 40 * 1024 },
  landmark: { tri: 10000, bytes: 200 * 1024 },
  prop: { tri: 3000, bytes: 60 * 1024 },
  npc: { tri: 3000, bytes: 60 * 1024 },
  player: { tri: 6000, bytes: 150 * 1024 },
};
const CITY_BYTES_MAX = 3 * 1024 * 1024;   // 单城首屏新增体积上限（成都试点实测后写回方案）
// 脚底容差按类别给：校门立在城心山坡上，必须贴地；城市地标沿用 js/world.js 的原始造型
// （熊猫肚子本来就坐进地面 0.2，程序化版本一模一样），所以放宽——它仍拦得住真事故
// （曾经的"门前空地立成一堵 1.2 高的墙"是 -0.55）
const GROUND_TOL = { gate: 0.06, landmark: 0.35 };
const HALF_MAX = 5.2;                     // 游戏按 scale 0.5 + 2.6 边距摆放（js/game.js:2134）→ 半宽/半深上限 5.2
// 地标占地必须不超 js/world.js:1395 的 LM_HALF（摆放边距/碰撞/欢迎牌高度都按它算）
const LM_HALF = { gate: 3.7, tower: 1.7, wall: 7.5, panda: 3.2, ice: 2.6, palm: 3.6, dome: 2.8,
  mountain: 4.5, pavilion: 2.8, bridge: 3.4, grotto: 2.5, harbor: 3.4 };

// ---- 读 GLB：只解 JSON 块，三角数与包围盒从 accessor 的 min/max / count 直接算（不落 BIN）----
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('不是 GLB（magic 不对）');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  let tri = 0, prims = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes || []) {
    for (const p of m.primitives) {
      prims++;
      const pos = json.accessors[p.attributes.POSITION];
      tri += Math.floor((p.indices != null ? json.accessors[p.indices].count : pos.count) / 3);
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], pos.min[i]); hi[i] = Math.max(hi[i], pos.max[i]); }
    }
  }
  return { json, tri, prims, lo, hi };
}

// ---- 代码引用面：游戏会去取哪些 key ----
// 校门的 key 是校名（js/game.js:2150 用 it.zh || it.name 查 manifest），所以"烘了但
// data/cities 里没有这所学校"= 孤儿资产；反过来没烘的学校照旧走程序化门，不算错。
function uniNames() {
  const dir = path.join(ROOT, 'data/cities');
  const out = new Map();   // 校名 → 城市 id
  for (const c of fs.readdirSync(dir)) {
    const f = path.join(dir, c, 'universities.json');
    if (!fs.existsSync(f)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    for (const u of j.unis || []) out.set(u.zh || u.name, c);
  }
  return out;
}
// 地标：key 是"城市#槽位"（js/world.js:1400 的 lms.forEach 序号），与校门同理——
// 烘了但 city.json 的 landmarks 表里没有这个槽位 = 游戏永远不会取它的孤儿资产
function landmarkKeys() {
  const dir = path.join(ROOT, 'data/cities');
  const out = new Map();
  for (const c of fs.readdirSync(dir)) {
    const f = path.join(dir, c, 'city.json');
    if (!fs.existsSync(f)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const lv = j.level || {};
    const lms = (lv.landmarks && lv.landmarks.length) ? lv.landmarks : [j.landmark, 'pavilion'];
    lms.forEach((type, i) => {
      if (i > 0 && type === lms[0]) return;      // 同 js/world.js:1401
      out.set(`${c}#${i}`, type);
    });
  }
  return out;
}
const REFS = {
  gate: { keyOf: (e) => e.zh, keys: uniNames, what: '校名' },
  landmark: { keyOf: (e) => e.key, keys: landmarkKeys, what: '城市地标位' },
};

function walkGlb(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walkGlb(p, acc);
    else if (p.endsWith('.glb')) acc.push(path.relative(MODELS, p).split(path.sep).join('/'));
  }
  return acc;
}

if (!fs.existsSync(MANIFEST)) {
  console.log('没有 assets/models/manifest.json：仓库里一个烘焙资产都没有（游戏全程走程序化，不算错）');
  console.log('要生成：node scripts/bake/run.mjs --city chengdu');
  process.exit(0);
}

const mf = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const entries = Object.entries(mf.assets).filter(([, e]) => !only || e.kind === only);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fails = [], warns = [];
const perCity = new Map();   // 城市 → 新增体积

console.log(`manifest：blender ${mf.blender}，${Object.keys(mf.assets).length} 个资产`
  + (only ? `（本类 ${entries.length} 个）` : ''));

// ---- 1) manifest ↔ 磁盘 ----
for (const [id, e] of entries) {
  const file = path.join(MODELS, e.file);
  if (!fs.existsSync(file)) { fails.push(`缺失：${id} → ${e.file} 不在磁盘上（重跑 run.mjs）`); continue; }
  const bytes = fs.statSync(file).size;
  if (e.bytes !== bytes) fails.push(`${id}：体积 manifest ${e.bytes} ≠ 磁盘 ${bytes}`);
  const v = sha(file).slice(0, 10);
  if (e.v !== v) fails.push(`${id}：内容哈希 ${e.v} ≠ ${v}（manifest 与文件对不上：sw/HTTP 按 ?v= 长缓存，会拿到旧模型）`);
}

// ---- 2) 磁盘 ↔ manifest（孤儿文件）----
const knownFiles = new Set(Object.values(mf.assets).map((e) => e.file));
for (const rel of walkGlb(MODELS)) {
  if (!knownFiles.has(rel)) fails.push(`孤儿文件：${rel} 不在 manifest 里（删掉，或重跑 run.mjs 的合并步骤）`);
}

// ---- 3) 契约 + 预算（逐个 GLB）----
const byKind = {};
for (const [id, e] of entries) {
  const file = path.join(MODELS, e.file);
  if (!fs.existsSync(file)) continue;
  const b = BUDGET[e.kind] || {};
  let g;
  try { g = readGlb(file); } catch (err) { fails.push(`${id}：${err.message}`); continue; }
  byKind[e.kind] = byKind[e.kind] || { n: 0, tri: 0, bytes: 0 };

  // manifest 与 GLB 实测必须一致（改了造型忘了重跑合并 → 这里报警）
  if (e.tri !== g.tri) fails.push(`${id}：三角面 manifest ${e.tri} ≠ 实测 ${g.tri}`);
  const near = (a, b2) => Math.abs(a - b2) < 0.002;
  for (const ax of ['x', 'y', 'z']) {
    const i = { x: 0, y: 1, z: 2 }[ax];
    if (!near(e.bbox[ax][0], g.lo[i]) || !near(e.bbox[ax][1], g.hi[i])) {
      fails.push(`${id}：bbox.${ax} manifest ${e.bbox[ax]} ≠ 实测 [${g.lo[i].toFixed(3)}, ${g.hi[i].toFixed(3)}]`);
    }
  }
  // 原点在脚底：游戏用 _groundY 贴地（js/game.js:2151），穿地就是"校门陷进山坡"
  const gt = GROUND_TOL[e.kind] ?? 0.06;
  if (g.lo[1] < -gt) fails.push(`${id}：穿地 ${g.lo[1].toFixed(3)}（原点必须在脚底，本类容差 ${gt}）`);
  // 占地：摆放边距按 2.6 算的（js/game.js:2134），超了会和立牌/蛋重叠
  const halfX = Math.max(-g.lo[0], g.hi[0]), halfZ = Math.max(-g.lo[2], g.hi[2]);
  if (e.kind === 'gate' && (halfX > HALF_MAX || halfZ > HALF_MAX)) {
    fails.push(`${id}：占地半宽 ${halfX.toFixed(2)}/${halfZ.toFixed(2)} 超 ${HALF_MAX}（要么缩模型，要么同步改摆放边距）`);
  }
  // 地标还要卡 LM_HALF：世界摆放/碰撞/欢迎牌高度全按它算，超了就会压到牌子与蛋
  if (e.kind === 'landmark') {
    const cap = LM_HALF[e.used || e.type];
    if (cap && (halfX > cap || halfZ > cap)) {
      fails.push(`${id}：${e.type} 占地半宽 ${halfX.toFixed(2)}/${halfZ.toFixed(2)} 超 LM_HALF ${cap}（js/world.js:1395 要同步改）`);
    }
    if (e.used && e.used !== e.type) warns.push(`${id}：类型 ${e.type} 无造型，按 js 的兜底烘成 ${e.used}`);
  }
  // 朝向与节点名：对象 transform 必须烘进顶点（渲染时才有确定朝向）
  const nodes = g.json.nodes || [];
  if (nodes.length !== 1) fails.push(`${id}：节点 ${nodes.length} 个（应恰好 1 个合并节点）`);
  const n0 = nodes[0] || {};
  if (n0.name !== `${e.kind}_${id}`) fails.push(`${id}：节点名 ${n0.name} ≠ ${e.kind}_${id}`);
  if (n0.matrix || n0.translation || n0.rotation || n0.scale) fails.push(`${id}：节点带 transform（导出前必须 apply）`);
  // 匾额挂点（校门）：运行时按 beamY/fz 把校徽匾贴到梁正面，落不到模型里就是"牌子飘在门外面"
  if (e.kind === 'gate') {
    for (const k of ['beamY', 'beamW', 'fz']) {
      if (typeof e[k] !== 'number') fails.push(`${id}：缺 ${k}（校徽匾没有挂点）`);
    }
    if (e.beamY > g.hi[1] || e.beamY < 0) fails.push(`${id}：beamY ${e.beamY} 不在模型高度 [0, ${g.hi[1].toFixed(2)}] 内`);
    if (e.fz > g.hi[2] + 0.02 || e.fz < -g.hi[2]) warns.push(`${id}：fz ${e.fz} 贴着模型前边界 ${g.hi[2].toFixed(2)}（匾额可能悬空/穿梁）`);
  }
  // 预算
  if (b.tri && g.tri > b.tri) fails.push(`${id}：三角面 ${g.tri} 超预算 ${b.tri}`);
  if (b.bytes && e.bytes > b.bytes) fails.push(`${id}：体积 ${(e.bytes / 1024).toFixed(0)}KB 超预算 ${(b.bytes / 1024).toFixed(0)}KB`);
  byKind[e.kind].n++; byKind[e.kind].tri += g.tri; byKind[e.kind].bytes += e.bytes;
  if (e.city) perCity.set(e.city, (perCity.get(e.city) || 0) + e.bytes);
}

// ---- 4) 代码引用：烘了的 key，游戏必须真的会去取 ----
for (const kind of new Set(entries.map(([, e]) => e.kind))) {
  const ref = REFS[kind];
  if (!ref) { warns.push(`${kind}：还没有代码引用检查规则（REFS 里补一条）`); continue; }
  const keys = ref.keys();
  for (const [id, e] of entries.filter(([, x]) => x.kind === kind)) {
    const k = ref.keyOf(e);
    if (!keys.has(k)) fails.push(`孤儿资产：${kind} ${id}「${k}」在 data/cities 里找不到对应${ref.what}（游戏永远不会取它）`);
  }
}

// ---- 汇总 ----
for (const [kind, s] of Object.entries(byKind)) {
  const ref = REFS[kind];
  const total = ref ? ref.keys().size : null;
  console.log(`\n【${kind}】${s.n} 个，合计 ${(s.bytes / 1048576).toFixed(1)}MB，`
    + `三角面 ${s.tri}（均值 ${Math.round(s.tri / s.n)}）`
    + (total ? `；已烘 ${s.n}/${total}（其余 ${total - s.n} 个继续走程序化回退）` : ''));
  const b = BUDGET[kind];
  if (b) console.log(`  预算：三角面 ≤ ${b.tri}，单个 ≤ ${(b.bytes / 1024).toFixed(0)}KB`);
}
if (perCity.size) {
  const worst = [...perCity].sort((a, b) => b[1] - a[1]);
  console.log(`\n【单城首屏新增】` + worst.map(([c, n]) => `${c} ${(n / 1048576).toFixed(2)}MB`).join('，')
    + `（上限 ${(CITY_BYTES_MAX / 1048576).toFixed(0)}MB）`);
  for (const [c, n] of worst) if (n > CITY_BYTES_MAX) fails.push(`单城 ${c} 新增 ${(n / 1048576).toFixed(2)}MB 超上限（方案 §4.6 的 Draco 决策点）`);
}
for (const w of warns) console.log(`⚠ ${w}`);
if (fails.length) {
  console.log(`\n✗ ${fails.length} 处不合格：`);
  for (const f of fails) console.log('  ' + f);
  process.exitCode = 1;
} else {
  console.log(`\n✓ 0 缺失 / 0 孤儿 / 0 超预算（${entries.length} 个资产）`);
}
