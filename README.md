# Harrison Technology Solutions — static foundation

This directory is standalone and not a checkout. No git, publishing or deployment is performed here. All rendered pages work with HTML/CSS alone; the decorative module is optional. There is no framework, package build or external runtime dependency.

## Edit and build

- `content/*.html`: body fragments only; preserve meaningful headings and accessible links. These are trusted authored content, not a place to paste unknown uploaded scripts.
- `pages.json`: page filename, title, description, primary section (`main`, `writeups`, `tutorials`), visual variant (`home`, `index`, `article`) and draft status.
- `build.py`: one shared document shell, header/navigation/footer and decorative-layer source. Run `python3 build.py` from any directory. Generated root HTML can be served directly by any static host, including GitHub Pages; no deployment is configured.
- `styles.css`: shared tokens, components, responsive rules and intentional static/accessibility fallbacks.
- `assets/motion.js`: optional event-driven decorative springs, isolated from all content and link behavior. No external library, telemetry, sign-in or perpetual animation.

To add a page: create a fragment in `content/`, add one manifest entry with a relative root filename, use exactly one h1, choose the active primary section, then run the generator and tests. A new primary navigation destination must be changed once in `build.py` and in the navigation test contract. Use `writeup-template.html` or `tutorial-template.html` content as a starting structure; replace all draft placeholders before publishing and remove draft status only after review. Templates are noindex and deliberately absent from indexes.

To add a write-up/tutorial: create its fragment and manifest entry, then add a real source-backed entry to the respective index fragment. Do not invent dates, steps, videos or results. Media placeholders are intentionally noninteractive; only replace them when real media and accessible alternatives exist. Keep Main brief and free of article cards.

## Local preview and tests

Run `python3 -m http.server 8000 --directory /workspace/site-fresh` for an optional local preview. No preview server is required by the automated tests.

Static check (standard library): `python3 tools/test_static.py`.
Full headless checks in the prepared box environment: `/workspace/site-test-venv/bin/python tools/test_browser.py`. This requires Playwright, BeautifulSoup, Chromium and axe-core; the latter is read locally at `/workspace/site-test-tools/node_modules/axe-core/axe.min.js`, overridable with `AXE_PATH`. Python executable overrides are not needed if those packages are installed in another environment. Tests create and shut down their own loopback server. Outputs go to `/workspace/site-fresh-shots/` by default, overridable with `SHOTS_DIR`.

The browser suite covers all routes, active nav, local assets/fragments, generated output determinism, axe, keyboard skip links, image loads, no JS, pointer interaction and idle stop, hidden/offscreen gates, preference fallbacks, stationary content, narrow reflow and enlarged text. It reports callback timings as observations, not a device-independent frame-rate guarantee. Screen-reader/manual keyboard journeys, non-Chromium browsers, real touch hardware and real zoom remain separate manual checks.

## Content provenance / review

Established APFS content comes from `/workspace/content/apfs-article.md`, checked against `/workspace/apfs-recovery-source.html`; team biographies come from `/workspace/about-source.html`. Main scope and consumer-freedom language reflect Nick's direct instructions. APFS source assertions are retained, not independently validated: review disk1/disk3 identifiers, symptoms, trust warning, ownership rationale and final migration/cleanup before publication. The safety note is general caution, not a promise of recovery.

New uploaded HTML/TXT materials are **deferred by Nick until the foundation is laid**. None are imported, executed, linked as published tutorials or used to replace established content. Tutorials currently has an honest empty state. Preserve those originals outside this directory; review them separately before any future use.
