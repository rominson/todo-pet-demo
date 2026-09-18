// pages/focus/focus.js —— 专注模式 / 冥想模式（对齐原型 screen-focus，无日历）
const cloud = require('../../utils/cloud.js');
const { getPet, petAnims } = require('../../utils/pets.js');
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
    btnText: '开始专注',
    taskTitle: ''
  },

  onLoad(q) {
    if (q && q.title) this.setData({ taskTitle: decodeURIComponent(q.title) });
  },
  onShow() {
    this.setTab(1);
    const key = (getApp().globalData.currentPet) || 'orange';
    const pet = getPet(key);
    this.anims = petAnims(key) || {};
    this.setData({
      pet: { name: pet.name, emoji: pet.emoji, read: pet.anim || pet.read, color: pet.color },
      // 日常态：看书动画（对齐原型 liveScene='' → read）
      sceneSrc: this.anims.read || pet.anim || pet.read,
      sceneLive: false
    });
  },

  // 自定义 tabBar：每个 tab 页各有一个组件实例，选中态要在 onShow 里同步
  setTab(i) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: i });
    }
  },

  // —— 场景动画（对齐原型 SCENE_BY_MODE：focus→敲键盘 / meditate→看日落 / 完成→咖啡6秒 / 中断→回看书）——
  setScene(scene) {
    const a = this.anims || {};
    if (scene === 'keyboard') this.setData({ sceneSrc: a.keyboard || a.read, sceneLive: true });
    else if (scene === 'sunset') this.setData({ sceneSrc: a.sunset || a.read, sceneLive: true });
    else if (scene === 'coffee') this.setData({ sceneSrc: a.coffee || a.read, sceneLive: true });
    else this.setData({ sceneSrc: a.read, sceneLive: false });
  },

  // —— 计时逻辑 ——
  switchMode(e) {
    if (this.data.running) return;
    const mode = e.currentTarget.dataset.mode;
    const total = mode === 'focus' ? 25 * 60 : 15 * 60;
    this.setData({
      mode,
      left: total,
      timeText: fmt(total),
      taskTitle: mode === 'meditate' ? '' : this.data.taskTitle,
      // 按钮文案跟模式走（对齐原型 switchMode：focus→开始专注 / meditate→开始冥想）
      btnText: mode === 'focus' ? '开始专注' : '开始冥想',
      sub: mode === 'focus'
        ? '从今日待办带一件事来，或者就这样开始'
        : '什么都不用选，跟着呼吸就好'
    });
  },

  start() {
    if (this.data.running) { this.finish(true); return; }
    const mode = this.data.mode;
    if (mode !== 'focus') this.setData({ taskTitle: '' });
    this.setData({
      running: true,
      sub: '',
      btnText: mode === 'focus' ? '专注中 · 点击结束' : '冥想中 · 点击结束'
    });
    // 陪伴动画跟状态走：专注→敲键盘 / 冥想→看日落（对齐原型 liveScene = focusMode）
    this.setScene(mode === 'focus' ? 'keyboard' : 'sunset');
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

  finish(completed) {
    if (this.timer) clearInterval(this.timer);
    if (this.coffeeTimer) { clearTimeout(this.coffeeTimer); this.coffeeTimer = null; }
    const mode = this.data.mode;
    // 结束后按钮回到「开始专注 / 开始冥想」
    const idleText = mode === 'focus' ? '开始专注' : '开始冥想';
    if (completed) {
      this.setData({ running: false, btnText: idleText });
      const minutes = mode === 'focus' ? 25 : 15;
      const content = mode === 'focus'
        ? `专注 ${minutes} 分钟${this.data.taskTitle ? '：' + this.data.taskTitle : ''}`
        : `冥想 ${minutes} 分钟`;
      cloud.sessionService.addFootprint(mode, content, this.data.pet.name).catch(() => {});
      const msg = bc.focusDone(mode, this.data.taskTitle, this.data.pet.name);
      cloud.sessionService.saveMessage('pet', msg, this.data.pet.name).catch(() => {});
      this.setData({
        sub: mode === 'focus'
          ? '搞定啦——陪你喝杯咖啡，慢慢回回神。'
          : '这阵呼吸记下了，喝口水，慢慢回来。'
      });
      // 完成庆祝：喝咖啡动画 6 秒后回到看书（对齐原型 coffeeTimer 6000ms）
      this.setScene('coffee');
      this.coffeeTimer = setTimeout(() => {
        this.coffeeTimer = null;
        this.setScene('');
        this.setData({
          sub: mode === 'focus' ? '从今日待办带一件事来，或者就这样开始' : '什么都不用选，跟着呼吸就好'
        });
      }, 6000);
    } else {
      this.setScene(''); // 中断：回到日常看书
      this.setData({
        running: false,
        btnText: idleText,
        sub: mode === 'focus'
          ? '从今日待办带一件事来，或者就这样开始'
          : '什么都不用选，跟着呼吸就好'
      });
    }
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
    if (this.coffeeTimer) clearTimeout(this.coffeeTimer);
  }
});
