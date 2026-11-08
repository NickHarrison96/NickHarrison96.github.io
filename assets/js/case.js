// Case-study page: timeline nodes light up as each phase scrolls into view
// (or is hovered/focused). Without JS every node is lit (see styles.css).
const phases = [...document.querySelectorAll('.timeline .phase')];

const light = (el) => el.classList.add('lit');

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { light(e.target); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -35% 0px' });
  phases.forEach((p) => io.observe(p));
} else {
  phases.forEach(light);
}

for (const p of phases) {
  p.addEventListener('mouseenter', () => light(p));
  p.addEventListener('focusin', () => light(p));
}
