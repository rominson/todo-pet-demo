// 遇见页「全家桶」状态机离线校验：直接跑 pages/pets/pets.js 里的真实 load() 逻辑
// 用法：node /tmp/test_pets_bundle.js
const fs = require('fs');
const path = '/Users/luomingxin/WorkBuddy/2026-08-15-23-15-10/pages/pets/pets.js';
let src = fs.readFileSync(path, 'utf8');

// —— 把 require 换成桩（云服务与宠物元数据表）——
src = src.replace(/^const cloud = require\(.*$/m, 'const cloud = global.__cloud;');
src = src.replace(/^const \{ PET_META, ZODIAC_TRAITS \} = require\(.*$/m, 'const { PET_META, ZODIAC_TRAITS } = global.__pets;');
// 把 load() 里吞掉异常的 catch 临时改成打印，便于定位桩环境下的问题
src = src.replace('} catch (e) {}', '} catch (e) { console.error("LOAD ERR:", e && e.stack || e); }');

const PAID = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
global.__pets = {
  PET_META: { orange: { emoji:'🐱', scene:'o.png', color:'#f80', animal:'橘猫' } },
  ZODIAC_TRAITS: {}
};
PAID.forEach(k => { global.__pets.PET_META[k] = { emoji:'x', scene:k+'.png', color:'#000', animal:'a-' + k }; });

global.getApp = () => ({ globalData: {} });
// ⚠️ cloud 桩要在 eval 前就位：pets.js 顶部的 `const cloud = global.__cloud` 在 eval 时就取值，
//    之后换 global.__cloud 不会被看到 —— 所以这里的函数都转发到可变的 state.ownedList。
const state = { ownedList: ['orange'] };
global.__cloud = {
  petService: {
    getCatalog: async () => ({ catalog: [{ key:'orange', name:'橘小满', free:true, price:0 }].concat(
      PAID.map(k => ({ key:k, name:'N'+k, free:false, price:6 }))), prices: { single:6, bundle:36 } }),
    getMine: async () => ({ owned: state.ownedList.slice(), current: 'orange' }),
    claimBundleRemainder: async () => ({ ok:true, added: 0 })
  },
  payService: {}
};
global.wx = {
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
  getStorageSync: () => false,
  nextTick: (f) => f(),
  createSelectorQuery: () => ({ in(){return this;}, selectAll(){return this;}, boundingClientRect(){return this;}, exec(){} }),
  showToast(){}, showLoading(){}, hideLoading(){}, login(){}, showModal(){}, getSystemInfoSync: () => ({ platform:'devtools' })
};
let pageDef = null;
global.Page = (d) => { pageDef = d; };
eval(src);

async function scenario(ownedPaid) {
  state.ownedList = ['orange'].concat(PAID.slice(0, ownedPaid));
  const ctx = Object.create(pageDef);
  ctx.data = JSON.parse(JSON.stringify(pageDef.data));
  ctx.setData = function (o) { Object.assign(this.data, o); };
  await ctx.load();
  return {
    owned: ownedPaid,
    banner: ctx.data.showBanner,
    cta: ctx.data.showBundle,
    title: ctx.data.bundleTitle,
    sub: ctx.data.bundleSub,
    buy: ctx.data.bundleBuy,
    patch: ctx.data.bundlePatch,
    free: ctx.data.bundleFree,
    ownedCount: ctx.data.ownedCount
  };
}

(async () => {
  const expect = [
    { owned:0,  banner:true,  cta:true,  patch:36, free:false, title:'全家桶 ¥36', buy:'购买' },
    { owned:3,  banner:true,  cta:true,  patch:18, free:false, title:'全家桶 ¥18', buy:'购买' },
    { owned:5,  banner:true,  cta:true,  patch:6,  free:false, title:'全家桶 ¥6',  buy:'购买' },
    { owned:6,  banner:true,  cta:true,  patch:0,  free:true,  title:'补齐剩余 6 只', buy:'领取' },
    { owned:11, banner:true,  cta:true,  patch:0,  free:true,  title:'补齐剩余 1 只', buy:'领取' },
    { owned:12, banner:false, cta:false, patch:0,  free:false, title:'', buy:'' }
  ];
  let fail = 0;
  console.log('已拥有  横幅    悬浮条  补差价  免费领  悬浮条主文案        药丸   副文案');
  for (const e of expect) {
    const r = await scenario(e.owned);
    const ok = r.banner === e.banner && r.cta === e.cta && r.patch === e.patch && r.free === e.free
      && (e.owned === 12 ? true : r.title === e.title && r.buy === e.buy)
      && r.ownedCount === e.owned;
    if (!ok) fail++;
    console.log(`${ok ? '✓' : '✗'} ${String(r.owned).padEnd(7)} ${String(r.banner).padEnd(7)} ${String(r.cta).padEnd(7)} ${String(r.patch).padEnd(7)} ${String(r.free).padEnd(7)} ${(r.title || '(隐藏)').padEnd(20)} ${(r.buy || '-').padEnd(6)} ${r.sub || '-'}`);
  }
  console.log('\n' + (fail ? '有 ' + fail + ' 项不符' : '全部通过（6/6 档位）'));
  process.exit(fail ? 1 : 0);
})();
