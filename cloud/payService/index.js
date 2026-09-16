// 云函数 payService —— 微信小程序个人虚拟支付（解锁 12 星座付费形象）
// 流程：
//   ① 前端 wx.login() 拿 code → createOrder（生成 outTradeNo + 双签名 payData）
//   ② 前端 wx.requestVirtualPayment(payData) 拉起支付
//   ③ 支付成功 → 平台推送 xpay_goods_deliver_notify 到 payNotify 云函数 → 幂等发货
//   ④ 推送丢失时 confirmPay / query 兜底发货
// ⚠️ 真机需先在 MP 后台开通虚拟支付、创建道具并配置 cloud/payService/config.js
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();
const crypto = require('crypto');
const https = require('https');
const { PET_CATALOG } = require('./pets');
const cfg = require('./config');

// wx.requestVirtualPayment 对应的签名 URI（文档 5.5）
const URI = 'requestVirtualPayment';

function hmacSha256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest('hex');
}

// 按文档 5.3 字段顺序构造 signData JSON（顺序敏感，不可改动）
function buildSignData(p) {
  return JSON.stringify({
    offerId: p.offerId,
    buyQuantity: p.buyQuantity,
    env: p.env,
    currencyType: p.currencyType,
    productId: p.productId,
    goodsPrice: p.goodsPrice,
    outTradeNo: p.outTradeNo,
    attach: p.attach
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function httpsPostJson(url, body, paySig) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body, 'utf8');
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        pay_sig: paySig
      }
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// code2Session 换取 session_key（signature 用户态签名需要，文档 7.4）
async function getSessionKey(code) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${cfg.appid}&secret=${cfg.appSecret}&js_code=${code}&grant_type=authorization_code`;
  const r = await httpsGet(url);
  if (!r || !r.session_key) throw new Error('code2Session 失败: ' + JSON.stringify(r));
  return r.session_key;
}

function genOutTradeNo() {
  // 8-32 位，不能下划线开头
  return 'T' + Date.now() + Math.floor(Math.random() * 1e6);
}

function isPaid(resp) {
  if (!resp || resp.errcode !== 0) return false;
  const d = resp.data || {};
  return d.state === 'PAID' || d.pay_state === 2 || d.paid === true || d.order_state === 'PAID';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'createOrder' } = event;

  switch (action) {
    case 'createOrder': {
      const { petKey, code } = event;
      const target = PET_CATALOG.find((p) => p.key === petKey);
      if (!target || target.free) return { ok: false, error: '宠物不可用或已免费' };

      const productId = cfg.productMap[petKey];
      // 放行真实道具 ID（如 zodiac_aries，与 MP 后台【道具管理】一致）；仅拦截尚未替换的占位符
      if (!productId || productId.startsWith('PRODUCT_ID_') || productId.startsWith('YOUR_') || productId === 'PRODUCT_ID_PLACEHOLDER') {
        return { ok: false, error: '未配置该宠物的虚拟支付道具ID，请先在 MP 后台【道具管理】创建并发布道具（道具ID 需与 cloud/payService/config.js 的 productMap 对应）' };
      }

      // 已拥有则直接返回，避免重复下单
      const owned = await db.collection('user_pets').where({ openid: OPENID, pet_key: petKey }).get();
      if (owned.data.length) return { ok: true, alreadyOwned: true, petKey };

      if (!code) return { ok: false, error: '缺少 login code，无法生成用户态签名' };
      let sessionKey;
      try { sessionKey = await getSessionKey(code); }
      catch (e) { return { ok: false, error: e.message }; }

      const amount = target.price * 100; // 分，需与 MP 后台道具价格一致
      const outTradeNo = genOutTradeNo();
      const attach = JSON.stringify({ petKey, openid: OPENID }); // 透传，发货时原样带回

      const signData = buildSignData({
        offerId: cfg.offerId,
        buyQuantity: 1,
        env: 0,
        currencyType: 'CNY',
        productId,
        goodsPrice: amount,
        outTradeNo,
        attach
      });
      const paySig = hmacSha256(cfg.appKey, URI + '&' + signData);
      const signature = hmacSha256(sessionKey, signData);

      await db.collection('orders').add({
        data: {
          openid: OPENID,
          order_id: outTradeNo,
          pet_key: petKey,
          amount,
          product_id: productId,
          status: 'created',
          created_at: new Date()
        }
      });

      return {
        ok: true,
        orderId: outTradeNo,
        payData: { signData, mode: 'short_series_goods', paySig, signature }
      };
    }

    case 'confirmPay': {
      // 兜底发货：前端 success 回调或定时查单后调用，幂等
      const { orderId, wxOrderId } = event;
      const ord = await db.collection('orders').where({ order_id: orderId, openid: OPENID }).get();
      if (!ord.data.length) return { ok: false, error: '订单不存在' };
      const o = ord.data[0];
      const up = await db.collection('user_pets').where({ openid: OPENID, pet_key: o.pet_key }).get();

      if (o.status === 'paid') {
        if (!up.data.length) {
          await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: o.pet_key, unlocked_at: new Date() } });
        }
        await db.collection('orders').doc(o._id).update({ data: { wx_order_id: wxOrderId || o.wx_order_id } });
        return { ok: true, alreadyPaid: true, petKey: o.pet_key };
      }

      await db.collection('orders').doc(o._id).update({ data: { status: 'paid', wx_order_id: wxOrderId || '', paid_at: new Date() } });
      if (!up.data.length) {
        await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: o.pet_key, unlocked_at: new Date() } });
      }
      return { ok: true, petKey: o.pet_key };
    }

    case 'query': {
      // 兜底查单（文档 5.4.2）：推送丢失时主动查单补发货
      const { orderId } = event;
      const ord = await db.collection('orders').where({ order_id: orderId, openid: OPENID }).get();
      if (!ord.data.length) return { ok: false, error: '订单不存在' };
      const o = ord.data[0];

      const bodyObj = { openid: OPENID, env: 0, order_id: orderId };
      const body = JSON.stringify(bodyObj);
      const pay_sig = hmacSha256(cfg.appKey, '/xpay/query_order&' + body);
      let resp;
      try { resp = await httpsPostJson('https://api.weixin.qq.com/xpay/query_order', body, pay_sig); }
      catch (e) { return { ok: true, paid: false, order: o }; }

      if (isPaid(resp)) {
        await db.collection('orders').doc(o._id).update({ data: { status: 'paid', wx_order_id: (resp.data && resp.data.wx_order_id) || '', paid_at: new Date() } });
        const up = await db.collection('user_pets').where({ openid: OPENID, pet_key: o.pet_key }).get();
        if (!up.data.length) {
          await db.collection('user_pets').add({ data: { openid: OPENID, pet_key: o.pet_key, unlocked_at: new Date() } });
        }
        return { ok: true, paid: true, petKey: o.pet_key };
      }
      return { ok: true, paid: false, order: o };
    }

    default:
      return { ok: false, error: '未知 action: ' + action };
  }
};
