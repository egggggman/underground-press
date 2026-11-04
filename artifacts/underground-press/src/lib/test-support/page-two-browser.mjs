// Optional real-Chromium acceptance runner, using its DevTools protocol rather
// than adding a browser dependency. Start the isolated API test with
// PRESS_PAGE2_BROWSER_AUDIT=1 and Chromium with --remote-debugging-port=9223.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:31991";
const continuing = process.argv.includes("--continue");
const target = continuing
  ? (await (await fetch("http://127.0.0.1:9223/json/list")).json()).find(t => t.url.startsWith(base))
  : await (await fetch(`http://127.0.0.1:9223/json/new?${encodeURIComponent(`${base}/__test/login/contributor`)}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener("open", resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Page.javascriptDialogOpening") {
    // This browser is confined to test fixtures; native unload confirmations
    // must not leave the DevTools session waiting indefinitely.
    void cdp("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
    return;
  }
  if (!message.id) return;
  const cb = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) cb.reject(new Error(JSON.stringify(message.error)));
  else cb.resolve(message.result);
});
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id;
  pending.set(next, { resolve, reject });
  ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, timeout: 10000 });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async expression => {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(150); }
  throw new Error(`Timed out: ${expression}\n${await evaluate("document.body.innerText.slice(0,4000)")}`);
};
const value = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.value`);
const set = async (selector, text) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus(); document.querySelector(${JSON.stringify(selector)}).select();`);
  if (text) await cdp("Input.insertText", { text });
  else {
    await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" });
    await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" });
  }
};
const click = async label => {
  await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled); if (!b) throw new Error('No enabled button: ' + ${JSON.stringify(label)}); b.click(); })()`);
};
const api = (path = "issue") => evaluate(`fetch('/api/press/${path}').then(r => r.json())`);
const navigate = async path => {
  assert.equal(new URL(path, base).origin, base);
  await cdp("Page.navigate", { url: `${base}${path}` });
  await wait("document.readyState === 'complete'");
};
const reports = continuing ? JSON.parse(await readFile(".local/page2-browser-results.json", "utf8")).reports : [];
try {
  await cdp("Page.enable");
  await wait("!!document.querySelector('[data-testid=\"input-page-copy\"]') && !document.querySelector('[data-testid=\"input-page-copy\"]').disabled");
  assert.equal(await evaluate("location.origin"), base);
  const initial = await api();
  const cover = JSON.stringify(initial.pages[0]);
  const snapshot = JSON.stringify(initial.pageSnapshots);
  const copy = '[data-testid="input-page-copy"]';
  const source = '[data-testid="input-page-source-identity"]';
  const savedCopy = `TEST-ONLY browser explicitly saved copy ${Date.now()}`;
  if (!continuing) {
  await set(copy, savedCopy);
  assert.equal((await api()).pages[1].copy, initial.pages[1].copy);
  await click("Save page");
  await pause(800);
  await wait(`(async () => (await fetch('/api/press/issue').then(r=>r.json())).pages[1].copy === ${JSON.stringify(savedCopy)})()`);
  await evaluate("window.__pageTwoBeforeReload = true");
  await cdp("Page.reload");
  await wait(`window.__pageTwoBeforeReload !== true && document.querySelector('[data-testid="input-page-copy"]')?.value === ${JSON.stringify(savedCopy)} && !document.querySelector('[data-testid="input-page-copy"]').disabled`);
  reports.push("PASS: real browser explicit save, no autosave, reload persistence");
  // Delay only the sandbox command response. Never intercept production traffic.
  await evaluate(`window.__nativeFetch = window.fetch.bind(window); window.__delayOne = true; window.fetch = async (...args) => { const response = await window.__nativeFetch(...args); if (window.__delayOne && String(args[0]).includes('/press/commands') && args[1]?.method === 'POST') { window.__delayOne = false; await new Promise(r=>setTimeout(r,1800)); } return response; };`);
  await set(copy, "TEST-ONLY browser pending save");
  await click("Save page");
  await pause(200);
  await set(copy, "TEST-ONLY browser later unsaved text");
  await pause(2200);
  assert.equal(await value(copy), "TEST-ONLY browser later unsaved text");
  await evaluate(`(async () => { const i=await fetch('/api/press/issue').then(r=>r.json()); const p=i.pages[2]; return fetch('/api/press/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'edit_page',revision:i.revision,page:3,title:p.title,copy:'TEST-ONLY browser concurrent page',sourceIdentity:'TEST-ONLY concurrent source'})}).then(r=>r.json()); })()`);
  // Force the ordinary query refresh without reloading unsaved browser input.
  await pause(32000);
  assert.equal(await value(copy), "TEST-ONLY browser later unsaved text");
  await click("Save page");
  await pause(500);
  assert.equal(await value(copy), "TEST-ONLY browser later unsaved text");
  assert.equal((await api()).pages[1].copy, "TEST-ONLY browser pending save");
  reports.push("PASS: late typing survives save completion, background revision refresh and stale-save rejection");
  await evaluate(`window.fetch=window.__nativeFetch`);
  }
  assert.equal(await evaluate("document.querySelector('[data-testid=\"button-lock-page\"]').disabled"), true);
  await navigate("/__test/login/myrtle");
  await wait("!!document.querySelector('[data-testid=\"input-page-copy\"]') && !document.querySelector('[data-testid=\"input-page-copy\"]').disabled");
  await set(source, `TEST-ONLY browser source identity ${Date.now()}`);
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Save page' && !b.disabled)");
  await click("Save page");
  await pause(500);
  await click("Submit for review");
  await pause(400);
  assert.equal((await api()).pages[1].status, "in_review");
  reports.push("PASS: browser draft/review transition does not auto-approve; contributor cannot lock");
  const attest = async label => {
    await click(label);
    await wait("!!document.querySelector('[data-testid=\"dialog\"]')");
    await set('[data-testid="input-notes"]', "TEST-ONLY simulated review. No actual Myrtle, approved art, validated puzzle or production proof.");
    if (await evaluate("!!document.querySelector('[data-testid=\"input-reviewer\"]')")) await set('[data-testid="input-reviewer"]', "TEST-ONLY review fixture");
    await evaluate("document.querySelector('[data-testid=\"checkbox-ack\"]').click()");
    await wait("!document.querySelector('[data-testid=\"button-confirm\"]').disabled");
    await evaluate("document.querySelector('[data-testid=\"button-confirm\"]').click()");
    await wait("!document.querySelector('[data-testid=\"dialog\"]')");
    await pause(150);
  };
  await attest("Editorial approval");
  await attest("Art approval");
  await attest("Attest print layout");
  await attest("Lock page");
  const frozen = (await api()).pageSnapshots.at(-1);
  assert.equal((await api()).pages[1].locked, true);
  await attest("Branch from locked page");
  const branched = await api();
  assert.equal(branched.pages[1].locked, false);
  assert.equal(branched.pages[1].editorialApproval, null);
  assert.deepEqual(branched.pageSnapshots.find(s=>s.id===frozen.id), frozen);
  reports.push("PASS: simulated explicit editorial/art/print acknowledgements, lock and branch through real UI preserve snapshots");
  await navigate("/proof");
  await wait("!!document.querySelector('[data-testid=\"button-print-proof\"]') && !document.querySelector('[data-testid=\"button-print-proof\"]').disabled");
  await evaluate("window.__printed=0; window.print=()=>window.__printed++");
  await click("Print working proof");
  assert.equal(await evaluate("window.__printed"), 1);
  await click("Run preflight");
  await pause(300);
  assert.equal((await api()).proofs.at(-1).status, "blocked");
  const publicExport = await evaluate("fetch('/api/press/export',{credentials:'omit'}).then(r=>r.json())");
  assert.equal(publicExport.puzzles.every(p=>!p.solution && !p.validationNotes), true);
  reports.push("PASS: working-print action invokes browser printing; preflight stays blocked; anonymous JSON protects answers");
  await writeFile(".local/page2-browser-results.json", JSON.stringify({ reports, sandbox: true }, null, 2));
  assert.equal(JSON.stringify((await api()).pages[0]), cover);
  for (const original of JSON.parse(snapshot)) assert.deepEqual((await api()).pageSnapshots.find(s=>s.id===original.id), original);
  await mkdir("generated-artifacts", { recursive: true });
  const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile("generated-artifacts/page2-browser.png", Buffer.from(screenshot.data, "base64"));
  console.log(reports.join("\n"));
  await evaluate("fetch('/__test/finish',{method:'POST'}).then(r=>r.json())");
} finally {
  ws.close();
}
