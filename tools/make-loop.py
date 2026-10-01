#!/usr/bin/env python3
"""
make-loop.py: turn a music track into a seamless loop for caustic-light.

It skips the quiet intro and the fade-out, finds a tail that matches the head
in loudness and tone, blends the tail into the head with an equal-power
crossfade, normalises loudness (EBU R128) and writes WAV, MP3, M4A and OGG
copies plus a short "seam check" clip that plays across the loop point.

Requirements: Python 3.8+, numpy, and ffmpeg (with libmp3lame and libopus) on PATH.

Usage:
    python3 tools/make-loop.py track.mp3 [more.mp3 ...] --out loops/
    python3 tools/make-loop.py track.mp3 --crossfade 8 --lufs -20 --formats mp3,ogg

Use the result with a short crossfade, since the seam is already baked in:
    <caustic-light audio="loops/track-loop.mp3" audio-crossfade="0.5"></caustic-light>
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

SR = 48000


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def envelope_db(x, hop=0.25, win=1.0):
    mono = x.mean(axis=1)
    h, w = int(hop * SR), int(win * SR)
    n = max(1, (len(mono) - w) // h)
    env = np.array([np.sqrt(np.mean(mono[i * h:i * h + w] ** 2) + 1e-12) for i in range(n)])
    return 20 * np.log10(env + 1e-9), h, w


def rms_db(seg):
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)


def spectrum(x, a, b, nfft=8192):
    """Average log spectrum in 48 log-spaced bands, 80 Hz to 12 kHz."""
    seg = x[a:b].mean(axis=1)
    win = np.hanning(nfft)
    frames = [seg[i:i + nfft] * win for i in range(0, len(seg) - nfft, nfft // 2)]
    mag = np.mean([np.abs(np.fft.rfft(f)) for f in frames], axis=0)
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    idx = np.unique(np.searchsorted(freqs, np.geomspace(80, 12000, 49)))
    bands = np.array([mag[idx[i]:max(idx[i + 1], idx[i] + 1)].mean() for i in range(len(idx) - 1)])
    v = np.log10(bands + 1e-9)
    return v - v.mean()


def make_loop(path, outdir, crossfade=10.0, lufs=-18.0, formats=('wav', 'mp3', 'm4a', 'ogg'), seam_check=True):
    name = os.path.splitext(os.path.basename(path))[0]
    x = decode(path)
    env, hop, win = envelope_db(x)
    n = len(env)
    ref = float(np.median(env[int(n * 0.2):int(n * 0.8)]))
    steady = np.where(env >= ref - 4.0)[0]
    to_sample = lambda i: int((i * hop + win / 2))
    start = to_sample(steady[0])
    end_max = to_sample(steady[-1])
    C = int(crossfade * SR)
    if end_max - start < 5 * C:
        raise SystemExit(f'{path}: the steady part is too short for a {crossfade:.0f} s crossfade')

    head = spectrum(x, start, start + C)
    head_db = rms_db(x[start:start + C])
    best = None
    # search the last steady 25 s for the tail that sounds most like the head
    for end in range(end_max, max(end_max - 25 * SR, start + 4 * C), -SR // 4):
        tail = spectrum(x, end - C, end)
        score = np.sqrt(np.mean((tail - head) ** 2)) + 0.05 * abs(rms_db(x[end - C:end]) - head_db)
        if best is None or score < best[0]:
            best = (score, end)
    score, end = best

    k = np.linspace(0, 1, C, dtype=np.float32)[:, None]
    seam = x[end - C:end] * np.cos(k * np.pi / 2) + x[start:start + C] * np.sin(k * np.pi / 2)
    loop = np.concatenate([x[start + C:end - C], seam]).astype(np.float32)
    jump = rms_db(loop[-SR:]) - rms_db(loop[:SR])

    os.makedirs(outdir, exist_ok=True)
    base = os.path.join(outdir, f'{name}-loop')
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, 'loop.f32')
        loop.tofile(raw)
        src = ['-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw]
        meas = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *src, '-af',
                               f'loudnorm=I={lufs}:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                              capture_output=True, text=True).stderr
        m = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
        norm = (f"loudnorm=I={lufs}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
                f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
                f"aresample={SR}")
        codecs = {
            'wav': ['-c:a', 'pcm_s16le'],
            'mp3': ['-c:a', 'libmp3lame', '-q:a', '2'],
            'm4a': ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
            'ogg': ['-c:a', 'libopus', '-b:a', '128k'],
        }
        wav = os.path.join(tmp, 'loop.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *src, '-af', norm, '-c:a', 'pcm_s16le', wav], check=True)
        for fmt in formats:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, *codecs[fmt], f'{base}.{fmt}'], check=True)
        if seam_check:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-stream_loop', '1', '-i', wav,
                            '-ss', f'{len(loop) / SR - 20:.3f}', '-t', '40', '-c:a', 'libmp3lame', '-q:a', '3',
                            f'{base}-seam-check.mp3'], check=True)

    return {
        'file': os.path.basename(path),
        'loop_seconds': round(len(loop) / SR, 2),
        'trimmed_start_s': round(start / SR, 2),
        'loop_end_s': round(end / SR, 2),
        'crossfade_s': crossfade,
        'level_jump_at_seam_db': round(float(jump), 2),
        'tone_mismatch': round(float(score), 3),
        'input_lufs': m['input_i'],
        'output_lufs': lufs,
    }


def main():
    ap = argparse.ArgumentParser(description='Turn music tracks into seamless loops.')
    ap.add_argument('tracks', nargs='+', help='audio files to convert')
    ap.add_argument('--out', default='loops', help='output folder (default: loops)')
    ap.add_argument('--crossfade', type=float, default=10.0, help='seconds of crossfade at the seam (default 10)')
    ap.add_argument('--lufs', type=float, default=-18.0, help='target loudness in LUFS (default -18)')
    ap.add_argument('--formats', default='wav,mp3,m4a,ogg', help='comma-separated: wav,mp3,m4a,ogg')
    ap.add_argument('--no-seam-check', action='store_true', help='skip the 40 s clip across the loop point')
    a = ap.parse_args()
    formats = [f.strip() for f in a.formats.split(',') if f.strip()]
    bad = [f for f in formats if f not in ('wav', 'mp3', 'm4a', 'ogg')]
    if bad:
        ap.error(f'unknown format(s): {", ".join(bad)}')
    for t in a.tracks:
        info = make_loop(t, a.out, a.crossfade, a.lufs, formats, not a.no_seam_check)
        print(json.dumps(info), flush=True)


if __name__ == '__main__':
    sys.exit(main())
