import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const merged = JSON.parse(fs.readFileSync('tools/pep-merged.json', 'utf8'));
const w = await import(pathToFileURL(process.cwd() + '/' + 'game/js/words.js').href);
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
const in3d = new Set(w.WORDS.map(x => norm(x.en)));

const missWord = merged.single.filter(x => !in3d.has(norm(x.en)));
const missPhrase = merged.phrase.filter(x => !in3d.has(norm(x.en)));
console.log('merged single', merged.single.length, 'phrase', merged.phrase.length);
console.log('missing from 3D: single', missWord.length, 'phrase', missPhrase.length);

// group by volume (from vols set); multi-volume → first vol
const byVol = {};
for (const x of [...missWord, ...missPhrase]) {
  const vol = [...(x.vols || [])].find(v => v !== 'cur') || 'misc';
  (byVol[vol] ||= []).push(x);
}
for (const k of Object.keys(byVol).sort()) {
  const arr = byVol[k];
  console.log(` ${k}: total=${arr.length} words=${arr.filter(a=>!/\s/.test(a.en)).length} phrases=${arr.filter(a=>/\s/.test(a.en)).length}`);
}
fs.writeFileSync('tools/pep-missing.json', JSON.stringify({ missWord, missPhrase }, null, 1));
console.log('\nwritten tools/pep-missing.json');
