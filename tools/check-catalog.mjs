#!/usr/bin/env node
// Catalog checks (dev-only, no dependencies).
// The tool catalog lives in ONE place, assets/js/catalog.js, and both index.html and
// downloads.html reach it through their module graph. ITEMS (homepage page links) is
// out of scope on purpose (plan C6).
//   node tools/check-catalog.mjs             run against the repo
//   node tools/check-catalog.mjs --selftest  prove the detectors catch known-bad input
import { read, exists, moduleGraph, reporter } from './lib.mjs';

const CATALOG = 'assets/js/catalog.js';
const CONSUMERS = ['index.html', 'downloads.html'];

// Entries that existed before the shared module; their links must not change.
const LEGACY = {
  RootForgeKit: {
    url: 'https://github.com/NickHarrison96/RootForgeKit/releases/download/v0.5.0/RootForgeKit-v0.5.0-win64.zip',
    version: 'v0.5 · pre-alpha', image: 'assets/dl-rootforgekit.png', hue: 205, host: 'github',
    sha256: '54b6d562d3a13ac4ff4ffab31aa50a7ffa147bcc4274f2a6f75ca6c1733586cc', size: 127270394,
  },
  'Pymobile3-GUI': {
    url: 'https://github.com/NickHarrison96/Pymobile3-GUI/archive/refs/heads/feature/sshrd-ramdisk.zip',
    version: 'v0.1 · pre-release', image: 'assets/dl-pymobile3.png', hue: 265, host: 'github',
  },
  BipPoyAI: {
    url: 'https://github.com/NickHarrison96/BipPoyAI/archive/refs/heads/main.zip',
    version: 'v0.1 · pre-alpha', image: 'assets/dl-bippoyai.png', hue: 32, host: 'github',
  },
};

/** Inline catalog arrays that must never come back (TOOLS / DOWNLOADS only). */
export function inlineArrays(html) {
  return [...html.matchAll(/\b(?:const|let|var)\s+(TOOLS|DOWNLOADS)\s*=\s*\[/g)].map((m) => m[1]);
}

/** Field problems for one catalog entry. */
export function entryProblems(e) {
  const p = [];
  const str = (k) => typeof e[k] === 'string' && e[k].trim() !== '';
  for (const k of ['name', 'version', 'description', 'summary']) if (!str(k)) p.push(`${k} missing`);
  if (!['github', 'self'].includes(e.host)) p.push('host must be github|self');
  if (!['live', 'soon'].includes(e.status)) p.push('status must be live|soon');
  if (e.host === 'github' && e.status === 'live' && !/^https:\/\//.test(e.url || '')) p.push('live github entry needs https url');
  if (e.host === 'self' && !str('filename')) p.push('self-hosted entry needs filename');
  if (!(typeof e.hue === 'number' && e.hue >= 0 && e.hue <= 360)) p.push('hue 0–360');
  if (!('category' in e)) p.push('category key missing (null allowed)');
  if (!('image' in e)) p.push('image key missing (null allowed)');
  return p;
}

async function loadCatalog(src) {
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  return mod.TOOLS;
}

async function selftest() {
  const r = reporter('check-catalog selftest');
  r.check('inlineArrays flags const TOOLS = [', inlineArrays('const TOOLS = [ {a:1} ]').length === 1);
  r.check('inlineArrays flags let DOWNLOADS=[', inlineArrays('let DOWNLOADS=[]').length === 1);
  r.check('inlineArrays ignores ITEMS (C6)', inlineArrays('const ITEMS = []').length === 0);
  r.check('inlineArrays ignores imports', inlineArrays("import { TOOLS } from './assets/js/catalog.js'").length === 0);
  const good = { name: 'X', host: 'github', status: 'live', url: 'https://g/x.zip', version: 'v1', category: null, hue: 10, image: null, description: 'd', summary: 's' };
  r.check('entryProblems accepts good entry', entryProblems(good).length === 0);
  r.check('entryProblems flags http url', entryProblems({ ...good, url: 'http://g' }).length === 1);
  r.check('entryProblems flags missing summary', entryProblems({ ...good, summary: '' }).length === 1);
  r.check('entryProblems flags self without filename', entryProblems({ ...good, host: 'self' }).length === 1);
  const t = await loadCatalog('export const TOOLS = [{ name: "a" }];');
  r.check('loadCatalog evaluates ES module', Array.isArray(t) && t[0].name === 'a');
  return r.done();
}

async function run() {
  const r = reporter('check-catalog');
  if (!r.check(`${CATALOG} exists`, exists(CATALOG))) return r.done();
  let tools;
  try {
    tools = await loadCatalog(read(CATALOG));
  } catch (e) {
    r.check(`${CATALOG} evaluates`, false, e.message);
    return r.done();
  }
  r.check('catalog exports a non-empty TOOLS array', Array.isArray(tools) && tools.length > 0);
  tools = tools || [];
  const names = tools.map((t) => t.name);
  r.check('tool names unique', new Set(names).size === names.length);
  for (const t of tools) {
    const p = entryProblems(t);
    r.check(`entry ${t.name}: fields`, p.length === 0, p.join('; '));
    if (t.image) r.check(`entry ${t.name}: image exists`, exists(t.image), t.image);
  }
  for (const [name, want] of Object.entries(LEGACY)) {
    const t = tools.find((x) => x.name === name);
    if (!r.check(`legacy entry kept: ${name}`, !!t)) continue;
    for (const [k, v] of Object.entries(want)) r.check(`legacy ${name}.${k} unchanged`, t[k] === v, `${t[k]} ≠ ${v}`);
  }
  for (const f of CONSUMERS) {
    const html = read(f);
    const inline = inlineArrays(html);
    r.check(`${f}: no inline TOOLS/DOWNLOADS array`, inline.length === 0, inline.join(', '));
    const g = moduleGraph(f);
    r.check(`${f}: reaches ${CATALOG} through its module graph`, g.modules.has(CATALOG), [...g.modules].join(', ') || 'no modules');
  }
  // No other module may re-declare a catalog array.
  for (const m of new Set(CONSUMERS.flatMap((f) => [...moduleGraph(f).modules]))) {
    if (m === CATALOG || !exists(m)) continue;
    r.check(`${m}: no inline TOOLS/DOWNLOADS array`, inlineArrays(read(m)).length === 0);
  }
  return r.done();
}

const ok = process.argv.includes('--selftest') ? await selftest() : await run();
process.exit(ok ? 0 : 1);
