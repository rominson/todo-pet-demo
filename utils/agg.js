// utils/agg.js —— 数据聚合：streak / 昨日完成 / 逾期 / 完成总数 / 日期工具
// 输入来自 taskService.list 的 tasks（每条含 done/done_at/created_at/title）

function pad(n) { return String(n).padStart(2, '0'); }

function toDateStr(d) {
  // 兼容三种来源：ISO 字符串 / 时间戳数字 / CloudBase 扩展 JSON 的 {$date: ms} 对象
  let x;
  if (d && typeof d === 'object' && d.$date != null) {
    const v = d.$date;
    const ms = (v && typeof v === 'object' && v.$numberLong != null) ? Number(v.$numberLong) : Number(v);
    x = new Date(ms);
  } else {
    x = d ? new Date(d) : new Date();
  }
  if (isNaN(x.getTime())) x = new Date(); // 解析失败兜底为今天，避免落到 NaN 键
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

function todayStr() { return toDateStr(new Date()); }

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

// 连续完成天数：从今天往回逐日查「当天是否≥1件完成」，断档即停。
// 今天没完成则看昨天，昨天也没有才算 0（与产品文档 B3-2 一致）。
function computeStreak(tasks) {
  const daySet = new Set(
    tasks.filter((t) => t.done && t.done_at).map((t) => toDateStr(t.done_at))
  );
  let cur = new Date();
  if (!daySet.has(toDateStr(cur))) {
    cur.setDate(cur.getDate() - 1);
    if (!daySet.has(toDateStr(cur))) return 0;
  }
  let streak = 0;
  while (daySet.has(toDateStr(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// 昨日完成列表（用于开场 P3 复述）
function yesterdayDone(tasks) {
  const y = yesterdayStr();
  return tasks.filter((t) => t.done && t.done_at && toDateStr(t.done_at) === y);
}

// 逾期：创建超过 48h 仍未完成（产品文档 §2 近似判定）
function overdueTasks(tasks) {
  const now = Date.now();
  return tasks.filter(
    (t) => !t.done && t.created_at && now - new Date(t.created_at).getTime() > 48 * 3600 * 1000
  );
}

// 完成总数
function totalDone(tasks) {
  return tasks.filter((t) => t.done).length;
}

module.exports = {
  pad, toDateStr, todayStr, yesterdayStr,
  computeStreak, yesterdayDone, overdueTasks, totalDone
};
