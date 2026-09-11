(() => {
  'use strict';
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  function applyTheme(theme) {
    root.dataset.theme = theme === 'light' ? 'light' : 'dark';
    const light = root.dataset.theme === 'light';
    root.style.colorScheme = root.dataset.theme;
    toggle.setAttribute('aria-label', light ? 'Switch to TRON theme' : 'Switch to sunset theme');
    toggle.querySelector('.theme-label').textContent = light ? 'TRON' : 'Sunset';
    toggle.querySelector('.theme-icon').textContent = light ? '⌁' : '☀';
    themeColor.setAttribute('content', light ? '#ffc493' : '#030b12');
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

})();
