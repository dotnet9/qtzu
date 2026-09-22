// token 强制化（零风险子集）：把与 token **完全同值**的硬编码色值换回 var(--token)。
//
// 为什么只做"完全同值"：值相同 → 渲染结果逐像素不变（零观感风险），但换来
//   ① 以后改主题只改 token 一处
//   ② 硬编码数量大幅下降，剩下的"近似但不同"的颜色才是需要**看着图**判断的部分
// 近似色（比如 #FF6FA4 vs --c-primary #FF6FA5）**不动** —— 那属于视觉决策，
// 我看不到图时不该替你做主（之前就吃过"改动没验证"的亏）。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CSS = path.join(ROOT, 'css');
const fix = process.argv.includes('--fix');
const files = fs.readdirSync(CSS).filter((f) => f.endsWith('.css'));

const norm = (h) => {
  let s = h.toLowerCase();
  if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return s;
};

// 1) 收集所有 :root 里的 token（跨文件，后定义覆盖先定义）
const tokenOf = new Map();
for (const f of files) {
  const src = fs.readFileSync(path.join(CSS, f), 'utf8').replace(/\r\n/g, '\n');
  const blocks = src.match(/:root\s*\{[\s\S]*?\}/g) || [];
  for (const b of blocks) {
    for (const m of b.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      tokenOf.set(norm(m[2]), m[1]);
    }
  }
}
console.log(`token 表：${tokenOf.size} 个色值 → ${[...tokenOf.values()].join(', ')}`);

let total = 0;
for (const f of files) {
  const p = path.join(CSS, f);
  let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const lines = s.split('\n');
  let inRoot = false;
  let hits = 0;
  const out = lines.map((ln) => {
    if (/^\s*:root\s*\{/.test(ln)) inRoot = true;
    if (inRoot && /^\s*\}/.test(ln)) inRoot = false;
    if (inRoot) return ln;                       // token 定义行不动
    return ln.replace(/#[0-9a-fA-F]{3,8}\b/g, (hex) => {
      const name = tokenOf.get(norm(hex));
      if (!name) return hex;
      hits++;
      return `var(--${name})`;
    });
  });
  if (hits) {
    total += hits;
    console.log(`  ${f.padEnd(18)} ${hits} 处同值替换`);
    if (fix) fs.writeFileSync(p, out.join('\n').replace(/\n/g, '\r\n'));
  }
}
console.log(fix ? `已替换 ${total} 处（渲染结果不变）` : `可替换 ${total} 处（加 --fix 执行）`);
