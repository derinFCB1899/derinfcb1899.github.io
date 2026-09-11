(() => {
  'use strict';

  // Content is visible by default. Animation enhances the static page without
  // becoming a dependency for reading, navigation, or opening project links.
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const toggle = document.getElementById('motion-toggle');
  const hero = document.querySelector('.hero');
  const progress = document.querySelector('.reading-progress');
  const running = new Set();
  const pixelJobs = new Map();
  let manualPause = false;
  let scrollFrame = 0;

  try { manualPause = localStorage.getItem('adc-motion') === 'paused'; } catch {}
  const canAnimate = () => !manualPause && !reducedMotion.matches && !document.hidden;

  function updateMotion() {
    const disabled = manualPause || reducedMotion.matches;
    root.dataset.motion = disabled ? 'paused' : 'active';
    root.dataset.pageHidden = String(document.hidden);
    if (disabled || document.hidden) {
      [...pixelJobs.values()].forEach(job => job.finish());
    }
    toggle.hidden = false;
    toggle.disabled = reducedMotion.matches;
    toggle.setAttribute('aria-pressed', String(disabled));
    toggle.querySelector('.motion-label').textContent = reducedMotion.matches
      ? 'Reduced motion' : manualPause ? 'Enable motion' : 'Pause motion';
    toggle.querySelector('.motion-icon').textContent = disabled ? '▷' : 'Ⅱ';
    toggle.title = reducedMotion.matches ? 'Following your device’s reduced-motion preference' : '';
    if (disabled) {
      running.forEach(animation => animation.cancel());
      running.clear();
      hero.style.removeProperty('--hero-x');
      hero.style.removeProperty('--hero-y');
      document.querySelectorAll('.surface').forEach(surface => surface.style.removeProperty('rotate'));
      document.querySelectorAll('.button').forEach(button => button.style.removeProperty('translate'));
    } else {
      running.forEach(animation => document.hidden ? animation.pause() : animation.play());
    }
    window.dispatchEvent(new CustomEvent('adc:motionchange', { detail: { paused: disabled } }));
  }

  toggle.addEventListener('click', () => {
    manualPause = !manualPause;
    try { localStorage.setItem('adc-motion', manualPause ? 'paused' : 'active'); } catch {}
    updateMotion();
  });
  reducedMotion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  function restorePreference() {
    try { manualPause = localStorage.getItem('adc-motion') === 'paused'; } catch {}
    updateMotion();
  }
  window.addEventListener('pageshow', restorePreference);
  window.addEventListener('storage', event => {
    if (event.key === 'adc-motion') restorePreference();
  });
  updateMotion();

  function reveal(element, delay = 0) {
    if (!canAnimate() || typeof element.animate !== 'function') return;
    const entrance = element.hasAttribute('data-entrance');
    const animation = element.animate([
      { opacity: entrance ? 0 : .45, transform: 'perspective(1200px) translate3d(0, 50px, -35px) rotateX(8deg)', filter: entrance ? 'blur(5px)' : 'blur(1px)' },
      { opacity: 1, transform: 'perspective(1200px) translate3d(0, 0, 0) rotateX(0deg)', filter: 'blur(0px)' }
    ], { duration: entrance ? 1200 : 1000, delay, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' });
    running.add(animation);
    animation.finished.then(() => running.delete(animation), () => running.delete(animation));
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
    const duration = 700;
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
      const phase = Math.floor(progress * 12) / 12;
      tiles.forEach(tile => {
        if (phase >= tile.release) return;
        // Never fully cover the real content, and keep the accent sparse.
        const alpha = (tile.accent ? .15 : .57) * (1 - phase * .7);
        context.fillStyle = tile.accent ? 'rgba(103,237,255,' + alpha + ')' : 'rgba(7,17,31,' + alpha + ')';
        context.fillRect(tile.x, tile.y, 1, 1);
      });
    }
    function tick(now) {
      if (finished) return;
      if (!canAnimate() || element.contains(document.activeElement)) { finish(); return; }
      const progress = Math.min(1, (now - start) / duration);
      if (progress >= 1) { finish(); return; }
      if (now - lastPaint >= 32) { paint(progress); lastPaint = now; }
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
      ], { duration: 520, easing: 'steps(1, end)' });
      running.add(glitch);
      glitch.finished.then(() => running.delete(glitch), () => running.delete(glitch));
    }
  }

  document.addEventListener('focusin', event => {
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
        if (now - state.lastPlayed < 2200 || !canAnimate()) return;
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
  window.addEventListener('scroll', queueScroll, { passive: true });
  window.addEventListener('resize', queueScroll, { passive: true });
  window.addEventListener('load', queueScroll, { once: true });
  updateScroll();

  // Pointer effects run only on pointer events, with at most one update per frame.
  document.querySelectorAll('.surface, .hero').forEach(surface => {
    let pointerFrame = 0;
    let point = null;
    surface.addEventListener('pointermove', event => {
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
    surface.addEventListener('pointerleave', () => {
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
    button.addEventListener('pointermove', event => {
      if (!canAnimate() || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = button.getBoundingClientRect();
      const x = (event.clientX - bounds.left - bounds.width / 2) * .11;
      const y = (event.clientY - bounds.top - bounds.height / 2) * .18;
      button.style.translate = Math.max(-8, Math.min(8, x)).toFixed(1) + 'px ' + Math.max(-5, Math.min(5, y)).toFixed(1) + 'px';
    }, { passive: true });
    button.addEventListener('pointerleave', () => button.style.removeProperty('translate'));
    button.addEventListener('blur', () => button.style.removeProperty('translate'));
  });
})();
