// ↑ ↑ ↓ ↓ ← → ← → B A toggles "jailbreak mode": green-phosphor accent + CRT scanlines.
// Persisted per visitor (localStorage, best effort); applied before first paint by the
// inline <head> snippet. Colours swap under reduced motion too; nothing animates then.
const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const KEY = 'nh-jailbreak';
const root = document.documentElement;
let pos = 0;

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

function toggle() {
  const on = root.dataset.theme !== 'jailbreak';
  if (on) root.dataset.theme = 'jailbreak';
  else delete root.dataset.theme;
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch { /* private mode: session only */ }
  dispatchEvent(new CustomEvent('nh:theme', { detail: { theme: on ? 'jailbreak' : 'default' } }));
  toast(on ? 'jailbreak mode: on  (↑↑↓↓←→←→BA to exit)' : 'jailbreak mode: off');
}

addEventListener('keydown', (e) => {
  const el = e.target;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  pos = k === SEQ[pos] ? pos + 1 : k === 'ArrowUp' ? (pos === 2 ? 2 : 1) : 0;
  if (pos === SEQ.length) { pos = 0; toggle(); }
});

// Visible, keyboard-reachable way out of jailbreak mode (shown only while it is on).
const exitBtn = document.createElement('button');
exitBtn.type = 'button';
exitBtn.className = 'jb-exit';
exitBtn.textContent = 'Exit jailbreak mode';
exitBtn.addEventListener('click', () => { if (root.dataset.theme === 'jailbreak') toggle(); });
document.body.append(exitBtn);
