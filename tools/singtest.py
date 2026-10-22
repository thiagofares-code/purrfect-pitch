"""Render a short Ode to Joy phrase in several meow styles, for choosing by ear (sing-test.html).
A = the game's current per-note library; B1-B3 = "sampler": one untouched, steady meow resampled per note at its
natural length; C = B1 with its tone colour (long-term spectrum) matched to a reference recording's meow frames.
usage: python -I singtest.py <graded meows json> <meow wav dir> <tuned wav dir> <reference wav> <out dir>"""
import json, sys, pathlib
import numpy as np
import parselmouth

grades, wavs, tuned, ref, out = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), sys.argv[4], pathlib.Path(sys.argv[5])
out.mkdir(parents=True, exist_ok=True)
SR = 44100
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
PHRASE = [(76, 1), (76, 1), (77, 1), (79, 1), (79, 1), (77, 1), (76, 1), (74, 1), (72, 1), (72, 1), (74, 1), (76, 1), (76, 1.5), (74, 0.5), (74, 2)]
BEAT = 0.5

def load(path, start=0.0, dur=None):
    s = parselmouth.Sound(str(path)).resample(SR)
    if dur: s = s.extract_part(from_time=max(0, start - 0.01), to_time=min(s.xmax, start + dur + 0.04), preserve_times=False)
    y = s.values[0].copy(); f = int(0.006 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y / max(np.sqrt(np.mean(y ** 2)), 1e-6) * 0.1

def resample(y, rate):  # sampler-style pitch change: play faster/slower (pitch and length change together)
    n = int(len(y) / rate); return np.interp(np.arange(n) * rate, np.arange(len(y)), y)

def render(note_fn):
    total = sum(b for _, b in PHRASE) * BEAT + 1.5; mix = np.zeros(int(total * SR)); t = 0.0
    for m, beats in PHRASE:
        y = note_fn(m, beats * BEAT); i = int(t * SR); mix[i:i + len(y)] += y[: len(mix) - i]; t += beats * BEAT
    return mix / max(np.max(np.abs(mix)), 1e-6) * 0.8

def save(name, y):
    s = parselmouth.Sound(y, SR); s.save(str(out / f'{name}.wav'), 'WAV'); print('saved', name)

# A: the game's current library (soloist-range cat 'ribs' covers 68-84), legato is in-game, here notes just overlap
save('A-current', render(lambda m, d: load(tuned / f"ribs_{m}{'_s' if d <= 0.55 else ''}.wav")))

# B: the steadiest, cleanest meows (little glide or wobble, clear voice, long enough to sing)
g = [x for x in json.load(open(grades)) if x['dur'] >= 0.35 and x['glide'] <= 1.5 and x['hnr'] >= 15]
g.sort(key=lambda x: (x['glide'] + 2 * x['wobble']) - x['hnr'] / 20)
picks, seen = [], set()
for x in g:
    if x['file'] in seen: continue
    seen.add(x['file']); picks.append(x)
    if len(picks) == 3: break
for k, p in enumerate(picks, 1):
    y = load(wavs / p['file'], p['start'], p['dur'])
    save(f'B{k}-sampler', render(lambda m, d, y=y, p=p: resample(y, hz(m) / hz(p['midi']))))
    print(f"  B{k}: {p['file']} at {p['start']}s, {p['dur']}s, natural MIDI {p['midi']:.1f}, glide {p['glide']}, hnr {p['hnr']}")

# C: B1 with the reference's tone colour: average spectrum over its voiced (meow) frames vs B1's, smoothed, ±6 dB
def ltas(y, sr):
    snd = parselmouth.Sound(y, sr); pit = snd.to_pitch_ac(time_step=0.02, pitch_floor=250, pitch_ceiling=1600)
    w = 2048; acc = np.zeros(w // 2 + 1); n = 0
    for i in range(0, len(y) - w, w // 2):
        if pit.get_value_at_time((i + w / 2) / sr) and not np.isnan(pit.get_value_at_time((i + w / 2) / sr)):
            acc += np.abs(np.fft.rfft(y[i:i + w] * np.hanning(w))) ** 2; n += 1
    return acc / max(n, 1)
r = parselmouth.Sound(ref).resample(SR).values[0]
b1 = load(wavs / picks[0]['file'], picks[0]['start'], picks[0]['dur'])
target, mine = ltas(r, SR), ltas(np.tile(b1, 4), SR)
freqs = np.fft.rfftfreq(2048, 1 / SR)
gain_db = 10 * np.log10((target + 1e-12) / (mine + 1e-12)); gain_db -= np.median(gain_db[(freqs > 500) & (freqs < 4000)])
sm = np.array([np.mean(gain_db[(freqs >= f / 1.12) & (freqs <= f * 1.12)]) if f > 0 else 0 for f in freqs])  # ~1/3 octave
eq = np.clip(sm, -6, 6)
def match(y):
    Y = np.fft.rfft(y, n=len(y)); fq = np.fft.rfftfreq(len(y), 1 / SR)
    return np.fft.irfft(Y * 10 ** (np.interp(fq, freqs, eq) / 20), n=len(y))
b1m = match(b1)
save('C-sampler-tone-matched', render(lambda m, d: resample(b1m, hz(m) / hz(picks[0]['midi']))))
print('  C EQ (dB) at 500/1k/2k/4k/8k Hz:', [round(float(np.interp(f, freqs, eq)), 1) for f in (500, 1000, 2000, 4000, 8000)])
