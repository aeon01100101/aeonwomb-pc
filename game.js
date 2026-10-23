"use strict";
/* ================================================================
   Aeon Womb for PC — the Android game's womb explorer, rebuilt in
   real 3D (Three.js, vendored). The simulation below is a faithful
   port of the Android GameWorld: same levels, same swim physics,
   same living mother, same swish, same fetus rules. The RNG is a
   mulberry32 with the same seed and distributions (not bit-equal
   to the Java LCG — the feel is identical, the dice differ).
   ================================================================ */

// ------------------------------------------------------------ math
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const forwardX = yaw => Math.sin(yaw), forwardZ = yaw => Math.cos(yaw);
const rightX = yaw => Math.cos(yaw), rightZ = yaw => -Math.sin(yaw);
const bubbleYAt = (baseY, t, phase) => baseY + Math.sin(t * 1.3 + phase) * 0.25;

// ------------------------------------------------------------ data
const LEVELS = [
  { name: "First Weeks", blurb: "A small, quiet womb. Baby is tiny and sleeps almost all the time.",
    radius: 9.0, babyScale: 0.70, kickMin: 20.0, kickVar: 14.0, drift: false,
    spots: [[-3.5,-3.0,1.6],[4.5,-3.5,2.0],[-5.5,1.5,1.5],[5.0,4.5,1.8],[-1.5,5.5,2.2],[0.5,-0.5,1.6]],
    cardIds: [0,1,2,3,8,5],
    lines: [
      "A bubble of sound: mother's heartbeat — the very first sound of all.",
      "A bubble of sound: mother humming while she goes about her day.",
      "A bubble of sound: low voices, talking in another room.",
      "A bubble of sound: music from a little radio, far away.",
      "A bubble of sound: rain on the window outside.",
      "A bubble of sound: mother saying baby's name, just to try it out."] },
  { name: "Growing", blurb: "The womb is bigger now, and so is baby. The world outside is getting louder.",
    radius: 11.0, babyScale: 0.95, kickMin: 16.0, kickVar: 12.0, drift: false,
    spots: [[-4.5,-3.5,1.7],[5.5,-4.0,2.1],[-7.0,2.0,1.5],[6.8,5.5,1.9],[-2.0,6.5,2.3],[0.5,-0.5,1.6],[8.6,-0.8,2.0],[-8.8,-5.2,1.8]],
    cardIds: [2,3,4,6,7,8,9,10],
    lines: [
      "A bubble of sound: mother's heartbeat, strong as a drum now.",
      "A bubble of sound: voices talking and laughing, closer than before.",
      "A bubble of sound: tummy gurgles — dinner time out there.",
      "A bubble of sound: footsteps, and a door opening.",
      "A bubble of sound: the whole world, busy and waiting.",
      "A bubble of sound: rain again — baby knows this one.",
      "A bubble of sound: a deep, low voice. That one is different.",
      "A bubble of sound: a dog barking, far away. Baby startles!"] },
  { name: "Almost Time", blurb: "Baby is big, the kicks are strong, and the bubbles drift like baby is stirring the water.",
    radius: 13.0, babyScale: 1.18, kickMin: 10.0, kickVar: 8.0, drift: true,
    spots: [[-6.0,-5.0,1.8],[7.0,-6.0,2.0],[-9.5,2.5,1.6],[9.0,7.0,2.1],[-3.0,9.0,2.3],[1.0,-1.0,1.7],[11.0,-1.5,1.9],[-11.0,-6.5,1.8],[4.0,10.5,2.0],[-7.5,-10.0,2.2]],
    cardIds: [11,1,5,7,8,9,10,3,6,2],
    lines: [
      "A bubble of sound: bells, ringing far away on a bright morning.",
      "A bubble of sound: mother humming the same tune again — baby's favourite.",
      "A bubble of sound: mother saying baby's name. It won't be long now.",
      "A bubble of sound: the whole world, holding its breath.",
      "A bubble of sound: rain washing the windows clean.",
      "A bubble of sound: that deep, low voice, reading a story.",
      "A bubble of sound: the dog again — baby kicks back this time.",
      "A bubble of sound: music, and somebody dancing in the kitchen.",
      "A bubble of sound: footsteps coming closer. Visitors!",
      "The last bubble: everything at once. The whole world, waiting for baby."] },
];
const CARD_TITLES = [
  "Mother's heartbeat", "Mother humming", "Voices and laughter",
  "Music playing", "Tummy gurgles in the kitchen", "Mother says baby's name",
  "Footsteps and a door", "The whole world waiting", "Rain outside",
  "A deep, low voice", "A dog barking far away", "Bells on Sunday"];

const MOM_GREET = ["Hello in there, little one.", "Mommy's right here, sweetheart.", "Well hello, my tiny swimmer."];
const MOM_KICK = ["Ooh — I felt that kick!", "There you go. Stretch those little legs.", "Somebody is awake in there.", "Hello to you too, baby."];
const MOM_BUBBLE = ["Did you hear that one, baby?", "That's the world out here, saying hello.", "Listen — that one's for you."];
const MOM_IDLE = ["I love you already, you know.", "Hush little baby, don't say a word. Mama's gonna buy you a mockingbird.", "Just me and you, kiddo.", "Grow strong in there.", "I wonder who you'll look like."];
const KICK_LINES = ["Thump! The baby just kicked.", "A little kick — baby says hello.", "Baby is stretching in there… thump.", "That wobble? Baby just rolled over."];
const MOTHER_STATE_LINES = { 1: "🚶 Mother is up and walking — the whole womb sways with her steps.",
  2: "🌀 Mother rolls over — the world tilts, gently.", 3: "🤲 A gentle squeeze… a practice contraction. The walls hug you, then let go." };

// ------------------------------------------------------------ world (port of GameWorld.java)
const WALL_HEIGHT = 5.0, EYE_HEIGHT = 1.6, PLAYER_RADIUS = 0.55, PLACENTA_Y = 2.7, NEUTRAL_Y = 2.3;
const MOTHER_REST = 0, MOTHER_WALK = 1, MOTHER_ROLL = 2, MOTHER_CONTRACT = 3;
const KICKS_TO_WIN = 5;

class WombWorld {
  constructor() {
    this.levelIndex = 0; this.level = LEVELS[0]; this.radius = 9;
    this.babyCount = 1; this.fetusMode = false;
    this.selfPlacentaX = 0; this.selfPlacentaZ = 0; this.selfScale = 1;
    this.yourKicks = 0; this.yourKickPulse = 0; this.lastYourKickAt = -9;
    this.babies = []; this.heartBabyIndex = 0; this.heartsVisited = 0;
    this.babyX = 1.6; this.babyZ = 2.1; this.placentaX = -6.2; this.placentaZ = 6.4;
    this.bubbles = [];
    this.playerX = 0; this.playerZ = -7.6; this.yaw = 0.35; this.pitch = 0;
    this.walkCycle = 0; this.moving = false;
    this.playerY = EYE_HEIGHT; this.velX = 0; this.velY = 0; this.velZ = 0;
    this.strokePhase = 0.25; this.wasMoving = false;
    this.motherState = MOTHER_REST; this.stateT = 0; this.stateDur = 13; this.stateHeading = 0.6;
    this.rngState = 987654321;
    this.swayX = 0; this.swayZ = 0; this.tiltRoll = 0; this.tiltPitch = 0; this.wallSqueeze = 0;
    this.swishStrength = 0; this.swishDirX = 1; this.swishDirZ = 0;
    this.swishT = -1; this.nextSwishAt = 16; this.bubbleSwishX = 0; this.bubbleSwishZ = 0;
    this.collectedCount = 0; this.lineCursor = 0; this.worldTime = 0;
    this.kicksFelt = 0; this.kickPulse = 0; this.nextKickAt = 14; this.kickPending = false;
    this.gameComplete = false;
    this.loadLevel(0);
  }
  nextRand() { // mulberry32 — same seed family as the Java LCG, same distributions
    this.rngState = (this.rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  bpmScale() { let s = 1.0 + 0.22 * this.wallSqueeze; try { const w = Math.min(Needs.hunger, Needs.thirst, Needs.rest, Needs.comfort); if (w < 40) s += (40 - w) * 0.004; } catch (e) { } return s; }
  setFetusMode(f) { this.fetusMode = f; this.loadLevel(this.levelIndex); }
  kick() {
    if (this.worldTime - this.lastYourKickAt < 0.8) return false;
    this.lastYourKickAt = this.worldTime; this.yourKicks++; this.yourKickPulse = 1.0;
    return true;
  }
  setBabyCount(n) {
    if (n !== 1 && n !== 2 && n !== 3 && n !== 8) n = 1;
    this.babyCount = n; this.loadLevel(this.levelIndex);
  }
  loadLevel(idx) {
    this.levelIndex = clamp(idx, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.radius = (this.level.radius + (this.babyCount === 8 ? 9 : this.babyCount === 3 ? 4 : this.babyCount === 2 ? 2 : 0)) * 2.0;
    const spotScale = this.radius / this.level.radius;
    const bScale = this.level.babyScale * (this.babyCount === 8 ? 0.52 : this.babyCount === 3 ? 0.70 : this.babyCount === 2 ? 0.82 : 1.0);
    let babies = [];
    if (this.babyCount === 1) {
      const s = this.radius / 11.0;
      const pa = Math.atan2(7.9, -7.6);
      babies.push({ x: 2.0 * s, z: 2.6 * s, scale: bScale,
        placentaX: Math.cos(pa) * (this.radius - 0.4), placentaZ: Math.sin(pa) * (this.radius - 0.4),
        heartVisited: false, radius() { return 1.35 * this.scale; } });
    } else {
      const ringR = this.radius * 0.44;
      for (let i = 0; i < this.babyCount; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / this.babyCount);
        babies.push({ x: Math.cos(a) * ringR, z: Math.sin(a) * ringR, scale: bScale,
          placentaX: Math.cos(a) * (this.radius - 0.4), placentaZ: Math.sin(a) * (this.radius - 0.4),
          heartVisited: false, radius() { return 1.35 * this.scale; } });
      }
    }
    if (this.fetusMode) {
      this.selfPlacentaX = babies[0].placentaX; this.selfPlacentaZ = babies[0].placentaZ;
      this.selfScale = babies[0].scale;
      babies = babies.slice(1);
    }
    this.babies = babies;
    if (babies.length > 0) {
      this.babyX = babies[0].x; this.babyZ = babies[0].z;
      this.placentaX = babies[0].placentaX; this.placentaZ = babies[0].placentaZ;
    }
    this.bubbles = this.level.spots.map((sp, i) => ({
      anchorX: sp[0] * spotScale, anchorZ: sp[1] * spotScale, baseY: sp[2],
      phase: i * 1.37, cardId: this.level.cardIds[i], curX: sp[0] * spotScale, curZ: sp[1] * spotScale,
      collected: false }));
    this.reset();
  }
  reset() {
    this.playerX = 0; this.playerZ = -(this.radius - 1.4); this.yaw = 0.35; this.pitch = 0;
    this.walkCycle = 0; this.playerY = EYE_HEIGHT;
    this.velX = 0; this.velY = 0; this.velZ = 0; this.strokePhase = 0.25; this.wasMoving = false;
    this.motherState = MOTHER_REST; this.stateT = 0; this.stateDur = 13;
    this.swayX = 0; this.swayZ = 0; this.tiltRoll = 0; this.tiltPitch = 0; this.wallSqueeze = 0;
    this.swishT = -1; this.swishStrength = 0; this.bubbleSwishX = 0; this.bubbleSwishZ = 0;
    this.collectedCount = 0; this.lineCursor = 0; this.worldTime = 0;
    this.nextSwishAt = 14 + this.nextRand() * 8;
    this.kicksFelt = 0; this.kickPulse = 0; this.nextKickAt = this.level.kickMin * 0.7;
    this.kickPending = false; this.gameComplete = false;
    this.yourKicks = 0; this.yourKickPulse = 0; this.lastYourKickAt = -9;
    this.heartBabyIndex = 0; this.heartsVisited = 0;
    for (const b of this.babies) b.heartVisited = false;
    for (const b of this.bubbles) { b.collected = false; b.curX = b.anchorX; b.curZ = b.anchorZ; }
  }
  babyRadius() { return this.babies.length > 0 ? this.babies[0].radius() : 1.35 * this.level.babyScale; }
  won() { return this.collectedCount >= this.bubbles.length; }
  distanceToBaby() {
    let best = Infinity;
    for (const b of this.babies) best = Math.min(best, dist2d(this.playerX, this.playerZ, b.x, b.z));
    return best;
  }
  nearBabyB(b) { return dist2d(this.playerX, this.playerZ, b.x, b.z) < 2.7 * (0.6 + 0.4 * b.scale) + 0.55; }
  heartBaby() {
    if (!this.won() || this.heartBabyIndex < 0 || this.heartBabyIndex >= this.babies.length) return null;
    return this.babies[this.heartBabyIndex];
  }
  babyProximity() { return clamp(1.0 - this.distanceToBaby() / (this.radius * 1.6), 0, 1); }
  nearestBubbleDistance() {
    let best = -1;
    for (const b of this.bubbles) {
      if (b.collected) continue;
      const d = dist2d(this.playerX, this.playerZ, b.curX, b.curZ);
      if (best < 0 || d < best) best = d;
    }
    return best;
  }
  bubbleHint() {
    if (this.fetusMode) {
      if (!this.won()) return "You are the baby. Swim, listen for the golden sounds — and KICK so mom feels you!";
      if (this.yourKicks < KICKS_TO_WIN) return "You've heard every sound! Now kick for mom — " + this.yourKicks + " of " + KICKS_TO_WIN + " kicks. Press KICK!";
      return "What a busy day for a baby.";
    }
    if (this.won()) {
      if (this.babyCount > 1) return "All bubbles found! The golden heart hops from baby to baby — visit every one! (" + this.heartsVisited + " of " + this.babies.length + " visited)";
      return "All bubbles found — the golden heart glows by the baby. Go to the baby!";
    }
    const d = this.nearestBubbleDistance();
    if (d < 0) return "";
    if (d < 2.5) return "A sound bubble is VERY close — look around you!";
    if (d < 5.0) return "Warmer… a sound bubble is near.";
    if (d < 8.5) return "Warm… a sound bubble is out there.";
    return "Cold… no bubble nearby. The gold dots on the map show them.";
  }
  consumeKick() { if (!this.kickPending) return false; this.kickPending = false; return true; }
  triggerSwish(dx, dz) {
    let l = Math.hypot(dx, dz);
    if (l < 1e-6) { dx = 1; dz = 0; l = 1; }
    this.swishDirX = dx / l; this.swishDirZ = dz / l; this.swishT = 0;
  }
  update(dt, moveF, moveS) {
    dt = clamp(dt, 0, 0.05);
    this.worldTime += dt;
    if (this.kickPulse > 0) this.kickPulse = Math.max(0, this.kickPulse - dt * 1.8);
    if (this.worldTime >= this.nextKickAt) {
      this.kickPulse = 1; this.kicksFelt++; this.kickPending = true;
      this.nextKickAt = this.worldTime + this.level.kickMin + ((this.kicksFelt * 7.31) % this.level.kickVar);
    }
    this.updateMother(dt);
    this.updateSwish(dt);
    for (const b of this.bubbles) {
      if (b.collected) continue;
      if (this.level.drift) {
        b.curX = b.anchorX + Math.sin(this.worldTime * 0.13 + b.phase) * 0.9 + this.bubbleSwishX;
        b.curZ = b.anchorZ + Math.cos(this.worldTime * 0.10 + b.phase * 1.3) * 0.9 + this.bubbleSwishZ;
      } else { b.curX = b.anchorX + this.bubbleSwishX; b.curZ = b.anchorZ + this.bubbleSwishZ; }
    }
    const len = Math.hypot(moveF, moveS);
    this.moving = len > 0.12;
    let surge = 0;
    if (this.moving) {
      if (!this.wasMoving) this.strokePhase = 0.16;
      this.strokePhase = (this.strokePhase + dt * 1.45) % 1.0;
      surge = Math.pow(Math.max(0, Math.sin(this.strokePhase * Math.PI * 2)), 1.4);
      const scale = len > 1 ? 1 / len : 1;
      const pitchRad = this.pitch * 1.35;
      const fx = forwardX(this.yaw) * Math.cos(pitchRad), fz = forwardZ(this.yaw) * Math.cos(pitchRad);
      const fy = Math.sin(pitchRad);
      let dirX = (fx * moveF + rightX(this.yaw) * moveS) * scale;
      let dirZ = (fz * moveF + rightZ(this.yaw) * moveS) * scale;
      let dirY = fy * moveF * scale;
      for (const bb of this.babies) {
        const bdx = this.playerX - bb.x, bdz = this.playerZ - bb.z;
        const bd = Math.hypot(bdx, bdz);
        if (bd < bb.radius() + PLAYER_RADIUS + 0.05 && bd > 1e-6) {
          const nx = bdx / bd, nz = bdz / bd;
          let rad = dirX * nx + dirZ * nz;
          const tx = dirX - rad * nx, tz = dirZ - rad * nz;
          if (rad < 0) rad = 0;
          dirX = rad * nx + tx * 0.03; dirZ = rad * nz + tz * 0.03;
        }
      }
      const paddle = 3.6 * (0.35 + 0.85 * surge);
      this.playerX += dirX * paddle * dt; this.playerZ += dirZ * paddle * dt; this.playerY += dirY * paddle * dt;
      const thrust = 6.4 * (0.35 + 0.85 * surge);
      this.velX += dirX * thrust * dt; this.velZ += dirZ * thrust * dt; this.velY += dirY * thrust * dt;
      this.walkCycle += dt * (2.0 + 3.0 * surge);
    }
    this.wasMoving = this.moving;
    this.velY += (NEUTRAL_Y - this.playerY) * 0.55 * dt + Math.sin(this.worldTime * 0.8) * 0.05 * dt;
    this.velX += this.swayX * dt; this.velZ += this.swayZ * dt;
    if (this.swishT >= 0) {
      this.velX += this.swishDirX * this.swishStrength * 4.2 * dt;
      this.velZ += this.swishDirZ * this.swishStrength * 4.2 * dt;
    }
    const dragF = Math.exp(-dt * (this.moving ? 2.4 : 1.7));
    this.velX *= dragF; this.velZ *= dragF; this.velY *= Math.exp(-dt * 2.2);
    this.playerX += this.velX * dt; this.playerY += this.velY * dt; this.playerZ += this.velZ * dt;
    if (this.playerY < 0.5) { this.playerY = 0.5; this.velY = Math.max(0, this.velY); }
    if (this.playerY > WALL_HEIGHT - 0.5) { this.playerY = WALL_HEIGHT - 0.5; this.velY = Math.min(0, this.velY); }
    const dc = Math.hypot(this.playerX, this.playerZ);
    const maxR = this.radius - PLAYER_RADIUS - 0.35;
    if (dc > maxR && dc > 1e-6) {
      this.playerX *= maxR / dc; this.playerZ *= maxR / dc;
      const nx = this.playerX / maxR, nz = this.playerZ / maxR;
      const vn = this.velX * nx + this.velZ * nz;
      if (vn > 0) { this.velX -= vn * nx; this.velZ -= vn * nz; }
    }
    for (const bb of this.babies) {
      const db = dist2d(this.playerX, this.playerZ, bb.x, bb.z);
      const minB = bb.radius() + PLAYER_RADIUS;
      if (db < minB && db > 1e-6) {
        this.playerX = bb.x + (this.playerX - bb.x) * (minB / db);
        this.playerZ = bb.z + (this.playerZ - bb.z) * (minB / db);
        const nx2 = (this.playerX - bb.x) / minB, nz2 = (this.playerZ - bb.z) / minB;
        let vr = this.velX * nx2 + this.velZ * nz2;
        const vtx = this.velX - vr * nx2, vtz = this.velZ - vr * nz2;
        if (vr < 0) vr = 0;
        this.velX = vr * nx2 + vtx * 0.5; this.velZ = vr * nz2 + vtz * 0.5;
      }
    }
    if (this.yourKickPulse > 0) this.yourKickPulse = Math.max(0, this.yourKickPulse - dt * 1.6);
    if (this.fetusMode && this.won() && !this.gameComplete && this.yourKicks >= KICKS_TO_WIN) this.gameComplete = true;
    if (!this.fetusMode && this.won() && !this.gameComplete) {
      const hb = this.heartBaby();
      if (hb && this.nearBabyB(hb)) {
        hb.heartVisited = true; this.heartsVisited++; this.heartBabyIndex++;
        if (this.heartBabyIndex >= this.babies.length) { this.heartBabyIndex = -1; this.gameComplete = true; }
      }
    }
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      if (!b.collected && dist2d(this.playerX, this.playerZ, b.curX, b.curZ) < 1.4) {
        b.collected = true; this.collectedCount++;
        return i;
      }
    }
    return -1;
  }
  updateMother(dt) {
    this.stateT += dt;
    if (this.stateT >= this.stateDur) {
      this.stateT = 0;
      const r = this.nextRand();
      let next;
      if (this.motherState === MOTHER_WALK) next = MOTHER_REST;
      else if (r < 0.42) next = MOTHER_REST;
      else if (r < 0.72) next = MOTHER_WALK;
      else if (r < 0.88) next = MOTHER_ROLL;
      else next = this.levelIndex >= 1 ? MOTHER_CONTRACT : MOTHER_WALK;
      this.motherState = next;
      this.stateDur = next === MOTHER_REST ? 10 + this.nextRand() * 9
        : next === MOTHER_WALK ? 9 + this.nextRand() * 6
        : next === MOTHER_ROLL ? 6 + this.nextRand() * 3
        : 5 + this.nextRand() * 3;
      this.stateHeading = this.nextRand() * Math.PI * 2;
      this.stateChanged = true;
    }
    const t = this.stateT;
    if (this.motherState === MOTHER_WALK) {
      const stride = Math.sin(t * (Math.PI * 2 / 1.55));
      const env = Math.min(1, t / 1.2) * Math.min(1, (this.stateDur - t) / 1.2);
      this.swayX = Math.cos(this.stateHeading) * stride * 1.05 * env;
      this.swayZ = Math.sin(this.stateHeading) * stride * 1.05 * env;
      this.tiltRoll = stride * 0.028 * env; this.tiltPitch = Math.abs(stride) * 0.012 * env;
      this.wallSqueeze = 0;
    } else if (this.motherState === MOTHER_ROLL) {
      const env = Math.sin(Math.PI * Math.min(1, t / this.stateDur));
      this.tiltRoll = 0.16 * env; this.tiltPitch = 0.05 * env;
      this.swayX = Math.cos(this.stateHeading) * env * 0.55;
      this.swayZ = Math.sin(this.stateHeading) * env * 0.55;
      this.wallSqueeze = 0;
    } else if (this.motherState === MOTHER_CONTRACT) {
      this.wallSqueeze = Math.sin(Math.PI * Math.min(1, t / this.stateDur));
      this.swayX = 0; this.swayZ = 0; this.tiltRoll = 0; this.tiltPitch = 0;
    } else {
      this.swayX = Math.sin(this.worldTime * 0.23) * 0.12;
      this.swayZ = Math.cos(this.worldTime * 0.19) * 0.12;
      this.tiltRoll = Math.sin(this.worldTime * 0.23) * 0.008; this.tiltPitch = 0;
      this.wallSqueeze = 0;
    }
  }
  updateSwish(dt) {
    if (this.swishT < 0 && this.worldTime >= this.nextSwishAt) {
      const a = this.nextRand() * Math.PI * 2;
      this.triggerSwish(Math.cos(a), Math.sin(a));
    }
    if (this.swishT >= 0) {
      this.swishT += dt;
      if (this.swishT >= 5.0) {
        this.swishT = -1; this.swishStrength = 0;
        this.nextSwishAt = this.worldTime + 15 + this.nextRand() * 22;
      } else this.swishStrength = Math.sin(Math.PI * this.swishT / 5.0);
    }
    if (this.swishStrength > 0.01) {
      this.bubbleSwishX += this.swishDirX * this.swishStrength * dt * 0.85;
      this.bubbleSwishZ += this.swishDirZ * this.swishStrength * dt * 0.85;
    }
    const settle = Math.exp(-dt * 0.35);
    this.bubbleSwishX *= settle; this.bubbleSwishZ *= settle;
  }
  nextBubbleLine() {
    const lines = this.level.lines;
    const s = lines[Math.min(this.lineCursor, lines.length - 1)];
    this.lineCursor++;
    return s;
  }
}

// ------------------------------------------------------------ WebAudio womb (port of WombSoundEngine's recipes)
const WombAudio = {
  ctx: null, master: null, noiseGain: null, noiseFilter: null,
  started: false, muted: false,
  heartbeatLevel: 0.9, whooshLevel: 0.8, talkingLevel: 0.15,
  lastBeatCtxTime: -9, beatPeriod: 60 / 68, nextBeatTime: 0, schedTimer: null,
  nextGurgleAt: 0, nextMurmurAt: 0,
  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.baseVolume;
      this.master.connect(this.ctx.destination);
      // the whoosh: endless filtered water-noise
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lp += 0.04 * (w - lp); d[i] = lp * 2.4; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = "lowpass"; this.noiseFilter.frequency.value = 420;
      this.noiseGain = this.ctx.createGain(); this.noiseGain.gain.value = 0.08;
      src.connect(this.noiseFilter); this.noiseFilter.connect(this.noiseGain); this.noiseGain.connect(this.master);
      src.start();
      this.nextBeatTime = this.ctx.currentTime + 0.1;
      this.schedTimer = setInterval(() => this.schedule(), 90);
      this.nextGurgleAt = this.ctx.currentTime + 2;
      this.nextMurmurAt = this.ctx.currentTime + 3;
      this.started = true;
    } catch (e) { /* sound is a garnish, never a crash */ }
  },
  heartbeatEnvelope(phase) { // the Java WombMath recipe
    let v = 0;
    if (phase >= 0 && phase < 0.22) v += Math.exp(-phase * 16);
    const dub = phase - 0.27;
    if (dub >= 0 && dub < 0.20) v += 0.65 * Math.exp(-dub * 18);
    return Math.min(1, v);
  },
  beatEnvNow() {
    if (!this.ctx || this.lastBeatCtxTime < 0) return 0;
    const phase = (this.ctx.currentTime - this.lastBeatCtxTime) % this.beatPeriod;
    return this.heartbeatEnvelope(phase);
  },
  thump(at, vol, when) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 260;
    o.type = "sine";
    o.frequency.setValueAtTime(56, at);
    o.frequency.exponentialRampToValueAtTime(40, at + 0.10);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, at + when);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(at); o.stop(at + when + 0.05);
  },
  schedule() {
    if (!this.ctx) return;
    const c = this.ctx;
    this.beatPeriod = 60 / (68 * world.bpmScale());
    while (this.nextBeatTime < c.currentTime + 0.28) {
      const t = Math.max(this.nextBeatTime, c.currentTime + 0.01);
      const v = 0.85 * this.heartbeatLevel;
      this.thump(t, v, 0.30);            // lub
      this.thump(t + 0.27, v * 0.62, 0.24); // dub
      this.lastBeatCtxTime = t;
      this.nextBeatTime += this.beatPeriod;
    }
    // tummy gurgles, now and then
    if (c.currentTime >= this.nextGurgleAt) {
      this.nextGurgleAt = c.currentTime + 1.5 + Math.random() * 5;
      const t = c.currentTime + 0.02;
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.28);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.10);
      g.gain.linearRampToValueAtTime(0, t + 0.28);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.32);
    }
    // muffled voices from outside: little syllable bursts
    if (c.currentTime >= this.nextMurmurAt && this.talkingLevel > 0.01) {
      this.nextMurmurAt = c.currentTime + 0.7 + Math.random() * 2.4;
      let t = c.currentTime + 0.02;
      const base = 105 + Math.random() * 45;
      const syllables = 2 + (Math.random() * 3 | 0);
      for (let s = 0; s < syllables; s++) {
        const dur = 0.10 + Math.random() * 0.16;
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = "sawtooth"; o.frequency.value = base * (0.92 + Math.random() * 0.16);
        f.type = "lowpass"; f.frequency.value = 480;
        const amp = (Math.random() < 0.3 ? 0 : 0.028 + Math.random() * 0.03) * (this.talkingLevel / 0.15);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + dur * 0.4);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.03);
        t += dur + 0.03;
      }
    }
  },
  frame(dt, opts) { // per-frame levels from the game loop
    if (!this.ctx || !this.noiseGain) return;
    const target = (0.045 + 0.10 * opts.prox) * this.whooshLevel
      * (1 + 0.9 * opts.swish) * (opts.moving ? 1.5 : 1.0) * (opts.motherWalking ? 1.35 : 1.0);
    this.noiseGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
  },
  chime(n) {
    if (!this.ctx) return;
    try {
      const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const f0 = notes[n % notes.length];
      const t = this.ctx.currentTime + 0.01;
      for (const [mult, amp, dur] of [[1, 0.22, 0.9], [2, 0.07, 0.45], [3, 0.03, 0.25]]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = "sine"; o.frequency.value = f0 * mult;
        g.gain.setValueAtTime(amp, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.05);
      }
    } catch (e) { }
  },
  bigThump() { if (this.ctx) this.thump(this.ctx.currentTime + 0.01, 1.0, 0.4); },
  baseVolume: 0.9,
  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.baseVolume, this.ctx.currentTime, 0.05);
  },
  setVolume(v) {
    this.baseVolume = v;
    if (this.master && this.ctx && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
};

// ------------------------------------------------------------ mom's voice (speechSynthesis — the PC's TTS)
const MomVoice = {
  enabled: true, lastSayAt: 0, cursor: 0, voice: null,
  init() {
    try {
      const pick = () => {
        const vs = speechSynthesis.getVoices();
        this.voice = vs.find(v => /zira|samantha|female|jenny|aria/i.test(v.name))
          || vs.find(v => /^en[-_]US/i.test(v.lang) && /google/i.test(v.name))
          || vs.find(v => /^en/i.test(v.lang)) || vs[0] || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    } catch (e) { }
  },
  pickLine(bank) { const s = bank[this.cursor % bank.length]; this.cursor++; return s; },
  say(line, urgent) {
    if (!this.enabled || !line) return;
    try {
      const now = performance.now();
      if (!urgent && now - this.lastSayAt < 9000) return;
      if (speechSynthesis.speaking && !urgent) return;
      const u = new SpeechSynthesisUtterance(line);
      if (this.voice) u.voice = this.voice;
      u.pitch = 1.12; u.rate = 0.94; u.volume = 0.85;
      this.lastSayAt = now;
      speechSynthesis.speak(u);
    } catch (e) { }
  }
};

// ------------------------------------------------------------ the 3D womb (Three.js)
const world = new WombWorld();
// ------------------------------------------------------------ graphics modes (his naming, kept verbatim)
// 😖 "Ouch — Budget Mode": heroic little laptops. 👑 "I Could Run KH3 On This": the full flex.
// 🕹 "Early 2K Mode": PS2 soul. 📺 "Early 90s Mode" aka PS1 graphics: wobble and crunch.
const CHAMBER_H = 3.6;
const GFX = {
  budget: { label: "😖 Ouch", resMode: "cap", prCap: 1, prScale: 0.8, segW: 28, segH: 18, wallRepeat: 2, motes: 90, vernix: false, sparkles: false, fog: 0.027, glow: 1.4, babySeg: 20, flat: false, snap: 0, tex: "linear", pixelated: false, shadow: 0, moteSize: 0.30 },
  kh3:    { label: "👑 KH3",  resMode: "cap", prCap: 2, prScale: 1.0, segW: 72, segH: 44, wallRepeat: 4, motes: 360, vernix: true, sparkles: true, fog: 0.015, glow: 2.2, babySeg: 32, flat: false, snap: 0, tex: "aniso", pixelated: false, shadow: 2048, moteSize: 0.30 },
  ps2:    { label: "🕹 2K",   resMode: "fixed", fixedH: 480, segW: 36, segH: 24, wallRepeat: 3, motes: 160, vernix: true, sparkles: false, fog: 0.023, glow: 1.7, babySeg: 20, flat: false, snap: 0, tex: "linear", pixelated: false, shadow: 1024, moteSize: 0.34 },
  ps1:    { label: "📺 PS1",  resMode: "fixed", fixedH: 240, segW: 18, segH: 12, wallRepeat: 2, motes: 44, vernix: false, sparkles: false, fog: 0.034, glow: 1.25, babySeg: 10, flat: true, snap: 192, tex: "nearest", pixelated: true, shadow: 0, moteSize: 0.52 }
};
const GFX_ORDER = ["kh3", "budget", "ps2", "ps1"];
// ---- painted surface textures: the FusionFall coat (canvas-painted,
// saturated, a little storybook). Siding/shingle/concrete are drawn
// light so a material colour can tint them; the rest stand alone.
const sidingTexture = () => { const t = canvasTexture((g, s) => {
  g.fillStyle = "#f4ecd9"; g.fillRect(0, 0, s, s);
  const rows = 8, rh = s / rows;
  for (let r = 0; r < rows; r++) {
    g.fillStyle = r % 2 ? "#eee3c9" : "#f8efdb"; g.fillRect(0, r * rh, s, rh);
    g.fillStyle = "rgba(122,100,70,0.55)"; g.fillRect(0, r * rh + rh - 2, s, 2);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(0, r * rh, s, 1);
  }
  for (let i = 0; i < 240; i++) { g.fillStyle = "rgba(140,120,90,0.07)"; g.fillRect(Math.random() * s, Math.random() * s, 3, 2); }
}, 256); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; };
const shingleTexture = () => { const t = canvasTexture((g, s) => {
  g.fillStyle = "#ddd4c6"; g.fillRect(0, 0, s, s);
  const rows = 6, rh = s / rows, sw = s / 4;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c < 5; c++) {
      g.fillStyle = ["#d9cfbf", "#e4dacb", "#cfc2ae"][(Math.random() * 3) | 0];
      g.fillRect(c * sw + (r % 2 ? sw / 2 : 0) + 1, r * rh + 1, sw - 2, rh - 2);
    }
    g.fillStyle = "rgba(92,76,60,0.6)"; g.fillRect(0, r * rh + rh - 2, s, 2);
  }
}, 256); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t; };
const grassTexture = () => { const t = canvasTexture((g, s) => {
  g.fillStyle = "#68ab51"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1100; i++) { g.fillStyle = ["#5c9c46", "#76b862", "#61a34b", "#81c06b"][(Math.random() * 4) | 0]; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
  g.strokeStyle = "rgba(43,90,33,0.35)"; g.lineWidth = 1;
  for (let i = 0; i < 240; i++) { const x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 2 - 1, y - 3 - Math.random() * 3); g.stroke(); }
}, 256); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const asphaltTexture = () => { const t = canvasTexture((g, s) => {
  g.fillStyle = "#3b3e44"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.16)"; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  g.strokeStyle = "rgba(0,0,0,0.22)";
  for (let i = 0; i < 5; i++) { g.beginPath(); let x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30 - 15; g.lineTo(x, y); } g.stroke(); }
}, 256); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 2); return t; };
const concreteTexture = () => { const t = canvasTexture((g, s) => {
  g.fillStyle = "#ccc4b2"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 800; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(90,80,60,0.08)"; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  g.fillStyle = "rgba(96,86,70,0.65)";
  g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s); g.fillRect(s / 2, 0, 2, s); g.fillRect(0, s / 2, s, 2);
}, 256); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; };
const leafTexture = () => { const t = canvasTexture((g, s) => {
  g.fillStyle = "#589a46"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = ["#3f7d33", "#68ad54", "#77ba60", "#4c8a3d"][(Math.random() * 4) | 0];
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 4, 0, 7); g.fill();
  }
  for (let i = 0; i < 130; i++) { g.fillStyle = "rgba(160,220,130,0.5)"; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1.5, 0, 7); g.fill(); }
}, 256); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const skyGradientTexture = () => { const t = canvasTexture((g, s) => {
  const gr = g.createLinearGradient(0, 0, 0, s);
  gr.addColorStop(0, "#2b6cd4"); gr.addColorStop(0.42, "#67a9e8"); gr.addColorStop(0.74, "#bcdcf2"); gr.addColorStop(0.92, "#f4e3bc"); gr.addColorStop(1, "#f7e8c4");
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
}, 512); t.encoding = THREE.sRGBEncoding; return t; };
let gfxMode = "kh3";
function nextGfx() { return GFX_ORDER[(GFX_ORDER.indexOf(gfxMode) + 1) % GFX_ORDER.length]; }
function pixelRatioFor(g) {
  if (g.resMode === "fixed") return clamp(g.fixedH / (window.innerHeight || 800), 0.15, 1);
  return Math.min(window.devicePixelRatio || 1, g.prCap) * g.prScale;
}
/** Standard material, dressed per era: flat facets + vertex wobble for PS1. */
function stdMat(params) {
  const g = GFX[gfxMode];
  const m = new THREE.MeshStandardMaterial(params);
  if (g.flat) m.flatShading = true;
  if (g.snap > 0) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSnap = { value: new THREE.Vector2(g.snap, Math.round(g.snap * 0.625)) };
      sh.vertexShader = ("uniform vec2 uSnap;\n" + sh.vertexShader).replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap) / uSnap * gl_Position.w;");
    };
    m.customProgramCacheKey = () => "womb-snap-" + gfxMode;
  }
  return m;
}
let renderer, scene, camera, chamber, floorMesh, heartLight;
let babyGroups = [], bubbleGroups = [], placentaMeshes = [], cordMeshes = [], selfCord = null, selfPlacenta = null;
let heartSprite = null, particles = null, vernix = null, sparkles = null;
let kickShake = 0;

function canvasTexture(draw, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  return t;
}
const softDotTex = () => canvasTexture((g, s) => {
  const r = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s);
}, 64);
const glowTex = () => canvasTexture((g, s) => {
  const r = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  r.addColorStop(0, "rgba(255,205,90,0.9)"); r.addColorStop(0.35, "rgba(255,170,60,0.35)"); r.addColorStop(1, "rgba(255,150,50,0)");
  g.fillStyle = r; g.fillRect(0, 0, s, s);
}, 128);
const noteTex = () => canvasTexture((g, s) => {
  g.fillStyle = "#fff3cf"; g.font = "bold " + (s * 0.72) + "px Georgia, serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("♪", s/2, s/2 + s * 0.04);
}, 96);
const heartTex = () => canvasTexture((g, s) => {
  g.fillStyle = "#ffd34d";
  g.strokeStyle = "#a86e14"; g.lineWidth = s * 0.03;
  const cx = s/2, cy = s/2, r = s * 0.30;
  g.beginPath();
  g.moveTo(cx, cy + r * 1.05);
  g.bezierCurveTo(cx - r * 1.5, cy - r * 0.15, cx - r * 0.72, cy - r * 1.25, cx, cy - r * 0.42);
  g.bezierCurveTo(cx + r * 0.72, cy - r * 1.25, cx + r * 1.5, cy - r * 0.15, cx, cy + r * 1.05);
  g.fill(); g.stroke();
}, 128);
const faceTex = () => canvasTexture((g, s) => {
  g.clearRect(0, 0, s, s);
  g.strokeStyle = "rgba(96,44,40,0.92)"; g.lineWidth = s * 0.022; g.lineCap = "round";
  // sleeping eyes: two calm downward arcs
  for (const ex of [0.36, 0.64]) {
    g.beginPath(); g.arc(s * ex, s * 0.44, s * 0.075, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  }
  // tiny nose + dreaming mouth
  g.beginPath(); g.arc(s * 0.5, s * 0.56, s * 0.03, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(s * 0.5, s * 0.63, s * 0.05, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
  // rosy cheeks
  g.fillStyle = "rgba(255,120,120,0.4)";
  g.beginPath(); g.arc(s * 0.28, s * 0.58, s * 0.075, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(s * 0.72, s * 0.58, s * 0.075, 0, Math.PI * 2); g.fill();
}, 256);

let TEX = {};
function loadTextures() {
  const loader = new THREE.TextureLoader();
  const mk = (url, repeat) => {
    const t = loader.load(url);
    t.encoding = THREE.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  };
  TEX.wall = mk("assets/wall_texture.png", 3);
  TEX.placenta = mk("assets/placenta_texture.png", 0);
  TEX.skin = mk("assets/baby_skin.png", 0);
  TEX.soft = softDotTex(); TEX.glow = glowTex(); TEX.note = noteTex();
  TEX.heart = heartTex(); TEX.face = faceTex();
}

function cordPoints(px, py, pz, bx, by, bz, n) {
  const pts = [];
  const dx = bx - px, dz = bz - pz;
  const pl = Math.hypot(dx, dz) || 1;
  const perpx = -dz / pl, perpz = dx / pl;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wave = Math.sin(t * Math.PI * 3) * 0.35 * Math.sin(t * Math.PI);
    pts.push(new THREE.Vector3(
      px + dx * t + perpx * wave,
      py + (by - py) * t - Math.sin(t * Math.PI) * 0.55 + Math.sin(t * 9.0) * 0.12,
      pz + dz * t + perpz * wave));
  }
  return pts;
}
function makeCord(px, py, pz, bx, by, bz, r, color) {
  const curve = new THREE.CatmullRomCurve3(cordPoints(px, py, pz, bx, by, bz, 12));
  const geo = new THREE.TubeGeometry(curve, 42, r, 7, false);
  const mat = stdMat({ color: color || 0xd9c9de, roughness: 0.5, metalness: 0.0, emissive: 0x140a18 });
  return new THREE.Mesh(geo, mat);
}
function makePlacenta(x, z, R) {
  const bs = GFX[gfxMode].babySeg;
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, bs + 10, bs + 6),
    stdMat({ map: TEX.placenta, roughness: 0.65, emissive: 0x1c0508 }));
  const l = Math.hypot(x, z) || 1;
  m.position.set(x / l * (R - 0.55), PLACENTA_Y, z / l * (R - 0.55));
  m.scale.set(1, 0.36, 1);
  m.lookAt(0, PLACENTA_Y, 0);
  return m;
}
function makeBaby(b) {
  const grp = new THREE.Group();
  const bs = GFX[gfxMode].babySeg;
  const skinMat = stdMat({ map: TEX.skin, roughness: 0.48, metalness: 0.0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.02 * b.scale, bs + 8, bs + 2), skinMat);
  body.scale.set(0.95, 1.08, 0.9);
  grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.54 * b.scale, bs + 4, bs), skinMat);
  head.position.set(0.16 * b.scale, 0.82 * b.scale, 0.30 * b.scale);
  grp.add(head);
  const ear = new THREE.Mesh(new THREE.SphereGeometry(0.16 * b.scale, 14, 10), skinMat);
  ear.position.set(0.62 * b.scale, 0.86 * b.scale, 0.18 * b.scale);
  grp.add(ear);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78 * b.scale, 0.78 * b.scale),
    new THREE.MeshBasicMaterial({ map: TEX.face, transparent: true, depthWrite: false }));
  face.position.set(0.16 * b.scale, 0.82 * b.scale, 0.30 * b.scale + 0.50 * b.scale);
  grp.add(face);
  grp.position.set(b.x, 1.35 * b.scale, b.z);
  grp.lookAt(0, 1.35 * b.scale, 0);
  return grp;
}
function makeBubble() {
  const grp = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc444, transparent: true, opacity: 0.88 }));
  grp.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const gs = GFX[gfxMode].glow;
  glow.scale.set(gs, gs, 1);
  grp.add(glow);
  const note = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.note, transparent: true, depthWrite: false }));
  note.scale.set(0.55, 0.55, 1);
  note.position.z = 0.1;
  grp.add(note);
  return grp;
}
function makeParticles(count, size, color, opacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const dat = [];
  const R = world.radius;
  for (let i = 0; i < count; i++) {
    let x, z;
    do { x = (Math.random() * 2 - 1) * R * 0.92; z = (Math.random() * 2 - 1) * R * 0.92; } while (Math.hypot(x, z) > R * 0.92);
    pos[i * 3] = x; pos[i * 3 + 1] = 0.25 + Math.random() * 4.6; pos[i * 3 + 2] = z;
    dat.push({ ph: Math.random() * Math.PI * 2, sp: 0.3 + Math.random() * 0.7 });
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size, map: TEX.soft, color, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.userData.dat = dat;
  return pts;
}

function initGL() {
  const canvas = document.getElementById("gl");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x33070f);
  scene.fog = new THREE.FogExp2(0x450c17, GFX[gfxMode].fog);
  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 260);
  scene.add(new THREE.HemisphereLight(0xffd9c9, 0x48101e, 1.0));
  const key = new THREE.PointLight(0xffa183, 1.15, 0, 0);
  key.name = "followLight";
  scene.add(key);
  heartLight = new THREE.PointLight(0xffc444, 0, 26, 1.6);
  scene.add(heartLight);
  window.addEventListener("resize", () => {
    renderer.setPixelRatio(pixelRatioFor(GFX[gfxMode])); // fixed-height eras track the window
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
}

/** (Re)build everything that depends on the level / baby count / mode. */
function rebuildWorld() {
  for (const m of [chamber, floorMesh, heartSprite, particles, vernix, sparkles, selfCord, selfPlacenta]) if (m) scene.remove(m);
  for (const g of babyGroups) scene.remove(g);
  for (const g of bubbleGroups) scene.remove(g);
  for (const m of placentaMeshes) scene.remove(m);
  for (const m of cordMeshes) scene.remove(m);
  babyGroups = []; bubbleGroups = []; placentaMeshes = []; cordMeshes = [];
  selfCord = null; selfPlacenta = null;
  const R = world.radius;
  const g = GFX[gfxMode];
  TEX.wall.repeat.set(g.wallRepeat, g.wallRepeat);

  chamber = new THREE.Mesh(
    new THREE.SphereGeometry(1, g.segW, g.segH),
    stdMat({ map: TEX.wall, side: THREE.BackSide, roughness: 1.0, metalness: 0,
      emissive: 0x38060d, emissiveIntensity: 0.4, emissiveMap: TEX.wall }));
  chamber.scale.set(R, CHAMBER_H, R);
  scene.add(chamber);

  floorMesh = new THREE.Mesh(
    new THREE.CircleGeometry(R, g.segW + 12),
    stdMat({ map: TEX.wall, color: 0x8a5a52, roughness: 1 }));
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0.02;
  scene.add(floorMesh);

  world.babies.forEach((b, i) => {
    const grp = makeBaby(b);
    grp.userData.phase = i * 1.7;
    babyGroups.push(grp); scene.add(grp);
    const pm = makePlacenta(b.placentaX, b.placentaZ, R);
    placentaMeshes.push(pm); scene.add(pm);
    const cord = makeCord(b.placentaX, PLACENTA_Y, b.placentaZ, b.x, 1.35 * b.scale, b.z, 0.085 * b.scale + 0.02);
    cordMeshes.push(cord); scene.add(cord);
  });
  if (world.fetusMode) {
    selfPlacenta = makePlacenta(world.selfPlacentaX, world.selfPlacentaZ, R);
    scene.add(selfPlacenta);
  }
  world.bubbles.forEach(() => {
    const g = makeBubble();
    bubbleGroups.push(g); scene.add(g);
  });
  heartSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.heart, transparent: true, depthWrite: false }));
  heartSprite.scale.set(1.15, 1.15, 1);
  heartSprite.visible = false;
  scene.add(heartSprite);

  particles = makeParticles(360, g.moteSize, 0xffd9c0, 0.42);
  particles.geometry.setDrawRange(0, g.motes);
  scene.add(particles);
  vernix = makeParticles(80, gfxMode === "ps1" ? 0.62 : 0.5, 0xfff2df, 0.30);
  vernix.visible = g.vernix;
  scene.add(vernix);
  sparkles = makeParticles(170, 0.15, 0xffe9b0, 0.8);
  sparkles.visible = g.sparkles;
  scene.add(sparkles);
}

/** Apply the current graphics mode everywhere it matters, live. */
function applyGraphics() {
  const g = GFX[gfxMode];
  if (renderer) {
    renderer.setPixelRatio(pixelRatioFor(g));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (scene && scene.fog) scene.fog.density = g.fog;
    const cv = document.getElementById("gl");
    if (cv) cv.style.imageRendering = g.pixelated ? "pixelated" : "auto";
    for (const t of [TEX.wall, TEX.placenta, TEX.skin]) {
      if (!t) continue;
      if (g.tex === "nearest") {
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      } else {
        t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      }
      t.anisotropy = g.tex === "aniso" ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
      t.needsUpdate = true;
    }
  }
  const btn = document.getElementById("gfxBtn");
  if (btn) btn.textContent = g.label;
  document.querySelectorAll("#gfxRow button").forEach(b =>
    b.classList.toggle("sel", b.dataset.g === gfxMode));
  if (scene) rebuildWorld();
}
function setGfx(m) {
  if (!GFX[m]) return;
  gfxMode = m;
  try { localStorage.setItem("awpc_gfx", JSON.stringify(m)); } catch (e) { }
  applyGraphics();
}

let selfCordAt = 0;
function refreshSelfCord(now) {
  if (!world.fetusMode) return;
  if (now - selfCordAt < 0.15) return;
  selfCordAt = now;
  if (selfCord) { scene.remove(selfCord); selfCord.geometry.dispose(); }
  // The cord runs to YOUR tummy: it dives to a point below and just in
  // front of the eye, so it slips out of the bottom of the view (behind
  // the belly mound) instead of spearing the camera.
  const fx = Math.sin(world.yaw), fz = Math.cos(world.yaw);
  selfCord = makeCord(world.selfPlacentaX, PLACENTA_Y, world.selfPlacentaZ,
    world.playerX + fx * 0.30, world.playerY - 1.15, world.playerZ + fz * 0.30,
    0.045 * world.selfScale + 0.012, 0xc9a8c0);
  scene.add(selfCord);
}

// ------------------------------------------------------------ UI, input, loop
const $ = id => document.getElementById(id);
const prefs = {
  get(k, d) { try { const v = localStorage.getItem("awpc_" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("awpc_" + k, JSON.stringify(v)); } catch (e) { } }
};
let selMode = prefs.get("mode", 0), selBabies = prefs.get("babies", 1), selLevel = prefs.get("level", 0);
let momOn = prefs.get("mom", true), musicOn = prefs.get("music", true), soundOn = prefs.get("sound", true);
let playing = false, winShown = false, everWon = false;
let qmOpen = false, qmTimer = null, fpsEMA = 60, prevRaw = performance.now();
let currentVol = prefs.get("vol", 0.9);
let kickSpeakCursor = 0, bubbleSpeakCursor = 0, idleCursor = 0, nextIdleAt = 0;
let msgTimer = null, heartBoostUntil = 0;
const album = new Set(prefs.get("album", []));
const lullaby = new Audio("assets/lullaby.wav");
lullaby.loop = true; lullaby.volume = 0.30;

function showMessage(text, ms) {
  const m = $("message");
  m.textContent = text;
  m.classList.remove("hidden");
  if (msgTimer) clearTimeout(msgTimer);
  msgTimer = setTimeout(() => m.classList.add("hidden"), ms || 4000);
}
function momCaptionAndSpeak(line, urgent) {
  if (line) { showMessage("🗣 " + line, 4200); MomVoice.say(line, urgent); }
}

function pickerWire(rowId, attr, fn) {
  const row = $(rowId);
  row.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => {
      row.querySelectorAll("button").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      fn(parseInt(b.dataset[attr], 10));
    });
  });
}
function markSel(rowId, attr, val) {
  $(rowId).querySelectorAll("button").forEach(b =>
    b.classList.toggle("sel", parseInt(b.dataset[attr], 10) === val));
}
function refreshMenu() {
  markSel("modeRow", "mode", selMode);
  markSel("babiesRow", "n", selBabies);
  markSel("levelRow", "l", selLevel);
  $("levelBlurb").textContent = LEVELS[selLevel].blurb;
  const momPicked = selMode === 2;
  $("enterBtn").disabled = false;
  $("enterBtn").textContent = momPicked
    ? "Visit Her Home 🏠 — in 3D"
    : (selMode === 1 ? "Enter the Womb — as the Baby 👶" : "Enter the Womb ❤");
  $("albumLine").textContent = album.size > 0
    ? "📖 Your Album: " + album.size + " of 12 sounds heard so far — " +
      [...album].slice(0, 4).map(i => CARD_TITLES[i]).join(" · ") + (album.size > 4 ? " · …" : "")
    : "📖 Every golden bubble you find adds a sound to your Album.";
}
function applyWorldConfig() {
  world.setFetusMode(selMode === 1);
  world.setBabyCount(selBabies);
  world.loadLevel(selLevel);
}

function startGame() {
  if (qmOpen) closeQM();
  if (selMode === 2) { enterHome(); return; }
  applyWorldConfig();
  rebuildWorld();
  playing = true; winShown = false; everWon = false;
  kickSpeakCursor = 0; bubbleSpeakCursor = 0;
  nextIdleAt = performance.now() + 60000;
  $("startScreen").classList.add("hidden");
  $("winScreen").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("kickUi").classList.toggle("hidden", !world.fetusMode);
  $("belly").classList.toggle("hidden", !world.fetusMode);
  WombAudio.start();
  if (musicOn) { lullaby.play().catch(() => { }); }
  showMessage(world.fetusMode
    ? "You are the baby. This warm dark is home. Swim, listen — and kick, so mom feels you."
    : LEVELS[selLevel].name + " — find the golden sound bubbles. The map is top right; gold dots are bubbles, pink is baby.", 5600);
  setTimeout(() => { if (playing) momCaptionAndSpeak(MomVoice.pickLine(MOM_GREET), true); }, 1300);
  lockPointer();
}
function quitToMenu() {
  if (qmOpen) closeQM();
  playing = false;
  try { document.exitPointerLock(); } catch (e) { }
  lullaby.pause();
  $("hud").classList.add("hidden");
  $("winScreen").classList.add("hidden");
  $("startScreen").classList.remove("hidden");
  refreshMenu();
}
function showWin() {
  const t = Math.floor(world.worldTime);
  const mm = Math.floor(t / 60), ss = ("0" + (t % 60)).slice(-2);
  $("winStats").textContent = world.fetusMode
    ? "You heard every sound in the world AND kicked " + world.yourKicks + " times for mom — in " + mm + ":" + ss +
      ". Somewhere outside, a very happy mother is holding her tummy."
    : "Every sound bubble found" + (world.babyCount > 1 ? " and every baby visited" : " and the baby reached") +
      " — in " + mm + ":" + ss + ", with " + world.kicksFelt + " little kicks along the way. The whole world is waiting out there. 💗";
  $("winScreen").classList.remove("hidden");
}
function doKick() {
  if (!playing || !world.fetusMode) return;
  if (world.kick()) {
    $("kicksPill").textContent = "Your kicks: " + world.yourKicks;
    const b = $("belly");
    b.classList.remove("kicked"); void b.offsetWidth; b.classList.add("kicked");
    WombAudio.bigThump();
    kickShake = Math.max(kickShake, 0.7);
    if (world.yourKicks % 2 === 0) momCaptionAndSpeak(MomVoice.pickLine(MOM_KICK), false);
  }
}
function feelHeartbeat() {
  heartBoostUntil = performance.now() + 2500;
  showMessage("❤ Lub-dub… lub-dub… That's " + (world.fetusMode ? "YOUR heart, strong and steady." : "baby's heartbeat — and mother's, underneath it."), 2600);
}

// ------------------------------------------------------------ input
const keys = {};
window.addEventListener("keydown", e => {
  if (e.code === "Tab") {
    e.preventDefault();
    if (playing) { qmOpen ? closeQM() : openQM(); }
    return;
  }
  keys[e.code] = true;
  if (e.code === "KeyG" && !(view === "home" && typeof Drive !== "undefined" && Drive.active)) setGfx(nextGfx());
  if (playing && (e.code === "KeyK" || e.code === "Space")) { e.preventDefault(); doKick(); }
  if (playing && e.code === "KeyH") feelHeartbeat();
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement !== document.getElementById("gl")) return;
  if (view === "home" && typeof Drive !== "undefined" && Drive.active && Drive.varThrottle) {
    Drive.mouseThrottle = clamp(Drive.mouseThrottle - e.movementY * 0.0038, 0, 1);
    return;
  }
  if (view === "home" && fpov) {
    fpYaw -= e.movementX * 0.0022;
    fpPitch = clamp(fpPitch - e.movementY * 0.0018, -1.25, 1.25);
    return;
  }
  if (!playing) return;
  world.yaw += e.movementX * 0.0022;
  world.pitch = clamp(world.pitch - e.movementY * 0.0015, -0.52, 0.52);
});
function lockPointer() {
  try {
    const p = document.getElementById("gl").requestPointerLock?.();
    if (p && p.catch) p.catch(() => { }); // headless / non-gesture: play on, mouse-look just waits for a real click
  } catch (e) { }
}
document.getElementById("gl").addEventListener("click", () => {
  if (playing) lockPointer();
  else if (view === "home" && (fpov || (typeof Drive !== "undefined" && Drive.active))) lockPointer();
});
window.addEventListener("wheel", e => {
  if (view === "home" && typeof Drive !== "undefined" && Drive.active && Drive.varThrottle)
    Drive.mouseThrottle = clamp(Drive.mouseThrottle - Math.sign(e.deltaY) * 0.07, 0, 1);
}, { passive: true });

// ------------------------------------------------------------ minimap
function drawMinimap() {
  const c = $("minimap"), g = c.getContext("2d");
  const S = c.width, cx = S / 2, cy = S / 2, rm = S / 2 - 6;
  g.clearRect(0, 0, S, S);
  g.beginPath(); g.arc(cx, cy, rm, 0, Math.PI * 2);
  g.fillStyle = "rgba(24,4,8,0.72)"; g.fill();
  g.strokeStyle = "rgba(255,170,150,0.5)"; g.lineWidth = 2; g.stroke();
  const px = (x) => cx + x / world.radius * rm, py = (z) => cy + z / world.radius * rm;
  // placentas
  g.fillStyle = "#8e2434";
  const placs = world.fetusMode
    ? [...world.babies.map(b => [b.placentaX, b.placentaZ]), [world.selfPlacentaX, world.selfPlacentaZ]]
    : world.babies.map(b => [b.placentaX, b.placentaZ]);
  for (const [x, z] of placs) { g.beginPath(); g.arc(px(x), py(z), 4, 0, Math.PI * 2); g.fill(); }
  // bubbles
  g.fillStyle = "#ffc444";
  for (const b of world.bubbles) if (!b.collected) { g.beginPath(); g.arc(px(b.curX), py(b.curZ), 3.4, 0, Math.PI * 2); g.fill(); }
  // babies
  const hb = world.heartBaby();
  for (const b of world.babies) {
    g.beginPath(); g.arc(px(b.x), py(b.z), 6, 0, Math.PI * 2);
    g.fillStyle = "#ff9db0"; g.fill();
    if (hb === b) { g.beginPath(); g.arc(px(b.x), py(b.z), 9.5, 0, Math.PI * 2); g.strokeStyle = "#ffc444"; g.lineWidth = 2; g.stroke(); }
  }
  // player arrow
  const X = px(world.playerX), Y = py(world.playerZ);
  const fx = Math.sin(world.yaw), fz = Math.cos(world.yaw);
  g.save(); g.translate(X, Y); g.rotate(Math.atan2(fx, -fz) + Math.PI);
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath();
  g.fillStyle = world.fetusMode ? "#ff7d9c" : "#ffffff"; g.fill();
  g.restore();
}

// ------------------------------------------------------------ per-frame visuals
const eyeV = new THREE.Vector3(), tgtV = new THREE.Vector3();
function syncVisuals(t) {
  const beat = WombAudio.beatEnvNow();
  const prox = world.fetusMode ? 0.85 : world.babyProximity();
  // chamber breathing + squeeze
  const R = world.radius;
  const sq = 1 - 0.055 * world.wallSqueeze;
  if (chamber) {
    chamber.scale.set(R * sq, CHAMBER_H * (1 - 0.02 * world.wallSqueeze), R * sq);
    chamber.material.emissiveIntensity = 0.30 + 0.45 * beat * (0.35 + 0.65 * prox);
  }
  // babies
  babyGroups.forEach((grp, i) => {
    const b = world.babies[i];
    grp.position.y = 1.35 * b.scale + Math.sin(t * 0.6 + grp.userData.phase) * 0.05;
    const s = 1 + 0.014 * beat;
    grp.scale.set(s, s, s);
    grp.rotation.z = Math.sin(t * 0.23 + grp.userData.phase) * 0.03;
  });
  // bubbles
  bubbleGroups.forEach((grp, i) => {
    const b = world.bubbles[i];
    grp.visible = !b.collected;
    if (b.collected) return;
    grp.position.set(b.curX, bubbleYAt(b.baseY, t, b.phase), b.curZ);
    const s = 1 + 0.09 * Math.sin(t * 2.4 + b.phase) + 0.05 * beat;
    grp.scale.set(s, s, s);
  });
  // the golden heart
  const hb = world.heartBaby();
  if (heartSprite) {
    if (hb && !world.fetusMode) {
      heartSprite.visible = true;
      const hx = hb.x, hy = 1.35 * hb.scale + 1.75 * hb.scale + Math.sin(t * 2.2) * 0.12, hz = hb.z;
      heartSprite.position.set(hx, hy, hz);
      const s = 1.1 + 0.16 * Math.sin(t * 5);
      heartSprite.scale.set(s, s, 1);
      heartLight.position.set(hx, hy, hz);
      heartLight.intensity = 1.1 + 0.5 * Math.sin(t * 5);
    } else { heartSprite.visible = false; heartLight.intensity = 0; }
  }
  // drifting particles + vernix + sparkles
  for (const pts of [particles, vernix, sparkles]) {
    if (!pts) continue;
    const pos = pts.geometry.attributes.position, dat = pts.userData.dat;
    const arr = pos.array;
    for (let i = 0; i < dat.length; i++) {
      const d = dat[i];
      arr[i * 3] += (Math.sin(t * 0.3 * d.sp + d.ph) * 0.0016) + world.swishDirX * world.swishStrength * 0.012 * d.sp;
      arr[i * 3 + 1] += Math.cos(t * 0.22 * d.sp + d.ph) * 0.0012 + 0.0009 * d.sp;
      arr[i * 3 + 2] += (Math.cos(t * 0.26 * d.sp + d.ph) * 0.0016) + world.swishDirZ * world.swishStrength * 0.012 * d.sp;
      if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = 0.25;
      const rr = Math.hypot(arr[i * 3], arr[i * 3 + 2]);
      if (rr > world.radius * 0.94) { arr[i * 3] *= 0.4; arr[i * 3 + 2] *= 0.4; }
    }
    pos.needsUpdate = true;
  }
  // camera
  if (playing) {
    const surgeBob = world.moving ? Math.sin(world.strokePhase * Math.PI * 2) * 0.035 : 0;
    const bob = Math.sin(world.walkCycle * 2.2) * 0.045 + surgeBob;
    kickShake = Math.max(0, kickShake - 0.03);
    const jx = kickShake > 0 ? (Math.random() - 0.5) * 0.06 * kickShake : 0;
    const jy = kickShake > 0 ? (Math.random() - 0.5) * 0.06 * kickShake : 0;
    eyeV.set(world.playerX + world.swayX * 0.03 + jx, world.playerY + bob + jy, world.playerZ + world.swayZ * 0.03);
    const pR = clamp(world.pitch, -0.52, 0.52) * 1.35 + world.tiltPitch * 1.4;
    tgtV.set(eyeV.x + Math.sin(world.yaw) * Math.cos(pR), eyeV.y + Math.sin(pR), eyeV.z + Math.cos(world.yaw) * Math.cos(pR));
    camera.position.copy(eyeV);
    camera.lookAt(tgtV);
    camera.rotateZ(world.tiltRoll * 2.0);
    const fl = scene.getObjectByName("followLight");
    if (fl) { fl.position.set(eyeV.x, eyeV.y + 1.3, eyeV.z); fl.intensity = 1.02 + 0.38 * beat; }
    if (world.fetusMode) {
      $("belly").style.transform = "translateX(-50%) translateY(" + (world.moving ? Math.sin(world.strokePhase * Math.PI * 2) * 7 : Math.sin(t * 1.3) * 2.5) + "px)";
    }
  } else {
    // title backdrop: a slow, dreamy orbit inside the womb
    const a = t * 0.05;
    eyeV.set(Math.sin(a) * world.radius * 0.34, 2.6 + Math.sin(t * 0.17) * 0.3, Math.cos(a) * world.radius * 0.34);
    const b0 = world.babies[0];
    tgtV.set(b0 ? b0.x : 0, 1.4, b0 ? b0.z : 0);
    camera.position.copy(eyeV);
    camera.lookAt(tgtV);
    const fl = scene.getObjectByName("followLight");
    if (fl) { fl.position.set(eyeV.x, eyeV.y + 1.2, eyeV.z); fl.intensity = 1.0 + 0.3 * beat; }
  }
}

// ------------------------------------------------------------ main loop
let lastNow = performance.now(), hintAt = 0;
// Which world the loop draws: the womb, or Mom's house (PC v0.2).
let view = "womb"; // "womb" | "home"
let homeScene = null, homeRefs = {};
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const rawDt = (now - prevRaw) / 1000;
  prevRaw = now;
  if (rawDt > 0.0005) fpsEMA += (Math.min(240, 1 / rawDt) - fpsEMA) * 0.05;
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  const t = now / 1000;

  if (playing && !qmOpen) {
    let moveF = 0, moveS = 0;
    if (keys.KeyW || keys.ArrowUp) moveF += 1;
    if (keys.KeyS || keys.ArrowDown) moveF -= 1;
    if (keys.KeyD || keys.ArrowRight) moveS += 1;
    if (keys.KeyA || keys.ArrowLeft) moveS -= 1;
    const collected = world.update(dt, moveF, moveS);

    if (world.stateChanged) {
      world.stateChanged = false;
      const line = MOTHER_STATE_LINES[world.motherState];
      if (line) showMessage(line, 4200);
    }
    if (world.consumeKick()) {
      kickShake = 1;
      WombAudio.bigThump();
      showMessage(KICK_LINES[kickSpeakCursor % KICK_LINES.length], 3000);
      kickSpeakCursor++;
      if (kickSpeakCursor % 2 === 0) MomVoice.say(MomVoice.pickLine(MOM_KICK), false);
    }
    if (collected >= 0) {
      const b = world.bubbles[collected];
      album.add(b.cardId);
      prefs.set("album", [...album]);
      WombAudio.chime(world.collectedCount);
      showMessage(world.nextBubbleLine(), 4600);
      bubbleSpeakCursor++;
      if (bubbleSpeakCursor % 3 === 0) MomVoice.say(MomVoice.pickLine(MOM_BUBBLE), false);
      if (world.won() && !everWon) {
        everWon = true;
        setTimeout(() => {
          if (playing && !world.gameComplete) showMessage(world.fetusMode
            ? "Every sound heard! Now — kick for mom. She is waiting to feel you. 🦶"
            : "💗 The golden heart appears by the baby…", 4600);
        }, 4800);
      }
    }
    if (world.gameComplete && !winShown) { winShown = true; showWin(); }

    // audio levels follow the game
    const prox = world.fetusMode ? 0.85 : world.babyProximity();
    WombAudio.heartbeatLevel = (world.fetusMode ? 1.12 : 0.5 + 0.8 * prox) * (now < heartBoostUntil ? 1.5 : 1.0);
    WombAudio.frame(dt, { prox, moving: world.moving, swish: world.swishStrength, motherWalking: world.motherState === MOTHER_WALK });

    // mom idles a loving line now and then
    if (now >= nextIdleAt) {
      nextIdleAt = now + 55000 + Math.random() * 35000;
      MomVoice.say(MomVoice.pickLine(MOM_IDLE), false);
    }
    // HUD refresh
    $("bubblesPill").textContent = world.fetusMode
      ? "Bubbles: " + world.collectedCount + " / " + world.bubbles.length + " · kicks: " + world.yourKicks + (world.won() ? " / " + KICKS_TO_WIN + " to win" : "")
      : "Sound bubbles: " + world.collectedCount + " / " + world.bubbles.length;
    if (now - hintAt > 260) { hintAt = now; $("hintPill").textContent = world.bubbleHint(); }
    if (world.fetusMode) $("kicksPill").textContent = "Your kicks: " + world.yourKicks;
    refreshSelfCord(t);
    drawMinimap();
  }
  if (view === "home" && homeScene) {
    syncHome(t, dt);
    renderMirror();
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // the home/town gets the filmic coat; the womb keeps its proven look
    renderer.toneMappingExposure = 1.12;
    renderer.render(homeScene, camera);
  } else {
    syncVisuals(t);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.render(scene, camera);
  }
}

// ------------------------------------------------------------ the Quick Menu (VRChat-style)
const MOTHER_LABELS = ["resting", "up and walking", "rolling over", "having a gentle squeeze"];
const BABY_LABELS = { 1: "1 Baby", 2: "Twins", 3: "Triplets", 8: "Octuplets" };
function refreshQM() {
  $("qmWorld").textContent = world.level.name + " · " + (selMode === 1 ? "Fetus" : "Explorer")
    + " · " + BABY_LABELS[selBabies] + " · " + GFX[gfxMode].label + " graphics";
  $("qmStatus").textContent = "Mom is " + MOTHER_LABELS[world.motherState] + " out there. "
    + "Bubbles heard: " + world.collectedCount + " of " + world.bubbles.length + "."
    + (world.fetusMode ? " Your kicks: " + world.yourKicks + (world.won() ? " — " + (KICKS_TO_WIN - world.yourKicks) + " more to win the day!" : ".") : "")
    + (!world.fetusMode && world.won() ? " The golden heart is waiting by a baby. 💗" : "");
  $("qmHint").textContent = world.bubbleHint();
  const d = new Date();
  $("qmClock").textContent = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  $("qmFps").textContent = Math.round(fpsEMA) + " fps";
  document.querySelectorAll("#qmGfxTiles button").forEach(b =>
    b.classList.toggle("sel", b.dataset.g === gfxMode));
  const sw = (id, on) => { const el = $(id); el.textContent = on ? "On" : "Off"; el.classList.toggle("off", !on); };
  sw("qmSoundTgl", soundOn); sw("qmMusicTgl", musicOn); sw("qmMomTgl", momOn);
  $("qmVol").value = Math.round(currentVol * 100);
  document.querySelectorAll("#qmModeRow button").forEach(b =>
    b.classList.toggle("sel", parseInt(b.dataset.mode, 10) === selMode));
  document.querySelectorAll("#qmBabiesRow button").forEach(b =>
    b.classList.toggle("sel", parseInt(b.dataset.n, 10) === selBabies));
  document.querySelectorAll("#qmLevelRow button").forEach(b =>
    b.classList.toggle("sel", parseInt(b.dataset.l, 10) === selLevel));
}
function openQM() {
  if (!playing || qmOpen) return;
  qmOpen = true;
  $("quickMenu").classList.remove("hidden");
  try { document.exitPointerLock(); } catch (e) { }
  refreshQM();
  qmTimer = setInterval(refreshQM, 600);
}
function closeQM() {
  qmOpen = false;
  $("quickMenu").classList.add("hidden");
  if (qmTimer) { clearInterval(qmTimer); qmTimer = null; }
}
function qmPickWire(rowId, attr, fn) {
  document.querySelectorAll("#" + rowId + " button").forEach(b =>
    b.addEventListener("click", () => { fn(parseInt(b.dataset[attr], 10)); refreshQM(); refreshMenu(); }));
}

// ------------------------------------------------------------ wire up + boot
pickerWire("modeRow", "mode", v => { selMode = v; prefs.set("mode", v); refreshMenu(); });
pickerWire("babiesRow", "n", v => { selBabies = v; prefs.set("babies", v); });
pickerWire("levelRow", "l", v => { selLevel = v; prefs.set("level", v); refreshMenu(); });
$("enterBtn").addEventListener("click", startGame);
$("quitBtn").addEventListener("click", quitToMenu);
$("kickBtn").addEventListener("click", doKick);
$("feelBtn").addEventListener("click", feelHeartbeat);
$("againBtn").addEventListener("click", () => { $("winScreen").classList.add("hidden"); startGame(); });
$("exploreBtn").addEventListener("click", () => $("winScreen").classList.add("hidden"));
$("winMenuBtn").addEventListener("click", quitToMenu);
$("momBtn").addEventListener("click", () => {
  momOn = !momOn; MomVoice.enabled = momOn; prefs.set("mom", momOn);
  $("momBtn").textContent = momOn ? "🗣 Mom: on" : "🗣 Mom: off";
});
document.querySelectorAll("#gfxRow button").forEach(b =>
  b.addEventListener("click", () => setGfx(b.dataset.g)));
$("gfxBtn").addEventListener("click", () => setGfx(nextGfx()));
$("qmBtn").addEventListener("click", openQM);
document.querySelectorAll(".qmTab").forEach(tab =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".qmTab").forEach(x => x.classList.toggle("sel", x === tab));
    document.querySelectorAll(".qmPage").forEach(p =>
      p.classList.toggle("hidden", p.dataset.page !== tab.dataset.tab));
  }));
$("qmResume").addEventListener("click", () => { closeQM(); lockPointer(); });
$("qmRespawn").addEventListener("click", () => {
  world.reset();
  closeQM(); lockPointer();
  showMessage("🚪 Respawned — back at the womb door.", 2200);
});
$("qmRestart").addEventListener("click", () => { closeQM(); startGame(); });
$("qmTitleBtn").addEventListener("click", () => { closeQM(); quitToMenu(); });
document.querySelectorAll("#qmGfxTiles button").forEach(b =>
  b.addEventListener("click", () => { setGfx(b.dataset.g); refreshQM(); }));
$("qmSoundTgl").addEventListener("click", () => { $("soundBtn").click(); refreshQM(); });
$("qmMusicTgl").addEventListener("click", () => { $("musicBtn").click(); refreshQM(); });
$("qmMomTgl").addEventListener("click", () => { $("momBtn").click(); refreshQM(); });
$("qmVol").addEventListener("input", e => {
  currentVol = parseInt(e.target.value, 10) / 100;
  prefs.set("vol", currentVol);
  WombAudio.setVolume(currentVol);
  lullaby.volume = 0.34 * currentVol;
});
qmPickWire("qmModeRow", "mode", v => { selMode = v; prefs.set("mode", v); });
qmPickWire("qmBabiesRow", "n", v => { selBabies = v; prefs.set("babies", v); });
qmPickWire("qmLevelRow", "l", v => { selLevel = v; prefs.set("level", v); });
$("qmApplyGame").addEventListener("click", () => { closeQM(); startGame(); });
$("musicBtn").addEventListener("click", () => {
  musicOn = !musicOn; prefs.set("music", musicOn);
  $("musicBtn").textContent = musicOn ? "🎵 Music: on" : "🎵 Music: off";
  if (playing) { if (musicOn) lullaby.play().catch(() => { }); else lullaby.pause(); }
});
$("soundBtn").addEventListener("click", () => {
  soundOn = !soundOn; prefs.set("sound", soundOn);
  WombAudio.setMuted(!soundOn); lullaby.muted = !soundOn;
  $("soundBtn").textContent = soundOn ? "🔊 Sound: on" : "🔇 Sound: off";
});
$("momBtn").textContent = momOn ? "🗣 Mom: on" : "🗣 Mom: off";
$("musicBtn").textContent = musicOn ? "🎵 Music: on" : "🎵 Music: off";
$("soundBtn").textContent = soundOn ? "🔊 Sound: on" : "🔇 Sound: off";
MomVoice.enabled = momOn;
MomVoice.init();
WombAudio.baseVolume = currentVol;
lullaby.volume = 0.34 * currentVol;

loadTextures();
initGL();
applyWorldConfig();
gfxMode = prefs.get("gfx", "kh3");
applyGraphics();
refreshMenu();
loop();

// debug/test handle (used by the CDP play-test)
window.WOMB = { world, WombAudio, startGame, rebuildWorld, quitToMenu, setGfx,
  renderer: () => renderer, gfxMode: () => gfxMode, openQM, closeQM, qmOpen: () => qmOpen,
  setMode(m) { selMode = m; refreshMenu(); }, doKick, version: "0.8.0",
  packsEnabled: () => { try { return JSON.parse(localStorage.getItem("awpc_packs") || "{}"); } catch (e) { return {}; } } };

// launcher hand-off: a mode picked in launcher.html starts at once
try {
  const lm = localStorage.getItem("awpc_launch_mode");
  if (lm) {
    localStorage.removeItem("awpc_launch_mode");
    setTimeout(() => {
      selMode = lm === "mom" ? 2 : lm === "fetus" ? 1 : 0;
      refreshMenu();
      startGame();
    }, 350);
  }
} catch (e) { }

// ================================================================
// MOM MODE, IN 3D (PC v0.2): her living room, both dwellings, the
// furniture options from the Android customizer — and her, standing
// in it, built from the same primitives as the baby. Drag to look.
// ================================================================
// (view / homeScene / homeRefs are declared just above the main loop —
// the loop starts before this section of the file executes.)
let homeOpt = prefs.get("homeopts", { dwelling: 0, wall: 0, floor: 0, sofa: 0, curtains: 0, rug: 0, tv: 0, decor: 0, lamp: 0, plant: 1 });
const HOME_SETS = {
  wall: ["Mint", "Butter", "Blush Pink", "Sky", "Cream", "Peach"],
  floor: ["Hardwood", "Avocado Carpet", "Checkered Tile", "Rose Carpet"],
  sofa: ["Teal Sofa", "Mustard Sofa", "Coral Sofa", "Avocado Sofa", "Chocolate Sofa", "Pink Sofa"],
  curtains: ["White Lace", "Pink Gingham", "Gold Drapes", "Teal Drapes", "No Curtains"],
  rug: ["Oriental Red", "Teal Oval", "Pink Shag", "Braided Rug", "No Rug"],
  tv: ["Console TV", "Portable TV", "Radio"],
  decor: ["Sunburst Clock", "Family Portrait", "Starburst Mirror", "Landscape Painting"],
  lamp: ["Floor Lamp", "Table Lamp", "No Lamp"],
  plant: ["No Plant", "Fern", "Vase of Flowers"]
};
const WALL_RGB = [[178,216,192],[240,224,150],[244,200,208],[178,206,232],[242,234,214],[246,205,172]];
const SOFA_RGB = [[64,140,148],[214,164,52],[226,116,92],[128,152,74],[120,78,56],[228,150,172]];
const CURTAIN_RGB = [[248,246,240],[238,156,172],[216,172,74],[84,150,152]];
const RUG_RGB = [[104,22,32],[64,140,148],[238,170,190],[178,140,96]];
const rgbCss = a => `rgb(${a[0]},${a[1]},${a[2]})`;
const rgbHex = a => (a[0] << 16) | (a[1] << 8) | a[2];

function paintTex(w, h, fn) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  fn(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
function wallpaperTexture(idx) {
  const base = rgbCss(WALL_RGB[idx]);
  return paintTex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.14)";
    for (let x = 10; x < w; x += 42) g.fillRect(x, 0, 9, h * 0.78);
    g.fillStyle = "rgba(90,70,40,0.10)"; // tiny diamond motif between the stripes
    for (let x = 31; x < w; x += 42) for (let y = 22; y < h * 0.74; y += 44) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore();
    }
    g.fillStyle = "rgb(146,108,74)"; g.fillRect(0, h * 0.78, w, h * 0.22); // wainscot
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, h * 0.78, w, 4);
    g.fillStyle = "rgba(255,255,255,0.10)";
    for (let x = 22; x < w; x += 42) g.fillRect(x, h * 0.80, 5, h * 0.18);
  });
}
function floorTexture(idx) {
  return paintTex(512, 512, (g, w, h) => {
    if (idx === 2) {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        g.fillStyle = (r + c) % 2 === 0 ? "#eeeade" : "#2e2c30";
        g.fillRect(c * 64, r * 64, 64, 64);
      }
      return;
    }
    const base = idx === 0 ? "#926640" : idx === 1 ? "#7a9246" : "#d694a2";
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (idx === 0) {
      g.strokeStyle = "rgba(70,44,22,0.55)"; g.lineWidth = 3;
      for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = "rgba(70,44,22,0.25)"; g.lineWidth = 1;
      for (let i = 0; i < 130; i++) {
        const y = Math.random() * h;
        g.beginPath(); g.moveTo(Math.random() * w * 0.5, y); g.lineTo(w * 0.5 + Math.random() * w * 0.5, y + (Math.random() - 0.5) * 4); g.stroke();
      }
      g.strokeStyle = "rgba(70,44,22,0.5)";
      for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x + ((x / 128) % 2) * 40, (x % 3) * 60); g.lineTo(x + ((x / 128) % 2) * 40, (x % 3) * 60 + 64); g.stroke(); }
    } else {
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";
        g.fillRect(Math.random() * w, Math.random() * h, 2.4, 2.4);
      }
    }
  });
}
function screenTexture() {
  // the afternoon picture show: a little painted cartoon landscape
  return paintTex(256, 192, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, "#a8cbe4"); sky.addColorStop(1, "#dceef8");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffdf6b"; g.beginPath(); g.arc(52, 42, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.9)";
    for (const [cx, cy, s] of [[150, 34, 15], [172, 30, 11], [130, 30, 10]]) {
      g.beginPath(); g.arc(cx, cy, s, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#7cb45e"; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = "#679c4c";
    g.beginPath(); g.ellipse(40, h * 0.68, 90, 22, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(230, h * 0.7, 80, 20, 0, Math.PI, Math.PI * 2); g.fill();
    // a little house + tree, cartoon style
    g.fillStyle = "#f3e3c2"; g.fillRect(96, h * 0.52, 52, 34);
    g.fillStyle = "#b45a3c";
    g.beginPath(); g.moveTo(90, h * 0.52); g.lineTo(122, h * 0.38); g.lineTo(154, h * 0.52); g.fill();
    g.fillStyle = "#7a4a28"; g.fillRect(114, h * 0.62, 15, 24);
    g.fillStyle = "#5da24e"; g.beginPath(); g.arc(190, h * 0.5, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7a4a28"; g.fillRect(187, h * 0.52, 6, 20);
    // scanlines + tube vignette
    g.fillStyle = "rgba(30,40,50,0.16)";
    for (let y = 4; y < h; y += 6) g.fillRect(0, y, w, 1.4);
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(10,16,22,0.35)");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
}
function clockTexture(mirror) {
  return paintTex(256, 256, (g, w, h) => {
    g.fillStyle = mirror ? "#cedeec" : "#faf4e2";
    g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    if (!mirror) {
      g.strokeStyle = "#8a6f3c"; g.lineWidth = 5;
      g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#342c28"; g.strokeStyle = "#342c28"; g.lineCap = "round";
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, big = i % 3 === 0;
        g.lineWidth = big ? 7 : 4;
        g.beginPath();
        g.moveTo(128 + Math.cos(a) * (big ? 84 : 94), 128 + Math.sin(a) * (big ? 84 : 94));
        g.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104);
        g.stroke();
      }
      g.font = "bold 34px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("12", 128, 52); g.fillText("3", 204, 130);
      g.fillText("6", 128, 206); g.fillText("9", 52, 130);
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 44, 128 - 52); g.stroke();
      g.lineWidth = 11;
      g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 58, 128 + 20); g.stroke();
      g.fillStyle = "#b22234"; g.beginPath(); g.arc(128, 128, 9, 0, Math.PI * 2); g.fill();
    } else {
      g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 12;
      g.beginPath(); g.moveTo(84, 176); g.lineTo(150, 84); g.stroke();
      g.beginPath(); g.moveTo(120, 196); g.lineTo(186, 104); g.stroke();
    }
  });
}
function portraitTexture() {
  return paintTex(256, 256, (g, w, h) => {
    g.fillStyle = "#eee4d0"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#f6c7a0"; g.beginPath(); g.arc(112, 100, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#4a2e1c"; g.beginPath(); g.arc(112, 82, 36, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = "#b22234";
    g.beginPath(); g.arc(122, 196, 62, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,120,130,0.8)"; g.beginPath(); g.arc(160, 178, 13, 0, Math.PI * 2); g.fill();
  });
}
function landscapeTexture() {
  return paintTex(320, 220, (g, w, h) => {
    g.fillStyle = "#b2d6ee"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffd85c"; g.beginPath(); g.arc(248, 52, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6ea85c";
    g.beginPath(); g.ellipse(60, 218, 130, 74, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(262, 224, 130, 80, 0, Math.PI, Math.PI * 2); g.fill();
  });
}
function skylineTexture(seed) {
  return paintTex(128, 256, (g, w, h) => {
    g.fillStyle = "#343854"; g.fillRect(0, 0, w, h);
    let s = seed * 7919 + 13;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let r = 0; r < 11; r++) for (let c = 0; c < 4; c++) {
      if (rnd() < 0.45) continue;
      g.fillStyle = rnd() < 0.85 ? "#ffd678" : "#cfe4ff";
      g.fillRect(10 + c * 29, 14 + r * 21, 15, 11);
    }
  });
}
function skyTexture(apartment) {
  return paintTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (apartment) { gr.addColorStop(0, "#2c3358"); gr.addColorStop(0.7, "#5a4a72"); gr.addColorStop(1, "#8a5f74"); }
    else { gr.addColorStop(0, "#79b4e0"); gr.addColorStop(0.75, "#bcdcf2"); gr.addColorStop(1, "#e8f3d8"); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function ginghamTexture(idx) {
  const base = rgbCss(CURTAIN_RGB[idx]);
  return paintTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let x = 0; x < w; x += 24) g.fillRect(x, 0, 10, h);
    for (let y = 0; y < h; y += 24) g.fillRect(0, y, w, 10);
  });
}
function curtainFoldTexture(idx) {
  const base = rgbCss(CURTAIN_RGB[idx]);
  return paintTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = "rgba(0,0,0,0.13)"; g.fillRect(x, 0, 5, h);
      g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(x + 8, 0, 5, h);
    }
    if (idx === 0) { // lace: tiny dot pattern over the folds
      g.fillStyle = "rgba(160,140,120,0.25)";
      for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) {
        g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
      }
    }
  });
}
function hairTexture() {
  const t = paintTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#7a4f2a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 330; i++) {
      const x = Math.random() * w;
      g.strokeStyle = Math.random() < 0.55 ? "rgba(84,54,26,0.55)" : "rgba(178,132,84,0.55)";
      g.lineWidth = 1.5 + Math.random() * 3.5;
      g.beginPath(); g.moveTo(x, -6);
      g.bezierCurveTo(x + (Math.random() - 0.5) * 22, h * 0.35, x + (Math.random() - 0.5) * 22, h * 0.7, x + (Math.random() - 0.5) * 12, h + 6);
      g.stroke();
    }
    const sheen = g.createLinearGradient(0, 0, w, 0);
    sheen.addColorStop(0, "rgba(255,220,160,0)"); sheen.addColorStop(0.5, "rgba(255,220,160,0.13)"); sheen.addColorStop(1, "rgba(255,220,160,0)");
    g.fillStyle = sheen; g.fillRect(0, 0, w, h);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function dressTexture() {
  const t = paintTex(1024, 1024, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#bc2838"); grad.addColorStop(1, "#a31f30");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.035)"; // woven cloth
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1.2);
    g.fillStyle = "rgba(255,255,255,0.03)";
    for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1.2, h);
    g.fillStyle = "rgba(255,246,238,0.9)";
    for (let r = 0; r < 17; r++) for (let c = 0; c < 17; c++) {
      g.beginPath();
      g.arc(c * 60 + (r % 2) * 30 + 12, r * 60 + 16, 5.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(0,0,0,0.05)";
    for (let i = 0; i < 900; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1.6);
  return t;
}
function apronTexture() {
  return paintTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#f8f3e4"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(140,160,190,0.30)"; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 68) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 68) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = "rgba(0,0,0,0.03)";
    for (let i = 0; i < 1300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2.4, 2.4);
    // ruffled hem: two rows of scallops + a stitch line
    g.fillStyle = "#fffdf4";
    for (let x = 0; x < w + 64; x += 64) {
      g.beginPath(); g.arc(x, h - 52, 34, 0, Math.PI); g.fill();
      g.beginPath(); g.arc(x + 32, h - 88, 34, 0, Math.PI); g.fill();
    }
    g.strokeStyle = "rgba(178,34,52,0.65)"; g.lineWidth = 5; g.setLineDash([18, 14]);
    g.beginPath(); g.moveTo(16, h - 132); g.lineTo(w - 16, h - 132); g.stroke();
    g.setLineDash([]);
    // a pocket with stitching
    g.strokeStyle = "rgba(120,110,90,0.8)"; g.lineWidth = 5;
    g.strokeRect(w * 0.58, h * 0.50, 184, 168);
    g.strokeStyle = "rgba(178,34,52,0.5)"; g.setLineDash([12, 10]);
    g.strokeRect(w * 0.58 + 14, h * 0.50 + 14, 156, 140);
    g.setLineDash([]);
  });
}
function sofaTexture(idx) {
  const base = rgbCss(SOFA_RGB[idx]);
  return paintTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.06)";
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1.4);
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1.4, h);
    g.strokeStyle = "rgba(0,0,0,0.28)"; g.lineWidth = 3; g.setLineDash([8, 6]);
    g.strokeRect(13, 13, w - 26, h - 26);
    g.setLineDash([]);
  });
}
function rugTexture(idx) {
  const base = RUG_RGB[idx], dark = base.map(v => Math.max(0, v - 42)), lite = base.map(v => Math.min(255, v + 52));
  return paintTex(512, 512, (g, w, h) => {
    g.fillStyle = rgbCss(base); g.fillRect(0, 0, w, h);
    g.fillStyle = rgbCss(dark); g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = rgbCss(lite); g.fillRect(30, 30, w - 60, h - 60);
    g.fillStyle = rgbCss(base); g.fillRect(48, 48, w - 96, h - 96);
    g.strokeStyle = rgbCss(lite); g.lineWidth = 4;
    const diamond = (cx, cy, r) => {
      g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.stroke();
    };
    diamond(w / 2, h / 2, 118); diamond(w / 2, h / 2, 82); diamond(w / 2, h / 2, 40);
    for (const [cx, cy] of [[92, 92], [w - 92, 92], [92, h - 92], [w - 92, h - 92]]) diamond(cx, cy, 30);
    g.fillStyle = rgbCss(lite);
    for (const [cx, cy] of [[w / 2, 92], [w / 2, h - 92], [92, h / 2], [w - 92, h / 2]]) {
      g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillRect(-11, -11, 22, 22); g.restore();
    }
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
      g.fillRect(Math.random() * w, Math.random() * h, 2.2, 2.2);
    }
  });
}
// Her face, painted KH-style at 2048² for a curved patch on the head
// (drawn in 1024-space under a 2x transform, then finished with
// fine detail: iris striations, brow hairs, separate lashes, lip
// lines). Big detailed eyes, brows, a small nose, lips, blush.
// Transparent everywhere else so it blends into the skin.
function momFaceTexture() {
  return paintTex(2048, 2048, (g, w, h) => {
    g.scale(2, 2);
    const cx = 512;
    // soft blush
    for (const sx of [-1, 1]) {
      const b = g.createRadialGradient(cx + sx * 300, 640, 8, cx + sx * 300, 640, 95);
      b.addColorStop(0, "rgba(244,140,140,0.38)"); b.addColorStop(1, "rgba(244,140,140,0)");
      g.fillStyle = b;
      g.beginPath(); g.ellipse(cx + sx * 300, 640, 100, 62, 0, 0, Math.PI * 2); g.fill();
    }
    const eye = (ex) => {
      const ey = 428, ew = 196, eh = 252;
      // eyelid crease
      g.strokeStyle = "rgba(146,90,62,0.55)"; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.ellipse(ex, ey - 18, ew * 0.52, eh * 0.52, 0, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      // eye white with a soft top shadow
      g.save();
      g.beginPath(); g.ellipse(ex, ey, ew / 2, eh / 2, 0, 0, Math.PI * 2); g.clip();
      g.fillStyle = "#fdfaf4"; g.fillRect(ex - ew / 2, ey - eh / 2, ew, eh);
      const sh = g.createLinearGradient(0, ey - eh / 2, 0, ey - eh * 0.05);
      sh.addColorStop(0, "rgba(120,80,70,0.30)"); sh.addColorStop(1, "rgba(120,80,70,0)");
      g.fillStyle = sh; g.fillRect(ex - ew / 2, ey - eh / 2, ew, eh * 0.5);
      // iris: Aerith green — bright emerald gradient with a dark rim
      const iris = g.createRadialGradient(ex, ey + 6, 8, ex, ey + 6, 88);
      iris.addColorStop(0, "#9fe0a8"); iris.addColorStop(0.55, "#3f9e57"); iris.addColorStop(0.88, "#1f6b34"); iris.addColorStop(1, "#123f20");
      g.fillStyle = iris;
      g.beginPath(); g.arc(ex, ey + 6, 84, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#241305";
      g.beginPath(); g.arc(ex, ey + 6, 36, 0, Math.PI * 2); g.fill();
      // highlights: one big, one small, plus a bottom catch-light
      g.fillStyle = "rgba(255,255,255,0.96)";
      g.beginPath(); g.arc(ex - 27, ey - 26, 21, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ex + 30, ey + 30, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(214,255,222,0.5)";
      g.beginPath(); g.ellipse(ex, ey + 62, 44, 13, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      // thick upper lash line with an outer flick
      g.strokeStyle = "#2a1a10"; g.lineCap = "round";
      g.lineWidth = 17;
      g.beginPath(); g.ellipse(ex, ey - 8, ew * 0.53, eh * 0.5, 0, Math.PI * 1.08, Math.PI * 1.94); g.stroke();
      const dir = Math.sign(ex - cx) || 1;
      g.lineWidth = 13;
      g.beginPath();
      g.moveTo(ex + dir * ew * 0.47, ey - eh * 0.28);
      g.quadraticCurveTo(ex + dir * (ew * 0.60), ey - eh * 0.34, ex + dir * (ew * 0.66), ey - eh * 0.20);
      g.stroke();
      // lower lid line + two tiny lashes
      g.strokeStyle = "rgba(90,55,35,0.65)"; g.lineWidth = 6;
      g.beginPath(); g.ellipse(ex, ey + 4, ew * 0.46, eh * 0.47, 0, Math.PI * 0.18, Math.PI * 0.62); g.stroke();
    };
    eye(cx - 218); eye(cx + 218);
    // brows: Aerith's — thinner, gentler arches
    g.strokeStyle = "#5e3d22"; g.lineWidth = 13; g.lineCap = "round";
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sx * 218 - 92, 268);
      g.quadraticCurveTo(cx + sx * 218, 232, cx + sx * 218 + 96, 262);
      g.stroke();
    }
    // nose: a gentle shadow wedge + nostril hint + tip highlight
    g.strokeStyle = "rgba(168,102,66,0.55)"; g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx + 9, 545); g.quadraticCurveTo(cx + 17, 592, cx + 3, 618); g.stroke();
    g.fillStyle = "rgba(150,90,58,0.40)";
    g.beginPath(); g.ellipse(cx, 626, 21, 7.5, 0, 0, Math.PI * 2); g.fill();
    // lips: a kind 1960s smile, rose red
    const my = 772;
    g.fillStyle = "#d98f97";
    g.beginPath(); // lower lip
    g.ellipse(cx, my + 13, 56, 21, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#c97a84";
    g.beginPath(); // upper lip with its little M
    g.moveTo(cx - 58, my);
    g.quadraticCurveTo(cx - 28, my - 19, cx, my - 6);
    g.quadraticCurveTo(cx + 28, my - 19, cx + 58, my);
    g.quadraticCurveTo(cx + 28, my + 9, cx, my + 9);
    g.quadraticCurveTo(cx - 28, my + 9, cx - 58, my);
    g.fill();
    g.strokeStyle = "#a85660"; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath(); g.moveTo(cx - 58, my);
    g.quadraticCurveTo(cx, my + 13, cx + 58, my); g.stroke();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath(); g.ellipse(cx - 8, my + 17, 26, 6.5, 0, 0, Math.PI * 2); g.fill();
    // ---- the fine pass (this is what 2048² buys): iris striations,
    // individual brow hairs, separate lower lashes, lip texture
    for (const ex of [cx - 218, cx + 218]) {
      for (let i = 0; i < 52; i++) {
        const a = (i / 52) * Math.PI * 2 + (i % 5) * 0.013;
        g.strokeStyle = i % 3 === 0 ? "rgba(196,255,208,0.20)" : "rgba(14,54,24,0.26)";
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(ex + Math.cos(a) * 40, 434 + Math.sin(a) * 40);
        g.lineTo(ex + Math.cos(a) * 80, 434 + Math.sin(a) * 80);
        g.stroke();
      }
      g.strokeStyle = "rgba(42,26,16,0.8)"; g.lineWidth = 3.4; g.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const lx = ex - 52 + i * 26, dir = Math.sign(ex - cx) || 1;
        g.beginPath();
        g.moveTo(lx, 548 - Math.abs(i - 2) * 4);
        g.lineTo(lx + dir * 3, 562 - Math.abs(i - 2) * 4);
        g.stroke();
      }
    }
    g.strokeStyle = "rgba(74,46,26,0.5)"; g.lineWidth = 2.1;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const t = i / 25, bx = cx + sx * 218 - 92 + t * 188;
        const by = 268 - Math.sin(t * Math.PI) * 30 + (i % 4) * 1.6;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 9, by - 3.5); g.stroke();
      }
    }
    g.strokeStyle = "rgba(140,70,80,0.35)"; g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const lx = cx - 34 + i * 9.5;
      g.beginPath(); g.moveTo(lx, 778); g.lineTo(lx + 1.5, 794); g.stroke();
    }
    g.fillStyle = "rgba(150,80,70,0.16)"; // soft shadow under the lower lip
    g.beginPath(); g.ellipse(cx, 812, 34, 8, 0, 0, Math.PI * 2); g.fill();
  });
}
function skinTexture() {
  const t = paintTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#f6c7a0"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 90 + Math.random() * 200;
      const bl = g.createRadialGradient(x, y, 4, x, y, r);
      const warm = Math.random() < 0.5;
      bl.addColorStop(0, warm ? "rgba(214,150,105,0.055)" : "rgba(255,230,200,0.055)");
      bl.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = bl; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(160,100,60,0.05)" : "rgba(255,240,220,0.05)";
      g.fillRect(Math.random() * w, Math.random() * h, 1.8, 1.8);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ------------------------------------------------------------ 3D builders
function box(w, h, d, mat, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  return m;
}
function limb(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.88, len, 14), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
const stdPlain = (color, rough, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.8 : rough, metalness: 0 }, extra || {}));

function makeSofa3D() {
  const col = rgbHex(SOFA_RGB[homeOpt.sofa]);
  const mat = stdPlain(col, 0.85);
  const cush = new THREE.MeshStandardMaterial({ map: sofaTexture(homeOpt.sofa), roughness: 0.9 });
  const grp = new THREE.Group();
  grp.add(box(2.4, 0.5, 1.05, mat, 0, 0.42, 0));                 // base
  grp.add(box(2.4, 0.8, 0.26, mat, 0, 0.95, -0.40));             // back
  grp.add(box(0.3, 0.42, 1.05, mat, -1.06, 0.82, 0));           // arms
  grp.add(box(0.3, 0.42, 1.05, mat, 1.06, 0.82, 0));
  grp.add(box(1.02, 0.16, 0.78, cush, -0.55, 0.72, 0.06));      // cushions (stitched fabric)
  grp.add(box(1.02, 0.16, 0.78, cush, 0.55, 0.72, 0.06));
  grp.add(box(1.02, 0.5, 0.14, cush, -0.55, 1.02, -0.28));
  grp.add(box(1.02, 0.5, 0.14, cush, 0.55, 1.02, -0.28));
  const pillow = box(0.42, 0.42, 0.13, stdPlain(0xf0e2b4, 0.9), 0.78, 0.98, -0.18);
  pillow.rotation.z = 0.22; pillow.rotation.x = -0.15;
  grp.add(pillow);
  const legM = stdPlain(0x4a3220, 0.9);
  for (const [lx, lz] of [[-1.05, 0.4], [1.05, 0.4], [-1.05, -0.4], [1.05, -0.4]])
    grp.add(box(0.09, 0.18, 0.09, legM, lx, 0.09, lz));
  return grp;
}
function makeTv3D() {
  const grp = new THREE.Group();
  const wood = stdPlain(0x7a5030, 0.7);
  if (homeOpt.tv === 0) {
    grp.add(box(1.5, 0.95, 0.55, wood, 0, 0.72, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.68),
      new THREE.MeshStandardMaterial({ map: screenTexture(), emissive: 0xffffff, emissiveMap: screenTexture(), emissiveIntensity: 0.5, roughness: 0.4 }));
    scr.position.set(-0.14, 0.74, 0.281); grp.add(scr);
    homeRefs.screen = scr.material;
    const knob = stdPlain(0x3c281a, 0.6);
    const k1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), knob);
    k1.rotation.x = Math.PI / 2; k1.position.set(0.55, 0.92, 0.29); grp.add(k1);
    const k2 = k1.clone(); k2.position.y = 0.62; grp.add(k2);
    grp.add(box(0.08, 0.26, 0.08, wood, -0.6, 0.12, 0.15));
    grp.add(box(0.08, 0.26, 0.08, wood, 0.6, 0.12, 0.15));
  } else if (homeOpt.tv === 1) {
    const body = stdPlain(0x54545c, 0.55);
    grp.add(box(1.5, 0.1, 0.6, wood, 0, 0.78, 0));
    grp.add(box(0.08, 0.78, 0.08, wood, -0.62, 0.39, 0.2));
    grp.add(box(0.08, 0.78, 0.08, wood, 0.62, 0.39, 0.2));
    grp.add(box(0.95, 0.62, 0.5, body, 0, 1.14, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.44),
      new THREE.MeshStandardMaterial({ map: screenTexture(), emissive: 0xffffff, emissiveMap: screenTexture(), emissiveIntensity: 0.45, roughness: 0.4 }));
    scr.position.set(-0.08, 1.14, 0.251); grp.add(scr);
    homeRefs.screen = scr.material;
    const ant = stdPlain(0x222226, 0.4);
    grp.add(limb(new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(-0.45, 1.95, 0), 0.008, ant));
    grp.add(limb(new THREE.Vector3(0, 1.45, 0), new THREE.Vector3(0.5, 1.9, 0), 0.008, ant));
  } else {
    grp.add(box(1.1, 0.09, 0.45, wood, 0, 0.62, 0));
    grp.add(box(0.07, 0.62, 0.07, wood, -0.45, 0.31, 0.15));
    grp.add(box(0.07, 0.62, 0.07, wood, 0.45, 0.31, 0.15));
    grp.add(box(0.78, 0.42, 0.3, stdPlain(0x966036, 0.65), 0, 0.88, 0));
    const spk = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20),
      stdPlain(0xf0e2b4, 0.8));
    spk.position.set(-0.16, 0.88, 0.151); grp.add(spk);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), stdPlain(0x3c281a, 0.6));
    dial.rotation.x = Math.PI / 2; dial.position.set(0.22, 0.88, 0.16); grp.add(dial);
    grp.add(limb(new THREE.Vector3(0.15, 1.09, 0), new THREE.Vector3(0.55, 1.6, 0), 0.007, stdPlain(0x3c281a, 0.5)));
  }
  return grp;
}
function makeLamp3D() {
  const grp = new THREE.Group();
  if (homeOpt.lamp === 2) return grp;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.22, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xf6dca0, roughness: 0.9, emissive: 0xffca7a, emissiveIntensity: 0.55, side: THREE.DoubleSide }));
  const pole = stdPlain(0x46321f, 0.6);
  if (homeOpt.lamp === 0) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), pole);
    base.position.y = 0.02; grp.add(base);
    grp.add(limb(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 1.5, 0), 0.022, pole));
    shade.position.y = 1.56; grp.add(shade);
    homeRefs.lampLight.position.set(0, 1.5, 0);
  } else {
    grp.add(box(0.55, 0.05, 0.4, stdPlain(0x6e4a2c, 0.7), 0, 0.52, 0));
    grp.add(box(0.06, 0.52, 0.06, stdPlain(0x6e4a2c, 0.7), -0.2, 0.26, 0.12));
    grp.add(box(0.06, 0.52, 0.06, stdPlain(0x6e4a2c, 0.7), 0.2, 0.26, 0.12));
    grp.add(limb(new THREE.Vector3(0, 0.54, 0), new THREE.Vector3(0, 0.86, 0), 0.018, pole));
    shade.position.y = 0.92; grp.add(shade);
    homeRefs.lampLight.position.set(0, 0.88, 0);
  }
  grp.add(homeRefs.lampLight);
  return grp;
}
function makePlant3D(onSill) {
  const grp = new THREE.Group();
  if (homeOpt.plant === 0) return grp;
  if (homeOpt.plant === 1 && !onSill) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 12), stdPlain(0xa85c36, 0.8));
    pot.position.y = 0.15; grp.add(pot);
    const leaf = stdPlain(0x4a8a4a, 0.9);
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 7), leaf);
      const a = i / 6 * Math.PI * 2;
      c.position.set(Math.cos(a) * 0.09, 0.52, Math.sin(a) * 0.09);
      c.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
      grp.add(c);
    }
  } else if (homeOpt.plant === 2 && onSill) {
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 10), stdPlain(0x548cb0, 0.5));
    vase.position.y = 0.08; grp.add(vase);
    const cols = [0xe85c6c, 0xf6be54, 0xee8cb4];
    for (let i = 0; i < 3; i++) {
      const fx = (i - 1) * 0.055;
      grp.add(limb(new THREE.Vector3(0, 0.14, 0), new THREE.Vector3(fx, 0.3, 0), 0.008, stdPlain(0x4a8a4a, 0.9)));
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), stdPlain(cols[i], 0.7));
      f.position.set(fx, 0.33, 0); grp.add(f);
    }
  }
  return grp;
}
function makeDecor3D() {
  const grp = new THREE.Group();
  const frame = stdPlain(0x785430, 0.6);
  if (homeOpt.decor === 0 || homeOpt.decor === 2) {
    const rayM = stdPlain(0xc49434, 0.45);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, r1 = i % 2 === 0 ? 0.52 : 0.44;
      const ray = box(0.035, r1 - 0.3, 0.03, rayM, 0, 0, 0);
      ray.position.set(Math.cos(a) * (0.3 + r1) / 2 * 1.0, Math.sin(a) * (0.3 + r1) / 2, 0);
      ray.rotation.z = a - Math.PI / 2;
      ray.position.x = Math.cos(a) * 0.40; ray.position.y = Math.sin(a) * 0.40;
      grp.add(ray);
    }
    if (homeOpt.decor === 2) {
      // the Starburst Mirror is a REAL mirror: it shows the
      // room rendered from a reflected camera (renderMirror,
      // in the loop) — stand her in front of it and she sees
      // herself, face and all.
      if (!mirrorRT) mirrorRT = new THREE.WebGLRenderTarget(512, 512);
      const fm = new THREE.MeshBasicMaterial({ map: mirrorRT.texture });
      fm.userData.keepMap = true;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 26), fm);
      face.position.z = 0.02; grp.add(face);
      homeRefs.mirror = face;
    } else {
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 26),
        new THREE.MeshStandardMaterial({ map: clockTexture(false), roughness: 0.6, metalness: 0 }));
      face.position.z = 0.02; grp.add(face);
    }
  } else if (homeOpt.decor === 1) {
    grp.add(box(0.7, 0.7, 0.05, frame, 0, 0, 0));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshStandardMaterial({ map: portraitTexture(), roughness: 0.85 }));
    p.position.z = 0.03; grp.add(p);
  } else {
    grp.add(box(0.88, 0.62, 0.05, frame, 0, 0, 0));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.52),
      new THREE.MeshStandardMaterial({ map: landscapeTexture(), roughness: 0.85 }));
    p.position.z = 0.03; grp.add(p);
  }
  return grp;
}
function makeHand(skin) {
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), skin);
  palm.scale.set(1, 0.45, 1.3);
  hand.add(palm);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const fx = -0.027 + i * 0.018, fl = 0.040 - Math.abs(i - 1.5) * 0.005;
    const seg = limb(new THREE.Vector3(fx, -0.004, 0.042),
      new THREE.Vector3(fx, -0.030, 0.042 + fl), 0.0085, skin);
    hand.add(seg);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), skin);
    tip.position.set(fx, -0.030, 0.042 + fl);
    hand.add(tip);
    fingers.push([seg, tip]);
  }
  const thumb = limb(new THREE.Vector3(0.040, -0.002, 0.008),
    new THREE.Vector3(0.058, -0.016, 0.036), 0.009, skin);
  hand.add(thumb);
  fingers.push([thumb]);
  hand.userData.fingers = fingers;
  return hand;
}
function makeMom3D() {
  const grp = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ map: skinTexture(), roughness: 0.5 });
  const hairTex = hairTexture();
  const hairM = new THREE.MeshStandardMaterial({ map: hairTex, roughness: 0.72 });
  const dressTex = dressTexture();
  const dressMat = new THREE.MeshStandardMaterial({ map: dressTex, roughness: 0.68 });
  const apronMat = new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.85, side: THREE.DoubleSide });
  const white = stdPlain(0xfdfaf0, 0.6);
  const pearl = stdPlain(0xf4ead8, 0.3);
  // ---- dress: a real silhouette on the lathe, polka-dot fabric
  const pts = [[0.47, 0.30], [0.455, 0.52], [0.40, 0.72], [0.315, 0.92], [0.245, 1.05], [0.235, 1.13], [0.26, 1.24], [0.235, 1.33], [0.16, 1.40], [0.065, 1.44]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const dressMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), dressMat);
  grp.add(dressMesh);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.466, 0.011, 8, 40), white);
  hem.rotation.x = Math.PI / 2; hem.position.y = 0.305;
  grp.add(hem);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.215, 40, 28), dressMat);
  homeRefs.bellyMesh = belly;
  belly.scale.set(1, 1.08, 0.85);
  belly.position.set(0, 0.97, 0.155);
  grp.add(belly);
  // ---- her chest: a real bust under the bodice (Isaiah's
  // catch — it was never modeled). Two forms in dress fabric;
  // the apron bib drapes over them. Rigged below.
  const bustGeo = new THREE.SphereGeometry(0.085, 24, 18);
  const bustL = new THREE.Mesh(bustGeo, dressMat);
  bustL.scale.set(1, 1.12, 0.9);
  bustL.position.set(-0.088, 1.315, 0.19);
  grp.add(bustL);
  const bustR = new THREE.Mesh(bustGeo, dressMat);
  bustR.scale.set(1, 1.12, 0.9);
  bustR.position.set(0.088, 1.315, 0.19);
  grp.add(bustR);
  homeRefs.bustMeshes = [bustL, bustR];
  // ---- apron: bib + waistband + skirt panel across the front
  const apronPhi = [-0.85, 1.7];
  const bib = new THREE.Mesh(new THREE.LatheGeometry(
    [[0.252, 1.14], [0.29, 1.24], [0.288, 1.33], [0.185, 1.395]].map(p => new THREE.Vector2(p[0], p[1])),
    20, apronPhi[0], apronPhi[1]), apronMat);
  grp.add(bib);
  const band = new THREE.Mesh(new THREE.LatheGeometry(
    [[0.253, 1.095], [0.253, 1.155]].map(p => new THREE.Vector2(p[0], p[1])),
    20, apronPhi[0], apronPhi[1]), apronMat);
  grp.add(band);
  const apronSkirt = new THREE.Mesh(new THREE.LatheGeometry(
    [[0.478, 0.315], [0.462, 0.52], [0.408, 0.72], [0.335, 0.90]].map(p => new THREE.Vector2(p[0], p[1])),
    20, apronPhi[0], apronPhi[1]), apronMat);
  grp.add(apronSkirt);
  const straps = [];
  for (const sx of [-0.082, 0.082]) {
    const strap = box(0.032, 0.13, 0.010, apronMat, sx, 1.418, 0.088);
    strap.rotation.x = -0.62;
    grp.add(strap);
    straps.push(strap);
  }
  // collar, necklace, brooch
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.010, 10, 22), white);
  collar.rotation.x = Math.PI / 2 - 0.55; collar.position.set(0, 1.444, 0.020);
  grp.add(collar);
  const necklaceMesh = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0055, 8, 22), pearl);
  necklaceMesh.rotation.x = Math.PI / 2 - 0.5; necklaceMesh.position.set(0, 1.352, 0.185);
  grp.add(necklaceMesh);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), pearl);
  pendant.position.set(0, 1.312, 0.252);
  grp.add(pendant);
  const brooch = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16), stdPlain(0xc49434, 0.35));
  brooch.position.set(0.095, 1.345, 0.222); brooch.rotation.x = -0.3;
  grp.add(brooch);
  // ---- puff sleeves, arms, and HANDS with fingers
  const puffs = [];
  for (const sx of [-0.225, 0.225]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.078, 24, 16), dressMat);
    puff.scale.set(1.15, 0.85, 1.15);
    puff.position.set(sx, 1.315, 0.01);
    grp.add(puff);
    puffs.push(puff);
  }
  const upArmR = limb(new THREE.Vector3(0.225, 1.29, 0.02), new THREE.Vector3(0.315, 1.07, 0.10), 0.048, dressMat);
  grp.add(upArmR);
  const foreArmR = limb(new THREE.Vector3(0.315, 1.07, 0.10), new THREE.Vector3(0.105, 1.115, 0.262), 0.036, skin);
  grp.add(foreArmR);
  const bumpHand = makeHand(skin);
  bumpHand.position.set(0.105, 1.125, 0.285);
  bumpHand.rotation.set(0.35, -0.15, 0.35);
  grp.add(bumpHand);
  const upArmL = limb(new THREE.Vector3(-0.225, 1.29, 0.02), new THREE.Vector3(-0.305, 1.05, 0.03), 0.048, dressMat);
  grp.add(upArmL);
  const foreArmL = limb(new THREE.Vector3(-0.305, 1.05, 0.03), new THREE.Vector3(-0.105, 1.115, 0.262), 0.036, skin);
  grp.add(foreArmL);
  const restHand = makeHand(skin);
  restHand.position.set(-0.105, 1.125, 0.285);
  restHand.rotation.set(0.35, 0.15, -0.35);
  restHand.scale.x = -1; // a true left hand: thumb on the inside
  grp.add(restHand);
  homeRefs.handGroups = [bumpHand, restHand];
  // ---- legs: shaped shins, ankles, and real heeled pumps (extruded)
  const shoeShape = new THREE.Shape();
  shoeShape.moveTo(-0.035, 0.02);
  shoeShape.lineTo(-0.035, 0.095);
  shoeShape.quadraticCurveTo(0.02, 0.105, 0.055, 0.068);
  shoeShape.quadraticCurveTo(0.13, 0.03, 0.205, 0.02);
  shoeShape.quadraticCurveTo(0.225, 0.012, 0.215, 0.0);
  shoeShape.lineTo(-0.035, 0.0);
  const shoeGeo = new THREE.ExtrudeGeometry(shoeShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
  shoeGeo.translate(0, 0, -0.03);
  const shoeMat = stdPlain(0xa31628, 0.35);
  const shins = [], ankles = [], shoes = [], heels = [];
  for (const sx of [-0.09, 0.09]) {
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.028, 0.30, 12), skin);
    shin.position.set(sx, 0.17, 0.01);
    grp.add(shin); shins.push(shin);
    const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), skin);
    ankle.position.set(sx, 0.035, 0.015);
    grp.add(ankle); ankles.push(ankle);
    const shoe = new THREE.Mesh(shoeGeo, shoeMat);
    shoe.rotation.y = -Math.PI / 2 + (sx < 0 ? 0.06 : -0.06);
    shoe.position.set(sx, 0.048, 0.045);
    grp.add(shoe); shoes.push(shoe);
    const heel = box(0.05, 0.048, 0.034, stdPlain(0x7c1626, 0.4), sx - 0.018, 0.024, -0.028);
    grp.add(heel); heels.push(heel);
  }
  // ---- neck, shaped head, and a real painted face
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.10, 14), skin);
  homeRefs.momNeckMesh = neckMesh;
  neckMesh.position.set(0, 1.475, 0);
  grp.add(neckMesh);
  const headGeo = new THREE.SphereGeometry(0.148, 64, 48);
  {
    const pos = headGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ny = y / 0.148;
      if (ny < 0) { // taper the jaw + chin so she has a face shape, not a ball
        const t = -ny;
        x *= 1 - 0.17 * t * t;
        z *= 1 - (z > 0 ? 0.05 : 0.10) * t * t;
      }
      pos.setXYZ(i, x, y, z);
    }
    headGeo.computeVertexNormals();
  }
  const head = new THREE.Mesh(headGeo, skin);
  homeRefs.momHeadMesh = head;
  head.position.set(0, 1.60, 0);
  head.scale.set(1, 1.07, 0.97);
  grp.add(head);
  const faceTex = momFaceTexture();
  homeRefs.faceTex = faceTex;
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1555, 0.1515, 0.205, 48, 1, true, -0.66, 1.32),
    new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 }));
  face.position.set(0, 1.608, 0);
  grp.add(face);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 16, 12), skin);
  nose.scale.set(0.72, 0.95, 0.66);
  nose.position.set(0, 1.574, 0.1435);
  nose.rotation.x = -0.15;
  grp.add(nose);
  const ears = [], studs = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), skin);
    ear.scale.set(0.5, 1, 0.75);
    ear.position.set(sx * 0.146, 1.595, 0);
    grp.add(ear); ears.push(ear);
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), pearl);
    stud.position.set(sx * 0.153, 1.562, 0.004);
    grp.add(stud); studs.push(stud);
  }
  // ---- Aerith's hair: chestnut mass, fringe, temple curls, braid
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.156, 36, 24), hairM);
  backHair.scale.set(1.04, 1.06, 1.04); backHair.position.set(0, 1.62, -0.028);
  grp.add(backHair);
  const bangs = new THREE.Mesh(
    new THREE.SphereGeometry(0.159, 48, 20, Math.PI / 2 - 1.15, 2.3, 0, 1.04),
    new THREE.MeshStandardMaterial({ map: hairTex, roughness: 0.72, side: THREE.DoubleSide }));
  bangs.position.set(0, 1.60, 0);
  bangs.scale.set(1, 1.07, 0.97);
  grp.add(bangs);
  const locks = [], curls = [];
  for (const sx of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), hairM);
    lock.scale.set(0.8, 1.9, 0.8);
    lock.position.set(sx * 0.142, 1.53, 0.012);
    grp.add(lock); locks.push(lock);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * 0.105, 1.685, 0.088),
      new THREE.Vector3(sx * 0.132, 1.615, 0.108),
      new THREE.Vector3(sx * 0.120, 1.545, 0.100),
      new THREE.Vector3(sx * 0.133, 1.478, 0.108),
      new THREE.Vector3(sx * 0.118, 1.452, 0.095)
    ]);
    const curl = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0165, 12), hairM);
    grp.add(curl); curls.push(curl);
  }
  const ribbonM = stdPlain(0xe88bb0, 0.55);
  const bowAt = (y, z, s) => {
    const bow = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.021 * s, 10, 8), ribbonM);
    bow.add(knot);
    for (const sx of [-1, 1]) {
      const tail = box(0.034 * s, 0.085 * s, 0.008, ribbonM, sx * 0.022 * s, -0.048 * s, 0);
      tail.rotation.z = sx * 0.45; tail.rotation.x = 0.2;
      bow.add(tail);
    }
    bow.position.set(0, y, z);
    grp.add(bow);
    return bow;
  };
  const braidSegs = [];
  for (let i = 0; i < 8; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 14), hairM);
    const t = i / 7;
    seg.scale.set(1.18, 0.82, 1.18);
    seg.position.set((i % 2 === 0 ? -1 : 1) * 0.011, 1.665 - i * 0.088, -0.155 - Math.sin(t * Math.PI * 0.5) * 0.145);
    seg.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.5;
    grp.add(seg); braidSegs.push(seg);
  }
  const bowTop = bowAt(1.715, -0.165, 0.85);
  const bowEnd = bowAt(1.005, -0.302, 1.1);
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.heart, transparent: true, depthWrite: false }));
  heart.scale.set(0.3, 0.3, 1);
  heart.position.set(-0.34, 1.28, 0.3);
  grp.add(heart);
  homeRefs.momHeart = heart;
  homeRefs.mom = grp;

  // ================================================================
  // THE 180-BONE RIG. Every part above is bound to its bone
  // (rigid binding, PS2-style); the rig is animated in syncHome:
  // breathing spine, a gentle head, a swaying braid and skirt,
  // and a bump that kicks. Bone map (auditable, totals 180):
  //   hips 1 · spine+neck+head 5 · face 15 · hair 14 · braid 15
  //   arms 8 · fingers 30 · legs 8 · shoes 4 · skirt 48 · hem 8
  //   apron 14 · belly 2 · jewelry 6 · puffs 2          = 180
  // ================================================================
  const rigBones = [];
  const boneAbs = new Map();
  const B = (parent, name, ax, ay, az) => {
    const b = new THREE.Bone();
    b.name = name;
    const p = parent ? boneAbs.get(parent) : { x: 0, y: 0, z: 0 };
    b.position.set(ax - p.x, ay - p.y, az - p.z);
    boneAbs.set(b, { x: ax, y: ay, z: az });
    if (parent) parent.add(b);
    rigBones.push(b);
    return b;
  };
  const BL = (parent, name, x, y, z) => { // local-offset bone (fingers)
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    rigBones.push(b);
    return b;
  };
  const hips = B(null, "hips", 0, 1.03, 0.01); grp.add(hips);
  homeRefs.headBone = null; // set below, once the head bone exists
  const spineLower = B(hips, "spineLower", 0, 1.14, 0.01);
  const spineMid = B(spineLower, "spineMid", 0, 1.25, 0.01);
  const chest = B(spineMid, "chest", 0, 1.36, 0.015);
  const neckB = B(chest, "neck", 0, 1.46, 0.01);
  const headB = B(neckB, "head", 0, 1.55, 0.01);
  homeRefs.headBone = headB;
  // face bones (15)
  const jawB = B(headB, "jaw", 0, 1.50, 0.10);
  B(headB, "eyeL", -0.055, 1.617, 0.135); B(headB, "eyeR", 0.055, 1.617, 0.135);
  B(headB, "lidUpL", -0.055, 1.645, 0.13); B(headB, "lidUpR", 0.055, 1.645, 0.13);
  B(headB, "lidLoL", -0.055, 1.585, 0.132); B(headB, "lidLoR", 0.055, 1.585, 0.132);
  B(headB, "browL", -0.058, 1.665, 0.125); B(headB, "browR", 0.058, 1.665, 0.125);
  const noseB = B(headB, "nose", 0, 1.575, 0.14);
  B(headB, "cheekL", -0.085, 1.575, 0.10); B(headB, "cheekR", 0.085, 1.575, 0.10);
  const earLB = B(headB, "earL", -0.148, 1.595, 0);
  const earRB = B(headB, "earR", 0.148, 1.595, 0);
  B(headB, "chin", 0, 1.475, 0.085);
  // hair bones (14)
  const scalpB = B(headB, "scalp", 0, 1.66, -0.01);
  B(scalpB, "fringeL", -0.07, 1.685, 0.10); B(scalpB, "fringeC", 0, 1.70, 0.115); B(scalpB, "fringeR", 0.07, 1.685, 0.10);
  const lockLB = B(headB, "lockL", -0.142, 1.56, 0.012);
  const lockRB = B(headB, "lockR", 0.142, 1.56, 0.012);
  const curlBones = { "-1": [], "1": [] };
  for (const s of [-1, 1]) {
    let prev = headB;
    const chainPts = [[0.105, 1.685, 0.088], [0.132, 1.615, 0.108], [0.120, 1.545, 0.100], [0.133, 1.478, 0.108]];
    chainPts.forEach((p, i) => {
      prev = B(prev, "curl" + (s < 0 ? "L" : "R") + (i + 1), s * p[0], p[1], p[2]);
      curlBones[String(s)].push(prev);
    });
  }
  // braid bones (15): a 12-bone chain + end bow + 2 ribbon tails
  const braidBones = [];
  {
    let prev = scalpB;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      prev = B(prev, "braid" + (i + 1), (i % 2 ? 0.008 : -0.008), 1.68 - i * 0.0618, -0.155 - Math.sin(t * Math.PI * 0.5) * 0.145);
      braidBones.push(prev);
    }
  }
  const braidBowB = B(braidBones[11], "braidBow", 0, 0.985, -0.305);
  B(braidBowB, "ribbonTailL", -0.025, 0.94, -0.305);
  B(braidBowB, "ribbonTailR", 0.025, 0.94, -0.305);
  // arm + finger bones (8 + 30)
  const armBones = {};
  for (const s of [-1, 1]) {
    const tag = s < 0 ? "L" : "R";
    const clav = B(chest, "clav" + tag, s * 0.10, 1.42, 0.01);
    const upArm = B(clav, "upArm" + tag, s * 0.225, 1.31, 0.015);
    const foreArm = B(upArm, "foreArm" + tag, s * 0.315, 1.08, 0.095);
    const handPos = s < 0 ? [-0.105, 1.125, 0.285] : [0.105, 1.125, 0.285];
    const handB = B(foreArm, "hand" + tag, handPos[0], handPos[1], handPos[2]);
    const fingerRoots = [];
    const knuckles = [[-0.027, -0.004, 0.042], [-0.009, -0.004, 0.042], [0.009, -0.004, 0.042], [0.027, -0.004, 0.042], [0.040, -0.002, 0.008]];
    knuckles.forEach((k, f) => {
      const root = BL(handB, "finger" + tag + f + "a", k[0], k[1], k[2]);
      const mid = BL(root, "finger" + tag + f + "b", 0, -0.016, 0.020);
      BL(mid, "finger" + tag + f + "c", 0, -0.014, 0.018);
      fingerRoots.push(root);
    });
    armBones[tag] = { clav, upArm, foreArm, handB, fingerRoots };
  }
  // leg + shoe bones (8 + 4)
  const legBones = {};
  for (const s of [-1, 1]) {
    const tag = s < 0 ? "L" : "R";
    const thigh = B(hips, "thigh" + tag, s * 0.09, 0.98, 0.01);
    const shin = B(thigh, "shin" + tag, s * 0.09, 0.62, 0.01);
    const foot = B(shin, "foot" + tag, s * 0.09, 0.06, 0.015);
    B(foot, "toe" + tag, s * 0.09, 0.03, 0.14);
    const shoe = B(foot, "shoe" + tag, s * 0.09, 0.05, 0.03);
    const heelB = B(shoe, "heel" + tag, s * 0.09 - 0.018, 0.025, -0.03);
    legBones[tag] = { thigh, shin, foot, shoe, heelB };
  }
  // skirt bones: 16 columns x 3 rows (48) + hem ring (8)
  const skirtMid = [];
  for (let c = 0; c < 16; c++) {
    const a = c / 16 * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    const r0 = B(hips, "skirt" + c + "a", sx * 0.30, 0.94, cz * 0.30);
    const r1 = B(r0, "skirt" + c + "b", sx * 0.40, 0.64, cz * 0.40);
    B(r1, "skirt" + c + "c", sx * 0.465, 0.35, cz * 0.465);
    skirtMid.push(r1);
  }
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    B(hips, "hem" + k, Math.sin(a) * 0.466, 0.315, Math.cos(a) * 0.466);
  }
  // apron bones (14)
  B(chest, "bibL", -0.06, 1.30, 0.235); B(chest, "bibR", 0.06, 1.30, 0.235);
  B(hips, "bandL", -0.15, 1.10, 0.20); B(hips, "bandR", 0.15, 1.10, 0.20);
  for (let j = 0; j < 4; j++) {
    const a = -0.6 + j * 0.4;
    const p0 = B(hips, "apron" + j + "a", Math.sin(a) * 0.36, 0.88, Math.cos(a) * 0.36);
    B(p0, "apron" + j + "b", Math.sin(a) * 0.44, 0.55, Math.cos(a) * 0.44);
  }
  const strapLB = B(chest, "strapL", -0.082, 1.42, 0.09);
  const strapRB = B(chest, "strapR", 0.082, 1.42, 0.09);
  // belly bones (2): the bump, and the baby inside it
  const bumpB = B(spineMid, "bump", 0, 1.00, 0.10);
  B(bumpB, "babyKick", 0, 0.97, 0.20);
  // her chest bones (2): the bust, breathing with the chest
  const bustBL = B(chest, "bustL", -0.088, 1.315, 0.19);
  const bustBR = B(chest, "bustR", 0.088, 1.315, 0.19);
  // jewelry bones (6)
  const collarB = B(neckB, "collar", 0, 1.445, 0.02);
  const necklaceB = B(chest, "necklace", 0, 1.35, 0.19);
  const pendantB = B(necklaceB, "pendant", 0, 1.312, 0.252);
  const broochB = B(chest, "brooch", 0.095, 1.345, 0.222);
  const studLB = B(earLB, "studL", -0.153, 1.562, 0.004);
  const studRB = B(earRB, "studR", 0.153, 1.562, 0.004);
  // puff sleeve bones (2)
  const puffLB = B(chest, "puffL", -0.225, 1.315, 0.01);
  const puffRB = B(chest, "puffR", 0.225, 1.315, 0.01);

  homeRefs.rig = { bones: rigBones, skeleton: new THREE.Skeleton(rigBones) };
  // ---- bind the parts to their bones (world transforms preserved)
  grp.updateMatrixWorld(true);
  const bind = (mesh, bone) => { if (mesh && bone) bone.attach(mesh); };
  bind(dressMesh, spineMid);
  bind(hem, hips);
  bind(belly, bumpB);
  bind(bustL, bustBL); bind(bustR, bustBR);
  bind(bib, chest); bind(band, hips); bind(apronSkirt, hips);
  bind(straps[0], strapLB); bind(straps[1], strapRB);
  bind(collar, collarB); bind(necklaceMesh, necklaceB);
  bind(pendant, pendantB); bind(brooch, broochB);
  bind(puffs[0], puffLB); bind(puffs[1], puffRB);
  bind(upArmR, armBones.R.upArm); bind(foreArmR, armBones.R.foreArm);
  bind(upArmL, armBones.L.upArm); bind(foreArmL, armBones.L.foreArm);
  bind(bumpHand, armBones.R.handB); bind(restHand, armBones.L.handB);
  for (const [hand, tag] of [[bumpHand, "R"], [restHand, "L"]]) {
    hand.userData.fingers.forEach((meshes, f) => {
      meshes.forEach(m => bind(m, armBones[tag].fingerRoots[f]));
    });
  }
  bind(shins[0], legBones.L.shin); bind(shins[1], legBones.R.shin);
  bind(ankles[0], legBones.L.foot); bind(ankles[1], legBones.R.foot);
  bind(shoes[0], legBones.L.shoe); bind(shoes[1], legBones.R.shoe);
  bind(heels[0], legBones.L.heelB); bind(heels[1], legBones.R.heelB);
  bind(neckMesh, neckB);
  bind(head, headB); bind(face, headB); bind(nose, noseB);
  bind(ears[0], earLB); bind(ears[1], earRB);
  bind(studs[0], studLB); bind(studs[1], studRB);
  bind(backHair, scalpB); bind(bangs, scalpB);
  bind(locks[0], lockLB); bind(locks[1], lockRB);
  bind(curls[0], curlBones["-1"][0]); bind(curls[1], curlBones["1"][0]);
  const segBoneIdx = [0, 1, 3, 4, 6, 7, 9, 10];
  braidSegs.forEach((seg, i) => bind(seg, braidBones[segBoneIdx[i]]));
  bind(bowTop, braidBones[0]);
  bind(bowEnd, braidBowB);
  // ---- the rig at play: breathing, sway, and baby kicks
  const bumpBaseZ = bumpB.position.z;
  let handBaseZR = armBones.R.handB.position.z;
  let handBaseZL = armBones.L.handB.position.z;
  // ---- her bump grows with the weeks (and a little per extra
  // baby): the belly scales on its bone, her hands and forearms
  // ride out with it so they stay ON the bump at any week
  let bumpBase = 1;
  const handBasePosR = armBones.R.handB.position.clone();
  const handBasePosL = armBones.L.handB.position.clone();
  homeRefs.applyBump = () => {
    const f = bumpFactor();
    bumpBase = f;
    const g = f - 1;
    armBones.R.handB.position.set(handBasePosR.x * (1 + g * 0.35), handBasePosR.y + g * 0.03, handBasePosR.z + g * 0.16);
    armBones.L.handB.position.set(handBasePosL.x * (1 + g * 0.35), handBasePosL.y + g * 0.03, handBasePosL.z + g * 0.16);
    handBaseZR = armBones.R.handB.position.z;
    handBaseZL = armBones.L.handB.position.z;
    armBones.R.foreArm.rotation.x = g * 0.22;
    armBones.L.foreArm.rotation.x = g * 0.22;
  };
  homeRefs.applyBump();
  let nextKick = 5, kickAt = -1;
  homeRefs.rigPose = (t) => {
    chest.rotation.x = Math.sin(t * 1.15) * 0.010;
    spineMid.rotation.z = Math.sin(t * 0.5) * 0.006;
    headB.rotation.y = Math.sin(t * 0.23) * 0.055;
    headB.rotation.z = Math.sin(t * 0.31) * 0.02;
    braidBones.forEach((b, i) => {
      b.rotation.x = Math.sin(t * 1.35 - i * 0.5) * 0.05;
      b.rotation.z = Math.cos(t * 0.9 - i * 0.42) * 0.028;
    });
    curlBones["-1"].forEach((b, i) => { b.rotation.x = Math.sin(t * 1.7 - i * 0.6) * 0.04; });
    curlBones["1"].forEach((b, i) => { b.rotation.x = Math.sin(t * 1.7 + 1.3 - i * 0.6) * 0.04; });
    skirtMid.forEach((b, c) => { b.rotation.x = Math.sin(t * 0.8 + c * 0.7) * 0.016; });
    if (t > nextKick) { kickAt = t; nextKick = t + 6 + Math.random() * 8; }
    const kp = kickAt > 0 && t - kickAt < 0.45 ? Math.sin((t - kickAt) / 0.45 * Math.PI) : 0;
    bumpB.position.z = bumpBaseZ + kp * 0.012;
    bumpB.scale.setScalar(bumpBase * (1 + kp * 0.05));
    const bb = 1 + Math.sin(t * 1.15) * 0.012;
    bustBL.scale.setScalar(bb); bustBR.scale.setScalar(bb);
    // her hands are ON the bump — they ride every kick with it
    armBones.R.handB.position.z = handBaseZR + kp * 0.012;
    armBones.L.handB.position.z = handBaseZL + kp * 0.012;
    homeRefs.kickPulse = kp;
  };
  return grp;
}


// ------------------------------------------------------------ the town
// v0.5.0: her house is a real house in a real little town —
// siding and a roof outside, front and back doors that open,
// a fenced backyard, streets, neighbours, traffic, and her
// 1953 Bel Air on the driveway. Everything animates.
function prismRoof(w, h, d, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, h); shape.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), mat);
  m.position.z = -d / 2;
  return m;
}
function makeHouse3D(w, d, wallC, roofC) {
  const g = new THREE.Group();
  const wallM = new THREE.MeshStandardMaterial({ map: sidingTexture(), color: wallC, roughness: 0.95 });
  const roofM = new THREE.MeshStandardMaterial({ map: shingleTexture(), color: roofC, roughness: 0.95 });
  const winM = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffca55, emissiveIntensity: 0.35, roughness: 0.4 });
  const walls = box(w, 3.0, d, wallM, 0, 1.5, 0); walls.castShadow = true; walls.receiveShadow = true; g.add(walls);
  const roof = prismRoof(w + 1.0, 1.9, d + 1.0, roofM);
  roof.position.y = 3.0; roof.castShadow = true; g.add(roof);
  g.add(box(0.95, 2.05, 0.08, stdPlain(0x7a4a28, 0.8), 0, 1.02, d / 2 + 0.02));
  g.add(box(0.8, 0.9, 0.06, winM, -w / 4, 1.7, d / 2 + 0.02));
  g.add(box(0.8, 0.9, 0.06, winM, w / 4, 1.7, d / 2 + 0.02));
  g.add(box(0.5, 0.8, 0.5, stdPlain(0x9c8a76, 0.95), w / 4, 4.6, 0));
  return g;
}
function makeTree3D(x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.19 * s, 1.7 * s, 8), stdPlain(0x6e4a2c, 1));
  trunk.position.y = 0.85 * s; trunk.castShadow = true; g.add(trunk);
  const canopy = new THREE.Group();
  const leafM = new THREE.MeshStandardMaterial({ map: leafTexture(), roughness: 1 });
  for (const [lx, ly, lz, lr] of [[0, 2.5, 0, 1.15], [0.75, 2.0, 0.3, 0.8], [-0.7, 2.1, -0.25, 0.85]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(lr * s, 12, 10), leafM);
    b.position.set(lx * s, ly * s, lz * s); b.castShadow = true; canopy.add(b);
  }
  g.add(canopy);
  g.position.set(x, 0, z);
  g.userData.canopy = canopy;
  return g;
}
function makeBelAir53() {
  // her car: a 1953 Chevrolet Bel Air, two-tone turquoise and
  // cream, chrome everywhere it should be. Faces +z.
  const g = new THREE.Group();
  const bodyG = new THREE.Group(); // everything sprung: body, glass, cockpit
  g.add(bodyG);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x2e7f86, roughness: 0.3, metalness: 0.15, clearcoat: 0.75, clearcoatRoughness: 0.28 }); // showroom coat
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.4, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.18, metalness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2a30, roughness: 0.12, metalness: 0.5 });
  bodyG.add(box(1.78, 0.52, 4.62, paint, 0, 0.62, 0));            // body
  bodyG.add(box(1.70, 0.26, 3.05, paint, 0, 0.97, -0.625));      // rear deck (the hood is its own panel now)
  bodyG.add(box(1.64, 0.24, 2.26, paint, 0, 1.16, -0.15));       // cabin lower
  // glasshouse as four panes (no top/bottom slabs — from the
  // driver's seat a solid box's underside blacks out the view)
  bodyG.add(box(1.56, 0.36, 0.03, glass, 0, 1.40, 0.90));
  bodyG.add(box(1.56, 0.36, 0.03, glass, 0, 1.40, -1.20));
  bodyG.add(box(0.03, 0.36, 2.08, glass, -0.78, 1.40, -0.15));
  bodyG.add(box(0.03, 0.36, 2.08, glass, 0.78, 1.40, -0.15));
  bodyG.add(box(1.66, 0.07, 2.30, cream, 0, 1.61, -0.15));       // cream roof
  bodyG.add(box(0.03, 0.055, 3.7, chrome, -0.90, 0.78, 0));      // side spears
  bodyG.add(box(0.03, 0.055, 3.7, chrome, 0.90, 0.78, 0));
  bodyG.add(box(1.34, 0.24, 0.07, chrome, 0, 0.60, 2.32));       // grille
  for (let i = -2; i <= 2; i++) bodyG.add(box(0.09, 0.17, 0.03, chrome, i * 0.26, 0.60, 2.36));
  bodyG.add(box(1.92, 0.15, 0.12, chrome, 0, 0.36, 2.36));       // bumpers
  bodyG.add(box(1.92, 0.15, 0.12, chrome, 0, 0.36, -2.36));
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffedb8, emissiveIntensity: 0.5, roughness: 0.3 });
  for (const sx of [-0.63, 0.63]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.05, 14), chrome);
    ring.rotation.x = Math.PI / 2; ring.position.set(sx, 0.90, 2.30); bodyG.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 14), lampM);
    lens.rotation.x = Math.PI / 2; lens.position.set(sx, 0.90, 0.30 + 2.0); bodyG.add(lens);
    bodyG.add(box(0.16, 0.09, 0.05, new THREE.MeshStandardMaterial({ color: 0xa02318, emissive: 0x701208, emissiveIntensity: 0.4 }), sx + 0.07, 0.86, -2.33));
  }
  // everything added to bodyG so far IS the '53 shell — when
  // the real '56 mod model loads, these are what it replaces
  const extStatic = bodyG.children.slice();
  const wheels = [];
  const tireM = stdPlain(0x1a1a1c, 0.9), wallM = stdPlain(0xf0ead8, 0.6);
  for (const [wx, wz] of [[-0.84, 1.45], [0.84, 1.45], [-0.84, -1.45], [0.84, -1.45]]) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 20), tireM);
    tire.rotation.z = Math.PI / 2; wg.add(tire);
    const ww = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.205, 20), wallM);
    ww.rotation.z = Math.PI / 2; wg.add(ww);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.215, 14), chrome);
    hub.rotation.z = Math.PI / 2; wg.add(hub);
    wg.position.set(wx, 0.35, wz);
    wg.rotation.order = "YXZ"; // steer (y) first, then roll (x)
    g.add(wg); wheels.push(wg);
  }
  g.userData.wheels = wheels;
  // ---- the cockpit: dash, live gauges, wheel, bench seat
  const interior = new THREE.Group();
  const dashM = new THREE.MeshStandardMaterial({ color: 0x24555c, roughness: 0.5, metalness: 0.2 });
  interior.add(box(1.62, 0.3, 0.34, dashM, 0, 0.99, 0.80));
  interior.add(box(1.62, 0.1, 0.5, dashM, 0, 0.82, 0.72));
  const gaugeC = document.createElement("canvas");
  gaugeC.width = 512; gaugeC.height = 144;
  const gaugeT = new THREE.CanvasTexture(gaugeC);
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.26),
    new THREE.MeshBasicMaterial({ map: gaugeT }));
  gauge.position.set(-0.28, 1.04, 0.624); gauge.rotation.y = Math.PI;
  interior.add(gauge);
  const wheelG = new THREE.Group();
  wheelG.position.set(-0.42, 0.96, 0.58); wheelG.rotation.x = -0.42;
  wheelG.add(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 10, 28), stdPlain(0x3a2e24, 0.4)));
  wheelG.add(box(0.4, 0.035, 0.02, stdPlain(0x3a2e24, 0.4), 0, 0, 0));
  wheelG.add(box(0.035, 0.4, 0.02, stdPlain(0x3a2e24, 0.4), 0, 0, 0));
  const hubB = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), chrome);
  hubB.rotation.x = Math.PI / 2; wheelG.add(hubB);
  interior.add(wheelG);
  interior.add(limb(new THREE.Vector3(-0.42, 0.92, 0.60), new THREE.Vector3(-0.42, 0.88, 0.84), 0.025, stdPlain(0x2a2a2c, 0.5)));
  const vinyl = new THREE.MeshStandardMaterial({ color: 0xa03a44, roughness: 0.65 });
  const seatCushion = box(1.5, 0.16, 0.6, vinyl, 0, 0.60, -0.30);
  interior.add(seatCushion);
  const backrest = box(1.5, 0.58, 0.15, vinyl, 0, 0.90, -0.62); backrest.rotation.x = 0.12; interior.add(backrest);
  interior.add(box(0.5, 0.16, 0.03, stdPlain(0x2a2a2c, 0.4), 0, 1.40, 0.86));
  interior.add(box(0.44, 0.11, 0.01, new THREE.MeshStandardMaterial({ color: 0x8aa4b4, roughness: 0.05, metalness: 0.8 }), 0, 1.40, 0.845));
  interior.visible = false;
  bodyG.add(interior);
  g.userData.interior = interior;
  g.userData.gaugeCanvas = gaugeC;
  g.userData.gaugeTex = gaugeT;
  g.userData.steerWheel = wheelG;

  // ---- animated features: doors, hood + engine, signals,
  // wipers, gear lever, headlight beams
  const doorGeo = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.90, 0, 0.82);
    pivot.add(box(0.045, 0.60, 1.30, paint, 0, 0.86, -0.70));
    pivot.add(box(0.04, 0.30, 1.12, glass, 0, 1.30, -0.68));
    pivot.add(box(0.03, 0.05, 0.22, chrome, side * 0.035, 0.92, -1.18));
    bodyG.add(pivot);
    return pivot;
  };
  const doorL = doorGeo(-1), doorR = doorGeo(1);
  const engineBay = new THREE.Group();
  engineBay.add(box(1.0, 0.34, 1.05, stdPlain(0x2c3438, 0.7), 0, 0.94, 1.55));
  engineBay.add(box(0.52, 0.12, 0.92, stdPlain(0x1f4a50, 0.5), 0, 1.08, 1.55));
  const cleaner = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 16), stdPlain(0x17181a, 0.5));
  cleaner.position.set(0.12, 1.05, 1.48); engineBay.add(cleaner);
  engineBay.add(box(1.3, 0.5, 0.08, stdPlain(0x3a4046, 0.6), 0, 0.82, 2.18));
  bodyG.add(engineBay);
  const hood = new THREE.Group();
  hood.position.set(0, 0.98, 0.92);
  hood.add(box(1.66, 0.22, 1.38, paint, 0, -0.01, 0.71));
  bodyG.add(hood);
  const lever = new THREE.Group();
  lever.position.set(-0.40, 1.04, 0.64);
  const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), stdPlain(0x2a2a2c, 0.4));
  leverArm.position.y = 0.1; lever.add(leverArm);
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), cream);
  leverKnob.position.y = 0.22; lever.add(leverKnob);
  lever.rotation.x = -0.5;
  interior.add(lever);
  const sigMatL = new THREE.MeshStandardMaterial({ color: 0xd88f2a, emissive: 0xff9a1e, emissiveIntensity: 0.1 });
  const sigMatR = sigMatL.clone();
  const sigGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const sigMeshes = [];
  for (const [sx, zz, mm] of [[-0.80, 2.28, sigMatL], [0.80, 2.28, sigMatR], [-0.80, -2.30, sigMatL], [0.80, -2.30, sigMatR]]) {
    const s = new THREE.Mesh(sigGeo, mm);
    s.position.set(sx, 0.74, zz); bodyG.add(s); sigMeshes.push(s);
  }
  g.userData.sigMeshes = sigMeshes;
  const wiperGeo = (sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.235, 0.925);
    pivot.add(box(0.025, 0.36, 0.015, stdPlain(0x1c1c1e, 0.5), 0, 0.17, 0.01));
    bodyG.add(pivot);
    return pivot;
  };
  const wiperL = wiperGeo(-0.36), wiperR = wiperGeo(0.36);
  const beamM = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beams = [];
  for (const sx of [-0.63, 0.63]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.4, 12, 1, true), beamM);
    cone.rotation.x = Math.PI / 2 + Math.PI; // open cone spilling forward
    cone.position.set(sx, 0.88, 2.3 + 1.7);
    bodyG.add(cone); beams.push(cone);
  }
  const spot = new THREE.SpotLight(0xffe9b8, 0, 11, 0.55, 0.55, 0.6);
  spot.position.set(0, 0.9, 2.3);
  const spotTgt = new THREE.Object3D(); spotTgt.position.set(0, 0.2, 12);
  bodyG.add(spotTgt); spot.target = spotTgt; bodyG.add(spot);
  g.userData.bodyG = bodyG;
  g.userData.extStatic = extStatic;
  g.userData.engineBay = engineBay;
  g.userData.seatMeshes = [seatCushion, backrest];
  g.userData.doorL = doorL; g.userData.doorR = doorR;
  g.userData.hood = hood;
  g.userData.lever = lever;
  g.userData.sigMatL = sigMatL; g.userData.sigMatR = sigMatR;
  g.userData.wiperL = wiperL; g.userData.wiperR = wiperR;
  g.userData.lampM = lampM;
  g.userData.beams = beams; g.userData.beamM = beamM; g.userData.spot = spot;
  g.userData.tailpipe = new THREE.Vector3(0.55, 0.26, -2.45);
  bodyG.traverse(o => { if (o.isMesh) o.castShadow = true; });
  bodyG.traverse(o => { if (o.isMesh && (o.material === glass || o.material === beamM)) o.castShadow = false; }); // glass and light beams cast nothing
  for (const w of wheels) w.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// ---- the real '56 Bel Air (BeamNG mod model, bone-stock) ----
// A launcher pack: when it lands, it replaces the procedural
// '53 shell piece for piece, and the same Drive state animates
// its doors, hood, steering wheel and lamps. Pack missing or
// switched off -> the '53 simply stays.
function loadBelAirShell(car) {
  let packs = {};
  try { packs = JSON.parse(localStorage.getItem("awpc_packs") || "{}"); } catch (e) { }
  if (packs["car-belair"] === false || !THREE.GLTFLoader) return;
  new THREE.GLTFLoader().load("packs/cars/belair56/model.glb", (gltf) => {
    const shell = gltf.scene;
    // the file's driver sits at +x; ours sits at -x. Mirror the
    // shell across x (three flips its winding for us) and its
    // own L/R names land on our sides.
    shell.scale.set(-0.96, 0.96, 0.96);
    shell.position.y = -0.08;
    const U = car.userData;
    U.bodyG.add(shell);
    const byName = {};
    shell.traverse(o => { if (o.name) byName[o.name] = o; });
    U.shDoorDriver = byName["door_L"] || null;
    U.shDoorPass = byName["door_R"] || null;
    U.shHood = byName["hood"] || null;
    U.shSteer = byName["steering"] || null;
    U.shSteerSign = -1; // the mirror flips the wheel's spin too
    Drive.shDoorSign = -1; // ...and the door's swing
    const sigD = byName["signal_L"], sigP = byName["signal_R"];
    const tailD = byName["taillight_L"], tailP = byName["taillight_R"];
    const matsOf = (node, frag) => {
      const out = [];
      if (node) node.traverse(o => {
        if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          if (m && m.name && m.name.includes(frag) && !out.includes(m)) out.push(m);
        });
      });
      return out;
    };
    U.shMats = {
      sigDriver: matsOf(sigD, "signal"), sigPass: matsOf(sigP, "signal"),
      tail: [...matsOf(tailD, "taillight"), ...matsOf(tailP, "taillight"), ...matsOf(tailD, "reverse"), ...matsOf(tailP, "reverse")],
      head: [...matsOf(byName["headlight_L"], "lights"), ...matsOf(byName["headlight_R"], "lights")]
    };
    U.shMats.sigDriver.forEach(m => m.emissive = new THREE.Color(0xff9a1e));
    U.shMats.sigPass.forEach(m => m.emissive = new THREE.Color(0xff9a1e));
    U.shMats.tail.forEach(m => m.emissive = new THREE.Color(0xff2a1a));
    U.shMats.head.forEach(m => m.emissive = new THREE.Color(0xffeebb));
    // glass must be glass: see-through, casts no shadow
    shell.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const isGlass = ms.some(m => m && m.name && m.name.includes("glass"));
      o.castShadow = !isGlass;
      if (isGlass) ms.forEach(m => { if (m.name.includes("glass")) { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; } });
    });
    // the '53 shell steps aside
    for (const m of U.extStatic || []) m.visible = false;
    if (U.engineBay) U.engineBay.visible = false;
    if (U.doorL) U.doorL.visible = false;
    if (U.doorR) U.doorR.visible = false;
    if (U.hood) U.hood.visible = false;
    for (const s of U.sigMeshes || []) s.visible = false;
    for (const s of U.seatMeshes || []) s.visible = false;
    if (U.steerWheel) U.steerWheel.visible = false;
    if (U.beams) U.beams.forEach(b => { b.position.z = 4.15; b.position.x = Math.sign(b.position.x) * 0.72; });
    if (U.spot) U.spot.position.set(0, 0.95, 2.45);
    U.shell = shell;
    Drive.shellOn = true;
  }, undefined, () => { /* pack not installed — the '53 stays */ });
}
// ---- the Satsuma E10 (BeamNG port of the My Summer Car
// Datsun, bone-stock) — a launcher pack; parks at the gas
// station when installed, a neighbour's pride and joy.
function loadSatsumaParked(T) {
  let packs = {};
  try { packs = JSON.parse(localStorage.getItem("awpc_packs") || "{}"); } catch (e) { }
  if (packs["car-satsuma"] === false || !THREE.GLTFLoader) return;
  new THREE.GLTFLoader().load("packs/cars/satsuma/model.glb", (gltf) => {
    const car = gltf.scene;
    const wheel = car.getObjectByName("wheel");
    if (wheel) {
      wheel.visible = false; // the centred spare becomes four corners below
      for (const [wx, wz] of [[-0.60, 1.06], [0.60, 1.06], [-0.60, -1.06], [0.60, -1.06]]) {
        const w = wheel.clone();
        w.visible = true;
        w.position.set(wx, 0.27, wz);
        if (wx > 0) w.rotation.y = Math.PI;
        car.add(w);
      }
    }
    car.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      const isGlass = ms.some(m => m && m.name && m.name.includes("glass"));
      o.castShadow = !isGlass;
      if (isGlass) ms.forEach(m => { if (m.name.includes("glass")) { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; } });
    });
    car.position.set(-21.5, 0.02, 29.0);
    car.rotation.y = -0.35;
    (homeRefs.townG || T).add(car);
    homeRefs.satsuma = car;
    Drive.satsumaOn = true;
  }, undefined, () => { /* pack not installed */ });
}
function makeTrafficCar(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2a30, roughness: 0.15, metalness: 0.4 });
  g.add(box(1.7, 0.5, 4.2, paint, 0, 0.58, 0));
  g.add(box(1.54, 0.44, 2.0, glass, 0, 1.04, -0.1));
  g.add(box(1.6, 0.06, 2.1, paint, 0, 1.29, -0.1));
  const brakeM = new THREE.MeshStandardMaterial({ color: 0x8a1610, emissive: 0xd42313, emissiveIntensity: 0.15 });
  g.add(box(0.22, 0.09, 0.05, brakeM, -0.6, 0.68, -2.11));
  g.add(box(0.22, 0.09, 0.05, brakeM, 0.6, 0.68, -2.11));
  const wheels = [];
  const tireM = stdPlain(0x1a1a1c, 0.9);
  for (const [wx, wz] of [[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 14), tireM);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.32, wz);
    g.add(w); wheels.push(w);
  }
  g.userData = { wheels, brakeM, s: 0, speed: 0 };
  return g;
}
function makePerson3D(dressC, skinC) {
  const g = new THREE.Group();
  const dressM = stdPlain(dressC, 0.85), skinM = stdPlain(skinC, 0.6);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.31, 0.78, 12), dressM);
  skirt.position.y = 0.39; g.add(skirt);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.46, 12), dressM);
  torso.position.y = 0.99; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), skinM);
  head.position.y = 1.40; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), stdPlain(0x5e3d22, 0.8));
  hair.scale.set(1, 0.72, 1); hair.position.y = 1.47; g.add(hair);
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.21, 1.16, 0);
    const arm = box(0.07, 0.52, 0.07, skinM, 0, -0.22, 0);
    pivot.add(arm); g.add(pivot); arms.push(pivot);
  }
  g.userData.arms = arms;
  return g;
}
// ---- her needs (v0.6.0, the My Summer Car layer): she gets
// hungry, thirsty, tired and uncomfortable, and Charles City
// feeds her — the Grocer's stocks her fridge, Doyle's cooks,
// Betty's rolls are comfort on a plate, and home has the
// fridge and the sofa. The baby feels it too (see bpmScale).
const Needs = Object.assign({ hunger: 82, thirst: 78, rest: 85, comfort: 80, stock: 1 }, prefs.get("mom_needs", {}));
let needsSaveT = 0, needsUiT = 0;
const needWarned = {};
function needsWorst() { return Math.min(Needs.hunger, Needs.thirst, Needs.rest, Needs.comfort); }
function needSpeed() { const w = needsWorst(); return w < 12 ? 0.62 : w < 25 ? 0.8 : 1; }
function saveNeeds() { prefs.set("mom_needs", Needs); }
function addNeed(k, d) { Needs[k] = clamp(Needs[k] + d, 0, 100); }
const ERRANDS = [
  { id: "grocer", x: -6.8, z: 31.0, r: 2.9, prompt: "🛒 <b>E</b> — buy groceries at The Grocer's", run() { Needs.stock = Math.min(6, Needs.stock + 3); addNeed("thirst", 18); showHomeMessage("🛒 Groceries bagged — 3 meals for the fridge, and a cold soda for the walk home.", 3200); saveNeeds(); } },
  { id: "diner", x: 7.6, z: 31.0, r: 2.9, prompt: "🍽 <b>E</b> — a hot meal at Doyle's Diner", run() { addNeed("hunger", 65); addNeed("thirst", 25); addNeed("comfort", 12); showHomeMessage("🍽 Meatloaf, mashed potatoes and sweet tea. Doyle waves from the grill.", 3200); saveNeeds(); } },
  { id: "bakery", x: -14, z: 31.0, r: 2.9, prompt: "🥐 <b>E</b> — fresh rolls at Betty's Bakery", run() { addNeed("hunger", 28); addNeed("comfort", 16); showHomeMessage("🥐 Warm rolls, still steaming. Betty won't take a cent — 'for the baby,' she says.", 3200); saveNeeds(); } }
];
function errandHere() {
  const mom = homeRefs.mom;
  if (!mom || Drive.active) return null;
  const p = mom.position;
  if (homeRefs.town) for (const e of ERRANDS) if (Math.hypot(p.x - e.x, p.z - e.z) < e.r) return e;
  const inHouse = homeRefs.town
    ? (Math.abs(p.x) < 5.4 && Math.abs(p.z) < 3.9)
    : (Math.abs(p.x) <= 5.0 && Math.abs(p.z) <= 3.5);
  if (inHouse) {
    if (homeRefs.town && Math.hypot(p.x + 3.7, p.z + 1.3) < 1.9)
      return { id: "nap", prompt: "😴 <b>E</b> — nap on the sofa", run() { runBlink(() => { addNeed("rest", 55); addNeed("hunger", -6); addNeed("thirst", -8); showHomeMessage("😴 She dreams of a small face. The house is quiet and kind.", 3000); saveNeeds(); }, "😴 A little nap…"); } };
    return { id: "fridge", prompt: Needs.stock > 0 ? "🍽 <b>E</b> — eat from the fridge (" + Needs.stock + " meal" + (Needs.stock > 1 ? "s" : "") + " left)" : "🧺 The fridge is empty — The Grocer's on Main Street can fix that", run() { if (Needs.stock > 0) { Needs.stock--; addNeed("hunger", 42); addNeed("thirst", 10); showHomeMessage("🍽 A proper meal from her own fridge. The baby approves — feel that kick?", 3000); saveNeeds(); } else showHomeMessage("🧺 Bare shelves, hon. Groceries are at The Grocer's, two blocks over.", 2600); } };
  }
  return null;
}
function doErrand() {
  const e = errandHere(); if (e) { e.run(); return; }
  const mom = homeRefs.mom; if (!mom || Drive.active) return;
  const px = mom.position.x, pz = mom.position.z;
  if (homeRefs.town && Math.hypot(px - 0.4, pz - 31.0) < 2.9) { openPartsCard(); return; }
  if (Math.hypot(px - 7.4, pz - 12.6) < 2.2 && mailReady()) collectMail();
}
function needsTick(dt) {
  const card = document.getElementById("needsCard");
  if (view !== "home") { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  Needs.hunger = clamp(Needs.hunger - dt * 0.0092, 0, 100);
  Needs.thirst = clamp(Needs.thirst - dt * 0.0133, 0, 100);
  Needs.rest = clamp(Needs.rest - dt * 0.0075, 0, 100);
  Needs.comfort = clamp(Needs.comfort - dt * 0.005, 0, 100);
  needsSaveT += dt; if (needsSaveT > 10) { needsSaveT = 0; saveNeeds(); }
  for (const [k, label] of [["hunger", "🍞 She's hungry — food would help."], ["thirst", "🥤 She's thirsty — something to drink."], ["rest", "😴 She's worn out — a nap would do her good."], ["comfort", "🛋 She's uncomfortable — something cosy, or Betty's rolls."]]) {
    if (Needs[k] < 22 && !needWarned[k]) { needWarned[k] = true; showHomeMessage(label, 2600); }
    if (Needs[k] > 34) needWarned[k] = false;
  }
  needsUiT += dt;
  if (needsUiT > 0.3) {
    needsUiT = 0;
    const e = errandHere();
    const pr = document.getElementById("needPrompt");
    if (e) { pr.innerHTML = e.prompt; pr.classList.remove("hidden"); } else pr.classList.add("hidden");
    for (const [k, id] of [["hunger", "nbHunger"], ["thirst", "nbThirst"], ["rest", "nbRest"], ["comfort", "nbComfort"]]) {
      const bar = document.getElementById(id);
      bar.style.width = Needs[k].toFixed(0) + "%";
      bar.style.background = Needs[k] < 22 ? "#d95f4b" : Needs[k] < 45 ? "#e0a83e" : "#7dc95f";
    }
    document.getElementById("nbStock").textContent = Needs.stock;
  }
}
// ---- car parts by mail (v0.7.0, the My Summer Car layer,
// part 2): parts wear out; the station only services them.
// Real fixes are components — ordered at the Post Office,
// delivered to her home mailbox (watch the red flag), and
// fitted at the car with the wrench key (R), hood up.
const PARTS = [
  { id: "battery", icon: "🔋", name: "Battery", fixes: "bat", blurb: "cranks strong again" },
  { id: "plugs", icon: "🔌", name: "Spark plugs · set of 6", fixes: "plugs", blurb: "smooth idle, easy starts" },
  { id: "brakes", icon: "🛑", name: "Brake shoes · set", fixes: "brk", blurb: "stops straight and short" },
  { id: "tires", icon: "🛞", name: "Whitewall tires · set of 4", fixes: "tir", blurb: "grip in the corners" },
  { id: "generator", icon: "⚡", name: "Rebuilt generator", fixes: "gen", blurb: "charges like new" },
  { id: "enginekit", icon: "🔩", name: "Engine rebuild kit", fixes: "eng", blurb: "rings, gaskets, bearings" },
  { id: "gearbox", icon: "⚙️", name: "Powerglide rebuild kit", fixes: "trn", blurb: "shifts without the bang" }
];
const Parts = Object.assign({ shelf: {}, mail: {}, notified: {} }, prefs.get("belair_parts", {}));
Parts.installing = null;
const MAIL_MS = 120000; // the mail takes a couple of minutes
function saveParts() { prefs.set("belair_parts", { shelf: Parts.shelf, mail: Parts.mail, notified: Parts.notified }); }
function partById(id) { return PARTS.find(p => p.id === id); }
function mailDue(id) { return Parts.mail[id] != null && Date.now() >= Parts.mail[id]; }
function mailReady() { return PARTS.some(p => mailDue(p.id)); }
function partsShelfLine() {
  const bits = PARTS.filter(p => Parts.shelf[p.id] > 0).map(p => p.icon + "×" + Parts.shelf[p.id]);
  const inMail = PARTS.filter(p => Parts.mail[p.id]).map(p => p.icon);
  return "Parts shelf: " + (bits.length ? bits.join(" ") : "empty") + (inMail.length ? " · 📮 in the mail: " + inMail.join(" ") : "") + " — order at the Post Office";
}
function orderPart(id) {
  const p = partById(id); if (!p || Parts.mail[id]) return;
  Parts.mail[id] = Date.now() + MAIL_MS;
  Parts.notified[id] = false;
  saveParts(); refreshPartsCard();
  showHomeMessage("📬 Ordered: " + p.name + ". The mail runs slow — watch the home mailbox flag.", 3400);
}
function collectMail() {
  let got = 0;
  for (const p of PARTS) if (mailDue(p.id)) {
    delete Parts.mail[p.id]; delete Parts.notified[p.id];
    Parts.shelf[p.id] = (Parts.shelf[p.id] || 0) + 1; got++;
  }
  if (got) { saveParts(); showHomeMessage("📦 Parcel" + (got > 1 ? "s" : "") + " on the parts shelf. Fit " + (got > 1 ? "them" : "it") + " at the car — hood up, press R.", 3400); }
  return got;
}
function bestInstall() {
  let best = null;
  for (const p of PARTS) if ((Parts.shelf[p.id] || 0) > 0) {
    const w = Drive.wear[p.fixes] ?? 1;
    if (w < 0.985 && (!best || w < best.w)) best = { p, w };
  }
  return best;
}
function startInstall() {
  if (Drive.active || Parts.installing) return;
  const car = homeRefs.belAir, mom = homeRefs.mom;
  if (!car || !mom) return;
  if (Math.hypot(mom.position.x - car.position.x, mom.position.z - car.position.z) > 3.6) return;
  const b = bestInstall();
  if (!b) { showHomeMessage("🔧 Nothing on the shelf needs fitting — she's running sweet, or the shelf is bare. Parts live at the Post Office.", 2600); return; }
  Parts.installing = { id: b.p.id, t: 0 };
  Drive.hoodOpen = true;
  showHomeMessage("🔧 Fitting the " + b.p.name.toLowerCase() + "… hold still, hon.", 1800);
}
function refreshPartsCard() {
  const rows = document.getElementById("partsRows");
  if (!rows) return;
  rows.innerHTML = "";
  for (const p of PARTS) {
    const row = document.createElement("div"); row.className = "partRow";
    const w = Math.round((Drive.wear[p.fixes] ?? 1) * 100);
    const inMail = !!Parts.mail[p.id], onShelf = Parts.shelf[p.id] || 0;
    row.innerHTML = "<span class='pName'>" + p.icon + " " + p.name + "</span>" +
      "<span class='pState'>" + (inMail ? "📮 in the mail…" : onShelf ? "on your shelf ×" + onShelf : p.blurb) + " · now " + w + "%</span>";
    const btn = document.createElement("button");
    btn.textContent = inMail ? "Ordered" : "Order";
    btn.disabled = inMail;
    btn.addEventListener("click", () => orderPart(p.id));
    row.appendChild(btn);
    rows.appendChild(row);
  }
}
function openPartsCard() { refreshPartsCard(); document.getElementById("partsCard").classList.remove("hidden"); }
function closePartsCard() { document.getElementById("partsCard").classList.add("hidden"); }
let partsUiT = 0;
function partsTick(dt) {
  // parcel arrivals raise the flag and say so, once each
  for (const p of PARTS) if (mailDue(p.id) && !Parts.notified[p.id]) {
    Parts.notified[p.id] = true; saveParts();
    if (view === "home") showHomeMessage("📬 The mail's come — a parcel's waiting at home, flag's up.", 3200);
  }
  if (homeRefs.mailFlag) {
    const target = mailReady() ? -0.15 : 1.25;
    homeRefs.mailFlag.rotation.z += (target - homeRefs.mailFlag.rotation.z) * Math.min(1, dt * 5);
  }
  if (homeRefs.grokMailbox) homeRefs.grokMailbox.userData.setFlag(mailReady());
  const mom = homeRefs.mom, car = homeRefs.belAir;
  // an install in progress: she must stay by the car
  if (Parts.installing) {
    const p = partById(Parts.installing.id);
    const near = mom && car && Math.hypot(mom.position.x - car.position.x, mom.position.z - car.position.z) < 4.2 && !Drive.active;
    if (!near) { Parts.installing = null; Drive.hoodOpen = false; showHomeMessage("🔧 She steps away — the " + p.name.toLowerCase() + " will keep.", 2000); }
    else {
      Parts.installing.t += dt;
      if (Parts.installing.t >= 2.5) {
        Drive.wear[p.fixes] = 1;
        Parts.shelf[p.id]--;
        Parts.installing = null;
        Drive.hoodOpen = false;
        saveCarPrefs(); saveParts();
        showHomeMessage("🔧 New " + p.name.toLowerCase() + " fitted — " + p.blurb + ".", 3000);
      }
    }
  }
  partsUiT += dt;
  if (partsUiT > 0.3) {
    partsUiT = 0;
    const pr = document.getElementById("partPrompt");
    let html = "";
    if (view === "home" && mom && !Drive.active) {
      const px = mom.position.x, pz = mom.position.z;
      if (Parts.installing) html = "🔧 Fitting the " + partById(Parts.installing.id).name.toLowerCase() + "… " + Math.round(Parts.installing.t / 2.5 * 100) + "%";
      else if (homeRefs.town && Math.hypot(px - 0.4, pz - 31.0) < 2.9) html = "📬 <b>E</b> — order car parts by mail";
      else if (Math.hypot(px - 7.4, pz - 12.6) < 2.2) html = mailReady() ? "📬 <b>E</b> — collect your parcel" : (PARTS.some(p => Parts.mail[p.id]) ? "📬 Parts in the mail — due soon" : "");
      else if (car && Math.hypot(px - car.position.x, pz - car.position.z) < 3.6) { const b = bestInstall(); if (b) html = "🔧 <b>R</b> — fit the " + b.p.name.toLowerCase() + " from the shelf (" + Math.round(b.w * 100) + "% now)"; }
      // the order card closes itself when she walks away
      const card = document.getElementById("partsCard");
      if (card && !card.classList.contains("hidden") && !(homeRefs.town && Math.hypot(px - 0.4, pz - 31.0) < 4.5)) closePartsCard();
    }
    if (html) { pr.innerHTML = html; pr.classList.remove("hidden"); } else pr.classList.add("hidden");
  }
}
{ const pc = document.getElementById("partsClose"); if (pc) pc.addEventListener("click", closePartsCard); }
// ---- zones, KH1-style: her lot is one zone, the town is
// another. Only the zone she stands in is loaded (rendered +
// solid); crossing the property line runs the Blink and the
// other side loads in around her. Same coordinates both
// sides — the world is continuous, the loading is not.
const Zone = { active: "lot", busy: false };
const LOT = { x0: -8.6, x1: 8.6, z0: -16.6, z1: 13.2 };
function inLot(x, z, pad = 0) { return x > LOT.x0 - pad && x < LOT.x1 + pad && z > LOT.z0 - pad && z < LOT.z1 + pad; }
function solidLive(s) { return !s.zone || s.zone === "both" || s.zone === Zone.active; }
let blinkEl = null, blinkCap = null;
function ensureBlink() {
  if (blinkEl) return;
  blinkEl = document.createElement("div");
  blinkEl.style.cssText = "position:fixed;inset:0;background:#06080c;opacity:0;pointer-events:none;transition:opacity .26s ease;z-index:80;display:flex;align-items:center;justify-content:center;";
  blinkCap = document.createElement("div");
  blinkCap.style.cssText = "color:#f5e0ac;font-size:34px;font-family:Georgia,serif;letter-spacing:.04em;opacity:0;transition:opacity .2s ease;";
  blinkEl.appendChild(blinkCap);
  document.body.appendChild(blinkEl);
}
function runBlink(midFn, caption) {
  ensureBlink();
  blinkCap.textContent = caption || "";
  blinkCap.style.opacity = caption ? "1" : "0";
  blinkEl.style.opacity = "1";
  setTimeout(() => {
    if (midFn) midFn();
    setTimeout(() => { blinkEl.style.opacity = "0"; blinkCap.style.opacity = "0"; }, 170);
  }, 300);
}
function applyZone() {
  if (homeRefs.lotG) homeRefs.lotG.visible = Zone.active === "lot";
  if (homeRefs.townG) homeRefs.townG.visible = Zone.active === "town";
}
function partitionTown(T) {
  const lotG = new THREE.Group(), townG = new THREE.Group();
  homeScene.add(lotG); homeScene.add(townG);
  homeRefs.lotG = lotG; homeRefs.townG = townG;
  const box = new THREE.Box3(), c = new THREE.Vector3(), size = new THREE.Vector3();
  for (const child of [...T.children]) {
    if (child === homeRefs.belAir) continue; // her car crosses with her
    if (homeRefs.traffic && homeRefs.traffic.includes(child)) { townG.add(child); continue; }
    box.setFromObject(child);
    if (box.isEmpty()) continue;
    box.getCenter(c); box.getSize(size);
    const spans = size.x > (LOT.x1 - LOT.x0) + 2 || size.z > (LOT.z1 - LOT.z0) + 2;
    if (spans) continue; // ground, streets, river: live in both zones
    (inLot(c.x, c.z) ? lotG : townG).add(child);
  }
  for (const s of homeRefs.solids)
    s.zone = s === homeRefs.belAirSolid ? "both" : (inLot((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2) ? "lot" : "town");
  applyZone();
}
function zoneTick() {
  if (!homeRefs.townG || Zone.busy) return;
  const subj = Drive.active && homeRefs.belAir ? homeRefs.belAir.position : (homeRefs.mom ? homeRefs.mom.position : null);
  if (!subj) return;
  const inside = inLot(subj.x, subj.z, Zone.active === "lot" ? 0.35 : -0.35);
  const want = inside ? "lot" : "town";
  if (want !== Zone.active) {
    Zone.busy = true;
    runBlink(() => { Zone.active = want; applyZone(); }, want === "town" ? "🍂 Charles City" : "🏠 Home");
    setTimeout(() => { Zone.busy = false; }, 850);
  }
}
// ---- Grok's content (content lane), wired in: town dressing props.
// Every builder self-animates via userData.tick(t, dt); the town tick
// drives them all. Placements keep the traffic lanes clear: lamps,
// benches and the phone booth hug the storefront sidewalk (z ~31+).
function addContentProps(T, solid) {
  if (typeof buildFireHydrant !== "function") return; // content file absent
  const tickers = homeRefs.contentTickers = homeRefs.contentTickers || [];
  const add = (g, x, z, ry, sb) => {
    g.position.set(x, 0, z); if (ry) g.rotation.y = ry;
    g.traverse(o => { o.castShadow = true; });
    T.add(g);
    if (g.userData && g.userData.tick) tickers.push(g);
    if (sb) solid(sb[0], sb[1], sb[2], sb[3]);
    return g;
  };
  if (homeRefs.grokMailbox && homeRefs.grokMailbox.userData.tick) tickers.push(homeRefs.grokMailbox);
  add(buildFireHydrant(), -22.5, 31.5, 0, [-22.7, -22.3, 31.3, 31.7]);
  add(buildParkBench(), -11, 31.3, Math.PI, [-11.9, -10.1, 31.0, 31.6]);
  add(buildParkBench(), 17.5, 31.3, Math.PI, [16.6, 18.4, 31.0, 31.6]);
  for (const lx of [-20, -10, 0, 10, 20]) add(buildStreetLamp(), lx, 31.6, 0);
  add(buildPhoneBooth(), 11.8, 31.2, Math.PI, [11.4, 12.2, 30.8, 31.6]);
}

function buildTown() {
  const T = new THREE.Group();
  homeScene.add(T);
  const solids = [];
  const solid = (x0, x1, z0, z1) => solids.push({ x0, x1, z0, z1 });
  // ---- her house, from the outside: siding, roof, porch
  const siding = new THREE.MeshStandardMaterial({ map: sidingTexture(), color: 0xf5e0ac, roughness: 0.9 }), trim = stdPlain(0xfaf8f2, 0.7);
  const shingle = new THREE.MeshStandardMaterial({ map: shingleTexture(), color: 0xa06850, roughness: 1 });
  const sid = (x0, x1, y0, y1, z) => { const b = box(x1 - x0, y1 - y0, 0.12, siding, (x0 + x1) / 2, (y0 + y1) / 2, z); b.castShadow = true; b.receiveShadow = true; T.add(b); };
  sid(-5.65, 0.7, 0, 3.4, 4.08); sid(1.7, 5.65, 0, 3.4, 4.08); sid(0.7, 1.7, 2.15, 3.4, 4.08);
  sid(-5.65, -3.4, 0, 3.4, -4.08); sid(-2.4, 1.6, 0, 3.4, -4.08); sid(4.8, 5.65, 0, 3.4, -4.08);
  sid(1.6, 4.8, 0, 1.05, -4.08); sid(1.6, 4.8, 2.75, 3.4, -4.08); sid(-3.4, -2.4, 2.15, 3.4, -4.08);
  T.add(box(0.12, 3.4, 8.3, siding, -5.62, 1.7, 0));
  T.add(box(0.12, 3.4, 8.3, siding, 5.62, 1.7, 0));
  const roof = prismRoof(12.7, 2.3, 9.7, shingle);
  roof.position.y = 3.38; roof.castShadow = true; roof.receiveShadow = true; T.add(roof);
  for (const gz of [-4.16, 4.16]) {
    const tri = new THREE.Shape();
    tri.moveTo(-5.65, 0); tri.lineTo(5.65, 0); tri.lineTo(0, 2.05); tri.closePath();
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: 0xf5e0ac, roughness: 0.9, side: THREE.DoubleSide }));
    gm.position.set(0, 3.4, gz); T.add(gm);
  }
  T.add(box(0.55, 1.5, 0.55, stdPlain(0x9c5f4a, 0.95), 2.8, 4.9, -1.5)); // chimney
  T.add(box(3.2, 0.16, 1.7, stdPlain(0xcfc8bc, 0.95), 1.2, 0.08, 4.95)); // porch slab
  T.add(box(1.4, 0.09, 0.5, stdPlain(0xcfc8bc, 0.95), 1.2, 0.045, 5.95)); // step
  for (const px of [0.0, 2.9]) T.add(box(0.11, 2.3, 0.11, trim, px, 1.15, 5.62));
  const proof = box(3.4, 0.08, 1.9, shingle, 1.2, 2.42, 4.95); proof.rotation.x = 0.1; T.add(proof);
  for (const bx of [-3.2, 3.6]) { // front bushes
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshStandardMaterial({ map: leafTexture(), roughness: 1 }));
    b.castShadow = true;
    b.scale.set(1.2, 0.7, 0.8); b.position.set(bx, 0.32, 4.6); T.add(b);
  }
  { // her mailbox, by the street — the red flag means a parcel.
    // Grok's builder (content lane) when the content file is loaded;
    // the plain box mailbox is the fallback.
    let mb = null;
    if (typeof buildMailbox === "function") { mb = buildMailbox(); homeRefs.grokMailbox = mb; }
    else {
      mb = new THREE.Group();
      mb.add(box(0.09, 1.02, 0.09, stdPlain(0x7a4a28, 0.85), 0, 0.51, 0));
      mb.add(box(0.58, 0.27, 0.30, stdPlain(0x3f5a74, 0.55), 0, 1.13, 0));
      const flagPivot = new THREE.Group(); flagPivot.position.set(0.31, 1.13, 0);
      flagPivot.add(box(0.03, 0.30, 0.02, stdPlain(0xc22e22, 0.5), 0, 0.13, 0));
      flagPivot.rotation.z = 1.25; // down: no mail
      mb.add(flagPivot);
      homeRefs.mailFlag = flagPivot;
    }
    mb.position.set(7.4, 0, 12.6); mb.rotation.y = -0.12;
    mb.traverse(o => { o.castShadow = true; });
    T.add(mb);
    solid(7.15, 7.65, 12.45, 12.75);
  }
  solid(-5.5, 0.55, 3.9, 4.1); solid(1.85, 5.5, 3.9, 4.1);       // front wall
  solid(-5.5, -3.55, -4.1, -3.9); solid(-2.25, 5.5, -4.1, -3.9); // back wall
  solid(-5.6, -5.4, -4, 4); solid(5.4, 5.6, -4, 4);              // side walls
  // ---- doors that actually open (front, back, garden gate)
  const doors = [];
  const mkDoor = (hx, hz, dir, w, h, mat, openAng) => {
    const pivot = new THREE.Group();
    pivot.position.set(hx, 0, hz);
    const panel = box(w, h, 0.055, mat, dir * w / 2, h / 2, 0);
    pivot.add(panel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), stdPlain(0xd8b25e, 0.35));
    knob.position.set(dir * (w - 0.12), h * 0.48, 0.07); pivot.add(knob);
    T.add(pivot);
    const d = { pivot, cx: hx + dir * w / 2, cz: hz, ang: 0, openAng };
    doors.push(d);
    return d;
  };
  const doorM = stdPlain(0x7a4a28, 0.75);
  mkDoor(0.7, 4.02, 1, 0.98, 2.12, doorM, -1.85);   // front door
  mkDoor(-2.4, -4.02, -1, 0.98, 2.12, doorM, -1.85); // back door
  // ---- the ground: grass, walks, driveway
  const grassTex = grassTexture(); grassTex.repeat.set(26, 22);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, 8); grass.receiveShadow = true; T.add(grass);
  const conc = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95 });
  const walk = (w, h, d, x, y, z) => { const b = box(w, h, d, conc, x, y, z); b.receiveShadow = true; T.add(b); };
  walk(1.4, 0.04, 7.6, 1.2, 0.0, 9.7);          // front walk
  walk(3.2, 0.04, 11.0, -3.8, 0.0, 9.6);       // driveway
  walk(110, 0.03, 1.5, 0, 0.0, 13.9);          // near sidewalk
  walk(110, 0.03, 1.5, 0, 0.0, 29.9);          // far sidewalk
  // ---- the street: a stadium loop around the block
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 1 });
  const road = (w, h, d, x, y, z) => { const b = box(w, h, d, asphalt, x, y, z); b.receiveShadow = true; T.add(b); };
  road(84, 0.03, 5.0, 0, -0.005, 17);
  road(84, 0.03, 5.0, 0, -0.005, 27);
  road(10, 0.03, 15.0, -36, -0.005, 22);
  road(10, 0.03, 15.0, 36, -0.005, 22);
  const dashC = document.createElement("canvas");
  dashC.width = 128; dashC.height = 16;
  const dg = dashC.getContext("2d");
  dg.fillStyle = "#f5f2e2"; dg.fillRect(8, 5, 62, 6);
  const dashT = new THREE.CanvasTexture(dashC);
  dashT.wrapS = THREE.RepeatWrapping; dashT.repeat.set(21, 1);
  const dashM = new THREE.MeshBasicMaterial({ map: dashT, transparent: true, depthWrite: false });
  for (const dz of [17, 27]) {
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(84, 0.5), dashM);
    dp.rotation.x = -Math.PI / 2; dp.position.set(0, 0.012, dz); T.add(dp);
  }
  // ---- backyard: picket fence with a gate, laundry, tree
  const fenceM = stdPlain(0xfaf8f2, 0.8);
  const pickC = document.createElement("canvas");
  pickC.width = 128; pickC.height = 128;
  const pg = pickC.getContext("2d");
  pg.clearRect(0, 0, 128, 128);
  pg.fillStyle = "#faf8f2";
  for (const px of [6, 70]) { // two pickets per tile, pointed tops
    pg.beginPath();
    pg.moveTo(px, 128); pg.lineTo(px, 22); pg.lineTo(px + 14, 2); pg.lineTo(px + 28, 22); pg.lineTo(px + 28, 128); pg.closePath(); pg.fill();
  }
  const pickT = new THREE.CanvasTexture(pickC);
  pickT.wrapS = THREE.RepeatWrapping;
  const pickets = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const t = pickT.clone(); t.needsUpdate = true; t.repeat.set(len / 1.1, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.95),
      new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
    m.position.set((x0 + x1) / 2, 0.475, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    T.add(m);
  };
  pickets(-8, -16, 2.95, -16); pickets(4.05, -16, 8, -16);
  pickets(-8, -16, -8, -4.1); pickets(8, -16, 8, -4.1);
  for (const [rx, rz, rw, rd] of [[-2.5, -16, 11, 0.05], [5.5, -16, 5, 0.05], [-8, -10, 0.05, 12], [8, -10, 0.05, 12]]) {
    T.add(box(rw === 0.05 ? 0.05 : rw, 0.07, rd === 0.05 ? 0.05 : rd, fenceM, rx, 0.68, rz));
    T.add(box(rw === 0.05 ? 0.05 : rw, 0.07, rd === 0.05 ? 0.05 : rd, fenceM, rx, 0.3, rz));
  }
  mkDoor(3.0, -16, 1, 0.98, 0.95, fenceM, 1.7); // garden gate
  solid(-8, 2.85, -16.1, -15.9); solid(4.15, 8, -16.1, -15.9);
  solid(-8.1, -7.9, -16, -4); solid(7.9, 8.1, -16, -4);
  const poleM = stdPlain(0x8a8f96, 0.6);
  for (const lx of [-5.5, -1.5]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), poleM);
    p.position.set(lx, 1.1, -12); T.add(p);
  }
  T.add(box(4.0, 0.02, 0.02, poleM, -3.5, 2.18, -12));
  const cloths = [];
  for (let i = 0; i < 3; i++) {
    const cg = new THREE.Group();
    cg.position.set(-4.9 + i * 1.0, 2.16, -12);
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0),
      new THREE.MeshStandardMaterial({ color: [0xffffff, 0xf2b8c6, 0xa8c8e8][i], roughness: 0.9, side: THREE.DoubleSide }));
    cm.position.y = -0.5; cg.add(cm); T.add(cg); cloths.push(cg);
  }
  // ---- trees (they sway), mailbox
  const sway = [];
  for (const [tx, tz, ts] of [[-7.5, 7, 1.1], [8.5, -10, 1.25], [13, 24.5, 1.15], [-15, 24.5, 1.0], [24, 8, 0.9]]) {
    const tr = makeTree3D(tx, tz, ts);
    T.add(tr); sway.push({ g: tr.userData.canopy, ph: tx * 1.7 });
    solid(tx - 0.35, tx + 0.35, tz - 0.35, tz + 0.35);
  }
  T.add(box(0.08, 0.95, 0.08, stdPlain(0x7a4a28, 0.8), 2.8, 0.47, 13.1));
  T.add(box(0.58, 0.27, 0.3, stdPlain(0x38618c, 0.6), 2.8, 1.05, 13.1));
  T.add(box(0.05, 0.22, 0.03, stdPlain(0xc23b2e, 0.6), 3.06, 1.2, 13.1));
  solid(2.5, 3.1, 12.9, 13.3);
  // ---- the neighbours
  const houses = [
    [-27, 12, Math.PI / 2, 0xe8dcc4, 0x9c5f43], [38, 8, -Math.PI / 2, 0xd8e4ec, 0x5a6a72],
    [25, 40, Math.PI, 0xf0d8d0, 0x7a4a52],
    [-15.5, 1, Math.PI / 2, 0xdce8d0, 0x6a7a52], [16.5, 0, -Math.PI / 2, 0xf5e6c8, 0x8a5a44]
  ];
  for (const [hx, hz, hry, wc, rc] of houses) {
    const h = makeHouse3D(7.5, 5.5, wc, rc);
    h.position.set(hx, 0, hz);
    h.rotation.y = hry;
    T.add(h);
    solid(hx - 3.9, hx + 3.9, hz - 3.9, hz + 3.9);
  }
  // ---- HER car: the 1953 Bel Air, parked on the driveway
  const bel = makeBelAir53();
  const savedBel = (prefs.get("belair_pos", "") || "").split(",").map(Number);
  if (savedBel.length === 3 && savedBel.every(isFinite)) {
    bel.position.set(savedBel[0], 0.02, savedBel[1]);
    bel.rotation.y = savedBel[2];
  } else {
    bel.position.set(-3.8, 0.02, 9.6);
  }
  T.add(bel);
  homeRefs.belAir = bel;
  const belSolid = { x0: -4.8, x1: -2.8, z0: 7.2, z1: 12.0 };
  solids.push(belSolid);
  homeRefs.belAirSolid = belSolid;
  updateBelAirSolid();
  loadBelAirShell(bel);
    loadSatsumaParked(T);
  // ---- traffic: two cars working the block loop
  const traffic = [];
  for (const [col, s0] of [[0xb84a39, 0], [0x4a6a9c, 77]]) {
    const c = makeTrafficCar(col);
    c.userData.s = s0;
    T.add(c); traffic.push(c);
  }
  for (const c of traffic) c.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const ST = { straight: 62, arc: Math.PI * 5 };
  const loopLen = 2 * ST.straight + 2 * ST.arc;
  const stadium = (s) => {
    s = ((s % loopLen) + loopLen) % loopLen;
    if (s < ST.straight) return { x: -31 + s, z: 17, hx: 1, hz: 0, arc: false };
    s -= ST.straight;
    if (s < ST.arc) {
      const a = -Math.PI / 2 + s / 5;
      return { x: 31 + Math.cos(a) * 5, z: 22 + Math.sin(a) * 5, hx: -Math.sin(a), hz: Math.cos(a), arc: true };
    }
    s -= ST.arc;
    if (s < ST.straight) return { x: 31 - s, z: 27, hx: -1, hz: 0, arc: false };
    s -= ST.straight;
    const a = Math.PI / 2 + s / 5;
    return { x: -31 + Math.cos(a) * 5, z: 22 + Math.sin(a) * 5, hx: -Math.sin(a), hz: Math.cos(a), arc: true };
  };
  // ---- neighbours out and about (they stroll, they wave)
  const people = [];
  const walker1 = makePerson3D(0xc25e7a, 0xf6c7a0);
  T.add(walker1); people.push({ g: walker1, kind: "walk", x: -18, z: 14.0, dir: 1, speed: 0.85, ph: 0 });
  const walker2 = makePerson3D(0x4a7a9c, 0xc68863);
  T.add(walker2); people.push({ g: walker2, kind: "walk", x: 20, z: 14.0, dir: -1, speed: 1.05, ph: 2 });
  const waver = makePerson3D(0x7a9c4a, 0xf6c7a0);
  waver.position.set(-13.2, 0, 13.6); waver.rotation.y = 0.5;
  T.add(waver); people.push({ g: waver, kind: "wave", ph: 1 });

  // ================= CHARLES CITY, IOWA =================
  // Isaiah's model town: a real small Iowa river town — Main
  // Street storefronts, the courthouse clock, the Charles
  // Theatre, a gas station for her Bel Air, the Cedar River
  // with a footbridge, the railroad and the co-op elevator,
  // and the water tower with the town's name on it.
  const extras = [];
  homeRefs.townExtras = extras;
  const labelSprite = (text) => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const g2 = c.getContext("2d");
    g2.fillStyle = "rgba(24,20,26,0.72)";
    g2.beginPath(); g2.roundRect(56, 8, 400, 74, 20); g2.fill();
    g2.fillStyle = "#ffe9c9"; g2.font = "bold 40px Georgia, serif";
    g2.textAlign = "center"; g2.textBaseline = "middle";
    g2.fillText(text, 256, 47);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.scale.set(1.9, 0.36, 1);
    return sp;
  };
  const signTexture = (text, sub, bg, fg) => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const g2 = c.getContext("2d");
    g2.fillStyle = bg; g2.fillRect(0, 0, 512, 128);
    g2.strokeStyle = fg; g2.lineWidth = 5; g2.strokeRect(8, 8, 496, 112);
    g2.fillStyle = fg; g2.textAlign = "center";
    g2.font = "bold 52px Georgia, serif";
    g2.fillText(text, 256, sub ? 58 : 68);
    if (sub) { g2.font = "italic 30px Georgia, serif"; g2.fillText(sub, 256, 102); }
    return new THREE.CanvasTexture(c);
  };
  const brickTexture = () => {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const g2 = c.getContext("2d");
    g2.fillStyle = "#cbb59a"; g2.fillRect(0, 0, 128, 128);
    g2.fillStyle = "rgba(120,70,40,0.55)";
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 4; col++)
        g2.fillRect(col * 32 + (row % 2) * 16 - 8, row * 16 + 2, 28, 12);
    return new THREE.CanvasTexture(c);
  };
  const awningTexture = (colA, colB) => {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 32;
    const g2 = c.getContext("2d");
    for (let i = 0; i < 8; i++) { g2.fillStyle = i % 2 ? colA : colB; g2.fillRect(i * 16, 0, 16, 32); }
    return new THREE.CanvasTexture(c);
  };
  function makeStore(w, tint, sign, signBg, signFg) {
    const g = new THREE.Group();
    const bt = brickTexture();
    bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(3, 1.5);
    const wallM = new THREE.MeshStandardMaterial({ map: bt, color: tint, roughness: 0.95 });
    g.add(box(w, 3.6, 4.8, wallM, 0, 1.8, 0));
    g.add(box(w + 0.3, 0.35, 5.1, stdPlain(0x6a5a4a, 0.9), 0, 3.75, 0));
    const signM = new THREE.MeshStandardMaterial({ map: signTexture(sign, null, signBg, signFg), roughness: 0.7 });
    g.add(box(w * 0.82, 0.72, 0.1, signM, 0, 3.02, 2.42));
    const glassM = new THREE.MeshStandardMaterial({ color: 0xa8ccd8, roughness: 0.12, metalness: 0.35, emissive: 0x39586b, emissiveIntensity: 0.35 });
    g.add(box(w * 0.30, 1.5, 0.06, glassM, -w * 0.27, 1.12, 2.42));
    g.add(box(w * 0.30, 1.5, 0.06, glassM, w * 0.27, 1.12, 2.42));
    g.add(box(0.98, 2.14, 0.09, stdPlain(0x5a4030, 0.8), 0, 1.07, 2.42));
    const at = awningTexture("#f5efe0", signBg);
    at.wrapS = THREE.RepeatWrapping; at.repeat.set(2, 1);
    const awn = box(w * 0.92, 0.05, 1.15, new THREE.MeshStandardMaterial({ map: at, roughness: 0.9 }), 0, 2.3, 2.85);
    awn.rotation.x = -0.32; g.add(awn);
    return g;
  }
  const stores = [
    [-14, 0xd8b490, "BETTY'S BAKERY", "#a03a50", "#ffe9c9"],
    [-6.8, 0xc8c0a8, "THE GROCER'S", "#2e6a46", "#ffe9c9"],
    [0.4, 0xb8b0a0, "POST OFFICE", "#28418c", "#ffffff"],
    [7.6, 0xd8a878, "DOYLE'S DINER", "#a02818", "#ffe9c9"],
    [14.8, 0xa87858, "PUBLIC LIBRARY", "#4a3626", "#ffe9c9"]
  ];
  for (const [sx, tint, sign, sbg, sfg] of stores) {
    const st = makeStore(6.8, tint, sign, sbg, sfg);
    st.position.set(sx, 0, 34.6);
    st.rotation.y = Math.PI;
    T.add(st);
    solid(sx - 3.4, sx + 3.4, 32.2, 37.0);
  }
  // the Charles Theatre — with a chasing-light marquee
  const theatre = new THREE.Group();
  {
    const bt = brickTexture(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(3, 2);
    theatre.add(box(8, 5.2, 5, new THREE.MeshStandardMaterial({ map: bt, color: 0xb89878, roughness: 0.95 }), 0, 2.6, 0));
    const vsign = new THREE.MeshStandardMaterial({ map: signTexture("CHARLES", null, "#701418", "#ffd873"), roughness: 0.6 });
    theatre.add(box(1.1, 3.6, 0.5, vsign, 0, 5.6, 2.2));
    const mq = signTexture("NOW SHOWING", "THE MUSIC MAN", "#f5efe0", "#701418");
    theatre.add(box(5.6, 1.1, 0.15, new THREE.MeshStandardMaterial({ map: mq, roughness: 0.6 }), 0, 2.95, 3.15));
    theatre.add(box(5.8, 0.16, 1.7, stdPlain(0x701418, 0.6), 0, 3.55, 2.7));
    const bulbA = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc845, emissiveIntensity: 1.4 });
    const bulbB = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc845, emissiveIntensity: 0.15 });
    const bulbG = new THREE.SphereGeometry(0.055, 8, 6);
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(bulbG, i % 2 ? bulbA : bulbB);
      b.position.set(-2.65 + i * 0.48, 2.42, 3.28);
      theatre.add(b);
    }
    extras.push((t) => {
      const ph = Math.sin(t * 5.5) > 0;
      bulbA.emissiveIntensity = ph ? 1.5 : 0.15;
      bulbB.emissiveIntensity = ph ? 0.15 : 1.5;
    });
    theatre.add(box(1.1, 2.2, 0.1, stdPlain(0x3a2a20, 0.8), -1.2, 1.1, 2.53));
    theatre.add(box(1.1, 2.2, 0.1, stdPlain(0x3a2a20, 0.8), 1.2, 1.1, 2.53));
  }
  theatre.position.set(23.5, 0, 34.6);
  theatre.rotation.y = Math.PI;
  T.add(theatre);
  solid(19.5, 27.5, 32.1, 37.1);
  // the Floyd County courthouse — its clock keeps real time
  const court = new THREE.Group();
  let hourHand, minuteHand;
  {
    const bt = brickTexture(); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(4, 2.2);
    const brickM = new THREE.MeshStandardMaterial({ map: bt, color: 0xb0805e, roughness: 0.95 });
    court.add(box(10, 5.5, 6.5, brickM, 0, 2.75, 0));
    const croof = prismRoof(11, 2.0, 7.5, stdPlain(0x5a6068, 0.9));
    croof.position.y = 5.5; court.add(croof);
    court.add(box(2.7, 4.4, 2.7, brickM, 0, 7.6, -0.6));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.65, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), stdPlain(0x7a8894, 0.5));
    dome.position.set(0, 9.8, -0.6); court.add(dome);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.08, 24), stdPlain(0xfaf6ea, 0.4));
    face.rotation.x = Math.PI / 2; face.position.set(0, 8.5, -1.99); court.add(face);
    hourHand = new THREE.Group(); hourHand.position.set(0, 8.5, -2.06);
    hourHand.add(box(0.09, 0.52, 0.02, stdPlain(0x22242a, 0.5), 0, 0.22, 0)); court.add(hourHand);
    minuteHand = new THREE.Group(); minuteHand.position.set(0, 8.5, -2.08);
    minuteHand.add(box(0.06, 0.78, 0.02, stdPlain(0x22242a, 0.5), 0, 0.34, 0)); court.add(minuteHand);
    const colM = stdPlain(0xfaf8f2, 0.6);
    for (const cx of [-3.6, -1.2, 1.2, 3.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 10), colM);
      col.position.set(cx, 1.7, -3.9); court.add(col);
    }
    court.add(box(7.5, 0.5, 1.6, stdPlain(0xcfc8bc, 0.9), 0, 0.25, -4.2));
    court.add(box(1.3, 2.6, 0.1, stdPlain(0x4a3626, 0.8), 0, 1.3, -3.28));
  }
  court.position.set(34.5, 0, 40);
  T.add(court);
  solid(29.3, 39.7, 36.5, 43.5);
  // a working gas station — her Bel Air will drink here
  const gasSt = new THREE.Group();
  {
    gasSt.add(box(4.6, 2.9, 3.6, stdPlain(0xf0ece2, 0.8), 0, 1.45, 2.2));
    gasSt.add(box(4.9, 0.22, 3.9, stdPlain(0xa02818, 0.7), 0, 3.0, 2.2));
    const winM = new THREE.MeshStandardMaterial({ color: 0xa8ccd8, roughness: 0.12, metalness: 0.35 });
    gasSt.add(box(2.6, 1.1, 0.06, winM, 0, 1.6, 0.38));
    gasSt.add(box(6.4, 0.18, 4.6, stdPlain(0xf0ece2, 0.7), 0, 2.75, 3.4)); // canopy
    const poleM2 = stdPlain(0x8a8f96, 0.5);
    for (const px of [-2.9, 2.9]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.75, 8), poleM2);
      p.position.set(px, 1.37, 5.3); gasSt.add(p);
    }
    for (const px of [-1.1, 1.1]) { // the pumps
      gasSt.add(box(0.55, 1.15, 0.4, stdPlain(0xc23b2e, 0.5), px, 0.58, 3.4));
      gasSt.add(box(0.4, 0.34, 0.05, stdPlain(0xfaf6ea, 0.4), px, 0.82, 3.62));
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 0.7 }));
      globe.position.set(px, 1.32, 3.4); gasSt.add(globe);
    }
    const gsign = new THREE.MeshStandardMaterial({ map: signTexture("GAS", "24 HOURS", "#a02818", "#ffffff"), roughness: 0.6 });
    gasSt.add(box(1.7, 0.85, 0.12, gsign, 3.9, 2.2, 4.8));
    gasSt.add(box(0.09, 2.2, 0.09, poleM2, 3.9, 1.1, 4.8));
  }
  gasSt.position.set(-25.5, 0, 34.2);
  gasSt.rotation.y = Math.PI;
  T.add(gasSt);
  solid(-28.2, -22.8, 32.2, 36.4);
  homeRefs.gasPumps = [{ x: -26.6, z: 30.8 }, { x: -24.4, z: 30.8 }];
  // the church at the east end of her street
  const church = new THREE.Group();
  {
    const whiteM = new THREE.MeshStandardMaterial({ map: sidingTexture(), color: 0xf6f2e8, roughness: 0.9 });
    church.add(box(5, 3.6, 8, whiteM, 0, 1.8, 0));
    const chroof = prismRoof(6.0, 2.1, 8.8, stdPlain(0x6a7076, 0.9));
    chroof.rotation.y = Math.PI / 2; chroof.position.y = 3.6; church.add(chroof);
    church.add(box(1.15, 2.8, 1.15, whiteM, 0, 5.0, 3.2));
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.9, 4), stdPlain(0x6a7076, 0.9));
    spire.rotation.y = Math.PI / 4; spire.position.set(0, 7.3, 3.2); church.add(spire);
    church.add(box(0.07, 0.7, 0.07, stdPlain(0xd8b25e, 0.4), 0, 8.55, 3.2));
    church.add(box(0.45, 0.07, 0.07, stdPlain(0xd8b25e, 0.4), 0, 8.45, 3.2));
    const winM2 = new THREE.MeshStandardMaterial({ color: 0xffd873, emissive: 0xffca55, emissiveIntensity: 0.35, roughness: 0.4 });
    for (const wz of [-2.2, 0.2, 2.6]) {
      church.add(box(0.06, 1.7, 0.62, winM2, -2.51, 2.0, wz));
      church.add(box(0.06, 1.7, 0.62, winM2, 2.51, 2.0, wz));
    }
    church.add(box(1.1, 2.2, 0.09, stdPlain(0x5a4030, 0.8), 0, 1.1, 4.02));
  }
  church.position.set(27, 0, 8);
  T.add(church);
  solid(24.3, 29.7, 3.8, 12.2);
  // Central Park, between Main Street and the river
  const parkM = stdPlain(0x66a34e, 1);
  const park = new THREE.Mesh(new THREE.PlaneGeometry(44, 8.5), parkM);
  park.rotation.x = -Math.PI / 2; park.position.set(0, -0.012, 41.8); T.add(park);
  T.add(box(1.6, 0.03, 8.5, conc, 0, 0.0, 41.8));
  T.add(box(44, 0.03, 1.4, conc, 0, 0.0, 38.6));
  const gazebo = new THREE.Group();
  {
    const gm = stdPlain(0xf6f2e8, 0.8);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), gm);
      p.position.set(Math.cos(a) * 1.9, 1.15, Math.sin(a) * 1.9); gazebo.add(p);
    }
    const gr = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 6), stdPlain(0x8a5a44, 0.9));
    gr.position.y = 2.85; gazebo.add(gr);
    const gf = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.14, 6), gm);
    gf.position.y = 0.07; gazebo.add(gf);
  }
  gazebo.position.set(-7, 0, 41.8);
  T.add(gazebo);
  solid(-9.1, -4.9, 39.7, 43.9);
  const benchM = stdPlain(0x7a5a38, 0.85);
  for (const [bx, bz] of [[2.2, 40.2], [8, 43.4], [-13, 39.6]]) {
    T.add(box(1.7, 0.08, 0.45, benchM, bx, 0.45, bz));
    T.add(box(1.7, 0.5, 0.07, benchM, bx, 0.75, bz - 0.22));
    T.add(box(0.08, 0.45, 0.4, benchM, bx - 0.7, 0.22, bz));
    T.add(box(0.08, 0.45, 0.4, benchM, bx + 0.7, 0.22, bz));
  }
  // the Cedar River + a footbridge to the far bank
  const waterC = document.createElement("canvas");
  waterC.width = 256; waterC.height = 256;
  {
    const g2 = waterC.getContext("2d");
    g2.fillStyle = "#3a6a96"; g2.fillRect(0, 0, 256, 256);
    g2.strokeStyle = "rgba(190,220,245,0.5)"; g2.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      g2.beginPath();
      const wy = (i * 37) % 256;
      g2.moveTo((i * 53) % 200, wy);
      g2.bezierCurveTo((i * 53) % 200 + 20, wy - 6, (i * 53) % 200 + 40, wy + 6, (i * 53) % 200 + 62, wy);
      g2.stroke();
    }
  }
  const waterT = new THREE.CanvasTexture(waterC);
  waterT.wrapS = waterT.wrapT = THREE.RepeatWrapping; waterT.repeat.set(10, 1);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(120, 8.4),
    new THREE.MeshStandardMaterial({ map: waterT, roughness: 0.25, metalness: 0.1 }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, -0.14, 50.2); T.add(river);
  extras.push((t, dt) => { waterT.offset.x = (t * 0.018) % 1; waterT.offset.y = Math.sin(t * 0.4) * 0.01; });
  const sandM = stdPlain(0xd8c498, 1);
  T.add(box(120, 0.05, 0.9, sandM, 0, -0.01, 45.7));
  T.add(box(120, 0.05, 0.9, sandM, 0, -0.01, 54.7));
  const deckM = stdPlain(0x8a6a48, 0.9);
  T.add(box(2.6, 0.14, 11.6, deckM, 0, 0.07, 50.2));
  for (const rx of [-1.22, 1.22]) {
    T.add(box(0.07, 0.09, 11.6, deckM, rx, 0.62, 50.2));
    for (let pz = 45; pz <= 55.5; pz += 1.75) T.add(box(0.07, 0.62, 0.07, deckM, rx, 0.31, pz));
  }
  solid(-60, -1.6, 45.8, 54.6); solid(1.6, 60, 45.8, 54.6);
  const farTree = makeTree3D(4.5, 57, 1.2);
  T.add(farTree); sway.push({ g: farTree.userData.canopy, ph: 7.7 });
  // the water tower — CHARLES CITY, with a blinking beacon
  const towerG = new THREE.Group();
  let beaconM;
  {
    const legM2 = stdPlain(0x9aa4ac, 0.6);
    for (const [lx, lz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) {
      towerG.add(limb(new THREE.Vector3(lx * 1.35, 0, lz * 1.35), new THREE.Vector3(lx, 8.6, lz), 0.09, legM2));
      solid(-30 + lx * 1.35 - 0.3, -30 + lx * 1.35 + 0.3, 43 + lz * 1.35 - 0.3, 43 + lz * 1.35 + 0.3);
    }
    const tankC = document.createElement("canvas");
    tankC.width = 1024; tankC.height = 128;
    const g2 = tankC.getContext("2d");
    g2.fillStyle = "#b8ccd8"; g2.fillRect(0, 0, 1024, 128);
    g2.fillStyle = "#28418c"; g2.font = "bold 74px Georgia, serif"; g2.textAlign = "center";
    g2.fillText("CHARLES CITY", 256, 88);
    g2.fillText("CHARLES CITY", 768, 88);
    const tankT = new THREE.CanvasTexture(tankC);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 3.4, 20),
      new THREE.MeshStandardMaterial({ map: tankT, roughness: 0.45, metalness: 0.3 }));
    tank.position.y = 10.3; towerG.add(tank);
    const troof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.3, 20), stdPlain(0x8a4a3a, 0.8));
    troof.position.y = 12.65; towerG.add(troof);
    beaconM = new THREE.MeshStandardMaterial({ color: 0xff3a2a, emissive: 0xff2010, emissiveIntensity: 1.5 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), beaconM);
    beacon.position.y = 13.5; towerG.add(beacon);
  }
  towerG.position.set(-30, 0, 43);
  T.add(towerG);
  extras.push((t) => { beaconM.emissiveIntensity = 1.2 + Math.sin(t * 2.2) * 1.1; });
  // the railroad + the co-op grain elevator (tractor country)
  const ballast = new THREE.Mesh(new THREE.PlaneGeometry(114, 2.8), stdPlain(0x8a8680, 1));
  ballast.rotation.x = -Math.PI / 2; ballast.position.set(0, -0.004, -24); T.add(ballast);
  const tieC = document.createElement("canvas");
  tieC.width = 64; tieC.height = 64;
  {
    const g2 = tieC.getContext("2d");
    g2.fillStyle = "#7a6a52"; g2.fillRect(0, 0, 64, 64);
    g2.fillStyle = "#4a3a28"; g2.fillRect(0, 8, 64, 48);
  }
  const tieT = new THREE.CanvasTexture(tieC);
  tieT.wrapS = THREE.RepeatWrapping; tieT.repeat.set(95, 1);
  const ties = new THREE.Mesh(new THREE.PlaneGeometry(114, 1.7), new THREE.MeshStandardMaterial({ map: tieT, roughness: 1 }));
  ties.rotation.x = -Math.PI / 2; ties.position.set(0, 0.004, -24); T.add(ties);
  const railM = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.25, metalness: 0.85 });
  T.add(box(114, 0.07, 0.07, railM, 0, 0.05, -24.48));
  T.add(box(114, 0.07, 0.07, railM, 0, 0.05, -23.52));
  T.add(box(4, 0.025, 15, stdPlain(0xc8b088, 1), 20, 0.002, -23.2)); // dirt crossing road
  const sigA = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2010, emissiveIntensity: 1.6 });
  const sigB = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2010, emissiveIntensity: 0.1 });
  const mkSignal = (sx, sz) => {
    const g = new THREE.Group();
    g.add(box(0.09, 2.6, 0.09, stdPlain(0x6a6e74, 0.5), 0, 1.3, 0));
    const cb1 = box(1.1, 0.16, 0.03, stdPlain(0xf0f0f0, 0.6), 0, 2.45, 0); cb1.rotation.z = 0.6; g.add(cb1);
    const cb2 = box(1.1, 0.16, 0.03, stdPlain(0xf0f0f0, 0.6), 0, 2.45, 0); cb2.rotation.z = -0.6; g.add(cb2);
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), sigA); l1.position.set(-0.22, 1.95, 0.06); g.add(l1);
    const l2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), sigB); l2.position.set(0.22, 1.95, 0.06); g.add(l2);
    g.position.set(sx, 0, sz);
    T.add(g);
  };
  mkSignal(17.3, -22.8); mkSignal(22.7, -25.2);
  extras.push((t) => {
    const ph = Math.sin(t * 3.6) > 0;
    sigA.emissiveIntensity = ph ? 1.8 : 0.1;
    sigB.emissiveIntensity = ph ? 0.1 : 1.8;
  });
  const elev = new THREE.Group();
  {
    const concM = stdPlain(0xd8d2c4, 0.95);
    for (const ex of [-4.6, 0, 4.6]) {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 8.2, 14), concM);
      silo.position.set(ex, 4.1, 0); elev.add(silo);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), concM);
      cap.position.set(ex, 8.2, 0); elev.add(cap);
    }
    elev.add(box(3.4, 11.5, 3.4, concM, 0, 5.75, 0));
    const coopM = new THREE.MeshStandardMaterial({ map: signTexture("CHARLES CITY", "CO-OP ELEVATOR", "#e8e2d2", "#28418c"), roughness: 0.8 });
    elev.add(box(3.3, 1.7, 0.08, coopM, 0, 9.2, 1.74));
  }
  elev.position.set(-18, 0, -28.2);
  T.add(elev);
  solid(-23.5, -12.5, -30.4, -26.0);
  // an Oliver-green tractor — this town invented the farm tractor
  function makeTractor() {
    const g = new THREE.Group();
    const green = new THREE.MeshStandardMaterial({ color: 0x2e6a34, roughness: 0.45, metalness: 0.2 });
    const cream2 = stdPlain(0xf3ead2, 0.6);
    g.add(box(0.85, 0.55, 1.7, green, 0, 0.78, 0.25));       // hood + frame
    g.add(box(0.7, 0.3, 0.5, cream2, 0, 0.98, 0.85));       // grille shell
    g.add(box(0.5, 0.42, 0.55, green, 0, 1.0, -0.75));      // rear deck
    const seat = box(0.52, 0.08, 0.5, stdPlain(0x5a3a22, 0.7), 0, 1.28, -0.8); g.add(seat);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), stdPlain(0x2a2a2c, 0.6));
    stack.position.set(0.18, 1.3, 0.75); g.add(stack);
    const wheelM = stdPlain(0x1c1c1e, 0.9), hubM = stdPlain(0xd8b25e, 0.5);
    for (const [wx, wz, wr] of [[-0.52, -0.78, 0.52], [0.52, -0.78, 0.52], [-0.42, 0.88, 0.27], [0.42, 0.88, 0.27]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.14, 16), wheelM);
      w.rotation.z = Math.PI / 2; w.position.set(wx, wr, wz); g.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.45, wr * 0.45, 0.15, 10), hubM);
      hub.rotation.z = Math.PI / 2; hub.position.set(wx, wr, wz); g.add(hub);
    }
    const fenderM = green;
    for (const sx of [-0.52, 0.52]) g.add(box(0.2, 0.07, 1.0, fenderM, sx, 1.1, -0.78));
    return g;
  }
  const tractor1 = makeTractor();
  tractor1.position.set(-13.2, 0, -21.6); tractor1.rotation.y = 0.5;
  T.add(tractor1);
  solid(-14.1, -12.3, -22.5, -20.7);
  const tractor2 = makeTractor();
  tractor2.position.set(29.2, 0, 35.6); tractor2.rotation.y = -0.9;
  T.add(tractor2);
  solid(28.3, 30.1, 34.7, 36.5);
  // the town welcome sign + street signs
  const welM = new THREE.MeshStandardMaterial({ map: signTexture("CHARLES CITY", "Birthplace of the Farm Tractor", "#28418c", "#ffffff"), roughness: 0.7 });
  T.add(box(4.4, 1.15, 0.12, welM, -40, 1.6, 20.5));
  T.add(box(0.12, 1.9, 0.12, stdPlain(0x5a4632, 0.85), -41.8, 0.95, 20.5));
  T.add(box(0.12, 1.9, 0.12, stdPlain(0x5a4632, 0.85), -38.2, 0.95, 20.5));
  const stSign = (txt, x, z, ry) => {
    const g = new THREE.Group();
    g.add(box(0.07, 2.4, 0.07, stdPlain(0x6a6e74, 0.5), 0, 1.2, 0));
    const m = new THREE.MeshStandardMaterial({ map: signTexture(txt, null, "#2e6a46", "#ffffff"), roughness: 0.6 });
    g.add(box(1.35, 0.34, 0.05, m, 0, 2.3, 0));
    g.position.set(x, 0, z); g.rotation.y = ry;
    T.add(g);
  };
  stSign("MAIN ST", 29.5, 29.9, 0.2);
  stSign("CLARK ST", 29.5, 29.9, Math.PI / 2 + 0.2);
  // the town's people, in their places (the Android cast)
  const addLabel = (person, text, y) => {
    const lb = labelSprite(text);
    lb.position.y = y || 1.95;
    person.add(lb);
  };
  const betty = makePerson3D(0xe8a8b8, 0xf6c7a0);
  betty.position.set(-14, 0, 31.4); betty.rotation.y = Math.PI;
  T.add(betty); people.push({ g: betty, kind: "wave", ph: 0.6 }); addLabel(betty, "Betty the Baker");
  const doyle = makePerson3D(0x6a5a48, 0xc68863);
  doyle.position.set(8.6, 0, 31.4); doyle.rotation.y = Math.PI;
  T.add(doyle); people.push({ g: doyle, kind: "wave", ph: 2.2 }); addLabel(doyle, "Mr. Doyle");
  addLabel(waver, "Mrs. Henderson");
  addLabel(walker2, "Mr. Patterson, Mailman");
  const bag = box(0.3, 0.36, 0.14, stdPlain(0x8a6a3a, 0.8), 0.3, 0.78, 0.1);
  walker2.add(bag);
  const kowalski = makePerson3D(0x8a7ab8, 0xf6c7a0);
  kowalski.position.set(2.2, -0.28, 40.25);
  T.add(kowalski); people.push({ g: kowalski, kind: "knit", ph: 0 }); addLabel(kowalski, "Mrs. Kowalski", 1.8);
  const timmy = makePerson3D(0x4a7ab8, 0xf6c7a0);
  timmy.scale.setScalar(0.62);
  timmy.position.set(3.6, 0, 42.6);
  T.add(timmy); people.push({ g: timmy, kind: "walk", x: 3.6, z: 42.6, dir: 1, speed: 1.25, ph: 1.2, minX: 1.2, maxX: 7.5 });
  addLabel(timmy, "Little Timmy", 2.1);
  const biscuit = new THREE.Group();
  {
    const dogM = stdPlain(0xb8894e, 0.9);
    biscuit.add(box(0.52, 0.3, 0.26, dogM, 0, 0.32, 0));
    biscuit.add(box(0.24, 0.22, 0.22, dogM, 0.36, 0.44, 0));
    biscuit.add(box(0.1, 0.16, 0.05, dogM, 0.4, 0.58, -0.08));
    biscuit.add(box(0.1, 0.16, 0.05, dogM, 0.4, 0.58, 0.08));
    for (const [lx, lz] of [[-0.18, -0.09], [0.18, -0.09], [-0.18, 0.09], [0.18, 0.09]])
      biscuit.add(box(0.07, 0.2, 0.07, dogM, lx, 0.1, lz));
    const tail = box(0.22, 0.05, 0.05, dogM, -0.34, 0.44, 0);
    biscuit.add(tail);
    biscuit.userData.tail = tail;
  }
  biscuit.position.set(4.4, 0, 43.1);
  T.add(biscuit); addLabel(biscuit, "Biscuit", 1.0);
  extras.push((t) => {
    biscuit.userData.tail.rotation.y = Math.sin(t * 6.5) * 0.5;
    biscuit.position.y = Math.abs(Math.sin(t * 3.1)) * 0.02;
  });
  // the courthouse clock keeps real time
  extras.push(() => {
    const d = new Date();
    const mins = d.getMinutes() + d.getSeconds() / 60;
    const hrs = (d.getHours() % 12) + mins / 60;
    if (minuteHand) minuteHand.rotation.z = -mins / 60 * Math.PI * 2;
    if (hourHand) hourHand.rotation.z = -hrs / 12 * Math.PI * 2;
  });

  // ---- the town, alive: one tick animates everything
  homeRefs.town = true;
  homeRefs.solids = solids;
  homeRefs.doors = doors;
  homeRefs.traffic = traffic;
  addContentProps(T, solid);
  partitionTown(T);
  homeRefs.townTick = (t, dt) => {
    const mom = homeRefs.mom;
    for (const ex of extras) ex(t, dt);
    if (homeRefs.contentTickers) for (const g of homeRefs.contentTickers) if (g.userData.tick) g.userData.tick(t, dt);
    for (const d of doors) {
      const near = mom && Math.hypot(mom.position.x - d.cx, mom.position.z - d.cz) < 1.7;
      const target = near ? d.openAng : 0;
      d.ang += (target - d.ang) * Math.min(1, dt * 5);
      d.pivot.rotation.y = d.ang;
    }
    for (const c of traffic) {
      const u = c.userData;
      if (Drive.trafficCalm) {
        u.speed = 0;
        const cs = 38.5 + traffic.indexOf(c) * 90.4;
        if (Math.abs(u.s - cs) > 0.01) { u.s = cs; const p = stadium(u.s); c.position.set(p.x, 0.02, p.z); c.rotation.y = Math.atan2(p.hx, p.hz); }
        continue;
      }
      const here = stadium(u.s);
      let target = here.arc ? 3.2 : 7.0;
      // small-town courtesy: if she's coming up behind a traffic
      // car, it eases ahead — no rolling roadblocks on the straights
      if (Drive.active && Drive.engine === "on" && homeRefs.belAir) {
        const bp = homeRefs.belAir.position;
        const dx = bp.x - c.position.x, dz = bp.z - c.position.z;
        if (dx * dx + dz * dz < 49 && (dx * here.hx + dz * here.hz) < 0) target = Math.max(target, 10.5);
      }
      const accel = target > u.speed ? 2.2 : -4.5;
      u.speed += Math.sign(target - u.speed) * Math.min(Math.abs(target - u.speed), Math.abs(accel) * dt);
      u.brakeM.emissiveIntensity = accel < -1 && u.speed > target + 0.3 ? 1.6 : 0.15;
      u.s += u.speed * dt;
      const p = stadium(u.s);
      c.position.set(p.x, 0.02, p.z);
      c.rotation.y = Math.atan2(p.hx, p.hz);
      for (const w of u.wheels) w.rotation.x += u.speed * dt / 0.32;
    }
    for (const p of people) {
      if (p.kind === "walk") {
        p.x += p.dir * p.speed * dt;
        if (p.x > (p.maxX ?? 24)) p.dir = -1; if (p.x < (p.minX ?? -24)) p.dir = 1;
        p.g.position.set(p.x, Math.abs(Math.sin(t * 5.2 + p.ph)) * 0.035, p.z);
        p.g.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        p.g.userData.arms[0].rotation.x = Math.sin(t * 5.2 + p.ph) * 0.5;
        p.g.userData.arms[1].rotation.x = -Math.sin(t * 5.2 + p.ph) * 0.5;
      } else if (p.kind === "knit") {
        const k = Math.sin(t * 2.6) * 0.09; // Mrs. Kowalski's needles
        p.g.userData.arms[0].rotation.x = -0.55 + k;
        p.g.userData.arms[1].rotation.x = -0.55 - k;
      } else {
        p.g.userData.arms[1].rotation.z = -2.2 + Math.sin(t * 3.2) * 0.35; // the wave
        p.g.userData.arms[0].rotation.x = 0;
      }
    }
    for (const s of sway) {
      s.g.rotation.z = Math.sin(t * 0.6 + s.ph) * 0.025;
      s.g.rotation.x = Math.cos(t * 0.45 + s.ph) * 0.02;
    }
    cloths.forEach((c, i) => { c.rotation.x = 0.06 + Math.sin(t * 1.4 + i * 1.1) * 0.2; });
  };
}

function disposeScene(s) {
  if (!s) return;
  const shared = new Set(Object.values(TEX));
  s.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (m.map && !shared.has(m.map) && !(m.userData && m.userData.keepMap)) m.map.dispose();
        m.dispose();
      }
    }
  });
}
function buildHome() {
  disposeScene(homeScene);
  homeScene = new THREE.Scene();
  homeRefs = { lampLight: new THREE.PointLight(0xffd78c, 0.95, 8, 1.6) };
  const apt = homeOpt.dwelling === 1;
  homeScene.background = new THREE.Color(apt ? 0x232038 : 0x9fc8e8);
  homeScene.fog = new THREE.Fog(apt ? 0x2c3358 : 0xc3dff2, apt ? 18 : 30, apt ? 40 : 135);
  homeScene.add(new THREE.HemisphereLight(apt ? 0xbdd0ff : 0xfff2dd, apt ? 0x33272e : 0x5c4632, apt ? 0.55 : 0.85));
  const sun = new THREE.DirectionalLight(apt ? 0x9fb4ff : 0xffe2ae, apt ? 0.35 : 1.05);
  sun.position.set(3.5, 4.5, -8);
  if (!apt) {
    // a real sky and a real sun: gradient dome overhead, warm
    // light with shadows that ground everything in the town
    sun.position.set(26, 34, 14);
    const shadowSize = GFX[gfxMode].shadow || 0;
    if (shadowSize > 0) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(shadowSize, shadowSize);
      Object.assign(sun.shadow.camera, { left: -64, right: 64, top: 64, bottom: -64, near: 2, far: 140 });
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
      sun.target.position.set(0, 0, 10); homeScene.add(sun.target);
    }
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 14),
      new THREE.MeshBasicMaterial({ map: skyGradientTexture(), side: THREE.BackSide, fog: false }));
    homeScene.add(skyDome);
  }
  homeScene.add(sun);
  const fill = new THREE.PointLight(0xffe2c4, 0.5, 14, 1.4);
  fill.position.set(0, 2.6, 2.5);
  homeScene.add(fill);

  const RW = 11, RD = 8, RH = 3.4, BZ = -RD / 2; // room size, back wall z
  // floor + ceiling
  const ftex = floorTexture(homeOpt.floor);
  ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(2, 1.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD),
    new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  homeScene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), stdPlain(0xf3ead8, 1));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = RH;
  homeScene.add(ceil);
  // walls: side + front full planes; back wall in 4 segments around the window
  const wtexBase = wallpaperTexture(homeOpt.wall);
  const wallMatFor = (x0, x1, y0, y1) => {
    const t = wtexBase.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set((x1 - x0) / RW, (y1 - y0) / RH);
    t.offset.set((x0 + RW / 2) / RW, y0 / RH);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  };
  const mkWall = (cx, cy, w2, h2, ry, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), mat);
    m.position.set(cx, cy, 0); m.rotation.y = ry || 0;
    return m;
  };
  const sideL = mkWall(0, 0, RD, RH, Math.PI / 2, wallMatFor(-RW / 2, -RW / 2 + RD, 0, RH));
  sideL.position.set(-RW / 2, RH / 2, 0); homeScene.add(sideL);
  const sideR = mkWall(0, 0, RD, RH, -Math.PI / 2, wallMatFor(RW / 2 - RD, RW / 2, 0, RH));
  sideR.position.set(RW / 2, RH / 2, 0); homeScene.add(sideR);
  const doorX0 = 0.7, doorX1 = 1.7, doorH = 2.15;
  const bDoorX0 = -3.4, bDoorX1 = -2.4;
  if (apt) {
    const front = mkWall(0, 0, RW, RH, Math.PI, wallMatFor(-RW / 2, RW / 2, 0, RH));
    front.position.set(0, RH / 2, RD / 2); homeScene.add(front);
  } else {
    // front wall in segments around the FRONT DOOR opening
    const fsegs = [
      [-RW / 2, doorX0, 0, RH], [doorX1, RW / 2, 0, RH], [doorX0, doorX1, doorH, RH]
    ];
    for (const [x0, x1, y0, y1] of fsegs) {
      const m = mkWall((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, Math.PI, wallMatFor(x0, x1, y0, y1));
      m.position.z = RD / 2;
      homeScene.add(m);
    }
  }
  const winX0 = 1.6, winX1 = 4.8, winY0 = 1.05, winY1 = 2.75;
  const segs = apt ? [
    [-RW / 2, winX0, 0, RH], [winX1, RW / 2, 0, RH],
    [winX0, winX1, 0, winY0], [winX0, winX1, winY1, RH]
  ] : [
    [-RW / 2, bDoorX0, 0, RH], [bDoorX1, winX0, 0, RH], [winX1, RW / 2, 0, RH],
    [winX0, winX1, 0, winY0], [winX0, winX1, winY1, RH],
    [bDoorX0, bDoorX1, doorH, RH]
  ];
  for (const [x0, x1, y0, y1] of segs) {
    const m = mkWall((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, wallMatFor(x0, x1, y0, y1));
    m.position.z = BZ;
    homeScene.add(m);
  }
  // window frame, cross, sill, curtains
  const frameM = stdPlain(0xfaf8f2, 0.6);
  const fcx = (winX0 + winX1) / 2, fcy = (winY0 + winY1) / 2;
  const frame = new THREE.Group();
  frame.add(box(winX1 - winX0 + 0.16, 0.09, 0.1, frameM, fcx, winY1 + 0.02, BZ));
  frame.add(box(winX1 - winX0 + 0.16, 0.09, 0.1, frameM, fcx, winY0 - 0.02, BZ));
  frame.add(box(0.09, winY1 - winY0 + 0.16, 0.1, frameM, winX0 - 0.02, fcy, BZ));
  frame.add(box(0.09, winY1 - winY0 + 0.16, 0.1, frameM, winX1 + 0.02, fcy, BZ));
  frame.add(box(0.06, winY1 - winY0, 0.06, frameM, fcx, fcy, BZ));
  frame.add(box(winX1 - winX0 + 0.3, 0.07, 0.24, frameM, fcx, winY0 - 0.06, BZ + 0.05));
  homeScene.add(frame);
  if (homeOpt.curtains < 4) {
    const cMat = homeOpt.curtains === 1
      ? new THREE.MeshStandardMaterial({ map: ginghamTexture(1), roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ map: curtainFoldTexture(homeOpt.curtains), roughness: 0.9 });
    const curt = new THREE.Group();
    curt.add(box(0.62, winY1 - winY0 + 0.24, 0.09, cMat, winX0 + 0.24, fcy + 0.06, BZ + 0.13));
    curt.add(box(0.62, winY1 - winY0 + 0.24, 0.09, cMat, winX1 - 0.24, fcy + 0.06, BZ + 0.13));
    curt.add(box(winX1 - winX0 + 0.34, 0.3, 0.09, cMat, fcx, winY1 + 0.08, BZ + 0.13));
    homeScene.add(curt);
  }
  // the view outside
  const outside = new THREE.Group();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(150, 44),
    new THREE.MeshBasicMaterial({ map: skyTexture(apt), fog: false }));
  sky.position.set(0, 10, -48);
  if (!apt) sky.visible = false; // the gradient dome is the sky now; the painted card stays for the apartment window
  outside.add(sky);
  if (!apt) {
    // (the lawn, fence, neighbour house and tree that used to
    // dress this window now live in the real town — buildTown)
    const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffe27a, transparent: true, fog: false, depthWrite: false }));
    sunSpr.scale.set(10, 10, 1); sunSpr.position.set(18, 9, -42);
    outside.add(sunSpr);
    for (const [clx, cly, cls] of [[12, 10, 8], [22, 8, 6.5], [-14, 11, 7]]) {
      const cl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xffffff, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
      cl.scale.set(cls, cls * 0.38, 1); cl.position.set(clx, cly, -40);
      outside.add(cl);
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const bw = 1.8 + (i % 3) * 0.7, bh = 3.2 + ((i * 37) % 5) * 0.9;
      const bMat = new THREE.MeshStandardMaterial({ map: skylineTexture(i + 1), emissive: 0xffffff, emissiveMap: skylineTexture(i + 1), emissiveIntensity: 0.55, roughness: 1 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 1.4), bMat);
      b.position.set(-9 + i * 2.4, bh / 2 - 0.4, -11 - (i % 2) * 1.6);
      outside.add(b);
    }
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, color: 0xf0ecd2, transparent: true, fog: false, depthWrite: false }));
    moon.scale.set(2.4, 2.4, 1); moon.position.set(7.0, 3.7, -16);
    outside.add(moon);
    const roofTop = box(3.6, 0.5, 3, stdPlain(0x2e2c40, 1), 4.4, 2.0, -7.5);
    outside.add(roofTop);
    const tower = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12), stdPlain(0x282638, 1));
    tank.position.y = 1.15; tower.add(tank);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.5, 12), stdPlain(0x1e1c2c, 1));
    cone.position.y = 1.95; tower.add(cone);
    const legM = stdPlain(0x282638, 1);
    for (const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]])
      tower.add(limb(new THREE.Vector3(lx, 0, lz), new THREE.Vector3(lx * 0.7, 0.62, lz * 0.7), 0.045, legM));
    tower.position.set(4.4, 2.25, -7.5);
    outside.add(tower);
  }
  homeScene.add(outside);
  if (!apt) buildTown();
  // furniture per her options
  const sofa = makeSofa3D();
  sofa.position.set(-3.7, 0, -1.3); sofa.rotation.y = Math.PI / 2;
  homeScene.add(sofa);
  const tv = makeTv3D();
  tv.position.set(4.35, 0, -1.3); tv.rotation.y = -Math.PI / 2;
  homeScene.add(tv);
  if (homeOpt.rug < 4) {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.05, 30),
      new THREE.MeshStandardMaterial({ map: rugTexture(homeOpt.rug), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.scale.set(1.35, 0.85, 1);
    rug.position.set(-0.1, 0.012, -1.1);
    homeScene.add(rug);
  }
  const decor = makeDecor3D();
  decor.position.set(-3.3, 2.15, BZ + 0.06);
  homeScene.add(decor);
  // Grok's furniture sets (content lane): her kitchen along the south
  // wall, the baby's nursery corner in the south-east. Both animate
  // through the shared content tickers the town tick drives.
  if (typeof buildKitchenSet === "function") {
    const tickers = homeRefs.contentTickers = homeRefs.contentTickers || [];
    const kit = buildKitchenSet();
    kit.position.set(-2.6, 0, 3.15); kit.rotation.y = Math.PI;
    kit.traverse(o => { o.castShadow = true; });
    homeScene.add(kit); tickers.push(kit);
    const nur = buildNurserySet();
    nur.position.set(3.35, 0, 2.35); nur.rotation.y = Math.PI;
    nur.traverse(o => { o.castShadow = true; });
    homeScene.add(nur); tickers.push(nur);
  }
  const lamp = makeLamp3D();
  if (homeOpt.lamp === 0) lamp.position.set(-4.7, 0, -3.3);
  else if (homeOpt.lamp === 1) lamp.position.set(-4.55, 0, -0.1);
  homeScene.add(lamp);
  const plantFloor = makePlant3D(false);
  plantFloor.position.set(0.5, 0, -3.45);
  homeScene.add(plantFloor);
  const plantSill = makePlant3D(true);
  plantSill.position.set(3.2, winY0 - 0.03, BZ + 0.05);
  homeScene.add(plantSill);
  const mom = makeMom3D();
  mom.position.set(1.25, 0, -0.85);
  mom.rotation.y = -0.38;
  mom.traverse(o => { if (o.isMesh) o.castShadow = true; }); // she stands IN the light now
  homeScene.add(mom);
  homeRefs.momHead = new THREE.Vector3(1.25, 1.585, -0.85);
  homeRefs.momFaceDir = new THREE.Vector3(-0.371, 0, 0.929);
  applyFpov();
}

// ------------------------------------------------------------ home view control
let momWeeks = Math.min(40, Math.max(8, prefs.get("momweeks", 24)));
function bumpFactor() {
  const wk = 0.72 + (momWeeks - 8) / 32 * 0.44;
  return +(wk * (1 + (selBabies - 1) * 0.04)).toFixed(3);
}
function weekSizeName(w) {
  const table = [[8, "a raspberry"], [10, "a strawberry"], [12, "a lime"], [14, "a lemon"], [16, "an avocado"], [18, "a bell pepper"], [20, "a banana"], [22, "a papaya"], [24, "a cantaloupe"], [26, "a head of lettuce"], [28, "an eggplant"], [30, "a cabbage"], [32, "a squash"], [34, "a butternut squash"], [36, "a honeydew melon"], [38, "a stalk of rhubarb"], [40, "a watermelon"]];
  let name = table[0][1];
  for (const [wk, n] of table) if (w >= wk) name = n;
  return "about the size of " + name;
}
function setWeeks(n) {
  momWeeks = Math.min(40, Math.max(8, Math.round(n)));
  prefs.set("momweeks", momWeeks);
  if (homeRefs.applyBump) homeRefs.applyBump();
  return momWeeks;
}
const homeCam = { az: 0, pol: 1.36 };
let homeDrag = null;
let mirrorRT = null, mirrorTick = 0;
// A real mirror: render the room from the reflected camera into
// a target the mirror disc wears. In FPOV her head is hidden in
// the main view — but the mirror pass shows it, so she can
// actually see her own face. Runs at third rate (plenty for a
// mirror), skips when she's behind the mirror's plane.
function renderMirror() {
  const mir = homeRefs.mirror;
  if (!mir || !homeScene || !homeRefs.mom) return;
  if ((mirrorTick++ % 3) !== 0) return;
  const P = new THREE.Vector3();
  mir.getWorldPosition(P);
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(mir.getWorldQuaternion(new THREE.Quaternion()));
  const eye = camera.position.clone();
  const de = eye.clone().sub(P).dot(n);
  if (de <= 0.05) return;
  const rEye = eye.clone().sub(n.clone().multiplyScalar(2 * de));
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const lookPt = eye.clone().add(dir);
  const rTgt = lookPt.clone().sub(n.clone().multiplyScalar(2 * lookPt.clone().sub(P).dot(n)));
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const rUp = up.clone().sub(n.clone().multiplyScalar(2 * up.dot(n)));
  const mc = homeRefs.mirrorCam || (homeRefs.mirrorCam = new THREE.PerspectiveCamera());
  mc.fov = camera.fov; mc.aspect = 1; mc.near = 0.05; mc.far = 60;
  mc.position.copy(rEye); mc.up.copy(rUp); mc.lookAt(rTgt); mc.updateProjectionMatrix();
  const flipped = [];
  if (homeRefs.headBone) homeRefs.headBone.traverse(o => {
    if (o.isMesh || o.isSprite) { flipped.push([o, o.visible]); o.visible = true; }
  });
  const neckWas = homeRefs.momNeckMesh ? homeRefs.momNeckMesh.visible : null;
  if (homeRefs.momNeckMesh) homeRefs.momNeckMesh.visible = true;
  mir.visible = false;
  const oldRT = renderer.getRenderTarget();
  renderer.toneMapping = THREE.NoToneMapping; // the mirror captures raw; the screen pass applies the filmic coat once
  renderer.setRenderTarget(mirrorRT);
  renderer.render(homeScene, mc);
  renderer.setRenderTarget(oldRT);
  mir.visible = true;
  flipped.forEach(([o, v]) => { o.visible = v; });
  if (homeRefs.momNeckMesh && neckWas !== null) homeRefs.momNeckMesh.visible = neckWas;
}
// FPOV: mama mode through her own eyes (his ask). She walks with
// WASD; her head cluster hides so you see the room — and, looking
// down, her bump, her dress, her hands — not the inside of a head.
let fpov = prefs.get("awpc_fpov", "1") === "1";
let fpYaw = -0.38, fpPitch = -0.04, fpBob = 0;
function applyFpov() {
  if (homeRefs.headBone) {
    homeRefs.headBone.traverse(o => {
      if (o.isMesh || o.isSprite) o.visible = !fpov;
    });
  }
  if (homeRefs.momNeckMesh) homeRefs.momNeckMesh.visible = !fpov; // you can't see your own neck
  const btn = document.getElementById("fpovBtn");
  if (btn) btn.textContent = fpov ? "🎥 Third person" : "👀 First person";
}
function updateHomeHelp() {
  const h = document.getElementById("homeHelp");
  if (!h) return;
  h.textContent = fpov
    ? "You ARE mom now · WASD / arrows to walk her · click the room, then mouse to look (Esc frees the mouse) · look down — that's your bump · 🎨 Decorate still works"
    : "Drag to look around her living room · 🎨 Decorate makes it hers · 👀 First person puts you in her shoes";
}
function setFpov(b) {
  fpov = !!b;
  prefs.set("awpc_fpov", fpov ? "1" : "0");
  if (fpov && view === "home") fpYaw = Math.PI - 0.38; // face into the room, not at the wall
  applyFpov();
  updateHomeHelp();
  if (!fpov && document.exitPointerLock) document.exitPointerLock();
  if (view === "home") showHomeMessage(fpov ? "👀 Through her eyes now." : "🎥 Back outside, watching her.", 2000);
}
// ------------------------------------------------------------
// INPUT LAYER + GESTURE SUPPORT (his ask: Kinect-style control
// so players can move her with their bodies). Every control
// source — keyboard/mouse today, webcam gestures built in now,
// gamepads or depth sensors later — writes the same small
// intent (moveX / moveZ / turn). The game only ever reads
// Input; new hardware plugs in here, never into the game code.
const Input = {
  moveX: 0, moveZ: 0, turn: 0,
  gesture: { turn: 0, walk: 0 },
  poll() {
    let mx = 0, mz = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) mz += 1;
    if (keys["KeyS"] || keys["ArrowDown"]) mz -= 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;
    this.moveX = mx;
    this.moveZ = mz + this.gesture.walk;
    this.turn = this.gesture.turn;
  }
};
// Kinect-style motion zones over an ordinary webcam: the frame
// is differenced against the last one and split into zones;
// each zone's motion energy becomes an intent. Lean to a side
// of frame = turn that way; busy low frame (stepping in
// place) = walk; both hands up top = pat the bump.
const Gesture = {
  state: "off", stream: null, timer: null, prev: null, lastPat: 0, _c: null,
  zones: { left: 0, right: 0, top: 0, bottom: 0 },
  async start() {
    if (this.state === "live" || this.state === "starting") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.state = "unsupported";
      if (view === "home") showHomeMessage("🤚 This browser can't reach a camera here — gestures need the game served from localhost (start.sh does that).", 4200);
      refreshGestureBtn();
      return;
    }
    this.state = "starting";
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
    } catch (e) {
      this.state = "denied";
      if (view === "home") showHomeMessage("🤚 No camera available — keyboard and mouse still work fine.", 3600);
      refreshGestureBtn();
      return;
    }
    const video = document.getElementById("gestureVideo");
    video.srcObject = this.stream;
    try { await video.play(); } catch (e) { }
    document.getElementById("gesturePip").classList.remove("hidden");
    this.state = "live";
    this.prev = null;
    this.timer = setInterval(() => this.tick(), 110);
    if (view === "home") showHomeMessage("🤚 Gestures live — lean to turn, step low to walk, hands up to pat the bump.", 3600);
    refreshGestureBtn();
  },
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.state = "off";
    this.zones = { left: 0, right: 0, top: 0, bottom: 0 };
    Input.gesture.turn = 0; Input.gesture.walk = 0;
    const pip = document.getElementById("gesturePip");
    if (pip) pip.classList.add("hidden");
    refreshGestureBtn();
  },
  tick() {
    const video = document.getElementById("gestureVideo");
    if (!video || video.readyState < 2) return;
    const c = this._c || (this._c = document.createElement("canvas"));
    c.width = 96; c.height = 54;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(video, 0, 0, 96, 54);
    let data;
    try { data = g.getImageData(0, 0, 96, 54).data; } catch (e) { return; }
    const cur = new Float32Array(96 * 54);
    for (let i = 0; i < cur.length; i++) cur[i] = data[i * 4] * 0.6 + data[i * 4 + 1] * 0.3 + data[i * 4 + 2] * 0.1;
    if (this.prev) {
      const acc = { left: 0, right: 0, top: 0, bottom: 0 }, cnt = { left: 0, right: 0, top: 0, bottom: 0 };
      for (let y = 0; y < 54; y++) for (let x = 0; x < 96; x++) {
        const d = Math.abs(cur[y * 96 + x] - this.prev[y * 96 + x]);
        if (d < 14) continue;
        if (x < 32) { acc.left += d; cnt.left++; }
        else if (x > 63) { acc.right += d; cnt.right++; }
        if (y < 16) { acc.top += d; cnt.top++; }
        if (y > 38) { acc.bottom += d; cnt.bottom++; }
      }
      for (const k of ["left", "right", "top", "bottom"]) {
        const e = cnt[k] ? Math.min(1, (acc[k] / cnt[k]) / 90) : 0;
        this.zones[k] = this.zones[k] * 0.55 + e * 0.45;
      }
      this.applyMapping();
    }
    this.prev = cur;
  },
  applyMapping() {
    const z = this.zones;
    Input.gesture.turn = clamp((z.right - z.left) * 2.0, -1, 1);
    if (Math.abs(Input.gesture.turn) < 0.12) Input.gesture.turn = 0;
    Input.gesture.walk = z.bottom > 0.42 && z.top < 0.5 ? 1 : 0;
    if (z.top > 0.72 && performance.now() - this.lastPat > 1400) {
      this.lastPat = performance.now();
      if (view === "home") {
        showHomeMessage("🤲 You patted the bump. She felt that.", 2200);
        MomVoice.say(MomVoice.pickLine(MOM_KICK), false);
      }
    }
  }
};
function refreshGestureBtn() {
  const b = document.getElementById("gestureBtn");
  if (b) b.textContent = Gesture.state === "live" ? "🤚 Gestures: On" : "🤚 Gestures";
}
function setGestures(on) { if (on) Gesture.start(); else Gesture.stop(); }

// ------------------------------------------------------------ her Bel Air
// The 1953 Chevrolet Bel Air is a real machine: a 16-gallon
// tank that burns by throttle and revs, a gearbox that shifts,
// a trip meter that measures honest miles per gallon, and a
// gas station on Main Street when she runs dry.
function loadWear() {
  try {
    const w = JSON.parse(prefs.get("belair_wear", ""));
    if (w && typeof w.eng === "number") { if (typeof w.gen !== "number") w.gen = 0.9; return w; }
  } catch (e) { }
  return { eng: 0.92, trn: 0.90, brk: 0.88, tir: 0.85, bat: 0.90, oilMi: 640, plugs: 0.90, gen: 0.90 };
}
const oilHealth = () => clamp(1 - Drive.wear.oilMi / 3000, 0, 1);
const brakePower = () => 3.6 * (0.5 + 0.5 * Drive.wear.brk) * (0.72 + 0.28 * Drive.wear.tir);
const wearGrade = (v) => v > 0.8 ? "Like new" : v > 0.6 ? "Good" : v > 0.4 ? "Wearing" : v > 0.22 ? "Tired" : "Worn out";
const Drive = {
  active: false, engine: "off", crankT: 0,
  gear: "P", auto: 1, speed: 0, rpm: 0, steer: 0, heading: 0,
  fuel: parseFloat(prefs.get("belair_fuel", "11.5")),
  odo: parseFloat(prefs.get("belair_odo", "41208.6")),
  trip: 0, tripFuel: null, hudT: 0, saveT: 0, fullMsgT: 0, shiftT: 0,
  // her carburetor + cold-engine life (Isaiah's systems pass):
  carb: parseFloat(prefs.get("belair_carb", "0")), // mixture screw: -2 lean .. +2 rich, 0 = factory
  choke: false,       // the choke knob: out = rich cold-start mix
  temp: 0.15,         // engine temperature 0 cold .. 1 warmed up
  foul: 0, foulMsg: false,
  lastGph: 0, throttle: 0, stumbleT: 0, stumbleMsgT: 0, driftT: 26,
  jolt: 0, nextHard: false, shifts: 0, hardShifts: 0, trafficCalm: false,
  crankDies: false, crankMsg: "",
  varThrottle: prefs.get("belair_varthr", "0") === "1", mouseThrottle: 0,
  // the 6-volt electrical system + wear and tear + animations
  elec: { charge: parseFloat(prefs.get("belair_charge", "0.85")), amps: 0, volts: 6.2, lights: false },
  wear: loadWear(),
  sigL: false, sigR: false, sigPhase: 0, sigSteerT: 0,
  wipers: false, wipePhase: 0,
  doorAng: 0, doorTarget: 0, doorHoldT: 0,
  hoodAng: 0, hoodOpen: false,
  svcKind: "", svcT: 0, squealT: 0, lightsWarnT: 0,
  hornOn: false, pitch: 0, roll: 0, lastSpeed: 0, exhaustT: 0
};
function carbLabel() {
  const c = Drive.carb;
  if (c === 0) return "Factory spec";
  const turns = Math.abs(c) === 0.5 ? "½" : Math.abs(c) === 1 ? "1" : Math.abs(c) === 1.5 ? "1½" : "2";
  return turns + (Math.abs(c) === 0.5 || Math.abs(c) === 1 ? " turn " : " turns ") + (c > 0 ? "rich" : "lean");
}
function adjustCarb(d) {
  if (!Drive.active) return;
  if (Drive.gear !== "P") { showHomeMessage("Park her (P) before tuning the carb, hon.", 1600); return; }
  Drive.carb = clamp(Drive.carb + d, -2, 2);
  Drive.hoodOpen = true; // tuning her means the hood's up
  const note = Drive.carb > 0 ? " — more pep, thirstier, sootier."
    : Drive.carb < 0 ? " — sips gas, but less pep and she may hesitate."
    : " — right where the factory set it.";
  showHomeMessage("🔧 Carb mixture: " + carbLabel() + note, 2400);
  drawGauges();
}
if (!(Drive.fuel >= 0 && Drive.fuel <= 16)) Drive.fuel = 11.5;
if (!(Drive.odo > 0)) Drive.odo = 41208.6;
const GEAR_TOPS = [13.5, 21.5, 31.0];      // m/s she tops out at, per gear
const GEAR_RATIOS = [3.1, 1.95, 1.3];
function tripMpg() {
  if (Drive.tripFuel === null) return null;
  const used = Drive.tripFuel - Drive.fuel;
  if (used < 0.004 || Drive.trip < 0.02) return null;
  return Drive.trip / used;
}
function saveCarPrefs() {
  prefs.set("belair_fuel", Drive.fuel.toFixed(3));
  prefs.set("belair_odo", Drive.odo.toFixed(2));
  prefs.set("belair_charge", Drive.elec.charge.toFixed(3));
  prefs.set("belair_carb", String(Drive.carb));
  prefs.set("belair_wear", JSON.stringify(Drive.wear));
  const car = homeRefs.belAir;
  if (car) prefs.set("belair_pos", car.position.x.toFixed(2) + "," + car.position.z.toFixed(2) + "," + car.rotation.y.toFixed(3));
}
function updateBelAirSolid() {
  const car = homeRefs.belAir, s = homeRefs.belAirSolid;
  if (!car || !s) return;
  const h = car.rotation.y;
  const ex = 0.98 * Math.abs(Math.cos(h)) + 2.34 * Math.abs(Math.sin(h));
  const ez = 0.98 * Math.abs(Math.sin(h)) + 2.34 * Math.abs(Math.cos(h));
  s.x0 = car.position.x - ex; s.x1 = car.position.x + ex;
  s.z0 = car.position.z - ez; s.z1 = car.position.z + ez;
}
function drawGauges() {
  const car = homeRefs.belAir;
  if (!car || !car.userData.gaugeCanvas) return;
  const g = car.userData.gaugeCanvas.getContext("2d");
  g.fillStyle = "#1d2226"; g.fillRect(0, 0, 512, 144);
  g.strokeStyle = "#c8b98a"; g.lineWidth = 3; g.strokeRect(4, 4, 504, 136);
  const dial = (cx, cy, r, frac, label, val) => {
    g.strokeStyle = "#e8dfc2"; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
    const a = Math.PI * 0.75 + clamp(frac, 0, 1) * Math.PI * 1.5;
    g.strokeStyle = "#ff5a3c"; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82); g.stroke();
    g.fillStyle = "#e8dfc2"; g.font = "bold 20px Georgia"; g.textAlign = "center";
    g.fillText(val, cx, cy + 7);
    g.font = "15px Georgia"; g.fillText(label, cx, cy + r + 17);
  };
  dial(88, 60, 42, Math.abs(Drive.speed) * 2.23694 / 90, "MPH", Math.round(Math.abs(Drive.speed) * 2.23694) + "");
  dial(424, 60, 42, Drive.fuel / 16, "FUEL", Drive.fuel.toFixed(1));
  if (Drive.fuel < 2.2) { g.fillStyle = "#ff5a3c"; g.font = "bold 17px Georgia"; g.textAlign = "center"; g.fillText("LOW", 424, 128); }
  g.font = "bold 29px Georgia"; g.textAlign = "center";
  for (const [i, L] of ["P", "R", "N", "D"].entries()) {
    g.fillStyle = Drive.gear === L ? "#ffd873" : "rgba(232,223,194,0.35)";
    g.fillText(L, 196 + i * 40, 58);
  }
  if (Drive.choke) { g.fillStyle = "#ffb03a"; g.font = "bold 15px Georgia"; g.textAlign = "center"; g.fillText("— CHOKE —", 256, 24); }
  g.font = "16px Georgia"; g.fillStyle = "rgba(232,223,194,0.85)";
  g.fillText(Drive.gear === "D" ? "gear " + Drive.auto : Drive.engine === "off" ? "engine off" : (Drive.elec.amps >= 0 ? "+" : "") + Drive.elec.amps.toFixed(0) + " A · " + Drive.elec.volts.toFixed(1) + " V", 256, 88);
  g.fillText(Math.round(Drive.rpm) + " rpm", 256, 112);
  g.fillText("odo " + Drive.odo.toFixed(1) + " mi", 256, 134);
  car.userData.gaugeTex.needsUpdate = true;
}
const DriveAudio = {
  osc: null, gain: null, filter: null,
  ensure() {
    if (this.osc || !WombAudio.ctx || !WombAudio.master) return;
    try {
      const ctx = WombAudio.ctx;
      this.osc = ctx.createOscillator(); this.osc.type = "sawtooth";
      this.filter = ctx.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 300;
      this.gain = ctx.createGain(); this.gain.gain.value = 0;
      this.osc.connect(this.filter); this.filter.connect(this.gain); this.gain.connect(WombAudio.master);
      this.osc.start();
    } catch (e) { /* no engine voice on this machine */ }
  },
  update() {
    if (!this.osc || !WombAudio.ctx) return;
    const on = Drive.engine === "on" || Drive.engine === "crank";
    const t = WombAudio.ctx.currentTime;
    this.gain.gain.setTargetAtTime(on ? 0.028 + (Drive.rpm / 5800) * 0.035 : 0, t, 0.09);
    this.osc.frequency.setTargetAtTime(36 + (Drive.rpm / 5800) * 108, t, 0.05);
    this.filter.frequency.setTargetAtTime(230 + (Drive.rpm / 5800) * 520, t, 0.08);
  },
  hornOsc: null, hornGain: null,
  hornSet(on) {
    if (!WombAudio.ctx || !WombAudio.master) return;
    try {
      const ctx = WombAudio.ctx;
      if (on && !this.hornOsc) {
        this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0;
        this.hornGain.connect(WombAudio.master);
        this.hornOsc = [];
        for (const f of [392, 494]) {
          const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
          o.connect(this.hornGain); o.start(); this.hornOsc.push(o);
        }
        this.hornGain.gain.setTargetAtTime(0.06, ctx.currentTime, 0.02);
      } else if (!on && this.hornOsc) {
        this.hornGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
        const oscs = this.hornOsc; this.hornOsc = null;
        setTimeout(() => oscs.forEach(o => { try { o.stop(); } catch (e) { } }), 220);
      }
    } catch (e) { /* silent horn */ }
  }
};
function carHits(x, z, h) {
  if (!homeRefs.solids) return false;
  if (x < -44 || x > 44 || z < -31 || z > 57) return true;
  const fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const pts = [[0, 0], [0, 2.35], [0, -2.35]];
  for (const [sx, sz] of [[-0.88, 2.28], [0.88, 2.28], [-0.88, -2.28], [0.88, -2.28]])
    pts.push([sx, sz]);
  for (const [ox, oz] of pts) {
    const px = x + rx * ox + fx * oz, pz = z + rz * ox + fz * oz;
    if (px > -60 && px < 60 && pz > 45.8 && pz < 54.6) return true; // the Cedar is not a road
    for (const s of homeRefs.solids) {
      if (s === homeRefs.belAirSolid) continue;
      if (!solidLive(s)) continue;
      if (px > s.x0 - 0.1 && px < s.x1 + 0.1 && pz > s.z0 - 0.1 && pz < s.z1 + 0.1) return true;
    }
  }
  if (homeRefs.traffic) for (const c of homeRefs.traffic)
    if (Math.hypot(c.position.x - x, c.position.z - z) < 2.4) return true;
  return false;
}
function moveCar(dt) {
  const car = homeRefs.belAir;
  if (!car || Drive.speed === 0) return;
  const sf = clamp(Math.abs(Drive.speed) / 6, 0.22, 1);
  Drive.heading += Drive.steer * 0.5 * (0.72 + 0.28 * Drive.wear.tir) * sf * dt * Math.sign(Drive.speed); // bald tires don't bite
  const step = Drive.speed * dt;
  const nx = car.position.x + Math.sin(Drive.heading) * step;
  const nz = car.position.z + Math.cos(Drive.heading) * step;
  let mx = nx, mz = nz;
  if (carHits(nx, nz, Drive.heading)) {
    if (!carHits(nx, car.position.z, Drive.heading)) mz = car.position.z;
    else if (!carHits(car.position.x, nz, Drive.heading)) mx = car.position.x;
    else {
      if (Math.abs(Drive.speed) > 2.6 && Drive.active) showHomeMessage("💥 Easy, hon — that's solid.", 1500);
      Drive.speed = 0;
      return;
    }
  }
  const moved = Math.hypot(mx - car.position.x, mz - car.position.z);
  car.position.x = mx; car.position.z = mz;
  car.rotation.y = Drive.heading;
  Drive.odo += moved / 1609.34;
  Drive.trip += moved / 1609.34;
  Drive.wear.oilMi += moved / 1609.34;
  Drive.wear.gen = Math.max(0.05, (Drive.wear.gen ?? 1) - moved * 1.0e-7); // the generator wears too, slowly
  Drive.wear.tir = Math.max(0.05, Drive.wear.tir - moved * 4.5e-7 * (1 + Math.abs(Drive.steer) * clamp(Math.abs(Drive.speed) / 8, 0, 1) * 2)); // miles and corners wear the whitewalls down
}
function tryEnterCar() {
  const car = homeRefs.belAir, mom = homeRefs.mom;
  if (!car || !mom || Drive.active || !homeRefs.town) return false;
  if (Math.hypot(mom.position.x - car.position.x, mom.position.z - car.position.z) > 3.1) return false;
  Drive.active = true;
  Drive.heading = car.rotation.y;
  Drive.steer = 0;
  mom.visible = false;
  if (homeRefs.momHeart) homeRefs.momHeart.visible = false;
  if (car.userData.interior) car.userData.interior.visible = true;
  document.getElementById("driveHud").classList.remove("hidden");
  document.getElementById("carPrompt").classList.add("hidden");
  if (document.pointerLockElement) document.exitPointerLock();
  Drive.doorTarget = 1; Drive.doorHoldT = 1.15; // her door swings open, then shut
  drawGauges();
  showHomeMessage("🚗 You're in the Bel Air. ENTER starts her engine · G shifts · T resets the trip.", 3800);
  return true;
}
function exitCar(force) {
  const car = homeRefs.belAir, mom = homeRefs.mom;
  if (!Drive.active || !car || !mom) return;
  if (!force && Math.abs(Drive.speed) > 0.05) { showHomeMessage("Stop her first, hon.", 1300); return; }
  Drive.active = false;
  Drive.speed = 0;
  Drive.doorTarget = 1; Drive.doorHoldT = 1.3;
  Drive.hoodOpen = false;
  document.getElementById("wearCard").classList.add("hidden");
  if (car.userData.interior) car.userData.interior.visible = false;
  document.getElementById("driveHud").classList.add("hidden");
  updateBelAirSolid();
  const h = Drive.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const R = 0.2;
  const blocked = (x, z) => homeRefs.solids && homeRefs.solids.some(s => solidLive(s) && x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R);
  let placed = false;
  for (const [sx, sz] of [[-2.7, 0], [2.7, 0], [0, 3.4], [0, -3.4], [-2.7, 2.4], [2.7, 2.4]]) {
    const wx = car.position.x + rx * sx + fx * sz, wz = car.position.z + rz * sx + fz * sz;
    if (!blocked(wx, wz)) { mom.position.set(wx, 0, wz); placed = true; break; }
  }
  if (!placed) mom.position.set(car.position.x + rx * -3.4, 0, car.position.z + rz * -3.4);
  mom.visible = true;
  if (homeRefs.momHeart) homeRefs.momHeart.visible = true;
  fpYaw = Drive.heading;
  saveCarPrefs();
}
function toggleIgnition() {
  if (!Drive.active) return;
  if (Drive.engine === "off") {
    if (Drive.fuel <= 0.02) { showHomeMessage("⛽ Not even fumes, hon — the tank is dry. The station on Main Street has pumps.", 3000); return; }
    if (Drive.elec.charge < 0.10) { showHomeMessage("🔋 Click… click… — the battery's flat, hon. She'll take a charge at the station (hold J by the pumps).", 3400); return; }
    // a cold flat-six-era engine has opinions about starting
    Drive.crankDies = false; Drive.crankMsg = "";
    const r = Math.random();
    if (Drive.elec.charge < 0.30 && r < 0.38) {
      Drive.crankDies = true;
      Drive.crankMsg = "That battery's too weak to turn her over — she needs a proper charge (hold J at the station).";
    }
    if (Drive.temp < 0.35 && !Drive.choke && r < (Drive.carb <= -1 ? 0.75 : 0.45)) {
      Drive.crankDies = true;
      Drive.crankMsg = "She's stone cold and won't catch — pull the choke (C) and try again.";
    } else if (Drive.choke && Drive.temp > 0.6 && Drive.carb >= 1.5 && r < 0.3) {
      Drive.crankDies = true;
      Drive.crankMsg = "Flooded her — choke in, wait a breath, try again.";
    }
    Drive.engine = "crank"; Drive.crankT = (Drive.crankDies ? 0.8 : 0.55) * (Drive.elec.charge < 0.30 ? 1.9 : 1); // a weak battery cranks slooow
    DriveAudio.ensure();
    if (Drive.tripFuel === null) Drive.tripFuel = Drive.fuel;
  } else if (Drive.engine === "on") {
    Drive.engine = "off";
  }
  drawGauges();
}
function cycleGear() {
  if (!Drive.active || Drive.engine === "crank") return;
  const order = ["P", "R", "N", "D"];
  const next = order[(order.indexOf(Drive.gear) + 1) % 4];
  if ((next === "R" || next === "P" || Drive.gear === "R") && Math.abs(Drive.speed) > 0.4) {
    showHomeMessage("Easy, hon — stop before shifting into " + next + ".", 1600);
    return;
  }
  Drive.gear = next;
  if (next === "D") Drive.auto = 1;
  showHomeMessage("Gear: " + ({ P: "P — Park", R: "R — Reverse", N: "N — Neutral", D: "D — Drive" })[next], 1200);
  drawGauges();
}
window.addEventListener("keydown", e => {
  if (view !== "home" || e.repeat) return;
  if (e.code === "KeyE") { if (Drive.active) exitCar(false); else if (!tryEnterCar()) doErrand(); }
  else if (e.code === "KeyR" && !Drive.active) startInstall();
  else if (Drive.active && e.code === "Enter") toggleIgnition();
  else if (Drive.active && e.code === "KeyG") cycleGear();
  else if (Drive.active && e.code === "KeyT") {
    Drive.trip = 0; Drive.tripFuel = Drive.fuel;
    showHomeMessage("Trip meter reset — MPG starts fresh.", 1300);
  }
  else if (Drive.active && e.code === "KeyC") {
    Drive.choke = !Drive.choke;
    showHomeMessage(Drive.choke ? "Choke OUT — richer mix for a cold engine. Push it in (C) once she's warm." : "Choke in.", 1800);
    drawGauges();
  }
  else if (Drive.active && e.code === "KeyV") {
    Drive.varThrottle = !Drive.varThrottle;
    prefs.set("belair_varthr", Drive.varThrottle ? "1" : "0");
    if (Drive.varThrottle) { Drive.mouseThrottle = 0; lockPointer(); }
    showHomeMessage(Drive.varThrottle
      ? "🖱 Variable throttle ON — push the mouse forward for gas, pull back to ease off. W still floors it."
      : "Variable throttle off — back to the W key.", 2600);
  }
  else if (Drive.active && e.code === "BracketLeft") adjustCarb(-0.5);
  else if (Drive.active && e.code === "BracketRight") adjustCarb(0.5);
  else if (Drive.active && e.code === "KeyL") {
    Drive.elec.lights = !Drive.elec.lights;
    showHomeMessage(Drive.elec.lights ? "💡 Headlights on." : "Headlights off.", 1200);
  }
  else if (Drive.active && e.code === "KeyZ") { Drive.sigL = !Drive.sigL; if (Drive.sigL) Drive.sigR = false; }
  else if (Drive.active && e.code === "KeyX") { Drive.sigR = !Drive.sigR; if (Drive.sigR) Drive.sigL = false; }
  else if (Drive.active && e.code === "KeyU") {
    Drive.wipers = !Drive.wipers;
    showHomeMessage(Drive.wipers ? "Wipers on — vacuum-powered, like everything in '53." : "Wipers off.", 1400);
  }
  else if (Drive.active && e.code === "KeyI") {
    const card = document.getElementById("wearCard");
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden") && Drive.gear === "P") Drive.hoodOpen = true;
  }
});
// ---- exhaust puffs from her tailpipe
const exhaustPool = [];
function spawnExhaust(dt) {
  const car = homeRefs.belAir;
  if (!car || !car.userData.tailpipe) return;
  Drive.exhaustT -= dt;
  if (Drive.exhaustT > 0) return;
  Drive.exhaustT = 0.16 - Drive.throttle * 0.08;
  let s = exhaustPool.find(p => !p.visible);
  if (!s) {
    if (exhaustPool.length > 42 || !homeScene) return;
    s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.soft, transparent: true, depthWrite: false }));
    s.userData.life = 0;
    homeScene.add(s); exhaustPool.push(s);
  }
  s.position.copy(car.localToWorld(car.userData.tailpipe.clone()));
  s.userData.life = 1;
  const rich = Drive.carb > 0.8 || Drive.choke;
  s.material.color.setHex(Drive.temp < 0.3 ? 0xe9e5db : rich ? 0x57534c : 0xb9bdc2);
  s.material.opacity = 0.3;
  s.scale.set(0.13, 0.13, 1);
  s.visible = true;
}
function tickExhaust(dt) {
  for (const s of exhaustPool) {
    if (!s.visible) continue;
    s.userData.life -= dt * 0.85;
    if (s.userData.life <= 0) { s.visible = false; continue; }
    s.position.y += dt * 0.34;
    s.position.x += dt * 0.10;
    const sc = s.scale.x + dt * 0.55;
    s.scale.set(sc, sc, 1);
    s.material.opacity = 0.3 * s.userData.life;
  }
}
function driveTick(t, dt) {
  const car = homeRefs.belAir;
  if (!car || view !== "home") return;
  const mom = homeRefs.mom;
  // the get-in prompt, when she's on foot near the car
  const promptEl = document.getElementById("carPrompt");
  if (promptEl) {
    const near = !Drive.active && mom && homeRefs.town &&
      Math.hypot(mom.position.x - car.position.x, mom.position.z - car.position.z) < 3.1;
    promptEl.classList.toggle("hidden", !near);
    if (near) {
      const pumps = homeRefs.gasPumps || [];
      const atPump = pumps.some(p => Math.hypot(p.x - car.position.x, p.z - car.position.z) < 3.4);
      promptEl.innerHTML = atPump && Drive.engine === "off"
        ? "⛽ Hold <b>F</b> — fill her up · <b>E</b> — get in"
        : "🚗 <b>E</b> — get in the Bel Air";
    }
  }
  const thKey = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
  const th = Drive.active ? (Drive.varThrottle ? Math.max(Drive.mouseThrottle, thKey) : thKey) : 0;
  Drive.throttle = th;
  const br = Drive.active && (keys.KeyS || keys.ArrowDown) ? 1 : 0;
  const stIn = Drive.active ? (((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0)) : 0;
  Drive.steer += clamp(stIn - Drive.steer, -dt * 3.4, dt * 3.4);
  if (!Drive.active) Drive.steer += clamp(0 - Drive.steer, -dt * 3.4, dt * 3.4);
  let targetRpm = 0;
  // ---- fill her up
  const pumps = homeRefs.gasPumps || [];
  const atPump = pumps.some(p => Math.hypot(p.x - car.position.x, p.z - car.position.z) < 3.4);
  if (atPump && Drive.engine === "off" && keys.KeyF && Drive.fuel < 16) {
    Drive.fuel = Math.min(16, Drive.fuel + 0.85 * dt);
    if (Drive.fuel >= 16 && t - Drive.fullMsgT > 5) {
      Drive.fullMsgT = t;
      showHomeMessage("⛽ Tank's full — 16 gallons. She's ready to roll.", 2600);
      saveCarPrefs();
    }
  }
  // ---- the station services her too (engine off, at the pumps)
  if (atPump && Drive.engine === "off") {
    if (keys.KeyJ) {
      Drive.elec.charge = clamp(Drive.elec.charge + dt * 0.20, 0, 1);
      if (Drive.elec.charge >= 1 && t - Drive.fullMsgT > 6) {
        Drive.fullMsgT = t;
        showHomeMessage("🔋 Battery's charged full — she'll start like a champ.", 2400);
        saveCarPrefs();
      }
    }
    const svc = keys.KeyO ? "oil" : (keys.KeyY ? "tune" : "");
    if (svc) {
      if (Drive.svcKind !== svc) { Drive.svcKind = svc; Drive.svcT = 0; if (svc === "oil") Drive.hoodOpen = true; }
      Drive.svcT += dt;
      if (Drive.svcT >= 2.5) {
        Drive.svcT = -30; // latched until the key comes up
        if (svc === "oil") {
          Drive.wear.oilMi = 0; Drive.hoodOpen = false;
          showHomeMessage("🛢 Oil changed — fresh oil, happy engine.", 2600);
        } else {
          Drive.carb = 0; Drive.foul = 0;
          Drive.wear.plugs = Math.min(1, Drive.wear.plugs + 0.55);
          showHomeMessage("🔧 Tune-up done — plugs cleaned, points set, carb back to factory spec.", 3000);
        }
        saveCarPrefs(); drawGauges();
      }
    } else { Drive.svcKind = ""; Drive.svcT = 0; }
    if (Drive.gear === "D" || Drive.gear === "R") Drive.hoodOpen = false; // rolling closes it — Neutral at the pumps doesn't
  }
  // ---- the engine
  if (Drive.engine === "crank") {
    Drive.crankT -= dt;
    Drive.rpm = 260 + Math.sin(t * 55) * 70;
    if (Drive.crankT <= 0) {
      if (Drive.crankDies) {
        Drive.engine = "off"; Drive.rpm = 0;
        showHomeMessage("💨 " + Drive.crankMsg, 3400);
      } else {
        Drive.engine = "on";
        if (Drive.temp < 0.3) Drive.wear.eng = Math.max(0.05, Drive.wear.eng - 0.0012); // every cold start costs a little
        if (Drive.tripFuel === null) Drive.tripFuel = Drive.fuel;
      }
      drawGauges();
    }
  } else if (Drive.engine === "on") {
    if (Drive.fuel <= 0) {
      Drive.engine = "off"; Drive.rpm = 0; Drive.lastGph = 0;
      showHomeMessage("⛽ She sputters… out of gas! Coast to a stop — the Main Street station has the pumps (park close, engine off, hold F).", 4600);
      drawGauges();
    } else {
      // consumption breathes with the carb tune, the choke,
      // and how cold the engine still is
      const carbBurn = 1 + Drive.carb * 0.15;
      const chokeBurn = Drive.choke ? 1.28 : 1;
      const tempBurn = 1 + (1 - Drive.temp) * 0.3;
      const gph = (0.32 + th * (0.55 + (Drive.rpm / 5800) * 3.4) + (Drive.gear === "N" ? th * 1.1 : 0)) * carbBurn * chokeBurn * tempBurn;
      Drive.lastGph = gph;
      Drive.fuel = Math.max(0, Drive.fuel - gph / 3600 * dt);
    }
  } else Drive.lastGph = 0;
  // engine temperature: warms with work, cools at rest
  if (Drive.engine === "on" || Drive.engine === "crank")
    Drive.temp += (1 - Drive.temp) * dt * (0.010 + (Drive.rpm / 5800) * 0.013);
  else
    Drive.temp += (0.12 - Drive.temp) * dt * 0.004;
  Drive.temp = clamp(Drive.temp, 0, 1);
  // choke left out on a warm engine fouls her plugs
  if (Drive.engine === "on") {
    if (Drive.choke && Drive.temp > 0.72) {
      Drive.foul += dt;
      if (Drive.foul > 18 && !Drive.foulMsg) {
        Drive.foulMsg = true;
        showHomeMessage("She's running rough — the choke's still out on a warm engine. Push it in (C).", 3200);
      }
    } else {
      Drive.foul = Math.max(0, Drive.foul - dt * 2.5);
      if (!Drive.choke) Drive.foulMsg = false;
    }
    // vibration walks the mixture screw over a long drive
    Drive.driftT -= dt;
    if (Drive.driftT <= 0 && Math.abs(Drive.speed) > 2) {
      Drive.driftT = 26 + Math.random() * 16;
      const step = Math.random() < 0.62 ? 0.5 : -0.5;
      const before = Drive.carb;
      Drive.carb = clamp(Drive.carb + step, -2, 2);
      if (Drive.carb !== before && Drive.active)
        showHomeMessage("🔧 The carb's drifted " + (Drive.carb > before ? "rich" : "lean") + " on the road — [ ] tunes her back when parked.", 2800);
    }
    // a lean carb makes her hesitate under throttle
    if (Drive.stumbleT > 0) Drive.stumbleT -= dt;
    else if (Drive.carb <= -1.5 && th > 0.6 && Math.random() < dt * 0.22) {
      Drive.stumbleT = 0.45;
      if (Drive.active && t - Drive.stumbleMsgT > 9) {
        Drive.stumbleMsgT = t;
        showHomeMessage("She hesitates — that lean carb is starving her.", 2000);
      }
    }
  }
  // ---- power, gears, motion
  if (Drive.engine === "on" && (Drive.gear === "D" || Drive.gear === "R")) {
    const dir = Drive.gear === "D" ? 1 : -1;
    const gi = Drive.gear === "D" ? Drive.auto : 1;
    const ratio = GEAR_RATIOS[gi - 1];
    if (Drive.shiftT > 0) Drive.shiftT -= dt;
    const powerMul = (1 + Drive.carb * 0.055) * (Drive.choke && Drive.temp > 0.7 ? 0.92 : 1) * (Drive.stumbleT > 0 ? 0.3 : 1)
      * (0.80 + 0.20 * Drive.wear.eng) * (0.90 + 0.10 * Drive.wear.plugs) * (oilHealth() < 0.3 ? 0.92 : 1); // wear and tear is real power loss
    const power = th * (Drive.shiftT > 0 ? 0.12 : 1) * ratio * 1.62 * (Drive.rpm > 500 ? 1 : 0.6) * powerMul;
    const drag = 0.0105 * Drive.speed * Math.abs(Drive.speed) + 0.13 * Math.sign(Drive.speed);
    let acc = power * dir - drag;
    if (br) acc -= Math.sign(Drive.speed) * brakePower();
    Drive.speed += acc * dt;
    const top = (Drive.gear === "D" ? GEAR_TOPS[gi - 1] : 8.5) + 1.5;
    if (dir > 0) Drive.speed = clamp(Drive.speed, -1.2, top);
    else Drive.speed = clamp(Drive.speed, -top, 1.2);
    if (th === 0 && Math.abs(Drive.speed) < 0.05 && br === 0) Drive.speed *= Math.max(0, 1 - dt * 2);
    targetRpm = clamp(790 + Math.abs(Drive.speed) / GEAR_TOPS[gi - 1] * 4250 + th * 240, 790, 5650);
    if (Drive.gear === "D" && Drive.shiftT <= 0) {
      // most shifts are smooth. Some — more when the carb is
      // out of tune or she's floored — land HARD.
      const hardChance = 0.18 + Math.max(0, Math.abs(Drive.carb) - 1) * 0.14 + (th > 0.85 ? 0.07 : 0);
      if (Drive.auto < 3 && Drive.rpm > 4350 && Drive.speed > 4) {
        const hard = Drive.nextHard || Math.random() < hardChance;
        Drive.nextHard = false;
        Drive.auto++; Drive.shifts++;
        Drive.wear.trn = Math.max(0.05, Drive.wear.trn - (hard ? 0.0035 : 0.0004)); // hard shifts eat the gearbox
        Drive.shiftT = hard ? 0.9 : 0.5;
        if (hard) {
          Drive.hardShifts++; Drive.jolt = 1; Drive.speed *= 0.965;
          if (Drive.active) showHomeMessage("💥 HARD shift — she CLUNKS into " + Drive.auto + (Drive.auto === 2 ? "nd" : "rd") + ".", 1300);
        } else if (Drive.active) {
          showHomeMessage("▲ She shifts into " + Drive.auto + (Drive.auto === 2 ? "nd" : "rd") + ".", 900);
        }
        drawGauges();
      } else if (Drive.auto > 1 && Drive.rpm < 1350 && Drive.speed > 0.5) {
        const hard = Drive.nextHard || Math.random() < hardChance * 0.7;
        Drive.nextHard = false;
        Drive.auto--; Drive.shifts++;
        Drive.wear.trn = Math.max(0.05, Drive.wear.trn - (hard ? 0.003 : 0.0004));
        Drive.shiftT = hard ? 0.8 : 0.4;
        if (hard) { Drive.hardShifts++; Drive.jolt = 0.8; Drive.speed *= 0.97; }
        drawGauges();
      }
    }
    moveCar(dt);
  } else {
    // no drive power: parking pawl, neutral coast, or a dead engine
    const hold = Drive.engine === "on" && Drive.gear === "P" ? 6.0 : 0.45;
    Drive.speed -= Math.sign(Drive.speed) * Math.min(Math.abs(Drive.speed), (hold + br * brakePower()) * dt);
    if (Drive.speed !== 0) moveCar(dt);
    if (Drive.engine === "on") targetRpm = 790 + th * (Drive.gear === "N" ? 4400 : 2100);
  }
  if (Drive.engine === "on") {
    // a fouled or stone-cold engine idles rough
    const rough = Drive.foul > 18 ? 1 : (Drive.temp < 0.3 && !Drive.choke ? 0.45 : 0);
    if (rough) targetRpm += (Math.sin(t * 23) + Math.sin(t * 41) * 0.6) * 85 * rough;
    const rate = targetRpm > Drive.rpm ? 2100 : 2800;
    Drive.rpm += clamp(targetRpm - Drive.rpm, -rate * dt, rate * dt);
  } else if (Drive.engine !== "crank") {
    Drive.rpm = Math.max(0, Drive.rpm - 950 * dt);
  }
  // ---- the 6-volt electrical system: amperage in and out
  {
    const E = Drive.elec;
    const sigLit = (Drive.sigPhase % 1) < 0.55;
    let amps = 0;
    if (Drive.engine === "crank") amps -= 175;                       // the starter drinks hard
    if (Drive.engine === "on") {
      amps += clamp((Drive.rpm - 850) / 5800, 0, 1) * 36 * (0.7 + 0.3 * Drive.wear.eng) * (0.5 + 0.5 * (Drive.wear.gen ?? 1)); // the generator gives back — less when it's worn
      amps -= 3.5;                                                   // ignition
    }
    if (E.lights) amps -= 9;
    if (Drive.hornOn) amps -= 6;
    if ((Drive.sigL || Drive.sigR) && sigLit) amps -= 3;
    E.amps = amps;
    const capAh = 95 * (0.45 + 0.55 * Drive.wear.bat);
    E.charge = clamp(E.charge + amps * dt / (3600 * capAh), 0, 1);
    E.volts = 5.3 + E.charge * 1.0 + (amps > 2 ? 0.55 : 0);
    if (E.charge < 0.18 && amps < -2) Drive.wear.bat = Math.max(0.05, Drive.wear.bat - dt * 0.0006); // deep drains scar her
    if (E.lights && Drive.engine === "off" && E.charge < 0.5 && t - Drive.lightsWarnT > 60) {
      Drive.lightsWarnT = t;
      if (Drive.active) showHomeMessage("💡 Lights on with the engine off — that'll flatten the battery, hon.", 2800);
    }
  }
  // ---- wear and tear accumulates
  if (Drive.engine === "on") {
    const W = Drive.wear;
    let er = 0.0000045;
    if (Drive.temp < 0.3) er *= 3.2;                 // cold oil doesn't protect
    if (Drive.rpm > 4800) er *= 3;                  // screaming her costs
    if (oilHealth() < 0.3) er *= 2.4;               // old oil, more metal on metal
    if (Drive.foul > 18) er *= 2;                   // running rough wears rough
    W.eng = Math.max(0.05, W.eng - er * dt);
    if (Drive.throttle > 0.7 && Drive.rpm < 1500 && Math.abs(Drive.speed) > 1)
      W.trn = Math.max(0.05, W.trn - dt * 0.00004); // lugging along in too high a gear
    if (Drive.carb > 1 || Drive.choke) W.plugs = Math.max(0.05, W.plugs - dt * 0.00008); // soot builds
  }
  if (br && Math.abs(Drive.speed) > 0.5) {
    Drive.wear.brk = Math.max(0.05, Drive.wear.brk - Math.abs(Drive.speed) * dt * 0.00012);
    if (Drive.wear.brk < 0.3 && Math.abs(Drive.speed) > 3 && Math.random() < dt * 0.25 && t - Drive.squealT > 12) {
      Drive.squealT = t;
      if (Drive.active) showHomeMessage("🎵 The brakes squeal — those pads are getting thin.", 2200);
    }
  }
  // ---- every car feature animates
  {
    const U = car.userData;
    if (Drive.doorHoldT > 0) { Drive.doorHoldT -= dt; if (Drive.doorHoldT <= 0) Drive.doorTarget = 0; }
    Drive.doorAng += clamp(Drive.doorTarget - Drive.doorAng, -dt * 2.4, dt * 2.4);
    if (U.doorL) U.doorL.rotation.y = Drive.doorAng * 1.85;
    if (Drive.active && Drive.gear !== "P") Drive.hoodOpen = false;
    const hoodT2 = Drive.hoodOpen ? -0.62 : 0;
    Drive.hoodAng += clamp(hoodT2 - Drive.hoodAng, -dt * 1.7, dt * 1.7);
    if (U.hood) U.hood.rotation.x = Drive.hoodAng;
    if (U.lever) {
      const lt = { P: -0.5, R: -0.17, N: 0.17, D: 0.5 }[Drive.gear];
      U.lever.rotation.x += clamp(lt - U.lever.rotation.x, -dt * 6, dt * 6);
    }
    Drive.sigPhase += dt * 1.7;
    const litNow = (Drive.sigPhase % 1) < 0.55;
    if (U.sigMatL) U.sigMatL.emissiveIntensity = Drive.sigL && litNow ? 2.6 : 0.1;
    if (U.sigMatR) U.sigMatR.emissiveIntensity = Drive.sigR && litNow ? 2.6 : 0.1;
    if ((Drive.sigL || Drive.sigR) && Drive.active) { // they cancel themselves after a turn
      if (Math.abs(Drive.steer) > 0.45) Drive.sigSteerT = 0;
      else { Drive.sigSteerT += dt; if (Drive.sigSteerT > 0.9 && Math.abs(Drive.speed) > 1) { Drive.sigL = false; Drive.sigR = false; } }
    }
    if (Drive.wipers && Drive.engine === "on")
      Drive.wipePhase += dt * (1.2 - Drive.throttle * 0.72) * 2.6; // vacuum wipers: lazy under throttle, busy at idle
    const wa = Drive.wipers && Drive.engine === "on" ? Math.sin(Drive.wipePhase) * 0.72 : 0;
    if (U.wiperL) { U.wiperL.rotation.z = wa; U.wiperR.rotation.z = wa; }
    const accEst = (Drive.speed - Drive.lastSpeed) / Math.max(dt, 0.001);
    Drive.lastSpeed = Drive.speed;
    const pitchT = clamp(-accEst * 0.005, -0.028, 0.032) + (Drive.jolt > 0 ? Math.sin(t * 61) * 0.005 * Drive.jolt : 0);
    const rollT = clamp(Drive.steer * clamp(Math.abs(Drive.speed) / 9, 0, 1) * 0.05, -0.05, 0.05);
    Drive.pitch += clamp(pitchT - Drive.pitch, -dt * 3, dt * 3);
    Drive.roll += clamp(rollT - Drive.roll, -dt * 3, dt * 3);
    if (U.bodyG) {
      U.bodyG.rotation.x = Drive.pitch;
      U.bodyG.rotation.z = Drive.roll;
      U.bodyG.position.y = Drive.engine === "on" ? Math.sin(t * 47) * 0.0016 * (0.4 + Drive.rpm / 5800) : 0;
    }
    if (U.lampM) U.lampM.emissiveIntensity = Drive.elec.lights ? 2.6 : 0.5;
    if (U.spot) U.spot.intensity = Drive.elec.lights ? 1.7 : 0;
    if (U.beamM) U.beamM.opacity = Drive.elec.lights ? 0.12 : 0;
    if (Drive.engine === "on") spawnExhaust(dt);
    tickExhaust(dt);
    const horn = Drive.active && !!keys.KeyH;
    if (horn !== Drive.hornOn) { Drive.hornOn = horn; DriveAudio.ensure(); DriveAudio.hornSet(horn); }
    // the '56 shell wears the same state on its own parts
    if (U.shell) {
      if (U.shDoorDriver) U.shDoorDriver.rotation.y = Drive.doorAng * 1.85 * (Drive.shDoorSign || 1);
      if (U.shHood) U.shHood.rotation.x = Drive.hoodAng * (Drive.shHoodSign || 1);
      if (U.shSteer) U.shSteer.rotation.z = -Drive.steer * 1.9 * (U.shSteerSign || 1);
      const sm = U.shMats;
      if (sm) {
        sm.sigDriver.forEach(m => m.emissiveIntensity = Drive.sigL && litNow ? 2.6 : 0.1);
        sm.sigPass.forEach(m => m.emissiveIntensity = Drive.sigR && litNow ? 2.6 : 0.1);
        sm.tail.forEach(m => m.emissiveIntensity = Drive.elec.lights ? 1.8 : 0.25);
        sm.head.forEach(m => m.emissiveIntensity = Drive.elec.lights ? 2.2 : 0.3);
      }
    }
  }
  // ---- dress the machine: wheels, steering wheel, sound
  const spin = Drive.speed * dt / 0.35;
  if (car.userData.wheels) car.userData.wheels.forEach((w, i) => {
    w.rotation.x += spin;
    if (i < 2) w.rotation.y = Drive.steer * 0.42;
  });
  if (car.userData.steerWheel) car.userData.steerWheel.rotation.z = -Drive.steer * 1.9;
  DriveAudio.update();
  // ---- the driver view
  if (Drive.active && mom) {
    mom.position.set(car.position.x, 0, car.position.z);
    const eye = car.localToWorld(new THREE.Vector3(-0.42, 1.17, 0.02));
    eye.y += Math.sin(t * 31) * 0.0016 * (Drive.engine === "on" ? (0.5 + Drive.rpm / 5800) : 0);
    if (Drive.jolt > 0) { // a hard shift kicks the whole car
      Drive.jolt = Math.max(0, Drive.jolt - dt * 2.0);
      eye.y += Math.sin(t * 66) * 0.014 * Drive.jolt;
      eye.x += Math.cos(t * 57) * 0.009 * Drive.jolt;
    }
    camera.position.copy(eye);
    const look = car.localToWorld(new THREE.Vector3(-0.42 - Drive.steer * 1.6, 1.13 + Math.tan(fpPitch) * 5, 7));
    camera.lookAt(look);
  }
  // ---- HUD + gauges, a few times a second
  Drive.hudT -= dt;
  if (Drive.hudT <= 0) {
    Drive.hudT = 0.12;
    if (Drive.active) {
      drawGauges();
      const $ = id => document.getElementById(id);
      $("dhSpeed").textContent = Math.round(Math.abs(Drive.speed) * 2.23694);
      $("dhGear").textContent = Drive.gear === "D" ? "D" + Drive.auto : Drive.gear;
      $("dhRpm").style.width = clamp(Drive.rpm / 5800 * 100, 0, 100) + "%";
      $("dhFuel").style.width = clamp(Drive.fuel / 16 * 100, 0, 100) + "%";
      $("dhGal").textContent = Drive.fuel.toFixed(1) + " gal";
      const mpg = tripMpg();
      $("dhMpg").textContent = mpg ? mpg.toFixed(1) : "—";
      $("dhTrip").textContent = Drive.trip.toFixed(1) + " mi";
      $("dhOdo").textContent = Drive.odo.toFixed(1) + " mi";
      $("dhCarb").textContent = carbLabel();
      $("dhWear").textContent = wearGrade(Math.min(Drive.wear.eng, Drive.wear.trn, Drive.wear.brk, Drive.wear.tir, Drive.wear.bat));
      const wc = document.getElementById("wearCard");
      if (wc && !wc.classList.contains("hidden")) {
        for (const [id, v] of [["wcEng", Drive.wear.eng], ["wcTrn", Drive.wear.trn], ["wcBrk", Drive.wear.brk], ["wcTir", Drive.wear.tir], ["wcBat", Drive.wear.bat], ["wcPlu", Drive.wear.plugs], ["wcGen", Drive.wear.gen ?? 1]]) {
          const b = document.getElementById(id + "B"), tx = document.getElementById(id);
          if (b) b.style.width = Math.round(v * 100) + "%";
          if (tx) tx.textContent = wearGrade(v) + " · " + Math.round(v * 100) + "%";
        }
        $("wcParts").textContent = partsShelfLine();
        $("wcOil").textContent = "Oil: " + Math.round(oilHealth() * 100) + "% life · " + Math.round(Drive.wear.oilMi) + " mi since her last change";
        $("wcElec").textContent = "Battery: " + Drive.elec.volts.toFixed(1) + " V · " + (Drive.elec.amps >= 0 ? "+" : "") + Drive.elec.amps.toFixed(0) + " A · charge " + Math.round(Drive.elec.charge * 100) + "% · " + (Drive.elec.lights ? "lights ON" : "lights off");
      }
      $("dhChoke").textContent = Drive.choke ? "CHOKE" : "";
      $("dhTemp").style.width = clamp(Drive.temp * 100, 0, 100) + "%";
      $("dhThr").style.width = clamp(Drive.throttle * 100, 0, 100) + "%";
      $("dhPrompt").textContent =
        Drive.engine === "off" ? (atPump ? "F — fuel · O — oil · Y — tune-up · J — charge · ENTER — start · E — step out" : "ENTER — start the engine · C — choke · [ ] — tune carb (in P) · E — step out") :
        Drive.gear === "P" ? "G — shift into gear (P → R → N → D) · [ ] — tune carb · C — choke" :
        "W — gas · S — brake · A/D — steer · G — gear · C — choke · T — trip · E — step out (stopped)";
      if (Drive.varThrottle && Drive.engine === "on")
        $("dhPrompt").textContent = "🖱 Mouse throttle " + Math.round(Drive.mouseThrottle * 100) + "% — push forward = gas · S — brake · A/D — steer · C — choke · V — mouse off";
    }
  }
  Drive.saveT -= dt;
  if (Drive.saveT <= 0) { Drive.saveT = 2.5; saveCarPrefs(); }
}

function enterHome() {
  view = "home";
  if (!homeScene) buildHome();
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("winScreen").classList.add("hidden");
  document.getElementById("homeHud").classList.remove("hidden");
  refreshHomeBar();
  fpYaw = fpov ? Math.PI - 0.38 : -0.38; // FPOV starts facing her room
  fpPitch = -0.04;
  applyFpov();
  updateHomeHelp();
  WombAudio.start();
  WombAudio.heartbeatLevel = 0.45;
  if (musicOn) lullaby.play().catch(() => { });
  showHomeMessage(homeOpt.dwelling === 1
    ? "Her city apartment — dusk over the skyline, and someone small on the way. 🏢"
    : "Her suburban house — sun in the yard, picket fence, and someone small on the way. 🏠", 4600);
}
function exitHome() {
  view = "womb";
  if (typeof Drive !== "undefined" && Drive.active) {
    Drive.active = false;
    Drive.engine = "off";
    document.getElementById("driveHud").classList.add("hidden");
    document.getElementById("carPrompt").classList.add("hidden");
    if (homeRefs.mom) homeRefs.mom.visible = true;
    if (homeRefs.momHeart) homeRefs.momHeart.visible = true;
    saveCarPrefs();
  }
  document.getElementById("homeHud").classList.add("hidden");
  document.getElementById("needsCard").classList.add("hidden");
  document.getElementById("needPrompt").classList.add("hidden");
  document.getElementById("partsCard").classList.add("hidden");
  document.getElementById("partPrompt").classList.add("hidden");
  document.getElementById("homePanel").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  lullaby.pause();
  refreshMenu();
}
function refreshHomeBar() {
  document.getElementById("homeTitle").textContent =
    (homeOpt.dwelling === 1 ? "🏢 Her Home — City Apartment" : "🏠 Her Home — Suburban House");
  document.getElementById("homeDwellBtn").textContent =
    homeOpt.dwelling === 1 ? "🏠 Move to the house" : "🏢 Move to the apartment";
  document.querySelectorAll("#homePanel .hpRow").forEach(row => {
    const key = row.dataset.key;
    row.querySelectorAll("button").forEach(b =>
      b.classList.toggle("sel", parseInt(b.dataset.v, 10) === homeOpt[key]));
  });
  document.querySelectorAll("#homePanel .hpDwell button").forEach(b =>
    b.classList.toggle("sel", parseInt(b.dataset.v, 10) === homeOpt.dwelling));
}
let homeMsgTimer = null;
function showHomeMessage(text, ms) {
  const m = document.getElementById("homeMessage");
  m.textContent = text;
  m.classList.remove("hidden");
  if (homeMsgTimer) clearTimeout(homeMsgTimer);
  homeMsgTimer = setTimeout(() => m.classList.add("hidden"), ms || 4000);
}
function setHomeOpt(key, v) {
  homeOpt[key] = v;
  prefs.set("homeopts", homeOpt);
  buildHome();
  refreshHomeBar();
}
function syncHome(t, dt) {
  // mom breathes; her heart floats by the bump
  if (homeRefs.townTick) homeRefs.townTick(t, dt);
  driveTick(t, dt);
  zoneTick();
  needsTick(dt);
  partsTick(dt);
  if (Drive.active) return; // the Bel Air owns the camera now
  if (homeRefs.rigPose) homeRefs.rigPose(t);
  if (homeRefs.mom) {
    homeRefs.mom.scale.y = 1 + Math.sin(t * 1.15) * 0.006;
    homeRefs.mom.rotation.z = Math.sin(t * 0.4) * 0.008;
  }
  if (homeRefs.momHeart) {
    const s = 0.3 * (1 + 0.16 * Math.sin(t * 2.3)) * (1 + (homeRefs.kickPulse || 0) * 0.8);
    homeRefs.momHeart.scale.set(s, s, 1);
  }
  if (homeRefs.lampLight) homeRefs.lampLight.intensity = 0.92 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 17.7) * 0.02;
  if (homeRefs.screen) homeRefs.screen.emissiveIntensity = 0.48 + Math.sin(t * 11.3) * 0.05;
  if (homeRefs.faceCam && homeRefs.momHead) { // debug close-up of her face
    const hd = homeRefs.momHead, d = homeRefs.momFaceDir;
    camera.position.set(hd.x + d.x * 0.55, hd.y + 0.05, hd.z + d.z * 0.55);
    camera.lookAt(hd.x, hd.y - 0.01, hd.z);
    return;
  }
  if (fpov && homeRefs.mom) { // through her eyes — she walks, you look
    const mom = homeRefs.mom;
    Input.poll();
    if (Input.turn) fpYaw += Input.turn * 1.5 * dt;
    const mx = Input.moveX, mz = Input.moveZ;
    if (mx || mz) {
      const l = Math.hypot(mx, mz), sp = 1.45 * needSpeed() * dt / l;
      const sy = Math.sin(fpYaw), cy = Math.cos(fpYaw);
      const ox = mom.position.x, oz = mom.position.z;
      let nx = ox + (sy * mz - cy * mx) * sp;
      let nz = oz + (cy * mz + sy * mx) * sp;
      if (homeRefs.solids) {
        // the town: solid walls, fences, houses and her car,
        // resolved one axis at a time so she slides along them
        const R = 0.32;
        const hitS = (x, z) => homeRefs.solids.some(s => solidLive(s) && x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R);
        if (hitS(nx, oz)) nx = ox;
        if (hitS(ox, nz)) nz = oz;
        if (hitS(nx, nz)) { nx = ox; nz = oz; }
        mom.position.x = clamp(nx, -45, 45);
        mom.position.z = clamp(nz, -32, 58);
      } else {
        mom.position.x = clamp(nx, -5.0, 5.0);
        mom.position.z = clamp(nz, -3.5, 3.5);
      }
      for (const ob of [[-3.35, -0.55, 1.15], [3.55, -0.55, 0.85]]) { // sofa, TV
        const dx = mom.position.x - ob[0], dz = mom.position.z - ob[1];
        const d = Math.hypot(dx, dz);
        if (d < ob[2] && d > 0.001) {
          mom.position.x = ob[0] + dx / d * ob[2];
          mom.position.z = ob[1] + dz / d * ob[2];
        }
      }
      fpBob += dt * 7.5;
    }
    mom.rotation.y = fpYaw;
    mom.updateMatrixWorld(true);
    const eye = mom.localToWorld(new THREE.Vector3(0, 1.617, 0.02));
    camera.position.set(eye.x, eye.y + Math.sin(fpBob) * 0.011, eye.z);
    camera.lookAt(
      eye.x + Math.sin(fpYaw) * Math.cos(fpPitch),
      camera.position.y + Math.sin(fpPitch),
      eye.z + Math.cos(fpYaw) * Math.cos(fpPitch));
    return;
  }
  const momOut = homeRefs.mom && (Math.abs(homeRefs.mom.position.x) > 5.5 || Math.abs(homeRefs.mom.position.z) > 4);
  const target = momOut
    ? new THREE.Vector3(homeRefs.mom.position.x, 1.02, homeRefs.mom.position.z)
    : new THREE.Vector3(0.3, 1.02, -1.3);
  const az = homeCam.az + Math.sin(t * 0.05) * 0.03;
  const r = 5.3;
  camera.position.set(
    target.x + Math.sin(az) * Math.sin(homeCam.pol) * r,
    target.y + Math.cos(homeCam.pol) * r * 0.55 + 0.3,
    target.z + Math.cos(az) * Math.sin(homeCam.pol) * r);
  camera.lookAt(target);
}

// ------------------------------------------------------------ home wiring
(function buildHomePanel() {
  const rows = document.getElementById("homePanelRows");
  const dwell = document.createElement("div");
  dwell.className = "hpDwell";
  dwell.innerHTML = `<button data-v="0">🏠 Suburban House</button><button data-v="1">🏢 City Apartment</button>`;
  dwell.querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => {
      setHomeOpt("dwelling", parseInt(b.dataset.v, 10));
      showHomeMessage(homeOpt.dwelling === 1 ? "Moved in — city apartment life. 🏢" : "Moved in — the suburban house. 🏠", 2600);
    }));
  rows.appendChild(dwell);
  const wkRow = document.createElement("div");
  wkRow.className = "hpRow";
  wkRow.innerHTML = `<h3>🤰 Her week — the bump grows with it</h3>`;
  const wkBtns = document.createElement("div");
  wkBtns.className = "hpBtns";
  const wkMinus = document.createElement("button");
  wkMinus.textContent = "− Week";
  const wkLabel = document.createElement("button");
  wkLabel.disabled = true;
  const wkPlus = document.createElement("button");
  wkPlus.textContent = "+ Week";
  const updWk = () => { wkLabel.textContent = "Week " + momWeeks + " · baby is " + weekSizeName(momWeeks); };
  wkMinus.addEventListener("click", () => { setWeeks(momWeeks - 1); updWk(); });
  wkPlus.addEventListener("click", () => { setWeeks(momWeeks + 1); updWk(); });
  wkBtns.appendChild(wkMinus); wkBtns.appendChild(wkLabel); wkBtns.appendChild(wkPlus);
  wkRow.appendChild(wkBtns);
  rows.appendChild(wkRow);
  updWk();
  const labels = { wall: "Wallpaper", floor: "Floor", sofa: "Sofa", curtains: "Curtains", rug: "Rug", tv: "TV / Radio", decor: "On the wall", lamp: "Lamp", plant: "Plant" };
  for (const key of Object.keys(HOME_SETS)) {
    const row = document.createElement("div");
    row.className = "hpRow";
    row.dataset.key = key;
    row.innerHTML = `<h3>${labels[key]}</h3>`;
    const btns = document.createElement("div");
    btns.className = "hpBtns";
    HOME_SETS[key].forEach((name, i) => {
      const b = document.createElement("button");
      b.textContent = name;
      b.dataset.v = i;
      b.addEventListener("click", () => setHomeOpt(key, i));
      btns.appendChild(b);
    });
    row.appendChild(btns);
    rows.appendChild(row);
  }
})();
document.getElementById("homeExitBtn").addEventListener("click", exitHome);
document.getElementById("fpovBtn").addEventListener("click", () => setFpov(!fpov));
document.getElementById("gestureBtn").addEventListener("click", () => setGestures(Gesture.state !== "live"));
document.getElementById("homeDecorBtn").addEventListener("click", () => {
  document.getElementById("homePanel").classList.remove("hidden");
  refreshHomeBar();
});
document.getElementById("hpDone").addEventListener("click", () =>
  document.getElementById("homePanel").classList.add("hidden"));
document.getElementById("homeDwellBtn").addEventListener("click", () => {
  setHomeOpt("dwelling", homeOpt.dwelling === 1 ? 0 : 1);
  showHomeMessage(homeOpt.dwelling === 1 ? "Her city apartment — dusk over the skyline. 🏢" : "Her suburban house — sun in the yard. 🏠", 3000);
});
document.getElementById("homeShuffleBtn").addEventListener("click", () => {
  for (const key of Object.keys(HOME_SETS))
    homeOpt[key] = Math.floor(Math.random() * HOME_SETS[key].length);
  prefs.set("homeopts", homeOpt);
  buildHome();
  refreshHomeBar();
  showHomeMessage("🎲 A whole new room — same mom, same bump.", 2800);
});
// drag to look around her room
(function homeDragLook() {
  const cv = document.getElementById("gl");
  cv.addEventListener("mousedown", e => {
    if (view === "home") homeDrag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mousemove", e => {
    if (!homeDrag || view !== "home") return;
    if (fpov) {
      fpYaw -= (e.clientX - homeDrag.x) * 0.0042;
      fpPitch = clamp(fpPitch - (e.clientY - homeDrag.y) * 0.0032, -1.25, 1.25);
    } else {
      homeCam.az = clamp(homeCam.az - (e.clientX - homeDrag.x) * 0.0035, -0.95, 0.95);
      homeCam.pol = clamp(homeCam.pol - (e.clientY - homeDrag.y) * 0.0022, 1.02, 1.52);
    }
    homeDrag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mouseup", () => { homeDrag = null; });
})();
Object.assign(window.WOMB, { enterHome, exitHome, view: () => view, homeOpt: () => homeOpt,
  setHomeOpt: (k, v) => setHomeOpt(k, v),
  setWeeks: n => setWeeks(n),
  townFacts: () => ({ town: !!homeRefs.town, doors: homeRefs.doors ? homeRefs.doors.length : 0, solids: homeRefs.solids ? homeRefs.solids.length : 0, belAir: !!homeRefs.belAir, traffic: homeRefs.traffic ? homeRefs.traffic.length : 0 }),
  doorState: () => homeRefs.doors ? homeRefs.doors.map(d => +d.ang.toFixed(2)) : [],
  driveFacts: () => ({ active: Drive.active, engine: Drive.engine, gear: Drive.gear, auto: Drive.auto, mph: +(Math.abs(Drive.speed) * 2.23694).toFixed(1), rpm: Math.round(Drive.rpm), fuel: +Drive.fuel.toFixed(3), trip: +Drive.trip.toFixed(3), mpg: tripMpg() ? +tripMpg().toFixed(1) : null, carPos: homeRefs.belAir ? [+homeRefs.belAir.position.x.toFixed(1), +homeRefs.belAir.position.z.toFixed(1)] : null, carb: Drive.carb, choke: Drive.choke, temp: +Drive.temp.toFixed(2), throttle: +Drive.throttle.toFixed(2), gph: +Drive.lastGph.toFixed(2), shifts: Drive.shifts, hardShifts: Drive.hardShifts, varThrottle: Drive.varThrottle, mouseThrottle: +Drive.mouseThrottle.toFixed(2),
    amps: +Drive.elec.amps.toFixed(1), volts: +Drive.elec.volts.toFixed(2), charge: +Drive.elec.charge.toFixed(3), lights: Drive.elec.lights,
    wear: { eng: +Drive.wear.eng.toFixed(3), trn: +Drive.wear.trn.toFixed(3), brk: +Drive.wear.brk.toFixed(3), tir: +Drive.wear.tir.toFixed(3), bat: +Drive.wear.bat.toFixed(3), plugs: +Drive.wear.plugs.toFixed(3), gen: +(Drive.wear.gen ?? 1).toFixed(3), oilMi: Math.round(Drive.wear.oilMi) },
    doorAng: +Drive.doorAng.toFixed(2), hoodAng: +Drive.hoodAng.toFixed(2), sigL: Drive.sigL, sigR: Drive.sigR, wipers: Drive.wipers,
    leverX: homeRefs.belAir && homeRefs.belAir.userData.lever ? +homeRefs.belAir.userData.lever.rotation.x.toFixed(2) : null,
    bodyPitch: +Drive.pitch.toFixed(4), bodyY: homeRefs.belAir && homeRefs.belAir.userData.bodyG ? +homeRefs.belAir.userData.bodyG.position.y.toFixed(4) : null,
    wipeZ: homeRefs.belAir && homeRefs.belAir.userData.wiperL ? +homeRefs.belAir.userData.wiperL.rotation.z.toFixed(2) : null,
    sigIL: homeRefs.belAir && homeRefs.belAir.userData.sigMatL ? +homeRefs.belAir.userData.sigMatL.emissiveIntensity.toFixed(1) : null,
    beamO: homeRefs.belAir && homeRefs.belAir.userData.beamM ? +homeRefs.belAir.userData.beamM.opacity.toFixed(2) : null }),
  carbSet: v => { Drive.carb = clamp(v, -2, 2); },
  chokeSet: b => { Drive.choke = !!b; },
  tempSet: v => { Drive.temp = clamp(v, 0, 1); },
  varSet: b => { Drive.varThrottle = !!b; },
  speedSet: v => { Drive.speed = v; },
  mouseThr: v => { Drive.mouseThrottle = clamp(v, 0, 1); },
  forceHard: () => { Drive.nextHard = true; },
  lightsSet: b => { Drive.elec.lights = !!b; },
  chargeSet: v => { Drive.elec.charge = clamp(v, 0, 1); },
  sigSet: (side, b) => { if (side === "L") Drive.sigL = !!b; else Drive.sigR = !!b; },
  wiperSet: b => { Drive.wipers = !!b; },
  hoodSet: b => { Drive.hoodOpen = !!b; },
  wearSet: (k, v) => { if (k in Drive.wear) Drive.wear[k] = clamp(v, 0.05, 1); if (k === "oilMi") Drive.wear.oilMi = Math.max(0, v); },
  doorOpen: () => { Drive.doorTarget = 1; Drive.doorHoldT = 30; },
  enterCar: () => { tryEnterCar(); return Drive.active; },
  exitCar: () => { exitCar(true); return Drive.active; },
  ignite: () => { toggleIgnition(); return Drive.engine; },
  killEngine: () => { Drive.engine = "off"; Drive.rpm = 0; },
  trafficCalm: (on) => { Drive.trafficCalm = !!on; },
  shellFacts: () => { const U = homeRefs.belAir ? homeRefs.belAir.userData : {}; return { on: !!Drive.shellOn, doorSign: Drive.shDoorSign || 1, hoodSign: Drive.shHoodSign || 1, mats: U.shMats ? { sigD: U.shMats.sigDriver.length, sigP: U.shMats.sigPass.length, tail: U.shMats.tail.length, head: U.shMats.head.length } : null, steer: !!U.shSteer, hood: !!U.shHood }; },
  shSign: (d, h) => { if (d) Drive.shDoorSign = d; if (h) Drive.shHoodSign = h; },
  satsumaOn: () => !!Drive.satsumaOn,
  zoneFacts: () => ({ active: Zone.active, lotKids: homeRefs.lotG ? homeRefs.lotG.children.length : 0, townKids: homeRefs.townG ? homeRefs.townG.children.length : 0, lotVis: homeRefs.lotG ? homeRefs.lotG.visible : null, townVis: homeRefs.townG ? homeRefs.townG.visible : null }),
  forceZone: (z) => { Zone.active = z; applyZone(); },
  needsFacts: () => ({ hunger: Needs.hunger, thirst: Needs.thirst, rest: Needs.rest, comfort: Needs.comfort, stock: Needs.stock, worst: needsWorst(), speed: needSpeed() }),
  needsSet: (k, v) => { if (k in Needs) Needs[k] = v; },
  errandId: () => { const e = errandHere(); return e ? e.id : null; },
  doErrand: () => doErrand(),
  partsFacts: () => ({ shelf: Object.assign({}, Parts.shelf), mail: Object.assign({}, Parts.mail), installing: Parts.installing ? Parts.installing.id : null, mailReady: mailReady(), shelfLine: partsShelfLine() }),
  contentFacts: () => ({ mailbox: !!homeRefs.grokMailbox, tickers: (homeRefs.contentTickers || []).length }),
  partsOrder: (id) => orderPart(id),
  partsDeliver: () => { for (const k in Parts.mail) Parts.mail[k] = 0; },
  partsCollect: () => collectMail(),
  partsInstall: () => startInstall(),
  partsCardOpen: () => !document.getElementById("partsCard").classList.contains("hidden"),
  gearUp: () => { cycleGear(); return Drive.gear; },
  setFuel: g => { Drive.fuel = clamp(g, 0, 16); Drive.tripFuel = null; },
  carPlace: (x, z, h) => { const car = homeRefs.belAir; if (car) { car.position.set(x, 0.02, z); car.rotation.y = h || 0; Drive.heading = car.rotation.y; Drive.speed = 0; updateBelAirSolid(); } return !!car; },
  modelFacts: () => ({ bust: homeRefs.bustMeshes ? homeRefs.bustMeshes.length : 0, bump: bumpFactor(), weeks: momWeeks }),
  mirrorLive: () => !!(homeRefs.mirror && mirrorRT),
  handBumpDist: () => {
    if (!homeRefs.bellyMesh || !homeRefs.handGroups) return 99;
    const bp = new THREE.Vector3();
    homeRefs.bellyMesh.getWorldPosition(bp);
    let best = 99;
    for (const h of homeRefs.handGroups) {
      const hp = new THREE.Vector3();
      h.getWorldPosition(hp);
      best = Math.min(best, hp.distanceTo(bp) - 0.19);
    }
    return +best.toFixed(3);
  },
  setFaceCam: b => { if (homeRefs) homeRefs.faceCam = !!b; },
  setFpov: b => setFpov(b),
  fpLook: (yaw, pitch) => { fpYaw = yaw; fpPitch = pitch; },
  momPlace: (x, z) => { if (homeRefs.mom) { homeRefs.mom.position.x = x; homeRefs.mom.position.z = z; } },
  isolateHands: () => {
    if (!homeRefs.mom) return "no mom";
    homeRefs.mom.traverse(o => { if (o.isMesh || o.isSprite) o.visible = false; });
    (homeRefs.handGroups || []).forEach(h => h.traverse(o => { if (o.isMesh) o.visible = true; }));
    const palms = (homeRefs.handGroups || []).map(h => {
      const p = new THREE.Vector3();
      h.children[0].getWorldPosition(p);
      return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
    });
    return JSON.stringify(palms);
  },
  handNDC: () => {
    if (!homeRefs.handGroups || !camera) return null;
    return homeRefs.handGroups.map(h => {
      const p = new THREE.Vector3();
      h.getWorldPosition(p);
      p.project(camera);
      return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
    });
  },
  setGestures: b => setGestures(b),
  gestureState: () => Gesture.state,
  gestureSim: zone => {
    Gesture.zones = { left: 0, right: 0, top: 0, bottom: 0 };
    if (zone in Gesture.zones) Gesture.zones[zone] = 1;
    Gesture.applyMapping();
    return { turn: Input.gesture.turn, walk: Input.gesture.walk };
  },
  inputState: () => ({ moveX: Input.moveX, moveZ: Input.moveZ, turn: Input.turn, gesture: Gesture.state }),
  fpovState: () => {
    let camDist = null;
    if (homeRefs.mom && camera) {
      homeRefs.mom.updateMatrixWorld(true);
      const eye = homeRefs.mom.localToWorld(new THREE.Vector3(0, 1.617, 0.02));
      camDist = +camera.position.distanceTo(eye).toFixed(3);
    }
    return { on: fpov, yaw: fpYaw, pitch: fpPitch, camDist,
      headHidden: homeRefs.momHeadMesh ? !homeRefs.momHeadMesh.visible : null,
      momPos: homeRefs.mom ? [+homeRefs.mom.position.x.toFixed(2), +homeRefs.mom.position.z.toFixed(2)] : null };
  },
  homeOrbit: (az, pol) => { homeCam.az = az; if (pol) homeCam.pol = pol; },
  momTurn: rad => { if (homeRefs.mom) homeRefs.mom.rotation.y = rad; },
  momRig: () => homeRefs.rig ? { bones: homeRefs.rig.bones.length } : null,
  // her model's true data weight: geometry buffers + each unique
  // texture measured as PNG bytes (the glTF-style accounting)
  momAssetStats: () => {
    if (!homeRefs.mom) return null;
    let tris = 0, verts = 0, geoBytes = 0, texBytes = 0;
    const seen = new Set();
    homeRefs.mom.traverse(o => {
      if (o.geometry) {
        const g = o.geometry;
        if (g.attributes.position) verts += g.attributes.position.count;
        for (const k in g.attributes) geoBytes += g.attributes[k].array.byteLength;
        if (g.index) geoBytes += g.index.array.byteLength;
        tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3;
      }
      if (o.material) {
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (m.map && !seen.has(m.map)) {
            seen.add(m.map);
            const img = m.map.image;
            if (img && img.toDataURL) {
              try { texBytes += Math.floor(img.toDataURL("image/png").length * 0.75); } catch (e) { }
            }
          }
        }
      }
    });
    const total = texBytes + geoBytes;
    return { tris: Math.round(tris), verts, geoMB: +(geoBytes / 1048576).toFixed(3),
      texMB: +(texBytes / 1048576).toFixed(2), totalMB: +(total / 1048576).toFixed(2) };
  },
  momFaceTex: () => homeRefs.faceTex ? homeRefs.faceTex.image.width : 0, version: "0.8.0" });
