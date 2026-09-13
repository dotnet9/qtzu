# 项目交接（词宠岛 · 城市链条版）

> 交接时间：2026-09-13 · 状态：全部完成并通过 agent-browser 自动化验证

## 本轮新增（在原计划之外）

1. **通关奖励城市**：order=0 城市（贵阳/大同/敦煌等 22 城）不进巡游路线；通关北京后从「走遍祖国」成就卡选城探索。`world.js` 的 `buildWorld` 循环体提取为 `buildOne` 并暴露 `world.buildIsland(isl)`（运行时补建精建岛）；`game.js` 的 `_enterBonusCity`（组关=复习8+新词4，`_forceChapter` 强制当前章）、`_handleShareCity`；`ui.js` 的 `showBonusCities`。
2. **好友分享链接**：`?city=xxx&grade=4&term=s1`（main.js `parseShareLink`）。未注册=预填档案（家乡=该城=第一关）；已注册=已解锁城直接跳转/未解锁提示/奖励城通关锁。
3. 开场引导文案适配城市链条（去掉沙墙/荆棘/农场表述）。
4. 修复 `cityRoute` 未排除 order=0 的 bug（原注释与实现不符）。


## 项目现状

纯前端 three.js 儿童英语学习游戏（无构建流程，静态部署，ES Modules + importmap CDN）。
本次大型升级已完成 **"城市内容配置化 + 纯城市链条关卡 + 牌子探索系统"**：

### 已完成

1. **数据全量外置**：`game/data/cities/` 下 52 城 × 4 个 JSON（city/universities/foods/scenes）+ `index.json` 城市索引（`defaultHome: chengdu`、`finalCity: beijing`、order 巡游顺序）。图片 Wikimedia Commons 外链，`<city>/img/` 预留。美食/风景每城 8+，大学含 985/211/双一流/官网/建校年/排名/bearing 方位。
2. **data.js 加载器**：fetch + 内存缓存 + 缺文件跳过 + 空数据兜底；cities.js 重写为纯配置驱动（无硬编码城市，**不兼容旧档**）。
3. **关卡重构**：world.js 按 `city.json.level` 生成全屏城市地图（半径 28~32、路网、地标、装饰分区、高台）；农场岛/河/船已移除；小火车/飞机转场横幅 + cinematic；北京大地图 + 金色终点仪式（徽章/横幅/烟花）。
4. **牌子系统**：universities/foods/scenes 各项自动生成低模立牌（大学蓝/美食橙/风景绿，木杆+圆角板+emoji+中文名 sprite，共享材质），按 bearing 方位绕城分布、同方位错开半径；点击弹详情卡（onerror 回退 emoji）；蛋约 12 颗（上限 15），约 5 颗依牌放置。
5. **动态组关**：words.js `chaptersFor(sem, username)` 每关 6 新词（单词+短语混合去重）+ 6 复习词（已孵化池 seeded 抽取，seed 跨会话稳定）；复习蛋简单模式（读一遍/选义即过）。
6. **城市卡片**：ui.js 顶部 4 秒/张幻灯片轮播（圆点+箭头+懒加载+onerror 回退）；Tab 配置化（customTabs）；大学富卡（校名跳官网 noopener、建校 N 年实时计算、全球/全国排名）；北京终点徽章。
7. **操作修复**：点击落点相对当前城市中心钳制；单击走固定步长（`_holdWalk` 已移除）；滚轮系数 0.0075 + 键盘 `=`/`-` 缩放 + camDist 每帧插值平滑。

### 剩余待办（按序）

1. **agent-browser 自动化验证**（本地起服 `node tools/serve.js 6000` 后访问 `http://localhost:6000/game/`）：
   - 城市卡：幻灯片轮播切换、大学/美食/风景各 Tab、大学官网链接、牌子点击弹详情卡
   - 3D：点击落点在城内圈内、单击走一步、滚轮/键盘缩放、蛋分布（约 12 颗）与孵化、过关转场横幅
   - 北京终点仪式全链路；控制台无报错
2. **规范化中文提交**（本环境无 git CLI，需在有 git 的机器执行；`.codebuddy/` 不要提交）

### 关键文件

| 文件 | 说明 |
|---|---|
| `game/data/cities/index.json` | 52 城索引（order=巡游顺序，0=不自动巡游，99+isFinal=北京） |
| `game/data/cities/<city>/*.json` | 每城 4 个内容 JSON |
| `game/js/data.js` / `cities.js` | 数据加载器 / 配置适配层（103 行） |
| `game/js/world.js` (1202 行) | 城市地图 + 立牌 + 北京仪式生成 |
| `game/js/game.js` (4089 行) | 主逻辑（转场/蛋/点击行走/缩放） |
| `game/js/ui.js` (1996 行) | 城市卡 + 牌子详情弹卡 |
| `game/js/words.js` (804 行) | 词库 + 动态组关 |
| `game/js/save.js` (453 行) | 新结构存档（旧档不兼容） |

### 约定

- 粉彩卡通风格（圆角奶油卡片、粉彩描边、柔和投影）；主色 `#C4577E/#FF9FBE`，底 `#FFFDF8`
- 永不因配置缺失崩溃：缺文件跳过、空数据兜底
- 图片一律带 onerror 回退；外链 window.open 带 noopener,noreferrer；触屏外链先确认
- 加城市/大学/美食/风景只需加 JSON，零代码
