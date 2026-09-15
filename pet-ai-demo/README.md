# 毛茸清单 · 宠物 AI Demo（真实 CloudBase AI · 合规版）

把你的宠物（橘小满 / 12 星座本命动物）接上**真实的**腾讯云 AI，跑在你报名的
「小程序成长计划」环境 `cloud1-d4gck1kjyb8ca2456` 上，吃 10 亿 token 免费额度。

## ⚠️ 为什么是「云函数」架构（重要）

成长计划免费额度**只允许这两个来源**消耗（专项治理公告明确）：
1. 微信小程序内 `wx.cloud.extend.AI`
2. 云开发服务端（云函数 / 云托管）里调 AI

**浏览器里用 Web SDK 直接 `app.ai()` 属于违规**——不会从免费额度扣、还会有被暂停
AI 资源包的风险。所以本 Demo 把 AI 调用放进**云函数**，HTML 页只通过
`app.callFunction` 触发，AI 在云函数（服务端）内消耗你的 10 亿免费额度，合规。

## 目录
```
pet-ai-demo/
├─ index.html        # 聊天页 + 任务面板（只调 callFunction，不直接调 AI）
├─ config.js         # 你唯一要改的文件：env + accessKey
├─ cloud/petChat/    # 云函数：服务端调 AI（消耗免费额度）
│   ├─ index.js
│   └─ package.json
├─ assets/           # 橘小满 + 12 星座 3D 毛绒图
└─ README.md
```

## 一、你本地要做的（一次性）
1. 打开 `config.js`，把 `ACCESS_KEY` 换成你的 **Publishable Key**：
   - 路径：**环境管理 → API Key 配置** → **上面**那个「客户端 Publishable Key」区块 → 点蓝色「生成」按钮
   - ⚠️ **下面那个「服务端 API Key」用不上**（那是给 HTTP API 自己写后端时用的私密 Key，我们走云函数不需要）
   - 「AI 工具中使用」那个 API Key 下拉本质也是 Publishable Key，是另一个入口，不用重复生成
2. 云开发控制台 → 你的环境 → **登录授权** → 开启「匿名登录」（不开则 callFunction 会 401）。

## 二、部署云函数（一次性，需要你登录 CloudBase）
```bash
# 1) 装 CLI（只需一次）
npm i -g @cloudbase/cli

# 2) 浏览器登录（会弹授权页）
tcb login

# 3) 进云函数目录，装依赖并部署
cd pet-ai-demo/cloud/petChat
npm install
tcb fn deploy petChat --env-id cloud1-d4gck1kjyb8ca2456
# 首次运行会自动打印一个授权链接 + 用户码，复制到浏览器登录 CloudBase 账号授权即可，
# 授权成功后 CLI 会自动继续部署（不需要单独先 tcb login）。
```
部署成功后，页面调 `petChat` 就会在服务端真正消耗免费额度。

## 三、本地运行 Demo
```bash
cd pet-ai-demo
python3 -m http.server 5500
# 浏览器打开 http://127.0.0.1:5500
```
首屏宠物主动打招呼；左侧填「今日待办 / 节奏 / 目标」，宠物据此说"记得你"的话；
上方可切换 13 个伙伴的人设与头像。

## 四、它怎么"记得你"
每次发消息，左侧面板上下文会被拼进 `system` prompt（见 `index.html` 的
`buildSystem()`），例如：
```
【当前上下文】
【今日待办】
- ○ 写周报
- ✓ 背单词
【本周目标】本周专注达到 20 小时
你"记得"用户的事：比如"这周还差 4 小时就到专注目标了哦。"
```
模型（默认 `hunyuan-v3` + `hy3`，免费额度专属）据此生成有记忆实感的回应。

## 五、从 Demo 迁到真小程序
| 现在（Demo） | 真小程序（下一步） |
|---|---|
| 任务存 localStorage | `app.database()` 写 CloudBase 集合 `tasks` |
| Web SDK `callFunction` → 云函数 | 小程序内 `wx.cloud.extend.AI`（同环境同额度，连 accessKey 都不用） |
| 独立 HTML 页 | 「宠物对话页」用 WXML 复刻此聊天 UI |
| 手动填上下文 | 自动从任务系统读数据注入 prompt |

`buildSystem()` + `MEMORY_RULES` 这套 prompt 框架可直接复用，不用重写。
云函数 `petChat` 也可直接复用到小程序（小程序端用 `wx.cloud.extend.AI` 替代 callFunction）。
