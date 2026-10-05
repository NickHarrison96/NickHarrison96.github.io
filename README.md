# NickHarrison96.github.io

Static, dependency-free site for **Harrison Technology Solutions** — the Right to Repair campaign and free repair/diagnostics software built by Nicholas Harrison.

No build step, no package manager, no dependencies. Deploy the folder as-is to any static host.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Landing page. Carousel, work grid (from the `ITEMS` array), and the inline Free Tools grid (from `TOOLS`). All page JS lives inline in this file. |
| `downloads.html` | Download catalog. Cards render from the `DOWNLOADS` array; split into always-available GitHub releases and self-hosted files gated by a live status light. |
| `about.html` | Who the company is and what it does. |
| `team.html` | The three people behind it. |
| `socials.html` | Contact links. |
| `mission.html` | Mission statement. |
| `get-involved.html`, `legislation.html`, `repair-guides.html`, `repair-cafes.html`, `talks.html`, `writing.html` | Campaign sub-pages. |

Every page shares `styles.css` and the same shell: brand link home, top nav, `.card.subpage` → `.page-hero` + `.prose`, shared footer. Edit the design in `styles.css` once and it applies everywhere.

## Conventions

- Design tokens live in `:root` at the top of `styles.css`: near-black background, blue→purple glow, Syne (display) + DM Sans (body).
- Adding a tool: add an entry to `DOWNLOADS` in `downloads.html`. Mirror it in `TOOLS` in `index.html` if it should also appear on the landing page.
- Adding a work card: add an entry to `ITEMS` in `index.html` (icon / hue / title / href / desc) and create a matching sub-page.
- No dead links. Every `href` resolves to a real page or a real external URL.
- Icons are inline SVG, Heroicons-style, 24×24 stroke.

## Preview

```sh
python -m http.server 8123
```

Then open http://localhost:8123/.

Avoid `file://` — the inline JS is wrapped in a `load` handler, so nothing renders from the filesystem. To verify layout, read DOM geometry via JS rather than trusting scaled screenshots.

## Deploy

Push to `main`. GitHub Pages serves the repo root at https://nickharrison96.github.io/.

Pages caches aggressively through its CDN — hard-refresh (Ctrl+Shift+R) or open in a private window after pushing.