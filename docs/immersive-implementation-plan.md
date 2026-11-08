# Immersive atmosphere implementation plan

Goal: replace the right-hand cyber illustration with an original page-wide blue/cyan/violet fluid visual system without changing approved content.
Architecture: preserve the standard-library static generator/content fragments. Replace shared decorative markup/assets and simplify CSS to one current token/component system; adapt the existing optional vanilla motion controller and headless tests.
Constraints: nonrepository static deliverables only; no git/publishing; no uploaded-content work; no green/red/pink; no extra homepage content or services positioning.

1. Capture SHA-256 hashes of all content fragments and assert exact approved intro. Add failing static checks requiring the atmosphere assets/markup and excluding rendered chip artwork. Add a palette scanner for authored CSS/SVG colors; retain route/navigation/source checks.
2. Create original fluid-ribbon and contour assets; replace generator decorative markup with full-width flow/depth/detail/veil layers. Reuse unchanged supplied branding. Rebuild using `python3 build.py`; expect seven generated pages.
3. Replace accumulated visual CSS with current tokens/components, compact sticky header, enlarged heading, generous spacing, flowing artwork and opaque article column. Include responsive/static/coarse/forced-color/reduced-motion styles. Preserve all content classes and focus behavior.
4. Adapt `assets/motion.js` selectors and bounded offsets, retaining persisted toggle and strict eligibility gates. CSS animates only transform/opacity of static image/data layers. Pointer rAF still stops at rest.
5. Update `tools/test_browser.py` to generate immersive-* screenshots/checks and a short review WebM, asserting running/paused layer lifecycle instead of the former energy routes. Test all seven routes at 1440/390, 320/200% text, keyboard/persistence, exact content hashes, palette, no-JS/coarse/reduced/forced colors, stationary geometry and hidden/offscreen gating. Record honest renderer observations.
6. Read rendered desktop/mobile screenshots, identify concrete defects, fix and rerun. Update README/current-plan status and report manual/device/browser limits. No video-watching claim.

Self-review: no conflicting approval gate, repository action, imported upload or added content; all deliverables and checks have explicit paths and observable outcomes.

## Verification outcome

Complete headless suite passed for all seven pages. Desktop/mobile screenshot review identified two concrete defects: artwork extending document scroll height below the footer and a long APFS term overflowing at 320px with 200% text. Both were fixed with regression assertions. Final captures were read again: full-width flow, oversized hierarchy and explicitly stacked header remain readable without excess scroll area. Palette and exact content hash contracts pass.

Evidence: `/workspace/site-fresh-shots/immersive-checks.json`, `immersive-*` screenshots, `/workspace/immersive-main-motion-review.webm`. The generated recording has not been watched. Measured renderer tasks were 10.897ms over a 1204.329ms active window; pointer callback p95 0.10ms, not an FPS or GPU/device guarantee. Screen readers, other engines, real touch hardware and actual browser zoom remain unrun; hidden-document handling uses a simulated transition.
