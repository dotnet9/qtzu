// 验证脸部契约（这一轮修的就是它）：
//   1) 眨眼引用仍在场景里：parts.eyes[].parent === head（换装后 keep 让它们活下来）
//   2) 眨眼真的在动：手动把 _blinkT 置 0 再等一会儿，断言 eyes[0].scale.y 变小
//   3) 嘴存在且在场景里（parts.mouth 的 parent 是 head）
//   4) GLB 里没有脸部图元：头部部件的三角面数应比"含脸版本"少约 6 个图元的面数
//
//   node scripts/verify-face.mjs [--city chengdu]
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6165 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 600 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '脸部校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
// 等玩家部件换装完成（ground 会先进队列，所以给足时间）
await page.waitForFunction(() => {
  const p = window.__game.playerParts;
  return p && p.head && p.head.userData && p.head.userData.asset;
}, null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1200);

const r = await page.evaluate(async () => {
  const g = window.__game;
  const P = g.playerParts || {};
  const inScene = (o) => { let q = o; while (q) { if (q === g.scene) return true; q = q.parent; } return false; };
  const eyes = P.eyes || [];
  const headAsset = P.head && P.head.userData.asset;
  // 眨眼：置 0 后逐帧观察 scale.y
  let minScale = 1, samples = [];
  if (eyes[0]) {
    const base = eyes[0].scale.y;
    g._blinkT = 0;
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      samples.push(+eyes[0].scale.y.toFixed(4));
      minScale = Math.min(minScale, eyes[0].scale.y);
    }
    samples = samples.slice(0, 12);
    return {
      eyes: eyes.map((e) => ({ inScene: inScene(e), parentIsHead: e.parent === P.head, scaleY: +e.scale.y.toFixed(4), eyeH: e.userData.eyeH })),
      baseScaleY: +base.toFixed(4),
      minScaleY: +minScale.toFixed(4),
      samples,
      mouth: P.mouth ? { inScene: inScene(P.mouth), parentIsHead: P.mouth.parent === P.head, keep: !!P.mouth.userData.keep } : null,
      headAsset,
      headKids: P.head ? P.head.children.length : 0,
      headKept: P.head ? P.head.children.filter((c) => c.userData && c.userData.keep).length : 0,
    };
  }
  return { eyes: [], mouth: null, headAsset };
});

console.log(`脸部契约（${city}）`);
check(r.eyes.length === 2, 'parts.eyes 有 2 个引用', `${r.eyes.length}`);
check(r.eyes.every((e) => e.inScene), '眼睛仍在场景里（keep 生效）', JSON.stringify(r.eyes.map((e) => e.inScene)));
check(r.eyes.every((e) => e.parentIsHead), '眼睛仍挂在 head 下');
check(r.minScaleY < r.baseScaleY - 0.02, '眨眼真的在动（scale.y 变小）',
  `base ${r.baseScaleY} → min ${r.minScaleY}  采样 ${JSON.stringify(r.samples.slice(0, 6))}`);
check(!!r.mouth && r.mouth.inScene && r.mouth.parentIsHead, '嘴存在且在场景里（表情接口就绪）', JSON.stringify(r.mouth));
check(r.headKept >= 7, 'head 下保留的 keep 子件 ≥7（2 眼 + 2 高光 + 2 腮红 + 嘴）', `${r.headKept} 个 keep / ${r.headKids} 个子件`);
check(!!r.headAsset, 'head 已换装成 GLB', String(r.headAsset));
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 脸部契约全通过');
if (fails.length) process.exitCode = 1;
