// pages/orders/orders.js —— 订单中心页
// ⚠️ 本页 path（pages/orders/orders）登记在微信「小程序订单中心 path」里，
//    所以必须能被「无任何参数的 path」直接打开：自己 load 数据、不依赖跳转参数、
//    失败时不跳首页只在本页提示重试（平台规范：不自动跳转、不白屏）。
const cloud = require('../../utils/cloud.js');

Page({
  data: {
    loading: true,
    err: false,
    errMsg: '',
    orders: [],
    totalYuan: '0.00'
  },

  onLoad() { this.load(); },

  async load() {
    this.setData({ loading: true, err: false, errMsg: '' });
    try {
      // 静默登录（openid）在 app.onLaunch 发起；直接由 path 进本页时可能还没回来，等它一下。
      // 注意：这里不存在「未登录」态，所以不需要引导登录页。
      const app = getApp();
      if (app && app.loginPromise) { try { await app.loginPromise; } catch (e) {} }

      const res = await cloud.payService.listOrders();
      const orders = res.list || [];
      const paidYuan = orders
        .filter((o) => o.status === 'paid')
        .reduce((s, o) => s + Number(o.amountYuan || 0), 0);

      this.setData({ loading: false, orders, totalYuan: paidYuan.toFixed(2) });
    } catch (e) {
      this.setData({
        loading: false,
        err: true,
        errMsg: (e && e.message) || '请检查网络后重试'
      });
    }
  },

  goPets() {
    wx.switchTab({ url: '/pages/pets/pets' });
  },

  copyId(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.setClipboardData({ data: String(id) });
  },

  onShareAppMessage() {
    return { title: '毛茸清单', path: '/pages/index/index' };
  }
});
