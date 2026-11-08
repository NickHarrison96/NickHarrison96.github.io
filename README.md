# Harrison Technology Solutions — static foundation

Source for nickharrison96.github.io (GitHub Pages). All rendered pages work with HTML/CSS alone; the decorative module is optional. There is no framework, package build or external runtime dependency.

## Edit and build

- `content/*.html`: body fragments only; preserve meaningful headings and accessible links. These are trusted authored content, not a place to paste unknown uploaded scripts.
- `pages.json`: page filename, title, description, primary section (`main`, `writeups`, `tutorials`), visual variant (`home`, `index`, `article`) and draft status.
- `build.py`: one shared document shell, header/navigation/footer and decorative-layer source. Run `python3 build.py` from any directory. Generated root HTML can be served directly by any static host, including GitHub Pages; no deployment is configured.
- `styles.css`: shared tokens, components, responsive rules and intentional static/accessibility fallbacks.
- `assets/motion.js`: optional cybernetic motion controller, isolated from all content and link behavior. Bounded pointer springs stop after settling; slow CSS energy routes continue only while the visible system is enabled. No external library, telemetry or sign-in.

To add a page: create a fragment in `content/`, add one manifest entry with a relative root filename, use exactly one h1, choose the active primary section, then run the generator and tests. A new primary navigation destination must be changed once in `build.py` and in the navigation test contract. Use `writeup-template.html` or `tutorial-template.html` content as a starting structure; replace all draft placeholders before publishing and remove draft status only after review. Templates are noindex and deliberately absent from indexes.

To add a write-up/tutorial: create its fragment and manifest entry, then add a real source-backed entry to the respective index fragment. Do not invent dates, steps, videos or results. Media placeholders are intentionally noninteractive; only replace them when real media and accessible alternatives exist. Keep Main brief and free of article cards.

## Local preview and tests

Run `python3 -m http.server 8000 --directory /workspace/site-fresh` for an optional local preview. No preview server is required by the automated tests.

Static check (standard library): `python3 tools/test_static.py`.
Full headless checks in the prepared box environment: `/workspace/site-test-venv/bin/python tools/test_browser.py`. This requires Playwright, BeautifulSoup, Chromium and axe-core; the latter is read locally at `/workspace/site-test-tools/node_modules/axe-core/axe.min.js`, overridable with `AXE_PATH`. Python executable overrides are not needed if those packages are installed in another environment. Tests create and shut down their own loopback server. Outputs go to `/workspace/site-fresh-shots/` by default, overridable with `SHOTS_DIR`.

The browser suite covers all routes, active nav, local assets/fragments, generated output determinism, axe, keyboard skip links, image loads, no JS, pointer interaction and spring idle stop, continuous CSS energy lifecycle, keyboard pause/persistence, hidden/offscreen gates, preference fallbacks, stationary content, narrow reflow and enlarged text. It reports callback timings and a sampled Chromium renderer task/style/layout window as observations, not a device-independent frame-rate guarantee. Results are saved as `cyber-checks.json`, with `cyber-*` screenshots and a short generated WebM for human review; generated video is not automatically a watched/validated recording. Screen-reader/manual keyboard journeys, non-Chromium browsers, real touch hardware and real zoom remain separate manual checks.

## Content provenance / review

Established APFS content comes from `/workspace/content/apfs-article.md`, checked against `/workspace/apfs-recovery-source.html`; team identities and biographical facts come from `/workspace/about-source.html`; current bios are shortened to preserve names, roles and sourced research/operational responsibilities without services marketing. Main scope and consumer-freedom language reflect Nick's direct instructions. APFS source assertions are retained, not independently validated: review disk1/disk3 identifiers, symptoms, trust warning, ownership rationale and final migration/cleanup before publication. The safety note is general caution, not a promise of recovery.

New uploaded HTML/TXT materials are **deferred by Nick until the foundation is laid**. None are imported, executed, linked as published tutorials or used to replace established content. Tutorials currently has an honest empty state. Preserve those originals outside this directory; review them separately before any future use.

## Research-only scope

This is a self-contained security-research / notes / articles / tutorials website. Main and About describe research, open-source projects and shared learning. The APFS article is a technical data-recovery case study. There is no services offering, second-business section, future crossover plan or speculative external destination. Original exported source files remain unchanged outside this directory.

Scope boundary: no teardown, disassembly, hardware-service content or imagery. Software bootloader and data-recovery research remain in scope. Supplied branding uses a plain data node, not a screw or tool motif.

## Cybernetic motion system

The approved medium-intensity theme uses a custom `assets/cyber-field.svg`, navy layered surfaces, illuminated abstract data routes, slow traveling energy segments and a bounded pointer-responsive light/depth plane. No text or control moves with it; the long article column stays opaque and quiet. There are no pseudo-statistics or native-input interception.

`Motion On/Off` is a shared native button in the header. Its pressed state means decorative motion is enabled; On/Off is explicit and stored under `hts-ambient-motion` when localStorage is available. The button has a stable-sized state label, keyboard Space/Enter behavior and visible focus. Off pauses CSS clocks, hides traveling segments and cancels/resets pointer springs. If storage is blocked, the button still works for that page; the system does not claim persistence in that case.

System reduced motion always wins, including runtime changes and a previously stored On preference. Reduced motion, forced colors and coarse-pointer/touch modes disable the button with a visible Reduced/Static state and never autoplay. No-JS hides the nonfunctional toggle and keeps an intentional static design. CSS energy animations default to paused and only run with the module’s `.motion-active` class; there is no animation flash before initialization. IntersectionObserver, document visibility and page lifecycle pause both CSS and pointer effects when offscreen/hidden. User Off is never automatically reset by navigation.

Energy segments take 8–12 seconds per route; node/core intensity changes are smooth 6–7 second envelopes, never flashing or strobing. Animation is confined to the decorative region. The optional pointer rAF loop is event-triggered and stops at rest; active CSS energy animation is intentional and is not represented as idle JavaScript work.
