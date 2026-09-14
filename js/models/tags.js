// 贴纸域：emoji 徽章、字母挂牌、对话气泡贴图（Canvas 纹理）
import * as THREE from 'three';
import { M, add, G, sph, box, cyl, cone, cap, tor, face, quadBody } from './kit.js';

// 肚皮上的大 emoji 徽章（导出给场景物复用）
export function badge(g, emoji, y = 0.24, size = 0.2) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(emoji, '#FFFFFF', '#333'), transparent: true }));
  s.scale.setScalar(size * 3.4);
  s.center.set(0.5, 0.5);
  s.position.set(0, y, 0.16);
  s.renderOrder = 2;
  g.add(s);
  return s;
}

// ================= 字母挂牌 =================
export function letterTexture(letter, bg = '#FF8FB0', fg = '#FFFFFF') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.beginPath();
  c.roundRect(8, 8, 112, 112, 34);
  c.fill();
  c.fillStyle = fg;
  c.font = '900 84px "Segoe UI", "Microsoft YaHei", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(letter.toUpperCase(), 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 短语对话气泡：圆角气泡 + 大图标 + 自动换行的短语全文（近处可读）
export function speechBubbleTexture(text, emoji = '💬', bg = '#FFFDF6', fg = '#4A3B2E') {
  const W = 320, H = 224;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  // 气泡主体
  c.fillStyle = bg;
  c.strokeStyle = '#E3D4C2';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(10, 10, W - 20, H - 62, 30);
  c.fill(); c.stroke();
  // 指向下方的小尾巴
  c.beginPath();
  c.moveTo(W / 2 - 26, H - 60);
  c.lineTo(W / 2, H - 14);
  c.lineTo(W / 2 + 26, H - 60);
  c.closePath();
  c.fillStyle = bg; c.fill();
  c.strokeStyle = '#E3D4C2';
  c.beginPath(); c.moveTo(W / 2 - 26, H - 58); c.lineTo(W / 2, H - 14); c.lineTo(W / 2 + 26, H - 58); c.stroke();
  // 图标
  c.font = '64px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(emoji, W / 2, 62);
  // 短语文本（按空格换行）
  c.fillStyle = fg;
  c.font = '700 30px "Segoe UI", "Microsoft YaHei", sans-serif';
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (c.measureText(test).width > W - 64 && line) { lines.push(line); line = wd; }
    else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);
  const lh = 34;
  const startY = 108 + (3 - shown.length) * lh / 2;
  shown.forEach((ln, i) => c.fillText(ln, W / 2, startY + i * lh));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function addLetterTag(group, letter) {
  const geo = new THREE.PlaneGeometry(0.17, 0.17);
  const m = new THREE.MeshBasicMaterial({ map: letterTexture(letter), transparent: true, side: THREE.DoubleSide });
  const tag = new THREE.Mesh(geo, m);
  const h = tagHeight(group);
  tag.position.set(0, h * 0.62, tagDepth(group, h));
  tag.name = 'letterTag';
  group.add(tag);
  return tag;
}
function tagHeight(g) {
  const box = new THREE.Box3().setFromObject(g);
  return Math.max(0.3, box.max.y);
}
function tagDepth(g, h) {
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  return Math.min(0.3, (c.z - box.min.z) + (box.max.z - box.min.z) * 0.3 + 0.05);
}


// 短语词宠的悬浮气泡标牌（挂在头顶，比字母牌更醒目）
export function addPhraseTag(group, text, emoji) {
  const tex = speechBubbleTexture(text, emoji);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = tagHeight(group);
  s.scale.set(1.15, 0.8, 1);
  s.position.set(0, h + 0.5, 0.12);
  s.name = 'phraseTag';
  group.add(s);
  return s;
}
