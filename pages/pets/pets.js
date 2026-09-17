// pages/pets/pets.js —— 宠物商店：目录 / 解锁 / 切换
const cloud = require('../../utils/cloud.js');
const { PET_META, zodiacOf } = require('../../utils/pets.js');

// 已接入真实虚拟支付：设为 false 走 createOrder → wx.requestVirtualPayment → payNotify 发货。
// 云函数侧通过 PAY_USE_SANDBOX=1 可切到沙箱(env=1)免费用开发者工具模拟器跑通。
const DEV_DEMO = false;

Page({
  data: {
    pets: [],
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
        return { ...p, emoji: meta.emoji, color: meta.color, animal: meta.animal, owned: ownedSet.has(p.key) };
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
      this.setData({ currentKey: key, currentPet: PET_META[key] || PET_META.orange, detail: null });
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
