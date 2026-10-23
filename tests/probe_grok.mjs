import { spawn } from "node:child_process";
import fs from "node:fs";
const ROOT = "/home/hatch/workspace/aeonwomb-pc";
const FILES = {};
for (const [url, p] of Object.entries({
  "/three.min.js": ROOT + "/vendor/three.min.js",
  "/builders.js": ROOT + "/incoming/review/grok/content-builders.js" }))
  FILES[url] = fs.readFileSync(p);
FILES["/"] = Buffer.from(`<!doctype html><body style="margin:0;background:#87b5d9">
<script src="/three.min.js"></script><script src="/builders.js"></script><script>
window.RESULTS = {};
try {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87b5d9);
  const cam = new THREE.PerspectiveCamera(45, 900/600, 0.1, 200);
  cam.position.set(7.5, 4.2, 9.5); cam.lookAt(0.5, 0.8, 0);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(900, 600); document.body.appendChild(r.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.1); sun.position.set(6, 10, 4); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x77aa66 }));
  ground.rotation.x = -Math.PI/2; scene.add(ground);
  const names = ["buildMailbox","buildFireHydrant","buildParkBench","buildStreetLamp","buildPhoneBooth","buildKitchenSet","buildNurserySet"];
  const spots = { buildMailbox:[-4.5,0,0], buildFireHydrant:[-2.7,0,0.4], buildParkBench:[-0.6,0,0.3], buildStreetLamp:[1.6,0,0], buildPhoneBooth:[3.4,0,0], buildKitchenSet:[-1.5,0,-4.5], buildNurserySet:[3.2,0,-4.5] };
  window.__tickers = [];
  for (const n of names) {
    const g = window[n](); const p = spots[n]; g.position.set(p[0], p[1], p[2]); scene.add(g);
    let tris = 0; g.traverse(o => { if (o.isMesh) { const geo = o.geometry; tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; } });
    if (g.userData.tick) window.__tickers.push(g);
    window.RESULTS[n] = { group: g.isGroup === true, tris: Math.round(tris), tick: !!g.userData.tick, kind: g.userData.kind || null };
  }
  for (let i = 0; i < 30; i++) for (const g of window.__tickers) g.userData.tick(i / 10, 0.1);
  window.RESULTS.ticksOK = true;
  r.render(scene, cam);
  window.__shot = r.domElement.toDataURL("image/png");
} catch (e) { window.RESULTS.error = String(e && e.stack || e); }
</script></body>`);
let id = 0; const pend = new Map();
const send = (ws, m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const chrome = spawn("/opt/meta-chromium/chrome", ["--headless=new", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox", "--remote-debugging-port=0", "--user-data-dir=/tmp/grok-prof"], { stdio: ["ignore", "pipe", "pipe"] });
const port = await new Promise(res => { let b = ""; chrome.stderr.on("data", d => { b += d; const m = b.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) res(+m[1]); }); });
const tg = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tg.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
const errors = [];
ws.addEventListener("message", ev => { const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  if (m.method === "Fetch.requestPaused") { const u = new URL(m.params.request.url); const f = FILES[u.pathname];
    if (f) send(ws, "Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: u.pathname.endsWith(".js") ? "text/javascript" : "text/html" }], body: Buffer.from(f).toString("base64") }).catch(() => {});
    else send(ws, "Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 404, body: "" }).catch(() => {}); }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC " + (m.params.exceptionDetails.exception?.description || ""));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("CONSOLE " + JSON.stringify(m.params.args?.[0]?.value || ""));
});
await send(ws, "Fetch.enable", { patterns: [{ urlPattern: "*" }] });
await send(ws, "Runtime.enable");
await send(ws, "Page.enable");
await send(ws, "Page.navigate", { url: "http://womb.test/" });
await new Promise(r => setTimeout(r, 6000));
const out = await send(ws, "Runtime.evaluate", { expression: "JSON.stringify(window.RESULTS)", returnByValue: true });
console.log(out.result.value);
const shot = await send(ws, "Runtime.evaluate", { expression: "window.__shot || ''", returnByValue: true });
if (shot.result.value) fs.writeFileSync(ROOT + "/shots/grok-lineup.png", Buffer.from(shot.result.value.split(",")[1], "base64"));
console.log("PAGE ERRORS:", errors.length ? errors : "none");
try { await send(ws, "Browser.close"); } catch {}
process.exit(0);
