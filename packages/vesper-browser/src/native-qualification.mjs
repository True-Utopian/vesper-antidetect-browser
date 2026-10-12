import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';
import {observeNativeSurfacePolicies,assertSurfaceObservations,assertRestrictedSurfaces} from './native-surface-qualification.mjs';

// Independent PNG decoding avoids re-importing export pixels into a canvas,
// which would pass through the candidate's readback policy a second time.
export function decodeFixturePng(bytes) {
  const source = Buffer.from(bytes);
  assert.deepEqual(source.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  let width, height, channels, offset = 8; const compressed = [];
  while (offset < source.length) {
    const length = source.readUInt32BE(offset), type = source.toString('ascii', offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'Fixture PNG must use 8-bit components');
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      assert.ok(channels, 'Fixture PNG must use RGB or RGBA'); assert.equal(data[12], 0, 'Interlaced fixture PNG unsupported');
    } else if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
  }
  assert.equal(width, 16); assert.equal(height, 8);
  const raw = inflateSync(Buffer.concat(compressed)); const stride = width * channels;
  assert.equal(raw.length, (stride + 1) * height);
  const image = Buffer.alloc(stride * height);
  function paeth(a, b, c) { const p = a + b - c, aa = Math.abs(p - a), bb = Math.abs(p - b), cc = Math.abs(p - c); return aa <= bb && aa <= cc ? a : bb <= cc ? b : c; }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? image[y * stride + x - channels] : 0;
      const above = y ? image[(y - 1) * stride + x] : 0;
      const diagonal = y && x >= channels ? image[(y - 1) * stride + x - channels] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, diagonal)][filter];
      image[y * stride + x] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) { image.copy(rgba, i * 4, i * channels, i * channels + 3); rgba[i * 4 + 3] = channels === 4 ? image[i * channels + 3] : 255; }
  return [...rgba];
}

/** The current Canvas2D-only policy must leave GPU read/export behavior coherent. */
export function assertNativeCanvasScope(value, context) {
  assert.ok(Array.isArray(value.graphics), `${context}: graphics scope observations are required`);
  let observed = 0;
  for (const graphics of value.graphics) {
    if (!graphics) continue;
    observed++;
    const label = `${context}/${graphics.api}`;
    assert.equal(graphics.error, 0, `${label}: GPU read-out error`);
    assert.equal(graphics.pixels.length, 16 * 8 * 4, `${label}: RGBA8 fixture size`);
    assert.deepEqual(graphics.repeat, graphics.pixels, `${label}: GPU reads must not accumulate changes`);
    const expected = [];
    for (let y = 7; y >= 0; y--) expected.push(...graphics.pixels.slice(y * 64, (y + 1) * 64));
    assert.deepEqual(decodeFixturePng(graphics.encoded), expected, `${label}: Canvas2D policy must not change GPU PNG export alone`);
    if (graphics.dataUrl) assert.deepEqual(decodeFixturePng(Buffer.from(graphics.dataUrl.split(',')[1], 'base64')), expected, `${label}: GPU data URL must agree with readPixels`);
  }
  return observed;
}


/** Direct native proof; no CDP environment overrides or JS injections.
 * @param {string} executablePath
 * @returns {Promise<import("./native-kernel.js").NativeKernelReport>}
 */
export async function qualifyNativeKernel(executablePath) {
const executable = await realpath(resolve(executablePath));
assert.ok((await stat(executable)).isFile());
const temporary = await mkdtemp(join(tmpdir(), 'vesper-kernel-proof-'));
/** @type {import("./native-kernel.js").NativeKernelReport} */
const report = { schemaVersion: 1, author: 'true-utopian', at: new Date().toISOString(), state: 'running', implementation: 'native-chromium-patches', executable, executableSha256: '', nativeProof: false, cases: [], checks: [], errors: [], limitations: ['Only original loopback fixtures, native scalars and RGBA8 Canvas2D masking surfaces are qualified.', 'Surface controls cover WebGL debug-renderer exposure, completed offline audio and bounded local-font discovery. GPU pixels/shaders/WebGPU, realtime audio/device identity, font-pack virtualization, Unicode fallback isolation, float16 and arbitrary device personas remain outside this gate.', 'A pass establishes native enforcement on this binary and fixture, not all-site behavior.'] };
async function digest(file) { const hash = createHash('sha256'); for await (const data of createReadStream(file)) hash.update(data); return hash.digest('hex'); }
const hashPixels = pixels => createHash('sha256').update(Buffer.from(pixels)).digest('hex');

async function fixtureSample() {
  const scalars = { cpu: navigator.hardwareConcurrency, memory: navigator.deviceMemory };
  const canvas = typeof document === 'undefined' ? new OffscreenCanvas(16, 8) : document.createElement('canvas');
  canvas.width = 16; canvas.height = 8;
  const context = canvas.getContext('2d');
  context.fillStyle = '#cd4567'; context.fillRect(1, 1, 14, 6);
  const first = [...context.getImageData(0, 0, 16, 8).data];
  const second = [...context.getImageData(0, 0, 16, 8).data];
  const crop = [...context.getImageData(3, 2, 5, 3).data];
  let encoded;
  if (typeof canvas.convertToBlob === 'function') encoded = [...new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())];
  else encoded = [...new Uint8Array(await (await new Promise(done => canvas.toBlob(done, 'image/png'))).arrayBuffer())];
  const dataUrl = typeof canvas.toDataURL === 'function' ? canvas.toDataURL('image/png') : null;
  const graphics = [];
  for (const api of ['webgl', 'webgl2']) {
    const c = typeof document === 'undefined' ? new OffscreenCanvas(16, 8) : document.createElement('canvas');
    c.width = 16; c.height = 8;
    const gl = c.getContext(api, { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) { graphics.push(null); continue; }
    try {
      gl.disable(gl.DITHER); gl.clearColor(0.2, 0.4, 0.6, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(3, 2, 5, 3); gl.clearColor(0.8, 0.2, 0.4, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      const pixels = new Uint8Array(512), repeat = new Uint8Array(512);
      gl.readPixels(0, 0, 16, 8, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.readPixels(0, 0, 16, 8, gl.RGBA, gl.UNSIGNED_BYTE, repeat);
      const error = gl.getError();
      const blob = typeof c.convertToBlob === 'function' ? await c.convertToBlob({type:'image/png'}) : await new Promise(done=>c.toBlob(done,'image/png'));
      if (!blob) throw Error(`${api}: GPU export failed`);
      graphics.push({api,pixels:[...pixels],repeat:[...repeat],error,encoded:[...new Uint8Array(await blob.arrayBuffer())],dataUrl:typeof c.toDataURL==='function'?c.toDataURL('image/png'):null});
    } finally { gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  }
  return { ...scalars, first, second, crop, encoded, dataUrl, graphics, surfaces:await observeNativeSurfacePolicies(probeEnumeration) };
}
let probeEnumeration=false;
function sampleSource(probe){return `(async()=>{const observeNativeSurfacePolicies=${observeNativeSurfacePolicies.toString()};const probeEnumeration=${probe};return (${fixtureSample.toString()})();})()`;}
let port;
const fixture = createServer((request, response) => {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('accept-ch', 'Sec-CH-Device-Memory, Device-Memory');
  const path = new URL(request.url, 'http://fixture.local').pathname;
  if (path === '/headers') {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ deviceMemory: request.headers['sec-ch-device-memory'], legacyDeviceMemory: request.headers['device-memory'] }));
    return;
  }
  const sample = sampleSource(probeEnumeration);
  if (path.endsWith('.js')) {
    response.setHeader('content-type', 'application/javascript');
    if (path === '/shared.js') response.end(`const first=${sample};onconnect=e=>{const p=e.ports[0];first.then(v=>p.postMessage(v));p.start()}`);
    else if (path === '/service.js') response.end(`const first=${sample};oninstall=()=>skipWaiting();onactivate=e=>e.waitUntil(clients.claim());onmessage=e=>e.waitUntil(first.then(v=>e.source.postMessage(v)));`);
    else response.end(`${sample}.then(v=>postMessage(v))`);
  } else {
    response.setHeader('content-type', 'text/html');
    response.end(`<!doctype html><title>Vesper native kernel proof</title><script>window.first=${sample}</script>${path === '/main' ? `<iframe src="/same"></iframe><iframe src="http://localhost:${port}/cross"></iframe>` : ''}`);
  }
});
await new Promise(done => fixture.listen(0, '127.0.0.1', done));
port = fixture.address().port;
const origin = `http://127.0.0.1:${port}`;
// This original MV3 worker samples immediately on startup. Its first values
// must come from the native engine, including workers restored before CDP.
const extension = join(temporary, 'owned-extension');
await mkdir(extension);
await writeFile(join(extension, 'manifest.json'), JSON.stringify({
  manifest_version: 3, name: 'Vesper native kernel proof by true-utopian',
  version: '1.0.0', background: { service_worker: 'worker.js' },
  content_scripts: [{ matches: ['http://127.0.0.1/*'], js: ['content.js'], run_at: 'document_end' }],
}));
await writeFile(join(extension, 'worker.js'), `const first=${sampleSource(false)};
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
if(message.kind!=='vesper-native-proof')return;
first.then(value=>respond({value}),error=>respond({error:error.message}));return true;});`);
await writeFile(join(extension, 'content.js'), `chrome.runtime.sendMessage({kind:'vesper-native-proof'},result=>{
document.documentElement.dataset.vesperNativeExtension=JSON.stringify(chrome.runtime.lastError?{error:chrome.runtime.lastError.message}:result);});`);
let active;
function checkCanvas(value, context) {
  assert.deepEqual(value.first, value.second, `${context}: repeated native reads must not accumulate noise`);
  const expectedCrop = []; for (let y = 2; y < 5; y++) for (let x = 3; x < 8; x++) expectedCrop.push(...value.first.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4));
  assert.deepEqual(value.crop, expectedCrop, `${context}: readback uses absolute pixel coordinates`);
  assert.deepEqual(decodeFixturePng(value.encoded), value.first, `${context}: native blob export must agree with RGBA8 readback`);
  if (value.dataUrl) assert.deepEqual(decodeFixturePng(Buffer.from(value.dataUrl.split(',')[1], 'base64')), value.first, `${context}: data URL export must agree with RGBA8 readback`);
  assert.deepEqual(value.first.slice(0, 4), [0, 0, 0, 0], `${context}: transparent pixels`);
}
async function runCase(name, nativeArgs, expected, full = true) {
  probeEnumeration=nativeArgs.includes('--vesper-local-font-policy=restricted');
  const store = join(temporary, name);
  active = await puppeteer.launch({ executablePath: executable, userDataDir: store, headless: true, defaultViewport: null, enableExtensions: true,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--site-per-process', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, ...nativeArgs], timeout: 60000 });
  const record = { name, nativeArgs, version: await active.version(), contexts: {} };
  report.cases.push(record);
  try {
    const page = await active.newPage(); await page.goto(`${origin}/main`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.vesperNativeExtension, { timeout: 15000 });
    const extensionSample = await page.evaluate(() => JSON.parse(document.documentElement.dataset.vesperNativeExtension));
    assert.ok(extensionSample?.value, `${name}: native extension worker measurement failed: ${extensionSample?.error}`);
    record.contexts['extension-startup-worker'] = extensionSample.value;
    record.clientHints = await page.evaluate(() => fetch('/headers').then(response => response.json()));
    for (const frame of page.frames()) record.contexts[frame.url().endsWith('/main') ? 'page' : frame.url().endsWith('/same') ? 'same-frame' : 'cross-frame'] = await frame.evaluate(() => window.first);
    if (full) {
      record.contexts.worker = await page.evaluate(() => new Promise((done, reject) => { const worker = new Worker('/worker.js'); const timer = setTimeout(() => { worker.terminate(); reject(new Error('Native worker timeout')); }, 15000); worker.onerror = reject; worker.onmessage = event => { clearTimeout(timer); worker.terminate(); done(event.data); }; }));
      record.contexts.shared = await page.evaluate(() => new Promise((done, reject) => { const worker = new SharedWorker('/shared.js'); const timer = setTimeout(() => { worker.port.close(); reject(new Error('Native shared worker timeout')); }, 15000); worker.onerror = reject; worker.port.onmessage = event => { clearTimeout(timer); worker.port.close(); done(event.data); }; worker.port.start(); }));
      record.contexts.service = await page.evaluate(async () => {
        await navigator.serviceWorker.register('/service.js'); const registration = await navigator.serviceWorker.ready;
        return new Promise((done, reject) => { const timer = setTimeout(() => reject(new Error('Native service worker timeout')), 15000); navigator.serviceWorker.onmessage = event => { clearTimeout(timer); done(event.data); }; registration.active.postMessage('proof'); });
      });
      const popupTarget = active.waitForTarget(target => target.url() === `${origin}/popup`);
      await page.evaluate(url => window.open(url), `${origin}/popup`);
      const popup = await (await popupTarget).page(); await popup.waitForFunction(() => window.first); record.contexts.popup = await popup.evaluate(() => window.first); await popup.close();
    }
    for (const [context, value] of Object.entries(record.contexts)) {
      if (expected) { assert.equal(value.cpu, expected.cpu, `${name}/${context}: native CPU`); assert.equal(value.memory, expected.memory, `${name}/${context}: native device memory`); }
      checkCanvas(value, `${name}/${context}`);
      assertSurfaceObservations(value.surfaces,`${name}/${context}`);
      const graphicsCount = assertNativeCanvasScope(value, `${name}/${context}`);
      if (context === 'page') assert.equal(graphicsCount, 2, `${name}: page must expose both owned WebGL scope fixtures`);
      value.canvasSha256 = hashPixels(value.first);
    }
    assert.equal(Number(record.clientHints.deviceMemory), expected?.memory ?? record.contexts.page.memory, `${name}: HTTP client hint must agree with native device memory`);
    return record;
  } finally { await active.close(); active = undefined; }
}
try {
  report.executableSha256 = await digest(executable);
  const baseline = await runCase('baseline', [], undefined);
  const options = ['--vesper-hardware-concurrency=4', '--vesper-device-memory=4'];
  const seeded = await runCase('seed-a', [...options, '--vesper-canvas-seed=0123456789abcdef'], { cpu: 4, memory: 4 });
  const repeat = await runCase('seed-a-restart', [...options, '--vesper-canvas-seed=0123456789abcdef'], { cpu: 4, memory: 4 }, false);
  const other = await runCase('seed-b', [...options, '--vesper-canvas-seed=fedcba9876543210'], { cpu: 4, memory: 4 }, false);
  assert.notEqual(seeded.contexts.page.canvasSha256, baseline.contexts.page.canvasSha256, 'Native seed must change canvas output');
  assert.notEqual(seeded.contexts.page.canvasSha256, other.contexts.page.canvasSha256, 'Independent profile seeds must differ');
  assert.equal(seeded.contexts.page.canvasSha256, repeat.contexts.page.canvasSha256, 'Native seed must survive process restart');
  for (const [context, value] of Object.entries(seeded.contexts)) assert.equal(value.canvasSha256, seeded.contexts.page.canvasSha256, `${context}: equal original painting must produce equal output`);
  const invalid = await runCase('invalid-fallback', ['--vesper-hardware-concurrency=0', '--vesper-device-memory=3', '--vesper-canvas-seed=invalid'], { cpu: baseline.contexts.page.cpu, memory: baseline.contexts.page.memory }, false);
  assert.equal(invalid.contexts.page.canvasSha256, baseline.contexts.page.canvasSha256, 'Invalid seed must preserve upstream canvas fallback');
  const surfaceArgs=['--vesper-webgl-policy=restricted','--vesper-local-font-policy=restricted','--vesper-audio-seed=0123456789abcdef'];
  const surfaces=await runCase('surface-policy-a',[...options,...surfaceArgs],{cpu:4,memory:4});
  for(const [context,value] of Object.entries(surfaces.contexts))assertRestrictedSurfaces(baseline.contexts[context].surfaces,value.surfaces,context,context==='page');
  const surfaceRestart=await runCase('surface-policy-a-restart',[...options,...surfaceArgs],{cpu:4,memory:4},false);
  assert.deepEqual(surfaceRestart.contexts.page.surfaces.audio.first,surfaces.contexts.page.surfaces.audio.first,'Native audio identity must survive restart');
  const otherSurfaces=await runCase('surface-policy-b',[...options,'--vesper-audio-seed=fedcba9876543210'],{cpu:4,memory:4},false);
  assert.notDeepEqual(otherSurfaces.contexts.page.surfaces.audio.first,surfaces.contexts.page.surfaces.audio.first,'Independent native audio seeds must differ');
  const invalidSurfaces=await runCase('surface-policy-invalid',[...options,'--vesper-audio-seed=invalid','--vesper-webgl-policy=Restricted','--vesper-local-font-policy=Restricted'],{cpu:4,memory:4},false);
  assert.deepEqual(invalidSurfaces.contexts.page.surfaces,baseline.contexts.page.surfaces,'Malformed surface switches must retain upstream observations');
  report.surfacePolicies=['webgl-debug-restriction','offline-audio-seed','local-font-discovery'];
  assert.equal(await digest(executable), report.executableSha256, 'Candidate executable changed during proof');
  report.checks.push('Direct native launch without CDP environment overrides or JS shims', 'First-script CPU/device-memory in pages, OOPIFs, dedicated/shared/service workers, startup MV3 extension worker and popup', 'Deterministic non-accumulating RGBA8 readback and coherent native PNG exports', 'Canvas2D policy does not create WebGL 1/2 pixel/export contradictions', 'Stable seed across process restart; independent seed differs', 'Malformed native switches fall back to upstream values', 'WebGL debug extension advertisement, access and unsupported-enum errors agree', 'Offline audio shared reads, offset copies and completion event agree; seeded output survives restart and invalid input retains fallback', 'Restricted local families fall back, essential font metrics remain intact, CSS local unique faces and font enumeration are denied');
  report.state = 'passed'; report.nativeProof = true;
} catch (error) { report.state = 'failed'; report.errors.push(error.message ?? String(error)); report.diagnosticStack = error.stack; }
finally {
  await active?.close().catch(() => {});
  await new Promise(done => fixture.close(done));
  await rm(temporary, { recursive: true, force: true });
  report.completedAt = new Date().toISOString();

}

return report;
}
