#!/usr/bin/env node
// 兜底换源：对仍是 commons.wikimedia.org/Special:FilePath 死链（或无图）的条目，
// 用 Commons search API 按名称搜索真实存在的文件，取其缩略图直链替换。
// 只处理外链/缺失，不动已是 upload./thumb.wikimedia.org 直链和本地路径。
// 用法：node scripts/fetch-commons-imgs.mjs [--refill-all]
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('data/cities');
const REFILL_ALL = process.argv.includes('--refill-all');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Commons 搜索：namespace 6 = File，位图优先，取第一个结果的 640px 缩略图
async function commonsThumb(title, tries = 3) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2'
    + '&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch='
    + encodeURIComponent(`filetype:bitmap ${title}`)
    + '&prop=imageinfo&iiprop=url&iiurlwidth=640';
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'QTZuBot/1.0 (kids edu game)' } });
      clearTimeout(t);
      if (res.status === 429) { await sleep(8000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const pages = j.query && j.query.pages;
      if (!pages || !pages.length) return null;      // 搜不到：正常返回空
      for (const pg of pages) {
        const ii = pg.imageinfo && pg.imageinfo[0];
        if (ii && ii.thumburl) return ii.thumburl.split('?')[0];   // 去 utm 参数
      }
      return null;
    } catch (e) {
      clearTimeout(t);
      if (i === tries - 1) { console.error('FAIL', title, e.message); return null; }
      await sleep(1500 * (i + 1));
    }
  }
}

const jobs = [];
const cities = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT, d)).isDirectory());
for (const c of cities) {
  // city.json 画廊：caption 作搜索词
  const cfp = path.join(ROOT, c, 'city.json');
  if (fs.existsSync(cfp)) {
    let cj; try { cj = JSON.parse(fs.readFileSync(cfp, 'utf8')); } catch { cj = null; }
    if (cj && Array.isArray(cj.gallery)) {
      let changed = false;
      for (const g of cj.gallery) {
        if (!g || !g.caption) continue;
        const stale = !g.img || /^https?:\/\//.test(g.img);
        if (!REFILL_ALL && !stale) continue;
        if (/^data\//.test(g.img)) continue;                       // 已本地化
        if (/upload\.wikimedia\.org|thumb\.wikimedia\.org/.test(g.img || '')) continue; // 已是新源
        jobs.push(async () => {
          const u = await commonsThumb(g.caption);
          if (u) { g.img = u; changed = true; }
        });
      }
      jobs.push(async () => { if (changed) fs.writeFileSync(cfp, JSON.stringify(cj, null, 2) + '\n'); });
    }
  }
  for (const f of ['foods.json', 'scenes.json', 'universities.json']) {
    const fp = path.join(ROOT, c, f);
    if (!fs.existsSync(fp)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    const arr = Array.isArray(j) ? j : (j.unis || j.items || []);
    let changed = false;
    for (const it of arr) {
      if (!it || !it.name && !it.zh) continue;
      const title = it.zh || it.name;
      const stale = !it.img || /^https?:\/\//.test(it.img);
      if (!REFILL_ALL && !stale) continue;
      if (/^data\//.test(it.img)) continue;
      if (/upload\.wikimedia\.org|thumb\.wikimedia\.org/.test(it.img || '')) continue;
      jobs.push(async () => {
        const u = await commonsThumb(title);
        if (u) { it.img = u; changed = true; }
      });
    }
    jobs.push(async () => { if (changed) fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n'); });
  }
}
console.log('任务数:', jobs.length);
const queue = [...jobs];
let done = 0;
const CONC = Number(process.env.CONS_CONC || 6);
const GAP = Number(process.env.CONS_GAP || 200);
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) { await sleep(GAP);
    const job = queue.shift();
    try { await job(); } catch (e) { console.error('JOB', e.message); }
    if (++done % 20 === 0) process.stdout.write(`\r${done}`);
  }
}));
console.log('\n完成');
