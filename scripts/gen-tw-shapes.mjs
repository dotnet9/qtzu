// 台湾 4 城轮廓生成：taiwan-atlas 的 22 县市真实边界（TopoJSON）→ 简化归一化多边形
//
// 为什么单独有这个脚本：阿里 DataV 没有台湾子级行政边界（710100/710200/710000 全部 404），
// 所以 js/city-shape.js 里这 4 城一直是 13~15 点的手绘 blob——这是"轮廓不像"的主要来源。
// 本脚本从 taiwan-atlas（内政部开放资料转出的县市界）解码真实边界，与 DataV 城市同口径归一化，
// 写回 js/city-shape.js 的 TW_SHAPES。
//
// 坐标约定与 CITY_SHAPES 完全一致：x+ = 东（经度），z+ = 南（纬度取负），
// bbox 居中 + 最长半轴归一到 [-1,1]，闭合（末点 = 首点）。
//
// 用法：node scripts/gen-tw-shapes.mjs [--refetch]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, 'tw-counties.topo.json');
const SHAPE_JS = join(__dirname, '..', 'js', 'city-shape.js');
const URL_SRC = 'https://cdn.jsdelivr.net/npm/taiwan-atlas@1/counties-10t.json';

// 城市 → 县市名（taiwan-atlas 用繁体）
const WANT = {
  taipei: ['台北市', '臺北市'],
  kaohsiung: ['高雄市'],
  taichung: ['台中市', '臺中市'],
  tainan: ['台南市', '臺南市'],
};

async function ensureSource() {
  if (existsSync(CACHE) && !process.argv.includes('--refetch')) return;
  const res = await fetch(URL_SRC);
  if (!res.ok) throw new Error(`下载失败 ${res.status}：${URL_SRC}`);
  writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()));
  console.log('已缓存县市界：', CACHE);
}

/* ---- TopoJSON 解码 ---- */
function decode(topo) {
  const { scale, translate } = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * scale[0] + translate[0], y * scale[1] + translate[1]]; });
  });
  const ringOf = idxs => {
    const out = [];
    for (const i of idxs) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      for (const p of a) {
        const last = out[out.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
      }
    }
    return out;
  };
  const counties = {};
  for (const g of topo.objects.counties.geometries) {
    const name = g.properties && (g.properties.COUNTYNAME || g.properties.COUNTYENG);
    if (!name) continue;
    const polys = g.type === 'Polygon' ? [g.arcs] : (g.type === 'MultiPolygon' ? g.arcs : []);
    counties[name] = polys.flatMap(poly => poly.map(ringOf));
  }
  return counties;
}

/* ---- Douglas–Peucker（显式栈，避免深递归） ---- */
function simplify(pts, tol) {
  const n = pts.length;
  if (n <= 8) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const mid = n >> 1; keep[mid] = 1;
  const stack = [[0, mid], [mid, n - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (j <= i + 1) continue;
    const [ax, az] = pts[i], [bx, bz] = pts[j];
    const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
    let maxi = -1, maxd = -1;
    for (let k = i + 1; k < j; k++) {
      const [px, pz] = pts[k];
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / l2));
      const dx = px - (ax + ex * t), dz = pz - (az + ez * t);
      const d = dx * dx + dz * dz;
      if (d > maxd) { maxd = d; maxi = k; }
    }
    if (maxd > tol * tol) { keep[maxi] = 1; stack.push([i, maxi], [maxi, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// 取面积最大的环（多环时主体）
function biggestRing(rings) {
  let best = null, bestA = -1;
  for (const r of rings) {
    let a = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = r; }
  }
  return best;
}

await ensureSource();
const counties = decode(JSON.parse(readFileSync(CACHE, 'utf8')));
const result = {};
for (const [id, names] of Object.entries(WANT)) {
  const key = names.find(n => counties[n]);
  if (!key) { console.log(`跳过 ${id}：县市界里没有 ${names.join('/')}`); continue; }
  const ring = biggestRing(counties[key]);
  const pts = ring.map(([lon, lat]) => [lon, -lat]);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  // 简化容差与 DataV 城市同量级：点数落在 150~400，既保住海岸曲率又不让文件膨胀
  const simple = simplify(pts, span * 0.0035);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const half = Math.max(Math.max(...xs) - cx, Math.max(...zs) - cz) || 1;
  const norm = simple.map(([x, z]) => [+((x - cx) / half).toFixed(4), +((z - cz) / half).toFixed(4)]);
  const first = norm[0], last = norm[norm.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) norm.push(first.slice());
  result[id] = norm;
  console.log(`${id.padEnd(10)} ${key}  原始 ${ring.length} → 简化 ${simple.length} → 闭合 ${norm.length}`);
}

/* ---- 写回 js/city-shape.js ---- */
const L = readFileSync(SHAPE_JS, 'utf8').split(/\r?\n/);
const i = L.findIndex(s => s.includes('const TW_SHAPES = {'));
const j = L.findIndex((s, k) => k > i && s.trim() === '};');
if (i < 0 || j < 0) throw new Error('js/city-shape.js 里没找到 TW_SHAPES 块');
const head = [
  '// 台湾 4 城：DataV 无子级行政边界，用 taiwan-atlas 的 22 县市真实边界（TopoJSON）解码后归一化。',
  '// 生成脚本：scripts/gen-tw-shapes.mjs（源缓存 scripts/tw-counties.topo.json）。示意用途，不做精确行政判定。',
];
// 每条轮廓一行，过长则按 100 点折行，避免单行几万字符
const body = Object.entries(result).map(([id, pts]) => {
  const chunks = [];
  for (let k = 0; k < pts.length; k += 100) chunks.push(pts.slice(k, k + 100).map(p => `[${p[0]},${p[1]}]`).join(','));
  return `  ${id}: [${chunks.join(',\n    ')}],`;
});
L.splice(i, j - i + 1, 'const TW_SHAPES = {', ...head, ...body, '};');
writeFileSync(SHAPE_JS, L.join('\n'));
console.log('已写回 js/city-shape.js 的 TW_SHAPES');
