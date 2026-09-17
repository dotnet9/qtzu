import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const exe = 'C:/Users/liu64/.agent-browser/browsers/chrome-153.0.8010.47/chrome.exe';
const ctx = await chromium.launchPersistentContext('.pw-profile', { headless: true, executablePath: exe, viewport: { width: 1280, height: 800 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('http://localhost:6100/', { waitUntil: 'load' });
await page.waitForTimeout(9000);
const report = await page.evaluate(() => {
  const g = window.__game;
  const THREE = window.THREE;
  const cols = g.world.colliders.filter(c => !c.dead);
  const covered = (x, z, pad) => cols.some(c => {
    if (c.t === 'c') return Math.hypot(x - c.x, z - c.z) < (c.r || 0) + pad;
    const cx = Math.max(c.x1, Math.min(x, c.x2)), cz = Math.max(c.z1, Math.min(z, c.z2));
    return Math.hypot(x - cx, z - cz) < pad;
  });
  const holes = [], okCount = { n: 0 };
  const box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
  const groups = [];
  const collect = o => { for (const c of o.children) { if (c.isObject3D) { groups.push(c); collect(c); } } };
  collect(g.scene);
  const audited = new Set();
  for (const grp of groups) {
    if (audited.has(grp.uuid) || !grp.visible) continue;
    let meshes = 0;
    grp.traverse(m => { if (m.isMesh) meshes++; });
    if (meshes < 2) continue;
    box.setFromObject(grp);
    box.getSize(size); box.getCenter(ctr);
    const maxDim = Math.max(size.x, size.z);
    if (maxDim < 2.2 || maxDim > 120) continue;
    if (size.y < 1.2) continue;
    const key = (grp.name || grp.type) + '@' + ctr.x.toFixed(0) + ',' + ctr.z.toFixed(0);
    if (audited.has(key)) continue;
    audited.add(key);
    const entry = { name: grp.name || grp.type || '?', x: +ctr.x.toFixed(1), z: +ctr.z.toFixed(1), w: +size.x.toFixed(1), d: +size.z.toFixed(1), h: +size.y.toFixed(1) };
    if (covered(ctr.x, ctr.z, 1.4)) okCount.n++; else holes.push(entry);
  }
  holes.sort((a, b) => Math.max(b.w, b.d) - Math.max(a.w, a.d));
  report.cols=cols; return { total: cols.length, ok: okCount.n, holesCount: holes.length, holes: holes.slice(0, 25) };
});
console.log('colliders:', report.total, '| covered:', report.ok, '| holes:', report.holesCount);
for (const h of report.holes.slice(0,3)) { const near = report.cols.map(c=>({c,d:+Math.hypot(h.x-c.x,h.z-c.z).toFixed(1),r:c.r||0})).sort((a,b)=>a.d-b.d).slice(0,2); console.log(JSON.stringify(h), JSON.stringify(near)); }
await ctx.close();
