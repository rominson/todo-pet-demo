Page({
  data: { streak: 0 },
  onShow() {
    // TODO(阶段1): 从 sessions/footprints 计算连续陪伴天数
  },
  go(e) {
    const to = e.currentTarget.dataset.to;
    // 子页在阶段2 创建：footprint / stats / settings；share 调用 wx.showShareMenu
    if (to === 'share') { wx.showToast({ title: '右上角可分享', icon: 'none' }); return; }
    wx.showToast({ title: '「' + to + '」页阶段2 实现', icon: 'none' });
  }
});
