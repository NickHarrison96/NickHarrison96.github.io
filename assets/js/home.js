// Homepage features: free-tools grid and tool releases in the field log (both from
// the shared catalog), field-log filters/search, and the Right to Repair teardown.
// Every section is readable without this module; it only adds behaviour.
import { TOOLS } from './catalog.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tile = (h) => `linear-gradient(135deg, hsl(${h} 68% 42%) 0%, hsl(${(h + 46) % 360} 62% 30%) 100%)`;
const isFile = (u) => /\.(zip|exe|dmg|7z|tar\.gz|tgz|appimage|msi|pkg)$/i.test(u || '');
const live = TOOLS.filter((t) => t.status === 'live' && t.host === 'github');

/* ── Free tools grid ─────────────────────────────────────────────────────── */
const grid = document.getElementById('toolsGrid');
if (grid) {
  grid.innerHTML = live.map((t) => `
    <article class="tool-card tilt">
      <div class="tool-thumb"${t.image ? '' : ` style="background:${tile(t.hue)}"`}>${t.image ? `<img src="${esc(t.image)}" alt="${esc(t.name)} screenshot" loading="lazy">` : ''}</div>
      <div class="tool-top"><h3>${esc(t.name)}</h3><span class="tool-ver">${esc(t.version)}</span></div>
      <p class="tool-sum">${esc(t.summary)}</p>
      <div class="tool-actions">
        <a class="dl-btn magnetic" href="${esc(t.url)}" ${isFile(t.url) ? 'download' : 'target="_blank" rel="noopener noreferrer"'}>Download <span aria-hidden="true">↓</span></a>
        ${t.sha256 ? `<button type="button" class="copy-btn" data-copy="${esc(t.sha256)}" data-copy-idle="copy sha" aria-label="Copy SHA-256 of ${esc(t.name)}">copy sha</button>` : ''}
      </div>
      ${t.sha256 ? `<p class="tool-sha">sha256 ${esc(t.sha256.slice(0, 4))}…${esc(t.sha256.slice(-4))}</p>` : ''}
    </article>`).join('');
}

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

/* ── Right to Repair teardown ────────────────────────────────────────────── */
const repair = document.getElementById('repair');
if (repair) {
  const tabs = [...repair.querySelectorAll('.layer-list a')].sort((a, b) => a.dataset.layer - b.dataset.layer);
  const panels = tabs.map((t) => document.getElementById(t.hash.slice(1)));
  const plates = [...repair.querySelectorAll('.plate')];
  const stage = repair.querySelector('.stack-stage');
  const hint = repair.querySelector('.stack-hint');
  const listEl = repair.querySelector('.layer-list');

  repair.classList.add('teardown-js');
  listEl.setAttribute('role', 'tablist');
  listEl.setAttribute('aria-orientation', 'vertical');
  tabs.forEach((t, i) => {
    t.parentElement.setAttribute('role', 'presentation');
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('tabindex', '-1');
  });

  let active = -1;
  const select = (i, focus = false) => {
    if (i === active) return;
    active = i;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('active', on);
      panels[k].hidden = !on;
      plates[k]?.classList.toggle('active', on);
    });
    if (focus) tabs[i].focus();
  };
  const explode = (on) => {
    stage.classList.toggle('exploded', on);
    if (hint) hint.textContent = on ? 'hover a layer' : 'hover to take it apart';
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', (e) => { e.preventDefault(); select(i); explode(true); });
    t.addEventListener('mouseenter', () => { select(i); explode(true); });
    t.addEventListener('focus', () => explode(true));
    t.addEventListener('keydown', (e) => {
      // The list is drawn top (05) to bottom (01): ArrowDown goes to the lower layer.
      const step = { ArrowDown: -1, ArrowRight: -1, ArrowUp: 1, ArrowLeft: 1 }[e.key];
      if (step) { e.preventDefault(); select((i + step + tabs.length) % tabs.length, true); }
      if (e.key === 'Home') { e.preventDefault(); select(tabs.length - 1, true); }
      if (e.key === 'End') { e.preventDefault(); select(0, true); }
    });
  });
  plates.forEach((p) => p.addEventListener('mouseenter', () => select(Number(p.dataset.layer))));
  stage.addEventListener('mouseenter', () => explode(true));
  stage.addEventListener('mouseleave', () => explode(false));
  listEl.addEventListener('focusout', (e) => { if (!listEl.contains(e.relatedTarget)) explode(false); });
  stage.addEventListener('click', () => explode(!stage.classList.contains('exploded')));

  select(0);
}
