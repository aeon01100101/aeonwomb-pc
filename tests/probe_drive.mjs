// Fast visual probe for the KH1-detail mom: room wide shot + face close-up.
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
  "--remote-debugging-port=9343", "--user-data-dir=/tmp/womb-drive-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9343/json");
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
    send("Fetch.fulfillRequest", {
      requestId, responseCode: hit ? 200 : 404,
      responseHeaders: hit ? [{ name: "Content-Type", value: hit[1] }] : [],
      body: hit ? readFileSync(ROOT + hit[0]).toString("base64") : ""
    }).catch(() => { });
  }
  if (m.method === "Runtime.exceptionThrown")
    console.log("EXCEPTION:", (m.params.exceptionDetails.exception?.description || "").split("\n")[0]);
});
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
}
const ev = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
const shot = async name => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(ROOT + "shots/" + name, Buffer.from(r.result.data, "base64"));
  console.log("shot:", name);
};
await send("Page.enable"); await send("Runtime.enable");
await send("Fetch.enable", { patterns: [{ urlPattern: "http://womb.test/*" }] });
await send("Page.navigate", { url: "http://womb.test/" });
await sleep(5000);
const until = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return true; await sleep(700); } return false; };
await ev(`WOMB.setGfx('budget'); WOMB.enterHome(); WOMB.setFpov(true); 'ok'`);
await sleep(1200);
const cp = (await ev(`WOMB.driveFacts()`)).carPos;
console.log("car is at:", JSON.stringify(cp));
await ev(`WOMB.momPlace(${cp[0] + 2.2}, ${cp[1]}); 'ok'`);
await sleep(400);
console.log("enterCar:", await ev(`WOMB.enterCar()`));
await shot("probe-drive-dash-off.png");
await ev(`WOMB.ignite(); 'ok'`);
console.log("engine on:", await until(`WOMB.driveFacts().engine === 'on'`, 30000));
await ev(`WOMB.gearUp(); WOMB.gearUp(); WOMB.gearUp(); 'ok'`);
await sleep(300);
console.log("gear:", (await ev(`WOMB.driveFacts()`)).gear);
const fuel0 = (await ev(`WOMB.driveFacts()`)).fuel;
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))`);
console.log("moving >10mph:", await until(`WOMB.driveFacts().mph > 10`, 40000));
console.log("shifted to 2nd:", await until(`WOMB.driveFacts().auto >= 2`, 90000));
const mid = await ev(`WOMB.driveFacts()`);
console.log("driving:", JSON.stringify(mid));
await shot("probe-drive-road.png");
await sleep(5000);
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))`);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }))`);
console.log("stopped:", await until(`WOMB.driveFacts().mph < 0.5`, 20000));
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }))`);
const stopped = await ev(`WOMB.driveFacts()`);
console.log("after drive:", JSON.stringify(stopped), "fuel used:", (fuel0 - stopped.fuel).toFixed(4));
await ev(`WOMB.setFuel(3); WOMB.carPlace(-25.5, 29.2, Math.PI); WOMB.ignite(); 'ok'`);
await sleep(600);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))`);
console.log("refuel >5 gal:", await until(`WOMB.driveFacts().fuel > 5`, 40000));
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }))`);
console.log("after fill:", JSON.stringify(await ev(`WOMB.driveFacts()`)));
console.log("exitCar active?:", await ev(`WOMB.exitCar()`), "momPos:", JSON.stringify((await ev(`WOMB.fpovState()`)).momPos));
proc.kill();
process.exit(0);
