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

  const music = document.getElementById('soundtrack');
  const musicToggle = document.getElementById('soundtrack-toggle');
  const close = document.getElementById('soundtrack-close');
  const frame = document.getElementById('spotify-player');
  const mount = document.getElementById('spotify-mount');
  const play = document.getElementById('deck-play');
  const playLabel = document.getElementById('deck-play-label');
  const playIcon = document.getElementById('deck-play-icon');
  const status = document.getElementById('deck-status');
  const time = document.getElementById('deck-time');
  const progress = document.getElementById('deck-progress');
  let controller;
  let connected = false;
  let abandoned = false;
  let readyTimer;
  let requestTimer;
  function fallback() {
    clearTimeout(readyTimer);
    abandoned = true;
    controller = null;
    play.disabled = true;
    status.textContent = 'Use the Spotify player below';
    if (mount.querySelector('iframe') !== frame) mount.replaceChildren(frame);
    if (!frame.hasAttribute('src')) frame.src = frame.dataset.src;
  }
  function connect() {
    if (connected) return;
    connected = true;
    status.textContent = 'Connecting to Spotify…';
    window.onSpotifyIframeApiReady = api => {
      if (abandoned) return;
      try {
        const target = document.createElement('div');
        mount.replaceChildren(target);
        api.createController(target, { uri: 'spotify:track:5qOYTOVY0bn48XIt6LTdQ3', width: '100%', height: 152 }, player => {
          if (abandoned) return;
          controller = player;
          controller.addListener('ready', () => {
            if (abandoned) return;
            clearTimeout(readyTimer);
            play.disabled = false;
            status.textContent = 'Ready to play';
          });
          controller.addListener('playback_update', event => {
            if (abandoned) return;
            clearTimeout(requestTimer);
            const data = event.data;
            const position = Number.isFinite(data.position) ? Math.max(0, data.position) : 0;
            const duration = Number.isFinite(data.duration) ? Math.max(0, data.duration) : 0;
            const seconds = Math.floor(position / 1000);
            time.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
            progress.value = duration ? Math.min(100, position / duration * 100) : 0;
            playLabel.textContent = data.isPaused ? 'Play' : 'Pause';
            playIcon.textContent = data.isPaused ? '▶' : 'Ⅱ';
            const nextStatus = data.isBuffering ? 'Buffering…' : data.isPaused ? 'Paused' : 'Playing';
            if (status.textContent !== nextStatus) status.textContent = nextStatus;
          });
        });
      } catch { fallback(); }
    };
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = fallback;
    readyTimer = setTimeout(fallback, 15000);
    document.head.append(script);
  }
  play.addEventListener('click', () => {
    if (!controller || play.disabled) return;
    try {
      controller.togglePlay();
      clearTimeout(requestTimer);
      requestTimer = setTimeout(() => { status.textContent = 'Try Play in the Spotify player below'; }, 6000);
    } catch { status.textContent = 'Use the Spotify player below'; }
  });
  function showMusic(open) {
    music.hidden = !open;
    musicToggle.setAttribute('aria-expanded', String(open));
    // The official player is only contacted when the visitor opens it.
    if (open) {
      connect();
    }
  }
  musicToggle.hidden = false;
  musicToggle.addEventListener('click', () => showMusic(music.hidden));
  close.addEventListener('click', () => { showMusic(false); musicToggle.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !music.hidden) { showMusic(false); musicToggle.focus(); }
  });
})();
