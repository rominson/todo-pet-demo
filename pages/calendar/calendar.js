// pages/calendar/calendar.js —— 日历 · 我的坚持之墙（爪印月历）
const cloud = require('../../utils/cloud.js');
const { getPet } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png', color: '#ff8a3d' },
    year: 2026,
    month: 1,
    cells: [],
    monthCount: 0,
    canGoNext: false
  },

  onShow() { this.load(); },

  async load(offsetMonth = 0) {
    try {
      const [mine, fps] = await Promise.all([
        cloud.petService.getMine(),
        cloud.sessionService.getFootprints(200)
      ]);
      const pet = getPet(mine.current || 'orange');
      const fpsList = fps.list || [];

      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth() + offsetMonth; // 0-based，可越界自动进位
      const first = new Date(y, m, 1).getDay(); // 0=周日
      const days = new Date(y, m + 1, 0).getDate();

      const map = {};
      fpsList.forEach((f) => {
        const d = agg.toDateStr(f.created_at);
        (map[d] = map[d] || []).push(f.type);
      });

      let monthCount = 0;
      const cells = [];
      for (let i = 0; i < first; i++) cells.push({ empty: true });
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${agg.pad(m + 1)}-${agg.pad(d)}`;
        const types = map[ds] || [];
        if (types.length) monthCount++;
        cells.push({
          day: d,
          has: types.length > 0,
          milestone: types.indexOf('milestone') > -1,
          img: pet.img,
          color: pet.color
        });
      }

      // 未来月份不允许前进
      const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());
      this.setData({
        pet: { name: pet.name, emoji: pet.emoji, img: pet.img, color: pet.color },
        year: y,
        month: m + 1,
        cells,
        monthCount,
        canGoNext: offsetMonth > 0 && !isFuture
      });
    } catch (e) {}
  },

  prev() { this._offset = (this._offset || 0) - 1; this.load(this._offset); },
  next() {
    if (!this.data.canGoNext) return;
    this._offset = (this._offset || 0) + 1;
    this.load(this._offset);
  }
});
