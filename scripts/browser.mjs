// 校验脚本共用的浏览器解析与启动：CHROME_PATH 优先，其次机器上的常见位置。
// 原先 scripts/tpl-shots.mjs:4、scripts/verify-terrain.mjs:5 写死了某台机器的路径，
// 换机器就报错；这里统一成一个来源。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  // 本机 node_modules/playwright 与 agent 浏览器缓存
  path.join(os.homedir(), '.agent-browser/browsers'),
  path.join(os.homedir(), 'AppData/Local/ms-playwright'),
].filter(Boolean);

function findIn(dir, depth = 2) {
  if (!fs.existsSync(dir)) return null;
  if (dir.endsWith('.exe')) return fs.existsSync(dir) ? dir : null;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (st.isFile() && /^(chrome|msedge|chromium|chrome-headless-shell)\.exe$/i.test(name)) return p;
    if (st.isDirectory() && depth > 0) {
      const hits = fs.readdirSync(p).filter((n) => /^(chrome-win64|chrome-headless-shell-win64|chrome-win|win64)$/i.test(n));
      for (const h of hits) {
        const f = findIn(path.join(p, h), 0);
        if (f) return f;
      }
      const deeper = findIn(p, depth - 1);
      if (deeper) return deeper;
    }
  }
  return null;
}

export function resolveChrome() {
  for (const c of CANDIDATES) {
    const hit = findIn(c);
    if (hit) return hit;
  }
  throw new Error('找不到可用浏览器：请设置环境变量 CHROME_PATH 指向 chrome.exe / msedge.exe');
}

export async function launch(opts = {}) {
  // 默认用**每次独立**的临时 profile：serve.js 给 js/ 设了一年 immutable 缓存，
  // 复用 profile 会让下一次运行继续用旧模块（实测：改了源码却"提取不到"新内容）。
  // 传 profile 可显式复用（需要登录态时）。
  const { viewport = { width: 1280, height: 900 }, profile, keepProfile = false, ...rest } = opts;
  const dir = profile || fs.mkdtempSync(path.join(os.tmpdir(), 'pw-qtzu-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true, executablePath: resolveChrome(), viewport,
    args: ['--disable-application-cache', '--disk-cache-size=1', '--media-cache-size=1'],
    ...rest,
  });
  if (!profile && !keepProfile) {
    // 关闭时清掉临时目录（best-effort：Windows 上可能被占用，失败就算了）
    const origClose = ctx.close.bind(ctx);
    ctx.close = async (...a) => {
      await origClose(...a);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 忽略 */ }
    };
  }
  return ctx;
}

// 起一个静态/后端服务：脚本自带，避免"忘了先开 serve.js"
export async function serve(port) {
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, ['scripts/serve.js', String(port)], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) return { child, base, stop: () => child.kill() };
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error(`服务未能在 15s 内起来：${base}`);
}
