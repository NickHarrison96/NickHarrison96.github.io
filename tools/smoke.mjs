#!/usr/bin/env node
// Browser smoke test (dev-only). Serves the repo root with a tiny Node static server,
// then drives Chromium through Playwright.
//
//   cd tools && npm ci && npx playwright install chromium && node smoke.mjs
//   node smoke.mjs --phase=N   only tests introduced up to phase N
//   node smoke.mjs --perf      also measure frame times on index at 1440x900 (report only)
//   node smoke.mjs --perf --headed   same, in a visible window (uses the real GPU)
//
// External requests are answered locally so results don't depend on the network:
// Google Fonts → empty CSS, the GitHub avatar → a 1x1 PNG, the Cloudflare Worker →
// a fixed host-folder listing that includes a very long model filename (AGENTS.md
// layout gotcha), everything else → aborted.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { ROOT, PAGES, phaseFromArgs } from './lib.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('playwright is not installed. Run: cd tools && npm ci && npx playwright install chromium');
  process.exit(2);
}

const PHASE = phaseFromArgs();
const PERF = process.argv.includes('--perf');
const HEADED = process.argv.includes('--headed');
const at = (p) => p <= PHASE;

/* ── static server ───────────────────────────────────────────────────────── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT) || file.includes(`${ROOT}/tools`) || file.includes('.git')) throw new Error('forbidden');
    await stat(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ── network stubs ───────────────────────────────────────────────────────── */
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const LONG = 'Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-IQ3_M-patched.gguf';
const HOST_LIST = { loose: [{ name: 'README.txt', size: 1200 }], groups: [{ name: 'models', files: [{ name: LONG, size: 4200000000 }, { name: 'small.bin', size: 2048 }], dirs: null }] };
async function stub(context) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin === BASE) return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.hostname === 'github.com' && u.pathname.endsWith('.png')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    if (u.hostname.endsWith('workers.dev')) {
      const cors = { 'access-control-allow-origin': '*' };
      if (u.pathname === '/api/list') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(HOST_LIST) });
      if (u.pathname === '/api/health') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{"ok":true}' });
    }
    return route.abort();
  });
}

/* ── harness ─────────────────────────────────────────────────────────────── */
const fails = [];
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) passes++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

/** Open a page, collecting uncaught errors and console errors. */
async function open(context, path, { skipBoot = true } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const where = m.location()?.url || '';
    // selfhost.local.js is a gitignored local override; its 404 in production is expected (AGENTS.md).
    if (where.includes('selfhost.local.js') || m.text().includes('selfhost.local.js')) return;
    // Requests we deliberately aborted (non-allowlisted external hosts).
    if (/net::ERR_FAILED|ERR_ABORTED/.test(m.text()) && !where.startsWith(BASE)) return;
    errors.push(`console: ${m.text()} @ ${where}`);
  });
  if (skipBoot) await page.addInitScript(() => { try { sessionStorage.setItem('nh-booted', '1'); } catch {} });
  await page.goto(BASE + '/' + path, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { page, errors };
}

const visible = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  let n = el;
  while (n && n.nodeType === 1) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.99) return false;
    n = n.parentElement;
  }
  return r.width > 0 && r.height > 0;
}, sel);

const launch = (args = []) => chromium.launch({ headless: !HEADED, args: ['--enable-unsafe-swiftshader', ...args] });

const pages = PAGES.filter(([, p]) => at(Math.max(p, 2))).map(([f]) => f);

try {
  const browser = await launch();

  /* Phase 2 — every page, desktop + phone: no errors, no horizontal overflow */
  if (at(2)) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await stub(context);
      for (const f of pages) {
        const { page, errors } = await open(context, f);
        if (f === 'downloads.html') await page.waitForTimeout(600);
        check(`${f} @${width}: no console/page errors`, errors.length === 0, errors.join(' | '));
        const ov = await page.evaluate(() => {
          const d = document.documentElement;
          return { over: d.scrollWidth - d.clientWidth, html: getComputedStyle(d).overflowX, body: getComputedStyle(document.body).overflowX };
        });
        check(`${f} @${width}: scrollWidth - clientWidth == 0`, ov.over === 0, `${ov.over}px`);
        check(`${f} @${width}: html/body x-overflow not masked`, ov.html === 'visible' && ov.body === 'visible', `${ov.html}/${ov.body}`);
        check(`${f} @${width}: header visible`, await visible(page, '.site-header'));
        check(`${f} @${width}: data-fx set`, ['full', 'lite', 'static'].includes(await page.evaluate(() => document.documentElement.dataset.fx)));
        if (f === 'downloads.html') {
          const n = await page.evaluate(() => ({ cards: document.querySelectorAll('#ghGrid .dl-card').length, rows: document.querySelectorAll('#hostBox .host-row').length }));
          check(`downloads @${width}: catalog cards rendered`, n.cards === 3, `${n.cards}`);
          check(`downloads @${width}: host folder rows rendered from Worker`, n.rows >= 3, `${n.rows}`);
        }
        await page.close();
      }
      await context.close();
    }
  }

  /* Phase 2 — reduced motion and no-JS keep content visible */
  if (at(2)) {
    const rm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    await stub(rm);
    for (const f of ['index.html', 'downloads.html']) {
      const { page } = await open(rm, f);
      check(`${f}: reduced motion → data-fx="static"`, (await page.evaluate(() => document.documentElement.dataset.fx)) === 'static');
      await page.close();
    }
    await rm.close();

    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await stub(nojs);
    for (const f of pages) {
      const { page } = await open(nojs, f, { skipBoot: false });
      check(`${f}: no-JS main heading visible`, await visible(page, 'main h1'));
      await page.close();
    }
    await nojs.close();
  }

  /* Phase 3 — homepage content visible without JS */
  if (at(3)) {
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    await stub(nojs);
    const { page } = await open(nojs, 'index.html', { skipBoot: false });
    for (const sel of ['#terminal pre', '#projects .project', '#case-study h2', '#repair .layer-panel', '#log .log-entry', '#philosophy h2']) {
      check(`index no-JS: ${sel} visible`, await visible(page, sel));
    }
    await nojs.close();
  }

  /* Phase 5 — tiers */
  if (at(5)) {
    const noGl = await launch(['--disable-webgl', '--disable-3d-apis']);
    const ctx = await noGl.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(ctx);
    for (const f of ['index.html', 'apfs-recovery.html']) {
      const { page, errors } = await open(ctx, f);
      check(`${f}: WebGL off → data-fx="static"`, (await page.evaluate(() => document.documentElement.dataset.fx)) === 'static');
      check(`${f}: WebGL off → content visible`, await visible(page, 'main h1'));
      check(`${f}: WebGL off → canvas hidden`, !(await visible(page, '#fx-bg')));
      check(`${f}: WebGL off → no errors`, errors.length === 0, errors.join(' | '));
      await page.close();
    }
    await noGl.close();
  }

  /* Phase 6 — terminal, palette, boot, konami */
  if (at(6)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(ctx);
    const { page, errors } = await open(ctx, 'index.html');
    const input = page.locator('#term-input');
    await input.click();
    await input.fill('help');
    await input.press('Enter');
    check('terminal: help prints output', /Available commands/.test(await page.locator('#term-out').innerText()));
    await input.fill('nope');
    await input.press('Enter');
    check('terminal: unknown command → red line', /command not found: nope/.test(await page.locator('#term-out').innerText()));
    check('terminal: unknown command → shake', await page.evaluate(() => document.querySelector('.term').classList.contains('shake')));
    await input.press('ArrowUp');
    check('terminal: ↑ recalls history', (await input.inputValue()) === 'nope');
    await input.fill('reco');
    await input.press('Tab');
    check('terminal: Tab completes', (await input.inputValue()) === 'recovery --status');
    await input.fill('');
    await page.locator('body').click({ position: { x: 5, y: 300 } });

    for (const combo of ['Control+k', 'Meta+k']) {
      await page.keyboard.press(combo);
      const opened = await visible(page, '.palette');
      check(`palette: ${combo} opens`, opened);
      if (opened) {
        await page.keyboard.type('apfs');
        check(`palette: ${combo} search finds APFS`, /APFS/.test(await page.locator('.palette-list').innerText()));
        await page.keyboard.press('Escape');
        check(`palette: ${combo} Esc closes`, !(await visible(page, '.palette')));
      }
    }
    check('index: no errors after interaction', errors.length === 0, errors.join(' | '));

    // Konami → jailbreak mode, persisted.
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k);
    check('konami: jailbreak mode on', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'jailbreak');
    await page.reload();
    check('konami: persists after reload', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'jailbreak');
    await page.close();

    // Palette on a sub-page too.
    const sub = await open(ctx, 'about.html');
    await sub.page.keyboard.press('Control+k');
    check('palette: opens on about.html', await visible(sub.page, '.palette'));
    await sub.page.close();
    await ctx.close();

    // Boot splash: first visit shows it, gone within budget; deep link skips it.
    const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(fresh);
    const bp = await fresh.newPage();
    await bp.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    check('boot: splash shows on first visit', await visible(bp, '#boot'));
    await bp.waitForTimeout(1500);
    check('boot: splash gone within 1.5s', !(await visible(bp, '#boot')));
    await bp.reload({ waitUntil: 'domcontentloaded' });
    check('boot: not shown again this session', !(await visible(bp, '#boot')));
    await fresh.close();
    const deep = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(deep);
    const dp = await deep.newPage();
    await dp.goto(BASE + '/index.html#log', { waitUntil: 'domcontentloaded' });
    check('boot: deep link skips splash', !(await visible(dp, '#boot')));
    await deep.close();
  }

  await browser.close();

  /* --perf — measured, not a gate */
  if (PERF) {
    const b = await launch();
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await stub(ctx);
    const { page } = await open(ctx, 'index.html');
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return { tier: document.documentElement.dataset.fx, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'no webgl'), cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory };
    });
    const sampler = page.evaluate(() => new Promise((done) => {
      const d = [];
      let last = performance.now();
      const end = last + 10000;
      const tick = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else done(d); };
      requestAnimationFrame(tick);
    }));
    for (let i = 0; i < 200; i++) {
      const a = i / 12;
      await page.mouse.move(720 + Math.cos(a) * 400, 450 + Math.sin(a) * 250);
      await page.waitForTimeout(45);
    }
    const deltas = (await sampler).slice(5).sort((x, y) => x - y);
    const q = (p) => deltas[Math.min(deltas.length - 1, Math.floor(p * deltas.length))];
    const tierAfter = await page.evaluate(() => document.documentElement.dataset.fx);
    console.log(`PERF index@1440x900 frames=${deltas.length} median=${q(0.5).toFixed(2)}ms p95=${q(0.95).toFixed(2)}ms tier(start)=${info.tier} tier(end)=${tierAfter} renderer="${info.renderer}" cores=${info.cores} deviceMemory=${info.mem} headed=${HEADED}`);
    await b.close();
  }
} catch (e) {
  fails.push(`harness: ${e.stack || e.message}`);
} finally {
  server.close();
}

for (const f of fails) console.log(`FAIL ${f}`);
console.log(`smoke${Number.isFinite(PHASE) ? ` (phase ≤ ${PHASE})` : ''}: ${passes} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
