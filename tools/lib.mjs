// Shared helpers for the dev-only checks in tools/. No dependencies.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
export const exists = (rel) => existsSync(join(ROOT, rel));

/** Every real page the site ships (full shell), and the phase that introduced it. */
export const PAGES = [
  ['index.html', 0], ['about.html', 0], ['downloads.html', 0], ['writing.html', 0],
  ['apfs-recovery.html', 4],
  ['work.html', 8], ['repair.html', 8], ['tools.html', 10],
  ['guide-kali-wsl2.html', 9], ['guide-ollama-claude-code-windows.html', 9],
  ['guide-ollama-claude-code-macos.html', 9], ['guide-llama-cpp.html', 9],
];

/**
 * Guides (phase 9): pages under Writing whose copy is taken verbatim from Nick's own documents.
 * `sources` are file names inside the source-docs folder (see sourceDir()); `open` is the terminal
 * shortcut (`open kali`); `ids` are the page's section ids, in nav order.
 */
export const GUIDES = [
  {
    file: 'guide-kali-wsl2.html', title: 'Kali Linux Desktop on WSL2', open: 'kali',
    sources: ['kali_wsl2_windows10_guide.html', 'kali_wsl2_windows11_guide.html'], ids: ['windows-10', 'windows-11'],
  },
  {
    file: 'guide-ollama-claude-code-windows.html', title: 'Local AI Coding on Windows 10 & 11', open: 'ollama',
    sources: ['ollama_claude_code_guide.html'], ids: ['parity', 'step-1', 'step-2', 'step-3', 'step-4'],
  },
  {
    file: 'guide-ollama-claude-code-macos.html', title: 'Local AI Coding on macOS Tahoe (x86)', open: 'ollama-mac',
    sources: ['macos_tahoe_x86_ollama_claude_code_guide.html'], ids: ['farewell', 'step-1', 'step-2', 'step-3', 'step-4'],
  },
  {
    file: 'guide-llama-cpp.html', title: 'llama.cpp — Complete Reference', open: 'llama',
    sources: ['llama.html', 'deepseek_html_20261029_487c63.html'],
    ids: ['quick-reference', 'build', 'direct', 'sampling', 'perf', 'advanced', 'backend-runtime', 'troubleshooting', 'workflow', 'comparison'],
  },
];

/**
 * Folder holding Nick's source documents (guides, the long APFS write-up, the HWiNFO report). It lives
 * outside the repo, so checks that read it skip with a warning when it is missing. Override with
 * NH_SOURCE_DOCS=/path/to/folder.
 */
export function sourceDir() {
  const tries = [process.env.NH_SOURCE_DOCS, join(ROOT, '..', 'Win10-11 Kali'), join(homedir(), 'Desktop', 'Win10-11 Kali')];
  return tries.find((d) => d && existsSync(d)) || null;
}

/**
 * Pre-redesign URLs that became redirect stubs in phase 8 (five-hub IA): [stub, target page, target id].
 * Stubs carry no site shell, so they are excluded from the shell checks and the browser page loop.
 */
export const STUBS = [
  ['mission.html', 'repair.html', 'mission'],
  ['legislation.html', 'repair.html', 'legislation'],
  ['get-involved.html', 'repair.html', 'get-involved'],
  ['repair-guides.html', 'repair.html', 'guides'],
  ['repair-cafes.html', 'repair.html', 'cafes'],
  ['talks.html', 'repair.html', 'talks'],
  ['team.html', 'about.html', 'team'],
  ['socials.html', 'about.html', 'socials'],
];

/** Header nav: the hubs, in order. Sub-pages map to the hub they live under. */
export const HUBS = [
  ['Work', 'work.html'], ['Blog', 'writing.html'], ['Right to Repair', 'repair.html'],
  ['Tools', 'tools.html'], ['Downloads', 'downloads.html'], ['About', 'about.html'],
];
export const HUB_OF = {
  'index.html': null, 'work.html': 'work.html', 'writing.html': 'writing.html', 'apfs-recovery.html': 'writing.html',
  'repair.html': 'repair.html', 'tools.html': 'tools.html', 'downloads.html': 'downloads.html', 'about.html': 'about.html',
  'guide-kali-wsl2.html': 'writing.html', 'guide-ollama-claude-code-windows.html': 'writing.html',
  'guide-ollama-claude-code-macos.html': 'writing.html', 'guide-llama-cpp.html': 'writing.html',
};

/** Parse `--phase=N`; no flag means every assertion (the completion run). */
export function phaseFromArgs(argv = process.argv.slice(2)) {
  const a = argv.find((x) => x.startsWith('--phase='));
  return a ? Number(a.slice('--phase='.length)) : Infinity;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  middot: '·', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  copy: '©', rarr: '→', larr: '←', uarr: '↑', darr: '↓', bull: '•', times: '×',
};

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Visible-ish text of an HTML document: scripts/styles/templates dropped, tags removed, whitespace collapsed. */
export function pageText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<template[\s\S]*?<\/template>/gi, ' ')
      .replace(/<\/?(?:span|code|em|strong|b|i|a|kbd|small|mark|abbr)\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

export const norm = (s) => decode(s).replace(/\s+/g, ' ').trim();

/** All start tags of the given names, with a lazy attribute reader. */
export function tags(html, names) {
  const re = new RegExp(`<(${names.join('|')})\\b([^>]*)>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push({ name: m[1].toLowerCase(), raw: m[0], attrs: m[2], index: m.index });
  return out;
}

export function attr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? '';
}

export const hasAttr = (attrs, name) => new RegExp(`(?:^|\\s)${name}(\\s*=|\\s|$)`, 'i').test(attrs);

/** Elements with their inner HTML (non-nesting tags only: button, summary, a). */
export function elements(html, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push({ attrs: m[1], inner: m[2], index: m.index });
  return out;
}

export function ids(html) {
  return new Set(tags(html, ['[a-z][a-z0-9-]*']).map((t) => attr(t.attrs, 'id')).filter(Boolean));
}

/** Static ES-module graph reachable from a page: inline module scripts + module src + relative imports. */
export function moduleGraph(pageRel) {
  const html = read(pageRel);
  const seen = new Set();
  const queue = [];
  const specRe = /(?:import\s*(?:[\w*{}\s,]+from\s*)?|import\s*\(\s*|export\s*[\w*{}\s,]*from\s*)['"]([^'"]+)['"]/g;
  const addSpecs = (src, base) => {
    let m;
    while ((m = specRe.exec(src))) queue.push({ spec: m[1], base });
  };
  for (const t of tags(html, ['script'])) {
    if ((attr(t.attrs, 'type') || '') !== 'module') continue;
    const src = attr(t.attrs, 'src');
    if (src) queue.push({ spec: src.startsWith('.') ? src : './' + src, base: '' });
  }
  const inline = /<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = inline.exec(html))) addSpecs(m[1], '');
  const missing = [];
  const external = [];
  while (queue.length) {
    const { spec, base } = queue.shift();
    if (!spec.startsWith('./') && !spec.startsWith('../')) { external.push(spec); continue; }
    const rel = join(base, spec).replace(/\\/g, '/');
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!exists(rel)) { missing.push(rel); continue; }
    addSpecs(read(rel), dirname(rel));
  }
  return { modules: seen, missing, external };
}

/** Tiny reporter: collects failures, prints, sets exit code. */
export function reporter(title) {
  const fails = [];
  let passes = 0;
  return {
    check(name, ok, detail = '') {
      if (ok) passes++;
      else fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
      return ok;
    },
    done() {
      for (const f of fails) console.log(`FAIL ${f}`);
      console.log(`${title}: ${passes} passed, ${fails.length} failed`);
      process.exitCode = fails.length ? 1 : 0;
      return fails.length === 0;
    },
  };
}
