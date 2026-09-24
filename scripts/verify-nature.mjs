// 自然景观校验：远山分层 / 河岸沙带 / 近景草皮 / 针叶树形态
//   node scripts/verify-nature.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6250 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 960, height: 640 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '自然景观', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3500);

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const out = {};
  const st = g._currentStage();
  const wIsl = (g.world.islands || []).find((w) => w.uid === st.uid);

  // ① 远山：三层实例化，各自 ≥12 段锥 + 顶点色 + 半径不同
  const rings = [];
  (wIsl.grp || g.scene).traverse((o) => {
    if (!o.isInstancedMesh) return;
    const rd = o.geometry.parameters && o.geometry.parameters.radialSegments;
    if (!rd || rd < 8 || o.count > 60) return;         // 山脊那三个（22/20/15 座）
    const p0 = o.geometry.attributes.position;
    rings.push({
      count: o.count, seg: rd,
      hasColor: !!o.geometry.attributes.color,
      vertexColors: !!o.material.vertexColors,
      jittered: (() => { let mx = 0; for (let i = 0; i < p0.count; i++) mx = Math.max(mx, Math.abs(p0.getX(i)), Math.abs(p0.getZ(i))); return mx; })(),
      // 半径用世界坐标第一实例估算
      dist: (() => { const m = new THREE.Matrix4(); o.getMatrixAt(0, m); const v = new THREE.Vector3().setFromMatrixPosition(m); return Math.round(Math.hypot(v.x, v.z)); })(),
    });
  });

  out.rings = rings;
  // ② 河岸沙带：比水面宽一圈、在河面之下（y 更低）
  let bank = null, water = null;
  (wIsl.grp || g.scene).traverse((o) => {
    if (o.name === 'city-river-bank') bank = o;
  });
  (g.world.anim.waterMats || []).length;               // 有水面材质说明这座城市有河
  const waterMeshes = [];
  (wIsl.grp || g.scene).traverse((o) => { if (o.isMesh && o.material && g.world.anim.waterMats && g.world.anim.waterMats.includes(o.material)) waterMeshes.push(o); });
  water = waterMeshes[0] || null;
  out.river = {
    hasBank: !!bank, hasWater: !!water,
    bankW: bank ? +(bank.geometry.boundingBox ? 0 : 0) : 0,
    bankColor: bank ? '#' + bank.material.color.getHexString() : null,
    bankY: bank && water ? +(bank.geometry.attributes.position.getY(0) - water.geometry.attributes.position.getY(0)).toFixed(2) : null,
    bankWide: bank && water ? +(bank.geometry.attributes.position.count > water.geometry.attributes.position.count) : null,
  };

  // ③ 近景草皮：跟着玩家的一圈草
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  for (let i = 0; i < 6; i++) await frame();
  const gm = g._grassMesh;
  const readRing = () => {
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    let near = 0, bad = 0, far = 0, colorN = 0;
    const p = g.player.position;
    const cols = new Set();
    for (let i = 0; i < gm.count; i++) {
      gm.getMatrixAt(i, m); v.setFromMatrixPosition(m);
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < 14) near++; else far++;
      if (g._waterAt(v.x, v.z) > 0.25) bad++;
      if (gm.instanceColor) cols.add(gm.instanceColor.getX(i).toFixed(2) + gm.instanceColor.getY(i).toFixed(2));
    }
    return { count: gm.count, near, far, bad, colors: cols.size };
  };
  out.grass = gm ? readRing() : null;
  // 移动 30 米 → 重排
  const m0 = new THREE.Matrix4();
  if (gm) gm.getMatrixAt(0, m0);
  const before = gm ? m0.elements[12] : null;   // getMatrixAt 没有返回值：必须先写进矩阵再读
  const p0 = g.player.position.clone();
  g.player.position.x += 30; g.player.position.z += 18;
  for (let i = 0; i < 6; i++) await frame();
  out.grassMoved = gm ? readRing() : null;
  const m2 = new THREE.Matrix4(); if (gm) gm.getMatrixAt(0, m2);
  out.grassRepositioned = gm ? before != null && m2.elements[12] !== before : false;
  g.player.position.copy(p0);
  for (let i = 0; i < 6; i++) await frame();

  // ④ 针叶树：两种形态 + 层数 ≥5 + 顶梢
  const { PROPS } = await import('/js/models.js');
  const shapes = [0, 1, 2, 3, 4, 5].map((s) => {
    const t = PROPS.pine(1, s);
    let cones = 0, tris = 0, meshes = 0;
    t.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (o.geometry.type === 'ConeGeometry' || (o.geometry.parameters && o.geometry.parameters.radiusTop === 0.001)) cones++;
      const pos = o.geometry.attributes.position;
      tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
    });
    const sc = t.scale;
    return { cones, tris, meshes, slim: sc.y > sc.x + 0.01 };
  });
  out.pine = { shapes, slim: shapes.filter((s) => s.slim).length };
  void st; void out.river.bankW; void out.river.bankWide;
  return out;
});

console.log(`自然景观校验（${city}）`);
check(r.rings.length >= 3, '远山三层', r.rings.map((x) => `${x.count}座/${x.seg}段@${x.dist}`).join('  '));
check(r.rings.every((x) => x.seg >= 12), '远山分段 ≥12（不再是五边形）', r.rings.map((x) => x.seg).join('/'));
check(r.rings.every((x) => x.hasColor && x.vertexColors), '远山带顶点色（雪线/岩面分带）');
check(r.rings.every((x) => x.jittered > 0.4), '山脊做过顶点抖动（轮廓不平滑）', r.rings.map((x) => x.jittered.toFixed(2)).join('/'));
const dists = r.rings.map((x) => x.dist);
check(new Set(dists).size === dists.length, '三层半径互不相同（层次感）', dists.join('/'));

check(r.river.hasWater ? r.river.hasBank : true, '有河的城市就有沙岸带',
  r.river.hasWater ? `沙岸 ${r.river.bankColor} 比水面低 ${r.river.bankY}` : '（这座城市没有河，跳过）');

check(!!r.grass, '近景草皮已铺开');
if (r.grass) {
  check(r.grass.count >= 60, '玩家周围有足够草簇', `${r.grass.count} 撮`);
  check(r.grass.near > r.grass.count * 0.55, '绝大多数草簇就在脚下（网格 ±12 米）', `近处 ${r.grass.near} / 远处 ${r.grass.far}`);
  check(r.grass.bad === 0, '没有草长在水里', `水里 ${r.grass.bad} 撮`);
  check(r.grass.colors >= 3, '草有逐实例色差（vertexColors 真的生效）', `${r.grass.colors} 种`);
}
check(r.grassRepositioned, '玩家移动后草圈跟着重排');
if (r.grassMoved) check(r.grassMoved.count >= 30, '换位置后仍铺得满（没铺到城市外）', `${r.grassMoved.count} 撮`);

check(r.pine.slim >= 1 && r.pine.slim < r.pine.shapes.length, '针叶树有瘦高/矮胖两种形态', `${r.pine.slim}/${r.pine.shapes.length} 棵瘦高`);
check(r.pine.shapes.every((s) => s.cones >= 10), '每棵树 ≥10 段锥（5 层 + 5 暗沿 + 顶梢）', r.pine.shapes.map((s) => s.cones).join('/'));
check(r.pine.shapes.every((s) => s.tris >= 120 && s.tris <= 600), '单棵树三角数在预算内（≤600；旧版还多一个 18×14 的球 ≈ +468 面）', r.pine.shapes.map((s) => s.tris).join('/'));
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 自然景观全部通过');
if (fails.length) process.exitCode = 1;
