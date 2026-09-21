import glob, os
from PIL import Image, ImageSequence

os.chdir('/Users/luomingxin/WorkBuddy/2026-08-15-23-15-10/desktop/public/pets')
for f in sorted(glob.glob('*-read.gif')):
    im = Image.open(f)
    frames = list(ImageSequence.Iterator(im))
    sizes = set((fr.size for fr in frames))
    disps = set(fr.disposal_method for fr in frames)
    # transparent index
    try:
        ti = im.info.get('transparency')
    except Exception:
        ti = None
    dur = [fr.info.get('duration', 0) for fr in frames]
    print(f"{f:22s} size={im.size} frames={len(frames)} frameSizes={sizes} disposal={disps} trans={ti} dur0={dur[0]} loop={im.info.get('loop')}")
