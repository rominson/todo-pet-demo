// 宠物目录（后端真相源）：橘小满(免费) + 12 星座(付费)
// price 单位：元；free=true 表示免费赠送形象
const PET_CATALOG = [
  { key: 'orange',       name: '橘小满', free: true,  price: 0, desc: '自带的小橘猫，永远陪着你。' },
  { key: 'aries',        name: '白羊',   free: false, price: 6, desc: '热情冲动的小火羊，催你立刻动起来。' },
  { key: 'taurus',       name: '金牛',   free: false, price: 6, desc: '稳重踏实的金牛，陪你慢慢来。' },
  { key: 'gemini',       name: '双子',   free: false, price: 6, desc: '古灵精怪的双子，聊天永远不重样。' },
  { key: 'cancer',       name: '巨蟹',   free: false, price: 6, desc: '温柔顾家的巨蟹，记得你的每个小习惯。' },
  { key: 'leo',          name: '狮子',   free: false, price: 6, desc: '阳光自信的狮子，夸起你来毫不客气。' },
  { key: 'virgo',        name: '处女',   free: false, price: 6, desc: '细致靠谱的处女，帮你把清单理得服服帖帖。' },
  { key: 'libra',        name: '天秤',   free: false, price: 6, desc: '优雅纠结的天秤，和你一起权衡轻重。' },
  { key: 'scorpio',      name: '天蝎',   free: false, price: 6, desc: '深沉专一的天蝎，看穿你的拖延。' },
  { key: 'sagittarius',  name: '射手',   free: false, price: 6, desc: '自由洒脱的射手，带你冲向目标。' },
  { key: 'capricorn',    name: '摩羯',   free: false, price: 6, desc: '自律严谨的摩羯，陪你死磕到底。' },
  { key: 'aquarius',     name: '水瓶',   free: false, price: 6, desc: '脑洞清奇的水瓶，给你不一样的视角。' },
  { key: 'pisces',       name: '双鱼',   free: false, price: 6, desc: '浪漫温柔的双鱼，陪你做白日梦。' }
];
module.exports = { PET_CATALOG };
