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

function wrap(text, n = 15) {
  const out = [];
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n));
  return out;
}

function bubbleTexture(lines) {
  const W = 512, H = 56 + lines.length * 50;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(255,253,246,.96)';
  c.strokeStyle = '#E3D4C2';
  c.lineWidth = 5;
  c.beginPath();
  if (c.roundRect) c.roundRect(4, 4, W - 8, H - 8, 24); else c.rect(4, 4, W - 8, H - 8);
  c.fill(); c.stroke();
  c.fillStyle = '#4A3B2E';
  c.font = '900 32px "Segoe UI", "Microsoft YaHei", sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'top';
  lines.forEach((ln, i) => c.fillText(ln, 22, 22 + i * 48));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: 4.6, h: 4.6 * H / W };
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
  }
  setKnowledge(list) { this.knowledge = list || []; }
  clear() {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.npcs = [];
    this._hideBubble();
  }
  _showBubble(text, pos) {
    this._hideBubble();
    const lines = wrap(text, 15);
    const { tex, w, h } = bubbleTexture(lines);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set(w, h, 1);
    sp.position.set(pos.x, 2.35, pos.z);
    this.group.add(sp);
    this._bubble = sp;
    this._bubbleUntil = performance.now() / 1000 + Math.min(9, 2.5 + text.length * 0.12);
  }
  _hideBubble() {
    if (this._bubble) { this.group.remove(this._bubble); this._bubble = null; }
  }
  spawnForCity(stage, clampFn) {
    this.clear();
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
    if (this._bubble && now > this._bubbleUntil) this._hideBubble();
    let nearest = null, nd = 1e9;
    for (const n of this.npcs) {
      n.idle -= dt;
      const dT = Math.hypot(n.target.x - n.group.position.x, n.target.y - n.group.position.z);
      if (n.idle <= 0 && dT < 0.3) {
        n.target.set(n.home.x + (Math.random() - 0.5) * 4, n.home.y + (Math.random() - 0.5) * 4);
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
