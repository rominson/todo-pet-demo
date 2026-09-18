// custom-tab-bar —— 自定义 tabBar（app.json tabBar.custom = true）
// 为什么不用原生 tabBar：原生 iconPath 指向的图标 PNG 本身完全正常（81×81 / 8bit RGBA / 非交错，
// 激活态 #7F70D8、未激活态 #8B857C），但在本机开发者工具里始终不渲染，开关也排查过。
// 改用组件内 <image> 引用本地图标（WXML 里被引用 → 不可能被"无依赖文件"过滤），彻底绕开该问题。
Component({
  data: {
    selected: 0,
    list: [
      { path: '/pages/index/index',       text: '今日', icon: '/assets/tab/today.png',    active: '/assets/tab/today-active.png' },
      { path: '/pages/focus/focus',       text: '专注', icon: '/assets/tab/focus.png',    active: '/assets/tab/focus-active.png' },
      { path: '/pages/quadrant/quadrant', text: '象限', icon: '/assets/tab/quad.png',     active: '/assets/tab/quad-active.png' },
      { path: '/pages/calendar/calendar', text: '日历', icon: '/assets/tab/calendar.png', active: '/assets/tab/calendar-active.png' },
      { path: '/pages/pets/pets',         text: '遇见', icon: '/assets/tab/meet.png',     active: '/assets/tab/meet-active.png' }
    ]
  },
  methods: {
    onTap(e) {
      const i = Number(e.currentTarget.dataset.i);
      const item = this.data.list[i];
      if (!item || i === this.data.selected) return;
      wx.switchTab({ url: item.path });
    }
  }
});
