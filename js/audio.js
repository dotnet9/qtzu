// 发音播放：优先预生成语音文件（<audio>，手机浏览器最稳），TTS 仅兜底
// 另含 WebAudio 小音效

// ---------- 语音文件 ----------
let manifest = null;
fetch('audio/manifest.json').then(r => r.ok ? r.json() : null).then(m => manifest = m).catch(() => { manifest = null; });

const audioCache = {};
let currentAudio = null;

// 语音双轨互斥的总开关：<audio> 文件播放前停 TTS，TTS 播放前停 <audio>，
// 否则"单词文件缺失走 TTS 兜底"和"喝彩兜底/回放录音"会叠出双声
function stopTts() {
  try { if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

function stopAllPlayback() {
  if (currentAudio) { try { currentAudio.pause(); } catch (e) { /* ignore */ } currentAudio = null; }
  stopTts();
}

// 喇叭此刻是否在出声（录音层用来判断"缓冲是否可能被外放音污染"）
export function isSpeaking() {
  if (currentAudio && !currentAudio.paused) return true;
  try { if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) return true; } catch (e) { /* ignore */ }
  return false;
}

function playFile(url, { cache = true } = {}) {
  return new Promise(resolve => {
    try {
      // 互斥：新播放立刻掐掉上一段（含 TTS），避免连点出现重音/双声
      stopAllPlayback();
      let a = cache ? audioCache[url] : null;
      if (!a) { a = new Audio(url); if (cache) audioCache[url] = a; }
      const done = ok => { a.onended = a.onerror = null; a.onloadedmetadata = null; if (currentAudio === a) currentAudio = null; resolve(ok); };
      a.onended = () => done(true);
      a.onerror = () => done(false);
      try { a.currentTime = 0; } catch (e) { /* ignore */ }
      currentAudio = a;
      a.play().catch(() => done(false));
    } catch (e) { resolve(false); }
  });
}

// 播放并顺便给出时长（秒），用于跟读音节的视觉同步
function playFileMeta(url) {
  return new Promise(resolve => {
    try {
      stopAllPlayback();
      const a = new Audio(url);
      const finish = (ok, dur) => { a.onended = a.onerror = a.onloadedmetadata = null; if (currentAudio === a) currentAudio = null; resolve({ ok, dur: dur || 0 }); };
      a.onloadedmetadata = () => {
        const dur = isFinite(a.duration) ? a.duration : 0;
        // 互斥播放
        currentAudio = a;
        a.play().then(() => finish(true, dur)).catch(() => finish(false, dur));
      };
      a.onerror = () => finish(false);
      a.load();
      // 某些浏览器不触发 loadedmetadata 的兜底
      setTimeout(() => { if (a.paused && a.currentTime === 0 && currentAudio !== a) finish(false); }, 2500);
    } catch (e) { resolve({ ok: false, dur: 0 }); }
  });
}

// key 形如 "word/cat" / "word/good-morning" / "syl/ap" / "letter/c"
function fileKey(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
async function tryFile(key) {
  if (!manifest || !manifest[key]) return false;
  return playFile(manifest[key]);
}
async function tryFileMeta(key) {
  if (!manifest || !manifest[key]) return { ok: false, dur: 0 };
  return playFileMeta(manifest[key]);
}

// ---------- TTS 兜底 ----------
let enVoice = null;

// 口音偏好：us 美式 / uk 英式（只影响 TTS 兜底的嗓音选择，语音文件不受影响）
let accent = 'us';
try { accent = localStorage.getItem('voice-accent') === 'uk' ? 'uk' : 'us'; } catch (e) { /* ignore */ }
export function getAccent() { return accent; }
export function setAccent(a) {
  accent = a === 'uk' ? 'uk' : 'us';
  try { localStorage.setItem('voice-accent', accent); } catch (e) { /* ignore */ }
  enVoice = null;
  pickVoice();
}

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  if (!vs.length) return;
  const prefer = accent === 'uk'
    ? ['Sonia', 'Libby', 'Hazel', 'Google UK English Female', 'Daniel']
    : ['Aria', 'Jenny', 'Zira', 'Google US English', 'Samantha'];
  const lang = accent === 'uk' ? /en[-_]GB/i : /en[-_]US/i;
  for (const p of prefer) {
    const v = vs.find(v => lang.test(v.lang) && v.name.includes(p));
    if (v) { enVoice = v; return; }
  }
  enVoice = vs.find(v => lang.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || vs[0];
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function tts(text, { rate = 0.8, pitch = 1.05, onEnd } = {}) {
  if (!('speechSynthesis' in window)) { if (onEnd) setTimeout(onEnd, 300); return; }
  try {
    // Chrome 下 cancel 后立刻 speak 会吞掉声音：先停再延迟播
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      setTimeout(() => tts(text, { rate, pitch, onEnd }), 120);
      return;
    }
    // 双轨互斥：TTS 出声前掐掉正在播的 <audio>，否则两路声音叠一起
    if (currentAudio) { try { currentAudio.pause(); } catch (e) { /* ignore */ } currentAudio = null; }
  } catch (e) { /* ignore */ }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  u.pitch = pitch;
  if (!enVoice) pickVoice();
  if (enVoice) u.voice = enVoice;
  if (onEnd) u.onend = onEnd;
  u.onerror = () => { if (onEnd) onEnd(); };
  speechSynthesis.speak(u);
}

// 对外发音入口：单词/短语/音节/字母 自动匹配语音文件（喝彩播放中会礼貌排队）
export async function speak(text, { rate = 0.8, onEnd } = {}) {
  const raw = String(text).trim();
  const fk = fileKey(raw);
  const go = async () => {
    if (fk) {
      if (await tryFile(`word/${fk}`)) { if (onEnd) onEnd(); return; }
      const t = fk.replace(/-/g, '');
      if (t && t.length === 1 && await tryFile(`letter/${t}`)) { if (onEnd) onEnd(); return; }
      if (raw.includes(' ') || fk.includes('-')) { /* 多词短语没有独立文件时走 TTS */ }
    }
    tts(raw, { rate, onEnd });
  };
  waitCheer(go);
}

// 慢速单词（有专门录的慢速文件）
export function speakSlow(word, onEnd) {
  waitCheer(() => {
    tryFile('word/' + fileKey(word) + '_slow').then(ok => { if (!ok) tts(word, { rate: 0.55, onEnd }); else if (onEnd) onEnd(); });
  });
}

// 跟读：播放整词慢速标准音（真人录音变速），音节只做视觉高亮同步，不再单独念音节
// （拆开的音节交给 TTS 念会走调，比如 ter/ple/rab，听感就是“乱读”）
export function speakFollow(word, syl, onSyl, onEnd) {
  const parts = syl && syl.length ? syl : [word];
  const estimate = Math.max(0.7, parts.length * 0.42);
  const schedule = dur => {
    const per = Math.max(0.22, dur / parts.length);
    parts.forEach((_, i) => setTimeout(() => onSyl && onSyl(i), per * 1000 * i));
    if (onEnd) setTimeout(onEnd, Math.max(dur, per * parts.length) * 1000 + 80);
  };
  tryFileMeta('word/' + fileKey(word) + '_slow').then(res => {
    if (res.ok) schedule(res.dur || estimate);
    else {
      tts(word, { rate: 0.55 });
      schedule(Math.max(0.8, word.length * 0.09));
    }
  });
}

// 立刻停下正在播的发音（点麦克风开口前调用，避免示范音压过孩子的声音）
export function stopSpeaking() {
  if (currentAudio) { try { currentAudio.pause(); } catch (e) { /* ignore */ } currentAudio = null; }
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

// 回放小朋友自己的录音（blob URL，不进缓存）
export function playRecording(url, onEnd) {
  return playFile(url, { cache: false }).then(ok => { if (onEnd) onEnd(); return ok; });
}

// 逐字母
export function spellLetters(word, onEnd) {
  waitCheer(() => {
    const w = word.toLowerCase();
    let i = 0;
    const next = () => {
      if (i >= w.length) { if (onEnd) onEnd(); return; }
      const ch = w[i++];
      tryFile('letter/' + ch).then(ok => {
        if (ok) setTimeout(next, 200);
        else tts(ch, { rate: 0.55, onEnd: () => setTimeout(next, 200) });
      });
    };
    next();
  });
}

// 劲舞团式评分喝彩：Perfect / Great / Cool / Nice / Bad / Miss
// 优先播放预生成的情绪童声（audio/fx/，AnaNeural），缺文件时用 TTS 提调兜底；
// 播放期间上锁，保证喝彩完整播完再轮到单词发音
export function scoreVoice(score) {
  const key = score >= 95 ? 'perfect' : score >= 85 ? 'great' : score >= 75 ? 'cool'
    : score >= 60 ? 'nice' : score >= 40 ? 'bad' : 'miss';
  const texts = { perfect: 'Perfect!', great: 'Great!', cool: 'Cool!', nice: 'Nice try!', bad: 'Oh, bad...', miss: 'Miss...' };
  const happy = score >= 60;
  tryFileMeta('fx/' + key).then(res => {
    // 实测时长 + 余量上锁；拿不到时长就按 1.2 秒估
    cheerUntil = Date.now() + (res.ok && res.dur ? res.dur * 1000 + 150 : 1200);
    if (!res.ok) tts(texts[key], { rate: happy ? 1 : 0.85, pitch: happy ? 1.35 : 0.8 });
  });
}

// ---------- WebAudio 小音效 ----------
let actx = null;
function ctx() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 无声环境 */ }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}

// 喝彩独占期：Perfect!/Great! 这类带情绪的喝彩播放期间，后面的单词发音排队等待，别把喝彩掐断
let cheerUntil = 0;
function waitCheer(fn) {
  const d = cheerUntil - Date.now();
  if (d > 0) setTimeout(fn, d + 60);
  else fn();
}

function tone(freq, t0, dur, type = 'sine', gain = 0.16) {
  const a = ctx();
  if (!a) return;
  // 参数不合法直接忽略：音效只是点缀，绝不能在主循环里抛异常把渲染卡死
  if (!Number.isFinite(freq + t0 + dur + gain)) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0);
  o.stop(a.currentTime + t0 + dur + 0.05);
}

export const sfx = {
  pop() { tone(520, 0, 0.12, 'sine'); tone(780, 0.06, 0.14, 'sine', 0.1); },
  good() { tone(523, 0, 0.15); tone(659, 0.1, 0.15); tone(784, 0.2, 0.28); },
  great() { tone(523, 0, 0.13); tone(659, 0.09, 0.13); tone(784, 0.18, 0.13); tone(1047, 0.27, 0.4); },
  miss() { tone(300, 0, 0.18, 'triangle', 0.12); tone(240, 0.14, 0.22, 'triangle', 0.1); },
  crack() { tone(180, 0, 0.1, 'square', 0.08); tone(140, 0.08, 0.12, 'square', 0.06); },
  magic() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.09)); },
  // 脚步：很轻的沙沙声，音高带一点随机免得像打拍子
  step() { tone(140 + Math.random() * 70, 0, 0.05, 'sine', 0.018); },
  boing() { tone(170, 0, 0.1, 'sine', 0.13); tone(560, 0.06, 0.22, 'sine', 0.1); },
  // 进化：上行琶音 + 高音闪亮收尾
  evolve() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'sine', 0.1));
    tone(1319, 0.5, 0.5, 'sine', 0.12);
  },
  // 摸摸头：软软的两声轻响
  pat() { tone(660, 0, 0.1, 'sine', 0.08); tone(880, 0.08, 0.12, 'sine', 0.06); },
  // 进入新区域：小小的亮相音
  zone() { tone(523, 0, 0.12, 'sine', 0.07); tone(659, 0.09, 0.14, 'sine', 0.06); },
};

// ---------- 轻快背景音乐（WebAudio 程序化作曲，零下载） ----------
// 不用音乐素材文件：旋律/低音/和弦全部用振荡器现场合成，8 小节无缝循环。
// 弹窗（.overlay）打开时淡出、全部关闭后淡入；浏览器要求首次点击后才能出声，
// 所以在第一次 pointerdown/keydown 时解锁。
const BGM_MUTE_KEY = 'bgm-muted';
let bgmMuted = false;
try { bgmMuted = localStorage.getItem(BGM_MUTE_KEY) === '1'; } catch (e) { /* 隐私模式忽略 */ }
let bgmWanted = false;   // ui 层告知的期望状态：true = 当前没有弹窗、可以放
let bgmOn = false;       // 是否正在调度播放
let bgmGain = null;      // BGM 总音量（淡入淡出）
let bgmTimer = null;
let bgmBar = 0;          // 循环到第几小节
let bgmNextBarTime = 0;  // 下一小节的 AudioContext 时间
let bgmFever = false;    // FEVER 连击：升调 + 加速，下一小节起生效

export function setBgmFever(on) { bgmFever = !!on; }

// 三种区域情绪：农场明亮轻快 / 海滩舒缓慵懒 / 森林低回神秘；换区在下一小节自然过渡
const N = { E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, C3: 130.81, G3: 196.00, A3: 220.00, B3: 246.94, F3: 174.61,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, C5: 523.25, D5: 587.33, E5: 659.26 };
const CHORDS_FARM = [
  { bass: N.C3, pad: [N.C4, N.E4, N.G4] },
  { bass: N.G2, pad: [N.B3, N.D4, N.G4] },
  { bass: N.A2, pad: [N.A3, N.C4, N.E4] },
  { bass: N.F2, pad: [N.A3, N.C4, N.F3] },
];
const MEL_FARM = [
  [[0, N.E4, 1], [1, N.G4, .5], [1.5, N.A4, .5], [2, N.G4, 1], [3, N.E4, 1]],
  [[0, N.D4, 1], [1, N.E4, .5], [1.5, N.D4, .5], [2, N.G4, 1], [3, N.D4, 1]],
  [[0, N.E4, 1], [1, N.G4, .5], [1.5, N.A4, .5], [2, N.C5, 1.5], [3.5, N.A4, .5]],
  [[0, N.G4, 1], [1, N.E4, 1], [2, N.D4, 1], [3, N.C4, 1]],
  [[0, N.E4, 1], [1, N.G4, .5], [1.5, N.A4, .5], [2, N.G4, 1], [3, N.E4, 1]],
  [[0, N.D4, 1], [1, N.E4, .5], [1.5, N.D4, .5], [2, N.G4, 1], [3, N.A4, 1]],
  [[0, N.C5, 1], [1, N.D5, 1], [2, N.E5, 1.5], [3.5, N.D5, .5]],
  [[0, N.C5, 1.5], [1.5, N.G4, 1], [2.5, N.A4, .5], [3, N.G4, 1]],
];
const CHORDS_BEACH = [
  { bass: N.F2, pad: [N.F3, N.A3, N.C4] },
  { bass: N.C3, pad: [N.C4, N.E4, N.G4] },
];
const MEL_BEACH = [
  [[0, N.F4, 1], [1, N.G4, .5], [1.5, N.A4, .5], [2, N.C5, 1.5], [3.5, N.A4, .5]],
  [[0, N.G4, 1], [1, N.F4, 1], [2, N.C4, 1], [3, N.D4, 1]],
  [[0, N.F4, .5], [.5, N.A4, .5], [1, N.C5, 1], [2, N.D5, 1], [3, N.C5, 1]],
  [[0, N.A4, 1], [1, N.G4, 1], [2, N.F4, 2]],
];
const CHORDS_FOREST = [
  { bass: N.A2, pad: [N.A3, N.C4, N.E4] },
  { bass: N.E2, pad: [N.G3, N.B3, N.E4] },
  { bass: N.F2, pad: [N.F3, N.A3, N.C4] },
  { bass: N.A2, pad: [N.A3, N.C4, N.E4] },
];
const MEL_FOREST = [
  [[0, N.A4, 1.5], [1.5, N.G4, .5], [2, N.E4, 2]],
  [[0, N.E4, 1], [1, N.D4, 1], [2, N.C4, 1.5], [3.5, N.D4, .5]],
  [[0, N.C4, 1], [1, N.A3, 1.5], [2.5, N.C4, .5], [3, N.D4, 1]],
  [[0, N.E4, 1], [1, N.G4, 1], [2, N.A4, 2]],
];
const BGM_MOODS = {
  farm:   { bpm: 96, vel: 1,   chords: CHORDS_FARM,   melody: MEL_FARM },
  beach:  { bpm: 82, vel: .95, chords: CHORDS_BEACH,  melody: MEL_BEACH },
  forest: { bpm: 70, vel: .8,  chords: CHORDS_FOREST, melody: MEL_FOREST },
};
let bgmMood = 'farm';
// ui/游戏层在玩家跨区时调用；不打断曲子，下一小节起自然过渡
export function setBgmMood(mood) {
  if (!BGM_MOODS[mood] || mood === bgmMood) return;
  bgmMood = mood;
  if (bgmOn) ambientStart(bgmMood);   // 环境音跟着换
}

// ---------- 环境音景：跟着分区走，全部 WebAudio 合成，零素材 ----------
// 海滩=海浪（滤过的白噪 + 慢起伏）、农场=偶发鸟鸣、森林=偶发虫鸣；音量都压得很低
let ambGain = null;
let ambCleanup = [];
function ambTone(freq, dur, peak, type = 'sine', slide = 0) {
  const a = ctx();
  if (!a || !ambGain) return;
  const t0 = a.currentTime + Math.random() * 0.05;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ambGain);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}
function ambientStop() {
  ambCleanup.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  ambCleanup = [];
  if (ambGain && ctx()) ambGain.gain.setTargetAtTime(0.0001, ctx().currentTime, 0.5);
}
function ambientStart(mood) {
  const a = ctx();
  if (!a) return;
  ambientStop();
  if (!ambGain) { ambGain = a.createGain(); ambGain.gain.value = 1; ambGain.connect(a.destination); }
  ambGain.gain.cancelScheduledValues(a.currentTime);
  ambGain.gain.setTargetAtTime(1, a.currentTime, 0.8);
  if (mood === 'beach') {
    // 海浪：白噪过低通，音量被 0.1Hz 的慢波推着起伏
    const len = a.sampleRate * 2;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = a.createGain(); g.gain.value = 0.022;
    const lfo = a.createOscillator(), lg = a.createGain();
    lfo.frequency.value = 0.1; lg.gain.value = 0.016;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(ambGain);
    src.start(); lfo.start();
    ambCleanup.push(() => { src.stop(); lfo.stop(); src.disconnect(); lfo.disconnect(); });
  } else if (mood === 'forest') {
    // 虫鸣：随机间隔的一点高频轻响
    const tick = () => ambTone(3000 + Math.random() * 800, 0.07, 0.006);
    const timer = setInterval(() => { if (Math.random() < 0.7) tick(); }, 1600);
    tick();
    ambCleanup.push(() => clearInterval(timer));
  } else {
    // 农场鸟鸣：两声上扬的短哨
    const bird = () => {
      ambTone(2100, 0.09, 0.01, 'triangle', 2600);
      setTimeout(() => ambTone(2400, 0.11, 0.009, 'triangle', 2900), 140);
    };
    const timer = setInterval(() => { if (Math.random() < 0.5) bird(); }, 4200);
    setTimeout(bird, 800);
    ambCleanup.push(() => clearInterval(timer));
  }
}

function bgmVoice(freq, t0, dur, type, peak) {
  const a = ctx();
  if (!a || !bgmGain) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bgmGain);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function bgmScheduleBar(mood, idx, t0) {
  const M = BGM_MOODS[mood];
  // FEVER 时整体升一个大二度、节奏快 8%，曲子瞬间“燃”起来
  const tf = bgmFever ? 1.1225 : 1;
  const beat = (60 / M.bpm) * (bgmFever ? 0.92 : 1);
  const v = M.vel;
  const chord = M.chords[idx % M.chords.length];
  bgmVoice(chord.bass * tf, t0, beat * 0.95, 'sine', 0.05 * v);            // 低音：第 1 拍
  bgmVoice(chord.bass * tf, t0 + beat * 2, beat * 0.95, 'sine', 0.04 * v); // 低音：第 3 拍
  chord.pad.forEach(f => bgmVoice(f * tf, t0, beat * 3.6, 'sine', 0.013 * v)); // 垫音铺满小节
  for (const [b, freq, dur] of M.melody[idx % M.melody.length]) {
    bgmVoice(freq * tf, t0 + b * beat, dur * beat * 0.92, 'triangle', 0.055 * v); // 主旋律：三角波像木琴
  }
}

function bgmSchedule() {
  const a = ctx();
  if (!a) return;
  if (bgmNextBarTime < a.currentTime) bgmNextBarTime = a.currentTime + 0.1;
  // 提前 1.2 秒把接下来的小节排进音频时钟，循环无缝；换区从下一小节生效
  while (bgmNextBarTime - a.currentTime < 1.2) {
    const M = BGM_MOODS[bgmMood];
    bgmScheduleBar(bgmMood, bgmBar % M.melody.length, bgmNextBarTime);
    bgmBar++;
    bgmNextBarTime += (60 / M.bpm) * 4;
  }
}

function bgmRefresh() {
  const want = bgmWanted && !bgmMuted && !document.hidden;
  if (want && !bgmOn) {
    const a = ctx();
    if (!a) return;
    if (!bgmGain) { bgmGain = a.createGain(); bgmGain.gain.value = 0; bgmGain.connect(a.destination); }
    bgmOn = true;
    bgmTimer = setInterval(bgmSchedule, 300);
    bgmSchedule();
    ambientStart(bgmMood);
    bgmGain.gain.cancelScheduledValues(a.currentTime);
    bgmGain.gain.setTargetAtTime(1, a.currentTime, 0.6);   // 淡入
  } else if (!want && bgmOn) {
    bgmOn = false;
    clearInterval(bgmTimer);
    bgmTimer = null;
    ambientStop();
    const a = ctx();
    if (a && bgmGain) {
      bgmGain.gain.cancelScheduledValues(a.currentTime);
      bgmGain.gain.setTargetAtTime(0, a.currentTime, 0.3); // 淡出，正在响的音自然衰减
    }
  }
}

// ui 层在弹窗开/关时调用：dialogOpen = 是否还有弹窗亮着
export function updateBgm(dialogOpen) {
  bgmWanted = !dialogOpen;
  bgmRefresh();
}

export function isBgmMuted() { return bgmMuted; }

export function setBgmMuted(muted) {
  bgmMuted = !!muted;
  try { localStorage.setItem(BGM_MUTE_KEY, bgmMuted ? '1' : '0'); } catch (e) { /* 隐私模式忽略 */ }
  bgmRefresh();
}

// 浏览器自动播放限制：首次用户手势里解锁音频，之后才能出声
function bgmUnlockOnce() {
  document.removeEventListener('pointerdown', bgmUnlockOnce, true);
  document.removeEventListener('keydown', bgmUnlockOnce, true);
  ctx();
  bgmRefresh();
}
document.addEventListener('pointerdown', bgmUnlockOnce, true);
document.addEventListener('keydown', bgmUnlockOnce, true);
document.addEventListener('visibilitychange', bgmRefresh); // 切后台暂停，回来接着放
