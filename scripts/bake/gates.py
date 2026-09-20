# -*- coding: utf-8 -*-
"""大学校门烘焙：按 scripts/bake/specs/gates.*.json 的规格逐个生成粘土手办风 GLB。

规格来源 scripts/bake/specs.mjs（复用 js/uni-gates.js 的风格族与招牌门规则）；
本文件只负责"怎么长"，不负责"是谁"。

契约（运行时依赖，勿改）：
  原点在脚底中心、正面朝 glTF +Z、单位同 js/models → 调用方 scale 0.5 + 贴地 + 朝向城心。
  manifest 里回填 beamY/beamW/fz，运行时用它把校徽匾额贴到横梁正面（js/uni-gate-models.js:678）。
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

# 通用零件（blob/slab/ring/arc/pillar）与坐标换算都在 common.py，各 kind 共用一份；
# TAU 从没被用到，一并删掉。本文件只保留校门特有的"门前空地"。
FR = C.FR
at = C.at
rot_of = C.rot_of
blob, slab, ring, arc, pillar = C.blob, C.slab, C.ring, C.arc, C.pillar
cone_at = C.cone_at


def ground(soup, fz=0.4, w=2.4, color='#D8CCA8'):
    """门前空地：与 js/uni-gate-models.js:731 同位（y=0.05 / 前 0.4）。"""
    slab(soup, w, 0.1, 1.2, color, (0, FR(fz), 0.05), jitter=0.006)


# ---------------------------------------------------------------- 风格族门型
# 每个函数返回 (beamY, beamW, fz)，与 js 的 FAMILY 同签名同含义

def fam_classic(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'round', 0.33, plinth=c2)
    for sx in (-px + 0.72, px - 0.72):
        soup.add(C.cyl(0.17, 0.15, h - 0.5, 18), c1, loc=(sx, 0, (h - 0.5) / 2),
                rough=0.93, jitter=0.01)
    slab(soup, px * 2 + 1.15, 0.4, 0.62, c1, (0, 0, h + 0.38))
    slab(soup, px * 2 + 0.95, 0.16, 0.7, c2, (0, 0, h + 0.12))
    slab(soup, px * 2 + 1.25, 0.22, 0.5, c4, (0, 0, h + 0.7))
    for sx in (-px - 0.85, px + 0.85):     # 侧边绿植：粘土团
        blob(soup, 0.34, '#6FAF6F', (sx, 0, 0.5), (1.1, 1, 0.85))
        soup.add(C.cyl(0.1, 0.12, 0.4, 12), '#8A6844', loc=(sx, 0, 0.2), jitter=0.01)
    return h + 0.38, px * 2 + 1.0, 0.31 + 0.03


def fam_chip(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    glow = '#AEE0FF'
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'box', 0.35, plinth=c4)
        slab(soup, 0.34, 0.34, 0.06, glow, (sx, FR(0.36), h * 0.58), emissive=glow, ei=0.85)
        blob(soup, 0.3, glow, (sx, 0, h + 0.42), emissive=glow, ei=0.9)
    slab(soup, px * 2 + 1.15, 0.44, 0.6, c2, (0, 0, h + 0.45))
    for i in range(-2, 3):                 # 电路引脚
        slab(soup, 0.3, 0.2, 0.66, c3, (i * 0.82, 0, h + 0.45), jitter=0.004)
    slab(soup, px * 2 + 0.7, 0.18, 0.52, c4, (0, 0, h + 0.75))
    blob(soup, 0.36, glow, (0, 0, h - 0.78), emissive=glow, ei=0.8)
    return h + 0.45, px * 2 + 1.0, 0.3 + 0.03


def fam_rail(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'box', 0.32, plinth=c4)
        slab(soup, 0.84, 0.28, 0.84, c4, (sx, 0, h + 0.1))
    slab(soup, px * 2 + 1.15, 0.44, 0.6, c4, (0, 0, h + 0.45))
    for i in range(-2, 3):                 # 铆钉
        blob(soup, 0.09, c3, (i * 0.84, FR(0.3), h + 0.45), jitter=0.004)
    for ry in (0.62, 0.92):                # 穿门铁轨
        slab(soup, px * 2 + 0.5, 0.06, 0.1, '#6E7278', (0, FR(ry), 0.07), jitter=0.004)
    for i in range(-3, 4):
        slab(soup, 0.5, 0.05, 0.56, '#7A5C42', (i * 0.62, FR(0.77), 0.035), jitter=0.004)
    lx = px - 1.3                          # 蒸汽小机车（门内侧）
    soup.add(C.cyl(0.31, 0.31, 1.05, 20), '#4E8A66', loc=(lx, FR(0.8), 0.74), rot=(0, math.pi / 2, 0),
            jitter=0.008)
    slab(soup, 0.6, 0.66, 0.7, '#3E6E52', (lx - 0.76, FR(0.8), 0.94))
    soup.add(C.cyl(0.09, 0.11, 0.42, 14), c4, loc=(lx + 0.34, FR(0.8), 1.24), jitter=0.008)
    blob(soup, 0.13, c3, (lx - 0.05, FR(0.8), 1.04))
    for i in range(3):                     # 车轮
        soup.add(C.cyl(0.17, 0.17, 0.09, 16), '#3A3A3E',
                loc=(lx + 0.2 - i * 0.34, FR(0.8), 0.17), rot=(math.pi / 2, 0, 0), jitter=0.006)
    return h + 0.45, px * 2 + 1.0, 0.3 + 0.03


def fam_finance(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'box', 0.32, plinth=c2)
        for zz in (0.14, h + 0.06):
            slab(soup, 0.78, 0.18, 0.78, c2, (sx, 0, zz), jitter=0.006)
    slab(soup, px * 2 + 1.15, 0.42, 0.6, c1, (0, 0, h + 0.45))
    for i in (-1, 0, 1):                   # 铜钱
        soup.add(C.cyl(0.21, 0.21, 0.07, 14), c2, loc=(i * 0.84, FR(0.32), h + 0.45),
                rot=(math.pi / 2, 0, 0), jitter=0.004)
        slab(soup, 0.11, 0.11, 0.09, c1, (i * 0.84, FR(0.34), h + 0.45), jitter=0.003)
    blob(soup, 0.2, c3, (0, 0, h + 0.86), (1.5, 1, 0.7), rough=0.55)   # 金元宝
    return h + 0.45, px * 2 + 1.0, 0.3 + 0.03


def fam_normal(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        soup.add(C.cyl(0.3, 0.28, h - 0.34, 22), c1, loc=(sx, 0, (h - 0.34) / 2), jitter=0.01)
        blob(soup, 0.31, c2, (sx, 0, h - 0.3), (1, 1, 0.5))            # 卷轴上口
        blob(soup, 0.31, c2, (sx, 0, 0.14), (1, 1, 0.42))
    slab(soup, px * 2 + 1.15, 0.34, 0.52, c1, (0, 0, h + 0.4))         # 摊开的书卷
    for sx in (-px * 0.42, px * 0.42):
        soup.add(C.cyl(0.15, 0.15, 0.38, 18), c2, loc=(sx, 0, h + 0.4), rot=(0, math.pi / 2, 0),
                jitter=0.006)
    soup.add(C.cyl(0.08, 0.1, 0.52, 14), c1, loc=(-px, 0, h + 0.58), jitter=0.008)  # 烛台
    blob(soup, 0.09, '#FFC94E', (-px, 0, h + 0.96), (1, 1, 1.5), emissive='#FFC94E', ei=1.0)
    return h + 0.4, px * 2 + 1.0, 0.26 + 0.03


def fam_folk(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'box', 0.33, plinth=c4, cap=c2)
        for zz in (h * 0.36, h * 0.66):
            slab(soup, 0.74, 0.16, 0.74, c2, (sx, 0, zz), jitter=0.005)   # 彩绘束带
    slab(soup, px * 2 + 1.15, 0.42, 0.6, c1, (0, 0, h + 0.44))
    slab(soup, px * 2 + 0.9, 0.14, 0.64, c2, (0, 0, h + 0.16))
    for i in range(-3, 4):                 # 梁上彩块
        col = [c2, c3, '#5FA05F', '#4E7CA8', c3, c2, '#C0503E'][i + 3]
        slab(soup, 0.26, 0.2, 0.62, col, (i * 0.62, 0, h + 0.44), jitter=0.004)
    blob(soup, 0.42, c3, (0, FR(0.2), h + 0.88), (1.2, 1, 0.75))
    ring(soup, 0.26, 0.06, c2, (0, FR(0.2), h + 1.06), (math.pi / 2, 0, 0))
    return h + 0.44, px * 2 + 1.0, 0.3 + 0.03


def fam_tcm(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        soup.add(C.cyl(0.29, 0.26, h, 22), c1, loc=(sx, 0, h / 2), jitter=0.01)
        blob(soup, 0.2, c2, (sx, 0, h + 0.16), (1, 1, 0.9))            # 葫芦药瓶柱头
        blob(soup, 0.27, c2, (sx, 0, h + 0.44), (1, 1, 0.85))
        soup.add(C.cyl(0.05, 0.05, 0.14, 10), c4, loc=(sx, 0, h + 0.62), jitter=0.006)
    slab(soup, px * 2 + 1.15, 0.36, 0.52, c1, (0, 0, h + 0.4))
    slab(soup, px * 2 + 0.7, 0.14, 0.6, c3, (0, 0, h + 0.16))
    blob(soup, 0.3, c2, (0, 0, h - 0.42))                              # 悬挂药葫芦
    blob(soup, 0.2, c2, (0, 0, h - 0.06), (1, 1, 0.8))
    soup.add(C.cyl(0.045, 0.045, 0.34, 10), c4, loc=(0, 0, h + 0.02), jitter=0.006)
    for dx in (-px + 0.72, px - 0.72):                                 # 药圃
        slab(soup, 0.92, 0.18, 0.42, c4, (dx, FR(0.86), 0.09), jitter=0.005)
        for i in (-1, 0, 1):
            blob(soup, 0.12, '#7CC96F', (dx + i * 0.28, FR(0.86), 0.24))
    return h + 0.4, px * 2 + 1.0, 0.26 + 0.03


def fam_art(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        soup.add(C.cyl(0.3, 0.27, h, 18), c1, loc=(sx, 0, h / 2), jitter=0.01)
        blob(soup, 0.32, c2, (sx, 0, h - 0.06), (1, 1, 0.55))
        blob(soup, 0.3, c2, (sx, 0, 0.1), (1, 1, 0.45))
        for k in range(2):                                             # 缠绕花环
            ring(soup, 0.34, 0.05, c3, (sx, 0, h * 0.42 + k * 0.62))
    slab(soup, px * 2 + 1.15, 0.38, 0.54, c1, (0, 0, h + 0.42))
    arc(soup, 0.42, 0.06, c2, (0, FR(0.3), h + 0.72), (math.pi / 2, 0, 0))       # 高音谱号弧
    soup.add(C.cyl(0.07, 0.07, 0.5, 12), c2, loc=(0.42, FR(0.3), h + 0.5), jitter=0.005)
    blob(soup, 0.13, c3, (0.42, FR(0.3), h + 0.24), (1.3, 1, 0.8))
    for dx in (-0.7, -0.2, 0.9):                                       # 飘带
        slab(soup, 0.4, 0.1, 0.06, c3, (dx, FR(0.32), h + 0.9), rot=(0, 0, 0.25), jitter=0.004)
    return h + 0.42, px * 2 + 1.0, 0.27 + 0.03


def fam_sport(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        soup.add(C.cyl(0.3, 0.27, h, 18), c1, loc=(sx, 0, h / 2), jitter=0.01)
        for zz in (h * 0.3, h * 0.62):                                  # 白色束环
            ring(soup, 0.31, 0.06, c2, (sx, 0, zz))
        blob(soup, 0.3, c2, (sx, 0, h + 0.02), (1, 1, 0.5))
    slab(soup, px * 2 + 1.15, 0.4, 0.56, c4, (0, 0, h + 0.44))
    ring(soup, 0.32, 0.08, c3, (0, FR(0.32), h + 0.44), (math.pi / 2, 0, 0))    # 金牌
    soup.add(C.cyl(0.26, 0.26, 0.08, 14), c3, loc=(0, FR(0.34), h + 0.44),
            rot=(math.pi / 2, 0, 0), jitter=0.004)
    blob(soup, 0.3, c1, (px - 1.1, FR(0.2), h + 0.86))                  # 球
    ring(soup, 0.3, 0.05, c2, (px - 1.1, FR(0.2), h + 0.6))
    return h + 0.44, px * 2 + 1.0, 0.28 + 0.03


def fam_medic(soup, s, h, px):
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'box', 0.32, plinth=c4, cap=c2)
        slab(soup, 0.4, 0.4, 0.07, c2, (sx, FR(0.34), h * 0.62), jitter=0.004)   # 柱上红十字
        slab(soup, 0.16, 0.4, 0.09, c1, (sx, FR(0.36), h * 0.62), jitter=0.003)
        slab(soup, 0.4, 0.16, 0.09, c1, (sx, FR(0.36), h * 0.62), jitter=0.003)
    slab(soup, px * 2 + 1.15, 0.44, 0.6, c1, (0, 0, h + 0.45))
    slab(soup, 0.7, 0.22, 0.68, c2, (0, 0, h + 0.45), jitter=0.004)             # 梁上大红十字
    slab(soup, 0.22, 0.7, 0.68, c2, (0, 0, h + 0.45), jitter=0.004)
    slab(soup, px * 2 + 0.66, 0.16, 0.62, c3, (0, 0, h + 0.18))
    return h + 0.45, px * 2 + 1.0, 0.3 + 0.03


# ---------------------------------------------------------------- 招牌门模板

def tpl_modern(soup, s, h, px, rnd):
    c1, c2, c3, c4 = s['colors']
    v = int(rnd() * 3)
    for sx in (-px, px):
        pillar(soup, sx, h, c1, 'box', 0.38, plinth=c4, cap=c3)
        slab(soup, 0.84, 0.34, 0.72, c2, (sx, 0, h - 0.7), jitter=0.006)
    slab(soup, px * 2 + 1.25, 0.52, 0.64, c1, (0, 0, h + 0.44))
    slab(soup, px * 2 + 0.7, 0.32, 0.7, c2, (0, 0, h + 0.1))
    if v == 1:                                   # 中央门楼块
        slab(soup, 1.95, 1.05, 0.74, c1, (0, 0, h + 1.24))
        slab(soup, 2.3, 0.22, 0.86, c3, (0, 0, h + 1.84))
    elif v == 2:                                 # 双梁
        slab(soup, px * 2 + 0.85, 0.32, 0.58, c2, (0, 0, h + 0.88))
        slab(soup, px * 2, 0.2, 0.52, c3, (0, 0, h + 1.14))
    else:
        for dx in (-1.1, 1.1):
            slab(soup, 0.54, 0.26, 0.64, c3, (dx, 0, h + 0.84), jitter=0.006)
    return h + 0.44, px * 2 + 1.1, 0.32 + 0.03


# ---------------------------------------------------------------- 补齐的风格族
# 这 10 族原先没实现（80 座校门被跳过、运行时回退程序化）。补写原则：
# 元素与尺寸照 js/uni-gate-models.js 的 FAMILY 逐条对齐（造型语言已在游戏里被接受），
# 只把方角换成倒角、把薄片加厚一点点——即"粘土手办风"这一层。
# 用 js 语义的助手写（x 右 / y 高 / z 前），抄 js 的数值时不用心算轴，最不容易出错。

def ball(soup, r, color, x, y, z, scale=(1, 1, 1), rough=0.95, emissive=None, ei=0.6,
         jitter=0.01, bevel=0):
    """js 的 sph(g, r, c, x, y, z, sx, sy, sz)。"""
    seg, ring = (10, 6) if r < 0.15 else ((16, 10) if r < 0.32 else (20, 12))
    soup.add(C.sphere(r, seg, ring), color, loc=at(x, y, z),
             scale=(scale[0], scale[2], scale[1]), bevel=bevel, rough=rough,
             emissive=emissive, ei=ei, jitter=jitter)


def cy(soup, rb, rt, h, color, x, y, z, rot=(0, 0, 0), seg=14, rough=0.93, jitter=0.01,
       emissive=None, ei=0.6):
    """js 的 cyl(g, rt, rb, h, c, x, y, z, …)：竖直圆柱，中心在 (x,y,z)。"""
    soup.add(C.cyl(rb, rt, h, seg), color, loc=at(x, y, z), rot=rot, rough=rough,
             jitter=jitter, emissive=emissive, ei=ei)


def bx(soup, w, h, d, color, x, y, z, rot=(0, 0, 0), rough=0.93, jitter=0.008, **kw):
    """js 的 box(g, w, h, d, c, x, y, z, …)。"""
    soup.add(C.box(w, d, h), color, loc=at(x, y, z), rot=rot, rough=rough, jitter=jitter, **kw)


def tor_face(soup, R, r, color, x, y, z, rx=0.0, ry=0.0, rz=0.0, **kw):
    """正对观众的圆环（js 的 TorusGeometry 默认朝向）：Blender 里先绕 X 立起 90°。
    本文件里只用到 ry=rz=0 的单轴用法，所以直接把立起角并进 X 分量即可。"""
    soup.add(C.torus_gltf(R, r, int(kw.pop('major', max(12, min(22, int(R * 44))))),
                          kw.pop('minor', max(6, min(10, int(r * 90))))),
             color, loc=at(x, y, z), rot=(math.pi / 2 + rx, -rz, ry),
             jitter=kw.pop('jitter', 0.005), rough=kw.pop('rough', 0.93),
             emissive=kw.pop('emissive', None), ei=kw.pop('ei', 0.6), **kw)


def fam_agri(soup, s, h, px):            # 农业：麦穗梁 + 小风车
    c1, c2, c3, c4 = s['colors']
    wood, gold = '#8A6844', '#E8C86A'
    for sx in (-px, px):
        cy(soup, 0.24, 0.3, h, wood, sx, h / 2, 0, seg=12)
        ball(soup, 0.5, c2, sx, h + 0.3, 0, scale=(1, 0.7, 1))                  # 麦垛顶
    bx(soup, px * 2 + 1.15, 0.36, 0.52, wood, 0, h + 0.42, 0)                   # 梁
    for i in range(-2, 3):                                                      # 麦穗
        cy(soup, 0.03, 0.03, 0.5, gold, i * 0.85, h + 0.82, 0, seg=6, jitter=0.004)
        ball(soup, 0.09, gold, i * 0.85, h + 1.05, 0, scale=(1, 1.6, 1), jitter=0.004)
    wx = px - 1.15                                                              # 小风车
    cy(soup, 0.06, 0.09, 1.5, wood, wx, 0.75, 0.75, seg=8)
    for i in range(4):
        a = math.pi / 2 * i
        bx(soup, 0.5, 0.12, 0.04, '#F5F1E8', wx + math.cos(a) * 0.28, 1.62 + math.sin(a) * 0.28,
           0.78, rot=rot_of(0, 0, a), jitter=0.004)
    ball(soup, 0.09, wood, wx, 1.62, 0.78, jitter=0.004)
    return h + 0.42, px * 2 + 1.0, 0.26 + 0.03


def fam_forest(soup, s, h, px):          # 林业：双树冠柱拱
    c1, c2, c3, c4 = s['colors']
    wood = '#8A6B4A'
    for sx in (-px, px):
        cy(soup, 0.2, 0.26, h, wood, sx, h / 2, 0, seg=12)
        ball(soup, 0.62, c2, sx, h + 0.35, 0)                                   # 树冠
        ball(soup, 0.42, c3, sx + 0.3, h + 0.6, 0.15, jitter=0.008)
    bx(soup, px * 2 + 1.15, 0.34, 0.52, wood, 0, h + 0.4, 0)
    bx(soup, px * 2 + 0.6, 0.14, 0.56, c2, 0, h + 0.18, 0)
    for sx, sz in ((-px + 0.6, 0.7), (px - 0.6, 0.7)):                          # 小蘑菇
        cy(soup, 0.05, 0.06, 0.16, '#F5F1E8', sx, 0.08, sz, seg=8, jitter=0.004)
        ball(soup, 0.1, '#D95555', sx, 0.19, sz, scale=(1, 0.6, 1), jitter=0.004)
    return h + 0.4, px * 2 + 1.0, 0.26 + 0.03


def fam_lang(soup, s, h, px):            # 外语：地球门
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        cy(soup, 0.28, 0.34, h, '#F2EEE6', sx, h / 2, 0, seg=14)
        bx(soup, 0.8, 0.2, 0.8, '#C9BFA9', sx, h + 0.06, 0)                     # 柱头
    bx(soup, px * 2 + 1.15, 0.34, 0.52, '#E4DECF', 0, h + 0.4, 0)
    ball(soup, 0.5, '#4E9EE8', 0, h - 0.55, 0.15)                               # 地球仪
    soup.add(C.torus_gltf(0.56, 0.045, 20, 8), '#E8C86A', loc=at(0, h - 0.55, 0.15),
             rot=(0, 0.42, 0), jitter=0.004)                                    # 赤道环
    ball(soup, 0.16, c2, 0.18, h - 0.4, 0.45, scale=(1.3, 0.7, 1), jitter=0.006)  # 陆块
    ball(soup, 0.13, c2, -0.22, h - 0.72, 0.4, scale=(1.2, 0.6, 1), jitter=0.006)
    return h + 0.4, px * 2 + 1.0, 0.26 + 0.03


def fam_post(soup, s, h, px):            # 邮电：信号塔 + 电波环
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        bx(soup, 0.6, h, 0.6, c1, sx, h / 2, 0)
        bx(soup, 0.74, 0.24, 0.74, c2, sx, h + 0.08, 0)
    bx(soup, px * 2 + 1.15, 0.4, 0.56, c2, 0, h + 0.45, 0)
    for i in range(-2, 3):                                                      # 梁上摩斯码
        bx(soup, 0.26, 0.2, 0.64, c3, i * 0.85, h + 0.45, 0.02, jitter=0.004)
    tx = px - 1.15                                                              # 信号塔
    cy(soup, 0.06, 0.11, 3.6, '#8A8378', tx, 1.8, 0.75, seg=8)
    cy(soup, 0.16, 0.16, 0.1, '#4ED0C8', tx, 3.7, 0.75, seg=10, emissive='#4ED0C8', ei=0.9)
    for i in range(2):                                                          # 电波（正对观众，向上张开）
        arc(soup, 0.3 + i * 0.28, 0.045, '#4ED0C8', (tx, FR(0.75), 3.7 + 0.02 * i),
            (math.pi / 2, 0, 0), rough=0.6, emissive='#4ED0C8', ei=0.9)
    return h + 0.45, px * 2 + 1.0, 0.29 + 0.03


def fam_law(soup, s, h, px):             # 政法：天平
    c1, c2, c3, c4 = s['colors']
    gold = '#C9A43A'
    for sx in (-px, px):
        bx(soup, 0.56, h, 0.56, '#E4DECF', sx, h / 2, 0)
        bx(soup, 0.7, 0.2, 0.7, '#8A8378', sx, h + 0.07, 0)
    bx(soup, px * 2 + 1.15, 0.4, 0.56, '#D8D2C4', 0, h + 0.45, 0)
    cy(soup, 0.05, 0.05, 0.9, gold, 0, h - 0.2, 0.1, seg=8)
    bx(soup, 1.5, 0.07, 0.07, gold, 0, h + 0.22, 0.1)                           # 横杆
    for sx in (-0.72, 0.72):
        bx(soup, 0.03, 0.34, 0.03, gold, sx, h + 0.05, 0.1)
        cy(soup, 0.2, 0.2, 0.05, gold, sx, h - 0.12, 0.1, rot=(math.pi / 2, 0, 0), seg=14)
    ball(soup, 0.1, gold, 0, h + 0.34, 0.1, jitter=0.005)
    return h + 0.45, px * 2 + 1.0, 0.29 + 0.03


def fam_ocean(soup, s, h, px):           # 海洋：右柱即灯塔 + 鲸尾拍浪
    c1, c2, c3, c4 = s['colors']
    cy(soup, 0.34, 0.42, h, '#FFFDF4', px, h / 2, 0, seg=14)                     # 灯塔柱
    cy(soup, 0.44, 0.44, 0.3, '#D95555', px, h * 0.42, 0, seg=14)
    cy(soup, 0.4, 0.4, 0.3, '#D95555', px, h * 0.72, 0, seg=14)
    ball(soup, 0.3, '#FFE24E', px, h + 0.2, 0, emissive='#FFE24E', ei=0.8)
    cone_at(soup, 0.36, 0.35, '#D95555', px, h + 0.55, 0, seg=12)
    bx(soup, 0.6, h, 0.6, '#E4DECF', -px, h / 2, 0)
    bx(soup, 0.74, 0.26, 0.74, '#1E5F8C', -px, h + 0.08, 0)
    bx(soup, px * 2 + 1.15, 0.4, 0.56, '#1E5F8C', 0, h + 0.45, 0)
    bx(soup, px * 2 + 0.4, 0.18, 0.6, '#BFE3F0', 0, h + 0.16, 0)
    wx = -px + 1.3                                                              # 鲸尾
    soup.add(C.torus_gltf(0.55, 0.14, 18, 8), '#6FB8E8', loc=at(wx, 0.12, 0.85),
             jitter=0.005)                                                       # 尾浪圈
    bx(soup, 0.12, 0.75, 0.3, '#3E5C8C', wx, 0.5, 0.85, rot=rot_of(0, 0, 0.25))
    bx(soup, 0.5, 0.1, 0.34, '#3E5C8C', wx - 0.24, 0.92, 0.85, rot=rot_of(0, 0, -0.6))
    bx(soup, 0.5, 0.1, 0.34, '#3E5C8C', wx + 0.26, 0.92, 0.85, rot=rot_of(0, 0, 0.6))
    return h + 0.45, px * 2 + 1.0, 0.29 + 0.03


def fam_hydro(soup, s, h, px):           # 水利：坝顶梁 + 水轮
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        bx(soup, 0.66, h, 0.66, '#B9BEB4', sx, h / 2, 0)
        bx(soup, 0.8, 0.22, 0.8, '#8A9188', sx, h + 0.08, 0)
    bx(soup, px * 2 + 1.15, 0.46, 0.6, '#9AA19A', 0, h + 0.45, 0)               # 坝顶
    bx(soup, px * 2 + 0.5, 0.16, 0.66, '#4E9EE8', 0, h + 0.16, 0.02)
    wx = -px + 1.2                                                              # 水轮
    # 轮心抬到 0.73：环外径 0.71，压到 0.62 会沉到地面下 0.09（js 那边这个环因为 torus 的
    # arc 传成 0 其实不渲染，所以没有这个问题；我们既然画出来了就得让它离地）
    tor_face(soup, 0.6, 0.11, '#8A6844', wx, 0.73, 0.85)
    for i in range(4):
        bx(soup, 0.1, 1.1, 0.1, '#8A6844', wx, 0.73, 0.85, rot=rot_of(0, 0, math.pi / 2 * i),
           jitter=0.005)
    bx(soup, 1.6, 0.24, 0.6, '#6FB8E8', wx, 0.12, 0.85, rough=0.5)              # 水面
    return h + 0.45, px * 2 + 1.0, 0.29 + 0.03


def fam_petro(soup, s, h, px):           # 石油矿业：井架 + 岩层底座
    c1, c2, c3, c4 = s['colors']
    steel = '#5A6270'
    for sx in (-px, px):
        bx(soup, 0.5, h, 0.5, '#6B7280', sx, h / 2, 0)
        bx(soup, 0.4, 0.4, 0.06, '#E8C86A', sx, h * 0.55, 0.27, jitter=0.004)
    bx(soup, px * 2 + 1.15, 0.4, 0.56, steel, 0, h + 0.45, 0)
    bx(soup, px * 2 + 0.5, 0.14, 0.6, '#E8C86A', 0, h + 0.18, 0)
    dx = px - 1.2                                                               # 井架
    for dz in (-0.22, 0.22):
        cy(soup, 0.04, 0.06, 2.6, steel, dx - 0.3, 1.3, 0.75 + dz, rot=rot_of(0, 0, 0.14), seg=6)
        cy(soup, 0.04, 0.06, 2.6, steel, dx + 0.3, 1.3, 0.75 + dz, rot=rot_of(0, 0, -0.14), seg=6)
    bx(soup, 0.5, 0.3, 0.4, '#4A5260', dx, 2.7, 0.75)
    ball(soup, 0.14, '#2A2A2A', dx, 2.98, 0.75, jitter=0.005)
    bx(soup, 0.8, 0.2, 0.5, '#8A6844', dx, 0.1, 0.75)                           # 岩层
    return h + 0.45, px * 2 + 1.0, 0.29 + 0.03


def fam_power(soup, s, h, px):           # 电力：输电塔柱 + 闪电
    c1, c2, c3, c4 = s['colors']
    steel = '#6B7280'
    for sx in (-px, px):
        bx(soup, 0.18, h, 0.18, steel, sx - 0.22, h / 2, 0, rot=rot_of(0, 0, 0.07))
        bx(soup, 0.18, h, 0.18, steel, sx + 0.22, h / 2, 0, rot=rot_of(0, 0, -0.07))
        bx(soup, 1.0, 0.14, 0.32, steel, sx, h - 0.25, 0)                       # 横担
        for ddx in (-0.4, 0.4):
            ball(soup, 0.07, '#BFE3FF', sx + ddx, h - 0.4, 0, jitter=0.004)
    bx(soup, px * 2 + 1.15, 0.36, 0.52, '#4E5A66', 0, h + 0.42, 0)
    for dx2, a in ((-0.5, 0.5), (0.0, -0.5), (0.38, 0.5)):       # 闪电折线
        bx(soup, 0.5, 0.16, 0.08, '#FFE24E', dx2, h + 0.42, 0.3, rot=rot_of(0, 0, a),
           emissive='#FFE24E', ei=0.9, jitter=0.003)
    return h + 0.42, px * 2 + 1.0, 0.29 + 0.03


def fam_media(soup, s, h, px):           # 传媒：摄像机 + 声波
    c1, c2, c3, c4 = s['colors']
    for sx in (-px, px):
        bx(soup, 0.58, h, 0.58, '#4A5560', sx, h / 2, 0)
        bx(soup, 0.72, 0.2, 0.72, '#2E3844', sx, h + 0.07, 0)
    bx(soup, px * 2 + 1.15, 0.38, 0.56, '#2E3844', 0, h + 0.45, 0)
    for i in range(3):                                                          # 声波
        tor_face(soup, 0.18 + i * 0.16, 0.04, '#4ED0C8', -0.4 + i * 0.55, h + 0.45, 0.3,
                 emissive='#4ED0C8', ei=0.85, jitter=0.003)
    cx = px - 1.15                                                              # 摄像机
    for ddx, ddz in ((-0.25, 0.15), (0.25, 0.15), (0, -0.28)):
        cy(soup, 0.03, 0.03, 0.9, '#3A4450', cx + ddx * 0.5, 0.45, 0.85 + ddz * 0.5,
           rot=rot_of(0, 0, 0.3), seg=6, jitter=0.004)
    bx(soup, 0.7, 0.44, 0.5, '#2E3844', cx, 1.12, 0.85)
    cy(soup, 0.1, 0.13, 0.35, '#1E2630', cx + 0.48, 1.1, 0.85, rot=rot_of(0, math.pi / 2, 0), seg=10)
    for ddx in (-0.18, 0.18):
        cy(soup, 0.14, 0.14, 0.06, '#8A9188', cx + ddx, 1.42, 0.85, seg=12)
    return h + 0.45, px * 2 + 1.0, 0.29 + 0.03


# ---------------------------------------------------------------- 招牌门模板
# 50 座招牌门（SIGNATURE 里有专属造型的学校）原先只实现了 modern 一款，其余 28 座
# 一直走程序化回退。这里按 js/uni-gate-models.js 的 TPL 逐条移植：造型与尺寸照抄，
# 颜色仍由规格给（specs.mjs 从 SIGNATURE 取真实配色），只加倒角与手捏微扰。
# 返回 (beamY, beamW, fz)，与 js 同义——运行时用它贴校徽匾。

STONE = '#B9B2A2'


def tpl_erxiao(soup, s, h, px, rnd):     # 清华二校门：白古典拱门（一大两小门洞 + 顶球）
    c1, c2, c3, c4 = s['colors']
    for sx in (-1.55, 1.55):
        bx(soup, 0.6, 2.6, 0.6, c1, sx, 1.3, 0)
        bx(soup, 0.78, 0.22, 0.78, c2, sx, 2.7, 0)
    tor_face(soup, 1.55, 0.3, c1, 0, 2.62, 0)                                   # 大拱
    bx(soup, 2.6, 0.55, 0.55, c1, 0, 4.05, 0)
    bx(soup, 3.3, 0.2, 0.66, c2, 0, 4.42, 0)
    for dx, dy in ((-1.4, 4.6), (0, 4.72), (1.4, 4.6)):
        ball(soup, 0.13, c1, dx, dy, 0, jitter=0.005)
    for sx in (-2.55, 2.55):                                                    # 两侧矮翼墙
        bx(soup, 0.9, 1.5, 0.5, c1, sx, 0.75, 0)
        tor_face(soup, 0.42, 0.16, c1, sx, 1.45, 0.02)
        ball(soup, 0.1, STONE, sx, 1.58, 0, jitter=0.004)
    bx(soup, 3.4, 0.08, 1.6, STONE, 0, 0.04, 0.3)                               # 门内石路
    return 3.62, 2.9, 0.29


def tpl_pku(soup, s, h, px, rnd):        # 北大西门：朱红牌楼（四柱 + 绿斗拱 + 灰庑殿顶）
    c1, c2, c3, c4 = s['colors']
    for sx in (-2.1, -0.95, 0.95, 2.1):
        cy(soup, 0.24, 0.28, 3.1, c1, sx, 1.55, 0, seg=10)
        bx(soup, 0.66, 0.18, 0.66, c2, sx, 3.2, 0)                              # 斗拱托
        bx(soup, 0.5, 0.16, 0.6, c3, sx, 2.62, 0.02)                            # 红枋金饰
    bx(soup, 5.4, 0.2, 0.7, c2, 0, 3.42, 0)
    bx(soup, 5.8, 0.24, 1.1, '#5B7280', 0, 3.66, 0)                             # 灰顶
    bx(soup, 4.6, 0.26, 0.9, '#6B8090', 0, 3.94, -0.04)
    bx(soup, 2.2, 0.14, 0.5, '#5B7280', 0, 4.16, -0.06)                         # 正脊
    bx(soup, 3.2, 0.08, 1.4, STONE, 0, 0.04, 0.2)
    return 2.9, 3.2, 0.32


def tpl_pailou(soup, s, h, px, rnd):     # 石牌坊：四柱三层（武大/中山/曲阜）
    c1, c2, c3, c4 = s['colors']
    for sx in (-2.05, -1.025, 1.025, 2.05):
        bx(soup, 0.44, 3.2, 0.44, c1, sx, 1.6, 0)
        cy(soup, 0.36, 0.42, 0.28, STONE, sx, 0.14, 0, seg=10)                  # 柱础鼓
    bx(soup, 5.2, 0.24, 0.5, c2, 0, 2.55, 0)                                    # 下枋
    bx(soup, 5.0, 0.24, 0.5, c1, 0, 3.05, 0)                                    # 中枋
    bx(soup, 5.4, 0.26, 0.6, c2, 0, 3.5, 0)                                     # 上枋
    bx(soup, 5.8, 0.2, 0.8, c3, 0, 3.74, -0.02)                                 # 顶檐
    bx(soup, 4.4, 0.16, 0.6, c3, 0, 3.98, -0.04)
    for sx in (-2.05, 2.05):
        ball(soup, 0.1, c3, sx, 4.14, -0.04, jitter=0.004)
    return 3.05, 4.4, 0.26


def tpl_soviet(soup, s, h, px, rnd):     # 苏式主楼门（哈工大/大连理工）：中央塔楼 + 尖塔
    c1, c2, c3, c4 = s['colors']
    for sx in (-2.2, 2.2):
        bx(soup, 0.9, 2.7, 0.8, c1, sx, 1.35, 0)
        bx(soup, 1.1, 0.24, 1.0, c2, sx, 2.78, 0)
        bx(soup, 0.2, 2.2, 0.08, c2, sx - 0.24, 1.3, 0.42)                      # 壁柱条纹
        bx(soup, 0.2, 2.2, 0.08, c2, sx + 0.24, 1.3, 0.42)
    bx(soup, 3.3, 2.9, 0.9, c1, 0, 1.45, -0.5)                                  # 中央主楼体
    bx(soup, 2.5, 1.1, 0.8, c1, 0, 3.4, -0.5)                                   # 二层收进
    bx(soup, 1.6, 0.9, 0.7, c2, 0, 4.35, -0.5)                                  # 三层
    cone_at(soup, 0.34, 1.1, c2, 0, 5.3, -0.5, seg=4)
    ball(soup, 0.12, c3, 0, 5.95, -0.5, jitter=0.004)                           # 塔尖红星
    for i in (-1, 0, 1):
        bx(soup, 0.18, 0.6, 0.06, '#F5F1E8', i * 0.9, 0.9, 0.42, jitter=0.004)
    return 2.6, 3.0, 0.44


def tpl_minguo(soup, s, h, px, rnd):     # 民国砖拱门（南大/重大/台大…）：厚砖柱 + 半圆拱
    c1, c2, c3, c4 = s['colors']
    for sx in (-1.85, 1.85):
        bx(soup, 0.78, 3.1, 0.7, c1, sx, 1.55, 0)
        bx(soup, 0.94, 0.2, 0.84, c2, sx, 3.16, 0)
    tor_face(soup, 1.46, 0.28, c1, 0, 3.1, 0)
    bx(soup, 2.9, 0.62, 0.6, c1, 0, 4.15, 0)                                    # 拱上砖墙
    bx(soup, 3.3, 0.18, 0.72, c2, 0, 4.55, 0)                                   # 压顶
    bx(soup, 1.2, 0.3, 0.66, c3, 0, 4.3, 0.03)                                  # 匾额底衬
    for sx in (-2.6, 2.6):                                                      # 侧门柱灯
        bx(soup, 0.3, 0.9, 0.3, c1, sx, 0.45, 0.2)
        ball(soup, 0.12, '#FFE2A8', sx, 0.98, 0.2, emissive='#FFE2A8', ei=0.7)
    bx(soup, 3.6, 0.08, 1.4, STONE, 0, 0.04, 0.3)
    return 4.32, 2.9, 0.34


def tpl_jiageng(soup, s, h, px, rnd):    # 嘉庚燕尾脊门（厦大/华侨大学）
    c1, c2, c3, c4 = s['colors']
    bx(soup, 5.4, 0.5, 0.9, c2, 0, 0.25, 0)                                     # 石砌基座
    for sx in (-1.9, 1.9):
        bx(soup, 0.6, 2.5, 0.6, c1, sx, 1.75, 0)
        bx(soup, 0.66, 0.3, 0.66, '#F5F1E8', sx, 2.2, 0)                        # 砖柱白石带
        bx(soup, 0.66, 0.3, 0.66, '#F5F1E8', sx, 1.4, 0)
    bx(soup, 4.7, 0.5, 0.7, c2, 0, 3.2, 0)                                      # 白墙檐带
    for dx, d in ((-1.55, -1), (1.55, 1)):                                      # 坡屋面 + 燕尾翘角
        bx(soup, 2.5, 0.16, 1.1, c2, dx, 3.72, -0.05, rot=rot_of(0, 0, d * 0.32))
        cone_at(soup, 0.14, 0.55, c2, dx + d * 1.35, 4.05, -0.05, seg=4,
                rot=rot_of(0, 0, d * -0.5))
    bx(soup, 1.6, 0.2, 0.9, c1, 0, 3.9, -0.05)                                  # 中脊
    bx(soup, 3.2, 0.08, 1.4, STONE, 0, 0.04, 0.3)
    return 3.28, 3.4, 0.36


def tpl_roof(soup, s, h, px, rnd):       # 中式屋顶门（复旦老校门）：白墙红柱 + 灰瓦双坡顶
    c1, c2, c3, c4 = s['colors']
    bx(soup, 5.2, 0.4, 0.8, c1, 0, 0.2, 0)
    for sx in (-1.95, 1.95):
        cy(soup, 0.24, 0.28, 2.7, c3, sx, 1.75, 0, seg=10)
    bx(soup, 3.5, 1.0, 0.3, c1, 0, 2.35, -0.1)                                  # 门楣墙
    bx(soup, 4.5, 0.2, 0.9, '#6B7280', 0, 3.2, 0)                               # 檐口
    bx(soup, 3.6, 0.2, 1.2, c2, -1.9, 3.55, -0.1, rot=rot_of(0, 0, 0.34))       # 左坡
    bx(soup, 3.6, 0.2, 1.2, c2, 1.9, 3.55, -0.1, rot=rot_of(0, 0, -0.34))       # 右坡
    bx(soup, 1.0, 0.22, 0.7, '#5B6470', 0, 4.18, -0.1)                          # 正脊
    for sx in (-3.35, 3.35):                                                    # 戗角
        bx(soup, 0.5, 0.14, 0.6, c2, sx, 3.36, -0.1, rot=rot_of(0, 0, -0.5 if sx > 0 else 0.5),
           jitter=0.005)
    return 2.62, 3.2, 0.18


def tpl_garden(soup, s, h, px, rnd):     # 园林月亮门（苏大/扬大）：白墙 + 圆洞门 + 花窗 + 黛瓦
    c1, c2, c3, c4 = s['colors']
    R = 1.42
    for sx in (-(R + 1.15), R + 1.15):
        bx(soup, 2.3, 2.55, 0.26, c1, sx, 1.275, 0)
        bx(soup, 2.5, 0.16, 0.4, c2, sx, 2.62, 0)                               # 黛瓦墙帽
    # 圆洞门环：js 把环心放在 R+0.1，环外径 R+0.24 → 下半圈埋进地面 0.14（js 就是这么画的）。
    # 这里抬到 R+0.24，让环正好落在地面上——观感更"立得住"，也让"校门不得穿地"这条审计
    # 保持严格（容差只有 0.06）
    tor_face(soup, R, 0.24, c1, 0, R + 0.24, 0)                                 # 月洞门环
    bx(soup, R * 2 + 0.5, 0.8, 0.26, c1, 0, 3.3, 0)                             # 环上墙
    bx(soup, R * 2 + 0.9, 0.16, 0.4, c2, 0, 3.78, 0)
    for dx in (-(R + 1.15) - 0.55, -(R + 1.15) + 0.55, R + 1.15 - 0.55):        # 花窗
        bx(soup, 0.5, 0.05, 0.08, c2, dx, 1.7, 0.14, jitter=0.003)
        bx(soup, 0.05, 0.5, 0.08, c2, dx, 1.7, 0.14, jitter=0.003)
        bx(soup, 0.66, 0.66, 0.06, c3, dx, 1.7, 0.1, jitter=0.003)
    bx(soup, 4.4, 0.08, 1.2, '#C9C2B2', 0, 0.04, 0.1)
    return 3.55, 2.3, 0.15


def tpl_tibetan(soup, s, h, px, rnd):    # 藏式门（西藏大学）：梯形白墙 + 红黑窗帏 + 金顶
    c1, c2, c3, c4 = s['colors']
    for sx in (-1.7, 1.7):
        cy(soup, 0.5, 0.78, 2.9, c1, sx, 1.45, 0, rot=rot_of(0, math.pi / 4, 0), seg=4)
        bx(soup, 0.62, 0.8, 0.12, c2, sx, 2.2, 0.42)                            # 红窗帏
        bx(soup, 0.4, 0.55, 0.1, '#2A2A2A', sx, 2.2, 0.47)                      # 黑框窗
    bx(soup, 4.0, 0.5, 0.5, c1, 0, 3.0, 0)
    bx(soup, 4.4, 0.22, 0.9, c2, 0, 3.32, 0)                                    # 红饰带
    bx(soup, 4.8, 0.16, 1.1, c3, 0, 3.55, -0.02)                                # 金顶
    bx(soup, 3.4, 0.18, 0.7, c3, 0, 3.78, -0.06)
    bx(soup, 3.0, 0.08, 1.2, '#B9A28A', 0, 0.04, 0.3)
    return 3.1, 2.8, 0.5


def tpl_dunhuang(soup, s, h, px, rnd):   # 敦煌门：沙色拱门 + 石宝瓶柱
    c1, c2, c3, c4 = s['colors']
    for sx in (-1.8, 1.8):
        cy(soup, 0.34, 0.44, 2.9, c1, sx, 1.45, 0, seg=12)
        ball(soup, 0.2, c2, sx, 3.02, 0, jitter=0.005)                          # 宝瓶柱头
    tor_face(soup, 1.44, 0.26, c2, 0, 2.95, 0)
    bx(soup, 3.2, 0.7, 0.5, c1, 0, 3.9, 0)
    bx(soup, 3.6, 0.18, 0.66, c3, 0, 4.32, 0)
    for i in range(-2, 3):                                                      # 檐上金珠
        ball(soup, 0.09, c3, i * 0.75, 4.5, 0, jitter=0.004)
    return 4.1, 3.0, 0.28


def fam_aero(soup, s, h, px):            # 航空航天：火箭移出正中 + 发射架喷焰
    c1, c2, c3, c4 = s['colors']
    red = '#C24A50'
    for sx in (-px, px):
        bx(soup, 0.6, h, 0.6, '#F5F1E8', sx, h / 2, 0)
        bx(soup, 0.72, 0.3, 0.72, red, sx, h + 0.1, 0)
    bx(soup, px * 2 + 1.15, 0.42, 0.56, red, 0, h + 0.45, 0)
    bx(soup, px * 2 + 0.5, 0.2, 0.62, '#FFFDF4', 0, h + 0.17, 0)
    bx(soup, 0.9, 0.26, 0.62, red, -px + 0.9, h + 0.81, 0)
    bx(soup, 0.9, 0.26, 0.62, red, px - 0.9, h + 0.81, 0)
    rx, rz = px - 1.1, 0.75                                                 # 火箭（门内侧，不挡匾额）
    bx(soup, 1.0, 0.16, 1.0, '#8A8378', rx, 0.08, rz)                       # 发射台
    cy(soup, 0.2, 0.24, 2.0, '#F5F1E8', rx, 1.16, rz, seg=12)               # 箭体
    cone_at(soup, 0.2, 0.55, red, rx, 2.44, rz, seg=12)
    cy(soup, 0.26, 0.26, 0.1, red, rx, 0.28, rz, seg=12)
    for i in range(3):
        a = math.pi * 2 * i / 3 + 0.5
        bx(soup, 0.06, 0.5, 0.32, red, rx + math.cos(a) * 0.22, 0.36, rz + math.sin(a) * 0.22,
           rot=rot_of(0, -a, 0), jitter=0.004)
    # 喷焰：js 把锥心放在 -0.08（锥底埋地 0.28）。这里抬到 0.16，锥尖朝下、刚好落在地面上，
    # 既保留"喷焰"的意思，又让"校门不得穿地"这条审计保持严格
    soup.add(C.cyl(0.14, 0.001, 0.4, 8), '#FF9A3A', loc=at(rx, 0.16, rz),
             rot=(math.pi, 0, 0), emissive='#FF9A3A', ei=0.9, bevel=0, jitter=0.004)
    return h + 0.45, px * 2 + 1.0, 0.29


# 风格族总表：放在所有 fam_* 定义之后（字典在求值时就要拿到函数对象）
TPL = {'modern': tpl_modern, 'erxiao': tpl_erxiao, 'pku': tpl_pku, 'pailou': tpl_pailou,
       'soviet': tpl_soviet, 'minguo': tpl_minguo, 'jiageng': tpl_jiageng, 'roof': tpl_roof,
       'garden': tpl_garden, 'tibetan': tpl_tibetan, 'dunhuang': tpl_dunhuang}
FAM = {'classic': fam_classic, 'chip': fam_chip, 'rail': fam_rail, 'finance': fam_finance,
       'normal': fam_normal, 'folk': fam_folk, 'tcm': fam_tcm, 'art': fam_art,
       'sport': fam_sport, 'medic': fam_medic,
       'agri': fam_agri, 'forest': fam_forest, 'lang': fam_lang, 'post': fam_post,
       'law': fam_law, 'ocean': fam_ocean, 'hydro': fam_hydro, 'petro': fam_petro,
       'power': fam_power, 'media': fam_media, 'aero': fam_aero}


def build_one(spec):
    rnd = C.Rnd(spec['zh'])
    soup = C.Soup(spec['id'])
    h, px = spec['height'], spec['span'] / 2
    kind, sid = spec['style']['kind'], spec['style']['id']
    fn = (TPL if kind == 'tpl' else FAM).get(sid)
    if fn is None:
        return None                          # 该风格族尚未实现 → 运行时回退程序化门
    beam_y, beam_w, fz = fn(soup, spec, h, px, rnd) if kind == 'tpl' else fn(soup, spec, h, px)
    ground(soup, 0.4, 2.4)
    ob = C.build_object(soup, 'gate_' + spec['id'])
    # 注意：不能用 python 内置 hash()——它按进程随机加盐，会让烘焙结果不可复现
    C.bake_ao(ob, seed=int(spec['id'][:4], 16))
    return ob, beam_y, beam_w, fz


def main():
    a = C.parse_args()
    if a.get('nobudget'):
        C.BUDGET['gate'] = None            # 调参用：先量出各族开销，再决定预算
    specs = json.load(open(a['specs'], encoding='utf-8'))['specs']
    limit = int(a.get('limit', 0) or 0)
    if limit:
        specs = specs[:limit]
    out = a['out']
    entries, skipped = {}, []
    for i, spec in enumerate(specs):
        built = build_one(spec)
        if built is None:
            skipped.append(spec['style']['id'])
            continue
        ob, beam_y, beam_w, fz = built
        rel = 'gates/%s.glb' % spec['id']
        path = os.path.join(out, rel.replace('/', os.sep))
        info = C.check_budget('gate', C.stats(ob), rel)
        size = C.export_glb(ob, path)
        entries[spec['id']] = dict(info, file=rel, bytes=size, zh=spec['zh'], city=spec['city'],
                                   style=spec['style']['id'], styleKind=spec['style']['kind'],
                                   beamY=round(beam_y, 3), beamW=round(beam_w, 3), fz=round(fz, 3))
        C.bpy_cleanup(ob)
        print('[gate] %2d/%d %s %s tri=%d %dKB' % (i + 1, len(specs), spec['id'], spec['zh'],
                                                   info['tri'], size // 1024))
    if skipped:
        print('[gate] 未实现风格族（运行时回退程序化）：%s' % sorted(set(skipped)))
    by_style = {}
    for e in entries.values():
        by_style.setdefault(e['style'], []).append(e['tri'])
    print('[gate] 各族三角面 %s' % json.dumps(
        {k: [min(v), round(sum(v) / len(v)), max(v)] for k, v in sorted(by_style.items())}))
    C.write_manifest(a['manifest'], 'gate', C.bpy_version(), entries)
    print('[gate] 完成 %d 个，跳过 %d 个' % (len(entries), len(skipped)))


if __name__ == '__main__':
    import bpy  # noqa: F401  (仅 Blender 内可运行)
    C.reset_scene()
    main()
