"""Options per cat lane: for each lane, the 3 cleanest distinct meows near its range, each autotuned (PSOLA) onto a short
melody in that range with short and long notes, joined legato. Writes <out>/<cat>-<n>.wav and <out>/voices.json.
usage: python -I voiceaudition.py <grades json> <wav dir> <out dir>"""
import json, sys, pathlib
import numpy as np
import parselmouth
from parselmouth.praat import call

grades, wavs, out = json.load(open(sys.argv[1])), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
SR = 44100; hz = lambda m: 440.0 * 2 ** ((m - 69) / 12); st = lambda f: 12 * np.log2(f / 440.0) + 69
LANES = [('cat1', 72), ('cat2', 74), ('cat3', 78), ('cat4', 82), ('cat5', 84)]   # median note each lane sings
KEEP = 1.2      # semitones of the cat's own pitch curve kept (lively, but on the note)
SHORT = 0.3     # seconds: a short note sings the whole meow squeezed to this

def tune(seg, contour_med, m, length):
    manip = call(seg, 'To Manipulation', 0.01, 150, 1600); tier = call(manip, 'Extract pitch tier')
    pts = [(call(tier, 'Get time from index', i), call(tier, 'Get value at index', i)) for i in range(1, call(tier, 'Get number of points') + 1)]
    if not pts: return None
    semis = np.array([st(f) for _, f in pts]); glide = max(np.ptp(semis), 1e-6); keep = min(1, KEEP / glide)
    new = call('Create PitchTier', 'p', 0, seg.duration)
    for (t, f), s in zip(pts, semis): call(new, 'Add point', t, hz(m + keep * (s - contour_med)))
    call([new, manip], 'Replace pitch tier')
    dt = call('Create DurationTier', 'd', 0, seg.duration); call(dt, 'Add point', 0, length / seg.duration); call([dt, manip], 'Replace duration tier')
    y = call(manip, 'Get resynthesis (overlap-add)').values[0]
    f = int(0.008 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f); return y

def melody(med):  # (midi, beats); 0.5-beat notes are "short", 2-beat notes "long", at 100 bpm
    return [(med, .5), (med + 2, .5), (med + 4, .5), (med + 2, .5), (med, 2), (med - 1, .5), (med, .5), (med + 2, .5), (med + 4, .5), (med + 2, 2)]

pool = [g for g in grades if g['hnr'] >= 14 and g['voiced'] >= 0.8 and g['dur'] >= 0.35]
seen = set(); uniq = []
for g in sorted(pool, key=lambda g: -g['score']):
    key = (round(g['midi'], 1), round(g['dur'], 2), round(g['hnr']))  # same audio saved under two names
    if key not in seen: seen.add(key); uniq.append(g)
manifest = {}
for lane, med in LANES:
    near = sorted([g for g in uniq if abs(g['midi'] - med) <= 4], key=lambda g: (-g['hnr'] + 2 * abs(g['midi'] - med) * 0.5))
    picks, files = [], set()
    for g in near:
        if g['file'] in files: continue
        files.add(g['file']); picks.append(g)
        if len(picks) == 3: break
    manifest[lane] = []
    for n, g in enumerate(picks, 1):
        snd = parselmouth.Sound(str(wavs / g['file'])).resample(SR)
        seg = snd.extract_part(from_time=max(0, g['start'] - 0.03), to_time=min(snd.xmax, g['start'] + g['dur'] + 0.08), preserve_times=False)
        v = seg.values[0]; seg.values[0] = v / max(np.sqrt(np.mean(v ** 2)), 1e-6) * 0.1
        p = seg.to_pitch_ac(time_step=0.01, pitch_floor=150, pitch_ceiling=1600).selected_array['frequency']; p = p[p > 0]
        med_c = float(np.median(st(p[len(p) // 3: 2 * len(p) // 3 + 1])))  # the held middle defines "on the note"
        spb = 0.6; mix = np.zeros(int((sum(b for _, b in melody(med)) * spb + 1.2) * SR)); t = 0.0
        for m, b in melody(med):
            L = SHORT if b < 1 else max(seg.duration, b * spb)
            y = tune(seg, med_c, m, L)
            if y is None: continue
            i = int(t * SR); nxt = int((t + b * spb) * SR); y = y[: len(mix) - i].copy()
            if nxt - i < len(y):  # next note starts: this one fades out over 40 ms (one cat, one note at a time)
                k = nxt - i; f = min(int(0.04 * SR), len(y) - k); y[k:k + f] *= np.linspace(1, 0, f); y[k + f:] = 0
            mix[i:i + len(y)] += y; t += b * spb
        mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.8
        name = f'{lane}-{n}'; parselmouth.Sound(mix, SR).save(str(out / f'{name}.wav'), 'WAV')
        manifest[lane].append({ 'id': name, 'file': g['file'], 'start': g['start'], 'dur': g['dur'], 'natural': round(g['midi'], 1), 'hnr': round(g['hnr'], 1) })
        print(name, g['file'], f"@{g['start']:.2f} {g['dur']:.2f}s midi {g['midi']:.1f} hnr {g['hnr']:.1f}")
json.dump(manifest, open(out / 'voices.json', 'w'), indent=1)
