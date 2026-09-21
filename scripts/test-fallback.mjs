// 回退验收：把全部 .glb 打成 404，断言"美术挂了游戏照常玩"；再跑一遍正常，断言 GLB 真的命中。
//
//   node scripts/test-fallback.mjs
//
// 为什么必须两趟：只测"能跑"会漏掉"其实一个模型都没加载"（manifest 路径写错、key 对不上、
// 低端机分支被误判），只测"加载了"会漏掉回退路径已经腐烂。两趟同镜头截图还能直接当
// "改造前 / 改造后"的肉眼对比（美术升级方案 §五.4）。
//
// 输出：.cache/shots/chengdu-gates-{fallback,glb}.png、chengdu-city-{fallback,glb}.png
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, '.cache/shots');
const PORT = 6140 + Math.floor(Math.random() * 40);
const VIEW = { width: 1280, height: 760 };

fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
// serviceWorkers:'block'：离线缓存是 PWA 的活，这里要测的是"网络路径 + 程序化回退"本身。
// 不屏蔽的话，SW 从缓存里直接回 GLB，路由拦截（404）根本不生效，回退趟会假通过。
const ctx = await launch({ viewport: VIEW, serviceWorkers: 'block' });
// 账号服务不是本测试的靶子（而且开发机上不一定有这个账号）：打桩成 200。
// 不打桩的话 /api/pull-save 的 401 会触发 js/save.js:168 的"被顶下线"→ js/main.js:225
// 的 location.reload，页面进 reload 循环、永远进不了城，控制台也被 404 刷满。
await ctx.route('**/api/**', (r) => {
  const url = r.request().url();
  const body = /pull-save/.test(url) ? { save: null }
    : /login/.test(url) ? { token: 'test-token' }
      : { ok: true, rank: 1, rows: [] };
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

// 一份够用的存档：已注册 + 家乡成都 + 3a 册 → js/main.js 会自动续玩，不会卡在档案卡
const seed = () => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '回退测试', registered: true, city: 'chengdu', gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true,
    }));
  } catch (e) { /* 隐私模式：档案卡会拦住，下面的 waitForFunction 会超时报错 */ }
};

// 同镜头取景：站在第一座校门正前方（校门正面朝城心，见 js/game.js:2152），镜头从城里看过去
const frame = async (page, wide) => {
  await page.evaluate((isWide) => {
    const g = window.__game;
    [...document.querySelectorAll('.overlay')].forEach((o) => o.classList.add('hidden'));
    g.lockInput = false;
    const st = g._currentStage();
    if (isWide) {
      g.camDist = g.camDistTarget = 78; g.camPitch = 0.95; g.camYaw = 0.6;
      g.player.position.set(st.cx, 0, st.cz);
      return;
    }
    const sign = (g._signList || []).find((s) => s.type === 'uni');
    if (!sign) return;
    const ux = st.cx - sign.x, uz = st.cz - sign.z;
    const n = Math.hypot(ux, uz) || 1;
    // 贴到门前 2.4 步、镜头拉到 7 格：校门占画面约三成，"改造前/后"的差别肉眼直接可比
    g.player.position.set(sign.x + (ux / n) * 2.4, 0, sign.z + (uz / n) * 2.4);
    g.player.rotation.y = Math.atan2(-ux / n, -uz / n);
    g.camYaw = Math.atan2(ux / n, uz / n);
    g.camPitch = 0.26;
    g.camDist = g.camDistTarget = 7;
  }, !!wide);
  await page.waitForTimeout(900);
};

async function run(label, { blockGlb }) {
  console.log(`\n── ${label}${blockGlb ? '（全部 .glb → 404）' : '（正常）'}`);
  const page = await ctx.newPage();
  await page.setViewportSize(VIEW);
  await page.addInitScript(seed);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  let glbRequests = 0;
  if (blockGlb) {
    await page.route(/\.glb(\?.*)?$/, (r) => { glbRequests++; r.fulfill({ status: 404, body: '' }); });
  } else {
    page.on('request', (r) => { if (/\.glb(\?.*)?$/.test(r.url())) glbRequests++; });
  }

  await page.goto(`${srv.base}?city=chengdu&debug=1`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
  } catch (e) {
    // 进城失败时把"卡在哪一步"直接打出来：加载屏文案 + 启动错误 + 页面错误（省得靠猜）
    const diag = await page.evaluate(() => ({
      loading: (document.getElementById('loading') || {}).textContent,
      bootErr: window.__bootErr || null,
      profileOpen: !!document.querySelector('#profile:not(.hidden)'),
      saved: !!localStorage.getItem('wordpet_save_v1'),
    })).catch(() => null);
    console.log('  进城失败：', JSON.stringify(diag));
    for (const e2 of errors.slice(0, 8)) console.log('   ' + e2);
    await page.close();
    throw e;
  }

  // 资产请求（含 1.5s 超时）落地前先等它们都结束：命中/失败才算得准
  await page.waitForFunction(() => {
    const s = window.__assets && window.__assets.stats();
    return s && s.pending === 0 && (s.hits + s.failed.length) >= 18;
  }, null, { timeout: 40000 }).catch(() => {});

  // 1) 不白屏：加载屏收起、启动没报错
  const boot = await page.evaluate(() => ({
    err: window.__bootErr || null,
    done: !!document.querySelector('#loading.done'),
    canvas: !!document.querySelector('#scene'),
  }));
  check(!boot.err, '无启动错误', boot.err || '');
  check(boot.done && boot.canvas, '加载屏正常收起（不白屏）');

  // 2) 能进游戏：玩家与城市都建出来了
  const g = await page.evaluate(() => ({
    player: !!window.__game.player,
    parts: window.__game.player.children.length,
    stage: (window.__game._currentStage() || {}).key,
    signs: (window.__game._signList || []).length,
  }));
  check(g.player && g.parts > 0, '玩家建出来了', `子节点 ${g.parts}`);
  check(g.stage === 'chengdu', '已进成都', String(g.stage));
  check(g.signs >= 18, '城区牌子/校门摆放完成', `${g.signs} 个点位`);

  // 3) 能走路：四个方向各按一段，只要有一个方向真的位移了就算能走
  // （不能只按 W：出生点在城心主地标正南 2.6，正对着走会被地标占地碰撞体顶住，
  //   那不是"走不动"，是"走不进去"——四个方向都试才不会误判）
  await page.evaluate(() => {
    const g2 = window.__game;
    g2.lockInput = false; g2.cinematic = false;
    [...document.querySelectorAll('.overlay')].forEach((o) => o.classList.add('hidden'));
  });
  const dirs = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  const moves = {};
  for (const code of dirs) {
    const a = await page.evaluate(() => ({ x: window.__game.player.position.x, z: window.__game.player.position.z }));
    await page.keyboard.down(code.replace('Key', '').toLowerCase());
    await page.waitForTimeout(700);
    await page.keyboard.up(code.replace('Key', '').toLowerCase());
    const b = await page.evaluate(() => ({ x: window.__game.player.position.x, z: window.__game.player.position.z }));
    let d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d < 0.3) {   // 无焦点时真实按键不生效：改用同一条 window 监听器分发
      await page.evaluate((c) => dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
      await page.waitForTimeout(700);
      await page.evaluate((c) => dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
      const c2 = await page.evaluate(() => ({ x: window.__game.player.position.x, z: window.__game.player.position.z }));
      d = Math.hypot(c2.x - a.x, c2.z - a.z);
    }
    moves[code] = +d.toFixed(2);
  }
  const best = Math.max(...Object.values(moves));
  check(best > 0.3, '能走路', JSON.stringify(moves));

  // 4) 能孵蛋：走一遍真实孵化入口（含蛋的晃裂动画、词宠出生、存档落库）
  const hatched = await page.evaluate(() => {
    const g2 = window.__game;
    const id = g2.currentChapter.words.find((w) => !window.__save.isHatched(w));
    const w = (window.__words || []).find((x) => x.id === id);
    if (!w) return null;
    g2._doHatch(w, 80, 'voice');
    return id;
  });
  await page.waitForTimeout(2600);
  const hatchOk = hatched && await page.evaluate((id) => ({
    saved: window.__save.isHatched(id),
    pets: window.__game.pets.list ? window.__game.pets.list.length : -1,
  }), hatched);
  check(!!(hatchOk && hatchOk.saved), '能孵蛋（词宠已入存档）', String(hatched));

  // 5) 校门与名牌：换装不能把名牌 sprite 清掉，也不能把门清空
  const gates = await page.evaluate(() => {
    const out = [];
    // 只认最外层那座：onSwap 会给整棵子树打 userData.sign（js/game.js 的点击判定需要），
    // 所以 GLB 内部的节点组也带 sign——它们不是"另一座门"
    window.__game.scene.traverse((o) => {
      if (!o.isGroup || !o.userData.sign || o.userData.sign.type !== 'uni') return;
      if (o.parent && o.parent.userData.sign === o.userData.sign) return;
      out.push({
        zh: o.userData.sign.zh, asset: o.userData.asset || null,
        meshes: o.children.filter((c) => c.isMesh).length,
        groups: o.children.filter((c) => c.isGroup).length,
        sprites: o.children.filter((c) => c.isSprite).length,
        marked: o.children.every((c) => c.userData.sign),
      });
    });
    return out;
  });
  const stats = await page.evaluate(() => window.__assets.stats());
  const bad = gates.filter((x) => !(x.meshes > 0 || x.groups > 0) || x.sprites !== 1 || !x.marked);
  if (bad.length) console.log('    异常校门：' + JSON.stringify(bad.slice(0, 8)));
  check(gates.length >= 18, '18 座校门都在场', `${gates.length} 座`);
  check(gates.every((x) => x.meshes > 0 || x.groups > 0), '每座门都有实体（没被清空）');
  check(gates.every((x) => x.sprites === 1), '名牌 sprite 换装后仍在');
  check(gates.every((x) => x.marked), '换装后子件都带 userData.sign（点击不 fallthrough）');
  if (blockGlb) {
    check(gates.every((x) => !x.asset), '全部保持程序化（回退生效）');
    check(stats.failed.length >= 18, '失败清单记录了每个 GLB', `${stats.failed.length} 个`);
    check(glbRequests >= 18, '确实去请求过 GLB（不是没试就放弃）', `${glbRequests} 次`);
  } else {
    check(gates.every((x) => x.asset), '全部换成了烘焙资产', `命中 ${stats.hits}`);
    check(glbRequests >= 21, 'GLB 都被请求到（18 门 + 3 地标）', `${glbRequests} 次`);
  }

  // 5b) 城市地标：换装同样只换 children（主地标上挂着"欢迎来 X"牌子 sprite，必须留下）
  const lms = await page.evaluate(() => {
    const out = [];
    window.__game.scene.traverse((o) => {
      if (!o.isGroup || !o.userData.lm) return;
      if (o.parent && o.parent.userData.lm === o.userData.lm) return;   // 只要最外层那个
      out.push({
        key: o.userData.lm.key, asset: o.userData.asset || null,
        meshes: o.children.filter((c) => c.isMesh).length,
        groups: o.children.filter((c) => c.isGroup).length,
        sprites: o.children.filter((c) => c.isSprite).length,
      });
    });
    return out;
  });
  check(lms.length >= 3, '成都 3 个地标都在场', `${lms.length} 个`);
  check(lms.every((x) => x.meshes > 0 || x.groups > 0), '每个地标都有实体');
  const mainLm = lms.filter((x) => /#0$/.test(x.key));   // 只有主地标挂"欢迎来 X"牌子（js/world.js:1420）
  check(mainLm.length >= 1 && mainLm.every((x) => x.sprites >= 1), '主地标欢迎牌没被换装清掉');
  check(blockGlb ? lms.every((x) => !x.asset) : lms.every((x) => x.asset),
    blockGlb ? '地标保持程序化（回退生效）' : '地标全部换成烘焙资产',
    `命中 ${lms.filter((x) => x.asset).length}/${lms.length}`);

  // 5c) 地面换装（成都）：程序化地面与烘焙地面必须"恰好显示一个"
  const ground = await page.evaluate(() => {
    let slot = null, terrainMesh = null;
    window.__game.scene.traverse((o) => {
      if (o.name === 'ground-slot') slot = o;
      if (o.name === 'city-ground') terrainMesh = o;
    });
    return {
      slotChildren: slot ? slot.children.length : -1,
      procVisible: terrainMesh ? terrainMesh.visible : null,
    };
  });
  if (blockGlb) {
    check(ground.slotChildren === 0, '回退趟：ground-slot 为空（没换装）', `子节点 ${ground.slotChildren}`);
    check(ground.procVisible !== false, '回退趟：程序化地面仍然可见（不是空城）', String(ground.procVisible));
  } else {
    check(ground.slotChildren > 0, '正常趟：烘焙地面已挂上', `子节点 ${ground.slotChildren}`);
    check(ground.procVisible === false, '正常趟：程序化地面已隐藏（不双向重叠）', String(ground.procVisible));
  }

  // 6) 同镜头截图：fallback=改造前，glb=改造后
  const tag = blockGlb ? 'fallback' : 'glb';
  await frame(page, false);
  await page.screenshot({ path: path.join(SHOTS, `chengdu-gates-${tag}.png`) });
  await frame(page, true);
  await page.screenshot({ path: path.join(SHOTS, `chengdu-city-${tag}.png`) });

  // 7) 报错：回退趟里"GLB 404"是故意造的，不计；其余（含页面异常）一条都不许有
  const rest = errors.filter((e) => !(blockGlb && /Failed to load resource.*\b404\b/.test(e)));
  check(!errors.some((e) => e.startsWith('pageerror')), '0 页面异常', errors.filter((e) => e.startsWith('pageerror'))[0] || '');
  check(rest.length === 0, blockGlb ? '0 控制台错误（除故意 404 的 GLB）' : '0 控制台错误', rest.slice(0, 3).join(' | '));
  await page.close();
}

await run('回退趟', { blockGlb: true });
await run('正常趟', { blockGlb: false });
await ctx.close();
srv.stop();

console.log(fails.length
  ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ')
  : '\n✓ 全通过：断网/404 时照常可玩，正常时烘焙资产命中');
console.log('对比图：.cache/shots/chengdu-gates-{fallback,glb}.png  .cache/shots/chengdu-city-{fallback,glb}.png');
if (fails.length) process.exitCode = 1;
