(() => {
  'use strict';

  let cleanup;
  function mount() {
  cleanup?.();
  const controller = new AbortController();
  const observers = [];
  const pointerCleanups = [];
  const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: controller.signal });

  // Content is visible by default. Animation enhances the static page without
  // becoming a dependency for reading, navigation, or opening project links.
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const hero = document.querySelector('.hero');
  const progress = document.querySelector('.reading-progress');
  const running = new Set();
  const revealAnimations = new Map();
  const pixelJobs = new Map();
  let scrollFrame = 0;

  const canAnimate = () => !reducedMotion.matches && !document.hidden;

  function updateMotion() {
    const disabled = reducedMotion.matches;
    root.dataset.motion = disabled ? 'paused' : 'active';
    root.dataset.pageHidden = String(document.hidden);
    if (disabled || document.hidden) {
      [...pixelJobs.values()].forEach(job => job.finish());
    }
    if (disabled) {
      running.forEach(animation => animation.cancel());
      running.clear();
      revealAnimations.clear();
      hero.style.removeProperty('--hero-x');
      hero.style.removeProperty('--hero-y');
      document.querySelectorAll('.surface').forEach(surface => surface.style.removeProperty('rotate'));
      document.querySelectorAll('.button').forEach(button => button.style.removeProperty('translate'));
    } else {
      running.forEach(animation => document.hidden ? animation.pause() : animation.play());
    }
    window.dispatchEvent(new CustomEvent('adc:motionchange', { detail: { paused: disabled } }));
  }

  listen(reducedMotion, 'change', updateMotion);
  listen(document, 'visibilitychange', updateMotion);
  listen(window, 'pageshow', updateMotion);
  updateMotion();

  function reveal(element, delay = 0) {
    if (!canAnimate() || typeof element.animate !== 'function') return;
    const entrance = element.hasAttribute('data-entrance');
    const animation = element.animate([
      { opacity: entrance ? 0 : .45, transform: entrance ? 'perspective(1200px) translate3d(0, 30px, -20px) rotateX(5deg)' : 'none', filter: entrance ? 'blur(5px)' : 'blur(1px)' },
      { opacity: 1, transform: entrance ? 'perspective(1200px) translate3d(0, 0, 0) rotateX(0deg)' : 'none', filter: 'blur(0px)' }
    ], { duration: entrance ? 1500 : 1450, delay, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' });
    revealAnimations.get(element)?.cancel();
    revealAnimations.set(element, animation);
    running.add(animation);
    const cleanup = () => {
      running.delete(animation);
      if (revealAnimations.get(element) === animation) revealAnimations.delete(element);
    };
    animation.finished.then(cleanup, cleanup);
  }

  const alreadyPainted = performance.getEntriesByType?.('paint').some(entry => entry.name === 'first-contentful-paint');
  if (!alreadyPainted) [...document.querySelectorAll('[data-entrance]')].forEach((element, index) => reveal(element, 100 + index * 140));

  function pixelReveal(element) {
    if (!canAnimate() || element.contains(document.activeElement) || pixelJobs.has(element) || pixelJobs.size >= 3) return;
    const bounds = element.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    const overlay = document.createElement('canvas');
    const context = overlay.getContext('2d', { alpha: true });
    if (!context) return;
    // A tiny canvas enlarged with nearest-neighbour sampling gives crisp pixels
    // without screenshots, duplicated content, or a high-resolution buffer.
    const columns = Math.max(6, Math.min(32, Math.ceil(bounds.width / 30)));
    const rows = Math.max(2, Math.min(22, Math.ceil(bounds.height / 30)));
    overlay.width = columns;
    overlay.height = rows;
    overlay.className = 'pixel-reveal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'presentation');
    const tiles = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const seed = ((x + 1) * 73 + (y + 3) * 151 + x * y * 19) % 997;
        tiles.push({ x, y, release: .13 + (seed / 997) * .55 + (x / columns + y / rows) * .13, accent: seed % 13 === 0 });
      }
    }

    let frame = 0;
    let lastPaint = -Infinity;
    let finished = false;
    let glitch;
    const start = performance.now();
    const duration = 1600;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      overlay.remove();
      element.removeAttribute('data-pixel-revealing');
      if (glitch) { glitch.cancel(); running.delete(glitch); }
      pixelJobs.delete(element);
    };
    pixelJobs.set(element, { finish });
    element.setAttribute('data-pixel-revealing', '');
    element.appendChild(overlay);

    function paint(progress) {
      context.clearRect(0, 0, columns, rows);
      const phase = progress;
      tiles.forEach(tile => {
        if (phase >= tile.release) return;
        // Never fully cover the real content, and keep the accent sparse.
        const fade = Math.max(0, Math.min(1, (phase - tile.release + .28) / .28));
        const alpha = (tile.accent ? .16 : .46) * (1 - fade * fade * (3 - 2 * fade));
        const color = root.dataset.theme === 'light' ? (tile.accent ? '255,205,122' : '207,80,125') : (tile.accent ? '103,237,255' : '7,17,31');
        context.fillStyle = 'rgba(' + color + ',' + alpha + ')';
        context.fillRect(tile.x, tile.y, 1, 1);
      });
    }
    function tick(now) {
      if (finished) return;
      if (!canAnimate() || element.contains(document.activeElement)) { finish(); return; }
      const progress = Math.min(1, (now - start) / duration);
      if (progress >= 1) { finish(); return; }
      if (now - lastPaint >= 16) { paint(progress); lastPaint = now; }
      frame = requestAnimationFrame(tick);
    }
    paint(0);
    frame = requestAnimationFrame(tick);

    const heading = element.querySelector('h2, h3');
    if (heading && typeof heading.animate === 'function') {
      glitch = heading.animate([
        { offset: 0, textShadow: '0 0 transparent', translate: '0px 0px' },
        { offset: .32, textShadow: '0 0 transparent', translate: '0px 0px' },
        { offset: .38, textShadow: '1.5px 0 rgba(103,237,255,.65), -1.5px 0 rgba(237,134,237,.5)', translate: '1px 0px' },
        { offset: .5, textShadow: '-1px 0 rgba(103,237,255,.3), 1px 0 rgba(237,134,237,.3)', translate: '-1px 0px' },
        { offset: .62, textShadow: '0 0 transparent', translate: '0px 0px' },
        { offset: 1, textShadow: '0 0 transparent', translate: '0px 0px' }
      ], { duration: 1000, easing: 'cubic-bezier(.4,0,.2,1)' });
      running.add(glitch);
      glitch.finished.then(() => running.delete(glitch), () => running.delete(glitch));
    }
  }

  listen(document, 'focusin', event => {
    for (const [element, animation] of revealAnimations) {
      if (element.contains(event.target)) { animation.cancel(); running.delete(animation); revealAnimations.delete(element); }
    }
    for (const [element, job] of pixelJobs) {
      if (element.contains(event.target)) job.finish();
    }
  });

  if ('IntersectionObserver' in window) {
    const visibility = new WeakMap();
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const state = visibility.get(entry.target);
        if (!state) return;
        if (!entry.isIntersecting) {
          // Rearm only when fully outside the actual viewport. Boundary jitter
          // cannot repeatedly interrupt text that the visitor is reading.
          const bounds = entry.boundingClientRect;
          if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) {
            state.armed = true;
            pixelJobs.get(entry.target)?.finish();
          }
          return;
        }
        if (!state.armed) return;
        state.armed = false;
        const now = performance.now();
        if (now - state.lastPlayed < 3200 || !canAnimate()) return;
        state.lastPlayed = now;
        if (!entry.target.contains(document.activeElement)) reveal(entry.target);
        pixelReveal(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px' });
    document.querySelectorAll('[data-reveal]').forEach(element => {
      const bounds = element.getBoundingClientRect();
      visibility.set(element, { armed: bounds.bottom <= 0 || bounds.top >= window.innerHeight, lastPlayed: -Infinity });
      reveals.observe(element);
    });

    const heroVisibility = new IntersectionObserver(entries => {
      hero.dataset.inView = String(entries[0].isIntersecting);
    }, { threshold: 0 });
    heroVisibility.observe(hero);
    observers.push(reveals, heroVisibility);
  } else {
    hero.dataset.inView = 'true';
  }

  function updateScroll() {
    scrollFrame = 0;
    const available = root.scrollHeight - window.innerHeight;
    const position = window.scrollY;
    progress.style.transform = 'scaleX(' + (available > 0 ? Math.min(1, Math.max(0, position / available)) : 0) + ')';

  }
  function queueScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }
  listen(window, 'scroll', queueScroll, { passive: true });
  listen(window, 'resize', queueScroll, { passive: true });
  listen(window, 'load', queueScroll, { once: true });
  updateScroll();

  // Pointer effects run only on pointer events, with at most one update per frame.
  document.querySelectorAll('.surface, .hero').forEach(surface => {
    let pointerFrame = 0;
    let point = null;
    pointerCleanups.push(() => cancelAnimationFrame(pointerFrame));
    listen(surface, 'pointermove', event => {
      if (!canAnimate() || !finePointer.matches || event.pointerType === 'touch') return;
      point = { x: event.clientX, y: event.clientY };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!point || !canAnimate()) return;
        const bounds = surface.getBoundingClientRect();
        const x = point.x - bounds.left;
        const y = point.y - bounds.top;
        if (surface === hero) {
          surface.style.setProperty('--hero-x', ((x / bounds.width - .5) * 14).toFixed(2) + 'px');
          surface.style.setProperty('--hero-y', ((y / bounds.height - .5) * 10).toFixed(2) + 'px');
        } else {
          surface.style.setProperty('--light-x', x.toFixed(1) + 'px');
          surface.style.setProperty('--light-y', y.toFixed(1) + 'px');
          const nx = (x / bounds.width - .5) * 2;
          const ny = (y / bounds.height - .5) * 2;
          const angle = Math.min(Math.hypot(nx, ny), 1) * 2.5;
          surface.style.rotate = (-ny).toFixed(3) + ' ' + nx.toFixed(3) + ' 0 ' + angle.toFixed(2) + 'deg';
        }
      });
    }, { passive: true });
    listen(surface, 'pointerleave', () => {
      point = null;
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      surface.style.removeProperty('rotate');
      if (surface === hero) {
        surface.style.setProperty('--hero-x', '0px');
        surface.style.setProperty('--hero-y', '0px');
      }
    });
  });

  document.querySelectorAll('.button').forEach(button => {
    listen(button, 'pointermove', event => {
      if (!canAnimate() || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = button.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) * .11;
      const y = (event.clientY - bounds.top - bounds.height / 2) * .18;
      button.style.translate = Math.max(-8, Math.min(8, x)).toFixed(1) + 'px ' + Math.max(-5, Math.min(5, y)).toFixed(1) + 'px';
    }, { passive: true });
    listen(button, 'pointerleave', () => button.style.removeProperty('translate'));
    listen(button, 'blur', () => button.style.removeProperty('translate'));
  });
  cleanup = () => {
    controller.abort();
    observers.forEach(observer => observer.disconnect());
    pointerCleanups.forEach(cancel => cancel());
    cancelAnimationFrame(scrollFrame);
    [...pixelJobs.values()].forEach(job => job.finish());
    running.forEach(animation => animation.cancel());
    running.clear();
    revealAnimations.clear();
  };
  }
  mount();
  window.addEventListener('adc:pagebeforechange', () => { cleanup?.(); cleanup = null; });
  window.addEventListener('adc:pagechange', mount);
})();
