"""Headless-only foundation checks; no unknown uploaded code is loaded."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import json,os,sys,hashlib,subprocess
from bs4 import BeautifulSoup,Comment
from playwright.sync_api import sync_playwright
from test_static import check,ROOT
SHOTS=Path(os.environ.get('SHOTS_DIR','/workspace/site-fresh-shots'));SHOTS.mkdir(exist_ok=True)
AXE=Path(os.environ.get('AXE_PATH','/workspace/site-test-tools/node_modules/axe-core/axe.min.js'))
PAGES=json.loads((ROOT/'pages.json').read_text()); names=[p['file'] for p in PAGES]
report={'static':{},'browser':[],'motion':{},'limits':['Chromium headless only; not a screen-reader conformance audit','Hidden-document gate tested with a simulated document.hidden transition, not OS background throttling','Timings cover instrumented JavaScript callbacks, not GPU/compositor or real-device frame rates','Actual browser zoom and real touch hardware are not tested']}
check();report['static']['contract']='passed'
before={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in names}
subprocess.run([sys.executable,str(ROOT/'build.py')],check=True)
assert before=={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in names},'Non-deterministic build'
report['static']['deterministic_build']='passed'
for name in names:
 s=BeautifulSoup((ROOT/name).read_text(),'html.parser')
 for comment in s.find_all(string=lambda n:isinstance(n,Comment)):comment.extract()
 if 'template' not in name:assert 'TODO(Nick)' not in s.get_text()
 assert all(img.has_attr('alt') for img in s.select('img'))
 assert not s.select('script[src^="http"],link[href^="http"]')
 assert len(s.select('main'))==len(s.select('h1'))==1
report['static']['landmarks_notes_images_no_remote_runtime']='passed'
# Fidelity assertions for already-established content, not newly uploaded materials.
original=Path('/workspace/about-source.html')
if original.exists():
 source=BeautifulSoup(original.read_text(),'html.parser');target=BeautifulSoup((ROOT/'about.html').read_text(),'html.parser')
 for bio in source.select('.team-bio'):assert bio.get_text() in target.get_text()
 report['static']['exact_team_bios']='passed'
for cmd in ['diskutil apfs addVolume disk3 APFS "Untitled"','sudo chown -R $(whoami) "/Volumes/Big Mac - Data/Users/nick"']:
 assert cmd in BeautifulSoup((ROOT/'apfs-recovery.html').read_text(),'html.parser').get_text()
report['static']['apfs_commands']='passed'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
COUNTERS='''(()=>{const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);const m=window.__frames={calls:0,pending:0,durations:[]};const ids=new Set();window.requestAnimationFrame=fn=>{let id=request(t=>{ids.delete(id);m.pending=ids.size;m.calls++;const start=performance.now();fn(t);m.durations.push(performance.now()-start)});ids.add(id);m.pending=ids.size;return id};window.cancelAnimationFrame=id=>{ids.delete(id);m.pending=ids.size;cancel(id)}})();'''
def overflow(page):return page.evaluate('document.documentElement.scrollWidth > innerWidth')
def bounds(page):return page.locator('main h1, main p, main a, header a').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
def assert_idle(page):
 page.wait_for_timeout(2000);start=page.evaluate('__frames.calls');page.wait_for_timeout(250);assert page.evaluate('__frames.calls')==start,'Idle animation frames continue';assert page.evaluate('__frames.pending')==0;return start
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':1000})
   errors=[];failures=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failures.append(r.url) if r.status>=400 else None)
   for name in names:
    page.goto(base+'/'+name);assert not overflow(page),(name,width)
    assert page.locator('img').evaluate_all('(images)=>images.every(i=>i.complete&&i.naturalWidth>0)')
    page.add_script_tag(path=str(AXE))
    audit=page.evaluate('async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}})')
    violations=[{'id':v['id'],'impact':v['impact'],'targets':[n['target'] for n in v['nodes']]} for v in audit['violations']]
    report['browser'].append({'page':name,'width':width,'axe':violations});assert not violations,(name,width,violations)
    # Baseline screenshot is taken with no pointer activity.
    slug='main' if name=='index.html' else Path(name).stem
    page.screenshot(path=str(SHOTS/f'foundation-{slug}-{width}.png'),full_page=True)
    page.keyboard.press('Tab');assert page.locator(':focus').inner_text()=='Skip to content'
    page.keyboard.press('Enter');assert page.locator(':focus').get_attribute('id')=='main'
    page.keyboard.press('Tab');assert page.locator(':focus').count()==1
    page.evaluate('document.documentElement.style.fontSize="200%"');assert not overflow(page),('text scaling',name,width)
   assert not errors,errors;assert not failures,failures;page.close()
  # 320px narrow reflow, with normal text and 200% text separately.
  page=browser.new_page(viewport={'width':320,'height':800})
  for name in names:
   page.goto(base+'/'+name);assert not overflow(page),('320',name)
   page.evaluate('document.documentElement.style.fontSize="200%"');assert not overflow(page),('320 scaled',name)
  page.close()
  # Instrument only the local enhancement's rAF callbacks, before axe is loaded.
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_init_script(COUNTERS);page=context.new_page();page.goto(base+'/index.html');page.wait_for_timeout(150)
  assert page.evaluate('__frames.calls')==0,'Animation runs before input'
  initial=bounds(page);page.mouse.move(1320,380);page.wait_for_timeout(140)
  assert page.evaluate('__frames.calls')>0,'Pointer did not activate enhancement'
  assert page.locator('.etch-light').evaluate('(e)=>+getComputedStyle(e).opacity')>0
  assert bounds(page)==initial,'Content or controls moved'
  page.screenshot(path=str(SHOTS/'foundation-main-pointer-1440.png'),full_page=True)
  active=assert_idle(page);report['motion']['stationary_active_pointer_settles']={'frames':active,'passed':True}
  page.mouse.move(300,100);assert_idle(page)
  assert page.locator('.etch-light').evaluate('(e)=>+getComputedStyle(e).opacity')==0,'Glow did not return to rest'
  # Real IntersectionObserver responds when the decorative region leaves viewport.
  page.locator('.etch-region').evaluate('(e)=>e.style.top="-1000px"');page.wait_for_timeout(150);count=page.evaluate('__frames.calls');page.mouse.move(1300,300);page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count
  report['motion']['offscreen_idle']='passed'
  page.locator('.etch-region').evaluate('(e)=>e.style.top="150px"');page.wait_for_timeout(150);page.mouse.move(1300,400);page.wait_for_timeout(50)
  page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');count=page.evaluate('__frames.calls');page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count and page.evaluate('__frames.pending')==0
  page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');report['motion']['simulated_hidden_gate']='passed'
  page.emulate_media(reduced_motion='reduce');page.mouse.move(1400,500);count=page.evaluate('__frames.calls');page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count
  assert page.locator('.etch-plane').evaluate('(e)=>getComputedStyle(e).transform') in ['none','matrix(1, 0, 0, 1, 0, 0)']
  page.screenshot(path=str(SHOTS/'foundation-main-reduced-1440.png'),full_page=True)
  page.emulate_media(reduced_motion='no-preference',forced_colors='active');assert not page.locator('.etch-region').is_visible();count=page.evaluate('__frames.calls');page.mouse.move(1350,350);page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count
  page.screenshot(path=str(SHOTS/'foundation-main-forced-colors-1440.png'),full_page=True)
  report['motion']['runtime_preferences']='passed'
  durations=page.evaluate('__frames.durations');durations.sort();report['motion']['callback_timing_ms']={'samples':len(durations),'median':durations[len(durations)//2],'p95':durations[min(len(durations)-1,int(len(durations)*.95))],'max':max(durations),'measurement':'Instrumented local rAF JavaScript callback only; not paint/compositing or a real-device frame-rate claim'}
  context.close()
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_init_script(COUNTERS)
  for name in names:
   page=context.new_page();page.goto(base+'/'+name);page.wait_for_timeout(100);initial=bounds(page)
   page.mouse.move(1420,300);page.wait_for_timeout(120)
   assert page.evaluate('__frames.calls')>0,('Shared motion inactive',name)
   assert bounds(page)==initial,('Shared motion moved content',name)
   assert_idle(page);page.close()
  context.close();report['motion']['shared_module_all_routes']='passed'
  # Validate intentional static fallback on every page, including readable content and keyboard.
  context=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':1000})
  for name in names:
   page=context.new_page();page.goto(base+'/'+name);assert page.locator('h1').is_visible();assert not overflow(page)
   page.keyboard.press('Tab');assert page.locator(':focus').inner_text()=='Skip to content'
   if name=='index.html':page.screenshot(path=str(SHOTS/'foundation-main-no-js-390.png'),full_page=True)
   page.close()
  context.close();report['motion']['no_js_all_pages']='passed'
  context=browser.new_context(has_touch=True,is_mobile=True,viewport={'width':390,'height':1000});context.add_init_script(COUNTERS);page=context.new_page();page.goto(base+'/index.html');page.mouse.move(385,300);page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==0;assert page.locator('.etch-light').evaluate('(e)=>getComputedStyle(e).display')=='none';context.close();report['motion']['coarse_pointer_static']='passed'
  context=browser.new_context(reduced_motion='reduce',forced_colors='active',viewport={'width':390,'height':1000})
  for name in names:
   page=context.new_page();page.goto(base+'/'+name);assert not overflow(page);assert not page.locator('.etch-region').is_visible();assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior')=='auto';page.close()
  context.close();report['motion']['forced_colors_reduced_all_pages']='passed';browser.close()
 report['result']='passed'
finally:
 server.shutdown();(SHOTS/'foundation-checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
