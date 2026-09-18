// 云函数 payService —— 微信小程序个人虚拟支付（解锁 12 星座付费形象 / 全家桶一次买断）
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
const { PET_CATALOG, SINGLE_PRICE, BUNDLE_PRICE, bundlePatch } = require('./pets');
const cfg = require('./config');

// 沙箱开关：env=1 + 沙箱 AppKey 仅用于开发者工具模拟器免费用测；现网(env=0)用现网 AppKey
const USE_SANDBOX = !!cfg.useSandbox;
const PAY_ENV = USE_SANDBOX ? 1 : 0;
const SIGN_KEY = USE_SANDBOX && cfg.sandboxAppKey ? cfg.sandboxAppKey : cfg.appKey;

// wx.requestVirtualPayment 对应的签名 URI（文档 5.5）
const URI = 'requestVirtualPayment';

// 全家桶「已拥有 N 只」的档位上限：补差价补到 0 就没必要再卖了
const BUNDLE_MAX_OWNED = Math.ceil(BUNDLE_PRICE / SINGLE_PRICE) - 1;

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

// 道具 ID 是否还是占位符（未在 MP 后台建道具前，明确报错而不是发一个必定失败的支付）
function isPlaceholder(id) {
  return !id || id.startsWith('PRODUCT_ID_') || id.startsWith('YOUR_') || id.indexOf('PLACEHOLDER') >= 0;
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

// 发货（幂等）：订单里该给哪些伙伴就写哪些。单只订单发货键 = pet_key；
// 全家桶订单在 createOrder 时就把「要解锁的清单」固化进 grant_keys，
// 所以这里（以及 payNotify）都不需要再读宠物目录，少一处会漂移的耦合。
async function deliver(o) {
  const keys = (Array.isArray(o.grant_keys) && o.grant_keys.length) ? o.grant_keys : [o.pet_key];
  const up = await db.collection('user_pets').where({ openid: o.openid }).get();
  const have = new Set(up.data.map((x) => x.pet_key));
  let added = 0;
  for (const k of keys) {
    if (!k || k === 'orange' || have.has(k)) continue;
    await db.collection('user_pets').add({ data: { openid: o.openid, pet_key: k, unlocked_at: new Date() } });
    added++;
  }
  return { keys, added };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, error: '未登录' };

  const { action = 'createOrder' } = event;

  switch (action) {
    case 'createOrder': {
      const { petKey, code, bundle } = event;

      // —— 全家桶：一次买断剩余全部星座伙伴，按已拥有数量补差价 ——
      if (bundle) {
        const paid = PET_CATALOG.filter((p) => !p.free);
        const up = await db.collection('user_pets').where({ openid: OPENID }).get();
        const have = new Set(up.data.map((x) => x.pet_key));
        const missing = paid.filter((p) => !have.has(p.key)).map((p) => p.key);
        if (!missing.length) return { ok: true, allOwned: true };

        const ownedCount = paid.length - missing.length;
        if (ownedCount > BUNDLE_MAX_OWNED) return { ok: false, error: '你已经集齐得差不多了，剩下的单独解锁就好' };
        const patch = bundlePatch(ownedCount);
        if (patch <= 0) return { ok: false, error: '你已经集齐得差不多了，剩下的单独解锁就好' };

        const productId = (cfg.bundleMap || {})[ownedCount];
        if (isPlaceholder(productId)) {
          return { ok: false, error: `未配置「全家桶补 ¥${patch}」的道具ID，请先在 MP 后台【道具管理】创建并发布道具（道具ID 要与 cloud/payService/config.js 的 bundleMap 一致）` };
        }
        if (!code) return { ok: false, error: '缺少 login code，无法生成用户态签名' };
        let sessionKey;
        try { sessionKey = await getSessionKey(code); }
        catch (e) { return { ok: false, error: e.message }; }

        const amount = patch * 100; // 分，需与 MP 后台该档位道具价格一致
        const outTradeNo = genOutTradeNo();
        const attach = JSON.stringify({ bundle: true, openid: OPENID, ownedCount });

        const signData = buildSignData({
          offerId: cfg.offerId,
          buyQuantity: 1,
          env: PAY_ENV,
          currencyType: 'CNY',
          productId,
          goodsPrice: amount,
          outTradeNo,
          attach
        });
        const paySig = hmacSha256(SIGN_KEY, URI + '&' + signData);
        const signature = hmacSha256(sessionKey, signData);

        await db.collection('orders').add({
          data: {
            openid: OPENID,
            order_id: outTradeNo,
            pet_key: '__bundle__',
            bundle: true,
            bundle_owned: ownedCount,
            grant_keys: missing,   // 发货依据：本次要解锁的伙伴清单
            amount,
            product_id: productId,
            status: 'created',
            created_at: new Date()
          }
        });

        return {
          ok: true,
          orderId: outTradeNo,
          bundle: true,
          patch,
          payData: { signData, mode: 'short_series_goods', paySig, signature }
        };
      }

      // —— 单只买断 ——
      const target = PET_CATALOG.find((p) => p.key === petKey);
      if (!target || target.free) return { ok: false, error: '宠物不可用或已免费' };

      const productId = cfg.productMap[petKey];
      // 放行真实道具 ID（如 zodiac_aries，与 MP 后台【道具管理】一致）；仅拦截尚未替换的占位符
      if (isPlaceholder(productId)) {
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
        env: PAY_ENV,
        currencyType: 'CNY',
        productId,
        goodsPrice: amount,
        outTradeNo,
        attach
      });
      const paySig = hmacSha256(SIGN_KEY, URI + '&' + signData);
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
      const alreadyPaid = o.status === 'paid';

      await db.collection('orders').doc(o._id).update({
        data: {
          status: 'paid',
          wx_order_id: wxOrderId || o.wx_order_id || '',
          paid_at: o.paid_at || new Date()
        }
      });
      await deliver(o);

      return { ok: true, alreadyPaid, petKey: o.pet_key, bundle: !!o.bundle };
    }

    case 'query': {
      // 兜底查单（文档 5.4.2）：推送丢失时主动查单补发货
      const { orderId } = event;
      const ord = await db.collection('orders').where({ order_id: orderId, openid: OPENID }).get();
      if (!ord.data.length) return { ok: false, error: '订单不存在' };
      const o = ord.data[0];

      const bodyObj = { openid: OPENID, env: PAY_ENV, order_id: orderId };
      const body = JSON.stringify(bodyObj);
      const pay_sig = hmacSha256(SIGN_KEY, '/xpay/query_order&' + body);
      let resp;
      try { resp = await httpsPostJson('https://api.weixin.qq.com/xpay/query_order', body, pay_sig); }
      catch (e) { return { ok: true, paid: false, order: o }; }

      if (isPaid(resp)) {
        await db.collection('orders').doc(o._id).update({ data: { status: 'paid', wx_order_id: (resp.data && resp.data.wx_order_id) || '', paid_at: o.paid_at || new Date() } });
        await deliver(o);
        return { ok: true, paid: true, petKey: o.pet_key, bundle: !!o.bundle };
      }
      return { ok: true, paid: false, order: o };
    }

    default:
      return { ok: false, error: '未知 action: ' + action };
  }
};
