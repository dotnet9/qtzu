# -*- coding: utf-8 -*-
"""城市地面烘焙：地形高度场网格 + 城市院墙/垛口 + 岛身岩裙 + 雪峰（美术升级方案 §五 B2）。

规则只有一份：高度场、逐顶点配色、峰值、城墙参数全部来自 scripts/bake/specs/ground.<city>.json
（由 scripts/bake/specs.mjs 调 js/terrain-field.js 算出——与游戏运行时同一份实现）。
本脚本只做几何与风格化：城墙倒角、手捏微不规则、顶点色 AO（接触阴影），
以及把整座城收成**一个 mesh / 一个材质**（形同一个 draw call）。

三条硬约定（违反任何一条都会在游戏里立刻看出来）：
  1) 轴映射一律走 common.at()：js/glTF (x 右, y 高, z 前) → Blender (x, -z, y)。
     历史上"门前空地烘成一堵墙""立柱变成躺板"全是抄错轴。audit-assets.mjs 的 bbox 断言守着这条。
  2) 顶点色是**线性**（glTF COLOR_0 与材质底色相乘）：COLOR_0 = 线性(反照率) × AO，
     材质底色统一白。Color 属性里的 0.49/0.78 是按人眼挑的 sRGB，必须过一次 srgb_f_to_lin，
     否则又烘出一版"发白的地面"（这正是本轮渲染修复要解决的问题）。
  3) 网格必须与游戏的高度场**对齐**：顶点就是 (minX + i*gsz, qy[j][i], minZ + j*gsz)，
     不重新采样、不简化 —— 否则玩家会"脚陷进地/浮空"（scripts/verify-ground-fit.mjs 守这条）。

用法：blender -b -P scripts/bake/ground.py -- --specs <spec.json> --out <dir> --manifest <json>
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

# 地面专用的 AO 参数：默认那套（距离 1.15）是给几厘米的校门零件调的，
# 放在半宽 86 的城上等于没有阴影。这里把半径放到山体/城墙尺度，强度压低、天光占比提高，
# 得到的是"河谷、山脊、墙根自然变暗"的微缩地形读感，而不是一圈黑边。
GROUND_AO = dict(samples=24, distance=6.0, strength=0.62, sky=0.34)
WALL_BEVEL = 0.11        # 城墙/垛口的倒角：粘土手办风"圆润 rims"
JITTER_GROUND = 0.04     # 地形手捏感（绝对单位，米）：0.04 在 1.5m 网格上刚好有"手压过"的起伏，
                         # 又远小于贴地校验容差 0.12；默认那套 0.008 是给厘米级零件的


def rgb_hex(h):
    """'#RRGGBB' → sRGB 0..1 三元组（写 COLOR_0 前会统一转线性）。"""
    h = str(h).lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


# ---------------------------------------------------------------- 累加器

class Lay:
    """顶点 + 面 + 逐顶点 sRGB 颜色的累加器：整座城一个 mesh。

    所有几何都以 **glTF 轴**（x 右 / y 高 / z 前）写好，push 时统一过 C.at()。
    color 传三元组 = 该部件单色；传列表 = 逐顶点（地形与雪峰用）。
    """

    def __init__(self):
        self.v = []
        self.f = []
        self.c = []          # sRGB 0..1，写 COLOR_0 前统一转线性
        self.smooth = []

    def push(self, verts, faces, color, smooth=False, jitter=0.0, seed=None):
        base = len(self.v)
        gv = [C.at(p[0], p[1], p[2]) for p in verts]
        if jitter:
            C.Soup._jitter(gv, jitter, seed if seed is not None else 'ground')
        self.v.extend(gv)
        self.f.extend([[base + i for i in fc] for fc in faces])
        self.smooth.extend([smooth] * len(faces))
        if isinstance(color, (tuple, list)) and color and isinstance(color[0], (int, float)):
            self.c.extend([tuple(color)] * len(verts))
        else:
            self.c.extend([tuple(x) for x in color])

    def linear_colors(self):
        """COLOR_0 用的线性反照率（逐顶点）。"""
        return [(C.srgb_f_to_lin(cc[0]), C.srgb_f_to_lin(cc[1]), C.srgb_f_to_lin(cc[2])) for cc in self.c]


# ---------------------------------------------------------------- 几何小件（glTF 轴）

def box_gltf(w, h, d):
    """站立的方盒：底面在 y=0、中心在 x=z=0（与 js 的 box() 同语义）。"""
    x, z = w / 2, d / 2
    v = [(-x, 0, -z), (x, 0, -z), (x, 0, z), (-x, 0, z),
         (-x, h, -z), (x, h, -z), (x, h, z), (-x, h, z)]
    f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    return v, f


def cone_gltf(r, h, seg, y0, color_fn):
    """圆锥（底面在 y=y0、apex 在 y0+h），逐顶点颜色由 color_fn(y) 给（雪线渐变用）。"""
    apex = (0.0, y0 + h, 0.0)
    ring = [(math.cos(2 * math.pi * i / seg) * r, y0, math.sin(2 * math.pi * i / seg) * r) for i in range(seg)]
    v = [apex] + ring
    f = [[0, 1 + i, 1 + (i + 1) % seg] for i in range(seg)]
    f.append([1 + i for i in range(seg)][::-1])
    col = [color_fn(p[1]) for p in v]
    return v, f, col


def yaw_gltf(verts, yaw, tx, ty, tz):
    """绕竖直轴旋转 + 平移到世界位置（glTF 轴内做，避免与 at() 的轴映射纠缠）。"""
    ca, sa = math.cos(yaw), math.sin(yaw)
    return [(p[0] * ca + p[2] * sa + tx, p[1] + ty, -p[0] * sa + p[2] * ca + tz) for p in verts]


# ---------------------------------------------------------------- 各部件

def terrain(lay, spec):
    """地形高度场网格：顶点与 js/terrain.js 的 getV 完全同规则（同一份 qy / 逐顶点色）。"""
    g, qy, col, cell = spec['grid'], spec['qy'], spec['color'], spec['cellIn']
    nx, nz, gsz, minX, minZ = g['nx'], g['nz'], g['gsz'], g['minX'], g['minZ']
    vid, verts, colors = {}, [], []

    def getv(i, j):
        key = (i, j)
        if key not in vid:
            vid[key] = len(verts)
            verts.append((minX + i * gsz, qy[j][i], minZ + j * gsz))    # glTF 轴：y 是高度
            colors.append(tuple(col[j][i]))
        return vid[key]

    faces = []
    for j in range(nz):
        for i in range(nx):
            if not cell[j][i]:
                continue
            a, b = getv(i, j), getv(i + 1, j)
            c, d = getv(i, j + 1), getv(i + 1, j + 1)
            faces.append([a, c, d])
            faces.append([a, d, b])       # 绕向与 js/terrain.js:41 一致
    lay.push(verts, faces, colors, smooth=False, jitter=JITTER_GROUND, seed=spec['key'])
    return len(verts), len(faces)


def _inside(pts, x, z):
    """射线交叉法判内外（用来决定墙朝哪一侧翻边，与 js 的 ptIn 同一套判定）。"""
    hit = False
    for i in range(len(pts) - 1):
        xi, zi = pts[i]
        xj, zj = pts[i + 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi:
            hit = not hit
    return hit


def _miter_normals(pts):
    """每个顶点处取相邻两段外法线的角平分线（并按夹角放大，保证拐角处墙厚不塌）。"""
    n = len(pts) - 1
    out = []
    for i in range(n):
        pa, pb = pts[(i - 1) % n], pts[(i + 1) % n]
        e0 = (pts[i][0] - pa[0], pts[i][1] - pa[1])
        e1 = (pb[0] - pts[i][0], pb[1] - pts[i][1])
        l0 = math.hypot(*e0) or 1.0
        l1 = math.hypot(*e1) or 1.0
        n0 = (-e0[1] / l0, e0[0] / l0)
        n1 = (-e1[1] / l1, e1[0] / l1)
        mx, mz = n0[0] + n1[0], n0[1] + n1[1]
        ml = math.hypot(mx, mz)
        if ml < 1e-6:
            mx, mz, ml = n0[0], n0[1], 1.0
        mx, mz = mx / ml, mz / ml
        cos_half = mx * n0[0] + mz * n0[1]
        k = 1.0 / max(0.35, abs(cos_half))          # 尖角处限制 miter 长度，避免长刺
        out.append((mx * k, mz * k))
    return out


def wall(lay, spec):
    """城市院墙：沿（简化后的）轮廓走一圈的三幅几何——外壁 / 内壁 / 顶面，顶上再布垛口。"""
    w = spec['wall']
    pts = [tuple(p) for p in w['outline']]
    if len(pts) < 3:
        return 0, 0
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    H, TH, gap = w['H'], w['thick'], w['merlonGap']
    normals = _miter_normals(pts)
    # 外法线朝向：拿第一个顶点试一下，指向多边形外的那一侧才是"外面"（与 js 的 outerSign 同思路）
    sign = 1.0
    p0 = pts[0]
    trial = (p0[0] + normals[0][0] * 2.0, p0[1] + normals[0][1] * 2.0)
    if _inside(pts, trial[0], trial[1]):
        sign = -1.0
    n_before = len(lay.f)
    verts, faces = [], []
    arcs, acc = [0.0], 0.0
    for i in range(len(pts) - 1):
        acc += math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
        arcs.append(acc)
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        na = (normals[i][0] * sign, normals[i][1] * sign)
        nb = (normals[i + 1][0] * sign, normals[i + 1][1] * sign)
        k = len(verts)
        # 外壁（底 → 顶）、内壁、顶面：与 js/world.js:1136-1153 的 buildWallGeometry 同一结构
        verts += [(a[0] + na[0] * TH, 0, a[1] + na[1] * TH), (a[0] + na[0] * TH, H, a[1] + na[1] * TH),
                  (b[0] + nb[0] * TH, 0, b[1] + nb[1] * TH), (b[0] + nb[0] * TH, H, b[1] + nb[1] * TH),
                  (a[0] - na[0] * TH, 0, a[1] - na[1] * TH), (a[0] - na[0] * TH, H, a[1] - na[1] * TH),
                  (b[0] - nb[0] * TH, 0, b[1] - nb[1] * TH), (b[0] - nb[0] * TH, H, b[1] - nb[1] * TH)]
        faces += [[k + 0, k + 2, k + 3, k + 1],          # 外壁
                  [k + 4, k + 5, k + 7, k + 6],          # 内壁（反向）
                  [k + 1, k + 3, k + 7, k + 5],          # 顶面
                  [k + 0, k + 4, k + 6, k + 2]]          # 底封口（防止从纸面下看到空洞）
    lay.push(verts, faces, rgb_hex(w['brick']), smooth=False, jitter=0.02, seed=spec['key'] + 'wall')
    # 垛口：按弧长等距放在墙顶外侧（InstancedMesh 在 Blender 侧就是重复的盒子）
    total = arcs[-1]
    n_m = max(2, int(total / gap))
    mv, mf = [], []
    for m in range(n_m):
        target = (m + 0.5) * gap
        i = min(len(arcs) - 2, max(0, int(target / (total / (len(arcs) - 1)))))
        t = (target - arcs[i]) / max(1e-6, arcs[i + 1] - arcs[i])
        px = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t
        pz = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
        nx = normals[i][0] * sign + (normals[i + 1][0] * sign - normals[i][0] * sign) * t
        nz = normals[i][1] * sign + (normals[i + 1][1] * sign - normals[i][1] * sign) * t
        nl = math.hypot(nx, nz) or 1.0
        nx, nz = nx / nl, nz / nl
        yaw = math.atan2(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) + math.pi / 2
        bv, bf = box_gltf(1.5, 1.1, 1.0)
        base = len(mv)
        mv += yaw_gltf(bv, yaw, px + nx * TH * 0.5, H, pz + nz * TH * 0.5)
        mf += [[base + i for i in fc] for fc in bf]
    lay.push(mv, mf, rgb_hex(w['merlon']), smooth=False, jitter=0.01, seed=spec['key'] + 'merlon')
    return n_before, len(lay.f) - n_before


def skirt(lay, spec):
    """岛身岩裙：沿轮廓垂直下垂并轻微收拢（js/world.js:1290-1306 同一套参数）。"""
    s = spec['skirt']
    pts = [tuple(p) for p in spec['outline']]
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    verts, faces = [], []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        k = len(verts)
        verts += [(a[0], 0, a[1]), (b[0], 0, b[1]),
                  (a[0] * s['tuck'], s['sink'], a[1] * s['tuck']), (b[0] * s['tuck'], s['sink'], b[1] * s['tuck'])]
        faces += [[k, k + 2, k + 1], [k + 1, k + 2, k + 3]]
    lay.push(verts, faces, rgb_hex(s['color']), smooth=False, jitter=0.0)
    return len(verts), len(faces)


def peaks(lay, spec):
    """雪峰：锥体 + 雪线渐变顶点色，与 js/terrain.js:62-71 的色带同一套。"""
    pc = spec['peakColors']
    sr = pc.get('snowRange', [5.2, 6.6])
    rock, snow = pc['rock'], pc['snow']
    n = 0
    for pk in spec['peaks']:
        px, pz = pk['at']
        ph, pr = pk['h'], pk['r']
        base_y = pk['base'] - 0.4                                # js：baseY + ph/2 - 0.4 再减去半个高

        def col_at(y, ph=ph):
            vy = y - base_y
            t = max(0.0, min(1.0, (vy - ph * 0.42) / max(1e-6, ph * 0.62 - ph * 0.42)))
            t = t * t * (3 - 2 * t)
            return tuple(rock[i] + (snow[i] - rock[i]) * t for i in range(3))

        v, f, c = cone_gltf(pr, ph, 6, base_y, col_at)
        lay.push([(p[0] + px, p[1], p[2] + pz) for p in v], f, c, smooth=False, jitter=0.006, seed=spec['key'] + 'peak')
        n += 1
    return n


# ---------------------------------------------------------------- 组装

def build_one(spec):
    lay = Lay()
    terrain(lay, spec)
    wall(lay, spec)
    skirt(lay, spec)
    peaks(lay, spec)
    name = 'ground_' + spec['id']
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in lay.v], [], [list(f) for f in lay.f])
    me.validate(verbose=False)
    me.materials.append(C.clay_material('#FFFFFF', 0.94))
    for poly, smooth in zip(me.polygons, lay.smooth):
        poly.use_smooth = smooth
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    # AO 与反照率相乘写进 COLOR_0（base 已是线性），材质底色留白 —— 见文件头的约定 2
    C.bake_ao(ob, base=lay.linear_colors(), seed=int(spec['id'][:4], 16), **GROUND_AO)
    return ob


def main():
    a = C.parse_args()
    if a.get('nobudget'):
        C.BUDGET['ground'] = None
    specs = json.load(open(a['specs'], encoding='utf-8'))['specs']
    limit = int(a.get('limit', 0) or 0)
    if limit:
        specs = specs[:limit]
    entries = {}
    for i, spec in enumerate(specs):
        ob = build_one(spec)
        rel = 'ground/%s.glb' % spec['id']
        out = os.path.join(a['out'], rel.replace('/', os.sep))
        info = C.check_budget('ground', C.stats(ob), rel)
        size = C.export_glb(ob, out)
        entries[spec['id']] = dict(info, file=rel, bytes=size, city=spec['city'],
                                   key=spec['key'], zh=spec['zh'], radius=spec['radius'])
        C.bpy_cleanup(ob)
        print('[ground] %d/%d %s tri=%d verts=%d %dKB bbox_y=[%s,%s]'
              % (i + 1, len(specs), spec['key'], info['tri'], info['verts'], size // 1024,
                 info['bbox']['y'][0], info['bbox']['y'][1]))
    C.write_manifest(a['manifest'], 'ground', bpy.app.version_string, entries)
    print('[ground] 完成 %d 个' % len(entries))


if __name__ == '__main__':
    import bpy  # noqa: F401
    C.reset_scene()
    main()
