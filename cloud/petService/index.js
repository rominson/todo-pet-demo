// 云函数 petService —— 宠物目录 + 拥有/解锁/切换
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();
const { PET_CATALOG } = require('./pets');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'getCatalog' } = event;

  switch (action) {
    case 'getCatalog': {
      return { ok: true, catalog: PET_CATALOG };
    }
    case 'getMine': {
      const up = await db.collection('user_pets').where({ openid: OPENID }).get();
      const owned = ['orange', ...up.data.map(x => x.pet_key)];
      const user = await db.collection('users').where({ openid: OPENID }).get();
      const current = user.data[0] ? user.data[0].current_pet : 'orange';
      const catalog = PET_CATALOG.map(p => ({ ...p, owned: owned.includes(p.key) }));
      return { ok: true, catalog, owned, current };
    }
    case 'unlock': {
      const { petKey } = event;
      const target = PET_CATALOG.find(p => p.key === petKey);
      if (!target) return { ok: false, error: '未知宠物' };
      const up = await db.collection('user_pets').where({ openid: OPENID, pet_key: petKey }).get();
      if (up.data.length) return { ok: true, already: true };
      await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: petKey, unlocked_at: new Date() } });
      return { ok: true };
    }
    case 'setCurrent': {
      const { petKey } = event;
      if (!PET_CATALOG.find(p => p.key === petKey)) return { ok: false, error: '未知宠物' };
      await db.collection('users').where({ openid: OPENID }).update({ data: { current_pet: petKey } });
      return { ok: true };
    }
    default:
      return { ok: false, error: '未知 action: ' + action };
  }
};
