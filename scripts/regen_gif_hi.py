#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scripts/regen_gif_hi.py —— 把原型里的宠物动图 APNG 重制成「高清 + 书名可读」的 GIF。

背景（为什么需要它）
--------------------
`regen_gif.py` 出的 1 倍素材在今日页放大会糊：书封面上的书名原生只有 ~13px 宽，
GIF 量化会把它映到邻近的纸面色，**字直接消失**。实测 5 种组合后确定：
    「2 倍 LANCZOS 放大 + 多帧采样调色板」是唯一能让书名重新可读的方案，
    再往上（3x/4x）提升极小、体积翻倍。

与 `regen_gif.py` 的两点差异
----------------------------
1) 先放大再量化（LANCZOS），而不是原尺寸量化后再由小程序拉伸；
2) 调色板不再只从**首帧**取（首帧漏掉小面积的深棕字色），改为对**全部帧**随机采样后 MEDIANCUT。

其余关键约定（踩过的坑）
------------------------
* 帧延时严格沿用源 APNG：源里除 42ms 常规帧外还有 500/1000/2000ms 的**停顿帧**，
  用固定 `duration=80` 保存会把停顿抹掉（表现为动画一直匀速跑，节奏全错）。
  GIF 以厘秒存储，42ms→40ms 属正常截断，不是 bug。
* 背景必须**预合成**成不透明（GIF 只有 1-bit 透明，半透明抗锯齿边会被硬切成锯齿），
  今日页/专注页宠物容器都是白卡 → 统一 FFFFFF。
* 量化必须 NumPy 逐像素精确最近邻：Pillow 的 `quantize(palette=)` 即使 dither=NONE
  也不精确；距离计算必须 int32（255²=65025 超 int16 上限会溢出成负数）。
* 调色板里最接近背景色的那个条目要**钉成精确背景色**（mediancut 会把 FFFFFF 挪几个色阶，
  在白卡上会显淡方块）。
* 输出后再跑一遍 `scripts/optimize_gif.py`（只存相邻帧变化区域，约 -30%~-50%），
  它会自己做「逐像素一致」校验，不一致就拒绝落盘。

用法
----
    P=~/.workbuddy/binaries/python/envs/default/bin/python3
    $P scripts/regen_gif_hi.py                      # 全部 13 段 -> /tmp/hi2x/raw
    $P scripts/regen_gif_hi.py --scale 3 --out /tmp/g3
    $P scripts/regen_gif_hi.py --only libra-read.gif aquarius-read.gif
    $P scripts/regen_gif_hi.py --sheet              # 额外生成素材对照拼板（人眼核对用）

产出目录里的文件需再经 optimize_gif.py 压一遍，然后上传云存储：
    tcb storage upload <file> pets/anim/<file> -e <envId>
"""
import argparse
import base64
import io
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageSequence

PROTO = '/Users/luomingxin/WorkBuddy/2026-08-15-23-15-10/prototype/index.html'
BG = (255, 255, 255)   # 今日页/专注页的宠物容器都是白卡
PAD_ROWS = 48          # 最近邻量化的分块行数：控制内存峰值

# (输出名, 源 data URI 序号)
# 序号来自 prototype/index.html 内嵌 png 的顺序，且**必须按变量名/alt 核对内容**：
#   #68-71 = SCENE_SWAN_*（天鹅 → libra）、#88-91 = SCENE_PLATYPUS_*（鸭嘴兽 → aquarius）。
#   2026-09-19 曾因「按画面风格猜」把这两组装反，用户当场发现 —— 判据只看变量名/alt。
TARGETS = [
    ('orange-read.gif',      46),
    ('aries-read.gif',       74),
    ('taurus-read.gif',      66),
    ('gemini-read.gif',      62),
    ('cancer-read.gif',      50),
    ('leo-read.gif',         78),
    ('virgo-read.gif',       82),
    ('libra-read.gif',       70),   # 天鹅（读《傲慢与偏见》）
    ('scorpio-read.gif',     54),
    ('sagittarius-stand.gif', 58),  # 无 read 段，今日页用 stand
    ('capricorn-read.gif',   94),
    ('aquarius-read.gif',    90),   # 鸭嘴兽（读《银河系搭车客指南》）
    ('pisces-stand.gif',     86),   # 无 read 段，今日页用 stand
]


def load_uris():
    return re.findall(rb'data:image/png;base64,([A-Za-z0-9+/=]+)', open(PROTO, 'rb').read())


def frames_of(uri, bg=BG):
    """APNG -> [(RGB 帧)], [帧延时 ms]；半透明边缘预合成到 bg。"""
    im = Image.open(io.BytesIO(base64.b64decode(uri)))
    out, durs = [], []
    for fr in ImageSequence.Iterator(im):
        rgba = fr.convert('RGBA')
        canvas = Image.new('RGBA', rgba.size, bg + (255,))
        canvas.paste(rgba, (0, 0), rgba)
        out.append(canvas.convert('RGB'))
        durs.append(int(round(fr.info.get('duration', 80))))
    return out, durs


def palette_from_frames(frames, colors=255):
    """对全部帧随机采样后 MEDIANCUT —— 只取首帧会漏掉小面积深色细节（书名）。"""
    rng = np.random.default_rng(7)
    chunks = []
    for f in frames:
        a = np.asarray(f).reshape(-1, 3)
        chunks.append(a[rng.choice(len(a), min(15000, len(a)), replace=False)])
    strip = Image.fromarray(np.concatenate(chunks).astype(np.uint8).reshape(-1, 1, 3))
    return strip.quantize(colors=colors, method=Image.MEDIANCUT)


def pin_background(palette, bg):
    """把调色板里最接近 bg 的条目钉成精确 bg，返回 (palette, n_colors)。"""
    n = len(palette) // 3            # getpalette() 长度可能是 765，不能写死 256
    best, bd = 0, float('inf')
    for i in range(n):
        r, g, b = palette[i*3], palette[i*3+1], palette[i*3+2]
        d = (r-bg[0])**2 + (g-bg[1])**2 + (b-bg[2])**2
        if d < bd:
            bd, best = d, i
    palette[best*3:best*3+3] = list(bg)
    return palette, n


def nearest(frame_rgb, palette, n_colors):
    """NumPy 精确最近邻量化。距离必须 int32：255²=65025 超 int16 上限会溢出成负数。"""
    pal = np.asarray(palette[: n_colors * 3], dtype=np.int32).reshape(n_colors, 3)
    arr = np.asarray(frame_rgb, dtype=np.int32)
    idx = np.empty(arr.shape[:2], dtype=np.uint8)
    for y0 in range(0, arr.shape[0], PAD_ROWS):
        y1 = min(y0 + PAD_ROWS, arr.shape[0])
        d = ((arr[y0:y1, :, None, :] - pal[None, None, :, :]) ** 2).sum(axis=-1)
        idx[y0:y1] = d.argmin(axis=-1).astype(np.uint8)
    p = Image.fromarray(idx, 'P')
    p.putpalette(palette)
    return p


def build(name, frames, durs, scale, outdir, bg=BG):
    big = frames if scale == 1 else [
        f.resize((f.width * scale, f.height * scale), Image.LANCZOS) for f in frames]
    pal = palette_from_frames(big)
    palette, n = pin_background(pal.getpalette(), bg)
    pal.putpalette(palette)
    qf = [nearest(f, palette, n) for f in big]
    out = os.path.join(outdir, name)
    # disposal=2 + optimize=False：每帧都是完整画面，不依赖前一帧（后续再单独做帧间优化）
    qf[0].save(out, format='GIF', save_all=True, append_images=qf[1:],
               duration=durs, loop=0, disposal=2, optimize=False)
    return qf[0].size, os.path.getsize(out)


def contact_sheet(paths, out='/tmp/hi2x/contact-sheet.png', tw=300):
    keys = [os.path.basename(p).split('-')[0] for p in paths]
    th = int(tw * 161 / 280)
    cols = 5
    rows = (len(paths) + cols - 1) // cols
    cv = Image.new('RGB', (cols * (tw + 10) + 10, rows * (th + 26) + 10), 'white')
    d = ImageDraw.Draw(cv)
    for i, p in enumerate(paths):
        im = Image.open(p)
        t = im.convert('RGB').resize((tw, th), Image.LANCZOS)
        x = 10 + (i % cols) * (tw + 10)
        y = 10 + (i // cols) * (th + 26)
        cv.paste(t, (x, y + 18))
        d.text((x + 2, y + 3), keys[i], fill=(200, 0, 0))
    cv.save(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scale', type=int, default=2, help='放大倍数（默认 2，实测书名可读的最小值）')
    ap.add_argument('--out', default='/tmp/hi2x/raw', help='输出目录')
    ap.add_argument('--only', nargs='*', help='只处理这些输出名，如 libra-read.gif')
    ap.add_argument('--sheet', action='store_true', help='额外生成素材对照拼板')
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    uris = load_uris()
    want = set(args.only or [])
    total, made = 0, []
    print('%-24s %-8s %-6s %-9s %-9s %s' % ('target', 'src', 'frames', 'out', 'size', 'dur(ms)'))
    for name, idx in TARGETS:
        if want and name not in want:
            continue
        frames, durs = frames_of(uris[idx])
        size, sz = build(name, frames, durs, args.scale, args.out)
        total += sz
        made.append(os.path.join(args.out, name))
        print('%-24s %-8s %-6d %-9s %7.0fKB  %s' % (
            name, '%dx%d' % frames[0].size, len(frames), '%dx%d' % size, sz / 1024,
            sorted(set(durs))))
        del frames
    print('TOTAL %.1fMB  files=%d' % (total / 1024 / 1024, len(made)))
    print('下一步：scripts/optimize_gif.py 逐个压一遍，再上传 pets/anim/')
    if args.sheet and made:
        print('拼板 -> %s' % contact_sheet(made))
    return 0


if __name__ == '__main__':
    sys.exit(main())
