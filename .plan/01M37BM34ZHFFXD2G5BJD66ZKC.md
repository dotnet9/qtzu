# 删掉相机挂载的前景枝叶 + 镜头跟随方向修复

前置：`main`（工作区干净假设；本轮改动全部基于下面核实的行号）。

用户两条反馈与本轮决策（已问已答）：

| 反馈 | 决策 |
|---|---|
| ①「相机旁的树叶没做好，乱的」（截图里那几团深绿就是它） | **整层删掉**，只保留暗角压边（不重做、不改成 3D） |
| ②「镜头跟随时感觉不对，画面前方应该是小人正对面」 | **只修方向**：跟到小人背后；其余规则（只在走路时跟 / 60° 死区 / 拖过镜头暂停 1.2 秒 / 拉远 >45 不跟）一律不变 |

---

## 一、已核实的现状（都带文件行号）

### 1.1 前景枝叶（要删的东西）

| 项 | 事实 |
|---|---|
| 实现 | `js/foreground.js`（167 行）：8 片深绿枝叶剪影平面，`branchTexture()` 是 7~9 个椭圆沿一条弧拼出的 canvas 贴图 |
| 挂载方式 | 每帧同步相机 `position/quaternion`，固定放在相机前方 `CAM_DIST = 3.0` 处；`depthTest:false` + `renderOrder = 900` → **永远画在最上层**（会盖住小人/云/地） |
| 分布 | 角度 `i/8·2π + 抖动`，再乘随机旋转 ±0.5 rad、随机大小 0.86~1.16 → 8 片绕画面一圈，形状/大小/角度都不规则 |
| 接线 | `js/game.js:32` 导入 · `:1046` 每帧调用 · `:2878-2887` `_updateForeground()`（桌面端建、`_lowEnd/_lowFx` 不建） |
| 校验 | `scripts/verify-foreground.mjs`（5 组断言，其中第 5 组是暗角 `uVig === 0.42`） |
| 其它引用 | **无**：README / index.html 都没提它；`sw.js` 的 `CORE` 里也**没有** `js/foreground.js`（它是运行时按需拉取的） |
| 是否参与渲染体检 | 不参与：`scripts/check-render.mjs:164` 与 `scripts/verify-sky.mjs:37,84` 都置 `_lowFx = true`，而枝叶在 `_lowFx` 下不建 → 删掉不会动这些脚本的数字 |

### 1.2 镜头跟随（要修的 bug）

| 项 | 事实 |
|---|---|
| 机位公式 | `js/game.js:3534-3538`（遮挡检测版 `:3511-3513` 同式）：相机 = 小人位置 + `(sin camYaw, cos camYaw)·dist` → **camYaw 是"相机所在的方向"** |
| 小人朝向 | 模型面朝**本地 +Z**（`js/models/player.js:177-186`：眼睛 z=+0.158、嘴 z=+0.170）；`rotation.y` 由 `atan2(move.x, move.z)` 得出 → **rotation.y 就是小人正对的方向**（`js/game.js:400` "rotation.y = π 面朝北"、`_citySpawnPos` 出生点在地标正南，两处都自洽） |
| 跟随目标 | `js/game.js:3062`：`dc = player.rotation.y - camYaw` → camYaw 收敛到 **rotation.y**，即相机绕到**小人正前方（脸上）** |
| 用户看到的现象 | 出生时 camYaw=0、小人 rotation.y=π（`js/game.js:376` / `:400`）本来是"相机在背后"；一按住 W 走路，`|dc| = π > 1.05` 触发跟随 → 约 1 秒绕到正面；再按一次 W，小人朝镜头前方掉头 180°，镜头又绕回来 → 「感觉不对」 |
| 校验为什么没抓到 | `scripts/verify-cam.mjs:71-75` 用 `heading = ang(B + π)`（= 小人朝向）当"背后"的期望值，于是断言名写"收敛到背后"，实际锁定的却是"收敛到正面" —— 自证式断言 |
| 反馈环说明 | `js/game.js:3018-3023` 的 `_moveBasisYaw` 锁存（开始走时锁定 camYaw，期间前进方向不随镜头转）是**保留**的：没有它，按 W 时"前进方向 = camYaw+π"会永远满足跟随目标，镜头就永远不跟 |

---

## 二、改动清单

### ① 删掉前景枝叶整层

| 文件 | 位置 | 动作 |
|---|---|---|
| `js/foreground.js` | 整个文件 | **删除**（`git rm` / 直接删） |
| `js/game.js` | `:32` | 删除整行 `import { makeForeground } from './foreground.js'; …`（该行尾部挂着两条别人的孤儿注释，一并清掉；`contactShadow` 在 `:30`、`groundRing` 在 `:31`、`assets` 在 `:29`，都不受影响） |
| `js/game.js` | `:1046` | 删除 `this._updateForeground(t);` 一行（`_updateCamera` 等调用顺序不变） |
| `js/game.js` | `:2878-2887` | 删除 `_updateForeground()` 方法与其上方两行注释（方法体内是 `makeForeground`/`this._fg` 的唯一用法） |
| `js/game.js` | `:63-67` | 只改注释：`VIGNETTE_GRADE.uniforms.uVig` **仍为 0.42**，但把"0.32 → 0.42 是配合前景枝叶一起做的纵深"改写成"0.42 = 只靠暗角压边的纵深（前景枝叶已按用户要求删除，见 .plan/01M37BM34ZHFFXD2G5BJD66ZKC.md）"；`:65-66` 关于"中心区不受影响、check-render 取样"的安全说明**原样保留** |
| `scripts/verify-foreground.mjs` | 整个文件 | **删除**（它 90% 的内容是枝叶断言，枝叶没了就没有可测对象；`uVig === 0.42` 这条搬到 `verify-sky.mjs`，见下） |
| `scripts/verify-sky.mjs` | `:7-9` 头注释 | 条目 5 后补两条：`5b) 暗角 uVig 精确等于 0.42（原 verify-foreground 的断言搬来）`、`8) 相机挂载的前景枝叶已移除（防回归）` |
| `scripts/verify-sky.mjs` | `:63-64` 的 evaluate | 补 `foliage: !!(g.scene.getObjectByName('frame-foliage') || g._fg)` |
| `scripts/verify-sky.mjs` | `:77` | 断言收紧：`check(!!r.vig && r.vig.uVig === 0.42, '暗角 uVig = 0.42（删枝叶后仍保留压边）', …)` |
| `scripts/verify-sky.mjs` | `:77` 后 | 新增：`check(!r.foliage, '场景里没有相机挂载的前景枝叶（已删，防回归）')` |
| `sw.js` | `:9` | `VER` 升到 `'qtzu-pwa-v20'` + 注释写清"v20：删掉相机挂载的前景枝叶（js/foreground.js 整层移除）+ 镜头跟随改到小人背后"。**`CORE` 不动**（foreground.js 从来不在里面，不能往里加已删文件，否则 `addAll` 整体失败） |

`_lowEnd` / `_lowFx` 两个降级开关**保留**：它们还被云层（`_applySkyCloudLOD`）、主角补光（`_setupPlayerFill`）、接触阴影增益（`_contactShadowGain`）、帧率看门狗（`_fpsWatch`）用着。

### ② 镜头跟随改到背后

`js/game.js:3058-3071`，只改目标角与注释（死区/滞回/速率/触发条件全部不动）：

```js
      // 镜头跟随（可选）：小人转身时镜头平滑转到背后。
      // ⚠ 目标角必须是 rotation.y + π：机位公式（_updateCamera）= 小人位置 + (sin camYaw, cos camYaw)·dist，
      //   所以 camYaw 表示"相机所在的方向"；小人模型面朝本地 +Z（models/player.js 的脸在 z=+0.158），
      //   rotation.y 就是"小人正对的方向" → 镜头要在背后 = 追 rotation.y + π。
      //   （旧版追 rotation.y = 追到小人正对面/脸上：一按 W 就绕 180°，再按 W 小人又掉头，用户反馈的"感觉不对"）
      // 60° 死区是关键：不加的话"镜头转→前进方向跟着转→小人转→镜头再转"会互相追着转成圈。
      // 只在走路时跟；骑词宠/演出/看远景(缩放>45)/刚拖过镜头都不跟。
      if (save.getCamFollow() && !this._camHold && !this.mount && this.camDistTarget <= 45) {
        let dc = (this.player.rotation.y + Math.PI) - this.camYaw;   // ← 唯一的行为改动
        while (dc > Math.PI) dc -= Math.PI * 2;
        while (dc < -Math.PI) dc += Math.PI * 2;
        …（`a` / 滞回 / `camYaw += dc * Math.min(1, dt * 1.6)` 原样保留）
      }
```

**为什么归一化那两个 `while` 现在是必需的**：出生态 `rotation.y = π`（`:400`）→ 目标角 `= 2π`，而 `camYaw = 0`，不归一化会算出 `dc = 2π`（看着像"偏了整整一圈"）→ 镜头白转一圈。归一化后 `dc = 0` → 判定"已经在背后"，不动。（原代码本来就有这两个 `while`，无需新增。）

**顺带自洽性检查（不改代码，只说明）**：修好后出生态（camYaw=0、rotation.y=π）与"按 W"的不动点一致 —— 走路时 `targetYaw = basis + π = camYaw + π = rotation.y`（`js/game.js:3039-3057`），镜头与朝向互相满足，不再有 180° 翻转；`_savePosition`（`:961-969`）存的 `yaw/camYaw` 组合在新规则下同样是"背后"，老存档续玩不会跳变。

### ③ 修校验：`scripts/verify-cam.mjs`（关键，否则旧断言会拦住修复）

| 位置 | 现在 | 改成 |
|---|---|---|
| `:71-75`（① 收敛） | 从 `ang(heading - 2.0)` 走到 `heading`（= 小人朝向 = **正面**） | 起点 `ang(heading + Math.PI - 2.0)`，期望收敛到 `ang(heading + Math.PI)`，文案改「走路转身后镜头会收敛到**背后**」 |
| `:91-94`（⑤ 死区） | `camYaw = ang(heading + 0.6)`（与正确机位差 2.54 rad，会触发跟随） | `camYaw = ang(heading + Math.PI + 0.6)`（离正确机位 0.6 rad < 1.05 → 不该跟） |
| `:96-98`（⑥ 不自转） | `camYaw = heading`（正面） | `camYaw = ang(heading + Math.PI)`；这条同时防"归一化漏了导致转整圈" |
| ② 拖拽暂停 / ③ 关开关 / ④ 远景不跟 | — | 不动（与方向无关） |
| 新增 ⑦（**这条才能真抓住本次 bug**） | — | 收敛后读**真实相机位置**：`const o = g.camera.position.clone().sub(g.player.position); const f = new THREE.Vector3(Math.sin(g.player.rotation.y), 0, Math.cos(g.player.rotation.y));` 断言 `o.dot(f) < 0`（相机在小人**背面**一侧），并把 `cos(camYaw - rotation.y) < -0.9` 一起断言 |
| `:105` 起 | — | 打印新断言的结果；文件头注释 1) 的措辞同步改掉 |

（`walk()` 里"实测 P = basis + π"的映射注释与实测值保持有效：那是**移动**映射，不是跟随映射。）

---

## 三、验证

全部在本地跑，命令按 README 的约定（无构建流程、无 npm scripts）：

| # | 命令 | 期望 |
|---|---|---|
| 1 | `node scripts/verify-cam.mjs --city chengdu` | 8 条全过，含新断言「相机在小人背后」（`o·f < 0`） |
| 2 | `node scripts/verify-sky.mjs` | 全过：`uVig = 0.42`、`场景里没有相机挂载的前景枝叶`、暗角仍压暗四角（`角落 < 中心 × 0.97`） |
| 3 | `node scripts/verify-cities.mjs --cities chengdu,beijing` | 0 控制台错误（确认删 import / 删方法没留下悬空引用） |
| 4 | `node scripts/check-render.mjs` | 四档机位指标与基线一致（过曝 / 上缘 / 草地亮度·饱和 / composerDiff），`passes` 仍含 OutputPass —— 枝叶本来就不参与这组体检，数字**不该变**；变了说明动到了别的东西 |
| 5 | `node scripts/look-shot.mjs --city chengdu --tag cam-fg` | 出 `.cache/look/cam-fg/{default,street,gate,city,char,perf}.png` + 帧时长/绘制调用；**绘制调用应比基线少 8**（8 片枝叶没了），帧时长不劣化。其中 `city`（dist=78，拉远俯视）就是用户截图那种视角，用来确认画面里再没有绿色枝叶 |
| 6 | 手感自测（`node scripts/serve.js 6100` → `http://localhost:6100/?city=chengdu&debug=1`） | ① 按住 W 一直走：镜头**始终在小人背后**，不出现"绕到脸上"；② 转身后再走：约 1 秒镜头绕到新的背后，不来回翻；③ 拖拽镜头后 1.2 秒内不被自动拉回；④ 滚轮拉远看全景：镜头不再自动跟（原规则）；⑤ 画面四边没有任何绿色枝叶，只剩暗角 |

第 1~5 条由我跑；第 6 条请你在自己浏览器里确认（**先 Ctrl+F5 强刷**，避免旧 JS 缓存）。

**提交纪律**（MEMORY.md 约定）：本轮**不 commit / 不 push**，先本地跑起来交你验证；你确认后才提交（`git` 用完整路径 `C:\Program Files\Git\bin\git.exe`，push 带代理）。本轮不涉及任何服务端文件，`scripts/*.json` 玩家数据不动。

---

## 四、风险与边界

1. **旧缓存组合**：`js/foreground.js` 从 `CORE` 之外按需拉取，删除后不再被任何模块 import；只有"离线 + 未换版"的极端情况下浏览器才会继续用旧 `game.js`，而那时旧的 `foreground.js` 也在同一个缓存桶里，不会出现 404 断链。`VER` 升 v20 会触发 `js/version.js` 的更新提示（它把 sw.js 前 400 字符纳入指纹）。
2. **画面变亮的错觉**：暗角仍是 0.42，但四边不再有深绿遮挡 → 主观上"边缘更亮"。`verify-sky` 的角落/中心对比、`check-render` 的中心区指标都不因此变红（前者只比相对关系，后者在中心区取样）。
3. **死区不变带来的取舍**：只修方向时，`|偏差| < 60°` 的转身（例如纯侧走 A/D）镜头**不跟**，小人会横着滑过画面；要"转身就跟着转"就得动死区，本轮按你的选择不做。
4. **不做的事**：不重做/不改造前景枝叶（含 3D 版）；不动暗角强度、FOV、俯角、缩放范围；不动 `_moveBasisYaw` 锁存与 `_camHold` 规则；不改存档结构（无迁移）；不动 `.plan/` 里的历史方案文件（`01M36GAMEFEEL1H9SRT8NDABZHK.md` 里对枝叶的记载保持原样，作为历史记录）。

## 五、回滚

改动尚未提交前，一条命令全回：

```bat
"C:\Program Files\Git\bin\git.exe" restore js/foreground.js js/game.js scripts/verify-foreground.mjs scripts/verify-cam.mjs scripts/verify-sky.mjs sw.js
```

（`git restore` 会把被删的 `js/foreground.js`、`scripts/verify-foreground.mjs` 一起恢复。）
