// pages/chat/chat.js —— 宠物陪伴悄悄话（单向：只展示 + 让宠物基于待办说一句）
const cloud = require('../../utils/cloud.js');
const { getPet } = require('../../utils/pets.js');

function fmt(d) {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getMonth() + 1}-${x.getDate()} ${p(x.getHours())}:${p(x.getMinutes())}`;
}

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', color: '#ff8a3d' },
    lines: [],
    thinking: false
  },

  onShow() {
    this.syncPet();
    this.loadLines();
  },

  syncPet() {
    const k = (getApp().globalData.currentPet) || 'orange';
    this.setData({ pet: getPet(k) });
  },

  async loadLines() {
    try {
      const r = await cloud.sessionService.getHistory(40);
      const lines = (r.list || [])
        .filter((m) => m.role === 'pet')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map((m) => ({ id: m._id, text: m.content, date: fmt(m.created_at) }));
      this.setData({ lines });
    } catch (e) {}
  },

  async say() {
    if (this.data.thinking) return;
    this.setData({ thinking: true });
    try {
      const list = await cloud.taskService.list();
      const tasks = list.list || [];
      const pending = tasks.filter((t) => !t.done).slice(0, 5).map((t) => t.title);
      const sys = `你是用户的陪伴宠物${this.data.pet.name}，语气温暖、像朋友。根据用户今天的待办，说一句简短的陪伴或提醒（不超过30字）。不要说教，不要列清单。`;
      const user = pending.length
        ? `我今天还有这些待办没做：${pending.join('、')}。跟我说点什么吧。`
        : '我今天把待办都做完了，或者还没添加待办。跟我说点什么吧。';
      const r = await cloud.petChat([
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ]);
      const text = (r && r.ok && r.text) ? r.text : `${this.data.pet.name}：今天也辛苦啦，慢慢来。`;
      await cloud.sessionService.saveMessage('pet', text, this.data.pet.name).catch(() => {});
      this.loadLines();
    } catch (e) {
      wx.showToast({ title: '暂时说不出话', icon: 'none' });
    } finally {
      this.setData({ thinking: false });
    }
  }
});
