# -*- coding: utf-8 -*-
"""词宠 / 玩家 / NPC 烘焙：把 scripts/extract-prims.mjs 提取的图元清单生成 GLB。

与 gates/landmarks/ground 共用同一套风格化加工（顶点色 AO + 按角度拆边）。

关键设计：
  · 图元来自浏览器里的**真实 three**（同一份 JS 造型代码）→ 形状与游戏完全一致、零分叉
  · 细分刻意压低（球 12×9、柱 12 边）：游戏里球是 18×14，但同屏最多 6 个词宠（game.js 的
    slice(-6)），压低后单个约 2000 面（原 5974），体积与绘制开销都降下来；0.55 缩放下看不出差别
  · 顶点色 = 材质色 + 烘焙 AO；自发光材质保留（词宠的发光感）
  · 按角度拆边（>32° 硬棱）：胶囊/球保持平滑、方块/锥体出硬棱（与校门同一套规则）
  · 不倒角：这里的图元本来就是球/胶囊/柱，倒角只会白吃面数

契约（运行时依赖）：原点在**脚底中心**、正面朝 glTF +Z、单位同 js → 调用方原样摆放。
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C  # noqa: E402

# 细分上限（图元参数里更大的细分在这里降下来）
MAX_SEG = {'sphere_w': 12, 'sphere_h': 9, 'cyl': 12, 'cone': 10, 'capsule': 10,
           'torus_t': 8, 'torus_r': 16}


def _clamp(v, hi):
    return max(3, min(int(hi), int(v or hi)))


def prim_geo(p):
    """图元 → (verts, faces)。返回的是 three 的 Y-up 坐标系，再由调用方套矩阵。"""
    t = p['type']
    q = p.get('params') or {}
    verts, faces = [], []

    if t == 'SphereGeometry':
        ws = _clamp(q.get('ws'), MAX_SEG['sphere_w'])
        hs = _clamp(q.get('hs'), MAX_SEG['sphere_h'])
        r = float(q.get('r') or 0.5)
        for j in range(hs + 1):                      # 纬度
            phi = math.pi * j / hs
            for i in range(ws):                      # 经度
                th = math.pi * 2 * i / ws
                verts.append((r * math.sin(phi) * math.cos(th), r * math.cos(phi),
                              r * math.sin(phi) * math.sin(th)))
        for j in range(hs):
            for i in range(ws):
                a = j * ws + i
                b = j * ws + (i + 1) % ws
                c = (j + 1) * ws + (i + 1) % ws
                d = (j + 1) * ws + i
                if j > 0:
                    faces.append((a, d, b))
                if j < hs - 1:
                    faces.append((b, d, c))

    elif t in ('CylinderGeometry', 'ConeGeometry'):
        seg = _clamp(q.get('rs'), MAX_SEG['cone'] if t == 'ConeGeometry' else MAX_SEG['cyl'])
        rt = float(q.get('rt') if t == 'CylinderGeometry' else 0.001)
        rb = float(q.get('r') if t == 'ConeGeometry' else (q.get('rb') or 0.5))
        h = float(q.get('h') or 1)
        for i in range(seg):
            th = math.pi * 2 * i / seg
            verts.append((rb * math.cos(th), -h / 2, rb * math.sin(th)))
        for i in range(seg):
            th = math.pi * 2 * i / seg
            verts.append((rt * math.cos(th), h / 2, rt * math.sin(th)))
        for i in range(seg):
            a, b = i, (i + 1) % seg
            c, d = seg + (i + 1) % seg, seg + i
            faces.append((a, c, b))                  # 侧面（外侧朝外）
            faces.append((b, c, d))
        # 端盖：扇形（三点共面，法线正确即可）
        bot = len(verts); verts.append((0, -h / 2, 0))
        top = len(verts); verts.append((0, h / 2, 0))
        for i in range(seg):
            a, b = i, (i + 1) % seg
            faces.append((a, b, bot))
            faces.append((seg + b, seg + a, top))

    elif t == 'CapsuleGeometry':
        seg = _clamp(q.get('rs'), MAX_SEG['capsule'])
        hs = max(4, seg // 2)
        r = float(q.get('r') or 0.5)
        half = float(q.get('len') or 0.5) / 2
        # 上/下半球 + 中段柱面
        for j in range(hs + 1):
            phi = math.pi * j / (hs * 2)             # 0..π/2 上半
            for i in range(seg):
                th = math.pi * 2 * i / seg
                verts.append((r * math.sin(phi) * math.cos(th), half + r * math.cos(phi),
                              r * math.sin(phi) * math.sin(th)))
        off = len(verts)
        for j in range(hs + 1):
            phi = math.pi * j / (hs * 2)
            for i in range(seg):
                th = math.pi * 2 * i / seg
                verts.append((r * math.cos(phi) * math.cos(th), -half - r * math.sin(phi),
                              r * math.cos(phi) * math.sin(th)))
        for base, jmax in ((0, hs), (off, hs)):
            for j in range(jmax):
                for i in range(seg):
                    a = base + j * seg + i
                    b = base + j * seg + (i + 1) % seg
                    c = base + (j + 1) * seg + (i + 1) % seg
                    d = base + (j + 1) * seg + i
                    faces.append((a, d, b))
                    faces.append((b, d, c))
        # 中段柱面：把两半球的赤道圈连起来
        for i in range(seg):
            i2 = (i + 1) % seg
            faces.append((off + i2, off + i, i, i2))   # 下赤道 → 上赤道

    elif t == 'TorusGeometry':
        ts = _clamp(q.get('ts'), MAX_SEG['torus_t'])
        rs = _clamp(q.get('rs'), MAX_SEG['torus_r'])
        R = float(q.get('R') or 0.5)          # 大半径
        r = float(q.get('tube') or 0.2)       # 小半径（extract 里叫 tube）
        for i in range(rs):
            a = math.pi * 2 * i / rs
            for j in range(ts):
                b = math.pi * 2 * j / ts
                rr = R + r * math.cos(b)
                verts.append((rr * math.cos(a), r * math.sin(b), rr * math.sin(a)))
        for i in range(rs):
            for j in range(ts):
                a0 = i * ts + j
                a1 = i * ts + (j + 1) % ts
                b0 = ((i + 1) % rs) * ts + j
                b1 = ((i + 1) % rs) * ts + (j + 1) % ts
                faces.append((a0, b0, b1, a1))

    elif t == 'BoxGeometry':
        w = float(q.get('w') or 1) / 2
        h = float(q.get('h') or 1) / 2
        d = float(q.get('d') or 1) / 2
        for sx in (-1, 1):
            for sy in (-1, 1):
                for sz in (-1, 1):
                    verts.append((sx * w, sy * h, sz * d))
        # 顶点顺序：x,y,z 三位 → 索引 (sx,sy,sz) = 4*ix+2*iy+iz
        q6 = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        faces.extend(q6)

    elif t == 'IcosahedronGeometry':
        r = float(q.get('r') or 0.5)
        t0 = (1 + math.sqrt(5)) / 2
        pts = [(-1, t0, 0), (1, t0, 0), (-1, -t0, 0), (1, -t0, 0),
               (0, -1, t0), (0, 1, t0), (0, -1, -t0), (0, 1, -t0),
               (t0, 0, -1), (t0, 0, 1), (-t0, 0, -1), (-t0, 0, 1)]
        for p3 in pts:
            n = math.sqrt(sum(c * c for c in p3))
            verts.append(tuple(c / n * r for c in p3))
        faces.extend([(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11),
                      (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
                      (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9),
                      (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)])

    elif t == 'BufferGeometry':
        # 自定义几何：顶点/索引由提取器从 three 里带出来（顶点在 JS 里现算，无法参数化重建）
        raw = p.get('customVerts')
        idx = p.get('customIdx')
        if not raw:
            return None
        base = len(verts)          # 顶点是跨图元累积的：索引必须加这个偏移
        for i in range(0, len(raw), 3):
            verts.append((raw[i], raw[i + 1], raw[i + 2]))
        n = len(raw) // 3
        if idx:
            for i in range(0, len(idx), 3):
                faces.append((base + int(idx[i]), base + int(idx[i + 1]), base + int(idx[i + 2])))
        else:
            for i in range(0, n - 2, 3):
                faces.append((base + i, base + i + 1, base + i + 2))
    elif t == 'PlaneGeometry':
        w = float(q.get('w') or 1) / 2
        h = float(q.get('h') or 1) / 2
        verts.extend([(-w, 0, -h), (w, 0, -h), (w, 0, h), (-w, 0, h)])
        faces.append((0, 1, 2, 3))

    else:
        return None
    return verts, faces


def _mat_apply(verts, m):
    """套 three 的 4x4（列主序），并把 three 的 Y-up 转成 Blender 的 Z-up：(x,y,z)→(x,-z,y)。"""
    out = []
    for (x, y, z) in verts:
        tx = m[0] * x + m[4] * y + m[8] * z + m[12]
        ty = m[1] * x + m[5] * y + m[9] * z + m[13]
        tz = m[2] * x + m[6] * y + m[10] * z + m[14]
        out.append((tx, -tz, ty))
    return out


def build_cell(cell, name):
    soup = C.Soup(name)
    skipped = 0
    for p in cell['prims']:
        g = prim_geo(p)
        if g is None:
            skipped += 1
            continue
        verts, faces = g
        if not verts or not faces:
            skipped += 1
            continue
        verts = _mat_apply(verts, p['matrix'])
        em = p.get('emissive')
        use_em = em if (em and em.lower() != '#000000' and float(p.get('ei') or 0) > 0.05) else None
        soup.add((verts, faces), p['color'] or '#CCCCCC',
                 bevel=0, jitter=0, smooth=not p.get('flat'),
                 rough=float(p.get('rough') or 0.9), emissive=use_em,
                 ei=min(1.0, float(p.get('ei') or 0.6)))
    if not soup.parts:
        return None
    ob = C.build_object(soup, name)
    C.bake_ao(ob, distance=0.5, samples=16, seed=abs(sum(ord(c) for c in name)) % 9999)
    return ob, skipped


def main():
    import bpy
    a = C.parse_args()
    data = json.load(open(a['specs'], encoding='utf-8'))
    kind = data['kind']
    cells = data['cells']
    limit = int(a.get('limit', 0) or 0)
    offset = int(a.get('offset', 0) or 0)
    if offset:
        cells = cells[offset:]
    if limit:
        cells = cells[:limit]
    entries = {}
    failed = []
    for i, cell in enumerate(cells):
        key = cell['key']
        # 文件名不能带 ':'（Windows 会当成 ADS 流，写不出文件）——文件名用 '-'，逻辑 key 保留
        safe = key.replace(':', '-')
        rel = f'{kind}s/{safe}.glb'
        out = os.path.join(a['out'], rel.replace('/', os.sep))
        try:
            built = build_cell(cell, f'{kind}_{key}')
        except Exception as e:            # 单个资产出错不该毁掉整批（记录后跳过）
            import traceback
            traceback.print_exc()
            failed.append((key, repr(e)[:120]))
            built = None
        if built is None:
            print(f'[{kind}] {key} 无可用图元/构建失败，跳过')
            continue
        ob, skipped = built
        info = C.check_budget(kind, C.stats(ob), rel)
        size = C.export_glb(ob, out)
        entries[key] = dict(info, file=rel, bytes=size, kind=kind, key=key,
                            # aliases：这个外观代表哪些 petId（运行时按 petId 查同一份 GLB）
                            aliases=cell.get('pets') or [],
                            zh=cell.get('zh'), en=cell.get('en'),
                            prims=len(cell['prims']), skipped=skipped)
        C.bpy_cleanup(ob)
        if (i + 1) % 20 == 0 or i == len(cells) - 1:
            print(f'[{kind}] {i + 1}/{len(cells)} {key} tri={info["tri"]} {size // 1024}KB')
    # 分块烘焙：把分册合并（每块写自己的 --manifest 文件）
    mf = a['manifest']
    if os.path.exists(mf):
        try:
            old = json.load(open(mf, encoding='utf-8'))
            entries = dict(old.get('assets', {}), **entries)
        except Exception:
            pass
    C.write_manifest(mf, kind, C.bpy_version(), entries)
    print(f'[{kind}] 完成 {len(entries)} 个')
    if failed:
        print(f'[{kind}] 失败 {len(failed)} 个：' + '; '.join(f'{k} {e}' for k, e in failed[:8]))


if __name__ == '__main__':
    import bpy  # noqa: F401
    C.reset_scene()
    main()
