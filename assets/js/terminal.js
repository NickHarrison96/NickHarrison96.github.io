// Optional, local navigation demo: typed commands and arrow-key history.
// No system commands, live status or involuntary motion. Output uses textContent.
import { TOOLS } from './catalog.js';
import { PAGES as ROUTES } from './registry.js';

const term = document.querySelector('.term');
const input = document.getElementById('term-input');
const out = document.getElementById('term-out');
const body = document.getElementById('term-body');

const PROMPT = 'demo > ';
const PAGES = Object.fromEntries(ROUTES.map(p=>[p.key,p.href]));
const COMMANDS = {
 help: () => [['info','Local demo only. Commands: ls ./tools, whoami, open <page>, clear'],['info','pages: '+Object.keys(PAGES).join(' ')]],
 'ls ./tools': () => TOOLS.map(t=>['info',t.name+' · '+t.version]),
 whoami: () => [['info','Harrison Technology Solutions. Repair, diagnostics and repair software.']],
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

function shake() {} // No involuntary motion on errors.

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
    }
  });
  for (const b of term.querySelectorAll('[data-cmd]')) b.addEventListener('click', () => { run(b.dataset.cmd); });
  body.addEventListener('click', () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });
  term.addEventListener('animationend', () => term.classList.remove('shake'));
  input.disabled=false;
  input.form.querySelector('button[type=submit]').disabled=false;
  term.classList.add('ready');
}
