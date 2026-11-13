// In-page section nav (repair.html, about.html): marks the section currently in view
// on desktop, and collapses sections into an accordion under 1024px.
// The nav is plain anchor links and works without this module.
import { isNarrowView } from './fx-tier.js';

const nav = document.querySelector('.section-nav');
const links = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];
const sections = [...document.querySelectorAll('.hub-section')];
const main = document.querySelector('main.hub');

const mark = (id) => {
  if (!nav) return;
  for (const a of links) {
    if (a.hash === `#${id}`) {
      a.setAttribute('aria-current', 'true');
      if (!isNarrowView()) {
        // Keep the active item visible when the nav scrolls sideways on mid-width screens.
        const l = a.offsetLeft;
        const r = l + a.offsetWidth;
        if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: l - 8 });
      }
    } else a.removeAttribute('aria-current');
  }
};

const openOnly = (section) => {
  for (const s of sections) {
    const on = s === section;
    s.classList.toggle('is-open', on);
    s.querySelector('.hub-acc-btn')?.setAttribute('aria-expanded', String(on));
  }
  if (section) mark(section.id);
};

const applyAccordion = () => {
  if (!main || !sections.length) return;
  const compact = isNarrowView();
  main.classList.toggle('hub-accordion', compact);
  if (!compact) {
    for (const s of sections) {
      s.classList.add('is-open');
      s.querySelector('.hub-acc-btn')?.setAttribute('aria-expanded', 'true');
    }
    return;
  }
  const id = location.hash.replace(/^#/, '');
  const target = sections.find((s) => s.id === id) || sections[0];
  openOnly(target);
};

if (sections.length && main) {
  for (const s of sections) {
    if (s.querySelector('.hub-acc-btn')) continue;
    const hero = s.querySelector('.page-hero') || s.firstElementChild;
    if (!hero) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hub-acc-btn';
    btn.setAttribute('aria-controls', s.id);
    btn.setAttribute('aria-expanded', 'false');
    const title = s.querySelector('.card-title');
    btn.setAttribute('aria-label', ((title && title.innerText) || s.id).trim());
    hero.appendChild(btn);
    btn.addEventListener('click', () => {
      if (!main.classList.contains('hub-accordion')) return;
      if (s.classList.contains('is-open')) {
        s.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        openOnly(s);
        s.scrollIntoView({ block: 'start' });
      }
    });
  }

  nav?.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !main.classList.contains('hub-accordion')) return;
    const s = document.getElementById(a.hash.slice(1));
    if (s && s.classList.contains('hub-section')) openOnly(s);
  });

  addEventListener('hashchange', applyAccordion);
  addEventListener('resize', applyAccordion, { passive: true });
  applyAccordion();
}

// Desktop scroll-spy: the current section is the last one whose top has passed the sticky nav.
if (nav && sections.length) {
  const update = () => {
    if (isNarrowView()) return;
    const line = nav.getBoundingClientRect().bottom + 96;
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections[sections.length - 1];
    if (current) mark(current.id);
  };
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}
