// 云函数 taskService —— 待办清单 CRUD
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'list' } = event;
const tasks = db.collection('tasks');

/* —— 日期工具：云函数时区不保证是 UTC+8，统一按「北京时间」做纯字符串运算 —— */
function pad(n) { return String(n).padStart(2, '0'); }
function todayStrCN() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
// 按重复频率算出下一条的日期；base 为空则从今天起算（UTC 运算，月末自动回退）
function nextDateStr(repeat, base) {
  const b = base ? new Date(base + 'T00:00:00Z') : new Date(todayStrCN() + 'T00:00:00Z');
  const oldDay = b.getUTCDate();
  const bump = (unit, n) => {
    if (unit === 'd') b.setUTCDate(b.getUTCDate() + n);
    else if (unit === 'w') b.setUTCDate(b.getUTCDate() + n * 7);
    else if (unit === 'm') {
      b.setUTCMonth(b.getUTCMonth() + n);
      if (b.getUTCDate() !== oldDay) b.setUTCDate(0); // 1/31 +1月 → 2/28
    }
  };
  if (repeat === 'daily') bump('d', 1);
  else if (repeat === 'weekly') bump('w', 1);
  else if (repeat === 'monthly') bump('m', 1);
  else if (repeat && repeat.startsWith('custom:')) {
    const m = repeat.match(/custom:(\d+)([dwm])/);
    if (m) bump(m[2], parseInt(m[1], 10));
  } else return base || todayStrCN();
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`;
}

  switch (action) {
    case 'create': {
      const { title, tag = '', due = '', note = '', type = 'normal', important = false, repeat = 'none' } = event;
      if (!title || !String(title).trim()) return { ok: false, error: '标题不能为空' };
      const res = await tasks.add({
        data: {
          openid: OPENID,
          title: String(title).trim(),
          tag, due, note, type, repeat,
          important: !!important,
          done: false,
          done_at: null,
          gen_id: null, // 完成后自动生成的下一条（撤销时回收，避免反复勾选堆积）
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      return { ok: true, id: res._id };
    }
    case 'list': {
      const res = await tasks
        .where({ openid: OPENID })
        .orderBy('done', 'asc')
        .orderBy('created_at', 'desc')
        .get();
      return { ok: true, list: res.data };
    }
    case 'update': {
      const { id, ...patch } = event;
      if (!id) return { ok: false, error: '缺少 id' };
      const safe = { ...patch };
      delete safe.id; delete safe.action; delete safe.openid;
      await tasks.doc(id).update({ data: { ...safe, updated_at: new Date() } });
      return { ok: true };
    }
    case 'toggle': {
      const { id } = event;
      if (!id) return { ok: false, error: '缺少 id' };
      const cur = await tasks.doc(id).get();
      const t = cur.data || {};
      const nowDone = !t.done;
      if (nowDone) {
        let genId = t.gen_id || null;
        // 重复任务：完成当天后自动生成下一条（频率决定日期，时间不继承）；已生成过则不再重复生成
        if (t.repeat && t.repeat !== 'none' && !genId) {
          const add = await tasks.add({
            data: {
              openid: OPENID,
              title: t.title,
              tag: t.tag || '',
              due: nextDateStr(t.repeat, t.due),
              note: t.note || '',
              type: t.type || 'normal',
              repeat: t.repeat,
              important: !!t.important,
              done: false,
              done_at: null,
              gen_id: null,
              gen_from: id,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          genId = add._id;
        }
        await tasks.doc(id).update({
          data: { done: true, done_at: new Date(), gen_id: genId, updated_at: new Date() }
        });
      } else {
        // 撤销完成：回收本次完成自动生成的那条（若还没被勾掉），再反复勾选也不会堆积
        if (t.gen_id) {
          try {
            const child = await tasks.doc(t.gen_id).get();
            if (child && child.data && !child.data.done) await tasks.doc(t.gen_id).remove();
          } catch (e) { /* 已被删除或已独立完成：忽略 */ }
        }
        await tasks.doc(id).update({
          data: { done: false, done_at: null, gen_id: null, updated_at: new Date() }
        });
      }
      return { ok: true, done: nowDone };
    }
    case 'remove': {
      const { id } = event;
      if (!id) return { ok: false, error: '缺少 id' };
      await tasks.doc(id).remove();
      return { ok: true };
    }
    case 'clearDone': {
      await tasks.where({ openid: OPENID, done: true }).remove();
      return { ok: true };
    }
    default:
      return { ok: false, error: '未知 action: ' + action };
  }
};
