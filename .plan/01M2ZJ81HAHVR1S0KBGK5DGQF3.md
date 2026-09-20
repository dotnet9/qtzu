# 成都地图发白：渲染纠错 + 成都地面/院墙/岩裙 Blender 化

> 现象：成都关（家乡城）整幅画面发白，草地、院墙、周边一片糊白，走近也看不清。
> 本方案同时交付两件事：**(A) 渲染纠错**（把发白的每一层锅拆掉）和 **(B) 用 Blender 重做成都的地形高度场 / 地面细节 / 城市院墙 / 岛身岩裙**（保持程序化回退）。

---

## 一、决策记录（本轮已确认，不再重开）

| 项 | 决定 |
|---|---|
| 顺序 | **两件一起做**：渲染纠错与成都地面烘焙在同一次交付里 |
| 美术尺度 | **允许重调美术**，以"看得清"优先（地面回到饱和绿、周边不再一片白、光源与辉光重调） |
| 烘焙范围 | 成都的**地形高度场网格 / 地面纹理与细节 / 城市院墙 / 岛身岩裙**（试点一城；其余 51 城继续程序化） |
| 观感目标 | ① 草地回到饱和的绿 ② 周边纸面不再一片白 ③ 太阳光晕收敛 ④ 辉光只留发光物 ⑤ 雾拉到远处 —— **五条全上** |
| 玩法约束 | 地面高度**不改数值**：烘焙网格与 `heightAtLocal` 同源，走路寻高/涉水/雪线/地形打卡点行为不变（不选"允许变"，一律保持同源） |
| 手机 | 用户未测；本次补一组对照（触屏跳过 Bloom/PMREM 的路径同样要"看得清"，渲染纠错本身是全平台的） |
| 交付纪律 | 项目惯例：改动先本地跑起来出"改前/改后"同镜头图，**用户确认后才 commit/push** |

---

## 二、验收标准（可量化，全部要跑）

1. **数值门槛**（新增 `scripts/check-render.mjs`，成都固定机位截图 + 页内像素统计；先测基线、再压门槛）：

   | 指标 | 成都现状（预计） | 目标 |
   |---|---|---|
   | 画面中 luminance > 0.95 的像素占比（过曝面积） | > 25% | **≤ 4%** |
   | 城内草地采样点 HSV 饱和度（取 5 点：城内非广场、非雪线） | ~0.15 | **≥ 0.30** |
   | 城内草地采样点亮度 | > 0.85 | **0.30 ~ 0.70** |
   | 画面上缘 1/5（纸面/天空）平均亮度 | ~0.97 | **0.55 ~ 0.88** |
   | 开/关 `composer` 两张同镜头图平均色差 | 明显（缺 OutputPass 导致） | **≤ 2%** |
   | `composer.passes` 名序 | `RenderPass, UnrealBloomPass` | `RenderPass, UnrealBloomPass, OutputPass` |

2. **截图门槛**：成都两组同镜头对照——俯瞰（`camDist 62 / camPitch 0.9`，沿用 `scripts/verify-cities.mjs:108-116` 的机位）与近景（`camDist 12`）——改前/改后肉眼可分辨：草地有绿、远山有层次、周边不是白纸。
3. `node scripts/audit-assets.mjs` → 0 缺失 / 0 孤儿 / 0 超预算（含新增 `ground` 类别）。
4. `node scripts/verify-cities.mjs` → 52 城 0 控制台错误、校门/地标命中不回归。
5. `node scripts/test-fallback.mjs` → 拦截并 404 全部 `.glb` 时照常可玩（成都地面回退到程序化，且画面依然是"清楚的"）。
6. **贴地一致性**：新增 raycast 校验收进 `scripts/verify-terrain.mjs`——在成都取 ≥ 40 个采样点（含城心、广场、梯田、山脚、山顶、河边），`game._groundY(x,z)` 与烘焙地面网格的射线命中高度偏差 **≤ 0.12**（否则就是"脚陷进地/浮空"）。
7. `node scripts/bake/run.mjs --kinds ground --city chengdu --verify` → 二次烘焙文件哈希一致（可复现性）。
8. 用户看完对比图认可。

---

## 三、根因（已逐行核实）

| # | 现象 | 根因 | 位置 | 机制 |
|---|---|---|---|---|
| 1 | 地面发白、颜色淡、没对比 | **顶点色把 sRGB 数值当线性用** | `js/terrain-field.js:37,285-315`（产出）→ `js/terrain.js:32-45,66-71`、`js/china-map.js:29,42`（消费） | 色值是按人眼 sRGB 挑的（成都绿地 `[0.49,0.78,0.47]` = #7DC777），three r152+ 把 `geometry.color` 当**线性**直接乘进着色器 → 相当于"亮一整个 gamma"：0.49 显示成 ~0.68，通道差被压平 = 变淡变白。同源污染 5 座雪峰（`terrain.js:66-69` 的 0.26/0.20/0.95…）与全国地图邻城浮雕 |
| 2 | 走近也看不清、远处糊白 | **雾距还是老小岛的比例** | `js/game.js:3022-3025`（每帧覆盖）↔ `js/world.js:538` | 城市按 `CITY_SCALE=0.84 × radius×3.4` 放大后成都半宽 ≈86（整图 ~170）；雾 `near=34+2d` 在默认 `camDist 8.5` 时只有 51，城对面（~172）吃雾 ~97% → 全被拉进近白雾色 `0xDFF3EC`。`world.js:538` 给城市模式设的 `Fog(…,90,420)` 是死代码 |
| 3 | 拉远一片白、看不到岩裙 | **全国地图纸面是近白巨平面** | `js/china-map.js:103-107,10` | `30000×22000` 的 `#EFEAE0`（近白）平面铺满整个视野；城市巡游时海面被藏（`js/game.js:202`），背景就是这张白纸。且 `BASE_Y=-2` 把岩裙（下沉到 -3.6）切掉大半 |
| 4 | 画面正中一团白光 | **太阳 sprite 巨大且落在城上空** | `js/world.js:542-555`、`js/game.js:3289-3292,3031-3038` | 亮核 26 单位 + 光晕 64 单位、固定在离城心 118 处、`camDist<300` 完全不淡出 → 屏幕上一大块柔光罩住城与远处地形；再经辉光扩散。`_updateDayNight` 每 12 分钟还把 `visible` 写回 true，和镜头的淡出打架 |
| 5 | 亮部糊成白、开关后期颜色会跳 | **后期链缺 `OutputPass`** | `js/game.js:234-238` | r160 里 tone mapping / outputColorSpace **只在渲染到画布时**生效（`WebGLPrograms.getParameters`）。RenderPass 写进 RT 的是未 tonemap 的线性值；UnrealBloomPass 末尾用 `MeshBasicMaterial` 重绘底图（这步会被 tonemap+编码），但把它自己的辉光以 `AdditiveBlending` **未编码地线性相加**（`UnrealBloomPass.render` 的 `blendMaterial`）→ 辉光强度远大于配置的 0.22 且与底图不同色彩空间 = 白雾。低端机 `_fpsWatch`（`game.js:930`）关掉 composer 后走正常路径 → 同一画面两种颜色 |
| 6 | 夜里也白/白天偏亮 | **天气每帧抢写主光强度** | `js/game.js:1714` ↔ `js/game.js:3296` | `_updateWeather` 每帧把 `sun.intensity` 拉回 2.1（clear），压过 `_updateDayNight` 的"主光压低"（0.95+0.55h）与夜间 0.55 → 上一轮粘土风的降光调参实际从未生效，夜里也拉不暗 |
| 7 | —— | **DEBUG 残留** | `js/game.js:248` | `this.scene.environment = null;   // DEBUG 临时：关掉环境贴图验证过曝来源`：PMREM 环境贴图算了却丢掉，`environmentIntensity` 成了摆设 |
| 8 | （旁证，顺手修） | **悬浮岛垂石/云海/暗影双偏移** | `js/world.js:243-268` ↔ `:1445` | 在 `grp`（已位于 `cx,cz`）内部又加了一次 `cx,cz`，这些白点云被摆到 2×(cx,cz)；现在被地图纸挡住看不见，纸面下移后会露出来 |
| 9 | **只有成都很白** | 成都是唯一 `roll: 0` 的死平样板城 | `data/cities/chengdu/terrain.json:7` | 全域起伏为 0 → 高度恒 0 → 全部落在**最亮那一档色带** `greens[0]`（叠加 #1 的色空间错误 = 淡薄荷白）；其他城市有起伏、会混进第 3~6 档深色，所以看起来没那么白。另外成都还有 5 座雪峰（近白锥）压在北侧 |

---

## 四、A. 渲染纠错（逐条改法）

### A1 顶点色色空间（根治"淡+白"）
- `js/terrain-field.js`：保留 `zoneColor`（**sRGB 作者空间**，体检/审计脚本继续用它）；新增纯函数 `srgbToLinear(v)` 与 `zoneColorLinear(x, z, hSm, band, out)`（内部调 `zoneColor` 后逐通道转线性）。该模块是"无 THREE、无 DOM"的共享模块，保持这一约束。
- `js/terrain.js:32-33`：地面网格改用 `zoneColorLinear`。
- `js/terrain.js:66-69`：雪峰顶点色改为线性（`0.26/0.22/0.20` 与 `0.95/0.97/1.0` 都是 sRGB）。
- `js/china-map.js:29`（`buildRelief` 的 `getV`）：改用 `zoneColorLinear`。
- 不改任何 JSON 色值（作者仍按人眼 sRGB 写），核对结论：`js/world.js:236,1239`（悬浮岛侧壁、墙根过渡带）与 `js/china-map.js:182`（兜底填充）都走 `THREE.Color` 已正确转线性，**只这三处有 bug**。

### A2 雾距与雾色（根治"远处糊白"）
- `js/game.js:3022-3025` 改为按当前城半径取大值：
  ```js
  const R = (this._currentStage() && this._currentStage().r) || 52;
  if (this.scene.fog) {
    this.scene.fog.near = Math.max(R * 1.35, 34 + dist * 2);
    this.scene.fog.far  = Math.max(R * 5.0, 142 + dist * 4);
  }
  ```
  成都（R≈86）默认机位下雾从 ~116 起（原来 51），城对面 ~172 只吃 ~46%（原来 ~97%）。
- `js/world.js:538`：城市场景雾色 `0xDFF3EC` → `0xCBE6F2`（与天空渐变中段同色系，远处读作"大气"而不是"白纸"）；农场岛模式（非 city）保持 `0xDFF3EC`。
- `js/game.js:3298`（白天）同步成同一色值，避免每 12 分钟颜色跳一次。

### A3 全国地图纸面（根治"拉远一片白"）
- `js/china-map.js:10`：`BASE_Y` `-2` → **`-4.0`**：让岩裙（沉到 -3.6）与悬浮岛底完整露出来；层序不变（海 -0.5 在纸之上，城市场景海面本就被藏，二者不同屏）。所有 `BASE_Y + y` 的层（浮雕/描边/名字牌/路线）自动跟随，无需逐处改。
- `js/china-map.js:103-107`：底色 `#EFEAE0` → 中性纸色 **`#E2D9C6`**（备选 `#DCE4E4` 浅蓝灰，截图后二选一）；`fog` 保持开启（配合 A2 的雾色，远处是渐变而不是纯色平涂）。
- 可选增强（截图后决定）：给 `base` 加一张 128px canvas 纸纹/浅网格贴图，提升"地图"读感；不加则保持纯色。

### A4 太阳光晕收敛
- `js/world.js:542-555`：sprite 尺寸从常量改为随舞台半径走——亮核 `clamp(R*0.14, 6, 14)`、光晕 `clamp(R*0.40, 16, 40)`；光晕内芯 alpha `0.55` → `0.35`。
- `js/game.js:3289-3292`：太阳轨道半径 `SR = max(150, R*2.6)`，位置与高度整体按 `SR` 比例（`x=cos(a)*SR`、`y=0.17*SR + sin(a)*0.76*SR`、`z=0.2*SR`），日月都同步。
- `js/game.js:3031-3038`：淡出改为 `fade = clamp((140 - dist) / 80, 0, 1)`（`dist≤60` 全显、`≥140` 全隐），写进 `dn.sunFade`；`_updateDayNight:3277,3287` 的 `visible` 赋值改为 `visible = (dn.sunFade ?? 1) > 0.01`（并保留"白天/夜晚谁当班"的语义），不再每 12 分钟把太阳叫回来。

### A5 后期链补 `OutputPass` + 辉光重调
- `js/game.js:230-239`：
  ```js
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';   // 已有 importmap，无需新依赖
  this.composer.addPass(new RenderPass(this.scene, this.camera));
  this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.10, 0.45, 0.92);
  this.composer.addPass(this.bloom);
  this.composer.addPass(new OutputPass());     // ACES + sRGB 收尾，辉光在线性空间合成
  ```
- 注释写清为什么（见 §三#5），避免以后又被当成"多余的一层"删掉。
- 触屏 `lowEnd` 跳过后期与 `_fpsWatch` 关后期的行为保持不变；因为补了 OutputPass，**开关后期的画面颜色一致**（§二 的色差门槛就是守这条）。

### A6 光照 / 曝光 / 环境（数值是"起点值"，靠截图门槛收敛）
- `js/game.js:248`：删掉 DEBUG 行，改为 `this.scene.environment = this.envTex;`；`environmentIntensity` `0.32` → `0.18`。
- `js/game.js:191`：`toneMappingExposure` `1.05` → `0.98`。
- `js/world.js:567-569`：`hemi.intensity` `1.05` → `0.62`；`sun.intensity` `2.1` → `1.35`。
- `js/game.js:3296-3297`：白天 `sun = 0.85 + 0.30h`、`hemi = 0.62 + 0.20h`；`js/game.js:3280`：夜里 `sun 0.35 / hemi 0.45`（夜里仍留环境光，保持粘土哑光不糊黑）。
- `js/game.js:1714`：天气改为**乘子**，不再写死绝对值——
  ```js
  const k = w.cur === 'rain' ? 0.62 : w.cur === 'snow' ? 0.78 : 1;
  if (sunL) sunL.intensity += ((dn.baseSun ?? 1.35) * k - sunL.intensity) * Math.min(1, dt * 2);
  ```
  `dn.baseSun` 由 `_updateDayNight` 每次算完白天/夜晚曲线后写入。

### A7 收尾
- `sw.js:9`：`VER` `qtzu-pwa-v18` → `qtzu-pwa-v19`（JS/CSS 变更 + 新增 `.glb`；`.glb` 已在 `sw.js:109-113` 走 `cacheFirst(big)` 分支，无需新增规则）。
- 顺手修 `js/world.js:243-268` 的双偏移（垂石/云海/暗影在 `grp` 内部直接用局部坐标，不要再加 `cx/cz`）：纸面下移后这些白点云会露出来，不修就是"错的云海挂在城外的海面上"。

---

## 五、B. 成都地形/地面/院墙/岩裙 → Blender 烘焙

### B1 规格导出（`scripts/bake/specs.mjs` 增 `--kind ground`）
规则只有一份：**把游戏侧算好的数整段倒出去**，Blender 只做几何与风格化，绝不重算地形规则（`js/terrain-field.js` 的注释就写着"各写一套必然漂移"）。

- 输入：`data/cities/chengdu/{city.json,terrain.json}` + `js/city-shape.js` + `js/terrain-field.js`（经 `scripts/terrain-lib.mjs:45-58` 的 `radiusOf/worldPtsOf/makeField`，与运行时同源）。
- 输出 `scripts/bake/specs/ground.chengdu.json`：
  ```jsonc
  { "kind": "ground", "specs": [{
    "id": "…sha1('chengdu')[:8]", "city": "chengdu", "key": "chengdu", "zh": "成都",
    "radius": 86, "outline": [[x,z], …],                    // 局部世界坐标（与 grp 同系）
    "grid": { "minX":…, "minZ":…, "gsz":…, "nx":…, "nz":… },
    "qy": [[…]], "hsSm": [[…]], "cellIn": [[0|1, …]],        // 量化高度 / 平滑高度 / 每格是否在轮廓内
    "step": 0.9, "snowRange": [5.2,6.6], "rockRange": null,
    "plaza": {…}, "terrace": {…}, "farm": {…},
    "colors": { "greens": […], "plaza": […], "terraceGold": […], "farmStripe": […], "snow": […], "rock": null },
    "peaks": [[x,z,h,r], …],
    "wall":  { "outline": [[x,z], …], "H": 3.0, "thick": 1.0, "merlonGap": 3.4,
               "brick": "#8C9C9F", "merlon": "#A9B8B7", "band": "#B9C0B2" },
    "skirt": { "sink": -3.6, "tuck": 0.94, "color": "#87928F" },
    "iso":   { "depth": 9, "taper": 0.5, "top": "#8A6B4A", "mid": "#6B5138", "bot": "#3A2C1E" },
    "seed": 42
  }]}
  ```

### B2 烘焙器（新增 `scripts/bake/ground.py`）
复用 `scripts/bake/common.py` 的全部既有能力（`Soup` / `build_object` / `clay_material` / `bake_ao` / 预算断言 / 导出 / `at()` 轴映射），不新造轮子。

- **轴映射**：所有顶点走 `C.at(x, y, z) = (x, -z, y)`（`common.py:348-350`）。这是本项目历史上踩过 3 次的坑（§`.plan/01M2YDKAE7R4FD74R54NCMTWX5.md` §10.3），必须靠 audit 的 bbox 断言 + 截图双保险。
- **地形网格**：按 `grid` 生成四边形（仅 `cellIn` 的格），每格按 `hsSm` 分档取 `colors.greens[band]`，再按广场/梯田/农田/裸岩/雪线掩码混色，落到最近的调色板材质（**材质数 ≤ 12**，避免几十个 draw call；每色经 `clay_material` 走 sRGB→线性）。加 ≤0.6% 的 `Soup.add(..., jitter=…)` 得到"手捏"微不规则（大地形不吃默认 1.5%）。
- **风格**：台地侧面保持刻面（不要全局倒角，倒了就糊）；`bake_ao` 出接触阴影（墙根、山脊、河谷自然压暗）——这是"精致度"的主要来源，且零贴图。
- **城市院墙**：沿 `wall.outline`（JS 侧 `simplifyPoly` 后的轮廓）做等距带 → 外壁/内壁/顶面三幅几何（厚 1.0），墙顶按 `merlonGap` 布垛口盒（倒角 ~0.12）；砖色/垛口色沿用现色值。
- **岛身岩裙**：轮廓按 `skirt` 参数下垂收拢的侧壁 + 悬浮岛底（`iso.depth`）+ 2~3 个垂石锥（用**局部坐标**，天然不会再出现 `world.js` 那种双偏移）。
- **雪峰**：5 座锥，按 `snowRange` 分裸岩/雪顶两段材质。
- **导出**：单节点、节点名 `ground_<id>`、无 transform、+Y up、顶点色 AO 开、不烤贴图；写 `.cache/ground.manifest.json`（`{kind:'ground', file:'ground/<sha8>.glb', key:'chengdu', city:'chengdu', zh:'成都', tri, bytes, bbox, v}`），由 `run.mjs:113-130` 合并进 `assets/models/manifest.json`。
- **预算**：三角面 ≤ **60 000**、单文件 ≤ **1.5MB**（成都 r≈86 → 1.5m 网格约 115² ≈ 13k 格；加墙 1.6k 段×6 面 + 垛口 ~250 + 岩裙 ≈ 30~45k 面）。若超：先降城墙采样密度（`len/1.3` → `len/2.0`），**不要降地面网格精度**（那会直接变成"脚陷进地"的观感）。
- 明确**不烘**：河流/湖/瀑布/水雾（薄透明面 + 与涉水判定同源）、烽火台（点火/火苗/烟是运行时行为）、沿墙两排树、墙根过渡带、城里地标/立牌/蛋/词宠/NPC。

### B3 运行时接入（`js/world.js`）
- 城市组 `grp` 里增加专用挂点：`const gslot = new THREE.Group(); gslot.name = 'ground-slot'; grp.add(gslot);`
- 程序化产出（地形网格 + 墙 + 垛口 + 岩裙 + 墙根带 + 沿墙树）收进数组 `procGround`，建成后**留在场景里只切 `visible`**（回退立刻可恢复，不 dispose）。
- 接入：`assets.apply(gslot, 'ground', key, { onSwap: () => procGround.forEach(o => (o.visible = false)) })`
  - `js/assets.js:101-124` 的 `swap()` 只清传入 group 的 children（除 `userData.keep`），**不会动地标/牌子/树/蛋** —— 正是这套"只换 children"的契约，无需改 `assets.js`。
  - `LOW_END`（`js/assets.js:17`，触屏）、超时（1.5s）、离线、404 → 什么都不发生，程序化照旧（现有机制，`test-fallback.mjs` 覆盖）。
  - 词宠/蛋/立牌/树/地标仍按 `game._groundY`（程序化高度场）贴地 —— 由 §二.6 的 raycast 一致性校验守住。
- 城市切换：`grp` 是**每城各自构造**的，`gslot` 随组走；`manifest` 里没有该城地面条目时 `apply` 返回 false，无副作用。

### B4 审计闸门要同步改（不改就过不了）
`scripts/audit-assets.mjs`：
- `BUDGET.ground = { tri: 60000, bytes: 1.5 * 1024 * 1024 }`。
- `REFS.ground = { keyOf: e => e.key, keys: () => new Set(所有城市 id)， what: '城市' }`（城市 id 取自 `data/cities/index.json`）。
- **"原点在脚底"检查对本类别豁免**：地面天然从 −4 到 +8（`g.lo[1] < -gt` 会误报）。改为 `if (e.kind !== 'ground') { …原检查… }`，并为 `ground` 新增两条专属断言：
  1. `bbox.y[1] ≥ max(peaks 高度) − 0.5`（防山被烘平/烘反）；
  2. `bbox.x/z` 与轮廓包围盒一致（±2 单位，防轴映射错）。
- 单城体积上限仍是 3MB：成都现有校门 18 座 + 地标 3 个约 1MB，地面 ≤1.5MB → 合计 ~2.5MB，安全。

### B5 明确保持程序化（本次不烘）
`js/terrain.js:81-166` 的河/湖/瀑布/水雾、`js/world.js:1205-1218` 的烽火台（`game._updateBeacons` 驱动）、`js/world.js:1219-1288` 的墙根过渡带与沿墙树、城里所有地标/立牌/蛋/词宠/NPC、`js/china-map.js` 的纸面与邻城浮雕（只改配色与高度，不烘）。这些要么带运行时行为，要么是薄面/动态，外置收益低、风险高。

---

## 六、文件清单

**新增**
| 文件 | 作用 |
|---|---|
| `scripts/bake/ground.py` | 成都地面/院墙/岩裙/雪峰烘焙器（复用 `common.py`） |
| `scripts/bake/specs/ground.chengdu.json` | 规格产物（与 `specs/gates.*.json` 同样提交） |
| `assets/models/ground/<sha8>.glb` | 成都地面资产（提交） |
| `scripts/check-render.mjs` | 固定机位截图 + 页内像素统计（过曝占比/饱和度/亮度的数值闸门；含 composer 开关色差比对） |
| `scripts/verify-ground-fit.mjs` | raycast 贴地一致性校验（也可并进 `verify-terrain.mjs`，二选一，实施时定） |

**必改**
| 文件 | 改动 |
|---|---|
| `js/terrain-field.js` | 新增 `srgbToLinear` / `zoneColorLinear`（保持无 THREE 依赖） |
| `js/terrain.js` | 地面网格与雪峰顶点色改用线性（`:32-33`、`:66-71`） |
| `js/china-map.js` | 浮雕顶点色线性（`:29`）；纸面底色与 `BASE_Y`（`:10`、`:103-107`） |
| `js/game.js` | 雾距（`:3022-3025`）、后期链 + OutputPass（`:230-239`）、曝光（`:191`）、环境贴图去 DEBUG（`:248`）、天气乘子（`:1714`）、太阳轨道/淡出（`:3031-3038`、`:3289-3292`）、昼夜光照曲线（`:3280`、`:3296-3297`、`:3298`） |
| `js/world.js` | 雾色（`:538`）、太阳 sprite 尺寸/光晕（`:542-555`）、光照基调（`:567-569`）、悬浮岛双偏移（`:243-268`）、地面挂点与 `assets.apply`（城市组构造处，约 `:1102-1347`） |
| `scripts/bake/specs.mjs` | 新增 `ground` 规格分支 |
| `scripts/bake/run.mjs` | `BAKERS` 增 `ground`（`:51-54`） |
| `scripts/audit-assets.mjs` | `BUDGET` / `REFS` / 穿地豁免 + ground 专属断言 |
| `assets/models/manifest.json` | 重跑 `run.mjs` 生成（含 `ground` 条目与新 `v` 哈希） |
| `sw.js` | `VER` 升版（`:9`） |
| `scripts/verify-terrain.mjs` | 并入 raycast 贴地校验（或引用新脚本） |

**明确不改**
- `js/terrain-field.js` 的算法与任何 `data/cities/*/terrain.json` 的数值（含成都 `roll: 0`）——发白靠色空间与烘焙细节解决，**不动玩法高度**。
- `js/city-shape.js`、`js/save.js`、`scripts/serve.js`、账号/排行榜/存档链路：**零迁移**，`wordpet_save_v1` 与事件名不动。
- `js/assets.js` 的既有契约（两段式替换、回退、并发、超时）与 `LOW_END` 判据。
- 其余 51 城的地形/院墙保持程序化（成都验收通过后另立计划再铺开）。

---

## 七、边界情况与风险

1. **轴映射**（历史踩过 3 次）：地面是一次性大网格，错了会整城镜像/翻转。靠 `audit-assets.mjs` 的 bbox 断言 + 成都俯瞰截图（山在西北、河自西北向东南）双保险。
2. **换装后贴地一致性**：烘焙网格的 XZ 采样与 `heightAtLocal` 必须重合；由 raycast 校验（≤0.12）守住"脚陷地/浮空"。
3. **顶点色色空间双写**：Blender 侧顶点色必须是**线性**（glTF 规定 COLOR_0 与 baseColor 相乘），JS 侧作者写的是 sRGB —— 两侧都写进注释，防止"修好又白回去"。
4. **回退路径**：触屏/离线/超时/404 → 程序化；渲染纠错是全平台的，所以回退时画面依然"清楚"，只是少了烘焙细节（这正是本次把两件事分开的根本原因）。
5. **体积**：地面 ≤1.5MB、单城 ≤3MB；超预算优先降城墙采样，不降地面精度；仍超再考虑（本方案不做）压缩。
6. **雾改远后"看得太清楚"**：邻城浮雕只在 `camDist 60~360` 显示（`china-map.js:239-242`），拉远到 550 时纸面会大片可见 —— 需要一张极限拉远截图确认读感。
7. **改太阳/云海会影响农场岛（r=52）**：两条路径（整岛农场 / 城市巡游）都要截图，别修好城市坏了农场。
8. **开关后期颜色一致**：补 OutputPass 后 `_fpsWatch` 降级（`game.js:930`）与触屏路径的画面必须一致，否则低端机会"突然变亮/变暗"。
9. **未定项**：纸面最终色（`#E2D9C6` 米纸 vs `#DCE4E4` 浅蓝灰）与是否加纸纹贴图 —— 截图后由用户二选一。

---

## 八、实施顺序与每步验证

| 步 | 内容 | 验证 |
|---|---|---|
| 0 | 落基线：`node scripts/check-render.mjs --baseline` + 存成都改前截图（俯瞰/近景） | 记录过曝占比/饱和度/亮度基线数字 |
| 1 | A1 顶点色色空间 | 截图：草地变绿、雪顶不再是纯白块；草地饱和度 ≥0.30 |
| 2 | A2 + A3 雾与纸面（含 `BASE_Y=-4`） | 截图：远处不再糊白、岩裙露出、拉远有纸面层次 |
| 3 | A4 太阳收敛 | 截图：白光斑回到天空、不再罩住地图 |
| 4 | A5 后期链 + 辉光 | `composer.passes` 名序断言；开/关后期色差 ≤2%；过曝占比 ≤4% |
| 5 | A6 光照/环境/天气 | §二.1 全部指标达标；农场岛不回归 |
| 6 | B1 + B2 烘焙成都地面 | `node scripts/bake/run.mjs --kinds ground --city chengdu --verify` 哈希一致；`node scripts/audit-assets.mjs --kind ground` 绿 |
| 7 | B3 接入运行时 | 成都同镜头 after 截图；`node scripts/verify-ground-fit.mjs` 偏差 ≤0.12；`node scripts/test-fallback.mjs` 两趟全绿 |
| 8 | B4 + 回归 | `node scripts/audit-assets.mjs` 全绿；`node scripts/verify-cities.mjs` 52 城 0 错误；手动过一遍孵蛋/立牌/地形打卡点/涉水/烽火台点火 |
| 9 | 出对比图 + 实测数字写回文档 | 用户确认后才 commit/push（项目惯例）；把实测数字与新预算写回 `.plan/01M2YDKAE7R4FD74R54NCMTWX5.md` §十 §4.2 |

**必须跑的命令**
```bash
node scripts/serve.js 6100                                   # 人工看图：http://localhost:6100/?city=chengdu&grade=4&term=s1&debug
node scripts/check-render.mjs --city chengdu                  # 数值门槛（含 composer 开关色差）
node scripts/bake/run.mjs --kinds ground --city chengdu --verify
node scripts/audit-assets.mjs
node scripts/verify-cities.mjs
node scripts/verify-ground-fit.mjs                            # 或 verify-terrain.mjs（并入后）
node scripts/test-fallback.mjs
```

---

## 九、本次不做（范围之外）

- 不烘河道/湖/瀑布/水雾/烽火台/沿墙树/城里地标/立牌/蛋（带运行时行为或薄面，收益低风险高）。
- 不引入纹理贴图：先靠"材质分色 + 顶点色 AO"（延续既有零贴图约定）；若截图证明地面细节不够，再另开"1024² 烘焙 albedo"作为独立决策（体积 +~0.3~1MB）。
- 不改成都 `roll: 0`（死平是"发白"的放大器，但改它会动玩法高度；用色空间与烘焙细节解决）。
- 不给其余 51 城烘地面/院墙（成都试点通过后另立计划）。
- 不做选择性辉光、描边、SSAO 等新后处理；不动 Unity/引擎。
- 不动存档、账号、排行榜、语音链路。
