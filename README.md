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

The Three.js environments, page transitions, and text effects respect the saved motion preference and device reduced-motion setting. Content and navigation remain available without JavaScript.

The Sunset/TRON control switches between a vivid retrowave sunset with 3D wedge cars and a near-black light-cycle arena with hovering 3D Recognizers. The floor grid, vehicle motion, light walls, and camera share a Three.js scene. The original floating abstract objects and moon have been removed. The selected theme is remembered across pages and visits.

The retro Soundtrack deck uses Spotify's official iFrame API for Kavinsky's “Zenith – Instrumental.” Play/Pause and the read-only playback clock/progress reflect Spotify events. The official player stays visible inside the open deck for account and playback controls. Spotify is contacted only when the deck is opened. API failure or timeout falls back to the ordinary embed. Minimizing keeps playback mounted; changing documents reloads it, so the Spotify link supports uninterrupted listening across pages. Playback availability depends on Spotify and the visitor's browser/account.

## Third-party assets

- Three.js 0.186.0, MIT: `vendor/three/LICENSE`.
- GitHub and LinkedIn icons from Bootstrap Icons v1.13.1, MIT: `vendor/LICENSE.bootstrap-icons.txt`.
- Fonts supplied by Google Fonts with system-font fallbacks.

Portfolio content and original artwork © 2026 Ahmet Derin Cabuk.
