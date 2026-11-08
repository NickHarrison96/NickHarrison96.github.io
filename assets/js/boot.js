// OpenCore-style boot splash (index.html only). Whether it shows is decided before
// first paint by the inline <head> snippet (first visit this session, no #hash, no
// reduced motion). The log lines animate in CSS; this module only ends it on time
// (≤ FX.boot.maxMs from navigation start) or as soon as the visitor presses a key,
// clicks, scrolls or touches. styles.css also hides it at 1.4s if this never loads.
import { FX } from './fx-config.js';

const root = document.documentElement;
const boot = document.getElementById('boot');

if (boot && root.classList.contains('booting')) {
  const FADE = 200;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    root.classList.add('boot-out');
    setTimeout(() => root.classList.remove('booting', 'boot-out'), FADE);
    for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) removeEventListener(ev, end, true);
  };
  for (const ev of ['keydown', 'pointerdown', 'wheel', 'touchstart']) addEventListener(ev, end, { capture: true, passive: true });
  setTimeout(end, Math.max(0, FX.boot.maxMs - FADE - performance.now()));
}
