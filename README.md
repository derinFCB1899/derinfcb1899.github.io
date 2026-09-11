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

The Day/Night control switches between a pastel retrowave sunrise and a dark neon moon, including theme-aware 3D grids, lighting, and original pixel artwork. The selected theme is remembered across pages and visits.

The Soundtrack control opens Spotify's official player for Kavinsky's “Zenith – Instrumental.” Playback starts through the player's controls; Spotify is contacted only when the panel is opened. Minimizing the panel keeps the player mounted. Separate page navigation reloads the player, so “Open in Spotify” provides uninterrupted listening across pages. Playback availability depends on Spotify and the visitor's browser/account.

## Third-party assets

- Three.js 0.186.0, MIT: `vendor/three/LICENSE`.
- GitHub and LinkedIn icons from Bootstrap Icons v1.13.1, MIT: `vendor/LICENSE.bootstrap-icons.txt`.
- Fonts supplied by Google Fonts with system-font fallbacks.

Portfolio content and original artwork © 2026 Ahmet Derin Cabuk.
