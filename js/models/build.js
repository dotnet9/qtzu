// 词宠工厂调度：PETS 手工表优先，否则按 AUTO_SPECS 走参数化模板；附缩略图渲染
import * as THREE from 'three';
import { G, sph } from './kit.js';
import { PETS } from './pets-shapes.js';
import { AUTO_TEMPLATES } from './auto-templates.js';

// ---- 调度器 ----
let AUTO_SPECS_MAP = null;
export function setAutoSpecs(map) { AUTO_SPECS_MAP = map; }

// ================= 词宠工厂 & 缩略图 =================
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

let thumbRenderer = null;
const thumbCache = {};
export function petThumbnail(petId) {
  if (thumbCache[petId]) return thumbCache[petId];
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(128, 128);
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  const pet = buildPet(petId);
  scene.add(pet);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffe4f0, 2.2));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const bb = new THREE.Box3().setFromObject(pet);
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  cam.position.set(center.x + maxDim * 0.9, center.y + maxDim * 0.7, center.z + maxDim * 1.3);
  cam.lookAt(center);
  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbCache[petId] = url;
  return url;
}
