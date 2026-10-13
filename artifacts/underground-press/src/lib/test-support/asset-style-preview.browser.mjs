import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const artifactRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pZ8AAAAASUVORK5CYII=',
  'base64',
);
const requests = { initial: [], redirected: [] };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listen(server, host) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  return server.address().port;
}

async function reservePort() {
  const server = createHttpServer();
  const port = await listen(server, '127.0.0.1');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

const chromiumPath = process.env.CHROMIUM_BIN || '/repl/tools/bin/chromium';
let targetPort;
const imageTarget = createHttpServer((request, response) => {
  requests.redirected.push({ url: request.url, referer: request.headers.referer ?? null });
  if (request.url !== '/final.png') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }).end(png);
});
targetPort = await listen(imageTarget, '127.0.0.1');

const initialHost = createHttpServer((request, response) => {
  requests.initial.push({ url: request.url, referer: request.headers.referer ?? null });
  if (request.url !== '/redirect.png') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(302, {
    location: `http://localhost:${targetPort}/final.png`,
    'cache-control': 'no-store',
  }).end();
});
const initialPort = await listen(initialHost, '127.0.0.1');

let vite;
let browser;
let socket;
let browserProfile;
try {
  process.env.PORT = String(await reservePort());
  process.env.BASE_PATH = '/';
  delete process.env.REPL_ID;
  const { createServer } = await import('vite');
  vite = await createServer({ configFile: path.join(artifactRoot, 'vite.config.ts') });
  await vite.listen();
  const vitePort = vite.httpServer.address().port;
  const browserPort = await reservePort();
  browserProfile = await mkdtemp(path.join(tmpdir(), 'asset-style-preview-'));
  browser = spawn(chromiumPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-extensions',
    '--remote-allow-origins=*',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${browserPort}`,
    `--user-data-dir=${browserProfile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const devtoolsUrl = `http://127.0.0.1:${browserPort}/json/list`;
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      page = (await (await fetch(devtoolsUrl)).json()).find((target) => target.type === 'page');
      if (page) break;
    } catch {}
    if (browser.exitCode !== null) throw new Error(`Chromium exited with code ${browser.exitCode}.`);
    await wait(100);
  }
  assert.ok(page, 'Chromium did not expose a browser page.');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(JSON.stringify(message.error)));
    else callbacks.resolve(message.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: 10000,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await wait(100);
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}`);
  };

  await cdp('Page.enable');
  const newsroomUrl = `http://127.0.0.1:${vitePort}/src/lib/test-support/asset-style-preview.browser.html?image=${encodeURIComponent(`http://127.0.0.1:${initialPort}/redirect.png`)}&newsroomIssue=embargoed-issue-42&edition=internal-2026`;
  await cdp('Page.navigate', { url: newsroomUrl });
  await waitFor("!!document.querySelector('[data-testid=\"button-load-reference-preview-golden_image\"]')");
  assert.equal(requests.initial.length, 0, 'The external host was contacted before the editor approved loading the preview.');

  await evaluate("document.querySelector('[data-testid=\"button-load-reference-preview-golden_image\"]').click()");
  await waitFor("(() => { const image = document.querySelector('[data-testid=\"img-comparison-reference-golden_image\"]'); return image?.complete && image.naturalWidth > 0; })()");
  assert.equal(requests.initial.length, 1, 'The redirecting image host should receive exactly one request.');
  assert.equal(requests.redirected.length, 1, 'The final image host should receive exactly one request.');
  assert.equal(requests.initial[0].referer, null, 'The redirecting host received a newsroom Referer header.');
  assert.equal(requests.redirected[0].referer, null, 'The redirect target received a Referer header.');
  assert.equal(
    await evaluate("document.querySelector('[data-testid=\"img-comparison-reference-golden_image\"]').getAttribute('referrerpolicy')"),
    'no-referrer',
  );
  console.log('PASS: redirected external preview renders, and neither host receives a newsroom Referer.');
} finally {
  socket?.close();
  browser?.kill('SIGTERM');
  if (browser) await new Promise((resolve) => browser.once('exit', resolve));
  if (vite) await vite.close();
  await Promise.all([imageTarget, initialHost].map(
    (server) => new Promise((resolve) => server.close(resolve)),
  ));
  if (browserProfile) await rm(browserProfile, { recursive: true, force: true });
}
