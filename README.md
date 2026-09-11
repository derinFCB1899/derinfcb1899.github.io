# Ahmet Derin Cabuk — Portfolio

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

The Sunset/TRON control switches between a vivid retrowave sunset with three 3D car bodies (wedge, boxy, and targa) and a near-black light-cycle arena with hovering 3D Recognizers. The smaller cars occupy three grid-aligned highway lanes, with moving lane markings, and fade toward the sunset before wrapping their driving loop. Bikes face the Recognizers, hold steady lanes, and lean gently while their straight trails stay aligned with the grid. The floor grid, vehicles, light walls, and camera share a Three.js scene. The selected theme is remembered across pages and visits.

The compact retro Soundtrack deck uses Bandcamp's official audio-only player, loaded only when opened. Sunset plays FM-84's “Arcade Summer” (track `2147282108`); TRON plays Lazerhawk's “Overdrive” (track `3056541004`). Controls and streams come directly from each artist's public embed; no music files are copied into this repository. Reload retries the current embed, and the artist link remains available if playback is unavailable. Switching themes loads the matching track, which the listener starts in the player.

`navigation.js` fetches and replaces only the main content for About, Work, and Contact. The soundtrack iframe and WebGL canvas remain mounted, so playback continues when following site links or using Back/Forward. Each route remains a complete independently loadable document. Page titles, metadata, focus, scroll positions, navigation state, and effects update on route changes. Full browser reloads or leaving the site start a new document and reset playback.

## Third-party assets

- Three.js 0.186.0, MIT: `vendor/three/LICENSE`.
- GitHub and LinkedIn icons from Bootstrap Icons v1.13.1, MIT: `vendor/LICENSE.bootstrap-icons.txt`.
- Fonts supplied by Google Fonts with system-font fallbacks.

Portfolio content and original artwork © 2026 Ahmet Derin Cabuk.
