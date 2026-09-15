// 城市数据加载器：game/data/cities/ 目录下的 JSON 统一从这里进。
// 设计原则：fetch + 内存缓存；缺文件/断网只降级不崩——城市卡没图就显示 emoji 横幅，
// 牌子少了那块，游戏本身照常玩。内容想改只改 JSON，不用动任何程序。
// 双语资源：zh 主资源即各 JSON 原文；纯英模式（档案卡设置）叠加 cities/en/<id>.json
// 覆盖层（按索引对齐的英文叙述数组，见 cities/en/chengdu.json 样例），缺文件/缺条目回退中文。
import { getLang } from './save.js';

const cache = new Map();

function fetchJson(url) {
  return fetch(url, { cache: 'no-cache' }).then(r => {
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  });
}

// 应用品牌配置（game/data/app.json）：应用名/作者/官网/仓库等，fork 换皮只改这里。
// 缺失时返回内置默认（即原版Q淘族信息），保证关于弹窗永远有内容。
let _app = null;
export async function loadAppConfig() {
  if (_app) return _app;
  const cfg = await loadJson('app.json');
  _app = cfg || {
    appName: 'Q淘族', appNameEn: 'QTZu',
    tagline: '越淘越有词', slogan: '', emoji: '🧺',
    site: null, repo: null, author: '', authorSite: null, license: 'MIT',
  };
  return _app;
}

// 单文件读取：失败返回 null（调用方自行兜底）
export async function loadJson(relPath) {
  if (cache.has(relPath)) return cache.get(relPath);
  const p = fetchJson('data/' + relPath).catch(() => null);
  cache.set(relPath, p);
  return p;
}

// 城市索引：顺序/地区/默认家乡/终点。加载失败时给一个最小兜底（成都起家、北京收尾）
export async function loadCityIndex() {
  const idx = await loadJson('cities/index.json');
  if (idx && Array.isArray(idx.cities) && idx.cities.length) return idx;
  return {
    version: 0,
    defaultHome: 'chengdu',
    finalCity: 'beijing',
    cities: [
      { id: 'chengdu', name: '成都', en: 'Chengdu', region: '西南', order: 1 },
      { id: 'beijing', name: '北京', en: 'Beijing', region: '华北', order: 99, isFinal: true },
    ],
  };
}

// 单个城市的完整数据：city.json 主体 + 三个内容分册（缺的分册给空数组）
// 返回结构：
// {
//   ...city.json 字段,
//   unis:   [{zh,en,tag,founded,site,globalRank,nationalRank,history,bearing}],
//   foods:  [{name,en,desc,img,bearing}],
//   scenes: [{name,en,desc,img,bearing}],
// }
export async function loadCityData(cityId) {
  const base = `cities/${cityId}/`;
  const [city, unis, foods, scenes] = await Promise.all([
    loadJson(base + 'city.json'),
    loadJson(base + 'universities.json'),
    loadJson(base + 'foods.json'),
    loadJson(base + 'scenes.json'),
  ]);
  if (!city) return null;   // 城市主体都没有：调用方走兜底路线
  const out = {
    ...city,
    id: city.id || cityId,
    unis: (unis && unis.unis) || [],
    foods: (foods && foods.items) || [],
    scenes: (scenes && scenes.items) || [],
  };
  // 纯英模式：叠加英文叙述覆盖层（按索引对齐；缺文件/缺条目回退中文）
  if (getLang() === 'en') {
    const en = await loadJson(`cities/en/${cityId}.json`);
    if (en) {
      if (en.history) out.history = en.history;
      (en.foods || []).forEach((d, i) => { if (out.foods[i] && d) out.foods[i].desc = d; });
      (en.scenes || []).forEach((d, i) => { if (out.scenes[i] && d) out.scenes[i].desc = d; });
      (en.unis || []).forEach((d, i) => { if (out.unis[i] && d) out.unis[i].history = d; });
    }
  }
  return out;
}

// 批量加载一座城市的多个分册原始数据（城市卡单独刷新某分册时用）
export async function loadCityPart(cityId, part) {
  const data = await loadJson(`cities/${cityId}/${part}.json`);
  if (!data) return null;
  return part === 'universities' ? (data.unis || []) : (data.items || []);
}
