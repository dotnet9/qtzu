// 游戏热更新检测：玩着玩着线上发布了新版本，弹提示让孩子/家长确认后刷新拉取最新
// 原理：定期拉取入口 index.html 全文与页面加载时的基准对比——
// 入口文件只有几 KB，全文对比最可靠，不依赖 ETag/Last-Modified 头的配置差异
import { showUpdateBar } from './ui.js';

const CHECK_INTERVAL = 60 * 1000;      // 常规检测间隔
const RE_NAG_AFTER = 10 * 60 * 1000;   // 点过"稍后"后，隔多久才允许为同一版本再提醒

let baseline = null;     // 本次页面加载时的入口内容（当前正在玩的版本）
let dismissed = null;    // 点"稍后"时已知道的最新版本（别对同一版本反复弹）
let lastShown = 0;
let checking = false;

async function fetchEntry() {
  try {
    const res = await fetch('index.html', { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) { return null; }   // 断网/离线时静默，别打扰游戏
}

export async function checkUpdate() {
  if (!baseline || checking || document.hidden) return;
  checking = true;
  try {
    const now = await fetchEntry();
    if (!now || now === baseline) return;
    const sameAsDismissed = now === dismissed && Date.now() - lastShown < RE_NAG_AFTER;
    if (sameAsDismissed) return;
    lastShown = Date.now();
    showUpdateBar({
      // 立即更新：先把新入口预热进 HTTP 缓存，reload 后 js/css 的协商缓存拿到的是新版
      onUpdate: async () => {
        try { await fetch('index.html', { cache: 'reload' }); } catch (e) { /* ignore */ }
        location.reload();
      },
      onLater: () => { dismissed = now; },
    });
  } finally { checking = false; }
}

fetchEntry().then(t => { baseline = t; });
setInterval(checkUpdate, CHECK_INTERVAL);
// 切回前台立刻查一次：孩子放下几天再拿起平板，一回来就能看到更新提示
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
