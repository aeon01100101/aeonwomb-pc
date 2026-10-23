// Dev probe (not shipped): FPOV mom mode — through her eyes.
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
  "--remote-debugging-port=9337", "--user-data-dir=/tmp/womb-fpov-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9337/json");
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
await ev(`WOMB.enterHome(); 'ok'`);
await sleep(2500);
console.log("fpov state:", JSON.stringify(await ev(`WOMB.fpovState()`)));
await shot("probe-fpov-forward.png");
await ev(`WOMB.fpLook(Math.PI - 0.38, -0.95); 'ok'`);
await sleep(900);
await shot("probe-fpov-bump.png");
await ev(`WOMB.fpLook(-1.5, -0.05); 'ok'`);
await sleep(900);
await shot("probe-fpov-sofa.png");
await ev(`WOMB.fpLook(Math.PI - 0.38, -0.04); 'ok'`);
await sleep(600);
await ev(`WOMB.setHomeOpt('decor', 2); 'ok'`);
await sleep(1800);
console.log("mirror live:", await ev(`WOMB.mirrorLive()`), "hand-bump dist:", await ev(`WOMB.handBumpDist()`));
await ev(`WOMB.momPlace(-1.6, -2.2); WOMB.fpLook(-2.368, 0.18); 'ok'`);
await sleep(1200);
await shot("probe-fpov-mirror.png");
await ev(`WOMB.setWeeks(40); 'ok'`);
await sleep(800);
await shot("probe-fpov-wk40.png");
await ev(`WOMB.setWeeks(8); 'ok'`);
await sleep(800);
await shot("probe-fpov-wk8.png");
await ev(`WOMB.setWeeks(24); 'ok'`);
await ev(`WOMB.momPlace(1.25, -0.85); WOMB.fpLook(Math.PI - 0.38, -0.95); 'ok'`);
await sleep(600);
console.log("hand NDC (bump view):", JSON.stringify(await ev(`WOMB.handNDC()`)));
await ev(`WOMB.fpLook(Math.PI - 0.38, -0.95); 'ok'`);
await sleep(900);
await shot("probe-fpov-bump2.png");
const before = await ev(`WOMB.fpovState()`);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); 'ok'`);
await sleep(1800);
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); 'ok'`);
const after = await ev(`WOMB.fpovState()`);
console.log("walked from", JSON.stringify(before.momPos), "to", JSON.stringify(after.momPos));
await shot("probe-fpov-walked.png");
proc.kill();
process.exit(0);
