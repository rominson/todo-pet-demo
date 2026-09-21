#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""扫描 public/pets/*-read.gif 的 alpha 通道，算出每只宠物在「210×210 壳」内的可见内容边界，
把结果打印成可直接粘进 src/pets.js 的 PET_BOX 表。

为什么需要它：素材四周有大片透明留白（可见内容仅占壳宽 36%~79%），
桌面端所有「贴边定位」（面板左右避让 / 菜单位置 / 气泡 / 切换环环心）都必须按可见边界算，
否则「几何上 41px 的间距」在肉眼看来是 100px。

用法：python3 scripts/scan_pet_box.py
"""
import glob
import os

from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
PETS = os.path.join(HERE, '..', 'public', 'pets')
OUT = 210.0                      # .pet 壳边长（逻辑 px，见 src/styles.css）


def scan(path):
    im = Image.open(path)
    w, h = im.size
    l = t = 10 ** 9
    r = b = -1
    for frame in ImageSequence.Iterator(im):
        bb = frame.convert('RGBA').getchannel('A').getbbox()
        if not bb:
            continue
        l, t = min(l, bb[0]), min(t, bb[1])
        r, b = max(r, bb[2]), max(b, bb[3])
    s = min(OUT / w, OUT / h)     # object-fit: contain 的缩放
    ox, oy = (OUT - w * s) / 2, (OUT - h * s) / 2
    return {
        'l': round(ox + l * s), 'r': round(ox + r * s),
        't': round(oy + t * s), 'b': round(oy + b * s),
    }


def main():
    rows = []
    for f in sorted(glob.glob(os.path.join(PETS, '*-read.gif'))):
        key = os.path.basename(f).replace('-read.gif', '')
        box = scan(f)
        rows.append((key, box))
        print('%-12s l=%-4d r=%-4d t=%-4d b=%-4d  可见 %dx%d / 壳 210'
              % (key, box['l'], box['r'], box['t'], box['b'],
                 box['r'] - box['l'], box['b'] - box['t']))
    print('\nexport const PET_BOX = {')
    for i in range(0, len(rows), 2):
        chunk = ', '.join(
            '%s: { l: %d, r: %d, t: %d, b: %d }' % (k, b['l'], b['r'], b['t'], b['b'])
            for k, b in rows[i:i + 2])
        print('  %s,' % chunk)
    print('};')


if __name__ == '__main__':
    main()
