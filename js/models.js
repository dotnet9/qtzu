// 程序化低模库总入口（兼容旧导入路径）：实现按域拆在 models/ 目录
// —— kit 几何工具箱 / pets-shapes 基础宠物形 / auto-templates 参数化词宠
// —— tags 徽章字母牌 / player 玩家 / props-nature+props-build+props-street 场景物 / build 词宠工厂
import * as nature from './models/props-nature.js';
import * as build from './models/props-build.js';
import * as street from './models/props-street.js';   // 街道家具（路灯/长椅/花箱/指路牌…）

export * from './models/kit.js';
export { PET_COLORS, PETS } from './models/pets-shapes.js';
export { badge, letterTexture, speechBubbleTexture, addLetterTag, addPhraseTag } from './models/tags.js';
export { AUTO_TEMPLATES } from './models/auto-templates.js';
export { buildPlayer } from './models/player.js';
export { setAutoSpecs, buildPet, petThumbnail } from './models/build.js';

// 场景物总表：nature + build + street 三半合并（对外仍是同一个 PROPS）
export const PROPS = { ...nature, ...build, ...street };
