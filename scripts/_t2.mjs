const titles = ['长城', '鸟巢'];
for (const t of titles) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2'
    + '&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch='
    + encodeURIComponent('filetype:bitmap ' + t)
    + '&prop=imageinfo&iiprop=url&iiurlwidth=640';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'QTZuBot/1.0 (kids edu game)' } });
    const j = await r.json();
    const pgs = j.query && j.query.pages;
    console.log(t, '->', pgs && pgs.length ? pgs[0].title + ' | ' + (pgs[0].imageinfo[0].thumburl || 'no thumburl').slice(0, 90) : 'NO RESULT');
  } catch (e) { console.log(t, 'ERR', e.message); }
  await new Promise(r2 => setTimeout(r2, 800));
}
