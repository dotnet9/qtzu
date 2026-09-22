// ⑨ 面板审计：量出 8 个面板的**布局与信息层级**指标，用数字驱动换皮。
//
// 为什么不用眼睛：内嵌浏览器面板在本机 attach 不上，截图我读不了。
// 所以这里量四类"丑"的客观代理指标：
//   1) 层级：标题/正文的字号、字重、颜色 → 是否只有一种字号（=没有层级）
//   2) 对比度：文字色 vs 面板底色（WCAG 比值，正文应 ≥ 4.5:1）
//   3) 溢出：内容高于面板 → 手机上会被裁掉
//   4) 点击区：按钮/可点项高度（触屏应 ≥ 44px）、字号（≥ 14px）
//
//   node scripts/audit-panels.mjs [--only phone] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const VIEWS = [
  { name: 'phone', w: 390, h: 844 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1280, h: 760 },
].filter((v) => !optOf('--only') || v.name === optOf('--only'));
const PANEL_IDS = ['profile', 'intro', 'pet-card', 'modal', 'picker', 'catalog', 'map', 'levelup'];
const PORT = 6150 + Math.floor(Math.random() * 9);
const asJson = process.argv.includes('--json');

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rank: 1, rows: [] }) }));
const page = await ctx.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '面板审计', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(3000);

const probe = async (ids) => {
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = (c) => {
    const [r, g, b] = parse(c).slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  // 向上找第一个不透明的背景色；**渐变按钮**（background-image 是 linear-gradient）
  // 的真实底色是渐变的中间色，不能当透明处理 —— 否则白字会被误判成对比度 1.0
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      const c = s.backgroundColor;
      const solid = c && !/rgba?\(0, 0, 0, 0\)/.test(c) && parse(c)[3] !== 0;
      if (solid) return c;
      const gi = s.backgroundImage;
      if (gi && gi.includes('gradient')) {
        // 取渐变里所有颜色点的平均，近似它的实际观感底色
        const cols = gi.match(/rgba?\([^)]+\)/g) || [];
        if (cols.length) {
          const acc = [0, 0, 0];
          for (const cc of cols) { const p = parse(cc); acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; }
          return `rgb(${acc.map((v) => Math.round(v / cols.length)).join(',')})`;
        }
      }
    }
    return 'rgb(255,255,255)';
  };
  const out = [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) { out.push({ id, missing: true }); continue; }
    el.classList.remove('hidden');
    // ⚠ 必须等**弹出动画落定**再量：`.overlay > div` 的 cardIn 动画第一帧是 scale(.82)，
    // 同一 tick 量到的 rect 会被缩小 18%（曾经据此误判"min-height 没生效"）。
    await new Promise((r) => setTimeout(r, 450));
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const card = el.querySelector('.panel, .sheet, .card, .modal-box, [class*="panel"]') || el.firstElementChild || el;
    const ccs = getComputedStyle(card);
    const cardBg = bgOf(card);
    const texts = [...card.querySelectorAll('h1,h2,h3,h4,p,span,div,label,li,button')]
      .filter((n) => n.children.length === 0 && n.textContent.trim().length > 1)
      .map((n) => {
        const s = getComputedStyle(n);
        return { tag: n.tagName.toLowerCase(), cls: n.className.toString().slice(0, 28), size: parseFloat(s.fontSize), weight: s.fontWeight, color: s.color, ratio: ratio(s.color, bgOf(n)), text: n.textContent.trim().slice(0, 18) };
      });
    // 用 offsetHeight（布局像素，不受 transform 影响）判定触屏尺寸
    const clickable = [...card.querySelectorAll('button, [role="button"], .mini-btn, .menu-item, .tab, a')].map((n) => {
      const s = getComputedStyle(n);
      return { h: n.offsetHeight, w: n.offsetWidth, size: parseFloat(s.fontSize), text: n.textContent.trim().slice(0, 14) };
    }).filter((x) => x.w > 0 && x.h > 0);
    const sizes = [...new Set(texts.map((t) => t.size))].sort((a, b) => b - a);
    out.push({
      id,
      card: { w: Math.round(box.width), h: Math.round(box.height), radius: ccs.borderRadius, pad: ccs.padding, bg: cardBg },
      overflow: { scroll: card.scrollHeight, client: card.clientHeight, clipped: card.scrollHeight > card.clientHeight + 2 },
      textCount: texts.length,
      sizes,
      distinctSizes: sizes.length,
      // 对比度最差的正文（越接近 1 越看不清）
      worstContrast: texts.length ? Math.min(...texts.map((t) => t.ratio)) : null,
      lowContrast: texts.filter((t) => t.ratio < 4.5).map((t) => `${t.text}(${t.ratio})`).slice(0, 6),
      smallText: texts.filter((t) => t.size < 13).map((t) => `${t.text}(${t.size}px)`).slice(0, 6),
      // 触屏尺寸：文字按钮 ≥ 40px，纯图标按钮（✕/‹/›）≥ 36px 可接受 ——
      // 所以这里只报 < 36px 的（真正"手指点不中"的那批）
      smallTaps: clickable.filter((c) => c.h < 36).map((c) => `${c.text}(${c.h}px)`).slice(0, 6),
      // 36~43px 的次要按钮单列出来，方便人工确认它们是不是图标按钮
      midTaps: clickable.filter((c) => c.h >= 36 && c.h < 40).map((c) => `${c.text}(${c.h}px)`).slice(0, 6),
      tapCount: clickable.length,
      // 层级：最大字号 / 最小字号，比值太小 = 没有层级
      hierarchy: sizes.length ? { big: sizes[0], small: sizes[sizes.length - 1], span: +(sizes[0] - sizes[sizes.length - 1]).toFixed(1) } : null,
      title: texts.find((t) => t.size >= (sizes[0] || 0) - 0.5) || null,
    });
    el.classList.add('hidden');
  }
  return out;
};

const report = {};
for (const v of VIEWS) {
  await page.setViewportSize({ width: v.w, height: v.h });
  await page.waitForTimeout(200);
  report[v.name] = await page.evaluate(probe, PANEL_IDS);
}

if (asJson) {
  fs.writeFileSync(path.join(ROOT, '.cache/panel-audit.json'), JSON.stringify(report, null, 2));
  console.log('→ .cache/panel-audit.json');
} else {
  for (const v of VIEWS) {
    console.log(`\n===== ${v.name} ${v.w}×${v.h} =====`);
    for (const p of report[v.name]) {
      if (p.missing) { console.log(`  #${p.id}  ❌ 不存在`); continue; }
      const h = p.hierarchy;
      console.log(`  #${p.id}`);
      console.log(`     卡片 ${p.card.w}×${p.card.h}  圆角 ${p.card.radius}  内距 ${p.card.pad}  底 ${p.card.bg}`);
      console.log(`     文本 ${p.textCount} 条  字号档 ${p.distinctSizes} 种 [${p.sizes.join(', ')}]  层级跨度 ${h ? h.span + 'px' : '-'}`);
      console.log(`     最差对比度 ${p.worstContrast}${p.lowContrast.length ? '  ⚠ ' + p.lowContrast.join(' ') : '  ✓'}`);
      if (p.smallText.length) console.log(`     小字 ⚠ ${p.smallText.join(' ')}`);
      if (p.smallTaps.length) console.log(`     小点击区 ⚠ ${p.smallTaps.join(' ')}`);
      if (p.overflow.clipped) console.log(`     溢出 ⚠ 内容 ${p.overflow.scroll} > 面板 ${p.overflow.client}（手机可能被裁）`);
    }
  }
}
await ctx.close();
srv.stop();
