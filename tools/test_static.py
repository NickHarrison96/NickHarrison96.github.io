from pathlib import Path
from html.parser import HTMLParser
import re,hashlib,json,colorsys
ROOT=Path(__file__).resolve().parents[1]
EXPECTED=['index.html','writeups.html','tutorials.html','apfs-recovery.html','about.html','writeup-template.html','tutorial-template.html']
NAV=['index.html','writeups.html','tutorials.html']
class Parse(HTMLParser):
 def __init__(self): super().__init__(); self.links=[]; self.ids=[]; self.h1=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='h1':self.h1+=1
  if 'href' in a:self.links.append(a['href'])
  if 'src' in a:self.links.append(a['src'])
def check():
 for file in EXPECTED:
  p=ROOT/file; assert p.exists(),f'Missing foundation route: {file}'
  text=p.read_text(); parser=Parse(); parser.feed(text)
  assert parser.h1==1 and len(parser.ids)==len(set(parser.ids)),file
  nav=re.search(r'<nav aria-label="Main navigation">(.*?)</nav>',text,re.S)
  assert nav and re.findall(r'href="([^"]+)"',nav[1])==NAV,f'Inconsistent primary navigation: {file}'
  assert nav[1].count('aria-current="page"')==1,file
  for link in parser.links:
   if re.match(r'^[a-z]+:',link) or link.startswith('//'):continue
   path,_,frag=link.partition('#'); target=ROOT/path if path else p
   assert target.exists(),f'{file}: missing {link}'
   if frag:
    other=Parse(); other.feed(target.read_text()); assert frag in other.ids,f'{file}: missing #{frag}'
  assert 'assets/motion.js' in text,file
  assert 'class="atmosphere"' in text and 'assets/atmosphere-flow.svg' in text,f'Missing immersive composition: {file}'
  assert 'cyber-field.svg' not in text and 'cyber-region' not in text,f'Old chip art returned: {file}'
  assert 'class="motion-toggle"' in text and 'aria-pressed="false"' in text,f'Missing explicit ambient motion control: {file}'
  for excluded in ['repair','teardown','disassembly']:
   assert excluded not in text.lower(),f'Excluded positioning returned: {file} / {excluded}'
 home=(ROOT/'index.html').read_text()
 for discipline in ['behind the scenes','protect your personal data every day','help companies and their teams','share it freely']:assert discipline in home.lower(),discipline
 assert 'I’m Nick, a security researcher and tech enthusiast. I explore how devices work behind the scenes and how they protect your personal data every day. Through that research, I help companies and their teams make the devices you rely on safer and more secure.' in home
 assert 'Repair grew out' not in home
 assert 'repair services' not in home.lower()
 assert 'writeup-card' not in home and 'hero-art' not in home
 assert 'No tutorials published yet.' in (ROOT/'tutorials.html').read_text()
 for name,digest in json.loads((ROOT/'tools/content-baseline.json').read_text()).items():
  assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,f'Approved content changed: {name}'
 # Explicit authored-color contract: saturated colors must remain cyan/blue/violet.
 for asset in [ROOT/'styles.css',ROOT/'assets/atmosphere-flow.svg',ROOT/'assets/atmosphere-filaments.svg',ROOT/'assets/data-field.svg',ROOT/'assets/logo.svg',ROOT/'build.py']:
  for value in re.findall(r'#[0-9a-fA-F]{3,8}\b',asset.read_text()):
   color=value[1:];color=''.join(c*2 for c in color) if len(color) in [3,4] else color
   if len(color) not in [6,8]:continue
   rgb=[int(color[i:i+2],16)/255 for i in [0,2,4]];h,sat,v=colorsys.rgb_to_hsv(*rgb)
   assert sat<.13 or 180<=h*360<=290,f'Forbidden accent hue in {asset.name}: {value} ({h*360:.1f})'
 print('PASS static foundation, exact content hashes and dark cyan/blue/violet palette')
if __name__=='__main__':check()
