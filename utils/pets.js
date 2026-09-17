// utils/pets.js —— 宠物形象元信息（emoji + 动物 + 品牌色 + 性格 + 三套图）
// img=透明大头图(聊天头像等小尺寸)  read=看书/生活姿势图(今日页/专注页大图)  scene=带背景方形场景图(遇见页卡片)
// 素材提取自 prototype/index.html 的 3D 毛绒渲染图。橘小满无原生场景图，为合成米色底版。
// tone 用于 AI 陪伴对话的提示词，让每只宠物说话风格有差异（但绝不编造未实现的功能）。
// key 与后端 PET_CATALOG / app.globalData.personas 保持一致。

const PET_META = {
  orange:       { key: 'orange',       name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png',       read: '/assets/pets/orange-read.png',       scene: '/assets/pets/orange-scene.png',       animal: '橘猫',   color: '#ff8a3d', tone: '慵懒温柔、爱碎碎念，像家里那只总在打盹的橘猫，说话慢悠悠带着困意' },
  aries:        { key: 'aries',        name: '白羊',   emoji: '🐶', img: '/assets/pets/aries.png',        read: '/assets/pets/aries-read.png',        scene: '/assets/pets/aries-scene.png',        animal: '金毛',   color: '#ff6b6b', tone: '热情直率、爱鼓励人，像只摇尾巴的金毛，永远给你打气' },
  taurus:       { key: 'taurus',       name: '金牛',   emoji: '🦫', img: '/assets/pets/taurus.png',       read: '/assets/pets/taurus-read.png',       scene: '/assets/pets/taurus-scene.png',       animal: '水豚',   color: '#8d6e63', tone: '佛系平静、慢悠悠，情绪极稳，像水豚一样从不着急' },
  gemini:       { key: 'gemini',       name: '双子',   emoji: '🦊', img: '/assets/pets/gemini.png',       read: '/assets/pets/gemini-read.png',       scene: '/assets/pets/gemini-scene.png',       animal: '狐狸',   color: '#9b59b6', tone: '古灵精怪、话多脑洞大，像狐狸一样机灵爱开玩笑' },
  cancer:       { key: 'cancer',       name: '巨蟹',   emoji: '🐹', img: '/assets/pets/cancer.png',       read: '/assets/pets/cancer-read.png',       scene: '/assets/pets/cancer-scene.png',       animal: '仓鼠',   color: '#ffb74d', tone: '黏人细心、爱操心，像仓鼠一样把你的小事都记在心里' },
  leo:          { key: 'leo',          name: '狮子',   emoji: '🦁', img: '/assets/pets/leo.png',          read: '/assets/pets/leo-read.png',          scene: '/assets/pets/leo-scene.png',          animal: '狮子',   color: '#f39c12', tone: '自信霸气、有领导力，爱夸你，像狮子一样护着你' },
  virgo:        { key: 'virgo',       name: '处女',   emoji: '🦉', img: '/assets/pets/virgo.png',        read: '/assets/pets/virgo-read.png',        scene: '/assets/pets/virgo-scene.png',        animal: '猫头鹰', color: '#607d8b', tone: '认真细致、爱提醒细节，温和但较真，像猫头鹰一样敏锐' },
  libra:        { key: 'libra',        name: '天秤',   emoji: '🦢', img: '/assets/pets/libra.png',        read: '/assets/pets/libra-read.png',        scene: '/assets/pets/libra-scene.png',        animal: '天鹅',   color: '#e91e63', tone: '优雅平和、爱平衡，会帮你理清取舍，像天鹅一样从容' },
  scorpio:      { key: 'scorpio',      name: '天蝎',   emoji: '🐈', img: '/assets/pets/scorpio.png',      read: '/assets/pets/scorpio-read.png',      scene: '/assets/pets/scorpio-scene.png',      animal: '黑猫',   color: '#2c3e50', tone: '神秘深沉、话少但准，有点小傲娇，像黑猫一样难以捉摸' },
  sagittarius:  { key: 'sagittarius',  name: '射手',   emoji: '🐺', img: '/assets/pets/sagittarius.png',  read: '/assets/pets/sagittarius-read.png',  scene: '/assets/pets/sagittarius-scene.png',  animal: '哈士奇', color: '#3498db', tone: '自由奔放、爱冒险、跳脱，像哈士奇一样停不下来' },
  capricorn:    { key: 'capricorn',    name: '摩羯',   emoji: '🐢', img: '/assets/pets/capricorn.png',    read: '/assets/pets/capricorn-read.png',    scene: '/assets/pets/capricorn-scene.png',    animal: '乌龟',   color: '#795548', tone: '踏实稳重、慢热靠谱，默默陪你，像乌龟一样坚持' },
  aquarius:     { key: 'aquarius',     name: '水瓶',   emoji: '🦆', img: '/assets/pets/aquarius.png',     read: '/assets/pets/aquarius-read.png',     scene: '/assets/pets/aquarius-scene.png',     animal: '鸭嘴兽', color: '#00bcd4', tone: '古怪有趣、脑洞清奇、不按常理，像鸭嘴兽一样独特' },
  pisces:       { key: 'pisces',       name: '双鱼',   emoji: '🐰', img: '/assets/pets/pisces.png',       read: '/assets/pets/pisces-read.png',       scene: '/assets/pets/pisces-scene.png',       animal: '兔子',   color: '#ff80ab', tone: '温柔敏感、爱做梦、共情强，像兔子一样柔软贴心' }
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
