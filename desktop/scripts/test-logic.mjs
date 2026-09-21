// scripts/test-logic.mjs —— 纯逻辑自测（无需浏览器/Tauri）
import * as agg from '../src/agg.js';
import { dailyOpen, completeReact, milestone, memoryLine } from '../src/broadcast.js';
import * as store from '../src/store.js';

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗', name); } }

const today = agg.todayStr();
const y = new Date(); y.setDate(y.getDate() - 1);
const yStr = agg.toDateStr(y);

// agg
ok('isTodayTask 无日期=今天', agg.isTodayTask({ done: false }, today) === true);
ok('isTodayTask 未来日期=否', agg.isTodayTask({ due: '2099-01-01' }, today) === false);
ok('isTodayTask 已完成非今天=否', agg.isTodayTask({ due: today, done: true, done_at: yStr + 'T10:00:00' }, today) === false);
ok('repeatLabel daily', agg.repeatLabel('daily') === '每天');
ok('repeatLabel custom', agg.repeatLabel('custom:3d') === '每3天');

const tasks = [
  { done: true, done_at: today + 'T09:00:00' },
  { done: true, done_at: yStr + 'T09:00:00' },
  { done: false }
];
ok('computeStreak 连续2天', agg.computeStreak(tasks) === 2);
ok('totalDone=2', agg.totalDone(tasks) === 2);

// broadcast
ok('dailyOpen 返回字符串', typeof dailyOpen({ overdueList: [], streak: 0, yDone: [] }) === 'string');
ok('completeReact 返回字符串', typeof completeReact({}) === 'string');
ok('milestone(7) 含「整周」', milestone(7).includes('整周'));
ok('memoryLine 含标题', memoryLine('写周报', 3, '橘小满').includes('写周报'));

// store: repeat toggle
await store.init();
await store.ensureIntroTask();
ok('ensureIntroTask 种了一条', store.state.tasks.length === 1);
const before = store.state.tasks.length;
await store.create({ title: '每日喝水', repeat: 'daily' });
const t = store.state.tasks[store.state.tasks.length - 1];
ok('create 增加一条', store.state.tasks.length === before + 1);
const r1 = await store.toggle(t._id);
ok('toggle→done', r1.done === true);
const child = store.state.tasks.find((x) => x.gen_id === t._id);
ok('重复任务生成子项', !!child);
await store.toggle(child._id); // 完成子项
ok('子项可完成', store.state.tasks.find((x) => x._id === child._id).done === true);
await store.toggle(child._id); // 撤销子项 → 删除
ok('撤销子项被删除', !store.state.tasks.find((x) => x._id === child._id));
ok('父项仍 done', store.state.tasks.find((x) => x._id === t._id).done === true);
await store.remove(t._id);
ok('remove 父项连带子项', !store.state.tasks.find((x) => x.gen_id === t._id));

// footprints / sessions
await store.addFootprint('focus', '专注 25 分钟', 'orange');
const fps = await store.getFootprints(10);
ok('footprint 写入', fps.list.length === 1 && fps.list[0].type === 'focus');
await store.saveMessage('user', '你好', 'orange');
const hist = await store.getHistory(10);
ok('history 含用户消息', hist.list.some((m) => m.role === 'user'));

console.log(`\n逻辑自测: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
