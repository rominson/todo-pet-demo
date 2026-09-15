const app = getApp();
Page({
  data: {
    petName: '橘小满',
    messages: [{ role: 'pet', content: '嗨，我是橘小满～ 你今天有什么要一起搞定的事吗？' }],
    draft: '',
    scrollTo: ''
  },
  onLoad() {
    const p = app.globalData.personas.find(x => x.key === app.globalData.currentPet);
    this.setData({ petName: p ? p.name : '橘小满' });
  },
  onInput(e) { this.setData({ draft: e.detail.value }); },
  async send() {
    const text = this.data.draft.trim();
    if (!text) return;
    const messages = this.data.messages.concat([{ role: 'user', content: text }]);
    this.setData({ messages, draft: '', scrollTo: 'm' + (messages.length - 1) });
    // TODO(阶段3): 调 wx.cloud.callFunction({ name:'petChat', data:{ messages } })
    // 宠物读取用户待办/足迹做陪伴式提醒，而非单纯聊天
    wx.showToast({ title: '阶段3 接通 AI', icon: 'none' });
  }
});
