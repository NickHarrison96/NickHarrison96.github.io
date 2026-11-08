# AGENTS.md

Static, dependency-free personal site for Nick (Nicholas) Harrison: systems & AI engineering portfolio (projects, the APFS recovery case study) merged with the Right to Repair campaign and free tools. No build step, no runtime dependencies — deploy the folder as-is.

## Architecture
- 13 pages share `styles.css` and one shell: `index.html`, `apfs-recovery.html`, `downloads.html`, `about.html`, `team.html`, `socials.html`, `mission.html`, `get-involved.html`, `repair-guides.html`, `legislation.html`, `repair-cafes.html`, `talks.html`, `writing.html`. Sub-pages use `<body class="sub">` with `.card.subpage` → `.page-hero` + `.prose`.
- **Shell (identical on every page):** inline `<head>` snippet (adds `.js` to `<html>`, applies a saved jailbreak theme, decides the boot splash before first paint), Inter + JetBrains Mono from Google Fonts, `<canvas id="fx-bg" aria-hidden="true">`, `<header class="site-header">`, `<footer class="site-footer">`, and one entry module `<script type="module" src="assets/js/site.js">`. `tools/check-site.mjs` fails if the header or footer differ by a single byte between pages, so edit them on every page together (the current-page highlight is set by `site.js`, not in markup).
- **JS modules** (`assets/js/`, plain ES modules, no bundler):
  - `catalog.js` — the tool catalog (`TOOLS`). The only place tools are listed.
  - `site.js` — entry: tier, header/menu, copy buttons; lazy-loads the rest by page.
  - `home.js` — homepage tools grid + tool entries in the field log (from the catalog), log filters/search, Right to Repair teardown.
  - `case.js` — case-study timeline nodes light as they scroll in.
  - `terminal.js` (homepage terminal), `palette.js` (⌘K / Ctrl+K), `scramble.js` (eyebrow decode), `boot.js` (splash timing), `konami.js` (jailbreak mode).
  - `fx-config.js` — **every effect constant** (plan policy table). Change numbers here only; `check-site.mjs` asserts them.
  - `fx-tier.js` — FULL / LITE / STATIC on `<html data-fx>`, frame-time watchdog.
  - `fx-gravity.js` — raw WebGL background (grid, particles, cursor gravity lens, click shockwave).
  - `fx-physics.js` — one rAF loop for `.magnetic` (buttons), `.tilt` (cards) and `.spot` (sections).
- `downloads.html` imports the catalog in its inline module script and keeps the Host Folder section that fetches a live JSON listing from the Cloudflare Worker.

## Tiers (`<html data-fx>`)
- **STATIC**: reduced motion, WebGL unavailable/software-only, or the watchdog tripped (median frame > 24 ms in two consecutive 2 s windows, sampled only while visible and after the first second). Canvas hidden; CSS grid background; no physics, scramble or stagger. Never climbs back up in a session.
- **LITE**: ≤ 4 cores, ≤ 4 GB device memory, or Save-Data. DPR 1, one particle layer, no shockwave.
- **FULL**: everything else; DPR capped at 1.5. Rendering pauses while the tab is hidden.
- `?fx=full|lite|static` forces a tier for testing (also skips the watchdog and allows software WebGL). Reduced motion still wins.

## Conventions
- **Content is visible without JS.** Any hidden-then-revealed state is gated behind `html.js` (or a class JS adds, e.g. `.term.ready`, `.log-list.enhanced`). Never ship `opacity: 0` content that only JS reveals.
- **Adding a tool:** add one entry to `TOOLS` in `assets/js/catalog.js` (`name, host, status, url, version, category, hue, image, summary, description`, optional `size`, `sha256`). The homepage grid, field log, palette, terminal `ls ./tools` and downloads page all pick it up. `node tools/check-catalog.mjs` fails if an inline `TOOLS`/`DOWNLOADS` array reappears in either page.
- **Field log** (`index.html#log`): static `<li class="log-entry" data-type="case|project|writeup|campaign">` entries; tool releases are added from the catalog. Real content only — no placeholder entries or invented dates.
- **Homepage page links:** the old `ITEMS` grid is now static markup in the teardown layers; `check-site.mjs` asserts every one of its links (mission, get-involved, repair-guides, legislation, repair-cafes, talks, writing, downloads) is still on the homepage.
- Unfinished links use `href="#"` with a `.note` callout.
- The header avatar is hotlinked from `https://github.com/NickHarrison96.png?size=96` (kept on purpose). Runtime external requests are limited to Google Fonts and that avatar; zero third-party scripts.
- Design tokens are `:root` custom properties at the top of `styles.css` (`--bg #05070d`, `--card #0c101a`, `--border #172033`, `--brand #38bdf8`, `--neon #00f0ff`). Inter for UI/headings, JetBrains Mono for labels/terminal/code.
- Icons are inline SVG (Lucide/Heroicons style) with `aria-hidden="true"`; icon-only controls carry `aria-label`. Text ≥ 11px, 44px tap targets on mobile, visible `:focus-visible` rings.
- Line endings: commit each file with the line endings it already has in `HEAD` (some pages are CRLF, others LF). Stage files by path; a working tree that picked up CRLF-only changes must not be committed wholesale.

## Checks (dev-only, `tools/`)
Run from the repo root:
```sh
node tools/check-catalog.mjs                 # catalog is the single source
node tools/check-site.mjs                    # shell, links, a11y basics, fonts, verbatim copy, fx-config values
cd tools && npm ci && npx playwright install chromium && node smoke.mjs   # browser smoke, 1440 + 390 wide
node smoke.mjs --perf                         # frame-time report (not a gate); add --headed for the real GPU
```
`--phase=N` on `check-site.mjs` / `smoke.mjs` runs only what existed by phase N of the redesign plan; `--selftest` proves the static detectors work. `tools/node_modules/` is gitignored and nothing in `tools/` is loaded by the site.

## Secrets
- **No token may ever appear in a tracked file.** `selfhost.local.js` holds a local `window.SELF_HOST_API_OVERRIDE` and is gitignored for this reason — the committed default is the Worker's `*.workers.dev` address, which is public and carries no secret. It must stay a classic `<script>` that runs before the downloads module.
- The self-host access token lives as the encrypted Worker secret `UPSTREAM_TOKEN`; see `~/Documents/Github/selfhost`.
- A token was once committed in `downloads.html` and had to be rotated out of band after the history was rewritten with `git filter-repo`. Don't repeat it. Before committing, sweep (both must print nothing):
  ```sh
  git grep -n <token-from-selfhost/.env> HEAD
  ! git grep -n -I -E "(gh[p]_|github_[p]at_|Bearer [A-Za-z0-9]{20,})" HEAD -- . ':!docs'   # exit 0 = clean
  ```
  The bracketed patterns match real tokens but not their own text; keep them bracketed in any tracked file.

## Layout gotchas (learned the hard way)
- `main` is pinned to `width: 100%; max-width: 1200px`. downloads.html carries long model filenames like `Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-IQ3_M-patched.gguf`; their `white-space: nowrap` once pushed the page to 772px and overflowed mobile. **If you add a new unwrappable string, check narrow widths.** Truncation via `.host-name`'s `text-overflow: ellipsis` is the intended behaviour; don't "fix" it with `overflow-wrap: anywhere` (wraps filenames on desktop too).
- **Never put `overflow-x: hidden` on `html` or `body`.** It hides real overflow from the 390px check (`scrollWidth − clientWidth`), which `smoke.mjs` relies on and asserts. Clip decorative layers locally instead (marquee, stack stage).
- Grid children that hold long text need `minmax(0, 1fr)`, not `1fr` (the footer once overflowed 390px by 23px this way).
- `[hidden]` is forced to `display: none !important`, because component `display` rules would otherwise override the attribute.
- A hidden element can keep focus in Chrome; blur before hiding (the palette does), or keystrokes keep going to it.

## Preview
- Serve over HTTP: `python -m http.server 8123`, then open http://localhost:8123/. ES modules do not run from `file://`.
- Playwright's viewport emulation does reach 390px (the ~495px clamp only applies to a real headless window), but still measure geometry via JS rather than trusting screenshots, and confirm on a real phone.
- Screenshots: pass `?fx=static` (or emulate reduced motion) for a still image; skip the boot splash with `sessionStorage.setItem('nh-booted','1')` or a `#hash`.

## Deploy
- Push to `main`. Pages serves the repo root (legacy build, no workflow) at https://nickharrison96.github.io/.
- Pages caches hard: hard-refresh or use a private window. Asset changes can take ~45s to appear.
