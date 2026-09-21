// src/main.js —— 桌面版 v2：桌面宠物壳
// 透明无边框窗口里只有一只宠物；点宠物弹菜单（切换/今日/专注/日历），今日与日历进面板，专注=轻量计时。无聊天。
import * as store from './store.js';
import { PET_META, petAnims, ZODIAC_NAME, ZODIAC_TRAITS, PET_BOX } from './pets.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { getCurrentWindow, PhysicalPosition, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';

const PET_KEYS = Object.keys(PET_META);
let viewCleanup = null;

const ICONS = {
  switch: '<svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v5h-5"/></svg>',
  today: '<svg viewBox="0 0 24 24"><path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5z"/><path d="M8 9.5l1.5 1.5L12.5 8"/><path d="M8 14.5h6"/></svg>',
  focus: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="3"/><circle cx="6.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M7.5 15h9"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17"/><path d="M8 3.5v3.5"/><path d="M16 3.5v3.5"/><path d="M9.5 14h5"/></svg>'
};

async function boot() {
  await store.init();
  await store.ensureIntroTask();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="pet-stage" id="stage">
      <div class="pet" id="pet">
        <img id="petImg" alt="" />
        <div class="focus-tag" id="focusTag"></div>
        <div class="pet-bubble" id="petBubble"></div>
        <div class="hint" id="hint">轻点我</div>
      </div>
      <div class="menu" id="menu">
        <div class="mbtn" data-act="switch"><div class="ic">${ICONS.switch}</div><div class="lb">切换宠物</div></div>
        <div class="mbtn" data-act="today"><div class="ic">${ICONS.today}</div><div class="lb">今日</div></div>
        <div class="mbtn" data-act="focus"><div class="ic">${ICONS.focus}</div><div class="lb">专注</div></div>
        <div class="mbtn" data-act="calendar"><div class="ic">${ICONS.calendar}</div><div class="lb">日历</div></div>
      </div>
      <div class="ring" id="ring"></div>
      <div class="panel" id="panel">
        <div class="panel-bar"><div class="panel-back" id="panelBack">‹ 收起</div><div class="panel-title" id="panelTitle"></div></div>
        <div class="panel-body" id="panelBody"></div>
      </div>
    </div>`;

  setup();
}

function setup() {
  const $ = (id) => document.getElementById(id);
  const pet = $('pet'), petImg = $('petImg'), menu = $('menu'), bubble = $('petBubble'),
    hint = $('hint'), panel = $('panel'), panelBody = $('panelBody'), panelTitle = $('panelTitle'), focusTag = $('focusTag'),
    stage = $('stage'), back = $('panelBack'), ring = $('ring');
  petImg.draggable = false;                              // 禁用 <img> 原生拖拽，避免抢走鼠标
  const focusBtn = () => menu.querySelector('.mbtn[data-act="focus"]');

  let idx = PET_KEYS.indexOf(store.getMine().current || 'orange');
  if (idx < 0) idx = 0;
  let menuOpen = false, focusOn = false, timer = null, remain = 25 * 60;
  let ringVisible = false;                              // 切换环是否展开
  let win = null;
  try { win = getCurrentWindow(); } catch (e) { win = null; }

  function applyPetBox() {                            // 气泡/提示贴【可见的】宠物下缘，而不是 210 壳的下缘
    const box = boxOf();
    bubble.style.top = Math.round(box.b + 12) + 'px';
    hint.style.top = Math.round(box.b + 56) + 'px';
  }

  function setImg(kind) {
    applyPetBox();
    const a = petAnims(PET_KEYS[idx]) || {};
    const src = (kind === 'keyboard') ? (a.keyboard || a.read) : a.read;
    // 预加载：先解码新 GIF，再交换 src —— 旧图一直显示到新图就绪，切换不闪白；
    // 同时按「源宽」算缩放比写进 --pscale，让 CSS 走 1:1 纹理 + 恒定 transform 合成（见 styles.css），消除逐帧抖动。
    const pre = new Image();
    pre.onload = () => {
      const w = pre.naturalWidth || 560;
      petImg.style.setProperty('--pscale', (210 / w).toFixed(5));
      petImg.src = src;
    };
    pre.onerror = () => {
      petImg.style.setProperty('--pscale', (210 / 560).toFixed(5));
      petImg.src = a.read;
    };
    pre.src = src;
  }

  function showBubble(text, ms = 4200) {
    if (!text) { bubble.classList.remove('show'); bubble.textContent = ''; return; }
    bubble.textContent = text; bubble.classList.add('show');
    clearTimeout(bubble._t); bubble._t = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? '夜深了' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : h < 23 ? '晚上好' : '夜深了';
  }

  function positionMenu() {
    const r = pet.getBoundingClientRect();
    const box = boxOf();
    const cx = r.left + (box.l + box.r) / 2;           // 按可见内容居中（不是 210 的壳）
    const cTop = r.top + box.t, cBottom = r.top + box.b;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const left = Math.max(4, Math.min(innerWidth - mw - 4, cx - mw / 2));
    menu.style.left = left + 'px';
    const below = cBottom + 10, above = cTop - mh - 10;   // 10px：紧贴可见的宠物边缘
    // 宠物被放到屏幕底部时，下方放不下 → 翻到宠物上方，避免菜单被窗口/屏幕切掉
    const flip = (below + mh > innerHeight - 4) && (above > 4);
    menu.style.top = (flip ? above : below) + 'px';
    menu.style.transformOrigin = flip ? 'top center' : 'bottom center';
  }
  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) positionMenu();
    menu.classList.toggle('show', menuOpen);
    if (menuOpen) hint.style.opacity = '0';
  }

  async function switchTo(key) {
    if (!PET_META[key]) return;
    idx = PET_KEYS.indexOf(key);
    if (idx < 0) idx = 0;
    await store.setCurrentPet(PET_KEYS[idx]);
    setImg('read');
    showBubble('我是' + PET_META[PET_KEYS[idx]].name + '～');
  }

  // ============ 切换宠物：以当前宠物为中心，本只以外的 12 只绕一圈 ============
  // 无卡片、无底板 —— 直接用抠好的透明 GIF 贴图，下面两行「星座 + 一句话（星座特质）」，
  // 与小程序遇见页卡片下方一致（白羊座 · 活力 · 冲动）。
  // 环窗口尺寸 / 环半径上限（逻辑像素）。窗口只需「宠物壳左侧留 PET_LEFT + 右侧留够 ±41」即可容下一整圈，
  // 半径 175 与修复前的观感一致（此前被下面的钳制压到 62.5，12 只才会挤在宠物身上）。
  // RING_H 取与 H0 相同的 500：环窗口的下边界与普通窗口一致 → 竖直方向的可用空间只由屏幕决定，
  // 不会出现「屏幕还够、却被环窗口自己的底边先卡住」（宠物靠下时半径会白白小一截）。
  const RING_W = 460, RING_H = 500, RING_R = 175;
  // 环上每个 .ritem 的锚点 = 头像中心：盒宽 78(±39)、锚点上方 30(半个头像)、下方 60(星座名+特质两行)
  const IT_L = 41, IT_R = 41, IT_T = 32, IT_B = 64;   // 环点到「窗口/屏幕」四边所需的最小余量

  function renderRing() {
    const current = store.getMine().current || 'orange';
    const keys = PET_KEYS.filter((k) => k !== current);   // 除当前占用外的 12 只
    ring.innerHTML = keys.map((k, i) => {
      const m = PET_META[k];
      const a = petAnims(k) || {};
      return '<div class="ritem" style="--i:' + i + '" data-key="' + k + '">'
        + '<img class="rimg" src="' + (a.read || m.img || '') + '" alt="' + m.name + '" />'
        + '<div class="rz">' + (ZODIAC_NAME[k] || '') + '</div>'
        + '<div class="rs">' + (ZODIAC_TRAITS[k] || '') + '</div>'
        + '</div>';
    }).join('');
    ring.querySelectorAll('.ritem').forEach((el) => {
      el.onclick = () => { switchTo(el.dataset.key); closeRing(); };
    });
  }

  async function openRing() {
    if (ringVisible) return;
    menuOpen = false; menu.classList.remove('show');
    try {
      const scr = scrSize();
      const pos = await petScreenPos();                 // 宠物壳屏幕左上（逻辑像素）
      const box = boxOf();
      const bcx = (box.l + box.r) / 2, bcy = (box.t + box.b) / 2;   // 可见内容中心在壳内的偏移
      const cx = pos.x + bcx, cy = pos.y + bcy;         // 用【可见内容】中心当环心（用壳中心会偏）
      // 关键：窗口定位/宠物摆位与普通窗口【同一套公式、且与本模式尺寸无关】
      // → 收起环时 setGeom 判定 willMove=false、宠物不隐藏也不挪动，消除「切换完闪一下」的眨眼。
      const wx = pos.x - PET_LEFT;                      // 水平不做钳制：窗口允许溢出屏幕左右边（透明处无害），
      const wy = clamp(pos.y - PET_TOP, 0, Math.max(0, scr.h - H0));   // 宠物窗内坐标才能永远是 PET_LEFT/PET_TOP
      const px = cx - wx, py = cy - wy;                 // 宠物在环窗口内的中心
      // 环半径 = min(窗口内四边余量, 屏幕四边余量)：
      //   只按窗口钳制的话，宠物贴屏幕边时窗口会溢出屏幕、环点被屏幕边缘切掉半只；
      //   加上屏幕余量后会自动收小，任何位置都是一圈完整、不压到宠物的圆。
      //   下限 88：宠物本身已被拖到屏幕边缘外时不会算出负半径（那会变成挤成一团）。
      const pr = clamp(Math.min(
        RING_R,
        px - IT_L, RING_W - px - IT_R,                  // 环窗口内左右余量
        py - IT_T, RING_H - py - IT_B,                  // 环窗口内上下余量
        cx - IT_L, scr.w - cx - IT_R,                   // 屏幕上左右余量
        cy - IT_T, scr.h - cy - IT_B                    // 屏幕上上下余量
      ), 88, RING_R);
      renderRing();
      const items = ring.querySelectorAll('.ritem');
      const n = items.length || 1;
      items.forEach((el, i) => {
        const ang = (i * (360 / n) - 90) * Math.PI / 180;   // 从正上方开始顺时针排
        el.style.left = Math.round(px + pr * Math.cos(ang)) + 'px';
        el.style.top = Math.round(py + pr * Math.sin(ang)) + 'px';
      });
      // 宠物窗内坐标 = (px-bcx, py-bcy)，与普通窗口算出的 (pos.x-wx, pos.y-wy) 完全相同 → willMove=false
      await setGeom(RING_W, RING_H, wx, wy, px - bcx, py - bcy);  // 先定位窗口+宠物，再亮环
      ring.classList.add('show');
      ringVisible = true;
    } catch (e) { /* 兜底：不展开环 */ }
  }

  async function closeRing() {
    if (!ringVisible) return;
    ringVisible = false;
    ring.classList.remove('show');
    ring.innerHTML = '';                              // 立即清空：避免刚选中的宠物在环位（如右下）残留闪现
    let pos = null;
    try { pos = await petScreenPos(); } catch (e) {}
    setTimeout(async () => {
      if (!pos) { pet.style.left = ''; pet.style.top = ''; return; }
      try {
        const scr = scrSize();
        // 与 openRing 完全同一套公式（不含窗口尺寸相关项）→ 宠物窗内坐标不变，收起环不闪
        const wx = pos.x - PET_LEFT;
        const wy = clamp(pos.y - PET_TOP, 0, Math.max(0, scr.h - H0));
        await setGeom(W0, H0, wx, wy, pos.x - wx, pos.y - wy);
      } catch (_) { pet.style.left = ''; pet.style.top = ''; }
    }, 220);
  }

  // ================= 面板（今日 / 日历 / 切换宠物）=================
  // ⚠️ 单位铁律：窗口尺寸与坐标一律用【逻辑像素】——setSize 传 LogicalSize、setPosition 传 LogicalPosition。
  //   理由：tauri.conf.json 的 320×500 和所有 CSS 布局都是逻辑像素；而 outerPosition() 返回的是【物理像素】
  //   （Retina 上 = 逻辑 × devicePixelRatio），必须 ÷ dpr 才能和布局对齐。
  //   踩过的坑：曾用 PhysicalSize(650,500) 传逻辑值 → Retina 上窗口只有 325×250（正好一半），
  //   菜单被下边缘裁掉、面板左右溢出被 overflow:hidden 切掉，看起来就是“被切割了”。
  // W0 从 320 放宽到 370：宠物壳左留白由 55 增到 PET_LEFT=110（切换环要在左侧留出 175 半径的圈，
  // 而宠物在窗口内的摆放位置必须与环窗口完全一致，所以这里也要一起外扩），
  // 同时保证「菜单 286 宽」仍能在宠物可见中心正下方不受窗口右缘钳制（370-286-4=80 ≥ 65.5，不偏）。
  const W0 = 370, H0 = 500;                          // 宠物窗口默认尺寸（逻辑）
  const PW = 330, M = 14;                            // 面板宽 / 面板到窗口边留白（给投影留气口）
  const GAP = 16;                                    // 面板与宠物【可见内容】之间的间距
  const PET_W = 210, PET_LEFT = 110, PET_TOP = 110;  // 宠物壳宽 / 宠物在窗口内的固定左上偏移（所有模式统一）
  // ⚠️ 间距铁律：素材四周有大片透明留白，可见内容只占壳宽的 36%~79%。
  //   若拿 210 的壳去算间距，视觉上会远得离谱（实测「宠物可见右缘 → 面板左缘」= 100px）。
  //   所以面板/菜单/气泡一律按 PET_BOX（各宠物在壳内的可见边界）来定位。
  const BOX_DEF = { l: 62, r: 155, t: 57, b: 158 };  // 全宠物可见区中位数，兜底用
  const boxOf = () => PET_BOX[PET_KEYS[idx]] || BOX_DEF;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const scrSize = () => { const s = window.screen || {}; return { w: Math.round(s.width || 1440), h: Math.round(s.height || 900) }; };

  function placePet(left, top) {                     // 宠物在窗口内的位置：瞬时生效，不走 transition（避免与窗口缩放错位）
    pet.style.transition = 'none';
    pet.style.left = Math.round(left) + 'px';
    pet.style.top = Math.round(top) + 'px';
    void pet.offsetWidth;
    pet.style.transition = '';
  }

  // 改窗口尺寸/位置时，若宠物在窗内坐标会变（环 / 贴边展开面板），先把宠物隐藏，
  // 等窗口到位再把宠物摆到最终位置并显示，避免「窗口已变、宠物还在旧坐标」的那一两帧
  // 被画出来 → 看起来像在其他位置闪现。坐标不变时（最常见：右侧展开面板）不隐藏，避免无谓闪烁。
  async function setGeom(w, h, x, y, petLeft, petTop) {
    const needPlace = petLeft != null;
    const willMove = needPlace && (pet.style.left !== Math.round(petLeft) + 'px' || pet.style.top !== Math.round(petTop) + 'px');
    if (willMove) pet.style.opacity = '0';
    try {
      await win.setSize(new LogicalSize(w, h));
      await win.setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
    } catch (e) {}
    if (needPlace) placePet(petLeft, petTop);
    void pet.offsetWidth;
    if (willMove) pet.style.opacity = '1';
  }

  async function petScreenPos() {                    // 宠物当前屏幕坐标（逻辑像素）
    const dpr = globalThis.devicePixelRatio || 1;
    const p = await win.outerPosition();             // 物理像素
    const r = pet.getBoundingClientRect();           // 窗口内 CSS 像素
    return { x: p.x / dpr + r.left, y: p.y / dpr + r.top };
  }

  function chooseSide(petX, scr) {                   // 面板放宠物的哪一侧（全部按可见内容算）
    const box = boxOf();
    const cr = petX + box.r, cl = petX + box.l;
    if (cr + GAP + PW + M <= scr.w) return 'right';  // 右边放得下：贴左缘 / 中间 → 都放右边
    if (cl - GAP - PW - M >= 0) return 'left';       // 贴右缘（右边不够）→ 翻到左边
    return (scr.w - cr > cl) ? 'right' : 'left';     // 极端窄屏：哪边空间大放哪边
  }

  // 展开后的窗口几何：让面板恰好距宠物【可见内容】GAP，整窗不出屏，且宠物屏幕位置不动
  function panelGeom(side, scr, petX) {
    const box = boxOf();
    if (side === 'right') {
      const wx = petX - PET_LEFT;                    // 与环/普通窗口同一公式，宠物窗内 left 恒为 PET_LEFT（不触发隐藏=不闪）
      const petLeft = petX - wx;
      let ww = petLeft + box.r + GAP + PW + M;       // 由「可见右缘 + GAP + 面板 + 留白」反推窗宽
      ww = Math.min(ww, Math.max(petLeft + PET_W, scr.w - wx));
      return { wx, ww, petLeft };
    }
    const wx = Math.max(0, Math.round(petX + box.l - GAP - PW - M));
    const petLeft = petX - wx;
    let ww = petLeft + PET_W + PET_LEFT;
    if (wx + ww > scr.w) ww = Math.max(petLeft + PET_W, scr.w - wx);
    return { wx, ww, petLeft };
  }

  async function openPanel(kind) {
    menuOpen = false; menu.classList.remove('show');
    panel.style.transition = ''; panel.style.opacity = '';   // 清掉 closePanel 的瞬间隐藏，恢复 CSS 淡入
    if (viewCleanup) { try { viewCleanup(); } catch (e) {} viewCleanup = null; }
    panelBody.innerHTML = '';
    panelTitle.textContent = kind === 'today' ? '今日' : '日历';
    let side = 'right';
    try {
      const scr = scrSize();
      const pos = await petScreenPos();
      side = chooseSide(pos.x, scr);
      const g = panelGeom(side, scr, pos.x);
      const wy = clamp(pos.y - PET_TOP, 0, Math.max(0, scr.h - H0));
      await setGeom(g.ww, H0, g.wx, wy, g.petLeft, pos.y - wy);  // 先定位窗口+宠物，再亮面板
    } catch (e) { /* 兜底：展开失败就仍在原窗口内显示面板 */ }
    panel.classList.remove('left', 'right');
    panel.classList.add('show', side);
    if (kind === 'today') viewCleanup = renderToday(panelBody);
    else if (kind === 'calendar') viewCleanup = renderCalendar(panelBody);
  }

  async function closePanel() {
    if (viewCleanup) { try { viewCleanup(); } catch (e) {} viewCleanup = null; }
    panelTitle.textContent = '';                     // 立即清空内容
    panelBody.innerHTML = '';
    panel.classList.remove('show', 'left', 'right');
    // 瞬间隐藏面板容器（不走 .2s 过渡）：缩窗那几帧窗口在变小，若面板还以「淡出中」状态被绘制，
    // 其背景框会画在宠物旁 → 收起时「弹框在宠物位置闪现」。隐藏后缩窗全程面板不可见。
    panel.style.transition = 'none';
    panel.style.opacity = '0';
    void panel.offsetWidth;
    let pos = null;
    try { pos = await petScreenPos(); } catch (e) {}
    if (!pos) { pet.style.left = ''; pet.style.top = ''; return; }
    try {
      const scr = scrSize();
      const wx = pos.x - PET_LEFT;
      const wy = clamp(pos.y - PET_TOP, 0, Math.max(0, scr.h - H0));
      await setGeom(W0, H0, wx, wy, pos.x - wx, pos.y - wy);
    } catch (_) { pet.style.left = ''; pet.style.top = ''; }
  }

  function fmt(s) { return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function startFocus() {
    if (focusOn) {
      focusOn = false; if (timer) clearInterval(timer); timer = null;
      setImg('read'); focusTag.classList.remove('show'); focusBtn().classList.remove('on');
      showBubble('专注结束啦，辛苦你～');
      store.addFootprint('focus', '专注 25 分钟', PET_META[PET_KEYS[idx]].name);
      return;
    }
    focusOn = true; remain = 25 * 60;
    setImg('keyboard');
    focusTag.textContent = '专注中 ' + fmt(remain);
    focusTag.classList.add('show'); focusBtn().classList.add('on');
    showBubble('陪你专注一会儿', 2000);
    timer = setInterval(() => {
      remain--;
      if (remain <= 0) {
        clearInterval(timer); timer = null; focusOn = false;
        setImg('read'); focusTag.classList.remove('show'); focusBtn().classList.remove('on');
        showBubble('25 分钟到了，厉害！');
        store.addFootprint('focus', '专注 25 分钟', PET_META[PET_KEYS[idx]].name);
        return;
      }
      focusTag.textContent = '专注中 ' + fmt(remain);
    }, 1000);
  }

  // 拖动 / 点击（用户明确要求：按下不弹，松手才判定；用「按下→松开」的时长区分点击与拖拽）
  // 系统原生 startDragging 拖整窗（macOS 系统合成移动，唯一丝滑不闪）；它在松手时才 resolve，
  // 因此「松手时刻 - 按下时刻」就是按住时长，作为【唯一】判定依据，不再做异步位置比对（那套会竞态误判）。
  const CLICK_MS = 220;
  let downT = 0, decided = false;
  function onUp() { decide(); }

  function decide() {
    if (decided) return;
    decided = true;
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    pet.classList.remove('dragging');
    const held = performance.now() - downT;
    if (held < CLICK_MS) {
      if (ringVisible) closeRing();
      else toggleMenu();
    } else if (menuOpen) {
      menuOpen = false; menu.classList.remove('show');
    }
  }



  pet.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;                          // 仅左键（专注中也允许拖动/弹菜单）
    downT = performance.now();
    decided = false;
    pet.classList.add('dragging');                       // 暂停 bob，避免视觉抖动
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    window.addEventListener('pointerup', onUp, true);     // 真正的松手信号（原生拖吞掉则走下面）
    window.addEventListener('pointercancel', onUp, true);
    // 优先走系统原生 startDragging（macOS 系统合成移动，唯一丝滑不闪）；
    // 手动 setPosition 拖拽只在「原生拖不可用」时兜底，否则会每帧发 IPC 与系统拖抢位置 → 闪。
    if (win && typeof win.startDragging === 'function') {
      try {
        const r = win.startDragging();                  // 系统接管整窗拖拽（不闪）
        if (r && typeof r.then === 'function') {
          r.then(() => {
            const held = performance.now() - downT;
            if (held < 30) return;                       // 按下就 resolve = 没真正拖，交给 pointerup 决定
            decide();
          });
        } else {
          decide();
        }
      } catch (_) {
        pet.classList.remove('dragging');
        manualDrag(e);                                   // 原生拖异常才退回手动兜底
      }
    } else {
      manualDrag(e);                                     // 非 Tauri（浏览器调试）才手动拖
    }
  });


  function manualDrag(ev) {                              // 手动拖兜底；松手决定交给 decide()
    const d = { sx: ev.clientX, sy: ev.clientY, wx: null, wy: null, moved: false };
    try { pet.setPointerCapture(ev.pointerId); } catch (_) {}
    if (win) win.outerPosition().then((p) => { d.wx = p.x; d.wy = p.y; }).catch(() => {});
    const mv = (e2) => {
      const dx = e2.clientX - d.sx, dy = e2.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
      if (!d.moved || !win || d.wx == null) return;
      const dpr = globalThis.devicePixelRatio || 1;
      try { win.setPosition(new PhysicalPosition(Math.round(d.wx + dx * dpr), Math.round(d.wy + dy * dpr))); } catch (_) {}
    };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }


  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.mbtn'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'switch') openRing();
    else if (act === 'today') openPanel('today');
    else if (act === 'calendar') openPanel('calendar');
    else if (act === 'focus') startFocus();
  });
  back.addEventListener('click', closePanel);
  stage.addEventListener('pointerdown', (e) => {
    const onPet = e.target === pet || pet.contains(e.target);
    if (ringVisible) {
      if (!onPet && !ring.contains(e.target)) closeRing();   // 点环外空白 → 收起环
      return;
    }
    if (menuOpen && !menu.contains(e.target) && !onPet) {
      menuOpen = false; menu.classList.remove('show');
    }
  });

  // 初始化
  setImg('read');
  showBubble(greeting());
  setTimeout(() => { if (bubble.textContent) bubble.classList.remove('show'); }, 4200);
  setTimeout(() => { hint.style.opacity = '0'; }, 6000);
}

boot();
