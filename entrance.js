(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const allowed = () => root.dataset.motion === 'active' && !reduced.matches && !document.hidden;
  // Deferred independently of WebGL imports. Never cover already-painted content.
  const alreadyPainted = performance.getEntriesByType?.('paint').some(entry => entry.name === 'first-contentful-paint');
  if (!allowed() || alreadyPainted || root.dataset.nativeTransition === 'true') return;
    const animations = new Set();
    function animate(element, frames, options) {
      if (!allowed() || typeof element.animate !== 'function') return;
      const animation = element.animate(frames, options);
      animations.add(animation);
      animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    }
    const title = document.querySelector('#hero-title');
    if (title && allowed()) {
      title.setAttribute('aria-label', [...title.children].map(line => line.textContent).join(' '));
      let count = 0;
      title.querySelectorAll('[data-title-line]').forEach(line => {
        const words = line.textContent.split(' ');
        line.setAttribute('aria-hidden', 'true');
        line.textContent = '';
        words.forEach((word, index) => {
          const span = document.createElement('span');
          span.className = 'title-word';
          span.textContent = word;
          line.appendChild(span);
          if (index < words.length - 1) line.appendChild(document.createTextNode(' '));
          if (root.dataset.nativeTransition !== 'true') animate(span, [
            { opacity: 0, transform: 'translate3d(0, 90px, -120px) rotateX(80deg) rotateY(-12deg)', filter: 'blur(9px)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)', filter: 'blur(0)' }
          ], { duration: 1400, delay: 120 + count * 90, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
          count++;
        });
      });
    }
    if (root.dataset.nativeTransition !== 'true') document.querySelectorAll('.route-shutter i').forEach((strip, index) => {
      animate(strip, [{ transform: 'translateY(0)' }, { transform: 'translateY(-102%)' }], {
        duration: 650, delay: index * 32, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'backwards'
      });
    });
    function sync() {
      animations.forEach(animation => {
        if (root.dataset.motion !== 'active' || reduced.matches) animation.cancel();
        else if (document.hidden) animation.pause();
        else animation.play();
      });
    }
    window.addEventListener('adc:motionchange', sync);
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
    window.addEventListener('pagereveal', event => {
      if (event.viewTransition) { animations.forEach(animation => animation.cancel()); animations.clear(); }
    });
    window.addEventListener('pagehide', () => { animations.forEach(animation => animation.cancel()); animations.clear(); });
})();
