import { t, isEn } from './i18n.js';
import { track } from './track.js';
// Q淘族 · 入口
import './compat.js'; // 兼容垫片（roundRect 等），必须最先加载
track('boot_ok');   // 引擎加载成功（此后再失败属于运行时错误）

// PWA：https（或本地调试）下注册 Service Worker —— 孩子离线/地铁上也能玩，
// 家长"添加到主屏幕"后就是一个不占地方的小 App
if ('serviceWorker' in navigator
  && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  addEventListener('load', () => {
    // 已有 SW 控制本页时，新版 SW 接管（缓存换版）后自动刷新一次：防止新 HTML 配旧 JS 的混搭崩溃
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
import './version.js'; // 热更新检测：线上有新版本时提示刷新
import * as THREE from 'three';
import { Game } from './game.js';
import * as save from './save.js';
import * as ui from './ui.js';
import { CURRICULUM } from './curriculum.js';
import { AUTO_SPECS, WORDS, chaptersFor } from './words.js';
import { setAutoSpecs, buildPet, petThumbnail } from './models.js';
import { CITIES, initCities } from './cities.js';
import { loadAppConfig } from './data.js';

// 应用名从 game/data/app.json 读（fork 换皮不用改代码）：加载屏文案随之更新
loadAppConfig().then(app => {
  if (!app) return;
  document.title = `${app.appName} ${app.appNameEn || ''}`.trim();
  const t = document.querySelector('#loading .loading-text');
  if (t && !document.getElementById('loading').classList.contains('done')) {
    t.textContent = t('y.60', { a0: app.appName });
  }
}).catch(() => {});

setAutoSpecs(AUTO_SPECS); // 海岛词宠的参数化模型配方

window.THREE = THREE; // 调试句柄
window.__save = save; // 调试句柄
window.__ui = ui;     // 调试句柄
window.__words = WORDS; // 调试句柄
window.__buildPet = buildPet; // 调试句柄
window.__petThumb = petThumbnail; // 调试句柄

const canvas = document.getElementById('scene');
// 全局错误兜底（别让小朋友卡在黑屏）
window.addEventListener('error', e => {
  const el = document.getElementById('loading');
  if (el && !el.classList.contains('done')) {
    el.querySelector('.loading-text').textContent = t('x.g500');
    console.error(e.error || e.message);
  }
});

let started = false;
// 好友分享链接：?city=chengdu&grade=4&term=s1 —— 未注册时预填档案（家乡=该城=第一关）；
// 已注册时进游戏后跳到该城（未解锁/奖励城给对应提示）
function parseShareLink() {
  const q = new URLSearchParams(location.search);
  const city = (q.get('city') || '').toLowerCase().replace(/[^a-z]/g, '');
  const g = parseInt(q.get('grade'), 10);
  const t = (q.get('term') || '').toLowerCase();
  const semKey = (g >= 3 && g <= 6 && (t === 's1' || t === 's2')) ? g + (t === 's1' ? 'a' : 'b') : '';
  const debug = q.has('debug');   // debug=调试模式：不受通关限制，立即进城玩
  return { city, semKey, debug };
}
const SHARE = parseShareLink();
if (SHARE.city) {
  // 好友分享链接的 city 是"去朋友家玩"，不是"搬家"：
  // 注册与否都不改家乡（家乡 = 自己选的首关城市），分享城一律作为本次会话的临时访问。
  // 未注册新同学也保持默认家乡，避免点一次链接从此永久从朋友城开始。
  // 存档里只记"拜访过"：_handleShareCity 负责跳到该城（未解锁给提示）
} else SHARE.city = '';
async function begin(name, semKey, gender, password, serverScore, token) {
  if (started) return;
  started = true;
  try {
    const profile = document.getElementById('profile');
    if (profile) profile.classList.add('hidden');
    // 从弹窗提交进来才更新档案；自动续玩时不带参，别覆盖已有资料
    if (name) {
      save.setUsername(name);
      save.setPassword(password || '');   // 密码允许为空
      save.setRegistered(true);
      if (token) save.setToken(token);    // 单点登录会话令牌
    }
    // 老存档没有令牌：静默补一次登录拿令牌（失败不影响进游戏，只是不参与单点登录）
    if (save.isRegistered() && save.getUsername() && !save.getToken()) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: save.getUsername(), password: save.getPassword() }),
        });
        if (res.ok) { const d = await res.json(); if (d.token) save.setToken(d.token); }
      } catch (e) { /* 离线：跳过 */ }
    }
    if (serverScore != null) save.syncScore(serverScore);   // 换设备登录时补上账号里的分数
    // 换设备/重新登录：拉取服务器存档合并本地（词宠/星星/进度），失败静默走本地
    try { await save.pullSave(); } catch (e) { /* ignore */ }
    save.syncRank();   // 登录即同步多维榜字段（词宠/城市/星星）
    if (semKey) save.setBookSem(semKey);
    if (gender) save.setGender(gender);
    save.resetSessionScore();
    // 城市数据加载（路线=家乡→随机→北京，seed 稳定可续）：必须先于 Game 构造
    // 手作城市布局表：构建世界前注入（失败静默，走程序化布局）
    try {
      const [d, w] = await Promise.all([
        import('./data.js').then(m => m.loadJson('cities/layouts.json')),
        import('./world.js'),
      ]);
      w.setCityLayouts(d);
    } catch (e) { /* ignore */ }
    // 双语文案资源就绪后再进游戏（i18n-ready 事件也会刷新已渲染的 HUD）
    try { await import('./i18n.js').then(m => m.initI18n()); } catch (e) { /* ignore */ }
    await initCities({
      homeId: save.getHomeCity(),
      semKey: save.getBookSem() || '3a',
      count: chaptersFor(save.getBookSem() || '3a').length,
      username: save.getUsername(),
    });
    const game = new Game(canvas);
    game.start();
    window.__game = game; // 调试句柄
    save.startHeartbeat();   // 单点登录心跳：被同名新登录顶下线时弹登录框
    if (SHARE.city) setTimeout(() => game._handleShareCity && game._handleShareCity(SHARE.city, SHARE.debug), 1600);
    initRestReminder();   // 😴 儿童护眼：连续玩 30 分钟提醒休息（确认后重新计时，周期性）
    track('game_start');
    // 🔥 连续打卡：每天第一次进游戏记一天，断签从 1 重来；里程碑（3/7/14/30 天）自动发星星
    const st = save.touchStreak();
    if (st.n >= 2) {
      const sp = document.getElementById('streak-pill');
      if (sp) { sp.textContent = `🔥 x${st.n}`; sp.classList.remove('hidden'); }
    }
    if (st.newMilestone) {
      save.addStars(st.newMilestone.bonus);
      ui.updateStars(save.getStars());
      setTimeout(() => ui.toast(t('streak.milestone', { d: st.newMilestone.days, n: st.newMilestone.bonus }), 4200), 2500);
    } else if (st.n >= 2) {
      setTimeout(() => ui.toast(t('streak.keep', { n: st.n }), 2600), 2200);
    }
    // 📝 错词周测：周日且距上次 ≥7 天，错词本里有词才考
    setTimeout(async () => {
      if (!save.isQuizDay()) return;
      const ids = save.getNaughtyForQuiz(3);
      if (!ids.length) return;
      const { WORD_MAP } = await import('./words.js');
      const words = ids.map(id => WORD_MAP[id]).filter(Boolean);
      if (words.length) ui.showWeeklyQuiz(words, () => save.markQuizDone());
    }, 4000);
    // 🎊 节日轻装饰：HUD 顶部一枚节日徽标 + 进城问候
    import('./festival.js').then(({ getFestival }) => {
      const f = getFestival();
      if (!f) return;
      const pill = document.getElementById('festival-pill');
      if (pill) {
        pill.textContent = isEn()
          ? `${f.emoji} ${f.en}${f.soon ? t('fest.soon') : ''}`
          : `${f.emoji} ${f.name}${f.soon ? t('fest.soon') : t('fest.happy')}`;
        pill.classList.remove('hidden');
      }
      if (!f.soon) setTimeout(() => ui.toast(t('fest.toast', { e: f.emoji, zh: f.name, en: f.en }), 4200), 1800);
    }).catch(() => {});
  } catch (err) {
    console.error(err);
    window.__bootErr = err && (err.stack || err.message);
    const el = document.getElementById('loading');
    if (el) {
      const esc = s => String(s).replace(/[<>&"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]));
      const msg = esc((err && err.message) || err || t('x.g501'));
      const log = (window.__errLog || []).slice(-2).map(esc).join('；');
      el.querySelector('.loading-text').innerHTML =
        t('x.g502') +
        `<small style="display:block;margin-top:10px;font-size:12px;opacity:.75;word-break:break-all">${msg}${log ? '<br>' + log : ''}</small>`;
    }
  }
}

// 😴 儿童护眼休息提醒：累计活跃 30 分钟弹一次休息卡（页面切后台不计时），确认"休息好啦"重新计时
function initRestReminder() {
  const LIMIT = 30 * 60 * 1000;
  let played = 0, last = Date.now();
  const tick = setInterval(() => {
    if (document.visibilityState !== 'visible') { last = Date.now(); return; }   // 切后台不累计
    played += Date.now() - last;
    last = Date.now();
    if (played >= LIMIT) {
      clearInterval(tick);
      // 确认"休息好啦"后重新计时：休息提醒是周期性的，不是只提醒一次
      import('./ui.js').then(m => m.showRestCard(() => initRestReminder()));
    }
  }, 15000);
}

// IP 定位家乡城市：免费接口识别到城市池里的城市就自动填上（失败静默，档案卡里可手改）
async function autoLocateCity() {
  if (save.hasHomeCity()) return;   // 已经设置过家乡（含手动选择），不覆盖
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 6000);
    const res = await fetch('https://ipapi.co/json/', { signal: ctl.signal });
    const d = await res.json();
    const key = String(d.city || '').toLowerCase().replace(/\s+/g, '');
    const hit = CITIES.find(c => c.en.toLowerCase().replace(/\s+/g, '') === key || c.name === d.city);
    if (hit) {
      save.setHomeCity(hit.id);
      dispatchEvent(new CustomEvent('home-city', { detail: hit.id }));   // 档案卡开着的话同步刷新显示
    }
  } catch (e) { /* 定位失败/无网络：用档案里的手动选择 */ }
}
autoLocateCity();
// 启动即预热城市索引（档案卡的城市选择器要用）；begin() 里会按确切参数再初始化一次
initCities({ homeId: save.getHomeCity(), semKey: save.getBookSem() || '3a', count: 10, username: save.getUsername() }).catch(() => {});

// 单点登录被顶：清会话 → 刷新页面 → 档案卡以登录模式弹出并提示
save.onKick(() => {
  try { sessionStorage.setItem('qtzu_kicked', '1'); } catch (e) { /* ignore */ }
  location.reload();
});
let kickMsg = '';
try {
  if (sessionStorage.getItem('qtzu_kicked')) { kickMsg = t('x.g503'); sessionStorage.removeItem('qtzu_kicked'); }
} catch (e) { /* ignore */ }

// 建过档案（有昵称、选好课本）就直接续玩；否则弹窗：有昵称的走登录，没有的走注册
// 首屏弹窗必须等双语文案就绪，否则 t() 动态文案显示裸 key
import('./i18n.js').then(m => m.initI18n()).catch(() => {}).then(() => {
  if (save.getUsername() && save.isRegistered() && CURRICULUM[save.getBookSem()]) begin();
  else ui.showProfile(begin, {
    username: save.getUsername(), password: save.getPassword(), registered: save.isRegistered(),
    semKey: save.getBookSem(), gender: save.getGender(), city: save.getHomeCity(),
  }, { mode: save.getUsername() ? 'login' : 'register', kickMsg });
});
