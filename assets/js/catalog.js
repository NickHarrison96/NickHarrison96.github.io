// The tool catalog: the ONLY place tools are listed.
// index.html (free-tools grid, field log, palette, terminal `ls ./tools`) and
// downloads.html (download cards) both import this module, so adding a tool here
// updates every page. `node tools/check-catalog.mjs` fails if an inline copy returns.
//
// Fields
//   name         display name (unique)
//   host         "github" — availability depends on GitHub; `url` is a release asset or repo/release page
//                "self"   — streamed from the home server via the Worker; needs `filename`
//   status       "live" | "soon" ("soon" renders a disabled Coming Soon button)
//   url          download link for host:"github"
//   version      short version label
//   category     short grouping label, or null
//   hue          base hue (0–360) for the placeholder tile when there is no image
//   image        screenshot/logo path, or null
//   summary      one-line card copy for the homepage
//   description  full copy for the downloads page
//   size, sha256 optional; shown when present
export const TOOLS = [
  {
    name: 'RootForgeKit',
    host: 'github',
    status: 'live',
    url: 'https://github.com/NickHarrison96/RootForgeKit/releases/download/v0.5.0/RootForgeKit-v0.5.0-win64.zip',
    version: 'v0.5 · pre-alpha',
    category: 'toolkit',
    hue: 205,
    image: 'assets/dl-rootforgekit.png',
    summary: 'Cross-platform system diagnostics and hardware health for Windows, Linux, and macOS — plus an iOS and Android device toolkit.',
    description: 'Cross-platform system diagnostics, hardware health, and iOS/Android device toolkit (PySide6). Overview, hardware health, prerequisites, tech/gamer tools, plus iOS and Android device work — one dark, 3uTools-inspired desktop app.',
    size: 127270394,
    sha256: '54b6d562d3a13ac4ff4ffab31aa50a7ffa147bcc4274f2a6f75ca6c1733586cc',
  },
  {
    name: 'Pymobile3-GUI',
    host: 'github',
    status: 'live',
    url: 'https://github.com/NickHarrison96/Pymobile3-GUI/archive/refs/heads/feature/sshrd-ramdisk.zip',
    version: 'v0.1 · pre-release',
    category: 'toolkit',
    hue: 265,
    image: 'assets/dl-pymobile3.png',
    summary: 'A PySide6 desktop app for iOS and Android device work — live syslog, forensic acquisition, and file browsing. Runs from source.',
    description: 'A PySide6 desktop app for iOS and Android device work — live syslog streaming, forensic acquisition (Logical, Logical+, or PRFS), and a file browser for installed app bundles. This download is the source archive from the development branch; it runs from source and needs Python and PySide6 installed.',
  },
  {
    name: 'BipPoyAI',
    host: 'github',
    status: 'live',
    // No release assets published yet, so this is the source archive of the
    // default branch. Swap for a /releases/download/... asset URL once one is cut.
    url: 'https://github.com/NickHarrison96/BipPoyAI/archive/refs/heads/main.zip',
    version: 'v0.1 · pre-alpha',
    category: 'assistant',
    hue: 32,
    image: 'assets/dl-bippoyai.png',
    summary: 'A local desktop assistant built with PySide6 and Ollama. Development source archive; requires local setup and model weights.',
    description: 'Qwythos AI — a local-only desktop assistant for Windows that runs entirely on your own hardware. PySide6 Pip-Boy GUI with CRT scanlines and hardware dials, routing through LiteLLM into Ollama so the Claude CLI works offline with no internet. Detects CPU threads, RAM, and GPU VRAM, then recommends context size and layer offloading. Source archive — needs Python 3.11+, Ollama running, and model weights.',
  },
  // iWin-Doh: hidden until there's something to download.
  // { name: 'iWin-Doh', host: 'github', status: 'soon', url: '', version: 'Coming Soon',
  //   category: null, hue: 188, image: null, summary: '…', description: 'In development — details coming soon.' },
  // Large multi-GB items use host: 'self', e.g.:
  // { name: '…', host: 'self', status: 'live', filename: 'foo.zip', version: '…', category: 'firmware',
  //   hue: 150, image: null, summary: '…', description: '…', size: 6900000000, sha256: '…' },
];
