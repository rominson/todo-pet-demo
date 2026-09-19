// utils/pets.js —— 宠物形象元信息（emoji + 动物 + 品牌色 + 性格 + 图组）
// img=透明大头图(聊天头像等小尺寸)  read=看书/生活姿势图(今日页/专注页大图)  scene=带背景方形场景图(遇见页卡片)
// anim=APNG/GIF 真动图（原型 pet-img 用的就是它，浏览器/微信 image 原生播放）。
// 13 只宠物全部配齐：动图（anim）与遇见页场景图（scene）**都在云存储 CDN**；
// 本地只留三样小素材 —— 头像 img、看书图 read（动图加载失败时的兜底）、底部 tab 图标。
// 这样代码包内的图片总量才能压到 200K 以内（微信「代码质量」的图片音频检查项）。
// 素材提取自 prototype/index.html 的 3D 毛绒渲染图。橘小满无原生场景图，为合成米色底版。
// tone 用于 AI 陪伴对话的提示词，让每只宠物说话风格有差异（但绝不编造未实现的功能）。
// key 与后端 PET_CATALOG / app.globalData.personas 保持一致。

// 云存储 CDN（权限「所有用户可读」→ 无签名永久链接可直接作 <image> src，image 组件不受域名白名单限制）
//   anim/  —— 53 段动图 pets/anim/<pet>-<pose>.gif，pose=laptop/frame/read/stand/coffee
//             + 橘小满 4 段（read=看书 / laptop=敲键盘 / frame=看日落 / coffee=喝咖啡，均已做帧间优化）
//             橘小满 orange-read.gif 为 482×340（2 倍分辨率，书名压在 GIF 上会糊，见下方说明）
//   scene/ —— 13 张遇见页场景图 pets/scene/<pet>-scene.png（480×480，带背景）
//
// ⚠️ 2026-09-19 修正：libra(天秤=天鹅) 与 aquarius(水瓶=鸭嘴兽) 的素材曾**整组装反**。
//    判据（唯一权威）：原型 prototype/index.html 内嵌图的变量名 —— #68-71 = SCENE_SWAN_*、
//    #88-91 = SCENE_PLATYPUS_*，而 #8/#12 的 alt 也写明「天鹅/鸭嘴兽」。
//    已交换本地 assets/pets/{libra,aquarius}*.png 与 CDN anim/、scene/ 下的同名文件。
//    今后核对素材一律看原型 alt / 变量名，**不要靠画风猜**；PET_SHIFT 需同步重扫。
const CDN_ROOT = 'https://636c-cloud1-d4gck1kjyb8ca2456-1461749586.tcb.qcloud.la/pets/';
const ANIM_CDN = CDN_ROOT + 'anim/';
const SCENE_CDN = CDN_ROOT + 'scene/';

const PET_META = {
  // face 取值来自原型里的 PET_FACING 表（原型作者按素材定的朝向，逐只核对过，勿凭感觉改）：
  //   橘小满 right / 仓鼠 left / 黑猫 left / 哈士奇 left / 狐狸 left / 水豚 left / 天鹅 right
  //   金毛 left / 狮子 right / 猫头鹰 left / 鸭嘴兽 right / 乌龟 right / 兔子 left
  orange:       { face: 'right', key: 'orange',       name: '橘小满', emoji: '🐱', img: '/assets/pets/orange.png',       read: '/assets/pets/orange-read.png',       scene: SCENE_CDN + 'orange-scene.png',       anim: ANIM_CDN + 'orange-read.gif', animal: '橘猫',   color: '#ff8a3d', tone: '慵懒温柔、爱碎碎念，像家里那只总在打盹的橘猫，说话慢悠悠带着困意' },
  aries:        { face: 'left', key: 'aries',        name: '白羊',   emoji: '🐶', img: '/assets/pets/aries.png',        read: '/assets/pets/aries-read.png',        scene: SCENE_CDN + 'aries-scene.png',        anim: ANIM_CDN + 'aries-read.gif',        animal: '金毛',   color: '#ff6b6b', tone: '热情直率、爱鼓励人，像只摇尾巴的金毛，永远给你打气' },
  taurus:       { face: 'left', key: 'taurus',       name: '金牛',   emoji: '🦫', img: '/assets/pets/taurus.png',       read: '/assets/pets/taurus-read.png',       scene: SCENE_CDN + 'taurus-scene.png',       anim: ANIM_CDN + 'taurus-read.gif',       animal: '水豚',   color: '#8d6e63', tone: '佛系平静、慢悠悠，情绪极稳，像水豚一样从不着急' },
  gemini:       { face: 'left', key: 'gemini',       name: '双子',   emoji: '🦊', img: '/assets/pets/gemini.png',       read: '/assets/pets/gemini-read.png',       scene: SCENE_CDN + 'gemini-scene.png',       anim: ANIM_CDN + 'gemini-read.gif',       animal: '狐狸',   color: '#9b59b6', tone: '古灵精怪、话多脑洞大，像狐狸一样机灵爱开玩笑' },
  cancer:       { face: 'left', key: 'cancer',       name: '巨蟹',   emoji: '🐹', img: '/assets/pets/cancer.png',       read: '/assets/pets/cancer-read.png',       scene: SCENE_CDN + 'cancer-scene.png',       anim: ANIM_CDN + 'cancer-read.gif',       animal: '仓鼠',   color: '#ffb74d', tone: '黏人细心、爱操心，像仓鼠一样把你的小事都记在心里' },
  leo:          { face: 'right', key: 'leo',          name: '狮子',   emoji: '🦁', img: '/assets/pets/leo.png',          read: '/assets/pets/leo-read.png',          scene: SCENE_CDN + 'leo-scene.png',          anim: ANIM_CDN + 'leo-read.gif',          animal: '狮子',   color: '#f39c12', tone: '自信霸气、有领导力，爱夸你，像狮子一样护着你' },
  virgo:        { face: 'left', key: 'virgo',       name: '处女',   emoji: '🦉', img: '/assets/pets/virgo.png',        read: '/assets/pets/virgo-read.png',        scene: SCENE_CDN + 'virgo-scene.png',        anim: ANIM_CDN + 'virgo-read.gif',        animal: '猫头鹰', color: '#607d8b', tone: '认真细致、爱提醒细节，温和但较真，像猫头鹰一样敏锐' },
  libra:        { face: 'right', key: 'libra',        name: '天秤',   emoji: '🦢', img: '/assets/pets/libra.png',        read: '/assets/pets/libra-read.png',        scene: SCENE_CDN + 'libra-scene.png',        anim: ANIM_CDN + 'libra-read.gif',        animal: '天鹅',   color: '#e91e63', tone: '优雅平和、爱平衡，会帮你理清取舍，像天鹅一样从容' },
  scorpio:      { face: 'left', key: 'scorpio',      name: '天蝎',   emoji: '🐈', img: '/assets/pets/scorpio.png',      read: '/assets/pets/scorpio-read.png',      scene: SCENE_CDN + 'scorpio-scene.png',      anim: ANIM_CDN + 'scorpio-read.gif',      animal: '黑猫',   color: '#2c3e50', tone: '神秘深沉、话少但准，有点小傲娇，像黑猫一样难以捉摸' },
  sagittarius:  { face: 'left', key: 'sagittarius',  name: '射手',   emoji: '🐺', img: '/assets/pets/sagittarius.png',  read: '/assets/pets/sagittarius-read.png',  scene: SCENE_CDN + 'sagittarius-scene.png',  anim: ANIM_CDN + 'sagittarius-stand.gif', animal: '哈士奇', color: '#3498db', tone: '自由奔放、爱冒险、跳脱，像哈士奇一样停不下来' },
  capricorn:    { face: 'right', key: 'capricorn',    name: '摩羯',   emoji: '🐢', img: '/assets/pets/capricorn.png',    read: '/assets/pets/capricorn-read.png',    scene: SCENE_CDN + 'capricorn-scene.png',    anim: ANIM_CDN + 'capricorn-read.gif',    animal: '乌龟',   color: '#795548', tone: '踏实稳重、慢热靠谱，默默陪你，像乌龟一样坚持' },
  aquarius:     { face: 'right', key: 'aquarius',     name: '水瓶',   emoji: '🦆', img: '/assets/pets/aquarius.png',     read: '/assets/pets/aquarius-read.png',     scene: SCENE_CDN + 'aquarius-scene.png',     anim: ANIM_CDN + 'aquarius-read.gif',     animal: '鸭嘴兽', color: '#00bcd4', tone: '古怪有趣、脑洞清奇、不按常理，像鸭嘴兽一样独特' },
  pisces:       { face: 'left', key: 'pisces',       name: '双鱼',   emoji: '🐰', img: '/assets/pets/pisces.png',       read: '/assets/pets/pisces-read.png',       scene: SCENE_CDN + 'pisces-scene.png',       anim: ANIM_CDN + 'pisces-stand.gif',      animal: '兔子',   color: '#ff80ab', tone: '温柔敏感、爱做梦、共情强，像兔子一样柔软贴心' }
};

// 星座性格标签（对齐原型 screen-store 的 a-zodiac 文案：白羊座 · 活力 · 冲动）
const ZODIAC_TRAITS = {
  aries: '活力 · 冲动', taurus: '稳重 · 慢热', gemini: '机灵 · 多变', cancer: '温柔 · 敏感',
  leo: '自信 · 张扬', virgo: '挑剔 · 细致', libra: '优雅 · 纠结', scorpio: '神秘 · 深沉',
  sagittarius: '自由 · 冒险', capricorn: '沉稳 · 长寿', aquarius: '独特 · 反叛', pisces: '梦幻 · 感性',
  orange: '慵懒 · 陪伴'
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

// —— 今日页「贴边偏移」——
// 动图素材四周带白边，且每只宠物的本体在画布里的横向位置都不同（留白 20%~36%）。
// 今日页要让宠物尽量贴住卡片边缘、把另一侧整块留给对话气泡，
// 所以按展示框 622×380rpx（= .pet-img 的尺寸）+ aspectFit 反算出「把白边推出画框」的位移量。
// 算法：scale = min(622/W, 380/H)；base = (622 − W·scale)/2
//   l（贴左）= base + bboxLeft·scale − 10      r（贴右）= base + (W−bboxRight)·scale − 10
// 数值由 scripts/scan_pet_shift.py 对 CDN 上的真实动图逐帧扫「非白 bbox」实测得出；
// **换素材、改 .pet-img 尺寸后必须重跑**，否则贴边会错位（2026-09-19 发现旧表的 r 值系统性偏大 ~22rpx，已一并修正）。
const PET_SHIFT = {
  orange: { l: 140, r: 139 }, aries: { l: 157, r: 141 }, taurus: { l: 205, r: 203 },
  gemini: { l: 188, r: 106 }, cancer: { l: 197, r: 112 }, leo: { l: 192, r: 181 },
  virgo: { l: 174, r: 170 }, libra: { l: 165, r: 190 }, scorpio: { l: 185, r: 97 },
  sagittarius: { l: 161, r: 132 }, capricorn: { l: 172, r: 163 }, aquarius: { l: 134, r: 150 },
  pisces: { l: 208, r: 212 }
};
// face='right'（宠物朝右）→ 宠物贴左边；face='left' → 宠物贴右边。
// 素材左右留白不对称，贴左/贴右是两个不同的位移量（l / r），不能混用。
function petEdgeStyle(key, face) {
  const s = PET_SHIFT[key] || { l: 140, r: 140 };
  return face === 'left' ? `right:-${s.r}rpx` : `left:-${s.l}rpx`;
}

function getPet(key) {
  return PET_META[key] || PET_META.orange;
}

// 按中文名反查宠物（足迹里存的是名字，日历需还原成头像图）
const NAME_TO_KEY = {};
Object.keys(PET_META).forEach((k) => { NAME_TO_KEY[PET_META[k].name] = k; });
function getPetByName(name) {
  if (!name) return null;
  return PET_META[NAME_TO_KEY[name]] || null;
}

// —— 场景动画组（对齐原型 SCENE_BY_MODE = { focus:'keyboard', meditate:'sunset', coffee:'coffee', '':'read' }）——
// read=看书(日常/今日页)  keyboard=敲键盘(专注中)  sunset=看日落画框(冥想中)  coffee=咖啡(完成后庆祝6秒)
// 13 只宠物的四段动图**全部走 CDN**（含橘小满），本地不再留 GIF。
// 个别宠物缺某段动图时用现有姿势兜底：金毛无咖啡段(看书兜底)、射手/双鱼无读书段(站立兜底，已在 anim 字段)。
const ANIM_FALLBACK = { aries: { coffee: 'read' } };
const animsCache = {};
function petAnims(key) {
  if (animsCache[key]) return animsCache[key];
  const p = PET_META[key];
  if (!p) return null;
  const fb = ANIM_FALLBACK[key] || {};
  const anims = {
    read: p.anim,
    keyboard: ANIM_CDN + key + '-' + (fb.keyboard || 'laptop') + '.gif',
    sunset: ANIM_CDN + key + '-' + (fb.sunset || 'frame') + '.gif',
    coffee: ANIM_CDN + key + '-' + (fb.coffee || 'coffee') + '.gif'
  };
  animsCache[key] = anims;
  return anims;
}

module.exports = { PET_META, ZODIAC_TRAITS, zodiacOf, getPet, getPetByName, petAnims, petEdgeStyle };
