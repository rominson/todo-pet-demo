// src/pets.js —— 宠物形象元信息（移植自小程序 utils/pets.js）
// 桌面端把本地兜底图从 /assets/pets/ 改为 /pets/（见 public/pets/）；
// 动图 anim 与遇见页场景图 scene 仍走 CDN（与小程序共用同一份云存储）。

const CDN_ROOT = 'https://636c-cloud1-d4gck1kjyb8ca2456-1461749586.tcb.qcloud.la/pets/';
const ANIM_CDN = CDN_ROOT + 'anim/';
const SCENE_CDN = CDN_ROOT + 'scene/';

export const PET_META = {
  orange:       { face: 'right', key: 'orange',       name: '橘小满', emoji: '🐱', img: '/pets/orange.png',       read: '/pets/orange-read.png',       scene: SCENE_CDN + 'orange-scene.png',       anim: '/pets/orange-read.gif', animal: '橘猫',   color: '#ff8a3d', tone: '慵懒温柔、爱碎碎念，像家里那只总在打盹的橘猫，说话慢悠悠带着困意' },
  aries:        { face: 'left',  key: 'aries',        name: '白羊',   emoji: '🐶', img: '/pets/orange.png',       read: '/pets/aries-read.png',        scene: SCENE_CDN + 'aries-scene.png',        anim: '/pets/aries-read.gif',        animal: '金毛',   color: '#ff6b6b', tone: '热情直率、爱鼓励人，像只摇尾巴的金毛，永远给你打气' },
  taurus:       { face: 'left',  key: 'taurus',       name: '金牛',   emoji: '🦫', img: '/pets/taurus.png',       read: '/pets/taurus-read.png',       scene: SCENE_CDN + 'taurus-scene.png',       anim: '/pets/taurus-read.gif',       animal: '水豚',   color: '#8d6e63', tone: '佛系平静、慢悠悠，情绪极稳，像水豚一样从不着急' },
  gemini:       { face: 'left',  key: 'gemini',       name: '双子',   emoji: '🦊', img: '/pets/gemini.png',       read: '/pets/gemini-read.png',       scene: SCENE_CDN + 'gemini-scene.png',       anim: '/pets/gemini-read.gif',       animal: '狐狸',   color: '#9b59b6', tone: '古灵精怪、话多脑洞大，像狐狸一样机灵爱开玩笑' },
  cancer:       { face: 'left',  key: 'cancer',       name: '巨蟹',   emoji: '🐹', img: '/pets/cancer.png',       read: '/pets/cancer-read.png',       scene: SCENE_CDN + 'cancer-scene.png',       anim: '/pets/cancer-read.gif',       animal: '仓鼠',   color: '#ffb74d', tone: '黏人细心、爱操心，像仓鼠一样把你的小事都记在心里' },
  leo:          { face: 'right', key: 'leo',          name: '狮子',   emoji: '🦁', img: '/pets/leo.png',          read: '/pets/leo-read.png',          scene: SCENE_CDN + 'leo-scene.png',          anim: '/pets/leo-read.gif',          animal: '狮子',   color: '#f39c12', tone: '自信霸气、有领导力，爱夸你，像狮子一样护着你' },
  virgo:        { face: 'left',  key: 'virgo',       name: '处女',   emoji: '🦉', img: '/pets/virgo.png',        read: '/pets/virgo-read.png',        scene: SCENE_CDN + 'virgo-scene.png',        anim: '/pets/virgo-read.gif',        animal: '猫头鹰', color: '#607d8b', tone: '认真细致、爱提醒细节，温和但较真，像猫头鹰一样敏锐' },
  libra:        { face: 'right', key: 'libra',        name: '天秤',   emoji: '🦢', img: '/pets/libra.png',        read: '/pets/libra-read.png',        scene: SCENE_CDN + 'libra-scene.png',        anim: '/pets/libra-read.gif',        animal: '天鹅',   color: '#e91e63', tone: '优雅平和、爱平衡，会帮你理清取舍，像天鹅一样从容' },
  scorpio:      { face: 'left',  key: 'scorpio',      name: '天蝎',   emoji: '🐈', img: '/pets/scorpio.png',      read: '/pets/scorpio-read.png',      scene: SCENE_CDN + 'scorpio-scene.png',      anim: '/pets/scorpio-read.gif',      animal: '黑猫',   color: '#2c3e50', tone: '神秘深沉、话少但准，有点小傲娇，像黑猫一样难以捉摸' },
  sagittarius:  { face: 'left',  key: 'sagittarius',  name: '射手',   emoji: '🐺', img: '/pets/sagittarius.png',  read: '/pets/sagittarius-read.png',  scene: SCENE_CDN + 'sagittarius-scene.png',  anim: '/pets/sagittarius-read.gif', animal: '哈士奇', color: '#3498db', tone: '自由奔放、爱冒险、跳脱，像哈士奇一样停不下来' },
  capricorn:    { face: 'right', key: 'capricorn',    name: '摩羯',   emoji: '🐢', img: '/pets/capricorn.png',    read: '/pets/capricorn-read.png',    scene: SCENE_CDN + 'capricorn-scene.png',    anim: '/pets/capricorn-read.gif',    animal: '乌龟',   color: '#795548', tone: '踏实稳重、慢热靠谱，默默陪你，像乌龟一样坚持' },
  aquarius:     { face: 'right', key: 'aquarius',     name: '水瓶',   emoji: '🦆', img: '/pets/aquarius.png',     read: '/pets/aquarius-read.png',     scene: SCENE_CDN + 'aquarius-scene.png',     anim: '/pets/aquarius-read.gif',     animal: '鸭嘴兽', color: '#00bcd4', tone: '古怪有趣、脑洞清奇、不按常理，像鸭嘴兽一样独特' },
  pisces:       { face: 'left',  key: 'pisces',       name: '双鱼',   emoji: '🐰', img: '/pets/pisces.png',       read: '/pets/pisces-read.png',       scene: SCENE_CDN + 'pisces-scene.png',       anim: '/pets/pisces-read.gif',      animal: '兔子',   color: '#ff80ab', tone: '温柔敏感、爱做梦、共情强，像兔子一样柔软贴心' }
};

// 今日页「贴边偏移」（rpx，来自小程序 pets.js，已对 2x 素材复核；桌面用 petEdgeStylePx 转 px）
const PET_SHIFT = {
  orange: { l: 140, r: 139 }, aries: { l: 158, r: 141 }, taurus: { l: 205, r: 203 },
  gemini: { l: 188, r: 106 }, cancer: { l: 198, r: 113 }, leo: { l: 192, r: 181 },
  virgo: { l: 174, r: 169 }, libra: { l: 165, r: 189 }, scorpio: { l: 184, r: 97 },
  sagittarius: { l: 160, r: 131 }, capricorn: { l: 172, r: 164 }, aquarius: { l: 133, r: 151 },
  pisces: { l: 209, r: 212 }
};

// 「宠物在 210×210 壳内的可见内容边界」（逻辑 px，由 scripts/scan_pet_box.py 扫 GIF 的 alpha 通道得出，
// 取全部动画帧的并集 → 稳定、永不被宠物压到）。桌面端所有「贴边定位」都必须用它：
// 素材四周透明留白极大（可见内容仅占壳宽 36%~79%），拿 210 的壳算间距会得出「离宠物老远」的观感。
export const PET_BOX = {
  aquarius: { l: 49, r: 155, t: 57, b: 158 }, aries: { l: 57, r: 159, t: 55, b: 159 },
  cancer: { l: 70, r: 168, t: 62, b: 158 }, capricorn: { l: 62, r: 151, t: 57, b: 152 },
  gemini: { l: 67, r: 171, t: 62, b: 160 }, leo: { l: 69, r: 145, t: 63, b: 148 },
  libra: { l: 59, r: 142, t: 51, b: 161 }, orange: { l: 43, r: 168, t: 35, b: 176 },
  pisces: { l: 74, r: 134, t: 53, b: 154 }, sagittarius: { l: 58, r: 162, t: 60, b: 158 },
  scorpio: { l: 66, r: 174, t: 63, b: 159 }, taurus: { l: 73, r: 138, t: 66, b: 151 },
  virgo: { l: 63, r: 149, t: 62, b: 154 }
};

export const ZODIAC_TRAITS = {
  aries: '活力 · 冲动', taurus: '稳重 · 慢热', gemini: '机灵 · 多变', cancer: '温柔 · 敏感',
  leo: '自信 · 张扬', virgo: '挑剔 · 细致', libra: '优雅 · 纠结', scorpio: '神秘 · 深沉',
  sagittarius: '自由 · 冒险', capricorn: '沉稳 · 长寿', aquarius: '独特 · 反叛', pisces: '梦幻 · 感性',
  orange: '慵懒 · 陪伴'
};

export const ZODIAC_NAME = {
  aries: '白羊座', taurus: '金牛座', gemini: '双子座', cancer: '巨蟹座', leo: '狮子座',
  virgo: '处女座', libra: '天秤座', scorpio: '天蝎座', sagittarius: '射手座',
  capricorn: '摩羯座', aquarius: '水瓶座', pisces: '双鱼座', orange: '本命'
};

export function zodiacOf(m, d) {
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

export function getPet(key) {
  return PET_META[key] || PET_META.orange;
}

const NAME_TO_KEY = {};
Object.keys(PET_META).forEach((k) => { NAME_TO_KEY[PET_META[k].name] = k; });
export function getPetByName(name) {
  if (!name) return null;
  return PET_META[NAME_TO_KEY[name]] || null;
}

// 桌面端像素版边距（rpx/2）。face='right'（宠物朝右）→ 贴左；face='left' → 贴右。
export function petEdgeStylePx(key, face) {
  const s = PET_SHIFT[key] || { l: 140, r: 140 };
  const v = (face === 'left' ? s.r : s.l) / 2;
  return face === 'left' ? `right:-${v}px` : `left:-${v}px`;
}

const ANIM_FALLBACK = { aries: { coffee: 'read' } };
const animsCache = {};
export function petAnims(key) {
  if (animsCache[key]) return animsCache[key];
  const p = PET_META[key];
  if (!p) return null;
  const fb = ANIM_FALLBACK[key] || {};
  const anims = {
    read: p.anim,
    keyboard: '/pets/' + key + '-laptop.gif',
    sunset: ANIM_CDN + key + '-' + (fb.sunset || 'frame') + '.gif',
    coffee: ANIM_CDN + key + '-' + (fb.coffee || 'coffee') + '.gif'
  };
  animsCache[key] = anims;
  return anims;
}

export { PET_SHIFT };
