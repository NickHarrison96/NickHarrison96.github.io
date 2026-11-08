// Text-decode "scramble" on section eyebrows ([data-scramble]) as they enter view.
// Text nodes are scrambled in place, so markup inside the element survives; the
// original text is always restored. Skipped entirely in the STATIC tier.
import { FX } from './fx-config.js';
import { tier } from './fx-tier.js';

const GLYPHS = '!<>-_\\/[]{}=+*^?#01';

function scramble(el) {
  const nodes = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) if (walk.currentNode.nodeValue.trim()) nodes.push(walk.currentNode);
  const originals = nodes.map((n) => n.nodeValue);
  const total = originals.reduce((n, s) => n + s.length, 0) || 1;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / FX.scramble.ms);
    let done = Math.floor(p * total);
    nodes.forEach((n, i) => {
      const s = originals[i];
      let o = '';
      for (let c = 0; c < s.length; c++) {
        o += done > 0 || s[c] === ' ' ? s[c] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        done--;
      }
      n.nodeValue = o;
    });
    if (p < 1 && tier() !== 'static') requestAnimationFrame(step);
    else nodes.forEach((n, i) => { n.nodeValue = originals[i]; });
  }
  requestAnimationFrame(step);
}

export function startScramble() {
  if (tier() === 'static' || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      scramble(e.target);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-scramble]').forEach((el) => io.observe(el));
}
