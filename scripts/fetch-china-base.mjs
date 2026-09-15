#!/usr/bin/env node
// 中国地图底图烘焙：DataV 全国(100000)/海南(460000)/台湾(710000) 边界
// → 道格拉斯-普肯简化 → js/china-base.js（经纬度环，供游戏地图弹窗绘制）
// 用法：node scripts/fetch-china-base.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'china-base.js');
const UA = 'QTZuBot/1.0 (kids edu game; china map base)';

async function fetchJson(ad) {
  const res = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${ad}.json`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${ad} HTTP ${res.status}`);
  return res.json();
}
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
};
function simplify(pts, tol) {   // DP，tol 单位=度
  if (pts.length <= 4) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = (px - ax - dx * t) ** 2 + (py - ay - dy * t) ** 2;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol * tol && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const outerRings = (gj) => {
  const geom = gj.features[0].geometry;
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polys.map(rings => rings[0]);
};

(async () => {
  const [nat, hainan, taiwan] = await Promise.all([fetchJson('100000'), fetchJson('460000'), fetchJson('710000')]);
  // 全国：最大环=大陆本土；其余大岛（≥0.002 度²）取前 12（台湾/海南单独来自省数据，这里会自然去重不过滤也无妨）
  const natRings = outerRings(nat).map(r => ({ ring: r, area: ringArea(r) })).sort((a, b) => b.area - a.area);
  const mainland = simplify(natRings[0].ring, 0.05);
  const islands = natRings.slice(1).filter(r => r.area >= 0.002).slice(0, 12)
    .map(r => simplify(r.ring, 0.03));
  const hainanRing = outerRings(hainan).map(r => ({ ring: r, area: ringArea(r) })).sort((a, b) => b.area - a.area)[0];
  const taiwanRing = outerRings(taiwan).map(r => ({ ring: r, area: ringArea(r) })).sort((a, b) => b.area - a.area)[0];
  const round = ring => ring.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
  const src = `// 中国地图底图（脚本生成，勿手改）：scripts/fetch-china-base.mjs
// 数据源：阿里 DataV GeoAtlas（100000 全国 / 460000 海南 / 710000 台湾），经度、纬度（度）。
// 已重度简化（容差 0.03~0.05 度），只够 420px 小地图绘制，勿作他用。
export const CHINA_MAINLAND = ${JSON.stringify(round(mainland))};
export const CHINA_ISLANDS = {
  hainan: ${JSON.stringify(round(hainanRing.ring))},
  taiwan: ${JSON.stringify(round(taiwanRing.ring))},
  others: ${JSON.stringify(islands.map(round))},
};
`;
  writeFileSync(OUT, src);
  console.log(`写入 ${OUT}`);
  console.log(`大陆 ${mainland.length} 点，海南 ${hainanRing.ring.length} 环面积 ${hainanRing.area.toFixed(3)}°²，台湾 ${taiwanRing.ring.length}，附岛 ${islands.length}`);
})();
