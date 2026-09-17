import { readFileSync, writeFileSync } from 'fs';
const p2 = 'js/game.js';
let g = readFileSync(p2, 'utf8');
const q = "'";
const NL = g.includes('\r\n') ? '\r\n' : '\n';
const old = '      const hw = size.x / 2, hd = size.z / 2; this.world.colliders.push({ t: \'r\', x1: +(ctr.x - hw).toFixed(2), x2: +(ctr.x + hw).toFixed(2), z1: +(ctr.z - hd).toFixed(2), z2: +(ctr.z + hd).toFixed(2), auto: true });';
if (!g.includes(old)) { console.log('push still missing'); process.exit(1); }
const ins = [
  '      const hw = size.x / 2, hd = size.z / 2;',
  '      const cxM = fx + (hw - (size.x / 2)) * 0, czM = fz;',
  '      this.world.colliders.push({ t: \'r\', x1: +(fx - hw).toFixed(2), x2: +(fx + hw).toFixed(2), z1: +(fz - hd).toFixed(2), z2: +(fz + hd).toFixed(2), auto: true, grp });',
].join(N);
g = g.replace(old, ins);
writeFileSync(p2, g);
console.log('push fixed');