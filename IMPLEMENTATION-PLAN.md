# Website foundation implementation plan

Goal: extend the approved static website into Main / Write-ups / Tutorials with the shared etched-light visual system, preserving sourced material and consumer-freedom intent.
Architecture: HTML content fragments plus a small Python-standard-library generator own shared document/navigation/footer/decorative markup. CSS owns responsive appearance and static fallbacks; one optional vanilla module owns decorative motion. Generated HTML works directly on a static host without a runtime or framework.
Constraints: no repository operations, publishing or deployment; no new research/project/tutorial claims; no homepage cards; unchanged readable content during interaction.

1. Add failing foundation assertions for all routes, consistent active navigation, three disciplines on Main, honest Tutorials empty state, reusable content/build inputs and shared motion inclusion. Run and observe missing foundation failures.
2. Extract existing main content into content/*.html. Add Main copy and Tutorials empty/template content. Implement build.py, shared accessible header/footer and reusable decorative SVG. Run build and static assertions; verify deterministic regeneration.
3. Add shared tokens/refined etched-light CSS; static right-edge detail and page-specific quiet article variant. Preserve existing content layout and focus. Implement event-driven bounded spring/glow module with fine-pointer/reduced-motion/forced-color/visibility/intersection gates and no idle loop.
4. Expand headless Playwright tests for local routes/assets/fragments, keyboard, axe at 1440/390, 320 reflow, 200% text, pointer engagement/settling, stable text/control bounds, hidden/offscreen gates, runtime preferences, no-JS and coarse-pointer fallbacks. Record measured callback timing, not a frame-rate claim.
5. Save foundation-* screenshots and JSON report outside output content, inspect representative desktop/mobile captures, fix any observed issues and rerun. Document adding a page/content and local testing in README. Report unrun manual/browser/device checks honestly.
