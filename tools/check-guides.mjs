#!/usr/bin/env node
// Content integrity now checks the actual static inventory, not absent/unpublished guides.
import {fileURLToPath}from'node:url';
import {PAGES,read,pageText,reporter}from'./lib.mjs';
export function unsafeClaims(t){return /zero.loss recovery|always available|free diagnos|same.day repair|book now|Surgical Recovery|Standard Apple Protocol|newsletter|Subscribe|nickpharrison|LiteLLM Proxy|Stable Diffusion|Why [‘']Authorized|The True Cost of a Glued|Ownership After the Sale/i.test(t);}
export function runGuides(r){
 for(const[f]of PAGES){const h=read(f);r.check(f+': no retired or invented claims',!unsafeClaims(pageText(h)));r.check(f+': unknown facts tracked with TODO, no bracket-copy',!/\[(?:Diagnostic fee|scope|currency|insert)\]/i.test(pageText(h)));}
 const apfs=read('apfs-recovery.html');
 r.check('APFS: reported, not verified guarantee',apfs.includes('reported outcome')&&apfs.includes('not proof that every file was verified'));
 r.check('APFS: no copy-paste disk changes',!apfs.includes('sudo chown')&&!apfs.includes('data-copy'));
 r.check('APFS: backup/risk warning',apfs.includes('Disk changes can cause data loss.')&&apfs.includes('Back up'));
 r.check('APFS: technical evidence TODO',apfs.includes('TODO(Nick): Review OS/build consistency'));
 const a=read('about.html');for(const t of ['Founder &middot; CEO &middot; CTO','Community Experience &amp; Creative Lead','Social Media Manager &middot; QA &amp; Beta Testing Lead'])r.check('Approved team role kept: '+t,a.includes(t));
 r.check('Work: actual EFI source',read('work.html').includes('https://github.com/NickHarrison96/MSI-MPG-x570-EFI'));
 r.check('Work: BipPoyAI retained',read('work.html').includes('https://github.com/NickHarrison96/BipPoyAI'));
 r.check('Downloads: no invented release review',read('downloads.html').includes('TODO(Nick): Verify current release'));
}
export function selftestGuides(r){r.check('unsafe claims catches always available',unsafeClaims('Always available'));r.check('unsafe claims permits reported case',!unsafeClaims('A reported outcome, not a guarantee.'));}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=reporter('check-guides');if(process.argv.includes('--selftest'))selftestGuides(r);else runGuides(r);process.exit(r.done()?0:1);}
