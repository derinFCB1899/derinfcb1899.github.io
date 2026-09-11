# Ahmet Derin Cabuk · Portfolio

Personal portfolio featuring AI, data automation, and software engineering.

Live website: https://derinfcb1899.github.io/

## Pages

- About: `/`
- Work: `/work/`
- Contact: `/contact/`

## Hosting and updates

GitHub Pages publishes the `main` branch from the repository root. No build step is needed; `.nojekyll` keeps the HTML, CSS, JavaScript, and assets unchanged. Push updated website files to `main` to publish an update.

For local preview, run `python -m http.server 4173` from this directory and open http://localhost:4173/.

The Three.js environments, page transitions, and text effects respect the device's reduced-motion setting. The visible motion toggle has been removed. Content and navigation remain available without JavaScript. Pixel reveals fade smoothly over 1.6 seconds and clear immediately when their content receives focus.

The Sunset/TRON control switches between a vivid retrowave sunset with three 3D cars (yellow Lamborghini Countach, red Ferrari Testarossa, and silver Porsche 959) and a near-black arena with cyan, orange, and white light cycles and hovering 3D Recognizers. Both themes share exactly the same three fixed vehicle positions on the grid. Cars face the sunset and hold their positions with spinning wheels while the highway and lane markings move beneath them. Bikes face the Recognizers and lean gently while their straight, matching-color trails stay aligned with the grid. The floor grid, vehicles, light walls, and camera share a Three.js scene. The selected theme is remembered across pages and visits.

Music uses a single sound icon in the header. There are no visible music-player panels, floating controls, or YouTube embeds. Sunset plays FM-84's full “Arcade Summer” (track `260809924`); TRON plays JNATHYN's full “Genesis” (track `916461929`). Both use the artists' public SoundCloud uploads through the official Widget API. The audio iframes live in a permanently hidden mount outside the main page content. The header icon mutes or resumes sound, enables blocked playback, and retries failed loading. Mute preference persists across themes, routes, and visits. Every page credits both artists and songs in its footer, with direct links to the official SoundCloud uploads.

Each track has its own persistent iframe and playback position. Changing themes mutes and pauses the previous track before starting the selected one. Late loading or playback events from an inactive track cannot start audible sound. No music files are copied into this repository.

Each theme automatically attempts playback at 55% volume; browsers may require a first click before audible playback. The controller verifies actual playback state, respects mute, and pauses inactive audio. Tracks repeat while sound is enabled. Provider availability and browser playback policies remain outside the site's control.

`navigation.js` fetches and replaces only the main content for About, Work, and Contact. The audio iframes and WebGL canvas remain mounted, so playback continues when following site links or using Back/Forward. Each route remains a complete independently loadable document. Page titles, metadata, focus, scroll positions, navigation state, and effects update on route changes. Full browser reloads or leaving the site start a new document and reset playback.

## Third-party assets

- Three.js 0.186.0, MIT: `vendor/three/LICENSE`.
- GitHub and LinkedIn icons from Bootstrap Icons v1.13.1, MIT: `vendor/LICENSE.bootstrap-icons.txt`.
- Fonts supplied by Google Fonts with system-font fallbacks.

Portfolio content and original artwork © 2026 Ahmet Derin Cabuk.
