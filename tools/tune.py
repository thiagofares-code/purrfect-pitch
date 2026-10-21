"""Build the tuned meow library: PSOLA-correct each chosen meow onto every note in its range, then verify.
usage: python -I tune.py <wav dir> <out wav dir> <report json>"""
import json, sys, pathlib
import numpy as np
import parselmouth
from parselmouth.praat import call

KEEP = 0.15       # share of the cat's own pitch movement kept, so it still sounds alive
TARGET_RMS = 0.1  # every voice at the same loudness
SHORT = 0.32      # seconds: length of the quick "mew" used for short notes
VOICES = [  # name, source wav, meow start/len (s, from the grader), natural pitch (MIDI), notes to render, shape
    # shape = semitones of the cat's own "m-ee-ow" pitch curve to keep, with the held middle locked onto the note
    # (None = flatten to the note, as before). Flattening a strongly shaped meow turns it into a robotic "meh".
    # pink, yellow and purple voices were picked by ear on audition.html; they keep their whole natural curve (99)
    ('tom',     'alex_jauk-cat-meow-noise-438008.wav',          0.13, 0.62, 68.3, range(62, 75), 99),  # "Grumpy"
    ('ribs',    'dragon-studio-kitten-sfx-405457.wav',          0.03, 0.78, 76.0, range(68, 85), 99),  # "Kitten B"
    ('mitten',  'sound_garage-cat-meow-10-fx-306188.wav',       0.09, 1.36, 74.5, range(67, 84), None),
    ('soloist', 'dragon-studio-cartoon-kitten-meow-487668.wav', 0.05, 1.59, 80.1, range(72, 92), 99),  # "Cartoon kitten"
    ('kitty',   'freesound_community-kitty-meow-85182.wav',     0.04, 0.43, 78.5, range(70, 92), None),
]
st = lambda f: 12 * np.log2(f / 440.0) + 69
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

src_dir, out_dir, report_path = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
out_dir.mkdir(parents=True, exist_ok=True)
report = []
for name, wav, start, dur, natural, notes, shape in VOICES:
    snd = parselmouth.Sound(str(src_dir / wav))
    seg = snd.extract_part(from_time=max(0, start - 0.02), to_time=min(snd.xmax, start + dur + 0.06), preserve_times=False)
    v = seg.values[0]; seg.values[0] = v * (TARGET_RMS / max(np.sqrt(np.mean(v ** 2)), 1e-6))
    manip = call(seg, 'To Manipulation', 0.01, 150, 1600)
    tier = call(manip, 'Extract pitch tier')
    pts = [(call(tier, 'Get time from index', i), call(tier, 'Get value at index', i)) for i in range(1, call(tier, 'Get number of points') + 1)]
    semis = np.array([st(f) for _, f in pts]); med = float(np.median(semis))
    glide = float(np.percentile(semis, 90) - np.percentile(semis, 10))
    if shape:  # lock the held middle (40-60% of the meow) onto the note; keep the scoop and the "ow" around it
        times = np.array([t for t, _ in pts]); mid_mask = (times > seg.duration*0.4) & (times < seg.duration*0.6)
        med = float(np.median(semis[mid_mask])) if mid_mask.any() else med
    # every note twice: the full meow, and a short "mew" (the whole meow squeezed to SHORT s, same pitch) for quick notes
    def render(m, suffix, offset=0.0):
        # shaped voices: short mews keep half the curve and get a little longer, so they still have a held middle
        sh = shape / 2 if (shape and suffix) else shape
        keep = min(1, sh / max(glide, 1e-6)) if shape else KEEP * min(1, 2.0 / max(glide, 1e-6))
        new = call('Create PitchTier', 'target', 0, seg.duration)
        for t, f in pts: call(new, 'Add point', t, hz(m + offset + keep * (st(f) - med)))
        call([new, manip], 'Replace pitch tier')
        dt = call('Create DurationTier', 'speed', 0, seg.duration)
        call(dt, 'Add point', 0, ((SHORT + 0.08) if shape else SHORT) / seg.duration if suffix else 1.0)
        call([dt, manip], 'Replace duration tier')
        out = call(manip, 'Get resynthesis (overlap-add)')
        y = out.values[0]; peak = np.max(np.abs(y))
        if peak > 0.95: out.values[0] = y * (0.95 / peak)
        # fade the edges so samples start and stop without clicks
        n = len(out.values[0]); f = int(0.008 * out.sampling_frequency)
        ramp = np.linspace(0, 1, f); out.values[0][:f] *= ramp; out.values[0][n - f:] *= ramp[::-1]
        # verify: pitch of the steady middle of the result vs the target note
        p = out.to_pitch_ac(time_step=0.01, pitch_floor=150, pitch_ceiling=2000).selected_array['frequency']; p = p[p > 0]
        lo, hi = (0.4, 0.6) if shape else (0.2, 0.8)  # shaped meows are judged on their held middle
        mid = p[int(len(p) * lo): max(int(len(p) * hi), int(len(p) * lo) + 1)]
        cents = 1200 * np.log2(mid / hz(m))
        return out, float(np.median(cents)), float(np.std(cents))
    for m, suffix in [(m, s) for m in notes for s in ('', '_s')]:
        out, err, spread = render(m, suffix); offset = 0.0
        for _ in range(3):  # correction passes: shift by the measured error until the held middle sits on the note
            if not (shape and 3 < abs(err) < 150): break
            offset -= err/100; out, err, spread = render(m, suffix, offset)
        out.save(str(out_dir / f'{name}_{m}{suffix}.wav'), 'WAV')
        report.append(dict(voice=name + suffix, midi=m, dur=round(out.duration, 3), shift=round(m - natural, 1),
                           err_cents=round(err, 1), spread_cents=round(spread, 1)))
report_path.write_text(json.dumps(report, indent=1))
errs = np.array([abs(r['err_cents']) for r in report]); spreads = np.array([r['spread_cents'] for r in report])
print(f'{len(report)} samples | |error| median {np.median(errs):.1f} c, worst {errs.max():.1f} c | spread median {np.median(spreads):.1f} c, worst {spreads.max():.1f} c')
for r in sorted(report, key=lambda r: -abs(r['err_cents']))[:8]: print('  worst:', r)
