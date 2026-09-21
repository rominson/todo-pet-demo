// src/views/today.js —— 今日：问候 + 宠物陪伴 + 进度 + 统计 + 待办清单
import * as store from '../store.js';
import * as agg from '../agg.js';
import { getPet, petEdgeStylePx, petAnims } from '../pets.js';
import { dailyOpen, completeReact, milestone, memoryLine } from '../broadcast.js';
import { esc, captureRects, playFlip } from '../ui.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const EMPTY_FORM = { title: '', due: '', important: false, repeatOn: false, freq: 'daily', customNum: 2, unitIdx: 0 };

function greetingWord() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return '早上好';
  if (h >= 11 && h < 13) return '中午好';
  if (h >= 13 && h < 18) return '下午好';
  if (h >= 18 && h < 23) return '晚上好';
  return '夜深了';
}

function hashId(s) {
  let n = 0;
  for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

export function renderToday(root) {
  let pet = getPet(store.getMine().current || 'orange');
  let openId = '';
  let showAdd = false;
  let bubble = '';
  let greeting = '';
  let petErr = false;
  let form = Object.assign({}, EMPTY_FORM);
  let tasks = [];
  let all = [];
  let bubbleTimer = null;
  let greetedToday = false;

  const freqs = [
    { f: 'daily', t: '每天' }, { f: 'weekly', t: '每周' },
    { f: 'monthly', t: '每月' }, { f: 'custom', t: '自定义' }
  ];
  const units = [{ v: 'd', t: '天' }, { v: 'w', t: '周' }, { v: 'm', t: '月' }];

  function buildTodayText() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
  }

  function todayList(t, today) {
    return (t || [])
      .filter((x) => agg.isTodayTask(x, today))
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
  }

  function showBubble(text) {
    bubble = text;
    clearTimeout(bubbleTimer);
    paint();
    bubbleTimer = setTimeout(() => { bubble = ''; paint(); }, 6000);
  }

  async function loadAll(showGreeting = false) {
    const mine = store.getMine();
    pet = getPet(mine.current || 'orange');
    all = (await store.list()).list || [];
    const fps = (await store.getFootprints(200)).list || [];
    const streak = agg.computeStreak(all);
    const yDone = agg.yesterdayDone(all);
    const overdue = agg.overdueTasks(all);

    const today = agg.todayStr();
    tasks = todayList(all, today);
    const doneToday = tasks.filter((t) => t.done).length;
    const progress = tasks.length ? Math.round((doneToday / tasks.length) * 100) : 0;
    const focusMinutes = fps.reduce((s, f) => s + (f.type === 'focus' ? 25 : f.type === 'meditate' ? 15 : 0), 0);

    const first = store.state.firstOpen || agg.todayStr();
    const a = new Date(first + 'T00:00:00');
    const b = new Date(agg.todayStr() + 'T00:00:00');
    const companionDays = Math.max(1, Math.floor((b - a) / 86400000) + 1);

    paint({ doneToday, totalToday: tasks.length, progress, doneTotal: agg.totalDone(all), streak, companionDays, focusMinutes });

    if (showGreeting && !greetedToday) {
      greetedToday = true;
      greeting = dailyOpen({ overdueList: overdue, streak, yDone }, pet.name);
      paint({ doneToday, totalToday: tasks.length, progress, doneTotal: agg.totalDone(all), streak, companionDays, focusMinutes });
      setTimeout(() => { greeting = ''; paint(); }, 6000);
    }
  }

  function paint(extra) {
    const doneToday = extra?.doneToday ?? tasks.filter((t) => t.done).length;
    const totalToday = extra?.totalToday ?? tasks.length;
    const progress = extra?.progress ?? (tasks.length ? Math.round(tasks.filter((t) => t.done).length / tasks.length * 100) : 0);
    const doneTotal = extra?.doneTotal ?? agg.totalDone(all);
    const streak = extra?.streak ?? agg.computeStreak(all);
    const companionDays = extra?.companionDays ?? 1;
    const focusMinutes = extra?.focusMinutes ?? 0;

    const edge = petEdgeStylePx(pet.key, pet.face || 'right');
    const petSrc = petErr ? pet.read : (pet.anim || pet.read);

    root.innerHTML = `
      <div class="page">
        <div class="card hero face-${pet.face || 'right'}">
          <div class="greet-block">
            <div class="greet">${greetingWord()}</div>
            <div class="date">${buildTodayText()}</div>
          </div>
          <div class="pet-card">
            <div class="pet-clip">
              <img class="pet-img" style="${edge}" src="${esc(petSrc)}" mode="aspectFit" alt="${esc(pet.name)}" />
            </div>
            ${bubble || greeting ? `<div class="pet-bubble ${(pet.face || 'right') === 'left' ? 'bl' : 'br'}">${esc(bubble || greeting)}</div>` : ''}
          </div>
          <div class="progress-row">
            <span class="progress-lbl">今日进度</span>
            <span class="progress-num">${progress}%</span>
          </div>
          <div class="bar"><div class="bar-fill" style="width:${progress}%"></div></div>
          <div class="stats">
            <div class="stat"><div class="num">${doneTotal}</div><div class="lbl">一起完成</div></div>
            <div class="stat"><div class="num">${companionDays}</div><div class="lbl">陪伴天数</div></div>
            <div class="stat"><div class="num">${focusMinutes}</div><div class="lbl">专注分钟</div></div>
          </div>
        </div>

        <div class="card list-card">
          <div class="list-head">今天 · ${doneToday}/${totalToday} 完成</div>
          <div class="task-list">
            ${tasks.map((t) => taskRowHtml(t)).join('')}
            ${tasks.length === 0 ? '<div class="empty">一件事，做完打勾就好</div>' : ''}
          </div>
        </div>
      </div>

      <div class="fab" data-act="showAdd">＋</div>

      ${showAdd ? addModalHtml() : ''}
    `;

    bind();
  }

  function taskRowHtml(t) {
    const rl = agg.repeatLabel(t.repeat);
    const imp = t.important ? '<span class="imp-dot"></span>' : '';
    const tags = (rl || t.due)
      ? `<div class="task-tags">${rl ? `<span class="tag repeat">🔁 ${esc(rl)}</span>` : ''}${t.due ? `<span class="due">📅 ${esc(t.due)}</span>` : ''}</div>`
      : '';
    return `
      <div class="task-swipe ${openId === t._id ? 'open' : ''}" data-id="${esc(t._id)}">
        <div class="swipe-btn del" data-act="remove" data-id="${esc(t._id)}">删除</div>
        <div class="task-item ${t.done ? 'done' : ''}">
          <div class="check ${t.done ? 'on' : ''}" data-act="toggle" data-id="${esc(t._id)}"><div class="tick"></div></div>
          <div class="task-body" data-act="toggle" data-id="${esc(t._id)}">
            <div class="task-title">${imp}${esc(t.title)}</div>
            ${tags}
          </div>
        </div>
      </div>`;
  }

  function addModalHtml() {
    const freqRow = freqs.map((f) => `<div class="freq-opt ${form.freq === f.f ? 'on' : ''}" data-act="pickFreq" data-f="${f.f}">${f.t}</div>`).join('');
    const custom = form.freq === 'custom'
      ? `<div class="custom-row"><span class="custom-lbl">每</span>
           <input class="custom-num" type="number" value="${esc(form.customNum)}" data-act="customNum" />
           <div class="custom-unit" data-act="customUnit">${units[form.unitIdx].t} ›</div></div>`
      : '';
    return `
      <div class="modal-mask" data-act="hideAdd">
        <div class="modal" data-stop="1">
          <div class="sheet-x" data-act="hideAdd">✕</div>
          <div class="modal-title">新建任务</div>
          <div class="modal-sub">一件事，做完打勾就好</div>
          <input class="input" placeholder="任务名称" value="${esc(form.title)}" data-act="title" />
          <input class="input picker" type="date" value="${esc(form.due)}" data-act="due" />
          <div class="opt-row">
            <div class="opt-lbl"><div>标为重要</div><div class="opt-sub">会进四象限「重要」区</div></div>
            <label class="ios-switch"><input type="checkbox" data-act="important" ${form.important ? 'checked' : ''}/><span class="slider"></span></label>
          </div>
          <div class="opt-row">
            <div class="opt-lbl"><div>重复</div><div class="opt-sub">完成后自动生成下一条</div></div>
            <label class="ios-switch"><input type="checkbox" data-act="repeatOn" ${form.repeatOn ? 'checked' : ''}/><span class="slider"></span></label>
          </div>
          ${form.repeatOn ? `<div class="freq-row">${freqRow}</div>${custom}` : ''}
          <button class="btn-primary" data-act="create">添加任务</button>
        </div>
      </div>`;
  }

  function bind() {
    const img = root.querySelector('.pet-img');
    if (img) img.onerror = () => { if (!petErr) { petErr = true; paint(); } };

    root.querySelectorAll('[data-act]').forEach((el) => {
      const act = el.dataset.act;
      if (act === 'showAdd') el.onclick = () => { showAdd = true; paint(); };
      else if (act === 'hideAdd') el.onclick = (e) => { if (e.target === el || el.classList.contains('sheet-x')) { showAdd = false; form = Object.assign({}, EMPTY_FORM); paint(); } };
      else if (act === 'title') el.oninput = (e) => { form.title = e.target.value; };
      else if (act === 'due') el.oninput = (e) => { form.due = e.target.value; };
      else if (act === 'important') el.onchange = (e) => { form.important = e.target.checked; };
      else if (act === 'repeatOn') el.onchange = (e) => { form.repeatOn = e.target.checked; paint(); };
      else if (act === 'pickFreq') el.onclick = () => { form.freq = el.dataset.f; paint(); };
      else if (act === 'customNum') el.oninput = (e) => { form.customNum = e.target.value; };
      else if (act === 'customUnit') el.onclick = () => { form.unitIdx = (form.unitIdx + 1) % units.length; paint(); };
      else if (act === 'create') el.onclick = onCreate;
    });

    // 点击弹层内部不关闭
    const modal = root.querySelector('.modal');
    if (modal) modal.onclick = (e) => { if (e.target.dataset && e.target.dataset.stop) e.stopPropagation(); };

    bindSwipe();
  }

  function bindSwipe() {
    root.querySelectorAll('.task-swipe').forEach((row) => {
      let sx = null, sy = null, lock = '', pressTarget = null;
      const item = row.querySelector('.task-item');
      row.addEventListener('pointerdown', (e) => {
        sx = e.clientX; sy = e.clientY; lock = '';
        pressTarget = e.target; // 真实按下目标；setPointerCapture 之后后续事件的 target 会变成 row
        try { row.setPointerCapture(e.pointerId); } catch (_) {}
      });
      row.addEventListener('pointermove', (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!lock && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (lock === 'h') {
          const tx = Math.min(0, dx);
          item.style.transform = `translateX(${tx}px)`;
        }
      });
      row.addEventListener('pointerup', (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        item.style.transform = '';
        const adx = Math.abs(dx), ady = Math.abs(dy);
        // 竖向滚动：交给页面，不处理
        if (lock === 'v' && ady > 6) { sx = null; pressTarget = null; return; }
        // 横向滑动：左滑露出删除，右滑收起
        if (adx > 6 && adx >= ady) {
          if (dx < -50) { openId = row.dataset.id; paint(); }
          else if (dx > 30) { openId = ''; paint(); }
          else if (openId) { openId = ''; paint(); }
          sx = null; pressTarget = null; return;
        }
        // 轻点（位移很小）：交给 pointerup 处理，不依赖 click——
        // WebKit 下 setPointerCapture 会把 click 重定向到 row，
        // 导致 .check/.task-body 上的 onclick 永远不触发（勾选失效）。
        const tgt = pressTarget; pressTarget = null;
        if (tgt && tgt.closest && tgt.closest('.swipe-btn')) onRemove(row.dataset.id);
        else onToggle(row.dataset.id);
        sx = null;
      });
      row.addEventListener('pointercancel', () => { sx = null; pressTarget = null; item.style.transform = ''; });
    });
  }

  async function onToggle(id) {
    if (openId) { openId = ''; paint(); return; }
    const prev = captureRects(root, '.task-swipe');
    const before = tasks.find((t) => t._id === id);
    const wasDone = before ? before.done : false;
    const res = await store.toggle(id);
    await loadAll(false);
    playFlip(root, '.task-swipe', prev);
    if (res.done && !wasDone) onComplete(before);
  }

  async function onComplete(task) {
    const line = memoryLine(task.title, hashId(task._id), pet.name);
    await store.addFootprint('done', line, pet.name);
    await store.saveMessage('pet', line, pet.name);
    showBubble(completeReact({ overdue: false, openedP2P3: false }, pet.name));

    const streak = agg.computeStreak(all);
    if (streak === 3 || streak === 7 || streak === 14) {
      const msg = milestone(streak, pet.name);
      setTimeout(() => showBubble(msg), 6400);
      await store.addFootprint('milestone', msg, pet.name);
      await store.saveMessage('pet', msg, pet.name);
    }
  }

  async function onCreate() {
    const title = (form.title || '').trim();
    if (!title) { alert('写点什么吧'); return; }
    const repeat = !form.repeatOn ? 'none'
      : form.freq === 'custom' ? `custom:${Math.max(1, Math.min(99, parseInt(form.customNum, 10) || 1))}${units[form.unitIdx].v}`
        : form.freq;
    await store.create({ title, due: form.due, important: form.important, repeat });
    showAdd = false; form = Object.assign({}, EMPTY_FORM);
    await loadAll(false);
  }

  async function onRemove(id) {
    openId = '';
    if (!confirm('确定删除这件？')) { paint(); return; }
    await store.remove(id);
    await loadAll(false);
  }

  loadAll(true);
  return () => { clearTimeout(bubbleTimer); };
}
