#!/usr/bin/env node
// Static site checks (dev-only, no dependencies).
//   node tools/check-site.mjs            every assertion (completion run)
//   node tools/check-site.mjs --phase=N  only assertions introduced up to phase N
//   node tools/check-site.mjs --selftest prove the detectors catch known-bad input
import { readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  ROOT, read, exists, PAGES, STUBS, phaseFromArgs, pageText, norm, tags, attr, hasAttr, elements, ids,
  moduleGraph, reporter,
} from './lib.mjs';
import { runIA, selftestIA } from './check-ia.mjs';
import { runGuides, selftestGuides, BIO } from './check-guides.mjs';

const PHASE = phaseFromArgs();

// Runtime requests may only go to these hosts (R5: Google Fonts + GitHub avatar).
const ALLOWED_RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'github.com'];
// Referenced on purpose but never committed (gitignored local override; see AGENTS.md "Secrets").
const ALLOWED_MISSING = new Set(['selfhost.local.js']);
// Link targets that only exist from a later phase on (skipped by --phase runs before then).
const FUTURE_TARGETS = {
  'apfs-recovery.html': 4, 'work.html': 8, 'repair.html': 8, 'kali-wsl2-desktop-windows-11.html': 9, 'kali-wsl2-desktop-windows-10.html': 9, 'local-ai.html': 9, 'llama-cpp.html': 9, 'guide-kali-wsl2.html': 9, 'guide-ollama-claude-code-windows.html': 9,
  'guide-ollama-claude-code-macos.html': 9, 'guide-llama-cpp.html': 9,
};
const FUTURE_INDEX_IDS = { terminal: 3, projects: 3, 'case-study': 3, repair: 3, writing: 8, tools: 3, 'what-we-do': 9, principle: 9, start: 9 };
// Links the homepage must keep. Phase 8 replaced the old ITEMS grid targets (mission.html, get-involved.html,
// repair-guides.html, legislation.html, repair-cafes.html, talks.html — now redirect stubs) with the
// repair.html sections they moved to; writing.html and downloads.html stay.
// Depth pass (2026-11-13): the homepage no longer links every repair.html section
// (café, guides and talks cards were repair/booking copy). Mission stays.
const ITEMS_LINKS = ['repair.html#mission', 'writing.html', 'downloads.html'];

/* ── detectors (pure functions, exercised by --selftest) ─────────────────── */

export function externalScripts(html) {
  return tags(html, ['script']).map((t) => attr(t.attrs, 'src')).filter((s) => s && /^(https?:)?\/\//i.test(s));
}

export function imgsWithoutAlt(html) {
  return tags(html, ['img']).filter((t) => !hasAttr(t.attrs, 'alt')).map((t) => t.raw.slice(0, 80));
}

export function iconOnlyWithoutLabel(html) {
  const bad = [];
  for (const name of ['button', 'summary', 'a']) {
    for (const el of elements(html, name)) {
      const text = norm(el.inner.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '').replace(/\$\{[^}]*\}/g, 'x'));
      const hiddenTextOnly = /^\s*$/.test(norm(el.inner.replace(/<[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/[a-z0-9]+>/gi, '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '')));
      if ((text === '' || hiddenTextOnly) && !attr(el.attrs, 'aria-label') && !attr(el.attrs, 'aria-labelledby')) {
        bad.push(`<${name}${el.attrs.slice(0, 60)}>`);
      }
    }
  }
  return bad;
}

export function svgsWithoutA11y(html) {
  return tags(html, ['svg']).filter((t) => {
    if (attr(t.attrs, 'aria-hidden') === 'true') return false;
    return !(attr(t.attrs, 'role') === 'img' && (attr(t.attrs, 'aria-label') || /<title>/i.test(html.slice(t.index, t.index + 400))));
  }).map((t) => t.raw.slice(0, 70));
}

export function smallFonts(css) {
  const bad = [];
  const px = (v) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));
  for (const m of css.matchAll(/font-size\s*:\s*([^;}"]+)/gi)) {
    for (const v of m[1].match(/\d*\.?\d+(px|rem)\b/g) || []) if (px(v) < 11) bad.push(m[0].trim());
  }
  for (const m of css.matchAll(/(?:^|[\s;{"])font\s*:\s*([^;}"]+)/gi)) {
    const v = (m[1].match(/\d*\.?\d+(px|rem)\b/) || [])[0];
    if (v && px(v) < 11) bad.push(`font: ${m[1].trim()}`);
  }
  return bad;
}

export function forbiddenFonts(text) {
  return /\bSyne\b|DM\+?\s?Sans/i.test(text);
}

export function runtimeHosts(html) {
  const out = [];
  for (const t of tags(html, ['link', 'script', 'img', 'iframe', 'source', 'video', 'audio'])) {
    const v = attr(t.attrs, t.name === 'link' ? 'href' : 'src');
    if (v && /^(https?:)?\/\//i.test(v)) out.push(new URL(v, 'https://x.invalid').hostname);
  }
  return out;
}

export function shellBlock(html, tag) {
  const m = new RegExp(`<${tag} class="site-${tag}"[\\s\\S]*?<\\/${tag}>`).exec(html);
  return m ? m[0] : null;
}

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

/* ── self-test ───────────────────────────────────────────────────────────── */

function selftest() {
  const r = reporter('check-site selftest');
  r.check('externalScripts flags CDN script', externalScripts('<script src="https://cdn.x/y.js"></script>').length === 1);
  r.check('externalScripts ignores local module', externalScripts('<script type="module" src="assets/js/site.js"></script>').length === 0);
  r.check('imgsWithoutAlt flags missing alt', imgsWithoutAlt('<img src="a.png">').length === 1);
  r.check('imgsWithoutAlt accepts alt=""', imgsWithoutAlt('<img src="a.png" alt="">').length === 0);
  r.check('iconOnly flags unlabeled svg button', iconOnlyWithoutLabel('<button><svg aria-hidden="true"></svg></button>').length === 1);
  r.check('iconOnly accepts labeled button', iconOnlyWithoutLabel('<button aria-label="Search"><svg aria-hidden="true"></svg></button>').length === 0);
  r.check('iconOnly accepts text button', iconOnlyWithoutLabel('<button>Search</button>').length === 0);
  r.check('iconOnly flags aria-hidden-only text', iconOnlyWithoutLabel('<button><span aria-hidden="true">⌕</span></button>').length === 1);
  r.check('svg a11y flags bare svg', svgsWithoutA11y('<svg viewBox="0 0 1 1"></svg>').length === 1);
  r.check('svg a11y accepts aria-hidden', svgsWithoutA11y('<svg aria-hidden="true"></svg>').length === 0);
  r.check('smallFonts flags 10px', smallFonts('a{font-size:10px}').length === 1);
  r.check('smallFonts flags font shorthand 9px', smallFonts('a{font:500 9px "JetBrains Mono"}').length === 1);
  r.check('smallFonts accepts 11px + clamp', smallFonts('a{font-size:11px}b{font-size:clamp(12px,3vw,20px)}').length === 0);
  r.check('forbiddenFonts flags Syne', forbiddenFonts("font-family:'Syne'"));
  r.check('forbiddenFonts flags DM Sans link', forbiddenFonts('family=DM+Sans:wght@400'));
  r.check('forbiddenFonts accepts Inter', !forbiddenFonts("family=Inter&family=JetBrains+Mono"));
  r.check('runtimeHosts sees CDN', runtimeHosts('<script src="https://cdn.jsdelivr.net/x.js"></script>')[0] === 'cdn.jsdelivr.net');
  r.check('shellBlock extracts header', shellBlock('<header class="site-header"><a>x</a></header>', 'header') !== null);
  r.check('shellBlock misses unclassed header', shellBlock('<header><a>x</a></header>', 'header') === null);
  selftestIA(r);
  selftestGuides(r);
  return r.done();
}

/* ── checks against the repo ─────────────────────────────────────────────── */

async function run() {
  const r = reporter(`check-site${Number.isFinite(PHASE) ? ` (phase ≤ ${PHASE})` : ''}`);
  const at = (p) => p <= PHASE;
  const pages = PAGES.filter(([, p]) => at(p)).map(([f]) => f);
  const html = Object.fromEntries(pages.filter(exists).map((f) => [f, read(f)]));

  /* Phase 2 — tokens + shared shell on every page */
  if (at(2)) {
    for (const f of pages) r.check(`page exists: ${f}`, exists(f));
    const extra = readdirSync(ROOT).filter((f) => f.endsWith('.html') && !PAGES.some(([p]) => p === f) && !STUBS.some(([s]) => s === f));
    r.check('no unlisted root pages', extra.length === 0, extra.join(', '));

    const headers = new Map();
    const footers = new Map();
    for (const [f, h] of Object.entries(html)) {
      r.check(`${f}: html lang`, /<html\b[^>]*\blang="en"/.test(h));
      r.check(`${f}: viewport meta`, /<meta name="viewport"/.test(h));
      r.check(`${f}: links styles.css`, /<link rel="stylesheet" href="styles\.css">/.test(h));
      r.check(`${f}: Inter + JetBrains Mono`, /fonts\.googleapis\.com\/css2\?family=Inter[^"]*JetBrains\+Mono/.test(h));
      r.check(`${f}: <canvas id="fx-bg">`, /<canvas id="fx-bg"[^>]*aria-hidden="true"/.test(h));
      r.check(`${f}: site.js module`, /<script type="module" src="assets\/js\/site\.js"><\/script>/.test(h));
      r.check(`${f}: .js gate snippet`, /classList\.add\('js'\)/.test(h));
      r.check(`${f}: no external <script src>`, externalScripts(h).length === 0, externalScripts(h).join(', '));
      const hosts = runtimeHosts(h).filter((x) => !ALLOWED_RUNTIME_HOSTS.includes(x));
      r.check(`${f}: runtime hosts limited to fonts + avatar`, hosts.length === 0, hosts.join(', '));
      const noAlt = imgsWithoutAlt(h);
      r.check(`${f}: every <img> has alt`, noAlt.length === 0, noAlt.join(' | '));
      const unlabeled = iconOnlyWithoutLabel(h);
      r.check(`${f}: icon-only controls labelled`, unlabeled.length === 0, unlabeled.join(' | '));
      const bareSvg = svgsWithoutA11y(h);
      r.check(`${f}: inline SVGs aria-hidden or labelled`, bareSvg.length === 0, `${bareSvg.length}: ${bareSvg[0] || ''}`);
      r.check(`${f}: no Syne / DM Sans`, !forbiddenFonts(h));
      const small = smallFonts(h);
      r.check(`${f}: inline font sizes ≥ 11px`, small.length === 0, small.join(' | '));
      const hd = shellBlock(h, 'header');
      const ft = shellBlock(h, 'footer');
      r.check(`${f}: has <header class="site-header">`, !!hd);
      r.check(`${f}: has <footer class="site-footer">`, !!ft);
      if (hd) headers.set(f, sha(hd));
      if (ft) footers.set(f, sha(ft));

      // Internal references resolve (files and #fragments).
      const own = ids(h);
      for (const t of tags(h, ['a', 'link', 'script', 'img', 'source'])) {
        const v = attr(t.attrs, t.name === 'a' || t.name === 'link' ? 'href' : 'src');
        if (!v || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(v) || v.includes('${')) continue;
        const [pathPart, frag] = v.split('#');
        const file = pathPart.split('?')[0];
        if (!file) {
          r.check(`${f}: #${frag} exists`, !frag || own.has(frag));
          continue;
        }
        if (ALLOWED_MISSING.has(file)) continue;
        if ((FUTURE_TARGETS[file] ?? 0) > PHASE) continue;
        if (file === 'index.html' && frag && (FUTURE_INDEX_IDS[frag] ?? 0) > PHASE) continue;
        const ok = exists(file);
        r.check(`${f}: ${t.name} → ${v} resolves`, ok);
        if (ok && frag && file.endsWith('.html')) r.check(`${f}: ${v} fragment exists`, ids(read(file)).has(frag));
      }

      const graph = moduleGraph(f);
      r.check(`${f}: module imports resolve`, graph.missing.length === 0, graph.missing.join(', '));
      r.check(`${f}: no bare/remote module imports`, graph.external.length === 0, graph.external.join(', '));
    }
    r.check('header identical on every page', new Set(headers.values()).size === 1, JSON.stringify(Object.fromEntries(headers)));
    r.check('footer identical on every page', new Set(footers.values()).size === 1, JSON.stringify(Object.fromEntries(footers)));

    const css = exists('styles.css') ? read('styles.css') : '';
    r.check('styles.css: no Syne / DM Sans', !forbiddenFonts(css));
    r.check('styles.css: font sizes ≥ 11px', smallFonts(css).length === 0, smallFonts(css).join(' | '));
    r.check('styles.css: prefers-reduced-motion block', /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css));
    r.check('styles.css: :focus-visible ring', /:focus-visible/.test(css));
    r.check('styles.css: main width rule kept (N4)', /main\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*1200px/.test(css));
    r.check('styles.css: html/body do not hide x-overflow', !/(^|\n)\s*(html|body)\s*\{[^}]*overflow-x\s*:\s*(hidden|clip)/.test(css));
    r.check('styles.css: brand tokens', /--bg:\s*#05070d/.test(css) && /--brand:\s*#38bdf8/.test(css));
    const jsDir = exists('assets/js') ? readdirSync(`${ROOT}/assets/js`, { withFileTypes: true }) : [];
    for (const f of jsDir.filter((d) => d.isFile() && d.name.endsWith('.js')).map((d) => d.name)) {
      r.check(`assets/js/${f}: no Syne / DM Sans`, !forbiddenFonts(read(`assets/js/${f}`)));
    }
  }

  /* Phase 3 — homepage rebuild */
  if (at(3) && html['index.html']) {
    const h = html['index.html'];
    const text = pageText(h);
    const own = ids(h);
    // #log and #philosophy moved to writing.html in phase 8 (asserted there below and in check-ia).
    // Phase 9 (Nick, 2026-11-08): the featured-work grid (#projects) and the case-study teaser (#case-study)
    // left the homepage; check-guides.mjs asserts they are gone and what replaced them.
    // Nick (2026-11-13): the home page became a welcome (hero/terminal, what we do, values, invite); the Apple
    // module (#repair) moved to writing.html#inside-the-device and the writing grid lives on the Blog.
    const homeIds = at(9) ? ['terminal', 'what-we-do', 'principle', 'start'] : ['terminal', 'projects', 'case-study', 'repair', 'writing', 'tools'];
    for (const id of homeIds) {
      if ((FUTURE_INDEX_IDS[id] ?? 0) <= PHASE) r.check(`index: section #${id}`, own.has(id));
    }
    if (at(8)) for (const id of ['log', 'philosophy']) r.check(`writing: section #${id}`, ids(html['writing.html'] || '').has(id));
    if (at(8)) for (const href of ITEMS_LINKS) r.check(`index: keeps link ${href}`, h.includes(`href="${href}"`));
    r.check('index: marquee', /class="marquee"/.test(h));
    // Nick (2026-11-13): Work tab removed. Dropped the work.html EFI repo-link assertion.
    if (!at(9)) r.check('index: EFI repo link', h.includes('https://github.com/NickHarrison96/MSI-MPG-x570-EFI'));
    const texts = {};
    const textOf = (f) => (texts[f] ??= pageText(html[f] || ''));
    for (const [phrase, where, from = 0] of VERBATIM_HOME) {
      if (!at(from)) continue;
      const f = at(8) ? where : 'index.html';
      r.check(`${f.replace('.html', '')} verbatim: "${phrase.slice(0, 48)}…"`, (f === 'index.html' ? text : textOf(f)).includes(phrase));
    }
    // Nick (2026-11-13): Work tab removed
    for (const f of ['index.html', 'writing.html']) {
      if (html[f]) r.check(`${f}: no canvas stand-in entries`, !/Diagnostics Suite|water-damaged|key fact or stat/.test(html[f]));
    }
  }

  /* Phase 4 — case study page */
  if (at(4) && html['apfs-recovery.html']) {
    const text = pageText(html['apfs-recovery.html']);
    for (const phrase of VERBATIM_CASE) r.check(`apfs verbatim: "${phrase.slice(0, 48)}…"`, text.includes(phrase));
    r.check('writing.html links apfs-recovery.html', /href="apfs-recovery\.html/.test(html['writing.html'] || ''));
    r.check('index.html does not link apfs-recovery.html', !/href="apfs-recovery\.html/.test(html['index.html'] || ''));
    r.check('apfs: 4 timeline phases', (html['apfs-recovery.html'].match(/<li class="phase(?: [^"]*)?"/g) || []).length === 4);
  }

  /* Phase 5 — FX core */
  if (at(5)) {
    for (const f of ['fx-config.js', 'fx-tier.js', 'fx-gravity.js', 'fx-physics.js', 'site.js']) r.check(`assets/js/${f} exists`, exists(`assets/js/${f}`));
    if (exists('assets/js/fx-gravity.js')) {
      const g = read('assets/js/fx-gravity.js');
      r.check('fx-gravity: pauses on visibilitychange', g.includes('visibilitychange'));
      r.check('fx-gravity: u_mouse/u_resolution/u_time', ['u_mouse', 'u_resolution', 'u_time'].every((u) => g.includes(u)));
      r.check('fx-gravity: reads constants from fx-config', /from '\.\/fx-config\.js'/.test(g));
    }
    if (exists('assets/js/fx-config.js')) {
      const src = read('assets/js/fx-config.js');
      let FX = null;
      try { FX = (await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))).FX; } catch (e) { r.check('fx-config evaluates', false, e.message); }
      if (FX) {
        // The plan's policy table, value for value.
        const want = {
          'warp.radius': 0.25, 'warp.force': 0.08, 'grid.cells': 20,
          'shockwave.speed': 1.2, 'shockwave.width': 0.04, 'shockwave.life': 1.6,
          'magnet.maxDist': 150, 'magnet.pull': 20, 'spring.stiffness': 0.18, 'spring.damping': 0.72,
          'tilt.maxDeg': 9, 'canvas.dprCap': 1.5, 'boot.maxMs': 1200, 'scramble.ms': 600,
          'tier.liteCores': 4, 'tier.liteMemoryGB': 4,
          'watchdog.slowMs': 24, 'watchdog.windowMs': 2000, 'watchdog.windows': 2, 'watchdog.warmupMs': 1000,
          'lite.dprCap': 1, 'lite.particleLayers': 1, 'lite.shockwave': false,
        };
        for (const [k, v] of Object.entries(want)) {
          const got = k.split('.').reduce((o, x) => (o == null ? o : o[x]), FX);
          r.check(`fx-config ${k} = ${v}`, got === v, `got ${got}`);
        }
      }
    }
    if (exists('assets/js/fx-physics.js')) {
      const p = read('assets/js/fx-physics.js');
      r.check('fx-physics: no layout reads in pointermove', !/pointermove[\s\S]{0,200}getBoundingClientRect/.test(p));
      r.check('fx-physics: reads constants from fx-config', /from '\.\/fx-config\.js'/.test(p));
    }
  }

  /* Phase 6 — interaction extras */
  if (at(6)) {
    for (const f of ['terminal.js', 'palette.js', 'scramble.js', 'boot.js', 'konami.js']) {
      r.check(`assets/js/${f} exists`, exists(`assets/js/${f}`));
    }
    if (html['index.html']) {
      r.check('index: boot splash markup', /id="boot"/.test(html['index.html']));
      r.check('index: boot decided before paint (data-boot)', /<html lang="en" data-boot>/.test(html['index.html']));
    }
  }

  /* Phase 8 — five-hub information architecture (tools/check-ia.mjs) */
  if (at(8)) await runIA(r);

  /* Phase 9 — guides, writing library, banner, build sheet, PII (tools/check-guides.mjs) */
  if (at(9)) await runGuides(r);

  return r.done();
}

// Copy that must survive verbatim (Nick's own writing).
// [phrase, page, from phase]: from phase 8 the manifesto lives on writing.html.
// Nick (2026-11-13): Work tab removed
// Phase 9 (Nick, 2026-11-08): the hero bio's second sentence is his rewrite (BIO in check-guides.mjs); the two
// project descriptions that were not his work are gone (check-guides.mjs asserts their absence); the
// case-study lede left the homepage with the teaser and is asserted on writing.html (featured card).
const VERBATIM_HOME = [
  [BIO, 'index.html', 9],
  // Nick (2026-11-13): Work tab removed. Dropped the work.html project-card verbatim assertions.
  ['A Ryzen Hackintosh (OpenCore 1.0.8, MacPro7,1 SMBIOS) hit an account-access problem. This is how we worked around OpenDirectory locks and space limits with a parallel APFS volume, without erasing the reported 401.5 GB data volume. File-integrity verification is pending.', 'writing.html'],
  ['MSI MPG X570 Gaming Edge WiFi', 'index.html'], // Nick (2026-11-13): show his standard rig, not the SMBIOS
  ['Computers are meant to be tools of empowerment, creative expression, and personal agency.', 'writing.html'],
  ['Breaking down UNIX, APFS, and bootloader internals into transparent, actionable guides.', 'writing.html'],
  ['Your data belongs to you. Every write-up tries non-destructive methods first and is honest about what can\'t be guaranteed.', 'writing.html'],
  ['Documenting solutions creates an indexable, open roadmap for developers faced with black screens.', 'writing.html'],
  ['Honoring the classical hacker ethos of learning how software and hardware work under the hood.', 'writing.html'],
  // Nick (2026-11-13): "We Specialize in All Things Apple" was retired with the home Apple module; its layer
  // copy moved to writing.html. The terminal's recovery-status line is no longer asserted on the home page.
  ['You Own It. You Should Understand It.', 'index.html'],
  ['without erasing the reported 401.5 GB data volume; file-integrity verification is pending.', 'writing.html'],
];

const VERBATIM_CASE = [
  'Surgical Recovery of a Corrupted macOS Installation',
  'How we bypassed OpenDirectory locks, PAM authentication decay, and space constraints by establishing a parallel APFS volume—preserving 401.5 GB of user data intact on MacPro7,1.',
  'MacPro7,1 (AMD Zen 2)', 'APFS Container (disk1 / disk3)', '401.5 GB Volume Untouched',
  'The machine encountered a critical failure involving a desynchronized dscl (Directory Service Command Line) user database and corrupted PAM/security framework tokens within macOS.',
  'a complete destructive wipe or total loss of access.',
  'Forces a complete erase of the drive, requiring hours of backup restoration, loss of ephemeral configurations, network re-authentications, and potential data loss for non-cloud synced folders.',
  'Adds a secondary, clean APFS volume inside the same dynamic container (disk3s7), streams an official Apple-signed payload via Online Recovery, and boots cleanly alongside 401.5 GB of intact user files.',
  'Rather than repartitioning or shrinking existing allocations, we took advantage of APFS dynamic space sharing. We allocated a new, unencrypted APFS volume named Untitled into the primary container.',
  'diskutil apfs addVolume disk3 APFS "Untitled"',
  'To ensure total system image integrity matching the OpenCore SMBIOS identity (MacPro7,1), we fetched the ~18.39 GB installation package directly from Apple recovery servers.',
  'Could not verify trust (5) using MobileSoftwareUpdate -> Basic X509 fallback',
  'During Setup Assistant initialization, Migration Assistant flagged a "Not enough space available to transfer" error due to attempting a bulk copy of 365+ GB (nick user profile + apps) into the newly initialized APFS footprint.',
  'Unchecked bulk migration during setup to land directly on the clean desktop. The original user data remained fully accessible as an external mount at /Volumes/Big Mac - Data/.',
  'The system booted smoothly into macOS Tahoe (Build 26.7.2). The OpenCore bootloader recognized all hardware components (RX 580 8GB GPU, Ryzen 6-Core processor, 32GB RAM).',
  'sudo chown -R $(whoami) "/Volumes/Big Mac - Data/Users/nick"',
  'Modern operating systems have made incredible strides in consumer security, but these gains often come at the expense of user sovereignty.',
  'Diagnostic utilities are continually hidden or stripped. Standard Apple Support procedures typically recommend complete drive erasure rather than granular low-level repair.',
  'APFS dynamic containers, System Volume Seals (SSV), and cryptographically signed snapshots are great for consumers, but can lock out users during system state desyncs.',
  'When OpenDirectory or Keybag states fail, users are left stranded. Without Terminal access and manual volume mounting, recovery seems impossible.',
  'Why We Publish & Share These Write-Ups',
  "Computers are meant to be tools of empowerment, creative expression, and personal agency. When an operating system fails, users shouldn't feel helpless, nor should they be forced to accept data loss as an inevitability.",
];

process.exit(process.argv.includes('--selftest') ? (selftest() ? 0 : 1) : ((await run()) ? 0 : 1));
