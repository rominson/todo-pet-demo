// pages/index/index.js —— 今日：问候 + 宠物陪伴 + 进度 + 待办清单
const cloud = require('../../utils/cloud.js');
const { getPet } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');
const bc = require('../../utils/broadcast.js');

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function hashId(s) {
  let n = 0;
  for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

function greetingWord() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return '早上好';
  if (h >= 11 && h < 13) return '中午好';
  if (h >= 13 && h < 18) return '下午好';
  if (h >= 18 && h < 23) return '晚上好';
  return '夜深了';
}

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png', color: '#ff8a3d' },
    greetWord: greetingWord(),
    todayText: '',
    tasks: [],
    greeting: '',
    bubble: '',
    doneToday: 0,
    totalToday: 0,
    progress: 0,
    doneTotal: 0,
    streak: 0,
    companionDays: 1,
    focusMinutes: 0,
    showAdd: false,
    form: { title: '', tag: '', due: '', type: 'normal', important: false }
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

  buildTodayText() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
  },

  async loadAll() {
    wx.showLoading({ title: '加载中' });
    try {
      const [mineRes, listRes, fpsRes] = await Promise.all([
        cloud.petService.getMine(),
        cloud.taskService.list(),
        cloud.sessionService.getFootprints(200).catch(() => ({ list: [] }))
      ]);
      const pet = getPet(mineRes.current || 'orange');
      const tasks = listRes.list || [];
      const fps = fpsRes.list || [];
      const streak = agg.computeStreak(tasks);
      const yDone = agg.yesterdayDone(tasks);
      const overdue = agg.overdueTasks(tasks);

      // 今日 n/n：未完成 + 今天完成的
      const today = agg.todayStr();
      const doneToday = tasks.filter(
        (t) => t.done && t.done_at && agg.toDateStr(t.done_at) === today
      ).length;
      const totalToday = doneToday + tasks.filter((t) => !t.done).length;
      const progress = totalToday ? Math.round((doneToday / totalToday) * 100) : 0;

      // 专注分钟：由专注/冥想足迹累计（专注 25 / 冥想 15）
      const focusMinutes = fps.reduce(
        (sum, f) => sum + (f.type === 'focus' ? 25 : f.type === 'meditate' ? 15 : 0),
        0
      );

      this.setData({
        pet: { name: pet.name, emoji: pet.emoji, img: pet.img, read: pet.read, color: pet.color },
        todayText: this.buildTodayText(),
        tasks,
        doneToday,
        totalToday,
        progress,
        doneTotal: agg.totalDone(tasks),
        streak,
        companionDays: this.getCompanionDays(),
        focusMinutes
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
      this.setData({
        tasks,
        doneTotal: agg.totalDone(tasks),
        streak: agg.computeStreak(tasks)
      });
      this.refreshToday(tasks);
      if (nowDone && !wasDone) this.onComplete(before, tasks);
    } catch (e) {}
  },

  refreshToday(tasks) {
    const today = agg.todayStr();
    const doneToday = tasks.filter(
      (t) => t.done && t.done_at && agg.toDateStr(t.done_at) === today
    ).length;
    const totalToday = doneToday + tasks.filter((t) => !t.done).length;
    this.setData({
      doneToday,
      totalToday,
      progress: totalToday ? Math.round((doneToday / totalToday) * 100) : 0
    });
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
  onImportant(e) { this.setData({ 'form.important': e.detail.value }); },

  async onCreate() {
    const title = this.data.form.title.trim();
    if (!title) { wx.showToast({ title: '写点什么吧', icon: 'none' }); return; }
    try {
      await cloud.taskService.create({
        title,
        tag: this.data.form.tag,
        due: this.data.form.due,
        type: this.data.form.type,
        important: this.data.form.important
      });
      this.setData({
        showAdd: false,
        form: { title: '', tag: '', due: '', type: 'normal', important: false }
      });
      this.loadAll();
    } catch (e) {}
  },

  goFocus(e) {
    const id = e.currentTarget.dataset.id;
    const t = this.data.tasks.find((x) => x._id === id);
    wx.navigateTo({ url: '/pages/focus/focus?title=' + encodeURIComponent(t ? t.title : '') });
  },

  openChat() {
    wx.navigateTo({ url: '/pages/chat/chat' });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/mine/mine' });
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
