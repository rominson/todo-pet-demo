// utils/pets.js —— 宠物形象元信息（前端占位：emoji + 动物 + 品牌色）
// 真实 3D 毛绒图后续走 CDN/云存储替换，这里用 emoji + 品牌色占位，保证架构完整、包体可控。
// key 与后端 PET_CATALOG / app.globalData.personas 保持一致。

const PET_META = {
  orange:       { key: 'orange',       name: '橘小满', emoji: '🐱', animal: '橘猫',   color: '#ff8a3d' },
  aries:        { key: 'aries',        name: '白羊',   emoji: '🐶', animal: '金毛',   color: '#ff6b6b' },
  taurus:       { key: 'taurus',       name: '金牛',   emoji: '🦫', animal: '水豚',   color: '#8d6e63' },
  gemini:       { key: 'gemini',       name: '双子',   emoji: '🦊', animal: '狐狸',   color: '#9b59b6' },
  cancer:       { key: 'cancer',       name: '巨蟹',   emoji: '🐹', animal: '仓鼠',   color: '#ffb74d' },
  leo:          { key: 'leo',          name: '狮子',   emoji: '🦁', animal: '狮子',   color: '#f39c12' },
  virgo:        { key: 'virgo',        name: '处女',   emoji: '🦉', animal: '猫头鹰', color: '#607d8b' },
  libra:        { key: 'libra',        name: '天秤',   emoji: '🦢', animal: '天鹅',   color: '#e91e63' },
  scorpio:      { key: 'scorpio',      name: '天蝎',   emoji: '🐈', animal: '黑猫',   color: '#2c3e50' },
  sagittarius:  { key: 'sagittarius',  name: '射手',   emoji: '🐺', animal: '哈士奇', color: '#3498db' },
  capricorn:    { key: 'capricorn',    name: '摩羯',   emoji: '🐢', animal: '乌龟',   color: '#795548' },
  aquarius:     { key: 'aquarius',     name: '水瓶',   emoji: '🦆', animal: '鸭嘴兽', color: '#00bcd4' },
  pisces:       { key: 'pisces',       name: '双鱼',   emoji: '🐰', animal: '兔子',   color: '#ff80ab' }
};

// 本命星座：根据生日（月/日）推算星座，再映射到宠物 key
function zodiacOf(m, d) {
  const md = m * 100 + d;
  if (md >= 1222 || md <= 119) return { name: '摩羯座', key: 'capricorn' };
  if (md >= 120 && md <= 218) return { name: '水瓶座', key: 'aquarius' };
  if (md >= 219 && md <= 320) return { name: '双鱼座', key: 'pisces' };
  if (md >= 321 && md <= 419) return { name: '白羊座', key: 'aries' };
  if (md >= 420 && md <= 520) return { name: '金牛座', key: 'taurus' };
  if (md >= 521 && md <= 621) return { name: '双子座', key: 'gemini' };
  if (md >= 622 && md <= 722) return { name: '巨蟹座', key: 'cancer' };
  if (md >= 723 && md <= 822) return { name: '狮子座', key: 'leo' };
  if (md >= 823 && md <= 922) return { name: '处女座', key: 'virgo' };
  if (md >= 923 && md <= 1023) return { name: '天秤座', key: 'libra' };
  if (md >= 1024 && md <= 1122) return { name: '天蝎座', key: 'scorpio' };
  if (md >= 1123 && md <= 1221) return { name: '射手座', key: 'sagittarius' };
  return { name: '摩羯座', key: 'capricorn' };
}

function getPet(key) {
  return PET_META[key] || PET_META.orange;
}

module.exports = { PET_META, zodiacOf, getPet };
