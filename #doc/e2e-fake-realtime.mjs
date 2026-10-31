import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const URL_ = "http://localhost:3123";
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--remote-debugging-port=9333", "--no-first-run",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "chr-"))}`, "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page");
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const cdp = (method, params = {}) => new Promise((r) => {
  const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params }));
});
const ev = async (expression) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const shot = async (name, w, h) => {
  await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: true });
  await sleep(200);
  const { result } = await cdp("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(result.data, "base64"));
};
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); };
const text = () => ev("document.body.innerText");
const click = () => ev("document.querySelector('.toggle').click()");
const clearDisabled = () => ev("document.querySelector('.clear').disabled");

await cdp("Page.enable"); await cdp("Runtime.enable");

// 1. Real route, no key.
await cdp("Page.navigate", { url: URL_ }); await sleep(1500);
await shot("empty-phone.png", 390, 844);
await click(); await sleep(1500);
check("no key error shown", (await text()).includes("OPENAI_API_KEY is not set"), JSON.stringify(await text()));
check("button back to start", (await text()).includes("Start conversation"));

// 2. Fake transport.
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.__sent = []; window.__closed = 0; const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = async (c) => (window.__stream = await gum(c));
  class Ch extends EventTarget { readyState='connecting'; send(s){__sent.push(JSON.parse(s))} close(){this.readyState='closed'} }
  window.RTCPeerConnection = class extends EventTarget {
    connectionState='new';
    createDataChannel(){ return window.__ch = new Ch() }
    addTrack(){} async createOffer(){return {sdp:'offer'}} async setLocalDescription(){}
    async setRemoteDescription(){ __ch.readyState='open'; __ch.dispatchEvent(new Event('open')) }
    close(){ __closed++ }
  };
  const real = window.fetch;
  window.fetch = async (u,o) => String(u).includes('/api/session')
    ? new Response(JSON.stringify({value:'ek_test'}),{status:200})
    : String(u).includes('/v1/realtime/calls') ? new Response('answer',{status:201}) : real(u,o);
  window.__emit = (e) => { const m=new Event('message'); m.data=JSON.stringify(e); __ch.dispatchEvent(m) };
`});
await cdp("Page.navigate", { url: URL_ }); await sleep(1500);
await click(); await sleep(300);
check("live", (await text()).includes("End conversation"));
check("clear disabled while live", (await clearDisabled()) === true);
const emit = (e) => ev(`__emit(${JSON.stringify(e)})`);
const call = (cid, names) => ({ type: "function_call", name: "report_unavailable_ingredients", call_id: cid, arguments: JSON.stringify({ ingredients: names }) });

await emit({ type: "input_audio_buffer.speech_started" });
await sleep(6000);
check("no idle end while speaking 6s", (await text()).includes("End conversation"));
await emit({ type: "input_audio_buffer.speech_stopped" });
await emit({ type: "input_audio_buffer.committed", item_id: "u1" });
await emit({ type: "conversation.item.input_audio_transcription.delta", item_id: "u1", delta: "We ran out" });
await emit({ type: "conversation.item.input_audio_transcription.delta", item_id: "u1", delta: " of lemon" });
await sleep(200);
const partial = await ev("document.querySelector('.message')?.textContent");
check("partial transcript streams in", partial === "We ran out of lemon", JSON.stringify(partial));
await emit({ type: "response.created" });
await sleep(6000);
check("no idle end during response 6s", (await text()).includes("End conversation"));
await emit({ type: "response.done", response: { status: "completed", output: [call("c1", ["Lemon", "Honey", "NotReal"])] } });
await emit({ type: "response.created" });
await emit({ type: "response.done", response: { status: "completed", output: [call("c1", ["Goofu"]), call("c2", ["Honey", "Blue Curaçao Syrup"])] } });
// Late transcript arrives after the next message.
await emit({ type: "input_audio_buffer.committed", item_id: "u2" });
await emit({ type: "response.created" });
await emit({ type: "response.output_text.delta", item_id: "a2", delta: "Which milk: Coconut, " });
await emit({ type: "response.output_text.delta", item_id: "a2", delta: "Fresh or Oat?" });
await emit({ type: "response.done", response: { status: "completed", output: [] } });
await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "We ran out of lemon and honey" });
await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u2", transcript: "No milk" });
await sleep(200);
const items = await ev("[...document.querySelectorAll('.report li')].map(l=>l.textContent)");
check("report merged, order, unknown and duplicate call dropped", JSON.stringify(items) === JSON.stringify(["Lemon", "Honey", "Blue Curaçao Syrup"]), JSON.stringify(items));
check("h2 exact", (await ev("document.querySelector('.report h2').textContent")) === "Got it. The Following Ingredient is out:");
const msgs = await ev("[...document.querySelectorAll('.message')].map(m=>m.textContent)");
check("dialogue order", JSON.stringify(msgs) === JSON.stringify(["We ran out of lemon and honey", "No milk", "Which milk: Coconut, Fresh or Oat?"]), JSON.stringify(msgs));
const sent = await ev("__sent");
check("function outputs sent, no response.create", sent.length === 2 && sent.every((s) => s.type === "conversation.item.create"), JSON.stringify(sent.map((s) => s.item?.call_id)));
await shot("live-phone.png", 390, 844);
await shot("live-tablet.png", 820, 1180);
await sleep(5300);
const t = await text();
check("idle end after 5s", t.includes("Session ended (idle).") && t.includes("Start conversation"));
check("report stays after end", t.includes("Lemon"));
check("peer closed once", (await ev("__closed")) === 1);
const st = await ev("__stream.getTracks().map(t=>t.readyState).join()"); check("mic track stopped", st === "ended", st);
check("clear enabled after end", (await clearDisabled()) === false);
await ev("__sent = []");
await click(); await sleep(300);
const kept = await text();
check("next start keeps report and dialogue", kept.includes("Lemon") && kept.includes("No milk"));
const ctx = (await ev("__sent"))[0];
const ctxText = ctx?.item?.content?.[0]?.text ?? "";
check("context sent as system item", ctx?.type === "conversation.item.create" && ctx.item.role === "system" && ctxText.includes("Already reported out: Lemon, Honey, Blue Curaçao Syrup.") && ctxText.includes("Worker (transcript, may be inaccurate): No milk") && !ctxText.includes("Session ended"), JSON.stringify(ctxText));
await click(); await sleep(200);
check("manual end", (await text()).includes("Session ended."));
await ev("document.querySelector('.clear').click()"); await sleep(200);
const cleared = await ev("[document.querySelectorAll('.message').length, document.querySelectorAll('.report li').length]");
check("clear empties dialogue and report", JSON.stringify(cleared) === "[0,0]", JSON.stringify(cleared));
check("clear disabled when empty", (await clearDisabled()) === true);
await ev("__sent = []");
await click(); await sleep(300);
check("no context after clear", (await ev("__sent")).length === 0);
await shot("cleared-live-phone.png", 390, 844);
await click(); await sleep(200);
const overflow = await ev("document.documentElement.scrollWidth > innerWidth");
check("no horizontal overflow", overflow === false);

chrome.kill();
ws.close();
console.log(results.every(Boolean) ? "ALL PASS" : "FAILURES");
process.exit(0);
