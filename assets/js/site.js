// Entry module loaded by every page: <script type="module" src="assets/js/site.js">.
// Shell behaviour lives here; effects and page features are separate modules it imports.
// Removing this one script tag leaves a fully working static site (plan: rollback).

import { detectTier, setTier, startWatchdog, isForced, isNarrowView } from './fx-tier.js';

const root = document.documentElement;
const header = document.querySelector('.site-header');

/* Effect tier first, so CSS can react before anything animates. */
setTier(detectTier());

/* aria-current: the header is byte-identical on every page (checked by
   tools/check-site.mjs), so the current hub is marked at runtime. A sub-page marks
   the hub it lives under (aria-current="true"); the hub page itself gets "page". */
const fileOf = (url) => url.pathname.split('/').pop() || 'index.html';
const here = fileOf(location);
const HUB_OF = { 'apfs-recovery.html': 'writing.html' };
for (const a of document.querySelectorAll('.site-nav a, .footer-nav a')) {
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || u.hash) continue;
  if (fileOf(u) === here) a.setAttribute('aria-current', 'page');
  else if (fileOf(u) === HUB_OF[here]) a.setAttribute('aria-current', 'true');
}

/* Real header height (it wraps on narrow screens) for sticky offsets and anchor scrolling. */
if (header && 'ResizeObserver' in window) {
  new ResizeObserver(() => root.style.setProperty('--header-real', `${header.offsetHeight}px`)).observe(header);
}

/* Shortcut hint: ⌘K on Apple platforms, Ctrl K elsewhere. */
const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
if (!isApple) for (const k of document.querySelectorAll('.search-btn kbd')) k.textContent = 'Ctrl K';

/* Header: solid backdrop once the page scrolls. Passive listener, class toggle only. */
let scrolled = null;
const onScroll = () => {
  const s = window.scrollY > 8;
  if (s !== scrolled && header) header.classList.toggle('scrolled', (scrolled = s));
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Mobile menu. Without JS the nav simply wraps under the brand (no hidden state). */
const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('site-nav');
if (menuBtn && nav) {
  const set = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    header.classList.toggle('menu-open', open);
  };
  menuBtn.addEventListener('click', () => set(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { set(false); menuBtn.focus(); }
  });
}

/* Ticker pause/resume (desktop; the bar is hidden under 1024px). */
const marquee = document.querySelector('.marquee');
const mqBtn = marquee && marquee.querySelector('.marquee-toggle');
if (marquee && mqBtn) {
  const setPaused = (paused) => {
    marquee.classList.toggle('is-paused', paused);
    mqBtn.setAttribute('aria-pressed', String(paused));
    mqBtn.setAttribute('aria-label', paused ? 'Resume highlights' : 'Pause highlights');
    mqBtn.textContent = paused ? 'Play' : 'Pause';
  };
  mqBtn.addEventListener('click', () => setPaused(!marquee.classList.contains('is-paused')));
}

/* Copy buttons: <button data-copy="text" data-copy-idle="copy">. */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  let ok = true;
  try { await navigator.clipboard.writeText(btn.dataset.copy); } catch { ok = false; }
  const idle = btn.dataset.copyIdle || 'copy';
  btn.textContent = ok ? 'copied ✓' : 'press Ctrl+C';
  btn.classList.toggle('copied', ok);
  clearTimeout(btn._t);
  btn._t = setTimeout(() => { btn.textContent = idle; btn.classList.remove('copied'); }, 1600);
});

/* Page features, loaded only where their markup exists. */
// Palette + Konami load first; data-ready marks them wired (used by tools/smoke.mjs).
Promise.all([import('./palette.js'), import('./konami.js')]).then(() => { root.dataset.ready = '1'; });
if (root.classList.contains('booting')) import('./boot.js');
const loadTerminal = () => {
  if (!document.getElementById('term-input') || isNarrowView() || loadTerminal.done) return;
  loadTerminal.done = true;
  import('./terminal.js');
};
loadTerminal();
if (window.matchMedia) {
  const mq = matchMedia('(max-width: 1023px)');
  mq.addEventListener ? mq.addEventListener('change', loadTerminal) : mq.addListener(loadTerminal);
}
if (document.querySelector('[data-scramble]')) import('./scramble.js').then((m) => m.startScramble());
if (document.querySelector('main.home')) import('./home.js');
if (document.getElementById('log-list')) import('./log.js');
if (document.querySelector('.section-nav')) import('./sections.js');
if (document.querySelector('main.case')) import('./case.js');

/* Effects last: the shader compile must not delay the UI modules above. */
if (root.dataset.fx !== 'static') {
  import('./fx-physics.js').then((m) => m.startPhysics());
  import('./fx-gravity.js').then((m) => m.startGravity(document.getElementById('fx-bg')));
  if (!isForced()) startWatchdog();
}

export { root };
