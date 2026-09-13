// 城市图片本地化：把 data/cities/*/ 中 Wikimedia 外链下载到 <city>/img/，
// JSON 字段替换为相对路径 data/cities/<city>/img/<file>；失败保留外链。
// 用法：node tools/localize-city-images.mjs [--revert]
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'game', 'data', 'cities');
const REVERT = process.argv.includes('--revert');
const PREFIX = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const seen = new Map();          // URL → 本地文件（跨城市复用同一张图）
let ok = 0, fail = 0, skip = 0;

const safeName = (url) => {
  const raw = decodeURIComponent(url.slice(PREFIX.length).split('?')[0]);
  const base = raw.replace(/\.(jpg|jpeg|png|gif|webp|svg)$/i, '').replace(/[^\w\-]+/g, '_').slice(0, 80);
  return base + '.jpg';
};

async function download(url, dir) {
  const file = seen.get(url);
  if (file && fs.existsSync(path.join(ROOT, file))) return file;
  const name = safeName(url);
  const rel = path.join(dir, name);
  if (fs.existsSync(rel)) { seen.set(url, rel); return rel; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'QTZuBot/1.0 (kids edu game)' } });
      if (res.status === 429) throw Object.assign(new Error('429'), { rate: true });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) throw new Error('too small ' + buf.length);
      fs.writeFileSync(rel, buf);
      seen.set(url, rel);
      ok++;
      return rel;
    } catch (e) {
      if (e.rate && attempt < 2) { await new Promise(r => setTimeout(r, 5000 * (attempt + 1))); continue; }
      fail++;
      console.error('FAIL', url.slice(-60), e.message);
      return null;
    } finally { clearTimeout(t); }
  }
}

const jobs = [];
for (const city of fs.readdirSync(ROOT)) {
  const cdir = path.join(ROOT, city);
  if (!fs.statSync(cdir).isDirectory()) continue;
  const imgDir = path.join(cdir, 'img');
  fs.mkdirSync(imgDir, { recursive: true });
  for (const jf of ['city.json', 'foods.json', 'scenes.json', 'universities.json']) {
    const fp = path.join(cdir, jf);
    if (!fs.existsSync(fp)) continue;
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const fix = async (obj, field) => {
      const url = obj[field];
      if (!url || typeof url !== 'string' || !url.startsWith(PREFIX)) return;
      if (REVERT) { obj[field] = url; return; }
      const local = await download(url, imgDir);
      if (local) obj[field] = 'data/cities/' + city + '/img/' + path.basename(local);
    };
    if (j.gallery) for (const g of j.gallery) jobs.push(() => fix(g, 'img'));
    if (j.items) for (const it of j.items) jobs.push(() => fix(it, 'img'));
    jobs.push(async () => {
      if (!REVERT) return;
      fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n');
    });
    // 保存对象引用，最后统一写回
    jobs.push(() => { j._fp = fp; saves.push(j); });
  }
}
const saves = [];
// 低并发 + 间隔，避免 Wikimedia 限流
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const job = queue.shift();
    try { await job(); } catch (e) { console.error('JOB', e.message); }
    await new Promise(r => setTimeout(r, 200));
  }
}));
if (!REVERT) for (const j of saves) fs.writeFileSync(j._fp, JSON.stringify(j, null, 2) + '\n');
console.log(`DONE ok=${ok} fail=${fail} skip=${skip}`);
