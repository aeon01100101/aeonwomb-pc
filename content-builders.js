/**
 * Aeon Womb PC — standalone Three.js content builders
 * Lane: pure scene-builder code only
 * THREE r149 global · no DOM · no localStorage · no systems
 *
 * FusionFall-level quality: denser geometry, painted materials,
 * clean silhouettes, warm 1960s cartoon palette, soft emissives.
 *
 * Every builder returns a THREE.Group at origin (y = 0 ground).
 * Animation: call group.userData.tick(t, dt) each frame (t = seconds).
 * Optional: group.userData.setState(...) for interactive bits.
 *
 * Job 2: town dressing props
 * Job 3: furniture sets (kitchen, nursery)
 */

// ── self-contained helpers ─────────────────────────────────────────────────
function _box(w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x || 0, y || 0, z || 0);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function _cyl(rTop, rBot, h, seg, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg || 16), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function _sphere(r, seg, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg || 16, seg ? seg * 0.75 : 12), mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  return m;
}
function _mat(color, rough, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color: color,
    roughness: rough == null ? 0.75 : rough,
    metalness: 0
  }, extra || {}));
}
function _emissive(color, intensity, rough) {
  return _mat(color, rough == null ? 0.55 : rough, {
    emissive: color,
    emissiveIntensity: intensity == null ? 0.45 : intensity
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// JOB 2 — Town dressing props  (FusionFall quality + animated)
// ═══════════════════════════════════════════════════════════════════════════

/** Classic US rural mailbox. Flag waves gently; door can open. */
function buildMailbox() {
  const g = new THREE.Group();
  const postM = _mat(0x6b4423, 0.9);
  const bodyM = _mat(0x3a6a9c, 0.5, { metalness: 0.15 });
  const flagM = _mat(0xd03028, 0.5);
  const metalM = _mat(0x9aa8b4, 0.35, { metalness: 0.6 });
  const darkM = _mat(0x2a2a30, 0.6);

  // wooden post with slight taper feel
  g.add(_box(0.10, 1.12, 0.10, postM, 0, 0.56, 0));
  g.add(_box(0.26, 0.05, 0.26, postM, 0, 0.025, 0)); // base plate
  // concrete foot
  g.add(_cyl(0.16, 0.18, 0.08, 12, _mat(0x8a8a82, 0.95), 0, 0.04, 0));

  // mailbox body
  const body = new THREE.Group();
  body.add(_box(0.68, 0.34, 0.40, bodyM, 0, 0, 0));
  // rounded top (layered)
  body.add(_box(0.68, 0.10, 0.40, bodyM, 0, 0.20, 0));
  body.add(_box(0.62, 0.06, 0.36, bodyM, 0, 0.26, 0));
  // front door (separate for open animation)
  const door = _box(0.62, 0.28, 0.03, metalM, 0, -0.02, 0.215);
  body.add(door);
  // door handle / latch
  body.add(_box(0.10, 0.05, 0.05, metalM, 0, -0.06, 0.25));
  body.add(_cyl(0.02, 0.02, 0.04, 8, darkM, 0, -0.06, 0.28));
  // side rivets
  for (const sx of [-0.32, 0.32]) {
    for (const sy of [-0.10, 0.08]) {
      body.add(_cyl(0.015, 0.015, 0.02, 6, metalM, sx, sy, 0.20));
    }
  }
  body.position.y = 1.18;
  g.add(body);

  // red flag (pivots)
  const flagArm = new THREE.Group();
  flagArm.position.set(0.36, 1.28, 0);
  const flag = _box(0.04, 0.26, 0.025, flagM, 0.02, 0.08, 0);
  flagArm.add(flag);
  flagArm.add(_box(0.14, 0.05, 0.025, flagM, 0.09, 0.18, 0));
  // pivot pin
  flagArm.add(_cyl(0.02, 0.02, 0.06, 8, metalM, 0, 0, 0));
  g.add(flagArm);

  // address plate
  g.add(_box(0.28, 0.10, 0.02, _mat(0xf0e8d0, 0.8), 0, 1.02, 0.22));

  // animation state
  let flagAngle = 0.15; // raised
  let doorOpen = 0;
  g.userData.flagArm = flagArm;
  g.userData.door = door;
  g.userData.setFlag = function (up) { flagAngle = up ? 0.15 : -1.1; };
  g.userData.setDoor = function (open) { doorOpen = open ? 1 : 0; };

  g.userData.tick = function (t, dt) {
    // gentle flag sway when raised
    const target = flagAngle + (flagAngle > 0 ? Math.sin(t * 2.2) * 0.06 : 0);
    flagArm.rotation.z += (target - flagArm.rotation.z) * Math.min(1, dt * 6);
    // door ease
    const dTarget = doorOpen * (-Math.PI * 0.55);
    door.rotation.x += (dTarget - door.rotation.x) * Math.min(1, dt * 5);
  };

  g.userData.kind = "mailbox";
  return g;
}

/** Fire hydrant — detailed red, animated valve caps & subtle pressure pulse. */
function buildFireHydrant() {
  const g = new THREE.Group();
  const red = _mat(0xc02820, 0.5);
  const dark = _mat(0x3a1816, 0.65);
  const chrome = _mat(0xc0c8d0, 0.3, { metalness: 0.75 });
  const brass = _mat(0xb89040, 0.4, { metalness: 0.55 });

  // base flange + bolts
  g.add(_cyl(0.26, 0.28, 0.10, 18, dark, 0, 0.05, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(_cyl(0.025, 0.025, 0.04, 6, chrome, Math.cos(a) * 0.22, 0.08, Math.sin(a) * 0.22));
  }
  // main barrel
  g.add(_cyl(0.17, 0.19, 0.58, 16, red, 0, 0.39, 0));
  // mid ring
  g.add(_cyl(0.205, 0.205, 0.07, 16, dark, 0, 0.50, 0));
  // upper barrel
  g.add(_cyl(0.15, 0.17, 0.22, 14, red, 0, 0.72, 0));
  // dome
  g.add(_sphere(0.15, 14, red, 0, 0.88, 0));
  // operating nut
  const nut = _cyl(0.07, 0.07, 0.08, 5, brass, 0, 1.02, 0);
  g.add(nut);

  // side outlets (L / R)
  function outlet(x, y, z, rx) {
    const o = new THREE.Group();
    const pipe = _cyl(0.06, 0.06, 0.16, 12, chrome, 0, 0, 0);
    pipe.rotation.z = Math.PI / 2;
    o.add(pipe);
    const cap = _cyl(0.07, 0.07, 0.05, 12, dark, 0.12, 0, 0);
    o.add(cap);
    // chain ring
    o.add(_cyl(0.03, 0.03, 0.02, 8, brass, 0.06, 0.07, 0));
    o.position.set(x, y, z);
    if (rx) o.rotation.y = rx;
    return { group: o, cap: cap };
  }
  const left = outlet(-0.22, 0.44, 0, 0);
  const right = outlet(0.22, 0.44, 0, Math.PI);
  g.add(left.group);
  g.add(right.group);

  // front outlet (lower)
  const frontPipe = _cyl(0.055, 0.055, 0.14, 12, chrome, 0, 0.34, 0.20);
  frontPipe.rotation.x = Math.PI / 2;
  g.add(frontPipe);
  const frontCap = _cyl(0.065, 0.065, 0.04, 12, dark, 0, 0.34, 0.28);
  g.add(frontCap);

  // paint chips / wear bands
  g.add(_cyl(0.175, 0.175, 0.03, 16, _mat(0xa02018, 0.7), 0, 0.28, 0));

  g.userData.nut = nut;
  g.userData.tick = function (t) {
    // slow operating-nut idle rotation + subtle emissive pulse on body
    nut.rotation.y = t * 0.15;
    red.emissiveIntensity = 0.5 + Math.sin(t * 1.8) * 0.08;
    red.emissive = new THREE.Color(0x400800);
  };

  g.userData.kind = "hydrant";
  return g;
}

/** Park bench — wood + iron, subtle settle animation. */
function buildParkBench() {
  const g = new THREE.Group();
  const wood = _mat(0x8c6a3e, 0.82);
  const woodDark = _mat(0x6a4e2c, 0.85);
  const iron = _mat(0x2c2c32, 0.45, { metalness: 0.45 });
  const bolt = _mat(0x5a5a60, 0.4, { metalness: 0.5 });

  // seat planks (slightly spaced, rounded ends feel)
  for (let i = 0; i < 5; i++) {
    const z = -0.24 + i * 0.115;
    const plank = _box(1.62, 0.055, 0.10, wood, 0, 0.48, z);
    g.add(plank);
    // end caps
    g.add(_box(0.04, 0.055, 0.10, woodDark, -0.82, 0.48, z));
    g.add(_box(0.04, 0.055, 0.10, woodDark, 0.82, 0.48, z));
  }
  // backrest planks
  for (let i = 0; i < 4; i++) {
    const y = 0.66 + i * 0.115;
    g.add(_box(1.62, 0.10, 0.05, wood, 0, y, -0.30));
  }

  // iron side frames (mirrored)
  function sideFrame(sx) {
    const f = new THREE.Group();
    // rear upright (curves into back)
    f.add(_box(0.07, 1.05, 0.07, iron, 0, 0.52, -0.30));
    // front leg
    f.add(_box(0.07, 0.48, 0.07, iron, 0, 0.24, 0.24));
    // seat support rail
    f.add(_box(0.07, 0.06, 0.58, iron, 0, 0.46, -0.03));
    // armrest
    f.add(_box(0.07, 0.06, 0.48, iron, 0, 0.74, -0.02));
    // diagonal brace
    const brace = _box(0.05, 0.32, 0.05, iron, 0, 0.58, -0.12);
    brace.rotation.x = 0.55;
    f.add(brace);
    // feet
    f.add(_box(0.10, 0.04, 0.12, iron, 0, 0.02, 0.24));
    f.add(_box(0.10, 0.04, 0.12, iron, 0, 0.02, -0.30));
    // decorative scroll (simple)
    f.add(_cyl(0.04, 0.04, 0.03, 10, iron, 0, 0.74, 0.20));
    f.position.x = sx;
    return f;
  }
  g.add(sideFrame(-0.78));
  g.add(sideFrame(0.78));

  // under-seat cross brace
  g.add(_box(1.50, 0.04, 0.05, iron, 0, 0.30, 0));
  // bolts
  for (const sx of [-0.78, 0.78]) {
    g.add(_cyl(0.02, 0.02, 0.03, 6, bolt, sx, 0.48, 0.24));
    g.add(_cyl(0.02, 0.02, 0.03, 6, bolt, sx, 0.48, -0.30));
  }

  g.userData.tick = function (t) {
    // very subtle “settle” — almost imperceptible breathing of the wood
    g.rotation.z = Math.sin(t * 0.7) * 0.002;
  };
  g.userData.kind = "bench";
  return g;
}

/** Street lamp — tall post, curved arm, warm glowing lantern with flicker. */
function buildStreetLamp() {
  const g = new THREE.Group();
  const black = _mat(0x1c1c22, 0.4, { metalness: 0.4 });
  const dark = _mat(0x2a2a30, 0.5, { metalness: 0.3 });
  const glassM = _mat(0xfff2c8, 0.25, {
    emissive: 0xffe4a0,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.88,
    metalness: 0.05
  });

  // ornate base
  g.add(_cyl(0.22, 0.26, 0.14, 14, black, 0, 0.07, 0));
  g.add(_cyl(0.18, 0.20, 0.12, 14, dark, 0, 0.18, 0));
  // fluted post (approximated by stacked cylinders)
  g.add(_cyl(0.065, 0.08, 3.55, 12, black, 0, 1.95, 0));
  // decorative collars
  g.add(_cyl(0.095, 0.095, 0.06, 12, dark, 0, 0.55, 0));
  g.add(_cyl(0.09, 0.09, 0.05, 12, dark, 0, 1.8, 0));
  g.add(_cyl(0.09, 0.09, 0.05, 12, dark, 0, 3.15, 0));
  // capital
  g.add(_cyl(0.12, 0.08, 0.12, 12, black, 0, 3.55, 0));

  // curved arm (segmented)
  const arm = new THREE.Group();
  arm.position.set(0, 3.55, 0);
  const armSegs = 5;
  for (let i = 0; i < armSegs; i++) {
    const t = i / (armSegs - 1);
    const x = t * 0.95;
    const y = Math.sin(t * Math.PI * 0.55) * 0.18;
    const seg = _box(0.22, 0.06, 0.06, black, x, y, 0);
    arm.add(seg);
  }
  // decorative finial on arm end
  arm.add(_sphere(0.04, 10, dark, 0.95, 0.12, 0));
  g.add(arm);

  // lantern
  const lantern = new THREE.Group();
  lantern.position.set(0.95, 3.35, 0);
  // cage frame
  lantern.add(_box(0.32, 0.38, 0.32, black, 0, 0, 0));
  // glass
  const glass = _box(0.26, 0.30, 0.26, glassM, 0, 0, 0);
  lantern.add(glass);
  // top roof
  lantern.add(_box(0.36, 0.06, 0.36, black, 0, 0.22, 0));
  lantern.add(_cyl(0.04, 0.02, 0.12, 8, black, 0, 0.32, 0)); // finial
  // bottom
  lantern.add(_box(0.28, 0.04, 0.28, black, 0, -0.20, 0));
  g.add(lantern);

  // real light
  const light = new THREE.PointLight(0xffe0a0, 1.15, 16, 1.7);
  light.position.set(0.95, 3.35, 0);
  light.castShadow = false;
  g.add(light);

  g.userData.lampLight = light;
  g.userData.glassMat = glassM;
  g.userData.tick = function (t) {
    // warm flicker
    const flick = 0.92 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.1) * 0.03;
    light.intensity = 1.15 * flick;
    glassM.emissiveIntensity = 0.75 + flick * 0.25;
  };
  g.userData.kind = "streetlamp";
  return g;
}

/** 1950s phone booth — glass panes, animated door, interior light, ringing glow. */
function buildPhoneBooth() {
  const g = new THREE.Group();
  const frameM = _mat(0x243456, 0.45, { metalness: 0.3 });
  const woodM = _mat(0x5c3a20, 0.75);
  const glassM = _mat(0xb0d0e8, 0.12, {
    transparent: true,
    opacity: 0.32,
    metalness: 0.08,
    roughness: 0.15
  });
  const redM = _mat(0xa82028, 0.5);
  const chromeM = _mat(0xc8d0d8, 0.3, { metalness: 0.7 });
  const blackM = _mat(0x1a1a20, 0.5);

  const W = 1.0, D = 1.0, H = 2.45;

  // floor + ceiling
  g.add(_box(W, 0.07, D, woodM, 0, 0.035, 0));
  g.add(_box(W + 0.04, 0.10, D + 0.04, frameM, 0, H - 0.05, 0));
  // four corner posts
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    g.add(_box(0.08, H - 0.16, 0.08, frameM, x, H * 0.5, z));
  }
  // horizontal rails
  for (const y of [0.55, 1.35, 2.15]) {
    g.add(_box(W - 0.12, 0.05, 0.05, frameM, 0, y, -0.48));
    g.add(_box(W - 0.12, 0.05, 0.05, frameM, 0, y, 0.48));
    g.add(_box(0.05, 0.05, D - 0.12, frameM, -0.48, y, 0));
    g.add(_box(0.05, 0.05, D - 0.12, frameM, 0.48, y, 0));
  }

  // glass panes (back, left, right)
  g.add(_box(0.82, 0.70, 0.03, glassM, 0, 0.95, -0.48));
  g.add(_box(0.82, 0.70, 0.03, glassM, 0, 1.75, -0.48));
  g.add(_box(0.03, 0.70, 0.82, glassM, -0.48, 0.95, 0));
  g.add(_box(0.03, 0.70, 0.82, glassM, -0.48, 1.75, 0));
  g.add(_box(0.03, 0.70, 0.82, glassM, 0.48, 0.95, 0));
  g.add(_box(0.03, 0.70, 0.82, glassM, 0.48, 1.75, 0));

  // solid lower panels
  g.add(_box(0.82, 0.45, 0.04, woodM, 0, 0.28, -0.48));
  g.add(_box(0.04, 0.45, 0.82, woodM, -0.48, 0.28, 0));
  g.add(_box(0.04, 0.45, 0.82, woodM, 0.48, 0.28, 0));

  // door (hinged on left)
  const door = new THREE.Group();
  door.position.set(-0.42, 0, 0.50);
  door.add(_box(0.82, 1.95, 0.04, frameM, 0.41, 1.05, 0));
  door.add(_box(0.70, 0.65, 0.02, glassM, 0.41, 1.55, 0.02));
  door.add(_box(0.70, 0.55, 0.02, glassM, 0.41, 0.75, 0.02));
  door.add(_box(0.70, 0.35, 0.03, woodM, 0.41, 0.30, 0.02));
  // handle
  door.add(_box(0.05, 0.14, 0.05, chromeM, 0.72, 1.05, 0.05));
  g.add(door);

  // roof sign
  const sign = _box(0.90, 0.20, 0.10, redM, 0, H + 0.10, 0);
  g.add(sign);
  // sign glow
  const signLight = new THREE.PointLight(0xff4040, 0.35, 3, 2);
  signLight.position.set(0, H + 0.1, 0.2);
  g.add(signLight);

  // interior shelf + phone
  g.add(_box(0.60, 0.06, 0.30, woodM, 0, 1.10, -0.30));
  const phone = new THREE.Group();
  phone.add(_box(0.26, 0.32, 0.18, blackM, 0, 1.30, -0.30));
  phone.add(_box(0.20, 0.05, 0.08, blackM, 0, 1.48, -0.22)); // cradle
  phone.add(_cyl(0.04, 0.04, 0.12, 8, blackM, 0.08, 1.48, -0.18)); // handset
  g.add(phone);

  // interior light
  const interior = new THREE.PointLight(0xfff0d0, 0.55, 4, 2);
  interior.position.set(0, 2.1, 0);
  g.add(interior);

  let doorOpen = 0;
  let ring = 0;
  g.userData.door = door;
  g.userData.setDoor = function (open) { doorOpen = open ? 1 : 0; };
  g.userData.ring = function (on) { ring = on ? 1 : 0; };

  g.userData.tick = function (t, dt) {
    const target = doorOpen * (-Math.PI * 0.7);
    door.rotation.y += (target - door.rotation.y) * Math.min(1, dt * 4);
    // subtle sign pulse + optional ring flash
    const pulse = 0.3 + Math.sin(t * 3.5) * 0.08 + ring * (0.4 + Math.sin(t * 18) * 0.3);
    signLight.intensity = pulse;
    redM.emissive = new THREE.Color(0x400008);
    redM.emissiveIntensity = 0.15 + pulse * 0.2;
  };

  g.userData.kind = "phonebooth";
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// JOB 3 — Furniture sets  (FusionFall quality + animated)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Kitchen set — counter, sink, stove (burners glow), fridge (door),
 * upper cabinets, table + chairs. Call tick for burner flicker & fridge light.
 */
function buildKitchenSet() {
  const g = new THREE.Group();
  const wood = _mat(0x7a5834, 0.72);
  const cream = _mat(0xeae2d2, 0.8);
  const metal = _mat(0x8e949c, 0.38, { metalness: 0.55 });
  const white = _mat(0xf4f2ec, 0.65);
  const black = _mat(0x1e1e24, 0.45);
  const chrome = _mat(0xc4ccd4, 0.28, { metalness: 0.75 });
  const burnerOff = _mat(0x2a2a30, 0.55);
  const burnerOn = _emissive(0xff6020, 0.7, 0.4);

  // ── counter run ──
  const counter = new THREE.Group();
  counter.name = "counter";
  counter.add(_box(3.5, 0.90, 0.64, wood, 0, 0.45, 0));
  counter.add(_box(3.6, 0.07, 0.70, cream, 0, 0.935, 0));
  // drawer fronts
  for (let i = 0; i < 4; i++) {
    const x = -1.35 + i * 0.88;
    counter.add(_box(0.78, 0.58, 0.04, wood, x, 0.42, 0.34));
    counter.add(_cyl(0.025, 0.025, 0.035, 8, chrome, x, 0.42, 0.38));
  }
  counter.add(_box(3.5, 0.09, 0.58, black, 0, 0.045, -0.02));
  // backsplash
  counter.add(_box(3.5, 0.45, 0.04, cream, 0, 1.18, -0.30));
  g.add(counter);

  // ── sink ──
  const sink = new THREE.Group();
  sink.name = "sink";
  sink.add(_box(0.58, 0.14, 0.44, metal, -1.25, 0.98, 0.02));
  sink.add(_box(0.48, 0.10, 0.36, _mat(0x5a626a, 0.3, { metalness: 0.65 }), -1.25, 0.94, 0.02));
  // faucet
  sink.add(_cyl(0.028, 0.028, 0.26, 10, chrome, -1.25, 1.18, -0.12));
  sink.add(_box(0.05, 0.05, 0.20, chrome, -1.25, 1.30, 0.0));
  sink.add(_cyl(0.018, 0.018, 0.09, 8, chrome, -1.38, 1.10, -0.12));
  sink.add(_cyl(0.018, 0.018, 0.09, 8, chrome, -1.12, 1.10, -0.12));
  g.add(sink);

  // ── stove ──
  const stove = new THREE.Group();
  stove.name = "stove";
  stove.position.set(1.55, 0, 0);
  stove.add(_box(0.76, 0.90, 0.64, white, 0, 0.45, 0));
  stove.add(_box(0.74, 0.05, 0.60, black, 0, 0.925, 0));
  // four burners (materials swapped for on/off)
  const burners = [];
  const bPos = [[-0.18, -0.15], [0.18, -0.15], [-0.18, 0.15], [0.18, 0.15]];
  for (const [bx, bz] of bPos) {
    const b = _cyl(0.10, 0.10, 0.025, 14, burnerOff, bx, 0.955, bz);
    stove.add(b);
    burners.push(b);
    // grate lines
    stove.add(_box(0.22, 0.01, 0.02, metal, bx, 0.97, bz));
    stove.add(_box(0.02, 0.01, 0.22, metal, bx, 0.97, bz));
  }
  // oven door
  const ovenDoor = _box(0.66, 0.52, 0.05, metal, 0, 0.40, 0.34);
  stove.add(ovenDoor);
  stove.add(_box(0.42, 0.10, 0.02, black, 0, 0.40, 0.38));
  // control knobs
  for (let i = 0; i < 4; i++) {
    stove.add(_cyl(0.03, 0.03, 0.04, 10, chrome, -0.26 + i * 0.17, 0.82, 0.35));
  }
  g.add(stove);

  // ── fridge ──
  const fridge = new THREE.Group();
  fridge.name = "fridge";
  fridge.position.set(2.60, 0, 0);
  fridge.add(_box(0.76, 1.82, 0.70, white, 0, 0.91, 0));
  const fridgeDoor = new THREE.Group();
  fridgeDoor.add(_box(0.72, 0.52, 0.05, white, 0, 1.52, 0.36)); // freezer
  fridgeDoor.add(_box(0.72, 1.18, 0.05, white, 0, 0.65, 0.36)); // main
  fridgeDoor.add(_box(0.05, 0.28, 0.05, chrome, 0.30, 1.52, 0.40));
  fridgeDoor.add(_box(0.05, 0.60, 0.05, chrome, 0.30, 0.75, 0.40));
  fridge.add(fridgeDoor);
  // interior light (hidden until open)
  const fridgeLight = new THREE.PointLight(0xfff5e0, 0, 2.5, 2);
  fridgeLight.position.set(0, 1.0, 0);
  fridge.add(fridgeLight);
  g.add(fridge);

  // ── upper cabinets ──
  const uppers = new THREE.Group();
  uppers.name = "uppers";
  uppers.add(_box(2.5, 0.78, 0.40, wood, -0.3, 2.10, -0.12));
  for (let i = 0; i < 3; i++) {
    const x = -1.1 + i * 0.78;
    uppers.add(_box(0.70, 0.66, 0.04, wood, x, 2.10, 0.10));
    uppers.add(_cyl(0.018, 0.018, 0.03, 8, chrome, x, 2.10, 0.14));
  }
  g.add(uppers);

  // ── table + chairs ──
  const table = new THREE.Group();
  table.name = "table";
  table.position.set(0, 0, 1.65);
  table.add(_box(1.20, 0.07, 0.78, wood, 0, 0.80, 0));
  for (const [lx, lz] of [[-0.50, -0.32], [0.50, -0.32], [-0.50, 0.32], [0.50, 0.32]]) {
    table.add(_box(0.07, 0.78, 0.07, wood, lx, 0.39, lz));
  }
  g.add(table);

  function makeChair(x, z, ry) {
    const c = new THREE.Group();
    c.add(_box(0.44, 0.06, 0.44, wood, 0, 0.48, 0));
    for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      c.add(_box(0.05, 0.48, 0.05, wood, lx, 0.24, lz));
    }
    c.add(_box(0.44, 0.46, 0.05, wood, 0, 0.76, -0.19));
    // seat cushion
    c.add(_box(0.40, 0.04, 0.40, _mat(0xd8c8a8, 0.9), 0, 0.54, 0));
    c.position.set(x, 0, z);
    if (ry) c.rotation.y = ry;
    return c;
  }
  g.add(makeChair(-0.55, 1.65, 0));
  g.add(makeChair(0.55, 1.65, 0));

  // animation state
  const burnerState = [0, 0, 0, 0]; // 0–1 intensity
  let fridgeOpen = 0;
  g.userData.burners = burners;
  g.userData.setBurner = function (i, on) { if (i >= 0 && i < 4) burnerState[i] = on ? 1 : 0; };
  g.userData.setFridge = function (open) { fridgeOpen = open ? 1 : 0; };
  g.userData.fridgeDoor = fridgeDoor;

  g.userData.tick = function (t, dt) {
    // burner glow + flicker
    for (let i = 0; i < 4; i++) {
      if (burnerState[i] > 0.5) {
        burners[i].material = burnerOn;
        burnerOn.emissiveIntensity = 0.55 + Math.sin(t * 11 + i) * 0.15 + Math.sin(t * 23 + i * 2) * 0.08;
      } else {
        burners[i].material = burnerOff;
      }
    }
    // fridge door + light
    const fTarget = fridgeOpen * (-Math.PI * 0.65);
    fridgeDoor.rotation.y += (fTarget - fridgeDoor.rotation.y) * Math.min(1, dt * 4);
    fridgeLight.intensity = Math.max(0, -fridgeDoor.rotation.y * 1.2);
  };

  g.userData.kind = "kitchen";
  return g;
}

/**
 * Nursery set — crib, changing table, rocking chair (rocks), dresser,
 * mobile (spins + sways). Soft pastel 1960s palette.
 */
function buildNurserySet() {
  const g = new THREE.Group();
  const wood = _mat(0xcbb892, 0.78);
  const woodDark = _mat(0xa89068, 0.8);
  const white = _mat(0xf6f2ea, 0.72);
  const pastel = _mat(0xebc8d4, 0.82);
  const mint = _mat(0xc4dcc8, 0.82);
  const cream = _mat(0xfaf6ee, 0.88);
  const metal = _mat(0xb4b4bc, 0.38, { metalness: 0.55 });
  const ribbon = _mat(0xe07090, 0.7);

  // ── crib ──
  const crib = new THREE.Group();
  crib.name = "crib";
  // base + mattress
  crib.add(_box(1.30, 0.10, 0.74, wood, 0, 0.58, 0));
  crib.add(_box(1.20, 0.08, 0.64, cream, 0, 0.66, 0));
  // headboard / footboard with gentle arch feel
  for (const sx of [-0.65, 0.65]) {
    crib.add(_box(0.09, 1.05, 0.74, wood, sx, 0.90, 0));
    // decorative top rail
    crib.add(_box(0.12, 0.08, 0.78, woodDark, sx, 1.42, 0));
  }
  // side rails + vertical spindles
  for (const side of [-1, 1]) {
    const z = side * 0.36;
    crib.add(_box(1.26, 0.07, 0.06, wood, 0, 1.05, z));
    crib.add(_box(1.26, 0.07, 0.06, wood, 0, 0.58, z));
    for (let i = 0; i < 8; i++) {
      const x = -0.52 + i * 0.148;
      crib.add(_cyl(0.022, 0.022, 0.45, 8, wood, x, 0.81, z));
    }
  }
  // legs with feet
  for (const [lx, lz] of [[-0.60, -0.32], [0.60, -0.32], [-0.60, 0.32], [0.60, 0.32]]) {
    crib.add(_box(0.08, 0.58, 0.08, wood, lx, 0.29, lz));
    crib.add(_box(0.12, 0.04, 0.12, woodDark, lx, 0.02, lz));
  }
  // soft bumper (pastel)
  crib.add(_box(1.15, 0.12, 0.08, pastel, 0, 0.95, 0.30));
  crib.add(_box(1.15, 0.12, 0.08, pastel, 0, 0.95, -0.30));
  g.add(crib);

  // ── changing table ──
  const change = new THREE.Group();
  change.name = "changingTable";
  change.position.set(1.70, 0, 0);
  change.add(_box(1.00, 0.09, 0.58, wood, 0, 0.98, 0));
  change.add(_box(0.94, 0.88, 0.52, wood, 0, 0.50, 0));
  change.add(_box(0.85, 0.07, 0.48, pastel, 0, 1.06, 0)); // pad
  // drawers
  for (let i = 0; i < 2; i++) {
    change.add(_box(0.84, 0.30, 0.04, white, 0, 0.38 + i * 0.36, 0.28));
    change.add(_cyl(0.022, 0.022, 0.03, 8, metal, 0, 0.38 + i * 0.36, 0.31));
  }
  // safety rails
  change.add(_box(0.96, 0.14, 0.05, wood, 0, 1.16, -0.28));
  change.add(_box(0.05, 0.14, 0.50, wood, -0.48, 1.16, 0));
  change.add(_box(0.05, 0.14, 0.50, wood, 0.48, 1.16, 0));
  g.add(change);

  // ── rocking chair (animated rock) ──
  const rocker = new THREE.Group();
  rocker.name = "rocker";
  rocker.position.set(-1.45, 0, 0.85);
  // seat + back
  rocker.add(_box(0.58, 0.07, 0.52, wood, 0, 0.50, 0));
  rocker.add(_box(0.58, 0.58, 0.06, wood, 0, 0.88, -0.25));
  // arms
  rocker.add(_box(0.07, 0.09, 0.48, wood, -0.30, 0.72, 0));
  rocker.add(_box(0.07, 0.09, 0.48, wood, 0.30, 0.72, 0));
  // rockers (long curved runners)
  const rockerM = _mat(0xa89068, 0.7);
  rocker.add(_box(0.09, 0.07, 0.92, rockerM, -0.24, 0.045, 0));
  rocker.add(_box(0.09, 0.07, 0.92, rockerM, 0.24, 0.045, 0));
  // legs
  for (const [lx, lz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) {
    rocker.add(_box(0.055, 0.46, 0.055, wood, lx, 0.27, lz));
  }
  // cushions
  rocker.add(_box(0.50, 0.06, 0.44, mint, 0, 0.57, 0.02));
  rocker.add(_box(0.50, 0.40, 0.05, mint, 0, 0.85, -0.20));
  g.add(rocker);

  // ── dresser ──
  const dresser = new THREE.Group();
  dresser.name = "dresser";
  dresser.position.set(0.25, 0, -1.15);
  dresser.add(_box(0.90, 0.80, 0.48, wood, 0, 0.42, 0));
  dresser.add(_box(0.94, 0.06, 0.52, wood, 0, 0.85, 0));
  for (let i = 0; i < 3; i++) {
    dresser.add(_box(0.78, 0.20, 0.04, white, 0, 0.24 + i * 0.24, 0.25));
    dresser.add(_cyl(0.018, 0.018, 0.028, 8, metal, 0, 0.24 + i * 0.24, 0.28));
  }
  g.add(dresser);

  // ── mobile (spins + individual sway) ──
  const mobile = new THREE.Group();
  mobile.name = "mobile";
  mobile.position.set(0, 1.70, 0);
  // stem
  mobile.add(_cyl(0.012, 0.012, 0.40, 6, metal, 0, 0.18, 0));
  // cross
  const cross = new THREE.Group();
  cross.add(_box(0.60, 0.025, 0.025, metal, 0, 0, 0));
  cross.add(_box(0.025, 0.025, 0.60, metal, 0, 0, 0));
  mobile.add(cross);
  // hanging charms
  const charms = [];
  const cols = [0xe890a8, 0x90c0e8, 0xe8d070, 0x90d0b0];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 0.26;
    const z = Math.sin(a) * 0.26;
    const str = _cyl(0.007, 0.007, 0.28, 4, metal, x, -0.14, z);
    mobile.add(str);
    const charm = _sphere(0.06, 12, _mat(cols[i], 0.65), x, -0.30, z);
    mobile.add(charm);
    // tiny ribbon
    mobile.add(_box(0.04, 0.03, 0.01, ribbon, x, -0.22, z));
    charms.push({ mesh: charm, baseY: -0.30, phase: i * 1.7 });
  }
  g.add(mobile);

  // animation
  let rockAmt = 0.12; // max rock angle
  g.userData.rocker = rocker;
  g.userData.mobile = mobile;
  g.userData.cross = cross;
  g.userData.setRock = function (amt) { rockAmt = amt; };

  g.userData.tick = function (t) {
    // gentle rocking
    rocker.rotation.z = Math.sin(t * 1.4) * rockAmt;
    // mobile spin + charm bob
    cross.rotation.y = t * 0.55;
    for (const c of charms) {
      c.mesh.position.y = c.baseY + Math.sin(t * 2.8 + c.phase) * 0.025;
      c.mesh.rotation.y = t * 1.2 + c.phase;
    }
  };

  g.userData.kind = "nursery";
  return g;
}

// ── end of builders ────────────────────────────────────────────────────────
