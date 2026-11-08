# Website foundation implementation plan

Goal: extend the approved static website into Main / Write-ups / Tutorials with the shared etched-light visual system, preserving sourced material and consumer-freedom intent.
Architecture: HTML content fragments plus a small Python-standard-library generator own shared document/navigation/footer/decorative markup. CSS owns responsive appearance and static fallbacks; one optional vanilla module owns decorative motion. Generated HTML works directly on a static host without a runtime or framework.
Constraints: no repository operations, publishing or deployment; no new research/project/tutorial claims; no homepage cards; unchanged readable content during interaction.

1. Add failing foundation assertions for all routes, consistent active navigation, three disciplines on Main, honest Tutorials empty state, reusable content/build inputs and shared motion inclusion. Run and observe missing foundation failures.
2. Extract existing main content into content/*.html. Add Main copy and Tutorials empty/template content. Implement build.py, shared accessible header/footer and reusable decorative SVG. Run build and static assertions; verify deterministic regeneration.
3. Add shared tokens/refined etched-light CSS; static right-edge detail and page-specific quiet article variant. Preserve existing content layout and focus. Implement event-driven bounded spring/glow module with fine-pointer/reduced-motion/forced-color/visibility/intersection gates and no idle loop.
4. Expand headless Playwright tests for local routes/assets/fragments, keyboard, axe at 1440/390, 320 reflow, 200% text, pointer engagement/settling, stable text/control bounds, hidden/offscreen gates, runtime preferences, no-JS and coarse-pointer fallbacks. Record measured callback timing, not a frame-rate claim.
5. Save foundation-* screenshots and JSON report outside output content, inspect representative desktop/mobile captures, fix any observed issues and rerun. Document adding a page/content and local testing in README. Report unrun manual/browser/device checks honestly.

## Approved medium-intensity cybernetic refinement

Design thesis: a luminous data-interface perimeter around calm, stationary research content. Preserve the exact approved Main introduction and all existing content/navigation; no new sections, claims or uploaded material.

- [x] Add failing contracts for an explicit shared ambient-motion toggle, stable accessible pressed state, persisted preference and intentional CSS energy animation. Preserve current approved intro with an exact-string assertion.
- [x] Update build.py shared decorative composition/control and add a bespoke cybernetic SVG data-node field. Reuse current tokens with deeper navy surfaces, layered contour rails, luminous seams and calm article variants; no text/controls transform.
- [x] Replace optional motion module with bounded pointer springs plus a shared animation eligibility controller: fine pointer, visible region, visible document, no forced colors/reduced motion and persisted user enabled preference. CSS energy paths run only with the active class. Explicit Off freezes every decorative animation and cancels rAF; no-JS is static. Coarse input is a deliberate static composition. System preferences override stored On.
- [x] Update headless tests for all routes and exact approved intro, axe at 1440/390, narrow/enlarged text, keyboard toggle and persistence, system/runtime fallbacks, hidden/offscreen gates, stationary geometry, CSS animation pause/resume, pointer rAF settling and measured callback timing. No continuous JS animation loop.
- [x] Save cyber-* screenshot variants, cyber-checks.json and an optional short headless recording; inspect representative desktop/mobile visuals. Update README motion lifecycle/test instructions. Rebuild twice to prove deterministic output. No git, publishing or deployment.

Verification: complete headless suite passed after fixing a visible-label/accessibility-name mismatch on the new motion control. Final evidence is `/workspace/site-fresh-shots/cyber-checks.json`; desktop/mobile images were inspected. The generated WebM is provided for human review and has not been manually watched.
