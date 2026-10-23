// AeonWomb PC probe: the Bel Air's full vehicle simulation —
// 6V electrics/amperage, wear and tear, station services, and
// an animation check on every car feature. Poll-based only:
// SwiftShader runs the town at a crawl of sim-time.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
const CHROME = "/opt/meta-chromium/chrome";
const ROOT = new URL("..", import.meta.url).pathname;
const FILES = {
  "http://womb.test/": ["index.html", "text/html"],
  "http://womb.test/index.html": ["index.html", "text/html"],
  "http://womb.test/style.css": ["style.css", "text/css"],
  "http://womb.test/game.js": ["game.js", "text/javascript"],
  "http://womb.test/assets/wall_texture.png": ["assets/wall_texture.png", "image/png"],
  "http://womb.test/assets/placenta_texture.png": ["assets/placenta_texture.png", "image/png"],
  "http://womb.test/assets/baby_skin.png": ["assets/baby_skin.png", "image/png"],
  "http://womb.test/assets/lullaby.wav": ["assets/lullaby.wav", "audio/wav"],
  "http://womb.test/vendor/three.min.js": ["vendor/three.min.js", "text/javascript"]
};
const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio", "--window-size=1280,720",
  "--remote-debugging-port=9346", "--user-data-dir=/tmp/womb-car2-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9346/json");
    const j = await r.json();
    ws = j.find(t => t.type === "page")?.webSocketDebuggerUrl;
  } catch { await sleep(400); }
}
const sock = new WebSocket(ws);
await new Promise(r => sock.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
sock.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Fetch.requestPaused") {
    const { requestId, request } = m.params;
    const hit = FILES[request.url];
    if (hit) {
      const body = readFileSync(ROOT + hit[0]);
      send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: hit[1] }], body: body.toString("base64") });
    } else send("Fetch.fulfillRequest", { requestId, responseCode: 404, body: "" });
  }
});
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
}
const errors = [];
sock.addEventListener("message", ev => {
  const m = JSON.parse(ev.data);
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + (m.params.args?.[0]?.value || ""));
});
await send("Page.enable"); await send("Runtime.enable"); await send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
await send("Page.navigate", { url: "http://womb.test/" });
await sleep(6000);
async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
  return r.result?.result?.value;
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(ROOT + "shots/" + name, Buffer.from(r.result.data, "base64"));
}
async function key(code, down) {
  await send("Input.dispatchKeyEvent", { type: down ? "keyDown" : "keyUp", code, key: code.replace("Key", "").toLowerCase(), windowsVirtualKeyCode: 0 });
}
const facts = () => evalJs("window.WOMB && WOMB.driveFacts()");
async function poll(fn, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(1500); }
  console.log("POLL TIMEOUT:", label);
  return null;
}
const results = [];
const check = (name, ok, extra) => { results.push([name, !!ok]); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); };

await evalJs("localStorage.clear(); location.reload();");
const booted = await poll(() => evalJs("typeof window.WOMB !== 'undefined'"), 90000, "WOMB boot after reload");
if (!booted) { console.log("BOOT FAILED; page errors:", errors.slice(0, 3).join(" | ")); try { proc.kill(); } catch { } process.exit(1); }
await evalJs("WOMB.setGfx('budget')"); // systems don't care about shadows; the software GPU does
await evalJs("WOMB.enterHome()");
await sleep(3000);
await evalJs("WOMB.momPlace(-3.2, 12.5)");
await sleep(600);
check("enter car", await evalJs("WOMB.enterCar()") === true);
await sleep(400);
// ---- flat battery gate
await evalJs("WOMB.chargeSet(0.05)");
await evalJs("WOMB.ignite()");
await sleep(1200);
let f = await facts();
check("flat battery refuses to crank", f.engine === "off", "engine=" + f.engine + " charge=" + f.charge);
// ---- cold lean starts fail without the choke
await evalJs("WOMB.chargeSet(0.95); WOMB.carbSet(-2); WOMB.tempSet(0.15); WOMB.chokeSet(false);");
let died = 0;
for (let i = 0; i < 14 && died < 2; i++) {
  await evalJs("WOMB.chargeSet(0.95); WOMB.tempSet(0.15); WOMB.carbSet(-2); WOMB.chokeSet(false); WOMB.ignite();");
  const done = await poll(async () => { const x = await facts(); return x.engine !== "crank" ? x : null; }, 30000, "crank settle " + i);
  if (done && done.engine === "on") { await evalJs("WOMB.ignite();"); await sleep(700); } // a lucky catch: shut her off, freeze her again, keep counting
  else died++;
}
check("cold lean no-choke starts fail", died >= 2, "died=" + died + " of up to 14 tries");
// ---- choke fixes the cold start (engine OFF first, then choke + crank)
if ((await facts()).engine === "on") { await evalJs("WOMB.ignite();"); await sleep(800); }
await evalJs("WOMB.chargeSet(0.95); WOMB.chokeSet(true); WOMB.ignite();");
const on = await poll(async () => { const x = await facts(); return x.engine === "on" ? x : null; }, 40000, "choke start");
check("choke starts her cold", !!on, on ? "temp=" + on.temp : "");
// ---- amperage: generator charges at revs, ignition draws
await evalJs("WOMB.tempSet(1); WOMB.chokeSet(false); WOMB.gearUp();"); // P->R
await sleep(400);
await evalJs("WOMB.gearUp();"); // R->N
await sleep(400);
await evalJs("WOMB.varSet(true); WOMB.mouseThr(0.95);");
const rev = await poll(async () => { const x = await facts(); return x.rpm > 3000 ? x : null; }, 60000, "neutral revs");
check("generator makes real amps at revs", rev && rev.amps > 4, rev ? "amps=" + rev.amps + " volts=" + rev.volts + " rpm=" + rev.rpm : "no rev");
// ---- gph follows the carb (rich burns ~30% more) — compare
// samples at MATCHED rpm, because the live rpm never sits still
async function gphAtRpm() {
  const samples = [];
  for (let i = 0; i < 10; i++) { const x = await facts(); if (x.gph > 0) samples.push([x.rpm, x.gph]); await sleep(1600); }
  return samples;
}
const s0 = await gphAtRpm();
await evalJs("WOMB.carbSet(2);");
await sleep(1500);
const s2 = await gphAtRpm();
let matched = null;
for (const [r0, g0] of s0) for (const [r2, g2] of s2)
  if (Math.abs(r0 - r2) < 120) { matched = [g0, g2, r0]; break; }
if (!matched && s0.length && s2.length) matched = [s0[s0.length - 1][1], s2[s2.length - 1][1], s0[s0.length - 1][0]];
check("rich carb burns ~30% more", !!matched && matched[1] > matched[0] * 1.15 && matched[1] < matched[0] * 1.5,
  matched ? "gph " + matched[0] + " -> " + matched[1] + " @~" + matched[2] + " rpm" : "no samples");
await evalJs("WOMB.carbSet(0); WOMB.mouseThr(0);");
// ---- headlight drain shows on the ammeter
if ((await facts()).engine === "on") { await evalJs("WOMB.ignite();"); }
await poll(async () => { const x = await facts(); return x.engine === "off" ? x : null; }, 30000, "engine off for amps");
await evalJs("WOMB.lightsSet(true);");
await sleep(1500);
f = await facts();
check("headlights draw ~9 A, engine off", f.amps < -7 && f.amps > -12, "amps=" + f.amps);
check("light beams fade in", f.beamO > 0.05, "beam opacity=" + f.beamO);
// ---- station battery charge service (hold J at the pumps)
await evalJs("WOMB.lightsSet(false); WOMB.carPlace(-25.6, 30.8, 0); WOMB.chargeSet(0.30);");
await poll(async () => { const x = await facts(); return x.engine === "off" ? x : null; }, 30000, "engine off at pumps");
await sleep(600);
await key("KeyJ", true);
const chg = await poll(async () => { const x = await facts(); return x.charge > 0.45 ? x : null; }, 90000, "station charge");
await key("KeyJ", false);
check("station charges the battery (hold J)", !!chg, chg ? "charge=" + chg.charge : "");
// ---- wear reads back and bites
await evalJs("WOMB.wearSet('eng', 0.42); WOMB.wearSet('oilMi', 2900);");
f = await facts();
check("wear state round-trips", Math.abs(f.wear.eng - 0.42) < 0.03 && f.wear.oilMi === 2900, JSON.stringify(f.wear));
// ---- animations: door, hood, lever, wipers, signals
await evalJs("WOMB.exitCar();");
await sleep(400);
await evalJs("WOMB.doorOpen();");
const dang = await poll(async () => { const x = await facts(); return x.doorAng > 0.75 ? x : null; }, 20000, "door swing");
check("car door swings open", !!dang, dang ? "doorAng=" + dang.doorAng : "");
await evalJs("WOMB.hoodSet(true);");
const hang = await poll(async () => { const x = await facts(); return x.hoodAng < -0.5 ? x : null; }, 20000, "hood lift");
check("hood lifts for a look at the engine", !!hang, hang ? "hoodAng=" + hang.hoodAng : "");
await evalJs("WOMB.momPlace(-24.3, 30.8);");
await sleep(500);
const reentered = await evalJs("WOMB.enterCar()");
check("re-enter car at the station", reentered === true);
await evalJs("WOMB.chargeSet(0.95); WOMB.tempSet(1); WOMB.ignite();");
await poll(async () => { const x = await facts(); return x.engine === "on" ? x : null; }, 40000, "restart");
for (let i = 0; i < 4; i++) { // walk the lever to D from wherever it sits
  if ((await facts()).gear === "D") break;
  await evalJs("WOMB.gearUp();");
  await sleep(350);
}
await sleep(800);
f = await facts();
check("column lever swings to D", Math.abs(f.leverX - 0.5) < 0.16, "leverX=" + f.leverX);
await evalJs("WOMB.sigSet('L', true);");
const sig = await poll(async () => { const x = await facts(); return x.sigIL > 1.5 ? x : null; }, 20000, "signal blink");
check("turn signal blinks", !!sig, sig ? "sigI=" + sig.sigIL : "");
await evalJs("WOMB.wiperSet(true);");
let wipeMoved = false, w0 = null;
for (let i = 0; i < 14 && !wipeMoved; i++) {
  const x = await facts();
  if (w0 === null) w0 = x.wipeZ;
  else if (Math.abs(x.wipeZ - w0) > 0.25) wipeMoved = true;
  await sleep(1200);
}
check("vacuum wipers sweep", wipeMoved, "wipeZ0=" + w0);
await shot("probe-car2-cockpit.png");
console.log("PAGE ERRORS:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
console.log(results.every(r => r[1]) && errors.length === 0 ? "CAR2 ALL PASS" : "CAR2 FAILURES PRESENT");
try { proc.kill(); } catch { }
process.exit(0);
