// Browser evidence for the repair-first static site. No external writes.
import {chromium}from'playwright';
import {mkdirSync,writeFileSync}from'node:fs';
import {PAGES,STUBS}from'./lib.mjs';
const base=process.env.SITE_URL||'http://127.0.0.1:8134/';
const shots='/workspace/site-redesign-shots';mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];let failed=0;
const check=(name,ok,detail='')=>{results.push({name,pass:!!ok,detail});if(!ok){failed++;console.error('FAIL '+name+' '+detail);}};
const errors=[];
const ctx=await browser.newContext({reducedMotion:'reduce'});
// Deterministic offline Worker; does not disguise the failure state from users.
await ctx.route('https://harrisontechdev.harrisontechdev.workers.dev/**',r=>r.fulfill({status:503,body:'Offline test'}));
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
for(const width of [1440,390])for(const theme of ['light','dark']){
 await page.setViewportSize({width,height:width===1440?1000:844});
 await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await page.addInitScript(t=>{localStorage.setItem('hts-theme',t);},theme);
 for(const[f]of PAGES.filter(([f])=>f!=='article-template.html')){
  await page.goto(base+f);await page.waitForFunction(()=>document.documentElement.dataset.ready==='1');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  check(f+' reflow '+width+' '+theme,overflow<=1,'overflow '+overflow);
  const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src));
  // Lazy images below the viewport are triggered by scrolling before screenshot.
  await page.evaluate(async()=>{for(const i of document.images){i.loading='eager';try{await i.decode()}catch{}}});
  check(f+' images '+width+' '+theme,await page.locator('img').evaluateAll(xs=>xs.every(i=>i.naturalWidth>0)));
  check(f+' theme '+theme,await page.evaluate(t=>document.documentElement.dataset.theme===t,theme));
  await page.screenshot({path:shots+'/'+f.replace('.html','')+'-'+width+'-'+theme+'.png',fullPage:true});
 }
}
check('no JS exceptions',errors.length===0,errors.join('; '));
await page.setViewportSize({width:390,height:844});await page.goto(base);
await page.locator('.menu-btn').click();check('mobile menu expanded',await page.locator('.menu-btn').getAttribute('aria-expanded')==='true');
await page.keyboard.press('Escape');check('menu Escape returns focus',await page.locator('.menu-btn').evaluate(e=>e===document.activeElement));
await page.locator('[data-palette-open]').click();
await page.getByRole('combobox',{name:'Search projects, case studies, tools and pages'}).fill('zzzznoresults');
check('search empty state',await page.locator('.palette-empty').isVisible());
await page.keyboard.press('Tab');await page.keyboard.press('Tab');check('palette keeps focus inside',await page.locator('.palette').evaluate(e=>e.contains(document.activeElement)));
await page.keyboard.press('Escape');check('search restores trigger',await page.locator('[data-palette-open]').evaluate(e=>e===document.activeElement));
await page.locator('#terminal summary').click();await page.locator('.term.ready').waitFor();await page.locator('#term-input').fill('help');await page.locator('#term-input').press('Enter');
check('terminal is honest demo',await page.locator('#term-out').textContent().then(t=>t.includes('Local demo only')));
await page.locator('#term-input').fill('open ');await page.locator('#term-input').press('Tab');check('Tab exits terminal',!(await page.locator('#term-input').evaluate(e=>e===document.activeElement)));
await page.locator('#fun-mode').click();check('fun opt-in',await page.locator('html').getAttribute('data-jailbreak')==='true');
await page.locator('#fun-mode').click();check('fun visible exit',await page.locator('html').getAttribute('data-jailbreak')==='false');
await page.locator('#replay-intro').click();check('replay never hides content',await page.locator('h1').isVisible());
await page.goto(base+'writing.html');await page.locator('#log-q').fill('nomatch');check('blog no results',await page.locator('#log-empty').isVisible());await page.locator('#log-q').fill('');check('blog recovery',await page.locator('.post-row').isVisible());
await page.goto(base+'downloads.html');check('Worker offline is explicit',await page.locator('#hostEmpty').textContent().then(t=>t.includes('unreachable')));
await ctx.unroute('https://harrisontechdev.harrisontechdev.workers.dev/**');
await ctx.route('https://harrisontechdev.harrisontechdev.workers.dev/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({loose:[{name:'a'.repeat(220)+'.gguf',size:123456}],groups:[]})}));
await page.locator('#hostRetry').click();await page.locator('.host-row').waitFor();check('Worker retry renders files',await page.locator('.host-row').count()===1);check('long filename no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));check('stale offline message cleared',await page.locator('#hostEmpty').isHidden());
await page.goto(base+'about.html');await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));await page.locator('[data-copy]').click();check('clipboard denial manual fallback',await page.locator('#copy-status').textContent().then(t=>t.includes('copy it manually')));
// Explicit themes persist, system removes override; storage unavailable must not break the shell.
await page.locator('#theme').selectOption('dark');await page.reload();check('explicit theme persists',await page.locator('html').getAttribute('data-theme')==='dark');
await page.locator('#theme').selectOption('system');check('system has no explicit override',(await page.locator('html').getAttribute('data-theme'))===null);
const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw Error('unavailable')}});});const bp=await blocked.newPage();await bp.goto(base+'services.html');await bp.waitForFunction(()=>document.documentElement.dataset.ready==='1');check('storage disabled shell works',await bp.locator('h1').isVisible());await blocked.close();
// Reflow, enlarged type, forced colors. Geometry, not overflow clipping.
for(const width of [320,390]){await page.setViewportSize({width,height:844});for(const[f]of PAGES){await page.goto(base+f);check(f+' '+width+' reflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}}
await page.setViewportSize({width:390,height:844});await page.goto(base);await page.addStyleTag({content:'html{font-size:200%} *{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}'});await page.evaluate(()=>new Promise(requestAnimationFrame));await page.screenshot({path:shots+'/text-200.png',fullPage:true});const zoom=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));check('200% text spacing reflow',zoom.scroll<=zoom.width+1,JSON.stringify(zoom));
await page.emulateMedia({forcedColors:'active'});check('forced color content visible',await page.locator('h1').isVisible());
// All essential routes and contacts with scripting disabled.
const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const np=await nojs.newPage();
for(const[f]of PAGES){await np.goto(base+f);check(f+' no-JS content',await np.locator('h1').isVisible());check(f+' no-JS navigation',await np.locator('.site-nav a').count()===5);check(f+' no-JS contact',await np.locator('a[data-contact][href="mailto:harrisontechdev@gmail.com"]').count()>0);}
await np.goto(base+'downloads.html');check('no-JS direct tool links',await np.locator('.tool-download .button').count()===3);
for(const[s,target,id]of STUBS){await np.goto(base+s);await np.waitForURL('**/'+target+'#'+id);check(s+' no-JS redirect',await np.locator('#'+id).count()===1);}
await nojs.close();
// Contrast from actual computed tokens, each theme separately.
const contrast=[];
for(const theme of ['light','dark']){
 await page.goto(base);await page.locator('#theme').selectOption(theme);
 const colors=await page.evaluate(()=>{const c=getComputedStyle(document.documentElement);return Object.fromEntries(['surface-canvas','surface-raised','surface-subtle','text-primary','text-secondary','border-control','action-primary','on-action','focus-ring','status-error','status-success'].map(k=>[k,c.getPropertyValue('--'+k).trim()]));});
 const lum=hex=>{const rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const pairs=[];for(const bg of ['surface-canvas','surface-raised','surface-subtle'])for(const fg of ['text-primary','text-secondary','action-primary','status-error','status-success'])pairs.push([fg,bg,4.5]);pairs.push(['on-action','action-primary',4.5],['border-control','surface-canvas',3],['border-control','surface-raised',3],['focus-ring','surface-canvas',3]);
 for(const[a,b,min]of pairs){const l=[lum(colors[a]),lum(colors[b])].sort((a,b)=>b-a);const ratio=(l[0]+.05)/(l[1]+.05);contrast.push({theme,foreground:a,background:b,ratio:+ratio.toFixed(2),minimum:min});check(theme+' contrast '+a+'/'+b,ratio>=min,ratio.toFixed(2));}
}
writeFileSync(shots+'/contrast.json',JSON.stringify(contrast,null,2));writeFileSync(shots+'/smoke-results.json',JSON.stringify({passed:results.length-failed,failed,results},null,2));
await browser.close();console.log(`smoke: ${results.length-failed} passed, ${failed} failed`);process.exitCode=failed?1:0;
