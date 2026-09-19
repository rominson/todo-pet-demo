// 云函数 petService —— 宠物目录 + 拥有/解锁/切换
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();
const { PET_CATALOG, SINGLE_PRICE, BUNDLE_PRICE } = require('./pets');

// 演示解锁（unlock / unlockAll，不花钱直接给）的总闸。
// 云函数无法分辨调用方是正式版还是开发版，所以用一个环境变量兜底：
//   · 变量不存在 或 != '0'  → 放行（开发/体验版靠它免付款测 UI）
//   · 变量 = '0'            → 关闸（上线前在云函数「函数配置 → 环境变量」里加 DEMO_UNLOCK=0）
// 关闸后 unlock/unlockAll 直接报错，正式版的伙伴只可能来自真实支付发货。
const DEMO_UNLOCK_OFF = process.env.DEMO_UNLOCK === '0';

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
      if (DEMO_UNLOCK_OFF) return { ok: false, error: '演示解锁已关闭' };
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
      if (DEMO_UNLOCK_OFF) return { ok: false, error: '演示解锁已关闭' };
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
    // 已付满封顶价（已拥有 ≥ 6 只 = 已付 ≥ ¥36）时，把剩下的一并补齐，不再收钱。
    // 全家的口径就是「集齐 12 只最多花 ¥36」：够封顶了就不该再让用户逐只补票。
    // ⚠️ 条件完全由服务端按 user_pets 实算，不看前端传参；正式版这些行只可能来自真实支付发货。
    case 'claimBundleRemainder': {
      const paid = PET_CATALOG.filter(p => !p.free);
      const up = await db.collection('user_pets').where({ openid: OPENID }).get();
      const have = new Set(up.data.map(x => x.pet_key));
      const ownedCount = paid.filter(p => have.has(p.key)).length;
      const missing = paid.filter(p => !have.has(p.key));
      if (!missing.length) return { ok: true, already: true, added: 0 };
      if (ownedCount * SINGLE_PRICE < BUNDLE_PRICE) {
        return { ok: false, error: '还没到封顶价，请走全家桶补差价下单' };
      }
      for (const p of missing) {
        await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: p.key, unlocked_at: new Date() } });
      }
      return { ok: true, added: missing.length };
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
