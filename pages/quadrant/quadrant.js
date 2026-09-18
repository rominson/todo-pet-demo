// pages/quadrant/quadrant.js —— 四象限视图（重要 × 紧急）
// 重要 = 任务上的 important 标记；紧急 = 有到期日且不晚于今天（含逾期）
// 交互对齐原型 renderQuadrant：行首圆圈直接点掉即完成，左滑露出「删除」。
// 原先那套 wx.showActionSheet 多级菜单已删除（用户反馈「用户一打开那么东西都会蒙了」）。
const cloud = require('../../utils/cloud.js');
const agg = require('../../utils/agg.js');

const EMPTY_FORM = { title: '', due: '', important: false, repeatOn: false, freq: 'daily', customNum: 2, unitIdx: 0 };
const FREQS = [
  { f: 'daily', t: '每天' },
  { f: 'weekly', t: '每周' },
  { f: 'monthly', t: '每月' },
  { f: 'custom', t: '自定义' }
];
const UNITS = [{ v: 'd', t: '天' }, { v: 'w', t: '周' }, { v: 'm', t: '月' }];

function pad(n) { return String(n).padStart(2, '0'); }

// 相对日期（原型 relDate）：今天留空、明天/后天用文字、更远显示 MM-DD
function relDate(ds, today) {
  if (!ds || ds === today) return '';
  const f = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const d1 = new Date(); d1.setDate(d1.getDate() + 1);
  const d2 = new Date(); d2.setDate(d2.getDate() + 2);
  if (ds === f(d1)) return '明天';
  if (ds === f(d2)) return '后天';
  return ds.slice(5);
}

Page({
  data: {
    filter: 'all', // all / undone
    total: 0,
    openId: '',
    showAdd: false,
    form: Object.assign({}, EMPTY_FORM),
    freqs: FREQS,
    units: UNITS,
    quads: [
      { key: 'iu', title: '重要 · 紧急', sub: '马上做', hint: '又急又重要，优先搞定', items: [] },
      { key: 'in', title: '重要 · 不紧急', sub: '计划做', hint: '重要但还没到提醒时间，安排进日程', items: [] },
      { key: 'nu', title: '不重要 · 紧急', sub: '快速处理', hint: '急但不重要，顺手快速清掉', items: [] },
      { key: 'nn', title: '不重要 · 不紧急', sub: '有空再说', hint: '不着急也不重要，别让它们堆积', items: [] }
    ]
  },

  onShow() {
    this.setTab(2);
    this.load();
  },

  // 自定义 tabBar：每个 tab 页各有一个组件实例，选中态要在 onShow 里同步
  setTab(i) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: i });
    }
  },

  async load() {
    try {
      const res = await cloud.taskService.list();
      const tasks = res.list || [];
      this._tasks = tasks;
      this.render(tasks);
    } catch (e) {}
  },

  render(tasks) {
    const today = agg.todayStr();
    const shown = tasks.filter((t) => (this.data.filter === 'undone' ? !t.done : true));
    const buckets = { iu: [], in: [], nu: [], nn: [] };
    shown.forEach((t) => {
      const imp = !!t.important;
      const urgent = !!t.due && t.due <= today;
      const key = imp ? (urgent ? 'iu' : 'in') : urgent ? 'nu' : 'nn';
      buckets[key].push({
        _id: t._id,
        title: t.title,
        imp,
        due: relDate(t.due, today),
        done: !!t.done,
        repeatLabel: agg.repeatLabel(t.repeat),
        overdue: !t.done && !!t.due && t.due < today,
        // 还没到日期的任务：原型里圆圈半透明、不可点
        future: !t.done && !!t.due && t.due > today
      });
    });
    const quads = this.data.quads.map((q) => {
      const items = buckets[q.key];
      return { ...q, items, open: items.filter((x) => !x.done).length };
    });
    this.setData({ quads, total: shown.length });
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.f;
    this.setData({ filter, openId: '' });
    this.load();
  },

  // 点圆圈 / 点文字 = 完成或取消完成（对齐原型 qdot 的 completeTask）
  async onToggle(e) {
    if (this.data.openId) { this.setData({ openId: '' }); return; }
    const id = e.currentTarget.dataset.id;
    const t = (this._tasks || []).find((x) => x._id === id);
    const today = agg.todayStr();
    // 对齐原型：还没到日期的任务不能提前勾（明天/更远）
    if (t && !t.done && t.due && t.due > today) {
      wx.showToast({ title: '还没到日期，到那天再勾', icon: 'none' });
      return;
    }
    try { await cloud.taskService.toggle(id); this.load(); } catch (err) {}
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ openId: '' });
    wx.showModal({
      title: '删除待办',
      content: '确定删除这件？',
      success: async (r) => {
        if (r.confirm) {
          try { await cloud.taskService.remove(id); this.load(); } catch (err) {}
        }
      }
    });
  },

  // —— 左滑（与今日页同一套手势：竖向滚动不误触，右滑收起，点空白收起）——
  closeSwipe() {
    if (this.data.openId) this.setData({ openId: '' });
  },
  onSwipeStart(e) {
    this._sx = e.touches[0].clientX;
    this._sy = e.touches[0].clientY;
    this._lock = '';
  },
  onSwipeMove(e) {
    if (this._sx == null) return;
    const dx = e.touches[0].clientX - this._sx;
    const dy = e.touches[0].clientY - this._sy;
    if (!this._lock && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      this._lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
  },
  onSwipeEnd(e) {
    if (this._sx == null) return;
    const dx = e.changedTouches[0].clientX - this._sx;
    const dy = e.changedTouches[0].clientY - this._sy;
    const id = e.currentTarget.dataset.id;
    const lock = this._lock;
    this._sx = null;
    this._lock = '';
    if (lock === 'v' || Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 30) { this.setData({ openId: '' }); return; }
    if (dx < -30) this.setData({ openId: id });
  },

  // —— 新建任务（与今日页弹层一致）——
  showAdd() { this.setData({ showAdd: true }); },
  hideAdd() { this.setData({ showAdd: false }); },
  noop() {},
  onTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onDue(e) { this.setData({ 'form.due': e.detail.value }); },
  onImportant(e) { this.setData({ 'form.important': e.detail.value }); },
  onRepeat(e) { this.setData({ 'form.repeatOn': e.detail.value }); },
  pickFreq(e) { this.setData({ 'form.freq': e.currentTarget.dataset.f }); },
  onCustomNum(e) { this.setData({ 'form.customNum': e.detail.value }); },
  onCustomUnit(e) { this.setData({ 'form.unitIdx': Number(e.detail.value) }); },

  buildRepeat() {
    const f = this.data.form;
    if (!f.repeatOn) return 'none';
    if (f.freq === 'custom') {
      const n = Math.max(1, Math.min(99, parseInt(f.customNum, 10) || 1));
      return `custom:${n}${UNITS[f.unitIdx].v}`;
    }
    return f.freq;
  },

  async onCreate() {
    const title = (this.data.form.title || '').trim();
    if (!title) { wx.showToast({ title: '写点什么吧', icon: 'none' }); return; }
    try {
      await cloud.taskService.create({
        title,
        due: this.data.form.due,
        important: this.data.form.important,
        repeat: this.buildRepeat()
      });
      this.setData({ showAdd: false, form: Object.assign({}, EMPTY_FORM) });
      this.load();
    } catch (e) {}
  }
});
