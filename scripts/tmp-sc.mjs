import { readFileSync, writeFileSync } from 'fs';
const p = 'js/world.js';
let c = readFileSync(p, 'utf8');
const NL = c.includes('\r\n') ? '\r\n' : '\n';
const q = "'";
const anchor = '        grp.add(sh);' + NL + '      }';
if (!c.includes(anchor)) { console.log('anchor missing'); process.exit(1); }
const ins = [
  '        grp.add(sh);',
  '        // 迷你元素散布：与地面贴图色块对应（竹海/熊猫/脸谱/茶摊/金顶塔/小桥）',
  '        const W2 = x => mnXF + (mxxXF - mnXF) * x;',
  '        const Z2 = z => mnZF + (mxxZF - mnZF) * z;',
  '        for (const [bx, bz] of [[0.68, 0.7], [0.72, 0.75], [0.63, 0.77]]) {',
  '          for (let k = 0; k < 7; k++) {',
  '            cyl(grp, 0.05, 0.07, 1.4 + (k % 3) * 0.5, ' + q + '#6FAF5A' + q + ', W2(bx) + (k % 3) * 0.4 - 0.4, 0.8, Z2(bz) + (k % 2) * 0.45 - 0.22, 0, 0, (k % 2) * 0.16 - 0.08);',
  '          }',
  '        }',
  '        for (const [bx, bz, ry] of [[0.6, 0.65, 0.4], [0.76, 0.7, 2.2]]) {',
  '          const pg = new THREE.Group();',
  "          sph(pg, 0.5, '#F5F1E8', 0, 0.45, 0);",
  "          sph(pg, 0.32, '#F5F1E8', 0, 0.85, 0.15);",
  "          sph(pg, 0.1, '#2A2A2A', -0.18, 1.06, 0.06);",
  "          sph(pg, 0.1, '#2A2A2A', 0.18, 1.06, 0.06);",
  '          pg.position.set(W2(bx), 0, Z2(bz)); pg.rotation.y = ry; grp.add(pg);',
  '        }',
  '        for (const [bx, bz, cc] of [[0.35, 0.55, ' + q + '#3A6FD8' + q + '], [0.43, 0.49, ' + q + '#D84A3A' + q + ']]) {',
  '          cyl(grp, 0.04, 0.06, 1.5, ' + q + '#8A6B4A' + q + ', W2(bx), 0.75, Z2(bz));',
  '          sph(grp, 0.3, cc, W2(bx), 1.72, Z2(bz), 1, 1.2, 0.35);',
  '        }',
  '        cyl(grp, 0.04, 0.05, 1.2, ' + q + '#8A6B4A' + q + ', W2(0.5), 0.6, Z2(0.35));',
  '        cone(grp, 0.95, 0.5, ' + q + '#E85A5A' + q + ', W2(0.5), 1.5, Z2(0.35));',
  '        box(grp, 0.75, 0.08, 0.5, ' + q + '#A87848' + q + ', W2(0.5), 0.55, Z2(0.35) + 0.75);',
  '        for (let k = 0; k < 3; k++) cyl(grp, 0.5 - k * 0.13, 0.62 - k * 0.13, 0.5, k % 2 ? ' + q + '#E8C86A' + q + ' : ' + q + '#C4788F' + q + ', W2(0.28), 0.3 + k * 0.5, Z2(0.36), 0, 0, 0, 8);',
  '        cone(grp, 0.32, 0.6, ' + q + '#E8C86A' + q + ', W2(0.28), 2.15, Z2(0.36));',
  '        box(grp, 2.6, 0.15, 0.9, ' + q + '#A87848' + q + ', W2(0.52), 0.25, Z2(0.58), 0, 0.5, 0);',
].join(NL);
c = c.replace(anchor, ins);
writeFileSync(p, c);
console.log('scatter added');