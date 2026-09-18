// pages/pets/pets.js —— 星座伙伴：目录 / 解锁 / 切换（对齐原型 screen-store）
const cloud = require('../../utils/cloud.js');
const { PET_META, ZODIAC_TRAITS } = require('../../utils/pets.js');

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

// 卡片左下角 pill / 弹层按钮的三态文案（对齐原型 renderStore 的 .a-price 与 openAnimal 的 #animal-buy-btn）：
//   未拥有 → 「¥6 解锁」   已拥有但没在用 → 「让它陪我」   正在陪 → 「陪伴中」
// 注：原型这里写的是「使用中」，用户指定用「陪伴中」，故偏离原型一处。
function pillOf(owned, isCurrent) {
  if (!owned) return '¥6 解锁';
  return isCurrent ? '陪伴中' : '让它陪我';
}

Page({
  data: {
    pets: [],
    ownedCount: 0,
    currentKey: 'orange',
    currentPet: { emoji: '🐱', name: '橘小满', color: '#ff8a3d' },
    activeIdx: 0,
    scrollLeft: 0
  },

  onShow() {
    this.setTab(4);
    this.load();
  },

  // 自定义 tabBar：每个 tab 页各有一个组件实例，选中态要在 onShow 里同步
  setTab(i) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: i });
    }
  },

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
        const isCurrent = p.key === current;
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
          isCurrent,
          pillText: pillOf(owned, isCurrent)
        };
      });

      // 当前伙伴只以服务端为准；同步到 globalData，避免「解锁后本地以为换了、服务端没换」的不一致
      getApp().globalData.currentPet = current;

      this.setData({
        pets,
        ownedCount: pets.filter((x) => x.owned).length,
        currentKey: current,
        currentPet: PET_META[current] || PET_META.orange
      });
      // 卡片间距测量（用于滚动同步圆点 / 点圆点定位），等布局完成后测
      wx.nextTick(() => this.measurePitch());
    } catch (e) {}
  },

  // —— 轮播同步（对齐原型：滚动时高亮卡片+圆点跟随）——
  measurePitch() {
    wx.createSelectorQuery().in(this)
      .selectAll('.animal-card')
      .boundingClientRect()
      .exec((res) => {
        const rects = res && res[0];
        if (rects && rects.length > 1) {
          this.cardW = rects[0].width;
          this.pitch = rects[1].left - rects[0].left; // 卡宽 + 间距
        }
      });
  },

  onTrackScroll(e) {
    if (!this.pitch) return;
    const n = this.data.pets.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round(e.detail.scrollLeft / this.pitch)));
    if (idx !== this.data.activeIdx) this.setData({ activeIdx: idx });
  },

  goDot(e) {
    const idx = e.currentTarget.dataset.idx;
    if (!this.pitch) return;
    this.setData({ scrollLeft: idx * this.pitch, activeIdx: idx });
  },

  // 卡片左下角那颗 pill 是本页唯一的操作入口（详情弹层已整体删除——
  // 弹层里只有大图 + 名字 + 星座·两个词，卡片上本来就全有，等于凭空多一步）。
  //   未拥有 → 直接下单/唤起支付   已拥有 → 直接设为当前伙伴   陪伴中 → 不可点
  // 注：原型 .a-price 只是纯文本 div、点整卡才 openAnimal；此处按用户要求有意偏离原型。
  onPill(e) {
    const key = e.currentTarget.dataset.key;
    const p = this.data.pets.find((x) => x.key === key);
    if (!p || p.isCurrent) return;
    return p.owned ? this.doSetCurrent(key) : this.doUnlock(key);
  },

  async doSetCurrent(key) {
    try {
      await cloud.petService.setCurrent(key);
      getApp().globalData.currentPet = key;
      // 同步更新 pets 数组里各卡片的 isCurrent 与左下角 pill（原「陪伴中」→「让它陪我」，新的反之）
      const pets = this.data.pets.map((p) => {
        const isCurrent = p.key === key;
        return { ...p, isCurrent, pillText: pillOf(p.owned, isCurrent) };
      });
      this.setData({ currentKey: key, currentPet: PET_META[key] || PET_META.orange, pets });
      wx.showToast({ title: '已切换', icon: 'none' });
    } catch (err) {}
  },

  async doUnlock(key) {
    // 解锁只解锁，不自动切换成当前伙伴（对齐原型 buyAnimal：先解锁，想用再点「让它陪我」），
    // 所以这里不再改 globalData.currentPet —— 那是服务端 mine.current 说了算，load() 会同步。
    if (DEV_DEMO) {
      wx.showLoading({ title: '解锁中' });
      try {
        await cloud.petService.unlock(key);
        await this.load();
        wx.showToast({ title: '已解锁（演示）', icon: 'none' });
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
