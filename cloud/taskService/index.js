// 云函数 taskService —— 待办清单 CRUD
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'list' } = event;
  const tasks = db.collection('tasks');

  switch (action) {
    case 'create': {
      const { title, tag = '', due = '', note = '' } = event;
      if (!title || !String(title).trim()) return { ok: false, error: '标题不能为空' };
      const res = await tasks.add({
        data: {
          openid: OPENID,
          title: String(title).trim(),
          tag, due, note,
          done: false,
          done_at: null,
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
      const nowDone = !cur.data.done;
      await tasks.doc(id).update({
        data: { done: nowDone, done_at: nowDone ? new Date() : null, updated_at: new Date() }
      });
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
