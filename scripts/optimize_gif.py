#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GIF 帧间优化：把「每帧都存完整画面」的 GIF 压成「只存变化区域」。

两种用法：
1) 减小代码包内的图片音频总量，通过微信开发者工具的「图片和音频资源不超过 200K」检查；
2) 压缩放在云存储 CDN 上的宠物动图（此时打印的「上限 200K／仍超限」只是沿用同一套阈值，
   对 CDN 素材没有约束意义，看压缩率即可）。

原理：
- regen_gif.py / regen_gif_hi.py 生成的 GIF 每帧都是整幅画面，且无透明/无 disposal；
- 相邻帧其实只变 ~10% 像素；
- Pillow 的 optimize=True + disposal=1 会自动算最小变化矩形并用透明像素跳过未变区域。

用法：
  python3 optimize_gif.py <输入.gif> [输出.gif]
不传输出则原地覆盖，并在前后做「逐像素一致」校验（不一致就报错且不落盘）。
"""
import os
import sys

from PIL import Image, ImageSequence
import numpy as np

LIMIT = 200 * 1024


def load(path):
    im = Image.open(path)
    frames, durs = [], []
    for fr in ImageSequence.Iterator(im):
        frames.append(fr.copy())
        durs.append(fr.info.get("duration", 50))
    # 注意：迭代到末帧后 im.getpalette() 会返回 None，必须从首帧取全局调色板
    pal = frames[0].getpalette() or []
    if len(pal) < 768:
        pal = pal + [0] * (768 - len(pal))
    return im, frames, durs, pal


def pixels(path):
    return [np.array(f.convert("RGB")) for f in ImageSequence.Iterator(Image.open(path))]


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else src
    before = os.path.getsize(src)

    im, frames, durs, pal = load(src)
    base = frames[0]
    base.putpalette(pal)

    tmp = out + ".opt.gif"
    base.save(tmp, format="GIF", save_all=True, append_images=frames[1:], optimize=True,
              disposal=1, loop=im.info.get("loop", 0), duration=durs, palette=pal)
    after = os.path.getsize(tmp)

    a, b = pixels(src), pixels(tmp)
    if len(a) != len(b) or not all((x == y).all() for x, y in zip(a, b)):
        os.remove(tmp)
        print("✗ 优化后画面与原始不一致，已放弃")
        return 1

    os.replace(tmp, out)
    print("✓ %s" % out)
    print("  帧数 %d（不变）  调色板 256 色（不变）" % len(frames))
    print("  %.1f KB → %.1f KB（-%.0f%%）  上限 %.0f KB  %s"
          % (before / 1024, after / 1024, 100 * (1 - after / before), LIMIT / 1024,
             "通过" if after <= LIMIT else "仍超限！"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
