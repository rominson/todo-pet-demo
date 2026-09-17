// pages/focus/focus.js —— 专注模式 / 冥想模式（对齐原型 screen-focus）
const cloud = require('../../utils/cloud.js');
const { getPet } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');
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
    taskTitle: '',
    showCancel: false,
    bubbleText: '',
    wall: { year: 2026, month: 1, monthText: '', cells: [], count: 0, dayLabel: '', dayDetail: [] }
  },

  onLoad(q) {
    if (q && q.title) this.setData({ taskTitle: decodeURIComponent(q.title) });
  },
  onShow() {
    const key = (getApp().globalData.currentPet) || 'orange';
    const pet = getPet(key);
    this.setData({ pet: { name: pet.name, emoji: pet.emoji, read: pet.read, color: pet.color } });
    this.loadWall();
  },

  // —— 我的坚持之墙（内嵌月历，复用足迹数据）——
  async loadWall(offsetMonth = 0) {
    try {
      const fps = await cloud.sessionService.getFootprints(200);
      const fpsList = fps.list || [];
      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth() + offsetMonth; // 0-based，可越界自动进位
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const map = {};
      fpsList.forEach((f) => {
        const d = agg.toDateStr(f.created_at);
        (map[d] = map[d] || []).push(f);
      });
      let count = 0;
      const cells = [];
      for (let i = 0; i < first; i++) cells.push({ empty: true });
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${agg.pad(m + 1)}-${agg.pad(d)}`;
        const list = map[ds] || [];
        if (list.length) count++;
        const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
        cells.push({ day: d, empty: false, has: list.length > 0, today: isToday, sel: false, detail: list });
      }
      const wall = {
        year: y, month: m + 1, monthText: `${y}年${m + 1}月`,
        cells, count, dayLabel: '', dayDetail: []
      };
      // 默认选中今天
      const tIdx = cells.findIndex((c) => c.today);
      if (tIdx >= 0) this.selectDay(cells, tIdx, wall);
      this.setData({ wall });
    } catch (e) {}
  },

  onPickDay(e) {
    const d = e.currentTarget.dataset.d;
    const cells = this.data.wall.cells;
    const idx = cells.findIndex((c) => !c.empty && c.day === d);
    if (idx < 0) return;
    const wall = Object.assign({}, this.data.wall);
    this.selectDay(cells, idx, wall);
    this.setData({ wall });
  },

  selectDay(cells, idx, wall) {
    cells.forEach((c, i) => { c.sel = (i === idx); });
    const c = cells[idx];
    wall.dayLabel = `${wall.month}月${c.day}日`;
    wall.dayDetail = (c.detail || []).map((f) => {
      const t = (f.content || '').replace(/^(专注|冥想)\s*/, '$1 ');
      return t || (f.type === 'focus' ? '专注' : '冥想');
    });
  },

  // —— 计时逻辑（保留原实现）——
  switchMode(e) {
    if (this.data.running) return;
    const mode = e.currentTarget.dataset.mode;
    const total = mode === 'focus' ? 25 * 60 : 15 * 60;
    this.setData({
      mode,
      left: total,
      timeText: fmt(total),
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
    this.setData({ running: true, showCancel: true, sub: '' });
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

  cancel() {
    if (this.timer) clearInterval(this.timer);
    this.setData({
      running: false,
      left: this.data.left,
      showCancel: false,
      sub: '随时可以再来一次，不着急。'
    });
    this.bubble(bc.focusAbort(this.data.pet.name));
  },

  finish(completed) {
    if (this.timer) clearInterval(this.timer);
    const mode = this.data.mode;
    if (completed) {
      this.setData({ running: false, showCancel: false });
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
      this.setData({ running: false, showCancel: false });
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
