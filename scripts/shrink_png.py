#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日历头像缩图：把 assets/pets/<key>.png 缩到指定宽度，减小代码包体积。

背景：
- 这 13 张 3D 大头图**只用在日历格子的足迹小标**上（.glyph-pet = 26rpx × 26rpx），
  26rpx ≈ 13px 逻辑像素，3 倍屏也只有 39 物理像素，而原图宽 193~198px（约 5 倍冗余）。
- 但它们是「图片和音频资源总量不超过 200K」这项检查里的大头（13 张共 109.5 KB）。
- 只做**缩放**，保留 255 色与原有 alpha（不做减色），把画质损失压到最低。

用法：
  python3 shrink_png.py            # 默认缩到 96px 宽，原地覆盖（原图备份到 /tmp/pet-avatar-orig/）
  python3 shrink_png.py 120        # 自定义目标宽度
校验：
  逐张对比「缩图放大回原尺寸」与原图的平均/最大通道误差，并打印总体积变化。
"""
import os
import shutil
import sys

from PIL import Image
import numpy as np

SRC_DIR = "assets/pets"
BACKUP_DIR = "/tmp/pet-avatar-orig"
DEFAULT_WIDTH = 96


def is_avatar(name):
    # 头像 = <key>.png（不含 -read / -scene 后缀），且不是动图
    return name.endswith(".png") and "-" not in name


def main():
    target = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WIDTH
    names = sorted(n for n in os.listdir(SRC_DIR) if is_avatar(n))
    if not names:
        print("没找到头像文件")
        return 1

    os.makedirs(BACKUP_DIR, exist_ok=True)
    before_total = sum(os.path.getsize(os.path.join(SRC_DIR, n)) for n in names)

    print("目标宽度 %dpx，共 %d 张" % (target, len(names)))
    print("%-18s %-14s %-14s %8s %8s" % ("文件", "原尺寸", "新尺寸", "原KB", "新KB"))
    worst_avg, worst_max = 0.0, 0
    for n in names:
        p = os.path.join(SRC_DIR, n)
        shutil.copy2(p, os.path.join(BACKUP_DIR, n))  # 先备份原图

        im = Image.open(p).convert("RGBA")
        w = min(target, im.width)
        out = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
        # 保 255 色（与微信后台素材原色一致），只做缩放带来的重采样
        out = out.quantize(colors=255, method=Image.FASTOCTREE)
        out.save(p, format="PNG", optimize=True)

        # 校验：新图拉回原尺寸后与原始比对的误差
        back = Image.open(p).convert("RGBA").resize(im.size, Image.LANCZOS)
        a = np.array(im, dtype=np.int16)
        b = np.array(back, dtype=np.int16)
        d = np.abs(a[..., :3] - b[..., :3])
        worst_avg = max(worst_avg, float(d.mean()))
        worst_max = max(worst_max, int(d.max()))

        print("%-18s %-14s %-14s %8.1f %8.1f"
              % (n, "%dx%d" % im.size, "%dx%d" % Image.open(p).size,
                 os.path.getsize(os.path.join(BACKUP_DIR, n)) / 1024,
                 os.path.getsize(p) / 1024))

    after_total = sum(os.path.getsize(os.path.join(SRC_DIR, n)) for n in names)
    print("\n合计 %.1f KB → %.1f KB（-%.0f%%）"
          % (before_total / 1024, after_total / 1024,
             100 * (1 - after_total / before_total)))
    print("重采样误差：平均 %.2f/255，最大 %d/255（仅缩放，未减色）"
          % (worst_avg, worst_max))
    print("原图备份在 %s" % BACKUP_DIR)
    return 0


if __name__ == "__main__":
    sys.exit(main())
