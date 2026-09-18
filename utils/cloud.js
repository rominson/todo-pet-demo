// utils/cloud.js —— 云函数调用封装 + 各服务高层接口
// 所有接口以「动作字段 action」区分，返回结构统一为 { ok, ... }，
// 这里把 ok=false 的 error 统一转成 reject，调用方 try/catch 即可。

function call(name, data = {}, opts = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        const r = res.result || {};
        if (r.ok) return resolve(r);
        if (!opts.silent) {
          wx.showToast({ title: (r.error || '出错了').slice(0, 30), icon: 'none' });
        }
        reject(new Error(r.error || '调用失败'));
      },
      fail: (err) => {
        if (!opts.silent) wx.showToast({ title: '网络异常，稍后重试', icon: 'none' });
        reject(err);
      }
    });
  });
}

const auth = {
  login: () => call('auth')
};

const taskService = {
  create: (payload) => call('taskService', { action: 'create', ...payload }),
  list: () => call('taskService', { action: 'list' }),
  update: (id, patch) => call('taskService', { action: 'update', id, ...patch }),
  toggle: (id) => call('taskService', { action: 'toggle', id }),
  remove: (id) => call('taskService', { action: 'remove', id }),
  clearDone: () => call('taskService', { action: 'clearDone' })
};

const sessionService = {
  saveMessage: (role, content, pet) =>
    call('sessionService', { action: 'saveMessage', role, content, pet }),
  getHistory: (limit = 30, pet) =>
    call('sessionService', { action: 'getHistory', limit, pet }),
  addFootprint: (type, content, pet) =>
    call('sessionService', { action: 'addFootprint', type, content, pet }),
  getFootprints: (limit = 50) =>
    call('sessionService', { action: 'getFootprints', limit })
};

const petService = {
  getCatalog: () => call('petService', { action: 'getCatalog' }),
  getMine: () => call('petService', { action: 'getMine' }),
  unlock: (petKey) => call('petService', { action: 'unlock', petKey }),
  // 一键解锁全部付费伙伴（仅开发/体验版的演示路径使用，正式版走 payService）
  unlockAll: () => call('petService', { action: 'unlockAll' }),
  setCurrent: (petKey) => call('petService', { action: 'setCurrent', petKey })
};

const payService = {
  createOrder: (petKey, code) => call('payService', { action: 'createOrder', petKey, code }),
  // 全家桶：一次买断剩余全部 12 星座伙伴（按已拥有数量自动补差价）
  createOrderBundle: (code) => call('payService', { action: 'createOrder', bundle: true, code }),
  confirmPay: (orderId, wxOrderId) => call('payService', { action: 'confirmPay', orderId, wxOrderId }),
  queryOrder: (orderId) => call('payService', { action: 'query', orderId })
};

// AI 对话：传入 messages 数组（[{role, content}]），返回 { ok, text }
const petChat = (messages) => call('petChat', { messages }, { silent: true });

module.exports = {
  call, auth, taskService, sessionService, petService, payService, petChat
};
