#!/usr/bin/env python3
"""生成道具图片（200x200 PNG，供 MP 后台道具管理上传/批量导入）。

- 12 个星座宠物：zodiac_<key>.png
- 1 张「全家桶」道具图：zodiac_bundle.png（6 个全家桶档位道具共用同一张）
风格：品牌色纯色底 + 半透明白圆盘 + 白色中文名 + 底部小字。
输出：assets/prop-images/
注意：这两类图都会 base64 内嵌进 cloud/propImages/index.js 的 IMAGES，改图后要重新内嵌
      并 `tcb fn deploy propImages --path /propImages --force --install-dependency true`。
"""
import os
from PIL import Image, ImageDraw, ImageFont

# 与 utils/pets.js / cloud/petService/pets.js 保持一致
PETS = [
    ("aries",       "白羊", "金毛",   "#ff6b6b"),
    ("taurus",      "金牛", "水豚",   "#8d6e63"),
    ("gemini",      "双子", "狐狸",   "#9b59b6"),
    ("cancer",      "巨蟹", "仓鼠",   "#ffb74d"),
    ("leo",         "狮子", "狮子",   "#f39c12"),
    ("virgo",       "处女", "猫头鹰", "#607d8b"),
    ("libra",       "天秤", "天鹅",   "#e91e63"),
    ("scorpio",     "天蝎", "黑猫",   "#2c3e50"),
    ("sagittarius", "射手", "哈士奇", "#3498db"),
    ("capricorn",   "摩羯", "乌龟",   "#795548"),
    ("aquarius",    "水瓶", "鸭嘴兽", "#00bcd4"),
    ("pisces",      "双鱼", "兔子",   "#ff80ab"),
]

SIZE = 200
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "prop-images")

# macOS 中文字体
FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]

def load_font(size, index=0):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=index)
            except Exception:
                continue
    return ImageFont.load_default()

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def make(key, name, animal, color, big_size=64):
    img = Image.new("RGB", (SIZE, SIZE), hex_rgb(color))
    d = ImageDraw.Draw(img)

    # 半透明白色圆盘做视觉焦点
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([30, 30, 170, 170], fill=(255, 255, 255, 46))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)

    # 名称（大字）
    f_big = load_font(big_size)
    bx, by = d.textbbox((0, 0), name, font=f_big)[2:]
    d.text(((SIZE - bx) / 2, 62 - by / 2), name, font=f_big, fill=(255, 255, 255))

    # 副名（小字）
    f_small = load_font(24)
    sx, sy = d.textbbox((0, 0), animal, font=f_small)[2:]
    d.text(((SIZE - sx) / 2, 138 - sy / 2), animal, font=f_small, fill=(255, 255, 255, 235))

    out = os.path.join(OUT_DIR, f"zodiac_{key}.png")
    img.save(out, "PNG", optimize=True)
    return out, os.path.getsize(out)

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for key, name, animal, color in PETS:
        path, size = make(key, name, animal, color)
        print(f"OK  {os.path.basename(path):24s} {size} bytes")
    # 全家桶道具图：三个字放不下 64px，缩到 54px 保持左右留白与其余 12 张一致
    path, size = make("bundle", "全家桶", "12 只伙伴", "#E8B54C", big_size=54)
    print(f"OK  {os.path.basename(path):24s} {size} bytes")
    print(f"\n输出目录: {os.path.abspath(OUT_DIR)}")

if __name__ == "__main__":
    main()
