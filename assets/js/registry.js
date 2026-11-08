// Shared by search and the optional terminal; only real pages and sections.
export const PAGES = [
  {label:'Home', key:'home', href:'index.html', kind:'page'},
  {label:'Repair Services', key:'services', href:'services.html', kind:'page', keys:'phones macs pc laptop data recovery local drop-off remote limits'},
  {label:'Work', key:'work', href:'work.html', kind:'page', keys:'projects opencore engineering'},
  {label:'Tools', key:'tools', href:'downloads.html', kind:'page', keys:'downloads software'},
  {label:'Blog', key:'blog', href:'writing.html', kind:'page', keys:'writing notes'},
  {label:'About', key:'about', href:'about.html', kind:'page', keys:'team nick kate-lyn shiloh'},
  {label:'Get in touch', key:'contact', href:'about.html#contact', kind:'section', keys:'email'},
  {label:'APFS recovery case study', key:'apfs', href:'apfs-recovery.html', kind:'case study', keys:'macos data'},
  {label:'Right to Repair', key:'advocacy', href:'repair.html', kind:'resource'},
  {label:'Interactive demo', key:'demo', href:'index.html#terminal', kind:'optional demo'},
];
