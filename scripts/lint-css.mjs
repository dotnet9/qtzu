// CSS 体检：变量自引用（会失效）+ 硬编码色值统计（token 强制化的基线）
//
//   node scripts/lint-css.mjs           报告
//   node scripts/lint-css.mjs --gate    自引用必须为 0，否则退出码 1（可挂 CI）
//
// 为什么需要它：
//   · `--x: var(--x)` 这类自引用在 CSS 里构成循环 → 该变量失效（invalid at computed-value time）。
//     实测 style.css 里 --c-primary-soft 就是这么写的，导致**所有选中态浅粉底失效**，
//     控件看起来像"没被选中 / 裸的"——这是"UI 丑"的直接来源之一，而肉眼看不出原因。
//   · 硬编码色值散落会让"换皮"无法一次改全（改一处漏一处，观感必然不一致）。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const files = fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css'));
const gate = process.argv.includes('--gate');
let selfRefs = 0;
let undef = 0;
let hardTotal = 0;
const rows = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, 'css', f), 'utf8').replace(/\r\n/g, '\n');
  // 1) 自引用：--name: var(--name)
  const refs = [...src.matchAll(/--([a-z0-9-]+)\s*:\s*var\(--\1\)/gi)].map((m) => m[1]);
  selfRefs += refs.length;
  // 2) 硬编码色值：排除"token 定义行"（:root 块里 --x: #hex 是合法用法）
  const lines = src.split('\n');
  let inRoot = false;
  let hard = 0;
  for (const ln of lines) {
    if (/^\s*:root\s*\{/.test(ln)) inRoot = true;
    if (inRoot && /^\s*\}/.test(ln)) inRoot = false;
    if (inRoot) continue;
    const m = ln.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g);
    if (m) hard += m.length;
  }
  hardTotal += hard;
  // 3) 用了但没定义的变量：与自引用同类 —— 那条规则会静默失效（界面看起来"这里没样式"）
  // 只统计**没有 fallback** 的 var(--x)（带 fallback 的即使未定义也不会让规则失效）
  const used = new Set([...src.matchAll(/var\(--([a-z0-9-]+)\s*\)/gi)].map((m) => m[1]));
  const defined = new Set();
  // 跨文件：CSS 里定义的
  for (const g of fs.readdirSync(path.join(ROOT, 'css')).filter((x) => x.endsWith('.css'))) {
    const t = fs.readFileSync(path.join(ROOT, 'css', g), 'utf8');
    for (const m of t.matchAll(/--([a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
  }
  // 以及 JS 里 setProperty('--x') / style.setProperty 设的（实测 --dx/--rot/--deg 就是这么来的）
  for (const d of ['js']) {
    for (const g of fs.readdirSync(path.join(ROOT, d))) {
      if (!g.endsWith('.js')) continue;
      const t = fs.readFileSync(path.join(ROOT, d, g), 'utf8');
      for (const m of t.matchAll(/setProperty\(\s*['"]--([a-z0-9-]+)['"]/gi)) defined.add(m[1]);
    }
  }
  const missing = [...used].filter((v) => !defined.has(v));
  undef += missing.length;
  rows.push({ f, hard, refs, missing });
}

console.log('CSS 体检');
for (const r of rows) {
  console.log(`  ${r.f.padEnd(18)} 硬编码色值 ${String(r.hard).padStart(4)} 处 | 自引用 ${r.refs} | 未定义变量 ${r.missing.length}`);
  if (r.missing.length) console.log(`      ⚠ ${r.missing.map((v) => '--' + v).join(', ')}`);
}
console.log(`\n合计：硬编码色值 ${hardTotal} 处（目标 0），自引用 ${selfRefs} 处（必须 0），未定义变量 ${undef} 处（必须 0）`);
if (selfRefs) console.log('⚠ 自引用会让变量失效 → 对应样式全部不生效（例如"选中态浅底"）');
if (gate && (selfRefs || undef)) { console.log('✗ --gate：自引用与未定义变量都必须为 0'); process.exitCode = 1; }
else if (gate) console.log('✓ --gate：无自引用、无未定义变量');
