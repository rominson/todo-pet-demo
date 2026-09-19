#!/usr/bin/env python3
# scripts/scan_pet_shift.py
#
# 扫描 13 只宠物「read 动图」里宠物本体的非白 bbox，反算今日页的贴边位移 l / r，
# 直接输出可粘贴进 utils/pets.js 的 PET_SHIFT 代码块。
#
# 为什么需要它：
#   今日页要把宠物推向卡片左/右边缘（把素材自带的四周白边推出画框），
#   位移量取决于「素材尺寸 × 展示框尺寸 × 本体在图里的位置」，三者任一变化都必须重扫：
#     · 换了动图素材（如重制高清版、修正配错的图）
#     · 改了 .pet-img 的 width/height（pages/index/index.wxss）
#   旧表曾出现 r（贴右）系统性偏大 ~22rpx 的错误（贴左的 l 却吻合），
#   2026-09-19 对 CDN 真实素材全量重扫后修正 —— 所以务必以本脚本结果为准，别手改数字。
#
# 用法：
#   python3 scripts/scan_pet_shift.py                 # 用默认展示框 622×380（当前线上值）
#   python3 scripts/scan_pet_shift.py 540 330         # 指定展示框宽高（rpx）
#
# 依赖：Pillow + numpy（本机 venv：~/.workbuddy/binaries/python/envs/default/bin/python3）
import io
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageSequence

CDN = 'https://636c-cloud1-d4gck1kjyb8ca2456-1461749586.tcb.qcloud.la/pets/anim/'
CACHE = '/tmp/petread'
KEYS = ['orange', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra',
        'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
# 这两只没有 read 段（原型即如此），今日页用站立姿势兜底 —— 与 utils/pets.js 的 anim 字段一致
SPECIAL = {'sagittarius': 'stand', 'pisces': 'stand'}
PAD = 10          # 宠物本体距卡片边缘保留的「呼吸」距离（rpx）
THR = 14          # 判定「非白」的颜色差阈值（白底合成后的 GIF 里，白 = 背景）
MODEL = {'orange': '橘小满', 'aries': '白羊', 'taurus': '金牛', 'gemini': '双子', 'cancer': '巨蟹',
         'leo': '狮子', 'virgo': '处女', 'libra': '天秤', 'scorpio': '天蝎',
         'sagittarius': '射手', 'capricorn': '摩羯', 'aquarius': '水瓶', 'pisces': '双鱼'}


def fetch(key, pose):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f'{key}-{pose}.gif')
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        url = f'{CDN}{key}-{pose}.gif'
        with urllib.request.urlopen(url, timeout=60) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path


def bbox_all_frames(path):
    """所有帧的「非白」像素并集 bbox（动图里宠物会轻微移动，取并集才不会被裁到）"""
    im = Image.open(path)
    W, H = im.size
    left, right = 10 ** 9, -1
    for fr in ImageSequence.Iterator(im):
        a = np.asarray(fr.convert('RGB')).astype(np.int16)
        m = (255 - a).max(axis=2) > THR
        if not m.any():
            continue
        _, xs = np.where(m)
        left = min(left, int(xs.min()))
        right = max(right, int(xs.max()))
    return W, H, left, right


def main():
    fw = int(sys.argv[1]) if len(sys.argv) > 2 else 622
    fh = int(sys.argv[2]) if len(sys.argv) > 2 else 380
    rows = {}
    print(f'展示框 {fw}×{fh}rpx   PAD={PAD}rpx')
    print('%-13s %-5s %-9s %-7s %-6s %-6s %6s %6s' %
          ('key', '宠物', '素材', 'scale', 'bboxL', 'bboxR', 'l', 'r'))
    for k in KEYS:
        pose = SPECIAL.get(k, 'read')
        W, H, L, R = bbox_all_frames(fetch(k, pose))
        s = min(fw / W, fh / H)
        base = (fw - W * s) / 2
        l = round(base + L * s - PAD)
        r = round(base + (W - 1 - R) * s - PAD)
        rows[k] = (l, r)
        print('%-13s %-5s %-9s %-7.3f %-6d %-6d %6d %6d' %
              (k, MODEL[k], f'{W}x{H}', s, L, R, l, r))

    print('\n// —— 粘回 utils/pets.js 的 PET_SHIFT ——')
    print('const PET_SHIFT = {')
    chunk = []
    for k in KEYS:
        chunk.append(f"{k}: {{ l: {rows[k][0]}, r: {rows[k][1]} }}")
        if len(chunk) == 3 or k == KEYS[-1]:
            print('  ' + ', '.join(chunk) + ',')
            chunk = []
    print('};')


if __name__ == '__main__':
    main()
