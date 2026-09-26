(() => {
  'use strict';
  const root = document.documentElement;
  const interactiveSelector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [role="button"]';
  let audioContext;
  let previousTarget = null;
  let lastHoverAt = 0;
  let lastTheme = root.dataset.theme || 'dark';

  function isMuted() {
    try { return localStorage.getItem('adc-music-muted') === 'true'; } catch { return false; }
  }

  function context() {
    if (isMuted()) return null;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      audioContext ||= new Audio();
      if (audioContext.state === 'suspended') audioContext.resume();
      return audioContext;
    } catch { return null; }
  }

  function tone(ctx, frequency, duration, wave, volume, delay = 0, endFrequency = frequency) {
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.linearRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function playHover(theme) {
    const ctx = context();
    if (!ctx) return;
    if (theme === 'light') tone(ctx, 1060, 0.036, 'triangle', 0.012, 0, 1220);
    else tone(ctx, 720, 0.042, 'sine', 0.011, 0, 940);
  }

  function playTheme(theme) {
    const ctx = context();
    if (!ctx) return;
    if (theme === 'light') {
      tone(ctx, 523.25, 0.14, 'triangle', 0.024);
      tone(ctx, 783.99, 0.18, 'sine', 0.019, 0.075);
    } else {
      tone(ctx, 392, 0.12, 'sine', 0.023);
      tone(ctx, 587.33, 0.15, 'triangle', 0.018, 0.065);
    }
  }

  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target.closest?.(interactiveSelector);
    if (!target || target === previousTarget || target.matches('#music-mute, #theme-toggle')) {
      if (!target) previousTarget = null;
      return;
    }
    previousTarget = target;
    const now = performance.now();
    if (now - lastHoverAt < 95) return;
    lastHoverAt = now;
    playHover(root.dataset.theme === 'light' ? 'light' : 'dark');
  });

  window.addEventListener('adc:themechange', event => {
    const theme = event.detail?.theme === 'light' ? 'light' : 'dark';
    if (theme === lastTheme) return;
    lastTheme = theme;
    playTheme(theme);
  });
})();
