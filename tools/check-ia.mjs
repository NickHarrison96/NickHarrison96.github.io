#!/usr/bin/env node
// Information-architecture checks for the five-hub layout (phase 8, dev-only, no dependencies).
// Run on their own or as part of `node tools/check-site.mjs` (which calls runIA()).
//   node tools/check-ia.mjs                  every IA assertion
//   node tools/check-ia.mjs --selftest       prove the detectors catch known-bad input
//   node tools/check-ia.mjs --print-projects print the project-card markup generated from PROJECTS
//
// Needs git (old pages are read from `main` and from BASELINE with `git show`).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ROOT, read, exists, PAGES, STUBS, HUBS, HUB_OF, pageText, norm, tags, attr, elements, ids, moduleGraph, reporter,
} from './lib.mjs';

/** Last commit before the IA restructure: the homepage field log, manifesto and project cards are read from here. */
export const BASELINE = '5ebcd41f531ad4b691ca8fa41d9b9013ec9682d5';
const PROJECTS_MODULE = 'assets/js/projects.js';

/** Old page (as on `main`) → the page that now carries its full content. */
export const PRESERVE = [
  ['mission.html', 'repair.html'], ['legislation.html', 'repair.html'], ['get-involved.html', 'repair.html'],
  ['repair-guides.html', 'repair.html'], ['repair-cafes.html', 'repair.html'], ['talks.html', 'repair.html'],
  ['team.html', 'about.html'], ['socials.html', 'about.html'], ['about.html', 'about.html'], ['writing.html', 'writing.html'],
];
/** Section ids each hub page must carry, in document order. */
export const SECTION_IDS = {
  'repair.html': ['mission', 'legislation', 'get-involved', 'guides', 'cafes', 'talks'],
  'about.html': ['about', 'team', 'socials'],
};
/**
 * Homepage labels that were renamed on purpose by the restructure (old text → new text). Everything else
 * in the BASELINE homepage <main> must still appear on index.html, work.html or writing.html.
 */
export const RENAMED = { 'All Downloads →': 'All tools →' };
/**
 * BASELINE homepage blocks Nick removed on purpose (2026-11-08, phase 9): the two projects that were not
 * his work, the bio sentence and hero badges/CTA that named them or repeated the case study. These are
 * the ONLY blocks allowed to be missing from index/work/writing; check-guides.mjs asserts the retired
 * project names appear in no tracked site file.
 */
export const RETIRED = [
  'LiteLLM Proxy & SDK',
  'Unified proxy server to call 100+ LLM APIs in OpenAI format with cost tracking, load balancing, and logging middleware.',
  'Stable Diffusion WebUI',
  'Generative vision workflows, custom kext/metal performance patches, and optimized local GPU model executions.',
  'Systems developer, AI pipeline creator, and hardware troubleshooter. I specialize in building proxy proxies, generative machine learning workflows, kernel/OpenCore configurations, and deep-dive technical write-ups.',
  'LiteLLM Gateway',
  'APFS Recovery',
  'Stable Diffusion',
  'Read APFS Recovery Case Study',
];
/**
 * Where "Nicholas" may still appear in tracked site files: only inside URLs, email addresses and @handles.
 * Site files = every tracked text file outside docs/ and tools/ (the checker and the plan quote the old name).
 */
/** Unique sentence from the duplicate "Where This Started" block that used to sit under About → Team. */
export const RETIRED_ABOUT = [
  'So the kid with more determination than money taught himself — studied, researched, and built his own path into repair with nothing to go on but stubbornness and a firm belief that people deserve far more control over what they own than they\'re ever given.',
];

export const NAME_ALLOWED = [/\bhttps?:\/\/[^\s"'<>)]+/gi, /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, /(^|[\s(])@[A-Za-z0-9_]+/g];

/* ── detectors (pure, exercised by --selftest) ───────────────────────────── */

/** <main>…</main> of a document ('' when missing). */
export function mainOf(html) {
  const m = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  return m ? m[1] : '';
}

/** Header nav links as [text, href]. */
export function navLinks(html) {
  const m = /<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  if (!m) return null;
  return elements(m[1], 'a').map((a) => [pageText(a.inner), attr(a.attrs, 'href')]);
}

const fixName = (s) => s.replace(/Nicholas Harrison/g, 'Nick Harrison');

/**
 * Text blocks that must survive a move: paragraphs, list items, headings, definition terms, note/badge
 * callouts, team and social labels, and link texts (except "Back to Home" chrome). Whitespace-normalised,
 * entities decoded, "Nicholas Harrison" → "Nick Harrison".
 */
export function blocks(mainHtml) {
  const out = [];
  const push = (inner) => { const t = fixName(pageText(inner)); if (t) out.push(t); };
  for (const name of ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'dd']) {
    for (const el of elements(mainHtml, name)) push(el.inner);
  }
  const classed = /<(div|span)\b[^>]*class="(?:note|badge|team-name|team-role|social-name|social-handle)"[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = classed.exec(mainHtml))) push(m[2]);
  for (const a of elements(mainHtml, 'a')) if (!/class="[^"]*back-link/.test(a.attrs)) push(a.inner);
  return [...new Set(out)];
}

/** Blocks of `oldMain` that are missing from the visible text of `newMains` (array of <main> HTML). */
export function missingBlocks(oldMain, newMains, renamed = {}) {
  const hay = newMains.map((h) => fixName(pageText(h))).join(' \u0000 ');
  return blocks(oldMain).filter((b) => {
    if (hay.includes(b)) return false;
    for (const [from, to] of Object.entries(renamed)) if (b.includes(from) && hay.includes(b.replace(from, to))) return false;
    return true;
  });
}

/** Parse a redirect stub: meta refresh, canonical, robots, location.replace parts, fallback link. */
export function stubInfo(html) {
  const refresh = /<meta http-equiv="refresh" content="0; url=([^"]+)">/i.exec(html)?.[1] ?? null;
  const canonical = /<link rel="canonical" href="([^"]+)">/i.exec(html)?.[1] ?? null;
  const robots = /<meta name="robots" content="noindex">/i.test(html);
  const js = /var t='([^']+)',d='(#[^']+)',h=location\.hash;location\.replace\(t\+\(h&&h!=='#main'\?h:d\)\)/.exec(html);
  const replace = js ? js[1] + js[2] : null;
  const fallback = /This page moved to <a href="([^"]+)">/.exec(html)?.[1] ?? null;
  const bg = /background:\s*#05070d/i.test(html);
  const shell = /class="site-header"/.test(html);
  return { refresh, canonical, robots, replace, fallback, bg, shell };
}

/** Internal .html targets referenced from JS string literals ('page.html#x'). */
export function jsHtmlRefs(src) {
  return [...src.matchAll(/['"`]([a-z0-9-]+\.html)(#[\w-]*)?['"`]/gi)].map((m) => m[1] + (m[2] || ''));
}

/** "Nicholas" outside URLs / emails / handles. */
export function strayNicholas(text) {
  let t = text;
  for (const re of NAME_ALLOWED) t = t.replace(re, ' ');
  return /Nicholas/i.test(t);
}

const squash = (s) => s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();

/** Inner HTML of the first <div class="project-grid…">: up to the first </article> directly followed by </div>. */
export function projectGrid(html) {
  const m = /<div class="project-grid[^"]*">([\s\S]*?<\/article>)\s*<\/div>/.exec(html);
  return m ? m[1] : null;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 << 20 }).replace(/\r\n/g, '\n');
}

async function loadProjects() {
  const src = read(PROJECTS_MODULE);
  return import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
}

/* ── checks against the repo ─────────────────────────────────────────────── */

export async function runIA(r) {
  const real = PAGES.map(([f]) => f);
  const stubFiles = new Map(STUBS.map(([f, page, id]) => [f, { page, id }]));
  const html = Object.fromEntries(real.filter(exists).map((f) => [f, read(f)]));

  // Header nav = the hubs, on every real page; the mobile menu toggles that same nav.
  for (const f of real) {
    if (!html[f]) { r.check(`ia: ${f} exists`, false); continue; }
    const links = navLinks(html[f]);
    r.check(`ia ${f}: header nav is exactly the hubs`, JSON.stringify(links) === JSON.stringify(HUBS), JSON.stringify(links));
    r.check(`ia ${f}: mobile menu toggles #site-nav`, /<button class="menu-btn"[^>]*aria-controls="site-nav"/.test(html[f]) && /<nav class="site-nav" id="site-nav"/.test(html[f]));
    r.check(`ia ${f}: ⌘K search button kept`, /<button class="search-btn"[^>]*data-palette-open/.test(html[f]));
    r.check(`ia ${f}: avatar hotlink kept`, html[f].includes('<img src="https://github.com/NickHarrison96.png?size=96"'));
    r.check(`ia ${f}: GitHub link → github.com/NickHarrison96`, /<a class="gh-link[^"]*" href="https:\/\/github\.com\/NickHarrison96"/.test(html[f]));
    r.check(`ia ${f}: hub mapping known`, f in HUB_OF);
    // Footer: hubs + contact + legal + top.
    const ft = /<footer class="site-footer">([\s\S]*?)<\/footer>/.exec(html[f])?.[1] || '';
    const fnav = /<nav class="footer-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(ft)?.[1] || '';
    const flinks = elements(fnav, 'a').map((a) => [pageText(a.inner), attr(a.attrs, 'href')]);
    r.check(`ia ${f}: footer nav is the hubs`, JSON.stringify(flinks) === JSON.stringify(HUBS), JSON.stringify(flinks));
    r.check(`ia ${f}: footer contact (email, YouTube, GitHub)`, ft.includes('href="mailto:harrisontechdev@gmail.com"') && ft.includes('href="https://www.youtube.com/@NickHarrison96"') && ft.includes('href="https://github.com/NickHarrison96"'));
    r.check(`ia ${f}: footer legal line`, /&copy;[^<]*Nick Harrison\. Open Technical License\./.test(ft));
    r.check(`ia ${f}: footer Top ↑`, /<a class="to-top" href="#main">Top &uarr;<\/a>/.test(ft));
    r.check(`ia ${f}: title names Nick Harrison`, /<title>[^<]*Nick Harrison[^<]*<\/title>/.test(html[f]));
  }

  // Section ids + in-page section navs.
  for (const [f, want] of Object.entries(SECTION_IDS)) {
    if (!html[f]) continue;
    const own = ids(html[f]);
    for (const id of want) r.check(`ia ${f}: #${id} exists`, own.has(id));
    const order = want.map((id) => html[f].indexOf(`id="${id}"`));
    r.check(`ia ${f}: sections in order ${want.join(' → ')}`, order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])));
    const snav = /<nav class="section-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html[f])?.[1] || '';
    const hrefs = elements(snav, 'a').map((a) => attr(a.attrs, 'href'));
    r.check(`ia ${f}: section nav lists ${want.length} sections in order`, JSON.stringify(hrefs) === JSON.stringify(want.map((id) => `#${id}`)), JSON.stringify(hrefs));
  }
  if (html['repair.html']) r.check('ia repair.html: section nav is sticky', /\.section-nav\s*\{[^}]*position:\s*sticky/.test(read('styles.css')));

  // Writing hub: categorized title-card rows, manifesto at the bottom.
  if (html['writing.html']) {
    const w = html['writing.html'];
    const own = ids(w);
    const rows = ['case-studies', 'essays', 'projects', 'right-to-repair'];
    for (const id of [...rows, 'philosophy', 'log']) r.check(`ia writing.html: #${id}`, own.has(id));
    r.check('ia writing.html: case study card → apfs-recovery.html', /id="case-studies"[\s\S]*?href="apfs-recovery\.html"/.test(w));
    r.check('ia writing.html: category row headings link to their anchors', rows.every((id) => w.includes(`href="#${id}"`)));
    r.check('ia writing.html: title cards present', (w.match(/class="lp-card blog-card/g) || []).length >= 5);
    r.check('ia writing.html: no log filter chips', (w.match(/class="chip" data-filter=/g) || []).length === 0);
    r.check('ia writing.html: points at tools.html write-ups', /href="tools\.html"/.test(w));
    r.check('ia writing.html: manifesto is the last section', w.lastIndexOf('<section') === w.indexOf('<section class="section" id="philosophy"'));
    r.check('ia writing.html: manifesto title', pageText(w).includes('Why We Publish & Share These Write-Ups'));
  }

  // Tools hub: write-up and kit rows (cards come from existing catalog entries; kits are placeholders).
  if (html['tools.html']) {
    const t = html['tools.html'];
    const own = ids(t);
    const rows = ['tool-writeups', 'engineering-kits'];
    for (const id of rows) r.check(`ia tools.html: #${id}`, own.has(id));
    r.check('ia tools.html: category row headings link to their anchors', rows.every((id) => t.includes(`href="#${id}"`)));
    r.check('ia tools.html: RootForgeKit card → downloads.html', /id="tool-writeups"[\s\S]*?RootForgeKit[\s\S]*?href="downloads\.html"/.test(t));
    r.check('ia tools.html: Pymobile3-GUI and BipPoyAI cards present', t.includes('Pymobile3-GUI') && t.includes('BipPoyAI'));
    r.check('ia tools.html: write-up coming labels', (t.match(/Write-up coming/g) || []).length >= 3);
  }

  // Homepage overview order + targets.
  if (html['index.html']) {
    const h = html['index.html'];
    // Phase 9 (Nick): the featured-work section was replaced by the expanded latest-writing grid.
    const order = ['terminal', 'repair', 'tools'].map((id) => h.indexOf(`id="${id}"`));
    r.check('ia index: hero/terminal → repair → tools (writing moved to Blog)', order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), JSON.stringify(order));
    for (const id of ['log', 'philosophy']) r.check(`ia index: #${id} moved off the homepage`, !ids(h).has(id));
    r.check('ia index: marquee kept', /class="marquee"/.test(h));
    r.check('ia index: teardown stack kept', /class="stack-stage"/.test(h) && (h.match(/class="layer-panel"/g) || []).length === 5);
    // The APFS case study lives on the Blog (writing.html); index must not link to it.
    for (const href of ['work.html', 'writing.html', 'downloads.html', ...SECTION_IDS['repair.html'].map((id) => `repair.html#${id}`)]) {
      r.check(`ia index: links ${href}`, h.includes(`href="${href}"`));
    }
    r.check('ia index: no apfs-recovery.html link (case study is on Blog)', !h.includes('href="apfs-recovery.html"'));
    // "All work →" left with the featured-work section (phase 9); the hero's "View Repositories" links work.html.
    r.check('ia index: hero links work.html', /<a href="work\.html" class="btn-ghost[^"]*">View Repositories<\/a>/.test(h));
    r.check('ia index: "All tools →"', /href="downloads\.html"[^>]*>All tools <span aria-hidden="true">→<\/span>/.test(h));
  }

  // Projects: one data source, static markup generated from it on index + work.
  if (exists(PROJECTS_MODULE)) {
    let mod = null;
    try { mod = await loadProjects(); } catch (e) { r.check(`${PROJECTS_MODULE} evaluates`, false, e.message); }
    if (mod) {
      const P = mod.PROJECTS || [];
      // Phase 9 (Nick): only the EFI project is his; the other two were removed.
      r.check('ia projects: PROJECTS = the EFI project only', Array.isArray(P) && P.length === 1 && P[0].url === 'https://github.com/NickHarrison96/MSI-MPG-x570-EFI', JSON.stringify(P.map((p) => p.plain)));
      r.check('ia projects: projectCard() exported', typeof mod.projectCard === 'function');
      const want = typeof mod.projectCard === 'function' ? squash(P.map(mod.projectCard).join('\n')) : '';
      for (const f of ['work.html']) { // index.html lost its project grid in phase 9
        if (!html[f]) continue;
        const grid = projectGrid(html[f]);
        r.check(`ia ${f}: project cards = PROJECTS (run --print-projects to regenerate)`, grid !== null && squash(grid) === want);
        r.check(`ia ${f}: reaches ${PROJECTS_MODULE}`, moduleGraph(f).modules.has(PROJECTS_MODULE));
      }
      r.check('ia work.html: cards tilt', (html['work.html'] || '').includes('class="project tilt"'));
      r.check('ia work.html: EFI repo link', (html['work.html'] || '').includes('https://github.com/NickHarrison96/MSI-MPG-x570-EFI'));
      // Field-log project entries follow PROJECTS too.
      const w = html['writing.html'] || '';
      for (const p of P) {
        r.check(`ia writing.html log: project ${p.title}`, w.includes(p.description) && w.includes(`href="${p.url}"`));
      }
    }
  } else r.check(`ia: ${PROJECTS_MODULE} exists`, false);

  // Old URLs: every .html ever shipped on main or at BASELINE still resolves.
  let oldUrls = [];
  try {
    oldUrls = [...new Set([...git(['ls-tree', '-r', '--name-only', 'main']).split('\n'), ...git(['ls-tree', '-r', '--name-only', BASELINE]).split('\n')])]
      .filter((f) => f.endsWith('.html'));
  } catch (e) { r.check('ia: git ls-tree main/BASELINE', false, e.message); }
  r.check('ia: pre-redesign URL list non-empty', oldUrls.length >= 12, String(oldUrls.length));
  for (const f of oldUrls) {
    if (!r.check(`ia old URL ${f}: exists`, exists(f))) continue;
    if (real.includes(f)) continue;
    const st = stubFiles.get(f);
    if (!r.check(`ia old URL ${f}: real page or listed stub`, !!st)) continue;
    const target = `${st.page}#${st.id}`;
    const info = stubInfo(read(f));
    r.check(`ia stub ${f}: meta refresh → ${target}`, info.refresh === target, String(info.refresh));
    r.check(`ia stub ${f}: canonical → ${target}`, info.canonical === target, String(info.canonical));
    r.check(`ia stub ${f}: location.replace → ${target} (keeps an extra hash)`, info.replace === target, String(info.replace));
    r.check(`ia stub ${f}: noindex`, info.robots);
    r.check(`ia stub ${f}: visible fallback link → ${target}`, info.fallback === target, String(info.fallback));
    r.check(`ia stub ${f}: site background (no white flash)`, info.bg);
    r.check(`ia stub ${f}: no site shell`, !info.shell);
    r.check(`ia stub ${f}: target ${target} exists`, exists(st.page) && ids(read(st.page)).has(st.id));
  }
  for (const [f] of STUBS) r.check(`ia stub ${f}: was a shipped URL`, oldUrls.includes(f));

  // No internal link points at a stub (HTML hrefs on real pages and .html string literals in modules).
  const isStub = (v) => stubFiles.has(v.split('#')[0].split('?')[0]);
  for (const f of real) {
    if (!html[f]) continue;
    const bad = tags(html[f], ['a', 'link']).map((t) => attr(t.attrs, 'href')).filter((v) => v && isStub(v));
    r.check(`ia ${f}: no links to stubs`, bad.length === 0, bad.join(', '));
  }
  for (const m of git(['ls-files', 'assets/js']).split('\n').filter((x) => x.endsWith('.js'))) {
    const bad = jsHtmlRefs(read(m)).filter(isStub);
    r.check(`ia ${m}: no links to stubs`, bad.length === 0, bad.join(', '));
    for (const ref of jsHtmlRefs(read(m))) {
      const [file, frag] = ref.split('#');
      if (!exists(file)) { r.check(`ia ${m}: ${ref} resolves`, false); continue; }
      if (frag) r.check(`ia ${m}: ${ref} resolves`, ids(read(file)).has(frag));
    }
  }

  // Content preservation.
  let preserved = 0;
  const showMissing = (miss) => miss.slice(0, 3).map((s) => `"${s.slice(0, 70)}"`).join(' | ');
  for (const [oldF, newF] of PRESERVE) {
    let oldHtml = '';
    try { oldHtml = git(['show', `main:${oldF}`]); } catch (e) { r.check(`ia preserve ${oldF}: read from main`, false, e.message); continue; }
    const n = blocks(mainOf(oldHtml)).length;
    let miss = html[newF] ? missingBlocks(mainOf(oldHtml), [mainOf(html[newF])]) : ['(target missing)'];
    if (newF === 'about.html') miss = miss.filter((b) => !RETIRED_ABOUT.some((r) => b.includes(r) || r.includes(b)));
    if (r.check(`ia preserve main:${oldF} → ${newF} (${n} blocks)`, n > 0 && miss.length === 0, `${miss.length} missing: ${showMissing(miss)}`)) preserved += n;
  }
  let base = '';
  try { base = git(['show', `${BASELINE}:index.html`]); } catch (e) { r.check('ia preserve: read BASELINE index.html', false, e.message); }
  if (base) {
    const sect = (id) => (new RegExp(`<section class="[^"]*" id="${id}"[\\s\\S]*?<\\/section>\\s*(?=<!--|<\\/main>)`).exec(base) || [''])[0];
    const pairs = [['field log', sect('log'), 'writing.html'], ['manifesto', sect('philosophy'), 'writing.html'], ['project cards', sect('projects'), 'work.html']];
    for (const [label, part, newF] of pairs) {
      const n = blocks(part).length;
      const miss = html[newF] ? missingBlocks(part, [mainOf(html[newF])]).filter((b) => !RETIRED.includes(b)) : ['(target missing)'];
      if (r.check(`ia preserve BASELINE homepage ${label} → ${newF} (${n} blocks)`, n > 0 && miss.length === 0, `${miss.length} missing: ${showMissing(miss)}`)) preserved += n;
    }
    // Nothing else on the old homepage disappears either: each block lives on index, work or writing.
    const hubs = ['index.html', 'work.html', 'writing.html'].filter((f) => html[f]).map((f) => mainOf(html[f]));
    const n = blocks(mainOf(base)).length;
    const miss = missingBlocks(mainOf(base), hubs, RENAMED).filter((b) => !RETIRED.includes(b));
    if (r.check(`ia preserve BASELINE homepage <main> → index/work/writing (${n} blocks)`, miss.length === 0, `${miss.length} missing: ${showMissing(miss)}`)) preserved += n;
  }
  r.check(`ia preserve: total blocks verified = ${preserved}`, preserved > 0);
  console.log(`check-ia: content preservation verified ${preserved} text blocks (old pages from main, homepage from ${BASELINE.slice(0, 7)})`);

  // "Nicholas" nowhere in tracked site files (outside URLs / emails / handles).
  let files = [];
  try { files = git(['ls-files']).split('\n').filter((f) => f && !/^(docs|tools)\//.test(f) && /\.(html|js|css|md|json|txt)$/i.test(f)); } catch (e) { r.check('ia: git ls-files', false, e.message); }
  for (const f of files) if (exists(f)) r.check(`ia ${f}: no "Nicholas" outside URLs/emails/handles`, !strayNicholas(read(f)));
  for (const f of real) if (html[f]) r.check(`ia ${f}: header brand "NICK HARRISON"`, html[f].includes('<span class="brand-name">NICK HARRISON</span>'));
}

/* ── self-test ───────────────────────────────────────────────────────────── */

export function selftestIA(r) {
  r.check('ia navLinks reads nav', JSON.stringify(navLinks('<nav class="site-nav" id="site-nav"><a href="work.html">Work</a></nav>')) === '[["Work","work.html"]]');
  r.check('ia navLinks null without nav', navLinks('<nav><a href="x">x</a></nav>') === null);
  const oldMain = '<div class="badge">Law</div><h1>Right-to-Repair <em>Legislation</em>.</h1><p>One &mdash; two.</p><ul><li><b>A</b><span>b</span></li></ul><div class="note"><strong>N.</strong> note</div><a href="index.html" class="back-link">Back to Home</a><a href="x.html" class="dl-btn">Open It</a>';
  r.check('ia blocks finds p/li/h1/note/badge/link, skips back-link', JSON.stringify(blocks(oldMain).sort()) === JSON.stringify(['Law', 'Right-to-Repair Legislation.', 'One — two.', 'Ab', 'N. note', 'Open It'].sort()), JSON.stringify(blocks(oldMain)));
  r.check('ia missingBlocks: verbatim copy passes', missingBlocks(oldMain, [`<section>${oldMain.replace('index.html', '#x')}</section>`]).length === 0);
  r.check('ia missingBlocks: dropped paragraph flagged', missingBlocks(oldMain, [oldMain.replace('<p>One &mdash; two.</p>', '')]).length === 1);
  r.check('ia missingBlocks: edited word flagged', missingBlocks(oldMain, [oldMain.replace('two', 'three')]).length === 1);
  r.check('ia missingBlocks: Nicholas → Nick normalised', missingBlocks('<p>Nicholas Harrison</p>', ['<p>Nick Harrison</p>']).length === 0);
  r.check('ia missingBlocks: RENAMED allowlist', missingBlocks('<a>All Downloads →</a>', ['<a>All tools →</a>'], RENAMED).length === 0);
  const stub = `<meta http-equiv="refresh" content="0; url=repair.html#mission"><link rel="canonical" href="repair.html#mission"><meta name="robots" content="noindex"><style>html{background:#05070d}</style><script>(function(){var t='repair.html',d='#mission',h=location.hash;location.replace(t+(h&&h!=='#main'?h:d))})();</script><p>This page moved to <a href="repair.html#mission">x</a></p>`;
  const si = stubInfo(stub);
  r.check('ia stubInfo parses a good stub', si.refresh === 'repair.html#mission' && si.canonical === si.refresh && si.replace === si.refresh && si.robots && si.fallback === si.refresh && si.bg && !si.shell, JSON.stringify(si));
  r.check('ia stubInfo flags missing replace', stubInfo(stub.replace(/<script>.*<\/script>/, '')).replace === null);
  r.check('ia stubInfo flags missing noindex', !stubInfo(stub.replace('noindex', 'index')).robots);
  r.check('ia jsHtmlRefs finds page refs', JSON.stringify(jsHtmlRefs("{ href: 'mission.html' }, x = \"repair.html#talks\"")) === '["mission.html","repair.html#talks"]');
  r.check('ia strayNicholas flags prose', strayNicholas('<title>About — Nicholas Harrison</title>'));
  r.check('ia strayNicholas allows URLs/emails/handles', !strayNicholas('https://example.com/nicholas nicholas.h@example.com @NicholasH'));
  r.check('ia projectGrid extracts cards', projectGrid('<div class="project-grid">\n<article class="project">a</article>\n      </div>\n    </section>') === '\n<article class="project">a</article>');
}

/* ── standalone ──────────────────────────────────────────────────────────── */

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--print-projects')) {
    const mod = await loadProjects();
    console.log(mod.PROJECTS.map(mod.projectCard).join('\n'));
    process.exit(0);
  }
  const r = reporter(process.argv.includes('--selftest') ? 'check-ia selftest' : 'check-ia');
  if (process.argv.includes('--selftest')) selftestIA(r); else await runIA(r);
  process.exit(r.done() ? 0 : 1);
}
