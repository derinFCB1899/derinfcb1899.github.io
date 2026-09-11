(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function readPreference() {
    try { root.dataset.motion = reduced.matches || localStorage.getItem('adc-motion') === 'paused' ? 'paused' : 'active'; }
    catch { root.dataset.motion = reduced.matches ? 'paused' : 'active'; }
  }
  readPreference();
  const allowed = () => root.dataset.motion === 'active' && !reduced.matches && !document.hidden;
  // Registered in the head before the browser's first rendering opportunity.
  window.addEventListener('pagereveal', event => {
    readPreference();
    root.dataset.nativeTransition = String(Boolean(event.viewTransition));
    if (!allowed()) event.viewTransition?.skipTransition();
  });
  window.addEventListener('pageswap', event => {
    readPreference();
    if (!allowed()) event.viewTransition?.skipTransition();
  });

  // Keep bookmarks from the former one-page portfolio useful.
  if (location.pathname === '/' && ['#work', '#contact'].includes(location.hash)) {
    location.replace('/' + location.hash.slice(1) + '/');
    return;
  }
})();
