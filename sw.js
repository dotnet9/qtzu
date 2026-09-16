// Q淘族 Service Worker：离线可玩（PWA）
// 策略：
//   导航 / 同源小文件（html/js/css/json）→ 网络优先，3.5s 超时或断网回退缓存
//     （保证部署后第一屏就是新代码，绝不出现"新 HTML 配旧 JS"的混搭崩溃）
//   跨域（three.js CDN、维基图片等）       → 缓存优先（版本化 URL 内容不变）
//   音频 mp3 / 模型 onnx                  → 缓存优先 + 数量上限（大文件边玩边攒）
//   /api/*（登录/存档同步）               → 永远走网络，不缓存
const VER = 'qtzu-pwa-v5';   // v5：注册页改造角色创建页（云朵卡/凹槽/果冻按钮/卡通字体）
const NET_TIMEOUT = 3500;

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
  'js/uni-gates.js', 'js/whisper.js', 'js/track.js', 'js/festival.js',
  'data/i18n/ui.zh.json', 'data/i18n/ui.en.json',
  'data/i18n/game.zh.json', 'data/i18n/game.en.json',
  'data/cities/index.json', 'data/app.json',
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

async function networkFirst(req) {
  const cache = await caches.open(VER);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise(resolve => setTimeout(() => resolve(null), NET_TIMEOUT)),
    ]);
    if (res && res.ok) {
      cache.put(req, res.clone());
      return res;
    }
    if (res) return res;   // 非 ok（如 404）也照实返回
  } catch (e) { /* 断网/超时 → 回退缓存 */ }
  const hit = await cache.match(req);
  return hit || Response.error();
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
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.origin === location.origin) {
    // 大文件（音频/模型）缓存优先；小代码文件网络优先，更新即时生效
    if (/\.(mp3|onnx|wasm)$/i.test(url.pathname)) e.respondWith(cacheFirst(req, true));
    else e.respondWith(networkFirst(req));
    return;
  }
  // 跨域：three.js CDN（版本化 URL 内容不变）、维基图片等 → 缓存优先
  e.respondWith(cacheFirst(req, false));
});
