// Confirmed engineering work. Run tools/render-static.mjs after editing.
// Palette and the static Work cards share this registry.
export const PROJECTS = [
 {
  title:'MacPro7,1 X570 EFI Architecture', plain:'MacPro7,1 X570 EFI Architecture',
  tag:'OpenCore / macOS',
  description:'Custom OpenCore 1.0.8 EFI for MSI MPG X570 Gaming Edge WiFi. Dual-boots macOS Tahoe and Windows 11 with custom ACPI (SSDT-USB-Darwin) and RX 580 Metal tuning.',
  note:'A hardware-specific configuration, not a universal installer.',
  url:'https://github.com/NickHarrison96/MSI-MPG-x570-EFI', keys:'opencore hackintosh efi'
 },
 {
  title:'BipPoyAI', plain:'BipPoyAI', tag:'Local AI / Pre-alpha',
  description:'A local desktop assistant built with PySide6 and Ollama. Development source, not a finished repair service.',
  note:'Current architecture and compatibility need review before an expanded case study.',
  url:'https://github.com/NickHarrison96/BipPoyAI', keys:'local ai desktop ollama'
 }
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function projectCard(p){return `<article class="project"><p class="eyebrow">${esc(p.tag)}</p><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><a class="text-link" href="${esc(p.url)}">View project source →</a><p class="small">${esc(p.note)}</p></article>`;}
