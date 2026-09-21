// src/ui.js —— 轻量 DOM 工具

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

// FLIP：重排前记录各节点 top，重排后让节点从「旧位置」平滑滑到「新位置」
export function captureRects(root, sel) {
  const map = {};
  root.querySelectorAll(sel).forEach((n) => {
    const id = n.dataset && n.dataset.id;
    if (id != null) map[id] = n.getBoundingClientRect().top;
  });
  return map;
}

export function playFlip(root, sel, prev) {
  if (!prev) return;
  root.querySelectorAll(sel).forEach((n) => {
    const id = n.dataset && n.dataset.id;
    if (id == null || prev[id] == null) return;
    const dy = prev[id] - n.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) return;
    n.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
      { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
  });
}
