// 离线演练 cloud/petService 的「免费补齐」闸门：用假 db 跑真实云函数代码
const Module = require('module');
const path = '/Users/luomingxin/WorkBuddy/2026-08-15-23-15-10/cloud/petService/index.js';

// —— 假数据库：只实现 where/get 与 add ——
let rows = [];
const db = {
  collection(name) {
    return {
      where(q) {
        return { get: async () => ({ data: rows.filter((r) => Object.keys(q).every((k) => r[k] === q[k])) }) };
      },
      add: async ({ data }) => { rows.push(data); return { _id: 'x' + rows.length }; }
    };
  }
};
const origLoad = Module._load;
Module._load = function (req) {
  if (req === 'wx-server-sdk') {
    return { init() {}, getWXContext: () => ({ OPENID: 'test-openid' }), database: () => db };
  }
  return origLoad.apply(this, arguments);
};
const fn = require(path);

const PAID = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const setOwned = (n) => { rows = PAID.slice(0, n).map((k) => ({ openid: 'test-openid', pet_key: k })); };

(async () => {
  let fail = 0;
  const cases = [
    { owned: 0,  expectOk: false, note: '白拿（未付过）' },
    { owned: 5,  expectOk: false, note: '已付 ¥30，还没到封顶，应走补差价下单' },
    { owned: 6,  expectOk: true,  note: '已付 ¥36 = 封顶，剩余 6 只应免费补齐' },
    { owned: 7,  expectOk: true,  note: '已付 ¥42 > 封顶，剩余 5 只应免费补齐' },
    { owned: 11, expectOk: true,  note: '剩余 1 只免费补齐' },
    { owned: 12, expectOk: true,  note: '已集齐 → already' }
  ];
  console.log('已拥有  结果    发放数  说明');
  for (const c of cases) {
    setOwned(c.owned);
    const before = rows.length;
    const r = await fn.main({ action: 'claimBundleRemainder' });
    const granted = rows.filter((x) => !PAID.slice(0, c.owned).includes(x.pet_key)).length;
    const ok = c.expectOk ? r.ok === true : r.ok === false;
    if (!ok) fail++;
    console.log(`${ok ? '✓' : '✗'} ${String(c.owned).padEnd(6)} ${String(r.ok).padEnd(6)} +${String(c.owned === 12 ? 0 : 12 - c.owned).padEnd(6)} ${c.note}${r.error ? '  ← ' + r.error : ''}${r.already ? '  ← already' : ''}`);
  }

  // —— 演示解锁闸门：DEMO_UNLOCK=0 时必须拒绝 ——
  console.log('\n演示解锁闸门：');
  process.env.DEMO_UNLOCK = '0';
  delete require.cache[require.resolve(path)];
  const fnOff = require(path);
  const a = await fnOff.main({ action: 'unlockAll' });
  const b = await fnOff.main({ action: 'unlock', petKey: 'aries' });
  const okOff = a.ok === false && b.ok === false;
  if (!okOff) fail++;
  console.log(`${okOff ? '✓' : '✗'} DEMO_UNLOCK=0 → unlockAll/unlock 均被拒绝（${a.error} / ${b.error}）`);

  console.log('\n' + (fail ? '有 ' + fail + ' 项不符' : '全部通过'));
  process.exit(fail ? 1 : 0);
})();
