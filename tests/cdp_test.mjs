// Real-browser play test for Aeon Womb PC: drives the game in headless
// Chromium (SwiftShader WebGL) over CDP. The page is served from a fake
// public origin whose requests are fulfilled from disk — no packet ever
// leaves the browser. Any uncaught page exception or console error fails
// the run. Screenshots land in ../shots/.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9337, PAGE_URL = 'http://womb.test/';
const WEBROOT = new URL('../', import.meta.url).pathname;
const SHOTS = path.join(WEBROOT, 'shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=' + PORT, '--window-size=1280,800',
  '--user-data-dir=/tmp/womb-cdp-profile', 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
const problems = [];
const fails = [];
function check(label, ok) { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) fails.push(label); }
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function waitFor(expr, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evalJs(expr).catch(() => false)) return true;
    await sleep(400);
  }
  throw new Error('timeout waiting: ' + label);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const f = path.join(SHOTS, name);
  fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
  console.log('screenshot:', name, fs.statSync(f).size, 'bytes');
}
const key = (code, down) => evalJs(
  `window.dispatchEvent(new KeyboardEvent('${down ? 'keydown' : 'keyup'}', {code: '${code}'})); 'ok'`);

try {
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json`); targets = await r.json(); } catch { await sleep(500); }
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).res(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push('CONSOLE ERROR: ' + JSON.stringify(m.params.args).slice(0, 200));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      // the harness deliberately 404s oversized pack files (see the
      // Fetch handler); the game treats that as "pack not installed",
      // so those resource logs are not page errors.
      if (!(m.params.entry.url || '').includes('/packs/')) problems.push('LOG ERROR: ' + m.params.entry.text);
    }
    if (m.method === 'Fetch.requestPaused') {
      const u = new URL(m.params.request.url);
      let rel = decodeURIComponent(u.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(WEBROOT, rel);
      const rid = m.params.requestId;
      if (u.pathname === '/favicon.ico') {
        ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: '' } }));
        return;
      }
      if (!file.startsWith(WEBROOT) || !fs.existsSync(file) || fs.statSync(file).size > 40_000_000) {
        // oversized pack files (the 133 MB Satsuma) would wedge the
        // CDP pipe as one giant base64 message; the game treats a
        // 404 as "pack not installed" and falls back — packs have
        // their own probes.
        ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId: rid, responseCode: 404, body: '' } }));
      } else {
        const body = fs.readFileSync(file).toString('base64');
        const type = MIME[path.extname(file)] || 'application/octet-stream';
        ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: type }], body } }));
      }
    }
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://womb.test/*', requestStage: 'Request' }] });
  await send('Page.navigate', { url: PAGE_URL });
  await waitFor(`typeof THREE !== 'undefined' && !!window.WOMB`, 20000, 'game booted');
  // fresh slate: the shared test profile persists localStorage between
  // runs, and prefs (dwelling, graphics era…) must start at defaults
  await evalJs(`localStorage.clear(); 'ok'`);
  await send('Page.navigate', { url: PAGE_URL });
  await waitFor(`typeof THREE !== 'undefined' && !!window.WOMB`, 20000, 'game rebooted fresh');
  await sleep(3500); // textures + backdrop orbit frames
  await shot('01-title.png');
  check('title screen visible', await evalJs(`!document.querySelector('#startScreen').classList.contains('hidden')`));

  // ---- Mom mode: her home in 3D (both dwellings + decorate panel)
  await evalJs(`document.querySelector('#modeRow button[data-mode="2"]').click(); document.querySelector('#enterBtn').click(); 'ok'`);
  await waitFor(`WOMB.view() === 'home'`, 10000, 'home view');
  await sleep(3000);
  check('home: suburban house shown', await evalJs(`document.querySelector('#homeTitle').textContent.includes('Suburban')`));
  await shot('00-home-suburban.png');
  await evalJs(`document.querySelector('#homeDwellBtn').click(); 'ok'`);
  await sleep(2500);
  check('home: apartment switch works', await evalJs(`document.querySelector('#homeTitle').textContent.includes('Apartment')`));
  await shot('00b-home-apartment.png');
  await evalJs(`document.querySelector('#homeDecorBtn').click(); 'ok'`);
  await sleep(700);
  check('home: decorate panel opens', await evalJs(`!document.querySelector('#homePanel').classList.contains('hidden')`));
  await shot('00c-home-decorate.png');
  await evalJs(`document.querySelector('#hpDone').click(); 'ok'`);
  // FPOV mama mode: through her eyes, she walks — then gestures
  await evalJs(`WOMB.setFpov(true)`);
  await sleep(600);
  const fp1 = await evalJs(`WOMB.fpovState()`);
  check('FPOV: through her eyes (head hidden, camera at her head)',
    !!fp1 && fp1.on && fp1.headHidden && fp1.camDist < 0.35);
  const beforePos = fp1.momPos;
  await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))`);
  // hold W and poll: under SwiftShader the frame rate wanders,
  // so the assertion is distance-covered, not distance-per-2s
  let walked = 0;
  for (let i = 0; i < 16 && walked <= 0.15; i++) {
    await sleep(500);
    const fpN = await evalJs(`WOMB.fpovState()`);
    if (beforePos && fpN.momPos) walked = Math.hypot(fpN.momPos[0] - beforePos[0], fpN.momPos[1] - beforePos[1]);
  }
  await evalJs(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))`);
  check('FPOV: W walks her (' + walked.toFixed(2) + ' m)', walked > 0.15);
  await shot('00e-fpov', 900);
  await evalJs(`WOMB.fpLook(WOMB.fpovState().yaw, -0.95)`);
  await shot('00f-fpov-bump', 900);
  // gesture support: no-camera handled gracefully + the zone
  // mapping drives the same Input the keyboard uses
  await evalJs(`WOMB.setGestures(true)`);
  await sleep(700);
  const gstate = await evalJs(`WOMB.gestureState()`);
  check('gesture mode handles this machine gracefully (' + gstate + ')',
    gstate === 'live' || gstate === 'denied' || gstate === 'unsupported');
  const sim = await evalJs(`WOMB.gestureSim('right')`);
  check('gesture zone -> Input turn (' + (sim && sim.turn) + ')', !!sim && Math.abs(sim.turn) > 0.3);
  await evalJs(`WOMB.setGestures(false)`);
  await evalJs(`WOMB.setFpov(false)`);
  check('third person restores her head', await evalJs(`WOMB.fpovState().headHidden === false`));
  // ---- v0.4.1: her hands on the bump + a working mirror
  await evalJs(`WOMB.setHomeOpt('decor', 2)`);
  await sleep(1600);
  check('starburst mirror is a live reflection', await evalJs(`WOMB.mirrorLive() === true`));
  check('both hands rest on the bump (surface dist ' + await evalJs(`WOMB.handBumpDist()`) + ')',
    await evalJs(`WOMB.handBumpDist() < 0.12`));
  await evalJs(`WOMB.setFpov(true); WOMB.momPlace(-1.9, -2.35); WOMB.fpLook(-2.42, 0.24); 'ok'`);
  await sleep(900);
  await shot('00g-mirror.png');
  await evalJs(`WOMB.momPlace(1.25, -0.85); WOMB.setFpov(false); 'ok'`);
  // ---- v0.4.2: her chest, and a bump that grows with the weeks
  check('she has a modeled, rigged chest', await evalJs(`WOMB.modelFacts().bust === 2`));
  await evalJs(`WOMB.setWeeks(40)`);
  const bump40 = await evalJs(`WOMB.modelFacts().bump`);
  await evalJs(`WOMB.setWeeks(8)`);
  const bump8 = await evalJs(`WOMB.modelFacts().bump`);
  check('her bump grows with the weeks (' + bump8 + ' -> ' + bump40 + ')', bump40 > bump8 * 1.3);
  check('hands stay on the bump at week 40', await evalJs(`WOMB.setWeeks(40); WOMB.handBumpDist() < 0.16`));
  await evalJs(`WOMB.setWeeks(24); 'ok'`);

  // KH1-detail pass: her face, up close — and her model's data weight
  check('mom face texture painted at 2048', await evalJs(`WOMB.momFaceTex() === 2048`));
  const momStats = await evalJs(`WOMB.momAssetStats()`);
  console.log('mom model stats:', JSON.stringify(momStats));
  check('mom model data in the 1-4 MB band (' + (momStats && momStats.totalMB) + ' MB)',
    !!momStats && momStats.totalMB >= 1 && momStats.totalMB <= 4);
  check('mom model has at least 6,000 vertices (' + (momStats && momStats.verts) + ')',
    !!momStats && momStats.verts >= 6000);
  const momRig = await evalJs(`WOMB.momRig()`);
  console.log('mom rig:', JSON.stringify(momRig));
  check('mom rig has exactly 182 bones (180 + her chest)', !!momRig && momRig.bones === 182);
  await evalJs(`WOMB.setFaceCam(true); 'ok'`);
  await sleep(1400);
  await shot('00d-mom-face.png');
  await evalJs(`WOMB.setFaceCam(false); document.querySelector('#homeExitBtn').click(); 'ok'`);
  await sleep(700);
  check('home: exit returns to title', await evalJs(
    `WOMB.view() === 'womb' && !document.querySelector('#startScreen').classList.contains('hidden')`));

  // ---- the town + the Bel Air (v0.5.0): Charles City, driving,
  // fuel, gears, electrics. Runs in Budget era on purpose (software
  // GPU) after a fresh light rebuild of the town.
  await evalJs(`WOMB.setGfx('budget'); WOMB.setHomeOpt('dwelling', 0); WOMB.enterHome(); WOMB.trafficCalm(true); 'ok'`);
  await waitFor(`WOMB.townFacts().town === true`, 30000, 'town builds');
  const tf = await evalJs(`WOMB.townFacts()`);
  check('town: Charles City stands (doors ' + tf.doors + ', solids ' + tf.solids + ', traffic ' + tf.traffic + ')',
    tf.doors === 3 && tf.solids >= 41 && tf.belAir === true && tf.traffic === 2);
  const carAt = await evalJs(`WOMB.driveFacts().carPos`);
  await evalJs(`WOMB.momPlace(${carAt[0] + 1.6}, ${carAt[1]}); 'ok'`);
  await sleep(600);
  check('car: she gets in', await evalJs(`WOMB.enterCar()`) === true);
  await evalJs(`WOMB.chargeSet(0.05); WOMB.ignite(); 'ok'`);
  await sleep(1200);
  check('car: a flat battery refuses to crank', await evalJs(`WOMB.driveFacts().engine`) === 'off');
  await evalJs(`WOMB.chargeSet(0.95); WOMB.tempSet(1); WOMB.chokeSet(false); WOMB.carbSet(0); WOMB.ignite(); 'ok'`);
  await waitFor(`WOMB.driveFacts().engine === 'on'`, 60000, 'engine starts');
  check('car: engine starts on a charged battery', true);
  const fuel0 = await evalJs(`WOMB.driveFacts().fuel`);
  await evalJs(`WOMB.gearUp(); WOMB.gearUp(); WOMB.gearUp(); WOMB.varSet(true); WOMB.mouseThr(1); 'ok'`);
  await waitFor(`WOMB.driveFacts().gear === 'D'`, 15000, 'gear D');
  await waitFor(`WOMB.driveFacts().mph > 5`, 90000, 'she rolls');
  check('car: mouse throttle moves her', true);
  await waitFor(`WOMB.driveFacts().auto >= 2`, 150000, 'autobox shifts');
  const cruise = await evalJs(`WOMB.driveFacts()`);
  check('car: the Powerglide shifts itself (auto ' + cruise.auto + ' at ' + cruise.mph + ' mph)', cruise.auto >= 2);
  check('car: the generator outruns the draw at cruise (' + cruise.amps + ' A)', cruise.amps > 2);
  check('car: driving drinks fuel (' + fuel0 + ' -> ' + cruise.fuel + ' gal)', cruise.fuel < fuel0);
  await evalJs(`WOMB.mouseThr(0); WOMB.exitCar(); WOMB.carPlace(-25.6, 30.8, 0); WOMB.killEngine(); WOMB.setFuel(2.5); 'ok'`);
  await sleep(500);
  await evalJs(`WOMB.momPlace(-24.3, 30.8); 'ok'`);
  await sleep(500);
  await evalJs(`WOMB.enterCar(); 'ok'`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyF', key: 'f' });
  await waitFor(`WOMB.driveFacts().fuel > 3.1`, 90000, 'refuel rises');
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyF', key: 'f' });
  check('car: she refuels at the Main Street pumps', true);
  await evalJs(`WOMB.exitCar(); WOMB.exitHome(); WOMB.setGfx('kh3'); 'ok'`);
  await waitFor(`WOMB.view() === 'womb' && WOMB.gfxMode() === 'kh3' && !document.querySelector('#startScreen').classList.contains('hidden')`, 30000, 'title + KH3 restored');
  check('car: back to title, KH3 restored', true);

  // ---- explorer mode
  await evalJs(`WOMB.setMode(0); document.querySelector('#enterBtn').click(); 'clicked'`);
  await waitFor(`!document.querySelector('#hud').classList.contains('hidden')`, 10000, 'HUD visible');
  await sleep(2500);
  await shot('02-spawn.png');
  const spawn = await evalJs(`({x: WOMB.world.playerX, z: WOMB.world.playerZ, r: WOMB.world.radius, bubbles: WOMB.world.bubbles.length})`);
  console.log('spawn:', JSON.stringify(spawn));
  check('explorer world sane (radius 18, 6 bubbles)', spawn.r === 18 && spawn.bubbles === 6);

  // ---- graphics: KH3 -> Ouch Budget. Gameplay asserts run in Budget
  // mode on purpose: this sandbox renders with a SOFTWARE GPU
  // (SwiftShader); Budget is the mode built for weak hardware. On a
  // real PC GPU every mode runs at full speed.
  await evalJs(`document.querySelector('#gfxBtn').click(); 'ok'`);
  await sleep(1200);
  const prBudget = await evalJs(`WOMB.renderer().getPixelRatio()`);
  check('Ouch Budget mode engages (mode=' + await evalJs(`WOMB.gfxMode()`) + ', pixelRatio=' + prBudget + ')',
    prBudget <= 0.81);
  await shot('02b-budget.png');
  const fps = await evalJs(`new Promise((res) => { let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); };
    requestAnimationFrame(f); })`);
  console.log('budget-mode fps under SwiftShader:', fps);

  // ---- swim forward on real frames (the sim clamps dt to 50 ms,
  // exactly like the Java original)
  const wt0 = await evalJs(`WOMB.world.worldTime`);
  await key('KeyW', true);
  await sleep(7000);
  await key('KeyW', false);
  const wt1 = await evalJs(`WOMB.world.worldTime`);
  const moved = await evalJs(`Math.hypot(WOMB.world.playerX - ${spawn.x}, WOMB.world.playerZ - ${spawn.z})`);
  console.log('distance swum:', moved.toFixed(2), '| sim seconds in 7 wall seconds:', (wt1 - wt0).toFixed(2));
  // judge by swim SPEED (units per sim second): SwiftShader frame rates
  // vary run to run, but the sim's physics rate must not
  const swimRate = moved / Math.max(wt1 - wt0, 0.01);
  check('W swims the player forward (' + swimRate.toFixed(2) + ' u/sim-s)', moved > 0.5 && swimRate > 1.2);
  await shot('03-swam.png');

  // ---- collect a bubble by swimming onto it
  await evalJs(`(() => { const w = WOMB.world; const b = w.bubbles.find(x => !x.collected);
    w.playerX = b.curX + 0.4; w.playerZ = b.curZ; w.velX = 0; w.velZ = 0; return true; })()`);
  await waitFor(`WOMB.world.collectedCount >= 1`, 8000, 'bubble collects');
  const got = await evalJs(`WOMB.world.collectedCount`);
  check('bubble collects on contact (count=' + got + ')', got >= 1);
  await shot('04-bubble.png');

  // ---- the retro eras, visual checks
  await evalJs(`document.querySelector('#gfxBtn').click(); 'ok'`); // -> ps2
  await sleep(1200);
  check('Early 2K (PS2) mode engages', await evalJs(`WOMB.gfxMode()`) === 'ps2');
  await shot('02c-ps2.png');
  await evalJs(`document.querySelector('#gfxBtn').click(); 'ok'`); // -> ps1
  await sleep(1200);
  const ps1ok = await evalJs(`WOMB.gfxMode()`) === 'ps1';
  const pix = await evalJs(`document.querySelector('#gl').style.imageRendering`);
  check('Early 90s (PS1) mode engages + pixelated upscale (' + pix + ')', ps1ok && pix === 'pixelated');
  await shot('02d-ps1.png');
  await evalJs(`document.querySelector('#gfxBtn').click(); 'ok'`); // -> kh3
  await sleep(900);
  check('KH3 mode restores', await evalJs(`WOMB.gfxMode()`) === 'kh3');

  // ---- VRChat-style Quick Menu: Tab opens it, the world pauses,
  // an era tile switches graphics from inside it, Resume closes it.
  await key('Tab', true); await key('Tab', false);
  await sleep(500);
  check('Quick Menu opens on Tab', await evalJs(
    `!document.querySelector('#quickMenu').classList.contains('hidden') && WOMB.qmOpen()`));
  const frozenT = await evalJs(`WOMB.world.worldTime`);
  await sleep(1000);
  const frozenT2 = await evalJs(`WOMB.world.worldTime`);
  check('world pauses while the Quick Menu is up', Math.abs(frozenT2 - frozenT) < 0.001);
  await shot('06-quickmenu.png');
  await evalJs(`document.querySelector('#qmGfxTiles button[data-g="ps1"]').click(); 'ok'`);
  await sleep(700);
  check('era tile inside Quick Menu switches graphics', await evalJs(`WOMB.gfxMode()`) === 'ps1');
  await evalJs(`document.querySelector('#qmResume').click(); 'ok'`);
  await sleep(400);
  check('Resume closes the Quick Menu', await evalJs(
    `document.querySelector('#quickMenu').classList.contains('hidden') && !WOMB.qmOpen()`));
  await evalJs(`WOMB.setGfx('kh3'); 'ok'`);
  await sleep(600);

  // ---- fetus mode
  await evalJs(`WOMB.quitToMenu(); WOMB.setMode(1); document.querySelector('#enterBtn').click(); 'ok'`);
  await waitFor(`WOMB.world.fetusMode === true`, 10000, 'fetus mode world');
  await sleep(2000);
  check('fetus: belly + kick UI shown', await evalJs(
    `!document.querySelector('#belly').classList.contains('hidden') && !document.querySelector('#kickUi').classList.contains('hidden')`));
  await shot('05-fetus.png');
  await evalJs(`WOMB.doKick(); 'ok'`);
  await sleep(400);
  const kicks = await evalJs(`WOMB.world.yourKicks`);
  check('fetus: KICK registers (kicks=' + kicks + ')', kicks >= 1);

  // ---- frames really pump (time-boxed: SwiftShader manages ~0.5 fps in
  // KH3 fetus mode, so count frames in 20 s instead of demanding 60)
  const frames = await evalJs(`new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 20000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })`);
  check('render loop pumps frames (' + frames + ' in 20s)', frames >= 3);

  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'NO PAGE ERRORS');
  if (problems.length) fails.push('page errors');
  console.log(fails.length ? 'RESULT: FAIL (' + fails.join('; ') + ')' : 'RESULT: ALL PASS');
  process.exitCode = fails.length ? 1 : 0;
} catch (e) {
  console.log('TEST FAILED:', e.message);
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : '(no page errors captured)');
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
}
