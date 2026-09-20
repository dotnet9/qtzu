# -*- coding: utf-8 -*-
"""城市地标烘焙：按 scripts/bake/specs/landmarks.*.json 生成 12 类地标的粘土手办风 GLB。

规格来源 scripts/bake/specs.mjs；本文件只负责"怎么长"，不负责"是谁"。

契约（运行时依赖，勿改）：
  原点在脚底中心、正面朝 glTF +Z（js/world.js:1415 的 rotation.y = -a + π 假定如此）、
  单位同 js/models → 调用方按 sc 缩放 + 贴地。
  占地半径必须仍在 js/world.js:1395 的 LM_HALF 表内（摆放/碰撞/欢迎牌高度都按它算），
  否则牌子、蛋、玩家会与地标重叠——audit-assets.mjs 会逐类卡这条。
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

at, rot_of = C.at, C.rot_of
blob, slab, ring = C.blob, C.slab, C.ring
box, cyl, sph = C.box, C.cyl, C.sphere


def cube(soup, w, h, d, color, x, y, z, **kw):
    """js 的 box(g, w, h, d, color, x, y, z)：宽/高/深，中心在 (x,y,z)。"""
    soup.add(box(w, d, h), color, loc=at(x, y, z), **kw)     # C.box 要 Blender 轴序 → 传 (w, 深, 高)


def cylinder(soup, rb, rt, h, color, x, y, z, rot=(0, 0, 0), seg=16, **kw):
    """js 的 cyl(g, rt, rb, h, c, x, y, z)：竖直圆柱，中心在 (x,y,z)。"""
    soup.add(cyl(rb, rt, h, seg), color, loc=at(x, y, z), rot=rot, **kw)


def ball(soup, r, color, x, y, z, scale=(1, 1, 1), **kw):
    """js 的 sph(g, r, c, x, y, z, sx, sy, sz)：scale 是 js 顺序 (x, y, z)。"""
    soup.add(sph(r, 20, 12), color, loc=at(x, y, z), scale=(scale[0], scale[2], scale[1]), **kw)


def cone_at(soup, r, h, color, x, y, z, seg=12, **kw):
    soup.add(cyl(0.001, r, h, seg), color, loc=at(x, y, z), **kw)


def palm(soup, x, z, s=1.0):
    """椰子树（照抄 js/models/props-nature.js:132）：三段倾斜树干 + 六片叶 + 椰子。"""
    for dx, y, dz, rt, rb in [[0, 0.31, 0, 0.1, 0.13], [0.1, 0.92, 0.02, 0.085, 0.1],
                              [0.22, 1.5, 0.05, 0.07, 0.085]]:
        cylinder(soup, rb * s, rt * s, 0.66 * s, '#B08D58', x + dx * s, y * s, z + dz * s,
                 rot=rot_of(0, 0, -0.16), seg=10, jitter=0.008)
    tx, ty, tz = x + 0.3 * s, 1.9 * s, z + 0.08 * s
    for i in range(6):
        a = math.pi * 2 * i / 6
        ball(soup, 0.36 * s, '#5CA85C' if i % 2 else '#6FBF73',
             tx + math.cos(a) * 0.3 * s, ty - 0.06 * s, tz + math.sin(a) * 0.3 * s,
             scale=(1.35, 0.1, 0.5), rot=rot_of(0, -a, 0), jitter=0.006)
    ball(soup, 0.13 * s, '#6FBF73', tx, ty + 0.02 * s, tz, jitter=0.006)
    for dx, dz in [[-0.1, 0.13], [0.13, -0.07]]:
        ball(soup, 0.06 * s, '#8A6844', tx + dx * s, ty - 0.12 * s, tz + dz * s, jitter=0.004)


# ---------------------------------------------------------------- 12 类地标
# 尺寸严格照抄 js/world.js:1811-1907 的 cityLandmark()：LM_HALF 就是按这些尺寸定的，
# 放大就会与牌子/蛋/玩家重叠。风格上只做"倒角软化 + 手捏微扰 + 顶点色 AO"。

def lm_gate(soup, s):                      # 城楼：城墙台 + 门洞 + 两层飞檐
    c = s['colors']
    cube(soup, 6, 2.2, 2.4, c[0], 0, 1.1, 0)
    cube(soup, 1.8, 1.5, 0.25, '#4A3626', 0, 0.75, 1.2)
    cube(soup, 7, 0.35, 3, c[1], 0, 2.4, 0)
    cube(soup, 5, 1.5, 2.2, c[2], 0, 3.3, 0)
    cube(soup, 5.8, 0.3, 2.8, '#E8C86A', 0, 4.25, 0)
    cube(soup, 3.6, 0.9, 1.6, c[2], 0, 4.85, 0)
    cube(soup, 4.2, 0.28, 2, '#E8C86A', 0, 5.45, 0)


def lm_tower(soup, s):                     # 球串塔
    c = s['colors']
    cylinder(soup, 0.55, 1, 6.5, c[0], 0, 3.25, 0)
    ball(soup, 1.6, c[1], 0, 4.6, 0, emissive=c[1], ei=0.35)
    cylinder(soup, 0.35, 0.5, 3.4, c[0], 0, 8, 0, seg=12)
    ball(soup, 1.15, c[1], 0, 10.1, 0, emissive=c[1], ei=0.35)
    cylinder(soup, 0.14, 0.14, 1.6, c[0], 0, 11.4, 0, seg=8)
    ball(soup, 0.5, c[1], 0, 12.4, 0, emissive=c[1], ei=0.35)


def lm_wall(soup, s):                      # 长城垛口
    c = s['colors']
    cube(soup, 14, 1.9, 2.2, c[0], 0, 0.95, 0)
    for i in range(-3, 4):
        cube(soup, 0.7, 0.55, 2.2, c[0], i * 2, 2.15, 0)
    cube(soup, 6, 1.6, 2.2, c[0], 4.5, 2.4, 0)
    cube(soup, 4.2, 0.5, 3, '#E8C86A', 0, 3.4, 0)


def lm_panda(soup, s):                     # 大熊猫抱竹子
    white, dark = '#F5F1E8', '#2A2A2A'
    ball(soup, 1.5, white, 0, 1.3, 0)
    ball(soup, 0.95, white, 0, 2.8, 0.25)
    for dx in (-0.52, 0.52):
        ball(soup, 0.28, dark, dx, 3.68, 0.25)
    for dx in (-0.38, 0.38):
        ball(soup, 0.17, dark, dx, 2.96, 1.1, scale=(1, 1.35, 0.55))
    ball(soup, 0.11, dark, 0, 2.7, 1.18)
    for dx in (-1.6, 1.6):
        ball(soup, 0.44, dark, dx, 1.55, 0.25)
    cylinder(soup, 0.09, 0.09, 1.6, '#7CBB5E', 0.95, 1.55, 1.42, seg=8)


def lm_ice(soup, s):                       # 冰雕塔：真透明在多材质合并里排序会闪，用"低粗糙 + 自发光"代替
    ice = '#A8D8FF'
    cone_at(soup, 1.4, 5, ice, 0, 2.5, 0, seg=8, rough=0.22, emissive='#4E9EE8', ei=0.4)
    cone_at(soup, 0.9, 3.6, ice, 1.6, 1.8, 0.5, seg=8, rough=0.22, emissive='#4E9EE8', ei=0.4)
    cone_at(soup, 0.7, 2.6, ice, -1.5, 1.3, 0.4, seg=8, rough=0.22, emissive='#4E9EE8', ei=0.4)
    ball(soup, 0.55, ice, -0.8, 0.55, 1, rough=0.22, emissive='#4E9EE8', ei=0.4)


def lm_palm(soup, s):                      # 椰林海滩
    palm(soup, 0, 0, 1.1)
    palm(soup, 2.2, 0.8, 0.85)
    palm(soup, -2, 0.6, 0.7)
    cylinder(soup, 3.4, 3.4, 0.04, '#EFDCA8', 0, 0.02, 0, seg=24, jitter=0.004)


def lm_dome(soup, s):                      # 圆顶（蒙古包 + 尖）
    c = s['colors']
    cylinder(soup, 2.2, 2.4, 1.4, '#F5F1E8', 0, 0.7, 0)
    ball(soup, 2.2, c[1], 0, 1.4, 0, scale=(1, 0.6, 1), emissive=c[1], ei=0.35)
    cylinder(soup, 0.1, 0.1, 1, '#E8C86A', 0, 2.6, 0, seg=8)
    ball(soup, 0.22, '#E8C86A', 0, 3.15, 0)


def lm_mountain(soup, s):                  # 三峰 + 雪顶
    cone_at(soup, 3, 5.2, '#6FAF6B', -1.6, 2.6, -0.4, seg=9)
    cone_at(soup, 2.2, 7, '#5E9E5E', 1.2, 3.5, 0.3, seg=9)
    cone_at(soup, 0.75, 1.7, '#FFFFFF', 1.2, 5.6, 0.3, seg=9)
    cone_at(soup, 1.5, 3.6, '#7CBF74', 2.9, 1.8, -0.6, seg=9)


def lm_pavilion(soup, s):                  # 四柱攒尖亭
    c = s['colors']
    cylinder(soup, 2.4, 2.6, 0.35, '#C8B898', 0, 0.18, 0, seg=16)
    for px, pz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        cylinder(soup, 0.09, 0.09, 1.7, c[1], px, 1.2, pz, seg=8)
    cone_at(soup, 2.1, 1.1, c[1], 0, 2.55, 0, seg=12)
    ball(soup, 0.18, '#E8C86A', 0, 3.15, 0)
    cube(soup, 1.5, 0.08, 0.3, c[1], 0, 1.9, 1.02)


def lm_grotto(soup, s):                    # 崖壁坐佛
    cube(soup, 4.6, 3.4, 1.2, '#B09A78', 0, 1.7, -0.6)
    ball(soup, 0.75, '#D8C8A8', 0, 2.6, 0.35)
    cylinder(soup, 1.05, 1.25, 1.5, '#D8C8A8', 0, 1.15, 0.35, seg=14)
    ball(soup, 0.3, '#6B5844', 0, 2.75, 0.95, scale=(1, 0.7, 0.5))
    ball(soup, 0.3, '#6B5844', 0, 3.25, -0.2, scale=(1, 0.7, 0.5))


def lm_harbor(soup, s):                    # 灯塔 + 小船（未知类型也走这里，与 js 的 else 兜底一致）
    c = s['colors']
    cylinder(soup, 0.5, 0.65, 3.6, '#F5F1E8', 0, 1.8, 0, seg=14)
    cylinder(soup, 0.62, 0.62, 0.5, '#D95F4B', 0, 0.5, 0, seg=14)
    cylinder(soup, 0.62, 0.62, 0.5, '#D95F4B', 0, 2.8, 0, seg=14)
    ball(soup, 0.34, c[1], 0, 3.75, 0, emissive=c[1], ei=0.35)
    cube(soup, 1.6, 0.3, 0.7, '#B08858', 2.4, 0.15, 1.2)
    cube(soup, 0.9, 0.75, 0.5, '#F5F1E8', 2.4, 0.65, 1.2)


TYPES = {'gate': lm_gate, 'tower': lm_tower, 'wall': lm_wall, 'panda': lm_panda, 'ice': lm_ice,
         'palm': lm_palm, 'dome': lm_dome, 'mountain': lm_mountain, 'pavilion': lm_pavilion,
         'grotto': lm_grotto, 'harbor': lm_harbor}


def build_one(spec):
    fn = TYPES.get(spec['type'])
    used = spec['type'] if fn else 'harbor'
    soup = C.Soup('landmark_' + spec['id'])
    (fn or lm_harbor)(soup, spec)
    ob = C.build_object(soup, 'landmark_' + spec['id'])
    C.bake_ao(ob, seed=int(spec['id'][:4], 16))
    return ob, used


def main():
    import bpy
    a = C.parse_args()
    if a.get('nobudget'):
        C.BUDGET['landmark'] = None
    specs = json.load(open(a['specs'], encoding='utf-8'))['specs']
    limit = int(a.get('limit', 0) or 0)
    if limit:
        specs = specs[:limit]
    entries = {}
    for i, spec in enumerate(specs):
        ob, used = build_one(spec)
        rel = 'landmarks/%s.glb' % spec['id']
        out = os.path.join(a['out'], rel.replace('/', os.sep))
        info = C.check_budget('landmark', C.stats(ob), rel)
        size = C.export_glb(ob, out)
        entries[spec['id']] = dict(info, file=rel, bytes=size, city=spec['city'], idx=spec['i'],
                                   key=f"{spec['city']}#{spec['i']}",
                                   type=spec['type'], used=used, zh=spec['zh'], color=spec['color'])
        C.bpy_cleanup(ob)
        print('[landmark] %2d/%d %s %s#%d %s tri=%d %dKB'
              % (i + 1, len(specs), spec['id'], spec['city'], spec['i'], used, info['tri'], size // 1024))
    C.write_manifest(a['manifest'], 'landmark', bpy.app.version_string, entries)
    print('[landmark] 完成 %d 个' % len(entries))


if __name__ == '__main__':
    import bpy  # noqa: F401
    C.reset_scene()
    main()
