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
import { ROOT, PAGES, STUBS, HUBS, HUB_OF, GUIDES, phaseFromArgs } from './lib.mjs';

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
async function open(context, path, { skipBoot = true, ready = true } = {}) {
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
  // site.js sets data-ready once the palette and Konami listeners are wired.
  if (ready) await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 5000 }).catch(() => {});
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
        if (at(5)) check(`${f} @${width}: data-fx set`, ['full', 'lite', 'static'].includes(await page.evaluate(() => document.documentElement.dataset.fx)));
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

  /* Phase 5 — reduced motion forces the static tier */
  if (at(5)) {
    const rm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    await stub(rm);
    for (const f of ['index.html', 'downloads.html', 'apfs-recovery.html']) {
      const { page } = await open(rm, f);
      check(`${f}: reduced motion → data-fx="static"`, (await page.evaluate(() => document.documentElement.dataset.fx)) === 'static');
      check(`${f}: reduced motion → canvas hidden`, !(await visible(page, '#fx-bg')));
      await page.close();
    }
    await rm.close();
  }

  /* Phase 2 — no-JS keeps content visible */
  if (at(2)) {

    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await stub(nojs);
    for (const f of pages) {
      const { page } = await open(nojs, f, { skipBoot: false, ready: false });
      check(`${f}: no-JS main heading visible`, await visible(page, 'main h1'));
      await page.close();
    }
    await nojs.close();
  }

  /* Phase 3 — homepage content visible without JS */
  if (at(3)) {
    const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    await stub(nojs);
    const { page } = await open(nojs, 'index.html', { skipBoot: false, ready: false });
    // Phase 8 moved the field log and the manifesto to writing.html (checked there).
    // Phase 9 (Nick): the featured-work grid and the case-study teaser gave way to the latest-writing grid.
    // Nick (2026-11-13): the home page is a welcome; the writing grid and Apple layer panels left it.
    const homeSel = at(9) ? ['#terminal pre', '#what-we-do .lp-card', '#principle h2', '#start .dl-btn'] : ['#terminal pre', '#projects .project', '#case-study h2', '#repair .layer-panel'];
    if (!at(8)) homeSel.push('#log .log-entry', '#philosophy h2');
    for (const sel of homeSel) {
      check(`index no-JS: ${sel} visible`, await visible(page, sel));
    }
    if (at(8)) {
      const noJs = {
        'writing.html': ['#featured a[href="apfs-recovery.html"]', '#essays li', '#log .log-entry', '#philosophy h2'],
        'work.html': ['.project-grid .project', '.project-foot a'],
        'repair.html': ['#mission h2', '#legislation h2', '#get-involved h2', '#guides h2', '#cafes h2', '#talks h2', '#mission .note', '.section-nav'],
        'about.html': ['#about h1', '#team .team-card', '#socials .social-tile'],
      };
      if (at(9)) {
        noJs['writing.html'].push('#library .guide-card', '#log .log-entry[data-type="guide"]');
        noJs['work.html'].push('#build dl', '#built-tools .section-cta a');
        noJs['guide-kali-wsl2.html'] = ['#windows-10 h2', '#windows-11 h2', '#windows-10 pre', '#windows-11 pre'];
        noJs['guide-llama-cpp.html'] = ['#quick-reference h2', '#build pre', '#comparison table'];
        noJs['guide-ollama-claude-code-windows.html'] = ['#step-1 pre', '.section-nav'];
        noJs['guide-ollama-claude-code-macos.html'] = ['#step-1 pre', '.section-nav'];
      }
      for (const [f, sels] of Object.entries(noJs)) {
        const p = await open(nojs, f, { skipBoot: false, ready: false });
        for (const sel of sels) check(`${f} no-JS: ${sel} visible`, await visible(p.page, sel));
        await p.page.close();
      }
    }
    await nojs.close();
  }

  /* Phase 5 — tiers */
  if (at(5)) {
    // Forced FULL proves the shader compiles and renders here (software GL is fine for that).
    const gctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(gctx);
    const g = await open(gctx, 'index.html?fx=full');
    await g.page.mouse.move(700, 400);
    await g.page.mouse.down();
    await g.page.mouse.up();
    await g.page.waitForTimeout(500);
    check('index?fx=full: data-fx="full"', (await g.page.evaluate(() => document.documentElement.dataset.fx)) === 'full');
    check('index?fx=full: WebGL canvas live', await visible(g.page, '#fx-bg.live'));
    const px = await g.page.evaluate(() => { const c = document.getElementById('fx-bg'); return c.width * c.height > 0 && c.width <= innerWidth * 1.5 + 1; });
    check('index?fx=full: canvas sized within DPR cap', px);
    check('index?fx=full: no errors', g.errors.length === 0, g.errors.join(' | '));
    await gctx.close();

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
    // Was index.html#log; the log moved to writing.html in phase 8, so use a section that stays home.
    await dp.goto(BASE + '/tools.html', { waitUntil: 'domcontentloaded' });
    check('boot: deep link skips splash', !(await visible(dp, '#boot')));
    await deep.close();
  }

  /* Phase 8 — five-hub information architecture */
  if (at(8)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(ctx);
    const here = (page) => page.evaluate(() => location.pathname.split('/').pop() + location.hash);

    // Header: five hubs in order, current hub highlighted (apfs-recovery.html → Writing, index → none).
    for (const f of pages) {
      const { page, errors } = await open(ctx, f);
      const nav = await page.evaluate(() => [...document.querySelectorAll('.site-nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]));
      check(`${f}: header nav = five hubs`, JSON.stringify(nav.map(([t, h]) => [t, h])) === JSON.stringify(HUBS), JSON.stringify(nav));
      const cur = nav.filter(([, , c]) => c).map(([, h]) => h);
      const want = HUB_OF[f] ? [HUB_OF[f]] : [];
      check(`${f}: highlighted hub = ${want[0] || 'none'}`, JSON.stringify(cur) === JSON.stringify(want), JSON.stringify(cur));
      check(`${f}: no errors (IA pass)`, errors.length === 0, errors.join(' | '));
      await page.close();
    }

    // Each stub lands on its new page + section; an extra hash is carried over.
    for (const [f, target, id] of STUBS) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${f}`, { waitUntil: 'load' });
      await page.waitForURL((u) => u.pathname.endsWith('/' + target), { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      check(`stub ${f} → ${target}#${id}`, (await here(page)) === `${target}#${id}`, await here(page));
      check(`stub ${f}: #${id} on the landing page`, await page.evaluate((x) => !!document.getElementById(x), id));
      await page.close();
    }
    {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/talks.html#formats`, { waitUntil: 'load' });
      await page.waitForURL((u) => u.pathname.endsWith('/repair.html'), { timeout: 5000 }).catch(() => {});
      check('stub talks.html#formats keeps the extra hash', (await here(page)) === 'repair.html#formats', await here(page));
      await page.close();
    }
    {
      // Without JS the meta refresh still redirects.
      const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      await stub(nojs);
      const page = await nojs.newPage();
      await page.goto(`${BASE}/mission.html`, { waitUntil: 'load' });
      await page.waitForURL((u) => u.pathname.endsWith('/repair.html'), { timeout: 5000 }).catch(() => {});
      check('stub mission.html (no JS) → repair.html#mission via meta refresh', (await here(page)) === 'repair.html#mission', await here(page));
      await nojs.close();
    }

    // Old homepage anchors that moved follow their content.
    for (const [from, to] of [['index.html#log', 'writing.html#log'], ['index.html#philosophy', 'writing.html#philosophy']]) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${from}`, { waitUntil: 'load' });
      await page.waitForURL((u) => u.pathname.endsWith('/writing.html'), { timeout: 5000 }).catch(() => {});
      check(`${from} → ${to}`, (await here(page)) === to, await here(page));
      await page.close();
    }

    // Terminal: open repair / open legislation.
    for (const [cmd, to] of [['open repair', 'repair.html'], ['open legislation', 'repair.html#legislation'], ['open work', 'work.html']]) {
      const { page } = await open(ctx, 'index.html');
      await page.locator('#term-input').fill(cmd);
      await page.locator('#term-input').press('Enter');
      await page.waitForURL((u) => u.pathname.endsWith('/' + to.split('#')[0]), { timeout: 5000 }).catch(() => {});
      check(`terminal: ${cmd} → ${to}`, (await here(page)) === to, await here(page));
      await page.close();
    }

    // Palette: "legislation" → repair.html#legislation (from a sub-page too).
    for (const from of ['index.html', 'about.html']) {
      const { page } = await open(ctx, from);
      await page.keyboard.press('Control+k');
      await page.keyboard.type('legislation');
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => u.pathname.endsWith('/repair.html'), { timeout: 5000 }).catch(() => {});
      check(`palette (${from}): "legislation" → repair.html#legislation`, (await here(page)) === 'repair.html#legislation', await here(page));
      await page.close();
    }

    // Writing hub: the field log behaves as it did on the homepage.
    {
      const { page, errors } = await open(ctx, 'writing.html');
      const count = () => page.evaluate(() => [...document.querySelectorAll('#log .log-entry')].filter((e) => !e.hidden).length);
      const total = await count();
      check('writing log: tool entries appended from the catalog', (await page.evaluate(() => document.querySelectorAll('#log .log-entry[data-type="tool"]').length)) === 3);
      check('writing log: all entries shown', total >= 12, String(total));
      await page.click('#log .chip[data-filter="writeup"]');
      check('writing log: Write-ups filter → 3', (await count()) === 3, String(await count()));
      await page.click('#log .chip[data-filter="all"]');
      await page.fill('#log-q', 'legislation');
      check('writing log: search narrows', (await count()) === 1, String(await count()));
      await page.fill('#log-q', 'zzzz-nothing');
      check('writing log: empty state', await visible(page, '#log .log-empty'));
      check('writing: no errors after log interaction', errors.length === 0, errors.join(' | '));
      await page.close();
    }

    // repair.html: the section nav stays on screen while scrolling and tracks the section.
    {
      const { page } = await open(ctx, 'repair.html');
      await page.evaluate(() => document.getElementById('cafes').scrollIntoView({ behavior: 'instant' }));
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => {
        const n = document.querySelector('.section-nav').getBoundingClientRect();
        const h = document.querySelector('.site-header').getBoundingClientRect();
        return { top: n.top, headerBottom: h.bottom, current: document.querySelector('.section-nav a[aria-current]')?.getAttribute('href') };
      });
      check('repair: section nav sticks under the header', st.top >= 0 && Math.abs(st.top - st.headerBottom) <= 2, JSON.stringify(st));
      check('repair: section nav marks the visible section', st.current === '#cafes', String(st.current));
      await page.close();
    }
    await ctx.close();

    // Phone: the menu shows the same five hubs.
    const phone = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await stub(phone);
    for (const f of ['index.html', 'repair.html']) {
      const { page } = await open(phone, f);
      await page.click('.menu-btn');
      await page.waitForTimeout(200);
      const shown = await page.evaluate(() => [...document.querySelectorAll('#site-nav a')].filter((a) => a.getBoundingClientRect().height > 0).map((a) => a.textContent.trim()));
      check(`${f} @390: menu shows the five hubs`, JSON.stringify(shown) === JSON.stringify(HUBS.map(([t]) => t)), JSON.stringify(shown));
      if (f === 'repair.html') {
        const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check('repair @390 (menu open): no horizontal overflow', ov === 0, `${ov}px`);
      }
      await page.close();
    }
    await phone.close();
  }

  /* Phase 9 — guides, writing library, banner, header layout */
  if (at(9)) {
    const here = (page) => page.evaluate(() => location.pathname.split('/').pop() + location.hash);
    const mq = (page) => page.evaluate(() => {
      const t = document.querySelector('.site-header .marquee-track');
      if (!t) return null;
      const cs = getComputedStyle(t);
      return { name: cs.animationName, state: cs.animationPlayState, top: document.querySelector('.site-header .marquee').getBoundingClientRect().top };
    });

    // Banner: at the very top of every real page and scrolling, even on the STATIC tier.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await stub(ctx);
    for (const f of pages) {
      const { page } = await open(ctx, `${f}?fx=static`);
      const m = await mq(page);
      check(`${f}?fx=static: banner at the top`, !!m && Math.abs(m.top) <= 1, JSON.stringify(m));
      check(`${f}?fx=static: banner scrolls (animation-name not none)`, !!m && m.name !== 'none' && m.state === 'running', JSON.stringify(m));
      check(`${f}?fx=static: data-fx="static"`, (await page.evaluate(() => document.documentElement.dataset.fx)) === 'static');
      await page.close();
    }
    const rm = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    await stub(rm);
    for (const f of ['index.html', 'writing.html', 'guide-kali-wsl2.html']) {
      const { page } = await open(rm, f);
      const m = await mq(page);
      check(`${f}: reduced motion stops the banner`, !!m && (m.name === 'none' || m.state === 'paused'), JSON.stringify(m));
      // Still: the duplicate group goes away and the items stay reachable (the strip scrolls sideways by hand).
      const st = await page.evaluate(() => {
        const m = document.querySelector('.site-header .marquee');
        const dup = m.querySelector('.marquee-group[aria-hidden="true"]');
        const fits = m.scrollWidth <= m.clientWidth + 1;
        return { dup: getComputedStyle(dup).display, reachable: fits || ['auto', 'scroll'].includes(getComputedStyle(m).overflowX), items: m.querySelectorAll('.marquee-group:not([aria-hidden]) > span:not(.mq-sep)').length };
      });
      check(`${f}: reduced motion keeps every banner item reachable`, st.dup === 'none' && st.reachable && st.items === 8, JSON.stringify(st));
      await page.close();
    }
    await rm.close();

    // Header: brand, nav and actions never overlap; at 390 nothing overflows (phase-2 loop covers every page).
    for (const width of [1024, 1280, 1440, 1920]) {
      const wctx = await browser.newContext({ viewport: { width, height: 900 } });
      await stub(wctx);
      for (const f of pages) {
        const { page } = await open(wctx, `${f}?fx=static`);
        const g = await page.evaluate(() => {
          const box = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { l: r.left, r: r.right, t: r.top, b: r.bottom } : null; };
          return { brand: box('.site-header .brand'), nav: box('.site-header .site-nav'), actions: box('.site-header .site-actions'), menu: box('.site-header .menu-btn') };
        });
        const hit = (a, b) => !!a && !!b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
        check(`${f} @${width}: brand box does not intersect the nav`, !!g.brand && !hit(g.brand, g.nav), JSON.stringify(g));
        check(`${f} @${width}: nav does not intersect the actions`, !hit(g.nav, g.actions), JSON.stringify(g));
        check(`${f} @${width}: nav shown or collapsed into the menu`, !!g.nav || !!g.menu, JSON.stringify(g));
        await page.close();
      }
      await wctx.close();
    }

    // Kali guide: real tab buttons, keyboard, deep link; both sections exist.
    {
      const { page, errors } = await open(ctx, 'guide-kali-wsl2.html');
      const vis = () => page.evaluate(() => ['windows-10', 'windows-11'].map((id) => { const el = document.getElementById(id); return !!el && !el.hidden && el.getBoundingClientRect().height > 0; }));
      check('kali: Windows 10 shown first', JSON.stringify(await vis()) === '[true,false]', JSON.stringify(await vis()));
      await page.click('#tab-windows-11');
      check('kali: Windows 11 tab shows its section', JSON.stringify(await vis()) === '[false,true]', JSON.stringify(await vis()));
      check('kali: aria-selected follows', (await page.getAttribute('#tab-windows-11', 'aria-selected')) === 'true' && (await page.getAttribute('#tab-windows-10', 'aria-selected')) === 'false');
      await page.focus('#tab-windows-11');
      await page.keyboard.press('ArrowLeft');
      check('kali: ArrowLeft → Windows 10', JSON.stringify(await vis()) === '[true,false]' && (await page.evaluate(() => document.activeElement.id)) === 'tab-windows-10');
      await page.keyboard.press('End');
      check('kali: End → Windows 11', JSON.stringify(await vis()) === '[false,true]');
      check('kali: no errors', errors.length === 0, errors.join(' | '));
      await page.close();
      const deep = await open(ctx, 'guide-kali-wsl2.html#windows-11');
      check('kali: #windows-11 deep link selects Windows 11', JSON.stringify(await deep.page.evaluate(() => ['windows-10', 'windows-11'].map((id) => !document.getElementById(id).hidden))) === '[false,true]');
      await deep.page.close();
    }

    // Copy buttons copy the exact command.
    {
      const cctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
      await stub(cctx);
      for (const g of GUIDES) {
        const { page } = await open(cctx, g.file);
        const btn = page.locator('main .code-block .copy-btn').first();
        const want = await page.evaluate(() => document.querySelector('main .code-block pre').textContent.trim());
        await btn.click();
        await page.waitForTimeout(150);
        const got = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
        check(`${g.file}: copy button copies the command`, got !== null && got.trim() === want, `${String(got).slice(0, 40)} vs ${want.slice(0, 40)}`);
        check(`${g.file}: copy button confirms`, /copied/.test(await btn.innerText()));
        await page.close();
      }
      await cctx.close();
    }

    // Writing library: chips + search.
    {
      const { page, errors } = await open(ctx, 'writing.html');
      const shown = () => page.evaluate(() => {
        const v = (el) => !!el && !el.hidden && !el.closest('[hidden]') && el.getBoundingClientRect().height > 0;
        return { guides: [...document.querySelectorAll('#library .guide-card')].filter(v).length, featured: v(document.getElementById('featured')), essays: [...document.querySelectorAll('#essays .lib-essay')].filter(v).length, log: v(document.getElementById('log')) };
      });
      const all = await shown();
      check('library: All shows everything', all.guides === 4 && all.featured && all.essays === 3 && all.log, JSON.stringify(all));
      await page.click('#library .lib-chip[data-lib="guide"]');
      let s = await shown();
      check('library: Guides → 4 guides only', s.guides === 4 && !s.featured && s.essays === 0 && !s.log, JSON.stringify(s));
      await page.click('#library .lib-chip[data-lib="case"]');
      s = await shown();
      check('library: Case Studies → the featured case study only', s.guides === 0 && s.featured && s.essays === 0 && !s.log, JSON.stringify(s));
      await page.click('#library .lib-chip[data-lib="essay"]');
      s = await shown();
      check('library: Essays → 3 essays only', s.guides === 0 && !s.featured && s.essays === 3 && !s.log, JSON.stringify(s));
      await page.click('#library .lib-chip[data-lib="log"]');
      s = await shown();
      check('library: Log → the field log only', s.guides === 0 && !s.featured && s.essays === 0 && s.log, JSON.stringify(s));
      await page.click('#library .lib-chip[data-lib="all"]');
      await page.fill('#lib-q', 'kali');
      s = await shown();
      check('library: search "kali" → the Kali guide', s.guides === 1 && !s.featured && s.essays === 0, JSON.stringify(s));
      await page.fill('#lib-q', 'zzzz-nothing');
      check('library: empty state', await visible(page, '#library .lib-empty'));
      check('library: no errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }

    // Terminal + palette reach every guide; old homepage anchors follow their content.
    for (const g of GUIDES) {
      const { page } = await open(ctx, 'index.html');
      await page.locator('#term-input').fill(`open ${g.open}`);
      await page.locator('#term-input').press('Enter');
      await page.waitForURL((u) => u.pathname.endsWith('/' + g.file), { timeout: 5000 }).catch(() => {});
      check(`terminal: open ${g.open} → ${g.file}`, (await here(page)) === g.file, await here(page));
      await page.close();
    }
    for (const [from, q, to] of [['index.html', 'kali', 'guide-kali-wsl2.html'], ['guide-kali-wsl2.html', 'llama.cpp', 'guide-llama-cpp.html'], ['about.html', 'ollama windows', 'guide-ollama-claude-code-windows.html'], ['writing.html', 'tahoe', 'guide-ollama-claude-code-macos.html']]) {
      const { page } = await open(ctx, from);
      await page.keyboard.press('Control+k');
      await page.keyboard.type(q);
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => u.pathname.endsWith('/' + to), { timeout: 5000 }).catch(() => {});
      check(`palette (${from}): "${q}" → ${to}`, (await here(page)) === to, await here(page));
      await page.close();
    }
    for (const [from, to] of [['index.html#case-study', 'apfs-recovery.html'], ['index.html#projects', 'work.html#projects']]) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${from}`, { waitUntil: 'load' });
      await page.waitForURL((u) => u.pathname.endsWith('/' + to.split('#')[0]), { timeout: 5000 }).catch(() => {});
      check(`${from} → ${to}`, (await here(page)) === to, await here(page));
      await page.close();
    }

    // Work: the tool cards render from the catalog and link the downloads page.
    {
      const { page, errors } = await open(ctx, 'work.html');
      const n = await page.evaluate(() => ({ cards: document.querySelectorAll('#built-tools .tool-card').length, links: [...document.querySelectorAll('#built-tools .tool-card a')].filter((a) => a.getAttribute('href') === 'downloads.html').length }));
      check('work: tool cards rendered from the catalog', n.cards === 3, JSON.stringify(n));
      check('work: each tool card links downloads.html', n.links === 3, JSON.stringify(n));
      check('work: no errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();

  /* --perf — measured, not a gate. Detected tier first, then a forced FULL tier. */
  if (PERF) {
    const b = await launch();
    for (const target of ['index.html', 'index.html?fx=full']) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
      await stub(ctx);
      const { page } = await open(ctx, target);
      await page.waitForTimeout(1500);
      const info = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl');
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
        return { tier: document.documentElement.dataset.fx, live: !!document.querySelector('#fx-bg.live'), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl ? gl.getParameter(gl.RENDERER) : 'no webgl'), cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory };
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
      console.log(`PERF ${target} @1440x900 frames=${deltas.length} median=${q(0.5).toFixed(2)}ms p95=${q(0.95).toFixed(2)}ms tier(start)=${info.tier} tier(end)=${tierAfter} webglCanvasLive=${info.live} renderer="${info.renderer}" cores=${info.cores} deviceMemory=${info.mem} headed=${HEADED}`);
      await ctx.close();
    }
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
