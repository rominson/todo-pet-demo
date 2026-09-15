#!/bin/bash
# 部署云函数 petChat 到你的环境（一次性，需要你在浏览器授权 CLI）
set -e
# 让 tcb 命令可用（CLI 装在这里）
export PATH="/Users/luomingxin/.npm-global/bin:$PATH"

# 切到云函数目录（无论在哪运行本脚本都能正确定位）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/cloud/petChat"

echo ">>> 开始部署 petChat 到 cloud1-d4gck1kjyb8ca2456 ..."
tcb fn deploy petChat --env-id cloud1-d4gck1kjyb8ca2456

echo ""
echo ">>> 部署完成！现在回到浏览器打开 http://127.0.0.1:5500 即可和宠物对话。"
