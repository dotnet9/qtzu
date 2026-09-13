// 城市图片本地化：把 data/cities/*/ JSON 里的所有外链图片下载到 <city>/img/，
// JSON 字段替换为相对路径 data/cities/<city>/img/<file>；失败保留外链（运行时 emoji 回退）。
// 支持：city.json gallery、foods/scenes/universities 数组、对象包裹（items/unis）。
// 同时清理历史脏字段 _fp。用法：node scripts/localize-city-images.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'data', 'cities');
const seen = new Map();
let ok = 0, fail = 0, skip = 0;

const safeName = (url) => {
  let raw;
  try { raw = decodeURIComponent(url.split('?')[0]); } catch { raw = url.split('?')[0]; }
  const base = raw.replace(/\/$/, '').split('/').pop().replace(/\.(jpg|jpeg|png|gif|webp|svg)(.*)?$/i, '')
    .replace(/[^\w\-]+/g, '_').slice(0, 80) || 'img';
  const ext = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) ? (RegExp.$1 || 'jpg').toLowerCase() : 'jpg';
  return base + '.' + ext;
};

async function download(url, dir) {
  const key = url.split('?')[0];
  if (seen.has(key)) {
    const rel = seen.get(key);
    if (fs.existsSync(path.join(ROOT, rel))) return rel;
  }
  const name = safeName(url);
  const rel = path.join(dir, name);
  if (fs.existsSync(rel)) { seen.set(key, rel); return rel; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'QTZuBot/1.0 (kids edu game)' } });
      if (res.status === 429) throw Object.assign(new Error('429'), { rate: true });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1500) throw new Error('too small ' + buf.length);
      fs.writeFileSync(rel, buf);
      seen.set(key, rel);
      ok++;
      return rel;
    } catch (e) {
      if (e.rate && attempt < 2) { await new Promise(r => setTimeout(r, 5000 * (attempt + 1))); continue; }
      fail++;
      console.error('FAIL', key.slice(-70), e.message);
      return null;
    } finally { clearTimeout(t); }
  }
}

const fixes = [];   // { json, write() }
for (const city of fs.readdirSync(ROOT)) {
  const cdir = path.join(ROOT, city);
  if (!fs.statSync(cdir).isDirectory()) continue;
  const imgDir = path.join(cdir, 'img');
  fs.mkdirSync(imgDir, { recursive: true });
  for (const jf of ['city.json', 'foods.json', 'scenes.json', 'universities.json']) {
    const fp = path.join(cdir, jf);
    if (!fs.existsSync(fp)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { console.error('BAD JSON', fp); continue; }
    const fix = async (obj, field) => {
      const url = obj[field];
      if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) { skip++; return; }
      const local = await download(url, imgDir);
      if (local) obj[field] = 'data/cities/' + city + '/img/' + path.basename(local);
    };
    const walk = (item) => {
      if (j.gallery) for (const g of j.gallery) fixes.push(() => fix(g, 'img'));
      const lists = [j.items, j.unis, Array.isArray(j) ? j : null].filter(Boolean);
      for (const arr of lists) for (const it of arr) if (it && typeof it === 'object') fixes.push(() => fix(it, 'img'));
    };
    walk(j);
    fixes.push(() => { delete j._fp; fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n'); });
  }
}
console.log('JSON 文件任务就绪，开始下载…');
const queue = [...fixes];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const job = queue.shift();
    try { await job(); } catch (e) { console.error('JOB', e.message); }
    await new Promise(r => setTimeout(r, 120));
  }
}));
console.log(`DONE ok=${ok} fail=${fail} skip=${skip}`);
