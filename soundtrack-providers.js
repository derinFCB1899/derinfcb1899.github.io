(() => {
  'use strict';
  let apiPromise = null;
  let apiScript = null;
  function loadAPI() {
    if (window.SC?.Widget) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      apiScript = script;
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        if (apiScript === script) { apiPromise = apiScript = null; }
        reject(new Error('Audio unavailable'));
      };
      document.head.appendChild(script);
    });
    return apiPromise;
  }
  window.createSoundtrackPlayer = (track, notify) => {
    let disposed = false;
    let native = null;
    let frame = null;
    let playing = false;
    let playRequested = false;
    let expectedPause = false;
    const emit = type => { if (!disposed) notify(type); };
    const player = {
      ready:false,
      play() { if (player.ready) { playRequested = true; native.play(); } },
      pause() {
        if (!player.ready) return;
        expectedPause = expectedPause || playing || playRequested;
        playing = playRequested = false;
        native.pause();
      },
      volume(muted) { if (player.ready) native.setVolume(muted ? 0 : 55); },
      isPaused(callback) { if (player.ready) native.isPaused(callback); },
      restart() { if (player.ready) native.seekTo(0); },
      destroy() {
        disposed = true;
        player.volume(true);
        player.pause();
        if (native) Object.values(window.SC.Widget.Events).forEach(event => native.unbind(event));
        frame?.remove();
        if (!native) { apiScript?.remove(); apiPromise = apiScript = null; }
      },
    };
    loadAPI().then(() => {
      if (disposed) return;
      frame = document.createElement('iframe');
      frame.id = 'music-player';
      frame.title = track.title;
      frame.allow = 'autoplay';
      frame.tabIndex = -1;
      frame.src = 'https://w.soundcloud.com/player/?' + new URLSearchParams({ url:track.url, auto_play:'false', color:track.color, show_artwork:'false', show_comments:'false', show_playcount:'false', show_user:'true', visual:'false', single_active:'true' });
      document.getElementById('soundcloud-mount').replaceChildren(frame);
      native = window.SC.Widget(frame);
      const events = window.SC.Widget.Events;
      native.bind(events.READY, () => { player.ready = true; player.volume(true); emit('ready'); });
      native.bind(events.PLAY, () => { playing = true; playRequested = expectedPause = false; emit('playing'); });
      native.bind(events.PAUSE, () => {
        const commanded = expectedPause;
        playing = playRequested = expectedPause = false;
        emit(commanded ? 'api-paused' : 'paused');
      });
      native.bind(events.FINISH, () => { playing = playRequested = false; emit('ended'); });
      native.bind(events.ERROR, () => emit('error'));
    }).catch(() => emit('error'));
    return player;
  };
})();
