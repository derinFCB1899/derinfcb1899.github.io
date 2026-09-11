(() => {
  'use strict';
  const root = document.documentElement;
  const muteButton = document.getElementById('music-mute');
  const tracks = {
    light: { provider:'soundcloud', id:'260809924', name:'ARCADE SUMMER', artist:'FM-84', title:'Arcade Summer by FM-84', side:'SUNSET / SIDE A', url:'https://soundcloud.com/fm84/arcade-summer-album', color:'c62c7d' },
    // A direct, website-authorized audio source is needed for Nightclub.
    dark: { provider:'none', id:'nightclub', title:'Nightclub by The Abyss', url:null }
  };
  const players = new Map();
  let track = null;
  let muted = false;
  try { muted = localStorage.getItem('adc-music-muted') === 'true'; } catch {}
  let phase = 'loading';
  let needsGesture = true;
  let revision = 0;
  let playAttempt = 0;
  let playCheck = 0;
  let loadCheck = 0;
  let resumeVisible = false;
  const active = () => players.get(track?.provider);

  function render() {
    const available = Boolean(track.url);
    const action = !available ? 'Sound unavailable' : muted ? 'Unmute soundtrack' : phase === 'error' ? 'Retry soundtrack' : phase === 'blocked' ? 'Enable sound' : 'Mute soundtrack';
    muteButton.setAttribute('aria-label', action);
    muteButton.title = action + ' · ' + track.title;
    muteButton.setAttribute('aria-pressed', String(muted || !available));
    muteButton.dataset.state = !available ? 'unavailable' : muted ? 'muted' : phase;
    muteButton.disabled = !available;
  }
  function visibleForPlayback() { return !document.hidden; }
  function play() {
    const player = active();
    if (!player?.ready || muted || !visibleForPlayback()) return;
    const current = revision;
    const attempt = ++playAttempt;
    clearTimeout(playCheck);
    needsGesture = true;
    phase = 'starting';
    player.volume(false);
    player.play();
    render();
    playCheck = setTimeout(() => player.isPaused(paused => {
      if (current !== revision || attempt !== playAttempt || phase !== 'starting' || muted) return;
      phase = paused ? 'blocked' : 'playing';
      needsGesture = paused;
      render();
    }), 2200);
  }
  function onEvent(provider, player, type) {
    if (players.get(provider) !== player) return;
    if (provider !== track.provider) {
      if (type === 'ready' || type === 'playing') { player.volume(true); player.pause(); }
      return;
    }
    if (type === 'ready') {
      clearTimeout(loadCheck);
      phase = 'paused';
      player.volume(muted);
      render();
      play();
    } else if (type === 'playing') {
      if (muted || !visibleForPlayback()) { player.volume(true); player.pause(); return; }
      clearTimeout(playCheck);
      needsGesture = false;
      phase = 'playing';
      render();
    } else if (type === 'paused') {
      if (phase === 'loading') return;
      clearTimeout(playCheck);
      needsGesture = false;
      phase = 'paused';
      render();
    } else if (type === 'ended') {
      player.restart();
      if (!muted) play();
    } else if (type === 'blocked') {
      clearTimeout(playCheck);
      phase = 'blocked';
      needsGesture = true;
      render();
    } else if (type === 'error') {
      clearTimeout(playCheck);
      clearTimeout(loadCheck);
      needsGesture = false;
      phase = 'error';
      render();
    }
  }
  function ensurePlayer() {
    if (!track.url) return;
    const provider = track.provider;
    let player = active();
    if (!player) {
      player = window.createSoundtrackPlayer(track, type => onEvent(provider, player, type));
      players.set(provider, player);
    }
    if (player.ready) return;
    clearTimeout(loadCheck);
    const current = revision;
    loadCheck = setTimeout(() => {
      if (current === revision && !player.ready) { phase = 'error'; render(); }
    }, 15000);
  }
  function syncTrack() {
    const next = tracks[root.dataset.theme] || tracks.dark;
    if (track === next) return;
    revision++;
    clearTimeout(playCheck);
    clearTimeout(loadCheck);
    const previous = active();
    track = next;
    previous?.volume(true);
    previous?.pause();
    needsGesture = true;
    resumeVisible = false;
    phase = 'loading';
    if (!track.url) { phase = 'unavailable'; render(); return; }
    render();
    ensurePlayer();
    if (active().ready) { phase = 'paused'; play(); }
    render();
  }
  function retry() {
    revision++;
    clearTimeout(playCheck);
    clearTimeout(loadCheck);
    const old = active();
    players.delete(track.provider);
    old?.destroy();
    phase = 'loading';
    needsGesture = true;
    ensurePlayer();
    render();
  }
  function setMuted(value, persist = true) {
    muted = value;
    if (persist) { try { localStorage.setItem('adc-music-muted', String(muted)); } catch {} }
    clearTimeout(playCheck);
    const player = active();
    player?.volume(muted);
    render();
    if (muted) { player?.pause(); resumeVisible = false; }
    else if (phase === 'error') retry();
    else { ensurePlayer(); play(); }
    render();
  }
  muteButton.addEventListener('click', () => {
    if (!track.url) return;
    if (!muted && phase === 'error') retry();
    else if (!muted && phase === 'blocked') play();
    else setMuted(!muted);
  });
  function unlock(event) {
    if (!event.isTrusted || muted || !needsGesture || event.target.closest('#music-mute, #theme-toggle')) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    play();
  }
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  window.addEventListener('adc:themechange', syncTrack);
  window.addEventListener('storage', event => { if (event.key === 'adc-music-muted') setMuted(event.newValue === 'true', false); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeVisible = phase === 'playing' || phase === 'starting' || needsGesture;
      active()?.pause();
    } else if ((resumeVisible || needsGesture) && !muted) { resumeVisible = false; play(); }
  });
  // Page navigation replaces only <main>; the audio iframe retains its playback position.
  muteButton.hidden = false;
  syncTrack();
})();
