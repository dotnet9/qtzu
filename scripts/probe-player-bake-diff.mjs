// 主角几何对照：同一套射线，分别扫「游戏内（烘焙 GLB）」与「程序化新建」的主角，
// 逐格比对 —— 找出烘焙管线是否丢了网格（这是"身体是空的"最可能的真因）。
//
//   node scripts/probe-player-bake-diff.mjs [--gender boy]
import { serve, launch } from './browser.mjs';

const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GENDER = argOf('--gender', 'boy');

const PORT = 6220 + Math.floor(Math.random() * 9);
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript((gender) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '对照', registered: true, city: 'chengdu', gender, wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, GENDER);
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1200);

const out = await page.evaluate(async (gender) => {
  const THREE = window.THREE;
  const g = window.__game;
  const mod = await import(new URL('js/models.js', location.href).href);

  // 同一套扫描，作用于任意 Object3D
  const scanOf = (root) => {
    const scn = new THREE.Scene();
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.updateMatrixWorld(true);
    scn.add(root);
    const ray = new THREE.Raycaster();
    ray.far = 30;
    const one = (ox, oy, oz, dx, dy, dz, uR, vR, U, V) => {
      const rows = [];
      for (let j = 0; j < V; j++) {
        const v = vR[0] + (vR[1] - vR[0]) * (j / (V - 1));
        let line = '';
        for (let i = 0; i < U; i++) {
          const u = uR[0] + (uR[1] - uR[0]) * (i / (U - 1));
          const o = dx !== 0 ? new THREE.Vector3(ox, oy + v, oz + u)
            : dy !== 0 ? new THREE.Vector3(ox + u, oy, oz + v)
              : new THREE.Vector3(ox + u, oy + v, oz);
          ray.set(o, new THREE.Vector3(dx, dy, dz));
          line += ray.intersectObject(root, true).length ? '#' : '.';
        }
        rows.push(line);
      }
      return rows;
    };
    return {
      front: one(0, 0, -3, 0, 0, 1, [-0.32, 0.32], [0, 1.0], 33, 26),
      side: one(-3, 0, 0, 1, 0, 0, [-0.32, 0.32], [0, 1.0], 33, 26),   // 从 -x 看：u→z, v→y
      top: one(0, 3, 0, 0, -1, 0, [-0.32, 0.32], [-0.32, 0.32], 33, 26),
    };
  };
  const triOf = (root) => {
    let tri = 0, mesh = 0;
    root.traverse((n) => {
      if (n.isMesh && n.geometry) {
        mesh++;
        const idx = n.geometry.index;
        tri += idx ? idx.count / 3 : (n.geometry.attributes.position ? n.geometry.attributes.position.count / 3 : 0);
      }
    });
    return { mesh, tri: Math.round(tri) };
  };

  // A：游戏内（烘焙）
  const baked = g.player.clone(true);
  baked.position.set(0, 0, 0); baked.rotation.set(0, 0, 0);
  const A = { ...scanOf(baked), ...triOf(baked) };
  // B：程序化新建
  const fresh = mod.buildPlayer(gender, {}).group;
  const B = { ...scanOf(fresh), ...triOf(fresh) };
  return { A, B };
}, GENDER);

const diffRows = (a, b) => a.map((r, j) => {
  let line = '';
  for (let i = 0; i < r.length; i++) line += a[j][i] === b[j][i] ? (a[j][i] === '#' ? '#' : ' ') : (a[j][i] === '#' ? 'A' : 'B');
  return line;
});
const show = (title, rows, vR) => {
  console.log(`\n${title}`);
  for (let j = 0; j < rows.length; j++) console.log(`  y=${(vR[0] + (vR[1] - vR[0]) * (j / (rows.length - 1))).toFixed(2)}  ${rows[j]}`);
};

for (const view of ['front', 'side', 'top']) {
  console.log(`\n================ ${view.toUpperCase()} ================`);
  show('A = 游戏内（烘焙 GLB）', out.A[view], view === 'top' ? [-0.32, 0.32] : [0, 1.0]);
  show('B = 程序化新建', out.B[view], view === 'top' ? [-0.32, 0.32] : [0, 1.0]);
  show('差异  #=都有  A=只有烘焙有  B=只有程序化有', diffRows(out.A[view], out.B[view]), view === 'top' ? [-0.32, 0.32] : [0, 1.0]);
  let onlyB = 0, onlyA = 0;
  for (let j = 0; j < out.A[view].length; j++) for (let i = 0; i < out.A[view][j].length; i++) {
    if (out.A[view][j][i] !== out.B[view][j][i]) { if (out.B[view][j][i] === '#') onlyB++; else onlyA++; }
  }
  console.log(`  只在程序化里命中：${onlyB} 格   只在烘焙里命中：${onlyA} 格`);
}
console.log(`\n三角数：烘焙 ${out.A.tri}（${out.A.mesh} 网格） / 程序化 ${out.B.tri}（${out.B.mesh} 网格）`);
await ctx.close();
srv.stop();
