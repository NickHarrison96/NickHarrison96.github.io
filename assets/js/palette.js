// Site-wide command palette: ⌘K / Ctrl+K (or the header Search button) searches pages,
// projects, tools and case studies. Full keyboard support; Esc returns focus.
import { TOOLS } from './catalog.js';
import { PROJECTS } from './projects.js';

const R2R = 'right to repair';
const ITEMS = [
  { label: 'Home', kind: 'page', href: 'index.html' },
  { label: 'Work', kind: 'hub', href: 'work.html', keys: 'projects repositories github' },
  { label: 'Blog', kind: 'hub', href: 'writing.html', keys: 'blog case studies essays tutorials write-ups newsletter' },
  { label: 'Right to Repair', kind: 'hub', href: 'repair.html', keys: 'campaign' },
  { label: 'Tools', kind: 'hub', href: 'tools.html', keys: 'write-ups kits engineering' },
  { label: 'Downloads', kind: 'hub', href: 'downloads.html', keys: 'downloads free software host folder' },
  { label: 'Tool Write-ups', kind: 'section', href: 'tools.html#tool-writeups' },
  { label: 'Engineering Kits', kind: 'section', href: 'tools.html#engineering-kits' },
  { label: 'About', kind: 'hub', href: 'about.html', keys: 'company harrison technology solutions' },
  { label: 'APFS Recovery Case Study', kind: 'case study', href: 'apfs-recovery.html', keys: 'macos recovery opencore disk' },
  { label: 'Live terminal', kind: 'section', href: 'index.html#terminal' },
  { label: 'Projects', kind: 'section', href: 'work.html#projects' },
  { label: 'Essays', kind: 'section', href: 'writing.html#essays' },
  { label: 'Case Studies', kind: 'section', href: 'writing.html#case-studies' },
  { label: 'Tutorials', kind: 'section', href: 'writing.html#tutorials', keys: 'guides kali wsl2' },
  { label: 'Kali Linux Graphical Desktop on Windows 11 with WSL2', kind: 'tutorial', href: 'kali-wsl2-desktop-windows-11.html', keys: 'kali linux wsl2 wslg win-kex windows 11 desktop' },
  { label: 'Kali Linux Desktop on Windows 10 with WSL2 and Win-KeX', kind: 'tutorial', href: 'kali-wsl2-desktop-windows-10.html', keys: 'kali linux wsl2 win-kex windows 10 desktop' },
  { label: 'Philosophy · The Core Manifesto', kind: 'section', href: 'writing.html#philosophy' },
  { label: 'Mission Statement', kind: R2R, href: 'repair.html#mission' },
  { label: 'Legislation', kind: R2R, href: 'repair.html#legislation', keys: 'bills law policy tracker' },
  { label: 'Get Involved', kind: R2R, href: 'repair.html#get-involved', keys: 'petition volunteer representative' },
  { label: 'Repair Guides', kind: R2R, href: 'repair.html#guides', keys: 'fix it yourself phones laptops batteries' },
  { label: 'Repair Cafés', kind: R2R, href: 'repair.html#cafes', keys: 'repair cafe events community' },
  { label: 'Talks & Press', kind: R2R, href: 'repair.html#talks', keys: 'speaking media workshops' },
  { label: 'Who We Are', kind: 'about', href: 'about.html#about' },
  { label: 'The Team', kind: 'about', href: 'about.html#team', keys: 'people' },
  { label: 'Socials', kind: 'about', href: 'about.html#socials', keys: 'email youtube github contact' },
  ...PROJECTS.map((p) => ({ label: p.plain, kind: 'project', href: p.url, keys: p.keys })),
  ...TOOLS.filter((t) => t.status === 'live').map((t) => ({ label: t.name, kind: 'tool', href: 'downloads.html', keys: `${t.version} ${t.category || ''} download` })),
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
