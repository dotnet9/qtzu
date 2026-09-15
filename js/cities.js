// 城市配置驱动层：城市内容全部来自 game/data/cities/ 的 JSON，本文件只负责
// 加载调度、路线算法和变体轮换，不写死任何一座城市。新增/修改城市 → 只改 JSON。
import { loadCityIndex, loadCityData } from './data.js';
import { setCityLayouts } from './world.js';

// 舞台装饰类型 → emoji（city.json variants 的 deco 字段）
export const DECO_EMOJI = {
  lantern: '🏮', chili: '🌶️', boat: '⛵', tea: '🍵', flower: '🌸', shell: '🐚',
  palm: '🌴', bamboo: '🎍', horse: '🐴', grape: '🍇', iceflake: '❄️',
};

// 城市小问答：介绍卡看完弹一题，答对 +1⭐（没写的城市不弹）
export const CITY_QUIZ = {
  chengdu: { q: '成都最有名的动物是？', opts: ['🐼 大熊猫', '🐧 企鹅', '🦁 狮子'], a: 0 },
  beijing: { q: '北京是中国的什么？', opts: ['🏛️ 首都', '🏖️ 海岛', '🏜️ 沙漠'], a: 0 },
  shanghai: { q: '东方明珠塔在哪座城市？', opts: ['🌆 上海', '🏔️ 拉萨', '🐪 敦煌'], a: 0 },
  harbin: { q: '哈尔滨的冰雪大世界用什么做的？', opts: ['❄️ 冰', '🍪 饼干', '🧱 砖头'], a: 0 },
  sanya: { q: '三亚最有名的是？', opts: ['🏖️ 大海和沙滩', '❄️ 雪山', '🏭 工厂'], a: 0 },
  xian: { q: '西安的地下军团是？', opts: ['🗿 兵马俑', '🤖 机器人', '🐻 泰迪熊'], a: 0 },
  hangzhou: { q: '杭州西湖出产的名茶是？', opts: ['🍵 龙井', '🧋 奶茶', '☕ 咖啡'], a: 0 },
  wuhan: { q: '武汉最有名的小吃是？', opts: ['🍜 热干面', '🍣 寿司', '🍕 披萨'], a: 0 },
  chongqing: { q: '重庆最出名的美食是？', opts: ['🌶️ 火锅', '🍰 蛋糕', '🥗 沙拉'], a: 0 },
  kunming: { q: '昆明为什么叫"春城"？', opts: ['🌸 四季如春', '🎄 圣诞之城', '⛄ 冰雪之城'], a: 0 },
  hohhot: { q: '呼和浩特在哪片大草原旁？', opts: ['🐴 内蒙古', '🎋 竹林', '🌋 火山'], a: 0 },
  lhasa: { q: '拉萨的著名宫殿是？', opts: ['🏔️ 布达拉宫', '🏰 灰姑娘城堡', '🗼 铁塔'], a: 0 },
  qingdao: { q: '青岛靠着哪片海？', opts: ['🌊 黄海', '🙅 死海', '🏜️ 沙海'], a: 0 },
  urumqi: { q: '乌鲁木齐哪种水果最甜？', opts: ['🍈 哈密瓜', '🍋 柠檬', '🥑 牛油果'], a: 0 },
  luoyang: { q: '洛阳最出名的花是？', opts: ['🌹 牡丹', '🌸 樱花', '🌻 向日葵'], a: 0 },
  guangzhou: { q: '广州的别称是？', opts: ['🐑 羊城', '🐲 龙城', '🐦 鸟城'], a: 0 },
  nanjing: { q: '南京著名的古建筑是？', opts: ['🧱 明城墙', '🗼 埃菲尔铁塔', '🗿 狮身人面像'], a: 0 },
  changsha: { q: '长沙哪个洲头周末会放烟花？', opts: ['🎆 橘子洲', '🏝️ 椰子洲', '🌵 绿洲'], a: 0 },
  guiyang: { q: '贵阳因为什么凉快被称为「林城」？', opts: ['🌳 森林环绕、夏天像开了空调', '❄️ 一年四季都下雪', '🌊 海风吹个不停'], a: 0 },
  lanzhou: { q: '哪条大河穿兰州城而过？', opts: ['🌊 黄河', '🌊 长江', '🌊 珠江'], a: 0 },
  tianjin: { q: '天津最有名的传统小吃是「狗不理」什么？', opts: ['🥟 包子', '🍜 拉面', '🍚 米饭'], a: 0 },
  shijiazhuang: { q: '石家庄是哪个省的省会？', opts: ['🏔️ 河北省', '🏔️ 河南省', '🏔️ 山东省'], a: 0 },
  taiyuan: { q: '太原因为盛产什么被称为「煤都」之一？', opts: ['⚫ 煤炭', '🪙 金子', '💎 钻石'], a: 0 },
  datong: { q: '大同的云冈石窟里刻的是什么？', opts: ['🗿 大佛', '🐉 恐龙', '🏰 城堡'], a: 0 },
  chengde: { q: '承德的避暑山庄是谁夏天避暑的地方？', opts: ['👑 清朝皇帝', '🐼 大熊猫', '🧙 古代将军'], a: 0 },
  shenyang: { q: '沈阳故宫是哪个朝代入关前的皇宫？', opts: ['🏯 清朝', '🏯 唐朝', '🏯 宋朝'], a: 0 },
  changchun: { q: '长春因为生产什么被称为「汽车城」？', opts: ['🚗 汽车', '🚂 火车', '✈️ 飞机'], a: 0 },
  dalian: { q: '大连是一座挨着哪片海的海滨城市？', opts: ['🌊 渤海和黄海', '🌊 东海', '🌊 南海'], a: 0 },
  suzhou: { q: '苏州最出名的是什么园林？', opts: ['🏮 古典园林（拙政园等）', '🎡 游乐园', '🏛️ 现代高楼'], a: 0 },
  wuxi: { q: '无锡旁边的大湖叫什么？', opts: ['🌊 太湖', '🌊 青海湖', '🌊 洞庭湖'], a: 0 },
  hefei: { q: '合肥是哪个省的省会？', opts: ['🏞️ 安徽省', '🏞️ 江西省', '🏞️ 湖北省'], a: 0 },
  fuzhou: { q: '福州哪种树满城都是，别称「榕城」？', opts: ['🌳 榕树', '🌲 松树', '🎋 竹子'], a: 0 },
  xiamen: { q: '厦门哪座小岛上钢琴声最多、不通车？', opts: ['🎹 鼓浪屿', '🏝️ 情人岛', '🏝️ 蛇岛'], a: 0 },
  quanzhou: { q: '泉州在古代海上贸易中叫什么名字？', opts: ['🚢 刺桐港（东方第一大港）', '🚢 金门港', '🚢 威海卫'], a: 0 },
  nanchang: { q: '南昌的地标滕王阁是谁写的名篇？', opts: ['📜 王勃《滕王阁序》', '📜 李白《静夜思》', '📜 杜甫《春望》'], a: 0 },
  jinan: { q: '济南因为泉水多被称为什么城？', opts: ['⛲ 泉城', '🔥 火城', '❄️ 冰城'], a: 0 },
  qufu: { q: '曲阜是哪位古代大教育家的家乡？', opts: ['🎓 孔子', '🎓 李白', '🎓 华佗'], a: 0 },
  shenzhen: { q: '深圳从小渔村变成科技城，紧挨着哪座城市？', opts: ['🏙️ 香港', '🏙️ 澳门', '🏙️ 台北'], a: 0 },
  zhuhai: { q: '珠海的城市标志是一尊什么雕像？', opts: ['🎣 渔女雕像', '🕊️ 和平鸽', '🐬 海豚'], a: 0 },
  nanning: { q: '南宁满城绿树，被称为什么之城？', opts: ['🌿 绿城', '🏚️ 灰城', '🏮 灯城'], a: 0 },
  haikou: { q: '海口是哪个省的省会？', opts: ['🌴 海南省', '🌴 广东省', '🌴 广西'], a: 0 },
  zhengzhou: { q: '郑州附近的双槐树遗址被称为什么？', opts: ['🏛️ 「河洛古国」（中华文明源头之一）', '🏰 欧洲城堡', '🗼 现代铁塔'], a: 0 },
  kaifeng: { q: '《清明上河图》画的是哪座城市的繁华？', opts: ['🖼️ 开封（北宋东京）', '🖼️ 杭州', '🖼️ 苏州'], a: 0 },
  taipei: { q: '台北的地标高楼叫什么？', opts: ['🏢 台北101', '🏢 东方明珠', '🏢 广州塔'], a: 0 },
  kaohsiung: { q: '高雄是靠什么发达的港口城市？', opts: ['⚓ 海港航运', '⛰️ 采矿', '🐫 骆驼商队'], a: 0 },
  taichung: { q: '台中附近的日月潭在哪个县最有名？', opts: ['🏞️ 南投（台湾最大天然湖）', '🏞️ 花莲', '🏞️ 澎湖'], a: 0 },
  tainan: { q: '台南的安平古堡最早是谁建造的？', opts: ['🏰 荷兰人（热兰遮城）', '🏰 西班牙人', '🏰 葡萄牙人'], a: 0 },
  yinchuan: { q: '银川西边的西夏王陵是谁的陵墓？', opts: ['🏜️ 西夏王朝皇帝', '🏜️ 成吉思汗', '🏜️ 秦始皇'], a: 0 },
  xining: { q: '西宁旁边的中国最大咸水湖是？', opts: ['🌊 青海湖', '🌊 纳木错', '🌊 太湖'], a: 0 },
  shaoxing: { q: '绍兴最有名的黄酒用什么江的水酿造？', opts: ['🍶 鉴湖水', '🍶 黄浦江', '🍶 松花江'], a: 0 },
  yangzhou: { q: '「烟花三月下扬州」是谁的诗句？', opts: ['📖 李白', '📖 白居易', '📖 苏轼'], a: 0 },
  dunhuang: { q: '敦煌莫高窟里保存最多的是什么？', opts: ['🖼️ 壁画和佛像', '🐚 贝壳', '🦕 恐龙化石'], a: 0 },
};
export function getCityQuiz(id) { return CITY_QUIZ[id] || null; }

// 轻量城市列表（index 全量：档案卡选择器 / IP 定位用）；巡游城市的完整数据在 CITY_MAP
export const CITIES = [];
export const CITY_MAP = {};

const _index = { defaultHome: 'chengdu', finalCity: 'beijing', cities: [] };
let _initPromise = null;
let _loadedKey = '';

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 通关奖励城市：order=0 的城市不进自动巡游路线，北京通关后可自由前往探索
export function bonusCityIds() {
  const set = new Set();
  for (const c of _index.cities) {
    if ((c.order || 0) === 0 && c.id !== _index.finalCity) set.add(c.id);
  }
  return set;
}
export function bonusCities() {
  return _index.cities.filter(c => (c.order || 0) === 0 && c.id !== _index.finalCity);
}
// 按需加载奖励城市完整数据（进城前调用；已缓存则跳过）
export async function ensureCityData(id) {
  if (CITY_MAP[id]) return CITY_MAP[id];
  const d = await loadCityData(id);
  if (d) CITY_MAP[id] = d;
  return d;
}

// 城市巡游路线：家乡 → 洗牌（家乡/终点除外）→ 终点城市收尾
// seed = 昵称+册：同一孩子同一册每次进游戏路线一致（进度可续）
export function cityRoute(homeId, semKey, count, username = '') {
  const ids = _index.cities.length ? _index.cities.map(c => c.id) : ['chengdu', 'beijing'];
  const home = ids.includes(homeId) ? homeId : _index.defaultHome;
  const final = _index.finalCity;
  const bonusSet = bonusCityIds();
  const pool = ids.filter(id => id !== home && id !== final && !bonusSet.has(id));
  let seed = hash(username + '|' + semKey);
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const mid = pool.slice(0, Math.max(0, count - 2));
  if (home === final) return [home, ...mid].slice(0, Math.max(1, count));   // 家乡即终点：不重复收尾
  return [home, ...mid, final].slice(0, Math.max(1, count));
}

// 第 visit 次到访（0 起）用哪个介绍版本：常来常新
export function cityVariant(city, visit) {
  const vs = city && city.variants && city.variants.length ? city.variants
    : [{ emoji: '🏙️', intro: city ? city.name : '', introEn: city ? city.en : '', words: [], deco: 'lantern' }];
  return vs[visit % vs.length];
}

// 初始化：读索引 + 加载巡游城市的完整数据（city/universities/foods/scenes）。
// main.js 在 new Game() 之前 await；同参数重复调用只跑一次。
export async function initCities({ homeId, semKey, count = 10, username = '' } = {}) {
  const key = JSON.stringify([homeId || '', semKey || '', count, username]);
  if (_initPromise && _loadedKey === key) return _initPromise;
  _loadedKey = key;
  _initPromise = (async () => {
    const idx = await loadCityIndex();
    _index.cities = idx.cities || [];
    _index.defaultHome = idx.defaultHome || 'chengdu';
    _index.finalCity = idx.finalCity || 'beijing';
    // 轻量列表：选择器与定位只需 id/name/en
    CITIES.length = 0;
    for (const c of _index.cities) CITIES.push({ id: c.id, name: c.name, en: c.en, region: c.region });
    window.dispatchEvent(new Event('cities-ready'));   // 通知 UI（档案卡城市下拉等）填充
    // 手作城市布局表：逐城定制的风格/朝向/专属记忆装饰（失败静默，走程序化布局）
    try {
      const { loadJson } = await import('./data.js');
      setCityLayouts(await loadJson('cities/layouts.json'));
    } catch (e) { /* 无手作表：全部走程序化布局 */ }
    // 巡游路线城市的完整数据
    const route = cityRoute(homeId, semKey, count, username);
    const datas = await Promise.all(route.map(id => loadCityData(id)));
    route.forEach((id, i) => { if (datas[i]) CITY_MAP[id] = datas[i]; });
    // 家乡与终点不在路线时也保底加载（测验/档案/终点仪式要用）
    for (const must of [_index.defaultHome, _index.finalCity]) {
      if (!CITY_MAP[must]) { const d = await loadCityData(must); if (d) CITY_MAP[must] = d; }
    }
    return route;
  })();
  return _initPromise;
}

export function getDefaultHome() { return _index.defaultHome; }
export function getFinalCity() { return _index.finalCity; }
