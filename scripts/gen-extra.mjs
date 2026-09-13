import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const { missWord, missPhrase } = JSON.parse(fs.readFileSync('tools/pep-missing.json', 'utf8'));
const wmod = await import(pathToFileURL(process.cwd() + '/' + 'game/js/words.js').href);

// ============ 1. 单词图标（覆盖全部 376 个补充词） ============
const EMO = {
  // 3a
  can: '🙆', share: '🤲', smile: '😊', listen: '👂', help: '🆘', say: '💬', and: '➕', good: '👍',
  mum: '👩', dad: '👨', grandma: '👵', grandpa: '👴', me: '🙋', have: '🤲', cousin: '🧒', baby: '👶',
  some: '🔸', like: '❤️', pet: '🐾', go: '🚶', miss: '👩‍🏫', cute: '🥰', lion: '🦁', fast: '⚡',
  air: '🌬️', school: '🏫', need: '🙏', new: '✨', give: '🎁', us: '👥', them: '👉', colour: '🎨',
  make: '🔨', purple: '🟣', pink: '🩷', draw: '✏️', year: '📅', "o'clock": '🕐', cut: '✂️', piece: '🍰', eat: '🍽️',
  // 3b
  she: '👧', he: '👦', welcome: '🙌', today: '📆', from: '🌍', pupil: '🧑‍🎓', tired: '😪', feel: '🤔',
  love: '💖', want: '🙋', drink: '🥤', sleep: '😴', play: '🎮', bag: '👜', read: '📖', write: '✍️',
  storybook: '📕', speak: '🗣️', hungry: '🍽️', doll: '🪆', box: '📦', plane: '✈️', train: '🚆', time: '⏰',
  yuan: '💴', many: '🔢', people: '👥',
  // 4a
  fan: '🌀', really: '❗', clean: '🧹', tv: '📺', key: '🔑', wow: '😮', lost: '🔍', friendly: '🤗',
  or: '🔀', right: '➡️', find: '🔎', ready: '✅', pass: '🤝', try: '💪', but: '↔️', little: '🐭',
  puppy: '🐶', basketball: '🏀',
  // 4b
  way: '🧭', now: '⏱️', kid: '🧒', thirty: '3️⃣0️⃣', hurry: '🏃', outside: '🌤️', degree: '🌡️', world: '🌏',
  london: '🇬🇧', moscow: '🇷🇺', singapore: '🇸🇬', sydney: '🇦🇺', fly: '🪁', yum: '😋', those: '👉',
  clothes: '👕', pants: '👖', dress: '👗', skirt: '🩱', sock: '🧦', shorts: '🩳', yours: '👈', mine: '🙋',
  pack: '🧳', wait: '⏳', glove: '🧤', too: '➕',
  // 5a
  know: '💡', our: '👨‍👩‍👧', ms: '👩', will: '🔮', sometime: '🕰️', robot: '🤖', him: '👦', finish: '🏁',
  wash: '🧼', watch: '👀', often: '🔁', park: '🌳', sport: '⚽', should: '☝️', every: '🔂', day: '☀️',
  schedule: '🗓️', thirsty: '🥵', favourite: '⭐', food: '🍲', dear: '💌', onion: '🧅', sing: '🎤',
  song: '🎵', cartoon: '🖍️', 'ping-pong': '🏓', party: '🎉', next: '⏭️', wonderful: '🌟', learn: '📚',
  any: '❔', problem: '❓', send: '📤', email: '📧', "we'll": '🫱', there: '📍', grandparent: '👵',
  their: '👥', lot: '📚', move: '🚚', dirty: '🧹', everywhere: '🌐', live: '🏠', nature: '🏞️',
  boating: '🛶', high: '⬆️',
  // 5b
  after: '⏭️', start: '🚦', usually: '🔁', spain: '🇪🇸', late: '⌛', why: '❔', shop: '🛍️', work: '💼',
  last: '⏮️', sound: '🔊', also: '➕', busy: '🐝', letter: '✉️', for: '🎯', island: '🏝️', always: '♾️',
  cave: '🕳️', win: '🏆', exercise: '🤸', take: '🤲', pick: '🧺', snowman: '⛄', snow: '❄️', because: '➡️',
  vacation: '🏖️', all: '💯', lovely: '🥰', fall: '🍂', paint: '🎨', contest: '🏅', few: '🔢', thing: '📦',
  meet: '🤝', trip: '🧳', national: '🚩', american: '🇺🇸', thanksgiving: '🦃', fool: '🤪', kitten: '🐱',
  diary: '📔', still: '⏸️', noise: '📢', fur: '🧸', open: '📂', walk: '🚶', first: '🥇', second: '🥈',
  third: '🥉', fourth: '4️⃣', fifth: '5️⃣', twelfth: '1️⃣2️⃣', twentieth: '2️⃣0️⃣', 'twenty-first': '2️⃣1️⃣',
  hers: '👩', theirs: '👥', ours: '🏠', each: '🔂', other: '👥', excited: '🤩', its: '🐾', show: '👉',
  anything: '❓', else: '➕', exhibition: '🖼️', sushi: '🍣', teach: '👩‍🏫', canadian: '🇨🇦', spanish: '🇪🇸',
  keep: '🔒', turn: '🔄', bamboo: '🎋',
  // 6a
  science: '🔬', museum: '🏛️', left: '⬅️', straight: '⬆️', ask: '🙋', sir: '🎩', interesting: '🤩',
  italian: '🇮🇹', restaurant: '🍽️', pizza: '🍕', street: '🛣️', get: '📍', gps: '🗺️', gave: '🎁',
  feature: '🔍', follow: '👣', far: '🔭', tell: '🗣️', by: '🚏', bus: '🚌', taxi: '🚕', subway: '🚇',
  slow: '🐢', down: '⬇️', mrs: '👩', early: '🌅', helmet: '⛑️', must: '❗', wear: '👔', attention: '⚠️',
  traffic: '🚦', munich: '🇩🇪', germany: '🇩🇪', alaska: '🇺🇸', sled: '🛷', ferry: '⛴️', scotland: '🏴',
  visit: '🚪', film: '🎬', evening: '🌆', comic: '💭', word: '🔤', postcard: '📮', lesson: '📖', space: '🚀',
  travel: '✈️', half: '➗', price: '💰', together: '🤝', mooncake: '🥮', poem: '📜', studies: '📖',
  puzzle: '🧩', hiking: '🥾', jasmine: '🌸', idea: '💡', canberra: '🇦🇺', amazing: '🤩', shall: '🙋',
  goal: '🥅', join: '🤝', club: '🎪', factory: '🏭', worker: '👷', country: '🌍', stay: '🏠',
  university: '🎓', if: '❓', use: '🔧', type: '⌨️', quickly: '💨', secretary: '💼', more: '➕',
  deep: '🌊', breath: '🫁', count: '🔢', chase: '🏃', mice: '🐭', bad: '👎', hurt: '🤕', ill: '🤒',
  wrong: '❌', well: '💪', sit: '🪑', hear: '👂', ant: '🐜', worry: '😟', stuck: '🪤', mud: '🟤', pull: '🪢',
  // 6b
  dinosaur: '🦕', hall: '🏛️', metre: '📏', than: '⚖️', both: '✌️', kilogram: '⚖️', countryside: '🌾',
  lower: '⬇️', shadow: '🌑', smarter: '🧠', become: '🔄', cleaned: '🧹', stayed: '🏠', washed: '🧼',
  watched: '📺', had: '🎁', saw: '👀', before: '⏪', drank: '🥤', magazine: '📰', better: '👍',
  faster: '🐇', hotel: '🏨', fixed: '🔧', broken: '💔', lamp: '💡', loud: '📢', enjoy: '😄', went: '🚶',
  camp: '🏕️', fishing: '🎣', rode: '🚲', ate: '🍽️', took: '📷', bought: '🛒', gift: '🎁', fell: '🤕',
  off: '⬇️', turpan: '🇨🇳', could: '💪', till: '⏳', beach: '🏖️', basket: '🧺', part: '🎭',
  licked: '👅', laughed: '😂', easy: '👌', different: '🌈', active: '🏃', race: '🏁', nothing: '🚫',
  thought: '💭', felt: '🤗', woke: '⏰', cheetah: '🐆', dream: '💤',
};
const PHRASE_EMO = {
  'red panda': '🐼', 'point to your ear': '👂', 'wave your hand': '👋', "what's your name": '🪪',
  "my name's": '🪪', 'show me your pencil': '✏️', 'be from': '🌍', 'a new student': '🧑‍🎓',
  'feel happy': '😊', 'like dogs': '🐕', 'write a word': '✍️', 'healthy food': '🥗', 'toy box': '🧸',
  'on the desk': '🪑', 'what time': '🕐', "teacher's desk": '🧑‍🏫', 'maths book': '➗', 'english book': '🔤',
  'chinese book': '📕', 'so much': '💯', 'help yourself': '🍽️', 'open the door': '🚪', 'sweep the floor': '🧹',
  'turn on the light': '💡', 'put up the picture': '🖼️', 'clean the board': '🧽', 'close the window': '🪟',
  'have a snack': '🍪', 'have a nap': '😴', 'make a salad': '🥗', 'pass me the bowl': '🥣', 'pass me the knife': '🔪',
  'cut the vegetables': '🥕', 'use the spoon': '🥄', 'use the fork': '🍴', 'first floor': '1️⃣', 'second floor': '2️⃣',
  "teacher's office": '🏢', 'hurry up': '🏃', 'come on': '💪', 'be careful': '⚠️', 'how about': '❔',
  'new york': '🇺🇸', 'of course': '👌', 'play football': '⚽', 'play sport': '🏃', 'kung fu': '🥋',
  'no problem': '👌', 'water bottle': '🚰', 'in front of': '⬆️', 'lots of': '🔢', 'go boating': '🛶',
  'go on a picnic': '🧺', 'good job': '👍', 'a few': '🔢', 'sports meet': '🏟️', 'tree planting day': '🌳',
  'the great wall': '🧱', 'each other': '🤝', 'have a look': '👀', 'keep to the right': '➡️',
  'keep your desk clean': '🧹', 'talk quietly': '🤫', 'take turns': '🔄', 'pay attention to': '⚠️',
  'word book': '📖', 'mid-autumn festival': '🥮', 'get together': '🎉', 'have an art lesson': '🎨',
  'go to the cinema': '🎬', 'do more exercise': '🏃', 'papa westray': '🏝️', 'fell off': '🤕',
  'ate fresh food': '🥗', 'labour day': '🛠️', 'go cycling': '🚴', 'play badminton': '🏸',
  'last month': '📅', 'last year': '📅',
};
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
const emojiFor = x => {
  const k = norm(x.en);
  return (/\s/.test(x.en) ? PHRASE_EMO[k] : EMO[k]) || (/\s/.test(x.en) ? '💬' : '🔤');
};

// ============ 2. 按册分组切岛 ============
const VOL_INFO = {
  '3a': { label: '三上', book: '📗', color: '#FBE4D8', style: 'mixed' },
  '3b': { label: '三下', book: '📘', color: '#DCEAF5', style: 'pine' },
  '4a': { label: '四上', book: '📙', color: '#F5EEDC', style: 'house' },
  '4b': { label: '四下', book: '📕', color: '#E4F0E4', style: 'mixed' },
  '5a': { label: '五上', book: '📗', color: '#F0E4EC', style: 'house' },
  '5b': { label: '五下', book: '📘', color: '#E8E8F5', style: 'pine' },
  '6a': { label: '六上', book: '📙', color: '#E4EEF5', style: 'mixed' },
  '6b': { label: '六下', book: '📕', color: '#F0E8DC', style: 'house' },
};
const volOf = x => (x.vols || []).find(v => v !== 'cur') || '6b';

const CHUNK_W = 24, CHUNK_P = 18;
const groups = [];
for (const vol of Object.keys(VOL_INFO)) {
  const words = missWord.filter(x => volOf(x) === vol);
  const phrases = missPhrase.filter(x => volOf(x) === vol);
  const info = VOL_INFO[vol];
  words.forEach((x, i) => {
    const part = Math.floor(i / CHUNK_W);
    const idx = i % CHUNK_W;
    let g = groups.find(g => g.vol === vol && g.kind === 'word' && g.part === part);
    if (!g) { groups.push(g = { vol, kind: 'word', part, rows: [] }); }
    g.rows.push(x);
  });
  phrases.forEach((x, i) => {
    const part = Math.floor(i / CHUNK_P);
    let g = groups.find(g => g.vol === vol && g.kind === 'phrase' && g.part === part);
    if (!g) { groups.push(g = { vol, kind: 'phrase', part, rows: [] }); }
    g.rows.push(x);
  });
}

// ============ 3. 环形避让排布 ============
const excl = wmod.ISLANDS.map(i => ({ cx: i.cx, cz: i.cz, r: i.r }));
const radiusFor = n => Math.max(10.5, Math.min(19, 8.5 + n * 0.42));
const placed = [];
const collisions = [];
for (const g of groups) {
  const r = radiusFor(g.rows.length);
  let best = null;
  for (let R = 106; R <= 196 && !best; R += 2) {
    let cand = null;
    for (let deg = 0; deg < 360; deg += 1) {
      const a = deg * Math.PI / 180;
      const cx = +(R * Math.cos(a)).toFixed(1), cz = +(R * Math.sin(a)).toFixed(1);
      let clear = 1e9;
      for (const o of [...excl, ...placed]) clear = Math.min(clear, Math.hypot(cx - o.cx, cz - o.cz) - (r + o.r));
      if (clear >= 6 && (!cand || clear > cand.clear)) cand = { cx, cz, clear };
    }
    if (cand) best = cand;
  }
  if (!best) { collisions.push(g); continue; }
  const info = VOL_INFO[g.vol];
  const key = `x${g.vol}${g.kind === 'phrase' ? 'p' : 'w'}${g.part + 1}`;
  const name = `${info.label}${g.kind === 'phrase' ? '口语岛' : '拓展岛'}${g.part > 0 ? g.part + 1 : ''}`;
  placed.push({
    key, name, emoji: info.book, color: info.color, cx: best.cx, cz: best.cz, r,
    style: info.style, vol: g.vol, kind: g.kind,
    rows: g.rows.map(x => {
      const em = emojiFor(x);
      const spec = /\s/.test(x.en) ? `phrase:${em}:${x.en}` : `icon:${em}`;
      const hint = `${VOL_INFO[g.vol].label}课本词汇`;
      return [x.en, x.zh, hint, spec];
    }),
  });
}
if (collisions.length) { console.error('FAILED to place', collisions.length); process.exit(1); }

console.log('new islands:', placed.length, '| words:', placed.filter(p => p.kind === 'word').reduce((a, p) => a + p.rows.length, 0), '| phrases:', placed.filter(p => p.kind === 'phrase').reduce((a, p) => a + p.rows.length, 0));
const maxExt = Math.max(...placed.map(p => Math.max(Math.abs(p.cx) + p.r, Math.abs(p.cz) + p.r)));
console.log('max axis extent:', maxExt.toFixed(1));

const q = s => JSON.stringify(s);
let out = `// 自动生成：人教版PEP 小学英语 3-6 年级 8 册 补充词汇岛（勿手改，见 tools/gen-extra.mjs）
// 覆盖：${placed.filter(p => p.kind === 'word').reduce((a, p) => a + p.rows.length, 0)} 个课本单词 + ${placed.filter(p => p.kind === 'phrase').reduce((a, p) => a + p.rows.length, 0)} 条课本短语
export const EXTRA_ISLANDS = [\n`;
for (const p of placed) {
  out += `  { key: ${q(p.key)}, name: ${q(p.name)}, emoji: ${q(p.emoji)}, color: ${q(p.color)}, cx: ${p.cx}, cz: ${p.cz}, r: ${(+p.r.toFixed(2))}, style: ${q(p.style)},\n    rows: [\n`;
  for (const [en, zh, hint, spec] of p.rows) out += `      [${q(en)}, ${q(zh)}, ${q(hint)}, ${q(spec)}],\n`;
  out += `    ] },\n`;
}
out += `];\n`;
fs.writeFileSync('game/js/pep-extra.js', out);
console.log('written game/js/pep-extra.js');
