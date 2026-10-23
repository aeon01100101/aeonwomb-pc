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
  "--remote-debugging-port=9341", "--user-data-dir=/tmp/womb-town-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9341/json");
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
console.log("town facts:", JSON.stringify(await ev(`WOMB.townFacts()`)));
await ev(`WOMB.setGfx('budget'); WOMB.enterHome(); WOMB.setFpov(false); 'ok'`);
await sleep(1500);
console.log("town facts (in home):", JSON.stringify(await ev(`WOMB.townFacts()`)));
await shot("probe-town-room.png");
// out the FRONT door, on foot
await ev(`WOMB.setFpov(true); WOMB.momPlace(1.2, 3.15); WOMB.fpLook(0, -0.02); 'ok'`);
await sleep(700);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))`);
await sleep(8000);
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))`);
await sleep(500);
console.log("after front door, momPos:", JSON.stringify((await ev(`WOMB.fpovState()`)).momPos), "doors:", JSON.stringify(await ev(`WOMB.doorState()`)));
await ev(`WOMB.fpLook(2.6, -0.05); 'ok'`);
await sleep(700);
await shot("probe-town-street.png");
// out the BACK door into the yard
await ev(`WOMB.momPlace(-2.9, -3.1); WOMB.fpLook(Math.PI, -0.02); 'ok'`);
await sleep(600);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))`);
await sleep(7000);
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))`);
await sleep(500);
console.log("after back door, momPos:", JSON.stringify((await ev(`WOMB.fpovState()`)).momPos));
await ev(`WOMB.fpLook(Math.PI + 0.7, 0.02); 'ok'`);
await sleep(700);
await shot("probe-town-yard.png");
// third person by her car
await ev(`WOMB.setFpov(false); WOMB.momPlace(-1.6, 10.5); 'ok'`);
await sleep(1200);
await shot("probe-town-belair.png");

// ---- Charles City tour (third person, she stands at each spot)
await ev(`WOMB.setFpov(false); WOMB.momPlace(-4, 24); 'ok'`);
await sleep(1300);
await shot("probe-cc-mainstreet.png");
await ev(`WOMB.momPlace(28, 31); 'ok'`);
await sleep(1300);
await shot("probe-cc-courthouse.png");
await ev(`WOMB.momPlace(-19, 25.5); 'ok'`);
await sleep(1300);
await shot("probe-cc-gas.png");
await ev(`WOMB.momPlace(0, 47.5); 'ok'`);
await sleep(1300);
await shot("probe-cc-river.png");
await ev(`WOMB.momPlace(16.5, -19.5); 'ok'`);
await sleep(1300);
await shot("probe-cc-railroad.png");
await ev(`WOMB.momPlace(-24, 36); 'ok'`);
await sleep(1300);
await shot("probe-cc-tower.png");
console.log("tour done. townFacts:", JSON.stringify(await ev(`WOMB.townFacts()`)));

proc.kill();
process.exit(0);

