// 地形体检：把 data/cities/*/terrain.json 放进「与游戏同一份」高度场里量一遍。
//
// 为什么要有它：历史上多次出现"配置写着 5.5 米的山、上岛是 0 米"——山被边缘沙化带压平、
// 河漂到轮廓外、广场把地标压掉。这些用肉眼看截图很难逐城发现，必须用数值卡门槛。
//
// 硬门槛（不达标退出码非 0）：
//   1) 河/湖/峰/山/脉 全部落在轮廓内
//   2) 可用区（沙化带之外）起伏率 ≥ 25%——沙化带内本来就该平，不算进起伏率
//   3) 有山（mountain/ridges/peaks）的城市：主峰实高 ≥ 4m
//   4) 广场（出生平台）不压地标；广场→主峰直线单步（0.5m）高差 < 2m
//
// 用法：node scripts/audit-terrain.mjs [cityId...]
import { readFileSync, existsSync } from 'fs';
import { cityIds, readCity, auditCity, radiusOf } from './terrain-lib.mjs';

const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const ids = cityIds().filter(id => !only.length || only.includes(id));

const R = (v, n = 2) => Number(v).toFixed(n);
let hardFail = 0, warnCount = 0, graded = 0;
const rows = [];

for (const id of ids) {
  const tp = `data/cities/${id}/terrain.json`;
  if (!existsSync(tp)) { rows.push({ id, note: '无 terrain.json（走平地）' }); continue; }
  const city = readCity(id);
  const cfg = JSON.parse(readFileSync(tp, 'utf8'));
  let res;
  try { res = auditCity(id, city, cfg); }
  catch (e) { rows.push({ id, fail: [`体检抛错: ${e.message}`], warn: [] }); hardFail++; graded++; continue; }
  const { fail, warn, stats } = res;
  hardFail += fail.length ? 1 : 0;
  warnCount += warn.length ? 1 : 0;
  graded++;
  const feats = [
    cfg.mountain ? '山' : '', (cfg.mountains || []).length ? `山×${cfg.mountains.length}` : '',
    (cfg.ridges || []).length ? `脉×${cfg.ridges.length}` : '',
    ((cfg.hill ? 1 : 0) + (cfg.hills || []).length) ? `丘×${(cfg.hill ? 1 : 0) + (cfg.hills || []).length}` : '',
    (cfg.rivers || []).length ? `河×${cfg.rivers.length}` : '',
    ((cfg.lake ? 1 : 0) + (cfg.lakes || []).length) ? `湖×${(cfg.lake ? 1 : 0) + (cfg.lakes || []).length}` : '',
    (cfg.peaks || []).length ? `峰×${cfg.peaks.length}` : '',
    cfg.terrace ? '梯田' : '', cfg.farm ? '农田' : '',
  ].filter(Boolean).join('');
  rows.push({
    id, fail, warn, feats,
    rr: radiusOf(id, city), hi: stats.hi, relief: stats.relief,
    maxStep: stats.maxStep, usable: stats.usable, thin: stats.thin,
    snow: (cfg.snow && cfg.snow[0] < 90) ? `雪线${cfg.snow[0]}` : '',
    palette: (cfg.colors && cfg.colors.greens && cfg.colors.greens[0]) ? cfg.colors.greens[0].map(v => R(v, 1)).join('/') : '',
  });
}

console.log('城市          半径  主峰   可用区起伏  单步   带外可用   地物');
console.log('─'.repeat(104));
for (const r of rows) {
  if (r.note) { console.log(`  ${r.id.padEnd(12)} ${r.note}`); continue; }
  const flag = r.fail.length ? '✗' : (r.warn.length ? '!' : ' ');
  console.log(`${flag}${r.id.padEnd(12)} ${String(r.rr).padStart(4)}  ${R(r.hi, 1).padStart(5)}m ${R(r.relief * 100, 0).padStart(6)}%    ${R(r.maxStep, 2).padStart(5)}m ${R(r.usable * 100, 0).padStart(6)}%    ${r.feats} ${r.snow}`);
  for (const f of r.fail) console.log(`      ✗ ${f}`);
  for (const w of r.warn) console.log(`      ! ${w}`);
}
console.log('─'.repeat(104));
console.log(`城市 ${graded} 座：硬门槛不达标 ${hardFail} 座，有告警 ${warnCount} 座`);
process.exit(hardFail ? 1 : 0);
