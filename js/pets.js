// 词宠实体：蛋（待孵化）与词宠（已孵化，会溜达、会饿）
import * as THREE from 'three';
import { buildPet, addLetterTag, addPhraseTag, letterTexture, PET_COLORS } from './models.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.75, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
});

// ---------- 蛋 ----------
export class EggManager {
  constructor(scene) {
    this.scene = scene;
    this.eggs = new Map(); // wordId -> {group, word}
  }

  // key=true 是剧情钥匙蛋：蓝光柱 + 头顶一把小钥匙，和本关要孵的粉蛋一眼区分开
  spawnEgg(word, golden = false, key = false, num = null, posOverride = null) {
    const g = new THREE.Group();
    const shellC = golden ? '#FFE9A8' : key ? '#EAF6FF' : '#FFF6F0';
    const dotC = golden ? '#FFD34E' : key ? '#A8D4F5' : '#FFC9DD';
    const beamC = golden ? 0xFFE08A : key ? 0x8EC9F5 : 0xFFC4DC;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), M(shellC, { emissive: golden ? '#FFC94E' : key ? '#6FB9EE' : '#FFB7CB', ei: golden ? 0.5 : 0.22 }));
    shell.scale.set(0.85, 1.15, 0.85);
    shell.position.y = 0.4;
    shell.castShadow = true;
    g.add(shell);
    // 蛋壳斑点
    for (let i = 0; i < 4; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(dotC));
      const a = Math.PI * 2 * i / 4 + 0.5;
      dot.position.set(Math.cos(a) * 0.24, 0.42 + Math.sin(i * 1.7) * 0.14, Math.sin(a) * 0.24);
      dot.scale.z = 0.4;
      g.add(dot);
    }
    // 首字母提示牌（短语改用图标）
    const letter = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ map: letterTexture(word.icon || word.en[0], golden ? '#FFB93C' : key ? '#4A90D9' : '#FF8FB0'), transparent: true, side: THREE.DoubleSide }));
    letter.position.set(0, 0.48, 0.32);
    g.add(letter);
    // 序号角标：本关第几个词（顶上字母牌保留学习线索，角标给进度感和辨识度）
    let numTag = null;
    if (num) {
      numTag = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture(String(num), key ? '#4A90D9' : golden ? '#FFB93C' : '#FF8FB0', '#FFFDF4'),
        transparent: true, depthWrite: false,
      }));
      numTag.scale.setScalar(0.3);
      numTag.position.set(-0.28, 0.85, 0.1);
      g.add(numTag);
    }
    // 底座光圈
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 24), M(dotC, { emissive: golden ? '#FFC94E' : key ? '#6FB9EE' : '#FF9FB6', ei: 0.7 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);
    // 天空投下的光柱（远远就能看见）
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.5, 4.2, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: beamC, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    beam.position.y = 2.3;
    g.add(beam);
    // 钥匙蛋头顶挂一把小钥匙，告诉小朋友"这是开剧情的，不算本关进度"
    let keyTag = null;
    if (key) {
      keyTag = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture('🔑', '#FFD34E', '#FFFDF4'), transparent: true, depthWrite: false,
      }));
      keyTag.scale.setScalar(0.42);
      keyTag.position.y = 1.15;
      g.add(keyTag);
    }
    // 环绕的小星星
    const sparkles = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture('✦', golden ? '#FFE24E' : key ? '#B5E0FA' : '#FFC1DB', '#FFFDF4'), transparent: true, depthWrite: false,
      }));
      s.scale.setScalar(0.16);
      g.add(s);
      sparkles.push(s);
    }
    const [x, z] = posOverride ? [posOverride.x, posOverride.z] : word.pos;
    const baseY = posOverride ? (posOverride.y || 0) : (word.zone === 'sky' ? 14 : 0);   // 高台蛋会由 game 层改写 baseY
    g.position.set(x, baseY, z);
    this.scene.add(g);
    const egg = { group: g, word, shell, ring, beam, sparkles, keyTag, numTag, t: Math.random() * 9, golden, key, baseY };
    this.eggs.set(word.id, egg);
    return egg;
  }

  removeEgg(id) {
    const egg = this.eggs.get(id);
    if (!egg) return;
    this.scene.remove(egg.group);
    this.eggs.delete(id);
  }

  nearest(pos, maxDist = 2.6) {
    let best = null, bestD = maxDist;
    for (const egg of this.eggs.values()) {
      const d = Math.hypot(egg.group.position.x - pos.x, egg.group.position.z - pos.z);
      if (d < bestD) { bestD = d; best = egg; }
    }
    return best;
  }

  get(id) { return this.eggs.get(id); }

  update(dt, t) {
    for (const egg of this.eggs.values()) {
      egg.t += dt;
      egg.group.position.y = egg.baseY + Math.abs(Math.sin(egg.t * 1.6)) * 0.12;
      egg.group.rotation.y = Math.sin(egg.t * 0.8) * 0.4;
      const pulse = 0.18 + Math.sin(egg.t * 2.4) * 0.1;
      egg.shell.material.emissiveIntensity = egg.golden ? 0.45 + Math.sin(egg.t * 2.4) * 0.2 : pulse;
      egg.ring.rotation.z = t * 0.8;
      egg.beam.material.opacity = (egg.golden ? 0.2 : 0.13) + Math.sin(egg.t * 2.4) * 0.05;
      if (egg.keyTag) egg.keyTag.position.y = 1.15 + Math.sin(egg.t * 2) * 0.08;
      egg.sparkles.forEach((s, i) => {
        const a = t * 1.4 + i * Math.PI * 2 / 3;
        s.position.set(Math.cos(a) * 0.55, 0.45 + Math.sin(t * 2 + i * 2.1) * 0.22, Math.sin(a) * 0.55);
        s.material.opacity = 0.55 + Math.sin(t * 3 + i) * 0.35;
      });
    }
  }
}

// ---------- 已孵化的词宠 ----------
export class PetManager {
  constructor(scene) {
    this.scene = scene;
    this.pets = new Map();
    this.hearts = [];   // 飘起的爱心特效
  }

  spawn(word, posOverride = null) {
    const g = buildPet(word.pet);
    if (word.phrase) addPhraseTag(g, word.en, word.icon);
    else addLetterTag(g, word.en[0]);
    const [x, z] = posOverride ? [posOverride.x, posOverride.z] : word.pos;
    const baseY = word.zone === 'sky' ? 14 : 0;
    g.position.set(x, baseY, z);
    this.scene.add(g);
    const pet = {
      word, group: g, t: Math.random() * 8, baseY,
      home: new THREE.Vector2(x, z),
      target: new THREE.Vector2(x, z),
      wait: Math.random() * 2,
      hungry: false, jumping: false, jt: 0,
      flying: null,
    };
    this.pets.set(word.id, pet);
    return pet;
  }

  get(id) { return this.pets.get(id); }
  all() { return [...this.pets.values()]; }

  setHungry(id, v) {
    const p = this.pets.get(id);
    if (!p) return;
    p.hungry = v;
    if (v && !p.bubble) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const c = cv.getContext('2d');
      c.fillStyle = '#FFFDF8';
      c.beginPath(); c.arc(32, 30, 24, 0, Math.PI * 2); c.fill();
      c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('🍖', 32, 32);
      const tex = new THREE.CanvasTexture(cv);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      s.scale.setScalar(0.5);
      s.position.y = 1.05;
      s.name = 'hungryBubble';
      p.group.add(s);
      p.bubble = s;
    } else if (!v && p.bubble) {
      p.group.remove(p.bubble);
      p.bubble = null;
    }
  }

  celebrate(id) { // 喂饱后的开心跳 + 爱心
    const p = this.pets.get(id);
    if (!p) return;
    p.jumping = true; p.jt = 0;
    const pos = p.group.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: letterTexture('❤', ['#FF6B6B', '#FF8FB0', '#FF5E9C'][i % 3], '#FFF'), transparent: true, depthWrite: false,
      }));
      s.position.copy(pos);
      s.scale.setScalar(0.22);
      this.scene.add(s);
      const vx = (Math.random() - 0.5) * 1.2, vz = (Math.random() - 0.5) * 1.2, delay = i * 0.16;
      this.hearts.push({
        s, t: -delay, dur: 1.1,
        update: dt => {
          s.position.y += dt * 1.1;
          s.position.x += vx * dt; s.position.z += vz * dt;
          s.material.opacity = Math.max(0, 1 - Math.max(0, s.t) / 1.1);
        },
      });
    }
  }

  flyTo(id, target, duration, onDone) { // 召唤飞行
    const p = this.pets.get(id);
    if (!p) return;
    p.flying = {
      from: p.group.position.clone(),
      to: new THREE.Vector3(target.x, target.y ?? 0, target.z),
      t: 0, duration, onDone,
    };
  }

  update(dt, t, playerPos) {
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.t += dt;
      if (h.t > 0) h.update(dt);
      if (h.t >= h.dur) { this.scene.remove(h.s); this.hearts.splice(i, 1); }
    }
    const CULL_DIST = 70;   // 远处词宠隐藏（全收集后 932 只，不剔除会拖垮手机）
    for (const p of this.pets.values()) {
      if (playerPos) {
        const d = Math.hypot(p.group.position.x - playerPos.x, p.group.position.z - playerPos.z);
        p.group.visible = d < CULL_DIST;
        if (!p.group.visible) continue;
      }
      p.t += dt;
      // 召唤飞行优先
      if (p.flying) {
        p.flying.t += dt;
        const k = Math.min(1, p.flying.t / p.flying.duration);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        p.group.position.lerpVectors(p.flying.from, p.flying.to, e);
        p.group.position.y = THREE.MathUtils.lerp(p.flying.from.y, p.flying.to.y, e) + Math.sin(e * Math.PI) * 1.4;
        p.group.rotation.y += dt * 6 * (1 - k);
        if (k >= 1) {
          const cb = p.flying.onDone;
          p.flying = null;
          p.group.rotation.y = 0;
          if (cb) cb();
        }
        continue;
      }
      // 溜达
      if (p.jumping) {
        p.jt += dt;
        p.group.position.y = p.baseY + Math.abs(Math.sin(p.jt * 8)) * 0.35;
        if (p.jt > 1.4) { p.jumping = false; p.group.position.y = p.baseY; }
      } else {
        // 饿了的词宠会主动跑到小主人身边讨吃的（8 米内才追，追到 2.2 米内停下）
        if (p.hungry && playerPos) {
          const pd = Math.hypot(playerPos.x - p.group.position.x, playerPos.z - p.group.position.z);
          if (pd > 2.2 && pd < 10) p.target.set(playerPos.x, playerPos.z);
        }
        const dx = p.target.x - p.group.position.x, dz = p.target.y - p.group.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          p.wait -= dt;
          if (p.wait <= 0) {
            const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2.4;
            p.target.set(p.home.x + Math.cos(a) * r, p.home.y + Math.sin(a) * r);
            p.wait = 1.5 + Math.random() * 3.5;
          }
        } else {
          const sp = 0.55;
          p.group.position.x += dx / d * sp * dt;
          p.group.position.z += dz / d * sp * dt;
          p.group.rotation.y = Math.atan2(dx, dz);
          p.group.position.y = p.baseY + Math.abs(Math.sin(p.t * 7)) * 0.05;
        }
      }
      // 饿了的气泡呼吸
      if (p.bubble) p.bubble.position.y = 1.05 + Math.sin(p.t * 3) * 0.06;
    }
  }
}
