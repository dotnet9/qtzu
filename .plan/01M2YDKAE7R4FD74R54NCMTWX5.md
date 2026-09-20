# 全场景美术升级：Blender 烘焙的粘土手办风资产（保持 three.js Web 栈）

## 一、决策记录（本轮已确认，不再重开）

| 项 | 决定 |
|---|---|
| 引擎 | **不换**，保持 three.js 0.160 静态 Web 栈（Unity 评估结论见下方"附"） |
| 风格 | **粘土/软塑手办感**：圆润倒角、哑光次表面感、微不规则边缘、暖色柔光（允许改光照与配色） |
| 建模产能 | **全自动**：Blender 由 bpy 脚本（Python）批量生成资产，人工零操作；所需软件由我自行下载安装 |
| 资产组织 | 有稳定身份的实体**每个实例一个 GLB**（436 所校门、~900 只词宠、NPC、玩家、城市地标）；按 seed 随机撒的装饰（树/楼/灌木/花）用"原型 GLB + 现有 InstancedMesh"承担 |
| 交付 | 接受 `.glb` 进仓库，**保持无构建**（无 npm、无打包、静态托管 + 现有 PWA） |
| 性能底线 | 桌面端优先，可放弃低端手机（保留设备降级与加载失败回退，但不为老手机牺牲画面） |
| 节奏 | **先成都试点**，同镜头截图确认观感后再全量铺开到 52 城 |

### 附：Unity 评估结论（为什么不动引擎）
- **对"Blender 建模更精致"这个目标没有帮助**：`index.html:24-29` 的 importmap 已把 `three/addons/` 指向 three 0.160 的 CDN，`GLTFLoader` 拿来即用；Unity 反而多一层导入 + 材质重绑，且要把 `js/game.js:170-191`、`:229-238` 已调好的 PCFSoft 阴影 / ACES / 辉光重调一遍。粘土风所需的倒角与顶点色 AO 两边都得自己生成。
- **Unity Web 官方支持手机浏览器**（Unity 6 文档：iOS Safari 15+、Chrome 58+），但官方同时要求手机端手工调 `Initial Memory Size` 等内存参数，且 `.data` 解压常驻内存 + Wasm 堆会放大内存压力。
- **三个靠浏览器原生才成立的能力要重新桥接**：语音三级降级（Web Speech `js/speech.js:4` → 本地 Whisper `js/whisper.js` → 字母块）、离线 PWA（`sw.js` 分桶缓存 + 加到主屏）、`?city=&grade=&term=` 分享链接即存档入口。
- **成本是重写而非升级**：`js/` 约 2.5 万行（`game.js` 5416 行、`world.js` 1908 行、`ui.js`…），数据层（`data/cities/*.json`、词库、地形）可复用，C# 代码零复用。
- **"C# 好改"不成立**：现在是无构建纯 JS，记事本改完刷新即生效；Unity 改一行要开编辑器、等编译、重新 Build。
- 换 Unity 的合理条件是"要上架原生 / 要骨骼动画与物理 / 团队有 Unity 经验"，本作三条都不满足。若将来产品形态转向原生包，应作为独立决策先做 2~3 周 spike（成都一城 + 语音 + 首屏包体/帧率实测）再定。

---

## 二、目标与验收标准

**目标**：在**不改引擎、不引入构建步骤、不增加人工操作**的前提下，把全场景美术从"程序化基础几何拼装"升级为"Blender 烘焙的粘土手办风资产"，并同步升级光照/材质，让 52 城、436 所校门、~900 只词宠在桌面端明显更精致；任何资产加载失败都必须静默回退到现有程序化模型，游戏永不白屏、永不因美术崩。

**验收（可量化，全部要跑）**
1. `node scripts/audit-assets.mjs`：manifest ↔ 磁盘 ↔ 代码引用三方一致，**0 缺失、0 孤儿、0 超预算**（三角数/尺寸/节点名/朝向逐项校验）。
2. `node scripts/verify-assets.mjs`：52 城逐城加载，**0 控制台错误、0 unhandledrejection、目标 GLB 100% 命中**（阈值可配）。
3. `node scripts/test-fallback.mjs`：拦截并 404 全部 `.glb` → 断言可进游戏、可走路、可孵蛋、无白屏，程序化回退生效。
4. `node scripts/perf-shot.mjs`：同机同镜头帧时长中位数**不高于改造前**；输出成对截图供肉眼比对。
5. 成都试点同镜头对比图（改造前 / 改造后）肉眼可分辨风格差异，用户确认后才做全量。
6. 预算：单资产与单城首屏新增资产体积都在 §4.2 的表内（成都试点实测后再收紧或放宽并写回本文件）。

---

## 三、现状（已逐行核实）

### 3.1 技术栈与交付
- 引擎：three.js 0.160，CDN importmap（`index.html:24-29`）；**无 `package.json`、无打包、无构建**；ES Modules 直出。
- 托管：纯静态（GitHub Pages / Vercel / 任意目录）+ 可选 Node 后端（`scripts/serve.js`，`/api/*` 排行榜/账号/存档，无后端自动降级本机存档）。
- PWA：`sw.js`（`VER='qtzu-pwa-v17'` at `:9`，`CORE` 预缓存列表 `:13-26`，音频桶 24MB / 大文件桶 200MB `:27-28`）。
- 语音：Web Speech（`js/speech.js`）→ 本地 whisper-tiny.en q8（`js/whisper.js`，transformers.js CDN + 自托管模型）→ 字母块兜底。
- 校验工具：`playwright-core`（`node_modules/`），但 chrome 路径**硬编码**在 `scripts/tpl-shots.mjs:4`、`scripts/verify-terrain.mjs:5`（机器绑定，需要参数化）。

### 3.2 渲染现状
- `js/game.js:170-191`：WebGLRenderer（antialias + `logarithmicDepthBuffer`，失败降级无抗锯齿）、`setPixelRatio(min(dpr,2))`、`shadowMap` PCFSoft、`outputColorSpace=SRGB`、`ACESFilmicToneMapping` exposure 1.05；`js/game.js:917` 有个分支关阴影。
- `js/game.js:229-238`：桌面端（`pointer: coarse` 之外）挂 `EffectComposer` + `UnrealBloomPass(0.32, 0.65, 0.86)`；触屏直接跳过。
- 光照：`js/world.js:566-568` 单个 `HemisphereLight` + 单个 `DirectionalLight`；另有若干局部 `PointLight`（`js/world.js:736`、`:1783`）。
- 材质：`js/models/kit.js:5` 的 `M()` **每调用一次就新建一个 `MeshStandardMaterial`**，几何同理每次 `new`——所以现状是"高 draw call + 高材质数"的拼装式建模。

### 3.3 美术资产现状（全程序化，仓库 0 个模型文件）
- 内容规模：52 城（`data/cities/`）、**436 所大学校门**（README:25：50 座招牌门 + 386 所按 19 个风格族派生）、~900 词的词宠（`js/words.js:798` 的 `AUTO_SPECS` + `js/models/auto-templates.js:24` 的参数化模板）、24 个自然道具 + 12 个建造道具（`js/models/props-nature.js`、`props-build.js`）、**12 类城市地标**（`js/world.js:1811-1907`：gate/tower/wall/panda/ice/palm/dome/mountain/pavilion/grotto/harbor + uni-gate）。
- 运行时生成、**不应外置为 GLB** 的部分：
  - 地形高度场：`js/terrain.js` 的 `createCityTerrain`（逐城 `terrain.json` 驱动，52 城各不相同）。
  - 城墙 / 垛口 / 岩裙 / 浪花 / 沿墙两排树：`js/world.js:1154`、`:1247-1253` 已用 `InstancedMesh`。
  - 所有文字/图像贴图：校徽匾（`js/uni-gate-models.js:678` plaque）、字母牌与气泡（`js/models/tags.js:17`、`:36`）、地面与天空 canvas 贴图（`js/world.js:175-202`）——它们是动态的（校徽来自维基/本地图、字母随单词变）。
  - 全国地图纸面 + 邻城浮雕（`js/china-map.js`）。

### 3.4 关键"插拔点"（改这里，其余代码不用动）
| 插拔点 | 位置 | 契约（必须保持） |
|---|---|---|
| `buildPet(petId)` | `js/models/build.js:12` | 返回 Group，**原点在脚底 y=0**，整体高约 0.45~1.0；调用方 `js/pets.js:144`、`js/game.js:895`；字母牌/气泡靠 `Box3` 量尺寸挂上去（`js/models/tags.js:93-101`） |
| `cityLandmark(type, color, seedStr, img)` | `js/world.js:1811` | 返回 Group；`uni-gate` 走 `buildUniGate`（`js/world.js:1817` → `js/uni-gate-models.js:713`）；占地半径表 `LM_HALF`（`js/world.js:1395`）必须同步 |
| 校门朝向与缩放 | `js/game.js:2150-2159` | `rotation.y = atan2(cx-x, cz-z)` → **本地 +Z 朝城心**（即校门正面/牌匾朝 +Z）；`scale.setScalar(0.5)`；`_groundY` 贴地 → **原点必须在脚底**，否则浮空或陷地 |
| 校门牌匾 | `js/uni-gate-models.js:678` + `:730` | `buildUniGate` 返回 `{beamY, beamW}` 供牌匾定位；牌匾贴图必须在运行时 canvas 生成（校徽是动态图） |
| `buildPlayer(gender, wear)` | `js/models/player.js:7`，返回 `{group, parts}`（`:122`） | `parts` 必须含 `legL/legR/armL/armR/body/head/eyes/balloon/wandTip`，且轴心保持现状：腿 `(±0.075,0.3,0)`、臂 `(±0.15,0.2,0)` 挂在 body、body `(0,0.3,0)`、head `(0,0.46,0)` 挂在 body。动画在 `js/game.js:2627-2636`（走/跳）、`:4896-4897`（演出）、`:3200-3201`（气球）、`:2650-2655`（魔法棒） |
| `buildNPC(role, shirt)` | `js/npcs.js:63`，调用处 `:196` 解构 `{group, legL, legR}` | 腿摆动动画依赖 `legL/legR` 节点 |
| `PROPS` 表 | `js/models.js:15`（`{...nature, ...build}`） | 36 个 builder；`js/world.js` 里 60+ 处 `PROPS.xxx(...)` 调用，签名 `(scaleOrOpt)` → 返回 Group，原点在底部中心 |

### 3.5 PWA 与资产缓存现状
- `sw.js:109-113`：同源请求里 `.mp3` → `cacheFirst(req,'audio')`、`.onnx/.wasm` → `cacheFirst(req,'big')`，**其余（含 `.glb`）走 `networkFirst`**——即 GLB 现在会被"每次先网络拉"。
- 跨域请求 `cacheFirst`（`:116-117`），所以 CDN 上的解码器（若启用压缩）首次用后即缓存，离线可用。

---

## 四、总体设计

### 4.1 分层：谁做 GLB，谁留程序化
| 层 | 数量 | 处理 |
|---|---|---|
| 大学校门 | 436 | **每实例一个 GLB**（`assets/models/gates/<sha1(校名)8位>.glb`） |
| 词宠 | ~900 | **每实例一个 GLB**（`assets/models/pets/<petId>.glb`） |
| 城市地标 | 12 × 52 城 | 每城地标一个 GLB（按 `city.json` 的 `level.landmark.type` + 城市 seed 生成） |
| 玩家 / NPC | 2 性别 × 装扮、6 角色 | 玩家按"部件"出 GLB 再组装（保留 `parts` 契约）；NPC 每角色一个 GLB（保留 `legL/legR`） |
| 装饰道具 | 36 类 | **原型 GLB × 若干变体** + 运行时 `InstancedMesh`（沿用 `js/world.js:1247-1253`）；不给每棵树出独立文件 |
| 地形 / 城墙 / 垛口 / 岩裙 / 浪花 / 全国地图 | — | **保持程序化**（数据驱动、逐城不同、体量不可外置） |
| 全部文字/图像贴图 | — | **保持运行时 canvas**（动态、含 i18n 与校徽） |

### 4.2 Blender 烘焙管线（全自动，无人操作）
**安装**：下载 Blender 便携版 zip（LTS x64），解压到**仓库之外**（如 `E:\tools\blender\`），不提交 git；执行阶段第一步做，并记录实际版本号到 `assets/models/manifest.json` 的 `blender` 字段。

**目录**
```
scripts/bake/                     Python 生成规则（提交）
  common.py                       风格库：倒角/圆角/顶点色AO/命名/朝向/导出参数/预算断言
  gates.py                        436 校门（招牌 50 + 19 风格族派生 386）
  pets.py                         ~900 词宠（沿用 AUTO_TEMPLATES 的模板族）
  landmarks.py                    12 类地标 × 52 城
  props.py                        36 类装饰原型 + 每类 3~6 个变体
  characters.py                   玩家部件 + 6 类 NPC
  manifest.py                     汇总写出 manifest.json（含 beamY/beamW/fz、bbox、tri、朝向）
  run.mjs                         调度：调 blender.exe -b -P xxx.py 逐批烘焙 + 汇总 + 报错退出
assets/models/                    产出的 .glb（提交）
  gates/ pets/ landmarks/ props/ characters/
  manifest.json                   id → {file, tri, bbox, nodes, forward, beamY/beamW/fz, blenderVersion}
```

**规则一致性**：所有随机性必须**参数化 + 确定性种子**，允许复用现有算法（`js/uni-gate-models.js:714-716` 的 `s=5381` / `1664525` 序列、城市 `seed`、校名 hash）。同一 id 每次烘焙结果必须一致（脚本里做一次"二次烘焙 → 文件哈希比对"的自检）。

**每轮烘焙的固定动作**：apply modifiers → 三角面预算断言（超限即失败）→ 重建法线（平滑/按面角）→ 烘焙顶点色 AO → 按命名规范重命名节点 → 导出 GLB（+Y up、顶点色开、不烤贴图）→ 写 manifest。

### 4.3 粘土手办风规范（风格落地的"配方"，`scripts/bake/common.py` 里固化）
- 造型：所有硬边件加倒角（Bevel width≈模型尺寸的 2~4%），再轻量细分/着色平滑，**消灭现有直角方块感**；圆柱件段数提高到 24~32；曲线件用 lofts 而非多段直筒。
- 微不规则：对体积件加极低幅度噪声位移（≤尺寸的 1.5%），得到"手捏"感而不变形。
- 材质：哑光为主（`roughness 0.85~1.0`、`metalness 0`），可给少量"软塑感"（轻微次表面/边缘暖色偏移）；**配色沿用现有马卡龙色名**（便于与保留的程序化资产共存），在 Blender 侧统一色卡。
- 细节：用**顶点色 AO + 轻微色阶变化**替代贴图（零纹理、体积小、离线友好）；点眼/腮红等小件保留（它们是角色识别度的关键）。
- 命名与朝向：节点命名 `body/legL/...` 严格按 §3.4 契约；朝向前方一律 **本地 +Z**；原点在脚底中心。
- 三角面预算（超限脚本报错）：
  | 资产 | 面数上限 | GLB 体积上限（未压缩） |
  |---|---|---|
  | 校门 | 6 000 | 120 KB |
  | 词宠 | 2 500 | 40 KB |
  | 地标 | 10 000 | 200 KB |
  | 装饰原型 | 3 000 | 60 KB |
  | NPC | 3 000 | 60 KB |
  | 玩家（部件合计） | 6 000 | 150 KB |
  | 单城首屏新增 | — | 3 MB（成都试点实测后写回本文件） |

### 4.4 运行时加载与回退（新增 `js/assets.js`）
- 用现有 importmap 的 `three/addons/loaders/GLTFLoader.js`（**不新增依赖**）；`assets.js` 提供：`preload(kind, ids[])`、`apply(group, kind, id)`、`release(kind, ids[])`、内部 `Promise` 缓存 + 并发上限（建议 4）+ 单资产超时（1.5s）。
- **两段式渲染（关键，保证孩子不等）**：先立即用现有程序化 builder 出占位 → 资产到位后**原地替换**：
  - 通用实体（校门/地标/装饰/词宠）：清空 group 的 children，挂入 `glb.scene.clone()`，**保留 group 本身的 transform 与事件/引用**（`js/game.js:2158` 给校门子节点挂了 `userData.sign`，替换后必须重新 `traverse` 打标）。
  - 玩家/NPC：**不整体替换 group**，而是按节点名把 GLB 部件挂回既有 part Group（`legL/legR/armL/armR/body/head`），保证 `js/game.js` 里所有 `playerParts.*` 引用与旋转动画零改动。
- 失败/超时/离线未命中 → 保持程序化结果，静默（不弹错、不打断）；控制台只 `console.warn` 一次。
- 显存/内存：同一 GLB 多次实例共用 `BufferGeometry`（`clone()` 共享几何，不复制）；离场时 `release()` 释放。
- 词宠图鉴缩略图（`js/models/build.js:28-52` 离屏渲染）改为异步：GLB 未到位时先用程序化缩略图，到位后刷新缓存。

### 4.5 光照与后处理升级（粘土风的另一半，不能只换模型）
- 调整 `js/world.js:566-568`：主光柔和化（低对比、暖高光）+ 半球光提亮环境、加一层极轻的假环境反射（用 `RoomEnvironment` 或纯色 `envMap`，只在桌面端挂）。
- 接触阴影/软阴影：保留 PCFSoft，调 `shadow.radius`/bias 让阴影"糊"一点更粘土；`js/game.js:917` 那条关阴影的分支要核对是否仍需。
- 后处理：保留 Bloom（`js/game.js:235`），按新风格降一点强度；可选加轻描边（Sobel）——**只在桌面端**，触屏沿用现有 `lowEnd`（`js/game.js:230`）跳过。
- 统一材质映射：GLB 材质加载后过一张"风格映射表"（粗糙度/环境强度/色温），避免 GLB 与程序化资产出现两种质感并存的"缝合怪"。

### 4.6 缓存与离线（`sw.js`）
- 新增分支：`.glb` → `cacheFirst(req, 'big')`（复用 200MB 大文件桶 `sw.js:28`），与 `.onnx/.wasm` 同桶但不挤占音频桶。
- `VER` 升版（`sw.js:9`，如 `qtzu-pwa-v18`）并在注释里写清原因（沿用现有注释风格）。
- `CORE`（`sw.js:13-26`）**不列任何 GLB**（避免首装几十 MB），GLB 一律进城按需预热。
- 若要启用压缩（Draco/Meshopt）：解码器走 CDN（跨域 `cacheFirst` 已覆盖），并把"首屏无网 → 解码器不可用 → 回退程序化"纳入 `test-fallback.mjs`。DRACO 与否作为**阶段 5 的决策点**：成都试点若单城 > 3MB 才上，并在启用前把解码器加入预热。

---

## 五、成都试点（先做，通过才全量）

**范围**
- 成都 18 所大学校门（`data/cities/chengdu/universities.json`）。
- 成都城市地标（`data/cities/chengdu/city.json` 的 `level.landmark`，熊猫类）。
- 玩家部件（男/女）+ 6 类 NPC。
- 第 1 关 12 只词宠（含短语词宠的气泡标牌位置）。
- 成都用到的装饰原型（树/松/灌木/花/岩石/云/亭子/立牌等，先做出现的那些）。

**交付物**
1. `scripts/bake/*` 全部脚本 + `assets/models/` 成都批次产物 + `manifest.json`。
2. `js/assets.js` 加载器与回退；`js/pets.js`、`js/world.js`、`js/models/build.js`、`js/game.js`、`js/npcs.js`、`js/models/player.js` 的接入改动。
3. `scripts/audit-assets.mjs`、`scripts/verify-assets.mjs`、`scripts/test-fallback.mjs`、`scripts/perf-shot.mjs`。
4. 成都同镜头"改造前/改造后"截图（复用 `scripts/tpl-shots.mjs:13-21` 的镜头脚本）+ 帧时长对比 + 单城资产体积。

**通过门槛**：§二 的 1~4 全绿，且用户看完对比图认可风格。**不通过就停在成都**，不回滚也不铺开（其余城市继续走程序化，游戏完好）。

---

## 六、改动文件清单

**新增**
| 文件 | 作用 |
|---|---|
| `scripts/bake/common.py` | 风格库（倒角/圆角/AO/命名/朝向/导出/预算断言） |
| `scripts/bake/gates.py` / `pets.py` / `landmarks.py` / `props.py` / `characters.py` / `manifest.py` | 各类资产生成规则 |
| `scripts/bake/run.mjs` | 烘焙调度（`blender.exe -b -P`）+ 汇总 + 失败退出 |
| `js/assets.js` | GLTFLoader 封装：预取 / 原地替换 / 回退 / 释放 |
| `scripts/audit-assets.mjs` | manifest ↔ 磁盘 ↔ 代码引用三方校验（0 缺失/0 孤儿/0 超预算） |
| `scripts/verify-assets.mjs` | 52 城逐城加载验收（0 错误、GLB 命中率） |
| `scripts/test-fallback.mjs` | 拦截 404 全 GLB → 断言回退可玩 |
| `scripts/perf-shot.mjs` | 帧时长中位数 + 成对截图 |
| `assets/models/**` + `manifest.json` | 烘焙产物（提交） |

**必改**
| 文件 | 改动 |
|---|---|
| `js/models/build.js:12` | `buildPet` 接入 `assets.apply`（先程序化占位，GLB 到位后原地替换） |
| `js/world.js:1811-1820` | `cityLandmark` 的 `uni-gate` 与其余 11 类地标接入 GLB；`LM_HALF`（`:1395`）与新资产占地半径对齐 |
| `js/uni-gate-models.js:713` | 保留为回退实现；新增"manifest 提供 `beamY/beamW/fz`"的通路，牌匾仍走 `plaque`（`:678`） |
| `js/models/player.js:7` | 部件级 GLB 接入，`parts` 契约与轴心（`:122`）不变 |
| `js/npcs.js:63` | NPC GLB 接入，`{group, legL, legR}` 契约不变 |
| `js/models.js:15` | `PROPS` 升级为"GLB 原型 + 程序化回退"的同签名表（36 个 builder 签名不变） |
| `js/game.js:2150-2159` | 校门替换后重新 `traverse` 打 `userData.sign`；`:170-191`/`:229-238` 光照与后处理按新风格调参 |
| `js/world.js:566-568` | 光照风格化（柔和主光 + 提亮环境 + 桌面端环境反射） |
| `sw.js:9,109-113` | `VER` 升版；新增 `.glb → big 桶` 分支 |
| `scripts/tpl-shots.mjs:4`、`scripts/verify-terrain.mjs:5` | chrome 路径改为 `CHROME_PATH` 环境变量 + 默认值回退（去掉机器绑定） |

**明确不改**
- `js/terrain.js`、`js/city-shape.js`、`js/china-map.js`（地形/轮廓/纸面地图保持程序化）。
- `js/models/kit.js`、`pets-shapes.js`、`auto-templates.js`、`props-*.js`、`uni-gate-models.js` 的**所有 builder 保留**——它们是回退路径，也是造型规则的参考实现。
- 存档/账号/排行榜（`js/save.js`、`scripts/serve.js`）：美术不参与存档，**零迁移**。
- 不引入 npm/打包步骤；不引入 `.fbx`；不删任何现有 draw call 优化（`InstancedMesh` 等）。

---

## 七、实施顺序与每步验证

| 步 | 内容 | 验证 |
|---|---|---|
| 1 | 下载便携版 Blender 到仓库外；写 `scripts/bake/common.py` + 一个最小样例（成都 1 座校门） | `blender.exe -b -P` 跑通，产出 GLB 能被 three.js 加载并显示（截图） |
| 2 | `js/assets.js` 加载器 + `sw.js` 缓存分支 + `test-fallback.mjs` | 404 全 GLB 时游戏照常可玩；正常时 GLB 命中 |
| 3 | 烘焙成都 18 座校门 + 12 只词宠 + 玩家/NPC + 地标 → 接入运行时 | 成都同镜头截图（前/后）；校门贴地不浮空、牌匾位置正确、点校门弹卡正常 |
| 4 | 光照/后处理风格化 + 装饰原型 GLB（树/灌木/岩石/云…） | 帧时长中位数不高于改造前；装饰不穿地、不与牌子重叠 |
| 5 | `audit-assets.mjs` + `verify-assets.mjs` 跑通；测单城体积，决定是否启用 Draco 并写回 §4.2 预算 | 审计 0 缺失/0 孤儿/0 超预算；52 城加载 0 错误 |
| 6 | **用户验收成都试点** | 认可 → 进入步 7；不认可 → 只调风格参数重烘，继续停在成都 |
| 7 | 全量烘焙：436 校门 + ~900 词宠 + 52 城地标 + 全部道具变体 | `run.mjs` 全绿（含"二次烘焙哈希一致"自检）；仓库新增体积在预算内 |
| 8 | 全量上线 + 回归 | `verify-assets.mjs` 52 城 0 错误；`perf-shot.mjs` 帧率达标；手动过一遍孵蛋/立牌/图鉴/离线 |

---

## 八、边界情况与风险

1. **"Blender 不会自动更精致"**：精致度 = 我在 bpy 里写的造型规则。每批资产必须截图校对（同镜头前后对比），否则容易产出"圆角但仍呆板"的资产。这是本方案最大的质量风险，靠步 3/6 的截图门槛控制。
2. **替换后引用失效**：`js/game.js:2158` 的 `userData.sign` 打标、`playerParts.*`（`:254-256`、`:2627-2636`、`:4896-4897`、`:3200-3201`）都是**对 Group 对象**的引用——因此设计上必须"保留 group、只换 children"或"按名挂回 part Group"，**禁止整体替换对象**。
3. **朝向/缩放/原点**：校门 `scale 0.5` + `rotation.y = atan2(...)`（`js/game.js:2152-2153`）+ `_groundY` 贴地，要求 GLB **原点在脚底、正面朝本地 +Z**；错一处就是"浮空 / 后背朝人 / 陷进山坡"。
4. **占地与碰撞**：`LM_HALF`（`js/world.js:1395`）参与摆放与碰撞。新资产若明显更宽，必须同步该表，否则牌子/蛋/玩家会与校门重叠（改动最小化：先按现有半径建模）。
5. **首屏不被阻塞**：必须"程序化占位 → GLB 到位原地替换"，不得 await 资产再进城（`js/main.js:82-184` 的 begin 流程不动）。
6. **仓库体积**：未压缩预估 436×120KB + 900×40KB + 地标/道具 ≈ **90MB 量级**新增二进制。缓解：顶点色替代贴图、面数预算、阶段 5 的体积决策点（超 3MB/城 才上 Draco）。
7. **离线首次进入未缓存城市**：GLB 拉不到 → 静默回退程序化（不弹错）；已在 `test-fallback.mjs` 覆盖。
8. **低端机**：用户已接受"桌面优先"，但仍保留既有降级（触屏跳过 Bloom、`game.js:179-183` 无抗锯齿回退）；低端机不加载 GLB，直接用程序化版本，避免崩溃。
9. **旧缓存混搭**：GLB 是新增文件，不会毒化旧缓存；`sw.js` 的 `VER` 升版负责让 SW 与预缓存一起换新。
10. **可复现性**：烘焙必须确定性（种子固定）；`run.mjs` 内置"二次烘焙 → 哈希比对"，否则后续无法定位"某城校门变了"是谁改的。

---

## 九、范围之外（本轮不做，供后续排期）

- **换引擎 / 迁 Unity**（结论见 §一附，除非产品形态转向原生包）。
- 骨骼动画、物理、Timeline 演出。
- 贴图（法线 / 手绘 albedo / 贴图集）：先顶点色 AO；贴图会让体积涨一个量级，作为试点验收后的独立选项。
- 地形 / 城墙 / 全国地图做 GLB（数据驱动 + `InstancedMesh` 已够用）。
- 城市轮廓精度、DEM 真实高程（既有 `.plan/01M2TA8SWBXP1K79E21SDY9X5C.md` 的范畴）。
- 音效/BGM 升级（`js/audio.js` 程序化 BGM 不在本次美术范围）。
