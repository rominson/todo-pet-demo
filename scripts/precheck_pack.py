#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
上传前自检：按微信开发者工具的**真实口径**复核打包内容与「图片音频 200K」检查项。

匹配逻辑照抄开发者工具 app.asar 里的实现（packOptionsHelper.isIgnored）：
    basename = 路径最后一段
    prefix → basename.startsWith(value)
    suffix → basename.endsWith(value)              ★ 只比对文件名，不含目录
    folder → ('/'+path).startsWith('/'+value+'/')  ★ 归一化后前缀匹配，支持嵌套
    file   → ('/'+path) === ('/'+value)            ★ 精确匹配，不覆盖子目录
「图片和音频资源」检查项（IMAGE_AND_AUDIO_LIMIT）判定的是**包内所有图片音频的总和** < 200KB，
不是单个文件。

用法：python3 scripts/precheck_pack.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 与工具 _imageAndAudioExtMap 一致的扩展名集合
AUDIO_IMG_EXT = {
    ".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif",
    ".flac", ".m4a", ".ogg", ".ape", ".amr", ".wma", ".wav", ".mp3", ".mp4", ".aac", ".aiff", ".caf",
}
CODE_EXT = {".json", ".wxml", ".wxss", ".js", ".wxs", ".ts", ".less", ".sass", ".scss"}
LIMIT_KB = 200


def norm_start(p):
    return p if p.startswith("/") else "/" + p


def load_ignores():
    with open(os.path.join(ROOT, "project.config.json"), encoding="utf-8") as f:
        return json.load(f)["packOptions"]["ignore"]


def is_ignored(rel, rules):
    base = os.path.basename(rel).lower()
    path = norm_start(rel.replace(os.sep, "/"))
    for rule in rules:
        t, v = rule.get("type"), rule.get("value", "").lower()
        if t == "prefix" and base.startswith(v):
            return True
        if t == "suffix" and base.endswith(v):
            return True
        if t == "folder" and path.startswith(norm_start(v).rstrip("/") + "/"):
            return True
        if t == "file" and path == norm_start(v):
            return True
        if t == "glob":
            import fnmatch
            if fnmatch.fnmatch(rel, rule["value"]):
                return True
    return False


def main():
    rules = load_ignores()
    packed, images, code_files = [], [], []

    for dp, dn, fn in os.walk(ROOT):
        if ".git" in dp.split(os.sep):
            continue
        for f in fn:
            full = os.path.join(dp, f)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            if is_ignored(rel, rules):
                continue
            size = os.path.getsize(full)
            packed.append((size, rel))
            if os.path.splitext(f)[1].lower() in AUDIO_IMG_EXT:
                images.append((size, rel))
            if os.path.splitext(f)[1].lower() in CODE_EXT:
                code_files.append(rel)

    total = sum(s for s, _ in packed)
    img_total = sum(s for s, _ in images)

    print("=== 打包内容 ===")
    print("  文件数 %d，合计 %.2f MB（主包上限 2 MB）" % (len(packed), total / 1048576))
    print("\n=== 图片/音频资源（工具按「总和」判定）===")
    for s, r in sorted(images, reverse=True):
        print("    %8.1f KB  %s" % (s / 1024, r))
    print("  ── 合计 %.1f KB / 阈值 %d KB → %s【%s】"
          % (img_total / 1024, LIMIT_KB,
             "通过" if img_total / 1024 < LIMIT_KB else "不通过",
             "建议" ))
    print("\n=== 代码文件 %d 个（工具会检查是否「无依赖」）===" % len(code_files))

    # 引用扫描：排除掉的素材不能再以「本地路径」被引用（CDN 前缀不算）
    excluded_dir = os.path.join(ROOT, "assets", "pets")
    excluded_names = [f for f in os.listdir(excluded_dir)
                      if f.endswith("-scene.png") or f == "orange-anim.gif"]
    refs = []
    scan_ext = (".js", ".wxml", ".wxss", ".json")
    for dp, dn, fn in os.walk(ROOT):
        if any(s in dp.split(os.sep) for s in (".git", "cloud", "prototype", ".workbuddy", "node_modules")):
            continue
        for f in fn:
            if not f.endswith(scan_ext) or f == "project.config.json":
                continue  # project.config.json 里写的就是这些忽略规则本身
            p = os.path.join(dp, f)
            txt = open(p, encoding="utf-8", errors="replace").read()
            for name in excluded_names:
                # 只认 '/assets/pets/xxx' 这类本地引用；SCENE_CDN + 'xxx' 后面跟的是裸文件名，不算
                if "/assets/pets/" + name in txt or "../../assets/pets/" + name in txt:
                    refs.append((os.path.relpath(p, ROOT), name))
            if "/assets/prop-images/" in txt or "../../assets/prop-images/" in txt:
                refs.append((os.path.relpath(p, ROOT), "prop-images/"))
    print("\n=== 被排除素材是否仍被「本地路径」引用 ===")
    print("  " + ("全部无引用 ✓" if not refs else "✗ 仍有引用：" + str(refs)))

    ok = img_total / 1024 < LIMIT_KB and not refs and total / 1048576 < 2
    print("\n总判定：%s" % ("通过" if ok else "需处理"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
