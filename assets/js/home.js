// Legacy homepage deep links, forwarded directly to their durable targets.
const moved = { '#log':'writing.html#log', '#philosophy':'writing.html#philosophy' };
if(moved[location.hash]) location.replace(moved[location.hash]);
// A direct link to the optional demo opens it without blocking any other content.
if(location.hash==='#terminal') document.getElementById('terminal').open=true;
