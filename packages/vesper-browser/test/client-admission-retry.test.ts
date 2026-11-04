import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VesperBrowser, VesperBrowserClient, browserAccessToken, createBrowserServer } from '../src/index.js';

async function fixture(mode: 'before'|'after'|'partial'|'incomplete'|'twice'|'http'|'deadline') {
  const directory = await mkdtemp(join(tmpdir(), 'vesper-admission-transport-'));
  const browser = new VesperBrowser({ directory, executablePath: process.execPath });
  const token = await browserAccessToken(directory), backend = await createBrowserServer(browser, token);
  await new Promise<void>(done => backend.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(backend.address() as any).port}`, bodies: string[] = [], keys: string[] = []; let posts = 0;
  if (mode === 'incomplete') { const original = browser.create.bind(browser); browser.create = async settings => { await original(settings); throw Error('Owned failure before admission commit'); }; }
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); };
  const front = createServer((request, response) => { void (async () => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk)); const body = Buffer.concat(chunks);
    if (request.method === 'POST') { posts++; bodies.push(body.toString()); keys.push(String(request.headers['idempotency-key'] ?? '')); }
    if (mode === 'http') { response.writeHead(500, { 'content-type': 'application/json' }); response.end('{"error":"Owned explicit rejection"}'); return; }
    if ((mode === 'before' && posts === 1) || mode === 'twice') { response.destroy(); return; }
    if (mode === 'deadline') { if (posts === 1) later(() => response.destroy(), 150); else later(() => { response.writeHead(201, { 'content-type': 'application/json' }); response.end(JSON.stringify({ id: randomUUID() })); }, 150); return; }
    const headers = Object.fromEntries(['authorization','content-type','x-vesper-run-id','idempotency-key','x-vesper-lease'].filter(key => typeof request.headers[key] === 'string').map(key => [key, request.headers[key] as string]));
    const result = await fetch(origin + request.url, { method: request.method, headers, ...(body.length ? { body } : {}) }); const bytes = Buffer.from(await result.arrayBuffer());
    if ((mode === 'after' || mode === 'incomplete') && posts === 1) { response.destroy(); return; }
    if (mode === 'partial' && posts === 1) { response.writeHead(result.status, { 'content-type': 'application/json', 'content-length': String(bytes.length) }); response.write(bytes.subarray(0, 7)); later(() => response.destroy(), 20); return; }
    response.writeHead(result.status, { 'content-type': 'application/json' }); response.end(bytes);
  })().catch(() => response.destroy()); });
  await new Promise<void>(done => front.listen(0, '127.0.0.1', done));
  const client = new VesperBrowserClient({ url: `http://127.0.0.1:${(front.address() as any).port}`, tokenFile: join(directory, 'admin-token'), timeoutMs: mode === 'deadline' ? 250 : 3000 });
  return { browser, client, bodies, keys, posts: () => posts, async close() { for (const t of timers) clearTimeout(t); front.closeAllConnections(); backend.closeAllConnections(); await Promise.all([new Promise<void>(done => front.close(() => done())),new Promise<void>(done => backend.close(() => done()))]); await browser.close(); await rm(directory, { recursive: true, force: true }); } };
}
for (const mode of ['before','after','partial'] as const) test(`keyed profile creation survives a lost ${mode === 'before' ? 'request' : mode === 'partial' ? 'response body' : 'committed response'} without duplicate profiles`, async () => {
  const f = await fixture(mode); try { const id = randomUUID(), settings = { name: `run-${id}` }; const profile = await f.client.create(settings); assert.equal(f.posts(), 2); assert.deepEqual(f.bodies, [JSON.stringify(settings), JSON.stringify(settings)]); assert.deepEqual(f.keys, [`create-${id}`,`create-${id}`]); const profiles = await f.browser.listProfiles(); assert.equal(profiles.length, 1); assert.equal(profiles[0]!.id, profile.id); } finally { await f.close(); }
});
test('a transport retry cannot repeat an admission left incomplete after profile creation', async () => {
  const f = await fixture('incomplete'); try { await assert.rejects(f.client.create({name:`run-${randomUUID()}`}), (error: any) => error.status === 409); assert.equal(f.posts(),2); assert.equal((await f.browser.listProfiles()).length,1); } finally { await f.close(); }
});
test('unkeyed manual profile creation never retries an ambiguous transport loss', async () => {
  const f = await fixture('before'); try { await assert.rejects(f.client.create({name:'Owned manual profile'})); assert.equal(f.posts(),1); assert.equal((await f.browser.listProfiles()).length,0); } finally { await f.close(); }
});
test('an explicit HTTP failure is returned without a transport retry', async () => {
  const f = await fixture('http'); try { await assert.rejects(f.client.create({name:`run-${randomUUID()}`}), (error: any) => error.status === 500); assert.equal(f.posts(),1); } finally { await f.close(); }
});
test('keyed create recovery stops after one transport retry', async () => {
  const f = await fixture('twice'); try { await assert.rejects(f.client.create({name:`run-${randomUUID()}`})); assert.equal(f.posts(),2); } finally { await f.close(); }
});
test('both create attempts share the original request deadline', async () => {
  const f = await fixture('deadline'); try { await assert.rejects(f.client.create({name:`run-${randomUUID()}`}), (error: any) => ['TimeoutError','AbortError'].includes(error.name)); assert.ok(f.posts() <= 2); } finally { await f.close(); }
});
