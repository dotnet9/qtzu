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
blob, slab, ring, arc, pillar = C.blob, C.slab, C.ring, C.arc, C.pillar

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


TPL = {'modern': tpl_modern}
FAM = {'classic': fam_classic, 'chip': fam_chip, 'rail': fam_rail, 'finance': fam_finance,
       'normal': fam_normal, 'folk': fam_folk, 'tcm': fam_tcm, 'art': fam_art,
       'sport': fam_sport, 'medic': fam_medic}


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
