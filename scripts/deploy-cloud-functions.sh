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
#   - 在【项目根目录】用 `tcb fn deploy --all` 读取根 cloudbaserc.json
#     （functionRoot=cloud + 7 函数配置）一次性部署，不再逐个弹选择框。
#   - 云端自动安装依赖（--install-dependency true），不传本地 node_modules。
#   - payNotify 额外单独挂 HTTP 访问路径（--path /payNotify，不加 --httpFn，
#     保持普通 Event 函数，代码按 event 入参返回 {statusCode,headers,body}）；
#     微信支付回调需要它能被外网访问。注意：--httpFn 会部署成 Web 函数，
#     需要 scf_bootstrap 启动文件，本项目的 payNotify 不适用。
#   - petChat 超时 60s（AI 生成需要），其余 20s，均取自根 cloudbaserc.json。
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

# ---- 1) 批量部署 7 个函数（非交互，读取根 cloudbaserc.json）----
echo ""
echo "=================================================="
echo ">> 批量部署 7 个云函数（--all，非交互）"
echo "=================================================="
$TCB fn deploy --all --install-dependency true

# ---- 2) payNotify 单独挂 HTTP 访问路径（微信支付回调需要外网可访问）----
echo ""
echo "=================================================="
echo ">> 为 payNotify 创建 HTTP 访问路径（--path /payNotify，不加 --httpFn）"
echo "=================================================="
$TCB fn deploy payNotify --path /payNotify --force --install-dependency true

echo ""
echo "=================================================="
echo "✅ 7 个云函数部署完成"
echo "=================================================="
echo "控制台查看： https://tcb.cloud.tencent.com/dev?envId=$ENV_ID#/scf"
echo ""
echo "⚠️ 部署后还需人工确认两件事："
echo "   1) petChat 详情 → 实例配置 → 最小实例数设为 1（消除 AI 问候冷启动）"
echo "   2) payNotify 详情 → 确认已开启 HTTP 访问，复制其 HTTP 路径（MP 消息推送要用）"
