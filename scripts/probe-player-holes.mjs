// 主角"空洞"探针：对**游戏内真实主角**（已经换成烘焙 GLB 的那一份）做射线扫描，
// 把正面/背面/俯视三个方向打成一个 ASCII 命中图 —— '#' 打到几何、'.' 打空。
//
// 为什么需要它：内嵌浏览器面板在本机不可用，截图读不了。而"身体是空的"这种话
// 必须落到"哪一块没有几何"才能修。射线扫描是这件事的**决定性证据**：
// 它不关心模型是程序化还是 GLB，只回答"这条视线能不能打到东西"。
//
//   node scripts/probe-player-holes.mjs [--gender boy|girl] [--hat wizard]
import { serve, launch } from './browser.mjs';

const argOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GENDER = argOf('--gender', 'boy');
const HAT = argOf('--hat', '');

const PORT = 6210 + Math.floor(Math.random() * 9);
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
await page.addInitScript(([gender, hat]) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '探针', registered: true, city: 'chengdu', gender, wear: hat ? { hat } : {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, [GENDER, HAT]);
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
// 等换装完成（head 部件挂上 asset）
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const THREE = window.THREE;
  const g = window.__game;
  // 用副本：不打扰场上那个（它会跟着相机/动画动）
  const clone = g.player.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);          // 模型空间：1 单位 = 1 米（主角高约 1.0）
  const scn = new THREE.Scene();
  scn.add(clone);
  clone.updateMatrixWorld(true);

  const parts = {};
  const odd = [];
  for (const [k, o] of Object.entries(g.playerParts || {})) {
    if (!o) { odd.push(`${k}=${String(o)}`); continue; }
    if (!o.isObject3D) { odd.push(`${k}:${typeof o}`); continue; }
    const b = new THREE.Box3().setFromObject(o);
    let tri = 0, mesh = 0;
    o.traverse((n) => {
      if (n.isMesh && n.geometry) {
        mesh++;
        const idx = n.geometry.index;
        tri += idx ? idx.count / 3 : (n.geometry.attributes.position ? n.geometry.attributes.position.count / 3 : 0);
      }
    });
    parts[k] = {
      mesh, tri: Math.round(tri),
      asset: o.userData.asset || null,
      bbox: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => +v.toFixed(3)),
    };
  }

  // 射线扫描：origin + dir，步进网格
  const ray = new THREE.Raycaster();
  ray.far = 20;
  const scan = (ox, oy, oz, dx, dy, dz, uRange, vRange, U, V) => {
    const rows = [];
    for (let j = 0; j < V; j++) {
      const v = vRange[0] + (vRange[1] - vRange[0]) * (j / (V - 1));
      let line = '';
      for (let i = 0; i < U; i++) {
        const u = uRange[0] + (uRange[1] - uRange[0]) * (i / (U - 1));
        // 用 u/v 作为垂直于 dir 的平面坐标：这里三视图都是轴对齐的，直接展开
        const o = new THREE.Vector3(ox + u * (dx === 0 ? 1 : 0), oy + v * (dy === 0 ? 1 : 0) + (dy !== 0 ? 0 : 0), oz);
        if (dx !== 0) o.set(ox, oy + v, oz + u);        // 从 ±x 看：u→z, v→y
        else if (dy !== 0) o.set(ox + u, oy, oz + v);   // 从 ±y 看：u→x, v→z
        else o.set(ox + u, oy + v, oz);                 // 从 ±z 看：u→x, v→y
        ray.set(o, new THREE.Vector3(dx, dy, dz));
        const hit = ray.intersectObject(clone, true);
        line += hit.length ? '#' : '.';
      }
      rows.push(line);
    }
    return rows;
  };

  // 正面（从 -z 朝 +z 看，模型面朝 +z 时这是"看脸"）：x ∈ [-0.32,0.32], y ∈ [0,1.0]
  const front = scan(0, 0, -3, 0, 0, 1, [-0.32, 0.32], [0, 1.0], 33, 26);
  // 背面：从 +z 朝 -z 看
  const back = scan(0, 0, 3, 0, 0, -1, [-0.32, 0.32], [0, 1.0], 33, 26);
  // 俯视：从上方朝下看，x ∈ [-0.32,0.32], z ∈ [-0.32,0.32]（观察"从上往下有没有洞"）
  const top = scan(0, 3, 0, 0, -1, 0, [-0.32, 0.32], [-0.32, 0.32], 33, 26);

  // 行内断口分析：真正的"身体是空的"表现为**一行里出现多段命中**（中间缺一块）。
  // 比"整行空格占比"有意义得多 —— 球体左右两侧本来就是空的，那是轮廓不是洞。
  // ⚠ 还要忽略"正好 1 格宽"的断口：射线打在球面顶点列（x=0 的经线）上会漏一格，
  //   那是数值伪影，实测烘焙与程序化模型都会出现（光栅化渲染的剪影是连续的）。
  const runsOf = (row) => {
    const runs = [];
    let start = -1;
    for (let i = 0; i <= row.length; i++) {
      const on = i < row.length && row[i] === '#';
      if (on && start < 0) start = i;
      if (!on && start >= 0) { runs.push([start, i - 1]); start = -1; }
    }
    return runs;
  };
  // 躯干带（world y 0.28~0.62 = 短裤/上衣/腰带）里，每一行的断口宽度
  const gaps = [];
  for (let j = 0; j < 26; j++) {
    const y = 1.0 - (j / 25);
    if (y < 0.28 || y > 0.62) continue;
    const runs = runsOf(front[j]);
    for (let k = 1; k < runs.length; k++) {
      const w = runs[k][0] - runs[k - 1][1] - 1;
      if (w >= 2) gaps.push({ y: +y.toFixed(2), width: w, at: runs[k - 1][1] + 1 });
    }
  }

  return {
    parts, odd, front, back, top,
    torsoGaps: gaps,
    runsPerRow: front.map((r, j) => ({ y: +(1.0 - j / 25).toFixed(2), runs: runsOf(r).length })),
  };
});

const show = (title, rows, hint) => {
  console.log(`\n${title}${hint ? '  ' + hint : ''}`);
  const V = rows.length, U = rows[0].length;
  for (let j = 0; j < V; j++) {
    const y = 1.0 - (j / (V - 1));
    console.log(`  y=${y.toFixed(2)}  ${rows[j]}`);
  }
};
console.log(`主角空洞扫描 · gender=${GENDER} hat=${HAT || '(默认草帽)'}`);
show('【正面】从 -z 看（左=右耳侧，右=左耳侧）', out.front);
show('【背面】从 +z 看', out.back);
show('【俯视】从上方看（左=-x，右=+x）', out.top);
console.log(`\n【躯干带 y0.28~0.62 的行内断口】（真正的"洞"= 一行里中间缺一块，宽 ≥2 格）`);
if (!out.torsoGaps.length) console.log('  没有断口 ✓ 躯干是连续的一整块');
else for (const g of out.torsoGaps) console.log(`  ⚠ y=${g.y} 在第 ${g.at} 列起缺 ${g.width} 格`);
const multi = out.runsPerRow.filter((r) => r.y >= 0.28 && r.y <= 0.62 && r.runs > 2);
console.log(`  躯干带里出现 3 段以上的行：${multi.length ? multi.map((r) => `y=${r.y}(${r.runs}段)`).join(' ') : '0 行 ✓'}`);
console.log('\n【部件】');
for (const [k, v] of Object.entries(out.parts)) {
  console.log(`  ${k.padEnd(7)} mesh=${String(v.mesh).padStart(3)} tri=${String(v.tri).padStart(5)} asset=${String(v.asset).padEnd(28)} bbox=${JSON.stringify(v.bbox)}`);
}
if (out.odd && out.odd.length) console.log('  非 Object3D 条目：' + out.odd.join(', '));
await ctx.close();
srv.stop();
