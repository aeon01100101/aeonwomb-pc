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
  "--remote-debugging-port=9345", "--user-data-dir=/tmp/womb-systems-profile", "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const r = await fetch("http://127.0.0.1:9345/json");
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
await sleep(1000);
const cp = (await ev(`WOMB.driveFacts()`)).carPos;
await ev(`WOMB.momPlace(${cp[0] + 2.2}, ${cp[1]}); 'ok'`);
await sleep(400);
console.log("enter:", await ev(`WOMB.enterCar()`));
// --- cold start: lean carb, no choke -> she should refuse sometimes
await ev(`WOMB.tempSet(0.05); WOMB.chokeSet(false); WOMB.carbSet(-2); 'ok'`);
let refused = false;
for (let i = 0; i < 8 && !refused; i++) {
  await ev(`WOMB.ignite(); 'ok'`);
  const died = await until(`WOMB.driveFacts().engine === 'off'`, 9000);
  const on = await ev(`WOMB.driveFacts().engine === 'on'`);
  if (died && !on) refused = true;
  if (on) break;
}
console.log("cold lean no-choke refused a start:", refused);
// --- choke fixes a cold start, guaranteed path
await ev(`if (WOMB.driveFacts().engine === 'on') WOMB.ignite(); WOMB.chokeSet(true); WOMB.ignite(); 'ok'`);
console.log("cold start WITH choke:", await until(`WOMB.driveFacts().engine === 'on'`, 20000));
// --- variable burn: rev in N, warm, factory vs rich vs lean
await ev(`WOMB.tempSet(1); WOMB.chokeSet(false); WOMB.gearUp(); WOMB.gearUp(); 'ok'`); // P->R->N
await sleep(300);
await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))`);
await sleep(6000);
const gphFactory = (await ev(`WOMB.driveFacts()`)).gph;
await ev(`WOMB.carbSet(2); 'ok'`);
await sleep(2500);
const gphRich = (await ev(`WOMB.driveFacts()`)).gph;
await ev(`WOMB.carbSet(-2); 'ok'`);
await sleep(2500);
const gphLean = (await ev(`WOMB.driveFacts()`)).gph;
console.log("gph factory/rich/lean:", gphFactory, gphRich, gphLean);
// --- variable throttle by mouse value
await ev(`window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))`);
await ev(`WOMB.gearUp(); WOMB.carbSet(0); WOMB.varSet(true); WOMB.mouseThr(0.55); 'ok'`); // N->D
await sleep(600);
console.log("mouse throttle reads:", (await ev(`WOMB.driveFacts()`)).throttle);
console.log("creeps at part throttle:", await until(`WOMB.driveFacts().mph > 2`, 30000));
// --- a forced hard shift
await ev(`WOMB.mouseThr(1); WOMB.forceHard(); 'ok'`);
console.log("hard shift landed:", await until(`WOMB.driveFacts().hardShifts >= 1`, 60000),
  JSON.stringify(await ev(`WOMB.driveFacts()`)));
await shot("probe-drive-systems.png");
proc.kill();
process.exit(0);
