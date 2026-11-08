#!/usr/bin/env node
// Approved repair-first IA. Works in a plain static copy; no git-history dependency.
import {fileURLToPath} from 'node:url';
import {PAGES,STUBS,HUBS,read,exists,elements,attr,ids,pageText,reporter} from './lib.mjs';
export function navLinks(h){const n=/<nav class="site-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(h);return n?elements(n[1],'a').map(a=>[pageText(a.inner),attr(a.attrs,'href')]):null;}
export const SECTION_IDS={'repair.html':['mission','legislation','get-involved','guides','cafes','talks'],'about.html':['about','team','socials','contact'],'writing.html':['featured','log','philosophy','essays']};
export async function runIA(r){
 for(const [f]of PAGES){if(!r.check(f+' exists',exists(f)))continue;const h=read(f);
  r.check(f+': five approved nav links in order',JSON.stringify(navLinks(h))===JSON.stringify(HUBS));
  r.check(f+': brand is the business',h.includes('class="brand-name">Harrison Technology'));
  r.check(f+': no header profile link',!/<header class="site-header">[\s\S]*?github\.com[\s\S]*?<\/header>/.test(h));
  const links=elements(h,'a').map(a=>attr(a.attrs,'href')||'');
  r.check(f+': no internal links to retired URLs',!links.some(l=>STUBS.some(([s])=>l.split('#')[0]===s)));
  if(HUBS.some(([,u])=>u===f))r.check(f+': static current nav',h.includes('href="'+f+'" aria-current="page"'));
 }
 for(const [f,targets]of Object.entries(SECTION_IDS))for(const id of targets)r.check(f+': legacy #'+id,ids(read(f)).has(id));
 for(const [stub,page,id]of STUBS){const h=read(stub),target=page+'#'+id;r.check(stub+': immediate redirect',h.includes('http-equiv="refresh" content="0; url='+target+'"'));r.check(stub+': canonical',h.includes('rel="canonical" href="https://nickharrison96.github.io/'+target+'"'));r.check(stub+': fallback and noindex',h.includes('href="'+target+'"')&&h.includes('content="noindex"'));r.check(stub+': target exists',ids(read(page)).has(id));}
 const home=read('index.html');const order=['repair','before-contact','projects','tools','people','writing','contact','terminal'].map(id=>home.indexOf('id="'+id+'"'));
 r.check('homepage: approved section order',order.every((v,i)=>v>=0&&(i===0||v>order[i-1])));
 r.check('homepage: no automatic theatre',!home.includes('data-boot')&&!home.includes('class="marquee"')&&!home.includes('class="stack-stage"'));
 const about=pageText(read('about.html'));
 for(const n of ['Nick Harrison','Kate-Lyn Pigeon','Shiloh Hudgins','Where this started.'])r.check('About preserves '+n,about.includes(n));
 r.check('About origin once',about.split("This didn't begin as a business plan.").length===2);
 r.check('Blog: one real article',elements(read('writing.html'),'article').length===1);
 r.check('Blog: real empty state',read('writing.html').includes('More write-ups will appear here.'));
 r.check('Template: noindex and core sections',read('article-template.html').includes('content="noindex"')&&['context','problem','diagnosis','action','result','limitations','sources','related'].every(id=>ids(read('article-template.html')).has(id)));
 const s=pageText(read('services.html'));for(const t of ['Phones','Macs','PCs & laptops','Data recovery','No board-level repair.','No microsoldering.','No mail-in intake.','Local drop-off and remote/software help.'])r.check('service scope: '+t,s.includes(t));
}
export function selftestIA(r){r.check('detector reads nav',JSON.stringify(navLinks('<nav class="site-nav"><a href="work.html">Work</a></nav>'))==='[["Work","work.html"]]');r.check('detector rejects missing nav',navLinks('<nav></nav>')===null);}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=reporter('check-ia');if(process.argv.includes('--selftest'))selftestIA(r);else await runIA(r);process.exit(r.done()?0:1);}
