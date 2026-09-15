// Q淘族 Service Worker：离线可玩（PWA）
// 策略：
//   导航请求（index.html）     → 网络优先，断网回退缓存（配合 version.js 热更新检测）
//   同源静态资源（js/css/json）→ 先回缓存秒开，后台静默刷新（stale-while-revalidate）
//   CDN three.js（版本化 URL） → 缓存优先，命中即离线可用
//   音频 mp3                    → 缓存优先 + 数量上限（边玩边攒，不塞爆存储）
//   /api/*（登录/存档同步）     → 永远走网络，不缓存
const VER = 'qtzu-pwa-v1';

// 本地核心资源：装一次就离线可启动
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css',
  'favicon.ico', 'favicon.png', 'apple-touch-icon.png',
  'js/compat.js', 'js/version.js', 'js/main.js', 'js/game.js', 'js/ui.js',
  'js/save.js', 'js/words.js', 'js/cities.js', 'js/curriculum.js', 'js/data.js',
  'js/models.js', 'js/pets.js', 'js/world.js', 'js/audio.js', 'js/speech.js',
  'js/npcs.js', 'js/china-base.js', 'js/china-map.js', 'js/city-shape.js',
  'js/city-shape-data.js', 'js/pep-extra.js', 'js/uni-gate-models.js',
  'js/uni-gates.js', 'js/whisper.js',
];
const AUDIO_MAX = 400;   // 音频缓存上限（条）

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VER);
  const hit = await cache.match(req);
  const fresh = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

async function networkFirst(req, fallback) {
  const cache = await caches.open(VER);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) { /* 断网 */ }
  const hit = await cache.match(req);
  if (hit) return hit;
  if (fallback) return (await cache.match(fallback)) || Response.error();
  return Response.error();
}

async function cacheFirst(req, isAudio) {
  const cache = await caches.open(VER);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone());
      // 音频缓存限量：超了就把最早放进去的清掉
      if (isAudio) {
        const keys = await cache.keys();
        for (let i = 0; i < keys.length - AUDIO_MAX; i++) cache.delete(keys[i]);
      }
    }
    return res;
  } catch (e) { return Response.error(); }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;   // 登录/存档：只走网络
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, 'index.html'));
    return;
  }
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/audio/')) e.respondWith(cacheFirst(req, true));
    else e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // 跨域：three.js CDN（版本化 URL 内容不变）、维基图片等 → 缓存优先
  e.respondWith(cacheFirst(req, false));
});
