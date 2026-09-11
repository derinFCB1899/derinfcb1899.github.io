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
  const frame = document.getElementById('music-player');
  const status = document.getElementById('deck-status');
  const trackName = document.getElementById('deck-track-name');
  const artist = document.getElementById('deck-artist');
  const side = document.getElementById('deck-side');
  const external = document.getElementById('deck-external');
  const reload = document.getElementById('deck-reload');
  const tracks = {
    light: { id:'2147282108', name:'ARCADE SUMMER', artist:'FM-84', title:'Arcade Summer by FM-84', side:'SUNSET / SIDE A', url:'https://fm84.bandcamp.com/track/arcade-summer', color:'ffd379' },
    dark: { id:'3056541004', name:'OVERDRIVE', artist:'LAZERHAWK', title:'Overdrive by Lazerhawk', side:'TRON / SIDE B', url:'https://lazerhawk.bandcamp.com/track/overdrive', color:'8cefff' }
  };
  let loadedTrack = null;
  const selected = () => tracks[root.dataset.theme] || tracks.dark;
  function loadTrack(force = false) {
    const track = selected();
    if (!force && loadedTrack === track.id) return;
    loadedTrack = track.id;
    status.textContent = 'Loading player…';
    frame.title = 'Audio player: ' + track.title;
    frame.src = 'https://bandcamp.com/EmbeddedPlayer/track=' + track.id + '/size=small/bgcol=07131b/linkcol=' + track.color + '/artwork=none/transparent=true/';
  }
  function syncTrack() {
    const track = selected();
    trackName.textContent = track.name;
    artist.textContent = track.artist;
    side.textContent = track.side;
    external.href = track.url;
    external.setAttribute('aria-label', 'Open ' + track.title + ' on Bandcamp');
    frame.title = 'Audio player: ' + track.title;
    if (loadedTrack) loadTrack();
  }
  frame.addEventListener('load', () => { if (loadedTrack) status.textContent = 'Plays across pages'; });
  frame.addEventListener('error', () => { status.textContent = 'Try Reload or open on Bandcamp'; });
  reload.addEventListener('click', () => loadTrack(true));
  window.addEventListener('adc:themechange', syncTrack);
  function showMusic(open) {
    music.hidden = !open;
    musicToggle.setAttribute('aria-expanded', String(open));
    if (open) loadTrack();
  }
  syncTrack();
  musicToggle.hidden = false;
  musicToggle.addEventListener('click', () => showMusic(music.hidden));
  close.addEventListener('click', () => { showMusic(false); musicToggle.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !music.hidden) { showMusic(false); musicToggle.focus(); }
  });
})();
