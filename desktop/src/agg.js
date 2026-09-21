// src/agg.js —— 数据聚合（移植自小程序 utils/agg.js）
// 完成天数 / 昨日完成 / 逾期 / 完成总数 / 日期工具。

export function pad(n) { return String(n).padStart(2, '0'); }

export function toDateStr(d) {
  let x;
  if (d && typeof d === 'object' && d.$date != null) {
    const v = d.$date;
    const ms = (v && typeof v === 'object' && v.$numberLong != null) ? Number(v.$numberLong) : Number(v);
    x = new Date(ms);
  } else if (typeof d === 'number') {
    x = new Date(d);
  } else {
    x = d ? new Date(d) : new Date();
  }
  if (isNaN(x.getTime())) x = new Date();
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function todayStr() { return toDateStr(new Date()); }

export function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

// 连续完成天数：从今天往回逐日查「当天是否≥1件完成」，断档即停。
export function computeStreak(tasks) {
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

export function yesterdayDone(tasks) {
  const y = yesterdayStr();
  return tasks.filter((t) => t.done && t.done_at && toDateStr(t.done_at) === y);
}

// 逾期：创建超过 48h 仍未完成
export function overdueTasks(tasks) {
  const now = Date.now();
  return tasks.filter(
    (t) => !t.done && t.created_at && now - new Date(t.created_at).getTime() > 48 * 3600 * 1000
  );
}

export function totalDone(tasks) {
  return tasks.filter((t) => t.done).length;
}

// 今日页口径：只显示「无日期 或 日期=今天」的任务；已完成项额外要求「完成时间=今天」。
export function isTodayTask(t, today) {
  const ds = today || todayStr();
  if (t.due && t.due !== ds) return false;
  if (t.done) return !!t.done_at && toDateStr(t.done_at) === ds;
  return true;
}

export function repeatLabel(r) {
  if (!r || r === 'none') return '';
  if (r === 'daily') return '每天';
  if (r === 'weekly') return '每周';
  if (r === 'monthly') return '每月';
  const m = String(r).match(/custom:(\d+)([dwm])/);
  if (m) {
    const u = m[2] === 'd' ? '天' : m[2] === 'w' ? '周' : '月';
    return `每${m[1]}${u}`;
  }
  return '';
}
