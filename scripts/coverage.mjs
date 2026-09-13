import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();
const load = async rel => import(pathToFileURL(path.join(root, rel)).href);

const cur = await load('game/js/curriculum.js');
const w = await load('game/js/words.js');

const all = [];
for (const gk of Object.keys(cur.CURRICULUM))
  for (const u of cur.CURRICULUM[gk].units)
    for (const it of u.words) {
      const [en, zh] = it.split('|');
      all.push({ gk, grade: cur.CURRICULUM[gk].name, unit: u.name, en, zh });
    }
const uniqCur = [...new Map(all.map(x => [x.en, x])).values()];
const isSingle = s => /^[A-Za-z][A-Za-z'’.-]*$/.test(s);
const curSingle = uniqCur.filter(x => isSingle(x.en));
const curPhrase = uniqCur.filter(x => !isSingle(x.en));

const wEn = new Set(w.WORDS.map(x => x.en.toLowerCase()));
const missSingle = curSingle.filter(x => !wEn.has(x.en.toLowerCase()));

console.log('=== 3D 词库 ===');
console.log('WORDS:', w.WORDS.length, '| 岛屿:', w.ISLANDS.length, '| 关卡:', w.CHAPTERS.length, '| 场景:', new Set(w.WORDS.map(x => x.zone)).size);
console.log('=== 课本课程 ===');
console.log('条数:', all.length, '| 去重:', uniqCur.length, '| 单词:', curSingle.length, '| 短语:', curPhrase.length);
console.log('3D 已覆盖课本单词:', curSingle.length - missSingle.length, '/', curSingle.length);
if (missSingle.length) console.log('缺失单词:', missSingle.map(x => `${x.en}(${x.gk})`).join(', '));
console.log('3D 无覆盖短语:', curPhrase.length);
fs.writeFileSync('tools/cur-phrases.json', JSON.stringify(curPhrase, null, 1));
fs.writeFileSync('tools/cur-missing-single.json', JSON.stringify(missSingle, null, 1));
// 3D 额外词（不在课本）
const curSet = new Set(uniqCur.map(x => x.en.toLowerCase()));
const extra = w.WORDS.filter(x => !curSet.has(x.en.toLowerCase()));
console.log('3D 拓展词(非课本):', extra.length);
