#!/usr/bin/env python3
"""Generate static pages. Python standard library only; no runtime build required."""
from pathlib import Path
from html import escape
import json
ROOT=Path(__file__).resolve().parent
NAV=[('main','index.html','Main'),('writeups','writeups.html','Write-ups'),('tutorials','tutorials.html','Tutorials')]
def render(p):
 nav=''.join(f'<a href="{file}"'+(' aria-current="page"' if section==p['section'] else '')+f'>{label}</a>' for section,file,label in NAV)
 body=(ROOT/'content'/p['file']).read_text()
 title=escape(p['title']); desc=escape(p['description'],quote=True)
 draft='<meta name="robots" content="noindex, nofollow">' if p.get('draft') else ''
 return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0B0F14"><title>{title} | Harrison Technology Solutions</title><meta name="description" content="{desc}"><meta property="og:title" content="{title}"><meta property="og:type" content="website"><meta property="og:image" content="assets/social-share.png">{draft}<link rel="icon" href="assets/logo.svg" type="image/svg+xml"><link rel="stylesheet" href="styles.css"><script type="module" src="assets/motion.js"></script></head>
<body class="page-{p['variant']}"><a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap header-inner"><a class="brand" href="index.html"><img src="assets/logo.svg" alt="Harrison Technology Solutions" width="208" height="52"></a><nav aria-label="Main navigation">{nav}</nav><button class="motion-toggle" type="button" hidden aria-pressed="false" aria-describedby="motion-help"><span class="motion-dot" aria-hidden="true"></span><span>Motion</span><span data-motion-state>Off</span></button><span id="motion-help" class="sr-only">Controls decorative animation only. System reduced-motion settings take priority.</span></div></header>
<div class="etch-region cyber-region" aria-hidden="true"><div class="cyber-underlay"></div><div class="etch-plane"><img class="etch-base" src="assets/cyber-field.svg" alt="" width="560" height="720"><div class="cyber-core"></div><svg class="cyber-energy" viewBox="0 0 560 720" fill="none"><g stroke="#7dd3fc" stroke-width="2.5"><path class="energy-path" pathLength="1000" d="M0 79h118l64 64h137l40 40"/><path class="energy-path energy-second" pathLength="1000" d="M560 70h-91l-42 42H273l-30 30"/><path class="energy-path energy-third" pathLength="1000" d="M560 654H435l-62-62H201l-45 45H0"/><path class="energy-path energy-fourth" pathLength="1000" d="M0 422h72l66-66v-82l52-52h202l52 52v202l-52 52H190"/></g><g class="energy-nodes" fill="#7dd3fc"><circle cx="118" cy="79" r="3"/><circle cx="427" cy="112" r="3"/><circle cx="72" cy="422" r="3"/><circle cx="435" cy="654" r="3"/></g></svg><svg class="etch-joints" viewBox="0 0 560 720" fill="none"><g stroke="#7dd3fc" stroke-width="1.5"><path d="M256 252h72l26 26v20M256 499h72l26-26v-20"/><path d="M169 346v60M415 346v60"/></g></svg></div><div class="etch-light"></div></div>
<main id="main" class="wrap" tabindex="-1">{body}</main>
<footer class="site-footer"><div class="wrap footer-inner"><span>Harrison Technology Solutions</span><nav aria-label="Footer"><a href="about.html">About Nick &amp; the team</a><a href="mailto:harrisontechdev@gmail.com">Email</a></nav></div></footer></body></html>'''
def build():
 pages=json.loads((ROOT/'pages.json').read_text())
 for page in pages:(ROOT/page['file']).write_text(render(page))
 print(f'Built {len(pages)} static pages.')
if __name__=='__main__':build()
