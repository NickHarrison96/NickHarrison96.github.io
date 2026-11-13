// Effect tiers: FULL → LITE → STATIC, published as <html data-fx="…">.
//   STATIC  reduced motion, WebGL failure, or the frame-time watchdog tripped.
//   LITE    ≤ 4 cores, ≤ 4 GB device memory, or Save-Data.
//   FULL    everything else.
// A session never climbs back up from STATIC. `?fx=full|lite|static` overrides the
// detection for testing (reduced motion still wins). Coarse pointers default to
// STATIC (no WebGL); a fine-pointer desktop keeps the full tier at any width.
import { FX } from './fx-config.js';

const root = document.documentElement;
const listeners = new Set();
const RANK = { static: 0, lite: 1, full: 2 };

export const tier = () => root.dataset.fx || 'static';
export const onTier = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function prefersReducedMotion() {
  return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** True below the desktop layout breakpoint (terminal, ticker and stack are hidden). */
export function isNarrowView() {
  return !!(window.matchMedia && matchMedia('(max-width: 1023px)').matches);
}

/** Touch-first pointer: default the effect tier to STATIC (no WebGL canvas). */
export function isCoarsePointer() {
  return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
}

export function detectTier() {
  if (prefersReducedMotion()) return 'static';
  const forced = new URLSearchParams(location.search).get('fx');
  if (forced in RANK) return forced;
  if (isCoarsePointer()) return 'static';
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  if (cores <= FX.tier.liteCores || mem <= FX.tier.liteMemoryGB || saveData) return 'lite';
  return 'full';
}

export const isForced = () => new URLSearchParams(location.search).has('fx');

export function setTier(next) {
  const cur = root.dataset.fx;
  if (cur === next) return;
  if (cur === 'static' && next !== 'static') return; // never back up
  root.dataset.fx = next;
  for (const fn of listeners) fn(next, cur);
}

/* Reduced motion switched on mid-session → STATIC. */
if (window.matchMedia) {
  const dropToStatic = () => {
    if (prefersReducedMotion() || isCoarsePointer()) setTier('static');
  };
  for (const q of ['(prefers-reduced-motion: reduce)', '(pointer: coarse)']) {
    const m = matchMedia(q);
    m.addEventListener ? m.addEventListener('change', dropToStatic) : m.addListener(dropToStatic);
  }
}

/* Frame-time watchdog (plan C4): samples only while the tab is visible and only after
   the warm-up; a window is FX.watchdog.windowMs long; FX.watchdog.windows consecutive
   windows with a median above FX.watchdog.slowMs drop the session to STATIC. A hidden
   tab resets the current window so throttled background frames never count. */
export function startWatchdog() {
  const W = FX.watchdog;
  const t0 = performance.now();
  let samples = [];
  let windowStart = 0;
  let last = 0;
  let slowWindows = 0;
  let raf = 0;

  const reset = () => { samples = []; windowStart = 0; last = 0; };
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  function tick(t) {
    raf = 0;
    if (tier() === 'static') return;
    if (document.visibilityState !== 'visible') { reset(); return; }
    if (t - t0 >= W.warmupMs) {
      if (last) samples.push(t - last);
      if (!windowStart) windowStart = t;
      if (t - windowStart >= W.windowMs) {
        slowWindows = median(samples) > W.slowMs ? slowWindows + 1 : 0;
        samples = [];
        windowStart = t;
        if (slowWindows >= W.windows) { setTier('static'); return; }
      }
    }
    last = t;
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    reset();
    if (document.visibilityState === 'visible' && !raf && tier() !== 'static') raf = requestAnimationFrame(tick);
  });
  raf = requestAnimationFrame(tick);
}
