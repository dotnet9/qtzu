// 城市NPC：低模小人配角（详细说明见 buildNPC）
import * as THREE from 'three';
import * as ui from './ui.js';
import { markNpcChat } from './save.js';
import { t, getGameRes } from './i18n.js';

const ROLES = {
  tourist: { zh: 'x.g457', emoji: '🧳', shirts: ['#FF9FBE', '#7EC4F2', '#FFD34E'] },
  vendor: { zh: 'x.g458', emoji: '🍜', shirts: ['#FF8A5C', '#E8B04B'] },
  student: { zh: 'x.g459', emoji: '🎒', shirts: ['#4E9EE8', '#5AB88A'] },
  gardener: { zh: 'x.g460', emoji: '🌿', shirts: ['#8FD08F', '#6BA85A'] },
  elder: { zh: 'x.g461', emoji: '🦯', shirts: ['#A8A0B8', '#C0907E'] },
  postman: { zh: 'x.g462', emoji: '📮', shirts: ['#5A8A5A', '#4E7CB1'] },
};
// 城市特色角色：每座城独有的 NPC 身份，排进出场队列最前面（保证每城必然出现）
const CITY_ROLES = {
  chengdu: [{ zh: 'x.g463', emoji: '🐼', shirts: ['#8FD08F', '#4E7A46'] }],
  beijing: [{ zh: 'x.g464', emoji: '🎭', shirts: ['#C43B3B', '#E8B04B'] }, { zh: 'x.g465', emoji: '🕊️', shirts: ['#A8A0B8'] }],
  harbin: [{ zh: 'x.g466', emoji: '❄️', shirts: ['#7EC4F2', '#BFE3F5'] }],
  sanya: [{ zh: 'x.g467', emoji: '🏄', shirts: ['#FF8A5C', '#4EC4F2'] }],
  xian: [{ zh: 'x.g468', emoji: '🗿', shirts: ['#B08A6A', '#8A6A4A'] }],
  hangzhou: [{ zh: 'x.g469', emoji: '🍃', shirts: ['#5AB88A', '#8FD08F'] }],
  suzhou: [{ zh: 'x.g470', emoji: '🧵', shirts: ['#FF9FBE', '#E8B04B'] }],
  dunhuang: [{ zh: 'x.g471', emoji: '🐪', shirts: ['#C0907E', '#E8B04B'] }],
  chongqing: [{ zh: 'x.g472', emoji: '🌶️', shirts: ['#C43B3B', '#E8B04B'] }],
  guangzhou: [{ zh: 'x.g473', emoji: '🫖', shirts: ['#FFD34E', '#FF9FBE'] }],
  wuhan: [{ zh: 'x.g474', emoji: '🍜', shirts: ['#E8B04B'] }],
  urumqi: [{ zh: 'x.g475', emoji: '🍇', shirts: ['#7B5AB8', '#5AB88A'] }],
  hohhot: [{ zh: 'x.g476', emoji: '🐎', shirts: ['#4E9EE8', '#C0907E'] }],
  qingdao: [{ zh: 'x.g477', emoji: '🌊', shirts: ['#4E7CB1', '#7EC4F2'] }],
  xiamen: [{ zh: 'x.g478', emoji: '🐟', shirts: ['#4EC4F2', '#FF9FBE'] }],
  quanzhou: [{ zh: 'x.g479', emoji: '🎪', shirts: ['#C43B3B', '#E8B04B'] }],
  fuzhou: [{ zh: 'x.g480', emoji: '🫖', shirts: ['#5AB88A'] }],
  kunming: [{ zh: 'x.g481', emoji: '🌸', shirts: ['#FF9FBE', '#5AB88A'] }],
  lhasa: [{ zh: 'x.g482', emoji: '🏔️', shirts: ['#C0907E', '#4E7CB1'] }],
  lanzhou: [{ zh: 'x.g483', emoji: '🌀', shirts: ['#E8B04B'] }],
  dalian: [{ zh: 'x.g484', emoji: '⚽', shirts: ['#4E9EE8'] }],
  haikou: [{ zh: 'x.g485', emoji: '🥥', shirts: ['#5AB88A', '#FFD34E'] }],
  guiyang: [{ zh: 'x.g486', emoji: '🍲', shirts: ['#FF8A5C'] }],
  nanning: [{ zh: 'x.g487', emoji: '🍜', shirts: ['#FF8A5C', '#5AB88A'] }],
  changsha: [{ zh: 'x.g488', emoji: '🍢', shirts: ['#C43B3B'] }],
  taiyuan: [{ zh: 'x.g489', emoji: '🏺', shirts: ['#7B5AB8'] }],
  chengde: [{ zh: 'x.g490', emoji: '🏯', shirts: ['#4E7CB1'] }],
  qufu: [{ zh: 'x.g491', emoji: '📜', shirts: ['#A8A0B8'] }],
  kaifeng: [{ zh: 'x.g492', emoji: '🧵', shirts: ['#FF9FBE'] }],
  luoyang: [{ zh: 'x.g493', emoji: '🌺', shirts: ['#FF9FBE', '#5AB88A'] }],
  datong: [{ zh: 'x.g494', emoji: '🗿', shirts: ['#B08A6A'] }],
  shenyang: [{ zh: 'x.g495', emoji: '🪭', shirts: ['#FF9FBE', '#FFD34E'] }],
  changchun: [{ zh: 'x.g496', emoji: '🎨', shirts: ['#7EC4F2'] }],
};
// 问候语资源在 data/i18n/game.zh.json / game.en.json 的 greetings 字段
const GREETINGS_FALLBACK = ['Hello!'];
const PAGE_SEC = 2;      // 每页停留秒数，自动翻页
const BUBBLE_MAX = 5;    // 气泡总时长上限（秒）：再长的内容也不常驻屏幕
const LINES_PER_PAGE = 3; // 每页行数：一次不多显示，文字多自动分页

function wrap(text, n = 15) {
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out;
}

function buildNPC(role, shirt) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }));
  body.position.y = 0.5; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xFFE0C2, roughness: 0.7 }));
  head.position.y = 1.02; head.castShadow = true; g.add(head);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const c = cv.getContext('2d');
  c.font = '60px serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(role.emoji, 48, 52);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const hat = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  hat.scale.setScalar(0.48); hat.position.y = 1.44; g.add(hat);
  // 头顶角色名牌：底要实（旧版太透，文字都看不清），整体略降不透明度保住"远看不抢戏"
  const nv = document.createElement('canvas');
  nv.width = 256; nv.height = 64;
  const nc = nv.getContext('2d');
  nc.fillStyle = 'rgba(255,253,248,.95)';
  nc.strokeStyle = 'rgba(255,224,168,.95)'; nc.lineWidth = 3;
  nc.beginPath();
  if (nc.roundRect) nc.roundRect(3, 3, 250, 58, 15); else nc.rect(3, 3, 250, 58);
  nc.fill(); nc.stroke();
  nc.fillStyle = '#5F431A';
  nc.font = '700 30px "Microsoft YaHei", sans-serif';
  nc.textAlign = 'center'; nc.textBaseline = 'middle';
  nc.fillText(t(role.zh), 128, 33);
  const ntex = new THREE.CanvasTexture(nv);
  ntex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, transparent: true, depthWrite: false, fog: false, opacity: 0.95 }));
  tag.scale.set(1.28, 0.32, 1); tag.position.y = 1.82; g.add(tag);
  const legGeo = new THREE.CapsuleGeometry(0.07, 0.18, 3, 6);
  const legM = new THREE.MeshStandardMaterial({ color: 0x5B4632, roughness: 0.9 });
  const legL = new THREE.Mesh(legGeo, legM); legL.position.set(-0.1, 0.16, 0);
  const legR = new THREE.Mesh(legGeo, legM); legR.position.set(0.1, 0.16, 0);
  legL.castShadow = legR.castShadow = true;
  g.add(legL, legR);
  return { group: g, legL, legR };
}

export class NPCManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.npcs = [];
    this._bubbleUntil = 0;
    this._bubbleStart = 0;   // 本轮气泡开始时刻：算总时长用
    this._anchorNpc = null;
    this.knowledge = [];
    this._colliders = [];
    this._clampFn = null;
    this._pages = null;   // { lines: [[..],[..]..], page, pos }
    this.onReview = null; // 复习考官钩子：game 注入，有淘气词时 NPC 化身考官
  }
  setKnowledge(list) { this.knowledge = list || []; }
  clear() {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.npcs = [];
    this._hideBubble();
  }
  // 碰撞推出：圆形碰撞体把 NPC 挤出去，城市边界把 NPC 钳回来（不再穿墙/出城）
  _pushOut(p) {
    for (const c of this._colliders) {
      if (c.t !== 'c' || c.dead) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), min = (c.r || 0.5) + 0.3;
      if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
    }
    if (this._clampFn) { const q = { x: p.x, z: p.z }; this._clampFn(q, this._stage); p.x = q.x; p.z = q.z; }
    // 钳回城内可能又撞进边界碰撞体：再补一轮推出（顺序交替直到稳定）
    for (const c of this._colliders) {
      if (c.t !== 'c' || c.dead) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), min = (c.r || 0.5) + 0.3;
      if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
    }
  }
  _showBubble(text, npc) {
    this._hideBubble();
    const lines = wrap(text, 15);
    const pages = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE).join(''));
    this._pages = { pages, page: 0 };
    this._bubbleStart = performance.now() / 1000;
    this._anchorNpc = npc;   // 存 NPC 引用而非位置快照：NPC 漫步时气泡跟着它走
    this._renderPage();
  }
  _renderPage() {
    const P = this._pages;
    if (!P) return;
    // 渲染交给 ui 的 DOM 气泡（任务气泡同款）：字号恒定，不随镜头远近缩放
    ui.showNpcBubble({ pages: P.pages, page: P.page, onFlip: dir => this._flip(dir) });
    this._bubbleUntil = performance.now() / 1000 + PAGE_SEC;
  }
  // 翻页（DOM 按钮/自动翻页共用）：超出最后一页即收起
  _flip(dir) {
    const P = this._pages;
    if (!P) return;
    const to = P.page + dir;
    if (to < 0 || to >= P.pages.length) { this._hideBubble(); return; }
    P.page = to;
    this._renderPage();
  }
  // 正在说话时返回锚点（说话 NPC 的头顶实时位置——它走气泡也走）
  bubbleAnchor() {
    const n = this._anchorNpc;
    return n ? { x: n.group.position.x, y: 1.7, z: n.group.position.z } : null;
  }
  _hideBubble() {
    ui.hideNpcBubble();
    this._pages = null;
    this._anchorNpc = null;
  }
  spawnForCity(stage, clampFn, colliders) {
    this.clear();
    this._colliders = colliders || [];
    this._clampFn = clampFn || null;
    this._stage = stage;
    const isTouch = matchMedia('(pointer: coarse)').matches;
    const count = isTouch ? 8 : 14;
    // 本城特色角色排最前（必然出场），其余用通用角色池轮换
    const special = CITY_ROLES[stage.key] || [];
    const roles = [...special.map((_, i) => ({ special: true, i })), ...Object.keys(ROLES)];
    for (let i = 0; i < count; i++) {
      const r = roles[i % roles.length];
      const role = r.special ? special[r.i] : ROLES[r];
      const shirt = role.shirts[i % role.shirts.length];
      const { group, legL, legR } = buildNPC(role, shirt);
      const a = (i / count) * Math.PI * 2 + 0.4;
      const p = { x: stage.cx + Math.cos(a) * stage.r * 0.55, z: stage.cz + Math.sin(a) * stage.r * 0.55 };
      if (clampFn) { const q = { x: p.x, z: p.z }; clampFn(q, stage); p.x = q.x; p.z = q.z; }
      group.position.set(p.x, 0, p.z);
      this.group.add(group);
      this.npcs.push({
        group, legL, legR,
        home: new THREE.Vector2(p.x, p.z),
        target: new THREE.Vector2(p.x, p.z),
        idle: 1 + Math.random() * 5,
        speed: 0.5 + Math.random() * 0.4,
        met: false,
      });
    }
  }
  update(dt, playerPos) {
    const now = performance.now() / 1000;
    // 分页气泡：每页停 2 秒自动翻下一页，最后一页播完隐藏；总时长 5 秒封顶（手动翻页也一样）
    if (this._pages && now - this._bubbleStart > BUBBLE_MAX) {
      this._hideBubble();
    } else if (this._pages && now > this._bubbleUntil) {
      if (this._pages.page < this._pages.pages.length - 1) { this._pages.page++; this._renderPage(); }
      else this._hideBubble();
    }
    let nearest = null, nd = 1e9;
    for (const n of this.npcs) {
      n.idle -= dt;
      const dT = Math.hypot(n.target.x - n.group.position.x, n.target.y - n.group.position.z);
      if (n.idle <= 0 && dT < 0.3) {
        n.target.set(n.home.x + (Math.random() - 0.5) * 4, n.home.y + (Math.random() - 0.5) * 4);
        const q = { x: n.target.x, z: n.target.y };
        this._pushOut(q);                       // 目标点也推出墙外，防止"走进墙里出不来"
        n.target.set(q.x, q.z);
        n.idle = 3 + Math.random() * 6;
      }
      if (dT > 0.25) {
        const dx = n.target.x - n.group.position.x, dz = n.target.y - n.group.position.z;
        const len = Math.hypot(dx, dz);
        n.group.position.x += dx / len * n.speed * dt;
        n.group.position.z += dz / len * n.speed * dt;
        n.group.rotation.y = Math.atan2(dx, dz);
        n.legL.position.z = Math.sin(now * 8) * 0.09;
        n.legR.position.z = -Math.sin(now * 8) * 0.09;
      }
      this._pushOut(n.group.position);          // 每帧无条件推出：静止时也不许待在墙里
      const d = Math.hypot(playerPos.x - n.group.position.x, playerPos.z - n.group.position.z);
      if (d < nd) { nd = d; nearest = n; }
    }
    if (nearest && nd < 2.2) {   // 贴得够近才打招呼：擦肩不弹
      nearest.group.lookAt(playerPos.x, nearest.group.position.y, playerPos.z);
      if (!nearest.met) {
        nearest.met = true;
        // 隔日重逢：今天第一次和 NPC 聊天，问候语加欢迎回来
        const back = markNpcChat();
        const bag = getGameRes().greetings?.length ? getGameRes().greetings : GREETINGS_FALLBACK;
        const g = back ? t('x.g497')
          : bag[Math.floor(Math.random() * bag.length)];
        this._showBubble(g, nearest);
      }
    }
  }
  _nearest(playerPos, maxD) {
    let nearest = null, nd = maxD;
    for (const n of this.npcs) {
      const d = Math.hypot(playerPos.x - n.group.position.x, playerPos.z - n.group.position.z);
      if (d < nd) { nd = d; nearest = n; }
    }
    return nearest;
  }
  // 点击 NPC：主动和它聊一句（打过招呼就讲小知识），返回是否命中
  // 若注册了 onReview 回调且有淘气词，60% 概率化身复习考官（读对淘气词帮 NPC 认领词卡）
  talkTo(group) {
    const n = this.npcs.find(x => x.group === group);
    if (!n) return false;
    n.met = true;
    if (this.onReview && Math.random() < 0.6 && this.onReview(n)) return true;
    const item = this.knowledge.length ? this.knowledge[Math.floor(Math.random() * this.knowledge.length)] : null;
    const text = item ? `🤔 ${item[0]}  💡 ${item[1]}` : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    this._showBubble(text, n);
    return true;
  }
  // 讲一条小知识（问题+自答），优先还没讲过的
  tellKnowledge(playerPos) {
    const nearest = this._nearest(playerPos, 2.8);   // 小知识也要凑近讲
    if (!nearest) return false;
    let item = null;
    if (this.knowledge.length) {
      const fresh = this.knowledge.filter(k => !k.used);
      const bag = fresh.length ? fresh : this.knowledge;
      item = bag[Math.floor(Math.random() * bag.length)];
      item.used = true;
    }
    const text = item ? `🤔 ${item[0]}  💡 ${item[1]}` : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    this._showBubble(text, nearest);
    return true;
  }
}
