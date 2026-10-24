"""Recognisable opening phrases of candidate songs (current ones from songs.js, new public-domain ones below), rendered with a
soft music-box tone, for picking songs per venue. usage: python -I songsamples.py <current-songs json> <out dir>"""
import json, sys, pathlib
import numpy as np
import parselmouth

SR = 44100; out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(s): return 12 * (int(s[-1]) + 1) + NOTE[s[0]] + (1 if '#' in s else 0)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
# new candidates: (venue suggestion 0-4, title, composer/origin, bpm, opening)
NEW = [
    (0, 'Amazing Grace', 'Traditional hymn', 90, 'D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 G4:2 E4:1 D4:2 D4:1 G4:2 B4:0.5 G4:0.5 B4:2 A4:1 D5:3'),
    (0, 'Frère Jacques', 'Traditional', 120, 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4'),
    (0, 'Jingle Bells', 'Pierpont, 1857', 140, 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2'),
    (0, 'Oh! Susanna', 'Foster, 1848', 130, 'C4:0.5 D4:0.5 E4 G4 G4:1.5 A4:0.5 G4 E4 C4:1.5 D4:0.5 E4 E4 D4 C4 D4:3'),
    (1, 'Greensleeves', 'Traditional English', 110, 'A4 C5:2 D5 E5:1.5 F5:0.5 E5 D5:2 B4 G4:1.5 A4:0.5 B4 C5:2 A4 A4:1.5 G#4:0.5 A4 B4:2 G#4 E4:3'),
    (1, 'When the Saints Go Marching In', 'Traditional spiritual', 140, 'C4 E4 F4 G4:4 C4 E4 F4 G4:4 C4 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:4'),
    (1, 'Scarborough Fair', 'Traditional English', 100, 'D4:2 D4 A4:2 A4 E4:1.5 F4:0.5 E4 D4:3 A4 C5:2 D5 C5:2 A4 B4 G4 A4:3'),
    (1, 'Gymnopédie No. 1', 'Satie', 72, 'F#5 A5 G5 F#5 C#5 B4 C#5 D5 A4:3 F#4:3'),
    (2, 'The Entertainer', 'Scott Joplin, 1902', 100, 'D4:0.5 D#4:0.5 E4:0.5 C5 E4:0.5 C5 E4:0.5 C5:3 C5:0.5 D5:0.5 D#5:0.5 E5:0.5 C5:0.5 D5:0.5 E5 B4:0.5 D5 C5:3'),
    (2, 'Symphony No. 40', 'Mozart', 110, 'D#5:0.5 D5:0.5 D5 D#5:0.5 D5:0.5 D5 D#5:0.5 D5:0.5 D5 A#5:2 A#5:0.5 A5:0.5 G5 G5:0.5 F5:0.5 D#5 D#5:0.5 D5:0.5 C5 C5:2'),
    (2, 'The Blue Danube', 'Johann Strauss II', 160, 'D4 D4 F#4 A4 A4:2 A5 A5:2 F#5 F#5:2 D4 D4 F#4 A4 A4:2 A5 A5:2 G5 G5:2'),
    (3, 'Toreador Song', 'Bizet, Carmen', 100, 'C5:0.75 D5:0.25 C5:0.5 A4:0.5 A4:0.5 A4:0.5 G4:0.5 A4:0.5 A#4:0.5 A4:2.5'),
    (3, 'Bridal Chorus ("Here Comes the Bride")', 'Wagner', 70, 'C4 F4:0.75 F4:0.25 F4:2 C4 G4:0.75 E4:0.25 F4:2 C4 F4:0.75 A#4:0.25 A#4:1.5 A4:0.5 G4:0.75 F4:0.25 E4:0.75 F4:0.25 G4:2'),
    (4, 'Hallelujah Chorus', 'Handel, Messiah', 100, 'D5 A4:0.75 B4:0.25 A4 R D5 A4:0.75 B4:0.25 A4 R D5:0.5 A4:0.5 D5:0.5 A4:0.5 D5 R'),
]

def render(tokens, bpm, units=1.0):
    spb = 60 / bpm; notes = []
    for tok in tokens.split():
        n, d = tok.split(':') if ':' in tok else (tok, '1'); notes.append((None if n == 'R' else midi(n), float(d) * spb))
    y = np.zeros(int((sum(d for _, d in notes) + 1.5) * SR)); t = 0.0
    for m, d in notes:
        if m is not None:
            L = int(min(1.6, d + 0.5) * SR); tt = np.arange(L) / SR; f = hz(m)
            tone = sum(np.sin(2 * np.pi * f * k * tt) * (0.6 ** (k - 1)) * np.exp(-tt * (2.5 + k)) for k in range(1, 6))
            tone *= np.minimum(1, tt / 0.005); i = int(t * SR); y[i:i + L] += tone[: len(y) - i]
        t += d
    return y / (np.max(np.abs(y)) + 1e-9) * 0.8

songs = []
for s in json.load(open(sys.argv[1])):
    songs.append(dict(venue=s['venue'], title=s['title'], composer=s['composer'], bpm=s['bpm'], current=True, notes=s['notes']))
for v, title, comp, bpm, notes in NEW:
    songs.append(dict(venue=v, title=title, composer=comp, bpm=bpm, current=False, notes=notes))
for i, s in enumerate(songs):
    s['id'] = f'song-{i:02d}'
    parselmouth.Sound(render(s['notes'], s['bpm']), SR).save(str(out / f"{s['id']}.wav"), 'WAV')
json.dump([{k: s[k] for k in ('id', 'venue', 'title', 'composer', 'current')} for s in songs], open(out / 'songs.json', 'w'), indent=1)
print(len(songs), 'samples')
