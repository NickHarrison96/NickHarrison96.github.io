#!/usr/bin/env node
// Announces new write-ups from writing.html to a Discord channel through a webhook.
// Dependency-free (Node 18+). Dev/CI tooling only: nothing here is loaded by the site.
//
//   node tools/announce.mjs              post new write-ups (needs DISCORD_WEBHOOK_URL); dry run if it is unset
//   node tools/announce.mjs --dry-run    print what would be posted, change nothing
//   node tools/announce.mjs --seed       record every current write-up as already announced, post nothing
//   node tools/announce.mjs --selftest   check the parser and the payload shape
//
// State lives in announced.json (a list of page URLs). The webhook URL is a secret: it is read from the
// environment only, is never printed, and must never be written to a tracked file.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://nickharrison96.github.io/';
const PAGE = join(ROOT, 'writing.html');
const STATE = join(ROOT, 'announced.json');
// Card tags on writing.html that count as a write-up. Campaign cards and the "Layer 0N" explainer cards are not announced.
const WRITEUP_TAGS = new Set(['case study', 'tutorial', 'local ai']);
const MAX_PER_RUN = 5;
const COLOR = 0x38bdf8;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', middot: '·', eacute: 'é' };

export function decode(s) {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

// Reads the `<a class="... blog-card ..." href="...">` cards: tag span, <b> title, summary span.
export function parseWriteups(html) {
  const out = [];
  const card = /<a\b[^>]*class="[^"]*\bblog-card\b[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(card)) {
    const openTag = m[0].slice(0, m[0].indexOf('>') + 1);
    const href = /href="([^"]+)"/.exec(openTag)?.[1];
    const tag = /<span class="blog-card-tag">([\s\S]*?)<\/span>/.exec(m[1])?.[1];
    const title = /<b>([\s\S]*?)<\/b>/.exec(m[1])?.[1];
    // The summary is the last plain <span> in the card (the tag span has a class).
    const summary = [...m[1].matchAll(/<span>([\s\S]*?)<\/span>/g)].pop()?.[1];
    if (!href || !tag || !title || !WRITEUP_TAGS.has(decode(tag).toLowerCase())) continue;
    // Skip links that only point inside a hub page (#anchor on another page is fine, a bare "#" is not).
    if (href === '#' || href.startsWith('#')) continue;
    out.push({ url: new URL(href, SITE).href, tag: decode(tag), title: decode(title), summary: summary ? decode(summary) : '' });
  }
  return out;
}

export function buildPayload(w) {
  return {
    username: 'Harrison Technology',
    allowed_mentions: { parse: [] }, // never ping @everyone or roles from page text
    embeds: [{
      title: w.title.slice(0, 256),
      url: w.url,
      description: w.summary.slice(0, 400),
      color: COLOR,
      footer: { text: w.tag },
    }],
  };
}

function loadState() {
  if (!existsSync(STATE)) return [];
  const data = JSON.parse(readFileSync(STATE, 'utf8'));
  return Array.isArray(data.announced) ? data.announced : [];
}

function saveState(urls) {
  writeFileSync(STATE, JSON.stringify({ announced: [...new Set(urls)].sort() }, null, 2) + '\n');
}

function validWebhook(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && ['discord.com', 'discordapp.com'].includes(x.hostname) && x.pathname.startsWith('/api/webhooks/');
  } catch { return false; }
}

async function post(webhook, payload) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.status === 429) {
      const wait = Number((await res.json().catch(() => ({}))).retry_after ?? 2);
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000 + 250));
      continue;
    }
    if (!res.ok) throw new Error(`Discord answered ${res.status}`); // status only: never echo the URL
    return;
  }
  throw new Error('Discord kept rate-limiting; will retry next run');
}

function selftest() {
  let fail = 0;
  const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };
  const html = readFileSync(PAGE, 'utf8');
  const found = parseWriteups(html);
  ok(found.length >= 1, `parsed ${found.length} write-up(s) from writing.html`);
  ok(found.every((w) => w.url.startsWith(SITE) && w.title && w.tag), 'every write-up has an absolute url, title and tag');
  ok(!found.some((w) => /campaign|layer/i.test(w.tag)), 'campaign and layer cards are skipped');
  ok(!found.some((w) => /[<>]|&[a-z]+;/.test(w.title + w.summary)), 'no markup or raw entities left in text');
  const p = buildPayload({ url: SITE + 'x.html', tag: 'Tutorial', title: 'T @everyone', summary: 'S' });
  ok(Array.isArray(p.allowed_mentions.parse) && p.allowed_mentions.parse.length === 0, 'mentions are disabled');
  ok(validWebhook('https://discord.com/api/webhooks/1/abc') && !validWebhook('https://example.com/api/webhooks/1/abc') && !validWebhook('http://discord.com/api/webhooks/1/abc'), 'webhook host check');
  ok(decode('A &amp; B &mdash; C') === 'A & B — C', 'entity decoding');
  process.exit(fail ? 1 : 0);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--selftest')) return selftest();

  const writeups = parseWriteups(readFileSync(PAGE, 'utf8'));
  if (!writeups.length) throw new Error('No write-ups found in writing.html; the card markup may have changed. Nothing was posted.');
  const known = loadState();

  if (args.has('--seed')) {
    saveState([...known, ...writeups.map((w) => w.url)]);
    console.log(`Seeded ${writeups.length} write-up(s) as already announced.`);
    return;
  }

  const fresh = writeups.filter((w) => !known.includes(w.url));
  if (!fresh.length) { console.log('Nothing new to announce.'); return; }

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  const dry = args.has('--dry-run') || !webhook;
  if (!dry && !validWebhook(webhook)) throw new Error('DISCORD_WEBHOOK_URL is not a Discord webhook address.');
  if (!args.has('--dry-run') && !webhook) console.log('DISCORD_WEBHOOK_URL is not set: dry run.');

  const batch = fresh.slice(0, MAX_PER_RUN);
  if (fresh.length > batch.length) console.log(`${fresh.length} new; announcing the first ${batch.length} now, the rest next run.`);

  const done = [];
  for (const w of batch) {
    if (dry) {
      console.log(`[dry run] would announce: ${w.tag} | ${w.title}\n          ${w.url}`);
      continue;
    }
    await post(webhook, buildPayload(w));
    done.push(w.url);
    saveState([...known, ...done]); // record each success right away so a later failure never causes a repeat
    console.log(`Announced: ${w.title}`);
    await new Promise((r) => setTimeout(r, 1200));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`announce: ${e.message}`); process.exit(1); });
}
