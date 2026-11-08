# Harrison Technology Solutions — static foundation

This directory is standalone and not a checkout. No git, publishing or deployment is performed here. All rendered pages work with HTML/CSS alone; the decorative module is optional. There is no framework, package build or external runtime dependency.

## Edit and build

- `content/*.html`: body fragments only; preserve meaningful headings and accessible links. These are trusted authored content, not a place to paste unknown uploaded scripts.
- `pages.json`: page filename, title, description, primary section (`main`, `writeups`, `tutorials`), visual variant (`home`, `index`, `article`) and draft status.
- `build.py`: one shared document shell, header/navigation/footer and decorative-layer source. Run `python3 build.py` from any directory. Generated root HTML can be served directly by any static host, including GitHub Pages; no deployment is configured.
- `styles.css`: shared tokens, components, responsive rules and intentional static/accessibility fallbacks.
- `assets/motion.js`: optional immersive-atmosphere motion controller, isolated from all content and link behavior. Bounded pointer springs stop after settling; slow transform-only artwork drift continues only while the visible system is enabled. No external library, telemetry or sign-in.

To add a page: create a fragment in `content/`, add one manifest entry with a relative root filename, use exactly one h1, choose the active primary section, then run the generator and tests. A new primary navigation destination must be changed once in `build.py` and in the navigation test contract. Use `writeup-template.html` or `tutorial-template.html` content as a starting structure; replace all draft placeholders before publishing and remove draft status only after review. Templates are noindex and deliberately absent from indexes.

To add a write-up/tutorial: create its fragment and manifest entry, then add a real source-backed entry to the respective index fragment. Do not invent dates, steps, videos or results. Media placeholders are intentionally noninteractive; only replace them when real media and accessible alternatives exist. Keep Main brief and free of article cards.

## Local preview and tests

Run `python3 -m http.server 8000 --directory /workspace/site-fresh` for an optional local preview. No preview server is required by the automated tests.

Static check (standard library): `python3 tools/test_static.py`.
Full headless checks in the prepared box environment: `/workspace/site-test-venv/bin/python tools/test_browser.py`. This requires Playwright, BeautifulSoup, Chromium and axe-core; the latter is read locally at `/workspace/site-test-tools/node_modules/axe-core/axe.min.js`, overridable with `AXE_PATH`. Python executable overrides are not needed if those packages are installed in another environment. Tests create and shut down their own loopback server. Outputs go to `/workspace/site-fresh-shots/` by default, overridable with `SHOTS_DIR`.

The browser suite covers all routes, active nav, local assets/fragments, generated output determinism, axe, keyboard skip links, image loads, no JS, pointer interaction and spring idle stop, continuous CSS atmosphere lifecycle, keyboard pause/persistence, hidden/offscreen gates, preference fallbacks, stationary content, narrow reflow and enlarged text. It reports callback timings and a sampled Chromium renderer task/style/layout window as observations, not a device-independent frame-rate guarantee. Results are saved as `immersive-checks.json`, with `immersive-*` screenshots and a short generated WebM for human review; generated video is not automatically a watched/validated recording. Screen-reader/manual keyboard journeys, non-Chromium browsers, real touch hardware and real zoom remain separate manual checks.

## Content provenance / review

Established APFS content comes from `/workspace/content/apfs-article.md`, checked against `/workspace/apfs-recovery-source.html`; team identities and biographical facts come from `/workspace/about-source.html`; current bios are shortened to preserve names, roles and sourced research/operational responsibilities without services marketing. Main scope and consumer-freedom language reflect Nick's direct instructions. APFS source assertions are retained, not independently validated: review disk1/disk3 identifiers, symptoms, trust warning, ownership rationale and final migration/cleanup before publication. The safety note is general caution, not a promise of recovery.

New uploaded HTML/TXT materials are **deferred by Nick until the foundation is laid**. None are imported, executed, linked as published tutorials or used to replace established content. Tutorials currently has an honest empty state. Preserve those originals outside this directory; review them separately before any future use.

## Research-only scope

This is a self-contained security-research / notes / articles / tutorials website. Main and About describe research, open-source projects and shared learning. The APFS article is a technical data-recovery case study. There is no services offering, second-business section, future crossover plan or speculative external destination. Original exported source files remain unchanged outside this directory.

Scope boundary: no teardown, disassembly, hardware-service content or imagery. Software bootloader and data-recovery research remain in scope. Supplied branding uses a plain data node, not a screw or tool motif.

## Immersive atmosphere system (current)

The approved current direction is documented in `docs/immersive-design.md` and `docs/immersive-implementation-plan.md`. It replaces the bounded cybernetic illustration with page-wide original flowing blue/cyan/violet ribbons and contours, sparse data marks, oversized white hierarchy and an explicitly stacked narrow-screen header. The supplied logo is unchanged. Artsy's supplied data-node tile is copied to `assets/data-field.svg`; the original fluid assets are `assets/atmosphere-flow.svg` and `assets/atmosphere-filaments.svg`. The page owns its artwork locally, with no external runtime/art dependencies. No green, red or pink accent is permitted. No artwork, text or identity is copied from the reference website.

The content source fragments are unchanged by this visual pass, including the exact approved Main introduction. `tools/content-baseline.json` records their SHA-256 hashes for regression checks. Intentional future content edits require reviewing and updating that baseline, not weakening the exact approved-copy assertion without approval. Article art stays in the header band; the long reading column, code and logs remain opaque and quiet. No new homepage sections or panels are added.

`Motion On/Off` remains a native keyboard-operable button. Its pressed state represents the user's enabled preference, stored under `hts-ambient-motion` when storage is available. System reduced motion has priority, including runtime changes and a previously stored On preference. Coarse/touch and forced-color modes remain static and show a disabled Static/Reduced control. No-JS hides the nonfunctional control and presents the static artwork.

Only whole static SVG image/data layers move: slow 42–54-second bounded transform cycles plus a small event-triggered pointer spring. No animated SVG path geometry, gradient stops, blur, turbulence, shader or canvas is used. Layer drift is transform-only, not repeated full-screen paint driven by JavaScript. CSS animation starts paused and runs only with the eligible visible `.motion-active` region; hidden/offscreen/page lifecycle states pause it and reset/cancel pointer rAF. User Off persists across navigation. No text, link, button or focus ring tracks the pointer. There is no cursor replacement or scroll interception.

Current test outputs are `immersive-*` screenshots and `immersive-checks.json` in `/workspace/site-fresh-shots/`. A short generated toggle/pointer capture is saved to `/workspace/immersive-main-motion-review.webm` for later human review; generation does not mean it was manually watched. Tests report measured callback and renderer-window cost without claiming FPS, GPU coverage or real-device behavior.
