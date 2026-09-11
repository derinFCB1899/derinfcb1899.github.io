(() => {
  let theme;
  try { theme = localStorage.getItem('adc-theme'); } catch {}
  if (theme !== 'light' && theme !== 'dark') theme = 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
