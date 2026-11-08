// Homepage live terminal: typed commands, ↑/↓ history, Tab completion, and a spring
// shake on unknown commands. Output is written with textContent only.
import { TOOLS } from './catalog.js';

const term = document.querySelector('.term');
const input = document.getElementById('term-input');
const out = document.getElementById('term-out');
const body = document.getElementById('term-body');

const PROMPT = 'nick@nicks-iMac:~$ ';
const SPECS = ['{', '  "host": "nick@nicks-iMac.local",', '  "smbios": "MacPro7,1",', '  "bootloader": "OpenCore 1.0.8",', '  "motherboard": "MSI MPG X570 Gaming Edge WiFi",', '  "cpu": "AMD Ryzen 5 3600",', '  "gpu": "AMD Radeon RX 580 8GB (Metal: 48,799)",', '  "ram": "16GB DDR4 (9490MiB / 16384MiB active)"', '}'];
const PAGES = {
  home: 'index.html', work: 'work.html', projects: 'work.html', writing: 'writing.html', 'case-study': 'apfs-recovery.html',
  essays: 'writing.html#essays', log: 'writing.html#log', manifesto: 'writing.html#philosophy',
  repair: 'repair.html', mission: 'repair.html#mission', legislation: 'repair.html#legislation',
  'get-involved': 'repair.html#get-involved', guides: 'repair.html#guides', 'repair-guides': 'repair.html#guides',
  cafes: 'repair.html#cafes', 'repair-cafes': 'repair.html#cafes', talks: 'repair.html#talks',
  tools: 'downloads.html', downloads: 'downloads.html', about: 'about.html', team: 'about.html#team', socials: 'about.html#socials',
};

const COMMANDS = {
  help: () => [['info', 'Available commands: cat specs.json, recovery --status, ls ./tools, cat manifesto, whoami, open <page>, clear'],
    ['info', `pages: ${Object.keys(PAGES).join(' ')}`]],
  'cat specs.json': () => SPECS.map((t) => ['', t]),
  'recovery --status': () => ['[OK] MacPro7,1 Target SMBIOS Operational.', "[OK] Target Volume 'Untitled' active on disk3s7.", '[OK] Kernel 25.6.0 running live.'].map((t) => ['ok', t]),
  'ls ./tools': () => TOOLS.filter((t) => t.status === 'live').map((t) => ['ok', `${t.name.padEnd(16)}${t.version}`]),
  'cat manifesto': () => ['Repair Is a Right, Not a Privilege.', 'Parts. Tools. Manuals. For Everyone.', 'The Greenest Device Is the One You Already Own.'].map((t) => ['hl', t]),
  whoami: () => [['hl', 'Nick Harrison: systems & AI engineer, hardware troubleshooter, right to repair campaigner.']],
  clear: () => null,
};
const COMPLETIONS = [...Object.keys(COMMANDS), ...Object.keys(PAGES).map((p) => `open ${p}`)];

const history = [];
let hIndex = 0;
let draft = '';

function line(cls, text, pre = '') {
  const div = document.createElement('div');
  if (cls) div.className = cls;
  if (pre) {
    const s = document.createElement('span');
    s.className = 't-user';
    s.textContent = pre;
    div.append(s);
  }
  div.append(document.createTextNode(text));
  out.append(div);
}

function shake() {
  term.classList.remove('shake');
  void term.offsetWidth; // restart the animation
  term.classList.add('shake');
}

function run(raw) {
  const cmd = raw.trim().replace(/\s+/g, ' ');
  if (!cmd) return;
  if (history[history.length - 1] !== cmd) history.push(cmd);
  hIndex = history.length;
  draft = '';
  if (cmd === 'clear') { out.textContent = ''; return; }
  line('cmd', cmd, PROMPT);
  if (cmd === 'open' || cmd.startsWith('open ')) {
    const page = cmd.slice(5).trim();
    if (PAGES[page]) { line('ok', `opening ${PAGES[page]} …`); setTimeout(() => { location.href = PAGES[page]; }, 250); }
    else { line('err', `open: no such page: ${page || '(none)'}  (try: ${Object.keys(PAGES).slice(0, 6).join(', ')} …)`); shake(); }
  } else if (COMMANDS[cmd]) {
    for (const [cls, t] of COMMANDS[cmd]()) line(cls, t);
  } else {
    line('err', `zsh: command not found: ${cmd}  (try help)`);
    shake();
  }
  while (out.childElementCount > 80) out.firstElementChild.remove();
  body.scrollTop = body.scrollHeight;
}

function complete() {
  const v = input.value.replace(/^\s+/, '');
  const hits = COMPLETIONS.filter((c) => c.startsWith(v));
  if (!hits.length) return false;
  if (hits.length === 1) { input.value = hits[0]; return true; }
  let prefix = hits[0];
  for (const h of hits) while (!h.startsWith(prefix)) prefix = prefix.slice(0, -1);
  if (prefix.length > v.length) input.value = prefix;
  else { line('info', hits.join('   ')); body.scrollTop = body.scrollHeight; }
  return true;
}

if (term && input && out && body) {
  input.form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); input.value = ''; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (!history.length) return;
      e.preventDefault();
      if (hIndex === history.length) draft = input.value;
      hIndex = Math.max(0, hIndex - 1);
      input.value = history[hIndex];
    } else if (e.key === 'ArrowDown') {
      if (hIndex >= history.length) return;
      e.preventDefault();
      hIndex += 1;
      input.value = hIndex === history.length ? draft : history[hIndex];
    } else if (e.key === 'Tab' && !e.shiftKey && input.value.trim()) {
      // Only capture Tab when there is something to complete, so keyboard users can still tab past.
      if (complete()) e.preventDefault();
    }
  });
  for (const b of term.querySelectorAll('[data-cmd]')) b.addEventListener('click', () => { run(b.dataset.cmd); });
  body.addEventListener('click', () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });
  term.addEventListener('animationend', () => term.classList.remove('shake'));
  term.classList.add('ready');
}
