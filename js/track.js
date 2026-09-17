// 行为埋点：匿名设备 ID + 事件名，sendBeacon/keepalive 静默上报，失败零影响
// 服务端按天落 events/events-YYYY-MM-DD.jsonl，scripts/events-report.mjs 出漏斗报告
const ID_KEY = 'qtzu_aid';
let aid = '';
try {
  aid = localStorage.getItem(ID_KEY) || '';
  if (!aid) {
    aid = 'a' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    // 单独 try：隐身模式/隐私模式下 setItem 会抛异常，不能让它把模块加载打断（白屏）
    try { localStorage.setItem(ID_KEY, aid); } catch (e) { /* 隐私模式：本次会话内用内存 ID */ }
  }
} catch (e) { aid = 'anon'; }

export function track(name, props = {}) {
  try {
    const payload = JSON.stringify({ aid, name, props, t: Date.now() });
    const url = '/api/track';
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    else fetch(url, { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  } catch (e) { /* 埋点绝不影响游戏 */ }
}
