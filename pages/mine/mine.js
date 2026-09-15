// pages/mine/mine.js —— 我的：羁绊 / 足迹日历 / 回忆册 / 设置 / 分享
const cloud = require('../../utils/cloud.js');
const { getPet, zodiacOf } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', color: '#ff8a3d' },
    companionDays: 1,
    doneTotal: 0,
    streak: 0,
    year: 2026,
    month: 1,
    cells: [],
    memories: [],
    birthday: '',
    birthZodiacName: '',
    remind: true,
    showShare: false,
    summaryText: ''
  },

  onShow() { this.load(); },

  getCompanionDays() {
    let first = wx.getStorageSync('firstOpen');
    if (!first) { first = agg.todayStr(); wx.setStorageSync('firstOpen', first); }
    const a = new Date(first + 'T00:00:00');
    const b = new Date(agg.todayStr() + 'T00:00:00');
    return Math.max(1, Math.floor((b - a) / 86400000) + 1);
  },

  async load() {
    try {
      const [mine, list, fps] = await Promise.all([
        cloud.petService.getMine(),
        cloud.taskService.list(),
        cloud.sessionService.getFootprints(200)
      ]);
      const pet = getPet(mine.current || 'orange');
      const tasks = list.list || [];
      const fpsList = fps.list || [];
      const doneTotal = agg.totalDone(tasks);
      const streak = agg.computeStreak(tasks);
      const cal = this.buildCalendar(fpsList, pet);
      const memories = fpsList
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map((f) => ({
          id: f._id,
          date: agg.toDateStr(f.created_at),
          content: f.content,
          milestone: f.type === 'milestone'
        }));
      const b = wx.getStorageSync('birthday');
      let birthZodiacName = '';
      if (b && b.m && b.d) birthZodiacName = zodiacOf(b.m, b.d).name;
      const remind = wx.getStorageSync('remind');
      this.setData({
        pet,
        companionDays: this.getCompanionDays(),
        doneTotal,
        streak,
        year: cal.year,
        month: cal.month,
        cells: cal.cells,
        memories,
        birthday: b ? (b.m + '-' + b.d) : '',
        birthZodiacName,
        remind: remind === undefined ? true : remind,
        summaryText: this.buildSummary(pet, doneTotal, streak)
      });
    } catch (e) {}
  },

  buildCalendar(fpsList, pet) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const map = {};
    fpsList.forEach((f) => {
      const d = agg.toDateStr(f.created_at);
      (map[d] = map[d] || []).push(f.type);
    });
    const cells = [];
    for (let i = 0; i < first; i++) cells.push({ empty: true });
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${agg.pad(m + 1)}-${agg.pad(d)}`;
      const types = map[ds] || [];
      cells.push({
        day: d,
        has: types.length > 0,
        milestone: types.indexOf('milestone') > -1,
        emoji: pet.emoji,
        color: pet.color
      });
    }
    return { year: y, month: m + 1, cells };
  },

  buildSummary(pet, doneTotal, streak) {
    return `${pet.name}已经陪你 ${this.getCompanionDays()} 天，一起搞定了 ${doneTotal} 件待办，连续坚持 ${streak} 天。`;
  },

  onBirth(e) {
    const p = e.detail.value.split('-'); // 'YYYY-MM-DD'
    const m = +p[1];
    const d = +p[2];
    const z = zodiacOf(m, d);
    wx.setStorageSync('birthday', { m, d });
    this.setData({ birthday: m + '-' + d, birthZodiacName: z.name });
    wx.showToast({ title: '本命：' + z.name, icon: 'none' });
  },

  onRemind(e) {
    wx.setStorageSync('remind', e.detail.value);
    this.setData({ remind: e.detail.value });
  },

  openShare() { this.setData({ showShare: true }); },
  closeShare() { this.setData({ showShare: false }); },
  noop() {},

  onShareAppMessage() {
    return { title: this.data.summaryText, path: '/pages/index/index' };
  }
});
