# 地面与建模的"仿真"升级：贴图化程序化地面 + 成都地面烘焙（先用试点）

前置：`main` @ `8c1d839`。上一轮的渲染层（SMAA/阴影/机位/辉光）、城市本体的树与楼、烘焙侧的硬棱与 AO 都已落地并全绿。

---

## 一、本轮确认的取舍

| 项 | 决定 |
|---|---|
| 质感 | **折中**：写实纹理做表面（草叶/砂砾/砖缝/岩理 + 法线细节），颜色仍是游戏现在的马卡龙/高饱和——质感真实、色调统一 |
| 预算 | **观感优先**：地形贴图 2048px、每城独立法线、阴影 4096、地面散点（草簇/石头/花）都上；用 `look-shot` 帧时长中位数卡住回归 |
| 范围 | **先成都试点**：你看图认可后再推 52 城；不认可只调参数重做一城 |

---

## 二、现状（逐条核实过的"糙"在哪）

| 现象（你截图里看到的） | 代码事实 |
|---|---|
| 地面像平涂色块、没有材质 | `js/terrain.js:48` 的地形材质是 `{ vertexColors, flatShading: true }`——**没有 map / normalMap**；全项目**一处 `TextureLoader` 都没有**，贴图全靠 `CanvasTexture` 运行时画 |
| 大片硬边黄块（梯田/沙化） | `js/terrain-field.js:304` 的 `sx = Math.round(x / colorCell) * colorCell`（`colorCell` 默认 **2.5**）+ `greens[band]` 取色 → 颜色被量化成 2.5 单位一格、边界是直角 |
| 台地像"刻出来的一层层面片" | `cfg.step` 默认 **0.9** 的高度量化 + `flatShading` → 每一级都是硬面，没有任何表面细节 |
| 山是灰色三角片 | `js/terrain.js:55-95` 的雪峰是 `ConeGeometry(pr, ph, 6)`——六边锥 + 顶点色，没有岩理/雪线过渡 |
| 城墙像重复的灰色拉链 | `js/world.js:1182-1235`：砖块用 `box()` 拼，垛口等距等大，无贴图、无随机 |
| 岛边一圈棕色板 | `buildFloatingIsland` 的岩裙是单色 `M()` 材质 |
| 地面完全没有小detail | 城市里除了树/楼/牌子，没有草簇、石头、花、田埂这些"贴地细节" |

**好消息**：`js/world.js:1404-1407` 已经有 `ground-slot` 换装槽位，且已接 `assets.apply(gslot, 'ground', key, …)`，`onSwap` 里把 `procGround`（地形网格 + 雪峰 + 院墙 + 垛口 + 岩裙）整组隐藏——**"地面"这一类本来就是要烘 GLB 的**，我的 `scripts/bake/` 加一个 kind 即可。

---

## 三、验收标准

1. **同机位对比图**（`scripts/look-shot.mjs`：`default` / `street` / `city` 三机位）：地面能看出材质与颗粒、色带边界不再有直角、山体有岩理、城墙有砖纹与参差；我逐张看过再交你抽查。
2. `scripts/check-render.mjs`：**全部达标**（过曝 ≤0.04、上缘 0.55~0.88、草地亮度 0.30~0.70、饱和 ≥0.30、composerDiff ≤0.02）。
3. **帧时长**：`look-shot` 中位数 ≤ **33.4ms**（即不低于 30fps；基线 16.7ms）；超标就按 §7 的降级档逐项退（贴图分辨率 → 阴影 → 散点数量）。
4. `scripts/audit-assets.mjs`：`ground` 这一 kind 也纳入 0 缺失/0 孤儿/0 超预算；单城首屏 ≤ **8MB**（你批准的上限）。
5. `scripts/test-fallback.mjs`：拦截全部 `.glb` → 程序化地面照常显示（`ground-slot` 的 `visible=false` 只在换装成功时发生，回退必须仍然可玩）。
6. 你肉眼认可成都后再做 52 城。

---

## 四、设计

分三段：**A 先把现有的程序化地面"贴图化"（全 52 城立刻受益、也是回退路径）→ B 用 ground-slot 把成都地面烘成带贴图的 GLB（最仿真的路径）→ C 全量 + 回归**。

### A. 程序化地面的贴图化（不改烘焙，改的是运行时）

1. **新增 `js/textures.js`：可平铺的程序化纹理库**（全部 canvas 生成、零下载、可种子化，与项目现有风格一致）
   - `grassDetail(256)`：草叶笔触 + 斑驳 → `{ map, normalMap, roughnessMap }`
   - `soilDetail` / `pavingDetail`（石板缝）/ `brickDetail`（砖缝 + 参差）/ `rockDetail`（层理 + 裂隙）/ `snowDetail`（细颗粒）
   - 法线贴图由同一张高度图用 Sobel 差分算出来（`normalFromHeight(canvas)`），保证明暗与纹理对齐
   - 每张都带 `repeat`/`anisotropy`/`colorSpace` 设定（albedo 走 SRGB，normal/roughness 走 NoColorSpace——上次发白就吃过这个亏）
2. **地形网格**（`js/terrain.js`）
   - 加 UV：`uv = (局部 x, z) / 4`（4 世界单位一个贴图周期）→ 天然平铺、与城市尺度无关
   - 材质：`map: grassDetail.map`（×`vertexColors` 做分区染色，正好实现"写实纹理 + 游戏配色"）+ `normalMap: grassDetail.normal`（`normalScale` 0.35 左右）+ `flatShading: false`（改平滑着色，台地的"层"由高度与色带表达，靠表面法线出细节）
   - **色带边界柔化**：把 `zoneColor` 的量化取色改成"带噪声 warp 的平滑插值"——`band` 用平滑高度算连续值再在两档绿之间插值，边界加 `n2(x,z)` 扰动（幅度约 1.5 单位）→ 黄块不再有直角，像真的梯田/坡地
   - **每城一张 1024~2048px 的 albedo 叠加**（沿用 `islandTexture()` 的画法）：在平铺草纹之上再画分区（铺装广场/主街/田埂/裸岩/雪线），边界用噪声抖动；这张决定了"每城不一样"
   - 代价：顶点数不变、多一张 UV 属性；贴图 2~3 张共享 + 每城 1 张
3. **山体**（`terrain.js` 的雪峰）
   - 圆锥 → **噪声位移的岩体**：把 `ConeGeometry` 的顶点按多段 octave 噪声位移（径向 + 垂直），雪线以下的顶点色用岩石色、以上用雪色并做平滑过渡；材质用 `rockDetail`（map + normal）+ 顶点色的雪/岩混合
   - 峰数/尺寸不变（避开摆放与碰撞的既有假设）
4. **城墙**（`js/world.js:1182-1235`）
   - 砖墙：`brickDetail` 贴图（map + normal）+ 一层"墙根脏"的顶点色渐变
   - 垛口：**参差化**——高度/宽度/间距按城市 seed 抖动（±12%），并让少数垛口缺角；烽火台保持现有造型但同样上砖纹
   - 岩裙（`buildFloatingIsland`）：`rockDetail` + 层理方向按高度偏移
5. **地面散点**（新增，`js/world.js` 的绿化撒点里一起撒）
   - 草簇（5~7 片的低模 tuft）、小石头、花丛：每城各 60~120 个，**用 `InstancedMesh`**（同原型一份几何，几千个也只 1 个 draw call）
   - 只在距城心 0.25r~0.95r 的陆地内撒，并按既有 `world.decor` 半径避让蛋/牌子/树
6. **水面**：湖/河的水面加 `waterNormal`（同一张法线贴图，两帧 UV 平移做流动）+ 岸边一条细白线（现有浪花逻辑沿用）

### B. 成都地面烘焙（用现有 `ground-slot`）

1. **新增 `scripts/bake/ground.py` + `scripts/bake/ground-specs.mjs`**
   - 规格：每城的轮廓（`city-shape-data`）、`terrain.json`、配色、seed → 与运行时**同源**（沿用 `specs.mjs` 的做法，只搬数据不搬规则）
   - 几何：在 Blender 里按 `terrain-field.js` 的高度场重建地形面（**不重写规则**：`ground-specs.mjs` 直接 `import` 运行时那份 `makeHeightField`，把采样后的高度网格导出成 JSON 交给 Blender，规则永远只有一份）
   - 合并：地形面 + 雪峰 + 院墙 + 垛口 + 岩裙 → **一个 mesh 多材质**（现有 `common.py` 的 Soup 就是干这个的）
   - 贴图：每城在 Blender 里生成 1024~2048px 的 albedo（分区图案：草/土/铺装/梯田/岩/雪，边界噪声抖动）与 512px 法线，**打包进 GLB**（`export_image_format='AUTO'`）；UV 用局部坐标归一化（与运行时同一套约定）
   - 契约：原点在城心地面、不加任何 transform（运行时直接挂在 `ground-slot` 上）；导出后**隐藏程序化部件**由现有 `onSwap` 完成
   - 预算：`ground` 三角面 ≤ 80k、体积 ≤ 3MB（单城首屏 8MB 内留足余量）
2. **运行时改动（很小）**
   - `js/world.js`：把无地形城市的 `top0`（彩绘地面盘）也加进 `procGround`，避免烘好的地面与旧彩绘盘双显；`ground-slot` 的 `assets.apply` 已经就位，不改
   - `scripts/audit-assets.mjs`：`REFS` 加 `ground`（key = 城市 id），预算表加一行
3. **回退**：GLB 404/超时 → 程序化地面（A 段升级过的那版）继续显示 ✓ 由 `test-fallback` 断言

### C. 全量（成都认可后）

`node scripts/bake/run.mjs --kinds ground`（52 城）→ audit → test-fallback → 巡城 → 体积/帧率报告 → 提交推送。

---

## 五、改动文件清单

**新增**
| 文件 | 作用 |
|---|---|
| `js/textures.js` | 可平铺程序化纹理库（草/土/铺装/砖/岩/雪 + 法线 + 粗糙度），带缓存与 colorSpace 约定 |
| `scripts/bake/ground.py` | 地面烘焙器（地形面 + 峰 + 墙 + 垛口 + 岩裙，含贴图） |
| `scripts/bake/ground-specs.mjs` | 地面规格（复用运行时 `makeHeightField`，把高度网格导出成 JSON） |

**必改**
| 文件 | 改动 |
|---|---|
| `js/terrain.js` | 地形加 UV；材质换 `map`+`normalMap`+平滑着色；雪峰改噪声位移岩体 + 雪线混合 |
| `js/terrain-field.js` | `zoneColor` 的量化取色改平滑插值 + 噪声 warp 边界 |
| `js/world.js` | 城墙砖纹与垛口参差化；岩裙贴图；地面散点（草簇/石/花，InstancedMesh）；`top0` 进 `procGround` |
| `js/game.js` | 水面法线动画（在 `_updateWorldAnim` 里推进 UV 偏移）；若实测掉帧，按 §7 降级 |
| `scripts/audit-assets.mjs` | 加 `ground` 的 REFS 与预算行 |
| `scripts/look-shot.mjs` | 可选：加一个"贴地俯视"机位（专门看地面纹理与色带边界） |

**明确不改**：`js/terrain-field.js` 的高度算法与各城 `terrain.json` 的数值（你逐城调过）、`js/city-shape.js`、城市摆放/碰撞/蛋点逻辑、`js/assets.js` 的换装契约。

---

## 六、实施顺序与每步验证

| 步 | 内容 | 验证 |
|---|---|---|
| 1 | `js/textures.js` + 地形 UV/材质/平滑着色 | look-shot 同机位：地面出现材质颗粒；帧时长 ≤33.4ms |
| 2 | 色带柔化（平滑插值 + 噪声 warp）+ 每城 albedo 叠加 | 对比图里黄块直角消失；`check-render` 全绿 |
| 3 | 雪峰改位移岩体 + 雪线；城墙砖纹 + 垛口参差 | 对比图：山有岩理、墙不再像拉链 |
| 4 | 地面散点（草簇/石/花，InstancedMesh）+ 水面法线 | 帧时长与 draw call 数（`look-shot` 已记录）不劣化 |
| 5 | `ground-specs.mjs` + `ground.py`：只烘成都，跑通"规格 → Blender → GLB → 换装" | 成都地面换装成功、程序化部件隐藏、回退趟仍显示程序化地面 |
| 6 | **你看图验收成都** | 认可 → 步 7；不认可 → 只调贴图参数与色带，重烘一城 |
| 7 | 全量 52 城地面烘焙 + 全量回归（audit / look-shot / test-fallback / 巡城） | 全绿；单城 ≤8MB；帧时长达标 |
| 8 | 文档与提交推送 | 方案 §九 回填实测数字 |

---

## 七、边界与风险（含降级档）

1. **性能**（你选了观感优先，但核显余量确实紧）：降级顺序 = ① 地面散点数量减半 → ② 阴影 4096→2048 → ③ 地形贴图 2048→1024 → ④ 每城独立法线改共享法线。每一项都是常量/参数，单独可关，不推翻结构。
2. **CPU 侧开销**：每城 1024~2048px 的 canvas 绘制有成本（一次性、进城时）——`look-shot` 的帧时长与进入耗时都要量；必要时把每城贴图降为 1024 并做结果缓存（同城二次进入不重画）。
3. **贴图体积**：`ground` GLB 内嵌贴图 → 单城 1~3MB；52 城合计约 50~150MB。缓解：albedo 1024（非常看的远城降到 512）、法线 512、PNG 量化；audit 会卡单城与单资产预算。
4. **色域**：albedo 必须 `SRGBColorSpace`、normal/roughness 必须 `NoColorSpace`；这套约定写进 `textures.js` 的注释与返回结构，避免重演"发白"。
5. **回退一致性**：程序化地面（A 段）与烘焙地面（B 段）必须**观感接近**，否则低端机/离线时风格突变——这也是为什么先做 A 再烘 B（A 是 B 的草稿与回退）。
6. **接缝**：地形面与雪峰的 UV 分别投影，交界处不要出现明显贴图断裂（峰底一圈用岩石色收口）。
7. **旧的彩绘地面盘**（无地形城市的 `top0`）：必须进 `procGround`，否则换装后会与新地面双显、出现"两层地"。
8. **不看图不做审美判断**：这轮我能在浏览器里看截图（工具有时可用），若某轮看不到，就只用数值闸门并明确告诉你"这轮没看图"，不假装看过。

---

## 八、范围之外

- 换引擎 / 骨骼动画 / 物理；PBR 贴图集与 KTX2 压缩（需要转码器）。
- 逐城手工美术（本方案是"程序化 + 数据驱动"，不引入人工绘制资产）。
- 地形高度算法与城市轮廓本身的精度（`.plan/01M2TA8SWBXP1K79E21SDY9X5C.md` 的范畴）。

---

## 九、实施记录（本轮）

### 9.1 已完成并实测（A 段：程序化地面的贴图化）

| 步 | 内容 | 实测 |
|---|---|---|
| 1 | `js/textures.js`（新）：可平铺程序化纹理库 grass/soil/paving/brick/rock/snow/grain/water + 同源法线 | albedo 走 sRGB、normal/roughness 走 NoColorSpace；按 9 宫格重复绘制保证平铺无缝 |
| 2 | 地形网格：加 UV（4.5 单位/周期）+ map+normalMap，去掉 flatShading | 近景细节能量 **+106%**（1.2→2.5）；帧时长 16.70ms 不变 |
| 3 | 色带柔化：带间软过渡 + 遮罩噪声 warp + 台地条纹去棋盘 + 抖动改连续 | 草地 0.594·0.465（比改造前更鲜、更不白） |
| 4 | 雪山：6 边锥 → 12 边 8 段 + 多段噪声位移（sin(πt) 权重保底/保尖）+ 岩/雪顶点色混合 + 岩理贴图 | 每座 204 面，剪影半径变异系数 **0.14~0.18**（正圆锥≈0） |
| 5 | 城墙：同 UV 空间砖纹法线（从你调好的 albedo 反推，不换你的灰绿砖色） | normal 128px/NoColorSpace、normalScale 0.75 |
| 6 | 垛口：等距等大 → 尺寸 ±13%、错位 ±0.35、约 8% 缺失、每块色差 | 177 实例里 53 种缩放（含 0.05 的"塌口"） |
| 7 | 地面散点：草簇 150 / 石 60 / 花 70，三个 InstancedMesh | 只多 **3 个 draw call**，三角形 +17.5k |
| 8 | 水面：法线 + 每帧滚动 UV（河带补 UV） | 波纹在动，零额外 draw call |
| 9 | 每城区域色贴图 1024²（zoneColor 逐像素烘焙，与平铺细节相乘） | 0.17 单位/texel，比顶点色细近 9 倍；草地采样与改造前一致 |

**验收（全部达标）**：`check-render` 全绿（过曝 0.002~0.003、上缘 0.78、草地 0.590·0.465、composerDiff 0.005）；
`look-shot` 帧时长中位数 **16.70ms**（基线 16.70ms，未劣化）、375 draw calls / 164.3k 三角形；
`test-fallback` 两趟全绿（回退 0/3 地标、正常 39 门 + 3 地标命中）；0 页面异常 / 0 控制台错误。

### 9.2 本轮修掉的 5 个坑（都是"改了但没生效 / 生效两次"这一类）

1. `world.js` 没有 `rng()`（只有 terrain*.js 有）→ 垛口那段会直接 ReferenceError；补了模块级确定性 PRNG。
2. `rn()` 值域是 (-1,1) 不是 [0,1)（`Math.imul` 溢出为负、JS 的 `%` 保留符号）→ 我按 [0,1) 写的
   `3 + Math.floor(rn()*3)` 取到 -0.9 时得 0 片草叶 → 空数组 → 合并崩溃。散点改用独立流，坑写进文件头注释。
3. `mergeGeometries` 要求索引状态一致（Icosahedron 非索引 / Cone·Cylinder 索引）→ 花合并失败返回 null
   → `Box3.setFromObject` 崩。统一走 `mergeParts()`（先 toNonIndexed + 结果兜底）。
4. three 的 program 由 `material.version` 驱动：改 `vertexColors` 不写 `needsUpdate` → 顶点色与区域色
   同时生效 = 乘两遍色。
5. 区域色贴图必须写**线性**值 + `NoColorSpace`（顶点色那条路径用的是 zoneColorLinear），否则多解一次 gamma。

### 9.3 还没做（都在 B/C 段）

| 项 | 说明 |
|---|---|
| B 段：成都地面烘 GLB | `ground-specs.mjs` + `ground.py`（地形面 + 峰 + 墙 + 垛口 + 岩裙 + 内嵌贴图），
|  | 走已就绪的 `ground-slot` 换装位；预算 三角面 ≤80k / 体积 ≤3MB |
| C 段：全量 52 城 + 回归 | 等你先看成都 |
| 街道家具 | 路灯/长椅/花箱/指路牌（上一轮方案 §9.2 的遗留项） |

### 9.4 口径提醒

- **本轮我始终没能看到截图**：工作区内嵌浏览器面板不可用（`browser_open` 反复 "did not attach"）。
  所有结论都来自数值闸门（check-render / look-shot 帧时长 / img.mjs 分带统计 / 结构探针），
  以及"改动是否真的落到运行时对象上"的探针（贴图尺寸、色域、实例数、剪影变异系数等）。
  **审美判断仍需你来看**：同机位对比在 `.cache/look/{baseline,s10,final}/`（street / default / city / char）。
- 区域色贴图这一步的"边界更细"是结构性的（分辨率提高近 9 倍），但观感差异我没有肉眼确认；
  若色调不合意，回退方式是把 `buildRegionTexture` 的调用去掉（自动回到顶点色路径）。
- 帧时长是在本机 Intel UHD 730 上测的（60fps 被 vsync 钉住），负载的灵敏指标是 draw calls 与三角形数。
