// DOM UI：HUD、挑战弹窗（语音+拼块）、召唤、图鉴、引导、提示
import { sfx, speak, speakSlow, speakFollow, spellLetters, stopSpeaking, playRecording, scoreVoice, updateBgm, isBgmMuted, setBgmMuted, setBgmFever, getAccent, setAccent } from './audio.js';
import { voiceSupported, voiceBlockedByInsecure, isVoiceBroken } from './speech.js';
import { CURRICULUM, gradeKey } from './curriculum.js';
import { CITIES } from './cities.js';
import { CHINA_MAINLAND, CHINA_ISLANDS } from './china-base.js';
import { setHomeCity, getHomeCity, hasHomeCity, hatchedCount, getUsername, hasBadge, awardBadge, getStamps, addStamp, isStampsDone, markStampsDone, addStars, getStars } from './save.js';
import { loadAppConfig } from './data.js';

const $ = id => document.getElementById(id);
const els = {};
for (const id of ['loading', 'hud', 'user-pill', 'pet-count', 'score-pill', 'star-pill', 'hungry-pill', 'prompt', 'prompt-key', 'prompt-text',
  'quest', 'quest-text', 'quest-close', 'npc-bubble', 'npc-bubble-text', 'npc-bubble-page', 'npc-bubble-prev', 'npc-bubble-next',
  'menu-score',
  'daily', 'daily-text', 'modal', 'modal-title', 'word-en', 'word-ipa', 'word-zh', 'word-hint', 'btn-play', 'btn-mic',
  'mic-label', 'btn-replay', 'voice-feedback', 'score-panel', 'cheer', 'cheer-emoji', 'cheer-word', 'score-ring', 'score-num', 'score-stars', 'score-msg',
  'pet-fact', 'pet-fact-title', 'pet-fact-text', 'detail-card', 'detail-title', 'detail-body', 'detail-close', 'btn-detail', 'spell-area', 'spell-slots', 'spell-tiles', 'btn-replay-letters', 'btn-show-help-word',
  'btn-skip',
  'btn-switch-spell', 'modal-close', 'modal-foot', 'picker', 'picker-title', 'picker-grid', 'picker-close',
  'catalog', 'catalog-grid', 'catalog-close', 'catalog-pager', 'catalog-prev', 'catalog-next', 'catalog-ind', 'map', 'map-head', 'map-canvas', 'map-close',
  'leaderboard-widget', 'leaderboard-list', 'leaderboard-refresh', 'leaderboard-toggle', 'leaderboard-fold',
  'intro', 'intro-emoji', 'intro-text', 'intro-next',
  'levelup', 'levelup-burst', 'levelup-title', 'levelup-sub', 'levelup-stars', 'levelup-words-tip', 'levelup-words', 'levelup-next',
  'chapter-banner', 'chapter-banner-text',
  'update-bar', 'update-now', 'update-later', 'city-pill', 'city-pill-text',
  'toast', 'btn-catalog', 'btn-help', 'btn-account', 'profile-close', 'profile-logout', 'btn-report',
  'hud-menu', 'btn-menu']) els[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = $(id);

// 音标表（tools/gen_ipa.py 生成，可选：404 时静默跳过）
let ipaMap = null;
fetch('data/ipa.json').then(r => r.ok ? r.json() : null).then(m => ipaMap = m).catch(() => { ipaMap = null; });
export function ipaFor(en) {
  return (ipaMap && ipaMap[String(en).toLowerCase()]) || null;
}

// ---------- 通用 ----------
let toastTimer = null;
export function toast(text, ms = 2800) {
  els.toast.textContent = text;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

let isTouchMode = false;
export function showPrompt(text, key = 'E') {
  let chip = key;
  if (isTouchMode) {
    if (key === 'E') chip = '👆';
    else if (key === 'Tab') chip = '🪄';   // 手机没有 Tab 键，别把电脑按键显示给孩子
  }
  els.promptKey.textContent = chip;
  els.promptText.textContent = ' ' + text;
  els.prompt.classList.remove('hidden');
}
export function hidePrompt() { els.prompt.classList.add('hidden'); }

// 左上角显示当前登录用户名（很窄的手机只留图标，名字进 title/档案卡）
let _userName = '';
function renderUserPill() {
  if (!els.userPill) return;
  const narrow = window.matchMedia && matchMedia('(max-width: 480px)').matches;
  const n = _userName;
  els.userPill.textContent = n ? (narrow ? '👤' : `👤 ${n}`) : '👤';
  els.userPill.classList.toggle('hidden', !n);
  els.userPill.title = n ? `${n} 的学习档案` : '';
}
export function updateUser(name) {
  if (!els.userPill) return;
  _userName = String(name || '').trim();
  renderUserPill();
}
if (window.matchMedia) {
  matchMedia('(max-width: 480px)').addEventListener('change', renderUserPill);
  matchMedia('(max-width: 640px)').addEventListener('change', () => renderPetCount());
}

// 劲舞团式喝彩分级：分数 → (大字, 样式, 配套表情)
const SCORE_LEVELS = [
  [95, 'PERFECT!', 'perfect', '🌟'],
  [85, 'GREAT!', 'great', '🎉'],
  [75, 'COOL!', 'cool', '😎'],
  [60, 'NICE!', 'nice', '😊'],
  [40, 'BAD...', 'bad', '😬'],
  [0, 'MISS...', 'miss', '🙈'],
];

let petDebt = 0;      // 已孵化但奖励还没领取的词宠数（走近它才 +1）
let lastHUD = null;
function renderPetCount() {
  if (!lastHUD) return;
  const shown = Math.max(0, lastHUD.count - petDebt);
  const narrow = window.matchMedia && matchMedia('(max-width: 640px)').matches;
  const chShort = lastHUD.chapterText ? (lastHUD.chapterText.match(/第\d+关/) || [lastHUD.chapterText])[0] : '';
  els.petCount.textContent = (isTouchMode || narrow)
    ? `🐾 ${chShort ? chShort + ' · ' : ''}${shown}/${lastHUD.total}`
    : `🐾 ${lastHUD.chapterText ? lastHUD.chapterText + ' · ' : ''}词宠 ${shown}/${lastHUD.total}`;
}
export function petRewardBegin() { petDebt++; renderPetCount(); }
export function petRewardCollect() {
  petDebt = Math.max(0, petDebt - 1);
  renderPetCount();
  els.petCount.classList.remove('pet-pop-anim');
  void els.petCount.offsetWidth;
  els.petCount.classList.add('pet-pop-anim');
}
export function updateHUD(count, total, hungryCount, chapterText = '') {
  // 手机上横向空间小：去掉可推断的字，只留数字
  lastHUD = { count: Number(count) || 0, total, hungryCount, chapterText };
  renderPetCount();
  const hungry = hungryCount > 0;
  els.hungryPill.classList.toggle('hidden', !hungry);
  els.hungryPill.textContent = isTouchMode ? `🍖 ${hungryCount} 只想你` : `🍖 有 ${hungryCount} 只词宠想你啦`;
  document.body.classList.toggle('has-hungry', hungry);
}

export function hideLoading() {
  els.loading.classList.add('done');
  setTimeout(() => els.loading.classList.add('hidden'), 700);
}

// 星星栏：数值变化时蹦一下
let lastStars = null;
export function updateStars(n) {
  if (!els.starPill) return;
  n = Number(n) || 0;
  if (n !== lastStars && lastStars !== null) {
    els.starPill.classList.remove('star-pop-anim');
    void els.starPill.offsetWidth;
    els.starPill.classList.add('star-pop-anim');
  }
  lastStars = n;
  els.starPill.textContent = `⭐ ${n}`;
  els.starPill.title = '星星：读单词、喂词宠、解谜题都能赚，去许愿井换装扮！';
}
// 手机端顶栏没有分数胶囊：点星星胶囊报一遍家底（桌面信息齐全不用点）
els.starPill.addEventListener('click', () => {
  if (innerWidth > 640) return;
  sfx.pop();
  toast(`⭐ 星星 ${lastStars ?? 0} 颗 · 🏆 累计 ${_scoreInfo.score} 分`, 2600);
});

// 每日任务横幅（进度或完成状态）
let lastDaily = '';
let dailyHide = null;
// 每日任务横幅：只在进度有变化时冒泡几秒，不再常驻占屏幕
export function setDaily(text, done = false) {
  if (!els.daily) return;
  if (!text) { els.daily.classList.add('hidden'); return; }
  if (text === lastDaily) return;   // 内容没变就不动（游戏层每 1.5 秒刷新一次）
  lastDaily = text;
  els.daily.classList.toggle('done', !!done);
  if (els.dailyText) els.dailyText.textContent = text;
  els.daily.classList.remove('hidden');
  clearTimeout(dailyHide);
  dailyHide = setTimeout(() => els.daily.classList.add('hidden'), done ? 5000 : 3600);
}

// ---------- 任务气泡：跟着小人走，尾巴指向他 ----------
// 小朋友点 ✅ 关掉后不烦人：同一个目标保持隐藏，换了新目标气泡自动回来
// 任何目标最长显示 5 秒自动消失：导航靠 3D 箭头/发光小径还在，气泡常驻反而挡视线
const QUEST_TTL = 5000;
let questDismissedFor = null;
let _questText = '', _questShownAt = 0;
export function setQuest(text) {
  if (_questText !== text) {   // 换了新目标：重新计时，并解除之前的手动关闭
    _questText = text;
    _questShownAt = performance.now();
    if (questDismissedFor !== null && questDismissedFor !== text) questDismissedFor = null;
  }
  const expired = performance.now() - _questShownAt > QUEST_TTL;
  els.questText.textContent = text;
  els.quest.classList.toggle('hidden', questDismissedFor === text || expired);
}
// 每帧由 game.js 传入小人头顶的屏幕坐标；null 表示小人在镜头外，先藏起来。
// 值没变就不动 DOM（每帧写 style 会白耗布局）
let _qx = null, _qy = null;
export function placeQuest(x, y) {
  if (x == null) {
    if (_qx !== null) { els.quest.style.visibility = 'hidden'; _qx = null; }
    return;
  }
  const qx = Math.round(Math.max(125, Math.min(innerWidth - 125, x)));
  const qy = Math.round(Math.max(96, Math.min(innerHeight - 24, y)));
  if (qx === _qx && qy === _qy) return;
  _qx = qx; _qy = qy;
  els.quest.style.visibility = 'visible';
  els.quest.style.left = qx + 'px';
  els.quest.style.top = qy + 'px';
}
els.questClose.addEventListener('click', () => {
  questDismissedFor = els.questText.textContent;
  els.quest.classList.add('hidden');
  sfx.pop();
});

// ---------- 全国巡游地图：大公鸡中国地图 + 路线城市带名字，点城市看介绍 ----------
// 底图数据来自 china-base.js（DataV 全国/海南/台湾边界，脚本烘焙）

function _projectChina(cv) {
  cv.width = cv.height = 840;                      // 2x 超采样，CSS 里缩到 420 显示
  const LATK = Math.cos(35 * Math.PI / 180);
  const LON0 = 73, LON1 = 136, LAT0 = 15.5, LAT1 = 54.5;
  const k = Math.min((cv.width - 60) / ((LON1 - LON0) * LATK), (cv.height - 60) / (LAT1 - LAT0));
  return {
    X: lon => cv.width / 2 + (lon - (LON0 + LON1) / 2) * k * LATK,
    Y: lat => cv.height / 2 - (lat - (LAT0 + LAT1) / 2) * k,
  };
}

export function openChinaMap({ cities, onPick }) {
  const cv = els.mapCanvas, c = cv.getContext('2d');
  const { X, Y } = _projectChina(cv);
  const W = cv.width, H = cv.height;
  // 海洋
  const sea = c.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#9AD6F0'); sea.addColorStop(1, '#6CB9E2');
  c.fillStyle = sea; c.fillRect(0, 0, W, H);
  // 陆地：大陆 + 海南 + 台湾 + 附岛（淡绿纸面 + 描边）
  const drawRing = (ring) => {
    c.beginPath();
    ring.forEach(([lon, lat], i) => i ? c.lineTo(X(lon), Y(lat)) : c.moveTo(X(lon), Y(lat)));
    c.closePath();
    c.fillStyle = '#DFF0D0'; c.fill();
    c.strokeStyle = '#9DBE8E'; c.lineWidth = 2.5; c.stroke();
  };
  drawRing(CHINA_MAINLAND);
  drawRing(CHINA_ISLANDS.hainan);
  drawRing(CHINA_ISLANDS.taiwan);
  (CHINA_ISLANDS.others || []).forEach(drawRing);
  // 岛屿标注
  c.fillStyle = '#7A9A6E'; c.font = '700 20px "Microsoft YaHei", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const hc = CHINA_ISLANDS.hainan, tw = CHINA_ISLANDS.taiwan;
  c.fillText('海南', X(hc.reduce((s, p) => s + p[0], 0) / hc.length), Y(hc.reduce((s, p) => s + p[1], 0) / hc.length));
  c.fillText('台湾', X(tw.reduce((s, p) => s + p[0], 0) / tw.length), Y(tw.reduce((s, p) => s + p[1], 0) / tw.length));
  // 巡游路线（金色虚线按顺序串起来）
  const route = cities;
  if (route.length > 1) {
    c.beginPath();
    route.forEach((ct, i) => i ? c.lineTo(X(ct.lon), Y(ct.lat)) : c.moveTo(X(ct.lon), Y(ct.lat)));
    c.setLineDash([14, 10]);
    c.strokeStyle = 'rgba(192,138,45,.75)'; c.lineWidth = 4;
    c.stroke();
    c.setLineDash([]);
  }
  // 城市：点 + 名字（当前城金色大点 + 双圈，已解锁绿点，未解锁灰点）
  for (const ct of cities) {
    const px = X(ct.lon), py = Y(ct.lat);
    const col = ct.current ? '#F7B32B' : ct.unlocked ? '#5FAE5F' : '#D8D2C4';
    c.beginPath(); c.arc(px, py, ct.current ? 13 : 9, 0, Math.PI * 2);
    c.fillStyle = col; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#FFFDF8'; c.stroke();
    if (ct.current) { c.beginPath(); c.arc(px, py, 22, 0, Math.PI * 2); c.strokeStyle = 'rgba(247,179,43,.65)'; c.lineWidth = 5; c.stroke(); }
    c.font = (ct.current ? '900 ' : '700 ') + '22px "Microsoft YaHei", sans-serif';
    c.lineWidth = 5; c.strokeStyle = 'rgba(255,253,248,.92)';
    c.strokeText(ct.name, px, py - 24);
    c.fillStyle = ct.current ? '#B47514' : '#6B5844';
    c.fillText(ct.name, px, py - 24);
  }
  // 点击：找最近的城市（画布 2x，阈值 30 canvas 单位）
  cv.onclick = (e) => {
    const rect = cv.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (cv.width / rect.width);
    const cy = (e.clientY - rect.top) * (cv.height / rect.height);
    let best = null, bd = 30 * 30;
    for (const ct of cities) {
      const px2 = X(ct.lon), py2 = Y(ct.lat);
      const d = (px2 - cx) ** 2 + (py2 - cy) ** 2;
      if (d < bd) { bd = d; best = ct; }
    }
    if (best) onPick && onPick(best.key);
  };
  const headSpan = els.mapHead.querySelector('span');
  if (headSpan) headSpan.textContent = '🗺️ 中国巡游地图';
  const wgBtn = document.getElementById('map-wordgame');
  if (wgBtn) wgBtn.onclick = () => { sfx.pop(); openWordMapGame(); };
  els.map.classList.remove('hidden');
  const lg = document.getElementById('map-legend');
  if (lg) lg.textContent = '🟡 当前 · 🟢 已解锁 · ⚪ 未解锁 · 点城市看介绍';
  return true;
}
// npcs.js 负责分页与自动翻页，这里只管渲染与屏幕定位；翻页回调由 showNpcBubble 注入
let npcFlip = null;
export function showNpcBubble({ pages, page, onFlip }) {
  npcFlip = onFlip || null;
  els.npcBubbleText.textContent = pages[page] || '';
  const total = pages.length;
  els.npcBubblePrev.classList.toggle('hidden', total <= 1 || page <= 0);
  els.npcBubbleNext.classList.toggle('hidden', total <= 1 || page >= total - 1);
  els.npcBubblePage.textContent = total > 1 ? `${page + 1} / ${total}` : '';
  els.npcBubble.classList.remove('hidden');
}
export function hideNpcBubble() {
  els.npcBubble.classList.add('hidden');
  npcFlip = null;
}
els.npcBubblePrev.addEventListener('click', () => { sfx.pop(); npcFlip && npcFlip(-1); });
els.npcBubbleNext.addEventListener('click', () => { sfx.pop(); npcFlip && npcFlip(1); });
// 每帧由 game.js 传入说话 NPC 头顶的屏幕坐标；null 表示镜头外/不在说话，藏起来
let _nbx = null, _nby = null;
export function placeNpcBubble(x, y) {
  if (x == null) {
    if (_nbx !== null) { els.npcBubble.style.visibility = 'hidden'; _nbx = null; }
    return;
  }
  const nx = Math.round(Math.max(150, Math.min(innerWidth - 150, x)));
  const ny = Math.round(Math.max(110, Math.min(innerHeight - 24, y)));
  if (nx === _nbx && ny === _nby) return;
  _nbx = nx; _nby = ny;
  els.npcBubble.style.visibility = 'visible';
  els.npcBubble.style.left = nx + 'px';
  els.npcBubble.style.top = ny + 'px';
}

// ---------- 挑战弹窗 ----------
const ch = {
  open: false, word: null, mode: 'hatch', spellMode: false,
  slots: [], filled: [], tiles: [], onSuccess: null, onClose: null,
  busy: false, listening: false, canVoice: false, replayUrl: null,
};

export function openChallenge({ word, mode, onSuccess, onClose, onSkip, onDemoEnd, easy, noSpell, title }) {
  ch.open = true; ch.word = word; ch.mode = mode; ch.onSuccess = onSuccess; ch.onClose = onClose; ch.onSkip = onSkip; ch.onDemoEnd = onDemoEnd || null; ch.easy = !!easy;   // 复习蛋简单模式：读一遍就过
  ch.busy = false; ch.spellMode = false; ch.listening = false; ch.replayUrl = null;
  toggleHudMenu(false);   // 弹窗打开时收起菜单
  els.modalTitle.textContent = title || (mode === 'feed' ? '🍖 词宠饿啦，喊它的名字喂它'
    : mode === 'practice' ? '📖 跟读练习 · 大声读给词宠听'
    : ch.easy ? '🔁 复习蛋 · 大声读一遍就唤醒'
    : '🥚 遇见词宠蛋！念出单词唤醒它');
  els.wordEn.textContent = word.en;
  els.wordEn.classList.remove('spell-hidden');
  // 音标（有数据才显示）
  const ipa = ipaMap && ipaMap[String(word.en).toLowerCase()];
  els.wordIpa.textContent = ipa ? `/${ipa}/` : '';
  els.wordIpa.classList.toggle('hidden', !ipa);
  els.wordZh.textContent = word.zh;
  els.wordHint.textContent = '小提示：' + word.hint;
  els.voiceFeedback.textContent = '';
  els.voiceFeedback.className = '';
  els.scorePanel.classList.add('hidden');
  els.btnReplay.classList.add('hidden');
  els.micLabel.textContent = '点我开始读';
  els.spellArea.classList.add('hidden');
  els.modalFoot.classList.remove('hidden');
  els.btnSkip.classList.toggle('hidden', mode !== 'practice' && !ch.easy);
  els.btnSwitchSpell.classList.toggle('hidden', !!noSpell);   // 整句跟读没有"拼字母块"
  // 详细按钮只在喂养时显示：孵化/练习时孩子专注朗读拼块，词义详情留到喂养时专注看
  els.btnDetail.classList.toggle('hidden', mode !== 'feed');
  if (mode === 'feed') setTimeout(() => els.btnDetail.click(), 600);   // 喂养时自动弹出词义详情
  // 能不能“读”：在线识别可用，或设备能录音（改走自带的本地识别模型）
  const canRecord = typeof MediaRecorder !== 'undefined'
    && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const onlineVoice = voiceSupported && !isVoiceBroken();
  const canVoice = onlineVoice || canRecord;
  els.btnMic.classList.toggle('hidden', !canVoice);
  ch.canVoice = canVoice;
  if (voiceBlockedByInsecure) {
    els.voiceFeedback.textContent = '🎤 要 https:// 网址才能语音，先拼字母块吧';
    setSpellMode(true);
  } else if (canRecord && !onlineVoice) {
    els.voiceFeedback.textContent = '🎤 用本地识别朗读，第一次要下载一下';
  } else if (!canVoice) {
    els.voiceFeedback.textContent = '🎤 这台设备用不了语音，先拼字母块吧';
    setSpellMode(true);
  }
  els.modal.classList.remove('hidden');
  // 自动示范两遍发音（正常速 + 童声慢速文件）；示范全部放完回调 onDemoEnd
  // （游戏层等这一刻才开常开录音，避免示范音被录进缓冲污染识别）
  setTimeout(() => speak(word.en), 400);
  setTimeout(() => speakSlow(word.en, () => { if (ch.onDemoEnd) ch.onDemoEnd(); }), 1500);
}

export function closeChallenge() {
  if (!ch.open) return;
  ch.open = false;
  els.modal.classList.add('hidden');
  if (ch.onClose) ch.onClose();
}

export function challengeOpen() { return ch.open; }

// ---------- 小火车快问快答：转场等待期的一道目的地城市知识题（非阻塞，不作答也会自动消失） ----------
let _tqTimer = null;
export function showTrainQuiz({ q, opts, answer, onGood }) {
  closeTrainQuiz();
  const ov = document.createElement('div');
  ov.className = 'train-quiz';
  ov.innerHTML = `<div class="tq-q">🚄 车上小问答：${q}</div>
    <div class="tq-opts">${(opts || []).map((o, i) => `<button type="button" data-i="${i}">${o}</button>`).join('')}</div>
    <div class="tq-rs"></div>`;
  document.body.appendChild(ov);
  const rs = ov.querySelector('.tq-rs');
  ov.querySelectorAll('.tq-opts button').forEach(b => {
    b.onclick = () => {
      const ok = Number(b.dataset.i) === answer;
      ov.querySelectorAll('.tq-opts button').forEach(x => { x.disabled = true; if (x === b) x.classList.add(ok ? 'right' : 'wrong'); });
      if (ok) {
        rs.textContent = '答对啦 +1⭐';
        rs.className = 'tq-rs good';
        sfx.great();
        onGood && onGood();
      } else {
        rs.textContent = `正确答案：${opts[answer]}`;
        rs.className = 'tq-rs bad';
        sfx.pop();
      }
      clearTimeout(_tqTimer);
      _tqTimer = setTimeout(closeTrainQuiz, 2400);
    };
  });
  _tqTimer = setTimeout(closeTrainQuiz, 7000);   // 不作答也自动消失
}
export function closeTrainQuiz() {
  clearTimeout(_tqTimer);
  _tqTimer = null;
  document.querySelectorAll('.train-quiz').forEach(el => el.remove());
}

// ---------- 📍 通讯录式城市选择器：按拼音首字母分组，右侧字母条点按跳转 ----------
export function openCityPicker({ current, onPick }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '140';
  const cities = [...CITIES].sort((a, b) => String(a.en).localeCompare(String(b.en)));
  const rows = [];
  let lastLetter = '';
  for (const c of cities) {
    const L = (String(c.en)[0] || '#').toUpperCase();
    if (L !== lastLetter) { rows.push(`<div class="city-letter" data-letter="${L}">${L}</div>`); lastLetter = L; }
    rows.push(`<button type="button" class="city-row${c.id === current ? ' on' : ''}" data-id="${c.id}">
      <span>${c.name} ${c.en}</span><i class="city-dot"></i></button>`);
  }
  const letters = [...new Set(cities.map(c => (String(c.en)[0] || '#').toUpperCase()))];
  ov.innerHTML = `<div id="city-picker">
    <div class="cp-t">📍 选择我的城市</div>
    <div class="cp-body">
      <div class="cp-list">${rows.join('')}</div>
      <div class="cp-rail">${letters.map(l => `<button type="button" data-letter="${l}" aria-label="跳到 ${l}">${l}</button>`).join('')}</div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  const list = ov.querySelector('.cp-list');
  const railBtns = [...ov.querySelectorAll('.cp-rail button')];
  const setActiveLetter = L => railBtns.forEach(b => b.classList.toggle('active', b.dataset.letter === L));
  railBtns.forEach(b => {
    b.onclick = () => {
      sfx.pop();
      setActiveLetter(b.dataset.letter);
      const target = list.querySelector(`.city-letter[data-letter="${b.dataset.letter}"]`);
      if (!target) return;
      list.scrollTop = target.offsetTop - list.offsetTop;   // 通讯录式瞬时定位：跳字母不搞动画
    };
  });
  // 滚动同步：手动滚列表时，右侧字母条实时高亮当前段
  let spyTick = false;
  list.addEventListener('scroll', () => {
    if (spyTick) return;
    spyTick = true;
    requestAnimationFrame(() => {
      spyTick = false;
      let cur = railBtns.length ? railBtns[0].dataset.letter : '';
      for (const el of list.querySelectorAll('.city-letter')) {
        if (el.offsetTop - list.offsetTop <= list.scrollTop + 12) cur = el.dataset.letter;
        else break;
      }
      setActiveLetter(cur);
    });
  });
  ov.querySelectorAll('.city-row').forEach(r => {
    r.onclick = () => {
      sfx.pop();
      ov.remove();
      const id = r.dataset.id;
      const c = CITIES.find(x => x.id === id);
      toast(c ? `📍 家乡定为 ${c.name} ${c.emoji || ''}` : '📍 城市已更新', 2200);
      onPick && onPick(id, c);
    };
  });
}

// ---------- 单词×地理连线：英文词 ↔ 它最有名的城市，点词再点城，全部配对 +2⭐ ----------
const WORD_CITY_PAIRS = [
  { en: 'panda', zh: '熊猫', city: '成都', cityEn: 'Chengdu' },
  { en: 'ice', zh: '冰雕', city: '哈尔滨', cityEn: 'Harbin' },
  { en: 'beach', zh: '沙滩', city: '三亚', cityEn: 'Sanya' },
  { en: 'hot pot', zh: '火锅', city: '重庆', cityEn: 'Chongqing' },
  { en: 'silk', zh: '丝绸', city: '杭州', cityEn: 'Hangzhou' },
  { en: 'camel', zh: '骆驼', city: '敦煌', cityEn: 'Dunhuang' },
  { en: 'horse', zh: '骏马', city: '呼和浩特', cityEn: 'Hohhot' },
  { en: 'grapes', zh: '葡萄', city: '乌鲁木齐', cityEn: 'Urumqi' },
  { en: 'roast duck', zh: '烤鸭', city: '北京', cityEn: 'Beijing' },
  { en: 'garden', zh: '园林', city: '苏州', cityEn: 'Suzhou' },
  { en: 'noodles', zh: '面条', city: '兰州', cityEn: 'Lanzhou' },
  { en: 'tea', zh: '茶', city: '福州', cityEn: 'Fuzhou' },
];
const _shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export function openWordMapGame() {
  const pairs = _shuffle(WORD_CITY_PAIRS).slice(0, 8);
  const words = _shuffle(pairs);
  const cities = _shuffle(pairs);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '130';
  ov.innerHTML = `<div id="word-game">
    <button class="round-btn small" id="wg-close" style="position:absolute;top:12px;right:12px">✕</button>
    <div class="wg-t">🔗 单词 × 地理连线</div>
    <div class="wg-sub">点一个英文词，再点它最有名的城市，全部配对 +2⭐</div>
    <div class="wg-cols">
      <div class="wg-col">${words.map(p => `<button type="button" class="wg-w" data-city="${p.city}"><b>${p.en}</b><i>${p.zh}</i></button>`).join('')}</div>
      <div class="wg-col">${cities.map(p => `<button type="button" class="wg-c" data-city="${p.city}"><b>${p.city}</b><i>${p.cityEn}</i></button>`).join('')}</div>
    </div>
    <div class="wg-rs"></div>
  </div>`;
  document.body.appendChild(ov);
  const rs = ov.querySelector('.wg-rs');
  const close = () => ov.remove();
  ov.querySelector('#wg-close').onclick = () => { sfx.pop(); close(); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  const wordBtns = [...ov.querySelectorAll('.wg-w')];
  const cityBtns = [...ov.querySelectorAll('.wg-c')];
  let sel = null;
  wordBtns.forEach(wb => {
    wb.onclick = () => {
      if (wb.disabled) return;
      sfx.pop();
      wordBtns.forEach(x => x.classList.remove('sel'));
      wb.classList.add('sel');
      sel = wb;
      rs.textContent = '它属于哪座城？点点右边～';
    };
  });
  cityBtns.forEach(cb => {
    cb.onclick = () => {
      if (cb.disabled) return;
      if (!sel) { rs.textContent = '先点左边一个英文词哦'; return; }
      if (cb.dataset.city === sel.dataset.city) {
        sfx.good();
        sel.classList.remove('sel'); sel.classList.add('locked'); sel.disabled = true;
        cb.classList.add('locked'); cb.disabled = true;
        sel = null;
        if (wordBtns.every(x => x.disabled)) {
          sfx.great();
          addStars(2);
          updateStars(getStars());
          rs.textContent = '🏆 全部配对完成！+2⭐ 你就是地理小达人！';
          rs.classList.add('good');
        } else {
          rs.textContent = '✅ 配对成功！继续～';
        }
      } else {
        sfx.pop();
        rs.textContent = '再想想——这个词最有名的地方是哪座城？';
        cb.classList.add('shake');
        sel.classList.add('shake');
        const w = sel;
        setTimeout(() => { cb.classList.remove('shake'); w.classList.remove('shake', 'sel'); }, 450);
        sel = null;
      }
    };
  });
}

// ---------- 麦克风：点击开始 → 10 秒倒计时内读完 → 再点结束（到时也自动识别） ----------
let countdownTimer = null;
const LISTEN_SECONDS = 10;

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
}

function setListening(on) {
  ch.listening = on;
  els.btnMic.classList.toggle('listening', on);
  stopCountdown();
  if (on) {
    // 10 秒倒计时：显示在麦克风按钮上，到时自动收音识别，不让小朋友干等
    let left = LISTEN_SECONDS;
    els.micLabel.textContent = `读完点这里 ${left}s`;
    countdownTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        stopCountdown();
        if (ch.listening) {   // 到时自动结束并识别（和点一下结束等价）
          setListening(false);
          els.voiceFeedback.textContent = '识别中…';
          if (ch.onMicEnd) ch.onMicEnd();
        }
        return;
      }
      if (ch.listening) els.micLabel.textContent = `读完点这里 ${left}s`;
    }, 1000);
  } else {
    els.micLabel.textContent = '点我开始读';
  }
}

export function voiceStatus(text) {
  if (ch.open) { els.voiceFeedback.textContent = text; els.voiceFeedback.className = ''; }
}
export function voiceRecording() {
  if (!ch.open) return;
  els.voiceFeedback.textContent = '● 正在录音，读完再点一下';
  els.voiceFeedback.className = 'good';
}
export function voiceUnavailable() {
  if (!ch.open) return;
  setListening(false);
  els.btnMic.classList.add('hidden');
  ch.canVoice = false;
  els.voiceFeedback.textContent = '🎤 语音用不了，改用字母块拼吧';
  setSpellMode(true);
  sfx.miss();
}

els.btnMic.addEventListener('click', () => {
  if (!ch.open || ch.busy || !ch.canVoice) return;
  if (ch.listening) {
    setListening(false);
    els.voiceFeedback.textContent = '识别中…';
    if (ch.onMicEnd) ch.onMicEnd();
    return;
  }
  stopSpeaking();          // 停掉示范发音，别盖过孩子的声音
  els.btnReplay.classList.add('hidden');
  setListening(true);
  els.voiceFeedback.textContent = `● 开口大声读！${LISTEN_SECONDS} 秒内读完会自动识别`;
  els.voiceFeedback.className = 'good';
  const ok = ch.onMic ? ch.onMic() : false;
  if (ok === false) {
    // 识别引擎启动失败：立即降级为字母块，不让小朋友干等
    setListening(false);
    els.voiceFeedback.textContent = '🎤 语音启动失败，改用字母块拼吧';
    setTimeout(() => setSpellMode(true), 500);
    return;
  }
});

// 语音结果由 game 调用进来：res = { ok, close, heard, score } 或 { error }
export function voiceResult(res) {
  if (!ch.open || ch.busy) return;
  setListening(false);
  if (res.error) {
    els.voiceFeedback.textContent = res.error === 'no-result'
      ? '没听清，再大声读一次～'
      : '再读一次试试～';
    els.voiceFeedback.className = 'bad';
    sfx.miss();
    return;
  }
  const s = Math.max(0, Math.min(100, res.score || 0));
  showScore(s, res.heard, res);
}

// 游戏层拿到录音 blob 后调进来：显示“听我读的”回放按钮；传 null 表示隐藏（新一轮录音前）
export function showReplay(url) {
  if (!ch.open) return;
  if (!url) { els.btnReplay.classList.add('hidden'); return; }
  ch.replayUrl = url;
  els.btnReplay.classList.remove('hidden');
}

els.btnReplay.addEventListener('click', () => {
  if (!ch.replayUrl) return;
  sfx.pop();
  els.voiceFeedback.textContent = '🎧 这是你刚才的读音，听听和标准音差在哪～';
  els.voiceFeedback.className = '';
  playRecording(ch.replayUrl);
});

// ---------- 庆祝组件：彩带雨 + 震动（PERFECT / 孵蛋 / FEVER 共用） ----------
export function confettiBurst(n = 60) {
  const colors = ['#FF8FB0', '#FFD166', '#7CC96F', '#7C9CC4', '#C6A5F0', '#FF9F68'];
  const holder = document.createElement('div');
  holder.className = 'confetti-holder';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (Math.random() * 0.3) + 's';
    p.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
    p.style.setProperty('--dx', (Math.random() * 180 - 90) + 'px');
    p.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
    const big = Math.random() < 0.3;
    p.style.width = p.style.height = big ? '10px' : '7px';
    if (Math.random() < 0.35) p.style.borderRadius = '50%';
    holder.appendChild(p);
  }
  document.body.appendChild(holder);
  setTimeout(() => holder.remove(), 3300);
}
export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 不支持就算了 */ }
}

// 星星归航：从 3D 世界投影到屏幕的位置起飞，飞进 HUD 的星星胶囊（星星“进兜里”的爽感）
export function homeStars(x, y, n = 3) {
  const pill = document.getElementById('star-pill');
  if (!pill) return;
  const pr = pill.getBoundingClientRect();
  const tx = pr.x + pr.width / 2, ty = pr.y + pr.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'home-star';
    s.textContent = '⭐';
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    document.body.appendChild(s);
    const dx = tx - x + (Math.random() - 0.5) * 14;
    const dy = ty - y + (Math.random() - 0.5) * 14;
    setTimeout(() => {
      s.style.transform = `translate(${dx}px, ${dy}px) scale(.35)`;
      s.style.opacity = '.9';
    }, 420 + i * 130);
    setTimeout(() => s.remove(), 1500 + i * 130);
  }
}

// ---------- 全屏通关卡：星星结算 + 本关单词回顾（点单词可再听发音） ----------
export function levelUpOpen() { return els.levelup && !els.levelup.classList.contains('hidden'); }
export function showLevelComplete({ index, name, words = [], last = false, onNext }) {
  els.levelupBurst.textContent = last ? '🏆' : '🎉';
  els.levelupTitle.textContent = last ? '整册通关！' : `第 ${index} 关完成！`;
  els.levelupSub.textContent = last
    ? `「${name}」${words.length} 只词宠全部唤醒，你就是Q淘族传奇！`
    : `「${name}」全部唤醒 +3⭐`;
  // 星星逐颗弹入：重置动画
  const stars = els.levelupStars.querySelectorAll('span');
  stars.forEach((s, i) => {
    s.style.animation = 'none'; void s.offsetWidth;
    s.style.animation = '';
    s.style.animationDelay = last ? (0.2 + i * 0.2) + 's' : (0.3 + i * 0.25) + 's';
  });
  els.levelupWordsTip.style.display = words.length ? '' : 'none';
  els.levelupWords.innerHTML = words.map(w =>
    `<button type="button" class="lvlup-chip" data-en="${w.en}"><b>${w.en}</b><i>${w.zh}</i></button>`).join('');
  els.levelupWords.querySelectorAll('.lvlup-chip').forEach(btn => {
    btn.onclick = () => { sfx.pop(); speak(btn.dataset.en); };
  });
  els.levelupNext.textContent = last ? '再逛逛小岛 🏝️' : '继续冒险 →';
  els.levelup.classList.remove('hidden');
  confettiBurst(120);
  vibrate([30, 60, 30, 60, 90]);
  els.levelupNext.onclick = () => {
    sfx.pop();
    els.levelup.classList.add('hidden');
    onNext && onNext();
  };
}

// ---------- 关卡开始大横幅：飞入 → 停留 → 飘走 ----------
let bannerTimer = null;
export function chapterBanner(text) {
  els.chapterBannerText.textContent = text;
  els.chapterBanner.classList.remove('hidden', 'run');
  void els.chapterBanner.offsetWidth;      // 重排以重启动画
  els.chapterBanner.classList.add('run');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => els.chapterBanner.classList.add('hidden'), 3300);
}

// ---------- 游戏更新提示条（version.js 检测到新版本后调用） ----------
export function showUpdateBar({ onUpdate, onLater } = {}) {
  els.updateBar.classList.remove('hidden');
  els.updateNow.onclick = () => { els.updateBar.classList.add('hidden'); onUpdate && onUpdate(); };
  els.updateLater.onclick = () => { sfx.pop(); els.updateBar.classList.add('hidden'); onLater && onLater(); };
}

// ---------- 顶部城市胶囊：显示当前城市名，点击重弹介绍卡 ----------
export function setCityPill(text, onOpen) {
  if (!els.cityPill) return;
  if (!text) { els.cityPill.classList.add('hidden'); return; }
  els.cityPillText.textContent = text;
  els.cityPill.classList.remove('hidden');
  els.cityPill.onclick = () => { sfx.pop(); onOpen && onOpen(); };
}

// ---------- 城市介绍卡：顶部幻灯片图集 + 配置化 Tab（首页/大学/美食/风景/自定义）+ 小问答 ----------
// 内容全部来自城市 JSON（gallery/unis/foods/scenes/customTabs），程序只负责渲染
export function showCityCard({ city, variant, visit, quiz, onStar, onDone, isFinal }) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '120';
  const age = y => y ? (new Date().getFullYear() - y) : null;
  const tagCls = t => t === '985' ? 't985' : t === '211' ? 't211' : 't0';

  // 幻灯片图集：懒加载 + 单图失败隐藏 + 全挂时回退 emoji 横幅
  const gallery = (city.gallery || []).filter(g => g && g.img);
  const slideHtml = gallery.length
    ? `<div class="cc-gallery${isFinal ? ' final' : ''}" data-emoji="${variant.emoji}">
        ${gallery.map((g, i) => `<img class="cc-slide${i === 0 ? ' on' : ''}" src="${g.img}" alt="${g.caption || city.name}"
            loading="${i === 0 ? 'eager' : 'lazy'}"
            onerror="this.dataset.err='1';this.classList.remove('on');if(![...this.parentElement.querySelectorAll('.cc-slide')].some(s=>!s.dataset.err))this.parentElement.classList.add('dead')">`).join('')}
        <button type="button" class="cc-g-btn prev" aria-label="上一张">‹</button>
        <button type="button" class="cc-g-btn next" aria-label="下一张">›</button>
        <div class="cc-dots">${gallery.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="cc-cap">${gallery[0].caption || ''}</div>
        <div class="cc-g-fallback"><span>${variant.emoji}</span>${city.en}</div>
      </div>`
    : `<div class="cc-banner bn-home"><span class="cc-bn-emoji">${variant.emoji}</span><span class="cc-bn-city">${city.en}</span></div>`;

  // 首页 Tab：城市历史 + 到访介绍 + 关联词点读
  const cwords = (variant.words || []).map(w =>
    `<button type="button" class="cu-chip cw" data-en="${w}">${w}</button>`).join('');
  // 问答选项稳定洗牌（seed=题目文字）：答案不总在第一位，防止孩子记位置
  if (quiz && quiz.opts && quiz.opts.length > 1) {
    let h = 2166136261;
    for (const ch of String(quiz.q)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const order = quiz.opts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; const j = h % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    quiz = { ...quiz, opts: order.map(i => quiz.opts[i]), a: order.indexOf(quiz.a) };
  }
  const q = quiz ? `<div class="cc-quiz"><b>🤔 小问答：${quiz.q}</b><div class="cc-opts">${
    quiz.opts.map((o, i) => `<button type="button" data-i="${i}">${o}</button>`).join('')
  }</div><div class="cc-quiz-rs"></div></div>` : '';
  const homeHtml = `
    ${city.history ? `<div class="cc-hist">${city.history}</div>` : ''}
    <p class="cc-p">欢迎来到 <b>${city.name} ${city.en}</b>！${variant.intro}</p>
    <button class="cc-intro-en" data-en="${variant.introEn}">🔊 ${variant.introEn}</button>
    ${variant.introEn ? `<button type="button" class="cc-guide">🎤 当小导游 · 80分得徽章${hasBadge('guide:' + city.en) ? ' 🎖️' : ''}</button>` : ''}
    ${city.importance ? `<div class="cc-imp">⭐ ${city.importance}</div>` : ''}
    ${cwords ? `<div class="cc-sec">🗣️ 城市英文词（点点读）</div><div class="cc-chips">${cwords}</div>` : ''}
    ${q}`;

  // 大学 Tab：富卡片（点校名跳官网 + 建校年份实时算年龄 + 排名参考值）
  const unis = (city.unis || []).map(u => {
    const a = age(u.founded);
    return `<div class="uni-card">
      ${u.img ? `<img class="uni-img" src="${u.img}" alt="${u.zh}" loading="lazy"
           onerror="this.style.display='none'">` : ''}
      <button type="button" class="uni-name" data-site="${u.site || ''}" data-en="${u.en}">
        <i class="tag ${tagCls(u.tag)}">${u.tag || '🎓'}</i>${u.zh}
      </button>
      <div class="uni-en">${u.en}${u.campusNote ? ` · ${u.campusNote}` : ''}</div>
      <div class="uni-grid">
        <span>📅 ${u.founded || '—'} 年创建</span>
        <span class="hot">🎉 建校 ${a != null ? a : '—'} 年</span>
        <span>🌍 全球${u.globalRank != null ? '第 ' + u.globalRank : ' —'}</span>
        <span>🇨🇳 全国${u.nationalRank != null ? '第 ' + u.nationalRank : ' —'}</span>
      </div>
      ${u.history ? `<div class="uni-hist">${u.history}</div>` : ''}
    </div>`;
  }).join('');
  const uniHtml = unis
    ? `<p class="cc-p">点大学名字，去它们的官网看看（排名为公开榜单参考值）：</p><div class="uni-list">${unis}</div>`
    : `<p class="cc-p">这座城市更出名的是风景，去看看「风景」页吧！</p>`;

  // 图片卡片网格生成器（美食/风景共用）；风景页支持盖章收集
  const itemsHtml = (items, emoji, tip, stampable) => {
    const got = stampable ? getStamps(city.en) : [];
    const cards = (items || []).map(it => `
      <div class="item-card${stampable ? ' stampable' : ''}${got.includes(it.name) ? ' stamped' : ''}" data-emoji="${emoji}"${stampable ? ` data-name="${it.name}"` : ''}>
        ${stampable && got.includes(it.name) ? '<span class="stamp-mark">🏅</span>' : ''}
        ${it.img ? `<img src="${it.img}" alt="${it.name}" loading="lazy"
             onerror="this.style.display='none';this.parentElement.classList.add('noimg')">` : ''}
        <div class="it-name">${it.name}<i>${it.en || ''}</i></div>
        ${it.desc ? `<div class="it-desc">${it.desc}</div>` : ''}
      </div>`).join('');
    if (!cards) return `<p class="cc-p">这座城市的秘密等你亲自去发现！</p>`;
    const line = stampable ? `<div class="cc-stamp-line">🏅 景点集章 ${got.length}/${(items || []).length}${isStampsDone(city.en) ? ' · 全部完成！' : ' · 点一点盖上纪念章'}</div>` : '';
    return `${line}<p class="cc-p">${tip}</p><div class="cc-grid">${cards}</div>`;
  };

  // 风景页每次进入都按最新盖章状态重画
  const scenesHtml = () => itemsHtml(city.scenes, '🏞️', `${city.name}的风景名胜（${LANDMARK_ZH[city.landmark] || '城市舞台'}是它的名片）：`, true);

  // Tab 栏：配置数组驱动，city.customTabs 可无代码扩展
  const tabs = [
    { id: 'home', name: '🏠 首页', html: homeHtml },
    { id: 'uni', name: '🎓 大学', html: uniHtml },
    { id: 'food', name: '🍜 美食', html: itemsHtml(city.foods, '🍜', `来到${city.name}，一定要尝尝这些特色美味：`) },
    { id: 'scene', name: '🏞️ 风景', html: scenesHtml() },
    ...(city.customTabs || []).map(t => ({ id: t.name, name: t.name, html: t.html || '' })),
  ];
  ov.innerHTML = `<div id="city-card" class="${isFinal ? 'final' : ''}">
    ${isFinal ? '<div class="cc-final-badge">🏁 终点站 · 首都</div>' : ''}
    ${slideHtml}
    <div class="cc-emoji">${variant.emoji}</div>
    <div class="cc-name">${city.name}</div>
    <div class="cc-en">${city.en} · 第 ${visit + 1} 次到访</div>
    <div class="cc-tabs">${tabs.map((t, i) => `<button type="button" class="cc-tab${i === 0 ? ' on' : ''}" data-t="${i}">${t.name}</button>`).join('')}</div>
    <div class="cc-body">${tabs[0].html}</div>
    <div class="cc-actions">
      <button id="cc-share" type="button" title="生成这张城市的分享卡">📸 分享卡</button>
      <button id="cc-go">出发探索 →</button>
    </div>
  </div>`;
  document.body.appendChild(ov);

  // ---- 幻灯片逻辑：4 秒自动轮播 + 箭头 + 圆点，卡片关闭时停止 ----
  let slideIdx = 0, slideTimer = null;
  const gal = ov.querySelector('.cc-gallery');
  const paintSlide = () => {
    if (!gal) return;
    gal.querySelectorAll('.cc-slide').forEach((s, i) => s.classList.toggle('on', i === slideIdx));
    gal.querySelectorAll('.cc-dots i').forEach((d, i) => d.classList.toggle('on', i === slideIdx));
    const cur = gallery[slideIdx];
    gal.querySelector('.cc-cap').textContent = (cur && cur.caption) || '';
    const nx = gallery[(slideIdx + 1) % gallery.length];
    if (nx) { const pre = new Image(); pre.src = nx.img; }   // 预加载下一张
  };
  const moveSlide = d => {
    if (!gallery.length) return;
    slideIdx = (slideIdx + d + gallery.length) % gallery.length;
    paintSlide(); sfx.pop();
  };
  if (gal && gallery.length > 1) {
    slideTimer = setInterval(() => { slideIdx = (slideIdx + 1) % gallery.length; paintSlide(); }, 4000);
    gal.querySelector('.cc-g-btn.prev').onclick = () => moveSlide(-1);
    gal.querySelector('.cc-g-btn.next').onclick = () => moveSlide(1);
    gal.querySelectorAll('.cc-dots i').forEach((d, i) => d.onclick = () => { slideIdx = i; paintSlide(); });
  } else if (gal) gal.querySelector('.cc-g-btn.prev').style.display = gal.querySelector('.cc-g-btn.next').style.display = 'none';

  const body = ov.querySelector('.cc-body');
  ov.querySelectorAll('.cc-tab').forEach(b => {
    b.onclick = () => {
      sfx.pop();
      ov.querySelectorAll('.cc-tab').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      const t = tabs[Number(b.dataset.t)];
      body.innerHTML = t.id === 'scene' ? scenesHtml() : t.html;   // 风景页按最新盖章状态重画
      bindChips();
      bindQuiz();
    };
  });
  const bindChips = () => {
    body.querySelectorAll('.cu-chip, .cc-intro-en').forEach(b => {
      b.onclick = () => { sfx.pop(); if (b.dataset.en) speak(b.dataset.en); };
    });
    // 🎤 小导游挑战：跟读城市英文介绍，80 分拿徽章
    body.querySelectorAll('.cc-guide').forEach(b => {
      b.onclick = () => {
        sfx.pop();
        els.modal.style.zIndex = '130';   // 挑战弹窗要压在城市卡（120）之上
        openChallenge({
          word: { en: variant.introEn, zh: `${city.name} · 小导游词`, hint: '当小导游，大声把这座城介绍给游客！' },
          mode: 'practice', noSpell: true,
          onSuccess: res => {
            closeChallenge();
            if ((res.score || 0) >= 80) {
              const first = !hasBadge('guide:' + city.en);
              awardBadge('guide:' + city.en);
              sfx.great();
              onStar && onStar();
              toast(first ? `🎖️ 小导游徽章到手！${city.name}介绍得真棒 +1⭐` : `🎖️ 又当了一次小导游，越说越溜 +1⭐`, 4200);
            } else {
              toast('再多练一次，80 分就能拿到小导游徽章！', 3200);
            }
          },
          onClose: () => { els.modal.style.zIndex = ''; },
        });
      };
    });
    // 🏅 景点盖章：点风景卡盖上纪念章，集满一座城 +2⭐
    body.querySelectorAll('.item-card.stampable').forEach(card => {
      card.onclick = () => {
        const name = card.dataset.name;
        if (!name) return;
        const count = addStamp(city.en, name);
        sfx.pat();
        if (!card.classList.contains('stamped')) {
          card.classList.add('stamped');
          card.insertAdjacentHTML('afterbegin', '<span class="stamp-mark">🏅</span>');
        }
        const total = (city.scenes || []).length;
        if (!isStampsDone(city.en) && count >= total) {
          markStampsDone(city.en);
          sfx.great();
          onStar && onStar(); onStar && onStar();   // 集满一座城：+2⭐
          toast(`🏅「${city.name}」景点集章全部完成！+2⭐`, 4200);
        } else {
          toast(`🏅 盖上「${name}」纪念章！已集 ${count}/${total}`, 2600);
        }
        const line = body.querySelector('.cc-stamp-line');
        if (line) line.textContent = `🏅 景点集章 ${count}/${total}${isStampsDone(city.en) ? ' · 全部完成！' : ' · 点一点盖上纪念章'}`;
      };
    });
    // 大学名 → 新窗口打开官网（触屏先确认，防误触离开游戏）
    body.querySelectorAll('.uni-name').forEach(b => {
      b.onclick = () => {
        sfx.pop();
        if (b.dataset.en) speak(b.dataset.en);
        if (!b.dataset.site) return;
        const go = () => window.open(b.dataset.site, '_blank', 'noopener,noreferrer');
        if (matchMedia('(pointer: coarse)').matches) {
          if (confirm(`要在新窗口打开「${b.textContent.trim()}」的官网吗？`)) go();
        } else go();
      };
    });
  };
  const bindQuiz = () => {
    const quizBox = body.querySelector('.cc-quiz');
    if (!quizBox) return;
    const rs = quizBox.querySelector('.cc-quiz-rs');
    quizBox.querySelectorAll('.cc-opts button').forEach(b => {
      b.onclick = () => {
        const ok = Number(b.dataset.i) === quiz.a;
        b.classList.add(ok ? 'right' : 'wrong');
        if (ok) {
          rs.textContent = '答对啦 +1⭐';
          rs.className = 'cc-quiz-rs good';
          sfx.great();
          onStar && onStar();
          quizBox.querySelectorAll('.cc-opts button').forEach(x => x.disabled = true);
        } else {
          rs.textContent = '再想一想～';
          rs.className = 'cc-quiz-rs bad';
        }
      };
    });
  };
  bindChips();
  bindQuiz();
  // 图集全挂时的兜底：用维基百科条目主图补一张真实城市照片
  if (gal) {
    const checkDead = () => gal.classList.toggle('dead', ![...gal.querySelectorAll('.cc-slide')].some(s => !s.dataset.err && s.src));
    gal.querySelectorAll('.cc-slide').forEach(sl => {
      if (!sl.dataset.err && !sl.complete) sl.addEventListener('error', () => { sl.dataset.err = '1'; sl.classList.remove('on'); checkDead(); }, { once: true });
    });
    setTimeout(async () => {
      if (!gal.classList.contains('dead') || !ov.isConnected) return;
      try {
        const r = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city.wiki || city.name)}`);
        if (!r.ok) return;
        const d = await r.json();
        const src = (d.originalimage && d.originalimage.source) || (d.thumbnail && d.thumbnail.source);
        if (!src || !ov.isConnected) return;
        const im = document.createElement('img');
        im.className = 'cc-slide on';
        im.src = src;
        im.alt = city.name;
        gal.prepend(im);
        gal.classList.remove('dead');
        gal.querySelector('.cc-cap').textContent = city.name;
      } catch (e) { /* 断网保持 emoji */ }
    }, 2500);
  }
  // 📸 分享卡：城市名 + 到访信息 + 词宠进度，本地生成可直接分享/保存
  ov.querySelector('#cc-share').onclick = () => {
    sfx.pop();
    openShareCard({
      title: city.name, en: city.en, emoji: variant.emoji,
      rows: [
        `📍 ${getUsername() || '小小淘气'} · 第 ${visit + 1} 次到访`,
        `🐾 词宠已收集 ${hatchedCount()} 只`,
        `📅 ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      ],
    });
  };
  ov.querySelector('#cc-go').onclick = () => { if (slideTimer) clearInterval(slideTimer); sfx.pop(); ov.remove(); onDone && onDone(); };
}
// 地标类型中文名（风景 Tab 用）
const LANDMARK_ZH = {
  gate: '古老的城楼和城墙', tower: '高高的塔尖直插云霄', wall: '一眼望不到头的古城墙',
  panda: '憨态可掬的大熊猫', ice: '闪闪发光的冰雕世界', palm: '椰林树影的海滩',
  dome: '圆顶的草原帐篷', mountain: '连绵起伏的青山', pavilion: '飞檐翘角的亭台楼阁',
  grotto: '千年石窟大佛', harbor: '船来船往的大港口',
};

// ---------- 牌子详情弹卡：点击城市里的大学/美食/风景立牌弹出 ----------
const SIGN_TYPE_ZH = { uni: ['🎓', '大学'], food: ['🍜', '美食'], scene: ['🏞️', '风景名胜'] };
export function showSignDetail(it, cityEn) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '118';
  const [emoji, typeName] = SIGN_TYPE_ZH[it.type] || ['📍', '城市名片'];
  const nm = it.name || it.zh || '';
  // 🏅 风景立牌打开即盖章（与城市卡风景页共用同一本集章册）
  let stampTip = '';
  if (cityEn && it.type === 'scene' && nm) {
    const count = addStamp(cityEn, nm);
    stampTip = `<div class="sg-stamp">🏅 已盖上「${nm}」纪念章（第 ${count} 枚），集满一座城有惊喜！</div>`;
    sfx.pat();
  }
  ov.innerHTML = `<div id="sign-card">
    <button class="round-btn small" id="sign-close" style="position:absolute;top:12px;right:12px">✕</button>
    <div class="sg-fb" style="display:flex"><span>${emoji}</span></div>
    <div class="sg-head"><i class="tag">${emoji} ${typeName}</i><b>${nm}</b></div>
    ${it.en ? `<div class="sg-en">${it.en}</div>` : ''}
    ${it.founded ? `<div class="sg-meta">📅 创建于 ${it.founded} 年</div>` : ''}
    ${it.desc ? `<div class="sg-desc">${it.desc}</div>` : ''}
    ${it.history ? `<div class="sg-hist">${it.history}</div>` : ''}
    <div class="sg-wiki"></div>
    ${it.site ? `<a class="sg-site" href="${it.site}" target="_blank" rel="noopener noreferrer">🌐 打开官网</a>` : ''}
    ${stampTip}
    <div class="sg-tip">🔊 点读英文名 · 照片来自维基百科</div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.id === 'sign-close') ov.remove(); });
  fillSignWiki(ov, it);
}

// 拉取维基百科真实照片与百科短文（中文条目优先，英文名兜底），失败保持 emoji 占位
async function fillSignWiki(ov, it) {
  const title = it.wiki || it.name || it.zh || it.en;
  if (!title) return;
  const apis = [
    `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    it.en ? `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(it.en)}` : null,
  ].filter(Boolean);
  for (const api of apis) {
    if (!ov.isConnected) return;
    try {
      const r = await fetch(api);
      if (!r.ok) continue;
      const d = await r.json();
      const img = (d.originalimage && d.originalimage.source) || (d.thumbnail && d.thumbnail.source);
      const fb = ov.querySelector('.sg-fb');
      if (!img || !fb) continue;
      const im = document.createElement('img');
      im.className = 'sg-img';
      im.src = img;
      im.alt = it.name || it.zh || '';
      fb.style.display = 'none';
      fb.parentElement.insertBefore(im, fb);
      const w = ov.querySelector('.sg-wiki');
      if (w && d.extract) w.innerHTML = `<div class="sg-hist">📖 ${d.extract}</div>`;
      return;
    } catch (e) { /* 断网/条目不存在：试下一个 */ }
  }
}

// ---------- 北京终章成就卡：这一册带着词宠走过的城市 ----------
export function showTravelBadge(cities, onDone) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '130';
  ov.innerHTML = `<div id="travel-card">
    <div class="tb-t">🏆 走遍祖国之旅完成！</div>
    <div class="tb-sub">这一册你带着词宠走过了 ${cities.length} 座城市：</div>
    <div class="tb-list">${cities.map(c => `<span class="tb-city">${c.emoji} ${c.name}</span>`).join('')}</div>
    <div class="tb-sub">下一册，新的城市在等你～</div>
    <button class="tb-ok">太棒了！</button>
    <button class="tb-share" type="button">📸 做一张分享卡</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('.tb-ok').onclick = () => { sfx.great(); ov.remove(); if (onDone) onDone(); };
  // 通关分享卡：走遍祖国的城市路线图，家长朋友圈传播点
  const tbShare = ov.querySelector('.tb-share');
  if (tbShare) tbShare.onclick = () => {
    sfx.pop();
    openShareCard({
      title: '走遍祖国之旅', en: 'Journey Across China', emoji: '🏅',
      rows: [
        `🧒 ${getUsername() || '小小淘气'} 完成了本册巡游`,
        `🏙️ ${cities.length} 座城市：${cities.map(c => c.emoji).join('')}`,
        `🐾 词宠已收集 ${hatchedCount()} 只 · 📅 ${new Date().toLocaleDateString('zh-CN')}`,
      ],
    });
  };
}

// ---------- 分享卡片：本地 canvas 画一张，可直接系统分享或保存图片 ----------
function _rrPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function drawShareCard({ title, en = '', emoji = '🏙️', rows = [], footer = 'Q淘族 · 越淘越有词' }) {
  const cv = document.createElement('canvas');
  cv.width = 720; cv.height = 960;
  const c = cv.getContext('2d');
  // 纸面底：粉天 → 奶油
  const bg = c.createLinearGradient(0, 0, 0, cv.height);
  bg.addColorStop(0, '#FFE3EE'); bg.addColorStop(0.45, '#FFF6E8'); bg.addColorStop(1, '#FFFDF8');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
  // 装饰泡泡
  c.globalAlpha = 0.16;
  for (let i = 0; i < 14; i++) {
    c.beginPath();
    c.arc((i * 97 + 60) % cv.width, (i * 211 + 90) % cv.height, 26 + (i % 3) * 20, 0, Math.PI * 2);
    c.fillStyle = i % 2 ? '#FFB9CE' : '#FFD98A'; c.fill();
  }
  c.globalAlpha = 1;
  // 内框
  c.strokeStyle = 'rgba(255,143,176,.55)'; c.lineWidth = 6;
  _rrPath(c, 26, 26, cv.width - 52, cv.height - 52, 34); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  // emoji 主体
  c.font = '160px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  c.fillText(emoji, cv.width / 2, 250);
  // 标题 / 英文名
  c.fillStyle = '#C4577E'; c.font = '900 62px "Microsoft YaHei",sans-serif';
  c.fillText(title, cv.width / 2, 428);
  if (en) { c.fillStyle = '#B9A08E'; c.font = '600 30px Georgia,serif'; c.fillText(en, cv.width / 2, 486); }
  c.fillStyle = '#FFB9CE';
  c.beginPath(); c.arc(cv.width / 2, 540, 7, 0, Math.PI * 2); c.fill();
  // 数据行
  c.fillStyle = '#6B5844'; c.font = '700 31px "Microsoft YaHei",sans-serif';
  rows.forEach((r, i) => c.fillText(r, cv.width / 2, 608 + i * 56));
  // 底部落款
  _rrPath(c, cv.width / 2 - 190, cv.height - 130, 380, 62, 31);
  c.fillStyle = '#FF8FB0'; c.fill();
  c.fillStyle = '#FFF'; c.font = '900 28px "Microsoft YaHei",sans-serif';
  c.fillText(footer, cv.width / 2, cv.height - 98);
  return cv;
}
export function openShareCard(data) {
  const cv = drawShareCard(data);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '135';
  ov.innerHTML = `<div class="share-pop">
    <img class="share-pop-img" alt="分享卡片">
    <div class="share-pop-btns">
      <button type="button" class="sp-share">📤 分享</button>
      <button type="button" class="sp-save">💾 保存图片</button>
    </div>
    <div class="share-pop-tip"></div>
    <button type="button" class="round-btn small sp-close" aria-label="关闭">✕</button>
  </div>`;
  ov.querySelector('.share-pop-img').src = cv.toDataURL('image/png');
  document.body.appendChild(ov);
  const tip = ov.querySelector('.share-pop-tip');
  cv.toBlob(blob => {
    if (!blob) return;
    const file = new File([blob], 'qtzu-share.png', { type: 'image/png' });
    const savePng = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qtzu-${data.title || '分享卡'}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      tip.textContent = '已保存到下载，快去发给家人看看吧！';
    };
    ov.querySelector('.sp-share').onclick = async () => {
      sfx.pop();
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: data.title, text: `${data.title} · Q淘族` });
          tip.textContent = '分享出去啦，谢谢帮 Q淘族告诉更多小伙伴！';
        } else {
          savePng();
          tip.textContent = '这个浏览器不支持直接分享，已帮你保存图片，去相册发吧！';
        }
      } catch (e) { if (e && e.name !== 'AbortError') tip.textContent = '分享没成功，可以试试「保存图片」哦'; }
    };
    ov.querySelector('.sp-save').onclick = () => { sfx.pop(); savePng(); };
  }, 'image/png');
  ov.querySelector('.sp-close').onclick = () => { sfx.pop(); ov.remove(); };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

// ---------- 通关奖励城市选择卡 ----------
// 北京通关后解锁的 order=0 城市：点击即可自由前往探索
export function showBonusCities(list, onPick) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '130';
  ov.innerHTML = `<div id="travel-card">
    <div class="tb-t">🗺️ 奖励城市已解锁！</div>
    <div class="tb-sub">这些城市不在线路图上，通关才能去——挑一座开始探索：</div>
    <div class="tb-list">${list.map(c => `<button class="tb-city bc-pick" data-id="${c.id}">${c.name}</button>`).join('')}</div>
    <div class="tb-sub">每座城都有大学/美食/风景牌子和新蛋等你点亮</div>
    <button class="tb-ok">下次再去</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('.tb-ok').onclick = () => { sfx.pop(); ov.remove(); };
  ov.querySelectorAll('.bc-pick').forEach(btn => {
    btn.onclick = () => { const id = btn.dataset.id; ov.remove(); if (onPick) onPick(id); };
  });
}

// ---------- 二选一询问卡（换册"接着玩/重新出发"等） ----------
export function askChoice(title, sub, yesText, noText, onYes, onNo) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '150';
  ov.innerHTML = `<div id="ask-card">
    <div class="ak-t">${title}</div>
    <div class="ak-s">${sub}</div>
    <button class="ak-yes">${yesText}</button>
    <button class="ak-no">${noText}</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('.ak-yes').onclick = () => { sfx.pop(); ov.remove(); onYes && onYes(); };
  ov.querySelector('.ak-no').onclick = () => { sfx.pop(); ov.remove(); onNo && onNo(); };
}

// ---------- 换册转场：全屏"翻课本"动画后再刷新（替代白屏 reload） ----------
export function playBookFlip(cb) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '200';
  ov.style.background = '#FFF7E8';
  ov.innerHTML = `<div class="book-flip"><span class="bf-page bf-l">📖</span><span class="bf-page bf-r">📗</span></div><div class="bf-text">翻开新的一册…</div>`;
  document.body.appendChild(ov);
  setTimeout(cb, 780);
}

// ---------- 家长周报：本周读了多少词、平均分、时长（可复制分享） ----------
export function showParentReport(rep, name = '') {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const dayRows = Object.entries(rep.days || {}).map(([d, v]) =>
    `<div class="rp-row"><span>${d}</span><span>${v.hatches ? `孵 ${v.hatches} 只` : ''}${v.hatches && v.reads ? ' · ' : ''}${v.reads ? `读 ${v.reads} 次` : ''}${v.reads ? ` · 均分 ${Math.round(v.sum / v.reads)}` : ''}</span></div>`).join('')
    || '<div class="rp-row"><span>这周还没开始学习，快去孵一颗蛋吧！</span></div>';
  ov.innerHTML = `<div id="report-card">
    <button class="round-btn small rp-close">✕</button>
    <div class="rp-title">📋 ${name ? name + ' 的' : ''}学习周报（近 7 天）</div>
    <div class="rp-grid">
      <div class="rp-cell"><b>${rep.hatches}</b><i>新孵词宠</i></div>
      <div class="rp-cell"><b>${rep.reads}</b><i>朗读次数</i></div>
      <div class="rp-cell"><b>${rep.avg}</b><i>平均分</i></div>
      <div class="rp-cell"><b>${rep.best}</b><i>最高分</i></div>
    </div>
    <div class="rp-days">${dayRows}</div>
    <div class="rp-sub">图鉴共收集 ${rep.totalPets} 只词宠 · 累计游玩约 ${rep.playMinutes} 分钟</div>
    <button class="rp-share">复制本周小结，分享给家人 👨‍👩‍👧</button>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.rp-close').onclick = close;
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  // 复制小结：成功/失败都要有看得见的反馈（按钮变形 + 音效），失败给可全选文本兜底
  ov.querySelector('.rp-share').onclick = async (e) => {
    const btn = e.currentTarget;
    const text = `${name ? name + '的' : ''}学习周报：本周新孵词宠 ${rep.hatches} 只，朗读 ${rep.reads} 次（平均 ${rep.avg} 分，最高 ${rep.best} 分），图鉴已收集 ${rep.totalPets} 只！——Q淘族`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (err) { /* 旧浏览器/非 https：走可全选文本兜底 */ }
    if (ok) {
      btn.textContent = '✅ 已复制，快去粘贴给家人吧！';
      btn.classList.add('copied');
      sfx.good();
      setTimeout(() => { btn.textContent = '复制本周小结，分享给家人 👨‍👩‍👧'; btn.classList.remove('copied'); }, 2400);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'width:100%;height:90px;margin-top:8px;font:inherit;color:#7A5C22;border:2px solid #F2C98C;border-radius:10px;padding:6px';
      btn.replaceWith(ta);
      ta.focus(); ta.select();
      sfx.pop();
    }
  };
}

// ---------- 词典详情卡 ----------
export function showWordDetail(title, bodyHTML) {
  els.detailTitle.textContent = title;
  els.detailBody.innerHTML = bodyHTML;
  els.detailBody.scrollTop = 0;
  els.detailCard.classList.remove('hidden');
}
export function hideWordDetail() {
  els.detailCard.classList.add('hidden');
}
export function detailAppendHTML(html) {
  const loading = els.detailBody.querySelector('.dt-loading');
  if (loading) loading.remove();
  els.detailBody.insertAdjacentHTML('beforeend', html);
  els.detailBody.scrollTop = els.detailBody.scrollHeight;
}
export function detailWord() {
  return ch.word || null;
}

// 爪印归航：孵化奖励的小物品从词宠身边飞进 HUD 的词宠胶囊（同星星归航的手感）
export function homePaw(x, y, n = 6, onDone) {
  const pill = document.getElementById('pet-count');
  if (!pill) { if (onDone) onDone(); return; }
  const pr = pill.getBoundingClientRect();
  const tx = pr.x + pr.width / 2, ty = pr.y + pr.height / 2;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'home-star';
    s.textContent = i % 2 ? '🐾' : '💛';
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    document.body.appendChild(s);
    const dx = tx - x + (Math.random() - 0.5) * 16;
    const dy = ty - y + (Math.random() - 0.5) * 16;
    setTimeout(() => {
      s.style.transform = `translate(${dx}px, ${dy}px) scale(.35)`;
      s.style.opacity = '.9';
    }, 380 + i * 120);
    setTimeout(() => s.remove(), 1450 + i * 120);
  }
  if (onDone) setTimeout(onDone, 1900);
}

// +1 飘字：在屏幕坐标处冒出一个“+1”然后飘走消失
export function floatPlusOne(x, y, text = '+1') {
  const d = document.createElement('div');
  d.className = 'plus-one';
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1250);
}

// 小知识气泡：贴着词宠头顶显示，需要每帧用 placePetFact 跟随
export function showPetFact(title, text) {
  els.petFactTitle.textContent = title;
  els.petFactText.textContent = text;
  els.petFact.classList.remove('hidden');
}
export function placePetFact(x, y) {
  els.petFact.style.left = x + 'px';
  els.petFact.style.top = y + 'px';
}
export function hidePetFact() {
  els.petFact.classList.add('hidden');
}

// ---------- FEVER 连击：连续 3 次 PERFECT(95+) 触发，星星翻倍，读非完美即断 ----------
let perfectStreak = 0;
let feverOn = false;
export function isFever() { return feverOn; }
function setFever(on) {
  if (feverOn === on) return;
  feverOn = on;
  document.body.classList.toggle('fever', on);
  setBgmFever(on);   // 背景音乐升调加速
  if (on) {
    confettiBurst(90);
    vibrate([40, 60, 40, 60, 120]);
    sfx.magic();
    const b = document.createElement('div');
    b.id = 'fever-bar';
    b.textContent = '🔥 FEVER x2 · 连续完美，星星翻倍！';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2800);
  }
}

// 评分演出：喝彩大字弹在弹窗之外的屏幕层（飘升消失）+ 带情绪语音 + 数字滚动 + 星级，≥80 分过关
function showScore(score, heard, opts = {}) {
  ch.busy = true;
  els.voiceFeedback.textContent = '';   // 分数都打出来了，“识别中…”别再挂着
  els.voiceFeedback.className = '';
  // 喝彩大字：屏幕层大字 + 配套表情，跳出来往上飘、渐渐消失（弹窗关了它还在飘）
  const lv = SCORE_LEVELS.find(l => score >= l[0]);
  els.cheer.className = '';
  void els.cheer.offsetWidth;           // 重启动画
  els.cheerEmoji.textContent = lv[3];
  els.cheerWord.textContent = lv[1];
  els.cheer.className = 'cheer-run c-' + lv[2];
  els.scorePanel.classList.remove('hidden');
  els.scoreRing.style.setProperty('--deg', '0deg');
  // 数字 + 进度环滚动
  let cur = 0;
  const tick = () => {
    cur = Math.min(score, cur + Math.max(1, Math.round(score / 16)));
    els.scoreNum.textContent = cur;
    els.scoreRing.style.setProperty('--deg', (cur / 100 * 360) + 'deg');
    if (cur < score) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // 星级
  const stars = score >= 90 ? 3 : score >= 80 ? 2 : score >= 60 ? 1 : 0;
  els.scoreStars.innerHTML = '';
  for (let i = 0; i < stars; i++) {
    const sp = document.createElement('span');
    sp.className = 'star-pop';
    sp.style.animationDelay = (0.25 + i * 0.22) + 's';
    sp.textContent = '⭐';
    els.scoreStars.appendChild(sp);
  }
  for (let i = stars; i < 3; i++) {
    const sp = document.createElement('span');
    sp.style.opacity = '.3';
    sp.textContent = '☆';
    els.scoreStars.appendChild(sp);
  }
  // 评语 + 音效
  let msg;
  if (opts.msg) msg = opts.msg;
  else if (score >= 95) msg = '🌟 完美发音！你就是单词小明星！';
  else if (score >= 85) msg = '太棒了！发音非常标准！';
  else if (score >= 80) msg = '合格啦！再练一次会更稳！';
  else if (score >= 70) msg = '过关啦！勇敢开口就是最棒的！';
  else if (score >= 60) msg = '很接近啦！达到 70 分就能过关哦！';
  else if (heard) msg = `听到的是「${heard}」，勇敢再试一次！`;
  else msg = '没听清呢，大声一点点再试！';
  els.scoreMsg.textContent = msg;
  els.scoreMsg.className = score >= 70 ? 'good' : 'bad';
  els.scoreMsg.style.color = score >= 70 ? '#4E9A46' : '#D06A9C';
  scoreVoice(score);   // 带情绪的英文喝彩（Perfect!/Great!/Cool!/…）
  // 完美时刻的庆祝：PERFECT 彩带雨 + 震动 + 镜头微震，85+ 小彩带；顺路维护 FEVER 连击
  if (score >= 95) { perfectStreak++; confettiBurst(80); vibrate([30, 50, 80]); dispatchEvent(new CustomEvent('wordpet:shake')); dispatchEvent(new CustomEvent('wordpet:cheer')); }
  else { perfectStreak = 0; if (score >= 85) confettiBurst(36); }
  setFever(perfectStreak >= 3);
  if (score >= 85) { sfx.great(); setTimeout(() => sfx.magic(), 500); }
  else if (score >= 70) sfx.good();
  else if (score >= 60) sfx.pop();
  else sfx.miss();

  const passAt = ch.easy ? 1 : 70;   // 复习蛋简单模式：重在巩固不卡人
  if (score >= passAt) {
    // 过关就要爽快：1.4 秒内自动关卡，不让孩子干等
    setTimeout(() => {
      els.scorePanel.classList.add('hidden');
      // via 告诉游戏层这次分数是“朗读”还是“拼字母块”（“朗读 95 分”类每日任务只认真正的朗读）
      ch.onSuccess && ch.onSuccess({ score, heard, via: ch.spellMode ? 'spell' : 'voice' });
    }, 1400);
  } else {
    // 未过关：先示范标准慢速音（音节高亮同步显示），可继续尝试或换字母块
    setTimeout(() => {
      els.scorePanel.classList.add('hidden');
      ch.busy = false;
      playFollowAlong();
    }, 1900);
  }
}

// 跟读示范：播整词标准慢速音，音节只做高亮同步（不单独念音节，避免 TTS 念走调）
function playFollowAlong() {
  const word = ch.word;
  const syl = word.syl && word.syl.length && !(word.syl.length === 1 && word.syl[0] === word.en)
    ? word.syl : null;
  if (syl) {
    els.voiceFeedback.innerHTML = '跟我一起读：' + syl.map((s, i) =>
      `<span class="syl" data-i="${i}">${escapeHtml(s)}</span>`).join(' · ');
  } else {
    els.voiceFeedback.textContent = '跟我一起读：慢速示范';
  }
  els.voiceFeedback.className = '';
  const marks = els.voiceFeedback.querySelectorAll('.syl');
  speakFollow(word.en, syl || [word.en], i => {
    marks.forEach(el => el.classList.toggle('on', +el.dataset.i === i));
  }, () => {
    marks.forEach(el => el.classList.remove('on'));
  });
}

// 练习模式跳过
els.btnSkip.addEventListener('click', () => {
  if (!ch.open || ch.busy || !ch.onSkip) return;
  sfx.pop();
  els.scorePanel.classList.add('hidden');
  ch.onSkip();
});

// 再听一遍发音
els.btnPlay.addEventListener('click', () => {
  if (!ch.word) return;
  sfx.pop();
  speak(ch.word.en);
  setTimeout(() => speakSlow(ch.word.en), 1300);
});

// ---------- 字母块 ----------
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSpell() {
  const w = ch.word.en;
  ch.slots = w.split('');
  // 空格自动补好（短语如 ice cream / good morning），只拼字母
  ch.filled = w.split('').map(c => (c === ' ' ? ' ' : null));
  ch.tileAt = w.split('').map(() => null);   // 槽位 -> 用的字母块
  ch.selSlot = null;
  // 字母块 = 单词字母打乱 + 1~2 个干扰字母：允许自由组合、拼错只提示，
  // 小朋友得真的记住单词长什么样才拼得对，而不是把唯一的块挨个塞进去
  const letters = w.split('').filter(c => c !== ' ');
  const decoyN = letters.length >= 4 ? 2 : 1;
  const pool = 'abcdefghijklmnoprstuvw';
  const decoys = [];
  while (decoys.length < decoyN) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (!letters.includes(c) && !decoys.includes(c)) decoys.push(c);
  }
  ch.tiles = shuffle(letters.concat(decoys));
  els.spellSlots.innerHTML = '';
  els.spellTiles.innerHTML = '';
  ch.slots.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (c === ' ' ? ' space filled' : '');
    if (c === ' ') d.textContent = '·';
    else d.addEventListener('click', () => slotClick(i));
    els.spellSlots.appendChild(d);
  });
  ch.tiles.forEach((letter, idx) => {
    const b = document.createElement('button');
    b.className = 'tile';
    b.textContent = letter;
    b.addEventListener('click', () => tileClick(idx, b));
    els.spellTiles.appendChild(b);
  });
}

// 点槽位：已放字母=取回来重摆；空槽=选中它，下一块字母放这里
function slotClick(i) {
  if (!ch.open || ch.busy) return;
  if (ch.filled[i] !== null) { returnTile(i); return; }
  ch.selSlot = i;
  [...els.spellSlots.children].forEach((el, k) => el.classList.toggle('sel', k === i));
}

function returnTile(i) {
  const idx = ch.tileAt[i];
  if (idx == null) return;
  ch.filled[i] = null;
  ch.tileAt[i] = null;
  els.spellSlots.children[i].textContent = '';
  els.spellSlots.children[i].classList.remove('filled', 'sel');
  els.spellTiles.children[idx].classList.remove('used');
  sfx.pop();
}

function tileClick(idx, btn) {
  if (!ch.open || ch.busy) return;
  if (btn.classList.contains('used')) return;
  // 放进点选中的槽；没选就放进最前面的空槽
  let slotIdx = ch.selSlot;
  if (slotIdx == null || ch.filled[slotIdx] !== null) slotIdx = ch.filled.findIndex(x => x === null);
  if (slotIdx < 0) return;
  if (ch.filled[slotIdx] !== null) returnTile(slotIdx);   // 换掉槽里原有的字母
  ch.filled[slotIdx] = ch.tiles[idx];
  ch.tileAt[slotIdx] = idx;
  const el = els.spellSlots.children[slotIdx];
  el.textContent = ch.tiles[idx];
  el.classList.add('filled');
  el.classList.remove('sel');
  btn.classList.add('used');
  if (ch.selSlot === slotIdx) ch.selSlot = null;
  speak(ch.tiles[idx], { rate: 0.6 });
  sfx.pop();
  if (!ch.filled.includes(null)) checkSpell();
}

function checkSpell() {
  const attempt = ch.filled.join('');
  if (attempt === ch.word.en) {
    // 真的自己拼出来了 —— 拼写满分演出
    speak(ch.word.en);
    showScore(100, null, { msg: '🧩 拼写满分！会拼就会读！' });
    return;
  }
  // 拼错了：不扣分也不收字母，点槽位取回改一改再来
  els.spellArea.classList.remove('shake');
  void els.spellArea.offsetWidth;
  els.spellArea.classList.add('shake');
  sfx.miss();
  els.voiceFeedback.textContent = `拼出来的是「${attempt}」，不对哦～点字母槽把块取回来再试试！`;
  els.voiceFeedback.className = 'bad';
  speak(ch.word.en, { rate: 0.6 });
}

function setSpellMode(on) {
  if (on && (!ch.open || !ch.word)) return;   // 挑战已关/没词时忽略，别在空词上崩溃
  ch.spellMode = on;
  els.spellArea.classList.toggle('hidden', !on);
  els.modalFoot.classList.toggle('hidden', on);
  els.wordEn.classList.toggle('spell-hidden', on);
  if (on) els.voiceFeedback.textContent = '用字母块拼出英文单词吧！';
  if (on) buildSpell();
}
let _scoreInfo = { score: 0, session: 0 };
export function updatePlayerScore(score, sessionScore = score) {
  _scoreInfo = { score: Number(score) || 0, session: Number(sessionScore) || 0 };
  if (els.scorePill) els.scorePill.textContent = isTouchMode ? `🏆 ${score}` : `🏆 ${score} 分 · 本局 ${sessionScore}`;
  refreshMenuScore();
  leaderboardCurrent.score = Number(score) || 0;
  scheduleLeaderboardRefresh();
}
// 手机端顶栏不显示分数：菜单里留一行明细（打开菜单/分数变化时刷新）
function refreshMenuScore() {
  if (!els.menuScore) return;
  if (innerWidth > 640) { els.menuScore.classList.add('hidden'); return; }
  els.menuScore.textContent = `🏆 累计 ${_scoreInfo.score} 分 · 本局 ${_scoreInfo.session} 分`;
  els.menuScore.classList.remove('hidden');
}

let leaderboardCurrent = { username: '', score: 0 };
let leaderboardTimer = null;
let leaderboardRequest = null;

function leaderboardRowsHtml(rows, current = leaderboardCurrent) {
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  if (!rows.length) return '<div class="rank-loading">还没有记录，快来拿第一分吧！</div>';
  return rows.slice(0, 5).map((x, i) => {
    const name = String(x.username || '匿名小伙伴');
    const gIcon = x.gender === 'girl' ? '👧' : '👦';   // 没有性别记录的老数据默认男孩
    const active = current.username && name === current.username ? ' current' : '';
    return `<div class="rank-row${active}"><b>${medals[i]}</b><span>${gIcon} ${escapeHtml(name)}</span><strong>${Number(x.score) || 0} 分</strong></div>`;
  }).join('');
}

async function fetchLeaderboardRows() {
  if (!leaderboardRequest) {
    leaderboardRequest = fetch('/api/leaderboard', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) { const err = new Error('offline'); err.status = r.status; throw err; }
        return r.json();
      })
      .then(rows => Array.isArray(rows) ? rows : [])
      .finally(() => { leaderboardRequest = null; });
  }
  return leaderboardRequest;
}

// 排行榜接口不可用时，说清是“后端没部署”还是“网络不通”，并留住自己的分数
function leaderboardOfflineReason(err) {
  return err && err.status === 404 ? '排行榜暂未开通' : '排行榜连不上';
}

function renderLeaderboardOffline(err) {
  if (!els.leaderboardList) return;
  const mine = leaderboardCurrent.username ? `<br>你已有 ${leaderboardCurrent.score} 分` : '';
  els.leaderboardList.innerHTML = `<div class="rank-loading">${leaderboardOfflineReason(err)}${mine}</div>`;
}

export async function refreshLeaderboard(current = {}) {
  if (current.username != null) leaderboardCurrent.username = String(current.username || '').trim();
  if (current.score != null) leaderboardCurrent.score = Number(current.score) || 0;
  if (!els.leaderboardList) return;
  try {
    const rows = await fetchLeaderboardRows();
    els.leaderboardList.innerHTML = leaderboardRowsHtml(rows, leaderboardCurrent);
  } catch (e) {
    renderLeaderboardOffline(e);
  }
}

function scheduleLeaderboardRefresh() {
  clearTimeout(leaderboardTimer);
  leaderboardTimer = setTimeout(() => refreshLeaderboard(), 500);
}

export function setLeaderboardPlayer(current = {}) {
  leaderboardCurrent.username = String(current.username || '').trim();
  leaderboardCurrent.score = Number(current.score) || 0;
  refreshLeaderboard();
}

// ---------- 排行榜收纳：手机屏小，默认收成一颗 🏆 小圆钮，点开再看 ----------
const LB_FOLD_KEY = 'lb-folded';
function setLeaderboardFolded(folded) {
  const w = els.leaderboardWidget;
  if (!w) return;
  w.classList.toggle('collapsed', folded);
  const btn = els.leaderboardToggle;
  if (btn) {
    btn.title = folded ? '展开排行榜' : '收起排行榜';
    btn.setAttribute('aria-label', btn.title);
  }
  try { localStorage.setItem(LB_FOLD_KEY, folded ? '1' : '0'); } catch { /* 隐私模式忽略 */ }
  if (!folded) refreshLeaderboard();
}
function initLeaderboardFold() {
  const w = els.leaderboardWidget;
  if (!w || w.dataset.foldReady) return;
  w.dataset.foldReady = '1';
  let saved = null;
  try { saved = localStorage.getItem(LB_FOLD_KEY); } catch { /* 隐私模式走默认 */ }
  // 没有记忆时：触屏/窄屏默认收起（别挡地图），大屏默认展开
  const defaultFolded = window.innerWidth < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  setLeaderboardFolded(saved ? saved === '1' : defaultFolded);
  if (els.leaderboardToggle) els.leaderboardToggle.addEventListener('click', () => setLeaderboardFolded(false));
  if (els.leaderboardFold) els.leaderboardFold.addEventListener('click', () => setLeaderboardFolded(true));
  // 点头部标题也允许收起
  w.querySelector('.leaderboard-head span')?.addEventListener('click', () => setLeaderboardFolded(true));
}

// 调账号接口。返回 { ok, status, data }；网络不可用（离线/没后端）时抛出，交给调用方走本地兜底。
async function apiPost(path, payload) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* 后端没返回 JSON */ }
  return { ok: res.ok, status: res.status, data };
}
// 后端不存在时（静态站点 404 'not found'、405、501）当作可离线继续
const noBackend = r => !r || r.status === 405 || r.status === 501 || (r.status === 404 && (!r.data || r.data.error === 'not found'));

// 档案弹窗：第一次用 → 注册（昵称 + 密码）；老同学 → 登录；已登录改档案 → editing
export function showProfile(onDone, profile = {}, options = {}) {
  const ov = document.getElementById('profile');
  const input = document.getElementById('profile-name');
  const pwd = document.getElementById('profile-password');
  const grade = document.getElementById('profile-grade');
  const term = document.getElementById('profile-term');
  const error = document.getElementById('profile-error');
  const title = ov.querySelector('h2');
  const intro = ov.querySelector('p');
  const start = document.getElementById('profile-start');
  const switchBtn = document.getElementById('profile-switch');
  const close = document.getElementById('profile-close');
  const logout = document.getElementById('profile-logout');
  const genderRow = document.getElementById('profile-gender');
  const selects = ov.querySelector('.profile-selects');
  const tip = ov.querySelector('.profile-tip');
  const boyBtn = document.getElementById('gender-boy');
  const girlBtn = document.getElementById('gender-girl');
  const editing = !!options.editing;
  // 性别：男孩 / 女孩，可随时改
  let gender = profile.gender === 'girl' ? 'girl' : 'boy';
  const paintGender = () => {
    boyBtn.classList.toggle('active', gender === 'boy');
    girlBtn.classList.toggle('active', gender === 'girl');
  };
  boyBtn.onclick = () => { gender = 'boy'; sfx.pop(); paintGender(); };
  girlBtn.onclick = () => { gender = 'girl'; sfx.pop(); paintGender(); };
  paintGender();
  input.value = profile.username || '';
  pwd.value = editing ? (profile.password || '') : '';   // 改档案时把当前密码填出来，可直接改
  // 已登录改档案 / 新同学注册 / 老同学登录
  let mode = editing ? 'edit' : (options.mode === 'login' || (profile.username && !profile.registered) ? 'login' : 'register');
  if (CURRICULUM[profile.semKey]) {
    grade.value = profile.semKey[0];
    term.value = profile.semKey[1] === 'a' ? 'up' : 'down';
  }
  // 我的城市选择器（城市巡游的起点；IP 自动定位会帮着填，这里可手动改）
  // 通讯录式弹层：按拼音首字母索引，点字母快速跳转
  // CITIES 由 cities.js 异步填充：若打开瞬间还没就绪，短轮询自愈
  const citySel = document.getElementById('profile-city');
  let pickedCity = profile.city || (hasHomeCity() ? getHomeCity() : '');   // 真选过才回显，新同学保持"我的城市"占位
  const paintCity = () => {
    const c = CITIES.find(x => x.id === pickedCity);
    citySel.textContent = c ? `${c.name} ${c.en}` : '我的城市';
    citySel.classList.toggle('placeholder', !c);
  };
  const tryPaintCity = () => { if (!citySel || !CITIES.length) return false; paintCity(); return true; };
  if (citySel) {
    if (!tryPaintCity()) {
      let tries = 0;
      const t = setInterval(() => { if (tryPaintCity() || ++tries > 40) clearInterval(t); }, 250);
      addEventListener('cities-ready', tryPaintCity, { once: true });
    }
    citySel.onclick = () => {
      sfx.pop();
      openCityPicker({
        current: pickedCity,
        onPick: id => {
          pickedCity = id;
          paintCity();
          setHomeCity(id);
        },
      });
    };
    // IP 定位是异步的：定位成功后档案卡可能已经打开，监听事件把新家乡刷进来
    addEventListener('home-city', e => { pickedCity = e.detail; paintCity(); });
  }
  const paint = () => {
    error.textContent = '';
    title.textContent = editing ? '我的档案' : (mode === 'login' ? '欢迎回来' : '开始前先设置学习档案');
    intro.textContent = editing
      ? '可以改昵称、密码、形象和课本，保存后重新进入Q淘族。'
      : (mode === 'login' ? '填昵称和密码就能接着玩，密码可以留空。' : '起个名字就能玩，密码可以留空。');
    start.textContent = editing ? '保存' : (mode === 'login' ? '登录' : '出发去Q淘族');
    pwd.placeholder = '密码（可以留空）';
    switchBtn.classList.toggle('hidden', editing);
    switchBtn.textContent = mode === 'login' ? '我是新同学，去注册' : '我已有账号，去登录';
    genderRow.classList.toggle('hidden', mode === 'login');   // 登录时性别由服务端定
    selects.classList.toggle('hidden', mode === 'login');     // 登录只要昵称+密码，课本沿用上次（或默认三上）
    tip.textContent = editing ? '完成一个挑战得 1 分，和同学比比谁的词宠最多！'
      : (mode === 'login' ? '忘了密码？换个名字重新注册一个就行。' : '同一个名字就是同一份学习记录哦。');
    close.classList.toggle('hidden', !editing);
    logout.classList.toggle('hidden', !editing);
  };
  paint();
  if (options.kickMsg) error.textContent = options.kickMsg;   // 被顶下线后的提示
  let submitted = false;
  const busy = () => { start.disabled = true; start.textContent = '稍等…'; };
  const resume = () => { if (!editing) start.textContent = mode === 'login' ? '登录' : '出发去Q淘族'; };
  const done = (semKey, password, serverScore, token) => {
    if (pickedCity) setHomeCity(pickedCity);   // 档案里选的城市=巡游起点
    ov.classList.add('hidden'); onDone && onDone(input.value.trim(), semKey, gender, password, serverScore, token);
  };
  const fail = msg => {
    error.textContent = msg; submitted = false; start.disabled = false; resume();
    error.classList.remove('shake'); void error.offsetWidth; error.classList.add('shake');   // 轻轻晃一下，更醒目
  };
  const submit = async () => {
    if (submitted) return;
    const name = input.value.trim();
    const password = pwd.value;
    if (!name) { error.textContent = '先写一个名字哦～'; input.focus(); return; }
    // 登录只要昵称+密码，课本沿用上次选的（没有就默认三上）；注册/改档案要选课本
    let semKey = '';
    if (mode !== 'login') {
      if (!grade.value) { error.textContent = '请选择你的年级'; grade.focus(); return; }
      if (!term.value) { error.textContent = '请选择上册或下册'; term.focus(); return; }
      semKey = gradeKey(grade.value, term.value);
      if (!CURRICULUM[semKey]) return;
    } else {
      semKey = CURRICULUM[profile.semKey] ? profile.semKey : '3a';
    }
    submitted = true; busy();
    try {
      if (editing) {
        const r = await apiPost('/api/update', {
          username: profile.username, password: profile.password,   // 用当前密码验证身份
          newUsername: name, newPassword: password,
        });
        if (r.ok || noBackend(r)) return done(semKey, password, r.data && r.data.score);
        return fail((r.data && r.data.error) || '保存失败，换个名字试试');
      }
      if (mode === 'register') {
        const r = await apiPost('/api/register', { username: name, password, gender });
        if (r.ok || noBackend(r)) return done(semKey, password, 0, r.data && r.data.token);
        return fail((r.data && r.data.error) || '注册失败，换一个名字试试');
      }
      const r = await apiPost('/api/login', { username: name, password });
      if (r.ok) {
        if (r.data && r.data.gender) gender = r.data.gender === 'girl' ? 'girl' : 'boy';
        return done(semKey, password, r.data && r.data.score, r.data && r.data.token);   // 带回账号里的分数
      }
      if (noBackend(r)) return done(semKey, password);   // 离线也放行，本地存档继续用
      if (r.status === 404) {                            // 没这个名字 → 直接转注册，少点来回
        mode = 'register'; submitted = false; start.disabled = false;
        paint(); error.textContent = '这个名字还没注册过，点「出发去Q淘族」就能建好啦';
        return;
      }
      return fail((r.data && r.data.error) || '登录失败，检查一下昵称和密码');
    } catch (e) {
      done(semKey, password);   // 完全连不上后端：本地存档模式继续，不耽误小朋友玩
    }
  };
  start.onclick = submit;
  start.disabled = false;
  switchBtn.onclick = () => {
    mode = mode === 'login' ? 'register' : 'login';
    if (mode === 'register' && !input.value.trim()) pwd.value = '';
    paint(); (mode === 'login' ? pwd : input).focus();
  };
  logout.onclick = () => { if (options.onLogout) options.onLogout(); };
  close.onclick = () => ov.classList.add('hidden');
  input.onkeydown = e => { if (e.key === 'Enter') { if (pwd.classList.contains('hidden')) submit(); else pwd.focus(); } };
  pwd.onkeydown = e => { if (e.key === 'Enter') submit(); };
  ov.classList.remove('hidden');
  (editing || profile.username ? pwd : input).focus();
}

export async function showLeaderboard(current = {}) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div id="rank-card"><button class="round-btn small rank-close">✕</button>
    <div class="rank-title">🏆 Q淘族小小排行榜</div><div class="rank-sub">完成一个挑战得 1 分</div>
    <div class="rank-list"><div class="rank-loading">正在看看谁是单词小明星…</div></div></div>`;
  document.body.appendChild(ov); ov.querySelector('.rank-close').onclick = () => ov.remove();
  const list = ov.querySelector('.rank-list');
  try {
    const rows = await fetchLeaderboardRows();
    list.innerHTML = leaderboardRowsHtml(rows, current);
  } catch (e) { list.innerHTML = `<div class="rank-loading">${leaderboardOfflineReason(e)}，${escapeHtml(current.username || '你')} 已有 ${current.score || 0} 分。</div>`; }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
els.btnSwitchSpell.addEventListener('click', () => { setSpellMode(true); sfx.pop(); });
els.btnReplayLetters.addEventListener('click', () => { spellLetters(ch.word.en); speak(ch.word.en); });
els.btnShowHelpWord.addEventListener('click', () => {
  if (!ch.open || ch.busy) return;
  ch.selSlot = null;   // 提示永远补到最前面的空槽
  const slotIdx = ch.filled.findIndex(x => x === null);
  if (slotIdx < 0) return;
  const tileIdx = ch.tiles.findIndex((t, i) => t === ch.word.en[slotIdx] && !els.spellTiles.children[i].classList.contains('used'));
  if (tileIdx >= 0) tileClick(tileIdx, els.spellTiles.children[tileIdx]);
});
els.modalClose.addEventListener('click', () => { sfx.pop(); closeChallenge(); });
els.detailClose.addEventListener('click', () => { sfx.pop(); hideWordDetail(); });
els.detailBody.addEventListener('click', e => {
  const ex = e.target.closest('.dt-ex');
  if (ex && ex.dataset.say) speak(ex.dataset.say);
});
els.btnDetail.addEventListener('click', () => {
  if (!ch.open || !ch.word) return;
  sfx.pop();
  dispatchEvent(new CustomEvent('wordpet:detail', { detail: { word: ch.word } }));
});

// ---------- 召唤面板 ----------
export function openPicker(list, onPick, onClose, opts = {}) {
  els.pickerTitle.textContent = opts.title || '召唤一只词宠来帮忙：';
  els.pickerGrid.innerHTML = '';
  const lazy = [];
  for (const p of list) {
    const chip = document.createElement('div');
    chip.className = 'pick-chip';
    const img = document.createElement('img');
    const n = document.createElement('span');
    n.className = 'n'; n.textContent = p.en;
    const z = document.createElement('span');
    z.className = 'z'; z.textContent = p.zh;
    chip.append(img, n, z);
    chip.addEventListener('click', () => { sfx.pop(); els.picker.classList.add('hidden'); onPick(p.id); });
    els.pickerGrid.appendChild(chip);
    lazy.push({ img, thumb: p.thumb });
  }
  // 缩略图按时间预算分帧补上（全收集后召唤盘可能有几百只）
  let i = 0;
  const fillNext = () => {
    if (!els.pickerGrid.isConnected || els.picker.classList.contains('hidden')) return;
    const t0 = performance.now();
    while (i < lazy.length && performance.now() - t0 < 24) {
      const { img, thumb } = lazy[i++];
      try { img.src = typeof thumb === 'function' ? thumb() : thumb; } catch (e) { /* ignore */ }
    }
    if (i < lazy.length) requestAnimationFrame(fillNext);
  };
  requestAnimationFrame(fillNext);
  els.picker.classList.remove('hidden');
  els.picker.onclose = onClose;
}
els.pickerClose.addEventListener('click', () => els.picker.classList.add('hidden'));

// ---------- 图鉴（只看当前册：标题带上册名与本册进度） ----------
// 分页展示：每页 2×4 共 8 只，不出滚动条；已收集排前面
const CAT_PAGE_SIZE = 8;
let _catEntries = [], _catThumb = null, _catPage = 0;
function makeCatCard(e, lazyThumbs) {
  const d = document.createElement('div');
  d.className = 'cat-item ' + (e.hatched ? 'open' : 'locked') + (e.hungry ? ' hungry' : '');
  if (e.hatched) {
    const badge = e.evo ? '<span class="cat-badge">🌟进化</span>' : (e.rare ? '<span class="cat-badge">✨稀有</span>' : '');
    d.innerHTML = `${badge}<div class="ico"><span class="ico-ph">🐾</span></div>
      <div class="en">${e.word.en}</div><div class="zh">${e.word.zh}</div>`;
    d.title = (typeof e.word.story === 'string' && e.word.story) ? e.word.story : (e.word.hint || '');
    d.addEventListener('click', () => {
      toast(`「${e.word.en}」${e.word.zh} —— ${e.word.story}`, 4200);
      speak(e.word.en);
    });
    lazyThumbs.push({ d, w: e.word });
  } else {
    d.innerHTML = `<div class="ico">❓</div><div class="en">？？？</div><div class="zh">还没发现</div>`;
    d.title = '去岛上找找发光的词宠蛋吧！';
  }
  return d;
}
function renderCatalogPage(getThumb) {
  els.catalogGrid.innerHTML = '';
  const pages = Math.max(1, Math.ceil(_catEntries.length / CAT_PAGE_SIZE));
  _catPage = Math.max(0, Math.min(_catPage, pages - 1));
  const slice = _catEntries.slice(_catPage * CAT_PAGE_SIZE, _catPage * CAT_PAGE_SIZE + CAT_PAGE_SIZE);
  const lazyThumbs = [];
  for (const e of slice) els.catalogGrid.appendChild(makeCatCard(e, lazyThumbs));
  els.catalogInd.textContent = _catEntries.length ? `${_catPage + 1} / ${pages}` : '';
  els.catalogPager.classList.remove('hidden');   // 翻页器随图鉴打开（HTML 里初始是 hidden）
  els.catalogPrev.disabled = _catPage <= 0;
  els.catalogNext.disabled = _catPage >= pages - 1;
  // 缩略图分帧生成，不阻塞翻页
  let i = 0;
  const fillNext = () => {
    const grid = els.catalogGrid;
    if (!grid.isConnected) return;
    const t0 = performance.now();
    while (i < lazyThumbs.length && performance.now() - t0 < 24) {
      const { d, w } = lazyThumbs[i++];
      const ico = d.querySelector('.ico');
      if (ico && getThumb) {
        try {
          const url = getThumb(w);
          if (url) ico.innerHTML = `<img src="${url}" alt="">`;
        } catch (e) { /* 单张失败不影响其余 */ }
      }
    }
    if (i < lazyThumbs.length) requestAnimationFrame(fillNext);
  };
  requestAnimationFrame(fillNext);
}
export function openCatalog(entries, getThumb, meta = {}) {
  _catEntries = [...entries].sort((a, b) => (b.hatched ? 1 : 0) - (a.hatched ? 1 : 0));
  _catThumb = getThumb;
  _catPage = 0;
  const head = els.catalog ? els.catalog.querySelector('#catalog-head span') : null;
  if (head) {
    const opened = entries.filter(e => e.hatched).length;
    head.textContent = meta.bookLabel
      ? `📖 ${meta.bookLabel}图鉴 ${opened}/${entries.length}`
      : `📖 词宠图鉴`;
  }
  renderCatalogPage(getThumb);
  els.catalog.classList.remove('hidden');
}
els.catalogPrev.addEventListener('click', () => { if (_catPage > 0) { _catPage--; renderCatalogPage(_catThumb); sfx.pop(); } });
els.catalogNext.addEventListener('click', () => { if (_catPage < Math.ceil(_catEntries.length / CAT_PAGE_SIZE) - 1) { _catPage++; renderCatalogPage(_catThumb); sfx.pop(); } });
els.catalogClose.addEventListener('click', () => els.catalog.classList.add('hidden'));

// ---------- 小火车站 ----------
export function openStation(list, onPick, title = '🚂 小火车要开去哪座岛？') {
  els.pickerTitle.textContent = title;
  els.pickerGrid.innerHTML = '';
  for (const isl of list) {
    const chip = document.createElement('div');
    chip.className = 'pick-chip station-chip' + (isl.unlocked ? '' : ' locked');
    const img = document.createElement('span');
    img.className = 'st-emoji';
    img.textContent = isl.emoji;
    const n = document.createElement('span');
    n.className = 'n'; n.textContent = isl.name;
    const z = document.createElement('span');
    z.className = 'z'; z.textContent = isl.unlocked ? '已开放' : `🔒 ${isl.need}`;
    chip.append(img, n, z);
    if (isl.unlocked) chip.addEventListener('click', () => { sfx.pop(); els.picker.classList.add('hidden'); onPick(isl.key); });
    els.pickerGrid.appendChild(chip);
  }
  els.picker.classList.remove('hidden');
}

// ---------- 农场地图 ----------
export function openMap(data) {
  const cv = els.mapCanvas, c = cv.getContext('2d');
  cv.width = cv.height = 840;                  // 2 倍分辨率：小字在高清屏上不发虚（CSS 仍按原尺寸显示）
  const W = cv.width, H = cv.height;
  const k = W / 420;                           // 固定像素尺寸（字号/圆点/线宽）统一乘 k，保持观感不变
  const scale = W / 420;                       // 世界 ±210 都画进来（主岛 + 内圈主题岛 + 中圈短语岛 + 外圈拓展岛）
  const X = x => W / 2 + x * scale, Z = z => H / 2 + z * scale;
  c.clearRect(0, 0, W, H);
  // 文字白边：让小字在任何底色上都清晰
  const halo = (txt, x, y) => {
    c.lineWidth = 3.5 * k; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineJoin = 'round';
    c.strokeText(txt, x, y); c.fillText(txt, x, y);
  };
  // ---- 大海：渐变 + 圆角 + 小波纹 ----
  const sea = c.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#93D6F0');
  sea.addColorStop(1, '#6CB9E2');
  c.fillStyle = sea;
  c.beginPath(); c.roundRect(0, 0, W, H, 22 * k); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.6 * k; c.lineCap = 'round';
  for (const [wx, wz] of [[-88, -78], [-70, 70], [86, -60], [92, 84], [-96, 8], [58, 94], [-42, -94], [28, -86], [96, 22], [-88, 42]]) {
    c.beginPath(); c.arc(X(wx), Z(wz), 6 * k, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.beginPath(); c.arc(X(wx) + 13 * k, Z(wz) + 5 * k, 4.5 * k, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }
  // ---- 主岛：海沫圈 → 沙滩 → 草地渐变 → 描边 ----
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3 * k;
  c.beginPath(); c.arc(X(0), Z(0), 60 * scale, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#F2E2B3';
  c.beginPath(); c.arc(X(0), Z(0), 56 * scale, 0, Math.PI * 2); c.fill();
  const grass = c.createRadialGradient(X(0), Z(0) - 10 * scale, 8 * scale, X(0), Z(0), 56 * scale);
  grass.addColorStop(0, '#C7EDB0');
  grass.addColorStop(1, '#9BD283');
  c.fillStyle = grass;
  c.beginPath(); c.arc(X(0), Z(0), 52 * scale, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(110,158,94,.5)'; c.lineWidth = 2 * k;
  c.beginPath(); c.arc(X(0), Z(0), 52 * scale, 0, Math.PI * 2); c.stroke();
  // 南边沙滩 + 沙点
  c.fillStyle = '#F2E2B3';
  c.beginPath();
  c.moveTo(X(-34), Z(35.5));
  c.quadraticCurveTo(X(0), Z(33.5), X(34), Z(35.5));
  c.arc(X(0), Z(0), 52 * scale, Math.PI * 0.22, Math.PI * 0.78);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(201,164,107,.55)';
  for (const [sx, sz] of [[-26, 36], [-12, 37.5], [4, 36.8], [20, 37], [30, 34.5]]) {
    c.beginPath(); c.arc(X(sx), Z(sz), 0.9 * k, 0, Math.PI * 2); c.fill();
  }
  // ---- 森林（西）：一小片树 ----
  for (const [tx, tz, s] of [[-49, -4, 1.1], [-44, -9, 0.8], [-40, 0, 1], [-49, 8, 0.9], [-43, 12, 1.15], [-46, 3, 0.7], [-38, 6, 0.8]]) {
    c.fillStyle = '#8A6844';
    c.fillRect(X(tx) - 0.7 * k, Z(tz) - 1 * k, 1.4 * k, 3.2 * k);
    c.fillStyle = '#4E8E4E';
    c.beginPath(); c.arc(X(tx), Z(tz) - 2.6 * s * k, 3.1 * s * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6BAA5C';
    c.beginPath(); c.arc(X(tx) - 1.1 * s * k, Z(tz) - 2.1 * s * k, 1.5 * s * k, 0, Math.PI * 2); c.fill();
  }
  // ---- 河流：水带 + 两岸 + 波纹 ----
  const river = c.createLinearGradient(0, Z(-3.5), 0, Z(3.5));
  river.addColorStop(0, '#8FCEE9');
  river.addColorStop(0.5, '#A8DCF0');
  river.addColorStop(1, '#8FCEE9');
  c.fillStyle = river;
  c.fillRect(X(-53), Z(-3.5), 106 * scale, 7 * scale);
  c.strokeStyle = 'rgba(242,226,179,.9)'; c.lineWidth = 1.8 * k;
  c.beginPath(); c.moveTo(X(-53), Z(-3.5)); c.lineTo(X(53), Z(-3.5)); c.stroke();
  c.beginPath(); c.moveTo(X(-53), Z(3.5)); c.lineTo(X(53), Z(3.5)); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.45)';
  c.beginPath(); c.arc(X(-14), Z(0), 2.2 * k, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.beginPath(); c.arc(X(18), Z(1), 2.2 * k, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  // 码头（木头小平台）
  c.fillStyle = '#C89A6B';
  c.beginPath(); c.roundRect(X(-1.2), Z(-2.8), 2.4 * scale, 5.6 * scale, 2 * k); c.fill();
  c.strokeStyle = '#A87F52'; c.lineWidth = 1 * k;
  for (const pz of [-1.6, 0, 1.6]) {
    c.beginPath(); c.moveTo(X(-1.2), Z(pz)); c.lineTo(X(1.2), Z(pz)); c.stroke();
  }
  // 机关墙标记
  if (!data.gates || !data.gates.sandWall) {
    c.fillStyle = '#C9A46B';
    c.beginPath(); c.roundRect(X(-32), Z(37.6), 64 * scale, 1.6 * scale, 0.8 * k); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.8 * k;
    for (let bx = -30; bx <= 30; bx += 4) {
      c.beginPath(); c.moveTo(X(bx), Z(37.7)); c.lineTo(X(bx), Z(39.1)); c.stroke();
    }
  }
  if (!data.gates || !data.gates.vines) {
    c.fillStyle = '#3E7A44';
    c.beginPath(); c.roundRect(X(-39.6), Z(4.5), 1.6 * scale, 29 * scale, 0.8 * k); c.fill();
    c.beginPath(); c.roundRect(X(-39.6), Z(-33.5), 1.6 * scale, 29 * scale, 0.8 * k); c.fill();
    c.fillStyle = 'rgba(255,255,255,.22)';
    for (let vz = 6; vz <= 32; vz += 3.4) {
      c.beginPath(); c.arc(X(-38.8), Z(vz), 1.1 * k, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(X(-38.8), Z(-vz), 1.1 * k, 0, Math.PI * 2); c.fill();
    }
  }
  // 群岛（只画当前册的岛）：投影 → 沙圈 → 草面 → 高光（文字最后统一画，免得被蛋点盖住）
  const islTexts = [];
  for (const isl of data.islands || []) {
    const ix = X(isl.cx), iz = Z(isl.cz), ir = isl.r * scale;
    c.fillStyle = 'rgba(30,80,120,.16)';
    c.beginPath(); c.arc(ix, iz + 3 * k, ir, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F2E2B3';
    c.beginPath(); c.arc(ix, iz, ir + 2.6 * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = isl.unlocked ? '#BFE6A4' : '#D5DAE2';
    c.beginPath(); c.arc(ix, iz, ir, 0, Math.PI * 2); c.fill();
    c.strokeStyle = isl.unlocked ? 'rgba(92,168,92,.6)' : 'rgba(148,140,128,.5)';
    c.lineWidth = 1.6 * k;
    c.stroke();
    c.font = `${13 * k}px sans-serif`;
    c.textAlign = 'center';
    c.fillText(isl.emoji, ix, iz - ir + 14 * k);
    if (isl.name) islTexts.push({
      txt: isl.name.replace('岛', '').replace('大陆', ''), x: ix, y: iz + ir - 3 * k,
      col: isl.unlocked ? '#3E6B36' : '#8C8478', font: `bold ${11 * k}px "Microsoft YaHei"`,
    });
    if (isl.total) islTexts.push({
      txt: `${isl.hatched}/${isl.total}`, x: ix, y: iz + ir + 9 * k,
      col: isl.hatched >= isl.total ? '#D9941E' : '#6E9E5E', font: `${10 * k}px "Microsoft YaHei"`,
    });
  }
  // 火车站
  c.font = `${12 * k}px sans-serif`;
  halo('🚂', X(-9), Z(9.6) + 4 * k);
  // 区域（文字同样挪到最后画）
  const znTexts = [];
  for (const zn of data.zones) {
    const x = X(zn.x1), y = Z(zn.z1), w = (zn.x2 - zn.x1) * scale, h = (zn.z2 - zn.z1) * scale;
    c.strokeStyle = zn.discovered ? 'rgba(92,168,92,.8)' : 'rgba(185,172,158,.75)';
    c.lineWidth = 1.5 * k;
    c.setLineDash(zn.discovered ? [] : [5 * k, 4 * k]);
    c.fillStyle = zn.discovered ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.14)';
    c.beginPath(); c.roundRect(x, y, w, h, 8 * k); c.fill(); c.stroke();
    c.setLineDash([]);
    // 未发现的区域不再写"？？？"，只留虚线框，锁画在右上角，不挤名字
    if (zn.discovered) znTexts.push({
      txt: zn.name, x: x + w / 2, y: y + h / 2 - 3 * k, col: '#3E6B36',
      font: `bold ${11 * k}px "Microsoft YaHei"`,
    });
    // 区域唤醒进度：和主题岛一样标 hatched/total，孩子一眼知道哪里还有蛋没孵
    if (zn.discovered && zn.total) znTexts.push({
      txt: `${zn.hatched}/${zn.total}`, x: x + w / 2, y: y + h / 2 + 11 * k,
      col: zn.hatched >= zn.total ? '#D9941E' : '#6E9E5E', font: `${10 * k}px "Microsoft YaHei"`,
    });
    if (zn.locked) {
      c.font = `${9 * k}px sans-serif`;
      c.fillText('🔒', x + w - 7 * k, y + 9 * k);
    }
  }
  // 蛋点（粉=本关词宠蛋，金=天空蛋，蓝=剧情钥匙蛋）：先光晕后实体
  for (const e of data.eggs) {
    const ex = X(e.x), ez = Z(e.z);
    const col = e.golden ? '255,201,78' : e.key ? '74,144,217' : '255,159,182';
    c.fillStyle = `rgba(${col},.3)`;
    c.beginPath(); c.arc(ex, ez, 6.5 * k, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgb(${col})`;
    c.beginPath(); c.arc(ex, ez, 3 * k, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.2 * k; c.stroke();
  }
  // 玩家：呼吸圈 + 白边圆点
  const px = X(data.player.x), pz = Z(data.player.z);
  c.strokeStyle = 'rgba(74,144,217,.4)'; c.lineWidth = 1.6 * k;
  c.beginPath(); c.arc(px, pz, 8.5 * k, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#4A90D9';
  c.beginPath(); c.arc(px, pz, 4.6 * k, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2.4 * k; c.strokeStyle = '#fff'; c.stroke();
  // 文字最后画：地名/岛名带白边压在圆点上面，不会被蛋点或玩家标记盖住
  for (const t of [...islTexts, ...znTexts]) {
    c.fillStyle = t.col;
    c.font = t.font;
    halo(t.txt, t.x, t.y);
  }
  // 指南针（右上角）
  c.fillStyle = 'rgba(255,253,248,.8)';
  c.beginPath(); c.arc(W - 26 * k, 30 * k, 11 * k, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,224,168,.9)'; c.lineWidth = 1.4 * k; c.stroke();
  c.fillStyle = '#E0675A';
  c.beginPath();
  c.moveTo(W - 26 * k, 30 * k - 7 * k);
  c.lineTo(W - 26 * k - 3.4 * k, 30 * k + 4 * k);
  c.lineTo(W - 26 * k + 3.4 * k, 30 * k + 4 * k);
  c.closePath(); c.fill();
  c.fillStyle = '#8C8478';
  c.font = `bold ${7.5 * k}px sans-serif`;
  c.fillText('N', W - 26 * k, 30 * k + 8.6 * k);
  // 标题带上当前关卡
  const headSpan = els.mapHead.querySelector('span');
  if (headSpan) headSpan.textContent = '🗺️ Q淘族地图' + (data.chapterLabel ? ' · ' + data.chapterLabel : '');
  els.map.classList.remove('hidden');
}
if (els.mapClose) els.mapClose.addEventListener('click', () => els.map.classList.add('hidden'));

// ---------- 🎬 小小配音演员：选情景 → 逐句跟读配音 → 总结 + 配音卡分享 ----------
const DUB_SCENES = [
  { emoji: '🥚', name: '蛋宝宝出生啦', lines: ['Hello, world!', 'I am so happy!', 'Welcome, my friend!'] },
  { emoji: '🏙️', name: '欢迎来到我们的城市', lines: ['Welcome to our city!', 'So many yummy foods!', "Let's have fun together!"] },
  { emoji: '🎂', name: '词宠过生日', lines: ['Happy birthday to me!', 'What a lovely cake!', 'Best day ever!'] },
  { emoji: '🚂', name: '小火车出发啦', lines: ['All aboard!', 'Off we go!', 'What a beautiful country!'] },
];
export function showDubStudio() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '125';
  ov.innerHTML = `<div id="dub-card">
    <button class="round-btn small" id="dub-close" style="position:absolute;top:12px;right:12px">✕</button>
    <div class="dub-t">🎬 小小配音演员</div>
    <div class="dub-sub">选一个情景，把每句台词大声配出来！每句 80 分 +1⭐，整部完成再 +1⭐</div>
    <div class="dub-scenes">${DUB_SCENES.map((s, i) =>
      `<button type="button" class="dub-scene" data-i="${i}"><span>${s.emoji}</span><b>${s.name}</b><i>${s.lines.length} 句台词</i></button>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#dub-close').onclick = () => { sfx.pop(); ov.remove(); };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelectorAll('.dub-scene').forEach(b => {
    b.onclick = () => { sfx.pop(); ov.remove(); _dubFlow(DUB_SCENES[Number(b.dataset.i)], 0, []); };
  });
}
function _dubFlow(scene, idx, scores) {
  if (idx >= scene.lines.length) { _dubSummary(scene, scores); return; }
  const line = scene.lines[idx];
  let advanced = false;
  openChallenge({
    word: { en: line, zh: `台词 ${idx + 1}/${scene.lines.length}`, hint: '进入角色，大声把台词配出来！' },
    mode: 'practice', noSpell: true,
    title: `🎬 配音「${scene.name}」`,
    onSuccess: res => {
      advanced = true;
      closeChallenge();
      scores.push(res.score || 0);
      if ((res.score || 0) >= 80) {
        addStars(1); updateStars(getStars());
        toast(`🎬 第 ${idx + 1} 句配音到位 +1⭐`, 2600);
      } else {
        toast('感情再充沛一点，80 分才过关哦', 2600);
      }
      setTimeout(() => _dubFlow(scene, idx + 1, scores), 500);
    },
    onSkip: () => {
      advanced = true;
      closeChallenge();
      scores.push(0);
      toast('这句先跳过，等会还能重新配～', 2600);
      setTimeout(() => _dubFlow(scene, idx + 1, scores), 400);
    },
    onClose: () => {
      // 中途退出（没读到结果就关了）：已配的句子给个总结，别让进度白费
      if (!advanced) setTimeout(() => _dubSummary(scene, scores), 300);
    },
  });
}
function _dubSummary(scene, scores) {
  if (!scores.length) return;   // 一句都没配：直接走人
  const done = scores.length === scene.lines.length;
  const allPass = done && scores.every(s => s >= 80);
  if (allPass) {
    addStars(1); updateStars(getStars());   // 整部完成奖励
    sfx.great();
  }
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.zIndex = '125';
  ov.innerHTML = `<div id="dub-card">
    <button class="round-btn small" id="dub-close" style="position:absolute;top:12px;right:12px">✕</button>
    <div class="dub-t">${scene.emoji} 「${scene.name}」配音成绩单</div>
    <div class="dub-lines">${scene.lines.map((l, i) =>
      `<div class="dub-line">${scores[i] != null ? `<i>${scores[i] >= 80 ? '🌟' : '🎙️'}</i>` : '<i>⬜</i>'}<b>${l}</b><em>${scores[i] != null ? scores[i] + ' 分' : '还没配'}</em></div>`).join('')}
    </div>
    <div class="dub-rs">${allPass ? '🏆 整部配音完成！+1⭐' : done ? '配音完成！想拿满星就再配一次吧' : '已配 ' + scores.length + '/' + scene.lines.length + ' 句，下次接着来'}</div>
    <button class="dub-again">🎬 再配一次</button>
    <button class="dub-share">📸 生成配音卡分享</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#dub-close').onclick = () => { sfx.pop(); ov.remove(); };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  ov.querySelector('.dub-again').onclick = () => { sfx.pop(); ov.remove(); _dubFlow(scene, 0, []); };
  ov.querySelector('.dub-share').onclick = () => {
    sfx.pop();
    openShareCard({
      title: scene.name, en: 'Dubbing Show', emoji: scene.emoji,
      rows: [
        `🎙️ 配音演员：${getUsername() || '小小淘气'}`,
        ...scene.lines.map((l, i) => `"${l}" · ${scores[i] != null ? scores[i] + ' 分' : '未配'}`),
        `⭐ 词宠已收集 ${hatchedCount()} 只 · 📅 ${new Date().toLocaleDateString('zh-CN')}`,
      ],
    });
  };
}

// ---------- 课本朗读练习 ----------
let bookOv = null;

export function showBookPanel(data) {
  if (!bookOv) {
    bookOv = document.createElement('div');
    bookOv.className = 'overlay';
    bookOv.id = 'book-panel';
    document.body.appendChild(bookOv);
    bookOv.addEventListener('click', e => { if (e.target === bookOv) bookOv.classList.add('hidden'); });
  }
  const chips = data.sems.map(s =>
    `<button class="book-chip ${s.active ? 'active' : ''}" data-k="${s.key}">${s.label}</button>`).join('');
  const rows = data.units.map((u, i) => {
    const done = u.scores && u.scores.length === u.total;
    const avg = u.scores && u.scores.length
      ? Math.round(u.scores.reduce((a, b) => a + b, 0) / u.scores.length) : null;
    return `<div class="book-row">
      <div class="bi"><div class="bn">${u.name}</div>
        <div class="bp">${done ? '✅ 已完成' : '📖 共 ' + u.total + ' 个词/短语'}${avg != null ? ' · 平均 ' + avg + ' 分' : ''}</div></div>
      <button class="book-go" data-i="${i}">${done ? '再练一遍' : '开始朗读'}</button>
    </div>`;
  }).join('');
  bookOv.innerHTML = `
    <div id="book-card">
      <div id="book-head">
        <span>📚 课本朗读练习</span>
        <button id="book-close" class="round-btn small">✕</button>
      </div>
      <div id="book-sems">${chips}</div>
      <button id="book-quick" class="book-go">🎯 本学期 3 分钟挑战 · 随机 5 题</button>
      <div id="book-units">${rows}</div>
      <div id="book-tip">选单元 → 听发音 → 点麦克风跟读 → 得分！<br>点上面的册名可以<b>换一册</b>，小岛会跟着换新词哦</div>
    </div>`;
  bookOv.classList.remove('hidden');
  bookOv.querySelectorAll('.book-chip').forEach(b =>
    b.addEventListener('click', () => { sfx.pop(); data.onSelect(b.dataset.k); }));
  bookOv.querySelectorAll('.book-go').forEach(b =>
    b.addEventListener('click', () => {
      sfx.pop(); bookOv.classList.add('hidden');
      if (b.id === 'book-quick') data.onQuickRound && data.onQuickRound();
      else data.onStart(+b.dataset.i);
    }));
  bookOv.querySelector('#book-close').addEventListener('click', () => bookOv.classList.add('hidden'));
}
export function closeBookPanel() { if (bookOv) bookOv.classList.add('hidden'); }

// ---------- 许愿井星星商店 ----------
let shopOv = null;
export function showShop({ stars, items, onBuy, onToggle }) {
  if (!shopOv) {
    shopOv = document.createElement('div');
    shopOv.className = 'overlay';
    shopOv.id = 'shop';
    document.body.appendChild(shopOv);
    shopOv.addEventListener('click', e => { if (e.target === shopOv) shopOv.classList.add('hidden'); });
  }
  const rows = items.map(it => {
    const state = !it.owned
      ? `<button class="shop-buy" data-id="${it.id}">⭐ ${it.price} 换</button>`
      : it.on
        ? `<button class="shop-wear on" data-id="${it.id}">穿着中</button>`
        : `<button class="shop-wear" data-id="${it.id}">穿上</button>`;
    return `<div class="shop-row${it.owned ? ' owned' : ''}">
      <div class="shop-emoji">${it.emoji}</div>
      <div class="shop-info"><div class="shop-name">${it.name}</div><div class="shop-desc">${it.desc}</div></div>
      ${state}
    </div>`;
  }).join('');
  shopOv.innerHTML = `
    <div id="shop-card">
      <div id="shop-head">
        <span>⛲ 许愿井 · 星星商店</span>
        <span id="shop-stars">⭐ ${stars}</span>
        <button id="shop-close" class="round-btn small">✕</button>
      </div>
      <div class="shop-tip">读单词、喂词宠、解谜题都能赚星星！</div>
      <div id="shop-list">${rows}</div>
    </div>`;
  shopOv.classList.remove('hidden');
  shopOv.querySelector('#shop-close').onclick = () => shopOv.classList.add('hidden');
  shopOv.querySelectorAll('.shop-buy').forEach(b => b.addEventListener('click', () => {
    const it = items.find(i => i.id === b.dataset.id);
    sfx.pop(); onBuy && onBuy(it);
  }));
  shopOv.querySelectorAll('.shop-wear').forEach(b => b.addEventListener('click', () => {
    const it = items.find(i => i.id === b.dataset.id);
    sfx.pop(); onToggle && onToggle(it);
  }));
}

// ---------- 每日任务板 ----------
let dailyOv = null;
export function showDailyBoard({ quest, stars }) {
  if (!dailyOv) {
    dailyOv = document.createElement('div');
    dailyOv.className = 'overlay';
    dailyOv.id = 'daily-board';
    document.body.appendChild(dailyOv);
    dailyOv.addEventListener('click', e => { if (e.target === dailyOv) dailyOv.classList.add('hidden'); });
  }
  const pct = Math.min(100, Math.round(quest.n / quest.goal * 100));
  dailyOv.innerHTML = `
    <div id="daily-card">
      <div id="daily-head">
        <span>📌 今日任务</span>
        <span id="daily-stars">⭐ ${stars}</span>
        <button id="daily-close" class="round-btn small">✕</button>
      </div>
      <div id="daily-quest-text">${quest.text}</div>
      <div id="daily-bar"><div id="daily-bar-fill" style="width:${pct}%"></div></div>
      <div id="daily-progress">${quest.done ? '🎉 已完成！奖励已到手' : `进度 ${Math.min(quest.n, quest.goal)}/${quest.goal} · 完成奖 ⭐5`}</div>
      <div id="daily-tip">每天来任务板看看，任务会换新的哦～</div>
    </div>`;
  dailyOv.classList.remove('hidden');
  dailyOv.querySelector('#daily-close').onclick = () => dailyOv.classList.add('hidden');
}

// ---------- 开场引导 ----------
export function playIntro(onDone, isTouch = false, bookLabel = '', total = 0) {
  const move = isTouch
    ? '用左下角<b>摇杆</b>走路，<b>跳</b>按钮蹦一蹦，<br>屏幕上拖动转视角，双指缩放。'
    : '用 <b>W A S D</b> 或方向键走路，按<b>空格</b>跳一跳，<br>方向键+空格能向前跳，右键拖动转视角。';
  const steps = [
    ['🌼', `欢迎来到 <b>Q淘族</b>！<br>现在玩的是 <b>${bookLabel || '你的课本'}</b>，<br>你的家乡城市里住着 <b>${total || '好多'}</b> 只词宠，<br>它们只会为<b>会说英文的小朋友</b>孵化哦。`],
    ['🎮', move],
    ['🥚', isTouch
      ? '走近<b>发光的蛋</b>，点一点它，<br>先听发音，再<b>点 🎤 大声读出来</b>，<br>10 秒内读完会自动打分，还能赚 <b>⭐星星</b>！'
      : '走近<b>发光的蛋</b>，按 <b>E</b> 打开它，<br>先听发音，再<b>点 🎤 大声读出来</b>，<br>10 秒内读完会自动打分，还能赚 <b>⭐星星</b>！'],
    ['🤔', '遇到<b>谜题</b>时，读懂谜面，<b>召唤对的那只词宠</b>来帮忙！<br>一次答对奖励 3⭐，攒够星星去<b>许愿井</b>换装扮～'],
    ['🐾', '词宠饿了还会找你<b>复习</b>，<br>孵完一关就坐<b>小火车/飞机</b>去下一座城市，<br>路上点一点<b>大学/美食/风景牌子</b>长知识！<br>想玩别的年级？点「课本」换一册就行！'],
  ];
  let i = 0;
  const show = () => {
    els.introEmoji.textContent = steps[i][0];
    els.introText.innerHTML = steps[i][1];
    els.introNext.textContent = i === steps.length - 1 ? '出发！' : '好呀！';
  };
  els.intro.classList.remove('hidden');
  show();
  els.introNext.onclick = () => {
    sfx.pop();
    i++;
    if (i >= steps.length) {
      els.intro.classList.add('hidden');
      onDone && onDone();
    } else show();
  };
}

// ---------- 帮助 ----------
export function showHelp() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const touchLines = matchMedia('(pointer: coarse)').matches
    ? `<div>🕹️ 摇杆走路 · <b>跳</b>按钮蹦一蹦 · 手指转视角</div>`
    : `<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走路 · 鼠标右键转视角</div>
       <div><kbd>空格</kbd> 跳一跳 · <kbd>E</kbd> 或点一下：互动</div>`;
  ov.innerHTML = `
    <div id="help-card">
      <h3>🌼 怎么玩</h3>
      ${touchLines}
      <div>🥚 走近发光的蛋，点一下唤醒词宠</div>
      <div>🔑 蓝光蛋是开剧情的钥匙，不算关数</div>
      <div>🎤 点 🎤 大声读，读得准就赚星星</div>
      <div>🗺️ 找不到路？点地图，跟金色箭头走</div>
      <div>🤔 被挡住？召唤对的词宠解谜题</div>
      <div>🍖 词宠饿了会想你，回去喂喂它</div>
      <div>⛲ 星星能换帽子和魔法棒</div>
      <div class="accent-row" style="margin-top:8px">🗣️ 发音口音：
        <label class="accent-opt"><input type="radio" name="accent" value="uk"><span>🇬🇧 英式</span></label>
        <label class="accent-opt"><input type="radio" name="accent" value="us"><span>🇺🇸 美式</span></label>
      </div>
      <button id="help-close" class="round-btn small" style="position:absolute;top:14px;right:14px">✕</button>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.id === 'help-close') ov.remove(); });
  document.body.appendChild(ov);
  // 口音单选（影响 TTS 兜底嗓音；有真人录音的单词仍是录音）——当前口音直接亮出来
  const radios = ov.querySelectorAll('input[name="accent"]');
  const paint = () => {
    radios.forEach(r => { r.checked = getAccent() === r.value; r.closest('.accent-opt').classList.toggle('on', r.checked); });
  };
  paint();
  radios.forEach(r => r.addEventListener('change', () => {
    if (!r.checked) return;
    setAccent(r.value);
    paint();
    speak('hello');
  }));
}

// ---------- 右上角菜单：点 ☰ 展开 / 点别处或选项后收起 ----------
export function toggleHudMenu(show) {
  if (!els.hudMenu) return;
  const open = show != null ? show : els.hudMenu.classList.contains('hidden');
  els.hudMenu.classList.toggle('hidden', !open);
  if (open) refreshMenuScore();   // 手机端顶栏没有分数：打开菜单时刷新明细行
  if (els.btnMenu) els.btnMenu.textContent = open ? '✕' : '☰';
}

// ---------- 关于：品牌信息全部来自 game/data/app.json，fork 换皮不用改代码 ----------
export async function showAbout() {
  const app = await loadAppConfig();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const link = (s) => s && s.url ? `<a class="about-link" href="${s.url}" target="_blank" rel="noopener">${s.label || s.url}</a>` : '';
  const row = (icon, label, val) => val ? `<div class="about-row"><span>${icon} ${label}</span>${val}</div>` : '';
  ov.innerHTML = `
    <div id="about-card">
      <button class="round-btn small" id="about-close" style="position:absolute;top:14px;right:14px">✕</button>
      <div class="about-emoji">${app.emoji || '🥚'}</div>
      <h3>${app.appName} ${app.appNameEn || ''}</h3>
      <div class="about-sub">${app.tagline || ''}</div>
      <div class="about-rows">
        ${row('🎮', '游戏地址', link(app.site))}
        ${row('🧩', '开源仓库', link(app.repo))}
        ${row('✍️', '作者', app.author ? `<b>${app.author}</b>` : '')}
        ${row('🌏', '官方网站', link(app.authorSite))}
      </div>
      <div class="about-tip">${app.appName} · ${app.slogan || ''}${app.license ? ` · ${app.license} License` : ''}</div>
    </div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.id === 'about-close') ov.remove(); });
  document.body.appendChild(ov);
  sfx.pop();
}

// ---------- 背景音乐跟随弹窗状态：有弹窗淡出，全关了才淡入 ----------
function hasOpenDialog() {
  return Array.from(document.querySelectorAll('.overlay')).some(el =>
    !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none');
}
let bgmWatchReady = false;
let bgmWatchPending = false;
function watchBgmDialogs() {
  if (bgmWatchReady) return;
  bgmWatchReady = true;
  const update = () => {
    bgmWatchPending = false;
    updateBgm(hasOpenDialog());
  };
  const schedule = () => {   // rAF 合并 MutationObserver 的密集通知
    if (bgmWatchPending) return;
    bgmWatchPending = true;
    requestAnimationFrame(update);
  };
  // 覆盖：静态弹窗的 class 开关 + 动态创建的弹窗（排行榜/商店/帮助等 append 到 body）
  new MutationObserver(schedule).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  setInterval(schedule, 800); // 兜底：display 等不走 class 的显隐
  document.addEventListener('visibilitychange', schedule);
  update();
}

// ---------- 绑定 HUD 按钮 ----------
export function bindHUD({ onCatalog, onHelp, onBook, onSummon, onPrompt, onMap, onHungryPill, onMic, onMicEnd, onRank, onReport, onAccount, onAbout, isTouch }) {
  isTouchMode = !!isTouch;
  els.btnCatalog.addEventListener('click', onCatalog);
  els.btnHelp.addEventListener('click', showHelp);
  const aboutBtn = document.getElementById('btn-about');
  if (aboutBtn) aboutBtn.addEventListener('click', onAbout);
  const rankBtn = document.getElementById('btn-rank');
  if (rankBtn) rankBtn.addEventListener('click', onRank);
  const reportBtn = els.btnReport;
  if (reportBtn) reportBtn.addEventListener('click', onReport);
  if (els.btnAccount) els.btnAccount.addEventListener('click', onAccount);
  // 左上角头像 pill 本身就写着"学习档案"，点它直接开档案（和菜单里的「我的档案」一样）
  if (els.userPill) els.userPill.addEventListener('click', onAccount);
  if (els.leaderboardRefresh) els.leaderboardRefresh.addEventListener('click', () => refreshLeaderboard());
  initLeaderboardFold();
  watchBgmDialogs();
  const bgmBtn = document.getElementById('btn-bgm');
  if (bgmBtn) {
    const label = bgmBtn.querySelector('span');
    const paint = () => { if (label) label.textContent = isBgmMuted() ? '音乐：关' : '音乐：开'; };
    paint();
    bgmBtn.addEventListener('click', () => {
      setBgmMuted(!isBgmMuted());
      paint();
      toast(isBgmMuted() ? '🎵 背景音乐已关' : '🎵 背景音乐已开');
    });
  }
  const summonBtn = document.getElementById('btn-summon');
  if (summonBtn) summonBtn.addEventListener('click', onSummon);
  const mapBtn = document.getElementById('btn-map');
  if (mapBtn) mapBtn.addEventListener('click', onMap);
  const bookBtn = document.getElementById('btn-book');
  if (bookBtn) bookBtn.addEventListener('click', onBook);
  const dubBtn = document.getElementById('btn-dub');
  if (dubBtn) dubBtn.addEventListener('click', showDubStudio);
  // 菜单：点 ☰ 展开/收起；点菜单里的项执行完顺手收起
  if (els.btnMenu) els.btnMenu.addEventListener('click', e => { e.stopPropagation(); toggleHudMenu(); });
  if (els.hudMenu) {
    els.hudMenu.addEventListener('click', e => e.stopPropagation());
    els.hudMenu.querySelectorAll('.menu-item').forEach(b => b.addEventListener('click', () => toggleHudMenu(false)));
  }
  document.addEventListener('click', e => {
    if (els.hudMenu && !els.hudMenu.classList.contains('hidden')) toggleHudMenu(false);
  });
  // 交互提示可以直接点（手机上主要交互方式）
  els.prompt.addEventListener('click', onPrompt);
  if (isTouch) els.promptKey.textContent = '👆';
  els.hungryPill.addEventListener('click', onHungryPill);
  ch.onMic = onMic;
  ch.onMicEnd = onMicEnd;
}

export function setMicHint(text) {
  els.voiceFeedback.textContent = text;
}
