#!/usr/bin/env bash
#
# 毛茸清单 · 云函数批量部署脚本
# ------------------------------------------------------------------
# 用途：把 cloud/ 下 7 个云函数一次性部署到 CloudBase 环境。
# 前置（本机只需做一次）：
#   1) 安装 CLI：  npm i -g @cloudbase/cli        # 提供 tcb 命令
#   2) 登录：      tcb login                      # 浏览器扫码 / 设备码
#   3) 在项目根目录执行： bash scripts/deploy-cloud-functions.sh
#
# 说明：
#   - 每个函数部署前会清理本地 node_modules，改用「云端自动安装依赖」
#     （--install-dependency true），避免 macOS 本地包被上传、也更省体积。
#   - payNotify 是 HTTP 函数，额外带 --httpFn --path /payNotify。
#   - petChat 超时 60s（AI 生成需要），其余 20s，配置取自根目录 cloudbaserc.json。
#   - dev 演示模式无需任何密钥即可跑通；真机支付需先完成「虚拟支付 3 步配置」。
# ------------------------------------------------------------------

set -euo pipefail

ENV_ID="cloud1-d4gck1kjyb8ca2456"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---- 定位 tcb ----
TCB="tcb"
if ! command -v tcb >/dev/null 2>&1; then
  CAND="/Users/luomingxin/.npm-global/lib/node_modules/@cloudbase/cli/bin/tcb"
  if [ -x "$CAND" ]; then
    TCB="node $CAND"
  else
    echo "✗ 未找到 tcb 命令，请先执行： npm i -g @cloudbase/cli"
    exit 1
  fi
fi

echo ">> 使用 CLI: $TCB"
echo ">> 目标环境: $ENV_ID"

# 登录前置检查（列出函数，失败则说明未登录）
if ! $TCB fn list >/dev/null 2>&1; then
  echo "✗ 似乎还未登录或环境不可达，请先执行： tcb login"
  exit 1
fi

# ---- 部署单个函数 ----
deploy_one() {
  local name="$1"
  local extra="${2:-}"
  echo ""
  echo "=================================================="
  echo ">> 部署 $name"
  echo "=================================================="
  (
    cd "cloud/$name"
    rm -rf node_modules package-lock.json
    if [ ! -f package.json ]; then
      echo "  ✗ $name 缺少 package.json，跳过"
      return 1
    fi
    $TCB fn deploy "$name" --envId "$ENV_ID" --runtime Nodejs20.19 --install-dependency true --force $extra
  )
}

# ---- 6 个 Event 函数 ----
for fn in auth taskService sessionService petService payService petChat; do
  deploy_one "$fn"
done

# ---- payNotify：HTTP 函数 ----
deploy_one "payNotify" "--httpFn --path /payNotify"

echo ""
echo "=================================================="
echo "✅ 7 个云函数部署完成"
echo "=================================================="
echo "控制台查看： https://tcb.cloud.tencent.com/dev?envId=$ENV_ID#/scf"
echo ""
echo "⚠️ 部署后还需人工确认两件事："
echo "   1) petChat 详情 → 实例配置 → 最小实例数设为 1（消除 AI 问候冷启动）"
echo "   2) payNotify 详情 → 确认已开启 HTTP 访问，复制其 HTTP 路径（MP 消息推送要用）"
