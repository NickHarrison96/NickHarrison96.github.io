// Every effect constant lives here (plan: "Policy values"). Change a number here,
// not in the effect modules. tools/check-site.mjs asserts these against the plan.
export const FX = Object.freeze({
  warp: { radius: 0.25, force: 0.08 },              // gravity lens around the cursor (UV units)
  grid: { cells: 20 },                              // neon grid cells across the short side
  shockwave: { speed: 1.2, width: 0.04, life: 1.6, max: 4 }, // click ripple (UV/s, UV, seconds, concurrent)
  particles: { perLayer: 14 },                      // drifting particles per grid layer
  magnet: { maxDist: 150, pull: 20 },               // px: pull radius, max offset
  spring: { stiffness: 0.18, damping: 0.72 },       // per-frame spring for magnets + tilt
  tilt: { maxDeg: 9 },
  canvas: { dprCap: 1.5 },
  tier: { liteCores: 4, liteMemoryGB: 4 },          // <= these (or Save-Data) → LITE
  watchdog: { slowMs: 24, windowMs: 2000, windows: 2, warmupMs: 1000 }, // → STATIC
  lite: { dprCap: 1, particleLayers: 1, shockwave: false },
  full: { particleLayers: 2 },
  boot: { maxMs: 1200 },
  scramble: { ms: 600 },
  mouseEase: 0.12,                                  // shader cursor smoothing per frame
});
