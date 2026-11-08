from pathlib import Path
from html.parser import HTMLParser
import re
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
  for excluded in ['repair','teardown','disassembly']:
   assert excluded not in text.lower(),f'Excluded positioning returned: {file} / {excluded}'
 home=(ROOT/'index.html').read_text()
 for discipline in ['behind the scenes','protect and recover data','share what i learn','share it freely']:assert discipline in home.lower(),discipline
 assert 'I’m Nick, a security researcher and tech enthusiast.' in home
 assert 'Repair grew out' not in home
 assert 'repair services' not in home.lower()
 assert 'writeup-card' not in home and 'hero-art' not in home
 assert 'No tutorials published yet.' in (ROOT/'tutorials.html').read_text()
 print('PASS static foundation routes, navigation, links, IDs, content scope')
if __name__=='__main__':check()
