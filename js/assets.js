// GLB 资产加载器：程序化模型先顶上，烘焙资产到位后"原地替换"（美术升级方案 §4.4）
//
// 三条硬约束（违反了就会出"看不见的蛋"那类事故）：
//   1) 永不阻塞、永不抛错：调用方拿到的是 Promise，失败/超时/离线/低端机一律保留程序化结果，
//      孩子不该因为美术资源等一秒白屏（js/main.js:82 的进城流程不 await 这里）；
//   2) 只换 children，不换 Group 本身：js/game.js:2158 的 userData.sign、js/game.js 的
//      playerParts.* 都持有 Group 引用与 transform，整体替换会让点击/动画全部失效；
//   3) manifest 只是"可选增强"：仓库里没有 assets/models/ 时整模块退化成 no-op。
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'assets/models/';
const MANIFEST = BASE + 'manifest.json';
const TIMEOUT = 2000;      // 单资产超时：到点先保持程序化，但到货后补换（见 drainLate）——不补就等于"排队靠后=永久程序化"
const CONCURRENCY = 6;     // 并发上限：一口气几十个 GLB 会和首屏代码抢带宽（地面加入后 4 偏紧）
// 触屏设备（手机/平板）直接用程序化版本：GLB 是"桌面优先"的加分项，
// 不该让老手机为它冒崩上下文的险（方案 §八.8，与 js/game.js:230 的 lowEnd 同一判据）
const LOW_END = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

let manifest;              // undefined=还没加载 / null=没有或加载失败 / object=就绪
let booting = null;
const index = new Map();   // kind → Map(key → entry)
const cache = new Map();   // url → Promise<Group|null>（同族实例共用几何/材质）
// 超时（这一次没赶上）的组：等资产真正加载完成后补换，避免"排队靠后 = 永久程序化"
const lateSwap = [];
const warned = new Set();
let active = 0;
const queue = [];
const state = { ready: false, hits: 0, misses: 0, failed: [], pending: 0 };
const loader = new GLTFLoader();

const warnOnce = (file, why) => {
  if (warned.has(file)) return;
  warned.add(file);
  if (!state.failed.includes(file)) state.failed.push(file);
  console.warn(`[assets] ${why}，回退程序化：${file}`);
};

// 信号量：并发上限，超出排队
function slot() {
  if (active < CONCURRENCY) { active++; return Promise.resolve(); }
  return new Promise((res) => queue.push(res));
}
function release() {
  const next = queue.shift();
  if (next) next();
  else active--;
}

// manifest 只拉一次。cache:'no-store' 是为了绕开 scripts/serve.js:294 给 /models/ 的一年
// immutable 缓存——否则重烘后浏览器还会用旧 manifest（GLB 自己有 ?v= 内容哈希，不受影响）。
export function ready() {
  if (manifest !== undefined) return Promise.resolve(manifest);
  if (booting) return booting;
  booting = fetch(MANIFEST, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      manifest = (m && m.assets) ? m : null;
      if (manifest) {
        for (const [id, e] of Object.entries(manifest.assets)) {
          const m2 = index.get(e.kind) || new Map();
          index.set(e.kind, m2);
          m2.set(id, e);
          // 运行时用的 key 是"实体身份"（校门=校名），不是文件 id：见 scripts/bake/specs.mjs
          // aliases：词宠去重后一个 GLB 代表多个 petId（932 词宠 → 358 种外观）
          for (const k of [e.zh, e.name, e.key, ...(e.aliases || [])]) if (k != null) m2.set(k, e);
        }
        state.ready = true;
      }
      return manifest;
    })
    .catch(() => { manifest = null; return null; });
  return booting;
}

// 同步查一条：manifest 未就绪时返回 null（apply 内部会等就绪后再查一次）
export function lookup(kind, key) {
  const m = index.get(kind);
  return (m && m.get(key)) || null;
}

function load(entry) {
  const url = `${BASE}${entry.file}?v=${entry.v || 0}`;   // ?v= 让"换资产即换 URL"，长缓存也拿得到新模型
  const hit = cache.get(url);
  if (hit) return hit;
  const p = slot().then(() => new Promise((res) => {
    loader.load(url,
      (g) => res(g.scene),
      undefined,
      () => { warnOnce(entry.file, '载入失败'); res(null); });
  })).then((v) => {
    release();
    if (v) drainLate(entry.file, v);   // 到货后补换之前超时的那些组
    return v;
  }, () => { release(); warnOnce(entry.file, '载入异常'); return null; });
  cache.set(url, p);
  return p;
}

// 超时不取消底层请求：这一次先用程序化的，下一次进城命中缓存直接换（不浪费带宽）
function fitted(entry) {
  state.pending++;
  return new Promise((res) => {
    const t = setTimeout(() => res(null), TIMEOUT);
    load(entry).then((v) => { clearTimeout(t); state.pending--; res(v); });
  });
}

// 资产到货后，把之前超时的组补换上（group 还在场景里才换，城市重建后就不管了）
function drainLate(file, scene) {
  for (let i = lateSwap.length - 1; i >= 0; i--) {
    const rec = lateSwap[i];
    if (rec.entry.file !== file) continue;
    lateSwap.splice(i, 1);
    if (!rec.group || !rec.group.parent) continue;
    swap(rec.group, scene, rec.entry, rec.opts);
  }
}

function swap(group, scene, entry, opts) {
  // 运行时挂件（名牌 sprite 等标了 userData.keep 的）必须留下：它们由调用方后挂，
  // 不在烘焙资产里，清掉就"校门没名字了"
  const keep = group.children.filter((c) => c.userData && c.userData.keep);
  for (const c of group.children.slice()) group.remove(c);
  const inst = scene.clone(true);   // clone 只复制节点，几何/材质是共享的（同族实例不涨显存）
  inst.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    // 统一质感：GLB 过一遍风格映射表（哑光、无金属、环境反射轻），免得出现
    // "烘焙资产是一种亮、旁边程序化资产是另一种亮"的缝合怪（方案 §4.5）
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m || !m.isMeshStandardMaterial) continue;
      m.roughness = Math.max(0.82, m.roughness);
      m.metalness = 0;
      m.envMapIntensity = 0.7;
    }
  });
  group.add(inst);
  for (const k of keep) group.add(k);
  group.userData.asset = entry.file;
  state.hits++;
  if (opts.onSwap) { try { opts.onSwap(group, entry); } catch (e) { console.warn('[assets] onSwap 失败', e); } }
}

// 原地替换：group 的 transform / userData / 引用都不动，只换 children
// opts.onSwap(group, entry)：换装后调用方补挂自己的东西（校徽匾、userData.sign 打标）
export function apply(group, kind, key, opts = {}) {
  if (LOW_END || !group) return Promise.resolve(false);
  return ready().then(() => {
    const e = lookup(kind, key);
    if (!e) { state.misses++; return false; }
    if (group.userData.asset === e.file) return false;   // 同一个门被反复 build 时不重复换
    return fitted(e).then((scene) => {
      if (!scene) {
        // 超时：这次先保持程序化，但登记下来，等真正到货后补换（见 drainLate）
        lateSwap.push({ group, entry: e, opts });
        return false;
      }
      swap(group, scene, e, opts);
      return true;
    });
  }).catch(() => false);
}

// 预热：进城/换关前把本城要用的资产拉进缓存（不阻塞、失败静默）
export function preload(kind, keys = []) {
  return ready().then(() => {
    for (const k of keys) { const e = lookup(kind, k); if (e) load(e); }
  }).catch(() => {});
}

// 自检/自动化测试用：命中数、失败清单、未就绪态（scripts/test-fallback.mjs 断言回退是否生效）
export function stats() {
  return { ...state, failed: state.failed.slice(), manifest: !!manifest };
}
