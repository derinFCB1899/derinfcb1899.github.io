(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll('.brand-word, .title-line, .section-heading h2, .feature-content h3, .project-card h3, .toolkit h3')];
  if (!targets.length || typeof targets[0].animate !== 'function') return;
  targets.forEach(target => target.classList.add('signal-text'));
  let timer = 0;
  let active = null;
  let lastTarget = null;
  let leaving = false;
  const allowed = () => !leaving && !document.hidden && !reduced.matches && root.dataset.motion === 'active';
  const selecting = () => window.getSelection()?.isCollapsed === false;
  const random = (min, max) => min + Math.random() * (max - min);

  function eligible(target) {
    const bounds = target.getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect();
    const isBrand = target.classList.contains('brand-word');
    const control = target.closest('a, button');
    return bounds.width > 0 && bounds.height > 0 && bounds.top >= (isBrand ? 0 : header.bottom + 8)
      && bounds.bottom <= innerHeight - 8 && bounds.left >= 0 && bounds.right <= innerWidth
      && !target.closest('[data-pixel-revealing]')
      && !target.contains(document.activeElement)
      && !control?.matches(':hover, :focus-within')
      && !target.getAnimations({ subtree: true }).some(animation => animation.playState === 'running');
  }
  function schedule(initial = false) {
    clearTimeout(timer);
    timer = 0;
    if (allowed()) timer = setTimeout(pulse, initial ? random(4200,6200) : random(7000,13000));
  }
  function finish() {
    if (!active) return;
    const job = active;
    active = null;
    job.animations.forEach(animation => animation.cancel());
    job.echoes.forEach(echo => echo.remove());
    schedule();
  }
  function pulse() {
    timer = 0;
    if (!allowed()) return;
    if (selecting()) { schedule(); return; }
    let candidates = targets.filter(eligible);
    if (candidates.length > 1) candidates = candidates.filter(target => target !== lastTarget);
    // Give the main typography most of the attention; branding stays quieter.
    const headings = candidates.filter(target => !target.classList.contains('brand-word'));
    if (headings.length && Math.random() < .8) candidates = headings;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if (!target) { schedule(); return; }
    lastTarget = target;
    const direction = Math.random() < .5 ? -1 : 1;
    const distance = target.classList.contains('brand-word') ? 1.5 : random(2,4);
    const duration = random(280,420);
    const band = Math.round(random(18,54));
    const originalChildren = [...target.childNodes];
    const echoes = [0,1].map(index => {
      const echo = document.createElement('span');
      echo.className = 'glitch-echo' + (index ? ' glitch-echo-magenta' : '');
      echo.setAttribute('aria-hidden','true');
      originalChildren.forEach(child => echo.appendChild(child.cloneNode(true)));
      echo.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      echo.querySelectorAll('[data-title-line]').forEach(node => node.removeAttribute('data-title-line'));
      echo.style.clipPath = `inset(${band + index * 21}% 0 ${100 - band - index * 21 - 13}% 0)`;
      target.appendChild(echo);
      return echo;
    });
    const animations = echoes.map((echo,index) => {
      const x = distance * direction * (index ? -1 : 1);
      return echo.animate([
        { offset: 0, opacity: 0, transform: 'translateX(0)' },
        { offset: .15, opacity: .65, transform: `translateX(${x}px)` },
        { offset: .43, opacity: .45, transform: `translateX(${-x * .6}px)` },
        { offset: .68, opacity: .3, transform: `translateX(${x * .35}px)` },
        { offset: 1, opacity: 0, transform: 'translateX(0)' }
      ], { duration, easing: 'steps(1, end)' });
    });
    // Real text stays in place; only its rendering briefly bends and separates.
    animations.push(target.animate([
      { offset: 0, textShadow: '0 0 transparent', transform: 'skewX(0deg)' },
      { offset: .2, textShadow: `${direction}px 0 #67edff66, ${-direction}px 0 #ed86ed55`, transform: `skewX(${direction * .65}deg)` },
      { offset: .55, textShadow: '0 0 transparent', transform: `skewX(${-direction * .25}deg)` },
      { offset: 1, textShadow: '0 0 transparent', transform: 'skewX(0deg)' }
    ], { duration, easing: 'steps(1, end)' }));
    const job = { echoes, animations };
    active = job;
    Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
      if (active === job) finish();
    });
  }
  function sync() { finish(); schedule(); }
  window.addEventListener('adc:motionchange', sync);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('focusin', finish);
  document.addEventListener('pointerdown', finish, { passive: true });
  document.addEventListener('selectionchange', () => { if (selecting()) finish(); });
  window.addEventListener('scroll', finish, { passive: true });
  window.addEventListener('resize', finish, { passive: true });
  window.addEventListener('pageswap', () => { leaving = true; sync(); });
  window.addEventListener('pagehide', () => { leaving = true; sync(); });
  window.addEventListener('pageshow', () => { leaving = false; schedule(true); });
  schedule(true);
})();
