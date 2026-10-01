# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-01

### Changed

- The `prism` preset now turns on the `lens`, `calm`, `swirl`, `focus`, `tilt`
  and `glow` hover effects. Add `hover="none"` to keep it still.
- The playground starts with its controls hidden and links to the GitHub
  repository, with its star count.

### Removed

- The `silk` preset is no longer listed in `CausticLight.presets`, the docs or
  the playground. `preset="silk"` still renders as before, so existing pages
  keep their look.

## [1.0.0] - 2026-10-01

First public release.

### Added

- `<caustic-light>` custom element: a WebGL2 photon-grid renderer that bends a
  grid of light rays through an animated surface (mirror or glass/water) and
  draws the exact brightness of the resulting caustics.
- Four surface types (`flow`, `ripple`, `hammered`, `lens`) and six presets:
  `silk`, `laser`, `blown-glass`, `pool`, `prism`, `hammered`.
- Spectral dispersion, round or diverging beams, glow, softness, trail and grain.
- Two-colour gradient maps (`gradient`, `gradient-mid`) that respect the
  background colour and transparent overlays.
- Optional hover effects: `ripple`, `lens`, `calm`, `swirl`, `focus`, `tilt`,
  `glow`, with `hover-strength` and `hover-radius`.
- Optional music: an endlessly looping, crossfaded track (`audio`) or an existing
  `<audio>` element (`audio-element`), with `audio-react` controlling how much the
  music's dynamics move the light, plus an optional corner play button.
- Automatic quality scaling, offscreen pausing, `prefers-reduced-motion`
  support and a WebGL fallback event (`caustic-error`).
- `crossfade-loop.js`: a standalone, dependency-free looping music player.
- TypeScript declarations, examples, an interactive playground and
  `tools/make-loop.py` for turning any track into a seamless loop.
