// Shared helpers for the dev-only checks in tools/. No dependencies.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
export const exists = (rel) => existsSync(join(ROOT, rel));

/** Every page the site ships, and the phase that introduced it. */
export const PAGES = [
  ['index.html', 0], ['about.html', 0], ['downloads.html', 0], ['get-involved.html', 0],
  ['legislation.html', 0], ['mission.html', 0], ['repair-cafes.html', 0], ['repair-guides.html', 0],
  ['socials.html', 0], ['talks.html', 0], ['team.html', 0], ['writing.html', 0],
  ['apfs-recovery.html', 4],
];

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
