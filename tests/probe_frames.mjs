// Liveness probe: does rAF keep flowing after fetus KICK and in the 3D home?
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
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
  "--enable-unsafe-swiftshader", "--no-sandbox", "--mute-audio",
  "--remote-debugging-port=9335", "--user-data-dir=/tmp/womb-probe2-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9335/json");
    const j = await r.json();
    ws = j.find(t => t.type === "page")?.webSocketDebuggerUrl;
  } catch { await sleep(400); }
}
const sock = new WebSocket(ws);
await new Promise(r => sock.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
let exceptions = 0;
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
  if (m.method === "Runtime.exceptionThrown") {
    exceptions++;
    console.log("EXCEPTION:", (m.params.exceptionDetails.exception?.description || "").split("\n")[0]);
  }
});
function send(method, params = {}) {
  return new Promise(res => { const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params })); });
}
const ev = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "ERR:" + (r.result.exceptionDetails.exception?.description || "eval error");
  return r.result?.result?.value;
};
const countFrames = label => ev(`new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 8000) requestAnimationFrame(f); else res(n); };
  requestAnimationFrame(f);
})`).then(n => console.log(label, "frames in 8s:", n));

await send("Page.enable"); await send("Runtime.enable");
await send("Fetch.enable", { patterns: [{ urlPattern: "http://womb.test/*" }] });
await send("Page.navigate", { url: "http://womb.test/" });
await sleep(5000);
console.log("booted:", await ev(`!!window.WOMB`));
await ev(`WOMB.setMode(1); WOMB.startGame(); 'ok'`);
await sleep(2500);
await countFrames("fetus before kick");
console.log("kick:", await ev(`WOMB.doKick(); WOMB.world.yourKicks`));
await countFrames("fetus after kick");
await ev(`WOMB.quitToMenu(); WOMB.enterHome(); 'ok'`);
await sleep(2500);
await countFrames("home view");
console.log("exceptions:", exceptions);
proc.kill();
process.exit(0);
