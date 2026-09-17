// 微信小程序个人虚拟支付配置
// ⚠️ 三个密钥已迁移到云函数「环境变量」（不在代码/仓库中，重部署也不丢）：
//   PAY_APP_SECRET / PAY_OFFER_ID / PAY_APP_KEY
//   设置方式二选一：
//   ① CloudBase 控制台 → 云函数 payService → 配置 → 环境变量
//   ② cloudbaserc.json 的 functions[].envVariables 部署时注入
//   本地调试若无环境变量，fallback 为占位符，支付时因校验失败被拦截（不会泄露）。
// 非密钥项（appid / productMap）保留在代码中，非敏感。
module.exports = {
  appid: 'wx538ee0892e9e7b2f',
  appSecret: process.env.PAY_APP_SECRET || 'YOUR_APP_SECRET_HERE',

  offerId: process.env.PAY_OFFER_ID || 'YOUR_OFFER_ID_HERE',
  appKey: process.env.PAY_APP_KEY || 'YOUR_APP_KEY_HERE', // 用「现网 AppKey」，不要用沙箱密钥

  // 宠物 key → 虚拟支付「道具」ID。
  // 建议 12 个星座道具的 productId 命名为 zodiac_aries / zodiac_taurus ...（与这里一致即可，名字随意）
  // 每个星座宠物在后台建一个道具，价格 ¥6（= 600 分，与 pets.js 中 price 一致）。
  productMap: {
    aries: 'zodiac_aries',
    taurus: 'zodiac_taurus',
    gemini: 'zodiac_gemini',
    cancer: 'zodiac_cancer',
    leo: 'zodiac_leo',
    virgo: 'zodiac_virgo',
    libra: 'zodiac_libra',
    scorpio: 'zodiac_scorpio',
    sagittarius: 'zodiac_sagittarius',
    capricorn: 'zodiac_capricorn',
    aquarius: 'zodiac_aquarius',
    pisces: 'zodiac_pisces'
  }
};
