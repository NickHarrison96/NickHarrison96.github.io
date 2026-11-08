# AGENTS.md

Static, dependency-free personal site (Right to Repair landing page for Nicholas Harrison). No build step — deploy the folder as-is.

## Architecture
- Every page shares `styles.css`; edit the design there once and it applies everywhere.
- `index.html` = landing page + all inline JS (loader, carousel, mouse-trail, the `ITEMS` work grid, and the `TOOLS` free-tools grid).
- Sub-pages (`mission.html`, `get-involved.html`, `repair-guides.html`, `legislation.html`, `repair-cafes.html`, `talks.html`, `writing.html`, `about.html`, `team.html`, `socials.html`) are static, use `<body class="sub">`, and share one shell: brand links home, `.card.subpage` → `.page-hero` + `.prose`, shared footer.
- `downloads.html` renders two sections from the `DOWNLOADS` array: GitHub-hosted cards, and a Host Folder section that fetches a live JSON listing from a Cloudflare Worker.

## Conventions
- New work card: add an entry to `ITEMS` in `index.html` (icon/hue/title/href/desc) and create a matching sub-page.
- Unfinished links use `href="#"` with a `.note` callout; real URLs get filled in later.
- Header/footer GitHub avatar is hotlinked from `https://github.com/NickHarrison96.png`.
- Design tokens: near-black bg, blue→purple glow, Syne (display) + DM Sans (body).
- Icons are inline SVG, Heroicons-style, 24×24 stroke.

## The two catalogs must stay in sync
`DOWNLOADS` in `downloads.html` and `TOOLS` in `index.html` are **duplicated by hand** and nothing enforces agreement. This is not hypothetical — BipPoyAI shipped on the downloads page and silently missed the homepage because of it.

When adding a tool, update **both**:
- `DOWNLOADS` (`downloads.html`) — `name`, `status`, `url`, `version`, `category`, `hue`, `image`, `description`
- `TOOLS` (`index.html`) — same values as `name`, `version`, `hue`, `img`, `href`, `desc`

Fields differ slightly: `image`/`img`, `url`/`href`, `description`/`desc`. The real fix is a shared module both pages import; until then, verify both were edited before committing.

## Secrets
- **No token may ever appear in a tracked file.** `selfhost.local.js` holds a local `window.SELF_HOST_API_OVERRIDE` and is gitignored for this reason — the committed default is the Worker's `*.workers.dev` address, which is public and carries no secret.
- The self-host access token lives as the encrypted Worker secret `UPSTREAM_TOKEN`; see `~/Documents/Github/selfhost`.
- A token was once committed in `downloads.html` and had to be rotated out of band after the history was rewritten with `git filter-repo`. Don't repeat it. Before committing, sweep for it:
  ```sh
  git grep -n <token-from-selfhost/.env> HEAD   # must print nothing
  ```

## Layout gotchas (learned the hard way)
- **`.page` is `display: flex; flex-direction: column; align-items: center`**, so children size to **fit-content**, not the viewport. Any page whose content has a large unbreakable minimum width will overflow narrow screens. `main` is pinned to `width: 100%; max-width: 1200px` (the same measure `.card` uses) specifically to prevent this — downloads.html carries long model filenames like `Qwen3.5-9B-The-Defiant-Fable-Uncnr-Heretic-NEO-MAX-MTP-IQ3_M-patched.gguf`, whose `white-space: nowrap` once pushed `main` to 772px and overflowed mobile by 139px. **If you add a new unwrappable string, check narrow widths.**
- Do **not** "fix" that overflow with `min-width: 0` on `main` (has no effect here — the sizing is cross-axis fit-content) or by wrapping `.host-name` with `overflow-wrap: anywhere` (fixes the overflow but makes filenames wrap to 2–3 lines even on wide desktop). Truncation via the existing `text-overflow: ellipsis` is the intended behaviour.

## Preview
- Serve over HTTP: `python -m http.server 8123`, then open http://localhost:8123/.
- Avoid `file://` and the in-app preview pane: file:// renders as a static snapshot (JS won't run) and the pane returned a 0×0 viewport when backgrounded.
- **Headless Chrome clamps its window to a ~495px minimum width**, so it cannot verify a real 360–430px phone viewport. To check mobile, measure DOM geometry via JS (`documentElement.scrollWidth - clientWidth`) rather than trusting scaled screenshots, and confirm on a real device before calling it fixed.
- Screenshots capture the page mid-animation: content is `opacity: 0` behind a splash loader and scroll-reveal observers. Inject a temporary `<style>` forcing `opacity: 1` into a **throwaway copy** to get a usable image — never edit the real file, and re-check the real file's encoding afterwards (a PowerShell rewrite can mangle UTF-8).

## Deploy
- Push to `main`. Pages serves the repo root (legacy build, no workflow) at https://nickharrison96.github.io/.
- Pages caches hard: hard-refresh or use a private window. Asset changes can take ~45s to appear.