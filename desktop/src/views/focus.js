// src/views/focus.js —— 专注模式 / 冥想模式
import * as store from '../store.js';
import { getPet, petAnims } from '../pets.js';
import { focusDone, focusAbort } from '../broadcast.js';
import { esc } from '../ui.js';

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return m + ':' + ss;
}

export function renderFocus(root) {
  const pet = getPet(store.getMine().current || 'orange');
  const anims = petAnims(pet.key) || {};
  const fallback = pet.read;

  let mode = 'focus';
  let running = false;
  let left = 25 * 60;
  let sceneSrc = anims.read || fallback;
  let sceneLive = false;
  let sub = '从今日待办带一件事来，或者就这样开始';
  let btnText = '开始专注';
  let taskTitle = '';
  let timer = null;
  let coffeeTimer = null;

  function setScene(scene) {
    if (scene === 'keyboard') sceneSrc = anims.keyboard || anims.read || fallback;
    else if (scene === 'sunset') sceneSrc = anims.sunset || anims.read || fallback;
    else if (scene === 'coffee') sceneSrc = anims.coffee || anims.read || fallback;
    else sceneSrc = anims.read || fallback;
    sceneLive = scene !== '' && scene !== 'read';
    paint();
  }

  function switchMode(m) {
    if (running) return;
    mode = m;
    const total = m === 'focus' ? 25 * 60 : 15 * 60;
    left = total;
    taskTitle = m === 'meditate' ? '' : taskTitle;
    btnText = m === 'focus' ? '开始专注' : '开始冥想';
    sub = m === 'focus' ? '从今日待办带一件事来，或者就这样开始' : '什么都不用选，跟着呼吸就好';
    setScene('');
  }

  function start() {
    if (running) { finish(true); return; }
    if (mode !== 'focus') taskTitle = '';
    running = true;
    sub = '';
    btnText = mode === 'focus' ? '专注中 · 点击结束' : '冥想中 · 点击结束';
    setScene(mode === 'focus' ? 'keyboard' : 'sunset');
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        paint({ left: 0, timeText: '00:00' });
        finish(true);
        return;
      }
      paint({ left, timeText: fmt(left) });
    }, 1000);
  }

  async function finish(completed) {
    if (timer) { clearInterval(timer); timer = null; }
    if (coffeeTimer) { clearTimeout(coffeeTimer); coffeeTimer = null; }
    const idle = mode === 'focus' ? '开始专注' : '开始冥想';
    if (completed) {
      running = false; btnText = idle;
      const minutes = mode === 'focus' ? 25 : 15;
      const content = mode === 'focus'
        ? `专注 ${minutes} 分钟${taskTitle ? '：' + taskTitle : ''}`
        : `冥想 ${minutes} 分钟`;
      await store.addFootprint(mode, content, pet.name);
      await store.saveMessage('pet', focusDone(mode, taskTitle, pet.name), pet.name);
      sub = mode === 'focus' ? '搞定啦——陪你喝杯咖啡，慢慢回回神。' : '这阵呼吸记下了，喝口水，慢慢回来。';
      setScene('coffee');
      coffeeTimer = setTimeout(() => {
        coffeeTimer = null;
        setScene('');
        sub = mode === 'focus' ? '从今日待办带一件事来，或者就这样开始' : '什么都不用选，跟着呼吸就好';
        paint();
      }, 6000);
      paint();
    } else {
      running = false; btnText = idle;
      setScene('');
      sub = mode === 'focus' ? '从今日待办带一件事来，或者就这样开始' : '什么都不用选，跟着呼吸就好';
      paint();
    }
  }

  function paint(extra) {
    const timeText = extra?.timeText ?? fmt(left);
    root.innerHTML = `
      <div class="page focus-page">
        <div class="focus-mode-switch">
          <div class="fm ${mode === 'focus' ? 'on' : ''}" data-act="mode" data-mode="focus">专注 25'</div>
          <div class="fm ${mode === 'meditate' ? 'on' : ''}" data-act="mode" data-mode="meditate">冥想 15'</div>
        </div>
        <div class="focus-card">
          <div class="focus-stage">
            <img class="pet-corner ${sceneLive ? 'live' : ''}" src="${esc(sceneSrc)}" alt="${esc(pet.name)}" />
            <div class="timer-sub">${esc(sub)}</div>
          </div>
          <div class="timer ${running ? 'running' : ''}">${timeText}</div>
          <button class="btn-primary big" data-act="start">${esc(btnText)}</button>
        </div>
      </div>`;
    const img = root.querySelector('.pet-corner');
    if (img) img.onerror = () => { if (img.src !== location.origin + fallback && !img.src.endsWith(fallback)) img.src = fallback; };
    root.querySelectorAll('[data-act]').forEach((el) => {
      const act = el.dataset.act;
      if (act === 'mode') el.onclick = () => switchMode(el.dataset.mode);
      else if (act === 'start') el.onclick = () => start();
    });
  }

  paint();
  return () => { if (timer) clearInterval(timer); if (coffeeTimer) clearTimeout(coffeeTimer); };
}
