# NickHarrison96.github.io

Static, dependency-free site for **Harrison Technology Solutions** — the Right to Repair campaign and free repair/diagnostics software built by Nicholas Harrison.

No build step, no package manager, no dependencies. Deploy the folder as-is to any static host.

**Live:** https://nickharrison96.github.io/

## Pages

| File | Purpose |
|---|---|
| `index.html` | Landing page. Carousel, work grid (from the `ITEMS` array), and the Free Tools grid (from the `TOOLS` array). All page JS lives inline here. |
| `downloads.html` | Download catalog. Cards render from the `DOWNLOADS` array, split into always-available GitHub releases and a live Host Folder section. |
| `about.html` | Who the company is and what it does. |
| `team.html` | The three people behind it. |
| `socials.html` | Contact links. |
| `mission.html` | Mission statement. |
| `get-involved.html`, `legislation.html`, `repair-guides.html`, `repair-cafes.html`, `talks.html`, `writing.html` | Campaign sub-pages. |

Every page shares `styles.css` and the same shell: brand link home, top nav, `.card.subpage` → `.page-hero` + `.prose`, shared footer. Edit the design in `styles.css` once and it applies everywhere.

## Downloads

Two kinds of download, served two different ways:

- **GitHub-hosted** — direct links to releases or branch archives in public repos. Always available, no server involved.
- **Host Folder** — large files (multi-GB model files, firmware, archives) served from a home server behind a Cloudflare Worker. The section renders itself from a live JSON listing, so dropping a file into the server's data folder makes it appear with no code change. A green status dot reflects whether the server is currently reachable.

The Worker is the site's only backend dependency and it is **public by design** — downloads require no account. The access token never touches this repository: `downloads.html` contains only the Worker's public `*.workers.dev` address, and the Worker injects the token server-side from an encrypted secret.

The server lives in a separate **private** repo, `NickHarrison96/selfhost`.

## Conventions

- Design tokens live in `:root` at the top of `styles.css`: near-black background, blue→purple glow, Syne (display) + DM Sans (body).
- Adding a tool means editing **two** places — `DOWNLOADS` in `downloads.html`, and `TOOLS` in `index.html` so it also shows on the landing page. These are duplicated by hand with nothing enforcing agreement, so check both. (BipPoyAI shipped on one page and silently missed the other because of this.)
- Adding a work card: add an entry to `ITEMS` in `index.html` (icon / hue / title / href / desc) and create a matching sub-page.
- No dead links. Every `href` resolves to a real page or a real external URL.
- Icons are inline SVG, Heroicons-style, 24×24 stroke.

## Security

Nothing secret belongs in a tracked file here. The site's default origin is the Worker's public address; a local override goes in `selfhost.local.js`, which is gitignored. A token was once committed in `downloads.html` and had to be rotated out of band after rewriting history — before committing anything that touches download config, sweep for the live token:

```sh
git grep -n <token-from-selfhost/.env> HEAD   # must print nothing
```

## Preview

```sh
python -m http.server 8123
```

Then open http://localhost:8123/.

Avoid `file://` — the inline JS is wrapped in a `load` handler, so nothing renders from the filesystem.

**Verifying layout:** read DOM geometry via JS rather than trusting screenshots. Two traps worth knowing:

- Headless Chrome clamps its window to a ~495px minimum, so it cannot reproduce a real 360–430px phone viewport. Check `documentElement.scrollWidth - clientWidth` and confirm on a real device.
- Screenshots catch the page mid-animation behind the splash loader and scroll-reveals. Force `opacity: 1` in a throwaway copy to get a usable image.

`.page` is a centered column flex, so children size to fit-content rather than the viewport — any content with a large unbreakable minimum width will overflow narrow screens. `main` is pinned to `max-width: 1200px` to prevent that. Long filenames truncate with an ellipsis by design; see `AGENTS.md`.

## Deploy

Push to `main`. GitHub Pages serves the repo root at https://nickharrison96.github.io/ (legacy build — no Actions workflow).

Pages caches aggressively through its CDN: hard-refresh (Ctrl+Shift+R) or open in a private window. Asset changes can take ~45s to appear.