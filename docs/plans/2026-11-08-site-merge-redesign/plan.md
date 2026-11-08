---
title: "Merge portfolio + R2R site, dark-glass redesign with GPU background and UI physics"
status: in-progress
created: 2026-11-08
size: large
---

## 요구사항

Design source: Claude Design canvas "Homepage mockup project", section 2a (merged site) `[confirmed: Nick, this session]`.
Content source: `nick_harrison_portfolio_engineering_write_ups.html` (Nick's own work, keep copy verbatim) + this repo's existing pages `[confirmed]`.
Effects source: Nick's pasted spec (GLSL cursor gravity warp, magnetic/spring UI, mouse-driven glow, perf guidelines) `[confirmed]`.

### Core
- R1 Merge the engineering portfolio (hero, live terminal, 3 project cards, APFS case study, ecosystem analysis, manifesto) into this site alongside the existing Right to Repair content `[confirmed]`.
- R2 Whole-site redesign to the dark-glass look (near-black grid, sky-blue glow, glass panels) via `styles.css`; all 13 pages (the 12 existing pages + the new `apfs-recovery.html`) get the new shell `[confirmed: Q2; count corrected per C1]`.
- R3 Typography: Inter (UI/headings) + JetBrains Mono (labels/terminal/code); Syne + DM Sans removed `[confirmed: Q3]`.
- R4 APFS case study lives on its own page; homepage shows a featured teaser + field-log entry `[confirmed: Q4]`.
- R5 Stay dependency-free, no build step: raw WebGL shader + hand-rolled spring physics, no three.js/GSAP/CDN scripts `[confirmed: Q1]`. Runtime external requests: Google Fonts stylesheet + GitHub avatar image, both existing today `[researched: grep *.html, 1; avatar kept: Nick]`.
- R6 Every existing page, URL, ITEMS/TOOLS/DOWNLOADS entry and the Cloudflare Worker host-folder listing keep working `[researched: AGENTS.md, 1]`.

### Effects (from the pasted spec, plus extras)
- FX1 Full-screen fixed WebGL canvas behind every page (`z-index:-1; pointer-events:none`): neon grid + drifting particles, radial gravity-warp lens around the cursor (smoothstep falloff), passing `u_mouse`, `u_resolution`, `u_time` `[confirmed: pasted spec]`.
- FX2 Click shockwave: a ring ripple that propagates through the warp field from the click point `[proposed]`.
- FX3 Magnetic buttons/CTAs: proximity pull with spring + damping, glow scales with closeness `[confirmed: pasted spec]`.
- FX4 Card tilt + cursor-tracking spotlight border via CSS custom properties (`--mx`, `--my`, `--glow`) `[confirmed: pasted spec "glow & energy"]`.
- FX5 Live terminal: typed commands (help, cat specs.json, recovery --status, ls ./tools, whoami, clear, open <page>), ↑/↓ history, Tab completion; unknown command → spring shake `[proposed]`.
- FX6 Site-wide ⌘K / Ctrl+K command palette over pages, projects, tools, case studies; full keyboard nav `[proposed]`.
- FX7 Text-decode "scramble" on section headings when they enter view `[proposed]`.
- FX8 OpenCore-style boot splash replacing the current loader: short boot log, once per session, skippable `[proposed]`.
- FX9 Konami code → "jailbreak mode" accent swap (sky→green phosphor, CRT scanlines) persisted per visitor `[proposed]`.
- FX10 Exploded-device teardown for the Right to Repair pillars (from canvas 1b/2a) `[confirmed: canvas]`.
- FX11 Field log with type filters + live search, staggered reveal; case-study timeline nodes light as you scroll `[confirmed: canvas]`.

### Non-functional
- N1 Frame budget: rAF-driven, DOM writes batched per frame, no layout reads inside mousemove `[confirmed: pasted spec]`.
- N2 Degradation tiers (see policy values): FULL → LITE → STATIC. `prefers-reduced-motion: reduce` forces STATIC for all motion `[confirmed: pasted spec]`.
- N3 Accessibility: visible focus rings, 44px touch targets on mobile, text ≥11px, 4.5:1 contrast, no hover-only actions, SVG icons with aria-hidden/labels `[researched: ui-ux-pro-max checklist, 1]`.
- N4 No horizontal overflow at 390px on any page (AGENTS layout gotcha) `[researched: AGENTS.md, 1]`.
- N5 No secret in any tracked file; token sweep before commit `[researched: AGENTS.md, 1]`.

### Policy values (single home: `assets/js/fx-config.js`)
| Key | Value | Source |
|---|---|---|
| warp.radius | 0.25 (UV units) | [confirmed: pasted spec] |
| warp.force | 0.08 | [confirmed: pasted spec] |
| grid.cells | 20 | [confirmed: pasted spec] |
| shockwave.speed / width / life | 1.2 / 0.04 / 1.6s | [proposed] |
| magnet.maxDist | 150px | [confirmed: pasted spec] |
| magnet.pull | 20px | [confirmed: pasted spec] |
| spring.stiffness / damping | 0.18 / 0.72 | [proposed] |
| tilt.maxDeg | 9 | [researched: canvas 2a, 1] |
| canvas.dprCap | 1.5 | [proposed] |
| tier.lite if | hardwareConcurrency <= 4 OR deviceMemory <= 4 OR saveData | [proposed] |
| tier.static if | reduced-motion OR WebGL init fails OR watchdog trips (below) | [proposed] |
| watchdog | median frame time > 24ms in a 2s window, 2 consecutive windows; samples only while `document.visibilityState === 'visible'` and only after the first 1000ms; a hidden tab resets the window | [proposed; gated per C4] |
| lite.dprCap / lite.particleLayers / lite.shockwave | 1.0 / 1 / off | [proposed] |
| boot.maxMs | 1200 | [proposed] |
| scramble.ms | 600 | [proposed] |

### Impact
Touches: `styles.css` (rewrite), all 13 `*.html` (shell), `index.html` (rebuild), `downloads.html` (catalog import), new `apfs-recovery.html`, new `assets/js/*`, new `tools/*` checks, `AGENTS.md`, `README.md`.

### Risks
- RK1 Working tree has 8 files modified by CRLF/LF only (`git diff --ignore-cr-at-eol` is empty). Committing them would bury real diffs. `[researched: git diff, 1]`
- RK2 GPU cost on weak laptops / phones → tiers + DPR cap + pause when tab hidden.
- RK3 ES modules don't run from `file://` — already unsupported per AGENTS (serve over HTTP).
- RK4 Scroll-reveal/opacity tricks hide content from screenshots and no-JS readers → content must be visible without JS (`.js` class gate).
- RK5 Hand-duplicated TOOLS/DOWNLOADS drift (already happened once) → fixed by shared module in Phase 1.
- RK6 The new header/footer are static markup copied into 13 pages (needed for no-JS readers), which recreates the RK5 drift class → `check-site.mjs` asserts the `<header class="site-header">` and `<footer class="site-footer">` blocks are byte-identical across all pages (sha256 after CRLF→LF) `[C7]`.

### Ambiguity sweep (elicitation §2) — where I looked
- State branches: FX tier switching mid-session (STATIC→never back up; LITE→STATIC on slow frames); palette open while terminal focused; boot splash vs deep link (`#hash`) → skip splash on deep link.
- Rules applying at once: reduced-motion + Konami (colors swap, no animation); magnetic + tilt on one element (forbidden: magnetic = buttons only, tilt = cards only); ⌘K vs browser/OS shortcut (preventDefault only when no text field outside the terminal is focused).
- Boundaries: `dist < radius` strict; `<= 4` cores inclusive → LITE.
- Rollback: one commit per phase; FX is one `<script type="module">` per page, so removing it returns a fully working static site.

## 결정

- P0 Libraries → hand-rolled WebGL + spring math, no deps (Nick: "Hand-rolled (Recommended)").
- P0 Scope → whole site in one pass (Nick: "Whole site (Recommended)").
- P0 Fonts → Inter + JetBrains Mono (Nick: "Inter + JetBrains Mono (Recommended)").
- P0 Case study → own page (Nick: "Own page (Recommended)").
- P1 default: line-ending-only changes (RK1) are left unstaged; only intended files get committed. Nick to confirm whether to add `.gitattributes` later.
- P1 default: carousel content is folded into the teardown stack's campaign layers; the carousel component is removed.
- P1 default: mouse-trail is replaced by the shader (FX1); not kept alongside it.
- P2 TODO: real write-ups/dates for the field log beyond the APFS case study (canvas entries were stand-ins).
- P3: ES modules under `assets/js/`, one entry `site.js` per page.
- P0 GitHub avatar → keep the github.com hotlink in the new header (Nick: "Keep the avatar"). R5 corrected: external requests at runtime = Google Fonts stylesheet + GitHub avatar image; still zero third-party scripts.
- ~~Execution → phase by phase on `redesign/dark-glass`, checks written first, stop after each phase for Nick's OK before committing (Nick: "Phase by phase here (Recommended)").~~ Superseded below.
- ~~Gate → plan edits C1–C7 held until the cross-engine review (`.git/cross-engine/redesign-plan/`) reaches a verdict (Nick: "Wait for 2nd engine").~~ Superseded below.
- **Execution (2026-11-08, replaces the two items above)** → run Phases 0–7 back to back, fully agent-driven, no check-ins between phases; still one commit per phase with checks written first (Nick: "spin up a secondary agent to complete the task uninterrupted fully agent driven"). The cross-engine review closed with one engine only (`99-verdict.md`); C1–C7 adopted; criterion 4 (RX 580 frame time) stays **unverified** and is reported as a measurement for Nick to run.
- C1 adopted → "13 pages" means 12 existing + `apfs-recovery.html`.
- C2 adopted → avatar kept (Nick); R5 lists Google Fonts + GitHub avatar as the only runtime external requests; zero third-party scripts.
- C3 adopted → token sweep is negated so exit 0 = pass (see 완료 조건).
- C4 adopted → watchdog gating in the policy table.
- C5 adopted → smoke command installs the Chromium build.
- C6 adopted → `check-catalog.mjs` targets only `TOOLS`/`DOWNLOADS`; `ITEMS` is out of its scope.
- C7 adopted → RK6 header/footer identity check.
- Agent default: files are committed with the line endings they have **in HEAD** (LF or CRLF per file), not the CRLF the working tree picked up, so RK1 noise never enters a commit. New files are LF.
- Agent default: the header must be byte-identical on every page, so `aria-current` is set by `site.js` at runtime instead of in markup.
- Agent default: canvas field-log entries and canvas tools (Diagnostics Suite, water-damaged board, etc.) were stand-ins and are **not** published. The field log is built from real content only: the APFS case study, the three projects, the catalog tools, the three essays on `writing.html`, and the campaign pages. No dates are shown because none are on record (P2 TODO stands).
- Agent default: canvas "campaign slot" placeholders are replaced by the existing carousel/ITEMS copy, verbatim.
- Agent default: the boot splash runs on `index.html` only (other pages count as deep links); decided before first paint by an inline `<head>` snippet so there is no flash; a CSS failsafe hides it at 1.4s even if `boot.js` never loads.
- Agent default: the "Under active development" banner and the self-drawing "hello" signature are dropped (not in design 2a).
- Agent default: secret-pattern literals never appear in tracked files outside `docs/` (the sweep would match its own documentation); AGENTS/README quote the sweep with bracketed patterns such as `gh[p]_`, which match real tokens but not themselves.
- Agent default: `check-site.mjs --phase=N` runs only the assertions introduced up to phase N so each phase can go green on its own; the completion run uses no flag (all assertions).
- Agent default: Playwright pinned to 1.63.0 (the version preinstalled in the cloud container used as the fallback runner) in `tools/package.json` + lockfile.
- Execution note: `npx playwright install chromium` is blocked in the device VM (proxy 403 on the browser CDN), so every smoke/perf run happened in the cloud container (Chromium + Playwright 1.63.0 preinstalled), against a copy of the same files. `npm ci` itself works in the VM.
- Execution note: the device bridge dropped mid-run (after Phase 1). Phases 2–7 were built and verified in the container, snapshotted per phase, then copied to the repo and committed one phase at a time once the bridge returned.
- Agent default: a watchdog trip goes straight to STATIC (policy table), not FULL→LITE first.
- Agent default: WebGL is requested with `failIfMajorPerformanceCaveat` (software GL → STATIC) unless `?fx=full|lite|static` forces a tier for testing; a forced tier also skips the watchdog so `--perf` can measure it.
- Agent default: `site.js` sets `<html data-ready="1">` once the palette and Konami listeners are wired; `smoke.mjs` waits for it (a slow shader compile had raced the first keypress). Effects now load after the UI modules.
- Agent default: header nav = /terminal /projects /case-study /repair /log /downloads; About, The Team, Socials, Writing, Case Studies, Philosophy move to the footer. Header + footer GitHub links → github.com/nickpharrison; avatar image stays NickHarrison96.png; team/socials page content links unchanged.
- Agent default: hero "View Repositories" → `#projects` (as in Nick's source page); teardown opens on layer 01; terminal captures Tab only when the input has text (keyboard users can still tab past an empty prompt).
- Correction (not a relaxation): check-site's "4 timeline phases" regex also counted `phase-tag` spans; it now counts `<li class="phase…">` only.
- **IA restructure (2026-11-08, Nick, final)** → (1) five hubs: header nav exactly Work · Writing · Right to Repair · Tools · About, plus the ⌘K search button and the GitHub avatar link (avatar hotlink and github.com/nickpharrison unchanged); the mobile menu shows the same five; the current hub is highlighted (apfs-recovery.html → Writing); header and footer stay byte-identical across real pages. (2) "Nick Harrison" everywhere in titles, meta, headers, footers and prose; URLs, email addresses, handles (NickHarrison96, nickharrison96.github.io) and repo links unchanged. Old campaign/team/socials URLs become redirect stubs; content moves verbatim into repair.html / about.html; the homepage field log and manifesto move to writing.html; projects get work.html driven by `assets/js/projects.js`.
- Agent default (IA): project cards stay static markup in index.html and work.html (readable without JS); `check-ia.mjs` asserts that markup equals `PROJECTS.map(projectCard)` and `--print-projects` regenerates it.
- Agent default (IA): stubs use `location.replace` (keeps an extra `#hash`) plus a meta refresh inside `<noscript>`, so the JS and no-JS redirects never race.
- Agent default (IA): the footer legal line keeps its year and tagline ("© 2026 Nick Harrison. Open Technical License. Right to Repair — built to be opened, fixed, and reused."); the homepage "All Downloads →" label became "All tools →" (the only renamed copy, listed in `RENAMED` in check-ia).

## 구현 계획

Work on branch `redesign/dark-glass`. One commit per phase. Nick pushes/deploys.

**Phase 0 — Prep**
1. `git switch -c redesign/dark-glass`; stage only intended files from here on (RK1).
2. Add `tools/` dev checks (Node, no runtime deps): `check-site.mjs`, `check-catalog.mjs`; `tools/smoke.mjs` uses Playwright from `tools/package.json` (dev-only, never loaded by the site). `tools/node_modules/` is gitignored; the browser build comes from `npx playwright install chromium` (C5).

**Phase 1 — Shared catalog (fixes RK5)**
3. `assets/js/catalog.js` exports `TOOLS` (single source with `name, status, url, version, category, hue, image, description`).
4. `index.html` and `downloads.html` import it; delete both inline arrays. `check-catalog.mjs` fails if either inline array returns.

**Phase 2 — Tokens + shell (whole site)**
5. Rewrite `styles.css`: tokens (`--bg #05070d`, `--card #0c101a`, `--border #172033`, `--brand #38bdf8`, `--neon #00f0ff`, glass, radii, spacing), Inter + JetBrains Mono, focus rings, reduced-motion block, glass header, marquee, footer, `.page`/`main` width rule preserved (N4).
6. Update the shared shell on all 13 pages: fonts link, header (terminal mark, NICK HARRISON / SYSTEMS & AI ENGINEER · RIGHT TO REPAIR, mono nav incl. /projects /case-study /repair /log), footer (Open Technical License, GitHub nickpharrison), `<canvas id="fx-bg">`, `<script type="module" src="assets/js/site.js">`.

**Phase 3 — Homepage rebuild (canvas 2a)**
7. Sections in order: marquee → hero + live terminal (neofetch verbatim) → projects (3 cards, verbatim) → featured case-study teaser → Right to Repair teardown (pillars + tools + notes layers) → field log (filters, search) → free tools (from catalog) → manifesto → footer.
8. Preserve every existing ITEMS link (mission, get-involved, repair-guides, legislation, repair-cafes, talks, writing, downloads) somewhere on the page.

**Phase 4 — Case study page**
9. `apfs-recovery.html`: full write-up verbatim (header, spec grid, incident breakdown, 4-phase timeline with copy buttons, ecosystem analysis, manifesto); scroll-lit timeline nodes; linked from hero CTA, palette, log, writing.html.

**Phase 5 — FX core**
10. `fx-config.js` (policy table above), `fx-tier.js` (FULL/LITE/STATIC detection, frame-time watchdog).
11. `fx-gravity.js`: raw WebGL fullscreen triangle, fragment shader = Nick's warp + particles + shockwave; DPR cap; pause on `visibilitychange`; STATIC = CSS gradient + grid, canvas hidden.
12. `fx-physics.js`: one rAF loop; pointer stored on move, rects cached on resize/scroll; magnetic springs for `.magnetic`, tilt + spotlight vars for `.tilt`; no-op in STATIC.

**Phase 6 — Interaction extras**
13. `terminal.js` (FX5), `palette.js` (FX6, index built from catalog + page list), `scramble.js` (FX7), `boot.js` (FX8), `konami.js` (FX9).

**Phase 7 — Docs + verification**
14. Update `AGENTS.md` (new architecture, catalog module replaces "keep two arrays in sync", fx config, tiers, check commands) and `README.md`.
15. Run all completion checks; Nick reviews on a real phone, then merges and pushes `main`.

### User journeys / states
- First visit: boot splash (≤1.2s, any key/click skips) → hero; repeat visits in the session skip it; deep links skip it.
- Terminal: idle → typing → run → output | unknown → shake + red line; ↑/↓ history; Tab completes.
- Palette: closed → open (focus input) → results / "No matches" → Enter navigates, Esc closes and returns focus.
- FX: FULL ↔ LITE (fewer particles, no shockwave) → STATIC (never returns up in the same session).
- Downloads host folder: existing loading/empty/error states unchanged.

### Credential inventory (elicitation §0)
- Have: read/write in the repo via the device shell; Node 22, git, npx in the VM.
- Don't have: push rights from this session, a real phone, a real GPU (cloud Chromium uses software GL). File delete in the repo was granted for the execution session. → plan stops at a local branch; Nick pushes; mobile sign-off is Nick's.

## 완료 조건

Run from the repo root.

- `node tools/check-catalog.mjs` (exit 0) — catalog is the only source; no inline `TOOLS`/`DOWNLOADS` arrays; `ITEMS` is out of scope (C6).
- `node tools/check-site.mjs` (exit 0) — all 13 pages exist; every page: links `styles.css`, has `#fx-bg` + `site.js`, zero external `<script src>`, all internal `href`s resolve, every `<img>` has `alt`, icon-only buttons have `aria-label`, no Syne/DM Sans references; `<header class="site-header">` and `<footer class="site-footer">` byte-identical across pages (C7).
- `! git grep -n -I -E "(gh[p]_|github_[p]at_|Bearer [A-Za-z0-9]{20,})" HEAD -- . ':!docs'` (exit 0 = pass; C3) + AGENTS.md's token sweep against `selfhost/.env` (Nick runs this one; the file is outside the repo).
- `cd tools && npm ci && npx playwright install chromium && node smoke.mjs` (exit 0; C5) — serves the site, then per page at 1440 and 390 wide: no console errors, `scrollWidth - clientWidth == 0`, terminal `help` prints output, ⌘K opens palette, reduced-motion emulation sets `data-fx="static"`, WebGL-disabled run sets `data-fx="static"` with content visible.
- Measured (not a pass/fail gate): `node smoke.mjs --perf` reports median frame time on index at 1440px; target ≤ 16.7ms in FULL tier on Nick's desktop.
- Manual attest (Nick): real-phone check of index, downloads, apfs-recovery.

## 검증 결과

Run 2026-11-08 by the executing agent. "VM" = Nick's repo through the device shell (Linux VM, Node 22.23.4); "container" = cloud container (Node 22.23.4, Chromium via Playwright 1.63.0, SwiftShader software GL, 2 cores). Both ran against the same files.

| Command | Where | Exit | Key output |
|---|---|---|---|
| `node tools/check-site.mjs --selftest` | container | 0 | 19 passed, 0 failed |
| `node tools/check-catalog.mjs --selftest` | container | 0 | 9 passed, 0 failed |
| `node tools/check-catalog.mjs` | container | 0 | 45 passed, 0 failed |
| `node tools/check-site.mjs` | container | 0 | 706 passed, 0 failed |
| `cd tools && npm ci` | VM | 0 | lockfile resolves playwright 1.63.0 (Phase 0) |
| `npx playwright install chromium` | VM | fail | "Failed to download Chrome for Testing … Download failure" — proxy 403 on the browser CDN in the VM |
| `node smoke.mjs` | container | 0 | 190 passed, 0 failed (13 pages × 1440/390, no console errors, overflow 0, no-JS content, reduced motion → static, WebGL off → static, `?fx=full` renders, terminal/palette/boot/konami) |
| `! git grep -n -I -E "(gh[p]_\|github_[p]at_\|Bearer [A-Za-z0-9]{20,})" HEAD -- . ':!docs'` | VM | 0 | prints nothing (Phase 0/1 run; re-run on the final HEAD pending, see below) |
| `git grep -n <token-from-selfhost/.env> HEAD` | — | not run | file is outside the repo; Nick runs it |
| `node smoke.mjs --perf` | container | 0 | detected tier: start=lite (2 cores) → watchdog → static, median 16.70 ms / p95 16.80 ms after the drop; forced `?fx=full`: median 150.00 ms / p95 200.00 ms on SwiftShader |

**Perf is a container measurement on software GL (SwiftShader, 2 cores), not a measurement on Nick's RX 580.** It shows the watchdog working (software-rendered LITE dropped to STATIC within the gated windows) and gives a worst case for FULL. Criterion 4 (≤ 16.7 ms FULL on the RX 580) is **unverified**: run `cd tools && node smoke.mjs --perf --headed` on the desktop.

Status stays `in-progress`: every agent-executable check passes, but the selfhost/.env token sweep, the RX 580 frame-time measurement and the real-phone attest are Nick's, and `npx playwright install chromium` could not run in the VM.

### Final re-run after all commits (2026-11-08, main session)

| Command | Where | Exit | Key output |
|---|---|---|---|
| `node tools/check-catalog.mjs` | VM, final tree | 0 | 45 passed, 0 failed |
| `node tools/check-site.mjs` | VM, final tree | 0 | 706 passed, 0 failed |
| `node tools/check-site.mjs --selftest` | VM | 0 | 19 passed, 0 failed |
| per-phase `--phase=N` checks before each commit (2–6) | VM | 0 | all green |
| `! git grep -n -I -E "(gh[p]_\|github_[p]at_\|Bearer [A-Za-z0-9]{20,})" -- . ':!docs'` | VM, final tree | 0 | prints nothing |
| `node tools/smoke.mjs` | container, content-identical copy | 0 | 190 passed, 0 failed |
| content identity VM vs container | both | — | all 39 shared files identical after CR normalisation; VM keeps each file's HEAD line endings |

Still open (Nick): selfhost/.env token sweep, RX 580 `smoke.mjs --perf --headed`, real-phone check.

### IA restructure checks

Five-hub restructure (2026-11-08, executing agent). Commit 1 adds the checks (red on their own), commit 2 the restructure. "VM" = Nick's repo through the device shell (Node 22); "container" = cloud container (Chromium + Playwright 1.63.0, SwiftShader), run against the full tree staged from the VM (content-identical apart from the unstaged CLAUDE.md line endings).

| Command | Where | Exit | Key output |
|---|---|---|---|
| `node tools/check-site.mjs` (checks only, before the restructure) | VM | 1 | 476 passed, 159 failed (expected red: hubs, stubs, preservation targets missing) |
| `node tools/check-ia.mjs` (before the restructure) | VM | 1 | 126 passed, 138 failed |
| `node tools/smoke.mjs` (before the restructure) | container | 1 | 116 passed, 73 failed (harness stopped at the writing-page log) |
| `node tools/check-catalog.mjs` | VM | 0 | 50 passed, 0 failed |
| `node tools/check-catalog.mjs --selftest` | VM | 0 | 9 passed, 0 failed |
| `node tools/check-site.mjs` | VM | 0 | 773 passed, 0 failed (includes check-ia) |
| `node tools/check-site.mjs --selftest` | VM | 0 | 34 passed, 0 failed (19 site + 15 IA detectors) |
| `node tools/check-ia.mjs` | VM | 0 | 335 passed, 0 failed; content preservation verified 257 text blocks (10 old pages from `main` + homepage log/manifesto/projects/whole `<main>` from `5ebcd41`) |
| `node tools/check-ia.mjs --selftest` | VM | 0 | 15 passed, 0 failed |
| `! git grep -n -I -E "(gh[p]_\|github_[p]at_\|Bearer [A-Za-z0-9]{20,})" -- . ':!docs'` | VM | 0 | prints nothing |
| `NODE_PATH=$(npm root -g) node tools/smoke.mjs` | container, staged VM tree | 0 | 197 passed, 0 failed (7 real pages × 1440/390, no console errors, overflow 0; stubs → page+anchor with and without JS; hub highlight per page; terminal `open repair`/`open legislation`/`open work`; palette "legislation" → `repair.html#legislation`; writing-page log filters/search; sticky section nav; phone menu = five hubs) |
| screenshots `ia-{index,work,writing,repair,about}-{1440,390}.png` (`?fx=static`) | container | — | read back: nav correct, no empty sections, no overlap |
