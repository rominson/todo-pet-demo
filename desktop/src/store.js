// src/store.js —— 本地状态 + 持久化（Tauri store 优先，浏览器 localStorage 兜底）
// 数据 schema 与小程序云端一致：tasks / footprints / sessions / firstOpen / currentPet / introSeeded。

import { todayStr } from './agg.js';

const LS_KEY = 'maorong-v1-desktop';

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function isTauri() {
  return typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__);
}

let _store = null;          // Tauri Store 实例（懒加载）
let _loaded = false;

function defaultState() {
  return {
    tasks: [],
    footprints: [],
    sessions: [],
    firstOpen: '',
    currentPet: 'orange',
    introSeeded: false
  };
}

export const state = defaultState();

async function getTauriStore() {
  if (_store) return _store;
  const { load } = await import('@tauri-apps/plugin-store');
  _store = await load('store.json', { autoSave: true });
  return _store;
}

export async function init() {
  if (_loaded) return;
  let raw = null;
  try {
    if (isTauri()) {
      const s = await getTauriStore();
      raw = await s.get(LS_KEY);
    } else {
      raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    }
  } catch (e) {
    raw = null;
  }
  Object.assign(state, defaultState(), raw || {});
  if (!state.firstOpen) state.firstOpen = todayStr();
  _loaded = true;
  await persist();
}

export async function persist() {
  try {
    if (isTauri()) {
      const s = await getTauriStore();
      await s.set(LS_KEY, state);
      // ⚠️ 必须显式 save：plugin-store 的 set 只写内存，autoSave 在 Rust 端是
      // fire-and-forget 的异步 save。桌面宠物「关闭窗口=进程退出」，异步 save 常来不及
      // 落盘就被 kill，表现为「重启后回到初始状态、待办全丢」。这里 await save 强制落盘。
      await s.save();
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }
  } catch (e) {
    // 持久化失败不阻塞 UI（例如浏览器隐私模式）
    console.error('[store] persist failed', e);
  }
}

// —— 宠物 ——
export function getMine() {
  return { ok: true, current: state.currentPet || 'orange' };
}
export async function setCurrentPet(key) {
  state.currentPet = key;
  await persist();
}

// —— 引导待办（首次启动种一条，幂等靠 introSeeded）——
export async function ensureIntroTask() {
  if (state.introSeeded) return;
  state.introSeeded = true;
  state.tasks.push({
    _id: uid(),
    title: '今天想完成的一件小事',
    due: '',
    important: false,
    repeat: 'none',
    done: false,
    done_at: null,
    created_at: new Date().toISOString(),
    note: ''
  });
  await persist();
}

// —— 待办 ——
export async function list() {
  return { list: state.tasks };
}

export async function create({ title, due, important, repeat }) {
  state.tasks.push({
    _id: uid(),
    title: String(title || '').trim(),
    due: due || '',
    important: !!important,
    repeat: repeat || 'none',
    done: false,
    done_at: null,
    created_at: new Date().toISOString(),
    note: ''
  });
  await persist();
  return { ok: true };
}

export async function toggle(id) {
  const t = state.tasks.find((x) => x._id === id);
  if (!t) return { ok: false };
  const nowDone = !t.done;
  if (!nowDone) {
    if (t.gen_id) {
      // 撤销的是「重复生成的子任务」→ 直接删掉，父任务保留已完成
      state.tasks = state.tasks.filter((x) => x._id !== id);
    } else {
      // 撤销父任务 → 同时移除它生成的子任务
      state.tasks = state.tasks.filter((x) => x._id !== id && x.gen_id !== id);
    }
  } else {
    t.done = true;
    t.done_at = new Date().toISOString();
    // 重复任务：完成后自动生成下一条（避免重复生成用 gen_id 去重）
    if (t.repeat && t.repeat !== 'none' && !state.tasks.some((x) => x.gen_id === id)) {
      state.tasks.push({
        _id: uid(),
        title: t.title,
        due: t.due,
        important: t.important,
        repeat: t.repeat,
        done: false,
        done_at: null,
        created_at: new Date().toISOString(),
        gen_id: id
      });
    }
  }
  await persist();
  return { ok: true, done: nowDone };
}

export async function remove(id) {
  state.tasks = state.tasks.filter((x) => x._id !== id && x.gen_id !== id);
  await persist();
  return { ok: true };
}

// —— 足迹 ——
export async function addFootprint(type, content, pet) {
  state.footprints.push({
    _id: uid(),
    type,
    content: content || '',
    pet: pet || state.currentPet || 'orange',
    created_at: new Date().toISOString()
  });
  await persist();
  return { ok: true };
}

export async function getFootprints(limit = 200) {
  const list = state.footprints.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  return { ok: true, list };
}

// —— 陪伴对话 ——
export async function saveMessage(role, content, pet) {
  state.sessions.push({
    _id: uid(),
    role,
    content: content || '',
    pet: pet || state.currentPet || 'orange',
    created_at: new Date().toISOString()
  });
  await persist();
  return { ok: true };
}

export async function getHistory(limit = 30, pet) {
  let list = state.sessions.slice();
  if (pet) list = list.filter((s) => s.pet === pet);
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { ok: true, list: list.slice(0, limit).reverse() };
}
