// pages/quadrant/quadrant.js —— 四象限视图（重要 × 紧急）
// 重要 = 任务上的 important 标记；紧急 = 有到期日且不晚于今天（含逾期）
const cloud = require('../../utils/cloud.js');
const agg = require('../../utils/agg.js');

Page({
  data: {
    filter: 'all', // all / undone
    total: 0,
    quads: [
      { key: 'iu', title: '重要 · 紧急', sub: '马上做', items: [] },
      { key: 'in', title: '重要 · 不紧急', sub: '计划做', items: [] },
      { key: 'nu', title: '不重要 · 紧急', sub: '快速处理', items: [] },
      { key: 'nn', title: '不重要 · 不紧急', sub: '有空再说', items: [] }
    ]
  },

  onShow() { this.load(); },

  async load() {
    try {
      const res = await cloud.taskService.list();
      const tasks = res.list || [];
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
        due: t.due || '',
        done: !!t.done,
        overdue: !t.done && !!t.due && t.due < today
      });
    });
    const quads = this.data.quads.map((q) => ({ ...q, items: buckets[q.key] }));
    this.setData({ quads, total: shown.length });
  },

  setFilter(e) {
    const filter = e.currentTarget.dataset.f;
    this.setData({ filter });
    this.load();
  },

  onItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: ['完成 / 取消完成', '切换重要标记', '改到期日期', '删除'],
      success: (r) => {
        if (r.tapIndex === 0) this.toggleDone(id);
        else if (r.tapIndex === 1) this.toggleImportant(id);
        else if (r.tapIndex === 2) this.pickDue(id);
        else if (r.tapIndex === 3) this.remove(id);
      }
    });
  },

  async toggleDone(id) {
    try { await cloud.taskService.toggle(id); this.load(); } catch (e) {}
  },

  async toggleImportant(id) {
    const all = this.data.quads.flatMap((q) => q.items);
    const t = all.find((x) => x._id === id);
    if (!t) return;
    try {
      await cloud.taskService.update(id, { important: !t.important });
      wx.showToast({ title: (!t.important ? '已标为重要' : '已取消重要'), icon: 'none' });
      this.load();
    } catch (e) {}
  },

  pickDue(id) {
    const that = this;
    wx.showModal({
      title: '改到期日期',
      editable: true,
      placeholderText: '格式 2026-09-20，留空=清除',
      success: async (r) => {
        if (!r.confirm) return;
        const v = (r.content || '').trim();
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          wx.showToast({ title: '日期格式不对', icon: 'none' });
          return;
        }
        try {
          await cloud.taskService.update(id, { due: v });
          that.load();
        } catch (e) {}
      }
    });
  },

  remove(id) {
    wx.showModal({
      title: '删除待办',
      content: '确定删除这件？',
      success: async (r) => {
        if (r.confirm) {
          try { await cloud.taskService.remove(id); this.load(); } catch (e) {}
        }
      }
    });
  }
});
