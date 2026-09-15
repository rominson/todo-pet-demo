const app = getApp();
Page({
  data: {
    petName: '橘小满',
    broadcast: '',
    todos: []
  },
  onLoad() {
    const p = app.globalData.personas.find(x => x.key === app.globalData.currentPet);
    this.setData({ petName: p ? p.name : '橘小满' });
    // TODO(阶段1/2): 拉取今日待办 tasks 集合 + 调用陪伴播报规则(MVP单向播报内容池与事件规则.md)
  },
  goPets() { wx.switchTab({ url: '/pages/pets/pets' }); },
  goChat() { wx.navigateTo({ url: '/pages/chat/chat' }); },
  goFocus() { wx.switchTab({ url: '/pages/focus/focus' }); }
});
