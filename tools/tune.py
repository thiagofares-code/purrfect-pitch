"""Build the tuned meow library: PSOLA-correct each chosen meow onto every note in its range, then verify.
usage: python -I tune.py <wav dir> <out wav dir> <report json>"""
import json, sys, pathlib
import numpy as np
import parselmouth
from parselmouth.praat import call

KEEP = 0.15       # share of the cat's own pitch movement kept, so it still sounds alive
TARGET_RMS = 0.1  # every voice at the same loudness
SHORT = 0.32      # seconds: length of the quick "mew" used for short notes
VOICES = [  # name, source wav, meow start/len (s, from the grader), natural pitch (MIDI), notes to render
    ('tom',     'soundreality-cat-meow-fx-461188.wav',          0.04, 1.08, 65.7, range(62, 75)),
    ('ribs',    'ribhavagrawal-cat-meowing-type-01-293291.wav', 0.10, 0.86, 72.7, range(65, 82)),
    ('mitten',  'sound_garage-cat-meow-10-fx-306188.wav',       0.09, 1.36, 74.5, range(67, 84)),
    ('soloist', 'dragon-studio-kitten-sfx-405457.wav',          1.65, 0.72, 75.3, range(67, 84)),
    ('kitty',   'freesound_community-kitty-meow-85182.wav',     0.04, 0.43, 78.5, range(70, 92)),
]
st = lambda f: 12 * np.log2(f / 440.0) + 69
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

src_dir, out_dir, report_path = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
out_dir.mkdir(parents=True, exist_ok=True)
report = []
for name, wav, start, dur, natural, notes in VOICES:
    snd = parselmouth.Sound(str(src_dir / wav))
    seg = snd.extract_part(from_time=max(0, start - 0.02), to_time=min(snd.xmax, start + dur + 0.06), preserve_times=False)
    v = seg.values[0]; seg.values[0] = v * (TARGET_RMS / max(np.sqrt(np.mean(v ** 2)), 1e-6))
    manip = call(seg, 'To Manipulation', 0.01, 150, 1600)
    tier = call(manip, 'Extract pitch tier')
    pts = [(call(tier, 'Get time from index', i), call(tier, 'Get value at index', i)) for i in range(1, call(tier, 'Get number of points') + 1)]
    semis = np.array([st(f) for _, f in pts]); med = float(np.median(semis))
    glide = float(np.percentile(semis, 90) - np.percentile(semis, 10))
    # every note twice: the full meow, and a short "mew" (the whole meow squeezed to SHORT s, same pitch) for quick notes
    for m, suffix in [(m, s) for m in notes for s in ('', '_s')]:
        new = call('Create PitchTier', 'target', 0, seg.duration)
        keep = KEEP * min(1, 2.0 / max(glide, 1e-6))  # big swoopers (Tom) keep at most ~2 st x KEEP of movement
        for t, f in pts: call(new, 'Add point', t, hz(m + keep * (st(f) - med)))
        call([new, manip], 'Replace pitch tier')
        dt = call('Create DurationTier', 'speed', 0, seg.duration)
        call(dt, 'Add point', 0, SHORT / seg.duration if suffix else 1.0)
        call([dt, manip], 'Replace duration tier')
        out = call(manip, 'Get resynthesis (overlap-add)')
        y = out.values[0]; peak = np.max(np.abs(y))
        if peak > 0.95: out.values[0] = y * (0.95 / peak)
        # fade the edges so samples start and stop without clicks
        n = len(out.values[0]); f = int(0.008 * out.sampling_frequency)
        ramp = np.linspace(0, 1, f); out.values[0][:f] *= ramp; out.values[0][n - f:] *= ramp[::-1]
        path = out_dir / f'{name}_{m}{suffix}.wav'; out.save(str(path), 'WAV')
        # verify: pitch of the steady middle of the result vs the target note
        p = out.to_pitch_ac(time_step=0.01, pitch_floor=150, pitch_ceiling=2000).selected_array['frequency']; p = p[p > 0]
        mid = p[int(len(p) * 0.2): max(int(len(p) * 0.8), int(len(p) * 0.2) + 1)]
        cents = 1200 * np.log2(mid / hz(m))
        report.append(dict(voice=name + suffix, midi=m, dur=round(out.duration, 3), shift=round(m - natural, 1),
                           err_cents=round(float(np.median(cents)), 1), spread_cents=round(float(np.std(cents)), 1)))
report_path.write_text(json.dumps(report, indent=1))
errs = np.array([abs(r['err_cents']) for r in report]); spreads = np.array([r['spread_cents'] for r in report])
print(f'{len(report)} samples | |error| median {np.median(errs):.1f} c, worst {errs.max():.1f} c | spread median {np.median(spreads):.1f} c, worst {spreads.max():.1f} c')
for r in sorted(report, key=lambda r: -abs(r['err_cents']))[:8]: print('  worst:', r)
