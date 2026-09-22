// 游戏主逻辑：玩家控制、交互、孵化、召唤解谜、喂养复习
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { WORD_MAP, ZONE_NAMES, allWordsForSem, chaptersFor, islandsForSem, BOOK_LABEL, makeSeedRand, shuffleSeed } from './words.js';
import { buildPet } from './models.js';
// 玩家部件 GLB 的变体名：与 scripts/extract-prims.mjs 的 tag 规则一致
// （性别 + 帽子 + 气球 + 魔杖 → boy / boy-flower / boy-balloon-wand …）
function playerVariantTag(gender, wear) {
  return [gender, wear.hat || '', wear.balloon ? 'balloon' : '', wear.wand ? 'wand' : '']
    .filter(Boolean).join('-');
}

// 按部件定 key（必须与 scripts/extract-prims.mjs 的 partKeyOf 完全一致）：
//   帽子只影响 head、气球/魔杖只影响 armL/armR/rest —— 这样烘的资产从 312 个降到 34 个
function playerPartKey(gender, wear, part) {
  const hat = wear.hat || 'none';
  const bw = (wear.balloon ? 'b' : '-') + (wear.wand ? 'w' : '-');
  if (part === 'head') return `p-${gender}-${hat}-head`;
  if (part === 'legL' || part === 'legR' || part === 'body') return `p-${gender}-${part}`;
  return `p-${gender}-${bw}-${part}`;
}
import * as assets from './assets.js';
import { contactShadow, updateContactShadow } from './shadow.js';   // 脚下接触阴影（见该文件注释）   // 词宠 GLB 换装（见 _refreshRanchPets）
import { CITY_MAP, CITIES, cityRoute, cityVariant, getCityQuiz, DECO_EMOJI, ensureCityData, bonusCities } from './cities.js';
import { CITY_GEO } from './city-shape-data.js';
import { getCityShape, clampPoly, polyNearest, polyInside } from './city-shape.js';
import { NPCManager } from './npcs.js';
import { cityLandmark, cityLayout } from './world.js';
import { t } from './i18n.js';
import { buildWorld } from './world.js';
import { buildPlayer, letterTexture, petThumbnail, playerThumbnail, speechBubbleTexture, PROPS } from './models.js';
import { EggManager, PetManager } from './pets.js';
import * as save from './save.js';
import * as ui from './ui.js';
import { startListening, stopListening, matchAlt, voiceSupported, isVoiceBroken, markVoiceBroken } from './speech.js';
import { speak, sfx, stopSpeaking, setBgmMood, setBgmCity, isSpeaking } from './audio.js';
import { ensureWhisper, recognizeBlob, preloadWhisper, loadPercent } from './whisper.js';
import { buildChinaMap } from './china-map.js';
import { CURRICULUM } from './curriculum.js';

const PLAYER_SPEED = 3.65;  // 移速同步城市缩 1/2（7.3 的一半），穿城节奏不变
const CITY_SCALE = 0.84;   // 城市地图尺度倍率（×5 后缩 1/3≈1.67，再按反馈缩 1/2）
// 环境（PMREM RoomEnvironment）的调暗系数：影棚灯阵原强度 17~100，直接挂上去等于给全场景加了一层
// 中性顶光——浅色马卡龙表面被抬白、绿被压成灰绿，这就是"地图发白"的核心来源之一。
// 0.10 是实测值：草地亮度/饱和度两个指标同时落进目标区间（scripts/check-render.mjs）
const ENV_ROOM_DIM = 0.10;
// 情景单词点：词与场景实物绑定记忆（走近弹气泡并念一遍；只启用词库里真实存在的词）
const SCENE_WORDS = [
  { x: -20, z: -14, en: 'apple', emoji: '🍎' },
  { x: 13, z: -9, en: 'wind', emoji: '🌬️' },
  { x: 22, z: 16, en: 'barn', emoji: '🏚️' },
  { x: -24, z: 24, en: 'flower', emoji: '🌸' },
  { x: 8, z: 42, en: 'shell', emoji: '🐚' },
  { x: -6, z: 12, en: 'duck', emoji: '🦆' },
].filter(s => WORD_MAP[s.en]);
// 麦克风采集参数：回声消除 + 噪声抑制 + 自动增益 + 单声道。
// 微信 WebView / 部分安卓默认不开这些处理，不显式要的话录音噪声大、识别明显不准
const AUDIO_CONSTRAINTS = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
};
const ISLE_CENTER = { x: -22, z: 27 };
const CLIMB_TOP = { x: -22, z: 24.2, y: 14 };
const CLIMB_BOTTOM = { x: -22, z: 28.6, y: 0 };
const WORLD_R = 50.6;   // 岛屿可玩半径（岛边是大海）

// 柔和圆形贴图（尘土等小特效共用）
let _softTex = null;
function softTexture() {
  if (_softTex) return _softTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,253,246,0.95)');
  g.addColorStop(1, 'rgba(255,253,246,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  _softTex = new THREE.CanvasTexture(cv);
  return _softTex;
}

// 区域范围（世界坐标），用于地图与探索提示
const ZONE_RECTS = [
  { key: 'orchard',  name: t('x.g224'), x1: -34, z1: -30, x2: -5,  z2: -5 },
  { key: 'windmill', name: t('x.g225'),   x1: 8,   z1: -30, x2: 34,  z2: -7 },
  { key: 'barnyard', name: t('x.g226'), x1: 14,  z1: 8,   x2: 34,  z2: 30 },
  { key: 'garden',   name: t('x.g227'), x1: -34, z1: 10,  x2: -13, z2: 34 },
  { key: 'meadow',   name: t('x.g228'), x1: -18, z1: 5,   x2: 14,  z2: 34 },
  { key: 'beach',    name: t('x.g229'), x1: -32, z1: 36,  x2: 32,  z2: 50 },
  { key: 'forest',   name: t('x.g230'), x1: -52, z1: -18, x2: -37, z2: 24 },
];
const SKY_RECT = { key: 'sky', name: t('x.g231'), x1: -28, z1: 21, x2: -16, z2: 33 };

// 许愿井商店货架
const SHOP_ITEMS = [
  { id: 'hat-wizard', type: 'hat', value: 'wizard', emoji: '🎩', name: t('x.g232'), desc: t('x.g233'), price: 30 },
  { id: 'hat-flower', type: 'hat', value: 'flower', emoji: '👑', name: t('x.g234'), desc: t('x.g235'), price: 30 },
  { id: 'balloon', type: 'balloon', emoji: '🎈', name: t('x.g236'), desc: t('x.g237'), price: 40 },
  { id: 'wand', type: 'wand', emoji: '🪄', name: t('x.g238'), desc: t('x.g239'), price: 50 },
  // 称号：排行榜名字旁亮金字（星星的新消耗口）
  { id: 'title-explorer', type: 'title', value: 'explorer', emoji: '🧭', name: t('x.g240'), desc: t('x.g241'), price: 20 },
  { id: 'title-star', type: 'title', value: 'star', emoji: '🌟', name: t('x.g242'), desc: t('x.g243'), price: 35 },
  { id: 'title-legend', type: 'title', value: 'legend', emoji: '🏆', name: t('x.g244'), desc: t('x.g245'), price: 60 },,
  { type: 'hat', value: 'helmet', emoji: '🏎️', name: t('shop.helmet'), price: 12 },
  { type: 'hat', value: 'crown', emoji: '👑', name: t('shop.crown'), price: 20 },
  { type: 'hat', value: 'chef', emoji: '👨‍🍳', name: t('shop.chef'), price: 12 },
];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.tweens = [];
    this.fx = [];
    this.clock = new THREE.Clock();
    // 本册范围：当前选了哪一册，就只关心那一册（序章农场 + 本册课本词/岛）
    this.sem = save.getBookSem() || '3a';
    this.scopeWords = allWordsForSem(this.sem);
    this.chapters = chaptersFor(this.sem, save.getUsername());   // 动态组关：seed=昵称+册，跨会话一致
    // 城市巡游：海岛替换为城市舞台（路线=家乡→随机→北京，seed=昵称+册 固定可续）
    this.cityTour = true;
    this.homeCity = save.getHomeCity();
    // 巡游模式没有机关谜题：今日任务轮到 gate1 就地换成跟读任务，避免死任务
    if (save.getDaily().id === 'gate1') save.swapDaily('read2');
    const route = cityRoute(this.homeCity, this.sem, this.chapters.length, save.getUsername());
    this.cityRouteList = route;
    this.islands = route.map((cid, i) => {
      const c = CITY_MAP[cid];
      const lv = c.level || {};
      const a = (i / route.length) * Math.PI * 2 + 0.35;
      const dist = 640 + (i % 3) * 80;                     // 岛间距：环上相邻城弦长必须 ≥ 两城半径和（r≈80×2），否则精建邻岛会与当前城重叠
      const v0 = cityVariant(c, 0);
      const rr = Math.round((lv.radius || 28) * (3 + Math.min(1.3, ((c.unis||[]).length + (c.foods||[]).length + (c.scenes||[]).length) * 0.012)) * CITY_SCALE);   // 大地图：×5 尺度，牌子/街道真正铺开
      const shape = getCityShape(cid, lv.shape).map(([sx, sz]) => [sx * rr, sz * rr]);   // 局部多边形
      return {
        key: cid, uid: cid + '#' + i, name: c.name, en: c.en, emoji: v0.emoji, color: c.color,
        cx: Math.cos(a) * dist, cz: Math.sin(a) * dist, r: rr,
        shape,
        landmark: c.landmark, decos: c.variants.map(v => DECO_EMOJI[v.deco] || '🏮'),
        startChapter: i, unis: c.unis, city: c, level: lv,
        terrain: c.terrain || null,   // 微缩分层地形配置（data/cities/<id>/terrain.json，可选）
        chapterName: c.name,
      };
    });
    // 一关一城：关卡名用城市名（通关卡/横幅显示城市）
    this.chapters.forEach((ch, i) => { if (this.islands[i]) ch.name = this.islands[i].name; });
    this.scopeIds = new Set(this.scopeWords.map(w => w.id));
    this.total = this.scopeIds.size;
    this.riverHintCd = 0;
    this.preferWhisper = false;   // 在线识别连续失败后，改用自带的本地模型
    this.voiceMiss = 0;
    if (typeof window !== 'undefined') window.__game = this;   // 调试/自动化测试钩子
    this._initRenderer();
    this._initScene();
    this._initPlayer();
    this._initEntities();
    this._initInput();
    this._initUI();
  }

  // ================= 本册范围 =================
  // 章节索引：按孵化状态推导——当前关 = 第一关还有词蛋没孵出来的关。
  // 通关唯一条件 = 本关的蛋全部孵化（新单词/短语全部学完）；分数/星星不参与升关。
  // 旧版按「全册已孵数 ÷ 6」折算，本关蛋没孵完也可能数够升关，出现没学会就升级。
  chapterIndex() {
    const n = Math.min(this.chapters.length, this.islands.length);
    for (let i = 0; i < n; i++) {
      if (this.chapters[i].words.some(id => !save.isHatched(id))) return i;
    }
    return n - 1;
  }
  // 本关要抽查小测的词：seed=昵称+册+关号，每关固定 2 个、跨会话一致。
  // 只从本关新词里抽——复习词已孵过、不会再触发孵化，抽到就等于白丢一次小测
  _chapterQuizIds() {
    const ch = this.currentChapter;
    if (this._quizCache && this._quizCache.ch === ch) return this._quizCache.ids;
    const pool = ch.words.filter(id => !ch.review.includes(id));
    const rand = makeSeedRand(save.getUsername() + '|' + this.sem + '|quiz|' + (this._forceChapter ?? this.chapterIndex()));
    const ids = shuffleSeed(pool, rand).slice(0, 2);
    this._quizCache = { ch, ids };
    return ids;
  }
  // 本册已唤醒数量
  hatchedInScope() {
    let n = 0;
    for (const w of this.scopeWords) if (save.isHatched(w.id)) n++;
    return n;
  }
  get currentChapter() { return this.chapters[this._forceChapter ?? this.chapterIndex(this.hatchedInScope())]; }

  // ================= 初始化 =================
  _initRenderer() {
    // 先探测 WebGL 是否可用，给出比"设备跑不起来"更准确的原因
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
      throw new Error(t('x.g247'));
    }
    // 上下文可能因内存不足创建失败（手机后台应用多时常见）：先标准方式，失败后关抗锯齿降级重试
    const create = opts => new THREE.WebGLRenderer({ canvas: this.canvas, ...opts });
    try {
      this.renderer = create({ antialias: true, logarithmicDepthBuffer: true });   // 对数深度：根治拉远后地面与地图纸面 z-fighting
    } catch (e) {
      console.warn(t('x.g248'), e);
      this.renderer = create({ antialias: false, logarithmicDepthBuffer: true });
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 1, 6000);   // FOV 42：主体更大、纵深更强（参考图那种低角度构图）；near 1 提升远距深度精度，远平面 6000 见全国地图
    this.world = buildWorld(this.scene, this.islands, { focus: Math.max(0, this.chapterIndex(this.hatchedInScope())) });   // 只精建当前关±1 的城市，其余轻量占位
    this._ranchPets = [];   // 🐾 词宠乐园：迷你分身（最近孵出的 6 只）
    this.syncRanch();
    // 全国地图背景：其他城市按真实位置平铺（边界+名称），当前城锚定到舞台中心
    if (this.cityTour) {
      if (this.world.anim.sea) this.world.anim.sea.visible = false;   // 外围是地图纸面，藏掉主岛海面（防拉远后蓝方块 z-fighting）
      const names = Object.fromEntries(CITIES.map(c => [c.id, c.name]));
      const st0 = this._currentStage();
      const chIdx = this.chapterIndex(this.hatchedInScope());
      const bonusIds = new Set(bonusCities().map(c => c.id));
      const statuses = {};
      for (const c of CITIES) {
        const ri = this.cityRouteList.indexOf(c.id);
        if (c.id === (st0 && st0.key)) continue;
        else if (ri >= 0 && ri < chIdx) statuses[c.id] = t('x.g249');
        else if (ri >= 0) statuses[c.id] = t('x.g250');
        else if (bonusIds.has(c.id)) statuses[c.id] = t('x.g251');
        else statuses[c.id] = t('x.g252');
      }
      // 邻城地形浮雕配置（各城 terrain.json）：全国地图按同一份高度场出浮雕
      const terrains = {};
      for (const c of CITIES) if (c.terrain) terrains[c.id] = c.terrain;
      this.chinaMap = buildChinaMap(this.scene, st0 && st0.key, names, statuses, this.cityRouteList, terrains);
      if (st0) this.chinaMap.anchor(st0.key, st0.cx, st0.cz);
    }
    // 各向异性过滤按显卡实际上限收口：手机一般只支持 4~8，写死 16 会被驱动忽略导致远景摩尔条纹
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.scene.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (m.map) { m.map.anisotropy = Math.min(16, maxAniso); m.map.needsUpdate = true; }
      }
    });
    // 辉光后期：桌面端开启；触屏设备（内存紧张、容易崩上下文）跳过，直接普通渲染
    const lowEnd = matchMedia('(pointer: coarse)').matches;
    if (!lowEnd) {
      try {
        // MSAA 必须挂在 composer 的离屏 RT 上：renderer 的 antialias 只作用于"渲染到默认帧缓冲"，
        // 走 EffectComposer 时场景先渲进 RT，那一步的 antialias 设置**根本不生效** → 桌面端全屏锯齿
        // （树冠、屋檐、栏杆最明显，越精致的模型越显脏）。r160 支持给 RT 设 samples（WebGL2 多重采样），
        // 这是后期链里拿到 MSAA 的唯一办法；低端/触屏仍走"不进后期"的分支。
        // 采样数可调（?msaa=0|2|4）：headless/软件渲染下 4x 的代价被放大，
        // 真机上便宜得多——用 scripts/look-shot.mjs 的帧时长中位数实测后再定默认值
        // 多重采样在这里是"整帧的代价"：本机 Intel UHD 730 / D3D11 / 1280x760 实测
        // MSAA 2x 与 4x 都把帧时长中位数从 16.7ms 顶到 33.2ms（掉到 30fps），而收益只是抗锯齿。
        // 所以默认 0 采样，抗锯齿交给下面的 SMAAPass（桌面端，几次纹理采样，代价 <1ms）。
        // ?msaa=N 保留为旋钮：大独显上想开多重采样自己开。
        const gl = this.renderer.getContext();
        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const glName = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '') : '';
        const msaaQ = /[?&]msaa=(\d+)/.exec(location.search);
        const msaaN = msaaQ ? Number(msaaQ[1]) : 0;
        this._glName = glName; this._msaaN = msaaN;
        const msaaRT = new THREE.WebGLRenderTarget(
          Math.floor(innerWidth * this.renderer.getPixelRatio()),
          Math.floor(innerHeight * this.renderer.getPixelRatio()),
          { samples: msaaN, type: THREE.HalfFloatType });
        this.composer = new EffectComposer(this.renderer, msaaRT);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // 粘土手办风：辉光收敛（0.32→0.22）——马卡龙配色本身就亮，泛光一强就糊成一片奶油
        // 粘土手办风：辉光只留给"发光物"（词宠蛋/词宠/灯）——强度 0.22→0.10，门槛抬到 0.92
        // 门槛 0.92 → 0.98：threshold 比的是**线性**亮度，白墙/广场/天空在线性空间轻松过 0.92，
        // 于是"开后期"整幅被加了一层辉光——check-render 的 composerDiff（开/关后期亮度差）
        // 一直是 0.19（门槛 0.02），草地饱和也被辉光从 0.42 拉到 0.26。抬到 0.98 后只有
        // 真正的发光物（蛋/词宠 emissive/灯）越过门槛，辉光回到"点缀"而不是"滤镜"。
        this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.10, 0.45, 0.98);
        this.composer.addPass(this.bloom);
        // SMAA：后期链里的抗锯齿（MSAA 在 iGPU 上太贵，见上）。
        // 放在 OutputPass 之前，这样它处理的是已经合成好的线性画面。
        this.composer.addPass(new SMAAPass(innerWidth * this.renderer.getPixelRatio(), innerHeight * this.renderer.getPixelRatio()));
        // OutputPass 必须是最后一层：r160 的色调映射与色域转换只在"渲染到画布"时生效
        // （WebGLPrograms.getParameters：currentRenderTarget !== null 时 toneMapping=NoToneMapping、
        //  outputColorSpace=LinearSRGBColorSpace），RenderPass 写进 RT 的是未 tonemap 的线性值。
        // 少了它，UnrealBloomPass 末尾会把**未编码的线性辉光**直接加在已经编码过的底图上
        // （它自己用 MeshBasicMaterial 重绘底图那一步会被 tonemap+编码，辉光那一步不会），
        // 结果辉光强度远大于配置值、与底图不同色彩空间 = 一片白雾；低端机 _fpsWatch 关掉后期后又突变。
        // 加回 OutputPass：辉光在线性空间合成，最后统一 ACES + sRGB 输出，开/关后期颜色一致。
        this.composer.addPass(new OutputPass());
      } catch (e) { this.composer = null; }
    }
    // 环境反射：桌面端挂一层极轻的室内环境（PMREM），粘土材质才有"软塑反光"而不是死哑光。
    // 走 scene.environment，程序化材质与烘焙 GLB 一起受益——不会出现"两种质感并存的缝合怪"。
    // 触屏跳过：PMREM 要额外渲染与显存，与 Bloom 同一个 lowEnd 判据（方案 §4.5）。
    if (!lowEnd) {
      try {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        // RoomEnvironment 是"影棚灯阵"：自发光面片强度 17~100，原样挂上去会通过 IBL 给所有哑光面补一大笔
        // 中性光——地面被抬白、绿色被压成灰绿（实测：环境全强度时草地饱和 0.22，关掉后 0.31）。
        // 正确做法是从**源头**调暗（面片材质是 MeshBasicMaterial，乘 color 即可）：游戏进行中才建出来的
        // 词宠/蛋/NPC 也一起吃这个亮度，不会出现"老资产暗、新资产亮"的缝合怪。
        // 另注：r160 还没有 scene.environmentIntensity（r163 才加），写那行等于没写。
        const room = new RoomEnvironment();
        const roomMats = new Set();
        room.traverse((o) => { if (o.isMesh && o.material && o.material.color) roomMats.add(o.material); });
        for (const m of roomMats) m.color.multiplyScalar(ENV_ROOM_DIM);
        this.envTex = pmrem.fromScene(room, 0.04).texture;
        room.dispose();
        this.scene.environment = this.envTex;   // 环境反射：粘土材质的"软塑感"来源（此前被一行 DEBUG 关掉）
    // 环境亮度就走 ENV_ROOM_DIM（game.js 顶部的常量），不用 scene.environmentIntensity：r160 没这个属性
        pmrem.dispose();
      } catch (e) { this.scene.environment = null; }
    }
    // 默认机位按参考图定：俯角 0.42→0.30、距离 8.5→6.6 —— 低角度、主体大、纵深强；
    // 缩放范围（2.8~550）与双击拉远一律保留，孩子随时能拉远看全景
    this.camYaw = 0; this.camPitch = 0.30; this.camDist = 6.6; this.camDistTarget = 6.6;
    this._camHold = 0;        // 孩子刚拖过镜头 → 暂停自动跟随的剩余秒数（见 _updatePlayer）   // 缩放目标值：滚轮/键盘改它，每帧平滑趋近
    this.gateTries = {};   // 每个机关猜错的次数（一次答对有星星奖励）
    this.lockInput = false;   // 通关卡/演出期间锁操作
    this.cinematic = false;   // 镜头动画接管中（不再按轨道公式覆盖机位）
    this._initGuide();
  }

  // 进城出生点：城心主地标正南侧两步半，面朝地标——落地第一眼就是这座城市名片
  _citySpawnPos(st) {
    const p = { x: st.cx, z: st.cz + 2.6 };
    this._clampCityPos(p, st);
    return p;
  }

  _initPlayer() {
    const p = buildPlayer(save.getGender(), save.getWear());
    // 玩家部件换装：只换每个部件的 children —— 动画驱动的是 legL/legR/armL/armR/head 这些
    // Group 引用（js/game.js 的 playerParts.*），Group 自身的 transform 与引用必须保留。
    // rest 指"不在 parts 里的散件"（花帽、魔杖星），用 additive 追加到外层 group。
    assets.applyParts(p.group, p.parts, 'player',
      (name) => playerPartKey(save.getGender(), save.getWear(), name), { rest: true });
    this.player = p.group;
    this.playerParts = p.parts;
    this.player.rotation.y = Math.PI; // 面朝北（河流方向）
    // 恢复上次的位置与朝向（存档续玩）；城市巡游模式固定出生在当前城市舞台
    const sp = save.getPlayer();
    if (this.cityTour) {
      const st = this._currentStage();
      const sp0 = this._citySpawnPos(st);
      this.player.position.set(sp0.x, 0, sp0.z);
      this._collide();   // 出生点若与牌子/校门碰撞体重叠，立即推出来（防进入就晃动）
    } else if (sp && typeof sp.x === 'number') {
      this.player.position.set(sp.x, sp.y || 0, sp.z);
      this.player.rotation.y = sp.yaw || Math.PI;
      this.camYaw = sp.camYaw || 0;
      this.onIsle = !!sp.isle;
      if (this.onIsle) this.player.position.y = 14;
    } else {
      this.player.position.set(0, 0, 14);
    }
    // 换了册：上次站的岛可能不属于本册了，落回阳光农场出生点，别悬在大海上
    const p0 = this.player.position;
    if (Math.hypot(p0.x, p0.z) > WORLD_R + 0.5 && !this._islandAt(p0)) {
      p0.set(0, 0, 14);
      this.onIsle = false;
    }
    this.scene.add(this.player);
    this.climbing = false;
    this.walkT = 0;
    this._breatheT = 0;   // 待机呼吸的独立相位（与 walkT 解耦，见 _updateMovement）
    this.lastZone = null;
    this.dustT = 0;       // 跑步尘土计时
    this.sparkT = 0;      // 魔法棒星星计时
  }

  // 向导箭头：漂浮在头顶，指向当前目标
  _initGuide() {
    const g = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: 0xFFB93C });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8), gold);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.x = -0.32;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 8), gold);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.2;
    g.add(shaft, head);
    g.visible = false;
    this.scene.add(g);
    this.guideArrow = g;
    // 发光小径：一串脉动光点从脚下铺向目标，方位一目了然（3D 地图游戏标配）
    const dots = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softTexture(), color: 0xFFC4DC, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      s.scale.setScalar(0.26);
      dots.add(s);
      this.pathDots = this.pathDots || [];
      this.pathDots.push(s);
    }
    dots.visible = false;
    this.scene.add(dots);
    this.pathDotsGroup = dots;
  }

  _initEntities() {
    this.eggs = new EggManager(this.scene);
    this.pets = new PetManager(this.scene, (x, z) => this._groundY(x, z));
    if (this.cityTour) this._initCityNPCs();   // 城市牌子先立好，蛋才有t('x.g253')可依
    this._spawnProgress();
    this.planted = save.hasGate('planted');
    this._refreshHungry();
    // NPC：猫头鹰园丁，站在任务板旁的木桩上管每日任务链（纯城市链条模式由城市 NPC 系统接管）
    if (!this.cityTour) {
      const owl = PROPS.owl();
      owl.position.set(-6.1, 0, 19.1);
      this.scene.add(owl);
      this.world.anim.owl = owl;
      this.world.colliders.push({ t: 'c', x: -6.1, z: 19.1, r: 0.55 });
    }
    // 续玩时按当前关卡恢复区域主题换装（通关演出时也会实时布置）
    const curIdx = this.chapterIndex(this.hatchedInScope());
    if (curIdx >= 0) this._dressChapter(curIdx);
  }

  // 城市NPC配角：游客/小贩/学生…走近打招呼，偶尔讲卫生安全/世界之谜小知识（问题+自答）
  _initCityNPCs() {
    this._buildSigns(this._currentStage());
    this.npcs = new NPCManager(this.scene);
    this.npcs.spawnForCity(this._currentStage(), (q, st) => this._clampCityPos(q, st), this.world.colliders, (x, z) => this._groundY(x, z));
    // NPC 复习考官：错词本里有没抓回的淘气词时，NPC 随机请孩子读词卡（被需要感里的错词复习）
    this.npcs.onReview = npc => this._npcReview(npc);
    import('./data.js').then(m => m.loadJson('knowledge.json')).then(k => {
      if (!k || !this.npcs) return;
      this.npcs.setKnowledge([...(k.hygiene || []), ...(k.world || [])]);
    }).catch(() => {});
  }

  // 关卡制出蛋：已孵化的变词宠；蛋只出"当前关卡的 6 个"（粉光柱）+ 剧情还没用掉的钥匙词蛋（蓝光柱带 🔑，不算本关进度）
  _spawnProgress() {
    const cur = new Set(this.currentChapter.words);
    const perchId = this._perchEggId();
    const brickId = this._brickEggId(perchId);
    for (const w of this.scopeWords) {
      if (save.isHatched(w.id)) {
        let pet = this.pets.get(w.id);
        if (!pet) {
          pet = this.pets.spawn(w, this._cityPos(w));
          pet.group.userData.wordId = w.id;
          const pd = save.getSave().pets[w.id];
          if (pd && pd.evo) this._applyEvolved(pet);
          if (pd && pd.rare) this._applyRare(pet);
        }
        continue;
      }
      if (this.eggs.get(w.id)) continue;
      if (cur.has(w.id)) {
        if (brickId === w.id) continue;   // 这颗蛋藏进了悬浮砖块，顶爆才掉出来
        const pos0 = this._cityPos(w);
        const spot0 = this._freeEggSpot(pos0.x, pos0.z);   // 统一分配：不与已放蛋重叠
        // y 必须显式算：spawnEgg 里 posOverride.y || 0，只传 {x,z} 会让天空蛋落进石台柱子里、
        // 普通蛋落在 y=0（有地形的城市直接被山坡埋掉——这正是"看不到的蛋"的另一半原因）。
        const y0 = this._groundY(spot0.x, spot0.z) + (w.zone === 'sky' ? 3.45 : 0);
        const egg = this.eggs.spawnEgg(w, w.zone === 'sky', false, this.currentChapter.words.indexOf(w.id) + 1, { x: spot0.x, z: spot0.z, y: y0 });
        egg.group.userData.wordId = w.id;
        egg.baseY = y0;
        // 本关有一颗蛋放上跳跳石高台：要跳上去才够得着，加点小挑战
        if (perchId === w.id) this._putEggOnPerch(egg);
        else if (this.cityTour && this._signEggSpots && this._signEggSpots.length && w.zone !== 'sky') {
          // 一部分蛋按 seed 放到牌子旁边：找牌子=找蛋，探索感更强。
          // 落点统一走 _freeEggSpot：牌旁点常被钳到同一处，不分配就会多颗蛋叠在一起。
          const st = this._currentStage();
          const spots = this._signEggSpots;
          let si = this._hashStr(this.sem + ':' + st.key + ':' + w.id) % spots.length;
          const spot = this._freeEggSpot(spots[si].x, spots[si].z);
          const gy1 = this._groundY(spot.x, spot.z);   // 微缩地形：蛋贴山坡
          egg.group.position.set(spot.x, gy1, spot.z);
          egg.baseY = gy1;
        }
      } else if (!this.cityTour && this._pendingGateWord(w.id)) {
        if (this.cityTour) {
          // 纯城市链条：没有农场机关，剧情词蛋按普通粉蛋处理（保证本关可完成）
          const gp = this._eggSpot(this._cityPos(w).x, this._cityPos(w).z);
          const egg = this.eggs.spawnEgg(w, false, false, this.currentChapter.words.indexOf(w.id) + 1, gp);
          egg.group.userData.wordId = w.id;
        } else {
          const pos = this._cityPos(w);
          const egg = this.eggs.spawnEgg(w, w.zone === 'sky', true, null, pos);
          egg.group.userData.wordId = w.id;
          (this._cityGatePos = this._cityGatePos || {})[w.id] = { x: pos.x, z: pos.z };
        }
      }
    }
  }

  // 本关放上高台的蛋：剧情钥匙蛋和天空岛的蛋不动，剩下的按关卡序号轮换一颗
  _perchEggId() {
    if (!this.world.perch) return null;
    const GATES = ['boat', 'light', 'wind', 'seed', 'rain'];
    const ids = this.currentChapter.words.filter(id => !GATES.includes(id) && WORD_MAP[id].zone !== 'sky');
    return ids.length ? ids[this.chapterIndex(this.hatchedInScope()) % ids.length] : null;
  }

  // 本关藏进悬浮砖块的蛋：非钥匙/天空/高台蛋，按关卡序号轮换；换关时砖块重置
  _brickEggId(perchId = null) {
    // 城市巡游现在也有悬浮砖块（见 world.js 的城市跳跃挑战②），所以不再排除 cityTour；
    // 只排除"确实没有砖块"的情况（农场模式未建或旧存档）
    if (!this.world.brickSpots || !this.world.brickSpots.length) return null;
    const pid = perchId ?? this._perchEggId();
    const GATES = ['boat', 'light', 'wind', 'seed', 'rain', 'banana'];
    const ids = this.currentChapter.words.filter(id => !GATES.includes(id) && id !== pid && WORD_MAP[id].zone !== 'sky');
    if (!ids.length) return null;
    const id = ids[this.chapterIndex(this.hatchedInScope()) % ids.length];
    // 城市巡游只有 1 块城市砖块，其余是农场的 → 城市模式下限定在"属于本城"的那块
    const pool = this.cityTour
      ? this.world.brickSpots.filter((b) => b.city === this._currentStage().key)
      : this.world.brickSpots;
    if (!pool.length) return null;
    const brick = pool[this.chapterIndex(this.hatchedInScope()) % pool.length];
    if (brick.eggId !== id) {
      brick.eggId = id;
      brick.used = false;
      if (brick.mesh) brick.mesh.material.color.set('#E8B04B');
      if (brick.q) brick.q.visible = true;
    }
    return id;
  }

  _putEggOnPerch(egg) {
    if (this.cityTour) {   // 城市巡游：高台蛋放城市舞台的观景石台上
      const st = this._currentStage();
      // 石台位与 world.js 同参（perchA/perchD），台面高度由 world.js 注册进 platforms（= 地形 + 3.45）。
      // 蛋必须站在真实台面上：写死 3.2 在有地形的城市会悬空或被山坡埋掉（"看不到的蛋"）。
      const lay = cityLayout(st.key);
      const want = { x: st.cx + Math.cos(lay.perchA) * st.r * lay.perchD, z: st.cz + Math.sin(lay.perchA) * st.r * lay.perchD };
      let pf = null, best = Infinity;
      for (const p of this.world.platforms || []) {
        const d = Math.hypot(p.x - want.x, p.z - want.z);
        if (d < best) { best = d; pf = p; }
      }
      const onTop = pf && best < st.r * 0.3;
      const q = onTop ? { x: pf.x, z: pf.z } : want;
      const m = this._cityWallMargin(st, 1.2);
      this._clampCityPos(q, st, m, m);
      const top = onTop ? pf.top : this._groundY(q.x, q.z) + 3.45;
      egg.baseY = top;
      egg.group.position.set(q.x, top, q.z);
      return;
    }
    const pf = this.world.perch;
    egg.baseY = pf.top;
    egg.group.position.set(pf.x, pf.top, pf.z);
  }

  // 钥匙词蛋：只要对应机关还没触发就一直留在场上，保证剧情卡不死
  _pendingGateWord(id) {
    switch (id) {
      case 'boat': return !save.hasGate('boat');
      case 'light': return !save.hasGate('light');
      case 'wind': return !save.hasGate('wind');
      case 'seed': return !save.hasGate('planted');
      case 'rain': return save.hasGate('planted') && !save.hasGate('beanstalk');
      case 'banana': return !save.hasGate('vines');   // 荆棘门的谜底：不补这颗蛋，森林就是死局
      default: return false;
    }
  }

  _initInput() {
    this.joy = { x: 0, y: 0, active: false };
    this.sprinting = false; this._sprintUntil = 0;
    // 终端判断：手机/平板走触屏 UI，电脑（含触屏笔记本）走键盘鼠标
    // ?touch=1 / ?touch=0 可强制指定
    const q = /[?&]touch=(1|0)/.exec(location.search);
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
    const coarse = matchMedia('(pointer: coarse)').matches;
    const desktopLike = matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.isTouch = q ? q[1] === '1' : (uaMobile || (coarse && !desktopLike));
    this.vy = 0;            // 跳跃垂直速度
    this.jumps = 0;         // 本跳是第几跳（最多 2，落地清零）
    this.onGround = true;
    this.riding = false;    // 正在坐船过河
    this.moveTarget = null; // 点击移动目标
    // 点击移动的落点标记（金色小光环）
    this.moveMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.32, 24),
      new THREE.MeshBasicMaterial({ color: 0xFFC94E, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.moveMarker.rotation.x = -Math.PI / 2;
    this.moveMarker.visible = false;
    this.scene.add(this.moveMarker);

    addEventListener('keydown', e => {
      if (e.repeat || this.lockInput) return;
      this.keys.add(e.code);
      if (/^Key[WASD]$|^Arrow/.test(e.code)) this._clearMoveTarget(); // 手动方向一按，自动走路让位
      if (e.code === 'KeyE') this._interact();
      // 键盘缩放视角：+/= 拉近，-/_ 拉远（与滚轮同款比例步长，近距离也好微调）
      if (e.code === 'Equal' || e.code === 'NumpadAdd') this.camDistTarget = THREE.MathUtils.clamp(this.camDistTarget * 0.88, 2.8, 550);
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.camDistTarget = THREE.MathUtils.clamp(this.camDistTarget * 1.14, 2.8, 550);
      if (e.code === 'Tab') { e.preventDefault(); this._openSummon(); }
      if (e.code === 'Space') {
        e.preventDefault();
        this._jump();
      }
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('resize', () => this.onResize());

    // ---- 触屏：单指拖动=转视角，双指=缩放，轻点=交互；摇杆是独立元素 ----
    this.touchCam = new Map();      // pointerId -> {x, y}
    this.tapInfo = null;            // 轻点检测
    this.pinchDist = 0;

    let dragging = false, lx = 0, ly = 0;
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointerdown', e => {
      if (this.lockInput) return;   // 通关卡/演出期间不响应世界交互
      if (e.pointerType === 'touch') { // eslint-disable-line
        this.touchCam.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.touchCam.size === 2) {
          const [a, b] = [...this.touchCam.values()];
          this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        }
        this.tapInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
      } else if (e.button === 2) { e.preventDefault(); dragging = true; lx = e.clientX; ly = e.clientY; }
      else if (e.button === 0) { this._click(e); }   // 点一下走一步（不再按住持续跟随）
    });
    addEventListener('pointermove', e => {
      if (dragging) {
        this.camYaw -= (e.clientX - lx) * 0.006;
        this._camHold = 1.2;   // 孩子想自己看：暂停自动跟随 1.2 秒
        this._moveBasisYaw = this.camYaw;   // 拖拽=转向：把移动基准重新对齐到新朝向   // 孩子想自己看：暂停自动跟随 1.2 秒
        this.camPitch = THREE.MathUtils.clamp(this.camPitch + (e.clientY - ly) * 0.004, 0.08, 1.1);
        lx = e.clientX; ly = e.clientY;
        return;
      }
      if (this.touchCam.has(e.pointerId)) {
        const p = this.touchCam.get(e.pointerId);
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (this.touchCam.size === 1) {
          this.camYaw -= dx * 0.007;
          this._camHold = 1.2;
          this._moveBasisYaw = this.camYaw;   // 同上：拖拽=转向   // 同上：手指拖过镜头就暂停跟随
          this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.005, 0.08, 1.1);
        }
        p.x = e.clientX; p.y = e.clientY;
        if (this.touchCam.size === 2) {
          const [a, b] = [...this.touchCam.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          // 双指捏合按比例缩放并加 0.5 次幂阻尼：手指挪一厘米不再猛拉一大截
          if (this.pinchDist > 0) this.camDistTarget = THREE.MathUtils.clamp(this.camDistTarget * Math.pow(this.pinchDist / d, 0.5), 2.8, 550);
          this.pinchDist = d;
        }
      }
    });
    const endPointer = e => {
      if (this.touchCam.has(e.pointerId)) {
        this.touchCam.delete(e.pointerId);
        this.pinchDist = 0;
        // 轻点（几乎没移动、时间短）= 点击交互
        if (this.tapInfo && this.touchCam.size === 0) {
          const moved = Math.hypot(e.clientX - this.tapInfo.x, e.clientY - this.tapInfo.y);
          if (moved < 12 && performance.now() - this.tapInfo.t < 350) {
            this._click({ clientX: e.clientX, clientY: e.clientY });
          }
        }
        this.tapInfo = null;
      }
      if (e.pointerType !== 'touch') dragging = false;
    };
    addEventListener('pointerup', endPointer);
    addEventListener('pointercancel', endPointer);
    this.canvas.addEventListener('wheel', e => {
      if (this.lockInput) return;
      // 按比例缩放（每格约 ±11%）：近距离一格只挪一点点，不再一格拉到天上
      this.camDistTarget = THREE.MathUtils.clamp(this.camDistTarget * Math.exp(e.deltaY * 0.0011), 2.8, 550);
    }, { passive: true });

    // ---- 虚拟摇杆 ----
    const joy = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    if (joy && knob) {
      let joyId = null, cx = 0, cy = 0;
      const R = 44;
      const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
      let lastTap = 0;
      joy.addEventListener('pointerdown', e => {
        joyId = e.pointerId;
        try { joy.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        const r = joy.getBoundingClientRect();
        cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        this.joy.active = true;
        // 双击摇杆 = 冲刺 2 秒（触屏没有 Shift 键，双击是最直觉的加速手势）
        const now = Date.now();
        if (now - lastTap < 380) { this.sprinting = true; this._sprintUntil = now + 2000; ui.toast(t('y.sprint'), 1400); sfx.pop(); }
        lastTap = now;
        e.preventDefault();
      });
      joy.addEventListener('pointermove', e => {
        if (e.pointerId !== joyId) return;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = dx / len * R; dy = dy / len * R; }
        setKnob(dx, dy);
        this.joy.x = dx / R; this.joy.y = dy / R;
      });
      const joyEnd = e => {
        if (e.pointerId !== joyId) return;
        joyId = null;
        this.joy.active = false; this.joy.x = 0; this.joy.y = 0;
        setKnob(0, 0);
      };
      joy.addEventListener('pointerup', joyEnd);
      joy.addEventListener('pointercancel', joyEnd);
    }
    if (this.isTouch && joy) {
      joy.classList.remove('hidden');
      document.body.classList.add('touch');
    }
    // 触屏跳跃按钮
    const jumpBtn = document.getElementById('btn-jump');
    if (jumpBtn) {
      if (this.isTouch) jumpBtn.classList.remove('hidden');
      jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); this._jump(); });
    }
  }

  // ================= 跳跃 =================
  // 最多连跳两次：地面起跳算第 1 跳，空中再按一次空格/跳 = 第 2 跳（稍微矮一点），之后只能等落地
  _jump() {
    if (this.climbing || this.riding || this.mount) return;   // 骑乘时不跳（词宠驮着呢）
    if (ui.challengeOpen()) return;
    if (document.querySelector('.overlay:not(.hidden)')) return;  // 弹窗打开时不跳
    const el = document.activeElement;
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    if (this.onGround) {
      this.vy = 8.6;
      this.onGround = false;
      this.jumps = 1;
    } else if ((this.jumps || 0) < 2) {
      this.vy = Math.max(this.vy, 0) * 0.4 + 7.6;   // 空中二段跳：略矮，但能把高度再顶上去一截
      this.jumps = 2;
    } else return;
    sfx.pop();
    // 起跳小蹲
    this.player.scale.set(1.08, 0.9, 1.08);
    this.addTween(0.16, k => {
      const s = 0.9 + k * 0.1 + Math.sin(k * Math.PI) * 0.06;
      this.player.scale.set(1.08 - k * 0.08, s, 1.08 - k * 0.08);
    }, () => this.player.scale.set(1, 1, 1));
  }

  // ================= 点击移动 =================
  _clearMoveTarget() {
    this.moveTarget = null;
    this.moveThenEgg = null;
    this.moveThenInteract = null;
    if (this.moveMarker) this.moveMarker.visible = false;
    this._stuckT = 0;
  }

  // 点了蛋：够得着就直接孵，够不着先走过去（高台蛋还得跳上去），走到近处自动打开
  _approachEgg(id) {
    const egg = this.eggs.get(id);
    if (!egg) return;
    const p = this.player.position, ep = egg.group.position;
    if (Math.hypot(ep.x - p.x, ep.z - p.z) <= 2.4 && ep.y - p.y <= 1.2) {
      this._clearMoveTarget();
      this._openEgg(id);
      return;
    }
    this.moveTarget = { x: ep.x, z: ep.z };
    this.moveThenEgg = id;
    this.moveMarker.position.set(ep.x, ep.y + 0.06, ep.z);
    this.moveMarker.visible = true;
    if (ep.y - p.y > 1.2) ui.toast(t('x.g255'), 3000);
  }

  _setMoveTarget(e) {
    if (this.riding || this.climbing) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const groundY = this.onIsle ? 14 : 0;
    const pt = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY), pt)) return;
    // 钳制范围：城市模式=当前城市岛（此前按世界原点半径 48 钳，城市岛在 80 外，
    // 圈内点击落点必被拉到圈外——这就是"点击圈在圈外"的根因）
    if (this.cityTour) {
      this._clampCityPos(pt);
    } else {
      const dc = Math.hypot(pt.x, pt.z);
      if (dc > 48) { pt.x *= 48 / dc; pt.z *= 48 / dc; }   // 别点到世界外面去
    }
    // 点一下走一步：目标点最远只取距玩家 11 米处（×5 跟随地图放大），走完这步再点下一步（孩子自己探索）
    const pp = this.player.position;
    const ddx = pt.x - pp.x, ddz = pt.z - pp.z;
    const dd = Math.hypot(ddx, ddz);
    const STEP = 1.85;   // 点击移动步长同步城市缩 1/2
    if (dd > STEP) { pt.x = pp.x + ddx / dd * STEP; pt.z = pp.z + ddz / dd * STEP; }
    this.moveTarget = { x: pt.x, z: pt.z };
    this.moveMarker.position.set(pt.x, groundY + 0.06, pt.z);
    this.moveMarker.visible = true;
  }

  _initUI() {
    ui.bindHUD({
      onCharSelect: () => this._openCharSelect(),   // 角色选择卡（菜单 🎭）
      onCatalog: () => this._openCatalog(),
      onHelp: () => {},
      onBook: () => this._openBook(),
      onSummon: () => this._openSummon(),
      onPrompt: () => this._interact(),
      onMap: () => this._openMap(),
      onHungryPill: () => this._guideHungry(),
      onRank: () => ui.showLeaderboard({ username: save.getUsername(), score: save.getScore() }),
      onReport: () => ui.showParentReport(save.getWeeklyReport(), save.getUsername()),
      onAbout: () => ui.showAbout(),
      onAccount: () => ui.showProfile((name, semKey, gender, password, serverScore) => {
        save.setUsername(name);
        save.setPassword(password || '');   // 允许清空/修改密码
        save.setRegistered(true);
        if (serverScore != null) save.syncScore(serverScore);
        save.setBookSem(semKey);
        save.setGender(gender);
        save.resetSessionScore();
        location.reload();
      }, {
        username: save.getUsername(), password: save.getPassword(), registered: save.isRegistered(),
        semKey: save.getBookSem(), gender: save.getGender(), city: save.getHomeCity(),
      }, {
        editing: true,
        onLogout: () => {
          if (confirm(t('x.g257'))) {
            save.resetSave();
            location.reload();
          }
        },
      }),
      onMic: () => this._startVoice(),
      onMicEnd: () => this._stopVoice(),
      isTouch: this.isTouch,
    });
    // PERFECT 庆祝的镜头微震（ui 层发事件，这里只管震）
    addEventListener('wordpet:shake', () => { this.shakeT = 0.3; });
    // 读出 95+：全场词宠一起跳起来欢呼（错开起跳更像“此起彼伏”）
    // 挑战卡上的 📖 详细 → 打开词典详情卡
    addEventListener('wordpet:detail', e => this._openWordDetail(e.detail.word));
    addEventListener('wordpet:cheer', () => {
      for (const pt of this.pets.all()) {
        if (pt.flying || pt.group.position.distanceTo(this.player.position) > 14) continue;
        pt.jumping = true;
        pt.jt = -Math.random() * 0.8;
        if (pt.group.position.distanceTo(this.player.position) < 8) {
          this._letterBurst(pt.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '💛');
        }
      }
    });
    // 位置存档：每 3 秒 + 离开页面时
    setInterval(() => this._savePosition(), 3000);
    addEventListener('pagehide', () => this._savePosition());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._savePosition(); else this._resumeFix = true; });
  }

  _savePosition() {
    const p = this.player.position;
    const po = this._currentStage().key;
    save.savePlayer({
      x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
      yaw: +this.player.rotation.y.toFixed(2), camYaw: +this.camYaw.toFixed(2),
      isle: this.onIsle,
    });
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer && this.composer.setSize(innerWidth, innerHeight);
  }

  start() {
    this._started = true;
    ui.hideLoading();
    ui.updateUser(save.getUsername());
    ui.updateStars(save.getStars());
    ui.setLeaderboardPlayer({ username: save.getUsername(), score: save.getScore() });
    ui.updatePlayerScore(save.getScore(), save.getSessionScore());
    this._refreshDailyBanner();
    this._autoColliders(this.scene);   // 全场景大件碰撞兜底（含所有已精建岛）
    if (!save.getIntro()) {
      const st0 = this._currentStage();
      setTimeout(() => ui.playIntro(() => { save.setIntro(true); this._introDoneAt = Date.now(); }, this.isTouch, BOOK_LABEL(this.sem), this.total,
        { emoji: st0.emoji, name: st0.name, en: st0.city ? (st0.city.en || '') : '' }), 600);
    }
    this._initEvents();
    this._loop();
    // 换册入学仪式：新学期第一次进岛撒花欢迎（每个学期只办一次）
    if (save.markEnrolled(this.sem)) {
      setTimeout(() => {
        sfx.great();
        ui.confettiBurst(90);
        ui.chapterBanner(t('y.25', { a0: BOOK_LABEL(this.sem) }));
      }, 900);
    }
    this._spawnNaughty();
    this._spawnPatrol();
    this._refreshCityPill();
    this._syncShareUrl();
    setInterval(() => this._refreshHungry(), 1500);
    // 指一条路：最近的可孵蛋
    setTimeout(() => {
      if (!save.getIntro()) return;
      const near = this._nearestEggHint();
      if (near) ui.toast(t('y.26', { a0: ZONE_NAMES[near.word.zone] }), 3600);
    }, 8000);
  }

  // 地址栏同步：把当前城市/课本写成分享链接参数（replaceState，不产生历史记录）。
  // 玩到哪，地址栏就是哪座城——复制链接发给朋友，对方打开直接落到这座城（好友分享）
  _syncShareUrl() {
    try {
      const st = this._currentStage();
      const sem = String(save.getBookSem() || this.sem || '');
      const g = parseInt(sem, 10);
      const next = new URLSearchParams();
      if (st && st.key) next.set('city', st.key);
      if (g >= 3 && g <= 6) { next.set('grade', String(g)); next.set('term', sem.endsWith('b') ? 's2' : 's1'); }
      if (new URLSearchParams(location.search).has('debug')) next.set('debug', '1');
      const qs = next.toString();
      if (qs === new URLSearchParams(location.search).toString()) return;   // 没变化不动地址栏
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (e) { /* file:// 或隐私模式：地址栏同步失败不影响游戏 */ }
  }

  // ================= 主循环 =================
  _loop() {
    requestAnimationFrame(() => this._loop());
    // 页面隐藏（切后台/最小化）时跳过渲染与逻辑：不烧 GPU/电量；
    // 恢复时 Three.Clock 会自己把 getDelta 算成"离开时长"，被下方 clamp 掐到 0.05，
    // 但基于 Date.now() 的倒计时（事件/喝彩锁/BGM）会瞬间快进，所以恢复时统一重排时钟
    if (document.hidden) { this.clock.getDelta(); return; }
    if (this._resumeFix) { this.clock.getDelta(); this._resumeFix = false; }
    this._fpsWatch();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this._updatePlayer(dt);
    this._updateContactShadows();   // 玩家/词宠脚下的接触阴影（每帧跟随，见 js/shadow.js）
    this._updateCamera(dt);
    this._updateShadowFollow();   // 阴影框跟人（见该函数注释：固定 ±60 时城的外圈没有投影）
    if (this.chinaMap) this.chinaMap.setRouteFade(this.camDist);   // 巡游路线虚线：拉远才显现
    if (this.chinaMap) this.chinaMap.setDetail(this.camDist);   // 邻城地形浮雕：中距才画
    this._updateWorldAnim(dt, t);
    this._updateIdleLife(dt, t);
    this._updateEvents(dt);
    this._updateBeacons(dt);
    this._updateWeather(dt, t);
    this._updateGuide(t);
    this._updateZoneHint(dt);
    this._updateFx(dt);
    this._updateIslandLOD();
    // 水面法线 UV 滚动：两层不同速度/方向 → 波纹在动，且看不出平铺重复。
    // 每帧只改 offset（不重传纹理），代价可忽略。
    const wm = this.world.anim.waterMats;
    if (wm && wm.length) {
      const nt = this.clock ? this.clock.elapsedTime : performance.now() / 1000;
      for (const m of wm) {
        if (!m.normalMap) continue;
        m.normalMap.offset.set(nt * 0.02, nt * 0.013);
      }
    }
    this._updateDayNight();
    this.eggs.update(dt, t);
    this.pets.update(dt, t, this.player.position);
    // 词宠溜达守规矩：不穿墙、不下河、不出世界（boat 词宠本来就漂在河里，跳过）
    for (const pt of this.pets.all()) {
      if (!pt.flying && pt.group.visible) this._resolvePetWalk(pt);
    }
    this._stampSpot();
    this._updatePrompt();
    this._placeQuestBubble();
    this._placeNpcBubble();
    // 🐾 词宠乐园：迷你分身轻轻蹦跳 + 慢慢转身
    for (const p of this._ranchPets) {
      p.t += dt;
      p.group.position.y = 0.14 + Math.abs(Math.sin(p.t * 2.2)) * 0.1;
      p.group.rotation.y += dt * 0.4;
    }
    // 脚步声：真的在走才响，每 0.34 秒很轻的一声
    this._stepT = (this._stepT || 0) + dt;
    const stepped = this._lastPos && this._lastPos.distanceToSquared(this.player.position) > 0.0004;
    if (stepped && this._stepT > 0.34) { sfx.step(); this._stepT = 0; }
    (this._lastPos = this._lastPos || new THREE.Vector3()).copy(this.player.position);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // 🐾 词宠乐园：把最近孵出的 6 只词宠的迷你分身放进乐园围栏里
  syncRanch() {
    const zone = this.world && this.world.ranch;
    if (!zone) return;
    for (const p of this._ranchPets) this.scene.remove(p.group);
    this._ranchPets = [];
    const hatched = this.chapters.flatMap(c => c.words).filter(id => save.isHatched(id) && WORD_MAP[id] && WORD_MAP[id].pet);
    const latest = hatched.slice(-6);
    latest.forEach((id, i) => {
      const g = buildPet(WORD_MAP[id].pet);
      g.scale.setScalar(0.55);
      // 原地换成烘焙好的词宠 GLB（只换 children，动画用的 position/rotation 不受影响）。
      // 932 个词宠去重成 358 种外观，key 用 petId（assets 的别名表会命中同一份 GLB）。
      assets.apply(g, 'pet', WORD_MAP[id].pet);
      const a = (i / Math.max(latest.length, 1)) * Math.PI * 2;
      g.position.set(zone.x + Math.cos(a) * zone.r * 0.55, 0.14, zone.z + Math.sin(a) * zone.r * 0.55);
      g.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(g);
      this._ranchPets.push({ group: g, t: Math.random() * 6 });
    });
  }

  // 低端机帧率自适应：连续 6 秒平均 FPS < 25 → 降级一次（关后期合成/阴影/天空动画），不恢复避免抖动
  _fpsWatch() {
    const now = performance.now();
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    if (!this._fpsT0) this._fpsT0 = now;
    if (now - this._fpsT0 < 6000) return;
    const fps = Math.round(this._fpsFrames * 1000 / (now - this._fpsT0));
    this._fpsFrames = 0; this._fpsT0 = now;
    if (this._lowFx) return;
    if (fps >= 25) return;
    this._lowFx = true;
    if (this.composer) { this.composer = null; }                       // 关 Bloom 后期
    if (this.renderer && this.renderer.shadowMap) { this.renderer.shadowMap.enabled = false; }
    this.scene.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
    ui.toast(t('fps.low'), 3200);
  }

  // 任务气泡锚在小人头顶：3D 坐标投到屏幕，镜头外就先藏起来
  _placeQuestBubble() {
    // 拉远看全图时小人已缩成一个点，固定像素的气泡还浮在原地很出戏：镜头远过玩法距离就藏掉
    if (this.camDist > 50) { ui.placeQuest(null); return; }
    this._v3 = this._v3 || new THREE.Vector3();
    this._v3.set(this.player.position.x, this.player.position.y + 1.6, this.player.position.z).project(this.camera);
    if (this._v3.z < 1) ui.placeQuest((this._v3.x * 0.5 + 0.5) * innerWidth, (-this._v3.y * 0.5 + 0.5) * innerHeight);
    else ui.placeQuest(null);
  }
  // NPC 说话气泡：同任务气泡的投影跟随（锚在说话 NPC 头顶）
  _placeNpcBubble() {
    const a = this.npcs && this.npcs.bubbleAnchor && this.npcs.bubbleAnchor();
    if (!a || this.camDist > 50) { ui.placeNpcBubble(null); return; }
    this._v3b = this._v3b || new THREE.Vector3();
    this._v3b.set(a.x, a.y, a.z).project(this.camera);
    if (this._v3b.z < 1) ui.placeNpcBubble((this._v3b.x * 0.5 + 0.5) * innerWidth, (-this._v3b.y * 0.5 + 0.5) * innerHeight);
    else ui.placeNpcBubble(null);
  }

  // ================= 指引系统 =================
  _zoneAt(p) {
    if (this.onIsle) return 'sky';
    // 跳云梯上岛时 onIsle 不会置位，按岛面位置识别（6.2 与平台落足余量对齐）
    if (Math.hypot(p.x + 22, p.z - 27) <= 6.2) return 'sky';
    const isl = this._islandAt(p);
    if (isl) return isl.key;
    if (p.x > 20.9 && p.x < 27.1 && p.z > 19.3 && p.z < 24.7) return 'barn';
    for (const zr of ZONE_RECTS) {
      if (p.x >= zr.x1 && p.x <= zr.x2 && p.z >= zr.z1 && p.z <= zr.z2) return zr.key;
    }
    return 'meadow';
  }

  // 玩家脚下是哪块陆地：海岛（含名字）或主岛（null）
  _islandAt(p) {
    return this.islands.find(isl => Math.hypot(p.x - isl.cx, p.z - isl.cz) <= isl.r + 1) || null;
  }

  _reachableZone(zone) {
    if (zone === 'orchard' || zone === 'windmill') return save.hasGate('boat');
    if (zone === 'barn') return save.hasGate('light');
    if (zone === 'sky') return save.hasGate('beanstalk');
    if (zone === 'beach') return save.hasGate('sandWall');
    if (zone === 'forest') return save.hasGate('vines');
    const isl = this.islands.find(i => i.key === zone);
    if (isl) return this.chapterIndex(this.hatchedInScope()) >= isl.startChapter;
    return true;
  }

  _eggById(id) { const e = this.eggs.get(id); return e ? e.group.position : null; }

  _nearestReachableEgg() {
    const p = this.player.position;
    let best = null, bd = 1e9;
    for (const e of this.eggs.eggs.values()) {
      if (!this._reachableZone(e.word.zone)) continue;
      const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    // 滞后切换：认定过的蛋仍可达就不轻易换，除非新目标近 2 米以上（防止两颗蛋距离接近时箭头来回摇摆）
    const prev = this._lastGuideEggId != null ? this.eggs.eggs.get(this._lastGuideEggId) : null;
    if (prev && prev !== best && prev.group && this._reachableZone(prev.word.zone)) {
      const pd = Math.hypot(prev.group.position.x - p.x, prev.group.position.z - p.z);
      if (bd >= pd - 2) return prev;
    }
    this._lastGuideEggId = best ? best.word.id : null;
    return best;
  }

  // 当前任务目标（文字 + 指路坐标）：剧情钥匙优先，平时显示本关进度
  // 新手引导优先：第一次玩的孩子按 3 步走完就算出师（详见 _guideObjective）
  _objective() {
    if (this._guide) return this._guideObjective();
    // 饥饿词宠临时指路（点饥饿胶囊触发，10 秒内有效）
    if (this._hungryGuide) {
      const hp = this.pets.get(this._hungryGuide.id);
      if (!hp || performance.now() > this._hungryGuide.until) this._hungryGuide = null;
      else return { text: t('q.hungry', { en: hp.word.en }), target: hp.group.position };
    }
    const total = this.hatchedInScope();
    const chIdx = this.chapterIndex(total);
    const chapters = this.chapters;
    // 纯城市链条：引导=当前城市里最近的未孵词宠蛋（行进中动态跟随，带 2 米滞后防摇摆）
    if (this.cityTour) {
      const cur = this.currentChapter;
      const left = cur.words.filter(id => !save.isHatched(id) && this.eggs.get(id));
      if (!left.length) return { text: t('q.done'), target: null };
      let best = null, bd = 1e9;
      for (const id of left) {
        const e = this.eggs.get(id);
        if (!e || !e.group) continue;
        const d = this.player.position.distanceTo(e.group.position);
        if (d < bd) { bd = d; best = e; }
      }
      // 滞后切换：正在跟的蛋没消失就继续跟，除非另一颗近 2 米以上才换方向
      const prev = this._lastGuideEggId != null && left.includes(this._lastGuideEggId) ? this.eggs.get(this._lastGuideEggId) : null;
      if (prev && prev !== best && prev.group) {
        const pd = this.player.position.distanceTo(prev.group.position);
        if (bd >= pd - 2) best = prev;
      }
      this._lastGuideEggId = best ? best.word.id : null;
      return { text: t('q.egg'), target: best ? best.group.position : null };
    }
    if (total >= this.total) {
      return {
        text: t('x.g260', { a0: this.total }),
        target: null,
      };
    }
    if (!save.hasGate('boat')) {
      const ep = save.isHatched('boat') ? { x: 0, z: 4.6 } : this._eggById('boat');
      return save.isHatched('boat')
        ? { text: t('x.g261'), target: ep }
        : { text: t('x.g262'), target: ep };
    }
    if (!save.hasGate('light')) {
      const ep = save.isHatched('light') ? { x: 24, z: 18.5 } : this._eggById('light');
      return save.isHatched('light')
        ? { text: t('x.g263'), target: ep }
        : { text: t('x.g264'), target: ep };
    }
    if (!save.hasGate('wind')) {
      const ep = save.isHatched('wind') ? { x: 13, z: -6 } : this._eggById('wind');
      return save.isHatched('wind')
        ? { text: t('x.g265'), target: ep }
        : { text: t('x.g266'), target: ep };
    }
    if (!save.hasGate('beanstalk')) {
      if (!this.planted) {
        const ep = save.isHatched('seed') ? { x: -22, z: 25.5 } : this._eggById('seed');
        return save.isHatched('seed')
          ? { text: t('x.g267'), target: ep }
          : { text: t('x.g268'), target: ep };
      }
      const ep = save.isHatched('rain') ? { x: -22, z: 25.5 } : this._eggById('rain');
      return save.isHatched('rain')
        ? { text: t('x.g269'), target: ep }
        : { text: t('x.g270'), target: ep };
    }
    // 新大陆谜题：沙墙 → 阳光海滩；荆棘 → 神秘森林
    if (!save.hasGate('sandWall')) {
      return {
        text: save.hasGate('wind')
          ? t('x.g271')
          : t('x.g272'),
        target: save.hasGate('wind') ? { x: 0, z: 36.5 } : null,
      };
    }
    if (!save.hasGate('vines')) {
      return {
        text: t('x.g273'),
        target: { x: -36.5, z: 11 },
      };
    }
    // 本关进度：唤醒满 6 个就通关开新蛋
    const cur = chapters[chIdx].words;
    const left = cur.filter(id => !save.isHatched(id)).length;
    const e = this._nearestReachableEgg();
    if (!e) {
      const bid = this._brickEggId();
      if (bid && !save.isHatched(bid)) {
        const b = (this.world.brickSpots || []).find(s => s.eggId === bid);
        if (b) return { text: t('x.g274'), target: { x: b.x, z: b.z } };
      }
    }
    if (e) {
      // 蛋在海岛上而人不在岛上：指引去坐小火车 / 回主岛
      const isl = this.islands.find(i => i.key === e.word.zone);
      const here = this._islandAt(this.player.position);
      if (!this.cityTour && isl && (!here || here.key !== isl.key)) {
        const onMain = !here;
        return {
          text: onMain
            ? t('y.27', { a0: isl.name })
            : t('y.28', { a0: isl.name }),
          target: onMain ? { x: -9, z: 9.6 } : { x: here.cx, z: here.cz - 2.5 },
        };
      }
    }
    return {
      text: t('y.29', { a0: chIdx + 1, a1: chapters[chIdx].name, a2: left, a3: total, a4: this.total }),
      target: e ? e.group.position : null,
    };
  }

  _updateGuide(nowT) {
    // 新手引导开闸：第一次玩的孩子（还没孵出过词宠、没走过引导）自动进入 3 步引导
    if (!this._guide && !save.isGuideDone() && save.hatchedCount() === 0) this._guide = { step: 0 };
    const obj = this._objective();
    ui.setQuest(obj.text);
    // 头顶箭头
    const p = this.player.position;
    if (obj.target) {
      const dx = obj.target.x - p.x, dz = obj.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 3.5) {
        this.guideArrow.visible = true;
        this.guideArrow.position.set(p.x, p.y + 2.15 + Math.sin(nowT * 3) * 0.12, p.z);
        this.guideArrow.rotation.y = Math.atan2(-dz, dx);
      } else this.guideArrow.visible = false;
    } else this.guideArrow.visible = false;
    // 发光小径：光点波浪式脉动，从脚下铺向目标（贴近地面跟着地形高度走）
    if (obj.target && !this.lockInput) {
      const tgt = obj.target;
      const d = Math.hypot(tgt.x - p.x, tgt.z - p.z);
      const show = d > 4 && d < 60;
      this.pathDotsGroup.visible = show;
      if (show) {
        const n = this.pathDots.length;
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / (n + 1);
          const dot = this.pathDots[i];
          dot.position.set(
            p.x + (tgt.x - p.x) * k,
            p.y + 0.22 + Math.sin(nowT * 4 - i * 0.6) * 0.08,
            p.z + (tgt.z - p.z) * k
          );
          dot.material.opacity = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(nowT * 5 - i * 0.7));
        }
      }
    } else this.pathDotsGroup.visible = false;
    // ---------- 新手引导 3 步推进（只有第一次玩的孩子会走） ----------
    if (this._guide) {
      const p2 = this.player.position;
      if (this._guide.step === 0 && obj.target
        && Math.hypot(obj.target.x - p2.x, obj.target.z - p2.z) < 1.9) {
        this._guide.step = 1;   // 到蛋边了：下一步读单词
      } else if (this._guide.step === 2) {
        const pt = this.pets.get(this._guide.petId);
        if (!pt) return;   // 词宠还没蹦出来
        if (Math.hypot(pt.group.position.x - p2.x, pt.group.position.z - p2.z) < 1.8) {
          save.markGuideDone();
          this._guide = null;
          sfx.great();
          ui.toast(t('x.g278'), 5200);
        }
      }
    }
  }

  // 新手引导目标：第1步走到蛋边 → 第2步读单词 → 第3步摸摸词宠
  _guideObjective() {
    const g = this._guide;
    if (g.step === 0) {
      const e = this._nearestReachableEgg();
      return { text: t('q.step1'), target: e ? e.group.position : null };
    }
    if (g.step === 1) {
      const e = this._nearestReachableEgg();
      return { text: t('q.step2'), target: e ? e.group.position : null };
    }
    const pt = g.petId ? this.pets.get(g.petId) : null;
    return { text: t('q.step3'), target: pt ? pt.group.position : null };
  }

  // 区域进入提示
  // 小人的小生命感：随机眨眼；站着不动时轻轻歪头张望
  _updateIdleLife(dt, t) {
    // 孵化奖励：走到刚孵出的词宠身边 → +1 飘字，爪印飞进词宠胶囊，数字弹跳 +1
    let reward = null;
    for (const pt of this.pets.all()) {
      if (!pt.rewardPending) continue;
      if (Math.hypot(pt.group.position.x - this.player.position.x, pt.group.position.z - this.player.position.z) < 1.8) { reward = pt; break; }
    }
    if (reward) {
      reward.rewardPending = false;
      const vp = reward.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)).project(this.camera);
      const sx = (vp.x * 0.5 + 0.5) * innerWidth, sy = (-vp.y * 0.5 + 0.5) * innerHeight;
      ui.floatPlusOne(sx, sy);
      ui.homePaw(sx, sy, 6, () => ui.petRewardCollect());
      sfx.good();
    }
    // 小知识气泡跟着词宠走，超时或打开弹窗就收起
    if (this._fact && this._fact.until > performance.now() && !ui.challengeOpen()) {
      const fpet = this.pets.get(this._fact.id);
      if (fpet) {
        const vp = fpet.group.position.clone().add(new THREE.Vector3(0, 1.35, 0)).project(this.camera);
        if (vp.z < 1) ui.placePetFact((vp.x * 0.5 + 0.5) * innerWidth, (-vp.y * 0.5 + 0.5) * innerHeight);
        else ui.hidePetFact();
      } else ui.hidePetFact();
    } else ui.hidePetFact();
    const parts = this.playerParts;
    if (parts.eyes && parts.eyes.length) {
      this._blinkT = (this._blinkT ?? 1.2 + Math.random() * 2) - dt;
      if (this._blinkT <= 0) {
        this._blinkT = 2.4 + Math.random() * 3.4;
        this.addTween(0.18, k => {
          const s = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
          // 乘上表情的"笑眼"系数：眨眼（闭）与笑眼（眯）互不覆盖
          for (const e of parts.eyes) e.scale.y = (e.userData.eyeH || 1) * Math.max(0.08, s) * (this._squint || 1);
        }, () => { for (const e of parts.eyes) e.scale.y = (e.userData.eyeH || 1) * (this._squint || 1); });
      }
    }
    if (parts.head) {
      const idle = !this._mv || this._mv.lengthSq() < 0.02;
      const want = idle ? Math.sin(t * 0.7) * 0.15 : 0;
      parts.head.rotation.y += (want - parts.head.rotation.y) * Math.min(1, dt * 5);
    }
    // 表情通道：起 25% 进、中间保持、末 25% 退（不需要 tween 栈，也不会与眨眼打架）
    if (parts.mouth && this._expr) {
      const e = this._expr;
      const k = Math.min(1, (performance.now() - e.t0) / (e.dur * 1000));
      const ease = k < 0.25 ? k / 0.25 : (k > 0.75 ? (1 - k) / 0.25 : 1);
      const mix = (a, b) => a + (b - a) * ease;
      parts.mouth.scale.x = mix(1, e.sx);
      parts.mouth.scale.y = mix(1, e.sy);
      this._squint = mix(1, e.squint);
      if (k >= 1) {
        parts.mouth.scale.set(1, 1, 1);
        this._squint = 1;
        this._expr = null;
      }
    }
  }

  // 表情：kind = smile（微笑）/ joy（大笑，配笑眼）
  // 只动嘴与眼睛 —— 其余部件都被既有动画占用（见本文件 playerParts.* 的用法）
  _faceMood(kind = 'smile', dur = 1.6) {
    const parts = this.playerParts;
    if (!parts || !parts.mouth) return;
    const spec = kind === 'joy'
      ? { sx: 1.5, sy: 1.55, squint: 0.42 }    // 大笑：嘴张开（纵向拉长）+ 眼睛眯成弯
      : { sx: 1.18, sy: 1.06, squint: 1 };     // 微笑：嘴略宽，眼睛不变
    this._expr = { kind, dur, t0: performance.now(), ...spec };
  }

  // ================= 岛屿随机事件 =================
  // 每隔几分钟全岛来一个限时小事件（流星雨/苹果雨/…），给“上线看看今天有什么”的期待感
  _initEvents() {
    this._event = { next: 40 + Math.random() * 40, active: null, items: [], bubbles: [] };
    this._eventKinds = {
      meteor: { dur: 30, label: t('x.g279') },
      apple: { dur: 30, label: t('x.g280') },
      escape: { dur: 75, label: t('x.g281') },
      merchant: { dur: 95, label: t('x.g282') },
      bubbles: { dur: 45, label: t('x.g283') },
    };
  }

  _updateEvents(dt) {
    const ev = this._event;
    // 拾取：小人走近掉落物就收进兜里（+1⭐）
    for (let i = ev.items.length - 1; i >= 0; i--) {
      const it = ev.items[i];
      it.life -= dt;
      if (it.life <= 0) { this.scene.remove(it.obj); ev.items.splice(i, 1); continue; }
      const d = Math.hypot(it.x - this.player.position.x, it.z - this.player.position.z);
      if (d < 1.15) {
        save.addStars(1);
        ui.updateStars(save.getStars());
        const vp = it.obj.position.clone().add(new THREE.Vector3(0, 0.7, 0)).project(this.camera);
        ui.floatPlusOne((vp.x * 0.5 + 0.5) * innerWidth, (-vp.y * 0.5 + 0.5) * innerHeight, '+1⭐');
        sfx.pop();
        this._starBurst(it.obj.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 2);
        this.scene.remove(it.obj);
        ev.items.splice(i, 1);
      }
    }
    if (!ev.active) {
      ev.next -= dt;
      if (ev.next <= 0 && !ui.challengeOpen()) this._startRandomEvent();
      return;
    }
    ev.active.t -= dt;
    ev.active.spawnT -= dt;
    if (ev.active.id === 'escape') this._escapeTick(dt);
    // 泡泡轻轻浮动
    for (const bb of ev.bubbles || []) {
      bb.t = (bb.t || 0) + dt;
      bb.group.position.y = bb.yBase + Math.sin(bb.t * 2 + bb.phase) * 0.22;
    }
    if (ev.active && ev.active.spawnT <= 0 && ev.active.id !== 'escape') this._eventSpawnTick();
    if (ev.active && ev.active.t <= 0) {
      this._endEvent();
      ui.toast(t('x.g284'), 2400);
    }
  }

  _startRandomEvent() {
    const kinds = Object.keys(this._eventKinds);
    const id = kinds[Math.floor(Math.random() * kinds.length)];
    this._startEvent(id);
  }

  _startEvent(id) {
    const cfg = this._eventKinds[id];
    if (!cfg) return;
    const active = { id, t: cfg.dur, spawnT: 0, data: {} };
    this._event.active = active;
    if (id === 'escape') {
      // 挑两只已孵化的词宠离家出走，头上顶个❗，追上去就乖乖回来
      const cands = this.pets.all().filter(p => p.word.id !== 'boat' && !p.rewardPending);
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      const runaways = cands.slice(0, Math.min(2, cands.length));
      active.data.need = runaways.map(p => p.word.id);
      for (const p of runaways) {
        p.escape = true;
        p.wait = 0;
        const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 8;
        let tx = p.home.x + Math.cos(a) * r, tz = p.home.y + Math.sin(a) * r;
        if (this.cityTour) {   // 逃走目标也钳在城内：词宠不往院墙外跑
          const q = { x: tx, z: tz };
          this._clampCityPos(q);
          tx = q.x; tz = q.z;
        }
        p.target.set(tx, tz);
        const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('❗', '#E85A4B', '#FFF0E0'), transparent: true, depthWrite: false }));
        mark.position.set(0, 1.55, 0);
        mark.scale.setScalar(0.42);
        p.group.add(mark);
        active.data['mark_' + p.word.id] = mark;
      }
      if (!runaways.length) { this._event.active = null; return; }
    }
    if (id === 'merchant') {
      const cart = PROPS.merchantCart();
      let cx = 0, cz = 20.8;   // 农场：村口老位置
      if (this.cityTour) {     // 城市巡游：货郎进城，摆到城中心旁（钳回城内，别把摊子支到海上）
        const st = this._currentStage();
        const q = { x: st.cx, z: st.cz + 6 };
        this._clampCityPos(q, st);
        cx = q.x; cz = q.z;
      }
      cart.position.set(cx, 0, cz);
      this.scene.add(cart);
      active.data.cart = { x: cx, z: cz };
      active.data.cartGroup = cart;
      const gift = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('🎁', '#E85A4B', '#FFF0E0'), transparent: true, depthWrite: false }));
      gift.position.set(cx, 2.35, cz);
      gift.scale.setScalar(0.55);
      this.scene.add(gift);
      active.data.gift = gift;
    }
    ui.toast(cfg.label, 3600);
    sfx.magic();
  }

  // 结束事件：清场
  _endEvent() {
    const ev = this._event;
    const id = ev.active && ev.active.id;
    for (const it of ev.items) this.scene.remove(it.obj);
    ev.items = [];
    for (const bb of ev.bubbles || []) this.scene.remove(bb.group);
    ev.bubbles = [];
    if (id === 'escape') {
      for (const p of this.pets.all()) {
        if (p.escape) {
          p.escape = false;
          const mark = ev.active.data['mark_' + p.word.id];
          if (mark) p.group.remove(mark);
        }
      }
    }
    if (id === 'merchant' && ev.active.data.cartGroup) {
      this.scene.remove(ev.active.data.cartGroup);
      if (ev.active.data.gift) this.scene.remove(ev.active.data.gift);
    }
    ev.active = null;
    ev.next = 80 + Math.random() * 100;
  }

  // 大逃走的每帧检查：走到❗词宠身边就是“找回”
  _escapeTick(dt) {
    const ev = this._event;
    const need = ev.active.data.need || [];
    for (const id of [...need]) {
      const pet = this.pets.get(id);
      if (!pet || !pet.escape) continue;
      const d = Math.hypot(pet.group.position.x - this.player.position.x, pet.group.position.z - this.player.position.z);
      if (d < 1.5) {
        pet.escape = false;
        const mark = ev.active.data['mark_' + id];
        if (mark) pet.group.remove(mark);
        save.addStars(1);
        ui.updateStars(save.getStars());
        pet.jumping = true; pet.jt = 0;
        sfx.good();
        ui.toast(t('x.g285', { a0: pet.word.en }), 2600);
        need.splice(need.indexOf(id), 1);
      }
    }
    if (!need.length) { ui.toast(t('x.g286'), 2800); this._endEvent(); }
  }

  // 神秘盲盒：5⭐ 开一次，星星/稀有装扮随机
  _buyMysteryBox() {
    if (ui.challengeOpen()) return;
    if (!save.spendStars(5)) { ui.toast(t('x.g287'), 2600); return; }
    ui.updateStars(save.getStars());
    sfx.magic();
    const roll = Math.random();
    if (roll < 0.5) {
      const n = 3 + Math.floor(Math.random() * 3);
      save.addStars(n); ui.updateStars(save.getStars());
      ui.toast(t('x.g288', { a0: n }), 3000);
    } else if (roll < 0.8) {
      const n = 5 + Math.floor(Math.random() * 4);
      save.addStars(n); ui.updateStars(save.getStars());
      ui.toast(t('x.g289', { a0: n }), 3200);
    } else {
      const wear = save.getWear();
      const pool = [];
      if (!wear.hatOwned.includes('wizard')) pool.push({ patch: { hatOwned: [...wear.hatOwned, 'wizard'], hat: 'wizard' }, label: t('x.g232') });
      if (!wear.hatOwned.includes('flower')) pool.push({ patch: { hatOwned: [...wear.hatOwned, 'flower'], hat: 'flower' }, label: t('x.g234') });
      if (!wear.balloonOwned) pool.push({ patch: { balloonOwned: true, balloon: true }, label: t('x.g236') });
      if (!wear.wandOwned) pool.push({ patch: { wandOwned: true, wand: true }, label: t('x.g238') });
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        save.updateWear(pick.patch);
        this._refreshPlayerLook();
        ui.toast(t('y.30', { a0: pick.label }), 3800);
      } else {
        save.addStars(6); ui.updateStars(save.getStars());
        ui.toast(t('x.g291'), 3000);
      }
    }
  }

  _bubbleWord() {
    const GATES = ['boat', 'light', 'wind', 'seed', 'rain', 'banana'];
    const skip = new Set(GATES);
    if (this._perchEggId()) skip.add(this._perchEggId());
    const bid = (this.world.brickSpots || []).find(bb => bb.eggId);
    if (bid && bid.eggId) skip.add(bid.eggId);
    const ids = this.currentChapter.words.filter(id => !save.isHatched(id) && !skip.has(id) && WORD_MAP[id].zone !== 'sky');
    return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
  }

  _eventSpawnTick() {
    const ev = this._event;
    if (ev.active.id === 'bubbles') {
      ev.active.spawnT = 3;
      if (ev.bubbles.length >= 3) return;
      const id = this._bubbleWord();
      if (!id) return;
      const w = WORD_MAP[id];
      const a = Math.random() * Math.PI * 2, r = 3.5 + Math.random() * 4.5;
      let x = this.player.position.x + Math.cos(a) * r, z = this.player.position.z + Math.sin(a) * r;
      if (this.cityTour) {   // 泡泡不许刷到院墙外：贴墙时钳回城内，顶得到才玩得成
        const q = { x, z };
        this._clampCityPos(q);
        x = q.x; z = q.z;
      }
      const yBase = 2.2 + Math.random() * 0.9;
      const group = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), new THREE.MeshStandardMaterial({ color: '#A8D8F0', transparent: true, opacity: 0.4, roughness: 0.15 }));
      group.add(ball);
      const txt = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(w.zh, '#2E5E86', '#FFFFFF'), transparent: true, depthWrite: false }));
      txt.scale.setScalar(0.85);
      group.add(txt);
      group.position.set(x, yBase, z);
      this.scene.add(group);
      ev.bubbles.push({ group, word: w, yBase, phase: Math.random() * 6 });
      return;
    }
    ev.active.spawnT = ev.active.id === 'meteor' ? 1.6 : 1.3;
    if (ev.items.length > 10) return;   // 场上够多了，先不刷
    let x, z, tries = 0;
    do {
      if (this.cityTour) {
        // 城市舞台：掉落物围着玩家刷并钳在城内（城市在 640+ 外，绕原点刷的会落到海里看不见）
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 14;
        const q = { x: this.player.position.x + Math.cos(a) * r, z: this.player.position.z + Math.sin(a) * r };
        this._clampCityPos(q);
        x = q.x; z = q.z;
      } else if (ev.active.id === 'apple') { x = -30 + Math.random() * 24; z = -28 + Math.random() * 22; }
      else { const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 36; x = Math.cos(a) * r; z = Math.sin(a) * r; }
      tries++;
    } while (!this.cityTour && Math.abs(z) < 4.6 && tries < 8);
    if (ev.active.id === 'meteor') {
      // 流星划落的小动画
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('✦', '#FFE97A', '#FFF7D0'), transparent: true, depthWrite: false }));
      m.position.set(x + 4, 13, z - 5);
      m.scale.setScalar(0.9);
      this.scene.add(m);
      this.addTween(0.8, k => {
        m.position.set(x + 4 * (1 - k), 13 - k * 12.4, z - 5 + k * 5);
        m.material.rotation = k * 5;
        m.material.opacity = 1 - k * 0.3;
      }, () => this.scene.remove(m));
    }
    // 掉落物在地上等你 14 秒
    const it = ev.active.id === 'apple'
      ? new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#FF9A3C', roughness: 0.5 }))
      : new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('⭐', '#FFE24E', '#FFFDF0'), transparent: true, depthWrite: false }));
    it.position.set(x, ev.active.id === 'apple' ? 0.22 : 0.5, z);
    if (it.isSprite) it.scale.setScalar(0.5);
    this.scene.add(it);
    ev.items.push({ obj: it, x, z, life: 14 });
  }

  // 词宠溜达的碰撞：与小人同一套世界规则（被挡住就换个目标，不顶着墙较劲）
  _resolvePetWalk(pt) {
    const pos = pt.group.position;
    const onIsle = pt.baseY === 14;
    let pushed = false;
    if (onIsle) {
      const dc = Math.hypot(pos.x + 22, pos.z - 27);
      if (dc > 5) { const k = 5 / dc; pos.x = -22 + (pos.x + 22) * k; pos.z = 27 + (pos.z - 27) * k; pushed = true; }
      return;   // 天空岛的词宠只守岛沿
    }
    const isl = this._islandAt(pos);
    if (isl) {
      if (this.cityTour) {
        // 城市舞台：词宠与小人同一条城市边界（圆形钳制在凹形城市会漏到墙外海上）
        if (this._clampCityPos(pos)) pushed = true;
      } else {
        const dc = Math.hypot(pos.x - isl.cx, pos.z - isl.cz);
        if (dc > isl.r - 0.3) {
          const k = (isl.r - 0.3) / dc;
          pos.x = isl.cx + (pos.x - isl.cx) * k;
          pos.z = isl.cz + (pos.z - isl.cz) * k;
          pushed = true;
        }
      }
    } else {
      const dc = Math.hypot(pos.x, pos.z);
      if (dc > WORLD_R) { pos.x *= WORLD_R / dc; pos.z *= WORLD_R / dc; pushed = true; }
    }
    if (pt.word.id !== 'boat' && Math.abs(pos.z) < 4.1) { pos.z = pos.z >= 0 ? 4.1 : -4.1; pushed = true; }
    const R = 0.4;
    for (const c of this.world.colliders) {
      if (c.dead) continue;
      if (c.top !== undefined && (pos.y > c.top - 0.25 || pos.y + 1 <= (c.bottom || 0))) continue;
      if (c.t === 'c') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d < c.r + R && d > 0.001) {
          pos.x = c.x + dx / d * (c.r + R);
          pos.z = c.z + dz / d * (c.r + R);
          pushed = true;
        }
      } else {
        const cx = THREE.MathUtils.clamp(pos.x, c.x1, c.x2);
        const cz = THREE.MathUtils.clamp(pos.z, c.z1, c.z2);
        const dx = pos.x - cx, dz = pos.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < R && d > 0.001) { pos.x = cx + dx / d * R; pos.z = cz + dz / d * R; pushed = true; }
      }
    }
    if (pushed) { pt.wait = 0; pt.target.set(pos.x + (Math.random() - 0.5) * 3, pos.z + (Math.random() - 0.5) * 3); }
  }

  // 进化形态：长大一圈 + 头顶星星光环（读档后也会在 _spawnProgress 里恢复）
  _applyEvolved(pet, celebrate = false) {
    if (!pet || pet.evo) return;
    pet.evo = true;
    pet.group.scale.setScalar(1.22);
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('✨', '#FFE24E', '#FFFDF0'), transparent: true, opacity: 0.95, depthWrite: false }));
    aura.position.set(0, 0.95, 0);
    aura.scale.setScalar(0.5);
    aura.name = 'evoAura';
    pet.group.add(aura);
    if (celebrate) {
      ui.toast(t('x.g292', { a0: pet.word.en }), 4200);
      ui.confettiBurst(60);
      save.addStars(2);
      ui.updateStars(save.getStars());
      sfx.evolve();
      this._starBurst(pet.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 6);
    }
  }

  // 稀有词宠：95 分孵出的带柔光
  _applyRare(pet) {
    if (!pet || pet.rare || !pet.group) return;
    pet.rare = true;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0xFFE08A, transparent: true, opacity: 0.4, depthWrite: false }));
    glow.position.set(0, 0.5, 0);
    glow.scale.setScalar(1.5);
    glow.name = 'rareGlow';
    pet.group.add(glow);
  }

  // 猫头鹰园丁：汇报/领取今天的任务链
  _openOwl() {
    if (ui.challengeOpen()) return;
    const chain = save.getChain();
    const steps = [t('x.g293'), t('x.g294'), t('x.g295')];
    if (chain.done) {
      ui.toast(t('x.g296'), 3400);
      return;
    }
    const cur = steps[chain.step];
    const prog = chain.n > 0 ? t('x.g297', { a0: chain.n }) : '';
    ui.toast(t('x.g298', { a0: cur, a1: prog }), 4200);
    sfx.pop();
  }

  // 任务链结算：单步完成 +2⭐，三步全完 +4⭐
  _chainReward(res) {
    if (!res) return;
    if (res.done) {
      save.addStars(4);
      ui.updateStars(save.getStars());
      ui.toast(t('x.g299'), 3600);
      ui.confettiBurst(50);
      sfx.evolve();
    } else if (res.step !== undefined) {
      save.addStars(2);
      ui.updateStars(save.getStars());
      ui.toast(t('x.g300'), 3000);
    }
  }

  // ================= 词典详情卡 =================
  // 本地内容立刻显示（中文/音节/小妙招/音标），联网词典（英英释义+例句）查到后追加
  _detailLocalHTML(w) {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let html = '';
    const ipa = ui.ipaFor(w.en);
    if (ipa) html += `<div class="dt-ipa"><span>🔊 /${esc(ipa)}/</span></div>`;
    if (Array.isArray(w.syl) && w.syl.length) {
      html += `<div class="dt-sec">${t('y.syl')}</div><div class="dt-row dt-syl">${w.syl.map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
    }
    html += t('y.31', { a0: esc(w.zh) });
    html += t('y.32', { a0: esc(w.hint || '') });
    if (typeof w.story === 'string' && w.story) {
      html += t('y.33', { a0: esc(w.story) });
    }
    return html;
  }

  // 词典数据：ECDICT 开源英汉词典精简版（data/dict.json，本地加载无网络依赖）
  async _loadDict() {
    if (this._dictData || this._dictFail) return this._dictData || null;
    this._dictData = await new Promise(resolve => {
      fetch('data/dict.json')
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
        .then(d => { this._dictFail = !d; resolve(d || null); });
    });
    return this._dictData;
  }

  _openWordDetail(w) {
    if (!w) return;
    stopListening();
    window.__detailWord = w.en;
    ui.showWordDetail(t('y.34', { a0: w.en }), this._detailLocalHTML(w));
    speak(w.en);   // 自动朗读
    this._loadDict().then(dict => {
      if (window.__detailWord !== w.en) return;   // 已切到别的词就不追加
      const d = dict && dict[w.en.toLowerCase().trim()];
      if (!d) {
        ui.detailAppendHTML(t('x.g306'));
        return;
      }
      const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      let html = '';
      if (d.p) html += `<div class="dt-ipa"><span>📘 ${esc(d.p)}</span></div>`;
      if (d.t) {
        html += t('x.g307');
        for (const line of d.t.split(/\\n|\n/).filter(Boolean)) html += `<div class="dt-row">${esc(line)}</div>`;
      }
      if (d.d) {
        html += t('x.g308');
        for (const line of d.d.split(/\\n|\n/).filter(Boolean).slice(0, 3)) html += `<div class="dt-row">${esc(line)}</div>`;
      }
      if (d.x) {
        const NAMES = { s: t('x.g309'), p: t('x.g310'), d: t('x.g311'), i: t('x.g312'), '3': t('x.g313'), r: t('x.g314'), t: t('x.g315') };
        const parts = d.x.split('/').map(kv => kv.split(':')).filter(kv => kv.length === 2 && NAMES[kv[0]]);
        if (parts.length) {
          html += t('x.g316');
          for (const [k, v] of parts) html += `<span style="margin-right:12px">${NAMES[k]}：${esc(v)}</span>`;
          html += '</div>';
        }
      }
      ui.detailAppendHTML(html);
    });
  }

  // ---- 天气轮换：晴/雨/雪，纯氛围不拦玩法 ----
  _updateWeather(dt, nowT) {
    const w = this._weatherState || (this._weatherState = { cur: 'clear', next: 90 + Math.random() * 90 });
    const rain = this.world.anim.rain, snow = this.world.anim.snow, sunL = this.world.anim.sunLight;
    w.next -= dt;
    if (w.next <= 0) {
      const roll = Math.random();
      w.cur = roll < 0.55 ? 'clear' : roll < 0.8 ? 'rain' : 'snow';
      w.next = w.cur === 'clear' ? 120 + Math.random() * 120 : 50 + Math.random() * 40;
      if (rain) rain.visible = w.cur === 'rain';
      if (snow) snow.visible = w.cur === 'snow';
      if (w.cur !== 'clear') ui.toast(w.cur === 'rain' ? t('x.g317') : t('x.g318'), 3000);
    }
    if (rain && rain.visible) {
      const pos = rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 26;
        if (y < 0) y += 24;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (snow && snow.visible) {
      const pos = snow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 2.2;
        if (y < 0) y += 24;
        pos.setX(i, pos.getX(i) + Math.sin(nowT * 0.8 + i) * dt * 0.4);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    // 天气只按**比例**打折主光强度：此前这里每帧把 sun.intensity 拉回 2.1（绝对值），
    // 把 _updateDayNight 的"白天压低主光 / 夜里调暗"整套调参全都覆盖掉了——夜里也拉不暗、
    // 白天永远是老亮度（这也是"发白"的一环）。现在以 dn.baseSun 为基准乘天气系数。
    if (sunL) {
      const dn = this.world.anim.dayNight;
      const k = w.cur === 'rain' ? 0.62 : w.cur === 'snow' ? 0.78 : 1;
      sunL.intensity += (((dn && dn.baseSun) || 1.35) * k - sunL.intensity) * Math.min(1, dt * 2);
    }
  }

  // 碰撞提示：顶到什么东西时给一句小朋友听得懂的话（按类型限频，不会刷屏）
  _showBumpHint(kind) {
    const now = performance.now();
    this._hintCd = this._hintCd || {};
    if (now - (this._hintCd[kind] || 0) < 7000) return;
    this._hintCd[kind] = now;
    const texts = {
      rail: t('x.g319'),
      wall: t('x.g320'),
      sea: t('x.g321'),
    };
    ui.toast(texts[kind], 2400);
  }

  _updateZoneHint(dt) {
    this._zoneTimer = (this._zoneTimer || 0) + dt;
    if (this._zoneTimer < 0.6) return;
    this._zoneTimer = 0;
    const p = this.player.position;
    // 词宠打招呼：靠近自己的词宠时偶尔冒个笑脸（30 秒最多一次，骑乘中不打扰）
    if (!this.mount) {
      let near = null, nd = 3;
      let hungryNear = null;
      for (const pt of this.pets.all()) {
        const d = Math.hypot(p.x - pt.group.position.x, p.z - pt.group.position.z);
        if (save.isHungry(pt.word.id)) {
          if (d < 2.5) hungryNear = pt;   // 饿词宠跑到身边：撒娇讨吃的
          continue;
        }
        if (d < nd) { nd = d; near = pt; }
      }
      if (hungryNear && (!this._hungrySaid || this._hungrySaid < performance.now())) {
        this._hungrySaid = performance.now() + 15000;
        this._petSay(hungryNear, t('x.g322'), 2.2);
      }
      if (near && (!this._helloCd || this._helloCd < performance.now())) {
        this._helloCd = performance.now() + 30000;
        this._petEmoji(near, '😊');
      }
    }
    // 情景单词：走到实物旁弹气泡并念一遍（每个点 90 秒最多触发一次）
    for (const s of SCENE_WORDS) {
      if (this._sceneCd && this._sceneCd[s.en] > performance.now()) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) > 2.6) continue;
      (this._sceneCd = this._sceneCd || {})[s.en] = performance.now() + 90000;
      this._sceneBubble(s, WORD_MAP[s.en]);
      speak(WORD_MAP[s.en].en);
      break;
    }
    const z = this._zoneAt(this.player.position);
    if (z !== this.lastZone) {
      this.lastZone = z;
      setBgmMood(z === 'beach' ? 'beach' : z === 'forest' ? 'forest' : 'farm'); // 分区音乐：换区下一小节自然过渡
      if (save.addVisited(z)) {
        sfx.zone();   // 新区域亮相音
      const names = {
        meadow: t('x.g323'), orchard: t('x.g324'),
        windmill: t('x.g325'), barnyard: t('x.g326'),
        barn: t('x.g327'), garden: t('x.g328'),
        sky: t('x.g329'),
        beach: t('x.g330'), forest: t('x.g331'),
      };
        // 海岛区域不在 names 里，用小火车站点登记的名字
        const isl = this.islands.find(i => i.key === z);
        ui.toast('📍 ' + (names[z] || (isl ? t('x.g332', { a0: isl.name }) : z)), 3200);
      }
    }
  }

  // 地图
  _openMap() {
    const visited = save.getVisited();
    const hatched = this.hatchedInScope();
    const chIdx = this.chapterIndex(hatched);
    const chWords = new Set(this.chapters[chIdx].words);
    // 统计“当前关卡 + 剧情钥匙蛋”落在该区域的词，和场上真实可见的蛋保持一致（只看本册）
    const zoneStats = key => {
      const inZone = this.scopeWords.filter(w => w.zone === key && (chWords.has(w.id) || this._pendingGateWord(w.id)));
      return { total: inZone.length, hatched: inZone.filter(w => save.isHatched(w.id)).length };
    };
    const zones = ZONE_RECTS.map(zr => {
      const st = zoneStats(zr.key);
      return {
        key: zr.key, name: zr.name, x1: zr.x1, z1: zr.z1, x2: zr.x2, z2: zr.z2,
        discovered: visited.includes(zr.key),
        total: st.total,
        hatched: st.hatched,
        locked: !this._reachableZone(zr.key),
      };
    });
    zones.push({
      key: 'sky', name: SKY_RECT.name, x1: SKY_RECT.x1, z1: SKY_RECT.z1, x2: SKY_RECT.x2, z2: SKY_RECT.z2,
      discovered: visited.includes('sky'), ...zoneStats('sky'),
      locked: !save.hasGate('beanstalk'),
    });
    const eggs = [...this.eggs.eggs.values()].map(e => ({
      x: e.group.position.x, z: e.group.position.z, golden: e.golden, key: !!e.key,
    }));
    const islands = this.islands.map(isl => ({
      key: isl.key, name: isl.name, emoji: isl.emoji, cx: isl.cx, cz: isl.cz, r: isl.r,
      unlocked: chIdx >= isl.startChapter,
      // 本册进度：岛上有几只已经唤醒
      total: this.scopeWords.filter(w => w.island === isl.key).length,
      hatched: this.scopeWords.filter(w => w.island === isl.key && save.isHatched(w.id)).length,
    }));
    if (this.cityTour && this._openCityMap()) return;
    ui.openMap({
      player: { x: this.player.position.x, z: this.player.position.z },
      zones, eggs, islands,
      gates: { sandWall: save.hasGate('sandWall'), vines: save.hasGate('vines') },
      chapterLabel: t('y.35', { a0: BOOK_LABEL(this.sem), a1: chIdx + 1, a2: this.chapters[chIdx].name }),
    });
  }

  // 城市巡游 2D 地图：全国大公鸡地图 + 路线城市带名字，点城市看介绍
  _openCityMap() {
    if (!this.cityTour) return false;
    const chIdx = this.chapterIndex(this.hatchedInScope());
    const curKey = this._currentStage().key;
    const cities = [];
    for (const isl of this.islands) {
      const geo = CITY_GEO[isl.key];
      if (!geo) continue;
      cities.push({
        key: isl.key, name: isl.name, emoji: isl.emoji,
        lon: geo.ctr[0], lat: geo.ctr[1],
        current: isl.key === curKey,
        unlocked: isl.bonus ? true : chIdx >= isl.startChapter,
      });
    }
    return ui.openChinaMap({
      cities,
      onPick: (key) => {
        const idx = this.islands.findIndex(i => i.key === key);
        if (idx < 0) return;
        const isl = this.islands[idx];
        const visit = Math.max(0, (save.getSave().cityVisits?.[this.sem + ':' + key] || 1) - 1);
        ui.showCityCard({
          city: isl.city, variant: cityVariant(isl.city, visit), visit,
          quiz: getCityQuiz(key),
          isFinal: key === this.cityRouteList[this.cityRouteList.length - 1],
          onStar: () => { save.addStars(1); ui.updateStars(save.getStars()); this._bumpTask('stamp'); },
        });
      },
    });
  }

  // ================= 玩家 =================
  // ---------- 城市巡游 ----------
  // 当前关对应的城市舞台（路线[章节序]）
  _currentStage() {
    // 奖励探索期间锁定当前城（普通巡游按进度走）
    // 修复：_forceChapter 是 chapters 索引，须按 startChapter 映射回岛屿，否则奖励城会错位显示成北京
    if (this._forceChapter != null) {
      const isl = this.islands.find(s => s.startChapter === this._forceChapter);
      if (isl) return isl;
    }
    const idx = Math.min(this.chapterIndex(this.hatchedInScope()), this.islands.length - 1);
    return this.islands[idx] || this.islands[0];
  }
  // 主岛词坐标 → 当前城市舞台：保留主岛方向角，压进舞台半径（每个词有固定的新家）
  _cityPos(word, stage = this._currentStage()) {
    const [ox, oz] = word.pos;
    const a = Math.atan2(oz, ox);
    const rr = stage.r * (0.38 + 0.28 * Math.min(1, Math.hypot(ox, oz) / 52));
    let x = stage.cx + Math.cos(a) * rr, z = stage.cz + Math.sin(a) * rr;
    // 天空词蛋放城市高台上（地标旁的石台，跳上去够得着）
    if (word.zone === 'sky') {
      // 观景石台位与 world.js 城市布局个性同参（perchA/perchD），石台与蛋必重合
      const lay = cityLayout(stage.key);
      x = stage.cx + Math.cos(lay.perchA) * stage.r * lay.perchD;
      z = stage.cz + Math.sin(lay.perchA) * stage.r * lay.perchD;
    }
    // 真实轮廓下细长/凹形城市（兰州等）按半径摆放可能落海：统一钳回多边形内
    // 天空蛋边距=石台边距（world.js 同为 墙厚+1.2），同点同钳制，蛋才不会漂离台面
    // 静态蛋位严格边距（floor=margin）：蛋容许被甩向城心（保可捡），不许贴进墙缝
    const q = { x, z };
    const m = this._cityWallMargin(stage, word.zone === 'sky' ? 1.2 : 0.5);
    this._clampCityPos(q, stage, m, m);
    // 天空蛋站观景石台：台面 = 地形高度 + 3.45（写死 3.2 会在有地形的城市悬空或埋进山坡）
    return word.zone === 'sky' ? { x: q.x, z: q.z, y: this._groundY(q.x, q.z) + 3.45 } : { x: q.x, z: q.z, y: 0 };
  }
  // 蛋位可站性：在城界内（玩家贴墙线）且不与任何碰撞体重叠，孩子才能走到蛋旁按 E。
  // 蛋 spawn 旧逻辑只钳城界不避碰撞体——蛋会刷进碑/树/城墙夹缝，看得见够不着（原地撞墙晃）。
  // 装饰/大件的视觉遮挡：绿化（world.decor）与地标等大件（isl.blockers）都是"不参与碰撞
  // 却能把蛋整个罩住"的东西。两者都是岛内局部坐标，按当前城心换算成世界坐标。
  _blockedAt(x, z, R = 1.0) {
    const st = this._currentStage();
    for (const d of this.world.decor || []) {
      if (Math.hypot(x - (st.cx + d.x), z - (st.cz + d.z)) < d.r + R) return true;
    }
    // 世界是所有城的集合，必须按 (cx,cz) 找本城的登记项，否则会拿别城的坐标来判
    const isl = (this.world.islands || []).find(q => Math.abs(q.cx - st.cx) < 0.5 && Math.abs(q.cz - st.cz) < 0.5);
    for (const b of (isl && isl.blockers) || []) {
      if (Math.hypot(x - (st.cx + b.x), z - (st.cz + b.z)) < b.r + R) return true;
    }
    return false;
  }

  _eggReachable(x, z) {
    const st = this._currentStage();
    const probe = { x, z };
    if (this._clampCityPos(probe, st, this._cityWallMargin(st), 0.5)) return false;   // 被城界推出 = 站不到
    if (this._blockedAt(x, z)) return false;   // 被树冠/地标罩住的点不算可站（蛋会看不见）
    const R = 1.0;   // 玩家站位半径（含一点余量）
    for (const c of this.world.colliders) {
      if (c.dead) continue;
      if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < (c.r || 0) + R) return false; }
      else {
        const cx = Math.max(c.x1, Math.min(x, c.x2)), cz = Math.max(c.z1, Math.min(z, c.z2));
        if (Math.hypot(x - cx, z - cz) < R) return false;
      }
    }
    return true;
  }
  // 不可站就沿「落点→城心」方向内移（每次 12%），城心广场一定可站；最多 24 步
  _eggSpot(x, z) {
    const st = this._currentStage();
    let px = x, pz = z;
    for (let i = 0; i < 24; i++) {
      if (this._eggReachable(px, pz)) return { x: px, z: pz };
      px += (st.cx - px) * 0.12; pz += (st.cz - pz) * 0.12;
    }
    // 兜底：城心往往就是主地标（蛋会被罩住），一圈圈向外找第一个真正可站的点
    for (let rr = st.r * 0.15; rr <= st.r * 0.85; rr += st.r * 0.07) {
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const px = st.cx + Math.cos(a) * rr, pz = st.cz + Math.sin(a) * rr;
        if (this._eggReachable(px, pz)) return { x: px, z: pz };
      }
    }
    return { x: st.cx, z: st.cz };
  }
  // 蛋位分配：多颗蛋不许落在同一点（同点会互相套住，孩子只看得见最外面那颗）。
  // 顺序：指定点 → 其它牌旁点 → 以该点为中心螺旋找第一个"可站且不被遮挡"的空位。
  _freeEggSpot(x, z) {
    const placed = (this._placedEggSpots = this._placedEggSpots || []);
    const st = this._currentStage();
    const free = q => placed.every(q2 => Math.hypot(q.x - q2.x, q.z - q2.z) > 2.6);
    // 候选点必须"真正可站"（_eggReachable 已含城界/碰撞体/树冠/地标遮挡），
    // 否则 _eggSpot 的城心兜底会被接受——城心常是返回台/主地标，蛋就落在道具里了。
    const ok = (sx, sz) => {
      const s = this._eggSpot(sx, sz);
      return (this._eggReachable(s.x, s.z) && free(s)) ? s : null;
    };
    let s = ok(x, z);
    if (!s) {
      const list = this._signEggSpots || [];
      const start = list.length ? this._hashStr(st.key + x.toFixed(1) + z.toFixed(1)) % list.length : 0;
      for (let k = 0; k < list.length && !s; k++) s = ok(list[(start + k) % list.length].x, list[(start + k) % list.length].z);
    }
    if (!s) {
      // 螺旋外扩：一圈圈找第一个可站空位
      for (let rr = 3; rr <= st.r * 0.7 && !s; rr += 3) {
        for (let k = 0; k < 12 && !s; k++) {
          const a = k / 12 * Math.PI * 2 + rr;
          s = ok(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
        }
      }
    }
    if (!s) {
      // 再退一步：放宽"不重叠"，只要求可站（宁可两颗蛋靠近，也不要一颗埋在道具里）
      for (let rr = 3; rr <= st.r * 0.7 && !s; rr += 3) {
        for (let k = 0; k < 12 && !s; k++) {
          const a = k / 12 * Math.PI * 2 + rr * 1.7;
          const q = this._eggSpot(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
          if (this._eggReachable(q.x, q.z)) s = q;
        }
      }
    }
    if (!s) s = this._eggSpot(x, z);   // 实在无解：退回原逻辑（不丢蛋）
    placed.push(s);
    return s;
  }

  // 换城：切舞台显隐、词宠全家迁城、玩家落在新城
  // 自动碰撞兜底：扫岛内大件装饰（建筑/树），中心未被任何碰撞体覆盖的注册圆形碰撞体。
  // 装饰生成只给部分元素手写碰撞体，其余大件会被人穿模（穿塔 bug）——这里全量兜底。
  // 幂等：已覆盖的组跳过，重复调用无副作用。
  _autoColliders(rootGrp) {    this.world.colliders = this.world.colliders.filter(c => !c.auto);   // 重建：清掉上一轮自动碰撞体（旧版圆形→矩形升级）
    if (!rootGrp) return;
    const box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
    const groups = [];
    const collect = o => { for (const c of o.children) { if (c.isObject3D) { groups.push(c); collect(c); } } };
    collect(rootGrp);
    const done = new Set();
    for (const grp of groups) {
      if (done.has(grp.uuid) || !grp.visible) continue;
      let meshes = 0;
      grp.traverse(m => { if (m.isMesh) meshes++; });
      if (meshes < 2) continue;                                  // 单 mesh：地表/小件
      box.setFromObject(grp);
      box.getSize(size); box.getCenter(ctr);
      const maxDim = Math.max(size.x, size.z);
      if (maxDim < 2.2 || maxDim > 30 || size.y < 1.2) continue; // 小件不挡；树林整组/贴地件跳过
      const key = ctr.x.toFixed(1) + ',' + ctr.z.toFixed(1) + ',' + maxDim.toFixed(0);
      if (done.has(key)) continue;
      done.add(key);
      let covered = false;
      for (const c of this.world.colliders) {
        if (c.dead) continue;
        if (c.t === 'c') { if (Math.hypot(ctr.x - c.x, ctr.z - c.z) < (c.r || 0) + 1.4) { covered = true; break; } }
        else {
          const cx = Math.max(c.x1, Math.min(ctr.x, c.x2)), cz = Math.max(c.z1, Math.min(ctr.z, c.z2));
          if (Math.hypot(ctr.x - cx, ctr.z - cz) < 1.4) { covered = true; break; }
        }
      }
      if (covered) continue;
      const ownR = Math.min(4.5, Math.max(0.9, Math.max(size.x, size.z) * 0.38));
      let fx = ctr.x, fz = ctr.z;
      for (const c2 of this.world.colliders) {
        if (c2.dead || c2.auto) continue;
        const r2 = c2.t === 'c' ? Number(c2.r) : 0;
        const cx2 = c2.t === 'c' ? c2.x : (c2.x1 + c2.x2) / 2;
        const cz2 = c2.t === 'c' ? c2.z : (c2.z1 + c2.z2) / 2;
        const dd = Math.hypot(fx - cx2, fz - cz2);
        const minD = r2 + ownR + 0.3;
        if (dd > 0.01 && dd < minD) { fx += (fx - cx2) / dd * (minD - dd); fz += (fz - cz2) / dd * (minD - dd); }
      }
      const dxMv = fx - ctr.x, dzMv = fz - ctr.z;
      if (Math.abs(dxMv) + Math.abs(dzMv) > 0.05) grp.position.set(grp.position.x + dxMv, grp.position.y, grp.position.z + dzMv);
      const hw = size.x / 2, hd = size.z / 2;
      this.world.colliders.push({ t: 'r', x1: +(fx - hw).toFixed(2), x2: +(fx + hw).toFixed(2), z1: +(fz - hd).toFixed(2), z2: +(fz + hd).toFixed(2), auto: true, grp });
    }
  }

  _switchCity(stageIdx) {
    const cur = this.islands[stageIdx];
    if (!cur) return;
    // 轻量占位岛（启动只精建当前关±1）：进城前先补建成精建岛
    const wIsl = (this.world.islands || []).find(w => w.uid === cur.uid);
    if (wIsl && (wIsl.light || !wIsl.full)) {
      const built = this.world.buildIsland(cur);
      if (built && built.grp) {
        if (wIsl.grp) this.scene.remove(wIsl.grp);   // 移除占位岛
        Object.assign(wIsl, built, { light: false, full: true });
      }
    }
    this._buildSigns(cur);
    this._autoColliders(wIsl && wIsl.grp);   // 大件碰撞兜底+推开避让（须在牌子注册后，树才避得开牌子）
    if (this.npcs) this.npcs.spawnForCity(cur, (q, st) => this._clampCityPos(q, st), this.world.colliders, (x, z) => this._groundY(x, z));   // 每座城市重建自己的牌子
    for (const isl of this.world.islands || []) if (isl.grp) isl.grp.visible = isl.uid === cur.uid;
    for (const pt of this.pets.all()) {
      const c2 = this._cityPos(pt.word, cur);
      pt.group.position.set(c2.x, c2.y || 0, c2.z);
      pt.baseY = c2.y || 0;   // 同步站立高度：天空词宠站高台（3.2），不更新会悬浮回 14
      pt.home.set(c2.x, c2.z);
      pt.target.set(c2.x, c2.z);
    }
    // 补建精建岛后城界才可用：本关的蛋重新钳进新城——
    // 上一关通关演出出蛋时新城还是占位岛（无城界），蛋会被圆形兜底甩到城墙外，看得见够不着
    const perchId = this._perchEggId();
    for (const [eid, eg] of this.eggs.eggs) {
      if (!eg.group.visible || !this.currentChapter.words.includes(eid)) continue;
      if (eid === perchId) { this._putEggOnPerch(eg); continue; }   // 高台蛋位固定，不参与分配
      if (eg.word.zone !== 'sky' && this._eggReachable(eg.group.position.x, eg.group.position.z)) continue;   // 城内/牌旁蛋位不动
      const c2 = this._cityPos(eg.word, cur);
      // 用 _freeEggSpot：它带遮挡检查，_eggSpot 只避碰撞体（会把蛋放回道具里）
      const spot = this._freeEggSpot(c2.x, c2.z);
      // y 按地形算：写死 0/3.2 会让普通蛋落进山坡里、天空蛋悬空或埋进石台（"看不到的蛋"）
      const y = eg.word.zone === 'sky' ? this._groundY(spot.x, spot.z) + 3.45 : this._groundY(spot.x, spot.z);
      eg.group.position.set(spot.x, y, spot.z);
      eg.baseY = y;
    }
    const spawn = this._citySpawnPos(cur);   // 城心主地标旁，面朝地标
    this.player.position.set(spawn.x, 0, spawn.z);
    this._clampCityPos(this.player.position, cur);   // 有机轮廓下出生点也可能在海上
    this._collide();   // 同上：出生点撞进牌子/校门碰撞体就立即推出
    this.chinaMap && this.chinaMap.anchor(cur.key, cur.cx, cur.cz);   // 全国地图跟随当前城锚定
    this.onIsle = false;
    this._clearMoveTarget();
    this._syncShareUrl();   // 玩到哪座城，地址栏同步到哪座城
  }

  // 撞到城市边界的气泡提示（节流 5 秒，只有主动移动顶着边界才提示）
  _cityEdgeHint() {
    if (!this._mv || this._mv.lengthSq() <= 0.02) return;
    const now = performance.now() / 1000;
    if (this._edgeHintCd > now) return;
    this._edgeHintCd = now + 5;
    ui.toast(t('x.g334'));
  }
  // ================= 城市牌子系统 =================
  // 大学/美食/风景按方位(bearing)立牌，一块城市几十块；点击牌子弹出详情卡。
  // 牌子与蛋解耦：只有一部分蛋按 seed 放在牌子旁，其余散布全城。
  _hashStr(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  _buildSigns(stage) {
    if (!this.signGroup) { this.signGroup = new THREE.Group(); this.scene.add(this.signGroup); }
    const grp = this.signGroup;
    while (grp.children.length) grp.remove(grp.children[0]);
    this._signEggSpots = [];
    this._usedEggSpots = null;   // 换城重置蛋位占用
    this._placedEggSpots = [];   // 换城重置已放蛋位（_freeEggSpot 用）
    this._signList = [];
    if (!this.cityTour || !stage || !stage.city) return;
    const city = stage.city;
    const DIRS = { N: [0, -1], NE: [0.7, -0.7], E: [1, 0], SE: [0.7, 0.7], S: [0, 1], SW: [-0.7, 0.7], W: [-1, 0], NW: [-0.7, -0.7] };
    const BEARINGS = Object.keys(DIRS);
    const buckets = {};
    const push = (items, type, emoji) => {
      for (const it of items || []) {
        const b = DIRS[it.bearing] ? it.bearing : BEARINGS[this._hashStr(stage.key + it.name || it.zh) % 8];
        (buckets[b] = buckets[b] || []).push({ ...it, type, emoji });
      }
    };
    push(city.unis, 'uni', '🎓');
    push(city.foods, 'food', '🍜');
    push(city.scenes, 'scene', '🏞️');
    const colorOf = { uni: '#7EC4F2', food: '#FFB46B', scene: '#8FD08F' };
    const placedSigns = [];   // 已摆点位：窄方向上多点会钳到同一轮廓线，摆之前先查间距防重叠
    for (const [b, items] of Object.entries(buckets)) {
      const [dx, dz] = DIRS[b];
      const baseAng = Math.atan2(dx, dz);
      const n = items.length;
      items.forEach((it, i) => {
        // 同向大学多于 6 所时整圈均摊 + 内外双环交错，≤6 所沿方位 ±14° 扇形摊开；
        // 旧公式 0.3+i*0.15 封顶 0.9，北京 30 校同向时第 5 所起会全部叠在同一点
        const ang = it.type === 'uni'
          ? (n > 6 ? baseAng + i * (Math.PI * 2 / n)
                   : baseAng + (n > 1 ? (i / (n - 1) - 0.5) * 0.5 : 0))
          : baseAng;
        const rr = it.type === 'uni'
          ? stage.r * (0.42 + (i % 2) * 0.18)
          : stage.r * Math.min(0.92, 0.5 + i * (0.4 / Math.max(1, n - 1)));
        // 有机轮廓下确保牌子在陆地内，并按占地留出墙厚：校门宽（缩后半宽~2.2）比立牌宽，
        // 只钳中心点的话门身会横骑在院墙上
        const margin = this._cityWallMargin(stage, it.type === 'uni' ? 2.6 : 0.6);
        // 钳制后窄处会挤在同一轮廓线上（广州/成都出现过两校门完全重叠）：
        // 逐次扰动方位角±缩半径重摆，直到与已摆的牌子拉开间距（校门 5 / 立牌 2.2）
        const gap = it.type === 'uni' ? 5 : 2.2;
        let x = stage.cx, z = stage.cz, ux = Math.sin(ang), uz = Math.cos(ang);
        for (let t = 0; t < 14; t++) {
          const angT = ang + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 0.14;
          const rrT = rr * (1 - Math.min(0.55, t * 0.055));
          ux = Math.sin(angT); uz = Math.cos(angT);
          const clampP = { x: stage.cx + ux * rrT, z: stage.cz + uz * rrT };
          this._clampCityPos(clampP, stage, margin, margin);   // 静态牌子严格边距
          x = clampP.x; z = clampP.z;
          if (!placedSigns.some(q => Math.hypot(q.x - x, q.z - z) < gap)) break;
        }
        placedSigns.push({ x, z });
        if (it.type === 'uni') {
          // 校门 GLB 换装后新挂进来的 mesh 不带 sign：onSwap 里补打标，否则点校门会 fallthrough 成走过去
          const gate = cityLandmark('uni-gate', colorOf.uni, it.zh || it.name, it.img,
            { onSwap: (g) => g.traverse(o => { o.userData.sign = it; }) });
          gate.position.set(x, this._groundY(x, z), z);   // 微缩地形：校门贴山坡
          gate.rotation.y = Math.atan2(stage.cx - x, stage.cz - z);
          gate.scale.setScalar(0.5);   // 校门同步城市缩 1/2（名牌 sprite 为子对象自动跟随）
          const nm = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._signNameTexture(it.name || it.zh || ''), transparent: true, depthWrite: false,
          }));
          nm.scale.set(4.2, 0.94, 1); nm.position.set(0, 4.6, 0); gate.add(nm);
          nm.userData.keep = true;   // GLB 换装时保留（约定见 js/assets.js：标了 keep 的子件不被清掉）
          gate.traverse(o => { o.userData.sign = it; });   // 缺这个：点校门会 fallthrough 成走过去，玩家卡进碰撞体来回晃
          grp.add(gate);
          this.world.colliders.push({ t: 'c', x: +x.toFixed(2), z: +z.toFixed(2), r: 2.2, fixed: true });   // 校门占位
          this._signList.push({ ...it, x, z });
          const es = { x: x - ux * 1.2 + uz * 0.9, z: z - uz * 1.2 - ux * 0.9 };   // 蛋点偏移随校门缩 1/2
          const esM = this._cityWallMargin(stage, 0.5);
          this._clampCityPos(es, stage, esM, esM);   // 牌旁蛋点也钳进陆地（细长轮廓防落海；静态严格）
          this._signEggSpots.unshift(es);
          return;
        }
        const sign = this._makeSign(it, colorOf[it.type]);
        sign.position.set(x, this._groundY(x, z), z);   // 微缩地形：立牌贴山坡
        sign.rotation.y = Math.atan2(stage.cx - x, stage.cz - z);   // 牌面朝向城中心（纯Y旋转，lookAt会翻滚）
        grp.add(sign);
        this.world.colliders.push({ t: 'c', x: +x.toFixed(2), z: +z.toFixed(2), r: 1.2, fixed: true });   // 立牌占位：树的自动摆放会避开
        sign.scale.setScalar(0.7);   // 立牌同步城市缩放微调
        this._signList.push({ ...it, x, z });
        if (this._signEggSpots.length < 26) {
          const es2 = { x: x - dx * 0.9 + dz * 0.75, z: z - dz * 0.9 - dx * 0.75 };   // 牌子侧后方（偏移同步缩小）
          const esM2 = this._cityWallMargin(stage, 0.5);
          this._clampCityPos(es2, stage, esM2, esM2);   // 蛋不许落在院墙外（静态严格）
          this._signEggSpots.push(es2);
        }
      });
    }
    // 地形打卡点：每城一块金色牌（山顶/湖畔/沙丘/梯田/海角/码头）。
    // 必须放在立牌 forEach 之外——放进循环里会每块普通立牌都插一个（曾出现同点位 14 块牌）。
    this._spotAt = null;
    const sp = stage.terrain && stage.terrain.spot;
    const bnd = sp && this.world.cityBounds && this.world.cityBounds[stage.key];
    const Fld = bnd && bnd.terrainField;
    if (sp && Fld) {
      const w = Fld.P2(sp.at);
      const q = { x: w[0] + bnd.cx, z: w[1] + bnd.cz };
      const mS = this._cityWallMargin(stage, 0.5);
      this._clampCityPos(q, stage, mS, mS);
      const spot2 = this._eggSpot(q.x, q.z);   // 与蛋同一套避让：不嵌进碰撞体/树冠
      const it2 = { name: sp.name, zh: sp.name, en: sp.en, emoji: sp.emoji, type: 'spot' };
      const sg2 = this._makeSign(it2, '#E8C36A');
      sg2.position.set(spot2.x, this._groundY(spot2.x, spot2.z), spot2.z);
      sg2.rotation.y = Math.atan2(stage.cx - spot2.x, stage.cz - spot2.z);
      sg2.scale.setScalar(0.7);
      grp.add(sg2);
      this.world.colliders.push({ t: 'c', x: +spot2.x.toFixed(2), z: +spot2.z.toFixed(2), r: 1.2, fixed: true });
      this._signList.push({ ...it2, x: spot2.x, z: spot2.z });
      this._spotAt = { x: spot2.x, z: spot2.z, r: sp.r || 6, kind: sp.kind, name: sp.name, stars: sp.stars || 3 };
    }
  }

  // 低模立牌：木杆 + 类别色板 + 类别 emoji + 中文名牌（共享材质，几十块开销可控）
  _makeSign(it, color) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xC89A6B, roughness: 0.9 }));
    pole.position.y = 0.75; pole.castShadow = true; g.add(pole);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.8, 0.1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    board.position.y = 1.75; board.castShadow = true; g.add(board);
    const em = new THREE.Sprite(new THREE.SpriteMaterial({
      map: letterTexture(it.emoji || '📍', '#5B4632', '#FFFDF4'), transparent: true, depthWrite: false,
    }));
    em.scale.setScalar(0.6); em.position.set(0, 1.75, 0.1); g.add(em);
    const name = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._signNameTexture(it.name || it.zh || ''), transparent: true, depthWrite: false,
    }));
    name.scale.set(2.6, 0.58, 1); name.position.set(0, 2.55, 0); g.add(name);
    g.traverse(o => { o.userData.sign = it; });
    return g;
  }

  // 牌名高清文字纹理：640×144 横条 canvas，字号自适应（128px 单字拉伸是之前模糊的根因）
  _signNameTexture(text) {
    const W = 640, H = 144;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    let size = 72;
    c.font = `900 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    while (c.measureText(text).width > W - 60 && size > 30) {
      size -= 4;
      c.font = `900 ${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    }
    c.fillStyle = '#FFFDF4';
    c.beginPath();
    if (c.roundRect) c.roundRect(6, 10, W - 12, H - 20, 28); else c.rect(6, 10, W - 12, H - 20);
    c.fill();
    c.strokeStyle = 'rgba(140,110,80,.55)';
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = '#5B4632';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, W / 2, H / 2 + 2, W - 60);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // 坐小火车（主岛火车站触发）：不带参=回当前城，带 key=直达任意已解锁城（跨城喂食/复习）
  _trainToCity(key) {
    if (this.riding || this.mount) return;
    const st = key ? this.islands.find(i => i.key === key) : this._currentStage();
    if (!st) return;
    const from = this.player.position.clone();
    const spawn = this._citySpawnPos(st);
    const to = new THREE.Vector3(spawn.x, 0, spawn.z);
    this._clampCityPos(to, st);   // 凹形城市下落点也可能压墙/出城，钳进城内再发车
    this.riding = true;
    ui.hidePrompt();
    sfx.pop();
    this._trainQuiz(st.key);   // 车上时间别浪费：来一道目的地城市知识题
    this.addTween(3.2, k => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.player.position.lerpVectors(from, to, e);
      this.player.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      if (Math.random() < 0.25) this._puff(0xffffff);
    }, () => {
      this.riding = false;
      this.player.position.copy(to);
      ui.closeTrainQuiz();
      ui.toast(t('x.g335', { a0: st.name, a1: st.emoji }), 3400);
    });
  }

  // 小火车快问快答：目的地城市知识二选一/三选一，答对 +1⭐（选项随机打乱，别让孩子记位置）
  _trainQuiz(key) {
    const quiz = getCityQuiz(key);
    if (!quiz || !quiz.opts || quiz.opts.length < 2) return;
    const order = quiz.opts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    ui.showTrainQuiz({
      q: quiz.q,
      opts: order.map(i => quiz.opts[i]),
      answer: order.indexOf(quiz.a),
      onGood: () => { save.addStars(1); ui.updateStars(save.getStars()); },
    });
  }

  // 顶部城市胶囊 + 重弹介绍卡
  _refreshCityPill() {
    if (!this.cityTour) { ui.setCityPill(null); return; }
    const st = this._currentStage();
    ui.setCityPill(`${st.name} ${st.emoji}`, () => this._openCityIntro());
    this._ensureCityTask(st);
  }
  // 任务推进：命中 kind 就 +1，完成发城市贴纸（集满章）+ 3⭐
  _bumpTask(kind) {
    const st = this._currentStage();
    if (!st || !st.city || !st.city.en) return;
    const r = save.bumpCityTask(kind);
    if (r === 'done') {
      const ct = save.getCityTask();
      save.addStars(3);
      ui.updateStars(save.getStars());
      sfx.great();
      ui.confettiBurst(70);
      ui.toast(t('y.taskDone', { a0: st.name }), 5200);
      if (ct && ct.kind === 'stamp') save.markStampsDone(st.city.en);   // 集章任务完成 = 城市贴纸到手
    } else if (r && r.n) {
      ui.toast(t('y.taskProg', { a0: r.n, a1: r.goal }), 2200);
    }
  }

  // 🎯 进城小任务：本城没集满章就抽一个（集 3 章 / 喂 2 只饿宠 / 读 1 块立牌）
  _ensureCityTask(st) {
    if (!st || !st.city || !st.city.en) return;
    if (save.isStampsDone(st.city.en)) return;   // 集满过这座城就不再发任务
    const ct = save.getCityTask();
    if (ct && ct.city === st.city.en && !ct.done) return;   // 本城任务进行中
    if (ct && ct.city === st.city.en && ct.done) return;     // 本城已完成（换城才重置）
    // 三选一任务池：集章 / 喂食 / 读立牌
    const kinds = [
      { kind: 'stamp', goal: Math.min(3, (st.city.scenes || []).length || 3) },
      { kind: 'feed', goal: 2 },
      { kind: 'sign', goal: 1 },
    ];
    const pick = kinds[Math.floor(Math.random() * kinds.length)];
    save.startCityTask(st.city.en, pick.kind, pick.goal);
    const names = { stamp: t('y.taskStamp', { a0: pick.goal }), feed: t('y.taskFeed', { a0: pick.goal }), sign: t('y.taskSign') }[pick.kind];
    setTimeout(() => ui.toast(`${t('y.taskTitle')} ${names}`, 4600), 2500);
  }
  _openCityIntro() {
    const st = this._currentStage();
    const vkey = this.sem + ':' + st.key;
    const visit = Math.max(0, (save.getSave().cityVisits?.[vkey] || 1) - 1);
    ui.showCityCard({
      city: st.city, variant: cityVariant(st.city, visit), visit, quiz: getCityQuiz(st.key),
      isFinal: st.key === this.cityRouteList[this.cityRouteList.length - 1],
      onStar: () => { save.addStars(1); ui.updateStars(save.getStars()); },
    });
  }

  // 淘气词宠：读错 2 次以上的词隔天变淘气词宠出场，点它读出单词就抓住（错词复习）
  _spawnNaughty() {
    const id = save.pickNaughtyToday();
    if (!id || !save.isHatched(id)) return;
    const pet = this.pets.get(id);
    if (!pet) return;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: letterTexture('😈', '#B28FF5', '#FFF'), transparent: true, depthWrite: false,
    }));
    tag.scale.setScalar(0.5);
    tag.position.y = 1.55;
    pet.group.add(tag);
    this._naughtyId = id;
    this._naughtyTag = tag;
    setTimeout(() => ui.toast(t('y.36', { a0: WORD_MAP[id].en }), 5200), 6000);
  }

  // 📖 错词巡逻：每天把错词本里的词放 1-3 只到街上（头顶 📖 标记），
  // 点它读对一次就 miss-1，连续读对把 miss 清零就"赎罪出狱"移出错词本
  _spawnPatrol() {
    if (this._patrolIds && this._patrolIds.length) return;   // 本场已有巡逻
    const ids = save.naughtyPatrol(3).filter(id => save.isHatched(id) && this.pets.get(id));
    if (!ids.length) { this._patrolIds = []; return; }
    this._patrolIds = ids;
    for (const id of ids) {
      const pet = this.pets.get(id);
      if (!pet) continue;
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture('📖', '#FF9E5E', '#FFF'), transparent: true, depthWrite: false,
      }));
      tag.scale.setScalar(0.5);
      tag.position.y = 1.55;
      pet.group.add(tag);
      this._patrolTags = this._patrolTags || new Map();
      this._patrolTags.set(id, tag);
    }
    if (ids.length) setTimeout(() => ui.toast(t('y.patrol', { n: ids.length }), 4800), 9000);
  }

  // 抓淘气词宠：读出它的名字（60 分以上算抓住），成功 +2⭐
  _catchNaughty(id) {
    const word = WORD_MAP[id];
    if (!word) return;
    this.currentWord = word;
    this._maybePreloadWhisper(); this._warmMic();
    ui.openChallenge({
      word: { en: word.en, zh: word.zh, syl: word.syl, hint: word.hint || t('y.readName') },
      mode: 'practice',
      onSuccess: res => {
        if ((res.score || 0) >= 60) {
          const isPatrol = this._patrolIds && this._patrolIds.includes(id);
          if (isPatrol) {
            // 巡逻：读对一次 miss-1，归零出狱；否则标记摘除（miss>0 明天继续巡逻）
            const left = save.redeemNaughty(id);
            if (this._patrolTags && this._patrolTags.has(id)) {
              const tg = this._patrolTags.get(id);
              tg.parent && tg.parent.remove(tg); this._patrolTags.delete(id);
            }
            this._patrolIds = this._patrolIds.filter(x => x !== id);
            save.addStars(1);
            ui.updateStars(save.getStars());
            sfx.great();
            if (left <= 0) {
              ui.confettiBurst(60);
              ui.toast(t('y.patrolDone', { a0: word.en }), 4200);
              const pt = this.pets.get(id);
              if (pt) this.pets.celebrate(id);
            } else {
              ui.toast(t('y.patrolLeft', { a0: word.en, n: left }), 3600);
            }
          } else {
            save.catchNaughty(id);
            save.addStars(2);
            ui.updateStars(save.getStars());
            if (this._naughtyTag) { this._naughtyTag.parent && this._naughtyTag.parent.remove(this._naughtyTag); this._naughtyTag = null; }
            this._naughtyId = null;
            sfx.great();
            ui.confettiBurst(60);
            ui.toast(t('x.g338', { a0: word.en }), 4200);
            const pt = this.pets.get(id);
            if (pt) this.pets.celebrate(id);
          }
        }
        this.currentWord = null;
      },
      onClose: () => { this.currentWord = null; },
    });
  }

  // 骑词宠：跑得更快、视野更高；飞行词宠驮着飘半空。再触发一次下来
  _ridePet(id) {
    if (this.mount === id) {   // 下骑
      this.mount = null; this.mountPet = null; this.mountFly = false;
      this.player.position.y = this.onIsle ? 14 : 0;
      this.onGround = true; this.vy = 0;
      sfx.pop();
      ui.hidePrompt();
      return;
    }
    const pet = this.pets.get(id);
    if (!pet) return;
    this.mount = id;
    this.mountPet = pet;
    this.mountFly = !!pet.flying;
    this.onGround = true; this.vy = 0; this.jumps = 0;
    sfx.boing();
    this._petEmoji(pet, '😍');
    ui.toast(t('y.ride', { a0: pet.word.en, a1: this.mountFly ? t('y.37') : t('y.38') }), 3000);
  }

  // 接触阴影：玩家 + 牧场词宠（+ 骑乘中的词宠）。贴地跟随、离地越高越大越淡。
  // 挂在 scene 上而不是实体子节点上 —— 词宠本身是悬浮的，阴影必须贴地面。
  _updateContactShadows() {
    if (this.isTouch) return;   // 触屏省这点开销（与 SMAA/环境反射同一个降级判据）
    const scene = this.scene;
    const one = (obj, radius, x, z, lift) => {
      if (!obj.userData.cshadow) {
        const m = contactShadow(radius);
        scene.add(m);
        obj.userData.cshadow = m;
      }
      updateContactShadow(obj.userData.cshadow, x, z, this._groundY(x, z), lift);
    };
    const pp = this.player && this.player.position;
    if (pp) one(this.player, 0.44, pp.x, pp.z, Math.max(0, pp.y - this._groundY(pp.x, pp.z)));
    for (const p of this._ranchPets || []) {
      const g = p.group;
      one(g, 0.3, g.position.x, g.position.z, Math.max(0, g.position.y - this._groundY(g.position.x, g.position.z)));
    }
  }

  _updatePlayer(dt) {
    if (this.lockInput || this.climbing || this.riding) return;
    const move = this._mv = this._mv || new THREE.Vector3();
    move.set(0, 0, 0);
    // 键盘/摇杆方向是“相对镜头”的；点击移动是“世界坐标直线”，不随镜头转
    let cameraRelative = true;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.x += 1;
    // 虚拟摇杆（手机）
    if (this.joy.active) { move.x += this.joy.x; move.z += this.joy.y; }
    // 键盘/摇杆接管时取消点击移动
    if (move.lengthSq() > 0 && this.moveTarget) this._clearMoveTarget();
    // 点击移动：没有手动输入时，沿直线朝点击的地点走
    if (move.lengthSq() === 0 && this.moveTarget) {
      const dx = this.moveTarget.x - this.player.position.x;
      const dz = this.moveTarget.z - this.player.position.z;
      const d = Math.hypot(dx, dz);
      // 去孵蛋的路：进入互动半径就停下开蛋，不用非走到蛋的正中心
      if (d < 0.4 || (this.moveThenEgg && d < 2.4) || (this.moveThenInteract && d < 2.4)) {
        const eggId = this.moveThenEgg;
        const egg = eggId && this.eggs.get(eggId);
        this._clearMoveTarget();
        if (egg) {
          const ep = egg.group.position;
          if (Math.hypot(ep.x - this.player.position.x, ep.z - this.player.position.z) <= 2.6 && ep.y - this.player.position.y <= 1.2) this._openEgg(eggId);
          else ui.toast(t('x.g340'), 3200);
        } else if (this.moveThenInteract) {
          const iid = this.moveThenInteract;
          this.moveThenInteract = null;
          if (save.isHungry(iid)) this._feedPet(iid);
          else if (iid === this._naughtyId || (this._patrolIds && this._patrolIds.includes(iid))) this._catchNaughty(iid);
        }
      } else {
        cameraRelative = false;
        move.x = dx / d; move.z = dz / d;
        // 被障碍卡住（想走但走不动）一小会儿就放弃，别顶着墙抖
        const step = Math.hypot(
          this.player.position.x - (this._lastStepX ?? this.player.position.x),
          this.player.position.z - (this._lastStepZ ?? this.player.position.z));
        this._stuckT = step < PLAYER_SPEED * dt * 0.3 ? (this._stuckT || 0) + dt : 0;
        if (this._stuckT > 0.7) { this._clearMoveTarget(); move.set(0, 0, 0); }
        this._lastStepX = this.player.position.x;
        this._lastStepZ = this.player.position.z;
      }
    }
    const moving = move.lengthSq() > 0;
    // 移动基准锁存：相机相对的移动若每帧跟着 camYaw 转，会与"镜头跟随"形成反馈环
    // （按住 A/D 侧走时偏差恒为 π/2 → 镜头无限旋转，死区也挡不住）。
    // 所以开始走时锁定当时的 camYaw，期间方向不变；停下解除；拖拽镜头时重新锁定（拖=转向）。
    if (moving && !this._wasMoving) this._moveBasisYaw = this.camYaw;
    if (!moving) this._moveBasisYaw = null;
    this._wasMoving = moving;
    // 空中保留操控且带一点冲劲：方向键+空格 = 向前跳；骑词宠快 60%
    if (this.sprinting && performance.now() > this._sprintUntil) this.sprinting = false;
    const speed = PLAYER_SPEED * (this.mount ? 1.6 : 1) * (this.onGround ? 1 : 1.38) * (this.sprinting ? 1.55 : 1);
    // 沙丘滑行：下坡顺势加速、上坡吃力（按配色判定沙色城市）
    let speed2 = speed;
    if (moving && this.onGround && this._isDune()) {
      const gAhead = this._groundY(this.player.position.x + move.x * 1.2, this.player.position.z + move.z * 1.2);
      const gHere = this._groundY(this.player.position.x, this.player.position.z);
      const slope = gAhead - gHere;
      speed2 = speed * (slope < -0.05 ? 1.35 : (slope > 0.05 ? 0.8 : 1));
    }
    if (moving) speed2 = speed2;
    if (moving) {
      if (cameraRelative) {
        // 绕 Y 轴转 camYaw（等价于原 applyAxisAngle，不建临时对象）
        const basis = this._moveBasisYaw != null ? this._moveBasisYaw : this.camYaw;
        const s = Math.sin(basis), c = Math.cos(basis);
        const mx = move.x * c + move.z * s, mz = move.z * c - move.x * s;
        move.x = mx; move.z = mz;
      }
      // 涉水阻挡：水面（河带/湖椭圆）不能走进去，退回原处并提示一次
      const _px0 = this.player.position.x, _pz0 = this.player.position.z;
      this.player.position.x += move.x * speed2 * dt;
      this.player.position.z += move.z * speed2 * dt;
      if (this.onGround && this._waterAt(this.player.position.x, this.player.position.z) > 0.55) {
        this.player.position.x = _px0; this.player.position.z = _pz0;
        this._waterHint = (this._waterHint || 0) - dt;
        if (this._waterHint <= 0) { this._waterHint = 3.5; ui.toast(t("g.waterEdge"), 1600); }
      }
      const targetYaw = Math.atan2(move.x, move.z);
      let dy = targetYaw - this.player.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.player.rotation.y += dy * Math.min(1, dt * 12);
      // 镜头跟随（可选）：小人转身时镜头平滑转到背后。
      // 60° 死区是关键：不加的话"镜头转→前进方向跟着转→小人转→镜头再转"会互相追着转成圈。
      // 只在走路时跟；骑词宠/演出/看远景(缩放>45)/刚拖过镜头都不跟。
      if (save.getCamFollow() && !this._camHold && !this.mount && this.camDistTarget <= 45) {
        let dc = this.player.rotation.y - this.camYaw;
        while (dc > Math.PI) dc -= Math.PI * 2;
        while (dc < -Math.PI) dc += Math.PI * 2;
        const a = Math.abs(dc);
        // 滞回：>60° 才开始跟，跟到 <7° 才停。只用死区的话镜头会永远停在死区边缘
        // （实测收敛到差 1.01 rad ≈ 58°，看起来就像"跟随没生效"）。
        if (a > 1.05) this._camFollowing = true;
        else if (a < 0.12) this._camFollowing = false;
        if (this._camFollowing) this.camYaw += dc * Math.min(1, dt * 1.6);   // ≈1 秒到位
      }
      this.walkT += dt * 9;
      // 雪线以上留脚印：短生命期贴片，走一步留一个（间隔 0.28s）
      if (this.onGround && this._onSnow(this.player.position.x, this.player.position.z)) {
        this._fpT = (this._fpT || 0) + dt;
        if (this._fpT > 0.28) { this._fpT = 0; this._footprint(); }
      }
    } else this.walkT += dt * 1.5;
    // 跳跃物理：support = 脚下最高的支撑面（地面或跳跳石台面）
    const pp = this.player.position;
    // 骑词宠：贴在词宠背上（飞行词宠驮着飘），接管高度、不参与跳跃物理
    if (this.mount && this.mountPet) {
      const base = this.mountFly ? 1.6 : 0.72;
      pp.y = (this.onIsle ? 14 : 0) + base + Math.sin(performance.now() / 280) * (this.mountFly ? 0.14 : 0.045);
      this.mountPet.group.position.set(
        pp.x - Math.sin(this.player.rotation.y) * 0.15,
        pp.y - base + (this.mountFly ? 0.1 : 0.06),
        pp.z - Math.cos(this.player.rotation.y) * 0.15
      );
      this.mountPet.group.rotation.y = this.player.rotation.y;
      this.onGround = true; this.vy = 0; this.jumps = 0;
      this._collide();   // 骑乘也要撞墙/挡河/挡海：没有这行骑着词宠能穿墙进水
      return;
    }
    const support = this._supportAt(pp.x, pp.z);
    if (!this.onGround) {
      this.vy -= 20 * dt;
      this.player.position.y += this.vy * dt;
      if (this.vy <= 0 && this.player.position.y <= support + 0.04) {
        this.player.position.y = support;
        const pf = this._platformAt(pp.x, pp.z);
        if (pf && pf.bounce) {
          // 弹跳蘑菇：啵咿茵——弹得比跳还高，二段跳还能接着耍
          this.onGround = false;
          this.vy = 12.5;
          this.jumps = 1;
          sfx.boing();
          this._puff();
        } else {
          this.onGround = true;
          this.vy = 0;
          this.jumps = 0;
          // 落地一压，Q 弹一下
          this.player.scale.set(1.12, 0.8, 1.12);
          this.addTween(0.2, k => {
            this.player.scale.set(1.12 - k * 0.12, 0.8 + k * 0.2, 1.12 - k * 0.12);
          }, () => this.player.scale.set(1, 1, 1));
        }
      }
    } else if (this.player.position.y > support + 0.06) {
      this.onGround = false;   // 走出石头边缘：脚下没支撑了，开始下落
      this.vy = 0;
    } else {
      this.player.position.y = support;
    }
    // 顶泡泡词球：跳起来头碰到泡泡 → 顶破并弹出该词的朗读挑战
    if (this.vy > 0 && this._event.active && this._event.active.id === 'bubbles') {
      const headY2 = pp.y + 1.25;
      for (let i = (this._event.bubbles || []).length - 1; i >= 0; i--) {
        const bb = this._event.bubbles[i];
        const by = bb.group.position.y;
        if (Math.hypot(pp.x - bb.group.position.x, pp.z - bb.group.position.z) > 0.95) continue;
        if (headY2 < by - 0.35 || headY2 > by + 0.5) continue;
        this.vy = -1;
        this._popBubble(bb);
        break;
      }
    }
    // 顶砖块：上升时头碰到悬浮砖底 → 顶爆它（藏在里面的蛋会掉下来）
    if (this.vy > 0) {
      const headY = pp.y + 1.25;
      for (const b of this.world.brickSpots || []) {
        if (b.used) continue;
        if (Math.hypot(pp.x - b.x, pp.z - b.z) <= 0.95 && headY >= b.bottom && headY <= b.bottom + 0.5) {
          this.vy = -1.2;
          this._bumpBrick(b);
          break;
        }
      }
    }
    // 摆动：空中定格成张开的姿势；骑乘时收腿夹住词宠、手臂扶"把手"（跑起来词宠轻轻颠）
    if (this.mount && this.mountPet) {
      const bob = Math.abs(Math.sin(performance.now() / 280)) * (moving ? 0.06 : 0.015);
      this.playerParts.legL.rotation.x = -1.05; this.playerParts.legR.rotation.x = -1.05;
      this.playerParts.armL.rotation.x = -0.85; this.playerParts.armR.rotation.x = -0.85;
      this.playerParts.body.position.y = 0.3 - bob;
    } else {
      const sw = this.onGround ? Math.sin(this.walkT) * (moving ? 0.55 : 0.06) : 0.8;
      this.playerParts.legL.rotation.x = sw;
      this.playerParts.legR.rotation.x = this.onGround ? -sw : -0.35;
      this.playerParts.armL.rotation.x = -sw * 0.8;
      this.playerParts.armR.rotation.x = sw * 0.8;
      // 待机呼吸：静止时叠加一个更慢、幅度更大的起伏（0.014），让主角"活着"；
      // 走动时交给步态起伏（0.03），不叠加 —— 两个频率一起动会显得发抖
      const idleNow = !moving && this.onGround;
      this._breatheT += dt * (idleNow ? 1.6 : 0);
      const breathe = idleNow ? Math.sin(this._breatheT) * 0.014 : 0;
      this.playerParts.body.position.y = 0.3 + Math.abs(Math.sin(this.walkT)) * (moving && this.onGround ? 0.03 : 0.008) + breathe;
    }

    this._collide();
    // 跑步扬起小尘土
    if (moving && this.onGround) {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.22;
        // 沿河浅滩跑起来溅水花，其他地方扬小尘土
        this._puff(Math.abs(pp.z) < 6.3 && Math.abs(pp.z) > 3.6 ? 0xa8d8f0 : 0xffffff);
      }
    }
    // 星星魔法棒：走路撒星星
    if (this.playerParts.wandTip) {
      this.sparkT -= dt;
      if (moving && this.onGround && this.sparkT <= 0) {
        this.sparkT = 0.16;
        const wp = this._wp = this._wp || new THREE.Vector3();
        this.playerParts.wandTip.getWorldPosition(wp);
        this._sparkle(wp);
      }
    }
    // 天空岛逻辑
    if (this.onIsle) {
      if (this.onGround) this.player.position.y = 14;
      const d = Math.hypot(this.player.position.x - ISLE_CENTER.x, this.player.position.z - ISLE_CENTER.z);
      if (d > 5.1 && !this.climbing) this._climb(false); // 走出边缘 → 滑下去
    }
  }

  // 顶破泡泡：弹出这个单词的朗读挑战，念对 +1⭐
  _popBubble(bb) {
    sfx.pop();
    this._letterBurst(bb.group.position.clone(), bb.word.en);
    this.scene.remove(bb.group);
    this._event.bubbles = this._event.bubbles.filter(x => x !== bb);
    const w = bb.word;
    ui.openChallenge({
      word: w, mode: 'hatch',
      onSuccess: () => {
        ui.closeChallenge();
        save.addStars(1);
        ui.updateStars(save.getStars());
        ui.floatPlusOne(innerWidth / 2, innerHeight / 2 - 70, '+1⭐');
        ui.toast(t('y.39', { a0: w.en, a1: w.zh }), 3000);
        sfx.magic();
      },
      onClose: () => {},
    });
  }

  // 顶砖：砖块上顶晃动；第一次顶出藏在里面的词宠蛋，蛋掉到地上等小朋友去孵
  _bumpBrick(b) {
    const baseY = b.top - 0.31;
    sfx.pop();
    this.addTween(0.32, k => { b.mesh.position.y = baseY + Math.sin(k * Math.PI) * 0.22; });
    if (b.used) { sfx.miss(); return; }
    b.used = true;
    b.mesh.material.color.set('#9C8A72');   // 顶过的砖变成旧砖色
    if (b.q) b.q.visible = false;
    const id = b.eggId;
    if (!id) { sfx.miss(); return; }
    const w = WORD_MAP[id];
    const egg = this.eggs.spawnEgg(w, false, false);
    egg.baseY = b.top;
    egg.group.position.set(b.x, b.top, b.z);
    ui.toast(t('y.40', { a0: w.en }), 3600);
    this.addTween(0.5, k => { egg.baseY = b.top * (1 - k * k); }, () => {
      egg.baseY = this._groundY(b.x, b.z);   // 微缩地形：机关蛋落回坡面而不是 y=0
      sfx.good();
      this._puff(0xbfe3f5);
    });
  }

  // 脚下所在的平台（最高的那个），没有则 null
  _platformAt(x, z) {
    if (this.onIsle) return null;
    let best = null;
    const y = this.player.position.y;
    for (const pf of this.world.platforms || []) {
      if (Math.hypot(x - pf.x, z - pf.z) <= pf.r + 0.15 && pf.top <= y + 0.3) {
        if (!best || pf.top > best.top) best = pf;
      }
    }
    return best;
  }

  // 脚下支撑面高度：地面（0 / 天空岛 14 / 城市微缩地形）或位置重合、台面不高于脚边太多的跳跳石
  _supportAt(x, z) {
    let top = this.onIsle ? 14 : 0;
    if (!this.onIsle) {
      top = Math.max(top, this._groundY(x, z));   // 城市分层地形：台地/山坡可行走（走出边缘自然下落）
      const y = this.player.position.y;
      for (const pf of this.world.platforms || []) {
        if (Math.hypot(x - pf.x, z - pf.z) <= pf.r + 0.15 && pf.top <= y + 0.3 && pf.top > top) top = pf.top;
      }
    }
    return top;
  }

  // 当前城市地形高度（无地形配置的城市恒为 0）：world.cityBounds[key].terrainHeight 由 world.js 挂载
  _groundY(x, z) {
    const st = this._currentStage();
    const b = this.world.cityBounds && this.world.cityBounds[st.key];
    return (b && b.terrainHeight) ? b.terrainHeight(x, z) : 0;
  }

  /* ================= 地形玩法：涉水 / 沙丘滑行 / 雪线脚印 / 山上视野 / 梯田采集 =================
     高度场取 world.cityBounds[key].terrainField（js/terrain-field.js 的同一份数值）——
     渲染、寻高、判定同源，不会出现"看着是水、判定是地"。没有地形配置的城市这些效果自动关闭。 */
  _fieldAt() {
    const st = this._currentStage();
    const b = this.world.cityBounds && this.world.cityBounds[st.key];
    if (!b || !b.terrainField) return null;
    return { F: b.terrainField, cx: b.cx, cz: b.cz };
  }
  _waterAt(x, z) {
    const f = this._fieldAt();
    return f ? f.F.waterAt(x - f.cx, z - f.cz) : 0;
  }
  // 沙色城市（敦煌/三亚…）按配色判定，不用再加一份数据：沙色带 R 高、B 低
  _isDune() {
    const f = this._fieldAt();
    if (!f) return false;
    const g0 = (f.F.features.greens || [])[0];
    return !!g0 && g0[0] > 0.82 && g0[2] < 0.62;
  }
  // 雪线以上的地面：留脚印
  _onSnow(x, z) {
    const f = this._fieldAt();
    if (!f) return false;
    const sr = f.F.features.snowRange;
    if (!sr || sr[0] > 90) return false;
    return this._groundY(x, z) >= sr[0];
  }
  // 梯田区内的采集点
  _terraceAt(x, z) {
    const f = this._fieldAt();
    if (!f) return null;
    const T = f.F.features.terrace;
    if (!T) return null;
    const nx = (x - f.cx - T.c[0]) / T.rx, nz = (z - f.cz - T.c[1]) / T.rz;
    return Math.max(Math.abs(nx), Math.abs(nz)) < 0.75 ? T : null;
  }
  // 脚印：短生命期贴片，复用 fx 队列（有寿命、自动回收）
  _footprint() {
    const p = this.player.position;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0xd8e6f2, transparent: true, depthWrite: false }));
    s.position.set(p.x, this._groundY(p.x, p.z) + 0.05, p.z);
    s.scale.set(0.26, 0.16, 1);
    this.scene.add(s);
    this.fx.push({ obj: s, t: 0, dur: 1.6, update: (t) => { s.material.opacity = Math.max(0, 0.5 * (1 - t / 1.6)); } });
  }


  // 脚下的小尘土
  _puff(color = 0xffffff) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, depthWrite: false }));
    s.position.copy(this.player.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.12, (Math.random() - 0.5) * 0.3));
    s.scale.setScalar(0.26);
    this.scene.add(s);
    this.fx.push({
      obj: s, t: 0, dur: 0.55,
      update: (t, dt) => { s.position.y += dt * 0.5; s.scale.setScalar(0.26 + t * 0.5); s.material.opacity = Math.max(0, 1 - t / 0.55) * 0.75; },
    });
  }

  // 魔法棒的小星星
  _sparkle(pos) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: letterTexture('✦', '#FFE24E', '#FFFDF0'), transparent: true, depthWrite: false,
    }));
    s.position.copy(pos);
    s.scale.setScalar(0.14);
    this.scene.add(s);
    this.fx.push({
      obj: s, t: 0, dur: 0.7,
      update: (t, dt) => { s.position.y += dt * 0.8; s.material.rotation += dt * 6; s.material.opacity = Math.max(0, 1 - t / 0.7); },
    });
  }

  // 城市院墙内缩量：墙半厚 1.0（world.js 直墙 THICK/2，墙心在轮廓线上向内凸）+ 玩家半径 0.42。
  // 人能贴着墙站（间距≈0），旧公式 max(1.2, r*0.035)+extra 会把玩家隔在 2~3 个身位外（看着就别扭）。
  // extra>0.5 的调用（高台蛋/立牌）语义不变：比玩家贴墙线更靠内。
  _cityWallMargin(st, extra = 0.5) {
    return 1.42 + Math.max(0, extra - 0.5);
  }
  // 把世界坐标点钳回当前城市多边形内，并保证离院墙内壁至少 margin（默认=玩家半径）；
  // floor 是窄颈放宽下限（city-shape.clampPoly）：细颈里挤不出 margin 时只保证 floor，
  // 小人/词宠/NPC 这些「要走路的」贴着墙缝也要过得去，不再被甩向城心（floor=margin 即严格）。
  // 返回是否发生了钳制。城市边界的唯一裁判：玩家/NPC/蛋/立牌全走这里，边界永远一致
  _clampCityPos(p, st = this._currentStage(), margin = this._cityWallMargin(st), floor = 0.5) {
    const b = this.world.cityBounds && this.world.cityBounds[st.key];
    if (!b) {   // 兜底：圆形钳制
      const dx = p.x - st.cx, dz = p.z - st.cz;
      const d = Math.hypot(dx, dz), max = Math.max(1, st.r - margin);
      if (d > max) { p.x = st.cx + dx / d * max; p.z = st.cz + dz / d * max; return true; }
      return false;
    }
    const lx = p.x - st.cx, lz = p.z - st.cz;
    // 快速通道：简化轮廓（DP 公差 2.5，Hausdorff 距离有界）离边界都还有
    // margin+2.5 远的话，精确距离必然 ≥ margin，直接免钳——
    // 每帧 玩家+词宠+NPC 数十次钳制，绝大多数都走这条 O(粗轮廓) 的近路
    if (b.coarse) {
      const q = polyNearest(b.coarse, lx, lz);
      if (q.d >= margin + 2.5 && polyInside(b.sim || b.pts, lx, lz)) return false;
    }
    // 简化轮廓（≤0.1 误差，边距 ≥1.2 下无感）：贴边时的精确钳制
    const [nx, nz] = clampPoly(b.sim || b.pts, lx, lz, margin, floor);
    p.x = st.cx + nx; p.z = st.cz + nz;
    return Math.abs(nx - lx) > 1e-6 || Math.abs(nz - lz) > 1e-6;
  }

  _collide() {
    // 纯城市链条：把玩家关在当前城市多边形内（岛外是大海，掉下去就坏了）
    if (this.cityTour) {
      if (this._clampCityPos(this.player.position)) this._cityEdgeHint();
    }
    const p = this.player.position;
    const R = 0.42;
    const trying = this._mv && this._mv.lengthSq() > 0.02;   // 正在主动移动才提示
    let bump = null;
    // 世界边界：玩家只能待在陆地（主岛或某座海岛）上，海面过不去
    const isl = this._islandAt(p);
    if (!this.onIsle) {
      if (isl) {
        const dc = Math.hypot(p.x - isl.cx, p.z - isl.cz);
        if (dc > isl.r - 0.4) {
          const k = (isl.r - 0.4) / dc;
          p.x = isl.cx + (p.x - isl.cx) * k;
          p.z = isl.cz + (p.z - isl.cz) * k;
          if (trying) bump = 'sea';   // 岛边就是海
        }
      } else {
        const dc = Math.hypot(p.x, p.z);
        if (dc > WORLD_R) {
          p.x *= WORLD_R / dc; p.z *= WORLD_R / dc;
          if (trying) bump = 'sea';
        }
      }
    }
    // 河流（碰撞带 3.8 贴着水面视觉边缘 3.5，站岸滩上不再有"明明是地面却被推"的错愕感）
    // 只对主岛生效：外圈海岛跨在 z=0 一带的横置岛（沙洲）不该被"虚拟河流"推回，否则成死局
    if (!this.onIsle && !isl && Math.abs(p.x) < 34 && Math.abs(p.z) < 3.8) {
      const canCross = save.hasGate('boat') && Math.abs(p.x) < 2.0;
      if (!canCross) {
        p.z = p.z >= 0 ? 3.8 : -3.8;
        // 只有"明确朝河走"才提示：沿岸蹭边被推开是常事，弹"挡住去路"只会让孩子看着脚下的平地发懵
        const towardRiver = !!(this._mv && Math.abs(this._mv.z) >= Math.abs(this._mv.x)
          && Math.sign(this._mv.z) === (p.z >= 0 ? -1 : 1));
        if (towardRiver && this.riverHintCd <= 0) {
          this.riverHintCd = 6;
          // 目标在河对岸（或就在码头过河点）才喊"挡路"；目标在同侧时孩子明明能走过去，说了只会误导
          const t = this._objective().target;
          const across = !t || Math.abs(t.z) < 3.8 || Math.sign(t.z) !== Math.sign(p.z);
          const nearDock = Math.abs(p.x) < 8;   // 码头边的交互提示条已在引导，别用 toast 重复念叨
          if (across && !nearDock) {
            if (save.isHatched('boat')) ui.toast(t('x.g349'));
            else ui.toast(t('x.g350'));
          }
        }
      }
    }
    // 圆形与矩形碰撞体
    // 拉远视图（>45，全国/片区视角）时禁用建筑碰撞：远处视角下碰撞体 = 空气墙，
    // 点了被建筑挡住的位置会一直被推出，孩子会以为地图坏了。拉远时只留世界边界与河流。
    const farView = this.camDistTarget > 45;
    let hit = false;   // 本帧有推出动作（配合卡死逃逸：目标点在障碍里就走不进去）
    if (!farView) for (const c of this.world.colliders) {
      if (c.dead) continue;                                   // 机关已开，碰撞体作废
      if (c.top !== undefined) {
        // 有台面高度的物件：站上台面不挡；悬空物件（云、天空岛）从底下走过也不挡
        if (p.y > c.top - 0.25) continue;
        if (p.y + 1.3 <= (c.bottom || 0)) continue;
      }
      if (c.t === 'c') {
        const dx = p.x - c.x, dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d < c.r + R) {
          if (d > 0.001) {
            p.x = c.x + dx / d * (c.r + R);
            p.z = c.z + dz / d * (c.r + R);
          } else {
            // 正好压在圆心（到达点与障碍重合）：径向无方向，往南推出来
            p.x = c.x; p.z = c.z + c.r + R;
          }
          hit = true;
          if (trying && !(c.top !== undefined && p.y > c.top - 0.25)) bump = bump || (c.top !== undefined && c.top <= 0.9 ? 'rail' : c.r >= 1.5 ? 'wall' : null);
        }
      } else {
        const cx = THREE.MathUtils.clamp(p.x, c.x1, c.x2);
        const cz = THREE.MathUtils.clamp(p.z, c.z1, c.z2);
        const dx = p.x - cx, dz = p.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < R) {
          if (d > 0.001) { p.x = cx + dx / d * R; p.z = cz + dz / d * R; }
          else p.z = c.z2 + R; // 正好在矩形内，往南推
          hit = true;
          if (trying) bump = bump || (c.top !== undefined && c.top <= 0.9 ? 'rail' : 'wall');
        }
      }
    }
    // 卡死逃逸：主动移动中被连续推出 0.8 秒 = 目标点在障碍里（老版点击校门的晃动根源），放弃这步
    if (hit && trying) {
      this._stuckN = (this._stuckN || 0) + 1;
      if (this._stuckN > 48) { this._clearMoveTarget(); this._stuckN = 0; }
    } else if (!hit) {
      this._stuckN = 0;
    }
    if (bump) this._showBumpHint(bump);
  }

  _updateCamera(dt) {
    if (this._camHold > 0) this._camHold = Math.max(0, this._camHold - dt);   // 拖过镜头的暂停计时
    // PERFECT 时的镜头微震：幅度指数衰减，不干扰操作
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = this.shakeT * this.shakeT * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k * 0.6;
    }
    // 镜头动画（通关后飞向新一关蛋区）接管期间：轨道机位公式不覆盖 tween 的机位
    if (this.cinematic) return;
    this.camDist += (this.camDistTarget - this.camDist) * Math.min(1, dt * 7);   // 缩放丝滑过渡
    // 山上视野更远：镜头距离随脚下高度增加（每米 +0.6，上限 +18），下山自动收回
    this._viewBoost = (this._viewBoost || 0) + ((this.onIsle ? 0 : Math.min(18, this.player.position.y * 0.6)) - (this._viewBoost || 0)) * Math.min(1, dt * 2);
    const target = this.player.position;
    // 复用临时向量：相机每帧跑 60 次，不能每次都 new（GC 卡顿元凶）
    const v = this._cv = this._cv || new THREE.Vector3();
    // 遮挡检测：人到大件（沙丘/岩石/谷仓…）之间被挡住就把镜头拉近，
    // 不然镜头埋进大件里，整个画面被糊住，看着像小人钻进了图形
    this._occT = (this._occT || 0) - dt;
    if (this._occT <= 0) {
      this._occT = 0.15;   // 每 0.15 秒检测一次就够，别每帧射
      // 关键：用"未受遮挡修正"的全距理想机位做检测。若用带 _occSmooth 的机位，
      // 修正量会改变射线 → 命中状态随之翻转 → 修正量再变……自激振荡（画面不断晃动）。
      const cp0 = Math.cos(this.camPitch);
      const vo = this._occVo = (this._occVo || new THREE.Vector3());
      vo.set(
        target.x + Math.sin(this.camYaw) * cp0 * this.camDist,
        target.y + Math.sin(this.camPitch) * this.camDist + 1.6,
        target.z + Math.cos(this.camYaw) * cp0 * this.camDist
      );
      if (!this.onIsle && vo.y < 1.2) vo.y = 1.2;
      // 抗抖滞回：射线擦着建筑边/路过的小宠会瞬时命中又脱靶，镜头因此反复抽动。
      // 瞬时变低忽略，连续两次读到低值才拉近；变清晰立即松开（慢速恢复由下方 occSmooth 插值负责）。
      const raw = this._occlusionK(target, vo) ?? 1;
      const cur = this._occK === undefined ? 1 : this._occK;
      if (raw < cur - 0.04) {
        this._occLowN = (this._occLowN || 0) + 1;
        if (this._occLowN >= 2) this._occK = raw;
      } else {
        this._occLowN = 0;
        if (raw > cur) this._occK = raw;
      }
    }
    if (this._occK === undefined) this._occK = 1;
    // 拉近要快（立刻不被挡），放远要慢（走开后再缓缓回到正常距离）
    const want = this._occK < (this._occSmooth || 1) ? this._occK : Math.min(1, (this._occSmooth || 1) + dt * 1.2);
    this._occSmooth = this._occSmooth === undefined ? want : this._occSmooth + (want - this._occSmooth) * Math.min(1, dt * 10);
    const dist = (this.camDist + (this._viewBoost || 0)) * this._occSmooth;
    const cp = Math.cos(this.camPitch);
    v.set(
      target.x + Math.sin(this.camYaw) * cp * dist,
      target.y + Math.sin(this.camPitch) * dist + 1.6,
      target.z + Math.cos(this.camYaw) * cp * dist
    );
    if (!this.onIsle && v.y < 1.2) v.y = 1.2;
    // 雾距离跟着镜头远近走（×2/×4 斜率：拉远到 550 也能看清 2000+ 单位外的全国地图背景）
    if (this.scene.fog) {
      // 雾距必须跟着"城尺度"走：城市是 radius×(3+…)×0.84 的大图（成都半宽≈86、整图≈170），
      // 老的 34+2d 在默认玩法机位只有 51 → 城对面（~172）吃雾 ~97%，整片被拉进近白雾色 = "发白看不清"
      const fogR = (this._currentStage() && this._currentStage().r) || 52;
      this.scene.fog.near = Math.max(fogR * 1.35, 34 + dist * 2);
      this.scene.fog.far = Math.max(fogR * 5.0, 142 + dist * 4);
    }
    this.camera.position.lerp(v, Math.min(1, dt * 7));
    this.camera.lookAt(target.x, target.y + 0.88, target.z);   // 0.88：低角度下主体落在画面中偏上
    // 天空穹顶水平跟随镜头（穹顶半径大于缩放上限，相机永远在球内，地平线不偏）
    const dnDome = this.world.anim.dayNight && this.world.anim.dayNight.dome;
    if (dnDome) dnDome.position.set(v.x, 0, v.z);
    // 日月光晕随拉远渐隐：sprite 屏幕大小不随距离缩，拉远后会变成罩住地图的巨大光圈
    const dn = this.world.anim.dayNight;
    if (dn && (dn.sunCore || dn.moon)) {
      const fade = Math.max(0, Math.min(1, (140 - dist) / 80));   // ≤60 全显、≥140 全隐（原先到 300 都全亮 = 大光球罩着地图）
      dn.sunFade = fade;   // 昼夜那一趟也按它决定显隐，否则每 12 分钟会把太阳"叫回来"
      if (dn.sunCore) { dn.sunCore.material.opacity = fade; dn.sunCore.visible = fade > 0.01; }
      if (dn.sunHalo) { dn.sunHalo.material.opacity = fade * 0.35; dn.sunHalo.visible = fade > 0.01; }
      if (dn.moon) { dn.moon.material.opacity = fade; dn.moon.visible = fade > 0.01; }
    }
  }

  // 从小人头顶向理想镜头位置打一条射线，返回允许的镜头距离系数（被挡=拉近）
  _occlusionK(target, camPos) {
    if (!this._occluders) {
      // 收集一次世界大件：大网格才可能挡镜头，小件（花花草草）不用管
      this._occluders = [];
      this.scene.traverse(o => {
        if (!o.isMesh || o.userData.noOcclude) return;
        o.geometry.computeBoundingSphere();
        const s = Math.max(o.scale.x, o.scale.y, o.scale.z, 1);
        if (o.geometry.boundingSphere.radius * s >= 1.8) this._occluders.push(o);
      });
    }
    const from = this._occFrom = (this._occFrom || new THREE.Vector3());
    from.set(target.x, target.y + 1.1, target.z);
    const dir = this._occDir = (this._occDir || new THREE.Vector3());
    dir.copy(camPos).sub(from);
    const len = dir.length();
    if (len < 0.5) return 1;
    dir.divideScalar(len);
    const ray = this._occRay = (this._occRay || new THREE.Raycaster());
    ray.set(from, dir);
    ray.far = len;
    const hits = ray.intersectObjects(this._occluders, false);
    for (const h of hits) {
      // 机关开门后大件会隐藏（沙墙散开），隐形的不再算遮挡
      let o = h.object, hidden = false;
      while (o) { if (o.visible === false) { hidden = true; break; } o = o.parent; }
      if (!hidden) return Math.max(0.22, (h.distance - 0.4) / len);
    }
    return 1;
  }

  _updateWorldAnim(dt, t) {
    const a = this.world.anim;
    if (a.windmill) a.windmill.rotation.z += dt * 0.7;
    for (const pw of a.pinwheels || []) pw.rotation.z += dt * 2.2;
    for (const cl of a.clouds || []) {   // 云影缓缓东移，飘出边界就回到西边
      cl.position.x += dt * 0.7;
      if (cl.position.x > 62) cl.position.x = -62;
    }
    // 水面呼吸：河水轻起伏、透明度微变，岛边浪花一圈涨落，海面缓慢升降
    if (a.water) {
      // 水面波动范围 0.043~0.099：最低点高于地面(y=0)避免与地面深度冲突（闪烁碎块），
      // 最高点低于码头木板底(0.11)避免浪头穿板
      a.water.position.y = 0.062 + Math.sin(t * 1.1) * 0.012;
      a.water.material.opacity = 0.84 + Math.sin(t * 0.8 + 1) * 0.06;
    }
    if (a.surf) a.surf.material.opacity = 0.4 + Math.sin(t * 1.4) * 0.12;
    if (a.sea) a.sea.position.y = -0.14 + Math.sin(t * 0.7) * 0.02;
    if (a.water) {
      const pos = a.water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setY(i, Math.sin(x * 0.5 + t * 1.6) * 0.016 + Math.cos(pos.getZ(i) * 0.8 + t) * 0.01);
      }
      pos.needsUpdate = true;
    }
    if (a.sea) a.sea.position.y = -0.14 + Math.sin(t * 0.8) * 0.03;
    if (a.surf) {
      a.surf.material.opacity = 0.32 + Math.sin(t * 1.4) * 0.16;
      const s = 1 + Math.sin(t * 1.4) * 0.006;
      a.surf.scale.set(s, 1, s);
    }
    for (const f of a.foam || []) f.material.opacity = 0.4 + Math.sin(t * 2.2 + f.position.z) * 0.2;
    for (const s2 of a.islandSurf || []) s2.material.opacity = 0.28 + Math.sin(t * 1.6 + s2.position.x) * 0.14;
    // 悬浮岛云海/暗影按距离显隐：52 座岛同屏时只让近处几座出云海，远处的岛不留白雾
    for (const fl of a.floating || []) {
      const d = Math.hypot(this.player.position.x - fl.cx, this.player.position.z - fl.cz);
      const on = d < 260;
      fl.shadow.visible = on;
      for (const c2 of fl.clouds) {
        c2.visible = on;
        if (on) c2.material.opacity = 0.86 + Math.sin(t * 1.2 + c2.position.x * 0.1) * 0.06;
      }
    }
    // 站进谷仓：墙体变半透明，黑黑的程度也减半——里面亮堂看得见，不黑灯瞎火
    if (a.barn) {
      const p2 = this.player.position;
      const inside = p2.x > 21 && p2.x < 27 && p2.z > 19.5 && p2.z < 24.5;
      if (a.barn.userData.inside !== inside) {
        a.barn.userData.inside = inside;
        a.barn.traverse(o => {
          if (!o.isMesh || o.name === 'darkness' || o.name.startsWith('door')) return;
          o.material.transparent = true;
          o.material.opacity = inside ? 0.38 : 1;
        });
        const dark = a.barn.getObjectByName('darkness');
        if (dark && dark.visible) dark.material.opacity = inside ? 0.55 : 0.96;
      }
    }
    // 谷仓烟囱冒烟
    this._smokeT = (this._smokeT || 0) - dt;
    if (this._smokeT <= 0) {
      this._smokeT = 0.85;
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: 0xe4e0da, transparent: true, opacity: 0.42, depthWrite: false }));
      sm.position.set(23.1, 4.85, 22.8);
      sm.scale.setScalar(0.3);
      this.scene.add(sm);
      this.fx.push({ obj: sm, t: 0, dur: 2.4, update: (tt, dt2) => { sm.position.y += dt2 * 0.45; sm.position.x += dt2 * 0.1; sm.material.opacity = 0.42 * (1 - tt / 2.4); sm.scale.setScalar(0.3 + tt * 0.32); } });
    }
    // 谷仓门：小人走近就缓缓推开，走远再轻轻合上——像真的推开谷仓门
    if (a.barnDoors && a.barnDoors.length) {
      const p2 = this.player.position;
      const open = Math.hypot(p2.x - 24, p2.z - 19.2) < 3.6 ? 1.75 : 0;
      a.barnDoors.forEach((d, i) => {
        const dir = i === 0 ? -1 : 1;
        d.rotation.y += (open * dir - d.rotation.y) * Math.min(1, dt * 3);
      });
    }
    // 云朵阶梯轻轻上下漂浮，平台高度同步跟随（站上去的 userinfo 会一起起伏）
    for (const cs of a.cloudStair || []) {
      const dy = cs.pf.bob.amp * Math.sin(t * cs.pf.bob.speed + cs.pf.bob.phase);
      cs.pf.top = cs.pf.baseTop + dy;
      cs.mesh.position.y = cs.baseY + dy;
      // 远景淡出：镜头离得远时云梯几乎隐身，不会连成一条白带；走近才浮现
      const d2 = this.camera.position.distanceTo(cs.mesh.position);
      const op = Math.max(0.12, Math.min(0.8, 1.35 - d2 / 40));
      cs.mesh.traverse(o => { if (o.isMesh) o.material.opacity = op; });
    }
    for (const pd of a.islandPads || []) {
      pd.beacon.rotation.y = t * 1.5;
      pd.beacon.position.y = 1.1 + Math.sin(t * 2.2 + pd.ring.position.x) * 0.15;
    }
    if (a.petals) {
      const pos = a.petals.points.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - a.petals.speeds[i] * dt;
        let x = pos.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.35;
        if (y < 0.1) { y = 11 + Math.random() * 2; x = (Math.random() - 0.5) * 90; }
        pos.setY(i, y); pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
    for (const c of a.clouds) {
      c.position.x += dt * 0.25;
      if (c.position.x > 60) c.position.x = -60;
    }
    for (const gr of a.grass || []) gr.rotation.z = Math.sin(t * 2 + gr.userData.phase) * 0.09;
    if (a.fireflies) {
      const pos = a.fireflies.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, 0.8 + Math.sin(t * 1.2 + i * 1.7) * 0.7 + Math.sin(t * 0.5 + i) * 0.4);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.7 + i * 2.3) * dt * 0.35);
      }
      pos.needsUpdate = true;
      a.fireflies.material.opacity = 0.65 + Math.sin(t * 2.4) * 0.3;
    }
    for (const bf of a.butterflies || []) {
      const c = bf.userData.center, p = bf.userData.phase;
      // 走近蝴蝶会把它吓飞（中心点被推开），过后慢慢飘回原来的花丛
      const fdx = bf.position.x - this.player.position.x, fdz = bf.position.z - this.player.position.z;
      const pd = Math.hypot(fdx, fdz);
      if (pd < 1.7 && pd > 0.001) {
        c[0] += fdx / pd * dt * 3.4;
        c[1] += fdz / pd * dt * 3.4;
      } else if (bf.userData.home) {
        c[0] += (bf.userData.home[0] - c[0]) * Math.min(1, dt * 0.1);
        c[1] += (bf.userData.home[1] - c[1]) * Math.min(1, dt * 0.1);
      }
      bf.position.set(
        c[0] + Math.sin(t * 0.5 + p) * 2.4,
        0.9 + Math.sin(t * 1.6 + p) * 0.35,
        c[1] + Math.cos(t * 0.42 + p) * 2.4);
      bf.rotation.y = -t * 0.5;
      bf.userData.wings[0].rotation.z = Math.sin(t * 16 + p) * 0.95;
      bf.userData.wings[1].rotation.z = -Math.sin(t * 16 + p) * 0.95;
    }
    for (const gu of a.gulls || []) {
      const c = gu.userData.center, p = gu.userData.phase, r = gu.userData.radius;
      const a2 = t * 0.35 + p;
      gu.position.set(c[0] + Math.cos(a2) * r, gu.userData.height + Math.sin(t + p) * 0.5, c[1] + Math.sin(a2) * r);
      gu.rotation.y = -a2;
      gu.userData.wingL.rotation.z = Math.sin(t * 7 + p) * 0.5;
      gu.userData.wingR.rotation.z = -Math.sin(t * 7 + p) * 0.5;
    }
    // 随身装扮：气球一颠一颠
    if (this.playerParts.balloon) {
      const b = this.playerParts.balloon;
      b.rotation.z = Math.sin(t * 2.6) * 0.14;
      b.children[1] && (b.children[1].position.x = Math.sin(t * 2.6) * 0.06);
    }
    // 点击移动落点标记：呼吸闪烁
    if (this.moveMarker && this.moveMarker.visible) {
      const s = 1 + Math.sin(t * 8) * 0.18;
      this.moveMarker.scale.setScalar(s);
      this.moveMarker.material.opacity = 0.55 + Math.sin(t * 8) * 0.3;
    }
    this.riverHintCd -= dt;
    if (this.npcs) {
      this.npcs.update(dt, this.player.position);
      if (!this.npcs._bubble && Math.random() < dt * 0.12) this.npcs.tellKnowledge(this.player.position);
    }
  }

  // 城市任务牌：钥匙词孵化后出现在孵出点（📍），机关解开自动收起
  _refreshCityGateTags() {
    if (!this.cityTour || !this._cityGatePos) return;
    const needMap = { boat: 'boat', light: 'light', wind: 'wind', seed: 'planted', rain: 'beanstalk', banana: 'vines' };
    this._cityGateTag = this._cityGateTag || {};
    for (const [wid, pt] of Object.entries(this._cityGatePos)) {
      const gid = needMap[wid];
      const done = !gid || save.hasGate(gid);
      const show = save.isHatched(wid) && !done;
      const have = !!this._cityGateTag[wid];
      if (show && !have) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: letterTexture('📍', '#E8C86A', '#5C4A38'), transparent: true, depthWrite: false,
        }));
        s.scale.setScalar(0.78);
        s.position.set(pt.x, 2.1, pt.z);
        this.scene.add(s);
        this._cityGateTag[wid] = s;
      } else if (!show && have) {
        this.scene.remove(this._cityGateTag[wid]);
        delete this._cityGateTag[wid];
      }
    }
  }

  // 阴影跟随：光源与太阳 target 一起挪到玩家（相机焦点）上方，阴影框随缩放放大。
  // 收益：外圈也有投影了（框不再固定 ±60）、texel 密度高一个量级（接触影"坐得住"）。
  // 只在"框该变"时才 updateProjectionMatrix，避免每帧重算阴影投影矩阵。
  _updateShadowFollow() {
    const dn = this.world && this.world.anim && this.world.anim.dayNight;
    if (!dn || !dn.sun || !dn.sun.target) return;
    const p = this.player ? this.player.position : null;
    if (!p) return;
    const dir = dn.sunDir || (dn.sunDir = new THREE.Vector3(0.4, 1, 0.3).normalize());
    const dist = Math.max(6, this.camDist || 8);
    // 近景小框（26）→ 拉远时线性放大到 95：拉远看全景时全城也都有影
    const half = Math.min(95, 26 + Math.max(0, dist - 20) * 1.15);
    dn.sun.target.position.set(p.x, 0, p.z);
    dn.sun.target.updateMatrixWorld();
    dn.sun.position.set(p.x + dir.x * 70, Math.max(24, dir.y * 70), p.z + dir.z * 70);
    dn.sun.updateMatrixWorld();
    const cam = dn.sun.shadow.camera;
    if (Math.abs(cam.right - half) > half * 0.06) {
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
    }
  }

  // 昼夜循环：按真实时间移动日月、调光照与雾色（18:00-6:00 进夜晚模式）
  _updateDayNight() {
    const dn = this.world.anim.dayNight;
    if (!dn) return;
    this._dnT = (this._dnT || 0) - 1;
    if (this._dnT > 0) return;
    this._dnT = 60;   // 约每秒一次
    this._refreshCityGateTags();
    const hr = new Date().getHours() + new Date().getMinutes() / 60;
    // 真实时间里日月几乎不动：分钟档没跨过去就不重写光照/颜色——
    // 每秒重复提交整屏光照状态会经由泛光管线造成整幅画面“一闪一闪”
    const bucket = Math.round(hr * 5);   // 12 分钟一档
    if (bucket === this._dnBucket) return;
    this._dnBucket = bucket;
    const sea = this.world.anim.sea;
    // 舞台半径：太阳轨道与光晕尺寸都按它走（城市是 radius×(3+…)×0.84 的大图，写死 118/64 的
    // 太阳会正好挂在地图上方，一团白光罩住半张图）
    const stageR = (this._currentStage() && this._currentStage().r) || 52;
    const sunR = Math.max(150, stageR * 2.6);
    if (hr < 6 || hr >= 18) {
      // 夜晚：月亮当班、光照调暗、雾色转深、全岛萤火虫点亮
      dn.sunCore.visible = dn.sunHalo.visible = false;
      dn.moon.visible = (dn.sunFade ?? 1) > 0.01;   // 显隐统一由镜头距离那趟决定（别每 12 分钟抢写 visible）
      // 粘土风：夜里也留一点环境光，否则哑光材质糊成黑块（太阳仍是主光，只是不再压死）
      dn.baseSun = 0.35; dn.sun.intensity = 0.35; dn.hemi.intensity = 0.45;   // baseSun 供天气按比例打折
      dn.fog.color.set(0x39466B);
      dn.dome.material.color.set(0x6B7FB8);
      if (sea) sea.material.color.set('#2E5F8A');
      if (this.world.anim.nightFire) this.world.anim.nightFire.material.opacity = 0.85;
    } else {
      // 白天：太阳东升西落，清晨/黄昏偏金，正午最亮
      dn.sunCore.visible = dn.sunHalo.visible = (dn.sunFade ?? 1) > 0.01;   // 显隐由镜头距离那趟决定
      dn.moon.visible = false;
      const a = Math.PI * (1 - (hr - 6) / 12);
      dn.sun.position.set(Math.cos(a) * 60, 16 + Math.sin(a) * 34, 14);
      (dn.sunDir || (dn.sunDir = new THREE.Vector3())).copy(dn.sun.position).normalize();   // 跟随逻辑按这个方向摆光源
      dn.sunCore.position.set(Math.cos(a) * sunR, 20 + Math.sin(a) * sunR * 0.76, sunR * 0.2);
      // 太阳 sprite 按舞台半径放大轨道、按城尺度收小尺寸：成都（r≈86）从"离城心 118 的 64 单位光球"
      // 变成"离城心 224 的 34 单位光晕"，光斑回到天上而不是罩住地图
      dn.sunCore.scale.setScalar(Math.max(6, Math.min(14, stageR * 0.14)));
      dn.sunHalo.scale.setScalar(Math.max(16, Math.min(40, stageR * 0.40)));
      dn.sunHalo.position.copy(dn.sunCore.position).multiplyScalar(0.98);
      const h = Math.max(0.15, Math.sin(a));
      // 粘土手办风：主光压低、环境提亮 → 低对比柔光（原来的 1.2+0.9h / 0.75+0.35h 会把
      // 亮面推到过曝、暗面压成硬边，圆润造型的"软"就没了）
      // 明暗配比：既要"圆润不死黑"，又要"影子读得出来"。之前是 1.15 : 0.82（环境 71%、
      // 影子只有 ~30% 深）→ 物体像贴在地面上的纸片；现在 1.45 : 0.66（环境 46%）：
      // 接触影清楚"坐"在地上，暗部仍是柔的。动这两个数必须回跑 check-render（草地亮度上限 0.70）。
      dn.baseSun = 1.05 + h * 0.40; dn.sun.intensity = dn.baseSun;   // baseSun 是"天气打折"的基准
      dn.hemi.intensity = 0.50 + h * 0.16;
      dn.fog.color.set(0xCBE6F2);   // 与天空同色系的浅蓝：远处是"大气"，不是"白纸"（近白雾色是发白的主因之一）
      dn.dome.material.color.set(0xFFFFFF);
      if (sea) sea.material.color.set('#4A9ED9');
      if (this.world.anim.nightFire) this.world.anim.nightFire.material.opacity = 0;
      dn.sun.color.set(hr < 8 ? 0xFFE2B8 : hr >= 16 ? 0xFFC98A : 0xFFF2DC);
    }
  }

  // 外圈海岛懒加载：雾外的岛整组隐藏（省 draw call），走近再显示，视觉无感
  // 城市巡游模式：只显示当前城市舞台（其他城市在雾外"等待解锁"）
  _updateIslandLOD() {
    this._lodT = (this._lodT || 0) - 1;
    if (this._lodT > 0) return;
    this._lodT = 30;   // 约每半秒检查一次
    const p = this.player.position;
    if (this.cityTour) {
      const cur = this._currentStage();
      for (const isl of this.world.islands) {
        if (!isl.grp) continue;
        const want = isl.uid === cur.uid;
        if (isl.grp.visible !== want) isl.grp.visible = want;   // 状态不变不写，避免无谓打断渲染
      }
      return;
    }
    for (const isl of this.world.islands) {
      if (isl.grp) isl.grp.visible = Math.hypot(p.x - isl.cx, p.z - isl.cz) < 95;
    }
  }

  _updateFx(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.onUpdate(tw.ease ? tw.ease(k) : k, dt);
      if (k >= 1) { this.tweens.splice(i, 1); tw.onDone && tw.onDone(); }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      f.update(f.t, dt);
      if (f.t >= f.dur) { if (f.obj.parent) f.obj.parent.remove(f.obj); this.fx.splice(i, 1); }
    }
  }

  addTween(dur, onUpdate, onDone, ease) {
    this.tweens.push({ t: 0, dur, onUpdate, onDone, ease });
  }

  // ================= 烽火台彩蛋 =================
  // 走进烽火台范围自动点火：火苗常燃 + 一阵烟柱 + 音效（world 建塔，game 管点亮）
  _updateBeacons(dt) {
    if (!this.cityTour || !this.world) return;
    this._beaconCd = (this._beaconCd || 0) - dt;
    const st = this._currentStage();
    const list = st && st.grp && st.grp.userData.beacons;
    if (!list || !list.length) return;
    const now = performance.now() / 1000;
    for (const b of list) {
      if (b.lit && b.flame) {
        // 火苗呼吸感：缩放/透明度轻轻抖动
        const k = 0.85 + Math.sin(now * 11 + b.lx) * 0.15;
        b.flame.scale.setScalar(1.7 * k);
        b.flame.material.opacity = 0.75 + Math.sin(now * 17 + b.lz) * 0.25;
      }
      if (!b.lit) {
        if (this._beaconCd > 0) continue;
        const p = this.player.position;
        // 7.5：钳制边距 3.2 + 塔身半宽 2.6 + 一点余量——沿墙走到塔边就能点着
        if (Math.hypot(p.x - b.wx, p.z - b.wz) < 7.5) { this._lightBeacon(b, st); this._beaconCd = 0.5; }
      } else if (b.smokeT > 0) {
        // 点燃后冒 4 秒烟柱
        b.smokeT -= dt;
        if ((b.smokePuff = (b.smokePuff || 0) - dt) <= 0) {
          b.smokePuff = 0.3;
          this._beaconPuff(b, st);
        }
      }
    }
  }
  _lightBeacon(b, st) {
    b.lit = true;
    b.smokeT = 4;
    sfx.fire();
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._emojiTexture('🔥'), transparent: true, depthWrite: false,
    }));
    flame.position.set(b.lx, b.top + 0.9, b.lz);
    flame.scale.setScalar(1.7);
    st.grp.add(flame);
    b.flame = flame;
    ui.toast(t('x.g353'), 3000);
  }
  _beaconPuff(b, st) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softTexture(), color: 0xD8D4CC, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    s.position.set(b.lx + (Math.random() - 0.5) * 0.6, b.top + 1.4, b.lz + (Math.random() - 0.5) * 0.6);
    s.scale.setScalar(0.9);
    st.grp.add(s);
    this.fx.push({
      obj: s, t: 0, dur: 2.4,
      update: (t, dt) => {
        s.position.y += dt * 1.6;
        s.position.x += dt * 0.4;             // 风向飘
        s.scale.setScalar(0.9 + t * 1.3);
        s.material.opacity = Math.max(0, 0.55 * (1 - t / 2.4));
      },
    });
  }
  _emojiTexture(ch) {
    this._emojiTexCache = this._emojiTexCache || {};
    if (this._emojiTexCache[ch]) return this._emojiTexCache[ch];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const c = cv.getContext('2d');
    c.font = '72px serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ch, 48, 52);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._emojiTexCache[ch] = tex;
    return tex;
  }

  // ================= 交互 =================
  // 走近地形打卡点自动盖章（每城一次，+3⭐）；集齐 10/25/52 城给称号
  _stampSpot() {
    const s = this._spotAt;
    if (!s || this.onIsle) return;
    const p = this.player.position;
    if (Math.hypot(p.x - s.x, p.z - s.z) > s.r) return;
    const key = this._currentStage().key;
    if (!save.markSpot(key, s.kind)) return;
    save.addStars(s.stars || 3);
    sfx.win && sfx.win();
    this._puff(0xE8C36A);
    ui.toast(t("g.spotStamp", { a0: s.name, a1: s.stars || 3 }), 2600);
    const n = save.spotCount();
    if (n === 10 || n === 25 || n === 52) ui.toast(t("g.spotAll", { a0: n }), 3600);
  }
  _updatePrompt() {
    if (ui.challengeOpen()) { ui.hidePrompt(); return; }
    const p = this.player.position;
    const po = this._currentStage().key;
    // 蛋（高台顶上的蛋允许站台下缘按 E，孩子不用精确跳到中心点）
    const egg = this.eggs.nearest(p, 4.2);
    if (egg && egg.group.position.y - p.y <= 1.8) {
      ui.showPrompt(t('x.g354'), 'E'); this.promptAction = () => this._openEgg(egg.word.id); return;
    }
    // 梯田采集：走近自家梯田按 E 采一穗（每城每天一次，+1⭐）
    if (this._terraceAt(p.x, p.z) && !save.hasSpotPick(po)) {
      ui.showPrompt(t('g.terracePick'), 'E');
      this.promptAction = () => {
        if (save.markSpotPick(po)) { save.addStars(1); sfx.pop(); this._puff(0xf0d878); ui.toast(t('g.terracePick'), 1600); }
        else ui.toast(t('g.terraceDone'), 1400);
      };
      return;
    }
    // 饿了的词宠
    const hungry = this._nearHungryPet(p, 2.4);
    if (hungry) {
      ui.showPrompt(t('x.g355', { a0: hungry.word.en }), 'E');
      this.promptAction = () => this._feedPet(hungry.word.id);
      return;
    }
    // 豆藤攀爬
    if (save.hasGate('beanstalk')) {
      const nearBase = Math.hypot(p.x - CLIMB_BOTTOM.x, p.z - CLIMB_BOTTOM.z) < 1.8 && !this.onIsle;
      const nearTop = this.onIsle && Math.hypot(p.x - CLIMB_TOP.x, p.z - CLIMB_TOP.z) < 2.2;
      if (nearBase) { ui.showPrompt(t('x.g356'), 'E'); this.promptAction = () => this._climb(true); return; }
      if (nearTop) { ui.showPrompt(t('x.g357'), 'E'); this.promptAction = () => this._climb(false); return; }
    }
    // 骑乘中：最优先提示下骑（要喂词宠/坐船先下来）
    if (this.mount && this.mountPet) {
      ui.showPrompt(t('x.g358', { a0: this.mountPet.word.en }), this.isTouch ? '👆' : 'E');
      this.promptAction = () => this._ridePet(this.mount);
      return;
    }
    // 骑词宠：靠近自己孵化的词宠就能骑（跑得更快，飞行词宠驮着飘半空）
    {
      let ride = null, bd = 2.2;
      for (const pt of this.pets.all()) {
        if (!save.isHatched(pt.word.id) || save.isHungry(pt.word.id)) continue;
        if (pt.group.position.y > 2) continue;
        const d = Math.hypot(p.x - pt.group.position.x, p.z - pt.group.position.z);
        if (d < bd) { bd = d; ride = pt; }
      }
      if (ride) {
        ui.showPrompt(t('x.g359', { a0: ride.word.en }), this.isTouch ? '👆' : 'E');
        this.promptAction = () => this._ridePet(ride.word.id);
        return;
      }
    }
    // 坐船过河：船就停在渡口，点一下（或按 E）直接坐过去，不用自己找路
    if (save.hasGate('boat') && !this.riding
        && Math.abs(p.x) < 6 && Math.abs(Math.abs(p.z) - 4.6) < 4.2) {
      ui.showPrompt(t('x.g360'), 'E');
      this.promptAction = () => this._rideBoat();
      return;
    }
    // 淘气词宠在附近：优先提示抓捕（错词复习）
    if (this._naughtyId) {
      const np = this.pets.get(this._naughtyId);
      if (np && Math.hypot(p.x - np.group.position.x, p.z - np.group.position.z) < 2.4) {
        ui.showPrompt(t('x.g361', { a0: np.word.en }), this.isTouch ? '👆' : 'E');
        this.promptAction = () => this._catchNaughty(this._naughtyId);
        return;
      }
    }
    // 许愿井（星星商店）与每日任务板：主岛广场 + 每座城市广场（功能下沉，免跑回农场）
    const citySpot = this.cityTour
      ? this.world.islands.find(i => (i.wellPos && Math.hypot(p.x - i.wellPos.x, p.z - i.wellPos.z) < 2.6)
        || (i.boardPos && Math.hypot(p.x - i.boardPos.x, p.z - i.boardPos.z) < 2.6)) : null;
    if (citySpot && citySpot.wellPos && Math.hypot(p.x - citySpot.wellPos.x, p.z - citySpot.wellPos.z) < 2.6) {
      ui.showPrompt(t('x.g362'), this.isTouch ? '👆' : 'E');
      this._activeWellPos = citySpot.wellPos;
      this.promptAction = () => this._openShop();
      return;
    }
    if (citySpot && citySpot.boardPos && Math.hypot(p.x - citySpot.boardPos.x, p.z - citySpot.boardPos.z) < 2.6) {
      ui.showPrompt(t('x.g363'), this.isTouch ? '👆' : 'E');
      this.promptAction = () => this._openDailyBoard();
      return;
    }
    if (Math.hypot(p.x - 4.6, p.z - 19.5) < 2.6) {
      ui.showPrompt(t('x.g362'), this.isTouch ? '👆' : 'E');
      this._activeWellPos = null;   // 主岛井：特效用默认坐标
      this.promptAction = () => this._openShop();
      return;
    }
    if (Math.hypot(p.x + 4.6, p.z - 19.5) < 2.6) {
      ui.showPrompt(t('x.g363'), this.isTouch ? '👆' : 'E');
      this.promptAction = () => this._openDailyBoard();
      return;
    }
    // 神秘货郎（限时事件）
    if (this._event.active && this._event.active.id === 'merchant') {
      const c = this._event.active.data.cart;
      if (c && Math.hypot(p.x - c.x, p.z - c.z) < 2.6) {
        ui.showPrompt(t('x.g364'), this.isTouch ? '👆' : 'E');
        this.promptAction = () => this._buyMysteryBox();
        return;
      }
    }
    // 猫头鹰园丁（每日任务链）
    if (Math.hypot(p.x + 6.1, p.z - 19.1) < 2.4) {
      ui.showPrompt(t('x.g365'), this.isTouch ? '👆' : 'E');
      this.promptAction = () => this._openOwl();
      return;
    }
    // 小火车站（主岛）：城市巡游模式=选任意已解锁城直达；老模式=去群岛
    if (!this._islandAt(p) && Math.hypot(p.x + 9, p.z - 9.6) < 2.8) {
      if (this.cityTour) {
        ui.showPrompt(t('train.go'), this.isTouch ? '👆' : 'E');
        this.promptAction = () => this._openCityDestinations();
      } else {
        ui.showPrompt(t('x.g366'), this.isTouch ? '👆' : 'E');
        this.promptAction = () => this._openStation();
      }
      return;
    }
    const hereIsl = this._islandAt(p);
    if (hereIsl && Math.hypot(p.x - hereIsl.cx, p.z - (hereIsl.cz - 2.5)) < 2.6) {
      ui.showPrompt(t('x.g367'), this.isTouch ? '👆' : 'E');
      this.promptAction = () => this._rideTrain(null);
      return;
    }
    // 谜题机关：读懂谜面，从召唤盘里挑出对的那只词宠
    const gate = this._activeGate();
    if (gate) {
      const ready = gate.need.every(id => save.isHatched(id));
      if (ready) {
        ui.showPrompt(t('x.g368'), this.isTouch ? '🪄' : 'E');
        this.promptAction = () => this._openSummon(gate);
      } else {
        const how = this.isTouch ? t('x.g369') : t('x.g370');
        ui.showPrompt(t('x.g371') + how + '）', 'Tab');
        this.promptAction = null;
      }
      return;
    }
    ui.hidePrompt();
    this.promptAction = null;
  }

  _interact() {
    if (ui.challengeOpen()) return;
    if (this.promptAction) this.promptAction();
  }

  _click(e) {
    if (ui.challengeOpen()) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    // 城市中心欢迎牌：点「欢迎来 XX」开城市介绍卡
    if (this.cityTour) {
      const wIsl = (this.world.islands || []).find(w => w.uid === this._currentStage().uid);
      const sign = wIsl && wIsl.grp && wIsl.grp.getObjectByName('welcome-sign');
      if (sign) {
        const wh = ray.intersectObject(sign, false);
        if (wh.length) { sfx.pop(); this._openCityIntro(); return; }
      }
    }
    // NPC：点小人聊天（气泡翻页由 DOM 气泡上的箭头按钮接管）
    if (this.npcs && this.npcs.npcs.length) {
      const nh = ray.intersectObjects(this.npcs.group.children, true);
      if (nh.length) {
        let o = nh[0].object;
        while (o && o.parent !== this.npcs.group) o = o.parent;
        if (o && o.parent === this.npcs.group) { sfx.pop(); this.npcs.talkTo(o); return; }
      }
    }
    // 城市牌子优先：点牌看介绍（顺手读一遍英文名）
    if (this.cityTour && this.signGroup && this.signGroup.children.length) {
      const sh = ray.intersectObjects(this.signGroup.children, true);
      if (sh.length) {
        const it = sh[0].object.userData.sign;
        if (it) {
          sfx.pop();
          ui.showSignDetail(it, this._currentStage().city && this._currentStage().city.en);
          const en = it.en || (it.name || it.zh || '');
          speak(en);
          this._bumpTask('sign');
          return;
        }
      }
    }
    const targets = [];
    for (const eg of this.eggs.eggs.values()) targets.push(eg.group);
    for (const pt of this.pets.all()) targets.push(pt.group);   // 饿的喂食，饱的摸头
    // 河中央的船也可以点：直接坐船过河（但它饿的时候优先喂它）
    const boat = this.pets.get('boat');
    if (boat && save.hasGate('boat') && !save.isHungry('boat')) targets.push(boat.group);
    const hits = ray.intersectObjects(targets, true);
    if (!hits.length) { this._setMoveTarget(e); return; }   // 点的是空地 → 走过去
    let obj = hits[0].object;
    while (obj && obj.userData.wordId === undefined) obj = obj.parent;
    if (!obj) { this._setMoveTarget(e); return; }
    const id = obj.userData.wordId;
    if (id === 'boat' && save.hasGate('boat') && !this.eggs.get('boat')) {
      if (!this._rideBoat()) ui.toast(t('x.g372'));
      return;
    }
    if (this.eggs.get(id)) { this._approachEgg(id); }
    else if (save.isHungry(id)) { this._approachInteract(id); }
    else if (id === this._naughtyId) { this._approachInteract(id); }
    else if (this.pets.get(id)) {
      // 📇 6 秒内再点一次 → 打开词宠名片（档案 + 分享）
      if (this._petCardArmed && this._petCardArmed.id === id && performance.now() < this._petCardArmed.until) {
        this._petCardArmed = null;
        this._openPetCard(id);
        return;
      }
      // 摸头：点吃饱了的词宠，它开心地跳一下、念出自己的名字（顺手就是一次复习）
      this._clearMoveTarget();
      const pet = this.pets.get(id);
      pet.jumping = true; pet.jt = 0;
      this._letterBurst(pet.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '💗');
      this._faceMood('smile', 1.6);   // 摸词宠：主角跟着微笑
      sfx.pat();
      const w = pet.word || WORD_MAP[id];
      if (w) speak(w.en);
      // 💬 词宠会说话：一半概率冒一句日常短句，跟读 80+ 得 1⭐（同一句每次进游戏只奖励一次）
      if (w && Math.random() < 0.5) { this._petSayLine(pet, w); return; }
      // 摸摸头，它把自己的小故事告诉你（词条里现成的 story/hint）
      const fact = (typeof w.story === 'string' && w.story) ? w.story : (w.hint || t('x.g373', { a0: w.en }));
      if (fact) {
        this._fact = { id, until: performance.now() + 5200 };
        ui.showPetFact(`「${w.en}」${w.zh}`, fact);
      }
      // 📇 词宠名片：再点一次这个词宠就打开档案卡（独一无二养成数据 + 晒宠分享）
      this._petCardArmed = { id, until: performance.now() + 6000 };
      ui.toast(t('y.petCardHint'), 2600);
    }
    else this._setMoveTarget(e);   // 点的是空地 → 走过去（手机轻点同理）
  }

  // 点了饿宠/淘气词/巡逻词：够得着直接互动，够不着先走过去再自动互动，防止触屏误触弹窗
  _approachInteract(id) {
    const pt = this.pets.get(id);
    const pos = pt ? pt.group.position : null;
    const p = this.player.position;
    if (pos && Math.hypot(pos.x - p.x, pos.z - p.z) <= 2.4) {
      if (save.isHungry(id)) { this._clearMoveTarget(); this._feedPet(id); return; }
      if (id === this._naughtyId || (this._patrolIds && this._patrolIds.includes(id))) { this._clearMoveTarget(); this._catchNaughty(id); return; }
    }
    if (pos) {
      this.moveTarget = { x: pos.x, z: pos.z };
      this.moveThenInteract = id;
      this.moveMarker.position.set(pos.x, pos.y + 0.06, pos.z);
      this.moveMarker.visible = true;
    }
  }

  // 📇 词宠名片：档案卡——独一无二养成数据 + 一键晒宠
  _openPetCard(id) {
    const w = WORD_MAP[id];
    if (!w) return;
    const pd = save.getSave().pets[id];
    const ageDays = pd && pd.hatchedAt ? Math.max(1, Math.floor((Date.now() - pd.hatchedAt) / 86400000)) : 0;
    let thumb = '';
    try { thumb = petThumbnail(id); } catch (e) { /* 缩略图渲染失败不阻塞名片 */ }
    ui.showPetCard({
      en: w.en, zh: w.zh, thumb,
      ageDays, feeds: pd ? pd.feeds || 0 : 0,
      evo: !!(pd && pd.evo), rare: !!(pd && pd.rare),
      stars: save.getStars(),
    });
    sfx.pop();
  }

  // 💬 词宠的悄悄话：日常短句跟读挑战。句子带词宠自己的名字，情感互动里塞复习。
  _petSayLine(pet, w) {
    const pool = [
      `I am ${w.en}!`,
      'Play with me!',
      'You are my best friend!',
      'I am so happy today!',
      'Thank you, my friend!',
      `Let's learn English together!`,
      `I love ${w.en}! Do you love me?`,
    ];
    this._saidLines = this._saidLines || new Set();
    const fresh = pool.filter(l => !this._saidLines.has(l));
    const bag = fresh.length ? fresh : pool;
    const line = bag[Math.floor(Math.random() * bag.length)];
    this._saidLines.add(line);
    ui.openChallenge({
      word: { en: line, zh: t('x.g374', { a0: w.en }), hint: t('x.g375') },
      mode: 'practice', noSpell: true,
      onSuccess: res => {
        ui.closeChallenge();
        if ((res.score || 0) >= 80) {
          save.addStars(1);
          ui.updateStars(save.getStars());
          sfx.great();
          if (save.bumpDaily('read2') === 'done') this._afterDaily();
          ui.toast(t('x.g376'), 3200);
        } else {
          ui.toast(t('x.g377'), 2800);
        }
      },
    });
  }

  // 饥饿词宠一键指路：点 HUD「有词宠想你啦」胶囊，箭头/小径临时指向最近的饥饿词宠（10 秒）
  _guideHungry() {
    const list = save.hungryPets().map(id => this.pets.get(id)).filter(Boolean);
    if (!list.length) { this._openCatalog(true); return; }
    let best = null, bd = 1e9;
    for (const pt of list) {
      const d = Math.hypot(pt.group.position.x - this.player.position.x, pt.group.position.z - this.player.position.z);
      if (d < bd) { bd = d; best = pt; }
    }
    this._hungryGuide = { id: best.word.id, until: performance.now() + 10000 };
    sfx.pop();
    ui.toast(t('x.g378', { a0: best.word.en }), 3000);
  }

  // NPC 复习考官：从错词本挑一只没抓回的淘气词，NPC 捧着词卡请孩子读出来
  _npcReview(npc) {
    const naughty = save.getSave().naughty || {};
    const ids = Object.keys(naughty).filter(id => naughty[id] && !naughty[id].caughtOn && WORD_MAP[id]);
    if (!ids.length) return false;
    const id = ids[Math.floor(Math.random() * ids.length)];
    const w = WORD_MAP[id];
    this.npcs._showBubble(t('x.g379', { a0: w.en }), npc);
    sfx.pop();
    this._catchNaughty(id);
    return true;
  }

  // 坐船过河：船划到岸边接人 → 驮着过河 → 自己划回渡口守桥
  _rideBoat() {
    if (this.riding || this.climbing || !save.hasGate('boat')) return false;
    this._clearMoveTarget();
    const p = this.player.position;
    if (Math.abs(p.x) > 7) return false;   // 离渡口太远
    const fromZ = p.z >= 0 ? 4.6 : -4.6;
    const toZ = -fromZ;
    const from = new THREE.Vector3(THREE.MathUtils.clamp(p.x, -1.8, 1.8), 0, fromZ);
    const to = new THREE.Vector3(0, 0, toZ);
    const center = new THREE.Vector3(0, 0, 0.4);
    const boat = this.pets.get('boat');
    const dock = new THREE.Vector3(from.x, 0, from.z);
    const farDock = new THREE.Vector3(0, 0, toZ);
    this.riding = true;
    this.onGround = true; this.vy = 0; this.jumps = 0;
    this.player.rotation.y = toZ < fromZ ? Math.PI : 0; // 面朝对岸
    ui.hidePrompt();
    sfx.pop();
    this.addTween(3.4, k => {
      const seg = (a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
      if (!boat) {
        this.player.position.lerpVectors(from, to, seg(0, 0.7));
        return;
      }
      if (k < 0.22) {          // 船划过来接人
        const t = seg(0, 0.22);
        boat.group.position.lerpVectors(center, dock, t);
      } else if (k < 0.72) {   // 驮着小朋友过河
        const t = seg(0.22, 0.72);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        boat.group.position.lerpVectors(dock, farDock, e);
        this.player.position.lerpVectors(from, to, e);
        this.player.position.y = Math.abs(Math.sin(e * Math.PI * 3)) * 0.05; // 随水波轻晃
      } else {                 // 船自己划回河中央守桥
        const t = seg(0.72, 1);
        boat.group.position.lerpVectors(farDock, center, t);
      }
      // 别让“溜达 AI”把船拽回去
      if (boat) boat.target.set(boat.group.position.x, boat.group.position.z);
    }, () => {
      this.riding = false;
      this.player.position.copy(to);
      this.player.position.y = 0;
      if (boat) {
        boat.target.set(0, 0.4);
        boat.home.set(0, 0.4);
      }
      sfx.good();
    });
    return true;
  }

  // ---------- 孵化 ----------
  _openEgg(id) {
    const word = WORD_MAP[id];
    if (!word) return;   // 非法/过期 id 静默忽略，别让整局崩掉
    this.currentWord = word;
    this._maybePreloadWhisper(); this._warmMic();
    // 🎧 听音预热：40% 概率先"听发音 → 4 选 1 认词"再孵化（听力识别，离线可用）；
    // 复习蛋保持简单模式直接读，不插听音，免得复习流程被拖长
    const isReview = (this.currentChapter.review || []).includes(word.id);
    if (!isReview && Math.random() < 0.4) { this._listenFirst(word); return; }
    ui.openChallenge({
      word, mode: 'hatch',
      // 常开录音要等示范音播完再启动：开着录就起录的话，扬声器里的示范音会被录进缓冲，
      // 孩子一开口识别到的就是"示范音+人声"的混合，得分自然不准
      easy: isReview,   // 复习蛋简单模式：读一遍就过
      onDemoEnd: () => this._primeRecWhenSafe(),
      onSuccess: res => this._doHatch(word, res && res.score, res && res.via),
      onClose: () => { this.currentWord = null; this._stopPrimeRec(); },
    });
    // 保险：万一示范音链路异常没触发 onDemoEnd，7 秒后兜底开录（识别慢一点总比录不进强）
    clearTimeout(this._primeFallback);
    this._primeFallback = setTimeout(() => {
      if (!this._primeRecActive && this.currentWord
        && (this.preferWhisper || !voiceSupported || isVoiceBroken())) this._primeRecWhenSafe();
    }, 7000);
  }

  // 🎧 听音预热：听发音从 4 个选项里认词，认对接孵化；✕ 关闭则跳过听音直接孵化
  _listenFirst(word) {
    const opts = this._listenOptions(word);
    ui.openChallenge({
      word, mode: 'listen', options: opts,
      onDemoEnd: null,
      onSuccess: () => {
        ui.closeChallenge();
        this._doHatch(word, 92, 'listen');   // 听音认出：92 分，跟"读得不错"同档
      },
      onClose: () => { this.currentWord = null; this._stopPrimeRec(); },
    });
  }

  // 生成听音 4 选 1 选项：正确词 + 3 个同关卡/已学过的干扰词
  _listenOptions(word) {
    const pool = this.scopeWords && this.scopeWords.length ? this.scopeWords : Object.keys(WORD_MAP);
    const others = pool.filter(w => w.id !== word.id && !(this.currentChapter.review || []).includes(w.id)).slice(0, 30);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const list = [word, ...shuffled].map(w => ({ id: w.id, en: w.en, zh: w.zh }));
    return list.sort(() => Math.random() - 0.5);
  }

  // 常开录音的启动时机：等喇叭彻底安静（示范音/喝彩都放完）再开录，避免外放音串进缓冲
  _primeRecWhenSafe() {
    clearTimeout(this._primeTimer);
    this._primeTimer = setTimeout(() => {
      if (!this.currentWord) return;
      if (isSpeaking()) { this._primeRecWhenSafe(); return; }   // 还在出声就再等 300ms
      this._primeRec();
    }, 300);
  }

  _doHatch(word, score = 80, via = 'voice') {
    // 新手引导：第2步完成（读单词孵化成功）→ 进入第3步
    if (this._guide && this._guide.step === 1) { this._guide.step = 2; this._guide.petId = word.id; }
    setTimeout(() => {
      ui.closeChallenge();
      // 仪式感：蛋先越摇越小幅度地晃三下 → 咔嚓裂开 → 星星彩带庆祝 → 词宠蹦出来
      const eggObj = this.eggs.eggs && this.eggs.eggs.get(word.id);
      if (eggObj) {
        const g = eggObj.group;
        this.addTween(0.85, k => {
          const a = Math.sin(k * Math.PI * 9) * (1 - k) * 0.24;
          g.rotation.z = a;
          g.rotation.x = a * 0.5;
        }, () => { g.rotation.z = 0; g.rotation.x = 0; this._hatchReveal(word, score, eggObj, via); });
      } else {
        this._hatchReveal(word, score, null, via);
      }
    }, 280);
  }

  _hatchReveal(word, score, eggObj, via = 'voice') {
    save.hatch(word.id);
    this._faceMood('joy', 2.4);   // 孵出词宠：主角大笑（嘴张开 + 笑眼）
    this.syncRanch();   // 🐾 新词宠入住乐园
    save.addPoint();
    ui.updatePlayerScore(save.getScore(), save.getSessionScore());
    // 星星奖励：读得越准赚得越多（95+ 得 2 颗，80+ 得 1 颗）；FEVER 连击期间翻倍
    const earned = (score >= 95 ? 2 : 1) * (ui.isFever() ? 2 : 1);
    save.addStars(earned);
    ui.updateStars(save.getStars());
    if (save.bumpDaily('hatch2') === 'done') this._afterDaily();
    // “朗读 95 分”每日任务只认真正的朗读，拼字母块不算
    if (score >= 95 && via === 'voice' && save.bumpDaily('goodread') === 'done') this._afterDaily();
    this._chainReward(save.bumpChain('hatch'));
    const golden = !!(eggObj && eggObj.golden);
    const eggPos = eggObj ? eggObj.group.position.clone() : this.player.position.clone().add(new THREE.Vector3(0, 0.6, 0));
    this.eggs.removeEgg(word.id);
    // 词宠出生在蛋的位置（钳到可站位）。不带位置会退回主岛老坐标 word.pos——
    // 城市巡游下那是在城外几百单位的外海，孩子看不到自己的新词宠，“走过去+1”也永远走不到
    const bornAt = this._eggSpot(eggPos.x, eggPos.z);
    const pet = this.pets.spawn(word, { x: bornAt.x, z: bornAt.z, y: eggObj ? (eggObj.baseY || 0) : 0 });
    pet.group.userData.wordId = word.id;
    // 95 分孵出的 = 稀有词宠：带柔光入场
    if (score >= 95) {
      save.markRare(word.id);
      pet.rare = true;
      this._applyRare(pet);
    }
    // 孵化奖励挂起：词宠胶囊的数字先不加，小人走过去后 +1 入账（见 _updateIdleLife）
    ui.petRewardBegin();
    pet.rewardPending = true;
    // 弹出动画 + 字母飞舞
    pet.group.scale.setScalar(0.01);
    this.addTween(0.9, k => {
      const s = 1 + Math.sin(k * Math.PI) * 0.35;
      pet.group.scale.setScalar(0.01 + (s - 0.01) * (1 - Math.pow(1 - k, 3)));
    }, () => pet.group.scale.setScalar(1));
    pet.jumping = true; pet.jt = 0;
    this._letterBurst(pet.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)), word.en);
    this._starBurst(eggPos.add(new THREE.Vector3(0, 1.2, 0)), golden ? 10 : 6);
    sfx.crack();
    setTimeout(() => sfx.magic(), 180);
    // 屏幕层庆祝：彩带雨 + 震动，金蛋最华丽
    ui.confettiBurst(golden ? 110 : 70);
    ui.vibrate([20, 40, 20, 40, 60]);
    ui.toast(t('y.eggGot', { a0: word.en, a1: word.zh, a2: earned, a3: golden ? t('y.41') : '' }), 3400);
    // 收集里程碑：每孵满 10 只词宠解锁一份礼物（帽子/气球/魔棒，全有时送星星）
    const milestone = save.checkCollectReward();
    if (milestone) setTimeout(() => {
      sfx.evolve();
      ui.confettiBurst(90);
      ui.toast(t('y.42', { a0: Math.floor(milestone.count / 10) * 10, a1: milestone.gift.name, a2: milestone.gift.emoji }), 5200);
    }, 2200);
    speak(word.en);
    this._refreshHungry();
    this._checkFirstHatchHint();
    // 通关唯一条件：本关的蛋全部孵化。全册孵完走收官演出；
    // 刚孵的词所在关全部孵完才放通关演出（doneCount = 已完成关数，与 _enterChapter 对齐）
    const total = this.hatchedInScope();
    if (total >= this.total) {
      setTimeout(() => this._chapterComplete(this.chapters.length), 1100);
    } else {
      const doneIdx = this.chapters.findIndex(ch => ch.words.includes(word.id));
      const after = this.chapterIndex();
      if (doneIdx >= 0 && doneIdx === after - 1) {
        setTimeout(() => this._chapterComplete(after), 1100);
      } else if (this._chapterQuizIds().includes(word.id)) {
        // 孵化小测：演出收尾后弹听音选义（被通关取代时不出，别抢戏）
        setTimeout(() => this._runHatchQuiz(word), 2600);
      }
    }
  }

  // 喂养节奏与关卡挂钩：每完成一关，唤醒最多 2 只旧词宠的想念（淘气词优先），
  // 让"推进越快、复习越勤"而不是"越肝复习越欠账"。淘气词被喂饱即完成错词驯服。
  _wakeReviewPets(doneCount) {
    const nextCh = this.chapters[doneCount];
    const owned = Object.keys(save.getSave().pets || {})
      .filter(id => !nextCh || !nextCh.words.includes(id))   // 新一关的蛋不掺和
      .filter(id => !save.isHungry(id));
    if (!owned.length) return;
    const naughty = new Set(Object.keys(save.getSave().naughty || {})
      .filter(id => save.getSave().naughty[id] && !save.getSave().naughty[id].caughtOn));
    const pool = owned.slice().sort((a, b) => (naughty.has(b) ? 1 : 0) - (naughty.has(a) ? 1 : 0));
    const wake = pool.slice(0, 2);
    for (const id of wake) save.makeHungry(id);
    if (wake.length) this._refreshHungry();
  }

  // 孵化小测：听音选义 3 选 1，测「刚学的词听懂了没」。答对 +1⭐、词宠雀跃；
  // 答错不拦路——自动重播读音后必过，词悄悄进错词本（markNaughty），
  // 之后随淘气词宠复习。永无失败惩罚
  _runHatchQuiz(word) {
    if (this.lockInput || ui.challengeOpen() || this.cinematic) return;
    const pool = this.scopeWords.filter(w => w.id !== word.id && w.zh && w.zh !== word.zh);
    const distractors = [];
    while (distractors.length < 2 && pool.length) {
      distractors.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    const all = [word, ...distractors].sort(() => Math.random() - 0.5);
    ui.showWordQuiz({
      en: word.en,
      opts: all.map(w => (w.icon ? w.icon + ' ' : '') + w.zh),
      answer: all.findIndex(w => w.id === word.id),
      onGood: () => {
        save.addStars(1);
        ui.updateStars(save.getStars());
        if (this.pets.get(word.id)) this.pets.celebrate(word.id);   // 答对：本尊词宠跳起来
      },
      onWrong: () => {
        save.markNaughty(word.id);   // 进错词本，隔天淘气词宠回来复习
      },
    });
  }

  // 通关演出：全场欢呼 → 星星 → 换装新一关区域 + 新蛋登场 → 全屏通关卡 → 镜头飞向新蛋区
  _chapterComplete(doneCount) {
    sfx.great();
    setTimeout(() => sfx.magic(), 350);
    save.addStars(3);
    ui.updateStars(save.getStars());
    this._wakeReviewPets(doneCount);   // 喂养节奏与关卡挂钩：通关即唤醒旧词宠的想念，把复习织进推进
    const p = this.player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    this._letterBurst(p, '★✨⭐');
    this._starBurst(p, 6);
    // 全场词宠一起跳起来欢呼（此起彼伏）
    dispatchEvent(new Event('wordpet:cheer'));
    const next = this.chapters[doneCount];
    if (next) this._dressChapter(doneCount);          // 真场景变化：新一关区域主题换装
    this._spawnProgress();
    this._refreshHungry();
    this.lockInput = true;                             // 演出期间锁操作
    setTimeout(() => {
      const done = this.chapters[doneCount - 1];
      ui.showLevelComplete({
        index: doneCount,
        name: done.name,
        words: done.words.map(id => WORD_MAP[id]).filter(Boolean),
        last: !next,
        onNext: () => {
          if (next) this._enterChapter(doneCount);
          else this._bookDone();
        },
      });
    }, 1200);
  }

  // 点了"继续冒险"：猫头鹰送奖说话 + 镜头飞向新一关第一颗蛋 → 开始横幅
  _enterChapter(doneCount) {
    const ch = this.chapters[doneCount];
    this._forceChapter = null;   // 回到按进度组关（退出奖励探索）
    if (this.cityTour) {
      // 城市巡游：搬进新城 → 城市介绍卡（介绍/名校/美食/风景 Tab + 小问答）→ 出发探索
      this._switchCity(doneCount);
      const st = this._currentStage();
      const visit = save.visitCity(this.sem + ':' + st.key);
      const moods = ['farm', 'beach', 'forest'];
      setBgmMood(moods[st.key.length % 3]);   // 每座城市换一种背景音乐情绪
      setBgmCity(st.key);                     // 一城一调：调性/速度按城市个性变奏
      this._refreshCityPill();
      this._owlDeliver(t('x.g386', { a0: st.name }));
      setTimeout(() => {
        // 刚看完引导（20 秒内）：城市介绍已在引导最后一页看过，不再叠弹城市卡打断节奏
        const fresh = !save.getIntro() || (this._introDoneAt && Date.now() - this._introDoneAt < 20000);
        if (fresh) {
          const egg = ch.words.map(id => this.eggs.get(id)).find(e => e && e.group && e.group.visible);
          const go = () => {
            ui.chapterBanner(t('y.43', { a0: doneCount + 1, a1: ch.name, a2: st.name, a3: st.emoji }));
            this.lockInput = false;
            this._clearMoveTarget();
          };
          if (egg) this._flyTo(egg.group.position, go);
          else go();
          return;
        }
        ui.showCityCard({
          city: st.city, variant: cityVariant(st.city, visit), visit,
          quiz: getCityQuiz(st.key),
          isFinal: st.key === this.cityRouteList[this.cityRouteList.length - 1],
          onStar: () => { save.addStars(1); ui.updateStars(save.getStars()); },
          onDone: () => {
            const egg = ch.words.map(id => this.eggs.get(id)).find(e => e && e.group && e.group.visible);
            const go = () => {
              ui.chapterBanner(t('y.43', { a0: doneCount + 1, a1: ch.name, a2: st.name, a3: st.emoji }));
              this.lockInput = false;
              this._clearMoveTarget();
            };
            if (egg) this._flyTo(egg.group.position, go);
            else go();
          },
        });
      }, 1200);
      return;
    }
    this._owlDeliver(t('y.44', { a0: doneCount + 1, a1: ch.name }));
    const egg = ch.words.map(id => this.eggs.get(id)).find(e => e && e.group && e.group.visible);
    const go = () => {
      ui.chapterBanner(t('y.45', { a0: doneCount + 1, a1: ch.name }));
      this.lockInput = false;
      this._clearMoveTarget();
    };
    if (egg) this._flyTo(egg.group.position, go);
    else go();
  }

  // 本册全部通关：烟花秀 + 走遍祖国成就卡 + 收尾横幅
  _bookDone() {
    this._fireworks();
    ui.chapterBanner(t('x.g390'));
    this.lockInput = false;
    if (this.cityTour) {
      const visited = this.cityRouteList.map(id => {
        const c = CITY_MAP[id];
        const v = (save.getSave().cityVisits?.[this.sem + ':' + id]) || 0;
        return { name: c.name, emoji: cityVariant(c, Math.max(0, v - 1)).emoji };
      });
      setTimeout(() => ui.showTravelBadge(visited, () => {
        const bonus = bonusCities();
        if (bonus.length) ui.showBonusCities(bonus, id => this._enterBonusCity(id));
      }), 1800);
    }
  }

  // ---------- 好友分享链接跳转 ----------
  // ?city=chengdu：路线城=已解锁则跳过去继续玩（未解锁提示按顺序）；奖励城=通关后才能去
  // debug=true（链接带 &debug）：调试模式，不受通关限制，任何城市立即进入玩耍
  async _handleShareCity(id, debug = false) {
    if (!id) return;
    if (debug && !CITY_MAP[id]) await ensureCityData(id);
    if (!CITY_MAP[id]) return;
    if (debug) { this._enterBonusCity(id, true); return; }
    const routeIdx = this.cityRouteList.indexOf(id);
    const done = this.hatchedInScope() >= this.total;
    if (routeIdx < 0) {
      // 不在巡游路线：家乡/奖励城走解锁判断
      if (done) { this._enterBonusCity(id); return; }
      const isBonus = bonusCities().some(c => c.id === id);
      ui.toast(isBonus ? t('x.g391') : t('x.g392'), 3600);
      return;
    }
    const chIdx = this.chapterIndex(this.hatchedInScope());
    if (routeIdx > chIdx) {
      ui.toast(t('x.g393'), 3600);
      return;
    }
    if (routeIdx === chIdx) return;   // 已经在这座城
    // 已解锁的历史城市：直接跳回去继续玩（重温城市卡）
    this._switchCity(routeIdx);
    this._refreshCityPill();
    const st = this.islands[routeIdx];
    ui.chapterBanner(t('x.g394', { a0: st.name, a1: st.emoji }));
    this.lockInput = false;
    this._clearMoveTarget();
  }

  // ---------- 通关奖励城市 ----------
  // 北京通关后解锁：order=0 的城市可自由前往（组关=复习已学词+词池补充，重在巩固与探索）
  async _enterBonusCity(id, debug = false) {
    if (this._bonusBusy) return;
    // 奖励城市需通关本册（孵完全册词、抵达北京）才解锁；debug 直达不校验
    if (!debug && this.hatchedInScope() < this.total) {
      ui.toast(t('x.g391'), 3200);
      return;
    }
    this._bonusBusy = true;
    try {
      await ensureCityData(id);
      if (!CITY_MAP[id]) { ui.toast(t('x.g395')); return; }
      let idx = this.islands.findIndex(isl => isl.key === id);
      if (idx >= 0) {
        // 目标城已在巡游岛上（debug 直达未解锁的路线城）：锁定舞台到该城，
        // 否则 _currentStage/currentChapter 仍按进度指回家乡城——胶囊显示旧城、蛋刷成旧城的词
        this._forceChapter = this.islands[idx].startChapter;
      } else {
        // 追加城市舞台：位置放到巡游圈外一层，避免与已有城市重叠
        const i = this.islands.length;
        const c = CITY_MAP[id];
        const lv = c.level || {};
        const a = (i / this.islands.length) * Math.PI * 2 + 1.1;
        const dist = 880;   // 追加城市放到巡游圈外一层（不与环上城市重叠）
        const v0 = cityVariant(c, 0);
        const rr = Math.round((lv.radius || 28) * (3 + Math.min(1.3, ((c.unis||[]).length + (c.foods||[]).length + (c.scenes||[]).length) * 0.012)) * CITY_SCALE);
        const shape = getCityShape(id, lv.shape).map(([sx, sz]) => [sx * rr, sz * rr]);
        this.islands.push({
          key: id, uid: id + '#' + i, name: c.name, en: c.en, emoji: v0.emoji, color: c.color,
          cx: Math.cos(a) * dist, cz: Math.sin(a) * dist, r: rr, shape,
          landmark: c.landmark, decos: c.variants.map(v => DECO_EMOJI[v.deco] || '🏮'),
          startChapter: this.chapters.length, unis: c.unis, city: c, level: lv,
          terrain: c.terrain || null,
          chapterName: c.name + t('x.g396'), bonus: true,
        });
        // 奖励关：复习 8 + 新词 4（词池里未学过的），seed=昵称+册+城市，稳定可重玩
        const unlearned = this.scopeWords.map(w => w.id).filter(w => !save.isHatched(w));
        const rand = makeSeedRand(save.getUsername() + '|' + this.sem + '|bonus|' + id);
        const bag = shuffleSeed(unlearned, rand);
        const fresh = bag.slice(0, 4);
        const learnedPool = this.scopeWords.map(w => w.id).filter(w => save.isHatched(w));
        // 数据驱动复习：错词本里的词（miss 高者优先）先进复习蛋，最多 5 个；其余随机补足 8 个
        const wrongIds = Object.keys(save.getSave().naughty || {})
          .filter(w => save.isHatched(w))
          .sort((a, b) => ((save.getSave().naughty[b] || {}).misses || 0) - ((save.getSave().naughty[a] || {}).misses || 0))
          .slice(0, 5);
        const rest = shuffleSeed(learnedPool.filter(w => !wrongIds.includes(w)), rand);
        const review = [...wrongIds, ...rest].slice(0, 8);
        const words = [...fresh, ...review];
        this.chapters.push({ name: c.name + t('x.g396'), words, review, bonus: true });
        idx = i;
        this._forceChapter = this.chapters.length - 1;   // 蛋从奖励关出（普通巡游时清除）
        // 运行时补建精建岛（网格+碰撞+装饰），并塞回数据岛供显隐切换
        if (this.world && this.world.buildIsland) {
          const built = this.world.buildIsland(this.islands[i]);
          if (built && built.grp) {
            this._autoColliders(built.grp);
            this.islands[i].grp = built.grp;
            // buildIsland 会把建好的岛从 world.islands 弹出；不登记回去的话，
            // 换城显隐循环管不到它（离开这座城它仍渲染），重进还会再建一套副本
            this.world.islands.push(built);
          }
        }
      }
      this._switchCity(idx);
      // 清掉未孵的旧蛋（正常通关路径不会有，防御 hack/异常进度），再按当前关进度出蛋
      // （在途城 debug 直达时 currentChapter=该城的路线关，追加奖励城时=刚推入的奖励关）
      const keepWords = this.currentChapter.words;
      for (const [eid, eg] of this.eggs.eggs) {
        if (!eg.group.visible) continue;
        if (keepWords.includes(eid)) continue;
        this.eggs.removeEgg(eid);
      }
      this._spawnProgress();   // 按新进度生成奖励关的蛋（部分在牌子旁）
      const st = this.islands[idx];
      setBgmMood('forest');
      this._refreshCityPill();
      const visit = save.visitCity(this.sem + ':' + st.key);
      ui.showCityCard({
        city: st.city, variant: cityVariant(st.city, visit), visit,
        quiz: getCityQuiz(st.key), bonus: true,
        onStar: () => { save.addStars(1); ui.updateStars(save.getStars()); },
        onDone: () => {
          ui.chapterBanner(t('x.g397', { a0: st.name }));
          this.lockInput = false;
          this._clearMoveTarget();
        },
      });
    } finally {
      this._bonusBusy = false;
    }
  }

  // 镜头 cinematic：飞到目标上空环视 1 秒，再回到玩家机位（与轨道相机公式一致，落回不跳变）
  _flyTo(target, onDone) {
    this.cinematic = true;
    this._clearMoveTarget();
    const cam = this.camera;
    const player = this.player.position;
    const from = cam.position.clone();
    const lookFrom = player.clone().add(new THREE.Vector3(0, 1.4, 0));
    const lookTo = target.clone().add(new THREE.Vector3(0, 1, 0));
    // 目标机位：蛋的斜上后方，能看到蛋和周围换装的区域
    const dir = target.clone().sub(player).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const to = target.clone().add(dir.multiplyScalar(7)).add(new THREE.Vector3(0, 5.5, 0));
    const orbit = new THREE.Vector3(
      player.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist,
      player.y + Math.sin(this.camPitch) * this.camDist + 1.6,
      player.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist
    );
    const look = lookFrom.clone();
    const sfx2 = setTimeout(() => sfx.magic(), 400);
    this.addTween(2.4, k => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cam.position.lerpVectors(from, to, e);
      look.lerpVectors(lookFrom, lookTo, e);
      cam.lookAt(look);
    }, () => {
      setTimeout(() => {
        // 回程：落回当前 camYaw/camPitch/camDist 对应的机位，交还控制时不跳变
        this.addTween(1.0, k => {
          const e = k * k * (3 - 2 * k);
          cam.position.lerpVectors(to, orbit, e);
          look.lerpVectors(lookTo, lookFrom, e);
          cam.lookAt(look);
        }, () => {
          this.cinematic = false;
          clearTimeout(sfx2);
          onDone && onDone();
        });
      }, 1100);   // 在新区域上空停留 1 秒看看换装效果
    });
  }

  // 关卡主题换装：给第 idx 关（0 起）词蛋集中的区域布置主题装饰 + 氛围灯
  _dressChapter(idx) {
    if (this.cityTour) return;   // 城市巡游：城市舞台自带主题装饰，不再给主岛换装
    const ch = this.chapters[idx];
    if (!ch || !this.world.dressChapter) return;
    // 统计本关词落在哪里，选蛋最多的区域
    const count = {};
    for (const id of ch.words) {
      const z = WORD_MAP[id] && WORD_MAP[id].zone;
      if (z && ZONE_RECTS.some(r => r.key === z)) count[z] = (count[z] || 0) + 1;
    }
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    if (!top) return;
    const rect = ZONE_RECTS.find(r => r.key === top[0]);
    // 每关一个主题色（按关卡序号轮换）
    const THEMES = [
      { accent: '#FF8FB0', emoji: '🌸', name: t('x.g398') },
      { accent: '#FFC94E', emoji: '🌼', name: t('x.g399') },
      { accent: '#7EC4F2', emoji: '💙', name: t('x.g400') },
      { accent: '#C6A5F0', emoji: '🔮', name: t('x.g401') },
      { accent: '#8FD08F', emoji: '🍀', name: t('x.g402') },
      { accent: '#FF9F68', emoji: '🍊', name: t('x.g403') },
    ];
    const theme = THEMES[idx % THEMES.length];
    this.world.dressChapter(rect.x1, rect.z1, rect.x2, rect.z2, theme);
    ui.toast(t('x.g404', { a0: theme.emoji, a1: ch.name, a2: theme.name, a3: rect.name }), 4200);
  }

  // 猫头鹰园丁送奖演出：扑棱到玩家身边 → 气泡说话 + 撒星星 → 飞回木桩
  _owlDeliver(text) {
    const owl = this.world.anim.owl;
    if (!owl || this._owlBusy) return;
    this._owlBusy = true;
    const home = owl.position.clone();
    const dest = this.player.position.clone().add(new THREE.Vector3(1.7, 0, 1.7));   // 落在玩家侧边地面
    sfx.pop();
    this.addTween(1.2, k => {
      const e = 1 - Math.pow(1 - k, 2);
      owl.position.lerpVectors(home, dest, e);
      owl.position.y += Math.sin(k * Math.PI) * 0.9;   // 飞行弧线
      owl.rotation.y = Math.PI * 0.85;
    }, () => {
      this._owlSay(owl, text);
      this._starBurst(owl.position.clone(), 5);
      sfx.magic();
      setTimeout(() => {
        this.addTween(1.1, k => {
          owl.position.lerpVectors(dest, home, k * k);
          owl.position.y += Math.sin(k * Math.PI) * 0.6;
        }, () => { owl.rotation.y = 0; this._owlBusy = false; });
      }, 2400);
    });
  }

  // 词宠说话气泡：文字版（"小主人，我饿了"等）
  _petSay(pet, text, dur = 1.8) {
    const tex = speechBubbleTexture(text, '💬');
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(2.3, 1.61, 1);   // 贴图 320x224，保持比例
    s.position.copy(pet.group.position).add(new THREE.Vector3(0, 1.45, 0));
    this.scene.add(s);
    this.fx.push({
      obj: s, t: 0, dur,
      update: (t, dt) => {
        s.position.y += dt * 0.15;
        s.material.opacity = t > dur - 0.5 ? Math.max(0, 1 - (t - (dur - 0.5)) / 0.5) : 1;
      },
    });
  }

  // 词宠表情气泡：头顶冒表情（饿/开心/想念），1.6 秒上浮淡出
  _petEmoji(pet, emoji) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: letterTexture(emoji, '#FFFDF6', '#5C4A38'), transparent: true, depthWrite: false,
    }));
    s.scale.setScalar(0.55);
    s.position.copy(pet.group.position).add(new THREE.Vector3(0, 1.5, 0));
    this.scene.add(s);
    this.fx.push({
      obj: s, t: 0, dur: 1.6,
      update: (t, dt) => {
        s.position.y += dt * 0.4;
        s.material.opacity = t > 1 ? Math.max(0, 1 - (t - 1) / 0.6) : 1;
      },
    });
  }

  // 情景单词气泡：物件上方飘出"单词+中文"，慢慢上浮消散
  _sceneBubble(s, w) {
    const tex = speechBubbleTexture(`${w.en} ${w.zh}`, s.emoji);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(2.4, 1.68, 1);
    sp.position.set(s.x, 2.2, s.z);
    this.scene.add(sp);
    this.fx.push({
      obj: sp, t: 0, dur: 5,
      update: (t, dt) => {
        sp.position.y += dt * 0.25;
        sp.material.opacity = t > 4 ? Math.max(0, 1 - (t - 4)) : 1;
      },
    });
    this._starBurst(new THREE.Vector3(s.x, 1.6, s.z), 3);
  }

  // 猫头鹰头顶的说话气泡（复用词宠短语气泡的绘制）
  _owlSay(owl, text) {
    // 气泡按空格换行，中文没有空格会挤成一行溢出：每 6 个字插一个空格辅助断行
    const wrapped = String(text).replace(/(.{6})/g, '$1 ');
    const tex = speechBubbleTexture(wrapped, '🦉');
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(2.6, 1.82, 1);   // 贴图 320x224，保持比例
    sp.position.copy(owl.position).add(new THREE.Vector3(0, 1.3, 0));
    this.scene.add(sp);
    this.fx.push({
      obj: sp, t: 0, dur: 2.3,
      update: (t, dt) => {
        sp.position.y += dt * 0.12;
        sp.material.opacity = t > 1.7 ? Math.max(0, 1 - (t - 1.7) / 0.6) : 1;
      },
    });
  }

  // 星星从指尖飞起（拿星星时的小演出）
  _starBurst(pos, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture('⭐', '#FFE08A', '#FFB93C'), transparent: true, depthWrite: false,
      }));
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.5, (Math.random() - 0.5) * 0.8));
      s.scale.setScalar(0.24);
      this.scene.add(s);
      this.fx.push({
        obj: s, t: -i * 0.12, dur: 1.1,
        update: (t, dt) => {
          if (t < 0) { s.material.opacity = 0; return; }
          s.position.y += dt * 1.6;
          s.material.opacity = Math.max(0, 1 - t / 1.1);
        },
      });
    }
    // 归航：几颗星星飞进 HUD 星星胶囊（投影复用任务气泡的做法）
    this._v3 = this._v3 || new THREE.Vector3();
    this._v3.copy(pos).project(this.camera);
    if (this._v3.z < 1) {
      ui.homeStars(
        (this._v3.x * 0.5 + 0.5) * innerWidth,
        (-this._v3.y * 0.5 + 0.5) * innerHeight,
        Math.min(3, n)
      );
    }
  }

  // 集齐全部词宠的烟花秀
  _fireworks() {
    for (let r = 0; r < 8; r++) {
      setTimeout(() => {
        const bx = this.player.position.x + (Math.random() - 0.5) * 16;
        const bz = this.player.position.z + (Math.random() - 0.5) * 16;
        const by = 6 + Math.random() * 4;
        const color = ['#FF6B6B', '#FFC94E', '#7EC4F2', '#8FD08F', '#FF8FB0', '#B28FF5'][r % 6];
        // 上升的火箭
        const rocket = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('✦', color, '#FFF'), transparent: true }));
        rocket.position.set(bx, 0.5, bz);
        this.scene.add(rocket);
        this.fx.push({
          obj: rocket, t: 0, dur: 0.85,
          update: t => { rocket.position.y = 0.5 + (by / 0.85) * t; rocket.material.opacity = 1 - t / 0.85; },
        });
        // 炸开的花
        setTimeout(() => {
          sfx.pop();
          for (let i = 0; i < 14; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('✦', color, '#FFFDF0'), transparent: true }));
            s.position.set(bx, by, bz);
            s.scale.setScalar(0.26);
            this.scene.add(s);
            const a = Math.PI * 2 * i / 14 + Math.random() * 0.4;
            const sp = 2.2 + Math.random() * 1.6;
            this.fx.push({
              obj: s, t: 0, dur: 1.3,
              update: (t, dt) => {
                s.position.x += Math.cos(a) * sp * dt;
                s.position.z += Math.sin(a) * sp * dt;
                s.position.y += (2.4 - t * 2.2) * dt;
                s.material.opacity = Math.max(0, 1 - t / 1.3);
              },
            });
          }
        }, 850);
      }, r * 420);
    }
  }

  _letterBurst(pos, word) {
    const letters = word.split('').filter(c => c !== ' ');
    for (let i = 0; i < letters.length * 2; i++) {
      const tex = letterTexture(letters[i % letters.length], ['#FF8FB0', '#FFC94E', '#7EC4F2', '#8FD08F'][i % 4]);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      s.position.copy(pos);
      s.scale.setScalar(0.001);
      this.scene.add(s);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 3, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 3);
      this.fx.push({
        obj: s, t: 0, dur: 1.4,
        update: t => {
          vel.y -= 6 * (1 / 60);
          s.position.addScaledVector(vel, 1 / 60);
          s.material.opacity = Math.max(0, 1 - t / 1.4);
          s.scale.setScalar(0.3 * Math.min(1, t * 6));
        },
      });
    }
    // 星星粒子
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture('✦', '#FFE24E', '#FFF6B8'), transparent: true,
      }));
      s.position.copy(pos);
      this.scene.add(s);
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.4;
      this.fx.push({
        obj: s, t: 0, dur: 0.9,
        update: t => {
          s.position.set(pos.x + Math.cos(a) * r * (t / 0.9), pos.y + Math.sin(t * 9 + i) * 0.2 + t * 1.2, pos.z + Math.sin(a) * r * (t / 0.9));
          s.material.opacity = 1 - t / 0.9;
          s.scale.setScalar(0.22);
        },
      });
    }
  }

  _checkFirstHatchHint() {
    if (save.hatchedCount() === 1) {
      const how = this.isTouch ? t('x.g406') : t('x.g407');
      setTimeout(() => ui.toast(t('y.46', { a0: how }), 4200), 2500);
    }
  }

  // ---------- 喂养 ----------
  _nearHungryPet(pos, r) {
    let best = null, bd = r;
    for (const pet of this.pets.all()) {
      if (!save.isHungry(pet.word.id)) continue;
      const d = Math.hypot(pet.group.position.x - pos.x, pet.group.position.z - pos.z);
      if (d < bd) { bd = d; best = pet; }
    }
    return best;
  }

  _feedPet(id) {
    const word = WORD_MAP[id];
    this.currentWord = word;
    this._maybePreloadWhisper(); this._warmMic();
    ui.openChallenge({
      word, mode: 'feed',
      // 读了/拼对了：额外加分和星星（复习巩固的奖励）
      onSuccess: () => {
        setTimeout(() => {
          ui.closeChallenge();
          save.feed(id);
          save.addPoint();
          ui.updatePlayerScore(save.getScore(), save.getSessionScore());
          save.addStars(ui.isFever() ? 2 : 1);
          ui.updateStars(save.getStars());
          if (save.bumpDaily('feed2') === 'done') this._afterDaily();
          this._bumpTask('feed');
          this._chainReward(save.bumpChain('feed'));
          sfx.good();
          ui.toast(t('x.g409', { a0: word.en }), 3000);
          // 💬 词宠用英文道谢（纯展示+朗读，不加挑战）：情感反馈里多一句语言输入
          this._fact = { id, until: performance.now() + 4200 };
          ui.showPetFact(t('x.g410', { a0: word.en }), 'Thank you! Yummy yummy!');
          speak('Thank you! Yummy yummy!');
          // 喂满 3 次触发进化：长大一圈、戴上星星光环
          const d = save.getSave().pets[id];
          if (d && d.feeds >= 3 && !d.evo) {
            save.markEvolved(id);
            const pet = this.pets.get(id);
            if (pet) this._applyEvolved(pet, true);
          }
          this._refreshHungry();
        }, 280);
      },
      // 关闭卡片 = 喂完（读不读、拼不拼都可以，重点是见到词宠复习一遍）
      onClose: () => {
        this.currentWord = null;
        this._feedDone(id);
      },
    });
  }

  // 喂完：词宠说谢谢，1 秒后气泡消失；读了/拼对了会先走 onSuccess 的加分奖励
  _feedDone(id) {
    if (this._feedDoneAt && performance.now() - this._feedDoneAt < 800) return;   // onSuccess→closeChallenge 会连触发，防重复计次
    this._feedDoneAt = performance.now();
    save.feed(id);
    const pet = this.pets.get(id);
    this.pets.setHungry(id, false);
    this.pets.celebrate(id);
    if (pet) this._petSay(pet, t('x.g411'), 1.2);
    sfx.good();
    this._refreshHungry();
  }

  _refreshHungry() {
    // 同时“想你”的词宠最多 4 只：自然饥饿是批次性的（首喂间隔才 10 分钟），
    // 不封顶会全城词宠一起饿、一起冲过来冒泡泡。超出的先“错峰”，饿得最久的优先
    const HUNGRY_CAP = 4;
    const hungry = save.hungryPets();
    if (hungry.length > HUNGRY_CAP) {
      hungry.sort((a, b) => save.hungryIn(a) - save.hungryIn(b));
      for (const id of hungry.slice(HUNGRY_CAP)) save.snoozeHungry(id, 120 + Math.random() * 240);
    }
    for (const pet of this.pets.all()) {
      const hungry = save.isHungry(pet.word.id);
      if (hungry && !pet.hungry && this._started) this._petEmoji(pet, '🍖');   // 刚开始想你了：头顶冒🍖
      pet.hungry = hungry;
      this.pets.setHungry(pet.word.id, hungry);
    }
    // HUD 显示本关进度：第 X 关 · 本关唤醒 n/本关词数（首关 12 词垫满，其余 6+6）
    const chIdx = this.chapterIndex();
    const chWords = this.chapters[chIdx].words;
    const inChapter = chWords.filter(id => save.isHatched(id)).length;
    ui.updateHUD(inChapter, chWords.length, save.hungryPets().length, t('y.47', { a0: BOOK_LABEL(this.sem), a1: chIdx + 1 }));
  }

  // ---------- 召唤解谜 ----------
  // 机关 = 一则谜语。孩子要读懂谜面，从自己的词宠里挑出对的那一只；
  // 猜错不惩罚（词宠摇头回家），第一次就猜对额外奖 3 颗星星。
  _activeGate() {
    const p = this.player.position;
    // 城市巡游：机关任务牌跟着钥匙蛋走——玩家靠近任务牌（蛋的孵化点）就地解谜
    if (this.cityTour && this._cityGatePos) {
      const needMap = { boat: 'boat', light: 'light', wind: 'wind', seed: 'planted', rain: 'beanstalk', banana: 'vines' };
      for (const [wid, pt] of Object.entries(this._cityGatePos)) {
        const gid = needMap[wid];
        if (!gid || save.hasGate(gid)) continue;
        if (wid === 'rain' && !save.hasGate('planted')) continue;   // 先种下种子才轮到浇水
        if (Math.hypot(p.x - pt.x, p.z - pt.z) < 4) {
          const cfg = this._gateConfig(wid);
          if (cfg) return { ...cfg, point: new THREE.Vector3(pt.x, 0, pt.z) };
        }
      }
      return null;
    }
    return this._mainIsleGate(p);
  }
  // 钥匙词 → 机关谜语配置（城市任务牌用）
  _gateConfig(wid) {
    const MAP = {
      boat: { id: 'boat', need: ['boat'], riddle: t('x.g413') },
      light: { id: 'light', need: ['light'], riddle: t('x.g414') },
      wind: { id: 'wind', need: ['wind'], riddle: t('x.g415') },
      seed: { id: 'beanstalkSeed', need: ['seed'], riddle: t('x.g416') },
      rain: { id: 'beanstalkRain', need: ['rain'], riddle: t('x.g417') },
      banana: { id: 'vines', need: ['banana'], riddle: t('x.g418') },
    };
    return MAP[wid] || null;
  }
  // 主岛实体机关（老家可玩，城市模式下非必经）
  _mainIsleGate(p) {
    if (!save.hasGate('boat') && Math.hypot(p.x, p.z - 4.6) < 5 && Math.abs(p.x) < 8)
      return { id: 'boat', need: ['boat'], riddle: t('x.g413'), point: new THREE.Vector3(0, 0, 2.2) };
    if (!save.hasGate('wind') && Math.hypot(p.x - 13, p.z + 6.5) < 4)
      return { id: 'wind', need: ['wind'], riddle: t('x.g415'), point: new THREE.Vector3(13, 0, -8) };
    if (!save.hasGate('light') && Math.hypot(p.x - 24, p.z - 18.8) < 4.5)
      return { id: 'light', need: ['light'], riddle: t('x.g414'), point: new THREE.Vector3(24, 0, 20) };
    if (!save.hasGate('beanstalk') && Math.hypot(p.x + 22, p.z - 25) < 5) {
      if (!this.planted) return { id: 'beanstalkSeed', need: ['seed'], riddle: t('x.g416'), point: new THREE.Vector3(-22, 0, 26) };
      return { id: 'beanstalkRain', need: ['rain'], riddle: t('x.g417'), point: new THREE.Vector3(-22, 0, 26) };
    }
    if (!save.hasGate('sandWall') && p.z > 30 && Math.abs(p.x) < 32)
      return { id: 'sandWall', need: ['wind'], riddle: t('x.g419'), point: new THREE.Vector3(0, 0, 37.2) };
    if (!save.hasGate('vines') && p.x < -31)
      return { id: 'vines', need: ['banana'], riddle: t('x.g418'), point: new THREE.Vector3(-38, 0, p.z > 0 ? 11 : -11) };
    return null;
  }

  _openSummon(gate = null) {
    if (ui.challengeOpen()) return;
    gate = gate || this._activeGate();
    // 谜底的词宠还没孵出来时，召唤盘里注定没有答案——与其让孩子对着错误选项发呆，
    // 不如直接告诉他谜底是什么、去哪片区域找蛋
    if (gate) {
      const missing = gate.need.filter(id => !save.isHatched(id));
      if (missing.length) {
        const names = missing.map(id => {
          const w = WORD_MAP[id];
          const where = ZONE_NAMES[w.zone] ? t('y.48', { a0: ZONE_NAMES[w.zone] }) : '';
          return `「${w.en}」${w.zh}${where}`;
        });
        ui.toast(t('y.49', { a0: names.join('、') }), 5600);
        return;
      }
    }
    const list = this.pets.all().map(p => ({
      id: p.word.id, en: p.word.en, zh: p.word.zh,
      thumb: () => petThumbnail(p.word.pet),   // 懒生成：召唤盘可能有几百只，列表构建时同步画会卡死
    }));
    if (!list.length) { ui.toast(t('x.g422')); return; }
    this.pendingGate = gate;
    // 有机关在身边时，标题就是谜语：读懂谜面，挑对词宠
    ui.openPicker(list, id => this._summon(id, gate), () => { this.pendingGate = null; },
      gate ? { title: '🤔 ' + gate.riddle } : {});
  }

  _summon(id, gate) {
    const word = WORD_MAP[id];
    speak(word.en);
    const pet = this.pets.get(id);
    this._chainReward(save.bumpChain('summon'));
    if (save.bumpDaily('summon3') === 'done') this._afterDaily();
    if (!gate) {
      // 随便召唤：小家伙飞过来打个招呼
      const p = this.player.position.clone().add(new THREE.Vector3(Math.sin(this.player.rotation.y) * -1.6, 0, Math.cos(this.player.rotation.y) * -1.6));
      this.pets.flyTo(id, p, 1.1, () => { pet.jumping = true; pet.jt = 0; });
      ui.toast(t('x.g423', { a0: word.en, a1: word.zh }));
      return;
    }
    const target = gate.point.clone();
    if (gate.need.includes(id)) {
      const tries = this.gateTries[gate.id] || 0;
      if (tries === 0 && gate.id !== 'boat') {
        // 一次答对：聪明星奖励（第一个 boat 机关是必经教学关，不算）；FEVER 期间翻倍
        save.addStars(ui.isFever() ? 6 : 3);
        ui.updateStars(save.getStars());
        setTimeout(() => ui.toast(t('x.g424'), 2800), 200);
        this._starBurst(pet.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 3);
      }
      if (save.bumpDaily('gate1') === 'done') this._afterDaily();
      this.gateTries[gate.id] = 0;
      this.pets.flyTo(id, target, 1.2, () => {
        pet.jumping = true; pet.jt = 0;
        this._applyGate(gate.id, pet);
      });
    } else {
      this.gateTries[gate.id] = (this.gateTries[gate.id] || 0) + 1;
      const tries = this.gateTries[gate.id];
      this.pets.flyTo(id, target, 1.1, () => {
        ui.toast(t('x.g425', { a0: word.en, a1: word.zh }), 3000);
        this.addTween(0.5, k => pet.group.rotation.y = Math.sin(k * Math.PI * 4) * 0.4, () => {
          pet.group.rotation.y = 0;
          this.pets.flyTo(id, new THREE.Vector3(pet.home.x, 0, pet.home.y), 1.1);
          // 猜错两次后层层加提示，不让孩子卡死
          if (tries === 2) setTimeout(() => ui.toast(t('x.g426', { a0: gate.riddle }), 4200), 1600);
          else if (tries >= 3) setTimeout(() => {
            const answer = gate.need.map(wid => `「${WORD_MAP[wid].en}」${WORD_MAP[wid].zh}`).join(' ');
            const allHatched = gate.need.every(wid => save.isHatched(wid));
            ui.toast(allHatched
              ? t('x.g427', { a0: answer })
              : t('x.g428', { a0: answer }), 4800);
          }, 1600);
        });
      });
    }
  }

  // 每日任务刚完成时的统一庆祝
  _afterDaily() {
    setTimeout(() => {
      sfx.great();
      ui.toast(t('x.g429'), 3600);
      this._starBurst(this.player.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 5);
      this._refreshDailyBanner();
    }, 500);
  }

  // 机关开门后把它的碰撞体作废（只做标记不清数组，免得其他门的下标错位）
  _killGateCols(gate) {
    if (!gate || !gate.cols) return;
    for (const i of gate.cols) { const c = this.world.colliders[i]; if (c) c.dead = true; }
    gate.cols = [];
  }

  _applyGate(gateId, pet) {
    switch (gateId) {
      case 'boat': {
        save.setGate('boat');
        pet.group.position.set(0, 0, 0.4);
        pet.group.rotation.y = Math.PI / 2;
        pet.home.set(0, 0.4); // 停在河中央当桥
        pet.target.set(0, 0.4);
        pet.wait = 1e9;       // 不再乱跑，守着渡口
        sfx.magic();
        ui.toast(t('x.g430'), 4200);
        break;
      }
      case 'wind': {
        save.setGate('wind');
        const hay = this.world.gates.hay;
        sfx.magic();
        this.addTween(1.6, k => {
          hay.group.position.x = 13 - k * 7;
          hay.group.position.z = -9 + k * 3;
          hay.group.rotation.z = -k * 4;
          hay.group.position.y = Math.sin(k * Math.PI) * 1.5;
        }, () => {
          this.world.colliders[hay.colIndex].dead = true;   // 干草球滚走了，碰撞体作废
          hay.group.visible = false;
          this.pets.flyTo(pet.word.id, new THREE.Vector3(pet.home.x, 0, pet.home.y), 1.2);
        });
        ui.toast(t('x.g431'), 3800);
        break;
      }
      case 'light': {
        save.setGate('light');
        const dark = this.world.gates.darkness;
        sfx.magic();
        this.addTween(1.8, k => {
          dark.material.opacity = 0.96 * (1 - k);
          dark.visible = k < 0.99;
          this.world.gates.barnLight.intensity = 2.2 * k;
        }, () => { dark.visible = false; });
        ui.toast(t('x.g432'), 4200);
        break;
      }
      case 'beanstalkSeed': {
        this.planted = true;
        save.setGate('planted');
        const bs = this.world.gates.beanstalk;
        bs.visible = true;
        bs.scale.set(1, 0.02, 1);
        this.addTween(0.8, k => bs.scale.y = 0.02 + k * 0.03);
        sfx.pop();
        ui.toast(t('x.g433'), 4200);
        break;
      }
      case 'beanstalkRain': {
        const bs = this.world.gates.beanstalk;
        sfx.magic();
        this.addTween(2.6, k => {
          bs.scale.y = 0.05 + (1 - Math.pow(1 - k, 3)) * 0.95;
          bs.position.y = 0;
        }, () => {
          save.setGate('beanstalk');
          ui.toast(t('y.beanstalk', { a0: this.isTouch ? t('y.50') : t('y.51') }), 4600);
        });
        // 小雨点特效
        for (let i = 0; i < 12; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('💧', '#7EC4F2', '#D8F2FF'), transparent: true }));
          s.position.set(-22 + (Math.random() - 0.5) * 6, 8 + Math.random() * 4, 27 + (Math.random() - 0.5) * 6);
          this.scene.add(s);
          this.fx.push({ obj: s, t: 0, dur: 1.5 + Math.random(), update: t => { s.position.y -= t * 3; s.material.opacity = Math.max(0, 1 - t / 2); } });
        }
        break;
      }
      case 'sandWall': {
        save.setGate('sandWall');
        sfx.magic();
        const wall = this.world.gates.sandWall;
        this._killGateCols(wall);   // 沙墙散开后隐形墙也得撤，不然永远过不去
        // 沙子四散的粒子
        for (let i = 0; i < 26; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('·', '#EDD49E', '#C9A46B'), transparent: true }));
          s.position.set((Math.random() - 0.5) * 30, 1 + Math.random() * 2.5, 38 + (Math.random() - 0.5) * 2.5);
          s.scale.setScalar(0.3 + Math.random() * 0.5);
          this.scene.add(s);
          const vx = (Math.random() - 0.5) * 6;
          this.fx.push({
            obj: s, t: 0, dur: 1.6 + Math.random() * 0.8,
            update: (t, dt) => { s.position.x += vx * dt; s.position.y += (1.2 - t) * dt * 2; s.material.opacity = Math.max(0, 1 - t / 2); },
          });
        }
        this.addTween(1.7, k => {
          wall.group.scale.y = 1 - k * 0.96;
          wall.group.scale.x = 1 + k * 0.3;
        }, () => { wall.group.visible = false; });
        ui.toast(t('x.g435'), 4600);
        this._flyPetHome(pet);
        break;
      }
      case 'vines': {
        save.setGate('vines');
        sfx.magic();
        const vines = this.world.gates.vines;
        this._killGateCols(vines);   // 荆棘让路后撤掉隐形墙
        for (let i = 0; i < 22; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('🍃', '#8FD08F', '#D8F2D0'), transparent: true }));
          s.position.set(-38 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2.5, (Math.random() - 0.5) * 60);
          s.scale.setScalar(0.28);
          this.scene.add(s);
          this.fx.push({
            obj: s, t: 0, dur: 1.8 + Math.random(),
            update: (t, dt) => { s.position.y -= dt * 1.2; s.position.x += Math.sin(t * 5) * dt; s.material.rotation += dt * 4; s.material.opacity = Math.max(0, 1 - t / 1.9); },
          });
        }
        this.addTween(1.5, k => {
          vines.group.scale.y = 1 - k * 0.96;
          vines.group.rotation.z = Math.sin(k * Math.PI * 2) * 0.12;
        }, () => { vines.group.visible = false; });
        ui.toast(t('x.g436'), 4600);
        this._flyPetHome(pet);
        break;
      }
    }
  }

  // 机关用完的小词宠自己飞回家
  _flyPetHome(pet) {
    this.addTween(0.4, k => { pet.group.position.y = Math.sin(k * Math.PI) * 0.5; }, () => {
      this.pets.flyTo(pet.word.id, new THREE.Vector3(pet.home.x, 0, pet.home.y), 1.2);
    });
  }

  // ---------- 豆藤攀爬 ----------
  _climb(up) {
    if (this.climbing) return;
    this.climbing = true;
    this._clearMoveTarget();
    const from = this.player.position.clone();
    const to = up
      ? new THREE.Vector3(CLIMB_TOP.x, CLIMB_TOP.y, CLIMB_TOP.z)
      : new THREE.Vector3(CLIMB_BOTTOM.x, CLIMB_BOTTOM.y, CLIMB_BOTTOM.z);
    sfx.pop();
    this.addTween(2.2, k => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.player.position.lerpVectors(from, to, e);
      this.player.position.y = THREE.MathUtils.lerp(from.y, to.y, e) + Math.sin(e * Math.PI) * 0.6;
      this.player.rotation.y += 0.08;
      this.walkT += 0.18;
      const sw = Math.sin(this.walkT) * 0.5;
      this.playerParts.legL.rotation.x = sw;
      this.playerParts.legR.rotation.x = -sw;
    }, () => {
      this.climbing = false;
      this.onIsle = up;
      this.player.position.copy(to);
      this.onGround = true; this.vy = 0; this.jumps = 0;
      if (up) ui.toast(t('x.g437'), 3600);
    });
  }

  // ---------- 小火车站 ----------
  // 巡游模式目的地列表：任意已解锁城直达，有饥饿词宠的城市标 🍖
  _openCityDestinations() {
    const cur = this.chapterIndex(this.hatchedInScope());
    const hungryCities = new Set(save.hungryPets()
      .map(id => WORD_MAP[id] && WORD_MAP[id].zone)
      .filter(Boolean));
    const list = this.islands.map(isl => ({
      key: isl.key,
      name: isl.name + (hungryCities.has(isl.key) ? ' 🍖' : ''),
      emoji: isl.emoji,
      unlocked: cur >= isl.startChapter || isl.bonus,
      need: t('y.52', { a0: isl.startChapter + 1 }),
    }));
    ui.openStation(list, key => {
      const isl = this.islands.find(i => i.key === key);
      if (isl) this._trainToCity(isl.key);
    }, t('train.title'));
    sfx.pop();
  }

  _openStation() {
    const cur = this.chapterIndex(this.hatchedInScope());
    // 只列本册的海岛
    const list = this.islands.map(isl => ({
      key: isl.key, name: isl.name, emoji: isl.emoji,
      unlocked: cur >= isl.startChapter,
      need: t('y.53', { a0: isl.startChapter + 1 }),
    }));
    ui.openStation(list, key => {
      const isl = this.islands.find(i => i.key === key);
      if (isl) this._rideTrain(isl);
    });
    sfx.pop();
  }

  // 小火车：跨海飞行（弧线 + 星星尾迹）
  _rideTrain(isl) {
    if (this.riding || this.climbing) return;
    this.riding = true;
    this._clearMoveTarget();
    const from = this.player.position.clone();
    const to = isl
      ? new THREE.Vector3(isl.cx, 0, isl.cz - 2.5)
      : new THREE.Vector3(0, 0, 16);
    const dist = from.distanceTo(to);
    const dur = THREE.MathUtils.clamp(dist / 22, 1.6, 4);
    sfx.magic();
    if (isl) this._trainQuiz(isl.key);   // 跨海路上来一道知识题
    ui.toast(isl ? t('x.g439', { a0: isl.name }) : t('x.g440'), 2600);
    this.addTween(dur, (k, dt) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.player.position.lerpVectors(from, to, e);
      this.player.position.y = Math.sin(e * Math.PI) * Math.min(7, dist * 0.12) + 0.02;
      this.player.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      this.walkT += dt * 14;
      // 星星尾迹
      if (Math.random() < 0.5) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: letterTexture('✦', '#FFE24E', '#FFFDF0'), transparent: true, depthWrite: false,
        }));
        s.position.copy(this.player.position).add(new THREE.Vector3((Math.random() - 0.5), -0.4, (Math.random() - 0.5)));
        s.scale.setScalar(0.18);
        this.scene.add(s);
        this.fx.push({ obj: s, t: 0, dur: 0.6, update: (t, dt2) => { s.position.y -= dt2; s.material.opacity = 1 - t / 0.6; } });
      }
    }, () => {
      this.riding = false;
      this.player.position.copy(to);
      this.player.position.y = 0;
      this.onGround = true; this.vy = 0; this.jumps = 0;
      this.lastZone = null;  // 触发新区域提示
      if (!isl) setBgmCity(null);   // 回农场：恢复基准调
      ui.closeTrainQuiz();
      sfx.good();
      if (save.addVisited(isl ? isl.key : 'meadow')) {
        this._refreshDailyBanner && this._refreshDailyBanner();
      }
    });
  }

  // ---------- 许愿井商店 ----------
  // 许愿井投星星：买到新装扮，一颗星星落进井里画出涟漪（城市井用实际井位）
  _wellStarFx() {
    const wp = this._activeWellPos || { x: 4.6, z: 19.5 };
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture('⭐', '#FFE24E', '#FFFDF0'), transparent: true }));
    star.position.set(wp.x + 0.35, 2.9, wp.z + 0.1);
    star.scale.setScalar(0.42);
    this.scene.add(star);
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfe3f5, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ripple.position.set(wp.x, 1.06, wp.z);
    this.scene.add(ripple);
    this.addTween(0.75, k => {
      star.position.y = 2.9 - k * 1.85;
      star.position.x = wp.x + 0.35 - k * 0.35;
      star.material.rotation = k * 6;
      ripple.scale.setScalar(1 + k * 5);
      ripple.material.opacity = 0.9 * (1 - k);
    }, () => {
      this.scene.remove(star);
      this.scene.remove(ripple);
      sfx.good();
    });
  }

  // 角色选择卡：只列"已拥有"的装扮组合（基础性别 2 张 + 已拥有帽子 2 张 = 最多 4~6 张）
  _openCharSelect() {
    const wear = save.getWear();
    const badgesOf = (g, hat) => {
      const b = [];
      if (wear.balloonOwned) b.push('🎈');
      if (wear.wandOwned) b.push('🪄');
      return b;
    };
    const cards = [];
    const title = save.TITLE_NAMES[wear.title] || '';   // TITLE_NAMES 由 save.js 导出
    for (const g of ['boy', 'girl']) {
      cards.push({
        gender: g, hat: '', name: t(g === 'boy' ? 'menu.boy' : 'menu.girl'), title,
        img: playerThumbnail(g, { hat: '', title }),
        badges: badgesOf(g, ''),
      });
      for (const hat of (wear.hatOwned || [])) {
        cards.push({
          gender: g, hat, name: t(g === 'boy' ? 'menu.boy' : 'menu.girl'),
          title, img: playerThumbnail(g, { hat, title }),
          badges: badgesOf(g, hat),
        });
      }
    }
    const cur = cards.findIndex((c) => c.gender === save.getGender() && (c.hat || '') === (wear.hat || ''));
    ui.showCharSelect({
      cards, current: cur < 0 ? 0 : cur,
      onPick: (i) => {
        const c = cards[i];
        if (!c) return;
        save.setGender(c.gender);
        save.updateWear({ hat: c.hat });   // 帽子是"拥有即可选"（许愿井里买过）
        this._refreshPlayerLook();   // 既有方法：重建玩家 + 重新应用部件换装
      },
      onShop: () => this._openShop(),
    });
  }

  _openShop() {
    const wear = save.getWear();
    const items = SHOP_ITEMS.map(it => {
      const owned = it.type === 'hat' ? wear.hatOwned.includes(it.value)
        : it.type === 'title' ? (wear.titleOwned || []).includes(it.value)
        : wear[it.type + 'Owned'];
      const on = it.type === 'hat' ? wear.hat === it.value : it.type === 'title' ? wear.title === it.value : !!wear[it.type];
      return { ...it, owned, on };
    });
    ui.showShop({
      stars: save.getStars(), items,
      onBuy: it => {
        if (!save.spendStars(it.price)) { ui.toast(t('x.g441')); return; }
        const patch = it.type === 'hat'
          ? { hatOwned: [...save.getWear().hatOwned, it.value], hat: it.value }
          : it.type === 'title'
          ? { titleOwned: [...(save.getWear().titleOwned || []), it.value], title: it.value }
          : { [it.type + 'Owned']: true, [it.type]: true };
        save.updateWear(patch);
        ui.updateStars(save.getStars());
        this._wellStarFx();
        sfx.magic();
        ui.toast(t('x.g442', { a0: it.emoji, a1: it.name }), 3200);
        this._refreshPlayerLook();
        this._openShop();  // 刷新货架
      },
      onToggle: it => {
        if (it.type === 'hat') save.updateWear({ hat: wear.hat === it.value ? '' : it.value });
        else save.updateWear({ [it.type]: !wear[it.type] });
        ui.updateStars(save.getStars());
        sfx.pop();
        this._refreshPlayerLook();
        this._openShop();
      },
    });
  }

  // 重新生成玩家模型，应用装扮（气球/魔法棒要重拿在手上）
  _refreshPlayerLook() {
    const old = this.player;
    const p = buildPlayer(save.getGender(), save.getWear());
    // 玩家部件换装：只换每个部件的 children —— 动画驱动的是 legL/legR/armL/armR/head 这些
    // Group 引用（js/game.js 的 playerParts.*），Group 自身的 transform 与引用必须保留。
    // rest 指"不在 parts 里的散件"（花帽、魔杖星），用 additive 追加到外层 group。
    assets.applyParts(p.group, p.parts, 'player',
      (name) => playerPartKey(save.getGender(), save.getWear(), name), { rest: true });
    this.player = p.group;
    this.playerParts = p.parts;
    this.player.position.copy(old.position);
    this.player.rotation.copy(old.rotation);
    this.scene.add(this.player);
    this.scene.remove(old);
  }

  // ---------- 每日任务板 ----------
  _openDailyBoard() {
    const q = save.getDaily();
    ui.showDailyBoard({
      quest: q, stars: save.getStars(),
      achievements: save.achievementProgress(),
      onClose: () => {},
    });
    sfx.pop();
  }

  // 顶部每日任务小横幅
  _refreshDailyBanner() {
    const q = save.getDaily();
    ui.setDaily(`${t('daily.head')}：${t('daily.' + q.id)}（${Math.min(q.n, q.goal)}/${q.goal}）${q.done ? ' ✅' : ''}`, q.done);
  }

  // ---------- 图鉴（只看本册：序章 + 本册课本词） ----------
  _openCatalog(hungryFirst = false) {
    const hungrySet = new Set(save.hungryPets());
    const entries = this.scopeWords.map(w => {
      const hatched = save.isHatched(w.id);
      const pd = hatched ? save.getSave().pets[w.id] : null;
      return {
        word: w, hatched,
        hungry: hatched && hungrySet.has(w.id),
        rare: !!(pd && pd.rare),
        evo: !!(pd && pd.evo),
      };
    });
    if (hungryFirst) entries.sort((a, b) => (b.hungry ? 1 : 0) - (a.hungry ? 1 : 0));
    ui.openCatalog(entries, w => petThumbnail(w.pet), { bookLabel: BOOK_LABEL(this.sem) });
  }

  _nearestEggHint() {
    const p = this.player.position;
    let best = null, bd = 1e9;
    for (const e of this.eggs.eggs.values()) {
      const d = Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ================= 课本朗读练习 =================
  _openBook(semKey) {
    if (!semKey) semKey = save.getBookSem() || this.sem;
    const sems = Object.keys(CURRICULUM).map(k => ({ key: k, label: BOOK_LABEL(k), active: k === semKey }));
    const units = CURRICULUM[semKey].units.map((u, i) => {
      const res = save.getUnitResult(semKey + '#' + i);
      return { name: u.name, total: u.words.length, scores: res ? res.scores : null };
    });
    ui.showBookPanel({
      sems, units,
      // 换一册：3D 场景/海岛/关卡整册重建，所以存好后重载一次
      onSelect: k => {
        if (k === this.sem) { this._openBook(k); return; }
        // 每册的城市之旅进度独立保存：换册时有记录就问问孩子"接着玩还是重新出发"
        const hasRecord = Object.keys(save.getSave().cityVisits || {}).some(v => v.startsWith(k + ':'));
        const go = fresh => {
          if (fresh) save.resetCityVisits(k);
          save.setBookSem(k);
          ui.playBookFlip(() => location.reload());
        };
        if (hasRecord) {
          ui.askChoice(t('y.54', { a0: BOOK_LABEL(k) }), t('x.g445'), t('x.g446'), t('x.g447'),
            () => go(false), () => go(true));
        } else go(false);
      },
      onStart: i => this._startPractice(semKey, i),
      onQuickRound: () => this._startQuickRound(semKey),
    });
  }

  _startQuickRound(semKey) {
    const source = CURRICULUM[semKey].units.flatMap(u => u.words);
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }
    const picked = source.slice(0, 5);
    const list = picked.map(item => {
      const [en, zh] = item.split('|');
      return { en, zh, syl: [en] };
    });
    this.practice = { key: `quick#${semKey}`, list, idx: 0, scores: [], quick: true };
    this._practiceNext();
  }

  _startPractice(semKey, unitIdx) {
    const unit = CURRICULUM[semKey].units[unitIdx];
    const list = unit.words.map(item => {
      const [en, zh] = item.split('|');
      return { en, zh, syl: [en] };
    });
    this.practice = { key: semKey + '#' + unitIdx, list, idx: 0, scores: [] };
    this._practiceNext();
  }

  _practiceNext() {
    const p = this.practice;
    if (!p) return;
    if (p.idx >= p.list.length) {
      if (!p.quick) save.saveUnitResult(p.key, p.scores);
      ui.closeChallenge();
      const avg = Math.round(p.scores.reduce((a, b) => a + b, 0) / Math.max(1, p.scores.length));
      sfx.great();
      ui.toast(t('y.dubDone', { a0: p.quick ? t('y.55') : t('y.56'), a1: avg, a2: avg >= 85 ? t('y.57') : t('y.58') }), 4200);
      this.currentWord = null;
      return;
    }
    const w = p.list[p.idx];
    this.currentWord = w;
    this._maybePreloadWhisper(); this._warmMic();
    ui.openChallenge({
      word: { en: w.en, zh: w.zh, syl: [w.en], hint: t('y.59', { a0: p.idx + 1, a1: p.list.length }) },
      mode: 'practice',
      onSuccess: res => {
        p.scores.push(res.score || 80);
        save.addPoint();
        ui.updatePlayerScore(save.getScore(), save.getSessionScore());
        if ((res.score || 0) >= 95 && res.via !== 'spell' && save.bumpDaily('goodread') === 'done') this._afterDaily();
        if ((res.score || 0) >= 60 && save.bumpDaily('read2') === 'done') this._afterDaily();
        p.idx++;
        setTimeout(() => this._practiceNext(), 300);
      },
      onSkip: () => { p.scores.push(0); p.idx++; this._practiceNext(); },
      onClose: () => { this.practice = null; this.currentWord = null; },
    });
  }

  // 连败安抚：连续读不准时自动放宽判定（听感像就算过）并温柔鼓励，别让孩子卡在挫败感里
  _lenientResult(alts) {
    const r = matchAlt(alts, this.currentWord.en, (this.voiceFailStreak || 0) >= 2 ? 1 : 0);
    if (r.score > 0) save.logWeeklyScore(r.score, this.currentWord && this.currentWord.id);   // 家长周报：真实朗读才记；低分带词 id 供"本周易错词 Top5"
    if (r.ok) this.voiceFailStreak = 0;
    else {
      this.voiceFailStreak = (this.voiceFailStreak || 0) + 1;
      save.markNaughty(this.currentWord.id);   // 错词本：读错的词隔天变淘气词宠回来复习
      if (this.voiceFailStreak === 3) ui.toast(t('x.g450'), 4200);
    }
    return r;
  }

  // ---------- 语音识别（优先级：Web Speech → 本地 Whisper → 字母块） ----------
  // 点击麦克风：开始录音（10 秒倒计时自动收）；再点一次：立即识别。返回 false 表示无法启动，UI 自动切字母块。
  _startVoice() {
    if (!this.currentWord) return false;
    // 喇叭刚才还在出声（示范音/听一听被掐掉）：滚动缓冲里很可能录进了外放音，
    // 置标记让本次收音清空缓冲只录按下之后的声音；没在响就保留 ~2 秒缓冲，字头不丢
    this._purgeOnArm = isSpeaking();
    stopSpeaking();                    // 示范发音立刻停，别盖过孩子的声音
    ui.showReplay(null);               // 清掉上一轮的回放按钮
    // Web Speech 在支持的浏览器里几乎立即返回结果，避免第一次朗读先下载 40MB 模型；
    // 它连续读不到时（手机微信里很常见）改用自带的本地模型。
    if (!this.preferWhisper && voiceSupported && !isVoiceBroken()) return this._startWebSpeech();
    return this._startWhisper();
  }

  // 打开挑战卡时悄悄预热本地识别引擎：手机上 Web Speech 多半不可用，
  // 等孩子听完示范发音、开口录音时，40MB 模型基本已在后台下好了
  _maybePreloadWhisper(force = false) {
    if (this._whisperPreloaded) return;
    const canRecord = typeof MediaRecorder !== 'undefined'
      && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const webSpeechOk = voiceSupported && !isVoiceBroken();
    if (!canRecord || (!force && webSpeechOk)) return;   // 桌面浏览器走即时识别，不必提前下 40MB
    this._whisperPreloaded = true;
    preloadWhisper();
  }

  // 打开挑战卡时先把麦克风"点着"：权限弹窗、麦克风启动都发生在孩子认单词的时候，
  // 等他点下录音键立刻就能开口，不用对着"准备中"干等（只做一次，失败的静默）
  _warmMic() {
    if (this._micWarmed) return;
    this._micWarmed = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS).then(stream => {
      stream.getTracks().forEach(t => t.stop());
    }).catch(() => { /* 权限没给：录音时再正式提示 */ });
  }

  _canRecord() {
    return typeof MediaRecorder !== 'undefined'
      && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // 常开录音：挑战卡打开时就开录，闲置期只保留最近 ~3 秒。
  // “点我开始读”最容易点了就读，等点击后才启动录音会剪掉第一个音节，
  // 识别就只剩残词，得分永远卡在 6、70 分——提前开录后按下即收音，字头不再丢。
  _primeRec() {
    if (this._primeRecActive || !this._canRecord()) return;
    this._primeRecActive = true;
    navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS).then(stream => {
      if (!this._primeRecActive) { try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ } return; }
      const live = stream.getAudioTracks().some(t => t.readyState === 'live');
      if (!live) { this._primeRecActive = false; try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ } return; }
      this.mediaStream = stream;
      const rec = new MediaRecorder(stream);
      this.recorder = rec;
      this.chunks = [];
      this._armed = false;
      rec.ondataavailable = e => {
        if (!(e.data && e.data.size)) return;
        this.chunks.push(e.data);
        if (!this._armed && this.chunks.length > 3) this.chunks.shift();
      };
      rec.onstop = () => this._recOnStop(rec, stream);
      try { rec.start(1000); } catch (e) { this._primeRecActive = false; }
    }).catch(() => { this._primeRecActive = false; });
  }

  _stopPrimeRec() {
    this._primeRecActive = false;
    this._armed = false;
    clearTimeout(this._recCap);
    clearTimeout(this._primeTimer);
    clearTimeout(this._primeFallback);
    if (this.recorder && this.recorder.state !== 'inactive') { try { this.recorder.stop(); } catch (e) { /* ignore */ } }
    if (this.mediaStream) { try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ } this.mediaStream = null; }
  }

  // 录音结束的公共出口：拼 blob → 回放 → 本地识别 → 评分，然后为下次尝试重新常开
  _recOnStop(rec, stream) {
    clearTimeout(this._recCap);
    try { stream && stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
    const wasArmed = this._armed;
    this._primeRecActive = false;
    this._armed = false;
    (async () => {
      try {
        const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
        // 留下孩子自己的读音，评分后可以回放对比
        if (blob.size > 800) {
          if (this._lastRecUrl) URL.revokeObjectURL(this._lastRecUrl);
          this._lastRecUrl = URL.createObjectURL(blob);
          ui.showReplay(this._lastRecUrl);
        }
        if (!this.currentWord) return;
        // 只有真的录过一轮才重新常开，避免设备异常时空转
        if ((wasArmed || blob.size > 800) && (this.preferWhisper || !voiceSupported || isVoiceBroken())) this._primeRec();
        ui.voiceStatus(t('x.g29'));
        const text = await recognizeBlob(blob);
        if (!this.currentWord) return;
        if (!text) { this.voiceFailStreak = (this.voiceFailStreak || 0) + 1; ui.voiceResult({ score: 0, heard: '', error: 'no-result' }); return; }
        ui.voiceResult(this._lenientResult([{ transcript: text, confidence: 0.9 }]));
      } catch (e) {
        ui.voiceResult({ score: 0, heard: '', error: 'no-result' });
      }
    })();
  }

  _startWhisper() {
    const word = this.currentWord;
    if (!word) return false;
    if (!this._canRecord()) return this._startWebSpeech();
    this.voiceCancelled = false;
    // 常开录音已在滚：按下即刻收音，零启动延迟
    if (this._primeRecActive && this.recorder && this.recorder.state === 'recording') {
      this._armed = true;
      if (this._purgeOnArm) this.chunks = [];                            // 缓冲可能被外放音污染：全清，只录按下后
      else if (this.chunks.length > 2) this.chunks = this.chunks.slice(-2);   // 只留按下前 ~2 秒做缓冲
      ui.voiceRecording();
      // 模型若还在准备中，顺带把下载进度显示出来
      clearInterval(this._loadTick);
      ensureWhisper().finally(() => clearInterval(this._loadTick));
      this._loadTick = setInterval(() => {
        const pct = loadPercent();
        if (pct > 0) ui.voiceStatus(t('x.g452', { a0: pct }));
      }, 400);
      // 10 秒硬上限：倒计时归零自动收音识别，绝不让孩子干等
      clearTimeout(this._recCap);
      this._recCap = setTimeout(() => {
        if (this.recorder && this.recorder.state === 'recording') { try { this.recorder.stop(); } catch (e) { /* ignore */ } }
      }, 10000);
      return true;
    }
    // 常开录音没就绪（权限刚给/第一次）：退回按下时启动的老流程
    ui.voiceStatus(t('x.g453'));
    clearInterval(this._loadTick);
    this._loadTick = setInterval(() => {
      const pct = loadPercent();
      if (pct > 0) ui.voiceStatus(t('x.g452', { a0: pct }));
    }, 400);
    ensureWhisper().finally(() => clearInterval(this._loadTick)).then(() => {
      if (!this.currentWord) return;
      return navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS).then(stream => {
        if (this.voiceCancelled || this.currentWord !== word) {
          try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
          return;
        }
        const rec = new MediaRecorder(stream);
        this.recorder = rec;
        this.chunks = [];
        this._armed = true;
        rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
        rec.onstop = () => this._recOnStop(rec, stream);
        rec.start();
        ui.voiceRecording(); // “正在录音，读完再点一下”
        // 10 秒硬上限：倒计时归零自动收音识别，绝不让孩子干等
        clearTimeout(this._recCap);
        this._recCap = setTimeout(() => {
          if (rec.state === 'recording') { try { rec.stop(); } catch (e) { /* ignore */ } }
        }, 10000);
      });
    }).catch(() => {
      // 本地引擎失败 → Web Speech → 字母块
      if (this.currentWord && this._startWebSpeech()) return;
      markVoiceBroken();
      ui.voiceUnavailable();
    });
    return true;
  }

  _stopVoice() {
    clearTimeout(this._recCap);
    if (this.recorder && this.recorder.state === 'recording' && this._armed) {
      try { this.recorder.stop(); } catch (e) { /* ignore */ }
    } else {
      this.voiceCancelled = true; // 引擎还没就绪就取消了
      stopListening();
    }
  }

  _startWebSpeech() {
    if (!voiceSupported) return false;
    return startListening(
      alts => {
        if (!this.currentWord) return;
        if (!alts) { this._noteVoiceMiss(); ui.voiceResult({ score: 0, heard: '', error: 'no-result' }); return; }
        ui.voiceResult(this._lenientResult(alts));
      },
      (listening, err) => {
        if (err === 'not-allowed') ui.toast(t('x.g454'), 5000);
        else if (err && err !== 'no-result') {
          this._noteVoiceMiss();
          // Web Speech 出问题就立刻开始下载本地模型，别等下次切换时才让孩子干等
          this._maybePreloadWhisper(true);
          if (!this.preferWhisper) ui.toast(t('x.g455'), 4000);
        }
      }
    );
  }

  // 在线识别连续两次拿不到结果（手机微信里很常见）→ 下次改用本地模型
  _noteVoiceMiss() {
    this.voiceMiss += 1;
    if (this.preferWhisper || this.voiceMiss < 2) return;
    const canRecord = typeof MediaRecorder !== 'undefined'
      && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!canRecord) return;
    this.preferWhisper = true;
    ui.toast(t('x.g456'), 4000);
  }
}
