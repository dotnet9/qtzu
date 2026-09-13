#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 Q淘族 favicon：粉紫渐变圆角底 + Q 版词宠蛋 + 橙色 Q 徽章
保留配色基因（粉→紫渐变、橙点），主体为游戏核心符号"词宠蛋"（淘了个蛋）。
输出: favicon.ico (16/32/48/64) + favicon.png (512 母版) + apple-touch-icon.png (192)
"""
import os
from PIL import Image, ImageDraw, ImageFont

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# ---- 圆角方块底：粉 -> 紫 渐变（沿用 logo 配色） ----
radius = 110
grad = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
gd = ImageDraw.Draw(grad)
top = (255, 122, 160)    # #FF7AA0
bottom = (150, 108, 240) # #966CF0
for y in range(SIZE):
    t = y / SIZE
    c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
    gd.line([(0, y), (SIZE, y)], fill=c)
mask = Image.new("L", (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, SIZE, SIZE], radius=radius, fill=255)
img.paste(grad, (0, 0), mask)

# ---- 白色词宠蛋（上窄下宽的椭圆） ----
egg_box = [SIZE * 0.24, SIZE * 0.14, SIZE * 0.76, SIZE * 0.86]
d.ellipse(egg_box, fill=(255, 253, 250, 255))

# ---- 脸：黑豆眼 + 高光 + 粉腮红 + 微笑 ----
eye_y = SIZE * 0.46
eye_dx = SIZE * 0.085
eye_r = SIZE * 0.038
for sx in (-1, 1):
    cx = SIZE * 0.5 + eye_dx * sx
    d.ellipse([cx - eye_r, eye_y - eye_r * 1.25, cx + eye_r, eye_y + eye_r * 1.25],
              fill=(74, 64, 70, 255))                      # 眼
    hx = cx + eye_r * 0.4
    d.ellipse([hx - eye_r * 0.3, eye_y - eye_r * 0.85,
               hx + eye_r * 0.3, eye_y - eye_r * 0.25], fill=(255, 255, 255, 255))  # 高光
blush_r = SIZE * 0.052
for sx in (-1, 1):
    cx = SIZE * 0.5 + SIZE * 0.155 * sx
    cy = SIZE * 0.56
    d.ellipse([cx - blush_r, cy - blush_r * 0.72, cx + blush_r, cy + blush_r * 0.72],
              fill=(255, 165, 185, 255))                   # 腮红
# 微笑（弧线）
sw = SIZE * 0.045
d.arc([SIZE * 0.5 - sw, SIZE * 0.44, SIZE * 0.5 + sw, SIZE * 0.58],
      start=25, end=155, fill=(74, 64, 70, 255), width=int(SIZE * 0.022))

# ---- 橙色小点点（呼应 logo 的橙点） ----
dot_r = SIZE * 0.038
d.ellipse([SIZE * 0.78 - dot_r, SIZE * 0.16 - dot_r,
           SIZE * 0.78 + dot_r, SIZE * 0.16 + dot_r], fill=(255, 183, 77, 255))

# ---- 右下角橙色 Q 徽章（品牌字母） ----
badge_r = SIZE * 0.115
bx, by = SIZE * 0.76, SIZE * 0.76
d.ellipse([bx - badge_r, by - badge_r, bx + badge_r, by + badge_r],
          fill=(255, 152, 0, 255), outline=(255, 255, 255, 255), width=int(SIZE * 0.018))
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(SIZE * 0.13))
    d.text((bx, by - SIZE * 0.004), "Q", font=font,
           fill=(255, 255, 255, 255), anchor="mm")
except OSError:
    pass  # 字体缺失时徽章保持纯色

# ---- 输出 ----
out_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
img.save(os.path.join(out_dir, "favicon.png"))                       # 512 母版
img.resize((192, 192), Image.LANCZOS).save(os.path.join(out_dir, "apple-touch-icon.png"))
ico_path = os.path.join(out_dir, "favicon.ico")
img.save(ico_path, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("favicon 生成完毕 ->", out_dir)
