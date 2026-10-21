// The maestro's paw: a white-gloved cat paw gripping the baton, built in controller space
// (the baton runs from the origin along -z). Toe beans underneath flash on every hit.
export function makePaw(THREE){
  const g = new THREE.Group();
  const glove = new THREE.MeshLambertMaterial({ color:0xfbf8f2 }), fur = new THREE.MeshLambertMaterial({ color:0xf2ece2 });
  const beans = new THREE.MeshLambertMaterial({ color:0xff9db5, emissive:0x000000 });
  const ball = new THREE.SphereGeometry(1, 20, 14);
  const part = (mat, x, y, z, sx, sy = sx, sz = sx) => { const m = new THREE.Mesh(ball, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
  part(glove, 0, -0.006, 0.032, 0.05, 0.034, 0.056);                 // palm: wide and soft, wrapped under the baton
  for (let i=0; i<4; i++) { const x = -0.03 + i*0.02, arc = 1 - Math.abs(i - 1.5)/3;
    part(glove, x, 0.012 + 0.005*arc, -0.006 - 0.006*arc, 0.017, 0.016, 0.019); // chubby toes, overlapping, curled over the baton
    part(beans, x*0.95, -0.031, -0.004 - 0.004*arc, 0.009, 0.004, 0.01); }        // a toe bean under each toe
  part(beans, 0, -0.04, 0.032, 0.024, 0.006, 0.019);                  // the big pad
  part(glove, 0.045, -0.002, 0.04, 0.014, 0.012, 0.017);              // dewclaw thumb
  part(fur, 0, -0.004, 0.088, 0.054, 0.05, 0.022);                    // puffy fur cuff
  for (let i=0; i<12; i++) { const a = i/12*Math.PI*2;                // soft tufts around its rim
    part(fur, 0.05*Math.cos(a), -0.004 + 0.046*Math.sin(a), 0.084 + 0.006*(i % 2), 0.011, 0.011, 0.014); }
  g.userData.beans = beans;
  return g;
}
