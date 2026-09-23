// 诊断"小人 3 条腿 / 衣服烂"：逐部件量网格数与包围盒，找出多出来的几何。
//
// 检查四件事：
//   1) 每个部件（legL/legR/body/head/armL/armR/balloon/wandTip/mouth/eyes）下的网格数与 bbox
//   2) player 根下是否有"不属于任何部件"的散件（rest 追加式换装可能留下）
//   3) 与"未换装"的程序化模型对比（同样的部件，几何数应一一对应）
//   4) 有没有重复的 bbox（重复换装的典型症状：两个一模一样的腿叠在一起）
import { serve, launch } from './browser.mjs';

const PORT = 6168;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '腿诊断', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
// 等玩家部件换装完成
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const THREE = window.THREE;
  const g = window.__game;
  const m = await import(new URL('js/models.js', location.href).href);
  const P = g.playerParts || {};
  const info = (o) => {
    const meshes = [];
    o.traverse((q) => { if (q.isMesh) meshes.push(q); });
    let tri = 0;
    for (const q of meshes) {
      const idx = q.geometry.index;
      tri += Math.round((idx ? idx.count : q.geometry.attributes.position.count) / 3);
    }
    const bb = meshes.length ? new THREE.Box3().setFromObject(o) : null;
    return {
      meshes: meshes.length, tri,
      bbox: bb ? [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => +v.toFixed(3)) : null,
      geoTypes: [...new Set(meshes.map((q) => q.geometry.type))].join(','),
    };
  };
  const out = { parts: {}, loose: [], playerKids: g.player.children.length, isGroup: g.player.isGroup };
  for (const k of ['legL', 'legR', 'body', 'head', 'armL', 'armR', 'balloon', 'wandTip', 'mouth']) {
    const o = P[k];
    out.parts[k] = o ? { ...info(o), kids: o.children.length, isGroup: o.isGroup === true, asset: o.userData.asset || null } : null;
  }
  out.eyes = (P.eyes || []).length;
  // 根下不属于任何部件的散件
  const partSet = new Set(Object.values(P).filter((x) => x && x.isObject3D));
  for (const c of g.player.children) {
    let isPart = false;
    for (const p of partSet) if (c === p) isPart = true;
    if (!isPart) out.loose.push({ type: c.type, name: c.name || '', meshes: (() => { let n = 0; c.traverse((q) => { if (q.isMesh) n++; }); return n; })(), asset: c.userData.asset || null });
  }
  // 对比：未换装的程序化模型
  const fresh = m.buildPlayer('boy', {});
  const freshParts = fresh.parts || {};
  out.proc = {};
  for (const k of ['legL', 'legR', 'body', 'head', 'armL', 'armR']) {
    out.proc[k] = freshParts[k] ? info(freshParts[k]) : null;
  }
  // 重复 bbox 检测（同尺寸同位置的网格 = 重复换装）
  // ⚠ 必须先排除"嵌套部件"：body 里嵌着 head / armL / armR（动画需要这个层级），
  //   不排除的话每个嵌套网格会被算两次（自己一次 + 父级 traverse 一次），
  //   报出 8 组"重复包围盒"的假警报。
  const partRoots = Object.entries(P).filter(([, o]) => o && o.isObject3D).map(([k, o]) => [k, o]);
  const isNested = (node, ownerKey) => {
    for (const [k, o] of partRoots) {
      if (k === ownerKey || o === node) continue;
      for (let n = node.parent; n; n = n.parent) if (n === o) return true;
    }
    return false;
  };
  const sigs = {};
  for (const [k, o] of partRoots) {
    o.traverse((q) => {
      if (!q.isMesh) return;
      if (isNested(q, k)) return;          // 这个网格属于另一个部件，会在那个部件里统计
      const bb = new THREE.Box3().setFromObject(q);
      const s = [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => v.toFixed(2)).join(',');
      sigs[s] = (sigs[s] || 0) + 1;
    });
  }
  out.dupBBox = Object.entries(sigs).filter(([, n]) => n > 1).map(([s, n]) => ({ bbox: s, count: n }));
  return out;
});

console.log('player 根子节点', r.playerKids, '| isGroup', r.isGroup, '| 眼睛', r.eyes);
console.log('\n【换装后】');
for (const [k, v] of Object.entries(r.parts)) {
  if (!v) { console.log(`  ${k.padEnd(8)} （无）`); continue; }
  console.log(`  ${k.padEnd(8)} 网格 ${String(v.meshes).padStart(2)} 三角 ${String(v.tri).padStart(5)} 子节点 ${v.kids} asset=${v.asset || '—'}`);
  console.log(`            bbox ${v.bbox ? v.bbox.join(', ') : '—'}  几何 ${v.geoTypes}`);
}
console.log('\n【未换装（程序化）】');
for (const [k, v] of Object.entries(r.proc)) {
  if (!v) { console.log(`  ${k.padEnd(8)} （无）`); continue; }
  console.log(`  ${k.padEnd(8)} 网格 ${String(v.meshes).padStart(2)} 三角 ${String(v.tri).padStart(5)}  几何 ${v.geoTypes}`);
}
if (r.loose.length) {
  console.log('\n⚠ player 根下的散件（不属于任何部件）:');
  for (const l of r.loose) console.log(`  ${l.type} "${l.name}" 网格 ${l.meshes} asset=${l.asset || '—'}`);
} else console.log('\nplayer 根下没有散件 ✓');
if (r.dupBBox.length) {
  console.log('\n⚠ 重复包围盒（疑似重复换装）:');
  for (const d of r.dupBBox.slice(0, 8)) console.log(`  ×${d.count}  ${d.bbox}`);
} else console.log('没有重复包围盒 ✓');
console.log('\n页面异常:', errs.length ? errs.slice(0, 3) : '无');
await ctx.close();
srv.stop();
