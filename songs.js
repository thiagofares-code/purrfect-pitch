// Career setlist: public-domain melodies, written out as NOTE:duration tokens (R = rest).
// Durations are in the song's own unit (quarters unless noted); bpm counts those units per minute.
// `form` plays the parts in order and repeats until the song lasts about two minutes.
// Optional: `tempo` speeds up single parts, `accel` speeds up every repeat of the form.

export const TIERS = [
  { venue:'The Alley',       rank:'Kitten',    crowd:40,  bg:0x0d1220, curtain:0x666677, beams:0, drummer:false },
  { venue:'The Rooftop',     rank:'House Cat', crowd:110, bg:0x160d2a, curtain:0x9977bb, beams:2, drummer:true },
  { venue:'The Jazz Club',   rank:'Street Cat',crowd:200, bg:0x1c100a, curtain:0xcc8855, beams:2, drummer:true },
  { venue:'The Opera House', rank:'Show Cat',  crowd:340, bg:0x1a0508, curtain:0xffffff, beams:4, drummer:true },
  { venue:'The Stadium',     rank:'Superstar', crowd:565, bg:0x050814, curtain:0x5566bb, beams:4, drummer:true },
];
export const STARS_TO_UNLOCK = 8; // of the 12 available in the previous venue
export const TARGET_SECS = 110;   // the form repeats until the song reaches this length

const NAMES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
export const midi = n => { const m = n.match(/^([A-G])(#?)(-?\d)$/); return 12*(+m[3]+1) + NAMES[m[1]] + (m[2] ? 1 : 0); };

// -> notes with beat, dur (beats), t / secs (seconds from song start), midi, lane; plus tempo segments
export function parseSong(song){
  const notes = [], segs = []; let beat = 0, t = 0;
  for (let r = 0; t < TARGET_SECS; r++){
    for (const key of song.form){
      const spb = 60 / (song.bpm * (song.tempo?.[key] || 1) * Math.min(2, (song.accel || 1) ** r));
      segs.push({ b: beat, t, spb });
      for (const tok of song.parts[key].trim().split(/\s+/)){
        const [n, d] = tok.split(':'); const dur = d ? +d : 1;
        if (n !== 'R') notes.push({ beat, dur, t, secs: dur*spb, midi: midi(n) });
        beat += dur; t += dur*spb;
      }
    }
  }
  // lanes ordered low→high pitch so the highway "sounds" like the melody
  const pitches = [...new Set(notes.map(n => n.midi))].sort((a, b) => a - b);
  for (const n of notes) n.lane = Math.min(3, Math.floor(pitches.indexOf(n.midi)*4/pitches.length));
  return { notes, length: beat, secs: t, segs };
}
const segAt = (segs, key, v) => { let s = segs[0]; for (const x of segs) { if (x[key] > v) break; s = x; } return s; };
export const timeAt = (segs, b) => { const s = segAt(segs, 'b', b); return s.t + (b - s.b)*s.spb; };
export const beatAt = (segs, t) => { const s = segAt(segs, 't', t); return s.b + (t - s.t)/s.spb; };
export const spbAt = (segs, b) => segAt(segs, 'b', b).spb;

const ELISE = 'E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2 R C4 E4 A4 B4:2 R E4 G#4 B4 C5:2 R E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2 R C4 E4 A4 B4:2 R E4 C5 B4 A4:4';
const SPRING = 'E5:0.5 G#5:0.5 G#5:0.5 G#5:0.5 F#5:0.25 E5:0.25 B5:1.5 B5:0.25 A5:0.25 G#5:0.5 G#5:0.5 G#5:0.5 F#5:0.25 E5:0.25 B5:1.5 ' +
  'B5:0.25 A5:0.25 G#5:0.5 A5:0.5 B5:0.5 A5:0.5 G#5:0.5 F#5:1 G#5:0.5 E5:0.5 F#5:0.5 D#5:0.5 E5:2';
const TELL1 = 'E4:0.5 E4:0.5 E4 E4:0.5 E4:0.5 E4 E4:0.5 E4:0.5 A4 B4 C#5 ';

export const SONGS = [
  // ---- 1 · The Alley ----
  { title:'Twinkle Twinkle', composer:'Mozart (variations)', bpm:100, bar:4, hat:1, pickup:0, form:'A', parts:{
    A:'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2' } },
  { title:"Brahms' Lullaby", composer:'Brahms', bpm:84, bar:3, hat:1, pickup:1, form:'AB', parts:{
    A:'E4:0.5 E4:0.5 G4:2 E4:0.5 E4:0.5 G4:2 E4:0.5 G4:0.5 C5:1 B4:1.5 A4:0.5 A4:1 G4:1 D4:0.5 E4:0.5 F4:1 D4:1 D4:0.5 E4:0.5 F4:2 D4:0.5 F4:0.5 B4:0.5 A4:0.5 G4:1 B4:1 C5:2 C4:0.5 C4:0.5',
    B:'C5:2 A4:0.5 F4:0.5 G4:2 E4:0.5 C4:0.5 F4:1 G4:1 A4:1 G4:2 C4:0.5 C4:0.5 C5:2 A4:0.5 F4:0.5 G4:2 E4:0.5 C4:0.5 F4:1 E4:1 D4:1 C4:2' } },
  { title:'Morning Mood', composer:'Grieg', bpm:80, bar:3, hat:1.5, pickup:0, form:'ABA', parts:{
    A:'G4:1.5 E4:0.5 D4:0.5 C4:0.5 D4:0.5 E4:0.5 G4:1.5 E4:0.5 D4:0.5 C4:0.5 D4:0.5 E4:0.5 D4:0.5 E4:0.5 G4:0.5 E4:0.5 G4:0.5 A4:0.5 E4:0.5 A4:0.5 G4:0.5 E4:0.5 D4:0.5 C4:4.5',
    B:'C5:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 C5:1.5 A4:0.5 G4:0.5 F4:0.5 G4:0.5 A4:0.5 G4:0.5 A4:0.5 C5:0.5 A4:0.5 C5:0.5 D5:0.5 A4:0.5 D5:0.5 C5:0.5 A4:0.5 G4:0.5 F4:4.5' } },
  { title:'Ode to Joy', composer:'Beethoven', bpm:112, bar:4, hat:1, pickup:0, form:'ABCB', parts:{
    A:'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2',
    B:'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2',
    C:'D4 D4 E4 C4 D4 E4:0.5 F4:0.5 E4 C4 D4 E4:0.5 F4:0.5 E4 D4 C4 D4 G3:2' } },
  // ---- 2 · The Rooftop ----
  { title:'Minuet in G', composer:'Petzold (attr. Bach)', bpm:116, bar:3, hat:1, pickup:0, form:'ABCD', parts:{
    A:'D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5 G4 G4 E5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 G4 G4 C5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 B4 C5:0.5 B4:0.5 A4:0.5 G4:0.5 F#4 G4:0.5 A4:0.5 B4:0.5 G4:0.5 A4:3',
    B:'D5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5 G4 G4 E5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 G4 G4 C5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 B4 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 G4:3',
    C:'B5 G5:0.5 A5:0.5 B5:0.5 G5:0.5 A5 D5:0.5 E5:0.5 F#5:0.5 D5:0.5 G5 E5:0.5 F#5:0.5 G5:0.5 D5:0.5 C#5 B4:0.5 C#5:0.5 A4 A4:0.5 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 F#5 E5 F#5 A4 C#5 D5:3',
    D:'D5 G4:0.5 F#4:0.5 G4 E5 G4:0.5 F#4:0.5 G4 D5 C5 B4 A4:0.5 G4:0.5 F#4:0.5 G4:0.5 A4 D4:0.5 E4:0.5 F#4:0.5 G4:0.5 A4:0.5 B4:0.5 C5 B4 A4 B4:0.5 D5:0.5 G4 F#4 G4:3' } },
  { title:'Canon in D', composer:'Pachelbel', bpm:72, bar:4, hat:1, pickup:0, form:'ABCD', parts:{
    A:'F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2',
    B:'D5 C#5 B4 A4 G4 F#4 G4 E4 D5 C#5 B4 A4 G4 F#4 G4 A4',
    C:'D4:0.5 F#4:0.5 A4:0.5 G4:0.5 F#4:0.5 D4:0.5 F#4:0.5 E4:0.5 D4:0.5 B3:0.5 D4:0.5 A4:0.5 G4:0.5 B4:0.5 A4:0.5 G4:0.5 F#4:0.5 D4:0.5 E4:0.5 C#5:0.5 D5:0.5 F#5:0.5 A5:0.5 A4:0.5 B4:0.5 G4:0.5 A4:0.5 F#4:0.5 D4:0.5 D5:0.5 D5:1',
    D:'F#5 D5:0.5 E5:0.5 F#5 D5:0.5 E5:0.5 F#5:0.5 A4:0.5 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5:0.5 F#5 D5:0.5 E5:0.5 F#5 C#5:0.5 D5:0.5 E5:0.5 A4:0.5 B4:0.5 C#5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5:0.5' } },
  { title:'Swan Lake', composer:'Tchaikovsky', bpm:80, bar:4, hat:1, pickup:0, form:'AABA', parts:{
    A:'F#4:3 B3:0.5 C#4:0.5 D4:0.5 E4:0.5 F#4:3 D4 F#4:3 D4 F#4:3 B3 D4 B3 G3 D4 B3:3',
    B:'B4:3 E4:0.5 F#4:0.5 G4:0.5 A4:0.5 B4:3 G4 B4:3 G4 B4:3 E4 G4 E4 C4 G4 E4:3' } },
  { title:'Symphony No. 5', composer:'Beethoven', bpm:180, bar:4, hat:2, pickup:0, form:'ABABC', parts:{ // units: eighths
    A:'R G4 G4 G4 D#4:4 R F4 F4 F4 D4:8',
    B:'R G4 G4 G4 D#4 G#4 G#4 G#4 G4 D#5 D#5 D#5 C5:4 R G4 G4 G4 D4 G#4 G#4 G#4 G4 F5 F5 F5 D5:4',
    C:'C5:2 R:2 C5:2 R:2 C5:4 R:4' } },
  // ---- 3 · The Jazz Club ----
  { title:'Spring', composer:'Vivaldi', bpm:100, bar:4, hat:1, pickup:0, form:'AAB', parts:{
    A: SPRING,
    B:'B5:0.5 C#6:0.5 B5:0.5 C#6:0.5 B5:0.5 C#6:0.5 B5:1 G#5:0.5 A5:0.5 G#5:0.5 A5:0.5 G#5:0.5 A5:0.5 G#5:1' } },
  { title:'Habanera', composer:'Bizet', bpm:96, bar:2, hat:1, pickup:0, form:'ABCD', parts:{
    A:'D5:1.5 C#5:0.5 C5:1 C5:1 B4:0.5 A#4:0.5 A#4:1 A4:1 G#4:1 G4:0.5 F4:0.5 G4:0.5 F4:0.5 E4:1 F4:1 G4:0.5 F4:0.5 E4:1',
    B:'D5:1.5 C#5:0.5 C5:1 C5:1 B4:0.5 A#4:0.5 A#4:1 A4:1 G#4:1 G4:0.5 F4:0.5 G4:0.5 F4:0.5 E4:1 F4:1 E4:0.5 F4:0.5 D4:1',
    C:'A4:1.5 R:0.5 F#4:1.5 R:0.5 A4:0.5 A4:0.5 A4:0.5 G4:0.5 B4:1 A4:1 G4:0.5 A4:0.5 G4:0.5 F#4:0.5 E4:2',
    D:'E4:1.5 R:0.5 G4:1.5 R:0.5 E4:0.5 E4:0.5 E4:0.5 F#4:0.5 G4:1 A4:1 B4:0.5 A4:0.5 G4:0.5 E4:0.5 D4:2' } },
  { title:'La donna è mobile', composer:'Verdi', bpm:270, bar:3, hat:1, pickup:0, form:'ABCB', parts:{ // units: eighths
    A:'F#4 F#4 F#4 A4:2 G#4 E4:3 R:3 E4 E4 E4 G#4:2 F#4 D#4:3 R:3',
    B:'D#4 D#4 D#4 F#4:2 E4 C#4:3 R:3 B3 C#4 D#4 E4:2 F#4 G#4:2 F#4 B3:3',
    C:'B4 B4 B4 D5:2 C#5 A4:3 R:3 A4 A4 A4 C#5:2 B4 G#4:3 R:3' } },
  { title:'Für Elise', composer:'Beethoven', bpm:220, bar:6, hat:2, pickup:2, form:'AAB', parts:{ // units: sixteenths
    A: ELISE,
    B:'R:2 C5 D5 E5:4 G4 F5 E5 D5:3 F4 E5 D5 C5:3 E4 D5 C5 B4:3 R:4' } },
  // ---- 4 · The Opera House ----
  { title:'Eine kleine Nachtmusik', composer:'Mozart', bpm:132, bar:4, hat:1, pickup:0, form:'AB', parts:{
    A:'G5 R:0.5 D5:0.5 G5 R:0.5 D5:0.5 G5:0.5 D5:0.5 G5:0.5 B5:0.5 D6:2 C6 R:0.5 A5:0.5 C6 R:0.5 A5:0.5 C6:0.5 A5:0.5 F#5:0.5 A5:0.5 D5:2',
    B:'G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 G5 D6:0.5 C6:0.5 B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 G5 B5 G5:2' } },
  { title:'In the Hall of the Mountain King', composer:'Grieg', bpm:220, bar:8, hat:2, pickup:0, form:'AB', accel:1.08, parts:{ // units: eighths, faster every repeat
    A:'B3 C#4 D4 E4 F#4 D4 F#4:2 F4 C#4 F4:2 E4 C4 E4:2 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 A4:4',
    B:'F#4 G#4 A#4 B4 C#5 A#4 C#5:2 D5 A#4 D5:2 C#5 A#4 C#5:2 F#4 G#4 A#4 B4 C#5 A#4 C#5 D5 C#5 A#4 F#4 A#4 C#5:4' } },
  { title:'Dance of the Sugar Plum Fairy', composer:'Tchaikovsky', bpm:96, bar:4, hat:1, pickup:0, form:'AABA', parts:{
    A:'G5:0.5 E5:0.5 G5:0.5 F#5:0.5 D#5 E5 D5:0.5 D5:0.5 D5:0.5 C#5:0.5 C5:0.5 C5:0.5 C5:0.5 B4:0.5 E5:0.5 C5:0.5 E5:0.5 D#5:0.5 A4 B4 G4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:0.5 C5:0.5 B4',
    B:'D5:0.5 B4:0.5 D5:0.5 C#5:0.5 A#4 B4 A4:0.5 A4:0.5 A4:0.5 G#4:0.5 G4:0.5 G4:0.5 G4:0.5 F#4:0.5 B4:0.5 G4:0.5 B4:0.5 A#4:0.5 E4 F#4 D4:0.5 E4:0.5 F#4:0.5 G4:0.5 A4:0.5 G4:0.5 F#4' } },
  { title:'Hungarian Dance No. 5', composer:'Brahms', bpm:120, bar:2, hat:1, pickup:0, form:'AB', tempo:{ B:1.35 }, parts:{ // B is the fast section
    A:'D5:2 G4:0.5 A#4:0.5 D5:0.5 C5:0.5 A#4:0.5 A4:0.5 G4:1 D5:2 G4:0.5 A#4:0.5 D5:0.5 C5:0.5 A#4:0.5 A4:0.5 G4:1 F#4 G4 A4 A#4 C5 A#4 A4:2',
    B:'G5:0.5 F#5:0.5 G5:1 D5:0.5 D#5:0.5 D5:1 A#4:0.5 C5:0.5 A#4:1 G4:1 R:1 G5:0.5 F#5:0.5 G5:1 D5:0.5 D#5:0.5 D5:1 C5:0.5 A#4:0.5 A4:1 G4:2' } },
  // ---- 5 · The Stadium ----
  { title:'Rondo alla Turca', composer:'Mozart', bpm:360, bar:8, hat:2, pickup:0, form:'AAB', parts:{ // units: sixteenths
    A:'B4 A4 G#4 A4 C5:4 D5 C5 B4 C5 E5:4 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6:8 A5:2 C6:2 B5:2 A5:2 G#5:2 A5:2 B5:2 A5:2 G#5:2 A5:2 B5:2 A5:2 G#5:2 F#5:2 E5:8',
    B:'C#5:2 D5:2 E5:4 E5:2 F#5 E5 D5 C#5 B4:2 C#5:2 D5:2 E5:4 E5:2 F#5 E5 D5 C#5 B4:2 A4:2 C#5:2 E5:2 A5:2 G#5:2 F#5:2 E5:4' } },
  { title:'William Tell Overture', composer:'Rossini', bpm:240, bar:4, hat:1, pickup:0, form:'AAB', parts:{ // units: eighths
    A: TELL1 + 'E4:0.5 E4:0.5 E4 E4:0.5 E4:0.5 A4 C#5:0.5 C#5:0.5 B4 G#4 E4 ' + TELL1 + 'E4:0.5 E4:0.5 A4 A4:0.5 C#5:0.5 E5 A4:4',
    B:'A4:0.5 A4:0.5 A4 A4:0.5 A4:0.5 A4 A4:0.5 A4:0.5 D5 E5 F#5 A4:0.5 A4:0.5 A4 A4:0.5 A4:0.5 D5 F#5:0.5 F#5:0.5 E5 C#5 A4' } },
  { title:'Can-Can', composer:'Offenbach', bpm:150, bar:2, hat:1, pickup:0, form:'AB', parts:{
    A:'C4:2 D4:0.5 F4:0.5 E4:0.5 D4:0.5 G4 G4 G4:0.5 A4:0.5 E4:0.5 F4:0.5 D4 D4 D4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:0.5 ' +
      'C4:2 D4:0.5 F4:0.5 E4:0.5 D4:0.5 G4 G4 G4:0.5 A4:0.5 E4:0.5 F4:0.5 D4 D4 D4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5 G4:0.5 D4:0.5 E4:0.5 C4:2',
    B:'G4:0.5 G4:0.5 C5 C5:0.5 C5:0.5 D5:0.5 C5:0.5 B4 B4 B4:0.5 D5:0.5 C5:0.5 B4:0.5 A4 A4 A4:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C5:0.5 B4:0.5 A4:0.5' } },
  { title:'Flight of the Bumblebee', composer:'Rimsky-Korsakov', bpm:380, bar:8, hat:4, pickup:0, form:'ABC', parts:{ // units: sixteenths
    A:'E5 D#5 D5 C#5 D5 C#5 C5 B4 C5 B4 A#4 A4 G#4 G4 F#4 F4 E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 C#4 D4 D#4 E4 D#4 D4 C#4',
    B:'E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 C#4 D4 D#4 E4 F4 E4 D#4 E4 D#4 D4 C#4 D4 C#4 C4 B3 C4 C#4 D4 D#4 E4 F4 E4 D#4',
    C:'A4 G#4 G4 F#4 G4 F#4 F4 E4 F4 E4 D#4 D4 C#4 C4 B3 A#3 A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 E4 D#4 E4 F4 E4 D#4 E4' } },
];
