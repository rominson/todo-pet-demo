const app = getApp();
Page({
  data: {
    personas: [],
    owned: {} // { aries: true, ... } 已解锁的付费宠物
  },
  onLoad() {
    this.setData({ personas: app.globalData.personas });
    // TODO(阶段1): 拉取 user_pets 集合，填充 owned
  },
  onTap(e) {
    const key = e.currentTarget.dataset.key;
    const p = this.data.personas.find(x => x.key === key);
    if (p.free) {
      app.globalData.currentPet = key;
      wx.showToast({ title: '已切换为 ' + p.name, icon: 'none' });
      return;
    }
    if (this.data.owned[key]) {
      app.globalData.currentPet = key;
      wx.showToast({ title: '已切换为 ' + p.name, icon: 'none' });
      return;
    }
    // TODO(阶段4): 未拥有 → 跳转商店发起虚拟支付解锁
    wx.showToast({ title: '去解锁 ' + p.name, icon: 'none' });
  }
});
