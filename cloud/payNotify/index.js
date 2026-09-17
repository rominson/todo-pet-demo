// 云函数 payNotify —— 接收微信虚拟支付「发货推送」（HTTP 触发）
// MP 后台【消息推送】把虚拟支付事件指向本函数（云开发 HTTP 触发）。
// 文档 5.4.1：解析 xpay_goods_deliver_notify → 按 outTradeNo 幂等发货 → 返回 XML<ErrCode>0</ErrCode>
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();

// MP 后台「消息推送」配置的 Token。优先读云函数环境变量 MP_TOKEN（已迁移，密钥不落代码/仓库）；
// 本地调试可放 token.json 兜底，但生产以环境变量为准。
let MP_TOKEN = process.env.MP_TOKEN || '';
try { MP_TOKEN = MP_TOKEN || require('./token.json').MP_TOKEN; } catch (e) { /* 未配置 */ }

// 微信「启用消息推送」时的 URL 验证：sha1(sort(token,timestamp,nonce)) === signature → 原样返回 echostr
function verifyEchostr(qs) {
  if (!qs) return null;
  const { signature, timestamp, nonce, echostr } = qs;
  if (!signature || !timestamp || !nonce || !echostr || !MP_TOKEN) return null;
  const sha1 = crypto.createHash('sha1')
    .update([MP_TOKEN, timestamp, nonce].sort().join(''))
    .digest('hex');
  return sha1 === signature ? echostr : null;
}

function xmlVal(xml, tag) {
  if (!xml) return '';
  const m = xml.match(new RegExp('<' + tag + '>(?:\\s*<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</' + tag + '>'));
  return m ? m[1].trim() : '';
}
function between(xml, open, close) {
  const i = xml.indexOf(open);
  if (i < 0) return '';
  const j = xml.indexOf(close, i);
  return j < 0 ? '' : xml.substring(i + open.length, j);
}
function xmlResp(code) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<xml><ErrCode>${code}</ErrCode><ErrMsg><![CDATA[success]]></ErrMsg></xml>`
  };
}

exports.main = async (event) => {
  // ---- GET：微信消息推送「启用」时的 URL 验证握手 ----
  const qs = (event && (event.queryStringParameters || event.queryString)) || {};
  const isGet = (event && (event.httpMethod || '').toUpperCase() === 'GET') || (qs.echostr && !(event && event.body));
  if (isGet && qs.echostr) {
    const echo = verifyEchostr(qs);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: echo || 'fail'
    };
  }
  // ---- POST：虚拟支付发货推送（XML） ----
  const raw = typeof event === 'string' ? event : (event && event.body) || '';
  const outTradeNo = xmlVal(raw, 'OutTradeNo');

  // 无单号直接回 0，避免平台重试风暴
  if (!outTradeNo) return xmlResp(0);

  try {
    const ord = await db.collection('orders').where({ order_id: outTradeNo }).get();
    if (!ord.data.length) return xmlResp(0); // 未知订单，回 0 防止无限重试
    const o = ord.data[0];

    // 幂等：已发货也直接回 0
    const up = await db.collection('user_pets').where({ openid: o.openid, pet_key: o.pet_key }).get();
    const wxBlock = between(raw, '<WeChatPayInfo>', '</WeChatPayInfo>');
    const wxOrderId = wxBlock ? xmlVal(wxBlock, 'MchOrderNo') : xmlVal(raw, 'MchOrderNo');

    await db.collection('orders').doc(o._id).update({ data: { status: 'paid', wx_order_id: wxOrderId, paid_at: new Date() } });
    if (!up.data.length) {
      await db.collection('user_pets').add({ data: { openid: o.openid, pet_key: o.pet_key, unlocked_at: new Date() } });
    }
  } catch (e) {
    // 出错仍回 0（平台会重试）；如需排查可在此记录 e
    return xmlResp(0);
  }
  return xmlResp(0);
};
