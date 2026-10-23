import { spawn } from "node:child_process";
import fs from "node:fs";
const ROOT = "/home/hatch/workspace/aeonwomb-pc";
const FILES = {
  "/three.min.js": fs.readFileSync(ROOT + "/vendor/three.min.js"),
  "/GLTFLoader.js": fs.readFileSync(ROOT + "/vendor/GLTFLoader.js"),
  "/taxi.glb": fs.readFileSync(ROOT + "/packs/cars/fusion/taxi.glb"),
  "/coupe.glb": fs.readFileSync(ROOT + "/packs/cars/fusion/coupe.glb"),
  "/": Buffer.from(`<!doctype html><body style="margin:0;background:#87b5d9">
<script src="/three.min.js"></script><script src="/GLTFLoader.js"></script><script>
window.RESULTS = {};
try {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x87b5d9);
  const cam = new THREE.PerspectiveCamera(45, 900/600, 0.1, 200);
  cam.position.set(6.5, 3.4, 7.5); cam.lookAt(0, 0.8, 0);
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(900, 600); r.outputEncoding = THREE.sRGBEncoding; document.body.appendChild(r.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.2); sun.position.set(6, 10, 4); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x77aa66 }));
  ground.rotation.x = -Math.PI/2; scene.add(ground);
  let done = 0;
  const loader = new THREE.GLTFLoader();
  const put = (file, x) => loader.load("/" + file, g => {
    g.scene.position.set(x, 0, 0); scene.add(g.scene);
    const mats = []; g.scene.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) mats.push({ name: m.name, color: m.color ? m.color.getHexString() : null, map: !!m.map, mapEnc: m.map ? m.map.encoding : null }); } });
    window.RESULTS[file] = mats.slice(0, 8);
    if (++done === 2) { r.render(scene, cam); window.__shot = r.domElement.toDataURL("image/png"); }
  }, undefined, e => { window.RESULTS[file] = "LOAD ERROR " + e; if (++done === 2) window.__shot = ""; });
  put("taxi.glb", -2.6); put("coupe.glb", 2.6);
} catch (e) { window.RESULTS = { error: String(e && e.stack || e) }; }
</script></body>`)
};
let id = 0; const pend = new Map();
const send = (ws, m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const chrome = spawn("/opt/meta-chromium/chrome", ["--headless=new", "--no-sandbox", "--disable-gpu-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--remote-debugging-port=0", "--user-data-dir=/tmp/fusion-prof"], { stdio: ["ignore", "pipe", "pipe"] });
const port = await new Promise(res => { let b = ""; chrome.stderr.on("data", d => { b += d; const m = b.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (m) res(+m[1]); }); });
const tg = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tg.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
const errors = [];
ws.addEventListener("message", ev => { const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  if (m.method === "Fetch.requestPaused") { const u = new URL(m.params.request.url); const f = FILES[u.pathname];
    if (f) send(ws, "Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: u.pathname.endsWith(".js") ? "text/javascript" : u.pathname.endsWith(".glb") ? "model/gltf-binary" : "text/html" }], body: Buffer.from(f).toString("base64") }).catch(() => {});
    else send(ws, "Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 404, body: "" }).catch(() => {}); }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC " + (m.params.exceptionDetails.exception?.description || ""));
});
await send(ws, "Fetch.enable", { patterns: [{ urlPattern: "*" }] });
await send(ws, "Runtime.enable"); await send(ws, "Page.enable");
await send(ws, "Page.navigate", { url: "http://womb.test/" });
await new Promise(r => setTimeout(r, 7000));
const out = await send(ws, "Runtime.evaluate", { expression: "JSON.stringify(window.RESULTS)", returnByValue: true });
console.log(out.result.value);
const shot = await send(ws, "Runtime.evaluate", { expression: "window.__shot || ''", returnByValue: true });
if (shot.result.value) fs.writeFileSync(ROOT + "/shots/fusion-bench.png", Buffer.from(shot.result.value.split(",")[1], "base64"));
console.log("PAGE ERRORS:", errors.length ? errors : "none");
try { await send(ws, "Browser.close"); } catch {}
process.exit(0);
