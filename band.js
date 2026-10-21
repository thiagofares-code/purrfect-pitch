// The backing band: synthesised instruments (Web Audio, no samples) playing each song's chord chart in the
// style of the venue. Called once per pulse by the game's scheduler, a little ahead of time.
//   Alley: acoustic guitar + finger snaps · Rooftop: ukulele, marimba, shaker · Jazz Club: walking bass, brushes,
//   piano comping · Opera House: strings, harp, timpani · Stadium: drums, electric bass, synth strings, crash
export function makeBand(ctx, out, noise, place){
  const bus = ctx.createGain(); bus.gain.value = 0.5; bus.connect(out); // under the choir
  // where each instrument sits on stage (sound comes from there)
  const at = {}; for (const [k, x, y, z] of [['drums', 0, 0.8, 2.6], ['bass', -3.4, 1, 1.2], ['chords', 3.4, 1, 1.2], ['stringsL', -5, 2.5, -1], ['stringsR', 5, 2.5, -1], ['harp', -4.2, 1.2, -0.5]])
    { at[k] = place(x, y, z); at[k].connect(bus); }
  const hz = m => 440 * 2 ** ((m - 69)/12);
  const env = (g, t, peak, attack, decay, sustain = 0.0001, hold = 0) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold); g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + attack + hold + decay); };
  const osc = (type, f, t, dur, dest, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
  const noiseHit = (t, dur, type, f, q, peak, dest, attack = 0.002) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, peak, attack, dur); s.connect(fl).connect(g).connect(dest); s.start(t, Math.random()*1.5); s.stop(t + attack + dur + 0.05); };
  // ---- instruments ----
  const pluck = (t, m, dur, vel, dest, bright = 2600) => { const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(bright, t); f.frequency.exponentialRampToValueAtTime(300, t + dur); env(g, t, vel, 0.004, dur);
    osc('sawtooth', hz(m), t, dur, f); osc('triangle', hz(m), t, dur, f, 5); f.connect(g).connect(dest); };
  const keys = (t, m, dur, vel, dest) => { const g = ctx.createGain(); env(g, t, vel, 0.006, dur, vel*0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    osc('triangle', hz(m), t, dur + 0.3, g); osc('sine', hz(m)*2, t, dur + 0.3, g); g.connect(dest); };
  const pad = (t, m, dur, vel, dest) => { const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.35, dur*0.4)); g.gain.setValueAtTime(vel, t + dur*0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.35);
    osc('sawtooth', hz(m), t, dur + 0.35, f, -7); osc('sawtooth', hz(m), t, dur + 0.35, f, 7); f.connect(g).connect(dest); };
  const bell = (t, m, vel, dest, decay = 0.5) => { const g = ctx.createGain(), g2 = ctx.createGain(); env(g, t, vel, 0.002, decay); env(g2, t, vel*0.3, 0.002, decay*0.3);
    osc('sine', hz(m), t, decay, g); osc('sine', hz(m)*4, t, decay*0.3, g2); g.connect(dest); g2.connect(dest); };
  const harp = (t, m, vel, dest) => { const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; env(g, t, vel, 0.003, 1.4);
    osc('triangle', hz(m), t, 1.4, f); f.connect(g).connect(dest); };
  const bassNote = (t, m, dur, vel, dest, type = 'triangle', cut = 500) => { const f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = cut;
    env(g, t, vel, 0.008, dur*0.9, vel*0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); osc(type, hz(m), t, dur, f); osc('sine', hz(m), t, dur, f); f.connect(g).connect(dest); };
  const kick = (t, vel = 0.8) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    env(g, t, vel, 0.002, 0.18); o.connect(g).connect(at.drums); o.start(t); o.stop(t + 0.25); };
  const snare = (t, vel = 0.4) => { noiseHit(t, 0.16, 'bandpass', 1900, 0.8, vel, at.drums); const g = ctx.createGain(); env(g, t, vel*0.6, 0.002, 0.08); osc('triangle', 190, t, 0.1, g); g.connect(at.drums); };
  const hat = (t, vel = 0.12) => noiseHit(t, 0.05, 'highpass', 7500, 0.7, vel, at.drums);
  const crash = t => noiseHit(t, 1.6, 'highpass', 4500, 0.5, 0.35, at.drums);
  const brush = (t, vel = 0.12) => noiseHit(t, 0.22, 'lowpass', 3500, 0.6, vel, at.drums, 0.03);
  const ride = t => { noiseHit(t, 0.35, 'bandpass', 6500, 2, 0.07, at.drums); };
  const snap = t => { noiseHit(t, 0.03, 'highpass', 2500, 1, 0.35, at.chords); };
  const shaker = (t, vel = 0.07) => noiseHit(t, 0.06, 'highpass', 5500, 0.8, vel, at.chords, 0.01);
  const timpani = (t, m, vel = 0.6) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(hz(m)*1.03, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.1);
    env(g, t, vel, 0.004, 1.3); o.connect(g).connect(at.drums); o.start(t); o.stop(t + 1.4); };
  // ---- voicings ----
  const near = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12;            // the chord tone just above `lo`
  const voicing = (c, lo) => c.tones.map(pc => near(pc, lo)).sort((a, b) => a - b);
  const root = (c, lo = 36) => near(c.root, lo);
  const strum = (t, c, vel, dest, lo, bright, dur, up = false) => voicing(c, lo).concat(near(c.root, lo + 12))
    .forEach((m, i, a) => pluck(t + (up ? a.length - 1 - i : i)*0.012, m, dur, vel, dest, bright));
  let walk = 0;
  // ---- one pulse of the band. ev: { t, len (s), p, P (pulses per bar), chord, nextChord, bar (s), section, half } ----
  function play(venue, ev){
    const { t, len, p, P, chord: c, section } = ev, down = p === 0, half = len >= 0.3, back = P % 2 ? p > 0 : p % 2 === 1;
    const tt = t + len/2; // the half-pulse ("and")
    if (venue === 0){ // The Alley
      if (back) snap(t);
      if (!c) return;
      strum(t, c, down ? 0.11 : 0.08, at.chords, 52, 2400, Math.min(1.2, len*1.6));
      if (half) strum(tt, c, 0.05, at.chords, 52, 1800, len*0.8, true);
      if (down) bassNote(t, root(c, 40), ev.bar*0.6, 0.3, at.bass);
    } else if (venue === 1){ // The Rooftop
      shaker(t, down ? 0.09 : 0.06); if (half) shaker(tt, 0.05);
      if (!c) return;
      strum(t, c, down ? 0.09 : 0.07, at.chords, 60, 3200, Math.min(0.6, len));
      const arp = voicing(c, 67); bell(t, arp[(ev.beat | 0) % arp.length], 0.12, at.harp); if (half) bell(tt, arp[((ev.beat | 0) + 1) % arp.length] + 12, 0.08, at.harp);
      if (down || (P % 2 === 0 && p === P/2)) bassNote(t, root(c, 40), len*1.8, 0.3, at.bass);
    } else if (venue === 2){ // The Jazz Club
      brush(t, back ? 0.13 : 0.08); ride(t); if (half) ride(tt + len*0.08); // a little swing on the "and"
      if (!c) return;
      // walking bass: root on the downbeat, then chord tones, then a step into the next chord
      const n = c.tones.length, target = ev.nextChord ? root(ev.nextChord, 36) : root(c, 36);
      const step = down ? root(c, 36) : p === P - 1 ? target - 1 : near(c.tones[(walk++ % (n - 1)) + 1], 38);
      bassNote(t, step, len*0.95, 0.4, at.bass, 'triangle', 700);
      if (back || (P === 1)) voicing(c, 57).concat(near((c.root + 10) % 12, 57)).forEach(m => keys(t + len*0.08, m, len*0.6, 0.05, at.chords)); // comping with a 7th
    } else if (venue === 3){ // The Opera House
      if (section && c) for (let k=0; k<6; k++) timpani(t + k*0.07, root(c, 40), 0.15 + k*0.05); // a timpani roll opens each section
      if (!c) return;
      if (down) { voicing(c, 55).forEach((m, i) => pad(t, m, ev.bar, 0.035, i % 2 ? at.stringsR : at.stringsL)); bassNote(t, root(c, 36), ev.bar, 0.28, at.bass, 'sawtooth', 450); }
      const arp = voicing(c, 60).concat(voicing(c, 72)); harp(t, arp[(p*2) % arp.length], 0.1, at.harp); if (half) harp(tt, arp[(p*2 + 1) % arp.length], 0.08, at.harp);
    } else { // The Stadium
      if (section) crash(t);
      if (down || (P % 2 === 0 && p === P/2)) kick(t); if (back) snare(t);
      hat(t, 0.1); if (half) hat(tt, 0.07);
      if (!c) return;
      bassNote(t, root(c, 36), len*0.5, 0.35, at.bass, 'sawtooth', 900); if (half) bassNote(tt, root(c, 36) + (p % 2 ? 12 : 0), len*0.45, 0.3, at.bass, 'sawtooth', 900);
      if (down) voicing(c, 60).forEach((m, i) => pad(t, m, ev.bar, 0.03, i % 2 ? at.stringsR : at.stringsL));
    }
  }
  return { play };
}
