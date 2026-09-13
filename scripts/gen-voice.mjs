#!/usr/bin/env node
// 词宠岛 · 语音批量生成（零依赖，直连 Edge TTS WebSocket）
//
// 背景：仓库自带的 tools/make_voice.py 需要 Python + edge-tts + ffmpeg；在没有 Python
// 的机器上无法为新词补发音。本脚本用 Node 内置 tls 走 Edge 神经语音，输出就是 mp3，
// 不需要 ffmpeg，能补上 make_voice.py 的 TTS 兜底部分。
//
// Edge TTS 握手要点（2026 年现状，缺一不可）：
//   - query: TrustedClientToken + ConnectionId + Sec-MS-GEC + Sec-MS-GEC-Version=1-143.0.3650.75
//   - header: Origin=chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold
//   - header: Cookie: muid=<32位十六进制大写>;
//   - Sec-MS-GEC = SHA256(WindowsFileTime(取整到5分钟) + TrustedClientToken) 的大写十六进制
//
// 用法：
//   node tools/gen-voice.mjs                  # 只补缺失（word/<k>.mp3 与 _slow 不存在时）
//   node tools/gen-voice.mjs --all            # 全部重做
//   node tools/gen-voice.mjs --limit 5        # 只做前 N 条（试跑）
//   node tools/gen-voice.mjs --words "cat,dog"  # 只做指定词
//   node tools/gen-voice.mjs --no-syl         # 跳过音节
//   node tools/gen-voice.mjs --manifest-only  # 只按现有文件重建 manifest.json
//
// 注意：本脚本只做 TTS；Commons 真人美音优先的老流程仍归 make_voice.py，默认不覆盖已存在文件。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BASE = path.join(ROOT, 'game', 'audio');
const VOICE = 'en-US-JennyNeural';
const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_MAJOR = '143';
const SEC_MS_GEC_VERSION = '1-143.0.3650.75';
const CONCURRENCY = 4;
const RETRIES = 3;

const args = process.argv.slice(2);
const has = f => args.includes(f);
const optVal = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const REFRESH = has('--all');
const LIMIT = optVal('--limit') ? parseInt(optVal('--limit'), 10) : 0;
const ONLY = optVal('--words') ? optVal('--words').split(',').map(s => s.trim()).filter(Boolean) : null;
const MANIFEST_ONLY = has('--manifest-only');
const NO_SYL = has('--no-syl');

function fileKey(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
function secMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + 11644473600;
  ticks -= ticks % 300;
  ticks = Math.round(ticks * 1e7);
  return crypto.createHash('sha256').update(`${ticks}${TRUSTED}`, 'ascii').digest('hex').toUpperCase();
}

// 建立一条 Edge TTS WebSocket（返回 send/close/onMessage）
function edgeConnect() {
  return new Promise((resolve, reject) => {
    const connId = crypto.randomUUID().replace(/-/g, '');
    const muid = crypto.randomBytes(16).toString('hex').toUpperCase();
    const wsKey = crypto.randomBytes(16).toString('base64');
    const qs = `TrustedClientToken=${TRUSTED}&ConnectionId=${connId}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    const lines = [
      `Host: speech.platform.bing.com`,
      `Upgrade: websocket`, `Connection: Upgrade`,
      `Sec-WebSocket-Key: ${wsKey}`, `Sec-WebSocket-Version: 13`,
      `Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold`,
      `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
      `Accept-Encoding: gzip, deflate, br, zstd`,
      `Accept-Language: en-US,en;q=0.9`,
      `Pragma: no-cache`, `Cache-Control: no-cache`,
      `Cookie: muid=${muid};`,
    ];
    const req = `GET /consumer/speech/synthesize/readaloud/edge/v1?${qs} HTTP/1.1\r\n${lines.join('\r\n')}\r\n\r\n`;
    const sock = tls.connect({ host: 'speech.platform.bing.com', port: 443, servername: 'speech.platform.bing.com' }, () => sock.write(req));
    sock.setNoDelay(true);
    let buf = Buffer.alloc(0);
    let up = false, settled = false;
    const msgHandlers = [];
    const fail = e => { if (!settled) { settled = true; reject(e); } };
    sock.on('error', e => fail(e));
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!up) {
        const i = buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        const head = buf.slice(0, i).toString('latin1');
        if (!/ 101 /.test(head.split('\r\n')[0])) { fail(new Error(head.split('\r\n')[0])); sock.destroy(); return; }
        buf = buf.slice(i + 4); up = true; settled = true;
        resolve({
          send: str => sendFrame(0x1, Buffer.from(str, 'utf8')),
          close: () => { try { sendFrame(0x8, Buffer.alloc(0)); } catch {} sock.end(); },
          onMessage: fn => msgHandlers.push(fn),
        });
      }
      while (up) {
        if (buf.length < 2) break;
        const b0 = buf[0], b1 = buf[1];
        const op = b0 & 0x0f;
        let len = b1 & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if ((b1 & 0x80) !== 0) off += 4;   // 服务端通常不掩码
        if (buf.length < off + len) break;
        const payload = buf.slice(off, off + len); buf = buf.slice(off + len);
        if (op === 0x8) { try { sendFrame(0x8, Buffer.alloc(0)); } catch {} sock.end(); up = false; break; }
        if (op === 0x9) { sendFrame(0xA, payload); continue; }
        if (op === 0x2) {
          // Edge TTS 二进制帧 = [2 字节 headerLen][header][音频]，前两节必须剥掉才是纯 mp3
          let audio = payload;
          if (payload.length >= 2) {
            const hl = payload.readUInt16BE(0);
            if (hl > 0 && hl + 2 <= payload.length && payload.slice(2, 2 + hl).toString('latin1').includes('Path:')) {
              audio = payload.slice(2 + hl);
            }
          }
          if (audio.length) msgHandlers.forEach(f => f(audio, 0x2));
          continue;
        }
        if (op === 0x1) msgHandlers.forEach(f => f(payload.toString('utf8'), 0x1));
        else if (op === 0x0) msgHandlers.forEach(f => f(payload, 0x2));   // 续帧仍属音频
      }
    });
    function sendFrame(opcode, payload) {
      const b = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
      const mask = crypto.randomBytes(4);
      let h;
      if (b.length < 126) { h = Buffer.alloc(2); h[1] = 0x80 | b.length; }
      else if (b.length < 65536) { h = Buffer.alloc(4); h[1] = 0x80 | 126; h.writeUInt16BE(b.length, 2); }
      else { h = Buffer.alloc(10); h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(b.length), 2); }
      h[0] = 0x80 | opcode;
      const m = Buffer.alloc(b.length);
      for (let i = 0; i < b.length; i++) m[i] = b[i] ^ mask[i & 3];
      sock.write(Buffer.concat([h, mask, m]));
    }
  });
}

// 合成一段文本，返回 mp3 Buffer
async function synth(text, rate = '+0%', pitch = '+0Hz', voice = VOICE) {
  const ws = await edgeConnect();
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const timer = setTimeout(() => finish(reject, new Error('timeout')), 30000);
    const finish = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); try { ws.close(); } catch {} fn(arg); };
    ws.onMessage((data, op) => {
      if (op === 0x1) { if (String(data).includes('turn.end')) finish(resolve, Buffer.concat(chunks)); return; }
      chunks.push(data);
    });
    const ts = new Date().toString();
    ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
      JSON.stringify({ context: { synthesis: { audio: {
        metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      } } } }));
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>`
      + `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
    ws.send(`X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}\r\nPath:ssml\r\n\r\n` + ssml);
  });
}

async function synthTo(file, text, rate, voice) {
  if (!REFRESH && fs.existsSync(file) && fs.statSync(file).size > 500) return 'skip';
  for (let a = 1; a <= RETRIES; a++) {
    try {
      const buf = await synth(text, rate, '+0Hz', voice);
      if (buf.length > 500) { fs.writeFileSync(file, buf); return 'ok'; }
      throw new Error('audio too small: ' + buf.length);
    } catch (e) {
      if (a === RETRIES) { console.log('  FAIL', path.basename(file), JSON.stringify(text), e.message); return 'fail'; }
      await new Promise(r => setTimeout(r, 1000 * a));
    }
  }
}

function rebuildManifest() {
  const manifest = {};
  for (const sub of ['word', 'syl', 'letter', 'fx']) {
    const dir = path.join(BASE, sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.mp3')) continue;
      const key = `${sub}/${f.replace(/\.mp3$/, '')}`;
      if (fs.statSync(path.join(dir, f)).size > 300) manifest[key] = `audio/${key}.mp3`;
    }
  }
  fs.writeFileSync(path.join(BASE, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return Object.keys(manifest).length;
}

async function main() {
  for (const sub of ['word', 'syl', 'letter', 'fx']) fs.mkdirSync(path.join(BASE, sub), { recursive: true });
  if (MANIFEST_ONLY) { console.log('manifest 重建：' + rebuildManifest() + ' 条'); return; }

  const mod = await import(pathToFileURL(path.join(ROOT, 'game', 'js', 'words.js')).href);
  let words = mod.WORDS.map(w => w.en);
  const syls = NO_SYL ? [] : [...new Set(mod.WORDS.flatMap(w => w.syl || []).map(s => String(s).toLowerCase()))];
  if (ONLY) words = words.filter(w => ONLY.some(o => o.toLowerCase() === w.toLowerCase()));
  if (LIMIT) words = words.slice(0, LIMIT);
  const seen = new Set();
  words = words.filter(w => { const k = fileKey(w); if (!k || seen.has(k)) return false; seen.add(k); return true; });

  console.log(`待处理: 词/短语 ${words.length} 个${NO_SYL ? '' : `，音节 ${syls.length} 个`}`);
  const jobs = [];
  for (const w of words) {
    const k = fileKey(w);
    jobs.push({ file: path.join(BASE, 'word', k + '.mp3'), text: w, rate: '+0%' });
    jobs.push({ file: path.join(BASE, 'word', k + '_slow.mp3'), text: w, rate: '-35%' });
  }
  for (const s of syls) jobs.push({ file: path.join(BASE, 'syl', fileKey(s) + '.mp3'), text: s, rate: '-25%' });

  let done = 0, ok = 0, skip = 0, fail = 0;
  const queue = jobs.slice();
  async function worker() {
    while (queue.length) {
      const j = queue.shift();
      const r = await synthTo(j.file, j.text, j.rate);
      done++;
      if (r === 'ok') ok++; else if (r === 'skip') skip++; else fail++;
      if (done % 20 === 0) console.log(`  进度 ${done}/${jobs.length}（新增 ${ok} · 跳过 ${skip} · 失败 ${fail}）`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`生成完成：新增 ${ok} · 跳过 ${skip} · 失败 ${fail}`);
  console.log('manifest：' + rebuildManifest() + ' 条');
  if (fail) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
