// 批量生成各城市微缩地形配置 data/cities/<id>/terrain.json（模板×分配表驱动）
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const hash = s => { let h = 5381; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 100000; };
const GREENS = [[0.49,0.78,0.47],[0.44,0.72,0.42],[0.38,0.65,0.37],[0.31,0.56,0.31],[0.26,0.47,0.27],[0.22,0.40,0.24]];
const LOESS  = [[0.78,0.68,0.42],[0.74,0.63,0.38],[0.70,0.58,0.34],[0.65,0.53,0.31],[0.60,0.48,0.28],[0.55,0.44,0.26]];
const PLATEAU= [[0.55,0.62,0.38],[0.50,0.57,0.35],[0.46,0.52,0.32],[0.42,0.47,0.29],[0.38,0.42,0.26],[0.34,0.38,0.24]];
const SAND   = [[0.90,0.80,0.52],[0.88,0.77,0.48],[0.85,0.73,0.44],[0.82,0.70,0.41],[0.79,0.66,0.38],[0.76,0.63,0.35]];
const COLD   = [[0.72,0.80,0.76],[0.67,0.75,0.72],[0.62,0.70,0.68],[0.57,0.65,0.63],[0.52,0.60,0.59],[0.47,0.55,0.55]];
const KARST  = [[0.36,0.66,0.35],[0.32,0.60,0.32],[0.29,0.54,0.29],[0.26,0.48,0.27],[0.23,0.42,0.25],[0.20,0.37,0.23]];
const TROPIC = [[0.40,0.74,0.38],[0.36,0.69,0.36],[0.32,0.63,0.34],[0.28,0.57,0.31],[0.25,0.51,0.28],[0.22,0.45,0.26]];
const GRASS  = [[0.62,0.74,0.42],[0.58,0.70,0.39],[0.54,0.66,0.36],[0.50,0.61,0.33],[0.46,0.56,0.30],[0.42,0.51,0.27]];
const TG = [[0.85,0.70,0.24],[0.72,0.55,0.19]], FW = [[0.94,0.85,0.35],[0.87,0.74,0.30]], FS = [[0.93,0.85,0.60],[0.88,0.78,0.52]];
const R_EW   = [[0.42,-0.70],[0.38,-0.40],[0.34,-0.10],[0.32,0.20],[0.36,0.50],[0.42,0.70]];
const R_NS   = [[-0.70,-0.50],[-0.40,-0.52],[-0.10,-0.55],[0.20,-0.52],[0.50,-0.50],[0.70,-0.48]];
const R_DIAG = [[-0.60,-0.60],[-0.30,-0.42],[-0.05,-0.25],[0.25,-0.02],[0.42,0.30],[0.55,0.60]];
const R_WIDE = [[-0.70,-0.35],[-0.40,-0.30],[-0.10,-0.28],[0.20,-0.30],[0.50,-0.35],[0.70,-0.40]];
const R_BEND = [[-0.65,0.10],[-0.35,0.05],[-0.10,0.15],[0.15,0.35],[0.45,0.40],[0.68,0.30]];
const base = id => ({ _说明: '城市微缩分层地形配置（js/terrain.js 消费）。坐标归一化 [-1,1]×R；高度/宽度为米。由 scripts/gen-terrain.mjs 生成，可手工微调。',
  step: 0.9, riverW: 1.2, seed: hash(id), edgeFlat: [3, 10], noise: 0.15, colorCell: 2.5,
  plaza: { center: [0, 0.04], inner: 0.10, outer: 0.32, flat: 0.9 },
  colors: { greens: GREENS, terraceGold: TG, farmStripe: FW, snow: [0.96,0.98,1.0], plaza: [0.78,0.88,0.62], jitter: 0.05 },
  snow: [5.2, 6.6] });
const mt = (c, amp, cx, cz, pow = 1.5, noise = null) => { c.mountain = { center: [cx, cz], near: 0.18, far: 0.46, pow }; if (noise !== null) c.noise = noise; return c; };
const pk = (cx, cz, defs) => defs.map(d => [+(d[0] + cx).toFixed(3), +(d[1] + cz).toFixed(3), d[2], d[3]]);
const HILL = (cx, cz, amp = 2.2) => ({ center: [cx, cz], near: 0.13, far: 0.42, pow: 1.5, amp });
const TER = (cx, cz) => ({ center: [cx, cz], rx: 0.28, rz: 0.20, cell: 5 });
const FARM = (cx, cz, r0 = 0.10, r1 = 0.20) => ({ center: [cx, cz], r0, r1 });
const LAKE = (x, z, rx = 7, rz = 5.5) => ({ at: [x, z], rx, rz });
const TPL = {
  imperial: id => { const c = base(id); c.hill = HILL(0.02, -0.58, 2.0); c.rivers = [R_EW]; c.farm = FARM(0.52, 0.28); return c; },
  loess: id => { const c = base(id); mt(c, 5.5, -0.52, -0.50, 1.8, 0.22); c.terrace = TER(-0.28, -0.28); c.farm = FARM(0.42, 0.30); c.rivers = [R_NS]; c.colors.greens = LOESS; c.colors.terraceGold = [[0.80,0.62,0.22],[0.70,0.52,0.18]]; return c; },
  grassland: id => { const c = base(id); mt(c, 3.6, -0.55, -0.52, 2.0, 0.25); c.hill = HILL(0.5, -0.3, 1.8); c.rivers = [R_NS]; c.farm = FARM(0.45, 0.30); c.colors.greens = GRASS; return c; },
  alpine: id => { const c = base(id); c.amp = 7.5; mt(c, 7.5, -0.48, -0.46, 1.5, 0.18); c.peaks = pk(-0.48, -0.46, [[0,-0.06,7.5,3.4],[-0.14,0.08,6.5,3.0],[0.12,0.10,6.8,3.2],[0.02,-0.16,5.8,2.8],[0.16,-0.05,6.2,3.0]]); c.terrace = TER(-0.20, -0.18); c.rivers = [R_DIAG]; c.snow = [4.2, 5.4]; c.colors.greens = PLATEAU; return c; },
  desert: id => { const c = base(id); mt(c, 3.2, -0.5, -0.42, 2.2, 0.3); c.rivers = []; c.lake = LAKE(-0.18, -0.30, 3.4, 2.6); c.farm = FARM(0.15, 0.32, 0.08, 0.16); c.colors.greens = SAND; c.colors.farmStripe = FS; c.snow = [99, 100]; return c; },
  water: id => { const c = base(id); c.hill = HILL(-0.52, 0.42, 3.0); c.lake = LAKE(0.38, 0.32, 8.5, 6.5); c.rivers = [R_BEND]; c.farm = FARM(0.35, -0.38); return c; },
  canal: id => { const c = base(id); c.rivers = [R_EW, [[-0.5,-0.15],[-0.2,-0.12],[0.1,-0.10],[0.4,-0.12],[0.65,-0.15]], [[-0.55,0.42],[-0.25,0.45],[0.05,0.47],[0.35,0.45],[0.6,0.42]]]; c.farm = FARM(-0.45, -0.40); return c; },
  rivercity: id => { const c = base(id); c.riverW = 2.0; c.hill = HILL(-0.55, 0.45, 3.2); c.rivers = [R_DIAG]; c.farm = FARM(0.5, -0.45); return c; },
  twinriver: id => { const c = base(id); c.riverW = 1.8; c.rivers = [R_DIAG, [[-0.68,0.35],[-0.4,0.22],[-0.15,0.05],[0.1,-0.18],[0.35,-0.42],[0.5,-0.65]]]; mt(c, 4.0, -0.58, -0.35, 1.8, 0.26); c.colors.greens = KARST; return c; },
  karst: id => { const c = base(id); mt(c, 4.2, -0.5, -0.4, 1.2, 0.32); c.hill = HILL(0.5, 0.4, 2.4); c.rivers = [R_DIAG]; c.colors.greens = KARST; return c; },
  coast: id => { const c = base(id); c.hill = HILL(-0.55, -0.42, 3.0); c.rivers = [R_DIAG]; c.farm = FARM(0.45, 0.40, 0.08, 0.16); c.colors.farmStripe = FS; return c; },
  tropical: id => { const c = base(id); c.hill = HILL(-0.5, -0.45, 2.4); c.rivers = [R_DIAG]; c.farm = FARM(0.42, 0.35, 0.10, 0.20); c.colors.greens = TROPIC; c.colors.farmStripe = FS; return c; },
  ice: id => { const c = base(id); c.riverW = 2.2; c.rivers = [R_WIDE]; c.hill = HILL(0.55, 0.35, 2.2); c.snow = [4.2, 5.2]; c.colors.greens = COLD; return c; },
  gardenhill: id => { const c = base(id); mt(c, 5.0, -0.55, -0.42, 1.5, 0.2); c.peaks = pk(-0.55, -0.42, [[0,0.05,5.5,2.8],[0.14,-0.06,4.8,2.4]]); c.lake = LAKE(0.3, 0.3, 6.5, 5); c.rivers = [R_DIAG]; c.terrace = TER(-0.24, -0.22); return c; },
};
const ASSIGN = {
  beijing: 'imperial', tianjin: 'imperial', shijiazhuang: 'imperial', zhengzhou: 'imperial', hefei: 'imperial',
  changchun: 'imperial', shenyang: 'imperial', kaifeng: 'imperial', qufu: 'imperial',
  xian: 'loess', luoyang: 'loess', datong: 'loess', lanzhou: 'loess', yinchuan: 'loess', taiyuan: 'loess',
  hohhot: 'grassland',
  lhasa: 'alpine', xining: 'alpine', urumqi: 'alpine', kunming: 'alpine',
  dunhuang: 'desert',
  hangzhou: 'water', nanjing: 'water', nanchang: 'water', jinan: 'gardenhill', chengde: 'gardenhill',
  suzhou: 'canal', shaoxing: 'canal', yangzhou: 'canal', wuxi: 'canal',
  wuhan: 'twinriver', chongqing: 'twinriver',
  guiyang: 'karst',
  dalian: 'coast', qingdao: 'coast', xiamen: 'coast', shenzhen: 'coast', zhuhai: 'coast',
  kaohsiung: 'coast', taichung: 'coast', tainan: 'coast', taipei: 'coast', fuzhou: 'coast', quanzhou: 'coast',
  sanya: 'tropical', haikou: 'tropical', harbin: 'ice', changsha: 'rivercity',
  guangzhou: 'twinriver', nanning: 'rivercity', shanghai: 'rivercity',
};
const dirs = execSync('dir /b data\\cities', { shell: 'cmd.exe' }).toString().split(/\r?\n/).filter(Boolean);
let made = 0, skipped = 0, missing = [];
for (const id of dirs) {
  if (!existsSync(`data/cities/${id}/city.json`)) continue;
  if (id === 'chengdu') { skipped++; continue; }
  const tpl = ASSIGN[id];
  if (!tpl) { missing.push(id); continue; }
  const cfg = TPL[tpl](id);
  writeFileSync(`data/cities/${id}/terrain.json`, JSON.stringify(cfg, null, 2) + '\n');
  made++;
}
console.log(`generated=${made} skipped=${skipped} missing_tpl=${missing.join(',') || 'none'}`);
