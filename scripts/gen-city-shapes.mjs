#!/usr/bin/env node
// 城市真实轮廓生成：阿里 DataV GeoAtlas 行政边界 GeoJSON → 简化归一化多边形
// 输出 js/city-shape-data.js（CITY_SHAPES），city-shape.js 优先使用。
// 流程：adcode → 拉取边界 → 取最大环 → Douglas–Peucker 简化(≤36点) → bbox 居中 + 最长半轴归一到 [-1,1] → 闭合
// 失败的城市跳过（游戏侧回退 SHAPES/blob），全部完成后重跑只增量补漏。

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { healNecks, healWidthForCity } from './heal-neck-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'js', 'city-shape-data.js');

// 52 城 adcode（GB/T 2260；县级市用其自身码）
const ADCODES = {
  beijing: '110000', shanghai: '310000', tianjin: '120000', chongqing: '500000',
  chengdu: '510100', guangzhou: '440100', shenzhen: '440300', zhuhai: '440400',
  hangzhou: '330100', shaoxing: '330600', nanjing: '320100', suzhou: '320500',
  wuxi: '320200', yangzhou: '321000', fuzhou: '350100', xiamen: '350200',
  quanzhou: '350500', jinan: '370100', qingdao: '370200', qufu: '370881',
  kaifeng: '410200', luoyang: '410300', zhengzhou: '410100', taiyuan: '140100',
  datong: '140200', shijiazhuang: '130100', chengde: '130800', shenyang: '210100',
  dalian: '210200', harbin: '230100', changchun: '220100', hohhot: '150100',
  yinchuan: '640100', xining: '630100', urumqi: '650100', lhasa: '540100',
  kunming: '530100', guiyang: '520100', nanning: '450100', haikou: '460100',
  sanya: '460200', changsha: '430100', nanchang: '360100', hefei: '340100',
  wuhan: '420100', xian: '610100', lanzhou: '620100', dunhuang: '620982',
  taipei: '710100', kaohsiung: '710200', taichung: '710300', tainan: '710400',
};

const UA = 'QTZuBot/1.0 (kids edu game; city boundary shapes)';

async function fetchBound(adcode, tries = 3) {
  const url = `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
      clearTimeout(t);
      if (res.status === 404) return null;           // 该码无边界（如台湾子级）→ 用回退
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 1200 * (i + 1)));
    }
  }
}

// 鞋带公式面积（绝对值）
function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a / 2);
}

// Douglas–Peucker 简化（返回子集，保序）
function simplify(pts, tol) {
  if (pts.length <= 4) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const qx = ax + dx * t, qy = ay + dy * t;
      const d = (px - qx) ** 2 + (py - qy) ** 2;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol * tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function toShape(ring) {
  // 环 → 高保真简化（≤3600 点，边缘顺滑）→ 居中归一化，附带真实经纬度中心与尺度
  let pts = ring.map(([x, y]) => [x, y]);
  if (pts.length > 1) {
    const [x0, y0] = pts[0];
    if (Math.hypot(pts[pts.length - 1][0] - x0, pts[pts.length - 1][1] - y0) < 1e-9) pts.pop();
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  // 高细节：极小容差起步，超出 3600 点上限再逐步放大容差（边缘点数 ≈ 原始数据，视觉顺滑）
  pts = simplify(pts, diag * 0.0002);
  for (const mul of [0.0005, 0.001, 0.002, 0.004]) {
    if (pts.length <= 3600) break;
    pts = simplify(ring.map(([x, y]) => [x, y]).slice(0, -1), diag * mul);
  }
  if (pts.length < 6) return null;
  const xs2 = pts.map(p => p[0]), ys2 = pts.map(p => p[1]);
  const cx = (Math.min(...xs2) + Math.max(...xs2)) / 2;
  const cz = (Math.min(...ys2) + Math.max(...ys2)) / 2;
  const half = Math.max(Math.max(...xs2) - cx, cx - Math.min(...xs2), Math.max(...ys2) - cz, cz - Math.min(...ys2)) || 1;
  // 经度 x → 游戏世界 x；纬度 y（北为正）→ 游戏世界 -z（北朝 -z，与指北针一致）
  const out = pts.map(([x, y]) => [
    Math.round(((x - cx) / half) * 1000) / 1000,
    Math.round((-(y - cz) / half) * 1000) / 1000,
  ]);
  out.push([out[0][0], out[0][1]]);          // 闭合
  return { pts: out, ctr: [Math.round(cx * 1000) / 1000, Math.round(cz * 1000) / 1000], halfDeg: Math.round(half * 10000) / 10000 };
}

function cityContents(cid) {
  // 通行宽按城市内容量（半径系数）推导，与 world/game 的钳制边距同源
  const rd = f => { try { return JSON.parse(readFileSync(join(__dirname, '..', 'data', 'cities', cid, f), 'utf8')); } catch { return null; } };
  const n = d => (d?.unis?.length || 0) + (d?.items?.length || 0);
  const cj = rd('city.json');
  return {
    radius: cj?.level?.radius || 28,
    contents: n(rd('universities.json')) + n(rd('foods.json')) + n(rd('scenes.json')),
  };
}

(async () => {
  // 全量重生成（高细节版）：不读旧文件做增量，直接覆盖
  const shapes = {};
  const failed = [], missing = [];
  const entries = Object.entries(ADCODES);
  let done = 0;
  const CONC = 6;
  for (let i = 0; i < entries.length; i += CONC) {
    await Promise.all(entries.slice(i, i + CONC).map(async ([cid, ad]) => {
      try {
        const gj = await fetchBound(ad);
        if (!gj) { missing.push(cid); return; }
        const geom = gj.features?.[0]?.geometry;
        if (!geom) { missing.push(cid); return; }
        const rings = geom.type === 'Polygon'
          ? [geom.coordinates[0]]
          : geom.coordinates.map(poly => poly[0]);
        rings.sort((a, b) => ringArea(b) - ringArea(a));
        const shape = toShape(rings[0]);
        if (shape) {
          // 窄颈修复：把腐蚀后不连通的细颈撑宽到可通行（见 heal-neck-lib.mjs）
          shape.pts = healNecks(shape.pts, healWidthForCity(cityContents(cid)));
          shapes[cid] = shape;
        }
        else missing.push(cid);
      } catch (e) {
        failed.push(`${cid}(${e.message})`);
      }
      done++;
    }));
    process.stdout.write(`\r${done}/${entries.length}`);
  }
  console.log('');
  // CITY_SHAPES 保持纯数组（city-shape.js/2D 地图兼容）；CITY_GEO 附真实经纬度中心与尺度（全国地图背景用）
  const body = Object.entries(shapes)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v.pts)}`)
    .join(',\n');
  const geo = Object.entries(shapes)
    .map(([k, v]) => `  ${k}: ${JSON.stringify({ ctr: v.ctr, halfDeg: v.halfDeg })}`)
    .join(',\n');
  const src = `// 城市真实轮廓数据（脚本生成，勿手改）：scripts/gen-city-shapes.mjs
// 来源：阿里 DataV GeoAtlas 行政边界（高保真 ≤3600 点，bbox 居中，最长半轴归一 [-1,1]）
// 经度 → x，纬度北 → -z。缺失城市由 city-shape.js 回退（SHAPES/blob）。
export const CITY_SHAPES = {
${body},
};
// 各城真实地理：ctr=[经度,纬度]（度），halfDeg=最长半轴（度）——全国地图背景按真实位置摆放用
export const CITY_GEO = {
${geo},
};
`;
  writeFileSync(OUT, src);
  const nPts = Object.values(shapes).reduce((a, v) => a + v.pts.length, 0);
  console.log(`写入 ${OUT}：${Object.keys(shapes).length} 城，共 ${nPts} 个边缘点（平均 ${Math.round(nPts / Math.max(1, Object.keys(shapes).length))}/城）`);
  if (missing.length) console.log('无边界（走回退）:', missing.join(', '));
  if (failed.length) console.log('拉取失败（可重跑补）:', failed.join(', '));
})();
