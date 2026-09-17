// pages/pets/pets.js —— 星座伙伴：目录 / 解锁 / 切换（对齐原型 screen-store）
const cloud = require('../../utils/cloud.js');
const { PET_META, ZODIAC_TRAITS, zodiacOf } = require('../../utils/pets.js');

// 是否「正式版」：正式版(envVersion==='release')强制走真实支付，开发/体验版允许免费解锁演示。
// 这样提审发布后自动变真实扣款，不怕忘记手动改开关。
const IS_RELEASE = (() => {
  try { return wx.getAccountInfoSync().miniProgram.envVersion === 'release'; } catch (e) { return false; }
})();
// ⚠️ 开发/体验版：点「¥6 解锁」直接调 petService.unlock 本地标记已拥有，不调 wx.requestVirtualPayment、不扣钱（测 UI 用）。
//    正式版 IS_RELEASE 为 true → 强制走真实支付（真扣 ¥6）。
//    如需在开发/体验版临时强制真实支付，可在 devtools 执行 wx.setStorageSync('FORCE_REAL_PAY', true)。
const DEV_DEMO = !IS_RELEASE && !wx.getStorageSync('FORCE_REAL_PAY');
// 真实支付链路（DEV_DEMO=false）：createOrder → wx.requestVirtualPayment → payNotify 发货（云函数侧 PAY_USE_SANDBOX=1 可在开发者工具模拟器走沙箱免费用测）。

Page({
  data: {
    pets: [],
    ownedCount: 0,
    currentKey: 'orange',
    currentPet: { emoji: '🐱', name: '橘小满', color: '#ff8a3d' },
    birthKey: '',
    birthZodiac: null,
    detail: null
  },

  onShow() { this.load(); },

  async load() {
    try {
      const [cat, mine] = await Promise.all([
        cloud.petService.getCatalog(),
        cloud.petService.getMine()
      ]);
      const ownedSet = new Set(mine.owned || ['orange']);
      const current = mine.current || 'orange';
      const pets = (cat.catalog || []).map((p) => {
        const meta = PET_META[p.key] || {};
        const owned = ownedSet.has(p.key);
        return {
          key: p.key,
          price: p.price,
          emoji: meta.emoji,
          scene: meta.scene,
          color: meta.color,
          animal: meta.animal,
          name: p.name,                              // 星座名（白羊）
          zodiacName: (p.name || '') + '座',         // 白羊座
          traits: ZODIAC_TRAITS[p.key] || '',        // 活力 · 冲动
          owned,
          isCurrent: p.key === current
        };
      });

      let birthKey = '';
      let birthZodiac = null;
      const b = wx.getStorageSync('birthday'); // { m, d }
      if (b && b.m && b.d) {
        const z = zodiacOf(b.m, b.d);
        birthKey = z.key;
        birthZodiac = { name: z.name, key: z.key, owned: ownedSet.has(z.key) };
      }

      this.setData({
        pets,
        ownedCount: pets.filter((x) => x.owned).length,
        currentKey: current,
        currentPet: PET_META[current] || PET_META.orange,
        birthKey,
        birthZodiac
      });
    } catch (e) {}
  },

  onTap(e) {
    const key = e.currentTarget.dataset.key;
    const p = this.data.pets.find((x) => x.key === key);
    if (p) this.setData({ detail: p });
  },
  closeDetail() { this.setData({ detail: null }); },
  noop() {},

  async doSetCurrent(e) {
    const key = e.currentTarget.dataset.key;
    try {
      await cloud.petService.setCurrent(key);
      getApp().globalData.currentPet = key;
      // 同步更新 pets 数组里各卡片的 isCurrent，使高亮跟随切换后的当前伙伴
      const pets = this.data.pets.map((p) => ({ ...p, isCurrent: p.key === key }));
      this.setData({ currentKey: key, currentPet: PET_META[key] || PET_META.orange, pets, detail: null });
      wx.showToast({ title: '已切换', icon: 'none' });
    } catch (err) {}
  },

  async doUnlock(e) {
    const key = e.currentTarget.dataset.key;
    if (DEV_DEMO) {
      wx.showLoading({ title: '解锁中' });
      try {
        await cloud.petService.unlock(key);
        await this.load();
        getApp().globalData.currentPet = key;
        this.setData({ detail: null });
        wx.showToast({ title: '已演示解锁', icon: 'none' });
      } catch (err) {} finally { wx.hideLoading(); }
      return;
    }
    wx.showLoading({ title: '下单中' });
    try {
      const { code } = await this.wxLogin();
      const order = await cloud.payService.createOrder(key, code);
      if (order.alreadyOwned) {
        await cloud.petService.unlock(key);
      } else {
        await this.realPay(order, key);
      }
      await this.load();
      getApp().globalData.currentPet = key;
      this.setData({ detail: null });
      wx.showToast({ title: '解锁成功', icon: 'none' });
    } catch (err) {
      // cloud 封装已 toast
    } finally {
      wx.hideLoading();
    }
  },

  // 取 login code（用于服务端生成用户态签名 signature）
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({ success: (r) => (r.code ? resolve(r) : reject(new Error('wx.login 失败'))), fail: reject });
    });
  },

  // iOS 需微信客户端 ≥ 8.0.68（文档 5.3）
  checkIosVersion() {
    const sys = wx.getSystemInfoSync();
    if (sys.platform !== 'ios') return true;
    const cur = (sys.version || '').split('.').map(Number);
    const base = [8, 0, 68];
    for (let i = 0; i < 3; i++) {
      if ((cur[i] || 0) > base[i]) return true;
      if ((cur[i] || 0) < base[i]) {
        wx.showModal({ title: '提示', content: '请将微信更新至最新版后再进行支付', showCancel: false });
        return false;
      }
    }
    return true;
  },

  realPay(order, key) {
    return new Promise((resolve, reject) => {
      if (!this.checkIosVersion()) { reject(new Error('iOS 版本过低')); return; }
      const payData = order.payData || {};
      wx.requestVirtualPayment({
        ...payData,
        success: async () => {
          try {
            await cloud.payService.confirmPay(order.orderId);
            resolve();
          } catch (e) { reject(e); }
        },
        fail: (err) => reject(err)
      });
    });
  }
});
