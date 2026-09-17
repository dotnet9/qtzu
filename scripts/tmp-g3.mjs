import { readFileSync, writeFileSync } from 'fs';
const p2 = 'js/game.js';
let g = readFileSync(p2, 'utf8');
const N = g.includes('\r\n') ? '\r\n' : '\n';
const OR = String.fromCharCode(124, 124);
const regOld = '      if (covered) continue;';
if (!g.includes(regOld)) { console.log('G3 still missing'); process.exit(1); }
const regNew = [
  '      if (covered) continue;',
  '      const ownR = Math.min(4.5, Math.max(0.9, maxDim * 0.38));',
  '      let fx = ctr.x, fz = ctr.z;',
  '      for (const c2 of this.world.colliders) {',
  "        if (c2.dead " + OR + " c2.auto) continue;",
  "        const r2 = c2.t === 'c' ? Number(c2.r) : 0;",
  "        const cx2 = c2.t === 'c' ? c2.x : (c2.x1 + c2.x2) / 2;",
  "        const cz2 = c2.t === 'c' ? c2.z : (c2.z1 + c2.z2) / 2;",
  '        const dd = Math.hypot(fx - cx2, fz - cz2), minD = r2 + ownR + 0.3;',
  '        if (dd > 0.01) { if (dd < minD) { fx += (fx - cx2) / dd * (minD - dd); fz += (fz - cz2) / dd * (minD - dd); } }',
  '      }',
  '      const dxMv = fx - ctr.x, dzMv = fz - ctr.z;',
  '      if (Math.abs(dxMv) + Math.abs(dzMv) > 0.05) grp.position.set(grp.position.x + dxMv, grp.position.y, grp.position.z + dzMv);',
].join(N);
g = g.replace(regOld, regNew);
const pushOld = "      this.world.colliders.push({ t: 'c', x: +ctr.x.toFixed(2), z: +ctr.z.toFixed(2), r: +rr.toFixed(2), auto: true });";
if (!g.includes(pushOld)) { console.log('G4 missing'); process.exit(1); }
g = g.replace(pushOld, "      this.world.colliders.push({ t: 'c', x: +fx.toFixed(2), z: +fz.toFixed(2), r: +ownR.toFixed(2), auto: true, grp });");
const rrDecl = '      const rr = Math.min(4.5, Math.max(0.9, maxDim * 0.38));';
if (g.includes(rrDecl)) g = g.replace(rrDecl, '      const ownR = rr;');
writeFileSync(p2, g);
console.log('G3-G4 applied');