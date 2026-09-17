import { readFileSync, writeFileSync } from 'fs';
const p = 'js/world.js';
let c = readFileSync(p, 'utf8');
const NL = c.includes('\r\n') ? '\r\n' : '\n';
const q = "'";
const L = s => s.join(NL);
const texFn = L([
  '// 成都专属地面：山地/平原/河流/花田/竹海分区微缩贴图',
  'function chengduTexture(S) {',
  '  const cv = document.createElement(' + q + 'canvas' + q + ');',
  '  cv.width = cv.height = S;',
  '  const c = cv.getContext(' + q + '2d' + q + ');',
  '  const grd = c.createLinearGradient(0, 0, S * 0.4, S);',
  "  grd.addColorStop(0, '#5E9E5E'); grd.addColorStop(0.45, '#7FCB72'); grd.addColorStop(1, '#8FD88A');",
  '  c.fillStyle = grd; c.fillRect(0, 0, S, S);',
  '  for (let i = 0; i < 260; i++) {',
  "    c.fillStyle = ['#8FD88A', '#74C06E', '#93D98B'][i % 3];",
  '    c.globalAlpha = 0.45;',
  '    c.beginPath();',
  '    c.ellipse(Math.random() * S, Math.random() * S, 5 + Math.random() * 16, 4 + Math.random() * 11, Math.random() * 3, 0, Math.PI * 2);',
  '    c.fill();',
  '  }',
  '  c.globalAlpha = 1;',
  "  c.fillStyle = '#4E8A4E';",
  '  c.beginPath(); c.moveTo(0, 0); c.lineTo(S * 0.44, 0); c.lineTo(S * 0.2, S * 0.3); c.lineTo(0, S * 0.4); c.closePath(); c.fill();',
  "  for (const pt of [[S * 0.08, S * 0.1, S * 0.1], [S * 0.2, S * 0.05, S * 0.08], [S * 0.3, S * 0.13, S * 0.06]]) {",
  "    c.fillStyle = '#5E9E6E';",
  '    c.beginPath(); c.moveTo(pt[0] - pt[2], pt[1]); c.lineTo(pt[0], pt[1] - pt[2] * 1.4); c.lineTo(pt[0] + pt[2], pt[1]); c.closePath(); c.fill();',
  "    c.fillStyle = '#FFFFFF';",
  '    c.beginPath(); c.moveTo(pt[0] - pt[2] * 0.4, pt[1] - pt[2] * 0.55); c.lineTo(pt[0], pt[1] - pt[2] * 1.4); c.lineTo(pt[0] + pt[2] * 0.4, pt[1] - pt[2] * 0.55); c.closePath(); c.fill();',
  '  }',
  "  c.lineCap = 'round';",
  '  const river = (x1, y1, cx1, cy1, w) => {',
  "    c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = w * 1.5;",
  '    c.beginPath(); c.moveTo(x1, y1); c.bezierCurveTo(cx1, cy1, S * 0.55, S * 0.5, S * 0.86, S * 0.88); c.stroke();',
  "    c.strokeStyle = '#7EC4F2'; c.lineWidth = w;",
  '    c.beginPath(); c.moveTo(x1, y1); c.bezierCurveTo(cx1, cy1, S * 0.55, S * 0.5, S * 0.86, S * 0.88); c.stroke();',
  '  };',
  '  river(S * 0.06, S * 0.14, S * 0.3, S * 0.4, S * 0.024);',
  '  river(S * 0.14, S * 0.06, S * 0.42, S * 0.3, S * 0.018);',
  "  c.fillStyle = '#F5D95A';",
  '  c.save(); c.translate(S * 0.72, S * 0.26); c.rotate(0.3); c.fillRect(-S * 0.09, -S * 0.05, S * 0.18, S * 0.1); c.restore();',
  '  c.save(); c.translate(S * 0.2, S * 0.72); c.rotate(-0.2); c.fillRect(-S * 0.07, -S * 0.045, S * 0.14, S * 0.09); c.restore();',
  "  c.fillStyle = '#5FA85A';",
  '  c.beginPath(); c.ellipse(S * 0.7, S * 0.72, S * 0.11, S * 0.08, 0.4, 0, Math.PI * 2); c.fill();',
  "  c.fillStyle = 'rgba(255,250,235,.5)';",
  '  c.beginPath(); c.arc(S / 2, S / 2, S * 0.1, 0, Math.PI * 2); c.fill();',
  "  c.fillStyle = '#F5F1E8';",
  '  c.globalAlpha = 0.16;',
  '  for (const d of [[-0.52, -0.4], [0.5, -0.45], [-0.45, 0.5], [0.52, 0.45]]) {',
  '    c.beginPath(); c.ellipse(S / 2 + d[0] * S / 2, S / 2 + d[1] * S / 2, S * 0.14, S * 0.11, 0, 0, Math.PI * 2); c.fill();',
  '  }',
  '  c.globalAlpha = 1;',
  '  const tex = new THREE.CanvasTexture(cv);',
  '  tex.colorSpace = THREE.SRGBColorSpace;',
  '  tex.anisotropy = 16;',
  '  return tex;',
  '}',
]);
const texAnchor = 'function cityIslandTexture(color, level, shape) {';
if (!c.includes(texAnchor)) { console.log('tex anchor missing'); process.exit(1); }
c = c.replace(texAnchor, texFn + NL + texFn);
c = c.replace('function cityIslandTexture(color, level, shape) {', 'function cityIslandTexture(color, level, shape, isl) {');
const sigCall = 'cityIslandTexture(color, isl.level, pts)';
if (!c.includes(sigCall)) { console.log('call missing'); process.exit(1); }
c = c.replace(sigCall, 'cityIslandTexture(color, isl.level, pts, isl)');
const brOld = '  const S = 512;' + NL;
c = c.replace(brOld, '  if (isl && isl.key === ' + q + 'chengdu' + q + ') return chengduTexture(1024);' + NL + '  const S = 512;' + NL);
writeFileSync(p, c);
console.log('chengdu texture fn done');