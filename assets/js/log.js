// Field log on writing.html: tool releases from the shared catalog, plus filters/search
// and the one-open-at-a-time accordion. The static entries read fine without this module.
import { TOOLS } from './catalog.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const live = TOOLS.filter((t) => t.status === 'live' && t.host === 'github');

/* ── Field log ───────────────────────────────────────────────────────────── */
const list = document.getElementById('log-list');
if (list) {
  // Tool releases come from the catalog, placed after the projects.
  const anchor = list.querySelector('[data-type="writeup"]');
  for (const t of live) {
    const li = document.createElement('li');
    li.className = 'log-entry';
    li.dataset.type = 'tool';
    li.innerHTML = `<button type="button" class="log-head" aria-expanded="true"><span class="log-type">Tool</span><span class="log-meta">${esc(t.version)}</span><span class="log-title">${esc(t.name)}</span></button>
      <div class="log-body"><p>${esc(t.summary)}</p><a href="downloads.html">Open tool <span aria-hidden="true">→</span></a></div>`;
    list.insertBefore(li, anchor);
  }

  const entries = [...list.querySelectorAll('.log-entry')];
  const chips = [...document.querySelectorAll('#log .chip')];
  const q = document.getElementById('log-q');
  const empty = document.querySelector('#log .log-empty');
  let filter = 'all';

  list.classList.add('enhanced');
  const setOpen = (li) => {
    for (const e of entries) {
      const on = e === li;
      e.classList.toggle('open', on);
      e.querySelector('.log-head').setAttribute('aria-expanded', String(on));
    }
  };
  setOpen(entries[0]);
  list.addEventListener('click', (e) => {
    const head = e.target.closest('.log-head');
    if (!head) return;
    const li = head.closest('.log-entry');
    setOpen(li.classList.contains('open') ? null : li);
  });

  const matches = (e, type, needle) => (type === 'all' || e.dataset.type === type) && (!needle || e.textContent.toLowerCase().includes(needle));
  const apply = () => {
    const needle = (q?.value || '').trim().toLowerCase();
    let shown = 0;
    for (const e of entries) {
      const ok = matches(e, filter, needle);
      const was = !e.hidden;
      e.hidden = !ok;
      if (ok) {
        if (!was) { e.style.setProperty('--d', `${shown * 60}ms`); e.classList.remove('enter'); void e.offsetWidth; e.classList.add('enter'); }
        shown++;
      }
    }
    for (const c of chips) {
      c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
      c.querySelector('.n').textContent = entries.filter((e) => matches(e, c.dataset.filter, needle)).length;
    }
    if (empty) empty.hidden = shown > 0;
    const firstOpen = entries.find((e) => !e.hidden && e.classList.contains('open'));
    if (!firstOpen) setOpen(entries.find((e) => !e.hidden) || null);
  };
  for (const c of chips) c.addEventListener('click', () => { filter = c.dataset.filter; apply(); });
  q?.addEventListener('input', apply);
  apply();
}
