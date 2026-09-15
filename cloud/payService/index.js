// 云函数 payService —— 微信小程序虚拟支付（解锁 12 星座付费形象）
// 阶段4 会在此细化虚拟支付接入；此处先落地订单数据模型与解锁逻辑骨架。
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();
const { PET_CATALOG } = require('./pets');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'createOrder' } = event;

  switch (action) {
    case 'createOrder': {
      const { petKey } = event;
      const target = PET_CATALOG.find(p => p.key === petKey);
      if (!target || target.free) return { ok: false, error: '宠物不可用或已免费' };

      // 已拥有则直接返回，避免重复下单
      const up = await db.collection('user_pets').where({ openid: OPENID, pet_key: petKey }).get();
      if (up.data.length) return { ok: true, alreadyOwned: true, petKey };

      const amount = target.price * 100; // 微信支付金额单位：分
      const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      await db.collection('orders').add({
        data: {
          openid: OPENID,
          order_id: orderId,
          pet_key: petKey,
          amount,
          status: 'created',
          created_at: new Date()
        }
      });
      // 前端拿 orderId + amount 调 wx.requestVirtualPayment 拉起支付
      // 微信支付成功回调（小程序后台配置 notify 地址 → 云函数）→ 调 confirmPay 解锁
      return { ok: true, orderId, amount, petKey };
    }
    case 'confirmPay': {
      const { orderId } = event;
      const ord = await db.collection('orders').where({ order_id: orderId, openid: OPENID }).get();
      if (!ord.data.length) return { ok: false, error: '订单不存在' };
      const o = ord.data[0];
      if (o.status === 'paid') {
        // 幂等：已支付但未写入 user_pets 时补写
        const up = await db.collection('user_pets').where({ openid: OPENID, pet_key: o.pet_key }).get();
        if (!up.data.length) {
          await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: o.pet_key, unlocked_at: new Date() } });
        }
        return { ok: true, alreadyPaid: true, petKey: o.pet_key };
      }
      await db.collection('orders').doc(o._id).update({ data: { status: 'paid', paid_at: new Date() } });
      await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: o.pet_key, unlocked_at: new Date() } });
      return { ok: true, petKey: o.pet_key };
    }
    case 'queryOrder': {
      const { orderId } = event;
      const ord = await db.collection('orders').where({ order_id: orderId, openid: OPENID }).get();
      return { ok: true, order: ord.data[0] || null };
    }
    default:
      return { ok: false, error: '未知 action: ' + action };
  }
};
