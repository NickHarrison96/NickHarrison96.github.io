/* Optional decorative system. Content, selection and native links are independent. */
const region = document.querySelector('.cyber-region');
const button = document.querySelector('.motion-toggle');
if (region && button) {
  const plane = region.querySelector('.etch-plane');
  const light = region.querySelector('.etch-light');
  const joints = region.querySelector('.etch-joints');
  const state = button.querySelector('[data-motion-state]');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const storageKey = 'hts-ambient-motion';
  let enabled = true;
  try { enabled = localStorage.getItem(storageKey) !== 'off'; } catch { /* Static privacy modes still get a working toggle. */ }
  let visible = false, frame = 0, previous = 0, box, disposed = false;
  const current = {x: 0, y: 0, light: 0}, velocity = {x: 0, y: 0, light: 0};
  const target = {x: 0, y: 0, light: 0};
  function allowed() { return fine.matches && !reduce.matches && !forced.matches; }
  function eligible() { return enabled && allowed() && visible && !document.hidden && !disposed; }
  function paint() {
    plane.style.transform = `translate3d(${current.x * 10}px,${current.y * 10}px,0)`;
    joints.style.transform = `translate3d(${current.x * 14}px,${current.y * 14}px,0)`;
    light.style.transform = `translate3d(${current.x * 100}px,${current.y * 140}px,0)`;
    light.style.opacity = String(current.light * 0.24);
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    for (const key of Object.keys(current)) current[key] = velocity[key] = target[key] = 0;
    paint();
  }
  function update() {
    const active = eligible();
    region.classList.toggle('motion-active', active);
    button.hidden = false;
    button.disabled = !allowed();
    button.setAttribute('aria-pressed', String(enabled && allowed()));
    state.textContent = reduce.matches ? 'Reduced' : forced.matches || !fine.matches ? 'Static' : enabled ? 'On' : 'Off';
    if (!active) stop();
  }
  function tick(time) {
    frame = 0;
    if (!eligible()) { stop(); return; }
    const dt = previous ? Math.min((time - previous) / 1000, 0.032) : 1 / 60;
    previous = time;
    let settling = false;
    for (const key of Object.keys(current)) {
      velocity[key] += ((target[key] - current[key]) * 180 - velocity[key] * 27) * dt;
      current[key] += velocity[key] * dt;
      if (Math.abs(target[key] - current[key]) > 0.001 || Math.abs(velocity[key]) > 0.005) settling = true;
      else { current[key] = target[key]; velocity[key] = 0; }
    }
    paint();
    if (settling) frame = requestAnimationFrame(tick); else previous = 0;
  }
  function wake() { if (eligible() && !frame) frame = requestAnimationFrame(tick); }
  function measure() { box = region.getBoundingClientRect(); }
  function pointer(event) {
    if (!eligible() || event.pointerType !== 'mouse') return;
    const near = event.clientX > box.left - 180 && event.clientY > box.top - 60 && event.clientY < box.bottom + 60;
    target.x = near ? Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1)) : 0;
    target.y = near ? Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1)) : 0;
    target.light = near ? 1 : 0;
    if (near || current.light > 0) wake();
  }
  function leave() { target.x = target.y = target.light = 0; wake(); }
  button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch { /* Retain this page's choice without storage. */ }
    update();
  });
  window.addEventListener('storage', event => { if (event.key === storageKey) { enabled = event.newValue !== 'off'; update(); } });
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) measure();
    update();
  });
  observer.observe(region); measure(); update();
  document.addEventListener('pointermove', pointer, {passive: true});
  document.documentElement.addEventListener('pointerleave', leave, {passive: true});
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', measure, {passive: true});
  window.addEventListener('scroll', () => { if (eligible()) measure(); }, {passive: true});
  for (const query of [fine, reduce, forced]) query.addEventListener('change', update);
  window.addEventListener('pagehide', () => { disposed = true; update(); observer.disconnect(); });
  window.addEventListener('pageshow', () => { disposed = false; observer.observe(region); measure(); update(); });
}
