// Career setlist: public-domain melodies, written out as NOTE:duration tokens (R = rest).
// Durations are in the song's own unit (quarters unless noted); bpm counts those units per minute.
// `form` plays the parts in order and repeats until the song lasts about two minutes.
// Optional: `tempo` speeds up single parts, `accel` speeds up every repeat of the form.

export const TIERS = [
  // scenery, crowd size and effects live in venues.js
  { venue:'The Alley',       rank:'Kitten',    bg:0x0d1220, curtain:0x666677, beams:0, drummer:false },
  { venue:'The Rooftop',     rank:'House Cat', bg:0x160d2a, curtain:0x9977bb, beams:2, drummer:true },
  { venue:'The Jazz Club',   rank:'Street Cat',bg:0x1c100a, curtain:0xcc8855, beams:0, drummer:true }, // low ceiling: no beams
  { venue:'The Opera House', rank:'Show Cat',  bg:0x1a0508, curtain:0xffffff, beams:4, drummer:true },
  { venue:'The Stadium',     rank:'Superstar', bg:0x050814, curtain:0x5566bb, beams:2, drummer:true },
];
export const STARS_TO_UNLOCK = 8; // of the 12 available in the previous venue
export const TARGET_SECS = 110;   // the form repeats until the song reaches this length
// difficulty ramp per venue: Alley 4 lanes · Rooftop 4 + double notes · Jazz Club 5 lanes ·
// Opera House 5 + doubles · Stadium 5 + doubles twice per bar
const RAMP = [{ lanes:4, doubles:0 }, { lanes:4, doubles:1 }, { lanes:5, doubles:0 }, { lanes:5, doubles:1 }, { lanes:5, doubles:2 }];
export const difficultyFor = i => RAMP[Math.floor(i/4)];
export const lanesFor = i => difficultyFor(i).lanes;

// harmony for a double note: a third below that belongs to the song's own scale, else a 4th, 5th or octave
function harmonyBelow(m, scale){ for (const iv of [3, 4, 5, 7, 12]) if (scale.has((m - iv) % 12)) return m - iv; return m - 12; }

const NAMES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
export const midi = n => { const m = n.match(/^([A-G])(#?)(-?\d)$/); return 12*(+m[3]+1) + NAMES[m[1]] + (m[2] ? 1 : 0); };

// chord symbols in `chords` (same NAME:duration tokens as the melody; N = no chord): C, Am, G7, F#m7, Bbmaj7, Cdim
const QUALITY = { '':[0,4,7], m:[0,3,7], '7':[0,4,7,10], m7:[0,3,7,10], maj7:[0,4,7,11], dim:[0,3,6] };
export function chord(tok){
  if (tok === 'N') return null;
  const m = tok.match(/^([A-G])(#|b)?(maj7|m7|dim|m|7)?$/); if (!m) throw new Error(`bad chord ${tok}`);
  const root = (NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { name: tok, root, tones: QUALITY[m[3] || ''].map(i => (root + i) % 12) };
}
const tokens = s => s.trim().split(/\s+/).map(t => { const [n, d] = t.split(':'); return [n, d ? +d : 1]; });

// -> notes with beat, dur (beats), t / secs (seconds from song start), midi, lane; tempo segments; chord timeline
export function parseSong(song, { lanes = 4, doubles = 0 } = {}){
  const notes = [], segs = [], chords = []; let beat = 0, t = 0;
  for (let r = 0; t < TARGET_SECS; r++){
    for (const key of song.form){
      const spb = 60 / (song.bpm * (song.tempo?.[key] || 1) * Math.min(2, (song.accel || 1) ** r));
      segs.push({ b: beat, t, spb });
      let cb = beat; for (const [c, d] of tokens(song.chords?.[key] || 'N:0')) { if (d) chords.push({ beat: cb, dur: d, chord: chord(c) }); cb += d; }
      for (const [n, dur] of tokens(song.parts[key])){
        if (n !== 'R') notes.push({ beat, dur, t, secs: dur*spb, midi: midi(n) });
        beat += dur; t += dur*spb;
      }
    }
  }
  // double notes: on the downbeat (and at mid-bar for level 2) a second cat sings a harmony under the melody
  if (doubles){
    const scale = new Set(notes.map(n => n.midi % 12)), spots = doubles > 1 && song.bar >= 4 ? [0, song.bar/2] : [0]; // in 2-beat bars mid-bar would be every beat
    for (const n of notes.slice()){
      const inBar = ((n.beat - song.pickup) % song.bar + song.bar) % song.bar;
      if (n.beat >= song.pickup && spots.some(s => Math.abs(inBar - s) < 1e-6))
        notes.push({ ...n, midi: harmonyBelow(n.midi, scale), partner: n });
    }
    notes.sort((a, b) => a.t - b.t);
  }
  // lanes ordered low→high pitch so the highway "sounds" like the melody
  const pitches = [...new Set(notes.map(n => n.midi))].sort((a, b) => a - b);
  for (const n of notes) n.lane = Math.min(lanes-1, Math.floor(pitches.indexOf(n.midi)*lanes/pitches.length));
  for (const n of notes) if (n.partner && n.lane === n.partner.lane) n.lane = n.partner.lane > 0 ? n.partner.lane - 1 : n.partner.lane + 1; // never the same lane
  for (const n of notes) delete n.partner;
  return { notes, length: beat, secs: t, segs, chords };
}
export const chordAt = (chords, b) => { for (let i = chords.length - 1; i >= 0; i--) if (chords[i].beat <= b + 1e-6) return b < chords[i].beat + chords[i].dur - 1e-6 ? chords[i].chord : null; return null; };
const segAt = (segs, key, v) => { let s = segs[0]; for (const x of segs) { if (x[key] > v) break; s = x; } return s; };
export const timeAt = (segs, b) => { const s = segAt(segs, 'b', b); return s.t + (b - s.b)*s.spb; };
export const beatAt = (segs, t) => { const s = segAt(segs, 't', t); return s.b + (t - s.t)/s.spb; };
export const spbAt = (segs, b) => segAt(segs, 'b', b).spb;

const ELISE = 'E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2 R C4 E4 A4 B4:2 R E4 G#4 B4 C5:2 R E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2 R C4 E4 A4 B4:2 R E4 C5 B4 A4:4';
const SPRING = 'E5:0.5 G#5:0.5 G#5:0.5 G#5:0.5 F#5:0.25 E5:0.25 B5:1.5 B5:0.25 A5:0.25 G#5:0.5 G#5:0.5 G#5:0.5 F#5:0.25 E5:0.25 B5:1.5 ' +
  'B5:0.25 A5:0.25 G#5:0.5 A5:0.5 B5:0.5 A5:0.5 G#5:0.5 F#5:1 G#5:0.5 E5:0.5 F#5:0.5 D#5:0.5 E5:2';
const TELL1 = 'E4:0.5 E4:0.5 E4 E4:0.5 E4:0.5 E4 E4:0.5 E4:0.5 A4 B4 C#5 ';
// Morning Mood, Swan Lake, La donna è mobile, Sugar Plum Fairy and Hungarian Dance No. 5 were checked against
// flutetunes.com scores (melody and the piano part's harmony); the other melodies are standard versions of each theme.
const SWAN1 = 'F#5:2 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:1.5 D5:0.5 F#5:1.5 D5:0.5 F#5:1.5 B4:0.5 D5:0.5 B4:0.5 G4:0.5 D5:0.5 ';
const DONNA = 'D#5 D#5 D#5 F#5:0.75 E5:0.25 C#5:2 C#5 C#5 C#5 E5:0.75 D#5:0.25 B4:2 ';
const PLUM = 'G6:0.25 E6:0.25 G6:0.5 F#6:0.5 D#6:0.5 E6:0.5 D6:0.25 D6:0.25 D6:0.5 C#6:0.25 C#6:0.25 C#6:0.5 C6:0.25 C6:0.25 C6:0.5 B5:0.25 E6:0.25 C6:0.25 E6:0.25 B5:1.5 ';
const HUNG = 'C#5:1.5 F#5:0.5 A5:1.5 F#5:0.5 F5:1.5 F#5:0.25 G#5:0.25 F#5:2 D5:1.5 E5:0.25 F#5:0.25 C#5:2 B4:0.25 A4:0.25 A4:0.25 G#4:0.25 G#4:0.75 C#5:0.25 F#4:2 ';
const HUNG_CH = 'F#m:2 F#m:2 C#7:2 F#m:2 Bm:2 F#m:2 C#7:2 F#m:2';

export const SONGS = [
  // ---- 1 · The Alley ----
  { title:'Twinkle Twinkle', composer:'Mozart (variations)', bpm:100, bar:4, hat:1, pickup:0, form:'A', parts:{
    A:'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2' },
    chords:{ A:'C:4 F:2 C:2 F:2 C:2 G:2 C:2 C:2 F:2 C:2 G:2 C:2 F:2 C:2 G:2 C:4 F:2 C:2 F:2 C:2 G:2 C:2' } },
  { title:"Brahms' Lullaby", composer:'Brahms', bpm:84, bar:3, hat:1, pickup:1, form:'AB', parts:{
    A:'E4:0.5 E4:0.5 G4:2 E4:0.5 E4:0.5 G4:2 E4:0.5 G4:0.5 C5:1 B4:1.5 A4:0.5 A4:1 G4:1 D4:0.5 E4:0.5 F4:1 D4:1 D4:0.5 E4:0.5 F4:2 D4:0.5 F4:0.5 B4:0.5 A4:0.5 G4:1 B4:1 C5:2 C4:0.5 C4:0.5',
    B:'C5:2 A4:0.5 F4:0.5 G4:2 E4:0.5 C4:0.5 F4:1 G4:1 A4:1 G4:2 C4:0.5 C4:0.5 C5:2 A4:0.5 F4:0.5 G4:2 E4:0.5 C4:0.5 F4:1 E4:1 D4:1 C4:2' },
    chords:{ A:'N:1 C:3 C:3 F:3 G:3 G7:3 G7:3 G7:3 C:3', B:'F:3 C:3 F:3 C:3 F:3 C:3 G7:3 C:2' } },
  { title:'Morning Mood', composer:'Grieg', bpm:84, bar:3, hat:1.5, pickup:0, form:'ABCDEA', parts:{
    A:'B5:0.5 G#5:0.5 F#5:0.5 E5:0.5 F#5:0.5 G#5:0.5 B5:0.5 G#5:0.5 F#5:0.5 E5:0.5 F#5:0.5 G#5:0.5 B5:0.5 G#5:0.5 B5:0.5 C#6:0.5 G#5:0.5 C#6:0.5 B5:0.5 G#5:0.5 F#5:0.5 E5:1.5',
    B:'B4:0.5 G#4:0.5 F#4:0.5 E4:0.5 F#4:0.5 G#4:0.5 B4:0.5 G#4:0.5 F#4:0.5 E4:0.5 F#4:0.5 G#4:0.5 B4:0.5 G#4:0.5 B4:0.5 C#5:0.5 G#4:0.5 C#5:0.5 D#5:0.5 C5:0.5 A#4:0.5 G#4:1.5',
    C:'D#6:0.5 C6:0.5 A#5:0.5 G#5:0.5 A#5:0.5 C6:0.5 D#6:0.5 C6:0.5 A#5:0.5 G#5:0.5 A#5:0.5 C6:0.5 D#6:0.5 C6:0.5 D#6:0.5 E6:0.5 C6:0.5 E6:0.5 D#6:0.5 C6:0.5 A#5:0.5 G#5:1.5',
    D:'D#5:0.5 C5:0.5 A#4:0.5 G#4:0.5 A#4:0.5 C5:0.5 D#5:0.5 C5:0.5 A#4:0.5 G#4:0.5 A#4:0.5 C5:0.5 D#5:0.5 C5:0.5 D#5:0.5 E5:0.5 C#5:0.5 E5:0.5 F#5:0.5 D#5:0.5 C#5:0.5 B4:1.5',
    E:'F#6:0.5 D#6:0.5 C#6:0.5 B5:0.5 C#6:0.5 D#6:0.5 D#6:3 F#6:0.5 D#6:0.5 B5:2 F#6:0.5 D#6:0.5 B5:0.5 B4:1.5' },
    chords:{ A:'E:3 E:3 E:1.5 A:1.5 B:1.5 E:1.5', B:'E:3 E:3 E:1.5 C#m:1.5 D#:1.5 G#:1.5', C:'G#:3 G#:3 G#:1.5 C#:1.5 D#:1.5 G#:1.5',
      D:'G#:3 G#:3 G#:1.5 C#m:1.5 F#:1.5 B:1.5', E:'B:3 B7:3 E:3 B7:1.5 E:1.5' } },
  { title:'Ode to Joy', composer:'Beethoven', bpm:112, bar:4, hat:1, pickup:0, form:'ABCB', parts:{
    A:'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2',
    B:'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2',
    C:'D4 D4 E4 C4 D4 E4:0.5 F4:0.5 E4 C4 D4 E4:0.5 F4:0.5 E4 D4 C4 D4 G3:2' },
    chords:{ A:'C:4 G:4 C:4 G:4', B:'C:4 G:4 C:4 G:2 C:2', C:'G:2 C:2 G:2 C:2 G:2 C:2 G:4' } },
  // ---- 2 · The Rooftop ----
  { title:'Minuet in G', composer:'Petzold (attr. Bach)', bpm:116, bar:3, hat:1, pickup:0, form:'ABCD', parts:{
    A:'D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5 G4 G4 E5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 G4 G4 C5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 B4 C5:0.5 B4:0.5 A4:0.5 G4:0.5 F#4 G4:0.5 A4:0.5 B4:0.5 G4:0.5 A4:3',
    B:'D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5 G4 G4 E5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 G4 G4 C5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 B4 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 G4:3',
    C:'B5 G5:0.5 A5:0.5 B5:0.5 G5:0.5 A5 D5:0.5 E5:0.5 F#5:0.5 D5:0.5 G5 E5:0.5 F#5:0.5 G5:0.5 D5:0.5 C#5 B4:0.5 C#5:0.5 A4 A4:0.5 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 F#5 E5 F#5 A4 C#5 D5:3',
    D:'D5 G4:0.5 F#4:0.5 G4 E5 G4:0.5 F#4:0.5 G4 D5 C5 B4 A4:0.5 G4:0.5 F#4:0.5 G4:0.5 A4 D4:0.5 E4:0.5 F#4:0.5 G4:0.5 A4:0.5 B4:0.5 C5 B4 A4 B4:0.5 D5:0.5 G4 F#4 G4:3' },
    chords:{ A:'G:3 G:3 C:3 G:3 C:3 G:3 D:3 D:3', B:'G:3 G:3 C:3 G:3 C:3 G:3 D:3 G:3', C:'G:3 D:3 Em:3 A:3 D:3 G:3 A7:3 D:3', D:'G:3 C:3 G:3 D:3 D:3 Am:3 D:3 G:3' } },
  { title:'Canon in D', composer:'Pachelbel', bpm:72, bar:4, hat:1, pickup:0, form:'ABCD', parts:{
    A:'F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2',
    B:'D5 C#5 B4 A4 G4 F#4 G4 E4 D5 C#5 B4 A4 G4 F#4 G4 A4',
    C:'D4:0.5 F#4:0.5 A4:0.5 G4:0.5 F#4:0.5 D4:0.5 F#4:0.5 E4:0.5 D4:0.5 B3:0.5 D4:0.5 A4:0.5 G4:0.5 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 D4:0.5 E4:0.5 C#5:0.5 D5:0.5 F#5:0.5 A5:0.5 A4:0.5 B4:0.5 G4:0.5 A4:0.5 F#4:0.5 D4:0.5 D5:0.5 D5:1',
    D:'F#5 D5:0.5 E5:0.5 F#5 D5:0.5 E5:0.5 F#5:0.5 A4:0.5 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5:0.5 F#5 D5:0.5 E5:0.5 F#5 C#5:0.5 D5:0.5 E5:0.5 A4:0.5 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5:0.5' },
    chords:{ A:'D:2 A:2 Bm:2 F#m:2 G:2 D:2 G:2 A:2', B:'D:2 A:2 Bm:2 F#m:2 G:2 D:2 G:2 A:2', C:'D:2 A:2 Bm:2 F#m:2 G:2 D:2 G:2 A:2', D:'D:2 A:2 Bm:2 F#m:2 G:2 D:2 G:2 A:2' } },
  { title:'Swan Lake', composer:'Tchaikovsky', bpm:84, bar:4, hat:1, pickup:0, form:'ABCAB', parts:{
    A: SWAN1 + 'B4:2.5 E5:0.5 D5:0.5 C#5:0.5',
    B: SWAN1 + 'B4:4',
    C:'C#5 D5 E5 F#5:0.5 G5:0.5 A5:1.5 G5:0.5 F#5 G5:0.5 A5:0.5 B5:1.5 A5:0.5 G5 A5:0.5 B5:0.5 C#6:1.5 B5:0.5 F#5:0.5 D5:0.5 C#5:0.5 B4:0.5 ' +
      'C#5 D5 E5 F#5:0.5 G5:0.5 A5:1.5 G5:0.5 F#5 G5:0.5 A5:0.5 B5:1.5 A5:0.5 G5 A5:0.5 B5:0.5 C6:1.5 G5:0.5 E5 G5:0.5 C6:0.5 C#6:1.5 G#5:0.5 C#6:1.5 F#5:0.5' },
    chords:{ A:'Bm:4 Bm:4 Bm:2 G:2 Bm:2 F#:2', B:'Bm:4 Bm:4 Bm:2 G:2 Bm:4', C:'A:4 D:4 G:4 F#:4 A:4 D:4 G:4 C:4 F#:4' } },
  { title:'Symphony No. 5', composer:'Beethoven', bpm:180, bar:4, hat:2, pickup:0, form:'ABABC', parts:{ // units: eighths
    A:'R G4 G4 G4 D#4:4 R F4 F4 F4 D4:8',
    B:'R G4 G4 G4 D#4 G#4 G#4 G#4 G4 D#5 D#5 D#5 C5:4 R G4 G4 G4 D4 G#4 G#4 G#4 G4 F5 F5 F5 D5:4',
    C:'C5:2 R:2 C5:2 R:2 C5:4 R:4' },
    chords:{ A:'Cm:4 Cm:4 G7:4 G7:8', B:'Cm:4 G#:4 Cm:4 Cm:4 G7:4 Fm:4 G7:4 G7:4', C:'C:16' } },
  // ---- 3 · The Jazz Club ----
  { title:'Spring', composer:'Vivaldi', bpm:100, bar:4, hat:1, pickup:0, form:'AAB', parts:{
    A: SPRING,
    B:'B5:0.5 C#6:0.5 B5:0.5 C#6:0.5 B5:0.5 C#6:0.5 B5:1 G#5:0.5 A5:0.5 G#5:0.5 A5:0.5 G#5:0.5 A5:0.5 G#5:1' },
    chords:{ A:'E:4 E:4 E:2 B:2 B:2 E:2', B:'E:4 B7:4' } },
  { title:'Habanera', composer:'Bizet', bpm:96, bar:2, hat:1, pickup:0, form:'ABCD', parts:{
    A:'D5:1.5 C#5:0.5 C5:1 C5:1 B4:0.5 A#4:0.5 A#4:1 A4:1 G#4:1 G4:0.5 F4:0.5 G4:0.5 F4:0.5 E4:1 F4:1 G4:0.5 F4:0.5 E4:1',
    B:'D5:1.5 C#5:0.5 C5:1 C5:1 B4:0.5 A#4:0.5 A#4:1 A4:1 G#4:1 G4:0.5 F4:0.5 G4:0.5 F4:0.5 E4:1 F4:1 E4:0.5 F4:0.5 D4:1',
    C:'A4:1.5 R:0.5 F#4:1.5 R:0.5 A4:0.5 A4:0.5 A4:0.5 G4:0.5 B4:1 A4:1 G4:0.5 A4:0.5 G4:0.5 F#4:0.5 E4:2',
    D:'E4:1.5 R:0.5 G4:1.5 R:0.5 E4:0.5 E4:0.5 E4:0.5 F#4:0.5 G4:1 A4:1 B4:0.5 A4:0.5 G4:0.5 E4:0.5 D4:2' },
    chords:{ A:'Dm:2 Dm:2 Gm:2 Dm:2 A7:2 A7:2 A7:2', B:'Dm:2 Dm:2 Gm:2 Dm:2 A7:2 A7:2 Dm:2', C:'D:2 D:2 D:2 A7:2 A7:2 A7:2', D:'A7:2 A7:2 A7:2 D:2 A7:2 D:2' } },
  { title:'La donna è mobile', composer:'Verdi', bpm:200, bar:3, hat:1, pickup:0, form:'ABC', parts:{ // units: eighths
    A: DONNA + 'D#5 C#5 B4:0.75 C#5:0.25 B4:0.75 A#4:0.25 A#4:2 C#5 B4 G#4:0.75 A#4:0.25 G#4:0.75 F#4:0.25 F#4:2',
    B: DONNA + 'D#5 C#5 B4 B4:0.75 A#4:0.25 A#4:2 C#5 B4 G#4 G#4:0.75 F#4:0.25 F#4:2',
    C:'C#5:0.75 D#5:0.25 C#5 C#5 F#5 C#5:2 D#5:0.75 E5:0.25 D#5 D#5 G#5 D#5:2 F#5:0.75 G#5:0.25 F#5 F#5 G#5:2 F#5 E5:0.75 D#5:1.25 C#5 B4:3' }, // the E-F#-E grace turn is one note here: 0.07 s apart is unplayable
    chords:{ A:'B:3 F#7:3 F#7:3 B:3 B:3 F#7:3 F#7:3 B:3', B:'B:3 F#7:3 F#7:3 B:3 B:3 F#7:3 F#7:3 B:3', C:'F#:3 F#:3 G#m:3 G#m:3 C#7:3 C#7:3 F#7:3 B:3' } },
  { title:'Für Elise', composer:'Beethoven', bpm:220, bar:6, hat:2, pickup:2, form:'AAB', parts:{ // units: sixteenths
    A: ELISE,
    B:'R:2 C5 D5 E5:4 G4 F5 E5 D5:3 F4 E5 D5 C5:3 E4 D5 C5 B4:3 R:4' },
    chords:{ A:'N:2 N:6 Am:6 E:6 Am:6 N:6 Am:6 E:6 Am:4', B:'Am:2 C:6 G:6 Am:6 E:6 E:4' } },
  // ---- 4 · The Opera House ----
  { title:'Eine kleine Nachtmusik', composer:'Mozart', bpm:132, bar:4, hat:1, pickup:0, form:'AB', parts:{
    A:'G5 R:0.5 D5:0.5 G5 R:0.5 D5:0.5 G5:0.5 D5:0.5 G5:0.5 B5:0.5 D6:2 C6 R:0.5 A5:0.5 C6 R:0.5 A5:0.5 C6:0.5 A5:0.5 F#5:0.5 A5:0.5 D5:2',
    B:'G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 D6:0.5 C6:0.5 B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 G5 B5 G5:2' },
    chords:{ A:'G:4 G:4 D7:4 D7:4', B:'G:4 D7:2 G:2 D7:4 G:4' } },
  { title:'In the Hall of the Mountain King', composer:'Grieg', bpm:220, bar:8, hat:2, pickup:0, form:'AB', accel:1.08, parts:{ // units: eighths, faster every repeat
    A:'B3 C#4 D4 E4 F#4 D4 F#4:2 F4 C#4 F4:2 E4 C4 E4:2 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 A4:4',
    B:'F#4 G#4 A#4 B4 C#5 A#4 C#5:2 D5 A#4 D5:2 C#5 A#4 C#5:2 F#4 G#4 A#4 B4 C#5 A#4 C#5 D5 C#5 A#4 F#4 A#4 C#5:4' },
    chords:{ A:'Bm:8 C#:4 C:4 Bm:8 D:8', B:'F#:8 A#:4 F#:4 F#:8 F#:8' } },
  { title:'Dance of the Sugar Plum Fairy', composer:'Tchaikovsky', bpm:72, bar:2, hat:1, pickup:0, form:'A', parts:{
    A:'R:0.5 ' + PLUM + 'G5:0.25 E5:0.25 G5:0.5 F#5:0.5 C6:0.5 B5:0.5 G6:0.25 G6:0.25 G6:0.5 F#6:0.25 F#6:0.25 F#6:0.5 E6:0.25 E6:0.25 E6:0.5 D#6:0.25 F#6:0.25 E6:0.25 F#6:0.25 D#6:1.5 ' +
      PLUM + 'E6:0.25 C#6:0.25 E6:0.5 D#6:1 D6:0.25 B5:0.25 D6:0.5 C#6:1 C6:0.25 A5:0.25 C6:0.5 B5:1 B5:0.125 D#6:0.125 F#6:0.125 B6:0.125 E6:1 ' +
      'C#6:0.5 D#6:0.5 E6:0.5 F#6:0.5 G6:0.5 E6:0.5 D#6:3' },
    chords:{ A:'Em:2 B7:0.5 Em:0.5 Em7:1 A7:1 Am:1 Em:2 Em:2 C:1 Em:1 F#7:2 B:2 Em:2 B7:0.5 Em:0.5 Em7:1 A7:1 Am:1 Em:2 ' +
      'A:2 B7:1 Bm:1 A:1 Am:1 B7:1 Em:1 F#7:1 B:1 Em:1 B7:1 B7:2' } }, // follows the chromatic inner line over the E pedal
  { title:'Hungarian Dance No. 5', composer:'Brahms', bpm:112, bar:2, hat:1, pickup:0, form:'ABCAB', tempo:{ C:0.8 }, parts:{ // C is the slower middle section
    A: HUNG,
    B:'C#5:1.5 F#5:0.25 A5:0.25 C#6:1.5 A5:0.5 G#5:1.5 A5:0.25 B5:0.25 A5:2 D5:0.25 E5:0.25 F#5:0.25 D5:0.25 C#5:0.25 D5:0.25 E5:0.25 C#5:0.25 ' +
      'B4:0.25 C#5:0.25 D5:0.25 B4:0.25 A4:0.25 B4:0.25 C#5:0.25 A4:0.25 B4:0.25 A4:0.25 A4:0.25 G#4:0.25 G#4:0.75 C#5:0.25 F#4:1 F#5:1',
    C:'C#6 C#6 D6:1.5 C#6:0.5 B5 A#5:0.5 B5:0.5 C#6:0.25 B5:0.25 A#5:0.25 C#6:0.25 B5 B5 B5 C#6:1.5 B5:0.5 A5 G#5:0.5 A5:0.5 B5:0.25 A5:0.25 G#5:0.25 B5:0.25 A5' },
    chords:{ A: HUNG_CH, B: HUNG_CH, C:'F#7:2 Bm:2 F#7:2 Bm:2 E7:2 A:2 E7:2 A:2' } },
  // ---- 5 · The Stadium ----
  { title:'Rondo alla Turca', composer:'Mozart', bpm:360, bar:8, hat:2, pickup:0, form:'AAB', parts:{ // units: sixteenths
    A:'B4 A4 G#4 A4 C5:4 D5 C5 B4 C5 E5:4 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6:8 A5:2 C6:2 B5:2 A5:2 G#5:2 A5:2 B5:2 A5:2 G#5:2 A5:2 B5:2 A5:2 G#5:2 F#5:2 E5:8',
    B:'C#5:2 D5:2 E5:4 E5:2 F#5 E5 D5 C#5 B4:2 C#5:2 D5:2 E5:4 E5:2 F#5 E5 D5 C#5 B4:2 A4:2 C#5:2 E5:2 A5:2 G#5:2 F#5:2 E5:4' },
    chords:{ A:'Am:8 E7:8 Am:8 Am:8 Am:8 E:8 Am:8 E:8 E:8', B:'A:8 E7:8 A:8 E7:8 A:8 E7:8' }, figuration:true },
  { title:'William Tell Overture', composer:'Rossini', bpm:240, bar:4, hat:1, pickup:0, form:'AAB', parts:{ // units: eighths
    A: TELL1 + 'E4:0.5 E4:0.5 E4 E4:0.5 E4:0.5 A4 C#5:0.5 C#5:0.5 B4 G#4 E4 ' + TELL1 + 'E4:0.5 E4:0.5 A4 A4:0.5 C#5:0.5 E5 A4:4',
    B:'A4:0.5 A4:0.5 A4 A4:0.5 A4:0.5 A4 A4:0.5 A4:0.5 D5 E5 F#5 A4:0.5 A4:0.5 A4 A4:0.5 A4:0.5 D5 F#5:0.5 F#5:0.5 E5 C#5 A4' },
    chords:{ A:'A:4 A:4 A:4 E:4 A:4 A:4 E:4 A:4', B:'D:4 D:4 D:4 A:4' } },
  { title:'Can-Can', composer:'Offenbach', bpm:150, bar:2, hat:1, pickup:0, form:'AB', parts:{
    A:'C4:2 D4:0.5 F4:0.5 E4:0.5 D4:0.5 G4 G4 G4:0.5 A4:0.5 E4:0.5 F4:0.5 D4 D4 D4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:0.5 ' +
      'C4:2 D4:0.5 F4:0.5 E4:0.5 D4:0.5 G4 G4 G4:0.5 A4:0.5 E4:0.5 F4:0.5 D4 D4 D4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5 G4:0.5 D4:0.5 E4:0.5 C4:2',
    B:'G4:0.5 G4:0.5 C5 C5:0.5 C5:0.5 D5:0.5 C5:0.5 B4 B4 B4:0.5 D5:0.5 C5:0.5 B4:0.5 A4 A4 A4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:0.5' },
    chords:{ A:'C:2 G7:2 G7:2 C:2 G7:2 G7:2 C:2 G7:2 C:2 G7:2 G7:2 C:2 G7:2 G7:2 C:1 G7:1 C:2', B:'C:2 C:2 G:2 G:2 D7:2 D7:2 G:2 D7:2' } },
  { title:'Flight of the Bumblebee', composer:'Rimsky-Korsakov', bpm:380, bar:8, hat:4, pickup:0, form:'ABC', parts:{ // units: sixteenths
    A:'E5 D#5 D5 C#5 D5 C#5 C5 B4 C5 B4 A#4 A4 G#4 G4 F#4 F4 E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 C#4 D4 D#4 E4 D#4 D4 C#4',
    B:'E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 C#4 D4 D#4 E4 F4 E4 D#4 E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 C#4 D4 D#4 E4 F4 E4 D#4',
    C:'A4 G#4 G4 F#4 G4 F#4 F4 E4 F4 E4 D#4 D4 C#4 C4 B3 A#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 E4 D#4 E4 F4 E4 D#4 E4' },
    chords:{ A:'Am:8 E7:8 Am:8 E7:8', B:'Am:8 E7:8 Am:8 E7:8', C:'Dm:8 Am:8 E7:8 Am:8' }, figuration:true }, // chromatic runs: downbeats are passing notes
];
