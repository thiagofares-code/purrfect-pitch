"""Grade every meow in a folder of WAVs: find each voiced meow, measure clarity, pitch, steadiness.
usage: python -I grade.py <wav dir> <out json>"""
import json, sys, pathlib
import numpy as np
import parselmouth

def st(f): return 12 * np.log2(f / 440.0) + 69  # Hz -> MIDI (fractional)

def segments(voiced, step, min_len=0.25, max_gap=0.06):
    segs, start, gap = [], None, 0
    for i, v in enumerate(voiced):
        if v:
            if start is None: start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap * step > max_gap:
                segs.append((start, i - gap)); start, gap = None, 0
    if start is not None: segs.append((start, len(voiced) - 1))
    return [(a, b) for a, b in segs if (b - a + 1) * step >= min_len]

out = []
for wav in sorted(pathlib.Path(sys.argv[1]).glob('*.wav')):
    snd = parselmouth.Sound(str(wav))
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=200, pitch_ceiling=1600, voicing_threshold=0.5)
    hnr = snd.to_harmonicity_cc(time_step=0.01, minimum_pitch=200)
    f0 = pitch.selected_array['frequency']; t = pitch.xs(); step = pitch.time_step
    for a, b in segments(f0 > 0, step):
        seg_f = f0[a:b + 1]; v = seg_f[seg_f > 0]
        semis = st(v)
        mid = semis[int(len(semis) * 0.2): max(int(len(semis) * 0.8), int(len(semis) * 0.2) + 1)]
        h = np.array([hnr.get_value(x) for x in t[a:b + 1]]); h = h[np.isfinite(h)]
        dur = (b - a + 1) * step
        rec = dict(file=wav.name, start=round(float(t[a]) - step / 2, 3), dur=round(dur, 3),
                   midi=round(float(np.median(semis)), 2), wobble=round(float(np.std(mid)), 2),
                   glide=round(float(np.percentile(semis, 90) - np.percentile(semis, 10)), 2),
                   hnr=round(float(np.mean(h)) if len(h) else 0.0, 1), voiced=round(len(v) / len(seg_f), 2))
        # clarity matters most, then a steady middle, then a usable length (0.4-1.4 s ideal)
        len_fit = 1.0 if 0.4 <= dur <= 1.4 else max(0.0, 1 - abs(dur - (0.4 if dur < 0.4 else 1.4)) / 0.6)
        rec['score'] = round(0.5 * min(max(rec['hnr'], 0), 25) / 25 + 0.3 * (1 - min(rec['wobble'] / 2, 1)) + 0.2 * len_fit, 3)
        out.append(rec)
out.sort(key=lambda r: -r['score'])
pathlib.Path(sys.argv[2]).write_text(json.dumps(out, indent=1))
print(f"{len(out)} meows from {len(set(r['file'] for r in out))} files")
for r in out[:30]:
    print(f"{r['score']:.3f}  {r['file'][:52]:52s} @{r['start']:5.2f} {r['dur']:4.2f}s  midi {r['midi']:5.1f}  wobble {r['wobble']:4.2f}  glide {r['glide']:4.1f}  hnr {r['hnr']:4.1f}")
