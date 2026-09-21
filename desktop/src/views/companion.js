// src/views/companion.js —— 宠物陪伴 / AI 对话
import * as store from '../store.js';
import { getPet } from '../pets.js';
import * as agg from '../agg.js';
import { petReply } from '../ai.js';
import { esc } from '../ui.js';

export function renderCompanion(root) {
  const pet = getPet(store.getMine().current || 'orange');
  let messages = [];
  let input = '';
  let thinking = false;

  function ctx() {
    const all = store.state.tasks;
    const today = agg.todayStr();
    const todayTasks = all.filter((t) => agg.isTodayTask(t, today) && !t.done).map((t) => t.title);
    const streak = agg.computeStreak(all);
    const recentDone = all.filter((t) => t.done).slice(-3).map((t) => t.title);
    return { pet, todayTasks, streak, recentDone };
  }

  async function loadHistory() {
    const res = await store.getHistory(40);
    messages = (res.list || []).map((m) => ({ role: m.role, content: m.content }));
    paint();
  }

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    input = '';
    messages.push({ role: 'user', content: text });
    await store.saveMessage('user', text, pet.key);
    paint();
    thinking = true; paint();
    const reply = await petReply(text, ctx());
    thinking = false;
    messages.push({ role: 'pet', content: reply });
    await store.saveMessage('pet', reply, pet.key);
    paint();
    scrollBottom();
  }

  function scrollBottom() {
    const box = root.querySelector('.chat-box');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function paint() {
    const msgs = messages.map((m) => {
      if (m.role === 'user') return `<div class="bubble-row me"><div class="bubble user">${esc(m.content)}</div></div>`;
      return `<div class="bubble-row"><img class="chat-ava" src="${esc(pet.img)}" alt=""/><div class="bubble pet">${esc(m.content)}</div></div>`;
    }).join('');
    const typing = thinking ? `<div class="bubble-row"><img class="chat-ava" src="${esc(pet.img)}" alt=""/><div class="bubble pet typing"><span></span><span></span><span></span></div></div>` : '';

    root.innerHTML = `
      <div class="page companion-page">
        <div class="chat-head">
          <img class="chat-head-ava" src="${esc(pet.img)}" alt=""/>
          <div>
            <div class="chat-name">${esc(pet.name)}</div>
            <div class="chat-sub">${esc(pet.animal)} · 你的陪伴伙伴</div>
          </div>
        </div>
        <div class="chat-box">
          ${messages.length === 0 ? `<div class="chat-empty">${esc(pet.name)}在这儿陪着你。随便说点什么，或者问问今天还有什么事。</div>` : ''}
          ${msgs}
          ${typing}
        </div>
        <div class="chat-input">
          <input class="chat-field" type="text" placeholder="和${esc(pet.name)}说点什么…" value="${esc(input)}" data-act="field" />
          <button class="chat-send" data-act="send">发送</button>
        </div>
      </div>`;

    const field = root.querySelector('.chat-field');
    if (field) {
      field.value = input;
      field.oninput = (e) => { input = e.target.value; };
      field.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } };
      if (document.activeElement !== field) field.focus();
    }
    root.querySelectorAll('[data-act]').forEach((el) => {
      if (el.dataset.act === 'send') el.onclick = () => send();
    });
  }

  loadHistory();
  return () => {};
}
