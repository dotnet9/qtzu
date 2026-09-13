import fs from 'node:fs';

const src = fs.readFileSync('game/js/words.js', 'utf8');
const re = /\[\s*'([^']*)'\s*,\s*'([^']*)'/g;
let m;
const rows = [];
while ((m = re.exec(src))) rows.push([m[1], m[2]]);
const uniq = [...new Map(rows.map(r => [r[0].toLowerCase(), r])).values()];
const isSingle = w => /^[A-Za-z][A-Za-z'’-]*$/.test(w);
const single = uniq.filter(r => isSingle(r[0]));
const multi = uniq.filter(r => !isSingle(r[0]));
console.log('rows:', rows.length, 'unique:', uniq.length, 'single:', single.length, 'multi:', multi.length);
console.log('multi:', multi.map(r => r[0]).join(' | '));

const cur = fs.readFileSync('game/js/curriculum.js', 'utf8');
const cre = /"([^"]*\|[^"]*)"|'([^']*\|[^']*)'/g;
const citems = [];
let cm;
while ((cm = cre.exec(cur))) citems.push((cm[1] || cm[2]).split('|')[0]);
const cuniq = [...new Set(citems)];
const cSingle = cuniq.filter(isSingle).map(s => s.toLowerCase());
const cMulti = cuniq.filter(w => !isSingle(w)).map(s => s.toLowerCase());
console.log('curriculum unique:', cuniq.length, 'single:', cSingle.length, 'multi:', cMulti.length);
const set = new Set(uniq.map(r => r[0].toLowerCase()));
const missS = cSingle.filter(x => !set.has(x));
const missM = cMulti.filter(x => !set.has(x));
console.log('curriculum single missing from 3D:', missS.length, missS.join(', '));
console.log('curriculum multi missing from 3D:', missM.length, missM.join(' | '));

// also list 3D words NOT in curriculum
const cset = new Set(cuniq.map(s => s.toLowerCase()));
const extra = uniq.filter(r => !cset.has(r[0].toLowerCase()));
console.log('3D words not in curriculum:', extra.length);
