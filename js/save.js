// 存档：localStorage + 遗忘曲线状态 + 星星/装扮/每日任务
import { FEED_INTERVALS } from './words.js';

const KEY = 'wordpet_save_v1';
const BACKUP_KEY = 'wordpet_save_v1_backup';   // 主键写坏/超限时的兜底副本

// 每日任务池：按日期轮换，完成奖 5 颗星星
// 文案（zh/en）在 data/i18n/ui.*.json 的 daily.<id> 键；这里只存玩法数值
export const DAILY_QUESTS = [
  { id: 'feed2', goal: 2 },
  { id: 'hatch2', goal: 2 },
  { id: 'gate1', goal: 1 },
  { id: 'goodread', goal: 1 },
  { id: 'summon3', goal: 3 },
  { id: 'read2', goal: 2 },
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fresh() {
  return {
    pets: {},          // id -> { hatchedAt, fedAt, feedStage, feeds }
    gates: {},         // boat / light / wind / beanstalk / sandWall / vines
    visited: [],       // 去过的区域
    player: null,      // 上次位置 {x,y,z,yaw,camYaw,isle}
    book: { sem: null, units: {} }, // 课本：选中学期 + 单元成绩 {'3a#0': {scores:[..], done:true}}
    intro: false,
    playSeconds: 0,
    profile: { username: '', password: '', registered: false, score: 0, sessionScore: 0, gender: 'boy', stars: 0, city: 'beijing', token: '',
      wear: { hat: '', hatOwned: [], balloon: false, balloonOwned: false, wand: false, wandOwned: false, title: '', titleOwned: [] },
      lang: 'bi',        // 文案语言：bi=中英双语（默认） en=纯英语
    },
    daily: { day: '', idx: 0, n: 0, done: false },
    milestones: {},    // 已领取的里程碑（collect1=孵满10只、enrolled3b=换过这册）
    weekly: [],        // 家长周报流水：{t: 时间戳, s: 朗读分} / {t, h:1 孵化}，只留最近 7 天
    naughty: {},       // 错词本：wordId -> {misses, lastMiss, caughtOn}，读错的词隔天变"淘气词宠"回来复习
    cityVisits: {},    // 城市到访次数：id -> 次数（决定介绍版本，常来常新）
    guideDone: false,  // 新手引导 3 步（走到蛋边→读单词→摸摸词宠）完成过没有
    badges: {},        // 徽章：key -> true（小导游 guide:<城市> 等）
    stamps: {},        // 景点集章：<城市en> -> { got:[景点名], done:false }
    npcChatDay: '',    // 最近一次和 NPC 聊天之日（隔日重逢问候用）
    dubCount: 0,       // 完成的配音作品数
    streak: { day: '', n: 0, rewarded: {} },  // 连续打卡：day=最后游玩日 n=连击数 rewarded={3:true,7:true} 已领奖的里程碑
    lastQuizDay: '',   // 最近一次错词周测之日（每周日且距上次 ≥7 天才提醒）
  };
}

let data = load();
let lastGoodJson = null;   // 最近一次成功落盘序列化快照：写入失败时留作回滚/兜底备份

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw);
    try { lastGoodJson = JSON.stringify(d); } catch (e) { /* 旧档不可序列化：仅内存使用 */ }
    // 兜底备份：主键写坏/超限时还能从 BACKUP_KEY 恢复（本地也留一份，离线不丢档）
    try { if (!localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, lastGoodJson); } catch (e) { /* ignore */ }
    // 深度合并 + 兼容旧版本存档（缺字段自动补齐）
    const merged = Object.assign(fresh(), d);
    merged.pets = d.pets || {};
    merged.gates = d.gates || {};
    merged.visited = d.visited || [];
    merged.book = Object.assign({ sem: null, units: {} }, d.book || {});
    merged.profile = Object.assign(fresh().profile, d.profile || {});
    merged.profile.wear = Object.assign(fresh().profile.wear, d.profile?.wear || {});
    if (!merged.profile.gender) merged.profile.gender = 'boy'; // 老存档没有性别字段 → 默认男孩
    if (typeof merged.profile.stars !== 'number') merged.profile.stars = 0;
    // 老存档没有密码字段：留空即可（密码允许为空）
    if (typeof merged.profile.password !== 'string') merged.profile.password = '';
    if (typeof merged.profile.token !== 'string') merged.profile.token = '';   // 在线会话令牌（单点登录）
    // 是否已建过档案（用来决定是否直接续玩）；老存档默认 false，下次填一次名字即可
    if (typeof merged.profile.registered !== 'boolean') merged.profile.registered = false;
    if (merged.profile.lang !== 'en') merged.profile.lang = 'bi';
    merged.milestones = d.milestones || {};
    merged.weekly = Array.isArray(d.weekly) ? d.weekly : [];
    merged.naughty = d.naughty || {};
    merged.cityVisits = d.cityVisits || {};
    merged.guideDone = !!d.guideDone;
    merged.badges = d.badges || {};
    merged.stamps = d.stamps || {};
    merged.npcChatDay = d.npcChatDay || '';
    if (typeof merged.dubCount !== 'number') merged.dubCount = 0;
    merged.streak = Object.assign({ day: '', n: 0, rewarded: {} }, d.streak || {});
    merged.lastQuizDay = d.lastQuizDay || '';
    merged.daily = Object.assign({ day: '', idx: 0, n: 0, done: false }, d.daily || {});
    if (!merged.player) merged.player = null;
    return merged;
  } catch (e) {
    return fresh();
  }
}

// 仅本地落盘（含序列化预检 + 失败回滚 + 备份键同步），不触发推送
function persistLocal() {
  let json = null;
  try { json = JSON.stringify(data); } catch (e) { /* 存档含不可序列化数据：保留上次快照，至少不写坏 */ }
  if (json == null) return;
  try {
    localStorage.setItem(KEY, json);
    lastGoodJson = json;
    // 备份键同步：主键与备份保持一致，写坏任一个都能从另一个恢复
    try { localStorage.setItem(BACKUP_KEY, json); } catch (e) { /* ignore */ }
  } catch (e) {
    // 主键写入失败（超限/隐身模式）：尝试回滚到上次成功快照，避免半写状态
    try { if (lastGoodJson != null) localStorage.setItem(KEY, lastGoodJson); } catch (e2) { /* ignore */ }
  }
}

export function save() {
  persistLocal();
  localDirty = true;
  schedulePush();
}

// ---------- 跨设备存档同步：本地与服务器双写，同用户名换设备登录拉回全部进度 ----------
let pushTimer = null;
let lastPush = 0;
let localDirty = false;   // 有实质进度变化待推送（纯位置移动不置位）
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushSaveNow, 3000);   // 防抖：一波操作只推一次
}
// 静默上传完整存档（离线/静态站失败就留本地，下次再推）
// 安全：不上传密码/会话令牌/当前位置字段——鉴权只靠服务端会话令牌（token），
// 密码只在注册/登录/改密/上线时单向验证，存档内容永远不再带明文密码过网络。
export function pushSaveNow() {
  const p = data.profile;
  if (!p.registered || !p.username) return;
  if (!localDirty) return;                      // 没有实质进度变化（纯位置移动）不推
  if (Date.now() - lastPush < 10000) return;   // 至少间隔 10 秒
  lastPush = Date.now();
  const payload = sanitizeForUpload(data);
  localDirty = false;
  try {
    fetch('/api/push-save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ username: p.username, token: p.token, save: payload }),
    }).catch(() => { localDirty = true; });     // 失败：下次再推
  } catch (e) { localDirty = true; }
}
// 上传前脱敏：密码/会话令牌/当前位置只留在本机，不上服务器
function sanitizeForUpload(d) {
  const copy = JSON.parse(JSON.stringify(d));
  if (copy.profile) {
    delete copy.profile.password;
    delete copy.profile.token;
  }
  copy.player = null;   // 位置属于本机会话，不跨设备
  return copy;
}
// 登录时拉取服务器存档并与本地合并（换设备不丢词宠/星星/进度）；返回是否拉到了
export async function pullSave() {
  const p = data.profile;
  if (!p.registered || !p.username) return false;
  try {
    const res = await fetch('/api/pull-save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: p.username, password: p.password, token: p.token }),
    });
    if (res.status === 401) { _kicked(); return false; }   // 已被同名新登录顶下线
    if (!res.ok) return false;
    const out = await res.json();
    if (!out.save || typeof out.save !== 'object') return false;
    mergeSave(out.save);
    save();
    return true;
  } catch (e) { return false; }
}
// 合并策略：两边都不丢——词宠并集（同 id 取更早孵化时间+喂养进度多的一边）、
// 机关/区域/课本成绩并集、分数/星星取较大值、装扮并集
function mergeSave(r) {
  for (const [id, pet] of Object.entries(r.pets || {})) {
    const local = data.pets[id];
    if (!local) data.pets[id] = pet;
    else {
      local.hatchedAt = Math.min(local.hatchedAt || 0, pet.hatchedAt || 0);
      if ((pet.feeds || 0) > (local.feeds || 0)) {
        local.feeds = pet.feeds; local.feedStage = pet.feedStage; local.fedAt = pet.fedAt;
      }
    }
  }
  data.gates = Object.assign({}, r.gates || {}, data.gates);
  data.visited = [...new Set([...(r.visited || []), ...(data.visited || [])])];
  data.book.units = Object.assign({}, r.book?.units || {}, data.book.units);
  if (!data.book.sem && r.book?.sem) data.book.sem = r.book.sem;
  // 分数/星星取较大值：本地更高时保留本地（下次 push 上送），避免「低分盖高分」
  const mergedScore = Math.max(getScore(), Number(r.profile?.score) || 0);
  data.profile.score = Math.floor(mergedScore);
  data.profile.stars = Math.max(getStars(), Number(r.profile?.stars) || 0);
  const rw = r.profile?.wear || {};
  data.profile.wear.hatOwned = [...new Set([...(rw.hatOwned || []), ...(data.profile.wear.hatOwned || [])])];
  if (rw.balloonOwned) data.profile.wear.balloonOwned = true;
  if (rw.wandOwned) data.profile.wear.wandOwned = true;
  if (!data.profile.wear.hat && rw.hat) data.profile.wear.hat = rw.hat;
  if (r.profile?.city) data.profile.city = r.profile.city;
  if (r.intro) data.intro = true;
  data.milestones = Object.assign({}, r.milestones || {}, data.milestones);
  // 周报流水并集去重（按时间戳+内容）
  const seen = new Set((data.weekly || []).map(x => x.t + '|' + (x.s ?? '') + '|' + (x.h ?? '')));
  for (const x of (r.weekly || [])) {
    const k = x.t + '|' + (x.s ?? '') + '|' + (x.h ?? '');
    if (!seen.has(k)) { data.weekly.push(x); seen.add(k); }
  }
  pruneWeekly();
}

// ---------- 错词本：读错的词变"淘气词宠"，隔天回来抓住它=复习 ----------
export function markNaughty(id) {
  if (!id) return;
  const d = data.naughty = data.naughty || {};
  const rec = d[id] = d[id] || { misses: 0, lastMiss: '', caughtOn: '' };
  rec.misses++;
  rec.lastMiss = todayKey();
  save();
}
// 今日淘气词宠：从历史错词里随机挑一个（今天刚读错的除外，明天才回来）
export function pickNaughtyToday() {
  const d = data.naughty = data.naughty || {};
  const today = todayKey();
  if (d._todayId) {
    const rec = d[d._todayId];
    if (rec && rec.caughtOn !== today) return d._todayId;   // 今天的还在逃
    delete d._todayId;
  }
  const cand = Object.keys(d).filter(id =>
    id !== '_todayId' && d[id].misses >= 1
    && (d[id].caughtOn || '') !== today && (d[id].lastMiss || '') !== today);
  if (!cand.length) return null;
  const id = cand[Math.floor(Math.random() * cand.length)];
  d._todayId = id;
  save();
  return id;
}
export function catchNaughty(id) {
  const d = data.naughty || {};
  if (d[id]) d[id].caughtOn = todayKey();
  if (d._todayId === id) delete d._todayId;
  save();
}

// ---------- 家长周报数据：按天记朗读分与孵蛋数，只留最近 7 天 ----------
function pruneWeekly() {
  const cutoff = Date.now() - 7 * 86400000;
  data.weekly = (data.weekly || []).filter(x => x.t >= cutoff);
}
export function logWeeklyScore(score) {
  data.weekly = data.weekly || [];
  data.weekly.push({ t: Date.now(), s: Math.max(0, Math.min(100, Math.round(score))) });
  pruneWeekly();
  save();
}
export function logWeeklyHatch() {
  data.weekly = data.weekly || [];
  data.weekly.push({ t: Date.now(), h: 1 });
  pruneWeekly();
  save();
}
export function getWeeklyReport() {
  data.weekly = data.weekly || [];
  pruneWeekly();
  const scores = data.weekly.filter(x => typeof x.s === 'number').map(x => x.s);
  const days = {};
  for (const x of data.weekly) {
    const d = new Date(x.t);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    days[key] = days[key] || { reads: 0, hatches: 0, sum: 0 };
    if (typeof x.s === 'number') { days[key].reads++; days[key].sum += x.s; }
    if (x.h) days[key].hatches++;
  }
  return {
    reads: scores.length,
    avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    best: scores.length ? Math.max(...scores) : 0,
    hatches: data.weekly.filter(x => x.h).length,
    days,
    playMinutes: Math.round((data.playSeconds || 0) / 60),
    totalPets: Object.keys(data.pets).length,
  };
}

// ---------- 收集里程碑：每孵满 10 只词宠解锁一份礼物（全有时送星星） ----------
export function checkCollectReward() {
  const count = Object.keys(data.pets).length;
  const step = Math.floor(count / 10);
  if (step < 1) return null;
  data.milestones = data.milestones || {};
  if (data.milestones['collect' + step]) return null;
  data.milestones['collect' + step] = true;
  const wear = data.profile.wear;
  wear.hatOwned = wear.hatOwned || [];
  let gift = null;
  if (!wear.hatOwned.includes('wizard')) { wear.hatOwned.push('wizard'); gift = { emoji: '🎩', name: '魔法师帽' }; }
  else if (!wear.hatOwned.includes('flower')) { wear.hatOwned.push('flower'); gift = { emoji: '👑', name: '花朵王冠' }; }
  else if (!wear.balloonOwned) { wear.balloonOwned = true; gift = { emoji: '🎈', name: '红气球' }; }
  else if (!wear.wandOwned) { wear.wandOwned = true; gift = { emoji: '🪄', name: '星星魔法棒' }; }
  if (!gift) { data.profile.stars += 5; gift = { emoji: '⭐', name: '5 颗星星' }; }
  save();
  return { count, gift };
}

// 换册入学仪式：每个学期只在第一次进岛时欢迎一次；返回是否该办仪式
export function markEnrolled(sem) {
  data.milestones = data.milestones || {};
  const key = 'enrolled' + sem;
  if (data.milestones[key]) return false;
  data.milestones[key] = true;
  save();
  return true;
}

export function getSave() { return data; }

export function isHatched(id) { return !!data.pets[id]; }

export function hatch(id) {
  const now = Date.now();
  data.pets[id] = { hatchedAt: now, fedAt: now, feedStage: 0, feeds: 0 };
  (data.weekly = data.weekly || []).push({ t: now, h: 1 });
  save();
}

// 距离下次该喂养的剩余时间（<0 表示已经饿了）
export function hungryIn(id) {
  const p = data.pets[id];
  if (!p) return Infinity;
  const interval = FEED_INTERVALS[Math.min(p.feedStage, FEED_INTERVALS.length - 1)];
  return p.fedAt + interval - Date.now();
}

export function isHungry(id) { return hungryIn(id) < 0; }

// ---------- 新手引导：第一次玩的孩子走完 3 步就算出师 ----------
export function isGuideDone() { return !!data.guideDone; }
export function markGuideDone() { data.guideDone = true; save(); }

// ---------- 小导游徽章 / 景点集章 ----------
export function hasBadge(key) { return !!data.badges[key]; }
export function awardBadge(key) { if (!data.badges[key]) { data.badges[key] = true; save(); } }
export function getStamps(cityEn) {
  const s = data.stamps[cityEn];
  return s ? s.got.slice() : [];
}
export function isStampsDone(cityEn) { return !!(data.stamps[cityEn] && data.stamps[cityEn].done); }
export function addStamp(cityEn, name) {
  const s = data.stamps[cityEn] || (data.stamps[cityEn] = { got: [], done: false });
  if (!s.got.includes(name)) { s.got.push(name); save(); }
  return s.got.length;
}
export function markStampsDone(cityEn) {
  const s = data.stamps[cityEn];
  if (s && !s.done) { s.done = true; save(); }
}

// ---------- 连续打卡：每天第一次进游戏算一天，断了从 1 重来 ----------
export function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const s = data.streak;
  if (s.day === today) return { n: s.n, newMilestone: null };   // 今天已记过
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  s.n = s.day === yest ? s.n + 1 : 1;   // 昨天玩过 → 连击+1；断了从 1 开始
  s.day = today;
  // 连击里程碑奖励：3 天 +3⭐、7 天 +7⭐、14 天 +14⭐（每个档只领一次）
  let newMilestone = null;
  for (const m of [3, 7, 14, 30]) {
    if (s.n >= m && !s.rewarded[m]) {
      s.rewarded[m] = true;
      const bonus = { 3: 3, 7: 7, 14: 14, 30: 30 }[m];
      const p = data.profile;
      p.stars = (p.stars || 0) + bonus;
      newMilestone = { days: m, bonus };
      break;
    }
  }
  save();
  return { n: s.n, newMilestone };
}
export function getStreak() { return data.streak; }

// ---------- 错词周测：错词本取词，拼写选择三题 ----------
export function isQuizDay() {   // 今天是周日且距上次测验 ≥7 天
  const today = new Date();
  if (today.getDay() !== 0) return false;
  if (!data.lastQuizDay) return true;
  return (Date.now() - new Date(data.lastQuizDay + 'T00:00:00').getTime()) >= 6 * 86400000;
}
export function getNaughtyForQuiz(limit = 3) {   // 错得最多的词优先
  return Object.entries(data.naughty)
    .sort((a, b) => (b[1].misses || 0) - (a[1].misses || 0))
    .slice(0, limit)
    .map(([id]) => id);
}
export function markQuizDone() { data.lastQuizDay = new Date().toISOString().slice(0, 10); save(); }

// ---------- NPC 记忆：今天第一次和 NPC 聊天 = 隔日重逢，问候语加"欢迎回来" ----------
export function markNpcChat() {
  const today = todayKey();
  const yesterday = data.npcChatDay;
  data.npcChatDay = today;
  save();
  return !!yesterday && yesterday !== today;   // 首次 ever 返回 false，隔日重逢返回 true
}

// ---------- 成就墙：过程性目标（只展示不发星星，避免通胀） ----------
// 文案（zh/en）在 data/i18n/ui.*.json 的 ach.<id>.name / ach.<id>.desc 键；这里只存玩法数值
export const ACHIEVEMENTS = [
  { id: 'cities10', icon: '🏙️', goal: 10, stat: 'cities' },
  { id: 'stamps5', icon: '🏅', goal: 5, stat: 'stamps' },
  { id: 'hatch30', icon: '🧺', goal: 30, stat: 'hatched' },
  { id: 'guide3', icon: '🎖️', goal: 3, stat: 'guides' },
  { id: 'dub3', icon: '🎬', goal: 3, stat: 'dubs' },
];
export function achievementProgress() {
  const cities = new Set(Object.keys(data.cityVisits || {}).map(k => k.split(':')[1])).size;
  const stats = {
    cities,
    stamps: Object.keys(data.stamps || {}).filter(k => data.stamps[k].done).length,
    hatched: Object.keys(data.pets || {}).length,
    guides: Object.keys(data.badges || {}).filter(k => k.startsWith('guide:')).length,
    dubs: data.dubCount || 0,
  };
  return ACHIEVEMENTS.map(a => ({ ...a, n: Math.min(stats[a.stat] || 0, a.goal), done: (stats[a.stat] || 0) >= a.goal }));
}
// 整部配音完成计数
export function bumpDub() { data.dubCount = (data.dubCount || 0) + 1; save(); }
// 让词宠立刻进入"想你"状态（通关唤醒复习用）：fedAt 倒拨一个完整间隔
export function makeHungry(id) {
  const p = data.pets[id];
  if (!p || isHungry(id)) return;
  const interval = FEED_INTERVALS[Math.min(p.feedStage, FEED_INTERVALS.length - 1)];
  p.fedAt = Date.now() - interval - 60000;
  save();
}
// 错峰：把已饿的词宠往后推 delaySec 秒再“想你”。自然饥饿是批次性的（首喂间隔才 10 分钟），
// 不封顶的话全城词宠会同时饿，一起冲着小主人冒泡泡
export function snoozeHungry(id, delaySec) {
  const p = data.pets[id];
  if (!p || !isHungry(id)) return;
  const interval = FEED_INTERVALS[Math.min(p.feedStage, FEED_INTERVALS.length - 1)];
  p.fedAt = Date.now() + delaySec * 1000 - interval;
  save();
}
// 周报附加统计：集章/徽章/配音
export function extraStats() {
  return {
    stampsDone: Object.keys(data.stamps || {}).filter(k => data.stamps[k].done).length,
    guides: Object.keys(data.badges || {}).filter(k => k.startsWith('guide:')).length,
    dubs: data.dubCount || 0,
  };
}

export function feed(id) {
  const p = data.pets[id];
  if (!p) return;
  p.feedStage = Math.min(p.feedStage + 1, FEED_INTERVALS.length - 1);
  p.fedAt = Date.now();
  p.feeds += 1;
  save();
}

export function hungryPets() {
  return Object.keys(data.pets).filter(isHungry);
}

// 园丁猫头鹰的每日任务链：三步（孵化/喂食/召唤），每步 +2⭐，全部完成 +4⭐
export function getChain() {
  const today = todayKey();
  if (!data.chain || data.chain.day !== today) data.chain = { day: today, step: 0, n: 0, done: false };
  return data.chain;
}
const CHAIN_TASKS = [['hatch', 1], ['feed', 1], ['summon', 1]];
export function bumpChain(task, n = 1) {
  const c = getChain();
  if (c.done) return null;
  const [needId, needN] = CHAIN_TASKS[c.step] || [null, 0];
  if (task !== needId) return null;
  c.n += n;
  if (c.n >= needN) {
    c.step += 1;
    c.n = 0;
    if (c.step >= CHAIN_TASKS.length) { c.done = true; save(); return { done: true }; }
    save();
    return { step: true };
  }
  save();
  return { progress: true };
}

// 稀有词宠（95 分孵化）与进化形态标记
export function markRare(id) {
  if (data.pets[id] && !data.pets[id].rare) { data.pets[id].rare = true; save(); }
}
export function markEvolved(id) {
  if (data.pets[id] && !data.pets[id].evo) { data.pets[id].evo = true; save(); }
}

export function hatchedCount() { return Object.keys(data.pets).length; }

export function setGate(name) { data.gates[name] = true; save(); }
export function hasGate(name) { return !!data.gates[name]; }

export function addVisited(zone) {
  if (data.visited.includes(zone)) return false;
  data.visited.push(zone);
  save();
  return true;
}
export function getVisited() { return data.visited; }

// 位置存档：只写本地，不上传服务器（换设备不需要恢复"站哪"；也避免 3 秒一次的推送放大）
export function savePlayer(p) { data.player = p; persistLocal(); }
export function getPlayer() { return data.player; }

export function setBookSem(sem) { data.book.sem = sem; save(); }
export function getBookSem() { return data.book.sem; }
export function saveUnitResult(key, scores) {
  data.book.units[key] = { scores, done: scores.length > 0 };
  save();
}
export function getUnitResult(key) { return data.book.units[key]; }

export function setIntro(v) { data.intro = v; save(); }
export function getIntro() { return data.intro; }

export function addPlaySeconds(s) { data.playSeconds += s; save(); }

export function getUsername() { return data.profile.username || ''; }
// 家乡城市：城市巡游的起点（IP 定位或档案卡选择）
export function getHomeCity() { return data.profile.city || 'chengdu'; }   // 首次未定位到城市默认成都
export function hasHomeCity() { return !!data.profile.city; }
export function setHomeCity(id) { data.profile.city = id || 'chengdu'; save(); }
// 城市到访计数：返回本次是第几次到（0 起）——决定介绍版本
export function visitCity(id) {
  data.cityVisits = data.cityVisits || {};
  const v = data.cityVisits[id] || 0;
  data.cityVisits[id] = v + 1;
  save();
  return v;
}
export function getScore() { return Number(data.profile.score) || 0; }
export function getSessionScore() { return Number(data.profile.sessionScore) || 0; }
// 登录时用服务端分数补上本机（换设备登录时本地是 0，但账号其实有分）；只升不降，避免抹掉离线攒的分
export function syncScore(serverScore) {
  const n = Number(serverScore);
  if (!Number.isFinite(n) || n <= getScore()) return;
  data.profile.score = Math.floor(n);
  save();
}
export function setUsername(name) {
  data.profile.username = String(name || '').trim().slice(0, 20);
  save();
}
export function getGender() { return data.profile.gender === 'girl' ? 'girl' : 'boy'; }
export function setGender(g) {
  data.profile.gender = g === 'girl' ? 'girl' : 'boy';
  save();
}
export function getPassword() { return data.profile.password || ''; }
export function setPassword(pwd) { data.profile.password = String(pwd || ''); save(); }
export function isRegistered() { return !!data.profile.registered; }
export function setRegistered(v) { data.profile.registered = !!v; save(); }

// ---------- 文案语言 ----------
export function getLang() { return data.profile.lang === 'en' ? 'en' : 'bi'; }
export function setLang(l) { data.profile.lang = l === 'en' ? 'en' : 'bi'; save(); }

// 每完成一个学习挑战加 1 分；本地先记账，联网时再同步到排行榜服务。
// 称号展示名（许愿井购买后亮在排行榜名字旁）
export const TITLE_NAMES = {
  explorer: '小小探险家',
  star: '朗读之星',
  legend: '淘气传奇',
};
export function addPoint() {
  if (!data.profile.username) return;
  data.profile.score = getScore() + 1;
  data.profile.sessionScore = getSessionScore() + 1;
  save();
  // 还没建档案就只记本地分；有档案（哪怕密码为空）才同步给排行榜
  if (!data.profile.registered) return;
  const body = JSON.stringify(rankBody(1));
  try {
    fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (e) { /* 静态站点或离线时保留本地积分 */ }
}
// 多维榜上报体：分数增量 + 词宠/城市/星星最新值
function rankBody(delta) {
  const cities = new Set(Object.keys(data.cityVisits || {}).map(k => k.split(':')[1])).size;
  return {
    username: data.profile.username, password: data.profile.password, delta, gender: getGender(),
    title: TITLE_NAMES[data.profile.wear.title] || '',
    pets: Object.keys(data.pets || {}).length,
    cities,
    stars: getStars(),
  };
}
// 登录/换设备后补一次档案同步（delta 0：只刷新多维字段，不动分数）
export function syncRank() {
  if (!data.profile.username || !data.profile.registered) return;
  try {
    fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rankBody(0)), keepalive: true }).catch(() => {});
  } catch (e) { /* 离线忽略 */ }
}

export function resetSessionScore() { data.profile.sessionScore = 0; save(); }

// ---------- 星星经济 ----------
export function getStars() { return Number(data.profile.stars) || 0; }
export function addStars(n) {
  data.profile.stars = Math.max(0, getStars() + n);
  save();
  return data.profile.stars;
}
export function spendStars(n) {
  if (getStars() < n) return false;
  data.profile.stars = getStars() - n;
  save();
  return true;
}

// ---------- 装扮（许愿井商店） ----------
export function getWear() { return data.profile.wear; }
export function updateWear(patch) {
  Object.assign(data.profile.wear, patch);
  save();
  return data.profile.wear;
}

// ---------- 每日任务 ----------
export function getDaily() {
  const today = todayKey();
  if (data.daily.day !== today) {
    // 跨天：轮换到下一个小任务，进度清零
    const idx = data.daily.day ? (data.daily.idx + 1) % DAILY_QUESTS.length
      : Math.floor(Math.abs(new Date().getTimezoneOffset() + new Date().getDate() * 7)) % DAILY_QUESTS.length;
    data.daily = { day: today, idx, n: 0, done: false };
    save();
  }
  return { ...DAILY_QUESTS[data.daily.idx], n: data.daily.n, done: data.daily.done, key: data.daily.idx };
}
// 推进度：命中今日任务类型才计数；刚完成时自动发 5 颗星星。返回 'done' | 'progress' | null
export function bumpDaily(id, n = 1) {
  const q = DAILY_QUESTS[data.daily.idx];
  if (!q || q.id !== id || data.daily.done) return null;
  data.daily.n += n;
  let result = 'progress';
  if (data.daily.n >= q.goal) {
    data.daily.done = true;
    addStars(5);
    result = 'done';
  }
  save();
  return result;
}
// 模式不适配的任务换掉：城市巡游没有机关谜题，gate1 换成跟读任务（进度清零重计）
export function swapDaily(id) {
  const idx = DAILY_QUESTS.findIndex(q => q.id === id);
  if (idx < 0 || idx === data.daily.idx) return;
  data.daily.idx = idx;
  data.daily.n = 0;
  data.daily.done = false;
  save();
}

export function resetSave() { data = fresh(); persistLocal(); }

// ---------- 单点登录：同账号只允许一处在线，后登录顶掉先登录 ----------
let kickCb = null;
let hbTimer = null;

export function setToken(t) {
  data.profile.token = typeof t === 'string' ? t : '';
  save();
}
export function getToken() { return data.profile.token || ''; }

// 被顶下线：清会话 → 存档保留但视为未登录 → 通知 main 弹注册/登录对话框
function _kicked() {
  stopHeartbeat();
  data.profile.token = '';
  data.profile.registered = false;
  persistLocal();
  if (kickCb) kickCb();
}
export function onKick(cb) { kickCb = typeof cb === 'function' ? cb : null; }

// 游戏开始后开启心跳（10 秒/次）；同名账号在别处登录 → 服务端 401 → 弹登录框
export function startHeartbeat() {
  const p = data.profile;
  if (!p.registered || !p.username || !p.token) return;   // 没令牌（老存档/离线）不心跳
  if (hbTimer) return;
  hbTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: p.username, token: p.token }),
      });
      if (res.status === 401) _kicked();
    } catch (e) { /* 离线：心跳失败不下线，下次再试 */ }
  }, 10000);
}
export function stopHeartbeat() { clearInterval(hbTimer); hbTimer = null; }
