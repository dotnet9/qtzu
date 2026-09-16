// 节日轻装饰：按公历/农历日期表返回当前（或 3 天内即将到来）的节日，只做问候与 HUD 徽标，不加玩法
// 农历节日（春节/端午/中秋）按 2026-2027 年的公历日期内置，之后可逐年补一行
const FESTIVALS = [
  { m: 1, d: 1, name: '元旦', en: "New Year's Day", emoji: '🎊' },
  { m: 2, d: 17, name: '春节', en: 'Spring Festival', emoji: '🧧', until: 225 },   // 2026 春节 2/17，放到 2/22
  { m: 3, d: 8, name: '妇女节', en: "Women's Day", emoji: '🌷' },
  { m: 4, d: 5, name: '清明节', en: 'Qingming', emoji: '🌿' },
  { m: 6, d: 1, name: '儿童节', en: "Children's Day", emoji: '🎈', until: 3 },
  { m: 6, d: 19, name: '端午节', en: 'Dragon Boat Festival', emoji: '🚣', until: 225 },
  { m: 9, d: 25, name: '中秋节', en: 'Mid-Autumn Festival', emoji: '🥮', until: 228 },
  { m: 10, d: 1, name: '国庆节', en: 'National Day', emoji: '🇨🇳', until: 7 },
  { m: 12, d: 25, name: '圣诞节', en: 'Christmas', emoji: '🎄', until: 7 },
];

export function getFestival(now = new Date()) {
  const day = now.getDate();
  for (const f of FESTIVALS) {
    if (now.getMonth() + 1 === f.m && day >= f.d && day <= f.d + (f.until || 1)) return f;
  }
  // 3 天内将至：预告
  for (const f of FESTIVALS) {
    if (f.m === now.getMonth() + 1 && f.d > day && f.d - day <= 3) return { ...f, soon: true };
  }
  return null;
}
