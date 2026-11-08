/* Optional decorative enhancement. Content never depends on this module. */
const region = document.querySelector('.etch-region');
if (region) {
  const plane = region.querySelector('.etch-plane');
  const light = region.querySelector('.etch-light');
  const joints = region.querySelector('.etch-joints');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  let visible = false, frame = 0, previous = 0, box;
  const current = {x: 0, y: 0, light: 0}, velocity = {x: 0, y: 0, light: 0};
  const target = {x: 0, y: 0, light: 0};
  function eligible() { return visible && !document.hidden && fine.matches && !reduce.matches && !forced.matches; }
  function paint() {
    plane.style.transform = `translate3d(${current.x * 4}px,${current.y * 4}px,0)`;
    joints.style.transform = `translate3d(${current.x * 6}px,${current.y * 6}px,0)`;
    light.style.transform = `translate3d(${current.x * 60}px,${current.y * 100}px,0)`;
    light.style.opacity = String(current.light * 0.12);
    region.style.setProperty('--reflection', String(current.light * 0.35));
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    for (const key of Object.keys(current)) current[key] = velocity[key] = target[key] = 0;
    paint();
  }
  function tick(time) {
    frame = 0;
    if (!eligible()) { stop(); return; }
    const dt = previous ? Math.min((time - previous) / 1000, 0.032) : 1 / 60;
    previous = time;
    let settling = false;
    for (const key of Object.keys(current)) {
      // Semi-implicit critically damped spring, bounded inputs; no visible bounce.
      velocity[key] += ((target[key] - current[key]) * 180 - velocity[key] * 27) * dt;
      current[key] += velocity[key] * dt;
      if (Math.abs(target[key] - current[key]) > 0.001 || Math.abs(velocity[key]) > 0.005) settling = true;
      else { current[key] = target[key]; velocity[key] = 0; }
    }
    paint();
    if (settling) frame = requestAnimationFrame(tick);
    else previous = 0;
  }
  function wake() { if (eligible() && !frame) frame = requestAnimationFrame(tick); }
  function measure() { box = region.getBoundingClientRect(); }
  function pointer(event) {
    if (!eligible() || event.pointerType !== 'mouse') return;
    // Track only nearby pointer input. Geometry is cached, never read per frame.
    const near = event.clientX > box.left - 220 && event.clientY > box.top - 80 && event.clientY < box.bottom + 80;
    target.x = near ? Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1)) : 0;
    target.y = near ? Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1)) : 0;
    target.light = near ? 1 : 0;
    if (near || current.light > 0) wake();
  }
  function leave() { target.x = target.y = target.light = 0; wake(); }
  function preferences() { if (!eligible()) stop(); }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) stop(); else measure();
  });
  observer.observe(region);
  measure();
  document.addEventListener('pointermove', pointer, {passive: true});
  document.documentElement.addEventListener('pointerleave', leave, {passive: true});
  document.addEventListener('visibilitychange', preferences);
  window.addEventListener('resize', measure, {passive: true});
  window.addEventListener('scroll', () => { if (eligible()) measure(); }, {passive: true});
  for (const query of [fine, reduce, forced]) query.addEventListener('change', preferences);
  // Page lifecycle cleanup also handles browser back/forward cache restoration.
  window.addEventListener('pagehide', () => { stop(); observer.disconnect(); });
  window.addEventListener('pageshow', () => { observer.observe(region); measure(); });
}
