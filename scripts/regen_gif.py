#!/usr/bin/env python3
# scripts/regen_gif.py
# 从 prototype/index.html 的 APNG data URI 重新导出高质量 GIF。
#
# 针对 GIF 的两大先天缺陷做根治：
#  1) 明度抖动  -> 全动画共用「同一套 256 色全局调色板」（不再逐帧 ADAPTIVE），
#                 相邻帧同一像素颜色完全一致，播放时不再闪烁。
#  2) 边缘锯齿  -> 把 8-bit 透明边缘「预合成」到指定背景色上（GIF 透明只有 1-bit，
#                 半透明抗锯齿边会被硬切成锯齿；先合成成颜色渐变再量化即平滑）。
#                 输出为不透明 GIF（背景即该色），因此在背景同色的容器里无缝、无方框。
#
# 用法: python3 regen_gif.py <data_uri_index> <out_gif> [bg_hex]
#   bg_hex 默认 F6F4EF（今日页米白底）
import re, base64, io, sys
from PIL import Image, ImageSequence

PROTOTYPE = "/Users/luomingxin/WorkBuddy/2026-08-15-23-15-10/prototype/index.html"

def load_uris():
    data = open(PROTOTYPE, "r", encoding="utf-8", errors="ignore").read()
    return re.findall(r'data:image/png;base64,([A-Za-z0-9+/=]+)', data)

def is_apng(b):
    if b[:8] != b'\x89PNG\r\n\x1a\n': return False
    i = 8
    while i + 8 <= len(b):
        ln = int.from_bytes(b[i:i+4], 'big'); typ = b[i+4:i+8]
        if typ == b'acTL': return True
        if typ == b'IEND': break
        i += 12 + ln
    return False

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[k:k+2], 16) for k in (0, 2, 4))

def _nearest_palette_frame(frame_rgb, palette, n_colors):
    """精确最近邻量化：返回带调色板的 P 模式图。"""
    import numpy as np
    # 注意必须 int32：颜色平方差最大 255^2=65025 超出 int16 上限，会溢出成负数
    pal_arr = np.asarray(palette[: n_colors * 3], dtype=np.int32).reshape(n_colors, 3)
    arr = np.asarray(frame_rgb, dtype=np.int32)          # H, W, 3
    # 分块计算距离，避免大图内存峰值；找最近调色板条目
    idx = np.empty(arr.shape[:2], dtype=np.uint8)
    for y0 in range(0, arr.shape[0], 64):
        y1 = min(y0 + 64, arr.shape[0])
        block = arr[y0:y1]                                # h, W, 3
        d = ((block[:, :, None, :] - pal_arr[None, None, :, :]) ** 2).sum(axis=-1)
        idx[y0:y1] = d.argmin(axis=-1).astype(np.uint8)
    pim = Image.fromarray(idx, 'P')
    pim.putpalette(palette)
    return pim

def main():
    idx = int(sys.argv[1])
    out = sys.argv[2]
    bg = hex2rgb(sys.argv[3]) if len(sys.argv) > 3 else (0xF6, 0xF4, 0xEF)
    uris = load_uris()
    raw = base64.b64decode(uris[idx])
    if not is_apng(raw):
        print(f"[跳过] index {idx} 不是 APNG"); sys.exit(2)
    im = Image.open(io.BytesIO(raw))
    frames = []
    durations = []
    for fr in ImageSequence.Iterator(im):
        rgba = fr.convert('RGBA')
        # 预合成到背景色：边缘半透明 -> 与背景色的平滑渐变（消除锯齿）
        canvas = Image.new('RGBA', rgba.size, bg + (255,))
        canvas.paste(rgba, (0, 0), rgba)   # 用原 alpha 作 mask
        frames.append(canvas.convert('RGB'))
        durations.append(fr.info.get('duration', 80))
    # 关键：用「第一帧」算出一套 255 色全局调色板，所有帧共用 -> 无明度抖动
    pal = frames[0].quantize(colors=255, method=Image.ADAPTIVE)
    # 把调色板里最接近背景色的条目「钉」成精确背景色——mediancut 会把纯白/纯色
    # 挪动几个色阶（如 FFFFFF->FBFAF8），在纯色卡片上仍会隐约看出方块。
    # 背景是最大色块，改这个条目只影响背景与极少高光像素（差几个色阶，无感）。
    palette = pal.getpalette()
    n_colors = len(palette) // 3
    best, bestd = 0, float('inf')
    for i in range(n_colors):
        r, g, b = palette[i*3], palette[i*3+1], palette[i*3+2]
        d = (r-bg[0])**2 + (g-bg[1])**2 + (b-bg[2])**2
        if d < bestd:
            bestd, best = d, i
    palette[best*3:best*3+3] = list(bg)
    pal.putpalette(palette)
    qframes = [
        # Pillow 的 quantize(palette=...) / C 层 convert 即使 dither=NONE 也不做
        # 精确最近邻（实测纯白 FFFFFF 被映到邻近的 FBFAF8，纯色卡上显淡方块）。
        # 这里用 NumPy 逐像素精确最近邻映射：同一颜色跨帧必然同索引，天然无抖动。
        _nearest_palette_frame(f, palette, n_colors) for f in frames
    ]
    # disposal=2 每帧前先清屏；optimize=False 保留全局调色板不被二次压缩
    qframes[0].save(
        out, save_all=True, append_images=qframes[1:],
        duration=durations, loop=0, disposal=2, optimize=False,
    )
    print(f"[完成] index {idx} -> {out}")
    print(f"  帧数={len(frames)} 尺寸={frames[0].size} 背景=#{''.join(f'{c:02X}' for c in bg)}")
    print(f"  首帧时长={durations[0]}ms 平均={(sum(durations)/len(durations)):.0f}ms 输出={__import__('os').path.getsize(out)//1024}KB")

if __name__ == '__main__':
    main()
