import fs from 'node:fs';
const src = fs.readFileSync('game/js/curriculum.js', 'utf8');
// entry strings contain '|'; apostrophe entries are wrapped in double quotes
const re = /"([^"]*\|[^"]*)"|'([^']*\|[^']*)'/g;
const items = [];
let m;
while ((m = re.exec(src))) items.push(m[1] || m[2]);
const en = items.map(s => s.split('|')[0]);
const zh = items.map(s => s.split('|')[1]);
const uniq = [...new Set(en)];
const isSingle = w => /^[A-Za-z][A-Za-z'’-]*$/.test(w);
console.log('raw entries:', items.length);
console.log('unique en:', uniq.length);
console.log('single:', uniq.filter(isSingle).length, 'multi:', uniq.filter(w => !isSingle(w)).length);
console.log('sample multi:', uniq.filter(w => !isSingle(w)).slice(0, 25).join(' | '));
