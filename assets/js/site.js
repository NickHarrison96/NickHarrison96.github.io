// Entry module loaded by every page: <script type="module" src="assets/js/site.js">.
// Shell behaviour lives here; effects and page features are separate modules it imports.
// Removing this one script tag leaves a fully working static site (plan: rollback).

import { detectTier, setTier, startWatchdog, isForced } from './fx-tier.js';

const root = document.documentElement;
const header = document.querySelector('.site-header');

/* Effect tier first, so CSS can react before anything animates. */
setTier(detectTier());
if (root.dataset.fx !== 'static') {
  import('./fx-gravity.js').then((m) => m.startGravity(document.getElementById('fx-bg')));
  import('./fx-physics.js').then((m) => m.startPhysics());
  if (!isForced()) startWatchdog();
}

/* aria-current: the header is byte-identical on every page (checked by
   tools/check-site.mjs), so the current page is marked at runtime. */
const fileOf = (url) => url.pathname.split('/').pop() || 'index.html';
const here = fileOf(location);
for (const a of document.querySelectorAll('.site-nav a, .footer-nav a')) {
  const u = new URL(a.href, location.href);
  if (u.origin === location.origin && fileOf(u) === here && !u.hash) a.setAttribute('aria-current', 'page');
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
if (document.querySelector('main.home')) import('./home.js');
if (document.querySelector('main.case')) import('./case.js');

export { root };
