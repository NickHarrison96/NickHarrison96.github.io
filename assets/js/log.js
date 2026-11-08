// Blog filtering enhances real static articles only. No generated release dates or teaser entries.
const controls=document.querySelector('.blog-controls');
const query=document.getElementById('log-q');
const entries=[...document.querySelectorAll('#log-list .post-row')];
let tag='All';
function filter(){
  const q=query.value.trim().toLowerCase();let count=0;
  for(const e of entries){const show=(tag==='All'||e.dataset.tags.split(' ').includes(tag))&&e.textContent.toLowerCase().includes(q);e.hidden=!show;if(show)count++;}
  document.getElementById('log-empty').hidden=count>0;
}
if(controls&&query){controls.hidden=false;query.addEventListener('input',filter);for(const b of controls.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{tag=b.dataset.filter;for(const c of controls.querySelectorAll('[data-filter]'))c.setAttribute('aria-pressed',String(c===b));filter();});}
