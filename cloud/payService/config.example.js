// 微信小程序个人虚拟支付配置（模板，已提交到仓库，不含任何密钥）
// ⚠️ 复制本文件为 config.js 后填入真实值：cp config.example.js config.js
//   - AppSecret：MP 后台(mp.weixin.qq.com) → 开发管理 → 开发设置 → AppSecret
//   - OfferID / 现网 AppKey：MP 后台 → 虚拟支付 → 基本配置
//   - productMap：MP 后台 → 虚拟支付 → 道具管理 创建 12 个星座道具（各 ¥6）后，把后台生成的「道具 ID」替换下面 zodiac_<key> 占位
// 注意：config.js 已被 .gitignore 忽略，切勿将其提交到仓库。
module.exports = {
  appid: 'wx538ee0892e9e7b2f',
  appSecret: 'YOUR_APP_SECRET_HERE',

  offerId: 'YOUR_OFFER_ID_HERE',
  appKey: 'YOUR_APP_KEY_HERE', // 用「现网 AppKey」，不要用沙箱密钥

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
