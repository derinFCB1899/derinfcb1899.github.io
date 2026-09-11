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

The retro Soundtrack deck uses official, full-track embeds: Sunset plays FM-84's “Arcade Summer” on SoundCloud (track `260809924`); TRON plays “Nightclub” by The Abyss through the distributor-provided YouTube Topic upload (`ciQS0urRMtI`, 3:41). No music files are copied into this repository. The SoundCloud Widget and YouTube IFrame APIs automatically attempt playback at 55% volume on arrival and theme changes. The single sound icon in the header toggles mute and stores `adc-music-muted` across themes, routes, and visits. Each provider retains its own iframe and playback position while site links replace only the main content.

The YouTube player remains visibly at least 200 × 200 pixels and retains its native controls and attribution inside a minimal surround, with no separate Soundtrack button. Muting pauses playback and hides the player. Playback begins only when more than half of the YouTube player is visible; it pauses when the browser tab is hidden. Sunset's native audio-only SoundCloud player appears only when playback needs attention. Both providers pause when muted or inactive, so tracks cannot overlap.

Browsers may require a first click before audible playback. The controller retries after a trusted click or activation key, confirms actual playback state, and retains native Play controls. Native Pause remains respected until playback or a theme change is requested. Reload recreates a failed player. Tracks repeat when they finish while sound is enabled. Third-party availability, advertising, and browser playback policies remain controlled by the provider and visitor's browser.

`navigation.js` fetches and replaces only the main content for About, Work, and Contact. The soundtrack iframes and WebGL canvas remain mounted, so playback continues when following site links or using Back/Forward. Each route remains a complete independently loadable document. Page titles, metadata, focus, scroll positions, navigation state, and effects update on route changes. Full browser reloads or leaving the site start a new document and reset playback.

## Third-party assets

- Three.js 0.186.0, MIT: `vendor/three/LICENSE`.
- GitHub and LinkedIn icons from Bootstrap Icons v1.13.1, MIT: `vendor/LICENSE.bootstrap-icons.txt`.
- Fonts supplied by Google Fonts with system-font fallbacks.

Portfolio content and original artwork © 2026 Ahmet Derin Cabuk.
