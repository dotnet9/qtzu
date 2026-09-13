import fs from 'node:fs';

const cur = await import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('game/js/curriculum.js', 'utf8')).toString('base64'));
const w = await import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync('game/js/words.js', 'utf8')).toString('base64'));

const EMOJI = {
  'bye bye': '👋', 'good morning': '🌅', 'good afternoon': '🌤️', 'nice to meet you': '🤝', 'my name is...': '🪪',
  'happy birthday': '🎂', 'how old are you': '🎈', 'new friend': '🤝', 'do you like pears': '🍐', 'how many': '🔢',
  'pencil box': '✏️', 'living room': '🛋️', 'baby brother': '👶', 'football player': '⚽',
  'art room': '🎨', 'computer room': '💻', 'music room': '🎵', 'next to': '↔️', 'English class': '🔤', 'music class': '🎶',
  'PE class': '🏃', 'get up': '⏰', 'go to school': '🎒', 'go home': '🏠', 'go to bed': '🛏️', 'just a minute': '⏳',
  'green beans': '🫛', 'try on': '👗', 'how much': '💰', 'all right': '👌',
  'wash my clothes': '🧺', 'watch TV': '📺', 'do homework': '📝', 'read books': '📚', 'ice cream': '🍦', 'would like': '🙋',
  'sing English songs': '🎤', 'play the pipa': '🪕', 'do kung fu': '🥋', 'draw cartoons': '🎨', 'play basketball': '🏀',
  'play ping-pong': '🏓', 'speak English': '🗣️',
  'do morning exercises': '🤸', 'eat breakfast': '🥣', 'have class': '🏫', 'play sports': '⚽', 'eat dinner': '🍽️',
  'clean my room': '🧹', 'go for a walk': '🚶', 'go shopping': '🛒', 'take a dancing class': '💃', 'pick apples': '🍎',
  'make a snowman': '⛄', 'go swimming': '🏊', "April Fool's Day": '🤡', "Mother's Day": '💐', "Father's Day": '👔',
  "Children's Day": '🎈', "Teachers' Day": '🍎', 'National Day': '🇨🇳', 'playing with each other': '🤝',
  'doing the dishes': '🍽️', 'cleaning the room': '🧹', 'reading a book': '📖', 'having a class': '🏫', 'eating lunch': '🍱',
  'science museum': '🔬', 'post office': '📮', 'turn left': '⬅️', 'turn right': '➡️', 'go straight': '⬆️', 'on foot': '🚶',
  'by bus': '🚌', 'by plane': '✈️', 'by taxi': '🚕', 'by ship': '🚢', 'by subway': '🚇', 'by train': '🚆', 'slow down': '🐢',
  'traffic lights': '🚦', 'visit my grandparents': '👵', 'see a film': '🎬', 'take a trip': '🧳', 'next week': '📅',
  'comic book': '📕', 'pen pal': '✉️', 'doing kung fu': '🥋', 'reading stories': '📖', 'studies Chinese': '📖',
  'goes hiking': '🥾', 'factory worker': '🏭', 'police officer': '👮', 'head teacher': '👩‍🏫', 'see a doctor': '🩺',
  'wear warm clothes': '🧥', 'take a deep breath': '🌬️', 'count to ten': '🔢',
  'cleaned my room': '🧹', 'washed my clothes': '🧺', 'stayed at home': '🏠', 'watched TV': '📺', 'read a book': '📖',
  'saw a film': '🎬', 'had a cold': '🤒', 'last weekend': '🗓️', 'went fishing': '🎣', 'went camping': '🏕️',
  'went swimming': '🏊', 'rode a bike': '🚲', 'rode a horse': '🐴', 'hurt my foot': '🦶', 'took pictures': '📷',
  'bought gifts': '🎁', 'dining hall': '🍽️', 'look up': '🔍',
};

const isSingle = s => /^[A-Za-z][A-Za-z'’.-]*$/.test(s);
const groups = {};
for (const gk of Object.keys(cur.CURRICULUM))
  for (const u of cur.CURRICULUM[gk].units)
    for (const it of u.words) {
      const [en, zh] = it.split('|');
      if (isSingle(en)) continue;
      (groups[gk] ||= []).push({ en, zh });
    }

const plan = JSON.parse(fs.readFileSync('tools/phrase-islands.json', 'utf8'));
const metaByGk = { '3a': 0, '3b': 1, '4a': 2, '4b': 3, '5a': 4, '5b': 5, '6a': 6, '6b': 7 };
const missingEmoji = [];
const q = s => JSON.stringify(s);

let out = '';
for (const gk of Object.keys(groups)) {
  const p = plan[metaByGk[gk]];
  out += `  { key: ${q(p.key)}, name: ${q(p.name)}, emoji: ${q(p.emoji)}, color: ${q(p.color)}, cx: ${p.cx}, cz: ${p.cz}, r: ${p.r}, style: ${q(p.style)},\n`;
  out += `    rows: [\n`;
  for (const { en, zh } of groups[gk]) {
    const em = EMOJI[en];
    if (!em) missingEmoji.push(en);
    const hint = `口语「${zh}」`;
    out += `      [${q(en)}, ${q(zh)}, ${q(hint)}, ${q(`phrase:${em || '🗣️'}:${en}`)}],\n`;
  }
  out += `    ] },\n`;
}
fs.writeFileSync('tools/phrase-islands-snippet.js', out);
console.log('groups:', Object.entries(groups).map(([k, v]) => `${k}:${v.length}`).join(' '));
console.log('total phrases:', Object.values(groups).reduce((a, v) => a + v.length, 0));
console.log('missing emoji:', missingEmoji.length, missingEmoji.join(', '));
