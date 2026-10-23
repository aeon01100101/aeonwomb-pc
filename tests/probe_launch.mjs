// Standalone: the mouse-throttle drive + a forced HARD shift,
// on a fresh page (long sessions degrade the software GPU).
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
  "http://womb.test/vendor/three.min.js": ["vendor/three.min.js", "text/javascript"],
  "http://womb.test/launcher.html": ["launcher.html", "text/html"],
  "http://womb.test/packs.json": ["packs.json", "application/json"]
};
const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio", "--window-size=1280,720",
  "--remote-debugging-port=9349", "--user-data-dir=/tmp/womb-launch-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9349/json");
    const j = await r.json();
    ws = j.find(t => t.type === "page")?.webSocketDebuggerUrl;
  } catch { await sleep(400); }
}
const sock = new WebSocket(ws);
await new Promise(r => sock.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
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
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + (m.params.args?.[0]?.value || ""));
});
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
}
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
const facts = () => evalJs("window.WOMB && WOMB.driveFacts()");
async function poll(fn, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(1500); }
  console.log("POLL TIMEOUT:", label);
  return null;
}
await send("Page.navigate", { url: "http://womb.test/launcher.html" });
await sleep(4000);
await shot("launcher.png");
console.log("pack pills:", await evalJs("[...document.querySelectorAll('.pill')].map(p => p.textContent).join(' | ')"));
await evalJs("document.querySelector('#playMom').click(); 'clicked'");
await sleep(2500);
console.log("after Play: url path served; view =", await evalJs("window.WOMB && WOMB.view()").catch(() => "n/a"));
const home = await poll(async () => (await evalJs("window.WOMB && WOMB.view()").catch(() => null)) === "home", 60000, "auto-start into Mom mode");
console.log(home ? "PASS launcher hands off into Mom mode" : "FAIL launcher hand-off");
// postcards from across the street, through her eyes
await evalJs("WOMB.setFpov(true); WOMB.momPlace(0, 23.5); WOMB.fpLook(0, 0.03);");
await sleep(4500);
await shot("visual-mainstreet2.png");
await evalJs("WOMB.momPlace(19.5, 25.5); WOMB.fpLook(0.62, 0.02);");
await sleep(4500);
await shot("visual-courthouse2.png");
console.log("PAGE ERRORS:", errors.length ? errors.slice(0, 3).join(" | ") : "none");
try { proc.kill(); } catch { }
process.exit(0);
