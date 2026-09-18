// pages/calendar/calendar.js —— 日历 · 我的坚持之墙（对齐原型 screen-footprint）
const cloud = require('../../utils/cloud.js');
const { getPet, getPetByName } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');

// —— 足迹头像的铺法（1:1 抄原型 petGlyphs(n,d)，见 prototype/index.html 第 2241-2263 行）——
// 9 个锚点；超过 9 个就从第 1 个锚点绕回，但因为抖动种子含序号，绕回的位置会偏移 → 自然互相叠压。
// 种子只由 (日, 序号, 总数) 决定，所以同一天每次渲染的头像位置都一致，不会乱跳。
const GLYPH_SPOTS = [
  [0.18, 0.22], [0.52, 0.15], [0.84, 0.24],
  [0.12, 0.50], [0.48, 0.48], [0.82, 0.45],
  [0.22, 0.78], [0.55, 0.76], [0.86, 0.74]
];
function glyphStyle(i, n, d) {
  if (n <= 1) return 'left:50%;top:50%;transform:translate(-50%,-50%)';
  const spot = GLYPH_SPOTS[i % GLYPH_SPOTS.length];
  const seed = ((d * 73) + (i * 37) + (n * 7)) % 1000;
  const rnd = (k) => {
    const x = Math.sin(seed * 0.123 + k * 997) * 10000;
    return x - Math.floor(x);
  };
  const clamp = (v) => Math.max(5, Math.min(95, v));
  const left = clamp((spot[0] + (rnd(1) - 0.5) * 0.16) * 100);
  const top = clamp((spot[1] + (rnd(2) - 0.5) * 0.16) * 100);
  const rot = Math.round((rnd(3) - 0.5) * 22);
  return `left:${left.toFixed(1)}%;top:${top.toFixed(1)}%;transform:translate(-50%,-50%) rotate(${rot}deg)`;
}

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

  onShow() {
    this.setTab(3);
    this._offset = 0;
    this.load(0);
  },

  // 自定义 tabBar：每个 tab 页各有一个组件实例，选中态要在 onShow 里同步
  setTab(i) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: i });
    }
  },

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
      const today = agg.todayStr();
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
        // 一次专注/冥想 = 一个宠物头像，**不设上限**（原型 petGlyphs：9 锚点循环 + 抖动，多了自然叠压）
        const pets = stamps.map((f, i) => ({
          k: i,
          img: (getPetByName(f.pet) || pet).img,
          style: glyphStyle(i, stamps.length, d)
        }));
        // 一个点 = 一件待办；已完成变灰（对齐原型 renderCalendar 的 .task-dots：
        // 未完成 var(--accent) / 已完成 #C9C2B6）。无日期的待办归今天。
        const dots = (this._tasks || [])
          .filter((t) => (t.due || today) === ds)
          .map((t, i) => ({ k: i, done: !!t.done }));
        cells.push({
          day: d, empty: false, has: stamps.length > 0, count: stamps.length,
          pets, dots, today: isToday, sel: false, detail: list
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
