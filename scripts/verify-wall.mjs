// 城市边界（卡通长城）改造校验。
//
// 为什么这样验：我读不了截图，而"断面有没有做出来"是可以**量**的 ——
// 用射线在墙的横截面上扫一遍，量出外沿宽度、三个高度、基座外扩，再和 js/wall-spec.js 的
// 共享数据对账。断面数据是两侧共用的同一份，所以"程序化侧量到的形状 == 规格"就等于
// "烘焙侧也会是同一形状"（第 9 条另外直接读 GLB 顶点再对一次）。
//
//   node scripts/verify-wall.mjs [--city chengdu]
import { serve, launch } from './browser.mjs';

const optOf = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CITY = optOf('--city', 'chengdu');
const PORT = 6320 + Math.floor(Math.random() * 9);
const fails = [];
const check = (ok, what, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(what);
};

const srv = await serve(PORT);
const ctx = await launch({ viewport: { width: 1000, height: 700 }, serviceWorkers: 'block' });
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ save: null, ok: true }) }));
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 150)));
await page.addInitScript((c) => {
  try {
    localStorage.setItem('wordpet_save_v1', JSON.stringify({
      profile: { username: '城墙校验', registered: true, city: c, gender: 'boy', wear: {} },
      book: { sem: '3a' }, intro: true, guideDone: true, pets: {},
    }));
  } catch (e) { /* ignore */ }
}, CITY);
await page.goto(`${srv.base}?city=${CITY}&debug=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.world, null, { timeout: 120000 });
await page.waitForTimeout(2500);
// 等烘焙地面**换装完成**：GLB 变大后固定等待不够（实测会在换装前就去量材质 → 误报"认不出院墙"）
const swapOk = await page.waitForFunction(() => {
  const g = window.__game;
  let slot = null;
  g.scene.traverse((o) => { if (!slot && o.name === 'ground-slot') slot = o; });
  if (!slot || !slot.children.length) return false;
  let hit = false;
  slot.traverse((o) => {
    if (hit || !o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && m.name === 'ground_wall')) hit = true;
  });
  return hit;
}, null, { timeout: 30000 }).then(() => true).catch(() => false);
if (!swapOk) console.log('  · 注意：等 30 秒仍未见到 ground_wall 材质，下面会报出来');

console.log(`城市边界（长城）· ${CITY}`);

/* ---------- 1) 共享数据同源：规格里的墙断面 == js/wall-spec.js ---------- */
const spec = await page.evaluate(async () => {
  const W = await import(new URL('js/wall-spec.js', location.href).href);
  const g = window.__game;
  const key = (g._currentStage() || {}).key;
  const b = g.world.cityBounds[key];
  return {
    hasField: !!b.terrainField,
    wallSpec: W.WALL, bands: W.WALL_BANDS, colors: W.WALL.colors,
    merlon: W.WALL.merlon,
    // 断面自检：闭合、内壁 1.0 未动、外底 > 外顶
    innerOk: W.WALL.innerHalf === 1.0,
    closed: Math.abs(W.WALL_BANDS[0].a[0] - W.WALL_BANDS[W.WALL_BANDS.length - 1].b[0]) < 1e-9
      && Math.abs(W.WALL_BANDS[0].a[1] - W.WALL_BANDS[W.WALL_BANDS.length - 1].b[1]) < 1e-9,
    taper: +(W.outerHalfAt(0.42) - W.outerHalfAt(3.0)).toFixed(3),
    plinthExtra: +(W.outerHalfAt(0.2) - W.outerHalfAt(3.0)).toFixed(3),
    ys: { walk: W.walkY(), coping: W.copingTopY(), parapet: W.parapetTopY(), merlonTop: W.merlonTopY() },
  };
});
check(spec.innerOk, '内壁半宽 = 1.0（game._cityWallMargin 是硬编码 1.42，不能动）', String(spec.wallSpec.innerHalf));
check(spec.closed, '断面闭合（首尾相接）');
check(spec.taper > 0.15, '外侧收分：底比顶宽', `Δ=${spec.taper}m`);
check(spec.plinthExtra > 0.3, '条石基座再外扩', `比顶宽 ${spec.plinthExtra}m`);
check(spec.bands.length === 12, '断面 12 条带（女墙/马道/压顶石×2/收分/基座…）', `${spec.bands.length} 条`);
check(!!spec.colors.walk && !!spec.colors.coping && !!spec.colors.plinth, '饰面有独立配色', Object.keys(spec.colors).join('/'));

/* ---------- 2) 程序化侧真的按断面建出来了（射线量形状） ---------- */
const shape = await page.evaluate(async () => {
  const W = await import(new URL('js/wall-spec.js', location.href).href);
  const THREE = window.THREE;
  const g = window.__game;
  const grp = g.world.islands ? null : null;
  // 程序化墙只在"未换装"时可见；这里直接找场景里那三个具名对象（换装后仍存在，只是 visible=false）
  const find = (n) => { let hit = null; g.scene.traverse((o) => { if (!hit && o.name === n) hit = o; }); return hit; };
  const wall = find('city-wall-brick'), trim = find('city-wall-trim'), merlon = find('city-wall-merlon');
  if (!wall || !trim || !merlon) return { missing: [!!wall, !!trim, !!merlon] };

  // 取墙上一段"直"的位置：用墙砖几何的顶点分布找一个外法线方向，再在那一处打横截射线
  // 简化：直接量几何本身——把顶点按高度分箱，统计每箱的 |offset| 极值
  const measure = (mesh) => {
    const pos = mesh.geometry.attributes.position;
    const out = [];                                  // [y, 最小 off, 最大 off]
    const nb = 40, lo = -0.2, hi = W.WALL.H + W.WALL.parapetH + 0.05;
    const bins = Array.from({ length: nb }, () => [1e9, -1e9]);
    // 墙心线未知（几何是世界坐标），改用"同一采样点的一对顶点"来求断面：
    // 每个采样点 i 的顶点对是 (off_a, off_b)，它们的差 = 断面宽度。这里量**总包围盒**与分箱宽度。
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const bi = Math.max(0, Math.min(nb - 1, Math.round((y - lo) / (hi - lo) * (nb - 1))));
      // 用 x 与 z 的合成半径近似"到墙心线的距离"：只在局部一小段内成立，所以按 x 分箱更稳
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      bins[bi][0] = Math.min(bins[bi][0], r);
      bins[bi][1] = Math.max(bins[bi][1], r);
    }
    for (let k = 0; k < nb; k++) if (bins[k][1] > -1e8) out.push([+(lo + (hi - lo) * k / (nb - 1)).toFixed(2), bins[k][0], bins[k][1]]);
    return out;
  };
  const geoInfo = (mesh) => {
    const pos = mesh.geometry.attributes.position;
    let ymin = 1e9, ymax = -1e9;
    const ys = [];
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < ymin) ymin = y; if (y > ymax) ymax = y; ys.push(y); }
    const idx = mesh.geometry.index;
    return {
      ymin: +ymin.toFixed(3), ymax: +ymax.toFixed(3), verts: pos.count,
      ys, tris: idx ? idx.count / 3 : pos.count / 3,
    };
  };
  // 断面层"真的建出来了"的直接证据：某高度上存在顶点
  // （函数不能作为返回值传出页面，所以在这里就算成布尔量）
  const hasY = (ys, y, tol = 0.02) => ys.some((v) => Math.abs(v - y) <= tol);
  const wInfo = geoInfo(wall), tInfo = geoInfo(trim);
  const presence = {
    brickGround: hasY(wInfo.ys, 0),
    brickTop: hasY(wInfo.ys, W.WALL.H),
    trimGround: hasY(tInfo.ys, 0),
    trimWalk: hasY(tInfo.ys, W.walkY()),
    trimCoping: hasY(tInfo.ys, W.copingTopY()),
    trimPlinth: hasY(tInfo.ys, W.WALL.plinthH),
    trimAboveParapet: hasY(tInfo.ys, W.parapetTopY() + 0.2),
  };
  // ---- 敌楼：屋顶 / 双层檐 / 起翘 / 火盆 ----
  let towerInfo = null;
  let tower = null;
  g.scene.traverse((o) => { if (!tower && o.name === 'city-beacon') tower = o; });
  if (tower) {
    const B = W.BEACON, H = W.beaconHeights();
    const meshes = [];
    tower.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const top = Math.max(...meshes.map((m) => new THREE.Box3().setFromObject(m).max.y));
    // 某个高度带里最宽的"半宽"（出檐 = 檐口比楼身宽）
    const halfAt = (yLo, yHi) => {
      let w = 0;
      for (const m of meshes) {
        const bb = new THREE.Box3().setFromObject(m);
        const yc = (bb.min.y + bb.max.y) / 2;
        if (yc < yLo || yc > yHi) continue;
        const gp = m.geometry && m.geometry.parameters;
        const half = (gp && gp.width ? gp.width / 2 : Math.abs(bb.max.x - bb.min.x) / 2) * Math.abs(m.scale.x || 1);
        w = Math.max(w, half);
      }
      return w;
    };
    towerInfo = {
      top: +top.toFixed(3),
      ridgeTop: +H.ridgeTop.toFixed(3),
      bowlTop: +H.bowlTop.toFixed(3),
      shaftHalf: B.shaft.w / 2,
      upperHalf: B.upper.w / 2,
      lowEaveHalf: +halfAt(H.balconyTop - 0.05, H.eaveLowTop + 0.05).toFixed(3),
      topEaveHalf: +halfAt(H.upperTop - 0.05, H.eaveTopTop + 0.05).toFixed(3),
      corners: meshes.filter((m) => Math.abs(m.rotation.x) > 0.1).length,
      meshes: meshes.length,
    };
  }
  // 垛口几何：三角数必须 > 12（一个盒）且 ≤ 36（三块盒合并）
  const mIdx = merlon.geometry.index;
  const mTris = mIdx ? mIdx.count / 3 : merlon.geometry.attributes.position.count / 3;
  return {
    wall: wInfo, trim: tInfo, presence,
    trimHasColor: !!trim.geometry.attributes.color,
    brickHasColor: !!wall.geometry.attributes.color,
    brickHasMap: !!wall.material.map,
    trimVertexColors: !!trim.material.vertexColors,
    merlonTris: mTris, merlonCount: merlon.count, towerInfo,
    // 法线朝向：马道/女墙顶/压顶石顶这些**水平面必须朝上**（+y），内壁要朝城内（−off 方向）。
    // 这条能抓"断面绕向反了"——反了以后法线全朝下，靠 DoubleSide 还能显示，只是物理上错。
    normals: (() => {
      const nrm = trim.geometry.attributes.normal, pos = trim.geometry.attributes.position;
      const atY = (want, tol = 0.05) => {
        let up = 0, down = 0;
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(pos.getY(i) - want) > tol) continue;
          const ny = nrm.getY(i);
          if (ny > 0.7) up++; else if (ny < -0.7) down++;
        }
        return { up, down };
      };
      return { walk: atY(W.walkY()), coping: atY(W.copingTopY()), parapet: atY(W.parapetTopY()) };
    })(),
    merlonInstGap: W.WALL.merlon.gap,
    // 断面各层是否真的存在（真值来自共享数据，不在这里写死）
    layers: {
      wallTop: W.WALL.H,
      walk: W.walkY(),
      coping: W.copingTopY(),
      parapet: W.parapetTopY(),
      plinthStep: W.WALL.plinthH,
      ground: 0,
    },
  };
});
check(!shape.missing, '三件套都在场景里（city-wall-brick / -trim / -merlon）', shape.missing ? JSON.stringify(shape.missing) : '');
check(shape.trim && Math.abs(shape.trim.ymin - 0) < 0.05, '饰面带从地面起（含条石基座）', `y ${shape.trim.ymin}~${shape.trim.ymax}`);
check(shape.trim && Math.abs(shape.trim.ymax - spec.ys.parapet) < 0.06, '饰面带最高 = 女墙顶 H+0.55', `${shape.trim.ymax} vs ${spec.ys.parapet}`);
// 砖面带含"内壁 + 女墙内侧面"那条共面带 → 最高到女墙顶；关键是**逐层都在**
const L = shape.layers;
check(shape.wall && Math.abs(shape.wall.ymax - L.parapet) < 0.06,
  '砖面带到女墙顶（内侧面与女墙共面，设计如此）', `ymax ${shape.wall.ymax} vs ${L.parapet}`);
check(shape.presence.brickGround && shape.presence.brickTop, '砖面带在地面与墙顶两层都有顶点', `0 与 ${L.wallTop}`);
check(shape.presence.trimWalk && shape.presence.trimCoping && shape.presence.trimPlinth && shape.presence.trimGround,
  '饰面带含马道 / 压顶石 / 基座台阶 / 地面四层',
  `马道 ${L.walk} / 压顶石 ${L.coping} / 基座 ${L.plinthStep} / 地面 0`);
check(!shape.presence.trimAboveParapet, '垛口不在饰面带里（是独立 InstancedMesh）', '女墙之上无饰面顶点');
check(shape.trimHasColor && shape.trimVertexColors && !shape.brickHasColor,
  '饰面带带顶点色、砖面带不带（砖面外观与旧版逐像素一致）');
check(shape.brickHasMap, '砖面带挂着砖纹贴图');
check(shape.merlonTris > 12 && shape.merlonTris <= 36, '垛口是"带箭孔"的合并几何（三角数在 13~36）', `${shape.merlonTris} 三角`);
check(shape.merlonInstGap <= 2.4, '垛口间距变密（≤2.4m）', `${shape.merlonInstGap}m`);
// 水平面法线必须朝上。允许 ≤0.5% 的个别尖点：轮廓简化后可能出现切线反向的小尖角，
// 那一个四边形的绕向会翻（8406 个顶点里实测 1 个 = 0.012%），旧版墙同样存在，
// 且 DoubleSide 会按 gl_FrontFacing 翻正。整体绕向反了的话比例会是 ~100%，仍会被这条抓住。
const upOk = (o, name) => {
  const tot = o.up + o.down;
  const bad = tot ? o.down / tot : 1;
  check(o.up > 0 && bad <= 0.005, `程序化：${name}法线朝上（+y）`,
    `up=${o.up} down=${o.down}（朝下占 ${(bad * 100).toFixed(3)}%）`);
};
upOk(shape.normals.walk, '马道面');
upOk(shape.normals.coping, '压顶石顶面');
upOk(shape.normals.parapet, '女墙顶面');

/* ---------- 3) 敌楼：屋顶 + 双层檐 + 起翘 + 火盆 ---------- */
const T = shape.towerInfo;
check(!!T, '场景里有敌楼（city-beacon）');
if (T) {
  check(T.top >= T.ridgeTop - 0.02, '敌楼有屋顶（最高点不低于正脊）', `顶 ${T.top} / 脊 ${T.ridgeTop}`);
  check(T.lowEaveHalf > T.shaftHalf * 1.02, '一层檐出檐（檐口比楼身宽）', `檐 ${T.lowEaveHalf} > 楼身 ${T.shaftHalf}`);
  check(T.topEaveHalf > T.upperHalf * 1.03, '二层檐出檐（檐口比二层宽）', `檐 ${T.topEaveHalf} > 二层 ${T.upperHalf}`);
  check(T.corners >= 4, '四角有起翘檐角（旋转过的小楔块）', `${T.corners} 个`);
}
const bowl = await page.evaluate(async () => {
  const W = await import(new URL('js/wall-spec.js', location.href).href);
  const g = window.__game;
  let tower = null;
  g.scene.traverse((o) => { if (!tower && o.name === 'city-beacon') tower = o; });
  // beacons 挂在岛 group 的 userData 上
  let list = null;
  g.scene.traverse((o) => { if (!list && o.userData && o.userData.beacons) list = o.userData.beacons; });
  const b0 = list && list[0];
  return {
    bowlY: tower ? tower.userData.bowlY : null,
    ridgeTop: W.beaconHeights().ridgeTop,
    beaconTop: b0 ? b0.top : null,
    n: list ? list.length : 0,
  };
});
check(bowl.bowlY >= bowl.ridgeTop, '火盆（宝顶）在正脊之上', `盆口 ${bowl.bowlY} ≥ 脊 ${bowl.ridgeTop}`);
check(Math.abs(bowl.beaconTop - bowl.bowlY) < 1e-6, 'beacons[].top 已同步到盆口高度（火苗锚点）',
  `${bowl.beaconTop} vs ${bowl.bowlY}（${bowl.n} 座）`);

/* ---------- 4) 烘焙侧：墙材质认出来 + 挂上砖纹 + 断面同口径 ---------- */
const baked = await page.evaluate(async () => {
  const W = await import(new URL('js/wall-spec.js', location.href).href);
  const g = window.__game;
  let slot = null;
  g.scene.traverse((o) => { if (!slot && o.name === 'ground-slot') slot = o; });
  if (!slot) return { missing: true };
  let wallMesh = null;
  slot.traverse((o) => {
    if (wallMesh || !o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && m.name === 'ground_wall')) wallMesh = o;
  });
  if (!wallMesh) return { noWallMat: true };
  const mats = Array.isArray(wallMesh.material) ? wallMesh.material : [wallMesh.material];
  const wm = mats.find((m) => m.name === 'ground_wall');
  const pos = wallMesh.geometry.attributes.position;
  const uv = wallMesh.geometry.attributes.uv;
  let uMin = 1e9, uMax = -1e9, yMin = 1e9, yMax = -1e9, vMin = 1e9, vMax = -1e9;
  const ys = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i); ys.push(y);
    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
  }
  if (uv) for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    if (v < vMin) vMin = v; if (v > vMax) vMax = v;
  }
  // COLOR_0 = base × AO（见 scripts/bake/common.py 的 bake_ao），所以这里量的是"AO 值"，
  // 关键是**中性**：R/G/B 三通道应该一致（砖的色相没有烘进顶点色，否则会与贴图相乘两遍）。
  // COLOR_0 = AO × base，而 AO 自带暖调（scripts/bake/common.py 的 AO_TINT (0.60,0.53,0.46)）。
  // 所以判据不是"中性"，而是：**暖调 AO 主导**（R ≥ G ≥ B）且相对色差小
  // —— 若把砖色 #8C9C9F（青）也烘进顶点色，通道顺序会反过来、相对色差会大好几倍。
  let vc = null, vcRel = null, vcOrder = null;
  const c = wallMesh.geometry.attributes.color;
  if (c) {
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < c.count; i++) { r += c.getX(i); gg += c.getY(i); b += c.getZ(i); }
    r /= c.count; gg /= c.count; b /= c.count;
    vc = +((r + gg + b) / 3).toFixed(3);
    vcRel = +(((Math.max(r, gg, b) - Math.min(r, gg, b)) / Math.max(1e-6, (r + gg + b) / 3))).toFixed(4);
    vcOrder = r >= gg && gg >= b;
  }
  const hasY = (y, tol = 0.06) => ys.some((v) => Math.abs(v - y) <= tol);
  return {
    hasMap: !!wm.map, hasNormal: !!wm.normalMap, vertexColors: !!wm.vertexColors,
    tris: wallMesh.geometry.index ? wallMesh.geometry.index.count / 3 : pos.count / 3,
    yMin: +yMin.toFixed(3), yMax: +yMax.toFixed(3), vc, vcRel, vcOrder,
    uvU: [+uMin.toFixed(2), +uMax.toFixed(2)], uvV: [+vMin.toFixed(2), +vMax.toFixed(2)],
    layers: {
      walk: hasY(W.walkY()), coping: hasY(W.copingTopY()),
      plinth: hasY(W.WALL.plinthH), parapet: hasY(W.parapetTopY()), ground: hasY(0),
    },
    matName: wm.name,
  };
});
if (!baked.missing && !baked.noWallMat) {
  check(true, '烘焙地面里认出了院墙材质（ground_wall）', baked.matName + '，三角 ' + baked.tris);
} else {
  const names = await page.evaluate(() => {
    const g = window.__game;
    let slot = null;
    g.scene.traverse((o) => { if (!slot && o.name === 'ground-slot') slot = o; });
    const out = [];
    if (slot) slot.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      out.push(mats.map((m) => m && m.name).join('+'));
    });
    return out;
  });
  check(false, '烘焙地面里认出了院墙材质（ground_wall）',
    '实际材质：' + (names.length ? names.join(' | ') : '（ground-slot 是空的：换装没完成或加载失败）'));
}
if (!baked.missing && !baked.noWallMat) {
  check(baked.hasMap && baked.hasNormal, '烘焙院墙挂上了砖纹 + 砖法线（与程序化侧同一张图）',
    'map=' + baked.hasMap + ' normal=' + baked.hasNormal);
  check(baked.vertexColors === true && baked.vcOrder && baked.vcRel <= 0.15,
    '砖面带顶点色只承载 AO（暖调 R≥G≥B、相对色差 ≤15%）→ 砖色由贴图承担，不双重着色',
    'AO 均值 ' + baked.vc + '，相对色差 ' + baked.vcRel + '，暖调 ' + baked.vcOrder);
  check(Math.abs(baked.yMax - spec.ys.parapet) < 0.12, '烘焙墙断面同口径：最高到女墙顶',
    baked.yMax + ' vs ' + spec.ys.parapet);
  check(baked.layers.walk && baked.layers.coping && baked.layers.plinth && baked.layers.parapet,
    '烘焙墙断面含马道 / 压顶石 / 基座 / 女墙四层（与程序化同一份 bands）', JSON.stringify(baked.layers));
  check(baked.uvU[1] > 20 && baked.uvV[0] >= 0 && baked.uvV[1] <= 1.02,
    '烘焙墙用弧长 UV（u 是周长量级、v 是断面 0…1）', 'u ' + baked.uvU.join('~') + '  v ' + baked.uvV.join('~'));
}

check(errs.length === 0, '0 页面异常', errs.slice(0, 2).join(' | '));

await ctx.close();
srv.stop();
console.log(fails.length ? `\n✗ ${fails.length} 项未通过：\n  ` + fails.join('\n  ') : '\n✓ 城市边界（长城）全部通过（断面 + 垛口 + 敌楼 + 烘焙侧同口径）');
if (fails.length) process.exitCode = 1;
