// src/views/calendar.js —— 日历 · 我的坚持之墙
import * as store from '../store.js';
import { getPet, getPetByName } from '../pets.js';
import * as agg from '../agg.js';
import { esc } from '../ui.js';

const GLYPH_SPOTS = [
  [0.18, 0.22], [0.52, 0.15], [0.84, 0.24],
  [0.12, 0.50], [0.48, 0.48], [0.82, 0.45],
  [0.22, 0.78], [0.55, 0.76], [0.86, 0.74]
];
function glyphStyle(i, n, d) {
  if (n <= 1) return 'left:50%;top:50%;transform:translate(-50%,-50%)';
  const spot = GLYPH_SPOTS[i % GLYPH_SPOTS.length];
  const seed = ((d * 73) + (i * 37) + (n * 7)) % 1000;
  const rnd = (k) => { const x = Math.sin(seed * 0.123 + k * 997) * 10000; return x - Math.floor(x); };
  const clamp = (v) => Math.max(5, Math.min(95, v));
  const left = clamp((spot[0] + (rnd(1) - 0.5) * 0.16) * 100);
  const top = clamp((spot[1] + (rnd(2) - 0.5) * 0.16) * 100);
  const rot = Math.round((rnd(3) - 0.5) * 22);
  return `left:${left.toFixed(1)}%;top:${top.toFixed(1)}%;transform:translate(-50%,-50%) rotate(${rot}deg)`;
}

export function renderCalendar(root) {
  const pet = getPet(store.getMine().current || 'orange');
  let offset = 0;
  let tasks = [];
  let fps = [];
  let year, month, cells, monthCount, canGoNext;
  let selIdx = -1;
  let dayLabel = '', dayTasks = [], daySessions = [];

  async function load() {
    const mine = store.getMine();
    const petNow = getPet(mine.current || 'orange');
    tasks = (await store.list()).list || [];
    fps = (await store.getFootprints(200)).list || [];

    const now = new Date();
    const today = agg.todayStr();
    let y = now.getFullYear();
    let m = now.getMonth() + offset;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();

    const map = {};
    fps.forEach((f) => { const d = agg.toDateStr(f.created_at); (map[d] = map[d] || []).push(f); });

    let mc = 0;
    const cs = [];
    for (let i = 0; i < first; i++) cs.push({ empty: true });
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${agg.pad(m + 1)}-${agg.pad(d)}`;
      const list = map[ds] || [];
      const stamps = list.filter((f) => f.type === 'focus' || f.type === 'meditate');
      if (stamps.length) mc++;
      const isToday = d === now.getDate() && m === now.getMonth() && y === now.getFullYear();
      const pets = stamps.map((f, i) => ({
        k: i,
        img: (getPetByName(f.pet) || petNow).img,
        style: glyphStyle(i, stamps.length, d)
      }));
      const dots = tasks.filter((t) => (t.due || today) === ds).map((t, i) => ({ k: i, done: !!t.done }));
      cs.push({ day: d, empty: false, has: stamps.length > 0, count: stamps.length, pets, dots, today: isToday, sel: false, detail: list });
    }

    const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());
    year = y; month = m + 1; cells = cs; monthCount = mc;
    canGoNext = offset > 0 && !isFuture;

    const tIdx = cs.findIndex((c) => c.today);
    selIdx = tIdx >= 0 ? tIdx : cs.findIndex((c) => !c.empty);
    selectDay(selIdx, false);
    paint();
  }

  function selectDay(idx, doPaint = true) {
    if (idx < 0) return;
    cells = cells.map((c, i) => Object.assign({}, c, { sel: i === idx }));
    const c = cells[idx];
    const ds = `${year}-${agg.pad(month)}-${agg.pad(c.day)}`;
    const today = agg.todayStr();
    dayTasks = tasks.filter((t) => (t.due || today) === ds).map((t) => ({ _id: t._id, title: t.title, done: !!t.done, repeatLabel: agg.repeatLabel(t.repeat) }));
    daySessions = fps.filter((f) => agg.toDateStr(f.created_at) === ds && (f.type === 'focus' || f.type === 'meditate'))
      .map((f, i) => ({ i, text: f.content || (f.type === 'focus' ? '专注' : '冥想') }));
    dayLabel = `${month}月${c.day}日`;
    if (doPaint) paint();
  }

  function paint() {
    root.innerHTML = `
      <div class="page cal-page">
        <div class="title">日历 · 我的坚持之墙</div>
        <div class="card cal">
          <div class="cal-head">
            <div class="nav" data-act="prev">‹</div>
            <div class="month">${year}年${month}月</div>
            <div class="nav ${canGoNext ? '' : 'off'}" data-act="next">›</div>
          </div>
          <div class="cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
          <div class="cal-grid">
            ${cells.map((c, i) => calCellHtml(c, i)).join('')}
          </div>
        </div>
        <div class="card detail">
          <div class="dd-title">${esc(dayLabel || '今天')}</div>
          ${dayTasks.length ? `<div class="dd-sec">当天安排</div>` + dayTasks.map(ddRowTask).join('') : ''}
          ${daySessions.length ? `<div class="dd-sec">当天足迹</div>` + daySessions.map(ddRowSes).join('') : ''}
          ${!dayTasks.length && !daySessions.length ? '<div class="dd-empty">这天还没有安排，也没关系。</div>' : ''}
        </div>
      </div>`;
    root.querySelectorAll('[data-act]').forEach((el) => {
      const act = el.dataset.act;
      if (act === 'prev') el.onclick = () => { offset -= 1; load(); };
      else if (act === 'next') el.onclick = () => { if (canGoNext) { offset += 1; load(); } };
    });
    root.querySelectorAll('.cal-cell:not(.empty)').forEach((el) => {
      el.onclick = () => { const d = Number(el.dataset.d); const idx = cells.findIndex((c) => !c.empty && c.day === d); if (idx >= 0) selectDay(idx); };
    });
  }

  function calCellHtml(c, i) {
    if (c.empty) return '<div class="cal-cell empty"></div>';
    const glyphs = c.pets.length
      ? `<div class="glyph-stack">${c.pets.map((p) => `<img class="glyph-pet" src="${esc(p.img)}" style="${p.style}" alt="" />`).join('')}</div>`
      : '';
    const dots = c.dots.length
      ? `<div class="task-dots">${c.dots.map((d) => `<div class="td ${d.done ? 'done' : ''}"></div>`).join('')}</div>`
      : '';
    const cls = `cal-cell ${c.today && !c.sel ? 'today' : ''} ${c.sel ? 'selected' : ''}`;
    return `<div class="${cls}" data-d="${c.day}">${glyphs}${dots}<span class="num">${c.day}</span></div>`;
  }

  function ddRowTask(t) {
    return `<div class="dd-row ${t.done ? 'done' : ''}">
      <div class="dd-dot ${t.done ? 'on' : ''}"></div>
      <div class="dd-text"><div class="dd-t">${esc(t.title)}</div>${t.repeatLabel ? `<div class="dd-m">🔁 ${esc(t.repeatLabel)}</div>` : ''}</div>
    </div>`;
  }
  function ddRowSes(s) {
    return `<div class="dd-row"><div class="dd-dot ses"></div><div class="dd-text"><div class="dd-t">${esc(s.text)}</div></div></div>`;
  }

  load();
  return () => {};
}
