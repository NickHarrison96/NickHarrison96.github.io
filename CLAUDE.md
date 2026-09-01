# CLAUDE.md

Static, dependency-free personal site (Right to Repair landing page for Nicholas Harrison). No build step — deploy the folder as-is.

## Architecture
- Every page shares `styles.css`; edit the design there once and it applies everywhere.
- `index.html` = landing page + all inline JS (loader, carousel, mouse-trail, and the work grid rendered from the `ITEMS` array in its `<script>`).
- Sub-pages (`mission.html`, `get-involved.html`, `repair-guides.html`, `legislation.html`, `repair-cafes.html`, `talks.html`, `writing.html`) are static, use `<body class="sub">`, and share one shell: brand links home, `.card.subpage` → `.page-hero` + `.prose`, shared footer.

## Conventions
- New work card: add an entry to `ITEMS` in `index.html` (icon/hue/title/href/desc) and create a matching sub-page.
- Unfinished links use `href="#"` with a `.note` callout; real URLs get filled in later.
- Header/footer GitHub avatar is hotlinked from `https://github.com/NickHarrison96.png`.
- Design tokens: near-black bg, blue→purple glow, Syne (display) + DM Sans (body).

## Preview
- Serve over HTTP: `python -m http.server 8123`, then open http://localhost:8123/.
- Avoid `file://` and the in-app preview pane: file:// renders as a static snapshot (JS won't run) and the pane returned a 0×0 viewport when backgrounded. To verify layout, read DOM geometry via JS rather than trusting scaled screenshots.
