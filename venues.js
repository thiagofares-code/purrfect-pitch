// Scenery and crowd layouts for the five venues. The stage (14 x 10 m, top at y = 0, centred on the
// player) and the band are shared; each venue adds its own surroundings, a crowd layout, and effects.
// Everything is simple shapes and canvas textures so the Quest browser keeps its frame rate.
//   venue = { group, crowd: [{x,y,z}], curtains:'all'|'back'|'none', sign, fog:[near,far], fx:{fireworks,confetti,fountains},
//             fireworkAt(): Vector3, update(time, dt), screens?: [mesh] }

export function buildVenues({ THREE, scene, add, lamb, basic, canvasTex }){
  const rand = mulberry(7); // fixed seed: the same venue every time
  const R = (a, b) => a + rand()*(b - a);
  const FLOOR = -1.5;       // audience floor height (stage top is 0)
  const noFog = (c, o = {}) => basic(c, { fog:false, ...o });
  const tex = (w, h, draw, rx = 1, ry = 1) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const glow = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const halo = (parent, x, y, z, size, color, opacity = 0.6) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glow, color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false, fog:false })); s.position.set(x, y, z); s.scale.setScalar(size); parent.add(s); return s; };
  const stars = (parent, n, minY) => { const p = new Float32Array(n*3);
    for (let i=0;i<n;i++){ const a = R(0, Math.PI*2), e = R(minY, 1), r = 90; p.set([r*Math.cos(a)*Math.sqrt(1-e*e), r*e, r*Math.sin(a)*Math.sqrt(1-e*e)], i*3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    parent.add(new THREE.Points(g, new THREE.PointsMaterial({ color:0xffffff, size:0.6, fog:false }))); };
  const face = (x, z) => Math.atan2(-x, -z);
  // raked rows in front of the stage (row r has 14 + 1.5r cats)
  const frontRows = (rows, rake = 0.28) => { const out = []; for (let r=0;r<rows;r++){ const n = 14 + Math.floor(r*1.5), z = -7.5 - r*1.3, y = FLOOR + r*rake;
    for (let i=0;i<n;i++) out.push({ x:(i-(n-1)/2)*0.85 + R(-0.1, 0.1), y, z: z + R(-0.15, 0.15) }); } return out; };
  const tiers = (parent, rows, rake, color) => { for (let r=1;r<rows;r++){ const n = 14 + Math.floor(r*1.5), y = FLOOR + r*rake;
    add(new THREE.BoxGeometry(n*0.85+1, y+3, 1.3), lamb(color), 0, (y-3)/2, -7.5 - r*1.3, parent); } };
  const instanced = (parent, geo, mat, mats) => { const m = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((x, i) => m.setMatrixAt(i, x)); parent.add(m); return m; };
  const M = (x, y, z, sx = 1, sy = sx, sz = sx, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
  const venues = [];

  // ---------------- 1 · The Alley: brick walls, fire escape, moon, string lights, cats in windows ----------------
  { const g = new THREE.Group(), crowd = [];
    const brick = tex(256, 128, (c, w, h) => { c.fillStyle = '#3a1f1a'; c.fillRect(0, 0, w, h);
      for (let row=0; row<8; row++) for (let col=-1; col<5; col++){ const x = col*64 + (row%2)*32, y = row*16;
        c.fillStyle = `hsl(${8+R(-4,4)},${35+R(-8,8)}%,${22+R(-6,6)}%)`; c.fillRect(x+1, y+1, 62, 14); } }, 6, 6);
    add(new THREE.PlaneGeometry(40, 70).rotateX(-Math.PI/2), lamb(0x1c1c22), 0, FLOOR, -18, g); // asphalt
    for (const s of [-1, 1]) { const w = add(new THREE.PlaneGeometry(34, 14), new THREE.MeshLambertMaterial({ map:brick }), 8*s, 5.5, -11, g); w.rotation.y = -s*Math.PI/2; }
    add(new THREE.PlaneGeometry(16, 14), new THREE.MeshLambertMaterial({ map:brick }), 0, 5.5, 6, g).rotation.y = Math.PI;
    // windows: some lit, a cat on every lit sill
    for (const s of [-1, 1]) for (const z of [-8, -11.5, -15, -18.5, -22]) for (const y of [2.6, 5.6]) {
      const lit = rand() < 0.6, wv = add(new THREE.PlaneGeometry(1.6, 1.4), basic(lit ? 0xffc46b : 0x101018), 7.95*s, y + 0.7, z, g); wv.rotation.y = -s*Math.PI/2;
      if (lit) { crowd.push({ x: 7.45*s, y, z }); halo(g, 7.6*s, y + 0.7, z, 3, 0xffb050, 0.25); } }
    // fire escape on the left wall
    for (const y of [3.2, 6.2, 9.2]) { add(new THREE.BoxGeometry(1.1, 0.06, 4), lamb(0x22252b), -7.4, y, -13, g);
      for (const z of [-15, -11]) add(new THREE.BoxGeometry(0.04, 0.9, 0.04), lamb(0x22252b), -6.85, y + 0.45, z, g);
      add(new THREE.BoxGeometry(0.04, 0.04, 4), lamb(0x22252b), -6.85, y + 0.9, -13, g); }
    for (const y of [3.2, 6.2]) { const l = add(new THREE.BoxGeometry(0.06, 3.4, 0.5), lamb(0x22252b), -7.2, y + 1.5, -14, g); l.rotation.x = 0.5; }
    // string lights across the street
    const bulbs = []; for (const z of [-7, -12, -17]) for (let i=0;i<=20;i++){ const x = -7.8 + i*0.78, sag = 1.3*(1 - ((x/7.8)**2)); bulbs.push(M(x, 6.5 - sag, z, 0.07)); }
    const bulbMesh = instanced(g, new THREE.SphereGeometry(1, 8, 6), noFog(0xffffff), bulbs);
    bulbs.forEach((_, i) => bulbMesh.setColorAt(i, new THREE.Color(['#ffd27a', '#ff7aa2', '#7ad7ff', '#b8ff7a'][i % 4])));
    // bins, a street lamp, the moon
    for (const [x, z] of [[-6.6, -9], [-6.4, -10.2], [6.7, -19]]) add(new THREE.CylinderGeometry(0.45, 0.4, 1.1, 16), lamb(0x3d4a3a), x, FLOOR + 0.55, z, g);
    add(new THREE.CylinderGeometry(0.07, 0.09, 5.5, 8), lamb(0x222222), 6.8, FLOOR + 2.75, -10, g);
    add(new THREE.SphereGeometry(0.25, 12, 8), noFog(0xfff0c0), 6.4, FLOOR + 5.4, -10, g); halo(g, 6.4, FLOOR + 5.3, -10, 4, 0xffe2a0, 0.5);
    add(new THREE.SphereGeometry(4, 24, 16), noFog(0xfff6d5), -14, 34, -75, g); halo(g, -14, 34, -75, 26, 0xfff0c0, 0.35);
    stars(g, 300, 0.25);
    crowd.unshift(...frontRows(3, 0).slice(0, 40 - crowd.length).map(p => ({ ...p, x: Math.max(-6, Math.min(6, p.x)) })));
    venues.push({ group:g, crowd, curtains:'none', sign:true, fog:[18, 60], fx:{ fireworks:true, confetti:true },
      fireworkAt: () => new THREE.Vector3(R(-5, 5), R(14, 20), R(-30, -20)), update(){} }); }

  // ---------------- 2 · The Rooftop: dusk sky, city skyline, water tower, blinking antenna ----------------
  { const g = new THREE.Group();
    add(new THREE.SphereGeometry(95, 32, 16), noFog(0xffffff, { side:THREE.BackSide, map: canvasTex(4, 256, (c) => { const r = c.createLinearGradient(0, 0, 0, 256);
      r.addColorStop(0, '#120a2e'); r.addColorStop(0.42, '#3b1a55'); r.addColorStop(0.5, '#a3446a'); r.addColorStop(0.56, '#ff9a5a'); r.addColorStop(1, '#2a1630'); c.fillStyle = r; c.fillRect(0, 0, 4, 256); }) }), 0, 0, 0, g);
    const skyline = canvasTex(2048, 256, (c, w, h) => { for (let x=0; x<w;){ const bw = R(30, 90), bh = R(60, 230);
      c.fillStyle = `hsl(265,30%,${7+R(0,5)}%)`; c.fillRect(x, h-bh, bw, bh);
      for (let wy = h-bh+8; wy < h-6; wy += 12) for (let wx = x+5; wx < x+bw-6; wx += 10) if (rand() < 0.35) { c.fillStyle = rand() < 0.8 ? '#ffd27a' : '#9fe8ff'; c.fillRect(wx, wy, 4, 6); }
      x += bw + R(0, 6); } });
    const city = add(new THREE.CylinderGeometry(70, 70, 34, 64, 1, true), noFog(0xffffff, { side:THREE.BackSide, map:skyline, transparent:true }), 0, -14, 0, g);
    city.material.map.wrapS = THREE.RepeatWrapping; city.material.map.repeat.set(3, 1);
    add(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI/2), lamb(0x3a3438), 0, FLOOR, -14, g); // roof
    for (const [x, z, w, d] of [[-12, -14, 0.4, 30], [12, -14, 0.4, 30], [0, -29, 24.4, 0.4]]) add(new THREE.BoxGeometry(w, 1, d), lamb(0x4a4248), x, FLOOR + 0.5, z, g); // parapet
    const fairy = []; for (let i=0;i<40;i++) fairy.push(M(-12 + (i < 20 ? 0 : 24), FLOOR + 1.1, -28 + (i % 20)*1.4, 0.06));
    instanced(g, new THREE.SphereGeometry(1, 6, 4), noFog(0xfff0b0), fairy);
    // water tower and antenna
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.CylinderGeometry(0.08, 0.08, 4.5, 6), lamb(0x5a4030), 10 + dx, FLOOR + 2.25, -20 + dz, g);
    add(new THREE.CylinderGeometry(1.7, 1.7, 2.8, 20), lamb(0x7a5638), 10, FLOOR + 5.9, -20, g);
    add(new THREE.ConeGeometry(1.9, 1.1, 20), lamb(0x4a3424), 10, FLOOR + 7.85, -20, g);
    add(new THREE.CylinderGeometry(0.05, 0.08, 9, 6), lamb(0x777777), -10, FLOOR + 4.5, -24, g);
    const blink = add(new THREE.SphereGeometry(0.18, 8, 6), noFog(0xff2a2a), -10, FLOOR + 9.1, -24, g), blinkHalo = halo(g, -10, FLOOR + 9.1, -24, 2.5, 0xff3030, 0.8);
    stars(g, 120, 0.55);
    venues.push({ group:g, crowd: frontRows(7, 0).slice(0, 110), curtains:'back', sign:true, fog:[30, 90], fx:{ fireworks:true, confetti:true },
      fireworkAt: () => new THREE.Vector3(R(-30, 30), R(16, 26), R(-60, -35)),
      update(time){ const on = Math.sin(time*3) > 0.3; blink.visible = blinkHalo.visible = on; } }); }

  // ---------------- 3 · The Jazz Club: low ceiling, candle-lit tables, a bar, neon ----------------
  { const g = new THREE.Group(), crowd = [];
    const paper = tex(128, 128, (c, w, h) => { c.fillStyle = '#3a0e14'; c.fillRect(0, 0, w, h); c.fillStyle = '#4e1820';
      for (let y=0; y<h; y+=32) for (let x=(y/32)%2*16; x<w; x+=32) { c.beginPath(); c.arc(x+8, y+16, 7, 0, 7); c.fill(); } }, 10, 3);
    add(new THREE.PlaneGeometry(24, 30).rotateX(-Math.PI/2), lamb(0x2a1a10), 0, FLOOR, -13, g);
    for (const s of [-1, 1]) { const w = add(new THREE.PlaneGeometry(30, 7), new THREE.MeshLambertMaterial({ map:paper }), 11*s, 2, -13, g); w.rotation.y = -s*Math.PI/2; }
    add(new THREE.PlaneGeometry(22, 7), new THREE.MeshLambertMaterial({ map:paper }), 0, 2, -28, g);
    add(new THREE.PlaneGeometry(24, 34).rotateX(Math.PI/2), lamb(0x140c08), 0, 5.5, -11, g); // ceiling
    // round tables with candles; four cats around each
    const tops = [], legs = [], flames = [];
    for (let row=0; row<6; row++) for (let col=0; col<7; col++){ const x = -7.8 + col*2.6 + (row%2)*0.6, z = -7.6 - row*2.9;
      tops.push(M(x, FLOOR + 0.75, z)); legs.push(M(x, FLOOR + 0.37, z)); flames.push({ x, z });
      for (let k=0; k<4; k++){ const a = Math.PI/4 + k*Math.PI/2; crowd.push({ x: x + 0.78*Math.sin(a), y: FLOOR, z: z + 0.78*Math.cos(a) }); } }
    instanced(g, new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20), lamb(0x5a2a1a), tops);
    instanced(g, new THREE.CylinderGeometry(0.05, 0.08, 0.74, 6), lamb(0x222222), legs);
    instanced(g, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), lamb(0xf0e6d0), flames.map(f => M(f.x, FLOOR + 0.84, f.z)));
    const flameMesh = instanced(g, new THREE.SphereGeometry(1, 6, 4), noFog(0xffb347), flames.map(f => M(f.x, FLOOR + 0.94, f.z, 0.03, 0.05, 0.03)));
    flames.forEach(f => halo(g, f.x, FLOOR + 0.95, f.z, 1.1, 0xff9a3a, 0.45));
    // the bar along the right wall: counter, stools, glowing bottles
    add(new THREE.BoxGeometry(1.2, 1.1, 14), lamb(0x3a1e10), 9.2, FLOOR + 0.55, -14, g);
    add(new THREE.BoxGeometry(1.3, 0.08, 14.2), lamb(0x8a5a30), 9.2, FLOOR + 1.12, -14, g);
    const bottles = []; for (let i=0;i<48;i++) bottles.push(M(10.75, FLOOR + 1.6 + (i%3)*0.75, -20.5 + Math.floor(i/3)*0.85 + R(-0.1, 0.1), 0.08, 0.28, 0.08));
    const bot = instanced(g, new THREE.CylinderGeometry(1, 1, 1, 8), noFog(0xffffff), bottles);
    bottles.forEach((_, i) => bot.setColorAt(i, new THREE.Color(['#ff6b6b', '#ffd36b', '#6bffb8', '#6bb8ff', '#d36bff'][i % 5]).multiplyScalar(0.8)));
    for (let i=0;i<8;i++) crowd.push({ x: 8.2, y: FLOOR + 0.25, z: -8 - i*1.6 });
    // hanging lamps and a neon sign
    for (const [x, z] of [[-5, -9], [0, -9], [5, -9], [-5, -16], [0, -16], [5, -16], [-5, -23], [5, -23]]) {
      add(new THREE.CylinderGeometry(0.01, 0.01, 1.2), lamb(0x111111), x, 4.9, z, g);
      add(new THREE.ConeGeometry(0.35, 0.35, 16, 1, true), lamb(0x2a2010), x, 4.15, z, g);
      halo(g, x, 3.95, z, 2.4, 0xffc070, 0.5); }
    const neon = add(new THREE.PlaneGeometry(5, 1.6), noFog(0xffffff, { transparent:true, map: canvasTex(512, 160, (c, w, h) => {
      c.font = 'italic bold 110px Georgia'; c.textAlign = 'center'; c.shadowColor = '#ff4fd8'; c.shadowBlur = 30; c.fillStyle = '#ffb8f0'; c.fillText('Jazz', w/2, 118); }) }), -10.95, 3, -14, g);
    neon.rotation.y = Math.PI/2;
    while (crowd.length < 200) crowd.push({ x: R(-8, 8), y: FLOOR, z: R(-25.5, -24) }); // standing at the back
    venues.push({ group:g, crowd: crowd.slice(0, 200), curtains:'all', sign:true, fog:[8, 32], fx:{ confetti:true, fountains:true },
      fireworkAt: () => new THREE.Vector3(R(-6, 6), 5, R(-20, -8)),
      update(time){ flames.forEach((f, i) => flameMesh.setMatrixAt(i, M(f.x, FLOOR + 0.94, f.z, 0.03, 0.05*(0.8 + 0.4*Math.abs(Math.sin(time*9 + i*1.7))), 0.03))); flameMesh.instanceMatrix.needsUpdate = true; } }); }

  // ---------------- 4 · The Opera House: horseshoe of velvet balconies, gold, a chandelier, a dome ----------------
  { const g = new THREE.Group(), crowd = [], C = -12, RAD = 11, A0 = -150*Math.PI/180, A1 = 150*Math.PI/180;
    const house = (x, z) => ({ x, z: C + z });
    add(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI/2), lamb(0x5a0f18), 0, FLOOR, C, g);
    const wall = tex(256, 64, (c, w, h) => { c.fillStyle = '#4a0c14'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8902e'; for (let x=0; x<w; x+=64) c.fillRect(x, 0, 6, h); }, 12, 1);
    add(new THREE.CylinderGeometry(15, 15, 15, 64, 1, true, Math.PI/6, Math.PI*5/3), new THREE.MeshLambertMaterial({ map:wall, side:THREE.BackSide }), 0, FLOOR + 7.5, C, g);
    add(new THREE.SphereGeometry(15, 48, 16, 0, Math.PI*2, 0, Math.PI/2), noFog(0xffffff, { side:THREE.BackSide, map: canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#1a1f4a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9a240'; c.lineWidth = 6; for (let x=0; x<w; x+=32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      c.fillStyle = '#2c3570'; c.fillRect(0, h*0.65, w, h*0.35); }) }), 0, FLOOR + 15, C, g);
    for (let t=0; t<3; t++){ const y = FLOOR + 3 + t*2.6, r = RAD + t*0.9;
      const floor = new THREE.RingGeometry(r - 0.6, r + 1.4, 64, 1, -Math.PI/3, Math.PI*5/3).rotateX(-Math.PI/2); add(floor, lamb(0x3a0a10), 0, y, C, g);
      add(new THREE.CylinderGeometry(r - 0.6, r - 0.6, 1.0, 64, 1, true, Math.PI/6, Math.PI*5/3), lamb(0x8a1424), 0, y - 0.1, C, g).material.side = THREE.DoubleSide;
      const rim = add(new THREE.TorusGeometry(r - 0.6, 0.06, 6, 64, Math.PI*5/3).rotateX(-Math.PI/2), lamb(0xd4af37), 0, y + 0.4, C, g); rim.rotation.y = -Math.PI/3; // torus arcs start at +x; turn it so the gap faces the stage
      const n = Math.round(r*(A1 - A0)/0.85);
      for (let i=0;i<n;i++){ const a = A0 + (i + 0.5)*(A1 - A0)/n; crowd.push({ ...house(r*Math.sin(a) + R(-0.05, 0.05), -r*Math.cos(a)), y: y + 0.05 }); } }
    // proscenium arch framing the house, and the chandelier
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.7, 9.5, 0.7), lamb(0xc9a240), 7.3*s, FLOOR + 4.75, -5.3, g);
    add(new THREE.BoxGeometry(15.3, 0.9, 0.7), lamb(0xc9a240), 0, FLOOR + 9.3, -5.3, g);
    add(new THREE.BoxGeometry(14, 1.3, 0.3), lamb(0x7a0f1c), 0, FLOOR + 8.3, -5.25, g);
    const lights = []; for (const [r, y, n] of [[1.4, 10.4, 20], [0.9, 10.0, 14], [0.4, 9.6, 8]]) for (let i=0;i<n;i++){ const a = i/n*Math.PI*2; lights.push({ x: r*Math.cos(a), y, z: C + r*Math.sin(a) }); }
    const ch = instanced(g, new THREE.SphereGeometry(1, 8, 6), noFog(0xfff2cc), lights.map(p => M(p.x, p.y, p.z, 0.07)));
    add(new THREE.CylinderGeometry(0.02, 0.02, 4), lamb(0xc9a240), 0, 12.6, C, g);
    halo(g, 0, 10.1, C, 9, 0xffe8b0, 0.55);
    tiers(g, 7, 0.22, 0x2a0a10);
    crowd.unshift(...frontRows(7, 0.22));
    venues.push({ group:g, crowd: crowd.slice(0, 340), curtains:'all', sign:true, fog:[20, 60], fx:{ confetti:true, fountains:true },
      fireworkAt: () => new THREE.Vector3(R(-6, 6), 11, R(-18, -6)),
      update(time){ lights.forEach((p, i) => ch.setMatrixAt(i, M(p.x, p.y, p.z, 0.06 + 0.025*Math.abs(Math.sin(time*2 + i))))); ch.instanceMatrix.needsUpdate = true; } }); }

  // ---------------- 5 · The Stadium: concert in the round, stands on every side, floodlights, big screens ----------------
  { const g = new THREE.Group(), crowd = [];
    add(new THREE.CircleGeometry(34, 64).rotateX(-Math.PI/2), lamb(0x12301a), 0, FLOOR - 0.05, 0, g);
    const seats = tex(64, 64, (c, w, h) => { c.fillStyle = '#2a2f3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#3d4658'; c.fillRect(0, 0, w, 10); }, 96, 7);
    add(new THREE.CylinderGeometry(19.9, 12.4, 4.3, 96, 1, true), new THREE.MeshLambertMaterial({ map:seats, side:THREE.DoubleSide }), 0, FLOOR + 1.95, 0, g); // the bowl
    add(new THREE.CylinderGeometry(20.2, 20.2, 7, 96, 1, true), lamb(0x1c2030), 0, FLOOR + 5.5, 0, g).material.side = THREE.DoubleSide; // back wall
    for (let r=0; r<7; r++){ const rad = 13 + r, y = FLOOR + 0.05 + (rad - 12.4)*4.3/7.5, n = Math.floor(2*Math.PI*rad/1.0);
      for (let i=0;i<n;i++){ const a = (i + (r%2)*0.5)/n*Math.PI*2; crowd.push({ x: rad*Math.sin(a), y, z: rad*Math.cos(a) }); } }
    // roof ring with floodlights pointing at the stage
    add(new THREE.TorusGeometry(23, 0.5, 8, 96).rotateX(Math.PI/2), lamb(0x2a2e3a), 0, 16, 0, g);
    const beamGeo = new THREE.ConeGeometry(2.2, 1, 20, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI/2); // tip at origin, opens along +z
    for (let i=0;i<12;i++){ const a = i/12*Math.PI*2, x = 23*Math.sin(a), z = 23*Math.cos(a);
      const lamp = add(new THREE.BoxGeometry(1.6, 0.9, 0.3), noFog(0xf4f8ff), x, 15.4, z, g); lamp.lookAt(0, 0, 0);
      halo(g, x*0.98, 15.4, z*0.98, 5, 0xe8f0ff, 0.6);
      // beams land on the stands, not the stage: aimed at the player they'd wash out the whole view
      const tx = 15*Math.sin(a), tz = 15*Math.cos(a), ty = FLOOR + 1.6;
      const b = add(beamGeo, noFog(0xdfe8ff, { transparent:true, opacity:0.035, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }), x, 15.4, z, g);
      b.lookAt(tx, ty, tz); b.scale.set(0.7, 0.7, Math.hypot(x - tx, 15.4 - ty, z - tz)); }
    // two big screens (the game fills them with a live camera feed)
    const screens = [-1, 1].map(s => { const x = 11*s, z = -15;
      const frame = add(new THREE.BoxGeometry(9.6, 5.6, 0.3), lamb(0x111111), x, 9.5, z - 0.2, g); frame.lookAt(0, 9.5, 0);
      const sc = add(new THREE.PlaneGeometry(9, 5.06), noFog(0x223344), x, 9.5, z, g); sc.lookAt(0, 9.5, 0); return sc; });
    stars(g, 200, 0.45);
    venues.push({ group:g, crowd: crowd.slice(0, 700), curtains:'none', sign:false, fog:[40, 120], fx:{ fireworks:true, confetti:true, fountains:true }, screens,
      fireworkAt: () => { const a = R(0, Math.PI*2), r = R(16, 26); return new THREE.Vector3(r*Math.sin(a), R(20, 32), r*Math.cos(a)); }, update(){} }); }

  for (const v of venues) { v.group.visible = false; scene.add(v.group); for (const p of v.crowd) p.face = face(p.x, p.z); }
  return venues;
}

// small deterministic PRNG so venues look the same on every load
function mulberry(a){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
