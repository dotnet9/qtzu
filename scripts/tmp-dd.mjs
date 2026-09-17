import { readFileSync, writeFileSync } from 'fs';
const p = 'js/world.js';
let c = readFileSync(p, 'utf8');
const fn = 'function chengduTexture';
const i1 = c.indexOf(fn);
const i2 = c.indexOf(fn, i1 + 10);
if (i2 < 0) { console.log('no dup'); process.exit(0); }
// 找第二份函数的结束（其后第一个独立的 return tex; 块尾）
const endMark = '  return tex;' + '\r\n}' ;
const e2 = c.indexOf(endMark, i2);
if (e2 < 0) { console.log('end missing'); process.exit(1); }
c = c.slice(0, i2) + c.slice(e2 + endMark.length).replace(/^\r?\n/, '');
// 签名补 isl 参数（若缺失）
c = c.replace('function cityIslandTexture(color, level, shape) {', 'function cityIslandTexture(color, level, shape, isl) {');
writeFileSync(p, c);
console.log('dedup + sig done');