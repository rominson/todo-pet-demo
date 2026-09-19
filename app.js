// app.js —— 毛茸清单小程序入口
// CloudBase 环境已就绪：cloud1-d4gck1kjyb8ca2456（小程序成长计划）
App({
  globalData: {
    env: 'cloud1-d4gck1kjyb8ca2456',
    openid: null,
    // 宠物形象定义：橘小满(免费) + 12 星座(付费)
    personas: [
      { key: 'orange', name: '橘小满', free: true },
      // 12 星座（付费，价格待定，阶段4 接入虚拟支付）
      { key: 'aries', name: '白羊', free: false },
      { key: 'taurus', name: '金牛', free: false },
      { key: 'gemini', name: '双子', free: false },
      { key: 'cancer', name: '巨蟹', free: false },
      { key: 'leo', name: '狮子', free: false },
      { key: 'virgo', name: '处女', free: false },
      { key: 'libra', name: '天秤', free: false },
      { key: 'scorpio', name: '天蝎', free: false },
      { key: 'sagittarius', name: '射手', free: false },
      { key: 'capricorn', name: '摩羯', free: false },
      { key: 'aquarius', name: '水瓶', free: false },
      { key: 'pisces', name: '双鱼', free: false }
    ],
    currentPet: 'orange'
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    });

    // 匿名登录，拿到 openid（云函数/数据库写入需要）
    // 存成 promise：订单中心页可能被 path 直接打开，需要先等它完成再查库
    this.loginPromise = this.ensureLogin();
  },

  // 匿名登录：调 auth 云函数，由后端通过 getWXContext 返回 openid 并落库 users
  async ensureLogin() {
    try {
      const res = await wx.cloud.callFunction({ name: 'auth' });
      if (res && res.result && res.result.ok) {
        this.globalData.openid = res.result.openid;
        // 同步云端当前宠物，供各页 onShow 读取（切换宠物时已就近更新 globalData）
        const mine = await wx.cloud.callFunction({ name: 'petService', data: { action: 'getMine' } });
        if (mine && mine.result && mine.result.ok && mine.result.current) {
          this.globalData.currentPet = mine.result.current;
        }
      } else {
        console.warn('匿名登录未返回 openid:', res && res.result);
      }
    } catch (e) {
      console.warn('匿名登录失败（检查云函数是否已部署）:', e);
    }
  }
});
