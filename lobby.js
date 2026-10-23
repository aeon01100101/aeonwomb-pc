/* ------------------------------------------------------------------
 * Aeon Womb PC — Lobby waiting room        (Kimi's lane, Job 1)
 *
 * Pure scene-builder. Needs only the global THREE (r149).
 * No DOM, no canvas, no localStorage, no game systems, no globals
 * created. Everything is local to buildLobby().
 *
 * Units: metres, y up, floor at y = 0 (same as game.js).
 * Room is centred on the origin: X is -4.5..4.5, Z is -3.5..3.5,
 * ceiling at 3.2. The entrance door is on the +Z wall.
 *
 * Returns a THREE.Group. Extra data for whoever wires it in is on
 * group.userData:
 *   size        {w, d, h}
 *   spawn       {x, y, z, yaw}  where to put the player (facing the room)
 *   door        {x, z}          centre of the entrance door
 *   bounds      {minX,maxX,minZ,maxZ}  walkable area inside the walls
 *   colliders   [{minX,maxX,minZ,maxZ,name}]  furniture footprints
 *   clock       {hour, minute}  Object3Ds to rotate (set to real time
 *                               at build; rotation.z, clockwise = negative)
 *   flicker     [Material]      emissive ceiling panels, if the host
 *                               wants to animate them (optional)
 *   lights      [Light]         the 3 point lights added to the group
 * ------------------------------------------------------------------ */
function buildLobby() {
  const W = 9, D = 7, H = 3.2;
  const hw = W / 2, hd = D / 2;
  const group = new THREE.Group();
  group.name = 'Lobby';
  const colliders = [];

  // ---------- helpers (all local) ----------
  const mat = (color, rough, extra) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough == null ? 0.8 : rough, metalness: 0 }, extra || {}));
  const box = (w, h, d, m, x, y, z, parent) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    (parent || group).add(mesh);
    return mesh;
  };
  const cyl = (rt, rb, h, seg, m, x, y, z, parent) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    mesh.position.set(x, y, z);
    (parent || group).add(mesh);
    return mesh;
  };
  const solid = (name, x, z, w, d) =>
    colliders.push({ name: name, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  // ---------- palette: 1960s doctor's-office ----------
  const cream = mat(0xe4d6b0, 0.95);
  const sage = mat(0x9db39a, 0.95);
  const wood = mat(0x7a5030, 0.7);
  const woodDark = mat(0x4a3220, 0.75);
  const woodLight = mat(0xb98a55, 0.7);
  const trim = mat(0xfaf8f2, 0.7);
  const chrome = mat(0xd8dde2, 0.2, { metalness: 0.9 });
  const teal = mat(0x3f7f86, 0.85);
  const mustard = mat(0xd9a441, 0.85);
  const vinylRed = mat(0xa03a44, 0.6);
  const glassBlue = mat(0xbfe3f2, 0.2, { emissive: 0x7fb8d8, emissiveIntensity: 0.3 });
  const paperM = mat(0xf2ecd6, 0.9);

  // ---------- floor: checker tiles, one geometry, vertex colours ----------
  {
    const tile = 0.5, nx = Math.round(W / tile), nz = Math.round(D / tile);
    const pos = [], col = [], idx = [];
    const c1 = new THREE.Color(0xe9dfc4), c2 = new THREE.Color(0x5b7f74);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x0 = -hw + i * tile, z0 = -hd + j * tile;
        const c = (i + j) % 2 === 0 ? c1 : c2;
        const base = pos.length / 3;
        pos.push(x0, 0, z0, x0 + tile, 0, z0, x0 + tile, 0, z0 + tile, x0, 0, z0 + tile);
        for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
        idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const floor = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
    floor.name = 'floor';
    group.add(floor);
  }

  // ---------- ceiling ----------
  box(W, 0.1, D, mat(0xf4efe0, 1), 0, H + 0.05, 0).name = 'ceiling';

  // ---------- walls (thick slabs so both faces draw) ----------
  const t = 0.2;
  const wainH = 1.05;
  function wall(w, d, x, z) {
    box(w, H, d, cream, x, H / 2, z);                        // upper wall
    // lower wood paneling, on the room-facing side only
    const along = w > d;
    const px = along ? x : x + (x > 0 ? -(t / 2 + 0.02) : (t / 2 + 0.02));
    const pz = along ? z + (z > 0 ? -(t / 2 + 0.02) : (t / 2 + 0.02)) : z;
    box(along ? w : 0.04, wainH, along ? 0.04 : d, wood, px, wainH / 2, pz);
    // baseboard + chair rail
    box(along ? w : 0.07, 0.12, along ? 0.07 : d, woodDark, px, 0.06, pz);
    box(along ? w : 0.07, 0.06, along ? 0.07 : d, trim, px, wainH + 0.03, pz);
  }
  wall(W + t * 2, t, 0, -hd - t / 2);   // back  (-Z)
  wall(W + t * 2, t, 0, hd + t / 2);    // front (+Z, door wall)
  wall(t, D, -hw - t / 2, 0);           // left  (-X)
  wall(t, D, hw + t / 2, 0);            // right (+X)
  // crown moulding
  box(W, 0.08, 0.08, trim, 0, H - 0.04, -hd + 0.04);
  box(W, 0.08, 0.08, trim, 0, H - 0.04, hd - 0.04);
  box(0.08, 0.08, D, trim, -hw + 0.04, H - 0.04, 0);
  box(0.08, 0.08, D, trim, hw - 0.04, H - 0.04, 0);

  // ---------- entrance door (+Z wall, slightly right of centre) ----------
  const doorX = 1.6, doorZ = hd;
  {
    const dg = new THREE.Group();
    dg.position.set(doorX, 0, doorZ);
    dg.name = 'entranceDoor';
    box(1.3, 2.25, 0.06, trim, 0, 1.125, -0.03, dg);        // frame backing
    box(1.08, 2.15, 0.07, woodLight, 0, 1.075, -0.06, dg);   // door leaf
    box(0.5, 0.9, 0.08, glassBlue, 0, 1.55, -0.07, dg);      // frosted pane
    cyl(0.04, 0.04, 0.07, 12, chrome, 0.42, 1.05, -0.1, dg).rotation.x = Math.PI / 2; // knob
    box(0.5, 0.12, 0.02, mustard, 0, 2.35, -0.04, dg);       // EXIT-style plate (blank)
    group.add(dg);
  }

  // ---------- windows on the left (-X) wall ----------
  for (const wz of [-2.0, 0, 2.0]) {
    const wg = new THREE.Group();
    wg.position.set(-hw, 1.75, wz);
    box(0.05, 1.2, 1.3, trim, 0.02, 0, 0, wg);                // frame
    box(0.06, 1.05, 1.15, glassBlue, 0.03, 0, 0, wg);         // glass (daylight glow)
    box(0.07, 1.05, 0.04, trim, 0.04, 0, 0, wg);              // mullion
    box(0.07, 0.04, 1.15, trim, 0.04, 0, 0, wg);              // transom
    box(0.14, 0.05, 1.4, trim, 0.06, -0.62, 0, wg);           // sill
    // venetian-blind slats across the top third
    for (let k = 0; k < 6; k++) box(0.03, 0.025, 1.12, mat(0xe8dfc5, 0.8), 0.06, 0.45 - k * 0.055, 0, wg);
    group.add(wg);
  }

  // ---------- reception desk (back wall) ----------
  {
    const rx = 1.2, rz = -hd + 0.75;
    box(3.0, 1.0, 0.7, woodDark, rx, 0.5, rz);               // counter body
    box(3.1, 0.07, 0.85, woodLight, rx, 1.035, rz);          // counter top
    box(0.9, 0.5, 0.04, glassBlue, rx - 1.0, 1.5, rz + 0.3); // sliding-window pane
    box(1.0, 0.04, 0.05, trim, rx - 1.0, 1.77, rz + 0.3);
    box(1.0, 0.04, 0.05, trim, rx - 1.0, 1.23, rz + 0.3);
    // bell, sign-in clipboard, pen cup
    cyl(0.07, 0.09, 0.05, 16, chrome, rx + 0.9, 1.095, rz + 0.25);
    cyl(0.015, 0.015, 0.03, 8, chrome, rx + 0.9, 1.14, rz + 0.25);
    box(0.24, 0.02, 0.32, paperM, rx + 0.2, 1.08, rz + 0.22);
    cyl(0.05, 0.045, 0.1, 12, teal, rx - 0.3, 1.12, rz + 0.1);
    // rolling stool behind the desk
    cyl(0.2, 0.2, 0.06, 16, vinylRed, rx + 0.4, 0.62, rz - 0.6);
    cyl(0.03, 0.03, 0.5, 8, chrome, rx + 0.4, 0.32, rz - 0.6);
    solid('reception', rx, rz, 3.1, 0.85);
  }

  // ---------- wall clock, back wall (geometry only: no canvas) ----------
  const clockHour = new THREE.Group(), clockMinute = new THREE.Group();
  {
    const cg = new THREE.Group();
    cg.position.set(-1.6, 2.3, -hd + 0.06);
    cyl(0.3, 0.3, 0.05, 32, mat(0xf4efdc, 0.5), 0, 0, 0, cg).rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 32), mustard);
    rim.position.z = 0.02; cg.add(rim);
    const tick = mat(0x2a2018, 0.6);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, r = 0.25;
      const m = box(k % 3 === 0 ? 0.03 : 0.015, k % 3 === 0 ? 0.07 : 0.045, 0.01, tick, Math.sin(a) * r, Math.cos(a) * r, 0.03, cg);
      m.rotation.z = -a;
    }
    // hands pivot at the clock centre; geometry offset so they point up at rotation 0
    const hourM = box(0.025, 0.15, 0.012, tick, 0, 0.075, 0, clockHour);
    const minM = box(0.018, 0.23, 0.01, tick, 0, 0.115, 0, clockMinute);
    clockHour.position.z = 0.04; clockMinute.position.z = 0.05;
    cg.add(clockHour); cg.add(clockMinute);
    cyl(0.02, 0.02, 0.02, 10, tick, 0, 0, 0.055, cg).rotation.x = Math.PI / 2;
    const now = new Date();
    const mins = now.getMinutes() + now.getSeconds() / 60;
    clockMinute.rotation.z = -(mins / 60) * Math.PI * 2;
    clockHour.rotation.z = -(((now.getHours() % 12) + mins / 60) / 12) * Math.PI * 2;
    group.add(cg);
  }

  // ---------- framed prints on the back wall ----------
  {
    const frame = mat(0x3a2a1c, 0.6);
    const prints = [[0x7fb0a0, 0xf2d58a], [0xd98a6a, 0x4b6d8a]];
    [[-3.0, 1.9], [3.4, 1.9]].forEach(function (p, i) {
      box(0.9, 0.7, 0.04, frame, p[0], p[1], -hd + 0.04);
      box(0.8, 0.6, 0.02, mat(prints[i][0], 0.9), p[0], p[1], -hd + 0.065);
      box(0.4, 0.3, 0.02, mat(prints[i][1], 0.9), p[0] + 0.1, p[1] - 0.05, -hd + 0.08); // abstract shape
      cyl(0.09, 0.09, 0.02, 16, mat(0x3a2a1c, 0.9), p[0] - 0.22, p[1] + 0.12, -hd + 0.085).rotation.x = Math.PI / 2;
    });
  }

  // ---------- rug + coffee table + magazines (centre) ----------
  {
    box(3.4, 0.015, 2.2, teal, 0, 0.01, 0.2);
    box(3.1, 0.017, 1.9, mat(0xe3d3a3, 1), 0, 0.012, 0.2);
    box(2.8, 0.019, 1.6, teal, 0, 0.014, 0.2);
    // coffee table
    box(1.3, 0.06, 0.65, woodLight, 0, 0.42, 0.2);
    for (const [lx, lz] of [[-0.55, -0.12], [0.55, -0.12], [-0.55, 0.52], [0.55, 0.52]])
      cyl(0.025, 0.018, 0.4, 8, woodDark, lx, 0.2, lz);
    box(1.15, 0.03, 0.5, woodDark, 0, 0.18, 0.2);                    // lower shelf
    // magazines fanned out
    const mags = [0xd8553f, 0x4a86a8, 0xe0b33a, 0x7aa05a];
    mags.forEach(function (c, i) {
      const m = box(0.26, 0.012, 0.34, mat(c, 0.85), -0.3 + i * 0.16, 0.457 + i * 0.012, 0.2, group);
      m.rotation.y = (i - 1.5) * 0.28;
    });
    cyl(0.07, 0.06, 0.12, 14, mat(0xeeeeee, 0.3), 0.45, 0.51, 0.3); // ashtray-style dish
    solid('coffeeTable', 0, 0.2, 1.3, 0.65);
  }

  // ---------- chairs (mid-century lounge chair, local factory) ----------
  function makeChair(color) {
    const g = new THREE.Group();
    const seat = mat(color, 0.6);
    box(0.62, 0.12, 0.6, seat, 0, 0.42, 0, g);                       // seat
    const back = box(0.62, 0.55, 0.1, seat, 0, 0.78, -0.27, g);       // back
    back.rotation.x = -0.12;
    box(0.08, 0.28, 0.58, seat, -0.33, 0.62, 0, g);                  // arms
    box(0.08, 0.28, 0.58, seat, 0.33, 0.62, 0, g);
    for (const [lx, lz] of [[-0.26, 0.24], [0.26, 0.24], [-0.26, -0.22], [0.26, -0.22]]) {
      const leg = cyl(0.025, 0.015, 0.36, 8, woodDark, lx, 0.18, lz, g);
      leg.rotation.z = lx > 0 ? -0.08 : 0.08;                        // splayed
    }
    return g;
  }
  // row along the left wall, facing +X (into the room)
  [-2.0, -0.7, 0.6, 1.9].forEach(function (z, i) {
    const c = makeChair(i % 2 ? 0xd9a441 : 0xa03a44);
    c.position.set(-hw + 0.5, 0, z);
    c.rotation.y = Math.PI / 2;
    group.add(c);
    solid('chairL' + i, -hw + 0.5, z, 0.7, 0.7);
  });
  // two facing the coffee table from the +Z side
  [-0.55, 0.55].forEach(function (x, i) {
    const c = makeChair(0x3f7f86);
    c.position.set(x, 0, 1.55);
    c.rotation.y = Math.PI;
    group.add(c);
    solid('chairF' + i, x, 1.55, 0.7, 0.7);
  });

  // ---------- sofa (right wall), faces -X ----------
  {
    const sg = new THREE.Group();
    const sofaM = mat(0x8c4b3a, 0.85), cushM = mat(0xa8604a, 0.9);
    box(0.95, 0.4, 2.4, sofaM, 0, 0.35, 0, sg);
    box(0.24, 0.8, 2.4, sofaM, 0.36, 0.7, 0, sg);                     // back
    box(0.95, 0.42, 0.28, sofaM, 0, 0.62, -1.06, sg);                 // arms
    box(0.95, 0.42, 0.28, sofaM, 0, 0.62, 1.06, sg);
    box(0.7, 0.14, 0.9, cushM, -0.05, 0.62, -0.42, sg);
    box(0.7, 0.14, 0.9, cushM, -0.05, 0.62, 0.42, sg);
    box(0.14, 0.5, 0.9, cushM, 0.22, 0.9, -0.42, sg);
    box(0.14, 0.5, 0.9, cushM, 0.22, 0.9, 0.42, sg);
    for (const [lx, lz] of [[-0.4, -1.1], [-0.4, 1.1], [0.4, -1.1], [0.4, 1.1]])
      cyl(0.03, 0.02, 0.15, 8, woodDark, lx, 0.075, lz, sg);
    sg.position.set(hw - 0.65, 0, -0.6);
    sg.rotation.y = 0;  // back toward +X wall, seat faces -X
    group.add(sg);
    solid('sofa', hw - 0.65, -0.6, 0.95, 2.4);
  }

  // ---------- side tables + table lamps flanking the sofa ----------
  function makeSideLamp(x, z) {
    box(0.5, 0.05, 0.5, woodLight, x, 0.56, z);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]])
      cyl(0.02, 0.015, 0.54, 8, woodDark, x + lx, 0.27, z + lz);
    cyl(0.06, 0.08, 0.2, 12, teal, x, 0.69, z);                       // base
    cyl(0.015, 0.015, 0.2, 8, chrome, x, 0.88, z);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.22, 14, 1, true),
      mat(0xf6dca0, 0.9, { emissive: 0xffca7a, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.set(x, 1.05, z);
    group.add(shade);
    solid('sideTable', x, z, 0.5, 0.5);
  }
  makeSideLamp(hw - 0.55, -2.2);
  makeSideLamp(hw - 0.55, 1.05);

  // ---------- magazine rack (right wall, near door) ----------
  {
    const rx = hw - 0.3, rz = 2.5;
    box(0.5, 1.1, 0.1, woodDark, rx + 0.1, 0.65, rz);
    for (let k = 0; k < 3; k++) {
      box(0.45, 0.03, 0.3, woodDark, rx - 0.05, 0.4 + k * 0.3, rz);
      box(0.4, 0.2, 0.02, mat([0xd8553f, 0x4a86a8, 0xe0b33a][k], 0.85), rx - 0.12, 0.5 + k * 0.3, rz + 0.12);
    }
    solid('magRack', rx, rz, 0.5, 0.4);
  }

  // ---------- potted plants (two corners) ----------
  function makePlant(x, z, s) {
    const pg = new THREE.Group();
    cyl(0.25 * s, 0.18 * s, 0.4 * s, 14, mat(0xb06a44, 0.9), 0, 0.2 * s, 0, pg);
    cyl(0.23 * s, 0.23 * s, 0.03, 14, mat(0x3b2a1c, 1), 0, 0.4 * s, 0, pg);
    const leaf = mat(0x3f7a3c, 0.9), leaf2 = mat(0x5d9a4a, 0.9);
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), k % 2 ? leaf : leaf2);
      l.scale.set(0.45, 1.6, 0.18);
      l.position.set(Math.cos(a) * 0.12 * s, (0.75 + (k % 3) * 0.12) * s, Math.sin(a) * 0.12 * s);
      l.rotation.z = Math.cos(a) * 0.55; l.rotation.x = -Math.sin(a) * 0.55;
      pg.add(l);
    }
    pg.position.set(x, 0, z);
    group.add(pg);
    solid('plant', x, z, 0.5 * s, 0.5 * s);
  }
  makePlant(-hw + 0.5, -hd + 0.5, 1.3);
  makePlant(hw - 0.5, hd - 0.55, 1.0);

  // ---------- ceiling panels + lights ----------
  const flicker = [];
  const lights = [];
  [-2.4, 0, 2.4].forEach(function (x, i) {
    const pm = mat(0xfff6d8, 0.5, { emissive: 0xfff0c0, emissiveIntensity: 0.8 });
    box(1.4, 0.04, 0.5, pm, x, H - 0.02, 0.1);
    box(1.5, 0.03, 0.6, trim, x, H - 0.005, 0.1);
    flicker.push(pm);
    if (i === 1 || i === 0 || i === 2) {
      const pl = new THREE.PointLight(0xffe2b0, 0.5, 9, 1.6);
      pl.position.set(x, H - 0.5, 0.1);
      pl.name = 'lobbyLight' + i;
      group.add(pl);
      lights.push(pl);
    }
  });

  // ---------- waiting-room sign: dark plaque with a row of gold blocks ----------
  // (no text: canvas/fonts would need the DOM, so it stays pure geometry)
  {
    box(1.6, 0.32, 0.03, mat(0x22302e, 0.7), -3.0 + 0, 2.75, -hd + 0.03);
    for (let k = 0; k < 9; k++)
      box(0.1, 0.12 + (k % 3) * 0.04, 0.02, mustard, -3.55 + k * 0.14, 2.75, -hd + 0.055);
  }

  // ---------- data for the integrator ----------
  group.userData = {
    size: { w: W, d: D, h: H },
    spawn: { x: doorX, y: 1.6, z: hd - 1.0, yaw: Math.PI },          // inside the door, looking into the room
    door: { x: doorX, z: doorZ },
    bounds: { minX: -hw + 0.3, maxX: hw - 0.3, minZ: -hd + 0.3, maxZ: hd - 0.3 },
    colliders: colliders,
    clock: { hour: clockHour, minute: clockMinute },
    flicker: flicker,
    lights: lights
  };
  return group;
}
