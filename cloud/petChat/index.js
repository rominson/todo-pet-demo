// 云函数 petChat —— 服务端调用 AI（合规消耗成长计划免费额度）
// 前端只通过 wx.cloud.callFunction 触发本函数，AI 在云端调用，来源=云开发服务端。
const tcb = require("@cloudbase/node-sdk");

const app = tcb.init({ env: "cloud1-d4gck1kjyb8ca2456" });

// 依次尝试的模型组合（命中第一个可用的）：
// 1) hunyuan-v3 / hy3 —— 成长计划免费额度专属（仅消耗免费额度，最稳）
// 2) hunyuan-exp / hunyuan-2.0-instruct-20251111 —— 通用兜底
// 3) cloudbase / hy3 —— 备用兜底
// 这样无论环境里哪个 provider 当前可用，都能接通 AI 对话。
const MODELS = [
  { provider: "hunyuan-v3", model: "hy3" },
  { provider: "hunyuan-exp", model: "hunyuan-2.0-instruct-20251111" },
  { provider: "cloudbase", model: "hy3" }
];

exports.main = async (event) => {
  const { messages } = event;

  if (!Array.isArray(messages) || !messages.length) {
    return { ok: false, error: "messages 不能为空" };
  }

  const ai = app.ai();
  let lastErr = null;

  for (const { provider, model } of MODELS) {
    try {
      const m = ai.createModel(provider);
      const res = await m.generateText({
        model,
        messages,
        temperature: 0.85,
      });
      return { ok: true, text: res.text, usage: res.usage, provider, model };
    } catch (e) {
      lastErr = e;
      // 该模型不可用，尝试下一个
    }
  }

  return { ok: false, error: (lastErr && lastErr.message) || "所有模型均调用失败" };
};
