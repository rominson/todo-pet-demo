// pages/focus/focus.js —— 专注模式 / 冥想模式（对齐原型 screen-focus，无日历）
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
    pet: { name: '橘小满', emoji: '🐱', read: '/assets/pets/orange-read.png', color: '#ff8a3d' },
    mode: 'focus', // focus / meditate
    running: false,
    left: 25 * 60,
    timeText: '25:00',
    sub: '从今日待办带一件事来，或者就这样开始',
    taskTitle: ''
  },

  onLoad(q) {
    if (q && q.title) this.setData({ taskTitle: decodeURIComponent(q.title) });
  },
  onShow() {
    const key = (getApp().globalData.currentPet) || 'orange';
    const pet = getPet(key);
    this.setData({ pet: { name: pet.name, emoji: pet.emoji, read: pet.anim || pet.read, color: pet.color } });
  },

  // —— 计时逻辑 ——
  switchMode(e) {
    if (this.data.running) return;
    const mode = e.currentTarget.dataset.mode;
    const total = mode === 'focus' ? 25 * 60 : 15 * 60;
    this.setData({
      mode,
      left: total,
      timeText: fmt(total),
      taskTitle: mode === 'meditate' ? '' : this.data.taskTitle,
      sub: mode === 'focus'
        ? '从今日待办带一件事来，或者就这样开始'
        : '什么都不用选，跟着呼吸就好'
    });
  },

  start() {
    if (this.data.running) { this.finish(true); return; }
    const mode = this.data.mode;
    if (mode !== 'focus') this.setData({ taskTitle: '' });
    this.setData({ running: true, sub: '' });
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

  // 快进（演示）：每次跳过 1 分钟，便于看效果
  fastForward() {
    if (!this.data.running) return;
    let left = Math.max(0, this.data.left - 60);
    this.setData({ left, timeText: fmt(left) });
    if (left === 0) this.finish(true);
  },

  finish(completed) {
    if (this.timer) clearInterval(this.timer);
    const mode = this.data.mode;
    if (completed) {
      this.setData({ running: false });
      const minutes = mode === 'focus' ? 25 : 15;
      const content = mode === 'focus'
        ? `专注 ${minutes} 分钟${this.data.taskTitle ? '：' + this.data.taskTitle : ''}`
        : `冥想 ${minutes} 分钟`;
      cloud.sessionService.addFootprint(mode, content, this.data.pet.name).catch(() => {});
      const msg = bc.focusDone(mode, this.data.taskTitle, this.data.pet.name);
      cloud.sessionService.saveMessage('pet', msg, this.data.pet.name).catch(() => {});
      this.setData({
        sub: mode === 'focus'
          ? '搞定啦——陪你喝杯咖啡，慢慢回回神。'
          : '这阵呼吸记下了，喝口水，慢慢回来。'
      });
    } else {
      this.setData({
        running: false,
        sub: mode === 'focus'
          ? '从今日待办带一件事来，或者就这样开始'
          : '什么都不用选，跟着呼吸就好'
      });
    }
  },

  onUnload() { if (this.timer) clearInterval(this.timer); }
});
