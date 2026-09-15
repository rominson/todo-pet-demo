Page({
  data: { running: false, display: '25:00', remain: 1500, timer: null },
  startMode(e) {
    const mode = e.currentTarget.dataset.mode;
    const map = { pomodoro: 1500, meditation: 600, whitenoise: 1800 };
    this.setData({ running: true, remain: map[mode] || 1500 });
    this.tick();
  },
  tick() {
    this.data.timer = setInterval(() => {
      let r = this.data.remain - 1;
      if (r <= 0) { clearInterval(this.data.timer); this.setData({ running: false, display: '00:00' }); return; }
      const m = String(Math.floor(r / 60)).padStart(2, '0');
      const s = String(r % 60).padStart(2, '0');
      this.setData({ remain: r, display: m + ':' + s });
    }, 1000);
  },
  stop() { clearInterval(this.data.timer); this.setData({ running: false }); }
});
