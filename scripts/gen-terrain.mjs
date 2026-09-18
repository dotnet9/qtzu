// 批量生成各城市微缩地形配置 data/cities/<id>/terrain.json
//
// 为什么不再是"模板×分配表"：旧版 15 个模板里，9 城共用 imperial、11 城共用 coast，
// 唯一的城市差异 seed 只喂给雪峰——于是北京和开封是同一座山、同一条河、同一片田。
// 现在每城写一条真实地理（山在哪一侧、大河怎么走、湖/海岸在哪个角），只保留"一看就知道"的
// 2~5 个地物；落点由真实轮廓决定（自动贴合），高度由实测校准（够高才留）。
//
// 坐标约定：x+ = 东，z+ = 南（与 city-shape-data.js「经度→x，纬度北→-z」一致）；
//          归一化原点 = 轮廓包围盒中心，x/z 各自映射到包围盒半跨。
//
// 用法：node scripts/gen-terrain.mjs [cityId...]     只给 id 时只重生那几城
import { writeFileSync, existsSync } from 'fs';
import {
  PALETTES, ROCK, TG, FW, FS,
  mtn, hill, ridge, riv, lake, terrace, farm,
  baseCfg, cityIds, readCity, makeField, fitPlaza, fitToShape, tuneHeights, auditCity,
} from './terrain-lib.mjs';

/* =====================================================================
   每城真实地理。字段：
     palette  气候带色带（GRASS 温带 / LOESS 黄土 / PLATEAU 高原 / SAND 沙 / COLD 冷 /
              KARST 喀斯特 / TROPIC 热带 / RICH 常绿）
     roll     全域起伏（平原城也要有微丘；山地城调低，免得抢了山的形）
     snow     雪线（[起,满]，默认关闭）
     rock     裸岩带（米，可选）
     ridges   山脉：{from,to,amp,w}    mountain/mountains 孤立山体   hills 丘陵
     rivers   [{pts,w}] 或 [pts]      lake/lakes 湖/海
     terrace  梯田    farm 农田
   ===================================================================== */
const GEO = {
  /* ---------- 华北平原 ---------- */
  beijing: () => ({
    palette: 'GRASS', roll: 0.6, rock: [3.4, 4.6], rockColor: ROCK.WARM,
    // 西山（西）+ 燕山（北），城在东南平原上
    ridges: [ridge([-0.80, -0.72], [-0.78, 0.60], 6.8, 0.30), ridge([-0.78, -0.78], [0.55, -0.80], 5.2, 0.26)],
    rivers: [riv([[-0.60, -0.45], [-0.45, -0.15], [-0.30, 0.15], [-0.20, 0.45], [-0.15, 0.75]], 1.0)],  // 永定河
    farm: farm(0.45, 0.10, 0.14, 0.30),
  }),
  tianjin: () => ({
    palette: 'GRASS', roll: 0.5,
    // 海河自西北向东南入海；东南角是渤海湾
    rivers: [riv([[-0.35, -0.80], [-0.20, -0.35], [-0.05, 0.05], [0.05, 0.40], [0.12, 0.78]], 1.6)],
    lake: lake(0.55, 0.30, 7.5, 5.5),
    hill: hill(-0.55, -0.55, 1.6),
    farm: farm(-0.15, -0.45, 0.14, 0.28),
  }),
  shijiazhuang: () => ({
    palette: 'GRASS', roll: 0.8, rock: [3.0, 4.2], rockColor: ROCK.WARM,
    ridges: [ridge([-0.80, -0.70], [-0.78, 0.68], 6.0, 0.28)],                                    // 太行山：西
    rivers: [riv([[-0.45, -0.70], [-0.32, -0.30], [-0.20, 0.10], [-0.10, 0.48], [-0.05, 0.78]], 0.9)], // 滹沱河
    farm: farm(0.35, 0.05, 0.16, 0.34),
  }),
  zhengzhou: () => ({
    palette: 'GRASS', roll: 0.7,
    ridges: [ridge([-0.55, 0.30], [-0.80, 0.78], 4.2, 0.24)],                                    // 嵩山：西南
    rivers: [riv([[-0.80, -0.66], [0.20, -0.70], [0.80, -0.62]], 1.8)],                           // 黄河：横贯北缘
    farm: farm(0.30, 0.15, 0.16, 0.34),
  }),
  luoyang: () => ({
    palette: 'LOESS', roll: 0.9, rock: [3.2, 4.4], rockColor: ROCK.LOESS,
    terrace: terrace(0.28, 0.28),
    hills: [hill(-0.05, -0.55, 2.6), hill(-0.50, -0.35, 2.2)],                                    // 邙山：北
    ridges: [ridge([-0.70, -0.10], [-0.82, 0.60], 4.5, 0.24)],                                    // 伏牛山：西南
    rivers: [riv([[-0.60, -0.25], [-0.20, -0.08], [0.20, 0.10], [0.60, 0.35]], 1.1)],             // 伊洛河
    farm: farm(0.40, -0.30, 0.14, 0.28),
  }),
  kaifeng: () => ({
    palette: 'GRASS', roll: 0.7,
    // 黄河"地上悬河"：比城里高，横贯北缘
    rivers: [riv([[-0.85, -0.62], [0.0, -0.66], [0.85, -0.58]], 2.2)],
    farm: farm(0.10, 0.20, 0.20, 0.40),
  }),
  qufu: () => ({
    palette: 'GRASS', roll: 0.8,
    hills: [hill(0.50, 0.50, 2.2)],                                                               // 尼山：东南
    rivers: [riv([[-0.80, 0.25], [-0.20, 0.32], [0.40, 0.26], [0.80, 0.32]], 1.0)],               // 沂河
    farm: farm(-0.25, -0.30, 0.18, 0.36),
  }),
  taiyuan: () => ({
    palette: 'LOESS', roll: 0.8, rock: [3.2, 4.4], rockColor: ROCK.LOESS,
    terrace: terrace(0.30, -0.30),
    ridges: [ridge([-0.78, -0.60], [-0.76, 0.60], 6.0, 0.26)],                                    // 西山：西
    rivers: [riv([[-0.05, -0.80], [-0.02, -0.30], [0.02, 0.20], [0.05, 0.80]], 1.3)],             // 汾河：纵贯
  }),
  datong: () => ({
    palette: 'LOESS', roll: 0.9, rock: [3.4, 4.6], rockColor: ROCK.LOESS,
    terrace: terrace(0.25, 0.30),
    ridges: [ridge([-0.80, -0.60], [0.80, -0.56], 6.0, 0.28)],                                    // 武州山：北
    rivers: [riv([[-0.60, 0.30], [-0.20, 0.22], [0.30, 0.26], [0.75, 0.32]], 1.0)],               // 桑干河
  }),
  hohhot: () => ({
    palette: 'GRASS', roll: 1.0,
    ridges: [ridge([-0.80, -0.66], [0.80, -0.70], 6.0, 0.30)],                                    // 大青山：北
    farm: farm(0.0, 0.35, 0.18, 0.36),
  }),

  /* ---------- 西北 ---------- */
  xian: () => ({
    palette: 'GRASS', roll: 0.6, snow: [5.6, 6.8], rock: [3.6, 4.8], rockColor: ROCK.COOL,
    ridges: [ridge([-0.80, 0.58], [0.80, 0.66], 7.5, 0.30)],                                      // 秦岭：横贯南缘
    rivers: [riv([[-0.80, -0.48], [0.40, -0.54], [0.80, -0.44]], 1.5)],                           // 渭河：横贯北缘
    farm: farm(0.20, 0.02, 0.16, 0.32),
  }),
  lanzhou: () => ({
    palette: 'LOESS', roll: 0.6, rock: [3.0, 4.2], rockColor: ROCK.LOESS,
    // 两山夹一河：黄河横贯全城，南北皆山
    rivers: [riv([[-0.85, -0.12], [-0.42, -0.02], [0.0, 0.06], [0.42, 0.10], [0.85, 0.04]], 2.4)],
    ridges: [ridge([-0.80, -0.60], [0.80, -0.54], 5.5, 0.24), ridge([-0.80, 0.52], [0.80, 0.58], 6.0, 0.26)],
  }),
  yinchuan: () => ({
    palette: 'GRASS', roll: 1.0,
    ridges: [ridge([-0.78, -0.68], [-0.76, 0.68], 6.5, 0.28)],                                    // 贺兰山：西
    rivers: [riv([[0.30, -0.80], [0.42, -0.30], [0.50, 0.20], [0.55, 0.78]], 1.7)],               // 黄河：东侧纵贯
    lake: lake(0.02, -0.42, 5.0, 3.4),
    farm: farm(0.0, 0.35, 0.18, 0.36),
  }),
  xining: () => ({
    palette: 'PLATEAU', roll: 0.7, snow: [4.6, 5.8], rock: [3.2, 4.4], rockColor: ROCK.COOL,
    rivers: [riv([[-0.35, -0.80], [-0.15, -0.30], [0.05, 0.25], [0.20, 0.80]], 1.2)],             // 湟水：纵贯河谷
    ridges: [ridge([-0.80, -0.58], [-0.78, 0.58], 6.5, 0.30), ridge([0.72, -0.58], [0.76, 0.58], 6.0, 0.30)],
  }),
  dunhuang: () => ({
    palette: 'SAND', roll: 1.3, farmStripe: FS,
    ridges: [ridge([-0.80, 0.40], [0.80, 0.46], 5.5, 0.30)],                                      // 鸣沙山：南缘
    lake: lake(-0.10, 0.28, 2.4, 1.7),                                                            // 月牙泉
    farm: farm(0.42, -0.32, 0.10, 0.22),
  }),
  urumqi: () => ({
    palette: 'GRASS', roll: 0.7, snow: [4.8, 6.0], rock: [3.4, 4.6], rockColor: ROCK.COOL,
    ridges: [ridge([-0.80, 0.58], [0.80, 0.64], 7.0, 0.32)],                                      // 天山：南
    hill: hill(0.0, 0.05, 2.0),                                                                   // 红山：城中
    farm: farm(-0.38, -0.34, 0.12, 0.26),
  }),

  /* ---------- 青藏 / 云贵高原 ---------- */
  lhasa: () => ({
    palette: 'PLATEAU', roll: 0.4, snow: [4.6, 5.8], rock: [3.2, 4.4], rockColor: ROCK.COOL,
    // 念青唐古拉（北）+ 喜马拉雅余脉（南）夹拉萨河谷
    ridges: [ridge([-0.80, -0.56], [0.80, -0.58], 8.0, 0.30), ridge([-0.80, 0.58], [0.80, 0.56], 8.5, 0.30)],
    rivers: [riv([[-0.80, 0.05], [-0.30, -0.05], [0.30, 0.10], [0.80, 0.20]], 1.6)],              // 拉萨河
  }),
  kunming: () => ({
    palette: 'RICH', roll: 0.9,
    lake: lake(-0.38, 0.42, 9, 7),                                                                // 滇池：西南
    ridges: [ridge([-0.45, 0.05], [-0.58, 0.72], 5.0, 0.26)],                                     // 西山
    hill: hill(0.35, -0.35, 2.2),
    farm: farm(0.40, 0.15, 0.14, 0.30),
  }),
  guiyang: () => ({
    palette: 'KARST', roll: 1.0, rock: [2.4, 3.6], rockColor: ROCK.KARST,
    // 峰林：一堆圆锥状孤峰（喀斯特）
    peaks: [[-0.45, -0.30, 6.5, 2.6], [-0.62, -0.15, 5.5, 2.4], [-0.28, -0.14, 5.8, 2.5], [-0.40, -0.52, 5.0, 2.2], [-0.70, -0.42, 4.6, 2.0]],
    hill: hill(0.48, 0.40, 2.2),
    farm: farm(0.30, -0.10, 0.12, 0.24),
  }),
  chongqing: () => ({
    palette: 'KARST', roll: 0.8, rock: [2.6, 3.8], rockColor: ROCK.KARST,
    // 长江自西南向东，嘉陵江自北来汇（朝天门）
    rivers: [riv([[-0.80, 0.55], [-0.40, 0.32], [0.0, 0.14], [0.40, -0.02], [0.80, -0.25]], 2.4),
             riv([[-0.20, -0.80], [-0.06, -0.40], [0.0, 0.14]], 1.8)],
    hills: [hill(0.35, 0.42, 3.4), hill(-0.45, -0.32, 3.0), hill(-0.52, 0.45, 2.6)],
  }),

  /* ---------- 东北 ---------- */
  harbin: () => ({
    palette: 'COLD', roll: 0.9, snow: [4.6, 5.6],
    rivers: [riv([[-0.80, -0.30], [-0.30, -0.26], [0.20, -0.24], [0.80, -0.28]], 2.4)],            // 松花江：横贯北侧
    hill: hill(0.45, 0.35, 2.0),
    farm: farm(0.10, 0.45, 0.16, 0.32),
  }),
  changchun: () => ({
    palette: 'GRASS', roll: 1.0,
    lake: lake(0.45, 0.42, 6.0, 4.5),                                                             // 净月潭：东南
    hill: hill(-0.45, -0.30, 1.8),
    farm: farm(0.0, -0.10, 0.22, 0.42),
  }),
  shenyang: () => ({
    palette: 'GRASS', roll: 0.9,
    rivers: [riv([[-0.80, 0.38], [-0.30, 0.32], [0.30, 0.36], [0.80, 0.42]], 1.8)],               // 浑河：南
    hill: hill(0.30, -0.30, 2.0),
    farm: farm(-0.30, -0.20, 0.18, 0.34),
  }),
  dalian: () => ({
    palette: 'GRASS', roll: 1.0,
    lakes: [lake(0.10, 0.58, 8.5, 5.5), lake(-0.58, 0.28, 5.5, 4.0)],                             // 黄渤海：南
    hills: [hill(-0.28, -0.38, 2.8), hill(0.48, -0.24, 2.4)],
    farm: farm(0.10, -0.50, 0.12, 0.24),
  }),
  chengde: () => ({
    palette: 'GRASS', roll: 0.8, snow: [5.0, 6.2], rock: [3.2, 4.4], rockColor: ROCK.WARM,
    ridges: [ridge([-0.80, -0.52], [0.25, -0.78], 6.0, 0.28)],                                    // 燕山：北
    lakes: [lake(0.15, 0.15, 4.5, 3.2), lake(-0.12, 0.32, 3.0, 2.2)],                             // 避暑山庄湖区
    hill: hill(-0.48, 0.45, 2.2),
  }),

  /* ---------- 华东 ---------- */
  jinan: () => ({
    palette: 'RICH', roll: 0.8,
    hills: [hill(0.12, 0.45, 2.6), hill(-0.42, 0.38, 2.2)],                                       // 千佛山：南
    lake: lake(0.0, -0.02, 4.2, 3.2),                                                             // 大明湖
    rivers: [riv([[-0.70, -0.25], [-0.30, -0.10], [0.10, 0.0], [0.60, 0.06]], 1.2)],              // 小清河
  }),
  qingdao: () => ({
    palette: 'RICH', roll: 1.0,
    ridges: [ridge([0.25, -0.58], [0.80, -0.28], 5.0, 0.24)],                                     // 崂山：东
    lake: lake(-0.28, 0.52, 6.5, 5.0),                                                            // 胶州湾
    hill: hill(-0.48, -0.38, 2.0),
    farm: farm(-0.10, -0.10, 0.16, 0.32),
  }),
  shanghai: () => ({
    palette: 'RICH', roll: 0.8,
    // 黄浦江纵贯 + 苏州河横贯；佘山是全城唯一的山
    rivers: [riv([[-0.45, -0.80], [-0.22, -0.40], [0.0, 0.0], [0.15, 0.42], [0.10, 0.80]], 1.7),
             riv([[-0.80, 0.08], [0.30, -0.05], [0.80, -0.10]], 0.9)],
    hill: hill(0.60, -0.48, 1.8),
    farm: farm(-0.52, 0.38, 0.16, 0.32),
  }),
  suzhou: () => ({
    palette: 'RICH', roll: 0.7,
    lake: lake(-0.62, 0.28, 7.5, 5.5),                                                            // 太湖：西
    rivers: [riv([[-0.80, 0.0], [-0.30, 0.02], [0.20, 0.0], [0.80, 0.04]], 1.2),
             riv([[-0.20, -0.78], [0.0, -0.30], [0.05, 0.20], [0.0, 0.78]], 1.0)],                // 水网纵横
    hills: [hill(0.30, -0.28, 1.6), hill(-0.48, -0.35, 2.2)],                                     // 虎丘 + 穹窿山
    farm: farm(0.40, 0.35, 0.16, 0.32),
  }),
  wuxi: () => ({
    palette: 'RICH', roll: 0.7,
    lake: lake(0.05, 0.58, 8, 5),                                                                 // 太湖：南
    rivers: [riv([[-0.80, -0.20], [-0.20, -0.10], [0.40, 0.0], [0.80, 0.06]], 1.1)],
    hill: hill(0.15, -0.45, 2.2),                                                                 // 惠山：北
    farm: farm(0.30, -0.35, 0.16, 0.32),
  }),
  yangzhou: () => ({
    palette: 'RICH', roll: 0.7,
    lake: lake(-0.32, -0.22, 5.0, 3.6),                                                           // 瘦西湖
    rivers: [riv([[-0.80, 0.35], [-0.20, 0.30], [0.40, 0.32], [0.80, 0.30]], 1.8),                // 长江：南
             riv([[-0.05, -0.80], [-0.02, -0.30], [0.0, 0.30], [0.02, 0.80]], 1.3)],              // 大运河：纵贯
    hill: hill(-0.05, -0.38, 1.5),                                                                // 蜀冈：北
    farm: farm(0.45, -0.10, 0.16, 0.32),
  }),
  hangzhou: () => ({
    palette: 'RICH', roll: 0.8,
    lake: lake(-0.32, 0.06, 5.5, 4.5),                                                            // 西湖
    ridges: [ridge([-0.80, -0.48], [-0.76, 0.58], 5.5, 0.26)],                                    // 西面群山
    rivers: [riv([[-0.50, 0.72], [0.0, 0.60], [0.50, 0.68], [0.80, 0.70]], 1.9)],                 // 钱塘江：南
    farm: farm(0.40, -0.35, 0.16, 0.32),
  }),
  nanjing: () => ({
    palette: 'RICH', roll: 0.8,
    rivers: [riv([[-0.80, 0.32], [-0.40, 0.14], [0.0, 0.0], [0.35, -0.20], [0.70, -0.45]], 2.2)], // 长江：西北→东南
    hills: [hill(0.52, -0.10, 2.6), hill(0.20, 0.48, 2.0)],                                       // 紫金山
    lake: lake(0.15, -0.32, 4.0, 3.0),                                                            // 玄武湖
    farm: farm(-0.50, 0.58, 0.14, 0.28),
  }),
  hefei: () => ({
    palette: 'RICH', roll: 0.9,
    lake: lake(0.30, 0.55, 7, 4.8),                                                               // 巢湖：南
    hill: hill(-0.50, -0.35, 2.0),
    farm: farm(-0.28, 0.22, 0.18, 0.36),
  }),
  nanchang: () => ({
    palette: 'RICH', roll: 0.9,
    rivers: [riv([[-0.32, 0.80], [-0.20, 0.30], [-0.05, -0.20], [0.05, -0.78]], 1.8)],            // 赣江：南→北
    lake: lake(0.52, -0.50, 6, 4.2),                                                              // 鄱阳湖：东北
    hill: hill(-0.58, 0.28, 2.2),
    farm: farm(0.40, 0.35, 0.14, 0.30),
  }),
  fuzhou: () => ({
    palette: 'TROPIC', roll: 0.9,
    rivers: [riv([[-0.80, -0.10], [-0.30, 0.0], [0.20, 0.10], [0.80, 0.20]], 1.8)],               // 闽江
    hills: [hill(0.52, -0.28, 2.8)],                                                              // 鼓山：东
    lake: lake(-0.52, 0.48, 6, 4.4),
  }),
  xiamen: () => ({
    palette: 'TROPIC', roll: 0.8,
    lakes: [lake(-0.55, -0.35, 7, 5), lake(0.55, 0.42, 6, 4.5)],                                  // 环岛海面
    hill: hill(0.0, 0.10, 2.4),
    farm: farm(-0.20, -0.55, 0.10, 0.22),
  }),
  quanzhou: () => ({
    palette: 'TROPIC', roll: 0.9,
    lakes: [lake(0.12, 0.58, 7, 4.5)],                                                            // 泉州湾：南
    hills: [hill(-0.48, -0.32, 2.6), hill(0.45, -0.28, 2.2)],
    farm: farm(-0.10, 0.18, 0.16, 0.32),
  }),
  shaoxing: () => ({
    palette: 'RICH', roll: 0.7,
    lakes: [lake(-0.55, -0.32, 4.5, 3.4), lake(0.48, 0.38, 4.0, 3.0)],                            // 鉴湖 / 水网
    rivers: [riv([[-0.55, -0.12], [-0.20, -0.06], [0.20, -0.08], [0.55, -0.12]], 1.3),
             riv([[-0.20, -0.55], [-0.10, -0.20], [0.0, 0.20], [0.10, 0.55]], 1.1)],
    hills: [hill(0.48, -0.45, 2.2)],                                                              // 会稽山：南
    farm: farm(-0.10, 0.42, 0.16, 0.32),
  }),

  /* ---------- 华中 / 华南 ---------- */
  wuhan: () => ({
    palette: 'RICH', roll: 0.8,
    // 长江自西南向东，汉水自北来汇；东湖成片
    rivers: [riv([[-0.80, 0.42], [-0.35, 0.14], [0.10, -0.05], [0.50, -0.20], [0.80, -0.28]], 2.4),
             riv([[-0.20, -0.80], [-0.10, -0.42], [0.05, -0.10], [0.10, -0.02]], 1.4)],
    lakes: [lake(0.08, 0.05, 4.5, 3.4), lake(0.45, 0.28, 3.2, 2.4)],
    hill: hill(-0.55, -0.48, 2.0),
  }),
  changsha: () => ({
    palette: 'RICH', roll: 0.8,
    rivers: [riv([[-0.10, -0.82], [-0.05, -0.30], [0.0, 0.20], [0.02, 0.82]], 1.8)],              // 湘江：纵贯
    hill: hill(-0.55, 0.10, 2.6),                                                                 // 岳麓山：西
    farm: farm(0.45, 0.28, 0.20, 0.40),
  }),
  guangzhou: () => ({
    palette: 'TROPIC', roll: 0.8, farmStripe: FS,
    rivers: [riv([[-0.80, -0.05], [-0.30, -0.10], [0.15, -0.05], [0.50, 0.05], [0.80, 0.12]], 2.0)], // 珠江
    hill: hill(0.05, -0.48, 2.4),                                                                 // 白云山：北
    lake: lake(0.30, 0.50, 4.0, 3.0),
    farm: farm(-0.38, 0.48, 0.14, 0.28),
  }),
  shenzhen: () => ({
    palette: 'TROPIC', roll: 1.0,
    lakes: [lake(-0.10, 0.60, 8, 5)],                                                             // 南海：南
    hills: [hill(0.25, -0.32, 2.8), hill(-0.48, -0.24, 2.4)],
    farm: farm(-0.52, 0.18, 0.10, 0.22),
  }),
  zhuhai: () => ({
    palette: 'TROPIC', roll: 1.0,
    lakes: [lake(0.12, 0.58, 7.5, 4.8)],                                                          // 南海：南
    hills: [hill(-0.38, -0.20, 2.6), hill(0.52, -0.28, 2.2)],
  }),
  nanning: () => ({
    palette: 'TROPIC', roll: 0.9, farmStripe: FS,
    rivers: [riv([[-0.80, 0.10], [-0.30, 0.0], [0.30, 0.05], [0.80, 0.15]], 1.8)],                // 邕江
    hill: hill(0.35, -0.30, 2.2),
    farm: farm(-0.30, 0.35, 0.16, 0.32),
  }),
  haikou: () => ({
    palette: 'TROPIC', roll: 0.9, farmStripe: FS,
    rivers: [riv([[-0.20, -0.80], [0.0, -0.40], [0.15, 0.0], [0.25, 0.45], [0.30, 0.80]], 1.4)],   // 南渡江
    lake: lake(-0.52, -0.50, 6, 4.5),                                                             // 琼州海峡：北
    hill: hill(0.48, 0.32, 1.8),
  }),
  sanya: () => ({
    palette: 'TROPIC', roll: 0.7, farmStripe: FS,
    lake: lake(0.20, -0.55, 7, 4.5),                                                              // 三亚湾
    hills: [hill(-0.55, 0.38, 2.6), hill(0.52, 0.45, 2.0)],
    farm: farm(0.0, 0.12, 0.18, 0.36),
  }),

  /* ---------- 台湾 ---------- */
  taipei: () => ({
    palette: 'TROPIC', roll: 0.9,
    rivers: [riv([[-0.15, -0.80], [-0.10, -0.35], [-0.05, 0.10], [0.0, 0.58]], 1.4)],             // 淡水河：穿盆地
    ridges: [ridge([-0.80, -0.58], [0.80, -0.56], 5.5, 0.28)],                                    // 阳明山：北
    hills: [hill(-0.52, 0.38, 2.2)],
  }),
  kaohsiung: () => ({
    palette: 'TROPIC', roll: 0.9,
    lakes: [lake(0.10, -0.58, 7, 4.5)],                                                           // 高雄港
    hills: [hill(-0.32, 0.32, 2.6), hill(0.48, 0.28, 2.2)],
  }),
  taichung: () => ({
    palette: 'TROPIC', roll: 0.8, farmStripe: FS,
    lakes: [lake(-0.52, 0.18, 6, 4.5)],                                                           // 台湾海峡：西
    hills: [hill(0.45, -0.10, 2.4), hill(0.30, 0.48, 2.0)],                                       // 中央山脉：东
    farm: farm(0.0, 0.0, 0.20, 0.40),
  }),
  tainan: () => ({
    palette: 'TROPIC', roll: 0.8, farmStripe: FS,
    lakes: [lake(-0.55, -0.12, 6.5, 4.6)],                                                        // 台湾海峡：西
    hills: [hill(0.48, 0.18, 2.0)],
    farm: farm(0.05, 0.0, 0.22, 0.42),                                                            // 嘉南平原
  }),
};

/* ================= 生成 ================= */
const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const ids = cityIds().filter(id => !only.length || only.includes(id));
const report = [];
let made = 0;

for (const id of ids) {
  if (!GEO[id]) { report.push({ id, note: '未写 GEO（跳过，保留现有配置）' }); continue; }
  const city = readCity(id);
  const g = GEO[id]();
  const cfg = baseCfg(id, {
    // 全域起伏统一抬一档：0.9m 台地量化下，"有起伏"意味着至少一级台阶，
    // 缓丘太平就等于没起伏（体检的起伏率门槛会直接卡住）
    palette: g.palette, roll: +(g.roll + 1.2).toFixed(2),
    noise: g.noise ?? (g.roll >= 1.0 ? 1.4 : 1.0),
    riverW: g.riverW, plazaOuter: g.plazaOuter, snow: g.snow ?? [99, 100],
  });
  if (g.rock) { cfg.rock = g.rock; cfg.colors.rock = g.rockColor || ROCK.COOL; }
  if (g.farmStripe) cfg.colors.farmStripe = g.farmStripe;
  for (const k of ['mountain', 'mountains', 'hill', 'hills', 'ridges', 'rivers', 'lake', 'lakes', 'peaks', 'terrace', 'farm']) {
    if (g[k] !== undefined) cfg[k] = g[k];
  }
  const log = [];
  // 建场 → 广场尺寸自适应 → 贴合 → 实高校准 → 体检
  fitPlaza(makeField(id, city, cfg), cfg);
  fitToShape(makeField(id, city, cfg), cfg, log);
  tuneHeights(id, city, cfg, log);
  const audit = auditCity(id, city, cfg);
  writeFileSync(`data/cities/${id}/terrain.json`, JSON.stringify(cfg, null, 2) + '\n');
  made++;
  report.push({ id, log, audit });
}

/* ---- 报表 ---- */
let fail = 0;
console.log('城市          主峰   起伏率  单步   地物');
console.log('─'.repeat(88));
for (const r of report) {
  if (r.note) { console.log(`  ${r.id.padEnd(12)} ${r.note}`); continue; }
  const { fail: f, warn: w, stats } = r.audit;
  const feats = [
    r.log.some(s => s.startsWith('删')) ? '删地物' : '',
    stats.hasMountain ? '山' : '', '',
  ].filter(Boolean).join('');
  console.log(`${f.length ? '✗' : (w.length ? '!' : ' ')} ${r.id.padEnd(12)} ${stats.hi.toFixed(1).padStart(5)}m ${(stats.relief * 100).toFixed(0).padStart(5)}% ${stats.maxStep.toFixed(2).padStart(5)}m  ${feats}`);
  for (const x of f) console.log(`      ✗ ${x}`);
  for (const x of w) console.log(`      ! ${x}`);
  for (const x of r.log) console.log(`      · ${x}`);
  fail += f.length ? 1 : 0;
}
console.log('─'.repeat(88));
console.log(`生成 ${made} 城；硬门槛不达标 ${fail} 城`);
process.exit(fail ? 1 : 0);
