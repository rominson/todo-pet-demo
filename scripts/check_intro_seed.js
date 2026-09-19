// scripts/check_intro_seed.js
// 用假 db 跑**真实云函数代码** cloud/taskService/index.js，验证「首次自动放一条引导待办」的幂等性。
//   node scripts/check_intro_seed.js
const Module = require('module');
const path = require('path');

const FN = path.join(__dirname, '..', 'cloud', 'taskService', 'index.js');
const OPENID = 'test-openid';

let STATE = null;   // { tasks: [], users: [] }
let CALLS = null;   // { taskAdds: [], userAdds: [], userUpdates: [] }

function makeDB() {
  const tasks = {
    where() {
      const chain = {
        count: async () => ({ total: STATE.tasks.length }),
        get: async () => ({ data: STATE.tasks.slice() }),
        orderBy() { return chain; },
        limit() { return chain; },
        remove: async () => ({})
      };
      return chain;
    },
    add: async ({ data }) => { CALLS.taskAdds.push(data); STATE.tasks.push(data); return { _id: 'task-new' }; },
    doc: () => ({ update: async () => ({}), get: async () => ({ data: {} }), remove: async () => ({}) })
  };
  const users = {
    where() {
      const chain = {
        get: async () => ({ data: STATE.users.slice() }),
        update: async ({ data }) => { CALLS.userUpdates.push(data); return {}; },
        orderBy() { return chain; },
        limit() { return chain; }
      };
      return chain;
    },
    add: async ({ data }) => { CALLS.userAdds.push(data); STATE.users.push(data); return { _id: 'user-new' }; },
    doc: () => ({
      update: async ({ data }) => { CALLS.userUpdates.push(data); return {}; },
      get: async () => ({ data: {} }),
      remove: async () => ({})
    })
  };
  return { collection: (n) => (n === 'tasks' ? tasks : users) };
}

// 拦截 wx-server-sdk（必须在 require 云函数之前）
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      init() {},
      getWXContext: () => ({ OPENID }),
      database: () => makeDB()
    };
  }
  return origLoad.apply(this, arguments);
};

delete require.cache[require.resolve(FN)];
const fn = require(FN);

let pass = 0, fail = 0;
function check(name, got, expect) {
  const ok = JSON.stringify(got) === JSON.stringify(expect);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}  ${JSON.stringify(got)}${ok ? '' : '  期望 ' + JSON.stringify(expect)}`);
}

(async () => {
  // ① 全新用户：没有 users 记录、没有任何任务 → 放一条引导待办 + 建 users
  STATE = { tasks: [], users: [] }; CALLS = { taskAdds: [], userAdds: [], userUpdates: [] };
  let r = await fn.main({ action: 'list' });
  check('① 全新用户 放引导条', CALLS.taskAdds.length, 1);
  check('① 标题', CALLS.taskAdds[0] && CALLS.taskAdds[0].title, '欢迎来毛茸清单 · 点圆圈完成，左滑删除');
  check('① 无日期/不重要/不重复', CALLS.taskAdds[0] && [CALLS.taskAdds[0].due, CALLS.taskAdds[0].important, CALLS.taskAdds[0].repeat], ['', false, 'none']);
  check('① 建了 users 并带 current_pet=orange', CALLS.userAdds.length === 1 && CALLS.userAdds[0].current_pet, 'orange');
  check('① list 返回 1 条', r.list.length, 1);

  // ② 老用户（已用了一阵、有任务、没标记）→ 只打标记，不塞任务
  STATE = { tasks: [{ title: '写产品文档' }, { title: '交房租' }], users: [{ _id: 'u1', openid: OPENID }] };
  CALLS = { taskAdds: [], userAdds: [], userUpdates: [] };
  r = await fn.main({ action: 'list' });
  check('② 老用户 不塞任务', CALLS.taskAdds.length, 0);
  check('② 打了 intro_seeded 标记', CALLS.userUpdates.length === 1 && CALLS.userUpdates[0].intro_seeded, true);
  check('② list 仍返回原有 2 条', r.list.length, 2);

  // ③ 已标记 + 列表被清空（用户自己删掉了引导条）→ 不再补
  STATE = { tasks: [], users: [{ _id: 'u1', openid: OPENID, intro_seeded: true }] };
  CALLS = { taskAdds: [], userAdds: [], userUpdates: [] };
  r = await fn.main({ action: 'list' });
  check('③ 已标记 不重复补', CALLS.taskAdds.length, 0);
  check('③ list 为空', r.list.length, 0);

  // ④ 连续两次 list（幂等）：第一次放，第二次不再放
  STATE = { tasks: [], users: [] }; CALLS = { taskAdds: [], userAdds: [], userUpdates: [] };
  await fn.main({ action: 'list' });
  // 模拟真实 db 的写入效果（假 db 已在 add 时写入 STATE）
  CALLS = { taskAdds: [], userAdds: [], userUpdates: [] };
  await fn.main({ action: 'list' });
  check('④ 第二次 list 不再放', CALLS.taskAdds.length, 0);

  console.log(`\n通过 ${pass} / 失败 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
