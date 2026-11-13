// The project list (`PROJECTS`). The only place projects are listed — same single-source pattern as
// catalog.js. index.html (featured work) and work.html carry the cards as static markup so they read
// without JavaScript; `node tools/check-site.mjs` fails unless that markup equals
// PROJECTS.map(projectCard). After editing this file, regenerate it with
// `node tools/check-ia.mjs --print-projects` and paste it into both pages' `.project-grid`.
// The command palette also reads PROJECTS, and the field log on writing.html lists each one.

export const PROJECTS = [
  {
    title: 'LiteLLM Proxy &amp; SDK',
    plain: 'LiteLLM Proxy & SDK',
    mark: 'AI',
    tag: 'Python / AI',
    accent: [56, 189, 248],
    description: 'Unified proxy server to call 100+ LLM APIs in OpenAI format with cost tracking, load balancing, and logging middleware.',
    area: 'AI Infrastructure',
    url: 'https://github.com/NickHarrison96',
    keys: 'ai llm gateway python',
  },
  {
    title: 'Stable Diffusion WebUI',
    plain: 'Stable Diffusion WebUI',
    mark: 'SD',
    tag: 'PyTorch / ML',
    accent: [129, 140, 248],
    description: 'Generative vision workflows, custom kext/metal performance patches, and optimized local GPU model executions.',
    area: 'Generative Pipelines',
    url: 'https://github.com/NickHarrison96',
    keys: 'ml pytorch generative',
  },
  {
    title: 'MacPro7,1 X570 EFI Architecture',
    plain: 'MacPro7,1 X570 EFI Architecture',
    mark: 'OC',
    tag: 'OpenCore / macOS',
    accent: [52, 211, 153],
    description: 'Custom OpenCore 1.0.8 EFI for MSI MPG X570 Gaming Edge WiFi. Dual-boots macOS Tahoe and Windows 11 with custom ACPI (SSDT-USB-Darwin) and RX 580 Metal tuning.',
    area: 'Hackintosh &amp; Boot',
    url: 'https://github.com/NickHarrison96/MSI-MPG-x570-EFI',
    keys: 'opencore hackintosh efi',
  },
];

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

/** Static card markup for one project (fields are trusted, HTML-ready strings from this file). */
export function projectCard(p) {
  return `        <article class="project tilt" style="--accent:${hex(p.accent)};--accent-tint:${rgba(p.accent, '.1')};--accent-ring:${rgba(p.accent, '.25')}">
          <div class="project-top"><span class="project-mark" aria-hidden="true">${p.mark}</span><span class="project-tag">${p.tag}</span></div>
          <h3>${p.title}</h3>
          <p>${p.description}</p>
          <div class="project-foot"><span><span class="sq" aria-hidden="true">■</span> ${p.area}</span><a href="${p.url}" target="_blank" rel="noopener noreferrer">View Repo <span aria-hidden="true">↗</span></a></div>
        </article>`;
}
