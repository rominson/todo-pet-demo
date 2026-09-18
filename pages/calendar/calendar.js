// pages/calendar/calendar.js —— 日历 · 我的坚持之墙（对齐原型 screen-footprint）
const cloud = require('../../utils/cloud.js');
const { getPet, getPetByName } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png', color: '#ff8a3d' },
    year: 2026,
    month: 1,
    cells: [],
    monthCount: 0,
    canGoNext: false,
    dayLabel: '',
    dayTasks: [],
    daySessions: []
  },

  onShow() { this._offset = 0; this.load(0); },

  async load(offsetMonth = 0) {
    try {
      const [mine, fps, taskRes] = await Promise.all([
        cloud.petService.getMine(),
        cloud.sessionService.getFootprints(200),
        cloud.taskService.list()
      ]);
      const pet = getPet(mine.current || 'orange');
      const fpsList = fps.list || [];
      this._tasks = taskRes.list || [];
      this._fps = fpsList;

      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth() + offsetMonth; // 0-based，可越界自动进位
      const first = new Date(y, m, 1).getDay(); // 0=周日
      const days = new Date(y, m + 1, 0).getDate();

      const map = {};
      fpsList.forEach((f) => {
        const d = agg.toDateStr(f.created_at);
        (map[d] = map[d] || []).push(f);
      });

      let monthCount = 0;
      const cells = [];
      for (let i = 0; i < first; i++) cells.push({ empty: true });
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${agg.pad(m + 1)}-${agg.pad(d)}`;
        const list = map[ds] || [];
        // 「坚持之墙」只统计专注/冥想次数（勾选待办的 done / milestone 不计入）
        const stamps = list.filter((f) => f.type === 'focus' || f.type === 'meditate');
        if (stamps.length) monthCount++;
        const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
        // 每完成一次 = 一个宠物头像，最多展示 3 个
        const pets = stamps.slice(0, 3).map((f, i) => ({
          k: i,
          img: (getPetByName(f.pet) || pet).img
        }));
        const size = pets.length <= 1 ? 's1' : (pets.length === 2 ? 's2' : 's3');
        cells.push({
          day: d, empty: false, has: stamps.length > 0, count: stamps.length,
          pets, size, today: isToday, sel: false, detail: list
        });
      }

      const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());
      this.setData({
        pet: { name: pet.name, emoji: pet.emoji, img: pet.img, color: pet.color },
        year: y,
        month: m + 1,
        cells,
        monthCount,
        canGoNext: offsetMonth > 0 && !isFuture
      });
      // 默认选中今天
      const tIdx = cells.findIndex((c) => c.today);
      this.selectDay(tIdx >= 0 ? tIdx : cells.findIndex((c) => !c.empty));
    } catch (e) {}
  },

  prev() { this._offset = (this._offset || 0) - 1; this.load(this._offset); },

  goMeet() { wx.switchTab({ url: '/pages/pets/pets' }); },
  next() {
    if (!this.data.canGoNext) return;
    this._offset = (this._offset || 0) + 1;
    this.load(this._offset);
  },

  selectCell(e) {
    const d = e.currentTarget.dataset.d;
    const idx = this.data.cells.findIndex((c) => !c.empty && c.day === d);
    if (idx < 0) return;
    this.selectDay(idx);
  },

  selectDay(idx) {
    if (idx < 0) return;
    const cells = this.data.cells.map((c, i) => Object.assign({}, c, { sel: i === idx }));
    const c = cells[idx];
    const ds = `${this.data.year}-${agg.pad(this.data.month)}-${agg.pad(c.day)}`;
    const today = agg.todayStr();
    // 当天安排 = 那天的待办（无日期的归今天）；同一条只列一次，勾选/取消只改变它的状态
    const dayTasks = (this._tasks || []).filter((t) => (t.due || today) === ds)
      .map((t) => ({
        _id: t._id,
        title: t.title,
        done: !!t.done,
        repeatLabel: agg.repeatLabel(t.repeat)
      }));
    // 当天足迹 = 专注/冥想记录（勾选待办不记足迹，避免反复勾选刷出一堆重复）
    const daySessions = (this._fps || [])
      .filter((f) => agg.toDateStr(f.created_at) === ds && (f.type === 'focus' || f.type === 'meditate'))
      .map((f, i) => ({ i, text: f.content || (f.type === 'focus' ? '专注' : '冥想') }));
    this.setData({
      cells,
      dayLabel: `${this.data.month}月${c.day}日`,
      dayTasks,
      daySessions
    });
  }
});
