(() => {
  'use strict';
  const scripts = new Map();
  const tags = new Map();
  function loadAPI(name, url, available) {
    if (available()) return Promise.resolve();
    if (scripts.has(name)) return scripts.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      tags.set(name, script);
      script.src = url;
      script.async = true;
      script.onerror = () => { script.remove(); tags.delete(name); scripts.delete(name); reject(new Error('Player API unavailable')); };
      if (name === 'youtube') {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
      } else script.onload = resolve;
      document.head.appendChild(script);
    });
    scripts.set(name, promise);
    return promise;
  }

  window.createSoundtrackPlayer = (track, notify) => {
    let disposed = false;
    let native = null;
    let frame = null;
    let playing = false;
    let playRequested = false;
    let expectedPause = false;
    const emit = type => { if (!disposed) notify(type); };
    const onPlaying = () => {
      playing = true;
      playRequested = expectedPause = false;
      emit('playing');
    };
    const onPaused = () => {
      const commanded = expectedPause;
      playing = playRequested = expectedPause = false;
      emit(commanded ? 'api-paused' : 'paused');
    };
    const youtube = track.provider === 'youtube';
    const player = {
      ready:false,
      play() {
        if (!player.ready) return;
        playRequested = true;
        youtube ? native.playVideo() : native.play();
      },
      pause() {
        if (!player.ready) return;
        // Delayed acknowledgments of our theme/mute pauses are not user pauses.
        expectedPause = expectedPause || playing || playRequested;
        playing = playRequested = false;
        youtube ? native.pauseVideo() : native.pause();
      },
      volume(muted) {
        if (!player.ready) return;
        if (youtube) { if (muted) native.mute(); else { native.setVolume(55); native.unMute(); } }
        else native.setVolume(muted ? 0 : 55);
      },
      isPaused(callback) { if (player.ready) youtube ? callback(native.getPlayerState() !== 1) : native.isPaused(callback); },
      restart() { if (player.ready) native.seekTo(0, true); },
      destroy() {
        disposed = true;
        player.volume(true);
        player.pause();
        if (youtube) native?.destroy();
        else if (native) Object.values(window.SC.Widget.Events).forEach(event => native.unbind(event));
        frame?.remove();
        if (!native) {
          tags.get(track.provider)?.remove();
          tags.delete(track.provider);
          scripts.delete(track.provider);
        }
      },
    };
    const slot = document.getElementById(youtube ? 'youtube-mount' : 'soundcloud-mount');
    const onReady = () => { player.ready = true; player.volume(true); emit('ready'); };
    const api = youtube
      ? loadAPI('youtube', 'https://www.youtube.com/iframe_api', () => window.YT?.Player)
      : loadAPI('soundcloud', 'https://w.soundcloud.com/player/api.js', () => window.SC?.Widget);
    api.then(() => {
      if (disposed) return;
      frame = document.createElement('iframe');
      frame.id = youtube ? 'music-youtube' : 'music-player';
      frame.title = 'Audio player: ' + track.title;
      frame.width = '100%';
      frame.height = youtube ? '200' : '166';
      frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      if (youtube) {
        frame.src = 'https://www.youtube.com/embed/' + track.id + '?' + new URLSearchParams({ enablejsapi:'1', origin:location.origin, autoplay:'0', playsinline:'1', controls:'1', rel:'0' });
        slot.replaceChildren(frame);
        native = new window.YT.Player(frame, { events: {
          onReady,
          onStateChange(event) {
            if (event.data === 1) onPlaying();
            else if (event.data === 2) onPaused();
            else if (event.data === 0) { playing = playRequested = false; emit('ended'); }
          },
          onAutoplayBlocked() { emit('blocked'); },
          onError() { emit('error'); },
        } });
      } else {
        frame.src = 'https://w.soundcloud.com/player/?' + new URLSearchParams({ url:track.url, auto_play:'false', color:track.color, show_artwork:'false', show_comments:'false', show_playcount:'false', show_user:'true', visual:'false', single_active:'true' });
        slot.replaceChildren(frame);
        native = window.SC.Widget(frame);
        const events = window.SC.Widget.Events;
        native.bind(events.READY, onReady);
        native.bind(events.PLAY, onPlaying);
        native.bind(events.PAUSE, onPaused);
        native.bind(events.FINISH, () => { playing = playRequested = false; emit('ended'); });
        native.bind(events.ERROR, () => emit('error'));
      }
    }).catch(() => emit('error'));
    return player;
  };
})();
