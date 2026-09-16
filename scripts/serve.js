// Q淘族后端：静态文件 + 排行榜接口（纯 Node，无需任何依赖）
// 用法: node scripts/serve.js [端口]      端口默认 6000
// 接口: GET /api/leaderboard   POST /api/score   POST /api/register   POST /api/login   POST /api/update   OPTIONS /api/*
// 账号: 昵称唯一，密码可以为空；设了密码后换账号登录就要验证。服务端 MD5 迭代 3 次（带昵称加盐）后保存，不存明文
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT) || 6000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(__dirname, '..');
const BOARD_FILE = path.join(__dirname, 'leaderboard.json');
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');
const SAVES_DIR = path.join(__dirname, 'saves');             // 跨设备存档：每用户一个文件（写放大归零）
const LEGACY_SAVES_FILE = path.join(__dirname, 'saves.json'); // 旧版单文件（启动时自动迁移拆分）
const SESSIONS_FILE = path.join(__dirname, 'sessions.json'); // 在线会话：同账号只允许一处在线
const BACKUP_DIR = path.join(__dirname, 'backup');           // 每日自动备份

// ---------- 写队列：所有"读-改-写"操作串行执行，根除并发覆盖丢数据 ----------
let _chain = Promise.resolve();
function enqueue(fn) {
  const p = _chain.then(fn, fn);   // 前一个失败也不阻断后续
  _chain = p.catch(() => {});
  return p;
}

// ---------- 在线会话（单点登录：后登录的顶掉先登录的） ----------
// sessions.json 持久化，服务重启不误踢；新登录覆盖旧令牌，旧会话心跳即失效
const SESSIONS = (() => {
  try {
    const obj = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) { return {}; }
})();
function saveSessions() {
  try {
    const tmp = SESSIONS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(SESSIONS), 'utf8');
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (e) { /* 写失败不阻断登录 */ }
}
function newSession(username) {
  const token = crypto.randomBytes(16).toString('hex');
  SESSIONS[username] = { token, t: Date.now() };
  saveSessions();
  return token;
}
// token 存在且与当前会话不符 = 已被顶下线
function isKicked(username, token) {
  if (!token) return false;                       // 老客户端没令牌：不误伤
  const s = SESSIONS[username];
  return !!(s && s.token !== token);
}
// 老账号（功能上线前就存在排行榜里、没设过密码的）按“空密码”处理
const LEGACY_PASSWORD = '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.webmanifest': 'application/manifest+json',
};

// ---------- 排行榜文件 ----------
function readBoard() {
  try {
    const rows = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    return [];   // 文件不存在或损坏时当作空榜，不影响服务
  }
}

function writeBoard(rows) {
  const tmp = BOARD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, BOARD_FILE);   // 原子替换，避免写一半被读到
}

function byRank(a, b) {
  const d = (Number(b.score) || 0) - (Number(a.score) || 0);
  if (d) return d;
  const x = String(a.username || '');
  const y = String(b.username || '');
  return x < y ? -1 : x > y ? 1 : 0;
}

// ---------- 账号（昵称 + 密码） ----------
// 密码不存明文：md5(md5(md5(昵称:密码)))，共 3 次转换，昵称当盐避免相同密码哈希一样
function hashPwd(username, pwd) {
  let h = String(pwd);
  const salt = String(username).toLowerCase();
  for (let i = 0; i < 3; i++) h = crypto.createHash('md5').update(`${salt}:${h}`).digest('hex');
  return h;
}

function readAccounts() {
  try {
    const obj = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};   // 文件不存在或损坏时当作还没有账号
  }
}

function writeAccounts(obj) {
  const tmp = ACCOUNTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, ACCOUNTS_FILE);   // 原子替换
}

// ---------- 跨设备存档（云同步的"半个云"：每用户一个文件，写放大归零） ----------
function savePath(username) { return path.join(SAVES_DIR, encodeURIComponent(username) + '.json'); }

function readSave(username) {
  try { return JSON.parse(fs.readFileSync(savePath(username), 'utf8')); }
  catch (e) { return null; }
}

function writeSave(username, rec) {
  fs.mkdirSync(SAVES_DIR, { recursive: true });
  const p = savePath(username);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rec), 'utf8');   // 存档含完整词宠/进度，体积大，不缩进
  fs.renameSync(tmp, p);   // 原子替换（Windows 上 rename 可覆盖已存在文件）
}

// 启动迁移：旧版单文件 saves.json → saves/ 目录（每个用户一个文件），旧文件改名 .migrated
(function migrateSaves() {
  try {
    if (!fs.existsSync(LEGACY_SAVES_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(LEGACY_SAVES_FILE, 'utf8'));
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      fs.mkdirSync(SAVES_DIR, { recursive: true });
      let n = 0;
      for (const [u, rec] of Object.entries(obj)) {
        const p = savePath(u);
        if (!fs.existsSync(p)) { fs.writeFileSync(p, JSON.stringify(rec), 'utf8'); n++; }
      }
      fs.renameSync(LEGACY_SAVES_FILE, LEGACY_SAVES_FILE + '.migrated');
      console.log(`[迁移] 旧 saves.json 已拆分为 saves/ 目录（${n} 个用户），旧文件改名 .migrated`);
    }
  } catch (e) { console.error('[迁移失败]', e.message, '—— 旧数据保留在 saves.json，服务继续用现有数据'); }
})();

// ---------- 每日自动备份：启动时 + 每小时检查跨天，当日已备份则跳过 ----------
function backupOnce() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(BACKUP_DIR, day);
    if (fs.existsSync(dir)) return;   // 今天已备过
    fs.mkdirSync(dir, { recursive: true });
    for (const f of [BOARD_FILE, ACCOUNTS_FILE, SESSIONS_FILE]) {
      try { fs.copyFileSync(f, path.join(dir, path.basename(f))); } catch (e) { /* 文件可能还没生成 */ }
    }
    try {
      if (fs.existsSync(SAVES_DIR)) fs.cpSync(SAVES_DIR, path.join(dir, 'saves'), { recursive: true });
      else if (fs.existsSync(LEGACY_SAVES_FILE)) fs.copyFileSync(LEGACY_SAVES_FILE, path.join(dir, 'saves.json'));
    } catch (e) { /* ignore */ }
    console.log(`[备份] ${day} 玩家数据已备份 -> ${dir}`);
  } catch (e) { console.error('[备份失败]', e.message); }
}
backupOnce();
setInterval(backupOnce, 60 * 60 * 1000);   // 每小时检查一次，跨天自动补备份

// 校验身份并返回账号名；失败返回 null（与 /api/score 同一套规则）
function authSave(body) {
  const username = String((body && body.username) != null ? body.username : '').trim().slice(0, 20);
  if (!username) return null;
  const accounts = readAccounts();
  const acc = accounts[username];
  const password = String((body && body.password) != null ? body.password : '');
  if (!acc || acc.pwd !== hashPwd(username, password)) return null;
  return username;
}

// 老账号：在排行榜里出现过、但还没在账号表里登记过
function isLegacyName(username) {
  return readBoard().some(x => x && String(x.username || '') === username);
}

// 校验昵称 / 密码（密码可以为空，宽松为主）
function cleanCreds(body) {
  const username = String((body && body.username) != null ? body.username : '').trim().slice(0, 20);
  const password = String((body && body.password) != null ? body.password : '');
  if (!username) return { error: '先写一个名字' };
  if (/[\u0000-\u001f]/.test(username)) return { error: '名字里有特殊字符' };
  if (password.length > 64) return { error: '密码最多 64 位' };
  return { username, password };
}

function scoreOf(username) {
  const row = readBoard().find(x => x && String(x.username || '') === username);
  return row ? Number(row.score) || 0 : 0;
}

function genderOf(username) {
  const row = readBoard().find(x => x && String(x.username || '') === username);
  return row && row.gender === 'girl' ? 'girl' : 'boy';
}

// ---------- HTTP 小工具 ----------
function sendJson(res, status, payload) {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': raw.length,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, must-revalidate',
  });
  res.end(raw);
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function log(req, status, note) {
  console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.url} -> ${status}${note ? ' ' + note : ''}`);
}

// 解析 JSON 请求体；出错时直接回 400 并返回 null
async function parseBody(req, res) {
  try {
    return JSON.parse((await readBody(req)) || '{}');
  } catch (e) {
    sendJson(res, 400, { error: 'invalid json' });
    log(req, 400, 'invalid json');
    return null;
  }
}

// ---------- 静态文件 ----------
function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    res.writeHead(400); res.end('bad request'); return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {   // 防目录穿越
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      log(req, 404);
      return;
    }
    const headers = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
    };
    // 模型几十 MB 且内容不变化：长缓存，避免每次进游戏重新下载；
    // 音频按文件名寻址、可能重生成，给 7 天缓存；其余代码文件走 ETag 协商缓存
    // （站点可能挂在 / 或 /game/ 下，两种路径都要命中）
    if (rel.includes('/models/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    else if (rel.includes('/audio/')) headers['Cache-Control'] = 'public, max-age=604800';
    else {
      headers['Cache-Control'] = 'no-cache';
      const etag = `"${st.size}-${st.mtimeMs}"`;
      headers['ETag'] = etag;
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); log(req, 304); return; }
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- 服务 ----------
const server = http.createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (pathname === '/api/leaderboard' && (req.method === 'GET' || req.method === 'HEAD')) {
      // 多维榜：返回前 30 名全字段（分数/词宠/城市/星星），客户端按页签排序展示
      const rows = readBoard().slice().sort(byRank).slice(0, 30);
      sendJson(res, 200, rows);
      log(req, 200, `top${rows.length}`);
      return;
    }

    if (pathname === '/api/register' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      const creds = cleanCreds(body);
      if (creds.error) { sendJson(res, 400, { error: creds.error }); log(req, 400, creds.error); return; }
      const { username, password } = creds;
      const gender = body.gender === 'girl' ? 'girl' : 'boy';
      // 唯一性检查与写入必须原子：两个同名注册并发时不能都通过
      await enqueue(() => {
        const accounts = readAccounts();
        // 昵称唯一：已注册的、或老排行榜里已有的名字，都不能再注册，只能登录
        if (accounts[username] || isLegacyName(username)) {
          sendJson(res, 409, { error: '这个名字已经有人用了' });
          log(req, 409, 'name taken');
          return;
        }
        accounts[username] = { pwd: hashPwd(username, password), gender, createdAt: Date.now() };
        writeAccounts(accounts);
        const token = newSession(username);   // 单点登录：新会话顶掉旧会话
        sendJson(res, 201, { username, gender, score: 0, token });
        log(req, 201, 'registered');
      });
      return;
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      const creds = cleanCreds(body);
      if (creds.error) { sendJson(res, 400, { error: creds.error }); log(req, 400, creds.error); return; }
      const { username, password } = creds;
      let out = null;   // 队列任务里组装响应
      await enqueue(() => {
        const accounts = readAccounts();
        let acc = accounts[username];
        if (!acc) {
          // 老账号：还没登记过，按空密码处理；登录成功后补登记
          if (!isLegacyName(username)) {
            out = [404, { error: '还没有这个名字，去注册吧' }, 'no account'];
            return;
          }
          if (password !== LEGACY_PASSWORD) { out = [401, { error: '密码不对' }, 'bad legacy pwd']; return; }
          acc = { pwd: hashPwd(username, LEGACY_PASSWORD), gender: genderOf(username), createdAt: Date.now() };
          accounts[username] = acc;
          writeAccounts(accounts);
        } else if (acc.pwd !== hashPwd(username, password)) {
          out = [401, { error: '密码不对' }, 'bad pwd'];
          return;
        }
        const token = newSession(username);   // 单点登录：本次登录顶掉该账号其他设备
        out = [200, { username, gender: acc.gender === 'girl' ? 'girl' : genderOf(username), score: scoreOf(username), token }, 'login ok'];
      });
      if (out) { sendJson(res, out[0], out[1]); log(req, out[0], out[2]); }
      return;
    }

    // 改档案：改昵称 / 改密码（改完昵称后，密码会按新昵称重新加盐）
    if (pathname === '/api/update' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      const cur = cleanCreds(body);
      if (cur.error) { sendJson(res, 400, { error: cur.error }); log(req, 400, cur.error); return; }
      const next = cleanCreds({ username: body.newUsername, password: body.newPassword });
      if (next.error) { sendJson(res, 400, { error: next.error }); log(req, 400, next.error); return; }
      // 改名涉及账号表+排行榜双写，整体入队保证原子
      await enqueue(() => {
        const accounts = readAccounts();
        const acc = accounts[cur.username];
        // 先验证当前身份；没有账号的老名字按空密码验证；完全没出现过的名字当新注册放行
        if (acc) {
          if (acc.pwd !== hashPwd(cur.username, cur.password)) {
            sendJson(res, 401, { error: '密码不对' });
            log(req, 401, 'bad pwd (update)');
            return;
          }
        } else if (isLegacyName(cur.username)) {
          if (cur.password !== LEGACY_PASSWORD) {
            sendJson(res, 401, { error: '密码不对' });
            log(req, 401, 'bad legacy pwd (update)');
            return;
          }
        }
        // 改昵称要保证新名字没被别人占用
        if (next.username !== cur.username && (accounts[next.username] || isLegacyName(next.username))) {
          sendJson(res, 409, { error: '这个名字已经有人用了' });
          log(req, 409, 'name taken (update)');
          return;
        }
        const gender = (acc && acc.gender === 'girl') || genderOf(cur.username) === 'girl' ? 'girl' : 'boy';
        if (next.username !== cur.username) delete accounts[cur.username];
        accounts[next.username] = { pwd: hashPwd(next.username, next.password), gender, createdAt: (acc && acc.createdAt) || Date.now() };
        writeAccounts(accounts);
        // 排行榜里的分数跟着改名，别丢进度；云存档文件同步改名
        if (next.username !== cur.username) {
          const rows = readBoard();
          const row = rows.find(x => x && String(x.username || '') === cur.username);
          if (row) { row.username = next.username; writeBoard(rows); }
          const rec = readSave(cur.username);
          if (rec) { writeSave(next.username, rec); try { fs.unlinkSync(savePath(cur.username)); } catch (e) {} }
        }
        sendJson(res, 200, { username: next.username, gender, score: scoreOf(next.username) });
        log(req, 200, 'account updated');
      });
      return;
    }

    if (pathname === '/api/score' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      const username = String(body && body.username != null ? body.username : '').trim().slice(0, 20);
      const delta = Math.max(0, Math.min(100, Math.floor(Number(body && body.delta != null ? body.delta : 1)) || 0));
      const gender = body && body.gender === 'girl' ? 'girl' : 'boy';   // 未上报的老数据按男孩处理
      if (!username || !delta) {
        sendJson(res, 400, { error: 'invalid score' });
        log(req, 400, 'invalid score');
        return;
      }
      if (isKicked(username, body.token)) {
        sendJson(res, 401, { error: 'kicked' });
        log(req, 401, 'kicked (score)');
        return;
      }
      // 记账必须带对密码，否则别人用同名就能改你的分数
      const accounts = readAccounts();
      const acc = accounts[username];
      const password = String((body && body.password) != null ? body.password : '');
      if (!acc || acc.pwd !== hashPwd(username, password)) {
        sendJson(res, 401, { error: '请先登录' });
        log(req, 401, 'unauthorized score');
        return;
      }
      // 记账读改写入队：两个并发加分不能互相覆盖
      await enqueue(() => {
        const rows = readBoard();
        let row = rows.find(x => x && x.username === username);
        if (!row) { row = { username, score: 0, gender }; rows.push(row); }
        if (delta) row.score = (Number(row.score) || 0) + delta;
        row.gender = gender;
        const title = String((body && body.title) != null ? body.title : '').trim().slice(0, 12);
        if (title) row.title = title;   // 称号展示名（许愿井购买后随分数上报）
        // 多维权榜字段：词宠数 / 到访城市数 / 星星数（客户端随分数或 sync 上报，取最新值）
        for (const [k, lim] of [['pets', 9999], ['cities', 999], ['stars', 999999]]) {
          const v = parseInt((body && body[k]) != null ? body[k] : NaN, 10);
          if (Number.isFinite(v) && v >= 0) row[k] = Math.min(v, lim);
        }
        writeBoard(rows);
        sendJson(res, 200, row);
        log(req, 200, `${username}=${row.score}`);
      });
      return;
    }

    // 心跳：每 10 秒一次，令牌被顶（同名新登录）时立即回 401，客户端弹登录框
    if (pathname === '/api/heartbeat' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      const username = String((body && body.username) != null ? body.username : '').trim().slice(0, 20);
      if (!username) { sendJson(res, 400, { error: 'invalid' }); return; }
      if (isKicked(username, body.token)) { sendJson(res, 401, { error: 'kicked' }); log(req, 401, `${username} kicked`); return; }
      sendJson(res, 200, { ok: true });
      return;
    }

    // 上传完整存档（登录状态下静默双写；换设备登录后 pull-save 拉回）
    if (pathname === '/api/push-save' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      if (isKicked(String((body && body.username) != null ? body.username : '').trim().slice(0, 20), body && body.token)) {
        sendJson(res, 401, { error: 'kicked' }); log(req, 401, 'kicked (push-save)'); return;
      }
      const username = authSave(body);
      if (!username) { sendJson(res, 401, { error: '请先登录' }); log(req, 401, 'unauthorized save'); return; }
      const save = body.save;
      if (!save || typeof save !== 'object' || Array.isArray(save)) {
        sendJson(res, 400, { error: 'invalid save' }); log(req, 400, 'invalid save'); return;
      }
      // 存档写入入队：同账号双设备同时 push 不会写坏文件
      await enqueue(() => {
        writeSave(username, { save, updatedAt: Date.now() });
        sendJson(res, 200, { ok: true });
        log(req, 200, `${username} save pushed`);
      });
      return;
    }

    // 拉取服务器存档（登录后立即调，与本地合并）
    if (pathname === '/api/pull-save' && req.method === 'POST') {
      const body = await parseBody(req, res); if (!body) return;
      if (isKicked(String((body && body.username) != null ? body.username : '').trim().slice(0, 20), body && body.token)) {
        sendJson(res, 401, { error: 'kicked' }); log(req, 401, 'kicked (pull-save)'); return;
      }
      const username = authSave(body);
      if (!username) { sendJson(res, 401, { error: '请先登录' }); log(req, 401, 'unauthorized save'); return; }
      const rec = readSave(username);
      sendJson(res, 200, rec ? { save: rec.save } : {});
      log(req, 200, rec ? `${username} save pulled` : `${username} no save`);
      return;
    }

    sendJson(res, 404, { error: 'not found' });
    log(req, 404);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('method not allowed');
    return;
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Q淘族后端已启动: http://127.0.0.1:${PORT}`);
  console.log(`  静态目录 : ${ROOT}`);
  console.log(`  排行榜   : ${BOARD_FILE}`);
  console.log(`  账号     : ${ACCOUNTS_FILE}（密码 MD5×3 加盐保存，不存明文）`);
  console.log(`  云存档   : ${SAVES_DIR}\\（每用户一个文件）`);
  console.log(`  备份     : ${BACKUP_DIR}\\（每日一份，保留全部历史）`);
  console.log('  接口     : GET /api/leaderboard   POST /api/score|register|login|update');
  console.log('  nginx 反代 /api/ 指向本服务即可');
});

server.on('error', err => {
  console.error(`[错误] 无法监听 ${HOST}:${PORT} —— ${err.message}`);
  process.exit(1);
});
