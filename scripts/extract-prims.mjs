// 用浏览器里的**真实 three** 把程序化模型提取成"图元清单"，供 Blender 做风格化加工
// （倒角 / 顶点色 AO / 按角度拆边），与 gates/landmarks/ground 同一条烘焙管线。
//
// 为什么在浏览器里提取：造型代码在 js/models/**（词宠 47KB 参数化 + 玩家 + NPC），
// 手工移植到 Python 必然分叉（对方方案 §七 的担忧）。这里让**同一份 JS 代码**产出图元，
// JS 永远是唯一规则源，Blender 只负责加工。
//
//   node scripts/extract-prims.mjs --kind pet        → .cache/bake/prims.pet.json
//   node scripts/extract-prims.mjs --kind player
//   node scripts/extract-prims.mjs --kind npc
//
// 提取内容：每格的 kind/key/显示名 + 图元数组 {type, params, color, emissive, ei, rough,
// matrix(局部到根的 4x4)}。几何参数只取"影响外形"的那些（three 的细分参数在这里固定）。
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const kind = optOf('--kind', 'pet');
const limit = Number(optOf('--limit', '0'));
const PORT = 6150 + Math.floor(Math.random() * 30);

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ save: null, token: 't', ok: true, rank: 1, rows: [] }),
}));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '提取', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(async ({ kind, limit }) => {
  const THREE = window.THREE;
  // 动态 import 的相对路径会解析到站点根，必须用绝对 URL
  const m = await import(new URL('js/models.js', location.href).href);
  // 提取器：把一棵 Object3D 树压成图元数组（矩阵 = 该图元到根的变换）
  const ROUND = (v) => Math.round(v * 1e4) / 1e4;
  // skipRoots：其它部件的根。提取某个部件时要跳过它们的子树，
  // 否则"父部件"会把"子部件"的几何也算一遍（head 是 body 的子节点 → 头被烘两次、游戏里重叠）
  function extract(root, skipRoots = []) {
    const insideOtherPart = (o) => {
      // 向上遍历：先遇到 root 说明属于本部件（不是"别人的子树"）；
      // 先遇到别的部件根才跳过。少了"先遇到 root"这一步，head（body 的子节点）会被整格丢掉。
      let q = o;
      while (q) {
        if (q === root) return false;
        for (const sr of skipRoots) if (sr && sr !== root && q === sr) return true;
        q = q.parent;
      }
      return false;
    };
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const prims = [];
    let nanDropped = 0;
    let keptDropped = 0;
    const localBox = new THREE.Box3();
    let partDropped = 0;
    root.traverse((o) => {
      if (!o.isMesh && !o.isSprite) return;
      // keep = 运行时自己管（名牌/欢迎牌/脸部小件），不进烘焙资产：
      // 脸部若被烘进 GLB，就会出现"GLB 的脸 + 程序化的脸"两层，且眨眼引用指向程序化那份
      if (o.userData && o.userData.keep) { keptDropped++; return; }
      if (insideOtherPart(o)) { partDropped++; return; }
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const g = o.geometry;
      if (!g || !g.type) return;
      const p = g.parameters || {};
      const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      // 几何自带的平移/旋转（kit 的 add() 用 geo 变换做偏移的很少，这里统一并进矩阵）
      // 退化图元（矩阵含 NaN）：造型里位置/缩放算成 NaN 的件，游戏里不可见，
      // 但会让 Blender 侧整格失败 → 这里直接丢掉并记数
      const raw = local.elements.map((v) => Math.round(v * 1e4) / 1e4);
      if (raw.some((v) => !Number.isFinite(v))) { nanDropped++; return; }
      // 局部系包围盒（与图元矩阵同一基准）：审计用它做"烘焙 == 源"的对账
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox) localBox.union(g.boundingBox.clone().applyMatrix4(local));
      prims.push({
        type: g.type,
        params: {
          w: p.width, h: p.height, d: p.depth, r: p.radius, rs: p.radialSegments,
          rt: p.radiusTop, rb: p.radiusBottom, len: p.length,
          // 环面：three 是 {radius 大半径, tube 小半径}，别搞反（搞反会把环建成一团）
          R: p.radius, tube: p.tube,
          arc: p.arc, seg: p.segments, ri: p.innerRadius, ro: p.outerRadius,
          ws: p.widthSegments, hs: p.heightSegments, detail: p.detail,
        },
        // 自定义几何（BufferGeometry）：顶点在 JS 里现算，必须把顶点/索引一起带走，
        // 否则 Blender 侧无法重建（这是"按图元重建"唯一需要特例的一类）
        // 逐顶点用 getX/getY/getZ：若是交错缓冲，.array 是整个交错数组（长度不是 3 的倍数），
        // 直接读会把其它属性的数值当成坐标（实测踩过：长度 20 的数组 → IndexError）
        customVerts: (g.type === 'BufferGeometry' && g.attributes && g.attributes.position)
          ? (() => {
            const pa = g.attributes.position; const a = [];
            for (let i = 0; i < pa.count; i++) a.push(ROUND(pa.getX(i)), ROUND(pa.getY(i)), ROUND(pa.getZ(i)));
            return a;
          })() : null,
        customIdx: g.type === 'BufferGeometry' && g.index
          ? Array.from(g.index.array) : null,
        color: mat && mat.color && mat.color.getHexString ? '#' + mat.color.getHexString() : '#CCCCCC',
        emissive: mat && mat.emissive && mat.emissive.getHexString ? '#' + mat.emissive.getHexString() : null,
        ei: mat && mat.emissiveIntensity != null ? mat.emissiveIntensity : 0,
        rough: mat && mat.roughness != null ? mat.roughness : 0.9,
        flat: !!(mat && mat.flatShading),
        matrix: raw,
      });
    });
    root.userData.__nanDropped = nanDropped;
    root.userData.__keptDropped = keptDropped;
    root.userData.__partDropped = partDropped;
    // 源造型的包围盒：用**局部系**（与 GLB 同基准）——setFromObject 给的是世界坐标，
    // 对部件（如 head 挂在 body 下）会差出一个偏移，审计就会误报"烘歪了"
    const bb = localBox.isEmpty() ? null : localBox;
    root.userData.__bbox = bb ? { minY: bb.min.y, maxY: bb.max.y, minX: bb.min.x, maxX: bb.max.x } : null;
    return prims;
  }

  const cells = [];
  if (kind === 'pet') {
    const { WORDS } = await import(new URL('js/words.js', location.href).href);
    let list = WORDS.filter((w) => w.pet);
    if (limit) list = list.slice(0, limit);
    for (const w of list) {
      const g = m.buildPet(w.pet);
      const prims = extract(g);
      cells.push({ key: w.id, pet: w.pet, zh: w.zh, en: w.en, prims, nanDropped: g.userData.__nanDropped || 0, keptDropped: g.userData.__keptDropped || 0, bbox: g.userData.__bbox });
    }
  } else if (kind === 'player') {
    // 按部件提取：动画只驱动 parts 里的这些 Group（腿/手/头/气球），
    // 换装时对每个部件单独换 children，Group 的 transform 与引用都不动。
    const PART_NAMES = ['legL', 'legR', 'armL', 'armR', 'body', 'head', 'balloon'];
    let PART_ROOTS = [];
    for (const gender of ['boy', 'girl']) {
      for (const wear of [{}, { hat: 'wizard' }, { hat: 'flower' }, { balloon: true, wand: true }]) {
        const tag = [gender, wear.hat || '', wear.balloon ? 'balloon' : '', wear.wand ? 'wand' : ''].filter(Boolean).join('-');
        const built = m.buildPlayer(gender, wear);
        const g = built && built.group ? built.group : built;
        const parts = (built && built.parts) || {};
        PART_ROOTS = Object.values(parts).filter((x) => x && x.isObject3D);
        // 先把所有部件从 group 里摘出来单独提取（避免整棵树重复计入）
        const done = new Set();
        for (const pn of PART_NAMES) {
          const part = parts[pn];
          if (!part || done.has(part)) continue;
          done.add(part);
          const prims = extract(part, PART_ROOTS);   // 相对"部件自身"的局部坐标（跳过其它部件的子树）
          if (!prims.length) continue;
          cells.push({ key: tag + ':' + pn, variant: tag, part: pn, prims, nanDropped: part.userData.__nanDropped || 0, keptDropped: part.userData.__keptDropped || 0, bbox: part.userData.__bbox });
        }
        // 剩下的（不在 parts 里的散件，如气球绳/魔杖星）按"整棵树的差集"提取一次
        // rest：直接排除所有部件子树（skipRoots 语义准确；之前的"矩阵指纹"法因基准不同永远匹配不上）
        const rest = extract(g, PART_ROOTS);
        if (rest.length) cells.push({ key: tag + ':rest', variant: tag, part: 'rest', prims: rest });
      }
    }
  } else if (kind === 'npc') {
    // NPC 由管理器按城生成：直接取现成实例（成都 14 个），连腿的轴心一起记下来
    const mgr = window.__game.npcs;
    const list = (mgr && mgr.npcs) || [];
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      // 只提取"腿"（动画驱动 legL/legR 的 position.z）与"其余"两部分：
      // 其余部分作为一个部件（NPC 的身体不再细分，动画不碰它）
      const legPrims = extract(n.legL, [n.legR]);
      if (legPrims.length) cells.push({ key: 'npc' + i + ':leg', variant: 'npc' + i, part: 'leg', prims: legPrims, bbox: n.legL.userData.__bbox });
      const all = extract(n.group, [n.legL, n.legR]);
      // 去掉两条腿的图元（腿已单独成格）：按"是否属于 legL/legR 子树"过滤
      const legCount = legPrims.length * 2;
      const bodyPrims = all.slice(0, Math.max(0, all.length - legCount));
      if (bodyPrims.length) cells.push({ key: 'npc' + i + ':body', variant: 'npc' + i, part: 'body', prims: bodyPrims });
    }
  }
  return { kind, cells };
}, { kind, limit });

const CACHE = path.join(ROOT, '.cache/bake');
fs.mkdirSync(CACHE, { recursive: true });
const file = path.join(CACHE, `prims.${kind}.json`);
fs.writeFileSync(file, JSON.stringify(out));
const primTotal = out.cells.reduce((s, c) => s + c.prims.length, 0);
console.log(`[extract] ${kind}：${out.cells.length} 格，图元合计 ${primTotal}（均值 ${Math.round(primTotal / (out.cells.length || 1))}）`);
console.log(`[extract] → ${path.relative(ROOT, file)}  ${(fs.statSync(file).size / 1024).toFixed(0)}KB`);
const types = {};
for (const c of out.cells) for (const p of c.prims) types[p.type] = (types[p.type] || 0) + 1;
console.log('[extract] 几何类型分布:', JSON.stringify(types));
if (errs.length) console.log('[extract] 页面异常:', errs.slice(0, 3));
await ctx.close();
srv.stop();
