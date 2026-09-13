import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const w = await import(pathToFileURL(process.cwd() + '/' + 'game/js/words.js').href);
const cur = await import(pathToFileURL(process.cwd() + '/' + 'game/js/curriculum.js').href);
const isSingle = s => /^[A-Za-z][A-Za-z'’.-]*$/.test(s);

// 收集每个年级的短语（保留中文）
const grades = [];
for (const gk of Object.keys(cur.CURRICULUM)) {
  const G = cur.CURRICULUM[gk];
  const rows = [];
  for (const u of G.units) for (const it of u.words) {
    const [en, zh] = it.split('|');
    if (!isSingle(en)) rows.push({ en, zh, unit: u.name });
  }
  grades.push({ gk, name: G.name, rows });
}
console.log('grade phrase counts:', grades.map(g => `${g.gk}:${g.rows.length}`).join(' '));

const ex = w.ISLANDS.map(i => ({ cx: i.cx, cz: i.cz, r: i.r, name: i.name }));
const RAD = r => Math.hypot(r.cx, r.cz);

// 尺寸 → 岛半径
const radiusFor = n => Math.max(11, Math.min(19, 9 + n * 0.33));

const placed = [];
const METAs = {
  '3a': { key: 'greet', name: '口语问候岛', emoji: '👋', color: '#FBE4D8', style: 'mixed' },
  '3b': { key: 'campus', name: '校园短语岛', emoji: '🎒', color: '#DCEAF5', style: 'pine' },
  '4a': { key: 'houseph', name: '居家短语岛', emoji: '🛋️', color: '#F0E4EC', style: 'house' },
  '4b': { key: 'schoolph', name: '时刻短语岛', emoji: '🕒', color: '#E4F0E4', style: 'mixed' },
  '5a': { key: 'weekph', name: '星期短语岛', emoji: '📅', color: '#F5EEDC', style: 'house' },
  '5b': { key: 'actph', name: '活动短语岛', emoji: '🎪', color: '#F5E0E8', style: 'mixed' },
  '6a': { key: 'travelph', name: '出行短语岛', emoji: '🧭', color: '#DCE8F5', style: 'house' },
  '6b': { key: 'pastph', name: '往事短语岛', emoji: '🕰️', color: '#E8E0F0', style: 'house' },
};

for (const g of grades) {
  const r = radiusFor(g.rows.length);
  const meta = METAs[g.gk];
  // 就近优先：从最近的外圈向内找，第一个满足净空的半径即为答案（该半径内取净空最大）
  let best = null;
  for (let R = 104; R <= 140 && !best; R += 1) {
    let cand = null;
    for (let deg = 0; deg < 360; deg += 0.5) {
      const a = deg * Math.PI / 180;
      const cx = +(R * Math.cos(a)).toFixed(1), cz = +(R * Math.sin(a)).toFixed(1);
      let clear = 1e9;
      for (const o of ex) clear = Math.min(clear, Math.hypot(cx - o.cx, cz - o.cz) - (r + o.r));
      for (const o of placed) clear = Math.min(clear, Math.hypot(cx - o.cx, cz - o.cz) - (r + o.r));
      if (clear >= 9 && (!cand || clear > cand.clear)) cand = { cx, cz, R, deg, clear };
    }
    if (cand) best = cand;
  }
  placed.push({ ...meta, cx: best.cx, cz: best.cz, r, rows: g.rows, startIndex: null });
  console.log(`${g.gk} ${meta.name} n=${g.rows.length} r=${r.toFixed(1)} -> (${best.cx}, ${best.cz}) R=${best.R} 净空=${best.clear.toFixed(1)}`);
}
fs.writeFileSync('tools/phrase-islands.json', JSON.stringify(placed, null, 1));
console.log('written tools/phrase-islands.json');
