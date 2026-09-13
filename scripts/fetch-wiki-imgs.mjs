#!/usr/bin/env node
// 用 zh.wikipedia summary API 给大学/美食/风景条目补 img（thumbnail 外链）。
// 只补缺失：unis 无 img 字段、foods/scenes img 为空或指定 --refill-all 时替换 404 外链。
// 之后跑 scripts/localize-city-images.mjs 统一下载到本地。
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('data/cities');
const REFILL_ALL = process.argv.includes('--refill-all');
const REFILL_FS = process.argv.includes('--refill-foods-scenes'); // 只重刷 foods/scenes（大学刚补过不用重刷）
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wikiThumb(title, tries = 3) {
  const url = 'https://zh.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'QTZuBot/1.0 (kids edu game)' } });
      clearTimeout(t);
      if (res.status === 404) return null;
      if (res.status === 429) throw Object.assign(new Error('429'), { rate: true });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const src = j.thumbnail && j.thumbnail.source;
      return src ? src.split('?')[0] : null;      // 去掉 utm 参数
    } catch (e) {
      if (e.rate) { await sleep(20000 * (i + 1)); continue; }   // 限流：长退避
      if (i === tries - 1) { console.error('FAIL', title, e.message); return null; }
      await sleep(1500 * (i + 1));
    }
  }
}

const jobs = [];
const cities = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT, d)).isDirectory());
for (const c of cities) {
  // city.json 画廊：img 为死外链（或缺失）时用 caption 作词条补维基缩略图
  const cfp = path.join(ROOT, c, 'city.json');
  if (fs.existsSync(cfp)) {
    let cj; try { cj = JSON.parse(fs.readFileSync(cfp, 'utf8')); } catch { cj = null; }
    if (cj && Array.isArray(cj.gallery)) {
      let gChanged = false;
      for (const g of cj.gallery) {
        if (!g || !g.caption) continue;
        const dead = !g.img || /^https?:\/\//.test(g.img);
        if (dead && g.img && /upload\.wikimedia\.org\/wikipedia\//.test(g.img)) continue;
        if (REFILL_ALL || REFILL_FS ? dead : !g.img) {
          jobs.push(async () => {
            const u = await wikiThumb(g.caption);
            if (u) { g.img = u; gChanged = true; }
          });
        }
      }
      jobs.push(async () => {
        if (gChanged) fs.writeFileSync(cfp, JSON.stringify(cj, null, 2) + '\n');
      });
    }
  }
  for (const f of ['foods.json', 'scenes.json', 'universities.json']) {
    const fp = path.join(ROOT, c, f);
    if (!fs.existsSync(fp)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    const arr = Array.isArray(j) ? j : (j.unis || j.items || []);
    const listKey = Array.isArray(j) ? null : (j.unis ? 'unis' : (j.items ? 'items' : null));
    let changed = false;
    for (const it of arr) {
      if (!it || !it.name && !it.zh) continue;
      const title = it.zh || it.name;
      const refill = REFILL_ALL || (REFILL_FS && f !== 'universities.json');
      // 已是维基直链的视为新源，跳过（断点续跑不重复）
      if (refill && it.img && /upload\.wikimedia\.org\/wikipedia\//.test(it.img)) continue;
      if (refill || !it.img) {
        jobs.push(async () => {
          const u = await wikiThumb(title);
          if (u) { it.img = u; changed = true; }
        });
      }
    }
    jobs.push(async () => {
      if (changed) fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n');
    });
  }
}
console.log('任务数:', jobs.length);
const queue = [...jobs];
let done = 0;
const CONC = Number(process.env.WIKI_CONC || 8);   // 并发数（默认 8，防限流可降回 1）
const GAP = Number(process.env.WIKI_GAP || 120);   // 每条间隔 ms
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) { await sleep(GAP);
    const job = queue.shift();
    try { await job(); } catch (e) { console.error('JOB', e.message); }
    if (++done % 20 === 0) process.stdout.write(`\r${done}`);
  }
}));
console.log('\n完成');
