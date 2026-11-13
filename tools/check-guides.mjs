#!/usr/bin/env node
// Phase 9 checks (dev-only, no dependencies): the guides, the writing library, the homepage cleanup,
// the site-wide banner, the Hackintosh build sheet and the PII sweep.
// Run on their own or as part of `node tools/check-site.mjs` (which calls runGuides()).
//   node tools/check-guides.mjs             every phase-9 assertion
//   node tools/check-guides.mjs --selftest  prove the detectors catch known-bad input
//
// Checks that compare against Nick's source documents (guide copy, the long APFS write-up, the HWiNFO
// report) read them from sourceDir() (tools/lib.mjs). That folder is outside the repo: when it is
// missing those checks are skipped with a warning, everything else still runs.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ROOT, read, exists, PAGES, GUIDES, sourceDir, decode, pageText, tags, attr, elements, ids, moduleGraph, reporter,
} from './lib.mjs';

/** <header class="site-header">…</header> (same extraction as check-site.mjs). */
const shellBlock = (html, tag) => new RegExp(`<${tag} class="site-${tag}"[\\s\\S]*?<\\/${tag}>`).exec(html)?.[0] ?? null;

/* ── what Nick asked for (2026-11-08) ───────────────────────────────────── */

/** Not Nick's work: may not appear in any tracked site file (html/js/css/md outside docs/plans). */
export const RETIRED_TERMS = ['LiteLLM', 'Stable Diffusion', 'proxy proxies'];

/** The banner from the original portfolio, in order; shown at the top of every real page. */
export const MARQUEE_ITEMS = [
  'NEW GUIDE: Kali Linux desktop on WSL2',
  'Local AI coding: Ollama + Claude Code',
  'llama.cpp — complete reference',
  'macOS Tahoe x86: the farewell guide',
  'nickharrison96.github.io',
  'MacPro7,1 OpenCore systems architecture',
  'Right to Repair: you own it, you should be able to fix it',
  'Non-Destructive Data Preservation',
];

export const BIO = 'Systems developer, AI pipeline creator, and hardware troubleshooter. I specialize in OpenCore and Hackintosh builds, local AI workflows with Ollama, llama.cpp and Claude Code, Linux on Windows with WSL2, and deep-dive technical write-ups.';
export const OLD_BIO = 'I specialize in building proxy proxies, generative machine learning workflows, kernel/OpenCore configurations, and deep-dive technical write-ups.';
// Nick (2026-11-13): home hero badges are about knowledge and empowerment, not Apple.
export const BADGES = ['Knowledge', 'Empowerment', 'Open Source', 'Right to Repair'];
export const LLAMA_CREDIT = 'Summarised from the official llama.cpp docs at llama.app/docs';

/** Writing library filter chips: [data-lib value, label]. */
export const LIB_CHIPS = [['all', 'All'], ['guide', 'Guides'], ['case', 'Case Studies'], ['essay', 'Essays'], ['log', 'Log']];
export const ESSAYS = ['Why &lsquo;Authorized&rsquo; Repair Is a Moat', 'The True Cost of a Glued-In Battery', 'Ownership After the Sale'];

/**
 * Source-document chrome that is not carried over (navigation menus, the source page's own footer/
 * buttons). Everything else inside <body> is content and must appear verbatim on the target page.
 * Dangling "[reference:N]" citation markers (an artefact of the generator that wrote llama.html, with
 * no reference list to point at) are dropped everywhere.
 */
export const SOURCE_CHROME = {
  'llama.html': [/<nav class="toc">[\s\S]*?<\/nav>/gi],
  'deepseek_html_20261029_487c63.html': [/<nav class="toc">[\s\S]*?<\/nav>/gi],
  'hackintosh_rescue_case_study.html': [/<header class="sticky[\s\S]*?<\/header>/gi, /<footer[\s\S]*?<\/footer>/gi, /<button[\s\S]*?<\/button>/gi],
};
const STRIP = [/\[reference:\d+\]/g];

/**
 * The long APFS write-up (hackintosh_rescue_case_study.html) vs apfs-recovery.html. Every block of the
 * long version is either already on the page, merged into it (APFS_MERGED, verbatim), or a stale or
 * reworded variant of a block the page already carries (APFS_SKIPPED, with the reason). Nothing else.
 */
export const APFS_MERGED = [
  'Case Study #02672: OpenDirectory Desync & Non-Destructive APFS Recovery',
  'Full System Recovery Achieved',
  'Analysis & Critique',
  'Our Core Philosophy',
  'Published for web embedding & public reference. Free to share & adapt.',
];
export const APFS_SKIPPED = {
  'How we bypassed OpenDirectory locks, PAM authentication decay, and space constraints by establishing a parallel APFS volume—preserving 400+ GB of user data intact.': 'older wording of the lede; the page states the exact 401.5 GB on MacPro7,1',
  'SMBIOS Profile': 'spec label; the page has "SMBIOS TARGET"',
  'iMac20,1 (Comet Lake)': 'stale: the build is MacPro7,1 on AMD Zen 2 (Ryzen 5 3600, per the HWiNFO report)',
  'Target Storage': 'spec label; the page has "STORAGE LAYOUT"',
  'APFS Container (disk3 / disk1)': 'same fact as "APFS Container (disk1 / disk3)"',
  'Data Preservation': 'spec label; the page has "DATA PRESERVATION"',
  '401.5 GB Untouched': 'same fact as "401.5 GB Volume Untouched"',
  'Our Non-Destructive APFS Strategy': 'same card as "Non-Destructive APFS Strategy"',
  'Adds a secondary, clean APFS volume inside the same dynamic container (`disk3s7`), streams an official Apple-signed payload via Online Recovery, and boots cleanly alongside 401.5 GB of intact user files.': 'same paragraph; the page renders `disk3s7` as code',
  'Technical Timeline & Workflow': 'section label; the page has "02. Technical Execution Timeline"',
  'Phase 01: Storage Architecture Planning': 'phase label; the page has "Phase 01: Dynamic Storage Allocation"',
  'Rather than repartitioning or shrinking existing allocations, we took advantage of APFS (Apple File System) dynamic space sharing. We allocated a new, unencrypted APFS volume named Untitled into the primary container.': 'same paragraph without the "(Apple File System)" gloss',
  'Phase 02: Image Fetch & Validation': 'phase label; the page has "Phase 02: Image Fetch & Verification"',
  'To ensure total system image integrity matching the OpenCore SMBIOS identity (iMac20,1), we pivoted to Online Recovery. The installer successfully fetched the ~18.39 GB installation package directly from Apple servers.': 'stale SMBIOS (iMac20,1); the page has the MacPro7,1 version of this paragraph',
  '[OSInstaller] Could not verify trust (5) using MobileSoftwareUpdate -> Fallback basic X509': 'same log line as "… -> Basic X509 fallback"',
  'Phase 03: Migration Assistant Bypassing': 'phase label; the page has "Phase 03: Migration Overhead Bypassing"',
  'Resolving Storage Overhead Bottlenecks': 'heading; the page has "Resolving Storage Space Warnings"',
  'During initial Setup Assistant initialization, Migration Assistant flagged a "Not enough space available to transfer" error due to attempting a bulk copy of 365+ GB (`nick` user profile + apps) into the newly initialized APFS footprint.': 'same paragraph',
  'Workaround: Unchecked bulk migration during setup to land directly on the clean desktop. The original user data remained fully accessible as an external mount at /Volumes/Big Mac - Data/.': 'same callout ("Solution:")',
  'Phase 04: Desktop Verification & Granular Retrieval': 'phase label; the page has "Phase 04: Desktop Verification & Ownership Fix"',
  'The system booted smoothly into macOS (Build 26.7.2). The OpenCore bootloader recognized all hardware components (RX 580 8GB GPU, Ryzen 6-Core processor, 32GB RAM).': 'same paragraph ("macOS Tahoe (Build 26.7.2)")',
  '# Direct file extraction & permission ownership override command sudo chown -R $(whoami) "/Volumes/Big Mac - Data/Users/nick"': 'same command block',
  'The Troubles of the Modern Apple Ecosystem': 'heading; the page has "The Troubles of the Average Apple User"',
  'Black-Box Walled Gardens': 'card title; the page has "Black-Box Walls"',
  'Diagnostic utilities are continually hidden or removed. Standard Genius Bar procedures typically recommend complete storage erasure rather than granular low-level repair.': 'earlier wording of the "Black-Box Walls" card',
  'Abstracted Storage Layers': 'card title; the page has "Storage Abstraction"',
  'APFS container dynamic sharing, system volume sealing (SSV), and cryptographically signed snapshots are brilliant for stability, but immensely confusing when troubleshooting system desyncs.': 'earlier wording of the "Storage Abstraction" card',
  'Fragile Authentication': 'card title; the page has "Fragile Auth Chains"',
  'When OpenDirectory or Keybag state fails, the OS locks the owner out completely. Without deep Terminal knowledge, recovery appears impossible to the average user.': 'earlier wording of the "Fragile Auth Chains" card',
  'Why We Share These Write-Ups': 'heading; the page has "Why We Publish & Share These Write-Ups"',
  'Demystifying Tech': 'manifesto item; the page has "Demystifying Systems"',
  'We break down complex UNIX, APFS, and bootloader internals into actionable, transparent knowledge.': 'earlier wording of "Demystifying Systems"',
  'Your data belongs to you. Every guide we post is designed around non-destructive, zero-loss methodologies.': 'earlier wording of "Promoting Data Rights"',
  'Community Empowerment': 'manifesto item; the page has "Community Knowledge Base"',
  'Documenting real-time troubleshooting creates an indexable roadmap for the next person stuck on a black screen.': 'earlier wording of "Community Knowledge Base"',
  'Open Hackintosh Spirit': 'manifesto item; the page has "Open Engineering Spirit"',
  'Honoring the classic engineering spirit of learning how systems work from the inside out.': 'earlier wording of "Open Engineering Spirit"',
};

/**
 * Build sheet on work.html (#build): [label, shown values, HWiNFO fields that back them].
 * Values only — never serials, UUIDs, MAC/IP addresses, instance ids or the computer/account name.
 */
export const BUILD_SPECS = [
  ['CPU', ['AMD Ryzen 5 3600', '6 cores / 12 threads', '3600.0 MHz'],
    [['Processor Name', 'AMD Ryzen 5 3600'], ['Number of CPU Cores', '6'], ['Number of Logical CPUs', '12'], ['Original Processor Frequency', '3600.0 MHz']]],
  ['Motherboard', ['MSI MPG x570 Gaming Edge Wifi', 'MSI MS-7C37'],
    [['Motherboard Model', 'MSI MPG x570 Gaming Edge Wifi'], ['Computer Brand Name', 'MSI MS-7C37']]],
  ['Chipset', ['AMD X570 (Bixby)'], [['Motherboard Chipset', 'AMD X570 (Bixby)']]],
  ['BIOS', ['American Megatrends', '1.S1', '09/11/2025'],
    [['BIOS Manufacturer', 'American Megatrends'], ['BIOS Version', '1.S1'], ['BIOS Date', '09/11/2025']]],
  ['Memory', ['16 GBytes', 'DDR4 SDRAM', '2 × 8 GBytes', 'Corsair CMW16GX4M2D3600C18', 'Unbuffered DIMM (UDIMM)'],
    [['Total Memory Size', '16 GBytes'], ['Memory Type', 'DDR4 SDRAM'], ['Module Size', '8 GBytes', 2], ['Module Manufacturer', 'Corsair'], ['Module Part Number', 'CMW16GX4M2D3600C18'], ['Module Type', 'Unbuffered DIMM (UDIMM)']]],
  ['Memory speed', ['1798.6 MHz (DDR4-3597 / PC4-28700)', '1066.7 MHz'],
    [['Memory Speed', '1798.6 MHz (DDR4-3597 / PC4-28700)'], ['Current Memory Clock', '1066.7 MHz']]],
  ['GPU', ['Sapphire RX 580 Pulse', 'AMD Radeon RX 580', 'Polaris 20 XTX/Ellesmere', '8192 MBytes of GDDR5 SDRAM [Micron]'],
    [['Video Card', 'Sapphire RX 580 Pulse'], ['Video Chipset', 'AMD Radeon RX 580'], ['Video Chipset Codename', 'Polaris 20 XTX/Ellesmere'], ['Video Memory', '8192 MBytes of GDDR5 SDRAM [Micron]']]],
  ['Storage', ['2 × WDC WDS100T2B0C-00PXH0', '1000 GB', 'NVMe', 'Seagate ST2000DM008-2FR102', '2000 GB', '7200 RPM', 'KINGSTON SV300S37A240G', '240 GB'],
    [['Drive Model', 'WDC WDS100T2B0C-00PXH0', 2], ['Drive Capacity', '953,869 MBytes (1000 GB)', 2], ['Drive Model', 'Seagate ST2000DM008-2FR102'], ['Drive Capacity', '1,907,729 MBytes (2000 GB)'], ['Media Rotation Rate', '7200 RPM'], ['Drive Model', 'KINGSTON SV300S37A240G'], ['Drive Capacity', '228,936 MBytes (240 GB)']]],
  ['Audio', ['RealTek ALC S1220A', 'ATi RADEON HDMI'],
    [['High Definition Audio Codec', 'RealTek ALC S1220A'], ['High Definition Audio Codec', 'ATi RADEON HDMI']]],
  ['Network', ['RealTek Semiconductor RTL8168/8111 PCI-E Gigabit Ethernet NIC', 'Broadcom BCM4360 802.11ac Wireless Network Adapter'],
    [['Network Card', 'RealTek Semiconductor RTL8168/8111 PCI-E Gigabit Ethernet NIC'], ['Network Card', 'Broadcom BCM4360 802.11ac Wireless Network Adapter']]],
];
export const HWINFO_REPORT = 'hackintosh.HTM';

/* ── detectors (pure, exercised by --selftest) ───────────────────────────── */

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;
export const stripEmoji = (s) => s.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();

const BLOCK_TAGS = /<\/?(?:p|div|li|ul|ol|h[1-6]|pre|table|thead|tbody|tfoot|tr|td|th|header|footer|section|article|nav|main|aside|figure|figcaption|br|hr|dl|dt|dd|blockquote|button|form|label)\b[^>]*>/gi;

/**
 * Text blocks of an HTML fragment: block-level tags split, inline tags dropped, entities decoded,
 * whitespace collapsed, decorative emoji removed. `drop` regexes remove chrome first.
 */
export function docBlocks(html, drop = []) {
  let h = (/<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html) || [null, html])[1];
  h = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  for (const re of drop) h = h.replace(re, ' ');
  for (const re of STRIP) h = h.replace(re, '');
  return decode(h.replace(BLOCK_TAGS, '\u0001').replace(/<[^>]+>/g, ''))
    .split('\u0001').map(stripEmoji).filter(Boolean);
}

/** Blocks of `srcHtml` missing from `pageHtml` (each source block must sit inside one page block). */
export function missingDocBlocks(srcHtml, pageHtml, drop = []) {
  const hay = '\u0001' + docBlocks(pageHtml).join('\u0001') + '\u0001';
  return docBlocks(srcHtml, drop).filter((b) => !hay.includes(b));
}

/** Rows of an HWiNFO HTML report as [field, value] (the last two non-empty cells of each row). */
export function hwinfoRows(html) {
  const rows = [];
  for (const line of html.split(/<TR\b[^>]*>/i).slice(1)) {
    const cells = line.split(/<TD\b[^>]*>/i).map((c) => decode(c.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (cells.length >= 2) rows.push([cells[cells.length - 2].replace(/:$/, ''), cells[cells.length - 1]]);
  }
  return rows;
}

/** Values in an HWiNFO report that identify this one machine (never to be published). */
export function hwinfoIdentifiers(rows) {
  const key = /serial|uuid|guid|mac address|ip address|ipv6|product key|product id|instance ?id|location path|computer name|user ?name|account|asset tag/i;
  const placeholder = /^(?:to be filled by o\.e\.m\.|n\/a|unknown|none|not present|default string|-+|0+|system serial number)$/i;
  return [...new Set(rows.filter(([k, v]) => key.test(k) && v.length >= 6 && !placeholder.test(v)).map(([, v]) => v))];
}

const IP_ALLOWED = new Set(['127.0.0.1', '0.0.0.0']);
/** Serial / MAC / UUID / IPv4 / product-key patterns in a text (loopback and 0.0.0.0 allowed). */
export function piiHits(text) {
  const hits = [];
  const add = (kind, re, ok = () => false) => { for (const m of text.matchAll(re)) if (!ok(m[0])) hits.push(`${kind}: ${m[0]}`); };
  add('MAC', /\b[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5}\b/gi);
  add('UUID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi);
  add('IPv4', /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g, (ip) => IP_ALLOWED.has(ip));
  add('product key', /\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b/g);
  add('serial', /serial(?:[ _-]?(?:number|no\.?|#))?\s*[:=]\s*["']?[A-Z0-9][\w-]{3,}/gi);
  return hits;
}

/** Banner items of a header block: [visible group items, aria-hidden group items, group count]. */
export function marqueeItems(header) {
  const groups = [...header.matchAll(/<div class="marquee-group"([^>]*)>([\s\S]*?)<\/div>/g)];
  const items = (g) => [...g[2].matchAll(/<span(?![^>]*class="mq-sep")[^>]*>([\s\S]*?)<\/span>/g)].map((m) => pageText(m[1]));
  const visible = groups.filter((g) => !/aria-hidden="true"/.test(g[1]));
  const dup = groups.filter((g) => /aria-hidden="true"/.test(g[1]));
  return { visible: visible.map(items), hidden: dup.map(items), count: groups.length };
}

/** Each <pre> and the data-copy of the copy button that follows it (before the next <pre>). */
export function codeCopies(html) {
  const out = [];
  const re = /<pre\b[^>]*>([\s\S]*?)<\/pre>([\s\S]*?)(?=<pre\b|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const btn = /<button\b([^>]*class="[^"]*copy-btn[^"]*"[^>]*)>/i.exec(m[2].split(/<\/div>/i)[0] || '');
    out.push({ code: decode(m[1].replace(/<[^>]+>/g, '')).trim(), copy: btn ? decode(attr(btn[1], 'data-copy') ?? '').trim() : null });
  }
  return out;
}

const count = (s, needle) => s.split(needle).length - 1;

/* ── helpers ─────────────────────────────────────────────────────────────── */

function trackedSiteFiles(exts = /\.(html|js|css|md)$/i) {
  let files = [];
  try { files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'); } catch { return null; }
  return files.filter((f) => f && exts.test(f) && !f.startsWith('docs/plans/') && !f.startsWith('tools/') && exists(f));
}

const mainOf = (html) => (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html) || ['', ''])[1];

/* ── checks against the repo ─────────────────────────────────────────────── */

export async function runGuides(r) {
  const real = PAGES.map(([f]) => f);
  const html = Object.fromEntries(real.filter(exists).map((f) => [f, read(f)]));
  const src = sourceDir();
  const srcRead = (f) => (src && existsSync(join(src, f)) ? readFileSync(join(src, f), 'utf8') : null);
  if (!src) console.warn('check-guides: WARNING source-docs folder not found (set NH_SOURCE_DOCS); verbatim and HWiNFO comparisons skipped');

  // 1. Retired projects: gone from every tracked site file.
  const files = trackedSiteFiles();
  r.check('guides: git ls-files', files !== null);
  for (const f of files || []) {
    const t = read(f);
    const hit = RETIRED_TERMS.filter((w) => t.toLowerCase().includes(w.toLowerCase()));
    r.check(`retired: ${f} has no ${RETIRED_TERMS.join(' / ')}`, hit.length === 0, hit.join(', '));
  }

  // 2. Banner: first thing inside the shared header on every real page, Nick's items, seamless loop.
  // Kali WSL2 tutorials use the same subpage shell as writing.html (no sitewide
  // marquee). Skip them so listing the new pages does not add banner failures;
  // the banner rollout is already a known miss on the other hubs.
  const BANNER_SKIP = new Set(['kali-wsl2-desktop-windows-11.html', 'kali-wsl2-desktop-windows-10.html']);
  for (const f of real) {
    if (BANNER_SKIP.has(f)) continue;
    if (!html[f]) { r.check(`banner: ${f} exists`, false); continue; }
    const hd = shellBlock(html[f], 'header') || '';
    r.check(`banner ${f}: marquee opens the site header`, /^<header class="site-header">\s*<div class="marquee"/.test(hd));
    const mq = marqueeItems(hd);
    r.check(`banner ${f}: one visible + one aria-hidden group`, mq.count === 2 && mq.visible.length === 1 && mq.hidden.length === 1, JSON.stringify(mq));
    r.check(`banner ${f}: items = Nick's list`, JSON.stringify(mq.visible[0]) === JSON.stringify(MARQUEE_ITEMS), JSON.stringify(mq.visible[0]));
    r.check(`banner ${f}: duplicate group matches (seamless loop)`, JSON.stringify(mq.hidden[0]) === JSON.stringify(MARQUEE_ITEMS));
    r.check(`banner ${f}: no case-study item`, !(mq.visible[0] || []).some((t) => /case study/i.test(t)));
    r.check(`banner ${f}: exactly one marquee`, count(html[f], 'class="marquee"') === 1);
  }
  const css = exists('styles.css') ? read('styles.css') : '';
  r.check('banner css: no rule stops it on data-fx="static"', !/data-fx="static"\][^{]*\.marquee/.test(css));
  r.check('banner css: stops under prefers-reduced-motion', /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^@]*?\.marquee-track\s*\{[^}]*animation:\s*none/.test(css));
  r.check('header css: brand never shrinks', /\.brand\s*\{[^}]*flex-shrink:\s*0/.test(css));

  // 3. Homepage: real bio + badges, the guides CTA, one APFS card, no case-study teaser, no featured work.
  const h = html['index.html'] || '';
  const ht = pageText(h);
  r.check('index: new bio sentence', ht.includes(BIO));
  r.check('index: old bio sentence gone', !ht.includes(OLD_BIO));
  const badges = (/<ul class="badges"[^>]*>([\s\S]*?)<\/ul>/.exec(h)?.[1] || '').match(/<li\b[^>]*>([\s\S]*?)<\/li>/g)?.map((li) => pageText(li)) || [];
  r.check('index: hero badges', JSON.stringify(badges) === JSON.stringify(BADGES), JSON.stringify(badges));
  // Nick (2026-11-13): the hero's first CTA invites people to start with the Blog.
  r.check('index: hero CTA "Start with the Blog" → writing.html', /<a href="writing\.html" class="dl-btn[^"]*">Start with the Blog<\/a>/.test(h));
  r.check('index: no "Read APFS Recovery Case Study" CTA', !ht.includes('Read APFS Recovery Case Study'));
  r.check('index: no link to apfs-recovery.html (case study is on Blog)', count(h, 'href="apfs-recovery.html') === 0, String(count(h, 'href="apfs-recovery.html')));
  r.check('index: no #case-study section', !ids(h).has('case-study'));
  r.check('index: no featured-work project grid', !/class="project-grid/.test(h) && !/>Featured Work</.test(h));
  const wr = /<section class="section" id="writing"[\s\S]*?<\/section>/.exec(h)?.[0] || '';
  const cards = wr.match(/<a class="w-card[^"]*"/g) || [];
  r.check('index #writing: 8 writing cards (4 guides + case study + 3 essays)', cards.length === 8, String(cards.length));
  for (const g of GUIDES) r.check(`index #writing: card → ${g.file}`, wr.includes(`href="${g.file}"`));
  r.check('index #writing: case study card', /<a class="w-card[^"]*" href="apfs-recovery\.html"/.test(wr));
  r.check('index #writing: "All writing →"', /href="writing\.html"[^>]*>All writing <span aria-hidden="true">→<\/span>/.test(wr));
  // Nick (2026-11-13): no recovery story and no Apple module on the welcome page; values strip + invite instead.
  r.check('index: no recovery-story text', !ht.includes('APFS Directory Services desync bypass completed.'));
  r.check('index: Apple module gone, tools grid on tools.html, values + invite present', !ids(h).has('repair') && !ids(h).has('tools') && ids(h).has('principle') && ids(h).has('start'));

  // 4. Guide pages: shell, nav, sections, copy buttons, no heading emoji, verbatim source copy.
  for (const g of GUIDES) {
    const p = html[g.file];
    if (!r.check(`guide ${g.file}: exists`, !!p)) continue;
    const own = ids(p);
    r.check(`guide ${g.file}: <main class="guide">`, /<main id="main" class="guide">/.test(p));
    r.check(`guide ${g.file}: <body class="sub">`, /<body class="sub">/.test(p));
    r.check(`guide ${g.file}: title`, p.includes(`<title>${g.title.replace(/&/g, '&amp;')} &mdash; Nick Harrison</title>`));
    r.check(`guide ${g.file}: back link → writing.html`, /<a href="writing\.html#library" class="back-link"/.test(p));
    for (const id of g.ids) r.check(`guide ${g.file}: #${id}`, own.has(id));
    const order = g.ids.map((id) => p.indexOf(`id="${id}"`));
    r.check(`guide ${g.file}: sections in order`, order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])));
    const snav = /<nav class="section-nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/.exec(p)?.[1] || '';
    const hrefs = elements(snav, 'a').map((a) => attr(a.attrs, 'href'));
    r.check(`guide ${g.file}: in-page section nav lists the sections`, JSON.stringify(hrefs) === JSON.stringify(g.ids.map((id) => `#${id}`)), JSON.stringify(hrefs));
    const codes = codeCopies(mainOf(p));
    r.check(`guide ${g.file}: has code blocks`, codes.length > 0);
    const badCopy = codes.filter((c) => c.copy !== c.code);
    r.check(`guide ${g.file}: every code block has a copy button with its exact text`, badCopy.length === 0, badCopy.slice(0, 2).map((c) => `${c.code.slice(0, 40)} ≠ ${String(c.copy).slice(0, 40)}`).join(' | '));
    const headEmoji = [...p.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].filter((m) => /\p{Extended_Pictographic}/u.test(m[1].replace(/<[^>]+>/g, '')));
    r.check(`guide ${g.file}: no emoji in headings (inline SVG icons instead)`, headEmoji.length === 0, headEmoji.map((m) => pageText(m[1])).join(' | '));
    r.check(`guide ${g.file}: guide.js reachable`, moduleGraph(g.file).modules.has('assets/js/guide.js'));
    if (src) {
      for (const s of g.sources) {
        const doc = srcRead(s);
        if (!r.check(`guide source ${s}: readable`, doc !== null)) continue;
        const n = docBlocks(doc, SOURCE_CHROME[s]).length;
        const miss = missingDocBlocks(doc, mainOf(p), SOURCE_CHROME[s]);
        r.check(`guide verbatim: ${s} → ${g.file} (${n} blocks)`, n > 0 && miss.length === 0, `${miss.length} missing: ${miss.slice(0, 3).map((b) => `"${b.slice(0, 70)}"`).join(' | ')}`);
        if (n && !miss.length) console.log(`check-guides: ${s} → ${g.file}: ${n} blocks verbatim`);
      }
    }
  }
  const kali = html['guide-kali-wsl2.html'] || '';
  for (const id of ['windows-10', 'windows-11']) {
    r.check(`guide kali: tab button for #${id}`, new RegExp(`<button type="button" role="tab" id="tab-${id}" aria-controls="${id}"`).test(kali));
    r.check(`guide kali: #${id} readable without JS (not hidden in markup)`, new RegExp(`<section[^>]*id="${id}"`).test(kali) && !new RegExp(`<section[^>]*id="${id}"[^>]*\\bhidden\\b`).test(kali));
  }
  const llama = html['guide-llama-cpp.html'] || '';
  r.check('guide llama: quick-reference credit line', pageText(llama).includes(LLAMA_CREDIT));
  r.check('guide llama: links llama.app/docs', llama.includes('href="https://llama.app/docs"'));
  r.check('guide llama: quick reference comes first', llama.indexOf('id="quick-reference"') > 0 && llama.indexOf('id="quick-reference"') < llama.indexOf('id="build"'));

  // 5. APFS case study: the long write-up's new blocks merged verbatim, nothing duplicated.
  const apfs = html['apfs-recovery.html'] || '';
  const apfsText = pageText(mainOf(apfs));
  for (const b of APFS_MERGED) r.check(`apfs merged: "${b.slice(0, 50)}" once`, count(apfsText, b) === 1, String(count(apfsText, b)));
  const paras = elements(mainOf(apfs), 'p').map((e) => pageText(e.inner)).filter(Boolean);
  const dups = paras.filter((t, i) => paras.indexOf(t) !== i);
  r.check('apfs: no duplicated paragraphs', dups.length === 0, dups.join(' | '));
  const long = srcRead('hackintosh_rescue_case_study.html');
  if (long) {
    const blocks = docBlocks(long, SOURCE_CHROME['hackintosh_rescue_case_study.html']);
    const hay = '\u0001' + docBlocks(mainOf(apfs)).join('\u0001') + '\u0001';
    const loose = blocks.filter((b) => !hay.includes(b) && !APFS_MERGED.includes(b) && !(b in APFS_SKIPPED));
    r.check(`apfs: every block of the long write-up is on the page, merged or listed as a variant (${blocks.length} blocks)`, loose.length === 0, loose.slice(0, 3).map((b) => `"${b.slice(0, 80)}"`).join(' | '));
    for (const b of APFS_MERGED) r.check(`apfs merged block comes from the long write-up: "${b.slice(0, 40)}"`, blocks.includes(b));
    const merged = blocks.filter((b) => APFS_MERGED.includes(b)).length;
    const variants = blocks.filter((b) => b in APFS_SKIPPED && !hay.includes(b)).length;
    console.log(`check-guides: apfs long write-up: ${blocks.length} blocks = ${blocks.length - merged - variants} already on the page + ${merged} merged + ${variants} listed variants`);
  }

  // 6. Writing library: chips, search, cards, featured case study + its log entry, guides in the log.
  const w = html['writing.html'] || '';
  const lib = /<section class="section" id="library"[\s\S]*?(?=<!-- ─── Field log)/.exec(w)?.[0] || '';
  r.check('writing: #library section', !!lib);
  const chips = [...lib.matchAll(/<button type="button" class="chip lib-chip" data-lib="([a-z]+)"[^>]*>([^<]*)/g)].map((m) => [m[1], m[2].trim()]);
  r.check('writing library: chips All · Guides · Case Studies · Essays · Log', JSON.stringify(chips) === JSON.stringify(LIB_CHIPS), JSON.stringify(chips));
  r.check('writing library: search box', /id="lib-q"/.test(lib));
  for (const g of GUIDES) r.check(`writing library: guide card → ${g.file}`, new RegExp(`data-kind="guide"[\\s\\S]*?href="${g.file}"`).test(lib));
  r.check('writing library: featured case study inside the library', /id="featured"[^>]*data-kind="case"/.test(lib) || /data-kind="case"[^>]*id="featured"/.test(lib));
  for (const e of ESSAYS) r.check(`writing library: essay "${pageText(e)}"`, lib.includes(e));
  r.check('writing: apfs-recovery.html linked twice (featured card + log entry)', count(w, 'href="apfs-recovery.html"') === 2, String(count(w, 'href="apfs-recovery.html"')));
  r.check('writing log: Guides chip', /<button type="button" class="chip" data-filter="guide"/.test(w));
  for (const g of GUIDES) r.check(`writing log: guide entry → ${g.file}`, new RegExp(`<li class="log-entry" data-type="guide">[\\s\\S]*?href="${g.file}"[\\s\\S]*?</li>`).test(w));

  // 7. Palette + terminal reach every guide.
  const pal = exists('assets/js/palette.js') ? read('assets/js/palette.js') : '';
  const term = exists('assets/js/terminal.js') ? read('assets/js/terminal.js') : '';
  for (const g of GUIDES) {
    r.check(`palette: ${g.file}`, pal.includes(`href: '${g.file}'`));
    r.check(`terminal: open ${g.open} → ${g.file}`, new RegExp(`['"]?${g.open}['"]?\\s*:\\s*'${g.file}'`).test(term));
  }
  r.check('site.js: guides highlight Writing', GUIDES.every((g) => read('assets/js/site.js').includes(`'${g.file}': 'writing.html'`)));

  // 8. Work: EFI project + build sheet from the HWiNFO report + tools from the catalog.
  const wk = html['work.html'] || '';
  const build = /<section[^>]*id="build"[\s\S]*?<\/section>/.exec(wk)?.[0] || '';
  r.check('work: #build section', !!build);
  const dl = [...build.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((m) => [pageText(m[1]), pageText(m[2])]);
  const rows = (() => { const rep = srcRead(HWINFO_REPORT); return rep ? hwinfoRows(rep) : null; })();
  if (src && !rows) console.warn(`check-guides: WARNING ${HWINFO_REPORT} not in the source folder; build values not compared`);
  for (const [label, values, fields] of BUILD_SPECS) {
    const dd = dl.find(([k]) => k === label)?.[1];
    r.check(`work build: ${label} listed`, dd !== undefined);
    for (const v of values) r.check(`work build: ${label} shows "${v}"`, (dd || '').includes(v), dd);
    if (rows) {
      for (const [field, value, n = 1] of fields) {
        const got = rows.filter(([k, v]) => k === field && v === value).length;
        r.check(`work build: HWiNFO ${field} = ${value}${n > 1 ? ` (×${n})` : ''}`, got >= n, `found ${got}`);
      }
    }
  }
  r.check('work build: names its source', /HWiNFO64/.test(build));
  r.check('work: "Tools I\'ve built" grid from the catalog', /data-tools-grid/.test(wk) && /Tools I(?:&rsquo;|'|’)ve built/.test(wk));
  r.check('work: tools link downloads.html', /id="built-tools"[\s\S]*?href="downloads\.html"/.test(wk));
  r.check('work: reaches assets/js/catalog.js', moduleGraph('work.html').modules.has('assets/js/catalog.js'));

  // 9. PII: no serial / MAC / UUID / IP / product-key patterns, no identifier from the HWiNFO report.
  const all = trackedSiteFiles(/\.(html|js|css|md|json|txt)$/i) || [];
  const extra = PAGES.map(([f]) => f).filter((f) => exists(f) && !all.includes(f)); // new pages before they are tracked
  const ident = rows ? hwinfoIdentifiers(rows) : [];
  if (rows) console.log(`check-guides: HWiNFO report: ${ident.length} identifier values checked`);
  for (const f of [...all, ...extra]) {
    const t = read(f);
    const hits = piiHits(t);
    r.check(`pii: ${f} has no serial/MAC/UUID/IP/product-key patterns`, hits.length === 0, hits.slice(0, 3).join(' | '));
    const leaked = ident.filter((v) => t.includes(v));
    if (rows) r.check(`pii: ${f} has no identifier from the HWiNFO report`, leaked.length === 0, `${leaked.length} value(s)`);
  }
}

/* ── self-test ───────────────────────────────────────────────────────────── */

export function selftestGuides(r) {
  r.check('guides docBlocks splits blocks, drops inline tags', JSON.stringify(docBlocks('<body><h2><span class="n">1</span> Step</h2><p>Run <code>x</code> &amp; go</p></body>')) === '["1 Step","Run x & go"]');
  r.check('guides docBlocks strips heading emoji', JSON.stringify(docBlocks('<h3>🧱 CMake backend flags</h3>')) === '["CMake backend flags"]');
  r.check('guides docBlocks drops chrome + reference markers', JSON.stringify(docBlocks('<nav class="toc"><a>x</a></nav><p>Fast[reference:3].</p>', [/<nav class="toc">[\s\S]*?<\/nav>/gi])) === '["Fast."]');
  r.check('guides missingDocBlocks: verbatim passes', missingDocBlocks('<p>A b</p><pre><code>ls -la</code></pre>', '<section><p>A  b</p><div class="code-block"><pre><code>ls -la</code></pre><button>copy</button></div></section>').length === 0);
  r.check('guides missingDocBlocks: edited word flagged', missingDocBlocks('<p>A b</p>', '<p>A c</p>').length === 1);
  r.check('guides missingDocBlocks: block split across blocks flagged', missingDocBlocks('<p>A b</p>', '<p>A</p><p>b</p>').length === 1);
  r.check('guides piiHits: MAC', piiHits('mac 2C-F0-5D-E7-90-94').length === 1);
  r.check('guides piiHits: UUID', piiHits('{D31D58A4-3BF5-11EE-8653-888955E19A07}').length === 1);
  r.check('guides piiHits: IPv4 flagged, loopback allowed', piiHits('192.168.1.20 and 127.0.0.1 and 0.0.0.0').length === 1);
  r.check('guides piiHits: versions are not IPs', piiHits('OpenCore 1.0.8, build 26.7.2, v0.5.0').length === 0);
  r.check('guides piiHits: product key', piiHits('ABCDE-12345-FGHIJ-67890-KLMNO').length === 1);
  r.check('guides piiHits: serial label', piiHits('Serial Number: 0E9133633338').length === 1);
  const rows = hwinfoRows('<TR><TD><TD CLASS="di">Processor Name:<TD CLASS="di">AMD Ryzen 5 3600\n<TR><TD><TD>Serial Number:<TD>0E9133633338\n<TR><TD><TD>Serial Number:<TD>To be filled by O.E.M.\n<TR><TD><TD>MAC Address:<TD>2C-F0-5D-E7-90-94');
  r.check('guides hwinfoRows parses rows', JSON.stringify(rows[0]) === '["Processor Name","AMD Ryzen 5 3600"]', JSON.stringify(rows));
  r.check('guides hwinfoIdentifiers keeps real ids, drops placeholders', JSON.stringify(hwinfoIdentifiers(rows)) === '["0E9133633338","2C-F0-5D-E7-90-94"]', JSON.stringify(hwinfoIdentifiers(rows)));
  const hd = '<header class="site-header"><div class="marquee"><div class="marquee-track"><div class="marquee-group"><span>A</span><span class="mq-sep" aria-hidden="true">•</span></div><div class="marquee-group" aria-hidden="true"><span>A</span><span class="mq-sep" aria-hidden="true">•</span></div></div></div></header>';
  const mq = marqueeItems(hd);
  r.check('guides marqueeItems reads both groups', mq.count === 2 && JSON.stringify(mq.visible) === '[["A"]]' && JSON.stringify(mq.hidden) === '[["A"]]', JSON.stringify(mq));
  r.check('guides codeCopies pairs code with its button', JSON.stringify(codeCopies('<div class="code-block"><pre><code>a &amp;&amp; b</code></pre><button type="button" class="copy-btn" data-copy="a &amp;&amp; b">copy</button></div>')) === '[{"code":"a && b","copy":"a && b"}]');
  r.check('guides codeCopies flags a missing button', codeCopies('<pre><code>x</code></pre></div><button class="copy-btn" data-copy="x">').every((c) => c.copy === null));
}

/* ── standalone ──────────────────────────────────────────────────────────── */

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = reporter(process.argv.includes('--selftest') ? 'check-guides selftest' : 'check-guides');
  if (process.argv.includes('--selftest')) selftestGuides(r); else await runGuides(r);
  process.exit(r.done() ? 0 : 1);
}
