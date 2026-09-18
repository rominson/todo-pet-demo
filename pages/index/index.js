// pages/index/index.js —— 今日：问候 + 宠物陪伴 + 进度 + 待办清单
const cloud = require('../../utils/cloud.js');
const { getPet, petEdgeStyle } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');
const bc = require('../../utils/broadcast.js');

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const EMPTY_FORM = { title: '', due: '', important: false, repeatOn: false, freq: 'daily', customNum: 2, unitIdx: 0 };

// 给任务补上展示用的重复文案
function decorate(t) {
  return Object.assign({}, t, { repeatLabel: agg.repeatLabel(t.repeat) });
}

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
    pet: { name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png', read: '/assets/pets/orange-read.png', color: '#ff8a3d' },
    petFace: 'right',
    petStyle: 'left:-119rpx',
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
    openId: '',
    archiveShow: false,
    form: { title: '', due: '', important: false, repeatOn: false, freq: 'daily', customNum: 2, unitIdx: 0 },
    freqs: [
      { f: 'daily', t: '每天' },
      { f: 'weekly', t: '每周' },
      { f: 'monthly', t: '每月' },
      { f: 'custom', t: '自定义' }
    ],
    units: [{ v: 'd', t: '天' }, { v: 'w', t: '周' }, { v: 'm', t: '月' }]
  },

  onShow() {
    this.setTab(0);
    this.loadAll();
  },

  // 自定义 tabBar：每个 tab 页各有一个组件实例，选中态要在 onShow 里同步
  setTab(i) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: i });
    }
  },

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
      const all = listRes.list || [];
      this._all = all;
      const fps = fpsRes.list || [];
      const streak = agg.computeStreak(all);
      const yDone = agg.yesterdayDone(all);
      const overdue = agg.overdueTasks(all);

      // 今日页口径（对齐原型 renderTasks）：只显示「无日期 或 日期=今天」的；
      // 未来日期的任务不属于今天（归象限/日历），已完成项只保留当天完成的。
      const today = agg.todayStr();
      const tasks = all.filter((t) => agg.isTodayTask(t, today)).map(decorate);
      const doneToday = tasks.filter((t) => t.done).length;
      const progress = tasks.length ? Math.round((doneToday / tasks.length) * 100) : 0;

      // 专注分钟：由专注/冥想足迹累计（专注 25 / 冥想 15）
      const focusMinutes = fps.reduce(
        (sum, f) => sum + (f.type === 'focus' ? 25 : f.type === 'meditate' ? 15 : 0),
        0
      );

      this.setData({
        pet: { name: pet.name, emoji: pet.emoji, img: pet.img, read: pet.read, anim: pet.anim, color: pet.color },
        petFace: pet.face || 'right',
        // 宠物贴住卡片边缘（脸朝右贴左、脸朝左贴右），另一侧整块留给对话气泡
        petStyle: petEdgeStyle(mineRes.current || 'orange', pet.face || 'right'),
        todayText: this.buildTodayText(),
        tasks,
        doneToday,
        totalToday: tasks.length,
        progress,
        doneTotal: agg.totalDone(all),
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
    // 左滑已打开时，先点一下只收起「删除」，不误触完成
    if (this.data.openId) { this.setData({ openId: '' }); return; }
    const before = this.data.tasks.find((t) => t._id === id);
    const wasDone = before ? before.done : false;
    try {
      const res = await cloud.taskService.toggle(id);
      const nowDone = res.done;
      const all = (this._all || this.data.tasks).map((t) =>
        t._id === id ? { ...t, done: nowDone, done_at: nowDone ? new Date() : null } : t
      );
      this._all = all;
      this.setData({
        doneTotal: agg.totalDone(all),
        streak: agg.computeStreak(all)
      });
      this.refreshToday(all);
      if (nowDone && !wasDone) this.onComplete(before, all);
      // 重复任务完成会在服务端生成下一条，本地列表需重新拉一次
      if (before && before.repeat && before.repeat !== 'none') this.loadAll();
    } catch (e) {}
  },

  refreshToday(all) {
    const today = agg.todayStr();
    const list = (all || []).filter((t) => agg.isTodayTask(t, today)).map(decorate);
    const doneToday = list.filter((t) => t.done).length;
    this.setData({
      tasks: list,
      doneToday,
      totalToday: list.length,
      progress: list.length ? Math.round((doneToday / list.length) * 100) : 0
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

    // 同一条任务只记一次足迹/回忆：反复勾选取消不会刷出一堆重复记录
    if (!already) {
      const line = bc.memoryLine(task.title, hashId(task._id), petName);
      cloud.sessionService.addFootprint('done', line, petName).catch(() => {});
      cloud.sessionService.saveMessage('pet', line, petName).catch(() => {});
    }

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
  onDue(e) { this.setData({ 'form.due': e.detail.value }); },
  onImportant(e) { this.setData({ 'form.important': e.detail.value }); },
  onRepeat(e) { this.setData({ 'form.repeatOn': e.detail.value }); },
  pickFreq(e) { this.setData({ 'form.freq': e.currentTarget.dataset.f }); },
  onCustomNum(e) { this.setData({ 'form.customNum': e.detail.value }); },
  onCustomUnit(e) { this.setData({ 'form.unitIdx': Number(e.detail.value) }); },

  // 重复频率串：none / daily / weekly / monthly / custom:Nd|Nw|Nm（与原型 buildRepeatStr 一致）
  buildRepeat() {
    const f = this.data.form;
    if (!f.repeatOn) return 'none';
    if (f.freq === 'custom') {
      const n = Math.max(1, Math.min(99, parseInt(f.customNum, 10) || 1));
      return `custom:${n}${this.data.units[f.unitIdx].v}`;
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
      this.loadAll();
    } catch (e) {}
  },

  // —— 待办左滑：露出「删除」（对齐原型 .task-swipe，待办右边没有叉）——
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
    if (lock === 'v' || Math.abs(dy) > Math.abs(dx)) return; // 竖向滚动，不处理
    if (dx > 30) { this.setData({ openId: '' }); return; }
    if (dx < -30) {
      // 已完成的行同样支持左滑删除（用户要求：已完成的也能滑、也能删）
      this.setData({ openId: id });
    }
  },

  // 点头像：弹出 / 收起「档案」小按钮（对齐原型 toggleArchive）
  toggleArchive() {
    this.setData({ archiveShow: !this.data.archiveShow });
  },
  hideArchive() {
    if (this.data.archiveShow) this.setData({ archiveShow: false });
  },
  // 点「档案」按钮：进档案页（原型 openArchive → 档案浮层）
  openArchive() {
    this.setData({ archiveShow: false });
    wx.navigateTo({ url: '/pages/mine/mine' });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/mine/mine' });
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ openId: '' });
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
