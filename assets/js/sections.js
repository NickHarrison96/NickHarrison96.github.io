// In-page section nav (repair.html, about.html): marks the section currently in view.
// The nav is plain anchor links and works without this module.
const nav = document.querySelector('.section-nav');
const links = nav ? [...nav.querySelectorAll('a[href^="#"]')] : [];
const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);

if (sections.length) {
  const mark = (id) => {
    for (const a of links) {
      if (a.hash === `#${id}`) {
        a.setAttribute('aria-current', 'true');
        // Keep the active item visible when the nav scrolls sideways on phones.
        const l = a.offsetLeft;
        const r = l + a.offsetWidth;
        if (l < nav.scrollLeft || r > nav.scrollLeft + nav.clientWidth) nav.scrollTo({ left: l - 8 });
      } else a.removeAttribute('aria-current');
    }
  };
  // The current section is the last one whose top has passed the sticky nav.
  const update = () => {
    const line = nav.getBoundingClientRect().bottom + 96;
    let current = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections[sections.length - 1];
    mark(current.id);
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
