(() => {
  'use strict';
  // Keep the world and soundtrack mounted; only the document's main content changes.
  const root = document.documentElement;
  const routes = new Set(['/', '/work/', '/contact/']);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let currentPath = location.pathname;
  let request = 0;
  let pending;
  let transition;
  let scrollFrame = 0;
  let changing = false;
  let currentIndex = Number.isInteger(history.state?.adcIndex) ? history.state.adcIndex : 0;
  const snapshot = page => ({
    main: page.querySelector('main').cloneNode(true),
    page: page.documentElement.dataset.page,
    chapter: page.documentElement.dataset.chapter,
    title: page.title,
    description: page.querySelector('meta[name="description"]').content
  });
  const cache = new Map([[currentPath, snapshot(document)]]);
  const notice = document.createElement('p');
  notice.className = 'route-status';
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  document.body.appendChild(notice);
  history.scrollRestoration = 'manual';

  function saveScroll() {
    history.replaceState({ ...history.state, adcIndex: currentIndex, adcScroll: [scrollX, scrollY] }, '', location.href);
  }
  saveScroll();
  window.addEventListener('scroll', () => {
    if (changing || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; if (!changing) saveScroll(); });
  }, { passive: true });

  function position(url, saved) {
    if (saved) window.scrollTo({ left: saved[0], top: saved[1], behavior: 'instant' });
    else if (url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)))) {
      document.getElementById(decodeURIComponent(url.hash.slice(1))).scrollIntoView({ behavior: 'instant' });
    } else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function cancelPending() {
    request++;
    pending?.abort();
    transition?.skipTransition();
    document.querySelector('main').removeAttribute('aria-busy');
  }

  async function navigate(url, pop = false, saved = null, targetIndex = currentIndex) {
    cancelPending();
    const id = request;
    pending = new AbortController();
    notice.hidden = true;
    document.querySelector('main').setAttribute('aria-busy', 'true');
    try {
      let page = cache.get(url.pathname);
      if (!page) {
        const response = await fetch(url.pathname, { signal: pending.signal });
        if (!response.ok) throw new Error('Page unavailable');
        const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
        if (!parsed.querySelector('main') || !parsed.documentElement.dataset.page) throw new Error('Invalid page');
        page = snapshot(parsed);
        cache.set(url.pathname, page);
      }
      const next = page.main.cloneNode(true);
      if (id !== request) return;
      const commit = () => {
        if (id !== request) return;
        changing = true;
        if (!pop) { saveScroll(); currentIndex++; history.pushState({ adcIndex: currentIndex, adcScroll: [0, 0] }, '', url.href); }
        else currentIndex = targetIndex;
        window.dispatchEvent(new Event('adc:pagebeforechange'));
        document.querySelector('main').replaceWith(next);
        root.dataset.page = page.page;
        root.dataset.chapter = page.chapter;
        document.title = page.title;
        document.querySelector('meta[name="description"]').content = page.description;
        document.querySelectorAll('nav[aria-label="Main navigation"] a').forEach(link => {
          if (new URL(link.href).pathname === url.pathname) link.setAttribute('aria-current', 'page');
          else link.removeAttribute('aria-current');
        });
        currentPath = url.pathname;
        next.setAttribute('tabindex', '-1');
        next.focus({ preventScroll: true });
        position(url, saved);
        window.dispatchEvent(new Event('adc:pagechange'));
        window.dispatchEvent(new Event('adc:chapterchange'));
        changing = false;
        saveScroll();
      };
      if (document.startViewTransition && !reduced.matches && !document.hidden) {
        transition = document.startViewTransition(commit);
        await transition.finished;
      } else commit();
    } catch (error) {
      if (error.name === 'AbortError' || id !== request) return;
      // Keep the current song and content alive when a network request fails.
      notice.textContent = 'This page could not load. Please try the link again.';
      notice.hidden = false;
      if (pop && targetIndex !== currentIndex) history.go(currentIndex - targetIndex);
    } finally {
      if (id === request) document.querySelector('main').removeAttribute('aria-busy');
    }
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !routes.has(url.pathname) || url.search) return;
    if (url.pathname === currentPath && url.pathname === location.pathname && url.hash) { cancelPending(); return; }
    event.preventDefault();
    if (url.pathname === currentPath && url.pathname === location.pathname) { cancelPending(); position(url); return; }
    navigate(url);
  });
  window.addEventListener('popstate', event => {
    const url = new URL(location.href);
    if (url.pathname === currentPath) { cancelPending(); currentIndex = event.state?.adcIndex ?? currentIndex; position(url, event.state?.adcScroll); return; }
    if (routes.has(url.pathname)) navigate(url, true, event.state?.adcScroll, event.state?.adcIndex ?? currentIndex);
    else location.reload();
  });
})();
