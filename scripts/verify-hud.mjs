// HUD 游戏化校验。
//
// 为什么必须写它：这一轮把 HUD 从"emoji 药丸"改成"进度条 + 角标堆 + 头像栏"，
// 而 5 个锚点 id 不只是显示 —— #pet-count / #star-pill 是**归航动画的飞行目标**
// （homePaw / homeStars 取它们的 getBoundingClientRect 中心），#star-pill 上还挂着 click。
// 一旦某个 id 消失、被隐藏成 0×0，或者写入者仍在写容器（把新加的子元素擦掉），
// 表现是"数字不见了 / 星星飞到屏幕左上角"——肉眼很难一眼看出，这里逐条钉住。
//
//   node scripts/verify-hud.mjs
import { serve, launch } from './browser.mjs';

const PORT = 6250 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1280, height: 760 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true, rows: [] }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
await page.addInitScript(() => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: 'HUD校验', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
});
await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);

console.log('HUD 游戏化');

/* ---------- A) 五个锚点 id 仍存在；两个归航目标必须可见非零 ---------- */
const ids = await page.evaluate(() => {
  const out = {};
  for (const id of ['pet-count', 'star-pill', 'score-pill', 'hungry-pill', 'user-pill', 'pet-count-text', 'star-pill-num', 'score-pill-text', 'hud-chapter', 'pet-icon-bar']) {
    const el = document.getElementById(id);
    out[id] = el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
  }
  return out;
});
check(ids['pet-count'] && ids['star-pill'] && ids['score-pill'] && ids['hungry-pill'] && ids['user-pill'], '五个锚点 id 都存在');
check(ids['pet-count'].w > 0 && ids['pet-count'].h > 0, '#pet-count 可见且非零（homePaw 的飞行目标）', `${ids['pet-count'].w}×${ids['pet-count'].h}`);
check(ids['star-pill'].w > 0 && ids['star-pill'].h > 0, '#star-pill 可见且非零（homeStars 的飞行目标）', `${ids['star-pill'].w}×${ids['star-pill'].h}`);
check(ids['pet-count-text'] && ids['star-pill-num'] && ids['score-pill-text'], '三个写入点内层 span 都存在');

/* ---------- B) 写入者写内层：数字正确、子元素没被擦掉、填充比例对 ---------- */
const hud = await page.evaluate(async () => {
  const ui = await import(new URL('js/ui.js', location.href).href);
  const W = await import(new URL('js/words.js', location.href).href);
  const g = window.__game;
  const chWords = g.chapters[g.chapterIndex()].words;
  const petIds = chWords.map((id) => (W.WORD_MAP[id] || {}).pet).filter(Boolean);
  const barEl = document.getElementById('pet-count');
  const fillEl = barEl.querySelector('.hud-bar-fill');
  fillEl.style.transition = 'none';       // 关掉 0.45s 过渡，量的是"这一刻的布局结果"
  ui.updateHUD(3, 6, 2, '第2关', petIds);
  ui.updateStars(7);
  ui.updatePlayerScore(120, 40);
  ui.updateUser('测试小朋友');
  void barEl.offsetWidth;                 // 强制同步布局
  // ⚠ 不能 await：游戏主循环的 HUD 刷新会在下一帧把这些值改回真实状态
  const bar = barEl;
  const fill = fillEl;
  const fillW = fill.getBoundingClientRect().width;
  const expectW = (3 / 6) * bar.clientWidth;
  return {
    text: document.getElementById('pet-count-text').textContent,
    barChildren: bar.children.length,
    barHasFill: !!fill,
    fillW: +fillW.toFixed(1),
    expectW: +expectW.toFixed(1),
    chapter: document.getElementById('hud-chapter').textContent,
    chapterVisible: document.getElementById('hud-chapter').getBoundingClientRect().height > 0,
    starNum: document.getElementById('star-pill-num').textContent,
    starHasIcon: document.getElementById('star-pill').textContent.includes('⭐'),
    scoreText: document.getElementById('score-pill-text').textContent,
    scoreHasIcon: document.getElementById('score-pill').textContent.includes('🏆'),
    hungryVisible: !document.getElementById('hungry-pill').classList.contains('hidden'),
    hungryText: document.getElementById('hungry-pill').textContent,
    userVisible: !document.getElementById('user-pill').classList.contains('hidden'),
    iconCount: document.getElementById('pet-icon-bar').children.length,
    petIds: petIds.length,
    chapPetIds: petIds,
  };
});
check(/^\d+\s*\/\s*\d+$/.test(hud.text), '#pet-count-text 是"n / m"形式', JSON.stringify(hud.text));
check(hud.barChildren >= 3 && hud.barHasFill, '进度条子元素（填充/图标/文字）都没被擦掉', `children=${hud.barChildren}`);
check(Math.abs(hud.fillW - hud.expectW) <= 2, '填充宽度 = 3/6（实测 vs 期望）', `${hud.fillW}px vs ${hud.expectW}px`);
check(hud.chapter === '第2关' && hud.chapterVisible, '#hud-chapter 显示章节且可见', JSON.stringify(hud.chapter));
check(hud.starNum === '7' && hud.starHasIcon, '星星写内层数字 + ⭐ 图标仍在', `${hud.starNum} / ${hud.starHasIcon}`);
check(hud.scoreText.includes('120') && hud.scoreHasIcon, '分数写内层 + 🏆 图标仍在', `${JSON.stringify(hud.scoreText)} / ${hud.scoreHasIcon}`);
check(hud.hungryVisible && hud.hungryText.length > 0, '饥饿提醒可见且有文案', JSON.stringify(hud.hungryText));
check(hud.userVisible, '用户名可见（非零尺寸）');

/* ---------- C) 归航动画的落点确实在 HUD 上 ---------- */
const home = await page.evaluate(async () => {
  const ui = await import(new URL('js/ui.js', location.href).href);
  ui.homeStars(40, 300, 2);
  ui.homePaw(60, 320, 2);
  const sp = document.getElementById('star-pill').getBoundingClientRect();
  const pc = document.getElementById('pet-count').getBoundingClientRect();
  await new Promise((r) => setTimeout(r, 500));
  const nodes = [...document.querySelectorAll('.home-star')];
  // 起飞点是 (40,300)/(60,320)，终点是 HUD 中心 → 500ms 后应明显朝 HUD 方向移动过
  const moved = nodes.some((n) => (n.style.transform || '').includes('translate'));
  return { n: nodes.length, moved, starC: [Math.round(sp.x + sp.width / 2), Math.round(sp.y + sp.height / 2)], petC: [Math.round(pc.x + pc.width / 2), Math.round(pc.y + pc.height / 2)], inView: sp.x > 0 && sp.y > 0 && pc.x > 0 && pc.y > 0 };
});
check(home.n >= 2, '归航动画仍在创建元素', `${home.n} 个`);
check(home.moved, '归航元素朝 HUD 移动（终点坐标有效）', `星星→${home.starC} 爪印→${home.petC}`);
check(home.inView, '两个飞行目标都在视口内（不是 0,0）');

/* ---------- D) 词宠头像栏：空槽 → 孵化后彩色且排到最前 ---------- */
const bar0 = await page.evaluate(() => ({
  n: document.getElementById('pet-icon-bar').children.length,
  empty: [...document.getElementById('pet-icon-bar').children].filter((d) => d.classList.contains('empty')).length,
}));
check(bar0.n === Math.min(6, hud.petIds), '头像栏格数 = min(6, 本关词宠数)', `${bar0.n} / ${hud.petIds}`);
check(bar0.empty === bar0.n, '未孵化时全是虚线空槽', `${bar0.empty}/${bar0.n}`);
const bar1 = await page.evaluate(async (firstId) => {
  const ui = await import(new URL('js/ui.js', location.href).href);
  const save = await import(new URL('js/save.js', location.href).href);
  save.hatch(firstId);
  const g = window.__game;
  const chWords = g.chapters[g.chapterIndex()].words;
  const W = await import(new URL('js/words.js', location.href).href);
  ui.updateHUD(4, 6, 0, '第2关', chWords.map((id) => (W.WORD_MAP[id] || {}).pet).filter(Boolean));
  // 缩略图是懒加载后异步填的，轮询等它出现
  for (let i = 0; i < 40; i++) {
    const d = document.querySelector('#pet-icon-bar > *');
    if (d && d.querySelector('img')) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  const kids = [...document.getElementById('pet-icon-bar').children];
  const filled = kids.filter((d) => !d.classList.contains('empty'));
  return {
    filled: filled.length,
    firstHasImg: !!(kids[0] && kids[0].querySelector('img')),
    firstPet: kids[0] ? kids[0].dataset.pet : null,
    firstIsFilled: kids[0] ? !kids[0].classList.contains('empty') : false,
    expectPet: firstId,
  };
}, await page.evaluate(async () => {
  const W = await import(new URL('js/words.js', location.href).href);
  const g = window.__game;
  const chWords = g.chapters[g.chapterIndex()].words;
  return (W.WORD_MAP[chWords[0]] || {}).pet;
}));
check(bar1.filled === 1 && bar1.firstHasImg, '孵化 1 只后：出现 1 格彩色缩略图', `filled=${bar1.filled} img=${bar1.firstHasImg}`);
check(bar1.firstIsFilled && bar1.firstPet === bar1.expectPet, '已孵化的排到最前（参考图"已拥有在前"）', `${bar1.firstPet} vs ${bar1.expectPet}`);

/* ---------- E) 三档视口：HUD 控件互不重叠 ---------- */
const overlapProbe = () => {
  const sel = ['#hud-col > *', '#hud-left > #user-pill', '#hud-right #hud-chips > *', '#hud-right > button', '#hud-right > #festival-pill', '#hud-chips', '#city-pill', '#leaderboard-widget', '#daily'];
  const items = [];
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    if (r.width < 1 || r.height < 1) continue;
    items.push({ sel: s, id: el.id || el.className, el, r });
  }
  const hits = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;   // 父子包含不算重叠
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 2 && h > 2) {
        const f = (x) => `top${Math.round(x.r.top)}~bottom${Math.round(x.r.bottom)}`;
        hits.push(`${a.id || a.sel} × ${b.id || b.sel} (${Math.round(w)}×${Math.round(h)}px) [${f(a)} vs ${f(b)}]`);
      }
    }
  }
  return { n: items.length, hits };
};
for (const v of [{ name: '手机', w: 390, h: 844 }, { name: '平板', w: 768, h: 1024 }, { name: '桌面', w: 1280, h: 760 }]) {
  await page.setViewportSize({ width: v.w, height: v.h });
  await page.waitForTimeout(400);
  const r = await page.evaluate(overlapProbe);
  check(r.hits.length === 0, `${v.name} ${v.w}×${v.h}：HUD 控件互不重叠`, r.hits.length ? r.hits.join(' | ') : `${r.n} 个控件`);
}

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ HUD 游戏化全部通过');
if (fails.length) process.exitCode = 1;
