// 云函数 sessionService —— 陪伴对话历史 + 足迹时间线
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'getHistory' } = event;

  switch (action) {
    case 'saveMessage': {
      const { role, content, pet = 'orange' } = event;
      if (!content) return { ok: false, error: 'content 不能为空' };
      const res = await db.collection('sessions').add({
        data: { openid: OPENID, role, content, pet, created_at: new Date() }
      });
      return { ok: true, id: res._id };
    }
    case 'getHistory': {
      const { limit = 30, pet } = event;
      let q = db.collection('sessions').where({ openid: OPENID });
      if (pet) q = q.where({ pet });
      const res = await q.orderBy('created_at', 'desc').limit(limit).get();
      return { ok: true, list: res.data.reverse() };
    }
    case 'addFootprint': {
      const { type, content, pet = 'orange' } = event;
      const res = await db.collection('footprints').add({
        data: { openid: OPENID, type, content, pet, created_at: new Date() }
      });
      return { ok: true, id: res._id };
    }
    case 'getFootprints': {
      const { limit = 50 } = event;
      const res = await db.collection('footprints')
        .where({ openid: OPENID })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();
      return { ok: true, list: res.data };
    }
    default:
      return { ok: false, error: '未知 action: ' + action };
  }
};
