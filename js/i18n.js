// 轻量双语系统：key 为英文短句 id，全部文案资源在 data/i18n/ 下的 JSON 文件
// （key 相同、按语言分文件维护，全球协作者改 JSON 即可翻译，JS 里不写任何文案）：
//   ui.zh.json / ui.en.json   —— 界面语句（菜单/弹窗/提示）
//   game.zh.json / game.en.json —— 游戏双语内容（NPC 问候/配音情景/连线词对）
// 存档 lang 决定输出：bi=中文为主 en=纯英文。
import { getLang } from './save.js';

const _merged = { zh: {}, en: {}, game: { zh: null, en: null }, loaded: false };

// 查一个界面文案：优先当前语言表；缺失时回落另一语言表（绝不显示空/裸 key）
function dictGet(key) {
  const lang = getLang() === 'en' ? 'en' : 'zh';
  return _merged[lang][key] ?? _merged[lang === 'en' ? 'zh' : 'en'][key];
}

export function t(key, vars) {
  let s = dictGet(key) ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
// 双语模式输出中文、纯英模式输出英文；用于并列展示型文案
export function tb(key, vars) {
  if (getLang() === 'en') return t(key, vars);
  let s = _merged.zh[key] ?? _merged.en[key] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
export function isEn() { return getLang() === 'en'; }

// ---------- 游戏双语内容（NPC 问候 / 配音情景 / 连线词对）----------
const EMPTY_GAME = { greetings: [], dub: { scenes: [] }, wordmap: [] };
export function getGameRes() {
  return _merged.game[getLang()] || _merged.game.zh || EMPTY_GAME;
}

// ---------- 资源加载（幂等）：begin() 会 await，资源未就绪前不渲染文案 ----------
let _initPromise = null;
export function initI18n() {
  if (_initPromise) return _initPromise;
  const load = f => fetch(`data/i18n/${f}.json`, { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  _initPromise = Promise.all([load('ui.zh'), load('ui.en'), load('game.zh'), load('game.en')])
    .then(([zh, en, gzh, gen]) => {
      if (zh) Object.assign(_merged.zh, zh);
      if (en) Object.assign(_merged.en, en);
      _merged.game.zh = gzh || _merged.game.zh;
      _merged.game.en = gen || _merged.game.en;
      _merged.loaded = true;
      dispatchEvent(new Event('i18n-ready'));
      return true;
    })
    .catch(() => { _initPromise = null; return false; });
  return _initPromise;
}
export function isI18nLoaded() { return _merged.loaded; }
