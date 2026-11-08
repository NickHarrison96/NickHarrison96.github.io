# NickHarrison96.github.io

Static, dependency-free site for **Nick Harrison** — systems & AI engineering write-ups and projects, the Right to Repair campaign, and the free repair/diagnostics software he builds (Harrison Technology Solutions).

No build step and no runtime dependencies: plain HTML, one stylesheet, and native ES modules. Deploy the folder as-is to any static host.

**Live:** https://nickharrison96.github.io/

## Pages

| File | Purpose |
|---|---|
| `index.html` | Overview: live terminal, featured work, latest writing, Right to Repair teardown, free tools (from the catalog). |
| `work.html` | **Work** hub: the projects (from `assets/js/projects.js`). |
| `writing.html` | **Writing** hub: featured APFS case study, essays, field log, manifesto. |
| `apfs-recovery.html` | Full case study: surgical recovery of a corrupted macOS installation (under Writing). |
| `repair.html` | **Right to Repair** hub: mission, legislation, get involved, repair guides, repair cafés, talks. |
| `downloads.html` | **Tools** hub: download catalog (from the shared catalog) plus the live Host Folder listing. |
| `about.html` | **About** hub: company, team, socials. |
| `mission.html`, `legislation.html`, `get-involved.html`, `repair-guides.html`, `repair-cafes.html`, `talks.html`, `team.html`, `socials.html` | Redirect stubs to the sections those pages moved into, so old links keep working. |

Every real page shares `styles.css` and the same header/footer shell (checked byte-for-byte by `tools/check-site.mjs`).

## How it's built

- **Dark-glass design**: near-black grid, sky-blue glow, glass panels; Inter + JetBrains Mono.
- **GPU background**: a hand-written WebGL shader (`assets/js/fx-gravity.js`) — neon grid, drifting particles, a gravity lens around the cursor and click shockwaves. No three.js, no GSAP, no CDN scripts.
- **UI physics**: magnetic buttons and tilting cards on springs (`assets/js/fx-physics.js`).
- **Extras**: interactive terminal (try `help`), ⌘K / Ctrl+K search, a boot splash on first visit, and a Konami-code "jailbreak mode".
- **Degrades gracefully**: FULL → LITE → STATIC tiers on `<html data-fx>`; reduced motion or no WebGL gives a static page, and every section reads fine without JavaScript.
- All effect constants live in `assets/js/fx-config.js`.

## Downloads

- **GitHub-hosted** — release assets or branch archives in public repos. Always available.
- **Host Folder** — large files served from a home server behind a Cloudflare Worker. The section renders from a live JSON listing; a status dot shows whether the server is reachable.

The Worker is **public by design** and the access token never touches this repository: `downloads.html` only contains the Worker's public `*.workers.dev` address, and the Worker injects the token server-side. The server lives in the private repo `NickHarrison96/selfhost`.

**Adding a tool:** add one entry to `TOOLS` in `assets/js/catalog.js`. The homepage, field log, search palette, terminal and downloads page all read from it. Projects work the same way through `PROJECTS` in `assets/js/projects.js` (see `AGENTS.md`).

## Checks

```sh
node tools/check-catalog.mjs
node tools/check-site.mjs        # includes the five-hub IA checks (tools/check-ia.mjs)
cd tools && npm ci && npx playwright install chromium && node smoke.mjs
node smoke.mjs --perf --headed   # frame-time report on your own GPU
```

`tools/` is dev-only (Playwright is pinned in `tools/package.json`); nothing there is served or loaded by the site.

## Security

Nothing secret belongs in a tracked file. A local override for the self-host origin goes in `selfhost.local.js`, which is gitignored. Before committing anything that touches download config, run the token sweeps in `AGENTS.md` (Secrets).

## Preview

```sh
python -m http.server 8123
```

Then open http://localhost:8123/. ES modules don't run from `file://`. Add `?fx=static` for still screenshots. Layout notes and known traps are in `AGENTS.md`.

## Deploy

Push to `main`. GitHub Pages serves the repo root at https://nickharrison96.github.io/ (legacy build — no Actions workflow). Pages caches aggressively: hard-refresh or use a private window; changes can take ~45s to appear.
