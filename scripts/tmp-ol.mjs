import { readFileSync, writeFileSync } from 'fs';
const p1 = 'js/world.js';
const p2 = 'js/game.js';
let w = readFileSync(p1, 'utf8');
let g = readFileSync(p2, 'utf8');
const NL = c => c.includes('\r\n') ? '\r\n' : '\n';
const N = NL(g);
let ok = true;
const LMH = 'LM_HALF[type] === undefined ? 2.8 : LM_HALF[type]';
const lmAnchor = '        const lm = cityLandmark(type, color);';
if (!w.includes(lmAnchor)) { console.log('W1 missing'); ok = false; }
else {
  w = w.replace(lmAnchor, '        lmSpots.push([lx, lz]);' + N + lmAnchor);
  const collAnchor = '        const placed = [];';
  if (!w.includes(collAnchor)) { console.log('W2 missing'); ok = false; }
  else {
    w = w.replace(collAnchor, collAnchor + N + '        const lmHalf = ' + LMH + ';' + N + '        const lmFar = (px, pz) => lmSpots.every(q => Math.hypot(q[0] - px, q[1] - pz) > lmHalf * 0.9 + 2.2);');
    const spotOld = '            if (placed.some(q => Math.hypot(q[0] - px, q[1] - pz) < gap)) continue;';
    if (!w.includes(spotOld)) { console.log('W3 missing'); ok = false; }
    else w = w.replace(spotOld, spotOld + N + '            if (!lmFar(px, pz)) continue;');
    const lmDecl = '      const lms = (isl.level';
    if (!w.includes(lmDecl)) { console.log('W4 missing'); ok = false; }
    else w = w.replace(lmDecl, '      const lmSpots = [[0, 0]];' + N + lmDecl);
  }
}
const signPush = '        grp.add(sign);';
if (!g.includes(signPush)) { console.log('G1 missing'); ok = false; }
else g = g.replace(signPush, signPush + N + "        this.world.colliders.push({ t: 'c', x: +x.toFixed(2), z: +z.toFixed(2), r: 1.2, fixed: true });");
const gatePush = '          grp.add(gate);';
if (!g.includes(gatePush)) { console.log('G2 missing'); ok = false; }
else g = g.replace(gatePush, gatePush + N + "          this.world.colliders.push({ t: 'c', x: +x.toFixed(2), z: +z.toFixed(2), r: 2.2, fixed: true });");
const regOld = '        if (covered) continue;';
if (!g.includes(regOld)) { console.log('G3 missing'); ok = false; }
else {
  const OR = String.fromCharCode(124, 124);
  const regNew = [
    '        if (covered) continue;',
    '        const ownR = Math.min(4.5, Math.max(0.9, maxDim * 0.38));',
    '        let fx = ctr.x, fz = ctr.z;',
    '        for (const c2 of this.world.colliders) {',
    "          if (c2.dead " + OR + " c2.auto) continue;",
    "          const r2 = c2.t === 'c' ? Number(c2.r) : 0;",
    "          const cx2 = c2.t === 'c' ? c2.x : (c2.x1 + c2.x2) / 2;",
    "          const cz2 = c2.t === 'c' ? c2.z : (c2.z1 + c2.z2) / 2;",
    '          const dd = Math.hypot(fx - cx2, fz - cz2), minD = r2 + ownR + 0.3;',
    '          if (dd > 0.01) { if (dd < minD) { fx += (fx - cx2) / dd * (minD - dd); fz += (fz - cz2) / dd * (minD - dd); } }',
    '        }',
    '        fx = Math.max(mnXF + 1, Math.min(mxxXF - 1, fx));',
    '        fz = Math.max(mnZF + 1, Math.min(mxxZF - 1, fz));',
    '        const dxMv = fx - ctr.x, dzMv = fz - ctr.z;',
    '        if (Math.abs(dxMv) + Math.abs(dzMv) > 0.05) grp.position.set(grp.position.x + dxMv, grp.position.y, grp.position.z + dzMv);',
  ].join(N);
  g = g.replace(regOld, regNew);
  const pushOld = "        this.world.colliders.push({ t: 'c', x: +ctr.x.toFixed(2), z: +ctr.z.toFixed(2), r: +rr.toFixed(2), auto: true });";
  if (!g.includes(pushOld)) { console.log('G4 missing'); ok = false; }
  else g = g.replace(pushOld, "        this.world.colliders.push({ t: 'c', x: +fx.toFixed(2), z: +fz.toFixed(2), r: +ownR.toFixed(2), auto: true, grp });");
  const rrDecl = '        const rr = Math.min(4.5, Math.max(0.9, maxDim * 0.38));';
  if (g.includes(rrDecl)) g = g.replace(rrDecl, '        const ownR = rr;');
}
const acOld = '    this._autoColliders(wIsl ' + String.fromCharCode(38,38) + ' wIsl.grp);   // 大件碰撞兜底（须在 NPC/蛋落位前）' + N;
if (g.includes(acOld)) g = g.replace(acOld, '');
const bsAnchor = '    this._buildSigns(cur);' + N;
if (!g.includes(bsAnchor)) { console.log('G5 missing'); ok = false; }
else g = g.replace(bsAnchor, bsAnchor + '    this._autoColliders(wIsl ' + String.fromCharCode(38,38) + ' wIsl.grp);   // 大件碰撞兜底+推开避让' + N);
if (!ok) process.exit(1);
writeFileSync(p1, w);
writeFileSync(p2, g);
console.log('all applied');