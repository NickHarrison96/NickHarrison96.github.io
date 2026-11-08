// Site-wide command palette: ⌘K / Ctrl+K (or the header Search button) searches pages,
// projects, tools and case studies. Full keyboard support; Esc returns focus.
import { TOOLS } from './catalog.js';

const ITEMS = [
  { label: 'Home', kind: 'page', href: 'index.html' },
  { label: 'APFS Recovery Case Study', kind: 'case study', href: 'apfs-recovery.html', keys: 'macos recovery opencore disk' },
  { label: 'Projects', kind: 'section', href: 'index.html#projects' },
  { label: 'Live terminal', kind: 'section', href: 'index.html#terminal' },
  { label: 'Right to Repair', kind: 'section', href: 'index.html#repair' },
  { label: 'Field log', kind: 'section', href: 'index.html#log' },
  { label: 'Free tools', kind: 'section', href: 'index.html#tools' },
  { label: 'Philosophy · The Core Manifesto', kind: 'section', href: 'index.html#philosophy' },
  { label: 'LiteLLM Proxy & SDK', kind: 'project', href: 'https://github.com/nickpharrison', keys: 'ai llm gateway python' },
  { label: 'Stable Diffusion WebUI', kind: 'project', href: 'https://github.com/nickpharrison', keys: 'ml pytorch generative' },
  { label: 'MacPro7,1 X570 EFI Architecture', kind: 'project', href: 'https://github.com/NickHarrison96/MSI-MPG-x570-EFI', keys: 'opencore hackintosh efi' },
  ...TOOLS.filter((t) => t.status === 'live').map((t) => ({ label: t.name, kind: 'tool', href: 'downloads.html', keys: `${t.version} ${t.category || ''} download` })),
  { label: 'Downloads', kind: 'page', href: 'downloads.html' },
  { label: 'Mission Statement', kind: 'page', href: 'mission.html' },
  { label: 'Get Involved', kind: 'page', href: 'get-involved.html' },
  { label: 'Repair Guides', kind: 'page', href: 'repair-guides.html' },
  { label: 'Legislation', kind: 'page', href: 'legislation.html' },
  { label: 'Repair Cafés', kind: 'page', href: 'repair-cafes.html' },
  { label: 'Talks', kind: 'page', href: 'talks.html' },
  { label: 'Writing', kind: 'page', href: 'writing.html' },
  { label: 'About', kind: 'page', href: 'about.html' },
  { label: 'The Team', kind: 'page', href: 'team.html' },
  { label: 'Socials', kind: 'page', href: 'socials.html' },
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
    <p class="palette-empty" hidden>No matches</p>
    <div class="palette-foot" aria-hidden="true"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div>
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

export function open() {
  if (isOpen()) return;
  returnFocus = document.activeElement;
  backdrop.hidden = false;
  document.documentElement.classList.add('palette-open');
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
  if (restore && returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
}

input.addEventListener('input', () => { active = 0; render(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) { active = (active + 1) % results.length; mark(); } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { active = (active - 1 + results.length) % results.length; mark(); } }
  else if (e.key === 'Home') { e.preventDefault(); active = 0; mark(); }
  else if (e.key === 'End') { e.preventDefault(); active = Math.max(0, results.length - 1); mark(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) go(results[active]); }
  else if (e.key === 'Tab') e.preventDefault(); // the input is the dialog's only stop
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
