// 云函数 petChat —— 服务端调用 AI（合规消耗成长计划免费额度）
// 浏览器端只通过 app.callFunction 触发本函数，AI 在此处调用，来源=云开发服务端。
const tcb = require("@cloudbase/node-sdk");

// 云函数运行在它被部署到的环境里；显式指定你的环境
const app = tcb.init({ env: "cloud1-d4gck1kjyb8ca2456" });

exports.main = async (event) => {
  const {
    messages,
    provider = "hunyuan-v3", // hunyuan-v3 + hy3 = 仅消耗免费额度（最稳）
    model = "hy3",
  } = event;

  if (!Array.isArray(messages) || !messages.length) {
    return { ok: false, error: "messages 不能为空" };
  }

  try {
    const ai = app.ai();
    const m = ai.createModel(provider);
    const res = await m.generateText({
      model,
      messages,
      temperature: 0.8,
    });
    return { ok: true, text: res.text, usage: res.usage };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
};
