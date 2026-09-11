(() => {
  'use strict';
  const root = document.documentElement;
  const panel = document.getElementById('soundtrack');
  const panelToggle = document.getElementById('soundtrack-toggle');
  const frame = document.getElementById('music-player');
  const muteButton = document.getElementById('music-mute');
  const muteLabel = document.getElementById('music-mute-label');
  const status = document.getElementById('deck-status');
  const reload = document.getElementById('deck-reload');
  const external = document.getElementById('deck-external');
  const tracks = {
    light: { id:'260809924', name:'ARCADE SUMMER', artist:'FM-84', title:'Arcade Summer by FM-84', side:'SUNSET / SIDE A', url:'https://soundcloud.com/fm84/arcade-summer-album', color:'c62c7d' },
    dark: { id:'60397873', name:'OVERDRIVE', artist:'LAZERHAWK', title:'Overdrive by Lazerhawk', side:'TRON / SIDE B', url:'https://soundcloud.com/lazerhawk/lazerhawk-overdrive', color:'24bad5' }
  };
  const selected = () => tracks[root.dataset.theme] || tracks.dark;
  let muted = false;
  try { muted = localStorage.getItem('adc-music-muted') === 'true'; } catch {}
  let widget = null;
  let apiScript = null;
  let widgetReady = false;
  let trackReady = false;
  let requestedTrack = null;
  let version = 0;
  let phase = 'loading';
  let needsGesture = true;
  let playCheck = 0;
  let loadCheck = 0;

  function render() {
    const action = muted ? 'Unmute' : 'Mute';
    muteLabel.textContent = action;
    muteButton.setAttribute('aria-label', action + ' soundtrack');
    muteButton.title = action + ' soundtrack';
    muteButton.dataset.state = muted ? 'muted' : phase;
    status.textContent = muted ? 'Sound muted' : ({ loading:'Loading audio…', starting:'Starting audio…', playing:'Playing · follows your theme', blocked:'Use Play below to enable audio', paused:'Audio paused', error:'Audio unavailable · try Reload' })[phase];
  }
  function remember() { try { localStorage.setItem('adc-music-muted', String(muted)); } catch {} }
  function applyVolume() { widget?.setVolume(muted ? 0 : 55); }
  function play() {
    if (!widgetReady || !trackReady || muted) return;
    clearTimeout(playCheck);
    const current = version;
    needsGesture = true;
    phase = 'starting';
    applyVolume();
    widget.play();
    render();
    // The widget API has no play Promise. Confirm its actual state instead.
    playCheck = setTimeout(() => widget?.isPaused(paused => {
      if (current !== version || muted || !trackReady) return;
      phase = paused ? 'blocked' : 'playing';
      needsGesture = paused;
      render();
    }), 2200);
  }
  function ready(current) {
    if (current !== version) return;
    clearTimeout(loadCheck);
    trackReady = true;
    phase = 'paused';
    applyVolume();
    render();
    play();
  }
  function watchLoading(current) {
    clearTimeout(loadCheck);
    loadCheck = setTimeout(() => {
      if (current === version && !trackReady) { phase = 'error'; render(); }
    }, 15000);
  }
  function loadTrack(force = false) {
    const track = selected();
    if (!widgetReady || (!force && requestedTrack === track.id)) return;
    const current = ++version;
    requestedTrack = track.id;
    trackReady = false;
    needsGesture = true;
    phase = 'loading';
    clearTimeout(playCheck);
    widget.setVolume(0);
    widget.pause();
    // Reuse one iframe so navigation and theme changes retain playback permission.
    widget.load(track.url, { auto_play:false, color:track.color, show_artwork:false, show_comments:false, show_playcount:false, show_user:true, single_active:true, callback:() => ready(current) });
    watchLoading(current);
    render();
  }
  function connect() {
    if (widget || !window.SC?.Widget) return;
    const initial = requestedTrack;
    const initialVersion = version;
    widget = window.SC.Widget(frame);
    const events = window.SC.Widget.Events;
    const onReady = () => {
      widget.unbind(events.READY);
      widgetReady = true;
      if (selected().id !== initial || initialVersion !== version) loadTrack(true);
      else ready(initialVersion);
    };
    widget.bind(events.READY, onReady);
    widget.bind(events.PLAY, () => {
      applyVolume();
      if (!trackReady) { widget.pause(); return; }
      clearTimeout(playCheck);
      needsGesture = false;
      phase = 'playing';
      render();
    });
    widget.bind(events.PAUSE, () => {
      if (!trackReady || phase === 'starting' || phase === 'blocked') return;
      phase = 'paused';
      render();
    });
    widget.bind(events.FINISH, () => { if (trackReady) { widget.seekTo(0); phase = 'paused'; render(); if (!muted) play(); } });
    widget.bind(events.ERROR, () => { trackReady = false; phase = 'error'; render(); });
  }
  function ensurePlayer() {
    if (!frame.getAttribute('src')) {
      const track = selected();
      requestedTrack = track.id;
      const current = ++version;
      frame.src = 'https://w.soundcloud.com/player/?' + new URLSearchParams({ url:track.url, auto_play:'false', color:track.color, show_artwork:'false', show_comments:'false', show_playcount:'false', show_user:'true', visual:'false', single_active:'true' });
      phase = 'loading';
      watchLoading(current);
    }
    if (window.SC?.Widget) { connect(); return; }
    if (apiScript) return;
    const script = document.createElement('script');
    apiScript = script;
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.async = true;
    script.onload = () => { if (apiScript === script) connect(); };
    script.onerror = () => { if (apiScript !== script) return; script.remove(); apiScript = null; phase = 'error'; render(); };
    document.head.appendChild(script);
  }
  function syncTrack() {
    const track = selected();
    document.getElementById('deck-track-name').textContent = track.name;
    document.getElementById('deck-artist').textContent = track.artist;
    document.getElementById('deck-side').textContent = track.side;
    external.href = track.url;
    external.setAttribute('aria-label', 'Open ' + track.title + ' on SoundCloud');
    frame.title = 'Audio player: ' + track.title;
    loadTrack();
  }
  function retry() {
    if (!window.SC?.Widget && apiScript) { apiScript.remove(); apiScript = null; }
    if (!widgetReady) { frame.removeAttribute('src'); requestedTrack = null; }
    ensurePlayer();
    loadTrack(true);
    render();
  }
  function setMuted(value, persist = true) {
    muted = value;
    if (persist) remember();
    clearTimeout(playCheck);
    if (muted) {
      applyVolume();
      // Even if the provider API failed, the mute control can stop native playback.
      if (!widgetReady) { frame.removeAttribute('src'); requestedTrack = null; version++; }
    } else { if (phase === 'error') retry(); else { ensurePlayer(); play(); } }
    render();
  }
  muteButton.addEventListener('click', () => setMuted(!muted));
  reload.addEventListener('click', retry);
  // Retry blocked autoplay only after a deliberate click/key interaction.
  function unlock(event) {
    if (!event.isTrusted || muted || !needsGesture || event.target.closest('#music-mute, #theme-toggle, #deck-reload')) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    play();
  }
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  window.addEventListener('adc:themechange', syncTrack);
  window.addEventListener('storage', event => {
    if (event.key !== 'adc-music-muted') return;
    setMuted(event.newValue === 'true', false);
  });
  function show(open) { panel.hidden = !open; panelToggle.setAttribute('aria-expanded', String(open)); }
  panelToggle.addEventListener('click', () => show(panel.hidden));
  document.getElementById('soundtrack-close').addEventListener('click', () => { show(false); panelToggle.focus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { show(false); panelToggle.focus(); } });
  panelToggle.hidden = muteButton.hidden = false;
  syncTrack();
  render();
  ensurePlayer();
})();
