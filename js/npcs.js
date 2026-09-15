// 城市NPC：低模小人配角（详细说明见 buildNPC）
import * as THREE from 'three';

const ROLES = {
  tourist: { zh: '游客', emoji: '🧳', shirts: ['#FF9FBE', '#7EC4F2', '#FFD34E'] },
  vendor: { zh: '小贩', emoji: '🍜', shirts: ['#FF8A5C', '#E8B04B'] },
  student: { zh: '学生', emoji: '🎒', shirts: ['#4E9EE8', '#5AB88A'] },
  gardener: { zh: '园丁', emoji: '🌿', shirts: ['#8FD08F', '#6BA85A'] },
  elder: { zh: '爷爷奶奶', emoji: '🦯', shirts: ['#A8A0B8', '#C0907E'] },
  postman: { zh: '邮递员', emoji: '📮', shirts: ['#5A8A5A', '#4E7CB1'] },
};
const GREETINGS = ['Hello! 你好呀！', 'Welcome! 欢迎来到这座城市！', 'Hi! 祝你孵蛋顺利！', 'Nice to meet you!'];
const PAGE_SEC = 2;      // 每页停留秒数，自动翻页
const LINES_PER_PAGE = 3; // 每页行数：一次不多显示，文字多自动分页

function wrap(text, n = 15) {
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out;
}

// 气泡纹理：与任务气泡（#quest）同一风格——暖白底、琥珀细边、棕色文字、底部小尾巴。
// 当前页文字 + 底部分页条「< 1/3 >」（左右两端是可点的箭头热区）
function bubbleTexture(lines, page, total) {
  const W = 512, H = 34 + lines.length * 40 + (total > 1 ? 38 : 0) + 18;   // 高度按本页实际行数，短文本不出大空白
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(255,253,248,.93)';
  c.strokeStyle = 'rgba(255,224,168,.95)';
  c.lineWidth = 4;
  c.beginPath();
  if (c.roundRect) c.roundRect(3, 3, W - 6, H - 6 - 12, 16); else c.rect(3, 3, W - 6, H - 6 - 12);
  c.fill(); c.stroke();
  // 底部小尾巴：和任务气泡一个语言
  c.beginPath();
  c.moveTo(W / 2 - 11, H - 12 - 11);
  c.lineTo(W / 2, H - 12);
  c.lineTo(W / 2 + 11, H - 12 - 11);
  c.closePath();
  c.fillStyle = 'rgba(255,253,248,.93)';
  c.fill();
  c.strokeStyle = 'rgba(255,224,168,.95)';
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = '#7A5C22';
  c.font = '700 26px "Segoe UI", "Microsoft YaHei", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'top';
  lines.forEach((ln, i) => c.fillText(ln, W / 2, 18 + i * 38));
  if (total > 1) {
    // 分页条：左右箭头 + 中间页码（低调不抢戏）
    const py = 22 + lines.length * 40;
    c.font = '700 26px "Segoe UI", "Microsoft YaHei", sans-serif';
    c.fillStyle = '#C9A96B';
    c.textAlign = 'left';
    c.fillText('‹', 24, py);
    c.textAlign = 'right';
    c.fillText('›', W - 24, py);
    c.textAlign = 'center';
    c.fillStyle = '#A98F70';
    c.font = '700 22px "Segoe UI", "Microsoft YaHei", sans-serif';
    c.fillText(`${page + 1} / ${total}`, W / 2, py + 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: 3.7, h: 3.7 * H / W, opacity: 0.92 };
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
  // 头顶角色名牌：小一号、半透明（走近才看得清，远看不抢戏）
  const nv = document.createElement('canvas');
  nv.width = 256; nv.height = 64;
  const nc = nv.getContext('2d');
  nc.fillStyle = 'rgba(255,253,248,.82)';
  nc.strokeStyle = 'rgba(255,224,168,.85)'; nc.lineWidth = 3;
  nc.beginPath();
  if (nc.roundRect) nc.roundRect(3, 3, 250, 58, 15); else nc.rect(3, 3, 250, 58);
  nc.fill(); nc.stroke();
  nc.fillStyle = '#7A5C22';
  nc.font = '700 30px "Microsoft YaHei", sans-serif';
  nc.textAlign = 'center'; nc.textBaseline = 'middle';
  nc.fillText(role.zh, 128, 33);
  const ntex = new THREE.CanvasTexture(nv);
  ntex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, transparent: true, depthWrite: false, fog: false, opacity: 0.62 }));
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
    this._bubble = null;
    this._bubbleUntil = 0;
    this.knowledge = [];
    this._colliders = [];
    this._clampFn = null;
    this._pages = null;   // { lines: [[..],[..]..], page, pos }
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
  _showBubble(text, pos) {
    this._hideBubble();
    const lines = wrap(text, 15);
    const pages = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
    this._pages = { pages, page: 0, pos: { x: pos.x, z: pos.z } };
    this._renderPage();
  }
  _renderPage() {
    const P = this._pages;
    if (!P) return;
    const { tex, w, h, opacity } = bubbleTexture(P.pages[P.page], P.page, P.pages.length);
    if (this._bubble) {
      this.group.remove(this._bubble);
      this._bubble = null;
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false, opacity }));
    sp.renderOrder = 10;   // 说话内容置顶：不被树冠/墙挡（名牌仍走正常深度）
    sp.scale.set(w, h, 1);
    sp.position.set(P.pos.x, 2.25, P.pos.z);
    sp.userData.bubble = true;
    this.group.add(sp);
    this._bubble = sp;
    this._bubbleUntil = performance.now() / 1000 + PAGE_SEC;
  }
  // 点击气泡翻页：uv.x < 0.15 上一页，其余下一页
  flipBubble(dir) {
    const P = this._pages;
    if (!P) return false;
    const to = P.page + dir;
    if (to < 0 || to >= P.pages.length) { this._hideBubble(); return true; }
    P.page = to;
    this._renderPage();
    return true;
  }
  _hideBubble() {
    if (this._bubble) { this.group.remove(this._bubble); this._bubble = null; }
    this._pages = null;
  }
  spawnForCity(stage, clampFn, colliders) {
    this.clear();
    this._colliders = colliders || [];
    this._clampFn = clampFn || null;
    this._stage = stage;
    const isTouch = matchMedia('(pointer: coarse)').matches;
    const count = isTouch ? 8 : 14;
    const roles = Object.keys(ROLES);
    for (let i = 0; i < count; i++) {
      const role = ROLES[roles[i % roles.length]];
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
    // 分页气泡：每页停 2 秒自动翻下一页，最后一页播完隐藏
    if (this._bubble && now > this._bubbleUntil) {
      const P = this._pages;
      if (P && P.page < P.pages.length - 1) { P.page++; this._renderPage(); }
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
    if (nearest && nd < 3.2) {
      nearest.group.lookAt(playerPos.x, nearest.group.position.y, playerPos.z);
      if (!nearest.met) {
        nearest.met = true;
        this._showBubble(GREETINGS[Math.floor(Math.random() * GREETINGS.length)], nearest.group.position);
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
  talkTo(group) {
    const n = this.npcs.find(x => x.group === group);
    if (!n) return false;
    n.met = true;
    const item = this.knowledge.length ? this.knowledge[Math.floor(Math.random() * this.knowledge.length)] : null;
    const text = item ? `🤔 ${item[0]}  💡 ${item[1]}` : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    this._showBubble(text, n.group.position);
    return true;
  }
  // 讲一条小知识（问题+自答），优先还没讲过的
  tellKnowledge(playerPos) {
    const nearest = this._nearest(playerPos, 6);
    if (!nearest) return false;
    let item = null;
    if (this.knowledge.length) {
      const fresh = this.knowledge.filter(k => !k.used);
      const bag = fresh.length ? fresh : this.knowledge;
      item = bag[Math.floor(Math.random() * bag.length)];
      item.used = true;
    }
    const text = item ? `🤔 ${item[0]}  💡 ${item[1]}` : GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    this._showBubble(text, nearest.group.position);
    return true;
  }
}
