// No hidden global key sequence and no persisted surprise theme. Explicit opt-in only.
const b=document.getElementById('fun-mode');
b?.addEventListener('click',()=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));document.documentElement.dataset.jailbreak=String(on);b.textContent=on?'Exit jailbreak styling':'Enable jailbreak styling';});
