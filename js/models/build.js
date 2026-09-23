// 词宠工厂调度：PETS 手工表优先，否则按 AUTO_SPECS 走参数化模板；附缩略图渲染
//
// 缩略图（本轮升级，用户反馈"画面要清晰精致"）：
//   · 128 → **384**（实际渲染分辨率，卡片显示 ~128 CSS px → 3 倍密度，高分屏也清晰）
//   · 打光从"半球光 + 单方向光"改成**三点光**（key/fill/rim）+ 环境反射 → 有立体感、不再平
//   · 脚下加**接触阴影**（复用 js/shadow.js 的贴图）→ 角色"落在地面上"
//   · 缓存从"无限增长的普通对象"改成 **LRU 60 张**：932 个词宠全渲 ≈ 140MB，
//     这是本轮顺手修的隐患（游玩时间越长越卡）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { G, sph } from './kit.js';
import { PETS } from './pets-shapes.js';
import { AUTO_TEMPLATES } from './auto-templates.js';
import { buildPlayer } from './player.js';
import { contactShadow } from '../shadow.js';

// ---- 调度器 ----
let AUTO_SPECS_MAP = null;
export function setAutoSpecs(map) { AUTO_SPECS_MAP = map; }

// ================= 词宠工厂 =================
export function buildPet(petId) {
  const b = PETS[petId];
  if (b) return b();
  const spec = AUTO_SPECS_MAP && AUTO_SPECS_MAP[petId];
  if (spec) {
    const [tpl, kind, arg] = String(spec).split(':');
    const fn = AUTO_TEMPLATES[tpl];
    if (fn) return fn(kind, arg);
  }
  const g = G();
  sph(g, 0.15, '#CCCCCC', 0, 0.15, 0);
  return g;
}

// ================= 缩略图基建（词宠 + 主角共用） =================
const THUMB_SIZE = 384;      // 实际渲染分辨率（原 128 太糊）
const THUMB_MAX = 60;        // LRU 上限：932 张 × ~150KB ≈ 140MB，必须限量

let thumbRenderer = null;
let thumbEnv = null;
const thumbCache = new Map();   // key → dataURL（Map 的插入序即 LRU 序）

function ensureThumbRenderer() {
  if (thumbRenderer) return;
  thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
  thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
  thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  thumbRenderer.toneMappingExposure = 1.0;
  // 环境反射（塑料感）：一次性生成，与游戏内同一套观感
  try {
    const pmrem = new THREE.PMREMGenerator(thumbRenderer);
    thumbEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (e) { thumbEnv = null; }
}

function lruGet(key) {
  const v = thumbCache.get(key);
  if (v !== undefined) { thumbCache.delete(key); thumbCache.set(key, v); }   // 命中即刷新
  return v;
}

function lruSet(key, val) {
  thumbCache.delete(key);
  thumbCache.set(key, val);
  while (thumbCache.size > THUMB_MAX) thumbCache.delete(thumbCache.keys().next().value);
}

// 三点光 + 环境：key 定形、fill 提亮暗部、rim 从背后勾边（把角色从背景里拉出来）
//
// 主角（player=true）用**收敛过的**三点光：key 2.6→2.2、rim 1.7→1.35、fill 0.95→1.15。
// 原因：用户要求"缩略图与游戏内两边向中间靠"——游戏内只有 hemi 0.62 + sun 1.35（外加雾、
// 远机位），缩略图却是"影棚感"（强 key + 强 rim），同一套模型两边看着像两个人。
// 词宠缩略图**不动**（用户明确只做强主角）。
const LIGHT_DIR = { key: [2.2, 4.2, 3.0], fill: [-3.0, 1.8, 2.2], rim: [-1.2, 3.2, -4.0] };
function litScene(player) {
  const scene = new THREE.Scene();
  if (thumbEnv) scene.environment = thumbEnv;
  scene.add(new THREE.AmbientLight(0xF5F1EA, player ? 0.62 : 0.55));
  const c = player ? { key: 2.2, fill: 1.15, rim: 1.35 } : { key: 2.6, fill: 0.95, rim: 1.7 };
  const key = new THREE.DirectionalLight(0xFFF2DC, c.key);
  key.position.set(...LIGHT_DIR.key);
  const fill = new THREE.DirectionalLight(0xDCE8FF, c.fill);
  fill.position.set(...LIGHT_DIR.fill);
  const rim = new THREE.DirectionalLight(0xFFFFFF, c.rim);
  rim.position.set(...LIGHT_DIR.rim);
  scene.add(key, fill, rim);
  return scene;
}

// 脚下接触阴影：让角色"落在地面上"（贴片用独立材质，避免与游戏内共享材质的透明度互相干扰）
function addGroundShadow(scene, center, radius, y, soft) {
  const m = contactShadow(radius);
  m.material = m.material.clone();
  m.material.opacity = soft ? 0.5 : 0.75;      // 主角的接触阴影淡一点，别像悬空贴片
  m.position.set(center.x, y + 0.005, center.z);
  m.scale.setScalar(radius * 2);
  scene.add(m);
}

// 把物体摆进画面并渲染成 dataURL：正面/斜前机位、全身入画、留边 8%
function renderThumb(obj, key, opts = {}) {
  ensureThumbRenderer();
  const scene = litScene(!!opts.player);
  scene.add(obj);
  const bb = new THREE.Box3().setFromObject(obj);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  addGroundShadow(scene, center, maxDim * (opts.player ? 0.46 : 0.52), bb.min.y, !!opts.player);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.01, 40);
  const back = opts.back ? -1 : 1;                       // 主角从正面拍（他朝 +z）
  // 主角机位略"正"一点（偏航 0.7→0.62、俯角 0.42→0.34 倍），向游戏内的正视角靠；
  // 词宠沿用原机位（它们的正面/侧面辨识度依赖这个角度）
  cam.position.set(center.x + maxDim * (opts.player ? 0.62 : 0.7),
    center.y + maxDim * (opts.player ? 0.20 : 0.42),
    center.z + back * maxDim * (opts.player ? 1.6 : 1.5));
  cam.lookAt(center.x, center.y - maxDim * 0.03, center.z);
  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  lruSet(key, url);
  return url;
}

export function petThumbnail(petId) {
  const hit = lruGet(petId);
  if (hit !== undefined) return hit;
  return renderThumb(buildPet(petId), petId, { back: true });
}

// 主角缩略图（角色选择卡用）：键 = 性别 + 装扮（装扮变了要重渲）
export function playerThumbnail(gender, wear) {
  const key = `player:${gender}:${JSON.stringify(wear || {})}`;
  const hit = lruGet(key);
  if (hit !== undefined) return hit;
  const built = buildPlayer(gender, wear || {});
  const g = built && built.group ? built.group : built;
  return renderThumb(g, key, { back: false, player: true });
}

// 供自检/测试读取缓存规模（scripts/verify-thumb.mjs 用）
export function thumbCacheSize() { return thumbCache.size; }
export const THUMB_PX = THUMB_SIZE;
