import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { arch, platform, tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { LocalEngineOptions, VesperBrowser } from './browser.js';
import type { TargetPolicyReport } from './target-policy.js';

export interface EngineCandidate { family: 'chromium' | 'brave'; buildId: string; executablePath: string }
export interface EngineCanaryObservation {
  cpu: number; language: string; locale: string; timezone: string;
  screen: { width: number; height: number; pixelRatio: number } | null;
}
export interface EngineCanaryReport {
  schemaVersion: 1; state: 'running' | 'passed' | 'failed'; startedAt: string; completedAt?: string;
  candidate: EngineCandidate & { executableSha256?: string; kernelVersion?: string };
  machine: { platform: string; arch: string };
  implementation: 'upstream-native-engines-and-cdp'; customCompiledKernel: false;
  scope: string; requested: typeof requested;
  contexts: Record<string, EngineCanaryObservation>;
  targetPolicy?: TargetPolicyReport; nativeFingerprintSetting?: number;
  checks: string[]; errors: string[]; limitations: string[];
}
export class EngineCanaryError extends Error {
  constructor(readonly report: EngineCanaryReport) {
    super(`Engine candidate qualification failed: ${report.errors.join('; ')}`);
    this.name = 'EngineCanaryError';
  }
}

const requested = {
  locale: 'fr-FR', timezone: 'America/New_York',
  environment: { hardwareConcurrency: 4, screen: { width: 1366, height: 768, deviceScaleFactor: 1 } },
};
const fixtureSample = `({cpu:navigator.hardwareConcurrency,language:navigator.language,locale:Intl.DateTimeFormat().resolvedOptions().locale,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,screen:typeof screen==='undefined'?null:{width:screen.width,height:screen.height,pixelRatio:devicePixelRatio}})`;
// Keep this owned-fixture task as source text: TypeScript test loaders can add
// function-name helpers which are unavailable when Puppeteer serializes a fn.
const serviceObservation = `new Promise((done,reject)=>{
  let settled=false;
  const timer=setTimeout(()=>finish(new Error('Canary service worker timed out')),10000);
  const receive=event=>{if(event.data?.request==='vesper-canary')finish(undefined,event.data.observation)};
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker.removeEventListener('message',receive);if(error)reject(error);else done(value)}
  navigator.serviceWorker.addEventListener('message',receive);
  (async()=>{const registration=await navigator.serviceWorker.register('/service.js');await navigator.serviceWorker.ready;if(!registration.active)throw new Error('Canary service worker is not active');registration.active.postMessage('vesper-canary')})().catch(error=>finish(error));
})`;

async function executableHash(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
function checkedTemporaryPath(root: string, directory: string) {
  const child = relative(root, directory);
  if (!child || child.startsWith('..') || isAbsolute(child) || !child.startsWith('vesper-engine-canary-')) throw new Error('Invalid engine canary cleanup path');
}
function verify(value: EngineCanaryObservation, context: string, family: EngineCandidate['family']) {
  assert.ok(value && typeof value === 'object', `${context}: missing first-script observation`);
  assert.equal(value.cpu, 4, `${context}: hardware concurrency`);
  assert.equal(value.locale, requested.locale, `${context}: ICU locale`);
  assert.equal(value.timezone, requested.timezone, `${context}: timezone`);
  assert.equal(value.language, requested.locale, `${context}: navigator.language`);
  if (family === 'chromium' && value.screen) assert.deepEqual(value.screen, { width: 1366, height: 768, pixelRatio: 1 }, `${context}: native headless display`);
}

/** Activation gate using only a new owned store and original loopback fixtures.
 * The factory keeps the runtime dependency on VesperBrowser out of this module.
 * A successful report qualifies this machine/build/fixture, not every site.
 */
export async function qualifyEngineCandidate(candidate: EngineCandidate, factory: (options: LocalEngineOptions) => VesperBrowser): Promise<EngineCanaryReport> {
  const report: EngineCanaryReport = {
    schemaVersion: 1, state: 'running', startedAt: new Date().toISOString(), candidate: { ...candidate },
    machine: { platform: platform(), arch: arch() }, implementation: 'upstream-native-engines-and-cdp', customCompiledKernel: false,
    scope: 'Fresh headless Vesper profile; first scripts in owned loopback page/OOPIF/worker/shared-worker/service-worker/popup fixtures.',
    requested: structuredClone(requested), contexts: {}, checks: [], errors: [],
    limitations: ['No custom compiled Vesper kernel, arbitrary device persona or all-site qualification.', 'Headed cross-process screen metrics, restored sessions and OS/DNS/UDP/WebRTC routing are not qualified.', 'Brave standard protection controls native privacy; screen farbling is recorded rather than forced to match Chromium.', 'Executable SHA-256 identifies the launcher file, not every file in the engine distribution.'],
  };
  let directory: string | undefined, temporaryRoot: string | undefined;
  let owner: VesperBrowser | undefined, connection: Browser | undefined;
  let ownerClosed = false;
  let port = 0;
  const fixture = createServer((request, response) => {
    response.setHeader('cache-control', 'no-store');
    const path = new URL(request.url ?? '/', 'http://fixture.local').pathname;
    if (path.endsWith('.js')) {
      response.setHeader('content-type', 'application/javascript');
      if (path === '/shared.js') response.end(`const first=${fixtureSample};onconnect=e=>{e.ports[0].postMessage(first);e.ports[0].start()};`);
      else if (path === '/service.js') response.end(`const first=${fixtureSample};self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('message',e=>e.source?.postMessage({request:e.data,observation:first}));`);
      else response.end(`postMessage(${fixtureSample});`);
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end(`<!doctype html><title>Vesper engine activation canary</title><script>window.vesperCanaryFirst=${fixtureSample};</script>${path === '/main' ? `<iframe src="/same-frame" width="400" height="250"></iframe><iframe src="http://localhost:${port}/cross-frame" width="400" height="250"></iframe>` : ''}`);
  });
  try {
    if (!['chromium', 'brave'].includes(candidate.family) || typeof candidate.buildId !== 'string' || !candidate.buildId || candidate.buildId.length > 120 || typeof candidate.executablePath !== 'string' || !candidate.executablePath) throw new Error('Invalid engine canary candidate');
    const executablePath = await realpath(resolve(candidate.executablePath));
    if (!(await stat(executablePath)).isFile()) throw new Error('Engine candidate executable is not a file');
    report.candidate.executablePath = executablePath;
    report.candidate.executableSha256 = await executableHash(executablePath);
    temporaryRoot = await realpath(tmpdir());
    directory = await realpath(await mkdtemp(join(temporaryRoot, 'vesper-engine-canary-')));
    checkedTemporaryPath(temporaryRoot, directory);
    if (candidate.family === 'brave') await writeFile(join(directory, 'selected-brave.json'), JSON.stringify({ family: candidate.family, buildId: candidate.buildId, executablePath }), { flag: 'wx', mode: 0o600 });
    const created = factory({ directory, executablePath, headless: true, maxConcurrency: 1 });
    // Require the supplied factory to respect the owned store boundary.
    assert.equal(resolve(created.storeDirectory), directory, 'Canary factory must use its fresh temporary store');
    owner = created;
    await new Promise<void>((done, reject) => { fixture.once('error', reject); fixture.listen(0, '127.0.0.1', done); });
    const address = fixture.address(); if (!address || typeof address === 'string') throw new Error('Canary fixture did not obtain a loopback port');
    port = address.port;
    const origin = `http://127.0.0.1:${port}`;
    const profile = await owner.create({ ...requested, engine: candidate.family, fingerprint: { protection: candidate.family === 'brave' ? 'standard' : 'off' } });
    await owner.start(profile.id);
    connection = await puppeteer.connect({ browserWSEndpoint: await owner.connectionUrl(profile.id), defaultViewport: null, protocolTimeout: 15000 });
    report.candidate.kernelVersion = await connection.version();
    const page = (await connection.pages())[0]; if (!page) throw new Error('Engine did not create an initial page');
    await page.goto(`${origin}/main`, { waitUntil: 'load', timeout: 15000 });
    report.contexts.page = await page.evaluate(() => (globalThis as unknown as { vesperCanaryFirst: EngineCanaryObservation }).vesperCanaryFirst);
    for (const name of ['same-frame', 'cross-frame']) {
      const frame = page.frames().find(frame => frame.url().endsWith(`/${name}`));
      if (!frame) throw new Error(`Canary ${name} is missing`);
      await frame.waitForFunction(() => (globalThis as unknown as { vesperCanaryFirst?: EngineCanaryObservation }).vesperCanaryFirst, { timeout: 10000 });
      report.contexts[name] = await frame.evaluate(() => (globalThis as unknown as { vesperCanaryFirst: EngineCanaryObservation }).vesperCanaryFirst);
    }
    report.contexts.worker = await page.evaluate(() => new Promise<EngineCanaryObservation>((done, reject) => {
      const worker = new Worker('/worker.js');
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Canary dedicated worker timed out')); }, 10000);
      worker.onmessage = event => { clearTimeout(timer); worker.terminate(); done(event.data); };
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
    }));
    report.contexts.sharedWorker = await page.evaluate(() => new Promise<EngineCanaryObservation>((done, reject) => {
      const worker = new SharedWorker('/shared.js');
      const timer = setTimeout(() => { worker.port.close(); reject(new Error('Canary shared worker timed out')); }, 10000);
      worker.port.onmessage = event => { clearTimeout(timer); worker.port.close(); done(event.data); };
      worker.onerror = event => { clearTimeout(timer); worker.port.close(); reject(new Error(event.message)); }; worker.port.start();
    }));
    report.contexts.serviceWorker = await page.evaluate(serviceObservation) as EngineCanaryObservation;
    const popupUrl = `${origin}/popup`, next = connection.waitForTarget(target => target.url() === popupUrl, { timeout: 15000 });
    await page.evaluate(url => window.open(url, '_blank'), popupUrl);
    const popup = await (await next).page(); if (!popup) throw new Error('Canary popup is missing');
    await popup.waitForFunction(() => (globalThis as unknown as { vesperCanaryFirst?: EngineCanaryObservation }).vesperCanaryFirst, { timeout: 10000 });
    report.contexts.popup = await popup.evaluate(() => (globalThis as unknown as { vesperCanaryFirst: EngineCanaryObservation }).vesperCanaryFirst);
    for (const [context, value] of Object.entries(report.contexts)) { verify(value, context, candidate.family); report.checks.push(`${context}: first-script CPU/locale/timezone/language${candidate.family === 'chromium' && value.screen ? '/screen' : ''}`); }
    const fingerprint = await owner.fingerprintReport(profile.id);
    assert.ok(fingerprint.targetPolicy, 'Engine target policy report is missing');
    report.targetPolicy = fingerprint.targetPolicy;
    assert.equal(report.targetPolicy.beforeScript, true, 'Target policy must remain healthy');
    assert.deepEqual(report.targetPolicy.failures, [], 'No target policy failures are admitted');
    for (const type of ['page', 'iframe', 'worker', 'shared_worker', 'service_worker']) assert.ok((report.targetPolicy.configured[type] ?? 0) > 0, `Policy did not observe a ${type} target`);
    report.checks.push('Controller observed every required target type without policy failure');
    await connection.disconnect(); connection = undefined; await owner.stop(profile.id);
    if (candidate.family === 'brave') {
      const preferences = JSON.parse(await readFile(join(directory, 'profiles', profile.id, 'browser', 'Default', 'Preferences'), 'utf8')) as { profile?: { default_content_setting_values?: { fingerprintingV2?: number } } };
      report.nativeFingerprintSetting = preferences.profile?.default_content_setting_values?.fingerprintingV2;
      assert.equal(report.nativeFingerprintSetting, 3, 'Brave standard native protection preference');
      report.checks.push('Brave native standard protection preference persisted');
    }
    assert.equal(await executableHash(executablePath), report.candidate.executableSha256, 'Candidate executable changed during qualification');
  } catch (error) { report.errors.push((error as Error).message); }
  finally {
    try { await connection?.disconnect(); } catch (error) { report.errors.push(`Canary disconnect: ${(error as Error).message}`); }
    try { await owner?.close(); ownerClosed = true; } catch (error) { report.errors.push(`Canary browser shutdown: ${(error as Error).message}`); }
    fixture.closeAllConnections();
    if (fixture.listening) await new Promise<void>(done => fixture.close(error => { if (error) report.errors.push(`Canary fixture shutdown: ${error.message}`); done(); }));
    if (directory && temporaryRoot && ownerClosed) {
      try { checkedTemporaryPath(temporaryRoot, directory); await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
      catch (error) { report.errors.push(`Canary temporary cleanup: ${(error as Error).message}`); }
    }
  }
  report.completedAt = new Date().toISOString();
  report.state = report.errors.length ? 'failed' : 'passed';
  if (report.state === 'failed') throw new EngineCanaryError(report);
  return report;
}
