// pages/pets/pets.js —— 星座伙伴：目录 / 解锁 / 切换 / 全家桶（对齐原型 screen-store）
const cloud = require('../../utils/cloud.js');
const { PET_META, ZODIAC_TRAITS } = require('../../utils/pets.js');

// 是否「正式版」：正式版(envVersion==='release')强制走真实支付，开发/体验版允许免费解锁演示。
// 这样提审发布后自动变真实扣款，不怕忘记手动改开关。
const IS_RELEASE = (() => {
  try { return wx.getAccountInfoSync().miniProgram.envVersion === 'release'; } catch (e) { return false; }
})();
// ⚠️ 开发/体验版：点「¥6 解锁」/「全家桶」直接调 petService.unlock(All) 本地标记已拥有，不调
//    wx.requestVirtualPayment、不扣钱（测 UI 用）。正式版 IS_RELEASE 为 true → 强制走真实支付。
//    如需在开发/体验版临时强制真实支付，可在 devtools 执行 wx.setStorageSync('FORCE_REAL_PAY', true)。
const DEV_DEMO = !IS_RELEASE && !wx.getStorageSync('FORCE_REAL_PAY');
// 真实支付链路（DEV_DEMO=false）：createOrder → wx.requestVirtualPayment → payNotify 发货
// （云函数侧 PAY_USE_SANDBOX=1 可在开发者工具模拟器走沙箱免费用测）。

// 价格兜底值：正常以服务端 getCatalog/getMine 下发的 prices 为准，这里只在接口异常时兜底。
// ⚠️ 必须与 cloud/petService/pets.js、cloud/payService/pets.js 里的 SINGLE_PRICE / BUNDLE_PRICE 一致。
const SINGLE_PRICE = 6;   // 单只买断价（元）
const BUNDLE_PRICE = 36;  // 全家桶封顶价（元）：集齐 12 只最多花这么多

// 卡片左下角 pill 的三态文案：
//   未拥有 → 「¥6 解锁」   已拥有但没在用 → 「让它陪我」   正在陪 → 「陪伴中」
// 注：原型这里写的是「使用中」，用户指定用「陪伴中」，故偏离原型一处。
function pillOf(owned, isCurrent, single) {
  if (!owned) return '¥' + (single || SINGLE_PRICE) + ' 解锁';
  return isCurrent ? '陪伴中' : '让它陪我';
}

Page({
  data: {
    pets: [],
    ownedCount: 0,
    currentKey: 'orange',
    currentPet: { emoji: '🐱', name: '橘小满', color: '#ff8a3d' },
    activeIdx: 0,
    scrollLeft: 0,
    // 价格与全家桶（对齐原型：banner 副文案写单价与全家桶总价；底部悬浮条显示当前要补的差价）
    singlePrice: SINGLE_PRICE,
    bundleTotal: BUNDLE_PRICE,
    bundlePatch: BUNDLE_PRICE,   // 当前还需补多少（= 总价 − 已拥有只数 × 单价）
    bundleMissing: 12,           // 还差几只
    showBundle: false            // 没有差价空间（已拥有 ≥ 6 只）或已集齐时不显示
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
      const prices = (cat && cat.prices) || {};
      const single = prices.single || SINGLE_PRICE;
      const bundle = prices.bundle || BUNDLE_PRICE;

      const ownedSet = new Set(mine.owned || ['orange']);
      const current = mine.current || 'orange';
      const pets = (cat.catalog || []).map((p) => {
        const meta = PET_META[p.key] || {};
        const owned = ownedSet.has(p.key);
        const isCurrent = p.key === current;
        return {
          key: p.key,
          price: p.price,
          free: !!p.free,                            // 橘小满是免费自带形象，不计入全家桶的 12 只
          emoji: meta.emoji,
          scene: meta.scene,
          color: meta.color,
          animal: meta.animal,
          name: p.name,                              // 星座名（白羊）
          zodiacName: (p.name || '') + '座',         // 白羊座
          traits: ZODIAC_TRAITS[p.key] || '',        // 活力 · 冲动
          owned,
          isCurrent,
          pillText: pillOf(owned, isCurrent, single)
        };
      });

      // 当前伙伴只以服务端为准；同步到 globalData，避免「解锁后本地以为换了、服务端没换」的不一致
      getApp().globalData.currentPet = current;

      // 全家桶只对 12 只付费星座计账（免费形象不算，否则「已拥有 N/12」和补差价都会多算一只）
      const paid = pets.filter((x) => !x.free);
      const ownedPaid = paid.filter((x) => x.owned).length;
      const bundleMissing = paid.length - ownedPaid;
      const bundlePatch = Math.max(0, bundle - ownedPaid * single);

      this.setData({
        pets,
        ownedCount: ownedPaid,
        currentKey: current,
        currentPet: PET_META[current] || PET_META.orange,
        singlePrice: single,
        bundleTotal: bundle,
        bundlePatch,
        bundleMissing,
        // 补差价补到不足一只单价的量（即已拥有 ≥ 6 只）就没有意义了，入口隐藏
        showBundle: bundleMissing > 0 && bundlePatch >= single
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

  // 卡片左下角那颗 pill 是本页卡片的操作入口（详情弹层已整体删除——
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
        return { ...p, isCurrent, pillText: pillOf(p.owned, isCurrent, this.data.singlePrice) };
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
        await this.realPay(order);
      }
      await this.load();
      wx.showToast({ title: '解锁成功', icon: 'none' });
    } catch (err) {
      // cloud 封装已 toast
    } finally {
      wx.hideLoading();
    }
  },

  // 全家桶：一次买断剩余全部 12 星座伙伴，按已拥有数量补差价（对齐原型 buyAll）。
  // 无独有差价档位时服务端会拦下来（补到不足一只单价就没必要卖了）。
  async doBuyBundle() {
    if (this.buying || !this.data.showBundle) return;
    this.buying = true;
    const missing = this.data.bundleMissing;
    try {
      if (DEV_DEMO) {
        wx.showLoading({ title: '解锁中' });
        await cloud.petService.unlockAll();
        await this.load();
        wx.showToast({ title: '已解锁（演示）', icon: 'none' });
      } else {
        wx.showLoading({ title: '下单中' });
        const { code } = await this.wxLogin();
        const order = await cloud.payService.createOrderBundle(code);
        if (order.allOwned) {
          await this.load();
          wx.showToast({ title: '12 只伙伴已经都是你的了', icon: 'none' });
        } else {
          await this.realPay(order);
          await this.load();
          wx.showToast({ title: '补 ' + missing + ' 只，全家桶集齐', icon: 'none' });
        }
      }
    } catch (err) {
      // DEV_DEMO 分支的失败无人 toast，这里补一个；真实支付分支 cloud 封装已 toast
      if (DEV_DEMO && err && err.message) wx.showToast({ title: String(err.message).slice(0, 30), icon: 'none' });
    } finally {
      wx.hideLoading();
      this.buying = false;
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

  realPay(order) {
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
