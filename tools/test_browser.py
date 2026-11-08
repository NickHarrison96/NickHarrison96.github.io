"""Headless-only cybernetic foundation checks; no unknown uploaded code is loaded."""
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
 for cls in ['.team-name','.team-role']:
  for fact in source.select(cls):assert fact.get_text() in target.get_text()
 for fact in ['technical direction','security strategy','background in the arts','day-to-day operations','client relations','QA and beta testing']:assert fact in target.get_text()
 assert 'For consumer electronics repair' not in target.get_text()
 report['static']['sourced_team_identities_roles_responsibilities']='passed'
for cmd in ['diskutil apfs addVolume disk3 APFS "Untitled"','sudo chown -R $(whoami) "/Volumes/Big Mac - Data/Users/nick"']:
 assert cmd in BeautifulSoup((ROOT/'apfs-recovery.html').read_text(),'html.parser').get_text()
report['static']['apfs_commands']='passed'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
COUNTERS='''(()=>{const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);const m=window.__frames={calls:0,pending:0,durations:[]};const ids=new Set();window.requestAnimationFrame=fn=>{let id=request(t=>{ids.delete(id);m.pending=ids.size;m.calls++;const start=performance.now();fn(t);m.durations.push(performance.now()-start)});ids.add(id);m.pending=ids.size;return id};window.cancelAnimationFrame=id=>{ids.delete(id);m.pending=ids.size;cancel(id)}})();'''
def overflow(page):return page.evaluate('document.documentElement.scrollWidth > innerWidth')
def bounds(page):return page.locator('main h1, main p, main a, header a, header button').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
def animations(page):
 return page.locator('.cyber-region').evaluate('(e)=>e.getAnimations({subtree:true}).map(a=>({name:a.animationName,state:a.playState,time:a.currentTime}))')
def assert_paused(page):
 assert all(a['state']!='running' for a in animations(page)),animations(page)
def assert_energy_running(page):
 assert any(a['name']=='energy-route' and a['state']=='running' for a in animations(page)),animations(page)
def assert_idle(page):
 page.wait_for_timeout(2000);start=page.evaluate('__frames.calls');page.wait_for_timeout(250);assert page.evaluate('__frames.calls')==start,'Pointer spring failed to settle (CSS energy animation is separately controlled)';assert page.evaluate('__frames.pending')==0;return start
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
    assert_energy_running(page)
    # Screenshot shows the shared energy field without pointer activity.
    slug='main' if name=='index.html' else Path(name).stem
    page.screenshot(path=str(SHOTS/f'cyber-{slug}-{width}.png'),full_page=True)
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
  assert page.evaluate('__frames.calls')==0,'Pointer rAF runs before input'
  assert_energy_running(page)
  css_before=animations(page);page.wait_for_timeout(200);css_after=animations(page)
  assert any(b['time']>a['time'] for a,b in zip(css_before,css_after)),'CSS energy clock did not advance'
  initial=bounds(page);page.mouse.move(1320,380);page.wait_for_timeout(140)
  assert page.evaluate('__frames.calls')>0,'Pointer did not activate enhancement'
  assert page.locator('.etch-light').evaluate('(e)=>+getComputedStyle(e).opacity')>0
  assert bounds(page)==initial,'Content or controls moved'
  page.screenshot(path=str(SHOTS/'cyber-main-pointer-1440.png'),full_page=True)
  active=assert_idle(page);report['motion']['stationary_active_pointer_settles']={'frames':active,'passed':True}
  page.mouse.move(300,100);assert_idle(page)
  assert page.locator('.etch-light').evaluate('(e)=>+getComputedStyle(e).opacity')==0,'Glow did not return to rest'
  # Real IntersectionObserver responds when the decorative region leaves viewport.
  page.locator('.etch-region').evaluate('(e)=>e.style.top="-1000px"');page.wait_for_timeout(150);count=page.evaluate('__frames.calls');page.mouse.move(1300,300);page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count
  assert_paused(page)
  report['motion']['offscreen_idle']='passed'
  page.locator('.etch-region').evaluate('(e)=>e.style.top="150px"');page.wait_for_timeout(150);page.mouse.move(1300,400);page.wait_for_timeout(50)
  page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');count=page.evaluate('__frames.calls');page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count and page.evaluate('__frames.pending')==0
  assert_paused(page)
  page.evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))');assert_energy_running(page);report['motion']['simulated_hidden_gate']='passed'
  page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100);assert_paused(page);assert page.locator('.motion-toggle').is_disabled();assert page.locator('.motion-toggle').get_attribute('aria-pressed')=='false';page.mouse.move(1400,500);count=page.evaluate('__frames.calls');page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count
  assert page.locator('.etch-plane').evaluate('(e)=>getComputedStyle(e).transform') in ['none','matrix(1, 0, 0, 1, 0, 0)']
  page.screenshot(path=str(SHOTS/'cyber-main-reduced-1440.png'),full_page=True)
  page.emulate_media(reduced_motion='no-preference',forced_colors='active');assert not page.locator('.etch-region').is_visible();count=page.evaluate('__frames.calls');page.mouse.move(1350,350);page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==count
  page.screenshot(path=str(SHOTS/'cyber-main-forced-colors-1440.png'),full_page=True)
  report['motion']['runtime_preferences']='passed'
  durations=page.evaluate('__frames.durations');durations.sort();report['motion']['callback_timing_ms']={'samples':len(durations),'median':durations[len(durations)//2],'p95':durations[min(len(durations)-1,int(len(durations)*.95))],'max':max(durations),'measurement':'Instrumented local rAF JavaScript callback only; not paint/compositing or a real-device frame-rate claim'}
  context.close()
  # Explicit keyboard pause, no movement on state change, persistence and system priority.
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_init_script(COUNTERS);page=context.new_page();page.goto(base+'/index.html');page.wait_for_timeout(150)
  toggle=page.locator('.motion-toggle');assert toggle.get_attribute('aria-pressed')=='true'
  toggle.focus();before_toggle=bounds(page);page.keyboard.press('Space');assert toggle.get_attribute('aria-pressed')=='false';assert bounds(page)==before_toggle
  assert_paused(page);assert page.evaluate('__frames.pending')==0
  paused_before=animations(page);page.wait_for_timeout(200);paused_after=animations(page)
  assert all(abs(b['time']-a['time'])<1 for a,b in zip(paused_before,paused_after)),'Paused CSS clock moved'
  page.screenshot(path=str(SHOTS/'cyber-main-paused-1440.png'),full_page=True)
  for name in ['writeups.html','tutorials.html','index.html']:
   page.goto(base+'/'+name);page.wait_for_timeout(100);assert page.locator('.motion-toggle').get_attribute('aria-pressed')=='false';assert_paused(page)
  page.locator('.motion-toggle').focus();page.keyboard.press('Enter');assert page.locator('.motion-toggle').get_attribute('aria-pressed')=='true';assert_energy_running(page)
  # Stored On never overrides the system reduced-motion request, including navigation.
  page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100);assert_paused(page);assert page.locator('.motion-toggle').is_disabled();page.reload();assert_paused(page)
  page.emulate_media(reduced_motion='no-preference');page.wait_for_timeout(100);assert_energy_running(page)
  # Active renderer metrics include style/layout/tasks, not GPU or a promised frame rate.
  session=context.new_cdp_session(page);session.send('Performance.enable')
  def metrics():return {m['name']:m['value'] for m in session.send('Performance.getMetrics')['metrics']}
  m0=metrics();page.wait_for_timeout(1200);m1=metrics()
  report['motion']['active_renderer_window_ms']={key:round((m1.get(key,0)-m0.get(key,0))*1000,3) for key in ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration']}
  report['motion']['active_renderer_window_ms']['window']=round((m1['Timestamp']-m0['Timestamp'])*1000,3)
  report['motion']['css_energy_running_pause_persistence_keyboard']='passed'
  context.close()
  context=browser.new_context(viewport={'width':1440,'height':1000});context.add_init_script(COUNTERS)
  for name in names:
   page=context.new_page();page.goto(base+'/'+name);page.wait_for_timeout(100);initial=bounds(page)
   assert_energy_running(page)
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
   assert not page.locator('.motion-toggle').is_visible();assert_paused(page)
   if name=='index.html':page.screenshot(path=str(SHOTS/'cyber-main-no-js-390.png'),full_page=True)
   page.close()
  context.close();report['motion']['no_js_all_pages']='passed'
  context=browser.new_context(has_touch=True,is_mobile=True,viewport={'width':390,'height':1000});context.add_init_script(COUNTERS);page=context.new_page();page.goto(base+'/index.html');page.mouse.move(385,300);page.wait_for_timeout(200);assert page.evaluate('__frames.calls')==0;assert_paused(page);assert page.locator('.motion-toggle').is_disabled();assert page.locator('.etch-light').evaluate('(e)=>getComputedStyle(e).display')=='none';context.close();report['motion']['coarse_pointer_static']='passed'
  context=browser.new_context(reduced_motion='reduce',forced_colors='active',viewport={'width':390,'height':1000})
  for name in names:
   page=context.new_page();page.goto(base+'/'+name);assert not overflow(page);assert not page.locator('.etch-region').is_visible();assert page.evaluate('getComputedStyle(document.documentElement).scrollBehavior')=='auto';page.close()
  context.close();report['motion']['forced_colors_reduced_all_pages']='passed'
  # A short headless capture for human review, not a claim of manual video inspection.
  recording=browser.new_context(viewport={'width':1440,'height':1000},record_video_dir=str(SHOTS/'recordings'),record_video_size={'width':1440,'height':1000})
  page=recording.new_page();page.goto(base+'/index.html');page.wait_for_timeout(800)
  for x,y in [(1100,250),(1320,400),(1150,650),(900,440)]:page.mouse.move(x,y,steps=20);page.wait_for_timeout(700)
  page.locator('.motion-toggle').click();page.wait_for_timeout(800)
  video=page.video;page.close();video.save_as(str(SHOTS/'cyber-main-motion-review.webm'));recording.close()
  report['motion']['recording']='cyber-main-motion-review.webm (generated; not manually watched)'
  browser.close()
 report['result']='passed'
finally:
 server.shutdown();(SHOTS/'cyber-checks.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
