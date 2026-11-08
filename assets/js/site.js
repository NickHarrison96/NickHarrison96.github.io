import { CONTACT_URL } from './config.js';
const root = document.documentElement;
const theme = document.getElementById('theme');
theme.closest('label').hidden=false;
try { theme.value = localStorage.getItem('hts-theme') || 'system'; } catch {}
if (!['system','light','dark'].includes(theme.value)) theme.value = 'system';
theme.addEventListener('change', () => {
  if (theme.value === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme.value;
  try { localStorage.setItem('hts-theme', theme.value); } catch {}
});
for (const a of document.querySelectorAll('[data-contact]')) a.href = CONTACT_URL;
const menu = document.querySelector('.menu-btn');
const header = document.querySelector('.site-header');
menu.hidden = false;
root.classList.add('js-menu');
const setMenu = (on) => {menu.setAttribute('aria-expanded',String(on));header.classList.toggle('menu-open',on);menu.textContent=on?'Close menu':'Menu';};
menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
addEventListener('keydown',e=>{if(e.key==='Escape' && menu.getAttribute('aria-expanded')==='true'){setMenu(false);menu.focus();}});
const small = matchMedia('(max-width:700px)');
small.addEventListener('change',()=>setMenu(false));
// The search controls are only shown once the optional module is working.
import('./palette.js').then(()=>{for(const b of document.querySelectorAll('[data-palette-open]'))b.hidden=false;root.dataset.ready='1';}).catch(()=>{});
const demo = document.querySelector('#terminal');
let demoLoaded=false;
if(demo) demo.addEventListener('toggle',()=>{if(demo.open&&!demoLoaded){demoLoaded=true;import('./terminal.js');import('./konami.js');import('./boot.js');}});
if(document.getElementById('log-list')) import('./log.js');
if(location.pathname.endsWith('/')||location.pathname.endsWith('index.html')) import('./home.js');
for(const b of document.querySelectorAll('[data-copy]')) {
  b.hidden=false;
  b.addEventListener('click',async()=>{
    const s=document.getElementById('copy-status');
    try{await navigator.clipboard.writeText(b.dataset.copy);s.textContent='Email address copied.';}
    catch{s.textContent='Could not copy. Select harrisontechdev@gmail.com above and copy it manually.';}
  });
}
