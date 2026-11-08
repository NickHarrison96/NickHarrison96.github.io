// GPU background: raw WebGL (no libraries). One fullscreen triangle; the fragment
// shader draws the neon grid, drifting particles, a gravity-warp lens around the
// cursor (smoothstep falloff) and click shockwaves. Constants come from fx-config.js.
// Rendering pauses while the tab is hidden; any failure drops the page to STATIC.
import { FX } from './fx-config.js';
import { tier, onTier, setTier, isForced } from './fx-tier.js';

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;      // px, origin bottom-left
uniform float u_mouseOn;   // 0..1, eased
uniform float u_time;
uniform vec3 u_accent;
uniform vec3 u_neon;
uniform float u_layers;    // particle layers (1 = LITE)
uniform float u_radius;
uniform float u_force;
uniform float u_cells;
uniform vec3 u_sw;         // shockwave speed, width, life
uniform vec4 u_shock[4];   // xy = centre (px), z = start time, w = active

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float h = u_resolution.y;
  vec2 p = gl_FragCoord.xy / h;             // aspect-correct: y in 0..1
  vec2 m = u_mouse / h;
  vec2 d = p - m;
  float dist = length(d);

  // Gravity lens: sample further out near the cursor so the grid pinches toward it.
  vec2 w = p;
  float lens = 0.0;
  if (dist < u_radius) {
    lens = (1.0 - smoothstep(0.0, u_radius, dist)) * u_mouseOn;
    w = p + d * lens * (u_force / u_radius) * 2.5;
  }

  // Shockwaves: a travelling ring that pushes the field outward and glows.
  float ringGlow = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 s = u_shock[i];
    if (s.w < 0.5) continue;
    float age = u_time - s.z;
    if (age < 0.0 || age > u_sw.z) continue;
    vec2 c = s.xy / h;
    vec2 dc = p - c;
    float dd = length(dc);
    float x = (dd - age * u_sw.x) / u_sw.y;
    float ring = exp(-x * x);
    float fade = 1.0 - age / u_sw.z;
    w += (dc / max(dd, 1e-4)) * ring * 0.018 * fade;
    ringGlow += ring * fade;
  }

  vec3 col = vec3(0.0196, 0.0275, 0.0510);  // #05070d

  // Grid lines, one pixel wide, brighter near the cursor.
  vec2 g = w * u_cells;
  vec2 e = 0.5 - abs(fract(g) - 0.5);
  float px = u_cells / h;
  float line = 1.0 - smoothstep(0.0, px * 1.25, min(e.x, e.y));
  float near = 1.0 - smoothstep(0.0, u_radius * 2.2, dist);
  vec3 gridCol = mix(vec3(0.16, 0.19, 0.26), u_accent, near * u_mouseOn);
  col += gridCol * line * (0.10 + 0.45 * near * u_mouseOn + 0.6 * ringGlow);

  // Cursor glow.
  col += u_accent * 0.10 * exp(-(dist * dist) / (u_radius * u_radius)) * u_mouseOn;
  col += u_accent * 0.12 * ringGlow;

  // Drifting particles (one per cell of a coarse lattice, per layer).
  for (int L = 0; L < 2; L++) {
    if (float(L) >= u_layers) break;
    float sc = 5.0 + float(L) * 4.0;
    vec2 q = w * sc + vec2(u_time * (0.03 + 0.02 * float(L)), -u_time * 0.05);
    vec2 id = floor(q);
    float r = hash(id + float(L) * 17.0);
    vec2 off = vec2(hash(id + 3.1), hash(id + 7.7));
    vec2 pos = id + 0.2 + 0.6 * off + 0.15 * vec2(sin(u_time * 0.7 + r * 6.28), cos(u_time * 0.5 + r * 6.28));
    float dp = length(q - pos) / sc * h;     // distance in px
    float tw = 0.5 + 0.5 * sin(u_time * (1.0 + r * 2.0) + r * 20.0);
    float dotA = smoothstep(2.2, 0.0, dp) * step(0.55, r) * (0.35 + 0.65 * tw);
    col += u_neon * dotA * (0.55 + 0.6 * near);
  }

  // Vignette keeps text contrast at the edges.
  vec2 uv = gl_FragCoord.xy / u_resolution;
  col *= 0.82 + 0.18 * smoothstep(1.2, 0.2, length(uv - 0.5) * 1.6);
  gl_FragColor = vec4(col, 1.0);
}`;

const hexToRgb = (hex, fallback) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec((hex || '').trim());
  return m ? [1, 2, 3].map((i) => parseInt(m[i], 16) / 255) : fallback;
};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
  return s;
}

export function startGravity(canvas) {
  if (!canvas || tier() === 'static') return null;

  let gl = null;
  try {
    // Refuse software rendering unless a tier was forced for testing (?fx=…).
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'default', failIfMajorPerformanceCaveat: !isForced() });
  } catch { gl = null; }
  if (!gl) { setTier('static'); return null; }

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
  } catch (err) {
    console.warn('[fx] WebGL shader unavailable, using static background:', err.message);
    setTier('static');
    return null;
  }

  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['u_resolution', 'u_mouse', 'u_mouseOn', 'u_time', 'u_accent', 'u_neon', 'u_layers', 'u_radius', 'u_force', 'u_cells', 'u_sw', 'u_shock']) U[n] = gl.getUniformLocation(prog, n);

  gl.uniform1f(U.u_radius, FX.warp.radius);
  gl.uniform1f(U.u_force, FX.warp.force);
  gl.uniform1f(U.u_cells, FX.grid.cells);
  gl.uniform3f(U.u_sw, FX.shockwave.speed, FX.shockwave.width, FX.shockwave.life);

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    gl.uniform3fv(U.u_accent, hexToRgb(cs.getPropertyValue('--brand'), [0.22, 0.74, 0.97]));
    gl.uniform3fv(U.u_neon, hexToRgb(cs.getPropertyValue('--neon'), [0, 0.94, 1]));
  };
  readColors();
  addEventListener('nh:theme', readColors);

  let dpr = 1;
  let W = 0;
  let H = 0;
  const lite = () => tier() === 'lite';
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, lite() ? FX.lite.dprCap : FX.canvas.dprCap);
    W = Math.max(1, Math.round(innerWidth * dpr));
    H = Math.max(1, Math.round(innerHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.u_resolution, W, H);
    gl.uniform1f(U.u_layers, lite() ? FX.lite.particleLayers : FX.full.particleLayers);
  };
  addEventListener('resize', resize, { passive: true });
  resize();

  // Pointer: stored on move, eased per frame (no layout reads here).
  const target = { x: W / 2, y: H / 2 };
  const mouse = { x: W / 2, y: H / 2, on: 0, onTarget: 0 };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    target.x = e.clientX * dpr;
    target.y = (innerHeight - e.clientY) * dpr;
    mouse.onTarget = 1;
    wake();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { mouse.onTarget = 0; });

  const shocks = [];
  addEventListener('pointerdown', (e) => {
    if (lite() && !FX.lite.shockwave) return;
    shocks.push({ x: e.clientX * dpr, y: (innerHeight - e.clientY) * dpr, t: now() });
    while (shocks.length > FX.shockwave.max) shocks.shift();
    wake();
  }, { passive: true });

  const start = performance.now();
  const now = () => (performance.now() - start) / 1000;
  const shockData = new Float32Array(16);

  let raf = 0;
  let running = true;
  function frame() {
    raf = 0;
    if (!running) return;
    const k = FX.mouseEase;
    mouse.x += (target.x - mouse.x) * k;
    mouse.y += (target.y - mouse.y) * k;
    mouse.on += (mouse.onTarget - mouse.on) * k;
    const t = now();
    shockData.fill(0);
    for (let i = 0, j = 0; i < shocks.length; i++) {
      if (t - shocks[i].t > FX.shockwave.life) continue;
      shockData.set([shocks[i].x, shocks[i].y, shocks[i].t, 1], j * 4);
      j++;
    }
    gl.uniform2f(U.u_mouse, mouse.x, mouse.y);
    gl.uniform1f(U.u_mouseOn, mouse.on);
    gl.uniform1f(U.u_time, t);
    gl.uniform4fv(U.u_shock, shockData);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (running && !raf && document.visibilityState === 'visible') raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    canvas.classList.remove('live');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); setTier('static'); });
  onTier((next) => {
    if (next === 'static') stop();
    else resize();
  });

  canvas.classList.add('live');
  wake();
  return { stop };
}
