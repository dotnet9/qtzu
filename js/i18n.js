// 轻量双语系统：key 为英文短句 id，文案资源在 data/i18n/ui.zh.json 与 ui.en.json
// （key 相同、按语言分文件维护，全球协作者改 JSON 即可翻译）；代码内置同内容兜底，
// 资源加载失败也不影响显示。存档 lang 决定输出：bi=中文为主 en=纯英文。
import { getLang } from './save.js';

const DICT = {
  // HUD / 菜单
  'menu.book':    { zh: '课本朗读', en: 'Read Book' },
  'menu.map':     { zh: '游戏地图', en: 'World Map' },
  'menu.catalog': { zh: '词宠图鉴', en: 'Pet Dex' },
  'menu.rank':    { zh: '小小排行', en: 'Ranking' },
  'menu.report':  { zh: '学习周报', en: 'Weekly Report' },
  'menu.dub':     { zh: '小小配音演员', en: 'Dubbing Show' },
  'menu.bgm':     { zh: '音乐：开', en: 'Music: On' },
  'menu.bgmOff':  { zh: '音乐：关', en: 'Music: Off' },
  'menu.help':    { zh: '怎么玩', en: 'How to Play' },
  'menu.about':   { zh: '关于Q淘族', en: 'About' },
  'menu.account': { zh: '我的档案', en: 'My Profile' },
  // 挑战卡
  'ch.feed':      { zh: '🍖 词宠饿啦，喊它的名字喂它', en: '🍖 Your pet is hungry! Call its name to feed it' },
  'ch.practice':  { zh: '📖 跟读练习 · 大声读给词宠听', en: '📖 Read-aloud · Read to your pet' },
  'ch.review':    { zh: '🔁 复习蛋 · 大声读一遍就唤醒', en: '🔁 Review egg · Read once to wake it' },
  'ch.hatch':     { zh: '🥚 遇见词宠蛋！念出单词唤醒它', en: '🥚 A word egg! Read the word to hatch it' },
  'ch.play':      { zh: '🔊 听一听', en: '🔊 Listen' },
  'ch.micGo':     { zh: '点我开始读', en: 'Tap to read' },
  'ch.micRec':    { zh: '读完点这里 {n}s', en: 'Tap when done {n}s' },
  'ch.fail':      { zh: '🎤 语音启动失败，改用字母块拼吧', en: '🎤 Voice failed — spell it with letters' },
  'ch.micReady':  { zh: '🎤 就绪！点我开始读', en: '🎤 Ready! Tap to read' },
  'ch.micLoad':   { zh: '🚀 语音引擎准备中…', en: '🚀 Voice engine loading…' },
  'ch.micLoadPct':{ zh: '🚀 语音引擎准备中 {pct}%', en: '🚀 Voice engine loading {pct}%' },
  'ch.micSlow':   { zh: '📡 网络有点慢，稍等或先拼字母块', en: '📡 Slow network — wait, or spell it out' },
  'ch.spell':     { zh: '🧩 换成拼字母块', en: '🧩 Spell with letters' },
  'ch.listen':    { zh: '● 开口大声读！{n} 秒内读完会自动识别', en: "● Read out loud! Auto-detected within {n}s" },
  'ch.recognize': { zh: '识别中…', en: 'Recognizing…' },
  'ch.reRead':    { zh: '没听清，再大声读一次～', en: "Didn't catch it — read again!" },
  'ch.retry':     { zh: '差一点点！再读一次', en: 'So close! Try again' },
  // 任务气泡 / 引导
  'q.step1': { zh: '🥚 第1步：走到发光的词宠蛋边！', en: '🥚 Step 1: Walk to the glowing egg!' },
  'q.step2': { zh: '🎤 第2步：大声读出单词，唤醒它！', en: '🎤 Step 2: Read the word out loud to hatch it!' },
  'q.step3': { zh: '🐾 第3步：走近你的词宠，摸摸头认识它！', en: '🐾 Step 3: Walk up to your pet and say hi!' },
  'q.egg':   { zh: '🥚 朝着发光的词宠蛋走过去，孵化它！', en: '🥚 Walk to the glowing egg and hatch it!' },
  'q.hungry':{ zh: '🍖 「{en}」饿啦——跟着箭头去喂它！', en: '🍖 "{en}" is hungry — follow the arrow to feed it!' },
  'q.done':  { zh: '找到本关剩下的词宠蛋，全部唤醒就过关啦！', en: 'Hatch all the remaining eggs to clear this level!' },
  'q.left':  { zh: '第 {n} 关「{name}」：还剩 {left} 个单词就通关！（本册 {done}/{total}）', en: 'Level {n} "{name}": {left} words to go! ({done}/{total})' },
  // 每日任务 / 成就
  'daily.head':  { zh: '📌 今日任务', en: '📌 Daily Quest' },
  'daily.done':  { zh: '🎉 已完成！奖励已到手', en: '🎉 Complete! Reward claimed' },
  'daily.progress': { zh: '进度 {n}/{goal} · 完成奖 ⭐5', en: 'Progress {n}/{goal} · Reward ⭐5' },
  'daily.tip':   { zh: '每天来任务板看看，任务会换新的哦～', en: 'New quests every day — check back tomorrow!' },
  'ach.head':    { zh: '🏆 成就墙', en: '🏆 Achievements' },
  // 城市卡 / 火车 / NPC
  'cc.go':       { zh: '出发探索 →', en: 'Start Exploring →' },
  'cc.share':    { zh: '📸 分享卡', en: '📸 Share Card' },
  'cc.foods':    { zh: '来到{city}，一定要尝尝这些特色美味：', en: 'Must-try foods in {city}:' },
  'cc.scenes':   { zh: '{city}的风景名胜：', en: 'Famous sights in {city}:' },
  'cc.stamp':    { zh: '🏅 景点集章 {n}/{total} · 点一点盖上纪念章', en: '🏅 Stamps {n}/{total} · tap to collect' },
  'cc.stampDone':{ zh: '🏅 景点集章 {n}/{total} · 全部完成！', en: '🏅 Stamps {n}/{total} · complete!' },
  'cc.quizOk':   { zh: '答对啦 +1⭐', en: 'Correct! +1⭐' },
  'cc.quizRetry':{ zh: '再想一想～', en: 'Think again~' },
  'train.go':    { zh: '选一座城出发 🚂', en: 'Pick a city 🚂' },
  'train.title': { zh: '🚂 开往哪座城？', en: '🚂 Which city next?' },
  'quiz.q':      { zh: '车上小问答：{q}', en: '🚄 Train quiz: {q}' },
  'quiz.ok':     { zh: '答对啦 +1⭐', en: 'Correct! +1⭐' },
  'quiz.answer': { zh: '正确答案：{a}', en: 'Correct answer: {a}' },
  // 档案 / 设置
  'prof.city':    { zh: '我的城市', en: 'My City' },
  'prof.grade':   { zh: '选择年级', en: 'Grade' },
  'prof.term':    { zh: '选择上下册', en: 'Term' },
  'prof.lang':    { zh: '文案语言', en: 'Language' },
  'prof.langBi':  { zh: '中英双语', en: 'English + 中文' },
  'prof.langEn':  { zh: '纯英语', en: 'English only' },
  'prof.start':   { zh: '出发去Q淘族', en: "Let's Go!" },
  'prof.save':    { zh: '保存', en: 'Save' },
  'prof.login':   { zh: '登录', en: 'Sign In' },
  'prof.switch':  { zh: '我已有账号，去登录', en: 'I have an account — Sign In' },
  'prof.switchReg': { zh: '我是新同学，去注册', en: "I'm new — Register" },
  'prof.name':    { zh: '先写一个名字哦～', en: 'Write a name first~' },
  'prof.pickGrade': { zh: '请选择你的年级', en: 'Pick your grade' },
  'prof.pickTerm':  { zh: '请选择上册或下册', en: 'Pick a term' },
  // 称号 / 商店
  'shop.head':   { zh: '到许愿井换新装扮', en: 'Wishing Well — new outfits' },
  'shop.bought': { zh: '🎉 买到了{emoji}{name}！马上穿上试试', en: '🎉 Bought {emoji}{name}! Try it on now' },
  'shop.poor':   { zh: '星星还不够啦，去读单词赚星星吧！', en: 'Not enough stars — earn more by reading!' },
};

export function t(key, vars) {
  let s = dictGet(key) ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
// 双语模式输出 "zh / en"，纯英模式只出 en；用于并列展示型文案
export function tb(key, vars) {
  if (getLang() === 'en') return t(key, vars);
  let s = _merged.zh[key] ?? DICT[key]?.zh ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
export function isEn() { return getLang() === 'en'; }

// ---------- 词典资源化：从 data/i18n/ 拉取 zh/en 资源合并覆盖内置兜底 ----------
const _merged = { zh: {}, en: {} };
export function initI18n() {
  const load = f => fetch(`data/i18n/${f}.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  return Promise.all([load('ui.zh'), load('ui.en')]).then(([zh, en]) => {
    if (zh) Object.assign(_merged.zh, zh);
    if (en) Object.assign(_merged.en, en);
    _merged.loaded = true;
    dispatchEvent(new Event('i18n-ready'));
    return true;
  }).catch(() => false);
}
export function isI18nLoaded() { return !!_merged.loaded; }
function dictGet(key) {
  const lang = getLang();
  if (lang === 'en') return _merged.en[key] ?? DICT[key]?.en;
  return _merged.zh[key] ?? DICT[key]?.zh;
}
