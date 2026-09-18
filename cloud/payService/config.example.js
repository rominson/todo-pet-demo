// 微信小程序个人虚拟支付配置（模板，已提交到仓库，不含任何密钥）
// ⚠️ 三个密钥已迁移到云函数「环境变量」，不在代码/仓库中：
//   PAY_APP_SECRET / PAY_OFFER_ID / PAY_APP_KEY
//   设置方式：CloudBase 控制台 → 云函数 payService → 配置 → 环境变量
//            （或 cloudbasrc.json 的 functions[].envVariables 部署时注入）
//   - AppSecret：MP 后台(mp.weixin.qq.com) → 开发管理 → 开发设置 → AppSecret
//   - OfferID / 现网 AppKey：MP 后台 → 虚拟支付 → 基本配置
// 注意：config.js 现在只读取环境变量，不再写死密钥，可安全入库与部署。
module.exports = {
  appid: 'wx538ee0892e9e7b2f',
  appSecret: process.env.PAY_APP_SECRET || 'YOUR_APP_SECRET_HERE',

  offerId: process.env.PAY_OFFER_ID || 'YOUR_OFFER_ID_HERE',
  appKey: process.env.PAY_APP_KEY || 'YOUR_APP_KEY_HERE', // 用「现网 AppKey」，不要用沙箱密钥

  // 沙箱测试用（可选）：PAY_USE_SANDBOX=1 时切到 env=1 + 沙箱 AppKey，仅开发者工具模拟器可免费用测
  sandboxAppKey: process.env.PAY_SANDBOX_APP_KEY || '',
  useSandbox: process.env.PAY_USE_SANDBOX === '1',

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
  },

  // 全家桶（12 只一次买断，封顶 ¥36）用的道具 ID：按「已拥有数量」分档，价格 = 36 − 已拥有×6。
  // 需在 MP 后台【道具管理】另建 6 个道具，道具ID 与下面对应、价格必须与注释一致：
  //   已拥有 0 只→¥36  1 只→¥30  2 只→¥24  3 只→¥18  4 只→¥12  5 只→¥6
  // （已拥有 6 只以上，用户已付满封顶价，前端不再显示全家桶入口。）
  bundleMap: {
    0: 'zodiac_bundle_0',
    1: 'zodiac_bundle_1',
    2: 'zodiac_bundle_2',
    3: 'zodiac_bundle_3',
    4: 'zodiac_bundle_4',
    5: 'zodiac_bundle_5'
  }
};
