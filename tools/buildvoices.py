"""Render the chosen cat voices onto every note their lanes need, the same way the audition did (PSOLA, 1.2 semitones of
the cat's own curve kept): '<voice>_<midi>.wav' at natural length, '<voice>_<midi>_s.wav' squeezed to 0.3 s for quick
notes. Then measure each note's held middle against its target.
usage: python -I buildvoices.py <wav dir> <out dir>"""
import sys, pathlib
import numpy as np
import parselmouth
from parselmouth.praat import call

wavs, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
SR = 44100; KEEP = 1.2; SHORT = 0.3
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12); st = lambda f: 12 * np.log2(f / 440.0) + 69
VOICES = [  # name, recording, meow start/len (s), notes to render; picked by ear on audition.html
    ('tabby',  'freesound_community-audio_2018da8326.wav', 266.13, 0.49, range(62, 82)),  # cats 1 and 2
    ('kitten', 'freesound_community-audio_fa8b3e60d1.wav', 50.56, 0.61, range(70, 89)),   # cat 3 (soloist)
    ('kitty',  'freesound_community-audio_fa8b3e60d1.wav', 42.56, 0.62, range(72, 92)),   # cats 4 and 5
]
errs = []
for name, wav, start, dur, notes in VOICES:
    snd = parselmouth.Sound(str(wavs / wav)).resample(SR)
    seg = snd.extract_part(from_time=max(0, start - 0.03), to_time=min(snd.xmax, start + dur + 0.08), preserve_times=False)
    v = seg.values[0]; seg.values[0] = v / max(np.sqrt(np.mean(v ** 2)), 1e-6) * 0.1
    p = seg.to_pitch_ac(time_step=0.01, pitch_floor=150, pitch_ceiling=1600).selected_array['frequency']; p = p[p > 0]
    med = float(np.median(st(p[len(p) // 3: 2 * len(p) // 3 + 1])))
    manip = call(seg, 'To Manipulation', 0.01, 150, 1600); tier = call(manip, 'Extract pitch tier')
    pts = [(call(tier, 'Get time from index', i), call(tier, 'Get value at index', i)) for i in range(1, call(tier, 'Get number of points') + 1)]
    semis = np.array([st(f) for _, f in pts]); keep = min(1, KEEP / max(np.ptp(semis), 1e-6))
    for m in notes:
        for suffix, length in (('', seg.duration), ('_s', SHORT)):
            off = 0.0
            for _ in range(3):  # render, measure the held middle, nudge until it sits on the note
                new = call('Create PitchTier', 'p', 0, seg.duration)
                for (t, f), s in zip(pts, semis): call(new, 'Add point', t, hz(m + off + keep * (s - med)))
                call([new, manip], 'Replace pitch tier')
                dt = call('Create DurationTier', 'd', 0, seg.duration); call(dt, 'Add point', 0, length / seg.duration); call([dt, manip], 'Replace duration tier')
                o = call(manip, 'Get resynthesis (overlap-add)')
                q = o.to_pitch_ac(time_step=0.005, pitch_floor=150, pitch_ceiling=2000).selected_array['frequency']; q = q[q > 0]
                err = float(np.median(1200 * np.log2(q[len(q) // 3: 2 * len(q) // 3 + 1] / hz(m)))) if len(q) > 3 else 0.0
                if abs(err) < 5: break
                off -= err / 100
            y = o.values[0]; pk = np.max(np.abs(y)); y *= min(1, 0.95 / pk)
            f = int(0.008 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f); o.values[0] = y
            o.save(str(out / f'{name}_{m}{suffix}.wav'), 'WAV'); errs.append((abs(err), f'{name}_{m}{suffix}'))
errs.sort(reverse=True); e = np.array([x for x, _ in errs])
print(f'{len(errs)} samples | |error| median {np.median(e):.1f} cents, worst {errs[0][0]:.1f} ({errs[0][1]}) | over 15 cents: {int((e > 15).sum())}')
