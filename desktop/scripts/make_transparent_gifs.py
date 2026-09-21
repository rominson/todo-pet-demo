#!/usr/bin/env python3
# 把 CDN 上的宠物动图（白底）抠成透明 GIF，存到 desktop/public/pets/
# 背景：CDN 的 *-read.gif / *-laptop.gif 是由透明 APNG 转 GIF 时丢了透明通道的白底版，
#       桌面端（透明窗口）必须用透明素材，故本地做一次「四角洪水填充抠白底」。
# 用法：/Users/luomingxin/.workbuddy/binaries/python/envs/default/bin/python3 scripts/make_transparent_gifs.py
import os, sys, urllib.request
import numpy as np
from PIL import Image, ImageSequence, ImageDraw, ImageFilter

CDN = 'https://636c-cloud1-d4gck1kjyb8ca2456-1461749586.tcb.qcloud.la/pets/anim/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'pets')
PETS = ['orange','aries','taurus','gemini','cancer','leo','virgo','libra',
        'scorpio','sagittarius','capricorn','aquarius','pisces']
READ_OVERRIDE = {'sagittarius': 'stand', 'pisces': 'stand'}  # 这两只看书帧文件名是 -stand.gif
THRESH = 35          # 洪水填充阈值（18 偏低，轮廓外会残留白 halo；35 更干净）
NEAR_WHITE = 205     # 「近白」判定：r/g/b 均 > 此值
DEWHITE_PASSES = 2   # 边缘去白迭代次数（清除轮廓外侧残留的近白抗锯齿像素）


def fetch(url, dst):
    # 空 dict = 不读任何代理（本机 http_proxy 可能指向已退出的 ClashX）
    op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with op.open(url, timeout=60) as r, open(dst, 'wb') as f:
        f.write(r.read())

def dewhite_edges(f, passes=DEWHITE_PASSES):
    """清除轮廓外侧残留的近白像素（白底抠图产生的 halo / 白描边感）。
    只对「紧邻透明区」且「近白」的边缘像素置透明；宠物内部的眼白、书页白不邻接透明区，不受影响。"""
    for _ in range(passes):
        arr = np.array(f)                                                       # HxWx4
        alpha = arr[..., 3]
        amin = np.array(f.getchannel('A').filter(ImageFilter.MinFilter(3)))     # 3x3 邻域最小 alpha
        edge = (alpha > 0) & (amin == 0)                                        # 紧邻透明区的边缘像素
        near_white = (arr[..., 0] > NEAR_WHITE) & (arr[..., 1] > NEAR_WHITE) & (arr[..., 2] > NEAR_WHITE)
        kill = edge & near_white
        if not kill.any():
            break
        arr[kill, 3] = 0
        f = Image.fromarray(arr, 'RGBA')
    return f


def strip_bg(src, dst):
    im = Image.open(src)
    frames = []
    for fr in ImageSequence.Iterator(im):
        f = fr.convert('RGBA').copy()
        w, h = f.size
        for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
            ImageDraw.floodfill(f, seed, (0, 0, 0, 0), thresh=THRESH)
        f = dewhite_edges(f)
        frames.append(f)
    dur = im.info.get('duration', 80)
    frames[0].save(dst, save_all=True, append_images=frames[1:], disposal=2,
                   transparency=0, duration=dur, loop=0)
    return len(frames), w, h

def main():
    os.makedirs(OUT, exist_ok=True)
    tmpdir = '/tmp/petanim'; os.makedirs(tmpdir, exist_ok=True)
    total = 0
    for k in PETS:
        read_name = (READ_OVERRIDE.get(k, 'read'))
        jobs = [(f'{k}-{read_name}.gif', f'{k}-read.gif'),
                (f'{k}-laptop.gif', f'{k}-laptop.gif')]
        for src_name, out_name in jobs:
            url = CDN + src_name
            raw = os.path.join(tmpdir, src_name)
            try:
                fetch(url, raw)
            except Exception as e:
                print(f'  [skip] {src_name}: {e}'); continue
            try:
                n, w, h = strip_bg(raw, os.path.join(OUT, out_name))
                sz = os.path.getsize(os.path.join(OUT, out_name))
                total += sz
                print(f'  [ok] {out_name:20} {w}x{h} {n}帧 {sz//1024}KB')
            except Exception as e:
                print(f'  [ERR] {out_name}: {e}')
    print(f'总计 {total/1024/1024:.1f} MB -> {os.path.abspath(OUT)}')

if __name__ == '__main__':
    main()
