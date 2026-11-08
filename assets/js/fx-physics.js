// UI physics in one requestAnimationFrame loop (plan N1):
//   .magnetic  buttons/CTAs pulled toward the cursor on a spring (--mag-x/--mag-y, --glow)
//   .tilt      cards tilt toward the cursor with a tracking spotlight (--rx/--ry/--mx/--my/--glow)
//   .spot      sections with a cursor spotlight (--mx/--my/--glow)
// Pointer events only store coordinates; element rects are measured on resize/mutation
// (page coordinates), never inside pointermove. Fine pointers only; no-op in STATIC.
import { FX } from './fx-config.js';
import { tier, onTier } from './fx-tier.js';

export function startPhysics() {
  if (tier() === 'static') return null;
  if (!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return null;

  const { stiffness: K, damping: D } = FX.spring;
  const ptr = { x: -1e5, y: -1e5 }; // client coords
  let items = [];
  let dirty = true;
  let raf = 0;
  let alive = true;

  const spring = (s, target) => {
    s.v = (s.v + (target - s.x) * K) * D;
    s.x += s.v;
    return Math.abs(s.v) > 0.001 || Math.abs(target - s.x) > 0.001;
  };
  const S = () => ({ x: 0, v: 0 });

  function collect() {
    const old = new Map(items.map((it) => [it.el, it]));
    items = [];
    for (const el of document.querySelectorAll('.magnetic, .tilt, .spot')) {
      const prev = old.get(el);
      items.push(prev || { el, kind: el.classList.contains('magnetic') ? 'mag' : el.classList.contains('tilt') ? 'tilt' : 'spot', a: S(), b: S(), g: S(), box: null });
    }
    dirty = true;
  }

  function measure() {
    const sx = scrollX;
    const sy = scrollY;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      // Remove our own translation so the resting position is measured.
      const ox = it.kind === 'mag' ? it.a.x : 0;
      const oy = it.kind === 'mag' ? it.b.x : 0;
      it.box = { left: r.left + sx - ox, top: r.top + sy - oy, w: r.width, h: r.height };
    }
    dirty = false;
  }

  function frame() {
    raf = 0;
    if (!alive) return;
    if (dirty) measure();
    const px = ptr.x + scrollX;
    const py = ptr.y + scrollY;
    let moving = false;
    for (const it of items) {
      const b = it.box;
      if (!b || !b.w) continue;
      const st = it.el.style;
      if (it.kind === 'mag') {
        const dx = px - (b.left + b.w / 2);
        const dy = py - (b.top + b.h / 2);
        const dist = Math.hypot(dx, dy);
        const reach = FX.magnet.maxDist + Math.max(b.w, b.h) / 2;
        const s = dist < reach ? 1 - dist / reach : 0;
        const tx = dist > 0 ? (dx / dist) * FX.magnet.pull * s : 0;
        const ty = dist > 0 ? (dy / dist) * FX.magnet.pull * s : 0;
        moving = spring(it.a, tx) | spring(it.b, ty) | spring(it.g, s) || moving;
        st.setProperty('--mag-x', `${it.a.x.toFixed(2)}px`);
        st.setProperty('--mag-y', `${it.b.x.toFixed(2)}px`);
        st.setProperty('--glow', it.g.x.toFixed(3));
      } else {
        const lx = px - b.left;
        const ly = py - b.top;
        const inside = lx >= 0 && ly >= 0 && lx <= b.w && ly <= b.h;
        if (it.kind === 'tilt') {
          const trx = inside ? (ly / b.h - 0.5) * -FX.tilt.maxDeg : 0;
          const try_ = inside ? (lx / b.w - 0.5) * FX.tilt.maxDeg : 0;
          moving = spring(it.a, trx) | spring(it.b, try_) | spring(it.g, inside ? 1 : 0) || moving;
          st.setProperty('--rx', `${it.a.x.toFixed(2)}deg`);
          st.setProperty('--ry', `${it.b.x.toFixed(2)}deg`);
        } else {
          moving = spring(it.g, inside ? 1 : 0) || moving;
        }
        if (inside) {
          st.setProperty('--mx', `${Math.round(lx)}px`);
          st.setProperty('--my', `${Math.round(ly)}px`);
        }
        st.setProperty('--glow', it.g.x.toFixed(3));
      }
    }
    if (moving) raf = requestAnimationFrame(frame);
  }

  const wake = () => { if (alive && !raf) raf = requestAnimationFrame(frame); };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; wake(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { ptr.x = -1e5; ptr.y = -1e5; wake(); });
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', () => { dirty = true; wake(); }, { passive: true });
  addEventListener('load', () => { dirty = true; wake(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; wake(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { dirty = true; wake(); }).observe(document.body);
  let pending = 0;
  new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; collect(); wake(); });
  }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });

  onTier((next) => {
    if (next !== 'static') return;
    alive = false;
    for (const it of items) for (const p of ['--mag-x', '--mag-y', '--glow', '--rx', '--ry', '--mx', '--my']) it.el.style.removeProperty(p);
  });

  collect();
  wake();
  return { refresh: () => { collect(); wake(); } };
}
