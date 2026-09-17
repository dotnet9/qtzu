import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const srcs = JSON.parse(fs.readFileSync('scripts/wx-srcs.json', 'utf8'));
const PROVINCES = ['北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '香港', '澳门', '台湾'];
const dir = 'C:/Users/liu64/Downloads/dd';
fs.mkdirSync(dir, { recursive: true });
if (srcs.length !== PROVINCES.length) console.log('warn count', srcs.length, PROVINCES.length);
for (let i = 0; i < srcs.length; i++) {
  const name = (PROVINCES[i] || ('img' + (i + 1))) + '.png';
  try {
    const res = await fetch(srcs[i], { headers: { Referer: 'https://mp.weixin.qq.com/', 'User-Agent': 'Mozilla/5.0 Chrome/120' } });
    if (!res.ok) { console.log('FAIL', name, res.status); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(dir, name), buf);
    console.log('OK', name, Math.round(buf.length / 1024) + 'KB');
  } catch (e) { console.log('ERR', name, String(e).slice(0, 60)); }
}
console.log('done');
