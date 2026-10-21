"""Render audition clips: each candidate meow tuned onto a few notes (natural curve kept, held middle on the note)
plus a short sung phrase, so the voices can be compared by ear.  usage: python -I audition.py <wav dir> <out dir>"""
import json, sys, pathlib
import numpy as np
import parselmouth
from parselmouth.praat import call

st = lambda f: 12*np.log2(f/440) + 69
hz = lambda m: 440*2**((m - 69)/12)
SR = 44100
# spot -> candidates (name, file, start, dur), notes to show, phrase (midi, seconds)
SPOTS = {
  'low': dict(notes=[62, 66, 70], phrase=[(62, .5), (64, .5), (66, .5), (67, 1.0)], cands=[
    ('Tom (now)',       'soundreality-cat-meow-fx-461188.wav',       0.04, 1.08),
    ('Grumpy',          'alex_jauk-cat-meow-noise-438008.wav',       0.13, 0.62),
    ('Annoyed',         'alex_jauk-annoyed-cat-meow-193067.wav',     1.03, 0.66),
    ('Long meow',       'stu9-long-meow-352765.wav',                 0.08, 1.38),
    ('Big cat',         'freesound_community-meow-74193.wav',        3.58, 0.56)]),
  'mid': dict(notes=[67, 71, 75], phrase=[(67, .5), (69, .5), (71, .5), (72, 1.0)], cands=[
    ('Ribs (now)',      'soulfuljamtracks-cat-meow-2-fx-323466.wav', 0.06, 1.06),
    ('Purry',           'freesound_community-cat-purring-and-meow-5928.wav', 2.00, 0.48),
    ('Cute',            'dragon-studio-cute-cat-meow-472372.wav',    0.20, 1.05),
    ('Sweet',           'virtual_vibes-cute-cat-meow-400946.wav',    0.29, 0.68),
    ('Kitten B',        'dragon-studio-kitten-sfx-405457.wav',       0.03, 0.78)]),
  'solo': dict(notes=[72, 76, 80], phrase=[(72, .5), (74, .5), (76, .5), (77, 1.0)], cands=[
    ('Soloist (now)',   'dragon-studio-kitten-sfx-405457.wav',       1.65, 0.72),
    ('Cartoon kitten',  'dragon-studio-cartoon-kitten-meow-487668.wav', 0.05, 1.59),
    ('Tiny',            'yomecerlm3-meow-460686.wav',                0.05, 0.86),
    ('Bright',          'freesound_community-cat-meow-14536.wav',    0.15, 1.33),
    ('Clear',           'freesound_community-cat-meow-85175.wav',    0.28, 0.91)]),
}

def prepare(wav_dir, file, start, dur):
    snd = parselmouth.Sound(str(wav_dir/file))
    seg = snd.extract_part(from_time=max(0, start - 0.02), to_time=min(snd.xmax, start + dur + 0.06), preserve_times=False)
    v = seg.values[0]; seg.values[0] = v*(0.1/max(np.sqrt(np.mean(v**2)), 1e-6))
    manip = call(seg, 'To Manipulation', 0.01, 150, 1600); tier = call(manip, 'Extract pitch tier')
    pts = [(call(tier, 'Get time from index', i), call(tier, 'Get value at index', i)) for i in range(1, call(tier, 'Get number of points') + 1)]
    times = np.array([t for t, _ in pts]); semis = np.array([st(f) for _, f in pts])
    mid = (times > seg.duration*0.4) & (times < seg.duration*0.6)
    return seg, manip, pts, float(np.median(semis[mid] if mid.any() else semis))

def render(seg, manip, pts, center, m, length=None, offset=0.0):
    new = call('Create PitchTier', 'target', 0, seg.duration)
    for t, f in pts: call(new, 'Add point', t, hz(m + offset + (st(f) - center)))   # whole natural curve, middle on m
    call([new, manip], 'Replace pitch tier')
    dt = call('Create DurationTier', 'speed', 0, seg.duration); call(dt, 'Add point', 0, (length/seg.duration) if length else 1.0)
    call([dt, manip], 'Replace duration tier')
    out = call(manip, 'Get resynthesis (overlap-add)')
    p = out.to_pitch_ac(time_step=0.01, pitch_floor=150, pitch_ceiling=2000).selected_array['frequency']; p = p[p > 0]
    mid = p[int(len(p)*0.4):max(int(len(p)*0.6), int(len(p)*0.4) + 1)]
    return out, float(np.median(1200*np.log2(mid/hz(m)))) if len(mid) else 0.0

def tuned(seg, manip, pts, center, m, length=None):
    out, err = render(seg, manip, pts, center, m, length); off = 0.0
    for _ in range(3):
        if not (3 < abs(err) < 150): break
        off -= err/100; out, err = render(seg, manip, pts, center, m, length, off)
    return out.values[0].copy(), err

wav_dir, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); out_dir.mkdir(parents=True, exist_ok=True)
manifest = {}
for spot, cfg in SPOTS.items():
    manifest[spot] = []
    for k, (label, file, start, dur) in enumerate(cfg['cands']):
        seg, manip, pts, center = prepare(wav_dir, file, start, dur); errs = []
        clip = []  # the three notes with gaps, then the phrase sung legato
        for m in cfg['notes']:
            y, e = tuned(seg, manip, pts, center, m); errs.append(e); clip += [y, np.zeros(int(0.25*SR))]
        for m, secs in cfg['phrase']:
            y, e = tuned(seg, manip, pts, center, m, max(secs, 0.3)); y = y[:int((secs + 0.08)*SR)]; clip += [y]
        x = np.concatenate(clip); x = x/max(np.max(np.abs(x)), 1e-6)*0.8
        name = f'{spot}-{k+1}'; parselmouth.Sound(x, SR).save(str(out_dir/f'{name}.wav'), 'WAV')
        manifest[spot].append(dict(id=name, label=label, file=file, start=start, dur=dur, natural=round(center, 1), err=[round(e, 1) for e in errs]))
        print(f'{name:7s} {label:15s} natural {center:5.1f}  note errors (cents) {[round(e, 1) for e in errs]}')
(out_dir/'audition.json').write_text(json.dumps(manifest, indent=1))
