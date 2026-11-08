// Site-wide command palette: ⌘K / Ctrl+K (or the header Search button) searches pages,
// projects, tools and case studies. Full keyboard support; Esc returns focus.
import { TOOLS } from './catalog.js';
import { PROJECTS } from './projects.js';

import { PAGES } from './registry.js';
const ITEMS = [...PAGES,
 ...PROJECTS.map(p=>({label:p.plain,kind:'project',href:p.url,keys:p.keys})),
 ...TOOLS.filter(t=>t.status==='live').map(t=>({label:t.name,kind:'tool',href:'downloads.html#'+t.name.toLowerCase(),keys:t.summary}))
];

const backdrop = document.createElement('div');
backdrop.className = 'palette-backdrop';
backdrop.hidden = true;
backdrop.innerHTML = `
  <div class="palette" role="dialog" aria-modal="true" aria-label="Search the site">
    <div class="palette-input">
      <span aria-hidden="true">&gt;</span>
      <input type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list"
        aria-label="Search projects, case studies, tools and pages" placeholder="Search projects, case studies, tools…" autocomplete="off" spellcheck="false">
    </div>
    <ul class="palette-list" id="palette-list" role="listbox" aria-label="Results"></ul>
    <p class="palette-empty" hidden>No matches. Try a device, tool or page name.</p>
    <button type="button" class="palette-close">Close search</button><div class="palette-foot" aria-hidden="true"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div>
  </div>`;
document.body.append(backdrop);

const input = backdrop.querySelector('input');
const list = backdrop.querySelector('.palette-list');
const empty = backdrop.querySelector('.palette-empty');
let results = [];
let active = 0;
let returnFocus = null;

const isOpen = () => !backdrop.hidden;

function render() {
  const q = input.value.trim().toLowerCase();
  results = ITEMS.filter((i) => !q || `${i.label} ${i.kind} ${i.keys || ''}`.toLowerCase().includes(q));
  active = Math.min(active, Math.max(0, results.length - 1));
  list.innerHTML = '';
  results.forEach((item, i) => {
    const li = document.createElement('li');
    li.id = `pal-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === active));
    const a = document.createElement('span');
    a.className = 'pal-label';
    a.textContent = item.label;
    const k = document.createElement('span');
    k.className = 'pal-kind';
    k.textContent = item.kind;
    li.append(a, k);
    li.addEventListener('mousemove', () => { if (active !== i) { active = i; mark(); } });
    li.addEventListener('click', () => go(item));
    list.append(li);
  });
  empty.hidden = results.length > 0;
  mark();
}

function mark() {
  [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
  if (results.length) {
    input.setAttribute('aria-activedescendant', `pal-${active}`);
    list.children[active]?.scrollIntoView({ block: 'nearest' });
  } else input.removeAttribute('aria-activedescendant');
}

function go(item) {
  close(false);
  if (/^https?:/.test(item.href)) window.open(item.href, '_blank', 'noopener');
  else location.href = item.href;
}

// Make everything behind the dialog inert so screen readers and Tab stay inside it.
function setInert(on) {
  for (const el of document.body.children) {
    if (el.contains(backdrop)) continue;
    if (on) { if (!el.inert) { el.inert = true; el.dataset.paletteInert = ''; } }
    else if ('paletteInert' in el.dataset) { el.inert = false; delete el.dataset.paletteInert; }
  }
}

export function open() {
  if (isOpen()) return;
  returnFocus = document.activeElement;
  backdrop.hidden = false;
  document.documentElement.classList.add('palette-open');
  setInert(true);
  input.value = '';
  active = 0;
  render();
  input.focus();
}

export function close(restore = true) {
  if (!isOpen()) return;
  input.blur(); // a hidden element can keep focus in Chrome; release it explicitly
  backdrop.hidden = true;
  document.documentElement.classList.remove('palette-open');
  setInert(false);
  if (restore && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
}

input.addEventListener('input', () => { active = 0; render(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) { active = (active + 1) % results.length; mark(); } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { active = (active - 1 + results.length) % results.length; mark(); } }
  else if (e.key === 'Home') { e.preventDefault(); active = 0; mark(); }
  else if (e.key === 'End') { e.preventDefault(); active = Math.max(0, results.length - 1); mark(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) go(results[active]); }
});
backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); return; }
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    // Leave Ctrl/⌘K to the browser when another text field (not the terminal) has focus.
    const el = document.activeElement;
    const typing = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    if (typing && el.id !== 'term-input' && !backdrop.contains(el)) return;
    e.preventDefault();
    isOpen() ? close() : open();
  }
});
for (const b of document.querySelectorAll('[data-palette-open]')) b.addEventListener('click', open);

backdrop.querySelector(".palette-close").addEventListener("click",()=>close());

// Cycle through both the combobox and visible close button. Preserve Tab within the modal only.
backdrop.addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const stops=[input,backdrop.querySelector('.palette-close')];
 const index=stops.indexOf(document.activeElement);
 e.preventDefault();stops[(index+(e.shiftKey?-1:1)+stops.length)%stops.length].focus();
});
