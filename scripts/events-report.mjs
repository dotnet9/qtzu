// 埋点漏斗报告：node scripts/events-report.mjs [天数，默认7]
// 汇总最近 N 天 events/*.jsonl：设备数、事件分布、关键漏斗（启动→建号→进游戏→开挑战→过关）
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const DIR = path.join(__dirname, 'events');
if (!existsSync(DIR)) { console.log('还没有 events 数据'); process.exit(0); }
const days = Number(process.argv[2]) || 7;
const cutoff = Date.now() - days * 86400000;
const funnel = ['boot_ok', 'profile_done', 'game_start', 'challenge_open', 'challenge_result', 'level_clear'];
const byName = {}, devices = new Set(), funnelDevices = {}, dayStats = {};
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.jsonl')) continue;
  for (const line of readFileSync(path.join(DIR, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    if (ev.t < cutoff) continue;
    devices.add(ev.aid);
    byName[ev.name] = (byName[ev.name] || 0) + 1;
    const day = new Date(ev.t).toISOString().slice(0, 10);
    dayStats[day] = (dayStats[day] || new Set());
    dayStats[day].add(ev.aid);
    if (funnel.includes(ev.name)) (funnelDevices[ev.name] = funnelDevices[ev.name] || new Set()).add(ev.aid);
    if (ev.name === 'challenge_result' && ev.props && ev.props.score != null) {
      byName['  └ 平均分'] = (byName['  └ 平均分'] || { sum: 0, n: 0 });
      byName['  └ 平均分'].sum += ev.props.score; byName['  └ 平均分'].n++;
    }
  }
}
console.log(`最近 ${days} 天 · 独立设备 ${devices.size}`);
console.log('\n每日活跃设备:');
Object.keys(dayStats).sort().forEach(d => console.log(`  ${d}: ${dayStats[d].size}`));
console.log('\n关键漏斗:');
let prev = 0;
for (const step of funnel) {
  const n = (funnelDevices[step] || new Set()).size;
  console.log(`  ${step.padEnd(18)} ${String(n).padStart(4)} ${prev ? `(${Math.round(n / prev * 100)}% 流失)` : ''}`);
  prev = prev || n;
}
console.log('\n事件分布:');
Object.entries(byName).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k.padEnd(18)} ${typeof v === 'object' ? Math.round(v.sum / v.n) + ' 分 ×' + v.n : v}`);
});
