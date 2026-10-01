// Type definitions for caustic-light 1.1
// Project: https://www.npmjs.com/package/caustic-light
// License: MIT

/** Built-in looks. */
export type CausticPreset = 'laser' | 'blown-glass' | 'pool' | 'prism' | 'hammered';

/** Shape of the bumpy optic the light passes through. */
export type CausticSurface = 'flow' | 'ripple' | 'hammered' | 'lens';

/** Optional pointer effects; combine several in a space-separated string. */
export type CausticHoverEffect = 'ripple' | 'lens' | 'calm' | 'swirl' | 'focus' | 'tilt' | 'glow';

/** Any CSS colour string, or linear 0–1 RGB. */
export type CausticColor = string | [number, number, number];

/**
 * Every option, keyed as in JavaScript (`beamX`). The matching HTML attribute is
 * the kebab-case form (`beam-x`); see `CausticLight.attributes`.
 */
export interface CausticLightOptions {
  /** `flow` (default), `ripple`, `hammered` or `lens`. */
  surface: CausticSurface;
  /** `reflect` for a mirror, `refract` for glass or water. */
  mode: 'reflect' | 'refract';
  /** 0–6. Throw from optic to wall; longer is sharper and more folded. */
  distance: number;
  /** 0–1.5. Surface slope: how strongly rays bend. */
  relief: number;
  /** 0.2–20. Bump density. */
  scale: number;
  /** 1–6. Octaves of finer bumps. */
  detail: number;
  /** 0–1. Weight of each finer octave. */
  roughness: number;
  /** 0–2. Domain warp; turns regular waves into organic ribbons. */
  warp: number;
  /** 0–3. Animation speed; 0 holds still and refines the image. */
  speed: number;
  /** Any number; picks a different surface. */
  seed: number;
  /** Colour of the light. */
  color: CausticColor;
  /** Wall colour, or `'transparent'` to draw light only (blends with `screen`). */
  background: CausticColor | 'transparent';
  /** Two CSS colours ("#1d4ed8 #e0f7ff"): faint light → bright folds. `''` = off. */
  gradient: string;
  /** 0.05–0.95. Where the first gradient colour hands over to the second. */
  gradientMid: number;
  /** 0–20. Light power. */
  intensity: number;
  /** 0.3–4. Above 1 darkens the veil and lifts the bright lines. */
  contrast: number;
  /** 1–2.5. Refractive index in refract mode. */
  ior: number;
  /** 0–1. Splits colours along the folds. */
  dispersion: number;
  /** 0–3. 0 floods the element; above 0 is a round beam's radius in half heights. */
  beam: number;
  /** -1–1. Beam centre, horizontal. */
  beamX: number;
  /** -1–1. Beam centre, vertical (up is positive). */
  beamY: number;
  /** 0–6. Beam divergence; fans the pattern out from the centre. */
  spread: number;
  /** 0–6. Blur in CSS pixels. */
  softness: number;
  /** 0–3. Haze around bright lines. */
  glow: number;
  /** 0–0.95. Temporal smoothing while animating. */
  trail: number;
  /** 0–0.2. Film grain. */
  grain: number;
  /** Render quality; `auto` steps down when frames are slow. */
  quality: 'auto' | 'low' | 'medium' | 'high';
  /** Space-separated hover effects, or `''` for none. */
  hover: string;
  /** 0–3. Scales every hover effect. */
  hoverStrength: number;
  /** 0.05–1.5. Size of the hover area in half element heights. */
  hoverRadius: number;
  /** Shorthand for `hover: 'lens'`. */
  interactive: boolean;
  /** URL of a music file that loops forever with a crossfade. */
  audio: string;
  /** CSS selector of an existing `<audio>` or `<video>` to follow instead. */
  audioElement: string;
  /** 0–2. How strongly the music moves the light; 0 = off. */
  audioReact: number;
  /** 0–1. Playback volume. */
  audioVolume: number;
  /** 0–20. Seconds of overlap at the loop point. */
  audioCrossfade: number;
  /** Show a small play / pause button in the corner. */
  audioControls: boolean;
  /** Start the music on the visitor's first click, tap or key press. */
  audioAutoplay: boolean;
  /** Freeze the animation. */
  paused: boolean;
  /** `auto` holds still under `prefers-reduced-motion`; `always` ignores it. */
  motion: 'auto' | 'always';
}

/** Options accepted by `setOptions`, plus `preset`. */
export type CausticLightInput = Partial<CausticLightOptions> & { preset?: CausticPreset | null };

export interface CausticLightPreset extends Partial<CausticLightOptions> {
  label: string;
  note: string;
}

export interface CausticLightStats {
  fps: number;
  /** Rays traced per frame (grid size × spectral samples). */
  rays: number;
  /** Spectral samples per frame. */
  bands: number;
  /** Quality level in use. */
  quality: string;
}

/** Music levels relative to the track's own running average (1 = average). */
export interface CausticAudioLevels {
  energy: number;
  low: number;
  mid: number;
  high: number;
}

export interface CausticLightEventMap extends HTMLElementEventMap {
  'audio-play': CustomEvent<void>;
  'audio-pause': CustomEvent<void>;
  /** WebGL 2 unavailable, or the music could not load or play. */
  'caustic-error': CustomEvent<Error>;
}

export declare class CausticLight extends HTMLElement {
  /** Built-in presets. */
  static readonly presets: Record<CausticPreset, CausticLightPreset>;
  /** Default value of every option. */
  static readonly defaults: CausticLightOptions;
  /** Option key → HTML attribute name, e.g. `beamX` → `beam-x`. */
  static readonly attributes: Record<keyof CausticLightOptions, string>;
  static readonly version: string;

  /** Current preset name, reflected to the `preset` attribute. */
  preset: string | null;
  /** Effective options: defaults ← preset ← attributes ← `setOptions`. */
  readonly options: CausticLightOptions & { preset: string | null };
  readonly stats: CausticLightStats;
  readonly audioPlaying: boolean;
  readonly audioLevels: CausticAudioLevels;

  /** Merge options. They override the preset and attributes. Invalid values are ignored. */
  setOptions(options: CausticLightInput): this;
  /** Drop every option set through `setOptions`. */
  clearOptions(): this;
  pause(): this;
  play(): this;
  /** Restart the progressive refinement of a still image. */
  refresh(): void;
  /** Drop a ripple at element coordinates (-1..1, y up). */
  ripple(x?: number, y?: number, amount?: number): this;
  /** Start the music. Browsers require a user gesture first. */
  playAudio(): Promise<void>;
  pauseAudio(): void;
  toggleAudio(): Promise<void> | void;

  addEventListener<K extends keyof CausticLightEventMap>(type: K, listener: (this: CausticLight, ev: CausticLightEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof CausticLightEventMap>(type: K, listener: (this: CausticLight, ev: CausticLightEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

export interface CrossfadeLoopOptions {
  /** Seconds the end of one pass overlaps the start of the next (default 8). */
  crossfade?: number;
  /** Seconds to skip at the start of the file (default 0). */
  trimStart?: number;
  /** Seconds to drop at the end of the file (default 0). */
  trimEnd?: number;
  /** 0–1 (default 0.6). */
  volume?: number;
  /** Seconds to fade in on play (default 3). */
  fadeIn?: number;
  /** Seconds to fade out on pause or stop (default 1.5). */
  fadeOut?: number;
  /** Pause while the tab is hidden (default true). */
  pauseWhenHidden?: boolean;
}

/** Standalone endless music player from `caustic-light/crossfade-loop`. */
export declare class CrossfadeLoop {
  constructor(src: string, options?: CrossfadeLoopOptions);
  readonly playing: boolean;
  /** Seconds of one pass after trimming. */
  readonly duration: number;
  ready?: Promise<CrossfadeLoop>;
  load(): Promise<CrossfadeLoop>;
  play(): Promise<CrossfadeLoop>;
  pause(): Promise<CrossfadeLoop>;
  toggle(): Promise<CrossfadeLoop>;
  stop(): Promise<CrossfadeLoop>;
  setVolume(volume: number, seconds?: number): void;
  destroy(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'caustic-light': CausticLight;
  }
  interface Window {
    CausticLight: typeof CausticLight;
    CrossfadeLoop: typeof CrossfadeLoop;
  }
}
