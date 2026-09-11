(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function applyTheme(theme) {
    root.dataset.theme = theme === 'light' ? 'light' : 'dark';
    const light = root.dataset.theme === 'light';
    root.style.colorScheme = root.dataset.theme;
    toggle.setAttribute('aria-label', light ? 'Switch to dark moon theme' : 'Switch to light sun theme');
    toggle.querySelector('.theme-label').textContent = light ? 'Night' : 'Day';
    toggle.querySelector('.theme-icon').textContent = light ? '☾' : '☀';
    themeColor.setAttribute('content', light ? '#eaf2ff' : '#07081c');
    window.dispatchEvent(new CustomEvent('adc:themechange', { detail: { theme: root.dataset.theme } }));
  }
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('adc-theme', theme); } catch {}
    applyTheme(theme);
  });
  function restoreTheme() {
    let theme = root.dataset.theme;
    try { theme = localStorage.getItem('adc-theme') || theme; } catch {}
    applyTheme(theme);
  }
  window.addEventListener('pageshow', restoreTheme);
  window.addEventListener('storage', event => { if (event.key === 'adc-theme') restoreTheme(); });
  restoreTheme();

  const music = document.getElementById('soundtrack');
  const musicToggle = document.getElementById('soundtrack-toggle');
  const close = document.getElementById('soundtrack-close');
  const frame = document.getElementById('spotify-player');
  function showMusic(open) {
    music.hidden = !open;
    musicToggle.setAttribute('aria-expanded', String(open));
    // The official player is only contacted when the visitor opens it.
    if (open && !frame.hasAttribute('src')) frame.src = frame.dataset.src;
  }
  musicToggle.hidden = false;
  musicToggle.addEventListener('click', () => showMusic(music.hidden));
  close.addEventListener('click', () => { showMusic(false); musicToggle.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !music.hidden) { showMusic(false); musicToggle.focus(); }
  });
})();
