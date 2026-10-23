// Screenshot the two dwelling previews (suburban house + city apartment)
// in headless Chrome over CDP, straight from file:// — no server needed.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9341;
const DIR = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new', '--no-sandbox', '--remote-debugging-port=' + PORT,
  '--window-size=1010,830', '--user-data-dir=/tmp/womb-house-profile', 'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res) => pending.set(id, { res }));
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function shot(url, name) {
  await send('Page.navigate', { url });
  for (let i = 0; i < 30; i++) {
    if (await evalJs(`!!window.__ready`).catch(() => false)) break;
    await sleep(300);
  }
  await sleep(400);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const f = path.join(DIR, name);
  fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
  console.log('screenshot:', name, fs.statSync(f).size, 'bytes');
}
try {
  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json`); targets = await r.json(); } catch { await sleep(500); }
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).res(m); pending.delete(m.id); }
  };
  await send('Page.enable'); await send('Runtime.enable');
  const base = 'file://' + DIR + 'house.html';
  await shot(base + '?d=0&wall=0&floor=0&sofa=0&curtains=0&rug=0&tv=0&decor=0&lamp=0&plant=1', 'house-suburban.png');
  await shot(base + '?d=1&wall=3&floor=2&sofa=1&curtains=2&rug=1&tv=1&decor=2&lamp=1&plant=2', 'house-apartment.png');
  console.log('DONE');
} catch (e) {
  console.log('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
}
