// 云函数 petService —— 宠物目录 + 拥有/解锁/切换
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();
const { PET_CATALOG, SINGLE_PRICE, BUNDLE_PRICE } = require('./pets');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'getCatalog' } = event;

  switch (action) {
    case 'getCatalog': {
      // prices 一并下发，前端不写死金额（全家桶的补差价由前端按 single/bundle 现算，服务端下单时再校验一次）
      return { ok: true, catalog: PET_CATALOG, prices: { single: SINGLE_PRICE, bundle: BUNDLE_PRICE } };
    }
    case 'getMine': {
      const up = await db.collection('user_pets').where({ openid: OPENID }).get();
      const owned = ['orange', ...up.data.map(x => x.pet_key)];
      const user = await db.collection('users').where({ openid: OPENID }).get();
      const current = user.data[0] ? user.data[0].current_pet : 'orange';
      const catalog = PET_CATALOG.map(p => ({ ...p, owned: owned.includes(p.key) }));
      return { ok: true, catalog, owned, current, prices: { single: SINGLE_PRICE, bundle: BUNDLE_PRICE } };
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
    // 一键解锁全部付费伙伴。⚠️ 仅供开发/体验版的演示路径（DEV_DEMO）使用，
    // 正式版必须经 payService 下单 → 微信虚拟支付 → payNotify 发货，不能走这里白拿。
    case 'unlockAll': {
      const paid = PET_CATALOG.filter(p => !p.free);
      const up = await db.collection('user_pets').where({ openid: OPENID }).get();
      const have = new Set(up.data.map(x => x.pet_key));
      let added = 0;
      for (const p of paid) {
        if (have.has(p.key)) continue;
        await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: p.key, unlocked_at: new Date() } });
        added++;
      }
      return { ok: true, added };
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
