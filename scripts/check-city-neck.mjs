// 城市窄颈审计：城市边界内应是连通的可玩区域（除墙/建筑/河）。
// 玩家被钳在「离边界 ≥ margin（墙厚+身位）」的区域内，若该区域（形态学腐蚀）
// 被窄颈切成多个连通块，小人就过不去——另一侧的蛋/立牌成死区。
//
// 判定口径与 scripts/heal-neck-lib.mjs 的 playableComponents 完全共用：
// 轮廓走 js/city-shape.js 的真实回退链，钳制用 simplifyPoly 的低模（与运行时一致），
// 可玩阈值取 floor=0.5（_clampCityPos 挤不出 margin 时就地放行的下限），
// 而不是 margin=1.42——用 margin 判会把大量可通行的细颈误判成切断。
// 用法：node scripts/check-city-neck.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCityShape } from '../js/city-shape.js';
import { playableComponents, WALL_MARGIN, MIN_POCKET } from './heal-neck-lib.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const loadJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

const index = loadJson(path.join(root, 'data/cities/index.json'));
const rows = [];
for (const c of index.cities) {
  const cid = c.id;
  const cj = loadJson(path.join(root, `data/cities/${cid}/city.json`));
  if (!cj) continue;
  const n = (loadJson(path.join(root, `data/cities/${cid}/universities.json`)) || { unis: [] }).unis?.length
    + (loadJson(path.join(root, `data/cities/${cid}/foods.json`)) || { items: [] }).items?.length
    + (loadJson(path.join(root, `data/cities/${cid}/scenes.json`)) || { items: [] }).items?.length;
  const lv = cj.level || {};
  const pts = getCityShape(cid, lv.shape);
  const info = playableComponents(pts, lv.radius || 28, n || 0);
  rows.push({
    id: cid, name: cj.name || cid, r: info.r, floor: info.floor,
    comps: info.comps, pockets: info.pockets, mainPct: +info.mainPct.toFixed(1), pocketArea: info.pocketArea,
  });
}

rows.sort((a, b) => a.mainPct - b.mainPct);
console.log(`城市            r      离边下限  钳制边距  连通块  主块占比  真死区u²  碎屑`);
for (const w of rows) {
  const flag = w.pockets > 0 ? ' ❌' : (w.comps > 1 ? ' ⚠️' : '');
  console.log(
    `${w.name.padEnd(6)} ${String(w.id).padEnd(12)} r=${String(w.r).padStart(3)}   ≥${String(w.floor).padStart(4)}   ${String(WALL_MARGIN).padStart(5)}   ${String(w.comps).padStart(3)}     ${String(w.mainPct).padStart(5)}%  ${String(w.pocketArea.toFixed(1)).padStart(7) + '  ' + String(w.comps - 1 - w.pockets).padStart(4)}${flag}`
  );
}
const bad = rows.filter(w => w.pockets > 0);
console.log(`\n===== ${rows.length} 城，其中 ${bad.length} 城有真死区(≥${MIN_POCKET}u²)：${bad.map(b => `${b.name}(${b.pocketArea.toFixed(1)}u²)`).join('、') || '无'} =====`);
process.exit(bad.length ? 1 : 0);
