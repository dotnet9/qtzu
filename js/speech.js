// 语音识别：按住说话 → 识别 → 与目标单词模糊匹配
// 兼容 Chrome / Edge 的 Web Speech API

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

const secure = location.protocol === 'https:'
  || ['localhost', '127.0.0.1'].includes(location.hostname);

// 浏览器有识别能力，但当前是 http 非本机访问 → 浏览器会静默拒绝，直接视为不支持并提示原因
export const voiceBlockedByInsecure = !!SR && !secure;
export const voiceSupported = !!SR && secure;

// 识别服务不可用时（国内网络常见：Chrome 语音服务连不上），自动降级为字母块模式
let broken = false;
try { broken = sessionStorage.getItem('wp_voice_broken') === '1'; } catch (e) { /* ignore */ }
let notAllowedCount = 0;

export function isVoiceBroken() { return broken; }
export function markVoiceBroken() {
  broken = true;
  try { sessionStorage.setItem('wp_voice_broken', '1'); } catch (e) { /* ignore */ }
}

const FATAL_ERRORS = ['network', 'service-not-allowed', 'language-not-supported', 'audio-capture'];

let rec = null;
let listening = false;
let onResultCb = null;
let onStateCb = null;
let autoTimer = null;
let gotResult = false;

function ensureRec() {
  if (rec) return rec;
  rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 6;
  rec.continuous = false;
  rec.onresult = (e) => {
    gotResult = true;
    const alts = [];
    const res = e.results[0];
    for (let i = 0; i < res.length; i++) {
      alts.push({ transcript: res[i].transcript, confidence: res[i].confidence || 0.6 });
    }
    if (onResultCb) onResultCb(alts);
  };
  rec.onend = () => {
    listening = false;
    clearTimeout(autoTimer);
    if (onStateCb) onStateCb(false);
    // 说完了但什么都没识别到
    if (!gotResult && onResultCb) onResultCb(null, 'no-result');
  };
  rec.onerror = (e) => {
    listening = false;
    clearTimeout(autoTimer);
    if (onStateCb) onStateCb(false, e.error);
    if (FATAL_ERRORS.includes(e.error)) {
      markVoiceBroken(); // 识别服务根本不可用，标记降级
      return;            // 提示由降级流程统一给出
    }
    if (e.error === 'not-allowed') {
      notAllowedCount++;
      if (notAllowedCount >= 2) markVoiceBroken(); // 反复拿不到麦克风权限，也降级
    }
    if (onResultCb && e.error !== 'no-speech' && e.error !== 'aborted') onResultCb(null, e.error);
  };
  return rec;
}

// target: 单词或短语；返回 { ok, close, heard, score }  score: 0-100 发音评分
// 评分原则：孩子的发音只要“听起来像”就给鼓励分，识别岔了不让小朋友背锅
// leniency: 宽容等级（连败安抚用）：1 = 编辑距离放宽一档、听感骨架相似直接算过
export function matchAlt(alts, target, leniency = 0) {
  const tol = (target.length <= 3 ? 0 : target.length <= 5 ? 1 : 2) + leniency;
  const tNoSp = target.replace(/ /g, '');
  let best = { ok: false, close: false, heard: '', score: 0 };
  for (const a of alts || []) {
    const isObj = a && typeof a === 'object';
    const raw = isObj ? a.transcript : a;
    if (!raw) continue;
    const conf = Math.min(1, Math.max(0.5, isObj ? (a.confidence || 0.7) : 0.7));
    const heard = raw.toLowerCase().replace(/[^a-z ]/g, ' ').trim();
    if (!heard) continue;
    const tokens = heard.split(/\s+/);
    const joined = tokens.join('');
    let s = null, ok = false, close = false;
    if (tokens.includes(target) || joined === tNoSp || heard === target) {
      ok = true;
      s = Math.round(88 + 12 * conf);                       // 完全命中：88-100
    } else {
      let d = Math.min(...tokens.map(t => lev(t, target)), lev(joined, tNoSp));
      if (target.includes(' ')) d = Math.min(d, lev(heard.replace(/ /g, ''), tNoSp));
      if (d === 0) { ok = true; s = Math.round(82 + 14 * conf); }        // 连读命中：82-96
      else if (d <= tol) { close = true; ok = leniency > 0 && d <= tol - leniency + 1; s = Math.round(68 + (tol - d) * 8 + 12 * conf); } // 接近：68-88
      else if (d <= tol + 2) { close = true; s = Math.round(50 + (tol + 2 - d) * 7 + 10 * conf); } // 勉强接近：50-80
      else {
        // 相似度兜底：编辑距离太远时按字符重合度给分，识别岔了也不至于 2、30 分
        const sim = 1 - d / Math.max(target.length, joined.length, 1);
        const phonetic = lev(soundex(target), soundex(joined)) <= 1;   // 听感骨架相似
        if (phonetic) { close = true; ok = leniency > 0; s = Math.round((leniency > 0 ? 78 : 62) + 12 * conf); }
        else if (sim >= 0.5) { close = true; s = Math.round(46 + 22 * sim); }
        else s = Math.round(30 + 14 * sim);                            // 确实没听清：30 分上下
      }
    }
    s = Math.max(0, Math.min(100, s));
    if (s > best.score) best = { ok, close, heard, score: s };
  }
  return best;
}

// 粗略音素骨架：去掉元音差异与重复字母，只留辅音框架（cat/can/kat 听感接近）
function soundex(w) {
  return String(w).replace(/ /g, '')
    .replace(/([bcdfgklmnprstvz])\1+/g, '$1')
    .replace(/[aeiouy]/g, '');
}

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function startListening(onResult, onState) {
  if (!SR || !voiceSupported || broken) return false;
  const r = ensureRec();
  gotResult = false;
  try { r.abort(); } catch (e) { /* ignore */ }
  onResultCb = onResult;
  onStateCb = onState;
  try {
    r.start();
    listening = true;
    if (onState) onState(true);
    // 10 秒倒计时收束：说完没点结束也会自动识别，超时不再让孩子干等
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { try { r.stop(); } catch (e) { /* ignore */ } }, 10000);
    return true;
  } catch (e) {
    listening = false;
    markVoiceBroken(); // start 都失败，识别基本不可用
    return false;
  }
}

export function stopListening() {
  if (rec && listening) {
    try { rec.stop(); } catch (e) { /* ignore */ }
  }
}
