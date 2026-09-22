// 验证表情系统：调用 _faceMood 后，嘴的 scale 与眼睛的 squint 是否真的变化并回落
//   node scripts/verify-face.mjs 里已验眨眼；这里单独验表情
import { serve, launch } from './browser.mjs';

const PORT = 6162;
const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await page.addInitScript(() => {
  try { localStorage.setItem('wordpet_save_v1', JSON.stringify({ profile: { username: 'x', registered: true, city: 'chengdu', gender: 'boy', wear: {} }, book: { sem: '3a' }, intro: true, guideDone: true })); } catch (e) {}
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.mouth && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1200);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const P = g.playerParts;
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const sample = () => ({
    mx: +P.mouth.scale.x.toFixed(3), my: +P.mouth.scale.y.toFixed(3),
    squint: +(g._squint || 1).toFixed(3),
    eyeY: +P.eyes[0].scale.y.toFixed(3), eyeH: P.eyes[0].userData.eyeH,
  });
  const before = sample();
  // 大笑：应看到嘴变大（x/y 都涨）+ 眼睛眯（eyeY 明显变小）
  g._faceMood('joy', 1.2);
  let peak = before;
  for (let i = 0; i < 30; i++) {
    await frame();
    const s2 = sample();
    if (s2.my > peak.my) peak = s2;
  }
  const during = sample();
  // 等表情结束（dur 1.2s + 缓动）
  for (let i = 0; i < 90; i++) await frame();
  const after = sample();
  // 微笑：嘴变宽但眼睛不变
  g._faceMood('smile', 0.6);
  let peak2 = sample();
  for (let i = 0; i < 20; i++) { await frame(); const s3 = sample(); if (s3.mx > peak2.mx) peak2 = s3; }
  for (let i = 0; i < 60; i++) await frame();
  const after2 = sample();
  return { before, peak, during, after, peak2, after2 };
});

const ok = [];
const chk = (c, what, extra = '') => { ok.push(c); console.log(`  ${c ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`); };
console.log('表情系统');
chk(r.peak.my > r.before.my + 0.3, '大笑：嘴纵向张开', `scale.y ${r.before.my} → 峰值 ${r.peak.my}`);
chk(r.peak.squint < 0.7, '大笑：眼睛眯起（笑眼）', `squint ${r.before.squint} → ${r.peak.squint}`);
chk(Math.abs(r.after.my - 1) < 0.02 && Math.abs(r.after.squint - 1) < 0.02, '表情结束后回落', `嘴 ${r.after.my} / squint ${r.after.squint}`);
chk(r.peak2.mx > r.before.mx + 0.1, '微笑：嘴变宽', `scale.x ${r.before.mx} → 峰值 ${r.peak2.mx}`);
chk(Math.abs(r.peak2.squint - 1) < 0.02, '微笑不动眼睛', `squint ${r.peak2.squint}`);
chk(Math.abs(r.after2.mx - 1) < 0.02, '微笑结束后回落', `${r.after2.mx}`);
chk(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(ok.every(Boolean) ? '\n✓ 表情系统全通过' : '\n✗ 有未通过项');
if (!ok.every(Boolean)) process.exitCode = 1;
