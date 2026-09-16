// 微信小程序个人虚拟支付配置
// ⚠️ 以下为占位，需在小程序 MP 后台获取后填入真实值：
//   - AppSecret：MP 后台 → 开发管理 → 开发设置（仅服务端使用，切勿泄露到前端）
//   - OfferID / 现网 AppKey：MP 后台 → 虚拟支付 → 基本配置
//   - productMap：MP 后台 → 虚拟支付 → 道具管理 创建道具后，把道具 ID 填到对应 key
// 开通条件：个人主体 + 服务类目含「工具」+ 已认证备案；月支付限额 10 万元。
module.exports = {
  appid: 'wx538ee0892e9e7b2f',
  appSecret: 'YOUR_APP_SECRET_HERE',

  offerId: 'YOUR_OFFER_ID_HERE',
  appKey: 'YOUR_APP_KEY_HERE', // 用「现网 AppKey」，不要用沙箱密钥

  // 宠物 key → 虚拟支付「道具」ID。每个星座宠物需在后台建一个道具（价格与 pets.js 中 price 一致，单位分）。
  productMap: {
    aries: 'PRODUCT_ID_aries',
    taurus: 'PRODUCT_ID_taurus',
    gemini: 'PRODUCT_ID_gemini',
    cancer: 'PRODUCT_ID_cancer',
    leo: 'PRODUCT_ID_leo',
    virgo: 'PRODUCT_ID_virgo',
    libra: 'PRODUCT_ID_libra',
    scorpio: 'PRODUCT_ID_scorpio',
    sagittarius: 'PRODUCT_ID_sagittarius',
    capricorn: 'PRODUCT_ID_capricorn',
    aquarius: 'PRODUCT_ID_aquarius',
    pisces: 'PRODUCT_ID_pisces'
  }
};
