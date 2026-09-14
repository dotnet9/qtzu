# 🧺 Q淘族 QTZu

> **Q淘族，越淘越有词** —— 跟着词宠淘中国，淘出 900+ 小学英语词

一款面向 3-6 年级小朋友的 **3D 英语学习游戏**（纯前端，点开即玩）：乘小火车/飞机巡游中国 52 座城市，每关一整屏城市地图，走近发光的词宠蛋念出英文唤醒词宠；城里几十块**探索立牌**（大学 🎓 / 美食 🍜 / 风景 🏞️）点开就是图文小百科。通关北京还能解锁 22 座奖励城市继续淘。

> 中文界面 + 英文学习内容 · 语音跟读为主（🎤）、字母块兜底（🧩）· 永无失败惩罚
> 家长视角：**QT = Quality Time**，把背单词变成亲子好时光。

## ✨ 玩法闭环

| 环节 | 玩法 |
|---|---|
| 🧺 淘蛋 | 走近发光的词宠蛋 → 听发音 → 🎤 大声读（自动评分，越准 ⭐ 越多）或 🧩 拼字母块。孵出即喝彩：**淘了个蛋！** |
| 🔁 复习蛋 | 每关一半是复习蛋（以前城市学过的词），读一遍即过，遗忘曲线伪装成喂养 |
| 🪧 探索立牌 | 大学蓝 / 美食橙 / 风景绿，按真实地理方位立牌，点击弹图文详情，靠近朗读英文名 |
| 🏙️ 城市卡 | 真实照片幻灯片轮播 + 历史/大学/美食/风景四个 Tab，大学卡可跳官网、实时算建校年数 |
| 🚄 城市链条 | 家乡城市（默认成都）起步，逐城解锁，北京终点金色仪式；通关解锁奖励城市 |
| 🧑‍🤝‍🧑 城市 NPC | 游客/小贩/学生等 6 种角色走街串巷：走近打招呼，点击小人聊天（小知识问答），气泡自动分页 |
| 🗺️ 全国地图 | 拉远即见立体中国地图：邻城真实轮廓+状态牌（待闯关/已攻克/通关后再来/敬请期待），金色虚线画出巡游路线 |
| ⛤ 每日任务 / ⛲ 许愿井 | 每天一个小任务，星星攒够换装扮（帽子/王冠/气球/魔法棒） |

**组关**：每关 6 个新词（单词+短语混合）+ 6 个复习词，seed 由「昵称+册」派生，跨会话一致；蛋约 12 颗，部分就藏在立牌旁。

**城市场景细节**：城市边界是奶油色"院墙"，墙内草地上撒满树丛/灌木与低模高楼；**大学校门"一校一门"**（`js/uni-gates.js` 数据 + `js/uni-gate-models.js` 造型库）：每城排名最高的大学按真实校园标志定制招牌门（清华二校门、北大西门牌楼、武大牌坊、厦大嘉庚门、哈工大苏式主楼、苏大园林月亮门、藏大藏式门、敦煌九层楼…共 50 座），其余 386 所按校名关键词落入 19 个风格族（航空航天=火箭发射架、铁道=蒸汽机车、邮电=信号塔、海洋=灯塔鲸尾、农林=麦穗风车、中医药=药葫芦、政法=天平、艺术=琴键调色盘…），同族内按校名种子微调柱色/高矮/装饰，保证"没有两所大学门完全一样"；校徽贴在门楣上。

## 📚 内容全配置化

程序只负责渲染与交互，城市内容全部 JSON 驱动（`data/cities/`）：

```
data/cities/
  index.json                     城市索引（巡游顺序 / 家乡 / 终点城）
  <city>/city.json               历史 / 图集 / 关卡布局（半径·地标·分区·高台）
  <city>/universities.json       本科类大学（985/211/官网/建校年/排名/方位）
  <city>/foods.json              美食 8+
  <city>/scenes.json             风景名胜 8+
  <city>/img/                    本地图片（无图自动回退 Wikimedia 外链 → emoji）
```

**加城市/大学/美食/风景只需加 JSON，零代码。** 缺文件自动跳过、空数据兜底，永不因配置缺失崩溃。

## 🔗 好友分享

链接即存档入口：`https://qtzu.com/?city=chengdu&grade=4&term=s1`

- 玩耍时地址栏自动带上当前城市与课本（进城/换册即更新），复制地址栏就是分享链接
- 未注册：自动预填档案（家乡 = 分享城市 = 第一关）
- 已注册：已解锁城市直接跳转继续玩；奖励城市需通关后才能去

## 📱 电脑 & 手机

- **电脑**：WASD 走路 · 点地面走一步 · 右键转视角 · 滚轮/`+`-`-` 缩放 · E 交互
- **手机**：摇杆走路 · 点地走一步 · 双指缩放 · 点立牌/蛋交互
- 🎤 语音识别需 HTTPS/localhost；不支持时自动降级字母块拼词（100% 可玩）

## 🚀 本地运行

```bash
node scripts/serve.js 6000      # 零依赖开发服务器（禁缓存），端口默认就是 6000
python scripts/serve.py 6000    # 等价 Python 版
# 打开 http://localhost:6000/
```

Windows 下直接双击 `run.bat`（同样是 6000 端口，自动打开浏览器）。

排行榜/账号/跨设备存档接口：`GET /api/leaderboard`、`POST /api/score`、`/api/register`、`/api/login`、`/api/update`、`/api/push-save`、`/api/pull-save`（服务端不存明文密码）。无后端时自动降级本机存档，游戏照常玩。

## ☁️ 部署

### 方式 A：自己的服务器（推荐，排行榜/账号/存档全功能）——需要反向代理

`scripts/serve.js` 是**零依赖** Node 服务，同时提供静态文件和 `/api/*` 接口，默认监听 6000。它不做 TLS/域名，生产环境请用 nginx 做 80/443 → 6000 的反向代理：

```bash
# 1. 上传整个仓库到服务器，例如 /var/www/qtzu
# 2. 用 pm2 守护进程（npm i -g pm2），或写成 systemd 服务
cd /var/www/qtzu && pm2 start scripts/serve.js --name qtzu -- 6000 && pm2 save
```

```nginx
# 3. /etc/nginx/sites-available/qtzu
server {
    listen 80;
    server_name qtzu.com;              # 换成你的域名
    root /var/www/qtzu;                 # 静态文件直接由 nginx 发（比过一道 Node 快）
    index index.html;

    location /api/ {                    # 接口反代给 Node 服务
        proxy_pass http://127.0.0.1:6000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 4. 上 HTTPS（强烈建议）：浏览器只在 HTTPS 或 localhost 下开放麦克风，
#    没有 HTTPS 语音跟读不可用，会自动降级为字母块拼词
sudo certbot --nginx -d qtzu.com
```

运行数据都在 `scripts/*.json`（排行榜/账号/存档/会话，首次运行自动生成，已 gitignore）——定期备份这个目录，迁移服务器时一并带走。

### 方式 B：纯静态托管（GitHub Pages / Vercel / Netlify，零运维）

整个目录直接托管即可，`audio/`（预生成发音）与 `models/`（本地 Whisper 识别模型）**需完整上传**。没有 `/api` 后端：排行榜、账号与跨设备存档自动降级为本机存档，单机玩法完整保留。

## 📂 目录

```
index.html          入口页面
css/                粉彩卡通 UI
js/                 游戏逻辑（ES Modules，见下）
data/               城市内容 JSON + 词库 + 应用品牌（app.json）
audio/ models/      预生成发音 / 本地语音识别模型
scripts/            开发脚本与本地服务器（serve.js/serve.py）
docs/               设计文档（预留）
assets/             品牌素材（logo）
```

**js/ 主要模块**：`data` 数据加载（fetch+缓存+兜底）· `cities` 城市配置适配 · `words` 词库+动态组关 · `world` 城市地图+立牌生成 · `game` 主逻辑 · `ui` 城市卡+弹卡 · `save` 存档+遗忘曲线 · `pets` 蛋与词宠 · `models` 程序化低模库（`models/` 目录按域拆分：kit 几何工具箱 / pets-shapes 基础宠物形 / auto-templates 参数化词宠 / tags 徽章字母牌 / player 玩家换装 / props-nature+props-build 场景物 / build 词宠工厂）· `uni-gates`+`uni-gate-models` 一校一门校门（数据层+造型层）· `speech`/`whisper` 语音识别 · `audio` 程序化 BGM。

## 🧱 技术栈

- Three.js 0.160（CDN importmap）+ 程序化建模（无外部模型文件）
- 纯静态、无构建流程；ES Modules
- 语音：Web Speech API → 本地 Whisper → 字母块，三级降级
- 发音：Wikimedia 真人录音预生成 mp3（离线可播）

## 📄 License

MIT © [沙漠尽头的狼](https://codewf.com) · [qtzu.com](https://qtzu.com)
