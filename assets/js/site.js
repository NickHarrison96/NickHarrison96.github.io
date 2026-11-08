// Entry module loaded by every page: <script type="module" src="assets/js/site.js">.
// Shell behaviour lives here; effects and page features are separate modules it imports.
// Removing this one script tag leaves a fully working static site (plan: rollback).

const root = document.documentElement;
const header = document.querySelector('.site-header');

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

export { root };
