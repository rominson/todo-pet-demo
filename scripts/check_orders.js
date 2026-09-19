// scripts/check_orders.js —— 订单中心页链路自检（不连网、不连库）
// ① 用假 wx-server-sdk 跑【真实云函数】payService 的 listOrders，验证字段映射/过滤/排序
// ② 用假 wx.cloud + 假 Page 跑【真实页面】pages/orders/orders.js 的 load()，验证渲染数据与合计
// 跑法：/Users/luomingxin/.workbuddy/binaries/node/versions/22.22.2-3/bin/node scripts/check_orders.js
const Module = require('module');
const path = require('path');
const assert = require('assert');

let pass = 0;
function ok(name) { pass++; console.log('  ✓ ' + name); }

const ME = 'orRAl0VfDvfX14a-IvhluFwfNNJ0';

// —— 假数据：3 笔本人的单（单只已付 / 全家桶未付 / 单只已付更早）+ 1 笔别人的单 ——
const ORDERS = [
  {
    _id: 'o1', openid: ME, order_id: 'T1758264000001', pet_key: 'libra', amount: 600,
    status: 'paid', created_at: new Date('2026-09-19T02:00:00Z'), paid_at: new Date('2026-09-19T02:01:00Z')
  },
  {
    _id: 'o2', openid: ME, order_id: 'T1758267000002', pet_key: '__bundle__', bundle: true, bundle_owned: 3,
    grant_keys: ['leo', 'virgo'], amount: 1800, status: 'created', created_at: new Date('2026-09-19T03:00:00Z')
  },
  {
    _id: 'o3', openid: ME, order_id: 'T1758177600003', pet_key: 'taurus', amount: 600,
    status: 'paid', created_at: new Date('2026-09-18T02:00:00Z'), paid_at: new Date('2026-09-18T02:00:30Z')
  },
  {
    _id: 'o4', openid: 'someone-else', order_id: 'T9999999999999', pet_key: 'leo', amount: 600,
    status: 'paid', created_at: new Date('2026-09-20T02:00:00Z')
  }
];

function makeDb() {
  return {
    collection(name) {
      const rows = name === 'orders' ? ORDERS.slice() : [];
      const q = {
        _where: null, _limit: null, _order: null,
        where(w) { this._where = w || null; return this; },
        orderBy(f, d) { this._order = [f, d]; return this; },
        limit(n) { this._limit = n; return this; },
        async get() {
          let out = rows.filter((r) => !this._where ||
            Object.entries(this._where).every(([k, v]) => r[k] === v));
          if (this._order) {
            const [f, d] = this._order;
            out.sort((a, b) => d === 'desc'
              ? new Date(b[f]) - new Date(a[f])
              : new Date(a[f]) - new Date(b[f]));
          }
          if (this._limit) out = out.slice(0, this._limit);
          return { data: out };
        }
      };
      return q;
    }
  };
}

(async () => {
  // ———————— ① 云函数 listOrders ————————
  console.log('① payService.listOrders（真实云函数代码 + 假数据库）');
  const fakeSdk = {
    init() {},
    database: () => makeDb(),
    getWXContext: () => ({ OPENID: ME })
  };
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'wx-server-sdk') return fakeSdk;
    return origLoad.apply(this, arguments);
  };
  const svc = require(path.join(__dirname, '..', 'cloud/payService/index.js'));
  const r = await svc.main({ action: 'listOrders' });
  Module._load = origLoad;

  assert(r.ok, 'listOrders 应返回 ok');
  ok('返回 ok');

  assert.strictEqual(r.list.length, 3, '只应返回本人 3 笔订单，实得 ' + r.list.length);
  ok('只查本人的订单（别人的那笔被过滤掉）');

  assert.strictEqual(r.list[0].orderId, 'T1758267000002', '应按创建时间倒序');
  ok('按时间从新到旧排序');

  const single = r.list.find((o) => o.orderId === 'T1758264000001');
  assert.strictEqual(single.title, '天秤', '单只订单标题应是星座名，实得 ' + single.title);
  assert.strictEqual(single.amountYuan, '6.00', '金额应按分转元，实得 ' + single.amountYuan);
  assert.strictEqual(single.statusText, '已支付');
  assert.strictEqual(single.createdAt, '2026-09-19 10:00', '应固定 +8h 北京时间，实得 ' + single.createdAt);
  assert.strictEqual(single.paidAt, '2026-09-19 10:01');
  ok('单只订单：标题/金额/状态/北京时间都对');

  const bundle = r.list.find((o) => o.orderId === 'T1758267000002');
  assert.strictEqual(bundle.title, '星座全家桶');
  assert(bundle.desc.indexOf('2 位') >= 0 && bundle.desc.indexOf('3 位') >= 0,
    '全家桶说明应含补齐数量与下单时已拥有数量，实得 ' + bundle.desc);
  assert.strictEqual(bundle.statusText, '待支付');
  assert.strictEqual(bundle.paidAt, '');
  ok('全家桶订单：标题/说明/待支付态都对');

  // limit 生效
  const r2 = await (async () => {
    Module._load = function (request) {
      if (request === 'wx-server-sdk') return fakeSdk;
      return origLoad.apply(this, arguments);
    };
    delete require.cache[require.resolve(path.join(__dirname, '..', 'cloud/payService/index.js'))];
    const s2 = require(path.join(__dirname, '..', 'cloud/payService/index.js'));
    const out = await s2.main({ action: 'listOrders', limit: 1 });
    Module._load = origLoad;
    return out;
  })();
  assert.strictEqual(r2.list.length, 1, 'limit 应生效');
  ok('limit 生效');

  // ———————— ② 页面 load() ————————
  console.log('② pages/orders/orders.js 的 load()（真实页面代码 + 假 wx.cloud）');
  const pageFixture = r.list; // 直接用云函数刚算出来的结果，闭环
  global.wx = {
    cloud: {
      callFunction({ success }) {
        success({ result: { ok: true, list: pageFixture, total: pageFixture.length } });
      }
    },
    switchTab() {},
    setClipboardData() {},
    showToast() {},
    getStorageSync: () => '',
    setStorageSync() {}
  };
  global.getApp = () => ({ loginPromise: Promise.resolve() });
  let page = null;
  global.Page = (o) => { page = o; };
  require(path.join(__dirname, '..', 'pages/orders/orders.js'));

  page.setData = function (d, cb) { Object.assign(this.data, d); if (cb) cb(); };
  page.data = Object.assign({}, page.data);
  await page.load();

  assert.strictEqual(page.data.loading, false);
  assert.strictEqual(page.data.err, false);
  assert.strictEqual(page.data.orders.length, 3);
  // 已支付合计 = 6.00 + 6.00（全家桶那笔是待支付，不计入）
  assert.strictEqual(page.data.totalYuan, '12.00', '已支付合计应为 12.00，实得 ' + page.data.totalYuan);
  ok('页面拿到订单、加载态收起、已支付合计只算 paid（12.00）');

  // 空态分支
  global.wx.cloud.callFunction = ({ success }) => success({ result: { ok: true, list: [], total: 0 } });
  page.data = { loading: true, err: false, errMsg: '', orders: ['x'], totalYuan: '0.00' };
  await page.load();
  assert.strictEqual(page.data.orders.length, 0);
  assert.strictEqual(page.data.totalYuan, '0.00');
  ok('空列表时 orders 为空、合计 0.00（wxml 走空态分支）');

  // 失败分支：不跳首页，页面进错误态
  let jumped = false;
  global.wx.switchTab = () => { jumped = true; };
  global.wx.cloud.callFunction = ({ fail }) => fail(new Error('network down'));
  page.data = { loading: true, err: false, errMsg: '', orders: [], totalYuan: '0.00' };
  await page.load();
  assert.strictEqual(page.data.err, true);
  assert.strictEqual(page.data.loading, false);
  assert.strictEqual(jumped, false, '失败时绝不能跳转到别的页面');
  ok('加载失败：进入错误态并留在本页（不跳首页、不白屏）');

  console.log('\n全部通过：' + pass + ' 项');
})().catch((e) => {
  console.error('\n❌ 断言失败：', e.message);
  process.exit(1);
});
