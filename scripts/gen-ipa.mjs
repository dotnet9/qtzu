#!/usr/bin/env node
// 词宠岛 · 音标生成（零依赖，数据源 = CMU Pronouncing Dictionary）
//
// 为什么重写：原 tools/gen_ipa.py 依赖 Python + eng_to_ipa，本机跑不了；而且 eng_to_ipa
// 的重音位置有个别偏差（如 umbrella 生成 ˈəmˌbrɛlə）。本脚本直接读 CMUdict 的
// ARPAbet 音素串，按标准规则转 IPA，重音按"最长合法音节首"定位，更可靠。
//
// 数据源（权威）：CMU Pronouncing Dictionary（卡内基梅隆大学，美式英语发音事实标准）
//   https://github.com/cmusphinx/cmudict
//   首次运行自动下载到 tools/.cache/cmudict.dict（已 gitignore）
//
// ARPAbet → IPA 映射（美式宽式音标，学习词典通用写法）：
//   元音  AA ɑ · AE æ · AH(重) ʌ / AH(轻) ə · AO ɔ · AW aʊ · AY aɪ · EH ɛ · ER ər
//         EY eɪ · IH ɪ · IY i · OW oʊ · OY ɔɪ · UH ʊ · UW u
//   辅音  B b · CH ʧ · D d · DH ð · F f · G ɡ · HH h · JH ʤ · K k · L l · M m · N n
//         NG ŋ · P p · R r · S s · SH ʃ · T t · TH θ · V v · W w · Y j · Z z · ZH ʒ
//   重音  1 → ˈ  2 → ˌ  0 → 无；单词只有一个元音时不标重音（与页面观感一致）
//
// 用法：
//   node tools/gen-ipa.mjs            # 生成 game/data/ipa.json
//   node tools/gen-ipa.mjs --check    # 只报告覆盖率与未收录项，不写文件

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DICT = path.join(HERE, '.cache', 'cmudict.dict');
const DICT_URL = 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict';
const OUT = path.join(ROOT, 'game', 'data', 'ipa.json');
const CHECK = process.argv.includes('--check');

const VOWELS = {
  AA: 'ɑ', AE: 'æ', AH: 'ə', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ər',
  EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
};
const CONS = {
  B: 'b', CH: 'ʧ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'ʤ', K: 'k',
  L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't',
  TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};

// 合法音节首（ARPAbet 辅音序列，空格分隔）——用于把重音符号放到音节首之前
const ONSETS = new Set([
  '', // 零音节首
  // 单辅音（NG 不能作音节首）
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
  // 双辅音
  'P L', 'P R', 'P Y', 'B L', 'B R', 'B Y', 'T R', 'T W', 'T Y', 'D R', 'D W', 'D Y',
  'K L', 'K R', 'K W', 'K Y', 'G L', 'G R', 'G W', 'G Y', 'F L', 'F R', 'F Y', 'V Y',
  'TH R', 'TH W', 'SH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S F', 'S L', 'S W', 'S Y',
  'HH Y', 'M Y', 'N Y', 'L Y', 'HH W', 'K S', 'G Z',
  // 三辅音
  'S P L', 'S P R', 'S T R', 'S K R', 'S K W', 'S P Y', 'S T Y', 'S K Y',
]);

// 字母名（缩写词 UK / PE / TV 等 CMUdict 未收录时逐字母拼读，可靠且标准）
const LETTER = {
  A: 'eɪ', B: 'bi', C: 'si', D: 'di', E: 'i', F: 'ɛf', G: 'ʤi', H: 'eɪʧ', I: 'aɪ',
  J: 'ʤeɪ', K: 'keɪ', L: 'ɛl', M: 'ɛm', N: 'ɛn', O: 'oʊ', P: 'pi', Q: 'kju', R: 'ɑr',
  S: 'ɛs', T: 'ti', U: 'ju', V: 'vi', W: 'ˈdʌbəlju', X: 'ɛks', Y: 'waɪ', Z: 'zi',
};

function parseDict(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith(';;;')) continue;
    const hash = line.indexOf('#');           // 备用发音：word#1 ... 忽略
    let body = hash >= 0 ? line.slice(0, hash) : line;
    const m = /^(\S+)\s+(.+)$/.exec(body.trim());
    if (!m) continue;
    const word = m[1].replace(/\(\d+\)$/, '').toLowerCase();
    if (!map.has(word)) map.set(word, m[2].trim());   // 取第一发音
  }
  return map;
}

function arpabetToIpa(phon) {
  const syms = phon.split(/\s+/);
  const items = syms.map(s => {
    const m = /^([A-Z]+)([012])?$/.exec(s);
    if (!m) return null;
    const base = m[1], stress = m[2] ? Number(m[2]) : 0;
    if (VOWELS[base]) return { ipa: VOWELS[base], vowel: true, stress };
    if (CONS[base]) return { ipa: CONS[base], vowel: false, stress: 0 };
    return null;
  });
  if (items.some(x => x === null)) return null;

  // 位置标记：每个下标前是否插入重音符号
  const marks = new Array(items.length).fill('');
  const vowelIdx = [];
  items.forEach((it, i) => { if (it.vowel) vowelIdx.push(i); });
  if (vowelIdx.length === 1) return items.map(x => x.ipa).join('');   // 单音节不标重音

  vowelIdx.forEach((vi, n) => {
    const st = items[vi].stress;
    if (!st) return;
    const prev = n === 0 ? -1 : vowelIdx[n - 1];
    const cluster = [];
    for (let j = prev + 1; j < vi; j++) if (!items[j].vowel) cluster.push(syms[j]);
    let k = 0;
    for (let len = cluster.length; len >= 0; len--) {
      if (ONSETS.has(cluster.slice(cluster.length - len).join(' '))) { k = len; break; }
    }
    const start = vi - k;
    marks[start] = st === 1 ? 'ˈ' : 'ˌ';
  });
  return items.map((x, i) => marks[i] + x.ipa).join('');
}

// 人工兜底：CMUdict 未收录的词（复合词/教材专名/英式拼写），按可靠读音手工标注
const OVERRIDES = {
  'schoolbag': 'ˈskulˌbæɡ',
  'maths': 'mæθs',                 // 英式拼写，CMUdict 只收 math
  'mooncake': 'ˈmunˌkeɪk',
  'pipa': 'ˈpipə',                 // 琵琶（教材 play the pipa），英语借词
  'papa westray': 'ˌpɑpə ˈwɛstri', // 苏格兰奥克尼地名
  'turpan': 'ˌtʊrˈpɑn',            // 吐鲁番
};

function cleanToken(t) {
  return String(t).toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\.{2,}$/g, '')       // my name is... → 去掉省略号
    .replace(/[.,!?;:]+$/g, '')
    .trim();
}

function lookup(dict, token) {
  const t = cleanToken(token);
  if (!t) return null;
  if (OVERRIDES[t]) return OVERRIDES[t];     // 人工兜底优先（pipa/maths 等单词级）
  if (dict.has(t)) return arpabetToIpa(dict.get(t));
  // 连字符：ice-skate → ice skate
  if (t.includes('-')) {
    const parts = t.split('-').filter(Boolean);
    const outs = parts.map(p => lookup(dict, p));
    if (outs.every(Boolean)) return outs.join('');
  }
  // 缩写：逐字母（2~6 个字母的全大写缩写），字母名之间留空格，避免 p+e 连成 "pii"
  if (/^[a-z]{2,6}$/.test(t) && token === token.toUpperCase() && /[A-Z]/.test(token)) {
    return t.split('').map(c => LETTER[c.toUpperCase()]).join(' ');
  }
  return null;
}

function toIpa(dict, en) {
  const raw = String(en).trim();
  if (!raw) return null;
  const ov = OVERRIDES[raw.toLowerCase()];
  if (ov) return ov;
  const words = raw.split(/\s+/);
  const outs = [];
  for (const w of words) {
    const r = lookup(dict, w);
    if (!r) return null;
    outs.push(r);
  }
  return outs.join(' ');
}

async function main() {
  if (!fs.existsSync(DICT)) {
    console.log('下载 CMUdict …');
    fs.mkdirSync(path.dirname(DICT), { recursive: true });
    const res = await fetch(DICT_URL);
    if (!res.ok) throw new Error('CMUdict 下载失败 ' + res.status);
    fs.writeFileSync(DICT, await res.text());
  }
  const dict = parseDict(fs.readFileSync(DICT, 'utf8'));

  const mod = await import(pathToFileURL(path.join(ROOT, 'game', 'js', 'words.js')).href);
  const cur = await import(pathToFileURL(path.join(ROOT, 'game', 'js', 'curriculum.js')).href);
  const ens = [];
  for (const w of mod.WORDS) ens.push(w.en);
  for (const vol of Object.values(cur.CURRICULUM)) {
    for (const u of vol.units) for (const it of u.words) ens.push(String(it).split('|')[0].trim());
  }
  const seen = new Set(); const uniq = [];
  for (const en of ens) { const k = String(en).toLowerCase(); if (k && !seen.has(k)) { seen.add(k); uniq.push(en); } }

  const ipa = {}; const unresolved = [];
  for (const en of uniq) {
    const v = toIpa(dict, en);
    if (v) ipa[String(en).toLowerCase()] = v; else unresolved.push(en);
  }
  const total = uniq.length, ok = Object.keys(ipa).length;
  console.log(`覆盖 ${ok}/${total}（${(ok / total * 100).toFixed(1)}%），未收录 ${unresolved.length}`);
  if (unresolved.length) console.log('未收录：' + unresolved.slice(0, 80).join(' | '));
  if (CHECK) return;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(ipa, null, 0));
  console.log('写入 ' + path.relative(ROOT, OUT));
}

main().catch(e => { console.error(e); process.exit(1); });
