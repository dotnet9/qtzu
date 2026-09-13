// 存档：localStorage + 遗忘曲线状态 + 星星/装扮/每日任务
import { FEED_INTERVALS } from './words.js';

const KEY = 'wordpet_save_v1';

// 每日任务池：按日期轮换，完成奖 5 颗星星
export const DAILY_QUESTS = [
  { id: 'feed2', goal: 2, text: '喂饱 2 只想你的词宠' },
  { id: 'hatch2', goal: 2, text: '孵化 2 颗新词宠蛋' },
  { id: 'gate1', goal: 1, text: '解开 1 个机关谜题' },
  { id: 'goodread', goal: 1, text: '朗读拿到 1 次 95 分以上' },
  { id: 'summon3', goal: 3, text: '召唤 3 次词宠' },
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
    profile: { username: '', password: '', registered: false, score: 0, sessionScore: 0, gender: 'boy', stars: 0, city: 'beijing',
      wear: { hat: '', hatOwned: [], balloon: false, balloonOwned: false, wand: false, wandOwned: false } },
    daily: { day: '', idx: 0, n: 0, done: false },
    milestones: {},    // 已领取的里程碑（collect1=孵满10只、enrolled3b=换过这册）
    weekly: [],        // 家长周报流水：{t: 时间戳, s: 朗读分} / {t, h:1 孵化}，只留最近 7 天
    naughty: {},       // 错词本：wordId -> {misses, lastMiss, caughtOn}，读错的词隔天变"淘气词宠"回来复习
    cityVisits: {},    // 城市到访次数：id -> 次数（决定介绍版本，常来常新）
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw);
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
    // 是否已建过档案（用来决定是否直接续玩）；老存档默认 false，下次填一次名字即可
    if (typeof merged.profile.registered !== 'boolean') merged.profile.registered = false;
    merged.milestones = d.milestones || {};
    merged.weekly = Array.isArray(d.weekly) ? d.weekly : [];
    merged.naughty = d.naughty || {};
    merged.cityVisits = d.cityVisits || {};
    merged.daily = Object.assign({ day: '', idx: 0, n: 0, done: false }, d.daily || {});
    if (!merged.player) merged.player = null;
    return merged;
  } catch (e) {
    return fresh();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 隐身模式等 */ }
  schedulePush();
}

// ---------- 跨设备存档同步：本地与服务器双写，同用户名换设备登录拉回全部进度 ----------
let pushTimer = null;
let lastPush = 0;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushSaveNow, 3000);   // 防抖：一波操作只推一次
}
// 静默上传完整存档（离线/静态站失败就留本地，下次再推）
export function pushSaveNow() {
  const p = data.profile;
  if (!p.registered || !p.username) return;
  if (Date.now() - lastPush < 10000) return;   // 至少间隔 10 秒
  lastPush = Date.now();
  try {
    fetch('/api/push-save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ username: p.username, password: p.password, save: data }),
    }).catch(() => {});
  } catch (e) { /* ignore */ }
}
// 登录时拉取服务器存档并与本地合并（换设备不丢词宠/星星/进度）；返回是否拉到了
export async function pullSave() {
  const p = data.profile;
  if (!p.registered || !p.username) return false;
  try {
    const res = await fetch('/api/pull-save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: p.username, password: p.password }),
    });
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
  if ((r.profile?.score || 0) > getScore()) data.profile.score = Math.floor(r.profile.score);
  if ((r.profile?.stars || 0) > getStars()) data.profile.stars = r.profile.stars;
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
    id !== '_todayId' && d[id].misses >= 2
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

export function savePlayer(p) { data.player = p; save(); }
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

// 每完成一个学习挑战加 1 分；本地先记账，联网时再同步到排行榜服务。
export function addPoint() {
  if (!data.profile.username) return;
  data.profile.score = getScore() + 1;
  data.profile.sessionScore = getSessionScore() + 1;
  save();
  // 还没建档案就只记本地分；有档案（哪怕密码为空）才同步给排行榜
  if (!data.profile.registered) return;
  const body = JSON.stringify({
    username: data.profile.username, password: data.profile.password, delta: 1, gender: getGender(),
  });
  try {
    fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch (e) { /* 静态站点或离线时保留本地积分 */ }
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

export function resetSave() { data = fresh(); save(); }
