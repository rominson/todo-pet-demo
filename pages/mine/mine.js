// pages/mine/mine.js —— 宠物档案（对齐原型 sheet-profile / renderPets / renderAnniversaries）
// 数据口径：
//   陪伴天数 = 初次相遇日(firstOpen) → 今天（与今日页 getCompanionDays 保持一致）
//   一起完成 = 已完成的待办总数
//   专注小时 = 专注/冥想足迹分钟数之和 ÷ 60（原型 renderFocusHours）
//   纪念日   = 原型 milestones [7, 100] 实时计算
// 注意：原型档案浮层里没有「我的生日」「重要节点提醒」，也没有分享按钮 —— 已移除，不要加回来。
const cloud = require('../../utils/cloud.js');
const { getPet, petAnims } = require('../../utils/pets.js');
const agg = require('../../utils/agg.js');

const MILESTONES = [7, 100];

Page({
  data: {
    pet: { name: '橘小满', emoji: '🐱', color: '#ff8a3d' },
    petAnim: getPet('orange').anim,          // 动图在云存储 CDN
    petFallback: getPet('orange').read,      // CDN 拉不到时回落的本地静态图
    petErr: false,
    companionDays: 1,
    doneTotal: 0,
    focusHours: 0,
    annivs: [],
    memories: [],
    summaryText: '',
    statusBarHeight: 44,
    pageTop: 96
  },

  onLoad() {
    // 本页用自定义导航（navigationStyle: custom），需自行让出状态栏高度
    let sb = 44;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      sb = info.statusBarHeight || 44;
    } catch (e) {}
    this.setData({ statusBarHeight: sb, pageTop: sb + 56 });
  },

  onShow() { this.load(); },

  getFirstMet() {
    let first = wx.getStorageSync('firstOpen');
    if (!first) { first = agg.todayStr(); wx.setStorageSync('firstOpen', first); }
    return first;
  },

  getCompanionDays() {
    const a = new Date(this.getFirstMet() + 'T00:00:00');
    const b = new Date(agg.todayStr() + 'T00:00:00');
    return Math.max(1, Math.floor((b - a) / 86400000) + 1);
  },

  // 原型 renderAnniversaries：过了就「第 N 天 · 已过」，没过就「第 N 天 · 还有 X 天」
  buildAnnivs(days) {
    return MILESTONES.map((m) => {
      const passed = days >= m;
      return {
        day: m,
        passed,
        label: passed ? `第 ${m} 天 · 已过` : `第 ${m} 天 · 还有 ${Math.max(0, m - days)} 天`,
        tail: passed ? '"认识你一周了。"' : '"到时候给你看个东西。"'
      };
    });
  },

  async load() {
    try {
      const [mine, list, fps] = await Promise.all([
        cloud.petService.getMine(),
        cloud.taskService.list(),
        cloud.sessionService.getFootprints(200).catch(() => ({ list: [] }))
      ]);
      const key = mine.current || 'orange';
      const pet = getPet(key);
      const anims = petAnims(key) || {};
      const tasks = list.list || [];
      const fpsList = fps.list || [];
      const companionDays = this.getCompanionDays();
      const doneTotal = agg.totalDone(tasks);

      // 专注小时：专注 25 分钟 / 冥想 15 分钟（与今日页 focusMinutes 同一口径）
      const mins = fpsList.reduce(
        (sum, f) => sum + (f.type === 'focus' ? 25 : f.type === 'meditate' ? 15 : 0),
        0
      );

      const memories = fpsList
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map((f) => ({
          id: f._id,
          date: agg.toDateStr(f.created_at).slice(5).replace('-', '.'),
          content: f.content,
          milestone: f.type === 'milestone'
        }));

      this.setData({
        pet: { name: pet.name, emoji: pet.emoji, color: pet.color },
        // 原型档案头像 = 当前宠物的「看书」动图（CDN）；拉不到时回落本地静态图
        petAnim: anims.read || pet.anim || pet.read,
        petFallback: pet.read,
        petErr: false,
        companionDays,
        doneTotal,
        focusHours: Math.round(mins / 60),
        annivs: this.buildAnnivs(companionDays),
        memories,
        summaryText: `${pet.name}已经陪你 ${companionDays} 天，一起搞定了 ${doneTotal} 件待办。`
      });
    } catch (e) {}
  },

  // 头像动图在 CDN，网络异常时回落到本地静态「看书图」，避免头像空着
  onPetErr() {
    if (!this.data.petErr) this.setData({ petErr: true });
  },

  // 左上角返回（原「关掉档案」；按钮从右上角挪到左上角，避开微信胶囊）
  goBack() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    return { title: this.data.summaryText, path: '/pages/index/index' };
  }
});
