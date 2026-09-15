// 云函数 auth —— 匿名登录：返回 openid 并落库 users / user_pets
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d4gck1kjyb8ca2456' });
const db = cloud.database();

// 云函数首次运行时确保所需集合存在（幂等）
const COLLECTIONS = ['users', 'tasks', 'sessions', 'footprints', 'user_pets', 'orders'];
async function ensureCollections() {
  for (const name of COLLECTIONS) {
    try { await db.createCollection(name); } catch (e) { /* 已存在则忽略 */ }
  }
}

exports.main = async () => {
  const { OPENID, APPID, ENV } = cloud.getWXContext();
  if (!OPENID) {
    return { ok: false, error: '无法获取用户身份（请在微信小程序中调用）' };
  }
  await ensureCollections();

  // 用户主记录
  const users = db.collection('users');
  const exist = await users.where({ openid: OPENID }).get();
  if (!exist.data.length) {
    await users.add({
      data: {
        openid: OPENID,
        appid: APPID,
        created_at: new Date(),
        owned_pets: ['orange'],
        current_pet: 'orange'
      }
    });
  }

  // 默认拥有橘小满（免费形象）
  const userPets = db.collection('user_pets');
  const up = await userPets.where({ openid: OPENID, pet_key: 'orange' }).get();
  if (!up.data.length) {
    await userPets.add({ data: { openid: OPENID, pet_key: 'orange', unlocked_at: new Date() } });
  }

  return { ok: true, openid: OPENID, env: ENV };
};
