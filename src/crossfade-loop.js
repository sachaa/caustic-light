/*!
 * crossfade-loop.js · endless background music from any audio file · v1.0.0
 * Part of caustic-light · MIT License · (c) 2026 Sacha
 *
 * Plays a track over and over, starting each pass a few seconds before the
 * previous one ends and blending the two with an equal-power crossfade, so the
 * music never stops or restarts audibly. Works with the untouched track (it can
 * skip a fade-in at the start and a fade-out at the end) or with a pre-made
 * seamless loop (use crossfade: 0.05 there). Web Audio, no dependencies.
 *
 *   <script src="crossfade-loop.js"></script>
 *   <script>
 *     const music = new CrossfadeLoop('music/ambient-loop.mp3', { volume: 0.5 });
 *     soundButton.addEventListener('click', () => music.toggle());
 *   </script>
 *
 * Options
 *   crossfade        seconds the end of one pass overlaps the start of the next (default 8)
 *   trimStart        seconds to skip at the start of the file, e.g. a fade-in (default 0)
 *   trimEnd          seconds to drop at the end of the file, e.g. a fade-out or reverb tail (default 0)
 *   volume           0–1 (default 0.6)
 *   fadeIn           seconds to fade in when playback starts or resumes (default 3)
 *   fadeOut          seconds to fade out on pause or stop (default 1.5)
 *   pauseWhenHidden  pause while the tab is in the background (default true)
 *
 * Methods: play(), pause(), toggle(), stop(), setVolume(v, seconds), load()
 * Properties: playing (boolean), duration (seconds of one pass), ready (Promise)
 * Browsers only start audio after a user gesture, so call play() from a click or key press.
 */
(function (root) {
  'use strict';

  class CrossfadeLoop {
    constructor(src, options = {}) {
      this.src = src;
      this.o = Object.assign({ crossfade: 8, trimStart: 0, trimEnd: 0, volume: 0.6, fadeIn: 3, fadeOut: 1.5, pauseWhenHidden: true }, options);
      this.playing = false;
      this._passes = [];
      this._next = 0;          // context time the next pass starts
      this._timer = null;
      this._hiddenPause = false;
      this._onVis = () => {
        if (!this.o.pauseWhenHidden) return;
        if (document.hidden && this.playing) { this._hiddenPause = true; this.pause(); }
        else if (!document.hidden && this._hiddenPause) { this._hiddenPause = false; this.play(); }
      };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._onVis);
    }

    get duration() { return this._buf ? Math.max(0, this._buf.duration - this.o.trimStart - this.o.trimEnd) : 0; }

    load() {
      if (this.ready) return this.ready;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return (this.ready = Promise.reject(new Error('Web Audio is not supported in this browser')));
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.ready = fetch(this.src)
        .then(r => { if (!r.ok) throw new Error(`Could not load ${this.src} (${r.status})`); return r.arrayBuffer(); })
        .then(data => new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej)))
        .then(buf => {
          this._buf = buf;
          const len = this.duration;
          // a pass must fit two crossfades
          this.o.crossfade = Math.max(0.01, Math.min(this.o.crossfade, len / 2.5));
          return this;
        });
      return this.ready;
    }

    async play() {
      await this.load();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const now = this.ctx.currentTime;
      if (!this._passes.length) this._next = now + 0.05;
      this.playing = true;
      this._ramp(this.o.volume, this.o.fadeIn);
      this._schedule();
      clearInterval(this._timer);
      this._timer = setInterval(() => this._schedule(), 1000);
      return this;
    }

    pause() {
      if (!this.ctx || !this.playing) return Promise.resolve(this);
      this.playing = false;
      clearInterval(this._timer);
      this._ramp(0, this.o.fadeOut);
      const ctx = this.ctx;
      return new Promise(res => setTimeout(() => { if (!this.playing) ctx.suspend(); res(this); }, this.o.fadeOut * 1000 + 50));
    }

    toggle() { return this.playing ? this.pause() : this.play(); }

    stop() {
      if (!this.ctx) return Promise.resolve(this);
      this.playing = false;
      clearInterval(this._timer);
      this._ramp(0, this.o.fadeOut);
      return new Promise(res => setTimeout(() => {
        if (this.playing) return res(this);
        this._passes.forEach(p => { try { p.src.stop(); } catch (e) {} p.src.disconnect(); p.gain.disconnect(); });
        this._passes = [];
        res(this);
      }, this.o.fadeOut * 1000 + 50));
    }

    setVolume(v, seconds = 0.5) {
      this.o.volume = Math.max(0, Math.min(1, v));
      if (this.ctx && this.playing) this._ramp(this.o.volume, seconds);
    }

    destroy() {
      this.stop();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._onVis);
      setTimeout(() => this.ctx && this.ctx.close(), this.o.fadeOut * 1000 + 100);
    }

    _ramp(target, seconds) {
      const g = this.master.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(target, t + Math.max(0.01, seconds));
    }

    // keep the next two passes booked on the audio clock
    _schedule() {
      if (!this.playing || !this._buf) return;
      const now = this.ctx.currentTime;
      this._passes = this._passes.filter(p => p.end > now);
      while (this._next < now + 12) this._startPass(this._next);
    }

    _startPass(at) {
      const cf = this.o.crossfade, len = this.duration, first = !this._passes.length;
      const src = this.ctx.createBufferSource();
      src.buffer = this._buf;
      const gain = this.ctx.createGain();
      src.connect(gain).connect(this.master);
      const N = 128, fin = new Float32Array(N), fout = new Float32Array(N);
      for (let i = 0; i < N; i++) { const x = i / (N - 1); fin[i] = Math.sin(x * Math.PI / 2); fout[i] = Math.cos(x * Math.PI / 2); }
      if (first) gain.gain.setValueAtTime(1, at);
      else { gain.gain.value = 0; gain.gain.setValueCurveAtTime(fin, at, cf); }
      gain.gain.setValueCurveAtTime(fout, at + len - cf, cf);
      src.start(at, this.o.trimStart, len);
      this._passes.push({ src, gain, end: at + len });
      this._next = at + len - cf;
    }
  }

  root.CrossfadeLoop = CrossfadeLoop;
  if (typeof module !== 'undefined' && module.exports) module.exports = CrossfadeLoop;
})(typeof window !== 'undefined' ? window : globalThis);
