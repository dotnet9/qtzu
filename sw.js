// Q淘族 Service Worker：离线可玩（PWA）
// 策略：
//   导航 / 同源小文件（html/js/css/json）→ 网络优先，3.5s 超时或断网回退缓存
//     （保证部署后第一屏就是新代码，绝不出现"新 HTML 配旧 JS"的混搭崩溃）
//   跨域（three.js CDN、维基图片等）       → 缓存优先（版本化 URL 内容不变）
//   音频 mp3                          → 缓存优先 + 按字节限量（边玩边攒，只留最近听过的）
//   大模型 onnx/wasm/glb                 → 缓存优先 + 独立大文件桶（不受音频上限挤兑，也不挤占音频）
//   /api/*（登录/存档同步）               → 永远走网络，不缓存
const VER = 'qtzu-pwa-v20';   // v20：删掉相机挂载的前景枝叶（js/foreground.js 整层移除，暗角校验并入 verify-sky.mjs）+ 镜头跟随改到小人背后
const NET_TIMEOUT = 3500;

// 本地核心资源：装一次就离线可启动
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/profile-plus.css',
  'favicon.ico', 'favicon.png', 'apple-touch-icon.png',
  'js/compat.js', 'js/version.js', 'js/main.js', 'js/game.js', 'js/ui.js',
  'js/save.js', 'js/words.js', 'js/cities.js', 'js/curriculum.js', 'js/data.js',
  'js/models.js', 'js/assets.js', 'js/shadow.js', 'js/pets.js', 'js/world.js', 'js/audio.js', 'js/speech.js',
  'js/npcs.js', 'js/china-base.js', 'js/china-map.js', 'js/city-shape.js',
  'js/city-shape-data.js', 'js/pep-extra.js', 'js/uni-gate-models.js',
  'js/uni-gates.js', 'js/whisper.js', 'js/track.js', 'js/festival.js',
  'data/i18n/ui.zh.json', 'data/i18n/ui.en.json',
  'data/i18n/game.zh.json', 'data/i18n/game.en.json',
  'data/cities/index.json', 'data/app.json',
];
const AUDIO_MAX_BYTES = 24 * 1024 * 1024;   // 音频缓存上限 24MB（约 500 条 3 秒发音）
const BIG_MAX_BYTES = 200 * 1024 * 1024;     // 大文件（模型/onnx/wasm）缓存上限 200MB

self.addEventListener('install', e => {
  // 不自动 skipWaiting：新 SW 默认等待，由 version.js 更新条「立即更新」发消息触发——
  // 日常打开/玩的过程中不被 reload 打断（「靠岸两次」根因），点更新才换版
  e.waitUntil(caches.open(VER).then(c => c.addAll(CORE)));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VER && k !== VER + '-audio' && k !== VER + '-big').map(k => caches.delete(k))))
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

async function cacheFirst(req, kind) {
  // 音频与大文件分桶：互不挤兑；桶内按字节限量，超了按插入序清最老的
  const bucket = kind === 'big' ? VER + '-big' : kind === 'audio' ? VER + '-audio' : VER;
  const cap = kind === 'big' ? BIG_MAX_BYTES : kind === 'audio' ? AUDIO_MAX_BYTES : Infinity;
  const cache = await caches.open(bucket);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res.clone());
      if (cap !== Infinity) trimCache(cache, cap);
    }
    return res;
  } catch (e) { return Response.error(); }
}

// 按字节清最老条目：总量超过上限就把最早放进去的一个个删掉
async function trimCache(cache, cap) {
  try {
    const reqs = await cache.keys();
    let total = 0;
    const sizes = await Promise.all(reqs.map(async r => {
      const res = await cache.match(r);
      const size = res ? Number(res.headers.get('content-length')) || 0 : 0;
      total += size;
      return size;
    }));
    let i = 0;
    while (total > cap && i < reqs.length) {
      await cache.delete(reqs[i]);
      total -= sizes[i];
      i++;
    }
  } catch (e) { /* 限量失败不影响功能 */ }
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
    if (/\.mp3$/i.test(url.pathname)) e.respondWith(cacheFirst(req, 'audio'));
    else if (/\.(onnx|wasm|glb)$/i.test(url.pathname)) e.respondWith(cacheFirst(req, 'big'));
    else e.respondWith(networkFirst(req));
    return;
  }
  // 跨域：three.js CDN（版本化 URL 内容不变）、维基图片等 → 缓存优先
  e.respondWith(cacheFirst(req, false));
});
