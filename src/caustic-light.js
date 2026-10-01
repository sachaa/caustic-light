/*!
 * caustic-light.js · <caustic-light> web component · v1.1.0
 * https://www.npmjs.com/package/caustic-light · MIT License · (c) 2026 Sacha
 *
 * Physically based caustic light: the bright webs, ribbons and cusps that curved
 * glass, water and polished metal throw onto a wall. WebGL2, no dependencies.
 *
 * How it works
 *   A dense grid of parallel (or diverging) light rays hits an animated, bumpy
 *   optic. Each ray is reflected or refracted by the local slope and travels
 *   `distance` to the wall, which is the element itself. Every grid triangle is
 *   drawn where its rays land, with brightness = (area it had) / (area it covers
 *   now), so light is conserved and folds come out as crisp bright lines.
 *
 * Usage
 *   <script src="caustic-light.js"></script>
 *   <caustic-light preset="pool" style="position:absolute; inset:0"></caustic-light>
 *
 *   The element is display:block and has no intrinsic height: size it like any
 *   block (height, aspect-ratio, or position:absolute with inset). For an overlay
 *   on top of page content use background="transparent", which draws light only
 *   and blends with `mix-blend-mode: screen`.
 *
 * Attributes (all optional; the preset supplies the rest)
 *   preset        laser | blown-glass | pool | prism | hammered
 *   surface       flow | ripple | hammered | lens     shape of the bumpy optic
 *   mode          reflect | refract                   mirror, or glass / water
 *   distance      0–6      throw from optic to wall; longer = sharper, more folded
 *   relief        0–1.5    surface slope, how strongly rays bend
 *   scale         0.2–20   bump density (bumps per half element height)
 *   detail        1–6      octaves of finer bumps
 *   roughness     0–1      weight of each finer octave
 *   warp          0–2      domain warp; turns regular waves into organic ribbons
 *   speed         0–3      animation speed; 0 holds still and refines the image
 *   seed          number   picks a different surface
 *   color         CSS color of the light
 *   gradient      two CSS colors, e.g. "#1d4ed8 #e0f7ff": a gradient map for the light.
 *                 Faint light takes the first colour, the brightest folds the second;
 *                 where there is no light you still see the background (or transparency).
 *                 Replaces `color` while set; "none" turns it off.
 *   gradient-mid  0.05–0.95  where the first colour hands over to the second (default 0.55)
 *   background    CSS color of the wall, or "transparent"
 *   intensity     0–20     light power
 *   contrast      0.3–4    above 1 darkens the soft veil and lifts the bright lines
 *   ior           1–2.5    refractive index (refract mode)
 *   dispersion    0–1      splits colours along the folds (spectral samples)
 *   beam          0–3      0 floods the element; above 0 = radius of a round beam
 *                          in half element heights
 *   beam-x, beam-y  -1–1   beam centre (y up)
 *   spread        0–6      beam divergence; fans the pattern out from the centre
 *   softness      0–6      blur in CSS pixels (a larger light source)
 *   glow          0–3      haze around bright lines
 *   trail         0–0.95   temporal smoothing while animating
 *   grain         0–0.2    film grain
 *   quality       auto | low | medium | high
 *   hover         none, or any of: ripple lens calm swirl focus tilt glow
 *                          (space separated, combinable). Off by default;
 *                          the prism preset turns on all but ripple.
 *                  ripple  rings spread from the pointer as it moves; a click drops a bigger one
 *                  lens    a soft lens follows the pointer and gathers light into a ring
 *                  calm    the optic goes still under the pointer; the light relaxes
 *                  swirl   the pattern twists around the pointer, more when it moves fast
 *                  focus   lines sharpen and multiply under the pointer
 *                  tilt    the light source leans toward the pointer (parallax)
 *                  glow    a soft pool of extra light under the pointer
 *   hover-strength 0–3     scales every hover effect (default 1)
 *   hover-radius  0.05–1.5 size of the affected area, in half element heights (default 0.35)
 *   interactive   boolean  shorthand for hover="lens"
 *
 *   Music (optional). The light follows the track's dynamics: swells brighten and
 *   quicken the flow, low end deepens the relief, highs lift the glow.
 *   audio          URL of a music file (MP3, or anything the browser decodes). It loops
 *                  forever, crossfading its end into its start. Needs CORS if cross-origin.
 *   audio-element  CSS selector of an existing <audio>/<video> to follow instead
 *   audio-react    0–2      how strongly the music moves the light (default 0.6, 0 = off)
 *   audio-volume   0–1      playback volume (default 0.6)
 *   audio-crossfade 0–20    seconds of overlap at the loop point (default 4; use ~0.5 for
 *                           a file that is already a seamless loop)
 *   audio-controls boolean  show a small play / pause button in the corner
 *   audio-autoplay boolean  start on the visitor's first click, tap or key press
 *                           (browsers never allow sound before that)
 *   paused        boolean
 *   motion        auto | always   "auto" holds still under prefers-reduced-motion
 *
 * JavaScript
 *   const el = document.querySelector('caustic-light');
 *   el.setOptions({ distance: 1.8, color: '#9ff' });   // merge options
 *   el.options;                                          // effective options
 *   el.pause(); el.play();
 *   el.stats;                                            // { fps, rays, bands, quality }
 *   el.ripple(x, y, amount);                             // drop a ripple (element coords -1..1, y up)
 *   el.playAudio(); el.pauseAudio(); el.toggleAudio();   // call from a click or key press
 *   el.audioPlaying; el.audioLevels;                     // state, and { energy, low, mid, high } around 1
 *   events: 'audio-play', 'audio-pause', 'caustic-error'
 *   CausticLight.presets;                                // preset table
 *   CausticLight.defaults;                               // default options
 *   CausticLight.attributes;                             // option key -> attribute name
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.customElements || customElements.get('caustic-light')) return;

  /* ------------------------------------------------------------ options */
  const DEFAULTS = {
    surface: 'flow', mode: 'reflect', distance: 1.2, relief: 0.35, scale: 1.4, detail: 3, roughness: 0.5,
    warp: 0.6, speed: 0.25, seed: 1, color: '#fff6e8', background: '#1b1916', intensity: 0.7, contrast: 1.4,
    ior: 1.5, dispersion: 0, beam: 0, beamX: 0, beamY: 0, spread: 0, softness: 1, glow: 0.6, trail: 0.4,
    grain: 0.03, quality: 'auto', gradient: '', gradientMid: 0.55, audio: '', audioElement: '', audioReact: 0.6, audioVolume: 0.6, audioCrossfade: 4, audioControls: false, audioAutoplay: false, hover: '', hoverStrength: 1, hoverRadius: 0.35, interactive: false, paused: false, motion: 'auto'
  };
  const HOVER_FX = ['ripple', 'lens', 'calm', 'swirl', 'focus', 'tilt', 'glow'];
  const PRESETS = {
    laser: {
      label: 'Laser web', note: 'A 488 nm beam through a hammered glass sphere, spread across a wall',
      surface: 'hammered', mode: 'refract', ior: 1.5, distance: 2.6, relief: 0.5, scale: 6, detail: 2, roughness: 0.45, warp: 0.5,
      speed: 0.07, seed: 7, color: '#2ee8ff', background: '#1a1817', intensity: 11, contrast: 1.5, dispersion: 0,
      beam: 0.16, beamX: 0, beamY: 0.05, spread: 2.6, softness: 0.6, glow: 1.0, trail: 0.4, grain: 0.04
    },
    'blown-glass': {
      label: 'Blown glass', note: 'A warm lamp shining up through an uneven glass shell',
      surface: 'flow', mode: 'refract', ior: 1.5, distance: 3.0, relief: 0.4, scale: 9, detail: 3, roughness: 0.45, warp: 0.55,
      speed: 0.12, seed: 11, color: '#ffd7a3', gradient: '#b0521f #fff3dc', gradientMid: 0.5, background: '#16110d', intensity: 3.0, contrast: 2.1, dispersion: 0,
      beam: 0.5, beamX: 0, beamY: -0.72, spread: 1.4, softness: 1.0, glow: 0.9, trail: 0.4, grain: 0.04
    },
    pool: {
      label: 'Pool floor', note: 'Sunlight through rippling water onto the floor of a pool',
      surface: 'ripple', mode: 'refract', ior: 1.333, distance: 1.4, relief: 0.42, scale: 2.6, detail: 4, roughness: 0.55, warp: 0.6,
      speed: 0.55, seed: 2, color: '#effcff', background: '#0f4656', intensity: 0.3, contrast: 2.2, dispersion: 0,
      beam: 0, beamX: 0, beamY: 0, spread: 0, softness: 0.9, glow: 0.45, trail: 0.35, grain: 0.03
    },
    prism: {
      label: 'Prism lens', note: 'A thick glass bowl focusing sunlight, split into colour at the folds',
      surface: 'lens', mode: 'refract', ior: 1.52, distance: 4.0, relief: 1.2, scale: 1.2, detail: 2, roughness: 0.5, warp: 0.3,
      speed: 0.06, seed: 5, color: '#ffffff', background: '#2c2c2e', intensity: 0.8, contrast: 1.4, dispersion: 0.55,
      beam: 0.8, beamX: -0.3, beamY: 0, spread: 0.3, softness: 0.8, glow: 0.6, trail: 0.4, grain: 0.03,
      hover: 'lens calm swirl focus tilt glow'
    },
    hammered: {
      label: 'Hammered glass', note: 'Thick dimpled glass throwing a net onto a blue table',
      surface: 'hammered', mode: 'refract', ior: 1.5, distance: 1.1, relief: 0.55, scale: 1.8, detail: 2, roughness: 0.4, warp: 0.9,
      speed: 0.1, seed: 4, color: '#e2f1ff', gradient: '#4f86ff #f4f9ff', gradientMid: 0.5, background: '#163f86', intensity: 0.3, contrast: 2.3, dispersion: 0.12,
      beam: 0, beamX: 0, beamY: 0, spread: 0, softness: 0.8, glow: 0.5, trail: 0.35, grain: 0.035
    }
  };
  // Retired presets: left out of the list, but still honoured so pages that already
  // use them keep their look.
  const RETIRED = {
    silk: {
      surface: 'flow', mode: 'reflect', distance: 3.2, relief: 0.18, scale: 0.8, detail: 5, roughness: 0.32, warp: 0.5,
      speed: 0.2, seed: 3, color: '#fff3df', background: '#46413b', intensity: 0.3, contrast: 2.2, dispersion: 0,
      beam: 0, beamX: 0, beamY: 0, spread: 0, softness: 1.0, glow: 0.5, trail: 0.45, grain: 0.035
    }
  };
  // attribute name -> [option key, type, min, max, values]
  const SPEC = {
    surface: ['surface', 'enum', 0, 0, ['flow', 'ripple', 'hammered', 'lens']],
    mode: ['mode', 'enum', 0, 0, ['reflect', 'refract']],
    distance: ['distance', 'num', 0, 6], relief: ['relief', 'num', 0, 1.5], scale: ['scale', 'num', 0.2, 20],
    detail: ['detail', 'int', 1, 6], roughness: ['roughness', 'num', 0, 1], warp: ['warp', 'num', 0, 2],
    speed: ['speed', 'num', 0, 3], seed: ['seed', 'num', -1e6, 1e6], color: ['color', 'color'], background: ['background', 'color'],
    gradient: ['gradient', 'gradient'], 'gradient-mid': ['gradientMid', 'num', 0.05, 0.95],
    intensity: ['intensity', 'num', 0, 20], contrast: ['contrast', 'num', 0.3, 4], ior: ['ior', 'num', 1, 2.5],
    dispersion: ['dispersion', 'num', 0, 1], beam: ['beam', 'num', 0, 3], 'beam-x': ['beamX', 'num', -1, 1], 'beam-y': ['beamY', 'num', -1, 1],
    spread: ['spread', 'num', 0, 6], softness: ['softness', 'num', 0, 6], glow: ['glow', 'num', 0, 3], trail: ['trail', 'num', 0, 0.95],
    grain: ['grain', 'num', 0, 0.2], quality: ['quality', 'enum', 0, 0, ['auto', 'low', 'medium', 'high']],
    hover: ['hover', 'list', 0, 0, null], 'hover-strength': ['hoverStrength', 'num', 0, 3], 'hover-radius': ['hoverRadius', 'num', 0.05, 1.5],
    audio: ['audio', 'str'], 'audio-element': ['audioElement', 'str'], 'audio-react': ['audioReact', 'num', 0, 2],
    'audio-volume': ['audioVolume', 'num', 0, 1], 'audio-crossfade': ['audioCrossfade', 'num', 0, 20],
    'audio-controls': ['audioControls', 'bool'], 'audio-autoplay': ['audioAutoplay', 'bool'],
    interactive: ['interactive', 'bool'], paused: ['paused', 'bool'], motion: ['motion', 'enum', 0, 0, ['auto', 'always']]
  };
  const KEY2ATTR = {}; for (const a in SPEC) KEY2ATTR[SPEC[a][0]] = a;
  const QUALITY = {
    low: { N: 200, res: 0.45, bands: 3, dpr: 1.25 },
    medium: { N: 300, res: 0.55, bands: 5, dpr: 1.5 },
    high: { N: 440, res: 0.65, bands: 7, dpr: 2 }
  };
  const LEVELS = ['low', 'medium', 'high'];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const frac = x => x - Math.floor(x);
  const srgb2lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  let ctx2d = null;
  function parseColor(v) {
    if (Array.isArray(v)) return v.slice(0, 3);
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    if (/^(transparent|none)$/i.test(s)) return 'transparent';
    if (!ctx2d) ctx2d = document.createElement('canvas').getContext('2d');
    ctx2d.fillStyle = '#010203'; ctx2d.fillStyle = s;
    const out = ctx2d.fillStyle;
    if (out === '#010203' && !/^#010203$/i.test(s)) return null;
    if (out[0] === '#') return [1, 3, 5].map(i => parseInt(out.slice(i, i + 2), 16) / 255);
    const m = out.match(/[\d.]+/g); return m ? [m[0] / 255, m[1] / 255, m[2] / 255] : null;
  }
  // "#123 #fff", "rgb(0 40 90), white", ["#123", "#fff"] -> ['#123', '#fff'] (two valid colours) or null
  function gradientStops(v) {
    if (v == null || v === '') return null;
    let toks = Array.isArray(v) ? v.map(String) : (String(v).match(/(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|#[0-9a-f]{3,8}\b|[a-z]+/gi) || []);
    toks = toks.filter(t => { const c = parseColor(t); return Array.isArray(c); });
    return toks.length >= 2 ? toks.slice(0, 2) : null;
  }
  function coerce(key, v) {
    const attr = KEY2ATTR[key]; if (!attr) return undefined;
    const [, type, mn, mx, vals] = SPEC[attr];
    if (type === 'bool') return v === '' || v === true || v === 'true' || v === 1 || v === '1';
    if (type === 'str') return String(v == null ? '' : v).trim();
    if (type === 'list') {
      const toks = (Array.isArray(v) ? v : String(v == null ? '' : v).split(/[\s,]+/)).map(t => String(t).toLowerCase());
      return HOVER_FX.filter(f => toks.includes(f)).join(' ');
    }
    if (type === 'enum') { const s = String(v).toLowerCase(); return vals.includes(s) ? s : undefined; }
    if (type === 'color') return parseColor(v) ? (Array.isArray(v) ? v : String(v)) : undefined;
    if (type === 'gradient') {
      const g = gradientStops(v);
      return g ? g.map(t => '#' + parseColor(t).map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')).join(' ') : '';
    }
    const n = parseFloat(v); if (!isFinite(n)) return undefined;
    return type === 'int' ? Math.round(clamp(n, mn, mx)) : clamp(n, mn, mx);
  }
  function specRGB(l) { // CIE 1931 multi-lobe fit -> linear sRGB, clipped
    const g = (x, m, s1, s2) => { const t = (x - m) / (x < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
    const X = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
    const Y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
    const Z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
    return [Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z), Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z), Math.max(0, 0.0557 * X - 0.2040 * Y + 1.0570 * Z)];
  }
  const LAM0 = 410, LAM1 = 690;
  const SPEC_MEAN = (() => { const s = [0, 0, 0]; for (let i = 0; i < 280; i++) { const c = specRGB(LAM0 + (i + 0.5)); s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; } return s.map(v => v / 280); })();

  /* ------------------------------------------------------------ GLSL */
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n';
  const VS_TRI = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p*2.0 - 1.0, 0.0, 1.0); }';
  const HEIGHT = `
uniform int uSurf;
uniform float uTime;
uniform float uScale;
uniform float uRelief;
uniform float uWarp;
uniform float uRough;
uniform float uSeed;
uniform int uDetail;
uniform vec4 uHov;
uniform vec4 uHovA;
uniform vec4 uHovB;
uniform vec4 uRip[8];
uniform int uRipN;
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz)*p3.zy);
}
const mat2 OCT = mat2(1.6, 1.2, -1.2, 1.6);
float hFlow(vec2 p, float t, int oct){
  float s = 0.0, a = 1.0, n = 0.0;
  for (int k = 0; k < 6; k++){
    if (k >= oct) break;
    float fk = float(k);
    float an = fk*2.39996 + uSeed*1.618;
    vec2 d = vec2(cos(an), sin(an));
    s += a*sin(dot(p, d) + t*(0.9 + 0.31*fk) + fk*1.7 + uSeed*3.1);
    n += a;
    p += uWarp*vec2(d.y, -d.x)*cos(dot(p, d.yx)*1.31 - t*0.7 + fk*2.3);
    p = OCT*p;
    a *= uRough;
  }
  return s/max(n, 1e-3);
}
float hRipple(vec2 p, float t){
  float s = 0.0, a = 1.0, n = 0.0, f = 1.0;
  for (int k = 0; k < 6; k++){
    if (k >= uDetail) break;
    float fk = float(k);
    for (int j = 0; j < 3; j++){
      float fj = float(j);
      float an = fk*1.1 + fj*2.0944 + uSeed*1.618 + 0.35*sin(fk*3.1 + fj);
      vec2 d = vec2(cos(an), sin(an));
      float ff = f*(1.0 + 0.14*fj);
      s += a*sin(dot(p, d)*ff - t*sqrt(ff)*1.7 + fk*1.3 + fj*2.1 + uSeed);
      n += a;
    }
    p += uWarp*0.5*a/f*vec2(sin(p.y*f*0.7 + t*0.6), cos(p.x*f*0.8 - t*0.5));
    a *= uRough; f *= 1.9;
  }
  return 1.7*s/max(n, 1e-3);
}
float hHammer(vec2 p, float t){
  float s = 0.0, a = 1.0, n = 0.0;
  for (int k = 0; k < 3; k++){
    if (k >= uDetail) break;
    vec2 q = p + uWarp*0.35*vec2(sin(p.y*0.9 + t*0.3), cos(p.x*0.8 - t*0.25));
    vec2 i = floor(q), f = fract(q);
    float acc = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g + vec2(uSeed*17.0 + float(k)*31.0, uSeed*5.0));
      o = 0.5 + 0.4*sin(t*0.6 + 6.2831*o);
      vec2 r = g + o - f;
      acc += exp(-7.0*dot(r, r));
    }
    s += a*(-log(acc + 1e-4)/7.0);
    n += a;
    p = OCT*p; a *= uRough;
  }
  return 2.0*s/max(n, 1e-3);
}
float hLens(vec2 p, float t){
  vec2 c = vec2(0.22*sin(t*0.23 + uSeed), 0.18*cos(t*0.19 + uSeed*1.3));
  vec2 d = p - c;
  float r2 = d.x*d.x + 1.35*d.y*d.y;
  float r = sqrt(r2 + 1e-6);
  float h = -0.5*r2 + 0.16*d.x*r2 - 0.05*d.y*r2*sin(t*0.3 + uSeed);
  h += 0.05*sin(r*8.0 - t*0.7 + uSeed)*exp(-0.35*r2);
  if (uDetail > 1) h += 0.1*hFlow(p*1.4, t, uDetail - 1);
  return h;
}
float hoverG(vec2 p){ vec2 d = p - uHov.xy; return exp(-dot(d, d)/(uHov.z*uHov.z)); }
float height(vec2 p){
  // hover: swirl twists the lookup around the pointer
  vec2 pp = p;
  if (uHovA.z != 0.0){ vec2 d = p - uHov.xy; float a = uHovA.z*hoverG(p); float c = cos(a), sn = sin(a); pp = uHov.xy + mat2(c, sn, -sn, c)*d; }
  vec2 q = pp*uScale;
  float h;
  if (uSurf == 0) h = hFlow(q, uTime, uDetail);
  else if (uSurf == 1) h = hRipple(q, uTime);
  else if (uSurf == 2) h = hHammer(q, uTime);
  else h = hLens(q, uTime);
  h *= uRelief/uScale;
  if (uHovA.y != 0.0) h *= 1.0 - uHovA.y*hoverG(p);
  if (uHovA.x != 0.0) h += uHovA.x*uHov.z*0.5*hoverG(p);
  for (int i = 0; i < 8; i++){
    if (i >= uRipN) break;
    vec4 r = uRip[i];
    float x = length(p - r.xy) - r.z*0.55;
    h += r.w*uHovB.w*0.0035*exp(-x*x/0.012 - r.z*1.1)*sin(x*55.0);
  }
  return h;
}
vec2 gradH(vec2 p){
  float e = min(0.003/uScale, 0.0015);
  return vec2(height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0)), height(p + vec2(0.0, e)) - height(p - vec2(0.0, e)))/(2.0*e);
}
`;
  const FS_GRAD = HEAD + HEIGHT + `
uniform ivec2 uN;
uniform vec4 uDom;
uniform vec2 uJit;
out vec4 o;
void main(){
  vec2 ij = floor(gl_FragCoord.xy);
  vec2 s = uDom.xy + (ij + uJit)/(vec2(uN) - 1.0)*(uDom.zw - uDom.xy);
  o = vec4(s, gradH(s));
}`;
  const VS_SPLAT = (useTex, points) => HEAD + (useTex ? '#define USE_TEX 1\n' : '') + (points ? '#define POINTS 1\n' : '') + HEIGHT + `
uniform sampler2D uGrad;
uniform ivec2 uN;
uniform vec4 uDom;
uniform vec2 uJit;
uniform float uDist;
uniform float uIor;
uniform float uBandK;
uniform float uSpread;
uniform float uBeamR;
uniform int uMode;
uniform vec2 uBeamC;
uniform vec2 uView;
uniform float uEdge;
uniform vec2 uCell;
uniform float uPtSize;
uniform float uFluxK;
uniform float uPxU;
uniform float uSig0;
out vec2 vSrc;
out vec2 vDst;
out float vW;
#ifdef POINTS
out vec2 vAx;
out vec2 vSg;
#endif
vec2 mapTo(vec2 s, vec2 gr){
  vec3 n = normalize(vec3(-gr, 1.0));
  vec3 d = normalize(vec3(uHovB.yz, -1.0));
  vec3 r; float T = uDist;
  if (uMode == 1){ r = refract(d, n, 1.0/(uIor*(1.0 + uBandK*0.03))); }
  else { r = reflect(d, n); r.z = -r.z; T *= 1.0 + uBandK*0.08; }
  vec2 base = uBeamC + (s - uBeamC)*(1.0 + uSpread);
  vec2 off = r.xy/max(-r.z, 0.08);
  // focus: rays that would land near the pointer travel further, so their folds sharpen
  if (uHovB.x != 0.0) T *= 1.0 + uHovB.x*hoverG(base + off*T);
  return base + off*T;
}
void main(){
  int id = gl_VertexID;
  ivec2 ij = ivec2(id % uN.x, id / uN.x);
#ifdef USE_TEX
  vec4 g = texelFetch(uGrad, ij, 0);
  vec2 s = g.xy, gr = g.zw;
#else
  vec2 s = uDom.xy + (vec2(ij) + uJit)/(vec2(uN) - 1.0)*(uDom.zw - uDom.xy);
  vec2 gr = gradH(s);
#endif
  vec2 dst = mapTo(s, gr);
  vec2 e2 = min(s - uDom.xy, uDom.zw - s)/max(uEdge, 1e-4);
  float w = smoothstep(0.0, 1.0, min(e2.x, e2.y));
  if (uBeamR > 0.0){ vec2 q = (s - uBeamC)/uBeamR; w = exp(-2.0*dot(q, q)); }
  if (uHovA.w != 0.0) w *= 1.0 + uHovA.w*hoverG(dst);
  // local compression of the ray grid: 1 = undistorted, near 0 at a fold
  float wt = 1.0;
#ifdef USE_TEX
  bool ex = ij.x + 1 < uN.x, ey = ij.y + 1 < uN.y;
  vec4 ga = texelFetch(uGrad, ivec2(ex ? ij.x + 1 : ij.x - 1, ij.y), 0);
  vec4 gb = texelFetch(uGrad, ivec2(ij.x, ey ? ij.y + 1 : ij.y - 1), 0);
  vec2 da = mapTo(ga.xy, ga.zw) - dst, db = mapTo(gb.xy, gb.zw) - dst;
  float sp = (1.0 + uSpread)*(1.0 + uSpread);
  float cc = abs(da.x*db.y - da.y*db.x)/(uCell.x*uCell.y*sp);
  wt = smoothstep(0.18, 0.55, cc);
#endif
  vSrc = s; vDst = dst;
#ifdef POINTS
  float f = w*(1.0 - wt);
  vW = f*uFluxK;
  // elongate each photon along the fold so neighbours overlap instead of leaving beads
  vec2 L = dot(da, da) > dot(db, db) ? da : db;
  float lp = length(L)*uPxU;
  vAx = lp > 1e-6 ? vec2(L.x, -L.y)/length(L) : vec2(1.0, 0.0);
  float sM = clamp(0.55*lp, uSig0, 10.0);
  vSg = vec2(sM, uSig0);
  gl_PointSize = min(ceil(sM*6.0), uPtSize);
  gl_Position = f > 1e-4 ? vec4(dst/uView, 0.0, 1.0) : vec4(64.0, 64.0, 0.0, 1.0);
#else
  vW = w;
  gl_Position = vec4(dst/uView, 0.0, 1.0);
#endif
}`;
  const FS_SPLAT = HEAD + `
uniform vec3 uCol;
uniform float uClampR;
uniform float uHand;
uniform float uSpread2;
in vec2 vSrc;
in vec2 vDst;
in float vW;
out vec4 o;
void main(){
  vec2 a = dFdx(vSrc), b = dFdy(vSrc), c = dFdx(vDst), d = dFdy(vDst);
  float aS = abs(a.x*b.y - a.y*b.x), aD = abs(c.x*d.y - c.y*d.x);
  float ratio = aS/max(aD, 1e-14);
  // strongly compressed (sliver) triangles alias into beads; the photon pass draws them instead
  float wt = uHand > 0.5 ? smoothstep(0.18, 0.55, 1.0/(ratio*uSpread2)) : 1.0;
  o = vec4(uCol*vW*wt*min(ratio, uClampR), 1.0);
}`;
  const FS_POINT = HEAD + `
uniform vec3 uCol;
uniform float uPtSize;
in float vW;
in vec2 vAx;
in vec2 vSg;
out vec4 o;
void main(){
  float size = min(ceil(vSg.x*6.0), uPtSize);
  vec2 d = (gl_PointCoord - 0.5)*size;
  float a = dot(d, vAx), b = dot(d, vec2(-vAx.y, vAx.x));
  float g = exp(-0.5*(a*a/(vSg.x*vSg.x) + b*b/(vSg.y*vSg.y)))/(6.2831853*vSg.x*vSg.y);
  o = vec4(uCol*vW*g, 1.0);
}`;
  const FS_COPY = HEAD + `
uniform sampler2D uSrc;
uniform int uSS;
out vec4 o;
void main(){
  ivec2 b = ivec2(gl_FragCoord.xy)*uSS;
  vec3 c = vec3(0.0);
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++){
    if (x < uSS && y < uSS) c += texelFetch(uSrc, b + ivec2(x, y), 0).rgb;
  }
  o = vec4(c/float(uSS*uSS), 1.0);
}`;
  const FS_DOWN = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uTx;
uniform vec2 uDst;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec3 c = texture(uSrc, uv).rgb*4.0;
  c += texture(uSrc, uv + vec2(-1.0, -1.0)*uTx).rgb + texture(uSrc, uv + vec2(1.0, -1.0)*uTx).rgb;
  c += texture(uSrc, uv + vec2(-1.0, 1.0)*uTx).rgb + texture(uSrc, uv + vec2(1.0, 1.0)*uTx).rgb;
  o = vec4(c*0.125, 1.0);
}`;
  const FS_UP = HEAD + `
uniform sampler2D uSrc;
uniform vec2 uTx;
uniform vec2 uDst;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec3 c = texture(uSrc, uv + vec2(-2.0, 0.0)*uTx).rgb + texture(uSrc, uv + vec2(2.0, 0.0)*uTx).rgb
         + texture(uSrc, uv + vec2(0.0, -2.0)*uTx).rgb + texture(uSrc, uv + vec2(0.0, 2.0)*uTx).rgb;
  c += 2.0*(texture(uSrc, uv + vec2(-1.0, -1.0)*uTx).rgb + texture(uSrc, uv + vec2(1.0, -1.0)*uTx).rgb
          + texture(uSrc, uv + vec2(-1.0, 1.0)*uTx).rgb + texture(uSrc, uv + vec2(1.0, 1.0)*uTx).rgb);
  o = vec4(c/12.0, 1.0);
}`;
  const FS_SHOW = HEAD + `
uniform sampler2D uHist;
uniform sampler2D uGlow;
uniform vec2 uRes;
uniform vec2 uHistTx;
uniform float uSoft;
uniform float uGlowK;
uniform float uContrast;
uniform float uGrain;
uniform float uSeedF;
uniform float uGain;
uniform vec3 uBg;
uniform int uClear;
uniform int uGradOn;
uniform vec3 uGradA;
uniform vec3 uGradB;
uniform float uGradMid;
out vec4 o;
const vec2 PD[12] = vec2[12](vec2(-0.326,-0.406), vec2(-0.840,-0.074), vec2(-0.696,0.457), vec2(-0.203,0.621), vec2(0.962,-0.195), vec2(0.473,-0.480), vec2(0.519,0.767), vec2(0.185,-0.893), vec2(0.507,0.064), vec2(0.896,0.412), vec2(-0.322,-0.933), vec2(-0.792,-0.598));
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 c = texture(uHist, uv).rgb;
  if (uSoft > 0.05){
    float ws = 1.0;
    for (int i = 0; i < 12; i++){ float w = exp(-1.5*dot(PD[i], PD[i])); c += texture(uHist, uv + PD[i]*uSoft*uHistTx).rgb*w; ws += w; }
    c /= ws;
  }
  c *= uGain;
  c += texture(uGlow, uv).rgb*uGlowK*uGain;
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (uGradOn == 1){
    // gradient map: brightness picks the colour; spectral hue (dispersion) rides on top as chroma
    float v = 1.0 - exp(-pow(max(L, 1e-6), uContrast));
    vec3 chroma = c/max(L, 1e-6);
    float w = smoothstep(max(uGradMid - 0.4, 0.0), min(uGradMid + 0.4, 1.0), v);
    c = v*mix(uGradA, uGradB, w)*chroma;
  } else {
    c *= pow(max(L, 1e-6), uContrast - 1.0);
    c = 1.0 - exp(-c);
  }
  c *= 1.0 + (hash12(gl_FragCoord.xy + uSeedF) - 0.5)*2.0*uGrain;
  c = clamp(c, 0.0, 1.0);
  vec3 outc = uClear == 1 ? c : 1.0 - (1.0 - uBg)*(1.0 - c);
  outc = mix(outc*12.92, 1.055*pow(outc, vec3(1.0/2.4)) - 0.055, step(0.0031308, outc));
  outc += (hash12(gl_FragCoord.yx + uSeedF*1.37) - 0.5)/255.0;
  o = vec4(outc, 1.0);
}`;

  /* ------------------------------------------------------------ engine */
  class Engine {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL 2 is not available');
      this.gl = gl;
      this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
      const tex = this.floatOK;
      this.P = {
        grad: tex ? this.program(VS_TRI, FS_GRAD) : null,
        splat: this.program(VS_SPLAT(tex, false), FS_SPLAT),
        point: tex ? this.program(VS_SPLAT(true, true), FS_POINT) : null,
        copy: this.program(VS_TRI, FS_COPY),
        down: this.program(VS_TRI, FS_DOWN),
        up: this.program(VS_TRI, FS_UP),
        show: this.program(VS_TRI, FS_SHOW)
      };
      this.vao = gl.createVertexArray();
      this.gridVao = gl.createVertexArray();
      this.ibo = gl.createBuffer();
      this.nx = 0; this.ny = 0; this.aw = 0; this.ah = 0;
      this.glowLv = [];
    }
    program(vs, fs) {
      const gl = this.gl;
      const mk = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p, info.name), type: info.type }; }
      return { p, u };
    }
    set(pr, vals) {
      const gl = this.gl;
      for (const k in vals) {
        const u = pr.u[k]; if (!u) continue; const v = vals[k];
        switch (u.type) {
          case gl.FLOAT: gl.uniform1f(u.loc, v); break;
          case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
          case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
          case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
          case gl.INT_VEC2: gl.uniform2iv(u.loc, v); break;
          default: gl.uniform1i(u.loc, v);
        }
      }
    }
    tex(w, h, fmt, filter) {
      const gl = this.gl; const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, f, w, h };
    }
    free(o) { if (o) { this.gl.deleteTexture(o.t); this.gl.deleteFramebuffer(o.f); } }
    ensureGrid(nx, ny) {
      if (nx === this.nx && ny === this.ny) return;
      const gl = this.gl;
      this.nx = nx; this.ny = ny;
      if (this.floatOK) { this.free(this.gradT); this.gradT = this.tex(nx, ny, gl.RGBA32F, gl.NEAREST); }
      const idx = new Uint32Array((nx - 1) * (ny - 1) * 6); let k = 0;
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = c;
      }
      gl.bindVertexArray(this.gridVao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.count = idx.length;
    }
    ensureTargets(w, h) {
      if (w === this.aw && h === this.ah) return false;
      const gl = this.gl; this.aw = w; this.ah = h;
      const fmt = this.floatOK ? gl.RGBA16F : gl.RGBA8;
      const maxT = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
      this.ss = (w * 2 <= maxT && h * 2 <= maxT) ? 2 : 1;
      this.free(this.acc); this.free(this.hist);
      this.acc = this.tex(w * this.ss, h * this.ss, fmt, gl.NEAREST);
      this.hist = this.tex(w, h, fmt, gl.LINEAR);
      this.glowLv.forEach(l => this.free(l)); this.glowLv = [];
      let gw = w, gh = h;
      for (let i = 0; i < 4; i++) { gw = Math.max(1, gw >> 1); gh = Math.max(1, gh >> 1); if (gw < 8 || gh < 8) break; this.glowLv.push(this.tex(gw, gh, fmt, gl.LINEAR)); }
      return true;
    }
    draw(fbo, w, h) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h); gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    render(o, st) {
      const gl = this.gl, cv = this.canvas;
      const q = QUALITY[st.level];
      const cssW = cv.clientWidth, cssH = cv.clientHeight;
      if (cssW < 2 || cssH < 2) return null;
      const dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
      const bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      const aw = Math.max(16, Math.round(bw * q.res)), ah = Math.max(16, Math.round(bh * q.res));
      const resized = this.ensureTargets(aw, ah);
      const asp = cssW / cssH;
      const view = [asp, 1];
      const bc = [o.beamX * asp, o.beamY];
      const sp = 1 + o.spread;
      const th = Math.atan(o.relief * 1.5);
      const dev = o.mode === 'reflect' ? Math.tan(Math.min(2 * th, 1.3)) : Math.tan(th - Math.asin(Math.sin(th) / o.ior));
      const m = clamp(o.distance * dev * 0.8 + 0.08 + o.distance * Math.hypot(st.hov.b[1], st.hov.b[2]), 0.08, 1.7) / sp;
      let dom = [bc[0] + (-asp - bc[0]) / sp - m, bc[1] + (-1 - bc[1]) / sp - m, bc[0] + (asp - bc[0]) / sp + m, bc[1] + (1 - bc[1]) / sp + m];
      const r = o.beam * 2.6;
      if (o.beam > 0 && 2 * r < Math.max(dom[2] - dom[0], dom[3] - dom[1])) dom = [bc[0] - r, bc[1] - r, bc[0] + r, bc[1] + r];
      const dw = dom[2] - dom[0], dh = dom[3] - dom[1];
      let ny = q.N, nx = Math.round(q.N * dw / dh);
      if (nx > q.N * 2.4) { nx = Math.round(q.N * 2.4); }
      if (nx < 16) nx = 16;
      if (dw / dh < 1) { nx = q.N; ny = Math.min(Math.round(q.N * dh / dw), Math.round(q.N * 2.4)); }
      this.ensureGrid(nx, ny);

      const k = st.k;
      const jit = [frac(0.5 + st.frame * 0.7548776662), frac(0.5 + st.frame * 0.5698402910)];
      const hv = {
        uSurf: ['flow', 'ripple', 'hammered', 'lens'].indexOf(o.surface), uTime: st.time, uScale: o.scale, uRelief: o.relief,
        uWarp: o.warp, uRough: o.roughness, uSeed: o.seed % 1000, uDetail: o.detail,
        uHov: st.hov.pos, uHovA: st.hov.a, uHovB: st.hov.b, uRip: st.hov.rip, uRipN: st.hov.ripN,
        uN: [nx, ny], uDom: dom, uJit: jit
      };
      if (this.floatOK) {
        gl.useProgram(this.P.grad.p); this.set(this.P.grad, hv);
        gl.disable(gl.BLEND);
        this.draw(this.gradT.f, nx, ny);
      }
      // splat every spectral band
      const lc = st.grad ? [1, 1, 1] : st.col.map(srgb2lin);
      const nb = o.dispersion > 0.001 ? q.bands : 1;
      const bands = [];
      if (nb === 1) bands.push({ K: 0, c: lc });
      else {
        const j = st.animating ? 0.5 : frac(0.5 + k * 0.6180339887);
        let nrm;
        if (st.animating) { nrm = [0, 0, 0]; for (let i = 0; i < nb; i++) { const c = specRGB(LAM0 + (i + 0.5) / nb * (LAM1 - LAM0)); nrm[0] += c[0]; nrm[1] += c[1]; nrm[2] += c[2]; } }
        else nrm = SPEC_MEAN.map(v => v * nb);
        for (let i = 0; i < nb; i++) {
          const lam = LAM0 + (i + j) / nb * (LAM1 - LAM0);
          const c = specRGB(lam);
          bands.push({ K: o.dispersion * 4 * (Math.pow(560 / lam, 2) - 1), c: [c[0] / nrm[0] * lc[0], c[1] / nrm[1] * lc[1], c[2] / nrm[2] * lc[2]] });
        }
      }
      const scaleOut = this.floatOK ? 1 : 8;
      const cellA = (dw / (nx - 1)) * (dh / (ny - 1)) * 0.5;
      const pixA = (2 * asp / (aw * this.ss)) * (2 / (ah * this.ss));
      const clampR = Math.max(12, 5 * cellA / pixA);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.acc.f);
      gl.viewport(0, 0, aw * this.ss, ah * this.ss);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
      const sp_ = this.P.splat; gl.useProgram(sp_.p);
      this.set(sp_, hv);
      this.set(sp_, { uClampR: clampR, uHand: this.P.point ? 1 : 0, uSpread2: (1 + o.spread) * (1 + o.spread) });
      if (this.floatOK) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.gradT.t); }
      const cell = [dw / (nx - 1), dh / (ny - 1)];
      const common = { uDist: o.distance, uIor: o.ior, uSpread: o.spread, uBeamR: o.beam, uMode: o.mode === 'refract' ? 1 : 0, uBeamC: bc, uView: view, uGrad: 0, uEdge: m * 0.7, uCell: cell };
      this.set(sp_, common);
      gl.bindVertexArray(this.gridVao);
      for (const b of bands) {
        this.set(sp_, { uBandK: b.K, uCol: b.c.map(v => v * o.intensity / scaleOut) });
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
      }
      if (this.P.point) {
        // compressed parts of the grid (folds) are splatted as small gaussian photons instead of slivers
        const pp = this.P.point; gl.useProgram(pp.p);
        const sig = 0.75 * this.ss;
        const maxPt = Math.min(64, gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64);
        this.set(pp, hv); this.set(pp, common);
        this.set(pp, { uPtSize: maxPt, uSig0: sig, uPxU: ah * this.ss / 2, uFluxK: cell[0] * cell[1] / pixA });
        gl.bindVertexArray(this.vao);
        for (const b of bands) {
          this.set(pp, { uBandK: b.K, uCol: b.c.map(v => v * o.intensity / scaleOut) });
          gl.drawArrays(gl.POINTS, 0, nx * ny);
        }
      }
      // temporal accumulation into history
      const alpha = (resized || k === 0) ? 1 : (st.animating ? 1 - o.trail : 1 / (k + 1));
      gl.enable(gl.BLEND); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); gl.blendColor(0, 0, 0, alpha);
      gl.useProgram(this.P.copy.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.acc.t); this.set(this.P.copy, { uSrc: 0, uSS: this.ss });
      this.draw(this.hist.f, aw, ah);
      gl.disable(gl.BLEND);
      this.present(o, st);
      return { rays: nx * ny * bands.length, bands: bands.length };
    }
    present(o, st) {
      const gl = this.gl, cv = this.canvas;
      if (!this.hist) return;
      // glow chain
      const useGlow = o.glow > 0.001 && this.glowLv.length > 0;
      if (useGlow) {
        gl.useProgram(this.P.down.p);
        let src = this.hist;
        for (const lv of this.glowLv) {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t);
          this.set(this.P.down, { uSrc: 0, uTx: [1 / src.w, 1 / src.h], uDst: [lv.w, lv.h] });
          this.draw(lv.f, lv.w, lv.h); src = lv;
        }
        gl.useProgram(this.P.up.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        for (let i = this.glowLv.length - 1; i > 0; i--) {
          const s = this.glowLv[i], d = this.glowLv[i - 1];
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.t);
          this.set(this.P.up, { uSrc: 0, uTx: [0.5 / s.w, 0.5 / s.h], uDst: [d.w, d.h] });
          this.draw(d.f, d.w, d.h);
        }
        gl.disable(gl.BLEND);
      }
      const bg = st.bg;
      const clear = bg === 'transparent';
      gl.useProgram(this.P.show.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.hist.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, useGlow ? this.glowLv[0].t : this.hist.t);
      const dpr = cv.width / Math.max(1, cv.clientWidth);
      this.set(this.P.show, {
        uHist: 0, uGlow: 1, uRes: [cv.width, cv.height], uHistTx: [1 / this.aw, 1 / this.ah],
        uSoft: o.softness * dpr * (this.aw / cv.width), uGlowK: useGlow ? o.glow * 0.35 : 0, uContrast: o.contrast,
        uGrain: o.grain, uSeedF: (st.frame % 61) * 7.31, uGain: this.floatOK ? 1 : 8,
        uBg: clear ? [0, 0, 0] : bg.map(srgb2lin), uClear: clear ? 1 : 0,
        uGradOn: st.grad ? 1 : 0, uGradA: st.grad ? st.grad[0].map(srgb2lin) : [0, 0, 0], uGradB: st.grad ? st.grad[1].map(srgb2lin) : [0, 0, 0], uGradMid: o.gradientMid
      });
      this.draw(null, cv.width, cv.height);
    }
    destroy() { const ext = this.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
  }

  /* ------------------------------------------------------------ element */
  /* ------------------------------------------------------------ music */
  const AC = window.AudioContext || window.webkitAudioContext;
  const mediaSources = new WeakMap();
  class AudioDriver {
    constructor(host) {
      this.host = host; this.ctx = null; this.url = ''; this.sel = ''; this.buf = null; this.loading = null;
      this.passes = []; this.next = 0; this.playing = false; this.timer = null; this.media = null;
      this.fast = [0, 0, 0, 0]; this.slow = [0, 0, 0, 0]; this.age = 0; this.mix = 0;
      this.levels = { energy: 1, low: 1, mid: 1, high: 1 };
      this.cf = 4; this.vol = 0.6;
    }
    configure(o) {
      this.cf = o.audioCrossfade; this.vol = o.audioVolume;
      if (this.ctx && this.playing) this.ramp(this.vol, 0.3);
      const url = o.audioElement ? '' : (o.audio || ''), sel = o.audioElement || '';
      if (url === this.url && sel === this.sel) return;
      const was = this.playing;
      this.stopAll(); this.url = url; this.sel = sel; this.buf = null; this.loading = null; this.media = null;
      if (was && (url || sel)) this.play();
    }
    get active() { return !!(this.url || this.sel); }
    ensure() {
      if (this.ctx) return this.ctx;
      if (!AC) throw new Error('Web Audio is not supported in this browser');
      this.ctx = new AC();
      this.bus = this.ctx.createGain();
      this.master = this.ctx.createGain(); this.master.gain.value = 0;
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0.5;
      this.freq = new Float32Array(this.an.frequencyBinCount);
      this.bus.connect(this.master).connect(this.ctx.destination);
      this.bus.connect(this.an);
      return this.ctx;
    }
    load() {
      if (this.buf) return Promise.resolve(this.buf);
      if (this.loading) return this.loading;
      const url = this.url;
      this.loading = fetch(url)
        .then(r => { if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`); return r.arrayBuffer(); })
        .then(d => new Promise((res, rej) => this.ctx.decodeAudioData(d, res, rej)))
        .then(b => { if (url === this.url) this.buf = b; return b; });
      return this.loading;
    }
    async play() {
      if (!this.active) return;
      this.ensure();
      if (this.sel) {
        const el = document.querySelector(this.sel);
        if (!el || !(el instanceof HTMLMediaElement)) throw new Error(`audio-element "${this.sel}" is not an <audio> or <video>`);
        if (!this.media || this.media.el !== el) {
          let node = mediaSources.get(el);
          if (!node) { node = this.ctx.createMediaElementSource(el); mediaSources.set(el, node); }
          node.connect(this.bus);
          el.addEventListener('play', () => { this.ctx.resume(); this.playing = true; this.ramp(1, 0.2); this.host._audioState(); });
          el.addEventListener('pause', () => { this.playing = false; this.host._audioState(); });
          this.media = { el, node };
        }
        await this.ctx.resume();
        this.master.gain.value = 1;
        await el.play();
        this.playing = true; this.host._audioState();
        return;
      }
      await this.ctx.resume();
      await this.load();
      if (!this.passes.length) this.next = this.ctx.currentTime + 0.05;
      this.playing = true;
      this.ramp(this.vol, 2.5);
      this.schedule();
      clearInterval(this.timer); this.timer = setInterval(() => this.schedule(), 1000);
      this.host._audioState();
    }
    pause() {
      if (!this.ctx || !this.playing) return;
      if (this.media) { this.media.el.pause(); return; }
      this.playing = false; clearInterval(this.timer);
      this.ramp(0, 1.2);
      setTimeout(() => { if (!this.playing && this.ctx) this.ctx.suspend(); }, 1300);
      this.host._audioState();
    }
    stopAll() {
      clearInterval(this.timer);
      this.passes.forEach(p => { try { p.src.stop(); } catch (e) {} p.src.disconnect(); p.g.disconnect(); });
      this.passes = [];
      if (this.media) { try { this.media.node.disconnect(); } catch (e) {} this.media.el.pause(); }
      if (this.playing) { this.playing = false; this.host._audioState(); }
    }
    close() { this.stopAll(); if (this.ctx) { this.ctx.close(); this.ctx = null; } }
    ramp(v, sec) { const g = this.master.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t + sec); }
    schedule() {
      if (!this.playing || !this.buf) return;
      const now = this.ctx.currentTime;
      this.passes = this.passes.filter(p => p.end > now);
      while (this.next < now + 12) this.startPass(this.next);
    }
    startPass(at) {
      const len = this.buf.duration, cf = Math.max(0.03, Math.min(this.cf, len / 2.5)), first = !this.passes.length;
      const src = this.ctx.createBufferSource(); src.buffer = this.buf;
      const g = this.ctx.createGain(); src.connect(g).connect(this.bus);
      const N = 128, fin = new Float32Array(N), fout = new Float32Array(N);
      for (let i = 0; i < N; i++) { const x = i / (N - 1); fin[i] = Math.sin(x * Math.PI / 2); fout[i] = Math.cos(x * Math.PI / 2); }
      if (first) g.gain.setValueAtTime(1, at); else { g.gain.value = 0; g.gain.setValueCurveAtTime(fin, at, cf); }
      g.gain.setValueCurveAtTime(fout, at + len - cf, cf);
      src.start(at);
      this.passes.push({ src, g, end: at + len });
      this.next = at + len - cf;
    }
    // band energies -> slow-normalised levels (1 = the track's own running average)
    analyse(dt) {
      const live = this.ctx && this.playing && this.ctx.state === 'running';
      this.mix += ((live ? 1 : 0) - this.mix) * (1 - Math.exp(-dt * 1.5));
      if (!live) {
        this.age = 0;
        for (const k in this.levels) this.levels[k] += (1 - this.levels[k]) * (1 - Math.exp(-dt * 2));
        return this.mix;
      }
      this.an.getFloatFrequencyData(this.freq);
      const hz = this.ctx.sampleRate / 2 / this.freq.length, b = [0, 0, 0, 0];
      for (let i = 1; i < this.freq.length; i++) {
        const f = i * hz; if (f > 12000) break;
        const p = Math.pow(10, this.freq[i] / 10);
        b[0] += p; if (f < 250) b[1] += p; else if (f < 2000) b[2] += p; else b[3] += p;
      }
      this.age += dt;
      const aF = 1 - Math.exp(-dt / 0.12), rF = 1 - Math.exp(-dt / 0.5), aS = 1 - Math.exp(-dt / (this.age < 3 ? 0.6 : 7));
      const names = ['energy', 'low', 'mid', 'high'];
      for (let i = 0; i < 4; i++) {
        const v = Math.sqrt(b[i]);
        this.fast[i] += (v - this.fast[i]) * (v > this.fast[i] ? aF : rF);
        this.slow[i] = this.slow[i] ? this.slow[i] + (v - this.slow[i]) * aS : v;
        this.levels[names[i]] = clamp(this.fast[i] / Math.max(this.slow[i], 1e-9), 0.2, 3);
      }
      return this.mix;
    }
  }

  const reducedMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const STYLE = ':host{display:block;position:relative;overflow:hidden;contain:paint}:host([hidden]){display:none}canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.snd{position:absolute;right:12px;bottom:12px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(10,10,12,.38);color:#fff;display:grid;place-items:center;padding:0;cursor:pointer;pointer-events:auto;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:.78;transition:opacity .2s}'
    + '.snd:hover,.snd:focus-visible{opacity:1}.snd:focus-visible{outline:2px solid #fff;outline-offset:2px}.snd[hidden]{display:none}.snd svg{width:16px;height:16px}';
  const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>';
  const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

  class CausticLight extends HTMLElement {
    static get observedAttributes() { return ['preset', ...Object.keys(SPEC)]; }
    constructor() {
      super();
      this._attr = {}; this._js = {};
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>' + STYLE + '</style><canvas part="canvas"></canvas><button type="button" class="snd" part="audio-button" hidden aria-label="Play music">' + ICON_OFF + '</button>';
      this._canvas = root.querySelector('canvas');
      this._sndBtn = root.querySelector('.snd');
      this._sndBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleAudio(); });
      this._audio = new AudioDriver(this);
      this._onFirstGesture = () => { this._unlisten(); if (this._o && this._o.audioAutoplay && !this._audio.playing && !this._userPaused) this.playAudio(); };
      this._onVisAudio = () => {
        if (document.hidden && this._audio.playing) { this._hiddenPause = true; this._audio.pause(); }
        else if (!document.hidden && this._hiddenPause) { this._hiddenPause = false; this.playAudio(); }
      };
      this._time = 0; this._k = 0; this._frame = 0; this._last = 0; this._dirty = true;
      this._visible = true; this._level = null; this._slow = 0; this._clear = false; this._wasAnim = null;
      this._col = [1, 1, 1]; this._bg = [0, 0, 0];
      this._hv = { x: 0, y: 0, tx: 0, ty: 0, p: 0, pt: 0, v: 0, lx: null, ly: null, acc: 0 };
      this._rips = [];
      this._fx = new Set();
      this._stats = { fps: 0, rays: 0, bands: 1, quality: '' };
      this._fpsN = 0; this._fpsT = 0;
      this._tick = this._tick.bind(this);
      this._onPtr = this._onPtr.bind(this);
      this._onDown = this._onDown.bind(this);
      this._onUp = e => { if (e.pointerType === 'touch') this._hv.pt = 0; };
      this._onLeave = () => { this._hv.pt = 0; };
      this._canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this._engine = null; });
      this._canvas.addEventListener('webglcontextrestored', () => { this._start(); });
    }
    connectedCallback() {
      this._compute();
      this._start();
      if ('ResizeObserver' in window) { this._ro = new ResizeObserver(() => { this._dirty = true; }); this._ro.observe(this); }
      if ('IntersectionObserver' in window) { this._io = new IntersectionObserver(es => { this._visible = es[es.length - 1].isIntersecting; }, { rootMargin: '120px' }); this._io.observe(this); }
      window.addEventListener('pointermove', this._onPtr, { passive: true });
      window.addEventListener('pointerdown', this._onDown, { passive: true });
      window.addEventListener('pointerup', this._onUp, { passive: true });
      window.addEventListener('pointercancel', this._onUp, { passive: true });
      document.addEventListener('pointerleave', this._onLeave);
      window.addEventListener('blur', this._onLeave);
      document.addEventListener('visibilitychange', this._onVisAudio);
      this._raf = requestAnimationFrame(this._tick);
    }
    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect(); if (this._io) this._io.disconnect();
      window.removeEventListener('pointermove', this._onPtr); window.removeEventListener('pointerdown', this._onDown);
      window.removeEventListener('pointerup', this._onUp); window.removeEventListener('pointercancel', this._onUp);
      document.removeEventListener('pointerleave', this._onLeave); window.removeEventListener('blur', this._onLeave);
      document.removeEventListener('visibilitychange', this._onVisAudio);
      this._unlisten();
      this._audio.close();
      if (this._engine) { this._engine.destroy(); this._engine = null; }
    }
    attributeChangedCallback(name, _old, val) {
      if (name === 'preset') { this._dirty = true; this._compute(); return; }
      const s = SPEC[name]; if (!s) return;
      if (val === null) delete this._attr[s[0]];
      else { const v = coerce(s[0], val); if (v === undefined) delete this._attr[s[0]]; else this._attr[s[0]] = v; }
      this._compute();
    }
    _start() {
      if (!this._warned && this.isConnected) {
        requestAnimationFrame(() => {
          if (!this._warned && this.isConnected && this.clientHeight < 2) { this._warned = true; console.warn('<caustic-light> has no height. Give it a height, an aspect-ratio, or position it with inset.'); }
        });
      }
      try {
        this._engine = new Engine(this._canvas);
        this._err = null; this._dirty = true;
      } catch (e) {
        this._engine = null; this._err = e;
        this._canvas.style.background = this._bgCss();
        this.dispatchEvent(new CustomEvent('caustic-error', { detail: e }));
        if (window.console) console.warn('<caustic-light>:', e.message || e);
      }
    }
    _bgCss() { const b = parseColor(this._o ? this._o.background : DEFAULTS.background); return Array.isArray(b) ? `rgb(${b.map(v => Math.round(v * 255)).join(',')})` : 'transparent'; }
    _compute() {
      const name = (this.getAttribute('preset') || '').toLowerCase();
      const pr = PRESETS[name] || RETIRED[name] || null;
      const o = Object.assign({}, DEFAULTS);
      if (pr) for (const k in pr) if (k in DEFAULTS) o[k] = pr[k];
      Object.assign(o, this._attr, this._js);
      this._o = o;
      const c = parseColor(o.color); this._col = Array.isArray(c) ? c : [1, 1, 1];
      const g = gradientStops(o.gradient); this._grad = g ? g.map(parseColor) : null;
      this._bg = parseColor(o.background) || [0, 0, 0];
      this._fx = new Set((o.hover || '').split(' ').filter(Boolean));
      if (o.interactive) this._fx.add('lens');
      if (!this._fx.size) { this._hv.pt = 0; }
      this._audio.configure(o);
      this._sndBtn.hidden = !(o.audioControls && this._audio.active);
      if (o.audioAutoplay && this._audio.active && !this._audio.playing && !this._gestureWait && this.isConnected) {
        this._gestureWait = true;
        ['pointerdown', 'keydown', 'touchend'].forEach(t => window.addEventListener(t, this._onFirstGesture, { capture: true }));
      }
      const clear = this._bg === 'transparent';
      if (clear !== this._clear) { this._clear = clear; this.style.mixBlendMode = clear ? 'screen' : ''; }
      this._canvas.style.background = this._bgCss();
      this._dirty = true;
    }
    setOptions(opts) {
      for (const k in (opts || {})) {
        if (k === 'preset') { if (opts[k]) this.setAttribute('preset', opts[k]); else this.removeAttribute('preset'); continue; }
        const v = coerce(k, opts[k]);
        if (v === undefined) delete this._js[k]; else this._js[k] = v;
      }
      this._compute();
      return this;
    }
    clearOptions() { this._js = {}; this._compute(); return this; }
    get options() { return Object.assign({ preset: this.getAttribute('preset') || null }, this._o); }
    get stats() { return Object.assign({}, this._stats); }
    get preset() { return this.getAttribute('preset'); }
    set preset(v) { if (v) this.setAttribute('preset', v); else this.removeAttribute('preset'); }
    pause() { return this.setOptions({ paused: true }); }
    play() { return this.setOptions({ paused: false }); }
    refresh() { this._dirty = true; }
    playAudio() {
      this._userPaused = false;
      return this._audio.play().catch(e => {
        this.dispatchEvent(new CustomEvent('caustic-error', { detail: e }));
        console.warn('<caustic-light>:', e.message || e);
      });
    }
    pauseAudio() { this._userPaused = true; this._audio.pause(); }
    toggleAudio() { return this._audio.playing ? this.pauseAudio() : this.playAudio(); }
    get audioPlaying() { return this._audio.playing; }
    get audioLevels() { return Object.assign({}, this._audio.levels); }
    _unlisten() {
      if (!this._gestureWait) return;
      this._gestureWait = false;
      ['pointerdown', 'keydown', 'touchend'].forEach(t => window.removeEventListener(t, this._onFirstGesture, { capture: true }));
    }
    _audioState() {
      const on = this._audio.playing;
      this._sndBtn.innerHTML = on ? ICON_ON : ICON_OFF;
      this._sndBtn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
      this.dispatchEvent(new CustomEvent(on ? 'audio-play' : 'audio-pause'));
    }
    ripple(x = 0, y = 0, amount = 1) {
      const r = this.getBoundingClientRect(); const asp = r.height > 1 ? r.width / r.height : 1;
      this._addRipple(clamp(x, -1.5, 1.5) * asp, clamp(y, -1.5, 1.5), clamp(amount, 0, 3));
      return this;
    }
    _addRipple(x, y, amp) {
      if (this._rips.length >= 8) this._rips.shift();
      this._rips.push({ x, y, age: 0, amp });
    }
    _local(e) {
      const r = this.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
      const x = (e.clientX - r.left) / r.width * 2 - 1, y = 1 - (e.clientY - r.top) / r.height * 2;
      return { x: x * r.width / r.height, y, inside: x >= -1 && x <= 1 && y >= -1 && y <= 1 };
    }
    _ripplesOn() { return this._fx.has('ripple') && !(this._o.motion !== 'always' && reducedMQ.matches); }
    _onPtr(e) {
      if (!this._o || !this._fx.size) return;
      const l = this._local(e); if (!l) return;
      const h = this._hv;
      h.tx = l.x; h.ty = l.y; h.pt = l.inside ? 1 : 0;
      if (l.inside && this._ripplesOn()) {
        if (h.lx !== null) h.acc += Math.hypot(l.x - h.lx, l.y - h.ly);
        if (h.acc > 0.09 || h.lx === null) { this._addRipple(l.x, l.y, 0.45 * this._o.hoverStrength); h.acc = 0; }
        h.lx = l.x; h.ly = l.y;
      } else { h.lx = null; h.ly = null; }
    }
    _onDown(e) {
      if (!this._o || !this._fx.size) return;
      const l = this._local(e); if (!l || !l.inside) return;
      const h = this._hv; h.tx = l.x; h.ty = l.y; h.pt = 1;
      if (h.p < 0.05) { h.x = l.x; h.y = l.y; }
      if (this._ripplesOn()) this._addRipple(l.x, l.y, 1.4 * this._o.hoverStrength);
    }
    _hoverState(dt, o) {
      const h = this._hv, fx = this._fx;
      let live = false;
      if (fx.size || h.p > 1e-3) {
        const a = 1 - Math.exp(-dt * 10), bx = h.x, by = h.y, bp = h.p;
        if (h.p < 1e-3 && h.pt > 0) { h.x = h.tx; h.y = h.ty; }
        h.x += (h.tx - h.x) * a; h.y += (h.ty - h.y) * a;
        h.p += ((fx.size ? h.pt : 0) - h.p) * (1 - Math.exp(-dt * 4));
        if (h.p < 1e-3 && h.pt === 0) h.p = 0;
        const sp = dt > 0 ? Math.hypot(h.x - bx, h.y - by) / dt : 0;
        h.v += (sp - h.v) * (1 - Math.exp(-dt * 6));
        live = Math.abs(h.x - bx) + Math.abs(h.y - by) > 2e-4 || Math.abs(h.p - bp) > 1e-3 || (fx.has('swirl') && h.p > 0 && h.v > 0.02);
      }
      for (const r of this._rips) r.age += dt;
      this._rips = this._rips.filter(r => r.age < 3.2);
      if (!this._ripplesOn() && this._rips.length) this._rips = [];
      if (this._rips.length) live = true;
      const k = o.hoverStrength * h.p;
      const on = f => fx.has(f) ? k : 0;
      const rip = new Float32Array(32);
      this._rips.forEach((r, i) => rip.set([r.x, r.y, r.age, r.amp], i * 4));
      const cw = this.clientWidth || 1, chh = this.clientHeight || 1;
      const tiltK = on('tilt') * 0.07;
      return {
        live,
        pos: [h.x, h.y, o.hoverRadius, 0],
        a: [on('lens') * (o.relief * 2 + 0.3), on('calm') * 0.85, on('swirl') * (0.6 + Math.min(1.4, h.v * 0.9)), on('glow') * 0.9],
        b: [on('focus') * 0.6, tiltK * h.x / (cw / chh), tiltK * h.y, this._rips.length ? 1 : 0],
        rip, ripN: this._rips.length
      };
    }
    _tick(now) {
      this._raf = requestAnimationFrame(this._tick);
      const o = this._o;
      if (!this._engine || !o || !this._visible || document.hidden) { this._last = now; return; }
      const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0; this._last = now;
      // quality
      if (o.quality !== 'auto') this._level = o.quality;
      else if (!this._level) this._level = (Math.min(screen.width, screen.height) < 700 || /Mobi|Android/i.test(navigator.userAgent)) ? 'low' : 'medium';
      const still = o.paused || (o.motion !== 'always' && reducedMQ.matches) || o.speed <= 0;
      // music: follow the track's dynamics
      const amix = this._audio.analyse(dt);
      const react = (o.motion !== 'always' && reducedMQ.matches) ? 0 : o.audioReact * amix;
      let ro = o, spd = 1;
      if (react > 0.001) {
        const L = this._audio.levels, dE = L.energy - 1, dL = L.low - 1, dH = L.high - 1;
        ro = Object.assign({}, o, {
          intensity: o.intensity * Math.max(0.2, 1 + 0.45 * react * Math.min(1.5, dE)),
          relief: o.relief * Math.max(0.3, 1 + 0.3 * react * dL),
          glow: o.glow * (1 + 0.8 * react * Math.min(1, Math.max(0, dH)))
        });
        spd = Math.max(0.3, 1 + 0.8 * react * dE);
      }
      if (!still) this._time += dt * o.speed * spd;
      // hover effects
      const hov = this._hoverState(dt, o);
      const animating = !still || hov.live || react > 0.001;
      if (this._dirty || animating !== this._wasAnim) { this._k = 0; this._dirty = false; }
      this._wasAnim = animating;
      if (!animating && this._k >= 48) return;
      const st = { time: this._time, k: this._k, frame: this._frame++, animating, level: this._level, col: this._col, bg: this._bg, grad: this._grad, hov };
      let info = null;
      try { info = this._engine.render(ro, st); } catch (e) { console.warn('<caustic-light>:', e); this._engine = null; return; }
      this._k++;
      // stats + auto quality
      if (info) { this._stats.rays = info.rays; this._stats.bands = info.bands; }
      this._stats.quality = this._level;
      this._fpsN++;
      if (!this._fpsT) this._fpsT = now;
      if (now - this._fpsT > 700) {
        this._stats.fps = Math.round(this._fpsN * 1000 / (now - this._fpsT)); this._fpsN = 0; this._fpsT = now;
        if (o.quality === 'auto' && animating) {
          if (this._stats.fps < 38) this._slow++; else this._slow = 0;
          const li = LEVELS.indexOf(this._level);
          if (this._slow >= 3 && li > 0) { this._level = LEVELS[li - 1]; this._slow = 0; this._dirty = true; }
        }
      }
    }
  }
  CausticLight.presets = PRESETS;
  CausticLight.defaults = DEFAULTS;
  CausticLight.attributes = Object.assign({}, KEY2ATTR);
  CausticLight.version = '1.1.0';
  customElements.define('caustic-light', CausticLight);
  window.CausticLight = CausticLight;
})();
