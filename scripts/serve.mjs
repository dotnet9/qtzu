import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 6161);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream', '.onnx': 'application/octet-stream',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, urlPath);
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
    const headers = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    };
    // 模型文件几十 MB 且内容永不变化，长缓存避免每次进游戏都重新下载；
    // 音频按文件名寻址、可能重生成，给 7 天缓存平衡流量与更新
    // （站点可能挂在 / 或 /game/ 下，两种路径都要命中）
    if (urlPath.includes('/models/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else if (urlPath.includes('/audio/')) headers['Cache-Control'] = 'public, max-age=604800';
    else {
      headers['Cache-Control'] = 'no-cache';
      // 代码文件走 ETag 协商缓存：没改动的文件 304 命中，不用整份重传
      const etag = `"${st.size}-${st.mtimeMs}"`;
      headers['ETag'] = etag;
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
