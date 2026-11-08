#!/usr/bin/env node
import {readdirSync}from'node:fs';
import {execFileSync}from'node:child_process';
import {PAGES,STUBS,ROOT,read,exists,elements,tags,attr,ids,moduleGraph,reporter}from'./lib.mjs';
import {runIA,selftestIA}from'./check-ia.mjs';
import {runGuides,selftestGuides}from'./check-guides.mjs';
const r=reporter('check-site');
if(process.argv.includes('--selftest')){selftestIA(r);selftestGuides(r);r.check('ids parses ID',ids('<h1 id="x">Hi</h1>').has('x'));r.check('ids rejects absent ID',!ids('<h1>Hi</h1>').has('x'));process.exit(r.done()?0:1);}
const footers=[];
for(const[f]of PAGES){
 const h=read(f),own=ids(h);
 for(const [name,test]of Object.entries({language:/<html lang="en">/.test(h),viewport:/name="viewport"/.test(h),skip:h.includes('class="skip-link" href="#main"'),main:elements(h,'main').length===1,h1:elements(h,'h1').length===1,css:h.includes('href="styles.css"'),module:h.includes('src="assets/js/site.js"'),description:h.includes('name="description"'),canonical:h.includes('rel="canonical"'),social:h.includes('property="og:title"')}))r.check(f+': '+name,test);
 const allIds=[...h.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);r.check(f+': unique IDs',allIds.length===new Set(allIds).size);
 footers.push(/<footer class="site-footer">[\s\S]*?<\/footer>/.exec(h)?.[0]);
 for(const t of tags(h,['a','link','script','img'])){
  const v=attr(t.attrs,['a','link'].includes(t.name)?'href':'src');if(!v||/^(https?:|mailto:|data:)/.test(v))continue;
  const[file,frag]=v.split('#');r.check(f+': '+v+' resolves',!file||exists(file));if(frag&&(!file||file.endsWith('.html')))r.check(f+': '+v+' anchor',(!file?own:ids(read(file))).has(frag));
 }
 for(const t of tags(h,['img']))r.check(f+': image alt and dimensions',attr(t.attrs,'alt')!==null&&!!attr(t.attrs,'width')&&!!attr(t.attrs,'height'));
 for(const s of tags(h,['script']))r.check(f+': no remote script',!/^https?:/.test(attr(s.attrs,'src')||''));
 const graph=moduleGraph(f);r.check(f+': module imports resolve',graph.missing.length===0,graph.missing.join(', '));r.check(f+': no remote/bare imports',graph.external.length===0);
 const footer=footers.at(-1)||'';r.check(f+': one GitHub profile in footer',footer.split('href="https://github.com/NickHarrison96"').length===2);
}
r.check('footer consistent',footers.every(f=>f&&f===footers[0]));
r.check('all root pages registered',readdirSync(ROOT).filter(f=>f.endsWith('.html')).every(f=>PAGES.some(([p])=>p===f)||STUBS.some(([s])=>s===f)));
const css=read('styles.css');
for(const token of ['surface-canvas','surface-raised','text-primary','text-secondary','border-control','action-primary','on-action','focus-ring','status-error','status-success'])r.check('semantic token '+token,css.includes('--'+token+':'));
r.check('both themes',css.includes('[data-theme="dark"]')&&css.includes('[data-theme="light"]')&&css.includes('prefers-color-scheme:dark'));
r.check('no hidden page overflow',!/(?:html|body)\s*\{[^}]*overflow-x\s*:\s*(?:hidden|clip)/.test(css));
r.check('reduced motion and forced colors',css.includes('prefers-reduced-motion:reduce')&&css.includes('forced-colors:active'));
r.check('visible focus',css.includes(':focus-visible{outline:2px'));
r.check('no blocking font network dependency',!PAGES.some(([f])=>read(f).includes('fonts.googleapis.com')));
r.check('default shell has no effects imports',!/(?:fx-|scramble)/.test(read('assets/js/site.js')));
r.check('shared registry used by palette and terminal',['palette','terminal'].every(f=>read('assets/js/'+f+'.js').includes("from './registry.js'")));
try{execFileSync(process.execPath,['tools/render-static.mjs','--check'],{cwd:ROOT,stdio:'pipe'});r.check('generated contact/catalog snapshots current',true);}catch(e){r.check('generated contact/catalog snapshots current',false,e.stdout?.toString());}
await runIA(r);runGuides(r);process.exit(r.done()?0:1);
