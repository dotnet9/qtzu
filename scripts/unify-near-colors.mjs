// 找"近似色"：与某个 token 只差 1~4（RGB 曼哈顿距离）的硬编码色值。
//
// 这类多半是手误/取整（#FF6FA4 vs --c-primary #FF6FA5），统一它们能去掉观感不一致，
// 而且**风险极低**（差 1~4 人眼几乎看不出，但代码里少一个"野生色"）。
// 差 >4 的不动 —— 那可能是有意的（浅色/深色变体），需要看着图判断。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CSS = path.join(ROOT, 'css');
const fix = process.argv.includes('--fix');
const MAXD = Number(process.argv.find((a) => a.startsWith('--maxd='))?.split('=')[1] || 4);

const hex2rgb = (h) => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const norm = (h) => {
  const [r, g, b] = hex2rgb(h);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
};

const files = fs.readdirSync(CSS).filter((f) => f.endsWith('.css'));
const tokens = new Map();
for (const f of files) {
  const src = fs.readFileSync(path.join(CSS, f), 'utf8').replace(/\r\n/g, '\n');
  for (const b of src.match(/:root\s*\{[\s\S]*?\}/g) || []) {
    for (const m of b.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) tokens.set(norm(m[2]), m[1]);
  }
}

const near = new Map();   // 硬编码色 → 最近的 token
for (const f of files) {
  const src = fs.readFileSync(path.join(CSS, f), 'utf8').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  let inRoot = false;
  for (const ln of lines) {
    if (/^\s*:root\s*\{/.test(ln)) inRoot = true;
    if (inRoot && /^\s*\}/.test(ln)) inRoot = false;
    if (inRoot) continue;
    for (const m of ln.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = norm(m[0]);
      if (tokens.has(hex)) continue;                 // 同值已由 tokenize-css 处理
      const [r, g, b] = hex2rgb(hex);
      let best = null;
      for (const [th, name] of tokens) {
        const [tr, tg, tb] = hex2rgb(th);
        const d = Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb);
        if (d > 0 && d <= MAXD && (!best || d < best.d)) best = { name, th, d };
      }
      if (best) near.set(hex, best);
    }
  }
}

console.log(`与 token 差 ≤${MAXD} 的硬编码色值：${near.size} 种`);
for (const [hex, b] of [...near.entries()].sort((a, b2) => a[1].d - b2[1].d)) {
  console.log(`  ${hex} → --${b.name} (${b.th})  差 ${b.d}`);
}
if (fix && near.size) {
  let total = 0;
  for (const f of files) {
    const p = path.join(CSS, f);
    let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    const lines = s.split('\n');
    let inRoot = false;
    const out = lines.map((ln) => {
      if (/^\s*:root\s*\{/.test(ln)) inRoot = true;
      if (inRoot && /^\s*\}/.test(ln)) inRoot = false;
      if (inRoot) return ln;
      return ln.replace(/#[0-9a-fA-F]{6}\b/g, (m) => {
        const b = near.get(norm(m));
        if (!b) return m;
        total++;
        return `var(--${b.name})`;
      });
    });
    fs.writeFileSync(p, out.join('\n').replace(/\n/g, '\r\n'));
  }
  console.log(`已统一 ${total} 处（色差 ≤${MAXD}，人眼几乎不可见）`);
}
