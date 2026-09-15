// utils/broadcast.js —— 播报文案引擎（纯函数）
// 模板来源：《MVP单向播报内容池与事件规则.md》+ 原型 memoryLines。
// 文案池已把「橘小满」参数化为 petName，切换宠物后自动对应当前伙伴。
// 去重（broadcast_log）由调用方用本地 storage 维护，这里只负责选句。

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// 每日开场：P1 逾期 → P2 坚持 → P3 昨日 → P4 兜底（只挑最高一档，不叠说）
function dailyOpen({ overdueList = [], streak = 0, yDone = [] }, petName = '橘小满') {
  if (overdueList.length) {
    const t = overdueList[0].title;
    return pick([
      `${t} 还在清单里躺着。今天做不做都行——反正我在这儿陪着你。`,
      `${t} 你放了两天多了，我数着呢。不催，就是让你知道我还记得。`,
      `今天的清单第一行，还是那件熟悉的 ${t}。要不要先把它划掉？`
    ]);
  }
  if (streak >= 2) {
    return pick([
      `你已经连着 ${streak} 天把当天的事做完了。${petName}觉得你挺稳的。`,
      `连续 ${streak} 天，一天没落。你大概没注意，我替你记着。`,
      `昨天的你也好好收尾了。今天的你，看着也不差。`
    ]);
  }
  if (yDone.length) {
    const t = yDone[0].title;
    return pick([
      `昨天那件 ${t}，我写进回忆册了。`,
      `昨天一共划掉了 ${yDone.length} 件事。我在旁边看得清清楚楚。`,
      `回忆册里又多了一笔昨天的：${t}。`
    ]);
  }
  return pick([
    `你来了。清单今天想从哪件开始？`,
    `想做就做，不想做在这儿歇会儿也行，我又不赶你。`,
    `你好呀，我叫${petName}。你去做你的事，我在这儿等你。`
  ]);
}

// 完成一条待办：普通 3 条轮换；若当天开场已复述过坚持/昨天，则只许用第 1 条纯夸
function completeReact({ overdue = false, openedP2P3 = false }, petName = '橘小满') {
  if (overdue) {
    return `拖了这么久，最后不还是做完了。这样也算数，${petName}照样记一笔。`;
  }
  if (openedP2P3) {
    return '划掉了。清单上少了一行，心里是不是也松了一点。';
  }
  return pick([
    '划掉了。清单上少了一行，心里是不是也松了一点。',
    '又搞定一件。这笔记进今天的回忆册了。',
    '你完成的事，我一件件都记得。'
  ]);
}

// 里程碑庆祝（完成瞬间检查 streak 命中 3/7/14）
function milestone(streak, petName = '橘小满') {
  if (streak === 3) return `连续 3 天，一天没落。第一个小里程碑，${petName}给你记进回忆册了。`;
  if (streak === 7) return `一整周，每天都有收尾。你大概没发现，但我一直数着。`;
  if (streak === 14) return `整整两周，一天没断。这份坚持，${petName}替你收进回忆册了。`;
  return '';
}

// 回忆册一句叙事（10 条模板轮换，按 id 稳定取，不随机跳变）
const MEMORY_LINES = [
  (t) => `完成了「${t}」。`,
  (t) => `「${t}」打勾，回收册又多了一页。`,
  (t) => `「${t}」收尾，可以小小地松一口气了。`,
  (t) => `完成了「${t}」。慢慢来，也会到终点。`,
  (t) => `「${t}」稳稳放进了完成栏。`,
  (t) => `又记下一件：「${t}」。`,
  (t) => `完成「${t}」——${'' /* 占位，调用方注入 petName */}橘小满替你画了一笔。`,
  (t) => `「${t}」变成已完成，像轻轻合上一个小本子。`,
  (t) => `把「${t}」留在了今天。`,
  (t) => `「${t}」做完了。这件事，我替你记着呢。`
];

function memoryLine(title, id, petName = '橘小满') {
  const idx = (id + MEMORY_LINES.length) % MEMORY_LINES.length;
  return MEMORY_LINES[idx](title).replace('橘小满', petName);
}

// 专注/冥想结束提示
function focusDone(mode, taskTitle, petName = '橘小满') {
  if (mode === 'meditate') return `${petName}：一阵安然的呼吸，我也记下了。`;
  return `${petName}：这次专注我记下了${taskTitle ? `——待办没自动勾掉，回清单自己打勾。` : ''}`;
}

// 中断安慰（不落库任何失败痕迹）
function focusAbort(petName = '橘小满') {
  return `中途停下来也没关系——${petName}不会怪你，下次想专注了，它随时都在。`;
}

module.exports = {
  pick, dailyOpen, completeReact, milestone, memoryLine, focusDone, focusAbort
};
