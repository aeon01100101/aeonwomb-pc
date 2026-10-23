import { spawn } from "node:child_process";
import fs from "node:fs";
const ROOT = "/home/hatch/workspace/aeonwomb-pc";
const FILES = {
  "/three.min.js": fs.readFileSync(ROOT + "/vendor/three.min.js"),
  "/lobby.js": fs.readFileSync("/home/hatch/workspace/user/files/lobby_0_v415.js"),
  "/": Buffer.from(`<!doctype html><body style="margin:0;background:#202028">
<script src="/three.min.js"></script><script src="/lobby.js"></script><script>
window.RESULTS = {};
try {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a2f3a);
  const g = buildLobby(); scene.add(g);
  let tris = 0; g.traverse(o => { if (o.isMesh) { const geo = o.geometry; tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; } });
  const u = g.userData;
  window.RESULTS = { group: g.isGroup === true, tris: Math.round(tris), size: u.size, spawn: u.spawn, door: u.door,
    colliders: (u.colliders || []).length, hasClock: !!u.clock, lights: (u.lights || []).length, flicker: (u.flicker || []).length };
  const cam = new THREE.PerspectiveCamera(58, 900/600, 0.05, 60);
  cam.position.set(1.6, 1.55, 3.3);
  cam.lookAt(-0.5, 1.05, -3.5);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(900, 600); document.body.appendChild(r.domElement);
  r.render(scene, cam);
  window.__shot = r.domElement.toDataURL("image/png");
} catch (e) { window.RESULTS = { error: String(e && e.stack || e) }; }
</script></body>`)
};
let id = 0; const pend = new Map();
const send = (ws, m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const chrome = spawn("/opt/meta-chromium/chrome", ["--headless=new", "--no-sandbox", "--disable-gpu-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--remote-debugging-port=0", "--user-data-dir=/tmp/lobby-prof"], { stdio: ["ignore", "pipe", "pipe"] });
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
await new Promise(r => setTimeout(r, 5000));
const out = await send(ws, "Runtime.evaluate", { expression: "JSON.stringify(window.RESULTS)", returnByValue: true });
console.log(out.result.value);
const shot = await send(ws, "Runtime.evaluate", { expression: "window.__shot || ''", returnByValue: true });
if (shot.result.value) fs.writeFileSync(ROOT + "/shots/lobby-bench.png", Buffer.from(shot.result.value.split(",")[1], "base64"));
console.log("PAGE ERRORS:", errors.length ? errors : "none");
try { await send(ws, "Browser.close"); } catch {}
process.exit(0);
