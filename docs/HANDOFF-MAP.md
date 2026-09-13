# 交接：Q淘族 地图大改版（已提交，待实机验证+收尾）

> 2026-09-13 晚 · 仓库 D:\github\apps\qtzu（远程 dotnet9/qtzu）· 未提交改动全部在工作区
> 游戏文件在仓库根。开发：`node scripts/serve.js 6100` → http://localhost:6100/
> debug 直达：`http://localhost:6100/?city=beijing&grade=4&term=s1&debug`
> git：`C:\Program Files\Git\bin\git.exe`；push 带代理 `git -c http.proxy=http://127.0.0.1:7897 push origin main`

## 已完成（改动已生效、未提交；最后提交是 2c16d04）

1. **已提交**（2c16d04，已推送）：存档同步接口补齐（/api/push-save、/api/pull-save、/api/heartbeat）、单点登录顶号（详见 serve.js/saver.js/main.js）、碰撞卡死加固。
2. **未提交——用户 10 条反馈中的图片换源批次**：
   - 城市轮廓高保真重生成：`scripts/gen-city-shapes.mjs` 已重写（≤3600 点/城，原 36 点），产出 `js/city-shape-data.js`（743KB，含新增导出 `CITY_GEO`：每城真实经纬度 ctr + halfDeg）。台湾 4 城仍走 TW_SHAPES 回退。**已跑完**。
   - 图片换源：fetch-wiki-imgs.mjs（增强：--refill-foods-scenes、gallery 支持、断点续跑、WIKI_CONC/WIKI_GAP 调速）+ 新增 fetch-commons-imgs.mjs（Commons search API 兜底）。946/1442 图已本地化 data/cities/*/img/，死链跳过走 emoji。
3. **未提交——地图大改版（用户拍板 ×5 后回调 1/3）**：
   - game.js：`CITY_SCALE=1.67`（原 5，用户要 ×5 后缩 1/3）、PLAYER_SPEED=7.3、STEP=3.7、岛间距 147+(i%3)*30、bonus 城 dist=220、缩放上限 550/滚轮 0.09/键盘 17.5、相机 near 0.5 far 6000、雾 near=34+dist*2 far=142+dist*4。
   - 新文件 `js/china-map.js`：全国地图背景（其他城市按真实经纬度平铺：边界+淡色填充+城市名 sprite），UPD=420 单位/度。game.js _initScene 里 buildChinaMap + anchor，_switchCity 里重新 anchor。城市地面/海面/底图已用 polygonOffset 分层（海 -0.5 < 底图 -0.3 < 填充 -0.28 < 城市地面 0 偏置 -8）。
   - words.js：BOOK_LABEL 改用 CURRICULUM 全称（「四上」→「四年级上册」）。
   - style.css：.uni-img 改 object-fit:contain（校徽不裁切）。
   - 蛋分散：_spawnProgress 里 _usedEggSpots 去重，同一牌子位不重复放蛋。
4. ✅ 城市边界框（奶油色管边）+ 边内侧随机种树（InstancedMesh 220 棵上限，world.js 城市顶面构建处，搜 CITY_FRAME）。注意：曾因 PowerShell Add-Content 写入 BOM + 漏开块导致语法错，已修复（行首 BOM 必须清）。

## 用户新反馈（本条消息提出，全部未做，第5点要先给方案再动手）

1. 大学 3D 校门模型贴上校徽/真实校门图（universities.json 的 img 字段已有本地图，可用 CanvasTexture 贴到 cityLandmark('uni-gate') 横梁上；world.js 的 cityLandmark 支持第四参可扩展）。给用户问了一句「有没有更好的设计」——可提议：立牌贴图 + 保留低模门。
2. ✅ 城市缩为 1/3 + 移速 1/3（已完成，见上）。
3. ✅ 蛋分散不重复（已完成）。
4. 城市边界框 + 多种树（进行中，见上）。
5. **先交流再动手**：a) 蓝蓝的天空似乎没绘制（现在是纯色背景，用户问天空去哪了）；b) 城市外未知区域用什么填充（现在是全国地图纸面，用户不确定）。需要给方案：天空用渐变穹顶贴图（world.js 已有 dome+skyTex，检查为什么没生效/是不是太暗）；外围填充选项=继续地图纸面/淡绿草地/淡海洋。

## 明天验证方式
- 起服 → 打开 debug URL → 检查：边界框奶油色管边、树、蛋不扎堆、城市 1/3 大小、缩放 550 看全国地图（城市名+边界）、无黑块/条纹。
- agent-browser：Chromium 不认 6000 端口用 6100；多标签页同账号会互相顶号（单点登录已上线，测试时只开一个标签）。

## 红线
- `wordpet_save_v1` 存档 key、`wordpet:` 事件名不许改。
- `.codebuddy/`、scripts/*.json（accounts/leaderboard/saves/sessions）、*.log 不提交。
- 用户工作方式：**改动先跑起来给用户验证，确认后才提交，不许直接 commit**。
- 临时文件清理后再提交：scripts/_patch1.mjs、_frame.txt、_frame_snippet.js（如存在）是打补丁的临时件。
