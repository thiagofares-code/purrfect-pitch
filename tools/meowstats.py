"""Describe meows as numbers: note lengths, pitch bend inside each note, brightness. Reference only, nothing is copied.
usage: python -I meowstats.py <wav> [<wav> ...]"""
import sys
import numpy as np
import parselmouth

st = lambda f: 12 * np.log2(f / 440.0) + 69
for path in sys.argv[1:]:
    snd = parselmouth.Sound(path)
    p = snd.to_pitch_ac(time_step=0.005, pitch_floor=150, pitch_ceiling=2000)
    f = p.selected_array['frequency']
    # notes = voiced runs, split where the pitch jumps by more than 0.8 semitone between frames
    notes, cur = [], []
    for x in f:
        if x > 0 and (not cur or abs(st(x) - st(cur[-1])) < 0.8): cur.append(x); continue
        if len(cur) >= 8: notes.append(cur)
        cur = [x] if x > 0 else []
    if len(cur) >= 8: notes.append(cur)
    durs = np.array([len(n) * 0.005 for n in notes])
    bend = np.array([np.ptp(st(np.array(n))) for n in notes])           # semitones of pitch movement inside a note
    scoop = np.array([st(np.median(n)) - st(np.median(n[:4])) for n in notes])  # how far below the note it starts
    x = snd.values[0]; w = 2048; hop = 1024
    cents = []
    for i in range(0, len(x) - w, hop):
        fr = x[i:i+w] * np.hanning(w)
        mag = np.abs(np.fft.rfft(fr))
        if mag.sum() > 1e-3 * w: cents.append((np.fft.rfftfreq(w, 1/snd.sampling_frequency) * mag).sum() / mag.sum())
    name = path.replace('\\', '/').split('/')[-1]
    print(f"{name:16s} notes {len(notes):4d} | length median {np.median(durs):.2f}s (p25 {np.percentile(durs,25):.2f}, p75 {np.percentile(durs,75):.2f})"
          f" | bend median {np.median(bend):.2f} st | scoop {np.median(scoop):+.2f} st | brightness {np.median(cents):.0f} Hz")
