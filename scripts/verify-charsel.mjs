// 角色选择卡校验：
//   1) 卡片数 = 2（基础性别）+ 已拥有帽子 × 2 —— 只列"已拥有"的组合
//   2) 点第一张后性别被写入存档，且玩家被重建（换装仍在）
//   3) 选中态金框跟随（.cs-card.on 只有一张）
//   4) 图片是 384px 缩略图（不是 128 的老图）
//   5) 0 页面异常
//
//   node scripts/verify-charsel.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const city = optOf('--city', 'chengdu');
const PORT = 6144 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 900, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
// 预置：拥有 2 顶帽子 + 气球 + 魔杖（这样卡片数是 2 + 2×2 = 6）
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: {
        username: '选角校验', registered: true, city: c, gender: 'boy',
        wear: { hat: '', hatOwned: ['wizard', 'flower'], balloon: true, balloonOwned: true, wand: true, wandOwned: true, title: '' },
      },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* ignore */ }
}, city);
await page.goto(`${srv.base}?city=${city}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

// 收掉加载屏（它会挡住点击）与其它弹层，再开菜单
await page.evaluate(() => {
  const l = document.getElementById('loading');
  if (l) { l.classList.add('hidden', 'done'); l.style.display = 'none'; }
  document.querySelectorAll('.overlay').forEach((o) => o.classList.add('hidden'));
});
await page.waitForTimeout(250);
// 程序化点击菜单里的 #btn-charsel（走真实监听器；Playwright 的可见性等待会被
// "点外部关闭菜单"逻辑挡住，这里不需要它）
await page.evaluate(() => document.getElementById('btn-charsel').click());
await page.waitForTimeout(1800);   // 等缩略图逐张渲染

const r = await page.evaluate(async () => {
  const ov = document.getElementById('charsel');
  const cards = [...document.querySelectorAll('#charsel-grid .cs-card')];
  const imgs = cards.map((c) => c.querySelector('img'));
  // 读第一张图的真实像素尺寸
  const first = imgs[0];
  let dim = null;
  if (first) {
    dim = await new Promise((res) => {
      if (first.complete && first.naturalWidth) res([first.naturalWidth, first.naturalHeight]);
      else { first.onload = () => res([first.naturalWidth, first.naturalHeight]); first.onerror = () => res(null); }
    });
  }
  return {
    open: !!ov && !ov.classList.contains('hidden'),
    cards: cards.length,
    onCount: document.querySelectorAll('#charsel-grid .cs-card.on').length,
    names: cards.map((c) => (c.querySelector('.cs-name') || {}).textContent || ''),
    dim,
    hasShopBtn: !!document.getElementById('charsel-shop'),
    genderBefore: window.__save.getGender(),
  };
});
console.log(`角色选择卡（${city}）`);
check(r.open, '面板已打开（菜单按钮接线生效）');
check(r.cards === 6, '卡片数 = 2 基础 + 2 帽子 × 2 性别 = 6', `实际 ${r.cards} 张：${r.names.join('/')}`);
check(r.onCount === 1, '选中态只有一张（金框）', `${r.onCount} 张`);
check(r.dim && r.dim[0] === 384, '缩略图是 384px（不是 128 老图）', r.dim ? r.dim.join('×') : '未加载');
check(r.hasShopBtn, '有"去许愿井换装扮"按钮');

// 点第 2 张（女孩基础卡）→ 性别应切换 + 玩家重建
const after = await (async () => {
  // 索引 3 = 女孩基础卡（顺序：男孩基础/男孩+巫师帽/男孩+花环/女孩基础/…）
  await page.click('#charsel-grid .cs-card:nth-child(4)');
  await page.waitForTimeout(4000);   // 等部件 GLB 换装完成（156 个变体已覆盖全部组合）
  return page.evaluate(() => ({
    gender: window.__save.getGender(),
    onIndex: [...document.querySelectorAll('#charsel-grid .cs-card')].findIndex((c) => c.classList.contains('on')),
    headAsset: (window.__game.playerParts.head || {}).userData ? window.__game.playerParts.head.userData.asset : null,
    mouthOk: !!(window.__game.playerParts.mouth && window.__game.playerParts.mouth.parent),
  }));
})();
check(after.gender === 'girl', '点女孩卡后性别切换', `${r.genderBefore} → ${after.gender}`);
check(after.onIndex === 3, '金框跟随到新选中', `index ${after.onIndex}`);
check(!!after.headAsset, '玩家被重建且换装仍在', String(after.headAsset));
check(after.mouthOk, '脸部契约保留（嘴仍挂在 head 下）');
check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 角色选择卡全部通过');
if (fails.length) process.exitCode = 1;
