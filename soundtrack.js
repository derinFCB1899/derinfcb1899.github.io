(() => {
  'use strict';
  const root = document.documentElement;
  const panel = document.getElementById('soundtrack');
  const muteButton = document.getElementById('music-mute');
  const status = document.getElementById('deck-status');
  const reload = document.getElementById('deck-reload');
  const external = document.getElementById('deck-external');
  const tracks = {
    light: { provider:'soundcloud', id:'260809924', name:'ARCADE SUMMER', artist:'FM-84', title:'Arcade Summer by FM-84', side:'SUNSET / SIDE A', url:'https://soundcloud.com/fm84/arcade-summer-album', color:'c62c7d' },
    dark: { provider:'youtube', id:'ciQS0urRMtI', name:'NIGHTCLUB', artist:'THE ABYSS', title:'Nightclub by The Abyss', side:'TRON / SIDE B', url:'https://www.youtube.com/watch?v=ciQS0urRMtI' }
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
    const action = muted ? 'Unmute' : 'Mute';
    muteButton.setAttribute('aria-label', action + ' soundtrack');
    muteButton.title = action + ' soundtrack';
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.dataset.state = muted ? 'muted' : phase;
    panel.hidden = muted || (track.provider === 'soundcloud' && !['blocked', 'error'].includes(phase));
    document.getElementById('deck-transport').hidden = !['loading', 'blocked', 'error'].includes(phase);
    status.textContent = muted ? 'Sound muted' : ({ loading:'Loading audio…', starting:'Starting audio…', playing:'Playing · follows your theme', blocked:'Press Play to enable audio', paused:'Audio paused', error:'Audio unavailable · try Reload' })[phase];
  }
  function visibleForPlayback() {
    if (document.hidden) return false;
    if (track.provider !== 'youtube') return true;
    const frame = document.getElementById('music-youtube');
    if (!frame || panel.hidden) return false;
    const r = frame.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const width = Math.max(0, Math.min(r.right, p.right, innerWidth) - Math.max(r.left, p.left, 0));
    const height = Math.max(0, Math.min(r.bottom, p.bottom, innerHeight) - Math.max(r.top, p.top, 0));
    return r.width >= 200 && r.height >= 200 && width * height > r.width * r.height / 2;
  }
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
    panel.dataset.provider = track.provider;
    document.getElementById('soundcloud-mount').hidden = track.provider !== 'soundcloud';
    document.getElementById('youtube-mount').hidden = track.provider !== 'youtube';
    panel.setAttribute('aria-label', track.title);
    const providerName = track.provider === 'youtube' ? 'YouTube' : 'SoundCloud';
    external.href = track.url;
    external.querySelector('span').textContent = providerName;
    external.setAttribute('aria-label', 'Open ' + track.title + ' on ' + providerName);
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
  muteButton.addEventListener('click', () => setMuted(!muted));
  reload.addEventListener('click', retry);
  function unlock(event) {
    if (!event.isTrusted || muted || !needsGesture || event.target.closest('#music-mute, #theme-toggle, #deck-reload')) return;
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
  function checkVisibility() {
    if (muted || track.provider !== 'youtube') return;
    if (!visibleForPlayback()) {
      if (phase === 'playing' || phase === 'starting') { resumeVisible = true; active()?.pause(); }
    } else if (resumeVisible || needsGesture) { resumeVisible = false; play(); }
  }
  window.addEventListener('resize', checkVisibility);
  panel.addEventListener('scroll', checkVisibility, {passive:true});
  // Page navigation replaces only <main>; both providers retain their playback position.
  muteButton.hidden = false;
  syncTrack();
})();
