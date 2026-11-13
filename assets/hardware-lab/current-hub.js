// Mark the Tools hub as the current tab on this sub-page (site.js only maps apfs-recovery.html).
for (const a of document.querySelectorAll('.site-nav a, .footer-nav a')) {
  const href = a.getAttribute('href') || '';
  if (href === 'tools.html' || href.endsWith('/tools.html')) {
    a.setAttribute('aria-current', 'true');
  }
}
