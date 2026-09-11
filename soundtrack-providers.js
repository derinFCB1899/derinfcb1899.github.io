(() => {
  'use strict';
  let apiScript = null;
  const apiWaiters = new Set();
  function loadAPI() {
    if (window.SC?.Widget) {
      const waiters = [...apiWaiters];
      apiWaiters.clear();
      waiters.forEach(waiter => waiter.resolve());
      return Promise.resolve();
    }
    const promise = new Promise((resolve, reject) => apiWaiters.add({resolve, reject}));
    if (!apiScript) {
      const script = document.createElement('script');
      apiScript = script;
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      const finish = error => {
        if (apiScript !== script) return;
        if (error) { script.remove(); apiScript = null; }
        const waiters = [...apiWaiters];
        apiWaiters.clear();
        waiters.forEach(waiter => error ? waiter.reject(error) : waiter.resolve());
      };
      script.onload = () => finish(window.SC?.Widget ? null : new Error('Audio unavailable'));
      script.onerror = () => finish(new Error('Audio unavailable'));
      document.head.appendChild(script);
    }
    return promise;
  }
  window.createSoundtrackPlayer = (track, notify) => {
    let disposed = false;
    let native = null;
    let frame = null;
    let playing = false;
    let playRequested = false;
    let expectedPause = false;
    const emit = type => {
      if (disposed) return;
      if (type === 'error') player.failed = true;
      notify(type);
    };
    const player = {
      ready:false,
      failed:false,
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
        // Keep other tracks' waiters so a retry can recover both theme players.
        if (!native) { apiScript?.remove(); apiScript = null; }
      },
    };
    loadAPI().then(() => {
      if (disposed) return;
      frame = document.createElement('iframe');
      frame.id = 'music-player-' + track.id;
      frame.title = track.title;
      frame.allow = 'autoplay';
      frame.tabIndex = -1;
      frame.src = 'https://w.soundcloud.com/player/?' + new URLSearchParams({ url:track.url, auto_play:'false', color:track.color, show_artwork:'false', show_comments:'false', show_playcount:'false', show_user:'true', visual:'false', single_active:'true' });
      document.getElementById('soundcloud-mount').appendChild(frame);
      native = window.SC.Widget(frame);
      const events = window.SC.Widget.Events;
      native.bind(events.READY, () => { player.ready = true; player.failed = false; player.volume(true); emit('ready'); });
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
