// 大学校门数据层：风格族关键词规则 + 各城招牌大学定制项
// familyFor(校名) → 风格族 id（world 里的门型 builder 按 id 出造型）
// SIGNATURE[校名] → 招牌门设计 { tpl, c1, c2, c3, prop }
//   tpl  招牌模板（erxiao二校门/pku西门牌楼/pailou石牌坊/soviet苏式主楼/minguo民国拱门/
//        jiageng嘉庚燕尾脊/roof中式屋顶门/garden园林月亮门/modern现代门楼/tibetan藏式门/dunhuang敦煌门）
//   c1/c2/c3 三个配色槽（柱身/强调·屋顶/点缀，各模板自行取用）
//   prop 附属小道具 key（ding鼎/stele思源碑/bell傅钟/beilou北大楼/yurt蒙古包/twin德式双塔/
//        jiuceng九层楼/boat乌篷船/rock太湖石/snow雪山/water水面/sakura樱花/phoenix凤凰木/longbi九龙壁/lighthouse灯塔）

// 风格族规则：按序首个命中生效（顺序即优先级，勿随意调换——
// 中医药先于医科、森林/农业先于科技、外语先于财经、师范先于民族）
// 没列进 SIGNATURE 的大学走 familyFor 风格族（哈工大类名校与 985 主体全有定制）
const RULES = [
  ['tcm',    /中医药|藏医药|民族医药|医药大学/],
  ['medic',  /医|药科|药理/],
  ['aero',   /航空|航天|飞行|民航/],
  ['rail',   /铁道|交通|轨道/],
  ['post',   /邮电/],
  ['ocean',  /海洋|水产|渔业|海事|海运/],
  ['agri',   /农业|农林|农垦/],
  ['forest', /林业|森林/],
  ['petro',  /石油|矿业|地质|钢铁|煤炭/],
  ['hydro',  /水利|水电|水务|河海/],
  ['power',  /电力|能源/],
  ['lang',   /外国语|外语|语言/],
  ['normal', /师范/],
  ['finance',/财经|经贸|工商|经济|外贸|商学/],
  ['law',    /政法|警察|公安|政治/],
  ['folk',   /民族/],
  ['art',    /音乐|美术|艺术|戏剧|戏曲|电影|演艺/],
  ['media',  /传媒|传播|新闻|广播|电视|影视/],
  ['sport',  /体育|运动/],
  ['chip',   /理工|工业|科技|电子|信息|计量|建筑|轻工|纺织|技术|工程/],
];

export function familyFor(zh) {
  const s = String(zh || '');
  for (const [fam, re] of RULES) if (re.test(s)) return fam;
  return 'classic';   // 综合/未匹配 → 古典柱式
}

export const SIGNATURE = {
  // 北京：清北双招牌
  '清华大学':   { tpl: 'erxiao',  c1: '#F2EEE6', c2: '#B9B2A2', c3: '#4A3626' },
  '北京大学':   { tpl: 'pku',     c1: '#9E2B25', c2: '#3E6B4F', c3: '#E8C86A' },
  // 东北 / 华北
  '哈尔滨工业大学': { tpl: 'soviet', c1: '#D8D2C4', c2: '#8A8378', c3: '#C24A50' },
  '吉林大学':   { tpl: 'modern', c1: '#3F6BA0', c2: '#D8D2C4', c3: '#E8C86A', prop: 'ding' },
  '大连理工大学': { tpl: 'soviet', c1: '#E4DECF', c2: '#9A8A6B', c3: '#4E7CA8' },
  '东北大学':   { tpl: 'minguo', c1: '#9E4A3A', c2: '#6B6257', c3: '#E8C86A' },
  '内蒙古大学': { tpl: 'modern', c1: '#3E6B8C', c2: '#F2EEE6', c3: '#5FA05F', prop: 'yurt' },
  '山西大学':   { tpl: 'modern', c1: '#7A3B3B', c2: '#E4DECF', c3: '#E8C86A' },
  '山西大同大学': { tpl: 'modern', c1: '#8A6844', c2: '#E4DECF', c3: '#C24A50', prop: 'longbi' },
  '河北师范大学': { tpl: 'modern', c1: '#35707E', c2: '#F2EEE6', c3: '#E8C86A' },
  '南开大学':   { tpl: 'modern', c1: '#5B2D8E', c2: '#F2EEE6', c3: '#E8C86A' },
  // 西北
  '西安交通大学': { tpl: 'minguo', c1: '#6B6257', c2: '#D8D2C4', c3: '#2E7D5B', prop: 'stele' },
  '兰州大学':   { tpl: 'modern', c1: '#2E7D5B', c2: '#F2EEE6', c3: '#E8C86A' },
  '青海大学':   { tpl: 'modern', c1: '#2E7D8C', c2: '#E4DECF', c3: '#5FA05F' },
  '宁夏大学':   { tpl: 'modern', c1: '#3E5C8C', c2: '#E4DECF', c3: '#E8C86A' },
  '新疆大学':   { tpl: 'modern', c1: '#9E2B25', c2: '#E4DECF', c3: '#E8C86A', prop: 'snow' },
  '西藏大学':   { tpl: 'tibetan', c1: '#F5F1E8', c2: '#8A2B22', c3: '#E8C86A' },
  '敦煌学院':   { tpl: 'dunhuang', c1: '#D9B87C', c2: '#9E4A3A', c3: '#E8C86A', prop: 'jiuceng' },
  // 华东 / 华南
  '复旦大学':   { tpl: 'roof',    c1: '#F5F1E8', c2: '#6B7280', c3: '#9E2B25' },
  '浙江大学':   { tpl: 'modern', c1: '#1E56A0', c2: '#F2EEE6', c3: '#E8C86A', prop: 'bell' },
  '中国科学技术大学': { tpl: 'modern', c1: '#F2EEE6', c2: '#9E2B25', c3: '#E8C86A', prop: 'brick' },
  '南京大学':   { tpl: 'minguo', c1: '#6B6257', c2: '#D8D2C4', c3: '#5FA05F', prop: 'beilou' },
  '苏州大学':   { tpl: 'garden', c1: '#F5F1E8', c2: '#4A5560', c3: '#C24A50' },
  '江南大学':   { tpl: 'modern', c1: '#2E4A7D', c2: '#F2EEE6', c3: '#8FD08F', prop: 'rock' },
  '扬州大学':   { tpl: 'garden', c1: '#F5F1E8', c2: '#5B7280', c3: '#8FD08F', prop: 'boat' },
  '绍兴文理学院': { tpl: 'modern', c1: '#2B4A6B', c2: '#F2EEE6', c3: '#8A6844', prop: 'boat' },
  '山东大学':   { tpl: 'modern', c1: '#9E1F32', c2: '#F2EEE6', c3: '#E8C86A' },
  '中国海洋大学': { tpl: 'modern', c1: '#1E5F8C', c2: '#F2EEE6', c3: '#E8C86A', prop: 'twin' },
  '厦门大学':   { tpl: 'jiageng', c1: '#9E4A3A', c2: '#D8D2C4', c3: '#E8C86A', prop: 'water' },
  '华侨大学':   { tpl: 'jiageng', c1: '#8A3B2E', c2: '#E4DECF', c3: '#E8C86A' },
  '福州大学':   { tpl: 'modern', c1: '#2F5D8C', c2: '#F2EEE6', c3: '#E8C86A' },
  '中山大学':   { tpl: 'pailou', c1: '#E4DECF', c2: '#3E6B4F', c3: '#9E2B25' },
  '暨南大学':   null,
  '南方科技大学': { tpl: 'modern', c1: '#F2EEE6', c2: '#35707E', c3: '#E8C86A', prop: 'snow' },
  '深圳大学':   null,
  '北京师范大学珠海校区': { tpl: 'modern', c1: '#35707E', c2: '#F2EEE6', c3: '#E8C86A', prop: 'palm' },
  '海南大学':   { tpl: 'modern', c1: '#2E7D5B', c2: '#F2EEE6', c3: '#E8C86A', prop: 'palm' },
  '海南热带海洋学院': { tpl: 'modern', c1: '#1E8C8C', c2: '#F2EEE6', c3: '#E8C86A', prop: 'lighthouse' },
  '广西大学':   { tpl: 'modern', c1: '#3E7D4F', c2: '#F2EEE6', c3: '#E8C86A' },
  '贵州大学':   { tpl: 'modern', c1: '#3E6B4F', c2: '#E4DECF', c3: '#E8C86A' },
  // 华中
  '武汉大学':   { tpl: 'pailou', c1: '#D8D2C4', c2: '#2E5C8C', c3: '#9E2B25', prop: 'sakura' },
  '中南大学':   { tpl: 'modern', c1: '#2B5F9E', c2: '#F2EEE6', c3: '#E8C86A' },
  '湖南大学':   null, // 岳麓书院留给后续扩展
  '郑州大学':   { tpl: 'modern', c1: '#9E1F32', c2: '#F2EEE6', c3: '#E8C86A' },
  '河南大学':   { tpl: 'minguo', c1: '#6B6257', c2: '#D8D2C4', c3: '#2E7D5B' },
  '河南科技大学': { tpl: 'modern', c1: '#7A5C2E', c2: '#F2EEE6', c3: '#E8C86A' },
  // 西南
  '四川大学':   { tpl: 'modern', c1: '#B03A2E', c2: '#F2EEE6', c3: '#E8C86A' },
  '重庆大学':   { tpl: 'minguo', c1: '#6B6257', c2: '#9E4A3A', c3: '#E8C86A' },
  '云南大学':   { tpl: 'minguo', c1: '#E4DECF', c2: '#3E6B4F', c3: '#C24A50' },
  // 台湾
  '台湾大学':   { tpl: 'minguo', c1: '#8A5A44', c2: '#D8D2C4', c3: '#E8C86A', prop: 'bell' },
  '成功大学':   { tpl: 'minguo', c1: '#9E4A3A', c2: '#D8D2C4', c3: '#E8C86A', prop: 'phoenix' },
  '中兴大学':   { tpl: 'modern', c1: '#3E7D4F', c2: '#F2EEE6', c3: '#E8C86A' },
  '曲阜师范大学': { tpl: 'pailou', c1: '#8A6844', c2: '#9E2B25', c3: '#E8C86A' },
};
