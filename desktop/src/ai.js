// src/ai.js —— 宠物「大脑」
// v1 默认用本地规则大脑：根据上下文（今日待办 / 坚持天数 / 专注分钟 / 最近足迹）生成有「记忆感」的回复，
// 语气对齐 broadcast.js 的陪伴风格。离线可用，不依赖任何云端。
//
// 想接真·大模型（小程序那套 CloudBase petChat / 10 亿 Token）：见文件底部 cloudPetReply() 的接线说明，
// 配置 window.__MR_CLOUDBASE__ = { envId, publishableKey } 并开启匿名登录即可，本地大脑作为兜底保留。

import { pick } from './broadcast.js';

function has(text, words) {
  return words.some((w) => text.includes(w));
}

// 本地规则大脑
export async function petReply(userText, ctx) {
  const text = (userText || '').trim().toLowerCase();
  const name = ctx.pet?.name || '橘小满';
  const pending = ctx.todayTasks || [];
  const streak = ctx.streak || 0;

  if (!text) {
    return pick([
      `嗯？我在听呢。`,
      `想说什么都可以，我又不嫌你啰嗦。`,
      `等你开口呢。`
    ]);
  }

  // 问候
  if (has(text, ['你好', '您好', '早', 'hi', 'hello', '在吗', '在不在', '哈喽', '嗨', 'hi~'])) {
    if (pending.length) {
      return pick([
        `你来啦。今天还有 ${pending.length} 件没划掉，先从哪件开始？`,
        `早呀。清单上那几件，我陪你一件件来。`
      ]);
    }
    return pick([
      `你好呀，我叫${name}。你去做你的事，我在这儿等你。`,
      `你来啦。今天想从哪件开始？`
    ]);
  }

  // 谢谢
  if (has(text, ['谢谢', '感谢', 'thx', '多谢', '谢啦'])) {
    return pick([
      `跟我还客气什么，应该的。`,
      `你开心就好，我记着呢。`
    ]);
  }

  // 低落 / 需要安慰
  if (has(text, ['累', '焦虑', '压力', '烦', '不想', '拖延', '丧', '难受', '难过', '委屈'])) {
    return pick([
      `累了就歇会儿，清单又不会跑。我在这儿陪着你。`,
      `中途停下来也没关系，我不会怪你，下次想做了它随时都在。`,
      `烦的时候别硬撑，先做件最小的也行——或者什么都不做，也行。`
    ]);
  }

  // 问今天 / 待办
  if (has(text, ['今天', '待办', '清单', '做什么', '安排', '任务', 'todo', '要做'])) {
    if (pending.length === 0) {
      return pick([
        `今天的清单是空的。想加一件吗？写下来就完成了一半。`,
        `今天还没安排，挺好，轻装上阵。`
      ]);
    }
    if (pending.length === 1) {
      return `今天就一件：「${pending[0]}」。做完它，今天就圆满了。`;
    }
    return `今天还有 ${pending.length} 件：最前面是「${pending[0]}」。要我陪你从它开始吗？`;
  }

  // 问坚持 / 习惯
  if (has(text, ['坚持', '连续', '多少天', '几天', '打卡', '习惯', '记录'])) {
    if (streak >= 2) return `你已经连着 ${streak} 天把当天的事做完了，我替你记着呢。`;
    return `才刚开始也没关系，一天天来。我帮你数着。`;
  }

  // 问记忆 / 回忆
  if (has(text, ['记得', '回忆', '以前', '上次', '过去'])) {
    const mem = (ctx.recentDone && ctx.recentDone[0]) || null;
    if (mem) return `当然记得。你上次完成了「${mem}」，我写进回忆册了。`;
    return `你做的事我都一件件记着。哪天想回顾，随时问我。`;
  }

  // 问宠物自己
  if (has(text, ['你', '宠物', '伙伴', '橘小满', '名字', '是谁', '喜欢'])) {
    return pick([
      `我是${name}，你的陪伴伙伴。你去做事，我就在旁边。`,
      `我就在这儿呀，你抬头就能看见我。`
    ]);
  }

  // 默认：带点上下文的回应
  if (pending.length) {
    return pick([
      `我在呢。要不要先把「${pending[0]}」划掉？`,
      `你说啥我都听着。不过那件「${pending[0]}」，我可一直记着呢。`
    ]);
  }
  return pick([
    `我在听。`,
    `嗯，然后呢？`,
    `你慢慢说，我不急。`
  ]);
}

/* ============================================================
 * 可选：接 CloudBase 真·大模型（petChat 云函数）
 * ------------------------------------------------------------
 * 前置：
 *   1) 在 index.html 或 main.js 里设置 window.__MR_CLOUDBASE__ = { envId, publishableKey }
 *   2) CloudBase 控制台开启「匿名登录」
 *   3) npm i @cloudbase/js-sdk
 * 然后把下面的 cloudPetReply 接到 chat 视图（优先调用，失败回退 petReply）。
 *
 * export async function cloudPetReply(messages) {
 *   const cfg = window.__MR_CLOUDBASE__;
 *   if (!cfg) return null;
 *   const { default: cloud } = await import('@cloudbase/js-sdk');
 *   const app = cloud.init({ env: cfg.envId, accessKey: cfg.publishableKey });
 *   await app.auth({ persistence: 'local' }).anonymousAuthProvider().signIn();
 *   const res = await app.callFunction({ name: 'petChat', data: { messages } });
 *   return res?.result?.text || null;
 * }
 * ============================================================ */
