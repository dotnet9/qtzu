# -*- coding: utf-8 -*-
"""粘土手办风烘焙公共库：几何基本体 + 倒角软化 + 顶点色 AO + GLB 导出 + 预算断言。

坐标系约定（与 js/ 严格对齐，改了就会浮空/背身/陷地）：
  Blender 为 Z-up、-Y 为正面；导出 yup 后 = glTF/three.js 的 Y-up、+Z 为正面。
  - 原点在脚底中心 (0,0,0)：调用方用 _groundY 贴地
  - 正面朝 glTF +Z：js/game.js:2152 的 rotation.y = atan2(城心-门位) 假定门面朝 +Z
  - 单位与 js/models/* 同（约 1 单位 = 1 格），调用方再整体 scale 0.5

实现要点：
  所有部件的位移/旋转在建 mesh 时就烘进顶点（对象 transform 恒为单位阵），
  因此合并成一个 mesh 不需要 apply transform，法线也不会因非均匀缩放出错。
  每个部件单独跑 bmesh.ops.bevel 做倒角软化，再并入"汤"里；
  汤合成一个 mesh（多材质槽）→ glTF 一个 mesh 多 primitive，
  three.js 侧是一个对象多次 draw call，比原来几十个 Mesh 轻得多。

风格配方（粘土/软塑手办感）见 STYLE_* 常量，改动只应发生在这里。
"""

import bmesh
import bpy
import json
import math
import os
import random
import time
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------- 风格配方

# 倒角宽度占部件最小边长的比例（越大越"软"，手捏感越强）
STYLE_BEVEL_FRAC = 0.22
# 倒角段数：2 段 + 全平滑着色已经没有硬边了，3 段会白吃一倍的三角面
STYLE_BEVEL_SEGMENTS = 2
# 只倒"明显是转折"的边：圆柱侧面的相邻面只有十几度，倒它纯属浪费面数
STYLE_BEVEL_ANGLE = math.radians(30)
# 倒角宽度上下限（世界单位）：小件别被倒角吃掉，大件别倒成球
STYLE_BEVEL_MIN = 0.012
STYLE_BEVEL_MAX = 0.09
# 微不规则位移幅度（占部件尺寸比例）：≤1.5%，只求"手捏"不去形
STYLE_JITTER_FRAC = 0.012
# 顶点色 AO：采样数 / 作用距离 / 强度 / 阴影色温（冷影暖光 = 粘土哑光）
AO_SAMPLES = 20
AO_DISTANCE = 1.15
AO_STRENGTH = 0.9
AO_TINT = (0.58, 0.55, 0.64)
# 天空遮蔽：法线越朝下越暗（模拟天光），0 = 关闭
AO_SKY = 0.16

# 三角面预算（超限即烘焙失败，见 check_budget）
BUDGET = {'gate': 9000, 'pet': 3500, 'landmark': 14000, 'prop': 4000, 'npc': 4000, 'player': 8000}


def srgb_to_lin(c):
    """'#RRGGBB' → Blender/glTF 用的线性 RGB（0..1）。"""
    c = str(c).lstrip('#')
    out = []
    for i in (0, 2, 4):
        v = int(c[i:i + 2], 16) / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


class Rnd:
    """与 js/uni-gate-models.js:714 同族的 LCG，保证同一 id 每次烘焙结果一致。"""

    def __init__(self, seed_str):
        s = 5381
        for ch in str(seed_str):
            s = ((s * 33) ^ ord(ch)) & 0xFFFFFFFF
        self.s = s

    def next(self):
        self.s = (self.s * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.s / 4294967296.0

    # 与 js 的用法同名同义：rnd() 取下一个 [0,1)
    __call__ = next

    def range(self, a, b):
        return a + (b - a) * self.next()


# ---------------------------------------------------------------- 几何基本体
# 每个基本体返回 (verts, faces)；位移/旋转由 Soup.add 烘进顶点。


def _cube_faces():
    return [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def box(w, h, d):
    x, y, z = w / 2, h / 2, d / 2
    v = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z),
         (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    return v, _cube_faces()


def cyl(rb, rt, h, seg=24, cap=True):
    """竖直圆柱（rb 底 / rt 顶）。rt<=0 时退化成圆锥（单顶点收顶，不留零面积面）。"""
    v, f = [], []
    z0, z1 = -h / 2, h / 2
    for i in range(seg):
        a = 2 * math.pi * i / seg
        v.append((math.cos(a) * rb, math.sin(a) * rb, z0))
    if rt <= 1e-6:
        apex = len(v)
        v.append((0, 0, z1))
        for i in range(seg):
            f.append((i, (i + 1) % seg, apex))
    else:
        for i in range(seg):
            a = 2 * math.pi * i / seg
            v.append((math.cos(a) * rt, math.sin(a) * rt, z1))
        for i in range(seg):
            j = (i + 1) % seg
            f.append((i, j, seg + j, seg + i))
        if cap:
            v.append((0, 0, z1)); top = len(v) - 1
            for i in range(seg):
                f.append((seg + i, seg + (i + 1) % seg, top))
    if cap:
        v.append((0, 0, z0)); bot = len(v) - 1
        for i in range(seg):
            f.append(((i + 1) % seg, i, bot))
    return v, f


def sphere(r, seg=24, ring=14):
    v, f = [(0, 0, r)], []
    for j in range(1, ring):
        phi = math.pi * j / ring
        for i in range(seg):
            th = 2 * math.pi * i / seg
            v.append((r * math.sin(phi) * math.cos(th), r * math.sin(phi) * math.sin(th), r * math.cos(phi)))
    v.append((0, 0, -r)); south = len(v) - 1
    for i in range(seg):
        f.append((0, 1 + i, 1 + (i + 1) % seg))
    for j in range(ring - 2):
        b0, b1 = 1 + j * seg, 1 + (j + 1) * seg
        for i in range(seg):
            i2 = (i + 1) % seg
            f.append((b0 + i, b1 + i, b1 + i2, b0 + i2))
    b0 = 1 + (ring - 2) * seg
    for i in range(seg):
        f.append((b0 + i, south, b0 + (i + 1) % seg))
    return v, f


def torus(R, r, major=32, minor=12, arc=2 * math.pi, cap_ends=False):
    """绕 Y 轴的水平圆环；arc < 2π 时为圆弧（拱门/月洞门），cap_ends 封端面。"""
    v, f = [], []
    n = major if arc >= 2 * math.pi - 1e-6 else major + 1
    full = arc >= 2 * math.pi - 1e-6
    for i in range(n):
        a = arc * i / (major if full else major)
        cx, cz = math.cos(a) * R, math.sin(a) * R
        for j in range(minor):
            b = 2 * math.pi * j / minor
            v.append((cx + math.cos(a) * math.cos(b) * r, math.sin(b) * r, cz + math.sin(a) * math.cos(b) * r))
    rings = n if full else n
    for i in range(major if not full else n):
        i2 = (i + 1) % (n if full else n)
        for j in range(minor):
            j2 = (j + 1) % minor
            f.append((i * minor + j, i2 * minor + j, i2 * minor + j2, i * minor + j2))
    if cap_ends and not full:
        for k, base in ((0, 0), (1, (n - 1) * minor)):
            c = Vector((0, 0, 0))
            for j in range(minor):
                c += Vector(v[base + j])
            c /= minor
            v.append(tuple(c)); ci = len(v) - 1
            for j in range(minor):
                j2 = (j + 1) % minor
                if k == 0:
                    f.append((base + j, base + j2, ci))
                else:
                    f.append((base + j2, base + j, ci))
    return v, f


def arch(R, tube, arc=math.pi, major=24, minor=10, rise=0.0):
    """竖直平面内的半圆拱（藏在 XY 平面、沿 Z 竖起来由调用方旋转）。
    rise>0 时把两端往下拉长成"马蹄拱"。"""
    v, f = [], []
    n = major + 1
    for i in range(n):
        a = arc * i / major
        cx, cy = math.cos(a) * R, math.sin(a) * R
        for j in range(minor):
            b = 2 * math.pi * j / minor
            v.append((cx + math.cos(a) * math.cos(b) * tube,
                      cy + math.sin(a) * math.cos(b) * tube,
                      math.sin(b) * tube))
    if rise > 0:
        for i in range(n):
            v[i * minor:(i + 1) * minor] = [(x, y - rise * (1 - math.sin(arc * i / major)), z)
                                            for (x, y, z) in v[i * minor:(i + 1) * minor]]
    for i in range(major):
        i2 = i + 1
        for j in range(minor):
            j2 = (j + 1) % minor
            f.append((i * minor + j, i2 * minor + j, i2 * minor + j2, i * minor + j2))
    for base, flip in ((0, True), (major * minor, False)):
        c = Vector((0, 0, 0))
        for j in range(minor):
            c += Vector(v[base + j])
        c /= minor
        v.append(tuple(c)); ci = len(v) - 1
        for j in range(minor):
            j2 = (j + 1) % minor
            f.append((base + j2, base + j, ci) if flip else (base + j, base + j2, ci))
    return v, f


def capsule(r, h, seg=20, ring=8):
    """胶囊：圆柱 + 两半球顶，粘土柱子的首选（没有硬边）。"""
    v, f = [], []
    body = max(0.0, h / 2)
    for j in range(ring + 1):
        phi = math.pi / 2 * j / ring
        for i in range(seg):
            th = 2 * math.pi * i / seg
            v.append((r * math.sin(phi) * math.cos(th), r * math.sin(phi) * math.sin(th), body + r * math.cos(phi)))
    for j in range(ring + 1):
        phi = math.pi / 2 * j / ring
        for i in range(seg):
            th = 2 * math.pi * i / seg
            v.append((r * math.cos(phi) * math.cos(th), r * math.cos(phi) * math.sin(th), -body - r * math.sin(phi)))
    rings = 2 * (ring + 1)
    for j in range(rings - 1):
        if j == ring:
            continue
        b0, b1 = j * seg, (j + 1) * seg
        for i in range(seg):
            i2 = (i + 1) % seg
            f.append((b0 + i, b1 + i, b1 + i2, b0 + i2))
    return v, f


def torus_gltf(R, r, major=32, minor=12):
    """水平圆环（躺平，绕 glTF Y = Blender Z），用于花环/井盖/冠饰。"""
    v, f = [], []
    for i in range(major):
        a = 2 * math.pi * i / major
        for j in range(minor):
            b = 2 * math.pi * j / minor
            v.append(((R + r * math.cos(b)) * math.cos(a),
                      (R + r * math.cos(b)) * math.sin(a),
                      r * math.sin(b)))
    for i in range(major):
        i2 = (i + 1) % major
        for j in range(minor):
            j2 = (j + 1) % minor
            f.append((i * minor + j, i2 * minor + j, i2 * minor + j2, i * minor + j2))
    return v, f


# ---------------------------------------------------------------- 组装

class Soup:
    """把若干部件（各自倒角软化后）并成一个 mesh 的累加器。"""

    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []
        self.mats = []          # [(name, color, rough, emissive)]
        self.mat_index = {}
        self.parts = []         # [(vert_start, vert_end)] 供 jitter 定位

    def mat(self, color, rough=0.92, emissive=None, ei=0.6, key=None):
        k = key or (color, rough, emissive, ei)
        if k not in self.mat_index:
            self.mat_index[k] = len(self.mats)
            self.mats.append((color, rough, emissive, ei))
        return self.mat_index[k]

    def add(self, geo, color, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1),
            bevel=None, rough=0.92, emissive=None, ei=0.6, jitter=None, jitter_seed=None,
            smooth=True):
        """加一个部件。loc/rot/scale 直接烘进顶点；bevel=None 用风格默认值，0 表示不倒角。"""
        verts, faces = geo
        v = [Vector(p) for p in verts]
        m = (Matrix.Translation(Vector(loc))
             @ Euler(rot, 'XYZ').to_matrix().to_4x4()
             @ Matrix.Diagonal(Vector(scale).to_4d()))
        v = [m @ p for p in v]

        # 倒角软化：小件按比例收缩，大件封顶，保证没有一条硬边
        if bevel is None:
            mn = min((max(p[i] for p in v) - min(p[i] for p in v)) for i in range(3))
            bevel = max(STYLE_BEVEL_MIN, min(STYLE_BEVEL_MAX, mn * STYLE_BEVEL_FRAC)) if mn > 0.06 else 0.0
        if bevel > 1e-5:
            bm = bmesh.new()
            bv = [bm.verts.new(p) for p in v]
            bm.verts.index_update()
            for fc in faces:
                try:
                    bm.faces.new([bv[i] for i in fc])
                except ValueError:
                    pass
            bm.normal_update()
            # bmesh 的 bevel 没有"按角度限制"参数，自己筛：只倒明显转折的边，
            # 圆柱侧面的相邻面只有十几度，倒它纯属浪费面数
            sharp = [e for e in bm.edges
                     if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > STYLE_BEVEL_ANGLE]
            if sharp:
                bmesh.ops.bevel(bm, geom=sharp, offset=bevel,
                                offset_type='OFFSET', segments=STYLE_BEVEL_SEGMENTS, profile=0.5,
                                affect='EDGES', clamp_overlap=True, loop_slide=True)
            bm.verts.index_update()
            v = [Vector(x.co) for x in bm.verts]
            faces = [[x.index for x in fc.verts] for fc in bm.faces]
            bm.free()

        if jitter:
            sd = jitter_seed if jitter_seed is not None else self.name
            self._jitter(v, jitter, sd)

        base = len(self.verts)
        self.verts.extend([tuple(p) for p in v])
        mi = self.mat(color, rough, emissive, ei)
        for fc in faces:
            self.faces.append(([base + i for i in fc], mi, smooth))
        self.parts.append((base, len(self.verts)))

    @staticmethod
    def _jitter(v, amp, seed):
        """确定性三向正弦噪声位移：只求"手捏过"的微不规则，不改整体造型。"""
        r = random.Random(str(seed))
        p1, p2, p3 = (r.random() * 6.28 for _ in range(3))
        k = 2.6 + r.random()
        for i, p in enumerate(v):
            n = (math.sin(k * p[0] + p1) * math.sin(k * 0.9 * p[1] + p2) * math.sin(k * 1.1 * p[2] + p3))
            n -= (math.sin(k * 1.7 * p[0] + p3) * math.sin(k * 1.5 * p[1] + p1) * math.sin(k * 1.3 * p[2] + p2)) * 0.5
            v[i] = Vector((p[0] + n * amp, p[1] + n * amp * 0.9, p[2] + n * amp * 1.1))


def build_object(soup, name):
    """Soup → bpy 对象（多材质槽、全平滑着色、单位 transform）。"""
    me = bpy.data.meshes.new(name)
    me.from_pydata(soup.verts, [], [f[0] for f in soup.faces])
    me.validate(verbose=False)
    for color, rough, emissive, ei in soup.mats:
        me.materials.append(clay_material(color, rough, emissive, ei))
    for poly, (_, mi, smooth) in zip(me.polygons, soup.faces):
        poly.material_index = mi
        poly.use_smooth = smooth
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def clay_material(color, rough=0.92, emissive=None, ei=0.6):
    key = 'clay_%s_%s_%s' % (color, rough, emissive or '-')
    m = bpy.data.materials.get(key)
    if m:
        return m
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*srgb_to_lin(color), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = 0.0
    for nm, val in (('Specular IOR Level', 0.28), ('Sheen Weight', 0.12), ('IOR', 1.42)):
        if nm in bsdf.inputs:
            bsdf.inputs[nm].default_value = val
    if emissive:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*srgb_to_lin(emissive), 1.0)
            bsdf.inputs['Emission Strength'].default_value = ei
    m.diffuse_color = (*srgb_to_lin(color), 1.0)
    return m


# ---------------------------------------------------------------- 顶点色 AO

def bake_ao(ob, samples=AO_SAMPLES, distance=AO_DISTANCE, strength=AO_STRENGTH,
            tint=AO_TINT, sky=AO_SKY, seed=7):
    """逐顶点半球采样烘焙 AO 写进 'Col' 顶点色（POINT/FLOAT_COLOR）。

    glTF 规定 COLOR_0 与 baseColor 相乘，three.js 会自动启用 vertexColors，
    于是零贴图就得到"部件之间互相压暗"的接触阴影——这是精致度的主要来源。
    """
    me = ob.data
    verts = [v.co.copy() for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    bvh = bvh_from(verts, polys)
    normals = [v.normal.copy() for v in me.vertices]

    r = random.Random(seed)
    # 每个顶点一套抖动方向：同一批方向会让 AO 出现规则条纹
    dirs_cache = []
    for _ in range(64):
        u, vv = r.random(), r.random()
        th = 2 * math.pi * u
        z = math.sqrt(1 - vv * 0.92)
        rr = math.sqrt(max(0.0, 1 - z * z))
        dirs_cache.append(Vector((math.cos(th) * rr, math.sin(th) * rr, z)))

    col = me.color_attributes.get('Col')
    if col is None:
        col = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    data = col.data
    eps = 0.004
    inv = 1.0 / distance
    for i, p in enumerate(verts):
        n = normals[i]
        if n.length < 1e-6:
            n = Vector((0, 0, 1))
        n.normalize()
        t = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
        t = (t - n * t.dot(n)).normalized()
        b = n.cross(t)
        occ = 0.0
        base = (i * 7) % 64
        for k in range(samples):
            d = dirs_cache[(base + k * 13) % 64]
            w = t * d.x + b * d.y + n * d.z
            hit = bvh.ray_cast(p + n * eps, w, distance)
            if hit[0] is not None:
                occ += 1.0 - min(1.0, hit[3] * inv) ** 1.5
        occ = min(1.0, occ / samples * strength)
        shade = (1.0 - occ * (1.0 - tint[0]), 1.0 - occ * (1.0 - tint[1]), 1.0 - occ * (1.0 - tint[2]))
        if sky > 0:
            f = 1.0 - sky * (1.0 - max(0.0, n.z))
            shade = (shade[0] * f, shade[1] * f, shade[2] * f)
        data[i].color = (max(0.35, shade[0]), max(0.35, shade[1]), max(0.35, shade[2]), 1.0)
    me.color_attributes.active_color_index = me.color_attributes.find('Col')
    me.update()


def bvh_from(verts, polys):
    from mathutils.bvhtree import BVHTree
    return BVHTree.FromPolygons([tuple(v) for v in verts], [tuple(p) for p in polys], all_triangles=False, epsilon=0.0)


# ---------------------------------------------------------------- 统计 / 导出

def stats(ob):
    me = ob.data
    me.calc_loop_triangles()
    tri = len(me.loop_triangles)
    xs = [v.co for v in me.vertices]
    mn = [min(v[i] for v in xs) for i in range(3)]
    mx = [max(v[i] for v in xs) for i in range(3)]
    # Blender(X,Y,Z) → glTF(X, Z, -Y)
    return {
        'tri': tri,
        'verts': len(me.vertices),
        'bbox': {'x': [round(mn[0], 3), round(mx[0], 3)],
                 'y': [round(mn[2], 3), round(mx[2], 3)],
                 'z': [round(-mx[1], 3), round(-mn[1], 3)]},
    }


def check_budget(kind, info, path):
    cap = BUDGET.get(kind)
    if cap and info['tri'] > cap:
        raise SystemExit('[budget] %s 三角面 %d 超过上限 %d' % (path, info['tri'], cap))
    return info


def export_glb(ob, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_normals=True, export_tangents=False, export_texcoords=False,
        export_materials='EXPORT', export_cameras=False, export_lights=False,
        export_animations=False, export_extras=False, export_skins=False,
        export_draco_mesh_compression_enable=False, export_image_format='NONE',
        export_hierarchy_full_collections=False,
    )
    return os.path.getsize(path)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.meshes, bpy.data.objects, bpy.data.materials):
        for item in list(coll):
            coll.remove(item)
    bpy.context.scene.unit_settings.system = 'METRIC'


def write_manifest(path, kind, blender_ver, entries):
    """每个烘焙器写一份 <kind>.manifest.json，再由 run.mjs 合并成 manifest.json。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload = {'kind': kind, 'blender': blender_ver,
               'generated': time.strftime('%Y-%m-%dT%H:%M:%S'), 'assets': entries}
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1, sort_keys=True)
    return payload


def parse_args():
    """blender -b -P x.py -- --specs a.json --out b --manifest c --limit 3"""
    import sys
    argv = sys.argv
    argv = argv[argv.index('--') + 1:] if '--' in argv else []
    out = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith('--'):
            out[argv[i][2:]] = argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
            i += 2
        else:
            i += 1
    return out
