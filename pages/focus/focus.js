// pages/focus/focus.js —— 专注模式 / 冥想模式
const cloud = require('../../utils/cloud.js');
const { getPet } = require('../../utils/pets.js');
const bc = require('../../utils/broadcast.js');

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return m + ':' + ss;
}

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png', color: '#ff8a3d' },
    mode: 'focus', // focus / meditate
    running: false,
    left: 25 * 60,
    timeText: '25:00',
    sub: '从今日待办带一件事来，或者就这样开始',
    petFace: '📖', // 日常看书；专注⌨️；冥想🌅；庆祝☕
    taskTitle: '',
    showCancel: false,
    bubbleText: ''
  },

  onLoad(q) {
    if (q && q.title) this.setData({ taskTitle: decodeURIComponent(q.title) });
  },
  onShow() {
    const key = (getApp().globalData.currentPet) || 'orange';
    this.setData({ pet: getPet(key) });
  },

  switchMode(e) {
    if (this.data.running) return; // 运行中锁死模式切换
    const mode = e.currentTarget.dataset.mode;
    const total = mode === 'focus' ? 25 * 60 : 15 * 60;
    this.setData({
      mode,
      left: total,
      timeText: fmt(total),
      petFace: '📖',
      taskTitle: mode === 'meditate' ? '' : this.data.taskTitle,
      showCancel: false,
      sub: mode === 'focus'
        ? '从今日待办带一件事来，或者就这样开始'
        : '什么都不用选，跟着呼吸就好'
    });
  },

  start() {
    if (this.data.running) { this.finish(true); return; }
    const mode = this.data.mode;
    if (mode !== 'focus') this.setData({ taskTitle: '' });
    this.setData({
      running: true,
      petFace: mode === 'focus' ? '⌨️' : '🌅',
      showCancel: true,
      sub: ''
    });
    this.timer = setInterval(() => {
      let left = this.data.left - 1;
      if (left <= 0) {
        this.setData({ left: 0, timeText: '00:00' });
        this.finish(true);
        return;
      }
      this.setData({ left, timeText: fmt(left) });
    }, 1000);
  },

  cancel() {
    if (this.timer) clearInterval(this.timer);
    this.setData({
      running: false,
      petFace: '📖',
      left: this.data.left, // 保留剩余时间，方便再次开始
      showCancel: false,
      sub: '随时可以再来一次，不着急。'
    });
    this.bubble(bc.focusAbort(this.data.pet.name));
  },

  finish(completed) {
    if (this.timer) clearInterval(this.timer);
    const mode = this.data.mode;
    if (completed) {
      this.setData({ running: false, petFace: '☕', showCancel: false });
      const minutes = mode === 'focus' ? 25 : 15;
      const content = mode === 'focus'
        ? `专注 ${minutes} 分钟${this.data.taskTitle ? '：' + this.data.taskTitle : ''}`
        : `冥想 ${minutes} 分钟`;
      cloud.sessionService.addFootprint(mode, content, this.data.pet.name).catch(() => {});
      const msg = bc.focusDone(mode, this.data.taskTitle, this.data.pet.name);
      cloud.sessionService.saveMessage('pet', msg, this.data.pet.name).catch(() => {});
      this.bubble(msg);
      this.setData({
        sub: mode === 'focus'
          ? '搞定啦——陪你喝杯咖啡，慢慢回回神。'
          : '这阵呼吸记下了，喝口水，慢慢回来。'
      });
    } else {
      this.setData({ running: false, petFace: '📖', showCancel: false });
      this.bubble(bc.focusAbort(this.data.pet.name));
      this.setData({
        sub: mode === 'focus'
          ? '从今日待办带一件事来，或者就这样开始'
          : '什么都不用选，跟着呼吸就好'
      });
    }
  },

  bubble(text) {
    this.setData({ bubbleText: text });
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.setData({ bubbleText: '' }), 6000);
  },

  onUnload() { if (this.timer) clearInterval(this.timer); }
});
