import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, mkdtemp, realpath, copyFile, rmdir } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';

const args = process.argv.slice(2), option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
assert.ok(option('--kernel-manifest') && option('--expected-kernel-sha256') && option('--output'), 'Provide --kernel-manifest, --expected-kernel-sha256 and --output');
const root = resolve(import.meta.dirname, '..'), payload = resolve(option('--workbench-payload') ?? root);
const browserPayload = resolve(option('--browser-payload') ?? root);
const load = (base, file) => import(pathToFileURL(join(base, file)).href);
const [{ registerFixture }, browserModule, nativeModule] = await Promise.all([
  load(payload, 'dist/fixture.js'), load(browserPayload, 'packages/vesper-browser/dist/index.js'), load(browserPayload, 'packages/vesper-browser/dist/native-kernel.js'),
]);
const { VesperBrowser, VesperBrowserClient, browserAccessToken, createBrowserServer } = browserModule;
const output = resolve(option('--output')), fixtureRoot = resolve(option('--fixture-root') ?? '.workbench/replay-lifecycle-fixtures');
await mkdir(fixtureRoot, { recursive: true }); await mkdir(dirname(output), { recursive: true });
const data = await mkdtemp(join(fixtureRoot, 'owned-')), token = 'owned-notification-lifecycle-' + randomUUID();
const report = { at: new Date().toISOString(), state: 'running', platform: process.platform, scope: 'Real script and managed runtimes, independent Browser API and existing qualified custom executable in a new owned store; not actual desktop/operator-store acceptance', actualInstalledProof: false, dataRoot: data, checks: [], errors: [], nativeKernelChanged: false, versions: {}, stages: [] };
const diagnostics = args.includes('--diagnostics');
const dropAdmissionReply = args.includes('--drop-admission-reply');
const scriptCycles = Number(option('--script-cycles') ?? 1); assert.ok(Number.isInteger(scriptCycles) && scriptCycles >= 1 && scriptCycles <= 10, 'Use one to ten owned script cycles');
report.transportDiagnostics = [];
const save = async stage => { report.stage = stage; report.stages.push({ stage, at: new Date().toISOString() }); await writeFile(output, JSON.stringify(report, null, 2)); };
const hash = async file => { const h = createHash('sha256'); for await (const b of createReadStream(file)) h.update(b); return h.digest('hex'); };
const pause = ms => new Promise(done => setTimeout(done, ms));
const manifestPath = await realpath(resolve(option('--kernel-manifest'))), manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const executablePath = await realpath(resolve(dirname(manifestPath), manifest.executable));
assert.equal(await hash(executablePath), option('--expected-kernel-sha256')); assert.equal(manifest.executableSha256, option('--expected-kernel-sha256'));
await nativeModule.verifyNativeRuntime(executablePath, manifest.runtimeFiles);
report.kernel = { executablePath, sha256: manifest.executableSha256, runtimeFilesVerified: true, engineFamily: 'chromium', note: 'Existing custom executable exercised through Chromium-compatible launches; no new native-policy activation or masking qualification' };
const fixture = Fastify({ logger: false }); await fixture.register(cookie); await registerFixture(fixture, token);
const effects = new Map(); let fixtureMutations = 0;
fixture.addHook('onRequest', async request => { if (request.method === 'POST') fixtureMutations++; });
fixture.get('/replay-script', async (_request, reply) => reply.type('text/html').send('<!doctype html><title>Owned replay fixture</title><h1>Owned replay lifecycle</h1>'));
fixture.post('/owned-effect/:id', async request => { const id = request.params.id; effects.set(id, (effects.get(id) ?? 0) + 1); return { recorded: true }; });
const fixtureOrigin = await fixture.listen({ host: '127.0.0.1', port: 0 });
const automations = join(data, 'automations'), flows = join(data, 'flows'); await mkdir(automations); await mkdir(flows);
await writeFile(join(automations, 'owned-replay.mjs'), `export default {id:'owned-replay',title:'Owned replay lifecycle',inputSchema:{type:'object',additionalProperties:false,properties:{url:{type:'string'},marker:{type:'string'},mode:{enum:['save','fail','cancel','export-retry']}},required:['url','marker','mode']},profile:()=>({storage:'local',engine:'chromium'}),async run(c){await c.page.goto(c.inputs.url);await c.page.evaluate(async marker=>{const r=await fetch('/owned-effect/'+encodeURIComponent(marker),{method:'POST'});if(!r.ok)throw Error('Owned effect failed')},c.inputs.marker);if(c.inputs.mode==='fail')throw Error('Owned deliberate failure');await c.requestInput('Owned lifecycle input',{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false});await c.checkpoint();await c.waitForFinish();}};`);
for (const name of ['owned-site.flow.json', 'owned-site.manifest.json']) await copyFile(join(root, 'flows', name), join(flows, name));
const browser = new VesperBrowser({ directory: join(data, 'browser'), executablePath, headless: true, graphicsBackend: process.platform === 'linux' ? 'software' : undefined, maxConcurrency: 1 });
let manager, admissionProxy, client, worker, stream, api, sourceOrigin;
const admissionAttempts = []; let droppedAdmissionKey;
const live = [], allStreams = []; let cursor;
async function openStream(lastId) {
  const controller = new AbortController(), response = await fetch(sourceOrigin + '/api/v1/events', { headers: { authorization: 'Bearer ' + token, ...(lastId ? { 'last-event-id': lastId } : {}) }, signal: controller.signal });
  assert.equal(response.status, 200); const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = ''; const events = []; let failure;
  const pump = (async () => { try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }); let index; while ((index = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2); const type = /^event: (.+)$/m.exec(frame)?.[1]; if (!type) continue; const id = /^id: (.+)$/m.exec(frame)?.[1]; assert.ok(id); const data = JSON.parse(/^data: (.+)$/m.exec(frame)[1]); const event = { id, type, data }; if (events.length) assert.ok(Number(id.split(':')[1]) > Number(events.at(-1).id.split(':')[1]), 'Per-connection IDs are strictly increasing'); events.push(event); live.push(event); cursor = id; } } } catch (error) { if (!controller.signal.aborted) failure = error; } })();
  const result = { events, async close() { controller.abort(); await pump; if (failure) throw failure; } }; allStreams.push(result); return result;
}
async function waitFor(check, label, milliseconds = 90000) { const deadline = Date.now() + milliseconds; while (Date.now() < deadline) { const value = await check(); if (value) return value; await pause(50); } throw Error('Timed out: ' + label); }
async function eventFor(id, predicate, label) { return waitFor(() => live.findLast(e => e.type === 'run' && e.data.id === id && predicate(e.data)), label); }
async function stateFor(id, predicate, label) { return waitFor(async () => { const run = await api('runs/' + id); if (predicate(run)) return run; assert.ok(!['failed','cancelled','interrupted','export_failed'].includes(run.state), label + ' ended ' + run.state + ' before its expected checkpoint'); return false; }, label); }
async function reconnectWithoutActions() {
  const lastId = cursor, before = fixtureMutations; await stream.close(); stream = await openStream(lastId);
  await pause(150); assert.equal(fixtureMutations, before, 'Replay cannot repeat fixture POST effects'); assert.ok(stream.events.every(e => e.type === 'run'), 'A retained recent cursor must not reset');
}
async function startWorkbench() {
  const env = { ...process.env, WORKBENCH_TOKEN: token, WORKBENCH_DATA_DIR: join(data, 'workbench'), EXPORT_DIR: join(data, 'exports'), AUTOMATIONS_DIR: automations, FLOWS_DIR: flows, PROXY_INVENTORY_FILE: join(data, 'proxy-inventory.json'), VESPER_BROWSER_URL: report.browserOrigin, VESPER_BROWSER_TOKEN_FILE: join(data, 'browser', 'admin-token'), BROWSER_BACKEND: 'local', VESPER_LOCAL_COORDINATOR: 'true', FIXTURE_ORIGIN: fixtureOrigin, ENABLE_TEST_FIXTURE: 'true', HOST: '127.0.0.1', PORT: '0', MAX_CONCURRENCY: '1', RUN_TIMEOUT_MS: '180000', IDLE_TIMEOUT_MS: '120000', WORKBENCH_TENANT_ID: report.tenantId, WORKBENCH_NODE_ID: report.nodeId, KAMELEO_TEAM_KEY: 'owned-replay-coordinator', KAMELEO_BROWSER_BUDGET: '1' };
  env.VESPER_DESKTOP = 'true'; // Desktop services support a dynamically assigned loopback port.
  for (const key of ['NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'ELECTRON_RUN_AS_NODE', 'DATABASE_URL', 'FLOW_POLICIES_FILE', 'PUBLIC_ORIGIN', 'COOKIE_SECURE', 'KAMELEO_VNC_URL', 'VNC_PASSWORD']) delete env[key];
  const traceFile = join(data, 'owned-fetch-trace.mjs');
  if (diagnostics) await writeFile(traceFile, `const original=globalThis.fetch;globalThis.fetch=async function(input,init){const u=new URL(String(input));const meta={type:'owned-fetch-trace',method:init?.method??'GET',path:u.pathname};try{const response=await original(input,init);if(!response.ok){let text='';try{text=(await response.clone().json()).error??''}catch{}process.send?.({...meta,status:response.status,error:String(text).slice(0,300)})}return response}catch(error){process.send?.({...meta,errorName:error.name,causeCode:error.cause?.code??error.code??null});throw error}};`);
  worker = fork(join(payload, 'dist/cli.js'), ['serve'], { execPath: process.execPath, execArgv: diagnostics ? ['--import', pathToFileURL(traceFile).href] : [], env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  worker.on('message', message => { if (message.type === 'owned-fetch-trace') { report.transportDiagnostics.push(message); report.transportDiagnostics = report.transportDiagnostics.slice(-40); } });
  let log = ''; worker.stdout.on('data', b => { log = (log + b).slice(-4000); }); worker.stderr.on('data', b => { log = (log + b).slice(-4000); });
  await new Promise((done, reject) => { const owned = worker; const timer = setTimeout(() => { cleanup(); reject(Error('Owned Workbench startup timed out: ' + log)); }, 45000); const exited = () => { cleanup(); reject(Error('Owned Workbench exited during startup: ' + log)); }; const ready = m => { if (m.type === 'ready') { cleanup(); done(); } }; const cleanup = () => { clearTimeout(timer); owned.off('exit', exited); owned.off('message', ready); }; owned.once('exit', exited); owned.on('message', ready); });
  const descriptor = JSON.parse(await readFile(join(data, 'workbench/service.json'), 'utf8')); assert.equal(descriptor.pid, worker.pid); sourceOrigin = 'http://127.0.0.1:' + descriptor.port;
  api = async (path, method = 'GET', body) => { const response = await fetch(sourceOrigin + '/api/v1/' + path, { method, headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) }); if (!response.ok) throw Error(path + ': HTTP ' + response.status + ' ' + await response.text()); return response.json(); };
  report.versions.workbench = (await api('capabilities')).version;
}
async function stopWorkbench() { await stream?.close(); stream = undefined; if (worker && worker.exitCode === null && worker.signalCode === null) { const stopped = once(worker, 'exit'); worker.send('shutdown'); await Promise.race([stopped, new Promise((_, reject) => { const t = setTimeout(() => reject(Error('Owned Workbench did not quit normally')), 60000); t.unref(); })]); } worker = undefined; }
async function verifiedArchive(run) { assert.equal(run.state, 'saved'); assert.ok(run.artifact.bytes > 0); assert.equal(await hash(run.artifact.path), run.artifact.sha256); report.archives ??= []; report.archives.push({ runId: run.id, bytes: run.artifact.bytes, sha256: run.artifact.sha256 }); }
try {
  await save('starting-owned-pair');
  manager = await createBrowserServer(browser, await browserAccessToken(join(data, 'browser'))); await new Promise(done => manager.listen(0, '127.0.0.1', done));
  if (diagnostics) manager.on('request', (request, response) => { response.once('finish', () => { if (response.statusCode >= 400) report.transportDiagnostics.push({ source: 'owned-browser-http', method: request.method, path: request.url.split('?')[0], status: response.statusCode }); }); });
  report.browserOrigin = 'http://127.0.0.1:' + manager.address().port; report.tenantId = randomUUID(); report.nodeId = randomUUID();
  if (dropAdmissionReply) {
    const target = report.browserOrigin;
    admissionProxy = createServer((request, response) => {
      const admission = request.method === 'POST' && request.url === '/api/v1/profiles';
      const key = request.headers['idempotency-key'];
      if (admission && droppedAdmissionKey === undefined) droppedAdmissionKey = key;
      const captured = admission && key === droppedAdmissionKey ? { key, chunks: [], status: undefined } : undefined;
      if (captured) { admissionAttempts.push(captured); request.on('data', chunk => captured.chunks.push(Buffer.from(chunk))); }
      const discard = captured && admissionAttempts.length === 1;
      const upstream = httpRequest(new URL(request.url, target), { method: request.method, headers: request.headers }, incoming => {
        if (captured) captured.status = incoming.statusCode;
        if (discard) { incoming.resume(); incoming.once('end', () => response.destroy()); }
        else { response.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(response); }
        incoming.on('error', () => response.destroy());
      });
      upstream.on('error', () => response.destroy()); request.once('aborted', () => upstream.destroy());
      response.once('close', () => { if (!response.writableEnded) upstream.destroy(); }); request.pipe(upstream);
    });
    await new Promise(done => admissionProxy.listen(0, '127.0.0.1', done));
    report.browserOrigin = 'http://127.0.0.1:' + admissionProxy.address().port;
  }
  client = new VesperBrowserClient({ url: report.browserOrigin, tokenFile: join(data, 'browser', 'admin-token') }); await client.ready();
  report.versions.browser = JSON.parse(await readFile(join(browserPayload, 'packages/vesper-browser/package.json'), 'utf8')).version;
  await startWorkbench(); stream = await openStream(); await waitFor(() => cursor, 'initial reset'); report.checks.push('Independent Browser API and combined real script/managed coordinator start in an empty owned store with verified existing custom executable');
  for (const mode of Array.from({ length: scriptCycles }, () => ['save', 'fail', 'cancel', 'export-retry']).flat()) {
    await save('script-' + mode); const marker = randomUUID();
    const run = await api('runs', 'POST', { automationId: 'owned-replay', inputs: { url: fixtureOrigin + '/replay-script', marker, mode }, preset: 'fast' });
    if (mode === 'fail') { await eventFor(run.id, r => r.state === 'failed' && !r.cleanupRequired, 'script failure notification'); assert.equal(effects.get(marker), 1); await reconnectWithoutActions(); report.checks.push('Real script failure and confirmed browser cleanup reach replay without repeating its owned side effect'); continue; }
    const challenge = await stateFor(run.id, r => r.challenge, 'script input challenge'); await eventFor(run.id, r => r.state === 'awaiting_input', 'script challenge event'); await reconnectWithoutActions();
    if (mode === 'cancel') { await api('runs/' + run.id + '/cancel', 'POST', {}); await eventFor(run.id, r => r.state === 'cancelled' && !r.cleanupRequired, 'script cancellation event'); assert.equal(effects.get(marker), 1); report.checks.push('Real script cancellation is durable and retains one owned side effect'); continue; }
    await api('runs/' + run.id + '/pause', 'POST', {}); await api('runs/' + run.id + '/input', 'POST', { challengeId: challenge.challenge.id, values: { value: 'owned-answer' } });
    await eventFor(run.id, r => r.state === 'paused', 'script paused'); await reconnectWithoutActions(); await api('runs/' + run.id + '/resume', 'POST', {});
    await stateFor(run.id, r => r.waitingForFinish, 'script ready to finish');
    const blocker = join(data, 'exports', run.id + '.workbench.tgz'); if (mode === 'export-retry') await mkdir(blocker);
    await api('runs/' + run.id + '/finish', 'POST', {});
    if (mode === 'export-retry') { await eventFor(run.id, r => r.state === 'export_failed', 'real export publication failure'); await reconnectWithoutActions(); await rmdir(blocker); await api('runs/' + run.id + '/retry-export', 'POST', {}); }
    const saved = (await eventFor(run.id, r => r.state === 'saved', 'script saved')).data; await verifiedArchive(saved);
    assert.equal(effects.get(marker), 1); for (const state of ['queued', 'starting', 'running', 'awaiting_input', 'paused', 'saving', 'saved']) assert.ok(live.some(e => e.data?.id === run.id && e.data.state === state), 'Missing script state ' + state);
    report.checks.push(mode === 'export-retry' ? 'Real filesystem export failure, notification reconnect and successful export retry preserve the profile without rerunning its owned side effect' : 'Real script admission, browser start, input, pause/resume, saving and verified archive events survive notification reconnects');
  }
  for (const mode of ['save', 'cancel']) {
    await save('managed-' + mode); const run = await api('runs', 'POST', { automationId: 'owned-account-signin', inputs: { username: 'owned-replay-' + randomUUID().slice(0, 8), password: 'test-password' }, preset: 'fast' });
    const answered = new Set(); let paused = false, finish = false;
    await waitFor(async () => { const record = await api('runs/' + run.id); if (record.challenge && !answered.has(record.challenge.id)) {
      await eventFor(run.id, r => r.challenge?.id === record.challenge.id, 'managed challenge notification');
      if (mode === 'cancel') { await reconnectWithoutActions(); await api('runs/' + run.id + '/cancel', 'POST', {}); await eventFor(run.id, r => r.state === 'cancelled', 'managed cancellation'); return true; }
      const fields = record.challenge.fields.properties; assert.ok(!fields.decision, 'Owned flow unexpectedly requests uncertain-action review');
      const pauseNow = !paused;
      if (pauseNow) { await api('runs/' + run.id + '/pause', 'POST', {}); await eventFor(run.id, r => r.pauseRequested === true, 'managed pause request'); }
      answered.add(record.challenge.id); await api('runs/' + run.id + '/input', 'POST', { challengeId: record.challenge.id, values: { value: fields.value.enum?.[0] ?? '123456' } });
      if (pauseNow) { await eventFor(run.id, r => r.state === 'paused', 'managed paused checkpoint'); await reconnectWithoutActions(); await api('runs/' + run.id + '/resume', 'POST', {}); paused = true; }
    }
    if (record.waitingForFinish && !finish) { finish = true; await api('runs/' + run.id + '/finish', 'POST', {}); }
    if (record.state === 'saved') { await eventFor(run.id, r => r.state === 'saved', 'managed saved notification'); await verifiedArchive(record); return true; }
    assert.ok(!['failed', 'interrupted', 'export_failed'].includes(record.state), 'Managed flow ended ' + record.state); return false;
    }, 'managed lifecycle', 180000);
    report.checks.push(mode === 'save' ? 'Real managed flow selection/code challenges, paused checkpoint/resume, identity binding and verified export reach durable events' : 'Real managed-flow cancellation reaches committed replay without resubmitting the flow');
  }
  await save('owned-process-crash'); const crashMarker = randomUUID(); const crashRun = await api('runs', 'POST', { automationId: 'owned-replay', inputs: { url: fixtureOrigin + '/replay-script', marker: crashMarker, mode: 'save' }, preset: 'fast' });
  await eventFor(crashRun.id, r => r.state === 'awaiting_input', 'committed challenge before owned process crash'); const crashCursor = cursor, crashEffects = fixtureMutations;
  await stream.close(); stream = undefined; const dead = once(worker, 'exit'); worker.kill('SIGKILL'); await dead; worker = undefined;
  await startWorkbench(); stream = await openStream(crashCursor); const interrupted = (await eventFor(crashRun.id, r => r.state === 'interrupted', 'real restart recovery notification')).data;
  assert.equal(interrupted.cleanupRequired, false); assert.equal(fixtureMutations, crashEffects); assert.equal(effects.get(crashMarker), 1);
  await api('runs/' + crashRun.id + '/retry-export', 'POST', {}); const recovered = (await eventFor(crashRun.id, r => r.state === 'saved', 'recovered profile export')).data; await verifiedArchive(recovered); assert.equal(effects.get(crashMarker), 1);
  report.checks.push('Abrupt termination of only the owned real Workbench service reconciles its interrupted script, stops its owned browser and exports the retained profile without replaying an action');
  await save('restart-reconciliation'); const beforeRuns = await api('runs'), beforeEffects = fixtureMutations, beforeCursor = cursor; await stopWorkbench(); await startWorkbench(); live.length = 0; stream = await openStream(beforeCursor);
  await waitFor(() => beforeRuns.every(run => live.some(e => e.type === 'run' && e.data.id === run.id && e.data.state === run.state)), 'restart snapshots');
  assert.equal(fixtureMutations, beforeEffects); assert.equal((await api('runs')).length, beforeRuns.length); report.checks.push('Combined runtime and real local database restart preserve all run IDs/states and reconcile cursor history without re-admission or new fixture mutations');
  const journal = JSON.parse(await readFile(join(data, 'workbench/run-events.json'), 'utf8')); const rows = journal.events.filter(e => Number(e.sequence) > Number(beforeCursor.split(':')[1]));
  assert.deepEqual(stream.events.filter(e => e.type === 'run').map(e => e.id), rows.map(e => journal.epoch + ':' + e.sequence)); report.checks.push('Restart replay IDs exactly match committed on-disk history, in order without duplicates');
  assert.ok((await browser.listProfiles()).every(p => p.state !== 'running')); report.checks.push('All owned profile processes stop normally; original/operator stores were never opened');
  if (dropAdmissionReply) {
    assert.equal(admissionAttempts.length, 2); assert.ok(/^create-[a-f0-9-]{36}$/.test(droppedAdmissionKey));
    assert.deepEqual(admissionAttempts.map(a => a.status), [201, 201]);
    assert.deepEqual(Buffer.concat(admissionAttempts[0].chunks), Buffer.concat(admissionAttempts[1].chunks));
    assert.equal((await browser.listProfiles()).length, beforeRuns.length);
    report.admissionRecovery = { attempts: 2, committedReplyIntentionallyDropped: true, sameKeyAndBody: true, duplicateProfiles: 0 };
    report.checks.push('A deliberately lost committed Browser admission reply recovers through the exact keyed request once, with one profile per real run and no repeated owned side effect');
  }
  report.notificationFrames = allStreams.reduce((n, s) => n + s.events.length, 0); report.distinctRuns = beforeRuns.length; report.ownedMutations = fixtureMutations; report.state = 'passed';
} catch (error) { report.state = 'failed'; report.errors.push(error.stack ?? String(error)); process.exitCode = 1; }
finally { try { await stopWorkbench(); await client?.close(); if (admissionProxy) { admissionProxy.closeAllConnections(); await new Promise(done => admissionProxy.close(done)); } if (manager) await new Promise(done => manager.close(done)); await browser.close(); await fixture.close(); } catch (error) { report.state = 'failed'; report.errors.push('Owned cleanup: ' + String(error)); process.exitCode = 1; } await save(report.state); }
console.log(JSON.stringify({ state: report.state, checks: report.checks.length, output, errors: report.errors }));
