// src/main.js —— 桌面版 v2：桌面宠物壳
// 透明无边框窗口里只有一只宠物；点宠物弹菜单（切换/今日/专注/日历），今日与日历进面板，专注=轻量计时。无聊天。
import * as store from './store.js';
import { PET_META, petAnims } from './pets.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window';

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
      <div class="pet bob" id="pet">
        <img id="petImg" alt="" />
        <div class="focus-tag" id="focusTag"></div>
      </div>
      <div class="pet-bubble" id="petBubble"></div>
      <div class="hint" id="hint">轻点我</div>
      <div class="menu" id="menu">
        <div class="mbtn switch" data-act="switch"><div class="ic">${ICONS.switch}</div><div class="lb">切换宠物</div></div>
        <div class="mbtn" data-act="today"><div class="ic">${ICONS.today}</div><div class="lb">今日</div></div>
        <div class="mbtn" data-act="focus"><div class="ic">${ICONS.focus}</div><div class="lb">专注</div></div>
        <div class="mbtn" data-act="calendar"><div class="ic">${ICONS.calendar}</div><div class="lb">日历</div></div>
      </div>
      <div class="panel" id="panel">
        <div class="panel-bar"><div class="panel-back" id="panelBack">‹ 收起</div></div>
        <div class="panel-body" id="panelBody"></div>
      </div>
    </div>`;

  setup();
}

function setup() {
  const $ = (id) => document.getElementById(id);
  const pet = $('pet'), petImg = $('petImg'), menu = $('menu'), bubble = $('petBubble'),
    hint = $('hint'), panel = $('panel'), panelBody = $('panelBody'), focusTag = $('focusTag'),
    stage = $('stage'), back = $('panelBack');
  petImg.draggable = false;                              // 禁用 <img> 原生拖拽，避免抢走鼠标
  const focusBtn = () => menu.querySelector('.mbtn[data-act="focus"]');

  let idx = PET_KEYS.indexOf(store.getMine().current || 'orange');
  if (idx < 0) idx = 0;
  let menuOpen = false, focusOn = false, timer = null, remain = 25 * 60;
  let win = null;
  try { win = getCurrentWindow(); } catch (e) { win = null; }

  function setImg(kind) {
    const a = petAnims(PET_KEYS[idx]) || {};
    if (kind === 'keyboard') {
      petImg.onerror = () => { petImg.onerror = null; petImg.src = a.read; };
      petImg.src = a.keyboard || a.read;
    } else {
      petImg.onerror = null;
      petImg.src = a.read;
    }
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
    const left = Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4, r.left + r.width / 2 - menu.offsetWidth / 2));
    menu.style.left = left + 'px';
    menu.style.top = (r.bottom + 14) + 'px';   // 宠物贴顶，菜单从下方弹出
  }
  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) positionMenu();
    menu.classList.toggle('show', menuOpen);
    if (menuOpen) hint.style.opacity = '0';
  }

  async function onSwitch() {
    idx = (idx + 1) % PET_KEYS.length;
    await store.setCurrentPet(PET_KEYS[idx]);
    setImg('read');
    showBubble('我是' + PET_META[PET_KEYS[idx]].name + '～');
    menuOpen = false; menu.classList.remove('show');
  }

  function openPanel(kind) {
    menuOpen = false; menu.classList.remove('show');
    panelBody.innerHTML = '';
    if (viewCleanup) { try { viewCleanup(); } catch (e) {} viewCleanup = null; }
    panel.classList.add('show');
    if (kind === 'today') viewCleanup = renderToday(panelBody);
    else if (kind === 'calendar') viewCleanup = renderCalendar(panelBody);
  }
  function closePanel() {
    panel.classList.remove('show');
    if (viewCleanup) { try { viewCleanup(); } catch (e) {} viewCleanup = null; }
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
      toggleMenu();
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
    if (act === 'switch') onSwitch();
    else if (act === 'today') openPanel('today');
    else if (act === 'calendar') openPanel('calendar');
    else if (act === 'focus') startFocus();
  });
  back.addEventListener('click', closePanel);
  stage.addEventListener('pointerdown', (e) => {
    if (menuOpen && !menu.contains(e.target) && e.target !== pet && !pet.contains(e.target)) {
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
