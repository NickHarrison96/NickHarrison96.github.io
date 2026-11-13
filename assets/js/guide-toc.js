// Sticky guide table of contents: highlights the section in view.
// The nav is plain in-page anchors and works with JavaScript disabled.
const toc = document.querySelector('.tutorial-toc[data-observe]');
const links = toc ? [...toc.querySelectorAll('a[href^="#"]')] : [];
const sections = links
  .map((a) => document.getElementById(a.hash.slice(1)))
  .filter(Boolean);

if (toc && sections.length) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mark = (id) => {
    for (const a of links) {
      if (a.hash === `#${id}`) {
        a.setAttribute('aria-current', 'location');
        const styles = getComputedStyle(toc);
        if (styles.flexDirection === 'column') {
          const top = a.offsetTop;
          const bottom = top + a.offsetHeight;
          if (top < toc.scrollTop || bottom > toc.scrollTop + toc.clientHeight) {
            toc.scrollTo({ top: Math.max(0, top - 8), behavior: reduced ? 'auto' : 'smooth' });
          }
        }
      } else {
        a.removeAttribute('aria-current');
      }
    }
  };

  const visible = new Set();
  const headerLine = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-real').trim();
    const fallback = getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim();
    const px = parseFloat(raw || fallback || '68') || 68;
    return px + 16;
  };
  const pick = () => {
    // Prefer the last section whose heading has reached the line under the header.
    const line = headerLine();
    let current = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line + 8) current = s;
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
      current = sections[sections.length - 1];
    }
    mark(current.id);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      pick();
    }, { rootMargin: '-80px 0px -70% 0px', threshold: [0, 0.1, 0.25, 1] });
    for (const section of sections) io.observe(section);
  }
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; pick(); });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', pick, { passive: true });

  if (location.hash) {
    const id = location.hash.slice(1);
    if (sections.some((s) => s.id === id)) mark(id);
  } else {
    pick();
  }
}
