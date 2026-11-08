// Static snapshots preserve contact and tool functionality if scripts fail.
// Edit config.js/catalog.js, then run this. --check detects stale snapshots.
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { ROOT,read } from './lib.mjs';
const load=async f=>import('data:text/javascript;base64,'+Buffer.from(read(f)).toString('base64'));
const {CONTACT_URL}=await load('assets/js/config.js');
const {TOOLS}=await load('assets/js/catalog.js');
const {PROJECTS,projectCard}=await load('assets/js/projects.js');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dimensions=t=>{const b=readFileSync(ROOT+'/'+t.image);return `width="${b.readUInt32BE(16)}" height="${b.readUInt32BE(20)}"`;};
const cards=TOOLS.filter(t=>t.host==='github').map(t=>`<article class="tool-download" id="${t.name.toLowerCase()}"><img src="${esc(t.image)}" ${dimensions(t)} loading="lazy" alt="${esc(t.name)} application screenshot"><div class="tool-copy"><p class="version">${esc(t.version)}</p><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><p class="small">${t.url.includes('/archive/')?'Development source archive—not a compiled application.':'Windows x64 release archive.'}</p><a class="button" href="${esc(t.url)}">${t.url.includes('/archive/')?'Download source':'Download release'} →</a>${t.size?`<p class="small">${t.size.toLocaleString('en-US')} bytes</p>`:''}${t.sha256?`<p class="hash">SHA-256<br><code>${esc(t.sha256)}</code></p>`:''}</div></article>`).join('\n');
let drift=[];
for(const f of readdirSync(ROOT).filter(f=>f.endsWith('.html'))){
 const before=read(f);let after=before.replace(/(<a\b[^>]*\bdata-contact\b[^>]*\bhref=")[^"]*(")/g,(_,a,b)=>a+esc(CONTACT_URL)+b);
 if(f==='work.html')after=after.replace(/<!-- projects:start -->[\s\S]*?<!-- projects:end -->/,'<!-- projects:start -->'+PROJECTS.map(projectCard).join('\n')+'<!-- projects:end -->');
 if(f==='downloads.html')after=after.replace(/<!-- catalog:start -->[\s\S]*?<!-- catalog:end -->/,'<!-- catalog:start -->'+cards+'<!-- catalog:end -->');
 // Preview snapshots follow shared catalog descriptions and versions, never a second catalog.
 if(f==='index.html'){
   for(const t of TOOLS.slice(0,2)){
     const re=new RegExp('(<h3>'+t.name+'</h3><p>)[\\s\\S]*?(</p>)');
     after=after.replace(re,(_,a,b)=>a+esc(t.summary)+b);
   }
 }
 if(before!==after){drift.push(f);if(!process.argv.includes('--check'))writeFileSync(ROOT+'/'+f,after);}
}
if(process.argv.includes('--check')&&drift.length){console.error('Stale generated snapshots: '+drift.join(', '));process.exit(1);}
console.log(process.argv.includes('--check')?'Static snapshots current.':'Rendered snapshots: '+(drift.join(', ')||'already current'));
