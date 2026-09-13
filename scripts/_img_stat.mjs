import fs from 'fs';
import path from 'path';
const ROOT = path.resolve('data/cities');
const getArr = (j, keys) => {
  for (const k of keys) if (Array.isArray(j[k])) return j[k];
  return Array.isArray(j) ? j : [];
};
const stat = { ext: 0, local: 0, none: 0, noImgField: 0 };
const cities = fs.readdirSync(ROOT).filter(d => fs.statSync(path.join(ROOT, d)).isDirectory());
for (const c of cities) {
  for (const f of ['city.json', 'foods.json', 'scenes.json', 'universities.json']) {
    const fp = path.join(ROOT, c, f);
    if (!fs.existsSync(fp)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { continue; }
    const arrs = [];
    if (j.gallery) arrs.push(j.gallery);
    arrs.push(getArr(j, ['items', 'unis', 'list']));
    for (const arr of arrs) {
      for (const it of arr) {
        if (!it || typeof it !== 'object') continue;
        if (!('img' in it)) { stat.noImgField++; continue; }
        if (!it.img) stat.none++;
        else if (it.img.startsWith('http')) stat.ext++;
        else stat.local++;
      }
    }
  }
}
console.log('外链:', stat.ext, '本地:', stat.local, '空:', stat.none, '无img字段:', stat.noImgField);
