// pages/index/index.js —— 首页：宠物陪伴 + 待办清单
const cloud = require('../../utils/cloud.js');
const { getPet } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');
const bc = require('../../utils/broadcast.js');

function hashId(s) {
  let n = 0;
  for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', color: '#ff8a3d' },
    tasks: [],
    greeting: '',
    bubble: '',
    doneTotal: 0,
    streak: 0,
    companionDays: 1,
    showAdd: false,
    form: { title: '', tag: '', due: '', type: 'normal' }
  },

  onShow() { this.loadAll(); },

  getCompanionDays() {
    let first = wx.getStorageSync('firstOpen');
    if (!first) { first = agg.todayStr(); wx.setStorageSync('firstOpen', first); }
    const a = new Date(first + 'T00:00:00');
    const b = new Date(agg.todayStr() + 'T00:00:00');
    const days = Math.floor((b - a) / 86400000) + 1;
    return Math.max(1, days);
  },

  async loadAll() {
    wx.showLoading({ title: '加载中' });
    try {
      const [mineRes, listRes] = await Promise.all([
        cloud.petService.getMine(),
        cloud.taskService.list()
      ]);
      const pet = getPet(mineRes.current || 'orange');
      const tasks = listRes.list || [];
      const streak = agg.computeStreak(tasks);
      const yDone = agg.yesterdayDone(tasks);
      const overdue = agg.overdueTasks(tasks);
      this.setData({
        pet: { name: pet.name, emoji: pet.emoji, color: pet.color },
        tasks,
        doneTotal: agg.totalDone(tasks),
        streak,
        companionDays: this.getCompanionDays()
      });
      this.maybeGreet(streak, yDone, overdue);
    } catch (e) {
      // cloud 封装已 toast
    } finally {
      wx.hideLoading();
    }
  },

  maybeGreet(streak, yDone, overdue) {
    const date = agg.todayStr();
    if (wx.getStorageSync('open_' + date)) return;
    let tier = 'P4';
    if (overdue.length) tier = 'P1';
    else if (streak >= 2) tier = 'P2';
    else if (yDone.length) tier = 'P3';
    const text = bc.dailyOpen({ overdueList: overdue, streak, yDone }, this.data.pet.name);
    wx.setStorageSync('open_' + date, '1');
    if (tier === 'P2' || tier === 'P3') wx.setStorageSync('open_meta_' + date, '1');
    this.setData({ greeting: text });
    setTimeout(() => this.setData({ greeting: '' }), 6000);
  },

  showBubble(text) {
    this.setData({ bubble: text });
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.setData({ bubble: '' }), 6000);
  },

  async onToggle(e) {
    const id = e.currentTarget.dataset.id;
    const before = this.data.tasks.find((t) => t._id === id);
    const wasDone = before ? before.done : false;
    try {
      const res = await cloud.taskService.toggle(id);
      const nowDone = res.done;
      const tasks = this.data.tasks.map((t) =>
        t._id === id ? { ...t, done: nowDone, done_at: nowDone ? new Date() : null } : t
      );
      this.setData({ tasks, doneTotal: agg.totalDone(tasks), streak: agg.computeStreak(tasks) });
      if (nowDone && !wasDone) this.onComplete(before, tasks);
    } catch (e) {}
  },

  onComplete(task, tasks) {
    const petName = this.data.pet.name;
    const date = agg.todayStr();
    const taskKey = 'task_' + task._id;
    const already = wx.getStorageSync(taskKey);
    let bubbleText;
    if (!already) {
      wx.setStorageSync(taskKey, '1');
      const opened = wx.getStorageSync('open_meta_' + date);
      bubbleText = bc.completeReact({ overdue: false, openedP2P3: !!opened }, petName);
      this.tryAIComplete(task.title);
    } else {
      bubbleText = bc.completeReact({ overdue: false, openedP2P3: false }, petName);
    }
    this.showBubble(bubbleText);

    const line = bc.memoryLine(task.title, hashId(task._id), petName);
    cloud.sessionService.addFootprint('done', line, petName).catch(() => {});
    cloud.sessionService.saveMessage('pet', line, petName).catch(() => {});

    const streak = this.data.streak;
    if (streak === 3 || streak === 7 || streak === 14) {
      const tier = streak === 3 ? 'M1' : streak === 7 ? 'M2' : 'M3';
      const mkey = 'milestone_' + tier;
      if (!wx.getStorageSync(mkey)) {
        wx.setStorageSync(mkey, '1');
        const msg = bc.milestone(streak, petName);
        setTimeout(() => this.showBubble(msg), 6400);
        cloud.sessionService.addFootprint('milestone', msg, petName).catch(() => {});
        cloud.sessionService.saveMessage('pet', msg, petName).catch(() => {});
      }
    }
  },

  async tryAIComplete(title) {
    try {
      const r = await cloud.petChat([
        { role: 'system', content: '你是用户的陪伴宠物，语气温暖简短，不超过25字，说一句完成后的鼓励。' },
        { role: 'user', content: '我刚完成了「' + title + '」' }
      ]);
      if (r && r.ok && r.text) this.showBubble(r.text);
    } catch (e) {}
  },

  showAdd() { this.setData({ showAdd: true }); },
  hideAdd() { this.setData({ showAdd: false }); },
  noop() {},
  onTitle(e) { this.setData({ 'form.title': e.detail.value }); },
  onTag(e) { this.setData({ 'form.tag': e.detail.value }); },
  onDue(e) { this.setData({ 'form.due': e.detail.value }); },
  setType(e) { this.setData({ 'form.type': e.currentTarget.dataset.t }); },

  async onCreate() {
    const title = this.data.form.title.trim();
    if (!title) { wx.showToast({ title: '写点什么吧', icon: 'none' }); return; }
    try {
      await cloud.taskService.create({
        title,
        tag: this.data.form.tag,
        due: this.data.form.due,
        type: this.data.form.type
      });
      this.setData({ showAdd: false, form: { title: '', tag: '', due: '', type: 'normal' } });
      this.loadAll();
    } catch (e) {}
  },

  goFocus(e) {
    const id = e.currentTarget.dataset.id;
    const t = this.data.tasks.find((x) => x._id === id);
    wx.navigateTo({ url: '/pages/focus/focus?title=' + encodeURIComponent(t ? t.title : '') });
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除待办',
      content: '确定删除这件？',
      success: async (r) => {
        if (r.confirm) {
          try { await cloud.taskService.remove(id); this.loadAll(); } catch (err) {}
        }
      }
    });
  }
});
